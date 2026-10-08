import { RAW_MEAT_INFECTION_CHANCE } from "./infection.js";
import {
  BACKPACK_ROLLS,
  CONTAINER_LOOT,
  GUARD_POCKET,
  MAGAZINE_ROLLS,
  TRADER_GUARD_POCKET,
  TRADER_POCKET,
  ZOMBIE_POCKET,
  rollLootRolls,
  type LootRoll,
} from "./lootTables.js";
import { parentOfSub, type SubSkillId } from "./skills.js";
import {
  getBuildingAt,
  getSettlementType,
  mulberry32,
  SETTLEMENT_CELL_SIZE,
  xmur3,
} from "./worldgen.js";
import { ZOMBIE_SKIN_MAN11 } from "./sprites.js";

/** Fixed slot count — each occupied slot holds one stack. */
export const WEAPON_SLOT_COUNT = 2;
/** Usable pockets. Indices 10-13 stay reserved so older 12-pocket saves do not shift. */
export const POCKET_SLOT_COUNT = 8;
export const LEGACY_POCKET_SLOT_COUNT = 12;
/** Dedicated worn-clothing cell. The inventory dialog shows it on the gear row. */
export const CLOTHING_SLOT_COUNT = 1;
/** Index of the clothing equipment slot. Stays at 14 so watch, radio, map, and the backpack do not move. */
export const CLOTHING_SLOT_INDEX = WEAPON_SLOT_COUNT + LEGACY_POCKET_SLOT_COUNT;
export const WATCH_SLOT_COUNT = 1;
export const RADIO_SLOT_COUNT = 1;
export const MAP_SLOT_COUNT = 1;
/** Watch cell. The dialog shows it on the gear row beside the backpack. */
export const WATCH_SLOT_INDEX = CLOTHING_SLOT_INDEX + 1;
/** Radio cell. The dialog shows it on the gear row after the watch. */
export const RADIO_SLOT_INDEX = CLOTHING_SLOT_INDEX + 2;
/** Map cell sits on the second gear row. */
export const MAP_SLOT_INDEX = CLOTHING_SLOT_INDEX + 3;
/** Plain watch. Still tells time. New loot rolls a named watch instead. */
export const WATCH_ITEM_ID = "watch";

/**
 * Named watches, rarest first.
 * A container or shop that rolls `watch` picks one of these.
 * `weight` is that watch's share of those rolls (200 in total).
 * Luxury weights stay thin: those pieces are rare.
 * `value` is the banknote base price.
 * `xp` is temporary Bartering and Persuasion XP while the watch is worn.
 */
export const WATCH_LOOT = [
  { id: "luxury_gold_watch", name: "Luxury Gold Watch", value: 3000, xp: 3000, weight: 1 },
  { id: "luxury_silver_watch", name: "Luxury Silver Watch", value: 2000, xp: 2000, weight: 2 },
  { id: "luxury_watch", name: "Luxury Watch", value: 1400, xp: 1400, weight: 3 },
  { id: "gold_watch", name: "Gold Watch", value: 900, xp: 900, weight: 14 },
  { id: "gold_dress_watch", name: "Gold Dress Watch", value: 600, xp: 600, weight: 21 },
  { id: "digital_gold_watch", name: "Digital Gold Watch", value: 400, xp: 400, weight: 28 },
  { id: "old_gold_watch", name: "Old Gold Watch", value: 280, xp: 280, weight: 35 },
  { id: "silver_watch", name: "Silver Watch", value: 180, xp: 180, weight: 42 },
  { id: "old_silver_watch", name: "Old Silver Watch", value: 120, xp: 120, weight: 54 },
] as const;

const WATCH_LOOT_WEIGHT = WATCH_LOOT.reduce((sum, watch) => sum + watch.weight, 0);

/** One named watch. Cheaper pieces are more common. */
export function rollWatchVariant(rng: () => number): string {
  let roll = rng() * WATCH_LOOT_WEIGHT;
  for (const watch of WATCH_LOOT) {
    if (roll < watch.weight) return watch.id;
    roll -= watch.weight;
  }
  return WATCH_LOOT[WATCH_LOOT.length - 1]!.id;
}

export const RADIO_ITEM_ID = "handheld_radio";
/** Lowest channel a player can dial. 1 and 2 are listen-only world nets. */
export const RADIO_FREQ_MIN = 1;
export const RADIO_FREQ_MAX = 3000;
export const RADIO_FREQ_BIRCHPORT_GLOBAL = 1;
export const RADIO_FREQ_BIRCHPORT_TRADE = 2;
export const MAP_ITEM_ID = "map";
export const BASE_INVENTORY_SLOTS =
  WEAPON_SLOT_COUNT +
  LEGACY_POCKET_SLOT_COUNT +
  CLOTHING_SLOT_COUNT +
  WATCH_SLOT_COUNT +
  RADIO_SLOT_COUNT +
  MAP_SLOT_COUNT;
/**
 * Extra carrying pockets use indices BASE .. BASE+extra-1.
 * The backpack slot sits after the reserved extra-pocket range so older
 * saves (length <= 22) never collide with it.
 */
export const MAX_EXTRA_POCKET_SLOTS = 4;
export const BACKPACK_SLOT_COUNT = 1;
export const BACKPACK_SLOT_INDEX = BASE_INVENTORY_SLOTS + MAX_EXTRA_POCKET_SLOTS;
export const BACKPACK_STORAGE_START = BACKPACK_SLOT_INDEX + 1;
export const BACKPACK_FANNY_SLOTS = 8;
export const BACKPACK_UTILITY_SLOTS = 12;
export const BACKPACK_SMALL_SLOTS = 16;
export const BACKPACK_HUNTING_SLOTS = 20;
export const BACKPACK_LEATHER_SLOTS = 24;
export const BACKPACK_HIKING_SLOTS = 28;
/**
 * Ceiling for storage indices. Larger than the hiking pack so a save that
 * still has items past a reduced pack keeps those cells until they are emptied.
 */
export const MAX_BACKPACK_STORAGE_SLOTS = 32;
/**
 * Armor, neck, and both hands sit after the full backpack range so older
 * saves keep clothing, radio, map, and pack indices.
 */
export const ARMOR_SLOT_INDEX =
  BACKPACK_STORAGE_START + MAX_BACKPACK_STORAGE_SLOTS;
export const NECK_SLOT_INDEX = ARMOR_SLOT_INDEX + 1;
export const LEFT_HAND_SLOT_INDEX = ARMOR_SLOT_INDEX + 2;
export const RIGHT_HAND_SLOT_INDEX = ARMOR_SLOT_INDEX + 3;
export const BACKPACK_FANNY_ID = "backpack_fanny";
export const BACKPACK_UTILITY_ID = "backpack_utility";
export const BACKPACK_SMALL_ID = "backpack_small";
export const BACKPACK_HUNTING_ID = "backpack_hunting";
export const BACKPACK_LEATHER_ID = "backpack_leather";
export const BACKPACK_HIKING_ID = "backpack_hiking";
/** Previous black pack. Loads as a Small Backpack. */
export const LEGACY_BACKPACK_BLACK_ID = "backpack_black";
export const MAX_INVENTORY_SLOTS = RIGHT_HAND_SLOT_INDEX + 1;
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
  /** Lent by a quest giver and taken back when that job is turned in. */
  loaner?: boolean;
  /**
   * Items sealed inside a backpack that is not being worn.
   * While the pack is worn, those items live in the backpack storage slots
   * and this field stays empty so they are not saved twice.
   * Null cells keep their positions. A pack inside a pack keeps its own contents.
   */
  contents?: (InventoryEntry | null)[];
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
  if (entry.loaner === true) next.loaner = true;
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

/** Time to read a weapon blueprint. The sheet is consumed when this finishes. */
export const BLUEPRINT_LEARN_MS = 60_000;

/** Time to read a skill magazine. The issue is consumed when this finishes. */
export const MAGAZINE_READ_MS = 30_000;

/**
 * Skill magazines the player can find. Item ids match UI_magazine_<skill>.png.
 * `skill` is the subskill a finished read trains, on top of Reading.
 * `also` lists extra subskills that receive a smaller grant.
 */
export const SKILL_MAGAZINES = [
  { itemId: "magazine_melee", name: "Octagon Impact Magazine", skill: "melee", also: ["fitness"] },
  { itemId: "magazine_harvesting", name: "Garden Growth Magazine", skill: "harvesting", also: [] },
  { itemId: "magazine_carrying", name: "Ultra Hiker Magazine", skill: "carrying", also: ["fitness"] },
  { itemId: "magazine_construction", name: "Build It Yourself Magazine", skill: "construction", also: ["fitness"] },
  { itemId: "magazine_fitness", name: "Ultra Runner Magazine", skill: "fitness", also: ["recovery"] },
  { itemId: "magazine_immunity", name: "Healthy Living Magazine", skill: "immunity", also: ["cooking"] },
  { itemId: "magazine_recovery", name: "Slim & Shred Magazine", skill: "recovery", also: ["cooking"] },
  { itemId: "magazine_accuracy", name: "Tactical Trades Magazine", skill: "accuracy", also: ["crafting"] },
  { itemId: "magazine_crafting", name: "Handy Crafts Magazine", skill: "crafting", also: [] },
  { itemId: "magazine_scavenging", name: "Metal Detector Magazine", skill: "scavenging", also: ["stealth"] },
  { itemId: "magazine_stealth", name: "Wildlife Harvest Magazine", skill: "stealth", also: ["scavenging"] },
  { itemId: "magazine_cooking", name: "The Pixel Kitchen Magazine", skill: "cooking", also: ["recovery"] },
  { itemId: "magazine_medicine", name: "First Aid Magazine", skill: "medicine", also: ["recovery", "immunity"] },
  { itemId: "magazine_reading", name: "The Book Club Magazine", skill: "reading", also: [] },
  { itemId: "magazine_persuasion", name: "Love Life Magazine", skill: "persuasion", also: [] },
  { itemId: "magazine_bartering", name: "Negotiation Power Magazine", skill: "bartering", also: [] },
  { itemId: "magazine_lockpicking", name: "The Locksmith Magazine", skill: "lockpicking", also: ["stealth"] },
] as const satisfies readonly {
  itemId: string;
  name: string;
  skill: SubSkillId;
  also: readonly SubSkillId[];
}[];

export function isSkillMagazine(itemId: string): boolean {
  return skillMagazineSubSkill(itemId) != null;
}

/** Subskill trained by this magazine, or null when it is not one. */
export function skillMagazineSubSkill(itemId: string): SubSkillId | null {
  if (!itemId.startsWith("magazine_")) return null;
  const skill = itemId.slice("magazine_".length) as SubSkillId;
  if (!parentOfSub(skill)) return null;
  for (const magazine of SKILL_MAGAZINES) {
    if (magazine.itemId === itemId) return magazine.skill;
  }
  return null;
}

/** Extra subskills a finished magazine trains, besides its cover skill. */
export function skillMagazineBonusSkills(itemId: string): readonly SubSkillId[] {
  for (const magazine of SKILL_MAGAZINES) {
    if (magazine.itemId === itemId) return magazine.also;
  }
  return [];
}

/**
 * Weapon blueprints are not loot. Learning one unlocks that craft recipe.
 * recipeId matches the workbench recipe in crafting.ts.
 */
export const WEAPON_BLUEPRINTS = [
  { itemId: "blueprint_pistol", name: "Pistol Blueprint", recipeId: "craft_pistol" },
  { itemId: "blueprint_revolver", name: "Revolver Blueprint", recipeId: "craft_revolver" },
  { itemId: "blueprint_shotgun", name: "Shotgun Blueprint", recipeId: "craft_shotgun" },
  {
    itemId: "blueprint_hunting_rifle",
    name: "Hunting Rifle Blueprint",
    recipeId: "craft_hunting_rifle",
  },
  { itemId: "blueprint_ak", name: "AK Blueprint", recipeId: "craft_ak" },
  { itemId: "blueprint_m4", name: "M4 Blueprint", recipeId: "craft_m4" },
] as const;

export function weaponBlueprintRecipeId(itemId: string): string | undefined {
  for (const blueprint of WEAPON_BLUEPRINTS) {
    if (blueprint.itemId === itemId) return blueprint.recipeId;
  }
  return undefined;
}

export function isWeaponBlueprint(itemId: string): boolean {
  return weaponBlueprintRecipeId(itemId) !== undefined;
}

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
  ...WATCH_LOOT.map((watch) => ({
    id: watch.id,
    name: watch.name,
    category: "equipment",
    stackable: false,
    weight: 0.1,
  })),
  {
    id: RADIO_ITEM_ID,
    name: "Handheld Radio",
    category: "equipment",
    stackable: false,
    weight: 0.4,
  },
  {
    id: BACKPACK_FANNY_ID,
    name: "Fanny Pack",
    category: "backpack",
    stackable: false,
    weight: 0.25,
  },
  {
    id: BACKPACK_UTILITY_ID,
    name: "Utility Pouch",
    category: "backpack",
    stackable: false,
    weight: 0.4,
  },
  {
    id: BACKPACK_SMALL_ID,
    name: "Small Backpack",
    category: "backpack",
    stackable: false,
    weight: 0.7,
  },
  {
    id: BACKPACK_HUNTING_ID,
    name: "Hunting Backpack",
    category: "backpack",
    stackable: false,
    weight: 1.0,
  },
  {
    id: BACKPACK_LEATHER_ID,
    name: "Leather Backpack",
    category: "backpack",
    stackable: false,
    weight: 1.2,
  },
  {
    id: BACKPACK_HIKING_ID,
    name: "Hiking Backpack",
    category: "backpack",
    stackable: false,
    weight: 1.5,
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
    stackable: false,
    weight: 0.05,
    consumeDurationMs: 2_000,
    restoreHunger: 5,
    restoreThirst: 5,
    /** One bottle. Each use is +1 HP every 10s for 300s (30 HP). */
    maxDurability: 10,
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
  ...WEAPON_BLUEPRINTS.map((blueprint) => ({
    id: blueprint.itemId,
    name: blueprint.name,
    category: "blueprint",
    stackable: true,
    weight: 0.05,
    consumeDurationMs: BLUEPRINT_LEARN_MS,
  })),
  ...SKILL_MAGAZINES.map((magazine) => ({
    id: magazine.itemId,
    name: magazine.name,
    category: "magazine",
    stackable: true,
    weight: 0.1,
    consumeDurationMs: MAGAZINE_READ_MS,
  })),
  /** Fuel for Fireplace1 — looted from felled trees. */
  { id: "wood", name: "Wood", category: "crafting", stackable: false, weight: 0.5 },
  { id: "banknote", name: "Banknote", category: "junk", stackable: true, weight: 0.01 },
  { id: "dogtag", name: "Dog Tag", category: "junk", stackable: true, weight: 0.02 },
  { id: "lighter", name: "Lighter", category: "junk", stackable: false, weight: 0.05, maxDurability: 20 },
  { id: "lockpick", name: "Lockpick Kit", category: "junk", stackable: false, weight: 0.05, maxDurability: 5 },
  { id: "blue_cigarettes", name: "Cigarettes (Blue)", category: "junk", stackable: true, weight: 0.05 },
  { id: "gold_chain", name: "Gold Chain", category: "junk", stackable: true, weight: 0.1 },
  { id: "gold_earrings", name: "Gold Earrings", category: "junk", stackable: true, weight: 0.05 },
  {
    id: "clarks_earrings",
    name: "Anniversary Earrings",
    category: "junk",
    stackable: false,
    weight: 0.05,
  },
  { id: "gold_ring", name: "Gold Ring", category: "junk", stackable: true, weight: 0.05 },
  {
    id: "caravan_manifest",
    name: "Caravan Manifest",
    category: "junk",
    stackable: false,
    weight: 0.05,
  },
  {
    id: "wagon_note",
    name: "Caravan Note",
    category: "junk",
    stackable: false,
    weight: 0.02,
  },
  {
    id: "supply_list",
    name: "Supply List",
    category: "junk",
    stackable: false,
    weight: 0.02,
  },
  {
    id: "coleman_note",
    name: "Note for Coleman",
    category: "junk",
    stackable: false,
    weight: 0.02,
  },
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
  if (id === LEGACY_BACKPACK_BLACK_ID) return BACKPACK_SMALL_ID;
  return id;
}

export function getItemDefinition(id: string) {
  return ITEM_BY_ID.get(canonicalItemId(id));
}

/** Clark's anniversary pair. Not ordinary gold earrings, and not for sale. */
export const CLARKS_EARRINGS_ITEM_ID = "clarks_earrings";
/** Sergeant Coleman's note. Turn it in to Captain Davis. Not for sale. */
export const COLEMAN_NOTE_ITEM_ID = "coleman_note";
/** Page from a caravan that came up short. Kevin wants it back. Not for sale. */
export const CARAVAN_MANIFEST_ITEM_ID = "caravan_manifest";
/** Last word from a caravan that stopped answering the radio. Not for sale. */
export const WAGON_NOTE_ITEM_ID = "wagon_note";
/** Militia supply order left off the radio. Kevin wants the page. Not for sale. */
export const SUPPLY_LIST_ITEM_ID = "supply_list";

export function isQuestKeepsakeItem(itemId: string | undefined): boolean {
  return (
    itemId === CLARKS_EARRINGS_ITEM_ID ||
    itemId === CARAVAN_MANIFEST_ITEM_ID ||
    itemId === WAGON_NOTE_ITEM_ID ||
    itemId === SUPPLY_LIST_ITEM_ID ||
    itemId === COLEMAN_NOTE_ITEM_ID
  );
}

/** True when this furniture type can roll container loot. */
export function isLootContainerType(objectType: string): boolean {
  return Object.prototype.hasOwnProperty.call(CONTAINER_LOOT, objectType);
}

export function isConsumable(itemId: string): boolean {
  const def = ITEM_BY_ID.get(itemId);
  return !!def?.consumeDurationMs;
}

/** Synced on the player while a consume channel is active. */
export type ConsumeAction = "eat" | "drink" | "bandage" | "use" | "learn" | "read";

export const CONSUME_ACTION_LABELS: Record<ConsumeAction, string> = {
  eat: "Eating",
  drink: "Drinking",
  bandage: "Bandaging",
  use: "Using",
  learn: "Learning",
  read: "Reading",
};

/** Caption kind shown above the player while consuming this item. */
export function getConsumeAction(itemId: string): ConsumeAction {
  if (isSkillMagazine(itemId)) return "read";
  if (isWeaponBlueprint(itemId)) return "learn";
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
  if (isWeaponBlueprint(itemId) || isSkillMagazine(itemId)) return true;

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
  if (def.category === "backpack") return 1;
  if (itemId === "wood") return 1;
  // Use-count durable items are always unique instances.
  if ((def.maxDurability ?? 0) > 0) return 1;
  if (itemId === "banknote") return MAX_BANKNOTE_STACK;
  if (def.category === "ammunition" || itemId === "screws" || itemId === "bolts") {
    return MAX_BULK_ITEM_STACK;
  }
  return MAX_ITEM_STACK;
}

/** How many of `itemId` fit in this slot. Neck and hands hold one piece. */
export function slotStackLimit(itemId: string, slotIndex: number): number {
  if (isJewelrySlot(slotIndex)) {
    if (isNeckSlot(slotIndex) && isNeckItem(itemId)) return 1;
    if (isHandSlot(slotIndex) && isRingItem(itemId)) return 1;
    return 0;
  }
  return maxStackForItem(itemId);
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
  | "rarity"
  | "condition"
  | "durability"
  | "wetness"
  | "radioFreq"
  | "contents"
  | "loaner"
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
  if (entry.loaner === true) meta.loaner = true;
  if (entry.contents?.length) meta.contents = entry.contents;
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

const WATCH_ITEM_IDS = new Set<string>([
  WATCH_ITEM_ID,
  ...WATCH_LOOT.map((watch) => watch.id),
]);

export function isWatchItem(itemId: string): boolean {
  return WATCH_ITEM_IDS.has(canonicalItemId(itemId));
}

/**
 * Replace a `watch` loot token with named watches.
 * Each unit rolls on its own, so three watches can be three different pieces.
 */
export function expandWatchLoot<T extends { id: string; quantity: number }>(
  entries: readonly T[],
  rng: () => number,
): T[] {
  const out: T[] = [];
  for (const entry of entries) {
    if (canonicalItemId(entry.id) !== WATCH_ITEM_ID) {
      out.push(entry);
      continue;
    }
    const qty = Math.max(0, Math.floor(entry.quantity));
    for (let i = 0; i < qty; i++) {
      out.push({ ...entry, id: rollWatchVariant(rng), quantity: 1 });
    }
  }
  return out;
}

export function isRadioItem(itemId: string): boolean {
  return canonicalItemId(itemId) === RADIO_ITEM_ID;
}

export function isMapItem(itemId: string): boolean {
  return canonicalItemId(itemId) === MAP_ITEM_ID;
}

/** Storage cells granted while this backpack is worn. 0 if it is not a pack. */
export function backpackStorageCount(itemId: string | null | undefined): number {
  switch (canonicalItemId(itemId ?? "")) {
    case BACKPACK_FANNY_ID:
      return BACKPACK_FANNY_SLOTS;
    case BACKPACK_UTILITY_ID:
      return BACKPACK_UTILITY_SLOTS;
    case BACKPACK_SMALL_ID:
      return BACKPACK_SMALL_SLOTS;
    case BACKPACK_HUNTING_ID:
      return BACKPACK_HUNTING_SLOTS;
    case BACKPACK_LEATHER_ID:
      return BACKPACK_LEATHER_SLOTS;
    case BACKPACK_HIKING_ID:
      return BACKPACK_HIKING_SLOTS;
    default:
      return 0;
  }
}

export function isBackpackItem(itemId: string): boolean {
  return backpackStorageCount(itemId) > 0;
}

export function equippedBackpackStorageCount(inventory: Inventory): number {
  const worn = inventory[BACKPACK_SLOT_INDEX];
  if (!worn || !isBackpackItem(worn.id)) return 0;
  return backpackStorageCount(worn.id);
}

/**
 * Array length that includes worn backpack storage and the gear slots
 * (armor, neck, hands) that sit after it.
 */
export function playerInventoryLength(backpackSlots: number): number {
  const pack = Math.max(
    0,
    Math.min(MAX_BACKPACK_STORAGE_SLOTS, Math.floor(backpackSlots) || 0),
  );
  return Math.max(BACKPACK_STORAGE_START + pack, MAX_INVENTORY_SLOTS);
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

export function isArmorSlot(slotIndex: number): boolean {
  return slotIndex === ARMOR_SLOT_INDEX;
}

export function isNeckSlot(slotIndex: number): boolean {
  return slotIndex === NECK_SLOT_INDEX;
}

export function isLeftHandSlot(slotIndex: number): boolean {
  return slotIndex === LEFT_HAND_SLOT_INDEX;
}

export function isRightHandSlot(slotIndex: number): boolean {
  return slotIndex === RIGHT_HAND_SLOT_INDEX;
}

export function isHandSlot(slotIndex: number): boolean {
  return isLeftHandSlot(slotIndex) || isRightHandSlot(slotIndex);
}

export function isJewelrySlot(slotIndex: number): boolean {
  return isNeckSlot(slotIndex) || isHandSlot(slotIndex);
}

const NECK_ITEM_IDS = new Set(["gold_chain", "silver_chain", "dogtag"]);
const RING_ITEM_IDS = new Set(["gold_ring", "silver_ring"]);

export function isNeckItem(itemId: string): boolean {
  return NECK_ITEM_IDS.has(itemId);
}

export function isRingItem(itemId: string): boolean {
  return RING_ITEM_IDS.has(itemId);
}

/**
 * Temporary Bartering and Persuasion XP while this piece is worn.
 * Dog tags fit the neck and grant none. The plain watch tells time and grants none.
 */
export const JEWELRY_SKILL_XP: Readonly<Record<string, number>> = {
  gold_chain: 1000,
  silver_chain: 500,
  gold_ring: 300,
  silver_ring: 150,
  ...Object.fromEntries(WATCH_LOOT.map((watch) => [watch.id, watch.xp])),
};

export function jewelrySkillXpForItem(itemId: string): number {
  return JEWELRY_SKILL_XP[itemId] ?? 0;
}

/** Bartering and Persuasion XP from a worn neck piece, both rings, and a watch. */
export function equippedJewelrySkillXp(inventory: Inventory): number {
  let xp = 0;
  const neck = inventory[NECK_SLOT_INDEX];
  if (neck && isNeckItem(neck.id)) xp += jewelrySkillXpForItem(neck.id);
  const left = inventory[LEFT_HAND_SLOT_INDEX];
  if (left && isRingItem(left.id)) xp += jewelrySkillXpForItem(left.id);
  const right = inventory[RIGHT_HAND_SLOT_INDEX];
  if (right && isRingItem(right.id)) xp += jewelrySkillXpForItem(right.id);
  const watch = inventory[WATCH_SLOT_INDEX];
  if (watch && isWatchItem(watch.id)) xp += jewelrySkillXpForItem(watch.id);
  return xp;
}

/** Time and skill text for a watch or jewelry piece. Empty when neither applies. */
export function wornGearEffectHint(itemId: string): string {
  const parts: string[] = [];
  if (isWatchItem(itemId)) parts.push("shows the time while worn");
  const xp = jewelrySkillXpForItem(itemId);
  if (xp > 0) parts.push(`+${xp} Bartering and Persuasion XP while worn`);
  return parts.join(" · ");
}

export function isBackpackSlot(slotIndex: number): boolean {
  return slotIndex === BACKPACK_SLOT_INDEX;
}

export function isBackpackStorageIndex(slotIndex: number): boolean {
  return (
    slotIndex >= BACKPACK_STORAGE_START &&
    slotIndex < BACKPACK_STORAGE_START + MAX_BACKPACK_STORAGE_SLOTS
  );
}

/** Indices 10-13. Old 12-pocket saves may still hold items here until they are moved. */
export function isRetiredPocketSlot(slotIndex: number): boolean {
  return (
    slotIndex >= WEAPON_SLOT_COUNT + POCKET_SLOT_COUNT &&
    slotIndex < CLOTHING_SLOT_INDEX
  );
}

export function isPocketSlot(slotIndex: number): boolean {
  return (
    (slotIndex >= WEAPON_SLOT_COUNT &&
      slotIndex < WEAPON_SLOT_COUNT + POCKET_SLOT_COUNT) ||
    isRetiredPocketSlot(slotIndex) ||
    (slotIndex >= BASE_INVENTORY_SLOTS && slotIndex < BACKPACK_SLOT_INDEX)
  );
}

/** Occupied retired pocket cells, so those items stay visible. */
export function retiredPocketIndices(inventory: Inventory): number[] {
  const indices: number[] = [];
  for (
    let i = WEAPON_SLOT_COUNT + POCKET_SLOT_COUNT;
    i < CLOTHING_SLOT_INDEX;
    i++
  ) {
    if (inventory[i]) indices.push(i);
  }
  return indices;
}

export type SlotAccess = {
  extraPockets: number;
  backpackSlots: number;
};

const extraPocketTag = new WeakMap<Inventory, number>();

function clampExtraPockets(extraPockets: number): number {
  if (!Number.isFinite(extraPockets)) return 0;
  return Math.max(0, Math.min(MAX_EXTRA_POCKET_SLOTS, Math.floor(extraPockets)));
}

/** Remember how many carrying-skill pockets this array may use. JSON drops the tag. */
export function rememberExtraPockets(inventory: Inventory, extraPockets: number): Inventory {
  extraPocketTag.set(inventory, clampExtraPockets(extraPockets));
  return inventory;
}

/** Deep copy, including items sealed inside a backpack. */
export function cloneInventoryEntry(entry: InventoryEntry, depth = 0): InventoryEntry {
  return makeInventoryEntry(
    entry.id,
    entry.quantity,
    entry.magazineRounds,
    inventoryEntryMeta(entry),
    depth,
  );
}

export function cloneInventory(inventory: Inventory): Inventory {
  const next = inventory.map((slot) => (slot ? cloneInventoryEntry(slot) : null));
  const extra = extraPocketTag.get(inventory);
  if (extra != null) extraPocketTag.set(next, extra);
  return next;
}

function inferExtraPockets(inventory: Inventory): number {
  const tagged = extraPocketTag.get(inventory);
  if (tagged != null) return tagged;
  if (inventory.length <= BACKPACK_SLOT_INDEX) {
    return clampExtraPockets(inventory.length - BASE_INVENTORY_SLOTS);
  }
  return 0;
}

export function inventorySlotAccess(
  inventory: Inventory,
  extraPockets?: number,
): SlotAccess {
  return {
    extraPockets: clampExtraPockets(extraPockets ?? inferExtraPockets(inventory)),
    backpackSlots: equippedBackpackStorageCount(inventory),
  };
}

function slotUnlocked(slotIndex: number, access: SlotAccess): boolean {
  if (isRetiredPocketSlot(slotIndex)) return false;
  if (slotIndex < BASE_INVENTORY_SLOTS) return true;
  if (slotIndex < BACKPACK_SLOT_INDEX) {
    return slotIndex < BASE_INVENTORY_SLOTS + access.extraPockets;
  }
  if (slotIndex === BACKPACK_SLOT_INDEX) return true;
  if (isArmorSlot(slotIndex) || isJewelrySlot(slotIndex)) return true;
  return (
    slotIndex >= BACKPACK_STORAGE_START &&
    slotIndex < BACKPACK_STORAGE_START + access.backpackSlots
  );
}

export function itemFitsInSlot(
  itemId: string,
  slotIndex: number,
  access?: SlotAccess,
): boolean {
  if (slotIndex < 0 || slotIndex >= MAX_INVENTORY_SLOTS) return false;
  const limits = access ?? {
    extraPockets: MAX_EXTRA_POCKET_SLOTS,
    backpackSlots: 0,
  };
  if (!slotUnlocked(slotIndex, limits)) return false;
  if (isWeaponSlot(slotIndex)) return isWeaponItem(itemId);
  if (isClothingSlot(slotIndex)) return isClothingItem(itemId);
  if (isWatchSlot(slotIndex)) return isWatchItem(itemId);
  if (isRadioSlot(slotIndex)) return isRadioItem(itemId);
  if (isMapSlot(slotIndex)) return isMapItem(itemId);
  if (isArmorSlot(slotIndex)) return false;
  if (isNeckSlot(slotIndex)) return isNeckItem(itemId);
  if (isHandSlot(slotIndex)) return isRingItem(itemId);
  if (isBackpackSlot(slotIndex)) return isBackpackItem(itemId);
  // Long guns skip pockets. A worn backpack can still carry one.
  if (isHotbarOnlyItem(itemId)) return isBackpackStorageIndex(slotIndex);
  return true;
}

/** Pockets, unlocked extra pockets, and open backpack storage. */
export function isStowSlot(
  slotIndex: number,
  inventory: Inventory,
  extraPockets?: number,
): boolean {
  const access = inventorySlotAccess(inventory, extraPockets);
  if (
    slotIndex >= WEAPON_SLOT_COUNT &&
    slotIndex < WEAPON_SLOT_COUNT + POCKET_SLOT_COUNT
  ) {
    return true;
  }
  if (isRetiredPocketSlot(slotIndex)) return !!inventory[slotIndex];
  if (slotIndex >= BASE_INVENTORY_SLOTS && slotIndex < BACKPACK_SLOT_INDEX) {
    if (slotIndex < BASE_INVENTORY_SLOTS + access.extraPockets) return true;
    // Carrying no longer unlocks these. Items already here stay movable.
    return !!inventory[slotIndex];
  }
  return (
    slotIndex >= BACKPACK_STORAGE_START &&
    slotIndex < BACKPACK_STORAGE_START + access.backpackSlots
  );
}

export function firstEmptyStowSlot(
  inventory: Inventory,
  extraPockets?: number,
): number {
  const access = inventorySlotAccess(inventory, extraPockets);
  for (
    let i = WEAPON_SLOT_COUNT;
    i < WEAPON_SLOT_COUNT + POCKET_SLOT_COUNT;
    i++
  ) {
    if (!inventory[i]) return i;
  }
  for (let i = 0; i < access.extraPockets; i++) {
    const idx = BASE_INVENTORY_SLOTS + i;
    if (!inventory[idx]) return idx;
  }
  for (let i = 0; i < access.backpackSlots; i++) {
    const idx = BACKPACK_STORAGE_START + i;
    if (!inventory[idx]) return idx;
  }
  return -1;
}

export function backpackStorageHasItems(inventory: Inventory): boolean {
  const end = Math.min(
    inventory.length,
    BACKPACK_STORAGE_START + MAX_BACKPACK_STORAGE_SLOTS,
  );
  for (let i = BACKPACK_STORAGE_START; i < end; i++) {
    if (inventory[i]) return true;
  }
  return false;
}

/** True when a backpack entry already has sealed items inside it. */
export function backpackContentsHaveItems(
  entry: { contents?: readonly ({ quantity: number } | null)[] } | null | undefined,
): boolean {
  return !!entry?.contents?.some((cell) => !!cell && cell.quantity > 0);
}

/** How many stacks are sealed inside this backpack entry. */
export function sealedBackpackStackCount(
  entry: InventoryEntry | null | undefined,
): number {
  if (!entry?.contents) return 0;
  let count = 0;
  for (const cell of entry.contents) {
    if (cell && cell.quantity > 0) count += 1;
  }
  return count;
}

/**
 * True when this backpack still holds items, either in the worn storage
 * slots or sealed on the entry itself.
 */
export function backpackHoldsItems(inventory: Inventory, slotIndex: number): boolean {
  const slot = inventory[slotIndex];
  if (!slot || !isBackpackItem(slot.id)) return false;
  if (slotIndex === BACKPACK_SLOT_INDEX && backpackStorageHasItems(inventory)) {
    return true;
  }
  return backpackContentsHaveItems(slot);
}

/**
 * A backpack that still holds items can be worn or dropped on the floor.
 * It cannot be placed in a pocket or inside another pack.
 */
export function loadedBackpackStowBlocked(
  entry: { contents?: readonly ({ quantity: number } | null)[] } | null | undefined,
  destSlot: number,
): boolean {
  if (!backpackContentsHaveItems(entry)) return false;
  return isPocketSlot(destSlot) || isBackpackStorageIndex(destSlot);
}

function replaceMagazines(target: WeaponMagazines, next: WeaponMagazines): void {
  for (const key of Object.keys(target)) delete target[key];
  for (const [key, value] of Object.entries(next)) target[key] = value;
}

/**
 * Copy worn-pack storage onto the backpack entry and clear those slots.
 * Chambered rounds move onto the packed guns and leave the magazine map.
 * Mutates both arguments. No-op when storage is already empty.
 */
function sealWornPack(inventory: Inventory, magazines: WeaponMagazines): void {
  const pack = inventory[BACKPACK_SLOT_INDEX];
  if (!pack || !isBackpackItem(pack.id) || !backpackStorageHasItems(inventory)) return;
  const contents: (InventoryEntry | null)[] = [];
  const end = Math.min(
    inventory.length,
    BACKPACK_STORAGE_START + MAX_BACKPACK_STORAGE_SLOTS,
  );
  for (let i = BACKPACK_STORAGE_START; i < end; i++) {
    const rel = i - BACKPACK_STORAGE_START;
    const slot = inventory[i];
    if (!slot) {
      contents[rel] = null;
      continue;
    }
    const copy = cloneInventoryEntry(slot);
    if (getAmmoTypeForWeapon(copy.id)) {
      const rounds = normalizedMagazineRounds(
        copy.id,
        magazines[String(i)] ?? copy.magazineRounds,
      );
      if (rounds != null) copy.magazineRounds = rounds;
      else delete copy.magazineRounds;
      delete magazines[String(i)];
    }
    contents[rel] = copy;
    inventory[i] = null;
  }
  while (contents.length > 0 && !contents[contents.length - 1]) contents.pop();
  if (contents.some((cell) => cell)) pack.contents = contents;
}

/**
 * If the worn pack has sealed items and the storage slots are empty, pour
 * them back into those slots. Live storage wins when both are occupied.
 */
function unpackWornPack(
  inventory: Inventory,
  magazines: WeaponMagazines,
  keepEntryRounds: boolean,
): void {
  const pack = inventory[BACKPACK_SLOT_INDEX];
  if (!pack || !isBackpackItem(pack.id) || !pack.contents?.length) return;
  if (backpackStorageHasItems(inventory)) {
    delete pack.contents;
    return;
  }
  const contents = pack.contents;
  delete pack.contents;
  for (let i = 0; i < contents.length && i < MAX_BACKPACK_STORAGE_SLOTS; i++) {
    const cell = contents[i];
    if (!cell) continue;
    const idx = BACKPACK_STORAGE_START + i;
    while (inventory.length <= idx) inventory.push(null);
    const copy = cloneInventoryEntry(cell);
    const rounds = normalizedMagazineRounds(copy.id, copy.magazineRounds);
    if (keepEntryRounds) {
      if (rounds != null) copy.magazineRounds = rounds;
      else delete copy.magazineRounds;
    } else {
      delete copy.magazineRounds;
      if (rounds != null) magazines[String(idx)] = rounds;
      else if (getAmmoTypeForWeapon(copy.id)) delete magazines[String(idx)];
    }
    inventory[idx] = copy;
  }
}

function packMoveBlocked(fromSlot: number, toSlot: number): boolean {
  if (fromSlot === toSlot) return false;
  const touchesWorn =
    fromSlot === BACKPACK_SLOT_INDEX || toSlot === BACKPACK_SLOT_INDEX;
  const touchesStorage =
    isBackpackStorageIndex(fromSlot) || isBackpackStorageIndex(toSlot);
  return touchesWorn && touchesStorage;
}

/**
 * Open a worn backpack that was saved with sealed contents. Storage slots
 * stay authoritative when they already hold items. Chambered rounds stay on
 * the storage entries until `pullStorageMagazineRounds` copies them.
 */
export function releaseWornBackpack(inventory: Inventory): Inventory {
  const worn = inventory[BACKPACK_SLOT_INDEX];
  if (!worn || !isBackpackItem(worn.id) || !worn.contents?.length) return inventory;
  if (backpackStorageHasItems(inventory)) {
    delete worn.contents;
    return inventory;
  }
  const next = inventory.slice();
  const extra = extraPocketTag.get(inventory);
  const pack = cloneInventoryEntry(worn);
  delete pack.contents;
  next[BACKPACK_SLOT_INDEX] = pack;
  for (let i = 0; i < worn.contents.length && i < MAX_BACKPACK_STORAGE_SLOTS; i++) {
    const cell = worn.contents[i];
    if (!cell) continue;
    const idx = BACKPACK_STORAGE_START + i;
    while (next.length <= idx) next.push(null);
    next[idx] = cloneInventoryEntry(cell);
  }
  if (extra != null) extraPocketTag.set(next, extra);
  return next;
}

/**
 * Seal the worn backpack so a drop or a corpse keeps its items.
 * Mutates `magazines` (storage guns leave that map and ride on the entry).
 */
export function packWornBackpack(
  inventory: Inventory,
  magazines: WeaponMagazines,
): Inventory {
  const next = cloneInventory(inventory);
  sealWornPack(next, magazines);
  return next;
}

/**
 * Move chambered rounds off backpack storage entries into the magazine map.
 * Player saves keep those rounds in `weaponMagazinesJson`, not on the slot.
 */
export function pullStorageMagazineRounds(
  inventory: Inventory,
  magazines: WeaponMagazines,
): { magazines: WeaponMagazines; changed: boolean } {
  let changed = false;
  const next: WeaponMagazines = { ...magazines };
  const end = Math.min(
    inventory.length,
    BACKPACK_STORAGE_START + MAX_BACKPACK_STORAGE_SLOTS,
  );
  for (let i = BACKPACK_STORAGE_START; i < end; i++) {
    const slot = inventory[i];
    if (!slot || typeof slot.magazineRounds !== "number") continue;
    const rounds = normalizedMagazineRounds(slot.id, slot.magazineRounds);
    delete slot.magazineRounds;
    changed = true;
    const key = String(i);
    if (rounds != null) next[key] = rounds;
    else delete next[key];
  }
  return { magazines: changed ? next : magazines, changed };
}

function commitPlayerPack(
  original: Inventory,
  next: Inventory,
  magWork: WeaponMagazines,
  magazines: WeaponMagazines | undefined,
): Inventory | null {
  unpackWornPack(next, magWork, magazines == null);
  if (backpackOverflowWorsened(original, next)) return null;
  if (magazines) replaceMagazines(magazines, magWork);
  return next;
}

function finishPackMove(
  original: Inventory,
  next: Inventory,
  magWork: WeaponMagazines,
  magazines: WeaponMagazines | undefined,
): Inventory {
  return commitPlayerPack(original, next, magWork, magazines) ?? original;
}

/** True when every stored item sits inside the worn pack's capacity. */
export function backpackStorageContained(inventory: Inventory): boolean {
  const cap = equippedBackpackStorageCount(inventory);
  const end = Math.min(
    inventory.length,
    BACKPACK_STORAGE_START + MAX_BACKPACK_STORAGE_SLOTS,
  );
  for (let i = BACKPACK_STORAGE_START + cap; i < end; i++) {
    if (inventory[i]) return false;
  }
  return true;
}

/**
 * Cells to draw under Pockets. Official capacity, plus any older cells that
 * still hold items after a pack was reduced.
 */
export function shownBackpackStorageCount(inventory: Inventory): number {
  const cap = equippedBackpackStorageCount(inventory);
  let n = cap;
  const end = Math.min(
    inventory.length,
    BACKPACK_STORAGE_START + MAX_BACKPACK_STORAGE_SLOTS,
  );
  for (let i = BACKPACK_STORAGE_START + cap; i < end; i++) {
    if (inventory[i]) n = i - BACKPACK_STORAGE_START + 1;
  }
  return n;
}

/**
 * True when `after` strands items the worn pack no longer covers.
 * Pulling an already-stranded item out is allowed.
 */
export function backpackOverflowWorsened(before: Inventory, after: Inventory): boolean {
  const newCap = equippedBackpackStorageCount(after);
  const oldCap = equippedBackpackStorageCount(before);
  const end = Math.min(
    Math.max(before.length, after.length),
    BACKPACK_STORAGE_START + MAX_BACKPACK_STORAGE_SLOTS,
  );
  for (let i = BACKPACK_STORAGE_START + newCap; i < end; i++) {
    const next = after[i];
    if (!next) continue;
    if (i < BACKPACK_STORAGE_START + oldCap) return true;
    const prev = before[i];
    if (!prev || prev.id !== next.id || next.quantity > prev.quantity) return true;
  }
  return false;
}

/** How many extra pocket cells to draw. Occupied cells stay visible. */
export function shownExtraPockets(inventory: Inventory, unlocked: number): number {
  let n = clampExtraPockets(unlocked);
  for (let i = 0; i < MAX_EXTRA_POCKET_SLOTS; i++) {
    if (inventory[BASE_INVENTORY_SLOTS + i]) n = Math.max(n, i + 1);
  }
  return n;
}

export function fitPlayerInventoryLength(inventory: Inventory): Inventory {
  const want = playerInventoryLength(equippedBackpackStorageCount(inventory));
  if (inventory.length === want) return inventory;
  const extra = extraPocketTag.get(inventory);
  if (inventory.length > want) {
    for (let i = want; i < inventory.length; i++) {
      if (inventory[i]) return inventory;
    }
    const next = inventory.slice(0, want);
    if (extra != null) extraPocketTag.set(next, extra);
    return next;
  }
  const next = inventory.slice();
  while (next.length < want) next.push(null);
  if (extra != null) extraPocketTag.set(next, extra);
  return next;
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
      if (isPocketSlot(i) || isBackpackStorageIndex(i)) pockets.push(i);
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

  const next = cloneInventory(inventory);
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

/** How many more of `itemId` the pack can hold. */
export function inventoryAddRoom(inventory: Inventory, itemId: string): number {
  if (!getItemDefinition(itemId)) return 0;
  return remainingAddCapacity(inventory, itemId);
}

function remainingAddCapacity(
  inventory: Inventory,
  itemId: string,
  extraPockets?: number,
): number {
  const maxStack = maxStackForItem(itemId);
  if (maxStack <= 0) return 0;
  const access = inventorySlotAccess(inventory, extraPockets);

  let capacity = 0;
  for (let i = 0; i < inventory.length; i++) {
    if (!itemFitsInSlot(itemId, i, access)) continue;
    const cap = slotStackLimit(itemId, i);
    if (cap <= 0) continue;
    const slot = inventory[i];
    if (slot?.id === itemId) {
      capacity += cap - slot.quantity;
    } else if (!slot) {
      capacity += cap;
    }
  }
  return capacity;
}

export function canAddToInventory(
  inventory: Inventory,
  itemId: string,
  quantity = 1,
  extraPockets?: number,
) {
  if (!getItemDefinition(itemId)) return false;
  return remainingAddCapacity(inventory, itemId, extraPockets) >= quantity;
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

/** Hand in several quest stacks. Null when any one of them is short. */
export function inventoryAfterTurnIns(
  inventory: Inventory,
  items: readonly { itemId: string; quantity: number }[],
): Inventory | null {
  let next: Inventory | null = inventory;
  for (const item of items) {
    if (!item.itemId || item.quantity <= 0) continue;
    next = inventoryAfterTurnIn(next, item.itemId, item.quantity);
    if (!next) return null;
  }
  return next;
}

export function addToInventory(
  inventory: Inventory,
  itemId: string,
  quantity: number,
  extraPockets?: number,
): Inventory {
  if (quantity <= 0 || !getItemDefinition(itemId)) return inventory;
  itemId = canonicalItemId(itemId);

  const maxStack = maxStackForItem(itemId);
  if (maxStack <= 0) return inventory;
  const access = inventorySlotAccess(inventory, extraPockets);

  const next = cloneInventory(inventory);
  let remaining = quantity;

  for (let i = 0; i < next.length && remaining > 0; i++) {
    if (!itemFitsInSlot(itemId, i, access)) continue;
    const cap = slotStackLimit(itemId, i);
    if (cap <= 0) continue;
    const slot = next[i];
    if (!slot || slot.id !== itemId) continue;
    const room = cap - slot.quantity;
    if (room <= 0) continue;
    const add = Math.min(room, remaining);
    slot.quantity += add;
    remaining -= add;
  }

  for (let i = 0; i < next.length && remaining > 0; i++) {
    if (!itemFitsInSlot(itemId, i, access)) continue;
    const cap = slotStackLimit(itemId, i);
    if (cap <= 0) continue;
    if (next[i]) continue;
    const add = Math.min(cap, remaining);
    next[i] = { id: itemId, quantity: add };
    remaining -= add;
  }

  return next;
}

/** Put one prepared entry in the first slot it fits. Null when there is no room. */
export function addEntryToInventory(
  inventory: Inventory,
  entry: InventoryEntry,
  extraPockets?: number,
): Inventory | null {
  if (!getItemDefinition(entry.id)) return null;
  const access = inventorySlotAccess(inventory, extraPockets);
  for (let i = 0; i < inventory.length; i++) {
    if (inventory[i] || !itemFitsInSlot(entry.id, i, access)) continue;
    if (isJewelrySlot(i) && entry.quantity !== 1) continue;
    const next = cloneInventory(inventory);
    next[i] = entry;
    return next;
  }
  return null;
}

/** Slot indices holding a quest loaner of `itemId`. */
export function loanerSlotIndices(inventory: Inventory, itemId: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < inventory.length; i++) {
    const slot = inventory[i];
    if (slot?.id === itemId && slot.loaner === true) out.push(i);
  }
  return out;
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

/** Nested packs stop here so a corrupt save cannot recurse forever. */
const PACK_CONTENTS_MAX_DEPTH = 4;

function normalizePackContents(
  raw: unknown,
  depth: number,
): (InventoryEntry | null)[] | undefined {
  if (!Array.isArray(raw) || depth >= PACK_CONTENTS_MAX_DEPTH) return undefined;
  const limit = Math.min(raw.length, MAX_BACKPACK_STORAGE_SLOTS);
  const out: (InventoryEntry | null)[] = [];
  const spill: InventoryEntry[] = [];
  let any = false;
  for (let i = 0; i < limit; i++) {
    const cell = raw[i];
    if (!cell || typeof cell !== "object") {
      out.push(null);
      continue;
    }
    const src = cell as InventoryEntry;
    if (
      typeof src.id !== "string" ||
      typeof src.quantity !== "number" ||
      src.quantity <= 0 ||
      !getItemDefinition(src.id)
    ) {
      out.push(null);
      continue;
    }
    out.push(
      makeInventoryEntry(
        src.id,
        src.quantity,
        src.magazineRounds,
        inventoryEntryMeta(src),
        depth + 1,
      ),
    );
    const extra = extraUseCountItems(src);
    for (let n = 0; n < extra; n++) {
      spill.push(makeInventoryEntry(src.id, 1, undefined, undefined, depth + 1));
    }
    any = true;
  }
  for (const extra of spill) {
    const hole = out.findIndex((cell) => cell == null);
    if (hole >= 0) {
      out[hole] = extra;
      continue;
    }
    if (out.length >= MAX_BACKPACK_STORAGE_SLOTS) break;
    out.push(extra);
  }
  while (out.length > 0 && !out[out.length - 1]) out.pop();
  return any ? out : undefined;
}

/**
 * Old saves stacked multivitamins as one use each. A use-count item with no
 * durability and quantity above 1 is that many full items.
 */
function extraUseCountItems(entry: {
  id: string;
  quantity: number;
  durability?: number;
}): number {
  if (getMaxDurability(entry.id) == null) return 0;
  if (typeof entry.durability === "number" && Number.isFinite(entry.durability)) {
    return 0;
  }
  const qty = Math.floor(entry.quantity);
  if (!Number.isFinite(qty) || qty <= 1) return 0;
  return qty - 1;
}

/** Build a slot entry, optionally carrying chambered magazine rounds + meta. */
export function makeInventoryEntry(
  id: string,
  quantity: number,
  magazineRounds?: number,
  meta?: InventoryEntryMeta,
  depth = 0,
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
  if (meta?.loaner === true && maxDur != null) entry.loaner = true;
  if (isBackpackItem(itemId) && depth < PACK_CONTENTS_MAX_DEPTH) {
    const packed = normalizePackContents(meta?.contents, depth);
    if (packed) entry.contents = packed;
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

  const next = cloneInventory(inventory);
  const target = next[slotIndex]!;
  if (target.quantity <= quantity) {
    next[slotIndex] = null;
  } else {
    target.quantity -= quantity;
  }
  return next;
}

/**
 * Neck and hands hold one piece. A stack dropped on an empty jewelry slot
 * leaves the rest behind. A stack cannot swap onto a piece that is already worn.
 */
function placeOneJewelryPiece(
  from: InventoryEntry,
  toSlot: number,
): InventoryEntry | null {
  if (!isJewelrySlot(toSlot) || from.quantity <= 1) return null;
  const piece = cloneInventoryEntry(from);
  piece.quantity = 1;
  from.quantity -= 1;
  return piece;
}

/** Move or merge a stack into another slot; swap when merge is not possible. */
export function moveInventorySlot(
  inventory: Inventory,
  fromSlot: number,
  toSlot: number,
  extraPockets?: number,
  magazines?: WeaponMagazines,
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
  // The worn pack cannot be dropped into its own storage grid.
  if (packMoveBlocked(fromSlot, toSlot)) return inventory;

  const access = inventorySlotAccess(inventory, extraPockets);
  const magWork: WeaponMagazines = { ...(magazines ?? {}) };
  const next = cloneInventory(inventory);
  const wornLeaves =
    fromSlot === BACKPACK_SLOT_INDEX || toSlot === BACKPACK_SLOT_INDEX;
  if (wornLeaves) sealWornPack(next, magWork);
  const from = next[fromSlot];
  if (!from || !getItemDefinition(from.id)) return inventory;
  if (loadedBackpackStowBlocked(from, toSlot)) return inventory;
  if (!itemFitsInSlot(from.id, toSlot, access)) return inventory;

  const to = next[toSlot];
  if (to && loadedBackpackStowBlocked(to, fromSlot)) return inventory;
  if (!to) {
    const piece = placeOneJewelryPiece(from, toSlot);
    next[toSlot] = piece ?? from;
    if (!piece) next[fromSlot] = null;
    return finishPackMove(inventory, next, magWork, magazines);
  }

  // Swaps must also respect weapon-slot / pocket size rules for both items.
  if (!itemFitsInSlot(to.id, fromSlot, access)) return inventory;
  if (isJewelrySlot(toSlot) && (from.quantity > 1 || from.id === to.id)) {
    return inventory;
  }
  // A worn piece can merge into a pocket stack. It cannot swap with one,
  // or the whole stack would land in the jewelry slot.
  if (isJewelrySlot(fromSlot) && to.quantity > 1 && from.id !== to.id) {
    return inventory;
  }

  if (from.id === to.id && slotStackLimit(from.id, toSlot) > 1) {
    const maxStack = slotStackLimit(from.id, toSlot);
    const room = maxStack - to.quantity;
    if (room > 0) {
      const moveQty = Math.min(room, from.quantity);
      to.quantity += moveQty;
      from.quantity -= moveQty;
      if (from.quantity <= 0) next[fromSlot] = null;
      return finishPackMove(inventory, next, magWork, magazines);
    }
  }

  next[fromSlot] = to;
  next[toSlot] = from;
  return finishPackMove(inventory, next, magWork, magazines);
}

/** Items moved by a shift-drag. Odd piles round down. Stacks of 1 cannot split. */
export function shiftSplitQuantity(quantity: number): number {
  if (!Number.isInteger(quantity) || quantity < 2) return 0;
  return Math.floor(quantity / 2);
}

/**
 * True when a shift-drag can move half of `fromSlot` onto `toSlot`.
 * The destination may be empty, or it may already hold the same item with
 * room for that whole half. Other items are refused.
 */
export function canSplitInventoryStackHalf(
  inventory: Inventory,
  fromSlot: number,
  toSlot: number,
  extraPockets?: number,
): boolean {
  if (fromSlot === toSlot) return false;
  const slotCount = Math.min(MAX_INVENTORY_SLOTS, inventory.length);
  if (
    fromSlot < 0 ||
    toSlot < 0 ||
    fromSlot >= slotCount ||
    toSlot >= slotCount
  ) {
    return false;
  }
  if (packMoveBlocked(fromSlot, toSlot)) return false;

  const from = inventory[fromSlot];
  const to = inventory[toSlot];
  if (!from || !getItemDefinition(from.id)) return false;
  // A packed bag is one object. Splitting it would copy whatever is inside.
  if (backpackContentsHaveItems(from)) return false;
  if (loadedBackpackStowBlocked(from, toSlot)) return false;
  if (getMaxDurability(from.id) != null) return false;
  if (!itemFitsInSlot(from.id, toSlot, inventorySlotAccess(inventory, extraPockets))) {
    return false;
  }

  const half = shiftSplitQuantity(from.quantity);
  const cap = slotStackLimit(from.id, toSlot);
  if (half < 1 || half > cap) return false;
  if (!to) return true;
  if (to.id !== from.id) return false;
  return to.quantity + half <= cap;
}

/**
 * Shift-drag moves half a stack onto an empty slot, or merges that half into
 * a slot that already holds the same item and has room for all of it.
 * Odd piles round down. Returns the same array when the move is not allowed.
 */
export function splitInventoryStackHalf(
  inventory: Inventory,
  fromSlot: number,
  toSlot: number,
  extraPockets?: number,
): Inventory {
  if (!canSplitInventoryStackHalf(inventory, fromSlot, toSlot, extraPockets)) {
    return inventory;
  }
  const half = shiftSplitQuantity(inventory[fromSlot]!.quantity);
  const next = cloneInventory(inventory);
  const source = next[fromSlot]!;
  source.quantity -= half;
  if (source.quantity <= 0) next[fromSlot] = null;
  const dest = next[toSlot];
  if (!dest) {
    const placed = cloneInventoryEntry(inventory[fromSlot]!);
    placed.quantity = half;
    next[toSlot] = placed;
  } else {
    dest.quantity += half;
  }
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
  /**
   * Lost in sofa and armchair cushions. Cash, jewellery, springs, and other
   * small pieces. No clothes, bags, food, or weapons.
   */
  cushion: [
    "banknote",
    "lighter",
    "blue_cigarettes",
    "gold_chain",
    "gold_earrings",
    "gold_ring",
    "silver_chain",
    "silver_ring",
    "small_spring",
    "large_spring",
    "screws",
    "bolts",
  ],
  junk: [
    "banknote",
    "lighter",
    "lockpick",
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
    /** Shop token. Each unit becomes one named watch, same weights as containers. */
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
  return Object.prototype.hasOwnProperty.call(CONTAINER_LOOT, objectType);
}

/** Packs that can appear in this building. Empty outside those sites. */
function backpackIdsForBuilding(buildingX: number, buildingY: number): string[] {
  const bld = getBuildingAt(buildingX, buildingY);
  if (!bld) return [];
  if (bld.buildingType === "motel") {
    return [
      BACKPACK_FANNY_ID,
      BACKPACK_SMALL_ID,
      BACKPACK_HUNTING_ID,
      BACKPACK_LEATHER_ID,
      BACKPACK_HIKING_ID,
    ];
  }
  if (bld.buildingType === "warehouse") return [BACKPACK_UTILITY_ID];
  if (bld.buildingType === "police_station") return [BACKPACK_HIKING_ID];
  if (bld.buildingType === "tent") return [BACKPACK_HIKING_ID];
  if (bld.buildingType === "house" || bld.buildingType === "apartment") {
    const cx = Math.floor(bld.ox / SETTLEMENT_CELL_SIZE) * SETTLEMENT_CELL_SIZE;
    const cy = Math.floor(bld.oy / SETTLEMENT_CELL_SIZE) * SETTLEMENT_CELL_SIZE;
    if (getSettlementType(cx, cy) === "rural") {
      return [BACKPACK_HUNTING_ID, BACKPACK_LEATHER_ID];
    }
    return [BACKPACK_FANNY_ID, BACKPACK_SMALL_ID];
  }
  return [];
}

function rollMagazine(
  objectType: string,
  rng: () => number,
): InventoryEntry | null {
  const spec = MAGAZINE_ROLLS[objectType];
  if (!spec || rng() >= spec.chance) return null;
  if (spec.only) return { id: spec.only, quantity: 1 };
  const pick = SKILL_MAGAZINES[Math.floor(rng() * SKILL_MAGAZINES.length)];
  return pick ? { id: pick.itemId, quantity: 1 } : null;
}

function rollBackpacks(
  objectType: string,
  buildingX: number | undefined,
  buildingY: number | undefined,
  rng: () => number,
): InventoryEntry[] {
  const specs = BACKPACK_ROLLS[objectType];
  if (!specs || buildingX == null || buildingY == null) return [];
  const allowed = new Set(backpackIdsForBuilding(buildingX, buildingY));
  const motel = getBuildingAt(buildingX, buildingY)?.buildingType === "motel";
  const results: InventoryEntry[] = [];
  for (const spec of specs) {
    if (spec.motelOnly && !motel) continue;
    if (!allowed.has(spec.id)) continue;
    if (rng() >= spec.chance) continue;
    results.push({ id: spec.id, quantity: 1 });
  }
  return results;
}

/** Checkout and the department-store register: 1% sidearm plus matching ammo. */
function rollRegisterSidearm(rng: () => number): InventoryEntry[] {
  if (rng() >= 0.01) return [];
  const pistol = rng() < 0.5;
  const ammoQty = pistol
    ? 1 + Math.floor(rng() * 17)
    : 1 + Math.floor(rng() * 6);
  return [
    { id: pistol ? "weapon_pistol" : "weapon_revolver", quantity: 1 },
    { id: pistol ? "ammo_9x19" : "ammo_44", quantity: ammoQty },
  ];
}

/** Motel counter: 1% sidearm. Ammo can be zero. */
function rollCounterSidearm(rng: () => number): InventoryEntry[] {
  if (rng() >= 0.01) return [];
  const pistol = rng() < 0.5;
  const results: InventoryEntry[] = [
    { id: pistol ? "weapon_pistol" : "weapon_revolver", quantity: 1 },
  ];
  const ammoQty = pistol
    ? Math.floor(rng() * 18)
    : Math.floor(rng() * 7);
  if (ammoQty > 0) {
    results.push({
      id: pistol ? "ammo_9x19" : "ammo_44",
      quantity: ammoQty,
    });
  }
  return results;
}

/** Container and pocket rolls. A `watch` token becomes a named watch. */
function rollTable(rolls: readonly LootRoll[], rng: () => number): InventoryEntry[] {
  return expandWatchLoot(rollLootRolls(rolls, rng), rng);
}

/** Roll container loot. Fresh `Math.random` each call. */
export function generateSearchLoot(
  objectType: string,
  _searchSeed: string,
  buildingX?: number,
  buildingY?: number,
): InventoryEntry[] {
  const rng = Math.random;
  const results = rollTable(CONTAINER_LOOT[objectType] ?? [], rng);

  const magazine = rollMagazine(objectType, rng);
  if (magazine) results.push(magazine);
  results.push(...rollBackpacks(objectType, buildingX, buildingY, rng));

  if (objectType === "checkout" || objectType === "retailcheckout1") {
    results.push(...rollRegisterSidearm(rng));
  }
  if (objectType === "counter") {
    results.push(...rollCounterSidearm(rng));
  }

  // Waiting bench: a pistol still comes with 0-17 rounds of 9mm.
  if (
    objectType === "threeseater2" &&
    results.some((entry) => entry.id === "weapon_pistol") &&
    !results.some((entry) => entry.id === "ammo_9x19")
  ) {
    const qty = Math.floor(rng() * 18);
    if (qty > 0) results.push({ id: "ammo_9x19", quantity: qty });
  }

  if (objectType === "deadofficer") {
    return applyDeadOfficerLoot(results);
  }

  return results;
}

/** Pocket 9mm added when a dead officer has a pistol and the ammo roll missed. */
const DEAD_OFFICER_PISTOL_AMMO_MIN = 4;
const DEAD_OFFICER_PISTOL_AMMO_MAX = 12;

function applyDeadOfficerLoot(results: InventoryEntry[]): InventoryEntry[] {
  const out = results.slice();
  if (
    out.some((entry) => entry.id === "weapon_pistol") &&
    !out.some((entry) => entry.id === "ammo_9x19")
  ) {
    const span = DEAD_OFFICER_PISTOL_AMMO_MAX - DEAD_OFFICER_PISTOL_AMMO_MIN + 1;
    out.push({
      id: "ammo_9x19",
      quantity: DEAD_OFFICER_PISTOL_AMMO_MIN + Math.floor(Math.random() * span),
    });
  }
  return out;
}

/** 50% of zombies carry nothing. A pocket that is not empty uses its own list. */
const ZOMBIE_EMPTY_LOOT_CHANCE = 0.5;

/** Police officer zombie (skin 11): 25% chance of a sidearm and 0-17 9x19. */
const ZOMBIE_POLICE_PISTOL_CHANCE = 0.25;

/** Deterministic loot rolled once when a zombie dies. */
export function generateZombieLoot(
  zombieId: string,
  skin = 1,
): InventoryEntry[] {
  const rng = mulberry32(xmur3(`zombie-loot:${zombieId}`)());
  const results: InventoryEntry[] = [];

  if (skin === ZOMBIE_SKIN_MAN11 && rng() < ZOMBIE_POLICE_PISTOL_CHANCE) {
    results.push({ id: "weapon_pistol", quantity: 1 });
    const ammoQty = Math.floor(rng() * 18);
    if (ammoQty > 0) {
      results.push({ id: "ammo_9x19", quantity: ammoQty });
    }
  }

  // Empty roll skips the pocket but keeps any officer sidearm above.
  if (rng() < ZOMBIE_EMPTY_LOOT_CHANCE) return results;
  results.push(...rollTable(ZOMBIE_POCKET, rng));
  return results;
}

/** Deterministic loot rolled once when a guard dies. Always a dog tag, an AK, and 0-30 7.62. */
export function generateGuardLoot(guardId: string, salt = ""): InventoryEntry[] {
  const rng = mulberry32(xmur3(`guard-loot:${guardId}:${salt}`)());
  const results: InventoryEntry[] = [
    { id: "dogtag", quantity: 1 },
    { id: "weapon_assault_rifle", quantity: 1 },
  ];
  const ammoQty = Math.floor(rng() * 31);
  if (ammoQty > 0) {
    results.push({ id: "ammo_762x39", quantity: ammoQty });
  }
  results.push(...rollTable(GUARD_POCKET, rng));
  return results;
}

/** TraderGuard1 loot. Always 1 pistol and 0-17 9x19mm, plus a short pocket. */
export function generateTraderGuardLoot(
  guardId: string,
  salt = "",
): InventoryEntry[] {
  const rng = mulberry32(xmur3(`trader-guard-loot:${guardId}:${salt}`)());
  const results: InventoryEntry[] = [{ id: "weapon_pistol", quantity: 1 }];
  const ammoQty = Math.floor(rng() * 18);
  if (ammoQty > 0) {
    results.push({ id: "ammo_9x19", quantity: ammoQty });
  }
  results.push(...rollTable(TRADER_GUARD_POCKET, rng));
  return results;
}

/**
 * Red Order loot. Pistol skins always drop a pistol and 0-17 9x19.
 * Shotgun skin (2) always drops a shotgun and 0-8 buckshot.
 * The extra pocket matches a trader guard.
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
    ? Math.floor(rng() * 9)
    : Math.floor(rng() * 18);
  if (ammoQty > 0) {
    results.push({
      id: shotgun ? "ammo_buckshot" : "ammo_9x19",
      quantity: ammoQty,
    });
  }
  results.push(...rollTable(TRADER_GUARD_POCKET, rng));
  return results;
}

/** TraderMan1 loot. Light trade goods, no guaranteed weapon. */
export function generateTraderManLoot(
  manId: string,
  salt = "",
): InventoryEntry[] {
  const rng = mulberry32(xmur3(`trader-man-loot:${manId}:${salt}`)());
  return rollTable(TRADER_POCKET, rng);
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
        canonicalItemId(entry.id),
        entry.quantity,
        entry.magazineRounds,
        inventoryEntryMeta(entry),
      );
      const extraBottles = extraUseCountItems(entry);
      for (let n = 0; n < extraBottles; n++) {
        overflow.push(makeInventoryEntry(normalized.id, 1));
      }
      // Keep leftovers from the old 12-pocket row in place. Compacting runs later.
      if (isRetiredPocketSlot(i)) {
        slots[i] = normalized;
        continue;
      }
      if (isJewelrySlot(i) && normalized.quantity > 1) {
        overflow.push(makeInventoryEntry(normalized.id, normalized.quantity - 1));
        normalized.quantity = 1;
      }
      if (
        !itemFitsInSlot(normalized.id, i, {
          extraPockets: MAX_EXTRA_POCKET_SLOTS,
          backpackSlots: equippedBackpackStorageCount(slots),
        })
      ) {
        overflow.push(normalized);
        continue;
      }
      slots[i] = normalized;
    }
  }
  for (const entry of overflow) {
    slots = addToInventory(slots, entry.id, entry.quantity, MAX_EXTRA_POCKET_SLOTS);
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

/** Slide leftover 12-pocket items into the 8 pockets when one is empty. */
function compactRetiredPockets(inventory: Inventory): Inventory {
  let next = inventory;
  const pocketStart = WEAPON_SLOT_COUNT;
  const pocketEnd = WEAPON_SLOT_COUNT + POCKET_SLOT_COUNT;
  for (let i = pocketEnd; i < CLOTHING_SLOT_INDEX; i++) {
    if (!next[i]) continue;
    let dest = -1;
    for (let p = pocketStart; p < pocketEnd; p++) {
      if (!next[p]) {
        dest = p;
        break;
      }
    }
    if (dest < 0) break;
    const moved = moveInventorySlot(next, i, dest, 0);
    if (moved === next) continue;
    next = moved;
  }
  return next;
}

function finishPlayerInventory(inventory: Inventory): Inventory {
  return compactRetiredPockets(
    fitPlayerInventoryLength(releaseWornBackpack(inventory)),
  );
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
      return finishPlayerInventory(createEmptyInventory());
    }
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return finishPlayerInventory(createEmptyInventory());
    if (parsed.length === 0) return finishPlayerInventory(createEmptyInventory());

    // Always treat array payloads as a slot grid first. One bad/unknown cell
    // must not wipe the rest of the bag (legacy `every(isValidSlot)` did that
    // when it fell through and then failed to salvage).
    const asSlots = normalizeInventorySlots(parsed);
    if (asSlots.some(Boolean) || parsed.every((s) => s == null)) {
      return finishPlayerInventory(migrateMapIntoDedicatedSlot(asSlots));
    }

    const legacyEntries = parsed.filter(
      (entry) =>
        entry &&
        typeof entry.id === "string" &&
        typeof entry.quantity === "number" &&
        entry.quantity > 0,
    ) as InventoryEntry[];

    if (legacyEntries.length > 0) {
      return finishPlayerInventory(
        migrateMapIntoDedicatedSlot(migrateLegacyInventory(legacyEntries)),
      );
    }

    return finishPlayerInventory(createEmptyInventory());
  } catch {
    return finishPlayerInventory(createEmptyInventory());
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
    if (slot.loaner === true && maxDur != null) serialized.loaner = true;
    // Worn storage is the live copy. Sealed contents belong on every other pack.
    if (isBackpackItem(slot.id)) {
      const wornOpen =
        i === BACKPACK_SLOT_INDEX && backpackStorageHasItems(inventory);
      if (!wornOpen && slot.contents?.length) {
        const packed = normalizePackContents(slot.contents, 0);
        if (packed) serialized.contents = packed;
      }
    }
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
  magazines?: WeaponMagazines,
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

  const access = inventorySlotAccess(playerInventory);
  const magWork: WeaponMagazines = { ...(magazines ?? {}) };
  const nextPlayer = cloneInventory(playerInventory);
  if (fromSlot === BACKPACK_SLOT_INDEX) sealWornPack(nextPlayer, magWork);
  const nextContainer = createEmptyStorageBoxInventory(limit);
  for (let i = 0; i < limit; i++) {
    const slot = container[i];
    nextContainer[i] = slot ? cloneInventoryEntry(slot) : null;
  }
  const from = nextPlayer[fromSlot];
  if (!from || !getItemDefinition(from.id)) return null;
  if (backpackContentsHaveItems(from)) return null;

  const to = nextContainer[toSlot];
  if (to && loadedBackpackStowBlocked(to, fromSlot)) return null;
  const packed = (playerInv: Inventory) => {
    const committed = commitPlayerPack(playerInventory, playerInv, magWork, magazines);
    if (!committed) return null;
    return { container: nextContainer, playerInventory: committed };
  };
  if (!to) {
    nextContainer[toSlot] = from;
    nextPlayer[fromSlot] = null;
    return packed(nextPlayer);
  }

  if (from.id === to.id && maxStackForItem(from.id) > 1) {
    const maxStack = maxStackForItem(from.id);
    const room = maxStack - to.quantity;
    if (room > 0) {
      const moveQty = Math.min(room, from.quantity);
      to.quantity += moveQty;
      from.quantity -= moveQty;
      if (from.quantity <= 0) nextPlayer[fromSlot] = null;
      return packed(nextPlayer);
    }
  }

  if (!itemFitsInSlot(to.id, fromSlot, access)) return null;
  nextPlayer[fromSlot] = to;
  nextContainer[toSlot] = from;
  return packed(nextPlayer);
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
  meta?: InventoryEntryMeta,
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
    if (!getItemDefinition(entry.id) || entry.quantity <= 0) continue;
    const cap = maxStackForItem(entry.id);
    if (cap <= 0) continue;
    let remaining = Math.floor(entry.quantity);
    while (remaining > 0 && slot < CONTAINER_INVENTORY_SLOTS) {
      const qty = Math.min(remaining, cap);
      inventory[slot++] = makeInventoryEntry(
        entry.id,
        qty,
        entry.magazineRounds,
        inventoryEntryMeta(entry),
      );
      remaining -= qty;
    }
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
      makeInventoryEntry(
        canonicalItemId(entry.id),
        qty,
        entry.magazineRounds,
        inventoryEntryMeta(entry),
      ),
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

/** Backpacks go in first so a full corpse still keeps the pack and its contents. */
export function orderCorpseLoot(entries: InventoryEntry[]): InventoryEntry[] {
  const packs: InventoryEntry[] = [];
  const rest: InventoryEntry[] = [];
  for (const entry of entries) {
    if (isBackpackItem(entry.id)) packs.push(entry);
    else rest.push(entry);
  }
  return [...packs, ...rest];
}

export function parseContainerInventory(json: string): Inventory {
  try {
    if (typeof json !== "string" || json.length === 0) {
      return createEmptyContainerInventory();
    }
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return createEmptyContainerInventory();
    const slots = createEmptyContainerInventory();
    const spill: InventoryEntry[] = [];
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
        const extra = extraUseCountItems(entry);
        for (let n = 0; n < extra; n++) {
          spill.push(makeInventoryEntry(entry.id, 1));
        }
      }
    }
    for (const extra of spill) {
      const hole = slots.findIndex((cell) => cell == null);
      if (hole < 0) break;
      slots[hole] = extra;
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
  magazines?: WeaponMagazines,
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

  const access = inventorySlotAccess(playerInventory);
  const magWork: WeaponMagazines = { ...(magazines ?? {}) };
  const nextContainer = container.map((slot) =>
    slot ? cloneInventoryEntry(slot) : null,
  );
  const nextPlayer = cloneInventory(playerInventory);
  if (toSlot === BACKPACK_SLOT_INDEX) sealWornPack(nextPlayer, magWork);
  const from = nextContainer[fromSlot];
  if (!from || !getItemDefinition(from.id)) return null;
  if (loadedBackpackStowBlocked(from, toSlot)) return null;
  if (!itemFitsInSlot(from.id, toSlot, access)) return null;

  const to = nextPlayer[toSlot];
  if (to && backpackContentsHaveItems(to)) return null;
  const packed = (playerInv: Inventory) => {
    const committed = commitPlayerPack(
      playerInventory,
      playerInv,
      magWork,
      magazines,
    );
    if (!committed) return null;
    return { container: nextContainer, playerInventory: committed };
  };
  if (!to) {
    const piece = placeOneJewelryPiece(from, toSlot);
    nextPlayer[toSlot] = piece ?? from;
    if (!piece) nextContainer[fromSlot] = null;
    return packed(nextPlayer);
  }

  if (isJewelrySlot(toSlot) && (from.quantity > 1 || from.id === to.id)) {
    return null;
  }

  // Swap only when the player item could go back into this container slot (always true).
  if (from.id === to.id && slotStackLimit(from.id, toSlot) > 1) {
    const maxStack = slotStackLimit(from.id, toSlot);
    const room = maxStack - to.quantity;
    if (room > 0) {
      const moveQty = Math.min(room, from.quantity);
      to.quantity += moveQty;
      from.quantity -= moveQty;
      if (from.quantity <= 0) nextContainer[fromSlot] = null;
      return packed(nextPlayer);
    }
  }

  nextContainer[fromSlot] = to;
  nextPlayer[toSlot] = from;
  return packed(nextPlayer);
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
