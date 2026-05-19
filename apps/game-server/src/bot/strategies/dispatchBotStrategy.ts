import { decideChaosBotAction } from "./chaosStrategy";
import { decideGreedyBotAction } from "./greedyStrategy";
import type { BotStrategyDecision, BotStrategyName, BotStrategyParams } from "./types";

export interface DispatchBotStrategyParams extends BotStrategyParams {
  strategy: BotStrategyName;
}

export function dispatchBotStrategy(
  params: DispatchBotStrategyParams
): BotStrategyDecision | null {
  switch (params.strategy) {
    case "chaos-v1":
      return decideChaosBotAction(params);
    case "greedy-v1":
    default:
      return decideGreedyBotAction(params);
  }
}
