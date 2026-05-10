import type { ErrorEnvelope, ProtocolErrorCode } from "@thunder-uno/protocol";
import { PROTOCOL_VERSION } from "@thunder-uno/protocol";

export const GAME_SERVER_ERROR_CODES = [
  "room-not-found",
  "room-not-waiting",
  "room-not-playing",
  "room-full",
  "player-not-in-room",
  "not-room-owner",
  "game-not-started",
  "game-already-started",
  "invalid-player-count",
  "players-not-ready",
  "invalid-room-id",
  "room-id-taken",
  "invalid-nickname",
  "bot-not-allowed",
  "round-decision-not-available",
  "player-id-mismatch",
  "connection-not-found"
] as const satisfies readonly ProtocolErrorCode[];

export type GameServerErrorCode = (typeof GAME_SERVER_ERROR_CODES)[number];

export class GameServerError extends Error {
  readonly code: GameServerErrorCode;
  readonly roomId: string | undefined;

  constructor(code: GameServerErrorCode, message: string, roomId?: string) {
    super(message);
    this.name = "GameServerError";
    this.code = code;
    this.roomId = roomId;
  }
}

export function isGameServerError(error: unknown): error is GameServerError {
  return error instanceof GameServerError;
}

export function createServerErrorMessage(params: {
  code: GameServerErrorCode | ProtocolErrorCode;
  message: string;
  requestId?: string;
  roomId?: string;
}): ErrorEnvelope {
  return {
    protocolVersion: PROTOCOL_VERSION,
    type: "error",
    code: params.code,
    message: params.message,
    ...(params.requestId === undefined ? {} : { requestId: params.requestId }),
    ...(params.roomId === undefined ? {} : { roomId: params.roomId })
  };
}
