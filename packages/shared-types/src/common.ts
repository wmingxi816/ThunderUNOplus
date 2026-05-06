export type UnixMs = number;

export type RoomId = string;
export type RoomCode = string;
export type GameId = string;
export type PlayerId = string;
export type CardId = string;
export type RequestId = string;
export type EventId = string;
export type ShuffleSeed = string | number;

export const GAME_MODES = ["with-challenge", "no-challenge"] as const;
export type GameMode = (typeof GAME_MODES)[number];

export const ROOM_STATUSES = [
  "lobby",
  "starting",
  "playing",
  "settled",
  "closed"
] as const;
export type RoomStatus = (typeof ROOM_STATUSES)[number];

export const GAME_STATUSES = ["in-progress", "finished"] as const;
export type GameStatus = (typeof GAME_STATUSES)[number];

export const TURN_DIRECTIONS = ["clockwise", "counter-clockwise"] as const;
export type TurnDirection = (typeof TURN_DIRECTIONS)[number];

export const PLAYER_CONNECTION_STATUSES = [
  "connected",
  "reconnecting",
  "disconnected",
  "left"
] as const;
export type PlayerConnectionStatus =
  (typeof PLAYER_CONNECTION_STATUSES)[number];

export const PLAYER_ELIMINATION_REASONS = ["hand-limit"] as const;
export type PlayerEliminationReason =
  (typeof PLAYER_ELIMINATION_REASONS)[number];
