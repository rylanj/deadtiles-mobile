import Phaser from "phaser";
import { BUILDING_TEXTURE_VRAM_BUDGET, IS_MOBILE } from "../gameConfig";

/**
 * VRAM accounting + render telemetry.
 *
 * Every Phaser texture is an uncompressed RGBA upload, so bytes are simply
 * width * height * 4 per texture source. Boot art alone measured ~596MB before
 * the atlas work, which is what discards the tab on mobile, so these counters
 * exist to prove each optimisation actually moved the number.
 */

const BYTES_PER_PIXEL = 4;

/** Phaser's own scratch/internal keys — not game art, excluded from reports. */
const INTERNAL_TEXTURE_KEYS = new Set([
  "__DEFAULT",
  "__MISSING",
  "__WHITE",
  "__NORMAL",
]);

export type VramBucket =
  | "entity"
  | "building"
  | "buildingBake"
  | "ground"
  | "interior"
  | "ui"
  | "other";

export type VramReport = {
  totalBytes: number;
  textureCount: number;
  byBucket: Record<VramBucket, { bytes: number; count: number }>;
};

/** Live counters for things that are hard to see from texture totals alone. */
export const renderStats = {
  /** Successful 3D building cuboid bakes. */
  buildingBakes: 0,
  /** Buildings that fell back to flat solid Graphics because a bake failed. */
  buildingBakeFailures: 0,
  /** Buildings intentionally drawn flat because of their LOD tier. */
  buildingLodFlat: 0,
  /** Bakes skipped because the texture budget was exhausted. */
  buildingBudgetSkips: 0,
  /** Building textures reused via shape-signature dedupe (no new upload). */
  buildingTextureReuse: 0,
  /** Flat fallbacks later healed back into real 3D bakes. */
  buildingFallbackHeals: 0,
  /** Bytes currently held by baked building textures (owned by the bake cache). */
  buildingTextureBytes: 0,
  /** Distinct building shapes resident, and how many hold no live reference. */
  buildingTextureShapes: 0,
  buildingTextureIdle: 0,
};

export function resetRenderStats() {
  renderStats.buildingBakes = 0;
  renderStats.buildingBakeFailures = 0;
  renderStats.buildingLodFlat = 0;
  renderStats.buildingBudgetSkips = 0;
  renderStats.buildingTextureReuse = 0;
  renderStats.buildingFallbackHeals = 0;
}

function bucketForKey(key: string): VramBucket {
  // "bld:" is the shape-signature namespace for baked cuboids.
  if (
    key.startsWith("bld:") ||
    key.startsWith("building-cuboid-") ||
    key.startsWith("building-pool-")
  ) {
    return "buildingBake";
  }
  if (key.startsWith("building-") || key.startsWith("fence-")) return "building";
  if (key.startsWith("tile-") || key.startsWith("iso-") || key.startsWith("ground-")) {
    return "ground";
  }
  if (key.startsWith("furniture-") || key.startsWith("interior-")) return "interior";
  if (
    key.startsWith("playerman") ||
    key.startsWith("zombieman") ||
    key.startsWith("militia") ||
    key.startsWith("redman") ||
    key.startsWith("trader") ||
    key.startsWith("atlas-")
  ) {
    return "entity";
  }
  if (key.startsWith("ui-")) return "ui";
  return "other";
}

/** Uncompressed GPU bytes for one texture (sum of all its sources). */
export function textureVramBytes(texture: Phaser.Textures.Texture): number {
  let bytes = 0;
  for (const source of texture.source) {
    bytes += source.width * source.height * BYTES_PER_PIXEL;
  }
  return bytes;
}

function emptyBuckets(): Record<VramBucket, { bytes: number; count: number }> {
  return {
    entity: { bytes: 0, count: 0 },
    building: { bytes: 0, count: 0 },
    buildingBake: { bytes: 0, count: 0 },
    ground: { bytes: 0, count: 0 },
    interior: { bytes: 0, count: 0 },
    ui: { bytes: 0, count: 0 },
    other: { bytes: 0, count: 0 },
  };
}

/** Walk the whole texture manager and total uncompressed GPU bytes. */
export function measureVram(scene: Phaser.Scene): VramReport {
  const byBucket = emptyBuckets();
  let totalBytes = 0;
  let textureCount = 0;

  for (const key of scene.textures.getTextureKeys()) {
    if (INTERNAL_TEXTURE_KEYS.has(key)) continue;
    const texture = scene.textures.get(key);
    if (!texture) continue;
    const bytes = textureVramBytes(texture);
    const bucket = byBucket[bucketForKey(key)];
    bucket.bytes += bytes;
    bucket.count += 1;
    totalBytes += bytes;
    textureCount += 1;
  }

  return { totalBytes, textureCount, byBucket };
}

function mb(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}

export function formatVramReport(report: VramReport): string {
  const parts: string[] = [];
  for (const [name, bucket] of Object.entries(report.byBucket)) {
    if (bucket.count === 0) continue;
    parts.push(`${name}=${mb(bucket.bytes)}MB/${bucket.count}`);
  }
  return (
    `vram=${mb(report.totalBytes)}MB textures=${report.textureCount} | ` +
    parts.join(" ")
  );
}

function formatRenderStats(): string {
  return (
    `bakes=${renderStats.buildingBakes} ` +
    `reuse=${renderStats.buildingTextureReuse} ` +
    `lodFlat=${renderStats.buildingLodFlat} ` +
    `budgetSkip=${renderStats.buildingBudgetSkips} ` +
    `bakeFail=${renderStats.buildingBakeFailures} ` +
    `heals=${renderStats.buildingFallbackHeals} ` +
    `bakeBudget=${mb(renderStats.buildingTextureBytes)}/` +
    `${mb(BUILDING_TEXTURE_VRAM_BUDGET)}MB ` +
    `shapes=${renderStats.buildingTextureShapes} ` +
    `idle=${renderStats.buildingTextureIdle}`
  );
}

let telemetryTimer: number | null = null;
let cuboidStatsProvider: (() => string) | null = null;

/** Optional live cuboid mix (img vs gfx) for the VRAM line. */
export function setCuboidStatsProvider(provider: (() => string) | null) {
  cuboidStatsProvider = provider;
}

/**
 * Log a VRAM + render breakdown on an interval. Dev builds only: the scan
 * walks every texture key, which is cheap at 10s but not per frame.
 */
export function startVramTelemetry(scene: Phaser.Scene, intervalMs = 10_000) {
  if (!import.meta.env.DEV) return;
  stopVramTelemetry();
  telemetryTimer = window.setInterval(() => {
    if (!scene.sys?.isActive()) return;
    const report = measureVram(scene);
    const cuboids = cuboidStatsProvider?.() ?? "";
    console.log(
      `[vram] ${IS_MOBILE ? "mobile" : "desktop"} ` +
        `${formatVramReport(report)} | ${formatRenderStats()}` +
        (cuboids ? ` | ${cuboids}` : ""),
    );
  }, intervalMs);
}

export function stopVramTelemetry() {
  if (telemetryTimer != null) {
    window.clearInterval(telemetryTimer);
    telemetryTimer = null;
  }
}

/** Console helper: `__deadtilesVram()` in devtools. */
export function exposeVramDebugHook(scene: Phaser.Scene) {
  if (!import.meta.env.DEV) return;
  (window as unknown as Record<string, unknown>).__deadtilesVram = () => {
    const report = measureVram(scene);
    console.log(formatVramReport(report));
    console.log(formatRenderStats());
    return report;
  };
}
