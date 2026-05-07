/**
 * 加牌链继续接牌的判定规则。
 *
 * 当前设计里最关键的两点：
 * - 有色加牌牌只能按同种类继续叠加
 * - 黑色加牌牌可以升级叠加，但不能降级覆盖
 */
import type { Card, CardColor, DrawCardKind } from "../card";
import { isBlackDrawCard, isDrawCard } from "./cardGuards";

export interface CanStackDrawCardParams {
  nextCard: Card;
  currentColor?: CardColor;
  previousDrawValue: number;
  previousDrawKind?: DrawCardKind | null;
}

/** 判断下一张牌能不能合法地继续当前加牌链。 */
export function canStackDrawCard({
  nextCard,
  previousDrawValue,
  previousDrawKind = null
}: CanStackDrawCardParams): boolean {
  if (!isDrawCard(nextCard)) {
    return false;
  }

  if (previousDrawKind === null) {
    return false;
  }

  if (nextCard.kind === "draw-two") {
    return previousDrawKind === "draw-two";
  }

  if (nextCard.kind === "draw-four") {
    return previousDrawKind === "draw-four";
  }

  if (!isBlackDrawCard(nextCard)) {
    return false;
  }

  if (nextCard.drawValue === undefined) {
    return false;
  }

  return getDrawStackRank(nextCard.kind) >= getDrawStackRank(previousDrawKind) &&
    nextCard.drawValue >= previousDrawValue;
}

function getDrawStackRank(kind: DrawCardKind): number {
  switch (kind) {
    case "draw-two":
      return 2;
    case "draw-four":
    case "wild-reverse-draw-four":
      return 4;
    case "wild-draw-six":
      return 6;
    case "wild-draw-ten":
      return 10;
    default: {
      const exhaustiveCheck: never = kind;
      throw new Error(`Unsupported draw kind: ${String(exhaustiveCheck)}.`);
    }
  }
}
