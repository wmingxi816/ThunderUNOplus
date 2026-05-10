import { PROTOCOL_VERSION } from "@thunder-uno/protocol";
import type {
  ClientCommandMessage,
  ClientAddBotMessage,
  ClientContinueGameMessage,
  ClientCreateRoomMessage,
  ClientJoinRoomMessage,
  ClientKickPlayerMessage,
  ClientLeaveRoomMessage,
  ClientPingMessage,
  ClientReconnectMessage,
  ClientRenamePlayerMessage,
  ClientRestartGameMessage,
  ClientSetReadyMessage,
  ClientStartGameMessage
} from "@thunder-uno/protocol";
import type { GameCommand, GameMode, PlayerId, RoomId } from "@thunder-uno/shared-types";

export type ClientCommandInput<TCommand extends GameCommand = GameCommand> =
  TCommand extends GameCommand ? Omit<TCommand, "playerId" | "timestampMs"> : never;

export function createRequestId(prefix = "req"): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createUserId(): string {
  return `web-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function buildCreateRoomMessage(params: {
  userId: string;
  nickname: string;
  mode: GameMode;
  roomId?: RoomId;
  requestId?: string;
}): ClientCreateRoomMessage {
  return {
    protocolVersion: PROTOCOL_VERSION,
    type: "create-room",
    requestId: params.requestId ?? createRequestId("create"),
    userId: params.userId,
    nickname: params.nickname,
    mode: params.mode,
    ...(params.roomId === undefined ? {} : { roomId: params.roomId }),
    timestampMs: Date.now()
  };
}

export function buildJoinRoomMessage(params: {
  roomId: RoomId;
  userId: string;
  nickname: string;
  requestId?: string;
}): ClientJoinRoomMessage {
  return {
    protocolVersion: PROTOCOL_VERSION,
    type: "join-room",
    requestId: params.requestId ?? createRequestId("join"),
    roomId: params.roomId,
    userId: params.userId,
    nickname: params.nickname,
    timestampMs: Date.now()
  };
}

export function buildStartGameMessage(params: {
  roomId: RoomId;
  playerId: PlayerId;
  seed?: string;
  requestId?: string;
}): ClientStartGameMessage {
  return {
    protocolVersion: PROTOCOL_VERSION,
    type: "start-game",
    requestId: params.requestId ?? createRequestId("start"),
    roomId: params.roomId,
    playerId: params.playerId,
    ...(params.seed === undefined || params.seed.trim() === ""
      ? {}
      : { seed: params.seed }),
    timestampMs: Date.now()
  };
}

export function buildSetReadyMessage(params: {
  roomId: RoomId;
  playerId: PlayerId;
  ready: boolean;
  requestId?: string;
}): ClientSetReadyMessage {
  return {
    protocolVersion: PROTOCOL_VERSION,
    type: "set-ready",
    requestId: params.requestId ?? createRequestId("ready"),
    roomId: params.roomId,
    playerId: params.playerId,
    ready: params.ready,
    timestampMs: Date.now()
  };
}

export function buildRenamePlayerMessage(params: {
  roomId: RoomId;
  playerId: PlayerId;
  nickname: string;
  requestId?: string;
}): ClientRenamePlayerMessage {
  return {
    protocolVersion: PROTOCOL_VERSION,
    type: "rename-player",
    requestId: params.requestId ?? createRequestId("rename"),
    roomId: params.roomId,
    playerId: params.playerId,
    nickname: params.nickname,
    timestampMs: Date.now()
  };
}

export function buildAddBotMessage(params: {
  roomId: RoomId;
  playerId: PlayerId;
  requestId?: string;
}): ClientAddBotMessage {
  return {
    protocolVersion: PROTOCOL_VERSION,
    type: "add-bot",
    requestId: params.requestId ?? createRequestId("add-bot"),
    roomId: params.roomId,
    playerId: params.playerId,
    timestampMs: Date.now()
  };
}

export function buildKickPlayerMessage(params: {
  roomId: RoomId;
  playerId: PlayerId;
  targetPlayerId: PlayerId;
  requestId?: string;
}): ClientKickPlayerMessage {
  return {
    protocolVersion: PROTOCOL_VERSION,
    type: "kick-player",
    requestId: params.requestId ?? createRequestId("kick"),
    roomId: params.roomId,
    playerId: params.playerId,
    targetPlayerId: params.targetPlayerId,
    timestampMs: Date.now()
  };
}

export function buildRestartGameMessage(params: {
  roomId: RoomId;
  playerId: PlayerId;
  seed?: string;
  requestId?: string;
}): ClientRestartGameMessage {
  return {
    protocolVersion: PROTOCOL_VERSION,
    type: "restart-game",
    requestId: params.requestId ?? createRequestId("restart"),
    roomId: params.roomId,
    playerId: params.playerId,
    ...(params.seed === undefined || params.seed.trim() === ""
      ? {}
      : { seed: params.seed }),
    timestampMs: Date.now()
  };
}

export function buildContinueGameMessage(params: {
  roomId: RoomId;
  playerId: PlayerId;
  requestId?: string;
}): ClientContinueGameMessage {
  return {
    protocolVersion: PROTOCOL_VERSION,
    type: "continue-game",
    requestId: params.requestId ?? createRequestId("continue"),
    roomId: params.roomId,
    playerId: params.playerId,
    timestampMs: Date.now()
  };
}

export function buildCommandMessage(params: {
  roomId: RoomId;
  playerId: PlayerId;
  command: ClientCommandInput;
  requestId?: string;
}): ClientCommandMessage {
  return {
    protocolVersion: PROTOCOL_VERSION,
    type: "command",
    requestId: params.requestId ?? createRequestId("command"),
    roomId: params.roomId,
    playerId: params.playerId,
    command: {
      ...params.command,
      playerId: params.playerId,
      timestampMs: Date.now()
    } as GameCommand,
    timestampMs: Date.now()
  };
}

export function buildLeaveRoomMessage(params: {
  roomId: RoomId;
  playerId: PlayerId;
  requestId?: string;
}): ClientLeaveRoomMessage {
  return {
    protocolVersion: PROTOCOL_VERSION,
    type: "leave-room",
    requestId: params.requestId ?? createRequestId("leave"),
    roomId: params.roomId,
    playerId: params.playerId,
    timestampMs: Date.now()
  };
}

export function buildReconnectMessage(params: {
  roomId: RoomId;
  userId: string;
  requestId?: string;
}): ClientReconnectMessage {
  return {
    protocolVersion: PROTOCOL_VERSION,
    type: "reconnect",
    requestId: params.requestId ?? createRequestId("reconnect"),
    roomId: params.roomId,
    userId: params.userId,
    timestampMs: Date.now()
  };
}

export function buildPingMessage(requestId = createRequestId("ping")): ClientPingMessage {
  return {
    protocolVersion: PROTOCOL_VERSION,
    type: "ping",
    requestId,
    timestampMs: Date.now()
  };
}
