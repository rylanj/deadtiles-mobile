/**
 * Overworld cellar bulkheads. Cellar1_SE covers two tile centres along +x.
 * Clicking a footprint tile walks onto it and enters the underground room.
 */

export type CellarDoor = {
  ox: number;
  oy: number;
  w: number;
  h: number;
  facing: "SE";
};

/** 2×1 along +x. Tile centres (546.5, -171.5) and (547.5, -171.5). */
export const CELLAR_DOORS: readonly CellarDoor[] = [
  { ox: 546, oy: -172, w: 2, h: 1, facing: "SE" },
];

/** Underground room size. Concrete, and dark even at noon. */
export const CELLAR_INTERIOR_W = 12;
export const CELLAR_INTERIOR_H = 10;

const cellarAt = new Map<string, CellarDoor>();
for (const door of CELLAR_DOORS) {
  for (let dy = 0; dy < door.h; dy++) {
    for (let dx = 0; dx < door.w; dx++) {
      cellarAt.set(`${door.ox + dx},${door.oy + dy}`, door);
    }
  }
}

export function getCellarAt(tx: number, ty: number): CellarDoor | null {
  return cellarAt.get(`${tx},${ty}`) ?? null;
}

/** True when (bx, by) is the interior key for a cellar (its footprint origin). */
export function isCellarInterior(bx: number, by: number): boolean {
  const door = getCellarAt(bx, by);
  return !!door && door.ox === bx && door.oy === by;
}

/** Footprint tile closest to a world position. Used to route a click on the door art. */
export function nearestCellarTile(
  door: CellarDoor,
  px: number,
  py: number,
): { x: number; y: number } {
  let bestX = door.ox;
  let bestY = door.oy;
  let best = Infinity;
  for (let dy = 0; dy < door.h; dy++) {
    for (let dx = 0; dx < door.w; dx++) {
      const x = door.ox + dx;
      const y = door.oy + dy;
      const dist = Math.max(Math.abs(px - (x + 0.5)), Math.abs(py - (y + 0.5)));
      if (dist < best) {
        best = dist;
        bestX = x;
        bestY = y;
      }
    }
  }
  return { x: bestX, y: bestY };
}
