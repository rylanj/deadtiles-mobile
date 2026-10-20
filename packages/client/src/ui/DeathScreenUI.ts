import { resetDialogScroll } from "./dialogScroll";
import { kvCard, useMobileSheet } from "./mobileSheet";
import "./mobile/alerts.css";

export type DeathScreenHandlers = {
  onRespawn: () => void;
};

/**
 * Full-screen death prompt. Must press Respawn (no dismiss).
 */
export class DeathScreenUI {
  private visible = false;
  private overlay: HTMLElement;
  private factsEl: HTMLElement;
  private respawnBtn: HTMLButtonElement;
  private itemCount = 0;

  constructor(private handlers: DeathScreenHandlers) {
    this.overlay = document.createElement("div");
    this.overlay.id = "death-screen-overlay";
    this.overlay.hidden = true;

    const panel = document.createElement("div");
    panel.className = "inventory-panel death-screen-panel";

    const title = document.createElement("h2");
    title.className = "inventory-title death-screen-title";
    title.textContent = "You died";

    const message = document.createElement("p");
    message.className = "death-screen-message";
    message.textContent = "Everything you carried stays on your body where you fell.";

    this.factsEl = document.createElement("div");
    this.factsEl.className = "death-screen-facts";

    const actions = document.createElement("div");
    actions.className = "death-screen-actions";
    this.respawnBtn = document.createElement("button");
    this.respawnBtn.type = "button";
    this.respawnBtn.className = "death-screen-respawn";
    this.respawnBtn.textContent = "Respawn";
    this.respawnBtn.addEventListener("click", () => {
      if (!this.visible) return;
      this.handlers.onRespawn();
    });
    actions.appendChild(this.respawnBtn);

    panel.append(title, message, this.factsEl, actions);
    this.overlay.appendChild(panel);
    document.body.appendChild(this.overlay);
  }

  isOpen() {
    return this.visible;
  }

  /** Facts shown on the next `show()`. */
  setDetails(details: { itemCount: number }) {
    this.itemCount = details.itemCount;
  }

  show() {
    if (this.visible) return;
    this.visible = true;
    this.overlay.classList.toggle("death-phone", useMobileSheet());
    const items =
      this.itemCount > 0
        ? `${this.itemCount} ${this.itemCount === 1 ? "item" : "items"} · 1 hour`
        : "1 hour";
    this.factsEl.replaceChildren(
      kvCard([
        { label: "Left on your body", value: items },
        { label: "Your body", value: "Pinned on your map" },
        { label: "You keep", value: "Skills and standing", tone: "ok" },
      ]),
    );
    this.overlay.hidden = false;
    document.body.classList.add("death-screen-open");
    resetDialogScroll(this.overlay);
  }

  close() {
    if (!this.visible) return;
    this.visible = false;
    this.overlay.hidden = true;
    document.body.classList.remove("death-screen-open");
  }

  destroy() {
    this.visible = false;
    this.overlay.hidden = true;
    document.body.classList.remove("death-screen-open");
    this.overlay.remove();
  }
}
