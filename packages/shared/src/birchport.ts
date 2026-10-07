/**
 * Birchport hub helpers — spawn hospital, footprint checks, militia tagging.
 */

import {
  BIRCHPORT_BARRACKS_BOUNDS,
  isBirchportBarracksMessHall,
  isInBirchportBarracks,
} from "./birchportBarracks.js";
import {
  buildingEntranceFace,
  buildingEntranceSpan,
  buildingEntranceTiles,
  cityStreetPatrolRoutes,
  getBuildingAt,
  getPlayerSpawnFootprint,
  getStreetTileType,
  isWalkableTile,
  isWallTile,
  type ArterialPatrolRouteInfo,
  type BuildingInfo,
} from "./worldgen.js";

/** Forced city cell for Birchport (must match worldgen). */
export const BIRCHPORT_CELL_CX = -192;
export const BIRCHPORT_CELL_CY = 96;

/** Shared Colyseus groupId for all Birchport Ashen militia (street + hospital). */
export const BIRCHPORT_ASHEN_GROUP_ID = "ashen:birchport";

/** Street militia pairs — each covers a different N–S strip of the city. */
export const BIRCHPORT_STREET_PATROL_SECTIONS = 5;

const STREET_SAMPLE_STEP = 4;

function densifyAxis(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  step = STREET_SAMPLE_STEP,
): { x: number; y: number }[] {
  const dx = bx - ax;
  const dy = by - ay;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.25) return [{ x: bx, y: by }];
  const pts: { x: number; y: number }[] = [];
  const n = Math.max(1, Math.ceil(dist / step));
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    pts.push({ x: ax + dx * t, y: ay + dy * t });
  }
  return pts;
}

function appendUnique(
  tour: { x: number; y: number }[],
  pts: { x: number; y: number }[],
): void {
  for (const p of pts) {
    const last = tour[tour.length - 1];
    if (!last || Math.hypot(last.x - p.x, last.y - p.y) > 0.35) {
      tour.push(p);
    }
  }
}

/** Horizontal run exactly between two vertical street centrelines (intersection to intersection). */
function hRunBetweenVs(
  y: number,
  leftX: number,
  rightX: number,
): { x: number; y: number }[] {
  const lo = Math.min(leftX, rightX);
  const hi = Math.max(leftX, rightX);
  const pts: { x: number; y: number }[] = [{ x: lo, y }];
  for (let x = lo + STREET_SAMPLE_STEP; x < hi - 0.1; x += STREET_SAMPLE_STEP) {
    pts.push({ x, y });
  }
  if (Math.abs(pts[pts.length - 1]!.x - hi) > 0.1) pts.push({ x: hi, y });
  return pts;
}

/** Vertical run along a street centreline between two Y values. */
function vRunAlong(
  x: number,
  yFrom: number,
  yTo: number,
): { x: number; y: number }[] {
  return densifyAxis(x, yFrom, x, yTo);
}

/** V streets that actually meet this H band (asphalt at the crossing). */
function vsCrossingBand(
  sectionVs: ArterialPatrolRouteInfo[],
  band: { y: number; minX: number; maxX: number },
): ArterialPatrolRouteInfo[] {
  return sectionVs.filter((v) => {
    if (v.ax < band.minX - 0.6 || v.ax > band.maxX + 0.6) return false;
    return getStreetTileType(Math.floor(v.ax), Math.floor(band.y)) != null;
  });
}

function keepStreetWaypoints(
  pts: { x: number; y: number }[],
): { x: number; y: number }[] {
  return pts.filter(
    (p) => getStreetTileType(Math.floor(p.x), Math.floor(p.y)) != null,
  );
}

function routeFromWaypoints(
  routeKey: string,
  waypoints: { x: number; y: number }[],
): ArterialPatrolRouteInfo | null {
  if (waypoints.length < 2) return null;
  const first = waypoints[0]!;
  const end = waypoints[waypoints.length - 1]!;
  let minX = first.x;
  let maxX = first.x;
  let minY = first.y;
  let maxY = first.y;
  for (const w of waypoints) {
    minX = Math.min(minX, w.x);
    maxX = Math.max(maxX, w.x);
    minY = Math.min(minY, w.y);
    maxY = Math.max(maxY, w.y);
  }
  return {
    routeKey,
    ax: first.x,
    ay: first.y,
    bx: end.x,
    by: end.y,
    minX,
    maxX,
    minY,
    maxY,
    waypoints,
  };
}

/**
 * Five street-only patrol routes covering Birchport.
 * Each section lawnmowers east–west along horizontal streets between its
 * vertical street(s), turning only at intersections — never through lots.
 */
export function birchportStreetCoverageRoutes(): ArterialPatrolRouteInfo[] {
  const streets = cityStreetPatrolRoutes(BIRCHPORT_CELL_CX, BIRCHPORT_CELL_CY);
  if (streets.length === 0) return [];

  const vRoutes = streets
    .filter((r) => r.routeKey.includes(":v:"))
    .sort((a, b) => a.ax - b.ax);
  const hRoutes = streets
    .filter((r) => r.routeKey.includes(":h:"))
    .sort((a, b) => a.ay - b.ay);

  const sections = BIRCHPORT_STREET_PATROL_SECTIONS;
  const nV = vRoutes.length;
  const vPerSection: number[][] = Array.from({ length: sections }, () => []);
  for (let i = 0; i < nV; i++) {
    const s = Math.min(sections - 1, Math.floor((i * sections) / nV));
    vPerSection[s]!.push(i);
  }

  const routes: ArterialPatrolRouteInfo[] = [];
  for (let s = 0; s < sections; s++) {
    const idxs = vPerSection[s]!;
    if (idxs.length === 0) continue;

    const sectionVs = idxs.map((i) => vRoutes[i]!);
    const leftX = Math.min(...sectionVs.map((v) => v.ax));
    const rightX = Math.max(...sectionVs.map((v) => v.ax));

    // Single vertical street — patrol it north↔south (still on the road).
    if (Math.abs(rightX - leftX) < 0.5) {
      const v = sectionVs[0]!;
      const tour = keepStreetWaypoints(v.waypoints.map((w) => ({ x: w.x, y: w.y })));
      const route = routeFromWaypoints(`birchport-cover:${s}`, tour);
      if (route) routes.push(route);
      continue;
    }

    // H streets that actually meet a V in this strip (not just bbox-overlap).
    // Western V streets often start further north than the southern H roads,
    // so a raw leftX→rightX run at that Y walks across grass lots.
    const hBands: { y: number; minX: number; maxX: number }[] = [];
    for (const h of hRoutes) {
      if (h.maxX < leftX || h.minX > rightX) continue;
      const y = h.ay;
      if (hBands.some((b) => Math.abs(b.y - y) < 0.5)) continue;
      hBands.push({ y, minX: h.minX, maxX: h.maxX });
    }
    hBands.sort((a, b) => a.y - b.y);
    const liveBands = hBands.filter((b) => vsCrossingBand(sectionVs, b).length > 0);
    if (liveBands.length === 0) {
      // No crossing H streets — patrol the longest V in the section.
      const v = sectionVs.reduce((a, b) =>
        a.waypoints.length >= b.waypoints.length ? a : b,
      );
      const tour = keepStreetWaypoints(v.waypoints.map((w) => ({ x: w.x, y: w.y })));
      const route = routeFromWaypoints(`birchport-cover:${s}`, tour);
      if (route) routes.push(route);
      continue;
    }

    const tour: { x: number; y: number }[] = [];
    for (let i = 0; i < liveBands.length; i++) {
      const band = liveBands[i]!;
      const present = vsCrossingBand(sectionVs, band);
      const runLeft = Math.min(...present.map((v) => v.ax));
      const runRight = Math.max(...present.map((v) => v.ax));
      let run =
        Math.abs(runRight - runLeft) < 0.5
          ? [{ x: runLeft, y: band.y }]
          : hRunBetweenVs(band.y, runLeft, runRight);
      // Alternate direction so the connector is always the east or west V.
      if (i % 2 === 1) run = [...run].reverse();

      if (tour.length > 0) {
        const last = tour[tour.length - 1]!;
        const next = run[0]!;
        // Both ends sit on the same V centreline (left or right) — walk that V.
        if (Math.abs(last.x - next.x) < 0.5) {
          appendUnique(tour, vRunAlong(last.x, last.y, next.y));
        } else {
          // Shouldn't happen with alternating ends; recover via L on streets:
          // along current H to the V under next, then down/up that V.
          appendUnique(tour, densifyAxis(last.x, last.y, next.x, last.y));
          appendUnique(tour, vRunAlong(next.x, last.y, next.y));
        }
      }
      appendUnique(tour, run);
    }

    const route = routeFromWaypoints(
      `birchport-cover:${s}`,
      keepStreetWaypoints(tour),
    );
    if (route) routes.push(route);
  }

  return routes;
}

/** True when world coords sit inside the Birchport city footprint. */
export function isInBirchport(x: number, y: number): boolean {
  const f = getPlayerSpawnFootprint();
  return x >= f.minX && x <= f.maxX && y >= f.minY && y <= f.maxY;
}

/** True when a building origin is the Birchport hospital landmark. */
export function isBirchportHospital(bx: number, by: number): boolean {
  const bld = getBuildingAt(bx, by);
  if (!bld || bld.buildingType !== "hospital") return false;
  return isInBirchport(bld.ox + bld.w / 2, bld.oy + bld.h / 2);
}

/** True when a building sits inside the Birchport footprint (any type). */
export function isBuildingInBirchport(bx: number, by: number): boolean {
  const bld = getBuildingAt(bx, by);
  if (!bld) return false;
  return isInBirchport(bld.ox + bld.w / 2, bld.oy + bld.h / 2);
}

/**
 * Player is on Birchport streets or inside any Birchport building
 * (used for militia PvP hostility).
 */
export function isPlayerInBirchport(opts: {
  inInterior: boolean;
  buildingX: number;
  buildingY: number;
  x: number;
  y: number;
}): boolean {
  if (opts.inInterior) {
    return isBuildingInBirchport(opts.buildingX, opts.buildingY);
  }
  return isInBirchport(opts.x, opts.y);
}

export const BIRCHPORT_WEAPON_EQUIP_DENIED =
  "You are not allowed to equip weapons here";

export type BirchportSafezoneRect = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

function rectContains(
  outer: BirchportSafezoneRect,
  inner: BirchportSafezoneRect,
): boolean {
  return (
    inner.minX >= outer.minX &&
    inner.maxX <= outer.maxX &&
    inner.minY >= outer.minY &&
    inner.maxY <= outer.maxY
  );
}

/**
 * World-space boxes where exterior weapon equip is blocked.
 * The city footprint uses the same edges as {@link isInBirchport}.
 * The barracks yard is included when it sticks outside that box.
 */
export function birchportSafezoneRects(): BirchportSafezoneRect[] {
  const f = getPlayerSpawnFootprint();
  const city: BirchportSafezoneRect = {
    minX: f.minX,
    minY: f.minY,
    maxX: f.maxX,
    maxY: f.maxY,
  };
  const yard: BirchportSafezoneRect = {
    minX: BIRCHPORT_BARRACKS_BOUNDS.minX,
    minY: BIRCHPORT_BARRACKS_BOUNDS.minY,
    maxX: BIRCHPORT_BARRACKS_BOUNDS.maxX + 1,
    maxY: BIRCHPORT_BARRACKS_BOUNDS.maxY + 1,
  };
  if (rectContains(city, yard)) return [city];
  if (rectContains(yard, city)) return [yard];
  return [city, yard];
}

/**
 * Streets and the barracks yard, plus the hospital, military tents, mess hall,
 * and the Birchport Ashen market. Other Birchport interiors stay armed.
 */
export function isBirchportWeaponEquipRestricted(opts: {
  inInterior: boolean;
  buildingX: number;
  buildingY: number;
  x: number;
  y: number;
}): boolean {
  if (!opts.inInterior) {
    return (
      isInBirchport(opts.x, opts.y) ||
      isInBirchportBarracks(Math.floor(opts.x), Math.floor(opts.y))
    );
  }
  if (isAshenTraderWarehouse(opts.buildingX, opts.buildingY)) return true;
  if (isBirchportHospital(opts.buildingX, opts.buildingY)) return true;
  const bld = getBuildingAt(opts.buildingX, opts.buildingY);
  if (!bld) return false;
  if (
    bld.buildingType === "mess_hall" &&
    isBirchportBarracksMessHall(bld.ox, bld.oy)
  ) {
    return true;
  }
  if (bld.buildingType === "tent" && isInBirchportBarracks(bld.ox, bld.oy)) {
    return true;
  }
  return false;
}

/**
 * Locate the Birchport hospital building by scanning the hub footprint.
 * Returns null if worldgen has not placed one (should not happen for hub city).
 */
export function findBirchportHospital(): BuildingInfo | null {
  const f = getPlayerSpawnFootprint();
  const seen = new Set<string>();
  for (let ty = f.minY; ty <= f.maxY; ty += 2) {
    for (let tx = f.minX; tx <= f.maxX; tx += 2) {
      const bld = getBuildingAt(tx, ty);
      if (!bld || bld.buildingType !== "hospital") continue;
      const key = `${bld.ox},${bld.oy}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (isInBirchport(bld.ox + bld.w / 2, bld.oy + bld.h / 2)) {
        return bld;
      }
    }
  }
  const cx = Math.floor((f.minX + f.maxX) / 2);
  const cy = Math.floor((f.minY + f.maxY) / 2);
  for (let r = 0; r < 80; r += 2) {
    for (let dy = -r; dy <= r; dy += 2) {
      for (let dx = -r; dx <= r; dx += 2) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const bld = getBuildingAt(cx + dx, cy + dy);
        if (bld?.buildingType === "hospital") return bld;
      }
    }
  }
  return null;
}

let ashenTraderWarehouseOrigin: { ox: number; oy: number } | null | undefined;

/** True when a guard can stand on an interior tile to either side of the door. */
function warehouseEntranceHasBothFlanks(bld: BuildingInfo): boolean {
  const span = buildingEntranceSpan(bld);
  const iW = bld.w * 2;
  const iH = bld.h * 2;
  if (buildingEntranceFace(bld) === "SE") {
    const alongMin = Math.max(0, (bld.entranceY - bld.oy) * 2);
    const alongMax = Math.min(iH - 1, (bld.entranceY - bld.oy + span) * 2 - 1);
    return alongMin > 0 && alongMax < iH - 1;
  }
  const alongMin = Math.max(0, (bld.entranceX - bld.ox) * 2);
  const alongMax = Math.min(iW - 1, (bld.entranceX - bld.ox + span) * 2 - 1);
  return alongMin > 0 && alongMax < iW - 1;
}

/**
 * The Birchport warehouse converted into the Ashen trader market.
 * Prefer a door with room for a guard on both sides, then the westernmost.
 */
export function findAshenTraderWarehouse(): { ox: number; oy: number } | null {
  if (ashenTraderWarehouseOrigin !== undefined) return ashenTraderWarehouseOrigin;
  const f = getPlayerSpawnFootprint();
  const seen = new Set<string>();
  const found: BuildingInfo[] = [];
  for (let ty = f.minY; ty <= f.maxY; ty += 2) {
    for (let tx = f.minX; tx <= f.maxX; tx += 2) {
      const bld = getBuildingAt(tx, ty);
      if (!bld || bld.buildingType !== "warehouse") continue;
      const key = `${bld.ox},${bld.oy}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (!isInBirchport(bld.ox + bld.w / 2, bld.oy + bld.h / 2)) continue;
      found.push(bld);
    }
  }
  const flanked = found.filter(warehouseEntranceHasBothFlanks);
  const pool = flanked.length > 0 ? flanked : found;
  let best: BuildingInfo | null = null;
  for (const bld of pool) {
    if (
      !best ||
      bld.ox < best.ox ||
      (bld.ox === best.ox && bld.oy < best.oy)
    ) {
      best = bld;
    }
  }
  ashenTraderWarehouseOrigin = best ? { ox: best.ox, oy: best.oy } : null;
  return ashenTraderWarehouseOrigin;
}

/** True when this building is the single Birchport Ashen trader warehouse. */
export function isAshenTraderWarehouse(bx: number, by: number): boolean {
  const origin = findAshenTraderWarehouse();
  if (!origin) return false;
  const bld = getBuildingAt(bx, by);
  if (!bld || bld.buildingType !== "warehouse") return false;
  return bld.ox === origin.ox && bld.oy === origin.oy;
}

/** Id prefix for the two trader guards posted outside the market door. */
export const ASHEN_MARKET_DOOR_GUARD_PREFIX = "ashen-market-ext:";

export function isAshenMarketDoorGuardId(id: string): boolean {
  return id.startsWith(ASHEN_MARKET_DOOR_GUARD_PREFIX);
}

export type AshenMarketExteriorPost = {
  idSuffix: "enter0" | "enter1";
  x: number;
  y: number;
  /** Facing out the door, toward people walking up. */
  facing: number;
};

function marketDoorStandOk(tile: { x: number; y: number }): boolean {
  return !isWallTile(tile.x, tile.y) && isWalkableTile(tile.x + 0.5, tile.y + 0.5);
}

/**
 * Two street tiles flanking the market door, one step out from the façade
 * and just past each end of the doorway. Neither post stands in the door.
 */
export function ashenMarketExteriorGuardPosts(
  bld: BuildingInfo,
): AshenMarketExteriorPost[] | null {
  const doors = buildingEntranceTiles(bld);
  if (doors.length === 0) return null;
  const face = buildingEntranceFace(bld);
  const first = doors[0]!;
  const last = doors[doors.length - 1]!;
  const facing = face === "SE" ? 3 : 5;
  const preferred =
    face === "SE"
      ? [
          { x: first.x + 1, y: first.y - 1 },
          { x: last.x + 1, y: last.y + 1 },
        ]
      : [
          { x: first.x - 1, y: first.y + 1 },
          { x: last.x + 1, y: last.y + 1 },
        ];
  const nudge = (tile: { x: number; y: number }) =>
    face === "SE" ? { x: tile.x + 1, y: tile.y } : { x: tile.x, y: tile.y + 1 };
  const resolve = (tile: { x: number; y: number }) => {
    if (marketDoorStandOk(tile)) return tile;
    const alt = nudge(tile);
    return marketDoorStandOk(alt) ? alt : null;
  };
  const a = resolve(preferred[0]!);
  const b = resolve(preferred[1]!);
  if (!a || !b) return null;
  if (a.x === b.x && a.y === b.y) return null;
  return [
    { idSuffix: "enter0", x: a.x, y: a.y, facing },
    { idSuffix: "enter1", x: b.x, y: b.y, facing },
  ];
}

export type BirchportMapPoi = {
  id: "hospital" | "barracks" | "market";
  name: string;
  x: number;
  y: number;
};

/** Map pins for the Birchport hospital, barracks, and trader market. */
export function birchportMapPois(): BirchportMapPoi[] {
  const pois: BirchportMapPoi[] = [];
  const hospital = findBirchportHospital();
  if (hospital) {
    pois.push({
      id: "hospital",
      name: "Hospital",
      x: hospital.ox + hospital.w / 2,
      y: hospital.oy + hospital.h / 2,
    });
  }
  const yard = BIRCHPORT_BARRACKS_BOUNDS;
  pois.push({
    id: "barracks",
    name: "Barracks",
    x: (yard.minX + yard.maxX + 1) / 2,
    y: (yard.minY + yard.maxY + 1) / 2,
  });
  const market = findAshenTraderWarehouse();
  if (market) {
    const bld = getBuildingAt(market.ox, market.oy);
    if (bld) {
      pois.push({
        id: "market",
        name: "Market",
        x: bld.ox + bld.w / 2,
        y: bld.oy + bld.h / 2,
      });
    }
  }
  return pois;
}
