import { describe, expect, it } from "vitest";
import { dispatchCommand } from "../dispatch/dispatchCommand";
import {
  createCommandMessage,
  createStartedRoomFixture,
  createTestServerContext,
  createWaitingRoomFixture
} from "./testUtils";

describe("dispatchCommand", () => {
  it("room 不存在时返回 error", () => {
    const context = createTestServerContext();
    const result = dispatchCommand({
      roomManager: context.roomManager,
      connectionRegistry: context.connectionRegistry,
      message: createCommandMessage({
        roomId: "999999",
        playerId: "player-404",
        command: {
          type: "draw-card",
          playerId: "player-404",
          timestampMs: 1000
        }
      })
    });

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("room-not-found");
  });

  it("game 未开始时返回 error", () => {
    const fixture = createWaitingRoomFixture(3);
    const ownerPlayerId = fixture.room.ownerPlayerId;
    const result = dispatchCommand({
      roomManager: fixture.roomManager,
      connectionRegistry: fixture.connectionRegistry,
      message: createCommandMessage({
        roomId: fixture.room.roomId,
        playerId: ownerPlayerId,
        command: {
          type: "draw-card",
          playerId: ownerPlayerId,
          timestampMs: 1000
        }
      })
    });

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("game-not-started");
  });

  it("player 不在 room 时返回 error", () => {
    const fixture = createStartedRoomFixture(3);
    const result = dispatchCommand({
      roomManager: fixture.roomManager,
      connectionRegistry: fixture.connectionRegistry,
      message: createCommandMessage({
        roomId: fixture.room.roomId,
        playerId: "player-999",
        command: {
          type: "draw-card",
          playerId: "player-999",
          timestampMs: 1000
        }
      })
    });

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("player-not-in-room");
  });

  it("playerId 与 command.playerId 不一致时返回 error", () => {
    const fixture = createStartedRoomFixture(3);
    const roomPlayerId = fixture.room.gameState!.currentPlayerId;
    const commandPlayerId = fixture.room.players.find(
      (player) => player.playerId !== roomPlayerId
    )!.playerId;
    const result = dispatchCommand({
      roomManager: fixture.roomManager,
      connectionRegistry: fixture.connectionRegistry,
      message: createCommandMessage({
        roomId: fixture.room.roomId,
        playerId: roomPlayerId,
        command: {
          type: "draw-card",
          playerId: commandPlayerId,
          timestampMs: 1000
        }
      })
    });

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("player-id-mismatch");
  });

  it("合法 command 会调用 applyCommand 并更新 room.gameState", () => {
    const fixture = createStartedRoomFixture(3);
    const previousState = fixture.room.gameState!;
    const currentPlayerId = previousState.currentPlayerId;
    const result = dispatchCommand({
      roomManager: fixture.roomManager,
      connectionRegistry: fixture.connectionRegistry,
      message: createCommandMessage({
        roomId: fixture.room.roomId,
        playerId: currentPlayerId,
        command: {
          type: "draw-card",
          playerId: currentPlayerId,
          timestampMs: 1000
        }
      })
    });

    expect(result.ok).toBe(true);
    expect(result.events.length).toBeGreaterThan(0);
    expect(fixture.room.gameState).not.toBe(previousState);
  });

  it("合法 command 会让 snapshotVersion + 1", () => {
    const fixture = createStartedRoomFixture(3);
    const previousSnapshotVersion = fixture.room.snapshotVersion;
    const currentPlayerId = fixture.room.gameState!.currentPlayerId;

    dispatchCommand({
      roomManager: fixture.roomManager,
      connectionRegistry: fixture.connectionRegistry,
      message: createCommandMessage({
        roomId: fixture.room.roomId,
        playerId: currentPlayerId,
        command: {
          type: "draw-card",
          playerId: currentPlayerId,
          timestampMs: 1000
        }
      })
    });

    expect(fixture.room.snapshotVersion).toBe(previousSnapshotVersion + 1);
  });

  it("合法 command 会广播 events", () => {
    const fixture = createStartedRoomFixture(3);
    const currentPlayerId = fixture.room.gameState!.currentPlayerId;

    dispatchCommand({
      roomManager: fixture.roomManager,
      connectionRegistry: fixture.connectionRegistry,
      message: createCommandMessage({
        roomId: fixture.room.roomId,
        playerId: currentPlayerId,
        command: {
          type: "draw-card",
          playerId: currentPlayerId,
          timestampMs: 1000
        }
      })
    });

    for (const connection of fixture.connections) {
      expect(connection.sentMessages.some((message) => message.type === "events")).toBe(true);
    }
  });

  it("合法 command 会给每个玩家发送 snapshot", () => {
    const fixture = createStartedRoomFixture(3);
    const currentPlayerId = fixture.room.gameState!.currentPlayerId;

    dispatchCommand({
      roomManager: fixture.roomManager,
      connectionRegistry: fixture.connectionRegistry,
      message: createCommandMessage({
        roomId: fixture.room.roomId,
        playerId: currentPlayerId,
        command: {
          type: "draw-card",
          playerId: currentPlayerId,
          timestampMs: 1000
        }
      })
    });

    for (const connection of fixture.connections) {
      expect(connection.sentMessages.some((message) => message.type === "snapshot")).toBe(true);
    }
  });

  it("非法出牌 command 不应导致服务器崩溃", () => {
    const fixture = createStartedRoomFixture(3);
    const currentPlayerId = fixture.room.gameState!.currentPlayerId;
    const previousSnapshotVersion = fixture.room.snapshotVersion;
    const result = dispatchCommand({
      roomManager: fixture.roomManager,
      connectionRegistry: fixture.connectionRegistry,
      message: createCommandMessage({
        roomId: fixture.room.roomId,
        playerId: currentPlayerId,
        command: {
          type: "say-uno",
          playerId: currentPlayerId,
          timestampMs: 1000
        }
      })
    });

    expect(result.ok).toBe(false);
    expect(result.rejected).toBe(true);
    expect(fixture.room.snapshotVersion).toBe(previousSnapshotVersion);
  });

  it("command-rejected 事件仍然会返回给请求玩家", () => {
    const fixture = createStartedRoomFixture(3);
    const requester = fixture.room.gameState!.currentPlayerId;
    const requesterConnection = fixture.connectionRegistry.getConnectionByPlayerId(requester)!;

    dispatchCommand({
      roomManager: fixture.roomManager,
      connectionRegistry: fixture.connectionRegistry,
      message: createCommandMessage({
        roomId: fixture.room.roomId,
        playerId: requester,
        command: {
          type: "say-uno",
          playerId: requester,
          timestampMs: 1000
        }
      })
    });

    expect(
      requesterConnection.sentMessages.some((message) => {
        return (
          message.type === "events" &&
          message.events.some((event) => event.type === "command-rejected")
        );
      })
    ).toBe(true);
  });
});
