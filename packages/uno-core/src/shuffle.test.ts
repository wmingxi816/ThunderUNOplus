/**
 * 洗牌测试主要保护两件事：
 * - 带 seed 的洗牌必须可复现
 * - 洗牌不能污染调用方传入的原数组
 */
import { describe, expect, it } from "vitest";
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
});
