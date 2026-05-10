import type { PlayerGameSnapshot } from "@thunder-uno/shared-types";
import type { GameState } from "../gameState";

/**
 * 根据查看者身份裁剪玩家视角快照。
 *
 * 这一步非常关键：
 * - 服务端权威状态保留全部手牌与隐藏信息
 * - 发给客户端时必须切掉他人手牌
 * - `hadBlackCardBeforeDraw` 这类质疑隐藏信息绝不能外发
 */
export function createPlayerGameSnapshot(
  state: GameState,
  viewerPlayerId: string
): PlayerGameSnapshot {
  const self = state.players.find((player) => player.id === viewerPlayerId);

  if (self === undefined) {
    throw new Error(`Viewer player ${viewerPlayerId} was not found.`);
  }

  return {
    roomId: state.roomId,
    snapshotVersion: state.snapshotVersion,
    status: state.status,
    mode: state.mode,
    currentPlayerId: state.currentPlayerId,
    currentColor: state.currentColor,
    direction: state.direction,
    topCard: state.topCard,
    discardPile: state.discardPile.slice(-12),
    drawPileCount: state.drawPile.length,
    drawStack: {
      active: state.drawStack.active,
      amount: state.drawStack.amount,
      previousDrawValue: state.drawStack.previousDrawValue,
      previousDrawKind: state.drawStack.previousDrawKind,
      targetPlayerId: state.drawStack.targetPlayerId
    },
    drawUntilColor: {
      active: state.drawUntilColor.active,
      color: state.drawUntilColor.color,
      targetPlayerId: state.drawUntilColor.targetPlayerId
    },
    normalDrawOffer: {
      active: state.normalDrawOffer.active,
      playerId: state.normalDrawOffer.playerId,
      cardId:
        state.normalDrawOffer.playerId === viewerPlayerId
          ? state.normalDrawOffer.cardId
          : null
    },
    initialDirectionChoice: {
      active: state.initialDirectionChoice?.active === true,
      chooserPlayerId: state.initialDirectionChoice?.chooserPlayerId ?? null
    },
    challengeWindow: {
      active: state.challengeWindow.active,
      targetPlayerId: state.challengeWindow.targetPlayerId
    },
    winnerPlayerIds: [...state.winnerPlayerIds],
    self: {
      playerId: self.id,
      handCount: self.handCount,
      hasCalledUno: self.hasCalledUno,
      unoPendingSinceMs: self.unoPendingSinceMs,
      unoProtectionStartedAtMs: self.unoProtectionStartedAtMs,
      unoProtectionEndsAtMs: self.unoProtectionEndsAtMs,
      isEliminated: self.isEliminated,
      isRoundWinner: self.isRoundWinner,
      hasLeftRoom: self.hasLeftRoom,
      isCurrentPlayer: self.id === state.currentPlayerId,
      isBot: self.isBot === true,
      hand: [...self.hand],
      ...(self.displayName === undefined
        ? {}
        : { displayName: self.displayName }),
      ...(self.avatarUrl === undefined ? {} : { avatarUrl: self.avatarUrl })
    },
    opponents: getOpponentPlayersInClockwiseSeatOrder(state, viewerPlayerId)
      .map((player) => {
        return {
          playerId: player.id,
          handCount: player.handCount,
          hasCalledUno: player.hasCalledUno,
          unoPendingSinceMs: player.unoPendingSinceMs,
          unoProtectionStartedAtMs: player.unoProtectionStartedAtMs,
          unoProtectionEndsAtMs: player.unoProtectionEndsAtMs,
          isEliminated: player.isEliminated,
          isRoundWinner: player.isRoundWinner,
          hasLeftRoom: player.hasLeftRoom,
          isCurrentPlayer: player.id === state.currentPlayerId,
          isBot: player.isBot === true,
          ...(player.displayName === undefined
            ? {}
            : { displayName: player.displayName }),
          ...(player.avatarUrl === undefined
            ? {}
            : { avatarUrl: player.avatarUrl })
        };
      })
  };
}

function getOpponentPlayersInClockwiseSeatOrder(
  state: GameState,
  viewerPlayerId: string
) {
  const orderedPlayers = getPlayersInSeatOrder(state);
  const viewerIndex = orderedPlayers.findIndex(
    (player) => player.id === viewerPlayerId
  );

  if (viewerIndex < 0) {
    return orderedPlayers.filter((player) => player.id !== viewerPlayerId);
  }

  const opponents: GameState["players"] = [];
  let cursor = viewerIndex;

  for (let step = 1; step < orderedPlayers.length; step += 1) {
    cursor = (cursor + 1) % orderedPlayers.length;

    const player = orderedPlayers[cursor];
    if (player !== undefined && player.id !== viewerPlayerId) {
      opponents.push(player);
    }
  }

  return opponents;
}

function getPlayersInSeatOrder(state: GameState): GameState["players"] {
  const playerById = new Map(state.players.map((player) => [player.id, player]));
  const orderedPlayers = state.playerOrder
    .map((playerId) => playerById.get(playerId))
    .filter((player): player is GameState["players"][number] => player !== undefined);
  const orderedPlayerIds = new Set(orderedPlayers.map((player) => player.id));
  const missingPlayers = state.players.filter(
    (player) => !orderedPlayerIds.has(player.id)
  );

  return [...orderedPlayers, ...missingPlayers];
}
