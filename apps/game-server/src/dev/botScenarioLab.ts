import { fileURLToPath } from "node:url";
import {
  createBlackCard,
  createColoredActionCard,
  createInitialGame,
  createNumberCard,
  type Card
} from "@thunder-uno/uno-core";
import type {
  BlackCardKind,
  CardColor,
  CardNumber,
  ColoredActionCardKind,
  GameState,
  PlayerId,
  TurnDirection
} from "@thunder-uno/shared-types";
import { generateBotCandidates } from "../bot/botCandidates";
import {
  DEFAULT_BOT_SCORING_WEIGHTS,
  scoreBotCandidates,
  type BotScoringWeights,
  type ScoredBotAction
} from "../bot/botScoring";
import { createPressureTunedWeights } from "./botSelfPlay";

export type CardSpec =
  | `${CardColor}-${CardNumber}`
  | `${CardColor}-${ColoredActionCardKind}`
  | BlackCardKind;

export interface BotScenarioDefinition {
  name: string;
  currentPlayerId?: PlayerId;
  direction?: TurnDirection;
  topCard: CardSpec;
  currentColor: CardColor;
  hands: Record<PlayerId, CardSpec[]>;
  drawPile?: CardSpec[];
}

export interface BotScenarioEvaluation {
  scenarioName: string;
  currentPlayerId: PlayerId;
  topActions: ScenarioActionScore[];
}

export interface ScenarioActionScore {
  rank: number;
  score: number;
  command: string;
  cards: string[];
  reasons: string[];
  resultingHandCount: number;
}

const SAMPLE_SCENARIOS: Record<string, BotScenarioDefinition> = {
  pressure: {
    name: "pressure",
    currentPlayerId: "bot-1",
    direction: "clockwise",
    topCard: "red-5",
    currentColor: "red",
    hands: {
      "bot-1": ["red-9", "red-skip", "red-draw-two", "wild-draw-six"],
      "bot-2": ["blue-1"],
      "bot-3": ["green-4", "yellow-4", "blue-7", "wild"]
    },
    drawPile: ["yellow-1", "blue-2", "green-3"]
  },
  blackReserve: {
    name: "blackReserve",
    currentPlayerId: "bot-1",
    direction: "clockwise",
    topCard: "blue-4",
    currentColor: "blue",
    hands: {
      "bot-1": ["blue-8", "blue-reverse", "wild-draw-six", "wild-draw-ten"],
      "bot-2": ["red-1", "yellow-2", "green-3", "blue-5", "wild"],
      "bot-3": ["green-4", "green-5", "yellow-7"]
    },
    drawPile: ["red-9", "yellow-9"]
  },
  discardSameColor: {
    name: "discardSameColor",
    currentPlayerId: "bot-1",
    direction: "clockwise",
    topCard: "green-2",
    currentColor: "green",
    hands: {
      "bot-1": [
        "green-discard-same-color",
        "green-0",
        "green-3",
        "green-skip",
        "red-8",
        "blue-8",
        "wild"
      ],
      "bot-2": ["red-1", "yellow-2", "blue-3", "green-4"],
      "bot-3": ["red-4", "yellow-5", "blue-6"]
    },
    drawPile: ["red-9", "yellow-9"]
  }
};

export function evaluateBotScenario(params: {
  scenario: BotScenarioDefinition;
  weights?: BotScoringWeights;
  random?: () => number;
  limit?: number;
}): BotScenarioEvaluation {
  const state = createScenarioState(params.scenario);
  const currentPlayerId = params.scenario.currentPlayerId ?? Object.keys(params.scenario.hands)[0]!;
  const candidates = generateBotCandidates(state, currentPlayerId);
  const scored = scoreBotCandidates(
    state,
    currentPlayerId,
    candidates,
    params.random ?? (() => 0),
    params.weights ?? DEFAULT_BOT_SCORING_WEIGHTS
  );

  return {
    scenarioName: params.scenario.name,
    currentPlayerId,
    topActions: scored.slice(0, params.limit ?? 10).map((action, index) => {
      const player = action.resultingState.players.find(
        (candidate) => candidate.id === currentPlayerId
      );

      return {
        rank: index + 1,
        score: Math.round(action.score * 10) / 10,
        command: formatCommand(action),
        cards: action.cardIds,
        reasons: [...action.reasons],
        resultingHandCount: player?.handCount ?? -1
      };
    })
  };
}

export function formatBotScenarioEvaluation(evaluation: BotScenarioEvaluation): string {
  return [
    `Scenario ${evaluation.scenarioName} | current=${evaluation.currentPlayerId}`,
    ...evaluation.topActions.map((action) => {
      return [
        `${String(action.rank).padStart(2, "0")}.`,
        `score=${String(action.score).padStart(6, " ")}`,
        `hand=${String(action.resultingHandCount).padStart(2, " ")}`,
        action.command,
        `reasons=${action.reasons.join(",")}`
      ].join(" ");
    })
  ].join("\n");
}

export function runCli(argv: readonly string[] = process.argv.slice(2)): number {
  const args = parseArgs(argv);
  const scenarioName = typeof args.scenario === "string" ? args.scenario : "pressure";
  const scenario = SAMPLE_SCENARIOS[scenarioName];

  if (scenario === undefined) {
    console.error(`Unknown scenario: ${scenarioName}`);
    console.error(`Available scenarios: ${Object.keys(SAMPLE_SCENARIOS).join(", ")}`);
    return 1;
  }

  const weights =
    args.weights === "pressure" ? createPressureTunedWeights() : DEFAULT_BOT_SCORING_WEIGHTS;
  const evaluation = evaluateBotScenario({
    scenario,
    weights,
    limit: parseIntegerArg(args.limit, 10)
  });

  console.log(formatBotScenarioEvaluation(evaluation));
  return 0;
}

const entryFilePath = process.argv[1];

if (
  entryFilePath !== undefined &&
  fileURLToPath(import.meta.url) === entryFilePath
) {
  process.exitCode = runCli();
}

function createScenarioState(scenario: BotScenarioDefinition): GameState {
  const playerIds = Object.keys(scenario.hands);
  const state = createInitialGame({
    roomId: `bot-scenario-${scenario.name}`,
    players: playerIds.map((playerId) => {
      return {
        id: playerId,
        displayName: playerId,
        isBot: true
      };
    }),
    mode: "no-challenge",
    seed: `bot-scenario-${scenario.name}`,
    now: 0,
    snapshotVersion: 1
  });
  const topCard = createCardFromSpec(`top-${scenario.name}`, scenario.topCard);

  state.initialDirectionChoice = {
    active: false,
    chooserPlayerId: null
  };
  state.direction = scenario.direction ?? "clockwise";
  state.currentPlayerId = scenario.currentPlayerId ?? playerIds[0]!;
  state.currentColor = scenario.currentColor;
  state.topCard = topCard;
  state.discardPile = [topCard];
  state.drawPile = (scenario.drawPile ?? ["red-0", "yellow-0", "blue-0", "green-0"]).map(
    (spec, index) => createCardFromSpec(`draw-${spec}-${index}`, spec)
  );
  state.playerOrder = [...playerIds];

  for (const player of state.players) {
    const hand = scenario.hands[player.id] ?? [];
    player.hand = hand.map((spec, index) =>
      createCardFromSpec(`${player.id}-${spec}-${index}`, spec)
    );
    player.handCount = player.hand.length;
    player.hasCalledUno = false;
    player.unoPendingSinceMs = null;
    player.unoProtectionStartedAtMs = null;
    player.unoProtectionEndsAtMs = null;
  }

  return state;
}

function createCardFromSpec(id: string, spec: CardSpec): Card {
  const parts = spec.split("-");

  if (isCardColor(parts[0]) && parts.length === 2 && isCardNumber(parts[1])) {
    return createNumberCard(id, parts[0], Number(parts[1]) as CardNumber);
  }

  if (isCardColor(parts[0])) {
    const kind = parts.slice(1).join("-");

    if (isColoredActionCardKind(kind)) {
      return createColoredActionCard(id, parts[0], kind);
    }
  }

  if (isBlackCardKind(spec)) {
    return createBlackCard(id, spec);
  }

  throw new Error(`Unsupported card spec: ${spec}`);
}

function formatCommand(action: ScoredBotAction): string {
  const command = action.command;

  switch (command.type) {
    case "play-card":
      return `${command.type}:${command.cardId}${command.declaredColor === undefined ? "" : `->${command.declaredColor}`}`;
    case "play-sequence":
    case "play-multiple-number":
      return `${command.type}:${command.cardIds.join("+")}`;
    case "play-discard-same-color":
      return `${command.type}:${command.mainCardId}+${command.attachedCardIds.join("+")}`;
    default:
      return command.type;
  }
}

function parseArgs(argv: readonly string[]): Record<string, string | boolean> {
  const parsed: Record<string, string | boolean> = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === undefined || !token.startsWith("--")) {
      continue;
    }

    const key = token.slice(2);
    const nextToken = argv[index + 1];

    if (nextToken === undefined || nextToken.startsWith("--")) {
      parsed[key] = true;
      continue;
    }

    parsed[key] = nextToken;
    index += 1;
  }

  return parsed;
}

function parseIntegerArg(
  value: string | boolean | undefined,
  fallback: number
): number {
  if (value === undefined || value === true) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed)) {
    throw new Error(`Expected integer argument, got ${String(value)}.`);
  }

  return parsed;
}

function isCardColor(value: string | undefined): value is CardColor {
  return value === "red" || value === "yellow" || value === "blue" || value === "green";
}

function isCardNumber(value: string | undefined): value is `${CardNumber}` {
  return (
    value === "0" ||
    value === "1" ||
    value === "2" ||
    value === "3" ||
    value === "4" ||
    value === "5" ||
    value === "6" ||
    value === "7" ||
    value === "8" ||
    value === "9"
  );
}

function isColoredActionCardKind(value: string): value is ColoredActionCardKind {
  return (
    value === "draw-two" ||
    value === "draw-four" ||
    value === "skip" ||
    value === "reverse" ||
    value === "discard-same-color" ||
    value === "swap-hands"
  );
}

function isBlackCardKind(value: string): value is BlackCardKind {
  return (
    value === "wild" ||
    value === "penalty-draw" ||
    value === "wild-reverse-draw-four" ||
    value === "wild-draw-six" ||
    value === "wild-draw-ten"
  );
}
