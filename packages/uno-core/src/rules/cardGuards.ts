/**
 * 多个规则模块共用的小型类型守卫。
 *
 * 这些工具有两个作用：
 * - 让真正的规则函数更容易读
 * - 帮助 TypeScript 做类型收窄，后续访问字段时更安全
 */
import type {
  BlackCard,
  Card,
  ColoredActionCard,
  DiscardSameColorCard,
  DrawCardKind,
  NumberCard
} from "../card";

const DRAW_CARD_KINDS = new Set<DrawCardKind>([
  "draw-two",
  "draw-four",
  "wild-reverse-draw-four",
  "wild-draw-six",
  "wild-draw-ten"
]);

/** 判断一张牌是不是不自带颜色的黑牌。 */
export function isBlackCard(card: Card): card is BlackCard {
  return card.isBlack;
}

/** 判断一张牌是不是普通的有色数字牌。 */
export function isNumberCard(card: Card): card is NumberCard {
  return card.kind === "number";
}

/** 判断一张牌是不是非数字的有色技能牌。 */
export function isColoredActionCard(card: Card): card is ColoredActionCard {
  return !card.isBlack && card.kind !== "number";
}

/** 判断一张牌是不是“同色丢弃”主牌。 */
export function isDiscardSameColorCard(
  card: Card
): card is DiscardSameColorCard {
  return card.kind === "discard-same-color";
}

/** 判断一张牌是否会为加牌链贡献加牌值。 */
export function isDrawCard(card: Card): card is Card & { kind: DrawCardKind } {
  return DRAW_CARD_KINDS.has(card.kind as DrawCardKind);
}

/** 判断一张牌是否是有颜色的 +2 / +4。 */
export function isColoredDrawCard(card: Card): boolean {
  return card.kind === "draw-two" || card.kind === "draw-four";
}

/** 判断一张牌是否是黑色加牌牌。 */
export function isBlackDrawCard(card: Card): boolean {
  return (
    card.kind === "wild-reverse-draw-four" ||
    card.kind === "wild-draw-six" ||
    card.kind === "wild-draw-ten"
  );
}
