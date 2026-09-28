/** Pieces of meat a fireplace or mantel can cook at once. */
export const COOK_SLOT_COUNT = 4;
/** Active fire time for raw to become cooked, and cooked to become burnt. */
export const COOK_STAGE_MS = 60_000;

export const RAW_COYOTE_MEAT = "raw_coyote_meat";
export const COOKED_COYOTE_MEAT = "cooked_coyote_meat";
export const BURNT_COYOTE_MEAT = "burnt_coyote_meat";
export const RAW_BEAR_MEAT = "raw_bear_meat";
export const COOKED_BEAR_MEAT = "cooked_bear_meat";
export const BURNT_BEAR_MEAT = "burnt_bear_meat";
export const RAW_BIRD_MEAT = "raw_bird_meat";
export const COOKED_BIRD_MEAT = "cooked_bird_meat";
export const BURNT_BIRD_MEAT = "burnt_bird_meat";
export const RAW_CHICKEN_MEAT = "raw_chicken_meat";
export const COOKED_CHICKEN_MEAT = "cooked_chicken_meat";
export const BURNT_CHICKEN_MEAT = "burnt_chicken_meat";
export const RAW_RABBIT_MEAT = "raw_rabbit_meat";
export const COOKED_RABBIT_MEAT = "cooked_rabbit_meat";
export const BURNT_RABBIT_MEAT = "burnt_rabbit_meat";

/** Next cook stage for each meat id. Burnt meat has no next stage. */
const MEAT_NEXT = new Map<string, string | null>([
  [RAW_COYOTE_MEAT, COOKED_COYOTE_MEAT],
  [COOKED_COYOTE_MEAT, BURNT_COYOTE_MEAT],
  [BURNT_COYOTE_MEAT, null],
  [RAW_BEAR_MEAT, COOKED_BEAR_MEAT],
  [COOKED_BEAR_MEAT, BURNT_BEAR_MEAT],
  [BURNT_BEAR_MEAT, null],
  [RAW_BIRD_MEAT, COOKED_BIRD_MEAT],
  [COOKED_BIRD_MEAT, BURNT_BIRD_MEAT],
  [BURNT_BIRD_MEAT, null],
  [RAW_CHICKEN_MEAT, COOKED_CHICKEN_MEAT],
  [COOKED_CHICKEN_MEAT, BURNT_CHICKEN_MEAT],
  [BURNT_CHICKEN_MEAT, null],
  [RAW_RABBIT_MEAT, COOKED_RABBIT_MEAT],
  [COOKED_RABBIT_MEAT, BURNT_RABBIT_MEAT],
  [BURNT_RABBIT_MEAT, null],
]);

export type CookSlot = {
  itemId: string;
  /** Epoch ms when the current stage started while the fire was lit. 0 when cold or idle. */
  stageStartedAt: number;
};

export function emptyCookSlots(): CookSlot[] {
  return Array.from({ length: COOK_SLOT_COUNT }, () => ({
    itemId: "",
    stageStartedAt: 0,
  }));
}

export function isCoyoteMeat(itemId: string): boolean {
  return (
    itemId === RAW_COYOTE_MEAT ||
    itemId === COOKED_COYOTE_MEAT ||
    itemId === BURNT_COYOTE_MEAT
  );
}

/** Raw, cooked, or burnt meat from any animal the fire can hold. */
export function isCookMeat(itemId: string): boolean {
  return MEAT_NEXT.has(itemId);
}

/** Raw meat that can be placed on a fire. Cooked and burnt are not raw. */
export function isRawMeat(itemId: string): boolean {
  const cooked = MEAT_NEXT.get(itemId);
  if (!cooked) return false;
  return MEAT_NEXT.get(cooked) != null;
}

/** Next item after one finished stage, or null when it cannot cook further. */
export function cookResultOf(itemId: string): string | null {
  return MEAT_NEXT.get(itemId) ?? null;
}

/** First raw meat stack in pack order, for a click on an empty fire slot. */
export function firstRawMeatId(
  slots: ReadonlyArray<{ id: string; quantity: number } | null | undefined>,
): string | null {
  for (const slot of slots) {
    if (slot && slot.quantity > 0 && isRawMeat(slot.id)) return slot.id;
  }
  return null;
}

export function cookSlotsHaveItem(slots: CookSlot[]): boolean {
  return slots.some((slot) => slot.itemId.length > 0);
}

function normalizeCookSlots(raw: unknown): CookSlot[] {
  const out = emptyCookSlots();
  if (!Array.isArray(raw)) return out;
  for (let i = 0; i < COOK_SLOT_COUNT && i < raw.length; i++) {
    const entry = raw[i] as { itemId?: unknown; stageStartedAt?: unknown } | null;
    const itemId = typeof entry?.itemId === "string" ? entry.itemId : "";
    const started = Number(entry?.stageStartedAt);
    out[i] = {
      itemId: isCookMeat(itemId) ? itemId : "",
      stageStartedAt:
        Number.isFinite(started) && started > 0 ? Math.floor(started) : 0,
    };
  }
  return out;
}

export function parseCookSlots(json: string | null | undefined): CookSlot[] {
  if (!json) return emptyCookSlots();
  try {
    return normalizeCookSlots(JSON.parse(json) as unknown);
  } catch {
    return emptyCookSlots();
  }
}

export function serializeCookSlots(slots: CookSlot[]): string {
  return JSON.stringify(normalizeCookSlots(slots));
}

/**
 * Move cook slots forward using only time the fire was actually burning.
 * A stage that does not finish before the fire goes out is reset to 0.
 * Relighting starts that stage over.
 */
export function advanceCookSlots(
  slots: CookSlot[],
  activeUntil: number,
  now: number,
): boolean {
  let changed = false;
  const burning = activeUntil > now;

  for (const slot of slots) {
    if (!slot.itemId || !cookResultOf(slot.itemId)) {
      if (slot.stageStartedAt !== 0) {
        slot.stageStartedAt = 0;
        changed = true;
      }
      continue;
    }

    if (!burning) {
      let guard = 0;
      while (
        guard < COOK_SLOT_COUNT &&
        slot.stageStartedAt > 0 &&
        activeUntil > slot.stageStartedAt &&
        cookResultOf(slot.itemId) &&
        activeUntil - slot.stageStartedAt >= COOK_STAGE_MS
      ) {
        const finishedAt = slot.stageStartedAt + COOK_STAGE_MS;
        slot.itemId = cookResultOf(slot.itemId)!;
        const more = cookResultOf(slot.itemId);
        slot.stageStartedAt = more && activeUntil > finishedAt ? finishedAt : 0;
        changed = true;
        guard++;
      }
      if (slot.stageStartedAt !== 0) {
        slot.stageStartedAt = 0;
        changed = true;
      }
      continue;
    }

    if (slot.stageStartedAt <= 0) {
      slot.stageStartedAt = now;
      changed = true;
      continue;
    }

    let guard = 0;
    while (guard < COOK_SLOT_COUNT) {
      const step = cookResultOf(slot.itemId);
      if (!step) {
        if (slot.stageStartedAt !== 0) {
          slot.stageStartedAt = 0;
          changed = true;
        }
        break;
      }
      if (now - slot.stageStartedAt < COOK_STAGE_MS) break;
      const finishedAt = slot.stageStartedAt + COOK_STAGE_MS;
      slot.itemId = step;
      slot.stageStartedAt = cookResultOf(step) ? finishedAt : 0;
      changed = true;
      guard++;
    }
  }

  return changed;
}
