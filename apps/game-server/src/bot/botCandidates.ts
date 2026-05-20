import type { Card, CardColor, GameCommand, GameState, PlayerId } from "@thunder-uno/shared-types";
import {
  CARD_COLORS,
  canPlayCard,
  canStackDrawCard,
  isBlackCard,
  isDiscardSameColorCard,
  isDrawCard,
  isNumberCard,
  validateDiscardSameColorPlay,
  validateMultipleNumberPlay,
  validateSequencePlay
} from "@thunder-uno/uno-core";

export interface BotCandidateAction {
  command: GameCommand;
  cardIds: string[];
  declaredColor?: CardColor | undefined;
  reasons: string[];
}

export function generateBotCandidates(
  state: GameState,
  playerId: PlayerId
): BotCandidateAction[] {
  const player = state.players.find((candidate) => candidate.id === playerId);

  if (player === undefined || state.status === "finished") {
    return [];
  }

  if (state.normalDrawOffer.active && state.normalDrawOffer.playerId === playerId) {
    return generateNormalDrawOfferCandidates(state, playerId, player.hand);
  }

  if (state.drawStack.active && state.drawStack.targetPlayerId === playerId) {
    return generateDrawStackCandidates(state, playerId, player.hand);
  }

  if (state.drawUntilColor.active && state.drawUntilColor.targetPlayerId === playerId) {
    return generateDrawUntilColorCandidates(state, playerId, player.hand);
  }

  const candidates = [
    ...generateDiscardSameColorCandidates(state, playerId, player.hand),
    ...generateSequenceCandidates(state, playerId, player.hand),
    ...generateMultipleNumberCandidates(state, playerId, player.hand),
    ...generateSingleCardCandidates(state, playerId, player.hand),
    ...generateStrategicDrawCandidates(state, playerId)
  ];

  if (candidates.length > 0) {
    return candidates;
  }

  return [
    {
      command: {
        type: "draw-card",
        playerId
      },
      cardIds: [],
      reasons: ["no-playable-card"]
    }
  ];
}

function generateStrategicDrawCandidates(
  state: GameState,
  playerId: PlayerId
): BotCandidateAction[] {
  if (state.drawPile.length === 0) {
    return [];
  }

  return [
    {
      command: {
        type: "draw-card",
        playerId
      },
      cardIds: [],
      reasons: ["strategic-draw"]
    }
  ];
}

function generateNormalDrawOfferCandidates(
  state: GameState,
  playerId: PlayerId,
  hand: readonly Card[]
): BotCandidateAction[] {
  const card = hand.find((candidate) => candidate.id === state.normalDrawOffer.cardId);
  const candidates: BotCandidateAction[] = [
    {
      command: {
        type: "keep-drawn-card",
        playerId
      },
      cardIds: [],
      reasons: ["keep-drawn-card"]
    }
  ];

  if (card !== undefined) {
    candidates.push({
      command: {
        type: "play-card",
        playerId,
        cardId: card.id,
        ...getDeclaredColorPayload(state, hand, [card.id], card)
      },
      cardIds: [card.id],
      declaredColor: getDeclaredColor(state, hand, [card.id], card),
      reasons: ["play-drawn-card"]
    });
  }

  return candidates;
}

function generateDrawStackCandidates(
  state: GameState,
  playerId: PlayerId,
  hand: readonly Card[]
): BotCandidateAction[] {
  const previousDrawValue = state.drawStack.previousDrawValue;
  const previousDrawKind = state.drawStack.previousDrawKind;
  const candidates: BotCandidateAction[] = [];

  if (previousDrawValue !== null && previousDrawKind !== null) {
    for (const card of hand) {
      if (
        canStackDrawCard({
          nextCard: card,
          currentColor: state.currentColor,
          previousDrawValue,
          previousDrawKind
        })
      ) {
        candidates.push({
          command: {
            type: "play-card",
            playerId,
            cardId: card.id,
            ...getDeclaredColorPayload(state, hand, [card.id], card)
          },
          cardIds: [card.id],
          declaredColor: getDeclaredColor(state, hand, [card.id], card),
          reasons: ["stack-draw-card"]
        });
      }
    }
  }

  candidates.push({
    command: {
      type: "resolve-draw-stack",
      playerId
    },
    cardIds: [],
    reasons: ["resolve-draw-stack"]
  });

  return candidates;
}

function generateDrawUntilColorCandidates(
  state: GameState,
  playerId: PlayerId,
  hand: readonly Card[]
): BotCandidateAction[] {
  const candidates = hand
    .filter((card) => card.kind === "penalty-draw")
    .map<BotCandidateAction>((card) => {
      const declaredColor = getDeclaredColor(state, hand, [card.id], card);

      return {
        command: {
          type: "play-card",
          playerId,
          cardId: card.id,
          ...(declaredColor === undefined ? {} : { declaredColor })
        },
        cardIds: [card.id],
        declaredColor,
        reasons: ["respond-with-penalty-draw"]
      };
    });

  candidates.push({
    command: {
      type: "resolve-draw-until-color",
      playerId
    },
    cardIds: [],
    reasons: ["resolve-draw-until-color"]
  });

  return candidates;
}

function generateSingleCardCandidates(
  state: GameState,
  playerId: PlayerId,
  hand: readonly Card[]
): BotCandidateAction[] {
  return hand
    .filter((card) => {
      return canPlayCard({
        card,
        topCard: state.topCard,
        currentColor: state.currentColor
      });
    })
    .map((card) => {
      const declaredColor = getDeclaredColor(state, hand, [card.id], card);

      return {
        command: {
          type: "play-card",
          playerId,
          cardId: card.id,
          ...(declaredColor === undefined ? {} : { declaredColor })
        },
        cardIds: [card.id],
        declaredColor,
        reasons: ["single-card"]
      };
    });
}

function generateMultipleNumberCandidates(
  state: GameState,
  playerId: PlayerId,
  hand: readonly Card[]
): BotCandidateAction[] {
  const groups = new Map<string, Card[]>();

  for (const card of hand) {
    if (!isNumberCard(card)) {
      continue;
    }

    const key = `${card.color}:${String(card.number)}`;
    groups.set(key, [...(groups.get(key) ?? []), card]);
  }

  const candidates: BotCandidateAction[] = [];

  for (const cards of groups.values()) {
    if (cards.length < 2 || !validateMultipleNumberPlay(cards).valid) {
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

    candidates.push({
      command: {
        type: "play-multiple-number",
        playerId,
        cardIds: cards.map((card) => card.id)
      },
      cardIds: cards.map((card) => card.id),
      reasons: ["multiple-number"]
    });
  }

  return candidates;
}

function generateSequenceCandidates(
  state: GameState,
  playerId: PlayerId,
  hand: readonly Card[]
): BotCandidateAction[] {
  const numberCards = hand.filter(isNumberCard);
  const byNumber = new Map<number, Card[]>();

  for (const card of numberCards) {
    byNumber.set(card.number, [...(byNumber.get(card.number) ?? []), card]);
  }

  const sortedNumbers = [...byNumber.keys()].sort((left, right) => left - right);
  const candidates: BotCandidateAction[] = [];
  let run: number[] = [];

  for (const number of sortedNumbers) {
    const previous = run[run.length - 1];
    if (previous === undefined || number === previous + 1) {
      run.push(number);
    } else {
      appendSequenceRunCandidates(state, playerId, byNumber, run, candidates);
      run = [number];
    }
  }

  appendSequenceRunCandidates(state, playerId, byNumber, run, candidates);
  return candidates;
}

function appendSequenceRunCandidates(
  state: GameState,
  playerId: PlayerId,
  byNumber: ReadonlyMap<number, Card[]>,
  run: readonly number[],
  candidates: BotCandidateAction[]
): void {
  if (run.length < 5) {
    return;
  }

  const cards = run.map((number) => chooseSequenceCard(byNumber.get(number) ?? [], state.currentColor));

  if (cards.some((card) => card === null)) {
    return;
  }

  const sequenceCards = cards.filter((card): card is Card => card !== null);
  const validation = validateSequencePlay(sequenceCards);

  if (!validation.valid || validation.minCard === undefined) {
    return;
  }

  if (
    !canPlayCard({
      card: validation.minCard,
      topCard: state.topCard,
      currentColor: state.currentColor
    })
  ) {
    return;
  }

  candidates.push({
    command: {
      type: "play-sequence",
      playerId,
      cardIds: sequenceCards.map((card) => card.id)
    },
    cardIds: sequenceCards.map((card) => card.id),
    reasons: ["sequence"]
  });
}

function chooseSequenceCard(cards: readonly Card[], currentColor: CardColor): Card | null {
  return cards.find((card) => card.color === currentColor) ?? cards[0] ?? null;
}

function generateDiscardSameColorCandidates(
  state: GameState,
  playerId: PlayerId,
  hand: readonly Card[]
): BotCandidateAction[] {
  const candidates: BotCandidateAction[] = [];

  for (const mainCard of hand) {
    if (
      !isDiscardSameColorCard(mainCard) ||
      !canPlayCard({
        card: mainCard,
        topCard: state.topCard,
        currentColor: state.currentColor
      })
    ) {
      continue;
    }

    const attachedCards = hand.filter((card) => {
      return card.id !== mainCard.id && !isBlackCard(card) && card.color === mainCard.color;
    });
    const validation = validateDiscardSameColorPlay(mainCard, attachedCards);

    if (!validation.valid) {
      continue;
    }

    candidates.push({
      command: {
        type: "play-discard-same-color",
        playerId,
        mainCardId: mainCard.id,
        attachedCardIds: attachedCards.map((card) => card.id)
      },
      cardIds: [mainCard.id, ...attachedCards.map((card) => card.id)],
      reasons: ["discard-same-color"]
    });
  }

  return candidates;
}

function getDeclaredColorPayload(
  state: GameState,
  hand: readonly Card[],
  excludedCardIds: readonly string[],
  card: Card
): { declaredColor?: CardColor } {
  const declaredColor = getDeclaredColor(state, hand, excludedCardIds, card);

  return declaredColor === undefined ? {} : { declaredColor };
}

function getDeclaredColor(
  state: GameState,
  hand: readonly Card[],
  excludedCardIds: readonly string[],
  card: Card
): CardColor | undefined {
  if (!card.isBlack) {
    return undefined;
  }

  const excluded = new Set(excludedCardIds);
  const remainingHand = hand.filter((candidate) => !excluded.has(candidate.id));

  return chooseBestColor(remainingHand, state.currentColor);
}

function chooseBestColor(hand: readonly Card[], currentColor: CardColor): CardColor {
  let bestColor: CardColor = currentColor;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const color of CARD_COLORS) {
    const score = hand.reduce((sum, card) => {
      if (card.color !== color) {
        return sum;
      }

      return sum + (isNumberCard(card) ? 40 : isDrawCard(card) ? 70 : 55);
    }, color === currentColor ? 20 : 0);

    if (score > bestScore) {
      bestColor = color;
      bestScore = score;
    }
  }

  return bestColor;
}
