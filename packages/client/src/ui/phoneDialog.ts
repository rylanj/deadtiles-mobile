/** Phone talk and trade sheets. Desktop and iPad keep the two-column layouts. */
export function usePhoneDialogSheet(): boolean {
  if (typeof document === "undefined" || typeof window === "undefined") return false;
  if (!document.body.classList.contains("is-mobile")) return false;
  return window.innerWidth < 720 || window.innerHeight < 520;
}

/**
 * Re-render an open dialog when rotation crosses the phone-sheet breakpoint.
 * Keyboard resizing uses visualViewport and is ignored so the layout does not flip mid-type.
 */
export function bindPhoneDialogResize(
  isOpen: () => boolean,
  isShowingPhone: () => boolean,
  onChange: () => void,
  overlay: HTMLElement,
): () => void {
  if (typeof window === "undefined") return () => {};
  const onResize = () => {
    if (!overlay.isConnected) {
      window.removeEventListener("resize", onResize);
      return;
    }
    if (!isOpen()) return;
    if (usePhoneDialogSheet() !== isShowingPhone()) onChange();
  };
  window.addEventListener("resize", onResize);
  return () => window.removeEventListener("resize", onResize);
}
