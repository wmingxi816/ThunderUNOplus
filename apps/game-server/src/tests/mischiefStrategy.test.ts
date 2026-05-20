import { describe, expect, it } from "vitest";
import {
  createBlackCard,
  createColoredActionCard,
  createInitialGame,
  createNumberCard
} from "@thunder-uno/uno-core";
import type { Card, GameState, InitialGamePlayerInput } from "@thunder-uno/shared-types";
import { decideGreedyBotAction } from "../bot/greedyBot";
import { decideMischiefBotAction } from "../bot/strategies/mischiefStrategy";

describe("decideMischiefBotAction", () => {
  it("prefers the current bot's highest draw card when a robot chain can ultimately dump pressure onto a human", () => {
    const state = createMischiefTestState([
      { id: "bot-1", isBot: true },
      { id: "bot-2", isBot: true },
      { id: "player-3" }
    ]);

    setPlayerHand(state, "bot-1", [
      createColoredActionCard("bot-red-plus2", "red", "draw-two"),
      createColoredActionCard("bot-red-plus4", "red", "draw-four")
    ]);
    setPlayerHand(state, "bot-2", [
      createColoredActionCard("bot-blue-plus4", "blue", "draw-four")
    ]);
    setPlayerHand(state, "player-3", [
      createNumberCard("p3-green-7", "green", 7)
    ]);

    const decision = decideMischiefBotAction({
      state,
      playerId: "bot-1",
      forgetUnoRate: 0.2,
      random: () => 0
    });

    expect(decision?.command).toEqual({
      type: "play-card",
      playerId: "bot-1",
      cardId: "bot-red-plus4"
    });
  });

  it("simulates wild-reverse-draw-four chains from the previous robot toward a human", () => {
    const state = createMischiefTestState([
      { id: "bot-1", isBot: true },
      { id: "player-2" },
      { id: "bot-3", isBot: true }
    ]);

    setPlayerHand(state, "bot-1", [
      createBlackCard("bot-reverse-plus4", "wild-reverse-draw-four"),
      createNumberCard("bot-red-9", "red", 9)
    ]);
    setPlayerHand(state, "bot-3", [
      createBlackCard("bot-3-plus6", "wild-draw-six")
    ]);
    setPlayerHand(state, "player-2", [
      createNumberCard("p2-green-4", "green", 4)
    ]);

    const decision = decideMischiefBotAction({
      state,
      playerId: "bot-1",
      forgetUnoRate: 0.2,
      random: () => 0
    });

    expect(decision?.command).toEqual({
      type: "play-card",
      playerId: "bot-1",
      cardId: "bot-reverse-plus4",
      declaredColor: "red"
    });
  });

  it("prefers skip when the skipped target is human", () => {
    const state = createMischiefTestState([
      { id: "bot-1", isBot: true },
      { id: "player-2" },
      { id: "bot-3", isBot: true }
    ]);

    setPlayerHand(state, "bot-1", [
      createColoredActionCard("bot-red-skip", "red", "skip"),
      createNumberCard("bot-red-9", "red", 9)
    ]);

    const decision = decideMischiefBotAction({
      state,
      playerId: "bot-1",
      forgetUnoRate: 0.2,
      random: () => 0
    });

    expect(decision?.command).toEqual({
      type: "play-card",
      playerId: "bot-1",
      cardId: "bot-red-skip"
    });
  });

  it("prefers reverse when the previous human recently failed to answer the same color", () => {
    const state = createMischiefTestState([
      { id: "bot-1", isBot: true },
      { id: "bot-2", isBot: true },
      { id: "player-3" }
    ]);

    setPlayerHand(state, "bot-1", [
      createColoredActionCard("bot-red-reverse", "red", "reverse"),
      createNumberCard("bot-red-9", "red", 9)
    ]);

    const decision = decideMischiefBotAction({
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

  it("prefers swap-hands when a human currently holds wild-draw-six or wild-draw-ten", () => {
    const state = createMischiefTestState([
      { id: "bot-1", isBot: true },
      { id: "player-2" },
      { id: "player-3" }
    ]);

    setPlayerHand(state, "bot-1", [
      createColoredActionCard("bot-red-swap", "red", "swap-hands"),
      createNumberCard("bot-red-9", "red", 9)
    ]);
    setPlayerHand(state, "player-2", [
      createBlackCard("p2-plus6", "wild-draw-six"),
      createNumberCard("p2-green-2", "green", 2)
    ]);

    const decision = decideMischiefBotAction({
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

  it("does not treat penalty-draw as a swap-hands big card trigger", () => {
    const state = createMischiefTestState([
      { id: "bot-1", isBot: true },
      { id: "player-2" },
      { id: "player-3" }
    ]);

    setPlayerHand(state, "bot-1", [
      createColoredActionCard("bot-red-swap", "red", "swap-hands"),
      createNumberCard("bot-red-9", "red", 9)
    ]);
    setPlayerHand(state, "player-2", [
      createBlackCard("p2-penalty", "penalty-draw"),
      createNumberCard("p2-green-2", "green", 2)
    ]);

    const greedyDecision = decideGreedyBotAction({
      state,
      playerId: "bot-1",
      forgetUnoRate: 0.2,
      random: () => 0
    });
    const mischiefDecision = decideMischiefBotAction({
      state,
      playerId: "bot-1",
      forgetUnoRate: 0.2,
      random: () => 0
    });

    expect(mischiefDecision?.command).toEqual(greedyDecision?.command);
  });

  it("prefers penalty-draw and declares a color the human target is missing", () => {
    const state = createMischiefTestState([
      { id: "bot-1", isBot: true },
      { id: "player-2" },
      { id: "player-3" }
    ]);

    setPlayerHand(state, "bot-1", [
      createBlackCard("bot-penalty", "penalty-draw"),
      createNumberCard("bot-red-9", "red", 9)
    ]);
    setPlayerHand(state, "player-2", [
      createNumberCard("p2-red-1", "red", 1),
      createNumberCard("p2-blue-2", "blue", 2),
      createNumberCard("p2-green-3", "green", 3)
    ]);

    const decision = decideMischiefBotAction({
      state,
      playerId: "bot-1",
      forgetUnoRate: 0.2,
      random: () => 0
    });

    expect(decision?.command).toEqual({
      type: "play-card",
      playerId: "bot-1",
      cardId: "bot-penalty",
      declaredColor: "yellow"
    });
  });

  it("uses soft color targeting against a human's unique missing color when no harder sabotage applies", () => {
    const state = createMischiefTestState([
      { id: "bot-1", isBot: true },
      { id: "player-2" },
      { id: "player-3" }
    ]);

    state.topCard = createNumberCard("top-blue-5", "blue", 5);
    state.currentColor = "blue";
    state.discardPile = [state.topCard];

    setPlayerHand(state, "bot-1", [
      createBlackCard("bot-wild", "wild"),
      createNumberCard("bot-red-9", "red", 9)
    ]);
    setPlayerHand(state, "player-2", [
      createNumberCard("p2-red-1", "red", 1),
      createNumberCard("p2-blue-2", "blue", 2),
      createNumberCard("p2-yellow-3", "yellow", 3)
    ]);

    const decision = decideMischiefBotAction({
      state,
      playerId: "bot-1",
      forgetUnoRate: 0.2,
      random: () => 0
    });

    expect(decision?.command).toEqual({
      type: "play-card",
      playerId: "bot-1",
      cardId: "bot-wild",
      declaredColor: "green"
    });
  });

  it("falls back to greedy when +10 is only canceling an existing +10 chain", () => {
    const state = createMischiefTestState([
      { id: "bot-1", isBot: true },
      { id: "bot-2", isBot: true },
      { id: "bot-3", isBot: true }
    ]);

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
    const mischiefDecision = decideMischiefBotAction({
      state,
      playerId: "bot-1",
      forgetUnoRate: 0.2,
      random: () => 0
    });

    expect(mischiefDecision).toEqual(greedyDecision);
  });

  it("falls back to greedy when only a robot-targeted chaos opportunity exists", () => {
    const state = createMischiefTestState([
      { id: "bot-1", isBot: true },
      { id: "player-2" },
      { id: "bot-3", isBot: true }
    ]);

    setPlayerHand(state, "bot-1", [
      createColoredActionCard("bot-red-reverse", "red", "reverse"),
      createNumberCard("bot-red-9", "red", 9)
    ]);

    const greedyDecision = decideGreedyBotAction({
      state,
      playerId: "bot-1",
      forgetUnoRate: 0.2,
      random: () => 0
    });
    const mischiefDecision = decideMischiefBotAction({
      state,
      playerId: "bot-1",
      forgetUnoRate: 0.2,
      random: () => 0,
      context: {
        lastUnanswerableColorByPlayerId: {
          "bot-3": "red"
        }
      }
    });

    expect(mischiefDecision?.command).toEqual(greedyDecision?.command);
  });
});

function createMischiefTestState(players: InitialGamePlayerInput[]): GameState {
  const state = createInitialGame({
    players,
    mode: "no-challenge",
    seed: "mischief-bot-test"
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

  for (const player of state.players) {
    if (player.id === "bot-1") {
      continue;
    }

    setPlayerHand(state, player.id, createMixedNumberCards(`${player.id}-default`, 5));
  }

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
