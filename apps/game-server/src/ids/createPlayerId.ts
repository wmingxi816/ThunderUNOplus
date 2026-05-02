let playerIdCounter = 0;

/** Phase 3A 的 playerId 只需要在当前进程内唯一即可。 */
export function createPlayerId(): string {
  playerIdCounter += 1;
  return `player-${String(playerIdCounter).padStart(6, "0")}`;
}
