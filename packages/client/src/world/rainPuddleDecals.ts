import Phaser from "phaser";
import {
  cartesianToIso,
  generateTile,
  getStreetTileType,
  getStreetlightAt,
  mulberry32,
  TILE_HEIGHT,
  TILE_WIDTH,
  TileType,
  xmur3,
} from "@zombie/shared";
import { IS_MOBILE } from "../gameConfig";
import { tileIndicatorDepth } from "./depthSort";
import { streetSurfaceY } from "./streetLevel";

export type PuddleSurface = "road" | "pavement" | "concrete";

export type PuddleSpec = {
  tx: number;
  ty: number;
  surface: PuddleSurface;
  /** Wetness 0..1 at which this puddle starts appearing. */
  unlock: number;
  variant: number;
  flip: boolean;
  offX: number;
  offY: number;
  maxScale: number;
  maxAlpha: number;
};

export type PuddleSprite = {
  body: Phaser.GameObjects.Image;
  shine: Phaser.GameObjects.Image;
  appear: number;
  spec: PuddleSpec;
};

const PUDDLE_BODY_KEY = (i: number) => `rain-puddle-body-v2-${i}`;
const PUDDLE_SHINE_KEY = (i: number) => `rain-puddle-shine-v2-${i}`;
const VARIANT_COUNT = 7;

function rngFor(seed: string) {
  return mulberry32(xmur3(seed)());
}

function hash01(x: number, y: number, salt: number) {
  let n = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + salt;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n >>> 0) % 1000) / 1000;
}

export function puddleSurfaceAt(tx: number, ty: number): PuddleSurface | null {
  const ttype = generateTile(tx, ty);
  if (ttype === TileType.Road) return "road";
  if (ttype === TileType.Pavement) return "pavement";
  if (ttype === TileType.CarPark) return "concrete";
  if (getStreetlightAt(tx, ty)) {
    const under = getStreetTileType(tx, ty);
    if (under === TileType.Road) return "road";
    if (under === TileType.Pavement) return "pavement";
  }
  return null;
}

function siteChance(surface: PuddleSurface) {
  if (IS_MOBILE) {
    if (surface === "road") return 0.018;
    if (surface === "pavement") return 0.022;
    return 0.02;
  }
  if (surface === "road") return 0.026;
  if (surface === "pavement") return 0.032;
  return 0.028;
}

function siteRoll(tx: number, ty: number, surface: PuddleSurface) {
  return rngFor(`puddle-site:${tx},${ty}`)() < siteChance(surface);
}

export function isPuddleSite(tx: number, ty: number): boolean {
  const surface = puddleSurfaceAt(tx, ty);
  if (!surface) return false;
  if (!siteRoll(tx, ty, surface)) return false;
  const thin = rngFor(`puddle-thin:${tx},${ty}`);
  let near = 0;
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const) {
    const other = puddleSurfaceAt(tx + dx, ty + dy);
    if (!other) continue;
    if (siteRoll(tx + dx, ty + dy, other)) near += 1;
  }
  if (near >= 2 && thin() < 0.92) return false;
  if (near === 1 && thin() < 0.72) return false;
  return true;
}

export function puddleSpecAt(tx: number, ty: number): PuddleSpec | null {
  const surface = puddleSurfaceAt(tx, ty);
  if (!surface || !isPuddleSite(tx, ty)) return null;
  const rng = rngFor(`puddle-spec:${tx},${ty}`);
  return {
    tx,
    ty,
    surface,
    unlock: 0.05 + rng() * 0.86,
    variant: Math.floor(rng() * VARIANT_COUNT),
    flip: rng() < 0.5,
    offX: (rng() - 0.5) * 10,
    offY: (rng() - 0.5) * 5,
    maxScale: 0.42 + rng() * 0.28,
    maxAlpha: 0.5 + rng() * 0.16,
  };
}

type BlobShape = {
  a2: number;
  a3: number;
  a5: number;
  p2: number;
  p3: number;
  p5: number;
  stretch: number;
};

function shapeFor(variant: number): BlobShape {
  const rng = rngFor(`puddle-shape:${variant}`);
  return {
    a2: 0.16 + rng() * 0.28,
    a3: 0.1 + rng() * 0.22,
    a5: 0.05 + rng() * 0.14,
    p2: rng() * Math.PI * 2,
    p3: rng() * Math.PI * 2,
    p5: rng() * Math.PI * 2,
    stretch: 0.72 + rng() * 0.28,
  };
}

function blobField(nx: number, ny: number, shape: BlobShape, salt: number) {
  const sy = ny / shape.stretch;
  const ang = Math.atan2(sy, nx);
  const rad = Math.hypot(nx, sy);
  const mod = Math.max(
    0.42,
    1 +
      shape.a2 * Math.sin(2 * ang + shape.p2) +
      shape.a3 * Math.sin(3 * ang + shape.p3) +
      shape.a5 * Math.sin(5 * ang + shape.p5) +
      (hash01(Math.round(nx * 18), Math.round(sy * 18), salt) - 0.5) * 0.12,
  );
  return rad / mod;
}

function paintBody(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  variant: number,
) {
  const image = ctx.createImageData(w, h);
  const data = image.data;
  const shape = shapeFor(variant);
  const cx = w * 0.5;
  const cy = h * 0.52;
  const rx = w * 0.4;
  const ry = h * 0.34;
  const salt = 1100 + variant * 31;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const nx = (x + 0.5 - cx) / rx;
      const ny = (y + 0.5 - cy) / ry;
      const d = blobField(nx, ny, shape, salt);
      if (d >= 1) continue;
      const fall = (1 - d) * (1 - d * 0.35);
      const sky = Math.max(0, 0.55 - ny) * (0.55 + 0.25 * Math.sin(nx * 5 + variant));
      const r = Math.round(148 + sky * 58);
      const g = Math.round(162 + sky * 52);
      const b = Math.round(174 + sky * 48);
      const i = (y * w + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = Math.round(255 * fall * 0.5);
    }
  }
  ctx.putImageData(image, 0, 0);
}

function paintShine(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  variant: number,
) {
  const image = ctx.createImageData(w, h);
  const data = image.data;
  const shape = shapeFor(variant);
  const cx = w * 0.46;
  const cy = h * 0.38;
  const rx = w * 0.2;
  const ry = h * 0.1;
  const salt = 2100 + variant * 17;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const nx = (x + 0.5 - cx) / rx;
      const ny = (y + 0.5 - cy) / ry;
      const d = blobField(nx, ny, shape, salt);
      if (d >= 1) continue;
      const fall = (1 - d) * (1 - d);
      const i = (y * w + x) * 4;
      data[i] = 228;
      data[i + 1] = 238;
      data[i + 2] = 248;
      data[i + 3] = Math.round(255 * fall * 0.55);
    }
  }
  ctx.putImageData(image, 0, 0);
}

export function ensurePuddleTextures(scene: Phaser.Scene) {
  for (let i = 0; i < VARIANT_COUNT; i++) {
    const bodyKey = PUDDLE_BODY_KEY(i);
    if (!scene.textures.exists(bodyKey)) {
      const canvas = document.createElement("canvas");
      canvas.width = 88;
      canvas.height = 44;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        paintBody(ctx, 88, 44, i);
        scene.textures.addCanvas(bodyKey, canvas);
        scene.textures.get(bodyKey).setFilter(Phaser.Textures.FilterMode.LINEAR);
      }
    }
    const shineKey = PUDDLE_SHINE_KEY(i);
    if (!scene.textures.exists(shineKey)) {
      const canvas = document.createElement("canvas");
      canvas.width = 56;
      canvas.height = 28;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        paintShine(ctx, 56, 28, i);
        scene.textures.addCanvas(shineKey, canvas);
        scene.textures.get(shineKey).setFilter(Phaser.Textures.FilterMode.LINEAR);
      }
    }
  }
}

export function spawnRainPuddle(
  scene: Phaser.Scene,
  spec: PuddleSpec,
): PuddleSprite | null {
  ensurePuddleTextures(scene);
  const iso = cartesianToIso(spec.tx + 0.5, spec.ty + 0.5);
  const x = iso.x + spec.offX;
  const y = iso.y + spec.offY + streetSurfaceY(spec.tx, spec.ty);
  const depth = tileIndicatorDepth(spec.tx, spec.ty) + 0.6;
  const body = scene.add.image(x, y, PUDDLE_BODY_KEY(spec.variant));
  body.setOrigin(0.5, 0.5);
  body.setFlipX(spec.flip);
  body.setDepth(depth);
  body.setAlpha(0);
  body.setVisible(false);
  if (spec.surface === "road") body.setTint(0xc5d4e0);
  else if (spec.surface === "pavement") body.setTint(0xd0d4ce);
  else body.setTint(0xccd0cc);
  const shine = scene.add.image(x - 2, y - 2, PUDDLE_SHINE_KEY(spec.variant));
  shine.setOrigin(0.5, 0.5);
  shine.setFlipX(spec.flip);
  shine.setDepth(depth + 0.01);
  shine.setBlendMode(Phaser.BlendModes.ADD);
  shine.setAlpha(0);
  shine.setVisible(false);
  return { body, shine, appear: 0, spec };
}

export function destroyRainPuddle(sprite: PuddleSprite | null | undefined) {
  if (!sprite) return;
  sprite.body.destroy();
  sprite.shine.destroy();
}

function approach(current: number, target: number, dt: number, ms: number) {
  if (ms <= 0) return target;
  return current + (target - current) * (1 - Math.exp(-dt / ms));
}

/** Grow / fade a puddle. Returns false when it can be destroyed. */
export function tickRainPuddle(
  sprite: PuddleSprite,
  wetness: number,
  dt: number,
  glare: number,
  worldVisible: boolean,
): boolean {
  const { spec } = sprite;
  const unlocked = wetness >= spec.unlock;
  sprite.appear = approach(
    sprite.appear,
    unlocked ? 1 : 0,
    dt,
    unlocked ? 780 : 1400,
  );
  if (sprite.appear < 0.012 && !unlocked) {
    sprite.body.setVisible(false);
    sprite.shine.setVisible(false);
    return false;
  }
  if (!worldVisible) {
    sprite.body.setVisible(false);
    sprite.shine.setVisible(false);
    return true;
  }
  const grow = Math.max(0, Math.min(1, (wetness - spec.unlock) / 0.38));
  const size =
    spec.maxScale *
    (0.2 + 0.8 * sprite.appear) *
    (0.7 + 0.3 * grow);
  const w = TILE_WIDTH * size;
  const h = TILE_HEIGHT * size;
  const alpha = spec.maxAlpha * sprite.appear * (0.55 + 0.45 * grow);
  sprite.body.setVisible(true);
  sprite.body.setDisplaySize(w, h);
  sprite.body.setAlpha(alpha);
  sprite.shine.setVisible(true);
  sprite.shine.setDisplaySize(w * 0.4, h * 0.28);
  sprite.shine.setAlpha(alpha * 0.42 * Math.max(0.4, glare));
  return true;
}
