import type { GameState } from "../gameState";
import {
  clearDrawStack,
  cloneGameState,
  findPlayer,
  giveCardsToPlayer,
  startUnoProtectionWindows
} from "./effects";
import { drawCardsFromState } from "./drawCardsFromState";
import { ERROR_CODES, rejectCommand } from "./errors";
import { getNextActivePlayerId } from "./turn";
import type {
  ApplyCommandResult,
  GameEvent,
  ResolveDrawStackCommand
} from "./types";

export function applyResolveDrawStackCommand(
  state: GameState,
  command: ResolveDrawStackCommand
): ApplyCommandResult {
  if (state.status === "finished") {
    return rejectCommand(
      state,
      command,
      ERROR_CODES.gameFinished,
      "Cannot resolve draw stack after the game has finished."
    );
  }

  if (!state.drawStack.active || state.drawStack.targetPlayerId === null) {
    return rejectCommand(
      state,
      command,
      ERROR_CODES.drawStackNotActive,
      "There is no active draw stack to resolve."
    );
  }

  if (state.currentPlayerId !== command.playerId) {
    return rejectCommand(
      state,
      command,
      ERROR_CODES.notCurrentPlayer,
      "Only the current player can resolve the draw stack."
    );
  }

  if (state.drawStack.targetPlayerId !== command.playerId) {
    return rejectCommand(
      state,
      command,
      ERROR_CODES.drawStackNotActive,
      "Only the targeted player can resolve the draw stack."
    );
  }

  let nextState = cloneGameState(state);
  const now = command.timestampMs ?? state.now;

  nextState.now = now;
  const drawResult = drawCardsFromState(nextState, nextState.drawStack.amount);
  nextState = drawResult.state;
  const player = findPlayer(nextState, command.playerId);

  if (player === undefined) {
    return rejectCommand(
      state,
      command,
      ERROR_CODES.playerNotFound,
      "Player was not found."
    );
  }

  const cards = drawResult.cards;
  const events: GameEvent[] = [...drawResult.events];
  giveCardsToPlayer(nextState, player, cards, now, events, "draw-stack");
  const clearedTopCardId = nextState.topCard.id;
  clearDrawStack(nextState);
  events.push({
    type: "draw-stack-cleared",
    reason: "resolved",
    topCardId: clearedTopCardId
  });

  if (nextState.status === "finished") {
    return {
      state: nextState,
      events
    };
  }

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
