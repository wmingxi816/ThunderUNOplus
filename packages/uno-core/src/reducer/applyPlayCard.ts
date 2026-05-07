import type { Card, CardColor, DrawCardKind } from "../card";
import type { GamePlayerState, GameState } from "../gameState";
import { canPlayCard } from "../rules/canPlayCard";
import { canStackDrawCard } from "../rules/canStackDrawCard";
import {
  validateDiscardSameColorPlay
} from "../rules/discardSameColor";
import { validateMultipleNumberPlay } from "../rules/multiple";
import { validateSequencePlay } from "../rules/sequence";
import { isDrawCard } from "../rules/cardGuards";
import {
  cardRequiresDeclaredColor,
  clearNormalDrawOffer,
  cloneGameState,
  findCardsInHand,
  findPlayer,
  finishGame,
  markPlayerEliminatedIfNeeded,
  removeCardsFromHand,
  startUnoProtectionWindows,
  syncPlayerHandState
} from "./effects";
import { ERROR_CODES, rejectCommand } from "./errors";
import { getNextActivePlayerId, toggleDirection } from "./turn";
import type {
  ApplyCommandResult,
  GameEvent,
  PlayCardCommand,
  PlayDiscardSameColorCommand,
  PlayMultipleNumberCommand,
  PlaySequenceCommand
} from "./types";

export function applyPlayCardCommand(
  state: GameState,
  command: PlayCardCommand
): ApplyCommandResult {
  const player = assertPlayableCurrentPlayer(state, command);

  if (player instanceof Error) {
    return rejectCommand(
      state,
      command,
      player.message as typeof ERROR_CODES.playerNotFound,
      player.cause as string
    );
  }

  const card = player.hand.find((candidate) => candidate.id === command.cardId);

  if (card === undefined) {
    return rejectCommand(
      state,
      command,
      ERROR_CODES.cardNotFound,
      "Player does not hold the requested card."
    );
  }

  if (
    state.normalDrawOffer.active &&
    (state.normalDrawOffer.playerId !== command.playerId ||
      state.normalDrawOffer.cardId !== command.cardId)
  ) {
    return rejectCommand(
      state,
      command,
      ERROR_CODES.normalDrawDecisionRequired,
      "Only the just-drawn card can be played before choosing to keep it."
    );
  }

  if (state.drawUntilColor.active) {
    if (
      state.drawUntilColor.targetPlayerId !== command.playerId ||
      card.kind !== "penalty-draw"
    ) {
      return rejectCommand(
        state,
        command,
        ERROR_CODES.drawUntilColorActive,
        "Only penalty-draw can respond to an active draw-until-color pressure."
      );
    }
  } else if (state.drawStack.active) {
    const previousDrawValue = state.drawStack.previousDrawValue;
    const previousDrawKind = state.drawStack.previousDrawKind;

    if (
      previousDrawValue === null ||
      previousDrawKind === null ||
      !canStackDrawCard({
        nextCard: card,
        currentColor: state.currentColor,
        previousDrawValue,
        previousDrawKind
      })
    ) {
      return rejectCommand(
        state,
        command,
        ERROR_CODES.cardNotPlayable,
        "Card cannot continue the current draw stack."
      );
    }
  } else if (
    !canPlayCard({
      card,
      topCard: state.topCard,
      currentColor: state.currentColor
    })
  ) {
    return rejectCommand(
      state,
      command,
      ERROR_CODES.cardNotPlayable,
      "Card cannot be played on the current top card or active color."
    );
  }

  if (cardRequiresDeclaredColor(card) && command.declaredColor === undefined) {
    return rejectCommand(
      state,
      command,
      ERROR_CODES.declaredColorRequired,
      "Black cards require a declared color."
    );
  }

  return playResolvedCards({
    state,
    playerId: command.playerId,
    cardsToRemoveIds: [card.id],
    discardCards: [card],
    topCard: card,
    declaredColor: command.declaredColor,
    command,
    effectMode: "resolve-top-card"
  });
}

export function applyPlaySequenceCommand(
  state: GameState,
  command: PlaySequenceCommand
): ApplyCommandResult {
  const player = assertPlayableCurrentPlayer(state, command);

  if (player instanceof Error) {
    return rejectCommand(
      state,
      command,
      player.message as typeof ERROR_CODES.playerNotFound,
      player.cause as string
    );
  }

  if (state.normalDrawOffer.active) {
    return rejectCommand(
      state,
      command,
      ERROR_CODES.normalDrawDecisionRequired,
      "Choose whether to play or keep the drawn card before playing a combination."
    );
  }

  if (state.drawStack.active) {
    return rejectCommand(
      state,
      command,
      ERROR_CODES.drawStackActive,
      "Sequence play cannot respond to an active draw stack."
    );
  }

  if (state.drawUntilColor.active) {
    return rejectCommand(
      state,
      command,
      ERROR_CODES.drawUntilColorActive,
      "Sequence play cannot respond to an active draw-until-color pressure."
    );
  }

  const cards = findCardsInHand(player, command.cardIds);

  if (cards === null) {
    return rejectCommand(
      state,
      command,
      ERROR_CODES.cardNotFound,
      "Player does not hold all cards in the requested sequence."
    );
  }

  const validation = validateSequencePlay(cards);

  if (!validation.valid || validation.minCard === undefined || validation.maxCard === undefined) {
    return rejectCommand(
      state,
      command,
      ERROR_CODES.invalidCombination,
      validation.reason ?? "Sequence play is invalid."
    );
  }

  if (
    !canPlayCard({
      card: validation.minCard,
      topCard: state.topCard,
      currentColor: state.currentColor
    })
  ) {
    return rejectCommand(
      state,
      command,
      ERROR_CODES.cardNotPlayable,
      "The minimum card in the sequence cannot connect to the current top card."
    );
  }

  const discardCards = [...cards].sort((left, right) => left.number! - right.number!);

  return playResolvedCards({
    state,
    playerId: command.playerId,
    cardsToRemoveIds: command.cardIds,
    discardCards,
    topCard: validation.maxCard,
    command,
    effectMode: "advance-only"
  });
}

export function applyPlayMultipleNumberCommand(
  state: GameState,
  command: PlayMultipleNumberCommand
): ApplyCommandResult {
  const player = assertPlayableCurrentPlayer(state, command);

  if (player instanceof Error) {
    return rejectCommand(
      state,
      command,
      player.message as typeof ERROR_CODES.playerNotFound,
      player.cause as string
    );
  }

  if (state.normalDrawOffer.active) {
    return rejectCommand(
      state,
      command,
      ERROR_CODES.normalDrawDecisionRequired,
      "Choose whether to play or keep the drawn card before playing a combination."
    );
  }

  if (state.drawStack.active) {
    return rejectCommand(
      state,
      command,
      ERROR_CODES.drawStackActive,
      "Multiple-number play cannot respond to an active draw stack."
    );
  }

  if (state.drawUntilColor.active) {
    return rejectCommand(
      state,
      command,
      ERROR_CODES.drawUntilColorActive,
      "Multiple-number play cannot respond to an active draw-until-color pressure."
    );
  }

  const cards = findCardsInHand(player, command.cardIds);

  if (cards === null) {
    return rejectCommand(
      state,
      command,
      ERROR_CODES.cardNotFound,
      "Player does not hold all cards in the requested multiple-number play."
    );
  }

  const validation = validateMultipleNumberPlay(cards);

  if (!validation.valid) {
    return rejectCommand(
      state,
      command,
      ERROR_CODES.invalidCombination,
      validation.reason ?? "Multiple-number play is invalid."
    );
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
    return rejectCommand(
      state,
      command,
      ERROR_CODES.cardNotPlayable,
      "The multiple-number play cannot connect to the current top card."
    );
  }

  return playResolvedCards({
    state,
    playerId: command.playerId,
    cardsToRemoveIds: command.cardIds,
    discardCards: cards,
    topCard: referenceCard,
    command,
    effectMode: "advance-only"
  });
}

export function applyPlayDiscardSameColorCommand(
  state: GameState,
  command: PlayDiscardSameColorCommand
): ApplyCommandResult {
  const player = assertPlayableCurrentPlayer(state, command);

  if (player instanceof Error) {
    return rejectCommand(
      state,
      command,
      player.message as typeof ERROR_CODES.playerNotFound,
      player.cause as string
    );
  }

  if (state.normalDrawOffer.active) {
    return rejectCommand(
      state,
      command,
      ERROR_CODES.normalDrawDecisionRequired,
      "Choose whether to play or keep the drawn card before playing a combination."
    );
  }

  if (state.drawStack.active) {
    return rejectCommand(
      state,
      command,
      ERROR_CODES.drawStackActive,
      "Discard-same-color cannot respond to an active draw stack."
    );
  }

  if (state.drawUntilColor.active) {
    return rejectCommand(
      state,
      command,
      ERROR_CODES.drawUntilColorActive,
      "Discard-same-color cannot respond to an active draw-until-color pressure."
    );
  }

  const mainCard = player.hand.find((card) => card.id === command.mainCardId);

  if (mainCard === undefined) {
    return rejectCommand(
      state,
      command,
      ERROR_CODES.cardNotFound,
      "Player does not hold the discard-same-color main card."
    );
  }

  const attachedCards = findCardsInHand(player, command.attachedCardIds);

  if (attachedCards === null) {
    return rejectCommand(
      state,
      command,
      ERROR_CODES.cardNotFound,
      "Player does not hold all attached cards."
    );
  }

  const validation = validateDiscardSameColorPlay(mainCard, attachedCards);

  if (!validation.valid) {
    return rejectCommand(
      state,
      command,
      ERROR_CODES.invalidCombination,
      validation.reason ?? "Discard-same-color play is invalid."
    );
  }

  if (
    !canPlayCard({
      card: mainCard,
      topCard: state.topCard,
      currentColor: state.currentColor
    })
  ) {
    return rejectCommand(
      state,
      command,
      ERROR_CODES.cardNotPlayable,
      "Discard-same-color main card cannot connect to the current top card."
    );
  }

  return playResolvedCards({
    state,
    playerId: command.playerId,
    cardsToRemoveIds: [command.mainCardId, ...command.attachedCardIds],
    discardCards: [...attachedCards, mainCard],
    topCard: mainCard,
    command,
    effectMode: "advance-only"
  });
}

type PlayResolutionMode = "resolve-top-card" | "advance-only";

interface PlayResolvedCardsParams {
  state: GameState;
  playerId: string;
  cardsToRemoveIds: string[];
  discardCards: Card[];
  topCard: Card;
  declaredColor?: CardColor | undefined;
  command:
    | PlayCardCommand
    | PlaySequenceCommand
    | PlayMultipleNumberCommand
    | PlayDiscardSameColorCommand;
  effectMode: PlayResolutionMode;
}

function playResolvedCards({
  state,
  playerId,
  cardsToRemoveIds,
  discardCards,
  topCard,
  declaredColor,
  command,
  effectMode
}: PlayResolvedCardsParams): ApplyCommandResult {
  const nextState = cloneGameState(state);
  const now = command.timestampMs ?? state.now;
  const events: GameEvent[] = [];
  const player = findPlayer(nextState, playerId);

  if (player === undefined) {
    return rejectCommand(
      state,
      command,
      ERROR_CODES.playerNotFound,
      "Player was not found."
    );
  }

  nextState.now = now;
  if (
    nextState.normalDrawOffer.active &&
    nextState.normalDrawOffer.playerId === playerId &&
    cardsToRemoveIds.includes(nextState.normalDrawOffer.cardId ?? "")
  ) {
    clearNormalDrawOffer(nextState);
  }

  const previousHandCount = player.handCount;
  removeCardsFromHand(player, cardsToRemoveIds);
  syncPlayerHandState(player, previousHandCount, now, events);

  nextState.topCard = topCard;
  nextState.currentColor = declaredColor ?? topCard.color ?? nextState.currentColor;
  nextState.discardPile.push(...discardCards);

  events.push({
    type: "cards-played",
    playerId,
    cardIds: [...cardsToRemoveIds],
    topCardId: topCard.id,
    ...(declaredColor === undefined ? {} : { declaredColor })
  });

  if (player.handCount === 0) {
    finishGame(nextState, [player.id], events);
    return {
      state: nextState,
      events
    };
  }

  if (effectMode === "advance-only" || !isDrawCard(topCard) && topCard.kind === "number") {
    resolveAdvanceOnly(nextState, playerId, events);

    return {
      state: nextState,
      events
    };
  }

  resolveTopCardEffect(nextState, playerId, topCard, declaredColor, events);

  return {
    state: nextState,
    events
  };
}

function resolveTopCardEffect(
  state: GameState,
  playerId: string,
  card: Card,
  declaredColor: CardColor | undefined,
  events: GameEvent[]
): void {
  switch (card.kind) {
    case "number":
    case "discard-same-color":
      resolveAdvanceOnly(state, playerId, events);
      return;
    case "skip":
      resolveAdvance(state, playerId, 2, events);
      return;
    case "reverse":
      state.direction = toggleDirection(state.direction);
      resolveAdvance(state, playerId, 1, events);
      return;
    case "swap-hands":
      rotateHandsByDirection(state, events);
      if (state.status !== "finished") {
        resolveAdvance(state, playerId, 1, events);
      }
      return;
    case "wild":
      if (declaredColor === undefined) {
        throw new Error("Wild card must already have a declared color.");
      }
      resolveAdvance(state, playerId, 1, events);
      return;
    case "penalty-draw":
      if (declaredColor === undefined) {
        throw new Error("Penalty-draw must already have a declared color.");
      }
      resolvePenaltyDraw(state, playerId, declaredColor, events);
      return;
    case "draw-two":
    case "draw-four":
    case "wild-reverse-draw-four":
    case "wild-draw-six":
    case "wild-draw-ten":
      if (!isDrawCard(card)) {
        throw new Error("Draw card effect expected a draw card.");
      }
      resolveDrawCardEffect(state, playerId, card, events);
      return;
    default: {
      const exhaustiveCheck: never = card.kind;
      throw new Error(`Unsupported card kind: ${String(exhaustiveCheck)}`);
    }
  }
}

function resolveAdvanceOnly(
  state: GameState,
  playerId: string,
  events: GameEvent[]
): void {
  resolveAdvance(state, playerId, 1, events);
}

function resolveAdvance(
  state: GameState,
  playerId: string,
  steps: number,
  events: GameEvent[]
): void {
  const nextPlayerId = getNextActivePlayerId(state, playerId, steps);

  if (nextPlayerId === null) {
    return;
  }

  state.currentPlayerId = nextPlayerId;
  startUnoProtectionWindows(state, state.now);
  events.push({
    type: "turn-advanced",
    previousPlayerId: playerId,
    currentPlayerId: nextPlayerId
  });
}

function resolveDrawCardEffect(
  state: GameState,
  playerId: string,
  card: Card & { kind: DrawCardKind },
  events: GameEvent[]
): void {
  if (card.kind === "wild-reverse-draw-four") {
    state.direction = toggleDirection(state.direction);
  }

  const targetPlayerId = getNextActivePlayerId(state, playerId, 1);

  if (targetPlayerId === null) {
    return;
  }

  const drawValue = card.drawValue;

  if (drawValue === undefined) {
    throw new Error("Draw card effect expected a drawValue.");
  }

  const baseAmount = state.drawStack.active ? state.drawStack.amount : 0;
  const nextAmount = baseAmount + drawValue;

  state.drawStack = {
    active: true,
    amount: nextAmount,
    previousDrawValue: drawValue,
    previousDrawKind: card.kind,
    targetPlayerId
  };
  state.currentPlayerId = targetPlayerId;
  startUnoProtectionWindows(state, state.now);

  events.push({
    type: "draw-stack-updated",
    amount: nextAmount,
    targetPlayerId
  });
  events.push({
    type: "turn-advanced",
    previousPlayerId: playerId,
    currentPlayerId: targetPlayerId
  });
}

function resolvePenaltyDraw(
  state: GameState,
  playerId: string,
  declaredColor: CardColor,
  events: GameEvent[]
): void {
  const targetPlayerId = getNextActivePlayerId(state, playerId, 1);

  if (targetPlayerId === null) {
    return;
  }

  state.drawUntilColor = {
    active: true,
    color: declaredColor,
    targetPlayerId
  };
  state.currentPlayerId = targetPlayerId;
  startUnoProtectionWindows(state, state.now);

  events.push({
    type: "draw-until-color-started",
    targetPlayerId,
    color: declaredColor
  });
  events.push({
    type: "turn-advanced",
    previousPlayerId: playerId,
    currentPlayerId: targetPlayerId
  });
}

function rotateHandsByDirection(state: GameState, events: GameEvent[]): void {
  const activePlayers = state.players.filter(
    (player) => !player.isEliminated && !player.isRoundWinner
  );

  if (activePlayers.length <= 1) {
    return;
  }

  const orderedPlayers = state.playerOrder
    .map((playerId) => state.players.find((player) => player.id === playerId))
    .filter((player): player is NonNullable<typeof player> => player !== undefined)
    .filter((player) => !player.isEliminated && !player.isRoundWinner);

  const originalHands = new Map<string, Card[]>();

  for (const player of orderedPlayers) {
    originalHands.set(player.id, [...player.hand]);
  }

  for (let index = 0; index < orderedPlayers.length; index += 1) {
    const receiver = orderedPlayers[index];

    if (receiver === undefined) {
      continue;
    }

    const sourceIndex =
      state.direction === "clockwise"
        ? (index - 1 + orderedPlayers.length) % orderedPlayers.length
        : (index + 1) % orderedPlayers.length;
    const sourcePlayer = orderedPlayers[sourceIndex];

    if (sourcePlayer === undefined) {
      continue;
    }

    const previousHandCount = receiver.handCount;
    receiver.hand = [...(originalHands.get(sourcePlayer.id) ?? [])];
    syncPlayerHandState(receiver, previousHandCount, state.now, events);
    markPlayerEliminatedIfNeeded(state, receiver, events);

    if (state.status === "finished") {
      return;
    }
  }
}

function assertPlayableCurrentPlayer(
  state: GameState,
  command:
    | PlayCardCommand
    | PlaySequenceCommand
    | PlayMultipleNumberCommand
    | PlayDiscardSameColorCommand
): GamePlayerState | Error {
  if (state.status === "finished") {
    return new Error(ERROR_CODES.gameFinished, {
      cause: "Cannot play cards after the game has finished."
    });
  }

  const player = findPlayer(state, command.playerId);

  if (player === undefined) {
    return new Error(ERROR_CODES.playerNotFound, {
      cause: "Player was not found."
    });
  }

  if (player.isEliminated) {
    return new Error(ERROR_CODES.playerEliminated, {
      cause: "Eliminated players cannot perform turn actions."
    });
  }

  if (player.isRoundWinner) {
    return new Error(ERROR_CODES.playerEliminated, {
      cause: "Round winners cannot perform further turn actions."
    });
  }

  if (state.currentPlayerId !== command.playerId) {
    return new Error(ERROR_CODES.notCurrentPlayer, {
      cause: "Only the current player can perform this action."
    });
  }

  return player;
}
