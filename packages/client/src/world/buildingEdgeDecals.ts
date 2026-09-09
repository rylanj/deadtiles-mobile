import Phaser from "phaser";
import {
  cartesianToIso,
  generateTile,
  getBuildingAt,
  mulberry32,
  TILE_HEIGHT,
  TILE_WIDTH,
  TileType,
  xmur3,
  type BuildingInfo,
  type BuildingType,
} from "@zombie/shared";
import { IS_MOBILE } from "../gameConfig";
import { TILE_DISPLAY_BLEED } from "./TileTextures";
import { tileIndicatorDepth } from "./depthSort";

type EdgeLook = {
  /** Multiplies painted alpha. Faint buildings stay light. */
  alpha: number;
  /** How hard the foundation pulls toward dirt vs the ground texture. */
  dirtMix: number;
  /** Chance a tile gets a variety patch on top of the lip. */
  patchKeep: number;
  /** Chance a second patch family is added. */
  secondPatch: number;
  /** How far the lip and patches reach away from the wall. */
  spread: number;
};

type Edge = "n" | "e" | "s" | "w";
type Surface = "grass" | "pavement" | "road" | "concrete" | "barracks";
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

const GRASS_WEIGHTS: Record<Family, number> = {
  dirt: 26,
  weeds: 18,
  moss: 14,
  drygrass: 12,
  mud: 10,
  gravel: 8,
  dust: 6,
  rubble: 4,
  crack: 1,
  stain: 1,
};

const PAVED_WEIGHTS: Record<Family, number> = {
  dirt: 4,
  weeds: 3,
  moss: 2,
  drygrass: 2,
  mud: 3,
  gravel: 16,
  dust: 14,
  rubble: 10,
  crack: 22,
  stain: 24,
};

const CONCRETE_WEIGHTS: Record<Family, number> = {
  dirt: 6,
  weeds: 4,
  moss: 3,
  drygrass: 3,
  mud: 4,
  gravel: 20,
  dust: 22,
  rubble: 12,
  crack: 16,
  stain: 10,
};

const BARRACKS_WEIGHTS: Record<Family, number> = {
  dirt: 16,
  weeds: 8,
  moss: 4,
  drygrass: 10,
  mud: 6,
  gravel: 22,
  dust: 16,
  rubble: 8,
  crack: 6,
  stain: 4,
};

const TYPE_BIAS: Partial<Record<BuildingType, Partial<Record<Family, number>>>> =
  {
    house: { dirt: 8, weeds: 8, moss: 6, drygrass: 4 },
    apartment: { dirt: 4, weeds: 4, stain: 4, crack: 2 },
    motel: { dirt: 4, stain: 6, dust: 4 },
    warehouse: { rubble: 10, stain: 8, dust: 6, gravel: 4 },
    office: { dust: 6, stain: 4, crack: 4 },
    police_station: { dust: 6, crack: 4, gravel: 4, weeds: -6, mud: -6 },
    hospital: { dust: 8, crack: 4, weeds: -8, mud: -8, rubble: -6 },
    supermarket: { stain: 6, dust: 4, crack: 4 },
    large_retail: { stain: 6, rubble: 4, dust: 4 },
    diner: { stain: 8, dirt: 4, dust: 3 },
    gun_shop: { dust: 4, stain: 4, gravel: 3 },
    tent: { dirt: 10, dust: 8, drygrass: 6, gravel: 4 },
    mess_hall: { dirt: 6, dust: 6, stain: 4, gravel: 4 },
  };

const DIRT: readonly Rgb[] = [
  [92, 64, 48],
  [74, 52, 38],
  [110, 82, 58],
  [64, 44, 32],
  [122, 92, 66],
];
const WEED: readonly Rgb[] = [
  [36, 58, 32],
  [28, 46, 26],
  [48, 68, 36],
  [22, 38, 20],
];
const MOSS: readonly Rgb[] = [
  [42, 68, 36],
  [32, 54, 30],
  [54, 78, 42],
];
const DRY: readonly Rgb[] = [
  [118, 108, 58],
  [98, 88, 46],
  [132, 118, 64],
];
const MUD: readonly Rgb[] = [
  [48, 36, 28],
  [38, 28, 22],
  [58, 42, 32],
];
const GRAVEL: readonly Rgb[] = [
  [92, 90, 84],
  [74, 72, 68],
  [110, 108, 100],
  [58, 56, 52],
];
const DUST: readonly Rgb[] = [
  [168, 156, 128],
  [148, 138, 114],
  [132, 122, 102],
];
const RUBBLE: readonly Rgb[] = [
  [86, 74, 66],
  [64, 56, 50],
  [108, 96, 84],
];
const CRACK: readonly Rgb[] = [
  [48, 46, 42],
  [36, 34, 32],
  [62, 58, 52],
];
const STAIN: readonly Rgb[] = [
  [32, 30, 26],
  [44, 38, 30],
  [26, 24, 22],
];

const FAMILY_PALETTE: Record<Family, readonly Rgb[]> = {
  dirt: DIRT,
  weeds: WEED,
  moss: MOSS,
  drygrass: DRY,
  mud: MUD,
  gravel: GRAVEL,
  dust: DUST,
  rubble: RUBBLE,
  crack: CRACK,
  stain: STAIN,
};

type SourcePixels = { w: number; h: number; data: Uint8ClampedArray };

let grassSource: SourcePixels | null = null;
let concreteSource: SourcePixels | null = null;
let sourcesReady = false;

function edgewareTextureKey(ox: number, oy: number) {
  return `edgeware:${ox},${oy}`;
}

function rngFor(seed: string) {
  return mulberry32(xmur3(seed)());
}

function isResidentialBuilding(type: BuildingType) {
  return type === "house" || type === "apartment";
}

/** Stable per-building lip weight: faint wash through dark, heavy wear. */
function buildingEdgeLook(
  ox: number,
  oy: number,
  buildingType: BuildingType,
): EdgeLook {
  const spread = isResidentialBuilding(buildingType) ? 0.4 : 1;
  const roll = rngFor(`edgeware-weight:${ox},${oy}`)();
  if (roll < 0.2) {
    return { alpha: 0.28, dirtMix: 0.4, patchKeep: 0.42, secondPatch: 0.1, spread };
  }
  if (roll < 0.48) {
    return { alpha: 0.5, dirtMix: 0.62, patchKeep: 0.68, secondPatch: 0.22, spread };
  }
  if (roll < 0.8) {
    return { alpha: 0.82, dirtMix: 0.9, patchKeep: 0.88, secondPatch: 0.4, spread };
  }
  return { alpha: 1.14, dirtMix: 1.18, patchKeep: 0.96, secondPatch: 0.58, spread };
}

function pick<T>(rng: () => number, list: readonly T[]): T {
  return list[Math.floor(rng() * list.length) % list.length]!;
}

function readSource(scene: Phaser.Scene, key: string): SourcePixels | null {
  if (!scene.textures.exists(key)) return null;
  const img = scene.textures.get(key).getSourceImage() as
    | HTMLImageElement
    | HTMLCanvasElement;
  const w = img.width;
  const h = img.height;
  if (!w || !h) return null;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0);
  return { w, h, data: ctx.getImageData(0, 0, w, h).data };
}

function sampleSource(
  src: SourcePixels,
  x: number,
  y: number,
): Rgb {
  const sx = ((Math.floor(x) % src.w) + src.w) % src.w;
  const sy = ((Math.floor(y) % src.h) + src.h) % src.h;
  const i = (sy * src.w + sx) * 4;
  return [src.data[i]!, src.data[i + 1]!, src.data[i + 2]!];
}

function ensureSources(scene: Phaser.Scene) {
  if (sourcesReady) return;
  grassSource = readSource(scene, "tile-ground");
  concreteSource = readSource(scene, "tile-concrete");
  sourcesReady = true;
}

function surfaceAt(tx: number, ty: number): Surface | "skip" {
  const other = getBuildingAt(tx, ty);
  if (other) return "skip";
  const ttype = generateTile(tx, ty);
  if (ttype === TileType.Pavement) return "pavement";
  if (ttype === TileType.Road) return "road";
  if (ttype === TileType.CarPark) return "concrete";
  if (ttype === TileType.Barracks) return "barracks";
  return "grass";
}

function weightsFor(
  surface: Surface,
  buildingType: BuildingType,
): Record<Family, number> {
  const base =
    surface === "grass"
      ? { ...GRASS_WEIGHTS }
      : surface === "barracks"
        ? { ...BARRACKS_WEIGHTS }
        : surface === "concrete"
          ? { ...CONCRETE_WEIGHTS }
          : { ...PAVED_WEIGHTS };
  const bias = TYPE_BIAS[buildingType];
  if (bias) {
    for (const family of FAMILIES) {
      const extra = bias[family];
      if (extra) base[family] = Math.max(0, base[family] + extra);
    }
  }
  return base;
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
  return Math.abs(x - cx) / hw + Math.abs(y - cy) / hh <= 1;
}

function distToSeg(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-6) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function edgeSegment(
  edge: Edge,
  cx: number,
  cy: number,
  hw: number,
  hh: number,
): [number, number, number, number] {
  const n: [number, number] = [cx, cy - hh];
  const e: [number, number] = [cx + hw, cy];
  const s: [number, number] = [cx, cy + hh];
  const w: [number, number] = [cx - hw, cy];
  if (edge === "n") return [n[0], n[1], e[0], e[1]];
  if (edge === "e") return [e[0], e[1], s[0], s[1]];
  if (edge === "s") return [s[0], s[1], w[0], w[1]];
  return [w[0], w[1], n[0], n[1]];
}

function minEdgeDist(
  x: number,
  y: number,
  cx: number,
  cy: number,
  hw: number,
  hh: number,
  edges: readonly Edge[],
) {
  let best = 1e9;
  for (const edge of edges) {
    const [ax, ay, bx, by] = edgeSegment(edge, cx, cy, hw, hh);
    best = Math.min(best, distToSeg(x, y, ax, ay, bx, by));
  }
  return best;
}

/** Which edges of this adjacent tile touch the building (not the tile's world side). */
function edgesTowardBuilding(tx: number, ty: number, bld: BuildingInfo): Edge[] {
  const edges: Edge[] = [];
  const inX = tx >= bld.ox && tx < bld.ox + bld.w;
  const inY = ty >= bld.oy && ty < bld.oy + bld.h;
  if (inX && ty === bld.oy - 1) edges.push("s");
  if (inX && ty === bld.oy + bld.h) edges.push("n");
  if (inY && tx === bld.ox + bld.w) edges.push("w");
  if (inY && tx === bld.ox - 1) edges.push("e");
  return edges;
}

function forEachPerimeterTile(
  bld: BuildingInfo,
  visit: (tx: number, ty: number) => void,
) {
  const x1 = bld.ox + bld.w - 1;
  const y1 = bld.oy + bld.h - 1;
  for (let tx = bld.ox; tx <= x1; tx++) {
    visit(tx, bld.oy - 1);
    visit(tx, y1 + 1);
  }
  for (let ty = bld.oy; ty <= y1; ty++) {
    visit(bld.ox - 1, ty);
    visit(x1 + 1, ty);
  }
}

function canvasBounds(bld: BuildingInfo) {
  const pad = 1;
  const left = bld.ox - pad;
  const top = bld.oy - pad;
  const right = bld.ox + bld.w + pad;
  const bottom = bld.oy + bld.h + pad;
  const corners = [
    cartesianToIso(left, top),
    cartesianToIso(right, top),
    cartesianToIso(right, bottom),
    cartesianToIso(left, bottom),
  ];
  const padX = TILE_WIDTH / 2 + 4;
  const padY = TILE_HEIGHT / 2 + 4;
  const minX = Math.min(corners[0]!.x, corners[1]!.x, corners[2]!.x, corners[3]!.x) - padX;
  const maxX = Math.max(corners[0]!.x, corners[1]!.x, corners[2]!.x, corners[3]!.x) + padX;
  const minY = Math.min(corners[0]!.y, corners[1]!.y, corners[2]!.y, corners[3]!.y) - padY;
  const maxY = Math.max(corners[0]!.y, corners[1]!.y, corners[2]!.y, corners[3]!.y) + padY;
  return {
    originX: Math.floor(minX),
    originY: Math.floor(minY),
    width: Math.max(8, Math.ceil(maxX - minX)),
    height: Math.max(8, Math.ceil(maxY - minY)),
  };
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

function hash01(x: number, y: number, salt: number) {
  let n = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + salt;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n >>> 0) % 1000) / 1000;
}

function foundationRgb(surface: Surface, rng: () => number): Rgb {
  if (surface === "grass") return pick(rng, DIRT);
  if (surface === "road") return pick(rng, CRACK);
  if (surface === "barracks") return pick(rng, GRAVEL);
  return pick(rng, GRAVEL);
}

function paintFoundation(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  cx: number,
  cy: number,
  edges: readonly Edge[],
  surface: Surface,
  rng: () => number,
  worldX: number,
  worldY: number,
  look: EdgeLook,
) {
  const { hw, hh } = diamondHalf();
  const band =
    (surface === "grass" ? 8.4 + rng() * 2.8 : 5.6 + rng() * 1.8) * look.spread;
  const src =
    surface === "grass"
      ? grassSource
      : surface === "concrete"
        ? concreteSource
        : null;
  const salt = Math.floor(rng() * 100000);

  const x0 = Math.floor(cx - hw);
  const y0 = Math.floor(cy - hh);
  const x1 = Math.ceil(cx + hw);
  const y1 = Math.ceil(cy + hh);

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (!inDiamond(x + 0.5, y + 0.5, cx, cy, hw, hh)) continue;
      const dist = minEdgeDist(x + 0.5, y + 0.5, cx, cy, hw, hh, edges);
      const wobble = (hash01(x, y, salt) - 0.5) * 2.4 * look.spread;
      const t = 1 - (dist + wobble) / band;
      if (t <= 0) continue;
      const fall = t * t;
      const shade = hash01(x + 3, y - 2, salt + 17);
      let rgb = foundationRgb(surface, () => shade);
      if (src) {
        const sampled = sampleSource(src, worldX * 17 + x, worldY * 13 + y);
        const mix = Math.min(1, (0.38 + fall * 0.5) * look.dirtMix);
        rgb = [
          Math.round(sampled[0] * (1 - mix) + rgb[0] * mix),
          Math.round(sampled[1] * (1 - mix) + rgb[1] * mix),
          Math.round(sampled[2] * (1 - mix) + rgb[2] * mix),
        ];
      }
      const contact = dist < 1.15 ? 0.18 * look.alpha : 0;
      const alpha =
        ((surface === "grass" ? 0.8 : 0.64) * fall + contact) *
        (0.84 + shade * 0.16) *
        look.alpha;
      blendPixel(data, width, height, x, y, rgb, alpha);
    }
  }
}

function paintBlobs(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  cx: number,
  cy: number,
  edges: readonly Edge[],
  family: Family,
  rng: () => number,
  look: EdgeLook,
) {
  const { hw, hh } = diamondHalf();
  const palette = FAMILY_PALETTE[family];
  const blobCount =
    family === "gravel" || family === "weeds"
      ? 7 + Math.floor(rng() * 6)
      : family === "crack"
        ? 1
        : 3 + Math.floor(rng() * 4);

  if (family === "crack") {
    paintCrack(data, width, height, cx, cy, edges, rng, look);
    return;
  }

  for (let i = 0; i < blobCount; i++) {
    const along = rng();
    const [ax, ay, bx, by] = edgeSegment(pick(rng, edges), cx, cy, hw, hh);
    const ex = ax + (bx - ax) * along;
    const ey = ay + (by - ay) * along;
    const inward =
      (2 + rng() * (family === "stain" || family === "dust" ? 10 : 7)) *
      look.spread;
    const mx = ex + (cx - ex) * (inward / 14);
    const my = ey + (cy - ey) * (inward / 14);
    const size = 0.48 + 0.52 * look.spread;
    const rx =
      (family === "gravel"
        ? 0.7 + rng() * 1.4
        : family === "weeds"
          ? 0.8 + rng() * 1.6
          : 1.6 + rng() * 3.4) * size;
    const ry = rx * (0.45 + rng() * 0.35);
    const rgb = pick(rng, palette);
    const alphaBase =
      family === "stain" || family === "dust"
        ? 0.22 + rng() * 0.2
        : family === "moss" || family === "weeds"
          ? 0.55 + rng() * 0.3
          : 0.42 + rng() * 0.32;

    const x0 = Math.floor(mx - rx - 1);
    const y0 = Math.floor(my - ry - 1);
    const x1 = Math.ceil(mx + rx + 1);
    const y1 = Math.ceil(my + ry + 1);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (!inDiamond(x + 0.5, y + 0.5, cx, cy, hw, hh)) continue;
        const nx = (x + 0.5 - mx) / rx;
        const ny = (y + 0.5 - my) / ry;
        if (nx * nx + ny * ny > 1 + (rng() - 0.5) * 0.35) continue;
        blendPixel(
          data,
          width,
          height,
          x,
          y,
          rgb,
          alphaBase * (0.7 + rng() * 0.3) * look.alpha,
        );
      }
    }
  }

  if (family === "gravel" || family === "rubble") {
    const specks = 10 + Math.floor(rng() * 12);
    for (let i = 0; i < specks; i++) {
      const [ax, ay, bx, by] = edgeSegment(pick(rng, edges), cx, cy, hw, hh);
      const t = rng();
      const x = ax + (bx - ax) * t + (rng() - 0.5) * 6;
      const y = ay + (by - ay) * t + (rng() - 0.5) * 3;
      if (!inDiamond(x, y, cx, cy, hw, hh)) continue;
      blendPixel(data, width, height, x, y, pick(rng, palette), 0.7 * look.alpha);
    }
  }
}

function paintCrack(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  cx: number,
  cy: number,
  edges: readonly Edge[],
  rng: () => number,
  look: EdgeLook,
) {
  const { hw, hh } = diamondHalf();
  const [ax, ay, bx, by] = edgeSegment(pick(rng, edges), cx, cy, hw, hh);
  let x = ax + (bx - ax) * (0.2 + rng() * 0.6);
  let y = ay + (by - ay) * (0.2 + rng() * 0.6);
  const steps = Math.max(3, Math.round((8 + rng() * 7) * look.spread));
  const towardX = ((cx - x) / steps) * look.spread;
  const towardY = ((cy - y) / steps) * look.spread;
  for (let i = 0; i < steps; i++) {
    x += towardX + (rng() - 0.5) * 2.2;
    y += towardY + (rng() - 0.5) * 1.4;
    if (!inDiamond(x, y, cx, cy, hw, hh)) break;
    const rgb = pick(rng, CRACK);
    blendPixel(data, width, height, x, y, rgb, 0.7 * look.alpha);
    blendPixel(data, width, height, x + 1, y, rgb, 0.35 * look.alpha);
  }
}

function paintTile(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  originX: number,
  originY: number,
  tx: number,
  ty: number,
  edges: readonly Edge[],
  surface: Surface,
  families: readonly Family[],
  rng: () => number,
  look: EdgeLook,
) {
  const iso = cartesianToIso(tx + 0.5, ty + 0.5);
  const cx = iso.x - originX;
  const cy = iso.y - originY;
  paintFoundation(
    data,
    width,
    height,
    cx,
    cy,
    edges,
    surface,
    rng,
    tx,
    ty,
    look,
  );
  for (const family of families) {
    paintBlobs(data, width, height, cx, cy, edges, family, rng, look);
  }
}

export function spawnBuildingEdgeDecals(
  scene: Phaser.Scene,
  bld: BuildingInfo,
): Phaser.GameObjects.Image | null {
  ensureSources(scene);
  const bounds = canvasBounds(bld);
  const key = edgewareTextureKey(bld.ox, bld.oy);
  if (scene.textures.exists(key)) scene.textures.remove(key);

  const canvas = document.createElement("canvas");
  canvas.width = bounds.width;
  canvas.height = bounds.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const image = ctx.createImageData(bounds.width, bounds.height);
  const data = image.data;
  const look = buildingEdgeLook(bld.ox, bld.oy, bld.buildingType);

  let lastFamily: Family | null = null;
  forEachPerimeterTile(bld, (tx, ty) => {
    const edges = edgesTowardBuilding(tx, ty, bld);
    if (edges.length === 0) return;
    const surface = surfaceAt(tx, ty);
    if (surface === "skip") return;

    const rng = rngFor(`edgeware:${bld.ox},${bld.oy}:${tx},${ty}`);
    if (IS_MOBILE && rng() < 0.28) {
      paintTile(
        data,
        bounds.width,
        bounds.height,
        bounds.originX,
        bounds.originY,
        tx,
        ty,
        edges,
        surface,
        [],
        rng,
        look,
      );
      return;
    }

    const weights = weightsFor(surface, bld.buildingType);
    const families: Family[] = [];
    if (rng() < look.patchKeep) {
      const first = pickFamily(rng, weights, lastFamily);
      families.push(first);
      lastFamily = first;
      const secondChance = IS_MOBILE ? look.secondPatch * 0.45 : look.secondPatch;
      if (rng() < secondChance) {
        const second = pickFamily(rng, weights, first);
        families.push(second);
        lastFamily = second;
      }
    } else {
      lastFamily = null;
    }

    paintTile(
      data,
      bounds.width,
      bounds.height,
      bounds.originX,
      bounds.originY,
      tx,
      ty,
      edges,
      surface,
      families,
      rng,
      look,
    );
  });

  ctx.putImageData(image, 0, 0);
  scene.textures.addCanvas(key, canvas);
  const tex = scene.textures.get(key);
  tex.setFilter(Phaser.Textures.FilterMode.NEAREST);

  const img = scene.add.image(
    bounds.originX + bounds.width / 2,
    bounds.originY + bounds.height / 2,
    key,
  );
  img.setOrigin(0.5, 0.5);
  img.setDepth(
    tileIndicatorDepth(bld.ox + bld.w - 1, bld.oy + bld.h - 1) + 1,
  );
  img.setName(key);
  return img;
}

export function destroyBuildingEdgeDecals(
  scene: Phaser.Scene,
  image: Phaser.GameObjects.Image | null | undefined,
) {
  if (!image) return;
  const key = image.texture?.key;
  image.destroy();
  if (key && key.startsWith("edgeware:") && scene.textures.exists(key)) {
    scene.textures.remove(key);
  }
}
