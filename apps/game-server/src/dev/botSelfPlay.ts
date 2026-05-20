import { fileURLToPath } from "node:url";
import { applyCommand, createInitialGame } from "@thunder-uno/uno-core";
import type {
  GameCommand,
  GameCommandType,
  GameEvent,
  GameMode,
  GamePlayerState,
  PlayerId
} from "@thunder-uno/shared-types";
import { dispatchBotStrategy } from "../bot/strategies/dispatchBotStrategy";
import {
  DEFAULT_BOT_SCORING_WEIGHTS,
  type BotScoringWeights
} from "../bot/botScoring";

const DEFAULT_PLAYER_COUNT = 3;
const DEFAULT_GAMES = 50;
const DEFAULT_MAX_STEPS = 1_500;
const DEFAULT_FORGET_UNO_RATE = 0.2;

export interface GreedyBotSelfPlayOptions {
  playerCount?: number;
  seed: string | number;
  maxSteps?: number;
  forgetUnoRate?: number;
  verbose?: boolean;
  weightsByPlayerId?: Readonly<Partial<Record<PlayerId, BotScoringWeights>>>;
}

export interface GreedyBotSelfPlayResult {
  status: "finished" | "stuck" | "rejected";
  seed: string | number;
  steps: number;
  winnerPlayerIds: PlayerId[];
  rejectedCommandCount: number;
  unoPendingCount: number;
  unoCalledCount: number;
  commandCounts: Record<string, number>;
  reasonCounts: Record<string, number>;
  maxHandCount: number;
  finalHandCounts: Record<string, number>;
  logs: string[];
  stuckReason?: string;
}

export interface GreedyBotBatchOptions {
  games?: number;
  seedBase?: number;
  playerCount?: number;
  maxSteps?: number;
  forgetUnoRate?: number;
  verboseFailures?: boolean;
}

export interface GreedyBotBatchReport {
  games: number;
  finishedGames: number;
  stuckGames: number;
  rejectedGames: number;
  averageSteps: number;
  averageMaxHandCount: number;
  winnerCounts: Record<string, number>;
  commandCounts: Record<string, number>;
  reasonCounts: Record<string, number>;
  failedSeeds: Array<string | number>;
  results: GreedyBotSelfPlayResult[];
}

export interface GreedyBotWeightEvaluationOptions {
  games?: number;
  seedBase?: number;
  playerCount?: number;
  maxSteps?: number;
  forgetUnoRate?: number;
  contenderWeights: BotScoringWeights;
}

export interface GreedyBotWeightEvaluationReport {
  games: number;
  seatRotatedGames: number;
  contenderWins: number;
  contenderWinRate: number;
  finishedGames: number;
  stuckGames: number;
  rejectedGames: number;
  averageSteps: number;
  failedSeeds: Array<string | number>;
}

export function simulateGreedyBotSelfPlay(
  options: GreedyBotSelfPlayOptions
): GreedyBotSelfPlayResult {
  const playerCount = options.playerCount ?? DEFAULT_PLAYER_COUNT;
  const maxSteps = options.maxSteps ?? DEFAULT_MAX_STEPS;
  const forgetUnoRate = options.forgetUnoRate ?? DEFAULT_FORGET_UNO_RATE;
  const random = createSeededRandom(options.seed);
  const players = createBotPlayers(playerCount);
  let state = createInitialGame({
    roomId: `bot-self-play-${String(options.seed)}`,
    players,
    mode: "no-challenge" satisfies GameMode,
    seed: options.seed,
    now: 0,
    snapshotVersion: 1
  });
  let now = 0;
  let rejectedCommandCount = 0;
  let unoPendingCount = 0;
  let unoCalledCount = 0;
  let maxHandCount = Math.max(...state.players.map((player) => player.handCount));
  const commandCounts: Record<string, number> = {};
  const reasonCounts: Record<string, number> = {};
  const logs: string[] = [];

  for (let step = 1; step <= maxSteps; step += 1) {
    if (state.status === "finished") {
      return buildSelfPlayResult({
        status: "finished",
        seed: options.seed,
        steps: step - 1,
        state,
        rejectedCommandCount,
        unoPendingCount,
        unoCalledCount,
        commandCounts,
        reasonCounts,
        maxHandCount,
        logs
      });
    }

    const currentPlayer = state.players.find(
      (player) => player.id === state.currentPlayerId
    );

    if (currentPlayer === undefined) {
      return buildSelfPlayResult({
        status: "stuck",
        seed: options.seed,
        steps: step - 1,
        state,
        rejectedCommandCount,
        unoPendingCount,
        unoCalledCount,
        commandCounts,
        reasonCounts,
        maxHandCount,
        logs,
        stuckReason: "current player is missing"
      });
    }

    const command =
      state.initialDirectionChoice?.active === true
        ? ({
            type: "choose-initial-direction",
            playerId: currentPlayer.id,
            direction: random() < 0.5 ? "clockwise" : "counter-clockwise"
          } satisfies GameCommand)
        : dispatchBotStrategy({
            strategy: "greedy-v1",
            state,
            playerId: currentPlayer.id,
            forgetUnoRate,
            random,
            ...(options.weightsByPlayerId?.[currentPlayer.id] === undefined
              ? {}
              : { weights: options.weightsByPlayerId[currentPlayer.id] })
          });

    if (command === null) {
      return buildSelfPlayResult({
        status: "stuck",
        seed: options.seed,
        steps: step - 1,
        state,
        rejectedCommandCount,
        unoPendingCount,
        unoCalledCount,
        commandCounts,
        reasonCounts,
        maxHandCount,
        logs,
        stuckReason: "bot returned no decision"
      });
    }

    const decisionCommand = "command" in command ? command.command : command;
    const willCallUno = "command" in command ? command.willCallUno : false;

    now += 1_000;
    const execution = applyCommand(state, withTimestamp(decisionCommand, now));
    increment(commandCounts, decisionCommand.type);

    if ("reasons" in command) {
      for (const reason of command.reasons) {
        increment(reasonCounts, reason);
      }
    }

    rejectedCommandCount += countEvents(execution.events, "command-rejected");
    unoPendingCount += countEvents(execution.events, "uno-pending");
    unoCalledCount += countEvents(execution.events, "uno-called");

    if (options.verbose) {
      logs.push(
        `${String(step).padStart(4, "0")} ${decisionCommand.playerId} ${decisionCommand.type}`
      );
    }

    state = execution.state;
    maxHandCount = Math.max(
      maxHandCount,
      ...state.players.map((player) => player.handCount)
    );

    if (execution.events.some((event) => event.type === "command-rejected")) {
      return buildSelfPlayResult({
        status: "rejected",
        seed: options.seed,
        steps: step,
        state,
        rejectedCommandCount,
        unoPendingCount,
        unoCalledCount,
        commandCounts,
        reasonCounts,
        maxHandCount,
        logs,
        stuckReason: `rejected command: ${decisionCommand.type}`
      });
    }

    if (willCallUno) {
      now += 250;
      const unoExecution = applyCommand(state, {
        type: "say-uno",
        playerId: decisionCommand.playerId,
        timestampMs: now
      });
      increment(commandCounts, "say-uno");
      rejectedCommandCount += countEvents(unoExecution.events, "command-rejected");
      unoCalledCount += countEvents(unoExecution.events, "uno-called");
      state = unoExecution.state;

      if (unoExecution.events.some((event) => event.type === "command-rejected")) {
        return buildSelfPlayResult({
          status: "rejected",
          seed: options.seed,
          steps: step,
          state,
          rejectedCommandCount,
          unoPendingCount,
          unoCalledCount,
          commandCounts,
          reasonCounts,
          maxHandCount,
          logs,
          stuckReason: "rejected command: say-uno"
        });
      }
    }
  }

  return buildSelfPlayResult({
    status: "stuck",
    seed: options.seed,
    steps: maxSteps,
    state,
    rejectedCommandCount,
    unoPendingCount,
    unoCalledCount,
    commandCounts,
    reasonCounts,
    maxHandCount,
    logs,
    stuckReason: `max steps reached: ${String(maxSteps)}`
  });
}

export function evaluateGreedyBotWeights(
  options: GreedyBotWeightEvaluationOptions
): GreedyBotWeightEvaluationReport {
  const games = options.games ?? DEFAULT_GAMES;
  const playerCount = options.playerCount ?? DEFAULT_PLAYER_COUNT;
  const results: GreedyBotSelfPlayResult[] = [];
  let contenderWins = 0;

  for (let gameIndex = 0; gameIndex < games; gameIndex += 1) {
    for (let seatIndex = 0; seatIndex < playerCount; seatIndex += 1) {
      const contenderPlayerId = `bot-${String(seatIndex + 1)}`;
      const seed = (options.seedBase ?? 1) + gameIndex;
      const result = simulateGreedyBotSelfPlay({
        seed,
        playerCount,
        maxSteps: options.maxSteps ?? DEFAULT_MAX_STEPS,
        forgetUnoRate: options.forgetUnoRate ?? DEFAULT_FORGET_UNO_RATE,
        weightsByPlayerId: {
          [contenderPlayerId]: options.contenderWeights
        }
      });

      results.push(result);

      if (result.winnerPlayerIds.includes(contenderPlayerId)) {
        contenderWins += 1;
      }
    }
  }

  const seatRotatedGames = results.length;

  return {
    games,
    seatRotatedGames,
    contenderWins,
    contenderWinRate: contenderWins / Math.max(1, seatRotatedGames),
    finishedGames: results.filter((result) => result.status === "finished").length,
    stuckGames: results.filter((result) => result.status === "stuck").length,
    rejectedGames: results.filter((result) => result.status === "rejected").length,
    averageSteps: average(results.map((result) => result.steps)),
    failedSeeds: results
      .filter((result) => result.status !== "finished")
      .map((result) => result.seed)
  };
}

export function createPressureTunedWeights(): BotScoringWeights {
  return {
    ...DEFAULT_BOT_SCORING_WEIGHTS,
    nextPlayerOneCardDangerBonus: 620,
    nextPlayerTwoCardsDangerBonus: 370,
    nextPlayerFourCardsDangerBonus: 180,
    nonPressureDangerPenaltyRatio: 0.55,
    drawTwoPressure: 145,
    drawFourPressure: 210,
    wildReverseDrawFourPressure: 300,
    penaltyDrawPressure: 320,
    reserveWildDrawSixCost: 180,
    reserveWildDrawTenCost: 300
  };
}

export function runGreedyBotBatch(
  options: GreedyBotBatchOptions = {}
): GreedyBotBatchReport {
  const games = options.games ?? DEFAULT_GAMES;
  const seedBase = options.seedBase ?? 1;
  const results: GreedyBotSelfPlayResult[] = [];

  for (let index = 0; index < games; index += 1) {
    results.push(
      simulateGreedyBotSelfPlay({
        seed: seedBase + index,
        playerCount: options.playerCount ?? DEFAULT_PLAYER_COUNT,
        maxSteps: options.maxSteps ?? DEFAULT_MAX_STEPS,
        forgetUnoRate: options.forgetUnoRate ?? DEFAULT_FORGET_UNO_RATE
      })
    );
  }

  const commandCounts: Record<string, number> = {};
  const reasonCounts: Record<string, number> = {};
  const winnerCounts: Record<string, number> = {};

  for (const result of results) {
    mergeCounts(commandCounts, result.commandCounts);
    mergeCounts(reasonCounts, result.reasonCounts);

    for (const winnerPlayerId of result.winnerPlayerIds) {
      increment(winnerCounts, winnerPlayerId);
    }
  }

  return {
    games,
    finishedGames: results.filter((result) => result.status === "finished").length,
    stuckGames: results.filter((result) => result.status === "stuck").length,
    rejectedGames: results.filter((result) => result.status === "rejected").length,
    averageSteps: average(results.map((result) => result.steps)),
    averageMaxHandCount: average(results.map((result) => result.maxHandCount)),
    winnerCounts,
    commandCounts,
    reasonCounts,
    failedSeeds: results
      .filter((result) => result.status !== "finished")
      .map((result) => result.seed),
    results
  };
}

export function formatGreedyBotBatchReport(report: GreedyBotBatchReport): string {
  const lines = [
    "Greedy bot self-play report",
    `games=${String(report.games)} finished=${String(report.finishedGames)} stuck=${String(report.stuckGames)} rejected=${String(report.rejectedGames)}`,
    `avgSteps=${report.averageSteps.toFixed(1)} avgMaxHandCount=${report.averageMaxHandCount.toFixed(1)}`,
    `winners=${formatCounts(report.winnerCounts)}`,
    `commands=${formatCounts(report.commandCounts)}`,
    `reasons=${formatCounts(report.reasonCounts)}`
  ];

  if (report.failedSeeds.length > 0) {
    lines.push(`failedSeeds=${report.failedSeeds.join(",")}`);
  }

  lines.push(...formatTuningHints(report));

  return lines.join("\n");
}

export function formatGreedyBotWeightEvaluationReport(
  report: GreedyBotWeightEvaluationReport
): string {
  const lines = [
    "Greedy bot weight evaluation",
    `baseGames=${String(report.games)} seatRotatedGames=${String(report.seatRotatedGames)}`,
    `contenderWins=${String(report.contenderWins)} contenderWinRate=${(report.contenderWinRate * 100).toFixed(1)}%`,
    `finished=${String(report.finishedGames)} stuck=${String(report.stuckGames)} rejected=${String(report.rejectedGames)}`,
    `avgSteps=${report.averageSteps.toFixed(1)}`
  ];

  if (report.failedSeeds.length > 0) {
    lines.push(`failedSeeds=${report.failedSeeds.join(",")}`);
  }

  return lines.join("\n");
}

export function runCli(argv: readonly string[] = process.argv.slice(2)): number {
  const args = parseArgs(argv);

  if (args.evaluate === "pressure") {
    const report = evaluateGreedyBotWeights({
      games: parseIntegerArg(args.games, DEFAULT_GAMES),
      seedBase: parseIntegerArg(args.seed, 1),
      playerCount: parseIntegerArg(args.players, DEFAULT_PLAYER_COUNT),
      maxSteps: parseIntegerArg(args["max-steps"], DEFAULT_MAX_STEPS),
      forgetUnoRate: parseFloatArg(args["forget-uno-rate"], DEFAULT_FORGET_UNO_RATE),
      contenderWeights: createPressureTunedWeights()
    });

    console.log(formatGreedyBotWeightEvaluationReport(report));
    return report.rejectedGames > 0 ? 1 : 0;
  }

  const report = runGreedyBotBatch({
    games: parseIntegerArg(args.games, DEFAULT_GAMES),
    seedBase: parseIntegerArg(args.seed, 1),
    playerCount: parseIntegerArg(args.players, DEFAULT_PLAYER_COUNT),
    maxSteps: parseIntegerArg(args["max-steps"], DEFAULT_MAX_STEPS),
    forgetUnoRate: parseFloatArg(args["forget-uno-rate"], DEFAULT_FORGET_UNO_RATE)
  });

  console.log(formatGreedyBotBatchReport(report));
  return report.rejectedGames > 0 ? 1 : 0;
}

const entryFilePath = process.argv[1];

if (
  entryFilePath !== undefined &&
  fileURLToPath(import.meta.url) === entryFilePath
) {
  process.exitCode = runCli();
}

function buildSelfPlayResult(params: {
  status: GreedyBotSelfPlayResult["status"];
  seed: string | number;
  steps: number;
  state: ReturnType<typeof createInitialGame>;
  rejectedCommandCount: number;
  unoPendingCount: number;
  unoCalledCount: number;
  commandCounts: Record<string, number>;
  reasonCounts: Record<string, number>;
  maxHandCount: number;
  logs: string[];
  stuckReason?: string;
}): GreedyBotSelfPlayResult {
  return {
    status: params.status,
    seed: params.seed,
    steps: params.steps,
    winnerPlayerIds: [...params.state.winnerPlayerIds],
    rejectedCommandCount: params.rejectedCommandCount,
    unoPendingCount: params.unoPendingCount,
    unoCalledCount: params.unoCalledCount,
    commandCounts: { ...params.commandCounts },
    reasonCounts: { ...params.reasonCounts },
    maxHandCount: params.maxHandCount,
    finalHandCounts: Object.fromEntries(
      params.state.players.map((player) => [player.id, player.handCount])
    ),
    logs: [...params.logs],
    ...(params.stuckReason === undefined ? {} : { stuckReason: params.stuckReason })
  };
}

function createBotPlayers(playerCount: number): GamePlayerState[] {
  return Array.from({ length: playerCount }, (_, index) => {
    const playerNumber = index + 1;

    return {
      id: `bot-${String(playerNumber)}`,
      displayName: `Self-play Bot ${String(playerNumber)}`,
      avatarUrl: null,
      isBot: true,
      hand: [],
      handCount: 0,
      hasCalledUno: false,
      unoPendingSinceMs: null,
      unoProtectionStartedAtMs: null,
      unoProtectionEndsAtMs: null,
      isEliminated: false,
      isRoundWinner: false,
      hasLeftRoom: false,
      eliminationReason: null
    };
  });
}

function withTimestamp(command: GameCommand, timestampMs: number): GameCommand {
  return {
    ...command,
    timestampMs
  };
}

function countEvents<TType extends GameEvent["type"]>(
  events: readonly GameEvent[],
  type: TType
): number {
  return events.filter((event) => event.type === type).length;
}

function increment(counts: Record<string, number>, key: string): void {
  counts[key] = (counts[key] ?? 0) + 1;
}

function mergeCounts(
  target: Record<string, number>,
  source: Readonly<Record<string, number>>
): void {
  for (const [key, value] of Object.entries(source)) {
    target[key] = (target[key] ?? 0) + value;
  }
}

function average(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatCounts(counts: Readonly<Record<string, number>>): string {
  const entries = Object.entries(counts).sort((left, right) => right[1] - left[1]);

  if (entries.length === 0) {
    return "(none)";
  }

  return entries.map(([key, value]) => `${key}:${String(value)}`).join(" ");
}

function formatTuningHints(report: GreedyBotBatchReport): string[] {
  const hints = ["tuningHints:"];
  const drawCount = report.commandCounts["draw-card"] ?? 0;
  const playCount = getPlayCommandCount(report.commandCounts);
  const drawRatio = drawCount / Math.max(1, drawCount + playCount);

  if (report.rejectedGames > 0) {
    hints.push("- rejected commands appeared; inspect failed seeds before changing weights.");
  }

  if (report.stuckGames > 0) {
    hints.push("- stuck games appeared; replay failed seeds with --max-steps raised and verbose logging.");
  }

  if (drawRatio > 0.35) {
    hints.push("- draw-card ratio is high; consider raising color-control or combo-preservation scores.");
  }

  if ((report.commandCounts["play-discard-same-color"] ?? 0) === 0) {
    hints.push("- discard-same-color was never selected; its reserve penalty may be too strong.");
  }

  if (report.averageSteps > 450) {
    hints.push("- games are long on average; consider increasing multi-card reduction bonuses.");
  }

  if (hints.length === 1) {
    hints.push("- no obvious red flags in this batch.");
  }

  return hints;
}

function getPlayCommandCount(
  commandCounts: Readonly<Record<string, number>>
): number {
  const playTypes: GameCommandType[] = [
    "play-card",
    "play-sequence",
    "play-multiple-number",
    "play-discard-same-color"
  ];

  return playTypes.reduce((sum, type) => sum + (commandCounts[type] ?? 0), 0);
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

function parseFloatArg(
  value: string | boolean | undefined,
  fallback: number
): number {
  if (value === undefined || value === true) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new Error(`Expected numeric argument, got ${String(value)}.`);
  }

  return parsed;
}

function createSeededRandom(seed: string | number): () => number {
  let state = normalizeSeed(seed);

  return () => {
    state += 0x6d2b79f5;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

function normalizeSeed(seed: string | number): number {
  if (typeof seed === "number") {
    return seed >>> 0;
  }

  let hashed = 2166136261;

  for (const character of seed) {
    hashed ^= character.charCodeAt(0);
    hashed = Math.imul(hashed, 16777619);
  }

  return hashed >>> 0;
}
