import type { GameMode } from "@thunder-uno/shared-types";
import {
  PROTOCOL_VERSION,
  type ClientCommandMessage
} from "@thunder-uno/protocol";
import { ConnectionRegistry } from "../connection/connectionRegistry";
import {
  createMockConnection,
  type CreateMockConnectionParams
} from "../connection/mockConnection";
import type { MockServerConnection } from "../connection/connectionTypes";
import { RoomManager } from "../room/roomManager";
import type { RoomRuntime } from "../room/roomTypes";

export interface TestServerContext {
  connectionRegistry: ConnectionRegistry;
  roomManager: RoomManager;
}

export interface WaitingRoomFixture extends TestServerContext {
  room: RoomRuntime;
  connections: MockServerConnection[];
}

export interface StartedRoomFixture extends WaitingRoomFixture {}

export function createTestServerContext(): TestServerContext {
  let roomIdCounter = 123450;
  let playerIdCounter = 0;
  let nowCounter = 1_000;
  const connectionRegistry = new ConnectionRegistry();
  const roomManager = new RoomManager({
    connectionRegistry,
    now: () => {
      nowCounter += 1_000;
      return nowCounter;
    },
    createRoomId: () => {
      roomIdCounter += 1;
      return String(roomIdCounter);
    },
    createPlayerId: () => {
      playerIdCounter += 1;
      return `player-${String(playerIdCounter).padStart(3, "0")}`;
    }
  });

  return {
    connectionRegistry,
    roomManager
  };
}

export function registerMockConnections(
  connectionRegistry: ConnectionRegistry,
  userCount: number,
  startIndex = 1
): MockServerConnection[] {
  return Array.from({ length: userCount }, (_, index) => {
    const uniqueIndex = startIndex + index;
    const connection = createMockConnection({
      connectionId: `conn-${String(uniqueIndex).padStart(3, "0")}`,
      userId: `dev-user-${String(uniqueIndex).padStart(3, "0")}`
    } satisfies CreateMockConnectionParams);

    connectionRegistry.registerConnection(connection);
    return connection;
  });
}

export function createWaitingRoomFixture(
  playerCount = 3,
  mode: GameMode = "no-challenge"
): WaitingRoomFixture {
  const context = createTestServerContext();
  const connections = registerMockConnections(
    context.connectionRegistry,
    playerCount
  );
  const room = context.roomManager.createRoom({
    userId: connections[0]!.userId,
    connectionId: connections[0]!.connectionId,
    nickname: "Player 1",
    avatarUrl: null,
    mode
  }).room;

  for (let index = 1; index < connections.length; index += 1) {
    const connection = connections[index]!;
    context.roomManager.joinRoom({
      roomId: room.roomId,
      userId: connection.userId,
      connectionId: connection.connectionId,
      nickname: `Player ${String(index + 1)}`,
      avatarUrl: null
    });
    context.roomManager.setPlayerReady({
      roomId: room.roomId,
      playerId: room.players[index]!.playerId,
      ready: true
    });
  }

  return {
    ...context,
    room,
    connections
  };
}

export function createStartedRoomFixture(
  playerCount = 3,
  mode: GameMode = "no-challenge"
): StartedRoomFixture {
  const fixture = createWaitingRoomFixture(playerCount, mode);

  fixture.roomManager.startGame({
    roomId: fixture.room.roomId,
    playerId: fixture.room.ownerPlayerId,
    seed: 1001
  });

  return fixture;
}

export function createCommandMessage(params: {
  roomId: string;
  playerId: string;
  command: ClientCommandMessage["command"];
  requestId?: string;
  timestampMs?: number;
}): ClientCommandMessage {
  return {
    protocolVersion: PROTOCOL_VERSION,
    type: "command",
    requestId: params.requestId ?? "req-test",
    roomId: params.roomId,
    playerId: params.playerId,
    command: params.command,
    timestampMs: params.timestampMs ?? 9_999
  };
}
