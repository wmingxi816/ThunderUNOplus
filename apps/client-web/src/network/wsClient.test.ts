// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WsClient, type ConnectionStatus } from "./wsClient";

class FakeWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static instances: FakeWebSocket[] = [];

  readyState = FakeWebSocket.CONNECTING;
  readonly sentMessages: string[] = [];
  private readonly listeners = new Map<string, Set<(event: unknown) => void>>();

  constructor(readonly url: string) {
    FakeWebSocket.instances.push(this);
  }

  addEventListener(type: string, listener: (event: unknown) => void): void {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  send(data: string): void {
    this.sentMessages.push(data);
  }

  close(): void {
    this.readyState = FakeWebSocket.CLOSED;
  }

  triggerOpen(): void {
    this.readyState = FakeWebSocket.OPEN;
    this.emit("open", {});
  }

  triggerMessage(data: unknown): void {
    this.emit("message", {
      data: JSON.stringify(data)
    });
  }

  triggerClose(): void {
    this.readyState = FakeWebSocket.CLOSED;
    this.emit("close", {});
  }

  private emit(type: string, event: unknown): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }
}

describe("WsClient", () => {
  beforeEach(() => {
    FakeWebSocket.instances = [];
    vi.stubGlobal("WebSocket", FakeWebSocket as unknown as typeof WebSocket);
  });

  it("keeps a newer connection open when the replaced socket closes late", () => {
    const statuses: ConnectionStatus[] = [];
    const client = new WsClient({
      onStatusChange(status) {
        statuses.push(status);
      }
    });

    client.connect("ws://first");
    const first = FakeWebSocket.instances[0]!;
    first.triggerOpen();

    client.connect("ws://second");
    const second = FakeWebSocket.instances[1]!;
    second.triggerOpen();
    first.triggerClose();

    expect(client.getStatus()).toBe("open");
    expect(statuses.at(-1)).toBe("open");
  });

  it("ignores late messages from a replaced socket", () => {
    const messages: unknown[] = [];
    const client = new WsClient({
      onMessage(message) {
        messages.push(message);
      }
    });

    client.connect("ws://first");
    const first = FakeWebSocket.instances[0]!;
    first.triggerOpen();

    client.connect("ws://second");
    const second = FakeWebSocket.instances[1]!;
    second.triggerOpen();

    first.triggerMessage({
      protocolVersion: "0.1.0",
      type: "room-closed",
      roomId: "old-room"
    });
    second.triggerMessage({
      protocolVersion: "0.1.0",
      type: "room-closed",
      roomId: "new-room"
    });

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      roomId: "new-room"
    });
  });

  it("marks the active connection closed when it closes", () => {
    const client = new WsClient();

    client.connect("ws://active");
    const socket = FakeWebSocket.instances[0]!;
    socket.triggerOpen();
    socket.triggerClose();

    expect(client.getStatus()).toBe("closed");
  });
});
