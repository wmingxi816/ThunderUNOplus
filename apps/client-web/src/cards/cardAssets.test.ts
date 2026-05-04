import { describe, expect, it } from "vitest";
import type { Card } from "@thunder-uno/shared-types";
import { getCardAssetPath } from "./cardAssets";

describe("getCardAssetPath", () => {
  it("maps number cards to the copied card assets", () => {
    const card: Card = {
      id: "c1",
      kind: "number",
      color: "blue",
      number: 7,
      isBlack: false,
      displayName: "蓝7"
    };

    expect(getCardAssetPath(card)).toBe("/cards/27_blue_7.png");
  });

  it("maps black action cards to the copied card assets", () => {
    const card: Card = {
      id: "c2",
      kind: "wild-draw-ten",
      drawValue: 10,
      isBlack: true,
      displayName: "变色+10"
    };

    expect(getCardAssetPath(card)).toBe("/cards/67_black_plus10.png");
  });

  it("keeps reverse and swap-hands action artwork separate", () => {
    const reverse: Card = {
      id: "reverse",
      kind: "reverse",
      color: "red",
      isBlack: false,
      displayName: "red reverse"
    };
    const swapHands: Card = {
      id: "swap",
      kind: "swap-hands",
      color: "red",
      isBlack: false,
      displayName: "red swap"
    };

    expect(getCardAssetPath(reverse)).toBe("/cards/45_red_reverse.png");
    expect(getCardAssetPath(swapHands)).toBe("/cards/43_red_swap.png");
  });
});
