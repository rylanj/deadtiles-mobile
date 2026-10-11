import { isInBirchport } from "./birchport.js";
import { isInBirchportBarracks } from "./birchportBarracks.js";
import { TILE_HEIGHT } from "./constants.js";
import { PLAYER_AIM_HEAD_LIFT_PX } from "./isometric.js";
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

/** One crow site per this many tiles. Most wooded cells still roll empty. */
export const CROW_CELL = 96;
/** Chance a wooded cell actually has a crow. */
export const CROW_SPAWN_CHANCE = 0.62;
/** Crows inside this Chebyshev distance of an outdoor player wake up. */
export const CROW_ACTIVATE_RADIUS = 80;
/** Wake stays until every player is farther than this from the crow. */
export const CROW_DEACTIVATE_RADIUS = 120;

/**
 * Anything this close (players, zombies, guards, coyotes, bears) sends the
 * crow up. Other crows do not, so two birds can share a stretch of woods.
 */
export const CROW_SCARE_RADIUS = 6;
/** How far a flush carries them before they look for a perch. */
export const CROW_FLEE_MIN_TILES = 14;
export const CROW_FLEE_MAX_TILES = 28;
/**
 * Distance flown while climbing from the ground to cruise height.
 * Altitude follows this, so they leave the tile while still low.
 */
export const CROW_CLIMB_TILES = 5;
/** Distance left to the perch over which they ease back to the ground. */
export const CROW_DESCEND_TILES = 5;
/** Last of the drop, once they are almost on the perch and barely moving. */
export const CROW_SETTLE_SEC = 0.55;
/** Shot out of the air: the body drops onto its tile over this long. */
export const CROW_FALL_SEC = 0.45;

/** Faster than a walk, slower than a sprint, so a runner can still line up a shot. */
export const CROW_FLY_SPEED = 3.3;
/** A pistol wounds one. A rifle drops it. */
export const CROW_MAX_HEALTH = 32;

export const CROW_FLY_FRAMES = 9;
export const CROW_DIE_FRAMES = 9;
/** Standing bird. Shorter than a person so it reads as a crow. */
  export const CROW_RENDER_HEIGHT = 32;
  /**
 * Fly sheets are 168px to the idle sheet's 128px. Matching the body size
 * means the wing canvas is drawn taller, not that the bird swells.
 */
export const CROW_FLY_RENDER_HEIGHT = Math.round(
  CROW_RENDER_HEIGHT * (168 / 128),
);
export const CROW_DIE_ANIM_MS = 800;
/** Seconds per wing frame. One cycle is about three quarters of a second. */
export const CROW_FLY_FRAME_SEC = 0.08;

/**
 * Cruise height is six times the standing sprite, above the tile they
 * actually occupy. Takeoff and landing ease this in and out.
 */
export const CROW_FLIGHT_LIFT_SCALE = 6;
export const CROW_FLIGHT_LIFT_PX = CROW_RENDER_HEIGHT * CROW_FLIGHT_LIFT_SCALE;
/**
 * Once they are about one body-height up, a swing or a bite cannot reach.
 * Guns still use the lifted silhouette.
 */
export const CROW_MELEE_ALTITUDE = CROW_RENDER_HEIGHT / CROW_FLIGHT_LIFT_PX;

export const CROW_RAW_MEAT_MIN = 1;
export const CROW_RAW_MEAT_MAX = 2;

export type CrowSpawn = {
  id: string;
  x: number;
  y: number;
  homeX: number;
  homeY: number;
};

export function crowFlightLiftPx(altitude: number): number {
  const t = Math.max(0, Math.min(1, altitude));
  return t * CROW_FLIGHT_LIFT_PX;
}

export function crowIsOutOfMeleeReach(altitude: number): boolean {
  return altitude >= CROW_MELEE_ALTITUDE;
}

/**
 * Ground point a gun should aim at so the bullet's screen line meets a body
 * drawn `liftPx` above its feet. Click-to-target stores feet; this shifts the
 * aim straight up-screen by the extra height past a normal chest shot.
 */
export function aimPointForScreenLift(
  x: number,
  y: number,
  liftPx: number,
): { x: number; y: number } {
  const extra = Math.max(0, liftPx - PLAYER_AIM_HEAD_LIFT_PX);
  const shift = extra / TILE_HEIGHT;
  return { x: x - shift, y: y - shift };
}

export function rollCrowMeatQuantity(id: string): number {
  const rng = seededRandom(`crow-meat:${id}`);
  const span = CROW_RAW_MEAT_MAX - CROW_RAW_MEAT_MIN + 1;
  return CROW_RAW_MEAT_MIN + Math.floor(rng() * span);
}

function perchTileOk(tx: number, ty: number, bounds: WorldBounds): boolean {
  if (isNearBorderWall(tx, ty)) return false;
  if (!isWoodedForestAt(tx, ty)) return false;
  if (isInBirchport(tx + 0.5, ty + 0.5)) return false;
  if (isInBirchportBarracks(tx, ty)) return false;
  return canMoveAt(tx + 0.5, ty + 0.5, bounds);
}

/**
 * One crow for a forest cell, or null when the cell is not wooded or the
 * rarity roll missed. The perch is fixed for that cell.
 */
export function crowSpawn(
  cx: number,
  cy: number,
  bounds: WorldBounds = INITIAL_WORLD_BOUNDS,
): CrowSpawn | null {
  const rng = seededRandom(`crow:${cx},${cy}`);
  if (rng() >= CROW_SPAWN_CHANCE) return null;

  const cell = CROW_CELL;
  const ox = cx * cell + cell / 2;
  const oy = cy * cell + cell / 2;

  let tileX = 0;
  let tileY = 0;
  let found = false;
  for (let i = 0; i < 24; i++) {
    const tx = Math.floor(ox + (rng() - 0.5) * cell * 0.72);
    const ty = Math.floor(oy + (rng() - 0.5) * cell * 0.72);
    if (!perchTileOk(tx, ty, bounds)) continue;
    tileX = tx;
    tileY = ty;
    found = true;
    break;
  }
  if (!found) return null;

  return {
    id: `crow-${cx}_${cy}`,
    x: tileX + 0.5,
    y: tileY + 0.5,
    homeX: tileX + 0.5,
    homeY: tileY + 0.5,
  };
}
