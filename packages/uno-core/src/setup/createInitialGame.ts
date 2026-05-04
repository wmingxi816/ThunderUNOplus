/**
 * 开局初始化。
 *
 * 这个函数只负责把房间从“准备开始”推进到“第一位玩家可以行动”的状态：
 * - 生成并洗牌
 * - 每人发 7 张
 * - 翻出一张非黑牌作为起始牌
 * - 初始化 Phase 2B 所需的运行时字段
 */
import { createDeck } from "../deck";
import type {
  CreateInitialGameParams,
  GamePlayerState,
  GameState
} from "../gameState";
import { shuffleDeck } from "../shuffle";
import { isBlackCard } from "../rules/cardGuards";

const MIN_PLAYER_COUNT = 3;
const MAX_PLAYER_COUNT = 8;
const STARTING_HAND_SIZE = 7;

/** 为新房间创建第一帧可运行的 GameState。 */
export function createInitialGame(
  params: CreateInitialGameParams
): GameState {
  assertPlayerCount(params.players.length);

  const shuffledDeck = shuffleDeck(createDeck(), params.seed);
  const drawPile = [...shuffledDeck];

  // 先把房间里的玩家输入转成运行时玩家对象。
  const players = params.players.map<GamePlayerState>((player) => {
    return {
      id: player.id,
      hand: [],
      handCount: 0,
      hasCalledUno: false,
      unoPendingSinceMs: null,
      isEliminated: false,
      eliminationReason: null,
      ...(player.displayName === undefined
        ? {}
        : { displayName: player.displayName }),
      ...(player.avatarUrl === undefined ? {} : { avatarUrl: player.avatarUrl })
    };
  });

  // 按真实发牌顺序轮流发 7 张，后续如果做回放会更直观。
  for (let round = 0; round < STARTING_HAND_SIZE; round += 1) {
    for (const player of players) {
      const card = drawPile.shift();

      if (card === undefined) {
        throw new Error("Deck ran out of cards while dealing.");
      }

      player.hand.push(card);
      player.handCount = player.hand.length;
    }
  }

  const skippedOpeningBlackCards: GameState["skippedOpeningBlackCards"] = [];
  let openingCard = drawPile.shift();

  // Phase 2A/2B 都规定：黑牌不能作为第一张顶牌。
  while (openingCard !== undefined && isBlackCard(openingCard)) {
    skippedOpeningBlackCards.push(openingCard);
    openingCard = drawPile.shift();
  }

  if (openingCard === undefined || openingCard.color === undefined) {
    throw new Error("Failed to resolve a colored opening card.");
  }

  // 被跳过的黑牌放回牌堆末尾，避免无端丢牌。
  drawPile.push(...skippedOpeningBlackCards);

  const firstPlayer = players[0];

  if (firstPlayer === undefined) {
    throw new Error("Expected at least one player after validation.");
  }

  return {
    roomId: params.roomId ?? "local-room",
    snapshotVersion: params.snapshotVersion ?? 1,
    shuffleCounter: 0,
    mode: params.mode,
    status: "in-progress",
    now: params.now ?? 0,
    direction: "clockwise",
    currentColor: openingCard.color,
    currentPlayerId: firstPlayer.id,
    playerOrder: players.map((player) => player.id),
    players,
    topCard: openingCard,
    discardPile: [openingCard],
    drawPile,
    skippedOpeningBlackCards,
    drawStack: {
      active: false,
      amount: 0,
      previousDrawValue: null,
      targetPlayerId: null
    },
    drawUntilColor: {
      active: false,
      color: null,
      targetPlayerId: null
    },
    normalDrawOffer: {
      active: false,
      playerId: null,
      cardId: null
    },
    challengeWindow: {
      active: false,
      targetPlayerId: null,
      hadBlackCardBeforeDraw: false,
      expiresWhenNextPlayerCompletesAction: false
    },
    winnerPlayerIds: [],
    ...(params.seed === undefined ? {} : { seed: params.seed })
  };
}

/** 限制当前版本只支持 3 到 8 人开局。 */
function assertPlayerCount(playerCount: number): void {
  if (playerCount < MIN_PLAYER_COUNT || playerCount > MAX_PLAYER_COUNT) {
    throw new Error(
      `Player count must be between ${MIN_PLAYER_COUNT} and ${MAX_PLAYER_COUNT}.`
    );
  }
}
