import { fileURLToPath } from "node:url";
import { formatBatchSimulationReport, batchSimulate } from "./batchSimulate";
import { formatSimulationSummary } from "./logger/simulationLogger";
import { simulateGame } from "./simulateGame";
import type {
  BatchSimulationOptions,
  SimulationOptions
} from "./simulationTypes";

export function runCli(argv: readonly string[] = process.argv.slice(2)): number {
  const [subcommand, ...rest] = argv;

  if (subcommand !== "simulate" && subcommand !== "batch") {
    console.error(
      "Usage: simulate|batch --players <3-8> --mode <with-challenge|no-challenge> [--seed <n>] [--max-steps <n>] [--verbose] [--auto-uno true|false] [--challenge-rate <0-1>] [--games <n>]"
    );
    return 1;
  }

  const args = parseArgs(rest);

  if (subcommand === "simulate") {
    const options = parseSimulationOptions(args);
    const result = simulateGame(options);

    for (const line of result.logs) {
      console.log(line);
    }

    console.log(formatSimulationSummary(result));
    return result.status === "failed-invariant" ? 1 : 0;
  }

  const options = parseBatchOptions(args);
  const report = batchSimulate(options);

  console.log(formatBatchSimulationReport(report));

  if (report.failedSeeds.length > 0) {
    console.log(`failedSeeds=${report.failedSeeds.join(",")}`);
  }

  return report.failedInvariantGames > 0 ? 1 : 0;
}

const entryFilePath = process.argv[1];

if (
  entryFilePath !== undefined &&
  fileURLToPath(import.meta.url) === entryFilePath
) {
  process.exitCode = runCli();
}

function parseSimulationOptions(
  args: Record<string, string | boolean>
): SimulationOptions {
  const playerCount = parseNumberArg(args.players, "players", 4);
  const maxSteps = parseNumberArg(args["max-steps"], "max-steps", 1000);

  assertIntegerInRange(playerCount, "players", 3, 8);
  assertIntegerAtLeast(maxSteps, "max-steps", 1);

  return {
    playerCount,
    mode: parseModeArg(args.mode),
    seed: parseSeedArg(args.seed, 1001),
    maxSteps,
    verbose: parseBooleanArg(args.verbose, false),
    verboseDebug: parseBooleanArg(args["verbose-debug"], false),
    autoUno: parseBooleanArg(args["auto-uno"], true),
    challengeRate: parseFloatArg(args["challenge-rate"], "challenge-rate", 0.3)
  };
}

function parseBatchOptions(
  args: Record<string, string | boolean>
): BatchSimulationOptions {
  const simulationOptions = parseSimulationOptions(args);
  const seedBase = parseSeedArg(args.seed, 1);
  const games = parseNumberArg(args.games, "games", 20);

  if (typeof seedBase !== "number") {
    throw new Error("batch mode requires a numeric --seed base or no seed.");
  }

  assertIntegerAtLeast(games, "games", 1);

  return {
    ...simulationOptions,
    games,
    seedBase
  };
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

function parseModeArg(
  value: string | boolean | undefined
): SimulationOptions["mode"] {
  if (value === "with-challenge" || value === "no-challenge") {
    return value;
  }

  return "no-challenge";
}

function parseNumberArg(
  value: string | boolean | undefined,
  key: string,
  fallback: number
): number {
  if (value === undefined || value === true) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid numeric argument for --${key}.`);
  }

  return parsed;
}

function parseFloatArg(
  value: string | boolean | undefined,
  key: string,
  fallback: number
): number {
  const parsed = parseNumberArg(value, key, fallback);

  if (parsed < 0 || parsed > 1) {
    throw new Error(`--${key} must be between 0 and 1.`);
  }

  return parsed;
}

function parseBooleanArg(
  value: string | boolean | undefined,
  fallback: boolean
): boolean {
  if (value === undefined) {
    return fallback;
  }

  if (value === true) {
    return true;
  }

  return value === "true";
}

function parseSeedArg(
  value: string | boolean | undefined,
  fallback: string | number
): string | number {
  if (value === undefined || value === true) {
    return fallback;
  }

  const numericValue = Number(value);

  if (Number.isFinite(numericValue)) {
    return numericValue;
  }

  if (typeof value === "string") {
    return value;
  }

  return fallback;
}

function assertIntegerInRange(
  value: number,
  key: string,
  minimum: number,
  maximum: number
): void {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`--${key} must be an integer between ${String(minimum)} and ${String(maximum)}.`);
  }
}

function assertIntegerAtLeast(
  value: number,
  key: string,
  minimum: number
): void {
  if (!Number.isInteger(value) || value < minimum) {
    throw new Error(`--${key} must be an integer greater than or equal to ${String(minimum)}.`);
  }
}
