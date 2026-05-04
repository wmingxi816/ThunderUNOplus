/**
 * 开局测试验证的是后续所有玩法状态推进都会依赖的初始状态。
 */
import { describe, expect, it } from "vitest";
import { createInitialGame } from "./createInitialGame";

// 轻量玩家构造器，避免测试被无关资料字段干扰。
function createPlayers(count: number): { id: string }[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `player-${index + 1}`
  }));
}

describe("createInitialGame", () => {
  // 最小支持人数下也必须准确发出标准 7 张手牌。
  it("deals 7 cards to each player in a 3-player game", () => {
    const game = createInitialGame({
      players: createPlayers(3),
      mode: "no-challenge",
      seed: "three-player"
    });

    expect(game.players).toHaveLength(3);
    expect(game.players.every((player) => player.hand.length === 7)).toBe(true);
  });

  // 最大支持人数下也要能正常发牌，不能跳人也不能提前耗尽牌堆。
  it("deals 7 cards to each player in an 8-player game", () => {
    const game = createInitialGame({
      players: createPlayers(8),
      mode: "with-challenge",
      seed: "eight-player"
    });

    expect(game.players).toHaveLength(8);
    expect(game.players.every((player) => player.hand.length === 7)).toBe(true);
  });

  // 按规则黑牌不能作为起始牌，所以翻出来的桌面首牌必须始终带颜色。
  it("never flips a black card as the opening card", () => {
    const game = createInitialGame({
      players: createPlayers(4),
      mode: "no-challenge",
      seed: "opening-card"
    });

    expect(game.topCard.isBlack).toBe(false);
    expect(game.currentColor).toBe(game.topCard.color);
    expect(game.status).toBe("in-progress");
    expect(game.drawStack.active).toBe(false);
    expect(game.drawUntilColor.active).toBe(false);
    expect(game.normalDrawOffer.active).toBe(false);
    expect(game.challengeWindow.active).toBe(false);
  });
});
