import type { Card } from "../card";
import type { GameState } from "../gameState";
import {
  clearDrawUntilColor,
  cloneGameState,
  findPlayer,
  giveCardsToPlayer
} from "./effects";
import { drawCardsFromState } from "./drawCardsFromState";
import { ERROR_CODES, rejectCommand } from "./errors";
import { getNextActivePlayerId } from "./turn";
import type {
  ApplyCommandResult,
  GameEvent,
  ResolveDrawUntilColorCommand
} from "./types";

export function applyResolveDrawUntilColorCommand(
  state: GameState,
  command: ResolveDrawUntilColorCommand
): ApplyCommandResult {
  if (state.status === "finished") {
    return rejectCommand(
      state,
      command,
      ERROR_CODES.gameFinished,
      "Cannot resolve penalty-draw after the game has finished."
    );
  }

  const pressure = state.drawUntilColor;

  if (!pressure.active || pressure.targetPlayerId === null || pressure.color === null) {
    return rejectCommand(
      state,
      command,
      ERROR_CODES.drawUntilColorNotActive,
      "There is no active penalty-draw pressure to resolve."
    );
  }

  if (state.currentPlayerId !== command.playerId) {
    return rejectCommand(
      state,
      command,
      ERROR_CODES.notCurrentPlayer,
      "Only the current player can resolve penalty-draw."
    );
  }

  if (pressure.targetPlayerId !== command.playerId) {
    return rejectCommand(
      state,
      command,
      ERROR_CODES.drawUntilColorNotActive,
      "Only the targeted player can resolve penalty-draw."
    );
  }

  let nextState = cloneGameState(state);
  const now = command.timestampMs ?? state.now;
  let player = findPlayer(nextState, command.playerId);

  if (player === undefined) {
    return rejectCommand(
      state,
      command,
      ERROR_CODES.playerNotFound,
      "Player was not found."
    );
  }

  nextState.now = now;
  const events: GameEvent[] = [];
  const drawnCards: Card[] = [];

  for (;;) {
    const drawResult = drawCardsFromState(nextState, 1);
    nextState = drawResult.state;
    events.push(...drawResult.events);

    const [card] = drawResult.cards;

    if (card === undefined) {
      break;
    }

    drawnCards.push(card);

    if (card.color === pressure.color) {
      break;
    }
  }

  player = findPlayer(nextState, command.playerId);

  if (player === undefined) {
    return rejectCommand(
      state,
      command,
      ERROR_CODES.playerNotFound,
      "Player was not found after drawing cards."
    );
  }

  giveCardsToPlayer(
    nextState,
    player,
    drawnCards,
    now,
    events,
    "draw-until-color"
  );
  clearDrawUntilColor(nextState);
  events.push({
    type: "draw-until-color-resolved",
    targetPlayerId: command.playerId,
    color: pressure.color,
    drawnCount: drawnCards.length
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
