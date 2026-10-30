import {
  BACKPACK_FANNY_ID,
  BACKPACK_HIKING_ID,
  BACKPACK_HUNTING_ID,
  BACKPACK_LEATHER_ID,
  BACKPACK_SMALL_ID,
  BACKPACK_UTILITY_ID,
  GIFT_BOX_ITEM_ID,
  WATCH_LOOT,
} from "./items.js";

export const INVITE_BONUS_BANKNOTES = 100;
export const INVITE_BONUS_REPUTATION = 500;
export const REFERRER_PAYOUT_BANKNOTES = 10_000;

/** Half of gift boxes. One scrap each. */
const GIFT_BOX_SCRAP = [
  "screws",
  "bolts",
  "rags",
  "teddy",
  "old_teddy",
  "duct_tape",
  "scrap_metal",
] as const;

/** The other half. Never a weapon, a weapon part, or another gift box. */
const GIFT_BOX_GOOD: readonly { id: string; quantity: number }[] = [
  { id: "gold_chain", quantity: 1 },
  { id: "gold_earrings", quantity: 1 },
  { id: "gold_ring", quantity: 1 },
  { id: "silver_chain", quantity: 1 },
  { id: "silver_ring", quantity: 1 },
  ...WATCH_LOOT.map((watch) => ({ id: watch.id, quantity: 1 })),
  { id: BACKPACK_FANNY_ID, quantity: 1 },
  { id: BACKPACK_UTILITY_ID, quantity: 1 },
  { id: BACKPACK_SMALL_ID, quantity: 1 },
  { id: BACKPACK_HUNTING_ID, quantity: 1 },
  { id: BACKPACK_LEATHER_ID, quantity: 1 },
  { id: BACKPACK_HIKING_ID, quantity: 1 },
  { id: "ammo_9x19", quantity: 10 },
  { id: "ammo_buckshot", quantity: 8 },
  { id: "ammo_762x39", quantity: 10 },
  { id: "ammo_556x45", quantity: 10 },
  { id: "ammo_44", quantity: 6 },
  { id: "bandages", quantity: 1 },
  { id: "alcohol", quantity: 1 },
  { id: "antibiotics", quantity: 1 },
  { id: "multivitamins", quantity: 1 },
];

export type GiftBoxReward = { id: string; quantity: number };

/** 50% scrap, 50% a good item. Quantity is 1 except a short ammo stack. */
export function rollGiftBox(rng: () => number = Math.random): GiftBoxReward {
  const roll = rng();
  if (roll < 0.5) {
    const index = Math.min(
      GIFT_BOX_SCRAP.length - 1,
      Math.floor(rng() * GIFT_BOX_SCRAP.length),
    );
    return { id: GIFT_BOX_SCRAP[index]!, quantity: 1 };
  }
  const index = Math.min(
    GIFT_BOX_GOOD.length - 1,
    Math.floor(rng() * GIFT_BOX_GOOD.length),
  );
  return GIFT_BOX_GOOD[index]!;
}

export function isGiftBoxItem(itemId: string): boolean {
  return itemId === GIFT_BOX_ITEM_ID;
}
