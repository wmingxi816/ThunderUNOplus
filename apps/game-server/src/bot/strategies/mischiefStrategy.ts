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
  shouldPrioritizeDrawTenSelfRescue,
  scoreBotCandidates,
  type BotScoringWeights,
  type ScoredBotAction
} from "../botScoring";
import type { BotStrategyDecision, BotStrategyParams } from "./types";

const MISCHIEF_SKIP_HUMAN_SCORE = 1_500;
const MISCHIEF_SKIP_ROBOT_PENALTY = 900;
const MISCHIEF_REVERSE_HUMAN_SCORE = 1_400;
const MISCHIEF_REVERSE_UNANSWERABLE_BONUS = 450;
const MISCHIEF_REVERSE_ROBOT_PENALTY = 820;
const MISCHIEF_DRAW_CHAIN_HUMAN_SCORE = 1_900;
const MISCHIEF_DRAW_CHAIN_CURRENT_CARD_WEIGHT = 150;
const MISCHIEF_DRAW_CHAIN_TOTAL_PRESSURE_WEIGHT = 20;
const MISCHIEF_DRAW_CHAIN_STABILITY_WEIGHT = 45;
const MISCHIEF_DRAW_CHAIN_RELAY_TEAM_BONUS = 340;
const MISCHIEF_DRAW_CHAIN_ROBOT_PENALTY_FACTOR = 210;
const MISCHIEF_PENALTY_DRAW_HUMAN_SCORE = 1_700;
const MISCHIEF_PENALTY_DRAW_HANDCOUNT_WEIGHT = 42;
const MISCHIEF_PENALTY_DRAW_RELAY_TEAM_BONUS = 280;
const MISCHIEF_PENALTY_DRAW_ROBOT_PENALTY = 950;
const MISCHIEF_UPSTREAM_DRAW_TWO_HUMAN_PRESSURE = 360;
const MISCHIEF_UPSTREAM_DRAW_FOUR_HUMAN_PRESSURE = 430;
const MISCHIEF_UPSTREAM_DRAW_RELAY_BONUS = 180;
const MISCHIEF_UPSTREAM_DRAW_ROBOT_TRAP_PENALTY = 1_420;
const MISCHIEF_HUMAN_MISSING_COLOR_SCORE = 240;
const MISCHIEF_HUMAN_UNIQUE_MISSING_COLOR_BONUS = 90;
const MISCHIEF_SELF_CARD_REDUCTION_SCORE = 220;
const MISCHIEF_SELF_UNO_SCORE = 900;
const MISCHIEF_SELF_TWO_CARDS_SCORE = 260;
const MISCHIEF_SELF_DRAW_STACK_ESCAPE_WEIGHT = 85;
const MISCHIEF_SELF_DRAW_UNTIL_COLOR_ESCAPE_SCORE = 700;
const MISCHIEF_SELF_KEEP_DRAWN_SCORE = 30;
const MISCHIEF_SELF_DRAW_COMMAND_PENALTY = 120;
const MISCHIEF_PLUS_TEN_RESERVE_COST = 1_250;
const MISCHIEF_PLUS_SIX_RESERVE_COST = 940;
const MISCHIEF_REVERSE_PLUS_FOUR_RESERVE_COST = 720;
const MISCHIEF_PENALTY_DRAW_RESERVE_COST = 540;
const MISCHIEF_DRAW_FOUR_RESERVE_COST = 420;
const MISCHIEF_DRAW_TWO_RESERVE_COST = 280;
const MISCHIEF_SWAP_SHORT_HAND_BONUS = 180;
const MISCHIEF_SWAP_ROBOT_THREAT_PENALTY_FACTOR = 0.35;

export interface DecideMischiefBotActionParams extends BotStrategyParams {
  state: GameState;
  playerId: PlayerId;
  forgetUnoRate: number;
  random?: () => number;
  weights?: BotScoringWeights;
}

interface MischiefAnalysis {
  humanTargeted: boolean;
  humanAttackScore: number;
  teamScore: number;
  selfScore: number;
  colorScore: number;
  currentCardValue: number;
  totalPressure: number;
  overrideDeclaredColor?: CardColor | undefined;
  reasons: string[];
}

interface RankedMischiefCandidate {
  index: number;
  candidate: BotCandidateAction;
  directWin: boolean;
  humanTargeted: boolean;
  humanAttackScore: number;
  teamScore: number;
  selfScore: number;
  colorScore: number;
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

interface ThreatScoreSummary {
  playerId: PlayerId;
  total: number;
  highestSingle: number;
  handCount: number;
}

interface SwapHandsSimulationEntry {
  playerId: PlayerId;
  isHuman: boolean;
  beforeHand: readonly Card[];
  afterHand: readonly Card[];
  beforeHandCount: number;
  afterHandCount: number;
}

interface SwapHandsSimulation {
  players: SwapHandsSimulationEntry[];
}

interface UpstreamDrawPressureAnalysis {
  bonus: number;
  reasons: string[];
}

export function decideMischiefBotAction(
  params: DecideMischiefBotActionParams
): BotStrategyDecision | null {
  const random = params.random ?? Math.random;
  const candidates = generateBotCandidates(params.state, params.playerId);

  if (candidates.length === 0) {
    return createProtectedFallbackDecision(params.state, params.playerId);
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
      scoredAction,
      params.context
    );
    const directWin = isDirectWinningAction(scoredAction, params.playerId);
    rankedCandidates.push({
      index,
      candidate,
      directWin,
      humanTargeted: analysis.humanTargeted,
      humanAttackScore: analysis.humanAttackScore,
      teamScore: analysis.teamScore,
      selfScore: analysis.selfScore,
      colorScore: analysis.colorScore,
      currentCardValue: analysis.currentCardValue,
      totalPressure: analysis.totalPressure,
      overrideDeclaredColor: analysis.overrideDeclaredColor,
      greedyScore: scoredAction.score,
      scoredAction,
      reasons: [...candidate.reasons, ...analysis.reasons]
    });
  });

  rankedCandidates.sort((left, right) => {
    if (left.directWin !== right.directWin) {
      return left.directWin ? -1 : 1;
    }

    if (right.humanAttackScore !== left.humanAttackScore) {
      return right.humanAttackScore - left.humanAttackScore;
    }

    if (right.teamScore !== left.teamScore) {
      return right.teamScore - left.teamScore;
    }

    if (right.selfScore !== left.selfScore) {
      return right.selfScore - left.selfScore;
    }

    if (right.colorScore !== left.colorScore) {
      return right.colorScore - left.colorScore;
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

  if (bestCandidate === undefined) {
    return createProtectedFallbackDecision(params.state, params.playerId);
  }

  return {
    command: applyDeclaredColorOverride(
      bestCandidate.candidate.command,
      bestCandidate.overrideDeclaredColor
    ),
    score:
      bestCandidate.humanAttackScore +
      bestCandidate.teamScore +
      bestCandidate.selfScore +
      bestCandidate.colorScore,
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
  scoredAction: ScoredBotAction,
  context: BotStrategyParams["context"]
): MischiefAnalysis {
  const player = state.players.find((candidatePlayer) => candidatePlayer.id === playerId);
  const command = candidate.command;
  const resultingPlayer = scoredAction.resultingState.players.find((candidatePlayer) => candidatePlayer.id === playerId);

  if (
    player === undefined ||
    resultingPlayer === undefined
  ) {
    return {
      humanTargeted: false,
      humanAttackScore: 0,
      teamScore: 0,
      selfScore: 0,
      colorScore: 0,
      currentCardValue: 0,
      totalPressure: 0,
      overrideDeclaredColor: undefined,
      reasons: []
    };
  }

  if (command.type !== "play-card") {
    return {
      humanTargeted: false,
      humanAttackScore: 0,
      teamScore: 0,
      selfScore: getNonPlaySelfScore(state, player, resultingPlayer, candidate, scoredAction),
      colorScore: 0,
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
      humanAttackScore: 0,
      teamScore: 0,
      selfScore: 0,
      colorScore: 0,
      currentCardValue: 0,
      totalPressure: 0,
      overrideDeclaredColor: undefined,
      reasons: []
    };
  }

  let humanAttackScore = 0;
  let teamScore = 0;
  let selfScore = getPlayCardSelfScore(state, player, resultingPlayer, candidate, scoredAction, playedCard);
  let colorScore = 0;
  let currentCardValue = getDrawValue(playedCard) ?? 0;
  let totalPressure = 0;
  let overrideDeclaredColor: CardColor | undefined;
  const reasons: string[] = [];
  const immediateTarget = getImmediateEffectTarget(state, playerId, playedCard);
  const drawValue = getDrawValue(playedCard);
  const isDrawTenCancellation =
    playedCard.kind === "wild-draw-ten" &&
    state.drawStack.active &&
    state.drawStack.previousDrawKind === "wild-draw-ten";
  const shouldSelfRescueDrawTen =
    isDrawTenCancellation &&
    shouldPrioritizeDrawTenSelfRescue(state, playerId);

  if (shouldSelfRescueDrawTen) {
    selfScore += state.drawStack.amount * MISCHIEF_SELF_DRAW_STACK_ESCAPE_WEIGHT;
    reasons.push("mischief:self:draw-ten-cancel");
  }

  if (playedCard.kind === "skip") {
    if (isHumanPlayer(immediateTarget)) {
      humanAttackScore += MISCHIEF_SKIP_HUMAN_SCORE + getHumanThreatBonus(immediateTarget.handCount);
      reasons.push("mischief:skip-human");
    } else if (immediateTarget !== null) {
      teamScore -= MISCHIEF_SKIP_ROBOT_PENALTY;
      reasons.push("mischief:avoid-skip-robot");
    }
  }

  if (playedCard.kind === "reverse") {
    if (isHumanPlayer(immediateTarget)) {
      humanAttackScore += MISCHIEF_REVERSE_HUMAN_SCORE + getHumanThreatBonus(immediateTarget.handCount);
      reasons.push("mischief:reverse-human");

      if (
        playedCard.color !== undefined &&
        context?.lastUnanswerableColorByPlayerId?.[immediateTarget.id] === playedCard.color
      ) {
        humanAttackScore += MISCHIEF_REVERSE_UNANSWERABLE_BONUS;
        reasons.push("mischief:reverse-human-unanswerable-color");
      }
    } else if (immediateTarget !== null) {
      teamScore -= MISCHIEF_REVERSE_ROBOT_PENALTY;
      reasons.push("mischief:avoid-reverse-robot");
    }
  }

  if (playedCard.kind === "swap-hands") {
    const humanThreat = summarizeThreatByGroup(state, playerId, "human");
    const robotThreat = summarizeThreatByGroup(state, playerId, "robot");
    const swapSimulation = simulateSwapHandsOutcome(state, playerId, playedCard.id);

    if (humanThreat !== null && humanThreat.total > 0) {
      const swapThreatScore = getSwapHandsHumanThreatScore(humanThreat);

      if (swapThreatScore > 0) {
        humanAttackScore += swapThreatScore;
        reasons.push("mischief:swap-human-big-black");
      }
    }

    if (swapSimulation !== null) {
      const swing = scoreSwapHandsHumanSwing(swapSimulation);
      humanAttackScore += swing.humanAttackDelta;
      teamScore += swing.teamDelta;
      reasons.push(...swing.reasons);
    }

    if (robotThreat !== null && robotThreat.total > 0) {
      teamScore -= Math.round(robotThreat.total * MISCHIEF_SWAP_ROBOT_THREAT_PENALTY_FACTOR);
      reasons.push("mischief:avoid-swap-robot-threat");
    }
  }

  if (playedCard.kind === "penalty-draw") {
    const penaltyOutcome = analyzePenaltyDrawChain(state, playerId, playedCard);

    if (penaltyOutcome !== null) {
      humanAttackScore +=
        MISCHIEF_PENALTY_DRAW_HUMAN_SCORE +
        penaltyOutcome.humanHandCount * MISCHIEF_PENALTY_DRAW_HANDCOUNT_WEIGHT +
        penaltyOutcome.chainLength * 20;
      if (immediateTarget?.isBot === true) {
        teamScore += MISCHIEF_PENALTY_DRAW_RELAY_TEAM_BONUS * Math.max(1, penaltyOutcome.chainLength - 1);
        reasons.push("mischief:penalty-relay-robot");
      }
      currentCardValue = 10;
      totalPressure = penaltyOutcome.chainLength;
      reasons.push("mischief:penalty-human");

      if (candidate.declaredColor !== undefined) {
        const humanPlayer = state.players.find((candidatePlayer) => candidatePlayer.id === penaltyOutcome.humanTargetId);
        const preferredColor = choosePreferredHumanMissingColor(humanPlayer?.hand ?? []);

        if (preferredColor !== null) {
          overrideDeclaredColor = preferredColor;
        }

        colorScore += getHumanMissingColorScore(
          humanPlayer?.hand ?? [],
          preferredColor ?? candidate.declaredColor
        );

        if (colorScore > 0) {
          reasons.push("mischief:penalty-human-missing-color");
        }
      }
    } else if (immediateTarget?.isBot === true) {
      teamScore -= MISCHIEF_PENALTY_DRAW_ROBOT_PENALTY;
      reasons.push("mischief:avoid-penalty-robot");
    }
  }

  if (isDrawCard(playedCard) && !isDrawTenCancellation) {
    const drawChainOutcome = analyzeDrawChain(state, playerId, playedCard, candidate.declaredColor);
    const upstreamPressure = analyzeHumanUpstreamDrawPressure(state, playerId, playedCard);

    if (drawChainOutcome !== null) {
      const safeDrawValue = drawValue ?? 0;
      humanAttackScore +=
        MISCHIEF_DRAW_CHAIN_HUMAN_SCORE +
        safeDrawValue * MISCHIEF_DRAW_CHAIN_CURRENT_CARD_WEIGHT +
        drawChainOutcome.totalPressure * MISCHIEF_DRAW_CHAIN_TOTAL_PRESSURE_WEIGHT +
        drawChainOutcome.chainLength * MISCHIEF_DRAW_CHAIN_STABILITY_WEIGHT;
      if (immediateTarget?.isBot === true) {
        teamScore += MISCHIEF_DRAW_CHAIN_RELAY_TEAM_BONUS * Math.max(1, drawChainOutcome.chainLength - 1);
        reasons.push("mischief:draw-chain-relay-robot");
      }
      currentCardValue = safeDrawValue;
      totalPressure = drawChainOutcome.totalPressure;
      reasons.push("mischief:draw-chain-human");
    } else if (immediateTarget?.isBot === true && drawValue !== null) {
      teamScore -= drawValue * MISCHIEF_DRAW_CHAIN_ROBOT_PENALTY_FACTOR;
      reasons.push("mischief:avoid-draw-chain-robot");
    } else if (
      isHumanPlayer(immediateTarget) &&
      drawValue !== null &&
      playedCard.kind !== "draw-two" &&
      playedCard.kind !== "draw-four"
    ) {
      humanAttackScore += drawValue * 55;
      reasons.push("mischief:draw-pressure-human");
    }

    if (upstreamPressure.bonus !== 0) {
      teamScore += upstreamPressure.bonus;
      reasons.push(...upstreamPressure.reasons);
    }
  }

  const resultingColor = getResultingColor(playedCard, candidate.declaredColor);
  const colorTarget = getColorTargetHuman(state, playerId, playedCard, candidate, context);

  if (resultingColor !== null && colorTarget !== null) {
    const preferredColor = playedCard.isBlack
      ? choosePreferredHumanMissingColor(colorTarget.hand)
      : resultingColor;
    const missingColorScore =
      preferredColor === null
        ? 0
        : getHumanMissingColorScore(colorTarget.hand, preferredColor);

    if (missingColorScore > 0) {
      if (playedCard.isBlack && preferredColor !== null) {
        overrideDeclaredColor = preferredColor;
      }
      colorScore += missingColorScore;
      reasons.push("mischief:human-missing-color");
    }
  }

  if (
    !isDirectWinningAction(scoredAction, playerId) &&
    humanAttackScore <= 0 &&
    !shouldSelfRescueDrawTen
  ) {
    selfScore -= getPunishReserveCost(playedCard);
  }

  return {
    humanTargeted: humanAttackScore > 0 || colorScore > 0,
    humanAttackScore,
    teamScore,
    selfScore,
    colorScore,
    currentCardValue,
    totalPressure,
    overrideDeclaredColor,
    reasons
  };
}

function createProtectedFallbackDecision(
  state: GameState,
  playerId: PlayerId
): BotStrategyDecision | null {
  if (state.status === "finished" || state.currentPlayerId !== playerId) {
    return null;
  }

  if (state.normalDrawOffer.active && state.normalDrawOffer.playerId === playerId) {
    return {
      command: {
        type: "keep-drawn-card",
        playerId
      },
      score: Number.NEGATIVE_INFINITY,
      reasons: ["protected-fallback"],
      willCallUno: false
    };
  }

  if (state.drawStack.active && state.drawStack.targetPlayerId === playerId) {
    return {
      command: {
        type: "resolve-draw-stack",
        playerId
      },
      score: Number.NEGATIVE_INFINITY,
      reasons: ["protected-fallback"],
      willCallUno: false
    };
  }

  if (state.drawUntilColor.active && state.drawUntilColor.targetPlayerId === playerId) {
    return {
      command: {
        type: "resolve-draw-until-color",
        playerId
      },
      score: Number.NEGATIVE_INFINITY,
      reasons: ["protected-fallback"],
      willCallUno: false
    };
  }

  return {
    command: {
      type: "draw-card",
      playerId
    },
    score: Number.NEGATIVE_INFINITY,
    reasons: ["protected-fallback"],
    willCallUno: false
  };
}

function isDirectWinningAction(
  scoredAction: ScoredBotAction,
  playerId: PlayerId
): boolean {
  const player = scoredAction.resultingState.players.find((candidate) => candidate.id === playerId);

  return (
    player !== undefined &&
    (player.handCount === 0 || scoredAction.resultingState.winnerPlayerIds.includes(playerId))
  );
}

function getNonPlaySelfScore(
  state: GameState,
  player: GameState["players"][number],
  _resultingPlayer: GameState["players"][number],
  candidate: BotCandidateAction,
  scoredAction: ScoredBotAction
): number {
  switch (candidate.command.type) {
    case "keep-drawn-card":
      return MISCHIEF_SELF_KEEP_DRAWN_SCORE + Math.round(scoredAction.score * 0.04);
    case "resolve-draw-stack":
      return hasManageableDrawTenCancellation(state, player.id)
        ? 0
        : -state.drawStack.amount * MISCHIEF_SELF_DRAW_STACK_ESCAPE_WEIGHT;
    case "resolve-draw-until-color":
      return -MISCHIEF_SELF_DRAW_UNTIL_COLOR_ESCAPE_SCORE;
    case "draw-card":
      return -MISCHIEF_SELF_DRAW_COMMAND_PENALTY;
    default:
      return 0;
  }
}

function hasManageableDrawTenCancellation(state: GameState, playerId: PlayerId): boolean {
  return (
    state.drawStack.active &&
    state.drawStack.previousDrawKind === "wild-draw-ten" &&
    state.drawStack.targetPlayerId === playerId &&
    !shouldPrioritizeDrawTenSelfRescue(state, playerId) &&
    state.players.find((candidate) => candidate.id === playerId)?.hand.some((card) => card.kind === "wild-draw-ten") === true
  );
}

function getPlayCardSelfScore(
  state: GameState,
  player: GameState["players"][number],
  resultingPlayer: GameState["players"][number],
  candidate: BotCandidateAction,
  scoredAction: ScoredBotAction,
  playedCard: Card
): number {
  const isManageableDrawTenCancellation =
    playedCard.kind === "wild-draw-ten" &&
    state.drawStack.active &&
    state.drawStack.previousDrawKind === "wild-draw-ten" &&
    state.drawStack.targetPlayerId === player.id &&
    !shouldPrioritizeDrawTenSelfRescue(state, player.id);
  let score =
    (player.handCount - resultingPlayer.handCount) * MISCHIEF_SELF_CARD_REDUCTION_SCORE +
    Math.round(scoredAction.score * 0.06);

  if (resultingPlayer.handCount === 1 && resultingPlayer.unoPendingSinceMs !== null) {
    score += MISCHIEF_SELF_UNO_SCORE;
  } else if (resultingPlayer.handCount === 2) {
    score += MISCHIEF_SELF_TWO_CARDS_SCORE;
  }

  if (
    state.drawStack.active &&
    state.drawStack.targetPlayerId === player.id &&
    !isManageableDrawTenCancellation
  ) {
    score += state.drawStack.amount * MISCHIEF_SELF_DRAW_STACK_ESCAPE_WEIGHT;
  }

  if (state.drawUntilColor.active && state.drawUntilColor.targetPlayerId === player.id) {
    score += MISCHIEF_SELF_DRAW_UNTIL_COLOR_ESCAPE_SCORE;
  }

  if (candidate.cardIds.length >= 2) {
    score += 40;
  }

  if (playedCard.kind === "wild" && candidate.declaredColor !== undefined && candidate.declaredColor === state.currentColor) {
    score -= 40;
  }

  return score;
}

function getImmediateEffectTarget(
  state: GameState,
  playerId: PlayerId,
  playedCard: Card
) {
  switch (playedCard.kind) {
    case "reverse":
      return getPreviousActivePlayer(state, playerId, state.direction);
    case "skip":
    case "penalty-draw":
    case "draw-two":
    case "draw-four":
    case "wild-draw-six":
    case "wild-draw-ten":
      return getNextActivePlayer(state, playerId, state.direction);
    case "wild-reverse-draw-four":
      return getPreviousActivePlayer(state, playerId, state.direction);
    default:
      return getNextActivePlayer(state, playerId, state.direction);
  }
}

function summarizeThreatByGroup(
  state: GameState,
  playerId: PlayerId,
  group: "human" | "robot"
): ThreatScoreSummary | null {
  const candidates = state.players.filter((candidate) => {
    const groupMatches = group === "human" ? candidate.isBot !== true : candidate.isBot === true;

    return (
      candidate.id !== playerId &&
      groupMatches &&
      !candidate.isEliminated &&
      !candidate.isRoundWinner &&
      !candidate.hasLeftRoom
    );
  });

  let best: ThreatScoreSummary | null = null;

  for (const candidate of candidates) {
    const threat = evaluateThreatScore(candidate.hand, candidate.handCount);

    if (threat.total <= 0) {
      continue;
    }

    if (
      best === null ||
      threat.highestSingle > best.highestSingle ||
      threat.highestSingle === best.highestSingle &&
        threat.total > best.total ||
      threat.highestSingle === best.highestSingle &&
        threat.total === best.total &&
        candidate.handCount < best.handCount
    ) {
      best = {
        playerId: candidate.id,
        total: threat.total,
        highestSingle: threat.highestSingle,
        handCount: candidate.handCount
      };
    }
  }

  return best;
}

function evaluateThreatScore(
  hand: readonly Card[],
  handCount: number
): { total: number; highestSingle: number } {
  let total = 0;
  let highestSingle = 0;

  for (const card of hand) {
    const weight = getMischiefThreatWeight(card);
    total += weight;
    highestSingle = Math.max(highestSingle, weight);
  }

  if (handCount <= 2) {
    total += 260;
  } else if (handCount <= 4) {
    total += 120;
  }

  return {
    total,
    highestSingle
  };
}

function getMischiefThreatWeight(card: Card): number {
  switch (card.kind) {
    case "wild-draw-ten":
      return 1_800;
    case "wild-draw-six":
      return 620;
    case "draw-four":
      return 460;
    case "wild-reverse-draw-four":
      return 420;
    case "penalty-draw":
      return 90;
    case "draw-two":
      return 80;
    case "wild":
      return 60;
    case "skip":
    case "reverse":
      return 45;
    case "swap-hands":
    case "discard-same-color":
      return 35;
    default:
      return 0;
  }
}

function countKind(hand: readonly Card[], kind: Card["kind"]): number {
  return hand.filter((card) => card.kind === kind).length;
}

function getSwapHandsHumanThreatScore(summary: ThreatScoreSummary): number {
  if (summary.highestSingle >= 1_800) {
    return 1_600 + Math.round((summary.total - summary.highestSingle) * 0.18) +
      (summary.handCount <= 2 ? MISCHIEF_SWAP_SHORT_HAND_BONUS : 0);
  }

  if (summary.highestSingle >= 620) {
    return 780 + Math.round((summary.total - summary.highestSingle) * 0.12) +
      (summary.handCount <= 2 ? 120 : 0);
  }

  if (summary.highestSingle >= 420) {
    return 620 + Math.round((summary.total - summary.highestSingle) * 0.1);
  }

  return 0;
}

function simulateSwapHandsOutcome(
  state: GameState,
  actingPlayerId: PlayerId,
  playedCardId: string
): SwapHandsSimulation | null {
  const orderedPlayers = state.playerOrder
    .map((playerId) => state.players.find((player) => player.id === playerId))
    .filter((player): player is NonNullable<typeof player> => player !== undefined)
    .filter((player) => !player.isEliminated && !player.isRoundWinner);

  if (orderedPlayers.length <= 1) {
    return null;
  }

  const originalHands = new Map(
    orderedPlayers.map((player) => [
      player.id,
      player.id === actingPlayerId
        ? player.hand.filter((card) => card.id !== playedCardId)
        : [...player.hand]
    ] as const)
  );
  const entries: SwapHandsSimulationEntry[] = [];

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

    const beforeHand = originalHands.get(receiver.id) ?? [];
    const afterHand = originalHands.get(sourcePlayer.id) ?? [];

    entries.push({
      playerId: receiver.id,
      isHuman: receiver.isBot !== true,
      beforeHand,
      afterHand,
      beforeHandCount: beforeHand.length,
      afterHandCount: afterHand.length
    });
  }

  return {
    players: entries
  };
}

function scoreSwapHandsHumanSwing(
  simulation: SwapHandsSimulation
): { humanAttackDelta: number; teamDelta: number; reasons: string[] } {
  let humanAttackDelta = 0;
  let teamDelta = 0;
  const reasons: string[] = [];
  let anyHumanHadPlusTen = false;

  for (const entry of simulation.players) {
    if (!entry.isHuman) {
      continue;
    }

    const beforePlusTen = countKind(entry.beforeHand, "wild-draw-ten");
    const afterPlusTen = countKind(entry.afterHand, "wild-draw-ten");
    const beforePlusSix = countKind(entry.beforeHand, "wild-draw-six");
    const afterPlusSix = countKind(entry.afterHand, "wild-draw-six");
    const beforeThreat = evaluateThreatScore(entry.beforeHand, entry.beforeHandCount).total;
    const afterThreat = evaluateThreatScore(entry.afterHand, entry.afterHandCount).total;

    if (beforePlusTen > 0) {
      anyHumanHadPlusTen = true;
      humanAttackDelta += 1_000 + beforePlusTen * 220;
      reasons.push("mischief:swap-human-current-plus-ten");
    }

    if (beforePlusTen > afterPlusTen) {
      humanAttackDelta += 1_450 * (beforePlusTen - afterPlusTen);
      reasons.push("mischief:swap-removes-human-plus-ten");
    }

    if (beforePlusSix > afterPlusSix) {
      humanAttackDelta += 520 * (beforePlusSix - afterPlusSix);
      reasons.push("mischief:swap-removes-human-plus-six");
    }

    if (afterPlusTen > beforePlusTen) {
      teamDelta -= 2_200 * (afterPlusTen - beforePlusTen);
      reasons.push("mischief:avoid-giving-human-plus-ten");
    }

    if (afterPlusSix > beforePlusSix) {
      teamDelta -= 1_250 * (afterPlusSix - beforePlusSix);
      reasons.push("mischief:avoid-giving-human-plus-six");
    }

    if (entry.beforeHandCount >= 7 && entry.afterHandCount < entry.beforeHandCount) {
      teamDelta -= (entry.beforeHandCount - entry.afterHandCount) * 180;
      reasons.push("mischief:avoid-shrinking-large-human-hand");
    }

    if (afterThreat > beforeThreat) {
      teamDelta -= Math.round((afterThreat - beforeThreat) * 0.45);
      reasons.push("mischief:avoid-strengthening-human-team");
    }
  }

  if (anyHumanHadPlusTen) {
    teamDelta = Math.max(teamDelta, -420);
  }

  return {
    humanAttackDelta,
    teamDelta,
    reasons
  };
}

function analyzeHumanUpstreamDrawPressure(
  state: GameState,
  playerId: PlayerId,
  playedCard: Card
): UpstreamDrawPressureAnalysis {
  if (playedCard.kind !== "draw-two" && playedCard.kind !== "draw-four") {
    return { bonus: 0, reasons: [] };
  }

  const immediateTarget = getNextActivePlayer(state, playerId, state.direction);

  if (!isHumanPlayer(immediateTarget)) {
    return { bonus: 0, reasons: [] };
  }

  const responseKind = playedCard.kind;
  const matchingResponses = immediateTarget.hand.filter((card) => card.kind === responseKind).length;
  const nextAfterHuman = getNextActivePlayer(state, immediateTarget.id, state.direction);

  let bonus =
    playedCard.kind === "draw-two"
      ? MISCHIEF_UPSTREAM_DRAW_TWO_HUMAN_PRESSURE
      : MISCHIEF_UPSTREAM_DRAW_FOUR_HUMAN_PRESSURE;
  const reasons = ["mischief:upstream-human-pressure"];

  if (matchingResponses > 0) {
    bonus += matchingResponses * 70;
    reasons.push("mischief:force-human-plus-spend");
  }

  if (nextAfterHuman?.isBot === true) {
    const robotCanContinue = nextAfterHuman.hand.some((card) =>
      canStackDrawCard({
        nextCard: card,
        previousDrawValue: playedCard.drawValue ?? (playedCard.kind === "draw-four" ? 4 : 2),
        previousDrawKind: playedCard.kind as DrawCardKind,
        ...(playedCard.color === undefined ? {} : { currentColor: playedCard.color })
      })
    );

    if (robotCanContinue) {
      bonus += MISCHIEF_UPSTREAM_DRAW_RELAY_BONUS;
      reasons.push("mischief:upstream-robot-can-relay");
    } else if (matchingResponses > 0) {
      bonus -= MISCHIEF_UPSTREAM_DRAW_ROBOT_TRAP_PENALTY;
      reasons.push("mischief:avoid-upstream-robot-trap");
    }
  }

  return { bonus, reasons };
}

function getPunishReserveCost(card: Card): number {
  switch (card.kind) {
    case "wild-draw-ten":
      return MISCHIEF_PLUS_TEN_RESERVE_COST;
    case "wild-draw-six":
      return MISCHIEF_PLUS_SIX_RESERVE_COST;
    case "wild-reverse-draw-four":
      return MISCHIEF_REVERSE_PLUS_FOUR_RESERVE_COST;
    case "penalty-draw":
      return MISCHIEF_PENALTY_DRAW_RESERVE_COST;
    case "draw-four":
      return MISCHIEF_DRAW_FOUR_RESERVE_COST;
    case "draw-two":
      return MISCHIEF_DRAW_TWO_RESERVE_COST;
    default:
      return 0;
  }
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
