import { isNativeApp } from "./native";

/** True for phones/tablets (touch-first devices), including iPadOS desktop UA. */
export function isMobileDevice(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }

  const ua = navigator.userAgent || "";
  if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
    return true;
  }

  // iPadOS 13+ reports as Macintosh with touch
  if (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) {
    return true;
  }

  // Coarse pointer + compact viewport (foldables / desktop touch mode)
  try {
    if (
      window.matchMedia("(pointer: coarse)").matches &&
      Math.min(window.innerWidth, window.innerHeight) <= 900
    ) {
      return true;
    }
  } catch {
    // matchMedia unavailable
  }

  return false;
}

/**
 * Apply `is-mobile` / `is-native` on <body> and keep `--browser-bottom-inset`
 * in sync. Mobile Safari/Chrome toolbars are not part of safe-area-inset-bottom.
 */
export function applyMobileBodyClass(): void {
  if (typeof document === "undefined") return;
  const mobile = isMobileDevice();
  const native = isNativeApp();
  document.body.classList.toggle("is-mobile", mobile);
  document.body.classList.toggle("is-native", native);
  syncBrowserBottomInset();
  if (mobile && !native) bindBrowserBottomInset();
}

let browserBottomBound = false;

function bindBrowserBottomInset(): void {
  if (browserBottomBound || typeof window === "undefined") return;
  browserBottomBound = true;
  const sync = () => syncBrowserBottomInset();
  window.addEventListener("resize", sync);
  window.visualViewport?.addEventListener("resize", sync);
  window.visualViewport?.addEventListener("scroll", sync);
}

function syncBrowserBottomInset(): void {
  if (typeof document === "undefined" || typeof window === "undefined") return;
  const native = document.body.classList.contains("is-native");
  const mobile = document.body.classList.contains("is-mobile");
  if (!mobile || native) {
    document.documentElement.style.setProperty("--browser-bottom-inset", "0px");
    return;
  }
  const vv = window.visualViewport;
  let occluded = 0;
  if (vv) {
    occluded = Math.max(0, window.innerHeight - (vv.offsetTop + vv.height));
  }
  // Safari often reports 0 while the toolbar still covers `position: fixed`.
  const inset = Math.max(Math.round(occluded), 56);
  document.documentElement.style.setProperty(
    "--browser-bottom-inset",
    `${inset}px`,
  );
}
