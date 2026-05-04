import { describe, expect, it } from "vitest";
import { DEFAULT_WS_URL, normalizeWsUrl, readInitialConfig } from "./config";

describe("normalizeWsUrl", () => {
  it("uses the local game-server by default", () => {
    expect(normalizeWsUrl("")).toBe(DEFAULT_WS_URL);
  });

  it("adds ws:// to LAN host values", () => {
    expect(normalizeWsUrl("192.168.1.23:8787")).toBe("ws://192.168.1.23:8787");
  });

  it("adds ws:// to localhost host values", () => {
    expect(normalizeWsUrl("localhost:8787")).toBe("ws://localhost:8787");
  });

  it("keeps explicit ws URLs unchanged", () => {
    expect(normalizeWsUrl("ws://127.0.0.1:8787")).toBe("ws://127.0.0.1:8787");
  });

  it("keeps explicit wss URLs unchanged", () => {
    expect(normalizeWsUrl("wss://example.com/socket")).toBe(
      "wss://example.com/socket"
    );
  });
});

describe("readInitialConfig", () => {
  it("reads a websocket URL from the query string", () => {
    expect(readInitialConfig("?ws=10.0.0.5:8787").wsUrl).toBe(
      "ws://10.0.0.5:8787"
    );
  });
});
