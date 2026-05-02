import { formatBatchSummary } from "./logger/simulationLogger";
import { simulateGame } from "./simulateGame";
import { buildBatchSimulationReport } from "./stats/simulationStats";
import type {
  BatchSimulationOptions,
  BatchSimulationReport
} from "./simulationTypes";

/** 批量运行多局模拟，并汇总统计信息。 */
export function batchSimulate(
  options: BatchSimulationOptions
): BatchSimulationReport {
  const results = [];

  for (let index = 0; index < options.games; index += 1) {
    const seed = options.seedBase + index;
    const result = simulateGame({
      playerCount: options.playerCount,
      mode: options.mode,
      seed,
      maxSteps: options.maxSteps,
      verbose: options.verbose,
      verboseDebug: options.verboseDebug,
      autoUno: options.autoUno,
      challengeRate: options.challengeRate
    });

    results.push(result);
  }

  return buildBatchSimulationReport(
    results,
    options.playerCount,
    options.mode,
    options.seedBase
  );
}

/** 便于 CLI 直接打印批量结果。 */
export function formatBatchSimulationReport(
  report: BatchSimulationReport
): string {
  return formatBatchSummary(report);
}
