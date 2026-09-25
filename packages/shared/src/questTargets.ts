/**
 * Picks a house or motel for Captain Davis's field jobs.
 * Accept-time only: the scan is cheap next to a dialog click.
 */

import { isBirchportHospital, isBuildingInBirchport } from "./birchport.js";
import { isInBirchportBarracks } from "./birchportBarracks.js";
import { getPlayerSpawnFootprint, getBuildingAt, type BuildingInfo } from "./worldgen.js";

export type QuestTargetExclude = {
  ox?: number;
  oy?: number;
};

function buildingCenter(bld: BuildingInfo): { x: number; y: number } {
  return { x: bld.ox + bld.w / 2, y: bld.oy + bld.h / 2 };
}

function collectBuildingsInRect(
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
  type?: BuildingInfo["buildingType"],
): BuildingInfo[] {
  const seen = new Set<string>();
  const out: BuildingInfo[] = [];
  for (let ty = minY; ty <= maxY; ty += 2) {
    for (let tx = minX; tx <= maxX; tx += 2) {
      const bld = getBuildingAt(tx, ty);
      if (!bld) continue;
      if (type && bld.buildingType !== type) continue;
      const key = `${bld.ox},${bld.oy}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(bld);
    }
  }
  return out;
}

function pickFrom(pool: BuildingInfo[]): BuildingInfo | null {
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)] ?? null;
}

function notExcluded(
  bld: BuildingInfo,
  exclude?: QuestTargetExclude,
): boolean {
  if (exclude?.ox == null || exclude.oy == null) return true;
  return bld.ox !== exclude.ox || bld.oy !== exclude.oy;
}

/** Hospital, Red Order market, barracks, and empty shells stay off the board. */
export function isQuietStretchExcludedBuilding(bld: BuildingInfo): boolean {
  if (bld.buildingType === "none") return true;
  if (bld.buildingType === "tent" || bld.buildingType === "mess_hall") {
    return true;
  }
  if (isInBirchportBarracks(bld.ox, bld.oy)) return true;
  if (isBirchportHospital(bld.ox, bld.oy)) return true;
  // Birchport markets are Red Order held.
  if (bld.buildingType === "supermarket") return true;
  return false;
}

/**
 * Random enterable building inside Birchport. Skips the hospital, the Red
 * Order supermarket, and the barracks compound.
 */
export function pickQuietStretchHouse(
  exclude?: QuestTargetExclude,
): BuildingInfo | null {
  const f = getPlayerSpawnFootprint();
  const buildings = collectBuildingsInRect(f.minX, f.maxX, f.minY, f.maxY);
  const pool = buildings.filter(
    (bld) =>
      isBuildingInBirchport(bld.ox, bld.oy) &&
      !isQuietStretchExcludedBuilding(bld) &&
      notExcluded(bld, exclude),
  );
  return pickFrom(pool);
}

/**
 * Motel south of Birchport, or the nearest motel to the south edge if none sit
 * past the footprint.
 */
export function pickMissingPairMotel(): BuildingInfo | null {
  const f = getPlayerSpawnFootprint();
  const motels = collectBuildingsInRect(
    f.minX - 20,
    f.maxX + 20,
    f.minY,
    f.maxY + 80,
    "motel",
  );
  if (motels.length === 0) return null;

  const southBand = f.maxY - 24;
  const south = motels.filter((bld) => bld.oy + bld.h > southBand);
  if (south.length > 0) {
    south.sort((a, b) => b.oy - a.oy);
    return south[0] ?? null;
  }

  const destX = (f.minX + f.maxX) / 2;
  const destY = f.maxY + 10;
  let best = motels[0]!;
  let bestDist = Infinity;
  for (const bld of motels) {
    const c = buildingCenter(bld);
    const d = Math.hypot(c.x - destX, c.y - destY);
    if (d < bestDist) {
      best = bld;
      bestDist = d;
    }
  }
  return best;
}

export function questTargetBuildingLabel(ox: number, oy: number): string {
  const bld = getBuildingAt(ox, oy);
  const kind =
    bld?.buildingType === "motel"
      ? "motel"
      : bld?.buildingType === "house"
        ? "house"
        : "building";
  return `${kind} at ${ox}, ${oy}`;
}
