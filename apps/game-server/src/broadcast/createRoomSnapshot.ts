import type { PlayerRoomSnapshot, RoomStatus } from "@thunder-uno/shared-types";
import type { RoomRuntime } from "../room/roomTypes";

/**
 * RoomRuntime 是服务端内部结构，不能直接发给客户端。
 * 这里把它裁成协议层可公开的房间快照。
 */
export function createRoomSnapshot(
  room: RoomRuntime,
  viewerPlayerId: string
): PlayerRoomSnapshot {
  const viewer = room.players.find((player) => player.playerId === viewerPlayerId);

  if (viewer === undefined) {
    throw new Error(`Viewer player ${viewerPlayerId} was not found in room ${room.roomId}.`);
  }

  return {
    roomId: room.roomId,
    roomCode: room.roomId,
    status: mapRoomStatus(room.status),
    mode: room.mode,
    hostPlayerId: room.ownerPlayerId,
    snapshotVersion: room.snapshotVersion,
    players: [...room.players]
      .sort((left, right) => left.seatIndex - right.seatIndex)
      .map((player) => {
        return {
          playerId: player.playerId,
          displayName: player.nickname,
          avatarUrl: player.avatarUrl,
          seatIndex: player.seatIndex,
          isHost: player.playerId === room.ownerPlayerId,
          connectionStatus: player.hasLeftRoom
            ? "left"
            : player.connected
              ? "connected"
              : "disconnected"
        };
      })
  };
}

function mapRoomStatus(status: RoomRuntime["status"]): RoomStatus {
  switch (status) {
    case "waiting":
      return "lobby";
    case "playing":
      return "playing";
    case "finished":
      return "settled";
    default: {
      const exhaustiveCheck: never = status;
      throw new Error(`Unsupported room runtime status: ${String(exhaustiveCheck)}`);
    }
  }
}
