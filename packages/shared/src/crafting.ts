import {
  canAddToInventory,
  addToInventory,
  countItemInInventory,
  removeItemFromInventory,
  type Inventory,
} from "./items.js";

export type CraftItemQty = { itemId: string; quantity: number };

/** Single required stack, or any one option from a list (e.g. Old Teddy / Teddy). */
export type CraftIngredient = CraftItemQty | { anyOf: CraftItemQty[] };

export type CraftRecipe = {
  id: string;
  station: "workbench";
  output: CraftItemQty;
  inputs: CraftIngredient[];
  /** Craft channel duration; defaults to CRAFT_DURATION_MS. */
  durationMs?: number;
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
    output: { itemId: "rags", quantity: 4 },
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
    id: "bandages_from_alcohol_rags",
    station: "workbench",
    output: { itemId: "bandages", quantity: 2 },
    inputs: [
      { itemId: "alcohol", quantity: 1 },
      { itemId: "rags", quantity: 4 },
    ],
  },
  {
    id: "hammer_from_scrap",
    station: "workbench",
    output: { itemId: "weapon_hammer", quantity: 1 },
    inputs: [
      { itemId: "scrap_metal", quantity: 2 },
      { itemId: "screws", quantity: 8 },
      { itemId: "duct_tape", quantity: 1 },
    ],
  },
  {
    id: "screws_from_scrap",
    station: "workbench",
    output: { itemId: "screws", quantity: 2 },
    inputs: [{ itemId: "scrap_metal", quantity: 1 }],
  },
  {
    id: "bolts_from_scrap",
    station: "workbench",
    output: { itemId: "bolts", quantity: 2 },
    inputs: [{ itemId: "scrap_metal", quantity: 1 }],
  },
] as const;

export function getCraftRecipe(recipeId: string): CraftRecipe | undefined {
  return CRAFT_RECIPES.find((r) => r.id === recipeId);
}

export function isCraftItemQty(ing: CraftIngredient): ing is CraftItemQty {
  return "itemId" in ing;
}

/** First matching anyOf option the player can afford, or the single required stack. */
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
 * Consume inputs and add output. Returns null if the craft is not possible.
 */
export function applyCraftRecipe(
  inventory: Inventory,
  recipe: CraftRecipe,
): Inventory | null {
  if (!canCraftRecipe(inventory, recipe)) return null;
  let next = inventory;
  for (const ing of recipe.inputs) {
    const resolved = resolveCraftIngredient(next, ing);
    if (!resolved) return null;
    next = removeItemFromInventory(next, resolved.itemId, resolved.quantity);
  }
  if (!canAddToInventory(next, recipe.output.itemId, recipe.output.quantity)) {
    return null;
  }
  return addToInventory(next, recipe.output.itemId, recipe.output.quantity);
}
