import {
  canAddToInventory,
  addToInventory,
  countItemInInventory,
  itemFitsInSlot,
  maxStackForItem,
  isPocketSlot,
  removeItemFromInventory,
  type Inventory,
} from "./items.js";

export type CraftItemQty = { itemId: string; quantity: number };

/** Single required stack, or any one option from a list (e.g. Old Teddy / Teddy). */
export type CraftIngredient = CraftItemQty | { anyOf: CraftItemQty[] };

/** Workbench for cloth and wood. Furnace for metal, and only while the fire is lit. */
export type CraftStationKind = "workbench" | "furnace";

export type CraftRecipe = {
  id: string;
  station: CraftStationKind;
  output: CraftItemQty;
  inputs: CraftIngredient[];
  /** Craft channel duration; defaults to CRAFT_DURATION_MS. */
  durationMs?: number;
  /** Break an item down into the output. Other materials are lost. */
  breakdown?: boolean;
  /** Extra line on a breakdown card. */
  note?: string;
};

/** Default workbench craft channel time. */
export const CRAFT_DURATION_MS = 10_000;

export function craftRecipeDurationMs(recipe: CraftRecipe): number {
  return recipe.durationMs ?? CRAFT_DURATION_MS;
}

/** Furniture types that open the craft UI instead of search loot. */
export const CRAFT_STATION_TYPES = ["workbench"] as const;
export type CraftStationType = (typeof CRAFT_STATION_TYPES)[number];

export function furnitureIsCraftStation(objectType: string): boolean {
  return (CRAFT_STATION_TYPES as readonly string[]).includes(objectType);
}

export const CRAFT_RECIPES: readonly CraftRecipe[] = [
  {
    id: "rags_from_teddy",
    station: "workbench",
    output: { itemId: "rags", quantity: 2 },
    inputs: [
      {
        anyOf: [
          { itemId: "old_teddy", quantity: 1 },
          { itemId: "teddy", quantity: 1 },
        ],
      },
    ],
  },
  {
    id: "rags_from_shirt",
    station: "workbench",
    output: { itemId: "rags", quantity: 2 },
    inputs: [
      {
        anyOf: [
          { itemId: "white_tshirt", quantity: 1 },
          { itemId: "black_tshirt", quantity: 1 },
        ],
      },
    ],
  },
  {
    id: "bandages_from_alcohol_rags",
    station: "workbench",
    output: { itemId: "bandages", quantity: 2 },
    inputs: [
      { itemId: "alcohol", quantity: 1 },
      { itemId: "rags", quantity: 6 },
    ],
  },
  {
    id: "screws_from_scrap",
    station: "furnace",
    output: { itemId: "screws", quantity: 1 },
    inputs: [{ itemId: "scrap_metal", quantity: 1 }],
  },
  {
    id: "bolts_from_scrap",
    station: "furnace",
    output: { itemId: "bolts", quantity: 1 },
    inputs: [{ itemId: "scrap_metal", quantity: 1 }],
  },
  {
    id: "hammer_from_scrap",
    station: "furnace",
    output: { itemId: "weapon_hammer", quantity: 1 },
    inputs: [
      { itemId: "scrap_metal", quantity: 3 },
      { itemId: "screws", quantity: 4 },
      { itemId: "duct_tape", quantity: 2 },
    ],
  },
  {
    id: "hatchet_from_scrap",
    station: "furnace",
    output: { itemId: "weapon_hatchet", quantity: 1 },
    inputs: [
      { itemId: "wood", quantity: 2 },
      { itemId: "scrap_metal", quantity: 2 },
      { itemId: "bolts", quantity: 2 },
      { itemId: "duct_tape", quantity: 2 },
    ],
  },
  {
    id: "scrap_from_hammer",
    station: "furnace",
    breakdown: true,
    output: { itemId: "scrap_metal", quantity: 3 },
    inputs: [{ itemId: "weapon_hammer", quantity: 1 }],
    note: "Screws and duct tape are lost.",
  },
  {
    id: "scrap_from_hatchet",
    station: "furnace",
    breakdown: true,
    output: { itemId: "scrap_metal", quantity: 2 },
    inputs: [{ itemId: "weapon_hatchet", quantity: 1 }],
    note: "Wood, bolts, and duct tape are lost.",
  },
  {
    id: "bat_from_wood",
    station: "workbench",
    output: { itemId: "weapon_bat", quantity: 1 },
    inputs: [
      { itemId: "wood", quantity: 3 },
      { itemId: "duct_tape", quantity: 2 },
    ],
  },
] as const;

export function getCraftRecipe(recipeId: string): CraftRecipe | undefined {
  return CRAFT_RECIPES.find((r) => r.id === recipeId);
}

export function isCraftItemQty(ing: CraftIngredient): ing is CraftItemQty {
  return "itemId" in ing;
}

function countItemInPockets(inventory: Inventory, itemId: string): number {
  let total = 0;
  for (let i = 0; i < inventory.length; i++) {
    if (!isPocketSlot(i)) continue;
    const slot = inventory[i];
    if (slot?.id === itemId) total += slot.quantity;
  }
  return total;
}

/**
 * First matching anyOf option the pockets can cover.
 * Worn clothing is only chosen when no pocket stack can pay the cost.
 */
export function resolveCraftIngredient(
  inventory: Inventory,
  ing: CraftIngredient,
): CraftItemQty | null {
  if (isCraftItemQty(ing)) {
    return countItemInInventory(inventory, ing.itemId) >= ing.quantity
      ? ing
      : null;
  }
  for (const opt of ing.anyOf) {
    if (countItemInPockets(inventory, opt.itemId) >= opt.quantity) return opt;
  }
  for (const opt of ing.anyOf) {
    if (countItemInInventory(inventory, opt.itemId) >= opt.quantity) return opt;
  }
  return null;
}

export function canCraftRecipe(inventory: Inventory, recipe: CraftRecipe): boolean {
  for (const ing of recipe.inputs) {
    if (!resolveCraftIngredient(inventory, ing)) return false;
  }
  return canAddToInventory(
    inventory,
    recipe.output.itemId,
    recipe.output.quantity,
  );
}

/**
 * Pockets pay the cost before the weapon hotbar or worn slots.
 * `deferSlots` (the gun in hand) is last, and only if nothing else can pay.
 */
function consumeCraftInput(
  inventory: Inventory,
  itemId: string,
  quantity: number,
  deferSlots: readonly number[],
): Inventory {
  return removeItemFromInventory(
    inventory,
    itemId,
    quantity,
    "pockets-first",
    deferSlots,
  );
}

/**
 * Consume inputs and add output. Returns null if the craft is not possible.
 * Pockets are used before the hotbar or worn slots.
 */
export function applyCraftRecipe(
  inventory: Inventory,
  recipe: CraftRecipe,
  deferSlots: readonly number[] = [],
): Inventory | null {
  if (!canCraftRecipe(inventory, recipe)) return null;
  let next = inventory;
  for (const ing of recipe.inputs) {
    const resolved = resolveCraftIngredient(next, ing);
    if (!resolved) return null;
    next = consumeCraftInput(
      next,
      resolved.itemId,
      resolved.quantity,
      deferSlots,
    );
  }
  if (!canAddToInventory(next, recipe.output.itemId, recipe.output.quantity)) {
    return null;
  }
  return addToInventory(next, recipe.output.itemId, recipe.output.quantity);
}

/** Parts returned when a firearm is broken down. The rest are ruined. */
export const DISASSEMBLY_RETURN_COUNT = 3;
export const DISASSEMBLY_DURATION_MS = 15_000;

export type DisassemblyRecipe = {
  id: string;
  station: "workbench";
  weaponId: string;
  parts: readonly string[];
  returnCount: number;
  durationMs?: number;
};

export const DISASSEMBLY_RECIPES: readonly DisassemblyRecipe[] = [
  {
    id: "disassemble_pistol",
    station: "workbench",
    weaponId: "weapon_pistol",
    returnCount: DISASSEMBLY_RETURN_COUNT,
    durationMs: DISASSEMBLY_DURATION_MS,
    parts: ["pistol_frame", "pistol_slide", "small_spring", "pistol_trigger"],
  },
  {
    id: "disassemble_revolver",
    station: "workbench",
    weaponId: "weapon_revolver",
    returnCount: DISASSEMBLY_RETURN_COUNT,
    durationMs: DISASSEMBLY_DURATION_MS,
    parts: [
      "revolver_frame",
      "revolver_cylinder",
      "revolver_barrel",
      "small_spring",
      "revolver_trigger",
    ],
  },
  {
    id: "disassemble_shotgun",
    station: "workbench",
    weaponId: "weapon_shotgun",
    returnCount: DISASSEMBLY_RETURN_COUNT,
    durationMs: DISASSEMBLY_DURATION_MS,
    parts: [
      "shotgun_receiver",
      "shotgun_barrel",
      "large_spring",
      "shotgun_stock",
      "shotgun_trigger",
    ],
  },
  {
    id: "disassemble_hunting_rifle",
    station: "workbench",
    weaponId: "weapon_hunting_rifle",
    returnCount: DISASSEMBLY_RETURN_COUNT,
    durationMs: DISASSEMBLY_DURATION_MS,
    parts: [
      "rifle_receiver",
      "rifle_barrel",
      "rifle_stock",
      "scope",
      "large_spring",
      "rifle_trigger",
    ],
  },
  {
    id: "disassemble_ak",
    station: "workbench",
    weaponId: "weapon_assault_rifle",
    returnCount: DISASSEMBLY_RETURN_COUNT,
    durationMs: DISASSEMBLY_DURATION_MS,
    parts: [
      "ak_receiver",
      "ak_barrel",
      "ak_stock",
      "large_spring",
      "rifle_trigger",
    ],
  },
  {
    id: "disassemble_m4",
    station: "workbench",
    weaponId: "weapon_m4a1",
    returnCount: DISASSEMBLY_RETURN_COUNT,
    durationMs: DISASSEMBLY_DURATION_MS,
    parts: [
      "m4_receiver",
      "m4_barrel",
      "m4_stock",
      "large_spring",
      "rifle_trigger",
    ],
  },
];

export function getDisassemblyRecipe(
  recipeId: string,
): DisassemblyRecipe | undefined {
  return DISASSEMBLY_RECIPES.find((r) => r.id === recipeId);
}

/** How many more of itemId fit in stacks that already hold it. */
function stackedRoom(inventory: Inventory, itemId: string): number {
  const max = maxStackForItem(itemId);
  let room = 0;
  for (const slot of inventory) {
    if (slot?.id === itemId) room += Math.max(0, max - slot.quantity);
  }
  return room;
}

function emptySlotsFor(inventory: Inventory, itemId: string): number {
  let n = 0;
  for (let i = 0; i < inventory.length; i++) {
    if (!inventory[i] && itemFitsInSlot(itemId, i)) n++;
  }
  return n;
}

/**
 * True when the player has the gun and any 3 of its parts will fit
 * after the gun is removed.
 */
export function canDisassemble(
  inventory: Inventory,
  recipe: DisassemblyRecipe,
  deferSlots: readonly number[] = [],
): boolean {
  if (countItemInInventory(inventory, recipe.weaponId) < 1) return false;
  const next = consumeCraftInput(inventory, recipe.weaponId, 1, deferSlots);
  const needsSlot = recipe.parts.filter((id) => stackedRoom(next, id) < 1);
  const slotsNeeded = Math.min(recipe.returnCount, needsSlot.length);
  if (slotsNeeded === 0) return true;
  return emptySlotsFor(next, needsSlot[0]!) >= slotsNeeded;
}

function pickDistinctParts(
  parts: readonly string[],
  count: number,
  rng: () => number,
): string[] {
  const pool = parts.slice();
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const swap = pool[i]!;
    pool[i] = pool[j]!;
    pool[j] = swap;
  }
  return pool.slice(0, Math.min(count, pool.length));
}

export type DisassemblyResult = {
  inventory: Inventory;
  salvaged: { id: string; quantity: number }[];
  ruined: string[];
};

/**
 * Destroy one gun and add a random subset of its parts.
 * A gun in the pockets is taken before one on the hotbar.
 * Returns null when the gun is missing or the parts will not fit.
 */
export function applyDisassembly(
  inventory: Inventory,
  recipe: DisassemblyRecipe,
  rng: () => number = Math.random,
  deferSlots: readonly number[] = [],
): DisassemblyResult | null {
  if (!canDisassemble(inventory, recipe, deferSlots)) return null;
  const picked = pickDistinctParts(recipe.parts, recipe.returnCount, rng);
  let next = consumeCraftInput(inventory, recipe.weaponId, 1, deferSlots);
  const salvaged: { id: string; quantity: number }[] = [];
  for (const id of picked) {
    if (!canAddToInventory(next, id, 1)) return null;
    next = addToInventory(next, id, 1);
    salvaged.push({ id, quantity: 1 });
  }
  const kept = new Set(picked);
  return {
    inventory: next,
    salvaged,
    ruined: recipe.parts.filter((id) => !kept.has(id)),
  };
}
