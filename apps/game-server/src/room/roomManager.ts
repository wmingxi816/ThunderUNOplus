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
  AddBotParams,
  AddBotResult,
  CreateRoomParams,
  CreateRoomResult,
  ContinueGameParams,
  ContinueGameResult,
  JoinRoomParams,
  JoinRoomResult,
  KickPlayerParams,
  KickPlayerResult,
  LeaveRoomParams,
  LeaveRoomResult,
  ReconnectPlayerParams,
  ReconnectPlayerResult,
  RenamePlayerParams,
  RenamePlayerResult,
  RestartGameParams,
  RestartGameResult,
  RoomRuntime,
  SetPlayerReadyParams,
  SetPlayerReadyResult,
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
const MAX_PLAYER_NICKNAME_LENGTH = 10;
const BOT_FORGET_UNO_RATE = 0.2;
const CUSTOM_ROOM_ID_PATTERN = /^\d{6}$/;
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

    const roomId = this.resolveNewRoomId(params.roomId);
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
      botState: {
        lastUnanswerableColorByPlayerId: {}
      },
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

    const existingPlayer = room.players.find(
      (player) => player.userId === params.userId
    );

    if (existingPlayer !== undefined) {
      this.restoreExistingRoomPlayer(room, existingPlayer, params);

      return {
        room,
        player: existingPlayer,
        reconnected: true
      };
    }

    if (room.status !== "waiting") {
      throw new GameServerError(
        "room-not-waiting",
        `Room ${params.roomId} is not waiting for players.`,
        params.roomId
      );
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
    player.isReady = false;

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
        room.players[0]!.isReady = true;
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

    if (params.markLeft === true && room.ownerPlayerId === player.playerId) {
      this.transferRoomOwnerAfterLeave(room, player.playerId);

      if (room.gameState !== null && this.hasRoundDecisionReason(room) && this.canAutoContinueRoom(room)) {
        this.continueRoomFromRoundDecision(room);
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

    const unreadyPlayers = room.players.filter((player) => {
      return player.playerId !== room.ownerPlayerId && !player.isReady;
    });

    if (unreadyPlayers.length > 0) {
      throw new GameServerError(
        "players-not-ready",
        `Players not ready: ${unreadyPlayers.map((player) => player.nickname).join(", ")}.`,
        params.roomId
      );
    }

    this.startNewGameForRoom(room, params.seed);

    return {
      room
    };
  }

  restartGame(params: RestartGameParams): RestartGameResult {
    const room = this.getRequiredRoom(params.roomId);
    this.assertRoomOwner(room, params.playerId);

    if (room.gameState === null) {
      throw new GameServerError(
        "game-not-started",
        `Room ${params.roomId} has no game to restart.`,
        params.roomId
      );
    }

    if (!this.hasRoundDecisionReason(room)) {
      throw new GameServerError(
        "round-decision-not-available",
        `Room ${params.roomId} cannot be restarted yet.`,
        params.roomId
      );
    }

    this.pruneLeftPlayersBeforeRestart(room);
    this.startNewGameForRoom(room, params.seed);

    return { room };
  }

  continueGame(params: ContinueGameParams): ContinueGameResult {
    const room = this.getRequiredRoom(params.roomId);
    this.assertRoomOwner(room, params.playerId);
    this.continueRoomFromRoundDecision(room);

    return { room };
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

  private restoreExistingRoomPlayer(
    room: RoomRuntime,
    player: ServerRoomPlayer,
    params: JoinRoomParams
  ): void {
    player.connectionId = params.connectionId;
    player.connected = true;
    player.hasLeftRoom = false;
    player.isReady =
      player.playerId === room.ownerPlayerId ? true : player.isReady;
    player.nickname = this.normalizeNickname(params.nickname, room.roomId);
    player.avatarUrl = params.avatarUrl ?? player.avatarUrl;

    const gamePlayer = room.gameState?.players.find(
      (candidate) => candidate.id === player.playerId
    );

    if (gamePlayer !== undefined) {
      gamePlayer.hasLeftRoom = false;
      gamePlayer.displayName = player.nickname;
      gamePlayer.avatarUrl = player.avatarUrl;
      room.gameState!.snapshotVersion += 1;
      room.snapshotVersion = room.gameState!.snapshotVersion;
    }

    room.updatedAt = this.now();

    this.connectionRegistry.bindPlayer(
      params.connectionId,
      room.roomId,
      player.playerId,
      params.userId
    );
  }

  setPlayerReady(params: SetPlayerReadyParams): SetPlayerReadyResult {
    const room = this.getRequiredRoom(params.roomId);

    if (room.status !== "waiting") {
      throw new GameServerError(
        "room-not-waiting",
        `Room ${params.roomId} is not waiting for players.`,
        params.roomId
      );
    }

    const player = room.players.find((candidate) => candidate.playerId === params.playerId);

    if (player === undefined) {
      throw new GameServerError(
        "player-not-in-room",
        `Player ${params.playerId} does not belong to room ${params.roomId}.`,
        params.roomId
      );
    }

    player.isReady = player.playerId === room.ownerPlayerId ? true : params.ready;
    room.updatedAt = this.now();

    return {
      room,
      player
    };
  }

  renamePlayer(params: RenamePlayerParams): RenamePlayerResult {
    const room = this.getRequiredRoom(params.roomId);
    const player = room.players.find((candidate) => candidate.playerId === params.playerId);

    if (player === undefined) {
      throw new GameServerError(
        "player-not-in-room",
        `Player ${params.playerId} does not belong to room ${params.roomId}.`,
        params.roomId
      );
    }

    if (player.isBot) {
      throw new GameServerError(
        "bot-not-allowed",
        "Bot players cannot be renamed through the player rename endpoint.",
        params.roomId
      );
    }

    const nickname = this.normalizeNickname(params.nickname, params.roomId);

    player.nickname = nickname;

    const gamePlayer = room.gameState?.players.find(
      (candidate) => candidate.id === params.playerId
    );

    if (gamePlayer !== undefined) {
      gamePlayer.displayName = nickname;
      room.gameState!.snapshotVersion += 1;
      room.snapshotVersion = room.gameState!.snapshotVersion;
    }

    room.updatedAt = this.now();

    return {
      room,
      player
    };
  }

  addBot(params: AddBotParams): AddBotResult {
    const room = this.getRequiredRoom(params.roomId);
    this.assertRoomOwner(room, params.playerId);

    if (room.status !== "waiting") {
      throw new GameServerError(
        "room-not-waiting",
        `Room ${params.roomId} is not waiting for players.`,
        params.roomId
      );
    }

    if (room.mode !== "no-challenge") {
      throw new GameServerError(
        "bot-not-allowed",
        "Bots can only be added in no-challenge mode.",
        params.roomId
      );
    }

    if (room.players.length >= MAX_ROOM_PLAYER_COUNT) {
      throw new GameServerError(
        "room-full",
        `Room ${params.roomId} is already full.`,
        params.roomId
      );
    }

    const joinedAt = this.now();
    const botIndex = room.players.filter((player) => player.isBot).length + 1;
    const isChaosBot = params.botType === "chaos";
    const strategy = isChaosBot ? "chaos-v1" : "greedy-v1";
    const botBaseName = isChaosBot ? "混沌bot" : "最强bot";
    const botTypeIndex = room.players.filter(
      (player) => player.isBot && player.botProfile?.strategy === strategy
    ).length + 1;
    const botPlayer: ServerRoomPlayer = {
      userId: `bot-${room.roomId}-${String(botIndex)}`,
      playerId: this.createPlayerId(),
      connectionId: null,
      seatIndex: room.players.length,
      nickname: `${botBaseName}${String(botTypeIndex)}`,
      avatarUrl: this.resolveAvatarUrl(room.players, null),
      connected: true,
      hasLeftRoom: false,
      isReady: true,
      joinedAt,
      isBot: true,
      botProfile: {
        strategy,
        forgetUnoRate: BOT_FORGET_UNO_RATE
      }
    };

    room.players.push(botPlayer);
    room.updatedAt = joinedAt;

    return {
      room,
      botPlayer
    };
  }

  kickPlayer(params: KickPlayerParams): KickPlayerResult {
    const room = this.getRequiredRoom(params.roomId);
    this.assertRoomOwner(room, params.playerId);

    if (room.status !== "waiting") {
      throw new GameServerError(
        "room-not-waiting",
        `Room ${params.roomId} is not waiting for players.`,
        params.roomId
      );
    }

    if (params.targetPlayerId === room.ownerPlayerId) {
      throw new GameServerError(
        "not-room-owner",
        "The room owner cannot be kicked from the lobby.",
        params.roomId
      );
    }

    const playerIndex = room.players.findIndex(
      (player) => player.playerId === params.targetPlayerId
    );

    if (playerIndex === -1) {
      throw new GameServerError(
        "player-not-in-room",
        `Player ${params.targetPlayerId} does not belong to room ${params.roomId}.`,
        params.roomId
      );
    }

    const [removedPlayer] = room.players.splice(playerIndex, 1);

    if (removedPlayer === undefined) {
      throw new GameServerError(
        "player-not-in-room",
        `Player ${params.targetPlayerId} does not belong to room ${params.roomId}.`,
        params.roomId
      );
    }

    if (removedPlayer.connectionId !== null) {
      this.connectionRegistry.unbindConnection(removedPlayer.connectionId);
    }

    this.reindexSeats(room.players);
    room.updatedAt = this.now();

    return {
      room,
      removedPlayerId: removedPlayer.playerId,
      removedConnectionId: removedPlayer.connectionId,
      roomDeleted: false
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

  private assertRoomOwner(room: RoomRuntime, playerId: string): void {
    if (room.ownerPlayerId !== playerId) {
      throw new GameServerError(
        "not-room-owner",
        `Player ${playerId} is not the room owner.`,
        room.roomId
      );
    }
  }

  private resolveNewRoomId(requestedRoomId: string | undefined): string {
    if (requestedRoomId === undefined) {
      return this.createRoomId(new Set(this.rooms.keys()));
    }

    if (!CUSTOM_ROOM_ID_PATTERN.test(requestedRoomId)) {
      throw new GameServerError(
        "invalid-room-id",
        "Custom room id must be exactly 6 digits.",
        requestedRoomId
      );
    }

    if (this.rooms.has(requestedRoomId)) {
      throw new GameServerError(
        "room-id-taken",
        `Room id ${requestedRoomId} is already taken.`,
        requestedRoomId
      );
    }

    return requestedRoomId;
  }

  private startNewGameForRoom(room: RoomRuntime, seed?: string | number): void {
    const nextSnapshotVersion = room.snapshotVersion + 1;
    const now = this.now();

    for (const player of room.players) {
      player.isReady = player.playerId === room.ownerPlayerId;
      player.hasLeftRoom = false;
    }

    room.gameState = createInitialGame({
      roomId: room.roomId,
      players: this.getPlayersInSeatOrder(room.players).map((player) => {
        return {
          id: player.playerId,
          displayName: player.nickname,
          avatarUrl: player.avatarUrl,
          isBot: player.isBot
        };
      }),
      mode: room.mode,
      now,
      snapshotVersion: nextSnapshotVersion,
      ...(seed === undefined ? {} : { seed })
    });
    room.botState.lastUnanswerableColorByPlayerId = {};
    room.status = "playing";
    room.snapshotVersion = room.gameState.snapshotVersion;
    room.updatedAt = now;
  }

  private pruneLeftPlayersBeforeRestart(room: RoomRuntime): void {
    const leftPlayerIds = new Set(
      room.players
        .filter((player) => player.hasLeftRoom)
        .map((player) => player.playerId)
    );

    if (leftPlayerIds.size === 0) {
      return;
    }

    const keptPlayers = room.players.filter((player) => !leftPlayerIds.has(player.playerId));
    if (
      keptPlayers.length < MIN_ROOM_PLAYER_COUNT ||
      keptPlayers.length > MAX_ROOM_PLAYER_COUNT
    ) {
      throw new GameServerError(
        "invalid-player-count",
        `Room ${room.roomId} must have between 3 and 8 active players to restart.`,
        room.roomId
      );
    }

    room.players = keptPlayers;
    this.reindexSeats(room.players);

    if (!room.players.some((player) => player.playerId === room.ownerPlayerId)) {
      room.ownerPlayerId = room.players[0]?.playerId ?? room.ownerPlayerId;
    }
  }

  private hasRoundDecisionReason(room: RoomRuntime): boolean {
    const gameState = room.gameState;

    if (gameState === null) {
      return false;
    }

    const legacyRoundDecisionReason =
      gameState.status === "finished" ||
      gameState.players.some(
        (player) => !player.hasLeftRoom && (player.isEliminated || player.isRoundWinner)
      );

    if (typeof gameState.roundDecisionPending === "boolean") {
      return gameState.roundDecisionPending || legacyRoundDecisionReason;
    }

    return legacyRoundDecisionReason;
  }

  private continueRoomFromRoundDecision(room: RoomRuntime): void {
    if (room.gameState === null) {
      throw new GameServerError(
        "game-not-started",
        `Room ${room.roomId} has no game to continue.`,
        room.roomId
      );
    }

    if (!this.hasRoundDecisionReason(room)) {
      throw new GameServerError(
        "round-decision-not-available",
        `Room ${room.roomId} cannot be continued yet.`,
        room.roomId
      );
    }

    const gameState = room.gameState;
    const now = this.now();
    const activePlayerCount = gameState.players.filter(
      (player) => !player.isEliminated && !player.isRoundWinner && !player.hasLeftRoom
    ).length;

    if (activePlayerCount < 2) {
      throw new GameServerError(
        "invalid-player-count",
        `Room ${room.roomId} does not have enough active players to continue.`,
        room.roomId
      );
    }

    gameState.now = now;

    if (gameState.status === "finished") {
      gameState.status = "in-progress";
    }

    gameState.roundDecisionPending = false;
    room.botState.lastUnanswerableColorByPlayerId = {};

    const currentPlayer = gameState.players.find(
      (player) => player.id === gameState.currentPlayerId
    );

    if (
      currentPlayer === undefined ||
      currentPlayer.isEliminated ||
      currentPlayer.isRoundWinner ||
      currentPlayer.hasLeftRoom
    ) {
      const nextPlayerId = this.getNextRoomActivePlayerId(gameState.currentPlayerId, gameState);

      if (nextPlayerId !== null) {
        gameState.currentPlayerId = nextPlayerId;
      }
    }

    gameState.snapshotVersion += 1;
    room.status = "playing";
    room.snapshotVersion = gameState.snapshotVersion;
    room.updatedAt = now;
  }

  private canAutoContinueRoom(room: RoomRuntime): boolean {
    if (room.gameState === null) {
      return false;
    }

    const activePlayerCount = room.gameState.players.filter(
      (player) => !player.isEliminated && !player.isRoundWinner && !player.hasLeftRoom
    ).length;

    return activePlayerCount >= 2;
  }

  private transferRoomOwnerAfterLeave(room: RoomRuntime, removedPlayerId: string): void {
    const nextOwner = this.getPlayersInSeatOrder(room.players).find((player) => {
      return player.playerId !== removedPlayerId && !player.hasLeftRoom;
    });

    if (nextOwner === undefined) {
      return;
    }

    room.ownerPlayerId = nextOwner.playerId;
    nextOwner.isReady = true;
  }

  private getNextRoomActivePlayerId(
    fromPlayerId: string,
    gameState: NonNullable<RoomRuntime["gameState"]>
  ): string | null {
    const startIndex = gameState.playerOrder.indexOf(fromPlayerId);

    if (startIndex < 0) {
      return gameState.players.find(
        (player) => !player.isEliminated && !player.isRoundWinner && !player.hasLeftRoom
      )?.id ?? null;
    }

    const delta = gameState.direction === "clockwise" ? 1 : -1;
    let cursor = startIndex;

    for (let index = 0; index < gameState.playerOrder.length; index += 1) {
      cursor =
        (cursor + delta + gameState.playerOrder.length) % gameState.playerOrder.length;
      const playerId = gameState.playerOrder[cursor];
      const player = gameState.players.find((candidate) => candidate.id === playerId);

      if (
        player !== undefined &&
        !player.isEliminated &&
        !player.isRoundWinner &&
        !player.hasLeftRoom
      ) {
        return player.id;
      }
    }

    return null;
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
    const nickname = this.normalizeNickname(params.nickname);

    return {
      userId: params.userId,
      playerId: this.createPlayerId(),
      connectionId: params.connectionId,
      seatIndex: params.seatIndex,
      nickname,
      avatarUrl: params.avatarUrl,
      connected: true,
      hasLeftRoom: false,
      isReady: params.seatIndex === 0,
      joinedAt: params.joinedAt,
      isBot: false
    };
  }

  private normalizeNickname(nickname: string, roomId?: string): string {
    const trimmed = nickname.trim();
    const nicknameLength = Array.from(trimmed).length;

    if (nicknameLength === 0 || nicknameLength > MAX_PLAYER_NICKNAME_LENGTH) {
      throw new GameServerError(
        "invalid-nickname",
        `Nickname must be between 1 and ${String(MAX_PLAYER_NICKNAME_LENGTH)} characters.`,
        roomId
      );
    }

    return trimmed;
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
