// Painter-order check for overworld structure walls against building cuboids.
//
// A building renders as one graphics object at a single depth keyed off its SE
// corner tip, so a large footprint out-ranks a wall standing along its SW/SE
// flank even though the wall is nearer the camera. This runs the real depth code
// (packages/client/src/world/depthSort.ts) against real generated buildings,
// models the two solids geometrically, then samples screen points both cover:
// whichever solid owns the nearest surface there must hold the higher depth.
//
// In this dimetric projection (x, y, h) lands at
// ((x - y) * halfW, (x + y) * halfH - h), so along a view ray s = x + y and h
// grow together: the surface with the largest s is the one you see.
//
//   npx tsx scripts/check-wall-building-order.mts
//   npx tsx scripts/check-wall-building-order.mts --legacy   # plain iso depth

import {
  buildingWallDepth,
  interiorPartitionDepth,
  overworldPartitionDepth,
} from "../packages/client/src/world/depthSort.ts";
import {
  type BuildingInfo,
  buildingWallScreenDepth,
  getBuildingAt,
} from "@zombie/shared";
import { discoverCityBuildings, sampleBySize } from "./lib/city-buildings.mts";

const halfW = 32; // TILE_WIDTH / 2
const halfH = 16; // TILE_HEIGHT / 2
const WALL_H = 96 * 0.65; // PARTITION_HEIGHT
const HT = 0.16 / 2; // PARTITION_THICKNESS / 2
const EPS = 1e-6;
/** s-units of slack before a wrong-order sample counts as a bug. */
const TOL = 1e-3;

const LEGACY = process.argv.includes("--legacy");

const wallDepthAt = (tx: number, ty: number) =>
  LEGACY ? interiorPartitionDepth(tx, ty) : overworldPartitionDepth(tx, ty);

// ---------------------------------------------------------------------------
// Geometry: nearest visible surface of an axis-aligned box at a screen point
// ---------------------------------------------------------------------------

type Box = { x0: number; x1: number; y0: number; y1: number; h: number };

/** Box sits on the ground (z from 0 to h). */
function nearestSurface(box: Box, sx: number, sy: number): number {
  const { x0, x1, y0, y1, h } = box;
  let best = Number.NEGATIVE_INFINITY;

  // South face (y = y1), visible from the camera.
  {
    const x = sx / halfW + y1;
    if (x >= x0 - EPS && x <= x1 + EPS) {
      const z = (x + y1) * halfH - sy;
      if (z >= -EPS && z <= h + EPS) best = Math.max(best, x + y1);
    }
  }
  // East face (x = x1).
  {
    const y = x1 - sx / halfW;
    if (y >= y0 - EPS && y <= y1 + EPS) {
      const z = (x1 + y) * halfH - sy;
      if (z >= -EPS && z <= h + EPS) best = Math.max(best, x1 + y);
    }
  }
  // Top face (z = h).
  {
    const s = (sy + h) / halfH;
    const d = sx / halfW;
    const x = (s + d) / 2;
    const y = (s - d) / 2;
    if (x >= x0 - EPS && x <= x1 + EPS && y >= y0 - EPS && y <= y1 + EPS) {
      best = Math.max(best, s);
    }
  }
  return best;
}

function boxScreenBounds(box: Box) {
  const { x0, x1, y0, y1, h } = box;
  return {
    minX: (x0 - y1) * halfW,
    maxX: (x1 - y0) * halfW,
    minY: (x0 + y0) * halfH - h,
    maxY: (x1 + y1) * halfH,
  };
}

/** Wall spine boxes for one tile — matches drawInteriorPartitionTile arms. */
function wallBoxes(tx: number, ty: number, axis: string): Box[] {
  const cx = tx + 0.5;
  const cy = ty + 0.5;
  const out: Box[] = [];
  if (axis === "ew" || axis === "both") {
    out.push({ x0: tx, x1: tx + 1, y0: cy - HT, y1: cy + HT, h: WALL_H });
  }
  if (axis === "ns" || axis === "both") {
    out.push({ x0: cx - HT, x1: cx + HT, y0: ty, y1: ty + 1, h: WALL_H });
  }
  return out;
}

/**
 * Wall storeys only — an exact box. The roof on top is a gable / parapet, not a
 * box, so it is left out rather than over-claiming coverage above the eaves.
 */
function buildingBox(b: BuildingInfo): Box {
  return {
    x0: b.ox,
    x1: b.ox + b.w,
    y0: b.oy,
    y1: b.oy + b.h,
    h: buildingWallScreenDepth(b),
  };
}

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

/** Sample the screen overlap of a wall tile and a building; verify paint order. */
function checkTileVsBuilding(
  tx: number,
  ty: number,
  axis: string,
  b: BuildingInfo,
) {
  const bBox = buildingBox(b);
  const wallDepth = wallDepthAt(tx, ty);
  const bDepth = buildingWallDepth(b);
  const failures: {
    sx: number;
    sy: number;
    sWall: number;
    sBld: number;
    expected: string;
  }[] = [];

  for (const wBox of wallBoxes(tx, ty, axis)) {
    const wb = boxScreenBounds(wBox);
    const bb = boxScreenBounds(bBox);
    const minX = Math.max(wb.minX, bb.minX);
    const maxX = Math.min(wb.maxX, bb.maxX);
    const minY = Math.max(wb.minY, bb.minY);
    const maxY = Math.min(wb.maxY, bb.maxY);
    if (minX > maxX || minY > maxY) continue;

    for (let sx = minX; sx <= maxX; sx += 0.5) {
      for (let sy = minY; sy <= maxY; sy += 0.5) {
        const sWall = nearestSurface(wBox, sx, sy);
        const sBld = nearestSurface(bBox, sx, sy);
        if (sWall === Number.NEGATIVE_INFINITY) continue;
        if (sBld === Number.NEGATIVE_INFINITY) continue;
        if (Math.abs(sWall - sBld) <= TOL) continue;
        const wallIsNearer = sWall > sBld;
        if (wallIsNearer !== wallDepth > bDepth) {
          failures.push({
            sx,
            sy,
            sWall,
            sBld,
            expected: wallIsNearer ? "wall" : "building",
          });
        }
      }
    }
  }
  return failures;
}

/**
 * Apron of tiles around the footprint to place walls on. Wide enough to cover
 * the rows a tall cuboid still paints over up-screen (a 4-storey block reaches
 * ~24 rows), not just the tiles hugging the lot.
 */
const RING = 24;

const buildings = discoverCityBuildings();
const sample = sampleBySize(buildings, 8);

let checked = 0;
let bad = 0;
const samples: string[] = [];

for (const b of sample) {
  for (let ty = b.oy - RING; ty < b.oy + b.h + RING; ty++) {
    for (let tx = b.ox - RING; tx < b.ox + b.w + RING; tx++) {
      if (getBuildingAt(tx, ty)) continue; // walls cannot be built on a building
      for (const axis of ["ew", "ns", "both"]) {
        checked++;
        const failures = checkTileVsBuilding(tx, ty, axis, b);
        if (failures.length === 0) continue;
        bad++;
        if (samples.length < 8) {
          const f = failures[0]!;
          samples.push(
            `  ${b.w}x${b.h} ${b.buildingType} L${b.exteriorLevels} @ (${b.ox},${b.oy})` +
              ` | wall (${tx},${ty}) ${axis}` +
              ` | ${failures.length} px | screen (${f.sx.toFixed(1)}, ${f.sy.toFixed(1)})` +
              ` | s wall ${f.sWall.toFixed(3)} vs building ${f.sBld.toFixed(3)}` +
              ` | expected ${f.expected} on top`,
          );
        }
      }
    }
  }
}

// Collinear neighbours overlap at the join, so their relative order is visible:
// a run of wall tiles must stay in iso order whatever the buildings around it do.
let runBad = 0;
const runSamples: string[] = [];
for (const b of sample) {
  for (let ty = b.oy - RING; ty < b.oy + b.h + RING; ty++) {
    for (let tx = b.ox - RING; tx < b.ox + b.w + RING; tx++) {
      if (getBuildingAt(tx, ty)) continue;
      for (const [dx, dy] of [
        [1, 0],
        [0, 1],
      ]) {
        const nx = tx + dx;
        const ny = ty + dy;
        if (getBuildingAt(nx, ny)) continue;
        // (nx, ny) is south / east of (tx, ty), so it must paint later.
        if (wallDepthAt(nx, ny) > wallDepthAt(tx, ty)) continue;
        runBad++;
        if (runSamples.length < 6) {
          runSamples.push(
            `  ${b.w}x${b.h} @ (${b.ox},${b.oy}) | (${tx},${ty}) ${wallDepthAt(tx, ty).toFixed(4)}` +
              ` vs (${nx},${ny}) ${wallDepthAt(nx, ny).toFixed(4)}`,
          );
        }
      }
    }
  }
}

console.log(`mode: ${LEGACY ? "legacy (plain iso depth)" : "current"}`);
console.log(`buildings sampled: ${sample.length} of ${buildings.length}`);
console.log(`wall/building overlap cases checked: ${checked}`);
console.log(`mis-ordered cases: ${bad}`);
for (const s of samples) console.log(s);
console.log(`collinear wall neighbours out of iso order: ${runBad}`);
for (const s of runSamples) console.log(s);

if (bad || runBad) process.exitCode = 1;
else console.log("OK");
