/** 构造一个可复现的伪随机数生成器。 */
export function createSeededRandom(seed: string | number): () => number {
  let state = normalizeSeed(seed);

  return () => {
    state += 0x6d2b79f5;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

/** 把字符串或数字种子标准化成 32 位无符号整数。 */
export function normalizeSeed(seed: string | number): number {
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
