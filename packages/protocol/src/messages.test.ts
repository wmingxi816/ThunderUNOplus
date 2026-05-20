import { describe, expect, it } from "vitest";
import type {
  ClientAddBotMessage,
  ClientBattleChatMessage,
  ClientCreateRoomMessage,
  ClientCommandMessage,
  ClientLobbyChatMessage,
  ClientRenamePlayerMessage,
  ClientStartGameMessage,
  ServerEventsMessage,
  ServerLobbyChatMessage,
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

  it("可以构造带 botType 的 ClientAddBotMessage", () => {
    const message: ClientAddBotMessage = {
      protocolVersion: PROTOCOL_VERSION,
      type: "add-bot",
      requestId: "req-add-bot-1",
      roomId: "room-1",
      playerId: "player-1",
      botType: "mischief",
      timestampMs: 1000
    };

    expect(message.botType).toBe("mischief");
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
            isReady: true,
            isBot: false,
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
        roundDecisionPending: false,
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
        initialDirectionChoice: {
          active: false,
          chooserPlayerId: null
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
          isRoundWinner: false,
          hasLeftRoom: false,
          isCurrentPlayer: true,
          isBot: false
        },
        opponents: []
      }
    };

    expect(message.type).toBe("snapshot");
  });

  it("可以构造 ClientBattleChatMessage", () => {
    const message: ClientBattleChatMessage = {
      protocolVersion: PROTOCOL_VERSION,
      type: "battle-chat",
      requestId: "req-chat-1",
      roomId: "room-1",
      playerId: "player-1",
      text: "先别急着出黑牌",
      timestampMs: 1000
    };

    expect(message.type).toBe("battle-chat");
    expect(message.text).toBe("先别急着出黑牌");
  });

  it("可以构造 ClientLobbyChatMessage", () => {
    const message: ClientLobbyChatMessage = {
      protocolVersion: PROTOCOL_VERSION,
      type: "lobby-chat",
      requestId: "req-lobby-chat-1",
      roomId: "room-1",
      playerId: "player-1",
      text: "都准备一下，马上开",
      timestampMs: 1000
    };

    expect(message.type).toBe("lobby-chat");
    expect(message.text).toBe("都准备一下，马上开");
  });

  it("可以构造 ServerLobbyChatMessage", () => {
    const message: ServerLobbyChatMessage = {
      protocolVersion: PROTOCOL_VERSION,
      type: "lobby-chat",
      roomId: "room-1",
      playerId: "player-1",
      text: "房主已创建房间",
      timestampMs: 1000
    };

    expect(message.type).toBe("lobby-chat");
    expect(message.roomId).toBe("room-1");
  });
  it("can construct ClientRenamePlayerMessage", () => {
    const message: ClientRenamePlayerMessage = {
      protocolVersion: PROTOCOL_VERSION,
      type: "rename-player",
      requestId: "req-rename-1",
      roomId: "room-1",
      playerId: "player-1",
      nickname: "New Name",
      timestampMs: 1000
    };

    expect(message.type).toBe("rename-player");
    expect(message.nickname).toBe("New Name");
  });
});
