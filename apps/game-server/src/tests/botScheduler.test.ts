import { describe, expect, it, vi } from "vitest";
import {
  createColoredActionCard,
  createNumberCard,
  type GameState
} from "@thunder-uno/uno-core";
import { BotScheduler } from "../bot/botScheduler";
import { createWaitingRoomFixture } from "./testUtils";

describe("BotScheduler", () => {
  it("机器人作为首家时会先随机选择开局方向", async () => {
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
    state.currentPlayerId = bot.playerId;
    state.initialDirectionChoice = {
      active: true,
      chooserPlayerId: bot.playerId
    };

    const scheduler = new BotScheduler({
      roomManager: fixture.roomManager,
      connectionRegistry: fixture.connectionRegistry,
      thinkMs: 1,
      random: () => 0.9
    });

    scheduler.scheduleRoom(fixture.room.roomId);
    await new Promise((resolve) => setTimeout(resolve, 20));
    scheduler.dispose();

    expect(fixture.room.gameState!.initialDirectionChoice.active).toBe(false);
    expect(fixture.room.gameState!.direction).toBe("counter-clockwise");
  });

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

  it("calls UNO on the third second for a pending bot with the default 80 percent chance", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);

    try {
      const fixture = createPendingBotUnoFixture();
      const scheduler = new BotScheduler({
        roomManager: fixture.roomManager,
        connectionRegistry: fixture.connectionRegistry,
        thinkMs: 20,
        random: () => 0.9
      });

      scheduler.scheduleRoom(fixture.room.roomId);
      await vi.advanceTimersByTimeAsync(2_999);
      expect(getGamePlayer(fixture.room.gameState!, fixture.bot.playerId).hasCalledUno).toBe(false);

      await vi.advanceTimersByTimeAsync(1);
      expect(getGamePlayer(fixture.room.gameState!, fixture.bot.playerId).hasCalledUno).toBe(true);

      scheduler.dispose();
    } finally {
      vi.useRealTimers();
    }
  });

  it("forces a pending bot to call UNO on the sixth second when the third-second check is missed", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(20_000);

    try {
      const fixture = createPendingBotUnoFixture();
      const scheduler = new BotScheduler({
        roomManager: fixture.roomManager,
        connectionRegistry: fixture.connectionRegistry,
        thinkMs: 20,
        random: () => 0.1
      });

      scheduler.scheduleRoom(fixture.room.roomId);
      await vi.advanceTimersByTimeAsync(3_000);
      expect(getGamePlayer(fixture.room.gameState!, fixture.bot.playerId).hasCalledUno).toBe(false);

      await vi.advanceTimersByTimeAsync(2_999);
      expect(getGamePlayer(fixture.room.gameState!, fixture.bot.playerId).hasCalledUno).toBe(false);

      await vi.advanceTimersByTimeAsync(1);
      expect(getGamePlayer(fixture.room.gameState!, fixture.bot.playerId).hasCalledUno).toBe(true);

      scheduler.dispose();
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not repeat delayed UNO when the bot no longer has exactly one pending card", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(30_000);

    try {
      const fixture = createPendingBotUnoFixture();
      const scheduler = new BotScheduler({
        roomManager: fixture.roomManager,
        connectionRegistry: fixture.connectionRegistry,
        thinkMs: 20,
        random: () => 0.1
      });

      scheduler.scheduleRoom(fixture.room.roomId);
      await vi.advanceTimersByTimeAsync(3_000);
      expect(getGamePlayer(fixture.room.gameState!, fixture.bot.playerId).hasCalledUno).toBe(false);

      fixture.botGamePlayer.hand.push(createNumberCard("bot-extra-blue-1", "blue", 1));
      fixture.botGamePlayer.handCount = fixture.botGamePlayer.hand.length;
      fixture.botGamePlayer.unoPendingSinceMs = null;

      await vi.advanceTimersByTimeAsync(3_000);
      expect(getGamePlayer(fixture.room.gameState!, fixture.bot.playerId).hasCalledUno).toBe(false);

      scheduler.dispose();
    } finally {
      vi.useRealTimers();
    }
  });

  it("ignores non-bot players that are waiting to call UNO", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(40_000);

    try {
      const fixture = createWaitingRoomFixture(3, "no-challenge");
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
      const human = state.players.find((player) => player.id === fixture.room.ownerPlayerId)!;
      human.hand = [createNumberCard("human-red-1", "red", 1)];
      human.handCount = 1;
      human.unoPendingSinceMs = Date.now();
      human.hasCalledUno = false;

      const scheduler = new BotScheduler({
        roomManager: fixture.roomManager,
        connectionRegistry: fixture.connectionRegistry,
        thinkMs: 20,
        random: () => 0.9
      });

      scheduler.scheduleRoom(fixture.room.roomId);
      await vi.advanceTimersByTimeAsync(6_000);
      expect(human.hasCalledUno).toBe(false);

      scheduler.dispose();
    } finally {
      vi.useRealTimers();
    }
  });

  it("uses the same delayed UNO timing when a bot plays down to one card on its own turn", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(50_000);

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
      const topCard = createNumberCard("bot-own-top-red-5", "red", 5);
      const playedCard = createNumberCard("bot-own-red-7", "red", 7);
      const remainingCard = createColoredActionCard("bot-own-blue-skip", "blue", "skip");
      const botGamePlayer = state.players.find((player) => player.id === bot.playerId)!;

      state.topCard = topCard;
      state.currentColor = "red";
      state.discardPile = [topCard];
      state.currentPlayerId = bot.playerId;
      botGamePlayer.hand = [playedCard, remainingCard];
      botGamePlayer.handCount = botGamePlayer.hand.length;

      const scheduler = new BotScheduler({
        roomManager: fixture.roomManager,
        connectionRegistry: fixture.connectionRegistry,
        thinkMs: 1,
        random: () => 0.9
      });

      scheduler.scheduleRoom(fixture.room.roomId);
      await vi.advanceTimersByTimeAsync(5);
      expect(getGamePlayer(fixture.room.gameState!, bot.playerId).handCount).toBe(1);
      expect(getGamePlayer(fixture.room.gameState!, bot.playerId).hasCalledUno).toBe(false);

      const pendingSinceMs = getGamePlayer(fixture.room.gameState!, bot.playerId).unoPendingSinceMs!;
      const oneMillisecondBeforeChanceCheck = pendingSinceMs + 3_000 - Date.now() - 1;
      await vi.advanceTimersByTimeAsync(oneMillisecondBeforeChanceCheck);
      expect(getGamePlayer(fixture.room.gameState!, bot.playerId).hasCalledUno).toBe(false);

      await vi.advanceTimersByTimeAsync(1);
      expect(getGamePlayer(fixture.room.gameState!, bot.playerId).hasCalledUno).toBe(true);

      scheduler.dispose();
    } finally {
      vi.useRealTimers();
    }
  });

  it("uses chaos-v1 decisions for chaos bots instead of always falling back to greedy", async () => {
    const fixture = createWaitingRoomFixture(3, "no-challenge");
    const bot = fixture.roomManager.addBot({
      roomId: fixture.room.roomId,
      playerId: fixture.room.ownerPlayerId,
      botType: "chaos"
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
    state.direction = "clockwise";
    const topCard = createNumberCard("chaos-top-red-5", "red", 5);
    const reverseCard = createColoredActionCard("chaos-red-reverse", "red", "reverse");
    const numberCard = createNumberCard("chaos-red-9", "red", 9);
    const botGamePlayer = state.players.find((player) => player.id === bot.playerId)!;

    state.topCard = topCard;
    state.currentColor = "red";
    state.discardPile = [topCard];
    state.currentPlayerId = bot.playerId;
    botGamePlayer.hand = [reverseCard, numberCard];
    botGamePlayer.handCount = botGamePlayer.hand.length;

    const playerOrderIndex = state.playerOrder.indexOf(bot.playerId);
    const previousPlayerId =
      state.playerOrder[
        (playerOrderIndex - 1 + state.playerOrder.length) % state.playerOrder.length
      ]!;
    fixture.room.botState.lastUnanswerableColorByPlayerId[previousPlayerId] = "red";

    const scheduler = new BotScheduler({
      roomManager: fixture.roomManager,
      connectionRegistry: fixture.connectionRegistry,
      thinkMs: 1,
      random: () => 0
    });

    scheduler.scheduleRoom(fixture.room.roomId);
    await new Promise((resolve) => setTimeout(resolve, 20));
    scheduler.dispose();

    expect(fixture.room.gameState!.topCard.id).toBe(reverseCard.id);
  });

  it("uses mischief-v1 to route draw pressure through a relay bot toward a human", async () => {
    const fixture = createWaitingRoomFixture(2, "no-challenge");
    const mischiefBot = fixture.roomManager.addBot({
      roomId: fixture.room.roomId,
      playerId: fixture.room.ownerPlayerId,
      botType: "mischief"
    }).botPlayer;
    const relayBot = fixture.roomManager.addBot({
      roomId: fixture.room.roomId,
      playerId: fixture.room.ownerPlayerId,
      botType: "strong"
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
    state.direction = "clockwise";
    const topCard = createNumberCard("mischief-top-red-5", "red", 5);
    const plusTwo = createColoredActionCard("mischief-red-plus2", "red", "draw-two");
    const plusFour = createColoredActionCard("mischief-red-plus4", "red", "draw-four");
    const relayPlusFour = createColoredActionCard("relay-blue-plus4", "blue", "draw-four");
    const mischiefGamePlayer = state.players.find((player) => player.id === mischiefBot.playerId)!;
    const relayGamePlayer = state.players.find((player) => player.id === relayBot.playerId)!;
    const finalHuman = state.players.find((player) => player.id === fixture.room.ownerPlayerId)!;

    state.topCard = topCard;
    state.currentColor = "red";
    state.discardPile = [topCard];
    state.currentPlayerId = mischiefBot.playerId;
    mischiefGamePlayer.hand = [plusTwo, plusFour];
    mischiefGamePlayer.handCount = mischiefGamePlayer.hand.length;
    relayGamePlayer.hand = [relayPlusFour];
    relayGamePlayer.handCount = relayGamePlayer.hand.length;
    finalHuman.hand = [createNumberCard("human-green-9", "green", 9)];
    finalHuman.handCount = finalHuman.hand.length;

    const scheduler = new BotScheduler({
      roomManager: fixture.roomManager,
      connectionRegistry: fixture.connectionRegistry,
      thinkMs: 1,
      random: () => 0
    });

    scheduler.scheduleRoom(fixture.room.roomId);
    await new Promise((resolve) => setTimeout(resolve, 20));
    scheduler.dispose();

    expect(fixture.room.gameState!.discardPile.map((card) => card.id)).toContain(plusFour.id);
    expect(fixture.room.gameState!.topCard.id).toBe(relayPlusFour.id);
  });
});

function createPendingBotUnoFixture() {
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
  state.currentPlayerId = fixture.room.ownerPlayerId;

  const botGamePlayer = state.players.find((player) => player.id === bot.playerId)!;
  botGamePlayer.hand = [createNumberCard("pending-bot-red-1", "red", 1)];
  botGamePlayer.handCount = 1;
  botGamePlayer.unoPendingSinceMs = Date.now();
  botGamePlayer.hasCalledUno = false;

  return {
    ...fixture,
    bot,
    botGamePlayer
  };
}

function getGamePlayer(state: GameState, playerId: string) {
  const player = state.players.find((candidate) => candidate.id === playerId);

  if (player === undefined) {
    throw new Error(`Player ${playerId} was not found.`);
  }

  return player;
}
