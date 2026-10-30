import { TILE_HEIGHT, WALL_DEPTH, cartesianToIso } from "@zombie/shared";

/** Interior partition height. Door leaves use the same extrusion as walls. */
export const PARTITION_HEIGHT = WALL_DEPTH * 0.65;
/** Footprint thickness in tile units. Thin room dividers, not full-tile blocks. */
export const PARTITION_THICKNESS = 0.16;
/** Open-door leaf thickness (a bit slimmer than the closed footprint). */
const DOOR_OPEN_THICKNESS = PARTITION_THICKNESS * 0.7;

/** How far (tiles) a door leaf can reach from its tile, including the tall face. */
export const DOOR_LEAF_PICK_REACH =
  Math.ceil(PARTITION_HEIGHT / (TILE_HEIGHT / 2)) + 2;

/** Extra pixels so a tap on the door's edge still counts. */
const DOOR_LEAF_HIT_SLOP_PX = 4;

type DoorQuad = { x: number; y: number }[];

export function interiorDoorLeafBounds(
  ox: number,
  oy: number,
  axis: "ns" | "ew",
  isOpen: boolean,
): { x0: number; y0: number; x1: number; y1: number } {
  const cx = ox + 0.5;
  const cy = oy + 0.5;
  const halfT = PARTITION_THICKNESS / 2;
  if (!isOpen) {
    if (axis === "ns") {
      return { x0: cx - halfT, x1: cx + halfT, y0: oy, y1: oy + 1 };
    }
    return { x0: ox, x1: ox + 1, y0: cy - halfT, y1: cy + halfT };
  }
  if (axis === "ns") {
    // Hinge at the north end of the closed leaf (cx, oy); swing east.
    return {
      x0: cx - halfT,
      x1: cx - halfT + 1,
      y0: oy,
      y1: oy + DOOR_OPEN_THICKNESS,
    };
  }
  // Hinge at the west end of the closed leaf (ox, cy); swing south.
  return {
    x0: ox,
    x1: ox + DOOR_OPEN_THICKNESS,
    y0: cy - halfT,
    y1: cy - halfT + 1,
  };
}

/**
 * Camera-facing quads of one door leaf. Same faces `drawInteriorDoorTile` fills.
 */
export function interiorDoorLeafQuads(
  ox: number,
  oy: number,
  axis: "ns" | "ew",
  isOpen: boolean,
): { front: DoorQuad; side: DoorQuad; top: DoorQuad } {
  const { x0, y0, x1, y1 } = interiorDoorLeafBounds(ox, oy, axis, isOpen);
  const sw = cartesianToIso(x0, y1);
  const se = cartesianToIso(x1, y1);
  const ne = cartesianToIso(x1, y0);
  const nw = cartesianToIso(x0, y0);
  const up = (p: { x: number; y: number }) => ({
    x: p.x,
    y: p.y - PARTITION_HEIGHT,
  });
  return {
    front: [sw, se, up(se), up(sw)],
    side: [se, ne, up(ne), up(se)],
    top: [up(nw), up(ne), up(se), up(sw)],
  };
}

/** Wall-run axes a door leaf uses. Matches partition drawing. */
export function doorLeafAxes(
  wallSet: ReadonlySet<string>,
  ox: number,
  oy: number,
): ("ns" | "ew")[] {
  const hasN = wallSet.has(`${ox},${oy - 1}`);
  const hasS = wallSet.has(`${ox},${oy + 1}`);
  const hasW = wallSet.has(`${ox - 1},${oy}`);
  const hasE = wallSet.has(`${ox + 1},${oy}`);
  const runNS = hasN || hasS;
  const runEW = hasW || hasE || (!hasN && !hasS);
  const axes: ("ns" | "ew")[] = [];
  if (runNS) axes.push("ns");
  if (runEW) axes.push("ew");
  return axes;
}

function pointInDoorQuad(
  px: number,
  py: number,
  pts: DoorQuad,
  pad: number,
): boolean {
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % pts.length]!;
    area += a.x * b.y - b.x * a.y;
  }
  if (Math.abs(area) < 1) return false;
  const winding = area > 0 ? 1 : -1;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % pts.length]!;
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    const len = Math.hypot(ex, ey);
    if (len < 1e-4) continue;
    const cross = ex * (py - a.y) - ey * (px - a.x);
    if ((winding * cross) / len < -pad) return false;
  }
  return true;
}

/**
 * True when a world point lies on the door leaf (the tall faces, not only
 * the floor diamond).
 */
export function doorLeafCoversWorldPoint(
  ox: number,
  oy: number,
  axis: "ns" | "ew",
  isOpen: boolean,
  worldX: number,
  worldY: number,
): boolean {
  const quads = interiorDoorLeafQuads(ox, oy, axis, isOpen);
  return (
    pointInDoorQuad(worldX, worldY, quads.front, DOOR_LEAF_HIT_SLOP_PX) ||
    pointInDoorQuad(worldX, worldY, quads.side, DOOR_LEAF_HIT_SLOP_PX) ||
    pointInDoorQuad(worldX, worldY, quads.top, DOOR_LEAF_HIT_SLOP_PX)
  );
}
