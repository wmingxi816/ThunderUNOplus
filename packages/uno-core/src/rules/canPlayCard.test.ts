/**
 * 这组测试只覆盖最基础的合法接牌路径。
 * 更复杂的组合出牌和状态推进放到后续阶段再测。
 */
import { describe, expect, it } from "vitest";
import {
  createColoredActionCard,
  createNumberCard
} from "../card";
import { canPlayCard } from "./canPlayCard";

describe("canPlayCard", () => {
  // 同色数字接牌是最基础、最像标准 UNO 的规则。
  it("allows red 3 to follow red 5", () => {
    const topCard = createNumberCard("top", "red", 5);
    const nextCard = createNumberCard("next", "red", 3);

    expect(canPlayCard({ card: nextCard, topCard })).toBe(true);
  });

  // 即使颜色不同，只要数字相同也应该能接。
  it("allows red 3 to follow green 3", () => {
    const topCard = createNumberCard("top", "green", 3);
    const nextCard = createNumberCard("next", "red", 3);

    expect(canPlayCard({ card: nextCard, topCard })).toBe(true);
  });

  // 在普通接牌路径下，有色技能牌当前只按颜色判断能不能接。
  it("allows red +2 to follow red +4", () => {
    const topCard = createColoredActionCard("top", "red", "draw-four");
    const nextCard = createColoredActionCard("next", "red", "draw-two");

    expect(canPlayCard({ card: nextCard, topCard })).toBe(true);
  });
});
