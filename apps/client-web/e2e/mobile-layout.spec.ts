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

  expect(metrics.rootScrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
  expect(metrics.bodyScrollWidth).toBeLessThanOrEqual(metrics.innerWidth + 1);
}

test("mobile lobby and battle stay readable in portrait and landscape", async ({ browser }) => {
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

  await contextA.close();
  await contextB.close();
  await contextC.close();
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
  await expect(host.getByTestId("room-player").first()).toContainText("player-with-a-very-very-long-name");
  await expect(guest.getByTestId("room-player").nth(1)).toContainText("超级无敌霹雳长昵称玩家ABCDEFG123456789");
  await expectNoHorizontalOverflow(host);
  await expectNoHorizontalOverflow(guest);

  await context.close();
});
