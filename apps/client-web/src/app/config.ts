export const DEFAULT_WS_URL = "ws://localhost:8787";
const DEV_SERVER_PORTS = new Set(["5173", "4173"]);

interface BrowserLocationLike {
  protocol: string;
  hostname: string;
  host: string;
  port: string;
}

export interface WebClientConfig {
  wsUrl: string;
}

export function normalizeWsUrl(input: string): string {
  const value = input.trim();

  if (value.length === 0) {
    return DEFAULT_WS_URL;
  }

  if (/^wss?:\/\//i.test(value)) {
    return value;
  }

  return `ws://${value}`;
}

export function getDefaultWsUrl(
  locationLike: BrowserLocationLike | null | undefined = getBrowserLocation()
): string {
  if (locationLike === null || locationLike.hostname.trim() === "") {
    return DEFAULT_WS_URL;
  }

  const hostname = locationLike.hostname.trim().toLowerCase();

  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return `ws://${locationLike.hostname}:8787`;
  }

  if (DEV_SERVER_PORTS.has(locationLike.port)) {
    return `ws://${locationLike.hostname}:8787`;
  }

  if (locationLike.protocol === "https:") {
    return `wss://${locationLike.host}/ws`;
  }

  if (locationLike.protocol === "http:") {
    return `ws://${locationLike.host}/ws`;
  }

  return DEFAULT_WS_URL;
}

export function readInitialConfig(
  locationSearch = "",
  locationLike: BrowserLocationLike | null | undefined = getBrowserLocation()
): WebClientConfig {
  const params = new URLSearchParams(locationSearch);
  const urlFromQuery = params.get("ws");
  const urlFromStorage = readLocalStorageValue("thunder-uno.wsUrl");
  const defaultWsUrl = getDefaultWsUrl(locationLike);

  return {
    wsUrl: normalizeWsUrl(urlFromQuery ?? urlFromStorage ?? defaultWsUrl)
  };
}

function readLocalStorageValue(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function getBrowserLocation(): BrowserLocationLike | null {
  try {
    if (globalThis.location === undefined) {
      return null;
    }

    return globalThis.location;
  } catch {
    return null;
  }
}
