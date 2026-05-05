/**
 * 加牌链测试覆盖的是这套项目自定义规则里最容易写错的部分。
 */
import { describe, expect, it } from "vitest";
import {
  createBlackCard,
  createColoredActionCard
} from "../card";
import { canStackDrawCard } from "./canStackDrawCard";

describe("canStackDrawCard", () => {
  // 同加牌值应该可以跨颜色接链。
  it("allows red +4 to be followed by blue +4", () => {
    const nextCard = createColoredActionCard("next", "blue", "draw-four");

    expect(
      canStackDrawCard({
        nextCard,
        currentColor: "red",
        previousDrawValue: 4
      })
    ).toBe(true);
  });

  // +2 也允许按加牌值接，不要求颜色一致。
  it("allows red +2 to be followed by blue +2", () => {
    const nextCard = createColoredActionCard("next", "blue", "draw-two");

    expect(
      canStackDrawCard({
        nextCard,
        currentColor: "red",
        previousDrawValue: 2
      })
    ).toBe(true);
  });

  // 跨加牌值接链是被禁止的，除非后续规则明确靠颜色放行。
  it("rejects red +2 followed by blue +4", () => {
    const nextCard = createColoredActionCard("next", "blue", "draw-four");

    expect(
      canStackDrawCard({
        nextCard,
        currentColor: "red",
        previousDrawValue: 2
      })
    ).toBe(false);
  });

  it("allows red +2 to be followed by red +4 by current color", () => {
    const nextCard = createColoredActionCard("next", "red", "draw-four");

    expect(
      canStackDrawCard({
        nextCard,
        currentColor: "red",
        previousDrawValue: 2
      })
    ).toBe(true);
  });

  // 黑色加牌牌是通用续链牌，不受前一张具体加牌值限制。
  it("always allows a black draw card to continue the draw chain", () => {
    const nextCard = createBlackCard("next", "wild-draw-six");

    expect(
      canStackDrawCard({
        nextCard,
        currentColor: "yellow",
        previousDrawValue: 2
      })
    ).toBe(true);
  });

  it("allows black reverse +4 to stack after another reverse +4", () => {
    const nextCard = createBlackCard("next", "wild-reverse-draw-four");

    expect(
      canStackDrawCard({
        nextCard,
        currentColor: "green",
        previousDrawValue: 4
      })
    ).toBe(true);
  });

  // 黑色 +6 指定蓝色后，蓝 +2 可以接，红 +2 不能接。
  it("allows blue +2 after black +6 only when the current color is blue", () => {
    const nextCard = createColoredActionCard("next", "blue", "draw-two");

    expect(
      canStackDrawCard({
        nextCard,
        currentColor: "blue",
        previousDrawValue: 6
      })
    ).toBe(true);

    expect(
      canStackDrawCard({
        nextCard,
        currentColor: "red",
        previousDrawValue: 6
      })
    ).toBe(false);
  });

  it.each([2, 4, 6, 10] as const)(
    "allows wild-reverse-draw-four after previous draw value %s",
    (previousDrawValue) => {
      const nextCard = createBlackCard("next", "wild-reverse-draw-four");

      expect(
        canStackDrawCard({
          nextCard,
          currentColor: "red",
          previousDrawValue
        })
      ).toBe(true);
    }
  );

  it.each([2, 4, 6, 10] as const)(
    "allows wild-draw-six after previous draw value %s",
    (previousDrawValue) => {
      const nextCard = createBlackCard("next", "wild-draw-six");

      expect(
        canStackDrawCard({
          nextCard,
          currentColor: "yellow",
          previousDrawValue
        })
      ).toBe(true);
    }
  );

  it.each([2, 4, 6, 10] as const)(
    "allows wild-draw-ten after previous draw value %s",
    (previousDrawValue) => {
      const nextCard = createBlackCard("next", "wild-draw-ten");

      expect(
        canStackDrawCard({
          nextCard,
          currentColor: "blue",
          previousDrawValue
        })
      ).toBe(true);
    }
  );

  it("rejects ordinary cards while a draw stack is active", () => {
    const nextCard = createColoredActionCard("next", "green", "skip");

    expect(
      canStackDrawCard({
        nextCard,
        currentColor: "green",
        previousDrawValue: 2
      })
    ).toBe(false);
  });
});
