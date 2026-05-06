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

  it.each([
    ["red", "/cards/43_red_swap.png", "/cards/45_red_reverse.png"],
    ["yellow", "/cards/49_yellow_swap.png", "/cards/51_yellow_reverse.png"],
    ["blue", "/cards/55_blue_swap.png", "/cards/57_blue_reverse.png"],
    ["green", "/cards/61_green_swap.png", "/cards/63_green_reverse.png"]
  ] as const)(
    "keeps reverse and swap-hands artwork separate for %s",
    (color, reverseAsset, swapAsset) => {
      const reverse: Card = {
        id: `${color}-reverse`,
        kind: "reverse",
        color,
        isBlack: false,
        displayName: `${color} reverse`
      };
      const swapHands: Card = {
        id: `${color}-swap`,
        kind: "swap-hands",
        color,
        isBlack: false,
        displayName: `${color} swap`
      };

      expect(getCardAssetPath(reverse)).toBe(reverseAsset);
      expect(getCardAssetPath(swapHands)).toBe(swapAsset);
    }
  );
});
