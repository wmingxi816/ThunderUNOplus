import { expect, type BrowserContext, type Page } from "@playwright/test";

export async function bootPlayer(context: BrowserContext, nickname: string): Promise<Page> {
  const page = await context.newPage();

  await page.goto("/");
  await page.getByTestId("nickname-input").fill(nickname);
  await page.getByTestId("connect-button").click();
  await expect(page.getByTestId("connection-status")).toHaveText("open");

  return page;
}

export async function createRoom(page: Page): Promise<string> {
  await page.getByTestId("create-room-button").click();
  await expect(page.getByTestId("room-id")).toBeVisible();

  const roomId = (await page.getByTestId("room-id").textContent())?.trim();

  if (roomId === undefined || roomId.length === 0) {
    throw new Error("Room id did not render after room creation.");
  }

  return roomId;
}

export async function joinRoom(page: Page, roomId: string): Promise<void> {
  await page.getByTestId("join-room-input").fill(roomId);
  await page.getByTestId("join-room-button").click();
  await expect(page.getByTestId("room-id")).toHaveText(roomId);
}

export async function startGame(page: Page): Promise<void> {
  await page.getByTestId("start-game-button").click();
  await expect(page.getByTestId("battle-view")).toBeVisible();
  await expect(page.getByTestId("top-card")).toBeVisible();
  await expect(page.getByTestId("hand-area")).toBeVisible();
}

export async function waitForBattleView(page: Page): Promise<void> {
  await expect(page.getByTestId("battle-view")).toBeVisible();
  await expect(page.getByTestId("top-card")).toBeVisible();
  await expect(page.getByTestId("hand-area")).toBeVisible();
}
