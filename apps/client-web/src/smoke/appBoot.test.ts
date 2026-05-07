// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

class FakeWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static instances: FakeWebSocket[] = [];

  readyState = FakeWebSocket.CONNECTING;
  readonly sentMessages: string[] = [];
  private readonly listeners = new Map<string, Set<(event: unknown) => void>>();

  constructor(readonly url: string) {
    FakeWebSocket.instances.push(this);
  }

  addEventListener(type: string, listener: (event: unknown) => void): void {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  send(data: string): void {
    this.sentMessages.push(data);
  }

  triggerMessage(data: unknown): void {
    this.emit("message", {
      data: JSON.stringify(data)
    });
  }

  close(): void {
    this.readyState = FakeWebSocket.CLOSED;
    this.emit("close", {});
  }

  triggerOpen(): void {
    this.readyState = FakeWebSocket.OPEN;
    this.emit("open", {});
  }

  private emit(type: string, event: unknown): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }
}

describe("client-web smoke", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    localStorage.clear();
    sessionStorage.clear();
    FakeWebSocket.instances = [];
    vi.stubGlobal("WebSocket", FakeWebSocket as unknown as typeof WebSocket);
    vi.resetModules();
  });

  it("boots the shell and can send reconnect on open", async () => {
    sessionStorage.setItem("thunder-uno.lastRoomId", "room-123");
    sessionStorage.setItem("thunder-uno.userId", "user-123");

    await import("../main");

    expect(document.querySelector("h1")?.textContent).toBe("雷霆UNOplus");
    expect(document.querySelector<HTMLInputElement>("#ws-url")?.value).toBe("ws://localhost:8787");
    const nickname = document.querySelector<HTMLInputElement>("#nickname")?.value;
    expect(nickname?.startsWith("\u73A9\u5BB6")).toBe(true);
    expect(nickname?.slice(2)).toMatch(/^\d{4}$/);
    expect(document.querySelector("#create-room-button")).not.toBeNull();
    expect(document.querySelector("#join-room-button")).not.toBeNull();
    expect(document.querySelector("#room-id-input")).not.toBeNull();
    expect(document.querySelector("#error-line")).not.toBeNull();
    expect(document.querySelector(".status")).not.toBeNull();

    const connectButton = document.querySelector<HTMLButtonElement>("#connect-button");
    expect(connectButton).not.toBeNull();
    connectButton?.click();

    const socket = FakeWebSocket.instances[0];
    expect(socket).toBeDefined();
    socket?.triggerOpen();

    const reconnectMessage = socket?.sentMessages
      .map((message) => JSON.parse(message))
      .find((message) => message.type === "reconnect");

    expect(reconnectMessage).toMatchObject({
      type: "reconnect",
      roomId: "room-123",
      userId: "user-123"
    });
  });

  it("does not reuse a cloned tab identity on normal navigation", async () => {
    vi.spyOn(performance, "getEntriesByType").mockImplementation((type) => {
      if (type === "navigation") {
        return [{ type: "navigate" } as PerformanceNavigationTiming];
      }

      return [];
    });
    sessionStorage.setItem("thunder-uno.lastRoomId", "room-123");
    sessionStorage.setItem("thunder-uno.userId", "user-123");
    sessionStorage.setItem("thunder-uno.nickname", "owner-copy");

    await import("../main");

    const connectButton = document.querySelector<HTMLButtonElement>("#connect-button");
    connectButton?.click();

    const socket = FakeWebSocket.instances[0];
    socket?.triggerOpen();

    const reconnectMessage = socket?.sentMessages
      .map((message) => JSON.parse(message))
      .find((message) => message.type === "reconnect");

    expect(reconnectMessage).toBeUndefined();

    document.querySelector<HTMLButtonElement>("#create-room-button")?.click();

    const createRoomMessage = socket?.sentMessages
      .map((message) => JSON.parse(message))
      .find((message) => message.type === "create-room");

    expect(createRoomMessage.userId).not.toBe("user-123");
    expect(createRoomMessage.nickname).not.toBe("owner-copy");
  });

  it("switches the host from lobby to battle when a start-game snapshot arrives", async () => {
    await import("../main");

    const connectButton = document.querySelector<HTMLButtonElement>("#connect-button");
    connectButton?.click();

    const socket = FakeWebSocket.instances[0];
    socket?.triggerOpen();

    document.querySelector<HTMLButtonElement>("#create-room-button")?.click();

    const createRoomMessage = socket?.sentMessages
      .map((message) => JSON.parse(message))
      .find((message) => message.type === "create-room");

    socket?.triggerMessage({
      protocolVersion: "0.1.0",
      type: "room-state",
      roomId: "ROOM1",
      playerId: "player-host",
      snapshotVersion: 0,
      room: {
        roomId: "ROOM1",
        roomCode: "ROOM1",
        status: "lobby",
        mode: createRoomMessage.mode,
        hostPlayerId: "player-host",
        snapshotVersion: 0,
        players: [
          {
            playerId: "player-host",
            displayName: createRoomMessage.nickname,
            avatarUrl: null,
            seatIndex: 0,
            isHost: true,
            isReady: true,
            connectionStatus: "connected"
          }
        ]
      }
    });

    const disabledStartButton = document.querySelector<HTMLButtonElement>("#start-game-button");
    expect(disabledStartButton?.disabled).toBe(true);
    expect(disabledStartButton?.title).toBe("至少 3 人才能开始。");

    socket?.triggerMessage({
      protocolVersion: "0.1.0",
      type: "room-state",
      roomId: "ROOM1",
      playerId: "player-host",
      snapshotVersion: 1,
      room: {
        roomId: "ROOM1",
        roomCode: "ROOM1",
        status: "lobby",
        mode: createRoomMessage.mode,
        hostPlayerId: "player-host",
        snapshotVersion: 1,
        players: [
          {
            playerId: "player-host",
            displayName: createRoomMessage.nickname,
            avatarUrl: null,
            seatIndex: 0,
            isHost: true,
            isReady: true,
            connectionStatus: "connected"
          },
          {
            playerId: "player-2",
            displayName: "player-2",
            avatarUrl: null,
            seatIndex: 1,
            isHost: false,
            isReady: true,
            connectionStatus: "connected"
          },
          {
            playerId: "player-3",
            displayName: "player-3",
            avatarUrl: null,
            seatIndex: 2,
            isHost: false,
            isReady: true,
            connectionStatus: "connected"
          }
        ]
      }
    });

    expect(document.querySelector("[data-testid='lobby-view']")).not.toBeNull();

    document.querySelector<HTMLButtonElement>("#start-game-button")?.click();

    const startGameMessage = socket?.sentMessages
      .map((message) => JSON.parse(message))
      .find((message) => message.type === "start-game");

    expect(startGameMessage).toMatchObject({
      roomId: "ROOM1",
      playerId: "player-host"
    });

    socket?.triggerMessage({
      protocolVersion: "0.1.0",
      type: "room-state",
      roomId: "ROOM1",
      playerId: "player-host",
      snapshotVersion: 2,
      room: {
        roomId: "ROOM1",
        roomCode: "ROOM1",
        status: "playing",
        mode: createRoomMessage.mode,
        hostPlayerId: "player-host",
        snapshotVersion: 2,
        players: [
          {
            playerId: "player-host",
            displayName: createRoomMessage.nickname,
            avatarUrl: null,
            seatIndex: 0,
            isHost: true,
            isReady: true,
            connectionStatus: "connected"
          },
          {
            playerId: "player-2",
            displayName: "player-2",
            avatarUrl: null,
            seatIndex: 1,
            isHost: false,
            isReady: true,
            connectionStatus: "connected"
          },
          {
            playerId: "player-3",
            displayName: "player-3",
            avatarUrl: null,
            seatIndex: 2,
            isHost: false,
            isReady: true,
            connectionStatus: "connected"
          }
        ]
      }
    });

    const recoveryReconnectMessage = socket?.sentMessages
      .map((message) => JSON.parse(message))
      .find((message) => {
        return message.type === "reconnect" && message.roomId === "ROOM1";
      });

    expect(recoveryReconnectMessage).toMatchObject({
      type: "reconnect",
      roomId: "ROOM1",
      userId: createRoomMessage.userId
    });

    const topCard = {
      id: "red-1",
      kind: "number",
      color: "red",
      number: 1,
      isBlack: false,
      displayName: "red 1"
    };

    socket?.triggerMessage({
      protocolVersion: "0.1.0",
      type: "snapshot",
      roomId: "ROOM1",
      playerId: "player-host",
      snapshotVersion: 2,
      snapshot: {
        roomId: "ROOM1",
        snapshotVersion: 2,
        status: "in-progress",
        mode: "no-challenge",
        currentPlayerId: "player-host",
        currentColor: "red",
        direction: "clockwise",
        topCard,
        discardPile: [topCard],
        drawPileCount: 80,
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
        challengeWindow: {
          active: false,
          targetPlayerId: null
        },
        winnerPlayerIds: [],
        self: {
          playerId: "player-host",
          displayName: createRoomMessage.nickname,
          avatarUrl: null,
          hand: [],
          handCount: 0,
          hasCalledUno: false,
          unoPendingSinceMs: null,
          unoProtectionStartedAtMs: null,
          unoProtectionEndsAtMs: null,
          isEliminated: false,
          isCurrentPlayer: true
        },
        opponents: [
          {
            playerId: "player-2",
            displayName: "player-2",
            avatarUrl: null,
            handCount: 7,
            hasCalledUno: false,
            unoPendingSinceMs: null,
            unoProtectionStartedAtMs: null,
            unoProtectionEndsAtMs: null,
            isEliminated: false,
            isCurrentPlayer: false
          },
          {
            playerId: "player-3",
            displayName: "player-3",
            avatarUrl: null,
            handCount: 7,
            hasCalledUno: false,
            unoPendingSinceMs: null,
            unoProtectionStartedAtMs: null,
            unoProtectionEndsAtMs: null,
            isEliminated: false,
            isCurrentPlayer: false
          }
        ]
      }
    });

    expect(document.querySelector("[data-testid='battle-view']")).not.toBeNull();
    expect(document.querySelector("[data-testid='lobby-view']")).toBeNull();
    expect(document.querySelector(".direction-indicator")?.textContent).toContain("顺");
    expect(document.querySelector("[data-testid='battle-view']")?.textContent).not.toContain("clockwise");
    expect(document.querySelector(".seat.current .seat-badge")?.textContent).toContain("轮到你");
    expect(document.querySelector<HTMLButtonElement>("#play-button")?.disabled).toBe(true);
    expect(document.querySelector<HTMLButtonElement>("#play-button")?.title).toContain("出牌");

    document.querySelector<HTMLButtonElement>("#battle-leave-room-button")?.click();

    const leaveRoomMessage = socket?.sentMessages
      .map((message) => JSON.parse(message))
      .find((message) => message.type === "leave-room" && message.roomId === "ROOM1");

    expect(leaveRoomMessage).toMatchObject({
      type: "leave-room",
      roomId: "ROOM1",
      playerId: "player-host"
    });
    expect(document.querySelector("[data-testid='battle-view']")).toBeNull();
    expect(document.querySelector("[data-testid='lobby-view']")).not.toBeNull();
  });

  it("sends set-ready when a non-host clicks the ready button", async () => {
    await import("../main");

    document.querySelector<HTMLButtonElement>("#connect-button")?.click();

    const socket = FakeWebSocket.instances[0];
    socket?.triggerOpen();

    socket?.triggerMessage({
      protocolVersion: "0.1.0",
      type: "room-state",
      roomId: "ROOM1",
      playerId: "player-2",
      snapshotVersion: 1,
      room: {
        roomId: "ROOM1",
        roomCode: "ROOM1",
        status: "lobby",
        mode: "no-challenge",
        hostPlayerId: "player-host",
        snapshotVersion: 1,
        players: [
          {
            playerId: "player-host",
            displayName: "房主",
            avatarUrl: null,
            seatIndex: 0,
            isHost: true,
            isReady: true,
            connectionStatus: "connected"
          },
          {
            playerId: "player-2",
            displayName: "玩家2",
            avatarUrl: null,
            seatIndex: 1,
            isHost: false,
            isReady: false,
            connectionStatus: "connected"
          }
        ]
      }
    });

    const readyButton = document.querySelector<HTMLButtonElement>("#ready-button");
    expect(readyButton?.disabled).toBe(false);
    expect(readyButton?.textContent).toBe("准备");

    readyButton?.click();

    const readyMessage = socket?.sentMessages
      .map((message) => JSON.parse(message))
      .find((message) => message.type === "set-ready");

    expect(readyMessage).toMatchObject({
      type: "set-ready",
      roomId: "ROOM1",
      playerId: "player-2",
      ready: true
    });
  });

  it("marks newly drawn self cards and renders a draw animation", async () => {
    await import("../main");

    document.querySelector<HTMLButtonElement>("#connect-button")?.click();

    const socket = FakeWebSocket.instances[0];
    socket?.triggerOpen();

    const topCard = {
      id: "red-1",
      kind: "number",
      color: "red",
      number: 1,
      isBlack: false,
      displayName: "red 1"
    };
    const initialCard = {
      id: "blue-2",
      kind: "number",
      color: "blue",
      number: 2,
      isBlack: false,
      displayName: "blue 2"
    };
    const drawnCard = {
      id: "red-3",
      kind: "number",
      color: "red",
      number: 3,
      isBlack: false,
      displayName: "red 3"
    };
    const baseSnapshot = {
      roomId: "ROOM1",
      snapshotVersion: 1,
      status: "in-progress",
      mode: "no-challenge",
      currentPlayerId: "player-1",
      currentColor: "red",
      direction: "clockwise",
      topCard,
      discardPile: [topCard],
      drawPileCount: 80,
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
      challengeWindow: {
        active: false,
        targetPlayerId: null
      },
      winnerPlayerIds: [],
      self: {
        playerId: "player-1",
        displayName: "player-1",
        avatarUrl: null,
        hand: [initialCard],
        handCount: 1,
        hasCalledUno: false,
        unoPendingSinceMs: null,
        unoProtectionStartedAtMs: null,
        unoProtectionEndsAtMs: null,
        isEliminated: false,
        isCurrentPlayer: true
      },
      opponents: []
    };

    socket?.triggerMessage({
      protocolVersion: "0.1.0",
      type: "snapshot",
      roomId: "ROOM1",
      playerId: "player-1",
      snapshotVersion: 1,
      snapshot: baseSnapshot
    });

    socket?.triggerMessage({
      protocolVersion: "0.1.0",
      type: "events",
      roomId: "ROOM1",
      snapshotVersion: 2,
      events: [
        {
          type: "cards-drawn",
          playerId: "player-1",
          count: 1,
          reason: "normal-draw"
        }
      ]
    });

    expect(document.querySelector(".draw-flying-card")).not.toBeNull();

    socket?.triggerMessage({
      protocolVersion: "0.1.0",
      type: "snapshot",
      roomId: "ROOM1",
      playerId: "player-1",
      snapshotVersion: 2,
      snapshot: {
        ...baseSnapshot,
        snapshotVersion: 2,
        self: {
          ...baseSnapshot.self,
          hand: [initialCard, drawnCard],
          handCount: 2
        }
      }
    });

    expect(document.querySelector(".card-button.recent-drawn")?.getAttribute("data-card-id")).toBe("red-3");

    socket?.triggerMessage({
      protocolVersion: "0.1.0",
      type: "events",
      roomId: "ROOM1",
      snapshotVersion: 3,
      events: [
        {
          type: "cards-played",
          playerId: "player-1",
          cardIds: ["red-3"],
          topCardId: "red-3"
        }
      ]
    });

    expect(document.querySelector(".card-button.recent-drawn")).toBeNull();
  });

  it("shows UNO, elimination and victory feedback in battle UI", async () => {
    await import("../main");

    document.querySelector<HTMLButtonElement>("#connect-button")?.click();

    const socket = FakeWebSocket.instances[0];
    socket?.triggerOpen();

    const now = Date.now();
    const topCard = {
      id: "red-1",
      kind: "number",
      color: "red",
      number: 1,
      isBlack: false,
      displayName: "red 1"
    };
    const lastCard = {
      id: "blue-2",
      kind: "number",
      color: "blue",
      number: 2,
      isBlack: false,
      displayName: "blue 2"
    };
    const snapshot = {
      roomId: "ROOM1",
      snapshotVersion: 1,
      status: "in-progress",
      mode: "no-challenge",
      currentPlayerId: "player-1",
      currentColor: "red",
      direction: "clockwise",
      topCard,
      discardPile: [topCard],
      drawPileCount: 80,
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
        displayName: "player-1",
        avatarUrl: null,
        hand: [lastCard],
        handCount: 1,
        hasCalledUno: false,
        unoPendingSinceMs: now - 500,
        unoProtectionStartedAtMs: now - 500,
        unoProtectionEndsAtMs: now + 2500,
        isEliminated: false,
        isCurrentPlayer: true
      },
      opponents: [
        {
          playerId: "player-2",
          displayName: "player-2",
          avatarUrl: null,
          handCount: 7,
          hasCalledUno: false,
          unoPendingSinceMs: null,
          unoProtectionStartedAtMs: null,
          unoProtectionEndsAtMs: null,
          isEliminated: false,
          isCurrentPlayer: false
        }
      ]
    };

    socket?.triggerMessage({
      protocolVersion: "0.1.0",
      type: "snapshot",
      roomId: "ROOM1",
      playerId: "player-1",
      snapshotVersion: 1,
      snapshot
    });

    const sayUnoButton = document.querySelector<HTMLButtonElement>("#say-uno-button");
    expect(sayUnoButton?.disabled).toBe(false);
    sayUnoButton?.click();

    const sayUnoMessage = socket?.sentMessages
      .map((message) => JSON.parse(message))
      .find((message) => message.type === "command" && message.command.type === "say-uno");

    expect(sayUnoMessage).toMatchObject({
      type: "command",
      command: {
        type: "say-uno"
      }
    });

    socket?.triggerMessage({
      protocolVersion: "0.1.0",
      type: "events",
      roomId: "ROOM1",
      snapshotVersion: 2,
      events: [
        {
          type: "player-eliminated",
          playerId: "player-2",
          handCount: 26,
          reason: "hand-limit"
        }
      ]
    });

    expect(document.querySelector("[data-testid='event-modal']")?.textContent).toContain("已出局");

    document.querySelector<HTMLButtonElement>("#close-event-modal-button")?.click();

    socket?.triggerMessage({
      protocolVersion: "0.1.0",
      type: "snapshot",
      roomId: "ROOM1",
      playerId: "player-1",
      snapshotVersion: 3,
      snapshot: {
        ...snapshot,
        snapshotVersion: 3,
        status: "finished",
        winnerPlayerIds: ["player-1"]
      }
    });

    expect(document.querySelector("[data-testid='event-modal']")?.textContent).toContain("获胜");
  });

  it("renders latest multi-card plays and active draw chains on the discard pile", async () => {
    await import("../main");

    document.querySelector<HTMLButtonElement>("#connect-button")?.click();

    const socket = FakeWebSocket.instances[0];
    socket?.triggerOpen();

    const red1 = {
      id: "red-1",
      kind: "number",
      color: "red",
      number: 1,
      isBlack: false,
      displayName: "red 1"
    };
    const blue2 = {
      id: "blue-2",
      kind: "number",
      color: "blue",
      number: 2,
      isBlack: false,
      displayName: "blue 2"
    };
    const green3 = {
      id: "green-3",
      kind: "number",
      color: "green",
      number: 3,
      isBlack: false,
      displayName: "green 3"
    };
    const redDrawTwo = {
      id: "red-draw-two",
      kind: "draw-two",
      color: "red",
      drawValue: 2,
      isBlack: false,
      displayName: "red +2"
    };
    const blackDrawSix = {
      id: "black-draw-six",
      kind: "wild-draw-six",
      drawValue: 6,
      isBlack: true,
      displayName: "black +6"
    };
    const snapshot = {
      roomId: "ROOM1",
      snapshotVersion: 1,
      status: "in-progress",
      mode: "no-challenge",
      currentPlayerId: "player-1",
      currentColor: "red",
      direction: "clockwise",
      topCard: green3,
      discardPile: [red1, blue2, green3],
      drawPileCount: 80,
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
        displayName: "player-1",
        avatarUrl: null,
        hand: [],
        handCount: 0,
        hasCalledUno: false,
        unoPendingSinceMs: null,
        unoProtectionStartedAtMs: null,
        unoProtectionEndsAtMs: null,
        isEliminated: false,
        isCurrentPlayer: true
      },
      opponents: []
    };

    socket?.triggerMessage({
      protocolVersion: "0.1.0",
      type: "events",
      roomId: "ROOM1",
      snapshotVersion: 1,
      events: [
        {
          type: "cards-played",
          playerId: "player-1",
          cardIds: ["red-1", "blue-2", "green-3"],
          topCardId: "green-3"
        }
      ]
    });

    socket?.triggerMessage({
      protocolVersion: "0.1.0",
      type: "snapshot",
      roomId: "ROOM1",
      playerId: "player-1",
      snapshotVersion: 1,
      snapshot
    });

    expect(document.querySelector("[data-testid='latest-play-group']")?.className).toContain("sequence");
    expect(document.querySelectorAll(".latest-play-card")).toHaveLength(3);

    socket?.triggerMessage({
      protocolVersion: "0.1.0",
      type: "snapshot",
      roomId: "ROOM1",
      playerId: "player-1",
      snapshotVersion: 2,
      snapshot: {
        ...snapshot,
        snapshotVersion: 2,
        topCard: blackDrawSix,
        discardPile: [red1, redDrawTwo, blackDrawSix],
        drawStack: {
          active: true,
          amount: 8,
          previousDrawValue: 6,
          previousDrawKind: "wild-draw-six",
          targetPlayerId: "player-1"
        }
      }
    });

    expect(document.querySelector("[data-testid='active-draw-chain']")).not.toBeNull();
    expect(document.querySelectorAll(".draw-chain-card")).toHaveLength(2);

    socket?.triggerMessage({
      protocolVersion: "0.1.0",
      type: "events",
      roomId: "ROOM1",
      snapshotVersion: 3,
      events: [
        {
          type: "draw-stack-cleared",
          reason: "resolved"
        }
      ]
    });

    expect(document.querySelector("[data-testid='draw-stack-burst']")).not.toBeNull();
  });
});



