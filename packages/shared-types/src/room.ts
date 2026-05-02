import type {
  GameMode,
  PlayerId,
  RoomCode,
  RoomId,
  RoomStatus,
  UnixMs
} from "./common";
import type { GameState } from "./game";
import type { Player } from "./player";

export interface RoomOptions {
  minPlayers: number;
  maxPlayers: number;
  handLimit: number;
  mode: GameMode;
  supportChallenge: boolean;
}

export interface RoomState {
  id: RoomId;
  code: RoomCode;
  hostPlayerId: PlayerId;
  status: RoomStatus;
  mode: GameMode;
  createdAt: UnixMs;
  updatedAt: UnixMs;
  players: Player[];
  options: RoomOptions;
  game?: GameState;
}
