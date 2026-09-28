import { appendItemIcon } from "./itemIcons";

export type LootItem = {
  name: string;
  quantity: number;
  /** When set, shows the matching UI_* inventory icon. */
  id?: string;
  /** Icon and name only, no ×quantity. */
  hideQuantity?: boolean;
};

export type LootPopupOptions = {
  /** Override header (default: "You found:" / "Nothing found"). Empty skips the header. */
  header?: string;
  /** When set, header is name on the left and this glyph on the right. */
  arrow?: string;
  /** How long the card stays before fading. Default 2.4s. */
  durationMs?: number;
};

/**
 * Displays a brief loot overlay (search results, task rewards, etc.).
 * Each call to show() stacks a new card that slides in and then fades out.
 */
export class LootPopup {
  private container: HTMLElement;

  constructor() {
    this.container = document.createElement("div");
    this.container.id = "loot-popup-container";
    document.body.appendChild(this.container);
  }

  show(items: LootItem[], opts?: LootPopupOptions) {
    const card = document.createElement("div");
    card.className = "loot-card";

    if (opts?.header !== "") {
      const header = document.createElement("div");
      header.className = "loot-card-header";
      const title =
        opts?.header ?? (items.length > 0 ? "You found:" : "Nothing useful found");
      if (opts?.arrow) {
        header.classList.add("loot-card-header--split");
        const name = document.createElement("span");
        name.className = "loot-card-header-name";
        name.textContent = title;
        const arrow = document.createElement("span");
        arrow.className = "loot-card-arrow";
        arrow.textContent = opts.arrow;
        header.append(name, arrow);
      } else {
        header.textContent = title;
      }
      card.appendChild(header);
    }

    for (const item of items) {
      const row = document.createElement("div");
      row.className = "loot-card-row";

      const left = document.createElement("div");
      left.className = "loot-item-main";

      if (item.id) {
        const iconWrap = document.createElement("span");
        iconWrap.className = "loot-item-icon-wrap";
        if (appendItemIcon(iconWrap, item.id, "loot-item-icon")) {
          left.appendChild(iconWrap);
        }
      }

      const name = document.createElement("span");
      name.className = "loot-item-name";
      name.textContent = item.name;
      left.appendChild(name);

      row.appendChild(left);
      if (!item.hideQuantity) {
        const qty = document.createElement("span");
        qty.className = "loot-item-qty";
        // Reputation rewards use the rep icon and a +N label.
        qty.textContent =
          item.id === "rep" ? `+${item.quantity}` : `×${item.quantity}`;
        row.appendChild(qty);
      }
      card.appendChild(row);
    }

    this.container.appendChild(card);

    // Trigger entrance animation on next frame
    requestAnimationFrame(() => card.classList.add("loot-card--visible"));

    // Begin exit: fade out after 2.4 s, then remove element
    const SHOW_MS = opts?.durationMs ?? 2400;
    const FADE_MS = 400;
    setTimeout(() => {
      card.classList.add("loot-card--hiding");
      setTimeout(() => card.remove(), FADE_MS);
    }, SHOW_MS);
  }

  destroy() {
    this.container.remove();
  }
}
