/**
 * 自定义“顺子”玩法的校验函数。
 *
 * Phase 2A 的规则要求：
 * - 至少 5 张
 * - 只能是有色数字牌
 * - 排序后数字必须连续
 * - 不要求颜色相同
 */
import type { Card, NumberCard } from "../card";
import { isNumberCard } from "./cardGuards";

export interface SequenceValidationResult {
  valid: boolean;
  minCard?: Card;
  maxCard?: Card;
  reason?: string;
}

/** 校验一组牌是否构成顺子，并返回便于调试的辅助信息。 */
export function validateSequencePlay(
  cards: readonly Card[]
): SequenceValidationResult {
  if (cards.length < 5) {
    return {
      valid: false,
      reason: "Sequence play requires at least 5 cards."
    };
  }

  if (!cards.every(isNumberCard)) {
    return {
      valid: false,
      reason: "Sequence play only supports colored number cards."
    };
  }

  // 先排序，这样调用方传进来的顺序就不需要提前处理。
  const sortedCards = [...cards].sort((left, right) => {
    return left.number - right.number;
  });

  for (let index = 1; index < sortedCards.length; index += 1) {
    const previousCard = sortedCards[index - 1];
    const currentCard = sortedCards[index];

    if (previousCard === undefined || currentCard === undefined) {
      return {
        valid: false,
        reason: "Sequence validation encountered an unexpected gap."
      };
    }

    // 顺子要求后一张牌的数字必须严格比前一张大 1。
    if (currentCard.number !== previousCard.number + 1) {
      return {
        valid: false,
        reason: "Sequence numbers must be consecutive."
      };
    }
  }

  // 返回最小牌和最大牌，方便后续阶段做结算摘要或表现层动画。
  const minCard = sortedCards[0];
  const maxCard = sortedCards[sortedCards.length - 1];

  if (minCard === undefined || maxCard === undefined) {
    return {
      valid: false,
      reason: "Sequence validation could not determine min/max cards."
    };
  }

  return {
    valid: true,
    minCard,
    maxCard
  };
}
