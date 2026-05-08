import { WebSocketServer } from "ws";
import { createConnectionId } from "../ids/createConnectionId";
import { ConnectionRegistry } from "../connection/connectionRegistry";
import { createWsConnection } from "./wsConnection";
import { handleClientMessage } from "./messageHandler";
import { handleConnectionClosed } from "./lifecycle";
import { RoomManager } from "../room/roomManager";
import type { BotScheduler } from "../bot/botScheduler";

export interface CreateWsServerParams {
  port: number;
  host?: string;
  roomManager: RoomManager;
  connectionRegistry: ConnectionRegistry;
  botScheduler?: BotScheduler | undefined;
}

export interface WsServerRuntime {
  server: WebSocketServer;
  port: number;
  close(): Promise<void>;
}

export async function createWsServer(
  params: CreateWsServerParams
): Promise<WsServerRuntime> {
  const server = new WebSocketServer({
    port: params.port,
    ...(params.host ? { host: params.host } : {})
  });

  server.on("connection", (socket) => {
    const connection = createWsConnection({
      connectionId: createConnectionId(),
      raw: socket
    });

    params.connectionRegistry.registerConnection(connection);

    socket.on("message", (rawMessage) => {
      handleClientMessage({
        connection,
        rawMessage,
        roomManager: params.roomManager,
        connectionRegistry: params.connectionRegistry,
        botScheduler: params.botScheduler
      });
    });

    socket.on("close", () => {
      handleConnectionClosed({
        connection,
        roomManager: params.roomManager,
        connectionRegistry: params.connectionRegistry
      });
    });

    socket.on("error", () => {
      // Phase 3B 先做安全吞掉，避免 ws error 把服务直接打断。
    });
  });

  await waitForServerListening(server);

  return {
    server,
    port: getServerPort(server),
    close() {
      params.botScheduler?.dispose();
      return new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error !== undefined) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    }
  };
}

function waitForServerListening(server: WebSocketServer): Promise<void> {
  if (server.address() !== null) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    server.once("listening", () => resolve());
    server.once("error", (error) => reject(error));
  });
}

function getServerPort(server: WebSocketServer): number {
  const address = server.address();

  if (address === null || typeof address === "string") {
    throw new Error("WebSocket server did not expose a numeric port.");
  }

  return address.port;
}
