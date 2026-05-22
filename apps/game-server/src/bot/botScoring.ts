import type { Card, CardColor, GameCommand, GameState, PlayerId } from "@thunder-uno/shared-types";
import { applyCommand, canPlayCard, isDrawCard, isNumberCard } from "@thunder-uno/uno-core";
import type { BotCandidateAction } from "./botCandidates";

export interface ScoredBotAction extends BotCandidateAction {
  score: number;
  resultingState: GameState;
}

export interface BotScoringWeights {
  cardReduction: number;
  winBonus: number;
  unoBonus: number;
  twoCardsLeftBonus: number;
  largeHandComboBonus: number;
  mediumHandComboBonus: number;
  drawCommandPenalty: number;
  keepDrawnCardBonus: number;
  randomJitter: number;
  nextPlayerOneCardDangerBonus: number;
  nextPlayerTwoCardsDangerBonus: number;
  nextPlayerFourCardsDangerBonus: number;
  nonPressureDangerPenaltyRatio: number;
  drawTwoPressure: number;
  drawFourPressure: number;
  wildReverseDrawFourPressure: number;
  wildDrawSixPressure: number;
  wildDrawTenPressure: number;
  penaltyDrawPressure: number;
  drawStackAvoidedDrawMultiplier: number;
  colorNumberCardValue: number;
  colorDrawCardValue: number;
  colorActionCardValue: number;
  currentColorBonus: number;
  reserveWildDrawTenCost: number;
  reserveWildDrawSixCost: number;
  reserveWildReverseDrawFourCost: number;
  reservePenaltyDrawCost: number;
  swapHugeWeakHandMin: number;
  swapHugeWeakHandMax: number;
  swapMediumWeakHandMin: number;
  swapMediumWeakHandMax: number;
  swapCountPressureWeight: number;
  swapQualityPressureWeight: number;
  swapLowValuePressureWeight: number;
  swapWeakHandPressureWeight: number;
  swapTinyHandLargeSourcePenalty: number;
  swapSourceCriticalBonus: number;
  swapSourceGapBonusPerCard: number;
  swapLargeIncomingPenaltyPerCard: number;
  swapStrongPowerPenaltyPerPoint: number;
  swapNonCriticalSourceScoreMax: number;
  discardLargeHandBonus: number;
  discardLargeHandPerCardBonus: number;
  discardMediumHandBonus: number;
  discardTinyHandPenalty: number;
  discardSmallHandPenalty: number;
  isolatedNumberBaseBonus: number;
  isolatedNumberDistanceBonus: number;
  pairStructurePenalty: number;
  sequenceStructurePenalty: number;
  structuredNumberDistanceBonus: number;
}

export const DEFAULT_BOT_SCORING_WEIGHTS: BotScoringWeights = {
  cardReduction: 100,
  winBonus: 10_000,
  unoBonus: 1_200,
  twoCardsLeftBonus: 350,
  largeHandComboBonus: 120,
  mediumHandComboBonus: 70,
  drawCommandPenalty: 80,
  keepDrawnCardBonus: 10,
  randomJitter: 8,
  nextPlayerOneCardDangerBonus: 500,
  nextPlayerTwoCardsDangerBonus: 300,
  nextPlayerFourCardsDangerBonus: 150,
  nonPressureDangerPenaltyRatio: 0.45,
  drawTwoPressure: 120,
  drawFourPressure: 180,
  wildReverseDrawFourPressure: 260,
  wildDrawSixPressure: 420,
  wildDrawTenPressure: 700,
  penaltyDrawPressure: 280,
  drawStackAvoidedDrawMultiplier: 55,
  colorNumberCardValue: 40,
  colorDrawCardValue: 70,
  colorActionCardValue: 55,
  currentColorBonus: 20,
  reserveWildDrawTenCost: 680,
  reserveWildDrawSixCost: 520,
  reserveWildReverseDrawFourCost: 80,
  reservePenaltyDrawCost: 50,
  swapHugeWeakHandMin: 1_500,
  swapHugeWeakHandMax: 3_000,
  swapMediumWeakHandMin: 1_600,
  swapMediumWeakHandMax: 3_000,
  swapCountPressureWeight: 0.35,
  swapQualityPressureWeight: 0.65,
  swapLowValuePressureWeight: 0.6,
  swapWeakHandPressureWeight: 0.4,
  swapTinyHandLargeSourcePenalty: 5_000,
  swapSourceCriticalBonus: 800,
  swapSourceGapBonusPerCard: 60,
  swapLargeIncomingPenaltyPerCard: 110,
  swapStrongPowerPenaltyPerPoint: 140,
  swapNonCriticalSourceScoreMax: 2_850,
  discardLargeHandBonus: 160,
  discardLargeHandPerCardBonus: 20,
  discardMediumHandBonus: 220,
  discardTinyHandPenalty: 260,
  discardSmallHandPenalty: 180,
  isolatedNumberBaseBonus: 160,
  isolatedNumberDistanceBonus: 28,
  pairStructurePenalty: 70,
  sequenceStructurePenalty: 90,
  structuredNumberDistanceBonus: 6
};

export function getProjectedHandCountAfterResolvingDrawStack(
  state: GameState,
  playerId: PlayerId
): number | null {
  if (!state.drawStack.active || state.drawStack.targetPlayerId !== playerId) {
    return null;
  }

  const player = state.players.find((candidate) => candidate.id === playerId);

  if (player === undefined) {
    return null;
  }

  return player.handCount + state.drawStack.amount;
}

export function shouldPrioritizeDrawTenSelfRescue(
  state: GameState,
  playerId: PlayerId
): boolean {
  const projectedHandCount = getProjectedHandCountAfterResolvingDrawStack(state, playerId);

  return projectedHandCount !== null && projectedHandCount > 20;
}

function hasManageableDrawTenCancellationOption(
  state: GameState,
  playerId: PlayerId
): boolean {
  if (
    !state.drawStack.active ||
    state.drawStack.previousDrawKind !== "wild-draw-ten" ||
    state.drawStack.targetPlayerId !== playerId ||
    shouldPrioritizeDrawTenSelfRescue(state, playerId)
  ) {
    return false;
  }

  const player = state.players.find((candidate) => candidate.id === playerId);

  return player?.hand.some((card) => card.kind === "wild-draw-ten") === true;
}

function isManageableDrawTenCancellationPlay(
  state: GameState,
  playerId: PlayerId,
  card: Card
): boolean {
  return (
    card.kind === "wild-draw-ten" &&
    state.drawStack.active &&
    state.drawStack.previousDrawKind === "wild-draw-ten" &&
    state.drawStack.targetPlayerId === playerId &&
    !shouldPrioritizeDrawTenSelfRescue(state, playerId)
  );
}

export function scoreBotCandidates(
  state: GameState,
  playerId: PlayerId,
  candidates: readonly BotCandidateAction[],
  random: () => number,
  weights: BotScoringWeights = DEFAULT_BOT_SCORING_WEIGHTS
): ScoredBotAction[] {
  return candidates
    .map((candidate) => scoreCandidate(state, playerId, candidate, random, weights))
    .filter((candidate): candidate is ScoredBotAction => candidate !== null)
    .sort((left, right) => right.score - left.score);
}

function scoreCandidate(
  state: GameState,
  playerId: PlayerId,
  candidate: BotCandidateAction,
  random: () => number,
  weights: BotScoringWeights
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

  let score = candidate.cardIds.length * weights.cardReduction;
  const remainingCount = afterPlayer.handCount;

  if (remainingCount === 0) {
    score += weights.winBonus;
  } else if (remainingCount === 1) {
    score += weights.unoBonus;
  } else if (remainingCount === 2) {
    score += weights.twoCardsLeftBonus;
  }

  if (beforePlayer.handCount >= 15 && candidate.cardIds.length >= 2) {
    score += weights.largeHandComboBonus;
  } else if (beforePlayer.handCount >= 10 && candidate.cardIds.length >= 2) {
    score += weights.mediumHandComboBonus;
  }

  score += scorePressure(state, command, weights);
  score += scoreDrawStack(state, command, weights);
  score += scoreDeclaredColor(state, playerId, candidate.declaredColor, weights);
  score += scoreReserveCost(state, beforePlayer.hand, command, weights);
  score += scoreSwapHandsOpportunity(state, beforePlayer.hand, command, weights);
  score += scoreDiscardSameColor(
    beforePlayer.handCount,
    command,
    candidate.cardIds.length,
    weights
  );
  score += scoreSingleNumberStructure(beforePlayer.hand, command, weights);
  score += random() * weights.randomJitter;

  if (command.type === "draw-card") {
    score -= weights.drawCommandPenalty;
  }

  if (command.type === "keep-drawn-card") {
    score += weights.keepDrawnCardBonus;
  }

  return {
    ...candidate,
    score,
    resultingState: result.state
  };
}

function scorePressure(
  state: GameState,
  command: GameCommand,
  weights: BotScoringWeights
): number {
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

  if (isDrawTenChainCancellation(state, topCard)) {
    return 0;
  }

  const dangerBonus =
    nextPlayer.handCount === 1
      ? weights.nextPlayerOneCardDangerBonus
      : nextPlayer.handCount === 2
        ? weights.nextPlayerTwoCardsDangerBonus
        : nextPlayer.handCount <= 4
          ? weights.nextPlayerFourCardsDangerBonus
          : 0;

  if (dangerBonus === 0) {
    return scoreDrawCardPressure(topCard, weights);
  }

  if (
    topCard.kind === "skip" ||
    topCard.kind === "reverse" ||
    topCard.kind === "penalty-draw" ||
    isDrawCard(topCard)
  ) {
    return dangerBonus + scoreDrawCardPressure(topCard, weights);
  }

  if (nextPlayer.handCount <= 2) {
    return -Math.round(dangerBonus * weights.nonPressureDangerPenaltyRatio);
  }

  return scoreDrawCardPressure(topCard, weights);
}

function isDrawTenChainCancellation(state: GameState, topCard: Card): boolean {
  return (
    state.drawStack.active &&
    state.drawStack.previousDrawKind === "wild-draw-ten" &&
    topCard.kind === "wild-draw-ten"
  );
}

function scoreDrawCardPressure(card: Card, weights: BotScoringWeights): number {
  switch (card.kind) {
    case "draw-two":
      return weights.drawTwoPressure;
    case "draw-four":
      return weights.drawFourPressure;
    case "wild-reverse-draw-four":
      return weights.wildReverseDrawFourPressure;
    case "wild-draw-six":
      return weights.wildDrawSixPressure;
    case "wild-draw-ten":
      return weights.wildDrawTenPressure;
    case "penalty-draw":
      return weights.penaltyDrawPressure;
    default:
      return 0;
  }
}

function scoreDrawStack(
  state: GameState,
  command: GameCommand,
  weights: BotScoringWeights
): number {
  if (!state.drawStack.active) {
    return 0;
  }

  if (command.type === "resolve-draw-stack") {
    if (hasManageableDrawTenCancellationOption(state, command.playerId)) {
      return 0;
    }

    return -state.drawStack.amount * weights.drawStackAvoidedDrawMultiplier;
  }

  if (command.type === "play-card") {
    const topCard = getCommandTopCard(state, command);

    if (
      topCard !== null &&
      isDrawTenChainCancellation(state, topCard) &&
      !shouldPrioritizeDrawTenSelfRescue(state, command.playerId)
    ) {
      return -weights.reserveWildDrawTenCost;
    }

    return state.drawStack.amount * weights.drawStackAvoidedDrawMultiplier;
  }

  return 0;
}

function scoreDeclaredColor(
  state: GameState,
  playerId: PlayerId,
  declaredColor: CardColor | undefined,
  weights: BotScoringWeights
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

    return (
      sum +
      (card.kind === "number"
        ? weights.colorNumberCardValue
        : isDrawCard(card)
          ? weights.colorDrawCardValue
          : weights.colorActionCardValue)
    );
  }, declaredColor === state.currentColor ? weights.currentColorBonus : 0);
}

function scoreReserveCost(
  state: GameState,
  hand: readonly Card[],
  command: GameCommand,
  weights: BotScoringWeights
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
  const hasPressureAlternative = hasPlayablePressureAlternative(state, hand, card);
  const drawStackEmergency =
    state.drawStack.active &&
    !isManageableDrawTenCancellationPlay(state, command.playerId, card);
  const emergency =
    !hasCurrentColorAlternative ||
    (nextPlayerDanger && !hasPressureAlternative) ||
    drawStackEmergency ||
    state.drawUntilColor.active ||
    hand.length >= 15;

  if (emergency) {
    return 0;
  }

  switch (card.kind) {
    case "wild-draw-ten":
      return -weights.reserveWildDrawTenCost;
    case "wild-draw-six":
      return -weights.reserveWildDrawSixCost;
    case "wild-reverse-draw-four":
      return -weights.reserveWildReverseDrawFourCost;
    case "penalty-draw":
      return -weights.reservePenaltyDrawCost;
    default:
      return 0;
  }
}

function hasPlayablePressureAlternative(
  state: GameState,
  hand: readonly Card[],
  playedCard: Card
): boolean {
  return hand.some((candidate) => {
    if (candidate.id === playedCard.id || candidate.isBlack) {
      return false;
    }

    if (
      candidate.kind !== "skip" &&
      candidate.kind !== "reverse" &&
      candidate.kind !== "draw-two" &&
      candidate.kind !== "draw-four" &&
      candidate.kind !== "penalty-draw"
    ) {
      return false;
    }

    return canPlayCard({
      card: candidate,
      topCard: state.topCard,
      currentColor: state.currentColor
    });
  });
}

function scoreSwapHandsOpportunity(
  state: GameState,
  hand: readonly Card[],
  command: GameCommand,
  weights: BotScoringWeights
): number {
  if (command.type !== "play-card") {
    return 0;
  }

  const card = hand.find((candidate) => candidate.id === command.cardId);

  if (card?.kind !== "swap-hands") {
    return 0;
  }

  const sourcePlayer = getSwapHandsSourcePlayer(state, command.playerId);
  const ownRemainingCount = Math.max(0, hand.length - 1);
  const incomingCount = sourcePlayer?.handCount ?? null;

  if (
    incomingCount !== null &&
    ownRemainingCount < 4 &&
    ownRemainingCount < incomingCount
  ) {
    return -weights.swapTinyHandLargeSourcePenalty;
  }

  const profile = evaluateHandExchangeProfile(hand);
  let score = 0;

  if (hand.length > 15) {
    score += calculateSwapHandsDynamicScore(
      hand.length,
      profile,
      weights.swapHugeWeakHandMin,
      weights.swapHugeWeakHandMax,
      weights
    );
  } else if (
    hand.length >= 7 &&
    profile.lowValueRatio >= 0.7 &&
    profile.averageValue <= 3
  ) {
    score += calculateSwapHandsDynamicScore(
      hand.length,
      profile,
      weights.swapMediumWeakHandMin,
      weights.swapMediumWeakHandMax,
      weights
    );
  }

  if (incomingCount !== null) {
    const gap = ownRemainingCount - incomingCount;

    if (incomingCount <= 2 && ownRemainingCount >= 5) {
      score += weights.swapSourceCriticalBonus;
    }

    if (gap > 0) {
      score += Math.min(600, gap * weights.swapSourceGapBonusPerCard);
    }

    if (incomingCount >= 8) {
      score -= (incomingCount - 7) * weights.swapLargeIncomingPenaltyPerCard;
    }

    if (incomingCount > 2) {
      score = Math.min(score, weights.swapNonCriticalSourceScoreMax);
    }
  }

  const powerPenalty = Math.max(0, profile.powerValue - 8) * weights.swapStrongPowerPenaltyPerPoint;

  return score - powerPenalty;
}

function calculateSwapHandsDynamicScore(
  handCount: number,
  profile: {
    averageValue: number;
    lowValueRatio: number;
  },
  minScore: number,
  maxScore: number,
  weights: BotScoringWeights
): number {
  const countPressure = clamp((handCount - 7) / 18, 0, 1);
  const lowValuePressure = clamp((profile.lowValueRatio - 0.45) / 0.55, 0, 1);
  const weakHandPressure = clamp((7 - profile.averageValue) / 6, 0, 1);
  const qualityPressure =
    lowValuePressure * weights.swapLowValuePressureWeight +
    weakHandPressure * weights.swapWeakHandPressureWeight;
  const totalPressure =
    countPressure * weights.swapCountPressureWeight +
    qualityPressure * weights.swapQualityPressureWeight;

  return Math.round(minScore + (maxScore - minScore) * totalPressure);
}

function evaluateHandExchangeProfile(hand: readonly Card[]): {
  averageValue: number;
  lowValueRatio: number;
  powerValue: number;
} {
  if (hand.length === 0) {
    return {
      averageValue: 0,
      lowValueRatio: 0,
      powerValue: 0
    };
  }

  let totalValue = 0;
  let lowValueCount = 0;
  let powerValue = 0;

  for (const card of hand) {
    const value = getHandExchangeCardValue(card);
    totalValue += value;
    powerValue += getHandExchangePowerValue(card);

    if (value <= 2) {
      lowValueCount += 1;
    }
  }

  return {
    averageValue: totalValue / hand.length,
    lowValueRatio: lowValueCount / hand.length,
    powerValue
  };
}

function getSwapHandsSourcePlayer(state: GameState, playerId: PlayerId) {
  const orderedPlayers = state.playerOrder
    .map((orderedPlayerId) => state.players.find((player) => player.id === orderedPlayerId))
    .filter((player): player is NonNullable<typeof player> => player !== undefined)
    .filter((player) => !player.isEliminated && !player.isRoundWinner);
  const playerIndex = orderedPlayers.findIndex((player) => player.id === playerId);

  if (playerIndex < 0 || orderedPlayers.length <= 1) {
    return null;
  }

  const sourceIndex =
    state.direction === "clockwise"
      ? (playerIndex - 1 + orderedPlayers.length) % orderedPlayers.length
      : (playerIndex + 1) % orderedPlayers.length;

  return orderedPlayers[sourceIndex] ?? null;
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

function getHandExchangePowerValue(card: Card): number {
  switch (card.kind) {
    case "wild-draw-ten":
      return 5;
    case "wild-draw-six":
    case "wild-reverse-draw-four":
      return 4;
    case "penalty-draw":
    case "draw-four":
      return 3;
    case "draw-two":
      return 2;
    case "skip":
    case "reverse":
    case "wild":
      return 1;
    default:
      return 0;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function scoreDiscardSameColor(
  handCount: number,
  command: GameCommand,
  playedCount: number,
  weights: BotScoringWeights
): number {
  if (command.type !== "play-discard-same-color") {
    return 0;
  }

  if (handCount >= 10) {
    return (
      weights.discardLargeHandBonus +
      playedCount * weights.discardLargeHandPerCardBonus
    );
  }

  if (handCount >= 7 && playedCount >= 3) {
    return weights.discardMediumHandBonus;
  }

  if (handCount <= 3 && playedCount <= 2) {
    return -weights.discardTinyHandPenalty;
  }

  if (handCount <= 4) {
    return -weights.discardSmallHandPenalty;
  }

  return 0;
}

function scoreSingleNumberStructure(
  hand: readonly Card[],
  command: GameCommand,
  weights: BotScoringWeights
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
    return (
      weights.isolatedNumberBaseBonus +
      distanceFromAverage * weights.isolatedNumberDistanceBonus
    );
  }

  let score = 0;

  if (belongsToPair) {
    score -= weights.pairStructurePenalty;
  }

  if (belongsToSequence) {
    score -= weights.sequenceStructurePenalty;
  }

  return score + distanceFromAverage * weights.structuredNumberDistanceBonus;
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
