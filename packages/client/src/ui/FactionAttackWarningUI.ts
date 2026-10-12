import { resetDialogScroll } from "./dialogScroll";

export type FactionAttackWarningHandlers = {
  onClose: () => void;
};

/**
 * One-shot session warning before attacking a non-hostile faction member.
 */
export class FactionAttackWarningUI {
  private visible = false;
  private overlay: HTMLElement;
  private messageEl: HTMLElement;

  constructor(private handlers: FactionAttackWarningHandlers) {
    this.overlay = document.createElement("div");
    this.overlay.id = "faction-attack-warning-overlay";
    this.overlay.hidden = true;

    const panel = document.createElement("div");
    panel.className = "inventory-panel faction-attack-warning-panel";

    this.messageEl = document.createElement("p");
    this.messageEl.className = "faction-attack-warning-message";

    const actions = document.createElement("div");
    actions.className = "faction-attack-warning-actions";
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "faction-attack-warning-close";
    closeBtn.textContent = "Close";
    closeBtn.addEventListener("click", () => this.close());
    actions.appendChild(closeBtn);

    panel.append(this.messageEl, actions);
    this.overlay.appendChild(panel);
    this.overlay.addEventListener("click", (event) => {
      if (event.target === this.overlay) this.close();
    });
    document.body.appendChild(this.overlay);
  }

  isOpen() {
    return this.visible;
  }

  show(factionName: string) {
    this.messageEl.textContent =
      `If you attack ${factionName} they will turn hostile and your reputation will suffer`;
    this.visible = true;
    this.overlay.hidden = false;
    document.body.classList.add("faction-attack-warning-open");
    resetDialogScroll(this.overlay);
  }

  close() {
    if (!this.visible) return;
    this.visible = false;
    this.overlay.hidden = true;
    document.body.classList.remove("faction-attack-warning-open");
    this.handlers.onClose();
  }

  destroy() {
    this.visible = false;
    this.overlay.hidden = true;
    document.body.classList.remove("faction-attack-warning-open");
    this.overlay.remove();
  }
}
