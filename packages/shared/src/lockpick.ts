/**
 * Lockpicks, lock difficulties, and which doors spawn locked.
 * Time, break chance, and noise radius live in skillEffects (they follow
 * effective skill level). This file is the door and item side.
 */

import {
  getEntryDurability,
  type Inventory,
} from "./items.js";
import {
  gunShopOfficeForBuilding,
  officeManagerRoomForBuilding,
  policeJailCellForBuilding,
  policeSergeantRoomForBuilding,
  retailManagerRoomForBuilding,
} from "./interior.js";

export const LOCKPICK_ITEM_ID = "lockpick";

/** searchTargetId prefix so a pick reuses the search channel. */
export const LOCKPICK_TARGET_PREFIX = "lockpick:";

/** Milliseconds to finish a pick at lockpicking level 0 and level 100. */
export const LOCKPICK_DURATION_AT_0_MS = 60_000;
export const LOCKPICK_DURATION_AT_100_MS = 30_000;

/** Chance a finished pick spends one use, at level 0 and level 100. */
export const LOCKPICK_CONSUME_AT_0 = 1;
export const LOCKPICK_CONSUME_AT_100 = 0.5;

/** Tiles of zombie alert when a pick starts, at stealth level 0 and level 100. */
export const LOCKPICK_NOISE_AT_0 = 10;
export const LOCKPICK_NOISE_AT_100 = 5;

export type LockDifficulty = "easy" | "medium" | "hard";

/** Minimum effective lockpicking level required to attempt each lock. */
export const LOCK_DIFFICULTY_LEVEL: Record<LockDifficulty, number> = {
  easy: 0,
  medium: 25,
  hard: 50,
};

export function canPickLockAtLevel(
  level: number,
  difficulty: LockDifficulty,
): boolean {
  return level >= LOCK_DIFFICULTY_LEVEL[difficulty];
}

export function lockpickTargetId(x: number, y: number): string {
  return `${LOCKPICK_TARGET_PREFIX}${x},${y}`;
}

export function parseLockpickTarget(
  id: string,
): { x: number; y: number } | null {
  if (!id.startsWith(LOCKPICK_TARGET_PREFIX)) return null;
  const rest = id.slice(LOCKPICK_TARGET_PREFIX.length);
  const comma = rest.indexOf(",");
  if (comma < 0) return null;
  const x = Number(rest.slice(0, comma));
  const y = Number(rest.slice(comma + 1));
  if (!Number.isInteger(x) || !Number.isInteger(y)) return null;
  return { x, y };
}

/** First lockpick that still has uses left, or -1. */
export function findUsableLockpickSlot(inventory: Inventory): number {
  for (let i = 0; i < inventory.length; i++) {
    const slot = inventory[i];
    if (!slot || slot.id !== LOCKPICK_ITEM_ID || slot.quantity <= 0) continue;
    if (getEntryDurability(slot) <= 0) continue;
    return i;
  }
  return -1;
}

/**
 * Every manager office in an office building, department store, or gun shop
 * starts locked. Coordinates stay on the signature so callers and a later
 * interior rebuild share one check.
 */
export function managerOfficeStartsLocked(_bx: number, _by: number): boolean {
  return true;
}

/** Manager-office door tile when this building spawned that door locked. */
export function managerOfficeLockTile(
  bx: number,
  by: number,
): { x: number; y: number } | null {
  if (!managerOfficeStartsLocked(bx, by)) return null;
  const office = officeManagerRoomForBuilding(bx, by);
  if (office) return { x: office.entranceX, y: office.entranceY };
  const retail = retailManagerRoomForBuilding(bx, by);
  if (retail) return { x: retail.entranceX, y: retail.entranceY };
  const gunShop = gunShopOfficeForBuilding(bx, by);
  if (gunShop) return { x: gunShop.entranceX, y: gunShop.entranceY };
  return null;
}

/** Sergeant's office door. Every police station spawns this lock. */
export function policeSergeantLockTile(
  bx: number,
  by: number,
): { x: number; y: number } | null {
  const office = policeSergeantRoomForBuilding(bx, by);
  if (!office) return null;
  return { x: office.entranceX, y: office.entranceY };
}

/** Jail cell door. Every police station spawns this lock. */
export function policeCellLockTile(
  bx: number,
  by: number,
): { x: number; y: number } | null {
  const cell = policeJailCellForBuilding(bx, by);
  if (!cell) return null;
  return { x: cell.entranceX, y: cell.entranceY };
}

function tileIs(
  tile: { x: number; y: number } | null,
  tx: number,
  ty: number,
): boolean {
  return !!tile && tile.x === tx && tile.y === ty;
}

/**
 * Easy, for a manager office, sergeant's office, or jail cell that spawned
 * locked. Other tiles are not pick locks.
 */
export function lockDifficultyAt(
  bx: number,
  by: number,
  tx: number,
  ty: number,
): LockDifficulty | null {
  if (tileIs(managerOfficeLockTile(bx, by), tx, ty)) return "easy";
  if (tileIs(policeSergeantLockTile(bx, by), tx, ty)) return "easy";
  if (tileIs(policeCellLockTile(bx, by), tx, ty)) return "easy";
  return null;
}

/**
 * Unowned manager-office door that spawned locked.
 * A survivor's code lock is never picked, even on the same tile.
 */
export function pickableLockDifficulty(
  bx: number,
  by: number,
  tx: number,
  ty: number,
  ownerWallet: string,
): LockDifficulty | null {
  if (ownerWallet) return null;
  return lockDifficultyAt(bx, by, tx, ty);
}
