import { describe, expect, it } from "vitest";
import {
  DEFAULT_WS_URL,
  getDefaultWsUrl,
  normalizeWsUrl,
  readInitialConfig
} from "./config";

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

  it("uses same-origin wss with a /ws path on https sites", () => {
    expect(
      getDefaultWsUrl({
        protocol: "https:",
        hostname: "thunderunoplus.fun",
        host: "thunderunoplus.fun",
        port: ""
      })
    ).toBe("wss://thunderunoplus.fun/ws");
  });

  it("uses same-origin ws with a /ws path on http sites", () => {
    expect(
      getDefaultWsUrl({
        protocol: "http:",
        hostname: "example.com",
        host: "example.com:8080",
        port: "8080"
      })
    ).toBe("ws://example.com:8080/ws");
  });

  it("keeps localhost development on port 8787", () => {
    expect(
      getDefaultWsUrl({
        protocol: "http:",
        hostname: "localhost",
        host: "localhost:5173",
        port: "5173"
      })
    ).toBe("ws://localhost:8787");
  });

  it("keeps LAN preview builds on port 8787", () => {
    expect(
      getDefaultWsUrl({
        protocol: "http:",
        hostname: "192.168.1.23",
        host: "192.168.1.23:4173",
        port: "4173"
      })
    ).toBe("ws://192.168.1.23:8787");
  });

  it("falls back to the static local default when location is unavailable", () => {
    expect(getDefaultWsUrl(null)).toBe(DEFAULT_WS_URL);
  });
});
