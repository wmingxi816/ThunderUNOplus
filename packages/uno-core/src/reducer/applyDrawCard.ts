import type { GameState } from "../gameState";
import { canPlayCard } from "../rules/canPlayCard";
import {
  cloneGameState,
  findPlayer,
  giveCardsToPlayer,
  hasBlackCardInHand,
  openNormalDrawOffer,
  openChallengeWindow
} from "./effects";
import { ERROR_CODES, rejectCommand } from "./errors";
import { drawCardsFromState } from "./drawCardsFromState";
import { getNextActivePlayerId } from "./turn";
import type { ApplyCommandResult, DrawCardCommand, GameEvent } from "./types";

export function applyDrawCardCommand(
  state: GameState,
  command: DrawCardCommand
): ApplyCommandResult {
  if (state.status === "finished") {
    return rejectCommand(
      state,
      command,
      ERROR_CODES.gameFinished,
      "Cannot draw cards after the game has finished."
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

  if (player.isEliminated) {
    return rejectCommand(
      state,
      command,
      ERROR_CODES.playerEliminated,
      "Eliminated players cannot draw."
    );
  }

  if (state.currentPlayerId !== command.playerId) {
    return rejectCommand(
      state,
      command,
      ERROR_CODES.notCurrentPlayer,
      "Only the current player can draw."
    );
  }

  if (state.drawStack.active) {
    return rejectCommand(
      state,
      command,
      ERROR_CODES.drawStackActive,
      "Use resolve-draw-stack while a draw stack is active."
    );
  }

  if (state.drawUntilColor.active) {
    return rejectCommand(
      state,
      command,
      ERROR_CODES.drawUntilColorActive,
      "Use resolve-draw-until-color while penalty-draw pressure is active."
    );
  }

  if (state.normalDrawOffer.active) {
    return rejectCommand(
      state,
      command,
      ERROR_CODES.normalDrawDecisionRequired,
      "Choose whether to play or keep the drawn card before drawing again."
    );
  }

  const now = command.timestampMs ?? state.now;
  const hadBlackCardBeforeDraw =
    state.mode === "with-challenge" ? hasBlackCardInHand(player) : false;
  let nextState = cloneGameState(state);

  nextState.now = now;
  const drawResult = drawCardsFromState(nextState, 1);
  nextState = drawResult.state;
  const events: GameEvent[] = [...drawResult.events];
  const [drawnCard] = drawResult.cards;
  const nextPlayer = findPlayer(nextState, command.playerId);

  if (nextPlayer === undefined) {
    return rejectCommand(
      state,
      command,
      ERROR_CODES.playerNotFound,
      "Player was not found after drawing state changes."
    );
  }

  if (drawnCard === undefined) {
    if (nextState.mode === "with-challenge") {
      openChallengeWindow(
        nextState,
        command.playerId,
        hadBlackCardBeforeDraw,
        events
      );
    }

    return {
      state: nextState,
      events
    };
  }

  giveCardsToPlayer(
    nextState,
    nextPlayer,
    [drawnCard],
    now,
    events,
    "normal-draw"
  );

  const canPlayDrawnCard = canPlayCard({
    card: drawnCard,
    topCard: nextState.topCard,
    currentColor: nextState.currentColor
  });

  if (canPlayDrawnCard && nextState.status !== "finished" && !nextPlayer.isEliminated) {
    openNormalDrawOffer(nextState, command.playerId, drawnCard.id, events);

    if (nextState.mode === "with-challenge") {
      openChallengeWindow(
        nextState,
        command.playerId,
        hadBlackCardBeforeDraw,
        events
      );
    }

    return {
      state: nextState,
      events
    };
  }

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

  if (nextState.mode === "with-challenge") {
    openChallengeWindow(
      nextState,
      command.playerId,
      hadBlackCardBeforeDraw,
      events
    );
  }

  return {
    state: nextState,
    events
  };
}
