import type { Card, CardColor, DrawCardKind, GameState, PlayerId } from "@thunder-uno/shared-types";
import { CARD_COLORS, canStackDrawCard, isDrawCard } from "@thunder-uno/uno-core";
import { generateBotCandidates, type BotCandidateAction } from "../botCandidates";
import {
  scoreBotCandidates,
  type BotScoringWeights,
  type ScoredBotAction
} from "../botScoring";
import { decideGreedyBotAction } from "./greedyStrategy";
import type { BotStrategyDecision, BotStrategyParams } from "./types";

const DRAW_CHAIN_PRIORITY: Record<Extract<DrawCardKind, "draw-two" | "draw-four" | "wild-reverse-draw-four" | "wild-draw-six" | "wild-draw-ten">, number> = {
  "draw-two": 5,
  "draw-four": 4,
  "wild-reverse-draw-four": 3,
  "wild-draw-six": 2,
  "wild-draw-ten": 1
};

export interface DecideChaosBotActionParams extends BotStrategyParams {
  state: GameState;
  playerId: PlayerId;
  forgetUnoRate: number;
  random?: () => number;
  weights?: BotScoringWeights;
}

interface ChaosCandidateAnalysis {
  score: number;
  reasons: string[];
}

interface RankedChaosCandidate {
  index: number;
  candidate: BotCandidateAction;
  chaosScore: number;
  chaosReasons: string[];
  greedyScore: number;
  scoredAction: ScoredBotAction;
}

export function decideChaosBotAction(
  params: DecideChaosBotActionParams
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
  const rankedCandidates: RankedChaosCandidate[] = [];

  candidates.forEach((candidate, index) => {
    const scoredAction = scoredCandidateByKey.get(getCandidateKey(candidate));

    if (scoredAction === undefined) {
      return;
    }

    const analysis = analyzeChaosCandidate(params.state, params.playerId, candidate, params.context);
    rankedCandidates.push({
      index,
      candidate,
      chaosScore: analysis.score,
      chaosReasons: analysis.reasons,
      greedyScore: scoredAction.score,
      scoredAction
    });
  });

  rankedCandidates.sort((left, right) => {
    if (right.chaosScore !== left.chaosScore) {
      return right.chaosScore - left.chaosScore;
    }

    if (right.chaosReasons.length !== left.chaosReasons.length) {
      return right.chaosReasons.length - left.chaosReasons.length;
    }

    if (right.greedyScore !== left.greedyScore) {
      return right.greedyScore - left.greedyScore;
    }

    return left.index - right.index;
  });

  const bestCandidate = rankedCandidates[0];

  if (bestCandidate === undefined || bestCandidate.chaosScore <= 0) {
    return greedyFallback;
  }

  return {
    command: bestCandidate.candidate.command,
    score: bestCandidate.chaosScore,
    reasons: [...bestCandidate.candidate.reasons, ...bestCandidate.chaosReasons],
    willCallUno: shouldCallUno(
      bestCandidate.scoredAction,
      params.playerId,
      params.forgetUnoRate,
      random
    )
  };
}

function analyzeChaosCandidate(
  state: GameState,
  playerId: PlayerId,
  candidate: BotCandidateAction,
  context: BotStrategyParams["context"]
): ChaosCandidateAnalysis {
  const player = state.players.find((candidatePlayer) => candidatePlayer.id === playerId);
  const nextPlayer = getNextActivePlayer(state, playerId);
  const previousPlayer = getPreviousActivePlayer(state, playerId);
  const command = candidate.command;

  if (
    player === undefined ||
    nextPlayer === null ||
    command.type !== "play-card"
  ) {
    return {
      score: 0,
      reasons: []
    };
  }

  const playedCard = player.hand.find((card) => card.id === command.cardId);

  if (playedCard === undefined) {
    return {
      score: 0,
      reasons: []
    };
  }

  let score = 0;
  const reasons: string[] = [];
  const isDrawTenCancellation =
    playedCard.kind === "wild-draw-ten" &&
    state.drawStack.active &&
    state.drawStack.previousDrawKind === "wild-draw-ten";

  if (
    playedCard.kind === "wild" &&
    candidate.declaredColor !== undefined &&
    candidate.declaredColor === getUniqueMissingColor(nextPlayer.hand)
  ) {
    score += 1200;
    reasons.push("chaos:wild-unique-missing-color");
  }

  if (
    isDrawCard(playedCard) &&
    !isDrawTenCancellation &&
    nextPlayerCannotStackResponse(nextPlayer.hand, playedCard, candidate.declaredColor)
  ) {
    score += 1000;
    reasons.push("chaos:unstoppable-draw-chain");

    if (playedCard.kind in DRAW_CHAIN_PRIORITY) {
      score += DRAW_CHAIN_PRIORITY[playedCard.kind as keyof typeof DRAW_CHAIN_PRIORITY];
      reasons.push(`chaos:draw-priority:${playedCard.kind}`);
    }
  }

  if (playedCard.kind === "swap-hands") {
    if (getActiveOpponents(state, playerId).some((opponent) => handContainsKind(opponent.hand, "wild-draw-ten"))) {
      score += 920;
      reasons.push("chaos:swap-against-plus-ten");
    }

    if (getActiveOpponents(state, playerId).some((opponent) => opponent.handCount < 5)) {
      score += 860;
      reasons.push("chaos:swap-against-short-hand");
    }
  }

  if (
    playedCard.kind === "reverse" &&
    previousPlayer !== null &&
    playedCard.color !== undefined &&
    context?.lastUnanswerableColorByPlayerId?.[previousPlayer.id] === playedCard.color
  ) {
    score += 760;
    reasons.push("chaos:reverse-unanswerable-color");
  }

  if (
    playedCard.kind === "wild-draw-ten" &&
    !isDrawTenCancellation &&
    handContainsKind(player.hand.filter((card) => card.id !== playedCard.id), "swap-hands")
  ) {
    score += 720;
    reasons.push("chaos:plus-ten-with-swap-hands");
  }

  const nonBlackCount = player.hand.filter((card) => !card.isBlack).length;

  if (
    playedCard.kind === "wild-draw-six" &&
    player.handCount >= 10 &&
    nonBlackCount <= 2
  ) {
    score += 840;
    reasons.push("chaos:plus-six-black-heavy-hand");
  }

  if (
    playedCard.kind === "wild-draw-ten" &&
    player.handCount >= 10 &&
    nonBlackCount <= 2 &&
    !handContainsKind(player.hand, "wild-draw-six")
  ) {
    score += 780;
    reasons.push("chaos:plus-ten-black-heavy-hand");
  }

  if (playedCard.kind === "penalty-draw" && nextPlayer.handCount > 15) {
    score += 880;
    reasons.push("chaos:penalty-draw-vs-large-hand");
  }

  return {
    score,
    reasons
  };
}

function nextPlayerCannotStackResponse(
  hand: readonly Card[],
  playedCard: Card,
  declaredColor: CardColor | undefined
): boolean {
  const previousDrawValue = getDrawValue(playedCard);

  if (previousDrawValue === null) {
    return false;
  }

  return !hand.some((candidate) => {
    const currentColor = declaredColor ?? playedCard.color;

    return canStackDrawCard({
      nextCard: candidate,
      previousDrawValue,
      previousDrawKind: playedCard.kind as DrawCardKind,
      ...(currentColor === undefined ? {} : { currentColor })
    });
  });
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

function getUniqueMissingColor(hand: readonly Card[]): CardColor | null {
  const missingColors = CARD_COLORS.filter((color) => {
    return !hand.some((card) => card.color === color);
  });

  return missingColors.length === 1 ? (missingColors[0] ?? null) : null;
}

function getActiveOpponents(state: GameState, playerId: PlayerId) {
  return state.players.filter((player) => {
    return (
      player.id !== playerId &&
      !player.isEliminated &&
      !player.isRoundWinner &&
      !player.hasLeftRoom
    );
  });
}

function getNextActivePlayer(state: GameState, playerId: PlayerId) {
  return getAdjacentActivePlayer(state, playerId, state.direction === "clockwise" ? 1 : -1);
}

function getPreviousActivePlayer(state: GameState, playerId: PlayerId) {
  return getAdjacentActivePlayer(state, playerId, state.direction === "clockwise" ? -1 : 1);
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

function handContainsKind(hand: readonly Card[], kind: Card["kind"]): boolean {
  return hand.some((card) => card.kind === kind);
}

function getCandidateKey(candidate: Pick<BotCandidateAction, "command" | "cardIds" | "declaredColor">): string {
  return JSON.stringify({
    command: candidate.command,
    cardIds: candidate.cardIds,
    declaredColor: candidate.declaredColor ?? null
  });
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
