import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createInMemoryGameServer } from "../main";
import { createWsServer, type WsServerRuntime } from "../gateway/wsServer";
import { runMultiClientScenario } from "../dev/multiClientScenario";

describe("multiClientScenario integration", () => {
  let runtime: ReturnType<typeof createInMemoryGameServer>;
  let wsRuntime: WsServerRuntime;
  let wsUrl: string;

  beforeEach(async () => {
    runtime = createInMemoryGameServer();
    wsRuntime = await createWsServer({
      port: 0,
      roomManager: runtime.roomManager,
      connectionRegistry: runtime.connectionRegistry
    });
    wsUrl = `ws://localhost:${String(wsRuntime.port)}`;
  });

  afterEach(async () => {
    await wsRuntime.close();
  });

  it("3 人 no-challenge 场景可以跑若干步不崩溃", async () => {
    const result = await runMultiClientScenario({
      wsUrl,
      players: 3,
      mode: "no-challenge",
      seed: 1001,
      maxSteps: 60
    });

    expect(result.status).not.toBe("failed");
    expect(result.roomId.length).toBeGreaterThan(0);
    expect(result.steps).toBeGreaterThan(0);
  });

  it("8 人 with-challenge 场景在 reconnect 模式下可以稳定推进", async () => {
    const result = await runMultiClientScenario({
      wsUrl,
      players: 8,
      mode: "with-challenge",
      seed: 2002,
      maxSteps: 80,
      testReconnect: true
    });

    expect(result.status).not.toBe("failed");
    expect(result.reconnectTestPassed).toBe(true);
    expect(result.roomId.length).toBeGreaterThan(0);
  });
});
