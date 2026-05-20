import { expect, test } from "@playwright/test";
import { bootPlayer, createRoom, joinRoom, startGame, waitForBattleView } from "./helpers";

test("three-player room flow keeps the main path alive", async ({ browser }) => {
  test.setTimeout(45_000);
  const contextA = await browser.newContext();
  const pageA = await bootPlayer(contextA, "Alice");
  const roomId = await createRoom(pageA);
  await expect(pageA.getByTestId("create-room-button")).toBeDisabled();

  const pageB = await bootPlayer(contextA, "Bob");
  await joinRoom(pageB, roomId);
  await expect(pageB.getByTestId("create-room-button")).toBeDisabled();

  const pageC = await bootPlayer(contextA, "Cara");
  await joinRoom(pageC, roomId);
  await expect(pageA.getByTestId("room-player")).toHaveCount(3);
  await expect(pageB.getByTestId("room-player")).toHaveCount(3);
  await expect(pageC.getByTestId("room-player")).toHaveCount(3);
  await expect(pageB.locator('[data-room-host="true"]')).toContainText("Alice");
  await expect(pageC.locator('[data-room-host="true"]')).toContainText("Alice");

  await startGame(pageA);
  await waitForBattleView(pageB);
  await waitForBattleView(pageC);

  await expect(pageA.getByTestId("battle-view")).toBeVisible();
  await expect(pageB.getByTestId("battle-view")).toBeVisible();
  await expect(pageC.getByTestId("battle-view")).toBeVisible();

  await expect(pageA.getByTestId("top-card")).toBeVisible();
  await expect(pageB.getByTestId("top-card")).toBeVisible();
  await expect(pageC.getByTestId("top-card")).toBeVisible();
  const pages = [pageA, pageB, pageC];
  for (const page of pages) {
    await expect(page.locator("[data-challenge]")).toHaveCount(0);
    await expect(page.getByTestId("challenge-prompt")).toHaveCount(0);
  }

  const enabledStates = await Promise.all(
    pages.map(async (page) => page.getByTestId("draw-card-button").isEnabled())
  );
  const currentPlayerIndex = enabledStates.findIndex(Boolean);

  expect(currentPlayerIndex).toBeGreaterThanOrEqual(0);

  for (let index = 0; index < pages.length; index += 1) {
    const drawButton = pages[index]!.getByTestId("draw-card-button");
    if (index === currentPlayerIndex) {
      await expect(drawButton).toBeEnabled();
    } else {
      await expect(drawButton).toBeDisabled();
    }
  }

  const currentPage = pages[currentPlayerIndex]!;
  const handCards = currentPage.getByTestId("hand-area").locator(".card-button");
  const beforeCount = await handCards.count();

  await currentPage.getByTestId("draw-card-button").click();

  await expect(handCards).toHaveCount(beforeCount + 1);
});
