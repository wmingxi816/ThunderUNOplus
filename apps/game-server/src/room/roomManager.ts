import {
  createInitialGame,
  markPlayerLeftRoom,
  type GameEvent
} from "@thunder-uno/uno-core";
import type { GameMode } from "@thunder-uno/shared-types";
import { createPlayerId as createDefaultPlayerId } from "../ids/createPlayerId";
import { createRoomId as createDefaultRoomId } from "../ids/createRoomId";
import { ConnectionRegistry } from "../connection/connectionRegistry";
import { GameServerError } from "../errors/serverErrors";
import type {
  CreateRoomParams,
  CreateRoomResult,
  JoinRoomParams,
  JoinRoomResult,
  LeaveRoomParams,
  LeaveRoomResult,
  ReconnectPlayerParams,
  ReconnectPlayerResult,
  RoomRuntime,
  ServerRoomPlayer,
  StartGameParams,
  StartGameResult
} from "./roomTypes";

interface RoomManagerOptions {
  connectionRegistry: ConnectionRegistry;
  now?: () => number;
  createRoomId?: (existingRoomIds: ReadonlySet<string>) => string;
  createPlayerId?: () => string;
}

const MIN_ROOM_PLAYER_COUNT = 3;
const MAX_ROOM_PLAYER_COUNT = 8;
const ROOM_AVATAR_POOL = Array.from(
  { length: MAX_ROOM_PLAYER_COUNT },
  (_, index) => `/avatars/avatar-${String(index + 1)}.png`
);

/**
 * RoomManager 是 Phase 3A 的服务端核心。
 * 它负责房间生命周期，但不自行判断出牌规则。
 */
export class RoomManager {
  private readonly rooms = new Map<string, RoomRuntime>();
  private readonly connectionRegistry: ConnectionRegistry;
  private readonly now: () => number;
  private readonly createRoomId: (existingRoomIds: ReadonlySet<string>) => string;
  private readonly createPlayerId: () => string;

  constructor(options: RoomManagerOptions) {
    this.connectionRegistry = options.connectionRegistry;
    this.now = options.now ?? Date.now;
    this.createRoomId =
      options.createRoomId ?? ((existingRoomIds) => createDefaultRoomId(existingRoomIds));
    this.createPlayerId = options.createPlayerId ?? createDefaultPlayerId;
  }

  createRoom(params: CreateRoomParams): CreateRoomResult {
    this.assertConnectionExists(params.connectionId);

    const roomId = this.createRoomId(new Set(this.rooms.keys()));
    const createdAt = this.now();
    const ownerPlayer = this.buildRoomPlayer({
      userId: params.userId,
      connectionId: params.connectionId,
      seatIndex: 0,
      nickname: params.nickname,
      avatarUrl: this.resolveAvatarUrl([], params.avatarUrl ?? null),
      joinedAt: createdAt
    });

    const room: RoomRuntime = {
      roomId,
      ownerPlayerId: ownerPlayer.playerId,
      status: "waiting",
      mode: params.mode,
      players: [ownerPlayer],
      gameState: null,
      snapshotVersion: 0,
      createdAt,
      updatedAt: createdAt
    };

    this.rooms.set(roomId, room);
    this.connectionRegistry.bindPlayer(
      params.connectionId,
      roomId,
      ownerPlayer.playerId,
      params.userId
    );

    return {
      room,
      ownerPlayer
    };
  }

  joinRoom(params: JoinRoomParams): JoinRoomResult {
    this.assertConnectionExists(params.connectionId);
    const room = this.getRequiredRoom(params.roomId);

    if (room.status !== "waiting") {
      throw new GameServerError(
        "room-not-waiting",
        `Room ${params.roomId} is not waiting for players.`,
        params.roomId
      );
    }

    const existingPlayer = room.players.find(
      (player) => player.userId === params.userId
    );

    if (existingPlayer !== undefined) {
      existingPlayer.connectionId = params.connectionId;
      existingPlayer.connected = true;
      existingPlayer.hasLeftRoom = false;
      existingPlayer.nickname = params.nickname;
      existingPlayer.avatarUrl = params.avatarUrl ?? existingPlayer.avatarUrl;
      room.updatedAt = this.now();

      this.connectionRegistry.bindPlayer(
        params.connectionId,
        room.roomId,
        existingPlayer.playerId,
        params.userId
      );

      return {
        room,
        player: existingPlayer,
        reconnected: true
      };
    }

    if (room.players.length >= MAX_ROOM_PLAYER_COUNT) {
      throw new GameServerError(
        "room-full",
        `Room ${params.roomId} is already full.`,
        params.roomId
      );
    }

    const player = this.buildRoomPlayer({
      userId: params.userId,
      connectionId: params.connectionId,
      seatIndex: room.players.length,
      nickname: params.nickname,
      avatarUrl: this.resolveAvatarUrl(room.players, params.avatarUrl ?? null),
      joinedAt: this.now()
    });

    room.players.push(player);
    room.updatedAt = this.now();

    this.connectionRegistry.bindPlayer(
      params.connectionId,
      room.roomId,
      player.playerId,
      params.userId
    );

    return {
      room,
      player,
      reconnected: false
    };
  }

  leaveRoom(params: LeaveRoomParams): LeaveRoomResult {
    const room = this.getRequiredRoom(params.roomId);
    const playerIndex = room.players.findIndex(
      (player) => player.playerId === params.playerId
    );

    if (playerIndex === -1) {
      throw new GameServerError(
        "player-not-in-room",
        `Player ${params.playerId} does not belong to room ${params.roomId}.`,
        params.roomId
      );
    }

    const player = room.players[playerIndex]!;

    if (room.status === "waiting") {
      room.players.splice(playerIndex, 1);

      if (player.connectionId !== null) {
        this.connectionRegistry.unbindConnection(player.connectionId);
      }

      this.reindexSeats(room.players);

      if (room.players.length === 0) {
        this.rooms.delete(room.roomId);
        return {
          room: null,
          removedPlayerId: player.playerId,
          roomDeleted: true
        };
      }

      // 等待房间里如果房主离开，就把房主转给 seatIndex 最小的剩余玩家。
      if (room.ownerPlayerId === player.playerId) {
        room.ownerPlayerId = room.players[0]!.playerId;
      }

      room.updatedAt = this.now();

      return {
        room,
        removedPlayerId: player.playerId,
        roomDeleted: false
      };
    }

    // 对局中保留座位；主动退出和断线重连是两个不同状态。
    player.connected = false;
    player.hasLeftRoom = params.markLeft === true;

    if (player.connectionId !== null) {
      this.connectionRegistry.unbindConnection(player.connectionId);
      player.connectionId = null;
    }

    if (params.markLeft === true && room.gameState !== null) {
      const events: GameEvent[] = [];
      room.gameState.now = this.now();
      markPlayerLeftRoom(room.gameState, player.playerId, events);
      room.gameState.snapshotVersion += 1;
      room.snapshotVersion = room.gameState.snapshotVersion;

      if (room.gameState.status === "finished") {
        room.status = "finished";
      }
    }

    room.updatedAt = this.now();

    return {
      room,
      removedPlayerId: player.playerId,
      roomDeleted: false
    };
  }

  startGame(params: StartGameParams): StartGameResult {
    const room = this.getRequiredRoom(params.roomId);

    if (room.status === "playing") {
      throw new GameServerError(
        "game-already-started",
        `Room ${params.roomId} is already playing.`,
        params.roomId
      );
    }

    if (room.ownerPlayerId !== params.playerId) {
      throw new GameServerError(
        "not-room-owner",
        `Player ${params.playerId} is not the room owner.`,
        params.roomId
      );
    }

    if (
      room.players.length < MIN_ROOM_PLAYER_COUNT ||
      room.players.length > MAX_ROOM_PLAYER_COUNT
    ) {
      throw new GameServerError(
        "invalid-player-count",
        `Room ${params.roomId} must have between 3 and 8 players to start.`,
        params.roomId
      );
    }

    const nextSnapshotVersion = room.snapshotVersion + 1;
    const now = this.now();

    room.gameState = createInitialGame({
      roomId: room.roomId,
      players: this.getPlayersInSeatOrder(room.players).map((player) => {
        return {
          id: player.playerId,
          displayName: player.nickname,
          avatarUrl: player.avatarUrl
        };
      }),
      mode: room.mode,
      now,
      snapshotVersion: nextSnapshotVersion,
      ...(params.seed === undefined ? {} : { seed: params.seed })
    });
    room.status = "playing";
    room.snapshotVersion = room.gameState.snapshotVersion;
    room.updatedAt = now;

    return {
      room
    };
  }

  reconnectPlayer(params: ReconnectPlayerParams): ReconnectPlayerResult {
    this.assertConnectionExists(params.connectionId);
    const room = this.getRequiredRoom(params.roomId);
    const player = room.players.find((candidate) => candidate.userId === params.userId);

    if (player === undefined) {
      throw new GameServerError(
        "player-not-in-room",
        `User ${params.userId} does not belong to room ${params.roomId}.`,
        params.roomId
      );
    }

    if (player.hasLeftRoom) {
      throw new GameServerError(
        "player-not-in-room",
        `User ${params.userId} has left room ${params.roomId}.`,
        params.roomId
      );
    }

    player.connectionId = params.connectionId;
    player.connected = true;
    room.updatedAt = this.now();

    this.connectionRegistry.bindPlayer(
      params.connectionId,
      room.roomId,
      player.playerId,
      player.userId
    );

    return {
      room,
      player
    };
  }

  getRoom(roomId: string): RoomRuntime | null {
    return this.rooms.get(roomId) ?? null;
  }

  deleteRoom(roomId: string): boolean {
    return this.rooms.delete(roomId);
  }

  listRooms(): RoomRuntime[] {
    return [...this.rooms.values()];
  }

  private assertConnectionExists(connectionId: string): void {
    if (this.connectionRegistry.getConnection(connectionId) === null) {
      throw new GameServerError(
        "connection-not-found",
        `Connection ${connectionId} was not found.`
      );
    }
  }

  private getRequiredRoom(roomId: string): RoomRuntime {
    const room = this.getRoom(roomId);

    if (room === null) {
      throw new GameServerError(
        "room-not-found",
        `Room ${roomId} was not found.`,
        roomId
      );
    }

    return room;
  }

  private buildRoomPlayer(params: {
    userId: string;
    connectionId: string;
    seatIndex: number;
    nickname: string;
    avatarUrl: string | null;
    joinedAt: number;
  }): ServerRoomPlayer {
    return {
      userId: params.userId,
      playerId: this.createPlayerId(),
      connectionId: params.connectionId,
      seatIndex: params.seatIndex,
      nickname: params.nickname,
      avatarUrl: params.avatarUrl,
      connected: true,
      hasLeftRoom: false,
      joinedAt: params.joinedAt
    };
  }

  private resolveAvatarUrl(
    players: readonly ServerRoomPlayer[],
    requestedAvatarUrl: string | null
  ): string | null {
    const usedAvatarUrls = new Set(
      players
        .map((player) => player.avatarUrl)
        .filter((avatarUrl): avatarUrl is string => avatarUrl !== null)
    );

    if (
      requestedAvatarUrl !== null &&
      ROOM_AVATAR_POOL.includes(requestedAvatarUrl) &&
      !usedAvatarUrls.has(requestedAvatarUrl)
    ) {
      return requestedAvatarUrl;
    }

    const availableAvatarUrls = ROOM_AVATAR_POOL.filter(
      (avatarUrl) => !usedAvatarUrls.has(avatarUrl)
    );

    if (availableAvatarUrls.length === 0) {
      return null;
    }

    return availableAvatarUrls[Math.floor(Math.random() * availableAvatarUrls.length)]!;
  }

  private getPlayersInSeatOrder(players: readonly ServerRoomPlayer[]): ServerRoomPlayer[] {
    return [...players].sort((left, right) => left.seatIndex - right.seatIndex);
  }

  private reindexSeats(players: ServerRoomPlayer[]): void {
    const orderedPlayers = this.getPlayersInSeatOrder(players);

    orderedPlayers.forEach((player, index) => {
      player.seatIndex = index;
    });
  }
}
