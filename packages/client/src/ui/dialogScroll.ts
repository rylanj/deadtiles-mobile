const OVERFLOW_CLASS = "dialog-overflows";

function firstContentChild(root: HTMLElement): HTMLElement | null {
  for (const node of root.children) {
    if (!(node instanceof HTMLElement) || node.hidden) continue;
    return node;
  }
  return null;
}

function resetNestedScroll(root: HTMLElement) {
  root.scrollTop = 0;
  root.scrollLeft = 0;
  for (const node of root.querySelectorAll("*")) {
    if (!(node instanceof HTMLElement)) continue;
    if (node.scrollTop || node.scrollLeft) {
      node.scrollTop = 0;
      node.scrollLeft = 0;
    }
  }
}

/**
 * Center a dialog when it fits. If it overflows (or centering clipped the
 * header), pin it to the top and scroll there.
 */
export function resetDialogScroll(root: HTMLElement) {
  const apply = () => {
    // Onboarding sits on the bottom edge. Do not re-pin it to the top.
    const canRecenter =
      root.id !== "onboarding-overlay" && root.id !== "onboarding-controls-legend";
    if (canRecenter) root.classList.remove(OVERFLOW_CLASS);
    resetNestedScroll(root);

    const child = firstContentChild(root);
    if (canRecenter && child) {
      const style = getComputedStyle(root);
      const padTop = parseFloat(style.paddingTop) || 0;
      const padBottom = parseFloat(style.paddingBottom) || 0;
      const available = root.clientHeight - padTop - padBottom;
      // Skip until layout exists. A 0-height measure would always pin to the top.
      if (available > 0 && child.offsetHeight > available + 1) {
        root.classList.add(OVERFLOW_CLASS);
      }
    }

    resetNestedScroll(root);
  };
  apply();
  requestAnimationFrame(apply);
}
