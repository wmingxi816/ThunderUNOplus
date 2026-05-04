/**
 * 洗牌测试主要保护两件事：
 * - 带 seed 的洗牌必须可复现
 * - 洗牌不能污染调用方传入的原数组
 */
import { describe, expect, it } from "vitest";
import { createBlackCard, createNumberCard } from "./card";
import { shuffleDeck } from "./shuffle";

describe("shuffleDeck", () => {
  // 相同 seed 必须得到完全一样的排列结果。
  it("returns a deterministic order when a seed is provided", () => {
    const source = [1, 2, 3, 4, 5, 6, 7, 8, 9];

    const shuffledA = shuffleDeck(source, "phase-2a-seed");
    const shuffledB = shuffleDeck(source, "phase-2a-seed");

    expect(shuffledA).toEqual(shuffledB);
  });

  // 实现必须保持纯函数特性，调用方才能放心复用原数组。
  it("does not mutate the original array", () => {
    const source = [1, 2, 3, 4, 5];
    const originalSnapshot = [...source];
    const shuffled = shuffleDeck(source, 42);

    expect(source).toEqual(originalSnapshot);
    expect(shuffled).not.toBe(source);
    expect(shuffled).toHaveLength(source.length);
  });

  it("keeps card decks deterministic on the soft shuffle path", () => {
    const source = [
      createNumberCard("red-1-a", "red", 1),
      createNumberCard("red-1-b", "red", 1),
      createNumberCard("blue-2-a", "blue", 2),
      createBlackCard("wild-a", "wild")
    ];

    const shuffledA = shuffleDeck(source, "soft-path-seed");
    const shuffledB = shuffleDeck(source, "soft-path-seed");

    expect(shuffledA.map((card) => card.id)).toEqual(
      shuffledB.map((card) => card.id)
    );
    expect(source.map((card) => card.id)).toEqual([
      "red-1-a",
      "red-1-b",
      "blue-2-a",
      "wild-a"
    ]);
  });
});
