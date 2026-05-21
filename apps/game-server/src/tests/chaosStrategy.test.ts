import { describe, expect, it } from "vitest";
import {
  createBlackCard,
  createColoredActionCard,
  createInitialGame,
  createNumberCard
} from "@thunder-uno/uno-core";
import type { Card, GameState } from "@thunder-uno/shared-types";
import { decideGreedyBotAction } from "../bot/greedyBot";
import { decideChaosBotAction } from "../bot/strategies/chaosStrategy";

describe("decideChaosBotAction", () => {
  it("prefers a wild declaration that matches the next player's unique missing color", () => {
    const state = createChaosTestState();

    setPlayerHand(state, "bot-1", [
      createBlackCard("bot-wild", "wild"),
      createNumberCard("bot-red-1", "red", 1),
      createNumberCard("bot-yellow-8", "yellow", 8),
      createColoredActionCard("bot-yellow-skip", "yellow", "skip")
    ]);
    setPlayerHand(state, "player-2", [
      createNumberCard("p2-red-1", "red", 1),
      createNumberCard("p2-blue-2", "blue", 2),
      createNumberCard("p2-green-3", "green", 3)
    ]);

    const decision = decideChaosBotAction({
      state,
      playerId: "bot-1",
      forgetUnoRate: 0.2,
      random: () => 0
    });

    expect(decision?.command).toEqual({
      type: "play-card",
      playerId: "bot-1",
      cardId: "bot-wild",
      declaredColor: "yellow"
    });
  });

  it("prefers the smallest unstoppable draw card in chaos mode", () => {
    const state = createChaosTestState();

    setPlayerHand(state, "bot-1", [
      createColoredActionCard("bot-red-plus2", "red", "draw-two"),
      createColoredActionCard("bot-red-plus4", "red", "draw-four"),
      createBlackCard("bot-reverse-plus4", "wild-reverse-draw-four"),
      createBlackCard("bot-plus6", "wild-draw-six"),
      createBlackCard("bot-plus10", "wild-draw-ten")
    ]);
    setPlayerHand(state, "player-2", [createNumberCard("p2-green-5", "green", 5)]);

    const decision = decideChaosBotAction({
      state,
      playerId: "bot-1",
      forgetUnoRate: 0.2,
      random: () => 0
    });

    expect(decision?.command).toEqual({
      type: "play-card",
      playerId: "bot-1",
      cardId: "bot-red-plus2"
    });
  });

  it("prefers swap-hands when any opponent is holding a wild-draw-ten", () => {
    const state = createChaosTestState();

    setPlayerHand(state, "bot-1", [
      createColoredActionCard("bot-red-swap", "red", "swap-hands"),
      createNumberCard("bot-red-9", "red", 9)
    ]);
    setPlayerHand(state, "player-3", [
      createBlackCard("p3-plus10", "wild-draw-ten"),
      createNumberCard("p3-green-2", "green", 2)
    ]);

    const decision = decideChaosBotAction({
      state,
      playerId: "bot-1",
      forgetUnoRate: 0.2,
      random: () => 0
    });

    expect(decision?.command).toEqual({
      type: "play-card",
      playerId: "bot-1",
      cardId: "bot-red-swap"
    });
  });

  it("prefers swap-hands when any opponent has fewer than five cards", () => {
    const state = createChaosTestState();

    setPlayerHand(state, "bot-1", [
      createColoredActionCard("bot-red-swap", "red", "swap-hands"),
      createNumberCard("bot-red-9", "red", 9)
    ]);
    setPlayerHand(state, "player-2", createMixedNumberCards("p2-short", 4));

    const decision = decideChaosBotAction({
      state,
      playerId: "bot-1",
      forgetUnoRate: 0.2,
      random: () => 0
    });

    expect(decision?.command).toEqual({
      type: "play-card",
      playerId: "bot-1",
      cardId: "bot-red-swap"
    });
  });

  it("prefers reverse when the previous active player recently failed to answer the same color", () => {
    const state = createChaosTestState();

    setPlayerHand(state, "bot-1", [
      createColoredActionCard("bot-red-reverse", "red", "reverse"),
      createNumberCard("bot-red-9", "red", 9)
    ]);

    const decision = decideChaosBotAction({
      state,
      playerId: "bot-1",
      forgetUnoRate: 0.2,
      random: () => 0,
      context: {
        lastUnanswerableColorByPlayerId: {
          "player-3": "red"
        }
      }
    });

    expect(decision?.command).toEqual({
      type: "play-card",
      playerId: "bot-1",
      cardId: "bot-red-reverse"
    });
  });

  it("prefers wild-draw-ten when the bot also holds swap-hands", () => {
    const state = createChaosTestState();

    setPlayerHand(state, "bot-1", [
      createBlackCard("bot-plus10", "wild-draw-ten"),
      createColoredActionCard("bot-blue-swap", "blue", "swap-hands"),
      createNumberCard("bot-red-9", "red", 9)
    ]);
    setPlayerHand(state, "player-2", [
      createBlackCard("p2-plus10", "wild-draw-ten"),
      createNumberCard("p2-green-2", "green", 2)
    ]);

    const decision = decideChaosBotAction({
      state,
      playerId: "bot-1",
      forgetUnoRate: 0.2,
      random: () => 0
    });

    expect(decision?.command).toEqual({
      type: "play-card",
      playerId: "bot-1",
      cardId: "bot-plus10",
      declaredColor: "red"
    });
  });

  it("prefers wild-draw-six for a large hand with very few non-black cards", () => {
    const state = createChaosTestState();

    setPlayerHand(state, "bot-1", [
      createBlackCard("bot-plus6", "wild-draw-six"),
      createBlackCard("bot-wild-a", "wild"),
      createBlackCard("bot-wild-b", "wild"),
      createBlackCard("bot-penalty", "penalty-draw"),
      createBlackCard("bot-reverse-plus4", "wild-reverse-draw-four"),
      createBlackCard("bot-plus10", "wild-draw-ten"),
      createBlackCard("bot-wild-c", "wild"),
      createBlackCard("bot-wild-d", "wild"),
      createBlackCard("bot-wild-e", "wild"),
      createNumberCard("bot-red-9", "red", 9)
    ]);
    setPlayerHand(state, "player-2", [
      createBlackCard("p2-plus10", "wild-draw-ten"),
      createNumberCard("p2-green-2", "green", 2)
    ]);

    const decision = decideChaosBotAction({
      state,
      playerId: "bot-1",
      forgetUnoRate: 0.2,
      random: () => 0
    });

    expect(decision?.command).toEqual({
      type: "play-card",
      playerId: "bot-1",
      cardId: "bot-plus6",
      declaredColor: "red"
    });
  });

  it("prefers wild-draw-ten for a large black-heavy hand when no wild-draw-six is available", () => {
    const state = createChaosTestState();

    setPlayerHand(state, "bot-1", [
      createBlackCard("bot-plus10", "wild-draw-ten"),
      createBlackCard("bot-wild-a", "wild"),
      createBlackCard("bot-wild-b", "wild"),
      createBlackCard("bot-penalty", "penalty-draw"),
      createBlackCard("bot-reverse-plus4", "wild-reverse-draw-four"),
      createBlackCard("bot-wild-c", "wild"),
      createBlackCard("bot-wild-d", "wild"),
      createBlackCard("bot-wild-e", "wild"),
      createBlackCard("bot-wild-f", "wild"),
      createNumberCard("bot-red-9", "red", 9)
    ]);
    setPlayerHand(state, "player-2", [
      createBlackCard("p2-plus10", "wild-draw-ten"),
      createNumberCard("p2-green-2", "green", 2)
    ]);

    const decision = decideChaosBotAction({
      state,
      playerId: "bot-1",
      forgetUnoRate: 0.2,
      random: () => 0
    });

    expect(decision?.command).toEqual({
      type: "play-card",
      playerId: "bot-1",
      cardId: "bot-plus10",
      declaredColor: "red"
    });
  });

  it("prefers penalty-draw when the next player has more than fifteen cards", () => {
    const state = createChaosTestState();

    setPlayerHand(state, "bot-1", [
      createBlackCard("bot-penalty", "penalty-draw"),
      createNumberCard("bot-red-9", "red", 9)
    ]);
    setPlayerHand(state, "player-2", createMixedNumberCards("p2-large", 16));

    const decision = decideChaosBotAction({
      state,
      playerId: "bot-1",
      forgetUnoRate: 0.2,
      random: () => 0
    });

    expect(decision?.command).toEqual({
      type: "play-card",
      playerId: "bot-1",
      cardId: "bot-penalty",
      declaredColor: "red"
    });
  });

  it("falls back to greedy when responding to +10 by canceling the whole draw stack", () => {
    const state = createChaosTestState();

    state.topCard = createBlackCard("top-plus10", "wild-draw-ten");
    state.currentColor = "red";
    state.discardPile = [state.topCard];
    state.drawStack = {
      active: true,
      amount: 22,
      previousDrawValue: 10,
      previousDrawKind: "wild-draw-ten",
      targetPlayerId: "bot-1"
    };

    setPlayerHand(state, "bot-1", [
      createBlackCard("bot-plus10-response", "wild-draw-ten")
    ]);

    const greedyDecision = decideGreedyBotAction({
      state,
      playerId: "bot-1",
      forgetUnoRate: 0.2,
      random: () => 0
    });
    const chaosDecision = decideChaosBotAction({
      state,
      playerId: "bot-1",
      forgetUnoRate: 0.2,
      random: () => 0
    });

    expect(chaosDecision).toEqual(greedyDecision);
  });

  it("follows greedy and resolves a manageable +10 chain instead of urgently canceling it", () => {
    const state = createChaosTestState();

    state.topCard = createBlackCard("top-plus10-manageable", "wild-draw-ten");
    state.currentColor = "red";
    state.discardPile = [state.topCard];
    state.drawStack = {
      active: true,
      amount: 10,
      previousDrawValue: 10,
      previousDrawKind: "wild-draw-ten",
      targetPlayerId: "bot-1"
    };

    setPlayerHand(state, "bot-1", [
      createBlackCard("bot-plus10-manageable", "wild-draw-ten"),
      createNumberCard("bot-red-9-manageable", "red", 9),
      createNumberCard("bot-red-8-manageable", "red", 8)
    ]);

    const greedyDecision = decideGreedyBotAction({
      state,
      playerId: "bot-1",
      forgetUnoRate: 0.2,
      random: () => 0
    });
    const chaosDecision = decideChaosBotAction({
      state,
      playerId: "bot-1",
      forgetUnoRate: 0.2,
      random: () => 0
    });

    expect(greedyDecision?.command).toEqual({
      type: "resolve-draw-stack",
      playerId: "bot-1"
    });
    expect(chaosDecision).toEqual(greedyDecision);
  });

  it("falls back to the greedy strategy when no chaos rule applies", () => {
    const state = createChaosTestState();

    setPlayerHand(state, "bot-1", [
      createNumberCard("bot-red-2", "red", 2),
      createNumberCard("bot-red-9", "red", 9),
      createNumberCard("bot-red-1", "red", 1),
      createNumberCard("bot-red-3", "red", 3),
      createNumberCard("bot-red-4", "red", 4),
      createNumberCard("bot-red-5", "red", 5),
      createNumberCard("bot-red-1-b", "red", 1)
    ]);

    const greedyDecision = decideGreedyBotAction({
      state,
      playerId: "bot-1",
      forgetUnoRate: 0.2,
      random: () => 0
    });
    const chaosDecision = decideChaosBotAction({
      state,
      playerId: "bot-1",
      forgetUnoRate: 0.2,
      random: () => 0
    });

    expect(chaosDecision?.command).toEqual(greedyDecision?.command);
  });
});

function createChaosTestState(): GameState {
  const state = createInitialGame({
    players: [
      { id: "bot-1", isBot: true },
      { id: "player-2" },
      { id: "player-3" }
    ],
    mode: "no-challenge",
    seed: "chaos-bot-test"
  });

  state.initialDirectionChoice = {
    active: false,
    chooserPlayerId: null
  };
  state.direction = "clockwise";
  state.topCard = createNumberCard("top-red-5", "red", 5);
  state.currentColor = "red";
  state.discardPile = [state.topCard];
  state.currentPlayerId = "bot-1";
  setPlayerHand(state, "bot-1", [
    createNumberCard("default-bot-red-1", "red", 1),
    createNumberCard("default-bot-blue-2", "blue", 2)
  ]);
  setPlayerHand(state, "player-2", createMixedNumberCards("default-p2", 5));
  setPlayerHand(state, "player-3", createMixedNumberCards("default-p3", 5));

  return state;
}

function setPlayerHand(state: GameState, playerId: string, hand: Card[]): void {
  const player = state.players.find((candidate) => candidate.id === playerId);

  if (player === undefined) {
    throw new Error(`Player ${playerId} was not found.`);
  }

  player.hand = hand;
  player.handCount = hand.length;
}

function createMixedNumberCards(prefix: string, count: number): Card[] {
  const colors = ["red", "yellow", "blue", "green"] as const;

  return Array.from({ length: count }, (_, index) => {
    return createNumberCard(
      `${prefix}-${String(index)}`,
      colors[index % colors.length],
      (index % 10) as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9
    );
  });
}
