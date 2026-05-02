import { describe, expect, it } from "vitest";
import { GAME_MODES, type GameMode } from "./common";

describe("shared-types - GameMode", () => {
  it("只允许 with-challenge 和 no-challenge", () => {
    const modes: GameMode[] = ["with-challenge", "no-challenge"];

    expect(GAME_MODES).toEqual(modes);
  });
});
