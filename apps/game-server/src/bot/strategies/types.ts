import type { CardColor, GameCommand, GameState, PlayerId } from "@thunder-uno/shared-types";
import type { BotScoringWeights } from "../botScoring";

export type BotStrategyName = "greedy-v1" | "chaos-v1";

export interface BotStrategyDecision {
  command: GameCommand;
  score: number;
  reasons: string[];
  willCallUno: boolean;
}

export interface BotDecisionContext {
  lastUnanswerableColorByPlayerId?: Readonly<Partial<Record<PlayerId, CardColor>>>;
}

export interface BotStrategyParams {
  state: GameState;
  playerId: PlayerId;
  forgetUnoRate: number;
  random?: () => number;
  weights?: BotScoringWeights;
  context?: BotDecisionContext;
}
