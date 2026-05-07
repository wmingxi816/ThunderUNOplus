export const PROTOCOL_ERROR_CODES = [
  "invalid-message",
  "invalid-command-envelope",
  "room-not-found",
  "player-not-found",
  "snapshot-not-available",
  "protocol-version-mismatch",
  "room-not-waiting",
  "room-not-playing",
  "room-full",
  "player-not-in-room",
  "not-room-owner",
  "game-not-started",
  "game-already-started",
  "invalid-player-count",
  "players-not-ready",
  "player-id-mismatch",
  "connection-not-found"
] as const;

export type ProtocolErrorCode = (typeof PROTOCOL_ERROR_CODES)[number];
