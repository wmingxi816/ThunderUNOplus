import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import type { Card } from "@thunder-uno/shared-types";
import { bootPlayer } from "./helpers";

test("playable unselected hand cards show rule hints, selected cards hide them, and number cards open the special rules image", async ({ browser }) => {
  const { context, page } = await bootInstrumentedPlayer(browser, "Rule Hint A");

  await openInjectedBattle(page, {
    topCard: createNumberCard("top-red-5", "red", 5, "Red 5"),
    currentColor: "red",
    hand: [
      createNumberCard("hand-number-1", "blue", 5, "Blue 5"),
      createActionCard("hand-reverse-1", "reverse", "red", "Red Reverse")
    ]
  });

  const numberCard = page.locator("[data-card-id='hand-number-1']");
  const numberRuleButton = page.locator("[data-card-rule-button='hand-number-1']");
  const reverseRuleButton = page.locator("[data-card-rule-button='hand-reverse-1']");

  await expect(numberRuleButton).toBeVisible();
  await expect(reverseRuleButton).toBeVisible();

  const numberButtonPosition = await getRuleButtonInsets(page, "hand-number-1");
  expect(numberButtonPosition.leftInset).toBeLessThan(28);
  expect(numberButtonPosition.bottomInset).toBeLessThan(28);

  await numberCard.click();
  await expect(numberRuleButton).toBeHidden();
  await expect(reverseRuleButton).toBeVisible();

  await numberCard.click();
  await expect(numberRuleButton).toBeVisible();
  await numberRuleButton.click();

  const imageSrc = await page.locator(".rule-image-viewer img").getAttribute("src");
  expect(imageSrc).not.toBeNull();
  expect(decodeURIComponent(new URL(imageSrc!, page.url()).pathname)).toBe(
    "/rules/特色玩法（顺子）.webp"
  );

  await page.locator("#rule-back-button").click();
  await expect(page.getByTestId("rule-modal")).toHaveCount(0);
  await expect(page.getByTestId("battle-view")).toBeVisible();

  await context.close();
});

test("rule hint dedupes by kind and color while allowing different colors of the same kind", async ({ browser }) => {
  const { context, page } = await bootInstrumentedPlayer(browser, "Rule Hint B");

  await openInjectedBattle(page, {
    topCard: createActionCard("top-reverse-red", "reverse", "red", "Top Red Reverse"),
    currentColor: "red",
    hand: [
      createActionCard("hand-reverse-red-a", "reverse", "red", "Red Reverse A"),
      createActionCard("hand-reverse-red-b", "reverse", "red", "Red Reverse B"),
      createActionCard("hand-reverse-blue", "reverse", "blue", "Blue Reverse")
    ]
  });

  await expect(page.locator("[data-card-rule-button='hand-reverse-red-a']")).toBeVisible();
  await expect(page.locator("[data-card-rule-button='hand-reverse-red-b']")).toBeHidden();
  await expect(page.locator("[data-card-rule-button='hand-reverse-blue']")).toBeVisible();

  await context.close();
});

test("rule hint toggle keeps left text with a compact right-aligned slider and can disable all hand rule hints without shrinking the action buttons", async ({ browser }) => {
  const { context, page } = await bootInstrumentedPlayer(browser, "Rule Hint C");

  await openInjectedBattle(page, {
    topCard: createActionCard("top-reverse-red-2", "reverse", "red", "Top Red Reverse"),
    currentColor: "red",
    hand: [
      createActionCard("hand-reverse-red-c", "reverse", "red", "Red Reverse C"),
      createActionCard("hand-reverse-blue-c", "reverse", "blue", "Blue Reverse C"),
      createNumberCard("hand-number-c", "red", 8, "Red 8")
    ]
  });

  const toggle = page.getByTestId("hand-rule-hints-toggle");
  const playButton = page.locator("#play-button");
  const clearButton = page.locator("#clear-selection-button");

  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await expect(page.locator("[data-card-rule-button='hand-reverse-red-c']")).toBeVisible();
  await expect(page.locator("[data-card-rule-button='hand-reverse-blue-c']")).toBeVisible();
  await expect(page.locator("[data-card-rule-button='hand-number-c']")).toBeVisible();

  const layout = await page.evaluate(() => {
    const panel = document.querySelector<HTMLElement>(".selection-panel");
    const toggleRow = document.querySelector<HTMLElement>(".selection-toggle-row");
    const toggleCopy = document.querySelector<HTMLElement>(".selection-toggle-copy");
    const toggleButton = document.querySelector<HTMLElement>("#hand-rule-hints-toggle");
    const toggleTrack = document.querySelector<HTMLElement>(".selection-toggle-track");
    const play = document.querySelector<HTMLElement>("#play-button");
    const clear = document.querySelector<HTMLElement>("#clear-selection-button");

    if (panel === null || toggleRow === null || toggleCopy === null || toggleButton === null || toggleTrack === null || play === null || clear === null) {
      throw new Error("Selection panel controls were not rendered.");
    }

    const panelRect = panel.getBoundingClientRect();
    const toggleRowRect = toggleRow.getBoundingClientRect();
    const toggleCopyRect = toggleCopy.getBoundingClientRect();
    const toggleRect = toggleButton.getBoundingClientRect();
    const toggleTrackRect = toggleTrack.getBoundingClientRect();
    const playRect = play.getBoundingClientRect();
    const clearRect = clear.getBoundingClientRect();
    const toggleRowStyle = window.getComputedStyle(toggleRow);

    return {
      panelWidth: panelRect.width,
      toggleRowWidth: toggleRowRect.width,
      toggleCopyLeft: toggleCopyRect.left,
      toggleButtonRightGap: toggleRowRect.right - toggleRect.right,
      toggleCopyRightGap: toggleRect.left - toggleCopyRect.right,
      toggleWidth: toggleTrackRect.width,
      toggleHeight: toggleTrackRect.height,
      playHeight: playRect.height,
      clearHeight: clearRect.height,
      toggleRowBackground: toggleRowStyle.backgroundColor
    };
  });

  expect(Math.abs(layout.panelWidth - layout.toggleRowWidth)).toBeLessThan(18);
  expect(layout.toggleCopyLeft).toBeGreaterThanOrEqual(0);
  expect(layout.toggleButtonRightGap).toBeLessThan(8);
  expect(layout.toggleCopyRightGap).toBeGreaterThan(4);
  expect(layout.toggleHeight).toBeLessThan(layout.toggleRowWidth * 0.3);
  expect(layout.playHeight).toBeGreaterThanOrEqual(32);
  expect(layout.clearHeight).toBeGreaterThanOrEqual(32);
  expect(layout.toggleRowBackground).toBe("rgba(0, 0, 0, 0)");

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await expect(page.locator("[data-card-rule-button='hand-reverse-red-c']")).toBeHidden();
  await expect(page.locator("[data-card-rule-button='hand-reverse-blue-c']")).toBeHidden();
  await expect(page.locator("[data-card-rule-button='hand-number-c']")).toBeHidden();

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await expect(page.locator("[data-card-rule-button='hand-reverse-red-c']")).toBeVisible();

  await context.close();
});

test("hand cards stay at roughly the same vertical position after the turn passes and the hand becomes dimmed", async ({ browser }) => {
  const { context, page } = await bootInstrumentedPlayer(browser, "Rule Hint D");

  const hand = [
    createNumberCard("hand-blue-5", "blue", 5, "Blue 5"),
    createActionCard("hand-blue-reverse", "reverse", "blue", "Blue Reverse"),
    createNumberCard("hand-yellow-2", "yellow", 2, "Yellow 2")
  ];

  await openInjectedBattle(page, {
    topCard: createNumberCard("top-blue-1", "blue", 1, "Blue 1"),
    currentColor: "blue",
    hand
  });

  const before = await getFirstHandCardTop(page);

  await injectServerMessage(
    page,
    createSnapshotMessage({
      topCard: createNumberCard("top-red-8", "red", 8, "Red 8"),
      currentColor: "red",
      hand,
      currentPlayerId: "player-opponent-a"
    })
  );
  await expect(page.locator(".selection-panel")).toContainText("当前不是你的回合");

  const after = await getFirstHandCardTop(page);
  expect(Math.abs(after - before)).toBeLessThan(10);

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

async function openInjectedBattle(
  page: Page,
  params: {
    topCard: Card;
    currentColor: "red" | "yellow" | "blue" | "green";
    hand: Card[];
  }
): Promise<void> {
  await injectServerMessage(page, createRoomStateMessage());
  await injectServerMessage(page, createSnapshotMessage(params));
  await expect(page.getByTestId("battle-view")).toBeVisible();
  await expect(page.getByTestId("hand-area")).toBeVisible();
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

async function getRuleButtonInsets(
  page: Page,
  cardId: string
): Promise<{ leftInset: number; bottomInset: number }> {
  return page.evaluate((targetCardId) => {
    const slot = document
      .querySelector<HTMLElement>(`[data-card-id='${targetCardId}']`)
      ?.closest<HTMLElement>("[data-hand-card-slot]");
    const ruleButton = document.querySelector<HTMLElement>(`[data-card-rule-button='${targetCardId}']`);

    if (slot === null || ruleButton === null) {
      throw new Error("The selected hand card slot or rule button was not rendered.");
    }

    const slotRect = slot.getBoundingClientRect();
    const buttonRect = ruleButton.getBoundingClientRect();

    return {
      leftInset: buttonRect.left - slotRect.left,
      bottomInset: slotRect.bottom - buttonRect.bottom
    };
  }, cardId);
}

async function getFirstHandCardTop(page: Page): Promise<number> {
  return page.evaluate(() => {
    const firstSlot = document.querySelector<HTMLElement>("[data-testid='hand-area'] [data-hand-card-slot]");

    if (firstSlot === null) {
      throw new Error("No hand card slot was rendered.");
    }

    return firstSlot.getBoundingClientRect().top;
  });
}

function createRoomStateMessage() {
  return {
    protocolVersion: "0.1.0",
    type: "room-state",
    roomId: "ROOM1",
    playerId: "player-self",
    snapshotVersion: 1,
    room: {
      roomId: "ROOM1",
      roomCode: "ROOM1",
      status: "playing",
      mode: "no-challenge",
      hostPlayerId: "player-self",
      snapshotVersion: 1,
      players: [
        {
          playerId: "player-self",
          displayName: "Rule Hint",
          avatarUrl: null,
          seatIndex: 0,
          isHost: true,
          isReady: true,
          isBot: false,
          connectionStatus: "connected"
        },
        {
          playerId: "player-opponent-a",
          displayName: "Opp A",
          avatarUrl: null,
          seatIndex: 1,
          isHost: false,
          isReady: true,
          isBot: false,
          connectionStatus: "connected"
        },
        {
          playerId: "player-opponent-b",
          displayName: "Opp B",
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
  topCard: Card;
  currentColor: "red" | "yellow" | "blue" | "green";
  hand: Card[];
  currentPlayerId?: string;
}) {
  const currentPlayerId = params.currentPlayerId ?? "player-self";
  const selfIsCurrentPlayer = currentPlayerId === "player-self";

  return {
    protocolVersion: "0.1.0",
    type: "snapshot",
    roomId: "ROOM1",
    playerId: "player-self",
    snapshotVersion: 1,
    snapshot: {
      roomId: "ROOM1",
      snapshotVersion: 1,
      status: "in-progress",
      mode: "no-challenge",
      currentPlayerId,
      currentColor: params.currentColor,
      direction: "clockwise",
      topCard: params.topCard,
      discardPile: [params.topCard],
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
        playerId: "player-self",
        displayName: "Rule Hint",
        avatarUrl: null,
        hand: params.hand,
        handCount: params.hand.length,
        hasCalledUno: false,
        unoPendingSinceMs: null,
        unoProtectionStartedAtMs: null,
        unoProtectionEndsAtMs: null,
        isEliminated: false,
        isRoundWinner: false,
        hasLeftRoom: false,
        isCurrentPlayer: selfIsCurrentPlayer,
        isBot: false
      },
      opponents: [
        {
          playerId: "player-opponent-a",
          displayName: "Opp A",
          avatarUrl: null,
          handCount: 4,
          hasCalledUno: false,
          unoPendingSinceMs: null,
          unoProtectionStartedAtMs: null,
          unoProtectionEndsAtMs: null,
          isEliminated: false,
          isRoundWinner: false,
          hasLeftRoom: false,
          isCurrentPlayer: currentPlayerId === "player-opponent-a",
          isBot: false
        },
        {
          playerId: "player-opponent-b",
          displayName: "Opp B",
          avatarUrl: null,
          handCount: 5,
          hasCalledUno: false,
          unoPendingSinceMs: null,
          unoProtectionStartedAtMs: null,
          unoProtectionEndsAtMs: null,
          isEliminated: false,
          isRoundWinner: false,
          hasLeftRoom: false,
          isCurrentPlayer: currentPlayerId === "player-opponent-b",
          isBot: false
        }
      ]
    }
  };
}

function createNumberCard(
  id: string,
  color: "red" | "yellow" | "blue" | "green",
  number: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9,
  displayName: string
): Card {
  return {
    id,
    kind: "number",
    color,
    number,
    isBlack: false,
    displayName
  };
}

function createActionCard(
  id: string,
  kind: "draw-two" | "draw-four" | "skip" | "reverse" | "discard-same-color" | "swap-hands",
  color: "red" | "yellow" | "blue" | "green",
  displayName: string
): Card {
  return {
    id,
    kind,
    color,
    isBlack: false,
    displayName
  };
}
