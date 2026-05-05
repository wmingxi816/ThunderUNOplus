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

export function getSequenceCandidateCardIds(hand: readonly Card[]): Set<string> {
  const numberCounts = new Map<number, number>();

  for (const card of hand) {
    if (!isNumberCard(card)) {
      continue;
    }

    numberCounts.set(card.number, (numberCounts.get(card.number) ?? 0) + 1);
  }

  const candidateIds = new Set<string>();

  for (const card of hand) {
    if (!isNumberCard(card)) {
      continue;
    }

    if (canParticipateInSequence(card.number, numberCounts)) {
      candidateIds.add(card.id);
    }
  }

  return candidateIds;
}

export function isValidSequenceSelection(cards: readonly Card[]): boolean {
  if (cards.length < 5 || !cards.every(isNumberCard)) {
    return false;
  }

  const sortedCards = [...cards].sort((left, right) => left.number - right.number);

  for (let index = 1; index < sortedCards.length; index += 1) {
    const previousCard = sortedCards[index - 1];
    const currentCard = sortedCards[index];

    if (previousCard === undefined || currentCard === undefined) {
      return false;
    }

    if (currentCard.number !== previousCard.number + 1) {
      return false;
    }
  }

  return true;
}

function isNumberCard(card: Card): card is NumberCard {
  return card.kind === "number";
}

function canParticipateInSequence(
  number: number,
  numberCounts: ReadonlyMap<number, number>
): boolean {
  for (let start = 0; start <= 5; start += 1) {
    for (let end = start + 4; end <= 9; end += 1) {
      if (number < start || number > end) {
        continue;
      }

      let valid = true;

      for (let value = start; value <= end; value += 1) {
        if ((numberCounts.get(value) ?? 0) === 0) {
          valid = false;
          break;
        }
      }

      if (valid) {
        return true;
      }
    }
  }

  return false;
}
