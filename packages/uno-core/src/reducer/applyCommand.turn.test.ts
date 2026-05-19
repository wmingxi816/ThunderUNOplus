import { describe, expect, it } from "vitest";
import { applyCommand } from "./applyCommand";
import {
  blackCard,
  coloredCard,
  createGameState,
  createPlayerState,
  getPlayer,
  numberCard
} from "./testUtils";

describe("applyCommand - 基础出牌与回合推进", () => {
  it("非当前玩家不能出牌", () => {
    const card = numberCard("green-5", "green", 5);
    const state = createGameState({
      players: [
        createPlayerState("p1", [numberCard("red-7", "red", 7)]),
        createPlayerState("p2", [card]),
        createPlayerState("p3", [])
      ]
    });

    const result = applyCommand(state, {
      type: "play-card",
      playerId: "p2",
      cardId: card.id
    });

    expect(result.state).toBe(state);
    expect(result.events[0]).toMatchObject({
      type: "command-rejected",
      code: "NOT_CURRENT_PLAYER"
    });
  });

  it("当前玩家合法出数字牌后会推进到下一家", () => {
    const card = numberCard("red-7", "red", 7);
    const state = createGameState({
      players: [
        createPlayerState("p1", [card, numberCard("blue-2", "blue", 2)]),
        createPlayerState("p2", []),
        createPlayerState("p3", [])
      ]
    });

    const result = applyCommand(state, {
      type: "play-card",
      playerId: "p1",
      cardId: card.id
    });

    expect(result.state.currentPlayerId).toBe("p2");
    expect(result.state.topCard.id).toBe(card.id);
    expect(getPlayer(result.state, "p1").handCount).toBe(1);
  });

  it("禁牌会跳过下一家", () => {
    const skip = coloredCard("red-skip", "red", "skip");
    const state = createGameState({
      players: [
        createPlayerState("p1", [skip, numberCard("blue-2", "blue", 2)]),
        createPlayerState("p2", []),
        createPlayerState("p3", [])
      ]
    });

    const result = applyCommand(state, {
      type: "play-card",
      playerId: "p1",
      cardId: skip.id
    });

    expect(result.state.currentPlayerId).toBe("p3");
  });

  it("反转牌会改变方向，并按新方向选择下一位玩家", () => {
    const reverse = coloredCard("red-reverse", "red", "reverse");
    const state = createGameState({
      players: [
        createPlayerState("p1", [reverse, numberCard("blue-2", "blue", 2)]),
        createPlayerState("p2", []),
        createPlayerState("p3", [])
      ]
    });

    const result = applyCommand(state, {
      type: "play-card",
      playerId: "p1",
      cardId: reverse.id
    });

    expect(result.state.direction).toBe("counter-clockwise");
    expect(result.state.currentPlayerId).toBe("p3");
  });

  it("交换手牌会按出牌方向轮转所有玩家的手牌", () => {
    const swapHands = coloredCard("red-swap", "red", "swap-hands");
    const p1Hand = [swapHands, numberCard("p1-blue", "blue", 2)];
    const p2Hand = [numberCard("p2-green", "green", 3)];
    const p3Hand = [numberCard("p3-yellow", "yellow", 4)];
    const state = createGameState({
      players: [
        createPlayerState("p1", p1Hand),
        createPlayerState("p2", p2Hand),
        createPlayerState("p3", p3Hand)
      ]
    });

    const result = applyCommand(state, {
      type: "play-card",
      playerId: "p1",
      cardId: swapHands.id
    });

    expect(getPlayer(result.state, "p1").hand.map((card) => card.id)).toEqual([
      "p3-yellow"
    ]);
    expect(getPlayer(result.state, "p2").hand.map((card) => card.id)).toEqual([
      "p1-blue"
    ]);
    expect(getPlayer(result.state, "p3").hand.map((card) => card.id)).toEqual([
      "p2-green"
    ]);
    expect(result.state.currentPlayerId).toBe("p2");
  });

  it("普通 +2 会创建加牌链", () => {
    const drawTwo = coloredCard("red-draw-two", "red", "draw-two");
    const state = createGameState({
      players: [
        createPlayerState("p1", [drawTwo, numberCard("blue-2", "blue", 2)]),
        createPlayerState("p2", [numberCard("green-1", "green", 1)]),
        createPlayerState("p3", [])
      ]
    });

    const result = applyCommand(state, {
      type: "play-card",
      playerId: "p1",
      cardId: drawTwo.id
    });

    expect(result.state.drawStack).toMatchObject({
      active: true,
      amount: 2,
      previousDrawValue: 2,
      previousDrawKind: "draw-two",
      targetPlayerId: "p2"
    });
    expect(result.state.currentPlayerId).toBe("p2");
  });

  it("红 +2 后蓝 +2 可以继续叠加", () => {
    const redDrawTwo = coloredCard("red-draw-two", "red", "draw-two");
    const blueDrawTwo = coloredCard("blue-draw-two", "blue", "draw-two");
    const state = createGameState({
      currentPlayerId: "p2",
      currentColor: "red",
      topCard: redDrawTwo,
      discardPile: [redDrawTwo],
      players: [
        createPlayerState("p1", []),
        createPlayerState("p2", [blueDrawTwo, numberCard("green-3", "green", 3)]),
        createPlayerState("p3", [])
      ],
      drawStack: {
        active: true,
        amount: 2,
        previousDrawValue: 2,
        previousDrawKind: "draw-two",
        targetPlayerId: "p2"
      }
    });

    const result = applyCommand(state, {
      type: "play-card",
      playerId: "p2",
      cardId: blueDrawTwo.id
    });

    expect(result.state.drawStack.amount).toBe(4);
    expect(result.state.currentPlayerId).toBe("p3");
  });

  it("红 +2 后蓝 +4 不能叠加", () => {
    const redDrawTwo = coloredCard("red-draw-two", "red", "draw-two");
    const blueDrawFour = coloredCard("blue-draw-four", "blue", "draw-four");
    const state = createGameState({
      currentPlayerId: "p2",
      currentColor: "red",
      topCard: redDrawTwo,
      discardPile: [redDrawTwo],
      players: [
        createPlayerState("p1", []),
        createPlayerState("p2", [blueDrawFour]),
        createPlayerState("p3", [])
      ],
      drawStack: {
        active: true,
        amount: 2,
        previousDrawValue: 2,
        previousDrawKind: "draw-two",
        targetPlayerId: "p2"
      }
    });

    const result = applyCommand(state, {
      type: "play-card",
      playerId: "p2",
      cardId: blueDrawFour.id
    });

    expect(result.events[0]).toMatchObject({
      type: "command-rejected",
      code: "CARD_NOT_PLAYABLE"
    });
  });

  it("黑色 +6 后普通 +2 即使同色也不能叠加", () => {
    const oldTop = blackCard("wild-six-top", "wild-draw-six");
    const blueDrawTwo = coloredCard("blue-draw-two", "blue", "draw-two");
    const state = createGameState({
      currentPlayerId: "p2",
      currentColor: "blue",
      topCard: oldTop,
      discardPile: [oldTop],
      players: [
        createPlayerState("p1", []),
        createPlayerState("p2", [blueDrawTwo]),
        createPlayerState("p3", [])
      ],
      drawStack: {
        active: true,
        amount: 6,
        previousDrawValue: 6,
        previousDrawKind: "wild-draw-six",
        targetPlayerId: "p2"
      }
    });

    const result = applyCommand(state, {
      type: "play-card",
      playerId: "p2",
      cardId: blueDrawTwo.id
    });

    expect(result.events[0]).toMatchObject({
      type: "command-rejected",
      code: "CARD_NOT_PLAYABLE"
    });
  });

  it("普通 +4 后普通 +2 即使同色也不能叠加", () => {
    const redDrawFour = coloredCard("red-draw-four", "red", "draw-four");
    const redDrawTwo = coloredCard("red-draw-two", "red", "draw-two");
    const state = createGameState({
      currentPlayerId: "p2",
      currentColor: "red",
      topCard: redDrawFour,
      discardPile: [redDrawFour],
      players: [
        createPlayerState("p1", []),
        createPlayerState("p2", [redDrawTwo]),
        createPlayerState("p3", [])
      ],
      drawStack: {
        active: true,
        amount: 4,
        previousDrawValue: 4,
        previousDrawKind: "draw-four",
        targetPlayerId: "p2"
      }
    });

    const result = applyCommand(state, {
      type: "play-card",
      playerId: "p2",
      cardId: redDrawTwo.id
    });

    expect(result.events[0]).toMatchObject({
      type: "command-rejected",
      code: "CARD_NOT_PLAYABLE"
    });
  });

  it("黑色反转 +4 后普通 +4 即使颜色匹配也不能叠加", () => {
    const wildReverseDrawFour = blackCard(
      "wild-reverse-draw-four",
      "wild-reverse-draw-four"
    );
    const redDrawFour = coloredCard("red-draw-four", "red", "draw-four");
    const state = createGameState({
      currentPlayerId: "p3",
      currentColor: "red",
      topCard: wildReverseDrawFour,
      discardPile: [wildReverseDrawFour],
      direction: "counter-clockwise",
      players: [
        createPlayerState("p1", []),
        createPlayerState("p2", []),
        createPlayerState("p3", [redDrawFour])
      ],
      drawStack: {
        active: true,
        amount: 4,
        previousDrawValue: 4,
        previousDrawKind: "wild-reverse-draw-four",
        targetPlayerId: "p3"
      }
    });

    const result = applyCommand(state, {
      type: "play-card",
      playerId: "p3",
      cardId: redDrawFour.id
    });

    expect(result.events[0]).toMatchObject({
      type: "command-rejected",
      code: "CARD_NOT_PLAYABLE"
    });
  });

  it("黑色 +6 可以接入任意加牌链", () => {
    const redDrawTwo = coloredCard("red-draw-two", "red", "draw-two");
    const wildSix = blackCard("wild-six", "wild-draw-six");
    const state = createGameState({
      currentPlayerId: "p2",
      currentColor: "red",
      topCard: redDrawTwo,
      discardPile: [redDrawTwo],
      players: [
        createPlayerState("p1", []),
        createPlayerState("p2", [wildSix, numberCard("blue-8", "blue", 8)]),
        createPlayerState("p3", [])
      ],
      drawStack: {
        active: true,
        amount: 2,
        previousDrawValue: 2,
        previousDrawKind: "draw-two",
        targetPlayerId: "p2"
      }
    });

    const result = applyCommand(state, {
      type: "play-card",
      playerId: "p2",
      cardId: wildSix.id,
      declaredColor: "blue"
    });

    expect(result.state.drawStack.amount).toBe(8);
    expect(result.state.drawStack.previousDrawValue).toBe(6);
    expect(result.state.drawStack.previousDrawKind).toBe("wild-draw-six");
    expect(result.state.currentColor).toBe("blue");
    expect(result.state.currentPlayerId).toBe("p3");
  });

  it("第二张 +10 会抵消已有加牌链", () => {
    const oldTop = blackCard("wild-six-top", "wild-draw-six");
    const drawTen = blackCard("wild-ten", "wild-draw-ten");
    const state = createGameState({
      currentPlayerId: "p2",
      currentColor: "red",
      topCard: oldTop,
      discardPile: [oldTop],
      players: [
        createPlayerState("p1", []),
        createPlayerState("p2", [drawTen, numberCard("blue-1", "blue", 1)]),
        createPlayerState("p3", [])
      ],
      drawStack: {
        active: true,
        amount: 6,
        previousDrawValue: 6,
        previousDrawKind: "wild-draw-six",
        targetPlayerId: "p2"
      }
    });

    const result = applyCommand(state, {
      type: "play-card",
      playerId: "p2",
      cardId: drawTen.id,
      declaredColor: "green"
    });

    expect(result.state.drawStack).toMatchObject({
      active: true,
      amount: 16,
      previousDrawValue: 10,
      previousDrawKind: "wild-draw-ten",
      targetPlayerId: "p3"
    });
    expect(result.state.currentPlayerId).toBe("p3");
    expect(result.state.currentColor).toBe("green");
  });

  it("反转变色 +4 会反转方向并把加牌压力打向上一家", () => {
    const wildReverseDrawFour = blackCard(
      "wild-reverse-draw-four",
      "wild-reverse-draw-four"
    );
    const state = createGameState({
      currentPlayerId: "p1",
      players: [
        createPlayerState("p1", [wildReverseDrawFour, numberCard("blue-1", "blue", 1)]),
        createPlayerState("p2", []),
        createPlayerState("p3", [])
      ]
    });

    const result = applyCommand(state, {
      type: "play-card",
      playerId: "p1",
      cardId: wildReverseDrawFour.id,
      declaredColor: "yellow"
    });

    expect(result.state.direction).toBe("counter-clockwise");
    expect(result.state.drawStack).toMatchObject({
      active: true,
      amount: 4,
      previousDrawValue: 4,
      previousDrawKind: "wild-reverse-draw-four",
      targetPlayerId: "p3"
    });
    expect(result.state.currentPlayerId).toBe("p3");
  });

  it("顺子出牌后桌面顶牌会变成最大牌", () => {
    const cards = [
      numberCard("red-0", "red", 0),
      numberCard("blue-1", "blue", 1),
      numberCard("green-2", "green", 2),
      numberCard("yellow-3", "yellow", 3),
      numberCard("red-4", "red", 4)
    ];
    const state = createGameState({
      currentColor: "red",
      topCard: numberCard("top-red-9", "red", 9),
      players: [
        createPlayerState("p1", [...cards, numberCard("blue-9", "blue", 9)]),
        createPlayerState("p2", []),
        createPlayerState("p3", [])
      ]
    });

    const result = applyCommand(state, {
      type: "play-sequence",
      playerId: "p1",
      cardIds: cards.map((card) => card.id)
    });

    expect(result.state.topCard.id).toBe("red-4");
    expect(getPlayer(result.state, "p1").handCount).toBe(1);
    expect(result.state.currentPlayerId).toBe("p2");
  });

  it("同色丢弃会移除附带牌，但顶牌始终是主牌", () => {
    const main = coloredCard("red-discard", "red", "discard-same-color");
    const attachedNumber = numberCard("red-8", "red", 8);
    const attachedSkill = coloredCard("red-skip", "red", "skip");
    const state = createGameState({
      players: [
        createPlayerState("p1", [main, attachedNumber, attachedSkill, numberCard("blue-1", "blue", 1)]),
        createPlayerState("p2", []),
        createPlayerState("p3", [])
      ]
    });

    const result = applyCommand(state, {
      type: "play-discard-same-color",
      playerId: "p1",
      mainCardId: main.id,
      attachedCardIds: [attachedNumber.id, attachedSkill.id]
    });

    expect(result.state.topCard.id).toBe(main.id);
    expect(getPlayer(result.state, "p1").hand.map((card) => card.id)).toEqual([
      "blue-1"
    ]);
  });

  it("连对合法出牌后会移除多张牌，且顶牌保持为该数字牌", () => {
    const cardA = numberCard("green-6-a", "green", 6);
    const cardB = numberCard("green-6-b", "green", 6);
    const state = createGameState({
      topCard: numberCard("top-green-2", "green", 2),
      currentColor: "green",
      players: [
        createPlayerState("p1", [cardA, cardB, numberCard("blue-1", "blue", 1)]),
        createPlayerState("p2", []),
        createPlayerState("p3", [])
      ]
    });

    const result = applyCommand(state, {
      type: "play-multiple-number",
      playerId: "p1",
      cardIds: [cardA.id, cardB.id]
    });

    expect(result.state.topCard.id).toBe(cardA.id);
    expect(getPlayer(result.state, "p1").hand.map((card) => card.id)).toEqual([
      "blue-1"
    ]);
    expect(result.state.currentPlayerId).toBe("p2");
  });

  it("emits playPattern for single-card, sequence, multiple-number, and discard-same-color plays", () => {
    const single = coloredCard("red-skip", "red", "skip");
    const singleState = createGameState({
      currentColor: "red",
      topCard: numberCard("top-red-1", "red", 1),
      players: [
        createPlayerState("p1", [single, numberCard("blue-2", "blue", 2)]),
        createPlayerState("p2", []),
        createPlayerState("p3", [])
      ]
    });

    expect(
      applyCommand(singleState, {
        type: "play-card",
        playerId: "p1",
        cardId: single.id
      }).events.find((event) => event.type === "cards-played")
    ).toMatchObject({
      type: "cards-played",
      playPattern: "single"
    });

    const sequenceCards = [
      numberCard("seq-0", "red", 0),
      numberCard("seq-1", "blue", 1),
      numberCard("seq-2", "green", 2),
      numberCard("seq-3", "yellow", 3),
      numberCard("seq-4", "red", 4)
    ];
    const sequenceState = createGameState({
      currentColor: "red",
      topCard: numberCard("top-red-9", "red", 9),
      players: [
        createPlayerState("p1", [...sequenceCards, numberCard("blue-7", "blue", 7)]),
        createPlayerState("p2", []),
        createPlayerState("p3", [])
      ]
    });

    expect(
      applyCommand(sequenceState, {
        type: "play-sequence",
        playerId: "p1",
        cardIds: sequenceCards.map((card) => card.id)
      }).events.find((event) => event.type === "cards-played")
    ).toMatchObject({
      type: "cards-played",
      playPattern: "sequence"
    });

    const multipleA = numberCard("multi-a", "green", 6);
    const multipleB = numberCard("multi-b", "green", 6);
    const multipleState = createGameState({
      currentColor: "green",
      topCard: numberCard("top-green-2", "green", 2),
      players: [
        createPlayerState("p1", [multipleA, multipleB, numberCard("blue-7", "blue", 7)]),
        createPlayerState("p2", []),
        createPlayerState("p3", [])
      ]
    });

    expect(
      applyCommand(multipleState, {
        type: "play-multiple-number",
        playerId: "p1",
        cardIds: [multipleA.id, multipleB.id]
      }).events.find((event) => event.type === "cards-played")
    ).toMatchObject({
      type: "cards-played",
      playPattern: "multiple-number"
    });

    const discardMain = coloredCard("discard-main", "red", "discard-same-color");
    const discardAttached = numberCard("discard-attached", "red", 8);
    const discardState = createGameState({
      currentColor: "red",
      topCard: numberCard("top-red-3", "red", 3),
      players: [
        createPlayerState("p1", [discardMain, discardAttached, numberCard("blue-7", "blue", 7)]),
        createPlayerState("p2", []),
        createPlayerState("p3", [])
      ]
    });

    expect(
      applyCommand(discardState, {
        type: "play-discard-same-color",
        playerId: "p1",
        mainCardId: discardMain.id,
        attachedCardIds: [discardAttached.id]
      }).events.find((event) => event.type === "cards-played")
    ).toMatchObject({
      type: "cards-played",
      playPattern: "discard-same-color"
    });
  });
});
