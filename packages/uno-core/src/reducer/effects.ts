import type { Card } from "../card";
import type {
  GamePlayerState,
  GameState,
  PlayerEliminationReason
} from "../gameState";
import { isBlackCard } from "../rules/cardGuards";
import { getActivePlayerCount } from "./turn";
import type { GameEvent } from "./types";

export const UNO_PROTECTION_WINDOW_MS = 3_000;
export const UNO_PENALTY_DRAW_COUNT = 6;
export const CHALLENGE_SUCCESS_TARGET_DRAW_COUNT = 2;
export const CHALLENGE_FAILURE_CHALLENGER_DRAW_COUNT = 6;
export const HAND_ELIMINATION_LIMIT = 25;

/** 深拷贝 GameState，保证 reducer 的无副作用边界清晰。 */
export function cloneGameState(state: GameState): GameState {
  return {
    ...state,
    playerOrder: [...state.playerOrder],
    players: state.players.map((player) => {
      return {
        ...player,
        hand: [...player.hand]
      };
    }),
    discardPile: [...state.discardPile],
    drawPile: [...state.drawPile],
    skippedOpeningBlackCards: [...state.skippedOpeningBlackCards],
    drawStack: { ...state.drawStack },
    drawUntilColor: { ...state.drawUntilColor },
    normalDrawOffer: { ...state.normalDrawOffer },
    challengeWindow: { ...state.challengeWindow },
    winnerPlayerIds: [...state.winnerPlayerIds]
  };
}

/** 在当前对局状态里查找玩家。 */
export function findPlayer(
  state: GameState,
  playerId: string
): GamePlayerState | undefined {
  return state.players.find((player) => player.id === playerId);
}

/** 从玩家手牌中按 id 查找单张牌。 */
export function findCardInHand(
  player: GamePlayerState,
  cardId: string
): Card | undefined {
  return player.hand.find((card) => card.id === cardId);
}

/** 从玩家手牌中批量取牌，并顺便拦掉重复 id。 */
export function findCardsInHand(
  player: GamePlayerState,
  cardIds: readonly string[]
): Card[] | null {
  const uniqueIds = new Set(cardIds);

  if (uniqueIds.size !== cardIds.length) {
    return null;
  }

  const cards: Card[] = [];

  for (const cardId of cardIds) {
    const card = findCardInHand(player, cardId);

    if (card === undefined) {
      return null;
    }

    cards.push(card);
  }

  return cards;
}

/** 从玩家手牌中移除多张牌，并按传入顺序返回。 */
export function removeCardsFromHand(
  player: GamePlayerState,
  cardIds: readonly string[]
): Card[] {
  const cards = findCardsInHand(player, cardIds);

  if (cards === null) {
    throw new Error("Tried to remove cards that are not all present in hand.");
  }

  const idSet = new Set(cardIds);
  player.hand = player.hand.filter((card) => !idSet.has(card.id));

  return cards;
}

/** 更新玩家的手牌计数、UNO 待喊状态与喊过 UNO 标记。 */
export function syncPlayerHandState(
  player: GamePlayerState,
  previousHandCount: number,
  now: number,
  events: GameEvent[]
): void {
  player.handCount = player.hand.length;

  if (player.isEliminated) {
    player.hasCalledUno = false;
    player.unoPendingSinceMs = null;
    return;
  }

  if (player.handCount === 1) {
    if (previousHandCount !== 1) {
      player.hasCalledUno = false;
      player.unoPendingSinceMs = now;
      events.push({
        type: "uno-pending",
        playerId: player.id
      });
    }

    return;
  }

  player.hasCalledUno = false;
  player.unoPendingSinceMs = null;
}

/** 让某位玩家直接摸若干张牌。 */
export function giveCardsToPlayer(
  state: GameState,
  player: GamePlayerState,
  cards: readonly Card[],
  now: number,
  events: GameEvent[],
  reason: Extract<GameEvent, { type: "cards-drawn" }>["reason"]
): void {
  const previousHandCount = player.handCount;
  player.hand.push(...cards);
  syncPlayerHandState(player, previousHandCount, now, events);
  events.push({
    type: "cards-drawn",
    playerId: player.id,
    count: cards.length,
    reason
  });
  markPlayerEliminatedIfNeeded(state, player, events);
}

/** 是否需要声明颜色。当前版本所有黑牌都需要。 */
export function cardRequiresDeclaredColor(card: Card): boolean {
  return isBlackCard(card);
}

/** 清空加牌链。 */
export function clearDrawStack(state: GameState): void {
  state.drawStack = {
    active: false,
    amount: 0,
    previousDrawValue: null,
    targetPlayerId: null
  };
}

/** 清空罚抽状态。 */
export function clearDrawUntilColor(state: GameState): void {
  state.drawUntilColor = {
    active: false,
    color: null,
    targetPlayerId: null
  };
}

export function openNormalDrawOffer(
  state: GameState,
  playerId: string,
  cardId: string,
  events: GameEvent[]
): void {
  state.normalDrawOffer = {
    active: true,
    playerId,
    cardId
  };
  events.push({
    type: "normal-draw-offer-opened",
    playerId,
    cardId
  });
}

export function clearNormalDrawOffer(state: GameState): void {
  state.normalDrawOffer = {
    active: false,
    playerId: null,
    cardId: null
  };
}

/** 打开质疑窗口。 */
export function openChallengeWindow(
  state: GameState,
  targetPlayerId: string,
  hadBlackCardBeforeDraw: boolean,
  events: GameEvent[]
): void {
  state.challengeWindow = {
    active: true,
    targetPlayerId,
    hadBlackCardBeforeDraw,
    expiresWhenNextPlayerCompletesAction: true
  };
  events.push({
    type: "challenge-window-opened",
    targetPlayerId
  });
}

/** 关闭质疑窗口。 */
export function clearChallengeWindow(state: GameState): void {
  state.challengeWindow = {
    active: false,
    targetPlayerId: null,
    hadBlackCardBeforeDraw: false,
    expiresWhenNextPlayerCompletesAction: false
  };
}

/** 当玩家手牌超过上限时，将其标记为淘汰。 */
export function markPlayerEliminatedIfNeeded(
  state: GameState,
  player: GamePlayerState,
  events: GameEvent[]
): void {
  if (player.isEliminated || player.handCount <= HAND_ELIMINATION_LIMIT) {
    return;
  }

  markPlayerEliminated(state, player, "hand-limit", events);
}

/** 显式淘汰玩家。 */
export function markPlayerEliminated(
  state: GameState,
  player: GamePlayerState,
  reason: PlayerEliminationReason,
  events: GameEvent[]
): void {
  player.isEliminated = true;
  player.eliminationReason = reason;
  player.hasCalledUno = false;
  player.unoPendingSinceMs = null;

  events.push({
    type: "player-eliminated",
    playerId: player.id,
    reason
  });

  finalizeRemainingWinner(state, events);
}

/** 如果场上只剩 1 名未淘汰玩家，则直接结束对局。 */
export function finalizeRemainingWinner(
  state: GameState,
  events: GameEvent[]
): void {
  if (state.status === "finished") {
    return;
  }

  if (getActivePlayerCount(state) !== 1) {
    return;
  }

  const winner = state.players.find((player) => !player.isEliminated);

  if (winner === undefined) {
    return;
  }

  finishGame(state, [winner.id], events);
}

/** 玩家打空手牌后的即时胜利。 */
export function finishGame(
  state: GameState,
  winnerPlayerIds: string[],
  events: GameEvent[]
): void {
  state.status = "finished";
  state.winnerPlayerIds = [...winnerPlayerIds];
  events.push({
    type: "game-finished",
    winnerPlayerIds: [...winnerPlayerIds]
  });
}

/** 用于判断摸牌前是否持有任意黑牌。 */
export function hasBlackCardInHand(player: GamePlayerState): boolean {
  return player.hand.some((card) => isBlackCard(card));
}
