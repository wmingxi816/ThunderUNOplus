import { describe, expect, it } from "vitest";
import { PROTOCOL_VERSION } from "@thunder-uno/protocol";
import { handleClientMessage } from "../gateway/messageHandler";
import { createMockConnection } from "../connection/mockConnection";
import {
  createStartedRoomFixture,
  createTestServerContext,
  createWaitingRoomFixture
} from "./testUtils";

describe("messageHandler", () => {
  it("非 JSON 消息返回 error", () => {
    const context = createTestServerContext();
    const connection = createMockConnection({
      connectionId: "conn-001",
      userId: "dev-user-001"
    });
    context.connectionRegistry.registerConnection(connection);

    handleClientMessage({
      connection,
      rawMessage: "not-json",
      roomManager: context.roomManager,
      connectionRegistry: context.connectionRegistry
    });

    expect(connection.sentMessages[0]).toMatchObject({
      type: "error",
      code: "invalid-message"
    });
  });

  it("未知 type 返回 error", () => {
    const context = createTestServerContext();
    const connection = createMockConnection({
      connectionId: "conn-001",
      userId: "dev-user-001"
    });
    context.connectionRegistry.registerConnection(connection);

    handleClientMessage({
      connection,
      rawMessage: JSON.stringify({
        protocolVersion: PROTOCOL_VERSION,
        type: "unknown",
        requestId: "req-1",
        timestampMs: 1000
      }),
      roomManager: context.roomManager,
      connectionRegistry: context.connectionRegistry
    });

    expect(connection.sentMessages[0]).toMatchObject({
      type: "error",
      code: "invalid-message"
    });
  });

  it("ping 返回 pong", () => {
    const context = createTestServerContext();
    const connection = createMockConnection({
      connectionId: "conn-001",
      userId: "dev-user-001"
    });
    context.connectionRegistry.registerConnection(connection);

    handleClientMessage({
      connection,
      rawMessage: JSON.stringify({
        protocolVersion: PROTOCOL_VERSION,
        type: "ping",
        requestId: "req-ping-1",
        timestampMs: 1000
      }),
      roomManager: context.roomManager,
      connectionRegistry: context.connectionRegistry
    });

    expect(connection.sentMessages[0]).toMatchObject({
      type: "pong",
      requestId: "req-ping-1"
    });
  });

  it("create-room 会创建房间并绑定 connection", () => {
    const context = createTestServerContext();
    const connection = createMockConnection({
      connectionId: "conn-001",
      userId: "dev-user-001"
    });
    context.connectionRegistry.registerConnection(connection);

    handleClientMessage({
      connection,
      rawMessage: JSON.stringify({
        protocolVersion: PROTOCOL_VERSION,
        type: "create-room",
        requestId: "req-create-1",
        userId: "dev-user-001",
        nickname: "玩家1",
        avatarUrl: null,
        mode: "no-challenge",
        timestampMs: 1000
      }),
      roomManager: context.roomManager,
      connectionRegistry: context.connectionRegistry
    });

    expect(context.roomManager.listRooms()).toHaveLength(1);
    expect(connection.roomId).not.toBeNull();
    expect(connection.playerId).not.toBeNull();
    expect(connection.sentMessages.some((message) => message.type === "room-state")).toBe(true);
  });

  it("join-room 会加入房间并广播 room-state", () => {
    const context = createTestServerContext();
    const ownerConnection = createMockConnection({
      connectionId: "conn-001",
      userId: "dev-user-001"
    });
    const joinerConnection = createMockConnection({
      connectionId: "conn-002",
      userId: "dev-user-002"
    });
    context.connectionRegistry.registerConnection(ownerConnection);
    context.connectionRegistry.registerConnection(joinerConnection);

    handleClientMessage({
      connection: ownerConnection,
      rawMessage: JSON.stringify({
        protocolVersion: PROTOCOL_VERSION,
        type: "create-room",
        requestId: "req-create-1",
        userId: "dev-user-001",
        nickname: "玩家1",
        avatarUrl: null,
        mode: "no-challenge",
        timestampMs: 1000
      }),
      roomManager: context.roomManager,
      connectionRegistry: context.connectionRegistry
    });

    const roomId = context.roomManager.listRooms()[0]!.roomId;

    handleClientMessage({
      connection: joinerConnection,
      rawMessage: JSON.stringify({
        protocolVersion: PROTOCOL_VERSION,
        type: "join-room",
        requestId: "req-join-1",
        roomId,
        userId: "dev-user-002",
        nickname: "玩家2",
        avatarUrl: null,
        timestampMs: 1000
      }),
      roomManager: context.roomManager,
      connectionRegistry: context.connectionRegistry
    });

    expect(context.roomManager.getRoom(roomId)!.players).toHaveLength(2);
    expect(ownerConnection.sentMessages.some((message) => message.type === "room-state")).toBe(true);
    expect(joinerConnection.sentMessages.some((message) => message.type === "room-state")).toBe(true);
  });

  it("start-game 会向每位玩家发送各自 snapshot", () => {
    const fixture = createWaitingRoomFixture(3);
    const ownerPlayerId = fixture.room.ownerPlayerId;
    const ownerConnection = fixture.connectionRegistry.getConnectionByPlayerId(ownerPlayerId)!;

    handleClientMessage({
      connection: ownerConnection,
      rawMessage: JSON.stringify({
        protocolVersion: PROTOCOL_VERSION,
        type: "start-game",
        requestId: "req-start-1",
        roomId: fixture.room.roomId,
        playerId: ownerPlayerId,
        timestampMs: 1000
      }),
      roomManager: fixture.roomManager,
      connectionRegistry: fixture.connectionRegistry
    });

    for (const connection of fixture.connections) {
      expect(connection.sentMessages.some((message) => message.type === "snapshot")).toBe(true);
    }
  });

  it("start-game 会兜底给发起连接直接发送房主 snapshot", () => {
    const fixture = createWaitingRoomFixture(3);
    const ownerPlayerId = fixture.room.ownerPlayerId;
    const ownerConnection = fixture.connections[0]!;
    const shadowConnection = createMockConnection({
      connectionId: "conn-shadow-owner",
      userId: ownerConnection.userId
    });
    fixture.connectionRegistry.registerConnection(shadowConnection);
    fixture.connectionRegistry.bindPlayer(
      shadowConnection.connectionId,
      fixture.room.roomId,
      ownerPlayerId,
      shadowConnection.userId
    );
    ownerConnection.sentMessages.length = 0;

    handleClientMessage({
      connection: ownerConnection,
      rawMessage: JSON.stringify({
        protocolVersion: PROTOCOL_VERSION,
        type: "start-game",
        requestId: "req-start-shadowed-owner",
        roomId: fixture.room.roomId,
        playerId: ownerPlayerId,
        timestampMs: 1000
      }),
      roomManager: fixture.roomManager,
      connectionRegistry: fixture.connectionRegistry
    });

    expect(ownerConnection.sentMessages.some((message) => message.type === "snapshot")).toBe(true);
  });

  it("command 会走 dispatchCommand", () => {
    const fixture = createStartedRoomFixture(3);
    const currentPlayerId = fixture.room.gameState!.currentPlayerId;
    const currentConnection = fixture.connectionRegistry.getConnectionByPlayerId(currentPlayerId)!;

    handleClientMessage({
      connection: currentConnection,
      rawMessage: JSON.stringify({
        protocolVersion: PROTOCOL_VERSION,
        type: "command",
        requestId: "req-command-1",
        roomId: fixture.room.roomId,
        playerId: currentPlayerId,
        command: {
          type: "draw-card",
          playerId: currentPlayerId,
          timestampMs: 1000
        },
        timestampMs: 1000
      }),
      roomManager: fixture.roomManager,
      connectionRegistry: fixture.connectionRegistry
    });

    expect(currentConnection.sentMessages.some((message) => message.type === "events")).toBe(true);
  });

  it("leave-room 会更新房间状态", () => {
    const fixture = createWaitingRoomFixture(3);
    const leaver = fixture.room.players[1]!;
    const leaverConnection = fixture.connectionRegistry.getConnectionByPlayerId(leaver.playerId)!;

    handleClientMessage({
      connection: leaverConnection,
      rawMessage: JSON.stringify({
        protocolVersion: PROTOCOL_VERSION,
        type: "leave-room",
        requestId: "req-leave-1",
        roomId: fixture.room.roomId,
        playerId: leaver.playerId,
        timestampMs: 1000
      }),
      roomManager: fixture.roomManager,
      connectionRegistry: fixture.connectionRegistry
    });

    expect(fixture.room.players).toHaveLength(2);
  });

  it("playing 中主动 leave-room 会标记 left，且不能再自动 reconnect", () => {
    const fixture = createStartedRoomFixture(3);
    const leaver = fixture.room.players[1]!;
    const leaverConnection = fixture.connectionRegistry.getConnectionByPlayerId(leaver.playerId)!;
    const watcherConnection = fixture.connections.find(
      (connection) => connection.connectionId !== leaverConnection.connectionId
    )!;

    handleClientMessage({
      connection: leaverConnection,
      rawMessage: JSON.stringify({
        protocolVersion: PROTOCOL_VERSION,
        type: "leave-room",
        requestId: "req-battle-leave-1",
        roomId: fixture.room.roomId,
        playerId: leaver.playerId,
        timestampMs: 1000
      }),
      roomManager: fixture.roomManager,
      connectionRegistry: fixture.connectionRegistry
    });

    expect(leaver.hasLeftRoom).toBe(true);
    expect(fixture.room.gameState?.players.find((player) => player.id === leaver.playerId)?.hasLeftRoom).toBe(true);
    expect(watcherConnection.sentMessages.some((message) => {
      return message.type === "snapshot" &&
        message.snapshot.opponents.some((player) => {
          return player.playerId === leaver.playerId && player.hasLeftRoom;
        });
    })).toBe(true);

    const newConnection = createMockConnection({
      connectionId: "conn-left-reconnect",
      userId: leaver.userId
    });
    fixture.connectionRegistry.registerConnection(newConnection);

    handleClientMessage({
      connection: newConnection,
      rawMessage: JSON.stringify({
        protocolVersion: PROTOCOL_VERSION,
        type: "reconnect",
        requestId: "req-left-reconnect-1",
        roomId: fixture.room.roomId,
        userId: leaver.userId,
        timestampMs: 1000
      }),
      roomManager: fixture.roomManager,
      connectionRegistry: fixture.connectionRegistry
    });

    expect(newConnection.sentMessages.some((message) => message.type === "error")).toBe(true);
  });

  it("最后一名玩家 leave-room 后会收到 room-closed", () => {
    const context = createTestServerContext();
    const ownerConnection = createMockConnection({
      connectionId: "conn-001",
      userId: "dev-user-001"
    });
    context.connectionRegistry.registerConnection(ownerConnection);

    handleClientMessage({
      connection: ownerConnection,
      rawMessage: JSON.stringify({
        protocolVersion: PROTOCOL_VERSION,
        type: "create-room",
        requestId: "req-create-last-1",
        userId: "dev-user-001",
        nickname: "玩家1",
        avatarUrl: null,
        mode: "no-challenge",
        timestampMs: 1000
      }),
      roomManager: context.roomManager,
      connectionRegistry: context.connectionRegistry
    });

    const createdRoom = context.roomManager.listRooms()[0]!;

    handleClientMessage({
      connection: ownerConnection,
      rawMessage: JSON.stringify({
        protocolVersion: PROTOCOL_VERSION,
        type: "leave-room",
        requestId: "req-leave-last-1",
        roomId: createdRoom.roomId,
        playerId: createdRoom.ownerPlayerId,
        timestampMs: 1000
      }),
      roomManager: context.roomManager,
      connectionRegistry: context.connectionRegistry
    });

    expect(context.roomManager.listRooms()).toHaveLength(0);
    expect(ownerConnection.sentMessages.some((message) => message.type === "room-closed")).toBe(true);
  });

  it("reconnect 会复用原 playerId", () => {
    const fixture = createStartedRoomFixture(3);
    const reconnectingPlayer = fixture.room.players[1]!;
    const originalPlayerId = reconnectingPlayer.playerId;

    fixture.roomManager.leaveRoom({
      roomId: fixture.room.roomId,
      playerId: originalPlayerId
    });

    const newConnection = createMockConnection({
      connectionId: "conn-999",
      userId: reconnectingPlayer.userId
    });
    fixture.connectionRegistry.registerConnection(newConnection);

    handleClientMessage({
      connection: newConnection,
      rawMessage: JSON.stringify({
        protocolVersion: PROTOCOL_VERSION,
        type: "reconnect",
        requestId: "req-reconnect-1",
        roomId: fixture.room.roomId,
        userId: reconnectingPlayer.userId,
        timestampMs: 1000
      }),
      roomManager: fixture.roomManager,
      connectionRegistry: fixture.connectionRegistry
    });

    const snapshotMessage = newConnection.sentMessages.find(
      (message) => message.type === "snapshot"
    );

    if (snapshotMessage === undefined || !("self" in snapshotMessage.snapshot)) {
      throw new Error("Expected a reconnect snapshot.");
    }

    expect(snapshotMessage.snapshot.self.playerId).toBe(originalPlayerId);
  });

  it("command-rejected 只回请求玩家", () => {
    const fixture = createStartedRoomFixture(3);
    const requester = fixture.room.gameState!.currentPlayerId;
    const requesterConnection = fixture.connectionRegistry.getConnectionByPlayerId(requester)!;
    const otherConnections = fixture.connections.filter(
      (connection) => connection.connectionId !== requesterConnection.connectionId
    );

    handleClientMessage({
      connection: requesterConnection,
      rawMessage: JSON.stringify({
        protocolVersion: PROTOCOL_VERSION,
        type: "command",
        requestId: "req-command-reject-1",
        roomId: fixture.room.roomId,
        playerId: requester,
        command: {
          type: "say-uno",
          playerId: requester,
          timestampMs: 1000
        },
        timestampMs: 1000
      }),
      roomManager: fixture.roomManager,
      connectionRegistry: fixture.connectionRegistry
    });

    expect(
      requesterConnection.sentMessages.some((message) => {
        return (
          message.type === "events" &&
          message.events.some((event) => event.type === "command-rejected")
        );
      })
    ).toBe(true);

    for (const connection of otherConnections) {
      expect(
        connection.sentMessages.some((message) => {
          return (
            message.type === "events" &&
            message.events.some((event) => event.type === "command-rejected")
          );
        })
      ).toBe(false);
    }
  });
});
