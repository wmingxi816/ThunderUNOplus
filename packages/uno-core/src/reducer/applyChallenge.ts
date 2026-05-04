import type { GameState } from "../gameState";
import {
  CHALLENGE_FAILURE_CHALLENGER_DRAW_COUNT,
  CHALLENGE_SUCCESS_TARGET_DRAW_COUNT,
  clearChallengeWindow,
  cloneGameState,
  findPlayer,
  giveCardsToPlayer
} from "./effects";
import { drawCardsFromState } from "./drawCardsFromState";
import { ERROR_CODES, rejectCommand } from "./errors";
import type {
  ApplyCommandResult,
  ChallengeDrawCommand,
  GameEvent
} from "./types";

export function applyChallengeDrawCommand(
  state: GameState,
  command: ChallengeDrawCommand
): ApplyCommandResult {
  if (state.status === "finished") {
    return rejectCommand(
      state,
      command,
      ERROR_CODES.gameFinished,
      "Cannot challenge after the game has finished."
    );
  }

  if (state.mode !== "with-challenge") {
    return rejectCommand(
      state,
      command,
      ERROR_CODES.challengeNotAvailable,
      "Challenge is only available in with-challenge mode."
    );
  }

  const challenger = findPlayer(state, command.playerId);
  const target = findPlayer(state, command.targetPlayerId);

  if (challenger === undefined || target === undefined) {
    return rejectCommand(
      state,
      command,
      ERROR_CODES.playerNotFound,
      "Challenger or target player was not found."
    );
  }

  if (challenger.isEliminated || target.isEliminated) {
    return rejectCommand(
      state,
      command,
      ERROR_CODES.playerEliminated,
      "Eliminated players cannot participate in challenges."
    );
  }

  if (
    !state.challengeWindow.active ||
    state.challengeWindow.targetPlayerId !== command.targetPlayerId
  ) {
    return rejectCommand(
      state,
      command,
      ERROR_CODES.challengeNotAvailable,
      "There is no active challenge window for the target player."
    );
  }

  if (command.playerId === command.targetPlayerId) {
    return rejectCommand(
      state,
      command,
      ERROR_CODES.challengeNotAvailable,
      "A player cannot challenge their own draw."
    );
  }

  let nextState = cloneGameState(state);
  const nextChallenger = findPlayer(nextState, command.playerId);
  const nextTarget = findPlayer(nextState, command.targetPlayerId);

  if (nextChallenger === undefined || nextTarget === undefined) {
    return rejectCommand(
      state,
      command,
      ERROR_CODES.playerNotFound,
      "Challenger or target player was not found after cloning state."
    );
  }

  const now = command.timestampMs ?? state.now;
  nextState.now = now;

  const success = state.challengeWindow.hadBlackCardBeforeDraw;
  const penaltyPlayer = success ? nextTarget : nextChallenger;
  const penaltyDrawCount = success
    ? CHALLENGE_SUCCESS_TARGET_DRAW_COUNT
    : CHALLENGE_FAILURE_CHALLENGER_DRAW_COUNT;
  const drawResult = drawCardsFromState(nextState, penaltyDrawCount);
  nextState = drawResult.state;
  const penaltyCards = drawResult.cards;
  const events: GameEvent[] = [...drawResult.events];
  const refreshedPenaltyPlayer = findPlayer(nextState, penaltyPlayer.id);

  if (refreshedPenaltyPlayer === undefined) {
    return rejectCommand(
      state,
      command,
      ERROR_CODES.playerNotFound,
      "Penalty player was not found after drawing penalty cards."
    );
  }

  giveCardsToPlayer(
    nextState,
    refreshedPenaltyPlayer,
    penaltyCards,
    now,
    events,
    "challenge-penalty"
  );
  clearChallengeWindow(nextState);
  events.push({
    type: "challenge-resolved",
    challengerPlayerId: command.playerId,
    targetPlayerId: command.targetPlayerId,
    success,
    penaltyPlayerId: refreshedPenaltyPlayer.id,
    drawCount: penaltyDrawCount
  });

  return {
    state: nextState,
    events
  };
}
