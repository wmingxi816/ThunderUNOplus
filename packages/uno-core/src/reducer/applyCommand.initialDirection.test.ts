import { describe, expect, it } from "vitest";
import { applyCommand } from "./applyCommand";
import { createGameState, createPlayerState, numberCard } from "./testUtils";

describe("applyCommand - initial direction choice", () => {
  it("requires the first player to choose initial direction before normal actions", () => {
    const card = numberCard("red-7", "red", 7);
    const state = createGameState({
      players: [
        createPlayerState("p1", [card]),
        createPlayerState("p2", []),
        createPlayerState("p3", [])
      ],
      initialDirectionChoice: {
        active: true,
        chooserPlayerId: "p1"
      }
    });

    const result = applyCommand(state, {
      type: "play-card",
      playerId: "p1",
      cardId: card.id
    });

    expect(result.events[0]).toMatchObject({
      type: "command-rejected",
      code: "INITIAL_DIRECTION_CHOICE_REQUIRED"
    });
  });

  it("lets the first player choose the initial direction", () => {
    const state = createGameState({
      players: [
        createPlayerState("p1", []),
        createPlayerState("p2", []),
        createPlayerState("p3", [])
      ],
      initialDirectionChoice: {
        active: true,
        chooserPlayerId: "p1"
      }
    });

    const result = applyCommand(state, {
      type: "choose-initial-direction",
      playerId: "p1",
      direction: "counter-clockwise"
    });

    expect(result.state.direction).toBe("counter-clockwise");
    expect(result.state.initialDirectionChoice).toEqual({
      active: false,
      chooserPlayerId: null
    });
  });
});
