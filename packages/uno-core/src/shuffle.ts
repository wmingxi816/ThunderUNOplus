import type { CardColor } from "./card";

export type ShuffleSeed = string | number;

interface ShuffleCardLike {
  kind: string;
  color?: CardColor;
  number?: number;
  isBlack?: boolean;
}

type BucketCategory = "number" | "colored-action" | "black" | "other";

interface ShuffleBucket<T> {
  key: string;
  cards: T[];
  kind: string;
  color: CardColor | null;
  category: BucketCategory;
  initialCount: number;
  remainingCount: number;
  baseProbability: number;
  categoryBaseProbability: number;
  colorBaseProbability: number;
  virtualRemaining: number;
  minVirtual: number;
  maxVirtual: number;
  lastDrawIndex: number | null;
}

interface ShuffleMemory {
  drawIndex: number;
  recentKeys: string[];
  recentColors: (CardColor | null)[];
  recentCategories: BucketCategory[];
  lastKeyDrawIndex: Map<string, number>;
  lastColorDrawIndex: Map<CardColor, number>;
  lastCategoryDrawIndex: Map<BucketCategory, number>;
}

const SHUFFLE_CONFIG = {
  replenishRate: 0.45,
  recentWindowSize: 14,
  minVirtualRatio: 0.15,
  maxVirtualRatio: 1.8,
  droughtTrigger: 2.8,
  maxDroughtBoost: 1.25,
  sameExactKindPenalty: 0.9,
  sameCategoryPenalty: 0.97,
  softNoiseMin: 0.85,
  softNoiseMax: 1.15
} as const;

/**
 * Shuffle cards without mutating the original array.
 *
 * Non-card arrays keep the classic Fisher-Yates path.
 * Card decks use a soft weighted shuffle so short streaks are less extreme
 * while the overall distribution still follows the configured card counts.
 */
export function shuffleDeck<T>(deck: readonly T[], seed?: ShuffleSeed): T[] {
  const clonedDeck = [...deck];

  if (clonedDeck.length === 0) {
    return clonedDeck;
  }

  const random = seed === undefined ? Math.random : createSeededRandom(seed);

  if (!clonedDeck.every(isSoftShuffleCardLike)) {
    return fisherYatesShuffle(clonedDeck, random);
  }

  return softShuffleDeck(clonedDeck as readonly ShuffleCardLike[], random) as T[];
}

function fisherYatesShuffle<T>(deck: T[], random: () => number): T[] {
  const clonedDeck = [...deck];

  for (let index = clonedDeck.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    const current = clonedDeck[index]!;
    const target = clonedDeck[swapIndex]!;
    clonedDeck[index] = target;
    clonedDeck[swapIndex] = current;
  }

  return clonedDeck;
}

function softShuffleDeck<T extends ShuffleCardLike>(
  deck: readonly T[],
  random: () => number
): T[] {
  const buckets = buildBuckets(deck);
  const memory: ShuffleMemory = {
    drawIndex: 0,
    recentKeys: [],
    recentColors: [],
    recentCategories: [],
    lastKeyDrawIndex: new Map(),
    lastColorDrawIndex: new Map(),
    lastCategoryDrawIndex: new Map()
  };
  const result: T[] = [];

  while (result.length < deck.length) {
    const candidates = buckets
      .filter((bucket) => bucket.remainingCount > 0)
      .map((bucket) => {
        return {
          bucket,
          weight: computeBucketWeight(bucket, memory, random)
        };
      })
      .filter((candidate) => candidate.weight > 0);

    let pickedCandidate = pickWeightedCandidate(candidates, random);

    if (pickedCandidate === null) {
      const fallback = buckets.find((bucket) => bucket.remainingCount > 0);

      if (fallback === undefined) {
        break;
      }

      pickedCandidate = {
        bucket: fallback,
        weight: 1
      };
    }

    const pickedCard = pickedCandidate.bucket.cards.shift();

    if (pickedCard === undefined) {
      pickedCandidate.bucket.remainingCount = 0;
      continue;
    }

    result.push(pickedCard);
    updateBucketAfterDraw(pickedCandidate.bucket, memory);
  }

  return result;
}

function buildBuckets<T extends ShuffleCardLike>(
  deck: readonly T[]
): ShuffleBucket<T>[] {
  const totalCount = deck.length;
  const buckets = new Map<string, ShuffleBucket<T>>();
  const categoryCounts = new Map<BucketCategory, number>();
  const colorCounts = new Map<CardColor, number>();

  for (const card of deck) {
    const key = getShuffleBucketKey(card);
    const color = getShuffleColor(card);
    const category = getBucketCategory(card);

    categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);

    if (color !== null) {
      colorCounts.set(color, (colorCounts.get(color) ?? 0) + 1);
    }

    let bucket = buckets.get(key);

    if (bucket === undefined) {
      const initialCount = 0;

      bucket = {
        key,
        cards: [],
        kind: card.kind,
        color,
        category,
        initialCount,
        remainingCount: 0,
        baseProbability: 0,
        categoryBaseProbability: 0,
        colorBaseProbability: 0,
        virtualRemaining: 0,
        minVirtual: 0,
        maxVirtual: 0,
        lastDrawIndex: null
      };

      buckets.set(key, bucket);
    }

    bucket.cards.push(card);
    bucket.remainingCount += 1;
  }

  for (const bucket of buckets.values()) {
    bucket.initialCount = bucket.cards.length;
    bucket.baseProbability = bucket.initialCount / totalCount;
    bucket.categoryBaseProbability =
      (categoryCounts.get(bucket.category) ?? 0) / totalCount;
    bucket.colorBaseProbability =
      bucket.color === null ? 0 : (colorCounts.get(bucket.color) ?? 0) / totalCount;
    bucket.virtualRemaining = bucket.initialCount;
    bucket.minVirtual = bucket.initialCount * SHUFFLE_CONFIG.minVirtualRatio;
    bucket.maxVirtual = bucket.initialCount * SHUFFLE_CONFIG.maxVirtualRatio;
  }

  return [...buckets.values()];
}

function computeBucketWeight<T extends ShuffleCardLike>(
  bucket: ShuffleBucket<T>,
  memory: ShuffleMemory,
  random: () => number
): number {
  const baseWeight = Math.max(bucket.virtualRemaining, 0);

  if (baseWeight <= 0) {
    return 0;
  }

  const exactGap =
    bucket.lastDrawIndex === null
      ? memory.drawIndex + 1
      : memory.drawIndex - bucket.lastDrawIndex;
  const expectedGap = 1 / bucket.baseProbability;
  const droughtBoost =
    exactGap > expectedGap * SHUFFLE_CONFIG.droughtTrigger
      ? 1 +
        Math.min(
          SHUFFLE_CONFIG.maxDroughtBoost - 1,
          (exactGap / expectedGap - SHUFFLE_CONFIG.droughtTrigger) * 0.08
        )
      : 1;
  const categoryBoost = computeCategoryBoost(bucket, memory);
  const repeatPenalty = computeRepeatPenalty(bucket, memory);
  const colorBoost = computeColorBoost(bucket, memory);
  const softNoise = randomBetween(random, SHUFFLE_CONFIG.softNoiseMin, SHUFFLE_CONFIG.softNoiseMax);

  return Math.max(
    0,
    baseWeight * droughtBoost * categoryBoost * repeatPenalty * colorBoost * softNoise
  );
}

function computeCategoryBoost<T extends ShuffleCardLike>(
  bucket: ShuffleBucket<T>,
  memory: ShuffleMemory
): number {
  if (bucket.categoryBaseProbability <= 0) {
    return 1;
  }

  const lastDrawIndex = memory.lastCategoryDrawIndex.get(bucket.category);

  if (lastDrawIndex === undefined) {
    return 1;
  }

  const categoryGap = memory.drawIndex - lastDrawIndex;
  const expectedGap = 1 / bucket.categoryBaseProbability;

  if (categoryGap <= expectedGap * SHUFFLE_CONFIG.droughtTrigger) {
    return 1;
  }

  return 1 + Math.min(0.1, (categoryGap / expectedGap - SHUFFLE_CONFIG.droughtTrigger) * 0.03);
}

function computeRepeatPenalty<T extends ShuffleCardLike>(
  bucket: ShuffleBucket<T>,
  memory: ShuffleMemory
): number {
  const lastKey = memory.recentKeys[0];

  if (lastKey === bucket.key) {
    return SHUFFLE_CONFIG.sameExactKindPenalty;
  }

  const recentKeyHits = memory.recentKeys.slice(0, 3).filter((key) => key === bucket.key).length;

  if (recentKeyHits >= 2) {
    return 0.85;
  }

  if (memory.recentCategories[0] === bucket.category) {
    return SHUFFLE_CONFIG.sameCategoryPenalty;
  }

  return 1;
}

function computeColorBoost<T extends ShuffleCardLike>(
  bucket: ShuffleBucket<T>,
  memory: ShuffleMemory
): number {
  if (bucket.color === null || bucket.colorBaseProbability <= 0) {
    return 1;
  }

  const lastColorDrawIndex = memory.lastColorDrawIndex.get(bucket.color);

  if (lastColorDrawIndex === undefined) {
    return 1;
  }

  const colorGap = memory.drawIndex - lastColorDrawIndex;
  const expectedGap = 1 / bucket.colorBaseProbability;

  if (colorGap <= expectedGap * SHUFFLE_CONFIG.droughtTrigger) {
    return 1;
  }

  return 1 + Math.min(0.15, (colorGap / expectedGap - SHUFFLE_CONFIG.droughtTrigger) * 0.04);
}

function updateBucketAfterDraw<T extends ShuffleCardLike>(
  bucket: ShuffleBucket<T>,
  memory: ShuffleMemory
): void {
  bucket.remainingCount -= 1;
  bucket.lastDrawIndex = memory.drawIndex;
  bucket.virtualRemaining = clamp(
    bucket.virtualRemaining - 1 + bucket.baseProbability * SHUFFLE_CONFIG.replenishRate,
    bucket.minVirtual,
    bucket.maxVirtual
  );

  memory.lastKeyDrawIndex.set(bucket.key, memory.drawIndex);
  memory.lastCategoryDrawIndex.set(bucket.category, memory.drawIndex);

  if (bucket.color !== null) {
    memory.lastColorDrawIndex.set(bucket.color, memory.drawIndex);
    memory.recentColors = [bucket.color, ...memory.recentColors].slice(0, SHUFFLE_CONFIG.recentWindowSize);
  } else {
    memory.recentColors = [null, ...memory.recentColors].slice(0, SHUFFLE_CONFIG.recentWindowSize);
  }

  memory.recentKeys = [bucket.key, ...memory.recentKeys].slice(0, SHUFFLE_CONFIG.recentWindowSize);
  memory.recentCategories = [
    bucket.category,
    ...memory.recentCategories
  ].slice(0, SHUFFLE_CONFIG.recentWindowSize);
  memory.drawIndex += 1;
}

function pickWeightedCandidate<T extends ShuffleCardLike>(
  candidates: { bucket: ShuffleBucket<T>; weight: number }[],
  random: () => number
): { bucket: ShuffleBucket<T>; weight: number } | null {
  if (candidates.length === 0) {
    return null;
  }

  const totalWeight = candidates.reduce((sum, candidate) => sum + candidate.weight, 0);

  if (totalWeight <= 0) {
    return candidates[0] ?? null;
  }

  let threshold = random() * totalWeight;

  for (const candidate of candidates) {
    threshold -= candidate.weight;

    if (threshold <= 0) {
      return candidate;
    }
  }

  return candidates[candidates.length - 1] ?? null;
}

function getShuffleBucketKey(card: ShuffleCardLike): string {
  if (card.kind === "number") {
    return `${card.kind}:${String(card.color ?? "none")}:${String(card.number ?? "none")}`;
  }

  return card.color === undefined || card.color === null
    ? card.kind
    : `${card.kind}:${card.color}`;
}

function getShuffleColor(card: ShuffleCardLike): CardColor | null {
  return card.color ?? null;
}

function getBucketCategory(card: ShuffleCardLike): BucketCategory {
  if (card.isBlack === true) {
    return "black";
  }

  if (card.kind === "number") {
    return "number";
  }

  if (card.color !== undefined && card.color !== null) {
    return "colored-action";
  }

  return "other";
}

function isSoftShuffleCardLike(value: unknown): value is ShuffleCardLike {
  return (
    typeof value === "object" &&
    value !== null &&
    "kind" in value &&
    "isBlack" in value
  );
}

function createSeededRandom(seed: ShuffleSeed): () => number {
  let state = normalizeSeed(seed);

  return () => {
    state += 0x6d2b79f5;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

function normalizeSeed(seed: ShuffleSeed): number {
  if (typeof seed === "number") {
    return seed >>> 0;
  }

  let hashed = 2166136261;

  for (const character of seed) {
    hashed ^= character.charCodeAt(0);
    hashed = Math.imul(hashed, 16777619);
  }

  return hashed >>> 0;
}

function randomBetween(random: () => number, min: number, max: number): number {
  return min + (max - min) * random();
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
