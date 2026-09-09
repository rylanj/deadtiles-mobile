/** Player-built chain-link / barbed-wire fence facing (3-tile panel). */
export type StructureFenceFacing = "SE" | "SW";

/** SWSE = SW left + SE right (camera-near gap). SESW = SE left + SW right (camera-far gap). */
export type StructureFenceCorner = "SWSE" | "SESW";

export function isStructureFenceFacing(
  value: unknown,
): value is StructureFenceFacing {
  return value === "SE" || value === "SW";
}

export function isStructureFenceCorner(
  value: unknown,
): value is StructureFenceCorner {
  return value === "SWSE" || value === "SESW";
}

/** Missing or invalid facing defaults to SE (run along +Y, 1×3). */
export function parseStructureFenceFacing(
  value: unknown,
): StructureFenceFacing {
  return value === "SW" ? "SW" : "SE";
}

/** Missing or invalid corner defaults to SWSE (SW left, SE right). */
export function parseStructureFenceCorner(
  value: unknown,
): StructureFenceCorner {
  return value === "SESW" ? "SESW" : "SWSE";
}

export function nextStructureFenceFacing(
  facing: StructureFenceFacing,
): StructureFenceFacing {
  return facing === "SE" ? "SW" : "SE";
}

/**
 * SE runs along +Y (`w=1,h=3`). SW runs along +X (`w=3,h=1`).
 */
export function structureFenceFootprint(facing: StructureFenceFacing): {
  w: number;
  h: number;
} {
  return facing === "SE" ? { w: 1, h: 3 } : { w: 3, h: 1 };
}

export function structureFenceTiles(
  ox: number,
  oy: number,
  facing: StructureFenceFacing,
): { x: number; y: number }[] {
  const { w, h } = structureFenceFootprint(facing);
  const tiles: { x: number; y: number }[] = [];
  for (let dx = 0; dx < w; dx++) {
    for (let dy = 0; dy < h; dy++) {
      tiles.push({ x: ox + dx, y: oy + dy });
    }
  }
  return tiles;
}

/** 3×1 panels: chain-link / barbed-wire and bargate. */
export function isStructurePanelKind(kind: string): boolean {
  return kind === "fence" || kind === "bargate";
}

/** Origin plus extra footprint tiles. Non-panel kinds occupy only the origin. */
export function structureOccupiedTiles(rec: {
  kind: string;
  x: number;
  y: number;
  facing?: string | null;
}): { x: number; y: number }[] {
  if (isStructurePanelKind(rec.kind)) {
    return structureFenceTiles(
      rec.x,
      rec.y,
      parseStructureFenceFacing(rec.facing),
    );
  }
  return [{ x: rec.x, y: rec.y }];
}

export type StructureFencePanel = {
  x: number;
  y: number;
  facing?: string | null;
};

/**
 * SWSE corner tile: the SW panel's +X (east) end sits west of the tile
 * (screen left), and the SE panel's +Y (south) end sits north of the tile
 * (screen right).
 */
export function isStructureFenceSwseCornerTile(
  cx: number,
  cy: number,
  panels: readonly StructureFencePanel[],
): boolean {
  let hasSwEast = false;
  let hasSeSouth = false;
  for (const p of panels) {
    const facing = parseStructureFenceFacing(p.facing);
    const { w, h } = structureFenceFootprint(facing);
    if (facing === "SW" && p.x + w - 1 === cx - 1 && p.y === cy) {
      hasSwEast = true;
    }
    if (facing === "SE" && p.x === cx && p.y + h - 1 === cy - 1) {
      hasSeSouth = true;
    }
  }
  return hasSwEast && hasSeSouth;
}

/**
 * SESW corner tile: the SE panel's origin (north / min-Y end) sits south of
 * the tile (screen left), and the SW panel's origin (west / min-X end) sits
 * east of the tile (screen right). That L does not overlap the 3-tile runs:
 *
 *   C  SW SW SW
 *   SE
 *   SE
 *   SE
 */
export function isStructureFenceSeswCornerTile(
  cx: number,
  cy: number,
  panels: readonly StructureFencePanel[],
): boolean {
  let hasSeNorth = false;
  let hasSwWest = false;
  for (const p of panels) {
    const facing = parseStructureFenceFacing(p.facing);
    if (facing === "SE" && p.x === cx && p.y === cy + 1) {
      hasSeNorth = true;
    }
    if (facing === "SW" && p.x === cx + 1 && p.y === cy) {
      hasSwWest = true;
    }
  }
  return hasSeNorth && hasSwWest;
}

export function structureFenceCornerAt(
  cx: number,
  cy: number,
  panels: readonly StructureFencePanel[],
): StructureFenceCorner | null {
  if (isStructureFenceSwseCornerTile(cx, cy, panels)) return "SWSE";
  if (isStructureFenceSeswCornerTile(cx, cy, panels)) return "SESW";
  return null;
}

/** True when this panel is one of the two neighbours that form `corner` at (cx, cy). */
export function structureFenceCornerNeighborMatches(
  cx: number,
  cy: number,
  corner: StructureFenceCorner,
  panel: StructureFencePanel,
): boolean {
  const facing = parseStructureFenceFacing(panel.facing);
  const { w, h } = structureFenceFootprint(facing);
  if (corner === "SWSE") {
    return (
      (facing === "SW" && panel.x + w - 1 === cx - 1 && panel.y === cy) ||
      (facing === "SE" && panel.x === cx && panel.y + h - 1 === cy - 1)
    );
  }
  return (
    (facing === "SE" && panel.x === cx && panel.y === cy + 1) ||
    (facing === "SW" && panel.x === cx + 1 && panel.y === cy)
  );
}

export function parseStructureRecordFacing(
  kind: string,
  facing: unknown,
): StructureFenceFacing | StructureFenceCorner {
  if (kind === "fence_corner") return parseStructureFenceCorner(facing);
  return parseStructureFenceFacing(facing);
}

/**
 * Gap tiles this panel could form an SE/SW join into.
 * The join is only valid when the matching neighbour panel is also present.
 */
export function structureFenceCornerCandidates(
  ox: number,
  oy: number,
  facing: StructureFenceFacing,
): { x: number; y: number; corner: StructureFenceCorner }[] {
  const { w, h } = structureFenceFootprint(facing);
  if (facing === "SW") {
    return [
      { x: ox + w, y: oy, corner: "SWSE" },
      { x: ox - 1, y: oy, corner: "SESW" },
    ];
  }
  return [
    { x: ox, y: oy + h, corner: "SWSE" },
    { x: ox, y: oy - 1, corner: "SESW" },
  ];
}

export function isFenceCornerStructureKind(kind: string): boolean {
  return kind === "fence_corner";
}
