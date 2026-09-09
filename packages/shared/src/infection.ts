import { PLAYER_MAX_HEALTH } from "./constants.js";

/** Zombie melee: chance to start an infection (0–1). */
export const ZOMBIE_INFECTION_CHANCE = 0.1;
/** Infection percent changes on this interval. */
export const INFECTION_TICK_MS = 60_000;
/** Percent gained per tick while untreated. */
export const INFECTION_TICK_UP = 1;
/** Percent lost per tick while antibiotics are active. */
export const INFECTION_TICK_DOWN = 2;
export const INFECTION_MAX = 100;
/** One course of antibiotics lasts this long. */
export const ANTIBIOTIC_DURATION_MS = 30 * 60 * 1000;

export type InfectionState = {
  infected: boolean;
  /** 0–100. Can be 0 while infected (just contracted). */
  infection: number;
  /** Epoch ms; 0 if not on antibiotics. */
  antibioticUntil: number;
  /** Epoch ms of the next infection tick. */
  infectionTickAt: number;
};

export function clearInfection(state: InfectionState): void {
  state.infected = false;
  state.infection = 0;
  state.antibioticUntil = 0;
  state.infectionTickAt = 0;
}

/** Clear the infection but keep any remaining antibiotic course. */
export function cureInfection(state: InfectionState): void {
  state.infected = false;
  state.infection = 0;
  state.infectionTickAt = 0;
}

export function hasActiveAntibiotics(state: InfectionState, now: number): boolean {
  return state.antibioticUntil > now;
}

/**
 * Each infection point removes 1% of base max health.
 * 50% infection → 50% max. 0% (just contracted) leaves max unchanged.
 */
export function playerMaxHealthFromInfection(
  infection: number,
  infected = true,
): number {
  if (!infected) return PLAYER_MAX_HEALTH;
  const lost = Math.max(0, Math.min(INFECTION_MAX, Math.floor(infection)));
  return Math.max(0, Math.round((PLAYER_MAX_HEALTH * (100 - lost)) / 100));
}

/** 10% chance to contract infection on a zombie hit. No-op if already infected or on antibiotics. */
export function catchZombieInfection(
  state: InfectionState,
  now: number,
  rng: () => number = Math.random,
): boolean {
  if (state.infected) return false;
  if (hasActiveAntibiotics(state, now)) return false;
  if (rng() >= ZOMBIE_INFECTION_CHANCE) return false;
  state.infected = true;
  state.infection = 0;
  state.infectionTickAt = now + INFECTION_TICK_MS;
  return true;
}

/** Start / refresh a 30-minute antibiotic course, including prophylactic use. */
export function startAntibiotics(state: InfectionState, now: number): boolean {
  state.antibioticUntil = now + ANTIBIOTIC_DURATION_MS;
  if (state.infected) {
    state.infectionTickAt = now + INFECTION_TICK_MS;
  }
  return true;
}

/**
 * Apply due infection ticks while the player is in session.
 * Callers must not use this to catch up time spent logged out.
 * While antibiotics last, infection falls 2%/min and does not rise.
 * After the course, leftover infection (> 0) climbs 1%/min again.
 * Curing keeps any remaining antibiotic time as prophylaxis.
 */
export function tickInfection(state: InfectionState, now: number): void {
  if (!state.infected) {
    if (state.antibioticUntil > 0 && state.antibioticUntil <= now) {
      state.antibioticUntil = 0;
    }
    return;
  }
  if (!(state.infectionTickAt > 0)) {
    state.infectionTickAt = now + INFECTION_TICK_MS;
    return;
  }
  let guard = 0;
  while (state.infected && now >= state.infectionTickAt && guard < 500) {
    guard++;
    const treating = state.antibioticUntil >= state.infectionTickAt;
    if (treating) {
      state.infection = Math.max(0, state.infection - INFECTION_TICK_DOWN);
      if (state.infection <= 0) {
        cureInfection(state);
        return;
      }
    } else {
      state.infection = Math.min(INFECTION_MAX, state.infection + INFECTION_TICK_UP);
    }
    state.infectionTickAt += INFECTION_TICK_MS;
  }
}

/**
 * Saved timer columns hold remaining ms. Values larger than `maxRemaining`
 * are treated as legacy wall-clock timestamps and frozen from last save.
 */
export function remainingMsFromSavedTimer(
  stored: number,
  now: number,
  savedAtMs: number,
  maxRemaining: number,
): number {
  if (!(stored > 0) || !(maxRemaining > 0)) return 0;
  if (stored > maxRemaining) {
    const origin = savedAtMs > 0 ? savedAtMs : now;
    return Math.max(0, Math.min(maxRemaining, stored - origin));
  }
  return Math.min(maxRemaining, stored);
}

/** Apply due in-session ticks, then return remaining durations for persistence. */
export function persistInfectionTimers(
  state: InfectionState,
  now: number,
): { antibioticRemainingMs: number; infectionTickRemainingMs: number } {
  tickInfection(state, now);
  return {
    antibioticRemainingMs:
      state.antibioticUntil > now
        ? Math.min(ANTIBIOTIC_DURATION_MS, state.antibioticUntil - now)
        : 0,
    infectionTickRemainingMs:
      state.infectionTickAt > now
        ? Math.min(INFECTION_TICK_MS, state.infectionTickAt - now)
        : 0,
  };
}

/** Resume timers from remaining (or legacy epoch) values. Does not apply offline ticks. */
export function restoreInfectionTimers(
  state: InfectionState,
  now: number,
  antibioticStored: number,
  tickStored: number,
  savedAtMs = 0,
): void {
  const abx = remainingMsFromSavedTimer(
    antibioticStored,
    now,
    savedAtMs,
    ANTIBIOTIC_DURATION_MS,
  );
  const tick = remainingMsFromSavedTimer(
    tickStored,
    now,
    savedAtMs,
    INFECTION_TICK_MS,
  );
  state.antibioticUntil = abx > 0 ? now + abx : 0;
  state.infectionTickAt = tick > 0 ? now + tick : 0;
}
