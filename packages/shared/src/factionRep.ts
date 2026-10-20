/**
 * Shared faction reputation standings (Ashen Traders, Red Order, …).
 *
 * Exiled: < −100 · Hostile: [−100, 0) · Wary: [0, 500) · Neutral: [500, 1000)
 * Warm: [1000, 2500) · Friendly: [2500, 5000) · Allied: ≥ 5000
 *
 * Everyone starts at 0 (Wary).
 */

export const FACTION_REP_EXILED_THRESHOLD = -100;
/** Value assigned when dropping into Exiled. */
export const FACTION_REP_EXILED = -101;
export const FACTION_REP_HOSTILE = -100;
/** Starting reputation for new players (Wary). */
export const FACTION_REP_START = 0;
export const FACTION_REP_WARY = 0;
export const FACTION_REP_NEUTRAL = 500;
export const FACTION_REP_WARM = 1000;
export const FACTION_REP_FRIENDLY = 2500;
export const FACTION_REP_ALLIED = 5000;

/** Hostile band recovers +1 toward 0 every this many wall-clock ms (online or offline). */
export const FACTION_HOSTILE_RECOVERY_MS = 10 * 60 * 1000;
export const FACTION_HOSTILE_RECOVERY_PER_INTERVAL = 1;

export type FactionStanding =
  | "exiled"
  | "hostile"
  | "wary"
  | "neutral"
  | "warm"
  | "friendly"
  | "allied";

export function factionStanding(reputation: number): FactionStanding {
  if (reputation < FACTION_REP_EXILED_THRESHOLD) return "exiled";
  if (reputation < FACTION_REP_WARY) return "hostile";
  if (reputation < FACTION_REP_NEUTRAL) return "wary";
  if (reputation < FACTION_REP_WARM) return "neutral";
  if (reputation < FACTION_REP_FRIENDLY) return "warm";
  if (reputation < FACTION_REP_ALLIED) return "friendly";
  return "allied";
}

export function factionStandingLabel(standing: FactionStanding): string {
  switch (standing) {
    case "exiled":
      return "Exiled";
    case "hostile":
      return "Hostile";
    case "wary":
      return "Wary";
    case "warm":
      return "Warm";
    case "friendly":
      return "Friendly";
    case "allied":
      return "Allied";
    default:
      return "Neutral";
  }
}

/** Inclusive floor of a standing band. Exiled has no floor. */
export function factionStandingFloor(standing: FactionStanding): number | null {
  switch (standing) {
    case "hostile":
      return FACTION_REP_HOSTILE;
    case "wary":
      return FACTION_REP_WARY;
    case "neutral":
      return FACTION_REP_NEUTRAL;
    case "warm":
      return FACTION_REP_WARM;
    case "friendly":
      return FACTION_REP_FRIENDLY;
    case "allied":
      return FACTION_REP_ALLIED;
    default:
      return null;
  }
}

/** Reputation needed to leave this standing. Null at Exiled and Allied. */
export function factionNextStandingAt(standing: FactionStanding): number | null {
  switch (standing) {
    case "hostile":
      return FACTION_REP_WARY;
    case "wary":
      return FACTION_REP_NEUTRAL;
    case "neutral":
      return FACTION_REP_WARM;
    case "warm":
      return FACTION_REP_FRIENDLY;
    case "friendly":
      return FACTION_REP_ALLIED;
    default:
      return null;
  }
}

export function factionNextStanding(
  standing: FactionStanding,
): FactionStanding | null {
  switch (standing) {
    case "hostile":
      return "wary";
    case "wary":
      return "neutral";
    case "neutral":
      return "warm";
    case "warm":
      return "friendly";
    case "friendly":
      return "allied";
    default:
      return null;
  }
}

/** 0–100 progress through the current standing band. Allied is full. Exiled is empty. */
export function factionStandingProgressPct(reputation: number): number {
  const standing = factionStanding(reputation);
  if (standing === "allied") return 100;
  const floor = factionStandingFloor(standing);
  const nextAt = factionNextStandingAt(standing);
  if (floor == null || nextAt == null) return 0;
  const span = nextAt - floor;
  if (span <= 0) return 0;
  return Math.max(0, Math.min(100, ((reputation - floor) / span) * 100));
}

/**
 * Drop one standing level after attacking a faction.
 * Allied → Friendly → Warm → Neutral → Wary → Hostile → Exiled.
 */
/**
 * Hostile band only: +1 toward 0 per {@link FACTION_HOSTILE_RECOVERY_MS}.
 * Wall-clock, online or offline. Exiled never recovers.
 */
export function applyFactionHostileRecovery(
  reputation: number,
  lastCheckMs: number,
  nowMs: number,
): { reputation: number; lastCheckMs: number } {
  if (!Number.isFinite(nowMs) || nowMs <= 0) {
    return { reputation, lastCheckMs };
  }
  if (factionStanding(reputation) !== "hostile") {
    return { reputation, lastCheckMs };
  }
  const anchor = lastCheckMs > 0 ? lastCheckMs : nowMs;
  const elapsed = nowMs - anchor;
  if (elapsed < FACTION_HOSTILE_RECOVERY_MS) {
    return { reputation, lastCheckMs: anchor };
  }
  const steps = Math.floor(elapsed / FACTION_HOSTILE_RECOVERY_MS);
  const nextRep = Math.min(
    FACTION_REP_WARY,
    reputation + steps * FACTION_HOSTILE_RECOVERY_PER_INTERVAL,
  );
  return {
    reputation: nextRep,
    lastCheckMs: anchor + steps * FACTION_HOSTILE_RECOVERY_MS,
  };
}

export function dropFactionReputationLevel(reputation: number): number {
  if (reputation >= FACTION_REP_ALLIED) return FACTION_REP_FRIENDLY;
  if (reputation >= FACTION_REP_FRIENDLY) return FACTION_REP_WARM;
  if (reputation >= FACTION_REP_WARM) return FACTION_REP_NEUTRAL;
  if (reputation >= FACTION_REP_NEUTRAL) return FACTION_REP_WARY;
  if (reputation >= FACTION_REP_WARY) return FACTION_REP_HOSTILE;
  if (reputation >= FACTION_REP_HOSTILE) return FACTION_REP_EXILED;
  return FACTION_REP_EXILED;
}
