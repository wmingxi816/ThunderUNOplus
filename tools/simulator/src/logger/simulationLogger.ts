import { type Card, type GameCommand, type GameEvent, type GameState } from "@thunder-uno/uno-core";
import type { BatchSimulationReport, SimulationResult } from "../simulationTypes";

/** 将卡牌压缩成一行摘要，方便命令行日志阅读。 */
export function formatCardSummary(card: Card | null | undefined): string {
  if (card === null || card === undefined) {
    return "none";
  }

  if (card.kind === "number") {
    return `${card.color}-${String(card.number)}`;
  }

  return card.color === undefined ? card.kind : `${card.color}-${card.kind}`;
}

/** 将命令压缩成一行摘要。 */
export function formatCommandSummary(command: GameCommand): string {
  switch (command.type) {
    case "play-card":
      return `${command.type}:${command.cardId}`;
    case "play-sequence":
    case "play-multiple-number":
      return `${command.type}:${command.cardIds.join(",")}`;
    case "play-discard-same-color":
      return `${command.type}:${command.mainCardId}+${command.attachedCardIds.join(",")}`;
    case "draw-card":
    case "keep-drawn-card":
    case "resolve-draw-stack":
    case "resolve-draw-until-color":
    case "say-uno":
      return command.type;
    case "report-uno":
    case "challenge-draw":
      return `${command.type}:${command.targetPlayerId}`;
    default: {
      const exhaustiveCheck: never = command;
      return String(exhaustiveCheck);
    }
  }
}

/** 把事件列表收缩成简洁摘要。 */
export function formatEventSummary(events: readonly GameEvent[]): string {
  return events.map((event) => event.type).join(",");
}

/** 输出单步日志。 */
export function formatStepLog(
  step: number,
  stateBefore: GameState,
  command: GameCommand,
  events: readonly GameEvent[],
  stateAfter: GameState
): string {
  const drawStackSummary = stateAfter.drawStack.active
    ? `+${String(stateAfter.drawStack.amount)} target=${String(stateAfter.drawStack.targetPlayerId)}`
    : "0";

  return [
    `[step ${String(step)}]`,
    `current=${stateBefore.currentPlayerId}`,
    `top=${formatCardSummary(stateBefore.topCard)}`,
    `color=${stateBefore.currentColor}`,
    `command=${formatCommandSummary(command)}`,
    `events=${formatEventSummary(events) || "none"}`,
    `next=${stateAfter.currentPlayerId}`,
    `drawStack=${drawStackSummary}`
  ].join(" ");
}

/** 输出单局摘要。 */
export function formatSimulationSummary(result: SimulationResult): string {
  return [
    `status=${result.status}`,
    `winner=${result.winnerPlayerIds.join(",") || "none"}`,
    `steps=${String(result.steps)}`,
    `eliminated=${result.eliminatedPlayerIds.join(",") || "none"}`,
    `reshuffles=${String(result.reshuffleCount)}`,
    `rejected=${String(result.rejectedCommandCount)}`
  ].join(" | ");
}

/** 输出批量统计摘要。 */
export function formatBatchSummary(report: BatchSimulationReport): string {
  const winnerDistribution = Object.entries(report.winnerDistribution)
    .map(([playerId, count]) => `${playerId}:${String(count)}`)
    .join(", ");

  return [
    `totalGames=${String(report.totalGames)}`,
    `finishedGames=${String(report.finishedGames)}`,
    `stuckGames=${String(report.stuckGames)}`,
    `failedInvariantGames=${String(report.failedInvariantGames)}`,
    `averageSteps=${report.averageSteps.toFixed(2)}`,
    `maxSteps=${String(report.maxSteps)}`,
    `minSteps=${String(report.minSteps)}`,
    `averageReshuffles=${report.averageReshuffles.toFixed(2)}`,
    `averageRejectedCommands=${report.averageRejectedCommands.toFixed(2)}`,
    `eliminationCount=${String(report.eliminationCount)}`,
    `winnerDistribution=${winnerDistribution || "none"}`,
    `seedRange=${String(report.seedRange.from)}-${String(report.seedRange.to)}`
  ].join(" | ");
}
