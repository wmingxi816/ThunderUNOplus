import type { Card, CardColor, GameCommand, GameState, PlayerId } from "@thunder-uno/shared-types";
import { applyCommand, isDrawCard, isNumberCard } from "@thunder-uno/uno-core";
import type { BotCandidateAction } from "./botCandidates";

export interface ScoredBotAction extends BotCandidateAction {
  score: number;
  resultingState: GameState;
}

export function scoreBotCandidates(
  state: GameState,
  playerId: PlayerId,
  candidates: readonly BotCandidateAction[],
  random: () => number
): ScoredBotAction[] {
  return candidates
    .map((candidate) => scoreCandidate(state, playerId, candidate, random))
    .filter((candidate): candidate is ScoredBotAction => candidate !== null)
    .sort((left, right) => right.score - left.score);
}

function scoreCandidate(
  state: GameState,
  playerId: PlayerId,
  candidate: BotCandidateAction,
  random: () => number
): ScoredBotAction | null {
  const command = candidate.command;
  const result = applyCommand(cloneGameState(state), command);

  if (result.events.some((event) => event.type === "command-rejected")) {
    return null;
  }

  const beforePlayer = state.players.find((player) => player.id === playerId);
  const afterPlayer = result.state.players.find((player) => player.id === playerId);

  if (beforePlayer === undefined || afterPlayer === undefined) {
    return null;
  }

  let score = candidate.cardIds.length * 100;
  const remainingCount = afterPlayer.handCount;

  if (remainingCount === 0) {
    score += 10_000;
  } else if (remainingCount === 1) {
    score += 1_200;
  } else if (remainingCount === 2) {
    score += 350;
  }

  if (beforePlayer.handCount >= 15 && candidate.cardIds.length >= 2) {
    score += 120;
  } else if (beforePlayer.handCount >= 10 && candidate.cardIds.length >= 2) {
    score += 70;
  }

  score += scorePressure(state, command);
  score += scoreDrawStack(state, command);
  score += scoreDeclaredColor(state, playerId, candidate.declaredColor);
  score += scoreReserveCost(state, beforePlayer.hand, command);
  score += scoreSwapHandsOpportunity(beforePlayer.hand, command);
  score += scoreDiscardSameColor(beforePlayer.handCount, command, candidate.cardIds.length);
  score += scoreSingleNumberStructure(beforePlayer.hand, command);
  score += random() * 8;

  if (command.type === "draw-card") {
    score -= 80;
  }

  if (command.type === "keep-drawn-card") {
    score += 10;
  }

  return {
    ...candidate,
    score,
    resultingState: result.state
  };
}

function scorePressure(state: GameState, command: GameCommand): number {
  if (
    command.type !== "play-card" &&
    command.type !== "play-discard-same-color" &&
    command.type !== "play-multiple-number" &&
    command.type !== "play-sequence"
  ) {
    return 0;
  }

  const nextPlayer = getNextActivePlayer(state, command.playerId);
  const topCard = getCommandTopCard(state, command);

  if (nextPlayer === null || topCard === null) {
    return 0;
  }

  const dangerBonus =
    nextPlayer.handCount === 1
      ? 500
      : nextPlayer.handCount === 2
        ? 300
        : nextPlayer.handCount <= 4
          ? 150
          : 0;

  if (dangerBonus === 0) {
    return scoreDrawCardPressure(topCard);
  }

  if (
    topCard.kind === "skip" ||
    topCard.kind === "reverse" ||
    topCard.kind === "penalty-draw" ||
    isDrawCard(topCard)
  ) {
    return dangerBonus + scoreDrawCardPressure(topCard);
  }

  return scoreDrawCardPressure(topCard);
}

function scoreDrawCardPressure(card: Card): number {
  switch (card.kind) {
    case "draw-two":
      return 120;
    case "draw-four":
      return 180;
    case "wild-reverse-draw-four":
      return 260;
    case "wild-draw-six":
      return 420;
    case "wild-draw-ten":
      return 700;
    case "penalty-draw":
      return 280;
    default:
      return 0;
  }
}

function scoreDrawStack(state: GameState, command: GameCommand): number {
  if (!state.drawStack.active) {
    return 0;
  }

  if (command.type === "resolve-draw-stack") {
    return -state.drawStack.amount * 55;
  }

  if (command.type === "play-card") {
    return state.drawStack.amount * 55;
  }

  return 0;
}

function scoreDeclaredColor(
  state: GameState,
  playerId: PlayerId,
  declaredColor: CardColor | undefined
): number {
  if (declaredColor === undefined) {
    return 0;
  }

  const player = state.players.find((candidate) => candidate.id === playerId);

  if (player === undefined) {
    return 0;
  }

  return player.hand.reduce((sum, card) => {
    if (card.color !== declaredColor) {
      return sum;
    }

    return sum + (card.kind === "number" ? 40 : isDrawCard(card) ? 70 : 55);
  }, declaredColor === state.currentColor ? 20 : 0);
}

function scoreReserveCost(
  state: GameState,
  hand: readonly Card[],
  command: GameCommand
): number {
  if (command.type !== "play-card") {
    return 0;
  }

  const card = hand.find((candidate) => candidate.id === command.cardId);

  if (card === undefined) {
    return 0;
  }

  const hasCurrentColorAlternative = hand.some((candidate) => {
    return candidate.id !== card.id && candidate.color === state.currentColor;
  });
  const nextPlayer = getNextActivePlayer(state, command.playerId);
  const nextPlayerDanger = nextPlayer !== null && nextPlayer.handCount <= 2;
  const emergency =
    !hasCurrentColorAlternative ||
    nextPlayerDanger ||
    state.drawStack.active ||
    state.drawUntilColor.active ||
    hand.length >= 15;

  if (emergency) {
    return 0;
  }

  switch (card.kind) {
    case "wild-draw-ten":
      return -360;
    case "wild-draw-six":
      return -220;
    case "wild-reverse-draw-four":
      return -80;
    case "penalty-draw":
      return -50;
    default:
      return 0;
  }
}

function scoreSwapHandsOpportunity(
  hand: readonly Card[],
  command: GameCommand
): number {
  if (command.type !== "play-card") {
    return 0;
  }

  const card = hand.find((candidate) => candidate.id === command.cardId);

  if (card?.kind !== "swap-hands") {
    return 0;
  }

  const profile = evaluateHandExchangeProfile(hand);

  if (hand.length > 15) {
    return calculateSwapHandsDynamicScore(hand.length, profile, 1_500, 3_000);
  }

  if (
    hand.length >= 7 &&
    profile.lowValueRatio >= 0.7 &&
    profile.averageValue <= 3
  ) {
    return calculateSwapHandsDynamicScore(hand.length, profile, 1_600, 3_000);
  }

  return 0;
}

function calculateSwapHandsDynamicScore(
  handCount: number,
  profile: {
    averageValue: number;
    lowValueRatio: number;
  },
  minScore: number,
  maxScore: number
): number {
  const countPressure = clamp((handCount - 7) / 18, 0, 1);
  const lowValuePressure = clamp((profile.lowValueRatio - 0.45) / 0.55, 0, 1);
  const weakHandPressure = clamp((7 - profile.averageValue) / 6, 0, 1);
  const qualityPressure = lowValuePressure * 0.6 + weakHandPressure * 0.4;
  const totalPressure = countPressure * 0.35 + qualityPressure * 0.65;

  return Math.round(minScore + (maxScore - minScore) * totalPressure);
}

function evaluateHandExchangeProfile(hand: readonly Card[]): {
  averageValue: number;
  lowValueRatio: number;
} {
  if (hand.length === 0) {
    return {
      averageValue: 0,
      lowValueRatio: 0
    };
  }

  let totalValue = 0;
  let lowValueCount = 0;

  for (const card of hand) {
    const value = getHandExchangeCardValue(card);
    totalValue += value;

    if (value <= 2) {
      lowValueCount += 1;
    }
  }

  return {
    averageValue: totalValue / hand.length,
    lowValueRatio: lowValueCount / hand.length
  };
}

function getHandExchangeCardValue(card: Card): number {
  switch (card.kind) {
    case "number":
      return 1;
    case "skip":
    case "reverse":
    case "discard-same-color":
    case "swap-hands":
      return 2;
    case "draw-two":
      return 4;
    case "draw-four":
      return 5;
    case "wild":
    case "penalty-draw":
      return 7;
    case "wild-reverse-draw-four":
      return 8;
    case "wild-draw-six":
      return 9;
    case "wild-draw-ten":
      return 10;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function scoreDiscardSameColor(
  handCount: number,
  command: GameCommand,
  playedCount: number
): number {
  if (command.type !== "play-discard-same-color") {
    return 0;
  }

  if (handCount >= 10) {
    return 160 + playedCount * 20;
  }

  if (handCount >= 7 && playedCount >= 3) {
    return 220;
  }

  if (handCount <= 3 && playedCount <= 2) {
    return -260;
  }

  if (handCount <= 4) {
    return -180;
  }

  return 0;
}

function scoreSingleNumberStructure(
  hand: readonly Card[],
  command: GameCommand
): number {
  if (command.type !== "play-card") {
    return 0;
  }

  const card = hand.find((candidate) => candidate.id === command.cardId);

  if (card === undefined || !isNumberCard(card)) {
    return 0;
  }

  const numberCards = hand.filter(isNumberCard);

  if (numberCards.length <= 1) {
    return 0;
  }

  const average =
    numberCards.reduce((sum, candidate) => sum + candidate.number, 0) /
    numberCards.length;
  const distanceFromAverage = Math.abs(card.number - average);
  const belongsToPair = numberCards.some((candidate) => {
    return (
      candidate.id !== card.id &&
      candidate.color === card.color &&
      candidate.number === card.number
    );
  });
  const belongsToSequence = isNumberPartOfSequenceRun(card.number, numberCards);

  if (!belongsToPair && !belongsToSequence) {
    return 160 + distanceFromAverage * 28;
  }

  let score = 0;

  if (belongsToPair) {
    score -= 70;
  }

  if (belongsToSequence) {
    score -= 90;
  }

  return score + distanceFromAverage * 6;
}

function isNumberPartOfSequenceRun(
  number: number,
  numberCards: readonly Card[]
): boolean {
  const uniqueNumbers = [
    ...new Set(numberCards.filter(isNumberCard).map((card) => card.number))
  ].sort((left, right) => left - right);
  let run: number[] = [];

  for (const currentNumber of uniqueNumbers) {
    const previousNumber = run[run.length - 1];

    if (previousNumber === undefined || currentNumber === previousNumber + 1) {
      run.push(currentNumber);
    } else {
      if (run.length >= 5 && run.includes(number)) {
        return true;
      }

      run = [currentNumber];
    }
  }

  return run.length >= 5 && run.includes(number);
}

function getCommandTopCard(state: GameState, command: GameCommand): Card | null {
  const player = state.players.find((candidate) => candidate.id === command.playerId);

  if (player === undefined) {
    return null;
  }

  switch (command.type) {
    case "play-card":
      return player.hand.find((card) => card.id === command.cardId) ?? null;
    case "play-discard-same-color":
      return player.hand.find((card) => card.id === command.mainCardId) ?? null;
    case "play-multiple-number":
    case "play-sequence":
      return player.hand.find((card) => card.id === command.cardIds[0]) ?? null;
    default:
      return null;
  }
}

function getNextActivePlayer(state: GameState, playerId: PlayerId) {
  const startIndex = state.playerOrder.indexOf(playerId);

  if (startIndex < 0) {
    return null;
  }

  const delta = state.direction === "clockwise" ? 1 : -1;
  let cursor = startIndex;

  for (let index = 0; index < state.playerOrder.length; index += 1) {
    cursor = (cursor + delta + state.playerOrder.length) % state.playerOrder.length;
    const nextPlayerId = state.playerOrder[cursor];
    const player = state.players.find((candidate) => candidate.id === nextPlayerId);

    if (
      player !== undefined &&
      !player.isEliminated &&
      !player.isRoundWinner &&
      !player.hasLeftRoom
    ) {
      return player;
    }
  }

  return null;
}

function cloneGameState(state: GameState): GameState {
  return JSON.parse(JSON.stringify(state)) as GameState;
}
