import {
  canPlayCard,
  isBlackCard,
  validateDiscardSameColorPlay,
  type Card,
  type DiscardSameColorCard,
  type GamePlayerState,
  type GameState
} from "@thunder-uno/uno-core";

export interface DiscardSameColorChoice {
  mainCard: DiscardSameColorCard;
  attachedCards: Card[];
}

/** 找出一组合法的同色丢弃。 */
export function findPlayableDiscardSameColor(
  state: GameState,
  player: GamePlayerState
): DiscardSameColorChoice | null {
  if (state.drawStack.active || state.drawUntilColor.active) {
    return null;
  }

  const mainCards = player.hand.filter(
    (card): card is DiscardSameColorCard => card.kind === "discard-same-color"
  );

  for (const mainCard of mainCards) {
    if (
      !canPlayCard({
        card: mainCard,
        topCard: state.topCard,
        currentColor: state.currentColor
      })
    ) {
      continue;
    }

    const attachedCards = player.hand.filter((card) => {
      return (
        card.id !== mainCard.id &&
        !isBlackCard(card) &&
        card.color === mainCard.color
      );
    });

    const validation = validateDiscardSameColorPlay(mainCard, attachedCards);

    if (!validation.valid) {
      continue;
    }

    return {
      mainCard,
      attachedCards
    };
  }

  return null;
}
