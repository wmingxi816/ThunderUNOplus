/**
 * Phase 2A / 2B 的核心牌模型与工厂函数。
 *
 * 牌的基础类型已经在 shared-types 中稳定下来，
 * uno-core 这里继续负责：
 * - 中文展示文案
 * - 统一造牌工厂
 * - 给规则与测试复用的辅助函数
 */
import {
  BLACK_CARD_KINDS,
  CARD_COLORS,
  CARD_KINDS,
  COLORED_ACTION_CARD_KINDS,
  DRAW_CARD_KINDS,
  NUMBER_CARD_VALUES,
  type BlackCard,
  type BlackCardKind,
  type Card,
  type CardColor,
  type CardKind,
  type CardNumber,
  type ColoredActionCard,
  type ColoredActionCardKind,
  type DiscardSameColorCard,
  type DrawCardKind,
  type DrawValue,
  type NumberCard
} from "@thunder-uno/shared-types";

export {
  BLACK_CARD_KINDS,
  CARD_COLORS,
  CARD_KINDS,
  COLORED_ACTION_CARD_KINDS,
  DRAW_CARD_KINDS,
  NUMBER_CARD_VALUES
};

export type {
  BlackCard,
  BlackCardKind,
  Card,
  CardColor,
  CardKind,
  CardNumber,
  ColoredActionCard,
  ColoredActionCardKind,
  DiscardSameColorCard,
  DrawCardKind,
  DrawValue,
  NumberCard
};

const COLOR_LABELS: Record<CardColor, string> = {
  red: "红",
  yellow: "黄",
  blue: "蓝",
  green: "绿"
};

const KIND_LABELS: Record<CardKind, string> = {
  number: "数字牌",
  "draw-two": "普通+2",
  "draw-four": "普通+4",
  skip: "禁",
  reverse: "反转",
  "discard-same-color": "同色丢弃",
  "swap-hands": "交换手牌",
  wild: "变色",
  "penalty-draw": "罚抽",
  "wild-reverse-draw-four": "反转变色+4",
  "wild-draw-six": "变色+6",
  "wild-draw-ten": "变色+10"
};

const COLORED_ACTION_DRAW_VALUES: Partial<
  Record<ColoredActionCardKind, DrawValue>
> = {
  "draw-two": 2,
  "draw-four": 4
};

const BLACK_DRAW_VALUES: Partial<Record<BlackCardKind, DrawValue>> = {
  "wild-reverse-draw-four": 4,
  "wild-draw-six": 6,
  "wild-draw-ten": 10
};

/** 返回颜色枚举对应的中文展示文案。 */
export function getColorLabel(color: CardColor): string {
  return COLOR_LABELS[color];
}

/** 返回牌型枚举对应的中文展示文案。 */
export function getKindLabel(kind: CardKind): string {
  return KIND_LABELS[kind];
}

/** 创建一张标准的有色数字牌。 */
export function createNumberCard(
  id: string,
  color: CardColor,
  number: CardNumber
): NumberCard {
  return {
    id,
    kind: "number",
    color,
    number,
    isBlack: false,
    displayName: `${getColorLabel(color)}${number}`
  };
}

/** 创建一张有颜色的技能牌。 */
export function createColoredActionCard(
  id: string,
  color: CardColor,
  kind: ColoredActionCardKind
): ColoredActionCard {
  const drawValue = COLORED_ACTION_DRAW_VALUES[kind];

  return {
    id,
    kind,
    color,
    isBlack: false,
    ...(drawValue === undefined ? {} : { drawValue }),
    displayName: `${getColorLabel(color)}${getKindLabel(kind)}`
  };
}

/** 创建一张黑色技能牌。 */
export function createBlackCard(id: string, kind: BlackCardKind): BlackCard {
  const drawValue = BLACK_DRAW_VALUES[kind];

  return {
    id,
    kind,
    isBlack: true,
    ...(drawValue === undefined ? {} : { drawValue }),
    displayName: getKindLabel(kind)
  };
}
