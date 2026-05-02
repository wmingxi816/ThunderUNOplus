import { describe, expect, it } from "vitest";
import { GameServerError } from "../errors/serverErrors";
import {
  createTestServerContext,
  createWaitingRoomFixture,
  registerMockConnections
} from "./testUtils";

describe("RoomManager", () => {
  it("createRoom 会生成 6 位 roomId", () => {
    const { connectionRegistry, roomManager } = createTestServerContext();
    const [connection] = registerMockConnections(connectionRegistry, 1);

    const result = roomManager.createRoom({
      userId: connection!.userId,
      connectionId: connection!.connectionId,
      nickname: "Owner",
      avatarUrl: null,
      mode: "no-challenge"
    });

    expect(result.room.roomId).toMatch(/^\d{6}$/);
  });

  it("createRoom 后房主 seatIndex 为 0", () => {
    const fixture = createWaitingRoomFixture(1);

    expect(fixture.room.players[0]!.seatIndex).toBe(0);
  });

  it("createRoom 后 status 为 waiting", () => {
    const fixture = createWaitingRoomFixture(1);

    expect(fixture.room.status).toBe("waiting");
  });

  it("joinRoom 可以加入等待中的房间", () => {
    const fixture = createWaitingRoomFixture(2);

    expect(fixture.room.players).toHaveLength(2);
  });

  it("joinRoom 会给玩家分配递增 seatIndex", () => {
    const fixture = createWaitingRoomFixture(3);

    expect(fixture.room.players.map((player) => player.seatIndex)).toEqual([0, 1, 2]);
  });

  it("满 8 人后不能继续加入", () => {
    const fixture = createWaitingRoomFixture(8);
    const extraConnection = registerMockConnections(
      fixture.connectionRegistry,
      1,
      9
    )[0]!;

    expect(() => {
      fixture.roomManager.joinRoom({
        roomId: fixture.room.roomId,
        userId: extraConnection.userId,
        connectionId: extraConnection.connectionId,
        nickname: "Extra",
        avatarUrl: null
      });
    }).toThrowError(GameServerError);
  });

  it("同一个 userId 重复 joinRoom 会被视为重连，不新增玩家", () => {
    const fixture = createWaitingRoomFixture(2);
    const reconnectConnection = registerMockConnections(
      fixture.connectionRegistry,
      1,
      3
    )[0]!;
    reconnectConnection.userId = fixture.connections[1]!.userId;

    const result = fixture.roomManager.joinRoom({
      roomId: fixture.room.roomId,
      userId: reconnectConnection.userId,
      connectionId: reconnectConnection.connectionId,
      nickname: "Player 2 Reconnected",
      avatarUrl: null
    });

    expect(result.reconnected).toBe(true);
    expect(fixture.room.players).toHaveLength(2);
    expect(result.player.connectionId).toBe(reconnectConnection.connectionId);
  });

  it("非房主不能 startGame", () => {
    const fixture = createWaitingRoomFixture(3);

    expect(() => {
      fixture.roomManager.startGame({
        roomId: fixture.room.roomId,
        playerId: fixture.room.players[1]!.playerId
      });
    }).toThrowError(GameServerError);
  });

  it("少于 3 人不能 startGame", () => {
    const fixture = createWaitingRoomFixture(2);

    expect(() => {
      fixture.roomManager.startGame({
        roomId: fixture.room.roomId,
        playerId: fixture.room.ownerPlayerId
      });
    }).toThrowError(GameServerError);
  });

  it("3 到 8 人可以 startGame", () => {
    for (const playerCount of [3, 8]) {
      const fixture = createWaitingRoomFixture(playerCount);

      expect(() => {
        fixture.roomManager.startGame({
          roomId: fixture.room.roomId,
          playerId: fixture.room.ownerPlayerId,
          seed: 1001
        });
      }).not.toThrow();
    }
  });

  it("startGame 后 room.status 为 playing", () => {
    const fixture = createWaitingRoomFixture(3);

    fixture.roomManager.startGame({
      roomId: fixture.room.roomId,
      playerId: fixture.room.ownerPlayerId,
      seed: 1001
    });

    expect(fixture.room.status).toBe("playing");
  });

  it("startGame 后 gameState 不为空", () => {
    const fixture = createWaitingRoomFixture(3);

    fixture.roomManager.startGame({
      roomId: fixture.room.roomId,
      playerId: fixture.room.ownerPlayerId,
      seed: 1001
    });

    expect(fixture.room.gameState).not.toBeNull();
  });
});
