import type {
  ErrorCode,
  GameMode,
  GameCommand,
  GameEvent,
  PlayerId,
  RequestId,
  RoomId,
  ShuffleSeed,
  UnixMs
} from "@thunder-uno/shared-types";
import type {
  PlayerRoomSnapshot,
  SnapshotPayload
} from "./snapshots";
import type { ProtocolErrorCode } from "./errors";
import { PROTOCOL_VERSION } from "./version";

export interface ClientCreateRoomMessage {
  protocolVersion: typeof PROTOCOL_VERSION;
  type: "create-room";
  requestId: RequestId;
  userId: string;
  nickname: string;
  avatarUrl?: string | null;
  mode: GameMode;
  roomId?: RoomId;
  timestampMs: UnixMs;
}

export interface ClientCommandMessage {
  protocolVersion: typeof PROTOCOL_VERSION;
  type: "command";
  requestId: RequestId;
  roomId: RoomId;
  playerId: PlayerId;
  command: GameCommand;
  timestampMs: UnixMs;
}

export interface ClientPingMessage {
  protocolVersion: typeof PROTOCOL_VERSION;
  type: "ping";
  requestId: RequestId;
  timestampMs: UnixMs;
}

export interface ClientJoinRoomMessage {
  protocolVersion: typeof PROTOCOL_VERSION;
  type: "join-room";
  requestId: RequestId;
  roomId: RoomId;
  userId: string;
  nickname: string;
  avatarUrl?: string | null;
  timestampMs: UnixMs;
}

export interface ClientStartGameMessage {
  protocolVersion: typeof PROTOCOL_VERSION;
  type: "start-game";
  requestId: RequestId;
  roomId: RoomId;
  playerId: PlayerId;
  seed?: ShuffleSeed;
  timestampMs: UnixMs;
}

export interface ClientSetReadyMessage {
  protocolVersion: typeof PROTOCOL_VERSION;
  type: "set-ready";
  requestId: RequestId;
  roomId: RoomId;
  playerId: PlayerId;
  ready: boolean;
  timestampMs: UnixMs;
}

export interface ClientRestartGameMessage {
  protocolVersion: typeof PROTOCOL_VERSION;
  type: "restart-game";
  requestId: RequestId;
  roomId: RoomId;
  playerId: PlayerId;
  seed?: ShuffleSeed;
  timestampMs: UnixMs;
}

export interface ClientContinueGameMessage {
  protocolVersion: typeof PROTOCOL_VERSION;
  type: "continue-game";
  requestId: RequestId;
  roomId: RoomId;
  playerId: PlayerId;
  timestampMs: UnixMs;
}

export interface ClientLeaveRoomMessage {
  protocolVersion: typeof PROTOCOL_VERSION;
  type: "leave-room";
  requestId: RequestId;
  roomId: RoomId;
  playerId: PlayerId;
  timestampMs: UnixMs;
}

export interface ClientReconnectMessage {
  protocolVersion: typeof PROTOCOL_VERSION;
  type: "reconnect";
  requestId: RequestId;
  roomId: RoomId;
  userId: string;
  timestampMs: UnixMs;
}

export type ClientMessage =
  | ClientCreateRoomMessage
  | ClientCommandMessage
  | ClientPingMessage
  | ClientJoinRoomMessage
  | ClientStartGameMessage
  | ClientSetReadyMessage
  | ClientRestartGameMessage
  | ClientContinueGameMessage
  | ClientLeaveRoomMessage
  | ClientReconnectMessage;

export interface ServerRoomStateMessage {
  protocolVersion: typeof PROTOCOL_VERSION;
  type: "room-state";
  requestId?: RequestId;
  roomId: RoomId;
  playerId: PlayerId;
  room: PlayerRoomSnapshot;
  snapshotVersion: number;
}

export interface ServerEventsMessage {
  protocolVersion: typeof PROTOCOL_VERSION;
  type: "events";
  requestId?: RequestId;
  roomId: RoomId;
  events: GameEvent[];
  snapshotVersion: number;
}

export interface ServerSnapshotMessage {
  protocolVersion: typeof PROTOCOL_VERSION;
  type: "snapshot";
  roomId: RoomId;
  playerId: PlayerId;
  snapshot: SnapshotPayload;
  snapshotVersion: number;
}

export interface ServerErrorMessage {
  protocolVersion: typeof PROTOCOL_VERSION;
  type: "error";
  requestId?: RequestId;
  roomId?: RoomId;
  code: ProtocolErrorCode | ErrorCode;
  message: string;
}

export interface ServerPongMessage {
  protocolVersion: typeof PROTOCOL_VERSION;
  type: "pong";
  requestId: RequestId;
  timestampMs: UnixMs;
}

export interface ServerRoomClosedMessage {
  protocolVersion: typeof PROTOCOL_VERSION;
  type: "room-closed";
  requestId?: RequestId;
  roomId: RoomId;
}

export type ServerMessage =
  | ServerRoomStateMessage
  | ServerEventsMessage
  | ServerSnapshotMessage
  | ServerErrorMessage
  | ServerPongMessage
  | ServerRoomClosedMessage;

export type CommandEnvelope = ClientCommandMessage;
export type RoomStateEnvelope = ServerRoomStateMessage;
export type EventEnvelope = ServerEventsMessage;
export type SnapshotEnvelope = ServerSnapshotMessage;
export type ErrorEnvelope = ServerErrorMessage;
