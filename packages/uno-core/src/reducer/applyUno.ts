import type { GameState } from "../gameState";
import {
  UNO_PENALTY_DRAW_COUNT,
  cloneGameState,
  findPlayer,
  giveCardsToPlayer
} from "./effects";
import { drawCardsFromState } from "./drawCardsFromState";
import { ERROR_CODES, rejectCommand } from "./errors";
import type {
  ApplyCommandResult,
  GameEvent,
  ReportUnoCommand,
  SayUnoCommand
} from "./types";

export function applySayUnoCommand(
  state: GameState,
  command: SayUnoCommand
): ApplyCommandResult {
  if (state.status === "finished") {
    return rejectCommand(
      state,
      command,
      ERROR_CODES.gameFinished,
      "Cannot call UNO after the game has finished."
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
      "Inactive players cannot call UNO."
    );
  }

  if (player.handCount !== 1 || player.unoPendingSinceMs === null) {
    return rejectCommand(
      state,
      command,
      ERROR_CODES.unoNotAvailable,
      "UNO can only be called while exactly one card remains."
    );
  }

  const nextState = cloneGameState(state);
  const nextPlayer = findPlayer(nextState, command.playerId);

  if (nextPlayer === undefined) {
    return rejectCommand(
      state,
      command,
      ERROR_CODES.playerNotFound,
      "Player was not found after cloning state."
    );
  }

  nextState.now = command.timestampMs ?? state.now;
  nextPlayer.hasCalledUno = true;

  return {
    state: nextState,
    events: [
      {
        type: "uno-called",
        playerId: command.playerId
      }
    ]
  };
}

export function applyReportUnoCommand(
  state: GameState,
  command: ReportUnoCommand
): ApplyCommandResult {
  if (state.status === "finished") {
    return rejectCommand(
      state,
      command,
      ERROR_CODES.gameFinished,
      "Cannot report UNO after the game has finished."
    );
  }

  const reporter = findPlayer(state, command.playerId);
  const target = findPlayer(state, command.targetPlayerId);

  if (reporter === undefined || target === undefined) {
    return rejectCommand(
      state,
      command,
      ERROR_CODES.playerNotFound,
      "Reporter or target player was not found."
    );
  }

  if (
    reporter.isEliminated ||
    reporter.isRoundWinner ||
    target.isEliminated ||
    target.isRoundWinner
  ) {
    return rejectCommand(
      state,
      command,
      ERROR_CODES.playerEliminated,
      "Eliminated players cannot participate in UNO reporting."
    );
  }

  if (
    target.handCount !== 1 ||
    target.unoPendingSinceMs === null ||
    target.hasCalledUno
  ) {
    return rejectCommand(
      state,
      command,
      ERROR_CODES.unoReportFailed,
      "Target player is not currently punishable for a missed UNO call."
    );
  }

  const now = command.timestampMs ?? state.now;
  const protectionEndsAt = target.unoProtectionEndsAtMs;

  if (protectionEndsAt === null || now < protectionEndsAt) {
    const nextState = cloneGameState(state);
    nextState.now = now;

    return {
      state: nextState,
      events: [
        {
          type: "uno-report-failed-protected",
          targetPlayerId: command.targetPlayerId,
          reporterPlayerId: command.playerId,
          protectionEndsAtMs: protectionEndsAt
        }
      ]
    };
  }

  let nextState = cloneGameState(state);
  const nextTarget = findPlayer(nextState, command.targetPlayerId);

  if (nextTarget === undefined) {
    return rejectCommand(
      state,
      command,
      ERROR_CODES.playerNotFound,
      "Target player was not found after cloning state."
    );
  }

  nextState.now = now;
  const drawResult = drawCardsFromState(nextState, UNO_PENALTY_DRAW_COUNT);
  nextState = drawResult.state;
  const penaltyCards = drawResult.cards;
  const events: GameEvent[] = [...drawResult.events];
  const refreshedTarget = findPlayer(nextState, command.targetPlayerId);

  if (refreshedTarget === undefined) {
    return rejectCommand(
      state,
      command,
      ERROR_CODES.playerNotFound,
      "Target player was not found after drawing penalty cards."
    );
  }

  giveCardsToPlayer(
    nextState,
    refreshedTarget,
    penaltyCards,
    now,
    events,
    "uno-penalty"
  );
  events.push({
    type: "uno-penalty-applied",
    targetPlayerId: command.targetPlayerId,
    reporterPlayerId: command.playerId,
    drawCount: UNO_PENALTY_DRAW_COUNT
  });

  return {
    state: nextState,
    events
  };
}
