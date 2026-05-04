import { expect, test } from "@playwright/test";
import { bootPlayer, createRoom, joinRoom, startGame, waitForBattleView } from "./helpers";

test("reconnects into an active game after reload", async ({ browser }) => {
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
  await expect(pageB.getByTestId("join-room-input")).toHaveValue(roomId);
  await pageB.getByTestId("connect-button").click();

  await expect(pageB.getByTestId("connection-status")).toHaveText("open");
  await expect(pageB.getByTestId("battle-view")).toBeVisible();
  await expect(pageB.getByTestId("top-card")).toBeVisible();

  await contextA.close();
  await contextB.close();
  await contextC.close();
});
