import {
  INVENTORY_ITEMS,
  addToInventory,
  backpackHoldsItems,
  backpackStorageContained,
  canAddToInventory,
  cloneInventory,
  countItemInInventory,
  getItemDefinition,
  isQuestKeepsakeItem,
  maxStackForItem,
  rollWatchVariant,
  WATCH_ITEM_ID,
  WATCH_LOOT,
  removeFromInventorySlot,
  type Inventory,
  type InventoryEntry,
} from "./items.js";
import { DEADMARK_MIN_WIRE } from "./deadmark.js";
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
  FACTION_HOSTILE_RECOVERY_MS,
  FACTION_HOSTILE_RECOVERY_PER_INTERVAL,
  applyFactionHostileRecovery,
  dropFactionReputationLevel,
  factionStanding,
  factionStandingLabel,
  type FactionStanding,
} from "./factionRep.js";

/** Arterial trader float (inclusive). Rolled fresh each restart. */
export const TRADER_BANKNOTES_MIN = 1000;
export const TRADER_BANKNOTES_MAX = 3000;
/** Birchport warehouse trader float (inclusive). */
export const ASHEN_MARKET_BANKNOTES_MIN = 5000;
export const ASHEN_MARKET_BANKNOTES_MAX = 20000;

/** One-time banknote fee for a Birchport market safe deposit box. */
export const SAFE_DEPOSIT_COST = 1000;

/** True once the player has paid for a safe deposit box. Empty means unpaid. */
export function safeDepositIsRented(json: string | null | undefined): boolean {
  return typeof json === "string" && json.length > 0 && json !== "[]";
}

/**
 * Base banknote value per item.
 * Rates scale by standing (see ashenTraderRates) — Neutral is 100% buy / 20% sell.
 */
export const ITEM_TRADE_VALUES: Record<string, number> = {
  weapon_pistol: 380,
  weapon_shotgun: 1500,
  weapon_hunting_rifle: 3000,
  weapon_revolver: 570,
  weapon_assault_rifle: 3800,
  weapon_m4a1: 4000,
  weapon_hammer: 100,
  weapon_hatchet: 110,
  weapon_bat: 75,
  // Parts stay under the finished gun. Shared parts cost more than a one-gun fitting.
  small_spring: 45,
  large_spring: 180,
  rifle_trigger: 300,
  pistol_trigger: 40,
  pistol_slide: 60,
  pistol_frame: 110,
  revolver_trigger: 55,
  revolver_cylinder: 80,
  revolver_barrel: 100,
  revolver_frame: 150,
  shotgun_trigger: 105,
  shotgun_stock: 210,
  shotgun_barrel: 330,
  shotgun_receiver: 420,
  rifle_stock: 270,
  scope: 450,
  rifle_barrel: 540,
  rifle_receiver: 680,
  ak_stock: 360,
  ak_barrel: 720,
  ak_receiver: 1080,
  m4_stock: 390,
  m4_barrel: 750,
  m4_receiver: 1140,
  // Unread sheets. Worth more than one finished gun, because reading one unlocks the craft.
  blueprint_pistol: 570,
  blueprint_revolver: 860,
  blueprint_shotgun: 2250,
  blueprint_hunting_rifle: 4500,
  blueprint_ak: 5700,
  blueprint_m4: 6000,
  ammo_9x19: 8,
  ammo_buckshot: 24,
  ammo_762x39: 18,
  ammo_556x45: 15,
  ammo_44: 16,
  bandages: 15,
  rags: 5,
  alcohol: 20,
  antibiotics: 100,
  multivitamins: 80,
  screws: 10,
  bolts: 10,
  duct_tape: 8,
  scrap_metal: 10,
  wood: 8,
  banknote: 1,
  lighter: 20,
  lockpick: 120,
  dogtag: 20,
  blue_cigarettes: 10,
  white_tshirt: 50,
  black_tshirt: 50,
  backpack_fanny: 35,
  backpack_utility: 70,
  backpack_small: 110,
  backpack_black: 110,
  backpack_hunting: 170,
  backpack_leather: 240,
  backpack_hiking: 320,
  gold_chain: 250,
  gold_earrings: 180,
  clarks_earrings: 0,
  caravan_manifest: 0,
  wagon_note: 0,
  supply_list: 0,
  coleman_note: 0,
  holland_dogtag: 0,
  holland_diary: 0,
  want_list: 0,
  missing_issue: 0,
  holland_note: 0,
  coleman_scrap: 0,
  coleman_confession: 0,
  gold_ring: 150,
  silver_chain: 90,
  silver_ring: 50,
  old_teddy: 5,
  teddy: 10,
  map: 40,
  magazine_melee: 160,
  magazine_harvesting: 160,
  magazine_carrying: 160,
  magazine_construction: 160,
  magazine_fitness: 160,
  magazine_immunity: 160,
  magazine_recovery: 160,
  magazine_accuracy: 160,
  magazine_crafting: 160,
  magazine_scavenging: 160,
  magazine_stealth: 160,
  magazine_cooking: 160,
  magazine_medicine: 160,
  magazine_reading: 160,
  magazine_persuasion: 160,
  magazine_bartering: 160,
  magazine_lockpicking: 160,
  watch: 80,
  ...Object.fromEntries(WATCH_LOOT.map((watch) => [watch.id, watch.value])),
  handheld_radio: 150,
  canned_beans: 20,
  canned_tuna: 16,
  canned_peaches: 12,
  hot_chips: 8,
  onion_chips: 10,
  salted_chips: 6,
  lemonada: 8,
  cola: 8,
  water: 12,
  raw_bear_meat: 18,
  cooked_bear_meat: 48,
  burnt_bear_meat: 1,
  raw_coyote_meat: 14,
  cooked_coyote_meat: 36,
  burnt_coyote_meat: 1,
  raw_chicken_meat: 12,
  cooked_chicken_meat: 28,
  burnt_chicken_meat: 1,
  raw_rabbit_meat: 8,
  cooked_rabbit_meat: 22,
  burnt_rabbit_meat: 1,
  raw_bird_meat: 5,
  cooked_bird_meat: 14,
  burnt_bird_meat: 1,
};

/** Ashen Traders faction display name. */
export const ASHEN_TRADERS_FACTION = "Ashen Traders";

/** Birchport market ledger. Road caravans are not him. */
export const ASHEN_MARKET_TRADER_NAME = "Kevin";

export type AshenDialogLine = {
  id: string;
  /** Player speech option. */
  player: string;
  /** Reply variants from TraderMan. Later entries tend to be more informative. */
  npcMan: readonly string[];
  /** Reply variants from TraderGuard when different from the man. */
  npcGuard?: readonly string[];
  /** Opens the trader shop, the Birchport player board, the safe deposit box, the wire, or the buyback. */
  action?: "trade" | "board" | "deposit" | "wire" | "buyback";
  /** Kevin at the Birchport market, when he should not sound like a road caravan. */
  npcMarket?: readonly string[];
  /** Kevin's buyback reply for Allied standing, when the rate is one for one. */
  npcMarketAllied?: readonly string[];
  /** Speech shown once the safe deposit fee is already paid. */
  playerRented?: string;
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
    npcMarket: [
      "Ashen Traders. I keep the book for this stall.",
      "Ashen Traders. Caravans pass through Birchport. I stay with the ledger and the board.",
    ],
    npcGuard: [
      "Ashen Traders. He's the ledger. We keep the goods moving.",
      "Ashen Traders. He's the one with the ledger. We're here so the goods make it to the next stop.",
      "Traders. He handles deals. We watch the road and make sure this caravan isn't a free meal for bandits or walkers.",
    ],
  },
  {
    id: "trade",
    player: "Let's see what you have to trade",
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
    id: "board",
    player: "Show me what survivors are selling",
    npcMan: [
      "The board is here. Banknotes only. I hold the payout until you collect it.",
      "Player listings are on the board. Pay with banknotes from your pack. When something of yours sells, the notes wait here until you pick them up.",
      "That's the player board. Price it in banknotes. I keep the proceeds at this desk until you come back for them.",
    ],
    npcGuard: [
      "That's his board. Talk to the man with the ledger.",
    ],
    action: "board",
  },
  {
    id: "deposit",
    player: "I want a safe deposit box",
    playerRented: "Open my safe deposit box",
    npcMan: [
      "Safe deposit boxes are with Kevin at the Birchport market.",
    ],
    npcMarket: [
      "Eight slots in the back. One thousand banknotes, once. What you leave there stays safe at the market until you collect it.",
      "I can hold eight stacks for you. One thousand, and it stays safe here until you come back for it.",
    ],
    npcGuard: [
      "That's Kevin's. Talk to the man with the ledger.",
    ],
    action: "deposit",
  },
  {
    id: "wire",
    player: "Can I ship banknotes east?",
    npcMan: [
      "That's Kevin, at the Birchport market. He ships notes east.",
    ],
    npcMarket: [
      `The coast buys the paper. One note becomes one mark, wired to the wallet already on your ledger. They can only handle so many shipments in a day, so once that limit is spent the wire is closed until they open a new book tomorrow. Your standing with us decides how much of the day's shipments they'll take from you. First come, first served, and I won't put fewer than ${DEADMARK_MIN_WIRE} notes on the truck, unless that's all you have left today.`,
      `I can ship them east. The coast wires the marks back, one for one, to the wallet on your ledger. There's only so much wire they can run at a time, and that daily limit is shared. When it's gone, nobody else gets through until tomorrow. Better standing gets a larger share, the book is first come, first served, and the smallest I'll send is ${DEADMARK_MIN_WIRE} notes, or whatever is left today if that's less.`,
    ],
    npcGuard: [
      "That's Kevin's book. Talk to the man with the ledger.",
    ],
    action: "wire",
  },
  {
    id: "buyback",
    player: "Can I trade in my Deadmarks?",
    npcMan: [
      "That's Kevin, at the Birchport market. He sells paper for marks.",
    ],
    npcMarket: [
      "Two marks buy one note. I can only offer the banknotes that have already been put aside to be shipped east. When that paper is gone, I have nothing to sell until more is set aside.",
      "Yes. Those are the notes waiting on the eastbound shipment. Two Deadmarks for one banknote, and I can't sell any that haven't been put aside.",
    ],
    npcMarketAllied: [
      "For an ally, one mark buys one note. I can only offer the banknotes that have already been put aside to be shipped east. When that paper is gone, I wait until more is set aside.",
      "Yes. You get those notes one for one. They're the banknotes already put aside for the eastbound shipment, and I don't have any others to sell.",
    ],
    npcGuard: [
      "That's Kevin's book. Talk to the man with the ledger.",
    ],
    action: "buyback",
  },
  {
    id: "jobs",
    player: "Got any work?",
    npcMan: [
      "Buyer jobs are with Kevin at the Birchport market.",
      "Not on the road. Kevin posts buyer work at the Birchport stall.",
    ],
    npcGuard: [
      "Jobs are Kevin's. I watch the door.",
      "Talk to Kevin if you want work. I don't keep the book.",
    ],
    npcMarket: [
      "Look at the list. Banknotes for stock I can move, and a few stops outside town.",
      "Yes. Shells, road food, crate parts, and a couple of pages that walked off. I pay in banknotes.",
    ],
  },
  {
    id: "join",
    player: "Can I join you guys?",
    npcMan: [
      "Not taking people on. Try a National Guard post for work.",
      "We're not taking new people on the road. Too many mouths, too little trust. If you want work, ask at Birchport. That's the National Guard hub in Ashen County. They post jobs when they need hands.",
      "Caravan's full. Trust's thin on the road anyway. National Guard posts put up paid work when they need hands. Buyer jobs are with Kevin at the Birchport market.",
    ],
    npcGuard: [
      "Full caravan. Try the National Guard for paid work.",
      "Not our call. We already have a full caravan. Try Birchport or one of the smaller National Guard outposts if you're looking for paid work.",
      "We don't hire strays mid-route. National Guard posts put up jobs. That's your better bet.",
    ],
  },
  {
    id: "home",
    player: "Do you guys have a home?",
    npcMan: [
      "Mostly the road. A few stalls at National Guard posts.",
      "Not really. Most of us stay on the road through Ashen County. A few keep stalls at National Guard posts so people know where to find us when a caravan isn't passing through.",
      "No fixed town. We're on the county roads most weeks. When a caravan isn't in, look for our stalls at National Guard posts. Birchport is their hub in this county.",
    ],
  },
  {
    id: "militia",
    player: "Are you with the National Guard?",
    npcMan: [
      "No. Separate. They let us trade at their posts.",
      "No. Separate group. The National Guard lets us trade at Birchport and their smaller outposts, and when bandits hit a caravan they sometimes ride out after them. We handle the goods. They handle the shooting, when they can spare it.",
      "Separate outfit. National Guard posts give us stalls; sometimes they chase bandits off a hit caravan if they've got people free. Goods are our job. Guns are theirs.",
    ],
    npcGuard: [
      "Separate. They help when bandits hit, when they can.",
      "Separate outfit. The National Guard looks the other way when we set up shop at their posts, and they've pulled our bacon out of the fire more than once on the road.",
      "Not National Guard. Same county, different badge. They've bailed out caravans before. Don't confuse that for us wearing their colors.",
    ],
  },
  {
    id: "roads",
    player: "How are the roads?",
    npcMan: [
      "Walkers usual. Bandits worse. We keep moving.",
      "Depends on the week. Walkers are the usual problem. Bandits are worse when they show up. We keep moving and try not to camp in the open longer than we have to.",
      "Week to week. Walkers are constant; bandits hit when a route looks soft. We don't linger in the open. Marked roads near National Guard posts are the least bad option.",
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
      "Safe travels. Stick to marked roads near the National Guard posts when you can.",
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
 * +0.1 per $ given to the trader (player buys); +0.1 per $ taken (player sells).
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
export const ASHEN_REP_PER_DOLLAR_GIVEN = 0.1;
/** Reputation gained per banknote received from the trader. */
export const ASHEN_REP_PER_DOLLAR_TAKEN = 0.1;

/** Hostile band recovers +1 toward 0 every this many wall-clock ms. */
export const ASHEN_HOSTILE_RECOVERY_MS = FACTION_HOSTILE_RECOVERY_MS;
export const ASHEN_HOSTILE_RECOVERY_PER_INTERVAL =
  FACTION_HOSTILE_RECOVERY_PER_INTERVAL;

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
 * Apply Hostile passive recovery toward 0 (+1 per 10 real-life minutes).
 * Uses wall-clock time, online or offline. Exiled never recovers.
 */
export function applyAshenHostileRecovery(
  reputation: number,
  lastCheckMs: number,
  nowMs: number,
): { reputation: number; lastCheckMs: number } {
  return applyFactionHostileRecovery(reputation, lastCheckMs, nowMs);
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
  if (itemId === "banknote" || isQuestKeepsakeItem(itemId)) return 0;
  return Math.max(1, ITEM_TRADE_VALUES[itemId] ?? 5);
}

/** What the trader charges the player (player buys from trader). */
export function traderSellPrice(
  itemId: string,
  reputation = ASHEN_REP_START,
  barterT = 0,
): number {
  if (itemId === "banknote" || isQuestKeepsakeItem(itemId)) return 0;
  const { buyRate } = ashenTraderRates(reputation);
  const t = Number.isFinite(barterT) ? Math.max(0, Math.min(1, barterT)) : 0;
  const rate = Math.max(0.65, buyRate * (1 - 0.1 * t));
  return Math.max(1, Math.floor(itemBaseTradeValue(itemId) * rate));
}

/**
 * Trader sell price span for standings that can still buy.
 * Low is Allied. High is Wary.
 */
export function traderSellPriceRange(itemId: string): { low: number; high: number } {
  const low = traderSellPrice(itemId, ASHEN_REP_ALLIED, 0);
  const high = traderSellPrice(itemId, ASHEN_REP_WARY, 0);
  return low <= high ? { low, high } : { low: high, high: low };
}

/** What the trader pays the player (player sells to trader). */
export function traderBuyPrice(
  itemId: string,
  reputation = ASHEN_REP_START,
  barterT = 0,
): number {
  if (itemId === "banknote" || isQuestKeepsakeItem(itemId)) return 0;
  const { sellRate } = ashenTraderRates(reputation);
  const t = Number.isFinite(barterT) ? Math.max(0, Math.min(1, barterT)) : 0;
  const rate = Math.min(0.5, sellRate * (1 + 0.1 * t));
  return Math.max(1, Math.floor(itemBaseTradeValue(itemId) * rate));
}

export type TraderShopState = {
  banknotes: number;
  /** Compact stock list (not fixed inventory slots). */
  stock: InventoryEntry[];
  /** Max stock lines this shop will hold. */
  capacity: number;
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
  let next = cloneInventory(inventory);
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
  if (!def.stackable) {
    for (let i = 0; i < quantity; i++) {
      next.push({ id: itemId, quantity: 1 });
    }
    return next;
  }
  const max = maxStackForItem(itemId);
  if (max <= 0) return next;
  let remaining = quantity;
  for (const entry of next) {
    if (entry.id !== itemId || entry.quantity >= max) continue;
    const into = Math.min(remaining, max - entry.quantity);
    entry.quantity += into;
    remaining -= into;
    if (remaining <= 0) return next;
  }
  while (remaining > 0) {
    const into = Math.min(remaining, max);
    next.push({ id: itemId, quantity: into });
    remaining -= into;
  }
  return next;
}

/**
 * How many of `itemId` still fit.
 * A line stops at {@link maxStackForItem}. Leftover units open another line
 * while the shop is under `capacity`.
 */
export function traderPurchaseRoom(
  stock: readonly InventoryEntry[],
  itemId: string,
  capacity = TRADER_SHOP_CAPACITY,
): number {
  const def = getItemDefinition(itemId);
  if (!def || itemId === "banknote") return 0;
  const max = maxStackForItem(itemId);
  if (max <= 0) return 0;
  const freeLines = Math.max(0, capacity - stock.length);
  if (!def.stackable) return freeLines;
  let room = freeLines * max;
  for (const entry of stock) {
    if (entry.id !== itemId) continue;
    room += Math.max(0, max - entry.quantity);
  }
  return room;
}

/** True when `quantity` of `itemId` fits without passing the line cap or a stack cap. */
export function canAddToTraderStock(
  stock: readonly InventoryEntry[],
  itemId: string,
  quantity: number,
  capacity = TRADER_SHOP_CAPACITY,
): boolean {
  if (quantity <= 0 || itemId === "banknote" || !getItemDefinition(itemId)) {
    return false;
  }
  return traderPurchaseRoom(stock, itemId, capacity) >= quantity;
}

export type TradeStockFitProblem =
  | { kind: "stale" }
  | { kind: "shelf" }
  | { kind: "limit"; itemId: string; room: number };

/**
 * Why an offer does not fit the trader's stock, or null when it does.
 * Buys are removed first, so a full shelf can still take goods when the same
 * offer frees a line.
 */
export function tradeOfferStockFitProblem(
  stock: readonly InventoryEntry[],
  sells: readonly { itemId: string; quantity: number }[],
  buys: readonly { stockIndex: number; itemId: string; quantity: number }[],
  capacity = TRADER_SHOP_CAPACITY,
): TradeStockFitProblem | null {
  let next = stock.map((entry) => ({ ...entry }));
  const buyByIndexDesc = [...buys].sort((a, b) => b.stockIndex - a.stockIndex);
  for (const line of buyByIndexDesc) {
    if (line.quantity <= 0) continue;
    const entry = next[line.stockIndex];
    if (!entry || entry.id !== line.itemId) return { kind: "stale" };
    const removed = removeFromTraderStock(next, line.stockIndex, line.quantity);
    if (!removed) return { kind: "stale" };
    next = removed;
  }
  for (const line of sells) {
    if (line.quantity <= 0) continue;
    if (!getItemDefinition(line.itemId) || line.itemId === "banknote") {
      return { kind: "stale" };
    }
    if (canAddToTraderStock(next, line.itemId, line.quantity, capacity)) {
      next = addToTraderStock(next, line.itemId, line.quantity);
      continue;
    }
    const room = traderPurchaseRoom(next, line.itemId, capacity);
    if (room <= 0) return { kind: "shelf" };
    return { kind: "limit", itemId: line.itemId, room };
  }
  return next.length <= capacity ? null : { kind: "shelf" };
}

/**
 * Whether the offer leaves the shop at or under `capacity` stock lines.
 * Buys are removed first, so a full shelf can still take goods when the same
 * offer frees a line.
 */
export function tradeOfferFitsTraderStock(
  stock: readonly InventoryEntry[],
  sells: readonly { itemId: string; quantity: number }[],
  buys: readonly { stockIndex: number; itemId: string; quantity: number }[],
  capacity = TRADER_SHOP_CAPACITY,
): boolean {
  return tradeOfferStockFitProblem(stock, sells, buys, capacity) === null;
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

/** How many distinct stock lines an arterial trader rolls on spawn. */
export const TRADER_SHOP_ITEM_COUNT = 12;
/**
 * Max stock lines an arterial caravan will hold. Spawn fills the first
 * {@link TRADER_SHOP_ITEM_COUNT}. Further player sales stop at this count.
 * Each line stops at {@link maxStackForItem}. A full stack spills onto
 * another line until this count is reached.
 */
export const TRADER_SHOP_CAPACITY = 36;
/** Birchport warehouse trader: stock lines present when the shop first opens. */
export const ASHEN_MARKET_SHOP_ITEM_COUNT = 36;
/** Birchport warehouse trader: max stock lines. */
export const ASHEN_MARKET_SHOP_CAPACITY = 108;

/** True for the stationary trader inside the Birchport Ashen market. */
export function isAshenMarketTraderId(traderId: string): boolean {
  return traderId.startsWith("ashen-market:") && traderId.endsWith(":man");
}

/**
 * Minimum Ashen standing required to buy an item from a trader.
 * A min and max quantity means the item can roll into fresh stock.
 * Without them, it only returns to the shelf after a player sells it.
 * Higher standings include every item from the bands below.
 * Player marketplace listings do not use this table.
 */
const TRADER_CATALOG: Readonly<
  Record<string, { standing: FactionStanding; minQty?: number; maxQty?: number }>
> = (() => {
  const row = (standing: FactionStanding, minQty?: number, maxQty?: number) => ({
    standing,
    minQty,
    maxQty,
  });
  const entries: Record<string, { standing: FactionStanding; minQty?: number; maxQty?: number }> = {
    // Wary. Food, tools, scrap, and valuables.
    water: row("wary", 1, 3),
    cola: row("wary", 1, 3),
    lemonada: row("wary", 1, 3),
    canned_beans: row("wary", 1, 3),
    canned_tuna: row("wary", 1, 3),
    canned_peaches: row("wary", 1, 3),
    hot_chips: row("wary", 1, 3),
    onion_chips: row("wary", 1, 3),
    salted_chips: row("wary", 1, 3),
    weapon_hammer: row("wary", 1, 1),
    weapon_hatchet: row("wary", 1, 1),
    weapon_bat: row("wary", 1, 1),
    rags: row("wary", 1, 5),
    screws: row("wary", 1, 10),
    bolts: row("wary", 1, 10),
    duct_tape: row("wary", 1, 10),
    scrap_metal: row("wary", 1, 10),
    lighter: row("wary", 1, 3),
    blue_cigarettes: row("wary", 1, 3),
    white_tshirt: row("wary", 1, 1),
    black_tshirt: row("wary", 1, 1),
    map: row("wary", 1, 3),
    old_teddy: row("wary", 1, 3),
    teddy: row("wary", 1, 3),
    dogtag: row("wary", 1, 3),
    gold_chain: row("wary", 1, 3),
    gold_earrings: row("wary", 1, 3),
    gold_ring: row("wary", 1, 3),
    silver_chain: row("wary", 1, 3),
    silver_ring: row("wary", 1, 3),
    [WATCH_ITEM_ID]: row("wary", 1, 3),
    wood: row("wary"),
    raw_bear_meat: row("wary"),
    cooked_bear_meat: row("wary"),
    burnt_bear_meat: row("wary"),
    raw_coyote_meat: row("wary"),
    cooked_coyote_meat: row("wary"),
    burnt_coyote_meat: row("wary"),
    raw_chicken_meat: row("wary"),
    cooked_chicken_meat: row("wary"),
    burnt_chicken_meat: row("wary"),
    raw_rabbit_meat: row("wary"),
    cooked_rabbit_meat: row("wary"),
    burnt_rabbit_meat: row("wary"),
    raw_bird_meat: row("wary"),
    cooked_bird_meat: row("wary"),
    burnt_bird_meat: row("wary"),

    // Neutral. A sidearm, basic medicine, and a small pack.
    weapon_pistol: row("neutral", 1, 1),
    ammo_9x19: row("neutral", 1, 50),
    bandages: row("neutral", 1, 3),
    alcohol: row("neutral", 1, 3),
    multivitamins: row("neutral", 1, 5),
    backpack_fanny: row("neutral", 1, 1),
    backpack_utility: row("neutral", 1, 1),
    handheld_radio: row("neutral", 1, 1),
    pistol_frame: row("neutral", 1, 2),
    pistol_slide: row("neutral", 1, 2),
    pistol_trigger: row("neutral", 1, 2),
    small_spring: row("neutral", 1, 2),
    blueprint_pistol: row("neutral"),

    // Warm. Civilian guns and the tools they would not hand a stranger.
    weapon_revolver: row("warm", 1, 1),
    weapon_shotgun: row("warm", 1, 1),
    ammo_44: row("warm", 1, 50),
    ammo_buckshot: row("warm", 8, 24),
    antibiotics: row("warm", 1, 3),
    lockpick: row("warm", 1, 1),
    backpack_small: row("warm", 1, 1),
    revolver_frame: row("warm", 1, 2),
    revolver_cylinder: row("warm", 1, 2),
    revolver_barrel: row("warm", 1, 2),
    revolver_trigger: row("warm", 1, 2),
    shotgun_receiver: row("warm", 1, 2),
    shotgun_barrel: row("warm", 1, 2),
    shotgun_stock: row("warm", 1, 2),
    shotgun_trigger: row("warm", 1, 2),
    large_spring: row("warm", 1, 2),
    blueprint_revolver: row("warm"),
    blueprint_shotgun: row("warm"),

    // Friendly. Hunting rifle only returns if a player sold one. 7.62 still rolls.
    weapon_hunting_rifle: row("friendly"),
    ammo_762x39: row("friendly", 8, 24),
    backpack_hunting: row("friendly", 1, 1),
    backpack_leather: row("friendly", 1, 1),
    rifle_receiver: row("friendly", 1, 2),
    rifle_barrel: row("friendly", 1, 2),
    rifle_stock: row("friendly", 1, 2),
    rifle_trigger: row("friendly", 1, 2),
    scope: row("friendly", 1, 2),
    blueprint_hunting_rifle: row("friendly"),
    magazine_melee: row("friendly"),
    magazine_harvesting: row("friendly"),
    magazine_carrying: row("friendly"),
    magazine_construction: row("friendly"),
    magazine_fitness: row("friendly"),
    magazine_immunity: row("friendly"),
    magazine_recovery: row("friendly"),
    magazine_crafting: row("friendly"),
    magazine_cooking: row("friendly"),
    magazine_medicine: row("friendly"),
    magazine_reading: row("friendly"),
    magazine_persuasion: row("friendly"),
    magazine_bartering: row("friendly"),

    // Allied. Military parts and rounds. Whole rifles only come back if a player sold one.
    ammo_556x45: row("allied", 8, 24),
    backpack_hiking: row("allied", 1, 1),
    ak_receiver: row("allied", 1, 2),
    ak_barrel: row("allied", 1, 2),
    ak_stock: row("allied", 1, 2),
    m4_receiver: row("allied", 1, 2),
    m4_barrel: row("allied", 1, 2),
    m4_stock: row("allied", 1, 2),
    blueprint_ak: row("allied"),
    blueprint_m4: row("allied"),
    magazine_accuracy: row("allied"),
    magazine_scavenging: row("allied"),
    magazine_stealth: row("allied"),
    magazine_lockpicking: row("allied"),
    weapon_assault_rifle: row("allied"),
    weapon_m4a1: row("allied"),
  };
  for (const watch of WATCH_LOOT) {
    entries[watch.id] = row("wary");
  }
  return entries;
})();

const TRADER_STANDING_RANK: Record<FactionStanding, number> = {
  exiled: 0,
  hostile: 1,
  wary: 2,
  neutral: 3,
  warm: 4,
  friendly: 5,
  allied: 6,
};

/** Standing required to buy this from an Ashen trader, or null when they will not sell it. */
export function traderItemMinStanding(itemId: string): FactionStanding | null {
  const id = getItemDefinition(itemId)?.id ?? itemId;
  return TRADER_CATALOG[id]?.standing ?? null;
}

/** True when this player's Ashen standing is high enough to buy the item. */
export function canPurchaseFromTrader(itemId: string, reputation: number): boolean {
  const need = traderItemMinStanding(itemId);
  if (!need) return false;
  const have = ashenStanding(reputation);
  return TRADER_STANDING_RANK[have] >= TRADER_STANDING_RANK[need];
}

/** Empty when the purchase is allowed. Otherwise the reason to show the player. */
export function traderPurchaseLock(itemId: string, reputation: number): string {
  if (canPurchaseFromTrader(itemId, reputation)) return "";
  const need = traderItemMinStanding(itemId);
  if (!need) return "Traders will not sell this.";
  return `They will not sell that. Requires ${factionStandingLabel(need)} standing.`;
}

/** Tradeable items missing a buy standing. Banknotes and quest papers are excluded. */
export function traderCatalogUnassignedItemIds(): string[] {
  return INVENTORY_ITEMS.map((item) => item.id).filter((id) => {
    if (id === "banknote" || isQuestKeepsakeItem(id)) return false;
    return traderItemMinStanding(id) == null;
  });
}

type ShopPoolEntry = { id: string; minQty: number; maxQty: number };

function traderShopItemPool(): ShopPoolEntry[] {
  const pool: ShopPoolEntry[] = [];
  for (const [id, row] of Object.entries(TRADER_CATALOG)) {
    if (row.minQty == null || row.maxQty == null) continue;
    if (id === "banknote") continue;
    pool.push({ id, minQty: row.minQty, maxQty: row.maxQty });
  }
  return pool;
}

/**
 * Market quantities sit near the top of the category range.
 * A flat roll would leave most shelves half empty.
 */
function marketStockQuantity(minQty: number, maxQty: number): number {
  if (maxQty <= minQty) return minQty;
  const span = maxQty - minQty;
  const towardMax = 1 - (1 - Math.random()) ** 3;
  return minQty + Math.min(span, Math.floor(towardMax * (span + 1)));
}

function traderShopLimits(traderId?: string): {
  banknotesMin: number;
  banknotesMax: number;
  itemCount: number;
  capacity: number;
} {
  if (traderId && isAshenMarketTraderId(traderId)) {
    return {
      banknotesMin: ASHEN_MARKET_BANKNOTES_MIN,
      banknotesMax: ASHEN_MARKET_BANKNOTES_MAX,
      itemCount: ASHEN_MARKET_SHOP_ITEM_COUNT,
      capacity: ASHEN_MARKET_SHOP_CAPACITY,
    };
  }
  return {
    banknotesMin: TRADER_BANKNOTES_MIN,
    banknotesMax: TRADER_BANKNOTES_MAX,
    itemCount: TRADER_SHOP_ITEM_COUNT,
    capacity: TRADER_SHOP_CAPACITY,
  };
}

/** A shop `watch` token becomes one named watch per unit. */
function addShopStock(
  stock: InventoryEntry[],
  itemId: string,
  quantity: number,
): InventoryEntry[] {
  if (itemId !== WATCH_ITEM_ID) return addToTraderStock(stock, itemId, quantity);
  let next = stock;
  const count = Math.max(0, Math.floor(quantity));
  for (let i = 0; i < count; i++) {
    next = addToTraderStock(next, rollWatchVariant(Math.random), 1);
  }
  return next;
}

/** Non-deterministic shop stock + banknote float (fresh roll each call). */
export function generateTraderShop(traderId?: string): TraderShopState {
  const limits = traderShopLimits(traderId);
  const banknotes =
    limits.banknotesMin +
    Math.floor(
      Math.random() * (limits.banknotesMax - limits.banknotesMin + 1),
    );

  const available = traderShopItemPool();
  let stock: InventoryEntry[] = [];
  const market = traderId != null && isAshenMarketTraderId(traderId);
  if (market) {
    // Fill stock lines, not picks. A non-stackable roll of 3 would otherwise
    // open three shelves and push the shop past the starting count.
    while (stock.length < limits.itemCount && available.length > 0) {
      const idx = Math.floor(Math.random() * available.length);
      const [picked] = available.splice(idx, 1);
      if (!picked) break;
      const def = getItemDefinition(picked.id);
      let qty = marketStockQuantity(picked.minQty, picked.maxQty);
      if (def?.stackable) qty = Math.min(qty, maxStackForItem(picked.id));
      if (def && !def.stackable) {
        qty = Math.min(qty, limits.itemCount - stock.length);
      }
      if (qty <= 0) break;
      stock = addShopStock(stock, picked.id, qty);
    }
  } else {
    const picks = Math.min(limits.itemCount, available.length);
    for (let i = 0; i < picks; i++) {
      const idx = Math.floor(Math.random() * available.length);
      const [picked] = available.splice(idx, 1);
      if (!picked) continue;
      const qty =
        picked.minQty +
        Math.floor(Math.random() * (picked.maxQty - picked.minQty + 1));
      stock = addShopStock(stock, picked.id, qty);
    }
  }
  return { banknotes, stock, capacity: limits.capacity };
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
    if (isQuestKeepsakeItem(line.itemId)) return null;
    if (backpackHoldsItems(playerInv, line.slotIndex)) return null;
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
    if (!canPurchaseFromTrader(line.itemId, reputation)) return null;
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
  const capacity = shop.capacity ?? TRADER_SHOP_CAPACITY;
  if (!tradeOfferFitsTraderStock(shop.stock, sellLines, buyLines, capacity)) {
    return null;
  }
  const { playerPays, playerReceives, shortfall } = cash;

  let nextInv = cloneInventory(playerInv);
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

  // Selling the worn pack must not leave its contents with nowhere to sit.
  if (!backpackStorageContained(nextInv)) return null;

  return {
    playerInv: nextInv,
    shop: {
      banknotes: shop.banknotes - playerReceives + playerPays,
      stock: nextStock,
      capacity,
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
