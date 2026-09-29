import { isInBirchport } from "./birchport.js";
import { isInBirchportBarracks } from "./birchportBarracks.js";
import {
  canMoveAt,
  isWoodedForestAt,
  seededRandom,
} from "./worldgen.js";
import { INITIAL_WORLD_BOUNDS, type WorldBounds } from "./worldBounds.js";

/** One bear site per this many tiles. Most wooded cells still roll empty. */
export const BEAR_CELL = 160;
/** Chance a wooded cell actually has a bear. */
export const BEAR_SPAWN_CHANCE = 0.4;
/** Bears inside this Chebyshev distance of an outdoor player wake up. */
export const BEAR_ACTIVATE_RADIUS = 72;
/** Wake stays until every player is farther than this from the den. */
export const BEAR_DEACTIVATE_RADIUS = 120;
/** Casual wandering stays inside this radius of the den. */
export const BEAR_HOME_RADIUS = 12;

/** Lumber. Slower than a person walking. */
export const BEAR_SPEED = 0.7;
/**
 * Charge. Well above a walk (1.8) and still under a sprint (5.4), so
 * running away still works.
 */
export const BEAR_RUN_SPEED = 4.0;
/** A rifle takes several shots. A pistol takes a lot more. */
export const BEAR_MAX_HEALTH = 400;
/** Aggressive bears notice players and guards inside this Chebyshev distance. Zombies are ignored until one hits the bear. */
export const BEAR_AGGRO_RADIUS = 20;
/**
 * Once chasing, they keep going until the target is this far from the bear.
 * Far enough that a rifle shot still pulls them, and a sprint can break it.
 */
export const BEAR_CHASE_RADIUS = 64;
/** Body reach for a swipe. Larger than a zombie's grab. */
export const BEAR_ATTACK_RANGE = 1.15;
/** Three bites drop a healthy player. */
export const BEAR_DAMAGE = 35;
export const BEAR_ATTACK_COOLDOWN_MS = 1100;

export const BEAR_WALK_FRAMES = 8;
export const BEAR_RUN_FRAMES = 8;
export const BEAR_DIE_FRAMES = 9;
/** Taller than a coyote so the crate-wide art reads as a bear. */
export const BEAR_RENDER_HEIGHT = 108;
export const BEAR_DIE_ANIM_MS = 900;

export const BEAR_WALK_CYCLE_TILES = 1.15;
export const BEAR_TILES_PER_WALK_FRAME =
  BEAR_WALK_CYCLE_TILES / BEAR_WALK_FRAMES;
export const BEAR_RUN_CYCLE_TILES = 2.4;
export const BEAR_TILES_PER_RUN_FRAME =
  BEAR_RUN_CYCLE_TILES / BEAR_RUN_FRAMES;

export type BearSpawn = {
  id: string;
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  aggressive: boolean;
};

function denTileOk(tx: number, ty: number, bounds: WorldBounds): boolean {
  if (!isWoodedForestAt(tx, ty)) return false;
  if (isInBirchport(tx + 0.5, ty + 0.5)) return false;
  if (isInBirchportBarracks(tx, ty)) return false;
  return canMoveAt(tx + 0.5, ty + 0.5, bounds);
}

/**
 * One bear for a forest cell, or null when the cell is not wooded or the
 * rarity roll missed. Temperament is fixed for that den: half charge on
 * sight, half only fight back.
 */
export function bearSpawn(
  cx: number,
  cy: number,
  bounds: WorldBounds = INITIAL_WORLD_BOUNDS,
): BearSpawn | null {
  const rng = seededRandom(`bear:${cx},${cy}`);
  if (rng() >= BEAR_SPAWN_CHANCE) return null;

  const cell = BEAR_CELL;
  const ox = cx * cell + cell / 2;
  const oy = cy * cell + cell / 2;

  let tileX = 0;
  let tileY = 0;
  let found = false;
  for (let i = 0; i < 24; i++) {
    const tx = Math.floor(ox + (rng() - 0.5) * cell * 0.72);
    const ty = Math.floor(oy + (rng() - 0.5) * cell * 0.72);
    if (!denTileOk(tx, ty, bounds)) continue;
    tileX = tx;
    tileY = ty;
    found = true;
    break;
  }
  if (!found) return null;

  return {
    id: `bear-${cx}_${cy}`,
    x: tileX + 0.5,
    y: tileY + 0.5,
    homeX: tileX + 0.5,
    homeY: tileY + 0.5,
    aggressive: rng() < 0.5,
  };
}

/** Raw meat on one dead bear. Not used by furniture loot. */
export const BEAR_RAW_MEAT_MIN = 4;
export const BEAR_RAW_MEAT_MAX = 10;

export function rollBearMeatQuantity(id: string): number {
  const rng = seededRandom(`bear-meat:${id}`);
  const span = BEAR_RAW_MEAT_MAX - BEAR_RAW_MEAT_MIN + 1;
  return BEAR_RAW_MEAT_MIN + Math.floor(rng() * span);
}
