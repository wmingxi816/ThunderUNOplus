import { describe, expect, it } from "vitest";
import {
  createPressureTunedWeights,
  evaluateGreedyBotWeights,
  runGreedyBotBatch
} from "../dev/botSelfPlay";
import { evaluateBotScenario } from "../dev/botScenarioLab";

describe("Greedy bot self-play", () => {
  it("finishes repeated three-bot games without rejected commands", () => {
    const report = runGreedyBotBatch({
      games: 12,
      seedBase: 4_000,
      playerCount: 3,
      maxSteps: 1_500,
      forgetUnoRate: 0.2
    });

    expect(report.rejectedGames).toBe(0);
    expect(report.stuckGames).toBe(0);
    expect(report.finishedGames).toBe(report.games);
    expect(report.averageSteps).toBeGreaterThan(0);
    expect(report.commandCounts["play-card"] ?? 0).toBeGreaterThan(0);
  }, 15_000);

  it("can compare contender weights against baseline bots with rotated seats", () => {
    const report = evaluateGreedyBotWeights({
      games: 3,
      seedBase: 7_000,
      playerCount: 3,
      maxSteps: 1_500,
      forgetUnoRate: 0.2,
      contenderWeights: createPressureTunedWeights()
    });

    expect(report.rejectedGames).toBe(0);
    expect(report.stuckGames).toBe(0);
    expect(report.finishedGames).toBe(report.seatRotatedGames);
    expect(report.seatRotatedGames).toBe(9);
    expect(report.contenderWinRate).toBeGreaterThanOrEqual(0);
    expect(report.contenderWinRate).toBeLessThanOrEqual(1);
  });

  it("scores pressure cards above ordinary number cards when the next player has one card", () => {
    const evaluation = evaluateBotScenario({
      scenario: {
        name: "test-pressure-ranking",
        currentPlayerId: "bot-1",
        direction: "clockwise",
        topCard: "red-5",
        currentColor: "red",
        hands: {
          "bot-1": ["red-9", "red-skip", "red-draw-two"],
          "bot-2": ["blue-1"],
          "bot-3": ["green-4", "yellow-4", "blue-7"]
        }
      },
      random: () => 0,
      limit: 3
    });

    expect(evaluation.topActions[0]?.command).toContain("red-draw-two");
    expect(
      evaluation.topActions.find((action) => action.command.includes("red-9"))?.rank
    ).toBeGreaterThan(1);
  });
});
