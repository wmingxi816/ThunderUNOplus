import { describe, expect, it } from "vitest";
import { applyCommand } from "./applyCommand";
import {
  blackCard,
  createGameState,
  createPlayerState,
  getPlayer,
  numberCard
} from "./testUtils";

describe("applyCommand - UNO、淘汰与胜利", () => {
  it("玩家剩 1 张牌时会进入 UNO 待喊状态", () => {
    const playable = numberCard("red-7", "red", 7);
    const state = createGameState({
      now: 1000,
      players: [
        createPlayerState("p1", [playable, numberCard("blue-2", "blue", 2)]),
        createPlayerState("p2", []),
        createPlayerState("p3", [])
      ]
    });

    const result = applyCommand(state, {
      type: "play-card",
      playerId: "p1",
      cardId: playable.id,
      timestampMs: 3000
    });

    const player = getPlayer(result.state, "p1");

    expect(player.handCount).toBe(1);
    expect(player.hasCalledUno).toBe(false);
    expect(player.unoPendingSinceMs).toBe(3000);
  });

  it("喊过 UNO 后不能被成功揭发", () => {
    const state = createGameState({
      now: 1000,
      players: [
        createPlayerState("p1", [numberCard("blue-2", "blue", 2)], {
          unoPendingSinceMs: 1000
        }),
        createPlayerState("p2", []),
        createPlayerState("p3", [])
      ]
    });

    const callResult = applyCommand(state, {
      type: "say-uno",
      playerId: "p1",
      timestampMs: 2000
    });

    const reportResult = applyCommand(callResult.state, {
      type: "report-uno",
      playerId: "p2",
      targetPlayerId: "p1",
      timestampMs: 8000
    });

    expect(reportResult.events[0]).toMatchObject({
      type: "command-rejected",
      code: "UNO_REPORT_FAILED"
    });
  });

  it("未喊 UNO 且保护期结束后，被揭发会罚摸 6 张", () => {
    const drawPile = Array.from({ length: 6 }, (_, index) =>
      numberCard(`penalty-${index}`, "green", 1)
    );
    const state = createGameState({
      now: 1000,
      players: [
        createPlayerState("p1", [numberCard("blue-2", "blue", 2)], {
          unoPendingSinceMs: 1000
        }),
        createPlayerState("p2", []),
        createPlayerState("p3", [])
      ],
      drawPile
    });

    const result = applyCommand(state, {
      type: "report-uno",
      playerId: "p2",
      targetPlayerId: "p1",
      timestampMs: 7000
    });

    expect(getPlayer(result.state, "p1").handCount).toBe(7);
  });

  it("UNO 揭发罚摸也使用统一摸牌函数并支持回洗", () => {
    const topCard = numberCard("top-card", "green", 9);
    const recyclableCards = Array.from({ length: 6 }, (_, index) =>
      numberCard(`recycle-${index}`, "yellow", 1)
    );
    const state = createGameState({
      now: 1000,
      topCard,
      discardPile: [...recyclableCards, topCard],
      drawPile: [],
      players: [
        createPlayerState("p1", [numberCard("blue-2", "blue", 2)], {
          unoPendingSinceMs: 1000
        }),
        createPlayerState("p2", []),
        createPlayerState("p3", [])
      ],
      seed: "uno-reshuffle"
    });

    const result = applyCommand(state, {
      type: "report-uno",
      playerId: "p2",
      targetPlayerId: "p1",
      timestampMs: 7000
    });

    expect(result.events.some((event) => event.type === "deck-reshuffled")).toBe(
      true
    );
    expect(getPlayer(result.state, "p1").handCount).toBe(7);
  });

  it("UNO 保护期内揭发会失败", () => {
    const state = createGameState({
      now: 1000,
      players: [
        createPlayerState("p1", [numberCard("blue-2", "blue", 2)], {
          unoPendingSinceMs: 1000
        }),
        createPlayerState("p2", []),
        createPlayerState("p3", [])
      ]
    });

    const result = applyCommand(state, {
      type: "report-uno",
      playerId: "p2",
      targetPlayerId: "p1",
      timestampMs: 4000
    });

    expect(result.events[0]).toMatchObject({
      type: "command-rejected",
      code: "UNO_REPORT_FAILED"
    });
  });

  it("玩家手牌超过 25 张会被淘汰", () => {
    const hand = Array.from({ length: 25 }, (_, index) =>
      numberCard(`hand-${index}`, "blue", 1)
    );
    const state = createGameState({
      currentPlayerId: "p1",
      players: [
        createPlayerState("p1", hand),
        createPlayerState("p2", []),
        createPlayerState("p3", [])
      ],
      drawPile: [numberCard("penalty-card", "green", 2)],
      drawStack: {
        active: true,
        amount: 1,
        previousDrawValue: 2,
        targetPlayerId: "p1"
      }
    });

    const result = applyCommand(state, {
      type: "resolve-draw-stack",
      playerId: "p1"
    });

    expect(getPlayer(result.state, "p1").isEliminated).toBe(true);
    expect(getPlayer(result.state, "p1").eliminationReason).toBe("hand-limit");
  });

  it("玩家出完最后一张牌会立即获胜，哪怕最后一张是技能牌", () => {
    const lastCard = blackCard("last-wild", "wild");
    const otherPlayerHand = [numberCard("green-1", "green", 1)];
    const state = createGameState({
      currentColor: "red",
      players: [
        createPlayerState("p1", [lastCard]),
        createPlayerState("p2", otherPlayerHand),
        createPlayerState("p3", [])
      ]
    });

    const result = applyCommand(state, {
      type: "play-card",
      playerId: "p1",
      cardId: lastCard.id,
      declaredColor: "blue"
    });

    expect(result.state.status).toBe("finished");
    expect(result.state.winnerPlayerIds).toEqual(["p1"]);
    expect(getPlayer(result.state, "p2").hand).toEqual(otherPlayerHand);
  });

  it("只剩 1 名未淘汰玩家时，对局会结束", () => {
    const p1Hand = Array.from({ length: 25 }, (_, index) =>
      numberCard(`hand-${index}`, "blue", 1)
    );
    const state = createGameState({
      currentPlayerId: "p1",
      players: [
        createPlayerState("p1", p1Hand),
        createPlayerState("p2", [numberCard("green-1", "green", 1)]),
        createPlayerState("p3", [], {
          isEliminated: true,
          eliminationReason: "hand-limit"
        })
      ],
      drawPile: [numberCard("overflow", "green", 2)],
      drawStack: {
        active: true,
        amount: 1,
        previousDrawValue: 2,
        targetPlayerId: "p1"
      }
    });

    const result = applyCommand(state, {
      type: "resolve-draw-stack",
      playerId: "p1"
    });

    expect(result.state.status).toBe("finished");
    expect(result.state.winnerPlayerIds).toEqual(["p2"]);
  });
});
