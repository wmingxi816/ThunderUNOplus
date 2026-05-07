import { fileURLToPath } from "node:url";
import type {
  GameCommand,
  GameEvent,
  GameMode,
  PlayerGameSnapshot,
  PlayerId,
  PlayerRoomSnapshot
} from "@thunder-uno/shared-types";
import { DevWsClient } from "./devWsClient";
import {
  chooseAutoUnoDecision,
  chooseChallengeDecision,
  chooseReportUnoDecision,
  chooseTurnDecision,
  findChallengePlayerId,
  findUnoReporterPlayerId,
  mergePublicPlayerStates
} from "./scenarioDecision";
import { createScenarioRandom } from "./scenarioRandom";
import type {
  MultiClientScenarioOptions,
  MultiClientScenarioRunOptions,
  PendingUnoWindow,
  PublicScenarioPlayerState,
  ReconnectCheckResult,
  ScenarioDecision,
  ScenarioExecutionResult,
  ScenarioResult
} from "./scenarioTypes";

const DEFAULT_WS_URL = "ws://localhost:8787";
const DEFAULT_MAX_STEPS = 1000;

export async function runMultiClientScenario(
  params: MultiClientScenarioOptions
): Promise<ScenarioResult> {
  const options = normalizeOptions(params);
  const logs: string[] = [];
  const errors: string[] = [];
  const random = createScenarioRandom(options.seed);
  const pendingUnoWindows = new Map<PlayerId, PendingUnoWindow>();
  const clients = createScenarioClients(options);
  let roomId = "";
  let steps = 0;
  let reconnectPerformed = false;
  let reconnectTestPassed: boolean | undefined = options.testReconnect
    ? false
    : undefined;
  let logicalNowMs = 1000;

  try {
    const owner = clients[0]!;
    await owner.connect();
    log(logs, options.verbose, `[connect] user=${owner.userId}`);

    const roomSnapshot = await owner.createRoom(options.mode);
    roomId = roomSnapshot.roomId;
    log(
      logs,
      options.verbose,
      `[create-room] room=${roomId} owner=${owner.playerId ?? "unknown"}`
    );

    for (let index = 1; index < clients.length; index += 1) {
      const client = clients[index]!;
      await client.connect();
      log(logs, options.verbose, `[connect] user=${client.userId}`);
      const joinSnapshot = await client.joinRoom(roomId);
      const seatIndex = joinSnapshot.players.find(
        (player) => player.playerId === client.playerId
      )?.seatIndex;
      log(
        logs,
        options.verbose,
        `[join-room] user=${client.userId} player=${client.playerId ?? "unknown"} seat=${String(seatIndex ?? -1)}`
      );
      await client.setReady(true);
      log(logs, options.verbose, `[ready] player=${client.playerId ?? "unknown"}`);
    }

    await waitForAllRoomPlayerCounts(clients, options.players);

    await owner.startGame(options.seed);
    log(logs, options.verbose, `[start-game] room=${roomId}`);

    await waitForConnectedSnapshots(clients, 1);

    while (steps < options.maxSteps) {
      const referenceSnapshot = getReferenceSnapshot(clients);

      if (referenceSnapshot === null) {
        const message = "No connected client has a usable snapshot.";
        errors.push(message);
        return buildScenarioResult({
          status: "failed",
          roomId,
          options,
          steps,
          winnerPlayerIds: [],
          reconnectTestPassed,
          errors,
          logs
        });
      }

      if (
        referenceSnapshot.status === "finished" ||
        referenceSnapshot.winnerPlayerIds.length > 0
      ) {
        log(
          logs,
          options.verbose,
          `[finished] winner=${referenceSnapshot.winnerPlayerIds.join(",") || "none"} steps=${String(steps)}`
        );

        return buildScenarioResult({
          status: "finished",
          roomId,
          options,
          steps,
          winnerPlayerIds: referenceSnapshot.winnerPlayerIds,
          reconnectTestPassed,
          errors,
          logs
        });
      }

      cleanupPendingUnoWindows(pendingUnoWindows, clients);

      if (options.testReconnect && !reconnectPerformed && steps >= 1) {
        const reconnectResult = await maybeRunReconnectScenario({
          clients,
          roomId,
          currentPlayerId: referenceSnapshot.currentPlayerId,
          logs,
          verbose: options.verbose
        });

        if (reconnectResult !== null) {
          reconnectPerformed = true;
          reconnectTestPassed = reconnectResult.ok;

          if (!reconnectResult.ok) {
            errors.push("Reconnect flow did not preserve the expected player identity.");
            return buildScenarioResult({
              status: "failed",
              roomId,
              options,
              steps,
              winnerPlayerIds: [],
              reconnectTestPassed,
              errors,
              logs
            });
          }

          continue;
        }
      }

      const outOfTurnDecision = chooseOutOfTurnScenarioDecision({
        clients,
        pendingUnoWindows,
        logicalNowMs,
        random
      });

      if (outOfTurnDecision !== null) {
        const execution = await executeScenarioCommand({
          clients,
          actor: outOfTurnDecision.client,
          decision: outOfTurnDecision.decision,
          step: steps + 1,
          logs,
          verbose: options.verbose
        });

        if (execution.failed) {
          errors.push(execution.failed);
          return buildScenarioResult({
            status: execution.failureStatus ?? "failed",
            roomId,
            options,
            steps,
            winnerPlayerIds: [],
            reconnectTestPassed,
            errors,
            logs
          });
        }

        steps += 1;
        logicalNowMs = outOfTurnDecision.nowMs;
        applyPendingUnoEvents(
          pendingUnoWindows,
          execution.events,
          outOfTurnDecision.nowMs
        );
        continue;
      }

      const currentClient = findConnectedClientByPlayerId(
        clients,
        referenceSnapshot.currentPlayerId
      );

      if (currentClient === null || currentClient.latestSnapshot === undefined) {
        const message = `Current player ${referenceSnapshot.currentPlayerId} is not connected.`;
        errors.push(message);
        return buildScenarioResult({
          status: "failed",
          roomId,
          options,
          steps,
          winnerPlayerIds: [],
          reconnectTestPassed,
          errors,
          logs
        });
      }

      logicalNowMs += 1000;
      const decision = chooseTurnDecision(currentClient.latestSnapshot, logicalNowMs);
      const execution = await executeScenarioCommand({
        clients,
        actor: currentClient,
        decision,
        step: steps + 1,
        logs,
        verbose: options.verbose
      });

      if (execution.failed) {
        errors.push(execution.failed);
        return buildScenarioResult({
          status: execution.failureStatus ?? "failed",
          roomId,
          options,
          steps,
          winnerPlayerIds: [],
          reconnectTestPassed,
          errors,
          logs
        });
      }

      steps += 1;
      applyPendingUnoEvents(pendingUnoWindows, execution.events, logicalNowMs);
    }

    const winners = getReferenceSnapshot(clients)?.winnerPlayerIds ?? [];
    const stuckMessage = `Reached max steps ${String(options.maxSteps)} without a terminal game state.`;
    log(logs, options.verbose, `[stuck] ${stuckMessage}`);
    errors.push(stuckMessage);

    return buildScenarioResult({
      status: "stuck",
      roomId,
      options,
      steps,
      winnerPlayerIds: winners,
      reconnectTestPassed,
      errors,
      logs
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown scenario error.";
    errors.push(message);

    return buildScenarioResult({
      status: "failed",
      roomId,
      options,
      steps,
      winnerPlayerIds: getReferenceSnapshot(clients)?.winnerPlayerIds ?? [],
      reconnectTestPassed,
      errors,
      logs
    });
  } finally {
    for (const client of clients) {
      await client.close();
    }
  }
}

async function executeScenarioCommand(params: {
  clients: DevWsClient[];
  actor: DevWsClient;
  decision: ScenarioDecision;
  step: number;
  logs: string[];
  verbose: boolean;
}): Promise<
  | (ScenarioExecutionResult & {
      failed?: string;
      failureStatus?: "stuck" | "failed";
    })
  | {
      failed: string;
      failureStatus: "stuck" | "failed";
      events: GameEvent[];
      snapshotVersion: number;
    }
> {
  const response = await params.actor.sendCommand(params.decision.command);

  if (response.type === "error") {
    return {
      failed: `Server error for ${params.decision.summary}: ${response.code} ${response.message}`,
      failureStatus: "failed",
      events: [],
      snapshotVersion: -1
    };
  }

  const rejectedEvent = response.events.find(
    (event) => event.type === "command-rejected"
  );

  if (rejectedEvent !== undefined) {
    return {
      failed: `Command rejected: ${rejectedEvent.commandType} ${rejectedEvent.code} ${rejectedEvent.message}`,
      failureStatus: "stuck",
      events: response.events,
      snapshotVersion: response.snapshotVersion
    };
  }

  await waitForConnectedSnapshots(params.clients, response.snapshotVersion);

  log(
    params.logs,
    params.verbose,
    `[step ${String(params.step)}] current=${params.actor.playerId ?? "unknown"} command=${params.decision.summary} events=${formatEventTypes(response.events)} version=${String(response.snapshotVersion)}`
  );

  return {
    events: response.events,
    snapshotVersion: response.snapshotVersion
  };
}

function chooseOutOfTurnScenarioDecision(params: {
  clients: DevWsClient[];
  pendingUnoWindows: Map<PlayerId, PendingUnoWindow>;
  logicalNowMs: number;
  random: () => number;
}): { client: DevWsClient; decision: ScenarioDecision; nowMs: number } | null {
  const connectedClients = params.clients.filter(
    (client) => client.isConnected && client.latestSnapshot !== undefined
  );

  for (const client of connectedClients) {
    if (
      client.latestSnapshot!.self.handCount === 1 &&
      !client.latestSnapshot!.self.hasCalledUno &&
      !client.latestSnapshot!.self.isEliminated
    ) {
      const nowMs = params.logicalNowMs + 1000;
      return {
        client,
        decision: chooseAutoUnoDecision(client.latestSnapshot!.self.playerId, nowMs),
        nowMs
      };
    }
  }

  const publicPlayers = buildPublicPlayerMap(params.clients);

  for (const pendingWindow of params.pendingUnoWindows.values()) {
    const target = publicPlayers.get(pendingWindow.targetPlayerId);

    if (
      target === undefined ||
      target.hasCalledUno ||
      target.handCount !== 1 ||
      target.isEliminated
    ) {
      continue;
    }

    const reporterId = findUnoReporterPlayerId(publicPlayers, pendingWindow.targetPlayerId);

    if (reporterId === null) {
      continue;
    }

    const reporterClient = findConnectedClientByPlayerId(params.clients, reporterId);

    if (reporterClient === null) {
      continue;
    }

    const nowMs = Math.max(params.logicalNowMs + 1000, pendingWindow.pendingSinceMs + 5000);
    return {
      client: reporterClient,
      decision: chooseReportUnoDecision(
        reporterId,
        pendingWindow.targetPlayerId,
        nowMs
      ),
      nowMs
    };
  }

  const referenceSnapshot = connectedClients[0]?.latestSnapshot;

  if (
    referenceSnapshot !== undefined &&
    referenceSnapshot.mode === "with-challenge" &&
    referenceSnapshot.challengeWindow.active &&
    referenceSnapshot.challengeWindow.targetPlayerId !== null &&
    params.random() < 0.5
  ) {
    const challengerId = findChallengePlayerId(
      publicPlayers,
      referenceSnapshot.currentPlayerId,
      referenceSnapshot.challengeWindow.targetPlayerId
    );

    if (challengerId !== null) {
      const challengerClient = findConnectedClientByPlayerId(
        params.clients,
        challengerId
      );

      if (challengerClient !== null) {
        const nowMs = params.logicalNowMs + 1000;
        return {
          client: challengerClient,
          decision: chooseChallengeDecision(
            challengerId,
            referenceSnapshot.challengeWindow.targetPlayerId,
            nowMs
          ),
          nowMs
        };
      }
    }
  }

  return null;
}

async function maybeRunReconnectScenario(params: {
  clients: DevWsClient[];
  roomId: string;
  currentPlayerId: PlayerId;
  logs: string[];
  verbose: boolean;
}): Promise<ReconnectCheckResult | null> {
  const targetIndex = params.clients.findIndex((client, index) => {
    return (
      index > 0 &&
      client.isConnected &&
      client.playerId !== undefined &&
      client.playerId !== params.currentPlayerId
    );
  });

  if (targetIndex === -1) {
    return null;
  }

  const targetClient = params.clients[targetIndex]!;
  const oldPlayerId = targetClient.playerId!;
  const oldSeatIndex = findSeatIndex(params.clients, oldPlayerId);
  const waiters = params.clients
    .filter((client) => client !== targetClient && client.isConnected)
    .map((client) => {
      const startIndex = client.receivedMessages.length;
      return client.waitForMessage(
        (message) => {
          return (
            message.type === "room-state" &&
            message.room.players.some((player) => {
              return (
                player.playerId === oldPlayerId &&
                player.connectionStatus === "disconnected"
              );
            })
          );
        },
        2_000,
        startIndex
      );
    });

  await targetClient.close();
  await Promise.all(waiters);

  const reconnectClient = new DevWsClient({
    wsUrl: targetClient.wsUrl,
    userId: targetClient.userId,
    nickname: targetClient.nickname,
    avatarUrl: targetClient.avatarUrl
  });

  await reconnectClient.connect();
  reconnectClient.playerId = oldPlayerId;
  reconnectClient.roomId = params.roomId;
  await reconnectClient.reconnect(params.roomId);
  params.clients[targetIndex] = reconnectClient;

  const newSeatIndex = findSeatIndex(params.clients, oldPlayerId);
  const result: ReconnectCheckResult = {
    ok: reconnectClient.playerId === oldPlayerId && oldSeatIndex === newSeatIndex,
    playerIdUnchanged: reconnectClient.playerId === oldPlayerId,
    seatIndexUnchanged: oldSeatIndex === newSeatIndex
  };

  log(
    params.logs,
    params.verbose,
    `[reconnect] user=${reconnectClient.userId} oldPlayerId=${oldPlayerId} newPlayerId=${reconnectClient.playerId ?? "unknown"} ok=${String(result.ok)}`
  );

  return result;
}

async function waitForAllRoomPlayerCounts(
  clients: DevWsClient[],
  expectedPlayerCount: number
): Promise<void> {
  await Promise.all(
    clients.map((client) => client.waitForRoomPlayerCount(expectedPlayerCount))
  );
}

async function waitForConnectedSnapshots(
  clients: DevWsClient[],
  snapshotVersion: number
): Promise<void> {
  await Promise.all(
    clients
      .filter((client) => client.isConnected && client.playerId !== undefined)
      .map((client) => client.waitForSnapshotVersion(snapshotVersion))
  );
}

function buildPublicPlayerMap(
  clients: DevWsClient[]
): Map<PlayerId, PublicScenarioPlayerState> {
  const snapshots: PlayerGameSnapshot[] = [];
  const roomSnapshots: PlayerRoomSnapshot[] = [];

  for (const client of clients) {
    if (client.isConnected && client.latestSnapshot !== undefined) {
      snapshots.push(client.latestSnapshot);
    }

    if (client.latestRoomState !== undefined) {
      roomSnapshots.push(client.latestRoomState);
    }
  }

  return mergePublicPlayerStates({
    snapshots,
    roomSnapshots
  });
}

function cleanupPendingUnoWindows(
  pendingUnoWindows: Map<PlayerId, PendingUnoWindow>,
  clients: DevWsClient[]
): void {
  const publicPlayers = buildPublicPlayerMap(clients);

  for (const [playerId, pendingWindow] of pendingUnoWindows) {
    const publicPlayer = publicPlayers.get(playerId);

    if (
      publicPlayer === undefined ||
      publicPlayer.handCount !== 1 ||
      publicPlayer.hasCalledUno ||
      publicPlayer.isEliminated
    ) {
      pendingUnoWindows.delete(playerId);
      continue;
    }

    pendingUnoWindows.set(playerId, pendingWindow);
  }
}

function applyPendingUnoEvents(
  pendingUnoWindows: Map<PlayerId, PendingUnoWindow>,
  events: GameEvent[],
  nowMs: number
): void {
  for (const event of events) {
    switch (event.type) {
      case "uno-pending":
        pendingUnoWindows.set(event.playerId, {
          targetPlayerId: event.playerId,
          pendingSinceMs: nowMs
        });
        break;
      case "uno-called":
        pendingUnoWindows.delete(event.playerId);
        break;
      case "uno-penalty-applied":
        pendingUnoWindows.delete(event.targetPlayerId);
        break;
      default:
        break;
    }
  }
}

function getReferenceSnapshot(clients: DevWsClient[]): PlayerGameSnapshot | null {
  return (
    clients.find((client) => client.isConnected && client.latestSnapshot !== undefined)
      ?.latestSnapshot ?? null
  );
}

function findConnectedClientByPlayerId(
  clients: DevWsClient[],
  playerId: PlayerId
): DevWsClient | null {
  return clients.find((client) => client.isConnected && client.playerId === playerId) ?? null;
}

function findSeatIndex(clients: DevWsClient[], playerId: PlayerId): number | null {
  for (const client of clients) {
    const seatIndex = client.latestRoomState?.players.find(
      (player) => player.playerId === playerId
    )?.seatIndex;

    if (seatIndex !== undefined) {
      return seatIndex;
    }
  }

  return null;
}

function createScenarioClients(
  options: MultiClientScenarioRunOptions
): DevWsClient[] {
  return Array.from({ length: options.players }, (_, index) => {
    const serial = String(index + 1).padStart(3, "0");

    return new DevWsClient({
      wsUrl: options.wsUrl,
      userId: `dev-user-${serial}`,
      nickname: `Dev Player ${String(index + 1)}`,
      avatarUrl: null
    });
  });
}

function normalizeOptions(
  options: MultiClientScenarioOptions
): MultiClientScenarioRunOptions {
  if (!Number.isInteger(options.players) || options.players < 3 || options.players > 8) {
    throw new Error("players must be an integer between 3 and 8.");
  }

  return {
    wsUrl: options.wsUrl ?? DEFAULT_WS_URL,
    players: options.players,
    mode: options.mode,
    ...(options.seed === undefined ? {} : { seed: options.seed }),
    maxSteps: options.maxSteps ?? DEFAULT_MAX_STEPS,
    verbose: options.verbose ?? false,
    testReconnect: options.testReconnect ?? false
  };
}

function buildScenarioResult(params: {
  status: ScenarioResult["status"];
  roomId: string;
  options: MultiClientScenarioRunOptions;
  steps: number;
  winnerPlayerIds: string[];
  reconnectTestPassed: boolean | undefined;
  errors: string[];
  logs: string[];
}): ScenarioResult {
  return {
    status: params.status,
    roomId: params.roomId,
    players: params.options.players,
    mode: params.options.mode,
    steps: params.steps,
    winnerPlayerIds: params.winnerPlayerIds,
    ...(params.reconnectTestPassed === undefined
      ? {}
      : { reconnectTestPassed: params.reconnectTestPassed }),
    errors: [...params.errors],
    logs: [...params.logs]
  };
}

function formatEventTypes(events: GameEvent[]): string {
  return events.map((event) => event.type).join(",");
}

function log(logs: string[], verbose: boolean, line: string): void {
  logs.push(line);

  if (verbose) {
    console.log(line);
  }
}

function parseCliArgs(argv: string[]): MultiClientScenarioOptions {
  const args = [...argv];
  let players: number | null = null;
  let mode: GameMode | null = null;
  let wsUrl: string | undefined;
  let seed: string | number | undefined;
  let maxSteps: number | undefined;
  let verbose = false;
  let testReconnect = false;

  while (args.length > 0) {
    const arg = args.shift()!;

    switch (arg) {
      case "--players":
        players = Number(requireArgValue(arg, args));
        break;
      case "--mode": {
        const value = requireArgValue(arg, args);

        if (!isGameMode(value)) {
          throw new Error(`Unsupported mode: ${value}.`);
        }

        mode = value;
        break;
      }
      case "--ws-url":
        wsUrl = requireArgValue(arg, args);
        break;
      case "--seed": {
        const raw = requireArgValue(arg, args);
        const numericSeed = Number(raw);
        seed = Number.isNaN(numericSeed) ? raw : numericSeed;
        break;
      }
      case "--max-steps":
        maxSteps = Number(requireArgValue(arg, args));
        break;
      case "--verbose":
        verbose = true;
        break;
      case "--test-reconnect":
        testReconnect = true;
        break;
      default:
        throw new Error(`Unknown CLI flag: ${arg}`);
    }
  }

  if (players === null) {
    throw new Error("--players is required.");
  }

  if (mode === null) {
    throw new Error("--mode is required.");
  }

  return {
    players,
    mode,
    ...(wsUrl === undefined ? {} : { wsUrl }),
    ...(seed === undefined ? {} : { seed }),
    ...(maxSteps === undefined ? {} : { maxSteps }),
    verbose,
    testReconnect
  };
}

function requireArgValue(flag: string, args: string[]): string {
  const value = args.shift();

  if (value === undefined) {
    throw new Error(`${flag} requires a value.`);
  }

  return value;
}

function isGameMode(value: string): value is GameMode {
  return (["with-challenge", "no-challenge"] satisfies readonly GameMode[]).includes(
    value as GameMode
  );
}

function printScenarioSummary(result: ScenarioResult): void {
  console.log(`scenario ${result.status}`);
  console.log(`roomId=${result.roomId}`);
  console.log(`players=${String(result.players)}`);
  console.log(`mode=${result.mode}`);
  console.log(`steps=${String(result.steps)}`);
  console.log(`winner=${result.winnerPlayerIds.join(",") || "none"}`);
  console.log(
    `reconnect=${result.reconnectTestPassed === undefined ? "n/a" : String(result.reconnectTestPassed)}`
  );

  if (result.errors.length > 0) {
    console.log(`errors=${result.errors.join(" | ")}`);
  }
}

async function runFromCli(): Promise<void> {
  const options = parseCliArgs(process.argv.slice(2));
  const result = await runMultiClientScenario(options);

  printScenarioSummary(result);
  process.exitCode = result.status === "failed" ? 1 : 0;
}

const isDirectRun = process.argv[1] === fileURLToPath(import.meta.url);

if (isDirectRun) {
  await runFromCli();
}
