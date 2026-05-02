import { describe, expect, it } from "vitest";
import { drawCardsFromState } from "./drawCardsFromState";
import { createGameState, numberCard } from "./testUtils";

describe("drawCardsFromState", () => {
  it("drawPile 足够时会正常摸牌", () => {
    const first = numberCard("red-1", "red", 1);
    const second = numberCard("blue-2", "blue", 2);
    const state = createGameState({
      drawPile: [first, second]
    });

    const result = drawCardsFromState(state, 2);

    expect(result.cards.map((card) => card.id)).toEqual([first.id, second.id]);
    expect(result.state.drawPile).toHaveLength(0);
    expect(result.events).toEqual([]);
  });

  it("drawPile 不足时会把 discardPile 中除顶牌外的牌回洗进摸牌堆", () => {
    const topCard = numberCard("top-card", "green", 9);
    const recyclableA = numberCard("recyclable-a", "red", 1);
    const recyclableB = numberCard("recyclable-b", "blue", 2);
    const state = createGameState({
      drawPile: [],
      discardPile: [recyclableA, recyclableB, topCard],
      topCard,
      seed: "reshuffle-test"
    });

    const result = drawCardsFromState(state, 2);

    expect(result.cards.map((card) => card.id).sort()).toEqual([
      recyclableA.id,
      recyclableB.id
    ]);
    expect(result.state.discardPile.map((card) => card.id)).toEqual([topCard.id]);
    expect(result.events[0]).toMatchObject({
      type: "deck-reshuffled",
      recycledCardCount: 2
    });
  });

  it("回洗后会继续完成本次摸牌", () => {
    const first = numberCard("draw-first", "yellow", 3);
    const topCard = numberCard("top-card", "green", 9);
    const recyclableA = numberCard("recyclable-a", "red", 1);
    const recyclableB = numberCard("recyclable-b", "blue", 2);
    const state = createGameState({
      drawPile: [first],
      discardPile: [recyclableA, recyclableB, topCard],
      topCard,
      seed: "continue-draw"
    });

    const result = drawCardsFromState(state, 3);

    expect(result.cards).toHaveLength(3);
    expect(result.cards[0]?.id).toBe(first.id);
    expect(result.state.discardPile.map((card) => card.id)).toEqual([topCard.id]);
  });

  it("回洗后仍不够时，能摸多少摸多少", () => {
    const topCard = numberCard("top-card", "green", 9);
    const recyclableA = numberCard("recyclable-a", "red", 1);
    const state = createGameState({
      drawPile: [],
      discardPile: [recyclableA, topCard],
      topCard,
      seed: "partial-draw"
    });

    const result = drawCardsFromState(state, 3);

    expect(result.cards).toHaveLength(1);
    expect(result.events.at(-1)).toMatchObject({
      type: "draw-pile-exhausted",
      requestedCount: 3,
      drawnCount: 1
    });
  });

  it("完全无牌可摸时不会崩溃，并会产生 draw-pile-exhausted 事件", () => {
    const topCard = numberCard("top-card", "green", 9);
    const state = createGameState({
      drawPile: [],
      discardPile: [topCard],
      topCard
    });

    const result = drawCardsFromState(state, 2);

    expect(result.cards).toHaveLength(0);
    expect(result.events).toEqual([
      {
        type: "draw-pile-exhausted",
        requestedCount: 2,
        drawnCount: 0
      }
    ]);
  });
});
