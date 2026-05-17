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

    expect(document.querySelector("h1")?.ariaLabel).toBe("雷霆UNOplus");
    expect(document.querySelector<HTMLInputElement>("#nickname")?.value?.startsWith("\u73A9\u5BB6")).toBe(true);
    expect(document.querySelector<HTMLInputElement>("#nickname")?.value?.slice(2)).toMatch(/^\d{4}$/);
    expect(document.querySelector("#create-room-button")).not.toBeNull();
    expect(document.querySelector("#create-custom-room-button")).toBeNull();
    expect(document.querySelector("#join-room-button")).not.toBeNull();
    expect(document.querySelector("#rename-player-button")).not.toBeNull();
    expect(document.querySelector("#lobby-music-toggle-button")).not.toBeNull();
    expect(document.querySelector("#room-id-input")).not.toBeNull();
    expect(document.querySelectorAll(".room-code-digit")).toHaveLength(6);
    expect(document.querySelector("#lobby-chat-input")).not.toBeNull();
    expect(document.querySelector("#lobby-chat-send-button")).not.toBeNull();
    expect(document.querySelector("[data-testid='lobby-rule-button']")?.textContent).toContain("规则");
    expect(document.querySelectorAll(".rule-entry-button")).toHaveLength(0);
    expect(document.querySelector("#error-line")).not.toBeNull();
    expect(document.querySelector(".status")).not.toBeNull();

    expect(FakeWebSocket.instances).toHaveLength(1);

    const socket = FakeWebSocket.instances[0];
    expect(socket).toBeDefined();
    socket?.triggerOpen();
    expect(document.querySelector("[data-testid='connection-status']")?.textContent).toContain("open");

    const reconnectMessage = socket?.sentMessages
      .map((message) => JSON.parse(message))
      .find((message) => message.type === "reconnect");

    expect(reconnectMessage).toMatchObject({
      type: "reconnect",
      roomId: "room-123",
      userId: "user-123"
    });
  });

  it("opens the lobby rules guide and maps card intro buttons to rule images", async () => {
    await import("../main");

    document.querySelector<HTMLButtonElement>("#lobby-rule-button")?.click();
    expect(document.querySelectorAll(".rule-entry-button")).toHaveLength(4);
    expect(document.querySelector<HTMLButtonElement>("[data-rule-entry='challenge']")?.disabled).toBe(false);

    document.querySelector<HTMLButtonElement>("[data-rule-entry='challenge']")?.click();
    expect(document.querySelector<HTMLImageElement>(".rule-image-viewer img")?.getAttribute("src")).toBe(
      "/rules/\u8d28\u7591\u73a9\u6cd5.png"
    );

    document.querySelector<HTMLButtonElement>("#rule-back-button")?.click();
    document.querySelector<HTMLButtonElement>("[data-rule-entry='cards']")?.click();

    expect(document.querySelector("[data-testid='rule-card-grid']")).not.toBeNull();
    expect(document.querySelectorAll("[data-rule-card]")).toHaveLength(12);
    expect(document.querySelectorAll(".rule-card-index")).toHaveLength(12);

    document.querySelector<HTMLButtonElement>("[data-rule-card='draw-two']")?.click();
    expect(document.querySelector("[data-testid='rule-modal']")?.textContent).toContain("2. ");
    expect(document.querySelector<HTMLImageElement>(".rule-image-viewer img")?.getAttribute("src")).toBe(
      "/rules/卡牌规则23.png"
    );

    document.querySelector<HTMLButtonElement>("#rule-next-card-button")?.click();
    expect(document.querySelector("[data-testid='rule-modal']")?.textContent).toContain("3. ");
    expect(document.querySelector<HTMLImageElement>(".rule-image-viewer img")?.getAttribute("src")).toBe(
      "/rules/卡牌规则23.png"
    );
    expect(document.querySelector<HTMLButtonElement>("#rule-prev-card-button")?.textContent).toBe("‹");
    expect(document.querySelector<HTMLButtonElement>("#rule-next-card-button")?.textContent).toBe("›");
    expect(document.querySelector("#rule-prev-button")).toBeNull();
    expect(document.querySelector("#rule-next-button")).toBeNull();
  });

  it("lets non-host players stay or leave from the finished game modal", async () => {
    await import("../main");

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
        status: "playing",
        mode: "no-challenge",
        hostPlayerId: "player-host",
        snapshotVersion: 1,
        players: [
          {
            playerId: "player-host",
            displayName: "host",
            avatarUrl: null,
            seatIndex: 0,
            isHost: true,
            isReady: true,
            connectionStatus: "connected"
          },
          {
            playerId: "player-2",
            displayName: "guest",
            avatarUrl: null,
            seatIndex: 1,
            isHost: false,
            isReady: true,
            connectionStatus: "connected"
          },
          {
            playerId: "player-3",
            displayName: "winner",
            avatarUrl: null,
            seatIndex: 2,
            isHost: false,
            isReady: true,
            connectionStatus: "connected"
          }
        ]
      }
    });

    const topCard = {
      id: "blue-1",
      kind: "number",
      color: "blue",
      number: 1,
      isBlack: false,
      displayName: "blue 1"
    };
    const buildFinishedSnapshot = (winnerPlayerIds: string[]) => ({
      roomId: "ROOM1",
      snapshotVersion: 2,
      status: "finished",
      mode: "no-challenge",
      currentPlayerId: "player-2",
      currentColor: "blue",
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
      winnerPlayerIds,
      self: {
        playerId: "player-2",
        displayName: "guest",
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
          playerId: "player-host",
          displayName: "host",
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
          displayName: "winner",
          avatarUrl: null,
          handCount: 0,
          hasCalledUno: false,
          unoPendingSinceMs: null,
          unoProtectionStartedAtMs: null,
          unoProtectionEndsAtMs: null,
          isEliminated: false,
          isCurrentPlayer: false
        }
      ]
    });

    socket?.triggerMessage({
      protocolVersion: "0.1.0",
      type: "snapshot",
      roomId: "ROOM1",
      playerId: "player-2",
      snapshotVersion: 2,
      snapshot: buildFinishedSnapshot(["player-host"])
    });

    expect(document.querySelector("[data-testid='restart-game-button']")).toBeNull();
    expect(document.querySelector("[data-testid='stay-in-room-button']")).not.toBeNull();
    expect(document.querySelector("[data-testid='finish-leave-room-button']")).not.toBeNull();

    document.querySelector<HTMLButtonElement>("[data-testid='stay-in-room-button']")?.click();
    expect(document.querySelector("[data-testid='event-modal']")).toBeNull();
    expect(document.querySelector("[data-testid='battle-view']")).not.toBeNull();

    socket?.triggerMessage({
      protocolVersion: "0.1.0",
      type: "snapshot",
      roomId: "ROOM1",
      playerId: "player-2",
      snapshotVersion: 3,
      snapshot: buildFinishedSnapshot(["player-3"])
    });
    document.querySelector<HTMLButtonElement>("[data-testid='finish-leave-room-button']")?.click();

    const leaveRoomMessage = socket?.sentMessages
      .map((message) => JSON.parse(message))
      .find((message) => message.type === "leave-room" && message.roomId === "ROOM1");

    expect(leaveRoomMessage).toMatchObject({
      type: "leave-room",
      roomId: "ROOM1",
      playerId: "player-2"
    });
    expect(document.querySelector("[data-testid='lobby-view']")).not.toBeNull();
  });

  it("generates room ids on the server and joins from the six digit room code inputs", async () => {
    await import("../main");

    const socket = FakeWebSocket.instances[0];
    socket?.triggerOpen();

    document.querySelector<HTMLButtonElement>("#create-room-button")?.click();

    document.querySelectorAll<HTMLInputElement>("[data-room-code-index]").forEach((input, index) => {
      input.value = String(index + 1);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });

    document.querySelector<HTMLButtonElement>("#join-room-button")?.click();

    const messages = socket?.sentMessages.map((message) => JSON.parse(message)) ?? [];
    const createRoomMessage = messages.find((message) => message.type === "create-room");

    expect(document.querySelector("#create-custom-room-button")).toBeNull();
    expect(createRoomMessage).toMatchObject({ type: "create-room" });
    expect(createRoomMessage).not.toHaveProperty("roomId");
    expect(messages.find((message) => message.type === "join-room")).toMatchObject({
      type: "join-room",
      roomId: "123456"
    });
  });

  it("fills the room code inputs with the server confirmed generated room id", async () => {
    await import("../main");

    const socket = FakeWebSocket.instances[0];
    socket?.triggerOpen();

    document.querySelector<HTMLButtonElement>("#create-room-button")?.click();

    const createRoomMessage = socket?.sentMessages
      .map((message) => JSON.parse(message))
      .find((message) => message.type === "create-room");

    socket?.triggerMessage({
      protocolVersion: "0.1.0",
      type: "room-state",
      roomId: "135790",
      playerId: "player-host",
      snapshotVersion: 0,
      room: {
        roomId: "135790",
        roomCode: "135790",
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

    const roomCode = Array.from(
      document.querySelectorAll<HTMLInputElement>("[data-room-code-index]")
    )
      .map((input) => input.value)
      .join("");

    expect(roomCode).toBe("135790");
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
        roomCode: "123456",
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
        roomCode: "123456",
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
        roomCode: "123456",
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
    expect(document.querySelector("[data-testid='battle-rule-button']")).not.toBeNull();
    document.querySelector<HTMLButtonElement>("[data-testid='battle-rule-button']")?.click();
    expect(document.querySelector("[data-testid='rule-modal']")?.textContent).toContain("基础玩法");
    expect(document.querySelector("[data-testid='rule-modal']")?.textContent).toContain("质疑规则");
    expect(document.querySelector<HTMLButtonElement>("[data-rule-entry='challenge']")?.disabled).toBe(true);
    document.querySelector<HTMLButtonElement>("#close-rule-modal-button")?.click();
    expect(document.querySelector(".direction-indicator")?.textContent).toContain("顺");
    expect(document.querySelector("[data-testid='battle-view']")?.textContent).not.toContain("clockwise");
    expect(document.querySelector(".hud-primary")?.textContent).toContain("轮到你");
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
    expect(document.querySelectorAll(".lobby-identity-card [data-testid='room-player']")).toHaveLength(3);
    expect(document.querySelector(".lobby-identity-card [data-testid='room-player']")?.classList.contains("left")).toBe(true);
    expect(document.querySelector<HTMLInputElement>("#room-id-input")?.value).toBe("123456");
    expect(document.querySelector<HTMLButtonElement>("#join-room-button")?.disabled).toBe(false);
  });

  it("sends set-ready when a non-host clicks the ready button", async () => {
    await import("../main");

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
      currentPlayerId: "player-2",
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
        isCurrentPlayer: false
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
      currentPlayerId: "player-2",
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
        isCurrentPlayer: false
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
          isCurrentPlayer: true
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
    const redDrawFour = {
      id: "red-draw-four",
      kind: "draw-four",
      color: "red",
      drawValue: 4,
      isBlack: false,
      displayName: "red +4"
    };
    const yellowDrawFour = {
      id: "yellow-draw-four",
      kind: "draw-four",
      color: "yellow",
      drawValue: 4,
      isBlack: false,
      displayName: "yellow +4"
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
          cardIds: ["green-3", "red-1", "blue-2"],
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
    expect([...document.querySelectorAll<HTMLImageElement>(".latest-play-card")].map((image) => image.alt)).toEqual([
      "red 1",
      "blue 2",
      "green 3"
    ]);

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

    socket?.triggerMessage({
      protocolVersion: "0.1.0",
      type: "snapshot",
      roomId: "ROOM1",
      playerId: "player-1",
      snapshotVersion: 3,
      snapshot: {
        ...snapshot,
        snapshotVersion: 3,
        topCard: blackDrawSix,
        discardPile: [red1, redDrawTwo, blackDrawSix],
        drawStack: {
          active: false,
          amount: 0,
          previousDrawValue: null,
          previousDrawKind: null,
          targetPlayerId: null
        }
      }
    });

    socket?.triggerMessage({
      protocolVersion: "0.1.0",
      type: "snapshot",
      roomId: "ROOM1",
      playerId: "player-1",
      snapshotVersion: 4,
      snapshot: {
        ...snapshot,
        snapshotVersion: 4,
        topCard: yellowDrawFour,
        discardPile: [red1, redDrawTwo, blackDrawSix, redDrawFour, yellowDrawFour],
        drawStack: {
          active: true,
          amount: 8,
          previousDrawValue: 4,
          previousDrawKind: "draw-four",
          targetPlayerId: "player-1"
        }
      }
    });

    expect(document.querySelector("[data-testid='active-draw-chain']")).not.toBeNull();
    expect([...document.querySelectorAll<HTMLImageElement>(".draw-chain-card")].map((image) => image.alt)).toEqual([
      "red +4",
      "yellow +4"
    ]);

    socket?.triggerMessage({
      protocolVersion: "0.1.0",
      type: "events",
      roomId: "ROOM1",
      snapshotVersion: 5,
      events: [
        {
          type: "cards-drawn",
          playerId: "player-1",
          count: 8,
          reason: "draw-stack"
        }
      ]
    });

    expect(document.querySelector("[data-testid='draw-stack-explosion']")).not.toBeNull();
    expect(document.querySelector("[data-testid='draw-stack-explosion']")?.getAttribute("data-draw-count")).toBe("8");
  });

  it("does not highlight colored +4 after black reverse +4 draw stack", async () => {
    await import("../main");

    const socket = FakeWebSocket.instances[0];
    socket?.triggerOpen();

    const wildReverseDrawFour = {
      id: "black-reverse-four",
      kind: "wild-reverse-draw-four",
      drawValue: 4,
      isBlack: true,
      displayName: "black reverse +4"
    };
    const redDrawFour = {
      id: "red-draw-four",
      kind: "draw-four",
      color: "red",
      drawValue: 4,
      isBlack: false,
      displayName: "red +4"
    };

    socket?.triggerMessage({
      protocolVersion: "0.1.0",
      type: "snapshot",
      roomId: "ROOM1",
      playerId: "player-1",
      snapshotVersion: 1,
      snapshot: {
        roomId: "ROOM1",
        snapshotVersion: 1,
        status: "in-progress",
        mode: "no-challenge",
        currentPlayerId: "player-1",
        currentColor: "red",
        direction: "counter-clockwise",
        topCard: wildReverseDrawFour,
        discardPile: [wildReverseDrawFour],
        drawPileCount: 80,
        drawStack: {
          active: true,
          amount: 4,
          previousDrawValue: 4,
          previousDrawKind: "wild-reverse-draw-four",
          targetPlayerId: "player-1"
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
          hand: [redDrawFour],
          handCount: 1,
          hasCalledUno: false,
          unoPendingSinceMs: null,
          unoProtectionStartedAtMs: null,
          unoProtectionEndsAtMs: null,
          isEliminated: false,
          isCurrentPlayer: true
        },
        opponents: []
      }
    });

    const cardButton = document.querySelector<HTMLButtonElement>("[data-card-id='red-draw-four']");
    expect(cardButton?.dataset.cardState).toBe("disabled");
    expect(cardButton?.classList.contains("playable")).toBe(false);
  });
  it("sends rename-player from the lobby rename button and blocks overlong names", async () => {
    await import("../main");

    const socket = FakeWebSocket.instances[0];
    socket?.triggerOpen();

    socket?.triggerMessage({
      protocolVersion: "0.1.0",
      type: "room-state",
      roomId: "ROOM1",
      playerId: "player-1",
      snapshotVersion: 1,
      room: {
        roomId: "ROOM1",
        roomCode: "ROOM1",
        status: "lobby",
        mode: "no-challenge",
        hostPlayerId: "player-1",
        snapshotVersion: 1,
        players: [
          {
            playerId: "player-1",
            displayName: "Old Name",
            avatarUrl: null,
            seatIndex: 0,
            isHost: true,
            isReady: true,
            connectionStatus: "connected"
          }
        ]
      }
    });

    const nicknameInput = document.querySelector<HTMLInputElement>("#nickname")!;
    nicknameInput.value = "New Name";
    document.querySelector<HTMLButtonElement>("#rename-player-button")?.click();

    const renameMessage = socket?.sentMessages
      .map((message) => JSON.parse(message))
      .find((message) => message.type === "rename-player");

    expect(renameMessage).toMatchObject({
      type: "rename-player",
      roomId: "ROOM1",
      playerId: "player-1",
      nickname: "New Name"
    });

    const sentCount = socket?.sentMessages.length ?? 0;
    nicknameInput.value = "123456789012345678901";
    document.querySelector<HTMLButtonElement>("#rename-player-button")?.click();

    expect(socket?.sentMessages).toHaveLength(sentCount);
    expect(document.querySelector(".ui-toast")?.textContent).toContain("20");
  });

  it("simplifies lobby bot display and hides the seed input", async () => {
    await import("../main");

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
            displayName: "Host",
            avatarUrl: null,
            seatIndex: 0,
            isHost: true,
            isReady: true,
            isBot: false,
            connectionStatus: "connected"
          },
          {
            playerId: "player-2",
            displayName: "Guest",
            avatarUrl: null,
            seatIndex: 1,
            isHost: false,
            isReady: true,
            isBot: false,
            connectionStatus: "connected"
          },
          {
            playerId: "bot-1",
            displayName: "雷霆bot1",
            avatarUrl: null,
            seatIndex: 2,
            isHost: false,
            isReady: true,
            isBot: true,
            connectionStatus: "connected"
          }
        ]
      }
    });

    const botPill = document.querySelector<HTMLElement>(".lobby-identity-card [data-room-bot='true']");

    expect(botPill).not.toBeNull();
    expect(botPill?.querySelector(".lobby-seat-name")?.textContent).toContain("雷霆bot1");
    expect(botPill?.textContent).not.toContain("BOT");
    expect(botPill?.querySelector(".lobby-seat-status")?.textContent).toContain("机器人");
  });

  it("counts penalty draw toast messages and resets when resolved", async () => {
    await import("../main");

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

    socket?.triggerMessage({
      protocolVersion: "0.1.0",
      type: "snapshot",
      roomId: "ROOM1",
      playerId: "player-1",
      snapshotVersion: 0,
      snapshot: {
        roomId: "ROOM1",
        snapshotVersion: 0,
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
          active: true,
          color: "red",
          targetPlayerId: "player-1"
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
      }
    });

    socket?.triggerMessage({
      protocolVersion: "0.1.0",
      type: "events",
      roomId: "ROOM1",
      snapshotVersion: 1,
      events: [
        {
          type: "draw-until-color-started",
          targetPlayerId: "player-1",
          color: "red"
        },
        {
          type: "cards-drawn",
          playerId: "player-1",
          count: 1,
          reason: "draw-until-color",
          drawUntilColor: {
            targetColor: "red",
            revealedColor: "blue",
            matched: false
          }
        }
      ]
    });

    expect(document.querySelector(".ui-toast")?.textContent).toContain("第 1 张");
    expect(document.querySelector("[data-testid='penalty-question-burst']")?.getAttribute("data-draw-index")).toBe("1");
    expect(document.querySelectorAll(".penalty-question")).toHaveLength(1);

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
          reason: "draw-until-color",
          drawUntilColor: {
            targetColor: "red",
            revealedColor: "red",
            matched: true
          }
        },
        {
          type: "draw-until-color-resolved",
          targetPlayerId: "player-1",
          color: "red",
          drawnCount: 1
        }
      ]
    });

    expect(document.querySelector(".ui-toast")?.textContent).toContain("第 2 张");
    expect(document.querySelector(".ui-toast")?.textContent).toContain("罚摸结束");
    expect(document.querySelector("[data-testid='penalty-question-burst']")?.getAttribute("data-draw-index")).toBe("2");
    expect(document.querySelectorAll(".penalty-question")).toHaveLength(2);
  });
});



