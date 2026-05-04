import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { Card } from "@thunder-uno/shared-types";
import { getCardAssetPath, getCardBackAssetPath } from "./cardAssets";

function createCards(): Card[] {
  const cards: Card[] = [];
  const colors = ["red", "yellow", "blue", "green"] as const;
  const numbers = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

  for (const color of colors) {
    for (const number of numbers) {
      cards.push({
        id: `${color}-${String(number)}`,
        kind: "number",
        color,
        number,
        isBlack: false,
        displayName: `${color}${number}`
      });
    }

    cards.push(
      {
        id: `${color}-draw-two`,
        kind: "draw-two",
        color,
        isBlack: false,
        displayName: `${color}+2`
      },
      {
        id: `${color}-draw-four`,
        kind: "draw-four",
        color,
        isBlack: false,
        displayName: `${color}+4`
      },
      {
        id: `${color}-skip`,
        kind: "skip",
        color,
        isBlack: false,
        displayName: `${color}skip`
      },
      {
        id: `${color}-swap-hands`,
        kind: "swap-hands",
        color,
        isBlack: false,
        displayName: `${color}swap`
      },
      {
        id: `${color}-discard-same-color`,
        kind: "discard-same-color",
        color,
        isBlack: false,
        displayName: `${color}discard`
      },
      {
        id: `${color}-reverse`,
        kind: "reverse",
        color,
        isBlack: false,
        displayName: `${color}reverse`
      }
    );
  }

  cards.push(
    {
      id: "black-penalty-draw",
      kind: "penalty-draw",
      isBlack: true,
      drawValue: 2,
      displayName: "黑牌+2"
    },
    {
      id: "black-wild-draw-six",
      kind: "wild-draw-six",
      isBlack: true,
      drawValue: 6,
      displayName: "黑牌+6"
    },
    {
      id: "black-wild-reverse-draw-four",
      kind: "wild-reverse-draw-four",
      isBlack: true,
      drawValue: 4,
      displayName: "黑牌反转+4"
    },
    {
      id: "black-wild-draw-ten",
      kind: "wild-draw-ten",
      isBlack: true,
      drawValue: 10,
      displayName: "黑牌+10"
    },
    {
      id: "black-wild",
      kind: "wild",
      isBlack: true,
      displayName: "黑牌变色"
    }
  );

  return cards;
}

describe("card asset integrity", () => {
  it("covers every generated card asset and the card back", () => {
    const packageCardsDir = resolve(process.cwd(), "public", "cards");
    const publicCardsDir = existsSync(packageCardsDir)
      ? packageCardsDir
      : resolve(process.cwd(), "apps", "client-web", "public", "cards");
    const missingPaths = createCards()
      .map((card) => getCardAssetPath(card))
      .filter((assetPath) => !existsSync(resolve(publicCardsDir, assetPath.slice("/cards/".length))));

    const backPath = getCardBackAssetPath();

    if (!existsSync(resolve(publicCardsDir, backPath.slice("/cards/".length)))) {
      missingPaths.push(backPath);
    }

    expect(missingPaths).toEqual([]);
  });
});
