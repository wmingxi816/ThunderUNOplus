import { formatCardSummary, formatCommandSummary } from "../logger/simulationLogger";
import type { InvariantFailureContext } from "../simulationTypes";

/** 把 invariant 失败上下文整理成便于复现的文本。 */
export function formatInvariantFailure(
  reason: string,
  context: InvariantFailureContext
): string {
  const topCard = context.state.topCard;
  const recentEvents = context.recentEvents.map((event) => event.type).join(", ");

  return [
    `invariant failed: ${reason}`,
    `seed=${String(context.seed)}`,
    `step=${String(context.step)}`,
    `players=${String(context.playerCount)}`,
    `mode=${context.mode}`,
    `current=${context.state.currentPlayerId}`,
    `top=${formatCardSummary(topCard)}`,
    `color=${context.state.currentColor}`,
    `drawStack=${context.state.drawStack.active ? String(context.state.drawStack.amount) : "0"}`,
    `drawUntilColor=${context.state.drawUntilColor.active ? String(context.state.drawUntilColor.color) : "inactive"}`,
    `lastCommand=${context.lastCommand === null ? "none" : formatCommandSummary(context.lastCommand)}`,
    `recentEvents=${recentEvents === "" ? "none" : recentEvents}`
  ].join(" | ");
}
