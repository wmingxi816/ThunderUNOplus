import {
  CARD_COLORS,
  createPlayerGameSnapshot,
  type Card,
  type GameState
} from "@thunder-uno/uno-core";
import type { InvariantResult } from "../simulationTypes";

/** 对每一步推进后的 GameState 做结构一致性检查。 */
export function validateGameStateInvariant(state: GameState): InvariantResult {
  if (state.status !== "finished") {
    const currentPlayer = state.players.find(
      (player) => player.id === state.currentPlayerId
    );

    if (currentPlayer === undefined) {
      return invalid("currentPlayerId does not exist.");
    }

    if (currentPlayer.isEliminated) {
      return invalid("currentPlayerId points to an eliminated player.");
    }
  }

  if (state.discardPile.length === 0) {
    return invalid("discardPile must always keep at least one top card.");
  }

  if (!CARD_COLORS.includes(state.currentColor)) {
    return invalid("currentColor must stay within red/yellow/blue/green.");
  }

  for (const player of state.players) {
    if (player.handCount < 0) {
      return invalid(`player ${player.id} has a negative handCount.`);
    }

    if (player.handCount !== player.hand.length) {
      return invalid(`player ${player.id} handCount does not match hand length.`);
    }
  }

  const duplicateResult = validateUniqueCardIds(state);

  if (!duplicateResult.valid) {
    return duplicateResult;
  }

  if (state.drawStack.active) {
    if (state.drawStack.targetPlayerId === null) {
      return invalid("drawStack.active=true but targetPlayerId is null.");
    }

    const target = state.players.find(
      (player) => player.id === state.drawStack.targetPlayerId
    );

    if (target === undefined || target.isEliminated) {
      return invalid("drawStack target is missing or eliminated.");
    }
  }

  if (state.drawUntilColor.active) {
    if (state.drawUntilColor.targetPlayerId === null) {
      return invalid("drawUntilColor.active=true but targetPlayerId is null.");
    }

    const target = state.players.find(
      (player) => player.id === state.drawUntilColor.targetPlayerId
    );

    if (target === undefined || target.isEliminated) {
      return invalid("drawUntilColor target is missing or eliminated.");
    }
  }

  if (state.winnerPlayerIds.length > 0 && state.status !== "finished") {
    return invalid("winnerPlayerIds is not empty while status is not finished.");
  }

  if (state.status === "finished" && state.winnerPlayerIds.length === 0) {
    return invalid("finished game must have at least one winnerPlayerId.");
  }

  const visiblePlayer =
    state.players.find((player) => !player.isEliminated) ?? state.players[0];

  if (visiblePlayer !== undefined) {
    const snapshot = createPlayerGameSnapshot(state, visiblePlayer.id);

    if ("hadBlackCardBeforeDraw" in snapshot.challengeWindow) {
      return invalid("snapshot leaked challengeWindow hidden fields.");
    }

    if ("drawPile" in (snapshot as unknown as Record<string, unknown>)) {
      return invalid("snapshot leaked the full drawPile.");
    }
  }

  return { valid: true };
}

function validateUniqueCardIds(state: GameState): InvariantResult {
  const seen = new Set<string>();

  const allZones: Card[][] = [
    ...state.players.map((player) => player.hand),
    state.drawPile,
    state.discardPile
  ];

  for (const zone of allZones) {
    for (const card of zone) {
      if (seen.has(card.id)) {
        return invalid(`duplicate card id detected: ${card.id}`);
      }

      seen.add(card.id);
    }
  }

  return { valid: true };
}

function invalid(reason: string): InvariantResult {
  return {
    valid: false,
    reason
  };
}
