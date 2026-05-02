import type { PlayerId, RoomId } from "@thunder-uno/shared-types";
import type { ServerMessage } from "@thunder-uno/protocol";
import type { ServerConnection } from "./connectionTypes";

/**
 * 连接注册表只负责“连接和玩家的绑定关系”。
 * 它不关心规则，也不关心房间是否合法，单纯做路由和发送。
 */
export class ConnectionRegistry {
  private readonly connections = new Map<string, ServerConnection>();
  private readonly playerToConnectionId = new Map<PlayerId, string>();

  registerConnection(connection: ServerConnection): void {
    this.connections.set(connection.connectionId, connection);
  }

  unregisterConnection(connectionId: string): boolean {
    const connection = this.connections.get(connectionId);

    if (connection === undefined) {
      return false;
    }

    if (connection.playerId !== null) {
      this.playerToConnectionId.delete(connection.playerId);
    }

    this.connections.delete(connectionId);
    return true;
  }

  bindPlayer(
    connectionId: string,
    roomId: RoomId,
    playerId: PlayerId,
    userId: string
  ): void {
    const connection = this.connections.get(connectionId);

    if (connection === undefined) {
      throw new Error(`Connection ${connectionId} was not found.`);
    }

    const previousConnectionId = this.playerToConnectionId.get(playerId);

    // 同一玩家重连时，新连接接管 playerId，旧连接解绑，避免 sendToPlayer 发错人。
    if (
      previousConnectionId !== undefined &&
      previousConnectionId !== connectionId
    ) {
      const previousConnection = this.connections.get(previousConnectionId);

      if (previousConnection !== undefined) {
        previousConnection.roomId = null;
        previousConnection.playerId = null;
      }
    }

    if (
      connection.playerId !== null &&
      connection.playerId !== playerId
    ) {
      this.playerToConnectionId.delete(connection.playerId);
    }

    connection.userId = userId;
    connection.roomId = roomId;
    connection.playerId = playerId;
    this.playerToConnectionId.set(playerId, connectionId);
  }

  unbindConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);

    if (connection === undefined) {
      return;
    }

    if (connection.playerId !== null) {
      this.playerToConnectionId.delete(connection.playerId);
    }

    connection.roomId = null;
    connection.playerId = null;
  }

  getConnection(connectionId: string): ServerConnection | null {
    return this.connections.get(connectionId) ?? null;
  }

  getConnectionByPlayerId(playerId: PlayerId): ServerConnection | null {
    const connectionId = this.playerToConnectionId.get(playerId);

    if (connectionId === undefined) {
      return null;
    }

    return this.connections.get(connectionId) ?? null;
  }

  getConnectionsByRoomId(roomId: RoomId): ServerConnection[] {
    return [...this.connections.values()].filter((connection) => {
      return connection.roomId === roomId && connection.playerId !== null;
    });
  }

  sendToPlayer(playerId: PlayerId, message: ServerMessage): boolean {
    const connection = this.getConnectionByPlayerId(playerId);

    if (connection === null) {
      return false;
    }

    connection.send(message);
    return true;
  }

  sendToRoom(roomId: RoomId, message: ServerMessage): number {
    let sentCount = 0;

    for (const connection of this.getConnectionsByRoomId(roomId)) {
      connection.send(message);
      sentCount += 1;
    }

    return sentCount;
  }
}
