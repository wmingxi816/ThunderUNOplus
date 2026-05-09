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
    const fallbackCommand = createProtectedFallbackCommand(params.state, params.playerId);

    if (fallbackCommand === null) {
      return null;
    }

    return {
      command: fallbackCommand,
      score: Number.NEGATIVE_INFINITY,
      reasons: ["protected-fallback"],
      willCallUno: false
    };
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

function createProtectedFallbackCommand(
  state: GameState,
  playerId: PlayerId
): GameCommand | null {
  if (state.status === "finished" || state.currentPlayerId !== playerId) {
    return null;
  }

  if (state.normalDrawOffer.active && state.normalDrawOffer.playerId === playerId) {
    return {
      type: "keep-drawn-card",
      playerId
    };
  }

  if (state.drawStack.active && state.drawStack.targetPlayerId === playerId) {
    return {
      type: "resolve-draw-stack",
      playerId
    };
  }

  if (state.drawUntilColor.active && state.drawUntilColor.targetPlayerId === playerId) {
    return {
      type: "resolve-draw-until-color",
      playerId
    };
  }

  return {
    type: "draw-card",
    playerId
  };
}
