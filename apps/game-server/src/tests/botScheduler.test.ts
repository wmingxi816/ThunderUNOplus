import { describe, expect, it } from "vitest";
import { createNumberCard } from "@thunder-uno/uno-core";
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
});
