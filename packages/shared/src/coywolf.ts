import { isInBirchport } from "./birchport.js";
import { isInBirchportBarracks } from "./birchportBarracks.js";
import {
  canMoveAt,
  isWoodedForestAt,
  seededRandom,
} from "./worldgen.js";
import { INITIAL_WORLD_BOUNDS, type WorldBounds } from "./worldBounds.js";

/** One pack site per this many tiles. */
export const COYWOLF_PACK_CELL = 80;
/** Packs inside this Chebyshev distance of an outdoor player wake up. */
export const COYWOLF_ACTIVATE_RADIUS = 64;
/** Wake stays until every player is farther than this from the pack home. */
export const COYWOLF_DEACTIVATE_RADIUS = 120;
/** Wander stays inside this radius of the pack's home tile. */
export const COYWOLF_HOME_RADIUS = 16;

export const COYWOLF_PACK_MIN = 1;
export const COYWOLF_PACK_MAX = 5;

/** Trot. Faster than a shambling zombie, slower than a sprinting player. */
export const COYWOLF_SPEED = 0.9;
/** Bolt. Close to a player's sprint, so a walk cannot keep up. */
export const COYWOLF_RUN_SPEED = 4.8;
export const COYWOLF_MAX_HEALTH = 45;
/** A zombie this close, and in sight, makes a calm pack bolt. */
export const COYWOLF_ZOMBIE_SCARE_RADIUS = 8;
/** Flee until every threat is at least this far (tiles). */
export const COYWOLF_EVADE_DIST = 30;
/** After they escape, they still fear that source for this long. */
export const COYWOLF_FEAR_MS = 5 * 60 * 1000;

export const COYWOLF_WALK_FRAMES = 8;
export const COYWOLF_RUN_FRAMES = 8;
export const COYWOLF_DIE_FRAMES = 9;
/** Shorter than a standing person so the body reads as an animal. */
export const COYWOLF_RENDER_HEIGHT = 67.2;
export const COYWOLF_DIE_ANIM_MS = 780;

export const COYWOLF_WALK_CYCLE_TILES = 0.7;
export const COYWOLF_TILES_PER_WALK_FRAME =
  COYWOLF_WALK_CYCLE_TILES / COYWOLF_WALK_FRAMES;
/** Ground covered by one gallop. Short values make the legs spin ahead of the body. */
export const COYWOLF_RUN_CYCLE_TILES = 2.8;
export const COYWOLF_TILES_PER_RUN_FRAME =
  COYWOLF_RUN_CYCLE_TILES / COYWOLF_RUN_FRAMES;

export type CoywolfSpawn = {
  id: string;
  slot: number;
  x: number;
  y: number;
  homeX: number;
  homeY: number;
};

function packTileOk(tx: number, ty: number, bounds: WorldBounds): boolean {
  if (!isWoodedForestAt(tx, ty)) return false;
  if (isInBirchport(tx + 0.5, ty + 0.5)) return false;
  if (isInBirchportBarracks(tx, ty)) return false;
  return canMoveAt(tx + 0.5, ty + 0.5, bounds);
}

/**
 * Deterministic pack for one forest cell, or null when the cell has no
 * wooded floor. Size is 1 to 5. Members cluster on walkable forest tiles.
 */
export function coywolfPackSpawns(
  cx: number,
  cy: number,
  bounds: WorldBounds = INITIAL_WORLD_BOUNDS,
): CoywolfSpawn[] | null {
  const rng = seededRandom(`coywolf-pack:${cx},${cy}`);
  const cell = COYWOLF_PACK_CELL;
  const ox = cx * cell + cell / 2;
  const oy = cy * cell + cell / 2;

  let anchorX = 0;
  let anchorY = 0;
  let found = false;
  for (let i = 0; i < 24; i++) {
    const tx = Math.floor(ox + (rng() - 0.5) * cell * 0.72);
    const ty = Math.floor(oy + (rng() - 0.5) * cell * 0.72);
    if (!packTileOk(tx, ty, bounds)) continue;
    anchorX = tx;
    anchorY = ty;
    found = true;
    break;
  }
  if (!found) return null;

  const count =
    COYWOLF_PACK_MIN +
    Math.floor(rng() * (COYWOLF_PACK_MAX - COYWOLF_PACK_MIN + 1));
  const used = new Set<string>([`${anchorX},${anchorY}`]);
  const tiles: { x: number; y: number }[] = [{ x: anchorX, y: anchorY }];

  for (let slot = 1; slot < count; slot++) {
    let placed = false;
    for (let attempt = 0; attempt < 16; attempt++) {
      const tx = anchorX + Math.floor(rng() * 7) - 3;
      const ty = anchorY + Math.floor(rng() * 7) - 3;
      const key = `${tx},${ty}`;
      if (used.has(key)) continue;
      if (!packTileOk(tx, ty, bounds)) continue;
      used.add(key);
      tiles.push({ x: tx, y: ty });
      placed = true;
      break;
    }
    if (!placed) break;
  }

  const homeX = anchorX + 0.5;
  const homeY = anchorY + 0.5;
  return tiles.map((tile, slot) => ({
    id: `coywolf-${cx}_${cy}-${slot}`,
    slot,
    x: tile.x + 0.5,
    y: tile.y + 0.5,
    homeX,
    homeY,
  }));
}

/** Raw meat on one dead coyote. Not used by furniture loot. */
export const COYOTE_RAW_MEAT_MIN = 2;
export const COYOTE_RAW_MEAT_MAX = 8;

export function rollCoyoteMeatQuantity(id: string): number {
  const rng = seededRandom(`coyote-meat:${id}`);
  const span = COYOTE_RAW_MEAT_MAX - COYOTE_RAW_MEAT_MIN + 1;
  return COYOTE_RAW_MEAT_MIN + Math.floor(rng() * span);
}
