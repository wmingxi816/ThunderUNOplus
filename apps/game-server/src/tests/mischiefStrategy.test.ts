import { describe, expect, it } from "vitest";
import {
  createBlackCard,
  createColoredActionCard,
  createInitialGame,
  createNumberCard
} from "@thunder-uno/uno-core";
import type { Card, GameState, InitialGamePlayerInput } from "@thunder-uno/shared-types";
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

  it("avoids swap-hands when it would hand a +10 to a human", () => {
    const state = createMischiefTestState([
      { id: "bot-1", isBot: true },
      { id: "bot-2", isBot: true },
      { id: "player-3" }
    ]);

    state.direction = "counter-clockwise";
    setPlayerHand(state, "bot-1", [
      createColoredActionCard("bot-red-swap-avoid-ten", "red", "swap-hands"),
      createNumberCard("bot-red-9-avoid-ten", "red", 9)
    ]);
    setPlayerHand(state, "bot-2", [
      createBlackCard("bot2-plus10", "wild-draw-ten"),
      createNumberCard("bot2-green-1", "green", 1)
    ]);
    setPlayerHand(state, "player-3", [
      createNumberCard("p3-yellow-2", "yellow", 2),
      createNumberCard("p3-yellow-3", "yellow", 3)
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
      cardId: "bot-red-9-avoid-ten"
    });
  });

  it("avoids swap-hands when it would hand a +6 to a human", () => {
    const state = createMischiefTestState([
      { id: "bot-1", isBot: true },
      { id: "bot-2", isBot: true },
      { id: "player-3" }
    ]);

    state.direction = "counter-clockwise";
    setPlayerHand(state, "bot-1", [
      createColoredActionCard("bot-red-swap-avoid-six", "red", "swap-hands"),
      createNumberCard("bot-red-9-avoid-six", "red", 9)
    ]);
    setPlayerHand(state, "bot-2", [
      createBlackCard("bot2-plus6", "wild-draw-six"),
      createNumberCard("bot2-green-1b", "green", 1)
    ]);
    setPlayerHand(state, "player-3", [
      createNumberCard("p3-yellow-4", "yellow", 4),
      createNumberCard("p3-yellow-5", "yellow", 5)
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
      cardId: "bot-red-9-avoid-six"
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

    const mischiefDecision = decideMischiefBotAction({
      state,
      playerId: "bot-1",
      forgetUnoRate: 0.2,
      random: () => 0
    });

    expect(mischiefDecision?.command).toEqual({
      type: "play-card",
      playerId: "bot-1",
      cardId: "bot-red-9"
    });
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

  it("uses +10 to cancel a lethal +10 chain instead of eating the full draw stack", () => {
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

    const mischiefDecision = decideMischiefBotAction({
      state,
      playerId: "bot-1",
      forgetUnoRate: 0.2,
      random: () => 0
    });

    expect(mischiefDecision?.command).toEqual({
      type: "play-card",
      playerId: "bot-1",
      cardId: "bot-plus10-response",
      declaredColor: "red"
    });
  });

  it("does not rush to self-rescue with +10 when hand plus draw stack stays within 20 cards", () => {
    const state = createMischiefTestState([
      { id: "bot-1", isBot: true },
      { id: "bot-2", isBot: true },
      { id: "player-3" }
    ]);

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

    const decision = decideMischiefBotAction({
      state,
      playerId: "bot-1",
      forgetUnoRate: 0.2,
      random: () => 0
    });

    expect(decision?.command).toEqual({
      type: "resolve-draw-stack",
      playerId: "bot-1"
    });
  });

  it("does not overvalue a robot-targeted reverse when a neutral number card is available", () => {
    const state = createMischiefTestState([
      { id: "bot-1", isBot: true },
      { id: "player-2" },
      { id: "bot-3", isBot: true }
    ]);

    setPlayerHand(state, "bot-1", [
      createColoredActionCard("bot-red-reverse", "red", "reverse"),
      createNumberCard("bot-red-9", "red", 9)
    ]);

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

    expect(mischiefDecision?.command).toEqual({
      type: "play-card",
      playerId: "bot-1",
      cardId: "bot-red-9"
    });
  });

  it("prefers a direct win over continuing to pressure a human", () => {
    const state = createMischiefTestState([
      { id: "bot-1", isBot: true },
      { id: "player-2" },
      { id: "bot-3", isBot: true }
    ]);

    setPlayerHand(state, "bot-1", [
      createColoredActionCard("bot-red-discard", "red", "discard-same-color"),
      createNumberCard("bot-red-5", "red", 5),
      createColoredActionCard("bot-red-skip", "red", "skip")
    ]);
    setPlayerHand(state, "player-2", [
      createNumberCard("p2-green-1", "green", 1)
    ]);

    const decision = decideMischiefBotAction({
      state,
      playerId: "bot-1",
      forgetUnoRate: 0.2,
      random: () => 0
    });

    expect(decision?.command).toEqual({
      type: "play-discard-same-color",
      playerId: "bot-1",
      mainCardId: "bot-red-discard",
      attachedCardIds: ["bot-red-5", "bot-red-skip"]
    });
  });

  it("keeps a huge punish card when it would only hit a robot and no human relay exists", () => {
    const state = createMischiefTestState([
      { id: "bot-1", isBot: true },
      { id: "bot-2", isBot: true },
      { id: "player-3" }
    ]);

    setPlayerHand(state, "bot-1", [
      createBlackCard("bot-plus10", "wild-draw-ten"),
      createNumberCard("bot-red-9", "red", 9)
    ]);
    setPlayerHand(state, "bot-2", [
      createNumberCard("bot2-green-1", "green", 1)
    ]);
    setPlayerHand(state, "player-3", [
      createNumberCard("p3-yellow-2", "yellow", 2)
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
      cardId: "bot-red-9"
    });
  });

  it("pushes ordinary +2 ahead when the immediate next player is human", () => {
    const state = createMischiefTestState([
      { id: "bot-1", isBot: true },
      { id: "player-2" },
      { id: "bot-3", isBot: true }
    ]);

    setPlayerHand(state, "bot-1", [
      createColoredActionCard("bot-red-plus2-pressure", "red", "draw-two"),
      createNumberCard("bot-red-9-pressure", "red", 9)
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
      cardId: "bot-red-plus2-pressure"
    });
  });

  it("does not let the upstream +2 bonus override a robot trap", () => {
    const state = createMischiefTestState([
      { id: "bot-1", isBot: true },
      { id: "player-2" },
      { id: "bot-3", isBot: true }
    ]);

    setPlayerHand(state, "bot-1", [
      createColoredActionCard("bot-red-plus2-trap", "red", "draw-two"),
      createNumberCard("bot-red-9-trap", "red", 9)
    ]);
    setPlayerHand(state, "player-2", [
      createColoredActionCard("p2-plus2-response", "blue", "draw-two"),
      createNumberCard("p2-green-2-trap", "green", 2)
    ]);
    setPlayerHand(state, "bot-3", [
      createNumberCard("bot3-yellow-1-trap", "yellow", 1)
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
      cardId: "bot-red-9-trap"
    });
  });

  it("scores swap-hands much higher when a human holds +10 than when they only hold +6", () => {
    const plusTenState = createMischiefTestState([
      { id: "bot-1", isBot: true },
      { id: "player-2" },
      { id: "player-3" }
    ]);
    setPlayerHand(plusTenState, "bot-1", [
      createColoredActionCard("bot-red-swap", "red", "swap-hands"),
      createNumberCard("bot-red-9", "red", 9)
    ]);
    setPlayerHand(plusTenState, "player-2", [
      createBlackCard("p2-plus10", "wild-draw-ten"),
      createNumberCard("p2-green-2", "green", 2)
    ]);

    const plusSixState = createMischiefTestState([
      { id: "bot-1", isBot: true },
      { id: "player-2" },
      { id: "player-3" }
    ]);
    setPlayerHand(plusSixState, "bot-1", [
      createColoredActionCard("bot-red-swap", "red", "swap-hands"),
      createNumberCard("bot-red-9", "red", 9)
    ]);
    setPlayerHand(plusSixState, "player-2", [
      createBlackCard("p2-plus6", "wild-draw-six"),
      createNumberCard("p2-green-2", "green", 2)
    ]);

    const plusTenDecision = decideMischiefBotAction({
      state: plusTenState,
      playerId: "bot-1",
      forgetUnoRate: 0.2,
      random: () => 0
    });
    const plusSixDecision = decideMischiefBotAction({
      state: plusSixState,
      playerId: "bot-1",
      forgetUnoRate: 0.2,
      random: () => 0
    });

    expect(plusTenDecision?.command).toEqual({
      type: "play-card",
      playerId: "bot-1",
      cardId: "bot-red-swap"
    });
    expect(plusSixDecision?.command).toEqual({
      type: "play-card",
      playerId: "bot-1",
      cardId: "bot-red-swap"
    });
    expect((plusTenDecision?.score ?? 0)).toBeGreaterThan(plusSixDecision?.score ?? 0);
  });

  it("only gives a small swap-hands bump for ordinary human skill cards", () => {
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
      createColoredActionCard("p2-skip", "green", "skip"),
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
      cardId: "bot-red-9"
    });
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
