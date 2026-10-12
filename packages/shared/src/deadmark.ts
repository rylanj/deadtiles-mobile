import { factionStanding, factionStandingLabel, type FactionStanding } from "./factionRep.js";

/** Coast buy for one UTC day, in whole marks. First come, first served. */
export const DEADMARK_COAST_PER_DAY = 120_000;

/** Notes one wallet may wire today, by Ashen Traders standing. */
export const DEADMARK_WIRE_CAP: Record<FactionStanding, number> = {
  exiled: 0,
  hostile: 0,
  wary: 1_000,
  neutral: 2_500,
  warm: 6_000,
  friendly: 12_000,
  allied: 25_000,
};

/** Largest single wire the desk will accept. Matches the Allied cap. */
export const DEADMARK_MAX_WIRE = DEADMARK_WIRE_CAP.allied;

/**
 * Smallest wire Kevin will send. If less than this is all that is left
 * today, that remainder can still go.
 */
export const DEADMARK_MIN_WIRE = 250;

/** Lesser of the usual floor and what this player can still wire today. */
export function deadmarkMinWire(leftToday: number): number {
  const left = Math.max(0, Math.floor(leftToday));
  if (left <= 0) return DEADMARK_MIN_WIRE;
  return Math.min(DEADMARK_MIN_WIRE, left);
}

export function deadmarkWireCap(reputation: number): number {
  return DEADMARK_WIRE_CAP[factionStanding(reputation)];
}

export function deadmarkStandingLabel(reputation: number): string {
  return factionStandingLabel(factionStanding(reputation));
}

/** UTC calendar day, `YYYY-MM-DD`. The coast and the personal cap share this clock. */
export function deadmarkUtcDay(nowMs: number): string {
  return new Date(nowMs).toISOString().slice(0, 10);
}

export function deadmarkWireRoom(input: {
  notesInPack: number;
  reputation: number;
  personalUsed: number;
  coastSpent: number;
  /** Notes owed to the coast. They leave the pack with the wire. */
  penaltyDue?: number;
}): { max: number; personalLeft: number; coastLeft: number; cap: number; minWire: number } {
  const cap = deadmarkWireCap(input.reputation);
  const personalLeft = Math.max(0, cap - Math.max(0, input.personalUsed));
  const coastLeft = Math.max(0, DEADMARK_COAST_PER_DAY - Math.max(0, input.coastSpent));
  const penalty = Math.max(0, Math.floor(input.penaltyDue ?? 0));
  const notes = Math.max(0, Math.floor(input.notesInPack) - penalty);
  const leftToday = Math.min(personalLeft, coastLeft);
  const minWire = deadmarkMinWire(leftToday);
  const room = Math.min(notes, leftToday);
  const max = room >= minWire ? room : 0;
  return { max, personalLeft, coastLeft, cap, minWire };
}

/** Kevin's line when a landed wire is missing from the database and cashout is locked. */
export function deadmarkWireOutageReason(): string {
  return "The east is having issues with their wire system. Come back later.";
}

/** Why the desk will not open a wire. Used when max is below the minimum. */
export function deadmarkWireClosedReason(input: {
  configured: boolean;
  /** Chain and database disagree, so the desk is locked. */
  outage?: boolean;
  cap: number;
  notesInPack: number;
  coastLeft: number;
  personalLeft: number;
  penaltyDue?: number;
}): string {
  const penalty = Math.max(0, Math.floor(input.penaltyDue ?? 0));
  const minWire = deadmarkMinWire(Math.min(input.personalLeft, input.coastLeft));
  if (input.outage) return deadmarkWireOutageReason();
  if (!input.configured) return "The coast isn't taking paper today. Hold the notes.";
  if (input.cap <= 0) return "I don't wire for your standing.";
  if (input.notesInPack <= 0) return "You don't have notes to ship.";
  if (input.coastLeft <= 0) return "The coast is full for today. Try again tomorrow.";
  if (input.personalLeft <= 0) return "That's as much as your standing wires today.";
  if (penalty > 0 && input.notesInPack - penalty < minWire) {
    const need = (minWire + penalty).toLocaleString("en-US");
    return `Bring ${need} notes. ${minWire.toLocaleString("en-US")} to wire, and ${penalty.toLocaleString("en-US")} for the coast's penalty.`;
  }
  if (input.notesInPack < minWire) {
    return `I don't wire fewer than ${minWire.toLocaleString("en-US")} notes.`;
  }
  return "The book can't take any more today.";
}

/** What Kevin's desk shows, and what a wire result refreshes. */
export type WireDeskPayload = {
  traderId: string;
  configured: boolean;
  /** True when cashout is locked because the chain and the database disagree. */
  outage?: boolean;
  notesInPack: number;
  personalCap: number;
  personalLeft: number;
  coastLeft: number;
  coastCap: number;
  max: number;
  /** Least this desk will send right now. 250, or today's remainder if that is less. */
  minWire: number;
  pendingNotes: number;
  /** One-time penalty taken with the next wire, for a closed coast-paid account. */
  penaltyDue: number;
  destination: string;
  standing: string;
  inventoryJson: string;
};

export type WireResultPayload = WireDeskPayload & {
  ok: boolean;
  pending: boolean;
  reason: string;
};
