import { describe, expect, it } from "vitest";
import { GameServerError } from "../errors/serverErrors";
import {
  createTestServerContext,
  createStartedRoomFixture,
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

  it("createRoom 支持未占用的 6 位自定义 roomId", () => {
    const { connectionRegistry, roomManager } = createTestServerContext();
    const [connection] = registerMockConnections(connectionRegistry, 1);

    const result = roomManager.createRoom({
      userId: connection!.userId,
      connectionId: connection!.connectionId,
      nickname: "Owner",
      avatarUrl: null,
      mode: "no-challenge",
      roomId: "123456"
    });

    expect(result.room.roomId).toBe("123456");
  });

  it("createRoom 会拒绝格式错误或已占用的自定义 roomId", () => {
    const { connectionRegistry, roomManager } = createTestServerContext();
    const [firstConnection, secondConnection, thirdConnection] = registerMockConnections(
      connectionRegistry,
      3
    );

    expect(() => {
      roomManager.createRoom({
        userId: firstConnection!.userId,
        connectionId: firstConnection!.connectionId,
        nickname: "Owner",
        avatarUrl: null,
        mode: "no-challenge",
        roomId: "ABC123"
      });
    }).toThrowError(GameServerError);

    roomManager.createRoom({
      userId: secondConnection!.userId,
      connectionId: secondConnection!.connectionId,
      nickname: "Owner 2",
      avatarUrl: null,
      mode: "no-challenge",
      roomId: "654321"
    });

    expect(() => {
      roomManager.createRoom({
        userId: thirdConnection!.userId,
        connectionId: thirdConnection!.connectionId,
        nickname: "Owner 3",
        avatarUrl: null,
        mode: "no-challenge",
        roomId: "654321"
      });
    }).toThrowError(GameServerError);
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

  it("新加入玩家默认未准备，房主默认视为已准备", () => {
    const { connectionRegistry, roomManager } = createTestServerContext();
    const [ownerConnection, joinerConnection] = registerMockConnections(
      connectionRegistry,
      2
    );
    const room = roomManager.createRoom({
      userId: ownerConnection!.userId,
      connectionId: ownerConnection!.connectionId,
      nickname: "Owner",
      avatarUrl: null,
      mode: "no-challenge"
    }).room;

    roomManager.joinRoom({
      roomId: room.roomId,
      userId: joinerConnection!.userId,
      connectionId: joinerConnection!.connectionId,
      nickname: "Joiner",
      avatarUrl: null
    });

    expect(room.players[0]!.isReady).toBe(true);
    expect(room.players[1]!.isReady).toBe(false);
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
      nickname: "玩家2重连",
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

  it("有人未准备时不能 startGame", () => {
    const { connectionRegistry, roomManager } = createTestServerContext();
    const connections = registerMockConnections(connectionRegistry, 3);
    const room = roomManager.createRoom({
      userId: connections[0]!.userId,
      connectionId: connections[0]!.connectionId,
      nickname: "Owner",
      avatarUrl: null,
      mode: "no-challenge"
    }).room;

    for (let index = 1; index < connections.length; index += 1) {
      roomManager.joinRoom({
        roomId: room.roomId,
        userId: connections[index]!.userId,
        connectionId: connections[index]!.connectionId,
        nickname: `Player ${String(index + 1)}`,
        avatarUrl: null
      });
    }

    expect(() => {
      roomManager.startGame({
        roomId: room.roomId,
        playerId: room.ownerPlayerId
      });
    }).toThrowError(GameServerError);

    for (const player of room.players.filter((candidate) => !candidate.isReady)) {
      roomManager.setPlayerReady({
        roomId: room.roomId,
        playerId: player.playerId,
        ready: true
      });
    }

    expect(() => {
      roomManager.startGame({
        roomId: room.roomId,
        playerId: room.ownerPlayerId,
        seed: 1001
      });
    }).not.toThrow();
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

  it("房主可以在无质疑等待房间添加机器人", () => {
    const fixture = createWaitingRoomFixture(1, "no-challenge");

    const result = fixture.roomManager.addBot({
      roomId: fixture.room.roomId,
      playerId: fixture.room.ownerPlayerId
    });

    expect(result.botPlayer.isBot).toBe(true);
    expect(result.botPlayer.isReady).toBe(true);
    expect(result.botPlayer.connected).toBe(true);
    expect(result.botPlayer.connectionId).toBeNull();
    expect(result.room.players).toHaveLength(2);
  });

  it("addBot 会根据 botType 写入不同昵称和策略", () => {
    const fixture = createWaitingRoomFixture(1, "no-challenge");

    const strongBot1 = fixture.roomManager.addBot({
      roomId: fixture.room.roomId,
      playerId: fixture.room.ownerPlayerId,
      botType: "strong"
    }).botPlayer;
    const chaosBot1 = fixture.roomManager.addBot({
      roomId: fixture.room.roomId,
      playerId: fixture.room.ownerPlayerId,
      botType: "chaos"
    }).botPlayer;
    const strongBot2 = fixture.roomManager.addBot({
      roomId: fixture.room.roomId,
      playerId: fixture.room.ownerPlayerId,
      botType: "strong"
    }).botPlayer;
    const chaosBot2 = fixture.roomManager.addBot({
      roomId: fixture.room.roomId,
      playerId: fixture.room.ownerPlayerId,
      botType: "chaos"
    }).botPlayer;
    const mischiefBot1 = fixture.roomManager.addBot({
      roomId: fixture.room.roomId,
      playerId: fixture.room.ownerPlayerId,
      botType: "mischief"
    }).botPlayer;
    const mischiefBot2 = fixture.roomManager.addBot({
      roomId: fixture.room.roomId,
      playerId: fixture.room.ownerPlayerId,
      botType: "mischief"
    }).botPlayer;

    expect(strongBot1.nickname).toBe("最强bot1");
    expect(strongBot1.botProfile?.strategy).toBe("greedy-v1");
    expect(chaosBot1.nickname).toBe("混沌bot1");
    expect(chaosBot1.botProfile?.strategy).toBe("chaos-v1");
    expect(strongBot2.nickname).toBe("最强bot2");
    expect(strongBot2.botProfile?.strategy).toBe("greedy-v1");
    expect(chaosBot2.nickname).toBe("混沌bot2");
    expect(chaosBot2.botProfile?.strategy).toBe("chaos-v1");
    expect(mischiefBot1.nickname).toBe("胡闹bot1");
    expect(mischiefBot1.botProfile?.strategy).toBe("mischief-v1");
    expect(mischiefBot2.nickname).toBe("胡闹bot2");
    expect(mischiefBot2.botProfile?.strategy).toBe("mischief-v1");
  });

  it("有质疑模式不能添加机器人", () => {
    const fixture = createWaitingRoomFixture(1, "with-challenge");

    expect(() => {
      fixture.roomManager.addBot({
        roomId: fixture.room.roomId,
        playerId: fixture.room.ownerPlayerId
      });
    }).toThrowError(GameServerError);
  });

  it("房主可以在大厅踢出普通玩家或机器人", () => {
    const fixture = createWaitingRoomFixture(2, "no-challenge");
    const humanPlayerId = fixture.room.players[1]!.playerId;
    const bot = fixture.roomManager.addBot({
      roomId: fixture.room.roomId,
      playerId: fixture.room.ownerPlayerId
    }).botPlayer;

    const removedHuman = fixture.roomManager.kickPlayer({
      roomId: fixture.room.roomId,
      playerId: fixture.room.ownerPlayerId,
      targetPlayerId: humanPlayerId
    });

    expect(removedHuman.removedPlayerId).toBe(humanPlayerId);
    expect(fixture.room.players.some((player) => player.playerId === humanPlayerId)).toBe(false);

    const removedBot = fixture.roomManager.kickPlayer({
      roomId: fixture.room.roomId,
      playerId: fixture.room.ownerPlayerId,
      targetPlayerId: bot.playerId
    });

    expect(removedBot.removedPlayerId).toBe(bot.playerId);
    expect(fixture.room.players.some((player) => player.playerId === bot.playerId)).toBe(false);
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

  it("restartGame 会保留房间和玩家并重新开局", () => {
    const fixture = createStartedRoomFixture(3);
    const previousGameState = fixture.room.gameState;

    fixture.room.gameState!.players[1]!.isEliminated = true;

    const result = fixture.roomManager.restartGame({
      roomId: fixture.room.roomId,
      playerId: fixture.room.ownerPlayerId,
      seed: 2002
    });

    expect(result.room).toBe(fixture.room);
    expect(result.room.players).toHaveLength(3);
    expect(result.room.gameState).not.toBe(previousGameState);
    expect(result.room.gameState!.players.every((player) => !player.isEliminated)).toBe(true);
  });

  it("continueGame 会让胜利玩家留座但跳过其回合", () => {
    const fixture = createStartedRoomFixture(3);
    const gameState = fixture.room.gameState!;
    const winner = gameState.players[0]!;

    gameState.status = "finished";
    gameState.currentPlayerId = winner.id;
    gameState.winnerPlayerIds = [winner.id];
    winner.isRoundWinner = true;
    fixture.room.status = "finished";

    const result = fixture.roomManager.continueGame({
      roomId: fixture.room.roomId,
      playerId: fixture.room.ownerPlayerId
    });

    expect(result.room.status).toBe("playing");
    expect(result.room.gameState!.status).toBe("in-progress");
    expect(result.room.gameState!.currentPlayerId).not.toBe(winner.id);
    expect(result.room.gameState!.players[0]!.isRoundWinner).toBe(true);
  });

  it("playing 中房主主动离房时会把房主顺位给下一位仍在房间中的玩家", () => {
    const fixture = createStartedRoomFixture(4);
    const leavingOwnerId = fixture.room.ownerPlayerId;

    const result = fixture.roomManager.leaveRoom({
      roomId: fixture.room.roomId,
      playerId: leavingOwnerId,
      markLeft: true
    });

    expect(result.room).not.toBeNull();
    expect(result.room!.ownerPlayerId).toBe(fixture.room.players[1]!.playerId);
  });

  it("房主被淘汰后主动离房且仍有至少两名活跃玩家时会自动继续游戏", () => {
    const fixture = createStartedRoomFixture(4);
    const gameState = fixture.room.gameState!;
    const ownerId = fixture.room.ownerPlayerId;
    const ownerGamePlayer = gameState.players.find((player) => player.id === ownerId)!;

    ownerGamePlayer.isEliminated = true;
    ownerGamePlayer.handCount = 26;
    fixture.room.status = "finished";
    gameState.status = "finished";
    gameState.currentPlayerId = ownerId;

    const result = fixture.roomManager.leaveRoom({
      roomId: fixture.room.roomId,
      playerId: ownerId,
      markLeft: true
    });

    expect(result.room).not.toBeNull();
    expect(result.room!.ownerPlayerId).toBe(fixture.room.players[1]!.playerId);
    expect(result.room!.status).toBe("playing");
    expect(result.room!.gameState!.status).toBe("in-progress");
    expect(result.room!.gameState!.currentPlayerId).not.toBe(ownerId);
  });

  it("房主被淘汰后主动离房但活跃玩家不足两名时不会自动继续", () => {
    const fixture = createStartedRoomFixture(3);
    const gameState = fixture.room.gameState!;
    const ownerId = fixture.room.ownerPlayerId;
    const ownerGamePlayer = gameState.players.find((player) => player.id === ownerId)!;
    const otherPlayers = gameState.players.filter((player) => player.id !== ownerId);

    ownerGamePlayer.isEliminated = true;
    ownerGamePlayer.handCount = 26;
    otherPlayers[0]!.isRoundWinner = true;
    gameState.winnerPlayerIds = [otherPlayers[0]!.id];
    fixture.room.status = "finished";
    gameState.status = "finished";
    gameState.currentPlayerId = ownerId;

    const result = fixture.roomManager.leaveRoom({
      roomId: fixture.room.roomId,
      playerId: ownerId,
      markLeft: true
    });

    expect(result.room).not.toBeNull();
    expect(result.room!.ownerPlayerId).toBe(fixture.room.players[1]!.playerId);
    expect(result.room!.status).toBe("finished");
    expect(result.room!.gameState!.status).toBe("finished");
  });

  it("非房主不能 restartGame 或 continueGame", () => {
    const fixture = createStartedRoomFixture(3);
    fixture.room.gameState!.players[1]!.isEliminated = true;

    expect(() => {
      fixture.roomManager.restartGame({
        roomId: fixture.room.roomId,
        playerId: fixture.room.players[1]!.playerId
      });
    }).toThrowError(GameServerError);

    expect(() => {
      fixture.roomManager.continueGame({
        roomId: fixture.room.roomId,
        playerId: fixture.room.players[1]!.playerId
      });
    }).toThrowError(GameServerError);
  });
  it("playing 中主动离开后可以用房间号重新加入并保留原手牌", () => {
    const fixture = createStartedRoomFixture(3);
    const leaver = fixture.room.players[1]!;
    const originalPlayerId = leaver.playerId;
    const originalHandIds = fixture.room.gameState!.players
      .find((player) => player.id === originalPlayerId)!
      .hand.map((card) => card.id);
    const newConnection = registerMockConnections(
      fixture.connectionRegistry,
      1,
      20
    )[0]!;
    newConnection.userId = leaver.userId;

    fixture.roomManager.leaveRoom({
      roomId: fixture.room.roomId,
      playerId: originalPlayerId,
      markLeft: true
    });

    expect(leaver.hasLeftRoom).toBe(true);
    expect(
      fixture.room.gameState!.players.find((player) => player.id === originalPlayerId)
        ?.hasLeftRoom
    ).toBe(true);

    const result = fixture.roomManager.joinRoom({
      roomId: fixture.room.roomId,
      userId: leaver.userId,
      connectionId: newConnection.connectionId,
      nickname: "回归玩家",
      avatarUrl: null
    });
    const restoredGamePlayer = fixture.room.gameState!.players.find(
      (player) => player.id === originalPlayerId
    )!;

    expect(result.reconnected).toBe(true);
    expect(result.player.playerId).toBe(originalPlayerId);
    expect(result.player.hasLeftRoom).toBe(false);
    expect(restoredGamePlayer.hasLeftRoom).toBe(false);
    expect(restoredGamePlayer.displayName).toBe("回归玩家");
    expect(restoredGamePlayer.hand.map((card) => card.id)).toEqual(originalHandIds);
    expect(fixture.room.players).toHaveLength(3);
  });

  it("playing 中新 userId 不能通过 joinRoom 插入已开局房间", () => {
    const fixture = createStartedRoomFixture(3);
    const newConnection = registerMockConnections(
      fixture.connectionRegistry,
      1,
      30
    )[0]!;

    expect(() => {
      fixture.roomManager.joinRoom({
        roomId: fixture.room.roomId,
        userId: newConnection.userId,
        connectionId: newConnection.connectionId,
        nickname: "Late Joiner",
        avatarUrl: null
      });
    }).toThrowError(GameServerError);
  });

  it("left round winner can rejoin before restart and keep winner state", () => {
    const fixture = createStartedRoomFixture(3);
    const winnerRoomPlayer = fixture.room.players[1]!;
    const winnerGamePlayer = fixture.room.gameState!.players.find(
      (player) => player.id === winnerRoomPlayer.playerId
    )!;
    const originalHandIds = winnerGamePlayer.hand.map((card) => card.id);
    const newConnection = registerMockConnections(
      fixture.connectionRegistry,
      1,
      40
    )[0]!;
    newConnection.userId = winnerRoomPlayer.userId;

    fixture.room.status = "finished";
    fixture.room.gameState!.status = "finished";
    fixture.room.gameState!.winnerPlayerIds = [winnerRoomPlayer.playerId];
    winnerGamePlayer.isRoundWinner = true;

    fixture.roomManager.leaveRoom({
      roomId: fixture.room.roomId,
      playerId: winnerRoomPlayer.playerId,
      markLeft: true
    });

    expect(winnerRoomPlayer.hasLeftRoom).toBe(true);
    expect(winnerGamePlayer.hasLeftRoom).toBe(true);
    expect(winnerGamePlayer.isRoundWinner).toBe(true);

    const result = fixture.roomManager.joinRoom({
      roomId: fixture.room.roomId,
      userId: winnerRoomPlayer.userId,
      connectionId: newConnection.connectionId,
      nickname: "回归赢家",
      avatarUrl: null
    });
    const restoredWinner = fixture.room.gameState!.players.find(
      (player) => player.id === winnerRoomPlayer.playerId
    )!;

    expect(result.player.playerId).toBe(winnerRoomPlayer.playerId);
    expect(restoredWinner.hasLeftRoom).toBe(false);
    expect(restoredWinner.isRoundWinner).toBe(true);
    expect(fixture.room.gameState!.winnerPlayerIds).toContain(winnerRoomPlayer.playerId);
    expect(restoredWinner.hand.map((card) => card.id)).toEqual(originalHandIds);
  });

  it("restartGame removes left players who did not return before the new round", () => {
    const fixture = createStartedRoomFixture(4);
    const leftPlayer = fixture.room.players[3]!;

    fixture.room.gameState!.players[0]!.isEliminated = true;
    fixture.roomManager.leaveRoom({
      roomId: fixture.room.roomId,
      playerId: leftPlayer.playerId,
      markLeft: true
    });

    const result = fixture.roomManager.restartGame({
      roomId: fixture.room.roomId,
      playerId: fixture.room.ownerPlayerId,
      seed: 3003
    });

    expect(result.room.players).toHaveLength(3);
    expect(result.room.players.some((player) => player.playerId === leftPlayer.playerId)).toBe(false);
    expect(result.room.gameState!.players.some((player) => player.id === leftPlayer.playerId)).toBe(false);
    expect(result.room.gameState!.playerOrder).not.toContain(leftPlayer.playerId);
    expect(result.room.players.map((player) => player.seatIndex)).toEqual([0, 1, 2]);
  });

  it("restartGame refuses pruning when too few players would remain", () => {
    const fixture = createStartedRoomFixture(3);
    const leftPlayer = fixture.room.players[2]!;

    fixture.room.gameState!.players[0]!.isEliminated = true;
    fixture.roomManager.leaveRoom({
      roomId: fixture.room.roomId,
      playerId: leftPlayer.playerId,
      markLeft: true
    });

    expect(() => {
      fixture.roomManager.restartGame({
        roomId: fixture.room.roomId,
        playerId: fixture.room.ownerPlayerId,
        seed: 3004
      });
    }).toThrowError(GameServerError);
    expect(fixture.room.players).toHaveLength(3);
    expect(fixture.room.players.some((player) => player.playerId === leftPlayer.playerId)).toBe(true);
  });

  it("renamePlayer updates lobby player nickname", () => {
    const fixture = createWaitingRoomFixture(3);
    const player = fixture.room.players[1]!;

    const result = fixture.roomManager.renamePlayer({
      roomId: fixture.room.roomId,
      playerId: player.playerId,
      nickname: "  New Name  "
    });

    expect(result.player.nickname).toBe("New Name");
    expect(fixture.room.players[1]!.nickname).toBe("New Name");
  });

  it("renamePlayer updates active game displayName", () => {
    const fixture = createStartedRoomFixture(3);
    const player = fixture.room.players[1]!;

    fixture.roomManager.renamePlayer({
      roomId: fixture.room.roomId,
      playerId: player.playerId,
      nickname: "战斗名"
    });

    expect(fixture.room.players[1]!.nickname).toBe("战斗名");
    expect(
      fixture.room.gameState!.players.find((candidate) => candidate.id === player.playerId)
        ?.displayName
    ).toBe("战斗名");
  });

  it("renamePlayer rejects bot and overlong nicknames", () => {
    const fixture = createWaitingRoomFixture(3, "no-challenge");
    const bot = fixture.roomManager.addBot({
      roomId: fixture.room.roomId,
      playerId: fixture.room.ownerPlayerId
    }).botPlayer;

    expect(() => {
      fixture.roomManager.renamePlayer({
        roomId: fixture.room.roomId,
        playerId: bot.playerId,
        nickname: "Bot Rename"
      });
    }).toThrowError(GameServerError);

    expect(() => {
      fixture.roomManager.renamePlayer({
        roomId: fixture.room.roomId,
        playerId: fixture.room.players[1]!.playerId,
        nickname: "12345678901"
      });
    }).toThrowError(GameServerError);
  });
});
