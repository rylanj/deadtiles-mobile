import { resetDialogScroll } from "./dialogScroll";

export type DoorCodeUIMode = "enter" | "set";

export type DoorCodeUIHandlers = {
  /** Submit a candidate code to unlock a locked door. */
  onSubmitEnterCode: (code: string) => void;
  /** Set (string) or clear (null) the door's code lock. */
  onSubmitSetCode: (code: string | null) => void;
};

/**
 * Small numeric-entry modal for door codes. Reused for two flows:
 * "enter" (unlock a locked door) and "set" (owner arms/clears a lock,
 * offered right after placing a fresh door).
 */
export class DoorCodeUI {
  private visible = false;
  private mode: DoorCodeUIMode = "enter";
  private overlay: HTMLElement;
  private title: HTMLElement;
  private message: HTMLElement;
  private input: HTMLInputElement;
  private submitBtn: HTMLButtonElement;
  private skipBtn: HTMLButtonElement;

  constructor(private handlers: DoorCodeUIHandlers) {
    this.overlay = document.createElement("div");
    this.overlay.id = "door-code-overlay";
    this.overlay.hidden = true;

    const panel = document.createElement("div");
    panel.className = "inventory-panel door-code-panel";

    this.title = document.createElement("h2");
    this.title.className = "inventory-title door-code-title";

    this.message = document.createElement("p");
    this.message.className = "door-code-message";

    this.input = document.createElement("input");
    this.input.type = "text";
    this.input.inputMode = "numeric";
    this.input.autocomplete = "off";
    this.input.maxLength = 8;
    this.input.className = "door-code-input";
    this.input.placeholder = "4-8 digits";
    this.input.addEventListener("input", () => {
      this.input.value = this.input.value.replace(/[^0-9]/g, "").slice(0, 8);
    });
    this.input.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter") {
        e.preventDefault();
        this.submit();
      } else if (e.key === "Escape") {
        e.preventDefault();
        this.close();
      }
    });

    const actions = document.createElement("div");
    actions.className = "door-code-actions";

    this.submitBtn = document.createElement("button");
    this.submitBtn.type = "button";
    this.submitBtn.className = "door-code-submit";
    this.submitBtn.addEventListener("click", () => this.submit());

    this.skipBtn = document.createElement("button");
    this.skipBtn.type = "button";
    this.skipBtn.className = "door-code-skip";
    this.skipBtn.textContent = "No lock";
    this.skipBtn.addEventListener("click", () => {
      this.handlers.onSubmitSetCode(null);
      this.close();
    });

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "door-code-cancel";
    cancelBtn.textContent = "Cancel";
    cancelBtn.addEventListener("click", () => this.close());

    actions.append(this.submitBtn, this.skipBtn, cancelBtn);
    panel.append(this.title, this.message, this.input, actions);
    this.overlay.appendChild(panel);
    this.overlay.addEventListener("mousedown", (e) => {
      if (e.target === this.overlay) this.close();
    });
    document.body.appendChild(this.overlay);
  }

  isOpen() {
    return this.visible;
  }

  /** Prompt to unlock a locked door with a code. */
  openEnter() {
    this.mode = "enter";
    this.title.textContent = "Locked door";
    this.message.textContent = "Enter the door code.";
    this.submitBtn.textContent = "Unlock";
    this.skipBtn.hidden = true;
    this.show();
  }

  /** Offer to arm (or skip) a code lock — shown right after placing a door. */
  openSet() {
    this.mode = "set";
    this.title.textContent = "Lock this door?";
    this.message.textContent = "Set a code, or leave it open to anyone.";
    this.submitBtn.textContent = "Save code";
    this.skipBtn.hidden = false;
    this.show();
  }

  close() {
    if (!this.visible) return;
    this.visible = false;
    this.overlay.hidden = true;
    this.input.blur();
  }

  private show() {
    this.visible = true;
    this.overlay.hidden = false;
    this.input.value = "";
    resetDialogScroll(this.overlay);
    setTimeout(() => this.input.focus({ preventScroll: true }), 0);
  }

  private submit() {
    const code = this.input.value.trim();
    if (this.mode === "enter") {
      if (code.length < 4) return;
      this.handlers.onSubmitEnterCode(code);
    } else if (code.length === 0) {
      this.handlers.onSubmitSetCode(null);
    } else if (code.length < 4) {
      return;
    } else {
      this.handlers.onSubmitSetCode(code);
    }
    this.close();
  }

  destroy() {
    this.overlay.remove();
  }
}
