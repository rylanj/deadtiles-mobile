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

/**
 * Drop one standing level after attacking a faction.
 * Allied → Friendly → Warm → Neutral → Wary → Hostile → Exiled.
 */
export function dropFactionReputationLevel(reputation: number): number {
  if (reputation >= FACTION_REP_ALLIED) return FACTION_REP_FRIENDLY;
  if (reputation >= FACTION_REP_FRIENDLY) return FACTION_REP_WARM;
  if (reputation >= FACTION_REP_WARM) return FACTION_REP_NEUTRAL;
  if (reputation >= FACTION_REP_NEUTRAL) return FACTION_REP_WARY;
  if (reputation >= FACTION_REP_WARY) return FACTION_REP_HOSTILE;
  if (reputation >= FACTION_REP_HOSTILE) return FACTION_REP_EXILED;
  return FACTION_REP_EXILED;
}
