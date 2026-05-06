import type { GamePlayerState, GameState, TurnDirection } from "../gameState";

/** 判断玩家当前是否仍参与回合流转。 */
export function isActivePlayer(player: GamePlayerState): boolean {
  return !player.isEliminated && !player.hasLeftRoom;
}

/** 返回按座位顺序排列的未淘汰玩家 id。 */
export function getActivePlayerIds(state: GameState): string[] {
  return state.playerOrder.filter((playerId) => {
    const player = state.players.find((candidate) => candidate.id === playerId);

    return player !== undefined && isActivePlayer(player);
  });
}

/** 返回当前存活玩家数。 */
export function getActivePlayerCount(state: GameState): number {
  return getActivePlayerIds(state).length;
}

/** 切换出牌方向。 */
export function toggleDirection(direction: TurnDirection): TurnDirection {
  return direction === "clockwise" ? "counter-clockwise" : "clockwise";
}

/**
 * 计算从某位玩家开始，按当前方向数出去的第 N 个未淘汰玩家。
 *
 * `steps = 1` 表示正常的下一家；
 * `steps = 2` 可以直接表达“禁牌跳过一人”的效果。
 */
export function getNextActivePlayerId(
  state: GameState,
  fromPlayerId: string,
  steps = 1
): string | null {
  const activePlayerCount = getActivePlayerCount(state);

  if (activePlayerCount <= 1) {
    return null;
  }

  const startIndex = state.playerOrder.indexOf(fromPlayerId);

  if (startIndex < 0) {
    return null;
  }

  const delta = state.direction === "clockwise" ? 1 : -1;
  let foundSteps = 0;
  let cursor = startIndex;
  const maxIterations = state.playerOrder.length * (steps + 1);

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    cursor =
      (cursor + delta + state.playerOrder.length) % state.playerOrder.length;

    const playerId = state.playerOrder[cursor];

    if (playerId === undefined) {
      continue;
    }

    const player = state.players.find((candidate) => candidate.id === playerId);

    if (player === undefined || !isActivePlayer(player)) {
      continue;
    }

    foundSteps += 1;

    if (foundSteps === steps) {
      return player.id;
    }
  }

  return null;
}
