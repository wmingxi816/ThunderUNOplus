import {
  canPlayCard,
  canStackDrawCard,
  isBlackCard,
  type Card,
  type GamePlayerState,
  type GameState
} from "@thunder-uno/uno-core";

/** 普通单牌或加牌链续接时，找出一张可出的单牌。 */
export function findPlayableCard(
  state: GameState,
  player: GamePlayerState
): Card | null {
  const playableCards = player.hand.filter((card) => {
    if (state.drawStack.active) {
      const previousDrawValue = state.drawStack.previousDrawValue;
      const previousDrawKind = state.drawStack.previousDrawKind;

      return (
        previousDrawValue !== null &&
        previousDrawKind !== null &&
        canStackDrawCard({
          nextCard: card,
          currentColor: state.currentColor,
          previousDrawValue,
          previousDrawKind
        })
      );
    }

    if (state.drawUntilColor.active) {
      return card.kind === "penalty-draw";
    }

    return canPlayCard({
      card,
      topCard: state.topCard,
      currentColor: state.currentColor
    });
  });

  if (playableCards.length === 0) {
    return null;
  }

  const coloredCards = playableCards.filter((card) => !isBlackCard(card));

  if (coloredCards.length > 0) {
    return coloredCards[0] ?? null;
  }

  return playableCards[0] ?? null;
}
