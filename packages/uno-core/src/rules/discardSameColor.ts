/**
 * 自定义“同色丢弃”玩法的校验函数。
 *
 * 这里最重要的语义是：
 * - 附带牌只是跟着一起丢掉
 * - 附带牌不会各自触发技能
 * - 下一家看到的顶牌仍然是主牌“同色丢弃”
 */
import type { Card } from "../card";
import { isBlackCard, isDiscardSameColorCard } from "./cardGuards";

export interface DiscardSameColorValidationResult {
  valid: boolean;
  reason?: string;
  topCardForNextPlayer?: Card;
}

/** 校验“同色丢弃”主牌以及所有附带牌是否合法。 */
export function validateDiscardSameColorPlay(
  mainCard: Card,
  attachedCards: readonly Card[]
): DiscardSameColorValidationResult {
  if (!isDiscardSameColorCard(mainCard)) {
    return {
      valid: false,
      reason: "Main card must be a discard-same-color card."
    };
  }

  for (const card of attachedCards) {
    if (isBlackCard(card)) {
      return {
        valid: false,
        reason: "Attached cards cannot include black cards."
      };
    }

    // 附带牌必须和主牌同色，而且绝不允许夹带黑牌。
    if (card.color !== mainCard.color) {
      return {
        valid: false,
        reason: "Attached cards must match the main card color."
      };
    }
  }

  return {
    valid: true,
    // 后续玩家接的仍然是主牌，而不是附带牌。
    topCardForNextPlayer: mainCard
  };
}
