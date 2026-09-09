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

/** Apply `is-mobile` on <body> for CSS (inventory button, compact HUD, etc.). */
export function applyMobileBodyClass(): void {
  if (typeof document === "undefined") return;
  document.body.classList.toggle("is-mobile", isMobileDevice());
}
