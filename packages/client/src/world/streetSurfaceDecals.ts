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
import { TILE_DISPLAY_BLEED } from "./TileTextures";
import { tileIndicatorDepth } from "./depthSort";
import { streetSurfaceY } from "./streetLevel";

type Family =
  | "dirt"
  | "weeds"
  | "moss"
  | "drygrass"
  | "mud"
  | "gravel"
  | "dust"
  | "rubble"
  | "crack"
  | "stain";

type Rgb = readonly [number, number, number];

const FAMILIES: readonly Family[] = [
  "dirt",
  "weeds",
  "moss",
  "drygrass",
  "mud",
  "gravel",
  "dust",
  "rubble",
  "crack",
  "stain",
];

const PAVEMENT_WEIGHTS: Record<Family, number> = {
  dirt: 16,
  weeds: 18,
  moss: 12,
  drygrass: 10,
  mud: 5,
  gravel: 12,
  dust: 6,
  rubble: 7,
  crack: 7,
  stain: 7,
};

const ROAD_WEIGHTS: Record<Family, number> = {
  dirt: 8,
  weeds: 7,
  moss: 3,
  drygrass: 3,
  mud: 6,
  gravel: 14,
  dust: 16,
  rubble: 12,
  crack: 14,
  stain: 17,
};

const PALETTE: Record<Family, readonly Rgb[]> = {
  dirt: [
    [92, 64, 48],
    [74, 52, 38],
    [110, 82, 58],
    [64, 44, 32],
  ],
  weeds: [
    [36, 58, 32],
    [28, 46, 26],
    [48, 68, 36],
    [22, 38, 20],
  ],
  moss: [
    [42, 68, 36],
    [32, 54, 30],
    [54, 78, 42],
  ],
  drygrass: [
    [118, 108, 58],
    [98, 88, 46],
    [132, 118, 64],
  ],
  mud: [
    [48, 36, 28],
    [38, 28, 22],
    [58, 42, 32],
  ],
  gravel: [
    [92, 90, 84],
    [74, 72, 68],
    [110, 108, 100],
    [58, 56, 52],
  ],
  dust: [
    [168, 156, 128],
    [148, 138, 114],
    [132, 122, 102],
  ],
  rubble: [
    [86, 74, 66],
    [64, 56, 50],
    [108, 96, 84],
  ],
  crack: [
    [48, 46, 42],
    [36, 34, 32],
    [62, 58, 52],
  ],
  stain: [
    [32, 30, 26],
    [44, 38, 30],
    [26, 24, 22],
  ],
};

function rngFor(seed: string) {
  return mulberry32(xmur3(seed)());
}

function pick<T>(rng: () => number, list: readonly T[]): T {
  return list[Math.floor(rng() * list.length) % list.length]!;
}

function streetKindAt(tx: number, ty: number): TileType | null {
  const ttype = generateTile(tx, ty);
  if (ttype === TileType.Road || ttype === TileType.Pavement) return ttype;
  if (getStreetlightAt(tx, ty)) {
    const under = getStreetTileType(tx, ty);
    if (under === TileType.Road || under === TileType.Pavement) return under;
  }
  return null;
}

function decorateChance(ttype: TileType) {
  if (ttype === TileType.Road) return IS_MOBILE ? 0.055 : 0.075;
  return IS_MOBILE ? 0.08 : 0.11;
}

function decorateRoll(tx: number, ty: number, ttype: TileType) {
  return rngFor(`street-decal-roll:${tx},${ty}`)() < decorateChance(ttype);
}

function shouldDecorate(tx: number, ty: number, ttype: TileType) {
  if (!decorateRoll(tx, ty, ttype)) return false;
  const thin = rngFor(`street-decal-thin:${tx},${ty}`);
  let near = 0;
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const;
  for (const [dx, dy] of dirs) {
    const kind = streetKindAt(tx + dx, ty + dy);
    if (!kind) continue;
    if (decorateRoll(tx + dx, ty + dy, kind)) near += 1;
  }
  if (near >= 2 && thin() < 0.88) return false;
  if (near === 1 && thin() < 0.68) return false;
  return true;
}

function pickFamily(
  rng: () => number,
  weights: Record<Family, number>,
  avoid: Family | null,
): Family {
  let total = 0;
  for (const family of FAMILIES) {
    if (family === avoid) continue;
    total += weights[family];
  }
  if (total <= 0) return pick(rng, FAMILIES);
  let roll = rng() * total;
  for (const family of FAMILIES) {
    if (family === avoid) continue;
    roll -= weights[family];
    if (roll <= 0) return family;
  }
  return FAMILIES[FAMILIES.length - 1]!;
}

function diamondHalf() {
  return {
    hw: (TILE_WIDTH + TILE_DISPLAY_BLEED) / 2,
    hh: (TILE_HEIGHT + TILE_DISPLAY_BLEED) / 2,
  };
}

function inDiamond(
  x: number,
  y: number,
  cx: number,
  cy: number,
  hw: number,
  hh: number,
) {
  return Math.abs(x - cx) / hw + Math.abs(y - cy) / hh <= 0.96;
}

function blendPixel(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  rgb: Rgb,
  alpha: number,
) {
  const ix = Math.round(x);
  const iy = Math.round(y);
  if (ix < 0 || iy < 0 || ix >= width || iy >= height) return;
  const a = Math.max(0, Math.min(1, alpha));
  if (a <= 0.02) return;
  const i = (iy * width + ix) * 4;
  const da = data[i + 3]! / 255;
  const outA = a + da * (1 - a);
  if (outA <= 0) return;
  data[i] = Math.round((rgb[0] * a + data[i]! * da * (1 - a)) / outA);
  data[i + 1] = Math.round((rgb[1] * a + data[i + 1]! * da * (1 - a)) / outA);
  data[i + 2] = Math.round((rgb[2] * a + data[i + 2]! * da * (1 - a)) / outA);
  data[i + 3] = Math.round(outA * 255);
}

function paintCrack(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  cx: number,
  cy: number,
  hw: number,
  hh: number,
  rng: () => number,
  strength: number,
) {
  let x = cx + (rng() - 0.5) * hw * 1.1;
  let y = cy + (rng() - 0.5) * hh * 1.1;
  const steps = 7 + Math.floor(rng() * 8);
  const ang = rng() * Math.PI * 2;
  let vx = Math.cos(ang) * 1.4;
  let vy = Math.sin(ang) * 0.7;
  for (let i = 0; i < steps; i++) {
    vx += (rng() - 0.5) * 0.8;
    vy += (rng() - 0.5) * 0.5;
    x += vx;
    y += vy;
    if (!inDiamond(x, y, cx, cy, hw, hh)) break;
    const rgb = pick(rng, PALETTE.crack);
    blendPixel(data, width, height, x, y, rgb, 0.62 * strength);
    blendPixel(data, width, height, x + 1, y, rgb, 0.3 * strength);
  }
}

function paintFamily(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  cx: number,
  cy: number,
  family: Family,
  rng: () => number,
  strength: number,
) {
  const { hw, hh } = diamondHalf();
  if (family === "crack") {
    paintCrack(data, width, height, cx, cy, hw, hh, rng, strength);
    return;
  }

  const palette = PALETTE[family];
  const blobCount =
    family === "gravel" || family === "weeds"
      ? 6 + Math.floor(rng() * 7)
      : family === "stain" || family === "dust"
        ? 2 + Math.floor(rng() * 3)
        : 3 + Math.floor(rng() * 4);

  for (let i = 0; i < blobCount; i++) {
    const mx = cx + (rng() - 0.5) * hw * 1.35;
    const my = cy + (rng() - 0.5) * hh * 1.35;
    const rx =
      family === "gravel"
        ? 0.6 + rng() * 1.3
        : family === "weeds" || family === "drygrass"
          ? 0.7 + rng() * 1.5
          : family === "stain" || family === "dust"
            ? 2.4 + rng() * 4.2
            : 1.4 + rng() * 3.2;
    const ry = rx * (0.42 + rng() * 0.34);
    const rgb = pick(rng, palette);
    const alphaBase =
      family === "stain" || family === "dust"
        ? 0.2 + rng() * 0.2
        : family === "weeds" || family === "moss"
          ? 0.5 + rng() * 0.32
          : 0.38 + rng() * 0.3;

    const x0 = Math.floor(mx - rx - 1);
    const y0 = Math.floor(my - ry - 1);
    const x1 = Math.ceil(mx + rx + 1);
    const y1 = Math.ceil(my + ry + 1);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (!inDiamond(x + 0.5, y + 0.5, cx, cy, hw, hh)) continue;
        const nx = (x + 0.5 - mx) / rx;
        const ny = (y + 0.5 - my) / ry;
        if (nx * nx + ny * ny > 1 + (rng() - 0.5) * 0.3) continue;
        blendPixel(
          data,
          width,
          height,
          x,
          y,
          rgb,
          alphaBase * (0.7 + rng() * 0.3) * strength,
        );
      }
    }
  }

  if (family === "gravel" || family === "rubble" || family === "weeds") {
    const specks = 8 + Math.floor(rng() * 10);
    for (let i = 0; i < specks; i++) {
      const x = cx + (rng() - 0.5) * hw * 1.5;
      const y = cy + (rng() - 0.5) * hh * 1.5;
      if (!inDiamond(x, y, cx, cy, hw, hh)) continue;
      blendPixel(data, width, height, x, y, pick(rng, palette), 0.65 * strength);
    }
  }
}

function streetDecalTextureKey(tx: number, ty: number) {
  return `street-decal:${tx},${ty}`;
}

/** Sparse dirt, debris, and plant wear on a road or pavement diamond. */
export function maybeSpawnStreetSurfaceDecal(
  scene: Phaser.Scene,
  tx: number,
  ty: number,
  ttype: TileType,
): Phaser.GameObjects.Image | null {
  if (ttype !== TileType.Road && ttype !== TileType.Pavement) return null;
  if (!shouldDecorate(tx, ty, ttype)) return null;

  const rng = rngFor(`street-decal:${tx},${ty}`);
  const weights = ttype === TileType.Road ? ROAD_WEIGHTS : PAVEMENT_WEIGHTS;
  const families: Family[] = [pickFamily(rng, weights, null)];
  if (rng() < 0.34) families.push(pickFamily(rng, weights, families[0]!));
  const strength = 0.48 + rng() * 0.5;

  const width = TILE_WIDTH + TILE_DISPLAY_BLEED;
  const height = TILE_HEIGHT + TILE_DISPLAY_BLEED;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const image = ctx.createImageData(width, height);
  const cx = width / 2;
  const cy = height / 2;
  for (const family of families) {
    paintFamily(image.data, width, height, cx, cy, family, rng, strength);
  }
  ctx.putImageData(image, 0, 0);

  const key = streetDecalTextureKey(tx, ty);
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, canvas);
  scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);

  const iso = cartesianToIso(tx + 0.5, ty + 0.5);
  const img = scene.add.image(iso.x, iso.y + streetSurfaceY(tx, ty), key);
  img.setOrigin(0.5, 0.5);
  img.setDisplaySize(width, height);
  img.setFlipX(rng() < 0.5);
  img.setDepth(tileIndicatorDepth(tx, ty));
  img.setName(key);
  return img;
}

export function destroyStreetSurfaceDecal(
  scene: Phaser.Scene,
  image: Phaser.GameObjects.Image | null | undefined,
) {
  if (!image) return;
  const key = image.texture?.key;
  image.destroy();
  if (key && key.startsWith("street-decal:") && scene.textures.exists(key)) {
    scene.textures.remove(key);
  }
}
