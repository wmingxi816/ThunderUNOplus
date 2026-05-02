import {
  PROTOCOL_VERSION,
  type EventEnvelope
} from "@thunder-uno/protocol";
import type { GameEvent } from "@thunder-uno/shared-types";
import { ConnectionRegistry } from "../connection/connectionRegistry";
import type { RoomRuntime } from "../room/roomTypes";

export function broadcastEvents(params: {
  room: RoomRuntime;
  connectionRegistry: ConnectionRegistry;
  events: GameEvent[];
  requestId?: string;
}): EventEnvelope {
  const envelope = createEventEnvelope({
    room: params.room,
    events: params.events,
    ...(params.requestId === undefined ? {} : { requestId: params.requestId })
  });

  params.connectionRegistry.sendToRoom(params.room.roomId, envelope);
  return envelope;
}

export function createEventEnvelope(params: {
  room: RoomRuntime;
  events: GameEvent[];
  requestId?: string;
}): EventEnvelope {
  return {
    protocolVersion: PROTOCOL_VERSION,
    type: "events",
    roomId: params.room.roomId,
    events: params.events,
    snapshotVersion: params.room.snapshotVersion,
    ...(params.requestId === undefined ? {} : { requestId: params.requestId })
  };
}
