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

function debug(ox: number, oy: number, anchorX: number, anchorY: number, wantWall: string, ent: { x: number; y: number }) {
  const b = discoverCityBuildings().find((bb) => bb.ox === ox && bb.oy === oy)!;
  console.log("building", b);
  for (const layout of baseLayouts(anchorX, anchorY, 5, 5)) {
    const walls = layout.filter((t) => !getBuildingAt(t.x, t.y));
    const wallSet = new Set(walls.map((t) => `${t.x},${t.y}`));
    if (!wallSet.has(wantWall)) continue;
    const drawn = new Map<string, number>();
    for (const t of walls) {
      const bias = Math.max(
        interiorWallCornerDepthBias(wallSet, t.x, t.y, "ns"),
        interiorWallCornerDepthBias(wallSet, t.x, t.y, "ew"),
      );
      drawn.set(`${t.x},${t.y}`, overworldPartitionDepth(t.x, t.y, bias));
    }
    console.log("layout walls with depths:");
    for (const t of walls) console.log(" ", t.x, t.y, drawn.get(`${t.x},${t.y}`));
    const footprints: FurnitureDepthFootprint[] = walls.map((t) => ({
      ox: t.x,
      oy: t.y,
      w: 1,
      h: 1,
      partition: true,
      depth: drawn.get(`${t.x},${t.y}`)!,
    }));
    const base = overworldEntityRenderDepth(ent.x + 0.5, ent.y + 0.5);
    const afterFurniture = applyFurnitureEntityDepth(base, ent.x, ent.y, footprints);
    const final = applyOverworldStructureEntityDepth(base, ent.x, ent.y, footprints);
    console.log("wanted wall depth", drawn.get(wantWall));
    console.log("entity base", base, "afterFurniture", afterFurniture, "final", final);
    console.log(
      "nearby buildings",
      getBuildingsNearTile(ent.x, ent.y, 40).map(
        (bb) => `${bb.ox},${bb.oy} ${bb.w}x${bb.h} inFront=${isInFrontOfBuilding(ent.x, ent.y, bb)} bd=${buildingWallDepth(bb)}`,
      ),
    );
  }
}

console.log("=== hospital case ===");
debug(-2824, 810, -2830, 804, "-2830,808", { x: -2831, y: 808 });
