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
    challengeWindow: {
      active: state.challengeWindow.active,
      targetPlayerId: state.challengeWindow.targetPlayerId
    },
    winnerPlayerIds: [...state.winnerPlayerIds],
    self: {
      playerId: self.id,
      handCount: self.handCount,
      hasCalledUno: self.hasCalledUno,
      isEliminated: self.isEliminated,
      isCurrentPlayer: self.id === state.currentPlayerId,
      hand: [...self.hand],
      ...(self.displayName === undefined
        ? {}
        : { displayName: self.displayName }),
      ...(self.avatarUrl === undefined ? {} : { avatarUrl: self.avatarUrl })
    },
    opponents: state.players
      .filter((player) => player.id !== viewerPlayerId)
      .map((player) => {
        return {
          playerId: player.id,
          handCount: player.handCount,
          hasCalledUno: player.hasCalledUno,
          isEliminated: player.isEliminated,
          isCurrentPlayer: player.id === state.currentPlayerId,
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
