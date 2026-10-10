/**
 * Picks a house or motel for Captain Davis's field jobs.
 * Accept-time only: the scan is cheap next to a dialog click.
 */

import {
  findAshenTraderWarehouse,
  isAshenTraderWarehouse,
  isBirchportHospital,
  isBuildingInBirchport,
} from "./birchport.js";
import { isInBirchportBarracks } from "./birchportBarracks.js";
import { CELLAR_DOORS, getCellarAt } from "./cellar.js";
import { PLAYER_SPAWN_HUB_NAME } from "./constants.js";
import {
  furnitureInRetailManagerOffice,
  generateInteriorContent,
  interiorDimensions,
  interiorExitForBuildingAt,
  isClothingRack,
  isRedOrderOwnedSupermarket,
  isSupplyFridge,
  isSupplyShelf,
  searchableFootprint,
} from "./interior.js";
import { isLootContainerType } from "./items.js";
import { floodExteriorReachableTiles } from "./sealedRegion.js";
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
  type BuildingType,
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

function shuffleBuildings(pool: readonly BuildingInfo[]): BuildingInfo[] {
  const order = pool.slice();
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = order[i]!;
    order[i] = order[j]!;
    order[j] = tmp;
  }
  return order;
}

/**
 * Try buildings until one can actually host the job.
 * Interior generation is accept-time only, and stops at the first match.
 */
function pickFirstThatFits(
  pool: readonly BuildingInfo[],
  fits?: (bld: BuildingInfo) => boolean,
  maxChecks = 16,
): BuildingInfo | null {
  if (pool.length === 0) return null;
  if (!fits) return pickFrom(pool.slice());
  const order = shuffleBuildings(pool);
  const limit = Math.min(order.length, maxChecks);
  for (let i = 0; i < limit; i++) {
    const bld = order[i];
    if (bld && fits(bld)) return bld;
  }
  return null;
}

type InteriorQuestFit = {
  lootFurniture: number;
  shelves: number;
  fridges: number;
  racks: number;
  /** Desk, cabinet, or bookshelf inside a department-store manager's office. */
  managerStash: number;
  standingTiles: number;
};

const interiorFitByOrigin = new Map<string, InteriorQuestFit>();

/** What a freshly generated interior can actually support. Layouts are seeded. */
function interiorQuestFit(bx: number, by: number): InteriorQuestFit {
  const key = `${bx},${by}`;
  const cached = interiorFitByOrigin.get(key);
  if (cached) return cached;

  const generated = generateInteriorContent(bx, by);
  let lootFurniture = 0;
  let shelves = 0;
  let fridges = 0;
  let racks = 0;
  let managerStash = 0;
  for (const obj of generated.furnitures) {
    if (obj.kind !== "furniture" || !obj.objectType) continue;
    if (isLootContainerType(obj.objectType)) lootFurniture++;
    if (isSupplyShelf(obj.objectType)) shelves++;
    if (isSupplyFridge(obj.objectType)) fridges++;
    if (isClothingRack(obj.objectType)) racks++;
    if (furnitureInRetailManagerOffice(bx, by, obj)) managerStash++;
  }

  const { iW, iH } = interiorDimensions(bx, by);
  const exit = interiorExitForBuildingAt(bx, by);
  const exitX = exit.insideX;
  const exitY = exit.insideY;
  const clearFrontX = exit.face === "SE" ? exit.insideX - 1 : exit.insideX;
  const clearFrontY = exit.face === "SW" ? exit.insideY - 1 : exit.insideY;
  const blocked = new Set<string>();
  for (const wall of generated.walls) blocked.add(`${wall.x},${wall.y}`);
  for (const door of generated.doors) blocked.add(`${door.x},${door.y}`);
  for (const obj of generated.furnitures) {
    if (obj.kind !== "furniture") continue;
    const { w, h } = searchableFootprint(obj);
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const fx = obj.x + dx;
        const fy = obj.y + dy;
        if (fx < 0 || fy < 0 || fx >= iW || fy >= iH) continue;
        blocked.add(`${fx},${fy}`);
      }
    }
  }
  const reachable = floodExteriorReachableTiles({
    minTX: 0,
    minTY: 0,
    maxTX: iW - 1,
    maxTY: iH - 1,
    isSealBlocked: (tx, ty) => blocked.has(`${tx},${ty}`),
    seeds: [
      { x: exitX, y: exitY },
      { x: clearFrontX, y: clearFrontY },
    ],
  });
  let standingTiles = 0;
  for (let ty = 0; ty < iH; ty++) {
    for (let tx = 0; tx < iW; tx++) {
      if (tx === exitX && ty === exitY) continue;
      if (tx === clearFrontX && ty === clearFrontY) continue;
      const tile = `${tx},${ty}`;
      if (blocked.has(tile) || !reachable.has(tile)) continue;
      standingTiles++;
    }
  }

  const fit = { lootFurniture, shelves, fridges, racks, managerStash, standingTiles };
  interiorFitByOrigin.set(key, fit);
  return fit;
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

function questBuildingKind(type: BuildingType | undefined): string {
  switch (type) {
    case "motel":
      return "motel";
    case "house":
      return "house";
    case "supermarket":
      return "supermarket";
    case "warehouse":
      return "warehouse";
    case "apartment":
      return "apartment";
    case "office":
      return "office";
    case "diner":
      return "diner";
    case "gun_shop":
      return "gun shop";
    case "large_retail":
      return "store";
    case "police_station":
      return "police station";
    case "hospital":
      return "hospital";
    default:
      return "building";
  }
}

function cityNameAt(x: number, y: number): string | null {
  const cx = Math.floor(x / SETTLEMENT_CELL_SIZE) * SETTLEMENT_CELL_SIZE;
  const cy = Math.floor(y / SETTLEMENT_CELL_SIZE) * SETTLEMENT_CELL_SIZE;
  if (getSettlementType(cx, cy) !== "city") return null;
  const name = getCityName(cx, cy).trim();
  return name.length > 0 ? name : null;
}

export function questTargetBuildingLabel(ox: number, oy: number): string {
  const bld = getBuildingAt(ox, oy);
  const kind = getCellarAt(ox, oy) ? "cellar hatch" : questBuildingKind(bld?.buildingType);
  const cx = bld ? bld.ox + bld.w / 2 : ox;
  const cy = bld ? bld.oy + bld.h / 2 : oy;
  const city = cityNameAt(cx, cy);
  const place = city ? ` in ${city}` : "";
  return `${kind} at ${ox}, ${oy}${place}`;
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
  fits?: (bld: BuildingInfo) => boolean,
): BuildingInfo | null {
  for (const pad of [QUEST_NEAR_PAD, QUEST_FAR_PAD]) {
    const pool = buildingsAroundBirchport(pad).filter(
      (bld) =>
        bld.buildingType === type &&
        !isBuildingInBirchport(bld.ox, bld.oy) &&
        notExcluded(bld, exclude),
    );
    const picked = pickFirstThatFits(pool, fits, 24);
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
  extras?: { fridges?: number },
): BuildingInfo | null {
  const needFridges = extras?.fridges ?? 0;
  const fits = (bld: BuildingInfo) => {
    const fit = interiorQuestFit(bld.ox, bld.oy);
    if (fit.shelves < 3) return false;
    if (needFridges > 0 && fit.fridges < needFridges) return false;
    return true;
  };
  const near = pickOutsideBirchport("supermarket", exclude, fits);
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
  return pickFirstThatFits(pool, fits, 24);
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

const COLEMAN_HOUSE_X = -115.5;
const COLEMAN_HOUSE_Y = 180.5;
const EAST_FORESTFORD_MOTEL_X = 514.5;
const EAST_FORESTFORD_MOTEL_Y = -178.5;

let colemanHouseCache: BuildingInfo | null | undefined;
let colemanMotelCache: BuildingInfo | null | undefined;

function nearestBuilding(
  pool: BuildingInfo[],
  x: number,
  y: number,
): BuildingInfo | null {
  let best: BuildingInfo | null = null;
  let bestD = Infinity;
  for (const bld of pool) {
    const c = buildingCenter(bld);
    const d = Math.hypot(c.x - x, c.y - y);
    if (d < bestD) {
      best = bld;
      bestD = d;
    }
  }
  return best;
}

/** Birchport house nearest (-115.5, 180.5). Sergeant Coleman's place. */
export function colemanHouse(): BuildingInfo | null {
  if (colemanHouseCache !== undefined) return colemanHouseCache;
  const f = getPlayerSpawnFootprint();
  const houses = listBuildingsInRect(f.minX, f.maxX, f.minY, f.maxY).filter(
    (bld) =>
      bld.buildingType === "house" && isBuildingInBirchport(bld.ox, bld.oy),
  );
  colemanHouseCache = nearestBuilding(houses, COLEMAN_HOUSE_X, COLEMAN_HOUSE_Y);
  return colemanHouseCache;
}

export function isColemanHouse(bx: number, by: number): boolean {
  const house = colemanHouse();
  return !!house && house.ox === bx && house.oy === by;
}

/** Motel at East Forestford (514.5, -178.5), or the nearest motel if that tile is a yard. */
export function colemanMotel(): BuildingInfo | null {
  if (colemanMotelCache !== undefined) return colemanMotelCache;
  const at = getBuildingAt(
    Math.floor(EAST_FORESTFORD_MOTEL_X),
    Math.floor(EAST_FORESTFORD_MOTEL_Y),
  );
  if (at?.buildingType === "motel") {
    colemanMotelCache = at;
    return at;
  }
  const pad = 160;
  const motels = listBuildingsInRect(
    EAST_FORESTFORD_MOTEL_X - pad,
    EAST_FORESTFORD_MOTEL_X + pad,
    EAST_FORESTFORD_MOTEL_Y - pad,
    EAST_FORESTFORD_MOTEL_Y + pad,
  ).filter((bld) => bld.buildingType === "motel");
  colemanMotelCache = nearestBuilding(
    motels,
    EAST_FORESTFORD_MOTEL_X,
    EAST_FORESTFORD_MOTEL_Y,
  );
  return colemanMotelCache;
}

export function isColemanMotel(bx: number, by: number): boolean {
  const motel = colemanMotel();
  return !!motel && motel.ox === bx && motel.oy === by;
}

let hollandHouseCache: BuildingInfo | null | undefined;

/** Corporal Holland's place: the Birchport house nearest Coleman's, other than his. */
export function hollandHouse(): BuildingInfo | null {
  if (hollandHouseCache !== undefined) return hollandHouseCache;
  const coleman = colemanHouse();
  const f = getPlayerSpawnFootprint();
  const houses = listBuildingsInRect(f.minX, f.maxX, f.minY, f.maxY).filter(
    (bld) =>
      bld.buildingType === "house" &&
      isBuildingInBirchport(bld.ox, bld.oy) &&
      !(coleman && bld.ox === coleman.ox && bld.oy === coleman.oy) &&
      interiorQuestFit(bld.ox, bld.oy).lootFurniture >= 1,
  );
  hollandHouseCache = nearestBuilding(houses, COLEMAN_HOUSE_X, COLEMAN_HOUSE_Y);
  return hollandHouseCache;
}

export function isHollandHouse(bx: number, by: number): boolean {
  const house = hollandHouse();
  return !!house && house.ox === bx && house.oy === by;
}

let redOrderSupermarketCache: BuildingInfo | null | undefined;

/** The Red Order's supermarket in Birchport (boarded up windows). */
export function birchportRedOrderSupermarket(): BuildingInfo | null {
  if (redOrderSupermarketCache !== undefined) return redOrderSupermarketCache;
  const f = getPlayerSpawnFootprint();
  const markets = listBuildingsInRect(f.minX, f.maxX, f.minY, f.maxY).filter(
    (bld) =>
      bld.buildingType === "supermarket" &&
      isBuildingInBirchport(bld.ox, bld.oy) &&
      isRedOrderOwnedSupermarket(bld.ox, bld.oy),
  );
  const cx = (f.minX + f.maxX) / 2;
  const cy = (f.minY + f.maxY) / 2;
  redOrderSupermarketCache = nearestBuilding(markets, cx, cy);
  return redOrderSupermarketCache;
}

/** Any Red Order supermarket inside Birchport counts for showing Holland's tag. */
export function isBirchportRedOrderSupermarket(bx: number, by: number): boolean {
  return (
    isBuildingInBirchport(bx, by) &&
    getBuildingAt(bx, by)?.buildingType === "supermarket" &&
    isRedOrderOwnedSupermarket(bx, by)
  );
}

/** Kevin's market warehouse in Birchport. */
export function ashenMarketBuilding(): BuildingInfo | null {
  const origin = findAshenTraderWarehouse();
  return origin ? getBuildingAt(origin.ox, origin.oy) : null;
}

/** The cellar Coleman was moved to. */
export function colemanCellar(): { ox: number; oy: number } | null {
  const door = CELLAR_DOORS[0];
  return door ? { ox: door.ox, oy: door.oy } : null;
}

export function isColemanCellar(bx: number, by: number): boolean {
  const cellar = colemanCellar();
  return !!cellar && cellar.ox === bx && cellar.oy === by;
}

/** House outside Birchport, rural or in another settlement. */
export function pickClarkHouse(
  exclude?: QuestTargetExclude,
): BuildingInfo | null {
  return pickOutsideBirchport(
    "house",
    exclude,
    (bld) => interiorQuestFit(bld.ox, bld.oy).lootFurniture >= 1,
  );
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

/**
 * Any building outside Birchport. Type does not matter.
 * The furniture check drops buildings with an empty interior.
 * The trader market stays off the board.
 */
function isOtherCityBuilding(bld: BuildingInfo): boolean {
  return (
    bld.buildingType !== "none" &&
    !isBuildingInBirchport(bld.ox, bld.oy) &&
    !isAshenTraderWarehouse(bld.ox, bld.oy)
  );
}

function buildingsInCityCell(
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
  ).filter((bld) => isOtherCityBuilding(bld) && notExcluded(bld, exclude));
}

/** Cities other than Birchport. Road links first, then any city in the far ring. */
function otherCityCells(): { cx: number; cy: number }[] {
  const hub = birchportCityCell();
  const cells: { cx: number; cy: number }[] = [];
  const seen = new Set<string>();
  const push = (cx: number, cy: number) => {
    if (hub && cx === hub.cx && cy === hub.cy) return;
    if (getSettlementType(cx, cy) !== "city") return;
    const key = `${cx},${cy}`;
    if (seen.has(key)) return;
    seen.add(key);
    cells.push({ cx, cy });
  };
  if (hub) {
    for (const city of getCityRoadLinks(hub.cx, hub.cy)) push(city.cx, city.cy);
  }
  if (cells.length > 0) return cells;
  const f = getPlayerSpawnFootprint();
  for (const cell of settlementCellsInRegion(
    f.minX - QUEST_FAR_PAD,
    f.maxX + QUEST_FAR_PAD,
    f.minY - QUEST_FAR_PAD,
    f.maxY + QUEST_FAR_PAD,
  )) {
    push(cell.cx, cell.cy);
  }
  return cells;
}

/**
 * A furnished building in a city other than Birchport.
 * Any type qualifies once the interior actually has searchable furniture.
 * `standingTiles` is for the missing-caravan body, which needs open floor.
 */
function isBlockedOrigin(
  bld: BuildingInfo,
  blocked?: readonly { ox: number; oy: number }[],
): boolean {
  if (!blocked || blocked.length === 0) return false;
  return blocked.some((b) => b.ox === bld.ox && b.oy === bld.oy);
}

export function pickOtherCityBuilding(
  exclude?: QuestTargetExclude,
  needs?: {
    standingTiles?: number;
    blocked?: readonly { ox: number; oy: number }[];
  },
): BuildingInfo | null {
  const needTiles = needs?.standingTiles ?? 0;
  const fits = (bld: BuildingInfo) => {
    if (isBlockedOrigin(bld, needs?.blocked)) return false;
    const fit = interiorQuestFit(bld.ox, bld.oy);
    if (fit.lootFurniture < 1) return false;
    if (needTiles > 0 && fit.standingTiles < needTiles) return false;
    return true;
  };
  const pool: BuildingInfo[] = [];
  const seen = new Set<string>();
  for (const city of otherCityCells()) {
    for (const bld of buildingsInCityCell(city.cx, city.cy, exclude)) {
      const key = `${bld.ox},${bld.oy}`;
      if (seen.has(key)) continue;
      seen.add(key);
      pool.push(bld);
    }
  }
  const picked = pickFirstThatFits(pool, fits, pool.length);
  if (picked) return picked;
  const far = buildingsAroundBirchport(QUEST_FAR_PAD).filter(
    (bld) => isOtherCityBuilding(bld) && notExcluded(bld, exclude),
  );
  return pickFirstThatFits(far, fits, far.length);
}

function departmentStoresInCity(
  cx: number,
  cy: number,
  blocked?: readonly { ox: number; oy: number }[],
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
      bld.buildingType === "large_retail" &&
      !isBuildingInBirchport(bld.ox, bld.oy) &&
      !isBlockedOrigin(bld, blocked),
  );
}

/**
 * Department store outside Birchport with enough shelves and clothing racks
 * for Kevin's floor count. Nearby cities are included when the near ring is empty.
 */
export function pickFloorModelStore(
  blocked?: readonly { ox: number; oy: number }[],
): BuildingInfo | null {
  const fits = (bld: BuildingInfo) => {
    if (isBlockedOrigin(bld, blocked)) return false;
    const fit = interiorQuestFit(bld.ox, bld.oy);
    return fit.shelves >= 4 && fit.racks >= 2;
  };
  const near = pickOutsideBirchport("large_retail", undefined, fits);
  if (near) return near;

  const hub = birchportCityCell();
  if (!hub) return null;
  const pool: BuildingInfo[] = [];
  const seen = new Set<string>();
  for (const city of getCityRoadLinks(hub.cx, hub.cy)) {
    for (const bld of departmentStoresInCity(city.cx, city.cy, blocked)) {
      const key = `${bld.ox},${bld.oy}`;
      if (seen.has(key)) continue;
      seen.add(key);
      pool.push(bld);
    }
  }
  return pickFirstThatFits(pool, fits, 24);
}

/**
 * Department store in a city other than Birchport whose manager's office
 * has a desk, cabinet, or bookshelf that can hold the supply list.
 */
export function pickSupplyListStore(
  blocked?: readonly { ox: number; oy: number }[],
): BuildingInfo | null {
  const fits = (bld: BuildingInfo) => {
    if (bld.buildingType !== "large_retail") return false;
    if (isBlockedOrigin(bld, blocked)) return false;
    return interiorQuestFit(bld.ox, bld.oy).managerStash >= 1;
  };
  const pool: BuildingInfo[] = [];
  const seen = new Set<string>();
  for (const city of otherCityCells()) {
    for (const bld of departmentStoresInCity(city.cx, city.cy, blocked)) {
      const key = `${bld.ox},${bld.oy}`;
      if (seen.has(key)) continue;
      seen.add(key);
      pool.push(bld);
    }
  }
  const picked = pickFirstThatFits(pool, fits, pool.length);
  if (picked) return picked;
  const far = buildingsAroundBirchport(QUEST_FAR_PAD).filter(
    (bld) =>
      bld.buildingType === "large_retail" &&
      isOtherCityBuilding(bld) &&
      !isBlockedOrigin(bld, blocked),
  );
  return pickFirstThatFits(far, fits, far.length);
}

/** Cities other than Birchport, road links first, then any city in the far ring. */
function citiesBeyondBirchport(): { cx: number; cy: number }[] {
  const hub = birchportCityCell();
  const cells: { cx: number; cy: number }[] = [];
  const seen = new Set<string>();
  const push = (cx: number, cy: number) => {
    if (hub && cx === hub.cx && cy === hub.cy) return;
    if (getSettlementType(cx, cy) !== "city") return;
    const key = `${cx},${cy}`;
    if (seen.has(key)) return;
    seen.add(key);
    cells.push({ cx, cy });
  };
  if (hub) {
    for (const city of getCityRoadLinks(hub.cx, hub.cy)) push(city.cx, city.cy);
  }
  const f = getPlayerSpawnFootprint();
  for (const cell of settlementCellsInRegion(
    f.minX - QUEST_FAR_PAD,
    f.maxX + QUEST_FAR_PAD,
    f.minY - QUEST_FAR_PAD,
    f.maxY + QUEST_FAR_PAD,
  )) {
    push(cell.cx, cell.cy);
  }
  return cells;
}

function buildingsOfTypeInCity(
  cx: number,
  cy: number,
  type: BuildingInfo["buildingType"],
  blocked?: readonly { ox: number; oy: number }[],
): BuildingInfo[] {
  return buildingsInCityCell(cx, cy).filter(
    (bld) =>
      bld.buildingType === type &&
      !isAshenTraderWarehouse(bld.ox, bld.oy) &&
      !isBlockedOrigin(bld, blocked),
  );
}

function sameSettlement(a: BuildingInfo, b: BuildingInfo): boolean {
  const ax = Math.floor((a.ox + a.w / 2) / SETTLEMENT_CELL_SIZE);
  const ay = Math.floor((a.oy + a.h / 2) / SETTLEMENT_CELL_SIZE);
  const bx = Math.floor((b.ox + b.w / 2) / SETTLEMENT_CELL_SIZE);
  const by = Math.floor((b.oy + b.h / 2) / SETTLEMENT_CELL_SIZE);
  return ax === bx && ay === by;
}

function shuffleCells(
  cells: readonly { cx: number; cy: number }[],
): { cx: number; cy: number }[] {
  const order = cells.slice();
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = order[i]!;
    order[i] = order[j]!;
    order[j] = tmp;
  }
  return order;
}

/** Police station in a city other than Birchport, with room for walkers. */
export function pickSeizedPoliceStation(
  blocked?: readonly { ox: number; oy: number }[],
): BuildingInfo | null {
  const fits = (bld: BuildingInfo) => {
    if (isBlockedOrigin(bld, blocked)) return false;
    return interiorQuestFit(bld.ox, bld.oy).standingTiles >= 2;
  };
  const pool: BuildingInfo[] = [];
  const seen = new Set<string>();
  for (const city of citiesBeyondBirchport()) {
    for (const bld of buildingsOfTypeInCity(
      city.cx,
      city.cy,
      "police_station",
      blocked,
    )) {
      const key = `${bld.ox},${bld.oy}`;
      if (seen.has(key)) continue;
      seen.add(key);
      pool.push(bld);
    }
  }
  return pickFirstThatFits(pool, fits, 24);
}

export type BothEndsSites = {
  warehouse: BuildingInfo;
  market: BuildingInfo;
};

/**
 * A warehouse in one other city and a supermarket with three shelves in a
 * different city. Birchport is never either stop.
 */
export function pickBothEndsSites(
  blocked?: readonly { ox: number; oy: number }[],
): BothEndsSites | null {
  const cities = shuffleCells(citiesBeyondBirchport());
  const marketFits = (bld: BuildingInfo) => {
    if (isBlockedOrigin(bld, blocked)) return false;
    return interiorQuestFit(bld.ox, bld.oy).shelves >= 3;
  };
  for (let i = 0; i < cities.length; i++) {
    const warehouseCity = cities[i]!;
    const warehouse = pickFirstThatFits(
      buildingsOfTypeInCity(
        warehouseCity.cx,
        warehouseCity.cy,
        "warehouse",
        blocked,
      ),
      (bld) =>
        !isBlockedOrigin(bld, blocked) &&
        interiorQuestFit(bld.ox, bld.oy).standingTiles >= 2,
      8,
    );
    if (!warehouse) continue;
    for (let j = 0; j < cities.length; j++) {
      if (i === j) continue;
      const marketCity = cities[j]!;
      const market = pickFirstThatFits(
        buildingsOfTypeInCity(
          marketCity.cx,
          marketCity.cy,
          "supermarket",
          blocked,
        ),
        (bld) => marketFits(bld) && !sameSettlement(bld, warehouse),
        8,
      );
      if (market) return { warehouse, market };
    }
  }
  return null;
}
