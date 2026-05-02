/**
 * 牌库生成与校验工具。
 *
 * Phase 2A 里这里有几个明确目标：
 * - 牌数量只从 cardConfig.ts 读取
 * - 洗牌前的原始牌顺序保持稳定，方便测试
 * - 提供足够清晰的统计和断言工具，方便定位问题
 */
import {
  createBlackCard,
  createColoredActionCard,
  createNumberCard,
  type BlackCardKind,
  type Card,
  type CardKind,
  type ColoredActionCardKind,
  CARD_COLORS,
  NUMBER_CARD_VALUES
} from "./card";
import {
  BLACK_CARD_COUNTS,
  COLORED_ACTION_CARD_COUNTS,
  NUMBER_CARD_COPIES_PER_COLOR,
  TOTAL_BLACK_CARD_COUNT,
  TOTAL_COLORED_ACTION_CARD_COUNT,
  TOTAL_DECK_CARD_COUNT,
  TOTAL_NUMBER_CARD_COUNT
} from "./cardConfig";

export interface DeckCategorySummary {
  numberCards: number;
  coloredActionCards: number;
  blackCards: number;
  total: number;
}

/**
 * 生成稳定递增的卡牌 id。
 * 这样测试、日志和种子洗牌都更容易复现和排查。
 */
function nextCardIdFactory(): () => string {
  let cursor = 1;

  return () => `card-${String(cursor++).padStart(4, "0")}`;
}

/**
 * 在洗牌前生成完整的静态原始牌库。
 *
 * 生成顺序：
 * 1. 全部有色数字牌
 * 2. 全部有色技能牌
 * 3. 全部黑色技能牌
 *
 * 这个顺序本身不影响玩法，但固定顺序会让测试和调试更稳定。
 */
export function createDeck(): Card[] {
  const nextCardId = nextCardIdFactory();
  const deck: Card[] = [];

  // 数字牌按“颜色 -> 数字 -> 拷贝次数”的顺序展开。
  for (const color of CARD_COLORS) {
    for (const number of NUMBER_CARD_VALUES) {
      for (let copyIndex = 0; copyIndex < NUMBER_CARD_COPIES_PER_COLOR; copyIndex += 1) {
        deck.push(createNumberCard(nextCardId(), color, number));
      }
    }
  }

  // 有色技能牌也按每个颜色分别展开。
  for (const color of CARD_COLORS) {
    for (const [kind, count] of typedEntries(COLORED_ACTION_CARD_COUNTS)) {
      for (let copyIndex = 0; copyIndex < count; copyIndex += 1) {
        deck.push(
          createColoredActionCard(nextCardId(), color, kind)
        );
      }
    }
  }

  // 黑牌不区分颜色，只按牌型和数量生成。
  for (const [kind, count] of typedEntries(BLACK_CARD_COUNTS)) {
    for (let copyIndex = 0; copyIndex < count; copyIndex += 1) {
      deck.push(createBlackCard(nextCardId(), kind));
    }
  }

  // 如果配置计算值和真实生成结果不一致，就立刻抛错，避免问题扩散到后续流程。
  if (deck.length !== TOTAL_DECK_CARD_COUNT) {
    throw new Error(
      `Deck size mismatch: expected ${TOTAL_DECK_CARD_COUNT}, received ${deck.length}.`
    );
  }

  return deck;
}

/** 统计一副牌里每种牌型各有多少张。 */
export function summarizeDeckByKind(
  deck: readonly Card[]
): Record<CardKind, number> {
  const summary = createEmptyKindSummary();

  for (const card of deck) {
    summary[card.kind] += 1;
  }

  return summary;
}

/** 按规则层最常用的三大类对整副牌做统计。 */
export function summarizeDeckByCategory(
  deck: readonly Card[]
): DeckCategorySummary {
  let numberCards = 0;
  let coloredActionCards = 0;
  let blackCards = 0;

  for (const card of deck) {
    if (card.kind === "number") {
      numberCards += 1;
      continue;
    }

    if (card.isBlack) {
      blackCards += 1;
      continue;
    }

    coloredActionCards += 1;
  }

  const total = numberCards + coloredActionCards + blackCards;

  return {
    numberCards,
    coloredActionCards,
    blackCards,
    total
  };
}

/**
 * 如果当前牌库和声明配置不一致，就直接抛错。
 * 后续可以用于开局自检，或者用于未来的迁移/回归脚本。
 */
export function assertDeckShape(deck: readonly Card[]): void {
  const categorySummary = summarizeDeckByCategory(deck);

  if (categorySummary.numberCards !== TOTAL_NUMBER_CARD_COUNT) {
    throw new Error("Unexpected number card count.");
  }

  if (categorySummary.coloredActionCards !== TOTAL_COLORED_ACTION_CARD_COUNT) {
    throw new Error("Unexpected colored action card count.");
  }

  if (categorySummary.blackCards !== TOTAL_BLACK_CARD_COUNT) {
    throw new Error("Unexpected black card count.");
  }

  if (categorySummary.total !== TOTAL_DECK_CARD_COUNT) {
    throw new Error("Unexpected total deck count.");
  }
}

/** 给计数配置表做一个带类型的 Object.entries 包装。 */
function typedEntries<TRecord extends Record<string, number>>(
  record: TRecord
): [keyof TRecord, TRecord[keyof TRecord]][] {
  return Object.entries(record) as [keyof TRecord, TRecord[keyof TRecord]][];
}

/** 创建一个空的“按牌型计数”对象，供 summarizeDeckByKind 使用。 */
function createEmptyKindSummary(): Record<CardKind, number> {
  return {
    number: 0,
    "draw-two": 0,
    "draw-four": 0,
    skip: 0,
    reverse: 0,
    "discard-same-color": 0,
    "swap-hands": 0,
    wild: 0,
    "penalty-draw": 0,
    "wild-reverse-draw-four": 0,
    "wild-draw-six": 0,
    "wild-draw-ten": 0
  };
}
