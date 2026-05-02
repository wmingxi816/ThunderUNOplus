/**
 * 牌库测试的核心目标只有一个：
 * 生成出来的静态牌库必须和文档配置保持完全同步。
 * 只要数量改了，这组测试就应该第一时间失败。
 */
import { describe, expect, it } from "vitest";
import { createDeck, summarizeDeckByCategory, summarizeDeckByKind } from "./deck";
import { getExpectedCardCountsByKind } from "./cardConfig";

describe("createDeck", () => {
  // 总牌数是最敏感的第一层预警，一旦配置漂移这里应该最先挂。
  it("generates 220 cards", () => {
    const deck = createDeck();

    expect(deck).toHaveLength(220);
  });

  // 数字牌占比最高，而且是三层循环生成，单独测一条更稳妥。
  it("generates the expected number of regular number cards", () => {
    const deck = createDeck();
    const summary = summarizeDeckByCategory(deck);

    expect(summary.numberCards).toBe(120);
  });

  // 有色技能牌最容易因为“每色几张”调整而算错，所以单独校验。
  it("generates the expected number of colored action cards", () => {
    const deck = createDeck();
    const summary = summarizeDeckByCategory(deck);

    expect(summary.coloredActionCards).toBe(64);
  });

  // 黑牌不按颜色分摊，计数逻辑不同，单独测更清晰。
  it("generates the expected number of black action cards", () => {
    const deck = createDeck();
    const summary = summarizeDeckByCategory(deck);

    expect(summary.blackCards).toBe(36);
  });

  // 未来手牌操作、事件同步和回放都会依赖唯一 id，因此这里必须提前守住。
  it("assigns a unique id to every card", () => {
    const deck = createDeck();
    const uniqueIds = new Set(deck.map((card) => card.id));

    expect(uniqueIds.size).toBe(deck.length);
  });

  // 这是最严格的检查：每个牌型的数量都必须和配置逐项完全对齐。
  it("matches the configured count for every card kind", () => {
    const deck = createDeck();
    const summary = summarizeDeckByKind(deck);

    expect(summary).toEqual(getExpectedCardCountsByKind());
  });
});
