import type { BatchSimulationReport, SimulationResult } from "../simulationTypes";

/** 根据多局结果汇总批量统计。 */
export function buildBatchSimulationReport(
  results: SimulationResult[],
  playerCount: number,
  mode: BatchSimulationReport["mode"],
  seedFrom: number
): BatchSimulationReport {
  const totalGames = results.length;
  const finishedGames = results.filter((result) => result.status === "finished").length;
  const stuckGames = results.filter((result) => result.status === "stuck").length;
  const failedInvariantGames = results.filter(
    (result) => result.status === "failed-invariant"
  ).length;

  const stepsList = results.map((result) => result.steps);
  const reshuffleList = results.map((result) => result.reshuffleCount);
  const rejectedList = results.map((result) => result.rejectedCommandCount);
  const winnerDistribution: Record<string, number> = {};
  let eliminationCount = 0;

  for (const result of results) {
    eliminationCount += result.eliminatedPlayerIds.length;

    for (const winnerPlayerId of result.winnerPlayerIds) {
      winnerDistribution[winnerPlayerId] =
        (winnerDistribution[winnerPlayerId] ?? 0) + 1;
    }
  }

  return {
    totalGames,
    finishedGames,
    stuckGames,
    failedInvariantGames,
    averageSteps: average(stepsList),
    maxSteps: max(stepsList),
    minSteps: min(stepsList),
    averageReshuffles: average(reshuffleList),
    averageRejectedCommands: average(rejectedList),
    winnerDistribution,
    eliminationCount,
    mode,
    playerCount,
    seedRange: {
      from: seedFrom,
      to: seedFrom + Math.max(0, totalGames - 1)
    },
    failedSeeds: results
      .filter((result) => result.status !== "finished")
      .map((result) => result.seed),
    results
  };
}

function average(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function max(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return Math.max(...values);
}

function min(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return Math.min(...values);
}
