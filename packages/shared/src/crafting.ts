import {
  canAddToInventory,
  addToInventory,
  countItemInInventory,
  inventorySlotAccess,
  isBackpackStorageIndex,
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
  /**
   * When set, the recipe is hidden at the bench until this blueprint has
   * been learned. The item id is the blueprint sheet, not the weapon.
   */
  blueprintItemId?: string;
};

/** True when a learned-blueprint gate does not hide this recipe. */
export function craftRecipeIsVisible(
  recipe: CraftRecipe,
  learnedRecipeIds: ReadonlySet<string>,
): boolean {
  if (!recipe.blueprintItemId) return true;
  return learnedRecipeIds.has(recipe.id);
}

export const EMPTY_LEARNED_BLUEPRINTS_JSON = "[]";

/** Recipe ids this player has unlocked. Unknown or corrupt entries are dropped. */
export function parseLearnedBlueprints(json: string | null | undefined): Set<string> {
  const known = new Set(
    CRAFT_RECIPES.filter((recipe) => recipe.blueprintItemId).map((recipe) => recipe.id),
  );
  if (!json) return new Set();
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    const out = new Set<string>();
    for (const id of parsed) {
      if (typeof id === "string" && known.has(id)) out.add(id);
    }
    return out;
  } catch {
    return new Set();
  }
}

/** Returns the next JSON, or null when the recipe was already learned or is not a blueprint recipe. */
export function withLearnedBlueprint(
  json: string | null | undefined,
  recipeId: string,
): string | null {
  const known = CRAFT_RECIPES.some(
    (recipe) => recipe.id === recipeId && !!recipe.blueprintItemId,
  );
  if (!known) return null;
  const set = parseLearnedBlueprints(json);
  if (set.has(recipeId)) return null;
  set.add(recipeId);
  return JSON.stringify([...set].sort());
}

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
  {
    id: "craft_pistol",
    station: "workbench",
    blueprintItemId: "blueprint_pistol",
    output: { itemId: "weapon_pistol", quantity: 1 },
    inputs: [
      { itemId: "pistol_frame", quantity: 1 },
      { itemId: "pistol_slide", quantity: 1 },
      { itemId: "pistol_trigger", quantity: 1 },
      { itemId: "small_spring", quantity: 1 },
    ],
  },
  {
    id: "craft_revolver",
    station: "workbench",
    blueprintItemId: "blueprint_revolver",
    output: { itemId: "weapon_revolver", quantity: 1 },
    inputs: [
      { itemId: "revolver_frame", quantity: 1 },
      { itemId: "revolver_cylinder", quantity: 1 },
      { itemId: "revolver_barrel", quantity: 1 },
      { itemId: "revolver_trigger", quantity: 1 },
      { itemId: "small_spring", quantity: 1 },
    ],
  },
  {
    id: "craft_shotgun",
    station: "workbench",
    blueprintItemId: "blueprint_shotgun",
    output: { itemId: "weapon_shotgun", quantity: 1 },
    inputs: [
      { itemId: "shotgun_receiver", quantity: 1 },
      { itemId: "shotgun_barrel", quantity: 1 },
      { itemId: "shotgun_stock", quantity: 1 },
      { itemId: "shotgun_trigger", quantity: 1 },
      { itemId: "large_spring", quantity: 1 },
    ],
  },
  {
    id: "craft_hunting_rifle",
    station: "workbench",
    blueprintItemId: "blueprint_hunting_rifle",
    output: { itemId: "weapon_hunting_rifle", quantity: 1 },
    inputs: [
      { itemId: "rifle_receiver", quantity: 1 },
      { itemId: "rifle_barrel", quantity: 1 },
      { itemId: "rifle_stock", quantity: 1 },
      { itemId: "rifle_trigger", quantity: 1 },
      { itemId: "scope", quantity: 1 },
      { itemId: "large_spring", quantity: 1 },
    ],
  },
  {
    id: "craft_ak",
    station: "workbench",
    blueprintItemId: "blueprint_ak",
    output: { itemId: "weapon_assault_rifle", quantity: 1 },
    inputs: [
      { itemId: "ak_receiver", quantity: 1 },
      { itemId: "ak_barrel", quantity: 1 },
      { itemId: "ak_stock", quantity: 1 },
      { itemId: "rifle_trigger", quantity: 1 },
      { itemId: "large_spring", quantity: 1 },
    ],
  },
  {
    id: "craft_m4",
    station: "workbench",
    blueprintItemId: "blueprint_m4",
    output: { itemId: "weapon_m4a1", quantity: 1 },
    inputs: [
      { itemId: "m4_receiver", quantity: 1 },
      { itemId: "m4_barrel", quantity: 1 },
      { itemId: "m4_stock", quantity: 1 },
      { itemId: "rifle_trigger", quantity: 1 },
      { itemId: "large_spring", quantity: 1 },
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
    if (!isPocketSlot(i) && !isBackpackStorageIndex(i)) continue;
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

function inventoryAfterCraftInputs(
  inventory: Inventory,
  recipe: CraftRecipe,
  deferSlots: readonly number[],
): Inventory | null {
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
  return next;
}

export function canCraftRecipe(
  inventory: Inventory,
  recipe: CraftRecipe,
  extraPockets?: number,
): boolean {
  const next = inventoryAfterCraftInputs(inventory, recipe, []);
  if (!next) return false;
  return canAddToInventory(
    next,
    recipe.output.itemId,
    recipe.output.quantity,
    extraPockets,
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
  extraPockets?: number,
): Inventory | null {
  const next = inventoryAfterCraftInputs(inventory, recipe, deferSlots);
  if (!next) return null;
  if (
    !canAddToInventory(
      next,
      recipe.output.itemId,
      recipe.output.quantity,
      extraPockets,
    )
  ) {
    return null;
  }
  return addToInventory(
    next,
    recipe.output.itemId,
    recipe.output.quantity,
    extraPockets,
  );
}

/** Parts returned when a firearm is broken down without its blueprint. The rest are ruined. */
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

/**
 * Every part from the learned blueprint, in craft order.
 * Null when that blueprint has not been learned.
 */
export function blueprintDisassemblyYield(
  recipe: DisassemblyRecipe,
  learnedRecipeIds: ReadonlySet<string>,
): { id: string; quantity: number }[] | null {
  const craft = CRAFT_RECIPES.find(
    (entry) =>
      !!entry.blueprintItemId && entry.output.itemId === recipe.weaponId,
  );
  if (!craft || !learnedRecipeIds.has(craft.id)) return null;
  const yields: { id: string; quantity: number }[] = [];
  for (const ing of craft.inputs) {
    if (!isCraftItemQty(ing)) return null;
    yields.push({ id: ing.itemId, quantity: ing.quantity });
  }
  return yields;
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

function emptySlotsFor(
  inventory: Inventory,
  itemId: string,
  extraPockets?: number,
): number {
  const access = inventorySlotAccess(inventory, extraPockets);
  let n = 0;
  for (let i = 0; i < inventory.length; i++) {
    if (!inventory[i] && itemFitsInSlot(itemId, i, access)) n++;
  }
  return n;
}

function yieldFits(
  inventory: Inventory,
  yields: readonly { id: string; quantity: number }[],
  extraPockets?: number,
): boolean {
  let next = inventory;
  for (const part of yields) {
    if (!canAddToInventory(next, part.id, part.quantity, extraPockets)) {
      return false;
    }
    next = addToInventory(next, part.id, part.quantity, extraPockets);
  }
  return true;
}

/**
 * True when the player has the gun and the parts will fit after it is removed.
 * A learned blueprint needs room for every part. Otherwise any 3 parts must fit.
 */
export function canDisassemble(
  inventory: Inventory,
  recipe: DisassemblyRecipe,
  deferSlots: readonly number[] = [],
  extraPockets?: number,
  learnedRecipeIds: ReadonlySet<string> = new Set(),
): boolean {
  if (countItemInInventory(inventory, recipe.weaponId) < 1) return false;
  const next = consumeCraftInput(inventory, recipe.weaponId, 1, deferSlots);
  const full = blueprintDisassemblyYield(recipe, learnedRecipeIds);
  if (full) return yieldFits(next, full, extraPockets);
  const needsSlot = recipe.parts.filter((id) => stackedRoom(next, id) < 1);
  const slotsNeeded = Math.min(recipe.returnCount, needsSlot.length);
  if (slotsNeeded === 0) return true;
  return emptySlotsFor(next, needsSlot[0]!, extraPockets) >= slotsNeeded;
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
 * Destroy one gun and return parts.
 * A learned blueprint returns every craft part. Otherwise a random subset.
 * A gun in the pockets is taken before one on the hotbar.
 * Returns null when the gun is missing or the parts will not fit.
 */
export function applyDisassembly(
  inventory: Inventory,
  recipe: DisassemblyRecipe,
  rng: () => number = Math.random,
  deferSlots: readonly number[] = [],
  learnedRecipeIds: ReadonlySet<string> = new Set(),
  extraPockets?: number,
): DisassemblyResult | null {
  if (
    !canDisassemble(
      inventory,
      recipe,
      deferSlots,
      extraPockets,
      learnedRecipeIds,
    )
  ) {
    return null;
  }
  const full = blueprintDisassemblyYield(recipe, learnedRecipeIds);
  let next = consumeCraftInput(inventory, recipe.weaponId, 1, deferSlots);
  const salvaged: { id: string; quantity: number }[] = [];
  if (full) {
    for (const part of full) {
      if (!canAddToInventory(next, part.id, part.quantity, extraPockets)) {
        return null;
      }
      next = addToInventory(next, part.id, part.quantity, extraPockets);
      salvaged.push({ id: part.id, quantity: part.quantity });
    }
    return { inventory: next, salvaged, ruined: [] };
  }
  const picked = pickDistinctParts(recipe.parts, recipe.returnCount, rng);
  for (const id of picked) {
    if (!canAddToInventory(next, id, 1, extraPockets)) return null;
    next = addToInventory(next, id, 1, extraPockets);
    salvaged.push({ id, quantity: 1 });
  }
  const kept = new Set(picked);
  return {
    inventory: next,
    salvaged,
    ruined: recipe.parts.filter((id) => !kept.has(id)),
  };
}
