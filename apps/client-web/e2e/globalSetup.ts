import { spawn } from "node:child_process";
import { createConnection } from "node:net";

const READY_MARKER = "[game-server] listening on";
const GAME_SERVER_HOST = "127.0.0.1";
const GAME_SERVER_PORT = 8787;

export default async function globalSetup(): Promise<() => Promise<void>> {
  if (await isPortOpen(GAME_SERVER_HOST, GAME_SERVER_PORT)) {
    return async () => undefined;
  }

  const isWindows = process.platform === "win32";
  const command = isWindows ? "corepack pnpm --filter @thunder-uno/game-server dev" : "corepack";
  const args = isWindows
    ? []
    : ["pnpm", "--filter", "@thunder-uno/game-server", "dev"];
  const child = spawn(command, args, {
    env: {
      ...process.env,
      HOST: GAME_SERVER_HOST,
      PORT: String(GAME_SERVER_PORT)
    },
    shell: isWindows,
    stdio: ["ignore", "pipe", "pipe"]
  });

  let output = "";

  await waitForReady(child, output);

  return async () => {
    if (!child.killed) {
      child.kill();
    }
  };
}

async function waitForReady(child: ReturnType<typeof spawn>, output: string): Promise<void> {
  await Promise.race([
    new Promise<void>((resolve, reject) => {
      const fail = (error: Error): void => {
        reject(
          new Error(
            `${error.message}\n\nGame server output:\n${output || "(no output captured)"}`
          )
        );
      };

      child.once("error", fail);
      child.once("exit", (code) => {
        if (code === 0) {
          fail(new Error("Game server exited before becoming ready."));
          return;
        }

        fail(new Error(`Game server exited with code ${String(code)}.`));
      });

      child.stdout?.on("data", (chunk: Buffer) => {
        output += chunk.toString("utf8");
        if (output.includes(READY_MARKER)) {
          resolve();
        }
      });

      child.stderr?.on("data", (chunk: Buffer) => {
        output += chunk.toString("utf8");
      });
    }),
    new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(
          new Error(
            `Timed out waiting for game-server to start.\n\nGame server output:\n${output || "(no output captured)"}`
          )
        );
      }, 120_000);
    })
  ]);
}

function isPortOpen(host: string, port: number): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const socket = createConnection({ host, port });

    socket.once("connect", () => {
      socket.end();
      resolve(true);
    });

    socket.once("error", () => {
      resolve(false);
    });
  });
}
