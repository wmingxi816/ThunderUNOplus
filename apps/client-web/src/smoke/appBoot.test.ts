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
            connectionStatus: "connected"
          },
          {
            playerId: "player-2",
            displayName: "player-2",
            avatarUrl: null,
            seatIndex: 1,
            isHost: false,
            connectionStatus: "connected"
          },
          {
            playerId: "player-3",
            displayName: "player-3",
            avatarUrl: null,
            seatIndex: 2,
            isHost: false,
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
            connectionStatus: "connected"
          },
          {
            playerId: "player-2",
            displayName: "player-2",
            avatarUrl: null,
            seatIndex: 1,
            isHost: false,
            connectionStatus: "connected"
          },
          {
            playerId: "player-3",
            displayName: "player-3",
            avatarUrl: null,
            seatIndex: 2,
            isHost: false,
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
          playerId: "player-host",
          displayName: createRoomMessage.nickname,
          avatarUrl: null,
          hand: [],
          handCount: 0,
          hasCalledUno: false,
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
            isEliminated: false,
            isCurrentPlayer: false
          },
          {
            playerId: "player-3",
            displayName: "player-3",
            avatarUrl: null,
            handCount: 7,
            hasCalledUno: false,
            isEliminated: false,
            isCurrentPlayer: false
          }
        ]
      }
    });

    expect(document.querySelector("[data-testid='battle-view']")).not.toBeNull();
    expect(document.querySelector("[data-testid='lobby-view']")).toBeNull();
  });
});



