import { describe, expect, it } from "vitest";
import {
  createInitialGame,
  type GameState
} from "@thunder-uno/uno-core";
import { batchSimulate } from "../src/batchSimulate";
import { chooseCommand } from "../src/bot/chooseCommand";
import { simulateGame } from "../src/simulateGame";

function createStateWithOverrides(overrides: Partial<GameState>): GameState {
  const baseState = createInitialGame({
    roomId: "test-room",
    players: [
      { id: "p1", displayName: "Bot 1", avatarUrl: null },
      { id: "p2", displayName: "Bot 2", avatarUrl: null },
      { id: "p3", displayName: "Bot 3", avatarUrl: null }
    ],
    mode: "no-challenge",
    seed: 1001,
    now: 0,
    snapshotVersion: 1
  });

  return {
    ...baseState,
    initialDirectionChoice: {
      active: false,
      chooserPlayerId: null
    },
    ...overrides
  };
}

describe("simulateGame", () => {
  it("可以创建 3 人 no-challenge 对局", () => {
    const result = simulateGame({
      playerCount: 3,
      mode: "no-challenge",
      seed: 1001,
      maxSteps: 100,
      verbose: false,
      verboseDebug: false,
      autoUno: true,
      challengeRate: 0.3
    });

    expect(result.playerCount).toBe(3);
    expect(result.finalState.players).toHaveLength(3);
    expect(["finished", "stuck"]).toContain(result.status);
  });

  it("可以创建 8 人 with-challenge 对局", () => {
    const result = simulateGame({
      playerCount: 8,
      mode: "with-challenge",
      seed: 2002,
      maxSteps: 150,
      verbose: false,
      verboseDebug: false,
      autoUno: true,
      challengeRate: 0.3
    });

    expect(result.playerCount).toBe(8);
    expect(result.finalState.players).toHaveLength(8);
    expect(["finished", "stuck"]).toContain(result.status);
  });

  it("单局模拟能在 maxSteps 内结束或给出 stuck 结果", () => {
    const result = simulateGame({
      playerCount: 4,
      mode: "no-challenge",
      seed: 3003,
      maxSteps: 80,
      verbose: false,
      verboseDebug: false,
      autoUno: true,
      challengeRate: 0.3
    });

    expect(["finished", "stuck"]).toContain(result.status);
    expect(result.steps).toBeLessThanOrEqual(80);
  });

  it("相同 seed 的模拟结果可复现", () => {
    const first = simulateGame({
      playerCount: 4,
      mode: "no-challenge",
      seed: 4004,
      maxSteps: 150,
      verbose: false,
      verboseDebug: false,
      autoUno: true,
      challengeRate: 0.3
    });
    const second = simulateGame({
      playerCount: 4,
      mode: "no-challenge",
      seed: 4004,
      maxSteps: 150,
      verbose: false,
      verboseDebug: false,
      autoUno: true,
      challengeRate: 0.3
    });

    expect({
      status: first.status,
      steps: first.steps,
      winners: first.winnerPlayerIds,
      reshuffles: first.reshuffleCount,
      rejected: first.rejectedCommandCount
    }).toEqual({
      status: second.status,
      steps: second.steps,
      winners: second.winnerPlayerIds,
      reshuffles: second.reshuffleCount,
      rejected: second.rejectedCommandCount
    });
  });

  it("黑色牌 declaredColor 会被正确补充", () => {
    const state = createStateWithOverrides({
      currentPlayerId: "p1",
      currentColor: "red",
      players: [
        {
          id: "p1",
          displayName: "Bot 1",
          avatarUrl: null,
          hand: [
            {
              id: "wild-1",
              kind: "wild",
              isBlack: true,
              displayName: "变色"
            },
            {
              id: "blue-1",
              kind: "number",
              color: "blue",
              number: 1,
              isBlack: false,
              displayName: "蓝1"
            },
            {
              id: "blue-2",
              kind: "number",
              color: "blue",
              number: 2,
              isBlack: false,
              displayName: "蓝2"
            }
          ],
          handCount: 3,
          hasCalledUno: false,
          unoPendingSinceMs: null,
          unoProtectionStartedAtMs: null,
          unoProtectionEndsAtMs: null,
          isEliminated: false,
          isRoundWinner: false,
          hasLeftRoom: false,
          eliminationReason: null
        },
        ...createStateWithOverrides({}).players.slice(1)
      ]
    });

    const currentPlayer = state.players[0]!;
    const decision = chooseCommand(state, currentPlayer);

    expect(decision.command.type).toBe("play-card");
    expect(decision.command).toMatchObject({
      declaredColor: "blue"
    });
  });

  it("drawStack 目标玩家会优先尝试叠加，否则 resolve-draw-stack", () => {
    const stackableState = createStateWithOverrides({
      currentPlayerId: "p1",
      currentColor: "red",
      drawStack: {
        active: true,
        amount: 2,
        previousDrawValue: 2,
        previousDrawKind: "draw-two",
        targetPlayerId: "p1"
      },
      players: [
        {
          id: "p1",
          displayName: "Bot 1",
          avatarUrl: null,
          hand: [
            {
              id: "draw-two",
              kind: "draw-two",
              color: "blue",
              drawValue: 2,
              isBlack: false,
              displayName: "蓝普通+2"
            }
          ],
          handCount: 1,
          hasCalledUno: false,
          unoPendingSinceMs: null,
          unoProtectionStartedAtMs: null,
          unoProtectionEndsAtMs: null,
          isEliminated: false,
          isRoundWinner: false,
          hasLeftRoom: false,
          eliminationReason: null
        },
        ...createStateWithOverrides({}).players.slice(1)
      ]
    });

    const stackDecision = chooseCommand(stackableState, stackableState.players[0]!);
    expect(stackDecision.command.type).toBe("play-card");

    const resolveState = {
      ...stackableState,
      players: [
        {
          ...stackableState.players[0]!,
          hand: [],
          handCount: 0
        },
        ...stackableState.players.slice(1)
      ]
    };
    const resolveDecision = chooseCommand(resolveState, resolveState.players[0]!);
    expect(resolveDecision.command.type).toBe("resolve-draw-stack");
  });

  it("drawUntilColor 目标玩家会 resolve-draw-until-color", () => {
    const state = createStateWithOverrides({
      currentPlayerId: "p1",
      drawUntilColor: {
        active: true,
        color: "green",
        targetPlayerId: "p1"
      }
    });

    const decision = chooseCommand(state, state.players[0]!);

    expect(decision.command.type).toBe("resolve-draw-until-color");
  });

  it("batch 模式能运行多局并输出统计", () => {
    const report = batchSimulate({
      games: 5,
      playerCount: 3,
      mode: "no-challenge",
      seedBase: 5000,
      maxSteps: 120,
      verbose: false,
      verboseDebug: false,
      autoUno: true,
      challengeRate: 0.3
    });

    expect(report.totalGames).toBe(5);
    expect(report.results).toHaveLength(5);
    expect(report.finishedGames + report.stuckGames + report.failedInvariantGames).toBe(5);
  });
});
