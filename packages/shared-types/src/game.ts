import type { Card, CardColor, DrawValue } from "./card";
import type {
  GameMode,
  GameStatus,
  PlayerId,
  RoomId,
  ShuffleSeed,
  TurnDirection,
  UnixMs
} from "./common";
import type { GamePlayerState, InitialGamePlayerInput } from "./player";

export interface CreateInitialGameParams {
  roomId?: RoomId;
  players: readonly InitialGamePlayerInput[];
  mode: GameMode;
  seed?: ShuffleSeed;
  now?: UnixMs;
  snapshotVersion?: number;
}

export interface DrawStackState {
  active: boolean;
  amount: number;
  previousDrawValue: DrawValue | null;
  targetPlayerId: PlayerId | null;
}

export interface DrawUntilColorState {
  active: boolean;
  color: CardColor | null;
  targetPlayerId: PlayerId | null;
}

export interface ChallengeWindowState {
  active: boolean;
  targetPlayerId: PlayerId | null;
  hadBlackCardBeforeDraw: boolean;
  expiresWhenNextPlayerCompletesAction: boolean;
}

export interface PublicChallengeWindowState {
  active: boolean;
  targetPlayerId: PlayerId | null;
}

export interface GameState {
  roomId: RoomId;
  snapshotVersion: number;
  shuffleCounter: number;
  mode: GameMode;
  status: GameStatus;
  now: UnixMs;
  direction: TurnDirection;
  currentColor: CardColor;
  currentPlayerId: PlayerId;
  playerOrder: PlayerId[];
  players: GamePlayerState[];
  topCard: Card;
  discardPile: Card[];
  drawPile: Card[];
  skippedOpeningBlackCards: Card[];
  drawStack: DrawStackState;
  drawUntilColor: DrawUntilColorState;
  challengeWindow: ChallengeWindowState;
  winnerPlayerIds: PlayerId[];
  seed?: ShuffleSeed;
}
