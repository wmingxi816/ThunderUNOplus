/**
 * 当前规则版本对应的静态牌库配置。
 *
 * 这里是以下信息的统一来源：
 * - 每种牌到底有多少张
 * - 文档里声明的总牌数
 * - 代码实际实现并由测试验证的总牌数
 */
import type { BlackCardKind, CardKind, ColoredActionCardKind } from "./card";

export const CARD_CONFIG_SOURCE = {
  cardConfigDocumentPath: "CARD-CONFIG.md",
  rulesDocumentPath: "GAME-RULES.md",
  documentedDeckTotal: 220,
  implementedDeckTotal: 220
} as const;

export const NUMBER_CARD_COPIES_PER_COLOR = 3 as const;

export const COLORED_ACTION_CARD_COUNTS = {
  "draw-two": 3,
  "draw-four": 2,
  skip: 3,
  reverse: 3,
  "discard-same-color": 3,
  "swap-hands": 2
} as const satisfies Readonly<Record<ColoredActionCardKind, number>>;

export const BLACK_CARD_COUNTS = {
  wild: 12,
  "penalty-draw": 6,
  "wild-reverse-draw-four": 8,
  "wild-draw-six": 6,
  "wild-draw-ten": 4
} as const satisfies Readonly<Record<BlackCardKind, number>>;

export const TOTAL_NUMBER_CARD_COUNT = 120 as const;
export const TOTAL_COLORED_ACTION_CARD_COUNT = 64 as const;
export const TOTAL_BLACK_CARD_COUNT = 36 as const;
export const TOTAL_DECK_CARD_COUNT = 220 as const;

/**
 * 把上面的紧凑配置展开成“按牌型统计”的查询表。
 * 测试会用它来校验生成出来的整副牌是否和配置完全一致。
 */
export function getExpectedCardCountsByKind(): Record<CardKind, number> {
  return {
    number: TOTAL_NUMBER_CARD_COUNT,
    "draw-two": COLORED_ACTION_CARD_COUNTS["draw-two"] * 4,
    "draw-four": COLORED_ACTION_CARD_COUNTS["draw-four"] * 4,
    skip: COLORED_ACTION_CARD_COUNTS.skip * 4,
    reverse: COLORED_ACTION_CARD_COUNTS.reverse * 4,
    "discard-same-color":
      COLORED_ACTION_CARD_COUNTS["discard-same-color"] * 4,
    "swap-hands": COLORED_ACTION_CARD_COUNTS["swap-hands"] * 4,
    wild: BLACK_CARD_COUNTS.wild,
    "penalty-draw": BLACK_CARD_COUNTS["penalty-draw"],
    "wild-reverse-draw-four": BLACK_CARD_COUNTS["wild-reverse-draw-four"],
    "wild-draw-six": BLACK_CARD_COUNTS["wild-draw-six"],
    "wild-draw-ten": BLACK_CARD_COUNTS["wild-draw-ten"]
  };
}
