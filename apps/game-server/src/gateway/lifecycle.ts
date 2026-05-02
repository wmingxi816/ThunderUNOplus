import { broadcastRoomState } from "../broadcast/broadcastRoomState";
import { ConnectionRegistry } from "../connection/connectionRegistry";
import type { ServerConnection } from "../connection/connectionTypes";
import { RoomManager } from "../room/roomManager";

/**
 * WebSocket close 之后的生命周期处理。
 * Phase 3B 继续沿用 Phase 3A 的规则：
 * - waiting 下真离开
 * - playing 下只标记 disconnected
 */
export function handleConnectionClosed(params: {
  connection: ServerConnection;
  roomManager: RoomManager;
  connectionRegistry: ConnectionRegistry;
}): void {
  const { connection, roomManager, connectionRegistry } = params;

  try {
    if (connection.roomId !== null && connection.playerId !== null) {
      const leaveResult = roomManager.leaveRoom({
        roomId: connection.roomId,
        playerId: connection.playerId
      });

      if (leaveResult.room !== null) {
        broadcastRoomState(leaveResult.room, connectionRegistry);
      }
    }
  } finally {
    connectionRegistry.unregisterConnection(connection.connectionId);
  }
}
