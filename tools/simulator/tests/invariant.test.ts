import { describe, expect, it } from "vitest";
import { createInitialGame, type GameState } from "@thunder-uno/uno-core";
import { validateGameStateInvariant } from "../src/invariant/validateGameStateInvariant";

function createBaseState(): GameState {
  return createInitialGame({
    roomId: "test-room",
    players: [
      { id: "p1", displayName: "Bot 1", avatarUrl: null },
      { id: "p2", displayName: "Bot 2", avatarUrl: null },
      { id: "p3", displayName: "Bot 3", avatarUrl: null }
    ],
    mode: "no-challenge",
    seed: 6006,
    now: 0,
    snapshotVersion: 1
  });
}

describe("validateGameStateInvariant", () => {
  it("能发现重复 card id", () => {
    const state = createBaseState();
    const duplicateCard = state.players[0]!.hand[0]!;
    state.players[1]!.hand = [duplicateCard, ...state.players[1]!.hand];
    state.players[1]!.handCount = state.players[1]!.hand.length;

    const result = validateGameStateInvariant(state);

    expect(result.valid).toBe(false);
    expect(result.reason).toContain("duplicate card id");
  });

  it("能发现 currentPlayerId 是淘汰玩家", () => {
    const state = createBaseState();
    state.players[0]!.isEliminated = true;

    const result = validateGameStateInvariant(state);

    expect(result.valid).toBe(false);
    expect(result.reason).toContain("eliminated player");
  });
});
