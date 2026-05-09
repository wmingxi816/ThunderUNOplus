import { describe, expect, it } from "vitest";
import { createInitialGame, createNumberCard } from "@thunder-uno/uno-core";
import type { GameState } from "@thunder-uno/shared-types";
import { decideGreedyBotAction } from "../bot/greedyBot";
import { scoreBotCandidates } from "../bot/botScoring";
import type { BotCandidateAction } from "../bot/botCandidates";

describe("Greedy bot decision", () => {
  it("falls back to drawing when the bot has no playable card", () => {
    const state = createBotTestState();
    const botPlayer = state.players.find((player) => player.id === "bot-1")!;

    state.topCard = createNumberCard("top-red-5", "red", 5);
    state.currentColor = "red";
    state.discardPile = [state.topCard];
    state.currentPlayerId = "bot-1";
    botPlayer.hand = [createNumberCard("bot-blue-1", "blue", 1)];
    botPlayer.handCount = botPlayer.hand.length;
    state.drawPile = [createNumberCard("draw-green-3", "green", 3)];

    const decision = decideGreedyBotAction({
      state,
      playerId: "bot-1",
      forgetUnoRate: 0.2,
      random: () => 0
    });

    expect(decision?.command).toEqual({
      type: "draw-card",
      playerId: "bot-1"
    });
  });

  it("prefers an isolated number card farthest from the hand average", () => {
    const state = createBotTestState();
    const botPlayer = state.players.find((player) => player.id === "bot-1")!;
    const redOneA = createNumberCard("bot-red-1-a", "red", 1);
    const redOneB = createNumberCard("bot-red-1-b", "red", 1);
    const redTwo = createNumberCard("bot-red-2", "red", 2);
    const redThree = createNumberCard("bot-red-3", "red", 3);
    const redFour = createNumberCard("bot-red-4", "red", 4);
    const redFive = createNumberCard("bot-red-5", "red", 5);
    const redNine = createNumberCard("bot-red-9", "red", 9);

    state.topCard = createNumberCard("top-red-7", "red", 7);
    state.currentColor = "red";
    state.discardPile = [state.topCard];
    state.currentPlayerId = "bot-1";
    botPlayer.hand = [
      redOneA,
      redOneB,
      redTwo,
      redThree,
      redFour,
      redFive,
      redNine
    ];
    botPlayer.handCount = botPlayer.hand.length;

    const candidates: BotCandidateAction[] = [redOneA, redThree, redNine].map(
      (card) => {
        return {
          command: {
            type: "play-card",
            playerId: "bot-1",
            cardId: card.id
          },
          cardIds: [card.id],
          reasons: ["single-card"]
        };
      }
    );

    const [bestAction] = scoreBotCandidates(
      state,
      "bot-1",
      candidates,
      () => 0
    );

    expect(bestAction?.command).toEqual({
      type: "play-card",
      playerId: "bot-1",
      cardId: redNine.id
    });
  });
});

function createBotTestState(): GameState {
  return createInitialGame({
    players: [
      { id: "bot-1", isBot: true },
      { id: "player-2" },
      { id: "player-3" }
    ],
    mode: "no-challenge",
    seed: "greedy-bot-test"
  });
}
