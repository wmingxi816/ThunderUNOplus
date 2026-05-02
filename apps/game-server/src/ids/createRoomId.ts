const ROOM_ID_LENGTH = 6;
const ROOM_ID_MIN = 100_000;
const ROOM_ID_MAX = 999_999;
const MAX_ROOM_ID_ATTEMPTS = 2_000;

/**
 * 生成 6 位数字房间号，并确保当前内存房间集合里不重复。
 * Phase 3A 先用内存去重，后续如果接 Redis / DB，再把唯一性边界外移。
 */
export function createRoomId(
  existingRoomIds: ReadonlySet<string>,
  random: () => number = Math.random
): string {
  for (let attempt = 0; attempt < MAX_ROOM_ID_ATTEMPTS; attempt += 1) {
    const candidate = String(
      Math.floor(random() * (ROOM_ID_MAX - ROOM_ID_MIN + 1)) + ROOM_ID_MIN
    ).padStart(ROOM_ID_LENGTH, "0");

    if (!existingRoomIds.has(candidate)) {
      return candidate;
    }
  }

  throw new Error("Failed to generate a unique 6-digit roomId.");
}
