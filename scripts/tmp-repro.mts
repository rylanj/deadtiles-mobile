// Wider fuzz using the same ground-truth (iso key + screen-overlap gating) as
// scripts/check-entity-wall-order.mts, but with many more corner/gap/offset
// combinations and two-building clusters (matching the screenshots).
import {
  applyOverworldStructureEntityDepth,
  overworldEntityRenderDepth,
  overworldPartitionDepth,
  type FurnitureDepthFootprint,
} from "../packages/client/src/world/depthSort.ts";
import { getBuildingAt, interiorWallCornerDepthBias } from "@zombie/shared";
import { discoverCityBuildings, sampleBySize } from "./lib/city-buildings.mts";

const halfW = 32;
const halfH = 16;
const WALL_H = 96 * 0.65;
const SPRITE_HALF_W = 28;
const SPRITE_H = 80;
const SPRITE_FOOT_DROP = 6;

type Tile = { x: number; y: number };
type Box = { minX: number; maxX: number; minY: number; maxY: number };

const key = (x: number, y: number) => (x + y) * 1024 + y;
const tileId = (x: number, y: number) => `${x},${y}`;

function wallScreenBox(tx: number, ty: number): Box {
  return {
    minX: (tx - ty - 1) * halfW,
    maxX: (tx - ty + 1) * halfW,
    minY: (tx + ty) * halfH - WALL_H,
    maxY: (tx + ty + 2) * halfH,
  };
}
function entityScreenBox(tx: number, ty: number): Box {
  const cx = (tx - ty) * halfW;
  const cy = (tx + ty + 1) * halfH;
  return {
    minX: cx - SPRITE_HALF_W,
    maxX: cx + SPRITE_HALF_W,
    minY: cy - SPRITE_H,
    maxY: cy + SPRITE_FOOT_DROP,
  };
}
function overlaps(a: Box, b: Box): boolean {
  return a.minX < b.maxX && b.minX < a.maxX && a.minY < b.maxY && b.minY < a.maxY;
}

let pairsChecked = 0;
const failures: string[] = [];

function checkScenario(
  scenario: string,
  walls: Tile[],
  entityTiles: Tile[],
  wallDepthAt: (t: Tile) => number,
  entityDepthAt: (t: Tile) => number,
) {
  for (const wall of walls) {
    const wBox = wallScreenBox(wall.x, wall.y);
    const wallDepth = wallDepthAt(wall);
    for (const ent of entityTiles) {
      const truth = key(ent.x, ent.y) - key(wall.x, wall.y);
      if (truth === 0) continue;
      if (!overlaps(wBox, entityScreenBox(ent.x, ent.y))) continue;
      pairsChecked++;
      const entityDepth = entityDepthAt(ent);
      const entityOnTop = entityDepth > wallDepth;
      if (entityOnTop === truth > 0) continue;
      failures.push(
        `${scenario} | wall (${wall.x},${wall.y}) d=${wallDepth.toFixed(4)}` +
          ` | entity (${ent.x},${ent.y}) d=${entityDepth.toFixed(4)}` +
          ` | expected ${truth > 0 ? "entity" : "wall"} on top`,
      );
    }
  }
}

function overworldFootprints(wallSet: Set<string>, drawn: Map<string, number>) {
  const out: FurnitureDepthFootprint[] = [];
  for (const id of wallSet) {
    const [xs, ys] = id.split(",");
    out.push({
      ox: Number(xs),
      oy: Number(ys),
      w: 1,
      h: 1,
      partition: true,
      depth: drawn.get(id)!,
    });
  }
  return out;
}

function checkLayout(name: string, layout: Tile[]) {
  const walls = layout.filter((t) => !getBuildingAt(t.x, t.y));
  if (walls.length < 3) return;
  const wallSet = new Set(walls.map((t) => tileId(t.x, t.y)));
  const drawn = new Map<string, number>();
  for (const t of walls) {
    const bias = Math.max(
      interiorWallCornerDepthBias(wallSet, t.x, t.y, "ns"),
      interiorWallCornerDepthBias(wallSet, t.x, t.y, "ew"),
    );
    drawn.set(tileId(t.x, t.y), overworldPartitionDepth(t.x, t.y, bias));
  }
  const footprints = overworldFootprints(wallSet, drawn);

  const xs = walls.map((t) => t.x);
  const ys = walls.map((t) => t.y);
  const entityTiles: Tile[] = [];
  for (let y = Math.min(...ys) - 4; y <= Math.max(...ys) + 4; y++) {
    for (let x = Math.min(...xs) - 4; x <= Math.max(...xs) + 4; x++) {
      if (wallSet.has(tileId(x, y))) continue;
      if (getBuildingAt(x, y)) continue;
      entityTiles.push({ x, y });
    }
  }

  checkScenario(
    name,
    walls,
    entityTiles,
    (t) => drawn.get(tileId(t.x, t.y))!,
    (t) =>
      applyOverworldStructureEntityDepth(
        overworldEntityRenderDepth(t.x + 0.5, t.y + 0.5),
        t.x,
        t.y,
        footprints,
      ),
  );
}

function corner(ox: number, oy: number, armLen: number): Tile[] {
  const out: Tile[] = [];
  for (let i = 0; i < armLen; i++) out.push({ x: ox, y: oy - i });
  for (let i = 0; i < armLen; i++) out.push({ x: ox + i, y: oy });
  return out;
}

const houses = discoverCityBuildings().filter((b) => b.buildingType === "house");
const sample = sampleBySize(houses, 40);

for (const b of sample) {
  for (const gap of [0, 1, 2, 3, 4, 5, 6, 8]) {
    for (const armLen of [5, 10, 15]) {
      const cornerX = b.ox - gap;
      const cornerY = b.oy + b.h + gap;
      checkLayout(
        `corner house@(${b.ox},${b.oy}) gap=${gap} arm=${armLen}`,
        corner(cornerX, cornerY, armLen),
      );
    }
  }
}

// Two-building clusters: second house offset NE by various amounts (as in
// the screenshots, two houses close together) with the same enclosure.
for (const b of sample) {
  for (const dx of [b.w, b.w + 1, b.w + 2]) {
    for (const dy of [-1, 0, 1, 2]) {
      const b2ox = b.ox + dx;
      const b2oy = b.oy + dy;
      // fabricate a second house footprint of the same size for the check
      const fakeGetAt = (x: number, y: number) =>
        (x >= b2ox && x < b2ox + b.w && y >= b2oy && y < b2oy + b.h) ||
        getBuildingAt(x, y);
      for (const gap of [2, 3, 4]) {
        const cornerX = b.ox - gap;
        const cornerY = Math.max(b.oy + b.h, b2oy + b.h) + gap;
        const layout = corner(cornerX, cornerY, 12);
        const walls = layout.filter((t) => !fakeGetAt(t.x, t.y));
        if (walls.length < 3) continue;
        const wallSet = new Set(walls.map((t) => tileId(t.x, t.y)));
        const drawn = new Map<string, number>();
        for (const t of walls) {
          const bias = Math.max(
            interiorWallCornerDepthBias(wallSet, t.x, t.y, "ns"),
            interiorWallCornerDepthBias(wallSet, t.x, t.y, "ew"),
          );
          drawn.set(tileId(t.x, t.y), overworldPartitionDepth(t.x, t.y, bias));
        }
        const footprints = overworldFootprints(wallSet, drawn);
        const xs = walls.map((t) => t.x);
        const ys = walls.map((t) => t.y);
        const entityTiles: Tile[] = [];
        for (let y = Math.min(...ys) - 4; y <= Math.max(...ys) + 4; y++) {
          for (let x = Math.min(...xs) - 4; x <= Math.max(...xs) + 4; x++) {
            if (wallSet.has(tileId(x, y))) continue;
            if (fakeGetAt(x, y)) continue;
            entityTiles.push({ x, y });
          }
        }
        checkScenario(
          `2house house@(${b.ox},${b.oy})+(${dx},${dy}) gap=${gap}`,
          walls,
          entityTiles,
          (t) => drawn.get(tileId(t.x, t.y))!,
          (t) =>
            applyOverworldStructureEntityDepth(
              overworldEntityRenderDepth(t.x + 0.5, t.y + 0.5),
              t.x,
              t.y,
              footprints,
            ),
        );
      }
    }
  }
}

console.log(`pairsChecked: ${pairsChecked}`);
console.log(`failures: ${failures.length}`);
for (const f of failures.slice(0, 30)) console.log(f);
if (failures.length) process.exitCode = 1;
else console.log("OK");
