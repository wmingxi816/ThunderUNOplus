import {
  createBlackCard,
  createColoredActionCard,
  createNumberCard,
  type BlackCardKind,
  type Card,
  type CardColor,
  type CardNumber,
  type ColoredActionCardKind
} from "../card";
import type {
  ChallengeWindowState,
  DrawStackState,
  DrawUntilColorState,
  GameMode,
  GamePlayerState,
  GameState,
  TurnDirection
} from "../gameState";

/** 测试里统一用轻量造牌工具，避免每个用例重复写长对象。 */
export function numberCard(
  id: string,
  color: CardColor,
  number: CardNumber
): Card {
  return createNumberCard(id, color, number);
}

export function coloredCard(
  id: string,
  color: CardColor,
  kind: ColoredActionCardKind
): Card {
  return createColoredActionCard(id, color, kind);
}

export function blackCard(id: string, kind: BlackCardKind): Card {
  return createBlackCard(id, kind);
}

export function createPlayerState(
  id: string,
  hand: Card[],
  overrides: Partial<GamePlayerState> = {}
): GamePlayerState {
  return {
    id,
    hand: [...hand],
    handCount: hand.length,
    hasCalledUno: false,
    unoPendingSinceMs: null,
    isEliminated: false,
    eliminationReason: null,
    ...overrides
  };
}

interface CreateGameStateParams {
  roomId?: string;
  snapshotVersion?: number;
  shuffleCounter?: number;
  seed?: string | number;
  players?: GamePlayerState[];
  playerOrder?: string[];
  currentPlayerId?: string;
  currentColor?: CardColor;
  topCard?: Card;
  discardPile?: Card[];
  drawPile?: Card[];
  mode?: GameMode;
  direction?: TurnDirection;
  now?: number;
  drawStack?: DrawStackState;
  drawUntilColor?: DrawUntilColorState;
  challengeWindow?: ChallengeWindowState;
  status?: GameState["status"];
  winnerPlayerIds?: string[];
}

/** 构造一份最小可运行 GameState，供 reducer 测试复用。 */
export function createGameState(
  params: CreateGameStateParams = {}
): GameState {
  const topCard = params.topCard ?? numberCard("top-red-5", "red", 5);
  const players =
    params.players ??
    [
      createPlayerState("p1", []),
      createPlayerState("p2", []),
      createPlayerState("p3", [])
    ];

  return {
    roomId: params.roomId ?? "test-room",
    snapshotVersion: params.snapshotVersion ?? 1,
    shuffleCounter: params.shuffleCounter ?? 0,
    mode: params.mode ?? "with-challenge",
    status: params.status ?? "in-progress",
    now: params.now ?? 0,
    direction: params.direction ?? "clockwise",
    currentColor: params.currentColor ?? topCard.color ?? "red",
    currentPlayerId: params.currentPlayerId ?? players[0]!.id,
    playerOrder: params.playerOrder ?? players.map((player) => player.id),
    players,
    topCard,
    discardPile: params.discardPile ?? [topCard],
    drawPile: params.drawPile ?? [],
    skippedOpeningBlackCards: [],
    drawStack: params.drawStack ?? {
      active: false,
      amount: 0,
      previousDrawValue: null,
      targetPlayerId: null
    },
    drawUntilColor: params.drawUntilColor ?? {
      active: false,
      color: null,
      targetPlayerId: null
    },
    challengeWindow: params.challengeWindow ?? {
      active: false,
      targetPlayerId: null,
      hadBlackCardBeforeDraw: false,
      expiresWhenNextPlayerCompletesAction: false
    },
    winnerPlayerIds: params.winnerPlayerIds ?? [],
    ...(params.seed === undefined ? {} : { seed: params.seed })
  };
}

export function getPlayer(state: GameState, playerId: string): GamePlayerState {
  const player = state.players.find((candidate) => candidate.id === playerId);

  if (player === undefined) {
    throw new Error(`Player ${playerId} was not found in test state.`);
  }

  return player;
}
