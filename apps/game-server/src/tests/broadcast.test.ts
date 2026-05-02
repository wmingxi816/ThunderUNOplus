import { describe, expect, it } from "vitest";
import { broadcastRoomState } from "../broadcast/broadcastRoomState";
import { sendSnapshotsToRoom } from "../broadcast/sendSnapshotsToRoom";
import { createStartedRoomFixture, createWaitingRoomFixture } from "./testUtils";

describe("broadcast", () => {
  it("waiting 房间可以广播 room-state", () => {
    const fixture = createWaitingRoomFixture(3);
    const sentMessages = broadcastRoomState(
      fixture.room,
      fixture.connectionRegistry
    );

    expect(sentMessages).toHaveLength(3);
    expect(sentMessages[0]!.type).toBe("room-state");
    expect(sentMessages[0]!.room).toMatchObject({
      roomId: fixture.room.roomId,
      status: "lobby"
    });
  });

  it("玩家 A 的 snapshot 能看到 A 的完整手牌", () => {
    const fixture = createStartedRoomFixture(3);

    sendSnapshotsToRoom(fixture.room, fixture.connectionRegistry);

    const playerA = fixture.room.players[0]!;
    const connectionA = fixture.connectionRegistry.getConnectionByPlayerId(playerA.playerId)!;
    const snapshotMessage = connectionA.sentMessages.find(
      (message) => message.type === "snapshot"
    );

    if (snapshotMessage === undefined || !("self" in snapshotMessage.snapshot)) {
      throw new Error("Expected snapshot message for player A.");
    }

    expect(snapshotMessage.snapshot.self.playerId).toBe(playerA.playerId);
    expect(snapshotMessage.snapshot.self.hand).toHaveLength(
      fixture.room.gameState!.players[0]!.handCount
    );
  });

  it("玩家 A 的 snapshot 看不到 B 的完整手牌", () => {
    const fixture = createStartedRoomFixture(3);

    sendSnapshotsToRoom(fixture.room, fixture.connectionRegistry);

    const playerA = fixture.room.players[0]!;
    const connectionA = fixture.connectionRegistry.getConnectionByPlayerId(playerA.playerId)!;
    const snapshotMessage = connectionA.sentMessages.find(
      (message) => message.type === "snapshot"
    );

    if (
      snapshotMessage === undefined ||
      !("opponents" in snapshotMessage.snapshot)
    ) {
      throw new Error("Expected a player game snapshot for player A.");
    }

    expect("hand" in snapshotMessage.snapshot.opponents[0]!).toBe(false);
  });

  it("玩家 B 的 snapshot 能看到 B 的完整手牌", () => {
    const fixture = createStartedRoomFixture(3);

    sendSnapshotsToRoom(fixture.room, fixture.connectionRegistry);

    const playerB = fixture.room.players[1]!;
    const connectionB = fixture.connectionRegistry.getConnectionByPlayerId(playerB.playerId)!;
    const snapshotMessage = connectionB.sentMessages.find(
      (message) => message.type === "snapshot"
    );

    if (snapshotMessage === undefined || !("self" in snapshotMessage.snapshot)) {
      throw new Error("Expected a player game snapshot for player B.");
    }

    const gameStatePlayer = fixture.room.gameState!.players.find(
      (player) => player.id === playerB.playerId
    )!;

    expect(snapshotMessage.snapshot.self.playerId).toBe(playerB.playerId);
    expect(snapshotMessage.snapshot.self.hand).toHaveLength(gameStatePlayer.handCount);
  });

  it("snapshot 不包含 hadBlackCardBeforeDraw", () => {
    const fixture = createStartedRoomFixture(3);

    sendSnapshotsToRoom(fixture.room, fixture.connectionRegistry);

    const playerA = fixture.room.players[0]!;
    const connectionA = fixture.connectionRegistry.getConnectionByPlayerId(playerA.playerId)!;
    const snapshotMessage = connectionA.sentMessages.find(
      (message) => message.type === "snapshot"
    );

    if (
      snapshotMessage === undefined ||
      !("challengeWindow" in snapshotMessage.snapshot)
    ) {
      throw new Error("Expected a player game snapshot.");
    }

    expect("hadBlackCardBeforeDraw" in snapshotMessage.snapshot.challengeWindow).toBe(false);
  });

  it("snapshot 不包含完整 drawPile", () => {
    const fixture = createStartedRoomFixture(3);

    sendSnapshotsToRoom(fixture.room, fixture.connectionRegistry);

    const playerA = fixture.room.players[0]!;
    const connectionA = fixture.connectionRegistry.getConnectionByPlayerId(playerA.playerId)!;
    const snapshotMessage = connectionA.sentMessages.find(
      (message) => message.type === "snapshot"
    );

    if (snapshotMessage === undefined) {
      throw new Error("Expected a snapshot message.");
    }

    expect("drawPile" in (snapshotMessage.snapshot as Record<string, unknown>)).toBe(false);
  });
});
