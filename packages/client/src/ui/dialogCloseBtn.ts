/** Shared Close control for inventory / loot / trade overlays. */
export function createDialogCloseButton(onClose: () => void): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "dialog-close-btn";
  btn.setAttribute("aria-label", "Close");
  const touch = document.body.classList.contains("is-mobile");
  btn.textContent = touch ? "✕" : "Close";
  if (touch) btn.classList.add("dialog-close-btn--x");
  btn.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    onClose();
  });
  return btn;
}
