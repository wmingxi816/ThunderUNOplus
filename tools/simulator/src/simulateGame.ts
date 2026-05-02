import {
  applyCommand,
  createInitialGame,
  type GameCommand,
  type GameEvent,
  type GamePlayerState,
  type GameState
} from "@thunder-uno/uno-core";
import {
  chooseChallengePlayerId,
  chooseCommand,
  chooseUnoReporterId,
  findAutoUnoTarget,
  findReportableUnoTarget
} from "./bot/chooseCommand";
import { formatInvariantFailure } from "./invariant/formatInvariantFailure";
import { validateGameStateInvariant } from "./invariant/validateGameStateInvariant";
import { formatStepLog } from "./logger/simulationLogger";
import { createSeededRandom } from "./random";
import type {
  SimulationOptions,
  SimulationResult,
  SimulationStepRecord
} from "./simulationTypes";

/** 运行一局完整模拟，直到结束、卡死或 invariant 失败。 */
export function simulateGame(options: SimulationOptions): SimulationResult {
  const random = createSeededRandom(options.seed);
  const players = createSimulationPlayers(options.playerCount);
  let state = createInitialGame({
    roomId: `sim-room-${String(options.seed)}`,
    players,
    mode: options.mode,
    seed: options.seed,
    now: 0,
    snapshotVersion: 1
  });

  const logs: string[] = [
    `game started | seed=${String(options.seed)} | players=${String(options.playerCount)} | mode=${options.mode}`
  ];
  const recentStepRecords: SimulationStepRecord[] = [];
  let steps = 0;
  let reshuffleCount = 0;
  let rejectedCommandCount = 0;
  let lastCommand: GameCommand | null = null;
  let lastEvents: GameEvent[] = [];

  const initialInvariant = validateGameStateInvariant(state);

  if (!initialInvariant.valid) {
    const failureMessage = formatInvariantFailure(
      initialInvariant.reason ?? "unknown invariant failure",
      {
        seed: options.seed,
        step: 0,
        playerCount: options.playerCount,
        mode: options.mode,
        lastCommand: null,
        recentEvents: [],
        state
      }
    );

    logs.push(failureMessage);

    return buildResult({
      status: "failed-invariant",
      state,
      options,
      steps,
      reshuffleCount,
      rejectedCommandCount,
      logs,
      recentStepRecords,
      invariantFailure: failureMessage
    });
  }

  while (steps < options.maxSteps) {
    if (state.status === "finished") {
      logs.push("game finished");
      return buildResult({
        status: "finished",
        state,
        options,
        steps,
        reshuffleCount,
        rejectedCommandCount,
        logs,
        recentStepRecords
      });
    }

    const outOfTurnCommand = chooseOutOfTurnCommand(state, options, random);

    if (outOfTurnCommand !== null) {
      const execution = executeCommand({
        state,
        command: outOfTurnCommand,
        step: steps + 1,
        options,
        logs,
        recentStepRecords
      });

      steps = execution.steps;
      state = execution.state;
      reshuffleCount += execution.reshuffleCountDelta;
      rejectedCommandCount += execution.rejectedCommandCountDelta;
      lastCommand = outOfTurnCommand;
      lastEvents = execution.events;

      if (execution.failureResult !== null) {
        return buildResult({
          status: execution.failureResult.status,
          state,
          options,
          steps,
          reshuffleCount,
          rejectedCommandCount,
          logs,
          recentStepRecords,
          ...(execution.failureResult.status === "failed-invariant"
            ? { invariantFailure: execution.failureResult.reason }
            : { stuckReason: execution.failureResult.reason })
        });
      }

      continue;
    }

    const currentPlayer = state.players.find(
      (player) => player.id === state.currentPlayerId
    );

    if (currentPlayer === undefined || currentPlayer.isEliminated) {
      const failureMessage = formatInvariantFailure(
        "current player is missing or eliminated before choosing a command",
        {
          seed: options.seed,
          step: steps,
          playerCount: options.playerCount,
          mode: options.mode,
          lastCommand,
          recentEvents: lastEvents,
          state
        }
      );
      logs.push(failureMessage);

      return buildResult({
        status: "failed-invariant",
        state,
        options,
        steps,
        reshuffleCount,
        rejectedCommandCount,
        logs,
        recentStepRecords,
        invariantFailure: failureMessage
      });
    }

    const decision = chooseCommand(state, currentPlayer);
    const execution = executeCommand({
      state,
      command: decision.command,
      step: steps + 1,
      options,
      logs,
      recentStepRecords
    });

    steps = execution.steps;
    state = execution.state;
    reshuffleCount += execution.reshuffleCountDelta;
    rejectedCommandCount += execution.rejectedCommandCountDelta;
    lastCommand = decision.command;
    lastEvents = execution.events;

    if (execution.failureResult !== null) {
      return buildResult({
        status: execution.failureResult.status,
        state,
        options,
        steps,
        reshuffleCount,
        rejectedCommandCount,
        logs,
        recentStepRecords,
        ...(execution.failureResult.status === "failed-invariant"
          ? { invariantFailure: execution.failureResult.reason }
          : { stuckReason: execution.failureResult.reason })
      });
    }
  }

  const stuckReason = `max steps reached: ${String(options.maxSteps)}`;
  logs.push(`game stopped | ${stuckReason}`);

  return buildResult({
    status: "stuck",
    state,
    options,
    steps: options.maxSteps,
    reshuffleCount,
    rejectedCommandCount,
    logs,
    recentStepRecords,
    stuckReason
  });
}

function executeCommand(params: {
  state: GameState;
  command: GameCommand;
  step: number;
  options: SimulationOptions;
  logs: string[];
  recentStepRecords: SimulationStepRecord[];
}): {
  state: GameState;
  steps: number;
  events: GameEvent[];
  reshuffleCountDelta: number;
  rejectedCommandCountDelta: number;
  failureResult: { status: "stuck" | "failed-invariant"; reason: string } | null;
} {
  const result = applyCommand(params.state, params.command);
  const isRejected = result.events.some((event) => event.type === "command-rejected");
  const reshuffleCountDelta = result.events.filter(
    (event) => event.type === "deck-reshuffled"
  ).length;
  const rejectedCommandCountDelta = isRejected ? 1 : 0;

  params.recentStepRecords.push({
    step: params.step,
    command: params.command,
    result
  });

  if (params.recentStepRecords.length > 5) {
    params.recentStepRecords.shift();
  }

  if (params.options.verbose) {
    params.logs.push(
      formatStepLog(
        params.step,
        params.state,
        params.command,
        result.events,
        result.state
      )
    );
  }

  if (isRejected) {
    const reason = `simulator produced a rejected command: ${result.events
      .map((event) => event.type)
      .join(",")}`;
    params.logs.push(reason);

    return {
      state: result.state,
      steps: params.step,
      events: result.events,
      reshuffleCountDelta,
      rejectedCommandCountDelta,
      failureResult: {
        status: "stuck",
        reason
      }
    };
  }

  const invariant = validateGameStateInvariant(result.state);

  if (!invariant.valid) {
    const reason = formatInvariantFailure(
      invariant.reason ?? "unknown invariant failure",
      {
        seed: params.options.seed,
        step: params.step,
        playerCount: params.options.playerCount,
        mode: params.options.mode,
        lastCommand: params.command,
        recentEvents: result.events,
        state: result.state
      }
    );
    params.logs.push(reason);

    return {
      state: result.state,
      steps: params.step,
      events: result.events,
      reshuffleCountDelta,
      rejectedCommandCountDelta,
      failureResult: {
        status: "failed-invariant",
        reason
      }
    };
  }

  return {
    state: result.state,
    steps: params.step,
    events: result.events,
    reshuffleCountDelta,
    rejectedCommandCountDelta,
    failureResult: null
  };
}

function chooseOutOfTurnCommand(
  state: GameState,
  options: SimulationOptions,
  random: () => number
): GameCommand | null {
  if (options.autoUno) {
    const autoUnoTarget = findAutoUnoTarget(state);

    if (autoUnoTarget !== null) {
      return {
        type: "say-uno",
        playerId: autoUnoTarget.id,
        timestampMs: state.now + 1000
      };
    }
  }

  const reportTarget = findReportableUnoTarget(state);

  if (reportTarget !== null) {
    const reporterId = chooseUnoReporterId(state, reportTarget.id);

    if (reporterId !== null) {
      return {
        type: "report-uno",
        playerId: reporterId,
        targetPlayerId: reportTarget.id,
        timestampMs: state.now + 1000
      };
    }
  }

  if (state.mode === "with-challenge" && state.challengeWindow.active) {
    const challengerId = chooseChallengePlayerId(state);

    if (challengerId !== null && random() < options.challengeRate) {
      return {
        type: "challenge-draw",
        playerId: challengerId,
        targetPlayerId: state.challengeWindow.targetPlayerId!,
        timestampMs: state.now + 1000
      };
    }
  }

  return null;
}

function createSimulationPlayers(playerCount: number): GamePlayerState[] {
  return Array.from({ length: playerCount }, (_, index) => {
    return {
      id: `p${String(index + 1)}`,
      displayName: `Bot ${String(index + 1)}`,
      avatarUrl: null,
      hand: [],
      handCount: 0,
      hasCalledUno: false,
      unoPendingSinceMs: null,
      isEliminated: false,
      eliminationReason: null
    };
  });
}

function buildResult(params: {
  status: SimulationResult["status"];
  state: GameState;
  options: SimulationOptions;
  steps: number;
  reshuffleCount: number;
  rejectedCommandCount: number;
  logs: string[];
  recentStepRecords: SimulationStepRecord[];
  stuckReason?: string;
  invariantFailure?: string;
}): SimulationResult {
  return {
    status: params.status,
    seed: params.options.seed,
    playerCount: params.options.playerCount,
    mode: params.options.mode,
    steps: params.steps,
    winnerPlayerIds: [...params.state.winnerPlayerIds],
    eliminatedPlayerIds: params.state.players
      .filter((player) => player.isEliminated)
      .map((player) => player.id),
    reshuffleCount: params.reshuffleCount,
    rejectedCommandCount: params.rejectedCommandCount,
    logs: [...params.logs],
    finalState: params.state,
    recentStepRecords: [...params.recentStepRecords],
    ...(params.stuckReason === undefined
      ? {}
      : { stuckReason: params.stuckReason }),
    ...(params.invariantFailure === undefined
      ? {}
      : { invariantFailure: params.invariantFailure })
  };
}
