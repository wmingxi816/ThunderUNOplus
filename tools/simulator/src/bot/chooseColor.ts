import { CARD_COLORS, type Card, type CardColor } from "@thunder-uno/uno-core";

/**
 * 黑牌需要声明颜色时，选择当前玩家手里数量最多的颜色。
 * 如果没有任何有色牌，则默认 red。
 */
export function chooseColor(cards: readonly Card[]): CardColor {
  const counts = new Map<CardColor, number>();

  for (const color of CARD_COLORS) {
    counts.set(color, 0);
  }

  for (const card of cards) {
    if (card.color === undefined) {
      continue;
    }

    counts.set(card.color, (counts.get(card.color) ?? 0) + 1);
  }

  let bestColor: CardColor = "red";
  let bestCount = -1;

  for (const color of CARD_COLORS) {
    const count = counts.get(color) ?? 0;

    if (count > bestCount) {
      bestColor = color;
      bestCount = count;
    }
  }

  return bestColor;
}
