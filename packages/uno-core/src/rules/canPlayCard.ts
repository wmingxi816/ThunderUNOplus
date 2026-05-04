/**
 * 基础接牌合法性判断。
 *
 * Phase 2A 这里只覆盖最基本的规则：
 * - 数字牌按颜色或数字接
 * - 有色技能牌按当前颜色接
 * - 黑牌始终可打
 * - 如果存在指定颜色，则优先用指定颜色而不是顶牌原色
 */
import type { Card, CardColor } from "../card";
import { isBlackCard, isNumberCard } from "./cardGuards";

export interface CanPlayCardParams {
  card: Card;
  topCard: Card | null;
  currentColor?: CardColor;
}

/**
 * 判断 `card` 在当前顶牌上下文中是否能打出。
 * 这里还不处理连出、多张组合、加牌链细则和质疑规则。
 */
export function canPlayCard({
  card,
  topCard,
  currentColor
}: CanPlayCardParams): boolean {
  if (topCard === null) {
    return true;
  }

  if (isBlackCard(card)) {
    return true;
  }

  // 黑牌改色后，后续接牌应该优先看外部声明的当前颜色。
  const activeColor = currentColor ?? topCard.color;

  if (activeColor !== undefined && card.color === activeColor) {
    return true;
  }

  // 只有数字牌支持按数字接；技能牌还可以按相同牌型跨颜色接。
  if (isNumberCard(card) && isNumberCard(topCard)) {
    return card.number === topCard.number;
  }

  if (!isNumberCard(card) && !isNumberCard(topCard)) {
    return card.kind === topCard.kind;
  }

  return false;
}
