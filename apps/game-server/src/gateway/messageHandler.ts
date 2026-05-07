import type {
  ClientCreateRoomMessage,
  ClientContinueGameMessage,
  ClientJoinRoomMessage,
  ClientLeaveRoomMessage,
  ClientMessage,
  ClientReconnectMessage,
  ClientRestartGameMessage,
  ClientSetReadyMessage,
  ClientStartGameMessage
} from "@thunder-uno/protocol";
import type { RawData } from "ws";
import { broadcastRoomState, createRoomClosedMessage, sendRoomStateToPlayer } from "../broadcast/broadcastRoomState";
import {
  createGameSnapshotEnvelope,
  sendSnapshotToPlayer,
  sendSnapshotsToRoom
} from "../broadcast/sendSnapshotsToRoom";
import { ConnectionRegistry } from "../connection/connectionRegistry";
import type { ServerConnection } from "../connection/connectionTypes";
import { dispatchCommand } from "../dispatch/dispatchCommand";
import {
  createServerErrorMessage,
  isGameServerError
} from "../errors/serverErrors";
import { handlePing } from "./heartbeat";
import { parseMessage, ParseMessageError } from "./parseMessage";
import { RoomManager } from "../room/roomManager";

export interface HandleClientMessageParams {
  connection: ServerConnection;
  rawMessage: RawData;
  roomManager: RoomManager;
  connectionRegistry: ConnectionRegistry;
}

/**
 * WebSocket 层只负责消息分发与生命周期，不在这里重写游戏规则。
 */
export function handleClientMessage(params: HandleClientMessageParams): {
  ok: boolean;
  messageType?: ClientMessage["type"];
} {
  try {
    const message = parseMessage(params.rawMessage);

    switch (message.type) {
      case "ping":
        handlePing(params.connection, message);
        return { ok: true, messageType: "ping" };
      case "create-room":
        handleCreateRoom({ ...params, message });
        return { ok: true, messageType: "create-room" };
      case "join-room":
        handleJoinRoom({ ...params, message });
        return { ok: true, messageType: "join-room" };
      case "start-game":
        handleStartGame({ ...params, message });
        return { ok: true, messageType: "start-game" };
      case "set-ready":
        handleSetReady({ ...params, message });
        return { ok: true, messageType: "set-ready" };
      case "restart-game":
        handleRestartGame({ ...params, message });
        return { ok: true, messageType: "restart-game" };
      case "continue-game":
        handleContinueGame({ ...params, message });
        return { ok: true, messageType: "continue-game" };
      case "leave-room":
        handleLeaveRoom({ ...params, message });
        return { ok: true, messageType: "leave-room" };
      case "command":
        dispatchCommand({
          roomManager: params.roomManager,
          connectionRegistry: params.connectionRegistry,
          message
        });
        return { ok: true, messageType: "command" };
      case "reconnect":
        handleReconnect({ ...params, message });
        return { ok: true, messageType: "reconnect" };
      default: {
        const exhaustiveCheck: never = message;
        throw new Error(`Unsupported client message: ${String(exhaustiveCheck)}.`);
      }
    }
  } catch (error) {
    const envelope = createServerErrorEnvelope(error);
    params.connection.send(envelope);
    return {
      ok: false
    };
  }
}

function handleCreateRoom(params: {
  connection: ServerConnection;
  message: ClientCreateRoomMessage;
  roomManager: RoomManager;
  connectionRegistry: ConnectionRegistry;
}): void {
  const result = params.roomManager.createRoom({
    userId: params.message.userId,
    connectionId: params.connection.connectionId,
    nickname: params.message.nickname,
    avatarUrl: params.message.avatarUrl ?? null,
    mode: params.message.mode,
    ...(params.message.roomId === undefined ? {} : { roomId: params.message.roomId })
  });

  broadcastRoomState(
    result.room,
    params.connectionRegistry,
    params.message.requestId
  );

  if (result.room.gameState !== null) {
    sendSnapshotsToRoom(result.room, params.connectionRegistry);
  }
}

function handleJoinRoom(params: {
  connection: ServerConnection;
  message: ClientJoinRoomMessage;
  roomManager: RoomManager;
  connectionRegistry: ConnectionRegistry;
}): void {
  const result = params.roomManager.joinRoom({
    roomId: params.message.roomId,
    userId: params.message.userId,
    connectionId: params.connection.connectionId,
    nickname: params.message.nickname,
    avatarUrl: params.message.avatarUrl ?? null
  });

  broadcastRoomState(
    result.room,
    params.connectionRegistry,
    params.message.requestId
  );

  if (result.room.gameState !== null) {
    sendSnapshotsToRoom(result.room, params.connectionRegistry);
  }
}

function handleSetReady(params: {
  connection: ServerConnection;
  message: ClientSetReadyMessage;
  roomManager: RoomManager;
  connectionRegistry: ConnectionRegistry;
}): void {
  const result = params.roomManager.setPlayerReady({
    roomId: params.message.roomId,
    playerId: params.message.playerId,
    ready: params.message.ready
  });

  broadcastRoomState(
    result.room,
    params.connectionRegistry,
    params.message.requestId
  );
}

function handleStartGame(params: {
  connection: ServerConnection;
  message: ClientStartGameMessage;
  roomManager: RoomManager;
  connectionRegistry: ConnectionRegistry;
}): void {
  const result = params.roomManager.startGame({
    roomId: params.message.roomId,
    playerId: params.message.playerId,
    ...(params.message.seed === undefined ? {} : { seed: params.message.seed })
  });

  params.connectionRegistry.bindPlayer(
    params.connection.connectionId,
    result.room.roomId,
    params.message.playerId,
    params.connection.userId
  );

  broadcastRoomState(
    result.room,
    params.connectionRegistry,
    params.message.requestId
  );
  sendSnapshotsToRoom(result.room, params.connectionRegistry);

  const registeredHostConnection = params.connectionRegistry.getConnectionByPlayerId(
    params.message.playerId
  );

  if (registeredHostConnection !== params.connection) {
    params.connection.send(createGameSnapshotEnvelope(result.room, params.message.playerId));
  }
}

function handleRestartGame(params: {
  connection: ServerConnection;
  message: ClientRestartGameMessage;
  roomManager: RoomManager;
  connectionRegistry: ConnectionRegistry;
}): void {
  const result = params.roomManager.restartGame({
    roomId: params.message.roomId,
    playerId: params.message.playerId,
    ...(params.message.seed === undefined ? {} : { seed: params.message.seed })
  });

  broadcastRoomState(
    result.room,
    params.connectionRegistry,
    params.message.requestId
  );
  sendSnapshotsToRoom(result.room, params.connectionRegistry);
}

function handleContinueGame(params: {
  connection: ServerConnection;
  message: ClientContinueGameMessage;
  roomManager: RoomManager;
  connectionRegistry: ConnectionRegistry;
}): void {
  const result = params.roomManager.continueGame({
    roomId: params.message.roomId,
    playerId: params.message.playerId
  });

  broadcastRoomState(
    result.room,
    params.connectionRegistry,
    params.message.requestId
  );
  sendSnapshotsToRoom(result.room, params.connectionRegistry);
}

function handleLeaveRoom(params: {
  connection: ServerConnection;
  message: ClientLeaveRoomMessage;
  roomManager: RoomManager;
  connectionRegistry: ConnectionRegistry;
}): void {
  const result = params.roomManager.leaveRoom({
    roomId: params.message.roomId,
    playerId: params.message.playerId,
    markLeft: true
  });

  if (result.room === null) {
    params.connection.send(
      createRoomClosedMessage(params.message.roomId, params.message.requestId)
    );
    return;
  }

  broadcastRoomState(
    result.room,
    params.connectionRegistry,
    params.message.requestId
  );

  if (result.room.gameState !== null) {
    sendSnapshotsToRoom(result.room, params.connectionRegistry);
  }
}

function handleReconnect(params: {
  connection: ServerConnection;
  message: ClientReconnectMessage;
  roomManager: RoomManager;
  connectionRegistry: ConnectionRegistry;
}): void {
  const result = params.roomManager.reconnectPlayer({
    roomId: params.message.roomId,
    userId: params.message.userId,
    connectionId: params.connection.connectionId
  });

  if (result.room.status === "waiting") {
    broadcastRoomState(
      result.room,
      params.connectionRegistry,
      params.message.requestId
    );
    return;
  }

  if (result.room.gameState !== null) {
    sendRoomStateToPlayer(
      result.room,
      params.connectionRegistry,
      result.player.playerId,
      params.message.requestId
    );
    sendSnapshotToPlayer(
      result.room,
      params.connectionRegistry,
      result.player.playerId
    );
    return;
  }

  sendRoomStateToPlayer(
    result.room,
    params.connectionRegistry,
    result.player.playerId,
    params.message.requestId
  );
}

function createServerErrorEnvelope(error: unknown) {
  if (error instanceof ParseMessageError) {
    return createServerErrorMessage({
      code: error.code,
      message: error.message
    });
  }

  if (isGameServerError(error)) {
    return createServerErrorMessage({
      code: error.code,
      message: error.message,
      ...(error.roomId === undefined ? {} : { roomId: error.roomId })
    });
  }

  return createServerErrorMessage({
    code: "invalid-message",
    message: error instanceof Error ? error.message : "Unknown server error."
  });
}
