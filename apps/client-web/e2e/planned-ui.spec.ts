import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import type { Card } from "@thunder-uno/shared-types";
import { bootPlayer, createRoom, joinRoom, startGame, waitForBattleView } from "./helpers";

async function bootLobby(page: Page, nickname: string): Promise<void> {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("lobby-view")).toBeVisible();
  await page.locator("#nickname").fill(nickname);
  await expect(page.locator("#create-room-button")).toBeEnabled();
}

test("lobby settings replaces the visible open tag and exposes fixed scale choices plus contact", async ({ page }) => {
  await bootLobby(page, "Settings Host");

  await expect(page.locator(".topbar .status")).toHaveCount(0);
  await page.locator("#lobby-settings-button").click();
  await expect(page.locator(".settings-modal")).toBeVisible();
  await expect(page.locator("[data-setting-button='ui-scale']")).toHaveText(["20%", "40%", "60%", "80%", "100%"]);
  await expect(page.locator("[data-setting-value='80']")).toHaveCount(1);
  await expect(page.locator("[data-setting-value='120']")).toHaveCount(0);

  await expect(page.locator("#settings-contact-button")).toHaveCount(0);
  await expect(page.locator("#settings-contact-content")).toContainText("QQ：2753345388");

  await page.locator("[data-setting-value='20']").click();
  await expect(page.locator("[data-setting-value='20']")).toHaveClass(/active/);
});

test("special rules image points at the existing feature-play asset", async ({ page }) => {
  await bootLobby(page, "Rules Host");

  await page.locator("#lobby-rule-button").click();
  await page.getByTestId("rule-entry-special").click();

  const imageSrc = await page.locator(".rule-image-viewer img").getAttribute("src");
  expect(imageSrc).not.toBeNull();
  expect(decodeURIComponent(new URL(imageSrc!, page.url()).pathname)).toBe(
    "/rules/特色玩法（顺子）.webp"
  );
});

test("battle rotation icon is centered and settings only scales it", async ({ browser }) => {
  test.setTimeout(45_000);
  const context = await browser.newContext();
  const host = await bootPlayer(context, "Orbit-A");
  const roomId = await createRoom(host);
  const guestB = await bootPlayer(context, "Orbit-B");
  await joinRoom(guestB, roomId);
  const guestC = await bootPlayer(context, "Orbit-C");
  await joinRoom(guestC, roomId);

  await startGame(host);
  await waitForBattleView(guestB);
  await waitForBattleView(guestC);
  await expect(host.getByTestId("initial-direction-backdrop")).toHaveCount(0);

  const centerDelta = await host.evaluate(() => {
    const orbit = document.querySelector<HTMLElement>(".turn-direction-orbit");
    const centerTable = document.querySelector<HTMLElement>(".center-table");

    if (orbit === null || centerTable === null) {
      throw new Error("Battle orbit or center table was not rendered.");
    }

    const orbitRect = orbit.getBoundingClientRect();
    const centerRect = centerTable.getBoundingClientRect();

    return {
      x: Math.abs(orbitRect.left + orbitRect.width / 2 - (centerRect.left + centerRect.width / 2)),
      y: Math.abs(orbitRect.top + orbitRect.height / 2 - (centerRect.top + centerRect.height / 2))
    };
  });

  expect(centerDelta.x).toBeLessThanOrEqual(2);
  expect(centerDelta.y).toBeLessThanOrEqual(2);

  await host.locator("#battle-settings-button").click();
  await expect(host.locator("#settings-adjust-toggle-button")).toHaveCount(0);
  await expect(host.locator("#settings-seat-y-slider")).toHaveCount(0);
  await expect(host.locator("#settings-battle-table-y-slider")).toHaveCount(0);
  await expect(host.locator("#settings-turn-orbit-scale-slider")).toBeVisible();
  await expect(host.locator("#settings-hand-card-scale-slider")).toBeVisible();
});

test("battle center side panels stay centered within the seat band and only the tighter side shrinks on short heights", async ({ browser }) => {
  test.setTimeout(45_000);
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 }
  });
  const host = await bootPlayer(context, "Center-A");
  const roomId = await createRoom(host);
  const guestB = await bootPlayer(context, "Center-B");
  await joinRoom(guestB, roomId);
  const guestC = await bootPlayer(context, "Center-C");
  await joinRoom(guestC, roomId);

  await startGame(host);
  await waitForBattleView(guestB);
  await waitForBattleView(guestC);
  await expect(host.getByTestId("initial-direction-backdrop")).toHaveCount(0);
  await host.waitForTimeout(150);

  const readMetrics = async () =>
    host.evaluate(() => {
      const battleRoot = document.querySelector<HTMLElement>(".battle-immersive");
      const centerTable = document.querySelector<HTMLElement>(".center-table");
      const orbit = document.querySelector<HTMLElement>(".turn-direction-orbit");
      const drawShell = document.querySelector<HTMLElement>(".center-draw-pile-shell");
      const factsShell = document.querySelector<HTMLElement>(".center-table-facts-shell");
      const discardShell = document.querySelector<HTMLElement>(".center-discard-pile-shell");
      const leftSeats = Array.from(
        document.querySelectorAll<HTMLElement>(".battle-immersive .seat-side-left")
      );
      const rightSeats = Array.from(
        document.querySelectorAll<HTMLElement>(".battle-immersive .seat-side-right")
      );

      if (
        battleRoot === null ||
        centerTable === null ||
        orbit === null ||
        drawShell === null ||
        factsShell === null ||
        discardShell === null ||
        leftSeats.length === 0 ||
        rightSeats.length === 0
      ) {
        throw new Error("Battle center layout elements were not rendered.");
      }

      const rootRect = battleRoot.getBoundingClientRect();
      const uiScale = Math.max(
        0.0001,
        Number.parseFloat(getComputedStyle(battleRoot).getPropertyValue("--battle-ui-scale")) || 1
      );
      const battleRootStyle = getComputedStyle(battleRoot);
      const readCenterY = (element: HTMLElement) => {
        const rect = element.getBoundingClientRect();
        return (rect.top + rect.height / 2 - rootRect.top) / uiScale;
      };
      const readCenter = (element: HTMLElement) => {
        const rect = element.getBoundingClientRect();
        return {
          x: (rect.left + rect.width / 2 - rootRect.left) / uiScale,
          y: (rect.top + rect.height / 2 - rootRect.top) / uiScale
        };
      };
      const readRect = (element: HTMLElement) => {
        const rect = element.getBoundingClientRect();
        return {
          left: (rect.left - rootRect.left) / uiScale,
          right: (rect.right - rootRect.left) / uiScale,
          top: (rect.top - rootRect.top) / uiScale,
          bottom: (rect.bottom - rootRect.top) / uiScale
        };
      };
      const topLimit =
        Number.parseFloat(battleRoot.style.getPropertyValue("--battle-center-side-top-limit")) ||
        Number.parseFloat(battleRootStyle.getPropertyValue("--battle-center-side-top-limit"));
      const bottomLimit =
        Number.parseFloat(battleRoot.style.getPropertyValue("--battle-center-side-bottom-limit")) ||
        Number.parseFloat(battleRootStyle.getPropertyValue("--battle-center-side-bottom-limit"));
      const designScale =
        Number.parseFloat(battleRootStyle.getPropertyValue("--battle-center-scale")) || 1;
      const orbitCenter = readCenter(orbit);
      const centerTableCenter = readCenter(centerTable);
      const discardRect = readRect(discardShell);
      const leftSeatRight = Math.max(...leftSeats.map((seat) => readRect(seat).right));
      const rightSeatLeft = Math.min(...rightSeats.map((seat) => readRect(seat).left));

      return {
        topLimit,
        bottomLimit,
        leftSeatRight,
        rightSeatLeft,
        discardLeft: discardRect.left,
        discardRight: discardRect.right,
        expectedDrawCenterY:
          Number.parseFloat(battleRoot.style.getPropertyValue("--battle-draw-pile-center-y")) ||
          Number.parseFloat(battleRootStyle.getPropertyValue("--battle-draw-pile-center-y")),
        expectedFactsCenterY:
          Number.parseFloat(battleRoot.style.getPropertyValue("--battle-table-facts-center-y")) ||
          Number.parseFloat(battleRootStyle.getPropertyValue("--battle-table-facts-center-y")),
        expectedDrawCenterX: (leftSeatRight + discardRect.left) / 2,
        expectedFactsCenterX: (discardRect.right + rightSeatLeft) / 2,
        drawScale:
          Number.parseFloat(battleRoot.style.getPropertyValue("--battle-draw-pile-scale")) ||
          Number.parseFloat(battleRootStyle.getPropertyValue("--battle-draw-pile-scale")),
        factsScale:
          Number.parseFloat(battleRoot.style.getPropertyValue("--battle-table-facts-scale")) ||
          Number.parseFloat(battleRootStyle.getPropertyValue("--battle-table-facts-scale")),
        designScale,
        drawRect: readRect(drawShell),
        drawCenterX: readCenter(drawShell).x,
        drawCenterY: readCenterY(drawShell),
        factsRect: readRect(factsShell),
        factsCenterX: readCenter(factsShell).x,
        factsCenterY: readCenterY(factsShell),
        centerDeltaX: Math.abs(orbitCenter.x - centerTableCenter.x),
        centerDeltaY: Math.abs(orbitCenter.y - centerTableCenter.y)
      };
    });

  const normalMetrics = await readMetrics();

  expect(Math.abs(normalMetrics.drawCenterX - normalMetrics.expectedDrawCenterX)).toBeLessThanOrEqual(2);
  expect(Math.abs(normalMetrics.drawCenterY - normalMetrics.expectedDrawCenterY)).toBeLessThanOrEqual(2);
  expect(Math.abs(normalMetrics.factsCenterX - normalMetrics.expectedFactsCenterX)).toBeLessThanOrEqual(2);
  expect(Math.abs(normalMetrics.factsCenterY - normalMetrics.expectedFactsCenterY)).toBeLessThanOrEqual(2);
  expect(normalMetrics.drawCenterY).toBeGreaterThanOrEqual(normalMetrics.topLimit - 1);
  expect(normalMetrics.drawCenterY).toBeLessThanOrEqual(normalMetrics.bottomLimit + 1);
  expect(normalMetrics.factsCenterY).toBeGreaterThanOrEqual(normalMetrics.topLimit - 1);
  expect(normalMetrics.factsCenterY).toBeLessThanOrEqual(normalMetrics.bottomLimit + 1);
  expect(normalMetrics.drawRect.left).toBeGreaterThanOrEqual(normalMetrics.leftSeatRight - 1);
  expect(normalMetrics.drawRect.right).toBeLessThanOrEqual(normalMetrics.discardLeft + 1);
  expect(normalMetrics.factsRect.left).toBeGreaterThanOrEqual(normalMetrics.discardRight - 1);
  expect(normalMetrics.factsRect.right).toBeLessThanOrEqual(normalMetrics.rightSeatLeft + 1);
  expect(normalMetrics.drawScale).toBeCloseTo(normalMetrics.designScale, 2);
  expect(normalMetrics.factsScale).toBeCloseTo(normalMetrics.designScale, 2);
  expect(normalMetrics.centerDeltaX).toBeLessThanOrEqual(2);
  expect(normalMetrics.centerDeltaY).toBeLessThanOrEqual(2);

  await host.setViewportSize({ width: 844, height: 300 });
  await guestB.setViewportSize({ width: 844, height: 300 });
  await guestC.setViewportSize({ width: 844, height: 300 });
  await expect(host.getByTestId("top-card")).toBeVisible();
  await host.waitForTimeout(150);

  const shortMetrics = await readMetrics();

  expect(Math.abs(shortMetrics.drawCenterX - shortMetrics.expectedDrawCenterX)).toBeLessThanOrEqual(2);
  expect(Math.abs(shortMetrics.drawCenterY - shortMetrics.expectedDrawCenterY)).toBeLessThanOrEqual(2);
  expect(Math.abs(shortMetrics.factsCenterX - shortMetrics.expectedFactsCenterX)).toBeLessThanOrEqual(2);
  expect(Math.abs(shortMetrics.factsCenterY - shortMetrics.expectedFactsCenterY)).toBeLessThanOrEqual(2);
  expect(shortMetrics.drawCenterY).toBeGreaterThanOrEqual(shortMetrics.topLimit - 1);
  expect(shortMetrics.drawCenterY).toBeLessThanOrEqual(shortMetrics.bottomLimit + 1);
  expect(shortMetrics.factsCenterY).toBeGreaterThanOrEqual(shortMetrics.topLimit - 1);
  expect(shortMetrics.factsCenterY).toBeLessThanOrEqual(shortMetrics.bottomLimit + 1);
  expect(shortMetrics.drawRect.left).toBeGreaterThanOrEqual(shortMetrics.leftSeatRight - 1);
  expect(shortMetrics.drawRect.right).toBeLessThanOrEqual(shortMetrics.discardLeft + 1);
  expect(shortMetrics.factsRect.left).toBeGreaterThanOrEqual(shortMetrics.discardRight - 1);
  expect(shortMetrics.factsRect.right).toBeLessThanOrEqual(shortMetrics.rightSeatLeft + 1);
  expect(shortMetrics.drawScale).toBeLessThanOrEqual(shortMetrics.designScale + 0.01);
  expect(shortMetrics.factsScale).toBeLessThanOrEqual(shortMetrics.designScale + 0.01);
  expect(shortMetrics.drawScale).toBeLessThan(shortMetrics.designScale - 0.02);
  expect(shortMetrics.factsScale).toBeGreaterThanOrEqual(shortMetrics.drawScale);
  expect(shortMetrics.centerDeltaX).toBeLessThanOrEqual(2);
  expect(shortMetrics.centerDeltaY).toBeLessThanOrEqual(2);
});

test("hand card scale pulls non-overlap cards together while preserving overlap slot positioning", async ({ browser }) => {
  test.setTimeout(45_000);
  const { context, page } = await bootInstrumentedBattlePage(browser, "Hand-Scale-A", {
    viewport: { width: 1440, height: 900 }
  });

  await openInjectedBattle(page, {
    topCard: createNumberCard("top-red-5", "red", 5, "Red 5"),
    currentColor: "red",
    hand: [
      createNumberCard("hand-red-1", "red", 1, "Red 1"),
      createNumberCard("hand-blue-2", "blue", 2, "Blue 2"),
      createNumberCard("hand-green-3", "green", 3, "Green 3"),
      createNumberCard("hand-yellow-4", "yellow", 4, "Yellow 4")
    ]
  });

  await expect.poll(() => readHandCardLayoutMetrics(page).then((metrics) => metrics.isOverlap)).toBe(false);

  const defaultMetrics = await readHandCardLayoutMetrics(page);
  await setBattleHandCardScale(page, 60);
  const compactMetrics = await readHandCardLayoutMetrics(page);

  expect(compactMetrics.isOverlap).toBe(false);
  expect(compactMetrics.cardWidth).toBeLessThan(defaultMetrics.cardWidth * 0.75);
  expect(Math.abs(compactMetrics.gap - defaultMetrics.gap)).toBeLessThanOrEqual(6);

  await page.setViewportSize({ width: 900, height: 760 });
  await openInjectedBattle(page, {
    topCard: createNumberCard("top-red-6", "red", 6, "Red 6"),
    currentColor: "red",
    hand: createNumberHand("overlap-card", 14)
  });

  await setBattleHandCardScale(page, 100);
  await expect.poll(() => readHandOverlapLayoutState(page).then((metrics) => metrics.isOverlap)).toBe(true);
  const overlapAtDefaultScale = await readHandOverlapLayoutState(page);

  await setBattleHandCardScale(page, 60);
  const overlapAtCompactScale = await readHandOverlapLayoutState(page);

  expect(overlapAtDefaultScale.isOverlap).toBe(true);
  expect(overlapAtCompactScale.isOverlap).toBe(true);
  expect(overlapAtDefaultScale.leftPositions.length).toBeGreaterThanOrEqual(4);
  expect(overlapAtCompactScale.leftPositions).toHaveLength(overlapAtDefaultScale.leftPositions.length);

  overlapAtDefaultScale.leftPositions.forEach((position, index) => {
    expect(Math.abs(overlapAtCompactScale.leftPositions[index]! - position)).toBeLessThanOrEqual(0.1);
  });

  await context.close();
});

test("card hover help renders as a custom cursor-adjacent tooltip element", async ({ browser }) => {
  test.setTimeout(45_000);
  const context = await browser.newContext();
  const host = await bootPlayer(context, "Tooltip-A");
  const roomId = await createRoom(host);
  const guestB = await bootPlayer(context, "Tooltip-B");
  await joinRoom(guestB, roomId);
  const guestC = await bootPlayer(context, "Tooltip-C");
  await joinRoom(guestC, roomId);

  await startGame(host);
  await waitForBattleView(guestB);
  await waitForBattleView(guestC);
  await expect(host.getByTestId("initial-direction-backdrop")).toHaveCount(0);

  const firstCard = host.getByTestId("hand-area").locator(".card-button").first();
  await firstCard.evaluate((element) => {
    element.setAttribute("data-card-tooltip", "测试悬浮提示");
  });
  await firstCard.hover();

  const tooltip = host.locator("#card-hover-tooltip");
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toContainText("测试悬浮提示");

  const positions = await host.evaluate(() => {
    const tooltipElement = document.querySelector<HTMLElement>("#card-hover-tooltip");
    const cardElement = document.querySelector<HTMLElement>("[data-testid='hand-area'] .card-button");

    if (tooltipElement === null || cardElement === null) {
      throw new Error("Tooltip or card element was not rendered.");
    }

    const tooltipRect = tooltipElement.getBoundingClientRect();
    const cardRect = cardElement.getBoundingClientRect();

    return {
      tooltipLeft: tooltipRect.left,
      tooltipTop: tooltipRect.top,
      cardLeft: cardRect.left,
      cardTop: cardRect.top
    };
  });

  expect(Math.abs(positions.tooltipLeft - positions.cardLeft)).toBeLessThan(180);
  expect(Math.abs(positions.tooltipTop - positions.cardTop)).toBeLessThan(180);

  await firstCard.dispatchEvent("pointerleave");
  await expect(tooltip).toBeHidden();
});

async function bootInstrumentedBattlePage(
  browser: Browser,
  nickname: string,
  options?: {
    viewport?: { width: number; height: number };
  }
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({
    viewport: options?.viewport
  });

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
    currentPlayerId?: string;
  }
): Promise<void> {
  await injectServerMessage(page, createInjectedRoomStateMessage());
  await injectServerMessage(page, createInjectedSnapshotMessage(params));
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

async function setBattleHandCardScale(page: Page, value: number): Promise<void> {
  await page.locator("#battle-settings-button").click();

  const slider = page.locator("#settings-hand-card-scale-slider");
  await expect(slider).toBeVisible();
  await slider.evaluate((element, nextValue) => {
    const input = element as HTMLInputElement;
    input.value = String(nextValue);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);

  await expect(page.locator('[data-interface-adjust-output="hand-card-scale"]')).toHaveText(`${String(value)}%`);
  await expect
    .poll(() =>
      page.evaluate(() => document.querySelector<HTMLElement>(".battle-immersive")?.style.getPropertyValue("--hand-card-scale") ?? "")
    )
    .toBe((value / 100).toFixed(2));

  await page.locator("#close-settings-modal-button").click();
  await expect(page.locator(".settings-modal")).toHaveCount(0);
}

async function readHandCardLayoutMetrics(page: Page): Promise<{
  isOverlap: boolean;
  cardWidth: number;
  gap: number;
}> {
  return page.evaluate(() => {
    const cards = document.querySelector<HTMLElement>("[data-testid='hand-area']");
    const slots = Array.from(
      document.querySelectorAll<HTMLElement>("[data-testid='hand-area'] [data-hand-card-slot]")
    );

    if (cards === null || slots.length < 2) {
      throw new Error("Need at least two hand card slots to read spacing metrics.");
    }

    const firstRect = slots[0]!.getBoundingClientRect();
    const secondRect = slots[1]!.getBoundingClientRect();

    return {
      isOverlap: cards.classList.contains("cards-overlap"),
      cardWidth: firstRect.width,
      gap: secondRect.left - firstRect.right
    };
  });
}

async function readHandOverlapLayoutState(page: Page): Promise<{
  isOverlap: boolean;
  leftPositions: number[];
}> {
  return page.evaluate(() => {
    const cards = document.querySelector<HTMLElement>("[data-testid='hand-area']");
    const slots = Array.from(
      document.querySelectorAll<HTMLElement>("[data-testid='hand-area'] [data-hand-card-slot]")
    );

    if (cards === null || slots.length === 0) {
      throw new Error("Need rendered hand card slots to read overlap layout state.");
    }

    return {
      isOverlap: cards.classList.contains("cards-overlap"),
      leftPositions: slots.map((slot) => Number.parseFloat(slot.style.left || "NaN"))
    };
  });
}

let injectedBattleMessageVersion = 1;

function createInjectedRoomStateMessage() {
  const snapshotVersion = injectedBattleMessageVersion;
  injectedBattleMessageVersion += 1;

  return {
    protocolVersion: "0.1.0",
    type: "room-state",
    roomId: "ROOM1",
    playerId: "player-self",
    snapshotVersion,
    room: {
      roomId: "ROOM1",
      roomCode: "ROOM1",
      status: "playing",
      mode: "no-challenge",
      hostPlayerId: "player-self",
      snapshotVersion,
      players: [
        {
          playerId: "player-self",
          displayName: "Battle Test",
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

function createInjectedSnapshotMessage(params: {
  topCard: Card;
  currentColor: "red" | "yellow" | "blue" | "green";
  hand: Card[];
  currentPlayerId?: string;
}) {
  const snapshotVersion = injectedBattleMessageVersion;
  injectedBattleMessageVersion += 1;
  const currentPlayerId = params.currentPlayerId ?? "player-self";
  const selfIsCurrentPlayer = currentPlayerId === "player-self";

  return {
    protocolVersion: "0.1.0",
    type: "snapshot",
    roomId: "ROOM1",
    playerId: "player-self",
    snapshotVersion,
    snapshot: {
      roomId: "ROOM1",
      snapshotVersion,
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
        displayName: "Battle Test",
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

function createNumberHand(prefix: string, count: number): Card[] {
  const colors = ["red", "yellow", "blue", "green"] as const;

  return Array.from({ length: count }, (_, index) =>
    createNumberCard(
      `${prefix}-${String(index)}`,
      colors[index % colors.length]!,
      (index % 10) as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9,
      `Card ${String(index)}`
    )
  );
}
