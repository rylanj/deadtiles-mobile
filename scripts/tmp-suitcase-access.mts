import {
  furnitureApproachTiles,
  furnitureFootprint,
  generateInteriorContent,
  interiorExitForBuildingAt,
} from "../packages/shared/src/interior.ts";
import {
  SETTLEMENT_CELL_SIZE,
  getSettlementType,
  listBuildingsInRect,
} from "../packages/shared/src/worldgen.ts";

type Furn = {
  kind: string;
  objectType?: string;
  x: number;
  y: number;
  facing?: string;
};

function reachable(
  iW: number,
  iH: number,
  exit: ReturnType<typeof interiorExitForBuildingAt>,
  walls: { x: number; y: number }[],
  furnitures: Furn[],
): Set<string> {
  const wallSet = new Set(walls.map((w) => `${w.x},${w.y}`));
  const blocked = new Set<string>();
  for (const f of furnitures) {
    if (f.objectType === "groundbackpack") continue;
    const { w, h } = furnitureFootprint(f.objectType ?? "", f.facing);
    for (let ty = f.y; ty < f.y + h; ty++) {
      for (let tx = f.x; tx < f.x + w; tx++) blocked.add(`${tx},${ty}`);
    }
  }
  const out = new Set<string>();
  const q: { x: number; y: number }[] = [];
  const seed = (tx: number, ty: number) => {
    if (tx < 0 || ty < 0 || tx >= iW || ty >= iH) return;
    const key = `${tx},${ty}`;
    if (out.has(key) || wallSet.has(key) || blocked.has(key)) return;
    out.add(key);
    q.push({ x: tx, y: ty });
  };
  if (exit.face === "SE") {
    for (let y = exit.alongMin; y <= exit.alongMax; y++) seed(exit.insideX, y);
  } else {
    for (let x = exit.alongMin; x <= exit.alongMax; x++) seed(x, exit.insideY);
  }
  seed(exit.insideX, exit.insideY);
  for (let i = 0; i < q.length; i++) {
    const c = q[i]!;
    seed(c.x + 1, c.y);
    seed(c.x - 1, c.y);
    seed(c.x, c.y + 1);
    seed(c.x, c.y - 1);
  }
  return out;
}

function hasAccess(f: Furn, tiles: Set<string>): boolean {
  return furnitureApproachTiles({
    kind: "furniture",
    objectType: f.objectType,
    x: f.x,
    y: f.y,
    facing: f.facing,
  }).some((t) => tiles.has(`${t.x},${t.y}`));
}

const cities: { x: number; y: number }[] = [];
const towns: { x: number; y: number }[] = [];
for (let cx = -20; cx <= 20; cx++) {
  for (let cy = -20; cy <= 20; cy++) {
    const x = cx * SETTLEMENT_CELL_SIZE;
    const y = cy * SETTLEMENT_CELL_SIZE;
    const kind = getSettlementType(x, y);
    if (kind === "city" && cities.length < 12) cities.push({ x, y });
    if (kind === "town" && towns.length < 8) towns.push({ x, y });
  }
}

const spots = [...cities, ...towns];
const buildings = spots.flatMap((s) =>
  listBuildingsInRect(s.x - 420, s.x + 420, s.y - 420, s.y + 420),
);
const seen = new Set<string>();
const targets = buildings.filter((b) => {
  if (b.buildingType !== "motel" && b.buildingType !== "house") return false;
  const key = `${b.ox},${b.oy}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

let checked = 0;
let withSuitcase = 0;
let blockedEvents = 0;
let motels = 0;
let motelSuitcases = 0;
let motelBlocked = 0;
const samples: string[] = [];

for (const b of targets) {
  const content = generateInteriorContent(b.ox, b.oy);
  const suitcases = content.furnitures.filter((f) => f.objectType === "suitcase");
  if (b.buildingType === "motel") {
    motels++;
    motelSuitcases += suitcases.length;
  }
  if (suitcases.length === 0) continue;
  withSuitcase++;
  checked++;
  const { iW, iH } = {
    iW: b.w * 2,
    iH: b.h * 2,
  };
  const exit = interiorExitForBuildingAt(b.ox, b.oy);
  const without = content.furnitures.filter((f) => f.objectType !== "suitcase");
  const open = reachable(iW, iH, exit, content.walls, without);
  const closed = reachable(iW, iH, exit, content.walls, content.furnitures);
  for (const f of without) {
    if (!hasAccess(f, open)) continue;
    if (hasAccess(f, closed)) continue;
    blockedEvents++;
    if (b.buildingType === "motel") motelBlocked++;
    if (samples.length < 20) {
      samples.push(
        `${b.buildingType} ${b.ox},${b.oy} ${b.w}x${b.h} blocked ${f.objectType} at ${f.x},${f.y} by suitcase(s) ${suitcases.map((s) => `${s.x},${s.y}/${s.facing}`).join(" ")}`,
      );
    }
  }
}

console.log(
  JSON.stringify(
    {
      buildings: targets.length,
      motels,
      motelSuitcases,
      motelBlocked,
      withSuitcase,
      blockedEvents,
      samples,
    },
    null,
    2,
  ),
);
