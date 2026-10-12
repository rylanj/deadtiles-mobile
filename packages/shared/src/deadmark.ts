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
 * Smallest wire Kevin will send. Each wire spends SOL on a transaction and
 * may open a token account, so the floor keeps a full day of first wires
 * (coast per day / minimum) inside the daily account rent budget.
 */
export const DEADMARK_MIN_WIRE = 500;

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
}): { max: number; personalLeft: number; coastLeft: number; cap: number } {
  const cap = deadmarkWireCap(input.reputation);
  const personalLeft = Math.max(0, cap - Math.max(0, input.personalUsed));
  const coastLeft = Math.max(0, DEADMARK_COAST_PER_DAY - Math.max(0, input.coastSpent));
  const penalty = Math.max(0, Math.floor(input.penaltyDue ?? 0));
  const notes = Math.max(0, Math.floor(input.notesInPack) - penalty);
  const room = Math.min(notes, personalLeft, coastLeft);
  const max = room >= DEADMARK_MIN_WIRE ? room : 0;
  return { max, personalLeft, coastLeft, cap };
}

/** Why the desk will not open a wire. Used when max is below the minimum. */
export function deadmarkWireClosedReason(input: {
  configured: boolean;
  cap: number;
  notesInPack: number;
  coastLeft: number;
  personalLeft: number;
  penaltyDue?: number;
}): string {
  const penalty = Math.max(0, Math.floor(input.penaltyDue ?? 0));
  if (!input.configured) return "The coast isn't taking paper today. Hold the notes.";
  if (input.cap <= 0) return "I don't wire for your standing.";
  if (input.notesInPack <= 0) return "You don't have notes to ship.";
  if (input.coastLeft <= 0) return "The coast is full for today. Try again tomorrow.";
  if (input.personalLeft <= 0) return "That's as much as your standing wires today.";
  if (penalty > 0 && input.notesInPack - penalty < DEADMARK_MIN_WIRE) {
    const need = (DEADMARK_MIN_WIRE + penalty).toLocaleString("en-US");
    return `Bring ${need} notes. ${DEADMARK_MIN_WIRE} to wire, and ${penalty.toLocaleString("en-US")} for the coast's penalty.`;
  }
  if (input.notesInPack < DEADMARK_MIN_WIRE) {
    return `I don't wire fewer than ${DEADMARK_MIN_WIRE} notes.`;
  }
  if (input.personalLeft < DEADMARK_MIN_WIRE) {
    return `What's left on your standing today is under ${DEADMARK_MIN_WIRE} notes.`;
  }
  if (input.coastLeft < DEADMARK_MIN_WIRE) {
    return `What's left of today's buy is under ${DEADMARK_MIN_WIRE} notes.`;
  }
  return "The book can't take any more today.";
}

/** What Kevin's desk shows, and what a wire result refreshes. */
export type WireDeskPayload = {
  traderId: string;
  configured: boolean;
  notesInPack: number;
  personalCap: number;
  personalLeft: number;
  coastLeft: number;
  coastCap: number;
  max: number;
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
