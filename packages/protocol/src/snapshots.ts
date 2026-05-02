import type {
  PlayerGameSnapshot,
  PlayerRoomSnapshot
} from "@thunder-uno/shared-types";

export type SnapshotPayload = PlayerGameSnapshot | PlayerRoomSnapshot;

export type { PlayerGameSnapshot, PlayerRoomSnapshot };
