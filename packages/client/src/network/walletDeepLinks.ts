import { isNativeApp } from "../native";
import { isMobileDevice } from "../device";
import { listBrowserWallets } from "./solanaWallet";

const PLAY_ORIGIN = "https://play.deadtiles.com";
/** Host the Android app claims. Browser wallet returns stay on PLAY_ORIGIN. */
const APP_ORIGIN = "https://app.deadtiles.com";

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

/** https page the wallet should send the user back to. Phone sign-in only works there. */
export function walletReturnUrl(): string {
  return browseTarget();
}

/** https link that opens the installed Android app. */
export function nativeWalletReturnUrl(): string {
  return APP_ORIGIN;
}

export function walletReturnIsHttps(): boolean {
  return typeof window !== "undefined" && window.location.protocol === "https:";
}
