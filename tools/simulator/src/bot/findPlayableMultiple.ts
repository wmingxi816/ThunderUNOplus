import {
  canPlayCard,
  isNumberCard,
  validateMultipleNumberPlay,
  type Card,
  type GamePlayerState,
  type GameState,
  type NumberCard
} from "@thunder-uno/uno-core";

/** 找出一组同色同数的连对出牌。 */
export function findPlayableMultiple(
  state: GameState,
  player: GamePlayerState
): Card[] | null {
  if (state.drawStack.active || state.drawUntilColor.active) {
    return null;
  }

  const groups = new Map<string, NumberCard[]>();

  for (const card of player.hand) {
    if (!isNumberCard(card)) {
      continue;
    }

    const key = `${card.color}:${card.number}`;
    const bucket = groups.get(key) ?? [];
    bucket.push(card);
    groups.set(key, bucket);
  }

  let bestCandidate: Card[] | null = null;

  for (const cards of groups.values()) {
    if (cards.length < 2) {
      continue;
    }

    const referenceCard = cards[0];

    if (
      referenceCard === undefined ||
      !canPlayCard({
        card: referenceCard,
        topCard: state.topCard,
        currentColor: state.currentColor
      })
    ) {
      continue;
    }

    const validation = validateMultipleNumberPlay(cards);

    if (!validation.valid) {
      continue;
    }

    if (bestCandidate === null || cards.length > bestCandidate.length) {
      bestCandidate = [...cards];
    }
  }

  return bestCandidate;
}
