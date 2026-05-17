import {
  PROTOCOL_VERSION,
  type ClientAddBotMessage,
  type ClientBattleChatMessage,
  type ClientCreateRoomMessage,
  type ClientContinueGameMessage,
  type ClientJoinRoomMessage,
  type ClientLobbyChatMessage,
  type ClientKickPlayerMessage,
  type ClientLeaveRoomMessage,
  type ClientMessage,
  type ClientReconnectMessage,
  type ClientRenamePlayerMessage,
  type ClientRestartGameMessage,
  type ClientSetReadyMessage,
  type ClientStartGameMessage
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
import type { BotScheduler } from "../bot/botScheduler";

export interface HandleClientMessageParams {
  connection: ServerConnection;
  rawMessage: RawData;
  roomManager: RoomManager;
  connectionRegistry: ConnectionRegistry;
  botScheduler?: BotScheduler | undefined;
}

const BATTLE_CHAT_MAX_LENGTH = 30;
const BATTLE_CHAT_COOLDOWN_MS = 3_000;
const LOBBY_CHAT_MAX_LENGTH = 30;
const LOBBY_CHAT_COOLDOWN_MS = 3_000;
const battleChatLastSentAtByPlayer = new Map<string, number>();
const lobbyChatLastSentAtByPlayer = new Map<string, number>();

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
      case "rename-player":
        handleRenamePlayer({ ...params, message });
        return { ok: true, messageType: "rename-player" };
      case "add-bot":
        handleAddBot({ ...params, message });
        return { ok: true, messageType: "add-bot" };
      case "kick-player":
        handleKickPlayer({ ...params, message });
        return { ok: true, messageType: "kick-player" };
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
        {
          const result = dispatchCommand({
            roomManager: params.roomManager,
            connectionRegistry: params.connectionRegistry,
            message
          });

          if (result.room !== null) {
            params.botScheduler?.scheduleRoom(result.room.roomId);
          }
        }
        return { ok: true, messageType: "command" };
      case "reconnect":
        handleReconnect({ ...params, message });
        return { ok: true, messageType: "reconnect" };
      case "battle-chat":
        handleBattleChat({ ...params, message });
        return { ok: true, messageType: "battle-chat" };
      case "lobby-chat":
        handleLobbyChat({ ...params, message });
        return { ok: true, messageType: "lobby-chat" };
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

function handleRenamePlayer(params: {
  connection: ServerConnection;
  message: ClientRenamePlayerMessage;
  roomManager: RoomManager;
  connectionRegistry: ConnectionRegistry;
}): void {
  const result = params.roomManager.renamePlayer({
    roomId: params.message.roomId,
    playerId: params.message.playerId,
    nickname: params.message.nickname
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

function handleAddBot(params: {
  connection: ServerConnection;
  message: ClientAddBotMessage;
  roomManager: RoomManager;
  connectionRegistry: ConnectionRegistry;
}): void {
  const result = params.roomManager.addBot({
    roomId: params.message.roomId,
    playerId: params.message.playerId
  });

  broadcastRoomState(
    result.room,
    params.connectionRegistry,
    params.message.requestId
  );
}

function handleKickPlayer(params: {
  connection: ServerConnection;
  message: ClientKickPlayerMessage;
  roomManager: RoomManager;
  connectionRegistry: ConnectionRegistry;
}): void {
  const result = params.roomManager.kickPlayer({
    roomId: params.message.roomId,
    playerId: params.message.playerId,
    targetPlayerId: params.message.targetPlayerId
  });

  if (result.removedConnectionId !== null) {
    params.connectionRegistry
      .getConnection(result.removedConnectionId)
      ?.send(createRoomClosedMessage(params.message.roomId, params.message.requestId));
  }

  if (result.room === null) {
    return;
  }

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
  botScheduler?: BotScheduler | undefined;
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

  params.botScheduler?.scheduleRoom(result.room.roomId);
}

function handleRestartGame(params: {
  connection: ServerConnection;
  message: ClientRestartGameMessage;
  roomManager: RoomManager;
  connectionRegistry: ConnectionRegistry;
  botScheduler?: BotScheduler | undefined;
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
  params.botScheduler?.scheduleRoom(result.room.roomId);
}

function handleContinueGame(params: {
  connection: ServerConnection;
  message: ClientContinueGameMessage;
  roomManager: RoomManager;
  connectionRegistry: ConnectionRegistry;
  botScheduler?: BotScheduler | undefined;
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
  params.botScheduler?.scheduleRoom(result.room.roomId);
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

function handleBattleChat(params: {
  connection: ServerConnection;
  message: ClientBattleChatMessage;
  roomManager: RoomManager;
  connectionRegistry: ConnectionRegistry;
}): void {
  const room = params.roomManager.getRoom(params.message.roomId);

  if (room === null) {
    params.connection.send(
      createServerErrorMessage({
        code: "room-not-found",
        message: "Room was not found.",
        requestId: params.message.requestId,
        roomId: params.message.roomId
      })
    );
    return;
  }

  if (room.status !== "playing" || room.gameState === null) {
    params.connection.send(
      createServerErrorMessage({
        code: "room-not-playing",
        message: `Room ${room.roomId} is not currently playing.`,
        requestId: params.message.requestId,
        roomId: room.roomId
      })
    );
    return;
  }

  const roomPlayer = room.players.find((player) => player.playerId === params.message.playerId);

  if (roomPlayer === undefined) {
    params.connection.send(
      createServerErrorMessage({
        code: "player-not-in-room",
        message: `Player ${params.message.playerId} does not belong to room ${room.roomId}.`,
        requestId: params.message.requestId,
        roomId: room.roomId
      })
    );
    return;
  }

  const trimmedText = params.message.text.trim();

  if (trimmedText.length === 0 || trimmedText.length > BATTLE_CHAT_MAX_LENGTH) {
    params.connection.send(
      createServerErrorMessage({
        code: "invalid-message",
        message: `Battle chat text must be between 1 and ${String(BATTLE_CHAT_MAX_LENGTH)} characters.`,
        requestId: params.message.requestId,
        roomId: room.roomId
      })
    );
    return;
  }

  const cooldownKey = `${room.roomId}:${params.message.playerId}`;
  const lastSentAt = battleChatLastSentAtByPlayer.get(cooldownKey) ?? 0;
  const now = Date.now();

  if (now - lastSentAt < BATTLE_CHAT_COOLDOWN_MS) {
    params.connection.send(
      createServerErrorMessage({
        code: "invalid-message",
        message: "Battle chat is cooling down.",
        requestId: params.message.requestId,
        roomId: room.roomId
      })
    );
    return;
  }

  battleChatLastSentAtByPlayer.set(cooldownKey, now);

  params.connectionRegistry.sendToRoom(room.roomId, {
    protocolVersion: PROTOCOL_VERSION,
    type: "battle-chat",
    requestId: params.message.requestId,
    roomId: room.roomId,
    playerId: params.message.playerId,
    text: trimmedText,
    timestampMs: params.message.timestampMs
  });
}

function handleLobbyChat(params: {
  connection: ServerConnection;
  message: ClientLobbyChatMessage;
  roomManager: RoomManager;
  connectionRegistry: ConnectionRegistry;
}): void {
  const room = params.roomManager.getRoom(params.message.roomId);

  if (room === null) {
    params.connection.send(
      createServerErrorMessage({
        code: "room-not-found",
        message: "Room was not found.",
        requestId: params.message.requestId,
        roomId: params.message.roomId
      })
    );
    return;
  }

  const roomPlayer = room.players.find((player) => player.playerId === params.message.playerId);

  if (roomPlayer === undefined) {
    params.connection.send(
      createServerErrorMessage({
        code: "player-not-in-room",
        message: `Player ${params.message.playerId} does not belong to room ${room.roomId}.`,
        requestId: params.message.requestId,
        roomId: room.roomId
      })
    );
    return;
  }

  const trimmedText = params.message.text.trim();

  if (trimmedText.length === 0 || trimmedText.length > LOBBY_CHAT_MAX_LENGTH) {
    params.connection.send(
      createServerErrorMessage({
        code: "invalid-message",
        message: `Lobby chat text must be between 1 and ${String(LOBBY_CHAT_MAX_LENGTH)} characters.`,
        requestId: params.message.requestId,
        roomId: room.roomId
      })
    );
    return;
  }

  const cooldownKey = `${room.roomId}:${params.message.playerId}`;
  const lastSentAt = lobbyChatLastSentAtByPlayer.get(cooldownKey) ?? 0;
  const now = Date.now();

  if (now - lastSentAt < LOBBY_CHAT_COOLDOWN_MS) {
    params.connection.send(
      createServerErrorMessage({
        code: "invalid-message",
        message: "Lobby chat is cooling down.",
        requestId: params.message.requestId,
        roomId: room.roomId
      })
    );
    return;
  }

  lobbyChatLastSentAtByPlayer.set(cooldownKey, now);

  params.connectionRegistry.sendToRoom(room.roomId, {
    protocolVersion: PROTOCOL_VERSION,
    type: "lobby-chat",
    requestId: params.message.requestId,
    roomId: room.roomId,
    playerId: params.message.playerId,
    text: trimmedText,
    timestampMs: params.message.timestampMs
  });
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
