import {
  PROTOCOL_VERSION,
  type RoomStateEnvelope,
  type ServerRoomClosedMessage
} from "@thunder-uno/protocol";
import { createRoomSnapshot } from "./createRoomSnapshot";
import { ConnectionRegistry } from "../connection/connectionRegistry";
import type { RoomRuntime } from "../room/roomTypes";

/**
 * lobby 阶段广播 room-state。
 * 虽然当前所有玩家看到的玩家列表几乎相同，但仍按“按玩家生成 envelope”的形式发送，
 * 这样后续如果房间快照有 viewer-specific 字段，也不用改广播接口。
 */
export function broadcastRoomState(
  room: RoomRuntime,
  connectionRegistry: ConnectionRegistry,
  requestId?: string
): RoomStateEnvelope[] {
  const sentMessages: RoomStateEnvelope[] = [];

  for (const player of room.players) {
    if (!player.connected) {
      continue;
    }

    const envelope = createRoomStateEnvelope(room, player.playerId, requestId);

    if (connectionRegistry.sendToPlayer(player.playerId, envelope)) {
      sentMessages.push(envelope);
    }
  }

  return sentMessages;
}

export function sendRoomStateToPlayer(
  room: RoomRuntime,
  connectionRegistry: ConnectionRegistry,
  playerId: string,
  requestId?: string
): RoomStateEnvelope | null {
  const envelope = createRoomStateEnvelope(room, playerId, requestId);

  if (!connectionRegistry.sendToPlayer(playerId, envelope)) {
    return null;
  }

  return envelope;
}

export function createRoomStateEnvelope(
  room: RoomRuntime,
  viewerPlayerId: string,
  requestId?: string
): RoomStateEnvelope {
  return {
    protocolVersion: PROTOCOL_VERSION,
    type: "room-state",
    roomId: room.roomId,
    playerId: viewerPlayerId,
    room: createRoomSnapshot(room, viewerPlayerId),
    snapshotVersion: room.snapshotVersion,
    ...(requestId === undefined ? {} : { requestId })
  };
}

export function createRoomClosedMessage(
  roomId: string,
  requestId?: string
): ServerRoomClosedMessage {
  return {
    protocolVersion: PROTOCOL_VERSION,
    type: "room-closed",
    roomId,
    ...(requestId === undefined ? {} : { requestId })
  };
}
