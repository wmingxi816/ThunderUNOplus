import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { bootPlayer } from "./helpers";

test("host transfer switches round-decision controls and auto-continue closes the modal", async ({ browser }) => {
  const { context, page } = await bootInstrumentedPlayer(browser, "Guest");

  await injectServerMessage(
    page,
    createRoomStateMessage({
      playerId: "player-2",
      hostPlayerId: "player-host",
      roomStatus: "finished"
    })
  );
  await injectServerMessage(
    page,
    createSnapshotMessage({
      playerId: "player-2",
      status: "finished",
      roundDecisionPending: true,
      winnerPlayerIds: ["player-host"],
      selfHandCount: 2
    })
  );

  await expect(page.getByTestId("event-modal")).toContainText("等待房主决定重开/继续游戏");

  await injectServerMessage(
    page,
    createRoomStateMessage({
      playerId: "player-2",
      hostPlayerId: "player-2",
      roomStatus: "finished",
      hostConnectionStatus: "left"
    })
  );

  await expect(page.getByTestId("restart-game-button")).toBeVisible();
  await expect(page.getByTestId("continue-game-button")).toBeVisible();

  await injectServerMessage(
    page,
    createSnapshotMessage({
      playerId: "player-2",
      status: "in-progress",
      roundDecisionPending: false,
      winnerPlayerIds: [],
      selfHandCount: 3
    })
  );

  await expect(page.getByTestId("event-modal")).toHaveCount(0);

  await context.close();
});

test("settings exposes the update log dialog in the center of the screen", async ({ browser }) => {
  const { context, page } = await bootInstrumentedPlayer(browser, "Settings Guest");

  await page.locator("#lobby-settings-button").click();
  await expect(page.locator(".settings-modal")).toBeVisible();
  await page.getByTestId("settings-update-log-button").click();

  await expect(page.getByTestId("update-log-dialog")).toBeVisible();
  await expect(page.getByTestId("update-log-dialog")).toContainText("房主淘汰并主动离房");
  await expect(page.locator(".settings-modal")).toContainText("更新日志入口");

  const dialogBox = await page.getByTestId("update-log-dialog").boundingBox();

  expect(dialogBox).not.toBeNull();
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  expect(Math.abs(dialogBox!.x + dialogBox!.width / 2 - viewport!.width / 2)).toBeLessThan(48);
  expect(Math.abs(dialogBox!.y + dialogBox!.height / 2 - viewport!.height / 2)).toBeLessThan(48);

  await context.close();
});

async function bootInstrumentedPlayer(
  browser: Browser,
  nickname: string
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext();

  await context.addInitScript(() => {
    const NativeWebSocket = window.WebSocket;

    class InspectableWebSocket extends NativeWebSocket {
      constructor(url: string | URL, protocols?: string | string[]) {
        super(url, protocols);
        (window as Window & { __THUNDER_UNO_TEST_SOCKET__?: WebSocket }).__THUNDER_UNO_TEST_SOCKET__ = this;
      }
    }

    (
      window as Window & {
        __injectThunderUnoServerMessage__?: (message: unknown) => void;
      }
    ).__injectThunderUnoServerMessage__ = (message: unknown) => {
      const socket = (
        window as Window & { __THUNDER_UNO_TEST_SOCKET__?: WebSocket }
      ).__THUNDER_UNO_TEST_SOCKET__;

      if (socket === undefined) {
        throw new Error("No test websocket instance was captured.");
      }

      socket.dispatchEvent(
        new MessageEvent("message", {
          data: JSON.stringify(message)
        })
      );
    };

    window.WebSocket = InspectableWebSocket as typeof WebSocket;
  });

  const page = await bootPlayer(context, nickname);
  return { context, page };
}

async function injectServerMessage(page: Page, message: unknown): Promise<void> {
  await page.evaluate((payload) => {
    (
      window as Window & {
        __injectThunderUnoServerMessage__?: (message: unknown) => void;
      }
    ).__injectThunderUnoServerMessage__?.(payload);
  }, message);
}

function createRoomStateMessage(params: {
  playerId: string;
  hostPlayerId: string;
  roomStatus: "lobby" | "playing" | "finished";
  hostConnectionStatus?: "connected" | "left";
}) {
  return {
    protocolVersion: "0.1.0",
    type: "room-state",
    roomId: "ROOM1",
    playerId: params.playerId,
    snapshotVersion: 1,
    room: {
      roomId: "ROOM1",
      roomCode: "ROOM1",
      status: params.roomStatus,
      mode: "no-challenge",
      hostPlayerId: params.hostPlayerId,
      snapshotVersion: 1,
      players: [
        {
          playerId: "player-host",
          displayName: "Host",
          avatarUrl: null,
          seatIndex: 0,
          isHost: params.hostPlayerId === "player-host",
          isReady: true,
          isBot: false,
          connectionStatus: params.hostConnectionStatus ?? "connected"
        },
        {
          playerId: "player-2",
          displayName: "Guest",
          avatarUrl: null,
          seatIndex: 1,
          isHost: params.hostPlayerId === "player-2",
          isReady: true,
          isBot: false,
          connectionStatus: "connected"
        },
        {
          playerId: "player-3",
          displayName: "Cara",
          avatarUrl: null,
          seatIndex: 2,
          isHost: false,
          isReady: true,
          isBot: false,
          connectionStatus: "connected"
        }
      ]
    }
  };
}

function createSnapshotMessage(params: {
  playerId: string;
  status: "in-progress" | "finished";
  roundDecisionPending: boolean;
  winnerPlayerIds: string[];
  selfHandCount: number;
}) {
  const topCard = {
    id: "red-5",
    kind: "number",
    color: "red",
    number: 5,
    isBlack: false,
    displayName: "red 5"
  };

  return {
    protocolVersion: "0.1.0",
    type: "snapshot",
    roomId: "ROOM1",
    playerId: params.playerId,
    snapshotVersion: params.status === "finished" ? 1 : 2,
    snapshot: {
      roomId: "ROOM1",
      snapshotVersion: params.status === "finished" ? 1 : 2,
      status: params.status,
      mode: "no-challenge",
      currentPlayerId: "player-3",
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
      roundDecisionPending: params.roundDecisionPending,
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
      winnerPlayerIds: params.winnerPlayerIds,
      self: {
        playerId: params.playerId,
        displayName: "Guest",
        avatarUrl: null,
        hand: [],
        handCount: params.selfHandCount,
        hasCalledUno: false,
        unoPendingSinceMs: null,
        unoProtectionStartedAtMs: null,
        unoProtectionEndsAtMs: null,
        isEliminated: false,
        isRoundWinner: false,
        hasLeftRoom: false,
        isCurrentPlayer: false,
        isBot: false
      },
      opponents: [
        {
          playerId: "player-host",
          displayName: "Host",
          avatarUrl: null,
          handCount: 0,
          hasCalledUno: false,
          unoPendingSinceMs: null,
          unoProtectionStartedAtMs: null,
          unoProtectionEndsAtMs: null,
          isEliminated: true,
          isRoundWinner: params.winnerPlayerIds.includes("player-host"),
          hasLeftRoom: params.status === "in-progress",
          isCurrentPlayer: false,
          isBot: false
        },
        {
          playerId: "player-3",
          displayName: "Cara",
          avatarUrl: null,
          handCount: 3,
          hasCalledUno: false,
          unoPendingSinceMs: null,
          unoProtectionStartedAtMs: null,
          unoProtectionEndsAtMs: null,
          isEliminated: false,
          isRoundWinner: false,
          hasLeftRoom: false,
          isCurrentPlayer: true,
          isBot: false
        }
      ]
    }
  };
}
