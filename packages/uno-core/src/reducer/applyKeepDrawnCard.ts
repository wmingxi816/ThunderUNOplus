import type { GameState } from "../gameState";
import {
  clearNormalDrawOffer,
  cloneGameState,
  findPlayer,
  startUnoProtectionWindows
} from "./effects";
import { ERROR_CODES, rejectCommand } from "./errors";
import { getNextActivePlayerId } from "./turn";
import type {
  ApplyCommandResult,
  GameEvent,
  KeepDrawnCardCommand
} from "./types";

export function applyKeepDrawnCardCommand(
  state: GameState,
  command: KeepDrawnCardCommand
): ApplyCommandResult {
  if (state.status === "finished") {
    return rejectCommand(
      state,
      command,
      ERROR_CODES.gameFinished,
      "Cannot keep a drawn card after the game has finished."
    );
  }

  const player = findPlayer(state, command.playerId);

  if (player === undefined) {
    return rejectCommand(
      state,
      command,
      ERROR_CODES.playerNotFound,
      "Player was not found."
    );
  }

  if (player.isEliminated || player.isRoundWinner) {
    return rejectCommand(
      state,
      command,
      ERROR_CODES.playerEliminated,
      "Inactive players cannot keep a drawn card."
    );
  }

  if (
    !state.normalDrawOffer.active ||
    state.normalDrawOffer.playerId !== command.playerId ||
    state.normalDrawOffer.cardId === null
  ) {
    return rejectCommand(
      state,
      command,
      ERROR_CODES.normalDrawDecisionNotActive,
      "There is no drawn-card decision waiting for this player."
    );
  }

  if (state.currentPlayerId !== command.playerId) {
    return rejectCommand(
      state,
      command,
      ERROR_CODES.notCurrentPlayer,
      "Only the current player can keep the drawn card."
    );
  }

  const nextState = cloneGameState(state);
  const now = command.timestampMs ?? state.now;
  const keptCardId = state.normalDrawOffer.cardId;
  const events: GameEvent[] = [
    {
      type: "normal-draw-offer-kept",
      playerId: command.playerId,
      cardId: keptCardId
    }
  ];

  nextState.now = now;
  clearNormalDrawOffer(nextState);

  const nextPlayerId = getNextActivePlayerId(nextState, command.playerId, 1);

  if (nextPlayerId !== null) {
    nextState.currentPlayerId = nextPlayerId;
    startUnoProtectionWindows(nextState, now);
    events.push({
      type: "turn-advanced",
      previousPlayerId: command.playerId,
      currentPlayerId: nextPlayerId
    });
  }

  return {
    state: nextState,
    events
  };
}
