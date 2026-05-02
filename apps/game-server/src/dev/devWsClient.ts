import { WebSocket } from "ws";
import {
  PROTOCOL_VERSION,
  type ClientCommandMessage,
  type ClientMessage,
  type ClientStartGameMessage,
  type ServerErrorMessage,
  type ServerEventsMessage,
  type ServerMessage,
  type ServerRoomStateMessage,
  type ServerSnapshotMessage
} from "@thunder-uno/protocol";
import type {
  GameCommand,
  GameMode,
  PlayerGameSnapshot,
  PlayerRoomSnapshot,
  ShuffleSeed
} from "@thunder-uno/shared-types";
import type { DevClientIdentity } from "./scenarioTypes";

type MessageListener = (message: ServerMessage) => void;

/**
 * Phase 3C 的开发客户端。
 *
 * 设计目标：
 * - 只通过真实 WebSocket 和服务端通信
 * - 只保存玩家快照和房间快照，不接触完整 GameState
 * - 对测试和本地联调都能复用
 */
export class DevWsClient {
  readonly wsUrl: string;
  readonly userId: string;
  readonly nickname: string;
  readonly avatarUrl: string | null;

  connection: WebSocket | null = null;
  roomId?: string;
  playerId?: string;
  latestRoomState?: PlayerRoomSnapshot;
  latestSnapshot?: PlayerGameSnapshot;
  readonly receivedMessages: ServerMessage[] = [];

  private readonly listeners = new Set<MessageListener>();
  private requestCounter = 0;

  constructor(params: DevClientIdentity & { wsUrl: string }) {
    this.wsUrl = params.wsUrl;
    this.userId = params.userId;
    this.nickname = params.nickname;
    this.avatarUrl = params.avatarUrl ?? null;
  }

  get isConnected(): boolean {
    return this.connection?.readyState === WebSocket.OPEN;
  }

  async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    const socket = new WebSocket(this.wsUrl);
    this.connection = socket;

    socket.on("message", (data) => {
      const message = JSON.parse(data.toString()) as ServerMessage;
      this.receivedMessages.push(message);
      this.applyServerMessage(message);

      for (const listener of this.listeners) {
        listener(message);
      }
    });

    socket.on("close", () => {
      if (this.connection === socket) {
        this.connection = null;
      }
    });

    await waitForOpen(socket);
  }

  async close(): Promise<void> {
    if (this.connection === null) {
      return;
    }

    const socket = this.connection;

    if (socket.readyState === WebSocket.CLOSED) {
      this.connection = null;
      return;
    }

    await new Promise<void>((resolve) => {
      socket.once("close", () => resolve());
      socket.close();
    });
  }

  send(message: ClientMessage): void {
    const socket = this.requireOpenConnection();
    socket.send(JSON.stringify(message));
  }

  async createRoom(mode: GameMode): Promise<PlayerRoomSnapshot> {
    const requestId = this.nextRequestId("create-room");
    const startIndex = this.receivedMessages.length;

    this.send({
      protocolVersion: PROTOCOL_VERSION,
      type: "create-room",
      requestId,
      userId: this.userId,
      nickname: this.nickname,
      avatarUrl: this.avatarUrl,
      mode,
      timestampMs: Date.now()
    });

    const message = (await this.waitForMessage(
      (candidate) => {
        return (
          (candidate.type === "room-state" || candidate.type === "error") &&
          candidate.requestId === requestId
        );
      },
      2_000,
      startIndex
    )) as ServerRoomStateMessage | ServerErrorMessage;

    if (message.type === "error") {
      throw createClientError(message);
    }

    this.roomId = message.roomId;
    this.playerId = message.room.hostPlayerId;
    return message.room;
  }

  async joinRoom(roomId: string): Promise<PlayerRoomSnapshot> {
    const requestId = this.nextRequestId("join-room");
    const startIndex = this.receivedMessages.length;
    this.roomId = roomId;

    this.send({
      protocolVersion: PROTOCOL_VERSION,
      type: "join-room",
      requestId,
      roomId,
      userId: this.userId,
      nickname: this.nickname,
      avatarUrl: this.avatarUrl,
      timestampMs: Date.now()
    });

    const message = (await this.waitForMessage(
      (candidate) => {
        return (
          (candidate.type === "room-state" || candidate.type === "error") &&
          candidate.requestId === requestId
        );
      },
      2_000,
      startIndex
    )) as ServerRoomStateMessage | ServerErrorMessage;

    if (message.type === "error") {
      throw createClientError(message);
    }

    const inferredPlayerId = inferPlayerIdFromRoomSnapshot(
      message.room,
      this.nickname
    );

    if (inferredPlayerId === null) {
      throw new Error("Failed to infer playerId from room-state.");
    }

    this.playerId = inferredPlayerId;
    return message.room;
  }

  async startGame(seed?: ShuffleSeed): Promise<ServerRoomStateMessage> {
    const requestId = this.nextRequestId("start-game");
    const startIndex = this.receivedMessages.length;
    const roomId = this.requireRoomId();
    const playerId = this.requirePlayerId();
    const message: ClientStartGameMessage = {
      protocolVersion: PROTOCOL_VERSION,
      type: "start-game",
      requestId,
      roomId,
      playerId,
      ...(seed === undefined ? {} : { seed }),
      timestampMs: Date.now()
    };

    this.send(message);

    const response = (await this.waitForMessage(
      (candidate) => {
        return (
          (candidate.type === "room-state" || candidate.type === "error") &&
          candidate.requestId === requestId
        );
      },
      2_000,
      startIndex
    )) as ServerRoomStateMessage | ServerErrorMessage;

    if (response.type === "error") {
      throw createClientError(response);
    }

    return response;
  }

  async sendCommand(
    command: GameCommand
  ): Promise<ServerEventsMessage | ServerErrorMessage> {
    const requestId = this.nextRequestId("command");
    const startIndex = this.receivedMessages.length;
    const roomId = this.requireRoomId();
    const playerId = this.requirePlayerId();
    const message: ClientCommandMessage = {
      protocolVersion: PROTOCOL_VERSION,
      type: "command",
      requestId,
      roomId,
      playerId,
      command,
      timestampMs: command.timestampMs ?? Date.now()
    };

    this.send(message);

    const response = (await this.waitForMessage(
      (candidate) => {
        return (
          (candidate.type === "events" || candidate.type === "error") &&
          candidate.requestId === requestId
        );
      },
      2_000,
      startIndex
    )) as ServerEventsMessage | ServerErrorMessage;

    return response;
  }

  async reconnect(roomId: string): Promise<ServerSnapshotMessage | ServerRoomStateMessage> {
    const requestId = this.nextRequestId("reconnect");
    const startIndex = this.receivedMessages.length;
    this.roomId = roomId;

    this.send({
      protocolVersion: PROTOCOL_VERSION,
      type: "reconnect",
      requestId,
      roomId,
      userId: this.userId,
      timestampMs: Date.now()
    });

    const response = (await this.waitForMessage(
      (candidate) => {
        if (candidate.type === "error" && candidate.requestId === requestId) {
          return true;
        }

        if (candidate.type === "room-state" && candidate.requestId === requestId) {
          return true;
        }

        if (candidate.type === "snapshot") {
          return true;
        }

        return false;
      },
      2_000,
      startIndex
    )) as ServerRoomStateMessage | ServerSnapshotMessage | ServerErrorMessage;

    if (response.type === "error") {
      throw createClientError(response);
    }

    if (response.type === "room-state") {
      const inferredPlayerId = inferPlayerIdFromRoomSnapshot(
        response.room,
        this.nickname
      );

      if (inferredPlayerId !== null) {
        this.playerId = inferredPlayerId;
      }

      return response;
    }

    if (!("self" in response.snapshot)) {
      throw new Error("Reconnect snapshot did not contain a player game snapshot.");
    }

    this.playerId = response.snapshot.self.playerId;
    return response;
  }

  waitForMessage(
    predicate: (message: ServerMessage) => boolean,
    timeoutMs = 2_000,
    startIndex = 0
  ): Promise<ServerMessage> {
    const existing = this.receivedMessages.slice(startIndex).find(predicate);

    if (existing !== undefined) {
      return Promise.resolve(existing);
    }

    return new Promise<ServerMessage>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.listeners.delete(listener);
        reject(new Error("Timed out waiting for server message."));
      }, timeoutMs);

      const listener = (message: ServerMessage) => {
        if (!predicate(message)) {
          return;
        }

        clearTimeout(timer);
        this.listeners.delete(listener);
        resolve(message);
      };

      this.listeners.add(listener);
    });
  }

  waitForSnapshotVersion(
    snapshotVersion: number,
    timeoutMs = 2_000
  ): Promise<PlayerGameSnapshot> {
    if (
      this.latestSnapshot !== undefined &&
      this.latestSnapshot.snapshotVersion >= snapshotVersion
    ) {
      return Promise.resolve(this.latestSnapshot);
    }

    return new Promise<PlayerGameSnapshot>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.listeners.delete(listener);
        reject(new Error("Timed out waiting for player snapshot."));
      }, timeoutMs);

      const listener = (message: ServerMessage) => {
        if (message.type !== "snapshot" || !("self" in message.snapshot)) {
          return;
        }

        if (message.snapshot.snapshotVersion < snapshotVersion) {
          return;
        }

        clearTimeout(timer);
        this.listeners.delete(listener);
        resolve(message.snapshot);
      };

      this.listeners.add(listener);
    });
  }

  waitForRoomPlayerCount(
    expectedPlayerCount: number,
    timeoutMs = 2_000
  ): Promise<PlayerRoomSnapshot> {
    if (
      this.latestRoomState !== undefined &&
      this.latestRoomState.players.length === expectedPlayerCount
    ) {
      return Promise.resolve(this.latestRoomState);
    }

    return new Promise<PlayerRoomSnapshot>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.listeners.delete(listener);
        reject(new Error("Timed out waiting for room-state update."));
      }, timeoutMs);

      const listener = (message: ServerMessage) => {
        if (message.type !== "room-state") {
          return;
        }

        if (message.room.players.length !== expectedPlayerCount) {
          return;
        }

        clearTimeout(timer);
        this.listeners.delete(listener);
        resolve(message.room);
      };

      this.listeners.add(listener);
    });
  }

  private applyServerMessage(message: ServerMessage): void {
    if (message.type === "room-state") {
      this.latestRoomState = message.room;
      this.roomId = message.roomId;

      if (this.playerId === undefined) {
        const inferredPlayerId = inferPlayerIdFromRoomSnapshot(
          message.room,
          this.nickname
        );

        if (inferredPlayerId !== null) {
          this.playerId = inferredPlayerId;
        }
      }

      return;
    }

    if (message.type === "snapshot") {
      if (!("self" in message.snapshot)) {
        return;
      }

      this.latestSnapshot = message.snapshot;
      this.roomId = message.roomId;
      this.playerId = message.playerId;
    }
  }

  private nextRequestId(prefix: string): string {
    this.requestCounter += 1;
    return `${this.userId}-${prefix}-${String(this.requestCounter)}`;
  }

  private requireOpenConnection(): WebSocket {
    if (this.connection === null || this.connection.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket client is not connected.");
    }

    return this.connection;
  }

  private requireRoomId(): string {
    if (this.roomId === undefined) {
      throw new Error("roomId is not available yet.");
    }

    return this.roomId;
  }

  private requirePlayerId(): string {
    if (this.playerId === undefined) {
      throw new Error("playerId is not available yet.");
    }

    return this.playerId;
  }
}

function waitForOpen(socket: WebSocket): Promise<void> {
  if (socket.readyState === WebSocket.OPEN) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    socket.once("open", () => resolve());
    socket.once("error", (error) => reject(error));
  });
}

function inferPlayerIdFromRoomSnapshot(
  room: PlayerRoomSnapshot,
  nickname: string
): string | null {
  return room.players.find((player) => player.displayName === nickname)?.playerId ?? null;
}

function createClientError(error: ServerErrorMessage): Error {
  return new Error(`${error.code}: ${error.message}`);
}
