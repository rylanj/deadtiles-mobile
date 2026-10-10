import { factionStanding } from "./factionRep.js";
import {
  addToInventory,
  canAddToInventory,
  cloneInventory,
  countItemInInventory,
  getAmmoTypeForWeapon,
  getEntryDurability,
  getItemDefinition,
  getMaxDurability,
  BACKPACK_SLOT_INDEX,
  backpackHoldsItems,
  backpackStorageHasItems,
  inventoryAddRoom,
  inventorySlotAccess,
  isBackpackStorageIndex,
  isItemRarity,
  isPocketSlot,
  isWeaponSlot,
  itemFitsInSlot,
  makeInventoryEntry,
  maxStackForItem,
  normalizeItemMeta,
  normalizedMagazineRounds,
  removeItemFromInventory,
  removeStoredMagazine,
  setStoredMagazineRounds,
  type Inventory,
  type InventoryEntry,
  type WeaponMagazines,
} from "./items.js";

/** How long a player listing stays on the board. */
export const MARKET_LISTING_MS = 48 * 60 * 60 * 1000;
/** Survivor ads loaded at once. The rest stay in the database until the next page. */
export const MARKET_BOARD_PAGE_SIZE = 20;
export type MarketBoardSort = "new" | "cheap";
/** Whole-note price cap for one listing. */
export const MARKET_PRICE_MAX = 1_000_000;
/** Unpaid notes held at the market desk. */
export const MARKET_BALANCE_MAX = 1_000_000_000;
/** Leftover goods still waiting at the desk. New expirations stay on the seller's ads. */
export const MARKET_RETURNS_MAX = 48;

export type MarketListingWire = {
  id: number;
  itemId: string;
  quantity: number;
  price: number;
  payout: number;
  sellerName: string;
  yours: boolean;
  /** Sold, and the payout is still uncollected. Counts toward the listing cap. */
  awaitingPayout: boolean;
  /** Time ran out and the item is still held. Counts toward the listing cap. */
  expired: boolean;
  /** This row is part of the current survivor-ads page. */
  onBoard: boolean;
  expiresAt: number;
  condition: number;
  rarity: string;
  durability?: number;
};

export type MarketReturnWire = {
  id: number;
  itemId: string;
  quantity: number;
  condition: number;
  rarity: string;
  durability?: number;
};

export type MarketDeskWire = {
  banknotes: number;
  returns: MarketReturnWire[];
  listingCap: number;
  activeCount: number;
  feePercent: number;
};

/**
 * Cut taken when a listing sells.
 * Wary 20%, Neutral 15%, Warm 10%, Friendly 5%, Allied 0%.
 * Charged on the sale, not when the listing is posted.
 */
export function marketFeeRate(reputation: number): number {
  switch (factionStanding(reputation)) {
    case "allied":
      return 0;
    case "friendly":
      return 0.05;
    case "warm":
      return 0.1;
    case "neutral":
      return 0.15;
    case "wary":
      return 0.2;
    default:
      return 0.2;
  }
}

export function marketFeePercent(reputation: number): number {
  return Math.round(marketFeeRate(reputation) * 100);
}

/** Active sell listings allowed at once. Hostile and Exiled get none. */
export function marketListingCap(reputation: number): number {
  switch (factionStanding(reputation)) {
    case "allied":
      return 30;
    case "friendly":
      return 20;
    case "warm":
      return 10;
    case "neutral":
      return 5;
    case "wary":
      return 1;
    default:
      return 0;
  }
}

/**
 * Notes the seller receives after the cut. The cut is destroyed.
 * A cut above 0% is rounded down, and at least 1 note. Allied pays no cut.
 */
export function marketSalePayout(price: number, reputation: number): number {
  if (!Number.isInteger(price) || price < 1 || price > MARKET_PRICE_MAX) return 0;
  const rate = marketFeeRate(reputation);
  if (rate <= 0) return price;
  const cut = Math.max(1, Math.floor(price * rate));
  return Math.max(0, price - cut);
}

export function validMarketPrice(price: number): boolean {
  return Number.isInteger(price) && price >= 1 && price <= MARKET_PRICE_MAX;
}

function itemTotals(inventory: Inventory): Map<string, number> {
  const totals = new Map<string, number>();
  for (const slot of inventory) {
    if (!slot || slot.quantity <= 0) continue;
    totals.set(slot.id, (totals.get(slot.id) ?? 0) + slot.quantity);
  }
  return totals;
}

/** True when the only quantity changes are the expected per-item deltas. */
export function marketCountsMatch(
  before: Inventory,
  after: Inventory,
  expected: readonly { id: string; delta: number }[],
): boolean {
  const prior = itemTotals(before);
  const next = itemTotals(after);
  const want = new Map<string, number>();
  for (const row of expected) {
    want.set(row.id, (want.get(row.id) ?? 0) + row.delta);
  }
  const ids = new Set<string>([...prior.keys(), ...next.keys(), ...want.keys()]);
  for (const id of ids) {
    const delta = (next.get(id) ?? 0) - (prior.get(id) ?? 0);
    if (delta !== (want.get(id) ?? 0)) return false;
  }
  return true;
}

/**
 * Rebuild a listing payload from stored JSON.
 * Unknown items, banknotes, and out-of-range stacks are rejected.
 */
export function sanitizeMarketItem(raw: unknown): InventoryEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const source = raw as Record<string, unknown>;
  if (typeof source.id !== "string") return null;
  const def = getItemDefinition(source.id);
  if (!def || def.id === "banknote") return null;
  if (typeof source.quantity !== "number" || !Number.isInteger(source.quantity)) {
    return null;
  }
  const maxStack = maxStackForItem(def.id);
  if (source.quantity < 1 || source.quantity > maxStack) return null;
  const entry = makeInventoryEntry(
    def.id,
    source.quantity,
    typeof source.magazineRounds === "number" ? source.magazineRounds : undefined,
    {
      rarity: isItemRarity(source.rarity) ? source.rarity : undefined,
      condition: typeof source.condition === "number" ? source.condition : undefined,
      durability: typeof source.durability === "number" ? source.durability : undefined,
      wetness: typeof source.wetness === "number" ? source.wetness : undefined,
      radioFreq: typeof source.radioFreq === "number" ? source.radioFreq : undefined,
      contents: Array.isArray(source.contents)
        ? (source.contents as InventoryEntry["contents"])
        : undefined,
    },
  );
  if (entry.id !== def.id || entry.quantity !== source.quantity) return null;
  return entry;
}

export function serializeMarketItem(entry: InventoryEntry): string | null {
  const clean = sanitizeMarketItem(entry);
  if (!clean) return null;
  const json = JSON.stringify(clean);
  if (json.length > 2000) return null;
  return json;
}

export function parseMarketItem(json: string): InventoryEntry | null {
  if (typeof json !== "string" || json.length === 0 || json.length > 2000) return null;
  try {
    return sanitizeMarketItem(JSON.parse(json) as unknown);
  } catch {
    return null;
  }
}

export function marketItemWireFields(entry: InventoryEntry): {
  itemId: string;
  quantity: number;
  condition: number;
  rarity: string;
  durability?: number;
} {
  const { rarity, condition } = normalizeItemMeta(entry);
  const wire: {
    itemId: string;
    quantity: number;
    condition: number;
    rarity: string;
    durability?: number;
  } = {
    itemId: entry.id,
    quantity: entry.quantity,
    condition,
    rarity,
  };
  if (getMaxDurability(entry.id) != null) {
    wire.durability = getEntryDurability(entry);
  }
  return wire;
}

function copiesOutside(
  inventory: Inventory,
  slotIndex: number,
  itemId: string,
): number {
  let total = 0;
  for (let i = 0; i < inventory.length; i++) {
    if (i === slotIndex) continue;
    const slot = inventory[i];
    if (slot?.id === itemId) total += slot.quantity;
  }
  return total;
}

/** Pocket stacks, plus a hotbar weapon when it is the only copy in hand. */
export function isMarketListableSlot(
  inventory: Inventory,
  slotIndex: number,
  equippedSlot: number,
): boolean {
  if (slotIndex === BACKPACK_SLOT_INDEX && backpackStorageHasItems(inventory)) {
    return false;
  }
  if (
    !isPocketSlot(slotIndex) &&
    !isBackpackStorageIndex(slotIndex) &&
    slotIndex !== BACKPACK_SLOT_INDEX &&
    !isWeaponSlot(slotIndex)
  ) {
    return false;
  }
  const slot = inventory[slotIndex];
  if (!slot || !Number.isInteger(slot.quantity) || slot.quantity <= 0) return false;
  const def = getItemDefinition(slot.id);
  if (!def || def.id === "banknote") return false;
  if (slotIndex === equippedSlot && copiesOutside(inventory, slotIndex, slot.id) > 0) {
    return false;
  }
  return true;
}

function magazinesAfterGrant(
  before: WeaponMagazines,
  placedSlot: number,
  rounds: number,
  isGun: boolean,
): WeaponMagazines | null {
  if (!isGun || placedSlot < 0) return { ...before };
  const next = { ...before };
  if (rounds > 0) next[String(placedSlot)] = rounds;
  else delete next[String(placedSlot)];
  return next;
}

function grantMagazinesOk(
  before: WeaponMagazines,
  after: WeaponMagazines,
  placedSlot: number,
  rounds: number,
  isGun: boolean,
): boolean {
  if (!isGun || placedSlot < 0) {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const key of keys) {
      if ((before[key] ?? 0) !== (after[key] ?? 0)) return false;
    }
    return true;
  }
  const slotKey = String(placedSlot);
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of keys) {
    const left = before[key] ?? 0;
    const right = after[key] ?? 0;
    if (key === slotKey) {
      if (right !== rounds) return false;
    } else if (right !== left) {
      return false;
    }
  }
  return (after[slotKey] ?? 0) === rounds;
}

/**
 * Put an escrowed stack into a pack. Fails closed when it does not all fit.
 * Gun rounds replace any orphan magazine on the destination slot.
 */
export function grantMarketItem(
  inventory: Inventory,
  magazines: WeaponMagazines,
  entry: InventoryEntry,
): { inventory: Inventory; magazines: WeaponMagazines; placedSlot: number } | null {
  const clean = sanitizeMarketItem(entry);
  if (!clean) return null;
  if (!canAddToInventory(inventory, clean.id, clean.quantity)) return null;
  const beforeCount = countItemInInventory(inventory, clean.id);
  const access = inventorySlotAccess(inventory);
  const next = cloneInventory(inventory);
  const maxStack = maxStackForItem(clean.id);
  let remaining = clean.quantity;
  let placedSlot = -1;

  for (let i = 0; i < next.length && remaining > 0; i++) {
    if (!itemFitsInSlot(clean.id, i, access)) continue;
    const slot = next[i];
    if (!slot || slot.id !== clean.id) continue;
    const room = maxStack - slot.quantity;
    if (room <= 0) continue;
    const add = Math.min(room, remaining);
    slot.quantity += add;
    remaining -= add;
  }

  for (let i = 0; i < next.length && remaining > 0; i++) {
    if (!itemFitsInSlot(clean.id, i, access) || next[i]) continue;
    const add = Math.min(maxStack, remaining);
    const isFirstNew = placedSlot < 0;
    next[i] = makeInventoryEntry(
      clean.id,
      add,
      isFirstNew ? clean.magazineRounds : undefined,
      clean,
    );
    if (isFirstNew) placedSlot = i;
    remaining -= add;
  }

  if (remaining !== 0) return null;
  if (countItemInInventory(next, clean.id) !== beforeCount + clean.quantity) return null;

  const isGun = getAmmoTypeForWeapon(clean.id) != null;
  const rounds = isGun ? (normalizedMagazineRounds(clean.id, clean.magazineRounds) ?? 0) : 0;
  const nextMags = magazinesAfterGrant(magazines, placedSlot, rounds, isGun);
  if (!nextMags || !grantMagazinesOk(magazines, nextMags, placedSlot, rounds, isGun)) {
    return null;
  }
  return { inventory: next, magazines: nextMags, placedSlot };
}

/** Pay `price` notes from pockets, then take the escrowed stack. */
export function applyMarketPurchase(
  inventory: Inventory,
  magazines: WeaponMagazines,
  entry: InventoryEntry,
  price: number,
): { inventory: Inventory; magazines: WeaponMagazines } | null {
  const clean = sanitizeMarketItem(entry);
  if (!clean || !validMarketPrice(price)) return null;
  const beforeNotes = countItemInInventory(inventory, "banknote");
  if (beforeNotes < price) return null;
  const paid = removeItemFromInventory(inventory, "banknote", price, "pockets-first");
  if (countItemInInventory(paid, "banknote") !== beforeNotes - price) return null;
  const granted = grantMarketItem(paid, magazines, clean);
  if (!granted) return null;
  const notesOk = marketCountsMatch(inventory, granted.inventory, [
    { id: "banknote", delta: -price },
    { id: clean.id, delta: clean.quantity },
  ]);
  if (!notesOk) return null;
  const isGun = getAmmoTypeForWeapon(clean.id) != null;
  const rounds = isGun ? (clean.magazineRounds ?? 0) : 0;
  if (!grantMagazinesOk(magazines, granted.magazines, granted.placedSlot, rounds, isGun)) {
    return null;
  }
  return { inventory: granted.inventory, magazines: granted.magazines };
}

export type MarketTakeResult =
  | { ok: false; error: string }
  | {
      ok: true;
      inventory: Inventory;
      magazines: WeaponMagazines;
      entry: InventoryEntry;
      unequip: boolean;
    };

/** Pull one stack off a slot and into escrow. Does not touch the caller's objects. */
export function takeMarketListing(args: {
  inventory: Inventory;
  magazines: WeaponMagazines;
  slotIndex: number;
  itemId: string;
  quantity: number;
  equippedSlot: number;
  equippedRounds: number;
}): MarketTakeResult {
  const { inventory, magazines, slotIndex, itemId, quantity, equippedSlot } = args;
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= inventory.length) {
    return { ok: false, error: "That slot changed." };
  }
  if (!Number.isInteger(quantity) || quantity < 1) {
    return { ok: false, error: "Choose how many to list." };
  }
  if (!isMarketListableSlot(inventory, slotIndex, equippedSlot)) {
    const slot = inventory[slotIndex];
    if (slot && slotIndex === equippedSlot) {
      return {
        ok: false,
        error: "List the spare in your pockets. The one in your hands stays.",
      };
    }
    return { ok: false, error: "You can't list that." };
  }
  const slot = inventory[slotIndex];
  if (!slot) return { ok: false, error: "That slot changed." };
  if (backpackHoldsItems(inventory, slotIndex)) {
    return { ok: false, error: "Empty the pack, or drop it on the floor." };
  }
  const claimed = getItemDefinition(itemId);
  const actual = getItemDefinition(slot.id);
  if (!claimed || !actual || claimed.id !== actual.id) {
    return { ok: false, error: "That slot changed." };
  }
  const available = Math.min(slot.quantity, maxStackForItem(actual.id));
  if (available < 1) return { ok: false, error: "You don't have that many." };
  const listQty = Math.min(quantity, available);

  const equipped = slotIndex === equippedSlot;
  const storedRounds = magazines[String(slotIndex)] ?? 0;
  const liveRounds = Math.max(0, Math.floor(args.equippedRounds));
  const sourceRounds = equipped ? liveRounds : storedRounds;
  const entry = makeInventoryEntry(actual.id, listQty, sourceRounds, slot);
  if (!sanitizeMarketItem(entry)) return { ok: false, error: "You can't list that." };

  const next = inventory.map((cell) => (cell ? { ...cell } : null));
  const target = next[slotIndex];
  if (!target || target.quantity < listQty) {
    return { ok: false, error: "That slot changed." };
  }
  target.quantity -= listQty;
  const emptied = target.quantity <= 0;
  if (emptied) next[slotIndex] = null;

  let nextMags = magazines;
  if (emptied && getAmmoTypeForWeapon(actual.id)) {
    nextMags = removeStoredMagazine(magazines, slotIndex);
  }
  for (const key of new Set([...Object.keys(magazines), ...Object.keys(nextMags)])) {
    if ((nextMags[key] ?? 0) > (magazines[key] ?? 0)) {
      return { ok: false, error: "You can't list that." };
    }
  }
  if (!marketCountsMatch(inventory, next, [{ id: actual.id, delta: -listQty }])) {
    return { ok: false, error: "You can't list that." };
  }

  return {
    ok: true,
    inventory: next,
    magazines: nextMags,
    entry,
    unequip: equipped && emptied,
  };
}

export type MarketCollectResult = {
  inventory: Inventory;
  magazines: WeaponMagazines;
  notesTaken: number;
  returnIds: number[];
};

/** Add a sold listing's payout. Zero pays nothing. Null when the notes do not fit. */
export function applyMarketPayout(inventory: Inventory, payout: number): Inventory | null {
  if (!Number.isInteger(payout) || payout < 0) return null;
  if (payout === 0) return inventory;
  if (!canAddToInventory(inventory, "banknote", payout)) return null;
  const next = addToInventory(inventory, "banknote", payout);
  if (!marketCountsMatch(inventory, next, [{ id: "banknote", delta: payout }])) return null;
  return next;
}

/**
 * Take what fits from the desk. Notes first, then as many returns as the pack holds.
 * Null means the math failed closed and nothing should be committed.
 */
export function applyMarketCollect(args: {
  inventory: Inventory;
  magazines: WeaponMagazines;
  balance: number;
  returns: readonly { id: number; item: InventoryEntry }[];
}): MarketCollectResult | null {
  const balance = Math.max(0, Math.floor(args.balance));
  let inventory = args.inventory;
  let magazines = args.magazines;
  const room = inventoryAddRoom(inventory, "banknote");
  const notesTaken = Math.min(balance, Math.max(0, room));
  if (notesTaken > 0) {
    if (!canAddToInventory(inventory, "banknote", notesTaken)) return null;
    const paid = addToInventory(inventory, "banknote", notesTaken);
    if (
      !marketCountsMatch(inventory, paid, [{ id: "banknote", delta: notesTaken }])
    ) {
      return null;
    }
    inventory = paid;
  }

  const returnIds: number[] = [];
  const gained = new Map<string, number>();
  for (const row of args.returns) {
    if (!Number.isInteger(row.id) || row.id <= 0) continue;
    const clean = sanitizeMarketItem(row.item);
    if (!clean) continue;
    const before = inventory;
    const beforeMags = magazines;
    const granted = grantMarketItem(before, beforeMags, clean);
    if (!granted) continue;
    if (
      !marketCountsMatch(before, granted.inventory, [
        { id: clean.id, delta: clean.quantity },
      ])
    ) {
      return null;
    }
    const isGun = getAmmoTypeForWeapon(clean.id) != null;
    const rounds = isGun ? (clean.magazineRounds ?? 0) : 0;
    if (
      !grantMagazinesOk(
        beforeMags,
        granted.magazines,
        granted.placedSlot,
        rounds,
        isGun,
      )
    ) {
      return null;
    }
    inventory = granted.inventory;
    magazines = granted.magazines;
    returnIds.push(row.id);
    gained.set(clean.id, (gained.get(clean.id) ?? 0) + clean.quantity);
  }

  const expected = [...gained.entries()].map(([id, delta]) => ({ id, delta }));
  if (notesTaken > 0) expected.push({ id: "banknote", delta: notesTaken });
  if (!marketCountsMatch(args.inventory, inventory, expected)) return null;
  return { inventory, magazines, notesTaken, returnIds };
}
