import { EXTEND_AMOUNT, EXTEND_THRESHOLD, INITIAL_MAP_HEIGHT, INITIAL_MAP_WIDTH, MAX_MAP_DIMENSION } from "./constants.js";

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

/** False when extending would push a dimension past MAX_MAP_DIMENSION. */
export function canExtendWorld(
  bounds: WorldBounds,
  direction: ExtendDirection,
): boolean {
  if (direction === "left" || direction === "right") {
    return bounds.mapWidth + EXTEND_AMOUNT <= MAX_MAP_DIMENSION;
  }
  return bounds.mapHeight + EXTEND_AMOUNT <= MAX_MAP_DIMENSION;
}

export function extendWorldBounds(
  bounds: WorldBounds,
  direction: ExtendDirection,
): WorldBounds {
  if (!canExtendWorld(bounds, direction)) return bounds;
  switch (direction) {
    case "right":
      return { ...bounds, mapWidth: bounds.mapWidth + EXTEND_AMOUNT };
    case "bottom":
      return { ...bounds, mapHeight: bounds.mapHeight + EXTEND_AMOUNT };
    case "left":
      return {
        ...bounds,
        minGlobalX: bounds.minGlobalX - EXTEND_AMOUNT,
        mapWidth: bounds.mapWidth + EXTEND_AMOUNT,
      };
    case "top":
      return {
        ...bounds,
        minGlobalY: bounds.minGlobalY - EXTEND_AMOUNT,
        mapHeight: bounds.mapHeight + EXTEND_AMOUNT,
      };
  }
}

/** Tile range added by an extension (global coordinates). */
export function extensionTileRange(
  before: WorldBounds,
  direction: ExtendDirection,
): { minX: number; maxX: number; minY: number; maxY: number } {
  switch (direction) {
    case "right":
      return {
        minX: worldMaxX(before),
        maxX: worldMaxX(before) + EXTEND_AMOUNT - 1,
        minY: before.minGlobalY,
        maxY: worldMaxY(before) - 1,
      };
    case "bottom":
      return {
        minX: before.minGlobalX,
        maxX: worldMaxX(before) - 1,
        minY: worldMaxY(before),
        maxY: worldMaxY(before) + EXTEND_AMOUNT - 1,
      };
    case "left":
      return {
        minX: before.minGlobalX - EXTEND_AMOUNT,
        maxX: before.minGlobalX - 1,
        minY: before.minGlobalY,
        maxY: worldMaxY(before) - 1,
      };
    case "top":
      return {
        minX: before.minGlobalX,
        maxX: worldMaxX(before) - 1,
        minY: before.minGlobalY - EXTEND_AMOUNT,
        maxY: before.minGlobalY - 1,
      };
  }
}
