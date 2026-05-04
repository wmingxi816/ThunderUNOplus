import type { Card, NumberCard } from "@thunder-uno/shared-types";

export function getSelectedCards(
  hand: readonly Card[],
  selectedCardIds: readonly string[]
): Card[] {
  const handById = new Map(hand.map((card) => [card.id, card]));

  return selectedCardIds.flatMap((cardId) => {
    const card = handById.get(cardId);
    return card === undefined ? [] : [card];
  });
}

export function canPlaySequenceSelection(cards: readonly Card[]): boolean {
  return cards.length >= 5 && cards.every(isNumberCard);
}

export function canPlayMultipleNumberSelection(cards: readonly Card[]): boolean {
  if (cards.length < 2 || !cards.every(isNumberCard)) {
    return false;
  }

  const referenceCard = cards[0];

  if (referenceCard === undefined) {
    return false;
  }

  return cards.every((card) => {
    return card.color === referenceCard.color && card.number === referenceCard.number;
  });
}

export function canPlayDiscardSameColorSelection(cards: readonly Card[]): boolean {
  return buildDiscardSameColorPayload(cards) !== null;
}

export function buildDiscardSameColorPayload(cards: readonly Card[]): {
  mainCardId: string;
  attachedCardIds: string[];
} | null {
  const mainIndex = cards.findIndex((card) => card.kind === "discard-same-color");

  if (mainIndex === -1) {
    return null;
  }

  const mainCard = cards[mainIndex];

  if (mainCard === undefined) {
    return null;
  }

  return {
    mainCardId: mainCard.id,
    attachedCardIds: cards
      .filter((_, index) => index !== mainIndex)
      .map((card) => card.id)
  };
}

function isNumberCard(card: Card): card is NumberCard {
  return card.kind === "number";
}
