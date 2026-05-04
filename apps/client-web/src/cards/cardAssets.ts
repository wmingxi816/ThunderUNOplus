import type { Card, BlackCardKind, ColoredActionCardKind } from "@thunder-uno/shared-types";

const numberOffsets = {
  red: 0,
  yellow: 10,
  blue: 20,
  green: 30
} as const;

const actionIndexes = {
  red: {
    "draw-two": 40,
    "draw-four": 41,
    skip: 42,
    "swap-hands": 43,
    "discard-same-color": 44,
    reverse: 45
  },
  yellow: {
    "draw-two": 46,
    "draw-four": 47,
    skip: 48,
    "swap-hands": 49,
    "discard-same-color": 50,
    reverse: 51
  },
  blue: {
    "draw-two": 52,
    "draw-four": 53,
    skip: 54,
    "swap-hands": 55,
    "discard-same-color": 56,
    reverse: 57
  },
  green: {
    "draw-two": 58,
    "draw-four": 59,
    skip: 60,
    "swap-hands": 61,
    "discard-same-color": 62,
    reverse: 63
  }
} as const;

const blackIndexes = {
  "penalty-draw": 64,
  "wild-draw-six": 65,
  "wild-reverse-draw-four": 66,
  "wild-draw-ten": 67,
  wild: 68
} as const;

export function getCardAssetPath(card: Card): string {
  const index = getCardAssetIndex(card);
  return `/cards/${String(index).padStart(2, "0")}_${getCardAssetName(card)}.png`;
}

export function getCardBackAssetPath(): string {
  return "/cards/69_back.png";
}

function getCardAssetIndex(card: Card): number {
  if (card.kind === "number") {
    if (card.color === undefined || card.number === undefined) {
      return 69;
    }

    return numberOffsets[card.color] + card.number;
  }

  if (card.isBlack) {
    return blackIndexes[card.kind as BlackCardKind] ?? 68;
  }

  if (card.color === undefined) {
    return 69;
  }

  return actionIndexes[card.color][card.kind as ColoredActionCardKind] ?? 69;
}

function getCardAssetName(card: Card): string {
  if (card.kind === "number") {
    if (card.color === undefined || card.number === undefined) {
      return "back";
    }

    return `${card.color}_${String(card.number)}`;
  }

  if (card.isBlack) {
    switch (card.kind) {
      case "wild":
        return "black_wild";
      case "penalty-draw":
        return "black_faces";
      case "wild-reverse-draw-four":
        return "black_plus4_swap";
      case "wild-draw-six":
        return "black_plus6";
      case "wild-draw-ten":
        return "black_plus10";
      default:
        return "back";
    }
  }

  if (card.color === undefined) {
    return "back";
  }

  switch (card.kind) {
    case "draw-two":
      return `${card.color}_plus2`;
    case "draw-four":
      return `${card.color}_plus4`;
    case "skip":
      return `${card.color}_skip`;
    case "reverse":
      return `${card.color}_reverse`;
    case "discard-same-color":
      return `${card.color}_discard`;
    case "swap-hands":
      return `${card.color}_swap`;
    default:
      return "back";
  }
}
