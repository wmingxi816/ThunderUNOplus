import type {
  Card,
  CardColor,
  GameCommand,
  GameEvent,
  GameMode,
  PlayerGameSnapshot,
  PlayerId,
  PlayerRoomSnapshot,
  ShuffleSeed
} from "@thunder-uno/shared-types";

export interface MultiClientScenarioOptions {
  wsUrl?: string;
  players: number;
  mode: GameMode;
  seed?: ShuffleSeed;
  maxSteps?: number;
  verbose?: boolean;
  testReconnect?: boolean;
}

export interface MultiClientScenarioRunOptions {
  wsUrl: string;
  players: number;
  mode: GameMode;
  seed?: ShuffleSeed;
  maxSteps: number;
  verbose: boolean;
  testReconnect: boolean;
}

export interface ScenarioResult {
  status: "finished" | "stuck" | "failed";
  roomId: string;
  players: number;
  mode: GameMode;
  steps: number;
  winnerPlayerIds: string[];
  reconnectTestPassed?: boolean;
  errors: string[];
  logs?: string[];
}

export interface ScenarioLogContext {
  verbose: boolean;
  logs: string[];
}

export interface DevClientIdentity {
  userId: string;
  nickname: string;
  avatarUrl?: string | null;
}

export interface PublicScenarioPlayerState {
  playerId: PlayerId;
  handCount: number;
  hasCalledUno: boolean;
  isEliminated: boolean;
  isCurrentPlayer: boolean;
  seatIndex?: number;
  connectionStatus?: PlayerRoomSnapshot["players"][number]["connectionStatus"];
}

export interface ScenarioDecision {
  command: GameCommand;
  summary: string;
}

export interface ScenarioExecutionResult {
  events: GameEvent[];
  snapshotVersion: number;
}

export interface PendingUnoWindow {
  targetPlayerId: PlayerId;
  pendingSinceMs: number;
}

export interface ReconnectCheckResult {
  ok: boolean;
  playerIdUnchanged: boolean;
  seatIndexUnchanged: boolean;
}

export interface PlayableCardChoice {
  card: Card;
  declaredColor?: CardColor;
}
