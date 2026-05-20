import { expect, test } from "@playwright/test";
import { bootPlayer } from "./helpers";

test("joining a missing room surfaces a visible error", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await bootPlayer(context, "ErrorCase");

  for (let index = 0; index < 6; index += 1) {
    await page.getByTestId(`room-code-digit-${String(index)}`).fill("0");
  }
  await page.getByTestId("join-room-button").click();

  await expect(page.getByTestId("error-line")).not.toHaveText("");
  await expect(page.getByTestId("connection-status")).toHaveText("open");

  await context.close();
});
