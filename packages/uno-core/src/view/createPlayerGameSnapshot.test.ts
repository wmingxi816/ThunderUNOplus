import { describe, expect, it } from "vitest";
import { createPlayerGameSnapshot } from "./createPlayerGameSnapshot";
import {
  blackCard,
  coloredCard,
  createGameState,
  createPlayerState,
  numberCard
} from "../reducer/testUtils";

describe("createPlayerGameSnapshot", () => {
  it("玩家可以看到自己的完整手牌", () => {
    const ownHand = [
      numberCard("red-1", "red", 1),
      blackCard("wild-1", "wild")
    ];
    const state = createGameState({
      players: [
        createPlayerState("p1", ownHand, {
          displayName: "玩家1",
          avatarUrl: "https://avatar/1.png"
        }),
        createPlayerState("p2", [numberCard("blue-2", "blue", 2)])
      ]
    });

    const snapshot = createPlayerGameSnapshot(state, "p1");

    expect(snapshot.self.hand.map((card) => card.id)).toEqual(["red-1", "wild-1"]);
  });

  it("玩家不能看到其他玩家的具体手牌，但能看到手牌数量", () => {
    const state = createGameState({
      players: [
        createPlayerState("p1", [numberCard("red-1", "red", 1)]),
        createPlayerState("p2", [
          numberCard("blue-2", "blue", 2),
          numberCard("green-3", "green", 3)
        ], {
          displayName: "玩家2"
        })
      ]
    });

    const snapshot = createPlayerGameSnapshot(state, "p1");
    const opponent = snapshot.opponents[0];

    expect(opponent?.handCount).toBe(2);
    expect(opponent).not.toHaveProperty("hand");
  });

  it("snapshot 中不会泄露 hadBlackCardBeforeDraw", () => {
    const state = createGameState({
      players: [
        createPlayerState("p1", [numberCard("red-1", "red", 1)]),
        createPlayerState("p2", [numberCard("blue-2", "blue", 2)])
      ],
      challengeWindow: {
        active: true,
        targetPlayerId: "p1",
        hadBlackCardBeforeDraw: true,
        expiresWhenNextPlayerCompletesAction: true
      }
    });

    const snapshot = createPlayerGameSnapshot(state, "p2");

    expect("hadBlackCardBeforeDraw" in snapshot.challengeWindow).toBe(false);
  });

  it("snapshot 中能看到顶牌、当前颜色、当前玩家、方向和摸牌堆数量", () => {
    const topCard = coloredCard("yellow-skip", "yellow", "skip");
    const state = createGameState({
      topCard,
      currentColor: "yellow",
      currentPlayerId: "p2",
      direction: "counter-clockwise",
      drawPile: [
        numberCard("green-1", "green", 1),
        numberCard("green-2", "green", 2)
      ],
      players: [
        createPlayerState("p1", [numberCard("red-1", "red", 1)]),
        createPlayerState("p2", [numberCard("blue-2", "blue", 2)])
      ]
    });

    const snapshot = createPlayerGameSnapshot(state, "p1");

    expect(snapshot.topCard.id).toBe(topCard.id);
    expect(snapshot.currentColor).toBe("yellow");
    expect(snapshot.currentPlayerId).toBe("p2");
    expect(snapshot.direction).toBe("counter-clockwise");
    expect(snapshot.drawPileCount).toBe(2);
    expect(snapshot).not.toHaveProperty("drawPile");
  });
});
