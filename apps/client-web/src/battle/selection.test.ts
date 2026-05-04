import { describe, expect, it } from "vitest";
import type { Card } from "@thunder-uno/shared-types";
import {
  buildDiscardSameColorPayload,
  canPlayDiscardSameColorSelection,
  canPlayMultipleNumberSelection,
  canPlaySequenceSelection,
  getSelectedCards
} from "./selection";

const hand: Card[] = [
  {
    id: "c1",
    kind: "discard-same-color",
    color: "red",
    isBlack: false,
    displayName: "红同色丢弃"
  },
  {
    id: "c2",
    kind: "number",
    color: "red",
    number: 2,
    isBlack: false,
    displayName: "红2"
  },
  {
    id: "c3",
    kind: "number",
    color: "red",
    number: 2,
    isBlack: false,
    displayName: "红2"
  },
  {
    id: "c4",
    kind: "number",
    color: "blue",
    number: 3,
    isBlack: false,
    displayName: "蓝3"
  },
  {
    id: "c5",
    kind: "number",
    color: "green",
    number: 4,
    isBlack: false,
    displayName: "绿4"
  },
  {
    id: "c6",
    kind: "number",
    color: "yellow",
    number: 5,
    isBlack: false,
    displayName: "黄5"
  }
];

describe("selection helpers", () => {
  it("keeps selected cards in click order", () => {
    expect(getSelectedCards(hand, ["c3", "c1", "c6"]).map((card) => card.id)).toEqual([
      "c3",
      "c1",
      "c6"
    ]);
  });

  it("detects sequence selections", () => {
    expect(canPlaySequenceSelection([hand[1]!, hand[3]!, hand[4]!, hand[5]!, hand[2]!])).toBe(
      true
    );
  });

  it("detects multiple-number selections", () => {
    expect(canPlayMultipleNumberSelection([hand[1]!, hand[2]!])).toBe(true);
  });

  it("detects discard-same-color selections", () => {
    expect(canPlayDiscardSameColorSelection([hand[0]!, hand[1]!])).toBe(true);
    expect(buildDiscardSameColorPayload([hand[0]!, hand[1]!])).toEqual({
      mainCardId: "c1",
      attachedCardIds: ["c2"]
    });
    expect(canPlayDiscardSameColorSelection([hand[1]!, hand[0]!])).toBe(true);
    expect(buildDiscardSameColorPayload([hand[1]!, hand[0]!])).toEqual({
      mainCardId: "c1",
      attachedCardIds: ["c2"]
    });
  });
});
