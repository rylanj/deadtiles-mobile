// Real buildings from the generated world, for the render-order checkers.
import {
  getBuildingsNearTile,
  getSettlementType,
  SETTLEMENT_CELL_SIZE,
  type BuildingInfo,
} from "@zombie/shared";

/** Buildings around the first `cityCount` cities near the origin (biggest lots live there). */
export function discoverCityBuildings(cityCount = 2): BuildingInfo[] {
  const cities: { x: number; y: number }[] = [];
  for (let cx = -30; cx <= 30 && cities.length < cityCount; cx++) {
    for (let cy = -30; cy <= 30 && cities.length < cityCount; cy++) {
      const x = cx * SETTLEMENT_CELL_SIZE;
      const y = cy * SETTLEMENT_CELL_SIZE;
      if (getSettlementType(x, y) === "city") cities.push({ x, y });
    }
  }

  const seen = new Map<string, BuildingInfo>();
  for (const city of cities) {
    for (let y = city.y - 150; y < city.y + 250; y += 5) {
      for (let x = city.x - 150; x < city.x + 250; x += 5) {
        for (const b of getBuildingsNearTile(x, y, 5)) {
          seen.set(`${b.ox},${b.oy}`, b);
        }
      }
    }
  }
  if (seen.size === 0) throw new Error("no buildings found near the origin cities");
  return [...seen.values()];
}

/** One building per distinct footprint size + type, largest first. */
export function sampleBySize(buildings: BuildingInfo[], max: number): BuildingInfo[] {
  const bySize = new Map<string, BuildingInfo>();
  for (const b of buildings) {
    const k = `${b.w}x${b.h}:${b.buildingType}:${b.exteriorLevels}`;
    if (!bySize.has(k)) bySize.set(k, b);
  }
  return [...bySize.values()]
    .sort((a, b) => b.w * b.h - a.w * a.h)
    .slice(0, max);
}
