/**
 * 洗牌工具。
 *
 * Phase 2A 对这里的要求很明确：
 * - 正常玩法要支持随机洗牌
 * - 测试要支持带 seed 的确定性洗牌
 * - 不能修改传入的原数组
 */
export type ShuffleSeed = string | number;

/**
 * 对克隆后的数组执行 Fisher-Yates 洗牌。
 * 如果提供 seed，就不用 Math.random，而是换成可复现的伪随机数生成器。
 */
export function shuffleDeck<T>(
  deck: readonly T[],
  seed?: ShuffleSeed
): T[] {
  const clonedDeck = [...deck];
  const random = seed === undefined ? Math.random : createSeededRandom(seed);

  for (let index = clonedDeck.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    const current = clonedDeck[index]!;
    const target = clonedDeck[swapIndex]!;
    clonedDeck[index] = target;
    clonedDeck[swapIndex] = current;
  }

  return clonedDeck;
}

/**
 * 基于标准化后的 32 位 seed 构造一个轻量级伪随机数生成器。
 * 它不是密码学安全随机数，只用于让测试可复现。
 */
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

/**
 * 把数字 seed 或字符串 seed 统一转成 32 位整数。
 * 字符串会先做哈希，这样同一个文本 seed 总能得到同样的洗牌结果。
 */
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
