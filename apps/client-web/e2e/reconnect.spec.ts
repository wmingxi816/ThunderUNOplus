import { expect, test } from "@playwright/test";
import { bootPlayer, createRoom, joinRoom, startGame, waitForBattleView } from "./helpers";

test("reconnects into an active game after reload", async ({ browser }) => {
  test.setTimeout(60_000);
  const contextA = await browser.newContext();
  const pageA = await bootPlayer(contextA, "Reconnect-A");
  const roomId = await createRoom(pageA);

  const contextB = await browser.newContext();
  const pageB = await bootPlayer(contextB, "Reconnect-B");
  await joinRoom(pageB, roomId);

  const contextC = await browser.newContext();
  const pageC = await bootPlayer(contextC, "Reconnect-C");
  await joinRoom(pageC, roomId);

  await startGame(pageA);
  await waitForBattleView(pageB);
  await waitForBattleView(pageC);

  await pageB.reload();
  await expect(pageB.getByTestId("connection-status")).toHaveText("open", { timeout: 20_000 });
  await expect(pageB.getByTestId("battle-view")).toBeVisible({ timeout: 20_000 });
  await expect(pageB.getByTestId("top-card")).toBeVisible({ timeout: 20_000 });

});
