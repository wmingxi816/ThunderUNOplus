import { expect, type BrowserContext, type Page } from "@playwright/test";

export async function bootPlayer(context: BrowserContext, nickname: string): Promise<Page> {
  const page = await context.newPage();

  await page.goto("/");
  await page.getByTestId("nickname-input").fill(nickname);
  await expect(page.getByTestId("connection-status")).toHaveText("open");

  return page;
}

export async function createRoom(page: Page): Promise<string> {
  await page.getByTestId("create-room-button").click();
  await expect(page.getByTestId("room-id")).toHaveText(/^\d{6}$/);

  const roomId = (await page.getByTestId("room-id").textContent())?.trim();

  if (roomId === undefined || roomId.length === 0) {
    throw new Error("Room id did not render after room creation.");
  }

  return roomId;
}

export async function joinRoom(page: Page, roomId: string): Promise<void> {
  for (let index = 0; index < roomId.length; index += 1) {
    await page.getByTestId(`room-code-digit-${String(index)}`).fill(roomId[index] ?? "");
  }
  await page.getByTestId("join-room-button").click();
  await expect(page.getByTestId("room-id")).toHaveText(roomId);
  await page.getByTestId("ready-button").click();
}

export async function startGame(page: Page): Promise<void> {
  await page.getByTestId("start-game-button").click();
  await expect(page.getByTestId("battle-view")).toBeVisible();
  await chooseInitialDirectionIfEnabled(page);
  await expect(page.getByTestId("top-card")).toBeVisible();
  await expect(page.getByTestId("hand-area")).toBeVisible();
}

export async function waitForBattleView(page: Page): Promise<void> {
  await expect(page.getByTestId("battle-view")).toBeVisible();
  await chooseInitialDirectionIfEnabled(page);
  await expect(page.getByTestId("top-card")).toBeVisible();
  await expect(page.getByTestId("hand-area")).toBeVisible();
}

async function chooseInitialDirectionIfEnabled(page: Page): Promise<void> {
  const initialDirectionButton = page.locator("[data-initial-direction='clockwise']");

  await initialDirectionButton.waitFor({ state: "attached", timeout: 1_000 }).catch(() => undefined);

  if ((await initialDirectionButton.count()) === 1 && (await initialDirectionButton.isEnabled())) {
    await initialDirectionButton.click();
    await expect(page.getByTestId("initial-direction-backdrop")).toHaveCount(0);
  }
}
