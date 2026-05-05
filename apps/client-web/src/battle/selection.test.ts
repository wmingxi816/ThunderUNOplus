import { describe, expect, it } from "vitest";
import type { Card } from "@thunder-uno/shared-types";
import {
  buildDiscardSameColorPayload,
  canPlayDiscardSameColorSelection,
  canPlayMultipleNumberSelection,
  canPlaySequenceSelection,
  getSequenceCandidateCardIds,
  getSelectedCards,
  isValidSequenceSelection
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

  it("validates sequence selections strictly", () => {
    expect(
      isValidSequenceSelection([hand[1]!, hand[3]!, hand[4]!, hand[5]!, hand[2]!])
    ).toBe(false);
    expect(
      isValidSequenceSelection([
        hand[1]!,
        { id: "c7", kind: "number", color: "blue", number: 3, isBlack: false, displayName: "3" },
        { id: "c8", kind: "number", color: "green", number: 4, isBlack: false, displayName: "4" },
        { id: "c9", kind: "number", color: "yellow", number: 5, isBlack: false, displayName: "5" },
        { id: "c10", kind: "number", color: "red", number: 6, isBlack: false, displayName: "6" }
      ])
    ).toBe(true);
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

  it("marks every number card that can participate in a valid sequence", () => {
    const cards: Card[] = [
      { id: "n1", kind: "number", color: "red", number: 1, isBlack: false, displayName: "1" },
      { id: "n2a", kind: "number", color: "yellow", number: 2, isBlack: false, displayName: "2" },
      { id: "n3", kind: "number", color: "blue", number: 3, isBlack: false, displayName: "3" },
      { id: "n4a", kind: "number", color: "green", number: 4, isBlack: false, displayName: "4" },
      { id: "n4b", kind: "number", color: "red", number: 4, isBlack: false, displayName: "4" },
      { id: "n5a", kind: "number", color: "yellow", number: 5, isBlack: false, displayName: "5" },
      { id: "n5b", kind: "number", color: "blue", number: 5, isBlack: false, displayName: "5" },
      { id: "n6a", kind: "number", color: "green", number: 6, isBlack: false, displayName: "6" },
      { id: "n6b", kind: "number", color: "red", number: 6, isBlack: false, displayName: "6" },
      { id: "n6c", kind: "number", color: "yellow", number: 6, isBlack: false, displayName: "6" }
    ];

    expect(Array.from(getSequenceCandidateCardIds(cards)).sort()).toEqual([
      "n1",
      "n2a",
      "n3",
      "n4a",
      "n4b",
      "n5a",
      "n5b",
      "n6a",
      "n6b",
      "n6c"
    ]);
  });
});
