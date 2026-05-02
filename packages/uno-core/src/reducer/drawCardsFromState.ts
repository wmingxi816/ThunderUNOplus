import type { Card } from "../card";
import type { GameState } from "../gameState";
import { shuffleDeck } from "../shuffle";
import { cloneGameState } from "./effects";
import type { GameEvent } from "./types";

export interface DrawCardsFromStateResult {
  state: GameState;
  cards: Card[];
  events: GameEvent[];
}

/**
 * 统一摸牌函数。
 *
 * 所有 reducer 内的摸牌行为都必须走这里，保证：
 * - 牌堆耗尽时统一回洗
 * - 回洗结果可预测
 * - 无牌可摸时不会抛异常
 */
export function drawCardsFromState(
  state: GameState,
  count: number
): DrawCardsFromStateResult {
  const nextState = cloneGameState(state);
  const cards: Card[] = [];
  const events: GameEvent[] = [];

  while (cards.length < count) {
    if (nextState.drawPile.length === 0) {
      const reshuffled = reshuffleDiscardIntoDrawPile(nextState, events);

      if (!reshuffled) {
        events.push({
          type: "draw-pile-exhausted",
          requestedCount: count,
          drawnCount: cards.length
        });
        break;
      }
    }

    const card = nextState.drawPile.shift();

    if (card === undefined) {
      events.push({
        type: "draw-pile-exhausted",
        requestedCount: count,
        drawnCount: cards.length
      });
      break;
    }

    cards.push(card);
  }

  return {
    state: nextState,
    cards,
    events
  };
}

function reshuffleDiscardIntoDrawPile(
  state: GameState,
  events: GameEvent[]
): boolean {
  const topCard = state.discardPile[state.discardPile.length - 1];
  const recyclableCards = state.discardPile.slice(0, -1);

  if (topCard === undefined || recyclableCards.length === 0) {
    return false;
  }

  state.shuffleCounter += 1;
  const reshuffleSeed =
    state.seed === undefined
      ? state.shuffleCounter
      : `${String(state.seed)}:reshuffle:${state.shuffleCounter}`;
  const reshuffledCards = shuffleDeck(recyclableCards, reshuffleSeed);

  state.drawPile = reshuffledCards;
  state.discardPile = [topCard];
  events.push({
    type: "deck-reshuffled",
    recycledCardCount: recyclableCards.length,
    newDrawPileCount: reshuffledCards.length,
    shuffleCounter: state.shuffleCounter
  });

  return reshuffledCards.length > 0;
}
