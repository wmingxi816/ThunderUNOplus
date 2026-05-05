import type { ClientMessage, ServerMessage } from "@thunder-uno/protocol";

export type ConnectionStatus = "idle" | "connecting" | "open" | "closed" | "error";

export interface WsClientHandlers {
  onStatusChange?: (status: ConnectionStatus) => void;
  onMessage?: (message: ServerMessage) => void;
  onError?: (error: unknown) => void;
}

export class WsClient {
  private socket: WebSocket | null = null;
  private status: ConnectionStatus = "idle";
  private connectionGeneration = 0;

  constructor(private readonly handlers: WsClientHandlers = {}) {}

  connect(url: string): void {
    const previousSocket = this.socket;
    const generation = this.connectionGeneration + 1;
    this.connectionGeneration = generation;
    this.setStatus("connecting");

    const socket = new WebSocket(url);
    this.socket = socket;

    socket.addEventListener("open", () => {
      if (this.socket !== socket || this.connectionGeneration !== generation) {
        return;
      }

      this.setStatus("open");

      if (previousSocket !== null && previousSocket !== socket) {
        try {
          previousSocket.close();
        } catch {
          // Ignore handoff close failures.
        }
      }
    });

    socket.addEventListener("message", (event) => {
      if (this.socket !== socket || this.connectionGeneration !== generation) {
        return;
      }

      try {
        this.handlers.onMessage?.(JSON.parse(String(event.data)) as ServerMessage);
      } catch (error) {
        this.handlers.onError?.(error);
      }
    });

    socket.addEventListener("close", () => {
      if (this.socket !== socket || this.connectionGeneration !== generation) {
        return;
      }

      this.socket = null;
      this.setStatus("closed");
    });

    socket.addEventListener("error", (event) => {
      if (this.socket !== socket || this.connectionGeneration !== generation) {
        return;
      }

      this.setStatus("error");
      this.handlers.onError?.(event);
    });
  }

  send(message: ClientMessage): void {
    if (this.socket === null || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket is not connected.");
    }

    this.socket.send(JSON.stringify(message));
  }

  close(): void {
    this.connectionGeneration += 1;

    if (this.socket !== null) {
      const socket = this.socket;
      this.socket = null;
      try {
        socket.close();
      } catch {
        // Ignore close errors so the UI can still update.
      }
      this.setStatus("closed");
    }
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }

  private setStatus(status: ConnectionStatus): void {
    this.status = status;
    this.handlers.onStatusChange?.(status);
  }
}
