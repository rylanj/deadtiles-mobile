/**
 * Birchport militia barracks compound: worldgen chain-link courtyard
 * west of the north-south street (bargate faces the road at x = -179).
 *
 * Baked from the player-built yard at about -177.5, 104.5. Collision and
 * sprites use the same 3-tile chain-link / bargate pieces as player fences.
 * The yard interior is reserved so worldgen cannot drop a building inside.
 */

import {
  structureFenceFootprint,
  structureOccupiedTiles,
  type StructureFenceCorner,
  type StructureFenceFacing,
} from "./structureFence.js";

/** Owner marker on client copies so deconstruct / refund never treat these as player-built. */
export const WORLD_CHAINLINK_OWNER = "world";

export type WorldChainlinkPanel = {
  x: number;
  y: number;
  facing: StructureFenceFacing;
  kind: "fence" | "bargate";
};

export type WorldChainlinkCorner = {
  x: number;
  y: number;
  corner: StructureFenceCorner;
};

/** Inclusive tile AABB of the compound (walls + yard). */
export const BIRCHPORT_BARRACKS_BOUNDS = {
  minX: -195,
  maxX: -179,
  minY: 87,
  maxY: 121,
} as const;

const WEST_SE_YS = [
  88, 91, 94, 97, 100, 103, 106, 109, 112, 115, 118,
] as const;
const EAST_SE_YS = [
  88, 91, 94, 97, 100, 103, 106, 109, 112, 115, 118,
] as const;
const NORTH_SW_XS = [-194, -191, -188, -185, -182] as const;
const SOUTH_SW_XS = [-194, -191, -188, -185, -182] as const;
const BARGATE_X = -179;
const BARGATE_Y = 103;

/** East-fence bargate origin (SE, occupies y..y+2). */
export const BIRCHPORT_BARRACKS_BARGATE = {
  x: BARGATE_X,
  y: BARGATE_Y,
  facing: "SE" as const,
} as const;

export function birchportBarracksBargateTiles(): { x: number; y: number }[] {
  return structureOccupiedTiles({
    kind: "bargate",
    x: BIRCHPORT_BARRACKS_BARGATE.x,
    y: BIRCHPORT_BARRACKS_BARGATE.y,
    facing: BIRCHPORT_BARRACKS_BARGATE.facing,
  });
}

export function birchportBarracksBargateOccupiesTile(
  tx: number,
  ty: number,
): boolean {
  return birchportBarracksBargateTiles().some((t) => t.x === tx && t.y === ty);
}

/** Mid-panel tile of the 3-tile SE bargate. */
function birchportBarracksBargateMidTile(): { x: number; y: number } {
  const gate = BIRCHPORT_BARRACKS_BARGATE;
  const { h } = structureFenceFootprint(gate.facing);
  return { x: gate.x, y: gate.y + Math.floor(h / 2) };
}

/** Street-side stand tile (east of the bargate). */
export function birchportBarracksBargateOutsideStand(): {
  x: number;
  y: number;
} {
  const mid = birchportBarracksBargateMidTile();
  return { x: mid.x + 1, y: mid.y };
}

/** Yard-side stand tile (west of the bargate). */
export function birchportBarracksBargateInsideStand(): {
  x: number;
  y: number;
} {
  const mid = birchportBarracksBargateMidTile();
  return { x: mid.x - 1, y: mid.y };
}

/**
 * Far side of the bargate from (px, py): yard if closer to the street,
 * street if closer to the yard. Used to walk through an open gate.
 */
export function birchportBarracksBargateCrossStand(
  px: number,
  py: number,
): { x: number; y: number } {
  const outside = birchportBarracksBargateOutsideStand();
  const inside = birchportBarracksBargateInsideStand();
  const distOut = Math.hypot(px - (outside.x + 0.5), py - (outside.y + 0.5));
  const distIn = Math.hypot(px - (inside.x + 0.5), py - (inside.y + 0.5));
  return distOut <= distIn ? inside : outside;
}

/** True when standing in the compound west of the east-fence bargate. */
export function isInBirchportBarracksYard(tx: number, ty: number): boolean {
  return isInBirchportBarracks(tx, ty) && tx < BIRCHPORT_BARRACKS_BARGATE.x;
}

/**
 * Street tiles just outside the bargate, one north and one south of the
 * 3-tile opening. Street begins at x = BARGATE_X + 1.
 */
export function birchportBarracksBargateOutsideFlanks(): {
  x: number;
  y: number;
}[] {
  const tiles = structureOccupiedTiles({
    kind: "bargate",
    x: BARGATE_X,
    y: BARGATE_Y,
    facing: "SE",
  });
  const first = tiles[0]!;
  const last = tiles[tiles.length - 1]!;
  return [
    { x: first.x + 1, y: first.y - 1 },
    { x: last.x + 1, y: last.y + 1 },
  ];
}

function sePanels(
  x: number,
  ys: readonly number[],
): WorldChainlinkPanel[] {
  return ys.map((y) => ({
    x,
    y,
    facing: "SE" as const,
    kind: x === BARGATE_X && y === BARGATE_Y ? "bargate" as const : "fence" as const,
  }));
}

function swPanels(
  y: number,
  xs: readonly number[],
): WorldChainlinkPanel[] {
  return xs.map((x) => ({
    x,
    y,
    facing: "SW" as const,
    kind: "fence" as const,
  }));
}

/** West, north, east (with bargate), and south runs. */
export const BIRCHPORT_BARRACKS_PANELS: readonly WorldChainlinkPanel[] = [
  ...sePanels(-195, WEST_SE_YS),
  ...swPanels(87, NORTH_SW_XS),
  ...sePanels(-179, EAST_SE_YS),
  ...swPanels(121, SOUTH_SW_XS),
];

/** NW SESW at the west/north join, SE SWSE at the east/south join. */
export const BIRCHPORT_BARRACKS_CORNERS: readonly WorldChainlinkCorner[] = [
  { x: -195, y: 87, corner: "SESW" },
  { x: -179, y: 121, corner: "SWSE" },
];

const panelByOrigin = new Map<string, WorldChainlinkPanel>();
const cornerByOrigin = new Map<string, WorldChainlinkCorner>();
const occupyTiles = new Set<string>();

for (const panel of BIRCHPORT_BARRACKS_PANELS) {
  panelByOrigin.set(`${panel.x},${panel.y}`, panel);
  for (const t of structureOccupiedTiles(panel)) {
    occupyTiles.add(`${t.x},${t.y}`);
  }
}
for (const corner of BIRCHPORT_BARRACKS_CORNERS) {
  const key = `${corner.x},${corner.y}`;
  cornerByOrigin.set(key, corner);
  occupyTiles.add(key);
}

function tileKey(tx: number, ty: number): string {
  return `${tx},${ty}`;
}

/** True when a worldgen chain-link panel or corner occupies this overworld tile. */
export function worldChainlinkOccupiesTile(tx: number, ty: number): boolean {
  return occupyTiles.has(tileKey(tx, ty));
}

export function getWorldChainlinkPanelOrigin(
  x: number,
  y: number,
): WorldChainlinkPanel | undefined {
  return panelByOrigin.get(tileKey(x, y));
}

export function getWorldChainlinkCornerAt(
  x: number,
  y: number,
): WorldChainlinkCorner | undefined {
  return cornerByOrigin.get(tileKey(x, y));
}

/** True when the tile sits on the barracks walls or inside the yard. */
export function isInBirchportBarracks(tx: number, ty: number): boolean {
  const { minX, maxX, minY, maxY } = BIRCHPORT_BARRACKS_BOUNDS;
  return tx >= minX && tx <= maxX && ty >= minY && ty <= maxY;
}

/** True when worldgen would place a building on the barracks walls or yard. */
export function birchportBarracksBlocksBuildingPlacement(
  tx: number,
  ty: number,
): boolean {
  return isInBirchportBarracks(tx, ty);
}

/** True when a footprint overlaps the barracks walls or yard. */
export function birchportBarracksOverlapsFootprint(
  ox: number,
  oy: number,
  w: number,
  h: number,
): boolean {
  const { minX, maxX, minY, maxY } = BIRCHPORT_BARRACKS_BOUNDS;
  return ox <= maxX && ox + w - 1 >= minX && oy <= maxY && oy + h - 1 >= minY;
}

/** Every tile in the barracks AABB, for worldgen's blocked-tile set. */
export function birchportBarracksPlacementTileKeys(): string[] {
  const { minX, maxX, minY, maxY } = BIRCHPORT_BARRACKS_BOUNDS;
  const keys: string[] = [];
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      keys.push(tileKey(x, y));
    }
  }
  return keys;
}

/**
 * Player-built fence / bargate / corner that was the source of this landmark.
 * Used once on boot to delete the temporary copies from the structures table.
 */
export function isBirchportBarracksPlayerStructure(rec: {
  inInterior: boolean;
  x: number;
  y: number;
  kind: string;
}): boolean {
  if (rec.inInterior) return false;
  if (
    rec.kind !== "fence" &&
    rec.kind !== "bargate" &&
    rec.kind !== "fence_corner"
  ) {
    return false;
  }
  return (
    panelByOrigin.has(tileKey(rec.x, rec.y)) ||
    cornerByOrigin.has(tileKey(rec.x, rec.y))
  );
}

/**
 * 6×4 wall tents, door on the short SE gable (same facing as the bargate).
 * Two west-fence stacks: a pair inset 1 tile from the north fence and a
 * pair inset 1 tile from the south fence. The 8×7 mess hall sits in the
 * yard gap between them, flush to the west fence, 7-tile SE face toward
 * the bargate, and a 2-tile gravel strip north and south of the hall.
 */
export type BarracksTentFootprint = {
  ox: number;
  oy: number;
  w: number;
  h: number;
  entranceX: number;
  entranceY: number;
  entranceSpan: number;
};

export type BarracksMessHallFootprint = BarracksTentFootprint;

const TENT_W = 6;
const TENT_H = 4;
const TENT_GAP = 2;
const TENT_ORIGIN_X = -194;
const NORTH_BLOCK_Y = 89;
const MESS_W = 8;
const MESS_H = 7;
const MESS_TENT_GAP = 2;
const TENT_BLOCK_H = TENT_H + TENT_GAP + TENT_H;
const NORTH_BLOCK_END = NORTH_BLOCK_Y + TENT_BLOCK_H - 1;
const GAP_Y0 = NORTH_BLOCK_END + 1;
const MESS_OX = TENT_ORIGIN_X;
const MESS_OY = GAP_Y0 + MESS_TENT_GAP;
const SOUTH_BLOCK_Y = MESS_OY + MESS_H + MESS_TENT_GAP;

function barracksTentAt(ox: number, oy: number): BarracksTentFootprint {
  return {
    ox,
    oy,
    w: TENT_W,
    h: TENT_H,
    entranceX: ox + TENT_W - 1,
    // 2-tile SE flap, centred on the 4-tile gable (oy+1 and oy+2).
    entranceY: oy + Math.floor((TENT_H - 2) / 2),
    entranceSpan: 2,
  };
}

function barracksTentColumn(
  originX: number,
  originY: number,
): BarracksTentFootprint[] {
  return [
    barracksTentAt(originX, originY),
    barracksTentAt(originX, originY + TENT_H + TENT_GAP),
  ];
}

/**
 * 8×7 prefab mess hall in the yard between the north and south tent
 * clusters, flush to the west fence. The 7-tile SE face and one-tile
 * door point at the bargate aisle.
 */
export const BIRCHPORT_BARRACKS_MESS_HALL: BarracksMessHallFootprint = {
  ox: MESS_OX,
  oy: MESS_OY,
  w: MESS_W,
  h: MESS_H,
  entranceX: MESS_OX + MESS_W - 1,
  entranceY: MESS_OY + Math.floor((MESS_H - 1) / 2),
  entranceSpan: 1,
};

/** The powered Birchport barracks hall only. Other mess_hall buildings stay dark. */
export function isBirchportBarracksMessHall(bx: number, by: number): boolean {
  const mess = BIRCHPORT_BARRACKS_MESS_HALL;
  return (
    bx >= mess.ox &&
    bx < mess.ox + mess.w &&
    by >= mess.oy &&
    by < mess.oy + mess.h
  );
}

/** West-fence pair north of the mess hall, and the matching pair south of it. */
export const BIRCHPORT_BARRACKS_TENTS: readonly BarracksTentFootprint[] = [
  ...barracksTentColumn(TENT_ORIGIN_X, NORTH_BLOCK_Y),
  ...barracksTentColumn(TENT_ORIGIN_X, SOUTH_BLOCK_Y),
];

function appendRun(
  out: { x: number; y: number }[],
  ax: number,
  ay: number,
  bx: number,
  by: number,
  step = 3,
): void {
  const dx = bx - ax;
  const dy = by - ay;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.25) return;
  const n = Math.max(1, Math.ceil(dist / step));
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const p = { x: ax + dx * t, y: ay + dy * t };
    const last = out[out.length - 1];
    if (!last || Math.hypot(last.x - p.x, last.y - p.y) > 0.35) {
      out.push(p);
    }
  }
}

function barracksBuildingOccupiesTile(tx: number, ty: number): boolean {
  const mess = BIRCHPORT_BARRACKS_MESS_HALL;
  if (
    tx >= mess.ox &&
    tx < mess.ox + mess.w &&
    ty >= mess.oy &&
    ty < mess.oy + mess.h
  ) {
    return true;
  }
  for (const tent of BIRCHPORT_BARRACKS_TENTS) {
    if (
      tx >= tent.ox &&
      tx < tent.ox + tent.w &&
      ty >= tent.oy &&
      ty < tent.oy + tent.h
    ) {
      return true;
    }
  }
  return false;
}

/** Gravel tile inside the yard that is not fence, tent, or mess hall. */
export function isBirchportBarracksYardWalkable(tx: number, ty: number): boolean {
  if (!isInBirchportBarracks(tx, ty)) return false;
  if (worldChainlinkOccupiesTile(tx, ty)) return false;
  if (barracksBuildingOccupiesTile(tx, ty)) return false;
  return true;
}

/**
 * Inside-fence patrol on walkable gravel: east aisle (bargate fence),
 * full south inset, east face of the west tent stacks, east-face detour
 * around the mess hall (the 8-wide hall sticks out past the tents),
 * full north inset. Shuttle A→B→A along this polyline.
 */
export function birchportBarracksYardPerimeterWaypoints(): {
  x: number;
  y: number;
}[] {
  const { minX, maxX, minY, maxY } = BIRCHPORT_BARRACKS_BOUNDS;
  // Tile centres just inside the chain-link (fence occupies min/max).
  const xE = maxX - 0.5;
  const xW = minX + 1.5;
  const xTentE = TENT_ORIGIN_X + TENT_W + 0.5;
  // Just east of the mess hall. The hall is 8 wide and sticks past the tents.
  const xMessE = MESS_OX + MESS_W + 0.5;
  const yN = minY + 1.5;
  const yS = maxY - 0.5;
  const yMessN = MESS_OY - 0.5;
  const yMessS = MESS_OY + MESS_H + 0.5;

  const out: { x: number; y: number }[] = [{ x: xE, y: yN }];
  appendRun(out, xE, yN, xE, yS);
  appendRun(out, xE, yS, xW, yS);
  appendRun(out, xW, yS, xTentE, yS);
  appendRun(out, xTentE, yS, xTentE, yMessS);
  appendRun(out, xTentE, yMessS, xMessE, yMessS);
  appendRun(out, xMessE, yMessS, xMessE, yMessN);
  appendRun(out, xMessE, yMessN, xTentE, yMessN);
  appendRun(out, xTentE, yMessN, xTentE, yN);
  appendRun(out, xTentE, yN, xW, yN);
  appendRun(out, xW, yN, xE, yN);
  return out;
}
