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
        previousDrawValue: 4,
        previousDrawKind: "draw-four"
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
        previousDrawValue: 2,
        previousDrawKind: "draw-two"
      })
    ).toBe(true);
  });

  // 跨加牌值接链是被禁止的，不能再靠颜色放行。
  it("rejects red +2 followed by blue +4", () => {
    const nextCard = createColoredActionCard("next", "blue", "draw-four");

    expect(
      canStackDrawCard({
        nextCard,
        currentColor: "red",
        previousDrawValue: 2,
        previousDrawKind: "draw-two"
      })
    ).toBe(false);
  });

  it("rejects red +2 followed by red +4 even when current color matches", () => {
    const nextCard = createColoredActionCard("next", "red", "draw-four");

    expect(
      canStackDrawCard({
        nextCard,
        currentColor: "red",
        previousDrawValue: 2,
        previousDrawKind: "draw-two"
      })
    ).toBe(false);
  });

  // 黑色加牌牌可以升级续链。
  it("allows black draw cards to upgrade the draw chain", () => {
    const nextCard = createBlackCard("next", "wild-draw-six");

    expect(
      canStackDrawCard({
        nextCard,
        currentColor: "yellow",
        previousDrawValue: 2,
        previousDrawKind: "draw-two"
      })
    ).toBe(true);
  });

  it("allows black reverse +4 to stack after another reverse +4", () => {
    const nextCard = createBlackCard("next", "wild-reverse-draw-four");

    expect(
      canStackDrawCard({
        nextCard,
        currentColor: "green",
        previousDrawValue: 4,
        previousDrawKind: "wild-reverse-draw-four"
      })
    ).toBe(true);
  });

  // 黑色 +6 后，普通 +2 不能靠指定颜色接链。
  it("rejects colored +2 after black +6 even when the current color matches", () => {
    const nextCard = createColoredActionCard("next", "blue", "draw-two");

    expect(
      canStackDrawCard({
        nextCard,
        currentColor: "blue",
        previousDrawValue: 6,
        previousDrawKind: "wild-draw-six"
      })
    ).toBe(false);

    expect(
      canStackDrawCard({
        nextCard,
        currentColor: "red",
        previousDrawValue: 6,
        previousDrawKind: "wild-draw-six"
      })
    ).toBe(false);
  });

  it("rejects colored +4 after black +6 even when the current color matches", () => {
    const nextCard = createColoredActionCard("next", "blue", "draw-four");

    expect(
      canStackDrawCard({
        nextCard,
        currentColor: "blue",
        previousDrawValue: 6,
        previousDrawKind: "wild-draw-six"
      })
    ).toBe(false);
  });

  it.each([2, 4] as const)(
    "allows wild-reverse-draw-four after previous draw value %s",
    (previousDrawValue) => {
      const nextCard = createBlackCard("next", "wild-reverse-draw-four");

      expect(
        canStackDrawCard({
          nextCard,
          currentColor: "red",
          previousDrawValue,
          previousDrawKind: "draw-two"
        })
      ).toBe(true);
    }
  );

  it.each([2, 4] as const)(
    "allows wild-draw-six after lower previous draw value %s",
    (previousDrawValue) => {
      const nextCard = createBlackCard("next", "wild-draw-six");

      expect(
        canStackDrawCard({
          nextCard,
          currentColor: "yellow",
          previousDrawValue,
          previousDrawKind: "draw-two"
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
          previousDrawValue,
          previousDrawKind: "draw-two"
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
        previousDrawValue: 2,
        previousDrawKind: "draw-two"
      })
    ).toBe(false);
  });

  it("rejects ordinary wild cards after black +6", () => {
    const nextCard = createBlackCard("next", "wild");

    expect(
      canStackDrawCard({
        nextCard,
        currentColor: "blue",
        previousDrawValue: 6,
        previousDrawKind: "wild-draw-six"
      })
    ).toBe(false);
  });

  it("rejects colored +4 after black reverse +4 even when color matches", () => {
    const nextCard = createColoredActionCard("next", "red", "draw-four");

    expect(
      canStackDrawCard({
        nextCard,
        currentColor: "red",
        previousDrawValue: 4,
        previousDrawKind: "wild-reverse-draw-four"
      })
    ).toBe(false);
  });

  it("rejects colored +2 after colored +4 even when color matches", () => {
    const nextCard = createColoredActionCard("next", "red", "draw-two");

    expect(
      canStackDrawCard({
        nextCard,
        currentColor: "red",
        previousDrawValue: 4,
        previousDrawKind: "draw-four"
      })
    ).toBe(false);
  });

  it("rejects colored +2 after black reverse +4 even when color matches", () => {
    const nextCard = createColoredActionCard("next", "red", "draw-two");

    expect(
      canStackDrawCard({
        nextCard,
        currentColor: "red",
        previousDrawValue: 4,
        previousDrawKind: "wild-reverse-draw-four"
      })
    ).toBe(false);
  });

  it("rejects black reverse +4 after black +6", () => {
    const nextCard = createBlackCard("next", "wild-reverse-draw-four");

    expect(
      canStackDrawCard({
        nextCard,
        currentColor: "green",
        previousDrawValue: 6,
        previousDrawKind: "wild-draw-six"
      })
    ).toBe(false);
  });

  it("allows black +10 after black +6", () => {
    const nextCard = createBlackCard("next", "wild-draw-ten");

    expect(
      canStackDrawCard({
        nextCard,
        currentColor: "green",
        previousDrawValue: 6,
        previousDrawKind: "wild-draw-six"
      })
    ).toBe(true);
  });

  it("allows black +10 after black +10 so the reducer can clear the whole chain", () => {
    const nextCard = createBlackCard("next", "wild-draw-ten");

    expect(
      canStackDrawCard({
        nextCard,
        currentColor: "green",
        previousDrawValue: 10,
        previousDrawKind: "wild-draw-ten"
      })
    ).toBe(true);
  });

  it("rejects black +6 after black +10", () => {
    const nextCard = createBlackCard("next", "wild-draw-six");

    expect(
      canStackDrawCard({
        nextCard,
        currentColor: "green",
        previousDrawValue: 10,
        previousDrawKind: "wild-draw-ten"
      })
    ).toBe(false);
  });

  it("rejects black reverse +4 after black +10", () => {
    const nextCard = createBlackCard("next", "wild-reverse-draw-four");

    expect(
      canStackDrawCard({
        nextCard,
        currentColor: "green",
        previousDrawValue: 10,
        previousDrawKind: "wild-draw-ten"
      })
    ).toBe(false);
  });
});
