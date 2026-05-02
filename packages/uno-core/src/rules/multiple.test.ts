/**
 * 多张同数同色测试覆盖项目里的自定义“连对/多张同数同色”规则。
 */
import { describe, expect, it } from "vitest";
import { createNumberCard } from "../card";
import { validateMultipleNumberPlay } from "./multiple";

describe("validateMultipleNumberPlay", () => {
  // 颜色和数字都一致时应当通过。
  it("accepts green 6 + green 6", () => {
    const result = validateMultipleNumberPlay([
      createNumberCard("c1", "green", 6),
      createNumberCard("c2", "green", 6)
    ]);

    expect(result.valid).toBe(true);
  });

  // 只有数字相同还不够，颜色也必须相同。
  it("rejects green 6 + blue 6", () => {
    const result = validateMultipleNumberPlay([
      createNumberCard("c1", "green", 6),
      createNumberCard("c2", "blue", 6)
    ]);

    expect(result.valid).toBe(false);
  });
});
