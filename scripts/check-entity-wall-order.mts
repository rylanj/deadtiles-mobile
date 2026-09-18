// Painter-order check for entities (players / zombies) against wall tiles.
//
// Runs the real depth code (packages/client/src/world/depthSort.ts) — no model
// of the maths lives here, so it cannot drift out of sync.
//
// Ground truth: a wall tile and an entity tile are ordered by their iso tile key
// ((x + y) primary, y secondary). Equal keys are genuinely ambiguous (the tiles
// share a screen row) and are skipped. Pairs whose screen boxes cannot overlap
// are skipped too, so only visible defects are reported.
//
//   npx tsx scripts/check-entity-wall-order.mts
//   npx tsx scripts/check-entity-wall-order.mts --plain-footprints  # pre-fix
//
// `--plain-footprints` drops the rendered-depth override from the overworld
// footprints, i.e. entities resolve against the plain iso key the way they did
// before walls learned to lift in front of building cuboids. It should fail.

import {
  applyBuildingTreeDepth,
  applyFurnitureEntityDepth,
  applyOverworldStructureEntityDepth,
  buildingWallDepth,
  entityRenderDepth,
  interiorPartitionDepth,
  overworldEntityRenderDepth,
  overworldPartitionDepth,
  type FurnitureDepthFootprint,
} from "../packages/client/src/world/depthSort.ts";
import {
  getBuildingAt,
  getBuildingsNearTile,
  interiorDimensions,
  interiorWallCornerDepthBias,
  interiorWallFootprintsForBuilding,
  interiorWallsForBuilding,
  isInFrontOfBuilding,
} from "@zombie/shared";
import { discoverCityBuildings, sampleBySize } from "./lib/city-buildings.mts";

const PLAIN = process.argv.includes("--plain-footprints");

const halfW = 32; // TILE_WIDTH / 2
const halfH = 16; // TILE_HEIGHT / 2
const WALL_H = 96 * 0.65; // PARTITION_HEIGHT
const SPRITE_HALF_W = 28;
const SPRITE_H = 80; // ENTITY_RENDER_HEIGHT
const SPRITE_FOOT_DROP = 6; // FEET_Y_PADDING

type Tile = { x: number; y: number };

const key = (x: number, y: number) => (x + y) * 1024 + y;
const tileId = (x: number, y: number) => `${x},${y}`;

// ---------------------------------------------------------------------------
// Screen boxes — only assert on pairs that can actually overlap on screen
// ---------------------------------------------------------------------------

type Box = { minX: number; maxX: number; minY: number; maxY: number };

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

// ---------------------------------------------------------------------------
// Scenario runner
// ---------------------------------------------------------------------------

type Failure = {
  scenario: string;
  wall: Tile;
  entity: Tile;
  wallDepth: number;
  entityDepth: number;
  expected: "entity" | "wall";
};

let pairsChecked = 0;
const failures: Failure[] = [];

/**
 * @param wallDepthAt   depth the wall tile's Graphics is given
 * @param entityDepthAt depth of an entity standing on the centre of a tile
 */
function checkScenario(
  scenario: string,
  walls: Tile[],
  entityTiles: Tile[],
  wallDepthAt: (t: Tile) => number,
  entityDepthAt: (t: Tile) => number,
  opts?: { allowEntityOverWallsUnderBuildings?: boolean },
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
      // Street tiles clearing a cuboid may sit above a wall that was left under
      // that cuboid — the house face wins; skip those pairs.
      if (
        opts?.allowEntityOverWallsUnderBuildings &&
        truth < 0 &&
        entityOnTop
      ) {
        let underCuboid = false;
        for (const b of getBuildingsNearTile(ent.x, ent.y, 8)) {
          if (!isInFrontOfBuilding(ent.x, ent.y, b)) continue;
          if (wallDepth < buildingWallDepth(b)) {
            underCuboid = true;
            break;
          }
        }
        if (underCuboid) continue;
      }
      failures.push({
        scenario,
        wall,
        entity: ent,
        wallDepth,
        entityDepth,
        expected: truth > 0 ? "entity" : "wall",
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Scenario 1: interiors — the reference the overworld has to match
// ---------------------------------------------------------------------------

const buildings = discoverCityBuildings();
const interiorSample = sampleBySize(buildings, 12);

for (const b of interiorSample) {
  const walls = interiorWallsForBuilding(b.ox, b.oy);
  if (walls.length === 0) continue;
  const wallSet = new Set(walls.map((w) => tileId(w.x, w.y)));
  const footprints = interiorWallFootprintsForBuilding(
    b.ox,
    b.oy,
  ) as FurnitureDepthFootprint[];
  const { iW, iH } = interiorDimensions(b.ox, b.oy);

  const entityTiles: Tile[] = [];
  for (let y = 0; y < iH; y++) {
    for (let x = 0; x < iW; x++) {
      if (wallSet.has(tileId(x, y))) continue;
      entityTiles.push({ x, y });
    }
  }

  checkScenario(
    `interior ${b.w}x${b.h} @ (${b.ox},${b.oy})`,
    walls.map((w) => ({ x: w.x, y: w.y })),
    entityTiles,
    (t) =>
      interiorPartitionDepth(
        t.x,
        t.y,
        Math.max(
          interiorWallCornerDepthBias(wallSet, t.x, t.y, "ns"),
          interiorWallCornerDepthBias(wallSet, t.x, t.y, "ew"),
        ),
      ),
    (t) =>
      applyFurnitureEntityDepth(
        entityRenderDepth(t.x + 0.5, t.y + 0.5),
        t.x,
        t.y,
        footprints,
      ),
  );
}

const interiorFailures = failures.length;

// ---------------------------------------------------------------------------
// Scenario 2: player-built overworld bases beside real buildings
// ---------------------------------------------------------------------------

/** Hollow box of walls, and the two arms of a corner (the shape in the report). */
function baseLayouts(ox: number, oy: number, w: number, h: number): Tile[][] {
  const box: Tile[] = [];
  for (let x = ox; x < ox + w; x++) {
    box.push({ x, y: oy }, { x, y: oy + h - 1 });
  }
  for (let y = oy + 1; y < oy + h - 1; y++) {
    box.push({ x: ox, y }, { x: ox + w - 1, y });
  }

  const corner: Tile[] = [];
  for (let x = ox; x < ox + w; x++) corner.push({ x, y: oy });
  for (let y = oy + 1; y < oy + h; y++) corner.push({ x: ox, y });

  return [box, corner];
}

/** Long straight run — a fence line along a street, as in the report. */
function runLayout(ox: number, oy: number, len: number, axis: "ew" | "ns"): Tile[] {
  const out: Tile[] = [];
  for (let i = 0; i < len; i++) {
    out.push(axis === "ew" ? { x: ox + i, y: oy } : { x: ox, y: oy + i });
  }
  return out;
}

/**
 * Long L-shaped corner (not the small 5x5 from baseLayouts) sitting a fixed
 * gap SW of a lot — a free-standing shelter enclosing houses at a distance,
 * as in the screenshots. Long enough that the west arm crosses well north of
 * the lot's south face, where wall tiles stop being pinned to the building.
 */
function longCorner(
  cornerX: number,
  cornerY: number,
  armLen: number,
): Tile[] {
  const out: Tile[] = [];
  for (let i = 0; i < armLen; i++) out.push({ x: cornerX, y: cornerY - i });
  for (let i = 0; i < armLen; i++) out.push({ x: cornerX + i, y: cornerY });
  return out;
}

/** Mirror of WorldScene.overworldStructureDepthFootprints. */
function overworldFootprints(walls: Set<string>, drawn: Map<string, number>) {
  const out: FurnitureDepthFootprint[] = [];
  for (const id of walls) {
    const [xs, ys] = id.split(",");
    const x = Number(xs);
    const y = Number(ys);
    const fp: FurnitureDepthFootprint = { ox: x, oy: y, w: 1, h: 1, partition: true };
    if (!PLAIN) fp.depth = drawn.get(id)!;
    out.push(fp);
  }
  return out;
}

const overworldSample = sampleBySize(buildings, 16);
const APRON = 4;

function checkOverworldLayout(name: string, layout: Tile[]) {
  const walls = layout.filter((t) => !getBuildingAt(t.x, t.y));
  if (walls.length < 4) return;
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
  for (let y = Math.min(...ys) - APRON; y <= Math.max(...ys) + APRON; y++) {
    for (let x = Math.min(...xs) - APRON; x <= Math.max(...xs) + APRON; x++) {
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
    { allowEntityOverWallsUnderBuildings: true },
  );

  // Two wall tiles that overlap on screen must stay in iso order, whatever the
  // buildings around them do — an inversion is visible at the join, and leaves
  // an entity between them with no depth that satisfies both.
  for (let i = 0; i < walls.length; i++) {
    for (let j = i + 1; j < walls.length; j++) {
      const a = walls[i]!;
      const b2 = walls[j]!;
      const truth = key(a.x, a.y) - key(b2.x, b2.y);
      if (truth === 0) continue;
      if (!overlaps(wallScreenBox(a.x, a.y), wallScreenBox(b2.x, b2.y))) continue;
      wallPairsChecked++;
      const da = drawn.get(tileId(a.x, a.y))!;
      const db = drawn.get(tileId(b2.x, b2.y))!;
      if (da === db) continue;
      if (da > db === truth > 0) continue;
      wallPairFailures.push(
        `  ${name} | (${a.x},${a.y}) ${da.toFixed(4)} vs (${b2.x},${b2.y}) ${db.toFixed(4)}` +
          ` | expected (${truth > 0 ? a.x : b2.x},${truth > 0 ? a.y : b2.y}) on top`,
      );
    }
  }
  // Player on a house's SW street apron must stay above that house when walls
  // sit on the same apron (the regression for SW-facing houses).
  for (const ent of entityTiles) {
    const entityDepth = applyOverworldStructureEntityDepth(
      overworldEntityRenderDepth(ent.x + 0.5, ent.y + 0.5),
      ent.x,
      ent.y,
      footprints,
    );
    for (const b of getBuildingsNearTile(ent.x, ent.y, 8)) {
      if (b.buildingType !== "house") continue;
      if (!isInFrontOfBuilding(ent.x, ent.y, b)) continue;
      const onSwApron =
        ent.y >= b.oy + b.h &&
        ent.y <= b.oy + b.h + 2 &&
        ent.x <= b.ox + 1 &&
        ent.x >= b.ox - 4;
      if (!onSwApron) continue;
      const wallOnApron = walls.some(
        (w) =>
          w.y >= b.oy + b.h &&
          w.y <= b.oy + b.h + 2 &&
          w.x <= b.ox + b.w &&
          w.x >= b.ox - 4,
      );
      if (!wallOnApron) continue;
      buildingFrontChecked++;
      const bd = buildingWallDepth(b);
      if (entityDepth > bd) continue;
      buildingFrontFailures.push(
        `  ${name} | entity (${ent.x},${ent.y}) depth ${entityDepth.toFixed(4)}` +
          ` under house ${b.w}x${b.h} @ (${b.ox},${b.oy}) depth ${bd.toFixed(4)}`,
      );
    }
  }
}

let wallPairsChecked = 0;
const wallPairFailures: string[] = [];
let buildingFrontChecked = 0;
const buildingFrontFailures: string[] = [];

for (const b of overworldSample) {
  const lot = `${b.w}x${b.h} ${b.buildingType} L${b.exteriorLevels} @ (${b.ox},${b.oy})`;

  // Bases hugging each face of the lot, plus the four diagonal corners.
  const anchors: Tile[] = [
    { x: b.ox, y: b.oy + b.h },
    { x: b.ox + b.w, y: b.oy },
    { x: b.ox + b.w, y: b.oy + b.h },
    { x: b.ox - 6, y: b.oy },
    { x: b.ox, y: b.oy - 6 },
    { x: b.ox - 6, y: b.oy - 6 },
    { x: b.ox + b.w + 2, y: b.oy + b.h + 2 },
    { x: b.ox - 6, y: b.oy + b.h },
  ];

  for (const anchor of anchors) {
    for (const layout of baseLayouts(anchor.x, anchor.y, 5, 5)) {
      checkOverworldLayout(`base @ (${anchor.x},${anchor.y}) beside ${lot}`, layout);
    }
  }

  // Walls on the SW street apron (west of ox + along the south face) — used to
  // sink under the cuboid and behind-clamp the player under the SW wall.
  {
    const swApron: Tile[] = [];
    for (let i = 1; i <= 4; i++) {
      swApron.push({ x: b.ox - i, y: b.oy + b.h });
      swApron.push({ x: b.ox - i, y: b.oy + b.h + 1 });
    }
    for (let x = b.ox; x < b.ox + b.w; x++) {
      swApron.push({ x, y: b.oy + b.h });
    }
    checkOverworldLayout(`SW apron beside ${lot}`, swApron);
  }

  // Long straight runs (street fence lines) at a range of distances off each
  // face — the shape in the bug report, and the case that spans the reach
  // boundaries where lifted and unlifted segments meet.
  const RUN_LEN = 12;
  for (const gap of [1, 2, 3, 4, 5, 6, 8, 10, 12, 16]) {
    const runs: [string, Tile[]][] = [
      [`N gap ${gap}`, runLayout(b.ox - 3, b.oy - gap, RUN_LEN, "ew")],
      [`S gap ${gap}`, runLayout(b.ox - 3, b.oy + b.h - 1 + gap, RUN_LEN, "ew")],
      [`W gap ${gap}`, runLayout(b.ox - gap, b.oy - 3, RUN_LEN, "ns")],
      [`E gap ${gap}`, runLayout(b.ox + b.w - 1 + gap, b.oy - 3, RUN_LEN, "ns")],
    ];
    for (const [label, layout] of runs) {
      checkOverworldLayout(`run ${label} beside ${lot}`, layout);
    }
  }

  // Long free-standing corner enclosures at a range of gaps SW of the lot —
  // crosses the boundary where apron-pinned wall tiles (near the south face)
  // give way to unpinned ones further up the west arm.
  for (const gap of [0, 1, 2, 3, 4, 5, 6, 8]) {
    checkOverworldLayout(
      `long corner gap ${gap} beside ${lot}`,
      longCorner(b.ox - gap, b.oy + b.h + gap, 15),
    );
  }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

// Player on the west wall / NW diagonal of a house must sit above that cuboid
// (the regression for "tile north-west of a building"). Trees on the same
// tiles stay under the roof. North-face tiles (not the NW diagonal) stay under
// so the player does not walk onto the roof.
let westFaceChecked = 0;
const westFaceFailures: string[] = [];
let northFaceChecked = 0;
const northFaceFailures: string[] = [];
let westTreeChecked = 0;
const westTreeFailures: string[] = [];

for (const b of sampleBySize(buildings, 16)) {
  const bd = buildingWallDepth(b);
  const lot = `${b.w}x${b.h} ${b.buildingType} @ (${b.ox},${b.oy})`;
  for (let ty = b.oy - 1; ty < b.oy + b.h; ty++) {
    const tx = b.ox - 1;
    if (getBuildingAt(tx, ty)) continue;
    westFaceChecked++;
    const entityDepth = overworldEntityRenderDepth(tx + 0.5, ty + 0.5);
    if (entityDepth <= bd) {
      westFaceFailures.push(
        `  entity (${tx},${ty}) depth ${entityDepth.toFixed(4)} under ${lot} depth ${bd.toFixed(4)}`,
      );
    }
    // SW-apron trees already lift (same street rule as entities). Only the
    // west wall / NW diagonal must keep canopies under the roof.
    if (ty < b.oy + b.h - 1) {
      westTreeChecked++;
      const treeDepth = applyBuildingTreeDepth(
        entityRenderDepth(tx + 0.5, ty + 0.5),
        tx,
        ty,
      );
      if (treeDepth > bd) {
        westTreeFailures.push(
          `  tree (${tx},${ty}) depth ${treeDepth.toFixed(4)} over ${lot} depth ${bd.toFixed(4)}`,
        );
      }
    }
  }
  for (let tx = b.ox; tx < b.ox + b.w; tx++) {
    const ty = b.oy - 1;
    if (getBuildingAt(tx, ty)) continue;
    northFaceChecked++;
    const entityDepth = overworldEntityRenderDepth(tx + 0.5, ty + 0.5);
    if (entityDepth > bd) {
      northFaceFailures.push(
        `  entity (${tx},${ty}) depth ${entityDepth.toFixed(4)} over north face of ${lot} depth ${bd.toFixed(4)}`,
      );
    }
  }
}

console.log(`mode: ${PLAIN ? "plain footprints (pre-fix)" : "current"}`);
console.log(`buildings discovered: ${buildings.length}`);
console.log(`overlapping entity/wall pairs checked: ${pairsChecked}`);
console.log(`interior mis-ordered pairs: ${interiorFailures}`);
console.log(`overworld mis-ordered pairs: ${failures.length - interiorFailures}`);
console.log(`overlapping wall/wall pairs checked: ${wallPairsChecked}`);
console.log(`wall/wall mis-ordered pairs: ${wallPairFailures.length}`);
for (const s of wallPairFailures.slice(0, 8)) console.log(s);
console.log(`street-in-front-of-building cases checked: ${buildingFrontChecked}`);
console.log(`entity under building while in front: ${buildingFrontFailures.length}`);
for (const s of buildingFrontFailures.slice(0, 8)) console.log(s);

console.log(`west-face / NW-diagonal entity vs cuboid: ${westFaceChecked}`);
console.log(`entity under cuboid on west/NW: ${westFaceFailures.length}`);
for (const s of westFaceFailures.slice(0, 8)) console.log(s);
console.log(`north-face entity vs cuboid: ${northFaceChecked}`);
console.log(`entity over cuboid on north face: ${northFaceFailures.length}`);
for (const s of northFaceFailures.slice(0, 8)) console.log(s);
console.log(`west-face tree vs cuboid: ${westTreeChecked}`);
console.log(`tree over cuboid on west/NW: ${westTreeFailures.length}`);
for (const s of westTreeFailures.slice(0, 8)) console.log(s);

const shown = new Set<string>();
for (const f of failures) {
  const k = f.scenario;
  if (shown.has(k)) continue;
  shown.add(k);
  if (shown.size > 8) break;
  console.log(
    `  ${f.scenario} | wall (${f.wall.x},${f.wall.y}) depth ${f.wallDepth.toFixed(4)}` +
      ` | entity (${f.entity.x},${f.entity.y}) depth ${f.entityDepth.toFixed(4)}` +
      ` | expected ${f.expected} on top`,
  );
}

if (
  failures.length ||
  wallPairFailures.length ||
  buildingFrontFailures.length ||
  westFaceFailures.length ||
  northFaceFailures.length ||
  westTreeFailures.length
) {
  process.exitCode = 1;
} else console.log("OK");
