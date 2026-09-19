/**
 * Offline texture atlas packer.
 *
 * The client used to upload one WebGL texture per PNG (9,275 of them, ~596MB of
 * uncompressed VRAM at boot alone), which is what discarded the tab on mobile.
 * This packs each logical pack into a multi-page atlas, trimming transparent
 * padding and optionally downscaling, so a pack becomes 1-2 GPU uploads.
 *
 * Frame names are the existing Phaser texture keys, so runtime lookups map
 * straight across via the atlas registry.
 *
 * Usage:
 *   npm run assets:atlas              # build every profile
 *   npm run assets:atlas -- --profile mobile
 *   npm run assets:atlas -- --pack player-1 --profile desktop
 *   npm run assets:atlas -- --if-missing   # no-op when already built
 */
import { createHash } from "node:crypto";
import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

import {
  allPackIds,
  atlasKeyForPack,
  packEntries,
  type PackId,
} from "../packages/client/src/sprites/assetManifest.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ASSETS_DIR = path.join(ROOT, "packages/client/public/assets");
const OUT_DIR = path.join(ASSETS_DIR, "atlas");

/**
 * Max atlas page dimension. 2048 is the safe universal WebGL limit; going to
 * 4096 risks allocation failure on low-end mobile GPUs, which is the exact
 * failure mode we are fixing.
 */
const PAGE_MAX = 2048;
/** Transparent gutter so bilinear filtering cannot bleed between frames. */
const PADDING = 2;

type Profile = {
  name: string;
  /** Longest-edge cap applied to each source frame before packing. */
  maxFrameSize: number;
};

const PROFILES: Profile[] = [
  // Entities render at ENTITY_RENDER_HEIGHT (80px) and CAMERA_ZOOM_MAX is 2, so
  // nothing is ever drawn taller than 160px. Desktop sits exactly on that
  // ceiling: 192 was 20% above what any pixel could use, and it also forced a
  // 2.4:1 minification at zoom 1. At 160 the common case is an exact 2:1 and
  // full zoom is 1:1. The original 256px art was pure VRAM waste.
  { name: "mobile", maxFrameSize: 128 },
  { name: "desktop", maxFrameSize: 160 },
];

type PreparedFrame = {
  key: string;
  /** Trimmed pixel data. */
  data: Buffer;
  /** Trimmed size (what actually gets packed). */
  w: number;
  h: number;
  /** Offset of the trimmed rect inside the original frame. */
  offsetX: number;
  offsetY: number;
  /** Original (untrimmed) frame size, after profile downscale. */
  sourceW: number;
  sourceH: number;
  /** Identical frames share one packed rect. */
  hash: string;
};

type PlacedFrame = PreparedFrame & { page: number; x: number; y: number };

/** Bottom-left skyline packer: good ratios for uniform sprite frames, and fast. */
class SkylinePacker {
  private readonly width: number;
  private readonly height: number;
  private skyline: { x: number; y: number; w: number }[];

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.skyline = [{ x: 0, y: 0, w: width }];
  }

  insert(w: number, h: number): { x: number; y: number } | null {
    let best: { x: number; y: number; index: number; wasted: number } | null =
      null;

    for (let i = 0; i < this.skyline.length; i++) {
      const fit = this.fitAt(i, w, h);
      if (!fit) continue;
      if (
        !best ||
        fit.y < best.y ||
        (fit.y === best.y && fit.wasted < best.wasted)
      ) {
        best = { x: fit.x, y: fit.y, index: i, wasted: fit.wasted };
      }
    }

    if (!best) return null;
    this.addLevel(best.index, best.x, best.y, w, h);
    return { x: best.x, y: best.y };
  }

  private fitAt(index: number, w: number, h: number) {
    const x = this.skyline[index]!.x;
    if (x + w > this.width) return null;

    let y = 0;
    let widthLeft = w;
    let wasted = 0;
    for (let i = index; i < this.skyline.length && widthLeft > 0; i++) {
      const node = this.skyline[i]!;
      y = Math.max(y, node.y);
      if (y + h > this.height) return null;
      const used = Math.min(node.w, widthLeft);
      wasted += used * (y - node.y);
      widthLeft -= used;
    }
    if (widthLeft > 0) return null;
    return { x, y, wasted };
  }

  private addLevel(index: number, x: number, y: number, w: number, h: number) {
    this.skyline.splice(index, 0, { x, y: y + h, w });

    for (let i = index + 1; i < this.skyline.length; i++) {
      const node = this.skyline[i]!;
      const prev = this.skyline[i - 1]!;
      if (node.x >= prev.x + prev.w) break;
      const overlap = prev.x + prev.w - node.x;
      if (node.w <= overlap) {
        this.skyline.splice(i, 1);
        i--;
        continue;
      }
      node.x += overlap;
      node.w -= overlap;
      break;
    }

    // Merge neighbouring segments at the same height.
    for (let i = 0; i < this.skyline.length - 1; i++) {
      const a = this.skyline[i]!;
      const b = this.skyline[i + 1]!;
      if (a.y === b.y) {
        a.w += b.w;
        this.skyline.splice(i + 1, 1);
        i--;
      }
    }
  }
}

/** Load one PNG, downscale to the profile cap, then trim transparent margins. */
async function prepareFrame(
  key: string,
  filePath: string,
  profile: Profile,
): Promise<PreparedFrame | null> {
  let input: Buffer;
  try {
    input = await readFile(filePath);
  } catch {
    return null;
  }

  let image = sharp(input).ensureAlpha();
  const meta = await image.metadata();
  const srcW = meta.width ?? 0;
  const srcH = meta.height ?? 0;
  if (srcW === 0 || srcH === 0) return null;

  const longest = Math.max(srcW, srcH);
  let sourceW = srcW;
  let sourceH = srcH;
  if (longest > profile.maxFrameSize) {
    const factor = profile.maxFrameSize / longest;
    sourceW = Math.max(1, Math.round(srcW * factor));
    sourceH = Math.max(1, Math.round(srcH * factor));
    image = image.resize(sourceW, sourceH, {
      fit: "fill",
      kernel: "lanczos3",
    });
  }

  const { data, info } = await image
    .raw()
    .toBuffer({ resolveWithObject: true });

  const bounds = alphaBounds(data, info.width, info.height, info.channels);
  if (!bounds) {
    // Fully transparent frame. Keep a 1x1 stub so the key still resolves.
    return {
      key,
      data: Buffer.alloc(4),
      w: 1,
      h: 1,
      offsetX: 0,
      offsetY: 0,
      sourceW,
      sourceH,
      hash: `empty-${sourceW}x${sourceH}`,
    };
  }

  const trimmed = await sharp(data, {
    raw: { width: info.width, height: info.height, channels: info.channels },
  })
    .extract({
      left: bounds.minX,
      top: bounds.minY,
      width: bounds.maxX - bounds.minX + 1,
      height: bounds.maxY - bounds.minY + 1,
    })
    .png({ compressionLevel: 9 })
    .toBuffer();

  return {
    key,
    data: trimmed,
    w: bounds.maxX - bounds.minX + 1,
    h: bounds.maxY - bounds.minY + 1,
    offsetX: bounds.minX,
    offsetY: bounds.minY,
    sourceW,
    sourceH,
    hash: createHash("sha1").update(trimmed).digest("hex"),
  };
}

/** Bounding box of pixels with any alpha. */
function alphaBounds(
  data: Buffer,
  width: number,
  height: number,
  channels: number,
) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * channels + 3]!;
      if (alpha === 0) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null;
  return { minX, minY, maxX, maxY };
}

/** Place frames into as few pages as possible, largest first. */
function packFrames(frames: PreparedFrame[]): {
  placed: PlacedFrame[];
  pages: { width: number; height: number }[];
} {
  // Dedupe identical images (idle frames repeat heavily across directions).
  const byHash = new Map<string, PreparedFrame>();
  const aliases: PreparedFrame[] = [];
  for (const frame of frames) {
    const existing = byHash.get(frame.hash);
    if (existing) {
      aliases.push(frame);
    } else {
      byHash.set(frame.hash, frame);
    }
  }

  const unique = [...byHash.values()].sort(
    (a, b) => b.h * b.w - a.h * a.w || b.h - a.h,
  );

  const placed: PlacedFrame[] = [];
  const pages: { width: number; height: number }[] = [];
  const packers: SkylinePacker[] = [];
  const placedByHash = new Map<string, PlacedFrame>();

  for (const frame of unique) {
    let spot: { x: number; y: number } | null = null;
    let pageIndex = -1;

    for (let i = 0; i < packers.length; i++) {
      spot = packers[i]!.insert(frame.w + PADDING, frame.h + PADDING);
      if (spot) {
        pageIndex = i;
        break;
      }
    }

    if (!spot) {
      packers.push(new SkylinePacker(PAGE_MAX, PAGE_MAX));
      pages.push({ width: PAGE_MAX, height: PAGE_MAX });
      pageIndex = packers.length - 1;
      spot = packers[pageIndex]!.insert(frame.w + PADDING, frame.h + PADDING);
      if (!spot) {
        throw new Error(
          `Frame ${frame.key} (${frame.w}x${frame.h}) exceeds page size ${PAGE_MAX}`,
        );
      }
    }

    const entry: PlacedFrame = { ...frame, page: pageIndex, x: spot.x, y: spot.y };
    placed.push(entry);
    placedByHash.set(frame.hash, entry);
  }

  // Point duplicate keys at the already-placed rect.
  for (const alias of aliases) {
    const target = placedByHash.get(alias.hash)!;
    placed.push({
      ...alias,
      page: target.page,
      x: target.x,
      y: target.y,
    });
  }

  // Shrink each page to what it actually uses. A half-empty 2048 page still
  // costs a full 16MB upload, which matters most for the many small packs.
  for (let index = 0; index < pages.length; index++) {
    let usedW = 1;
    let usedH = 1;
    for (const frame of placed) {
      if (frame.page !== index) continue;
      usedW = Math.max(usedW, frame.x + frame.w);
      usedH = Math.max(usedH, frame.y + frame.h);
    }
    pages[index] = {
      width: Math.min(PAGE_MAX, nextPowerOfTwo(usedW)),
      height: Math.min(PAGE_MAX, nextPowerOfTwo(usedH)),
    };
  }

  return { placed, pages };
}

/** Power-of-two page sizes keep sampling well-defined on older mobile GPUs. */
function nextPowerOfTwo(value: number): number {
  let size = 1;
  while (size < value) size *= 2;
  return size;
}

/** TexturePacker "JSON Array" multi-pack shape, which Phaser reads natively. */
function buildAtlasJson(
  placed: PlacedFrame[],
  pages: { width: number; height: number }[],
  imageNames: string[],
) {
  return {
    textures: pages.map((page, index) => ({
      image: imageNames[index]!,
      format: "RGBA8888",
      size: { w: page.width, h: page.height },
      scale: 1,
      frames: placed
        .filter((frame) => frame.page === index)
        .map((frame) => ({
          filename: frame.key,
          rotated: false,
          trimmed:
            frame.w !== frame.sourceW ||
            frame.h !== frame.sourceH ||
            frame.offsetX !== 0 ||
            frame.offsetY !== 0,
          sourceSize: { w: frame.sourceW, h: frame.sourceH },
          spriteSourceSize: {
            x: frame.offsetX,
            y: frame.offsetY,
            w: frame.w,
            h: frame.h,
          },
          frame: { x: frame.x, y: frame.y, w: frame.w, h: frame.h },
        })),
    })),
    meta: { app: "deadtiles/pack-atlases", version: "1.0" },
  };
}

async function buildPack(id: PackId, profile: Profile) {
  const entries = packEntries(id);
  if (entries.length === 0) return null;

  const prepared: PreparedFrame[] = [];
  const missing: string[] = [];
  for (const entry of entries) {
    const frame = await prepareFrame(
      entry.key,
      path.join(ASSETS_DIR, entry.path),
      profile,
    );
    if (frame) prepared.push(frame);
    else missing.push(entry.path);
  }

  if (prepared.length === 0) {
    console.warn(`  ${id}: no source frames found, skipped`);
    return null;
  }

  const { placed, pages } = packFrames(prepared);
  const atlasKey = atlasKeyForPack(id);
  const imageNames = pages.map((_, index) => `${atlasKey}-${index}.png`);

  const profileDir = path.join(OUT_DIR, profile.name);
  await mkdir(profileDir, { recursive: true });

  for (let index = 0; index < pages.length; index++) {
    const page = pages[index]!;
    const composites = placed
      .filter((frame) => frame.page === index)
      // Aliases share a rect; compositing once is enough.
      .filter(
        (frame, i, arr) =>
          arr.findIndex((o) => o.x === frame.x && o.y === frame.y) === i,
      )
      .map((frame) => ({ input: frame.data, left: frame.x, top: frame.y }));

    await sharp({
      create: {
        width: page.width,
        height: page.height,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite(composites)
      .png({ compressionLevel: 9 })
      .toFile(path.join(profileDir, imageNames[index]!));
  }

  const json = buildAtlasJson(placed, pages, imageNames);
  await writeFile(
    path.join(profileDir, `${atlasKey}.json`),
    JSON.stringify(json),
  );

  const vramBytes = pages.reduce((n, p) => n + p.width * p.height * 4, 0);
  console.log(
    `  ${id}: ${placed.length} frames → ${pages.length} page(s), ` +
      `${(vramBytes / (1024 * 1024)).toFixed(1)}MB VRAM` +
      (missing.length ? ` (${missing.length} missing source files)` : ""),
  );

  return { id, pages: pages.length, frames: placed.length, vramBytes };
}

/**
 * True when every profile already has an atlas for every pack.
 *
 * Guards the dev / build hook: a missing atlas is not a hard failure at
 * runtime, it silently falls back to loading each PNG as its own texture,
 * which is the ~596MB boot that discards the tab on mobile. Better to spend
 * the pack time once than to ship that fallback without noticing.
 */
async function atlasesArePresent(packIds: PackId[]): Promise<boolean> {
  for (const profile of PROFILES) {
    for (const id of packIds) {
      const file = path.join(
        OUT_DIR,
        profile.name,
        `${atlasKeyForPack(id)}.json`,
      );
      try {
        await access(file);
      } catch {
        return false;
      }
    }
  }
  return true;
}

async function main() {
  const args = process.argv.slice(2);
  const packArg = valueOf(args, "--pack");
  const profileArg = valueOf(args, "--profile");
  const ifMissing = args.includes("--if-missing");

  const profiles = profileArg
    ? PROFILES.filter((p) => p.name === profileArg)
    : PROFILES;
  if (profiles.length === 0) {
    throw new Error(`Unknown profile: ${profileArg}`);
  }

  const packIds = packArg ? [packArg as PackId] : allPackIds();

  if (ifMissing && (await atlasesArePresent(packIds))) {
    return;
  }

  if (!packArg && !profileArg) {
    await rm(OUT_DIR, { recursive: true, force: true });
  }

  for (const profile of profiles) {
    console.log(
      `\n[atlas] profile "${profile.name}" (max frame ${profile.maxFrameSize}px)`,
    );
    let totalVram = 0;
    for (const id of packIds) {
      const result = await buildPack(id, profile);
      if (result) totalVram += result.vramBytes;
    }
    console.log(
      `[atlas] ${profile.name} total: ${(totalVram / (1024 * 1024)).toFixed(1)}MB VRAM ` +
        `across ${packIds.length} packs`,
    );
  }
}

function valueOf(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index < 0) return undefined;
  return args[index + 1];
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
