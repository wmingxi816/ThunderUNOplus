import type { GameCommand, GameState, PlayerId } from "@thunder-uno/shared-types";
import { generateBotCandidates } from "./botCandidates";
import { scoreBotCandidates, type ScoredBotAction } from "./botScoring";

export interface GreedyBotDecision {
  command: GameCommand;
  score: number;
  reasons: string[];
  willCallUno: boolean;
}

export interface DecideGreedyBotActionParams {
  state: GameState;
  playerId: PlayerId;
  forgetUnoRate: number;
  random?: () => number;
}

export function decideGreedyBotAction(
  params: DecideGreedyBotActionParams
): GreedyBotDecision | null {
  const random = params.random ?? Math.random;
  const candidates = generateBotCandidates(params.state, params.playerId);
  const scoredCandidates = scoreBotCandidates(
    params.state,
    params.playerId,
    candidates,
    random
  );
  const bestAction = scoredCandidates[0];

  if (bestAction === undefined) {
    return null;
  }

  return {
    command: bestAction.command,
    score: bestAction.score,
    reasons: bestAction.reasons,
    willCallUno: shouldCallUno(bestAction, params.playerId, params.forgetUnoRate, random)
  };
}

function shouldCallUno(
  action: ScoredBotAction,
  playerId: PlayerId,
  forgetUnoRate: number,
  random: () => number
): boolean {
  if (
    action.command.type !== "play-card" &&
    action.command.type !== "play-sequence" &&
    action.command.type !== "play-multiple-number" &&
    action.command.type !== "play-discard-same-color"
  ) {
    return false;
  }

  const player = action.resultingState.players.find((candidate) => candidate.id === playerId);

  return (
    player !== undefined &&
    player.handCount === 1 &&
    player.unoPendingSinceMs !== null &&
    random() >= forgetUnoRate
  );
}
