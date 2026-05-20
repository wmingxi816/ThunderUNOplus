import { expect, test, type Page } from "@playwright/test";
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
    "/rules/特色玩法（顺子）.png"
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
  await host.locator("#settings-adjust-toggle-button").click();
  await expect(host.locator("#settings-turn-orbit-y-slider")).toHaveCount(0);
  await expect(host.locator("#settings-turn-orbit-scale-slider")).toBeVisible();
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
