import type { PlayerId, RoomId } from "@thunder-uno/shared-types";
import type { ServerMessage } from "@thunder-uno/protocol";

export interface ServerConnection {
  connectionId: string;
  userId: string;
  roomId: RoomId | null;
  playerId: PlayerId | null;
  send(message: ServerMessage): void;
}

export interface MockServerConnection extends ServerConnection {
  sentMessages: ServerMessage[];
}
