/**
 * 加牌链继续接牌的判定规则。
 *
 * 当前设计里最关键的两点：
 * - 黑色 +10 不能被更低等级的黑色加牌覆盖
 * - 有色 +4 不能接在黑色 +4 后面
 */
import type { Card, CardColor, DrawCardKind } from "../card";
import {
  isBlackDrawCard,
  isColoredDrawCard,
  isDrawCard
} from "./cardGuards";

export interface CanStackDrawCardParams {
  nextCard: Card;
  currentColor?: CardColor;
  previousDrawValue: number;
  previousDrawKind?: DrawCardKind | null;
}

/** 判断下一张牌能不能合法地继续当前加牌链。 */
export function canStackDrawCard({
  nextCard,
  currentColor,
  previousDrawValue,
  previousDrawKind = null
}: CanStackDrawCardParams): boolean {
  if (!isDrawCard(nextCard)) {
    return false;
  }

  // 走到这里时，如果还不是有色加牌牌，那就说明它不能参与这条链。
  if (isColoredDrawCard(nextCard)) {
    if (
      previousDrawKind !== null &&
      isBlackDrawKind(previousDrawKind) &&
      nextCard.drawValue !== undefined &&
      nextCard.drawValue >= previousDrawValue
    ) {
      return false;
    }

    const sameDrawValue = nextCard.drawValue === previousDrawValue;
    const sameColor = currentColor !== undefined && nextCard.color === currentColor;

    return sameDrawValue || sameColor;
  }

  if (!isBlackDrawCard(nextCard)) {
    return false;
  }

  if (nextCard.drawValue === undefined) {
    return false;
  }

  return nextCard.drawValue >= previousDrawValue;
}

function isBlackDrawKind(kind: DrawCardKind): boolean {
  return (
    kind === "wild-reverse-draw-four" ||
    kind === "wild-draw-six" ||
    kind === "wild-draw-ten"
  );
}
