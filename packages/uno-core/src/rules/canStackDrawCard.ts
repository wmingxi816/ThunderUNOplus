/**
 * 加牌链继续接牌的判定规则。
 *
 * 当前设计里最关键的两点：
 * - 黑色加牌牌始终可以继续接链
 * - 有色 +2 / +4 既可以按同加牌值接，也可以按当前颜色接
 */
import type { Card, CardColor } from "../card";
import {
  isBlackDrawCard,
  isColoredDrawCard,
  isDrawCard
} from "./cardGuards";

export interface CanStackDrawCardParams {
  nextCard: Card;
  currentColor?: CardColor;
  previousDrawValue: number;
}

/** 判断下一张牌能不能合法地继续当前加牌链。 */
export function canStackDrawCard({
  nextCard,
  currentColor,
  previousDrawValue
}: CanStackDrawCardParams): boolean {
  if (!isDrawCard(nextCard)) {
    return false;
  }

  // 黑色加牌牌无视颜色，永远是合法续链牌。
  if (isBlackDrawCard(nextCard)) {
    return true;
  }

  // 走到这里时，如果还不是有色加牌牌，那就说明它不能参与这条链。
  if (!isColoredDrawCard(nextCard)) {
    return false;
  }

  // 有色加牌牌可以通过“同加牌值”或“同当前颜色”任一条件接入。
  const sameDrawValue = nextCard.drawValue === previousDrawValue;
  const sameColor = currentColor !== undefined && nextCard.color === currentColor;

  return sameDrawValue || sameColor;
}
