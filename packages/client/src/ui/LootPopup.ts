import { appendItemIcon } from "./itemIcons";
import { useMobileSheet } from "./mobileSheet";

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
  /**
   * Minimum time before the card fades.
   * Longer text stays past this. When omitted, short lines stay 2.4s.
   */
  durationMs?: number;
};

/** Short loot lines. Longer quest notes scale up from here. */
const LOOT_POPUP_MIN_MS = 2400;
/** Cap so a long note does not sit on screen forever. */
const LOOT_POPUP_MAX_MS = 11000;
/** Time to notice the card before reading starts. */
const LOOT_POPUP_NOTICE_MS = 900;
/** About one second of read time per 17 characters, after a short beat to notice the card. */
const LOOT_POPUP_MS_PER_CHAR = 60;
/** A short line is already covered by an explicit floor, such as a radio ping. */
const LOOT_POPUP_FLOOR_CHARS = 36;

function lootPopupDurationMs(text: string, floorMs?: number): number {
  const chars = text.replace(/\s+/g, " ").trim().length;
  const scaled = LOOT_POPUP_NOTICE_MS + chars * LOOT_POPUP_MS_PER_CHAR;
  const natural = Math.max(
    LOOT_POPUP_MIN_MS,
    Math.min(LOOT_POPUP_MAX_MS, scaled),
  );
  if (floorMs == null || !(floorMs > 0)) return natural;
  const extended =
    floorMs + Math.max(0, chars - LOOT_POPUP_FLOOR_CHARS) * LOOT_POPUP_MS_PER_CHAR;
  return Math.min(LOOT_POPUP_MAX_MS, Math.max(natural, extended));
}

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
          item.id === "rep"
            ? `${item.quantity > 0 ? "+" : ""}${item.quantity}`
            : `×${item.quantity}`;
        row.appendChild(qty);
      }
      card.appendChild(row);
    }

    this.container.appendChild(card);

    // Trigger entrance animation on next frame
    requestAnimationFrame(() => card.classList.add("loot-card--visible"));

    const FADE_MS = 400;
    let hidden = false;
    const hide = () => {
      if (hidden) return;
      hidden = true;
      card.classList.add("loot-card--hiding");
      setTimeout(() => card.remove(), FADE_MS);
    };
    card.addEventListener("click", (event) => {
      event.stopPropagation();
      hide();
    });
    (card as HTMLElement & { dismissLoot?: () => void }).dismissLoot = hide;

    // Phones keep two cards so the stack never climbs over the HUD.
    if (useMobileSheet()) {
      const live = [...this.container.children].filter(
        (el) => !el.classList.contains("loot-card--hiding"),
      ) as (HTMLElement & { dismissLoot?: () => void })[];
      for (const old of live.slice(0, Math.max(0, live.length - 2))) old.dismissLoot?.();
    }

    const SHOW_MS = lootPopupDurationMs(card.textContent ?? "", opts?.durationMs);
    setTimeout(hide, SHOW_MS);
  }

  destroy() {
    this.container.remove();
  }
}
