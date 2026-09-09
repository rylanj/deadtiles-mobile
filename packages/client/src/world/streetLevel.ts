import {
  generateTile,
  getStreetTileType,
  getStreetlightAt,
  TileType,
} from "@zombie/shared";

/** Sidewalks sit at grass height. Roads drop below that grade. */
export const SIDEWALK_LIFT = 0;
/** Screen-Y drop for road surfaces so they read as recessed. */
export const STREET_RECESS = 4;

export function streetSurfaceAt(
  tx: number,
  ty: number,
): TileType | null {
  const ttype = generateTile(tx, ty);
  if (ttype === TileType.Road || ttype === TileType.Pavement) return ttype;
  if (getStreetlightAt(tx, ty)) {
    const under = getStreetTileType(tx, ty);
    if (under === TileType.Road || under === TileType.Pavement) return under;
  }
  return null;
}

export function sidewalkLiftAt(tx: number, ty: number) {
  return streetSurfaceAt(tx, ty) === TileType.Pavement ? SIDEWALK_LIFT : 0;
}

export function isRoadTile(tx: number, ty: number) {
  return streetSurfaceAt(tx, ty) === TileType.Road;
}

/** Screen-Y shift for decals and puddles. Roads drop with the recessed street. */
export function streetSurfaceY(tx: number, ty: number) {
  return isRoadTile(tx, ty) ? STREET_RECESS : 0;
}
