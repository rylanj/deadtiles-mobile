import { type DoorCodeResult } from "@zombie/shared";
import { resetDialogScroll } from "./dialogScroll";
import { claimPageOverlay } from "./pageOverlay";
import "./mobile/door.css";
import { markSheetOpen, sheetButton, useMobileSheet } from "./mobileSheet";

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
  private panel: HTMLElement;
  private title: HTMLElement;
  private message: HTMLElement;
  private input: HTMLInputElement;
  private pad!: HTMLElement;
  private padTitle!: HTMLElement;
  private padHint!: HTMLElement;
  private padDots!: HTMLElement;
  private padMsg!: HTMLElement;
  private padGo!: HTMLButtonElement;
  private padLeave!: HTMLButtonElement;
  private digits = "";
  private keypad = false;
  private submitBtn: HTMLButtonElement;
  private skipBtn: HTMLButtonElement;

  constructor(private handlers: DoorCodeUIHandlers) {
    this.overlay = document.createElement("div");
    this.overlay.id = "door-code-overlay";
    this.overlay.hidden = true;

    const panel = document.createElement("div");
    panel.className = "inventory-panel door-code-panel";
    this.panel = panel;

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
    this.pad = this.buildPad();
    this.overlay.append(this.pad);
    this.overlay.addEventListener("mousedown", (e) => {
      if (e.target === this.overlay) this.close();
    });
    claimPageOverlay(this.overlay.id);
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

  /** Phone keypad waits for the server. Desktop still uses the text field. */
  usesKeypad() {
    return this.keypad;
  }

  noteResult(result: DoorCodeResult) {
    if (!this.visible || !this.keypad || this.mode !== "enter") return;
    if (result === "open") {
      this.close();
      return;
    }
    const text =
      result === "wrong"
        ? "Wrong code."
        : result === "wait"
          ? "Wait a moment."
          : result === "far"
            ? "Step closer to the door."
            : "That door is no longer locked.";
    if (result === "gone") {
      this.padMsg.textContent = text;
      window.setTimeout(() => this.close(), 700);
      return;
    }
    this.digits = "";
    this.paintPad();
    this.padMsg.textContent = text;
    this.padDots.classList.remove("door-pad-dots--shake");
    void this.padDots.offsetWidth;
    this.padDots.classList.add("door-pad-dots--shake");
  }

  close() {
    if (!this.visible) return;
    this.visible = false;
    this.overlay.hidden = true;
    this.overlay.classList.remove("ms-card-host");
    this.panel.hidden = false;
    this.pad.hidden = true;
    markSheetOpen("door", false);
    this.keypad = false;
    this.digits = "";
    this.input.blur();
  }

  private show() {
    this.keypad = useMobileSheet();
    this.digits = "";
    this.visible = true;
    this.overlay.hidden = false;
    this.input.value = "";
    this.panel.hidden = this.keypad;
    this.pad.hidden = !this.keypad;
    this.overlay.classList.toggle("ms-card-host", this.keypad);
    markSheetOpen("door", this.keypad);
    if (this.keypad) {
      this.padTitle.textContent = this.mode === "set" ? "Lock this door?" : "Locked door";
      this.padHint.textContent =
        this.mode === "set"
          ? "Set a code, or leave it unlocked."
          : "Enter the door code.";
      this.padLeave.hidden = this.mode !== "set";
      this.padMsg.textContent = "";
      this.paintPad();
    }
    resetDialogScroll(this.overlay);
    if (!this.keypad) setTimeout(() => this.input.focus({ preventScroll: true }), 0);
  }

  private submit() {
    const code = (this.keypad ? this.digits : this.input.value).trim();
    if (this.mode === "enter") {
      if (code.length < 4) return;
      this.handlers.onSubmitEnterCode(code);
      if (!this.keypad) this.close();
      return;
    }
    if (code.length === 0) {
      this.handlers.onSubmitSetCode(null);
    } else if (code.length < 4) {
      return;
    } else {
      this.handlers.onSubmitSetCode(code);
    }
    this.close();
  }

  private buildPad(): HTMLElement {
    const pad = document.createElement("div");
    pad.className = "ms-drawer door-pad";
    pad.hidden = true;
    pad.setAttribute("role", "dialog");
    const head = document.createElement("div");
    head.className = "door-pad-head";
    this.padTitle = document.createElement("h2");
    this.padTitle.className = "door-pad-title";
    const close = document.createElement("button");
    close.type = "button";
    close.className = "ms-x";
    close.textContent = "✕";
    close.setAttribute("aria-label", "Close");
    close.addEventListener("click", () => this.close());
    head.append(this.padTitle, close);
    this.padHint = document.createElement("p");
    this.padHint.className = "door-pad-hint";
    this.padDots = document.createElement("div");
    this.padDots.className = "door-pad-dots";
    this.padMsg = document.createElement("p");
    this.padMsg.className = "door-pad-msg";
    const keys = document.createElement("div");
    keys.className = "door-pad-keys";
    const addKey = (label: string, onTap: () => void, cls = "") => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = cls ? `door-pad-key ${cls}` : "door-pad-key";
      btn.textContent = label;
      btn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        onTap();
      });
      keys.append(btn);
      return btn;
    };
    for (let n = 1; n <= 9; n++) {
      const digit = String(n);
      addKey(digit, () => this.pushDigit(digit));
    }
    addKey("Clear", () => {
      this.digits = "";
      this.padMsg.textContent = "";
      this.paintPad();
    }, "door-pad-key--fn");
    addKey("0", () => this.pushDigit("0"));
    this.padGo = addKey("Unlock", () => this.submit(), "door-pad-key--go");
    this.padLeave = sheetButton("Leave it unlocked", "sec", () => {
      this.handlers.onSubmitSetCode(null);
      this.close();
    });
    this.padLeave.classList.add("door-pad-leave");
    pad.append(head, this.padHint, this.padDots, this.padMsg, keys, this.padLeave);
    return pad;
  }

  private pushDigit(digit: string) {
    if (this.digits.length >= 8) return;
    this.digits += digit;
    this.padMsg.textContent = "";
    this.paintPad();
  }

  private paintPad() {
    const count = Math.max(4, this.digits.length);
    this.padDots.replaceChildren();
    for (let i = 0; i < count; i++) {
      const dot = document.createElement("i");
      if (i < this.digits.length) dot.className = "f";
      this.padDots.append(dot);
    }
    this.padGo.textContent = this.mode === "set" ? "Save" : "Unlock";
    this.padGo.disabled = this.digits.length < 4;
  }

  destroy() {
    this.visible = false;
    this.overlay.hidden = true;
    this.input.blur();
    this.overlay.remove();
  }
}
