import { describe, expect, it } from "vitest";
import { batchSimulate } from "../src/batchSimulate";

describe("batchSimulate", () => {
  it("会生成可读的批量统计结果", () => {
    const report = batchSimulate({
      games: 3,
      playerCount: 4,
      mode: "no-challenge",
      seedBase: 7000,
      maxSteps: 100,
      verbose: false,
      verboseDebug: false,
      autoUno: true,
      challengeRate: 0.3
    });

    expect(report.totalGames).toBe(3);
    expect(report.seedRange).toEqual({
      from: 7000,
      to: 7002
    });
    expect(report.averageSteps).toBeGreaterThanOrEqual(0);
  });
});
