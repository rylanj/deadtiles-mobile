/**
 * Prefab structure material costs + solid structure HP defaults.
 * Placement/deposit/build channel wire up in Phase 2.
 */

export const STRUCTURE_BUILD_KINDS = [
  "wall",
  "door",
  "fireplace",
  "fence",
  "fence_corner",
  "bargate",
  "storage_box",
  "storage_box_2",
] as const;

export type StructureBuildKind = (typeof STRUCTURE_BUILD_KINDS)[number];

export function isStructureBuildKind(kind: unknown): kind is StructureBuildKind {
  return (
    kind === "wall" ||
    kind === "door" ||
    kind === "fireplace" ||
    kind === "fence" ||
    kind === "fence_corner" ||
    kind === "bargate" ||
    kind === "storage_box" ||
    kind === "storage_box_2"
  );
}

export type StructureStatus = "prefab" | "solid";

export type BuildCostLine = {
  itemId: string;
  quantity: number;
};

export type StructureDeposits = Record<string, number>;

/** Channel time to convert a funded prefab into a solid structure. */
export const PREFAB_BUILD_DURATION_MS = 30_000;

/** Channel time for an owner to deconstruct a completed structure. */
export const STRUCTURE_DECONSTRUCT_DURATION_MS = 30_000;

/** Hammer use-count durability spent when placing a ghost prefab. */
export const PREFAB_PLACE_HAMMER_WEAR = 1;

/**
 * Unfinished prefabs one player may have at once.
 * Finishing, cancelling, destroying, or a restart that drops the ghost frees a slot.
 * Fence corners are created by the fence and do not use a slot.
 */
export const MAX_UNBUILT_PREFABS = 10;

export function countsTowardUnbuiltPrefabCap(rec: {
  status: string;
  kind: string;
}): boolean {
  return rec.status === "prefab" && rec.kind !== "fence_corner";
}

/** Hammer use-count durability spent when a prefab finishes building. */
export const PREFAB_BUILD_HAMMER_WEAR = 10;

/** Default max HP for completed (solid) player structures. */
export const STRUCTURE_MAX_HEALTH: Record<StructureBuildKind, number> = {
  wall: 200,
  door: 150,
  fireplace: 100,
  fence: 80,
  fence_corner: 80,
  bargate: 80,
  storage_box: 80,
  storage_box_2: 120,
};

export const STRUCTURE_BUILD_COSTS: Record<
  StructureBuildKind,
  readonly BuildCostLine[]
> = {
  wall: [
    { itemId: "wood", quantity: 8 },
    { itemId: "scrap_metal", quantity: 2 },
    { itemId: "screws", quantity: 8 },
  ],
  door: [
    { itemId: "wood", quantity: 4 },
    { itemId: "scrap_metal", quantity: 1 },
    { itemId: "screws", quantity: 12 },
  ],
  fireplace: [
    { itemId: "wood", quantity: 4 },
    { itemId: "rags", quantity: 2 },
  ],
  // 3-tile barbed-wire run: two posts, the wire, and the clamps.
  fence: [
    { itemId: "wood", quantity: 2 },
    { itemId: "scrap_metal", quantity: 4 },
    { itemId: "bolts", quantity: 4 },
  ],
  // Auto-built where SE/SW panels meet. Players never deposit or channel it.
  fence_corner: [],
  // 3-tile gate: frame and mesh, plus hinge hardware. Heavier than a fence run.
  bargate: [
    { itemId: "wood", quantity: 4 },
    { itemId: "scrap_metal", quantity: 8 },
    { itemId: "bolts", quantity: 8 },
  ],
  storage_box: [
    { itemId: "wood", quantity: 1 },
    { itemId: "duct_tape", quantity: 1 },
  ],
  storage_box_2: [
    { itemId: "wood", quantity: 4 },
    { itemId: "screws", quantity: 4 },
    { itemId: "scrap_metal", quantity: 2 },
  ],
} as const;

export type StorageBoxKind = "storage_box" | "storage_box_2";

/** Slots in Storage Box 1. */
export const STORAGE_BOX_SLOTS = 8;

/** Slots in Storage Box 2. */
export const STORAGE_BOX2_SLOTS = 24;

/**
 * How many slots to read from a saved box. Covers the old 12-slot Storage Box 1
 * saves so extras can be spilled instead of deleted.
 */
export const STORAGE_BOX_INVENTORY_READ_CAP = 24;

/** Object type sent with the Storage Box 1 container UI. */
export const STORAGE_BOX_OBJECT_TYPE = "storagebox";

/** Object type sent with the Storage Box 2 container UI. */
export const STORAGE_BOX2_OBJECT_TYPE = "storagebox2";

/** Slots in a Birchport market safe deposit box. */
export const SAFE_DEPOSIT_SLOTS = 8;

/** Object type sent with the safe deposit container UI. */
export const SAFE_DEPOSIT_OBJECT_TYPE = "safedeposit";

/** Container id for the player's market safe deposit box. */
export const SAFE_DEPOSIT_CONTAINER_ID = "safedeposit";

export function isStorageBoxKind(kind: unknown): kind is StorageBoxKind {
  return kind === "storage_box" || kind === "storage_box_2";
}

export function storageBoxSlotCount(kind: StorageBoxKind): number {
  return kind === "storage_box_2" ? STORAGE_BOX2_SLOTS : STORAGE_BOX_SLOTS;
}

export function storageBoxObjectType(kind: StorageBoxKind): string {
  return kind === "storage_box_2"
    ? STORAGE_BOX2_OBJECT_TYPE
    : STORAGE_BOX_OBJECT_TYPE;
}

export function storageBoxSlotsForObjectType(objectType: string): number | null {
  if (objectType === STORAGE_BOX2_OBJECT_TYPE) return STORAGE_BOX2_SLOTS;
  if (objectType === STORAGE_BOX_OBJECT_TYPE) return STORAGE_BOX_SLOTS;
  if (objectType === SAFE_DEPOSIT_OBJECT_TYPE) return SAFE_DEPOSIT_SLOTS;
  return null;
}

/** Same id scheme as WorldRoom placement (`in:bx,by:x,y` / `ow:x,y`). */
export function playerStructureId(
  inInterior: boolean,
  buildingX: number,
  buildingY: number,
  x: number,
  y: number,
): string {
  return inInterior
    ? `in:${buildingX},${buildingY}:${x},${y}`
    : `ow:${x},${y}`;
}

export function getStructureBuildCosts(
  kind: StructureBuildKind,
): readonly BuildCostLine[] {
  return STRUCTURE_BUILD_COSTS[kind];
}

export function getStructureMaxHealth(kind: StructureBuildKind): number {
  return STRUCTURE_MAX_HEALTH[kind];
}

export function emptyStructureDeposits(): StructureDeposits {
  return {};
}

export function parseStructureDepositsJson(
  json: string | null | undefined,
): StructureDeposits {
  if (!json || typeof json !== "string" || json.length === 0) return {};
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    const out: StructureDeposits = {};
    for (const [itemId, qty] of Object.entries(
      parsed as Record<string, unknown>,
    )) {
      const n = Number(qty);
      if (!itemId || !Number.isFinite(n) || n <= 0) continue;
      out[itemId] = Math.floor(n);
    }
    return out;
  } catch {
    return {};
  }
}

/** True when at least one item has been deposited into a prefab. */
export function structureHasDeposits(deposits: StructureDeposits): boolean {
  for (const qty of Object.values(deposits)) {
    if ((qty ?? 0) > 0) return true;
  }
  return false;
}

export function serializeStructureDepositsJson(
  deposits: StructureDeposits,
): string {
  return JSON.stringify(deposits ?? {});
}

/** True when every required cost line is fully deposited. */
export function structureDepositsMeetCost(
  kind: StructureBuildKind,
  deposits: StructureDeposits,
): boolean {
  for (const line of STRUCTURE_BUILD_COSTS[kind]) {
    if ((deposits[line.itemId] ?? 0) < line.quantity) return false;
  }
  return true;
}

/** How many more of `itemId` can be deposited toward this kind. */
export function remainingDepositCapacity(
  kind: StructureBuildKind,
  deposits: StructureDeposits,
  itemId: string,
): number {
  const line = STRUCTURE_BUILD_COSTS[kind].find((l) => l.itemId === itemId);
  if (!line) return 0;
  return Math.max(0, line.quantity - (deposits[itemId] ?? 0));
}

/** Half the build cost (rounded down, min 1 per line). Refund on raid / deconstruct. */
export function partialStructureRefund(
  kind: StructureBuildKind,
  ratio = 0.5,
): BuildCostLine[] {
  const r = Number.isFinite(ratio) ? Math.max(0, Math.min(1, ratio)) : 0.5;
  return STRUCTURE_BUILD_COSTS[kind]
    .map((line) => ({
      itemId: line.itemId,
      quantity: Math.max(1, Math.floor(line.quantity * r)),
    }))
    .filter((line) => line.quantity > 0);
}
