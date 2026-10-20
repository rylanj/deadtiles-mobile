import { isInBirchport } from "./birchport.js";
import { isInBirchportBarracks } from "./birchportBarracks.js";
import {
  canMoveAt,
  isWoodedForestAt,
  seededRandom,
} from "./worldgen.js";
import {
  INITIAL_WORLD_BOUNDS,
  isNearBorderWall,
  type WorldBounds,
} from "./worldBounds.js";

/**
 * One group site per this many tiles. Larger than the old 80-tile grid, and
 * most wooded cells still roll empty, so dens are rarer than they were.
 * Bear dens are one per 160 tiles at a 40% chance (about one bear per 64,000
 * tiles of woods). At 45% this grid is about one group per 32,000 tiles, so
 * coyotes stay a bit more common than bears.
 */
export const COYWOLF_PACK_CELL = 120;
/** Chance a wooded cell actually has coyotes. */
export const COYWOLF_SPAWN_CHANCE = 0.45;
/**
 * Groups inside this Chebyshev distance of an outdoor player wake up.
 * Wide enough that a pack near the edge of a 120-tile cell exists before
 * its 30-tile hunt reaches you.
 */
export const COYWOLF_ACTIVATE_RADIUS = 96;
/** Wake stays until every player is farther than this from the pack. */
export const COYWOLF_DEACTIVATE_RADIUS = 120;
/** Wander stays inside this radius of wherever the pack last settled. */
export const COYWOLF_HOME_RADIUS = 16;

export const COYWOLF_PACK_MIN = 1;
export const COYWOLF_PACK_MAX = 5;
/**
 * Six singles, five pairs, then a few real packs. About three quarters of
 * groups are one or two coyotes.
 */
const COYWOLF_SIZE_ROLLS = [1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 3, 3, 4, 5] as const;

/** This many living coyotes hunt. One or two still only flee. */
export const COYWOLF_PACK_HUNT_SIZE = 3;
/** A hunting pack notices players and guards inside this distance (tiles). Zombies are ignored until one of them lands a hit. */
export const COYWOLF_PACK_HUNT_RADIUS = 30;
/**
 * Once they have a target, they keep it until it is this far from every
 * living member, or they lose sight of it. A little past the hunt radius
 * so they do not spin at the edge.
 */
export const COYWOLF_PACK_CHASE_RADIUS = 40;
/** Lunge reach. Longer than a zombie's grab, shorter than a bear's swipe. */
export const COYWOLF_PACK_ATTACK_RANGE = 0.9;
/** One bite. Zombies hit for 15, bears for 35. */
export const COYWOLF_PACK_DAMAGE = 18;
/** Pause after they reach biting range, before the first snap. */
export const COYWOLF_PACK_ATTACK_WINDUP_MS = 700;
/** Wait between bites while they stay in range. */
export const COYWOLF_PACK_ATTACK_COOLDOWN_MS = 2000;
/** After a packmate dies, this is the chance the rest break and run. */
export const COYWOLF_PACK_FLEE_CHANCE = 0.5;

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
/**
 * Prey ducked into a building. Stand on the stoop this long so a quick peek
 * is still dangerous, then walk off instead of camping the door.
 */
export const COYWOLF_DOOR_LINGER_MS = 8000;
/** Extra random wait on top of the linger so packs do not leave in lockstep. */
export const COYWOLF_DOOR_LINGER_JITTER_MS = 3500;
/** After leaving a door, skip that player this long unless they get close or hit the pack. */
export const COYWOLF_BOREDOM_MS = 28000;
/** This close, boredom ignore breaks. They will hunt again. */
export const COYWOLF_BOREDOM_BREAK_DIST = 5;
/** Walk at least this far from the door when they get bored. */
export const COYWOLF_LEAVE_DIST_MIN = 16;
export const COYWOLF_LEAVE_DIST_MAX = 26;

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
  if (isNearBorderWall(tx, ty)) return false;
  if (!isWoodedForestAt(tx, ty)) return false;
  if (isInBirchport(tx + 0.5, ty + 0.5)) return false;
  if (isInBirchportBarracks(tx, ty)) return false;
  return canMoveAt(tx + 0.5, ty + 0.5, bounds);
}

/**
 * Deterministic group for one forest cell, or null when the roll is empty
 * or the cell has no wooded floor. Size is usually 1 or 2. Members cluster
 * on walkable forest tiles.
 */
export function coywolfPackSpawns(
  cx: number,
  cy: number,
  bounds: WorldBounds = INITIAL_WORLD_BOUNDS,
): CoywolfSpawn[] | null {
  const rng = seededRandom(`coywolf-pack:${cx},${cy}`);
  if (rng() > COYWOLF_SPAWN_CHANCE) return null;
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
    COYWOLF_SIZE_ROLLS[Math.floor(rng() * COYWOLF_SIZE_ROLLS.length)] ??
    COYWOLF_PACK_MIN;
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
