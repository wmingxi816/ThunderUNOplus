import { describe, expect, it, vi } from "vitest";
import { createNumberCard, type GameState } from "@thunder-uno/uno-core";
import { BotScheduler } from "../bot/botScheduler";
import { createWaitingRoomFixture } from "./testUtils";

describe("BotScheduler", () => {
  it("机器人轮到自己后会延迟执行合法动作", async () => {
    const fixture = createWaitingRoomFixture(2, "no-challenge");
    const bot = fixture.roomManager.addBot({
      roomId: fixture.room.roomId,
      playerId: fixture.room.ownerPlayerId
    }).botPlayer;

    fixture.roomManager.startGame({
      roomId: fixture.room.roomId,
      playerId: fixture.room.ownerPlayerId,
      seed: 1001
    });

    const state = fixture.room.gameState!;
    state.initialDirectionChoice = {
      active: false,
      chooserPlayerId: null
    };
    const topCard = createNumberCard("bot-test-top-red-5", "red", 5);
    const botCard = createNumberCard("bot-test-red-7", "red", 7);
    const botGamePlayer = state.players.find((player) => player.id === bot.playerId)!;

    state.topCard = topCard;
    state.currentColor = "red";
    state.discardPile = [topCard];
    state.currentPlayerId = bot.playerId;
    botGamePlayer.hand = [botCard];
    botGamePlayer.handCount = 1;

    const scheduler = new BotScheduler({
      roomManager: fixture.roomManager,
      connectionRegistry: fixture.connectionRegistry,
      thinkMs: 1,
      random: () => 0.9
    });

    scheduler.scheduleRoom(fixture.room.roomId);
    await new Promise((resolve) => setTimeout(resolve, 20));
    scheduler.dispose();

    expect(fixture.room.status).toBe("finished");
    expect(fixture.room.gameState!.winnerPlayerIds).toContain(bot.playerId);
  });
  it("uses the shorter draw delay for consecutive bot penalty draws", async () => {
    vi.useFakeTimers();

    try {
      const fixture = createWaitingRoomFixture(2, "no-challenge");
      const bot = fixture.roomManager.addBot({
        roomId: fixture.room.roomId,
        playerId: fixture.room.ownerPlayerId
      }).botPlayer;

      fixture.roomManager.startGame({
        roomId: fixture.room.roomId,
        playerId: fixture.room.ownerPlayerId,
        seed: 1001
      });

      const state = fixture.room.gameState!;
      state.initialDirectionChoice = {
        active: false,
        chooserPlayerId: null
      };
      const topCard = createNumberCard("bot-draw-top-red-5", "red", 5);
      const botGamePlayer = state.players.find((player) => player.id === bot.playerId)!;

      state.topCard = topCard;
      state.currentColor = "red";
      state.discardPile = [topCard];
      state.currentPlayerId = bot.playerId;
      state.drawUntilColor = {
        active: true,
        color: "red",
        targetPlayerId: bot.playerId
      };
      state.drawPile = [
        createNumberCard("bot-draw-blue-1", "blue", 1),
        createNumberCard("bot-draw-red-2", "red", 2)
      ];
      botGamePlayer.hand = [];
      botGamePlayer.handCount = 0;

      const scheduler = new BotScheduler({
        roomManager: fixture.roomManager,
        connectionRegistry: fixture.connectionRegistry,
        thinkMs: 20,
        drawThinkMs: 5,
        random: () => 0.9
      });

      scheduler.scheduleRoom(fixture.room.roomId);
      await vi.advanceTimersByTimeAsync(19);
      expect(botGamePlayer.handCount).toBe(0);

      await vi.advanceTimersByTimeAsync(1);
      let refreshedBot = fixture.room.gameState!.players.find(
        (player) => player.id === bot.playerId
      )!;
      expect(refreshedBot.handCount).toBe(1);
      expect(fixture.room.gameState!.drawUntilColor.active).toBe(true);

      await vi.advanceTimersByTimeAsync(4);
      refreshedBot = fixture.room.gameState!.players.find(
        (player) => player.id === bot.playerId
      )!;
      expect(refreshedBot.handCount).toBe(1);

      await vi.advanceTimersByTimeAsync(1);
      refreshedBot = fixture.room.gameState!.players.find(
        (player) => player.id === bot.playerId
      )!;
      expect(refreshedBot.handCount).toBe(2);
      expect(fixture.room.gameState!.drawUntilColor.active).toBe(false);

      scheduler.dispose();
    } finally {
      vi.useRealTimers();
    }
  });
  it("treats missing initial direction choice as an inactive legacy state", async () => {
    const fixture = createWaitingRoomFixture(2, "no-challenge");
    const bot = fixture.roomManager.addBot({
      roomId: fixture.room.roomId,
      playerId: fixture.room.ownerPlayerId
    }).botPlayer;

    fixture.roomManager.startGame({
      roomId: fixture.room.roomId,
      playerId: fixture.room.ownerPlayerId,
      seed: 1001
    });

    const state = fixture.room.gameState!;
    delete (state as Partial<GameState>).initialDirectionChoice;
    const topCard = createNumberCard("legacy-bot-top-red-5", "red", 5);
    const botCard = createNumberCard("legacy-bot-red-7", "red", 7);
    const botGamePlayer = state.players.find((player) => player.id === bot.playerId)!;

    state.topCard = topCard;
    state.currentColor = "red";
    state.discardPile = [topCard];
    state.currentPlayerId = bot.playerId;
    botGamePlayer.hand = [botCard];
    botGamePlayer.handCount = 1;

    const scheduler = new BotScheduler({
      roomManager: fixture.roomManager,
      connectionRegistry: fixture.connectionRegistry,
      thinkMs: 1,
      random: () => 0.9
    });

    scheduler.scheduleRoom(fixture.room.roomId);
    await new Promise((resolve) => setTimeout(resolve, 20));
    scheduler.dispose();

    expect(fixture.room.status).toBe("finished");
    expect(fixture.room.gameState!.winnerPlayerIds).toContain(bot.playerId);
  });
});
