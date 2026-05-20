import type {
  Card,
  CardColor,
  DrawCardKind,
  GameState,
  PlayerId,
  TurnDirection
} from "@thunder-uno/shared-types";
import { CARD_COLORS, canStackDrawCard, isDrawCard } from "@thunder-uno/uno-core";
import { generateBotCandidates, type BotCandidateAction } from "../botCandidates";
import {
  scoreBotCandidates,
  type BotScoringWeights,
  type ScoredBotAction
} from "../botScoring";
import { decideGreedyBotAction } from "./greedyStrategy";
import type { BotStrategyDecision, BotStrategyParams } from "./types";

const MISCHIEF_SKIP_HUMAN_SCORE = 1_500;
const MISCHIEF_REVERSE_HUMAN_SCORE = 1_400;
const MISCHIEF_REVERSE_UNANSWERABLE_BONUS = 450;
const MISCHIEF_DRAW_CHAIN_HUMAN_SCORE = 2_000;
const MISCHIEF_DRAW_CHAIN_CURRENT_CARD_WEIGHT = 140;
const MISCHIEF_DRAW_CHAIN_TOTAL_PRESSURE_WEIGHT = 18;
const MISCHIEF_DRAW_CHAIN_STABILITY_WEIGHT = 35;
const MISCHIEF_PENALTY_DRAW_HUMAN_SCORE = 1_800;
const MISCHIEF_PENALTY_DRAW_HANDCOUNT_WEIGHT = 45;
const MISCHIEF_SWAP_HUMAN_WILD_TEN_SCORE = 1_650;
const MISCHIEF_SWAP_HUMAN_WILD_SIX_SCORE = 1_250;
const MISCHIEF_SWAP_HUMAN_SHORT_HAND_BONUS = 220;
const MISCHIEF_HUMAN_MISSING_COLOR_SCORE = 220;
const MISCHIEF_HUMAN_UNIQUE_MISSING_COLOR_BONUS = 80;
const MISCHIEF_PLUS_SIX_BLACK_HEAVY_BASELINE = 220;
const MISCHIEF_PLUS_TEN_BLACK_HEAVY_BASELINE = 200;

export interface DecideMischiefBotActionParams extends BotStrategyParams {
  state: GameState;
  playerId: PlayerId;
  forgetUnoRate: number;
  random?: () => number;
  weights?: BotScoringWeights;
}

interface MischiefAnalysis {
  humanTargeted: boolean;
  mainScore: number;
  softColorScore: number;
  baselineScore: number;
  currentCardValue: number;
  totalPressure: number;
  overrideDeclaredColor?: CardColor | undefined;
  reasons: string[];
}

interface RankedMischiefCandidate {
  index: number;
  candidate: BotCandidateAction;
  humanTargeted: boolean;
  mainScore: number;
  softColorScore: number;
  baselineScore: number;
  currentCardValue: number;
  totalPressure: number;
  overrideDeclaredColor?: CardColor | undefined;
  greedyScore: number;
  scoredAction: ScoredBotAction;
  reasons: string[];
}

interface DrawChainOutcome {
  humanTargetId: PlayerId;
  humanHandCount: number;
  totalPressure: number;
  chainLength: number;
}

interface PenaltyChainOutcome {
  humanTargetId: PlayerId;
  humanHandCount: number;
  chainLength: number;
}

interface HumanBigBlackThreat {
  playerId: PlayerId;
  wildDrawTenCount: number;
  wildDrawSixCount: number;
  handCount: number;
}

export function decideMischiefBotAction(
  params: DecideMischiefBotActionParams
): BotStrategyDecision | null {
  const random = params.random ?? Math.random;
  const greedyFallback = decideGreedyBotAction(params);
  const candidates = generateBotCandidates(params.state, params.playerId);

  if (candidates.length === 0) {
    return greedyFallback;
  }

  const scoredCandidates = scoreBotCandidates(
    params.state,
    params.playerId,
    candidates,
    random,
    params.weights
  );
  const scoredCandidateByKey = new Map(
    scoredCandidates.map((candidate) => [getCandidateKey(candidate), candidate] as const)
  );
  const rankedCandidates: RankedMischiefCandidate[] = [];

  candidates.forEach((candidate, index) => {
    const scoredAction = scoredCandidateByKey.get(getCandidateKey(candidate));

    if (scoredAction === undefined) {
      return;
    }

    const analysis = analyzeMischiefCandidate(
      params.state,
      params.playerId,
      candidate,
      params.context
    );
    rankedCandidates.push({
      index,
      candidate,
      humanTargeted: analysis.humanTargeted,
      mainScore: analysis.mainScore,
      softColorScore: analysis.softColorScore,
      baselineScore: analysis.baselineScore,
      currentCardValue: analysis.currentCardValue,
      totalPressure: analysis.totalPressure,
      overrideDeclaredColor: analysis.overrideDeclaredColor,
      greedyScore: scoredAction.score,
      scoredAction,
      reasons: [...candidate.reasons, ...analysis.reasons]
    });
  });

  rankedCandidates.sort((left, right) => {
    if (left.humanTargeted !== right.humanTargeted) {
      return left.humanTargeted ? -1 : 1;
    }

    if (right.mainScore !== left.mainScore) {
      return right.mainScore - left.mainScore;
    }

    if (right.softColorScore !== left.softColorScore) {
      return right.softColorScore - left.softColorScore;
    }

    if (right.baselineScore !== left.baselineScore) {
      return right.baselineScore - left.baselineScore;
    }

    if (right.currentCardValue !== left.currentCardValue) {
      return right.currentCardValue - left.currentCardValue;
    }

    if (right.totalPressure !== left.totalPressure) {
      return right.totalPressure - left.totalPressure;
    }

    if (right.greedyScore !== left.greedyScore) {
      return right.greedyScore - left.greedyScore;
    }

    return left.index - right.index;
  });

  const bestCandidate = rankedCandidates[0];

  if (
    bestCandidate === undefined ||
    (!bestCandidate.humanTargeted &&
      bestCandidate.baselineScore <= 0 &&
      bestCandidate.softColorScore <= 0)
  ) {
    return greedyFallback;
  }

  return {
    command: applyDeclaredColorOverride(
      bestCandidate.candidate.command,
      bestCandidate.overrideDeclaredColor
    ),
    score:
      bestCandidate.mainScore +
      bestCandidate.softColorScore +
      bestCandidate.baselineScore,
    reasons: bestCandidate.reasons,
    willCallUno: shouldCallUno(
      bestCandidate.scoredAction,
      params.playerId,
      params.forgetUnoRate,
      random
    )
  };
}

function analyzeMischiefCandidate(
  state: GameState,
  playerId: PlayerId,
  candidate: BotCandidateAction,
  context: BotStrategyParams["context"]
): MischiefAnalysis {
  const player = state.players.find((candidatePlayer) => candidatePlayer.id === playerId);
  const command = candidate.command;

  if (
    player === undefined ||
    command.type !== "play-card"
  ) {
    return {
      humanTargeted: false,
      mainScore: 0,
      softColorScore: 0,
      baselineScore: 0,
      currentCardValue: 0,
      totalPressure: 0,
      overrideDeclaredColor: undefined,
      reasons: []
    };
  }

  const playedCard = player.hand.find((card) => card.id === command.cardId);

  if (playedCard === undefined) {
    return {
      humanTargeted: false,
      mainScore: 0,
      softColorScore: 0,
      baselineScore: 0,
      currentCardValue: 0,
      totalPressure: 0,
      overrideDeclaredColor: undefined,
      reasons: []
    };
  }

  let mainScore = 0;
  let softColorScore = 0;
  let baselineScore = 0;
  let currentCardValue = getDrawValue(playedCard) ?? 0;
  let totalPressure = 0;
  let overrideDeclaredColor: CardColor | undefined;
  const reasons: string[] = [];

  const nonBlackCount = player.hand.filter((card) => !card.isBlack).length;

  if (
    playedCard.kind === "wild-draw-six" &&
    player.handCount >= 10 &&
    nonBlackCount <= 2
  ) {
    baselineScore += MISCHIEF_PLUS_SIX_BLACK_HEAVY_BASELINE;
    reasons.push("mischief:baseline:plus-six-black-heavy-hand");
  }

  if (
    playedCard.kind === "wild-draw-ten" &&
    player.handCount >= 10 &&
    nonBlackCount <= 2 &&
    !handContainsKind(player.hand.filter((card) => card.id !== playedCard.id), "wild-draw-six")
  ) {
    baselineScore += MISCHIEF_PLUS_TEN_BLACK_HEAVY_BASELINE;
    reasons.push("mischief:baseline:plus-ten-black-heavy-hand");
  }

  if (playedCard.kind === "skip") {
    const skippedPlayer = getNextActivePlayer(state, playerId, state.direction);

    if (isHumanPlayer(skippedPlayer)) {
      mainScore += MISCHIEF_SKIP_HUMAN_SCORE + getHumanThreatBonus(skippedPlayer.handCount);
      reasons.push("mischief:skip-human");
    }
  }

  if (playedCard.kind === "reverse") {
    const previousPlayer = getPreviousActivePlayer(state, playerId, state.direction);

    if (isHumanPlayer(previousPlayer)) {
      mainScore += MISCHIEF_REVERSE_HUMAN_SCORE + getHumanThreatBonus(previousPlayer.handCount);
      reasons.push("mischief:reverse-human");

      if (
        playedCard.color !== undefined &&
        context?.lastUnanswerableColorByPlayerId?.[previousPlayer.id] === playedCard.color
      ) {
        mainScore += MISCHIEF_REVERSE_UNANSWERABLE_BONUS;
        reasons.push("mischief:reverse-human-unanswerable-color");
      }
    }
  }

  if (playedCard.kind === "swap-hands") {
    const humanBigBlackThreat = getMostDangerousHumanBigBlackThreat(state, playerId);

    if (humanBigBlackThreat !== null) {
      mainScore +=
        humanBigBlackThreat.wildDrawTenCount > 0
          ? MISCHIEF_SWAP_HUMAN_WILD_TEN_SCORE
          : MISCHIEF_SWAP_HUMAN_WILD_SIX_SCORE;
      mainScore += Math.max(0, humanBigBlackThreat.wildDrawTenCount - 1) * 180;
      mainScore += humanBigBlackThreat.wildDrawSixCount * 120;

      if (humanBigBlackThreat.handCount <= 2) {
        mainScore += MISCHIEF_SWAP_HUMAN_SHORT_HAND_BONUS;
      }

      reasons.push("mischief:swap-human-big-black");
    }
  }

  if (playedCard.kind === "penalty-draw") {
    const penaltyOutcome = analyzePenaltyDrawChain(state, playerId, playedCard);

    if (penaltyOutcome !== null) {
      mainScore +=
        MISCHIEF_PENALTY_DRAW_HUMAN_SCORE +
        penaltyOutcome.humanHandCount * MISCHIEF_PENALTY_DRAW_HANDCOUNT_WEIGHT +
        penaltyOutcome.chainLength * 20;
      currentCardValue = 10;
      totalPressure = penaltyOutcome.chainLength;
      reasons.push("mischief:penalty-human");

      if (candidate.declaredColor !== undefined) {
        const humanPlayer = state.players.find((candidatePlayer) => candidatePlayer.id === penaltyOutcome.humanTargetId);
        const preferredColor = choosePreferredHumanMissingColor(humanPlayer?.hand ?? []);

        if (preferredColor !== null) {
          overrideDeclaredColor = preferredColor;
        }

        softColorScore += getHumanMissingColorScore(
          humanPlayer?.hand ?? [],
          preferredColor ?? candidate.declaredColor
        );

        if (softColorScore > 0) {
          reasons.push("mischief:penalty-human-missing-color");
        }
      }
    }
  }

  if (isDrawCard(playedCard)) {
    const drawChainOutcome = analyzeDrawChain(state, playerId, playedCard, candidate.declaredColor);

    if (drawChainOutcome !== null) {
      const drawValue = getDrawValue(playedCard) ?? 0;
      mainScore +=
        MISCHIEF_DRAW_CHAIN_HUMAN_SCORE +
        drawValue * MISCHIEF_DRAW_CHAIN_CURRENT_CARD_WEIGHT +
        drawChainOutcome.totalPressure * MISCHIEF_DRAW_CHAIN_TOTAL_PRESSURE_WEIGHT +
        drawChainOutcome.chainLength * MISCHIEF_DRAW_CHAIN_STABILITY_WEIGHT;
      currentCardValue = drawValue;
      totalPressure = drawChainOutcome.totalPressure;
      reasons.push("mischief:draw-chain-human");
    }
  }

  const resultingColor = getResultingColor(playedCard, candidate.declaredColor);
  const colorTarget = getColorTargetHuman(state, playerId, playedCard, candidate, context);

  if (resultingColor !== null && colorTarget !== null) {
    const preferredColor = playedCard.isBlack
      ? choosePreferredHumanMissingColor(colorTarget.hand)
      : resultingColor;
    const colorScore =
      preferredColor === null
        ? 0
        : getHumanMissingColorScore(colorTarget.hand, preferredColor);

    if (colorScore > 0) {
      if (playedCard.isBlack && preferredColor !== null) {
        overrideDeclaredColor = preferredColor;
      }
      softColorScore += colorScore;
      reasons.push("mischief:human-missing-color");
    }
  }

  return {
    humanTargeted: mainScore > 0 || softColorScore > 0,
    mainScore,
    softColorScore,
    baselineScore,
    currentCardValue,
    totalPressure,
    overrideDeclaredColor,
    reasons
  };
}

function analyzeDrawChain(
  state: GameState,
  playerId: PlayerId,
  playedCard: Card,
  declaredColor: CardColor | undefined
): DrawChainOutcome | null {
  if (
    playedCard.kind === "wild-draw-ten" &&
    state.drawStack.active &&
    state.drawStack.previousDrawKind === "wild-draw-ten"
  ) {
    return null;
  }

  const drawValue = getDrawValue(playedCard);

  if (drawValue === null) {
    return null;
  }

  const initialDirection = playedCard.kind === "wild-reverse-draw-four"
    ? toggleDirection(state.direction)
    : state.direction;
  const handState = createHandState(state);
  removeCardFromHandState(handState, playerId, playedCard.id);
  const targetPlayer = getNextActivePlayer(state, playerId, initialDirection);

  if (targetPlayer === null) {
    return null;
  }

  return resolveDrawChainAgainstHuman({
    state,
    handState,
    targetPlayerId: targetPlayer.id,
    direction: initialDirection,
    previousDrawValue: drawValue,
    previousDrawKind: playedCard.kind as DrawCardKind,
    currentColor: declaredColor ?? playedCard.color,
    totalPressure: (state.drawStack.active ? state.drawStack.amount : 0) + drawValue,
    chainLength: 1,
    stepsRemaining: countRemainingDrawCards(handState) + 1
  });
}

function resolveDrawChainAgainstHuman(params: {
  state: GameState;
  handState: Map<PlayerId, Card[]>;
  targetPlayerId: PlayerId;
  direction: TurnDirection;
  previousDrawValue: number;
  previousDrawKind: DrawCardKind;
  currentColor: CardColor | undefined;
  totalPressure: number;
  chainLength: number;
  stepsRemaining: number;
}): DrawChainOutcome | null {
  if (params.stepsRemaining <= 0) {
    return null;
  }

  const targetPlayer = params.state.players.find((player) => player.id === params.targetPlayerId);

  if (targetPlayer === undefined || targetPlayer.isEliminated || targetPlayer.isRoundWinner || targetPlayer.hasLeftRoom) {
    return null;
  }

  const targetHand = params.handState.get(targetPlayer.id) ?? [];

  if (!targetPlayer.isBot) {
    const canHumanContinue = targetHand.some((candidate) =>
      canStackDrawCard({
        nextCard: candidate,
        previousDrawValue: params.previousDrawValue,
        previousDrawKind: params.previousDrawKind,
        ...(params.currentColor === undefined ? {} : { currentColor: params.currentColor })
      })
    );

    if (canHumanContinue) {
      return null;
    }

    return {
      humanTargetId: targetPlayer.id,
      humanHandCount: targetHand.length,
      totalPressure: params.totalPressure,
      chainLength: params.chainLength
    };
  }

  const legalResponses = targetHand.filter((candidate) =>
    canStackDrawCard({
      nextCard: candidate,
      previousDrawValue: params.previousDrawValue,
      previousDrawKind: params.previousDrawKind,
      ...(params.currentColor === undefined ? {} : { currentColor: params.currentColor })
    })
  );

  if (legalResponses.length === 0) {
    return null;
  }

  let bestOutcome: DrawChainOutcome | null = null;

  for (const response of legalResponses) {
    const responseDrawValue = getDrawValue(response);

    if (responseDrawValue === null) {
      continue;
    }

    const nextDirection =
      response.kind === "wild-reverse-draw-four"
        ? toggleDirection(params.direction)
        : params.direction;
    const nextTargetPlayer = getNextActivePlayer(params.state, targetPlayer.id, nextDirection);

    if (nextTargetPlayer === null) {
      continue;
    }

    const nextHandState = cloneHandState(params.handState);
    removeCardFromHandState(nextHandState, targetPlayer.id, response.id);
    const outcome = resolveDrawChainAgainstHuman({
      state: params.state,
      handState: nextHandState,
      targetPlayerId: nextTargetPlayer.id,
      direction: nextDirection,
      previousDrawValue: responseDrawValue,
      previousDrawKind: response.kind as DrawCardKind,
      currentColor: params.currentColor,
      totalPressure: params.totalPressure + responseDrawValue,
      chainLength: params.chainLength + 1,
      stepsRemaining: params.stepsRemaining - 1
    });

    if (
      outcome !== null &&
      (bestOutcome === null ||
        outcome.totalPressure > bestOutcome.totalPressure ||
        outcome.totalPressure === bestOutcome.totalPressure &&
          outcome.chainLength > bestOutcome.chainLength)
    ) {
      bestOutcome = outcome;
    }
  }

  return bestOutcome;
}

function analyzePenaltyDrawChain(
  state: GameState,
  playerId: PlayerId,
  playedCard: Card
): PenaltyChainOutcome | null {
  if (playedCard.kind !== "penalty-draw") {
    return null;
  }

  const handState = createHandState(state);
  removeCardFromHandState(handState, playerId, playedCard.id);
  const targetPlayer = getNextActivePlayer(state, playerId, state.direction);

  if (targetPlayer === null) {
    return null;
  }

  return resolvePenaltyDrawAgainstHuman({
    state,
    handState,
    targetPlayerId: targetPlayer.id,
    direction: state.direction,
    chainLength: 1,
    stepsRemaining: countRemainingPenaltyDrawCards(handState) + 1
  });
}

function resolvePenaltyDrawAgainstHuman(params: {
  state: GameState;
  handState: Map<PlayerId, Card[]>;
  targetPlayerId: PlayerId;
  direction: TurnDirection;
  chainLength: number;
  stepsRemaining: number;
}): PenaltyChainOutcome | null {
  if (params.stepsRemaining <= 0) {
    return null;
  }

  const targetPlayer = params.state.players.find((player) => player.id === params.targetPlayerId);

  if (targetPlayer === undefined || targetPlayer.isEliminated || targetPlayer.isRoundWinner || targetPlayer.hasLeftRoom) {
    return null;
  }

  const targetHand = params.handState.get(targetPlayer.id) ?? [];

  if (!targetPlayer.isBot) {
    const canHumanContinue = targetHand.some((candidate) => candidate.kind === "penalty-draw");

    if (canHumanContinue) {
      return null;
    }

    return {
      humanTargetId: targetPlayer.id,
      humanHandCount: targetHand.length,
      chainLength: params.chainLength
    };
  }

  const legalResponses = targetHand.filter((candidate) => candidate.kind === "penalty-draw");

  if (legalResponses.length === 0) {
    return null;
  }

  let bestOutcome: PenaltyChainOutcome | null = null;

  for (const response of legalResponses) {
    const nextTargetPlayer = getNextActivePlayer(params.state, targetPlayer.id, params.direction);

    if (nextTargetPlayer === null) {
      continue;
    }

    const nextHandState = cloneHandState(params.handState);
    removeCardFromHandState(nextHandState, targetPlayer.id, response.id);
    const outcome = resolvePenaltyDrawAgainstHuman({
      state: params.state,
      handState: nextHandState,
      targetPlayerId: nextTargetPlayer.id,
      direction: params.direction,
      chainLength: params.chainLength + 1,
      stepsRemaining: params.stepsRemaining - 1
    });

    if (
      outcome !== null &&
      (bestOutcome === null || outcome.chainLength > bestOutcome.chainLength)
    ) {
      bestOutcome = outcome;
    }
  }

  return bestOutcome;
}

function getColorTargetHuman(
  state: GameState,
  playerId: PlayerId,
  playedCard: Card,
  candidate: BotCandidateAction,
  context: BotStrategyParams["context"]
): { id: PlayerId; hand: readonly Card[] } | null {
  if (playedCard.kind === "penalty-draw") {
    const outcome = analyzePenaltyDrawChain(state, playerId, playedCard);
    if (outcome === null) {
      return null;
    }

    const human = state.players.find((candidatePlayer) => candidatePlayer.id === outcome.humanTargetId);
    return human === undefined ? null : { id: human.id, hand: human.hand };
  }

  if (playedCard.kind === "reverse") {
    const previousPlayer = getPreviousActivePlayer(state, playerId, state.direction);
    return isHumanPlayer(previousPlayer) ? { id: previousPlayer.id, hand: previousPlayer.hand } : null;
  }

  if (playedCard.kind === "skip") {
    const afterSkipped = getPlayerAfterSkip(state, playerId);
    return isHumanPlayer(afterSkipped) ? { id: afterSkipped.id, hand: afterSkipped.hand } : null;
  }

  if (isDrawCard(playedCard)) {
    const outcome = analyzeDrawChain(state, playerId, playedCard, candidate.declaredColor);
    if (outcome === null) {
      return null;
    }

    const human = state.players.find((candidatePlayer) => candidatePlayer.id === outcome.humanTargetId);
    return human === undefined ? null : { id: human.id, hand: human.hand };
  }

  const nextPlayer = getNextActivePlayer(state, playerId, state.direction);
  return isHumanPlayer(nextPlayer) ? { id: nextPlayer.id, hand: nextPlayer.hand } : null;
}

function getResultingColor(
  playedCard: Card,
  declaredColor: CardColor | undefined
): CardColor | null {
  if (playedCard.isBlack) {
    return declaredColor ?? null;
  }

  return playedCard.color ?? null;
}

function getHumanMissingColorScore(
  hand: readonly Card[],
  color: CardColor
): number {
  const missingColors = getMissingColors(hand);

  if (!missingColors.includes(color)) {
    return 0;
  }

  return (
    MISCHIEF_HUMAN_MISSING_COLOR_SCORE +
    (missingColors.length === 1 ? MISCHIEF_HUMAN_UNIQUE_MISSING_COLOR_BONUS : 0)
  );
}

function choosePreferredHumanMissingColor(
  hand: readonly Card[]
): CardColor | null {
  const missingColors = getMissingColors(hand);

  return missingColors[0] ?? null;
}

function getMostDangerousHumanBigBlackThreat(
  state: GameState,
  playerId: PlayerId
): HumanBigBlackThreat | null {
  const activeHumans = state.players.filter((candidate) => {
    return (
      candidate.id !== playerId &&
      !candidate.isBot &&
      !candidate.isEliminated &&
      !candidate.isRoundWinner &&
      !candidate.hasLeftRoom
    );
  });

  let bestThreat: HumanBigBlackThreat | null = null;

  for (const human of activeHumans) {
    const wildDrawTenCount = human.hand.filter((card) => card.kind === "wild-draw-ten").length;
    const wildDrawSixCount = human.hand.filter((card) => card.kind === "wild-draw-six").length;

    if (wildDrawTenCount === 0 && wildDrawSixCount === 0) {
      continue;
    }

    const threat = {
      playerId: human.id,
      wildDrawTenCount,
      wildDrawSixCount,
      handCount: human.handCount
    };

    if (
      bestThreat === null ||
      threat.wildDrawTenCount > bestThreat.wildDrawTenCount ||
      threat.wildDrawTenCount === bestThreat.wildDrawTenCount &&
        threat.wildDrawSixCount > bestThreat.wildDrawSixCount ||
      threat.wildDrawTenCount === bestThreat.wildDrawTenCount &&
        threat.wildDrawSixCount === bestThreat.wildDrawSixCount &&
        threat.handCount < bestThreat.handCount
    ) {
      bestThreat = threat;
    }
  }

  return bestThreat;
}

function getHumanThreatBonus(handCount: number): number {
  if (handCount <= 2) {
    return 260;
  }

  if (handCount <= 4) {
    return 140;
  }

  return 0;
}

function getPlayerAfterSkip(
  state: GameState,
  playerId: PlayerId
) {
  const skippedPlayer = getNextActivePlayer(state, playerId, state.direction);

  if (skippedPlayer === null) {
    return null;
  }

  return getNextActivePlayer(state, skippedPlayer.id, state.direction);
}

function getNextActivePlayer(
  state: GameState,
  playerId: PlayerId,
  direction: TurnDirection
) {
  return getAdjacentActivePlayer(state, playerId, direction === "clockwise" ? 1 : -1);
}

function getPreviousActivePlayer(
  state: GameState,
  playerId: PlayerId,
  direction: TurnDirection
) {
  return getAdjacentActivePlayer(state, playerId, direction === "clockwise" ? -1 : 1);
}

function getAdjacentActivePlayer(
  state: GameState,
  playerId: PlayerId,
  delta: 1 | -1
) {
  const startIndex = state.playerOrder.indexOf(playerId);

  if (startIndex < 0) {
    return null;
  }

  let cursor = startIndex;

  for (let index = 0; index < state.playerOrder.length - 1; index += 1) {
    cursor = (cursor + delta + state.playerOrder.length) % state.playerOrder.length;
    const currentPlayerId = state.playerOrder[cursor];
    const player = state.players.find((candidate) => candidate.id === currentPlayerId);

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

function createHandState(state: GameState): Map<PlayerId, Card[]> {
  return new Map(state.players.map((player) => [player.id, [...player.hand]] as const));
}

function cloneHandState(handState: Map<PlayerId, Card[]>): Map<PlayerId, Card[]> {
  return new Map(
    [...handState.entries()].map(([playerId, hand]) => [playerId, [...hand]] as const)
  );
}

function removeCardFromHandState(
  handState: Map<PlayerId, Card[]>,
  playerId: PlayerId,
  cardId: string
): void {
  const hand = handState.get(playerId);

  if (hand === undefined) {
    return;
  }

  handState.set(
    playerId,
    hand.filter((card) => card.id !== cardId)
  );
}

function countRemainingDrawCards(handState: Map<PlayerId, Card[]>): number {
  return [...handState.values()].reduce((sum, hand) => {
    return sum + hand.filter(isDrawCard).length;
  }, 0);
}

function countRemainingPenaltyDrawCards(handState: Map<PlayerId, Card[]>): number {
  return [...handState.values()].reduce((sum, hand) => {
    return sum + hand.filter((card) => card.kind === "penalty-draw").length;
  }, 0);
}

function getDrawValue(card: Card): number | null {
  if (!isDrawCard(card)) {
    return null;
  }

  if (card.drawValue !== undefined) {
    return card.drawValue;
  }

  switch (card.kind) {
    case "draw-two":
      return 2;
    case "draw-four":
    case "wild-reverse-draw-four":
      return 4;
    case "wild-draw-six":
      return 6;
    case "wild-draw-ten":
      return 10;
    default:
      return null;
  }
}

function getMissingColors(hand: readonly Card[]): CardColor[] {
  return CARD_COLORS.filter((color) => {
    return !hand.some((card) => card.color === color);
  });
}

function handContainsKind(hand: readonly Card[], kind: Card["kind"]): boolean {
  return hand.some((card) => card.kind === kind);
}

function isHumanPlayer<T extends { isBot?: boolean }>(
  player: T | null
): player is T {
  return player !== null && player.isBot !== true;
}

function toggleDirection(direction: TurnDirection): TurnDirection {
  return direction === "clockwise" ? "counter-clockwise" : "clockwise";
}

function getCandidateKey(
  candidate: Pick<BotCandidateAction, "command" | "cardIds" | "declaredColor">
): string {
  return JSON.stringify({
    command: candidate.command,
    cardIds: candidate.cardIds,
    declaredColor: candidate.declaredColor ?? null
  });
}

function applyDeclaredColorOverride(
  command: BotStrategyDecision["command"],
  declaredColor: CardColor | undefined
) {
  if (command.type !== "play-card" || declaredColor === undefined) {
    return command;
  }

  return {
    ...command,
    declaredColor
  };
}

function shouldCallUno(
  action: ScoredBotAction,
  playerId: PlayerId,
  forgetUnoRate: number,
  random: () => number
): boolean {
  if (
    action.command.type !== "play-card" &&
    action.command.type !== "play-sequence" &&
    action.command.type !== "play-multiple-number" &&
    action.command.type !== "play-discard-same-color"
  ) {
    return false;
  }

  const player = action.resultingState.players.find((candidate) => candidate.id === playerId);

  return (
    player !== undefined &&
    player.handCount === 1 &&
    player.unoPendingSinceMs !== null &&
    random() >= forgetUnoRate
  );
}
