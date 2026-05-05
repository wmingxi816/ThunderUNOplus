import { describe, expect, it } from "vitest";
import { applyCommand } from "./applyCommand";
import {
  blackCard,
  createGameState,
  createPlayerState,
  getPlayer,
  numberCard
} from "./testUtils";

describe("applyCommand - 摸牌、加牌链与质疑", () => {
  it("普通摸牌摸到可接数字牌时会先加入手牌并等待玩家决定", () => {
    const drawn = numberCard("red-9", "red", 9);
    const state = createGameState({
      currentColor: "red",
      topCard: numberCard("top-red-5", "red", 5),
      players: [
        createPlayerState("p1", [numberCard("blue-2", "blue", 2)]),
        createPlayerState("p2", []),
        createPlayerState("p3", [])
      ],
      drawPile: [drawn]
    });

    const result = applyCommand(state, {
      type: "draw-card",
      playerId: "p1"
    });

    expect(getPlayer(result.state, "p1").hand.map((card) => card.id)).toContain(
      drawn.id
    );
    expect(result.state.topCard.id).toBe("top-red-5");
    expect(result.state.currentPlayerId).toBe("p1");
    expect(result.state.normalDrawOffer).toMatchObject({
      active: true,
      playerId: "p1",
      cardId: drawn.id
    });
  });

  it("玩家可以保留刚摸到的可出牌并结束回合", () => {
    const drawn = numberCard("red-9", "red", 9);
    const state = createGameState({
      currentColor: "red",
      topCard: numberCard("top-red-5", "red", 5),
      players: [
        createPlayerState("p1", [numberCard("blue-2", "blue", 2)]),
        createPlayerState("p2", []),
        createPlayerState("p3", [])
      ],
      drawPile: [drawn]
    });

    const drawResult = applyCommand(state, {
      type: "draw-card",
      playerId: "p1"
    });
    const keepResult = applyCommand(drawResult.state, {
      type: "keep-drawn-card",
      playerId: "p1"
    });

    expect(keepResult.state.normalDrawOffer.active).toBe(false);
    expect(keepResult.state.currentPlayerId).toBe("p2");
    expect(keepResult.state.topCard.id).toBe("top-red-5");
  });

  it("玩家可以选择立即打出刚摸到的可出牌", () => {
    const drawn = numberCard("red-9", "red", 9);
    const state = createGameState({
      currentColor: "red",
      topCard: numberCard("top-red-5", "red", 5),
      players: [
        createPlayerState("p1", [numberCard("blue-2", "blue", 2)]),
        createPlayerState("p2", []),
        createPlayerState("p3", [])
      ],
      drawPile: [drawn]
    });

    const drawResult = applyCommand(state, {
      type: "draw-card",
      playerId: "p1"
    });
    const playResult = applyCommand(drawResult.state, {
      type: "play-card",
      playerId: "p1",
      cardId: drawn.id
    });

    expect(playResult.state.normalDrawOffer.active).toBe(false);
    expect(playResult.state.topCard.id).toBe(drawn.id);
    expect(playResult.state.currentPlayerId).toBe("p2");
  });

  it("普通摸牌摸到不能出的牌时会加入手牌并结束回合", () => {
    const drawn = numberCard("green-9", "green", 9);
    const state = createGameState({
      currentColor: "red",
      topCard: numberCard("top-red-5", "red", 5),
      players: [
        createPlayerState("p1", [numberCard("blue-2", "blue", 2)]),
        createPlayerState("p2", []),
        createPlayerState("p3", [])
      ],
      drawPile: [drawn]
    });

    const result = applyCommand(state, {
      type: "draw-card",
      playerId: "p1"
    });

    expect(getPlayer(result.state, "p1").hand.map((card) => card.id)).toContain(
      drawn.id
    );
    expect(result.state.topCard.id).toBe("top-red-5");
    expect(result.state.currentPlayerId).toBe("p2");
  });

  it("摸到需要指定颜色的黑牌时不会自动打出", () => {
    const drawn = blackCard("wild-card", "wild");
    const state = createGameState({
      currentColor: "red",
      topCard: numberCard("top-red-5", "red", 5),
      players: [
        createPlayerState("p1", [numberCard("blue-2", "blue", 2)]),
        createPlayerState("p2", []),
        createPlayerState("p3", [])
      ],
      drawPile: [drawn]
    });

    const result = applyCommand(state, {
      type: "draw-card",
      playerId: "p1"
    });

    expect(getPlayer(result.state, "p1").hand.map((card) => card.id)).toContain(
      drawn.id
    );
    expect(result.state.topCard.id).toBe("top-red-5");
    expect(result.state.normalDrawOffer).toMatchObject({
      active: true,
      playerId: "p1",
      cardId: drawn.id
    });
  });

  it("有质疑模式下主动摸牌会创建质疑窗口", () => {
    const state = createGameState({
      mode: "with-challenge",
      players: [
        createPlayerState("p1", [blackCard("wild-in-hand", "wild")]),
        createPlayerState("p2", []),
        createPlayerState("p3", [])
      ],
      drawPile: [numberCard("green-9", "green", 9)]
    });

    const result = applyCommand(state, {
      type: "draw-card",
      playerId: "p1"
    });

    expect(result.state.challengeWindow).toMatchObject({
      active: true,
      targetPlayerId: "p1",
      hadBlackCardBeforeDraw: true
    });
  });

  it("质疑判定只看摸牌前手牌，不把刚摸到的黑牌算进去", () => {
    const penaltyCards = Array.from({ length: 6 }, (_, index) =>
      numberCard(`penalty-${index}`, "green", 1)
    );
    const state = createGameState({
      mode: "with-challenge",
      currentColor: "red",
      topCard: numberCard("top-red-5", "red", 5),
      players: [
        createPlayerState("p1", [numberCard("blue-2", "blue", 2)]),
        createPlayerState("p2", []),
        createPlayerState("p3", [])
      ],
      drawPile: [blackCard("drawn-wild", "wild"), ...penaltyCards]
    });

    const drawResult = applyCommand(state, {
      type: "draw-card",
      playerId: "p1"
    });
    const challengeResult = applyCommand(drawResult.state, {
      type: "challenge-draw",
      playerId: "p2",
      targetPlayerId: "p1"
    });

    expect(drawResult.state.challengeWindow.hadBlackCardBeforeDraw).toBe(false);
    expect(getPlayer(challengeResult.state, "p2").handCount).toBe(6);
    expect(challengeResult.events).toContainEqual(
      expect.objectContaining({
        type: "challenge-resolved",
        success: false,
        penaltyPlayerId: "p2",
        drawCount: 6
      })
    );
  });

  it("无质疑模式下主动摸牌不会创建质疑窗口", () => {
    const state = createGameState({
      mode: "no-challenge",
      players: [
        createPlayerState("p1", [blackCard("wild-in-hand", "wild")]),
        createPlayerState("p2", []),
        createPlayerState("p3", [])
      ],
      drawPile: [numberCard("green-9", "green", 9)]
    });

    const result = applyCommand(state, {
      type: "draw-card",
      playerId: "p1"
    });

    expect(result.state.challengeWindow.active).toBe(false);
  });

  it("质疑成功时被质疑者罚摸 2 张", () => {
    const targetHand = [numberCard("blue-1", "blue", 1)];
    const penaltyCards = Array.from({ length: 2 }, (_, index) =>
      numberCard(`penalty-${index}`, "green", 1)
    );
    const state = createGameState({
      players: [
        createPlayerState("p1", targetHand),
        createPlayerState("p2", []),
        createPlayerState("p3", [])
      ],
      drawPile: penaltyCards,
      challengeWindow: {
        active: true,
        targetPlayerId: "p1",
        hadBlackCardBeforeDraw: true,
        expiresWhenNextPlayerCompletesAction: true
      }
    });

    const result = applyCommand(state, {
      type: "challenge-draw",
      playerId: "p2",
      targetPlayerId: "p1"
    });

    expect(getPlayer(result.state, "p1").handCount).toBe(3);
    expect(result.state.challengeWindow.active).toBe(false);
    expect(result.events).toContainEqual(
      expect.objectContaining({
        type: "challenge-resolved",
        success: true,
        penaltyPlayerId: "p1",
        drawCount: 2
      })
    );
  });

  it("质疑失败时质疑者罚摸 6 张", () => {
    const penaltyCards = Array.from({ length: 6 }, (_, index) =>
      numberCard(`penalty-${index}`, "green", 1)
    );
    const state = createGameState({
      players: [
        createPlayerState("p1", [numberCard("blue-1", "blue", 1)]),
        createPlayerState("p2", []),
        createPlayerState("p3", [])
      ],
      drawPile: penaltyCards,
      challengeWindow: {
        active: true,
        targetPlayerId: "p1",
        hadBlackCardBeforeDraw: false,
        expiresWhenNextPlayerCompletesAction: true
      }
    });

    const result = applyCommand(state, {
      type: "challenge-draw",
      playerId: "p2",
      targetPlayerId: "p1"
    });

    expect(getPlayer(result.state, "p2").handCount).toBe(6);
    expect(result.state.challengeWindow.active).toBe(false);
    expect(result.events).toContainEqual(
      expect.objectContaining({
        type: "challenge-resolved",
        success: false,
        penaltyPlayerId: "p2",
        drawCount: 6
      })
    );
  });

  it("质疑罚摸也使用统一摸牌函数并支持回洗", () => {
    const topCard = numberCard("top-card", "red", 9);
    const recyclableCards = Array.from({ length: 6 }, (_, index) =>
      numberCard(`recycle-${index}`, "green", 1)
    );
    const state = createGameState({
      topCard,
      discardPile: [...recyclableCards, topCard],
      drawPile: [],
      players: [
        createPlayerState("p1", [numberCard("blue-1", "blue", 1)]),
        createPlayerState("p2", []),
        createPlayerState("p3", [])
      ],
      challengeWindow: {
        active: true,
        targetPlayerId: "p1",
        hadBlackCardBeforeDraw: false,
        expiresWhenNextPlayerCompletesAction: true
      },
      seed: "challenge-reshuffle"
    });

    const result = applyCommand(state, {
      type: "challenge-draw",
      playerId: "p2",
      targetPlayerId: "p1"
    });

    expect(result.events.some((event) => event.type === "deck-reshuffled")).toBe(
      true
    );
    expect(getPlayer(result.state, "p2").handCount).toBe(6);
  });

  it("下一家完成行动后，旧的质疑窗口会关闭", () => {
    const playable = numberCard("red-9", "red", 9);
    const state = createGameState({
      currentPlayerId: "p2",
      currentColor: "red",
      players: [
        createPlayerState("p1", []),
        createPlayerState("p2", [playable, numberCard("blue-2", "blue", 2)]),
        createPlayerState("p3", [])
      ],
      challengeWindow: {
        active: true,
        targetPlayerId: "p1",
        hadBlackCardBeforeDraw: true,
        expiresWhenNextPlayerCompletesAction: true
      }
    });

    const result = applyCommand(state, {
      type: "play-card",
      playerId: "p2",
      cardId: playable.id
    });

    expect(result.state.challengeWindow.active).toBe(false);
  });

  it("加牌链结算后目标玩家摸累计张数，且不能出牌", () => {
    const drawCards = [
      numberCard("draw-1", "green", 1),
      numberCard("draw-2", "green", 2),
      numberCard("draw-3", "green", 3),
      numberCard("draw-4", "green", 4)
    ];
    const state = createGameState({
      currentPlayerId: "p2",
      players: [
        createPlayerState("p1", []),
        createPlayerState("p2", [numberCard("blue-2", "blue", 2)]),
        createPlayerState("p3", [])
      ],
      drawPile: drawCards,
      drawStack: {
        active: true,
        amount: 4,
        previousDrawValue: 2,
        targetPlayerId: "p2"
      }
    });

    const result = applyCommand(state, {
      type: "resolve-draw-stack",
      playerId: "p2"
    });

    expect(getPlayer(result.state, "p2").handCount).toBe(5);
    expect(result.state.drawStack.active).toBe(false);
    expect(result.state.currentPlayerId).toBe("p3");
  });

  it("加牌链罚摸在摸牌堆不足时也会回洗弃牌堆", () => {
    const topCard = numberCard("top-card", "red", 9);
    const recyclableCards = Array.from({ length: 4 }, (_, index) =>
      numberCard(`recycle-${index}`, "green", 1)
    );
    const state = createGameState({
      currentPlayerId: "p2",
      topCard,
      discardPile: [...recyclableCards, topCard],
      drawPile: [],
      players: [
        createPlayerState("p1", []),
        createPlayerState("p2", [numberCard("blue-2", "blue", 2)]),
        createPlayerState("p3", [])
      ],
      drawStack: {
        active: true,
        amount: 4,
        previousDrawValue: 2,
        targetPlayerId: "p2"
      },
      seed: "draw-stack-reshuffle"
    });

    const result = applyCommand(state, {
      type: "resolve-draw-stack",
      playerId: "p2"
    });

    expect(result.events.some((event) => event.type === "deck-reshuffled")).toBe(
      true
    );
    expect(getPlayer(result.state, "p2").handCount).toBe(5);
  });

  it("罚抽会创建 drawUntilColor 状态，且后一个颜色会覆盖前一个颜色", () => {
    const firstPenalty = blackCard("penalty-1", "penalty-draw");
    const secondPenalty = blackCard("penalty-2", "penalty-draw");
    const firstState = createGameState({
      players: [
        createPlayerState("p1", [firstPenalty, numberCard("blue-1", "blue", 1)]),
        createPlayerState("p2", [secondPenalty, numberCard("green-1", "green", 1)]),
        createPlayerState("p3", [])
      ]
    });

    const firstResult = applyCommand(firstState, {
      type: "play-card",
      playerId: "p1",
      cardId: firstPenalty.id,
      declaredColor: "red"
    });

    expect(firstResult.state.drawUntilColor).toMatchObject({
      active: true,
      color: "red",
      targetPlayerId: "p2"
    });

    const secondResult = applyCommand(firstResult.state, {
      type: "play-card",
      playerId: "p2",
      cardId: secondPenalty.id,
      declaredColor: "blue"
    });

    expect(secondResult.state.drawUntilColor).toMatchObject({
      active: true,
      color: "blue",
      targetPlayerId: "p3"
    });
  });

  it("罚抽结算后目标玩家会一直摸到指定颜色并跳过回合", () => {
    const state = createGameState({
      currentPlayerId: "p2",
      players: [
        createPlayerState("p1", []),
        createPlayerState("p2", [numberCard("blue-1", "blue", 1)]),
        createPlayerState("p3", [])
      ],
      drawPile: [
        numberCard("green-2", "green", 2),
        blackCard("wild-middle", "wild"),
        numberCard("blue-9", "blue", 9)
      ],
      drawUntilColor: {
        active: true,
        color: "blue",
        targetPlayerId: "p2"
      }
    });

    const result = applyCommand(state, {
      type: "resolve-draw-until-color",
      playerId: "p2"
    });

    expect(getPlayer(result.state, "p2").handCount).toBe(2);
    expect(result.state.drawUntilColor).toMatchObject({
      active: true,
      color: "blue",
      targetPlayerId: "p2"
    });
    expect(result.state.currentPlayerId).toBe("p2");
    expect(result.events).toContainEqual(
      expect.objectContaining({
        type: "cards-drawn",
        playerId: "p2",
        count: 1,
        reason: "draw-until-color",
        drawUntilColor: {
          targetColor: "blue",
          revealedColor: "green",
          matched: false
        }
      })
    );
  });

  it("draw-until-color resolves only after drawing the target color", () => {
    const state = createGameState({
      currentPlayerId: "p2",
      players: [
        createPlayerState("p1", []),
        createPlayerState("p2", [numberCard("blue-1", "blue", 1)]),
        createPlayerState("p3", [])
      ],
      drawPile: [numberCard("blue-9", "blue", 9)],
      drawUntilColor: {
        active: true,
        color: "blue",
        targetPlayerId: "p2"
      }
    });

    const result = applyCommand(state, {
      type: "resolve-draw-until-color",
      playerId: "p2"
    });

    expect(getPlayer(result.state, "p2").handCount).toBe(2);
    expect(result.state.drawUntilColor.active).toBe(false);
    expect(result.state.currentPlayerId).toBe("p3");
    expect(result.events).toContainEqual(
      expect.objectContaining({
        type: "draw-until-color-resolved",
        targetPlayerId: "p2",
        color: "blue",
        drawnCount: 1
      })
    );
  });

  it("罚抽摸牌也支持回洗弃牌堆", () => {
    const topCard = numberCard("top-card", "red", 9);
    const recyclableCards = [
      numberCard("recycle-1", "green", 2),
      blackCard("recycle-wild", "wild"),
      numberCard("recycle-target", "blue", 8)
    ];
    const state = createGameState({
      currentPlayerId: "p2",
      topCard,
      discardPile: [...recyclableCards, topCard],
      drawPile: [],
      players: [
        createPlayerState("p1", []),
        createPlayerState("p2", [numberCard("blue-1", "blue", 1)]),
        createPlayerState("p3", [])
      ],
      drawUntilColor: {
        active: true,
        color: "blue",
        targetPlayerId: "p2"
      },
      seed: "penalty-draw-reshuffle"
    });

    const result = applyCommand(state, {
      type: "resolve-draw-until-color",
      playerId: "p2"
    });

    expect(result.events.some((event) => event.type === "deck-reshuffled")).toBe(
      true
    );
    expect(getPlayer(result.state, "p2").handCount).toBe(2);
    expect(result.events).toContainEqual(
      expect.objectContaining({
        type: "cards-drawn",
        playerId: "p2",
        count: 1,
        reason: "draw-until-color"
      })
    );
  });
});
