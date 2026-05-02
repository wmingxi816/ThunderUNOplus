import {
  canPlayCard,
  isNumberCard,
  validateSequencePlay,
  type Card,
  type GamePlayerState,
  type GameState,
  type NumberCard
} from "@thunder-uno/uno-core";

/** 从当前玩家手牌中找一组可出的顺子。 */
export function findPlayableSequence(
  state: GameState,
  player: GamePlayerState
): Card[] | null {
  if (state.drawStack.active || state.drawUntilColor.active) {
    return null;
  }

  const numberCards = player.hand.filter(isNumberCard);
  const cardsByNumber = new Map<number, NumberCard[]>();

  for (const card of numberCards) {
    const bucket = cardsByNumber.get(card.number) ?? [];
    bucket.push(card);
    cardsByNumber.set(card.number, bucket);
  }

  let bestCandidate: Card[] | null = null;

  for (let start = 0; start <= 9; start += 1) {
    const candidate: NumberCard[] = [];

    for (let number = start; number <= 9; number += 1) {
      const bucket = cardsByNumber.get(number);

      if (bucket === undefined || bucket.length === 0) {
        break;
      }

      candidate.push(bucket[0]!);

      if (candidate.length < 5) {
        continue;
      }

      const validation = validateSequencePlay(candidate);
      const minCard = validation.minCard;

      if (
        validation.valid &&
        minCard !== undefined &&
        canPlayCard({
          card: minCard,
          topCard: state.topCard,
          currentColor: state.currentColor
        })
      ) {
        if (bestCandidate === null || candidate.length > bestCandidate.length) {
          bestCandidate = [...candidate];
        }
      }
    }
  }

  return bestCandidate;
}
