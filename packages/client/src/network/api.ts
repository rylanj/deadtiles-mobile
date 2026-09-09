import { CapacitorHttp } from "@capacitor/core";
import { isNativeApp } from "../native";

export class ApiHttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiHttpError";
    this.status = status;
  }
}

type ApiRequestInit = {
  method?: string;
  headers?: Record<string, string>;
  json?: unknown;
};

function looksLikeHtml(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.startsWith("<") || trimmed.startsWith("<!");
}

function htmlInsteadOfJsonError(): Error {
  return new Error(
    "Game server returned a web page instead of JSON. Check VITE_SERVER_URL points at the Colyseus API, not the website files.",
  );
}

function parseBody<T>(raw: unknown): T {
  if (typeof raw === "string") {
    if (looksLikeHtml(raw)) throw htmlInsteadOfJsonError();
    try {
      return JSON.parse(raw) as T;
    } catch {
      throw new Error("Game server returned a response that is not JSON");
    }
  }
  return raw as T;
}

function errorFromBody(status: number, data: unknown): ApiHttpError {
  if (
    data &&
    typeof data === "object" &&
    "error" in data &&
    typeof (data as { error?: unknown }).error === "string"
  ) {
    return new ApiHttpError(status, (data as { error: string }).error);
  }
  return new ApiHttpError(status, `Request failed (${status})`);
}

function isNetworkFailure(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /failed to fetch|networkerror|network request failed|load failed|the internet connection appears offline|unable to resolve host|timeout|timed out|connection (refused|reset)/i.test(
    message,
  );
}

function networkError(err: unknown): Error {
  if (isNetworkFailure(err)) {
    return new Error(
      "Could not reach the Deadtiles server. Check that this device can open https://play.deadtiles.com",
    );
  }
  return err instanceof Error ? err : new Error(String(err));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Auth/API helper. On Android this uses native HTTP so requests still work
 * after Phantom returns (WebView fetch is often paused or CORS-blocked from
 * https://localhost). Desktop keeps window.fetch.
 */
export async function apiRequest<T>(
  url: string,
  init?: ApiRequestInit,
): Promise<T> {
  const attempts = isNativeApp() ? 5 : 1;
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await apiRequestOnce<T>(url, init);
    } catch (err) {
      lastError = err;
      if (err instanceof ApiHttpError) throw err;
      if (attempt < attempts - 1) {
        await sleep(400 * (attempt + 1));
        continue;
      }
    }
  }

  throw networkError(lastError);
}

async function apiRequestOnce<T>(
  url: string,
  init?: ApiRequestInit,
): Promise<T> {
  const method = (init?.method ?? "GET").toUpperCase();
  const headers: Record<string, string> = { ...init?.headers };

  if (isNativeApp()) {
    if (init?.json !== undefined && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }
    const res = await CapacitorHttp.request({
      url,
      method,
      headers,
      data: init?.json,
      connectTimeout: 15000,
      readTimeout: 15000,
      responseType: "json",
    });
    if (!res.status) {
      throw new Error("Failed to fetch");
    }
    const data = parseBody<T>(res.data);
    if (res.status < 200 || res.status >= 300) {
      throw errorFromBody(res.status, data);
    }
    return data;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: init?.json !== undefined ? JSON.stringify(init.json) : undefined,
  });
  const text = await res.text();
  if (looksLikeHtml(text)) throw htmlInsteadOfJsonError();
  let data: T;
  try {
    data = JSON.parse(text) as T;
  } catch {
    throw new Error("Game server returned a response that is not JSON");
  }
  if (!res.ok) throw errorFromBody(res.status, data);
  return data;
}
