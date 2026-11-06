import { isNativeApp, SolanaMWA } from "../native";

const STORAGE_KEY = "deadtiles.device";

function acceptableDeviceId(raw: string): string {
  const value = raw.trim();
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(value)) return "";
  if (value.toLowerCase() === "9774d56d682e549c") return "";
  return value;
}

function randomDeviceId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Id kept in this browser. Created once and reused. */
function localDeviceId(): string {
  try {
    const existing = acceptableDeviceId(localStorage.getItem(STORAGE_KEY) ?? "");
    if (existing) return existing;
    const created = randomDeviceId();
    localStorage.setItem(STORAGE_KEY, created);
    return created;
  } catch {
    return "";
  }
}

async function nativeDeviceId(): Promise<string> {
  if (!isNativeApp()) return "";
  try {
    const result = await SolanaMWA.appDeviceId();
    return acceptableDeviceId(result?.id ?? "");
  } catch {
    return "";
  }
}

let pending: Promise<string> | null = null;

/**
 * Stable id for this install. The Android app uses ANDROID_ID.
 * The website keeps a random id in local storage.
 */
export function clientDeviceId(): Promise<string> {
  if (!pending) {
    pending = nativeDeviceId().then((native) => native || localDeviceId());
  }
  return pending;
}
