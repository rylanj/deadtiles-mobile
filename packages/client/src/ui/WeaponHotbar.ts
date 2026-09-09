import {
  getItemDefinition,
  getStoredMagazineRounds,
  WEAPON_SLOT_COUNT,
  parseInventory,
  parseWeaponMagazines,
  weaponIndexFromItemId,
  WEAPONS,
  isMeleeWeapon,
} from "@zombie/shared";
import { appendItemDurabilityBar, appendItemIcon } from "./itemIcons";

export type WeaponHotbarHandlers = {
  onSlot: (slotIndex: number) => void;
};

export type WeaponHotbarOptions = {
  /** Defaults to `weapon-hotbar`. Use another id for menu previews. */
  rootId?: string;
  /** Parent to append into (defaults to document.body). */
  mount?: ParentNode;
  /** When false, slots are display-only. Defaults to true. */
  interactive?: boolean;
};

function shortWeaponName(name: string): string {
  if (name.length <= 12) return name;
  return `${name.slice(0, 11)}…`;
}

export class WeaponHotbar {
  private root: HTMLElement;
  private slotsEl: HTMLElement;
  private interactive: boolean;
  private rendered = false;

  constructor(
    private handlers: WeaponHotbarHandlers,
    options: WeaponHotbarOptions = {},
  ) {
    this.interactive = options.interactive !== false;
    const rootId = options.rootId ?? "weapon-hotbar";

    // Scene/menu remounts can leave a stale node with the same id (empty chrome
    // stacked over the live hotbar). Always replace it.
    document.getElementById(rootId)?.remove();

    this.root = document.createElement("div");
    this.root.id = rootId;
    this.root.className = "weapon-hotbar";
    this.root.hidden = true;

    const panel = document.createElement("div");
    panel.className = "weapon-hotbar-panel";

    this.slotsEl = document.createElement("div");
    this.slotsEl.className = "weapon-hotbar-slots";
    panel.appendChild(this.slotsEl);
    this.root.appendChild(panel);
    (options.mount ?? document.body).appendChild(this.root);
  }

  render(
    inventoryJson: string,
    equippedInventorySlot: number,
    magazineRounds: number,
    weaponMagazinesJson: string,
    isReloading: boolean,
  ) {
    const inventory = parseInventory(inventoryJson);
    const magazines = parseWeaponMagazines(weaponMagazinesJson);
    this.slotsEl.replaceChildren();

    for (let i = 0; i < WEAPON_SLOT_COUNT; i++) {
      const slot = inventory[i] ?? null;
      const def = slot ? getItemDefinition(slot.id) : undefined;
      const weaponIndex = slot ? weaponIndexFromItemId(slot.id) : -1;
      const weapon = weaponIndex >= 0 ? WEAPONS[weaponIndex] : undefined;
      const isEquipped = weaponIndex >= 0 && equippedInventorySlot === i;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "weapon-hotbar-slot";
      if (!slot) btn.classList.add("weapon-hotbar-slot--empty");
      if (isEquipped) btn.classList.add("weapon-hotbar-slot--equipped");

      const keyEl = document.createElement("span");
      keyEl.className = "weapon-hotbar-key";
      keyEl.textContent = String(i + 1);

      const nameEl = document.createElement("span");
      nameEl.className = "weapon-hotbar-name";
      if (slot && def) {
        nameEl.textContent = shortWeaponName(def.name);
      } else {
        nameEl.textContent = "—";
      }

      btn.append(keyEl);

      if (slot && appendItemIcon(btn, slot.id, "weapon-hotbar-icon")) {
        btn.classList.add("weapon-hotbar-slot--has-icon");
        btn.setAttribute("aria-label", def?.name ?? slot.id);
      } else {
        btn.appendChild(nameEl);
      }

      if (weapon && !isMeleeWeapon(weapon)) {
        const rounds = isEquipped
          ? magazineRounds
          : (getStoredMagazineRounds(magazines, i) ?? 0);
        const ammoEl = document.createElement("span");
        ammoEl.className = "weapon-hotbar-ammo";
        ammoEl.textContent =
          isEquipped && isReloading
            ? "…"
            : `${rounds}/${weapon.magazineCapacity}`;
        btn.appendChild(ammoEl);
      }

      if (slot) appendItemDurabilityBar(btn, slot);

      btn.disabled = !this.interactive || !slot;
      if (this.interactive) {
        btn.addEventListener("click", () => this.handlers.onSlot(i));
      }
      this.slotsEl.appendChild(btn);
    }

    if (!this.rendered) {
      this.rendered = true;
      this.root.hidden = false;
    }
  }

  destroy() {
    this.root.remove();
  }
}
