import type {
  ApplyCommandResult,
  GameCommand,
  GameEvent,
  GameMode,
  GameState,
  PlayerId
} from "@thunder-uno/shared-types";

export interface SimulationOptions {
  playerCount: number;
  mode: GameMode;
  seed: string | number;
  maxSteps: number;
  verbose: boolean;
  verboseDebug: boolean;
  autoUno: boolean;
  challengeRate: number;
}

export interface SimulationStepRecord {
  step: number;
  command: GameCommand;
  result: ApplyCommandResult;
}

export interface InvariantFailureContext {
  seed: string | number;
  step: number;
  playerCount: number;
  mode: GameMode;
  lastCommand: GameCommand | null;
  recentEvents: GameEvent[];
  state: GameState;
}

export interface InvariantResult {
  valid: boolean;
  reason?: string;
  summary?: string;
}

export type SimulationStatus = "finished" | "stuck" | "failed-invariant";

export interface SimulationResult {
  status: SimulationStatus;
  seed: string | number;
  playerCount: number;
  mode: GameMode;
  steps: number;
  winnerPlayerIds: PlayerId[];
  eliminatedPlayerIds: PlayerId[];
  reshuffleCount: number;
  rejectedCommandCount: number;
  logs: string[];
  finalState: GameState;
  stuckReason?: string;
  invariantFailure?: string;
  recentStepRecords: SimulationStepRecord[];
}

export interface BatchSimulationOptions
  extends Omit<SimulationOptions, "seed" | "verbose" | "verboseDebug"> {
  games: number;
  seedBase: number;
  verbose: boolean;
  verboseDebug: boolean;
}

export interface BatchSimulationReport {
  totalGames: number;
  finishedGames: number;
  stuckGames: number;
  failedInvariantGames: number;
  averageSteps: number;
  maxSteps: number;
  minSteps: number;
  averageReshuffles: number;
  averageRejectedCommands: number;
  winnerDistribution: Record<string, number>;
  eliminationCount: number;
  mode: GameMode;
  playerCount: number;
  seedRange: {
    from: number;
    to: number;
  };
  failedSeeds: Array<string | number>;
  results: SimulationResult[];
}

export interface BotDecision {
  command: GameCommand;
  reason: string;
}
