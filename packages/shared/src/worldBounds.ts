import { EXTEND_AMOUNT, EXTEND_THRESHOLD, INITIAL_MAP_HEIGHT, INITIAL_MAP_WIDTH, MAX_MAP_DIMENSION } from "./constants.js";
import { REGION_SIZE } from "./region.js";

/**
 * Birchport settlement-cell origin. worldgen forces the hub city on this cell.
 * Keep stable: the city name is derived from these coordinates.
 */
export const BIRCHPORT_CELL_ORIGIN_X = -192;
export const BIRCHPORT_CELL_ORIGIN_Y = 96;

/** Walkable Ashen County, in settlement regions. 36 * 96 = 3456 tiles. */
export const ASHEN_COUNTY_REGIONS = 36;

/**
 * Generated scenery past the walkable county on every side, in regions.
 * Two regions (192 tiles) is more than the camera draws (~100), so the
 * hard void stays off-screen when a player stands at the fence.
 */
export const ASHEN_COUNTY_MARGIN_REGIONS = 2;

export type WorldBounds = {
  minGlobalX: number;
  minGlobalY: number;
  mapWidth: number;
  mapHeight: number;
};

export type ExtendDirection = "left" | "right" | "top" | "bottom";

export const INITIAL_WORLD_BOUNDS: WorldBounds = {
  minGlobalX: 0,
  minGlobalY: 0,
  mapWidth: INITIAL_MAP_WIDTH,
  mapHeight: INITIAL_MAP_HEIGHT,
};

export function worldMaxX(bounds: WorldBounds) {
  return bounds.minGlobalX + bounds.mapWidth;
}

export function worldMaxY(bounds: WorldBounds) {
  return bounds.minGlobalY + bounds.mapHeight;
}

export function isInWorldBounds(
  x: number,
  y: number,
  bounds: WorldBounds,
): boolean {
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  return (
    tx >= bounds.minGlobalX &&
    tx < worldMaxX(bounds) &&
    ty >= bounds.minGlobalY &&
    ty < worldMaxY(bounds)
  );
}

export function clampToWorldBounds(
  x: number,
  y: number,
  bounds: WorldBounds,
): { x: number; y: number } {
  return {
    x: Math.max(bounds.minGlobalX, Math.min(worldMaxX(bounds) - 1, x)),
    y: Math.max(bounds.minGlobalY, Math.min(worldMaxY(bounds) - 1, y)),
  };
}

/**
 * Region-aligned square centered on Birchport's cell as evenly as an even
 * region count allows (18 regions before the hub cell, 17 after).
 */
function countyOriginTile(hubCellOrigin: number, regions: number): number {
  const hubRegion = Math.floor(hubCellOrigin / REGION_SIZE);
  const regionsBeforeHub = Math.floor(regions / 2);
  return (hubRegion - regionsBeforeHub) * REGION_SIZE;
}

const COUNTY_TILES = ASHEN_COUNTY_REGIONS * REGION_SIZE;
const COUNTY_MARGIN_TILES = ASHEN_COUNTY_MARGIN_REGIONS * REGION_SIZE;
const COUNTY_ORIGIN_X = countyOriginTile(BIRCHPORT_CELL_ORIGIN_X, ASHEN_COUNTY_REGIONS);
const COUNTY_ORIGIN_Y = countyOriginTile(BIRCHPORT_CELL_ORIGIN_Y, ASHEN_COUNTY_REGIONS);

/**
 * Buildings and yard fences crossed the old fence. The walkable county
 * grows on those sides only, in steps of 4 so the border sheets still tile.
 * East 16 clears Clear Valley and East Raven Springs. West 16 and south 20
 * clear the lots and fences the 8-tile try still cut. North 12 clears the
 * yard panels on that fence. 4 and 8 still sat on houses.
 */
export const ASHEN_COUNTY_EAST_EXTRA_TILES = 16;
export const ASHEN_COUNTY_WEST_EXTRA_TILES = 16;
export const ASHEN_COUNTY_SOUTH_EXTRA_TILES = 20;
export const ASHEN_COUNTY_NORTH_EXTRA_TILES = 12;

/** Tiles players can walk. 3488 east-west, 3488 north-south. */
export const ASHEN_COUNTY_WALK_BOUNDS: WorldBounds = {
  minGlobalX: COUNTY_ORIGIN_X - ASHEN_COUNTY_WEST_EXTRA_TILES,
  minGlobalY: COUNTY_ORIGIN_Y - ASHEN_COUNTY_NORTH_EXTRA_TILES,
  mapWidth: COUNTY_TILES + ASHEN_COUNTY_EAST_EXTRA_TILES + ASHEN_COUNTY_WEST_EXTRA_TILES,
  mapHeight: COUNTY_TILES + ASHEN_COUNTY_SOUTH_EXTRA_TILES + ASHEN_COUNTY_NORTH_EXTRA_TILES,
};

/**
 * Tiles the server will generate. Two regions past the original county edge,
 * so the camera shows land beyond the fence. Each side gives up some of that
 * margin where the walkable county grew. Still 3840×3840.
 * The origin stays on the original county, so growing west does not slide
 * the whole map.
 */
export const ASHEN_COUNTY_GENERATION_BOUNDS: WorldBounds = {
  minGlobalX: COUNTY_ORIGIN_X - COUNTY_MARGIN_TILES,
  minGlobalY: COUNTY_ORIGIN_Y - COUNTY_MARGIN_TILES,
  mapWidth: COUNTY_TILES + COUNTY_MARGIN_TILES * 2,
  mapHeight: COUNTY_TILES + COUNTY_MARGIN_TILES * 2,
};

if (
  ASHEN_COUNTY_GENERATION_BOUNDS.mapWidth !== MAX_MAP_DIMENSION ||
  ASHEN_COUNTY_GENERATION_BOUNDS.mapHeight !== MAX_MAP_DIMENSION
) {
  throw new Error("Ashen County generation cap must match MAX_MAP_DIMENSION");
}

if (
  ASHEN_COUNTY_WALK_BOUNDS.minGlobalX < ASHEN_COUNTY_GENERATION_BOUNDS.minGlobalX ||
  ASHEN_COUNTY_WALK_BOUNDS.minGlobalY < ASHEN_COUNTY_GENERATION_BOUNDS.minGlobalY ||
  worldMaxX(ASHEN_COUNTY_WALK_BOUNDS) > worldMaxX(ASHEN_COUNTY_GENERATION_BOUNDS) ||
  worldMaxY(ASHEN_COUNTY_WALK_BOUNDS) > worldMaxY(ASHEN_COUNTY_GENERATION_BOUNDS)
) {
  throw new Error("Ashen County walk bounds must stay inside the generation rectangle");
}

/** True on tiles survivors are allowed to walk. The outer ring is scenery. */
export function isInCountyWalkBounds(x: number, y: number): boolean {
  return isInWorldBounds(x, y, ASHEN_COUNTY_WALK_BOUNDS);
}

/** Pull a point onto the walkable county. Outside clicks stop at the border. */
export function clampToCountyWalk(x: number, y: number): { x: number; y: number } {
  return clampToWorldBounds(x, y, ASHEN_COUNTY_WALK_BOUNDS);
}

export function getExtensionsNeeded(
  x: number,
  y: number,
  bounds: WorldBounds,
): ExtendDirection[] {
  const directions: ExtendDirection[] = [];
  if (x < bounds.minGlobalX + EXTEND_THRESHOLD) directions.push("left");
  if (x > worldMaxX(bounds) - EXTEND_THRESHOLD) directions.push("right");
  if (y < bounds.minGlobalY + EXTEND_THRESHOLD) directions.push("top");
  if (y > worldMaxY(bounds) - EXTEND_THRESHOLD) directions.push("bottom");
  return directions;
}

/** Tiles still available before this direction hits the generation rectangle. */
function generationRoom(bounds: WorldBounds, direction: ExtendDirection): number {
  const cap = ASHEN_COUNTY_GENERATION_BOUNDS;
  switch (direction) {
    case "left":
      return bounds.minGlobalX - cap.minGlobalX;
    case "right":
      return worldMaxX(cap) - worldMaxX(bounds);
    case "top":
      return bounds.minGlobalY - cap.minGlobalY;
    case "bottom":
      return worldMaxY(cap) - worldMaxY(bounds);
  }
}

/** How many tiles this extension may add. The last step stops on the cap. */
function extendTiles(bounds: WorldBounds, direction: ExtendDirection): number {
  const room = generationRoom(bounds, direction);
  if (room <= 0) return 0;
  const span = direction === "left" || direction === "right" ? bounds.mapWidth : bounds.mapHeight;
  const spanRoom = MAX_MAP_DIMENSION - span;
  if (spanRoom <= 0) return 0;
  return Math.min(EXTEND_AMOUNT, room, spanRoom);
}

/** False when this direction is already flush with the generation cap. */
export function canExtendWorld(
  bounds: WorldBounds,
  direction: ExtendDirection,
): boolean {
  return extendTiles(bounds, direction) > 0;
}

export function extendWorldBounds(
  bounds: WorldBounds,
  direction: ExtendDirection,
): WorldBounds {
  const tiles = extendTiles(bounds, direction);
  if (tiles <= 0) return bounds;
  switch (direction) {
    case "right":
      return { ...bounds, mapWidth: bounds.mapWidth + tiles };
    case "bottom":
      return { ...bounds, mapHeight: bounds.mapHeight + tiles };
    case "left":
      return {
        ...bounds,
        minGlobalX: bounds.minGlobalX - tiles,
        mapWidth: bounds.mapWidth + tiles,
      };
    case "top":
      return {
        ...bounds,
        minGlobalY: bounds.minGlobalY - tiles,
        mapHeight: bounds.mapHeight + tiles,
      };
  }
}

/** Tile range added by an extension (global coordinates). */
export function extensionTileRange(
  before: WorldBounds,
  after: WorldBounds,
): { minX: number; maxX: number; minY: number; maxY: number } {
  if (after.minGlobalX < before.minGlobalX) {
    return {
      minX: after.minGlobalX,
      maxX: before.minGlobalX - 1,
      minY: after.minGlobalY,
      maxY: worldMaxY(after) - 1,
    };
  }
  if (worldMaxX(after) > worldMaxX(before)) {
    return {
      minX: worldMaxX(before),
      maxX: worldMaxX(after) - 1,
      minY: after.minGlobalY,
      maxY: worldMaxY(after) - 1,
    };
  }
  if (after.minGlobalY < before.minGlobalY) {
    return {
      minX: after.minGlobalX,
      maxX: worldMaxX(after) - 1,
      minY: after.minGlobalY,
      maxY: before.minGlobalY - 1,
    };
  }
  return {
    minX: after.minGlobalX,
    maxX: worldMaxX(after) - 1,
    minY: worldMaxY(before),
    maxY: worldMaxY(after) - 1,
  };
}

/**
 * Tiles one border sheet covers along its run.
 * SE is 1×4 (north-south). SW is 4×1 (east-west).
 * Both county side lengths divide by 4, so each side is an exact run of panels.
 * A 3-tile fit had to be scaled past the tiles to look tall enough, and that
 * same extra width stacked every sheet on its neighbours.
 */
export const BORDER_WALL_RUN_TILES = 4;

export function borderWallFootprint(facing: BorderWallFacing): {
  w: number;
  h: number;
} {
  return facing === "SE"
    ? { w: 1, h: BORDER_WALL_RUN_TILES }
    : { w: BORDER_WALL_RUN_TILES, h: 1 };
}

export type BorderWallFacing = "SE" | "SW";

export type BorderWallSegment = {
  ox: number;
  oy: number;
  facing: BorderWallFacing;
};

function borderWallOrigin(edge: number, tile: number): number {
  const index = Math.floor((tile - edge) / BORDER_WALL_RUN_TILES);
  return edge + index * BORDER_WALL_RUN_TILES;
}

/**
 * Metal border panel covering this tile, or null.
 * The wall sits on the first tile outside the walkable county.
 * East-west sides use SW. North-south sides use SE.
 * The four corner tiles are left empty for corner pieces.
 */
export function getBorderWallAt(x: number, y: number): BorderWallSegment | null {
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  const minX = ASHEN_COUNTY_WALK_BOUNDS.minGlobalX;
  const minY = ASHEN_COUNTY_WALK_BOUNDS.minGlobalY;
  const maxX = worldMaxX(ASHEN_COUNTY_WALK_BOUNDS);
  const maxY = worldMaxY(ASHEN_COUNTY_WALK_BOUNDS);

  if (ty === minY - 1 && tx >= minX && tx < maxX) {
    return { ox: borderWallOrigin(minX, tx), oy: ty, facing: "SW" };
  }
  if (ty === maxY && tx >= minX && tx < maxX) {
    return { ox: borderWallOrigin(minX, tx), oy: ty, facing: "SW" };
  }
  if (tx === minX - 1 && ty >= minY && ty < maxY) {
    return { ox: tx, oy: borderWallOrigin(minY, ty), facing: "SE" };
  }
  if (tx === maxX && ty >= minY && ty < maxY) {
    return { ox: tx, oy: borderWallOrigin(minY, ty), facing: "SE" };
  }
  return null;
}

/**
 * Closed county gates. Each one replaces the wall panel that owns that origin.
 * The barred window sits just left of centre on the sheet. On an east-west
 * wall that is the second tile. On a north-south wall the sheet's left side
 * is the south end, so the window is the third tile. Panels are chosen so
 * that window lands on the road.
 *
 * West Glenham's north road through Hill Bay dead-ends inside the county,
 * so it has no gate.
 */
const SOUTH_WALL_Y = worldMaxY(ASHEN_COUNTY_WALK_BOUNDS);
const NORTH_WALL_Y = ASHEN_COUNTY_WALK_BOUNDS.minGlobalY - 1;
const EAST_WALL_X = worldMaxX(ASHEN_COUNTY_WALK_BOUNDS);
const WEST_WALL_X = ASHEN_COUNTY_WALK_BOUNDS.minGlobalX - 1;

const BORDER_GATES: readonly BorderWallSegment[] = [
  // South border. Outside is +Y.
  { ox: 572, oy: SOUTH_WALL_Y, facing: "SW" }, // Ironcreek, northbound
  { ox: -948, oy: SOUTH_WALL_Y, facing: "SW" }, // Hollybridge, southbound
  // North border. Outside is -Y.
  { ox: -1156, oy: NORTH_WALL_Y, facing: "SW" }, // White River, northbound
  { ox: -304, oy: NORTH_WALL_Y, facing: "SW" }, // Upper Silverchester, northbound
  { ox: 1052, oy: NORTH_WALL_Y, facing: "SW" }, // Heron Crossing, northbound (the road nearer the city)
  // West border. Outside is -X.
  { ox: WEST_WALL_X, oy: 332, facing: "SE" }, // Wolf Hollow, eastbound
  { ox: WEST_WALL_X, oy: -304, facing: "SE" }, // Woodheath, westbound
  { ox: WEST_WALL_X, oy: -680, facing: "SE" }, // Whitepoint eastbound / Creek Ridge westbound
  // East border. Outside is +X.
  { ox: EAST_WALL_X, oy: -288, facing: "SE" }, // South Fordhollow, westbound
  { ox: EAST_WALL_X, oy: 480, facing: "SE" }, // Clear Valley eastbound, Peak Hill on the road
];

/** Animals do not spawn this close to the county fence, including the gate. */
export const BORDER_ANIMAL_CLEAR_TILES = 10;

/**
 * True when this tile is within {@link BORDER_ANIMAL_CLEAR_TILES} of the
 * metal border. Distance is Chebyshev to the nearest wall tile. The four
 * corners have no sheet, and they still count because they sit against
 * the ends of the two runs.
 */
export function isNearBorderWall(x: number, y: number): boolean {
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  const minX = ASHEN_COUNTY_WALK_BOUNDS.minGlobalX;
  const minY = ASHEN_COUNTY_WALK_BOUNDS.minGlobalY;
  const maxX = worldMaxX(ASHEN_COUNTY_WALK_BOUNDS);
  const maxY = worldMaxY(ASHEN_COUNTY_WALK_BOUNDS);

  const along = (value: number, start: number, end: number) =>
    value < start ? start - value : value > end ? value - end : 0;
  const north = Math.max(along(tx, minX, maxX - 1), Math.abs(ty - (minY - 1)));
  const south = Math.max(along(tx, minX, maxX - 1), Math.abs(ty - maxY));
  const west = Math.max(along(ty, minY, maxY - 1), Math.abs(tx - (minX - 1)));
  const east = Math.max(along(ty, minY, maxY - 1), Math.abs(tx - maxX));
  return Math.min(north, south, west, east) <= BORDER_ANIMAL_CLEAR_TILES;
}

export function isBorderGate(ox: number, oy: number): boolean {
  const tx = Math.floor(ox);
  const ty = Math.floor(oy);
  for (const gate of BORDER_GATES) {
    if (gate.ox === tx && gate.oy === ty) return true;
  }
  return false;
}

/** Closed county gates on the roads that leave Ashen County. */
export function borderGates(): readonly BorderWallSegment[] {
  return BORDER_GATES;
}

for (const gate of BORDER_GATES) {
  const wall = getBorderWallAt(gate.ox, gate.oy);
  if (!wall || wall.ox !== gate.ox || wall.oy !== gate.oy || wall.facing !== gate.facing) {
    throw new Error(`Border gate ${gate.ox},${gate.oy} is not a wall panel`);
  }
}

/** Panels whose footprint can affect depth sorting around (tx, ty). */
export function borderWallsNear(
  tx: number,
  ty: number,
  reach: number,
): BorderWallSegment[] {
  const minX = ASHEN_COUNTY_WALK_BOUNDS.minGlobalX - 1;
  const minY = ASHEN_COUNTY_WALK_BOUNDS.minGlobalY - 1;
  const maxX = worldMaxX(ASHEN_COUNTY_WALK_BOUNDS);
  const maxY = worldMaxY(ASHEN_COUNTY_WALK_BOUNDS);
  const xNear = tx >= minX - reach && tx <= maxX + reach;
  const yNear = ty >= minY - reach && ty <= maxY + reach;
  const onNorthOrSouth =
    xNear &&
    ((ty >= minY - reach && ty <= minY + reach) ||
      (ty >= maxY - reach && ty <= maxY + reach));
  const onWestOrEast =
    yNear &&
    ((tx >= minX - reach && tx <= minX + reach) ||
      (tx >= maxX - reach && tx <= maxX + reach));
  if (!onNorthOrSouth && !onWestOrEast) return [];

  const out: BorderWallSegment[] = [];
  const seen = new Set<string>();
  for (let y = ty - reach; y <= ty + reach; y++) {
    for (let x = tx - reach; x <= tx + reach; x++) {
      const wall = getBorderWallAt(x, y);
      if (!wall) continue;
      const key = `${wall.ox},${wall.oy}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(wall);
    }
  }
  return out;
}
