import { WebSocket } from "ws";
import type { ServerMessage } from "@thunder-uno/protocol";

export interface WsTestClient {
  socket: WebSocket;
  messages: ServerMessage[];
  waitForMessage(
    predicate: (message: ServerMessage) => boolean,
    timeoutMs?: number
  ): Promise<ServerMessage>;
  sendJson(value: unknown): void;
  close(): Promise<void>;
}

export async function createWsTestClient(url: string): Promise<WsTestClient> {
  const socket = new WebSocket(url);
  const messages: ServerMessage[] = [];
  const listeners = new Set<(message: ServerMessage) => void>();

  socket.on("message", (data) => {
    const message = JSON.parse(data.toString()) as ServerMessage;
    messages.push(message);

    for (const listener of listeners) {
      listener(message);
    }
  });

  await waitForOpen(socket);

  return {
    socket,
    messages,
    waitForMessage(predicate, timeoutMs = 2_000) {
      const existing = messages.find(predicate);

      if (existing !== undefined) {
        return Promise.resolve(existing);
      }

      return new Promise<ServerMessage>((resolve, reject) => {
        const timer = setTimeout(() => {
          listeners.delete(listener);
          reject(new Error("Timed out waiting for WebSocket message."));
        }, timeoutMs);

        const listener = (message: ServerMessage) => {
          if (!predicate(message)) {
            return;
          }

          clearTimeout(timer);
          listeners.delete(listener);
          resolve(message);
        };

        listeners.add(listener);
      });
    },
    sendJson(value: unknown) {
      socket.send(JSON.stringify(value));
    },
    close() {
      if (socket.readyState === socket.CLOSED) {
        return Promise.resolve();
      }

      return new Promise<void>((resolve) => {
        socket.once("close", () => resolve());
        socket.close();
      });
    }
  };
}

function waitForOpen(socket: WebSocket): Promise<void> {
  if (socket.readyState === socket.OPEN) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    socket.once("open", () => resolve());
    socket.once("error", (error) => reject(error));
  });
}
