import { defineConfig } from "@playwright/test";

const wsUrl = process.env.E2E_WS_URL ?? "localhost:8787";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  timeout: 30_000,
  expect: {
    timeout: 10_000
  },
  globalSetup: "./e2e/globalSetup.ts",
  use: {
    baseURL: `http://127.0.0.1:5173?ws=${wsUrl}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure"
  },
  webServer: {
    command: "corepack pnpm --filter @thunder-uno/client-web dev",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      HOST: "0.0.0.0",
      PORT: "5173"
    }
  }
});
