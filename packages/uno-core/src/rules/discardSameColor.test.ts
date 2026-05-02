/**
 * 同色丢弃测试验证的是“主牌 + 附带牌”的自定义玩法语义。
 */
import { describe, expect, it } from "vitest";
import {
  createBlackCard,
  createColoredActionCard,
  createNumberCard
} from "../card";
import { validateDiscardSameColorPlay } from "./discardSameColor";

describe("validateDiscardSameColorPlay", () => {
  // 附带牌可以包含同色技能牌，因为它们只是一起丢弃，不会单独触发效果。
  it("allows discard-same-color to carry same-color action cards", () => {
    const mainCard = createColoredActionCard(
      "main",
      "red",
      "discard-same-color"
    );
    const result = validateDiscardSameColorPlay(mainCard, [
      createNumberCard("n1", "red", 5),
      createColoredActionCard("a1", "red", "swap-hands")
    ]);

    expect(result.valid).toBe(true);
    expect(result.topCardForNextPlayer?.id).toBe(mainCard.id);
  });

  // 黑牌不能作为附带牌混入同色丢弃。
  it("rejects discard-same-color attached to a black card", () => {
    const mainCard = createColoredActionCard(
      "main",
      "red",
      "discard-same-color"
    );
    const result = validateDiscardSameColorPlay(mainCard, [
      createBlackCard("b1", "wild")
    ]);

    expect(result.valid).toBe(false);
  });
});
