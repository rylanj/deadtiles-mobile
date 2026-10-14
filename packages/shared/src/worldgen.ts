import {
  REGION_SIZE,
  cellDistanceToTile,
  regionRange,
} from "./region.js";
import {
  INITIAL_MAP_HEIGHT,
  INITIAL_MAP_WIDTH,
  MAP_SEED_WORD,
  PLAYER_SPAWN_HUB_NAME,
  PLAYER_SPAWN_RADIUS_TILES,
  PLAYER_SPAWN_CLEARANCE_TILES,
  WALL_DEPTH,
  WAREHOUSE_ROOF_PEAK_HEIGHT,
  MOTEL_ROOF_PEAK_HEIGHT,
  MOTEL_PARAPET_HEIGHT,
  DINER_PARAPET_HEIGHT,
  TENT_ROOF_PEAK_HEIGHT,
  HOUSE_CHIMNEY_HEIGHT,
  HOUSE_CHIMNEY_CHANCE_RURAL,
  HOUSE_CHIMNEY_CHANCE_TOWN,
  HOUSE_CHIMNEY_CHANCE_CITY,
  POLICE_ROOF_LIP_HEIGHT,
  POLICE_ROOF_PROP_HEIGHT,
  SUPERMARKET_ROOF_PROP_HEIGHT,
  HOUSE_ROOF_PEAK_HEIGHT,
  STREETLIGHT_SPACING,
  STREETLIGHT_CHANCE,
  STREETLIGHT_END_MARGIN,
} from "./constants.js";
import { generateSettlementName } from "./settlementNames.js";
import {
  BIRCHPORT_CELL_ORIGIN_X,
  BIRCHPORT_CELL_ORIGIN_Y,
  INITIAL_WORLD_BOUNDS,
  getBorderWallAt,
  isInWorldBounds,
  type WorldBounds,
} from "./worldBounds.js";
import {
  birchportBarracksBlocksBuildingPlacement,
  birchportBarracksOverlapsFootprint,
  birchportBarracksPlacementTileKeys,
  BIRCHPORT_BARRACKS_TENTS,
  BIRCHPORT_BARRACKS_MESS_HALL,
  BIRCHPORT_BARRACKS_BOUNDS,
  getBirchportGraveAt,
  isInBirchportBarracks,
  type BarracksTentFootprint,
} from "./birchportBarracks.js";
import { getCellarAt } from "./cellar.js";

/**
 * Tile types.
 * Floor=0 and Wall=1 match the original game.
 * Pavement=2 and Road=3 are street surfaces (walkable).
 * CarPark=4 is a paved empty city lot (walkable, concrete ground).
 * Barracks=5 is the Birchport militia compound yard (walkable, packed gravel).
 */
export const TileType = {
  Floor: 0,
  Wall: 1,
  Pavement: 2,
  Road: 3,
  CarPark: 4,
  Barracks: 5,
} as const;

export type TileType = (typeof TileType)[keyof typeof TileType];

/** xmur3 string hash — same implementation as the original game. */
export function xmur3(str: string) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

/** mulberry32 PRNG — same implementation as the original game. */
export function mulberry32(a: number) {
  return () => {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Settlement & building system ────────────────────────────────────────────
//
// The world is divided into 96×96-tile settlement cells. Each cell is seeded
// independently and assigned a type (none / rural / town / city).
//
// Town and city cells lay out a street network:
//   ┌─────────────────────────────────────────────────┐
//   │  [lot]  [pavement|road×6|pavement]  [lot]  ...  │
//   │  [pave                               ment]       │
//   │  [road × 6  ← vertical street →  road × 6]      │
//   │  [pave                               ment]       │
//   │  [lot]  [pavement|road×6|pavement]  [lot]  ...  │
//   └─────────────────────────────────────────────────┘
//
// Streets are 8 tiles wide: 1 pavement + 6 road + 1 pavement.
// Buildings are placed in the SE corner of each lot (south face adjacent to a
// southern street, east face adjacent to an eastern street), making them
// naturally street-facing and reachable with the W/N entry-facing mechanics.
//
// Streets can be full-length or short (T-junction / dead-end) for a realistic
// branching layout.

/** Concrete (placeable) building types — everything except the untyped shell. */
export type CityBuildingType =
  | "house"
  | "warehouse"
  | "office"
  | "police_station"
  | "supermarket"
  | "large_retail"
  | "hospital"
  | "motel"
  | "gun_shop"
  | "diner"
  | "apartment"
  | "tent"
  | "mess_hall";

export type BuildingType = CityBuildingType | "none";

export type BuildingInfo = {
  ox: number;
  oy: number;
  w: number;
  h: number;
  /** Outer perimeter tile the player walks to when entering this building. */
  entranceX: number;
  entranceY: number;
  /**
   * How many consecutive façade tiles the doorway covers (along the wall).
   * entranceX/Y is the first tile (lowest Y on SE, lowest X on SW).
   */
  entranceSpan: number;
  /**
   * City lot fully built out — large footprints that occupy
   * the whole lot.
   */
  fillsLot: boolean;
  /** Designated use — drives exterior/interior assets and furniture tables. */
  buildingType: BuildingType;
  /** Storeys of exterior cuboid height. */
  exteriorLevels: number;
  /**
   * Exterior footprint tile the chimney sits on (houses only).
   * Maps to an interior wall band for a future fireplace flush.
   */
  chimneyX?: number;
  chimneyY?: number;
  /**
   * Town/city house big enough for a partitioned multi-room interior
   * (bedroom/kitchen/etc, corridor-connected). Rural cabins never set this,
   * even though their footprint size range can overlap the smallest urban
   * houses — this flag (not size) is the source of truth for room layout.
   */
  houseRooms?: boolean;
};

/** Max warehouses spawned in a single city grid. */
export const MAX_WAREHOUSES_PER_CITY = 2;

export type CityZone = "downtown" | "outskirts";

/**
 * Type-first building specs: zone pool, footprint/storey ranges, city-wide
 * caps, relative pick weights and temp roof colors.  City generation picks a
 * type from the zone pool first, then rolls its footprint from the spec.
 */
export type CityBuildingSpec = {
  zone: CityZone;
  minW: number;
  maxW: number;
  minH: number;
  maxH: number;
  /**
   * Long/thin buildings (motel, diner): footprint is short×long and the long
   * axis is rotated to run along the street frontage it is packed against.
   */
  longSide?: { short: number; minLong: number; maxLong: number };
  minLevels: number;
  maxLevels: number;
  /** City-wide cap. Infinity = unlimited (houses). */
  maxPerCity: number;
  /** Relative weight when several types compete for the same frontage slot. */
  weight: number;
  /** Temp flat roof fill (client render). Warehouse keeps its deck+lip look. */
  roofColor: string;
  /** Door must be ≥1 tile from the façade corners (houses, gun shops). */
  doorInsetFromCorners?: boolean;
  /** Door sits on the middle tile of the street-facing wall. */
  doorCentered?: boolean;
  /** Consecutive façade tiles spanned by the doorway (supermarket double doors = 2). */
  doorSpan?: number;
};

export const CITY_BUILDING_SPECS: Record<CityBuildingType, CityBuildingSpec> = {
  office: {
    zone: "downtown", minW: 6, maxW: 10, minH: 8, maxH: 12,
    minLevels: 1, maxLevels: 2, maxPerCity: 3, weight: 3, roofColor: "#e6dfd2",
    doorCentered: true,
  },
  police_station: {
    zone: "downtown", minW: 7, maxW: 7, minH: 7, maxH: 7,
    minLevels: 2, maxLevels: 2, maxPerCity: 1, weight: 1, roofColor: "#4e5156",
    doorCentered: true,
  },
  supermarket: {
    zone: "downtown", minW: 10, maxW: 12, minH: 10, maxH: 12,
    minLevels: 1, maxLevels: 1, maxPerCity: 2, weight: 2, roofColor: "#6b5e4e",
    doorCentered: true, doorSpan: 2,
  },
  large_retail: {
    zone: "downtown", minW: 10, maxW: 12, minH: 10, maxH: 12,
    minLevels: 1, maxLevels: 1, maxPerCity: 2, weight: 2, roofColor: "#8e9399",
    doorCentered: true, doorSpan: 2,
  },
  hospital: {
    zone: "downtown", minW: 8, maxW: 12, minH: 8, maxH: 12,
    // Tower is always 3; wings paint at 2 in the client stepped massing.
    minLevels: 3, maxLevels: 3, maxPerCity: 1, weight: 1, roofColor: "#8e9196",
    doorCentered: true, doorSpan: 2,
  },
  warehouse: {
    zone: "outskirts", minW: 10, maxW: 12, minH: 10, maxH: 12,
    minLevels: 1, maxLevels: 1, maxPerCity: MAX_WAREHOUSES_PER_CITY,
    weight: 1, roofColor: "#6e6e6e",
  },
  house: {
    zone: "outskirts", minW: 4, maxW: 6, minH: 4, maxH: 6,
    minLevels: 1, maxLevels: 1, maxPerCity: Infinity, weight: 6,
    roofColor: "#554840", doorInsetFromCorners: true,
  },
  motel: {
    zone: "outskirts", minW: 4, maxW: 11, minH: 4, maxH: 11,
    longSide: { short: 4, minLong: 11, maxLong: 11 },
    minLevels: 1, maxLevels: 1, maxPerCity: 2, weight: 1, roofColor: "#5c4a3e",
    // End tiles stay empty. The roof sign is wider than the door.
  },
  gun_shop: {
    zone: "outskirts", minW: 4, maxW: 6, minH: 4, maxH: 6,
    minLevels: 1, maxLevels: 1, maxPerCity: 1, weight: 1, roofColor: "#7a7266",
    doorInsetFromCorners: true,
  },
  diner: {
    zone: "outskirts", minW: 4, maxW: 12, minH: 4, maxH: 12,
    longSide: { short: 4, minLong: 8, maxLong: 12 },
    minLevels: 1, maxLevels: 1, maxPerCity: 2, weight: 1, roofColor: "#8a847c",
  },
  apartment: {
    zone: "outskirts", minW: 5, maxW: 8, minH: 5, maxH: 8,
    minLevels: 2, maxLevels: 4, maxPerCity: 3, weight: 2, roofColor: "#575a5e",
    doorCentered: true,
  },
  tent: {
    zone: "outskirts", minW: 6, maxW: 6, minH: 4, maxH: 4,
    minLevels: 1, maxLevels: 1, maxPerCity: 0, weight: 0, roofColor: "#3d4c2a",
    doorCentered: true, doorSpan: 2,
  },
  mess_hall: {
    zone: "outskirts", minW: 8, maxW: 8, minH: 7, maxH: 7,
    minLevels: 1, maxLevels: 1, maxPerCity: 0, weight: 0, roofColor: "#4a4034",
    doorCentered: true, doorSpan: 1,
  },
};

export function isWarehouseBuilding(
  bld: Pick<BuildingInfo, "buildingType"> | null | undefined,
): boolean {
  return bld?.buildingType === "warehouse";
}

/** Storeys of exterior cuboid height (from generation; defaults to 1). */
export function buildingExteriorLevels(
  bld?: { exteriorLevels?: number } | null,
): number {
  return bld?.exteriorLevels ?? 1;
}

/** Screen-space wall extrusion for a building's exterior cuboid (storeys only). */
export function buildingWallScreenDepth(
  bld: { buildingType?: BuildingType; exteriorLevels?: number } | null | undefined,
): number {
  return WALL_DEPTH * buildingExteriorLevels(bld);
}

/**
 * Full cuboid height including roof extras — used for occlusion masks so
 * the player outline covers parapets / house gables, not just wall storeys.
 */
export function buildingCuboidScreenDepth(
  bld: { buildingType?: BuildingType; exteriorLevels?: number } | null | undefined,
): number {
  const extra =
    bld?.buildingType === "warehouse"
      ? WAREHOUSE_ROOF_PEAK_HEIGHT
      : bld?.buildingType === "motel"
        ? MOTEL_PARAPET_HEIGHT
        : bld?.buildingType === "diner"
          ? DINER_PARAPET_HEIGHT
        : bld?.buildingType === "tent"
          ? TENT_ROOF_PEAK_HEIGHT
        : bld?.buildingType === "mess_hall"
          ? MOTEL_ROOF_PEAK_HEIGHT
          : bld?.buildingType === "police_station" ||
              bld?.buildingType === "apartment" ||
              bld?.buildingType === "gun_shop"
          ? POLICE_ROOF_LIP_HEIGHT + POLICE_ROOF_PROP_HEIGHT
          : bld?.buildingType === "supermarket"
            ? POLICE_ROOF_LIP_HEIGHT + SUPERMARKET_ROOF_PROP_HEIGHT
            : bld?.buildingType === "large_retail"
              ? POLICE_ROOF_LIP_HEIGHT + Math.round(SUPERMARKET_ROOF_PROP_HEIGHT * 0.75)
              : bld?.buildingType === "office"
                ? POLICE_ROOF_LIP_HEIGHT +
                  (buildingExteriorLevels(bld) >= 2 ? POLICE_ROOF_PROP_HEIGHT : 0)
                : bld?.buildingType === "hospital"
              ? POLICE_ROOF_LIP_HEIGHT
              : bld?.buildingType === "house"
                ? HOUSE_ROOF_PEAK_HEIGHT + HOUSE_CHIMNEY_HEIGHT
                : 0;
  return buildingWallScreenDepth(bld) + extra;
}

/** Iso-facing wooden fence panel (matches Fence/WoodenFence_*.png). */
export type FenceFacing = "NE" | "NW" | "SE" | "SW";

export type FenceInfo = {
  ox: number;
  oy: number;
  facing: FenceFacing;
};

/** Chance a rural homestead gets a partial yard ring. */
const RURAL_FENCE_CHANCE = 0.48;
/** Yard padding around rural buildings (tiles). Leaves 1 empty tile to the wall. */
const RURAL_FENCE_PAD = 2;

/** Approach tiles outside the entrance on its visible face (SE=east, SW=south). */
export function buildingEntranceFace(
  bld: Pick<BuildingInfo, "ox" | "oy" | "w" | "h" | "entranceX" | "entranceY">,
): "SE" | "SW" {
  // East perimeter → SE face; otherwise south perimeter → SW face.
  if (bld.entranceX === bld.ox + bld.w - 1) return "SE";
  return "SW";
}

/** Doorway width in façade tiles. Department stores are always 2 tiles. */
export function buildingEntranceSpan(
  bld: { entranceSpan?: number; buildingType?: BuildingType } | null | undefined,
): number {
  const span = Math.max(1, bld?.entranceSpan ?? 1);
  if (bld?.buildingType === "large_retail") return Math.max(2, span);
  return span;
}

type EntranceRunBuilding = {
  ox: number;
  oy: number;
  w: number;
  h: number;
  entranceX: number;
  entranceY: number;
  entranceSpan?: number;
  buildingType?: BuildingType;
};

/**
 * Doorway start tile and span, shifted back when a wider door would hang
 * off the end of the façade.
 */
export function buildingEntranceRun(bld: EntranceRunBuilding): {
  x: number;
  y: number;
  span: number;
  face: "SE" | "SW";
} {
  const face = buildingEntranceFace(bld);
  let span = buildingEntranceSpan(bld);
  const faceLen = face === "SE" ? bld.h : bld.w;
  if (span > faceLen) span = Math.max(1, faceLen);
  let x = bld.entranceX;
  let y = bld.entranceY;
  if (face === "SE") {
    const maxStart = bld.oy + bld.h - span;
    if (y > maxStart) y = maxStart;
  } else {
    const maxStart = bld.ox + bld.w - span;
    if (x > maxStart) x = maxStart;
  }
  return { x, y, span, face };
}

/** All perimeter tiles covered by the doorway, ordered along the face. */
export function buildingEntranceTiles(
  bld: EntranceRunBuilding,
): { x: number; y: number }[] {
  const run = buildingEntranceRun(bld);
  const tiles: { x: number; y: number }[] = [];
  for (let i = 0; i < run.span; i++) {
    if (run.face === "SE") {
      tiles.push({ x: run.x, y: run.y + i });
    } else {
      tiles.push({ x: run.x + i, y: run.y });
    }
  }
  return tiles;
}

/**
 * Pick an exterior perimeter tile for a house chimney — north or west face
 * (never the SE/SW door wall), inset from corners when the footprint allows.
 * Shared by exterior render and the interior mantel, which spans the same tile.
 */
export function pickHouseChimneyTile(
  ox: number,
  oy: number,
  w: number,
  h: number,
  rng: () => number,
): { chimneyX: number; chimneyY: number } {
  const northInset: { x: number; y: number }[] = [];
  const northAll: { x: number; y: number }[] = [];
  for (let lx = 0; lx < w; lx++) {
    const t = { x: ox + lx, y: oy };
    northAll.push(t);
    if (w < 3 || (lx > 0 && lx < w - 1)) northInset.push(t);
  }

  const westInset: { x: number; y: number }[] = [];
  const westAll: { x: number; y: number }[] = [];
  for (let ly = 0; ly < h; ly++) {
    const t = { x: ox, y: oy + ly };
    westAll.push(t);
    if (h < 3 || (ly > 0 && ly < h - 1)) westInset.push(t);
  }

  const preferNorth = rng() < 0.7;
  const primary = preferNorth
    ? (northInset.length > 0 ? northInset : northAll)
    : (westInset.length > 0 ? westInset : westAll);
  const fallback = preferNorth
    ? (westInset.length > 0 ? westInset : westAll)
    : (northInset.length > 0 ? northInset : northAll);
  const pool = primary.length > 0 ? primary : fallback;
  const pick = pool[Math.floor(rng() * pool.length)] ?? { x: ox, y: oy };
  return { chimneyX: pick.x, chimneyY: pick.y };
}

/**
 * Interior wall band that backs a house chimney. Mantel1 spans these tiles.
 * North exterior → NE wall (`y = 0`); west exterior → NW wall (`x = 0`).
 */
export function houseChimneyInteriorTiles(
  bld: Pick<BuildingInfo, "ox" | "oy" | "w" | "h" | "chimneyX" | "chimneyY">,
): { wall: "NW" | "NE"; tiles: { x: number; y: number }[] } | null {
  if (bld.chimneyX == null || bld.chimneyY == null) return null;
  const lx = bld.chimneyX - bld.ox;
  const ly = bld.chimneyY - bld.oy;
  if (lx < 0 || ly < 0 || lx >= bld.w || ly >= bld.h) return null;

  if (bld.chimneyY === bld.oy) {
    // North exterior face → NE interior wall (y = 0).
    return {
      wall: "NE",
      tiles: [
        { x: lx * 2, y: 0 },
        { x: lx * 2 + 1, y: 0 },
      ],
    };
  }
  if (bld.chimneyX === bld.ox) {
    // West exterior face → NW interior wall (x = 0).
    return {
      wall: "NW",
      tiles: [
        { x: 0, y: ly * 2 },
        { x: 0, y: ly * 2 + 1 },
      ],
    };
  }
  return null;
}

/** Walkable tiles just outside the entrance wall (player paths here to enter). */
export function buildingEntryApproachCandidates(
  bld: Pick<BuildingInfo, "ox" | "oy" | "w" | "h" | "entranceX" | "entranceY" | "entranceSpan">,
): { x: number; y: number }[] {
  const face = buildingEntranceFace(bld);
  const seen = new Set<string>();
  const out: { x: number; y: number }[] = [];
  const push = (x: number, y: number) => {
    const key = `${x},${y}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ x, y });
  };

  for (const { x: ex, y: ey } of buildingEntranceTiles(bld)) {
    if (face === "SE") {
      push(ex + 1, ey);
      push(ex + 1, ey + 1);
      push(ex + 1, ey - 1);
    } else {
      push(ex, ey + 1);
      push(ex + 1, ey + 1);
      push(ex - 1, ey + 1);
    }
  }
  return out;
}

/** World position on the walkable tile outside the entrance (where entry paths start). */
export function buildingExitApproachWorldPos(bld: BuildingInfo): { x: number; y: number } {
  const { entranceX: ex, entranceY: ey } = bld;

  for (const c of buildingEntryApproachCandidates(bld)) {
    if (!isWallTile(c.x, c.y)) {
      return { x: c.x + 0.5, y: c.y + 0.5 };
    }
  }

  const ortho =
    buildingEntranceFace(bld) === "SE"
      ? [
          { x: ex + 1, y: ey },
          { x: ex, y: ey + 1 },
          { x: ex, y: ey - 1 },
        ]
      : [
          { x: ex, y: ey + 1 },
          { x: ex + 1, y: ey },
          { x: ex - 1, y: ey },
        ];
  for (const c of ortho) {
    if (!tileInBuildingFootprint(c.x, c.y, bld) && !isWallTile(c.x, c.y)) {
      return { x: c.x + 0.5, y: c.y + 0.5 };
    }
  }

  if (buildingEntranceFace(bld) === "SE") {
    return { x: ex + 1.5, y: ey + 0.5 };
  }
  return { x: ex + 0.5, y: ey + 1.5 };
}

export function isBuildingEntranceTile(tx: number, ty: number, bld: BuildingInfo): boolean {
  return buildingEntranceTiles(bld).some((t) => t.x === tx && t.y === ty);
}

/**
 * How far out from a doorway the keep-clear apron reaches. Depth 1 is the tile
 * the player steps on to enter; depth 2 stops a wall being parked just past it.
 */
export const BUILDING_ENTRANCE_CLEARANCE_DEPTH = 2;

/**
 * True for the doorway tiles and the apron directly outside them. Nothing may
 * be built here or one wall would lock everyone out of the building.
 *
 * The apron widens by one tile to each side past the façade, because entities
 * move diagonally and would otherwise squeeze around a single blocking tile.
 */
export function tileInBuildingEntranceClearance(
  tx: number,
  ty: number,
  bld: EntranceRunBuilding,
): boolean {
  const run = buildingEntranceRun(bld);
  // SE doorways open east (+x) and run along y; SW open south (+y), run along x.
  const depth = run.face === "SE" ? tx - run.x : ty - run.y;
  if (depth < 0 || depth > BUILDING_ENTRANCE_CLEARANCE_DEPTH) return false;
  const spread = depth === 0 ? 0 : 1;
  const along = run.face === "SE" ? ty : tx;
  const start = run.face === "SE" ? run.y : run.x;
  return along >= start - spread && along <= start + run.span - 1 + spread;
}

/** True when any nearby building's doorway apron covers this tile. */
export function isBuildingEntranceClearanceTile(tx: number, ty: number): boolean {
  for (const bld of getBuildingsNearTile(
    tx,
    ty,
    BUILDING_ENTRANCE_CLEARANCE_DEPTH,
  )) {
    if (tileInBuildingEntranceClearance(tx, ty, bld)) return true;
  }
  return false;
}

function tileInBuildingFootprint(
  tx: number,
  ty: number,
  b: { ox: number; oy: number; w: number; h: number },
): boolean {
  return tx >= b.ox && tx < b.ox + b.w && ty >= b.oy && ty < b.oy + b.h;
}

function hasBuildingEntryApproach(
  ex: number,
  ey: number,
  ox: number,
  oy: number,
  w: number,
  h: number,
  nearbyBuildings: BuildingInfo[] = [],
  entranceSpan = 1,
): boolean {
  const self = { ox, oy, w, h, entranceX: ex, entranceY: ey, entranceSpan };
  const blocked = (tx: number, ty: number) =>
    tileInBuildingFootprint(tx, ty, self) ||
    nearbyBuildings.some((b) => tileInBuildingFootprint(tx, ty, b));

  // Every doorway tile needs at least one free approach cell.
  for (const tile of buildingEntranceTiles(self)) {
    const approaches =
      buildingEntranceFace(self) === "SE"
        ? [
            { x: tile.x + 1, y: tile.y },
            { x: tile.x + 1, y: tile.y + 1 },
            { x: tile.x + 1, y: tile.y - 1 },
          ]
        : [
            { x: tile.x, y: tile.y + 1 },
            { x: tile.x + 1, y: tile.y + 1 },
            { x: tile.x - 1, y: tile.y + 1 },
          ];
    if (!approaches.some((c) => !blocked(c.x, c.y))) return false;
  }
  return true;
}

/**
 * Motel roof signs are wider than the door. A door on either end tile
 * hangs the sign past the building and onto the street, so pull it one
 * tile in when the new spot still has a way up to the door.
 */
function pullMotelEntranceOffCorners(
  ox: number,
  oy: number,
  w: number,
  h: number,
  entrance: { entranceX: number; entranceY: number; entranceSpan: number },
  nearbyBuildings: BuildingInfo[],
): { entranceX: number; entranceY: number; entranceSpan: number } {
  const span = Math.max(1, entrance.entranceSpan);
  const onEastWall = entrance.entranceX === ox + w - 1;
  if (onEastWall) {
    const minY = oy + 1;
    const maxY = oy + h - span - 1;
    if (maxY < minY) return entrance;
    const y = Math.min(maxY, Math.max(minY, entrance.entranceY));
    if (y === entrance.entranceY) return entrance;
    if (
      !hasBuildingEntryApproach(
        entrance.entranceX,
        y,
        ox,
        oy,
        w,
        h,
        nearbyBuildings,
        span,
      )
    ) {
      return entrance;
    }
    return { ...entrance, entranceY: y };
  }

  const minX = ox + 1;
  const maxX = ox + w - span - 1;
  if (maxX < minX) return entrance;
  const x = Math.min(maxX, Math.max(minX, entrance.entranceX));
  if (x === entrance.entranceX) return entrance;
  if (
    !hasBuildingEntryApproach(
      x,
      entrance.entranceY,
      ox,
      oy,
      w,
      h,
      nearbyBuildings,
      span,
    )
  ) {
    return entrance;
  }
  return { ...entrance, entranceX: x };
}

type EntranceOptions = {
  /** Restrict the door to specific faces (default: both SE and SW). */
  faces?: ReadonlyArray<"SE" | "SW">;
  /** Exclude the two end tiles of each façade (house doors sit off-corner). */
  insetFromCorners?: boolean;
  /** Only the middle tile of each allowed façade. */
  centered?: boolean;
  /** Consecutive façade tiles spanned by the doorway. */
  span?: number;
};

/**
 * Pick a random reachable entrance on a visible face (SE / east or SW / south)
 * so the doorway is always on a rendered cuboid wall.
 */
function pickBuildingEntrance(
  ox: number,
  oy: number,
  w: number,
  h: number,
  rng: () => number,
  nearbyBuildings: BuildingInfo[] = [],
  options: EntranceOptions = {},
): { entranceX: number; entranceY: number; entranceSpan: number } {
  const faces = options.faces ?? ["SE", "SW"];
  const inset = options.insetFromCorners ? 1 : 0;
  const span = Math.max(1, options.span ?? 1);
  const candidates: { x: number; y: number }[] = [];

  const pushCentered = (face: "SE" | "SW") => {
    if (face === "SE") {
      const faceLen = h;
      if (faceLen < span) return;
      const start = Math.floor((faceLen - span) / 2);
      candidates.push({ x: ox + w - 1, y: oy + start });
    } else {
      const faceLen = w;
      if (faceLen < span) return;
      const start = Math.floor((faceLen - span) / 2);
      candidates.push({ x: ox + start, y: oy + h - 1 });
    }
  };

  if (options.centered) {
    if (faces.includes("SE")) pushCentered("SE");
    if (faces.includes("SW")) pushCentered("SW");
  } else {
    // SE face — start positions where the full span fits.
    if (faces.includes("SE") && h >= span + inset * 2) {
      for (let y = oy + inset; y <= oy + h - inset - span; y++) {
        candidates.push({ x: ox + w - 1, y });
      }
    }
    // SW face — skip the SE corner tile as the sole start when span=1.
    if (faces.includes("SW") && w >= span + inset * 2) {
      const xMax = ox + w - inset - span;
      for (let x = ox + inset; x <= xMax; x++) {
        if (span === 1 && x === ox + w - 1) continue;
        candidates.push({ x, y: oy + h - 1 });
      }
    }
  }
  // Degenerate fallback (tiny footprint / over-constrained): whole perimeter starts.
  if (candidates.length === 0) {
    for (let y = oy; y <= oy + h - span; y++) {
      candidates.push({ x: ox + w - 1, y });
    }
    for (let x = ox; x <= ox + w - span; x++) {
      candidates.push({ x, y: oy + h - 1 });
    }
  }

  const withApproach = candidates.filter((c) =>
    hasBuildingEntryApproach(c.x, c.y, ox, oy, w, h, nearbyBuildings, span),
  );
  const pool = withApproach.length > 0 ? withApproach : candidates;
  const pick = pool[Math.floor(rng() * pool.length)]!;
  return { entranceX: pick.x, entranceY: pick.y, entranceSpan: span };
}

type MakeBuildingOptions = {
  fillsLot?: boolean;
  buildingType?: BuildingType;
  exteriorLevels?: number;
  entrance?: EntranceOptions;
  /**
   * Chance (0–1) a house rolls a chimney. Rural 75% / town 25% / city 10%.
   * Ignored for non-house types.
   */
  chimneyChance?: number;
  /** See `BuildingInfo.houseRooms`. */
  houseRooms?: boolean;
};

function makeBuilding(
  ox: number,
  oy: number,
  w: number,
  h: number,
  rng: () => number,
  nearbyBuildings: BuildingInfo[] = [],
  options: MakeBuildingOptions = {},
): BuildingInfo {
  const buildingType = options.buildingType ?? "house";
  const entranceOpts: EntranceOptions = options.entrance ?? {};
  const typeSpec = CITY_BUILDING_SPECS[buildingType as CityBuildingType];
  if (
    entranceOpts.insetFromCorners === undefined &&
    typeSpec?.doorInsetFromCorners
  ) {
    entranceOpts.insetFromCorners = true;
  }
  if (entranceOpts.centered === undefined && typeSpec?.doorCentered) {
    entranceOpts.centered = true;
  }
  if (entranceOpts.span === undefined && typeSpec?.doorSpan) {
    entranceOpts.span = typeSpec.doorSpan;
  }
  const entrance = pickBuildingEntrance(ox, oy, w, h, rng, nearbyBuildings, entranceOpts);
  const placedEntrance =
    buildingType === "motel"
      ? pullMotelEntranceOffCorners(ox, oy, w, h, entrance, nearbyBuildings)
      : entrance;
  const chimneyChance = options.chimneyChance ?? HOUSE_CHIMNEY_CHANCE_CITY;
  const chimney =
    buildingType === "house" && rng() < chimneyChance
      ? pickHouseChimneyTile(ox, oy, w, h, rng)
      : undefined;
  return {
    ox, oy, w, h,
    fillsLot: options.fillsLot ?? false,
    buildingType,
    exteriorLevels: options.exteriorLevels ?? 1,
    houseRooms: options.houseRooms ?? false,
    ...placedEntrance,
    ...chimney,
  };
}

// ── Street dimensions ────────────────────────────────────────────────────────

/** Pavement tiles on each side of a road (1 tile each). */
export const STREET_PAVEMENT = 1;
/** Road tiles in the centre of the street (between pavements). */
export const STREET_ROAD = 6;
/** Total street width: pavement + road + pavement = 8 tiles. */
export const STREET_TOTAL = STREET_PAVEMENT * 2 + STREET_ROAD; // 8

// ── Settlement tuning ────────────────────────────────────────────────────────

/** Tiles per cell side. Owned by region.ts, which is the shared key space. */
const SETTLEMENT_CELL = REGION_SIZE;

// Cumulative probability breakpoints (towns no longer exist as cells)
const P_RURAL = 0.15;
const P_CITY  = 0.03; // 0.15–0.18  (remaining ~82 % = open land)

/** Width of small-town side roads branching from inter-city arterials (1+4+1 tiles). */
export const TOWN_ROAD_TOTAL = 6;

/**
 * Per-settlement-type parameters.
 * blockSize: tiles per lot side.
 * minStreets / maxStreets: count of streets in each direction.
 * radius: rural scatter radius only (town/city street grids may extend past the cell).
 */
const SETTLEMENT_PARAMS = {
  rural: {
    radius: 14, blockSize: 0,
    minStreets: 0, maxStreets: 0,
    density: 0.55,
    minW: 3, maxW: 4, minH: 3, maxH: 4,
  },
  /** Kept for zombie-cap backward compat; cells are never assigned type "town" anymore. */
  town: {
    blockSize: 12,
    minStreets: 2, maxStreets: 4,
    density: 0.72,
    minW: 3, maxW: 4, minH: 3, maxH: 4,
  },
  city: {
    blockSize: 12,
    minStreets: 3, maxStreets: 5,
    density: 0.85,
    minW: 3, minH: 3,
  },
} as const;

/**
 * Town / city house footprints — bigger than rural cabins so multi-room
 * interiors (bedroom + kitchen + office/living room) have room to breathe.
 * Rural houses keep using `SETTLEMENT_PARAMS.rural` (3-4 tiles, 1-room cabin).
 */
const URBAN_HOUSE_SIZE = { minW: 4, maxW: 6, minH: 4, maxH: 6 } as const;

/** Chebyshev cell distance — cities must not appear within this many cells of another city. */
const CITY_MIN_CELL_GAP = 3;

/**
 * Forced city cell for {@link PLAYER_SPAWN_HUB_NAME} ("Birchport").
 * Name is derived from `city:${cx},${cy}`. Origins live in worldBounds.
 */
function isPlayerSpawnHubCell(cx: number, cy: number): boolean {
  return cx === BIRCHPORT_CELL_ORIGIN_X && cy === BIRCHPORT_CELL_ORIGIN_Y;
}

/**
 * How far (in tiles) a settlement layout may extend from its owning cell origin.
 * Must be ≥ half the max inter-city arterial span so mid-route tiles still see
 * at least one endpoint city's layout (otherwise roads vanish in the middle).
 * With INTER_CITY_SEARCH_CELLS=8, spans are ≤8 cells → need ≥4 cells of reach.
 */
const URBAN_REACH = SETTLEMENT_CELL * 4; // 384
/**
 * How far past a tile street and building lookups can reach.
 * The client warms this far beyond the render window so a zoom-out does not
 * build a city layout inside the paint budget.
 */
export const WORLDGEN_QUERY_REACH = URBAN_REACH;
/** Safety cap for single-segment stub arterials (old path; inter-city paths use own logic). */
const ARTERIAL_MAX_REACH = URBAN_REACH - 8;

/**
 * Scan this many Chebyshev cells when searching for cities to connect.
 * Capped at 2 * (URBAN_REACH / SETTLEMENT_CELL) so arterial midpoints stay
 * visible to both endpoint cities.
 */
const INTER_CITY_SEARCH_CELLS = 8;
/** Maximum local k-NN arterial connections a city will create (MST may add more). */
const INTER_CITY_MAX_CONNECT = 3;
/** Probability (0–1) that a roadside town forms on each owned arterial connection. */
const INTER_CITY_TOWN_CHANCE = 0.40;
/** Town centre must be this many tiles from each city grid edge. */
const INTER_CITY_TOWN_BUFFER = 50;

// ── City tiers (rec: varying sized cities) ───────────────────────────────────

type CityTier = "small" | "medium" | "large";

/** Streets-per-axis range for each tier. More streets ⇒ physically larger city. */
const CITY_TIER_STREETS: Record<CityTier, { min: number; max: number }> = {
  small:  { min: 3, max: 4 },
  medium: { min: 4, max: 6 },
  large:  { min: 6, max: 7 },
};

/** Deterministic tier for a city cell — small is common, large is rare. */
function cityTier(cx: number, cy: number): CityTier {
  const r = (xmur3(`citytier:${cx},${cy}`)() >>> 0) / 0xffffffff;
  if (r < 0.5) return "small";
  if (r < 0.83) return "medium";
  return "large";
}

/** Per-column/row lot size range for cities (irregular blocks, rec: irregular block sizes). */
const CITY_BLOCK_MIN = 10;
const CITY_BLOCK_MAX = 14;

// ── City zones (downtown core + outskirts) ────────────────────────────────────

/** Downtown = closest share of lots to the city centre (rank-based so small
 *  cities still get a usable core). */
const DOWNTOWN_LOT_SHARE = 0.22;
const DOWNTOWN_LOTS_MIN = 4;
const DOWNTOWN_LOTS_MAX = 8;

function angleDiff(a: number, b: number): number {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

type Arterial = {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  orient: "v" | "h";
  /** Which tip (if any) has a dead-end pavement cap. "none" = no cap (interior segment). */
  outer: "min" | "max" | "none";
  /** Total road width in tiles (default 8 = 1+6+1; side roads use 6 = 1+4+1). */
  width: number;
};

// ── Settlement cell helpers ──────────────────────────────────────────────────

export const SETTLEMENT_CELL_SIZE = SETTLEMENT_CELL;

export type SettlementType = "none" | "rural" | "town" | "city";

/** Max overworld zombies that can be rolled per zone (inclusive upper bound). */
export const ZONE_ZOMBIE_CAP: Record<SettlementType, number> = {
  none: 5,
  rural: 10,
  town: 20, // arterial roadside towns (not cell-typed)
  city: 80,
};

export function zoneZombieCap(type: SettlementType): number {
  return ZONE_ZOMBIE_CAP[type];
}

function rollInclusive(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

/**
 * Overworld zombie count for a settlement cell or arterial town (fresh roll each call).
 * - none (open land): 80% → 0, else uniform 1–5
 * - rural: uniform 0–10
 * - town: uniform 0–20 (arterial roadside towns)
 * - city: uniform 20–80
 */
export function rollZoneZombieCount(
  type: SettlementType,
  _seedKey?: string,
): number {
  const rng = Math.random;
  switch (type) {
    case "none":
      if (rng() < 0.8) return 0;
      return rollInclusive(rng, 1, 5);
    case "rural":
      return rollInclusive(rng, 0, 10);
    case "town":
      return rollInclusive(rng, 0, 20);
    case "city":
      return rollInclusive(rng, 20, 80);
  }
}

export type TileBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

export type ArterialTownSpawnInfo = TileBounds & { townKey: string };

function settlementCellTileBounds(cx: number, cy: number): TileBounds {
  return {
    minX: cx,
    maxX: cx + SETTLEMENT_CELL - 1,
    minY: cy,
    maxY: cy + SETTLEMENT_CELL - 1,
  };
}

function tileBoundsIntersect(a: TileBounds, b: TileBounds): boolean {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
}

function boundsFromArterialTown(town: ArterialTownData): TileBounds | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let any = false;
  for (const b of town.buildings) {
    any = true;
    minX = Math.min(minX, b.ox);
    minY = Math.min(minY, b.oy);
    maxX = Math.max(maxX, b.ox + b.w - 1);
    maxY = Math.max(maxY, b.oy + b.h - 1);
  }
  for (const a of town.sideRoads) {
    any = true;
    minX = Math.min(minX, a.x0);
    minY = Math.min(minY, a.y0);
    maxX = Math.max(maxX, a.x1 - 1);
    maxY = Math.max(maxY, a.y1 - 1);
  }
  if (!any) return null;
  const pad = 6;
  return {
    minX: minX - pad,
    maxX: maxX + pad,
    minY: minY - pad,
    maxY: maxY + pad,
  };
}

/** Arterial roadside towns owned by a city cell (canonical connection owner only). */
export function arterialTownsOwnedByCity(cx: number, cy: number): ArterialTownSpawnInfo[] {
  if (settlementType(cx, cy) !== "city") return [];
  const { grid } = _computeBaseGridAndRng(cx, cy);
  const { numV, numH } = grid;
  if (numV <= 0 || numH <= 0) return [];

  const towns: ArterialTownSpawnInfo[] = [];
  for (const { cx: ncx, cy: ncy } of nearestCities(cx, cy)) {
    const otherBase = getBaseGrid(ncx, ncy);
    if (!otherBase) continue;
    if (!cityConnectionOwner(cx, cy, ncx, ncy)) continue;

    const tRng = seededRandom(`artown-check:${cx},${cy}:${ncx},${ncy}`);
    if (tRng() >= INTER_CITY_TOWN_CHANCE) continue;

    const pathSegs = buildInterCityPath(cx, cy, ncx, ncy, grid, otherBase);
    const town = generateArterialTown(cx, cy, ncx, ncy, pathSegs);
    const bounds = boundsFromArterialTown(town);
    if (!bounds) continue;
    towns.push({
      townKey: `artown:${cx},${cy}:${ncx},${ncy}`,
      ...bounds,
    });
  }
  return towns;
}

/**
 * Arterial towns whose footprint intersects a settlement cell — used so towns
 * seed when a player approaches along the road, not only when the owner city loads.
 */
export type ArterialPatrolRouteInfo = TileBounds & {
  routeKey: string;
  /** Patrol endpoint A (tile centre, world coords). */
  ax: number;
  ay: number;
  /** Patrol endpoint B (tile centre, world coords). */
  bx: number;
  by: number;
  /** Ordered centreline waypoints from A to B (includes bends). */
  waypoints: { x: number; y: number }[];
};

/** Centreline of an arterial rectangle (road midline, not pavement edge). */
function segmentCenterlineCoord(seg: Arterial): { x: number; y: number } {
  const w = seg.width;
  return { x: seg.x0 + w / 2, y: seg.y0 + w / 2 };
}

/** Centreline endpoints of one arterial rectangle (along the road bed only). */
function sampleSegmentCenterline(seg: Arterial): { x: number; y: number }[] {
  const { x: cx, y: cy } = segmentCenterlineCoord(seg);
  if (seg.orient === "h") {
    return [
      { x: seg.x0 + 0.5, y: cy },
      { x: seg.x1 - 0.5, y: cy },
    ];
  }
  return [
    { x: cx, y: seg.y0 + 0.5 },
    { x: cx, y: seg.y1 - 0.5 },
  ];
}

/**
 * Where two arterial centre-lines meet. For an H↔V L-bend this is the true
 * corner (not the far end of either rectangle, which sits on pavement).
 */
function arterialCenterlineCorner(
  a: Arterial,
  b: Arterial,
): { x: number; y: number } | null {
  if (a.orient !== b.orient) {
    const h = a.orient === "h" ? a : b;
    const v = a.orient === "v" ? a : b;
    const ch = segmentCenterlineCoord(h);
    const cv = segmentCenterlineCoord(v);
    return { x: cv.x, y: ch.y };
  }

  // Colinear continuation (same orientation): join at the shared overlap mid.
  const ca = segmentCenterlineCoord(a);
  const cb = segmentCenterlineCoord(b);
  if (a.orient === "h") {
    if (Math.abs(ca.y - cb.y) > 0.15) return null;
    const x0 = Math.max(a.x0, b.x0);
    const x1 = Math.min(a.x1, b.x1);
    if (x1 <= x0) return { x: (Math.min(a.x1, b.x1) + Math.max(a.x0, b.x0)) / 2, y: ca.y };
    return { x: (x0 + x1) / 2, y: ca.y };
  }
  if (Math.abs(ca.x - cb.x) > 0.15) return null;
  const y0 = Math.max(a.y0, b.y0);
  const y1 = Math.min(a.y1, b.y1);
  if (y1 <= y0) return { x: ca.x, y: (Math.min(a.y1, b.y1) + Math.max(a.y0, b.y0)) / 2 };
  return { x: ca.x, y: (y0 + y1) / 2 };
}

function appendWaypoint(
  waypoints: { x: number; y: number }[],
  p: { x: number; y: number },
) {
  const last = waypoints[waypoints.length - 1];
  if (!last || Math.hypot(p.x - last.x, p.y - last.y) > 0.15) {
    waypoints.push(p);
  }
}

/**
 * Full arterial centreline from city to city. At L-bends, waypoints turn at the
 * intersection of the two road midlines so guards never aim at corner pavement.
 */
function patrolWaypointsFromPathSegs(pathSegs: Arterial[]): { x: number; y: number }[] {
  if (pathSegs.length === 0) return [];
  if (pathSegs.length === 1) return sampleSegmentCenterline(pathSegs[0]!);

  const corners: { x: number; y: number }[] = [];
  for (let i = 0; i < pathSegs.length - 1; i++) {
    const corner = arterialCenterlineCorner(pathSegs[i]!, pathSegs[i + 1]!);
    if (corner) corners.push(corner);
  }

  const first = pathSegs[0]!;
  const last = pathSegs[pathSegs.length - 1]!;
  const firstSamples = sampleSegmentCenterline(first);
  const lastSamples = sampleSegmentCenterline(last);
  const firstCorner = corners[0] ?? firstSamples[0]!;
  const lastCorner = corners[corners.length - 1] ?? lastSamples[0]!;

  const start =
    Math.hypot(firstSamples[0]!.x - firstCorner.x, firstSamples[0]!.y - firstCorner.y) >=
    Math.hypot(firstSamples[1]!.x - firstCorner.x, firstSamples[1]!.y - firstCorner.y)
      ? firstSamples[0]!
      : firstSamples[1]!;
  const end =
    Math.hypot(lastSamples[0]!.x - lastCorner.x, lastSamples[0]!.y - lastCorner.y) >=
    Math.hypot(lastSamples[1]!.x - lastCorner.x, lastSamples[1]!.y - lastCorner.y)
      ? lastSamples[0]!
      : lastSamples[1]!;

  const waypoints: { x: number; y: number }[] = [];
  appendWaypoint(waypoints, start);
  for (const c of corners) appendWaypoint(waypoints, c);
  appendWaypoint(waypoints, end);
  return waypoints;
}

function waypointKey(x: number, y: number): string {
  return `${Math.round(x * 2) / 2},${Math.round(y * 2) / 2}`;
}

/**
 * Merge arterial polylines that touch at junctions into continuous city↔city
 * routes. Towns/rural cells along the road do not split the patrol.
 */
function mergePatrolRoutesAtJunctions(
  routes: ArterialPatrolRouteInfo[],
): ArterialPatrolRouteInfo[] {
  if (routes.length === 0) return routes;

  type Edge = { to: string; waypoints: { x: number; y: number }[] };
  const nodes = new Map<string, { x: number; y: number }>();
  const adj = new Map<string, Edge[]>();

  const addUndirectedEdge = (
    a: { x: number; y: number },
    b: { x: number; y: number },
  ) => {
    const ka = waypointKey(a.x, a.y);
    const kb = waypointKey(b.x, b.y);
    if (ka === kb) return;
    nodes.set(ka, a);
    nodes.set(kb, b);
    const listA = adj.get(ka) ?? [];
    if (!listA.some((e) => e.to === kb)) listA.push({ to: kb, waypoints: [a, b] });
    adj.set(ka, listA);
    const listB = adj.get(kb) ?? [];
    if (!listB.some((e) => e.to === ka)) listB.push({ to: ka, waypoints: [b, a] });
    adj.set(kb, listB);
  };

  for (const route of routes) {
    const wps = route.waypoints;
    for (let i = 1; i < wps.length; i++) {
      addUndirectedEdge(wps[i - 1]!, wps[i]!);
    }
  }

  // Stitch nearby endpoints from different routes (junction overlap / abut).
  const ends: { x: number; y: number }[] = [];
  for (const route of routes) {
    if (route.waypoints.length === 0) continue;
    ends.push(route.waypoints[0]!, route.waypoints[route.waypoints.length - 1]!);
  }
  for (let i = 0; i < ends.length; i++) {
    for (let j = i + 1; j < ends.length; j++) {
      const a = ends[i]!;
      const b = ends[j]!;
      if (Math.hypot(a.x - b.x, a.y - b.y) <= STREET_TOTAL) {
        addUndirectedEdge(a, b);
      }
    }
  }

  const merged: ArterialPatrolRouteInfo[] = [];

  // Recompute each city-pair route on the union graph so bends/junctions connect.
  for (const route of routes) {
    const startKey = waypointKey(route.ax, route.ay);
    const endKey = waypointKey(route.bx, route.by);
    const path = findPatrolGraphPath(startKey, endKey, adj);
    const waypoints = path && path.length >= 2 ? path : route.waypoints;
    if (waypoints.length < 2) continue;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of waypoints) {
      minX = Math.min(minX, Math.floor(p.x));
      minY = Math.min(minY, Math.floor(p.y));
      maxX = Math.max(maxX, Math.floor(p.x));
      maxY = Math.max(maxY, Math.floor(p.y));
    }

    merged.push({
      ...route,
      minX,
      maxX,
      minY,
      maxY,
      ax: waypoints[0]!.x,
      ay: waypoints[0]!.y,
      bx: waypoints[waypoints.length - 1]!.x,
      by: waypoints[waypoints.length - 1]!.y,
      waypoints,
    });
  }

  return merged.length > 0 ? merged : routes;
}

function findPatrolGraphPath(
  startKey: string,
  endKey: string,
  adj: Map<string, { to: string; waypoints: { x: number; y: number }[] }[]>,
): { x: number; y: number }[] | null {
  if (startKey === endKey) return null;

  const queue: string[] = [startKey];
  const prev = new Map<string, { from: string; edge: { x: number; y: number }[] }>();
  const visited = new Set<string>([startKey]);

  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (cur === endKey) break;
    for (const edge of adj.get(cur) ?? []) {
      if (visited.has(edge.to)) continue;
      visited.add(edge.to);
      prev.set(edge.to, { from: cur, edge: edge.waypoints });
      queue.push(edge.to);
    }
  }

  if (!prev.has(endKey)) return null;

  const segments: { x: number; y: number }[][] = [];
  let cur = endKey;
  while (cur !== startKey) {
    const step = prev.get(cur);
    if (!step) return null;
    segments.push(step.edge);
    cur = step.from;
  }
  segments.reverse();

  const path: { x: number; y: number }[] = [];
  for (const seg of segments) {
    for (const p of seg) appendWaypoint(path, p);
  }
  return path.length >= 2 ? path : null;
}

function patrolPathLength(waypoints: { x: number; y: number }[]): number {
  let len = 0;
  for (let i = 1; i < waypoints.length; i++) {
    const a = waypoints[i - 1]!;
    const b = waypoints[i]!;
    len += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return len;
}

export function serializePatrolWaypoints(waypoints: { x: number; y: number }[]): string {
  return JSON.stringify(waypoints.map((w) => [w.x, w.y]));
}

export function parsePatrolWaypoints(json: string): { x: number; y: number }[] {
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: { x: number; y: number }[] = [];
    for (const pt of parsed) {
      if (Array.isArray(pt) && pt.length >= 2) {
        const x = Number(pt[0]);
        const y = Number(pt[1]);
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        out.push({ x, y });
        continue;
      }
      if (pt && typeof pt === "object" && "x" in pt && "y" in pt) {
        const x = Number((pt as { x: number }).x);
        const y = Number((pt as { y: number }).y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        out.push({ x, y });
      }
    }
    return out;
  } catch {
    return [];
  }
}

/** Full inter-city arterial centreline — guard patrol follows every segment including bends. */
function patrolRouteFromPathSegs(
  routeKey: string,
  pathSegs: Arterial[],
): ArterialPatrolRouteInfo | null {
  const sw = STREET_TOTAL;
  const waypoints = patrolWaypointsFromPathSegs(pathSegs);
  const minLen = sw * 4;
  if (waypoints.length < 2 || patrolPathLength(waypoints) < minLen) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const seg of pathSegs) {
    minX = Math.min(minX, seg.x0);
    minY = Math.min(minY, seg.y0);
    maxX = Math.max(maxX, seg.x1 - 1);
    maxY = Math.max(maxY, seg.y1 - 1);
  }

  const start = waypoints[0]!;
  const end = waypoints[waypoints.length - 1]!;
  return {
    routeKey,
    minX,
    maxX,
    minY,
    maxY,
    ax: start.x,
    ay: start.y,
    bx: end.x,
    by: end.y,
    waypoints,
  };
}

/** Arterial guard/trader patrol routes owned by a city cell (canonical connection owner only). */
export function arterialPatrolRoutesOwnedByCity(cx: number, cy: number): ArterialPatrolRouteInfo[] {
  if (settlementType(cx, cy) !== "city") return [];
  const { grid } = _computeBaseGridAndRng(cx, cy);
  const { numV, numH } = grid;
  if (numV <= 0 || numH <= 0) return [];

  const routes: ArterialPatrolRouteInfo[] = [];
  for (const { cx: ncx, cy: ncy } of nearestCities(cx, cy)) {
    const otherBase = getBaseGrid(ncx, ncy);
    if (!otherBase) continue;
    if (!cityConnectionOwner(cx, cy, ncx, ncy)) continue;

    const [mnX, mnY, mxX, mxY] =
      cx < ncx || (cx === ncx && cy <= ncy)
        ? [cx, cy, ncx, ncy]
        : [ncx, ncy, cx, cy];
    const routeKey = `guard-patrol:v4:${mnX},${mnY}:${mxX},${mxY}`;

    const pathSegs = buildInterCityPath(cx, cy, ncx, ncy, grid, otherBase);
    const route = patrolRouteFromPathSegs(routeKey, pathSegs);
    if (route) routes.push(route);
  }
  return routes;
}

/**
 * Internal city street patrol routes — one pair-route per vertical / horizontal
 * street band so militia can cover the whole urban grid (not just arterials).
 */
export function cityStreetPatrolRoutes(cx: number, cy: number): ArterialPatrolRouteInfo[] {
  if (settlementType(cx, cy) !== "city") return [];
  const grid = getBaseGrid(cx, cy);
  if (!grid) return [];

  const sw = STREET_TOTAL;
  const mid = Math.floor(sw / 2);
  const step = Math.max(2, Math.floor(sw / 2));
  const routes: ArterialPatrolRouteInfo[] = [];

  for (let c = 0; c < grid.numV; c++) {
    const sx = grid.vStreetXs[c]!;
    const [yFrom, yTo] = grid.vExtents[c]!;
    if (yTo - yFrom < 4) continue;
    const x = sx + mid + 0.5;
    const waypoints: { x: number; y: number }[] = [];
    for (let y = yFrom + mid; y < yTo - mid; y += step) {
      waypoints.push({ x, y: y + 0.5 });
    }
    // Always include the far end so the route spans the full street.
    const endY = yTo - mid - 0.5;
    const last = waypoints[waypoints.length - 1];
    if (!last || Math.abs(last.y - endY) > 0.1) {
      waypoints.push({ x, y: endY });
    }
    if (waypoints.length < 2) continue;
    const first = waypoints[0]!;
    const end = waypoints[waypoints.length - 1]!;
    routes.push({
      routeKey: `city-street:v:${cx},${cy}:${c}`,
      ax: first.x,
      ay: first.y,
      bx: end.x,
      by: end.y,
      minX: Math.min(first.x, end.x),
      maxX: Math.max(first.x, end.x),
      minY: Math.min(first.y, end.y),
      maxY: Math.max(first.y, end.y),
      waypoints,
    });
  }

  for (let r = 0; r < grid.numH; r++) {
    const sy = grid.hStreetYs[r]!;
    const [xFrom, xTo] = grid.hExtents[r]!;
    if (xTo - xFrom < 4) continue;
    const y = sy + mid + 0.5;
    const waypoints: { x: number; y: number }[] = [];
    for (let x = xFrom + mid; x < xTo - mid; x += step) {
      waypoints.push({ x: x + 0.5, y });
    }
    const endX = xTo - mid - 0.5;
    const last = waypoints[waypoints.length - 1];
    if (!last || Math.abs(last.x - endX) > 0.1) {
      waypoints.push({ x: endX, y });
    }
    if (waypoints.length < 2) continue;
    const first = waypoints[0]!;
    const end = waypoints[waypoints.length - 1]!;
    routes.push({
      routeKey: `city-street:h:${cx},${cy}:${r}`,
      ax: first.x,
      ay: first.y,
      bx: end.x,
      by: end.y,
      minX: Math.min(first.x, end.x),
      maxX: Math.max(first.x, end.x),
      minY: Math.min(first.y, end.y),
      maxY: Math.max(first.y, end.y),
      waypoints,
    });
  }

  return routes;
}

/**
 * Arterial guard/trader patrol routes whose footprint intersects a settlement cell —
 * discovered when a player approaches along the road. Spawn chance is rolled by the
 * server at seed time (not here).
 */
export function arterialPatrolRoutesIntersectingCell(cx: number, cy: number): ArterialPatrolRouteInfo[] {
  const cell = settlementCellTileBounds(cx, cy);
  const reach = URBAN_REACH;
  const minCX = Math.floor((cx - reach) / SETTLEMENT_CELL) * SETTLEMENT_CELL;
  const maxCX = Math.floor((cx + SETTLEMENT_CELL - 1 + reach) / SETTLEMENT_CELL) * SETTLEMENT_CELL;
  const minCY = Math.floor((cy - reach) / SETTLEMENT_CELL) * SETTLEMENT_CELL;
  const maxCY = Math.floor((cy + SETTLEMENT_CELL - 1 + reach) / SETTLEMENT_CELL) * SETTLEMENT_CELL;

  const routes: ArterialPatrolRouteInfo[] = [];
  const seen = new Set<string>();
  for (let ucx = minCX; ucx <= maxCX; ucx += SETTLEMENT_CELL) {
    for (let ucy = minCY; ucy <= maxCY; ucy += SETTLEMENT_CELL) {
      for (const route of arterialPatrolRoutesOwnedByCity(ucx, ucy)) {
        if (seen.has(route.routeKey)) continue;
        if (!tileBoundsIntersect(route, cell)) continue;
        seen.add(route.routeKey);
        routes.push(route);
      }
    }
  }
  return mergePatrolRoutesAtJunctions(routes);
}

export function arterialTownsIntersectingCell(cx: number, cy: number): ArterialTownSpawnInfo[] {
  const cell = settlementCellTileBounds(cx, cy);
  const reach = URBAN_REACH;
  const minCX = Math.floor((cx - reach) / SETTLEMENT_CELL) * SETTLEMENT_CELL;
  const maxCX = Math.floor((cx + SETTLEMENT_CELL - 1 + reach) / SETTLEMENT_CELL) * SETTLEMENT_CELL;
  const minCY = Math.floor((cy - reach) / SETTLEMENT_CELL) * SETTLEMENT_CELL;
  const maxCY = Math.floor((cy + SETTLEMENT_CELL - 1 + reach) / SETTLEMENT_CELL) * SETTLEMENT_CELL;

  const towns: ArterialTownSpawnInfo[] = [];
  const seen = new Set<string>();
  for (let ucx = minCX; ucx <= maxCX; ucx += SETTLEMENT_CELL) {
    for (let ucy = minCY; ucy <= maxCY; ucy += SETTLEMENT_CELL) {
      for (const town of arterialTownsOwnedByCity(ucx, ucy)) {
        if (seen.has(town.townKey)) continue;
        if (!tileBoundsIntersect(town, cell)) continue;
        seen.add(town.townKey);
        towns.push(town);
      }
    }
  }
  return towns;
}

/** True when any part of settlement cell (cx, cy) overlaps loaded world bounds. */
export function settlementCellIntersectsBounds(
  cx: number,
  cy: number,
  bounds: WorldBounds,
): boolean {
  const cellMaxX = cx + SETTLEMENT_CELL_SIZE - 1;
  const cellMaxY = cy + SETTLEMENT_CELL_SIZE - 1;
  const worldMaxX = bounds.minGlobalX + bounds.mapWidth - 1;
  const worldMaxY = bounds.minGlobalY + bounds.mapHeight - 1;
  return (
    cellMaxX >= bounds.minGlobalX &&
    cx <= worldMaxX &&
    cellMaxY >= bounds.minGlobalY &&
    cy <= worldMaxY
  );
}

function rawSettlementType(cx: number, cy: number): SettlementType {
  if (isPlayerSpawnHubCell(cx, cy)) return "city";
  const rng = mulberry32(xmur3(`stype${cx},${cy}`)());
  const r = rng();
  if (r < P_RURAL) return "rural";
  if (r < P_RURAL + P_CITY) return "city";
  return "none";
}

function isUrbanSettlement(type: SettlementType): type is "city" {
  return type === "city";
}

function urbanSettlementPriority(cx: number, cy: number): number {
  return xmur3(`urban-priority:${cx},${cy}`)();
}

type UrbanCandidate = {
  cx: number;
  cy: number;
  type: "town" | "city";
  priority: number;
};

/** Other settlement cell origins within Chebyshev distance (1 = shares an edge/corner). */
function nearbySettlementCellOrigins(
  cx: number,
  cy: number,
  chebyshevRadius: number,
): Array<{ cx: number; cy: number }> {
  const out: Array<{ cx: number; cy: number }> = [];
  for (let dx = -chebyshevRadius; dx <= chebyshevRadius; dx++) {
    for (let dy = -chebyshevRadius; dy <= chebyshevRadius; dy++) {
      if (dx === 0 && dy === 0) continue;
      if (Math.max(Math.abs(dx), Math.abs(dy)) > chebyshevRadius) continue;
      out.push({
        cx: cx + dx * SETTLEMENT_CELL,
        cy: cy + dy * SETTLEMENT_CELL,
      });
    }
  }
  return out;
}

function pickUrbanWinner(candidates: UrbanCandidate[]): UrbanCandidate {
  return [...candidates].sort((a, b) => {
    const rankA = a.type === "city" ? 2 : 1;
    const rankB = b.type === "city" ? 2 : 1;
    if (rankB !== rankA) return rankB - rankA;
    if (b.priority !== a.priority) return b.priority - a.priority;
    if (a.cx !== b.cx) return a.cx - b.cx;
    return a.cy - b.cy;
  })[0]!;
}

/**
 * Town/city spacing: cities stay ≥2 cells apart; at most one town/city per
 * adjacent cell cluster. Grids may extend past the owning cell — spacing keeps
 * urban footprints from overlapping each other.
 */
const settlementTypeCache = new Map<string, SettlementType>();

function settlementType(cx: number, cy: number): SettlementType {
  const key = `${cx}:${cy}`;
  const cached = settlementTypeCache.get(key);
  if (cached !== undefined) return cached;
  const result = computeSettlementType(cx, cy);
  settlementTypeCache.set(key, result);
  return result;
}

function computeSettlementType(cx: number, cy: number): SettlementType {
  // Spawn hub is always a city, and always wins spacing contests.
  if (isPlayerSpawnHubCell(cx, cy)) return "city";

  const raw = rawSettlementType(cx, cy);
  if (raw !== "city") return raw;

  // Cities must stay at least CITY_MIN_CELL_GAP cells apart.
  const candidates: UrbanCandidate[] = [
    { cx, cy, type: "city", priority: urbanSettlementPriority(cx, cy) },
  ];
  for (const { cx: ncx, cy: ncy } of nearbySettlementCellOrigins(cx, cy, CITY_MIN_CELL_GAP)) {
    if (rawSettlementType(ncx, ncy) === "city") {
      // Hub always wins — demote this cell.
      if (isPlayerSpawnHubCell(ncx, ncy)) return "none";
      candidates.push({ cx: ncx, cy: ncy, type: "city", priority: urbanSettlementPriority(ncx, ncy) });
    }
  }
  const winner = pickUrbanWinner(candidates);
  return winner.cx === cx && winner.cy === cy ? "city" : "none";
}

/** Settlement type for the cell whose origin is (cx, cy). */
export function getSettlementType(cx: number, cy: number): SettlementType {
  return settlementType(cx, cy);
}

/** Deterministic display name for a city settlement cell. */
export function getCityName(cx: number, cy: number): string {
  return generateSettlementName(`city:${cx},${cy}`, "city");
}

/** Deterministic display name for an arterial roadside town. */
export function getArterialTownName(townKey: string): string {
  return generateSettlementName(townKey, "town");
}

/**
 * City cell origins this city draws arterials toward (including reciprocal
 * links). Useful for map tools / connectivity checks.
 */
export function getCityRoadLinks(
  cx: number,
  cy: number,
): Array<{ cx: number; cy: number }> {
  if (settlementType(cx, cy) !== "city") return [];
  return nearestCities(cx, cy);
}

export type NamedSettlementLabel = {
  id: string;
  name: string;
  kind: "city" | "town";
  /** Tile centre used for map labelling. */
  x: number;
  y: number;
};

function intersectTileBounds(
  a: TileBounds,
  b: TileBounds,
): TileBounds | null {
  const minX = Math.max(a.minX, b.minX);
  const maxX = Math.min(a.maxX, b.maxX);
  const minY = Math.max(a.minY, b.minY);
  const maxY = Math.min(a.maxY, b.maxY);
  if (minX > maxX || minY > maxY) return null;
  return { minX, maxX, minY, maxY };
}

/**
 * Label anchor inside the visible map: prefer the settlement centre when it
 * falls in the visible overlap, otherwise the overlap midpoint (so edge
 * cities still get a name).
 */
function settlementLabelPoint(
  preferredX: number,
  preferredY: number,
  footprint: TileBounds,
  view: TileBounds,
): { x: number; y: number } | null {
  const overlap = intersectTileBounds(footprint, view);
  if (!overlap) return null;
  if (
    preferredX >= overlap.minX &&
    preferredX <= overlap.maxX &&
    preferredY >= overlap.minY &&
    preferredY <= overlap.maxY
  ) {
    return { x: preferredX, y: preferredY };
  }
  return {
    x: (overlap.minX + overlap.maxX) / 2,
    y: (overlap.minY + overlap.maxY) / 2,
  };
}

/**
 * Cities and arterial towns whose footprints intersect a tile rectangle —
 * used by the M map to draw place-name labels.
 */
export function settlementsInTileRegion(
  minTileX: number,
  maxTileX: number,
  minTileY: number,
  maxTileY: number,
): NamedSettlementLabel[] {
  const labels: NamedSettlementLabel[] = [];
  const seen = new Set<string>();
  const view: TileBounds = {
    minX: minTileX,
    maxX: maxTileX,
    minY: minTileY,
    maxY: maxTileY,
  };
  // City street grids can overflow their 96×96 cell — search neighbours too.
  const cellPad = SETTLEMENT_CELL;

  for (const { cx, cy } of settlementCellsInRegion(
    minTileX - cellPad,
    maxTileX + cellPad,
    minTileY - cellPad,
    maxTileY + cellPad,
  )) {
    if (settlementType(cx, cy) === "city") {
      const bounds = cityLandmarkBounds(cx, cy);
      const layout = getCachedLayout(cx, cy);
      const preferredX = layout?.ccx ?? (bounds.minX + bounds.maxX) / 2;
      const preferredY = layout?.ccy ?? (bounds.minY + bounds.maxY) / 2;
      const point = settlementLabelPoint(preferredX, preferredY, bounds, view);
      if (point) {
        const id = `city:${cx},${cy}`;
        if (!seen.has(id)) {
          seen.add(id);
          labels.push({
            id,
            name: getCityName(cx, cy),
            kind: "city",
            x: point.x,
            y: point.y,
          });
        }
      }
    }

    for (const town of arterialTownsIntersectingCell(cx, cy)) {
      if (seen.has(town.townKey)) continue;
      const point = settlementLabelPoint(
        (town.minX + town.maxX) / 2,
        (town.minY + town.maxY) / 2,
        town,
        view,
      );
      if (!point) continue;
      seen.add(town.townKey);
      labels.push({
        id: town.townKey,
        name: getArterialTownName(town.townKey),
        kind: "town",
        x: point.x,
        y: point.y,
      });
    }
  }

  return labels;
}

/** Settlement cell origins overlapping a global tile rectangle (inclusive). */
export function settlementCellsInRegion(
  minTileX: number,
  maxTileX: number,
  minTileY: number,
  maxTileY: number,
): Array<{ cx: number; cy: number }> {
  const cells: Array<{ cx: number; cy: number }> = [];
  const minCX = Math.floor(minTileX / SETTLEMENT_CELL) * SETTLEMENT_CELL;
  const maxCX = Math.floor(maxTileX / SETTLEMENT_CELL) * SETTLEMENT_CELL;
  const minCY = Math.floor(minTileY / SETTLEMENT_CELL) * SETTLEMENT_CELL;
  const maxCY = Math.floor(maxTileY / SETTLEMENT_CELL) * SETTLEMENT_CELL;
  for (let cx = minCX; cx <= maxCX; cx += SETTLEMENT_CELL) {
    for (let cy = minCY; cy <= maxCY; cy += SETTLEMENT_CELL) {
      cells.push({ cx, cy });
    }
  }
  return cells;
}

// ── Base city grid layout (shared, cacheable, no arterials) ──────────────────

type BaseGrid = {
  ox0: number; oy0: number; xEnd: number; yEnd: number;
  numV: number; numH: number; numCols: number; numRows: number;
  vStreetXs: number[]; hStreetYs: number[];
  vExtents: [number, number][]; hExtents: [number, number][];
  lotXStart: number[]; lotXEnd: number[]; lotYStart: number[]; lotYEnd: number[];
  lotInCity: boolean[][]; plaza: boolean[][]; carPark: boolean[][];
  ccx: number; ccy: number; halfX: number; halfY: number;
  tier: CityTier;
};

/**
 * Computes the street grid for a city cell and returns it together with the
 * RNG positioned after all grid-layout consumption (ready for building gen).
 * This is the single source-of-truth for the grid; both getBaseGrid() and
 * computeGridLayout() call it.
 */
function _computeBaseGridAndRng(cx: number, cy: number): { grid: BaseGrid; rng: () => number } {
  const rng = mulberry32(xmur3(`grid${cx},${cy}`)());
  const sw = STREET_TOTAL;
  const tier = cityTier(cx, cy);
  const streets = CITY_TIER_STREETS[tier];
  const numV = streets.min + Math.floor(rng() * (streets.max - streets.min + 1));
  const numH = streets.min + Math.floor(rng() * (streets.max - streets.min + 1));
  const numCols = numV + 1;
  const numRows = numH + 1;

  const colW: number[] = [];
  for (let c = 0; c < numCols; c++)
    colW.push(CITY_BLOCK_MIN + Math.floor(rng() * (CITY_BLOCK_MAX - CITY_BLOCK_MIN + 1)));
  const rowH: number[] = [];
  for (let r = 0; r < numRows; r++)
    rowH.push(CITY_BLOCK_MIN + Math.floor(rng() * (CITY_BLOCK_MAX - CITY_BLOCK_MIN + 1)));

  const spanX = colW.reduce((a, b) => a + b, 0) + numV * sw;
  const spanY = rowH.reduce((a, b) => a + b, 0) + numH * sw;
  const jitterX = Math.floor((rng() - 0.5) * 16);
  const jitterY = Math.floor((rng() - 0.5) * 16);
  const ox0 = cx + Math.floor(SETTLEMENT_CELL / 2 - spanX / 2) + jitterX;
  const oy0 = cy + Math.floor(SETTLEMENT_CELL / 2 - spanY / 2) + jitterY;

  const lotXStart: number[] = [], lotXEnd: number[] = [], vStreetXs: number[] = [];
  { let px = ox0;
    for (let c = 0; c < numCols; c++) {
      lotXStart.push(px); lotXEnd.push(px + colW[c]!); px += colW[c]!;
      if (c < numV) { vStreetXs.push(px); px += sw; }
    }
  }
  const lotYStart: number[] = [], lotYEnd: number[] = [], hStreetYs: number[] = [];
  { let py = oy0;
    for (let r = 0; r < numRows; r++) {
      lotYStart.push(py); lotYEnd.push(py + rowH[r]!); py += rowH[r]!;
      if (r < numH) { hStreetYs.push(py); py += sw; }
    }
  }
  const xEnd = lotXEnd[numCols - 1]!;
  const yEnd = lotYEnd[numRows - 1]!;

  const ccx = (numCols - 1) / 2;
  const ccy = (numRows - 1) / 2;
  const halfX = Math.max(ccx, 0.5);
  const halfY = Math.max(ccy, 0.5);

  const erng = seededRandom(`envelope:${cx},${cy}`);
  const envA1 = erng() * Math.PI * 2;
  const envA2 = erng() * Math.PI * 2;
  const envAmp = 0.12 + erng() * 0.12;
  const envRadius = (theta: number) =>
    0.94 + envAmp * Math.sin(theta * 2 + envA1) + envAmp * 0.5 * Math.sin(theta * 3 + envA2);

  const plazaRng = seededRandom(`plaza:${cx},${cy}`);
  const lotInCity: boolean[][] = [];
  const plaza: boolean[][] = [];
  const carPark: boolean[][] = [];
  for (let c = 0; c < numCols; c++) {
    lotInCity.push([]);
    plaza.push([]);
    carPark.push([]);
    for (let r = 0; r < numRows; r++) {
      const nx = (c - ccx) / halfX;
      const ny = (r - ccy) / halfY;
      const rad = Math.hypot(nx, ny);
      const inside = rad <= 0.35 || rad <= envRadius(Math.atan2(ny, nx)) * 1.02;
      lotInCity[c]!.push(inside);
      const isPlaza = inside && rad < 0.75 && plazaRng() < 0.06;
      plaza[c]!.push(isPlaza);
      // Concrete parking lots disabled — lots stay available for buildings.
      carPark[c]!.push(false);
    }
  }

  // ── Three-pass extent computation (same as computeGridLayout) ───────────────
  const inCityRange = (aInside: boolean[], bInside: boolean[]): [number, number] | null => {
    let from = -1, to = -1;
    for (let i = 0; i < aInside.length; i++) {
      if (aInside[i] || bInside[i]) { if (from < 0) from = i; to = i; }
    }
    return from < 0 ? null : [from, to];
  };

  type ExtentRange = { rFrom: number; rTo: number };
  const vRanges: ExtentRange[] = [];
  for (let c = 0; c < numV; c++) {
    const range = inCityRange(lotInCity[c]!, lotInCity[c + 1]!);
    if (!range) { vRanges.push({ rFrom: 0, rTo: -1 }); continue; }
    let [rFrom, rTo] = range;
    const isOuter = c === 0 || c === numV - 1;
    if (!isOuter && rng() < 0.3 && rTo > rFrom) {
      const s = rFrom + Math.floor(rng() * (rTo - rFrom + 1));
      const e = s + Math.floor(rng() * (rTo - s + 1));
      rFrom = s; rTo = e;
    }
    vRanges.push({ rFrom, rTo });
  }
  const vExtentY = (rFrom: number, rTo: number): [number, number] => {
    const yF = rFrom === 0 ? oy0 : hStreetYs[rFrom - 1]!;
    const yT = rTo >= numRows - 1 ? yEnd : hStreetYs[rTo]! + sw;
    return [yF, yT];
  };
  const vExtents: [number, number][] = vRanges.map(({ rFrom, rTo }) =>
    rTo < rFrom ? [oy0, oy0] : vExtentY(rFrom, rTo));

  const hExtents: [number, number][] = [];
  for (let r = 0; r < numH; r++) {
    const hY = hStreetYs[r]!;
    const colInside = (idx: number) => lotInCity.map((col) => col[idx]!);
    const range = inCityRange(colInside(r), colInside(r + 1));
    if (!range) { hExtents.push([ox0, ox0]); continue; }
    let [cFrom, cTo] = range;
    const isOuter = r === 0 || r === numH - 1;
    if (!isOuter && rng() < 0.3 && cTo > cFrom) {
      const s = cFrom + Math.floor(rng() * (cTo - cFrom + 1));
      const e = s + Math.floor(rng() * (cTo - s + 1));
      cFrom = s; cTo = e;
    }
    let xFrom: number, xTo: number;
    if (cFrom === 0) xFrom = ox0;
    else { const [vyF, vyT] = vExtents[cFrom - 1]!; xFrom = (hY >= vyF && hY < vyT) ? vStreetXs[cFrom - 1]! : lotXStart[cFrom]!; }
    if (cTo >= numCols - 1) xTo = xEnd;
    else { const [vyF, vyT] = vExtents[cTo]!; xTo = (hY >= vyF && hY < vyT) ? vStreetXs[cTo]! + sw : lotXEnd[cTo]!; }
    hExtents.push([xFrom, xTo]);
  }
  for (let c = 0; c < numV; c++) {
    const { rFrom, rTo } = vRanges[c]!;
    if (rTo < rFrom) continue;
    const vXc = vStreetXs[c]!;
    let yFrom: number, yTo: number;
    if (rFrom === 0) yFrom = oy0;
    else { const [hxF, hxT] = hExtents[rFrom - 1]!; yFrom = (vXc >= hxF && vXc < hxT) ? hStreetYs[rFrom - 1]! : lotYStart[rFrom]!; }
    if (rTo >= numRows - 1) yTo = yEnd;
    else { const [hxF, hxT] = hExtents[rTo]!; yTo = (vXc >= hxF && vXc < hxT) ? hStreetYs[rTo]! + sw : lotYEnd[rTo]!; }
    vExtents[c] = [yFrom, yTo];
  }

  return {
    grid: { ox0, oy0, xEnd, yEnd, numV, numH, numCols, numRows,
            vStreetXs, hStreetYs, vExtents, hExtents,
            lotXStart, lotXEnd, lotYStart, lotYEnd,
            lotInCity, plaza, carPark, ccx, ccy, halfX, halfY, tier },
    rng,
  };
}

const _baseGridCache = new Map<string, BaseGrid | null>();

/** Cached base grid for a city cell (streets only — no arterials, no rng). */
function getBaseGrid(cx: number, cy: number): BaseGrid | null {
  const key = `${cx}:${cy}`;
  const hit = _baseGridCache.get(key);
  if (hit !== undefined) return hit;
  const type = settlementType(cx, cy);
  if (type !== "city") { _baseGridCache.set(key, null); return null; }
  const { grid } = _computeBaseGridAndRng(cx, cy);
  _baseGridCache.set(key, grid);
  return grid;
}

// ── Inter-city arterial helpers ───────────────────────────────────────────────

const _nearestCitiesPrimaryCache = new Map<string, Array<{ cx: number; cy: number }>>();

type CityCandidate = { cx: number; cy: number; distSq: number; cheb: number };

/** All city cells within Chebyshev `maxRing`, nearest-first (stable tie-break). */
function citiesWithinChebyshev(
  cx: number,
  cy: number,
  maxRing: number,
): CityCandidate[] {
  const found: CityCandidate[] = [];
  for (let ring = 1; ring <= maxRing; ring++) {
    for (let dx = -ring; dx <= ring; dx++) {
      for (let dy = -ring; dy <= ring; dy++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
        const ncx = cx + dx * SETTLEMENT_CELL;
        const ncy = cy + dy * SETTLEMENT_CELL;
        if (settlementType(ncx, ncy) === "city") {
          found.push({
            cx: ncx,
            cy: ncy,
            distSq: dx * dx + dy * dy,
            cheb: ring,
          });
        }
      }
    }
  }
  found.sort((a, b) => {
    if (a.distSq !== b.distSq) return a.distSq - b.distSq;
    if (a.cx !== b.cx) return a.cx - b.cx;
    return a.cy - b.cy;
  });
  return found;
}

/**
 * MST edges among `nodes` (city cell origins), Kruskal by Euclidean² then
 * stable cell-key order. Returns undirected neighbour lists keyed by `cx:cy`.
 */
function cityMstNeighbors(
  nodes: Array<{ cx: number; cy: number }>,
): Map<string, Array<{ cx: number; cy: number }>> {
  const keyOf = (c: { cx: number; cy: number }) => `${c.cx}:${c.cy}`;
  const neighbors = new Map<string, Array<{ cx: number; cy: number }>>();
  for (const n of nodes) neighbors.set(keyOf(n), []);
  if (nodes.length < 2) return neighbors;

  type Edge = {
    ai: number;
    bi: number;
    distSq: number;
    aKey: string;
    bKey: string;
  };
  const edges: Edge[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i]!;
    for (let j = i + 1; j < nodes.length; j++) {
      const b = nodes[j]!;
      const dx = (a.cx - b.cx) / SETTLEMENT_CELL;
      const dy = (a.cy - b.cy) / SETTLEMENT_CELL;
      const aKey = keyOf(a);
      const bKey = keyOf(b);
      const [lo, hi] = aKey < bKey ? [aKey, bKey] : [bKey, aKey];
      edges.push({
        ai: i,
        bi: j,
        distSq: dx * dx + dy * dy,
        aKey: lo,
        bKey: hi,
      });
    }
  }
  edges.sort((e1, e2) => {
    if (e1.distSq !== e2.distSq) return e1.distSq - e2.distSq;
    if (e1.aKey !== e2.aKey) return e1.aKey < e2.aKey ? -1 : 1;
    return e1.bKey < e2.bKey ? -1 : e1.bKey > e2.bKey ? 1 : 0;
  });

  const parent = nodes.map((_, i) => i);
  const find = (i: number): number => {
    let r = i;
    while (parent[r] !== r) r = parent[r]!;
    let cur = i;
    while (parent[cur] !== r) {
      const next = parent[cur]!;
      parent[cur] = r;
      cur = next;
    }
    return r;
  };

  let joined = 0;
  for (const e of edges) {
    const ra = find(e.ai);
    const rb = find(e.bi);
    if (ra === rb) continue;
    parent[ra] = rb;
    const a = nodes[e.ai]!;
    const b = nodes[e.bi]!;
    neighbors.get(keyOf(a))!.push({ cx: b.cx, cy: b.cy });
    neighbors.get(keyOf(b))!.push({ cx: a.cx, cy: a.cy });
    joined++;
    if (joined >= nodes.length - 1) break;
  }
  return neighbors;
}

/**
 * Cities this cell initiates arterials toward (before reciprocity).
 *
 * 1. Up to INTER_CITY_MAX_CONNECT nearest cities within search range (local density)
 * 2. Every MST neighbour in the same window (connects the local city graph so
 *    you can hop city→city across the map instead of leaving isolates)
 *
 * Search radius is capped so arterial midpoints remain inside URBAN_REACH.
 */
function nearestCitiesPrimary(cx: number, cy: number): Array<{ cx: number; cy: number }> {
  const key = `${cx}:${cy}`;
  const cached = _nearestCitiesPrimaryCache.get(key);
  if (cached) return cached;

  const found = citiesWithinChebyshev(cx, cy, INTER_CITY_SEARCH_CELLS);
  const result: Array<{ cx: number; cy: number }> = [];
  const seen = new Set<string>();

  const add = (ncx: number, ncy: number) => {
    const k = `${ncx}:${ncy}`;
    if (seen.has(k)) return;
    seen.add(k);
    result.push({ cx: ncx, cy: ncy });
  };

  for (const f of found.slice(0, INTER_CITY_MAX_CONNECT)) {
    add(f.cx, f.cy);
  }

  // Local spanning tree — guarantees one connected component among cities that
  // share an overlapping search ball (no more orphan cities inside range).
  if (found.length > 0) {
    const nodes = [{ cx, cy }, ...found.map((f) => ({ cx: f.cx, cy: f.cy }))];
    const mst = cityMstNeighbors(nodes);
    for (const n of mst.get(key) ?? []) add(n.cx, n.cy);
  }

  // Point toward the origin: nearest in-range city that is strictly closer to
  // (0,0). Chains these links into one giant component instead of separate
  // regional clusters (still capped by INTER_CITY_SEARCH_CELLS for road visibility).
  if (found.length > 0) {
    const selfDist =
      (cx / SETTLEMENT_CELL) * (cx / SETTLEMENT_CELL) +
      (cy / SETTLEMENT_CELL) * (cy / SETTLEMENT_CELL);
    let best: CityCandidate | null = null;
    for (const f of found) {
      const d =
        (f.cx / SETTLEMENT_CELL) * (f.cx / SETTLEMENT_CELL) +
        (f.cy / SETTLEMENT_CELL) * (f.cy / SETTLEMENT_CELL);
      if (d > selfDist - 1e-9) continue;
      if (
        !best ||
        f.distSq < best.distSq ||
        (f.distSq === best.distSq &&
          (f.cx < best.cx || (f.cx === best.cx && f.cy < best.cy)))
      ) {
        best = f;
      }
    }
    if (best) add(best.cx, best.cy);
  }

  _nearestCitiesPrimaryCache.set(key, result);
  return result;
}

/**
 * Cities this cell should draw arterials toward.
 *
 * Includes the primary nearestCitiesPrimary set, plus any city within search
 * range that lists this cell in *its* primary set.  Without reciprocity, the
 * canonical owner may be the only city that builds a path — mid-route tiles
 * outside that city's URBAN_REACH then miss the arterial entirely (visible as
 * a stub road that stops short of the other city).
 */
function nearestCities(cx: number, cy: number): Array<{ cx: number; cy: number }> {
  const primary = nearestCitiesPrimary(cx, cy);
  const out = [...primary];
  const seen = new Set(primary.map((c) => `${c.cx}:${c.cy}`));

  for (let ring = 1; ring <= INTER_CITY_SEARCH_CELLS; ring++) {
    for (let dx = -ring; dx <= ring; dx++) {
      for (let dy = -ring; dy <= ring; dy++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
        const ncx = cx + dx * SETTLEMENT_CELL;
        const ncy = cy + dy * SETTLEMENT_CELL;
        const nKey = `${ncx}:${ncy}`;
        if (seen.has(nKey)) continue;
        if (settlementType(ncx, ncy) !== "city") continue;
        const theirs = nearestCitiesPrimary(ncx, ncy);
        if (theirs.some((c) => c.cx === cx && c.cy === cy)) {
          seen.add(nKey);
          out.push({ cx: ncx, cy: ncy });
        }
      }
    }
  }
  return out;
}

/**
 * True when city (ax, ay) is the canonical owner of the (ax,ay)↔(bx,by)
 * connection.  Exactly one of the two cities owns each pair, preventing
 * duplicate road data.
 */
function cityConnectionOwner(ax: number, ay: number, bx: number, by: number): boolean {
  const ha = xmur3(`cowner:${ax},${ay}`)();
  const hb = xmur3(`cowner:${bx},${by}`)();
  if (ha !== hb) return ha < hb;
  return ax < bx || (ax === bx && ay < by);
}

/**
 * Build an L-shaped (up to 3-segment) arterial road between two city grids.
 * The path is keyed on the SORTED city-pair coordinates so that both cities
 * produce identical segments regardless of which one initiates the call.
 * Variation comes from a random bend point chosen between 22 % and 78 % along
 * the primary axis.
 */
function buildInterCityPath(
  cx1: number, cy1: number,
  cx2: number, cy2: number,
  g1: BaseGrid,
  g2: BaseGrid,
): Arterial[] {
  const sw = STREET_TOTAL;
  // Stable RNG keyed on sorted pair so both cities get the same bend
  const [mnX, mnY, mxX, mxY] = cx1 < cx2 || (cx1 === cx2 && cy1 <= cy2)
    ? [cx1, cy1, cx2, cy2] : [cx2, cy2, cx1, cy1];
  const prng = seededRandom(`art-path:${mnX},${mnY}:${mxX},${mxY}`);

  const dx = cx2 - cx1, dy = cy2 - cy1;
  const absDx = Math.abs(dx), absDy = Math.abs(dy);
  const c2CY = cy2 + SETTLEMENT_CELL / 2;
  const c2CX = cx2 + SETTLEMENT_CELL / 2;
  const c1CY = cy1 + SETTLEMENT_CELL / 2;
  const c1CX = cx1 + SETTLEMENT_CELL / 2;

  const closestH = (g: BaseGrid, targetY: number): number =>
    g.hStreetYs.reduce((best, sy, i) =>
      Math.abs(sy - targetY) < Math.abs(g.hStreetYs[best]! - targetY) ? i : best, 0);
  const closestV = (g: BaseGrid, targetX: number): number =>
    g.vStreetXs.reduce((best, sx, i) =>
      Math.abs(sx - targetX) < Math.abs(g.vStreetXs[best]! - targetX) ? i : best, 0);

  const segs: Arterial[] = [];

  if (absDx >= absDy) {
    // ── Primarily horizontal ─────────────────────────────────────────────────
    if (!g1.hStreetYs.length || !g2.hStreetYs.length) return segs;
    const r1 = closestH(g1, c2CY);
    const r2 = closestH(g2, c1CY);
    const y1 = g1.hStreetYs[r1]!;
    const y2 = g2.hStreetYs[r2]!;
    // Edge of each city's H extent facing the other city
    const x1Edge = dx >= 0 ? g1.hExtents[r1]![1] : g1.hExtents[r1]![0];
    const x2Edge = dx >= 0 ? g2.hExtents[r2]![0] : g2.hExtents[r2]![1];
    const xLeft  = Math.min(x1Edge, x2Edge);
    const xRight = Math.max(x1Edge, x2Edge);
    const xRange = xRight - xLeft;
    if (xRange < sw * 2) return segs;

    const bendX = xLeft + Math.floor(xRange * (0.22 + prng() * 0.56));
    const vY0 = Math.min(y1, y2);
    const vY1 = Math.max(y1, y2) + sw;
    // H from city1 side to bend (inclusive of the bend V-column)
    segs.push({ x0: Math.min(x1Edge, bendX), x1: Math.max(x1Edge, bendX + sw), y0: y1, y1: y1 + sw, orient: "h", outer: "none", width: sw });
    // V at bend connecting the two H streets (only if they differ)
    if (y1 !== y2) {
      segs.push({ x0: bendX, x1: bendX + sw, y0: vY0, y1: vY1, orient: "v", outer: "none", width: sw });
    }
    // H from bend to city2 side
    segs.push({ x0: Math.min(bendX, x2Edge), x1: Math.max(bendX + sw, x2Edge), y0: y2, y1: y2 + sw, orient: "h", outer: "none", width: sw });
  } else {
    // ── Primarily vertical ───────────────────────────────────────────────────
    if (!g1.vStreetXs.length || !g2.vStreetXs.length) return segs;
    const c1 = closestV(g1, c2CX);
    const c2 = closestV(g2, c1CX);
    const x1 = g1.vStreetXs[c1]!;
    const x2 = g2.vStreetXs[c2]!;
    const y1Edge = dy >= 0 ? g1.vExtents[c1]![1] : g1.vExtents[c1]![0];
    const y2Edge = dy >= 0 ? g2.vExtents[c2]![0] : g2.vExtents[c2]![1];
    const yTop    = Math.min(y1Edge, y2Edge);
    const yBottom = Math.max(y1Edge, y2Edge);
    const yRange  = yBottom - yTop;
    if (yRange < sw * 2) return segs;

    const bendY = yTop + Math.floor(yRange * (0.22 + prng() * 0.56));
    const hX0 = Math.min(x1, x2);
    const hX1 = Math.max(x1, x2) + sw;
    // V from city1 to bend
    segs.push({ x0: x1, x1: x1 + sw, y0: Math.min(y1Edge, bendY), y1: Math.max(y1Edge, bendY + sw), orient: "v", outer: "none", width: sw });
    // H at bend
    if (x1 !== x2) {
      segs.push({ x0: hX0, x1: hX1, y0: bendY, y1: bendY + sw, orient: "h", outer: "none", width: sw });
    }
    // V from bend to city2
    segs.push({ x0: x2, x1: x2 + sw, y0: Math.min(bendY, y2Edge), y1: Math.max(bendY + sw, y2Edge), orient: "v", outer: "none", width: sw });
  }
  return segs;
}

// ── Roadside town along an arterial connection ────────────────────────────────

type ArterialTownData = { buildings: BuildingInfo[]; sideRoads: Arterial[] };

/** True if two footprints overlap or share an edge (need ≥1 tile gap). */
function townBuildingsConflict(
  ox: number, oy: number, w: number, h: number,
  buildings: BuildingInfo[],
  gap = 1,
): boolean {
  const x0 = ox - gap, y0 = oy - gap, x1 = ox + w + gap, y1 = oy + h + gap;
  for (const b of buildings) {
    if (x0 < b.ox + b.w && x1 > b.ox && y0 < b.oy + b.h && y1 > b.oy) return true;
  }
  return false;
}

/** Place a building flush to a road with a locked pavement-facing door. */
function tryTownBuilding(
  buildings: BuildingInfo[],
  ox: number,
  oy: number,
  w: number,
  h: number,
  rng: () => number,
  faces: ReadonlyArray<"SE" | "SW">,
): boolean {
  if (w < 3 || h < 3) return false;
  if (townBuildingsConflict(ox, oy, w, h, buildings)) return false;
  if (buildingFootprintBlockedByPlayerStructures(ox, oy, w, h)) return false;
  buildings.push(makeBuilding(ox, oy, w, h, rng, buildings, {
    entrance: { faces },
    chimneyChance: HOUSE_CHIMNEY_CHANCE_TOWN,
    houseRooms: true,
  }));
  return true;
}

/** Town house footprint — bigger than rural cabins (see {@link URBAN_HOUSE_SIZE}). */
function townHouseSize(rng: () => number): { w: number; h: number } {
  const p = URBAN_HOUSE_SIZE;
  return {
    w: p.minW + Math.floor(rng() * (p.maxW - p.minW + 1)),
    h: p.minH + Math.floor(rng() * (p.maxH - p.minH + 1)),
  };
}

/**
 * Generates a small roadside settlement along the longest arterial segment.
 * Buildings sit flush on the west/north of roads so SE/SW doors always face
 * pavement (the engine has no west/north wall entrances).
 */
function generateArterialTown(
  ownerCx: number, ownerCy: number,
  otherCx: number, otherCy: number,
  pathSegs: Arterial[],
): ArterialTownData {
  const rng = seededRandom(`artown:${ownerCx},${ownerCy}:${otherCx},${otherCy}`);
  const sw = STREET_TOTAL;
  const trs = TOWN_ROAD_TOTAL;

  let bestSeg: Arterial | null = null;
  let bestLen = 0;
  for (const seg of pathSegs) {
    const len = seg.orient === "h" ? seg.x1 - seg.x0 : seg.y1 - seg.y0;
    if (len > bestLen) { bestLen = len; bestSeg = seg; }
  }

  const minTownLen = INTER_CITY_TOWN_BUFFER * 2 + 20;
  if (!bestSeg || bestLen < minTownLen) return { buildings: [], sideRoads: [] };

  const buildings: BuildingInfo[] = [];
  const sideRoads: Arterial[] = [];
  // Shorter strip, fewer lots
  const halfSpan = 8 + Math.floor(rng() * 8);
  const validRange = bestLen - INTER_CITY_TOWN_BUFFER * 2;
  const offset = INTER_CITY_TOWN_BUFFER + Math.floor(rng() * Math.max(1, validRange));
  const placeChance = 0.7;
  const gapTiles = () => 2 + Math.floor(rng() * 3); // 2–4 tiles between buildings

  /** Reserved intervals along the arterial frontage where side roads meet. */
  const mouthClearance: Array<{ a: number; b: number }> = [];

  if (bestSeg.orient === "h") {
    const hy = bestSeg.y0;
    const cX = bestSeg.x0 + offset;
    const txS = cX - halfSpan;
    const txE = cX + halfSpan;

    // Side roads first so arterial lots can leave clearance at the junction.
    const srCount = rng() < 0.45 ? 2 : 1;
    for (let i = 0; i < srCount; i++) {
      const srX = txS + 2 + Math.floor(rng() * Math.max(1, (txE - txS) - trs - 4));
      const srLen = 12 + Math.floor(rng() * 10);
      // Prefer alternating sides when placing two roads.
      const south = srCount === 2 ? i === 0 : rng() < 0.5;
      mouthClearance.push({ a: srX - 1, b: srX + trs + 1 });

      if (south) {
        sideRoads.push({
          x0: srX, x1: srX + trs, y0: hy + sw, y1: hy + sw + srLen,
          orient: "v", outer: "max", width: trs,
        });
        // West of the side road only — SE door faces east onto pavement.
        let y = hy + sw;
        while (y + 3 <= hy + sw + srLen - 2) {
          const { w: bw, h: bh } = townHouseSize(rng);
          if (y + bh > hy + sw + srLen - 1) break;
          if (rng() < placeChance) {
            tryTownBuilding(buildings, srX - bw, y, bw, bh, rng, ["SE"]);
          }
          y += bh + gapTiles();
        }
      } else {
        sideRoads.push({
          x0: srX, x1: srX + trs, y0: hy - srLen, y1: hy,
          orient: "v", outer: "min", width: trs,
        });
        let y = hy - 2;
        while (y - 1 >= hy - srLen + 1) {
          const { w: bw, h: bh } = townHouseSize(rng);
          const oy = y - bh + 1;
          if (oy < hy - srLen + 1) break;
          if (rng() < placeChance) {
            tryTownBuilding(buildings, srX - bw, oy, bw, bh, rng, ["SE"]);
          }
          y = oy - gapTiles();
        }
      }
    }

    // Arterial frontage — north side only so SW doors face south onto pavement.
    const blocksMouth = (x: number, w: number) =>
      mouthClearance.some(m => x < m.b && x + w > m.a);

    let xc = txS;
    while (xc + 3 <= txE) {
      const { w: bw, h: bh } = townHouseSize(rng);
      if (xc + bw > txE) break;
      if (!blocksMouth(xc, bw) && rng() < placeChance) {
        tryTownBuilding(buildings, xc, hy - bh, bw, bh, rng, ["SW"]);
      }
      xc += bw + gapTiles();
    }
  } else {
    const vx = bestSeg.x0;
    const cY = bestSeg.y0 + offset;
    const tyS = cY - halfSpan;
    const tyE = cY + halfSpan;

    const srCount = rng() < 0.45 ? 2 : 1;
    for (let i = 0; i < srCount; i++) {
      const srY = tyS + 2 + Math.floor(rng() * Math.max(1, (tyE - tyS) - trs - 4));
      const srLen = 12 + Math.floor(rng() * 10);
      const east = srCount === 2 ? i === 0 : rng() < 0.5;
      mouthClearance.push({ a: srY - 1, b: srY + trs + 1 });

      if (east) {
        sideRoads.push({
          x0: vx + sw, x1: vx + sw + srLen, y0: srY, y1: srY + trs,
          orient: "h", outer: "max", width: trs,
        });
        // North of the side road only — SW door faces south onto pavement.
        let x = vx + sw;
        while (x + 3 <= vx + sw + srLen - 2) {
          const { w: bw, h: bh } = townHouseSize(rng);
          if (x + bw > vx + sw + srLen - 1) break;
          if (rng() < placeChance) {
            tryTownBuilding(buildings, x, srY - bh, bw, bh, rng, ["SW"]);
          }
          x += bw + gapTiles();
        }
      } else {
        sideRoads.push({
          x0: vx - srLen, x1: vx, y0: srY, y1: srY + trs,
          orient: "h", outer: "min", width: trs,
        });
        let x = vx - 2;
        while (x - 1 >= vx - srLen + 1) {
          const { w: bw, h: bh } = townHouseSize(rng);
          const ox = x - bw + 1;
          if (ox < vx - srLen + 1) break;
          if (rng() < placeChance) {
            tryTownBuilding(buildings, ox, srY - bh, bw, bh, rng, ["SW"]);
          }
          x = ox - gapTiles();
        }
      }
    }

    const blocksMouth = (y: number, h: number) =>
      mouthClearance.some(m => y < m.b && y + h > m.a);

    // Arterial frontage — west side only so SE doors face east onto pavement.
    let yc = tyS;
    while (yc + 3 <= tyE) {
      const { w: bw, h: bh } = townHouseSize(rng);
      if (yc + bh > tyE) break;
      if (!blocksMouth(yc, bh) && rng() < placeChance) {
        tryTownBuilding(buildings, vx - bw, yc, bw, bh, rng, ["SE"]);
      }
      yc += bh + gapTiles();
    }
  }

  return { buildings, sideRoads };
}

// ── Full grid layout + arterials ──────────────────────────────────────────────

/** Cached city layout (without rng) for tile-type lookups. */
type CachedLayout = Omit<ReturnType<typeof computeGridLayout>, "rng" | "p" | "tier">;
const _layoutCache = new Map<string, CachedLayout | null>();

function getCachedLayout(cx: number, cy: number): CachedLayout | null {
  const key = `${cx}:${cy}`;
  const hit = _layoutCache.get(key);
  if (hit !== undefined) return hit;
  const type = settlementType(cx, cy);
  if (type !== "city") { _layoutCache.set(key, null); return null; }
  const { rng: _r, p: _p, tier: _t, ...rest } = computeGridLayout(cx, cy, "city");
  _layoutCache.set(key, rest);
  indexLayoutArterials(rest.arterials);
  return rest;
}

/**
 * Computes the deterministic street layout for a city settlement cell.
 *
 * Both gridBuildings() and getStreetTileTypeInCell() call this independently
 * (fresh RNG each time, same seed) and get identical layout values.  The
 * returned `rng` is ready for building generation (layout values already
 * consumed).
 *
 * Layout:
 *   vStreetXs[c] = x where vertical street c starts (runs N-S)
 *   hStreetYs[r] = y where horizontal street r starts (runs E-W)
 *   vExtents[c]  = [yFrom, yTo] — how far south the vertical street runs
 *   hExtents[r]  = [xFrom, xTo] — how far east the horizontal street runs
 */
function computeGridLayout(cx: number, cy: number, type: "city") {
  const { grid, rng } = _computeBaseGridAndRng(cx, cy);
  const { ox0, oy0, xEnd, yEnd, numV, numH, numCols, numRows,
          vStreetXs, hStreetYs, vExtents, hExtents,
          lotXStart, lotXEnd, lotYStart, lotYEnd,
          lotInCity, plaza, carPark, ccx, ccy, halfX, halfY, tier } = grid;
  const p = SETTLEMENT_PARAMS.city;
  const isCity = true;
  const sw = STREET_TOTAL;

  // All grid data comes from _computeBaseGridAndRng.  Now compute inter-city
  // arterials and optional roadside towns using the cached base grids of
  // neighbouring cities (no recursion: getBaseGrid calls _computeBaseGrid, not
  // computeGridLayout).
  const arterials: Arterial[] = [];
  const artBuildings: BuildingInfo[] = [];
  void isCity; void sw; // used by callers via grid fields

  if (numV > 0 && numH > 0) {
    for (const { cx: ncx, cy: ncy } of nearestCities(cx, cy)) {
      const otherBase = getBaseGrid(ncx, ncy);
      if (!otherBase) continue;

      const owner = cityConnectionOwner(cx, cy, ncx, ncy);
      const [c1x, c1y, g1, c2x, c2y, g2] = owner
        ? [cx, cy, grid, ncx, ncy, otherBase]
        : [ncx, ncy, otherBase, cx, cy, grid];

      const pathSegs = buildInterCityPath(c1x, c1y, c2x, c2y, g1, g2);
      for (const seg of pathSegs) arterials.push(seg);

      // Only the canonical owner generates the town for this pair
      if (owner) {
        const tRng = seededRandom(`artown-check:${cx},${cy}:${ncx},${ncy}`);
        if (tRng() < INTER_CITY_TOWN_CHANCE) {
          const town = generateArterialTown(cx, cy, ncx, ncy, pathSegs);
          for (const b of town.buildings) artBuildings.push(b);
          for (const r of town.sideRoads) arterials.push(r);
        }
      }
    }
  }

  return {
    ox0, oy0, numV, numH, numCols, numRows,
    vStreetXs, hStreetYs, vExtents, hExtents,
    lotXStart, lotXEnd, lotYStart, lotYEnd,
    lotInCity, plaza, carPark, arterials, artBuildings,
    ccx, ccy, halfX, halfY,
    xEnd, yEnd, rng, p, tier,
  };
}

/** Tile bounds of the town/city street grid, padded so spawns land in/near the landmark. */
function cityLandmarkBounds(
  cx: number,
  cy: number,
): { minX: number; maxX: number; minY: number; maxY: number } {
  const { ox0, oy0, xEnd, yEnd, p } = computeGridLayout(cx, cy, "city");
  const pad = p.blockSize;
  return {
    minX: ox0 - pad,
    maxX: xEnd - 1 + pad,
    minY: oy0 - pad,
    maxY: yEnd - 1 + pad,
  };
}

// ── Rural: scatter isolated buildings ────────────────────────────────────────

/** True when a footprint sits on a town/city street or building (urban grids may overflow cells). */
function footprintOverlapsUrban(ox: number, oy: number, w: number, h: number): boolean {
  const reach = URBAN_REACH;
  const minCX = Math.floor((ox - reach) / SETTLEMENT_CELL) * SETTLEMENT_CELL;
  const maxCX = Math.floor((ox + w - 1 + reach) / SETTLEMENT_CELL) * SETTLEMENT_CELL;
  const minCY = Math.floor((oy - reach) / SETTLEMENT_CELL) * SETTLEMENT_CELL;
  const maxCY = Math.floor((oy + h - 1 + reach) / SETTLEMENT_CELL) * SETTLEMENT_CELL;

  for (let ucx = minCX; ucx <= maxCX; ucx += SETTLEMENT_CELL) {
    for (let ucy = minCY; ucy <= maxCY; ucy += SETTLEMENT_CELL) {
      const type = settlementType(ucx, ucy);
      if (type !== "town" && type !== "city") continue;
      for (const b of settlementBuildings(ucx, ucy)) {
        if (
          ox < b.ox + b.w &&
          ox + w > b.ox &&
          oy < b.oy + b.h &&
          oy + h > b.oy
        ) {
          return true;
        }
      }
      for (let tx = ox; tx < ox + w; tx++) {
        for (let ty = oy; ty < oy + h; ty++) {
          if (getStreetTileTypeInCell(tx, ty, ucx, ucy) !== null) return true;
        }
      }
    }
  }
  return false;
}

function ruralBuildings(cx: number, cy: number): BuildingInfo[] {
  const p = SETTLEMENT_PARAMS.rural;
  const rng = mulberry32(xmur3(`rural${cx},${cy}`)());
  const count = 1 + Math.floor(rng() * 3); // 1–3 buildings
  // Keep yards from reaching a neighbour's entrance approach
  // (approach is 1 tile out; fence sits at RURAL_FENCE_PAD).
  const gap = RURAL_FENCE_PAD + 1;
  const buildings: BuildingInfo[] = [];
  for (let i = 0; i < count; i++) {
    for (let attempt = 0; attempt < 20; attempt++) {
      const ox = cx + Math.floor((rng() * 2 - 1) * p.radius);
      const oy = cy + Math.floor((rng() * 2 - 1) * p.radius);
      const w  = p.minW + Math.floor(rng() * (p.maxW - p.minW + 1));
      const h  = p.minH + Math.floor(rng() * (p.maxH - p.minH + 1));
      const overlaps = buildings.some(
        b => ox < b.ox + b.w + gap && ox + w + gap > b.ox &&
             oy < b.oy + b.h + gap && oy + h + gap > b.oy,
      );
      if (overlaps || footprintOverlapsUrban(ox, oy, w, h)) continue;
      if (buildingFootprintBlockedByPlayerStructures(ox, oy, w, h)) continue;
      if (birchportBarracksOverlapsFootprint(ox, oy, w, h)) continue;
      buildings.push(makeBuilding(ox, oy, w, h, rng, buildings, {
        chimneyChance: HOUSE_CHIMNEY_CHANCE_RURAL,
      }));
      break;
    }
  }
  return buildings;
}

// ── City: street grid → lots → typed buildings ───────────────────────────────
//
// Type-first generation: buildings are packed along each lot's east and south
// street frontages (the two faces that can carry a visible door with a
// pavement approach).  A city-wide landmark pass seeds one of each capped
// type into best-fitting lots, then a fill pass packs the remaining frontage —
// downtown with commercial façades, outskirts with dense house strips.

type CityLot = {
  lx: number; lxEnd: number; ly: number; lyEnd: number;
  zone: CityZone;
  /** Soft industrial wedge — warehouses cluster here. */
  inWedge: boolean;
  /** Normalized distance from the city centre (0 = core). */
  dist: number;
  /**
   * Along-street span [from, to) of the east/south lot edge actually covered
   * by a street band — buildings only pack where a pavement approach exists.
   * null = no street on that edge (outer lots, short streets).
   */
  eastRange: [number, number] | null;
  southRange: [number, number] | null;
};

/** Frontages that can carry a door: east edge (SE face) / south edge (SW face). */
type Frontage = "E" | "S";

/** Max placement attempts per frontage during the fill pass. */
const FRONTAGE_FILL_ATTEMPTS = 24;
/** A neighbour counts as beside the station when the alley is at most this wide. */
const POLICE_SANDWICH_GAP = 1;

function policeFacesEast(b: BuildingInfo): boolean {
  return b.entranceX === b.ox + b.w - 1;
}

function rangesOverlap(
  a0: number,
  a1: number,
  b0: number,
  b1: number,
  min: number,
): boolean {
  return Math.min(a1, b1) - Math.max(a0, b0) >= min;
}

/** True when a building sits on both the east and south streets of its lot. */
function buildingOnLotCorner(b: BuildingInfo, lots: CityLot[]): boolean {
  const lot = lots.find(
    (l) =>
      b.ox >= l.lx &&
      b.ox + b.w <= l.lxEnd &&
      b.oy >= l.ly &&
      b.oy + b.h <= l.lyEnd,
  );
  if (!lot?.eastRange || !lot.southRange) return false;
  const flushEast =
    b.ox + b.w === lot.lxEnd &&
    b.oy >= lot.eastRange[0] &&
    b.oy + b.h <= lot.eastRange[1];
  const flushSouth =
    b.oy + b.h === lot.lyEnd &&
    b.ox >= lot.southRange[0] &&
    b.ox + b.w <= lot.southRange[1];
  return flushEast && flushSouth;
}

/** True when another building sits on both sides along the station's street. */
function policeSandwiched(police: BuildingInfo, buildings: BuildingInfo[]): boolean {
  const beside = (near: number, otherFar: number) =>
    otherFar <= near && near - otherFar <= POLICE_SANDWICH_GAP;
  const others = buildings.filter((b) => b !== police);
  if (policeFacesEast(police)) {
    const north = others.some(
      (b) =>
        beside(police.oy, b.oy + b.h) &&
        rangesOverlap(police.ox, police.ox + police.w, b.ox, b.ox + b.w, 3),
    );
    const south = others.some(
      (b) =>
        beside(b.oy, police.oy + police.h) &&
        rangesOverlap(police.ox, police.ox + police.w, b.ox, b.ox + b.w, 3),
    );
    return north && south;
  }
  const west = others.some(
    (b) =>
      beside(police.ox, b.ox + b.w) &&
      rangesOverlap(police.oy, police.oy + police.h, b.oy, b.oy + b.h, 3),
  );
  const east = others.some(
    (b) =>
      beside(b.ox, police.ox + police.w) &&
      rangesOverlap(police.oy, police.oy + police.h, b.oy, b.oy + b.h, 3),
  );
  return west && east;
}

function gridBuildings(cx: number, cy: number): BuildingInfo[] {
  const layout = computeGridLayout(cx, cy, "city");
  const {
    numV, numH, numCols, numRows, lotXStart, lotXEnd, lotYStart, lotYEnd,
    vExtents, hExtents, lotInCity, plaza, carPark, ccx, ccy, halfX, halfY, rng,
  } = layout;

  const industryAngle = seededRandom(`district:${cx},${cy}`)() * Math.PI * 2;

  const intersectRange = (
    a0: number, a1: number, b0: number, b1: number,
  ): [number, number] | null => {
    const from = Math.max(a0, b0);
    const to = Math.min(a1, b1);
    return to - from >= 3 ? [from, to] : null;
  };

  const lots: CityLot[] = [];
  for (let col = 0; col < numCols; col++) {
    for (let row = 0; row < numRows; row++) {
      if (!lotInCity[col]![row] || plaza[col]![row] || carPark[col]![row]) continue;
      const nx = (col - ccx) / halfX;
      const ny = (row - ccy) / halfY;
      const dist = Math.hypot(nx, ny);
      const inWedge =
        Math.abs(angleDiff(Math.atan2(ny, nx), industryAngle)) < 0.7;

      const lx = lotXStart[col]!;
      const lxEnd = lotXEnd[col]!;
      const ly = lotYStart[row]!;
      const lyEnd = lotYEnd[row]!;

      // Buildings only pack where the adjacent street band actually runs, so
      // every street-facing door opens onto pavement.
      const eastRange =
        col < numV
          ? intersectRange(ly, lyEnd, vExtents[col]![0], vExtents[col]![1])
          : null;
      const southRange =
        row < numH
          ? intersectRange(lx, lxEnd, hExtents[row]![0], hExtents[row]![1])
          : null;
      if (!eastRange && !southRange) continue;

      lots.push({
        lx, lxEnd, ly, lyEnd,
        zone: "outskirts", inWedge, dist, eastRange, southRange,
      });
    }
  }

  // Downtown = the innermost share of lots (rank-based, so small cities still
  // get a real core with police / offices / retail).
  const downtownCount = Math.max(
    DOWNTOWN_LOTS_MIN,
    Math.min(DOWNTOWN_LOTS_MAX, Math.round(lots.length * DOWNTOWN_LOT_SHARE)),
  );
  [...lots]
    .sort((a, b) => a.dist - b.dist)
    .slice(0, Math.min(downtownCount, lots.length))
    .forEach((lot) => {
      lot.zone = "downtown";
      lot.inWedge = false;
    });

  const buildings: BuildingInfo[] = [];
  const counts: Partial<Record<CityBuildingType, number>> = {};

  // Birchport turns the hospital-neighbor supermarket into a department
  // store after this pass. Hold that slot out of the fill cap so the city
  // still ends at maxPerCity, including that store.
  const retailReserved = isPlayerSpawnHubCell(cx, cy) ? 1 : 0;

  const capLeft = (type: CityBuildingType): boolean => {
    const spec = CITY_BUILDING_SPECS[type];
    const reserved = type === "large_retail" ? retailReserved : 0;
    return (counts[type] ?? 0) < spec.maxPerCity - reserved;
  };

  const overlapsPlaced = (bx: number, by: number, w: number, h: number, gap: number): boolean =>
    buildings.some(
      (b) =>
        bx < b.ox + b.w + gap && bx + w + gap > b.ox &&
        by < b.oy + b.h + gap && by + h + gap > b.oy,
    );

  const rollLevels = (spec: CityBuildingSpec): number =>
    spec.minLevels + Math.floor(rng() * (spec.maxLevels - spec.minLevels + 1));

  /** Roll a footprint for `type`, long axis along the frontage, within lot caps. */
  const rollFootprint = (
    type: CityBuildingType,
    frontage: Frontage,
    maxW: number,
    maxH: number,
  ): { w: number; h: number } | null => {
    const spec = CITY_BUILDING_SPECS[type];
    if (spec.longSide) {
      const { short, minLong, maxLong } = spec.longSide;
      const longMax = Math.min(maxLong, frontage === "E" ? maxH : maxW);
      const shortMax = frontage === "E" ? maxW : maxH;
      if (longMax < minLong || shortMax < short) return null;
      const long = minLong + Math.floor(rng() * (longMax - minLong + 1));
      return frontage === "E" ? { w: short, h: long } : { w: long, h: short };
    }
    if (maxW < spec.minW || maxH < spec.minH) return null;
    const w = spec.minW + Math.floor(rng() * (Math.min(spec.maxW, maxW) - spec.minW + 1));
    const h = spec.minH + Math.floor(rng() * (Math.min(spec.maxH, maxH) - spec.minH + 1));
    return { w, h };
  };

  /**
   * Place one `type` building flush against a lot frontage (first free slot
   * scanning along the street).  Door is locked to the street-facing wall so
   * the entrance approach is always pavement.
   */
  const tryPlaceOnFrontage = (
    lot: CityLot,
    type: CityBuildingType,
    frontage: Frontage,
    gap: number,
  ): BuildingInfo | null => {
    const range = frontage === "E" ? lot.eastRange : lot.southRange;
    if (!range) return null;
    const spec = CITY_BUILDING_SPECS[type];
    const lotW = lot.lxEnd - lot.lx;
    const lotH = lot.lyEnd - lot.ly;
    // Depth uses the full lot; the along-street axis is clipped to the span
    // actually covered by the street band (guarantees pavement at the door).
    const maxW = frontage === "E" ? lotW : range[1] - range[0];
    const maxH = frontage === "E" ? range[1] - range[0] : lotH;
    const fp = rollFootprint(type, frontage, maxW, maxH);
    if (!fp) return null;

    const make = (bx: number, by: number): BuildingInfo =>
      makeBuilding(bx, by, fp.w, fp.h, rng, buildings, {
        buildingType: type,
        exteriorLevels: rollLevels(spec),
        fillsLot: fp.w >= lotW && fp.h >= lotH,
        chimneyChance:
          type === "house" ? HOUSE_CHIMNEY_CHANCE_CITY : undefined,
        houseRooms: type === "house",
        entrance: {
          faces: [frontage === "E" ? "SE" : "SW"],
          insetFromCorners: spec.doorInsetFromCorners,
          centered: spec.doorCentered,
          span: spec.doorSpan,
        },
      });

    if (frontage === "E") {
      const bx = lot.lxEnd - fp.w;
      for (let by = range[0]; by + fp.h <= range[1]; by++) {
        if (overlapsPlaced(bx, by, fp.w, fp.h, gap)) continue;
        if (buildingFootprintBlockedByPlayerStructures(bx, by, fp.w, fp.h)) {
          continue;
        }
        return make(bx, by);
      }
    } else {
      const by = lot.lyEnd - fp.h;
      for (let bx = range[0]; bx + fp.w <= range[1]; bx++) {
        if (overlapsPlaced(bx, by, fp.w, fp.h, gap)) continue;
        if (buildingFootprintBlockedByPlayerStructures(bx, by, fp.w, fp.h)) {
          continue;
        }
        return make(bx, by);
      }
    }
    return null;
  };

  /** Flush the 7x7 station into the lot's street intersection. */
  const tryPlacePoliceCorner = (lot: CityLot): BuildingInfo | null => {
    if (lot.zone !== "downtown") return null;
    if (!lot.eastRange || !lot.southRange) return null;
    const spec = CITY_BUILDING_SPECS.police_station;
    const w = spec.minW;
    const h = spec.minH;
    const bx = lot.lxEnd - w;
    const by = lot.lyEnd - h;
    if (bx < lot.lx || by < lot.ly) return null;
    if (by < lot.eastRange[0] || by + h > lot.eastRange[1]) return null;
    if (bx < lot.southRange[0] || bx + w > lot.southRange[1]) return null;
    if (overlapsPlaced(bx, by, w, h, 1)) return null;
    if (buildingFootprintBlockedByPlayerStructures(bx, by, w, h)) return null;
    return makeBuilding(bx, by, w, h, rng, buildings, {
      buildingType: "police_station",
      exteriorLevels: spec.minLevels,
      fillsLot: w >= lot.lxEnd - lot.lx && h >= lot.lyEnd - lot.ly,
      entrance: { faces: ["SE", "SW"], centered: true, span: spec.doorSpan },
    });
  };

  const place = (bld: BuildingInfo, type: CityBuildingType): void => {
    buildings.push(bld);
    counts[type] = (counts[type] ?? 0) + 1;
  };

  // ── Landmark pass: seed one of each capped type city-wide ──────────────────
  const shuffledLots = [...lots];
  for (let i = shuffledLots.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = shuffledLots[i]!;
    shuffledLots[i] = shuffledLots[j]!;
    shuffledLots[j] = tmp;
  }

  /** Drop the station into a gap that already has a building on both sides. */
  const tryPlacePoliceSandwich = (): BuildingInfo | null => {
    const spec = CITY_BUILDING_SPECS.police_station;
    const w = spec.minW;
    const h = spec.minH;
    const fitsBetween = (bx: number, by: number, face: "SE" | "SW"): boolean => {
      if (overlapsPlaced(bx, by, w, h, 0)) return false;
      if (buildingFootprintBlockedByPlayerStructures(bx, by, w, h)) return false;
      const ghost = {
        ox: bx,
        oy: by,
        w,
        h,
        entranceX: face === "SE" ? bx + w - 1 : bx,
        entranceY: face === "SW" ? by + h - 1 : by,
        buildingType: "police_station",
      } as BuildingInfo;
      return policeSandwiched(ghost, buildings);
    };
    const build = (bx: number, by: number, face: "SE" | "SW", lot: CityLot) =>
      makeBuilding(bx, by, w, h, rng, buildings, {
        buildingType: "police_station",
        exteriorLevels: spec.minLevels,
        fillsLot: w >= lot.lxEnd - lot.lx && h >= lot.lyEnd - lot.ly,
        entrance: { faces: [face], centered: true, span: spec.doorSpan },
      });
    for (const lot of shuffledLots) {
      if (lot.zone !== "downtown") continue;
      if (lot.eastRange) {
        const bx = lot.lxEnd - w;
        if (bx >= lot.lx) {
          for (let by = lot.eastRange[0]; by + h <= lot.eastRange[1]; by++) {
            if (by < lot.ly || by + h > lot.lyEnd) continue;
            if (fitsBetween(bx, by, "SE")) return build(bx, by, "SE", lot);
          }
        }
      }
      if (lot.southRange) {
        const by = lot.lyEnd - h;
        if (by >= lot.ly) {
          for (let bx = lot.southRange[0]; bx + w <= lot.southRange[1]; bx++) {
            if (bx < lot.lx || bx + w > lot.lxEnd) continue;
            if (fitsBetween(bx, by, "SW")) return build(bx, by, "SW", lot);
          }
        }
      }
    }
    return null;
  };

  const seatPoliceStation = (): void => {
    const index = buildings.findIndex((b) => b.buildingType === "police_station");
    if (index < 0) return;
    const current = buildings[index]!;
    if (buildingOnLotCorner(current, lots) || policeSandwiched(current, buildings)) return;
    buildings.splice(index, 1);
    let next: BuildingInfo | null = null;
    for (const lot of shuffledLots) {
      next = tryPlacePoliceCorner(lot);
      if (next) break;
    }
    if (!next) next = tryPlacePoliceSandwich();
    buildings.push(next ?? current);
  };

  // Civic anchors first (hospital / police), then the big-box types that eat
  // whole frontages, then the rest.
  const LANDMARK_ORDER: CityBuildingType[] = [
    "hospital", "police_station", "supermarket", "large_retail", "office",
    "warehouse", "apartment", "motel", "diner", "gun_shop",
  ];

  for (const type of LANDMARK_ORDER) {
    const spec = CITY_BUILDING_SPECS[type];
    if (!Number.isFinite(spec.maxPerCity)) continue;
    // Claim a street corner before the block fills in. A later pass can still
    // tuck the station between two buildings if every corner is taken.
    if (type === "police_station") {
      let corner: BuildingInfo | null = null;
      for (const lot of shuffledLots) {
        corner = tryPlacePoliceCorner(lot);
        if (corner) break;
      }
      if (corner) {
        place(corner, type);
        continue;
      }
    }
    // Warehouses prefer the industrial wedge; fall back to any outskirts lot.
    const pools =
      type === "warehouse"
        ? [
            shuffledLots.filter((l) => l.zone === spec.zone && l.inWedge),
            shuffledLots.filter((l) => l.zone === spec.zone && !l.inWedge),
          ]
        : [shuffledLots.filter((l) => l.zone === spec.zone)];

    let placed: BuildingInfo | null = null;
    outer: for (const pool of pools) {
      for (const lot of pool) {
        const frontages: Frontage[] = rng() < 0.5 ? ["E", "S"] : ["S", "E"];
        for (const f of frontages) {
          // Footprint is rolled per attempt — retry so one large roll does
          // not disqualify a lot a smaller in-spec roll would fit.
          for (let attempt = 0; attempt < 3; attempt++) {
            placed = tryPlaceOnFrontage(lot, type, f, 1);
            if (placed) break outer;
          }
        }
      }
    }
    if (placed) place(placed, type);
  }

  // ── Fill pass: pack remaining frontage on every lot ─────────────────────────
  const pickFillType = (lot: CityLot): CityBuildingType | null => {
    const pool: { type: CityBuildingType; weight: number }[] = [];
    for (const [type, spec] of Object.entries(CITY_BUILDING_SPECS) as
      [CityBuildingType, CityBuildingSpec][]) {
      if (spec.zone !== lot.zone) continue;
      if (!capLeft(type)) continue;
      // Warehouses stay clustered in the industrial wedge.
      if (type === "warehouse" && !lot.inWedge) continue;
      pool.push({ type, weight: spec.weight });
    }
    if (pool.length === 0) return null;
    const total = pool.reduce((sum, e) => sum + e.weight, 0);
    let roll = rng() * total;
    for (const e of pool) {
      roll -= e.weight;
      if (roll <= 0) return e.type;
    }
    return pool[pool.length - 1]!.type;
  };

  for (const lot of lots) {
    // Almost every lot builds out — mild thinning toward the fringe.
    const buildChance =
      lot.zone === "downtown" ? 0.97 : Math.max(0.7, 1.02 - lot.dist * 0.3);
    if (rng() > buildChance) continue;

    for (const frontage of ["E", "S"] as Frontage[]) {
      for (let attempt = 0; attempt < FRONTAGE_FILL_ATTEMPTS; attempt++) {
        const type = pickFillType(lot);
        if (!type) break;
        // Downtown façades run flush-to-1-tile; outskirts houses keep yard gaps.
        const gap =
          lot.zone === "downtown"
            ? (rng() < 0.5 ? 0 : 1)
            : type === "house"
              ? (rng() < 0.75 ? 1 : 2)
              : 1;
        const bld = tryPlaceOnFrontage(lot, type, frontage, gap);
        if (bld) place(bld, type);
      }
    }
  }

  // Birchport: swap the supermarket beside the hospital for large retail so
  // the ward entrance isn't flanked by a Red Order market. One retail slot
  // was held back above so this swap does not push the city over the cap.
  if (isPlayerSpawnHubCell(cx, cy)) {
    replaceBirchportHospitalNeighborSupermarket(buildings);
  }

  seatPoliceStation();

  return buildings;
}

/**
 * Convert the supermarket closest to Birchport's hospital into large retail.
 * Same big-box footprint; different type/interior (and no Red Order ownership).
 */
function replaceBirchportHospitalNeighborSupermarket(
  buildings: BuildingInfo[],
): void {
  const hospital = buildings.find((b) => b.buildingType === "hospital");
  if (!hospital) return;

  const hx = hospital.ox + hospital.w / 2;
  const hy = hospital.oy + hospital.h / 2;
  let best: BuildingInfo | null = null;
  let bestDist = Infinity;
  for (const b of buildings) {
    if (b.buildingType !== "supermarket") continue;
    const bx = b.ox + b.w / 2;
    const by = b.oy + b.h / 2;
    const dist = Math.hypot(bx - hx, by - hy);
    if (dist < bestDist) {
      bestDist = dist;
      best = b;
    }
  }
  if (!best) return;

  best.buildingType = "large_retail";
  best.exteriorLevels = CITY_BUILDING_SPECS.large_retail.minLevels;
  best.houseRooms = false;
}

/** Tile bounds around rural building cluster — zombies spawn in/near the homestead. */
function ruralLandmarkBounds(
  cx: number,
  cy: number,
): { minX: number; maxX: number; minY: number; maxY: number } | null {
  const buildings = ruralBuildings(cx, cy);
  if (buildings.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const b of buildings) {
    minX = Math.min(minX, b.ox);
    minY = Math.min(minY, b.oy);
    maxX = Math.max(maxX, b.ox + b.w - 1);
    maxY = Math.max(maxY, b.oy + b.h - 1);
  }

  const pad = SETTLEMENT_PARAMS.rural.radius;
  const cellMaxX = cx + SETTLEMENT_CELL - 1;
  const cellMaxY = cy + SETTLEMENT_CELL - 1;
  return {
    minX: Math.max(cx, minX - pad),
    maxX: Math.min(cellMaxX, maxX + pad),
    minY: Math.max(cy, minY - pad),
    maxY: Math.min(cellMaxY, maxY + pad),
  };
}

// ── Per-cell building list ────────────────────────────────────────────────────

const settlementBuildingsCache = new Map<string, BuildingInfo[]>();

/**
 * Overworld tiles occupied by player-built structures (wall/door/fireplace/
 * prefab) plus world landmarks such as the Birchport barracks yard. Worldgen
 * skips footprints that touch any of these so a deploy that widens
 * motels/houses cannot place a building over an existing base or compound.
 */
const buildingPlacementBlockedTiles = new Set<string>(
  birchportBarracksPlacementTileKeys(),
);

function buildingPlacementTileKey(tx: number, ty: number): string {
  return `${Math.floor(tx)},${Math.floor(ty)}`;
}

/** True when any tile of the footprint is reserved by a player structure. */
export function buildingFootprintBlockedByPlayerStructures(
  ox: number,
  oy: number,
  w: number,
  h: number,
): boolean {
  if (buildingPlacementBlockedTiles.size === 0) return false;
  for (let y = oy; y < oy + h; y++) {
    for (let x = ox; x < ox + w; x++) {
      if (buildingPlacementBlockedTiles.has(buildingPlacementTileKey(x, y))) {
        return true;
      }
    }
  }
  return false;
}

function invalidateBuildingPlacementCaches(): void {
  settlementBuildingsCache.clear();
  for (const fences of settlementFencesCache.values()) {
    clearCellFenceIndex(fences);
  }
  settlementFencesCache.clear();
  buildingAtTileCache.clear();
  buildingsNearTileCache.clear();
}

/** Replace the blocked-tile set (e.g. after structuresSync / server boot). */
export function syncBuildingPlacementBlockedTiles(
  tiles: Iterable<string>,
): void {
  buildingPlacementBlockedTiles.clear();
  for (const t of tiles) buildingPlacementBlockedTiles.add(t);
  for (const t of birchportBarracksPlacementTileKeys()) {
    buildingPlacementBlockedTiles.add(t);
  }
  invalidateBuildingPlacementCaches();
}

/** Reserve / free a single overworld tile for building placement. */
export function setBuildingPlacementBlockedTile(
  tx: number,
  ty: number,
  blocked: boolean,
): void {
  if (!blocked && birchportBarracksBlocksBuildingPlacement(tx, ty)) return;
  const key = buildingPlacementTileKey(tx, ty);
  const changed = blocked
    ? !buildingPlacementBlockedTiles.has(key) &&
      (buildingPlacementBlockedTiles.add(key), true)
    : buildingPlacementBlockedTiles.delete(key);
  if (changed) invalidateBuildingPlacementCaches();
}

function settlementCellKey(cx: number, cy: number): string {
  return `${cx}:${cy}`;
}

/** Buildings whose footprints overlap a tile rectangle. Cell gen is cached. */
export function listBuildingsInRect(
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
): BuildingInfo[] {
  const seen = new Set<string>();
  const out: BuildingInfo[] = [];
  for (const { cx, cy } of settlementCellsInRegion(minX, maxX, minY, maxY)) {
    for (const bld of settlementBuildings(cx, cy)) {
      if (bld.ox > maxX || bld.ox + bld.w < minX) continue;
      if (bld.oy > maxY || bld.oy + bld.h < minY) continue;
      const key = `${bld.ox},${bld.oy}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(bld);
    }
  }
  return out;
}

function settlementBuildings(cx: number, cy: number): BuildingInfo[] {
  const key = settlementCellKey(cx, cy);
  const cached = settlementBuildingsCache.get(key);
  if (cached) return cached;

  const type = settlementType(cx, cy);
  let buildings: BuildingInfo[];
  if (type === "none") buildings = [];
  else if (type === "rural") buildings = ruralBuildings(cx, cy);
  else {
    // City: grid buildings + arterial roadside-town buildings
    const layout = computeGridLayout(cx, cy, "city");
    const grid = gridBuildings(cx, cy);
    // Filter cached arterial town buildings that now overlap player bases
    // (layout cache may predate the blocked-tile set).
    const art = layout.artBuildings.filter(
      (b) =>
        !buildingFootprintBlockedByPlayerStructures(b.ox, b.oy, b.w, b.h),
    );
    buildings = art.length > 0 ? [...grid, ...art] : grid;
  }

  const barracks = barracksLandmarksInCell(cx, cy);
  if (barracks.length > 0) buildings = [...buildings, ...barracks];

  settlementBuildingsCache.set(key, buildings);
  return buildings;
}

function barracksLandmarkBuilding(
  t: BarracksTentFootprint,
  buildingType: "tent" | "mess_hall",
): BuildingInfo {
  return {
    ox: t.ox,
    oy: t.oy,
    w: t.w,
    h: t.h,
    entranceX: t.entranceX,
    entranceY: t.entranceY,
    entranceSpan: t.entranceSpan,
    fillsLot: false,
    buildingType,
    exteriorLevels: 1,
  };
}

function barracksLandmarksInCell(cx: number, cy: number): BuildingInfo[] {
  const inCell = (ox: number, oy: number) => {
    const tcx = Math.floor(ox / SETTLEMENT_CELL) * SETTLEMENT_CELL;
    const tcy = Math.floor(oy / SETTLEMENT_CELL) * SETTLEMENT_CELL;
    return tcx === cx && tcy === cy;
  };
  const out: BuildingInfo[] = BIRCHPORT_BARRACKS_TENTS.filter((t) =>
    inCell(t.ox, t.oy),
  ).map((t) => barracksLandmarkBuilding(t, "tent"));
  const mess = BIRCHPORT_BARRACKS_MESS_HALL;
  if (inCell(mess.ox, mess.oy)) {
    out.push(barracksLandmarkBuilding(mess, "mess_hall"));
  }
  return out;
}

// ── Wooden yard fences (residential lots + rural homesteads) ─────────────────

const settlementFencesCache = new Map<string, FenceInfo[]>();
/** Tile → fence panels on that tile (corners can have two). */
const fencesAtTile = new Map<string, FenceInfo[]>();

function fenceTileKey(tx: number, ty: number): string {
  return `${tx},${ty}`;
}

function buildingCoversTile(bld: BuildingInfo, tx: number, ty: number): boolean {
  return tx >= bld.ox && tx < bld.ox + bld.w && ty >= bld.oy && ty < bld.oy + bld.h;
}

/** Neighbour tiles along the fence run (perpendicular to facing). */
function fenceRunAxisNeighbors(
  tx: number,
  ty: number,
  facing: FenceFacing,
): Array<[number, number]> {
  // NE/SW panels run east–west; NW/SE panels run north–south.
  if (facing === "NE" || facing === "SW") {
    return [
      [tx - 1, ty],
      [tx + 1, ty],
    ];
  }
  return [
    [tx, ty - 1],
    [tx, ty + 1],
  ];
}

function tryPushFence(
  out: FenceInfo[],
  occupied: Set<string>,
  tx: number,
  ty: number,
  facing: FenceFacing,
  buildings: BuildingInfo[],
): void {
  const edgeKey = `${tx},${ty},${facing}`;
  if (occupied.has(edgeKey)) return;
  if (buildings.some((b) => buildingCoversTile(b, tx, ty))) return;
  if (isInBirchportBarracks(tx, ty)) return;
  if (getBirchportGraveAt(tx, ty)) return;
  if (getCellarAt(tx, ty)) return;
  if (getStreetTileType(tx, ty) !== null) return;
  // Ends of a run overhang neighbouring tiles — keep them off pavement/road.
  for (const [nx, ny] of fenceRunAxisNeighbors(tx, ty, facing)) {
    if (getStreetTileType(nx, ny) !== null) return;
  }
  if (getTreeAt(tx, ty)) return;
  occupied.add(edgeKey);
  out.push({ ox: tx, oy: ty, facing });
}

/**
 * Axis-aligned yard perimeter. `gate` tiles stay open for building entry.
 * Optional `skipSide` leaves one side open (rural partial rings).
 */
function appendYardPerimeter(
  out: FenceInfo[],
  occupied: Set<string>,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  buildings: BuildingInfo[],
  gate: Set<string>,
  skipSide: "N" | "E" | "S" | "W" | null = null,
): void {
  if (x1 - x0 < 2 || y1 - y0 < 2) return;

  const add = (tx: number, ty: number, facing: FenceFacing) => {
    if (gate.has(fenceTileKey(tx, ty))) return;
    tryPushFence(out, occupied, tx, ty, facing, buildings);
  };

  if (skipSide !== "N") {
    for (let tx = x0; tx < x1; tx++) add(tx, y0, "NE");
  }
  if (skipSide !== "S") {
    for (let tx = x0; tx < x1; tx++) add(tx, y1 - 1, "SW");
  }
  if (skipSide !== "W") {
    for (let ty = y0; ty < y1; ty++) add(x0, ty, "NW");
  }
  if (skipSide !== "E") {
    for (let ty = y0; ty < y1; ty++) add(x1 - 1, ty, "SE");
  }
}

/** Open a 1–2 tile gate on the street / entrance approach side. */
function yardGateTiles(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  bld: BuildingInfo,
): Set<string> {
  const gate = new Set<string>();
  const clamp = (v: number, lo: number, hi: number) =>
    Math.max(lo, Math.min(hi, v));

  const ex = bld.entranceX;
  const ey = bld.entranceY;
  const eastX = x1 - 1;
  const southY = y1 - 1;

  if (buildingEntranceFace(bld) === "SE") {
    const gy = clamp(ey, y0, y1 - 1);
    gate.add(fenceTileKey(eastX, gy));
    if (gy + 1 < y1) gate.add(fenceTileKey(eastX, gy + 1));
    return gate;
  }

  const gx = clamp(ex, x0, x1 - 1);
  gate.add(fenceTileKey(gx, southY));
  if (gx + 1 < x1) gate.add(fenceTileKey(gx + 1, southY));
  return gate;
}

/**
 * City yard fences are disabled under multi-building lot packing — the old
 * one-house-per-lot rings no longer match the dense strips.  Rural homestead
 * fences are unaffected.
 */
function cityResidentialFences(_cx: number, _cy: number): FenceInfo[] {
  return [];
}

function ruralHomesteadFences(cx: number, cy: number): FenceInfo[] {
  const buildings = settlementBuildings(cx, cy);
  const rng = seededRandom(`fence-rural:${cx},${cy}`);
  const out: FenceInfo[] = [];
  const occupied = new Set<string>();
  const sides: Array<"N" | "E" | "S" | "W" | null> = ["N", "E", "S", "W", null];

  // Never fence another homestead's door approach (or that house can't be entered).
  const sharedApproaches = new Set<string>();
  for (const bld of buildings) {
    for (const t of buildingEntryApproachCandidates(bld)) {
      sharedApproaches.add(fenceTileKey(t.x, t.y));
    }
  }

  for (const bld of buildings) {
    if (bld.buildingType === "tent" || bld.buildingType === "mess_hall") continue;
    if (isInBirchportBarracks(bld.ox, bld.oy)) continue;
    if (rng() > RURAL_FENCE_CHANCE) continue;

    const x0 = bld.ox - RURAL_FENCE_PAD;
    const y0 = bld.oy - RURAL_FENCE_PAD;
    const x1 = bld.ox + bld.w + RURAL_FENCE_PAD;
    const y1 = bld.oy + bld.h + RURAL_FENCE_PAD;
    const gate = yardGateTiles(x0, y0, x1, y1, bld);
    for (const key of sharedApproaches) gate.add(key);
    // Often leave one side open for a partial paddock look.
    const skipSide = rng() < 0.55 ? sides[Math.floor(rng() * 4)]! : null;
    appendYardPerimeter(out, occupied, x0, y0, x1, y1, buildings, gate, skipSide);
  }

  return out;
}

function clearCellFenceIndex(fences: FenceInfo[] | undefined) {
  if (!fences) return;
  for (const f of fences) fencesAtTile.delete(fenceTileKey(f.ox, f.oy));
}

function indexFence(f: FenceInfo) {
  const key = fenceTileKey(f.ox, f.oy);
  const list = fencesAtTile.get(key);
  if (list) list.push(f);
  else fencesAtTile.set(key, [f]);
}

function settlementFences(cx: number, cy: number): FenceInfo[] {
  const key = settlementCellKey(cx, cy);
  const cached = settlementFencesCache.get(key);
  if (cached) return cached;

  const type = settlementType(cx, cy);
  let fences: FenceInfo[];
  if (type === "rural") fences = ruralHomesteadFences(cx, cy);
  else if (type === "city") fences = cityResidentialFences(cx, cy);
  else fences = [];

  clearCellFenceIndex(settlementFencesCache.get(key));
  settlementFencesCache.set(key, fences);
  for (const f of fences) indexFence(f);
  return fences;
}

/**
 * Fence panels on tile (tx, ty). Corners may return two (e.g. NE + NW).
 * Ensures the owning settlement cell's fences are generated first.
 */
export function getFencesAt(tx: number, ty: number): FenceInfo[] {
  const pad = RURAL_FENCE_PAD + 2;
  const minCX = Math.floor((tx - pad) / SETTLEMENT_CELL) * SETTLEMENT_CELL;
  const maxCX = Math.floor((tx + pad) / SETTLEMENT_CELL) * SETTLEMENT_CELL;
  const minCY = Math.floor((ty - pad) / SETTLEMENT_CELL) * SETTLEMENT_CELL;
  const maxCY = Math.floor((ty + pad) / SETTLEMENT_CELL) * SETTLEMENT_CELL;

  for (let cx = minCX; cx <= maxCX; cx += SETTLEMENT_CELL) {
    for (let cy = minCY; cy <= maxCY; cy += SETTLEMENT_CELL) {
      settlementFences(cx, cy);
    }
  }
  return fencesAtTile.get(fenceTileKey(tx, ty)) ?? [];
}

/** First fence on a tile, or null — used by generateTile / soft cover. */
export function getFenceAt(tx: number, ty: number): FenceInfo | null {
  return getFencesAt(tx, ty)[0] ?? null;
}

/** Preferred spawn tile bounds for overworld zombies — clustered at landmarks. */
function zombieSpawnTileBounds(
  cx: number,
  cy: number,
  type: SettlementType,
): TileBounds | null {
  if (type === "city") return cityLandmarkBounds(cx, cy);
  if (type === "rural") return ruralLandmarkBounds(cx, cy) ?? settlementCellTileBounds(cx, cy);
  if (type === "none") return settlementCellTileBounds(cx, cy);
  return null;
}

/** Public spawn bounds for a settlement cell (used for exterior seal flood). */
export function getZombieSpawnTileBounds(
  cx: number,
  cy: number,
): TileBounds | null {
  return zombieSpawnTileBounds(cx, cy, getSettlementType(cx, cy));
}

/** Walkable spawn inside a tile rectangle, spread across slots (fresh roll each call). */
export function findZombieSpawnInBounds(
  _seedKey: string,
  slotIndex: number,
  count: number,
  bounds: TileBounds,
  preferStreet = false,
  opts?: { isBlocked?: (x: number, y: number) => boolean },
): { x: number; y: number } | null {
  if (count <= 0) return null;

  const rng = Math.random;
  const width = bounds.maxX - bounds.minX + 1;
  const height = bounds.maxY - bounds.minY + 1;
  if (width <= 0 || height <= 0) return null;

  const cols = Math.max(1, Math.ceil(Math.sqrt((count * width) / height)));
  const rows = Math.max(1, Math.ceil(count / cols));
  const col = slotIndex % cols;
  const row = Math.floor(slotIndex / cols) % rows;
  const cellW = width / cols;
  const cellH = height / rows;
  const baseX = bounds.minX + col * cellW + rng() * cellW;
  const baseY = bounds.minY + row * cellH + rng() * cellH;

  const tryPoint = (x: number, y: number, requireStreet: boolean) => {
    const tx = Math.floor(x);
    const ty = Math.floor(y);
    if (requireStreet && getStreetTileType(tx, ty) === null) return null;
    if (!isWalkableTile(tx, ty)) return null;
    // Same hook as findPlayerSpawn — server rejects player walls/closed doors.
    if (opts?.isBlocked?.(x, y)) return null;
    return { x, y };
  };

  const searchNear = (requireStreet: boolean, attempts: number) => {
    const direct = tryPoint(baseX, baseY, requireStreet);
    if (direct) return direct;
    for (let attempt = 0; attempt < attempts; attempt++) {
      const x = baseX + (rng() - 0.5) * cellW * 2;
      const y = baseY + (rng() - 0.5) * cellH * 2;
      const hit = tryPoint(x, y, requireStreet);
      if (hit) return hit;
    }
    return null;
  };

  if (preferStreet) {
    const streetHit = searchNear(true, 40);
    if (streetHit) return streetHit;
  }

  return searchNear(false, 60);
}

/** Walkable spawn inside one settlement cell, spread across the zone (fresh roll). */
export function findZombieSpawnInSettlementCell(
  cellKey: string,
  slotIndex: number,
  cx: number,
  cy: number,
  count: number,
  opts?: { isBlocked?: (x: number, y: number) => boolean },
): { x: number; y: number } | null {
  const type = getSettlementType(cx, cy);
  const pref = zombieSpawnTileBounds(cx, cy, type);
  if (!pref || count <= 0) return null;
  return findZombieSpawnInBounds(
    cellKey,
    slotIndex,
    count,
    pref,
    type === "city",
    opts,
  );
}

// ── Street tile type lookup ───────────────────────────────────────────────────

/**
 * Tracks recursion depth for cross-cell cap neighbour checks.
 * Prevents infinite chains when streets from many cells abut each other.
 * A depth of 1 means the world-level check is allowed once per call stack;
 * deeper calls fall back to "no street" which may leave a rare tiny cap,
 * but avoids hangs.
 */
let _capCheckDepth = 0;

/** Pavement/road for an arterial rectangle covering (tx, ty), or null. */
function arterialTileType(tx: number, ty: number, arterials: Arterial[]): TileType | null {
  for (const a of arterials) {
    if (tx < a.x0 || tx >= a.x1 || ty < a.y0 || ty >= a.y1) continue;
    const asw = a.width;
    if (a.orient === "v") {
      const rel = tx - a.x0;
      const side = rel < STREET_PAVEMENT || rel >= asw - STREET_PAVEMENT;
      const cap = a.outer === "min" ? ty === a.y0 : a.outer === "max" ? ty === a.y1 - 1 : false;
      return side || cap ? TileType.Pavement : TileType.Road;
    }
    const rel = ty - a.y0;
    const side = rel < STREET_PAVEMENT || rel >= asw - STREET_PAVEMENT;
    const cap = a.outer === "min" ? tx === a.x0 : a.outer === "max" ? tx === a.x1 - 1 : false;
    return side || cap ? TileType.Pavement : TileType.Road;
  }
  return null;
}

/** True when (tx, ty) lies in any street rectangle of this layout (road or pavement). */
function tileInStreetBand(
  tx: number,
  ty: number,
  vStreetXs: number[],
  hStreetYs: number[],
  vExtents: [number, number][],
  hExtents: [number, number][],
  arterials: Arterial[] = [],
): boolean {
  const sw = STREET_TOTAL;
  for (let c = 0; c < vStreetXs.length; c++) {
    const sx = vStreetXs[c]!;
    if (tx >= sx && tx < sx + sw) {
      const [yFrom, yTo] = vExtents[c]!;
      if (ty >= yFrom && ty < yTo) return true;
    }
  }
  for (let r = 0; r < hStreetYs.length; r++) {
    const sy = hStreetYs[r]!;
    if (ty >= sy && ty < sy + sw) {
      const [xFrom, xTo] = hExtents[r]!;
      if (tx >= xFrom && tx < xTo) return true;
    }
  }
  for (const a of arterials) {
    if (tx >= a.x0 && tx < a.x1 && ty >= a.y0 && ty < a.y1) return true;
  }
  return false;
}

/**
 * Returns the street tile type for (tx, ty) within settlement cell (cx, cy),
 * or null if the tile is not part of a street in that cell.
 *
 * Intersections use pavement only on the four corner tiles (not across the
 * crossing). Single streets use side pavement bands plus pavement end caps
 * only where the street truly dead-ends (not against another street).
 */
function getStreetTileTypeInCell(
  tx: number,
  ty: number,
  cx: number,
  cy: number,
): TileType | null {
  const type = settlementType(cx, cy);
  if (type !== "city") return null;

  const { vStreetXs, hStreetYs, vExtents, hExtents, arterials } =
    computeGridLayout(cx, cy, "city");

  const sw = STREET_TOTAL;

  // Is this tile inside a vertical street band?
  let inV      = false;
  let vRel     = 0;
  let vCapNorth = false;
  let vCapSouth = false;
  for (let c = 0; c < vStreetXs.length; c++) {
    const sx = vStreetXs[c]!;
    if (tx >= sx && tx < sx + sw) {
      const [yFrom, yTo] = vExtents[c]!;
      if (ty >= yFrom && ty < yTo) {
        inV       = true;
        vRel      = tx - sx;
        vCapNorth = ty === yFrom;
        vCapSouth = ty === yTo - 1;
        break;
      }
    }
  }

  // Is this tile inside a horizontal street band?
  let inH      = false;
  let hRel     = 0;
  let hCapWest  = false;
  let hCapEast  = false;
  for (let r = 0; r < hStreetYs.length; r++) {
    const sy = hStreetYs[r]!;
    if (ty >= sy && ty < sy + sw) {
      const [xFrom, xTo] = hExtents[r]!;
      if (tx >= xFrom && tx < xTo) {
        inH      = true;
        hRel     = ty - sy;
        hCapWest = tx === xFrom;
        hCapEast = tx === xTo - 1;
        break;
      }
    }
  }

  if (!inV && !inH) {
    return arterialTileType(tx, ty, arterials);
  }

  if (isArterialLbendInnerCorner(tx, ty, arterials)) return TileType.Pavement;

  const vPaveW = vRel < STREET_PAVEMENT;
  const vPaveE = vRel >= sw - STREET_PAVEMENT;
  const hPaveN = hRel < STREET_PAVEMENT;
  const hPaveS = hRel >= sw - STREET_PAVEMENT;
  const vSide = vPaveW || vPaveE;
  const hSide = hPaveN || hPaveS;

  // End caps only when the street dead-ends into non-street.
  // Check same-cell bands first (fast); for cross-cell cases fall back to a full
  // world-level lookup, guarded by a depth counter to prevent cascades.
  const bandArgs = [vStreetXs, hStreetYs, vExtents, hExtents, arterials] as const;

  const capNeighbourIsStreet = (nx: number, ny: number): boolean => {
    if (tileInStreetBand(nx, ny, ...bandArgs)) return true;
    if (_capCheckDepth > 0) return false; // prevent cascading cross-cell checks
    _capCheckDepth++;
    const found = getStreetTileType(nx, ny) !== null;
    _capCheckDepth--;
    return found;
  };

  // Intersection / turn — corners always paved; open arms of L/T turns pave
  // any side-band that faces non-street (full + junctions keep road through).
  if (inV && inH) {
    if (vSide && hSide) {
      // Slight bends stack overlapping arterial bands: a tile can be flagged
      // as both curbs while already lying in a continuing segment's road
      // interior.  Open to asphalt only when road continues on both sides of
      // the through axis; outer edge corners keep pavement.
      if (isRoadSurfaceAt(tx, ty)) {
        if (isRoadSurfaceAt(tx - 1, ty) && isRoadSurfaceAt(tx + 1, ty)) {
          // SE re-entrant corner of slight bends stays paved.
          if (!(vPaveE && hPaveS)) return TileType.Road;
        }
        if (isRoadSurfaceAt(tx, ty - 1) && isRoadSurfaceAt(tx, ty + 1)) {
          if (!(vPaveW && hPaveN)) return TileType.Road;
        }
      }
      return TileType.Pavement;
    }
    // Open T/L mouths — same as single-orientation (joining road interior width).
    if (hPaveN && isRoadSurfaceAt(tx, ty - 1)) return TileType.Road;
    if (hPaveS && isRoadSurfaceAt(tx, ty + 1)) return TileType.Road;
    if (vPaveW && isRoadSurfaceAt(tx - 1, ty)) return TileType.Road;
    if (vPaveE && isRoadSurfaceAt(tx + 1, ty)) return TileType.Road;
    if (hPaveN && !capNeighbourIsStreet(tx, ty - 1)) return TileType.Pavement;
    if (hPaveS && !capNeighbourIsStreet(tx, ty + 1)) return TileType.Pavement;
    if (vPaveW && !capNeighbourIsStreet(tx - 1, ty)) return TileType.Pavement;
    if (vPaveE && !capNeighbourIsStreet(tx + 1, ty)) return TileType.Pavement;
    return TileType.Road;
  }

  // Single-orientation: open T-junction mouths for joining road interior only.
  if (inV) {
    if (vPaveW && vPaveE) return TileType.Road;
    if (vPaveW && isRoadSurfaceAt(tx - 1, ty)) return TileType.Road;
    if (vPaveE && isRoadSurfaceAt(tx + 1, ty)) return TileType.Road;
    const onCap =
      (vCapNorth && !capNeighbourIsStreet(tx, ty - 1)) ||
      (vCapSouth && !capNeighbourIsStreet(tx, ty + 1));
    return vSide || onCap ? TileType.Pavement : TileType.Road;
  }

  if (hPaveN && hPaveS) return TileType.Road;
  if (hPaveN && isRoadSurfaceAt(tx, ty - 1)) return TileType.Road;
  if (hPaveS && isRoadSurfaceAt(tx, ty + 1)) return TileType.Road;
  const onCap =
    (hCapWest && !capNeighbourIsStreet(tx - 1, ty)) ||
    (hCapEast && !capNeighbourIsStreet(tx + 1, ty));
  return hSide || onCap ? TileType.Pavement : TileType.Road;
}

/**
 * True when (tx, ty) lies in the road *surface* of some street band (not a
 * side-pavement strip).  Used to open T-junction mouths for exactly the
 * joining road's interior width (4 tiles on town side roads) without
 * removing the arterial's corner pavement.
 */
/**
 * Arterials are stored on both endpoint cities. An L-bend can fall outside
 * URBAN_REACH of each of them, so a local cell scan draws only a sliver of
 * the road. The map chart paints the whole segment from the city layout, and
 * that sliver's live tiles then hide the chart until the player walks away.
 * Index every segment onto the cells it crosses, and fill that index from
 * the full inter-city search the first time a cell is queried.
 */
const arterialsByCell = new Map<string, Arterial[]>();
const arterialCellReady = new Set<string>();
const arterialCellPending = new Set<string>();

function arterialCellKey(cx: number, cy: number): string {
  return `${cx}:${cy}`;
}

function arterialCellOrigin(tile: number): number {
  return Math.floor(tile / SETTLEMENT_CELL) * SETTLEMENT_CELL;
}

function indexLayoutArterials(arterials: readonly Arterial[]): void {
  for (const a of arterials) {
    const key = arterialSegmentKey(a);
    const minCX = arterialCellOrigin(a.x0);
    const maxCX = arterialCellOrigin(a.x1 - 1);
    const minCY = arterialCellOrigin(a.y0);
    const maxCY = arterialCellOrigin(a.y1 - 1);
    for (let cy = minCY; cy <= maxCY; cy += SETTLEMENT_CELL) {
      for (let cx = minCX; cx <= maxCX; cx += SETTLEMENT_CELL) {
        const cell = arterialCellKey(cx, cy);
        let bucket = arterialsByCell.get(cell);
        if (!bucket) {
          bucket = [];
          arterialsByCell.set(cell, bucket);
        }
        if (bucket.some((seg) => arterialSegmentKey(seg) === key)) continue;
        bucket.push(a);
      }
    }
  }
}

function ensureArterialsIndexedAt(tx: number, ty: number): void {
  const rx = arterialCellOrigin(tx);
  const ry = arterialCellOrigin(ty);
  const key = arterialCellKey(rx, ry);
  if (arterialCellReady.has(key) || arterialCellPending.has(key)) return;
  arterialCellPending.add(key);
  const reach = INTER_CITY_SEARCH_CELLS * SETTLEMENT_CELL;
  const minCX = arterialCellOrigin(rx - reach);
  const maxCX = arterialCellOrigin(rx + SETTLEMENT_CELL - 1 + reach);
  const minCY = arterialCellOrigin(ry - reach);
  const maxCY = arterialCellOrigin(ry + SETTLEMENT_CELL - 1 + reach);
  for (let cy = minCY; cy <= maxCY; cy += SETTLEMENT_CELL) {
    for (let cx = minCX; cx <= maxCX; cx += SETTLEMENT_CELL) {
      getCachedLayout(cx, cy);
    }
  }
  arterialCellPending.delete(key);
  arterialCellReady.add(key);
}

function arterialsIndexedAt(tx: number, ty: number): readonly Arterial[] {
  ensureArterialsIndexedAt(tx, ty);
  return (
    arterialsByCell.get(
      arterialCellKey(arterialCellOrigin(tx), arterialCellOrigin(ty)),
    ) ?? []
  );
}

function roadInteriorOnArterial(
  tx: number,
  ty: number,
  a: Arterial,
  inRoadInterior: (rel: number, width: number) => boolean,
): boolean {
  if (tx < a.x0 || tx >= a.x1 || ty < a.y0 || ty >= a.y1) return false;
  if (a.orient === "v") return inRoadInterior(tx - a.x0, a.width);
  return inRoadInterior(ty - a.y0, a.width);
}

function isRoadSurfaceAt(tx: number, ty: number): boolean {
  const sw = STREET_TOTAL;
  const reach = URBAN_REACH;
  const minCX = Math.floor((tx - reach) / SETTLEMENT_CELL) * SETTLEMENT_CELL;
  const maxCX = Math.floor((tx + reach) / SETTLEMENT_CELL) * SETTLEMENT_CELL;
  const minCY = Math.floor((ty - reach) / SETTLEMENT_CELL) * SETTLEMENT_CELL;
  const maxCY = Math.floor((ty + reach) / SETTLEMENT_CELL) * SETTLEMENT_CELL;

  const inRoadInterior = (rel: number, width: number): boolean =>
    rel >= STREET_PAVEMENT && rel < width - STREET_PAVEMENT;

  for (let cx = minCX; cx <= maxCX; cx += SETTLEMENT_CELL) {
    for (let cy = minCY; cy <= maxCY; cy += SETTLEMENT_CELL) {
      const layout = getCachedLayout(cx, cy);
      if (!layout) continue;
      const { vStreetXs, hStreetYs, vExtents, hExtents, arterials } = layout;

      for (let c = 0; c < vStreetXs.length; c++) {
        const sx = vStreetXs[c]!;
        if (tx < sx || tx >= sx + sw) continue;
        const [yF, yT] = vExtents[c]!;
        if (ty < yF || ty >= yT) continue;
        if (inRoadInterior(tx - sx, sw)) return true;
      }
      for (let r = 0; r < hStreetYs.length; r++) {
        const sy = hStreetYs[r]!;
        if (ty < sy || ty >= sy + sw) continue;
        const [xF, xT] = hExtents[r]!;
        if (tx < xF || tx >= xT) continue;
        if (inRoadInterior(ty - sy, sw)) return true;
      }
      for (const a of arterials) {
        if (roadInteriorOnArterial(tx, ty, a, inRoadInterior)) return true;
      }
    }
  }
  for (const a of arterialsIndexedAt(tx, ty)) {
    if (roadInteriorOnArterial(tx, ty, a, inRoadInterior)) return true;
  }
  return false;
}

/**
 * Re-entrant pavement at the inner vertex of a 1-tile arterial L-bend
 * (two H segments one row apart sharing a connector V, or the vertical mirror).
 */
function isArterialLbendInnerCorner(
  tx: number,
  ty: number,
  arterials: Arterial[],
): boolean {
  const rd = STREET_ROAD;
  const pv = STREET_PAVEMENT;
  const sw = STREET_TOTAL;

  for (const v of arterials) {
    if (v.orient !== "v" || v.outer !== "none") continue;
    const bendX = v.x0;
    const hs = arterials.filter(
      a =>
        a.orient === "h" &&
        a.outer === "none" &&
        a.x0 < bendX + sw &&
        a.x1 > bendX,
    );
    const yLevels = [...new Set(hs.map(a => a.y0))].sort((a, b) => a - b);
    for (let i = 0; i < yLevels.length - 1; i++) {
      const yLo = yLevels[i]!;
      const yHi = yLevels[i + 1]!;
      if (yHi - yLo !== 1) continue;
      if (tx === bendX + rd && ty === yHi) return true;
      if (tx === bendX + pv && ty === yHi + rd) return true;
    }
  }

  for (const h of arterials) {
    if (h.orient !== "h" || h.outer !== "none") continue;
    const bendY = h.y0;
    const vs = arterials.filter(
      a =>
        a.orient === "v" &&
        a.outer === "none" &&
        a.y0 < bendY + sw &&
        a.y1 > bendY,
    );
    const xLevels = [...new Set(vs.map(a => a.x0))].sort((a, b) => a - b);
    for (let i = 0; i < xLevels.length - 1; i++) {
      const xLo = xLevels[i]!;
      const xHi = xLevels[i + 1]!;
      if (xHi - xLo !== 1) continue;
      if (tx === xHi && ty === bendY + rd) return true;
      if (tx === xHi + rd && ty === bendY + pv) return true;
    }
  }

  return false;
}

/**
 * Returns the street tile type for the given world tile, or null.
 *
 * Collects global V-band and H-band membership across ALL nearby settlement
 * cells, then resolves the tile type:
 *
 *   • both V and H → intersection / turn
 *       – pavement at corners (both side-bands)
 *       – pavement on any side-band that faces open land (L/T open arms)
 *       – road where the street continues through
 *   • only V → side-pavement + dead-end caps
 *   • only H → side-pavement + dead-end caps
 */
export function getStreetTileType(tx: number, ty: number): TileType | null {
  const sw = STREET_TOTAL;
  const reach = URBAN_REACH;
  const minCX = Math.floor((tx - reach) / SETTLEMENT_CELL) * SETTLEMENT_CELL;
  const maxCX = Math.floor((tx + reach) / SETTLEMENT_CELL) * SETTLEMENT_CELL;
  const minCY = Math.floor((ty - reach) / SETTLEMENT_CELL) * SETTLEMENT_CELL;
  const maxCY = Math.floor((ty + reach) / SETTLEMENT_CELL) * SETTLEMENT_CELL;

  // Accumulated membership flags (side bands tracked per edge for L/T caps)
  let hasV = false, vPaveW = false, vPaveE = false, vCapN = false, vCapS = false;
  let hasH = false, hPaveN = false, hPaveS = false, hCapW = false, hCapE = false;
  const allArterials: Arterial[] = [];
  const artKeys = new Set<string>();
  const noteArterial = (a: Arterial) => {
    const key = arterialSegmentKey(a);
    if (!artKeys.has(key)) {
      artKeys.add(key);
      allArterials.push(a);
    }
    if (tx < a.x0 || tx >= a.x1 || ty < a.y0 || ty >= a.y1) return;
    const asw = a.width;
    if (a.orient === "v") {
      hasV = true;
      const rel = tx - a.x0;
      if (rel < STREET_PAVEMENT) vPaveW = true;
      if (rel >= asw - STREET_PAVEMENT) vPaveE = true;
      // Segment ends always eligible for caps; open arms of L-turns are
      // handled by the intersection rule below via neighbour checks.
      if (ty === a.y0) vCapN = true;
      if (ty === a.y1 - 1) vCapS = true;
    } else {
      hasH = true;
      const rel = ty - a.y0;
      if (rel < STREET_PAVEMENT) hPaveN = true;
      if (rel >= asw - STREET_PAVEMENT) hPaveS = true;
      if (tx === a.x0) hCapW = true;
      if (tx === a.x1 - 1) hCapE = true;
    }
  };

  for (let cx = minCX; cx <= maxCX; cx += SETTLEMENT_CELL) {
    for (let cy = minCY; cy <= maxCY; cy += SETTLEMENT_CELL) {
      const layout = getCachedLayout(cx, cy);
      if (!layout) continue;
      const { vStreetXs, hStreetYs, vExtents, hExtents, arterials } = layout;

      // ── Vertical street bands ──────────────────────────────────────────
      for (let c = 0; c < vStreetXs.length; c++) {
        const sx = vStreetXs[c]!;
        if (tx < sx || tx >= sx + sw) continue;
        const [yF, yT] = vExtents[c]!;
        if (ty < yF || ty >= yT) continue;
        hasV = true;
        const rel = tx - sx;
        if (rel < STREET_PAVEMENT) vPaveW = true;
        if (rel >= sw - STREET_PAVEMENT) vPaveE = true;
        if (ty === yF)     vCapN = true;
        if (ty === yT - 1) vCapS = true;
      }

      // ── Horizontal street bands ────────────────────────────────────────
      for (let r = 0; r < hStreetYs.length; r++) {
        const sy = hStreetYs[r]!;
        if (ty < sy || ty >= sy + sw) continue;
        const [xF, xT] = hExtents[r]!;
        if (tx < xF || tx >= xT) continue;
        hasH = true;
        const rel = ty - sy;
        if (rel < STREET_PAVEMENT) hPaveN = true;
        if (rel >= sw - STREET_PAVEMENT) hPaveS = true;
        if (tx === xF)     hCapW = true;
        if (tx === xT - 1) hCapE = true;
      }

      // ── Arterial bands (width-aware, includes town side roads) ──────────
      for (const a of arterials) noteArterial(a);
    }
  }
  // L-bend arterials can sit outside URBAN_REACH of both endpoint cities.
  // The map chart still paints them from the city layout. Pull those in so
  // the world and the map agree while the tiles are on screen.
  for (const a of arterialsIndexedAt(tx, ty)) noteArterial(a);

  if (!hasV && !hasH) return null;

  if (isArterialLbendInnerCorner(tx, ty, allArterials)) return TileType.Pavement;

  // Guard against recursive cascades with _capCheckDepth.
  const capNeighbour = (nx: number, ny: number): boolean => {
    if (_capCheckDepth > 0) return false;
    _capCheckDepth++;
    const r = getStreetTileType(nx, ny);
    _capCheckDepth--;
    return r !== null;
  };

  // ── Intersection / turn (overlapping V+H bands) ─────────────────────────
  // Full + junctions keep road through the crossing.  L/T turns pave any
  // side-band that faces open land (no street continuation).
  if (hasV && hasH) {
    const vSide = vPaveW || vPaveE;
    const hSide = hPaveN || hPaveS;
    if (vSide && hSide) {
      if (isRoadSurfaceAt(tx, ty)) {
        if (isRoadSurfaceAt(tx - 1, ty) && isRoadSurfaceAt(tx + 1, ty)) {
          // SE re-entrant corner of slight bends stays paved.
          if (!(vPaveE && hPaveS)) return TileType.Road;
        }
        if (isRoadSurfaceAt(tx, ty - 1) && isRoadSurfaceAt(tx, ty + 1)) {
          if (!(vPaveW && hPaveN)) return TileType.Road;
        }
      }
      return TileType.Pavement;
    }
    // Interior of both bands — always asphalt (covers tight L-bend fill).
    if (!vSide && !hSide) return TileType.Road;
    // Open T/L mouths before dead-end cap checks (matches single-orientation).
    if (hPaveN && isRoadSurfaceAt(tx, ty - 1)) return TileType.Road;
    if (hPaveS && isRoadSurfaceAt(tx, ty + 1)) return TileType.Road;
    if (vPaveW && isRoadSurfaceAt(tx - 1, ty)) return TileType.Road;
    if (vPaveE && isRoadSurfaceAt(tx + 1, ty)) return TileType.Road;
    if (hPaveN && !capNeighbour(tx, ty - 1)) return TileType.Pavement;
    if (hPaveS && !capNeighbour(tx, ty + 1)) return TileType.Pavement;
    if (vPaveW && !capNeighbour(tx - 1, ty)) return TileType.Pavement;
    if (vPaveE && !capNeighbour(tx + 1, ty)) return TileType.Pavement;
    return TileType.Road;
  }

  // ── Single-orientation street: side bands + dead-end caps ───────────────
  // Town side roads meet arterials edge-to-edge (no band overlap).  Open the
  // arterial curb only for the joining road's interior width (4 tiles on a
  // town road: 1+4+1), leaving the arterial pavement tiles that meet the
  // side-road sidewalks as junction corners.
  if (hasV) {
    if (vPaveW && vPaveE) return TileType.Road; // stacked vertical segments
    if (vPaveW && isRoadSurfaceAt(tx - 1, ty)) return TileType.Road;
    if (vPaveE && isRoadSurfaceAt(tx + 1, ty)) return TileType.Road;
    const vPave = vPaveW || vPaveE;
    const onCap =
      (vCapN && !capNeighbour(tx, ty - 1)) ||
      (vCapS && !capNeighbour(tx, ty + 1));
    return vPave || onCap ? TileType.Pavement : TileType.Road;
  }

  if (hPaveN && hPaveS) return TileType.Road; // stacked horizontal segments
  if (hPaveN && isRoadSurfaceAt(tx, ty - 1)) return TileType.Road;
  if (hPaveS && isRoadSurfaceAt(tx, ty + 1)) return TileType.Road;
  const hPave = hPaveN || hPaveS;
  const onCap =
    (hCapW && !capNeighbour(tx - 1, ty)) ||
    (hCapE && !capNeighbour(tx + 1, ty));
  return hPave || onCap ? TileType.Pavement : TileType.Road;
}

// ── Public API ────────────────────────────────────────────────────────────────

// ── Streetlights (SE/SW cobra-heads on arterial curbs) ───────────────────────

/**
 * Streetlight1 facing into the roadbed:
 * - SE — west curb of a N–S arterial (lamp toward +X / screen bottom-right)
 * - SW — north curb of an E–W arterial (lamp toward +Y / screen bottom-left)
 */
export type StreetlightFacing = "SE" | "SW";

export type StreetlightInfo = {
  ox: number;
  oy: number;
  facing: StreetlightFacing;
};

function arterialSegmentKey(a: Arterial): string {
  return `${a.orient}:${a.x0},${a.y0},${a.x1},${a.y1},${a.width}`;
}

/** Facing whose lamp overhangs the arterial road from this pavement tile, or null. */
function streetlightFacingOnArterialCurb(
  tx: number,
  ty: number,
  a: Arterial,
): StreetlightFacing | null {
  if (tx < a.x0 || tx >= a.x1 || ty < a.y0 || ty >= a.y1) return null;
  if (a.orient === "v" && tx === a.x0) return "SE";
  if (a.orient === "h" && ty === a.y0) return "SW";
  return null;
}

/**
 * Deterministic Streetlight1 on arterial pavement facing into the road, or null.
 * Sparse along the curb so roads stay readable.
 */
function streetlightOnSegment(
  tx: number,
  ty: number,
  a: Arterial,
  seen: Set<string>,
): StreetlightInfo | null {
  const facing = streetlightFacingOnArterialCurb(tx, ty, a);
  if (!facing) return null;
  const key = arterialSegmentKey(a);
  if (seen.has(key)) return null;
  seen.add(key);

  const along = a.orient === "v" ? ty : tx;
  const start = a.orient === "v" ? a.y0 : a.x0;
  const end = a.orient === "v" ? a.y1 : a.x1;
  if (
    along < start + STREETLIGHT_END_MARGIN ||
    along >= end - STREETLIGHT_END_MARGIN
  ) {
    return null;
  }

  const phaseRng = seededRandom(`streetlight-phase:${key}`);
  const phase = Math.floor(phaseRng() * STREETLIGHT_SPACING);
  const rel = along - start;
  if (
    ((rel - phase) % STREETLIGHT_SPACING + STREETLIGHT_SPACING) %
      STREETLIGHT_SPACING !==
    0
  ) {
    return null;
  }

  const slotRng = seededRandom(`streetlight:${key}:${along}`);
  if (slotRng() >= STREETLIGHT_CHANCE) return null;
  return { ox: tx, oy: ty, facing };
}

export function getStreetlightAt(tx: number, ty: number): StreetlightInfo | null {
  if (getBuildingAt(tx, ty)) return null;

  const reach = URBAN_REACH;
  const minCX = Math.floor((tx - reach) / SETTLEMENT_CELL) * SETTLEMENT_CELL;
  const maxCX = Math.floor((tx + reach) / SETTLEMENT_CELL) * SETTLEMENT_CELL;
  const minCY = Math.floor((ty - reach) / SETTLEMENT_CELL) * SETTLEMENT_CELL;
  const maxCY = Math.floor((ty + reach) / SETTLEMENT_CELL) * SETTLEMENT_CELL;
  const seen = new Set<string>();

  for (let cx = minCX; cx <= maxCX; cx += SETTLEMENT_CELL) {
    for (let cy = minCY; cy <= maxCY; cy += SETTLEMENT_CELL) {
      const layout = getCachedLayout(cx, cy);
      if (!layout) continue;
      for (const a of layout.arterials) {
        const light = streetlightOnSegment(tx, ty, a, seen);
        if (light) return light;
      }
    }
  }
  for (const a of arterialsIndexedAt(tx, ty)) {
    const light = streetlightOnSegment(tx, ty, a, seen);
    if (light) return light;
  }

  return null;
}

// ── Trees (scatter on empty land) ─────────────────────────────────────────────

export type TreeInfo = {
  ox: number;
  oy: number;
  /** Texture variant 0–4 → Tree1 … Tree5. */
  variant: number;
};

/** Runtime felled trees — in-memory only; cleared on process restart. */
const felledTrees = new Set<string>();

export function treeTileKey(tx: number, ty: number): string {
  return `${tx},${ty}`;
}

export function isTreeFelled(tx: number, ty: number): boolean {
  return felledTrees.has(treeTileKey(tx, ty));
}

export function markTreeFelled(tx: number, ty: number): void {
  felledTrees.add(treeTileKey(tx, ty));
}

/** Replace the full felled set (client join sync). */
export function syncFelledTrees(trees: readonly { x: number; y: number }[]): void {
  felledTrees.clear();
  for (const t of trees) {
    if (Number.isInteger(t.x) && Number.isInteger(t.y)) {
      felledTrees.add(treeTileKey(t.x, t.y));
    }
  }
}

export function listFelledTrees(): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (const key of felledTrees) {
    const comma = key.indexOf(",");
    const x = parseInt(key.slice(0, comma), 10);
    const y = parseInt(key.slice(comma + 1), 10);
    if (Number.isFinite(x) && Number.isFinite(y)) out.push({ x, y });
  }
  return out;
}

/** Worldgen tree that has not been chopped down this session. */
export function getStandingTreeAt(tx: number, ty: number): TreeInfo | null {
  const tree = getTreeAt(tx, ty);
  if (!tree || isTreeFelled(tx, ty)) return null;
  return tree;
}

/**
 * True when the player is on a Chebyshev-adjacent tile to (treeTX, treeTY).
 * Centre snap happens server-side when the chop starts — don't require a
 * tight centre check here or schema lag / early stopOnly will reject the chop.
 */
export function playerReadyToChopTree(
  px: number,
  py: number,
  treeTX: number,
  treeTY: number,
): boolean {
  const ptx = Math.floor(px);
  const pty = Math.floor(py);
  return Math.max(Math.abs(ptx - treeTX), Math.abs(pty - treeTY)) === 1;
}

/** Oak, yellow oak, larch, pine, conifer. */
export const TREE_VARIANT_COUNT = 5;

/** One tree candidate per TREE_CELL×TREE_CELL block. */
const TREE_CELL = 4;
/** Coarse forest vs meadow regions. */
const FOREST_MACRO_CELL = 32;
/** Small same-species groves within forest. */
const TREE_SPECIES_CELL = 8;
/** Lone trees on open ground. */
const MEADOW_TREE_CHANCE = 0.025;

type ForestMacro = { clearing: boolean; treeDensity: number };

function forestMacroAt(mx: number, my: number): ForestMacro {
  const rng = seededRandom(`forest-macro:${mx},${my}`);
  const roll = rng();
  if (roll < 0.30) {
    return { clearing: true, treeDensity: MEADOW_TREE_CHANCE };
  }
  // Denser interior, lighter edges of forest patches.
  const interior = 0.10 + roll * 0.14;
  return { clearing: false, treeDensity: interior };
}

function treeSpeciesAt(sx: number, sy: number): { variant: number; homogeneity: number } {
  const rng = seededRandom(`tree-species:${sx},${sy}`);
  return {
    variant: Math.floor(rng() * TREE_VARIANT_COUNT),
    homogeneity: 0.62 + rng() * 0.33,
  };
}

/** Blend neighbouring macro cells so forest edges feather instead of hard squares. */
function blendedTreeDensity(tx: number, ty: number): number {
  const mx = Math.floor(tx / FOREST_MACRO_CELL);
  const my = Math.floor(ty / FOREST_MACRO_CELL);
  const fx = (tx - mx * FOREST_MACRO_CELL) / FOREST_MACRO_CELL;
  const fy = (ty - my * FOREST_MACRO_CELL) / FOREST_MACRO_CELL;
  const wx = fx < 0.22 ? 1 - fx / 0.22 : fx > 0.78 ? (fx - 0.78) / 0.22 : 0;
  const wy = fy < 0.22 ? 1 - fy / 0.22 : fy > 0.78 ? (fy - 0.78) / 0.22 : 0;
  const here = forestMacroAt(mx, my).treeDensity;
  if (wx === 0 && wy === 0) return here;
  let blend = here * (1 - Math.max(wx, wy));
  if (wx > 0) {
    const nmx = fx < 0.22 ? mx - 1 : mx + 1;
    blend += forestMacroAt(nmx, my).treeDensity * wx * 0.5;
  }
  if (wy > 0) {
    const nmy = fy < 0.22 ? my - 1 : my + 1;
    blend += forestMacroAt(mx, nmy).treeDensity * wy * 0.5;
  }
  return Math.min(blend, 0.24);
}

/**
 * True on forest floor: not a meadow clearing, and not a building, street,
 * or parking lot. Used to place wildlife.
 */
export function isWoodedForestAt(tx: number, ty: number): boolean {
  const x = Math.floor(tx);
  const y = Math.floor(ty);
  const mx = Math.floor(x / FOREST_MACRO_CELL);
  const my = Math.floor(y / FOREST_MACRO_CELL);
  if (forestMacroAt(mx, my).clearing) return false;
  if (blendedTreeDensity(x, y) < 0.09) return false;
  if (getBuildingAt(x, y)) return false;
  if (getStreetTileType(x, y) !== null) return false;
  if (isCarParkLotTile(x, y)) return false;
  return true;
}

function pickTreeVariant(tx: number, ty: number, rng: () => number): number {
  const sx = Math.floor(tx / TREE_SPECIES_CELL);
  const sy = Math.floor(ty / TREE_SPECIES_CELL);
  const patch = treeSpeciesAt(sx, sy);
  if (rng() < patch.homogeneity) return patch.variant;

  // Edge of a grove: borrow from an adjacent species patch or pick at random.
  const neighbours = [
    treeSpeciesAt(sx - 1, sy),
    treeSpeciesAt(sx + 1, sy),
    treeSpeciesAt(sx, sy - 1),
    treeSpeciesAt(sx, sy + 1),
  ];
  if (rng() < 0.72) {
    return neighbours[Math.floor(rng() * neighbours.length)]!.variant;
  }
  return Math.floor(rng() * TREE_VARIANT_COUNT);
}

/** True when (tx, ty) is a walkable tile used to enter a nearby building. */
function tileIsBuildingEntryApproach(tx: number, ty: number): boolean {
  for (const bld of getBuildingsNearTile(tx, ty, 2)) {
    for (const c of buildingEntryApproachCandidates(bld)) {
      if (c.x === tx && c.y === ty) return true;
    }
  }
  return false;
}

/**
 * Deterministic tree on empty land (no building, no street, no barracks), or null.
 * At most one tree per TREE_CELL×TREE_CELL block for natural spacing.
 * Forest macro-regions create meadows and woodland; species patches form
 * small groves of the same tree type with mixed edges between them.
 */
export function getTreeAt(tx: number, ty: number): TreeInfo | null {
  const gx = Math.floor(tx / TREE_CELL);
  const gy = Math.floor(ty / TREE_CELL);
  const rng = seededRandom(`tree:${gx},${gy}`);
  const lx = gx * TREE_CELL + Math.floor(rng() * TREE_CELL);
  const ly = gy * TREE_CELL + Math.floor(rng() * TREE_CELL);
  if (tx !== lx || ty !== ly) return null;

  const spawnChance = blendedTreeDensity(lx, ly);
  if (rng() >= spawnChance) return null;

  // Empty land only — do not call generateTile (would recurse).
  if (getBuildingAt(tx, ty)) return null;
  if (getStreetTileType(tx, ty) !== null) return null;
  if (isCarParkLotTile(tx, ty)) return null;
  if (isInBirchportBarracks(tx, ty)) return null;
  if (getBirchportGraveAt(tx, ty)) return null;
  if (getCellarAt(tx, ty)) return null;
  // Rural cabins sit on grass. A tree on the door approach blocks entry.
  if (tileIsBuildingEntryApproach(tx, ty)) return null;
  const variant = pickTreeVariant(lx, ly, rng);
  return { ox: tx, oy: ty, variant };
}

/**
 * Trees within maxDist tiles of (tx, ty) — for occlusion / outline.
 * Includes felled trees so fallen trunks still outline the player.
 */
export function getTreesNearTile(
  tx: number,
  ty: number,
  maxDist = 2,
): TreeInfo[] {
  const trees: TreeInfo[] = [];
  // Only one tile per TREE_CELL block can hold a tree, so walk the cells (like
  // countStandingTreesNear) instead of probing every tile in the square. Same
  // result set, an order of magnitude fewer worldgen probes — this runs per
  // occlusion mask, per frame.
  const gx0 = Math.floor((tx - maxDist) / TREE_CELL);
  const gy0 = Math.floor((ty - maxDist) / TREE_CELL);
  const gx1 = Math.floor((tx + maxDist) / TREE_CELL);
  const gy1 = Math.floor((ty + maxDist) / TREE_CELL);
  for (let gy = gy0; gy <= gy1; gy++) {
    for (let gx = gx0; gx <= gx1; gx++) {
      const rng = seededRandom(`tree:${gx},${gy}`);
      const lx = gx * TREE_CELL + Math.floor(rng() * TREE_CELL);
      const ly = gy * TREE_CELL + Math.floor(rng() * TREE_CELL);
      if (Math.abs(lx - tx) > maxDist || Math.abs(ly - ty) > maxDist) continue;
      const tree = getTreeAt(lx, ly);
      if (tree) trees.push(tree);
    }
  }
  // Row-major tile order, as the per-tile scan produced.
  trees.sort((a, b) => (a.oy === b.oy ? a.ox - b.ox : a.oy - b.oy));
  return trees;
}

/**
 * Standing trees within Chebyshev `radius` of (tx, ty).
 * Walks TREE_CELL candidates only (one possible tree per 4×4), and stops
 * early at `stopAt` so callers can test a density threshold cheaply.
 */
export function countStandingTreesNear(
  tx: number,
  ty: number,
  radius: number,
  stopAt = Number.POSITIVE_INFINITY,
): number {
  if (radius < 0 || stopAt <= 0) return 0;
  const gx0 = Math.floor((tx - radius) / TREE_CELL);
  const gy0 = Math.floor((ty - radius) / TREE_CELL);
  const gx1 = Math.floor((tx + radius) / TREE_CELL);
  const gy1 = Math.floor((ty + radius) / TREE_CELL);
  let n = 0;
  for (let gy = gy0; gy <= gy1; gy++) {
    for (let gx = gx0; gx <= gx1; gx++) {
      const rng = seededRandom(`tree:${gx},${gy}`);
      const lx = gx * TREE_CELL + Math.floor(rng() * TREE_CELL);
      const ly = gy * TREE_CELL + Math.floor(rng() * TREE_CELL);
      if (Math.max(Math.abs(lx - tx), Math.abs(ly - ty)) > radius) continue;
      if (!getStandingTreeAt(lx, ly)) continue;
      n += 1;
      if (n >= stopAt) return n;
    }
  }
  return n;
}

/** Treat a tree as a 1×1 building footprint for occlusion helpers. */
export function treeAsBuilding(tree: TreeInfo): BuildingInfo {
  return {
    ox: tree.ox,
    oy: tree.oy,
    w: 1,
    h: 1,
    entranceX: tree.ox,
    entranceY: tree.oy,
    entranceSpan: 1,
    fillsLot: false,
    buildingType: "none",
    exteriorLevels: 1,
  };
}

/**
 * getBuildingAt result cache, keyed by exact tile. Called on every server
 * simulation tick per moving entity (collision checks) and every client
 * tile-draw / hover — same 81-cell scan otherwise repeats for the same tile
 * over and over. Deterministic static data, so caching is always safe.
 * Bounded + swept by evictDistantCells so long sessions can't grow it forever.
 */
const buildingAtTileCache = new Map<string, BuildingInfo | null>();
const BUILDING_AT_TILE_CACHE_MAX = 20000;

/**
 * Returns the building footprint occupying tile (tx, ty), or null.
 * Entirely deterministic from coordinates — no global state.
 */
export function getBuildingAt(tx: number, ty: number): BuildingInfo | null {
  const cacheKey = `${tx},${ty}`;
  const cached = buildingAtTileCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const reach  = URBAN_REACH;
  const minCX  = Math.floor((tx - reach) / SETTLEMENT_CELL) * SETTLEMENT_CELL;
  const maxCX  = Math.floor((tx + reach) / SETTLEMENT_CELL) * SETTLEMENT_CELL;
  const minCY  = Math.floor((ty - reach) / SETTLEMENT_CELL) * SETTLEMENT_CELL;
  const maxCY  = Math.floor((ty + reach) / SETTLEMENT_CELL) * SETTLEMENT_CELL;

  let found: BuildingInfo | null = null;
  for (let cx = minCX; cx <= maxCX && !found; cx += SETTLEMENT_CELL) {
    for (let cy = minCY; cy <= maxCY && !found; cy += SETTLEMENT_CELL) {
      for (const b of settlementBuildings(cx, cy)) {
        if (tx >= b.ox && tx < b.ox + b.w && ty >= b.oy && ty < b.oy + b.h) {
          found = b;
          break;
        }
      }
    }
  }

  if (buildingAtTileCache.size >= BUILDING_AT_TILE_CACHE_MAX) {
    const oldest = buildingAtTileCache.keys().next().value as string | undefined;
    if (oldest !== undefined) buildingAtTileCache.delete(oldest);
  }
  buildingAtTileCache.set(cacheKey, found);
  return found;
}

/** Chebyshev distance from a tile to the nearest edge of a building footprint. */
export function footprintChebyshevDistance(
  tx: number,
  ty: number,
  bld: BuildingInfo,
): number {
  const dx = Math.max(bld.ox - tx, tx - (bld.ox + bld.w - 1), 0);
  const dy = Math.max(bld.oy - ty, ty - (bld.oy + bld.h - 1), 0);
  return Math.max(dx, dy);
}

/**
 * Result cache for getBuildingsNearTile, keyed by exact (tx, ty, maxDist).
 * Render code (entity/tree/fence depth sorting) calls this once per visible
 * object *every frame* with the same floored tile for many consecutive
 * frames — caching turns an 81-cell rescan into a Map lookup on repeat calls.
 * World gen is deterministic/static, so caching by exact key is always safe.
 * Bounded + swept by evictDistantCells so it can't grow across a long session.
 */
const buildingsNearTileCache = new Map<string, BuildingInfo[]>();
const BUILDINGS_NEAR_TILE_CACHE_MAX = 6000;

/** Buildings whose footprint is within maxDist tiles of (tx, ty). */
export function getBuildingsNearTile(
  tx: number,
  ty: number,
  maxDist = 2,
): BuildingInfo[] {
  const cacheKey = `${tx},${ty},${maxDist}`;
  const cached = buildingsNearTileCache.get(cacheKey);
  if (cached) return cached;

  const reach = URBAN_REACH;
  const minCX = Math.floor((tx - reach) / SETTLEMENT_CELL) * SETTLEMENT_CELL;
  const maxCX = Math.floor((tx + reach) / SETTLEMENT_CELL) * SETTLEMENT_CELL;
  const minCY = Math.floor((ty - reach) / SETTLEMENT_CELL) * SETTLEMENT_CELL;
  const maxCY = Math.floor((ty + reach) / SETTLEMENT_CELL) * SETTLEMENT_CELL;

  const seen = new Set<string>();
  const nearby: BuildingInfo[] = [];

  for (let cx = minCX; cx <= maxCX; cx += SETTLEMENT_CELL) {
    for (let cy = minCY; cy <= maxCY; cy += SETTLEMENT_CELL) {
      for (const bld of settlementBuildings(cx, cy)) {
        const key = `${bld.ox},${bld.oy}`;
        if (seen.has(key)) continue;
        seen.add(key);
        if (footprintChebyshevDistance(tx, ty, bld) <= maxDist) {
          nearby.push(bld);
        }
      }
    }
  }

  if (buildingsNearTileCache.size >= BUILDINGS_NEAR_TILE_CACHE_MAX) {
    const oldest = buildingsNearTileCache.keys().next().value as string | undefined;
    if (oldest !== undefined) buildingsNearTileCache.delete(oldest);
  }
  buildingsNearTileCache.set(cacheKey, nearby);
  return nearby;
}

/** Building whose footprint is diagonally/orthogonally adjacent to a walkable tile. */
export function getBuildingBesideTile(tx: number, ty: number): BuildingInfo | null {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const bld = getBuildingAt(tx + dx, ty + dy);
      if (bld) return bld;
    }
  }
  return null;
}

/**
 * Returns true when an entity on tile (tx, ty) should render IN FRONT of the
 * building cuboid.
 *
 * The building is a single graphics object so its depth covers the whole
 * cuboid including the roof.  Bumping an entity above that depth on the
 * west/left side would push them on top of the roof near the bottom-left
 * corner.  The west face naturally occludes entities (the left wall is a
 * solid surface) so no bump is needed there — entities on the west side
 * remain behind the wall, which is the correct isometric look.
 *
 * Rules (per-face):
 *   • South of footprint   (ty >= oy+h)                         → in front
 *   • East of footprint    (tx >= ox+w, oy <= ty < oy+h)        → in front
 *   • West / north         → behind (natural depth, may clamp)
 */
export function isInFrontOfBuilding(
  tx: number,
  ty: number,
  bld: BuildingInfo,
): boolean {
  const { ox, oy, w, h } = bld;
  if (ty >= oy + h) return true;
  if (tx >= ox + w && ty >= oy && ty < oy + h) return true;
  return false;
}

/** How far west/north of a building the player occlusion outline still applies. */
export const PLAYER_WEST_NORTH_OUTLINE_REACH = 3;

/**
 * True when (tx, ty) is west or north of the building within outline reach.
 * Feet and lower body can clip the cuboid from further away than adjacent tiles.
 */
export function isWestOrNorthWallOutlineRange(
  tx: number,
  ty: number,
  bld: BuildingInfo,
): boolean {
  if (isInFrontOfBuilding(tx, ty, bld)) return false;

  const { ox, oy, w, h } = bld;
  const reach = PLAYER_WEST_NORTH_OUTLINE_REACH;

  const westDist = ox - tx;
  const northDist = oy - ty;

  if (tx < ox && westDist <= reach && ty >= oy && ty < oy + h + 2) {
    return true;
  }

  if (ty < oy && northDist <= reach && tx >= ox - 2 && tx < ox + w) {
    return true;
  }

  if (tx < ox && ty < oy && westDist <= reach && northDist <= reach) {
    return true;
  }

  return false;
}

/**
 * Deterministic tile at world coordinate (x, y).
 * Priority: Wall > Road/Pavement > Barracks > CarPark > Floor.
 */
export function generateTile(
  x: number,
  y: number,
  _seedWord: string = MAP_SEED_WORD,
): TileType {
  if (getBorderWallAt(x, y)) return TileType.Wall;
  if (getBuildingAt(x, y)) return TileType.Wall;
  const street = getStreetTileType(x, y);
  if (street !== null) {
    // Pole on the curb — blocks like a tree, street drawn underneath on client.
    if (getStreetlightAt(x, y)) return TileType.Wall;
    return street;
  }
  if (getBirchportGraveAt(x, y)) return TileType.Wall;
  if (getCellarAt(x, y)) return TileType.Wall;
  if (getFenceAt(x, y)) return TileType.Wall;
  if (getStandingTreeAt(x, y)) return TileType.Wall;
  if (isInBirchportBarracks(x, y)) return TileType.Barracks;
  if (isCarParkLotTile(x, y)) return TileType.CarPark;
  return TileType.Floor;
}

export function isWallTile(x: number, y: number): boolean {
  return generateTile(x, y) === TileType.Wall;
}

/** Hard cover only (buildings). Trees are soft cover and do not fully block shots. */
export function isBuildingTile(x: number, y: number): boolean {
  return getBuildingAt(x, y) !== null;
}

/** All non-Wall tiles (Floor, Road, Pavement, CarPark, Barracks) are walkable. */
export function isWalkableTile(x: number, y: number): boolean {
  return generateTile(x, y) !== TileType.Wall;
}

/**
 * Collision check for fractional entity positions.
 */
export function canMoveAt(
  x: number,
  y: number,
  bounds: WorldBounds = INITIAL_WORLD_BOUNDS,
): boolean {
  if (!isInWorldBounds(x, y, bounds)) return false;
  return generateTile(Math.floor(x), Math.floor(y)) !== TileType.Wall;
}

/**
 * Nearest walkable cell centre around (x, y), expanding by Chebyshev rings.
 * Prefer building door approaches when standing inside a footprint.
 */
export function findNearestWalkableNear(
  x: number,
  y: number,
  bounds: WorldBounds = INITIAL_WORLD_BOUNDS,
  maxRadius = 24,
  limit: WorldBounds = bounds,
): { x: number; y: number } | null {
  const allowed = (px: number, py: number) =>
    isInWorldBounds(px, py, limit) && canMoveAt(px, py, bounds);
  if (allowed(x, y)) return { x, y };

  const tx = Math.floor(x);
  const ty = Math.floor(y);
  const bld = getBuildingAt(tx, ty);
  if (bld) {
    const door = buildingExitApproachWorldPos(bld);
    if (allowed(door.x, door.y)) return door;
  }

  for (let r = 1; r <= maxRadius; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const nx = tx + dx + 0.5;
        const ny = ty + dy + 0.5;
        if (allowed(nx, ny)) return { x: nx, y: ny };
      }
    }
  }
  return null;
}

export function seededRandom(seedKey: string): () => number {
  return mulberry32(xmur3(seedKey)());
}

export function worldCenter(bounds: WorldBounds) {
  return {
    x: bounds.minGlobalX + bounds.mapWidth / 2,
    y: bounds.minGlobalY + bounds.mapHeight / 2,
  };
}

/** Deterministic open-world spawn within current bounds. */
export function findSpawnPosition(
  slotKey: string,
  bounds: WorldBounds = INITIAL_WORLD_BOUNDS,
  margin = 2,
): { x: number; y: number } {
  const rng = seededRandom(`spawn:${slotKey}`);
  for (let attempt = 0; attempt < 200; attempt++) {
    const x =
      bounds.minGlobalX +
      margin +
      rng() * (bounds.mapWidth - margin * 2);
    const y =
      bounds.minGlobalY +
      margin +
      rng() * (bounds.mapHeight - margin * 2);
    if (canMoveAt(x, y, bounds)) return { x, y };
  }
  return worldCenter(bounds);
}

/** How far (in tiles) to search when resolving the named spawn hub. */
const PLAYER_SPAWN_HUB_SEARCH_TILES = 3000;

type PlayerSpawnFootprint = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

let playerSpawnFootprintCache: PlayerSpawnFootprint | null | undefined;

/**
 * Resolve the tile footprint of {@link PLAYER_SPAWN_HUB_NAME} (cached).
 * Falls back to a small box around the initial map centre if not found.
 */
export function getPlayerSpawnFootprint(): PlayerSpawnFootprint {
  if (playerSpawnFootprintCache !== undefined) {
    if (playerSpawnFootprintCache) return playerSpawnFootprintCache;
    const c = worldCenter(INITIAL_WORLD_BOUNDS);
    return {
      minX: Math.floor(c.x) - 8,
      maxX: Math.floor(c.x) + 8,
      minY: Math.floor(c.y) - 8,
      maxY: Math.floor(c.y) + 8,
    };
  }

  const reach = PLAYER_SPAWN_HUB_SEARCH_TILES;
  for (const { cx, cy } of settlementCellsInRegion(-reach, reach, -reach, reach)) {
    if (settlementType(cx, cy) === "city" && getCityName(cx, cy) === PLAYER_SPAWN_HUB_NAME) {
      // cityLandmarkBounds is in global tiles; layout.ccx/ccy are lot indices only.
      playerSpawnFootprintCache = cityLandmarkBounds(cx, cy);
      return playerSpawnFootprintCache;
    }
    for (const town of arterialTownsIntersectingCell(cx, cy)) {
      if (getArterialTownName(town.townKey) !== PLAYER_SPAWN_HUB_NAME) continue;
      playerSpawnFootprintCache = {
        minX: town.minX,
        maxX: town.maxX,
        minY: town.minY,
        maxY: town.maxY,
      };
      return playerSpawnFootprintCache;
    }
  }

  playerSpawnFootprintCache = null;
  return getPlayerSpawnFootprint();
}

/** Centre of the spawn hub footprint (for bounds expansion helpers). */
export function getPlayerSpawnHub(): { x: number; y: number } {
  const f = getPlayerSpawnFootprint();
  return {
    x: (f.minX + f.maxX) / 2,
    y: (f.minY + f.maxY) / 2,
  };
}

function pointInFootprint(
  x: number,
  y: number,
  f: PlayerSpawnFootprint,
): boolean {
  return x >= f.minX && x <= f.maxX && y >= f.minY && y <= f.maxY;
}

/** Euclidean distance to the footprint edge (0 on boundary; negative if inside). */
function distToFootprintOutskirts(
  x: number,
  y: number,
  f: PlayerSpawnFootprint,
): number {
  if (pointInFootprint(x, y, f)) return -1;
  const dx = x < f.minX ? f.minX - x : x > f.maxX ? x - f.maxX : 0;
  const dy = y < f.minY ? f.minY - y : y > f.maxY ? y - f.maxY : 0;
  return Math.hypot(dx, dy);
}

/**
 * Sample a point outside the footprint, within {@link PLAYER_SPAWN_RADIUS_TILES}
 * of its outskirts (edge).
 */
function sampleSpawnNearOutskirts(
  f: PlayerSpawnFootprint,
  radius: number,
  rng: () => number,
): { x: number; y: number } {
  const side = Math.floor(rng() * 4);
  // Bias slightly outward so we never land inside the footprint.
  const outward = 0.5 + rng() * Math.max(radius - 0.5, 0);
  if (side === 0) {
    // North
    return {
      x: f.minX + rng() * (f.maxX - f.minX),
      y: f.minY - outward,
    };
  }
  if (side === 1) {
    // South
    return {
      x: f.minX + rng() * (f.maxX - f.minX),
      y: f.maxY + outward,
    };
  }
  if (side === 2) {
    // West
    return {
      x: f.minX - outward,
      y: f.minY + rng() * (f.maxY - f.minY),
    };
  }
  // East
  return {
    x: f.maxX + outward,
    y: f.minY + rng() * (f.maxY - f.minY),
  };
}

/**
 * True when (x, y) is within Chebyshev `clearance` tiles of a road surface tile.
 */
export function isWithinTilesOfRoad(
  x: number,
  y: number,
  clearance: number = PLAYER_SPAWN_CLEARANCE_TILES,
): boolean {
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  for (let dy = -clearance; dy <= clearance; dy++) {
    for (let dx = -clearance; dx <= clearance; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) > clearance) continue;
      if (generateTile(tx + dx, ty + dy) === TileType.Road) return true;
    }
  }
  return false;
}

/**
 * Spawn outside Birchport but within {@link PLAYER_SPAWN_RADIUS_TILES} of its
 * outskirts; retries until walkable, clear of roads, and not blocked by `opts`.
 */
export function findPlayerSpawn(
  slotKey: string,
  bounds: WorldBounds = INITIAL_WORLD_BOUNDS,
  opts?: { isBlocked?: (x: number, y: number) => boolean },
): { x: number; y: number } {
  const footprint = getPlayerSpawnFootprint();
  const rng = seededRandom(`player:${slotKey}`);
  const radius = PLAYER_SPAWN_RADIUS_TILES;
  const clearance = PLAYER_SPAWN_CLEARANCE_TILES;

  const isValid = (x: number, y: number) => {
    if (pointInFootprint(x, y, footprint)) return false;
    if (distToFootprintOutskirts(x, y, footprint) > radius) return false;
    if (!canMoveAt(x, y, bounds)) return false;
    if (isWithinTilesOfRoad(x, y, clearance)) return false;
    if (opts?.isBlocked?.(x, y)) return false;
    return true;
  };

  for (let attempt = 0; attempt < 256; attempt++) {
    const { x, y } = sampleSpawnNearOutskirts(footprint, radius, rng);
    if (isValid(x, y)) return { x, y };
  }

  // Fallback: walk outward from a random edge until a clear walkable tile is found.
  for (let attempt = 0; attempt < 64; attempt++) {
    const edge = sampleSpawnNearOutskirts(footprint, 1, rng);
    const near = findNearestWalkableNear(edge.x, edge.y, bounds, radius);
    if (near && isValid(near.x, near.y)) return near;
  }

  // Last resort: any walkable spawn in bounds that still clears roads / blockers.
  for (let attempt = 0; attempt < 128; attempt++) {
    const pos = findSpawnPosition(`${slotKey}:clear:${attempt}`, bounds);
    if (
      !isWithinTilesOfRoad(pos.x, pos.y, clearance) &&
      !opts?.isBlocked?.(pos.x, pos.y)
    ) {
      return pos;
    }
  }

  return findSpawnPosition(slotKey, bounds);
}

/**
 * Ground tile uses path art when the west neighbour is a wall.
 * Road/Pavement/CarPark/Barracks tiles never use the path texture.
 */
export function usesPathUpLeftTile(x: number, y: number): boolean {
  const t = generateTile(x, y);
  if (
    t === TileType.Road ||
    t === TileType.Pavement ||
    t === TileType.CarPark ||
    t === TileType.Barracks
  ) {
    return false;
  }
  return isWallTile(x - 1, y);
}

/** True when (tx, ty) sits in a designated empty city car-park lot. */
export function isCarParkLotTile(tx: number, ty: number): boolean {
  const reach = URBAN_REACH;
  const minCX = Math.floor((tx - reach) / SETTLEMENT_CELL) * SETTLEMENT_CELL;
  const maxCX = Math.floor((tx + reach) / SETTLEMENT_CELL) * SETTLEMENT_CELL;
  const minCY = Math.floor((ty - reach) / SETTLEMENT_CELL) * SETTLEMENT_CELL;
  const maxCY = Math.floor((ty + reach) / SETTLEMENT_CELL) * SETTLEMENT_CELL;

  for (let cx = minCX; cx <= maxCX; cx += SETTLEMENT_CELL) {
    for (let cy = minCY; cy <= maxCY; cy += SETTLEMENT_CELL) {
      const layout = getCachedLayout(cx, cy);
      if (!layout) continue;
      const {
        numCols, numRows, lotXStart, lotXEnd, lotYStart, lotYEnd, carPark,
      } = layout;
      for (let col = 0; col < numCols; col++) {
        if (tx < lotXStart[col]! || tx >= lotXEnd[col]!) continue;
        for (let row = 0; row < numRows; row++) {
          if (ty < lotYStart[row]! || ty >= lotYEnd[row]!) continue;
          if (carPark[col]![row]) return true;
        }
      }
    }
  }
  return false;
}

/** Find walkable spawn in a rectangular global tile region. */
export function findWalkableInRegion(
  seedKey: string,
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
  bounds: WorldBounds,
): { x: number; y: number } | null {
  const rng = seededRandom(seedKey);
  for (let attempt = 0; attempt < 100; attempt++) {
    const x = minX + Math.floor(rng() * (maxX - minX + 1));
    const y = minY + Math.floor(rng() * (maxY - minY + 1));
    if (canMoveAt(x + 0.5, y + 0.5, bounds)) return { x: x + 0.5, y: y + 0.5 };
  }
  return null;
}

export { INITIAL_MAP_WIDTH, INITIAL_MAP_HEIGHT };

// ── Client-side streaming cache helpers ───────────────────────────────────────

/**
 * Generate a settlement cell once the player is within this many tiles of its
 * boundary (Chebyshev).  Gives a full cell-width of head-start before the
 * 100×100 render window needs its tiles.
 */
export const CELL_BOUNDARY_PRELOAD = 100;

/**
 * Settlement cells use tile-origin coordinates (0, 96, 192, …), not cell indices.
 * Returns the inclusive range of cell origins that overlap [tx±radiusTiles].
 *
 * Region indices and cell origins are the same grid; see region.ts for the
 * shared key space that client streaming and server simulation both use.
 */
function cellOriginRange(
  tx: number,
  ty: number,
  radiusTiles: number,
): { cxMin: number; cxMax: number; cyMin: number; cyMax: number } {
  const { rxMin, rxMax, ryMin, ryMax } = regionRange(tx, ty, radiusTiles);
  return {
    cxMin: rxMin * SETTLEMENT_CELL,
    cxMax: rxMax * SETTLEMENT_CELL,
    cyMin: ryMin * SETTLEMENT_CELL,
    cyMax: ryMax * SETTLEMENT_CELL,
  };
}

/** Chebyshev distance from a tile to the nearest edge of a settlement cell. */
function distToCellBoundary(tx: number, ty: number, cx: number, cy: number): number {
  return cellDistanceToTile(cx, cy, tx, ty);
}

function warmCell(cx: number, cy: number): void {
  getBaseGrid(cx, cy);
  getCachedLayout(cx, cy);
  settlementBuildings(cx, cy);
  settlementFences(cx, cy);
}

function isCellWarm(cx: number, cy: number): boolean {
  const key = `${cx}:${cy}`;
  return (
    _layoutCache.has(key) &&
    settlementBuildingsCache.has(key) &&
    settlementFencesCache.has(key)
  );
}

/**
 * Pre-compute worldgen for every settlement cell whose boundary is within
 * `boundaryDist` tiles of the player.  Closest cold cells are generated first.
 *
 * `maxNewCells` limits how many *uncached* cells are generated this call so
 * work can be spread across frames (pass Infinity to finish everything now).
 * Returns the number of newly generated cells.
 */
export function preWarmCellsNearPlayer(
  tx: number,
  ty: number,
  boundaryDist: number = CELL_BOUNDARY_PRELOAD,
  maxNewCells: number = Infinity,
): number {
  const { cxMin, cxMax, cyMin, cyMax } = cellOriginRange(tx, ty, boundaryDist);

  // Collect cold cells, nearest first, so the cell the player is walking
  // toward is always generated before farther ones.
  const cold: Array<{ cx: number; cy: number; dist: number }> = [];
  for (let cy = cyMin; cy <= cyMax; cy += SETTLEMENT_CELL) {
    for (let cx = cxMin; cx <= cxMax; cx += SETTLEMENT_CELL) {
      const dist = distToCellBoundary(tx, ty, cx, cy);
      if (dist >= boundaryDist) continue;
      if (isCellWarm(cx, cy)) continue;
      cold.push({ cx, cy, dist });
    }
  }
  cold.sort((a, b) => a.dist - b.dist);

  const limit = Math.min(cold.length, maxNewCells);
  for (let i = 0; i < limit; i++) {
    warmCell(cold[i]!.cx, cold[i]!.cy);
  }
  return limit;
}

/**
 * Pre-warm every cell that can affect tiles inside the render square.
 * Street/building lookups scan URBAN_REACH beyond each tile, so the warm
 * radius is renderRadius + URBAN_REACH.
 */
export function preWarmForRender(tx: number, ty: number, renderRadius: number): void {
  const radius = renderRadius + URBAN_REACH;
  const { cxMin, cxMax, cyMin, cyMax } = cellOriginRange(tx, ty, radius);
  for (let cy = cyMin; cy <= cyMax; cy += SETTLEMENT_CELL) {
    for (let cx = cxMin; cx <= cxMax; cx += SETTLEMENT_CELL) {
      if (!isCellWarm(cx, cy)) warmCell(cx, cy);
    }
  }
}

/**
 * Evict cached worldgen data for cells whose boundary is further than
 * `boundaryDist` tiles from the player.
 */
export function evictDistantCells(
  tx: number,
  ty: number,
  boundaryDist: number = CELL_BOUNDARY_PRELOAD,
): void {
  const evictKey = (key: string): boolean => {
    const colon = key.indexOf(":");
    const cx = parseInt(key.slice(0, colon), 10);
    const cy = parseInt(key.slice(colon + 1), 10);
    return distToCellBoundary(tx, ty, cx, cy) >= boundaryDist;
  };

  for (const key of Array.from(_layoutCache.keys())) {
    if (evictKey(key)) _layoutCache.delete(key);
  }
  // settlementTypeCache was previously never swept, so it grew for the whole
  // session as the player explored. It is keyed by cell origin like the rest.
  for (const key of Array.from(settlementTypeCache.keys())) {
    if (evictKey(key)) settlementTypeCache.delete(key);
  }
  for (const key of Array.from(_baseGridCache.keys())) {
    if (evictKey(key)) _baseGridCache.delete(key);
  }
  for (const key of Array.from(_nearestCitiesPrimaryCache.keys())) {
    if (evictKey(key)) _nearestCitiesPrimaryCache.delete(key);
  }
  for (const key of Array.from(settlementBuildingsCache.keys())) {
    if (evictKey(key)) settlementBuildingsCache.delete(key);
  }
  for (const key of Array.from(settlementFencesCache.keys())) {
    if (evictKey(key)) {
      clearCellFenceIndex(settlementFencesCache.get(key));
      settlementFencesCache.delete(key);
    }
  }
  for (const key of Array.from(buildingsNearTileCache.keys())) {
    const comma1 = key.indexOf(",");
    const comma2 = key.indexOf(",", comma1 + 1);
    const btx = parseInt(key.slice(0, comma1), 10);
    const bty = parseInt(key.slice(comma1 + 1, comma2), 10);
    if (Math.max(Math.abs(btx - tx), Math.abs(bty - ty)) >= boundaryDist) {
      buildingsNearTileCache.delete(key);
    }
  }
  for (const key of Array.from(buildingAtTileCache.keys())) {
    const comma = key.indexOf(",");
    const btx = parseInt(key.slice(0, comma), 10);
    const bty = parseInt(key.slice(comma + 1), 10);
    if (Math.max(Math.abs(btx - tx), Math.abs(bty - ty)) >= boundaryDist) {
      buildingAtTileCache.delete(key);
    }
  }
}

/** Precomputed map chart, in tiles on each side. Centered on Birchport. */
export const BIRCHPORT_MAP_CHART_TILES = 5_000;
/**
 * Tiles around Birchport painted before the player enters. The rest of the
 * chart fills in the background.
 */
export const BIRCHPORT_MAP_BOOT_RADIUS = 400;

/** Chart byte values. 0 means the tile is outside the precomputed region. */
export const MAP_CHART_EMPTY = 0;
export const MAP_CHART_FLOOR = 1;
export const MAP_CHART_ROAD = 2;
export const MAP_CHART_PAVEMENT = 3;
export const MAP_CHART_CARPARK = 4;
export const MAP_CHART_BARRACKS = 5;
export const MAP_CHART_BUILDING = 6;

export type BirchportMapChart = {
  minX: number;
  minY: number;
  width: number;
  height: number;
  kinds: Uint8Array;
};

type MapChartCell = { cx: number; cy: number };

let birchportMapChartCache: BirchportMapChart | null = null;
let birchportMapChartQueue: MapChartCell[] = [];
let birchportMapChartCursor = 0;
let birchportMapChartRev = 0;
let birchportMapChartFocusX = Number.NaN;
let birchportMapChartFocusY = Number.NaN;
let birchportBootChartDone = false;

function mapChartCellNear(
  cell: MapChartCell,
  x: number,
  y: number,
  radius: number,
): boolean {
  const x1 = cell.cx + SETTLEMENT_CELL;
  const y1 = cell.cy + SETTLEMENT_CELL;
  const nx = x < cell.cx ? cell.cx : x >= x1 ? x1 - 1 : x;
  const ny = y < cell.cy ? cell.cy : y >= y1 ? y1 - 1 : y;
  return Math.max(Math.abs(nx - x), Math.abs(ny - y)) <= radius;
}

/** Kind byte for a tile in the Birchport chart, or 0 when it was not precomputed. */
export function birchportMapChartKind(
  chart: BirchportMapChart,
  tx: number,
  ty: number,
): number {
  const lx = tx - chart.minX;
  const ly = ty - chart.minY;
  if (lx < 0 || ly < 0 || lx >= chart.width || ly >= chart.height) return MAP_CHART_EMPTY;
  return chart.kinds[ly * chart.width + lx] ?? MAP_CHART_EMPTY;
}

/** Bumps when background charting paints new cells, so an open map can refresh. */
export function birchportMapChartRevision(): number {
  return birchportMapChartRev;
}

export function birchportMapChartPending(): number {
  return Math.max(0, birchportMapChartQueue.length - birchportMapChartCursor);
}

/**
 * Allocate the chart and the cell queue. Does not paint towns. Painting the
 * spawn area in one turn freezes phones, so boot slices it with
 * {@link stepBirchportBootChart}.
 */
function ensureBirchportMapChart(): BirchportMapChart {
  if (birchportMapChartCache) return birchportMapChartCache;

  const hub = getPlayerSpawnHub();
  const width = BIRCHPORT_MAP_CHART_TILES;
  const height = BIRCHPORT_MAP_CHART_TILES;
  const minX = Math.floor(hub.x) - Math.floor(width / 2);
  const minY = Math.floor(hub.y) - Math.floor(height / 2);
  const maxX = minX + width - 1;
  const maxY = minY + height - 1;
  const kinds = new Uint8Array(width * height);
  kinds.fill(MAP_CHART_FLOOR);
  birchportMapChartCache = { minX, minY, width, height, kinds };
  const yard = BIRCHPORT_BARRACKS_BOUNDS;
  for (let y = Math.max(minY, yard.minY); y <= Math.min(maxY, yard.maxY); y++) {
    const row = (y - minY) * width;
    for (let x = Math.max(minX, yard.minX); x <= Math.min(maxX, yard.maxX); x++) {
      kinds[row + (x - minX)] = MAP_CHART_BARRACKS;
    }
  }

  const cells = settlementCellsInRegion(
    minX - SETTLEMENT_CELL,
    maxX + SETTLEMENT_CELL,
    minY - SETTLEMENT_CELL,
    maxY + SETTLEMENT_CELL,
  );
  const hx = hub.x;
  const hy = hub.y;
  cells.sort((a, b) => {
    const da = Math.max(Math.abs(a.cx + SETTLEMENT_CELL / 2 - hx), Math.abs(a.cy + SETTLEMENT_CELL / 2 - hy));
    const db = Math.max(Math.abs(b.cx + SETTLEMENT_CELL / 2 - hx), Math.abs(b.cy + SETTLEMENT_CELL / 2 - hy));
    return da - db;
  });
  birchportMapChartQueue = cells;
  birchportMapChartCursor = 0;
  birchportBootChartDone = false;
  return birchportMapChartCache;
}

/**
 * Paint towns around Birchport for up to `budgetMs`. Returns true when that
 * spawn area is done. One town can be slow on a phone, so callers should
 * yield between calls instead of looping until true on the same turn.
 */
export function stepBirchportBootChart(budgetMs: number): boolean {
  ensureBirchportMapChart();
  if (birchportBootChartDone) return true;
  const hub = getPlayerSpawnHub();
  const deadline = Date.now() + Math.max(1, budgetMs);
  let painted = 0;
  while (birchportMapChartCursor < birchportMapChartQueue.length && Date.now() < deadline) {
    const cell = birchportMapChartQueue[birchportMapChartCursor]!;
    if (!mapChartCellNear(cell, hub.x, hub.y, BIRCHPORT_MAP_BOOT_RADIUS)) {
      birchportBootChartDone = true;
      if (painted > 0) birchportMapChartRev++;
      return true;
    }
    paintBirchportMapChartCell(cell.cx, cell.cy);
    birchportMapChartCursor++;
    painted++;
  }
  if (painted > 0) birchportMapChartRev++;
  if (birchportMapChartCursor >= birchportMapChartQueue.length) {
    birchportBootChartDone = true;
  }
  return birchportBootChartDone;
}

/**
 * Raster of Birchport and the land around it. The full buffer exists immediately.
 * The spawn-area towns are painted here. {@link stepBirchportMapChart} fills the rest.
 */
export function prepareBirchportMapChart(): BirchportMapChart {
  const chart = ensureBirchportMapChart();
  let guard = 0;
  while (!stepBirchportBootChart(32) && guard++ < 100000) {
    /* direct callers need the spawn area before they read the buffer */
  }
  return chart;
}

/** Chart buffer. Prepares the Birchport boot area on first use. */
export function getBirchportMapChart(): BirchportMapChart {
  return prepareBirchportMapChart();
}

/**
 * Paint more of the chart. Cells near `focusX`/`focusY` jump the queue when
 * the player or the map view moves. Returns true when the chart is finished.
 */
export function stepBirchportMapChart(
  budgetMs: number,
  focusX?: number,
  focusY?: number,
): boolean {
  ensureBirchportMapChart();
  if (
    typeof focusX === "number" &&
    typeof focusY === "number" &&
    Number.isFinite(focusX) &&
    Number.isFinite(focusY) &&
    (Math.abs(focusX - birchportMapChartFocusX) > 64 ||
      Math.abs(focusY - birchportMapChartFocusY) > 64)
  ) {
    birchportMapChartFocusX = focusX;
    birchportMapChartFocusY = focusY;
    const near: MapChartCell[] = [];
    const far: MapChartCell[] = [];
    for (let i = birchportMapChartCursor; i < birchportMapChartQueue.length; i++) {
      const cell = birchportMapChartQueue[i]!;
      if (mapChartCellNear(cell, focusX, focusY, 500)) near.push(cell);
      else far.push(cell);
    }
    if (near.length > 0) {
      birchportMapChartQueue = [
        ...birchportMapChartQueue.slice(0, birchportMapChartCursor),
        ...near,
        ...far,
      ];
    }
  }

  const deadline = Date.now() + Math.max(0, budgetMs);
  let painted = 0;
  while (birchportMapChartCursor < birchportMapChartQueue.length && Date.now() < deadline) {
    const cell = birchportMapChartQueue[birchportMapChartCursor]!;
    paintBirchportMapChartCell(cell.cx, cell.cy);
    birchportMapChartCursor++;
    painted++;
  }
  if (painted > 0) birchportMapChartRev++;
  return birchportMapChartCursor >= birchportMapChartQueue.length;
}

function paintBirchportMapChartCell(cx: number, cy: number): void {
  const chart = birchportMapChartCache;
  if (!chart) return;
  if (settlementType(cx, cy) === "none") return;
  const { minX, minY, width, height, kinds } = chart;
  const maxX = minX + width - 1;
  const maxY = minY + height - 1;

  const fillRect = (
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    kind: number,
    onlyFloor = false,
  ) => {
    const xa = Math.max(minX, x0);
    const xb = Math.min(maxX, x1);
    const ya = Math.max(minY, y0);
    const yb = Math.min(maxY, y1);
    for (let y = ya; y <= yb; y++) {
      const row = (y - minY) * width;
      for (let x = xa; x <= xb; x++) {
        const i = row + (x - minX);
        if (onlyFloor && kinds[i] !== MAP_CHART_FLOOR) continue;
        kinds[i] = kind;
      }
    }
  };

  const paintBand = (
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    orient: "v" | "h",
    widthTiles: number,
  ) => {
    const xa = Math.max(minX, x0);
    const xb = Math.min(maxX, x1 - 1);
    const ya = Math.max(minY, y0);
    const yb = Math.min(maxY, y1 - 1);
    for (let y = ya; y <= yb; y++) {
      const row = (y - minY) * width;
      for (let x = xa; x <= xb; x++) {
        const rel = orient === "v" ? x - x0 : y - y0;
        const side = rel < STREET_PAVEMENT || rel >= widthTiles - STREET_PAVEMENT;
        kinds[row + (x - minX)] = side ? MAP_CHART_PAVEMENT : MAP_CHART_ROAD;
      }
    }
  };

  const layout = getCachedLayout(cx, cy);
    if (layout) {
      const { numCols, numRows, lotXStart, lotXEnd, lotYStart, lotYEnd, carPark } = layout;
      for (let col = 0; col < numCols; col++) {
        for (let row = 0; row < numRows; row++) {
          if (!carPark[col]?.[row]) continue;
          fillRect(
            lotXStart[col]!,
            lotYStart[row]!,
            lotXEnd[col]! - 1,
            lotYEnd[row]! - 1,
            MAP_CHART_CARPARK,
            true,
          );
        }
      }
      for (let c = 0; c < layout.vStreetXs.length; c++) {
        const sx = layout.vStreetXs[c]!;
        const [yFrom, yTo] = layout.vExtents[c]!;
        paintBand(sx, yFrom, sx + STREET_TOTAL, yTo, "v", STREET_TOTAL);
      }
      for (let r = 0; r < layout.hStreetYs.length; r++) {
        const sy = layout.hStreetYs[r]!;
        const [xFrom, xTo] = layout.hExtents[r]!;
        paintBand(xFrom, sy, xTo, sy + STREET_TOTAL, "h", STREET_TOTAL);
      }
      for (const road of layout.arterials) {
        paintBand(road.x0, road.y0, road.x1, road.y1, road.orient, road.width);
      }
    }
    for (const bld of settlementBuildings(cx, cy)) {
      fillRect(bld.ox, bld.oy, bld.ox + bld.w - 1, bld.oy + bld.h - 1, MAP_CHART_BUILDING);
    }
}
