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
  joinedAt: UnixMs;
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
}

export interface LeaveRoomResult {
  room: RoomRuntime | null;
  removedPlayerId: string;
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

export interface ReconnectPlayerParams {
  roomId: string;
  userId: string;
  connectionId: string;
}

export interface ReconnectPlayerResult {
  room: RoomRuntime;
  player: ServerRoomPlayer;
}
