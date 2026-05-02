import { describe, expect, it } from "vitest";
import { PROTOCOL_VERSION } from "@thunder-uno/protocol";
import { ConnectionRegistry } from "../connection/connectionRegistry";
import { createMockConnection } from "../connection/mockConnection";

describe("ConnectionRegistry", () => {
  it("可以注册连接", () => {
    const registry = new ConnectionRegistry();
    const connection = createMockConnection({
      connectionId: "conn-001",
      userId: "dev-user-001"
    });

    registry.registerConnection(connection);

    expect(registry.getConnection("conn-001")).toBe(connection);
  });

  it("可以注销连接", () => {
    const registry = new ConnectionRegistry();
    const connection = createMockConnection({
      connectionId: "conn-001",
      userId: "dev-user-001"
    });

    registry.registerConnection(connection);

    expect(registry.unregisterConnection("conn-001")).toBe(true);
    expect(registry.getConnection("conn-001")).toBeNull();
  });

  it("可以通过 playerId 找到连接", () => {
    const registry = new ConnectionRegistry();
    const connection = createMockConnection({
      connectionId: "conn-001",
      userId: "dev-user-001"
    });

    registry.registerConnection(connection);
    registry.bindPlayer("conn-001", "123456", "player-001", "dev-user-001");

    expect(registry.getConnectionByPlayerId("player-001")).toBe(connection);
  });

  it("sendToPlayer 会把消息写入 mock connection", () => {
    const registry = new ConnectionRegistry();
    const connection = createMockConnection({
      connectionId: "conn-001",
      userId: "dev-user-001"
    });

    registry.registerConnection(connection);
    registry.bindPlayer("conn-001", "123456", "player-001", "dev-user-001");

    const sent = registry.sendToPlayer("player-001", {
      protocolVersion: PROTOCOL_VERSION,
      type: "pong",
      timestampMs: 1000
    });

    expect(sent).toBe(true);
    expect(connection.sentMessages).toHaveLength(1);
    expect(connection.sentMessages[0]).toMatchObject({
      type: "pong"
    });
  });

  it("sendToRoom 会给房间内所有在线连接发消息", () => {
    const registry = new ConnectionRegistry();
    const first = createMockConnection({
      connectionId: "conn-001",
      userId: "dev-user-001"
    });
    const second = createMockConnection({
      connectionId: "conn-002",
      userId: "dev-user-002"
    });
    const third = createMockConnection({
      connectionId: "conn-003",
      userId: "dev-user-003"
    });

    registry.registerConnection(first);
    registry.registerConnection(second);
    registry.registerConnection(third);
    registry.bindPlayer("conn-001", "123456", "player-001", "dev-user-001");
    registry.bindPlayer("conn-002", "123456", "player-002", "dev-user-002");
    registry.bindPlayer("conn-003", "654321", "player-003", "dev-user-003");

    const sentCount = registry.sendToRoom("123456", {
      protocolVersion: PROTOCOL_VERSION,
      type: "pong",
      timestampMs: 1000
    });

    expect(sentCount).toBe(2);
    expect(first.sentMessages).toHaveLength(1);
    expect(second.sentMessages).toHaveLength(1);
    expect(third.sentMessages).toHaveLength(0);
  });
});
