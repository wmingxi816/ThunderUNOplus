/**
 * 自定义“连对 / 多张同数同色”玩法的校验函数。
 *
 * Phase 2A 的规则保持得比较严格：
 * - 必须全是有色数字牌
 * - 必须颜色相同
 * - 必须数字相同
 */
import type { Card, NumberCard } from "../card";
import { isNumberCard } from "./cardGuards";

export interface MultipleNumberValidationResult {
  valid: boolean;
  reason?: string;
}

/** 判断给定卡牌是否构成合法的多张同数同色出牌。 */
export function validateMultipleNumberPlay(
  cards: readonly Card[]
): MultipleNumberValidationResult {
  if (cards.length < 2) {
    return {
      valid: false,
      reason: "Multiple-number play requires at least 2 cards."
    };
  }

  if (!cards.every(isNumberCard)) {
    return {
      valid: false,
      reason: "Multiple-number play only supports colored number cards."
    };
  }

  const referenceCard = cards[0];

  if (referenceCard === undefined) {
    return {
      valid: false,
      reason: "Multiple-number play requires a reference card."
    };
  }

  // 后面的每一张牌都和第一张基准牌做比较。
  for (const card of cards.slice(1)) {
    if (card.color !== referenceCard.color) {
      return {
        valid: false,
        reason: "Multiple-number play requires the same color."
      };
    }

    if (card.number !== referenceCard.number) {
      return {
        valid: false,
        reason: "Multiple-number play requires the same number."
      };
    }
  }

  return { valid: true };
}
