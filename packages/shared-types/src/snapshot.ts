import type { Card, CardColor, DrawCardKind } from "./card";
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
  unoPendingSinceMs: number | null;
  unoProtectionStartedAtMs: number | null;
  unoProtectionEndsAtMs: number | null;
  isEliminated: boolean;
  isRoundWinner: boolean;
  hasLeftRoom: boolean;
  isCurrentPlayer: boolean;
  isBot: boolean;
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
    previousDrawKind: DrawCardKind | null;
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
  initialDirectionChoice: {
    active: boolean;
    chooserPlayerId: PlayerId | null;
  };
  challengeWindow: {
    active: boolean;
    targetPlayerId: PlayerId | null;
  };
  roundDecisionPending: boolean;
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
  isReady: boolean;
  connectionStatus: PlayerConnectionStatus;
  isBot: boolean;
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
