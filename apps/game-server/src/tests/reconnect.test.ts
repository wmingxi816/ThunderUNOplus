import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PROTOCOL_VERSION } from "@thunder-uno/protocol";
import { createInMemoryGameServer } from "../main";
import { createWsServer, type WsServerRuntime } from "../gateway/wsServer";
import { createWsTestClient, type WsTestClient } from "./wsTestUtils";

describe("reconnect integration", () => {
  let runtime: ReturnType<typeof createInMemoryGameServer>;
  let wsRuntime: WsServerRuntime;
  let wsUrl: string;
  const clients: WsTestClient[] = [];

  beforeEach(async () => {
    runtime = createInMemoryGameServer();
    wsRuntime = await createWsServer({
      port: 0,
      roomManager: runtime.roomManager,
      connectionRegistry: runtime.connectionRegistry
    });
    wsUrl = `ws://localhost:${String(wsRuntime.port)}`;
  });

  afterEach(async () => {
    for (const client of clients) {
      await client.close();
    }

    await wsRuntime.close();
  });

  it("close 后玩家被标记 disconnected，reconnect 后 playerId 不变", async () => {
    const first = await createWsTestClient(wsUrl);
    const second = await createWsTestClient(wsUrl);
    const third = await createWsTestClient(wsUrl);
    clients.push(first, second, third);

    first.sendJson({
      protocolVersion: PROTOCOL_VERSION,
      type: "create-room",
      requestId: "req-create-room-1",
      userId: "dev-user-001",
      nickname: "玩家1",
      avatarUrl: null,
      mode: "with-challenge",
      timestampMs: 1000
    });

    const initialRoomState = await first.waitForMessage((event) => event.type === "room-state");

    if (initialRoomState.type !== "room-state") {
      throw new Error("Expected room-state message.");
    }

    second.sendJson({
      protocolVersion: PROTOCOL_VERSION,
      type: "join-room",
      requestId: "req-join-room-2",
      roomId: initialRoomState.roomId,
      userId: "dev-user-002",
      nickname: "玩家2",
      avatarUrl: null,
      timestampMs: 1000
    });

    third.sendJson({
      protocolVersion: PROTOCOL_VERSION,
      type: "join-room",
      requestId: "req-join-room-3",
      roomId: initialRoomState.roomId,
      userId: "dev-user-003",
      nickname: "玩家3",
      avatarUrl: null,
      timestampMs: 1000
    });

    const readyRoomState = await first.waitForMessage((event) => {
      return event.type === "room-state" && event.room.players.length === 3;
    });

    if (readyRoomState.type !== "room-state") {
      throw new Error("Expected room-state message.");
    }

    const secondPlayerId = readyRoomState.room.players.find(
      (player) => player.displayName === "玩家2"
    )!.playerId;
    const thirdPlayerId = readyRoomState.room.players.find(
      (player) => player.displayName === "玩家3"
    )!.playerId;

    second.sendJson({
      protocolVersion: PROTOCOL_VERSION,
      type: "set-ready",
      requestId: "req-ready-2",
      roomId: readyRoomState.roomId,
      playerId: secondPlayerId,
      ready: true,
      timestampMs: 1000
    });

    third.sendJson({
      protocolVersion: PROTOCOL_VERSION,
      type: "set-ready",
      requestId: "req-ready-3",
      roomId: readyRoomState.roomId,
      playerId: thirdPlayerId,
      ready: true,
      timestampMs: 1000
    });

    const allReadyRoomState = await first.waitForMessage((event) => {
      return event.type === "room-state" &&
        event.room.players.length === 3 &&
        event.room.players.every((player) => player.isReady);
    });

    if (allReadyRoomState.type !== "room-state") {
      throw new Error("Expected ready room-state message.");
    }

    first.sendJson({
      protocolVersion: PROTOCOL_VERSION,
      type: "start-game",
      requestId: "req-start-game-1",
      roomId: allReadyRoomState.roomId,
      playerId: allReadyRoomState.room.hostPlayerId,
      timestampMs: 1000
    });

    await first.waitForMessage((event) => event.type === "snapshot");
    await second.waitForMessage((event) => event.type === "snapshot");
    await third.waitForMessage((event) => event.type === "snapshot");

    await second.close();

    const disconnectedRoomState = await first.waitForMessage((event) => {
      return (
        event.type === "room-state" &&
        event.room.players.some((player) => {
          return player.playerId === secondPlayerId && player.connectionStatus === "disconnected";
        })
      );
    });

    if (disconnectedRoomState.type !== "room-state") {
      throw new Error("Expected room-state message after disconnect.");
    }

    const reconnectClient = await createWsTestClient(wsUrl);
    clients.push(reconnectClient);

    reconnectClient.sendJson({
      protocolVersion: PROTOCOL_VERSION,
      type: "reconnect",
      requestId: "req-reconnect-1",
      roomId: allReadyRoomState.roomId,
      userId: "dev-user-002",
      timestampMs: 1000
    });

    const reconnectSnapshot = await reconnectClient.waitForMessage(
      (event) => event.type === "snapshot"
    );

    if (
      reconnectSnapshot.type !== "snapshot" ||
      !("self" in reconnectSnapshot.snapshot)
    ) {
      throw new Error("Expected reconnect snapshot.");
    }

    expect(reconnectSnapshot.snapshot.self.playerId).toBe(secondPlayerId);
  });
});
