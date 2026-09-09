import {
  applyOverworldStructureEntityDepth,
  buildingWallDepth,
  overworldEntityRenderDepth,
  overworldPartitionDepth,
  type FurnitureDepthFootprint,
} from "../packages/client/src/world/depthSort.ts";
import { getBuildingAt, interiorWallCornerDepthBias, getBuildingsNearTile } from "@zombie/shared";

const b = { ox: -2978, oy: 682, w: 4, h: 4 };
console.log("buildingWallDepth", buildingWallDepth(b));

const gap = 4;
const cornerX = b.ox - gap; // -2982
const cornerY = b.oy + b.h + gap; // 690
const armLen = 15;
const walls: { x: number; y: number }[] = [];
for (let i = 0; i < armLen; i++) walls.push({ x: cornerX, y: cornerY - i });
for (let i = 0; i < armLen; i++) walls.push({ x: cornerX + i, y: cornerY });
const wallList = walls.filter((t) => !getBuildingAt(t.x, t.y));
const wallSet = new Set(wallList.map((t) => `${t.x},${t.y}`));
const drawn = new Map<string, number>();
for (const t of wallList) {
  const bias = Math.max(
    interiorWallCornerDepthBias(wallSet, t.x, t.y, "ns"),
    interiorWallCornerDepthBias(wallSet, t.x, t.y, "ew"),
  );
  drawn.set(`${t.x},${t.y}`, overworldPartitionDepth(t.x, t.y, bias));
}
for (const t of wallList) {
  console.log(t.x, t.y, "depth=", drawn.get(`${t.x},${t.y}`));
}

const footprints: FurnitureDepthFootprint[] = wallList.map((t) => ({
  ox: t.x,
  oy: t.y,
  w: 1,
  h: 1,
  partition: true,
  depth: drawn.get(`${t.x},${t.y}`)!,
}));

const ent = { x: -2984, y: 678 };
const base = overworldEntityRenderDepth(ent.x + 0.5, ent.y + 0.5);
const res = applyOverworldStructureEntityDepth(base, ent.x, ent.y, footprints);
console.log("entity base", base, "resolved", res);
console.log("nearby buildings", getBuildingsNearTile(ent.x, ent.y, 8).map((bb) => `${bb.ox},${bb.oy} ${bb.w}x${bb.h}`));
