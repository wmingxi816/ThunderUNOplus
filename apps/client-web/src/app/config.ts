export const DEFAULT_WS_URL = "ws://localhost:8787";

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

export function readInitialConfig(locationSearch = ""): WebClientConfig {
  const params = new URLSearchParams(locationSearch);
  const urlFromQuery = params.get("ws");
  const urlFromStorage = readLocalStorageValue("thunder-uno.wsUrl");

  return {
    wsUrl: normalizeWsUrl(urlFromQuery ?? urlFromStorage ?? DEFAULT_WS_URL)
  };
}

function readLocalStorageValue(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}
