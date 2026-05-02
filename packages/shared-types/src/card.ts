import type { CardId } from "./common";

export const CARD_COLORS = ["red", "yellow", "blue", "green"] as const;
export type CardColor = (typeof CARD_COLORS)[number];

export const NUMBER_CARD_VALUES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
export type CardNumber = (typeof NUMBER_CARD_VALUES)[number];

export const CARD_KINDS = [
  "number",
  "draw-two",
  "draw-four",
  "skip",
  "reverse",
  "discard-same-color",
  "swap-hands",
  "wild",
  "penalty-draw",
  "wild-reverse-draw-four",
  "wild-draw-six",
  "wild-draw-ten"
] as const;
export type CardKind = (typeof CARD_KINDS)[number];

export const COLORED_ACTION_CARD_KINDS = [
  "draw-two",
  "draw-four",
  "skip",
  "reverse",
  "discard-same-color",
  "swap-hands"
] as const;
export type ColoredActionCardKind = (typeof COLORED_ACTION_CARD_KINDS)[number];

export const BLACK_CARD_KINDS = [
  "wild",
  "penalty-draw",
  "wild-reverse-draw-four",
  "wild-draw-six",
  "wild-draw-ten"
] as const;
export type BlackCardKind = (typeof BLACK_CARD_KINDS)[number];

export const DRAW_CARD_KINDS = [
  "draw-two",
  "draw-four",
  "wild-reverse-draw-four",
  "wild-draw-six",
  "wild-draw-ten"
] as const;
export type DrawCardKind = (typeof DRAW_CARD_KINDS)[number];

export type DrawValue = 2 | 4 | 6 | 10;

export interface Card {
  id: CardId;
  kind: CardKind;
  color?: CardColor;
  number?: CardNumber;
  drawValue?: DrawValue;
  isBlack: boolean;
  displayName: string;
}

export type NumberCard = Card & {
  kind: "number";
  color: CardColor;
  number: CardNumber;
  isBlack: false;
};

export type ColoredActionCard = Card & {
  kind: ColoredActionCardKind;
  color: CardColor;
  isBlack: false;
};

export type DiscardSameColorCard = ColoredActionCard & {
  kind: "discard-same-color";
};

export type BlackCard = Card & {
  kind: BlackCardKind;
  isBlack: true;
};
