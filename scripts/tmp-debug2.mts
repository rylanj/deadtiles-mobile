import {
  applyOverworldStructureEntityDepth,
  applyFurnitureEntityDepth,
  buildingWallDepth,
  overworldEntityRenderDepth,
  overworldPartitionDepth,
  type FurnitureDepthFootprint,
} from "../packages/client/src/world/depthSort.ts";
import {
  getBuildingAt,
  getBuildingsNearTile,
  interiorWallCornerDepthBias,
  isInFrontOfBuilding,
} from "@zombie/shared";
import { discoverCityBuildings } from "./lib/city-buildings.mts";

const b = discoverCityBuildings().find(
  (bb) => bb.ox === -2842 && bb.oy === 789,
)!;
console.log("building", b);

function baseLayouts(ox: number, oy: number, w: number, h: number) {
  const box: { x: number; y: number }[] = [];
  for (let x = ox; x < ox + w; x++) {
    box.push({ x, y: oy }, { x, y: oy + h - 1 });
  }
  for (let y = oy + 1; y < oy + h - 1; y++) {
    box.push({ x: ox, y }, { x: ox + w - 1, y });
  }
  const corner: { x: number; y: number }[] = [];
  for (let x = ox; x < ox + w; x++) corner.push({ x, y: oy });
  for (let y = oy + 1; y < oy + h; y++) corner.push({ x: ox, y });
  return [box, corner];
}

const anchor = { x: b.ox + b.w + 2, y: b.oy + b.h + 2 };
for (const layout of baseLayouts(anchor.x, anchor.y, 5, 5)) {
  const walls = layout.filter((t) => !getBuildingAt(t.x, t.y));
  const wallSet = new Set(walls.map((t) => `${t.x},${t.y}`));
  const drawn = new Map<string, number>();
  for (const t of walls) {
    const bias = Math.max(
      interiorWallCornerDepthBias(wallSet, t.x, t.y, "ns"),
      interiorWallCornerDepthBias(wallSet, t.x, t.y, "ew"),
    );
    drawn.set(`${t.x},${t.y}`, overworldPartitionDepth(t.x, t.y, bias));
  }
  if (!wallSet.has("-2828,802")) continue;
  console.log("layout walls:", walls);
  for (const t of walls) {
    console.log(" wall", t.x, t.y, "depth", drawn.get(`${t.x},${t.y}`));
  }
  const footprints: FurnitureDepthFootprint[] = walls.map((t) => ({
    ox: t.x,
    oy: t.y,
    w: 1,
    h: 1,
    partition: true,
    depth: drawn.get(`${t.x},${t.y}`)!,
  }));
  const ent = { x: -2828, y: 803 };
  const base = overworldEntityRenderDepth(ent.x + 0.5, ent.y + 0.5);
  const afterFurniture = applyFurnitureEntityDepth(base, ent.x, ent.y, footprints);
  const final = applyOverworldStructureEntityDepth(base, ent.x, ent.y, footprints);
  console.log("wall depth", drawn.get("-2828,802"));
  console.log("entity base", base, "afterFurniture", afterFurniture, "final", final);
  console.log(
    "nearby buildings",
    getBuildingsNearTile(ent.x, ent.y, 40).map(
      (bb) => `${bb.ox},${bb.oy} ${bb.w}x${bb.h} inFront=${isInFrontOfBuilding(ent.x, ent.y, bb)} bd=${buildingWallDepth(bb)}`,
    ),
  );
}
