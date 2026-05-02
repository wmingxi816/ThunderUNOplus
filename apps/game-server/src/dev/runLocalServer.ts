import { createInMemoryGameServer } from "../main";
import { createWsServer } from "../gateway/wsServer";

const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? "0.0.0.0";

const runtime = createInMemoryGameServer();
const wsRuntime = await createWsServer({
  port,
  host,
  roomManager: runtime.roomManager,
  connectionRegistry: runtime.connectionRegistry
});

console.log(
  `[game-server] listening on ${host}:${String(wsRuntime.port)} ` +
    `(local: ws://localhost:${String(wsRuntime.port)})`
);

process.on("SIGINT", async () => {
  await wsRuntime.close();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await wsRuntime.close();
  process.exit(0);
});
