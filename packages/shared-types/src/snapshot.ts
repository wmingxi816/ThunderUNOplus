import type { Card, CardColor } from "./card";
import type {
  GameMode,
  GameStatus,
  PlayerConnectionStatus,
  PlayerId,
  RoomCode,
  RoomId,
  RoomStatus,
  TurnDirection
} from "./common";

export interface PlayerGameSnapshotPlayerPublic {
  playerId: PlayerId;
  displayName?: string;
  avatarUrl?: string | null;
  handCount: number;
  hasCalledUno: boolean;
  isEliminated: boolean;
  isCurrentPlayer: boolean;
}

export interface PlayerGameSnapshotSelf
  extends PlayerGameSnapshotPlayerPublic {
  hand: Card[];
}

export interface PlayerGameSnapshot {
  roomId: RoomId;
  snapshotVersion: number;
  status: GameStatus;
  mode: GameMode;
  currentPlayerId: PlayerId;
  currentColor: CardColor;
  direction: TurnDirection;
  topCard: Card;
  discardPile: Card[];
  drawPileCount: number;
  drawStack: {
    active: boolean;
    amount: number;
    previousDrawValue: number | null;
    targetPlayerId: PlayerId | null;
  };
  drawUntilColor: {
    active: boolean;
    color: CardColor | null;
    targetPlayerId: PlayerId | null;
  };
  normalDrawOffer: {
    active: boolean;
    playerId: PlayerId | null;
    cardId: string | null;
  };
  challengeWindow: {
    active: boolean;
    targetPlayerId: PlayerId | null;
  };
  winnerPlayerIds: PlayerId[];
  self: PlayerGameSnapshotSelf;
  opponents: PlayerGameSnapshotPlayerPublic[];
}

export interface RoomSnapshotPlayer {
  playerId: PlayerId;
  displayName?: string;
  avatarUrl?: string | null;
  seatIndex: number;
  isHost: boolean;
  connectionStatus: PlayerConnectionStatus;
}

export interface PlayerRoomSnapshot {
  roomId: RoomId;
  roomCode: RoomCode;
  status: RoomStatus;
  mode: GameMode;
  hostPlayerId: PlayerId;
  snapshotVersion: number;
  players: RoomSnapshotPlayer[];
}
