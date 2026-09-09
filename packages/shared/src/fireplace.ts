/** Max wood pieces a Fireplace1 can hold. */
export const FIREPLACE_MAX_FUEL = 8;

/** Burn duration granted / consumed per wood piece. */
export const FIREPLACE_WOOD_MS = 10 * 60 * 1000;

/** HP restored each tick while standing next to an active fireplace. */
export const FIREPLACE_PROXIMITY_HEAL_HP = 1;
/** Interval between proximity heal ticks. */
export const FIREPLACE_PROXIMITY_HEAL_INTERVAL_MS = 10_000;
/** Hunger/thirst drain multiplier while standing next to an active fireplace. */
export const FIREPLACE_PROXIMITY_DRAIN_MULT = 0.5;

export type FireplaceFuelState = {
  fuelWood: number;
  activeUntil: number;
  /** Remaining burn ms preserved while extinguished (0 when unused / burning). */
  burnRemainingMs: number;
};

export function fireplaceIsActive(activeUntil: number, now = Date.now()): boolean {
  return activeUntil > now;
}

/**
 * Sync fuel count to remaining burn time while active.
 * Returns true when fuelWood / activeUntil / burnRemainingMs changed.
 */
export function reconcileFireplaceFuel(
  state: FireplaceFuelState,
  now = Date.now(),
): boolean {
  let changed = false;
  let { fuelWood, activeUntil, burnRemainingMs } = state;

  if (activeUntil > 0) {
    if (now >= activeUntil) {
      fuelWood = 0;
      activeUntil = 0;
      burnRemainingMs = 0;
      changed = true;
    } else {
      const slots = Math.ceil((activeUntil - now) / FIREPLACE_WOOD_MS);
      const nextFuel = Math.min(FIREPLACE_MAX_FUEL, Math.max(1, slots));
      if (fuelWood !== nextFuel) {
        fuelWood = nextFuel;
        changed = true;
      }
      if (burnRemainingMs !== 0) {
        burnRemainingMs = 0;
        changed = true;
      }
    }
  } else {
    if (fuelWood < 0) {
      fuelWood = 0;
      changed = true;
    } else if (fuelWood > FIREPLACE_MAX_FUEL) {
      fuelWood = FIREPLACE_MAX_FUEL;
      changed = true;
    }
    if (fuelWood <= 0 && burnRemainingMs !== 0) {
      burnRemainingMs = 0;
      changed = true;
    } else if (burnRemainingMs < 0) {
      burnRemainingMs = 0;
      changed = true;
    }
  }

  state.fuelWood = fuelWood;
  state.activeUntil = activeUntil;
  state.burnRemainingMs = burnRemainingMs;
  return changed;
}

/** Put out an active fire; wood stays, partial log time is preserved for relight. */
export function extinguishFireplace(
  state: FireplaceFuelState,
  now = Date.now(),
): boolean {
  reconcileFireplaceFuel(state, now);
  if (!fireplaceIsActive(state.activeUntil, now)) return false;
  state.burnRemainingMs = Math.max(0, state.activeUntil - now);
  state.activeUntil = 0;
  return true;
}

/**
 * Light a cold fireplace that has fuel.
 * Uses preserved remaining burn time when available (after extinguish).
 */
export function lightFireplace(
  state: FireplaceFuelState,
  now = Date.now(),
): boolean {
  reconcileFireplaceFuel(state, now);
  if (fireplaceIsActive(state.activeUntil, now)) return false;
  if (state.fuelWood <= 0) return false;
  const remaining =
    state.burnRemainingMs > 0
      ? state.burnRemainingMs
      : state.fuelWood * FIREPLACE_WOOD_MS;
  state.activeUntil = now + remaining;
  state.burnRemainingMs = 0;
  return true;
}
