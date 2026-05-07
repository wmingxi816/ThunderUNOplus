import type {
  PlayerConnectionStatus,
  PlayerEliminationReason,
  PlayerId,
  UnixMs
} from "./common";
import type { Card } from "./card";

export interface PlayerProfile {
  platform?: "wechat";
  nickname: string;
  avatarUrl: string | null;
  openId?: string;
  unionId?: string;
}

export interface PlayerPresence {
  connectionStatus: PlayerConnectionStatus;
  lastSeenAt: UnixMs;
  reconnectSessionId?: string;
}

export interface Player {
  id: PlayerId;
  seatIndex: number;
  isHost: boolean;
  joinedAt: UnixMs;
  profile: PlayerProfile;
  presence: PlayerPresence;
}

export interface InitialGamePlayerInput {
  id: PlayerId;
  displayName?: string;
  avatarUrl?: string | null;
}

export interface GamePlayerState {
  id: PlayerId;
  displayName?: string;
  avatarUrl?: string | null;
  hand: Card[];
  handCount: number;
  hasCalledUno: boolean;
  unoPendingSinceMs: UnixMs | null;
  unoProtectionStartedAtMs: UnixMs | null;
  unoProtectionEndsAtMs: UnixMs | null;
  isEliminated: boolean;
  isRoundWinner: boolean;
  hasLeftRoom: boolean;
  eliminationReason: PlayerEliminationReason | null;
}
