import Phaser from "phaser";

/** Matches SpriteAlphaOutlinePipeline opaque threshold (~0.05). */
const DEFAULT_ALPHA_TOLERANCE = 13;

type PixelHitImage = Phaser.GameObjects.Sprite | Phaser.GameObjects.Image;

/**
 * True when the world-space point lands on an opaque texel of the sprite
 * (not just its rectangular PNG bounds). Mirrors Phaser's pixelPerfect input
 * path: inverse transform → display origin → texture alpha sample.
 */
export function spriteOpaqueAtWorldPoint(
  sprite: PixelHitImage,
  worldX: number,
  worldY: number,
  alphaTolerance = DEFAULT_ALPHA_TOLERANCE,
): boolean {
  const texture = sprite.texture;
  const frame = sprite.frame;
  const textures = sprite.scene?.textures;
  if (!texture || !frame || !textures) return true;

  const scaleX = sprite.scaleX;
  const scaleY = sprite.scaleY;
  if (scaleX === 0 || scaleY === 0) return false;

  // Same inverse transform Phaser.Input.InputManager uses for non-containers.
  const rotation = sprite.rotation;
  const sin = Math.sin(rotation);
  const cos = Math.cos(rotation);
  const a = cos * scaleX;
  const b = sin * scaleX;
  const c = -sin * scaleY;
  const d = cos * scaleY;
  const id = 1 / (a * d + c * -b);
  let lx =
    d * id * worldX +
    -c * id * worldY +
    (sprite.y * c - sprite.x * d) * id;
  let ly =
    a * id * worldY +
    -b * id * worldX +
    (-sprite.y * a + sprite.x * b) * id;

  lx += sprite.displayOriginX;
  ly += sprite.displayOriginY;

  // Work in untrimmed frame space throughout: displayOrigin is based on it, and
  // getPixelAlpha subtracts the trim offset itself. Atlas frames are trimmed to
  // their opaque bounds, so realWidth/realHeight (not width/height) are correct.
  if (sprite.flipX) lx = frame.realWidth - lx;
  if (sprite.flipY) ly = frame.realHeight - ly;

  const fx = Math.floor(lx);
  const fy = Math.floor(ly);
  if (fx < 0 || fy < 0 || fx >= frame.realWidth || fy >= frame.realHeight) {
    return false;
  }

  // Null means the point landed in trimmed-away padding, i.e. transparent.
  const alpha = textures.getPixelAlpha(fx, fy, texture.key, frame.name);
  return alpha != null && alpha >= alphaTolerance;
}

/** Closest tile in `tiles` to (tx, ty) by Manhattan distance. */
export function nearestManhattanTile(
  tiles: readonly { x: number; y: number }[],
  tx: number,
  ty: number,
): { x: number; y: number } {
  let best = tiles[0] ?? { x: tx, y: ty };
  let bestD = Infinity;
  for (const t of tiles) {
    const d = Math.abs(t.x - tx) + Math.abs(t.y - ty);
    if (d < bestD) {
      bestD = d;
      best = t;
    }
  }
  return best;
}

/**
 * Among images whose opaque texel covers the world point, pick the topmost
 * (highest depth) and return its associated tile.
 */
export function pickTopOpaqueImageAtWorld(
  worldX: number,
  worldY: number,
  candidates: Iterable<{
    image: Phaser.GameObjects.Image;
    x: number;
    y: number;
  }>,
): { x: number; y: number } | null {
  let best: { x: number; y: number; depth: number } | null = null;
  for (const c of candidates) {
    const image = c.image;
    if (!image.visible || !image.active) continue;
    if (!image.getBounds().contains(worldX, worldY)) continue;
    if (!spriteOpaqueAtWorldPoint(image, worldX, worldY)) continue;
    if (!best || image.depth > best.depth) {
      best = { x: c.x, y: c.y, depth: image.depth };
    }
  }
  return best ? { x: best.x, y: best.y } : null;
}
