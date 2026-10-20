import {
  BACKPACK_STORAGE_START,
  BASE_INVENTORY_SLOTS,
  POCKET_SLOT_COUNT,
  WEAPON_SLOT_COUNT,
  retiredPocketIndices,
  shownBackpackStorageCount,
  shownExtraPockets,
  type Inventory,
} from "@zombie/shared";

export function carrySlotIndices(
  inventory: Inventory,
  extraPockets: number,
): number[] {
  const indices: number[] = [];
  for (let i = 0; i < POCKET_SLOT_COUNT; i++) {
    indices.push(WEAPON_SLOT_COUNT + i);
  }
  for (const idx of retiredPocketIndices(inventory)) indices.push(idx);
  const extra = shownExtraPockets(inventory, extraPockets);
  for (let i = 0; i < extra; i++) indices.push(BASE_INVENTORY_SLOTS + i);
  const pack = shownBackpackStorageCount(inventory);
  for (let i = 0; i < pack; i++) indices.push(BACKPACK_STORAGE_START + i);
  return indices;
}

export function carrySlotStats(
  inventory: Inventory,
  extraPockets: number,
): { used: number; total: number } {
  const indices = carrySlotIndices(inventory, extraPockets);
  let used = 0;
  for (const idx of indices) {
    if (inventory[idx]) used += 1;
  }
  return { used, total: indices.length };
}

/** Pockets (base, retired and extra) and worn backpack storage, counted apart. */
export function carrySlotGroups(
  inventory: Inventory,
  extraPockets: number,
): { pockets: number[]; backpack: number[] } {
  const pockets: number[] = [];
  const backpack: number[] = [];
  for (const idx of carrySlotIndices(inventory, extraPockets)) {
    if (idx >= BACKPACK_STORAGE_START) backpack.push(idx);
    else pockets.push(idx);
  }
  return { pockets, backpack };
}

export function usedSlotCount(inventory: Inventory, indices: number[]): number {
  let used = 0;
  for (const idx of indices) {
    if (inventory[idx]) used += 1;
  }
  return used;
}

export function formatCarrySlots(
  inventory: Inventory,
  extraPockets: number,
): string {
  const { used, total } = carrySlotStats(inventory, extraPockets);
  return `${used}/${total}`;
}
