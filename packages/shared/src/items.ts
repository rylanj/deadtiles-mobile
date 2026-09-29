import { RAW_MEAT_INFECTION_CHANCE } from "./infection.js";
import { mulberry32, xmur3 } from "./worldgen.js";
import { ZOMBIE_SKIN_MAN11 } from "./sprites.js";

/** Fixed slot count — each occupied slot holds one stack. */
export const WEAPON_SLOT_COUNT = 2;
export const POCKET_SLOT_COUNT = 12;
/** Dedicated worn-clothing cell (UI shows it between weapons and pockets). */
export const CLOTHING_SLOT_COUNT = 1;
/** Index of the clothing equipment slot (after pockets so legacy 14-slot saves pad cleanly). */
export const CLOTHING_SLOT_INDEX = WEAPON_SLOT_COUNT + POCKET_SLOT_COUNT;
export const WATCH_SLOT_COUNT = 1;
export const RADIO_SLOT_COUNT = 1;
export const MAP_SLOT_COUNT = 1;
/** Watch cell sits beside clothing on the equipment row. */
export const WATCH_SLOT_INDEX = CLOTHING_SLOT_INDEX + 1;
/** Radio cell sits beside clothing on the equipment row. */
export const RADIO_SLOT_INDEX = CLOTHING_SLOT_INDEX + 2;
/** Map cell sits after radio on the equipment row. */
export const MAP_SLOT_INDEX = CLOTHING_SLOT_INDEX + 3;
export const WATCH_ITEM_ID = "watch";
export const RADIO_ITEM_ID = "handheld_radio";
/** Lowest channel a player can dial. 1 and 2 are listen-only world nets. */
export const RADIO_FREQ_MIN = 1;
export const RADIO_FREQ_MAX = 3000;
export const RADIO_FREQ_BIRCHPORT_GLOBAL = 1;
export const RADIO_FREQ_BIRCHPORT_TRADE = 2;
export const MAP_ITEM_ID = "map";
export const BASE_INVENTORY_SLOTS =
  WEAPON_SLOT_COUNT +
  POCKET_SLOT_COUNT +
  CLOTHING_SLOT_COUNT +
  WATCH_SLOT_COUNT +
  RADIO_SLOT_COUNT +
  MAP_SLOT_COUNT;
/** Extra carrying pockets append after equipment so clothing/watch indices stay stable. */
export const MAX_EXTRA_POCKET_SLOTS = 4;
export const MAX_INVENTORY_SLOTS = BASE_INVENTORY_SLOTS + MAX_EXTRA_POCKET_SLOTS;
/** @deprecated Use WEAPON_SLOT_COUNT — kept for transitional imports. */
export const HOTBAR_SLOT_COUNT = WEAPON_SLOT_COUNT;
/** Fixed slot grid for looted container contents (fits a full player inventory). */
export const CONTAINER_INVENTORY_SLOTS = BASE_INVENTORY_SLOTS;
/** Default max stack for most non-weapon items. */
export const MAX_ITEM_STACK = 10;
/** Max stack for ammunition and screws. */
export const MAX_BULK_ITEM_STACK = 100;
/** Max stack for banknotes. */
export const MAX_BANKNOTE_STACK = 10_000;

/** Instance rarity for weapons / notable loot (missing → common). */
export type ItemRarity = "common" | "uncommon" | "rare" | "epic";

export const ITEM_RARITIES: readonly ItemRarity[] = [
  "common",
  "uncommon",
  "rare",
  "epic",
] as const;

/** Loot bundle or stack contents. */
export type InventoryEntry = {
  id: string;
  quantity: number;
  /**
   * Loaded magazine rounds for a ranged weapon while it sits in a container /
   * ground bag. Player inventory uses `weaponMagazinesJson` instead; this field
   * is cleared when a gun is taken into a player slot.
   */
  magazineRounds?: number;
  /** Weapon / item rarity. Missing on load → treated as common. */
  rarity?: ItemRarity;
  /** Durability 0–100 (gun wear / quality). Missing on load → treated as 100. */
  condition?: number;
  /**
   * Remaining use-count durability for items with `maxDurability`
   * (melee swings, lighter sparks). Missing → full max.
   */
  durability?: number;
  /**
   * Clothing soak 0–1. Missing or 0 = dry (no inventory bar).
   * Only clothing stores this; wearing it is what affects temperature.
   */
  wetness?: number;
  /**
   * Tuned channel stored on this radio. Survives drop and loot.
   * 1 = Birchport global (listen only), 2 = Birchport trade (listen only),
   * 3-3000 = player nets. Missing = untuned.
   */
  radioFreq?: number;
};

export function isItemRarity(value: unknown): value is ItemRarity {
  return (
    value === "common" ||
    value === "uncommon" ||
    value === "rare" ||
    value === "epic"
  );
}

/** Normalize optional rarity/condition (migration: missing → common / 100). */
export function normalizeItemMeta(entry: {
  rarity?: unknown;
  condition?: unknown;
}): { rarity: ItemRarity; condition: number } {
  const rarity = isItemRarity(entry.rarity) ? entry.rarity : "common";
  let condition = 100;
  if (typeof entry.condition === "number" && Number.isFinite(entry.condition)) {
    condition = Math.max(0, Math.min(100, Math.floor(entry.condition)));
  }
  return { rarity, condition };
}

/** Copy entry fields, applying rarity/condition defaults when omitted. */
export function withNormalizedItemMeta(entry: InventoryEntry): InventoryEntry {
  const { rarity, condition } = normalizeItemMeta(entry);
  const next: InventoryEntry = {
    id: entry.id,
    quantity: entry.quantity,
    rarity,
    condition,
  };
  if (entry.magazineRounds != null) next.magazineRounds = entry.magazineRounds;
  if (entry.durability != null) next.durability = entry.durability;
  if (
    typeof entry.wetness === "number" &&
    Number.isFinite(entry.wetness) &&
    entry.wetness > 0
  ) {
    next.wetness = Math.max(0, Math.min(1, entry.wetness));
  }
  const freq = normalizeRadioFreq(entry.radioFreq);
  if (freq != null) next.radioFreq = freq;
  return next;
}
/** One inventory cell — null when empty. */
export type InventorySlot = InventoryEntry | null;
/** Fixed-length slot grid stored in `inventoryJson`. */
export type Inventory = InventorySlot[];

export type ItemDefinition = {
  id: string;
  name: string;
  category: string;
  stackable: boolean;
  weight: number;
  /**
   * When true, item is too large for pocket slots and must use a weapon slot.
   * Pistol/revolver and all non-weapons fit in pockets.
   */
  hotbarOnly?: boolean;
  /**
   * Absolute use-count durability (melee swings, lighter sparks, etc.).
   * Missing = item does not wear from use.
   */
  maxDurability?: number;
  /** For food/drink/medical: time in ms to use. */
  consumeDurationMs?: number;
  /** Hunger points restored (0–100). */
  restoreHunger?: number;
  /** Thirst points restored (0–100). */
  restoreThirst?: number;
  /** Health points restored (0–100). */
  restoreHealth?: number;
  /** Heal-over-time: HP granted each interval while the buff lasts. */
  healOverTimeHp?: number;
  /** Heal-over-time: ms between HP ticks. */
  healOverTimeIntervalMs?: number;
  /** Heal-over-time: total buff duration in ms. */
  healOverTimeDurationMs?: number;
  /** True when using this item treats an active infection. */
  treatsInfection?: boolean;
  /** Chance (0–1) to catch the zombie infection when this item is eaten. */
  infectionChance?: number;
  /** Clothing insulation points (bare = 0, t-shirt = 1). */
  insulation?: number;
};

export const INVENTORY_ITEMS: ItemDefinition[] = [
  { id: "weapon_pistol", name: "Glock 17 Pistol", category: "weapons", stackable: false, weight: 1.0 },
  {
    id: "weapon_shotgun",
    name: "Mossberg 500 Shotgun",
    category: "weapons",
    stackable: false,
    weight: 2.5,
    hotbarOnly: true,
  },
  {
    id: "weapon_hunting_rifle",
    name: "CZ 527 Rifle",
    category: "weapons",
    stackable: false,
    weight: 2.0,
    hotbarOnly: true,
  },
  { id: "weapon_revolver", name: "Colt Anaconda", category: "weapons", stackable: false, weight: 1.0 },
  {
    id: "weapon_assault_rifle",
    name: "AK-47 Rifle",
    category: "weapons",
    stackable: false,
    weight: 2.5,
    hotbarOnly: true,
  },
  {
    id: "weapon_m4a1",
    name: "M4A1 Rifle",
    category: "weapons",
    stackable: false,
    weight: 2.4,
    hotbarOnly: true,
  },
  { id: "weapon_hammer", name: "Hammer", category: "weapons", stackable: false, weight: 1.2, maxDurability: 1000 },
  { id: "weapon_hatchet", name: "Hatchet", category: "weapons", stackable: false, weight: 1.2, maxDurability: 1000 },
  {
    id: "weapon_bat",
    name: "Baseball Bat",
    category: "weapons",
    stackable: false,
    weight: 1.0,
    hotbarOnly: true,
    maxDurability: 1000,
  },
  {
    id: "white_tshirt",
    name: "White T-Shirt",
    category: "clothing",
    stackable: false,
    weight: 0.2,
    insulation: 1,
  },
  {
    id: "black_tshirt",
    name: "Black T-Shirt",
    category: "clothing",
    stackable: false,
    weight: 0.2,
    insulation: 1,
  },
  {
    id: WATCH_ITEM_ID,
    name: "Watch",
    category: "equipment",
    stackable: false,
    weight: 0.1,
  },
  {
    id: RADIO_ITEM_ID,
    name: "Handheld Radio",
    category: "equipment",
    stackable: false,
    weight: 0.4,
  },
  { id: "ammo_9x19", name: "9x19mm Rounds", category: "ammunition", stackable: true, weight: 0.01 },
  { id: "ammo_buckshot", name: "Buckshot Shells", category: "ammunition", stackable: true, weight: 0.01 },
  { id: "ammo_762x39", name: "7.62x39mm Rounds", category: "ammunition", stackable: true, weight: 0.01 },
  { id: "ammo_556x45", name: "5.56x45mm Rounds", category: "ammunition", stackable: true, weight: 0.01 },
  { id: "ammo_44", name: ".44 Magnum Rounds", category: "ammunition", stackable: true, weight: 0.01 },
  {
    id: "bandages",
    name: "Bandage",
    category: "medical",
    stackable: true,
    weight: 0.1,
    consumeDurationMs: 10_000,
    restoreHealth: 20,
  },
  {
    id: "rags",
    name: "Rags",
    category: "medical",
    stackable: true,
    weight: 0.05,
    consumeDurationMs: 5_000,
    restoreHealth: 5,
  },
  {
    id: "alcohol",
    name: "Isopropyl Alcohol",
    category: "medical",
    stackable: true,
    weight: 0.25,
    consumeDurationMs: 5_000,
    restoreHealth: 25,
  },
  {
    id: "antibiotics",
    name: "Antibiotics",
    category: "medical",
    stackable: true,
    weight: 0.1,
    consumeDurationMs: 4_000,
    treatsInfection: true,
  },
  {
    id: "multivitamins",
    name: "Multivitamins",
    category: "medical",
    stackable: true,
    weight: 0.05,
    consumeDurationMs: 2_000,
    restoreHunger: 5,
    restoreThirst: 5,
    /** +1 HP every 10s for 300s (30 HP total). */
    healOverTimeHp: 1,
    healOverTimeIntervalMs: 10_000,
    healOverTimeDurationMs: 300_000,
  },
  { id: "screws", name: "Screws", category: "crafting", stackable: true, weight: 0.01 },
  { id: "bolts", name: "Bolts", category: "crafting", stackable: true, weight: 0.01 },
  { id: "duct_tape", name: "Duct Tape", category: "crafting", stackable: true, weight: 0.2 },
  { id: "scrap_metal", name: "Scrap Metal", category: "crafting", stackable: true, weight: 0.5 },
  { id: "pistol_frame", name: "Pistol Frame", category: "crafting", stackable: true, weight: 0.35 },
  { id: "pistol_slide", name: "Pistol Slide", category: "crafting", stackable: true, weight: 0.25 },
  { id: "small_spring", name: "Small Spring", category: "crafting", stackable: true, weight: 0.05 },
  { id: "pistol_trigger", name: "Pistol Trigger", category: "crafting", stackable: true, weight: 0.08 },
  { id: "revolver_frame", name: "Revolver Frame", category: "crafting", stackable: true, weight: 0.4 },
  { id: "revolver_cylinder", name: "Cylinder", category: "crafting", stackable: true, weight: 0.25 },
  { id: "revolver_barrel", name: "Revolver Barrel", category: "crafting", stackable: true, weight: 0.3 },
  { id: "revolver_trigger", name: "Revolver Trigger", category: "crafting", stackable: true, weight: 0.08 },
  { id: "shotgun_receiver", name: "Shotgun Receiver", category: "crafting", stackable: true, weight: 0.7 },
  { id: "shotgun_barrel", name: "Shotgun Barrel", category: "crafting", stackable: true, weight: 0.6 },
  { id: "shotgun_stock", name: "Shotgun Stock", category: "crafting", stackable: true, weight: 0.7 },
  { id: "shotgun_trigger", name: "Shotgun Trigger", category: "crafting", stackable: true, weight: 0.08 },
  { id: "large_spring", name: "Large Spring", category: "crafting", stackable: true, weight: 0.08 },
  { id: "rifle_receiver", name: "Rifle Receiver", category: "crafting", stackable: true, weight: 0.7 },
  { id: "rifle_barrel", name: "Rifle Barrel", category: "crafting", stackable: true, weight: 0.6 },
  { id: "rifle_stock", name: "Rifle Stock", category: "crafting", stackable: true, weight: 0.8 },
  { id: "scope", name: "Scope", category: "crafting", stackable: true, weight: 0.4 },
  { id: "rifle_trigger", name: "Rifle Trigger", category: "crafting", stackable: true, weight: 0.08 },
  { id: "ak_receiver", name: "AK Receiver", category: "crafting", stackable: true, weight: 0.8 },
  { id: "ak_barrel", name: "AK Barrel", category: "crafting", stackable: true, weight: 0.6 },
  { id: "ak_stock", name: "AK Stock", category: "crafting", stackable: true, weight: 0.6 },
  { id: "m4_receiver", name: "M4 Receiver", category: "crafting", stackable: true, weight: 0.7 },
  { id: "m4_barrel", name: "M4 Barrel", category: "crafting", stackable: true, weight: 0.5 },
  { id: "m4_stock", name: "M4 Stock", category: "crafting", stackable: true, weight: 0.45 },
  /** Fuel for Fireplace1 — looted from felled trees. */
  { id: "wood", name: "Wood", category: "crafting", stackable: false, weight: 0.5 },
  { id: "banknote", name: "Banknote", category: "junk", stackable: true, weight: 0.01 },
  { id: "dogtag", name: "Dog Tag", category: "junk", stackable: true, weight: 0.02 },
  { id: "lighter", name: "Lighter", category: "junk", stackable: false, weight: 0.05, maxDurability: 20 },
  { id: "blue_cigarettes", name: "Cigarettes (Blue)", category: "junk", stackable: true, weight: 0.05 },
  { id: "gold_chain", name: "Gold Chain", category: "junk", stackable: true, weight: 0.1 },
  { id: "gold_earrings", name: "Gold Earrings", category: "junk", stackable: true, weight: 0.05 },
  { id: "gold_ring", name: "Gold Ring", category: "junk", stackable: true, weight: 0.05 },
  { id: "silver_chain", name: "Silver Chain", category: "junk", stackable: true, weight: 0.1 },
  { id: "silver_ring", name: "Silver Ring", category: "junk", stackable: true, weight: 0.05 },
  { id: "old_teddy", name: "Old Teddy", category: "junk", stackable: true, weight: 0.2 },
  { id: "teddy", name: "Teddy", category: "junk", stackable: true, weight: 0.2 },
  { id: "map", name: "Map", category: "junk", stackable: true, weight: 0.1 },
  {
    id: "canned_beans",
    name: "Canned Pork & Beans",
    category: "food",
    stackable: true,
    weight: 0.4,
    consumeDurationMs: 4000,
    restoreHunger: 40,
  },
  {
    id: "canned_tuna",
    name: "Canned Tuna",
    category: "food",
    stackable: true,
    weight: 0.4,
    consumeDurationMs: 4000,
    restoreHunger: 30,
    restoreThirst: 3,
  },
  {
    id: "canned_peaches",
    name: "Canned Peaches",
    category: "food",
    stackable: true,
    weight: 0.4,
    consumeDurationMs: 3500,
    restoreHunger: 20,
    restoreThirst: 5,
  },
  {
    id: "hot_chips",
    name: "Chips (Hot)",
    category: "food",
    stackable: true,
    weight: 0.15,
    consumeDurationMs: 2500,
    restoreHunger: 10,
    restoreThirst: -3,
  },
  {
    id: "onion_chips",
    name: "Chips (Onion)",
    category: "food",
    stackable: true,
    weight: 0.15,
    consumeDurationMs: 2500,
    restoreHunger: 10,
  },
  {
    id: "salted_chips",
    name: "Chips (Salted)",
    category: "food",
    stackable: true,
    weight: 0.15,
    consumeDurationMs: 2500,
    restoreHunger: 10,
    restoreThirst: -5,
  },
  {
    id: "raw_coyote_meat",
    name: "Raw Coyote Meat",
    category: "food",
    stackable: true,
    weight: 0.2,
    consumeDurationMs: 2500,
    restoreHunger: 10,
    infectionChance: RAW_MEAT_INFECTION_CHANCE,
  },
  {
    id: "cooked_coyote_meat",
    name: "Cooked Coyote Meat",
    category: "food",
    stackable: true,
    weight: 0.2,
    consumeDurationMs: 2500,
    restoreHunger: 30,
    restoreThirst: 5,
  },
  {
    id: "burnt_coyote_meat",
    name: "Burnt Coyote Meat",
    category: "food",
    stackable: true,
    weight: 0.2,
    consumeDurationMs: 2500,
    restoreHunger: 5,
    restoreThirst: -20,
  },
  {
    id: "raw_rabbit_meat",
    name: "Raw Rabbit Meat",
    category: "food",
    stackable: true,
    weight: 0.15,
    consumeDurationMs: 2500,
    restoreHunger: 8,
    infectionChance: RAW_MEAT_INFECTION_CHANCE,
  },
  {
    id: "cooked_rabbit_meat",
    name: "Cooked Rabbit Meat",
    category: "food",
    stackable: true,
    weight: 0.15,
    consumeDurationMs: 2500,
    restoreHunger: 24,
    restoreThirst: 5,
  },
  {
    id: "burnt_rabbit_meat",
    name: "Burnt Rabbit Meat",
    category: "food",
    stackable: true,
    weight: 0.15,
    consumeDurationMs: 2500,
    restoreHunger: 4,
    restoreThirst: -20,
  },
  {
    id: "raw_bird_meat",
    name: "Raw Bird Meat",
    category: "food",
    stackable: true,
    weight: 0.1,
    consumeDurationMs: 2500,
    restoreHunger: 6,
    infectionChance: RAW_MEAT_INFECTION_CHANCE,
  },
  {
    id: "cooked_bird_meat",
    name: "Cooked Bird Meat",
    category: "food",
    stackable: true,
    weight: 0.1,
    consumeDurationMs: 2500,
    restoreHunger: 18,
    restoreThirst: 5,
  },
  {
    id: "burnt_bird_meat",
    name: "Burnt Bird Meat",
    category: "food",
    stackable: true,
    weight: 0.1,
    consumeDurationMs: 2500,
    restoreHunger: 3,
    restoreThirst: -20,
  },
  {
    id: "raw_chicken_meat",
    name: "Raw Chicken Meat",
    category: "food",
    stackable: true,
    weight: 0.2,
    consumeDurationMs: 2500,
    restoreHunger: 10,
    infectionChance: RAW_MEAT_INFECTION_CHANCE,
  },
  {
    id: "cooked_chicken_meat",
    name: "Cooked Chicken Meat",
    category: "food",
    stackable: true,
    weight: 0.2,
    consumeDurationMs: 2500,
    restoreHunger: 30,
    restoreThirst: 5,
  },
  {
    id: "burnt_chicken_meat",
    name: "Burnt Chicken Meat",
    category: "food",
    stackable: true,
    weight: 0.2,
    consumeDurationMs: 2500,
    restoreHunger: 5,
    restoreThirst: -20,
  },
  {
    id: "raw_bear_meat",
    name: "Raw Bear Meat",
    category: "food",
    stackable: true,
    weight: 0.35,
    consumeDurationMs: 2500,
    restoreHunger: 16,
    infectionChance: RAW_MEAT_INFECTION_CHANCE,
  },
  {
    id: "cooked_bear_meat",
    name: "Cooked Bear Meat",
    category: "food",
    stackable: true,
    weight: 0.35,
    consumeDurationMs: 2500,
    restoreHunger: 40,
    restoreThirst: 5,
  },
  {
    id: "burnt_bear_meat",
    name: "Burnt Bear Meat",
    category: "food",
    stackable: true,
    weight: 0.35,
    consumeDurationMs: 2500,
    restoreHunger: 6,
    restoreThirst: -20,
  },
  {
    id: "lemonada",
    name: "Lemonade",
    category: "drink",
    stackable: true,
    weight: 0.33,
    consumeDurationMs: 2500,
    restoreThirst: 25,
  },
  {
    id: "cola",
    name: "Cola",
    category: "drink",
    stackable: true,
    weight: 0.33,
    consumeDurationMs: 2500,
    restoreThirst: 25,
  },
  {
    id: "water",
    name: "Bottle of Water",
    category: "drink",
    stackable: true,
    weight: 0.5,
    consumeDurationMs: 2000,
    restoreThirst: 50,
  },
];

const ITEM_BY_ID = new Map(INVENTORY_ITEMS.map((item) => [item.id, item]));

function canonicalItemId(id: string): string {
  if (id === "UI_watch") return WATCH_ITEM_ID;
  if (id === "UI_handheld_radio") return RADIO_ITEM_ID;
  return id;
}

export function getItemDefinition(id: string) {
  return ITEM_BY_ID.get(canonicalItemId(id));
}

export function isConsumable(itemId: string): boolean {
  const def = ITEM_BY_ID.get(itemId);
  return !!def?.consumeDurationMs;
}

/** Synced on the player while a consume channel is active. */
export type ConsumeAction = "eat" | "drink" | "bandage" | "use";

export const CONSUME_ACTION_LABELS: Record<ConsumeAction, string> = {
  eat: "Eating",
  drink: "Drinking",
  bandage: "Bandaging",
  use: "Using",
};

/** Caption kind shown above the player while consuming this item. */
export function getConsumeAction(itemId: string): ConsumeAction {
  if (itemId === "bandages" || itemId === "rags") return "bandage";
  if (itemId === "alcohol") return "use";
  if (itemId === "antibiotics") return "use";
  if (itemId === "multivitamins") return "eat";
  const def = ITEM_BY_ID.get(itemId);
  if (def?.category === "drink") return "drink";
  if (def?.category === "medical") return "use";
  return "eat";
}

/** True when using this item would restore at least one need that isn't already full. */
export function canUseConsumable(
  itemId: string,
  stats: {
    health: number;
    hunger: number;
    thirst: number;
    maxHealth: number;
    maxHunger: number;
    maxThirst: number;
    infected?: boolean;
  },
): boolean {
  const def = ITEM_BY_ID.get(itemId);
  if (!def?.consumeDurationMs) return false;

  if (def.treatsInfection) return true;

  if ((def.restoreHealth ?? 0) > 0 && stats.health < stats.maxHealth) return true;
  if (
    (def.healOverTimeHp ?? 0) > 0 &&
    (def.healOverTimeDurationMs ?? 0) > 0 &&
    stats.health < stats.maxHealth
  ) {
    return true;
  }
  if ((def.restoreHunger ?? 0) > 0 && stats.hunger < stats.maxHunger) return true;
  if ((def.restoreThirst ?? 0) > 0 && stats.thirst < stats.maxThirst) return true;

  // Item restores nothing useful, or every restored need is already full.
  return false;
}

export function maxStackForItem(itemId: string): number {
  const def = getItemDefinition(itemId);
  if (!def) return 0;
  if (def.category === "weapons") return 1;
  if (def.category === "clothing") return 1;
  if (def.category === "equipment") return 1;
  if (itemId === "wood") return 1;
  // Use-count durable items are always unique instances.
  if ((def.maxDurability ?? 0) > 0) return 1;
  if (itemId === "banknote") return MAX_BANKNOTE_STACK;
  if (def.category === "ammunition" || itemId === "screws" || itemId === "bolts") {
    return MAX_BULK_ITEM_STACK;
  }
  return MAX_ITEM_STACK;
}

/** Absolute max use-count durability, or null if the item does not wear. */
export function getMaxDurability(itemId: string): number | null {
  const max = getItemDefinition(itemId)?.maxDurability;
  if (max == null || !Number.isFinite(max) || max <= 0) return null;
  return Math.floor(max);
}

/** Remaining use-count durability (defaults to max when unset). */
export function getEntryDurability(entry: InventoryEntry): number {
  const max = getMaxDurability(entry.id);
  if (max == null) return Number.POSITIVE_INFINITY;
  if (typeof entry.durability === "number" && Number.isFinite(entry.durability)) {
    return Math.max(0, Math.min(max, Math.floor(entry.durability)));
  }
  return max;
}

export function findFirstItemSlot(
  inventory: Inventory,
  itemId: string,
): number {
  for (let i = 0; i < inventory.length; i++) {
    const slot = inventory[i];
    if (slot?.id === itemId && slot.quantity > 0) return i;
  }
  return -1;
}

/**
 * Reduce use-count durability on a slot. At 0 the item is removed.
 * No-op when the item has no maxDurability.
 */
export function applyDurabilityLoss(
  inventory: Inventory,
  slotIndex: number,
  amount = 1,
): { inventory: Inventory; broke: boolean; remaining: number } {
  if (slotIndex < 0 || slotIndex >= inventory.length || amount <= 0) {
    return { inventory, broke: false, remaining: 0 };
  }
  const slot = inventory[slotIndex];
  if (!slot) return { inventory, broke: false, remaining: 0 };
  const max = getMaxDurability(slot.id);
  if (max == null) {
    return { inventory, broke: false, remaining: getEntryDurability(slot) };
  }

  const next = inventory.map((s) => (s ? { ...s } : null));
  const entry = next[slotIndex]!;
  const remaining = Math.max(0, getEntryDurability(entry) - Math.floor(amount));
  if (remaining <= 0) {
    next[slotIndex] = null;
    return { inventory: next, broke: true, remaining: 0 };
  }
  entry.durability = remaining;
  entry.quantity = 1;
  return { inventory: next, broke: false, remaining };
}

/** Large long guns that cannot fit in pocket slots. */
export function isHotbarOnlyItem(itemId: string): boolean {
  return !!getItemDefinition(itemId)?.hotbarOnly;
}

export function isWeaponItem(itemId: string): boolean {
  return getItemDefinition(itemId)?.category === "weapons";
}

export function isClothingItem(itemId: string): boolean {
  return getItemDefinition(itemId)?.category === "clothing";
}

/** Insulation points for a clothing item (0 if unknown / not clothing). */
export function clothingInsulation(itemId: string): number {
  const value = getItemDefinition(itemId)?.insulation;
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, value);
}

/** Clothing soak 0–1. Non-clothing is always dry. */
export function getEntryWetness(entry: InventoryEntry | null | undefined): number {
  if (!entry || !isClothingItem(entry.id)) return 0;
  if (typeof entry.wetness !== "number" || !Number.isFinite(entry.wetness)) {
    return 0;
  }
  return Math.max(0, Math.min(1, entry.wetness));
}

/** Write soak onto a clothing entry. Clears the field when dry. */
export function setEntryWetness(entry: InventoryEntry, wetness: number): void {
  if (!isClothingItem(entry.id)) {
    delete entry.wetness;
    return;
  }
  const next = Math.max(0, Math.min(1, Number.isFinite(wetness) ? wetness : 0));
  if (next <= 0.0005) delete entry.wetness;
  else entry.wetness = Math.round(next * 10000) / 10000;
}

export type InventoryEntryMeta = Pick<
  InventoryEntry,
  "rarity" | "condition" | "durability" | "wetness" | "radioFreq"
>;

export function inventoryEntryMeta(entry: InventoryEntry): InventoryEntryMeta {
  const meta: InventoryEntryMeta = {
    rarity: entry.rarity,
    condition: entry.condition,
  };
  if (entry.durability != null) meta.durability = entry.durability;
  const wet = getEntryWetness(entry);
  if (wet > 0) meta.wetness = wet;
  const freq = getEntryRadioFreq(entry);
  if (freq > 0) meta.radioFreq = freq;
  return meta;
}

/** Stored channel on a radio, or 0 when missing / not a radio. */
export function normalizeRadioFreq(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  const n = Math.floor(value);
  if (n < 1 || n > RADIO_FREQ_MAX) return undefined;
  return n;
}

export function getEntryRadioFreq(entry: InventoryEntry | null | undefined): number {
  if (!entry || !isRadioItem(entry.id)) return 0;
  return normalizeRadioFreq(entry.radioFreq) ?? 0;
}

/** Channel a player may dial, including listen-only nets 1 and 2. */
export function isPlayerRadioFreq(value: number): boolean {
  return (
    Number.isInteger(value) &&
    value >= RADIO_FREQ_MIN &&
    value <= RADIO_FREQ_MAX
  );
}

/** Birchport global and trade. Players can tune here, but cannot transmit. */
export function isListenOnlyRadioFreq(value: number): boolean {
  return (
    value === RADIO_FREQ_BIRCHPORT_GLOBAL || value === RADIO_FREQ_BIRCHPORT_TRADE
  );
}

export function isWatchItem(itemId: string): boolean {
  return canonicalItemId(itemId) === WATCH_ITEM_ID;
}

export function isRadioItem(itemId: string): boolean {
  return canonicalItemId(itemId) === RADIO_ITEM_ID;
}

export function isMapItem(itemId: string): boolean {
  return canonicalItemId(itemId) === MAP_ITEM_ID;
}

/** Channel duration for Wear / Remove clothing. */
export const CLOTHING_CHANGE_DURATION_MS = 5_000;

/** Synced on the player while a clothing Wear/Remove channel is active. */
export type ClothingChangeAction = "wear" | "remove";

export const CLOTHING_CHANGE_ACTION_LABELS: Record<ClothingChangeAction, string> = {
  wear: "Wearing",
  remove: "Removing",
};

/** PlayerMan skin for a clothing item id (1 = bare / unequipped). */
export function clothingSkinFromItemId(itemId: string | null | undefined): number {
  switch (itemId) {
    case "white_tshirt":
      return 2;
    case "black_tshirt":
      return 3;
    default:
      return 1;
  }
}

export function isWeaponSlot(slotIndex: number): boolean {
  return slotIndex >= 0 && slotIndex < WEAPON_SLOT_COUNT;
}

export function isClothingSlot(slotIndex: number): boolean {
  return slotIndex === CLOTHING_SLOT_INDEX;
}

export function isWatchSlot(slotIndex: number): boolean {
  return slotIndex === WATCH_SLOT_INDEX;
}

export function isRadioSlot(slotIndex: number): boolean {
  return slotIndex === RADIO_SLOT_INDEX;
}

export function isMapSlot(slotIndex: number): boolean {
  return slotIndex === MAP_SLOT_INDEX;
}

export function isPocketSlot(slotIndex: number): boolean {
  return (
    (slotIndex >= WEAPON_SLOT_COUNT && slotIndex < CLOTHING_SLOT_INDEX) ||
    (slotIndex >= BASE_INVENTORY_SLOTS && slotIndex < MAX_INVENTORY_SLOTS)
  );
}

export function itemFitsInSlot(itemId: string, slotIndex: number): boolean {
  if (slotIndex < 0 || slotIndex >= MAX_INVENTORY_SLOTS) return false;
  if (slotIndex >= BASE_INVENTORY_SLOTS) {
    if (isHotbarOnlyItem(itemId)) return false;
    return true;
  }
  if (isWeaponSlot(slotIndex)) return isWeaponItem(itemId);
  if (isClothingSlot(slotIndex)) return isClothingItem(itemId);
  if (isWatchSlot(slotIndex)) return isWatchItem(itemId);
  if (isRadioSlot(slotIndex)) return isRadioItem(itemId);
  if (isMapSlot(slotIndex)) return isMapItem(itemId);
  if (isHotbarOnlyItem(itemId) && isPocketSlot(slotIndex)) return false;
  return true;
}

export function createEmptyInventory(slotCount = BASE_INVENTORY_SLOTS): Inventory {
  const n = Math.max(
    BASE_INVENTORY_SLOTS,
    Math.min(MAX_INVENTORY_SLOTS, Math.floor(slotCount) || BASE_INVENTORY_SLOTS),
  );
  return Array.from({ length: n }, () => null);
}

export function inventoryUsedSlots(inventory: Inventory): number {
  return inventory.filter((slot) => slot !== null).length;
}

export function countItemInInventory(inventory: Inventory, itemId: string): number {
  let total = 0;
  for (const slot of inventory) {
    if (slot?.id === itemId) total += slot.quantity;
  }
  return total;
}

/** `slots` walks the grid in order. `pockets-first` empties pockets before worn gear. */
export type InventoryRemovalOrder = "slots" | "pockets-first";

function inventoryRemovalIndices(
  length: number,
  order: InventoryRemovalOrder,
  deferSlots: readonly number[],
): number[] {
  const indices: number[] = [];
  for (let i = 0; i < length; i++) indices.push(i);
  let ordered = indices;
  if (order === "pockets-first") {
    const pockets: number[] = [];
    const rest: number[] = [];
    for (const i of indices) {
      if (isPocketSlot(i)) pockets.push(i);
      else rest.push(i);
    }
    ordered = pockets.concat(rest);
  }
  if (deferSlots.length === 0) return ordered;
  const deferred = new Set(deferSlots);
  const early: number[] = [];
  const late: number[] = [];
  for (const i of ordered) {
    if (deferred.has(i)) late.push(i);
    else early.push(i);
  }
  return early.concat(late);
}

/** Remove up to `quantity` of `itemId` across slots (no-op if stock is short). */
export function removeItemFromInventory(
  inventory: Inventory,
  itemId: string,
  quantity: number,
  order: InventoryRemovalOrder = "slots",
  deferSlots: readonly number[] = [],
): Inventory {
  if (quantity <= 0) return inventory;
  if (countItemInInventory(inventory, itemId) < quantity) return inventory;

  const next = inventory.map((slot) => (slot ? { ...slot } : null));
  let remaining = quantity;

  for (const i of inventoryRemovalIndices(next.length, order, deferSlots)) {
    if (remaining <= 0) break;
    const slot = next[i];
    if (!slot || slot.id !== itemId) continue;
    const take = Math.min(slot.quantity, remaining);
    slot.quantity -= take;
    remaining -= take;
    if (slot.quantity <= 0) next[i] = null;
  }

  return next;
}

function remainingAddCapacity(inventory: Inventory, itemId: string): number {
  const maxStack = maxStackForItem(itemId);
  if (maxStack <= 0) return 0;

  let capacity = 0;
  for (let i = 0; i < inventory.length; i++) {
    if (!itemFitsInSlot(itemId, i)) continue;
    const slot = inventory[i];
    if (slot?.id === itemId) {
      capacity += maxStack - slot.quantity;
    } else if (!slot) {
      capacity += maxStack;
    }
  }
  return capacity;
}

export function canAddToInventory(
  inventory: Inventory,
  itemId: string,
  quantity = 1,
) {
  if (!getItemDefinition(itemId)) return false;
  return remainingAddCapacity(inventory, itemId) >= quantity;
}

/**
 * Inventory after handing in quest items. Null when the stack is short.
 * Callers then check payout space on this result, so a full bag can still
 * turn in once those items free a pocket.
 */
export function inventoryAfterTurnIn(
  inventory: Inventory,
  itemId: string | undefined,
  quantity: number | undefined,
): Inventory | null {
  if (!itemId || quantity == null || quantity <= 0) return inventory;
  if (countItemInInventory(inventory, itemId) < quantity) return null;
  return removeItemFromInventory(inventory, itemId, quantity);
}

export function addToInventory(
  inventory: Inventory,
  itemId: string,
  quantity: number,
): Inventory {
  if (quantity <= 0 || !getItemDefinition(itemId)) return inventory;
  itemId = canonicalItemId(itemId);

  const maxStack = maxStackForItem(itemId);
  if (maxStack <= 0) return inventory;

  const next = inventory.map((slot) => (slot ? { ...slot } : null));
  let remaining = quantity;

  for (let i = 0; i < next.length && remaining > 0; i++) {
    if (!itemFitsInSlot(itemId, i)) continue;
    const slot = next[i];
    if (!slot || slot.id !== itemId) continue;
    const room = maxStack - slot.quantity;
    if (room <= 0) continue;
    const add = Math.min(room, remaining);
    slot.quantity += add;
    remaining -= add;
  }

  for (let i = 0; i < next.length && remaining > 0; i++) {
    if (!itemFitsInSlot(itemId, i)) continue;
    if (next[i]) continue;
    const add = Math.min(maxStack, remaining);
    next[i] = { id: itemId, quantity: add };
    remaining -= add;
  }

  return next;
}

export function getAmmoTypeForWeapon(weaponId: string): string | null {
  switch (weaponId) {
    case "weapon_pistol":
      return "ammo_9x19";
    case "weapon_shotgun":
      return "ammo_buckshot";
    case "weapon_hunting_rifle":
    case "weapon_assault_rifle":
      return "ammo_762x39";
    case "weapon_m4a1":
      return "ammo_556x45";
    case "weapon_revolver":
      return "ammo_44";
    default:
      return null;
  }
}

/** Magazine capacity for ranged weapons (0 / undefined = cannot hold chambered ammo). */
export function magazineCapacityForWeapon(weaponId: string): number {
  switch (weaponId) {
    case "weapon_pistol":
      return 17;
    case "weapon_shotgun":
      return 6;
    case "weapon_hunting_rifle":
      return 5;
    case "weapon_revolver":
      return 6;
    case "weapon_assault_rifle":
    case "weapon_m4a1":
      return 30;
    default:
      return 0;
  }
}

/** Clamp / drop invalid chambered rounds for an inventory entry. */
export function normalizedMagazineRounds(
  itemId: string,
  rounds: number | undefined | null,
): number | undefined {
  if (rounds == null || !Number.isFinite(rounds)) return undefined;
  if (!getAmmoTypeForWeapon(itemId)) return undefined;
  const cap = magazineCapacityForWeapon(itemId);
  if (cap <= 0) return undefined;
  const n = Math.max(0, Math.min(cap, Math.floor(rounds)));
  return n > 0 ? n : undefined;
}

/** Build a slot entry, optionally carrying chambered magazine rounds + meta. */
export function makeInventoryEntry(
  id: string,
  quantity: number,
  magazineRounds?: number,
  meta?: {
    rarity?: ItemRarity;
    condition?: number;
    durability?: number;
    wetness?: number;
    radioFreq?: number;
  },
): InventoryEntry {
  const { rarity, condition } = normalizeItemMeta(meta ?? {});
  const itemId = canonicalItemId(id);
  const entry: InventoryEntry = {
    id: itemId,
    quantity: Math.min(quantity, maxStackForItem(itemId)),
    rarity,
    condition,
  };
  const mag = normalizedMagazineRounds(itemId, magazineRounds);
  if (mag != null) entry.magazineRounds = mag;
  const maxDur = getMaxDurability(itemId);
  if (maxDur != null) {
    entry.quantity = 1;
    if (
      typeof meta?.durability === "number" &&
      Number.isFinite(meta.durability)
    ) {
      entry.durability = Math.max(
        0,
        Math.min(maxDur, Math.floor(meta.durability)),
      );
    } else {
      entry.durability = maxDur;
    }
  }
  if (isClothingItem(itemId)) {
    setEntryWetness(entry, typeof meta?.wetness === "number" ? meta.wetness : 0);
  }
  if (isRadioItem(itemId)) {
    const freq = normalizeRadioFreq(meta?.radioFreq);
    if (freq != null) entry.radioFreq = freq;
  }
  return entry;
}

export function getInventoryAmmo(inventory: Inventory, weaponId: string) {
  const ammoType = getAmmoTypeForWeapon(weaponId);
  if (!ammoType) return 0;
  return countItemInInventory(inventory, ammoType);
}

export function useAmmoFromInventory(
  inventory: Inventory,
  weaponId: string,
  amount: number,
): Inventory {
  const ammoType = getAmmoTypeForWeapon(weaponId);
  if (!ammoType) return inventory;
  if (countItemInInventory(inventory, ammoType) < amount) return inventory;

  const next = inventory.map((slot) => (slot ? { ...slot } : null));
  let remaining = amount;

  for (let i = 0; i < next.length && remaining > 0; i++) {
    const slot = next[i];
    if (!slot || slot.id !== ammoType) continue;
    const take = Math.min(slot.quantity, remaining);
    slot.quantity -= take;
    remaining -= take;
    if (slot.quantity <= 0) next[i] = null;
  }

  return next;
}

export function removeFromInventorySlot(
  inventory: Inventory,
  slotIndex: number,
  quantity = 1,
): Inventory {
  if (slotIndex < 0 || slotIndex >= inventory.length) return inventory;
  const slot = inventory[slotIndex];
  if (!slot || slot.quantity < quantity || !getItemDefinition(slot.id)) {
    return inventory;
  }

  const next = inventory.map((s) => (s ? { ...s } : null));
  const target = next[slotIndex]!;
  if (target.quantity <= quantity) {
    next[slotIndex] = null;
  } else {
    target.quantity -= quantity;
  }
  return next;
}

/** Move or merge a stack into another slot; swap when merge is not possible. */
export function moveInventorySlot(
  inventory: Inventory,
  fromSlot: number,
  toSlot: number,
): Inventory {
  if (fromSlot === toSlot) return inventory;
  const slotCount = Math.min(MAX_INVENTORY_SLOTS, inventory.length);
  if (
    fromSlot < 0 ||
    toSlot < 0 ||
    fromSlot >= slotCount ||
    toSlot >= slotCount
  ) {
    return inventory;
  }

  const next = inventory.map((slot) => (slot ? { ...slot } : null));
  const from = next[fromSlot];
  if (!from || !getItemDefinition(from.id)) return inventory;
  if (!itemFitsInSlot(from.id, toSlot)) return inventory;

  const to = next[toSlot];
  if (!to) {
    next[toSlot] = from;
    next[fromSlot] = null;
    return next;
  }

  // Swaps must also respect weapon-slot / pocket size rules for both items.
  if (!itemFitsInSlot(to.id, fromSlot)) return inventory;

  if (from.id === to.id && maxStackForItem(from.id) > 1) {
    const maxStack = maxStackForItem(from.id);
    const room = maxStack - to.quantity;
    if (room > 0) {
      const moveQty = Math.min(room, from.quantity);
      to.quantity += moveQty;
      from.quantity -= moveQty;
      if (from.quantity <= 0) next[fromSlot] = null;
      return next;
    }
  }

  next[fromSlot] = to;
  next[toSlot] = from;
  return next;
}

export function hasInventoryItem(
  inventory: Inventory,
  itemId: string,
  quantity = 1,
) {
  return countItemInInventory(inventory, itemId) >= quantity;
}

export function weaponIndexFromItemId(weaponId: string): number {
  switch (weaponId) {
    case "weapon_pistol":
      return 0;
    case "weapon_shotgun":
      return 1;
    case "weapon_hunting_rifle":
      return 2;
    case "weapon_revolver":
      return 3;
    case "weapon_assault_rifle":
      return 4;
    case "weapon_hammer":
      return 5;
    case "weapon_bat":
      return 6;
    case "weapon_hatchet":
      return 7;
    case "weapon_m4a1":
      return 8;
    default:
      return -1;
  }
}

export function weaponItemIdFromIndex(index: number): string | null {
  switch (index) {
    case 0:
      return "weapon_pistol";
    case 1:
      return "weapon_shotgun";
    case 2:
      return "weapon_hunting_rifle";
    case 3:
      return "weapon_revolver";
    case 4:
      return "weapon_assault_rifle";
    case 5:
      return "weapon_hammer";
    case 6:
      return "weapon_bat";
    case 7:
      return "weapon_hatchet";
    case 8:
      return "weapon_m4a1";
    default:
      return null;
  }
}

export function idleWeaponKeyFromIndex(index: number): string {
  switch (index) {
    case 0:
      return "Pistol";
    case 1:
      return "Shotgun";
    case 2:
      return "HuntingRifle";
    case 3:
      return "Revolver";
    case 4:
      return "AK";
    case 5:
      return "Hammer";
    case 6:
      return "Bat";
    case 7:
      return "Hatchet";
    case 8:
      return "M4";
    default:
      return "NoWeapon";
  }
}

export function ownedWeaponIndices(inventory: Inventory): number[] {
  const indices = new Set<number>();
  for (const slot of inventory) {
    if (!slot?.id.startsWith("weapon_")) continue;
    const idx = weaponIndexFromItemId(slot.id);
    if (idx >= 0) indices.add(idx);
  }
  return [...indices].sort((a, b) => a - b);
}

/** First inventory slot holding a weapon of the given type, or -1. */
export function findInventorySlotForWeaponType(
  inventory: Inventory,
  weaponIndex: number,
): number {
  if (weaponIndex < 0) return -1;
  for (let i = 0; i < inventory.length; i++) {
    const slot = inventory[i];
    if (slot && weaponIndexFromItemId(slot.id) === weaponIndex) return i;
  }
  return -1;
}

/** Weapon type in a slot, or -1 if empty / not a weapon. */
export function weaponIndexInSlot(inventory: Inventory, slotIndex: number): number {
  const slot = inventory[slotIndex];
  if (!slot) return -1;
  return weaponIndexFromItemId(slot.id);
}

const CATEGORY_ITEMS: Record<string, string[]> = {
  ammo_lite: ["ammo_44", "ammo_9x19"],
  ammo_heavy: ["ammo_762x39", "ammo_556x45", "ammo_buckshot"],
  medical_lite: ["multivitamins", "rags"],
  medical_heavy: ["alcohol", "bandages", "antibiotics"],
  guns_lite: ["weapon_pistol", "weapon_revolver"],
  guns_medium: ["weapon_shotgun"],
  guns_hunting: ["weapon_hunting_rifle"],
  /** Whole AK and M4. Barracks and warehouse crates only. */
  guns_military: ["weapon_assault_rifle", "weapon_m4a1"],
  melee_lite: ["weapon_hammer", "weapon_hatchet"],
  melee_heavy: ["weapon_bat"],
  crafting_lite: ["bolts", "screws", "duct_tape", "scrap_metal"],
  /** Sidearm parts a house, motel, or police desk can hold. */
  parts_pistol: ["pistol_frame", "pistol_slide", "pistol_trigger", "small_spring"],
  parts_revolver: [
    "revolver_frame",
    "revolver_cylinder",
    "revolver_barrel",
    "revolver_trigger",
  ],
  /** Civilian long guns. Large spring is shared with rifles. */
  parts_shotgun: [
    "shotgun_receiver",
    "shotgun_barrel",
    "shotgun_stock",
    "shotgun_trigger",
    "large_spring",
  ],
  parts_hunting: [
    "rifle_receiver",
    "rifle_barrel",
    "rifle_stock",
    "scope",
    "rifle_trigger",
    "large_spring",
  ],
  /**
   * AK and M4 parts. Only on barracks furniture and warehouse crates,
   * never on house furniture.
   */
  parts_military: [
    "ak_receiver",
    "ak_barrel",
    "ak_stock",
    "m4_receiver",
    "m4_barrel",
    "m4_stock",
    "rifle_trigger",
    "large_spring",
  ],
  /** Hardware springs in warehouses. Not a military receiver. */
  parts_springs: ["small_spring", "large_spring"],
  junk: [
    "banknote",
    "lighter",
    "blue_cigarettes",
    "white_tshirt",
    "black_tshirt",
    "gold_chain",
    "gold_earrings",
    "gold_ring",
    "silver_chain",
    "silver_ring",
    "old_teddy",
    "teddy",
    "map",
    WATCH_ITEM_ID,
    RADIO_ITEM_ID,
  ],
  consumables: [
    "canned_beans",
    "canned_peaches",
    "canned_tuna",
    "hot_chips",
    "onion_chips",
    "salted_chips",
    "cola",
    "lemonada",
    "water",
  ],
};

/** Item ids belonging to a loot category (empty if unknown). */
export function lootCategoryItemIds(category: string): readonly string[] {
  return CATEGORY_ITEMS[category] ?? [];
}

/** True when furniture can be searched / looted. */
export function furnitureIsSearchable(objectType: string): boolean {
  return Object.prototype.hasOwnProperty.call(CONTAINER_CATEGORIES, objectType);
}

/** Furniture → loot categories (objectType keys match interior furniture). */
const CONTAINER_CATEGORIES: Record<string, string[]> = {
  desk: [
    "melee_lite",
    "ammo_lite",
    "medical_lite",
    "crafting_lite",
    "junk",
    "parts_pistol",
  ],
  bigshelf: [
    "ammo_lite",
    "ammo_heavy",
    "medical_lite",
    "medical_heavy",
    "crafting_lite",
    "consumables",
    "parts_springs",
  ],
  bigbox: [
    "ammo_lite",
    "ammo_heavy",
    "medical_lite",
    "medical_heavy",
    "crafting_lite",
    "consumables",
    "guns_lite",
    "melee_lite",
    "melee_heavy",
    "parts_springs",
    "parts_military",
    "guns_military",
  ],
  watercontainer: ["consumables"],
  cabinet: ["ammo_lite", "medical_lite", "crafting_lite", "junk"],
  bed: [
    "guns_lite",
    "guns_medium",
    "melee_lite",
    "melee_heavy",
    "junk",
    "parts_pistol",
    "parts_shotgun",
  ],
  dresser: ["junk"],
  bookshelf: ["junk"],
  guncabinet: [
    "ammo_lite",
    "ammo_heavy",
    "guns_lite",
    "guns_medium",
    "guns_hunting",
    "parts_pistol",
    "parts_revolver",
    "parts_shotgun",
    "parts_hunting",
  ],
  fridge: ["consumables"],
  drawers: [
    "ammo_lite",
    "medical_lite",
    "guns_lite",
    "crafting_lite",
    "junk",
    "parts_pistol",
    "parts_revolver",
  ],
  kitchensink: ["consumables"],
  /** House kitchen — set DinnerTable1. */
  dinnertable: ["consumables", "junk"],
  nightstand: [
    "ammo_lite",
    "medical_lite",
    "guns_lite",
    "melee_lite",
    "crafting_lite",
    "junk",
    "parts_pistol",
    "parts_revolver",
  ],
  desk2: [
    "ammo_lite",
    "medical_lite",
    "medical_heavy",
    "guns_lite",
    "crafting_lite",
    "junk",
    "consumables",
    "parts_pistol",
    "parts_shotgun",
  ],
  bookshelf2: ["ammo_lite", "junk"],
  deadofficer: [
    "guns_lite",
    "ammo_lite",
    "medical_lite",
    "medical_heavy",
    "junk",
    "parts_pistol",
  ],
  bagchair: [
    "ammo_lite",
    "medical_lite",
    "guns_lite",
    "crafting_lite",
    "junk",
    "consumables",
  ],
  suitcase: [
    "ammo_lite",
    "medical_lite",
    "medical_heavy",
    "guns_lite",
    "crafting_lite",
    "junk",
    "consumables",
    "parts_pistol",
  ],
  watercooler: ["consumables"],
  trashcan: ["crafting_lite", "junk", "consumables"],
  checkout: ["consumables", "junk"],
  supershelf1: ["consumables", "medical_lite", "medical_heavy", "junk"],
  supershelf2: ["consumables", "medical_lite", "medical_heavy", "junk"],
  /** Drink coolers — filtered to drink items only in eligibleLootItems. */
  superfridge1: ["consumables"],
  hospitalbed: ["medical_lite", "medical_heavy", "junk"],
  /** HospitalBed2/3 — occupied soldier beds (decorative Idle only, not searchable). */
  ivstand: ["medical_lite", "medical_heavy"],
  medicalcart: [
    "medical_lite",
    "medical_heavy",
    "crafting_lite",
    "consumables",
  ],
  medicalreception: [
    "medical_lite",
    "medical_heavy",
    "junk",
    "consumables",
  ],
  /** Hospital admin — MedicalDrawers1 filing unit. */
  medicaldrawers: [
    "medical_lite",
    "medical_heavy",
    "crafting_lite",
    "junk",
  ],
  /** Hospital lobby — ThreeSeater1 is decorative only (not searchable). */
  /** Hospital lobby — ThreeSeater2 waiting bench. */
  threeseater2: ["consumables", "junk", "crafting_lite", "guns_lite"],
  /** Hospital lobby — ThreeSeater3 waiting bench. */
  threeseater3: ["consumables", "junk"],
  /** Hospital / police — VendingMachine1. */
  vendingmachine: ["consumables", "junk"],
  /** Motel — lobby Counter1 (junk + rare sidearm roll). */
  counter: ["junk"],
  /** Motel — MotelBed1 guest bed. */
  motelbed: [
    "guns_lite",
    "guns_medium",
    "melee_lite",
    "melee_heavy",
    "junk",
    "parts_pistol",
  ],
  /** Motel — MiniFridge1 in guest rooms. */
  minifridge: ["consumables"],
  /** Player-dropped floor bag — loot is pre-seeded; no random rolls. */
  groundbackpack: [],
  militarybed: ["guns_lite", "melee_lite", "junk", "parts_military", "guns_military"],
  footlocker: [
    "ammo_lite",
    "medical_lite",
    "guns_lite",
    "melee_lite",
    "crafting_lite",
    "junk",
    "consumables",
    "parts_military",
    "guns_military",
  ],
  kitbag: [
    "ammo_lite",
    "medical_lite",
    "guns_lite",
    "crafting_lite",
    "junk",
    "consumables",
    "parts_military",
    "guns_military",
  ],
  camptable: ["consumables", "junk"],
  militarybasket: ["crafting_lite", "junk", "consumables"],
  range: ["consumables", "junk"],
  hotdisplay: ["consumables"],
  drinkdisplay: ["consumables"],
  canteentable1: ["consumables", "junk"],
  canteentable2: ["consumables", "junk"],
  canteentable3: ["consumables", "junk"],
  /** Felled overworld tree — loot is pre-seeded (2–4 wood); no random rolls. */
  fallenTree: [],
  lockers: [
    "ammo_lite",
    "medical_lite",
    "medical_heavy",
    "guns_lite",
    "guns_medium",
    "melee_heavy",
    "crafting_lite",
    "junk",
    "consumables",
    "parts_pistol",
    "parts_shotgun",
  ],
};

const ITEM_SPAWN_DATA: Record<string, { chance: number; minQty: number; maxQty: number }> = {
  ammo_44: { chance: 0.05, minQty: 1, maxQty: 6 },
  ammo_9x19: { chance: 0.05, minQty: 1, maxQty: 17 },
  ammo_762x39: { chance: 0.02, minQty: 1, maxQty: 30 },
  ammo_556x45: { chance: 0.02, minQty: 1, maxQty: 30 },
  ammo_buckshot: { chance: 0.04, minQty: 1, maxQty: 8 },
  multivitamins: { chance: 0.05, minQty: 1, maxQty: 1 },
  rags: { chance: 0.1, minQty: 1, maxQty: 4 },
  alcohol: { chance: 0.05, minQty: 1, maxQty: 2 },
  bandages: { chance: 0.05, minQty: 1, maxQty: 2 },
  antibiotics: { chance: 0.04, minQty: 1, maxQty: 1 },
  weapon_pistol: { chance: 0.01, minQty: 1, maxQty: 1 },
  weapon_revolver: { chance: 0.01, minQty: 1, maxQty: 1 },
  weapon_shotgun: { chance: 0.005, minQty: 1, maxQty: 1 },
  weapon_assault_rifle: { chance: 0.002, minQty: 1, maxQty: 1 },
  weapon_m4a1: { chance: 0.002, minQty: 1, maxQty: 1 },
  weapon_hunting_rifle: { chance: 0.002, minQty: 1, maxQty: 1 },
  weapon_hammer: { chance: 0.1, minQty: 1, maxQty: 1 },
  weapon_hatchet: { chance: 0.1, minQty: 1, maxQty: 1 },
  weapon_bat: { chance: 0.1, minQty: 1, maxQty: 1 },
  bolts: { chance: 0.05, minQty: 1, maxQty: 3 },
  screws: { chance: 0.08, minQty: 1, maxQty: 5 },
  duct_tape: { chance: 0.1, minQty: 1, maxQty: 1 },
  scrap_metal: { chance: 0.05, minQty: 1, maxQty: 1 },
  pistol_slide: { chance: 0.012, minQty: 1, maxQty: 1 },
  pistol_trigger: { chance: 0.008, minQty: 1, maxQty: 1 },
  pistol_frame: { chance: 0.006, minQty: 1, maxQty: 1 },
  small_spring: { chance: 0.018, minQty: 1, maxQty: 1 },
  revolver_cylinder: { chance: 0.006, minQty: 1, maxQty: 1 },
  revolver_barrel: { chance: 0.006, minQty: 1, maxQty: 1 },
  revolver_trigger: { chance: 0.006, minQty: 1, maxQty: 1 },
  revolver_frame: { chance: 0.005, minQty: 1, maxQty: 1 },
  shotgun_stock: { chance: 0.005, minQty: 1, maxQty: 1 },
  shotgun_trigger: { chance: 0.005, minQty: 1, maxQty: 1 },
  shotgun_barrel: { chance: 0.004, minQty: 1, maxQty: 1 },
  shotgun_receiver: { chance: 0.004, minQty: 1, maxQty: 1 },
  large_spring: { chance: 0.008, minQty: 1, maxQty: 1 },
  rifle_stock: { chance: 0.004, minQty: 1, maxQty: 1 },
  rifle_trigger: { chance: 0.004, minQty: 1, maxQty: 1 },
  rifle_barrel: { chance: 0.003, minQty: 1, maxQty: 1 },
  rifle_receiver: { chance: 0.003, minQty: 1, maxQty: 1 },
  scope: { chance: 0.003, minQty: 1, maxQty: 1 },
  ak_stock: { chance: 0.004, minQty: 1, maxQty: 1 },
  ak_barrel: { chance: 0.003, minQty: 1, maxQty: 1 },
  ak_receiver: { chance: 0.003, minQty: 1, maxQty: 1 },
  m4_stock: { chance: 0.003, minQty: 1, maxQty: 1 },
  m4_barrel: { chance: 0.002, minQty: 1, maxQty: 1 },
  m4_receiver: { chance: 0.002, minQty: 1, maxQty: 1 },
  banknote: { chance: 0.05, minQty: 1, maxQty: 20 },
  lighter: { chance: 0.04, minQty: 1, maxQty: 1 },
  blue_cigarettes: { chance: 0.1, minQty: 1, maxQty: 1 },
  white_tshirt: { chance: 0.08, minQty: 1, maxQty: 1 },
  black_tshirt: { chance: 0.08, minQty: 1, maxQty: 1 },
  gold_chain: { chance: 0.005, minQty: 1, maxQty: 1 },
  gold_earrings: { chance: 0.005, minQty: 1, maxQty: 1 },
  gold_ring: { chance: 0.0075, minQty: 1, maxQty: 1 },
  silver_chain: { chance: 0.02, minQty: 1, maxQty: 1 },
  silver_ring: { chance: 0.02, minQty: 1, maxQty: 1 },
  old_teddy: { chance: 0.1, minQty: 1, maxQty: 1 },
  teddy: { chance: 0.08, minQty: 1, maxQty: 1 },
  map: { chance: 0.08, minQty: 1, maxQty: 1 },
  [RADIO_ITEM_ID]: { chance: 0.05, minQty: 1, maxQty: 1 },
  canned_beans: { chance: 0.05, minQty: 1, maxQty: 2 },
  canned_peaches: { chance: 0.08, minQty: 1, maxQty: 2 },
  canned_tuna: { chance: 0.05, minQty: 1, maxQty: 2 },
  hot_chips: { chance: 0.1, minQty: 1, maxQty: 2 },
  onion_chips: { chance: 0.1, minQty: 1, maxQty: 2 },
  salted_chips: { chance: 0.15, minQty: 1, maxQty: 2 },
  cola: { chance: 0.05, minQty: 1, maxQty: 3 },
  lemonada: { chance: 0.05, minQty: 1, maxQty: 3 },
  water: { chance: 0.08, minQty: 1, maxQty: 3 },
};

/** Eligible item ids for a container, after furniture-specific filters. */
function eligibleLootItems(objectType: string): string[] {
  const categories = CONTAINER_CATEGORIES[objectType] ?? [];
  let items = [...new Set(categories.flatMap((cat) => CATEGORY_ITEMS[cat] ?? []))];

  // Water furniture: only bottles of water from consumables.
  if (objectType === "watercontainer" || objectType === "watercooler") {
    return items.filter((id) => id === "water");
  }

  // Dead officer: guns_lite contributes pistol only (no revolver).
  if (objectType === "deadofficer") {
    items = items.filter((id) => id !== "weapon_revolver");
  }

  // SuperShelf: junk is limited to map + teddies (no cash / jewellery).
  if (objectType === "supershelf1" || objectType === "supershelf2") {
    const shelfJunk = new Set(["map", "teddy", "old_teddy"]);
    const junkIds = new Set(CATEGORY_ITEMS.junk ?? []);
    items = items.filter((id) => !junkIds.has(id) || shelfJunk.has(id));
  }

  // SuperFridge1: consumable drink rolls only (cola / lemonade / water).
  if (objectType === "superfridge1" || objectType === "drinkdisplay") {
    items = items.filter((id) => getItemDefinition(id)?.category === "drink");
  }

  return items;
}

/** Independent rolls for each item in the given loot categories. */
function rollLootFromCategories(
  categories: string[],
  rng: () => number,
  chanceScale = 1,
): InventoryEntry[] {
  const possibleItems = [
    ...new Set(categories.flatMap((cat) => CATEGORY_ITEMS[cat] ?? [])),
  ];
  const scale =
    Number.isFinite(chanceScale) && chanceScale > 0 ? chanceScale : 1;
  const results: InventoryEntry[] = [];
  for (const id of possibleItems) {
    const data = ITEM_SPAWN_DATA[id];
    if (!data || rng() >= Math.min(1, data.chance * scale)) continue;
    const quantity =
      Math.floor(rng() * (data.maxQty - data.minQty + 1)) + data.minQty;
    results.push({ id, quantity });
  }
  return results;
}

/** Roll container loot — non-deterministic (fresh `Math.random` each call). */
export function generateSearchLoot(
  objectType: string,
  _searchSeed: string,
  _buildingX?: number,
  _buildingY?: number,
  chanceScale = 1,
): InventoryEntry[] {
  const possibleItems = eligibleLootItems(objectType);
  const results: InventoryEntry[] = [];
  const scale =
    Number.isFinite(chanceScale) && chanceScale > 0 ? chanceScale : 1;

  for (const id of possibleItems) {
    const data = ITEM_SPAWN_DATA[id];
    if (!data || Math.random() >= Math.min(1, data.chance * scale)) continue;
    const quantity =
      Math.floor(Math.random() * (data.maxQty - data.minQty + 1)) + data.minQty;
    results.push({ id, quantity });
  }

  // Checkout1: cash drawer + rare sidearm (+ matching ammo) on top of loot.
  if (objectType === "checkout") {
    if (Math.random() < Math.min(1, 0.05 * scale)) {
      results.push({
        id: "banknote",
        quantity: 1 + Math.floor(Math.random() * 50), // 1–50
      });
    }
    if (Math.random() < Math.min(1, 0.01 * scale)) {
      const pistol = Math.random() < 0.5;
      results.push({
        id: pistol ? "weapon_pistol" : "weapon_revolver",
        quantity: 1,
      });
      results.push({
        id: pistol ? "ammo_9x19" : "ammo_44",
        quantity: pistol
          ? 1 + Math.floor(Math.random() * 17) // 1–17
          : 1 + Math.floor(Math.random() * 6), // 1–6
      });
    }
  }

  // Motel Counter1: 1% sidearm + matching ammo (0–17 / 0–6).
  if (objectType === "counter" && Math.random() < Math.min(1, 0.01 * scale)) {
    const pistol = Math.random() < 0.5;
    results.push({
      id: pistol ? "weapon_pistol" : "weapon_revolver",
      quantity: 1,
    });
    const ammoQty = pistol
      ? Math.floor(Math.random() * 18) // 0–17
      : Math.floor(Math.random() * 7); // 0–6
    if (ammoQty > 0) {
      results.push({
        id: pistol ? "ammo_9x19" : "ammo_44",
        quantity: ammoQty,
      });
    }
  }

  // MedicalReception1: dedicated cash-drawer banknote roll (on top of junk).
  if (objectType === "medicalreception" && Math.random() < Math.min(1, 0.15 * scale)) {
    results.push({
      id: "banknote",
      quantity: 1 + Math.floor(Math.random() * 15), // 1–15
    });
  }

  // ThreeSeater2: sidearms come with matching ammo (0–17 / 0–6).
  if (objectType === "threeseater2") {
    if (results.some((e) => e.id === "weapon_pistol")) {
      const qty = Math.floor(Math.random() * 18); // 0–17
      if (qty > 0) results.push({ id: "ammo_9x19", quantity: qty });
    }
    if (results.some((e) => e.id === "weapon_revolver")) {
      const qty = Math.floor(Math.random() * 7); // 0–6
      if (qty > 0) results.push({ id: "ammo_44", quantity: qty });
    }
  }

  // Dead officer: one body per station. Desk-style 1% pistol rolls left them empty.
  if (objectType === "deadofficer") {
    return applyDeadOfficerLoot(results, scale);
  }

  return results;
}

/** Same sidearm rate as a police-officer zombie. These bodies are rare. */
const DEAD_OFFICER_PISTOL_CHANCE = 0.25;
/** Extra radio roll on the station body, independent of the junk pool. */
const DEAD_OFFICER_RADIO_CHANCE = 0.25;

function applyDeadOfficerLoot(
  results: InventoryEntry[],
  scale: number,
): InventoryEntry[] {
  const out = results.slice();
  if (
    !out.some((e) => e.id === "weapon_pistol") &&
    Math.random() < Math.min(1, DEAD_OFFICER_PISTOL_CHANCE * scale)
  ) {
    out.push({ id: "weapon_pistol", quantity: 1 });
  }
  if (
    !out.some((e) => e.id === RADIO_ITEM_ID) &&
    Math.random() < Math.min(1, DEAD_OFFICER_RADIO_CHANCE * scale)
  ) {
    out.push({ id: RADIO_ITEM_ID, quantity: 1 });
  }
  if (
    out.some((e) => e.id === "weapon_pistol") &&
    !out.some((e) => e.id === "ammo_9x19")
  ) {
    out.push({
      id: "ammo_9x19",
      quantity: 1 + Math.floor(Math.random() * 17),
    });
  }
  // Outside town the body always yields something. Birchport uses the halved
  // rolls only, so this station corpse can come up empty.
  if (out.length === 0 && scale >= 1) {
    const fallback: { id: string; minQty: number; maxQty: number }[] = [
      { id: "ammo_9x19", minQty: 3, maxQty: 17 },
      { id: "rags", minQty: 1, maxQty: 4 },
      { id: "bandages", minQty: 1, maxQty: 2 },
      { id: "blue_cigarettes", minQty: 1, maxQty: 1 },
      { id: "banknote", minQty: 2, maxQty: 20 },
      { id: "lighter", minQty: 1, maxQty: 1 },
    ];
    const pick = fallback[Math.floor(Math.random() * fallback.length)]!;
    out.push({
      id: pick.id,
      quantity:
        pick.minQty +
        Math.floor(Math.random() * (pick.maxQty - pick.minQty + 1)),
    });
  }
  return out;
}

/** 50% of zombies carry nothing; otherwise category rolls at normal spawn rates. */
const ZOMBIE_EMPTY_LOOT_CHANCE = 0.5;
const ZOMBIE_LOOT_CATEGORIES = [
  "ammo_lite",
  "medical_lite",
  "crafting_lite",
  "junk",
  "consumables",
];

/** Police officer zombie (skin 11) — 25% chance of a sidearm + 0–17 9x19. */
const ZOMBIE_POLICE_PISTOL_CHANCE = 0.25;

/** Deterministic loot rolled once when a zombie dies. */
export function generateZombieLoot(
  zombieId: string,
  skin = 1,
  chanceScale = 1,
): InventoryEntry[] {
  const rng = mulberry32(xmur3(`zombie-loot:${zombieId}`)());
  const scale =
    Number.isFinite(chanceScale) && chanceScale > 0 ? chanceScale : 1;
  const results: InventoryEntry[] = [];

  if (
    skin === ZOMBIE_SKIN_MAN11 &&
    rng() < Math.min(1, ZOMBIE_POLICE_PISTOL_CHANCE * scale)
  ) {
    results.push({ id: "weapon_pistol", quantity: 1 });
    const ammoQty = Math.floor(rng() * 18); // 0–17
    if (ammoQty > 0) {
      results.push({ id: "ammo_9x19", quantity: ammoQty });
    }
  }

  // Empty roll skips normal categories but keeps any officer sidearm above.
  if (rng() < ZOMBIE_EMPTY_LOOT_CHANCE) return results;
  results.push(...rollLootFromCategories(ZOMBIE_LOOT_CATEGORIES, rng, scale));
  return results;
}

const GUARD_LOOT_CATEGORIES = [
  "ammo_lite",
  "medical_lite",
  "medical_heavy",
  "crafting_lite",
  "junk",
  "consumables",
  "parts_military",
];

/** Deterministic loot rolled once when a guard dies — always includes dog tag, AK + 0–30 7.62. */
export function generateGuardLoot(guardId: string, salt = ""): InventoryEntry[] {
  const rng = mulberry32(xmur3(`guard-loot:${guardId}:${salt}`)());
  const results: InventoryEntry[] = [
    { id: "dogtag", quantity: 1 },
    { id: "weapon_assault_rifle", quantity: 1 },
  ];
  const ammoQty = Math.floor(rng() * 31); // 0–30
  if (ammoQty > 0) {
    results.push({ id: "ammo_762x39", quantity: ammoQty });
  }
  results.push(...rollLootFromCategories(GUARD_LOOT_CATEGORIES, rng));
  return results;
}

const TRADER_GUARD_LOOT_CATEGORIES = [
  "medical_lite",
  "medical_heavy",
  "consumables",
  "junk",
];

/** TraderGuard1 loot — always 1× pistol + 0–17 9x19mm, plus trader categories. */
export function generateTraderGuardLoot(
  guardId: string,
  salt = "",
): InventoryEntry[] {
  const rng = mulberry32(xmur3(`trader-guard-loot:${guardId}:${salt}`)());
  const results: InventoryEntry[] = [{ id: "weapon_pistol", quantity: 1 }];
  const ammoQty = Math.floor(rng() * 18); // 0–17
  if (ammoQty > 0) {
    results.push({ id: "ammo_9x19", quantity: ammoQty });
  }
  results.push(...rollLootFromCategories(TRADER_GUARD_LOOT_CATEGORIES, rng));
  return results;
}

/**
 * Red Order loot — pistol skins always drop a pistol + 0–17 9x19;
 * shotgun skin (2) always drops a shotgun + 0–8 buckshot.
 * Extra rolls match TraderGuard categories.
 */
export function generateRedManLoot(
  guardId: string,
  skin: number,
  salt = "",
): InventoryEntry[] {
  const rng = mulberry32(xmur3(`red-man-loot:${guardId}:${salt}`)());
  const shotgun = skin === 2;
  const results: InventoryEntry[] = [
    { id: shotgun ? "weapon_shotgun" : "weapon_pistol", quantity: 1 },
  ];
  const ammoQty = shotgun
    ? Math.floor(rng() * 9) // 0–8
    : Math.floor(rng() * 18); // 0–17
  if (ammoQty > 0) {
    results.push({
      id: shotgun ? "ammo_buckshot" : "ammo_9x19",
      quantity: ammoQty,
    });
  }
  results.push(...rollLootFromCategories(TRADER_GUARD_LOOT_CATEGORIES, rng));
  return results;
}

/** TraderMan1 loot — light trade goods, no guaranteed weapon. */
export function generateTraderManLoot(
  manId: string,
  salt = "",
): InventoryEntry[] {
  const rng = mulberry32(xmur3(`trader-man-loot:${manId}:${salt}`)());
  return rollLootFromCategories(
    ["medical_lite", "consumables", "junk"],
    rng,
  );
}

function normalizeInventorySlots(parsed: unknown[]): Inventory {
  // Former backpack layout (16 slots): keep body slots 0–7, then pack
  // backpack-band items into the remaining pocket slots.
  const LEGACY_BACKPACK_SLOT_COUNT = 16;
  if (parsed.length === LEGACY_BACKPACK_SLOT_COUNT) {
    let inventory = createEmptyInventory();
    for (let i = 0; i < Math.min(8, parsed.length); i++) {
      const slot = parsed[i];
      if (
        slot &&
        typeof slot === "object" &&
        typeof (slot as InventoryEntry).id === "string" &&
        typeof (slot as InventoryEntry).quantity === "number" &&
        (slot as InventoryEntry).quantity > 0 &&
        getItemDefinition((slot as InventoryEntry).id) &&
        (slot as InventoryEntry).id !== "backpack1"
      ) {
        const entry = slot as InventoryEntry;
        inventory[i] = makeInventoryEntry(
          entry.id,
          entry.quantity,
          entry.magazineRounds,
          inventoryEntryMeta(entry),
        );
      }
    }
    for (let i = 8; i < parsed.length; i++) {
      const slot = parsed[i];
      if (
        !slot ||
        typeof slot !== "object" ||
        typeof (slot as InventoryEntry).id !== "string" ||
        typeof (slot as InventoryEntry).quantity !== "number" ||
        (slot as InventoryEntry).quantity <= 0 ||
        !getItemDefinition((slot as InventoryEntry).id) ||
        (slot as InventoryEntry).id === "backpack1"
      ) {
        continue;
      }
      const entry = slot as InventoryEntry;
      inventory = addToInventory(inventory, entry.id, entry.quantity);
    }
    return inventory;
  }

  // Legacy 12-slot layout (4 hotbar + 8 pockets) → 14 slots (2 weapons + 12 pockets).
  // Prefer keeping long guns in weapon slots so they are not dropped when old
  // hotbar indices 2–3 become pockets.
  const LEGACY_12_SLOT_COUNT = 12;
  if (parsed.length === LEGACY_12_SLOT_COUNT) {
    const entries: { index: number; entry: InventoryEntry }[] = [];
    for (let i = 0; i < LEGACY_12_SLOT_COUNT; i++) {
      const slot = parsed[i];
      if (
        !slot ||
        typeof slot !== "object" ||
        typeof (slot as InventoryEntry).id !== "string" ||
        typeof (slot as InventoryEntry).quantity !== "number" ||
        (slot as InventoryEntry).quantity <= 0 ||
        !getItemDefinition((slot as InventoryEntry).id) ||
        (slot as InventoryEntry).id === "backpack1"
      ) {
        continue;
      }
      const entry = slot as InventoryEntry;
      entries.push({
        index: i,
        entry: {
          id: entry.id,
          quantity: Math.min(entry.quantity, maxStackForItem(entry.id)),
        },
      });
    }

    let inventory = createEmptyInventory();
    const overflow: InventoryEntry[] = [];

    // First pass: place items that still fit their old index.
    for (const { index, entry } of entries) {
      if (itemFitsInSlot(entry.id, index)) {
        inventory[index] = entry;
      } else {
        overflow.push(entry);
      }
    }

    // Second pass: long guns that no longer fit (old hotbar 2–3) go to weapon slots.
    const stillOverflow: InventoryEntry[] = [];
    for (const entry of overflow) {
      if (isHotbarOnlyItem(entry.id) || isWeaponItem(entry.id)) {
        let placed = false;
        for (let i = 0; i < WEAPON_SLOT_COUNT; i++) {
          if (!inventory[i] && itemFitsInSlot(entry.id, i)) {
            inventory[i] = entry;
            placed = true;
            break;
          }
        }
        if (!placed) stillOverflow.push(entry);
      } else {
        stillOverflow.push(entry);
      }
    }

    for (const entry of stillOverflow) {
      inventory = addToInventory(inventory, entry.id, entry.quantity);
    }
    return inventory;
  }

  const slotCount = Math.min(
    MAX_INVENTORY_SLOTS,
    Math.max(BASE_INVENTORY_SLOTS, parsed.length),
  );
  let slots = createEmptyInventory(slotCount);
  const overflow: InventoryEntry[] = [];
  for (let i = 0; i < Math.min(parsed.length, slotCount); i++) {
    const slot = parsed[i];
    if (slot === null) continue;
    if (
      slot &&
      typeof slot === "object" &&
      typeof (slot as InventoryEntry).id === "string" &&
      typeof (slot as InventoryEntry).quantity === "number" &&
      (slot as InventoryEntry).quantity > 0 &&
      getItemDefinition((slot as InventoryEntry).id)
    ) {
      const entry = slot as InventoryEntry;
      // Drop removed backpack items from older saves.
      if (entry.id === "backpack1") continue;
      const normalized = makeInventoryEntry(
        entry.id,
        entry.quantity,
        entry.magazineRounds,
        inventoryEntryMeta(entry),
      );
      if (!itemFitsInSlot(normalized.id, i)) {
        overflow.push(normalized);
        continue;
      }
      slots[i] = normalized;
    }
  }
  for (const entry of overflow) {
    slots = addToInventory(slots, entry.id, entry.quantity);
  }
  return slots;
}

function migrateLegacyInventory(entries: InventoryEntry[]): Inventory {
  let inventory = createEmptyInventory();
  for (const entry of entries) {
    if (
      !entry ||
      typeof entry.id !== "string" ||
      typeof entry.quantity !== "number" ||
      entry.quantity <= 0 ||
      !getItemDefinition(entry.id)
    ) {
      continue;
    }
    inventory = addToInventory(inventory, entry.id, entry.quantity);
  }
  return inventory;
}

function migrateMapIntoDedicatedSlot(inventory: Inventory): Inventory {
  const equipped = inventory[MAP_SLOT_INDEX];
  if (equipped) return inventory;
  for (let i = WEAPON_SLOT_COUNT; i < CLOTHING_SLOT_INDEX; i++) {
    const slot = inventory[i];
    if (!slot || !isMapItem(slot.id)) continue;
    const next = inventory.map((s) => (s ? { ...s } : null));
    next[MAP_SLOT_INDEX] = slot;
    next[i] = null;
    return next;
  }
  return inventory;
}

export function parseInventory(json: string): Inventory {
  try {
    if (typeof json !== "string" || json.length === 0) {
      return createEmptyInventory();
    }
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return createEmptyInventory();
    if (parsed.length === 0) return createEmptyInventory();

    // Always treat array payloads as a slot grid first. One bad/unknown cell
    // must not wipe the rest of the bag (legacy `every(isValidSlot)` did that
    // when it fell through and then failed to salvage).
    const asSlots = normalizeInventorySlots(parsed);
    if (asSlots.some(Boolean) || parsed.every((s) => s == null)) {
      return migrateMapIntoDedicatedSlot(asSlots);
    }

    const legacyEntries = parsed.filter(
      (entry) =>
        entry &&
        typeof entry.id === "string" &&
        typeof entry.quantity === "number" &&
        entry.quantity > 0,
    ) as InventoryEntry[];

    if (legacyEntries.length > 0) {
      return migrateMapIntoDedicatedSlot(migrateLegacyInventory(legacyEntries));
    }

    return createEmptyInventory();
  } catch {
    return createEmptyInventory();
  }
}

export function serializeInventory(inventory: Inventory) {
  const n = Math.min(
    MAX_INVENTORY_SLOTS,
    Math.max(BASE_INVENTORY_SLOTS, inventory.length),
  );
  const slots: Inventory = Array.from({ length: n }, () => null);
  for (let i = 0; i < n; i++) {
    const slot = inventory[i];
    if (!slot || slot.quantity <= 0 || !getItemDefinition(slot.id)) {
      slots[i] = null;
      continue;
    }
    // Player bags keep chambered ammo in weaponMagazinesJson — strip any stale field.
    const { rarity, condition } = normalizeItemMeta(slot);
    const serialized: InventoryEntry = {
      id: slot.id,
      quantity: Math.min(slot.quantity, maxStackForItem(slot.id)),
      rarity,
      condition,
    };
    const maxDur = getMaxDurability(slot.id);
    if (maxDur != null) {
      serialized.quantity = 1;
      serialized.durability = getEntryDurability(slot);
    }
    const wet = getEntryWetness(slot);
    if (wet > 0) serialized.wetness = wet;
    const freq = getEntryRadioFreq(slot);
    if (freq > 0) serialized.radioFreq = freq;
    slots[i] = serialized;
  }
  return JSON.stringify(slots);
}

export function createEmptyContainerInventory(): Inventory {
  return Array.from({ length: CONTAINER_INVENTORY_SLOTS }, () => null);
}

function storageBoxSlotLimit(slotCount: number): number {
  const n = Math.floor(slotCount);
  if (!Number.isFinite(n) || n <= 0) return 1;
  return Math.min(64, n);
}

export function createEmptyStorageBoxInventory(slotCount: number): Inventory {
  return Array.from({ length: storageBoxSlotLimit(slotCount) }, () => null);
}

export function parseStorageBoxInventory(
  json: string | null | undefined,
  slotCount: number,
): Inventory {
  const slots = createEmptyStorageBoxInventory(slotCount);
  if (typeof json !== "string" || json.length === 0) return slots;
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return slots;
    for (let i = 0; i < Math.min(parsed.length, slots.length); i++) {
      const slot = parsed[i];
      if (
        slot &&
        typeof slot === "object" &&
        typeof (slot as InventoryEntry).id === "string" &&
        typeof (slot as InventoryEntry).quantity === "number" &&
        (slot as InventoryEntry).quantity > 0 &&
        getItemDefinition((slot as InventoryEntry).id)
      ) {
        const entry = slot as InventoryEntry;
        slots[i] = makeInventoryEntry(
          entry.id,
          entry.quantity,
          entry.magazineRounds,
          inventoryEntryMeta(entry),
        );
      }
    }
  } catch {
    return createEmptyStorageBoxInventory(slotCount);
  }
  return slots;
}

export function serializeStorageBoxInventory(
  inventory: Inventory,
  slotCount: number,
): string {
  const slots = createEmptyStorageBoxInventory(slotCount);
  for (let i = 0; i < slots.length; i++) {
    const slot = inventory[i];
    if (!slot || slot.quantity <= 0 || !getItemDefinition(slot.id)) continue;
    slots[i] = makeInventoryEntry(
      slot.id,
      slot.quantity,
      slot.magazineRounds,
      inventoryEntryMeta(slot),
    );
  }
  return JSON.stringify(slots);
}

/** Move a player stack into a storage box. Swap only when the box item fits the player slot. */
export function putIntoStorageBoxSlot(
  playerInventory: Inventory,
  fromSlot: number,
  container: Inventory,
  toSlot: number,
  slotCount: number,
): { container: Inventory; playerInventory: Inventory } | null {
  const limit = storageBoxSlotLimit(slotCount);
  if (
    fromSlot < 0 ||
    toSlot < 0 ||
    fromSlot >= playerInventory.length ||
    fromSlot >= MAX_INVENTORY_SLOTS ||
    toSlot >= limit
  ) {
    return null;
  }

  const nextPlayer = playerInventory.map((slot) => (slot ? { ...slot } : null));
  const nextContainer = createEmptyStorageBoxInventory(limit);
  for (let i = 0; i < limit; i++) {
    const slot = container[i];
    nextContainer[i] = slot ? { ...slot } : null;
  }
  const from = nextPlayer[fromSlot];
  if (!from || !getItemDefinition(from.id)) return null;

  const to = nextContainer[toSlot];
  if (!to) {
    nextContainer[toSlot] = from;
    nextPlayer[fromSlot] = null;
    return { container: nextContainer, playerInventory: nextPlayer };
  }

  if (from.id === to.id && maxStackForItem(from.id) > 1) {
    const maxStack = maxStackForItem(from.id);
    const room = maxStack - to.quantity;
    if (room > 0) {
      const moveQty = Math.min(room, from.quantity);
      to.quantity += moveQty;
      from.quantity -= moveQty;
      if (from.quantity <= 0) nextPlayer[fromSlot] = null;
      return { container: nextContainer, playerInventory: nextPlayer };
    }
  }

  if (!itemFitsInSlot(to.id, fromSlot)) return null;
  nextPlayer[fromSlot] = to;
  nextContainer[toSlot] = from;
  return { container: nextContainer, playerInventory: nextPlayer };
}

export function moveStorageBoxSlot(
  container: Inventory,
  fromSlot: number,
  toSlot: number,
  slotCount: number,
): Inventory {
  const limit = storageBoxSlotLimit(slotCount);
  if (fromSlot === toSlot) return container;
  if (
    fromSlot < 0 ||
    toSlot < 0 ||
    fromSlot >= limit ||
    toSlot >= limit
  ) {
    return container;
  }
  const next = createEmptyStorageBoxInventory(limit);
  for (let i = 0; i < limit; i++) {
    const slot = container[i];
    next[i] = slot ? { ...slot } : null;
  }
  const from = next[fromSlot];
  if (!from || !getItemDefinition(from.id)) return container;
  const to = next[toSlot];
  if (!to) {
    next[toSlot] = from;
    next[fromSlot] = null;
    return next;
  }
  if (from.id === to.id && maxStackForItem(from.id) > 1) {
    const maxStack = maxStackForItem(from.id);
    const room = maxStack - to.quantity;
    if (room > 0) {
      const moveQty = Math.min(room, from.quantity);
      to.quantity += moveQty;
      from.quantity -= moveQty;
      if (from.quantity <= 0) next[fromSlot] = null;
      return next;
    }
  }
  next[fromSlot] = to;
  next[toSlot] = from;
  return next;
}

/** How many more of `itemId` fit in a container inventory. */
export function remainingContainerAddCapacity(
  inventory: Inventory,
  itemId: string,
): number {
  if (!getItemDefinition(itemId)) return 0;
  const maxStack = maxStackForItem(itemId);
  if (maxStack <= 0) return 0;
  let room = 0;
  for (let i = 0; i < CONTAINER_INVENTORY_SLOTS; i++) {
    const slot = inventory[i];
    if (!slot) {
      room += maxStack;
      continue;
    }
    if (slot.id !== itemId) continue;
    room += Math.max(0, maxStack - slot.quantity);
  }
  return room;
}

export function canAddToContainerInventory(
  inventory: Inventory,
  itemId: string,
  quantity = 1,
): boolean {
  return remainingContainerAddCapacity(inventory, itemId) >= quantity;
}

/**
 * Merge items into a container (no player slot-type restrictions).
 * `magazineRounds` is attached to the first newly created weapon stack only
 * (weapons are non-stackable, so this is the dropped gun itself).
 * `meta.durability` is kept on new stacks so worn tools stay worn after a drop.
 */
export function addToContainerInventory(
  inventory: Inventory,
  itemId: string,
  quantity: number,
  magazineRounds = 0,
  meta?: {
    rarity?: ItemRarity;
    condition?: number;
    durability?: number;
    wetness?: number;
    radioFreq?: number;
  },
): Inventory {
  if (quantity <= 0 || !getItemDefinition(itemId)) return inventory;
  const maxStack = maxStackForItem(itemId);
  if (maxStack <= 0) return inventory;

  const next = inventory.map((slot) => (slot ? { ...slot } : null));
  let remaining = quantity;
  let pendingMag = normalizedMagazineRounds(itemId, magazineRounds);

  for (let i = 0; i < CONTAINER_INVENTORY_SLOTS && remaining > 0; i++) {
    const slot = next[i];
    if (!slot || slot.id !== itemId) continue;
    const room = maxStack - slot.quantity;
    if (room <= 0) continue;
    const add = Math.min(room, remaining);
    slot.quantity += add;
    remaining -= add;
  }

  for (let i = 0; i < CONTAINER_INVENTORY_SLOTS && remaining > 0; i++) {
    if (next[i]) continue;
    const add = Math.min(maxStack, remaining);
    next[i] = makeInventoryEntry(itemId, add, pendingMag, meta);
    pendingMag = undefined;
    remaining -= add;
  }

  return next;
}

/** Sentinel building coords for overworld floor bags in SearchableState. */
export const OVERWORLD_BAG_BUILDING = -1;

export const GROUND_BACKPACK_TYPE = "groundbackpack";

/** Overworld felled-tree loot pile (uses fallen tree sprite; no bag art). */
export const FALLEN_TREE_TYPE = "fallenTree";

/** Dropped floor bags despawn this long after the last item was added (unless emptied sooner). */
export const GROUND_BACKPACK_DESPAWN_MS = 60 * 60 * 1000;

export function isGroundBackpackType(objectType: string): boolean {
  return objectType === GROUND_BACKPACK_TYPE;
}

export function isFallenTreeType(objectType: string): boolean {
  return objectType === FALLEN_TREE_TYPE;
}

export function isFallenTreeId(id: string): boolean {
  return id.startsWith("fallenTree:");
}

export function fallenTreeId(tx: number, ty: number): string {
  return `fallenTree:${tx}:${ty}`;
}

export function isGroundBackpackId(id: string): boolean {
  return id.startsWith("groundbag:");
}

export function groundBackpackIdOverworld(tx: number, ty: number): string {
  return `groundbag:ow:${tx}:${ty}`;
}

export function groundBackpackIdInterior(
  bx: number,
  by: number,
  tx: number,
  ty: number,
): string {
  return `groundbag:in:${bx}:${by}:${tx}:${ty}`;
}

export type GroundBackpackLocation =
  | { kind: "overworld"; tx: number; ty: number }
  | { kind: "interior"; bx: number; by: number; tx: number; ty: number };

export function parseGroundBackpackId(id: string): GroundBackpackLocation | null {
  const parts = id.split(":");
  if (parts[0] !== "groundbag") return null;
  if (parts[1] === "ow" && parts.length === 4) {
    const tx = Number(parts[2]);
    const ty = Number(parts[3]);
    if (!Number.isFinite(tx) || !Number.isFinite(ty)) return null;
    return { kind: "overworld", tx, ty };
  }
  if (parts[1] === "in" && parts.length === 6) {
    const bx = Number(parts[2]);
    const by = Number(parts[3]);
    const tx = Number(parts[4]);
    const ty = Number(parts[5]);
    if (
      !Number.isFinite(bx) ||
      !Number.isFinite(by) ||
      !Number.isFinite(tx) ||
      !Number.isFinite(ty)
    ) {
      return null;
    }
    return { kind: "interior", bx, by, tx, ty };
  }
  return null;
}

export function createContainerInventoryFromLoot(loot: InventoryEntry[]): Inventory {
  const inventory = createEmptyContainerInventory();
  let slot = 0;
  for (const entry of loot) {
    if (slot >= CONTAINER_INVENTORY_SLOTS) break;
    if (!getItemDefinition(entry.id) || entry.quantity <= 0) continue;
    inventory[slot++] = makeInventoryEntry(
      entry.id,
      entry.quantity,
      entry.magazineRounds,
      inventoryEntryMeta(entry),
    );
  }
  return inventory;
}

/**
 * Pack a dead player's inventory into corpse loot. Chambered rounds stay on
 * the gun, matching a manual drop, instead of spilling out as loose ammo.
 */
export function playerInventoryToCorpseLoot(
  inventory: Inventory,
  magazinesJson: string,
  magazineRounds: number,
  equippedInventorySlot: number,
): InventoryEntry[] {
  const entries: InventoryEntry[] = [];
  const addOrMerge = (entry: InventoryEntry) => {
    if (entry.quantity <= 0 || !getItemDefinition(entry.id)) return;
    const qty = Math.min(entry.quantity, maxStackForItem(entry.id));
    const existing = entries.find((e) => e.id === entry.id);
    if (existing && getItemDefinition(entry.id)?.stackable) {
      existing.quantity = Math.min(
        existing.quantity + qty,
        maxStackForItem(entry.id),
      );
      return;
    }
    entries.push(
      makeInventoryEntry(entry.id, qty, entry.magazineRounds, inventoryEntryMeta(entry)),
    );
  };

  const mags = parseWeaponMagazines(magazinesJson);
  for (let i = 0; i < inventory.length; i++) {
    const slot = inventory[i];
    if (!slot || slot.quantity <= 0) continue;
    let rounds = slot.magazineRounds;
    if (getAmmoTypeForWeapon(slot.id)) {
      rounds = getStoredMagazineRounds(mags, i) ?? 0;
      if (i === equippedInventorySlot) {
        rounds = Math.max(rounds, Math.max(0, Math.floor(magazineRounds)));
      }
    }
    addOrMerge({ ...slot, magazineRounds: rounds });
  }

  return entries;
}

export function parseContainerInventory(json: string): Inventory {
  try {
    if (typeof json !== "string" || json.length === 0) {
      return createEmptyContainerInventory();
    }
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return createEmptyContainerInventory();
    const slots = createEmptyContainerInventory();
    for (let i = 0; i < Math.min(parsed.length, CONTAINER_INVENTORY_SLOTS); i++) {
      const slot = parsed[i];
      if (
        slot &&
        typeof slot === "object" &&
        typeof (slot as InventoryEntry).id === "string" &&
        typeof (slot as InventoryEntry).quantity === "number" &&
        (slot as InventoryEntry).quantity > 0 &&
        getItemDefinition((slot as InventoryEntry).id)
      ) {
        const entry = slot as InventoryEntry;
        slots[i] = makeInventoryEntry(
          entry.id,
          entry.quantity,
          entry.magazineRounds,
          inventoryEntryMeta(entry),
        );
      }
    }
    return slots;
  } catch {
    return createEmptyContainerInventory();
  }
}

export function serializeContainerInventory(inventory: Inventory): string {
  const slots = createEmptyContainerInventory();
  for (let i = 0; i < CONTAINER_INVENTORY_SLOTS; i++) {
    const slot = inventory[i];
    if (!slot || slot.quantity <= 0 || !getItemDefinition(slot.id)) {
      slots[i] = null;
      continue;
    }
    slots[i] = makeInventoryEntry(slot.id, slot.quantity, slot.magazineRounds, inventoryEntryMeta(slot));
  }
  return JSON.stringify(slots);
}

export function containerInventoryIsEmpty(inventory: Inventory): boolean {
  return inventory.every((slot) => !slot);
}

/**
 * Move/merge/swap a stack from a container into the player's inventory.
 * Container slots have no size restrictions; player slots use `itemFitsInSlot`.
 */
export function takeFromContainerSlot(
  container: Inventory,
  fromSlot: number,
  playerInventory: Inventory,
  toSlot: number,
  containerSlotCount = CONTAINER_INVENTORY_SLOTS,
): { container: Inventory; playerInventory: Inventory } | null {
  if (
    fromSlot < 0 ||
    toSlot < 0 ||
    fromSlot >= containerSlotCount ||
    toSlot >= playerInventory.length ||
    toSlot >= MAX_INVENTORY_SLOTS
  ) {
    return null;
  }

  const nextContainer = container.map((slot) => (slot ? { ...slot } : null));
  const nextPlayer = playerInventory.map((slot) => (slot ? { ...slot } : null));
  const from = nextContainer[fromSlot];
  if (!from || !getItemDefinition(from.id)) return null;
  if (!itemFitsInSlot(from.id, toSlot)) return null;

  const to = nextPlayer[toSlot];
  if (!to) {
    nextPlayer[toSlot] = from;
    nextContainer[fromSlot] = null;
    return { container: nextContainer, playerInventory: nextPlayer };
  }

  // Swap only when the player item could go back into this container slot (always true).
  if (from.id === to.id && maxStackForItem(from.id) > 1) {
    const maxStack = maxStackForItem(from.id);
    const room = maxStack - to.quantity;
    if (room > 0) {
      const moveQty = Math.min(room, from.quantity);
      to.quantity += moveQty;
      from.quantity -= moveQty;
      if (from.quantity <= 0) nextContainer[fromSlot] = null;
      return { container: nextContainer, playerInventory: nextPlayer };
    }
  }

  nextContainer[fromSlot] = to;
  nextPlayer[toSlot] = from;
  return { container: nextContainer, playerInventory: nextPlayer };
}

/** Reorder items inside a container (no pocket/weapon slot rules). */
export function moveContainerSlot(
  container: Inventory,
  fromSlot: number,
  toSlot: number,
): Inventory {
  if (fromSlot === toSlot) return container;
  if (
    fromSlot < 0 ||
    toSlot < 0 ||
    fromSlot >= CONTAINER_INVENTORY_SLOTS ||
    toSlot >= CONTAINER_INVENTORY_SLOTS
  ) {
    return container;
  }

  const next = container.map((slot) => (slot ? { ...slot } : null));
  const from = next[fromSlot];
  if (!from || !getItemDefinition(from.id)) return container;

  const to = next[toSlot];
  if (!to) {
    next[toSlot] = from;
    next[fromSlot] = null;
    return next;
  }

  if (from.id === to.id && maxStackForItem(from.id) > 1) {
    const maxStack = maxStackForItem(from.id);
    const room = maxStack - to.quantity;
    if (room > 0) {
      const moveQty = Math.min(room, from.quantity);
      to.quantity += moveQty;
      from.quantity -= moveQty;
      if (from.quantity <= 0) next[fromSlot] = null;
      return next;
    }
  }

  next[fromSlot] = to;
  next[toSlot] = from;
  return next;
}

/** Loaded rounds per inventory slot index (string keys for JSON). */
export type WeaponMagazines = Record<string, number>;

export function parseWeaponMagazines(json: string): WeaponMagazines {
  try {
    const parsed = JSON.parse(json) as WeaponMagazines;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const result: WeaponMagazines = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "number" && value >= 0 && Number.isFinite(value)) {
        result[key] = Math.floor(value);
      }
    }
    return result;
  } catch {
    return {};
  }
}

export function serializeWeaponMagazines(magazines: WeaponMagazines) {
  return JSON.stringify(magazines);
}

export function getStoredMagazineRounds(
  magazines: WeaponMagazines,
  slotIndex: number,
): number | undefined {
  const value = magazines[String(slotIndex)];
  return value === undefined ? undefined : value;
}

export function setStoredMagazineRounds(
  magazines: WeaponMagazines,
  slotIndex: number,
  rounds: number,
): WeaponMagazines {
  return { ...magazines, [String(slotIndex)]: Math.max(0, Math.floor(rounds)) };
}

export function removeStoredMagazine(
  magazines: WeaponMagazines,
  slotIndex: number,
): WeaponMagazines {
  const next = { ...magazines };
  delete next[String(slotIndex)];
  return next;
}

/** Move a magazine entry when an inventory item changes slots (swap-aware). */
export function moveStoredMagazine(
  magazines: WeaponMagazines,
  fromSlot: number,
  toSlot: number,
): WeaponMagazines {
  if (fromSlot === toSlot) return magazines;
  const fromKey = String(fromSlot);
  const toKey = String(toSlot);
  const fromRounds = magazines[fromKey];
  const toRounds = magazines[toKey];
  const next = { ...magazines };
  delete next[fromKey];
  delete next[toKey];
  if (fromRounds !== undefined) next[toKey] = fromRounds;
  if (toRounds !== undefined) next[fromKey] = toRounds;
  return next;
}

/**
 * True when magazine keys look like legacy weapon-type indices (0–N) rather than
 * inventory slot indices.
 *
 * Slot-keyed format: a key may point at a slot that currently holds a weapon
 * (even when weapon type ≠ slot index, e.g. AK in slot 0 → {"0": 15}).
 * Legacy type-keyed format: keys are weapon types and do not address weapon slots.
 */
export function weaponMagazinesLookTypeKeyed(
  inventory: Inventory,
  magazines: WeaponMagazines,
  weaponTypeCount: number,
): boolean {
  const keys = Object.keys(magazines);
  if (keys.length === 0) return false;

  for (const key of keys) {
    const idx = Number(key);
    if (!Number.isInteger(idx) || idx < 0) return false;
    const slot = inventory[idx];
    // Any key that addresses a weapon slot is already the new per-slot format.
    if (slot && weaponIndexFromItemId(slot.id) >= 0) return false;
  }

  return keys.every((key) => {
    const idx = Number(key);
    return Number.isInteger(idx) && idx >= 0 && idx < weaponTypeCount;
  });
}

/**
 * Convert legacy type-keyed magazines to per-slot magazines.
 * Assigns each type's rounds to the first matching inventory slot.
 */
export function migrateTypeKeyedMagazinesToSlots(
  inventory: Inventory,
  magazines: WeaponMagazines,
): WeaponMagazines {
  const next: WeaponMagazines = {};
  const usedSlots = new Set<number>();
  for (const [key, rounds] of Object.entries(magazines)) {
    const weaponType = Number(key);
    if (!Number.isInteger(weaponType) || weaponType < 0) continue;
    for (let i = 0; i < inventory.length; i++) {
      if (usedSlots.has(i)) continue;
      const slot = inventory[i];
      if (!slot) continue;
      if (weaponIndexFromItemId(slot.id) === weaponType) {
        next[String(i)] = rounds;
        usedSlots.add(i);
        break;
      }
    }
  }
  return next;
}

export const INVENTORY_CATEGORIES = [
  "weapons",
  "ammunition",
  "medical",
  "crafting",
  "food",
  "drink",
] as const;

export const INVENTORY_CATEGORY_LABELS: Record<string, string> = {
  weapons: "Weapons",
  ammunition: "Ammunition",
  medical: "Medical",
  crafting: "Crafting",
  food: "Food",
  drink: "Drinks",
};

export type GroupedInventoryItem = {
  id: string;
  name: string;
  category: string;
  quantity: number;
};

export function groupInventoryByCategory(inventory: Inventory) {
  const groups = new Map<string, GroupedInventoryItem[]>();
  for (const category of INVENTORY_CATEGORIES) {
    groups.set(category, []);
  }
  for (const slot of inventory) {
    if (!slot) continue;
    const def = getItemDefinition(slot.id);
    if (!def) continue;
    const list = groups.get(def.category) ?? [];
    list.push({
      id: slot.id,
      name: def.name,
      category: def.category,
      quantity: slot.quantity,
    });
    groups.set(def.category, list);
  }
  return groups;
}
