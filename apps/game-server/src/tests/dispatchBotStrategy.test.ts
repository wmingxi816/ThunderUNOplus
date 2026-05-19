import { describe, expect, it } from "vitest";
import {
  createBlackCard,
  createColoredActionCard,
  createInitialGame,
  createNumberCard
} from "@thunder-uno/uno-core";
import type { Card, GameState } from "@thunder-uno/shared-types";
import { decideGreedyBotAction } from "../bot/greedyBot";
import { dispatchBotStrategy } from "../bot/strategies/dispatchBotStrategy";
import { decideChaosBotAction } from "../bot/strategies/chaosStrategy";

describe("dispatchBotStrategy", () => {
  it("uses greedy-v1 decisions unchanged", () => {
    const state = createStrategyTestState();
    setPlayerHand(state, "bot-1", [createNumberCard("bot-blue-1", "blue", 1)]);
    state.drawPile = [createNumberCard("draw-green-3", "green", 3)];

    const greedyDecision = decideGreedyBotAction({
      state,
      playerId: "bot-1",
      forgetUnoRate: 0.2,
      random: () => 0
    });
    const dispatchedDecision = dispatchBotStrategy({
      strategy: "greedy-v1",
      state,
      playerId: "bot-1",
      forgetUnoRate: 0.2,
      random: () => 0
    });

    expect(dispatchedDecision).toEqual(greedyDecision);
  });

  it("uses chaos-v1 decisions unchanged", () => {
    const state = createStrategyTestState();
    setPlayerHand(state, "bot-1", [
      createColoredActionCard("bot-red-reverse", "red", "reverse"),
      createNumberCard("bot-red-9", "red", 9)
    ]);

    const chaosContext = {
      lastUnanswerableColorByPlayerId: {
        "player-3": "red"
      }
    } as const;
    const chaosDecision = decideChaosBotAction({
      state,
      playerId: "bot-1",
      forgetUnoRate: 0.2,
      random: () => 0,
      context: chaosContext
    });
    const dispatchedDecision = dispatchBotStrategy({
      strategy: "chaos-v1",
      state,
      playerId: "bot-1",
      forgetUnoRate: 0.2,
      random: () => 0,
      context: chaosContext
    });

    expect(dispatchedDecision).toEqual(chaosDecision);
    expect(dispatchedDecision?.command).toEqual({
      type: "play-card",
      playerId: "bot-1",
      cardId: "bot-red-reverse"
    });
  });
});

function createStrategyTestState(): GameState {
  const state = createInitialGame({
    players: [
      { id: "bot-1", isBot: true },
      { id: "player-2" },
      { id: "player-3" }
    ],
    mode: "no-challenge",
    seed: "dispatch-bot-strategy"
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
    createBlackCard("placeholder-wild", "wild"),
    createNumberCard("placeholder-red-1", "red", 1)
  ]);
  setPlayerHand(state, "player-2", createNumberCards("player-2", 5, "blue"));
  setPlayerHand(state, "player-3", createNumberCards("player-3", 5, "green"));

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

function createNumberCards(prefix: string, count: number, color: "blue" | "green"): Card[] {
  return Array.from({ length: count }, (_, index) => {
    return createNumberCard(
      `${prefix}-${String(index)}`,
      color,
      (index % 10) as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9
    );
  });
}
