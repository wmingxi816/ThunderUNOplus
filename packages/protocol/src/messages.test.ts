import { describe, expect, it } from "vitest";
import type {
  ClientCreateRoomMessage,
  ClientCommandMessage,
  ClientStartGameMessage,
  ServerEventsMessage,
  ServerRoomStateMessage,
  ServerSnapshotMessage
} from "./messages";
import { PROTOCOL_VERSION } from "./version";

describe("protocol - messages", () => {
  it("可以构造 ClientCreateRoomMessage", () => {
    const message: ClientCreateRoomMessage = {
      protocolVersion: PROTOCOL_VERSION,
      type: "create-room",
      requestId: "req-0",
      userId: "dev-user-001",
      nickname: "玩家1",
      avatarUrl: null,
      mode: "no-challenge",
      timestampMs: 1000
    };

    expect(message.type).toBe("create-room");
  });

  it("可以构造 ClientCommandMessage", () => {
    const message: ClientCommandMessage = {
      protocolVersion: PROTOCOL_VERSION,
      type: "command",
      requestId: "req-1",
      roomId: "room-1",
      playerId: "player-1",
      timestampMs: 1000,
      command: {
        type: "draw-card",
        playerId: "player-1",
        timestampMs: 1000
      }
    };

    expect(message.type).toBe("command");
  });

  it("可以构造带 seed 的 ClientStartGameMessage", () => {
    const message: ClientStartGameMessage = {
      protocolVersion: PROTOCOL_VERSION,
      type: "start-game",
      requestId: "req-start-1",
      roomId: "room-1",
      playerId: "player-1",
      seed: 1001,
      timestampMs: 1000
    };

    expect(message.seed).toBe(1001);
  });

  it("可以构造 ServerEventsMessage", () => {
    const message: ServerEventsMessage = {
      protocolVersion: PROTOCOL_VERSION,
      type: "events",
      roomId: "room-1",
      events: [
        {
          type: "uno-called",
          playerId: "player-1"
        }
      ],
      snapshotVersion: 2
    };

    expect(message.events).toHaveLength(1);
  });

  it("可以构造 ServerRoomStateMessage", () => {
    const message: ServerRoomStateMessage = {
      protocolVersion: PROTOCOL_VERSION,
      type: "room-state",
      requestId: "req-room-1",
      roomId: "room-1",
      playerId: "player-1",
      snapshotVersion: 1,
      room: {
        roomId: "room-1",
        roomCode: "123456",
        status: "lobby",
        mode: "no-challenge",
        hostPlayerId: "player-1",
        snapshotVersion: 1,
        players: [
          {
            playerId: "player-1",
            displayName: "玩家1",
            avatarUrl: null,
            seatIndex: 0,
            isHost: true,
            connectionStatus: "connected"
          }
        ]
      }
    };

    expect(message.type).toBe("room-state");
  });

  it("可以构造 ServerSnapshotMessage", () => {
    const message: ServerSnapshotMessage = {
      protocolVersion: PROTOCOL_VERSION,
      type: "snapshot",
      roomId: "room-1",
      playerId: "player-1",
      snapshotVersion: 3,
      snapshot: {
        roomId: "room-1",
        snapshotVersion: 3,
        status: "in-progress",
        mode: "with-challenge",
        currentPlayerId: "player-1",
        currentColor: "red",
        direction: "clockwise",
        topCard: {
          id: "card-1",
          kind: "number",
          color: "red",
          number: 1,
          isBlack: false,
          displayName: "红1"
        },
        discardPile: [
          {
            id: "card-1",
            kind: "number",
            color: "red",
            number: 1,
            isBlack: false,
            displayName: "红1"
          }
        ],
        drawPileCount: 20,
        drawStack: {
          active: false,
          amount: 0,
          previousDrawValue: null,
          previousDrawKind: null,
          targetPlayerId: null
        },
        drawUntilColor: {
          active: false,
          color: null,
          targetPlayerId: null
        },
        normalDrawOffer: {
          active: false,
          playerId: null,
          cardId: null
        },
        challengeWindow: {
          active: false,
          targetPlayerId: null
        },
        winnerPlayerIds: [],
        self: {
          playerId: "player-1",
          displayName: "玩家1",
          avatarUrl: null,
          hand: [],
          handCount: 0,
          hasCalledUno: false,
          unoPendingSinceMs: null,
          unoProtectionStartedAtMs: null,
          unoProtectionEndsAtMs: null,
          isEliminated: false,
          hasLeftRoom: false,
          isCurrentPlayer: true
        },
        opponents: []
      }
    };

    expect(message.type).toBe("snapshot");
  });
});
