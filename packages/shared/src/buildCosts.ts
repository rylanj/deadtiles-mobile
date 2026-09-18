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
] as const;

export type StructureBuildKind = (typeof STRUCTURE_BUILD_KINDS)[number];

export function isStructureBuildKind(kind: unknown): kind is StructureBuildKind {
  return (
    kind === "wall" ||
    kind === "door" ||
    kind === "fireplace" ||
    kind === "fence" ||
    kind === "fence_corner" ||
    kind === "bargate"
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
  // Temporary cheap cost while fence building is tuned.
  fence: [{ itemId: "scrap_metal", quantity: 1 }],
  // Auto-built where SE/SW panels meet. Players never deposit or channel it.
  fence_corner: [],
  bargate: [{ itemId: "scrap_metal", quantity: 1 }],
} as const;

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
