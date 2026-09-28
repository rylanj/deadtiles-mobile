import {
  INVENTORY_ITEMS,
  addToInventory,
  canAddToInventory,
  countItemInInventory,
  getItemDefinition,
  lootCategoryItemIds,
  maxStackForItem,
  removeFromInventorySlot,
  type Inventory,
  type InventoryEntry,
} from "./items.js";
import {
  FACTION_REP_ALLIED,
  FACTION_REP_EXILED,
  FACTION_REP_EXILED_THRESHOLD,
  FACTION_REP_FRIENDLY,
  FACTION_REP_HOSTILE,
  FACTION_REP_NEUTRAL,
  FACTION_REP_START,
  FACTION_REP_WARM,
  FACTION_REP_WARY,
  dropFactionReputationLevel,
  factionStanding,
  factionStandingLabel,
  type FactionStanding,
} from "./factionRep.js";

/** Trader starts with this many banknotes (inclusive range). Rolled fresh each restart. */
export const TRADER_BANKNOTES_MIN = 1000;
export const TRADER_BANKNOTES_MAX = 3000;

/**
 * Base banknote value per item.
 * Rates scale by standing (see ashenTraderRates) — Neutral is 100% buy / 20% sell.
 */
export const ITEM_TRADE_VALUES: Record<string, number> = {
  weapon_pistol: 250,
  weapon_shotgun: 1000,
  weapon_hunting_rifle: 2000,
  weapon_revolver: 300,
  weapon_assault_rifle: 2500,
  weapon_m4a1: 2600,
  weapon_hammer: 50,
  weapon_hatchet: 50,
  weapon_bat: 75,
  ammo_9x19: 10,
  ammo_buckshot: 15,
  ammo_762x39: 20,
  ammo_556x45: 30,
  ammo_44: 12,
  bandages: 15,
  rags: 5,
  alcohol: 20,
  antibiotics: 30,
  multivitamins: 10,
  screws: 10,
  bolts: 10,
  duct_tape: 8,
  scrap_metal: 10,
  wood: 10,
  banknote: 1,
  lighter: 20,
  dogtag: 20,
  blue_cigarettes: 20,
  white_tshirt: 50,
  black_tshirt: 50,
  gold_chain: 250,
  gold_earrings: 180,
  gold_ring: 150,
  silver_chain: 150,
  silver_ring: 90,
  old_teddy: 5,
  teddy: 10,
  map: 15,
  watch: 80,
  handheld_radio: 120,
  canned_beans: 20,
  canned_tuna: 20,
  canned_peaches: 20,
  hot_chips: 10,
  onion_chips: 10,
  salted_chips: 10,
  lemonada: 15,
  cola: 15,
  water: 20,
};

/** Ashen Traders faction display name. */
export const ASHEN_TRADERS_FACTION = "Ashen Traders";

export type AshenDialogLine = {
  id: string;
  /** Player speech option. */
  player: string;
  /** Reply variants from TraderMan. Later entries tend to be more informative. */
  npcMan: readonly string[];
  /** Reply variants from TraderGuard when different from the man. */
  npcGuard?: readonly string[];
  /** Opens the trade UI (TraderMan only). */
  action?: "trade";
};

/** Talk options for TraderMan / TraderGuard caravans. */
export const ASHEN_TRADER_DIALOG_LINES: readonly AshenDialogLine[] = [
  {
    id: "who",
    player: "What group are you with?",
    npcMan: [
      "Ashen Traders. We barter through Ashen County.",
      "Ashen Traders. We move through Ashen County picking up what we can and bartering with whoever's still standing. If you need something, we probably have it, or know who does.",
      "Ashen Traders. Road caravan. We scavenge, buy from survivors, and sell on through Ashen County. Ask if you need stock; if we don't have it, we often know the next stop that might.",
    ],
    npcGuard: [
      "Ashen Traders. He's the ledger. We keep the goods moving.",
      "Ashen Traders. He's the one with the ledger. We're here so the goods make it to the next stop.",
      "Traders. He handles deals. We watch the road and make sure this caravan isn't a free meal for bandits or walkers.",
    ],
  },
  {
    id: "trade",
    player: "Do you want to trade?",
    npcMan: [
      "Yeah. Show me what you've got.",
      "Sure. Let's see your pack.",
      "Always. Lay it out: ammo, meds, food, I deal in most of it.",
    ],
    npcGuard: [
      "Not me. Talk to the man with the ledger.",
      "I don't handle the stock. Talk to the man in the middle of the caravan.",
      "Guards don't price goods. Find the trader in the middle of the group.",
    ],
    action: "trade",
  },
  {
    id: "join",
    player: "Can I join you guys?",
    npcMan: [
      "Not taking people on. Try an Ashen Militia settlement for work.",
      "We're not taking new people on the road. Too many mouths, too little trust. If you want work, ask around at an Ashen Militia settlement. They post jobs when they need hands.",
      "Caravan's full. Trust's thin on the road anyway. Militia settlements post paid work when they need hands. Birchport's a fair place to ask.",
    ],
    npcGuard: [
      "Full caravan. Try the militia for paid work.",
      "Not our call. We already have a full caravan. Try the militia settlements if you're looking for paid work.",
      "We don't hire strays mid-route. Militia towns post jobs. That's your better bet.",
    ],
  },
  {
    id: "home",
    player: "Do you guys have a home?",
    npcMan: [
      "Mostly the road. A few stalls at militia settlements.",
      "Not really. Most of us stay on the road through Ashen County. A few keep stalls at Ashen Militia settlements so people know where to find us when a caravan isn't passing through.",
      "No fixed town. We're on the county roads most weeks. When a caravan isn't in, look for our stalls inside Ashen Militia settlements. That's where people expect to find us.",
    ],
  },
  {
    id: "militia",
    player: "Are you with the Ashen Militia?",
    npcMan: [
      "No. Separate. They let us trade in their towns.",
      "No. Separate group. The militia lets us trade at their settlements, and when bandits hit a caravan they sometimes ride out after them. We handle the goods. They handle the shooting, when they can spare it.",
      "Separate outfit. Militia settlements give us stalls; sometimes they chase bandits off a hit caravan if they've got people free. Goods are our job. Guns are theirs.",
    ],
    npcGuard: [
      "Separate. They help when bandits hit, when they can.",
      "Separate outfit. Militia looks the other way when we set up shop in their towns, and they've pulled our bacon out of the fire more than once on the road.",
      "Not militia. Same county, different badge. They've bailed out caravans before. Don't confuse that for us wearing their colors.",
    ],
  },
  {
    id: "roads",
    player: "How are the roads?",
    npcMan: [
      "Walkers usual. Bandits worse. We keep moving.",
      "Depends on the week. Walkers are the usual problem. Bandits are worse when they show up. We keep moving and try not to camp in the open longer than we have to.",
      "Week to week. Walkers are constant; bandits hit when a route looks soft. We don't linger in the open. Marked roads near militia posts are the least bad option.",
    ],
    npcGuard: [
      "Quiet never lasts. Keep a weapon ready.",
      "Quiet stretches don't stay quiet. Keep your weapon ready if you're walking the same routes we are.",
      "If you're on our routes, assume walkers and the odd ambush. Don't walk soft and alone if you can help it.",
    ],
  },
  {
    id: "stock",
    player: "What do you usually carry?",
    npcMan: [
      "Ammo, meds, food, the odd gun. Changes every stop.",
      "Whatever turns up. Ammo, medical gear, canned food, the odd firearm. We scavenge and buy from survivors, then sell it on. Stock changes every stop.",
      "Depends what we picked up. Common: ammo, bandages, canned food, sometimes a firearm. Scavenge and survivor buys. Don't expect the same crate twice.",
    ],
  },
  {
    id: "redorder",
    player: "Know anything about the Red Order?",
    npcMan: [
      "City crew. We don't stop on their turf. Neither should you.",
      "They hold pieces of the cities and don't care for us. Stay clear of their buildings if you can. We don't stop there, and neither should you if you like keeping your gear.",
      "Red Order: city blocks, red armbands. Bad news for traders. We skip their buildings entirely; walk in and you may not walk out with your pack.",
    ],
    npcGuard: [
      "Red armbands. Avoid their buildings.",
      "City crew with red armbands. We avoid their turf. You should too.",
      "Red Order turf is a hard no. They don't like Ashen caravans, and they don't like visitors asking questions.",
    ],
  },
  {
    id: "bye",
    player: "That's all for now.",
    npcMan: [
      "Alright.",
      "Alright. Stay on the marked roads if you can.",
      "Safe travels. Stick to marked roads near the militia posts when you can.",
    ],
    npcGuard: [
      "Watch yourselves.",
      "Watch yourselves out there.",
      "Keep moving. Don't lead walkers back to the caravan.",
    ],
  },
];

export function ashenDialogLineById(id: string): AshenDialogLine | undefined {
  return ASHEN_TRADER_DIALOG_LINES.find((line) => line.id === id);
}

/**
 * Reputation thresholds (lower bound of each standing band).
 * Shared with all factions — see {@link factionStanding}.
 * Exiled: < −100 · Hostile: [−100, 0) · Wary: [0, 500) · Neutral: [500, 1000)
 * Warm: [1000, 2500) · Friendly: [2500, 5000) · Allied: ≥ 5000
 *
 * +1 per $ given to the trader (player buys); +0.1 per $ taken (player sells).
 * When the trader cannot cover a sell in cash, each unpaid $ also grants +0.1.
 * Everyone starts at 0 (Wary).
 */
export const ASHEN_REP_EXILED_THRESHOLD = FACTION_REP_EXILED_THRESHOLD;
/** Value assigned when dropping into Exiled. */
export const ASHEN_REP_EXILED = FACTION_REP_EXILED;
export const ASHEN_REP_HOSTILE = FACTION_REP_HOSTILE;
/** Starting reputation for new players (Wary). */
export const ASHEN_REP_START = FACTION_REP_START;
export const ASHEN_REP_WARY = FACTION_REP_WARY;
export const ASHEN_REP_NEUTRAL = FACTION_REP_NEUTRAL;
export const ASHEN_REP_WARM = FACTION_REP_WARM;
export const ASHEN_REP_FRIENDLY = FACTION_REP_FRIENDLY;
export const ASHEN_REP_ALLIED = FACTION_REP_ALLIED;

/** Reputation gained per banknote paid to the trader. */
export const ASHEN_REP_PER_DOLLAR_GIVEN = 1;
/** Reputation gained per banknote received from the trader. */
export const ASHEN_REP_PER_DOLLAR_TAKEN = 0.1;

/** Hostile band recovers +1 toward 0 every this many wall-clock ms. */
export const ASHEN_HOSTILE_RECOVERY_MS = 30 * 60 * 1000;
export const ASHEN_HOSTILE_RECOVERY_PER_INTERVAL = 1;

export type AshenStanding = FactionStanding;

export function ashenStanding(reputation: number): AshenStanding {
  return factionStanding(reputation);
}

export function ashenStandingLabel(standing: AshenStanding): string {
  return factionStandingLabel(standing);
}

/** True when Ashen Traders shoot the player on sight (Exiled only). */
export function isAshenExiled(reputation: number): boolean {
  return ashenStanding(reputation) === "exiled";
}

/** @deprecated Use {@link isAshenExiled} — shoot-on-sight is Exiled now. */
export function isAshenHostile(reputation: number): boolean {
  return isAshenExiled(reputation);
}

/** True while in the Hostile band (−100 ≤ rep < 0), which passively recovers. */
export function isAshenHostileBand(reputation: number): boolean {
  return ashenStanding(reputation) === "hostile";
}

/** Exiled and Hostile cannot open trade (Hostile get a leave-or-we-shoot warning). */
export function canTradeWithAshen(reputation: number): boolean {
  const standing = ashenStanding(reputation);
  return standing !== "exiled" && standing !== "hostile";
}

/**
 * Drop one standing level after attacking traders.
 * Allied → Friendly → Warm → Neutral → Wary → Hostile → Exiled.
 */
export function dropAshenReputationLevel(reputation: number): number {
  return dropFactionReputationLevel(reputation);
}

/**
 * Apply Hostile passive recovery toward 0 (+1 per 30 real-life minutes).
 * Exiled never recovers. Returns updated reputation + check timestamp.
 */
export function applyAshenHostileRecovery(
  reputation: number,
  lastCheckMs: number,
  nowMs: number,
): { reputation: number; lastCheckMs: number } {
  if (!Number.isFinite(nowMs) || nowMs <= 0) {
    return { reputation, lastCheckMs };
  }
  // Exiled and all non-Hostile bands — no passive change.
  if (!isAshenHostileBand(reputation)) {
    return { reputation, lastCheckMs };
  }
  const anchor = lastCheckMs > 0 ? lastCheckMs : nowMs;
  const elapsed = nowMs - anchor;
  if (elapsed < ASHEN_HOSTILE_RECOVERY_MS) {
    return { reputation, lastCheckMs: anchor };
  }
  const steps = Math.floor(elapsed / ASHEN_HOSTILE_RECOVERY_MS);
  const nextRep = Math.min(
    ASHEN_REP_WARY,
    reputation + steps * ASHEN_HOSTILE_RECOVERY_PER_INTERVAL,
  );
  return {
    reputation: nextRep,
    lastCheckMs: anchor + steps * ASHEN_HOSTILE_RECOVERY_MS,
  };
}

/**
 * Buy rate = fraction of base the player pays the trader (trader sell price).
 * Sell rate = fraction of base the trader pays the player (trader buy price).
 */
export function ashenTraderRates(reputation: number): {
  buyRate: number;
  sellRate: number;
} {
  switch (ashenStanding(reputation)) {
    case "allied":
      return { buyRate: 0.8, sellRate: 0.4 };
    case "friendly":
      return { buyRate: 0.9, sellRate: 0.3 };
    case "warm":
      return { buyRate: 0.95, sellRate: 0.25 };
    case "neutral":
      return { buyRate: 1, sellRate: 0.2 };
    case "wary":
      return { buyRate: 2, sellRate: 0.1 };
    case "hostile":
      return { buyRate: 5, sellRate: 0.05 };
    default:
      // Exiled cannot trade — rates unused.
      return { buyRate: 5, sellRate: 0.05 };
  }
}

export function itemBaseTradeValue(itemId: string): number {
  if (itemId === "banknote") return 0;
  return Math.max(1, ITEM_TRADE_VALUES[itemId] ?? 5);
}

/** What the trader charges the player (player buys from trader). */
export function traderSellPrice(
  itemId: string,
  reputation = ASHEN_REP_START,
  barterT = 0,
): number {
  if (itemId === "banknote") return 0;
  const { buyRate } = ashenTraderRates(reputation);
  const t = Number.isFinite(barterT) ? Math.max(0, Math.min(1, barterT)) : 0;
  const rate = Math.max(0.65, buyRate * (1 - 0.15 * t));
  return Math.max(1, Math.floor(itemBaseTradeValue(itemId) * rate));
}

/** What the trader pays the player (player sells to trader). */
export function traderBuyPrice(
  itemId: string,
  reputation = ASHEN_REP_START,
  barterT = 0,
): number {
  if (itemId === "banknote") return 0;
  const { sellRate } = ashenTraderRates(reputation);
  const t = Number.isFinite(barterT) ? Math.max(0, Math.min(1, barterT)) : 0;
  const rate = Math.min(0.5, sellRate * (1 + 0.15 * t));
  return Math.max(1, Math.floor(itemBaseTradeValue(itemId) * rate));
}

export type TraderShopState = {
  banknotes: number;
  /** Compact stock list (not fixed inventory slots). */
  stock: InventoryEntry[];
};

/** Remove `quantity` of `itemId` across inventory slots; null if not enough. */
export function removeItemQuantity(
  inventory: Inventory,
  itemId: string,
  quantity: number,
): Inventory | null {
  if (quantity <= 0) return inventory;
  if (countItemInInventory(inventory, itemId) < quantity) return null;
  let remaining = quantity;
  let next = inventory.map((s) => (s ? { ...s } : null));
  for (let i = 0; i < next.length && remaining > 0; i++) {
    const slot = next[i];
    if (slot?.id !== itemId) continue;
    const take = Math.min(slot.quantity, remaining);
    next = removeFromInventorySlot(next, i, take);
    remaining -= take;
  }
  return remaining === 0 ? next : null;
}

export function addToTraderStock(
  stock: InventoryEntry[],
  itemId: string,
  quantity: number,
): InventoryEntry[] {
  if (quantity <= 0 || !getItemDefinition(itemId) || itemId === "banknote") {
    return stock;
  }
  const def = getItemDefinition(itemId)!;
  const next = stock.map((e) => ({ ...e }));
  if (def.stackable) {
    const existing = next.find((e) => e.id === itemId);
    if (existing) {
      existing.quantity += quantity;
      return next;
    }
  }
  // Non-stackable: one entry per unit.
  if (!def.stackable) {
    for (let i = 0; i < quantity; i++) {
      next.push({ id: itemId, quantity: 1 });
    }
    return next;
  }
  next.push({ id: itemId, quantity });
  return next;
}

/** True when `quantity` of `itemId` fits without passing the line cap or a stack cap. */
export function canAddToTraderStock(
  stock: readonly InventoryEntry[],
  itemId: string,
  quantity: number,
): boolean {
  if (quantity <= 0 || itemId === "banknote" || !getItemDefinition(itemId)) {
    return false;
  }
  const def = getItemDefinition(itemId)!;
  const max = maxStackForItem(itemId);
  if (max <= 0) return false;
  if (!def.stackable) {
    return stock.length + quantity <= TRADER_SHOP_CAPACITY;
  }
  const existing = stock.find((entry) => entry.id === itemId);
  if (existing) return existing.quantity + quantity <= max;
  return stock.length < TRADER_SHOP_CAPACITY && quantity <= max;
}

/**
 * Whether the offer leaves the caravan at or under {@link TRADER_SHOP_CAPACITY}.
 * Buys are removed first, so a full shelf can still take goods when the same
 * offer frees a line.
 */
export function tradeOfferFitsTraderStock(
  stock: readonly InventoryEntry[],
  sells: readonly { itemId: string; quantity: number }[],
  buys: readonly { stockIndex: number; itemId: string; quantity: number }[],
): boolean {
  let next = stock.map((entry) => ({ ...entry }));
  const buyByIndexDesc = [...buys].sort((a, b) => b.stockIndex - a.stockIndex);
  for (const line of buyByIndexDesc) {
    if (line.quantity <= 0) continue;
    const entry = next[line.stockIndex];
    if (!entry || entry.id !== line.itemId) return false;
    const removed = removeFromTraderStock(next, line.stockIndex, line.quantity);
    if (!removed) return false;
    next = removed;
  }
  for (const line of sells) {
    if (line.quantity <= 0) continue;
    if (!canAddToTraderStock(next, line.itemId, line.quantity)) return false;
    next = addToTraderStock(next, line.itemId, line.quantity);
  }
  return next.length <= TRADER_SHOP_CAPACITY;
}

export function removeFromTraderStock(
  stock: InventoryEntry[],
  stockIndex: number,
  quantity: number,
): InventoryEntry[] | null {
  if (stockIndex < 0 || stockIndex >= stock.length || quantity <= 0) return null;
  const entry = stock[stockIndex]!;
  if (entry.quantity < quantity) return null;
  const next = stock.map((e) => ({ ...e }));
  if (entry.quantity === quantity) {
    next.splice(stockIndex, 1);
  } else {
    next[stockIndex] = { id: entry.id, quantity: entry.quantity - quantity };
  }
  return next;
}

/** How many distinct stock lines a trader rolls on spawn. */
export const TRADER_SHOP_ITEM_COUNT = 12;
/**
 * Max stock lines a caravan will hold. Spawn fills the first
 * {@link TRADER_SHOP_ITEM_COUNT}. Further player sales stop at this count.
 * Each line also stops at {@link maxStackForItem}, so one stack cannot grow
 * past a normal inventory stack.
 */
export const TRADER_SHOP_CAPACITY = 36;

/** Categories eligible for shop stock, with per-category quantity ranges. */
const TRADER_SHOP_CATEGORIES: {
  category: string;
  minQty: number;
  maxQty: number;
}[] = [
  { category: "ammo_lite", minQty: 1, maxQty: 50 },
  { category: "medical_lite", minQty: 1, maxQty: 5 },
  { category: "medical_heavy", minQty: 1, maxQty: 3 },
  { category: "guns_lite", minQty: 1, maxQty: 1 },
  { category: "melee_lite", minQty: 1, maxQty: 1 },
  { category: "melee_heavy", minQty: 1, maxQty: 1 },
  { category: "crafting_lite", minQty: 1, maxQty: 10 },
  { category: "junk", minQty: 1, maxQty: 3 },
  { category: "consumables", minQty: 1, maxQty: 3 },
];

type ShopPoolEntry = { id: string; minQty: number; maxQty: number };

function traderShopItemPool(): ShopPoolEntry[] {
  const pool: ShopPoolEntry[] = [];
  for (const row of TRADER_SHOP_CATEGORIES) {
    for (const id of lootCategoryItemIds(row.category)) {
      // Banknotes are the trader's float, not a stock line.
      if (id === "banknote") continue;
      pool.push({ id, minQty: row.minQty, maxQty: row.maxQty });
    }
  }
  return pool;
}

/** Non-deterministic shop stock + banknote float (fresh roll each call). */
export function generateTraderShop(_traderId?: string): TraderShopState {
  const banknotes =
    TRADER_BANKNOTES_MIN +
    Math.floor(Math.random() * (TRADER_BANKNOTES_MAX - TRADER_BANKNOTES_MIN + 1));

  const available = traderShopItemPool();
  let stock: InventoryEntry[] = [];
  const picks = Math.min(TRADER_SHOP_ITEM_COUNT, available.length);
  for (let i = 0; i < picks; i++) {
    const idx = Math.floor(Math.random() * available.length);
    const [picked] = available.splice(idx, 1);
    if (!picked) continue;
    const qty =
      picked.minQty +
      Math.floor(Math.random() * (picked.maxQty - picked.minQty + 1));
    stock = addToTraderStock(stock, picked.id, qty);
  }
  return { banknotes, stock };
}

/** Player-side sellable stacks (excludes banknotes / empty). */
export function playerTradeEntries(inventory: Inventory): {
  slotIndex: number;
  id: string;
  quantity: number;
}[] {
  const out: { slotIndex: number; id: string; quantity: number }[] = [];
  for (let i = 0; i < inventory.length; i++) {
    const slot = inventory[i];
    if (!slot || slot.id === "banknote" || slot.quantity <= 0) continue;
    if (!getItemDefinition(slot.id)) continue;
    out.push({ slotIndex: i, id: slot.id, quantity: slot.quantity });
  }
  return out;
}

/** Ensure every catalog item has a price entry (dev sanity). */
export function missingTradeValueItemIds(): string[] {
  return INVENTORY_ITEMS.map((i) => i.id).filter(
    (id) => id !== "banknote" && ITEM_TRADE_VALUES[id] == null,
  );
}

export type TradeOfferSellLine = {
  slotIndex: number;
  itemId: string;
  quantity: number;
};

export type TradeOfferBuyLine = {
  stockIndex: number;
  itemId: string;
  quantity: number;
};

export type TradeOfferTotals = {
  /** Gross value of goods the player is selling. */
  sellTotal: number;
  /** Gross value of goods the player is buying. */
  buyTotal: number;
  /**
   * Net cash the player is owed (positive) or owes (negative).
   * Pure barter when 0 — expensive sells can be offset by buys.
   */
  net: number;
};

export type TradeOfferCashSettlement = {
  /** Cash the player must pay (when net is negative). */
  playerPays: number;
  /** Cash the player actually receives (capped by trader float). */
  playerReceives: number;
  /** Dollars the trader cannot cover. Reputation for these matches a paid sale. */
  shortfall: number;
  /** False only when the player cannot cover what they owe. */
  playerCanAfford: boolean;
};

/** Price the pending offer without mutating inventories. */
export function tradeOfferTotals(
  sells: readonly TradeOfferSellLine[],
  buys: readonly TradeOfferBuyLine[],
  reputation = ASHEN_REP_START,
  barterT = 0,
): TradeOfferTotals {
  let sellTotal = 0;
  for (const line of sells) {
    if (line.quantity <= 0) continue;
    sellTotal += traderBuyPrice(line.itemId, reputation, barterT) * line.quantity;
  }
  let buyTotal = 0;
  for (const line of buys) {
    if (line.quantity <= 0) continue;
    buyTotal += traderSellPrice(line.itemId, reputation, barterT) * line.quantity;
  }
  return { sellTotal, buyTotal, net: sellTotal - buyTotal };
}

/**
 * Resolve net cash against both wallets.
 * Trader shortfalls are allowed (player takes what the trader has); player
 * shortfalls block the trade.
 */
export function tradeOfferCashSettlement(
  net: number,
  traderBanknotes: number,
  playerBanknotes: number,
): TradeOfferCashSettlement {
  const playerPays = Math.max(0, -net);
  const owed = Math.max(0, net);
  const float = Math.max(0, traderBanknotes);
  const playerReceives = Math.min(owed, float);
  return {
    playerPays,
    playerReceives,
    shortfall: owed - playerReceives,
    playerCanAfford: playerBanknotes >= playerPays,
  };
}

/**
 * Atomically apply a multi-line trade offer with net banknote settlement.
 * Sells and buys offset each other. If the trader cannot cover the cash the
 * player is owed, the trade still goes through for whatever float remains and
 * the unpaid dollars are returned as {@link shortfall} (+0.1 reputation each).
 */
export function applyTradeOffer(
  playerInv: Inventory,
  shop: TraderShopState,
  sells: readonly TradeOfferSellLine[],
  buys: readonly TradeOfferBuyLine[],
  reputation = ASHEN_REP_START,
  barterT = 0,
): {
  playerInv: Inventory;
  shop: TraderShopState;
  sellTotal: number;
  buyTotal: number;
  net: number;
  /** Cash actually paid to the player (≤ net when trader is short). */
  playerReceives: number;
  /** Cash taken from the player. */
  playerPays: number;
  /** Unpaid dollars when trader float could not cover net. +0.1 rep each. */
  shortfall: number;
} | null {
  if (sells.length === 0 && buys.length === 0) return null;
  if (sells.length > 64 || buys.length > 64) return null;

  // Merge duplicate slot / stock lines so validation stays simple.
  const sellMerged = new Map<number, TradeOfferSellLine>();
  for (const line of sells) {
    if (
      !Number.isInteger(line.slotIndex) ||
      !Number.isInteger(line.quantity) ||
      line.quantity <= 0 ||
      typeof line.itemId !== "string" ||
      !line.itemId
    ) {
      return null;
    }
    const prev = sellMerged.get(line.slotIndex);
    if (prev) {
      if (prev.itemId !== line.itemId) return null;
      prev.quantity += line.quantity;
    } else {
      sellMerged.set(line.slotIndex, { ...line });
    }
  }
  const buyMerged = new Map<number, TradeOfferBuyLine>();
  for (const line of buys) {
    if (
      !Number.isInteger(line.stockIndex) ||
      !Number.isInteger(line.quantity) ||
      line.quantity <= 0 ||
      typeof line.itemId !== "string" ||
      !line.itemId
    ) {
      return null;
    }
    const prev = buyMerged.get(line.stockIndex);
    if (prev) {
      if (prev.itemId !== line.itemId) return null;
      prev.quantity += line.quantity;
    } else {
      buyMerged.set(line.stockIndex, { ...line });
    }
  }

  const sellLines = [...sellMerged.values()];
  const buyLines = [...buyMerged.values()];
  if (sellLines.length === 0 && buyLines.length === 0) return null;

  for (const line of sellLines) {
    const slot = playerInv[line.slotIndex];
    if (
      !slot ||
      slot.id !== line.itemId ||
      slot.id === "banknote" ||
      slot.quantity < line.quantity
    ) {
      return null;
    }
    if (!getItemDefinition(line.itemId)) return null;
  }

  for (const line of buyLines) {
    const entry = shop.stock[line.stockIndex];
    if (
      !entry ||
      entry.id !== line.itemId ||
      entry.id === "banknote" ||
      entry.quantity < line.quantity
    ) {
      return null;
    }
    if (!getItemDefinition(line.itemId)) return null;
  }

  const { sellTotal, buyTotal, net } = tradeOfferTotals(
    sellLines,
    buyLines,
    reputation,
    barterT,
  );
  const cash = tradeOfferCashSettlement(
    net,
    shop.banknotes,
    countItemInInventory(playerInv, "banknote"),
  );
  if (!cash.playerCanAfford) return null;
  if (!tradeOfferFitsTraderStock(shop.stock, sellLines, buyLines)) return null;
  const { playerPays, playerReceives, shortfall } = cash;

  let nextInv = playerInv.map((s) => (s ? { ...s } : null));
  for (const line of sellLines) {
    nextInv = removeFromInventorySlot(nextInv, line.slotIndex, line.quantity);
  }

  // Highest stock index first so earlier removals do not shift later indices.
  const buyByIndexDesc = [...buyLines].sort(
    (a, b) => b.stockIndex - a.stockIndex,
  );
  let nextStock = shop.stock.map((e) => ({ ...e }));
  for (const line of buyByIndexDesc) {
    const removed = removeFromTraderStock(
      nextStock,
      line.stockIndex,
      line.quantity,
    );
    if (!removed) return null;
    nextStock = removed;
  }

  for (const line of sellLines) {
    nextStock = addToTraderStock(nextStock, line.itemId, line.quantity);
  }

  if (playerPays > 0) {
    const withoutNotes = removeItemQuantity(nextInv, "banknote", playerPays);
    if (!withoutNotes) return null;
    nextInv = withoutNotes;
  }

  for (const line of buyLines) {
    if (!canAddToInventory(nextInv, line.itemId, line.quantity)) return null;
    nextInv = addToInventory(nextInv, line.itemId, line.quantity);
  }

  if (playerReceives > 0) {
    if (!canAddToInventory(nextInv, "banknote", playerReceives)) return null;
    nextInv = addToInventory(nextInv, "banknote", playerReceives);
  }

  return {
    playerInv: nextInv,
    shop: {
      banknotes: shop.banknotes - playerReceives + playerPays,
      stock: nextStock,
    },
    sellTotal,
    buyTotal,
    net,
    playerReceives,
    playerPays,
    shortfall,
  };
}

/** @deprecated Prefer {@link applyTradeOffer} — kept for single-line callers. */
export function applyPlayerBuyFromTrader(
  playerInv: Inventory,
  shop: TraderShopState,
  stockIndex: number,
  quantity: number,
  reputation = ASHEN_REP_START,
  expectedItemId?: string,
): { playerInv: Inventory; shop: TraderShopState; spent: number } | null {
  const result = applyTradeOffer(
    playerInv,
    shop,
    [],
    [
      {
        stockIndex,
        itemId: expectedItemId ?? shop.stock[stockIndex]?.id ?? "",
        quantity,
      },
    ],
    reputation,
  );
  if (!result) return null;
  return {
    playerInv: result.playerInv,
    shop: result.shop,
    spent: result.buyTotal,
  };
}

/** @deprecated Prefer {@link applyTradeOffer} — kept for single-line callers. */
export function applyPlayerSellToTrader(
  playerInv: Inventory,
  shop: TraderShopState,
  slotIndex: number,
  quantity: number,
  reputation = ASHEN_REP_START,
  expectedItemId?: string,
): { playerInv: Inventory; shop: TraderShopState; earned: number } | null {
  const result = applyTradeOffer(
    playerInv,
    shop,
    [
      {
        slotIndex,
        itemId: expectedItemId ?? playerInv[slotIndex]?.id ?? "",
        quantity,
      },
    ],
    [],
    reputation,
  );
  if (!result) return null;
  return {
    playerInv: result.playerInv,
    shop: result.shop,
    earned: result.sellTotal,
  };
}
