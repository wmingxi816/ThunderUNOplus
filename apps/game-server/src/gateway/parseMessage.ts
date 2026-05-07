import type {
  ClientCommandMessage,
  ClientContinueGameMessage,
  ClientCreateRoomMessage,
  ClientJoinRoomMessage,
  ClientLeaveRoomMessage,
  ClientMessage,
  ClientPingMessage,
  ClientReconnectMessage,
  ClientRestartGameMessage,
  ClientSetReadyMessage,
  ClientStartGameMessage
} from "@thunder-uno/protocol";
import { PROTOCOL_VERSION } from "@thunder-uno/protocol";
import type { GameMode } from "@thunder-uno/shared-types";
import type { RawData } from "ws";

const CLIENT_MESSAGE_TYPES = new Set<ClientMessage["type"]>([
  "ping",
  "create-room",
  "join-room",
  "start-game",
  "set-ready",
  "restart-game",
  "continue-game",
  "leave-room",
  "command",
  "reconnect"
]);

export class ParseMessageError extends Error {
  readonly code:
    | "invalid-message"
    | "invalid-command-envelope"
    | "protocol-version-mismatch";

  constructor(
    code:
      | "invalid-message"
      | "invalid-command-envelope"
      | "protocol-version-mismatch",
    message: string
  ) {
    super(message);
    this.name = "ParseMessageError";
    this.code = code;
  }
}

export function parseMessage(rawMessage: RawData): ClientMessage {
  const parsed = parseJson(rawMessage);

  if (!isRecord(parsed)) {
    throw new ParseMessageError("invalid-message", "Client message must be a JSON object.");
  }

  const protocolVersion = requireString(parsed, "protocolVersion");

  if (protocolVersion !== PROTOCOL_VERSION) {
    throw new ParseMessageError(
      "protocol-version-mismatch",
      `Unsupported protocol version: ${protocolVersion}.`
    );
  }

  const type = requireString(parsed, "type");

  if (!isClientMessageType(type)) {
    throw new ParseMessageError("invalid-message", `Unknown client message type: ${type}.`);
  }

  switch (type) {
    case "ping":
      return parsePingMessage(parsed);
    case "create-room":
      return parseCreateRoomMessage(parsed);
    case "join-room":
      return parseJoinRoomMessage(parsed);
    case "start-game":
      return parseStartGameMessage(parsed);
    case "set-ready":
      return parseSetReadyMessage(parsed);
    case "restart-game":
      return parseRestartGameMessage(parsed);
    case "continue-game":
      return parseContinueGameMessage(parsed);
    case "leave-room":
      return parseLeaveRoomMessage(parsed);
    case "command":
      return parseCommandMessage(parsed);
    case "reconnect":
      return parseReconnectMessage(parsed);
    default: {
      const exhaustiveCheck: never = type;
      throw new ParseMessageError(
        "invalid-message",
        `Unsupported client message type: ${String(exhaustiveCheck)}.`
      );
    }
  }
}

function parseJson(rawMessage: RawData): unknown {
  const rawText = normalizeRawMessage(rawMessage);

  try {
    return JSON.parse(rawText);
  } catch {
    throw new ParseMessageError("invalid-message", "Client message is not valid JSON.");
  }
}

function normalizeRawMessage(rawMessage: RawData): string {
  if (typeof rawMessage === "string") {
    return rawMessage;
  }

  if (rawMessage instanceof ArrayBuffer) {
    return Buffer.from(rawMessage).toString("utf8");
  }

  if (Array.isArray(rawMessage)) {
    return Buffer.concat(rawMessage).toString("utf8");
  }

  return rawMessage.toString("utf8");
}

function parsePingMessage(record: Record<string, unknown>): ClientPingMessage {
  return {
    protocolVersion: PROTOCOL_VERSION,
    type: "ping",
    requestId: requireString(record, "requestId"),
    timestampMs: requireNumber(record, "timestampMs")
  };
}

function parseCreateRoomMessage(
  record: Record<string, unknown>
): ClientCreateRoomMessage {
  return {
    protocolVersion: PROTOCOL_VERSION,
    type: "create-room",
    requestId: requireString(record, "requestId"),
    userId: requireString(record, "userId"),
    nickname: requireString(record, "nickname"),
    mode: requireGameMode(record, "mode"),
    timestampMs: requireNumber(record, "timestampMs"),
    ...readOptionalRoomId(record),
    ...readOptionalAvatarUrl(record)
  };
}

function parseJoinRoomMessage(
  record: Record<string, unknown>
): ClientJoinRoomMessage {
  return {
    protocolVersion: PROTOCOL_VERSION,
    type: "join-room",
    requestId: requireString(record, "requestId"),
    roomId: requireString(record, "roomId"),
    userId: requireString(record, "userId"),
    nickname: requireString(record, "nickname"),
    timestampMs: requireNumber(record, "timestampMs"),
    ...readOptionalAvatarUrl(record)
  };
}

function parseStartGameMessage(
  record: Record<string, unknown>
): ClientStartGameMessage {
  return {
    protocolVersion: PROTOCOL_VERSION,
    type: "start-game",
    requestId: requireString(record, "requestId"),
    roomId: requireString(record, "roomId"),
    playerId: requireString(record, "playerId"),
    ...readOptionalSeed(record),
    timestampMs: requireNumber(record, "timestampMs")
  };
}

function parseSetReadyMessage(record: Record<string, unknown>): ClientSetReadyMessage {
  return {
    protocolVersion: PROTOCOL_VERSION,
    type: "set-ready",
    requestId: requireString(record, "requestId"),
    roomId: requireString(record, "roomId"),
    playerId: requireString(record, "playerId"),
    ready: requireBoolean(record, "ready"),
    timestampMs: requireNumber(record, "timestampMs")
  };
}

function parseRestartGameMessage(
  record: Record<string, unknown>
): ClientRestartGameMessage {
  return {
    protocolVersion: PROTOCOL_VERSION,
    type: "restart-game",
    requestId: requireString(record, "requestId"),
    roomId: requireString(record, "roomId"),
    playerId: requireString(record, "playerId"),
    ...readOptionalSeed(record),
    timestampMs: requireNumber(record, "timestampMs")
  };
}

function parseContinueGameMessage(
  record: Record<string, unknown>
): ClientContinueGameMessage {
  return {
    protocolVersion: PROTOCOL_VERSION,
    type: "continue-game",
    requestId: requireString(record, "requestId"),
    roomId: requireString(record, "roomId"),
    playerId: requireString(record, "playerId"),
    timestampMs: requireNumber(record, "timestampMs")
  };
}

function parseLeaveRoomMessage(
  record: Record<string, unknown>
): ClientLeaveRoomMessage {
  return {
    protocolVersion: PROTOCOL_VERSION,
    type: "leave-room",
    requestId: requireString(record, "requestId"),
    roomId: requireString(record, "roomId"),
    playerId: requireString(record, "playerId"),
    timestampMs: requireNumber(record, "timestampMs")
  };
}

function parseCommandMessage(
  record: Record<string, unknown>
): ClientCommandMessage {
  const command = record.command;

  if (!isRecord(command) || typeof command.type !== "string" || typeof command.playerId !== "string") {
    throw new ParseMessageError(
      "invalid-command-envelope",
      "Command envelope must contain a valid command object."
    );
  }

  return {
    protocolVersion: PROTOCOL_VERSION,
    type: "command",
    requestId: requireString(record, "requestId"),
    roomId: requireString(record, "roomId"),
    playerId: requireString(record, "playerId"),
    command: command as unknown as ClientCommandMessage["command"],
    timestampMs: requireNumber(record, "timestampMs")
  };
}

function parseReconnectMessage(
  record: Record<string, unknown>
): ClientReconnectMessage {
  return {
    protocolVersion: PROTOCOL_VERSION,
    type: "reconnect",
    requestId: requireString(record, "requestId"),
    roomId: requireString(record, "roomId"),
    userId: requireString(record, "userId"),
    timestampMs: requireNumber(record, "timestampMs")
  };
}

function readOptionalAvatarUrl(
  record: Record<string, unknown>
): { avatarUrl?: string | null } {
  const avatarUrl = record.avatarUrl;

  if (avatarUrl === undefined) {
    return {};
  }

  if (avatarUrl === null || typeof avatarUrl === "string") {
    return { avatarUrl };
  }

  throw new ParseMessageError("invalid-message", "avatarUrl must be a string or null.");
}

function readOptionalRoomId(
  record: Record<string, unknown>
): { roomId?: string } {
  const roomId = record.roomId;

  if (roomId === undefined) {
    return {};
  }

  if (typeof roomId === "string") {
    return { roomId };
  }

  throw new ParseMessageError("invalid-message", "roomId must be a string.");
}

function readOptionalSeed(
  record: Record<string, unknown>
): { seed?: string | number } {
  const seed = record.seed;

  if (seed === undefined) {
    return {};
  }

  if (typeof seed === "string" || typeof seed === "number") {
    return { seed };
  }

  throw new ParseMessageError("invalid-message", "seed must be a string or number.");
}

function requireString(record: Record<string, unknown>, key: string): string {
  const value = record[key];

  if (typeof value !== "string" || value.length === 0) {
    throw new ParseMessageError("invalid-message", `${key} must be a non-empty string.`);
  }

  return value;
}

function requireNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key];

  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ParseMessageError("invalid-message", `${key} must be a finite number.`);
  }

  return value;
}

function requireBoolean(record: Record<string, unknown>, key: string): boolean {
  const value = record[key];

  if (typeof value !== "boolean") {
    throw new ParseMessageError("invalid-message", `${key} must be a boolean.`);
  }

  return value;
}

function requireGameMode(
  record: Record<string, unknown>,
  key: string
): GameMode {
  const value = record[key];

  if (value === "with-challenge" || value === "no-challenge") {
    return value;
  }

  throw new ParseMessageError("invalid-message", `${key} must be a valid game mode.`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isClientMessageType(value: string): value is ClientMessage["type"] {
  return CLIENT_MESSAGE_TYPES.has(value as ClientMessage["type"]);
}
