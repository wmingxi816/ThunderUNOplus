import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createInMemoryGameServer } from "../main";
import { createWsServer, type WsServerRuntime } from "../gateway/wsServer";
import { DevWsClient } from "../dev/devWsClient";
import { chooseTurnDecision } from "../dev/scenarioDecision";

describe("DevWsClient integration", () => {
  let runtime: ReturnType<typeof createInMemoryGameServer>;
  let wsRuntime: WsServerRuntime;
  let wsUrl: string;
  const clients: DevWsClient[] = [];

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
    for (const client of clients) {
      await client.close();
    }

    await wsRuntime.close();
  });

  it("多客户端可以 create-room / join-room / start-game，且 snapshot 不泄露他人手牌", async () => {
    const startedClients = await createStartedClients(wsUrl, 3);
    clients.push(...startedClients);

    for (const client of startedClients) {
      expect(client.latestSnapshot?.self.hand).toHaveLength(7);
      expect("hand" in client.latestSnapshot!.opponents[0]!).toBe(false);
    }
  });

  it("当前玩家的 command 会推进 snapshotVersion", async () => {
    const startedClients = await createStartedClients(wsUrl, 3);
    clients.push(...startedClients);

    const currentPlayerId = startedClients[0]!.latestSnapshot!.currentPlayerId;
    const currentClient = startedClients.find(
      (client) => client.playerId === currentPlayerId
    )!;
    const beforeVersion = currentClient.latestSnapshot!.snapshotVersion;
    const decision = chooseTurnDecision(currentClient.latestSnapshot!, 2_000);
    const response = await currentClient.sendCommand(decision.command);

    if (response.type !== "events") {
      throw new Error("Expected events response.");
    }

    expect(response.events.some((event) => event.type === "command-rejected")).toBe(false);

    await Promise.all(
      startedClients.map((client) => client.waitForSnapshotVersion(response.snapshotVersion))
    );

    expect(currentClient.latestSnapshot!.snapshotVersion).toBeGreaterThan(beforeVersion);
  });

  it("非当前玩家的 command 会被 rejected，且只回给请求者", async () => {
    const startedClients = await createStartedClients(wsUrl, 3);
    clients.push(...startedClients);

    const currentPlayerId = startedClients[0]!.latestSnapshot!.currentPlayerId;
    const nonCurrentClient = startedClients.find(
      (client) => client.playerId !== currentPlayerId
    )!;
    const otherClients = startedClients.filter(
      (client) => client !== nonCurrentClient
    );
    const beforeCounts = new Map(
      startedClients.map((client) => [client.userId, client.receivedMessages.length])
    );

    const response = await nonCurrentClient.sendCommand({
      type: "draw-card",
      playerId: nonCurrentClient.playerId!,
      timestampMs: 3_000
    });

    if (response.type !== "events") {
      throw new Error("Expected events response.");
    }

    expect(
      response.events.some((event) => event.type === "command-rejected")
    ).toBe(true);

    await sleep(50);

    for (const client of otherClients) {
      const previousCount = beforeCounts.get(client.userId)!;
      const newMessages = client.receivedMessages.slice(previousCount);
      expect(
        newMessages.some((message) => {
          return (
            message.type === "events" &&
            message.events.some((event) => event.type === "command-rejected")
          );
        })
      ).toBe(false);
    }
  });
});

async function createStartedClients(
  wsUrl: string,
  playerCount: number
): Promise<DevWsClient[]> {
  const createdClients = Array.from({ length: playerCount }, (_, index) => {
    const serial = String(index + 1).padStart(3, "0");
    return new DevWsClient({
      wsUrl,
      userId: `dev-user-${serial}`,
      nickname: `Dev Test Player ${String(index + 1)}`,
      avatarUrl: null
    });
  });

  const owner = createdClients[0]!;
  await owner.connect();
  const roomState = await owner.createRoom("no-challenge");

  for (let index = 1; index < createdClients.length; index += 1) {
    const client = createdClients[index]!;
    await client.connect();
    await client.joinRoom(roomState.roomId);
    await client.setReady(true);
  }

  await Promise.all(
    createdClients.map((client) => client.waitForRoomPlayerCount(playerCount))
  );

  await owner.startGame(1001);
  await Promise.all(
    createdClients.map((client) => client.waitForSnapshotVersion(1))
  );

  return createdClients;
}

function sleep(timeoutMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, timeoutMs));
}
