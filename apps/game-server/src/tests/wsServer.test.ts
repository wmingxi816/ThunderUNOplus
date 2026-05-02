import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PROTOCOL_VERSION } from "@thunder-uno/protocol";
import { createInMemoryGameServer } from "../main";
import { createWsServer, type WsServerRuntime } from "../gateway/wsServer";
import { createWsTestClient, type WsTestClient } from "./wsTestUtils";

describe("wsServer integration", () => {
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

  it("可以启动 WebSocket server 并接受连接", async () => {
    const client = await createWsTestClient(wsUrl);
    clients.push(client);

    expect(client.socket.readyState).toBe(client.socket.OPEN);
  });

  it("客户端可以 ping 并收到 pong", async () => {
    const client = await createWsTestClient(wsUrl);
    clients.push(client);

    client.sendJson({
      protocolVersion: PROTOCOL_VERSION,
      type: "ping",
      requestId: "req-ping-1",
      timestampMs: 1000
    });

    const message = await client.waitForMessage((event) => event.type === "pong");

    expect(message).toMatchObject({
      type: "pong",
      requestId: "req-ping-1"
    });
  });

  it("一个客户端可以 create-room", async () => {
    const client = await createWsTestClient(wsUrl);
    clients.push(client);

    client.sendJson({
      protocolVersion: PROTOCOL_VERSION,
      type: "create-room",
      requestId: "req-create-room-1",
      userId: "dev-user-001",
      nickname: "玩家1",
      avatarUrl: null,
      mode: "no-challenge",
      timestampMs: 1000
    });

    const message = await client.waitForMessage((event) => event.type === "room-state");

    if (message.type !== "room-state") {
      throw new Error("Expected room-state message.");
    }

    expect(message.room.players).toHaveLength(1);
    expect(message.room.hostPlayerId).toBe(message.room.players[0]!.playerId);
  });

  it("第二个客户端可以 join-room", async () => {
    const owner = await createWsTestClient(wsUrl);
    const joiner = await createWsTestClient(wsUrl);
    clients.push(owner, joiner);

    owner.sendJson({
      protocolVersion: PROTOCOL_VERSION,
      type: "create-room",
      requestId: "req-create-room-1",
      userId: "dev-user-001",
      nickname: "玩家1",
      avatarUrl: null,
      mode: "no-challenge",
      timestampMs: 1000
    });

    const ownerRoomState = await owner.waitForMessage((event) => event.type === "room-state");

    if (ownerRoomState.type !== "room-state") {
      throw new Error("Expected room-state message.");
    }

    joiner.sendJson({
      protocolVersion: PROTOCOL_VERSION,
      type: "join-room",
      requestId: "req-join-room-1",
      roomId: ownerRoomState.roomId,
      userId: "dev-user-002",
      nickname: "玩家2",
      avatarUrl: null,
      timestampMs: 1000
    });

    const joinerRoomState = await joiner.waitForMessage((event) => event.type === "room-state");

    if (joinerRoomState.type !== "room-state") {
      throw new Error("Expected room-state message.");
    }

    expect(joinerRoomState.room.players).toHaveLength(2);
  });

  it("三个客户端可以 start-game 并收到各自 snapshot", async () => {
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

    const roomState = await first.waitForMessage((event) => event.type === "room-state");

    if (roomState.type !== "room-state") {
      throw new Error("Expected room-state message.");
    }

    second.sendJson({
      protocolVersion: PROTOCOL_VERSION,
      type: "join-room",
      requestId: "req-join-room-2",
      roomId: roomState.roomId,
      userId: "dev-user-002",
      nickname: "玩家2",
      avatarUrl: null,
      timestampMs: 1000
    });

    third.sendJson({
      protocolVersion: PROTOCOL_VERSION,
      type: "join-room",
      requestId: "req-join-room-3",
      roomId: roomState.roomId,
      userId: "dev-user-003",
      nickname: "玩家3",
      avatarUrl: null,
      timestampMs: 1000
    });

    const latestRoomState = await first.waitForMessage((event) => {
      return event.type === "room-state" && event.room.players.length === 3;
    });

    if (latestRoomState.type !== "room-state") {
      throw new Error("Expected room-state message.");
    }

    first.sendJson({
      protocolVersion: PROTOCOL_VERSION,
      type: "start-game",
      requestId: "req-start-game-1",
      roomId: latestRoomState.roomId,
      playerId: latestRoomState.room.hostPlayerId,
      timestampMs: 1000
    });

    const firstSnapshot = await first.waitForMessage((event) => event.type === "snapshot");
    const secondSnapshot = await second.waitForMessage((event) => event.type === "snapshot");
    const thirdSnapshot = await third.waitForMessage((event) => event.type === "snapshot");

    if (
      firstSnapshot.type !== "snapshot" ||
      secondSnapshot.type !== "snapshot" ||
      thirdSnapshot.type !== "snapshot"
    ) {
      throw new Error("Expected snapshot messages.");
    }

    if (
      !("self" in firstSnapshot.snapshot) ||
      !("self" in secondSnapshot.snapshot) ||
      !("self" in thirdSnapshot.snapshot)
    ) {
      throw new Error("Expected player game snapshots.");
    }

    expect(firstSnapshot.snapshot.self.playerId).not.toBe(secondSnapshot.snapshot.self.playerId);
    expect("hand" in firstSnapshot.snapshot.opponents[0]!).toBe(false);
  });
});
