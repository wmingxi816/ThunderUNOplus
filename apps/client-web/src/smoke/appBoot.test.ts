// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";

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

class FakeAudio {
  static instances: FakeAudio[] = [];

  loop = false;
  volume = 1;
  playbackRate = 1;
  currentTime = 0;
  paused = true;
  preservesPitch = true;
  webkitPreservesPitch = true;
  mozPreservesPitch = true;
  playCount = 0;
  pauseCount = 0;

  constructor(readonly src: string) {
    FakeAudio.instances.push(this);
  }

  play(): Promise<void> {
    this.paused = false;
    this.playCount += 1;
    return Promise.resolve();
  }

  pause(): void {
    this.paused = true;
    this.pauseCount += 1;
  }
}

describe("client-web smoke", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    localStorage.clear();
    sessionStorage.clear();
    FakeWebSocket.instances = [];
    FakeAudio.instances = [];
    vi.unstubAllGlobals();
    vi.stubGlobal("WebSocket", FakeWebSocket as unknown as typeof WebSocket);
    Object.defineProperty(window.navigator, "userAgent", {
      value: "jsdom-test",
      configurable: true
    });
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
    expect(Array.from(document.querySelectorAll<HTMLSelectElement>("#mode option")).map((option) => option.textContent)).toEqual([
      "无质疑",
      "敬请期待"
    ]);
    expect(document.querySelector<HTMLOptionElement>("#mode option[value='with-challenge']")?.disabled).toBe(true);
    expect(document.querySelector("#rename-player-button")).not.toBeNull();
    expect(document.querySelector("#lobby-settings-button")).not.toBeNull();
    expect(document.querySelector("#room-id-input")).not.toBeNull();
    expect(document.querySelector<HTMLInputElement>("#nickname")?.maxLength).toBe(10);
    expect(document.querySelectorAll(".room-code-digit")).toHaveLength(6);
    expect(document.querySelector("#lobby-chat-input")).not.toBeNull();
    expect(document.querySelector<HTMLInputElement>("#lobby-chat-input")?.maxLength).toBe(30);
    expect(document.querySelector("#lobby-chat-send-button")).not.toBeNull();
    expect(document.querySelector("[data-testid='lobby-rule-button']")?.textContent).toContain("规则");
    expect(document.querySelectorAll(".rule-entry-button")).toHaveLength(0);
    expect(document.querySelector("#error-line")).not.toBeNull();
    expect(document.querySelector("[data-testid='connection-status']")).not.toBeNull();

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

  it("shows static contact text and five fixed UI scale choices in settings", async () => {
    await import("../main");

    document.querySelector<HTMLButtonElement>("#lobby-settings-button")?.click();

    expect(
      Array.from(document.querySelectorAll("[data-setting-button='ui-scale']")).map((button) => button.textContent)
    ).toEqual(["20%", "40%", "60%", "80%", "100%"]);
    expect(document.querySelector("#settings-contact-button")).toBeNull();
    expect(document.querySelector("#settings-contact-content")?.textContent).toBe("QQ：2753345388");
  });

  it("scales lobby chrome and controls together instead of only shrinking text", async () => {
    await import("../main");
    const styleText = await readFile("src/styles.css", "utf8");

    document.querySelector<HTMLButtonElement>("#lobby-settings-button")?.click();
    document
      .querySelector<HTMLButtonElement>("[data-setting-button='ui-scale'][data-setting-value='20']")
      ?.click();

    const lobbyScaleContent = document.querySelector<HTMLElement>("[data-testid='lobby-scale-content']");

    expect(lobbyScaleContent).not.toBeNull();
    expect(lobbyScaleContent?.style.getPropertyValue("--lobby-ui-scale")).toBe("0.20");
    expect(styleText).not.toContain("font-size: calc(1rem * var(--lobby-ui-scale, 1));");
    expect(styleText).toContain(".lobby-scale-content");
    expect(styleText).toContain("transform: scale(var(--lobby-ui-scale, 1));");
  });

  it("opens update log in a centered closable dialog", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () => "## 2026-05-19\n- 添加混沌bot\n- 增加更新日志入口"
      })
    );

    await import("../main");

    document.querySelector<HTMLButtonElement>("#lobby-settings-button")?.click();
    document.querySelector<HTMLButtonElement>("#settings-update-log-button")?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(document.querySelector("[data-testid='update-log-dialog']")).not.toBeNull();
    expect(document.querySelector("[data-testid='update-log-dialog']")?.textContent).toContain("2026-05-19");
    expect(document.querySelector("[data-testid='update-log-dialog']")?.textContent).toContain("添加混沌bot");
    expect(document.querySelector("[data-testid='update-log-dialog']")?.textContent).toContain("增加更新日志入口");

    document.querySelector<HTMLButtonElement>("#close-update-log-button")?.click();
    expect(document.querySelector("[data-testid='update-log-dialog']")).toBeNull();
  });

  it("shows an empty update log state when update-log.md cannot be loaded", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network failed"))
    );

    await import("../main");

    document.querySelector<HTMLButtonElement>("#lobby-settings-button")?.click();
    document.querySelector<HTMLButtonElement>("#settings-update-log-button")?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(document.querySelector("[data-testid='update-log-dialog']")?.textContent).toContain("暂无更新日志");
  });

  it("keeps the lobby rule and settings buttons in the right group and enlarges player cards", async () => {
    await import("../main");

    const rightGroup = document.querySelector(".lobby-topbar-status-group");
    const settingsButton = document.querySelector("#lobby-settings-button");
    const ruleButton = document.querySelector("#lobby-rule-button");
    const styleText = await readFile("src/styles.css", "utf8");

    expect(rightGroup?.contains(settingsButton ?? null)).toBe(true);
    expect(rightGroup?.contains(ruleButton ?? null)).toBe(true);
    expect(styleText).toContain("min-height: 3.64rem");
  });

  it("brightens the lobby background instead of keeping the backdrop too dark", async () => {
    const styleText = await readFile("src/styles.css", "utf8");

    expect(styleText).toContain(".shell::before");
    expect(styleText).toContain("opacity: 0.68;");
    expect(styleText).toContain("filter: brightness(1.08) saturate(1.04);");
    expect(styleText).toContain(".lobby-storm-vignette");
    expect(styleText).toContain("rgba(2, 9, 22, 0.22)");
  });

  it("keeps lobby chat scrolling inside the panel instead of turning the whole page into a scroller", async () => {
    const styleText = await readFile("src/styles.css", "utf8");

    expect(styleText).toContain(".lobby-scale-frame");
    expect(styleText).toContain("overflow: hidden;");
    expect(styleText).toContain(".lobby-chat-feed");
    expect(styleText).toContain("overflow-y: auto;");
    expect(styleText).toContain(".lobby-chat-panel");
    expect(styleText).toContain("grid-template-rows: minmax(0, 1fr) auto;");
  });

  it("keeps lobby chat avatars and message content side by side", async () => {
    const styleText = await readFile("src/styles.css", "utf8");
    const mainText = await readFile("src/main.ts", "utf8");

    expect(styleText).toContain(".lobby-feed-item-player");
    expect(styleText).toContain("display: grid;");
    expect(styleText).toContain("grid-template-columns: 3rem minmax(0, 1fr);");
    expect(styleText).toContain(".lobby-feed-bubble");
    expect(mainText).toContain('class="lobby-feed-speaker"');
  });

  it("keeps lobby seat avatars and text adaptive on a single line", async () => {
    const styleText = await readFile("src/styles.css", "utf8");

    expect(styleText).toContain("grid-template-columns: auto minmax(0, 1fr);");
    expect(styleText).toContain("width: clamp(1.76rem, 18cqi, 2.72rem);");
    expect(styleText).toContain("font-size: var(--lobby-player-name-size, clamp(0.72rem, 7.2cqi, 1.08rem));");
    expect(styleText).toContain("font-size: clamp(0.54rem, 5.6cqi, 0.82rem);");
    expect(styleText).toContain("white-space: nowrap;");
  });

  it("upgrades lobby title effects without changing title or title-wrap sizing rules", async () => {
    const styleText = await readFile("src/styles.css", "utf8");
    const mainText = await readFile("src/main.ts", "utf8");

    expect(styleText).toContain("width: min(100%, 78rem);");
    expect(styleText).toContain("min-height: clamp(2.9rem, 5.3vw, 3.9rem);");
    expect(styleText).toContain("font-size: clamp(1.8rem, 3.6vw, 3rem);");
    expect(styleText).toContain(".lobby-title-wrap::before");
    expect(styleText).toContain(".lobby-title-wrap::after");
    expect(styleText).toContain(".lobby-title::before");
    expect(styleText).toContain(".lobby-screen-lightning");
    expect(mainText).toContain("lobby-screen-lightning");
    expect(mainText).toContain("lobby-title-bolt");
  });

  it("shows initial direction choices only for the chooser and waiting copy for others", async () => {
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

    const chooserSnapshot = {
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
      initialDirectionChoice: {
        active: true,
        chooserPlayerId: "player-1"
      },
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
      snapshot: chooserSnapshot
    });

    expect(document.querySelector("[data-testid='initial-direction-backdrop']")?.textContent).toContain("选择开局方向");
    expect(document.querySelectorAll("[data-initial-direction]")).toHaveLength(2);

    socket?.triggerMessage({
      protocolVersion: "0.1.0",
      type: "snapshot",
      roomId: "ROOM1",
      playerId: "player-2",
      snapshotVersion: 2,
      snapshot: {
        ...chooserSnapshot,
        snapshotVersion: 2,
        self: {
          playerId: "player-2",
          displayName: "player-2",
          avatarUrl: null,
          hand: [],
          handCount: 0,
          hasCalledUno: false,
          unoPendingSinceMs: null,
          unoProtectionStartedAtMs: null,
          unoProtectionEndsAtMs: null,
          isEliminated: false,
          isCurrentPlayer: false
        },
        opponents: [
          {
            playerId: "player-1",
            displayName: "player-1",
            avatarUrl: null,
            handCount: 0,
            hasCalledUno: false,
            unoPendingSinceMs: null,
            unoProtectionStartedAtMs: null,
            unoProtectionEndsAtMs: null,
            isEliminated: false,
            isCurrentPlayer: true
          }
        ]
      }
    });

    expect(document.querySelector("[data-testid='initial-direction-backdrop']")?.textContent).toContain("等待 player-1 选择出牌方向");
    expect(document.querySelectorAll("[data-initial-direction]")).toHaveLength(0);
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

  it("shows a waiting message for non-host players in the finished game modal", async () => {
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
    expect(document.querySelector("[data-testid='continue-game-button']")).toBeNull();
    expect(document.querySelector("[data-testid='stay-in-room-button']")).toBeNull();
    expect(document.querySelector("[data-testid='finish-leave-room-button']")).toBeNull();
    expect(document.querySelector("[data-testid='event-modal']")?.textContent).toContain("等待房主决定重开/继续游戏");
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
    expect(createRoomMessage?.mode).toBe("no-challenge");
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

  it("maps battle UI 100% to the previous 80% overall scale", async () => {
    await import("../main");

    document.querySelector<HTMLButtonElement>("#lobby-settings-button")?.click();
    document
      .querySelector<HTMLButtonElement>("[data-setting-button='ui-scale'][data-setting-value='100']")
      ?.click();

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
      snapshotVersion: 1,
      snapshot: {
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

    const battleRoot = document.querySelector<HTMLElement>(".battle-immersive");

    expect(battleRoot).not.toBeNull();
    expect(battleRoot?.style.getPropertyValue("--battle-ui-scale")).toBe("0.80");
  });

  it("keeps the current battle seat fully lit instead of dimming it under the active overlay", async () => {
    const styleText = await readFile("src/styles.css", "utf8");

    expect(styleText).toContain(".seat.current::before");
    expect(styleText).toContain("filter: brightness(1.12) saturate(1.08);");
    expect(styleText).toContain(".seat.current::after");
    expect(styleText).toContain("rgba(9, 12, 18, 0.22)");
    expect(styleText).toContain(".seat.current small");
    expect(styleText).toContain("color: #dde8fb;");
  });

  it("plays a one-shot sweep across the bottom dock when the turn moves to the local player", async () => {
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
      snapshotVersion: 1,
      snapshot: {
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
          displayName: "player-1",
          avatarUrl: null,
          hand: [],
          handCount: 0,
          hasCalledUno: false,
          unoPendingSinceMs: null,
          unoProtectionStartedAtMs: null,
          unoProtectionEndsAtMs: null,
          isEliminated: false,
          isCurrentPlayer: false
        },
        opponents: [
          {
            playerId: "player-2",
            displayName: "player-2",
            avatarUrl: null,
            handCount: 5,
            hasCalledUno: false,
            unoPendingSinceMs: null,
            unoProtectionStartedAtMs: null,
            unoProtectionEndsAtMs: null,
            isEliminated: false,
            isCurrentPlayer: true
          }
        ]
      }
    });

    expect(document.querySelector(".battle-action-dock")?.classList.contains("turn-sweep-active")).toBe(false);

    socket?.triggerMessage({
      protocolVersion: "0.1.0",
      type: "snapshot",
      roomId: "ROOM1",
      playerId: "player-1",
      snapshotVersion: 2,
      snapshot: {
        roomId: "ROOM1",
        snapshotVersion: 2,
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
        opponents: [
          {
            playerId: "player-2",
            displayName: "player-2",
            avatarUrl: null,
            handCount: 5,
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

    const actionDock = document.querySelector<HTMLElement>(".battle-action-dock");
    const styleText = await readFile("src/styles.css", "utf8");

    expect(actionDock?.classList.contains("turn-sweep-active")).toBe(true);
    expect(actionDock?.style.getPropertyValue("--battle-turn-sweep-delay-ms")).toContain("-");
    expect(styleText).toContain(".battle-action-dock.turn-sweep-active::before");
    expect(styleText).toContain("@keyframes battle-turn-sweep");
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

  it("adds stacking notes to penalty-draw and +10 tooltips", async () => {
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
    const penaltyDrawCard = {
      id: "black-penalty-draw",
      kind: "penalty-draw",
      isBlack: true,
      displayName: "black penalty draw"
    };
    const wildDrawTenCard = {
      id: "black-wild-draw-ten",
      kind: "wild-draw-ten",
      drawValue: 10,
      isBlack: true,
      displayName: "black wild draw ten"
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
          displayName: "player-1",
          avatarUrl: null,
          hand: [penaltyDrawCard, wildDrawTenCard],
          handCount: 2,
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

    const penaltyButton = document.querySelector<HTMLElement>("[data-card-id='black-penalty-draw']");
    const drawTenButton = document.querySelector<HTMLElement>("[data-card-id='black-wild-draw-ten']");

    expect(penaltyButton?.dataset.cardTooltip).toContain("罚抽叠加罚抽");
    expect(drawTenButton?.dataset.cardTooltip).toContain("+10叠加+10");
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
    nicknameInput.value = "12345678901";
    document.querySelector<HTMLButtonElement>("#rename-player-button")?.click();

    expect(socket?.sentMessages).toHaveLength(sentCount);
    expect(document.querySelector(".ui-toast")?.textContent).toContain("10");
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
            displayName: "最强bot",
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
    expect(botPill?.querySelector(".lobby-seat-name")?.textContent).toContain("最强bot");
    expect(botPill?.textContent).not.toContain("BOT");
    expect(botPill?.querySelector(".lobby-seat-status")?.textContent).toContain("机器人");
  });

  it("opens a single add-bot menu and adds the chosen bot from the matching row", async () => {
    await import("../main");
    const styleText = await readFile("src/styles.css", "utf8");

    const socket = FakeWebSocket.instances[0];
    socket?.triggerOpen();

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
          }
        ]
      }
    });

    const addBotMenuButton = document.querySelector<HTMLButtonElement>("[data-testid='add-bot-menu-button']");
    expect(addBotMenuButton?.textContent).toContain("添加机器人");

    addBotMenuButton?.click();

    const botRows = Array.from(document.querySelectorAll<HTMLElement>("[data-testid='add-bot-menu-row']"));
    expect(botRows).toHaveLength(2);
    expect(botRows[0]?.textContent).toContain("最强bot");
    expect(botRows[1]?.textContent).toContain("混沌bot");

    document.querySelector<HTMLButtonElement>("[data-add-bot-type='chaos']")?.click();

    const addBotMessage = socket?.sentMessages
      .map((message) => JSON.parse(message))
      .find((message) => message.type === "add-bot");

    expect(addBotMessage).toMatchObject({
      type: "add-bot",
      roomId: "ROOM1",
      playerId: "player-host",
      botType: "chaos"
    });
    expect(document.querySelector("[data-testid='add-bot-menu-panel']")).not.toBeNull();
    expect(styleText).toContain(".add-bot-menu-panel");
    expect(styleText).toContain("position: absolute;");
  });

  it("closes the add-bot menu when clicking outside the menu", async () => {
    await import("../main");

    const socket = FakeWebSocket.instances[0];
    socket?.triggerOpen();

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
          }
        ]
      }
    });

    document.querySelector<HTMLButtonElement>("[data-testid='add-bot-menu-button']")?.click();
    expect(document.querySelector("[data-testid='add-bot-menu-panel']")).not.toBeNull();

    document.body.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(document.querySelector("[data-testid='add-bot-menu-panel']")).toBeNull();
  });

  it("disables pitch preservation for penalty sounds and stops elimination music after the round decision ends", async () => {
    Object.defineProperty(window.navigator, "userAgent", {
      value: "unit-test-browser",
      configurable: true
    });
    vi.stubGlobal("Audio", FakeAudio as unknown as typeof Audio);

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
      snapshotVersion: 1,
      snapshot: {
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
        roundDecisionPending: true,
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
          type: "cards-drawn",
          playerId: "player-1",
          count: 1,
          reason: "draw-until-color",
          drawUntilColor: {
            targetColor: "red",
            revealedColor: "blue",
            matched: false
          }
        },
        {
          type: "player-eliminated",
          playerId: "player-2",
          handCount: 26,
          reason: "hand-limit"
        }
      ]
    });

    socket?.triggerMessage({
      protocolVersion: "0.1.0",
      type: "events",
      roomId: "ROOM1",
      snapshotVersion: 1,
      events: [
        {
          type: "player-eliminated",
          playerId: "player-3",
          handCount: 26,
          reason: "hand-limit"
        }
      ]
    });

    const penaltyAudio = FakeAudio.instances.find((audio) =>
      audio.src.includes("%E7%BD%9A%E6%8A%BD%E5%BC%80%E5%A7%8B.mp3")
    );
    const eliminationAudio = FakeAudio.instances.find((audio) =>
      decodeURIComponent(audio.src).includes("出局音效.mp3")
    );

    expect(penaltyAudio).not.toBeUndefined();
    expect(penaltyAudio?.preservesPitch).toBe(false);
    expect(penaltyAudio?.webkitPreservesPitch).toBe(false);
    expect(penaltyAudio?.mozPreservesPitch).toBe(false);
    expect(eliminationAudio).not.toBeUndefined();
    expect(eliminationAudio?.playCount).toBe(1);

    socket?.triggerMessage({
      protocolVersion: "0.1.0",
      type: "snapshot",
      roomId: "ROOM1",
      playerId: "player-1",
      snapshotVersion: 2,
      snapshot: {
        roomId: "ROOM1",
        snapshotVersion: 2,
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

    expect(eliminationAudio?.paused).toBe(true);
    expect(eliminationAudio?.currentTime).toBe(0);
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



