import { TILE_HEIGHT, TILE_WIDTH } from "./constants.js";
import { directionFromWorldDelta, ENTITY_RENDER_HEIGHT } from "./sprites.js";

/**
 * Screen-Y lift from cartesianToIso(feet) to the gun origin at center chest.
 * 80px humans: feet origin 0.95, upper chest ~0.34 from the top, minus 6px feet pad.
 */
export const PLAYER_AIM_HEAD_LIFT_PX =
  Math.round(ENTITY_RENDER_HEIGHT * (0.95 - 0.34) - 6);

/** Tile grid (x right, y down) → screen offset from world origin. */
export function cartesianToIso(x: number, y: number) {
  return {
    x: (x - y) * (TILE_WIDTH / 2),
    y: (x + y) * (TILE_HEIGHT / 2),
  };
}

/** Screen offset → fractional tile grid position. */
export function isoToCartesian(screenX: number, screenY: number) {
  const halfW = TILE_WIDTH / 2;
  const halfH = TILE_HEIGHT / 2;
  return {
    x: (screenY / halfH + screenX / halfW) / 2,
    y: (screenY / halfH - screenX / halfW) / 2,
  };
}

/**
 * How far in front of the body the gun sits, in tiles. Roughly an arm's length,
 * so the shot leaves the weapon rather than the shooter's chest. Measured in
 * world space, which is why it foreshortens on screen the same way the sprite's
 * own gun arm does.
 */
export const MUZZLE_FORWARD_TILES = 0.45;

/**
 * Ground position of the gun: the shooter's feet pushed an arm's length toward
 * the aim point.
 *
 * A bullet flies at {@link PLAYER_AIM_HEAD_LIFT_PX} above this, so this stays a
 * ground-plane point and the height is only ever a screen offset. Unprojecting
 * the chest onto the ground instead would slide the whole shot line north-west
 * and make it cross tiles the round never passes over.
 */
export function gunMuzzleCartesian(
  feetX: number,
  feetY: number,
  aimX: number,
  aimY: number,
) {
  const dx = aimX - feetX;
  const dy = aimY - feetY;
  const dist = Math.hypot(dx, dy);
  if (dist <= 0.001) return { x: feetX, y: feetY };
  // Never step past the aim point when firing at something almost touching.
  const forward = Math.min(MUZZLE_FORWARD_TILES, dist * 0.5);
  return {
    x: feetX + (dx / dist) * forward,
    y: feetY + (dy / dist) * forward,
  };
}

/**
 * Ground point the player is aiming at, from a screen position.
 *
 * The cursor picks a spot on the bullet's flight plane, not on the floor, so
 * the screen point is dropped by the bullet height before unprojecting. This is
 * what makes clicking a zombie's head aim at that zombie rather than at the
 * ground well behind it.
 */
export function aimPointCartesian(screenX: number, screenY: number) {
  return isoToCartesian(screenX, screenY + PLAYER_AIM_HEAD_LIFT_PX);
}

/** Screen position of a bullet-height point above a ground position. */
export function bulletHeightScreenPos(x: number, y: number) {
  const iso = cartesianToIso(x, y);
  return { x: iso.x, y: iso.y - PLAYER_AIM_HEAD_LIFT_PX };
}

/**
 * Entity silhouette in screen pixels, mirroring how EntitySprites draws a body:
 * origin (0.5, 0.95) at cartesianToIso(feet) nudged down by the feet padding,
 * and the body-width box depthSort already uses for overlap.
 */
export const ENTITY_BODY_HALF_WIDTH_PX = 28;
export const ENTITY_FEET_Y_PADDING_PX = 6;
export const ENTITY_FEET_ORIGIN_Y = 0.95;

export type ScreenBox = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

/** Screen-space box covering an entity's drawn body at the given feet tile. */
export function entityScreenBox(
  feetX: number,
  feetY: number,
  renderHeight = ENTITY_RENDER_HEIGHT,
  /** Screen pixels to raise the box. Flying crows pass their current lift. */
  liftPx = 0,
): ScreenBox {
  const iso = cartesianToIso(feetX, feetY);
  const groundY = iso.y + ENTITY_FEET_Y_PADDING_PX - liftPx;
  const halfW = ENTITY_BODY_HALF_WIDTH_PX * (renderHeight / ENTITY_RENDER_HEIGHT);
  return {
    left: iso.x - halfW,
    right: iso.x + halfW,
    top: groundY - renderHeight * ENTITY_FEET_ORIGIN_Y,
    bottom: groundY + renderHeight * (1 - ENTITY_FEET_ORIGIN_Y),
  };
}

/** Depth sort key — higher draws on top in isometric views. */
export function isoDepth(x: number, y: number) {
  return x + y;
}

/** @deprecated Use directionFromWorldDelta for 8-way sprites. */
export function directionFromDelta(dx: number, dy: number): number {
  return directionFromWorldDelta(dx, dy);
}
