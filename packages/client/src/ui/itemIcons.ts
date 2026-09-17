import {
  getEntryDurability,
  getEntryWetness,
  getMaxDurability,
  type InventoryEntry,
} from "@zombie/shared";

const ITEM_ICON_PATHS: Record<string, string> = {
  weapon_pistol: "/assets/UI/UI_Pistol.png",
  weapon_shotgun: "/assets/UI/UI_Shotgun.png",
  weapon_hunting_rifle: "/assets/UI/UI_HuntingRifle.png",
  weapon_revolver: "/assets/UI/UI_Revolver.png",
  weapon_assault_rifle: "/assets/UI/UI_AK.png",
  weapon_m4a1: "/assets/UI/UI_M4A1.png",
  weapon_hammer: "/assets/UI/UI_Hammer.png",
  weapon_hatchet: "/assets/UI/UI_Hatchet.png",
  weapon_bat: "/assets/UI/UI_Bat.png",
  white_tshirt: "/assets/UI/UI_white_tshirt.png",
  black_tshirt: "/assets/UI/UI_black_tshirt.png",
  ammo_9x19: "/assets/UI/UI_9x19.png",
  ammo_buckshot: "/assets/UI/UI_buckshot.png",
  ammo_762x39: "/assets/UI/UI_762x39.png",
  ammo_556x45: "/assets/UI/UI_556x45.png",
  ammo_44: "/assets/UI/UI_44.png",
  bandages: "/assets/UI/UI_bandage.png",
  rags: "/assets/UI/UI_rags.png",
  alcohol: "/assets/UI/UI_alcohol.png",
  antibiotics: "/assets/UI/UI_antibiotics.png",
  multivitamins: "/assets/UI/UI_multivitamins.png",
  screws: "/assets/UI/UI_screws.png",
  bolts: "/assets/UI/UI_bolts.png",
  duct_tape: "/assets/UI/UI_duct_tape.png",
  scrap_metal: "/assets/UI/UI_scrap_metal.png",
  wood: "/assets/UI/UI_wood.png",
  banknote: "/assets/UI/UI_banknote.png",
  dogtag: "/assets/UI/UI_dogtag.png",
  lighter: "/assets/UI/UI_lighter.png",
  blue_cigarettes: "/assets/UI/UI_blue_cigarettes.png",
  gold_chain: "/assets/UI/UI_gold_chain.png",
  gold_earrings: "/assets/UI/UI_gold_earrings.png",
  gold_ring: "/assets/UI/UI_gold_ring.png",
  silver_chain: "/assets/UI/UI_silver_chain.png",
  silver_ring: "/assets/UI/UI_silver_ring.png",
  old_teddy: "/assets/UI/UI_old_teddy.png",
  teddy: "/assets/UI/UI_teddy.png",
  map: "/assets/UI/UI_map.png",
  watch: "/assets/UI/UI_watch.png",
  handheld_radio: "/assets/UI/UI_handheld_radio.png",
  backpack: "/assets/UI/UI_backpack.png",
  chat: "/assets/UI/UI_chat.png",
  build: "/assets/UI/UI_build.png",
  crosshair: "/assets/UI/UI_crosshair.png",
  rep: "/assets/UI/UI_rep.png",
  canned_beans: "/assets/UI/UI_canned_beans.png",
  canned_tuna: "/assets/UI/UI_canned_tuna.png",
  canned_peaches: "/assets/UI/UI_canned_peaches.png",
  hot_chips: "/assets/UI/UI_hot_chips.png",
  onion_chips: "/assets/UI/UI_onion_chips.png",
  salted_chips: "/assets/UI/UI_salted_chips.png",
  lemonada: "/assets/UI/UI_lemonade.png",
  cola: "/assets/UI/UI_cola.png",
  water: "/assets/UI/UI_water.png",
};

export function getItemIconPath(itemId: string): string | undefined {
  return ITEM_ICON_PATHS[itemId];
}

export function appendItemIcon(
  parent: HTMLElement,
  itemId: string,
  className: string,
): boolean {
  const path = getItemIconPath(itemId);
  if (!path) return false;

  const img = document.createElement("img");
  img.className = className;
  img.src = path;
  img.alt = "";
  img.draggable = false;
  parent.appendChild(img);
  return true;
}

/** Thin green fill bar along the bottom of an inventory cell. */
export function appendItemDurabilityBar(
  parent: HTMLElement,
  entry: InventoryEntry,
): boolean {
  const max = getMaxDurability(entry.id);
  if (max == null || max <= 0) return false;
  const remaining = getEntryDurability(entry);
  const pct = Math.max(0, Math.min(100, (remaining / max) * 100));

  const track = document.createElement("div");
  track.className = "inventory-cell-durability";
  track.setAttribute("aria-hidden", "true");

  const fill = document.createElement("div");
  fill.className = "inventory-cell-durability-fill";
  fill.style.width = `${pct}%`;
  track.appendChild(fill);
  parent.appendChild(track);
  return true;
}

/** Thin blue soak bar along the bottom of an inventory cell. Hidden when dry. */
export function appendItemWetnessBar(
  parent: HTMLElement,
  entry: InventoryEntry,
): boolean {
  const wet = getEntryWetness(entry);
  if (wet <= 0.005) return false;
  const pct = Math.max(0, Math.min(100, wet * 100));

  const track = document.createElement("div");
  track.className = "inventory-cell-wetness";
  track.setAttribute("aria-hidden", "true");

  const fill = document.createElement("div");
  fill.className = "inventory-cell-wetness-fill";
  fill.style.width = `${pct}%`;
  track.appendChild(fill);
  parent.appendChild(track);
  return true;
}
