import { lastWalletId, type WalletOption } from "../network/walletOptions";
import { resetDialogScroll } from "./dialogScroll";

/**
 * In-menu wallet chooser. Resolves the selected wallet, or null if cancelled.
 */
export function pickWallet(
  host: HTMLElement,
  options: WalletOption[],
): Promise<WalletOption | null> {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "wallet-picker";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-label", "Choose wallet");

    const panel = document.createElement("div");
    panel.className = "wallet-picker-panel";

    const title = document.createElement("h2");
    title.className = "wallet-picker-title";
    title.textContent = "Choose wallet";

    const hint = document.createElement("p");
    hint.className = "wallet-picker-hint";
    hint.textContent = "Pick which Solana wallet to use for login.";

    const list = document.createElement("div");
    list.className = "wallet-picker-list";

    const last = lastWalletId();
    let settled = false;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        finish(null);
      }
    };
    const finish = (value: WalletOption | null) => {
      if (settled) return;
      settled = true;
      document.removeEventListener("keydown", onKey);
      overlay.remove();
      resolve(value);
    };

    for (const option of options) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "wallet-picker-option";
      if (option.id === last) btn.classList.add("wallet-picker-option--last");

      if (option.icon) {
        const img = document.createElement("img");
        img.className = "wallet-picker-icon";
        img.src = option.icon;
        img.alt = "";
        btn.appendChild(img);
      } else {
        const mark = document.createElement("span");
        mark.className = "wallet-picker-mark";
        mark.textContent = option.name.slice(0, 1);
        btn.appendChild(mark);
      }

      const text = document.createElement("span");
      text.className = "wallet-picker-name";
      text.textContent = option.name;
      btn.appendChild(text);

      if (option.id === last) {
        const badge = document.createElement("span");
        badge.className = "wallet-picker-last";
        badge.textContent = "Last used";
        btn.appendChild(badge);
      }

      btn.addEventListener("click", () => finish(option));
      list.appendChild(btn);
    }

    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "wallet-picker-cancel";
    cancel.textContent = "Cancel";
    cancel.addEventListener("click", () => finish(null));

    panel.append(title, hint, list, cancel);
    overlay.appendChild(panel);

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) finish(null);
    });
    document.addEventListener("keydown", onKey);

    host.appendChild(overlay);
    const first = list.querySelector("button");
    if (first instanceof HTMLButtonElement) {
      first.focus({ preventScroll: true });
    }
    resetDialogScroll(overlay);
  });
}
