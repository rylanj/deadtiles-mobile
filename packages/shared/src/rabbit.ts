import { isInBirchport } from "./birchport.js";
import { isInBirchportBarracks } from "./birchportBarracks.js";
import {
  canMoveAt,
  isWoodedForestAt,
  seededRandom,
} from "./worldgen.js";
import { INITIAL_WORLD_BOUNDS, type WorldBounds } from "./worldBounds.js";

/** One warren site per this many tiles. Most wooded cells still roll empty. */
export const RABBIT_CELL = 80;
/** Chance a wooded cell actually has a warren. */
export const RABBIT_SPAWN_CHANCE = 0.33;
/** Rabbits sharing a warren. They do not bolt from each other. */
export const RABBIT_GROUP_MIN = 2;
export const RABBIT_GROUP_MAX = 3;
/** Rabbits inside this Chebyshev distance of an outdoor player wake up. */
export const RABBIT_ACTIVATE_RADIUS = 80;
/** Wake stays until every player is farther than this from the rabbit. */
export const RABBIT_DEACTIVATE_RADIUS = 120;
/** Grazing stays inside this radius of wherever they last settled. */
export const RABBIT_HOME_RADIUS = 6;

/**
 * Anything this close (players, zombies, guards, coyotes, bears, crows)
 * sends the rabbit running. Other rabbits do not.
 */
export const RABBIT_SCARE_RADIUS = 6;
/** How far a bolt carries them before they look for a new patch of grass. */
export const RABBIT_FLEE_MIN_TILES = 12;
export const RABBIT_FLEE_MAX_TILES = 22;

/** A hop. Slower than a person walking. */
export const RABBIT_SPEED = 1.15;
/**
 * Bolt. Above a walk (1.8) and under a sprint (5.4), so running them
 * down still works and a stroll does not.
 */
export const RABBIT_FLEE_SPEED = 4.6;
/** A pistol drops one. */
export const RABBIT_MAX_HEALTH = 24;

export const RABBIT_WALK_FRAMES = 8;
export const RABBIT_DIE_FRAMES = 9;
/** Small. Taller than a standing crow, well under a coyote. */
export const RABBIT_RENDER_HEIGHT = 42;
export const RABBIT_DIE_ANIM_MS = 800;

export const RABBIT_WALK_CYCLE_TILES = 0.9;
export const RABBIT_TILES_PER_WALK_FRAME =
  RABBIT_WALK_CYCLE_TILES / RABBIT_WALK_FRAMES;
/** Longer stride while bolting so the hop stays readable at flee speed. */
export const RABBIT_FLEE_CYCLE_TILES = 2.0;
export const RABBIT_TILES_PER_FLEE_FRAME =
  RABBIT_FLEE_CYCLE_TILES / RABBIT_WALK_FRAMES;

export const RABBIT_RAW_MEAT_MIN = 1;
export const RABBIT_RAW_MEAT_MAX = 1;

export type RabbitSpawn = {
  id: string;
  x: number;
  y: number;
  homeX: number;
  homeY: number;
};

export function rollRabbitMeatQuantity(id: string): number {
  const rng = seededRandom(`rabbit-meat:${id}`);
  const span = RABBIT_RAW_MEAT_MAX - RABBIT_RAW_MEAT_MIN + 1;
  return RABBIT_RAW_MEAT_MIN + Math.floor(rng() * span);
}

function grazeTileOk(tx: number, ty: number, bounds: WorldBounds): boolean {
  if (!isWoodedForestAt(tx, ty)) return false;
  if (isInBirchport(tx + 0.5, ty + 0.5)) return false;
  if (isInBirchportBarracks(tx, ty)) return false;
  return canMoveAt(tx + 0.5, ty + 0.5, bounds);
}

/**
 * A small warren for a forest cell, or null when the cell is not wooded
 * or the rarity roll missed. Spots are fixed for that cell.
 */
export function rabbitWarren(
  cx: number,
  cy: number,
  bounds: WorldBounds = INITIAL_WORLD_BOUNDS,
): RabbitSpawn[] | null {
  const rng = seededRandom(`rabbit:${cx},${cy}`);
  if (rng() >= RABBIT_SPAWN_CHANCE) return null;

  const cell = RABBIT_CELL;
  const ox = cx * cell + cell / 2;
  const oy = cy * cell + cell / 2;

  let centerX = 0;
  let centerY = 0;
  let foundCenter = false;
  for (let i = 0; i < 24; i++) {
    const tx = Math.floor(ox + (rng() - 0.5) * cell * 0.72);
    const ty = Math.floor(oy + (rng() - 0.5) * cell * 0.72);
    if (!grazeTileOk(tx, ty, bounds)) continue;
    centerX = tx + 0.5;
    centerY = ty + 0.5;
    foundCenter = true;
    break;
  }
  if (!foundCenter) return null;

  const count =
    RABBIT_GROUP_MIN +
    Math.floor(rng() * (RABBIT_GROUP_MAX - RABBIT_GROUP_MIN + 1));
  const spawns: RabbitSpawn[] = [];
  for (let slot = 0; slot < count; slot++) {
    let tileX = Math.floor(centerX);
    let tileY = Math.floor(centerY);
    let found = slot === 0;
    for (let i = 0; i < 16; i++) {
      const angle = rng() * Math.PI * 2;
      const dist = 1.2 + rng() * 2.4;
      const tx = Math.floor(centerX + Math.cos(angle) * dist);
      const ty = Math.floor(centerY + Math.sin(angle) * dist);
      if (!grazeTileOk(tx, ty, bounds)) continue;
      const gx = tx + 0.5;
      const gy = ty + 0.5;
      const stacked = spawns.some(
        (spawn) => Math.hypot(spawn.x - gx, spawn.y - gy) < 0.8,
      );
      if (stacked) continue;
      tileX = tx;
      tileY = ty;
      found = true;
      break;
    }
    if (!found && slot > 0) continue;
    spawns.push({
      id: `rabbit-${cx}_${cy}-${slot}`,
      x: tileX + 0.5,
      y: tileY + 0.5,
      homeX: tileX + 0.5,
      homeY: tileY + 0.5,
    });
  }
  return spawns.length > 0 ? spawns : null;
}
