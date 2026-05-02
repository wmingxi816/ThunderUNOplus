import type { ShuffleSeed } from "@thunder-uno/shared-types";

/**
 * Phase 3C 的场景工具只需要一个轻量、可复现的随机源。
 * 这里不依赖 simulator，避免 app 层反向引用工具层。
 */
export function createScenarioRandom(seed?: ShuffleSeed): () => number {
  if (seed === undefined) {
    return () => Math.random();
  }

  let state = normalizeSeed(seed) || 1;

  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function normalizeSeed(seed: ShuffleSeed): number {
  if (typeof seed === "number" && Number.isFinite(seed)) {
    return seed >>> 0;
  }

  let hash = 2166136261;

  for (const char of String(seed)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}
