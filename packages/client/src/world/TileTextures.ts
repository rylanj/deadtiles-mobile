import Phaser from "phaser";
import { cartesianToIso, TILE_HEIGHT, TILE_WIDTH } from "@zombie/shared";
import { resolveImageSource } from "../sprites/atlasRegistry";

/** Extra pixels so adjacent diamonds overlap slightly (hides sub-pixel gaps). */
export const TILE_DISPLAY_BLEED = 4;

/** Grass tiles baked into one canvas per chunk (matches street chunk size). */
export const GROUND_CHUNK_SIZE = 16;

const GROUND_TEXTURE_KEYS = [
  "tile-ground",
  "tile-path",
  "tile-wood",
  "tile-concrete",
  "tile-barracks",
  "tile-ground-tiles",
  "tile-hospital",
  "tile-motel",
  "tile-office",
  "tile-retail",
  "tile-diner",
  "tile-gunshop",
  "tile-hallway",
  "tile-linoleum",
  "tile-carpet-blue",
  "tile-carpet-beige",
] as const;

const GROUND_SOURCE_SUFFIX = "__source";
const GROUND_DISPLAY_SUFFIX = "~display";
/** Single reusable interior floor canvas (only one interior shown at a time). */
const INTERIOR_FLOOR_ACTIVE_KEY = "interior-floor-active";

const SQUARE_ASPECT_TOLERANCE = 0.15;

/** Plain 2D copies kept outside Phaser — safe for runtime canvas baking. */
const groundSourceByKey = new Map<
  string,
  { canvas: HTMLCanvasElement; w: number; h: number }
>();

/** Boot-baked iso diamond per material (used for chunk + tree stamping). */
const groundDisplayDiamondByKey = new Map<string, HTMLCanvasElement>();

function groundTileCanvasWidth() {
  return TILE_WIDTH + TILE_DISPLAY_BLEED;
}

function groundTileCanvasHeight() {
  return TILE_HEIGHT + TILE_DISPLAY_BLEED;
}

function groundChunkTextureKey(chunkX: number, chunkY: number) {
  return `ground-chunk-${chunkX},${chunkY}`;
}

function clipIsoGroundDiamondAt(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
) {
  const hw = (TILE_WIDTH + TILE_DISPLAY_BLEED) / 2;
  const hh = (TILE_HEIGHT + TILE_DISPLAY_BLEED) / 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy - hh);
  ctx.lineTo(cx + hw, cy);
  ctx.lineTo(cx, cy + hh);
  ctx.lineTo(cx - hw, cy);
  ctx.closePath();
  ctx.clip();
}

function copyImageSourceToCanvas(
  src: CanvasImageSource,
  width: number,
  height: number,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (ctx) ctx.drawImage(src, 0, 0, width, height);
  return canvas;
}

function cacheGroundSourceFromImage(
  baseKey: string,
  src: CanvasImageSource,
  srcW: number,
  srcH: number,
) {
  if (srcW <= 0 || srcH <= 0) return;
  const copy = copyImageSourceToCanvas(src, srcW, srcH);
  groundSourceByKey.set(baseKey, { canvas: copy, w: srcW, h: srcH });
}

function hydrateGroundSourceFromScene(scene: Phaser.Scene, baseKey: string) {
  if (groundSourceByKey.has(baseKey)) return;

  const fromSource = resolveImageSource(
    scene,
    `${baseKey}${GROUND_SOURCE_SUFFIX}`,
  );
  if (fromSource) {
    cacheGroundSourceFromImage(
      baseKey,
      fromSource.src,
      fromSource.width,
      fromSource.height,
    );
    return;
  }

  const fromBase = resolveImageSource(scene, baseKey);
  if (fromBase) {
    cacheGroundSourceFromImage(
      baseKey,
      fromBase.src,
      fromBase.width,
      fromBase.height,
    );
  }
}

function getGroundSource(scene: Phaser.Scene, baseKey: string) {
  hydrateGroundSourceFromScene(scene, baseKey);
  return groundSourceByKey.get(baseKey) ?? null;
}

function getDisplayDiamond(baseKey: string): HTMLCanvasElement | null {
  return groundDisplayDiamondByKey.get(baseKey) ?? null;
}

function cacheDisplayDiamond(
  baseKey: string,
  src: CanvasImageSource,
  srcW: number,
  srcH: number,
) {
  groundDisplayDiamondByKey.set(
    baseKey,
    bakeDiamondCanvas(src, srcW, srcH, baseKey),
  );
}

function canvasHasOpaquePixels(canvas: HTMLCanvasElement): boolean {
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i]! > 8) return true;
  }
  return false;
}

/**
 * Bake a ground tile diamond.
 *
 * Square interior floors (`tile-wood`, `tile-ground-tiles`, `tile-hospital`,
 * `tile-motel`, `tile-office`, `tile-retail`, `tile-diner`, `tile-gunshop`, `tile-barracks`, and the
 * apartment hallway, linoleum, and carpet floors) map the PNG onto the iso diamond so PNG top → NW–NE edge
 * (isometric northeast), not screen-up:
 *   top-left  → NW (top vertex)
 *   top-right → NE (right vertex)
 *   bot-right → SE (bottom vertex)
 *   bot-left  → SW (left vertex)
 *
 * Grass / path keep a simple cover + clip (no affine warp — that caused
 * vertical seam lines on outdoor tiles).
 */
function bakeDiamondCanvas(
  src: CanvasImageSource,
  srcW: number,
  srcH: number,
  baseKey = "",
): HTMLCanvasElement {
  const w = groundTileCanvasWidth();
  const h = groundTileCanvasHeight();
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const cx = w / 2;
  const cy = h / 2;
  const hw = w / 2;
  const hh = h / 2;

  ctx.save();
  clipIsoGroundDiamondAt(ctx, cx, cy);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const isoMapSquare =
    (baseKey === "tile-wood" ||
      baseKey === "tile-ground-tiles" ||
      baseKey === "tile-hospital" ||
      baseKey === "tile-motel" ||
      baseKey === "tile-office" ||
      baseKey === "tile-retail" ||
      baseKey === "tile-diner" ||
      baseKey === "tile-gunshop" ||
      baseKey === "tile-barracks" ||
      baseKey === "tile-hallway" ||
      baseKey === "tile-linoleum" ||
      baseKey === "tile-carpet-blue" ||
      baseKey === "tile-carpet-beige") &&
    isSquareSource(srcW, srcH);
  if (isoMapSquare) {
    ctx.translate(cx, cy);
    // screenX = hw*(u - v), screenY = hh*(u + v - 1), u=srcX/srcW, v=srcY/srcH
    ctx.transform(hw / srcW, hh / srcW, -hw / srcH, hh / srcH, 0, -hh);
    ctx.drawImage(src, 0, 0, srcW, srcH, 0, 0, srcW, srcH);
  } else {
    const scale = Math.max(w / srcW, h / srcH);
    const drawW = srcW * scale;
    const drawH = srcH * scale;
    ctx.drawImage(
      src,
      0,
      0,
      srcW,
      srcH,
      (w - drawW) / 2,
      (h - drawH) / 2,
      drawW,
      drawH,
    );
  }
  ctx.restore();
  return canvas;
}

function ensureDisplayDiamondCached(baseKey: string, scene: Phaser.Scene) {
  if (groundDisplayDiamondByKey.has(baseKey)) return;
  const source = getGroundSource(scene, baseKey);
  if (source) {
    cacheDisplayDiamond(baseKey, source.canvas, source.w, source.h);
    return;
  }
  const display = resolveImageSource(
    scene,
    `${baseKey}${GROUND_DISPLAY_SUFFIX}`,
  );
  if (display) {
    cacheDisplayDiamond(baseKey, display.src, display.width, display.height);
  }
}

function stampDisplayDiamondsInChunk(
  ctx: CanvasRenderingContext2D,
  originX: number,
  originY: number,
  tileCoords: readonly { x: number; y: number }[],
  displayDiamond: HTMLCanvasElement,
) {
  const w = groundTileCanvasWidth();
  const h = groundTileCanvasHeight();
  for (const { x, y } of tileCoords) {
    const iso = cartesianToIso(x + 0.5, y + 0.5);
    const cx = iso.x - originX;
    const cy = iso.y - originY;
    // Overlapping bleed diamonds — no per-tile clip (matches street tile overlap).
    ctx.drawImage(displayDiamond, cx - w / 2, cy - h / 2, w, h);
  }
}

/**
 * Laminate repeats in world space, so a plank continues across the diamond
 * edge instead of restarting. The bleed samples the neighbour's continuation,
 * which keeps the join from looking stepped.
 */
function stampContinuousFloor(
  ctx: CanvasRenderingContext2D,
  originX: number,
  originY: number,
  tileCoords: readonly { x: number; y: number }[],
  source: HTMLCanvasElement,
) {
  const srcW = source.width;
  const srcH = source.height;
  if (srcW <= 0 || srcH <= 0) return;
  const hwTile = TILE_WIDTH / 2;
  const hhTile = TILE_HEIGHT / 2;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  for (const { x, y } of tileCoords) {
    const iso = cartesianToIso(x + 0.5, y + 0.5);
    const cx = iso.x - originX;
    const cy = iso.y - originY;
    ctx.save();
    clipIsoGroundDiamondAt(ctx, cx, cy);
    ctx.translate(cx, cy);
    ctx.transform(
      hwTile / srcW,
      hhTile / srcW,
      -hwTile / srcH,
      hhTile / srcH,
      0,
      -hhTile,
    );
    for (let oy = -1; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++) {
        ctx.drawImage(source, ox * srcW, oy * srcH);
      }
    }
    ctx.restore();
  }
}

function ensureDisplayGroundTexture(
  scene: Phaser.Scene,
  baseKey: string,
): string {
  const displayKey = `${baseKey}${GROUND_DISPLAY_SUFFIX}`;
  if (scene.textures.exists(displayKey)) return displayKey;

  ensureDisplayDiamondCached(baseKey, scene);
  const cached = getDisplayDiamond(baseKey);
  if (cached) {
    scene.textures.addCanvas(displayKey, cached);
    scene.textures.get(displayKey).setFilter(Phaser.Textures.FilterMode.LINEAR);
    return displayKey;
  }

  const source = getGroundSource(scene, baseKey);
  if (source) {
    const baked = bakeDiamondCanvas(source.canvas, source.w, source.h, baseKey);
    cacheDisplayDiamond(baseKey, source.canvas, source.w, source.h);
    scene.textures.addCanvas(displayKey, baked);
    scene.textures.get(displayKey).setFilter(Phaser.Textures.FilterMode.LINEAR);
    return displayKey;
  }

  if (scene.textures.exists(baseKey)) return baseKey;
  return "__DEFAULT";
}

/**
 * Floors whose PNG repeats once per tile and must line up across diamond
 * edges. High-contrast patterns show seams with the per-tile bleed bake.
 */
function isContinuousFloorKey(key: string): boolean {
  return key === "tile-retail" || key === "tile-diner" || key === "tile-gunshop";
}

/**
 * Canvas pixels per world pixel for interior floors. Hard-edged patterns blur
 * when the camera zooms in, so they bake at the max camera zoom.
 */
function interiorFloorResolution(baseKey: string): number {
  return baseKey === "tile-diner" ? 2 : 1;
}

export type GroundFloorOverlay = {
  baseKey: string;
  tiles: readonly { x: number; y: number }[];
};

/**
 * Bake many grass tiles into one chunk canvas (no per-tile Phaser textures).
 * Overlays stamp in order, so a later zone paints over an earlier one.
 */
export function renderGroundChunkCanvas(
  scene: Phaser.Scene,
  baseKey: string,
  tileCoords: readonly { x: number; y: number }[],
  overlay?: GroundFloorOverlay | readonly GroundFloorOverlay[],
  resolution = 1,
): {
  canvas: HTMLCanvasElement;
  originX: number;
  originY: number;
  width: number;
  height: number;
} | null {
  const requested: readonly GroundFloorOverlay[] = !overlay
    ? []
    : Array.isArray(overlay)
      ? overlay
      : [overlay as GroundFloorOverlay];
  const overlayTileCount = requested.reduce((n, o) => n + o.tiles.length, 0);
  if (tileCoords.length === 0 && overlayTileCount === 0) return null;

  const retailSource = isContinuousFloorKey(baseKey)
    ? getGroundSource(scene, baseKey)
    : null;

  ensureDisplayDiamondCached(baseKey, scene);
  const display = retailSource ? null : getDisplayDiamond(baseKey);
  if (tileCoords.length > 0 && !retailSource && !display) return null;

  const layers: {
    tiles: readonly { x: number; y: number }[];
    retail: HTMLCanvasElement | null;
    display: HTMLCanvasElement | null;
  }[] = [];
  for (const o of requested) {
    if (o.tiles.length === 0) continue;
    const retail = isContinuousFloorKey(o.baseKey)
      ? getGroundSource(scene, o.baseKey)
      : null;
    if (!retail) ensureDisplayDiamondCached(o.baseKey, scene);
    const diamond = retail ? null : getDisplayDiamond(o.baseKey);
    if (!retail && !diamond) continue;
    layers.push({ tiles: o.tiles, retail: retail?.canvas ?? null, display: diamond });
  }
  if (tileCoords.length === 0 && layers.length === 0) return null;

  const hw = (TILE_WIDTH + TILE_DISPLAY_BLEED) / 2;
  const hh = (TILE_HEIGHT + TILE_DISPLAY_BLEED) / 2;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const boundCoords =
    layers.length > 0
      ? [...tileCoords, ...layers.flatMap((l) => l.tiles)]
      : tileCoords;
  for (const { x, y } of boundCoords) {
    const iso = cartesianToIso(x + 0.5, y + 0.5);
    minX = Math.min(minX, iso.x - hw);
    minY = Math.min(minY, iso.y - hh);
    maxX = Math.max(maxX, iso.x + hw);
    maxY = Math.max(maxY, iso.y + hh);
  }

  const pad = TILE_DISPLAY_BLEED;
  const originX = Math.floor(minX) - pad;
  const originY = Math.floor(minY) - pad;
  const width = Math.ceil(maxX) - originX + pad;
  const height = Math.ceil(maxY) - originY + pad;

  const res = Math.max(1, resolution);
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(width * res);
  canvas.height = Math.ceil(height * res);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.setTransform(res, 0, 0, res, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  if (tileCoords.length > 0) {
    if (retailSource) {
      stampContinuousFloor(ctx, originX, originY, tileCoords, retailSource.canvas);
    } else if (display) {
      stampDisplayDiamondsInChunk(ctx, originX, originY, tileCoords, display);
    }
  }
  for (const layer of layers) {
    if (layer.retail) {
      stampContinuousFloor(ctx, originX, originY, layer.tiles, layer.retail);
    } else if (layer.display) {
      stampDisplayDiamondsInChunk(ctx, originX, originY, layer.tiles, layer.display);
    }
  }

  return { canvas, originX, originY, width, height };
}

export function groundTextureIsLoaded(scene: Phaser.Scene, key: string): boolean {
  return (
    groundSourceByKey.has(key) ||
    scene.textures.exists(key) ||
    scene.textures.exists(`${key}${GROUND_SOURCE_SUFFIX}`) ||
    scene.textures.exists(`${key}${GROUND_DISPLAY_SUFFIX}`)
  );
}

export function pickGroundBaseKey(scene: Phaser.Scene, preferred: string): string {
  if (groundTextureIsLoaded(scene, preferred)) return preferred;
  if (
    preferred === "tile-barracks" &&
    groundTextureIsLoaded(scene, "tile-concrete")
  ) {
    return "tile-concrete";
  }
  if (groundTextureIsLoaded(scene, "tile-ground")) return "tile-ground";
  return "tile-ground";
}

export function removeGroundChunkTexture(
  scene: Phaser.Scene,
  chunkX: number,
  chunkY: number,
) {
  const key = groundChunkTextureKey(chunkX, chunkY);
  if (scene.textures.exists(key)) {
    scene.textures.remove(key);
  }
}

export function bakeIsoGroundTextures(scene: Phaser.Scene) {
  for (const key of GROUND_TEXTURE_KEYS) {
    const art = resolveImageSource(scene, key);
    if (!art) continue;
    const src = art.src;
    const srcW = art.width;
    const srcH = art.height;

    cacheGroundSourceFromImage(key, src, srcW, srcH);
    const cached = groundSourceByKey.get(key)!;

    const sourceKey = `${key}${GROUND_SOURCE_SUFFIX}`;
    if (!scene.textures.exists(sourceKey)) {
      scene.textures.addCanvas(
        sourceKey,
        copyImageSourceToCanvas(cached.canvas, srcW, srcH),
      );
      scene.textures.get(sourceKey).setFilter(Phaser.Textures.FilterMode.LINEAR);
    }

    cacheDisplayDiamond(key, cached.canvas, srcW, srcH);
    ensureDisplayGroundTexture(scene, key);

    if (isSquareSource(srcW, srcH)) {
      scene.textures.remove(key);
    } else {
      const baked = bakeDiamondCanvas(cached.canvas, srcW, srcH, key);
      // Boot calls bake twice (before/after fallbacks). Replace in place so
      // Phaser does not warn "Texture key already in use".
      if (scene.textures.exists(key)) scene.textures.remove(key);
      scene.textures.addCanvas(key, baked);
      scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
    }
  }
}

function isSquareSource(srcW: number, srcH: number) {
  return Math.abs(srcW - srcH) / Math.max(srcW, srcH) <= SQUARE_ASPECT_TOLERANCE;
}

export function resolveInteriorFloorTexture(
  scene: Phaser.Scene,
  baseKey: string,
): string {
  return ensureDisplayGroundTexture(scene, baseKey);
}

/**
 * Baked interior floor — stamps one iso diamond per tile (same path as
 * overworld grass). Square interior materials (wood, GroundTiles, hospital)
 * use the affine UV map so the texture fills each diamond correctly.
 */
export function createInteriorFloorImage(
  scene: Phaser.Scene,
  _buildingX: number,
  _buildingY: number,
  tileCoords: readonly { x: number; y: number }[],
  baseKey = "tile-wood",
  overlay?: GroundFloorOverlay | readonly GroundFloorOverlay[],
): Phaser.GameObjects.Image | null {
  const key = pickGroundBaseKey(scene, baseKey);
  const requested: readonly GroundFloorOverlay[] = !overlay
    ? []
    : Array.isArray(overlay)
      ? overlay
      : [overlay as GroundFloorOverlay];
  const overlayBake = requested.map((o) => ({
    baseKey: pickGroundBaseKey(scene, o.baseKey),
    tiles: o.tiles,
  }));
  const res = interiorFloorResolution(key);
  const baked = renderGroundChunkCanvas(scene, key, tileCoords, overlayBake, res);
  if (!baked) return null;

  const texW = baked.canvas.width;
  const texH = baked.canvas.height;
  const texKey = INTERIOR_FLOOR_ACTIVE_KEY;
  let tex: Phaser.Textures.CanvasTexture;
  if (!scene.textures.exists(texKey)) {
    const created = scene.textures.createCanvas(texKey, texW, texH);
    if (!created) return null;
    tex = created;
  } else {
    tex = scene.textures.get(texKey) as Phaser.Textures.CanvasTexture;
    tex.setSize(texW, texH);
  }
  const ctx = tex.getContext();
  if (!ctx) return null;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, texW, texH);
  ctx.drawImage(baked.canvas, 0, 0);
  tex.refresh();
  tex.setFilter(Phaser.Textures.FilterMode.LINEAR);

  const img = scene.add.image(baked.originX, baked.originY, texKey);
  img.setOrigin(0, 0);
  img.setScale(1 / res);
  return img;
}

export function interiorFloorTextureKey(_buildingX: number, _buildingY: number) {
  return INTERIOR_FLOOR_ACTIVE_KEY;
}

export function configureGroundTileSprite(
  tile: Phaser.GameObjects.Image,
  x: number,
  y: number,
) {
  tile.setPosition(x, y);
  tile.setOrigin(0.5, 0.5);
  tile.setDisplaySize(groundTileCanvasWidth(), groundTileCanvasHeight());
}

/** Single-tile grass (tree underlays) — shared display texture, no runtime bake. */
export function createGroundTileImage(
  scene: Phaser.Scene,
  x: number,
  y: number,
  baseKey = "tile-ground",
): Phaser.GameObjects.Image | null {
  const iso = cartesianToIso(x + 0.5, y + 0.5);
  const textureKey = ensureDisplayGroundTexture(scene, baseKey);
  if (!scene.textures.exists(textureKey)) return null;

  const tile = scene.add.image(iso.x, iso.y, textureKey);
  configureGroundTileSprite(tile, iso.x, iso.y);
  return tile;
}

export function groundChunkKeyForTile(x: number, y: number) {
  const chunkX = Math.floor(x / GROUND_CHUNK_SIZE) * GROUND_CHUNK_SIZE;
  const chunkY = Math.floor(y / GROUND_CHUNK_SIZE) * GROUND_CHUNK_SIZE;
  return { chunkX, chunkY, key: `${chunkX},${chunkY}` };
}

export function uploadGroundChunkTexture(
  scene: Phaser.Scene,
  chunkX: number,
  chunkY: number,
  baked: HTMLCanvasElement,
) {
  const textureKey = groundChunkTextureKey(chunkX, chunkY);
  let tex: Phaser.Textures.CanvasTexture;
  if (!scene.textures.exists(textureKey)) {
    const created = scene.textures.createCanvas(
      textureKey,
      baked.width,
      baked.height,
    );
    if (!created) return textureKey;
    tex = created;
  } else {
    tex = scene.textures.get(textureKey) as Phaser.Textures.CanvasTexture;
    tex.setSize(baked.width, baked.height);
  }
  const ctx = tex.getContext();
  if (ctx) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, baked.width, baked.height);
    ctx.drawImage(baked, 0, 0);
    tex.refresh();
  }
  tex.setFilter(Phaser.Textures.FilterMode.LINEAR);
  return textureKey;
}
