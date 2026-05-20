import { expect, test, type Page } from "@playwright/test";
import { bootPlayer, createRoom, joinRoom, startGame, waitForBattleView } from "./helpers";

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const metrics = await page.evaluate(() => {
    const root = document.documentElement;

    return {
      bodyScrollWidth: document.body.scrollWidth,
      clientWidth: root.clientWidth,
      rootScrollWidth: root.scrollWidth,
      innerWidth: window.innerWidth
    };
  });

  expect(metrics.rootScrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 3);
  expect(metrics.bodyScrollWidth).toBeLessThanOrEqual(metrics.innerWidth + 3);
}

async function bootCurrentLobbyPlayer(page: Page, nickname: string): Promise<void> {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("lobby-view")).toBeVisible();
  await expect(page.getByTestId("connection-status")).toHaveText("open");
  await page.locator("#nickname").fill(nickname);
}

async function createCurrentLobbyRoom(page: Page): Promise<void> {
  await page.locator("#create-room-button").click();
  await expect(page.locator("#room-id-input")).toHaveValue(/\d{6}/);
}

test("mobile lobby and battle stay readable in portrait and landscape", async ({ browser }) => {
  test.setTimeout(90_000);
  const contextA = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true
  });
  const pageA = await bootPlayer(contextA, "Mobile-A");

  await expect(pageA.getByTestId("create-room-button")).toBeVisible();
  await expectNoHorizontalOverflow(pageA);

  const roomId = await createRoom(pageA);

  const contextB = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true
  });
  const pageB = await bootPlayer(contextB, "Mobile-B");
  await joinRoom(pageB, roomId);

  const contextC = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true
  });
  const pageC = await bootPlayer(contextC, "Mobile-C");
  await joinRoom(pageC, roomId);

  await startGame(pageA);
  await waitForBattleView(pageB);
  await waitForBattleView(pageC);

  for (const page of [pageA, pageB, pageC]) {
    await expect(page.getByTestId("battle-view")).toBeVisible();
    await expect(page.getByTestId("hand-area")).toBeVisible();
    await expect(page.getByTestId("top-card")).toBeVisible();
    await expect(page.getByTestId("draw-card-button")).toBeVisible();
    await expect(page.getByTestId("error-line")).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }

  await pageA.setViewportSize({ width: 844, height: 390 });
  await pageB.setViewportSize({ width: 844, height: 390 });
  await pageC.setViewportSize({ width: 844, height: 390 });

  for (const page of [pageA, pageB, pageC]) {
    await expect(page.getByTestId("battle-view")).toBeVisible();
    await expect(page.getByTestId("hand-area")).toBeVisible();
    await expect(page.getByTestId("top-card")).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }

});

test("long nicknames keep lobby cards readable on mobile", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true
  });
  const host = await bootPlayer(context, "player-with-a-very-very-long-name");
  const roomId = await createRoom(host);

  const guest = await bootPlayer(context, "超级无敌霹雳长昵称玩家ABCDEFG123456789");
  await joinRoom(guest, roomId);

  await expect(host.getByTestId("room-player")).toHaveCount(2);
  await expect(guest.getByTestId("room-player")).toHaveCount(2);
  await expect(host.getByTestId("room-player").first()).toContainText("player-wit");
  await expect(guest.getByTestId("room-player").nth(1)).toContainText("超级无敌霹雳长昵称");
  await expectNoHorizontalOverflow(host);
  await expectNoHorizontalOverflow(guest);

});

test("mobile lobby stacks panels and keeps player cards compact", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true
  });
  const host = await context.newPage();
  await bootCurrentLobbyPlayer(host, "player-with-a-very-very-long-name");
  await createCurrentLobbyRoom(host);

  const metrics = await host.evaluate(() => {
    const controlPanel = document.querySelector<HTMLElement>("[data-testid='lobby-control-panel']");
    const chatPanel = document.querySelector<HTMLElement>("[data-testid='lobby-chat-panel']");
    const seatCards = Array.from(document.querySelectorAll<HTMLElement>(".lobby-seat-card"));
    const seatName = document.querySelector<HTMLElement>(".lobby-seat-name");

    if (controlPanel === null || chatPanel === null || seatName === null || seatCards.length === 0) {
      throw new Error("Lobby panels or player cards did not render.");
    }

    const controlRect = controlPanel.getBoundingClientRect();
    const chatRect = chatPanel.getBoundingClientRect();
    const nameStyle = window.getComputedStyle(seatName);

    return {
      controlBottom: controlRect.bottom,
      chatTop: chatRect.top,
      documentScrollHeight: document.documentElement.scrollHeight,
      viewportHeight: window.innerHeight,
      maxSeatHeight: Math.max(...seatCards.map((card) => card.getBoundingClientRect().height)),
      seatNameHeight: seatName.getBoundingClientRect().height,
      nameLineHeight: Number.parseFloat(nameStyle.lineHeight),
      nameOverflow: nameStyle.overflow,
      nameTextOverflow: nameStyle.textOverflow,
      nameWhiteSpace: nameStyle.whiteSpace
    };
  });

  expect(metrics.chatTop).toBeGreaterThanOrEqual(metrics.controlBottom);
  expect(metrics.documentScrollHeight).toBeGreaterThan(metrics.viewportHeight);
  expect(metrics.maxSeatHeight).toBeLessThanOrEqual(60);
  expect(metrics.seatNameHeight).toBeLessThanOrEqual(metrics.nameLineHeight + 1);
  expect(metrics.nameOverflow).toBe("hidden");
  expect(metrics.nameTextOverflow).toBe("ellipsis");
  expect(metrics.nameWhiteSpace).toBe("nowrap");
  await expectNoHorizontalOverflow(host);

});

test("lobby matchmaking controls scale from panel width instead of viewport height", async ({ browser }) => {
  const collectMetrics = async (height: number) => {
    const context = await browser.newContext({
      viewport: { width: 980, height }
    });
    const page = await context.newPage();
    await bootCurrentLobbyPlayer(page, `Scale-${height}`);
    await createCurrentLobbyRoom(page);

    const metrics = await page.evaluate(() => {
      const rect = (selector: string) => {
        const element = document.querySelector<HTMLElement>(selector);

        if (element === null) {
          throw new Error(`Missing ${selector}`);
        }

        const box = element.getBoundingClientRect();

        return {
          width: box.width,
          height: box.height
        };
      };

      return {
        matchmakingCard: rect(".lobby-matchmaking-card"),
        createButton: rect("#create-room-button"),
        roomDigit: rect("[data-testid='room-code-digit-0']"),
        modeSelect: rect("#mode"),
        statusPill: rect(".lobby-room-status-pill")
      };
    });

    await context.close();
    return metrics;
  };

  const tall = await collectMetrics(900);
  const short = await collectMetrics(620);

  expect(tall.createButton.width).toBeLessThanOrEqual(tall.matchmakingCard.width);
  expect(tall.roomDigit.width).toBeLessThanOrEqual(tall.matchmakingCard.width);
  expect(tall.modeSelect.width).toBeLessThanOrEqual(tall.matchmakingCard.width);
  expect(tall.statusPill.width).toBeLessThanOrEqual(tall.matchmakingCard.width);

  expect(Math.abs(tall.createButton.height - short.createButton.height)).toBeLessThanOrEqual(1);
  expect(Math.abs(tall.roomDigit.height - short.roomDigit.height)).toBeLessThanOrEqual(1);
  expect(Math.abs(tall.modeSelect.height - short.modeSelect.height)).toBeLessThanOrEqual(1);
  expect(Math.abs(tall.statusPill.height - short.statusPill.height)).toBeLessThanOrEqual(1);
});
