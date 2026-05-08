import type { GameState } from "@thunder-uno/uno-core";
import type { GameMode, PlayerId, RoomId, UnixMs } from "@thunder-uno/shared-types";

export const ROOM_RUNTIME_STATUSES = [
  "waiting",
  "playing",
  "finished"
] as const;

export type RoomRuntimeStatus = (typeof ROOM_RUNTIME_STATUSES)[number];

export interface ServerRoomPlayer {
  userId: string;
  playerId: PlayerId;
  connectionId: string | null;
  seatIndex: number;
  nickname: string;
  avatarUrl: string | null;
  connected: boolean;
  hasLeftRoom: boolean;
  isReady: boolean;
  joinedAt: UnixMs;
  isBot: boolean;
  botProfile?: {
    strategy: "greedy-v1";
    forgetUnoRate: number;
  };
}

export interface RoomRuntime {
  roomId: RoomId;
  ownerPlayerId: PlayerId;
  status: RoomRuntimeStatus;
  mode: GameMode;
  players: ServerRoomPlayer[];
  gameState: GameState | null;
  snapshotVersion: number;
  createdAt: UnixMs;
  updatedAt: UnixMs;
}

export interface CreateRoomParams {
  userId: string;
  connectionId: string;
  nickname: string;
  avatarUrl?: string | null;
  mode: GameMode;
  roomId?: string;
}

export interface CreateRoomResult {
  room: RoomRuntime;
  ownerPlayer: ServerRoomPlayer;
}

export interface JoinRoomParams {
  roomId: string;
  userId: string;
  connectionId: string;
  nickname: string;
  avatarUrl?: string | null;
}

export interface JoinRoomResult {
  room: RoomRuntime;
  player: ServerRoomPlayer;
  reconnected: boolean;
}

export interface LeaveRoomParams {
  roomId: string;
  playerId: string;
  markLeft?: boolean;
}

export interface LeaveRoomResult {
  room: RoomRuntime | null;
  removedPlayerId: string;
  roomDeleted: boolean;
}

export interface AddBotParams {
  roomId: string;
  playerId: string;
}

export interface AddBotResult {
  room: RoomRuntime;
  botPlayer: ServerRoomPlayer;
}

export interface KickPlayerParams {
  roomId: string;
  playerId: string;
  targetPlayerId: string;
}

export interface KickPlayerResult {
  room: RoomRuntime | null;
  removedPlayerId: string;
  removedConnectionId: string | null;
  roomDeleted: boolean;
}

export interface StartGameParams {
  roomId: string;
  playerId: string;
  seed?: string | number;
}

export interface StartGameResult {
  room: RoomRuntime;
}

export interface RestartGameParams {
  roomId: string;
  playerId: string;
  seed?: string | number;
}

export interface RestartGameResult {
  room: RoomRuntime;
}

export interface ContinueGameParams {
  roomId: string;
  playerId: string;
}

export interface ContinueGameResult {
  room: RoomRuntime;
}

export interface SetPlayerReadyParams {
  roomId: string;
  playerId: string;
  ready: boolean;
}

export interface SetPlayerReadyResult {
  room: RoomRuntime;
  player: ServerRoomPlayer;
}

export interface ReconnectPlayerParams {
  roomId: string;
  userId: string;
  connectionId: string;
}

export interface ReconnectPlayerResult {
  room: RoomRuntime;
  player: ServerRoomPlayer;
}
