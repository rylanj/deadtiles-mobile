import Phaser from "phaser";
import {
  BUILDING_LOD_MID_SCALE,
  BUILDING_LOD_NEAR_SCALE,
  BUILDING_TEXTURE_VRAM_BUDGET,
  BUILDING_VARIANT_BUCKETS,
} from "../gameConfig";
import { renderStats } from "../diagnostics/textureBudget";

/**
 * Shared, refcounted store for baked building textures.
 *
 * Buildings used to key their canvas on world position, so two identical houses
 * in two towns paid for two uploads and a city could allocate unbounded VRAM
 * until `createCanvas` failed and every later building fell back to a flat
 * solid. Procedural buildings repeat heavily, so keying on shape instead of
 * position is visually lossless and is the single largest saving available.
 *
 * Two rules make position-independence safe:
 * 1. Painting happens against a footprint normalised to origin (0, 0), so the
 *    result is translation-invariant and reusable anywhere.
 * 2. Every art roll that used to hash world coordinates now reads
 *    `variantSeed`, which is bucketed. Buildings still vary, but across a
 *    bounded set of looks rather than one per position.
 */

export type BuildingLod = "near" | "mid" | "far";

/** Supersampling factor for a textured tier. `far` is never baked. */
export function lodScale(lod: Exclude<BuildingLod, "far">): number {
  return lod === "near" ? BUILDING_LOD_NEAR_SCALE : BUILDING_LOD_MID_SCALE;
}

/** Geometry of a bake, relative to the building's iso origin. */
export type BakedPlacement = {
  /** Iso-space offset of the painted rect from cartesianToIso(ox, oy). */
  offX: number;
  offY: number;
  /** Painted pixel extent inside the canvas (canvas may be larger). */
  usedW: number;
  usedH: number;
};

export type BuildingTextureHandle = BakedPlacement & {
  key: string;
  lod: BuildingLod;
  scale: number;
};

type CacheEntry = BakedPlacement & {
  key: string;
  lod: BuildingLod;
  scale: number;
  refs: number;
  bytes: number;
  /** Epoch ms of the last acquire or release, for LRU eviction. */
  touchedAt: number;
};

type Registry = {
  entries: Map<string, CacheEntry>;
  bytes: number;
};

/**
 * Start trimming idle textures at the high-water mark, down to the low-water
 * mark. Waiting until the hard budget meant a cache at 185/192 MB with dozens
 * of unused bakes would refuse every new city and go flat.
 */
const BUILDING_TEXTURE_EVICT_AT = Math.floor(BUILDING_TEXTURE_VRAM_BUDGET * 0.85);
const BUILDING_TEXTURE_EVICT_TO = Math.floor(BUILDING_TEXTURE_VRAM_BUDGET * 0.7);

const registries = new WeakMap<Phaser.Scene, Registry>();

function registryFor(scene: Phaser.Scene): Registry {
  let reg = registries.get(scene);
  if (!reg) {
    reg = { entries: new Map(), bytes: 0 };
    registries.set(scene, reg);
  }
  return reg;
}

/**
 * Bucketed art variant for a building.
 *
 * Painters used to hash (ox, oy) directly, which is what made every bake
 * unique. Folding the same hash into a small number of buckets keeps the
 * variety while letting identical shapes share one upload.
 */
export function buildingVariantSeed(ox: number, oy: number): number {
  let h = (Math.imul(ox | 0, 73856093) ^ Math.imul(oy | 0, 19349663)) >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d) >>> 0;
  h ^= h >>> 15;
  return h % BUILDING_VARIANT_BUCKETS;
}

/** Everything that can change a building's painted pixels, and nothing else. */
export type BuildingSignatureParts = {
  buildingType: string;
  w: number;
  h: number;
  levels: number;
  entranceX: number;
  entranceY: number;
  entranceSpan: number;
  chimneyX: number;
  chimneyY: number;
  variantSeed: number;
  /** Red Order supermarkets board their windows; a world-state lookup. */
  boarded: boolean;
};

export function buildingSignature(
  parts: BuildingSignatureParts,
  lod: BuildingLod,
): string {
  return [
    "bld",
    lod,
    parts.buildingType,
    parts.w,
    parts.h,
    parts.levels,
    parts.entranceX,
    parts.entranceY,
    parts.entranceSpan,
    parts.chimneyX,
    parts.chimneyY,
    parts.variantSeed,
    parts.boarded ? "b" : "o",
  ].join(":");
}

function canvasBytes(scene: Phaser.Scene, key: string): number {
  if (!scene.textures.exists(key)) return 0;
  const tex = scene.textures.get(key);
  const source = tex.source[0];
  if (!source) return 0;
  return source.width * source.height * 4;
}

/**
 * Take a reference on a building texture, painting it only if it is new.
 *
 * `paint` must draw into `key` at `scale` and return the painted geometry, or
 * null if it could not (missing art, canvas too large, allocation refused).
 *
 * `displaceKey` is the texture this cuboid will drop on success. If this
 * building is the last user of that key, its bytes are treated as already
 * free so a near upgrade is not refused while the mid bake is still attached.
 */
export function acquireBuildingTexture(
  scene: Phaser.Scene,
  signature: string,
  lod: Exclude<BuildingLod, "far">,
  paint: (key: string, scale: number) => BakedPlacement | null,
  opts?: { silent?: boolean; displaceKey?: string },
): BuildingTextureHandle | null {
  const reg = registryFor(scene);
  const scale = lodScale(lod);

  const existing = reg.entries.get(signature);
  if (existing && scene.textures.exists(signature)) {
    existing.refs += 1;
    existing.touchedAt = Date.now();
    renderStats.buildingTextureReuse += 1;
    return {
      key: existing.key,
      lod: existing.lod,
      scale: existing.scale,
      offX: existing.offX,
      offY: existing.offY,
      usedW: existing.usedW,
      usedH: existing.usedH,
    };
  }
  if (existing) {
    // Texture disappeared underneath us (scene teardown, manual remove).
    reg.bytes -= existing.bytes;
    reg.entries.delete(signature);
  }

  // Make room before painting rather than after, so a full budget degrades to
  // the flat tier instead of failing an allocation mid-frame.
  evictIdleBuildingTextures(scene);
  if (reg.bytes >= BUILDING_TEXTURE_VRAM_BUDGET) {
    // Idle entries below the high-water mark are still free bytes. Drop them
    // all before refusing; that is the 3rd-city flat case (45 idle, 185 MB).
    purgeIdleBuildingTextures(scene);
  }
  let displaceBytes = 0;
  const displaceKey = opts?.displaceKey;
  if (displaceKey && displaceKey !== signature) {
    const displaced = reg.entries.get(displaceKey);
    if (displaced && displaced.refs === 1) displaceBytes = displaced.bytes;
  }
  if (reg.bytes - displaceBytes >= BUILDING_TEXTURE_VRAM_BUDGET) {
    if (!opts?.silent) renderStats.buildingBudgetSkips += 1;
    return null;
  }

  const placement = paint(signature, scale);
  if (!placement) return null;

  const bytes = canvasBytes(scene, signature);
  const entry: CacheEntry = {
    key: signature,
    lod,
    scale,
    refs: 1,
    bytes,
    touchedAt: Date.now(),
    ...placement,
  };
  reg.entries.set(signature, entry);
  reg.bytes += bytes;
  publishGauges(reg);
  return {
    key: entry.key,
    lod: entry.lod,
    scale: entry.scale,
    offX: entry.offX,
    offY: entry.offY,
    usedW: entry.usedW,
    usedH: entry.usedH,
  };
}

/** Drop a reference. The texture stays resident until the budget needs it. */
export function releaseBuildingTexture(scene: Phaser.Scene, key: string) {
  const reg = registries.get(scene);
  const entry = reg?.entries.get(key);
  if (!reg || !entry) return;
  entry.refs = Math.max(0, entry.refs - 1);
  entry.touchedAt = Date.now();
  if (entry.refs === 0) publishGauges(reg);
}

/**
 * Free unreferenced textures until back under budget.
 *
 * Oldest first, and at equal age the largest first, so the budget is reached
 * with the fewest removals. Referenced textures are never touched: something on
 * screen is drawing them, and dropping one is exactly the flat-building bug.
 */
export function evictIdleBuildingTextures(scene: Phaser.Scene) {
  const reg = registries.get(scene);
  if (!reg || reg.bytes < BUILDING_TEXTURE_EVICT_AT) return;

  const idle: CacheEntry[] = [];
  for (const entry of reg.entries.values()) {
    if (entry.refs <= 0) idle.push(entry);
  }
  if (idle.length === 0) return;

  idle.sort((a, b) => a.touchedAt - b.touchedAt || b.bytes - a.bytes);

  for (const entry of idle) {
    if (reg.bytes < BUILDING_TEXTURE_EVICT_TO) break;
    destroyEntry(scene, reg, entry);
  }
  publishGauges(reg);
}

function destroyEntry(scene: Phaser.Scene, reg: Registry, entry: CacheEntry) {
  reg.entries.delete(entry.key);
  reg.bytes = Math.max(0, reg.bytes - entry.bytes);
  if (scene.textures.exists(entry.key)) {
    scene.textures.remove(entry.key);
  }
}

/** Mirror cache size into renderStats so telemetry needs no back-import. */
function publishGauges(reg: Registry) {
  let idle = 0;
  for (const entry of reg.entries.values()) {
    if (entry.refs <= 0) idle += 1;
  }
  renderStats.buildingTextureBytes = reg.bytes;
  renderStats.buildingTextureShapes = reg.entries.size;
  renderStats.buildingTextureIdle = idle;
}

/** Free every unreferenced texture regardless of budget (interior entry, purge). */
export function purgeIdleBuildingTextures(scene: Phaser.Scene): number {
  const reg = registries.get(scene);
  if (!reg) return 0;
  let freed = 0;
  for (const entry of [...reg.entries.values()]) {
    if (entry.refs > 0) continue;
    destroyEntry(scene, reg, entry);
    freed += 1;
  }
  publishGauges(reg);
  return freed;
}

export function resetBuildingTextureCache(scene: Phaser.Scene) {
  const reg = registries.get(scene);
  if (!reg) return;
  for (const entry of [...reg.entries.values()]) {
    destroyEntry(scene, reg, entry);
  }
  reg.entries.clear();
  reg.bytes = 0;
  publishGauges(reg);
}

/** Bytes currently held by baked building textures (telemetry). */
export function buildingTextureBytes(scene: Phaser.Scene): number {
  return registries.get(scene)?.bytes ?? 0;
}

/** Live/idle texture counts (telemetry). */
export function buildingTextureCounts(scene: Phaser.Scene): {
  total: number;
  idle: number;
} {
  const reg = registries.get(scene);
  if (!reg) return { total: 0, idle: 0 };
  let idle = 0;
  for (const entry of reg.entries.values()) {
    if (entry.refs <= 0) idle += 1;
  }
  return { total: reg.entries.size, idle };
}
