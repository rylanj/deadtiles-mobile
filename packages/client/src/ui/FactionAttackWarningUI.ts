import { resetDialogScroll } from "./dialogScroll";
import { kvCard, markSheetOpen, sheetButton, useMobileSheet } from "./mobileSheet";
import "./mobile/alerts.css";

export type FactionAttackWarningHandlers = {
  /** `attack` is false for "Don't attack" and for any other way of closing. */
  onDecision: (attack: boolean) => void;
};

export type FactionAttackWarningInfo = {
  factionName: string;
  /** Short name used in the title, e.g. "an Ashen Trader". */
  targetLabel: string;
  standingLabel: string;
  closes: string;
};

/**
 * One-shot session warning before attacking a non-hostile faction member.
 */
export class FactionAttackWarningUI {
  private visible = false;
  private overlay: HTMLElement;
  private panel: HTMLElement;
  private messageEl: HTMLElement;
  private card?: HTMLElement;

  constructor(private handlers: FactionAttackWarningHandlers) {
    this.overlay = document.createElement("div");
    this.overlay.id = "faction-attack-warning-overlay";
    this.overlay.hidden = true;

    const panel = document.createElement("div");
    panel.className = "inventory-panel faction-attack-warning-panel";
    this.panel = panel;

    this.messageEl = document.createElement("p");
    this.messageEl.className = "faction-attack-warning-message";

    const actions = document.createElement("div");
    actions.className = "faction-attack-warning-actions";
    const keepBtn = document.createElement("button");
    keepBtn.type = "button";
    keepBtn.className = "faction-attack-warning-close";
    keepBtn.textContent = "Don't attack";
    keepBtn.addEventListener("click", () => this.decide(false));
    const attackBtn = document.createElement("button");
    attackBtn.type = "button";
    attackBtn.className = "faction-attack-warning-close faction-attack-warning-attack";
    attackBtn.textContent = "Attack anyway";
    attackBtn.addEventListener("click", () => this.decide(true));
    actions.append(keepBtn, attackBtn);

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

  show(info: FactionAttackWarningInfo) {
    const phone = useMobileSheet();
    this.messageEl.textContent =
      `If you attack ${info.factionName} they will turn hostile and your reputation will suffer.`;
    this.panel.hidden = phone;
    this.overlay.classList.toggle("ms-card-host", phone);
    this.card?.remove();
    this.card = undefined;
    if (phone) {
      const card = document.createElement("div");
      card.className = "ms-drawer ms-tone-red faw-card";
      card.setAttribute("role", "alertdialog");
      const title = document.createElement("h2");
      title.className = "faw-title";
      title.textContent = `Attack ${info.targetLabel}?`;
      const lead = document.createElement("p");
      lead.className = "faw-lead";
      lead.textContent = "They'll turn hostile and your standing will drop.";
      const facts = kvCard([
        { label: `${info.factionName} standing`, value: `${info.standingLabel} → Hostile`, tone: "bad" },
        { label: info.closes, value: "Closed", tone: "bad" },
        { label: "Their guards", value: "Turn on you", tone: "bad" },
      ]);
      const bar = document.createElement("div");
      bar.className = "ms-bar faw-bar";
      bar.append(
        sheetButton("Don't attack", "pri", () => this.decide(false)),
        sheetButton("Attack anyway", "danger", () => this.decide(true)),
      );
      card.append(title, lead, facts, bar);
      this.overlay.append(card);
      this.card = card;
    }
    this.visible = true;
    this.overlay.hidden = false;
    document.body.classList.add("faction-attack-warning-open");
    markSheetOpen("faction-attack-warning", phone);
    resetDialogScroll(this.overlay);
  }

  /** Any close without a choice counts as "Don't attack". */
  close() {
    this.decide(false);
  }

  private decide(attack: boolean) {
    if (!this.visible) return;
    this.visible = false;
    this.overlay.hidden = true;
    document.body.classList.remove("faction-attack-warning-open");
    markSheetOpen("faction-attack-warning", false);
    this.handlers.onDecision(attack);
  }

  destroy() {
    this.visible = false;
    this.overlay.hidden = true;
    document.body.classList.remove("faction-attack-warning-open");
    markSheetOpen("faction-attack-warning", false);
    this.overlay.remove();
  }
}
