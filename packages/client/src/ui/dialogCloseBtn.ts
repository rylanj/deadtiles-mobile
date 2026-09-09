/** Shared Close control for inventory / loot / trade overlays. */
export function createDialogCloseButton(onClose: () => void): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "dialog-close-btn";
  btn.setAttribute("aria-label", "Close");
  btn.textContent = "Close";
  btn.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    onClose();
  });
  return btn;
}
