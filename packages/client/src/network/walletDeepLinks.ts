import { isNativeApp } from "../native";
import { isMobileDevice } from "../device";
import { listBrowserWallets } from "./solanaWallet";

const PLAY_ORIGIN = "https://play.deadtiles.com";
const PHANTOM_STORE =
  "https://play.google.com/store/apps/details?id=app.phantom";

/** Optional Play / sideload URL. Leave unset until a public APK listing exists. */
export function androidAppDownloadHref(): string | null {
  const url = import.meta.env.VITE_ANDROID_DOWNLOAD_URL?.trim();
  return url || null;
}

function browseTarget(): string {
  if (typeof window === "undefined") return PLAY_ORIGIN;
  if (window.location.protocol === "https:") {
    return `${window.location.origin}${window.location.pathname}`;
  }
  return PLAY_ORIGIN;
}

function isAndroid(): boolean {
  return /Android/i.test(navigator.userAgent || "");
}

/** True on a phone/tablet browser with no injected wallet (not the APK). */
export function needsMobileWebWalletHelp(): boolean {
  if (isNativeApp() || !isMobileDevice()) return false;
  return listBrowserWallets().length === 0;
}

/** True on a desktop browser with no injected wallet (not the APK). */
export function needsDesktopWalletHelp(): boolean {
  if (isNativeApp() || isMobileDevice()) return false;
  return listBrowserWallets().length === 0;
}

export const PHANTOM_DOWNLOAD_HREF = "https://phantom.app/download";
export const SOLFLARE_DOWNLOAD_HREF = "https://solflare.com/download";
export const METAMASK_DOWNLOAD_HREF = "https://metamask.io/download";

/** Opens play.deadtiles.com inside Phantom's in-app browser. Must run from a tap. */
export function phantomBrowseHref(): string {
  const target = encodeURIComponent(browseTarget());
  const ref = encodeURIComponent(browseTarget());
  const path = `ul/browse/${target}?ref=${ref}`;
  if (isAndroid()) {
    return `intent://${path}#Intent;scheme=https;host=phantom.app;package=app.phantom;S.browser_fallback_url=${encodeURIComponent(PHANTOM_STORE)};end`;
  }
  return `https://phantom.app/${path}`;
}

/** Opens the site inside Solflare's in-app browser. Must run from a tap. */
export function solflareBrowseHref(): string {
  const target = encodeURIComponent(browseTarget());
  const ref = encodeURIComponent(browseTarget());
  return `https://solflare.com/ul/v1/browse/${target}?ref=${ref}`;
}
