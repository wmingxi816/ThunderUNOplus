/**
 * 顺子测试验证的是项目自定义的“顺子”判定器。
 */
import { describe, expect, it } from "vitest";
import {
  createColoredActionCard,
  createNumberCard
} from "../card";
import { validateSequencePlay } from "./sequence";

describe("validateSequencePlay", () => {
  // 颜色可以混合，只要数字连续就算顺子。
  it("accepts a 0-4 sequence", () => {
    const result = validateSequencePlay([
      createNumberCard("c1", "red", 0),
      createNumberCard("c2", "yellow", 1),
      createNumberCard("c3", "blue", 2),
      createNumberCard("c4", "green", 3),
      createNumberCard("c5", "red", 4)
    ]);

    expect(result.valid).toBe(true);
    expect(result.minCard?.number).toBe(0);
    expect(result.maxCard?.number).toBe(4);
  });

  // 项目规则明确要求顺子至少 5 张。
  it("rejects a sequence with fewer than 5 cards", () => {
    const result = validateSequencePlay([
      createNumberCard("c1", "red", 0),
      createNumberCard("c2", "yellow", 1),
      createNumberCard("c3", "blue", 2),
      createNumberCard("c4", "green", 3)
    ]);

    expect(result.valid).toBe(false);
  });

  // 技能牌绝不能混进顺子判定里。
  it("rejects a sequence that contains an action card", () => {
    const result = validateSequencePlay([
      createNumberCard("c1", "red", 0),
      createNumberCard("c2", "yellow", 1),
      createNumberCard("c3", "blue", 2),
      createNumberCard("c4", "green", 3),
      createColoredActionCard("c5", "red", "skip")
    ]);

    expect(result.valid).toBe(false);
  });
});
