import { resetDialogScroll } from "./dialogScroll";

export type DeathScreenHandlers = {
  onRespawn: () => void;
};

/**
 * Full-screen death prompt — must press Respawn (no dismiss).
 */
export class DeathScreenUI {
  private visible = false;
  private overlay: HTMLElement;
  private respawnBtn: HTMLButtonElement;

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
    message.textContent =
      "Your gear was left behind. Respawn to continue your journey.";

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

    panel.append(title, message, actions);
    this.overlay.appendChild(panel);
    document.body.appendChild(this.overlay);
  }

  isOpen() {
    return this.visible;
  }

  show() {
    if (this.visible) return;
    this.visible = true;
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
