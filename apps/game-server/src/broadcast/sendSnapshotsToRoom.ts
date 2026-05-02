import {
  PROTOCOL_VERSION,
  type SnapshotEnvelope
} from "@thunder-uno/protocol";
import { createPlayerGameSnapshot } from "@thunder-uno/uno-core";
import { ConnectionRegistry } from "../connection/connectionRegistry";
import type { RoomRuntime } from "../room/roomTypes";

/**
 * 对局中的 snapshot 必须按玩家逐个裁剪。
 * 这是服务端权威状态和客户端可见状态之间最关键的一道安全边界。
 */
export function sendSnapshotsToRoom(
  room: RoomRuntime,
  connectionRegistry: ConnectionRegistry
): SnapshotEnvelope[] {
  if (room.gameState === null) {
    return [];
  }

  const sentMessages: SnapshotEnvelope[] = [];

  for (const player of room.players) {
    if (!player.connected) {
      continue;
    }

    const envelope = createGameSnapshotEnvelope(room, player.playerId);

    if (connectionRegistry.sendToPlayer(player.playerId, envelope)) {
      sentMessages.push(envelope);
    }
  }

  return sentMessages;
}

export function sendSnapshotToPlayer(
  room: RoomRuntime,
  connectionRegistry: ConnectionRegistry,
  playerId: string
): SnapshotEnvelope | null {
  if (room.gameState === null) {
    return null;
  }

  const envelope = createGameSnapshotEnvelope(room, playerId);

  if (!connectionRegistry.sendToPlayer(playerId, envelope)) {
    return null;
  }

  return envelope;
}

export function createGameSnapshotEnvelope(
  room: RoomRuntime,
  playerId: string
): SnapshotEnvelope {
  if (room.gameState === null) {
    throw new Error(`Room ${room.roomId} has no gameState to snapshot.`);
  }

  return {
    protocolVersion: PROTOCOL_VERSION,
    type: "snapshot",
    roomId: room.roomId,
    playerId,
    snapshotVersion: room.snapshotVersion,
    snapshot: createPlayerGameSnapshot(room.gameState, playerId)
  };
}
