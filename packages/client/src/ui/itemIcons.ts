import {
  getEntryDurability,
  getEntryWetness,
  getMaxDurability,
  isQuestKeepsakeItem,
  type InventoryEntry,
} from "@zombie/shared";

const ITEM_ICON_PATHS: Record<string, string> = {
  weapon_pistol: "/assets/UI/UI_Pistol.png",
  blueprint_pistol: "/assets/UI/UI_blueprint_pistol.png",
  blueprint_revolver: "/assets/UI/UI_blueprint_revolver.png",
  blueprint_shotgun: "/assets/UI/UI_blueprint_shotgun.png",
  blueprint_hunting_rifle: "/assets/UI/UI_blueprint_hunting_rifle.png",
  blueprint_ak: "/assets/UI/UI_blueprint_AK.png",
  blueprint_m4: "/assets/UI/UI_blueprint_M4.png",
  pistol_frame: "/assets/UI/UI_PistolFrame.png",
  pistol_slide: "/assets/UI/UI_PistolSlide.png",
  small_spring: "/assets/UI/UI_SmallSpring.png",
  pistol_trigger: "/assets/UI/UI_PistolTrigger.png",
  revolver_frame: "/assets/UI/UI_RevolverFrame.png",
  revolver_cylinder: "/assets/UI/UI_RevolverCylinder.png",
  revolver_barrel: "/assets/UI/UI_RevolverBarrel.png",
  revolver_trigger: "/assets/UI/UI_RevolverTrigger.png",
  shotgun_receiver: "/assets/UI/UI_ShotgunReceiver.png",
  shotgun_barrel: "/assets/UI/UI_ShotgunBarrel.png",
  shotgun_stock: "/assets/UI/UI_ShotgunStock.png",
  shotgun_trigger: "/assets/UI/UI_ShotgunTrigger.png",
  large_spring: "/assets/UI/UI_LargeSpring.png",
  rifle_receiver: "/assets/UI/UI_RifleReceiver.png",
  rifle_barrel: "/assets/UI/UI_RifleBarrel.png",
  rifle_stock: "/assets/UI/UI_RifleStock.png",
  scope: "/assets/UI/UI_Scope.png",
  rifle_trigger: "/assets/UI/UI_RifleTrigger.png",
  ak_receiver: "/assets/UI/UI_AKReceiver.png",
  ak_barrel: "/assets/UI/UI_AKBarrel.png",
  ak_stock: "/assets/UI/UI_AKStock.png",
  m4_receiver: "/assets/UI/UI_M4Receiver.png",
  m4_barrel: "/assets/UI/UI_M4Barrel.png",
  m4_stock: "/assets/UI/UI_M4Stock.png",
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
  safe: "/assets/UI/UI_safe.png",
  dogtag: "/assets/UI/UI_dogtag.png",
  lighter: "/assets/UI/UI_lighter.png",
  blue_cigarettes: "/assets/UI/UI_blue_cigarettes.png",
  gold_chain: "/assets/UI/UI_gold_chain.png",
  gold_earrings: "/assets/UI/UI_gold_earrings.png",
  clarks_earrings: "/assets/UI/UI_gold_earrings.png",
  caravan_manifest: "/assets/UI/UI_journal.png",
  wagon_note: "/assets/UI/UI_journal.png",
  supply_list: "/assets/UI/UI_journal.png",
  gold_ring: "/assets/UI/UI_gold_ring.png",
  silver_chain: "/assets/UI/UI_silver_chain.png",
  silver_ring: "/assets/UI/UI_silver_ring.png",
  old_teddy: "/assets/UI/UI_old_teddy.png",
  teddy: "/assets/UI/UI_teddy.png",
  map: "/assets/UI/UI_map.png",
  watch: "/assets/UI/UI_watch.png",
  handheld_radio: "/assets/UI/UI_handheld_radio.png",
  backpack_fanny: "/assets/UI/UI_fanny_pack.png",
  backpack_utility: "/assets/UI/UI_utility_pouch.png",
  backpack_small: "/assets/UI/UI_small_backpack.png",
  backpack_black: "/assets/UI/UI_small_backpack.png",
  backpack_hunting: "/assets/UI/UI_hunting_backpack.png",
  backpack_leather: "/assets/UI/UI_leather_backpack.png",
  backpack_hiking: "/assets/UI/UI_hiking_backpack.png",
  backpack: "/assets/UI/UI_backpack.png",
  chat: "/assets/UI/UI_chat.png",
  journal: "/assets/UI/UI_journal.png",
  build: "/assets/UI/UI_build.png",
  crosshair: "/assets/UI/UI_crosshair.png",
  rep: "/assets/UI/UI_rep.png",
  canned_beans: "/assets/UI/UI_canned_beans.png",
  canned_tuna: "/assets/UI/UI_canned_tuna.png",
  canned_peaches: "/assets/UI/UI_canned_peaches.png",
  hot_chips: "/assets/UI/UI_hot_chips.png",
  onion_chips: "/assets/UI/UI_onion_chips.png",
  salted_chips: "/assets/UI/UI_salted_chips.png",
  raw_coyote_meat: "/assets/UI/UI_raw_coyote_meat.png",
  cooked_coyote_meat: "/assets/UI/UI_cooked_coyote_meat.png",
  burnt_coyote_meat: "/assets/UI/UI_burnt_coyote_meat.png",
  raw_bear_meat: "/assets/UI/UI_raw_bear_meat.png",
  cooked_bear_meat: "/assets/UI/UI_cooked_bear_meat.png",
  burnt_bear_meat: "/assets/UI/UI_burnt_bear_meat.png",
  raw_bird_meat: "/assets/UI/UI_raw_bird_meat.png",
  cooked_bird_meat: "/assets/UI/UI_cooked_bird_meat.png",
  burnt_bird_meat: "/assets/UI/UI_burnt_bird_meat.png",
  raw_chicken_meat: "/assets/UI/UI_raw_chicken_meat.png",
  cooked_chicken_meat: "/assets/UI/UI_cooked_chicken_meat.png",
  burnt_chicken_meat: "/assets/UI/UI_burnt_chicken_meat.png",
  raw_rabbit_meat: "/assets/UI/UI_raw_rabbit_meat.png",
  cooked_rabbit_meat: "/assets/UI/UI_cooked_rabbit_meat.png",
  burnt_rabbit_meat: "/assets/UI/UI_burnt_rabbit_meat.png",
  lemonada: "/assets/UI/UI_lemonade.png",
  cola: "/assets/UI/UI_cola.png",
  water: "/assets/UI/UI_water.png",
  magazine_melee: "/assets/UI/UI_magazine_melee.png",
  magazine_harvesting: "/assets/UI/UI_magazine_harvesting.png",
  magazine_carrying: "/assets/UI/UI_magazine_carrying.png",
  magazine_construction: "/assets/UI/UI_magazine_construction.png",
  magazine_fitness: "/assets/UI/UI_magazine_fitness.png",
  magazine_immunity: "/assets/UI/UI_magazine_immunity.png",
  magazine_recovery: "/assets/UI/UI_magazine_recovery.png",
  magazine_accuracy: "/assets/UI/UI_magazine_accuracy.png",
  magazine_crafting: "/assets/UI/UI_magazine_crafting.png",
  magazine_scavenging: "/assets/UI/UI_magazine_scavenging.png",
  magazine_stealth: "/assets/UI/UI_magazine_stealth.png",
  magazine_cooking: "/assets/UI/UI_magazine_cooking.png",
  magazine_medicine: "/assets/UI/UI_magazine_medicine.png",
  magazine_reading: "/assets/UI/UI_magazine_reading.png",
  magazine_persuasion: "/assets/UI/UI_magazine_persuasion.png",
  magazine_bartering: "/assets/UI/UI_magazine_bartering.png",
  magazine_lockpicking: "/assets/UI/UI_magazine_lockpicking.png",
  lockpick: "/assets/UI/UI_lockpick.png",
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

/** Gold outline for Clark's anniversary earrings in inventory menus. */
export function markQuestKeepsake(cell: HTMLElement, itemId: string | undefined) {
  if (isQuestKeepsakeItem(itemId)) cell.classList.add("inventory-cell--keepsake");
}

/** Speech option. Icon marks a prompt that opens trade, the player board, jobs, or treatment. */
export function fillSpeechButton(
  button: HTMLButtonElement,
  label: string,
  iconItemId?: string,
): void {
  button.replaceChildren();
  if (iconItemId) appendItemIcon(button, iconItemId, "red-dialog-speech-icon");
  const text = document.createElement("span");
  text.className = "red-dialog-speech-label";
  text.textContent = label;
  button.append(text);
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
