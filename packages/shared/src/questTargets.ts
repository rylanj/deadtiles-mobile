/**
 * Picks a house or motel for Captain Davis's field jobs.
 * Accept-time only: the scan is cheap next to a dialog click.
 */

import {
  isAshenTraderWarehouse,
  isBirchportHospital,
  isBuildingInBirchport,
} from "./birchport.js";
import { isInBirchportBarracks } from "./birchportBarracks.js";
import { PLAYER_SPAWN_HUB_NAME } from "./constants.js";
import {
  getPlayerSpawnFootprint,
  getBuildingAt,
  getCityName,
  getCityRoadLinks,
  getSettlementType,
  listBuildingsInRect,
  settlementCellsInRegion,
  SETTLEMENT_CELL_SIZE,
  type BuildingInfo,
} from "./worldgen.js";

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
        : bld?.buildingType === "supermarket"
          ? "supermarket"
          : bld?.buildingType === "warehouse"
            ? "warehouse"
            : "building";
  return `${kind} at ${ox}, ${oy}`;
}

/** Rings around Birchport. Near first, then a wider pass if the near ring is empty. */
const QUEST_NEAR_PAD = 288;
const QUEST_FAR_PAD = 576;

function buildingsAroundBirchport(pad: number): BuildingInfo[] {
  const f = getPlayerSpawnFootprint();
  return listBuildingsInRect(
    f.minX - pad,
    f.maxX + pad,
    f.minY - pad,
    f.maxY + pad,
  );
}

function pickOutsideBirchport(
  type: BuildingInfo["buildingType"],
  exclude?: QuestTargetExclude,
): BuildingInfo | null {
  for (const pad of [QUEST_NEAR_PAD, QUEST_FAR_PAD]) {
    const pool = buildingsAroundBirchport(pad).filter(
      (bld) =>
        bld.buildingType === type &&
        !isBuildingInBirchport(bld.ox, bld.oy) &&
        notExcluded(bld, exclude),
    );
    const picked = pickFrom(pool);
    if (picked) return picked;
  }
  return null;
}

function birchportCityCell(): { cx: number; cy: number } | null {
  const f = getPlayerSpawnFootprint();
  for (const cell of settlementCellsInRegion(f.minX, f.maxX, f.minY, f.maxY)) {
    if (getSettlementType(cell.cx, cell.cy) !== "city") continue;
    if (getCityName(cell.cx, cell.cy) !== PLAYER_SPAWN_HUB_NAME) continue;
    return cell;
  }
  return null;
}

/** Supermarkets in one city. Grids can sit a little outside the 96-tile cell. */
function supermarketsInCity(
  cx: number,
  cy: number,
  exclude?: QuestTargetExclude,
): BuildingInfo[] {
  const spill = Math.floor(SETTLEMENT_CELL_SIZE / 2);
  const cellMax = SETTLEMENT_CELL_SIZE - 1;
  return listBuildingsInRect(
    cx - spill,
    cx + cellMax + spill,
    cy - spill,
    cy + cellMax + spill,
  ).filter(
    (bld) =>
      bld.buildingType === "supermarket" &&
      !isBuildingInBirchport(bld.ox, bld.oy) &&
      notExcluded(bld, exclude),
  );
}

/**
 * Supermarket outside Birchport for a supply-run scout.
 * Nearby cities sit past the tile rings, so those markets are included too.
 */
export function pickAisleCheckSupermarket(
  exclude?: QuestTargetExclude,
): BuildingInfo | null {
  const near = pickOutsideBirchport("supermarket", exclude);
  if (near) return near;

  const hub = birchportCityCell();
  if (!hub) return null;
  const pool: BuildingInfo[] = [];
  const seen = new Set<string>();
  for (const city of getCityRoadLinks(hub.cx, hub.cy)) {
    for (const bld of supermarketsInCity(city.cx, city.cy, exclude)) {
      const key = `${bld.ox},${bld.oy}`;
      if (seen.has(key)) continue;
      seen.add(key);
      pool.push(bld);
    }
  }
  return pickFrom(pool);
}

/** Rings for the starter job: close to town first so new players don't trek far. */
const FIRST_SWEEP_PADS = [64, 128, QUEST_NEAR_PAD] as const;
/** Pick among this many of the nearest houses so players don't all share one. */
const FIRST_SWEEP_POOL = 5;

/** One of the closest houses just outside the Birchport footprint. */
export function pickFirstSweepHouse(
  exclude?: QuestTargetExclude,
): BuildingInfo | null {
  const f = getPlayerSpawnFootprint();
  const cx = (f.minX + f.maxX) / 2;
  const cy = (f.minY + f.maxY) / 2;
  for (const pad of FIRST_SWEEP_PADS) {
    const pool = buildingsAroundBirchport(pad).filter(
      (bld) =>
        bld.buildingType === "house" &&
        !isBuildingInBirchport(bld.ox, bld.oy) &&
        notExcluded(bld, exclude),
    );
    if (pool.length === 0) continue;
    pool.sort((a, b) => {
      const ac = buildingCenter(a);
      const bc = buildingCenter(b);
      return Math.hypot(ac.x - cx, ac.y - cy) - Math.hypot(bc.x - cx, bc.y - cy);
    });
    return pickFrom(pool.slice(0, FIRST_SWEEP_POOL));
  }
  return null;
}

/** House outside Birchport, rural or in another settlement. */
export function pickClarkHouse(
  exclude?: QuestTargetExclude,
): BuildingInfo | null {
  return pickOutsideBirchport("house", exclude);
}

/**
 * Warehouse the Red Order wants emptied. Skips the Ashen market.
 * Prefers one outside Birchport.
 */
export function pickFloorSpaceWarehouse(
  exclude?: QuestTargetExclude,
): BuildingInfo | null {
  for (const pad of [QUEST_NEAR_PAD, QUEST_FAR_PAD]) {
    const all = buildingsAroundBirchport(pad).filter(
      (bld) =>
        bld.buildingType === "warehouse" &&
        !isAshenTraderWarehouse(bld.ox, bld.oy) &&
        notExcluded(bld, exclude),
    );
    const outside = all.filter((bld) => !isBuildingInBirchport(bld.ox, bld.oy));
    const picked = pickFrom(outside.length > 0 ? outside : all);
    if (picked) return picked;
  }
  return null;
}
