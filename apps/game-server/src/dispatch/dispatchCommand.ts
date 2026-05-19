import { applyCommand, type GameEvent } from "@thunder-uno/uno-core";
import type { ClientCommandMessage, ErrorEnvelope } from "@thunder-uno/protocol";
import type { CardColor } from "@thunder-uno/shared-types";
import {
  broadcastEvents,
  createEventEnvelope
} from "../broadcast/broadcastEvents";
import { sendSnapshotsToRoom } from "../broadcast/sendSnapshotsToRoom";
import { ConnectionRegistry } from "../connection/connectionRegistry";
import {
  createServerErrorMessage,
  type GameServerErrorCode
} from "../errors/serverErrors";
import { RoomManager } from "../room/roomManager";
import type { RoomRuntime } from "../room/roomTypes";

export interface DispatchCommandParams {
  roomManager: RoomManager;
  connectionRegistry: ConnectionRegistry;
  message: ClientCommandMessage;
  now?: () => number;
}

export interface DispatchCommandResult {
  ok: boolean;
  room: RoomRuntime | null;
  events: GameEvent[];
  snapshotVersion: number | null;
  rejected: boolean;
  error?: ErrorEnvelope;
}

/**
 * dispatch 层只做三件事：
 * - 房间 / 身份校验
 * - 调用 uno-core.applyCommand
 * - 广播 event 和裁剪后的 snapshot
 */
export function dispatchCommand(
  params: DispatchCommandParams
): DispatchCommandResult {
  const room = params.roomManager.getRoom(params.message.roomId);

  if (room === null) {
    return buildErrorResult(params, null, "room-not-found", "Room was not found.");
  }

  if (room.status === "waiting" || room.gameState === null) {
    return buildErrorResult(
      params,
      room,
      "game-not-started",
      `Room ${room.roomId} has not started a game yet.`
    );
  }

  if (room.status !== "playing") {
    return buildErrorResult(
      params,
      room,
      "room-not-playing",
      `Room ${room.roomId} is not currently playing.`
    );
  }

  const roomPlayer = room.players.find(
    (player) => player.playerId === params.message.playerId
  );

  if (roomPlayer === undefined) {
    return buildErrorResult(
      params,
      room,
      "player-not-in-room",
      `Player ${params.message.playerId} does not belong to room ${room.roomId}.`
    );
  }

  if (params.message.command.playerId !== params.message.playerId) {
    return buildErrorResult(
      params,
      room,
      "player-id-mismatch",
      "Envelope playerId and command.playerId must match."
    );
  }

  const previousState = room.gameState;
  const previousCurrentColor = previousState.currentColor;
  const previousCurrentPlayerId = previousState.currentPlayerId;
  const previousDrawStackActive = previousState.drawStack.active;
  const previousDrawUntilColorActive = previousState.drawUntilColor.active;
  const result = applyCommand(room.gameState, params.message.command);

  room.gameState = result.state;
  room.snapshotVersion = result.state.snapshotVersion;
  room.updatedAt = (params.now ?? Date.now)();

  if (result.state.status === "finished") {
    room.status = "finished";
  }

  const rejected = result.events.some((event) => event.type === "command-rejected");

  if (rejected) {
    const rejectionEnvelope = createEventEnvelope({
      room,
      events: result.events,
      requestId: params.message.requestId
    });

    params.connectionRegistry.sendToPlayer(params.message.playerId, rejectionEnvelope);

    return {
      ok: false,
      room,
      events: result.events,
      snapshotVersion: room.snapshotVersion,
      rejected: true
    };
  }

  updateBotStateMemory(room, params.message.command, {
    previousCurrentColor,
    previousCurrentPlayerId,
    previousDrawStackActive,
    previousDrawUntilColorActive
  });

  broadcastEvents({
    room,
    connectionRegistry: params.connectionRegistry,
    events: result.events,
    requestId: params.message.requestId
  });
  sendSnapshotsToRoom(room, params.connectionRegistry);

  return {
    ok: true,
    room,
    events: result.events,
    snapshotVersion: room.snapshotVersion,
    rejected: false
  };
}

function updateBotStateMemory(
  room: RoomRuntime,
  command: ClientCommandMessage["command"],
  previous: {
    previousCurrentColor: CardColor;
    previousCurrentPlayerId: string;
    previousDrawStackActive: boolean;
    previousDrawUntilColorActive: boolean;
  }
): void {
  const rememberedColor =
    room.botState.lastUnanswerableColorByPlayerId[command.playerId];

  if (
    command.type === "draw-card" &&
    !previous.previousDrawStackActive &&
    !previous.previousDrawUntilColorActive &&
    previous.previousCurrentPlayerId === command.playerId
  ) {
    room.botState.lastUnanswerableColorByPlayerId[command.playerId] =
      previous.previousCurrentColor;
    return;
  }

  if (
    command.type === "keep-drawn-card" &&
    !previous.previousDrawStackActive &&
    !previous.previousDrawUntilColorActive &&
    previous.previousCurrentPlayerId === command.playerId
  ) {
    room.botState.lastUnanswerableColorByPlayerId[command.playerId] =
      previous.previousCurrentColor;
    return;
  }

  if (
    rememberedColor !== undefined &&
    isColorAdvancingCommand(command.type) &&
    room.gameState !== null &&
    room.gameState.currentColor === rememberedColor
  ) {
    delete room.botState.lastUnanswerableColorByPlayerId[command.playerId];
  }
}

function isColorAdvancingCommand(
  commandType: ClientCommandMessage["command"]["type"]
): boolean {
  return (
    commandType === "play-card" ||
    commandType === "play-sequence" ||
    commandType === "play-multiple-number" ||
    commandType === "play-discard-same-color"
  );
}

function buildErrorResult(
  params: DispatchCommandParams,
  room: RoomRuntime | null,
  code: GameServerErrorCode,
  message: string
): DispatchCommandResult {
  const envelope = createServerErrorMessage({
    code,
    message,
    requestId: params.message.requestId,
    ...(room === null ? {} : { roomId: room.roomId })
  });

  params.connectionRegistry.sendToPlayer(params.message.playerId, envelope);

  return {
    ok: false,
    room,
    events: [],
    snapshotVersion: room?.snapshotVersion ?? null,
    rejected: false,
    error: envelope
  };
}
