/**
 * Painter-order (Phaser depth) math for the isometric world.
 *
 * Kept free of Phaser imports so the render-order checker scripts can exercise
 * these functions directly instead of re-modelling them
 * (scripts/check-entity-wall-order.mts, scripts/check-wall-building-order.mts).
 */
import {
  buildingCuboidScreenDepth,
  type BuildingInfo,
  ENTITY_RENDER_HEIGHT,
  getBuildingsNearTile,
  isInFrontOfBuilding,
  isWestOrNorthWallOutlineRange,
  structureFenceFootprint,
  TILE_HEIGHT,
  TILE_WIDTH,
  WALL_DEPTH,
  type StructureFenceFacing,
} from "@zombie/shared";

/**
 * Ground draws in a low band; walls use floored tile (x+y); living entities use
 * continuous world x+y so diagonal approaches sort correctly in front/back.
 */
export const OBJECT_DEPTH_BAND = 1_000_000;

/**
 * Depth of the ground container itself.
 *
 * Ground tiles live inside one container, so the scene compares that
 * container's single depth against every object's depth. Object depths are
 * `OBJECT_DEPTH_BAND + isoSortKey`, and the iso key goes negative west/north of
 * the world origin: at `x + y < -976` a cuboid's depth drops below zero. With
 * the container parked at 0, grass and streets then painted straight over the
 * buildings, so a city out there rendered 3D until the tile wave caught up and
 * buried everything except the footprint the building sat on (no ground tile is
 * drawn under a building, so only that part survived).
 *
 * Ground is always beneath the world, so park it below anything an iso key can
 * produce instead of at a coordinate-dependent boundary.
 */
export const GROUND_LAYER_DEPTH = -1e12;

/** Below entities/buildings, above ground tiles and streets. */
const TILE_INDICATOR_BAND = 800_000;

/**
 * Iso painter key: higher draws in front.
 * Primary: x+y (SE toward camera). Secondary: y so same-diagonal tiles
 * (e.g. (4,2) vs (2,4)) put the more-southern tile in front — needed for
 * tall interior partitions that overlap on screen across equal x+y.
 * Gap of 1024 leaves room for per-object offsets (furniture +4, entity +5, …).
 */
export function groundSortDepth(tileX: number, tileY: number) {
  return (tileX + tileY) * 1024 + tileY;
}

/** Move / search tile outlines — below entity sprites, above the ground layer. */
export function tileIndicatorDepth(tileX: number, tileY: number) {
  return TILE_INDICATOR_BAND + groundSortDepth(tileX, tileY);
}

function isoSortKey(tileX: number, tileY: number) {
  return groundSortDepth(tileX, tileY);
}

/** Interior floor — always below entities/furniture (two-pass render like overworld ground). */
export function interiorFloorDepth(tileX: number, tileY: number) {
  return groundSortDepth(tileX, tileY);
}

/** Interior furniture — below living entities when iso sort keys tie. */
const FURNITURE_TILE_OFFSET = 4;

/** Interior furniture — same band as entities, under living sprites on depth ties. */
export function interiorFurnitureDepth(worldX: number, worldY: number) {
  return (
    OBJECT_DEPTH_BAND +
    isoSortKey(Math.floor(worldX), Math.floor(worldY)) +
    FURNITURE_TILE_OFFSET
  );
}

/**
 * Long beds use the SE footprint tile for depth. A prop beside the bed on the
 * same x+y diagonal (IV stand, motel MiniFridge1) then loses the secondary +y
 * tie-break and the bed sprite paints over it. Pull beds back by 2 so
 * same-diagonal props stay in front, while still leaving room under the
 * entity offset (+5) and keeping truly-behind props (~1024 behind) under the bed.
 */
const LONG_BED_DEPTH_BIAS = -2;

export function interiorFurnitureDepthBias(objectType: string): number {
  if (
    objectType === "hospitalbed" ||
    objectType === "hospitalbed2" ||
    objectType === "hospitalbed3" ||
    objectType === "motelbed" ||
    objectType === "militarybed" ||
    objectType === "jailbed"
  ) {
    return LONG_BED_DEPTH_BIAS;
  }
  // CanteenTable SE is 1×2. Depth uses the SW footprint tile, which shares
  // an x+y diagonal with a chair on the SE side (table (7,2) vs chair (8,1)).
  // The +y tie-break then paints the table over the chair. Pull the table
  // back the same way long beds do.
  if (
    objectType === "canteentable1" ||
    objectType === "canteentable2" ||
    objectType === "canteentable3" ||
    objectType === "canteentable4" ||
    objectType === "sofa"
  ) {
    return LONG_BED_DEPTH_BIAS;
  }
  return 0;
}

/** Partition segment depth — optional corner bias from shared wall helper. */
export function interiorPartitionDepth(
  tileX: number,
  tileY: number,
  depthBias = 0,
) {
  return interiorFurnitureDepth(tileX, tileY) + depthBias;
}

/**
 * SW paints over SE at a shared corner (same bias as wooden worldgen fences).
 * Kept to 0–3 so an unlifted overworld panel still counts as a plain
 * partition in {@link isBuildingAdjustedPartition}.
 */
const CHAINLINK_FACING_DEPTH_BIAS: Record<StructureFenceFacing, number> = {
  SE: 2,
  SW: 3,
};

/**
 * Panels are one sprite over 3 tiles, so an entity steps a whole sub-unit
 * clear of the mesh rather than the hair's breadth flat walls use.
 */
const CHAINLINK_ENTITY_STEP = 0.01;

/**
 * 3-tile panels are keyed at their origin, not the camera-near join. Pull the
 * 1×1 corner behind both origins and the SW facing bias so the post never
 * paints over the mesh.
 */
const CHAINLINK_CORNER_BEHIND_PANELS = 3 * 1024 + 4;

/**
 * Depth for a player-built chain-link panel.
 *
 * Keyed at the origin tile, not the SE occupied tile: one sprite covers a
 * 3-tile run, so an SE key makes a player standing east (screen bottom-right)
 * of the north post sort behind the whole mesh. Origin plus a partition
 * footprint lets that player stay in front while west/north of the south
 * end still clamps behind it.
 */
export function chainLinkFenceSortDepth(
  ox: number,
  oy: number,
  facing: StructureFenceFacing,
  overworld = false,
): number {
  const base =
    interiorPartitionDepth(ox, oy) + CHAINLINK_FACING_DEPTH_BIAS[facing];
  return overworld ? applyBuildingFenceDepth(base, ox, oy, facing) : base;
}

/** Partition footprint matching {@link chainLinkFenceSortDepth}. */
export function chainLinkFenceDepthFootprint(
  ox: number,
  oy: number,
  facing: StructureFenceFacing,
  overworld = false,
): FurnitureDepthFootprint {
  const { w, h } = structureFenceFootprint(facing);
  return {
    ox,
    oy,
    w,
    h,
    partition: true,
    axis: facing === "SE" ? "ns" : "ew",
    depth: chainLinkFenceSortDepth(ox, oy, facing, overworld),
    entityStep: CHAINLINK_ENTITY_STEP,
  };
}

/** SWSE corner post — always behind both joining SW and SE panels. */
export function chainLinkFenceCornerSortDepth(
  ox: number,
  oy: number,
  overworld = false,
): number {
  const base = interiorPartitionDepth(ox, oy) - CHAINLINK_CORNER_BEHIND_PANELS;
  return overworld ? applyBuildingFenceDepth(base, ox, oy) : base;
}

export function chainLinkFenceCornerDepthFootprint(
  ox: number,
  oy: number,
  overworld = false,
): FurnitureDepthFootprint {
  return {
    ox,
    oy,
    w: 1,
    h: 1,
    partition: true,
    depth: chainLinkFenceCornerSortDepth(ox, oy, overworld),
    entityStep: CHAINLINK_ENTITY_STEP,
  };
}

/** Building walls — slightly above entities when depth keys tie. */
export function wallRenderDepth(tileX: number, tileY: number) {
  return OBJECT_DEPTH_BAND + isoSortKey(tileX, tileY) + 6;
}

/**
 * Sub-unit band a wall takes when it stands in front of a building cuboid:
 * above the cuboid (integer depth) but below entities, which lift into the
 * +1..+1.5 band so players walking the street still pass in front of walls
 * they are south/east of, while behind-clamps keep them under walls they are
 * north/west of.
 */
const PARTITION_BUILDING_LIFT_BASE = 0.25;
const PARTITION_BUILDING_LIFT_SPAN = 0.5;
/** Sub-unit band a wall takes when it is pushed behind a cuboid. */
const PARTITION_BUILDING_SINK_SPAN = 0.5;

/**
 * Entity / tree / fence front band — sits above wall lifts (0.25..0.75).
 * Span preserves relative iso order so a screen-north tree is not pinned to
 * the same depth as a screen-south neighbour (flat +1 inverted Y-order near
 * large lots like Birchport hospital).
 */
const ENTITY_BUILDING_LIFT_BASE = 1.0;
const ENTITY_BUILDING_LIFT_SPAN = 0.5;
const ENTITY_BUILDING_SINK_SPAN = 0.5;

/**
 * How far to look for a cuboid a wall may have to sort against.
 *
 * A tall block covers tiles far up-screen from its footprint (a 4-storey roof
 * reaches ~26 rows), so this only bounds the candidate list — which of those
 * buildings actually constrain the wall is decided by screen overlap below.
 */
const PARTITION_BUILDING_SEARCH_REACH = 40;

/**
 * Where `natural` sits within the depth range of every tile that can reach
 * `bld`, as 0..1. Pinning a wall to a building has to keep the run's own
 * far-to-near order: collinear tiles overlap at the join, so a flat pin lets an
 * arbitrary tile paint its side cap over its neighbour's front face, and an
 * entity between two tiles pinned to the same value cannot sort against both.
 *
 * Normalising over the reachable tiles rather than the absolute depth scale
 * leaves neighbouring segments far enough apart for an entity to slot between
 * them (see PARTITION_ENTITY_STEP).
 */
function buildingRangeRatio(
  bld: { ox: number; oy: number; w: number; h: number },
  natural: number,
): number {
  const reach = PARTITION_BUILDING_SEARCH_REACH;
  const low = interiorPartitionDepth(bld.ox - reach, bld.oy - reach);
  const high = interiorPartitionDepth(
    bld.ox + bld.w + reach,
    bld.oy + bld.h + reach,
  );
  return Math.min(1, Math.max(0, (natural - low) / (high - low)));
}

/** Depth for a wall lifted in front of `buildingDepth` (above the cuboid). */
function buildingFrontPartitionDepth(
  bld: { ox: number; oy: number; w: number; h: number },
  buildingDepth: number,
  natural: number,
): number {
  return (
    buildingDepth +
    PARTITION_BUILDING_LIFT_BASE +
    PARTITION_BUILDING_LIFT_SPAN * buildingRangeRatio(bld, natural)
  );
}

/** Depth for a wall pushed behind `buildingDepth` (under the cuboid). */
function buildingBehindPartitionDepth(
  bld: { ox: number; oy: number; w: number; h: number },
  buildingDepth: number,
  natural: number,
): number {
  return (
    buildingDepth -
    1 +
    PARTITION_BUILDING_SINK_SPAN * buildingRangeRatio(bld, natural)
  );
}

/**
 * Where `natural` (entity/tree iso depth) sits in the building's reachable
 * depth range — same idea as {@link buildingRangeRatio} for walls.
 */
function buildingEntityRangeRatio(
  bld: { ox: number; oy: number; w: number; h: number },
  natural: number,
): number {
  const reach = PARTITION_BUILDING_SEARCH_REACH;
  const low = entityRenderDepth(bld.ox - reach, bld.oy - reach);
  const high = entityRenderDepth(
    bld.ox + bld.w + reach,
    bld.oy + bld.h + reach,
  );
  return Math.min(1, Math.max(0, (natural - low) / (high - low)));
}

/** Depth for an entity/tree lifted in front of `buildingDepth`. */
function buildingFrontEntityDepth(
  bld: { ox: number; oy: number; w: number; h: number },
  buildingDepth: number,
  natural: number,
): number {
  return (
    buildingDepth +
    ENTITY_BUILDING_LIFT_BASE +
    ENTITY_BUILDING_LIFT_SPAN * buildingEntityRangeRatio(bld, natural)
  );
}

/** Depth for an entity/tree pushed behind `buildingDepth`. */
function buildingBehindEntityDepth(
  bld: { ox: number; oy: number; w: number; h: number },
  buildingDepth: number,
  natural: number,
): number {
  return (
    buildingDepth -
    1 +
    ENTITY_BUILDING_SINK_SPAN * buildingEntityRangeRatio(bld, natural)
  );
}

type Box = { minX: number; maxX: number; minY: number; maxY: number };

/**
 * Screen box of a wall tile's segment, roughly — one tile diamond raised by the
 * partition height.
 */
function partitionScreenBox(tileX: number, tileY: number): Box {
  return {
    minX: (tileX - tileY - 1) * HALF_TILE_W,
    maxX: (tileX - tileY + 1) * HALF_TILE_W,
    minY: (tileX + tileY) * HALF_TILE_H - PARTITION_SCREEN_HEIGHT,
    maxY: (tileX + tileY + 2) * HALF_TILE_H,
  };
}

/**
 * Whether the cuboid's front pin reaches this tile.
 *
 * Core: south-east quadrant of the two street-facing corners — downstream-closed
 * for collinear runs.
 *
 * Extra: west of `ox` on/beyond the south face (SW street apron), up to 4 tiles
 * west. Those tiles face the SW wall but fail `tileX >= ox`; without a pin they
 * keep a natural depth under the cuboid and behind-clamp the player under the
 * house. Unbounded south so a pinned tile's southern neighbour stays pinned.
 */
function buildingPinsTile(
  tileX: number,
  tileY: number,
  bld: { ox: number; oy: number; w: number; h: number },
): boolean {
  if (tileX >= bld.ox && tileY >= bld.oy + bld.h) return true;
  if (tileX >= bld.ox + bld.w && tileY >= bld.oy) return true;
  if (tileY < bld.oy + bld.h) return false;
  const westOf = bld.ox - tileX;
  return westOf > 0 && westOf <= 4;
}

/**
 * Whether a building's cuboid can cover this tile on screen — roof extras
 * included, since a gable or parapet reaches several rows further up than the
 * wall storeys do. Gates the behind clamp, which has to reach as far as the
 * roof does and no further.
 */
function buildingCoversBoxOnScreen(box: Box, bld: BuildingInfo): boolean {
  const x0 = bld.ox;
  const x1 = bld.ox + bld.w;
  const y0 = bld.oy;
  const y1 = bld.oy + bld.h;

  // Footprint diamond on screen. The cuboid silhouette is this diamond swept up
  // by its height, so at a given screen x it spans from the upper edge minus the
  // height down to the lower edge. A plain bounding box would instead claim the
  // empty corners, which reach far along the NW/NE diagonals.
  const westX = (x0 - y1) * HALF_TILE_W;
  const northX = (x0 - y0) * HALF_TILE_W;
  const southX = (x1 - y1) * HALF_TILE_W;
  const eastX = (x1 - y0) * HALF_TILE_W;
  const westY = (x0 + y1) * HALF_TILE_H;
  const northY = (x0 + y0) * HALF_TILE_H;
  const southY = (x1 + y1) * HALF_TILE_H;
  const eastY = (x1 + y0) * HALF_TILE_H;

  const lo = Math.max(box.minX, westX);
  const hi = Math.min(box.maxX, eastX);
  if (lo >= hi) return false; // Touching at a corner column is not coverage.

  const at = (
    ax: number,
    ay: number,
    bx: number,
    by: number,
    sx: number,
  ) => ay + ((by - ay) * (sx - ax)) / (bx - ax);
  const upper = (sx: number) =>
    sx <= northX
      ? at(westX, westY, northX, northY, sx)
      : at(northX, northY, eastX, eastY, sx);
  const lower = (sx: number) =>
    sx <= southX
      ? at(westX, westY, southX, southY, sx)
      : at(southX, southY, eastX, eastY, sx);

  const xs = [lo, hi];
  if (northX > lo && northX < hi) xs.push(northX);
  if (southX > lo && southX < hi) xs.push(southX);

  let top = Number.POSITIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;
  for (const sx of xs) {
    top = Math.min(top, upper(sx));
    bottom = Math.max(bottom, lower(sx));
  }
  return (
    top - buildingCuboidScreenDepth(bld) < box.maxY && bottom > box.minY
  );
}

function buildingCoversTileOnScreen(
  tileX: number,
  tileY: number,
  bld: BuildingInfo,
): boolean {
  return buildingCoversBoxOnScreen(partitionScreenBox(tileX, tileY), bld);
}

/**
 * How far an occlusion search has to look for cuboids that can paint over a
 * tile. A cuboid is drawn from its footprint upward, and one tile north or
 * west is only {@link HALF_TILE_H} up-screen, so the tallest exterior (4
 * storeys plus roof extras) reaches ~27 tile rows. Candidates are then culled
 * by {@link buildingCuboidCoversSprite} / {@link buildingCuboidCoversTile},
 * which is pure arithmetic, so the wide search stays cheap.
 */
export const BUILDING_OCCLUSION_SEARCH_REACH = Math.ceil(
  (WALL_DEPTH * 4 + 40) / (TILE_HEIGHT / 2),
);

/** Screen box of a sprite standing on a tile. Generous: the mask clips it. */
function spriteScreenBox(tileX: number, tileY: number): Box {
  return {
    minX: (tileX - tileY - 1) * HALF_TILE_W,
    maxX: (tileX - tileY + 1) * HALF_TILE_W,
    minY: (tileX + tileY + 1) * HALF_TILE_H - SPRITE_TOP,
    maxY: (tileX + tileY + 2) * HALF_TILE_H,
  };
}

/** Screen box of a ground tile diamond (move / search indicators). */
function groundTileScreenBox(tileX: number, tileY: number): Box {
  return {
    minX: (tileX - tileY - 1) * HALF_TILE_W,
    maxX: (tileX - tileY + 1) * HALF_TILE_W,
    minY: (tileX + tileY) * HALF_TILE_H,
    maxY: (tileX + tileY + 2) * HALF_TILE_H,
  };
}

/** Can this cuboid paint over a sprite standing on (tileX, tileY)? */
export function buildingCuboidCoversSprite(
  tileX: number,
  tileY: number,
  bld: BuildingInfo,
): boolean {
  return buildingCoversBoxOnScreen(spriteScreenBox(tileX, tileY), bld);
}

/** Can this cuboid paint over the ground diamond of (tileX, tileY)? */
export function buildingCuboidCoversTile(
  tileX: number,
  tileY: number,
  bld: BuildingInfo,
): boolean {
  return buildingCoversBoxOnScreen(groundTileScreenBox(tileX, tileY), bld);
}

/**
 * Screen-space AABB of a building's whole cuboid, in camera world pixels.
 *
 * The footprint diamond swept up by the cuboid height, then bounded. Unlike
 * {@link buildingCuboidCoversTile} this deliberately keeps the empty NW/NE
 * corners of that box: the caller uses it to decide whether a building is worth
 * a full-resolution bake, so over-claiming spends VRAM on something marginal
 * rather than stripping detail from something the player can see.
 */
export function buildingCuboidScreenBox(bld: BuildingInfo): Box {
  return {
    minX: (bld.ox - (bld.oy + bld.h)) * HALF_TILE_W,
    maxX: (bld.ox + bld.w - bld.oy) * HALF_TILE_W,
    minY: (bld.ox + bld.oy) * HALF_TILE_H - buildingCuboidScreenDepth(bld),
    maxY: (bld.ox + bld.w + bld.oy + bld.h) * HALF_TILE_H,
  };
}

/**
 * Overworld wall depth vs building cuboids.
 *
 * A building is one graphics object keyed off its SE corner tip, so a large
 * footprint out-ranks walls standing along its SW (south) or SE (east) flank
 * even though those walls are nearer the camera — the house paints over them.
 * Lift on those street-facing faces, clamp behind on the west/north ones, same
 * face rules entities use.
 */
export function overworldPartitionDepth(
  tileX: number,
  tileY: number,
  depthBias = 0,
): number {
  const natural = interiorPartitionDepth(tileX, tileY, depthBias);
  let result = natural;
  let frontFloor = Number.NEGATIVE_INFINITY;
  const nearby = getBuildingsNearTile(
    tileX,
    tileY,
    PARTITION_BUILDING_SEARCH_REACH,
  );

  for (const bld of nearby) {
    if (!buildingPinsTile(tileX, tileY, bld)) continue;
    // Resolving a cuboid's depth walks its neighbours, so skip the ones whose
    // pin cannot bite: the walk only ever pulls a building behind its own SE
    // corner key, which caps the pin.
    const cap =
      wallRenderDepth(bld.ox + bld.w - 1, bld.oy + bld.h - 1) +
      PARTITION_BUILDING_LIFT_BASE +
      PARTITION_BUILDING_LIFT_SPAN;
    if (cap <= result || cap <= frontFloor) continue;
    frontFloor = Math.max(
      frontFloor,
      buildingFrontPartitionDepth(bld, buildingWallDepth(bld), natural),
    );
  }
  if (frontFloor > Number.NEGATIVE_INFINITY) {
    result = Math.max(result, frontFloor);
  }

  // Cuboids the wall stands behind re-assert after the pin, so a pin taken from
  // one lot cannot paint the wall over the roof of the next one. Never sink a
  // tile that is iso-in-front of the cuboid — that is the street, not the yard.
  for (const bld of nearby) {
    if (buildingPinsTile(tileX, tileY, bld)) continue;
    if (isInFrontOfBuilding(tileX, tileY, bld)) continue;
    if (!buildingCoversTileOnScreen(tileX, tileY, bld)) continue;
    const buildingDepth = buildingWallDepth(bld);
    if (result >= buildingDepth) {
      result = Math.min(
        result,
        buildingBehindPartitionDepth(bld, buildingDepth, natural),
      );
    }
  }
  return result;
}

/**
 * True when footprint `front` should draw on top of footprint `behind` in
 * isometric order (south of behind, or east of behind with Y overlap).
 * Mirrors {@link isInFrontOfBuilding} for whole buildings.
 */
function buildingFootprintInFrontOf(
  front: { ox: number; oy: number; w: number; h: number },
  behind: { ox: number; oy: number; w: number; h: number },
): boolean {
  if (front.oy >= behind.oy + behind.h) return true;
  if (
    front.ox >= behind.ox + behind.w &&
    front.oy < behind.oy + behind.h &&
    front.oy + front.h > behind.oy
  ) {
    return true;
  }
  return false;
}

/**
 * Resolved cuboid depths, keyed by footprint origin.
 *
 * Buildings come from worldgen, so a given origin always has the same footprint
 * and the same neighbours: the answer can never change within a session. Only
 * whole (top-level) resolutions are cached — never the values seen mid-walk,
 * which depend on the entry point when the neighbour graph has a cycle.
 */
const buildingWallDepthCache = new Map<string, number>();
const BUILDING_WALL_DEPTH_CACHE_MAX = 20_000;

/**
 * Cuboid depth for a multi-tile building. Starts from the SE corner (frontmost
 * tip), then pulls behind any neighbour that is iso-in-front but has a lower
 * SE-corner key — otherwise a large warehouse can paint over a smaller house
 * on its east/south face.
 *
 * Resolving one building walks its neighbours (and theirs), so the result is
 * memoised: this runs per candidate building, per sprite, per frame.
 */
export function buildingWallDepth(bld: {
  ox: number;
  oy: number;
  w: number;
  h: number;
}): number {
  const key = `${bld.ox},${bld.oy}`;
  const cached = buildingWallDepthCache.get(key);
  if (cached !== undefined) return cached;
  const depth = resolveBuildingWallDepth(bld, new Set());
  if (buildingWallDepthCache.size >= BUILDING_WALL_DEPTH_CACHE_MAX) {
    buildingWallDepthCache.clear();
  }
  buildingWallDepthCache.set(key, depth);
  return depth;
}

function resolveBuildingWallDepth(
  bld: { ox: number; oy: number; w: number; h: number },
  visiting: Set<string>,
): number {
  const key = `${bld.ox},${bld.oy}`;
  const seDepth = wallRenderDepth(bld.ox + bld.w - 1, bld.oy + bld.h - 1);
  if (visiting.has(key)) return seDepth;
  visiting.add(key);

  let depth = seDepth;
  const cx = bld.ox + Math.floor(bld.w / 2);
  const cy = bld.oy + Math.floor(bld.h / 2);
  const reach = Math.max(bld.w, bld.h) + 4;

  for (const other of getBuildingsNearTile(cx, cy, reach)) {
    if (other.ox === bld.ox && other.oy === bld.oy) continue;
    if (!buildingFootprintInFrontOf(other, bld)) continue;
    const otherDepth = resolveBuildingWallDepth(other, visiting);
    if (depth >= otherDepth) depth = otherDepth - 1;
  }

  visiting.delete(key);
  return depth;
}

/** Living entities on a tile (+5). Corpses use +4 so they sort behind the living. */
const ENTITY_TILE_OFFSET = 5;
const CORPSE_TILE_OFFSET = 4;

/**
 * Players/zombies — continuous world x+y (matches screen-front order).
 * Floored tile sums mis-order SW/SE approaches: e.g. zombie at (9.9, 10.9)
 * floors behind a player at (10.1, 10.1) even though it has higher x+y.
 */
export function entityRenderDepth(worldX: number, worldY: number) {
  return OBJECT_DEPTH_BAND + isoSortKey(worldX, worldY) + ENTITY_TILE_OFFSET;
}

/** Dead zombie corpses — same depth band as entities, slightly lower per-tile offset. */
export function corpseRenderDepth(worldX: number, worldY: number) {
  return OBJECT_DEPTH_BAND + isoSortKey(worldX, worldY) + CORPSE_TILE_OFFSET;
}

/** Furniture footprint used when clamping interior entity depth. */
export type FurnitureDepthFootprint = {
  ox: number;
  oy: number;
  w: number;
  h: number;
  /**
   * When set, iso depth is sampled here instead of the SE footprint corner.
   */
  depthX?: number;
  depthY?: number;
  /**
   * Partition axis. N/S: east = in front, west = behind (same row).
   * E/W: south = in front, north = behind (same column).
   */
  axis?: "ns" | "ew";
  /** Corner join bias — shorter cubicle-front arm paints over the longer side. */
  depthBias?: number;
  /** Interior partitions — resolve after/before furniture in applyFurnitureEntityDepth. */
  partition?: boolean;
  /**
   * Depth this object actually renders at. Overworld walls are lifted in front
   * of building cuboids, so their iso key alone does not say where they sit in
   * the draw order; entities must resolve against the value that was used.
   */
  depth?: number;
  /**
   * Override for how far in front / behind this partition an entity steps.
   * Chain-link panels need a step above the local-player tie-break.
   */
  entityStep?: number;
};

/** How far from a footprint to look for furniture when adjusting entity depth. */
const ENTITY_FURNITURE_DEPTH_REACH = 2;
/** Slightly wider for tall partitions whose SE faces cover NW neighbour tiles. */
const PARTITION_DEPTH_REACH = 3;

/**
 * Step an entity takes above / below a partition it is in front of / behind.
 *
 * Only the sign matters, and it has to survive the compressed band an overworld
 * wall lands in when it is lifted in front of a building cuboid — whole units
 * would jump clean over the neighbouring segments of the same wall run.
 */
const PARTITION_ENTITY_STEP = 1e-6;

/**
 * Tie-break so the local player draws over other sprites sharing its depth.
 *
 * Applied after the clamps below, so it has to stay under
 * {@link PARTITION_ENTITY_STEP}: behind-a-wall clamps land exactly one step
 * under the wall, and a bigger bump lifted the local player back over every
 * wall it stood behind — most visible beside a building, where the lift/sink
 * bands compress walls and entities together so the clamp is what decides the
 * order (in the open field the natural iso gap is ~1024 and hides it).
 */
export const LOCAL_PLAYER_DEPTH_BIAS = PARTITION_ENTITY_STEP / 10;

function isInFrontOfFurniture(
  tx: number,
  ty: number,
  furn: FurnitureDepthFootprint,
): boolean {
  if (furn.partition && furn.axis === "ns") {
    // East of this N/S tile (same row).
    if (
      tx >= furn.ox + furn.w &&
      ty >= furn.oy &&
      ty < furn.oy + furn.h
    ) {
      return true;
    }
    // South of this tile in its column (toward camera) — not when west of it,
    // so walking SW along the west face does not lift over northern segments.
    return (
      ty >= furn.oy + furn.h &&
      tx >= furn.ox &&
      tx < furn.ox + furn.w + 1
    );
  }
  if (furn.partition && furn.axis === "ew") {
    // South of this E/W tile — SW face toward camera. Any column within
    // reach: a front-wall segment east of the player still covers corridor
    // tiles at exterior corners (strict same-column missed the SW diagonal
    // and else-clamped the entity under the neighbouring segment).
    if (ty >= furn.oy + furn.h) {
      return true;
    }
    // East of this tile on its row (toward camera) — not when north of it.
    return (
      tx >= furn.ox + furn.w &&
      ty >= furn.oy &&
      ty < furn.oy + furn.h + 1
    );
  }
  return (
    ty >= furn.oy + furn.h ||
    (tx >= furn.ox + furn.w && ty >= furn.oy && ty < furn.oy + furn.h)
  );
}

/**
 * West / north / NW of a furniture footprint (iso-behind), within reach.
 * Includes the NE diagonal column so tall props still occlude that neighbour.
 */
function isWestOrNorthOfFurniture(
  tx: number,
  ty: number,
  furn: FurnitureDepthFootprint,
  reach = ENTITY_FURNITURE_DEPTH_REACH,
): boolean {
  if (isInFrontOfFurniture(tx, ty, furn)) return false;

  if (furn.partition && furn.axis === "ns") {
    // West of this N/S tile, same row — not when already south of it.
    const westDist = furn.ox - tx;
    return (
      tx < furn.ox &&
      westDist <= reach &&
      ty >= furn.oy &&
      ty < furn.oy + furn.h
    );
  }
  if (furn.partition && furn.axis === "ew") {
    // North of this E/W tile. Multi-tile runs also take the NE neighbour of
    // the east post (screen top-right of an SW chain-link panel).
    const northDist = furn.oy - ty;
    const eastPad = furn.w > 1 ? 1 : 0;
    return (
      ty < furn.oy &&
      northDist <= reach &&
      tx >= furn.ox &&
      tx < furn.ox + furn.w + eastPad
    );
  }

  const westDist = furn.ox - tx;
  const northDist = furn.oy - ty;

  if (
    tx < furn.ox &&
    westDist <= reach &&
    ty >= furn.oy &&
    ty < furn.oy + furn.h + 2
  ) {
    return true;
  }

  // North strip + one column east (NE neighbour of a 1×1 prop).
  if (
    ty < furn.oy &&
    northDist <= reach &&
    tx >= furn.ox - 2 &&
    tx < furn.ox + furn.w + 1
  ) {
    return true;
  }

  if (
    tx < furn.ox &&
    ty < furn.oy &&
    westDist <= reach &&
    northDist <= reach
  ) {
    return true;
  }

  return false;
}

function partitionEntityStep(furn: FurnitureDepthFootprint): number {
  if (furn.entityStep !== undefined) return furn.entityStep;
  return furn.partition ? PARTITION_ENTITY_STEP : 1;
}

function isChainLinkRun(furn: FurnitureDepthFootprint): boolean {
  return !!furn.partition && !!furn.axis && (furn.w > 1 || furn.h > 1);
}

/** Inclusive AABB: overlap or edge/corner adjacent. */
function footprintsTouch(
  a: FurnitureDepthFootprint,
  b: FurnitureDepthFootprint,
): boolean {
  return !(
    a.ox + a.w < b.ox ||
    b.ox + b.w < a.ox ||
    a.oy + a.h < b.oy ||
    b.oy + b.h < a.oy
  );
}

/**
 * Inside └ of an SE+SW join: east of the SE run and north of a touching SW
 * run. Tile rules say "in front of SE", but the SE sprite's south end is the
 * corner post, so the player must sit under both panels.
 */
function chainLinkInsideCornerHidesNs(
  tx: number,
  ty: number,
  ns: FurnitureDepthFootprint,
  furniture: readonly FurnitureDepthFootprint[],
): boolean {
  if (!isChainLinkRun(ns) || ns.axis !== "ns") return false;
  if (!adjacentToFootprint(tx, ty, ns)) return false;
  for (const other of furniture) {
    if (!isChainLinkRun(other) || other.axis !== "ew") continue;
    if (!footprintsTouch(ns, other)) continue;
    if (!adjacentToFootprint(tx, ty, other)) continue;
    if (isWestOrNorthOfFurniture(tx, ty, other, PARTITION_DEPTH_REACH)) {
      return true;
    }
  }
  return false;
}

function adjacentToFootprint(
  tx: number,
  ty: number,
  f: FurnitureDepthFootprint,
): boolean {
  return (
    tx >= f.ox - 1 &&
    tx < f.ox + f.w + 1 &&
    ty >= f.oy - 1 &&
    ty < f.oy + f.h + 1
  );
}

const HALF_TILE_W = TILE_WIDTH / 2;
const HALF_TILE_H = TILE_HEIGHT / 2;
/** Matches InteriorView's PARTITION_HEIGHT. */
const PARTITION_SCREEN_HEIGHT = WALL_DEPTH * 0.65;
/** Entity sprite box around the feet, in screen pixels (body, not frame). */
const SPRITE_HALF_W = 28;
const SPRITE_TOP = ENTITY_RENDER_HEIGHT;
const SPRITE_FOOT_DROP = 6;

/**
 * Rough screen-pixel overlap between an entity standing on (tx, ty) and a
 * partition footprint. Used only to pick which of two contradicting depth
 * bounds to honour, so the one covering more of the sprite wins.
 */
function partitionSpriteOverlap(
  tx: number,
  ty: number,
  furn: FurnitureDepthFootprint,
): number {
  const wallMinX = (furn.ox - (furn.oy + furn.h)) * HALF_TILE_W;
  const wallMaxX = (furn.ox + furn.w - furn.oy) * HALF_TILE_W;
  const wallMinY =
    (furn.ox + furn.oy) * HALF_TILE_H - PARTITION_SCREEN_HEIGHT;
  const wallMaxY = (furn.ox + furn.w + furn.oy + furn.h) * HALF_TILE_H;

  const cx = (tx - ty) * HALF_TILE_W;
  const cy = (tx + ty + 1) * HALF_TILE_H;

  const w = Math.min(wallMaxX, cx + SPRITE_HALF_W) -
    Math.max(wallMinX, cx - SPRITE_HALF_W);
  const h = Math.min(wallMaxY, cy + SPRITE_FOOT_DROP) -
    Math.max(wallMinY, cy - SPRITE_TOP);
  return Math.max(0, w) * Math.max(0, h);
}

function footprintSortDepth(furn: FurnitureDepthFootprint): number {
  if (furn.depth !== undefined) return furn.depth;
  return (
    interiorFurnitureDepth(
      furn.depthX ?? furn.ox + furn.w - 1,
      furn.depthY ?? furn.oy + furn.h - 1,
    ) + (furn.depthBias ?? 0)
  );
}

/**
 * Partition bounds for an entity that cannot satisfy all of them, resolved by
 * how much of the sprite each wall covers: take the most-covering wall's side
 * first and drop any weaker bound that would contradict what is already fixed.
 */
function resolvePartitionBounds(
  tx: number,
  ty: number,
  nearby: readonly FurnitureDepthFootprint[],
): { floor: number; ceiling: number } {
  const bounds: { value: number; front: boolean; overlap: number }[] = [];

  for (const furn of nearby) {
    if (!furn.partition) continue;
    const onFootprint =
      tx >= furn.ox &&
      tx < furn.ox + furn.w &&
      ty >= furn.oy &&
      ty < furn.oy + furn.h;
    const hideInsideCorner =
      !onFootprint && chainLinkInsideCornerHidesNs(tx, ty, furn, nearby);
    const front =
      (isInFrontOfFurniture(tx, ty, furn) || onFootprint) && !hideInsideCorner;
    if (
      !front &&
      !hideInsideCorner &&
      !isWestOrNorthOfFurniture(tx, ty, furn, PARTITION_DEPTH_REACH)
    ) {
      continue;
    }
    const furnDepth = footprintSortDepth(furn);
    const step = partitionEntityStep(furn);
    bounds.push({
      value: front ? furnDepth + step : furnDepth - step,
      front,
      overlap: partitionSpriteOverlap(tx, ty, furn),
    });
  }

  bounds.sort((a, b) => b.overlap - a.overlap);

  let floor = Number.NEGATIVE_INFINITY;
  let ceiling = Number.POSITIVE_INFINITY;
  for (const b of bounds) {
    if (b.front) {
      if (b.value <= ceiling) floor = Math.max(floor, b.value);
    } else if (b.value >= floor) {
      ceiling = Math.min(ceiling, b.value);
    }
  }
  return { floor, ceiling };
}

/**
 * Continuous entity depth can exceed floored furniture depth on NW/NE tiles
 * (iso-behind). Same lift/clamp order as overworld buildings: behind clamps
 * first, then front lifts win so SE/SW approach tiles stay in front. A final
 * west/north pass re-asserts occlusion so another prop's front-lift cannot
 * paint the player over a dresser/cabinet they are behind.
 *
 * Final resolve order:
 * 1. Partition front-lifts (stay above walls you're east/south of)
 * 2. Furniture behind-ceilings (stay under beds/props on NW neighbour tiles —
 *    must beat partition lifts so cubicle walls don't paint you over the bed)
 * 3. Partition behind-ceilings (stay under walls you're west/north of)
 */
export function applyFurnitureEntityDepth(
  depth: number,
  tx: number,
  ty: number,
  furniture: readonly FurnitureDepthFootprint[],
): number {
  let result = depth;
  let frontFloor = Number.NEGATIVE_INFINITY;
  let partitionFrontFloor = Number.NEGATIVE_INFINITY;
  let partitionBehindCeiling = Number.POSITIVE_INFINITY;
  let furnitureBehindCeiling = Number.POSITIVE_INFINITY;
  const nearby: FurnitureDepthFootprint[] = [];

  for (const furn of furniture) {
    const reach = furn.partition
      ? PARTITION_DEPTH_REACH
      : ENTITY_FURNITURE_DEPTH_REACH;
    if (
      tx < furn.ox - reach ||
      tx >= furn.ox + furn.w + reach ||
      ty < furn.oy - reach ||
      ty >= furn.oy + furn.h + reach
    ) {
      continue;
    }
    nearby.push(furn);

    const furnDepth = footprintSortDepth(furn);
    const step = partitionEntityStep(furn);
    const onFootprint =
      tx >= furn.ox &&
      tx < furn.ox + furn.w &&
      ty >= furn.oy &&
      ty < furn.oy + furn.h;
    const hideInsideCorner =
      !onFootprint && chainLinkInsideCornerHidesNs(tx, ty, furn, furniture);

    if (
      (isInFrontOfFurniture(tx, ty, furn) || onFootprint) &&
      !hideInsideCorner
    ) {
      frontFloor = Math.max(frontFloor, furnDepth + step);
      if (furn.partition) {
        partitionFrontFloor = Math.max(partitionFrontFloor, furnDepth + step);
      }
    } else if (
      result >= furnDepth &&
      // 3-tile chain-link is keyed at its origin. The AABB around that run
      // still covers tiles south-west of the camera-near end (beside a tree
      // at the join). Those tiles are not behind the mesh; clamping them to
      // the origin depth puts the player under the tree.
      furn.entityStep !== CHAINLINK_ENTITY_STEP &&
      (hideInsideCorner ||
        isWestOrNorthOfFurniture(
          tx,
          ty,
          furn,
          furn.partition ? PARTITION_DEPTH_REACH : ENTITY_FURNITURE_DEPTH_REACH,
        ))
    ) {
      result = Math.min(result, furnDepth - step);
    }

    if (isWestOrNorthOfFurniture(tx, ty, furn, reach) || hideInsideCorner) {
      if (furn.partition) {
        partitionBehindCeiling = Math.min(
          partitionBehindCeiling,
          furnDepth - step,
        );
      } else {
        furnitureBehindCeiling = Math.min(
          furnitureBehindCeiling,
          furnDepth - step,
        );
      }
    }
  }

  if (frontFloor > Number.NEGATIVE_INFINITY) {
    result = Math.max(result, frontFloor);
  }

  for (const furn of nearby) {
    const hideInsideCorner = chainLinkInsideCornerHidesNs(tx, ty, furn, nearby);
    if (
      !isWestOrNorthOfFurniture(
        tx,
        ty,
        furn,
        furn.partition ? PARTITION_DEPTH_REACH : ENTITY_FURNITURE_DEPTH_REACH,
      ) &&
      !hideInsideCorner
    ) {
      continue;
    }
    const furnDepth = footprintSortDepth(furn);
    if (result >= furnDepth) {
      result = Math.min(result, furnDepth - partitionEntityStep(furn));
    }
  }

  // Two walls pinned to different building cuboids can end up with their
  // relative depths inverted (they never overlap each other on screen, so the
  // wall run itself still looks right). An entity between them cannot satisfy
  // both bounds — re-resolve, most-covering wall first.
  if (partitionFrontFloor > partitionBehindCeiling) {
    const resolved = resolvePartitionBounds(tx, ty, nearby);
    partitionFrontFloor = resolved.floor;
    partitionBehindCeiling = resolved.ceiling;
  }

  if (partitionFrontFloor > Number.NEGATIVE_INFINITY) {
    result = Math.max(result, partitionFrontFloor);
  }
  // Bed/prop occlusion wins over partition front-lifts (NW neighbour tiles).
  if (furnitureBehindCeiling < Number.POSITIVE_INFINITY) {
    result = Math.min(result, furnitureBehindCeiling);
  }
  if (partitionBehindCeiling < Number.POSITIVE_INFINITY) {
    result = Math.min(result, partitionBehindCeiling);
  }
  return result;
}

/**
 * Interior living entities — continuous x+y, then clamp behind nearby furniture
 * so NW/NE neighbour tiles don't paint over the prop sprites.
 */
export function interiorEntityRenderDepth(
  worldX: number,
  worldY: number,
  furniture: readonly FurnitureDepthFootprint[],
) {
  const tx = Math.floor(worldX);
  const ty = Math.floor(worldY);
  return applyFurnitureEntityDepth(
    entityRenderDepth(worldX, worldY),
    tx,
    ty,
    furniture,
  );
}

/** Interior corpses — same furniture clamp as living entities. */
export function interiorCorpseRenderDepth(
  worldX: number,
  worldY: number,
  furniture: readonly FurnitureDepthFootprint[],
) {
  const tx = Math.floor(worldX);
  const ty = Math.floor(worldY);
  return applyFurnitureEntityDepth(
    corpseRenderDepth(worldX, worldY),
    tx,
    ty,
    furniture,
  );
}

/** How far from a footprint to look for buildings when adjusting entity depth. */
export const ENTITY_BUILDING_DEPTH_REACH = 8;

/**
 * SW street apron: west of the footprint and strictly south of it, the same
 * band walls pin via {@link buildingPinsTile}, and the same rule fences use.
 * Without it, a south-apron tree lifts above the cuboid while a screen-nearer
 * SW-corner neighbour keeps a lower natural depth, so the farther tree paints
 * over the nearer one.
 *
 * The southernmost footprint row itself is *not* apron. A tile west of that
 * row is beside the building, behind its west wall, and its screen box
 * straddles the cuboid's left silhouette edge, so lifting it painted the
 * sprite over the wall on exactly that one tile.
 */
function isBuildingSwApronTile(
  tx: number,
  ty: number,
  bld: { ox: number; oy: number; w: number; h: number },
): boolean {
  if (ty < bld.oy + bld.h) return false;
  const westOf = bld.ox - tx;
  return westOf > 0 && westOf <= 4;
}

/**
 * Southmost / eastmost footprint row. Walkable tiles never sit here, but
 * render interpolation on a street neighbour can floor onto this edge and
 * lose the in-front lift for a frame.
 */
function isBuildingFrontFootprintEdge(
  tx: number,
  ty: number,
  bld: { ox: number; oy: number; w: number; h: number },
): boolean {
  if (tx < bld.ox || ty < bld.oy) return false;
  if (tx >= bld.ox + bld.w || ty >= bld.oy + bld.h) return false;
  return ty === bld.oy + bld.h - 1 || tx === bld.ox + bld.w - 1;
}

/**
 * Shared front/behind building pin for living sprites, trees, and fences.
 * Preserves relative iso order inside the lift/sink band (see ENTITY_BUILDING_*).
 */
function applyBuildingObjectDepth(
  depth: number,
  tx: number,
  ty: number,
  opts: {
    /**
     * When set, only lift tiles that pass this predicate (fences: south
     * ring, plus the east band for tents).
     */
    shouldLift?: (
      tx: number,
      ty: number,
      bld: {
        ox: number;
        oy: number;
        w: number;
        h: number;
        buildingType?: string;
      },
    ) => boolean;
    /** Re-assert west/north behind after front lifts (entities + trees). */
    reassertWestNorth?: boolean;
  } = {},
): number {
  const natural = depth;
  let result = depth;
  let frontFloor = Number.NEGATIVE_INFINITY;
  const nearby = getBuildingsNearTile(tx, ty, ENTITY_BUILDING_DEPTH_REACH);

  for (const bld of nearby) {
    const buildingDepth = buildingWallDepth(bld);
    const lift =
      opts.shouldLift?.(tx, ty, bld) ??
      (isInFrontOfBuilding(tx, ty, bld) ||
        isBuildingSwApronTile(tx, ty, bld) ||
        isBuildingFrontFootprintEdge(tx, ty, bld));
    if (lift) {
      frontFloor = Math.max(
        frontFloor,
        buildingFrontEntityDepth(bld, buildingDepth, natural),
      );
    } else if (opts.shouldLift === undefined && result > buildingDepth) {
      result = Math.min(
        result,
        buildingBehindEntityDepth(bld, buildingDepth, natural),
      );
    }
  }
  if (frontFloor > Number.NEGATIVE_INFINITY) {
    result = Math.max(result, frontFloor);
  }

  if (opts.reassertWestNorth !== false && opts.shouldLift === undefined) {
    for (const bld of nearby) {
      if (!isWestOrNorthWallOutlineRange(tx, ty, bld)) continue;
      if (isBuildingSwApronTile(tx, ty, bld)) continue;
      if (isBuildingFrontFootprintEdge(tx, ty, bld)) continue;
      const buildingDepth = buildingWallDepth(bld);
      if (result >= buildingDepth) {
        result = Math.min(
          result,
          buildingBehindEntityDepth(bld, buildingDepth, natural),
        );
      }
    }
  }
  return result;
}

function applyBuildingEntityDepth(
  depth: number,
  tx: number,
  ty: number,
): number {
  // Clamp behind first, then front lifts win so SE/SW street tiles stay
  // above the cuboid. West/north overhang is re-asserted in a final pass so a
  // front-lift from another lot cannot paint the sprite over that wall.
  return applyBuildingObjectDepth(depth, tx, ty);
}

/**
 * Tree depth vs building cuboids — same front/behind rules as entities.
 */
export function applyBuildingTreeDepth(
  depth: number,
  tx: number,
  ty: number,
): number {
  return applyBuildingObjectDepth(depth, tx, ty);
}

/**
 * Streetlight depth vs building cuboids — same front/behind rules as trees.
 * A curb pole south or east of a house has a lower iso key than the house's
 * SE corner, so without this lift the cuboid paints over the lamp.
 */
export function applyBuildingStreetlightDepth(
  depth: number,
  tx: number,
  ty: number,
): number {
  return applyBuildingObjectDepth(depth, tx, ty);
}

/**
 * Fence depth vs building cuboids.
 *
 * South of a footprint still lifts (yard rings, south barracks run). East
 * "in front" is tent-only: 3-tile SE chain-link is keyed at its north origin,
 * so a tent's SE-corner cuboid out-ranks the panel and the gable paints over
 * the mesh unless any occupied tile in the east band lifts the whole run.
 * Other buildings keep the old south-only rule so an east yard fence between
 * two houses does not jump over the eastern lot.
 */
export function applyBuildingFenceDepth(
  depth: number,
  tx: number,
  ty: number,
  facing?: StructureFenceFacing,
): number {
  const { w, h } = facing ? structureFenceFootprint(facing) : { w: 1, h: 1 };
  const tiles: Array<{ x: number; y: number }> = [];
  for (let dx = 0; dx < w; dx++) {
    for (let dy = 0; dy < h; dy++) {
      tiles.push({ x: tx + dx, y: ty + dy });
    }
  }
  return applyBuildingObjectDepth(depth, tx, ty, {
    shouldLift: (_tx, _ty, bld) => {
      if (_ty >= bld.oy + bld.h) return true;
      if (bld.buildingType !== "tent") return false;
      return tiles.some(
        (t) =>
          t.x >= bld.ox + bld.w &&
          t.y >= bld.oy &&
          t.y < bld.oy + bld.h,
      );
    },
    reassertWestNorth: false,
  });
}

/**
 * Player walls / doors (1×1 partitions). Chain-link sets an axis or entity
 * step and keeps its own sort.
 */
function isPlayerWallFootprint(f: FurnitureDepthFootprint): boolean {
  return (
    !!f.partition &&
    !f.axis &&
    f.entityStep === undefined &&
    f.w === 1 &&
    f.h === 1
  );
}

type StructureFootprintQuery = (
  tx: number,
  ty: number,
) => readonly FurnitureDepthFootprint[];

/**
 * WorldScene fills this so yard fences and trees can resolve against the
 * player walls that are actually on screen. Unset in checker scripts, so
 * those keep the building-only depths.
 */
let overworldStructureFootprints: StructureFootprintQuery | null = null;

export function setOverworldStructureFootprintProvider(
  fn: StructureFootprintQuery | null,
) {
  overworldStructureFootprints = fn;
}

/**
 * Lowest player-wall depth that should occlude (tx, ty), or null when no
 * wall stands south or east of it.
 */
export function playerWallOccluderDepth(
  tx: number,
  ty: number,
): number | null {
  const footprints = overworldStructureFootprints?.(tx, ty);
  if (!footprints || footprints.length === 0) return null;
  let ceiling = Number.POSITIVE_INFINITY;
  for (const f of footprints) {
    if (!isPlayerWallFootprint(f)) continue;
    if (!isWestOrNorthOfFurniture(tx, ty, f, PARTITION_DEPTH_REACH)) continue;
    if (wallSunkBehindBuildingInFrontOfEntity(f, tx, ty)) continue;
    const top = footprintSortDepth(f);
    if (top < ceiling) ceiling = top;
  }
  return ceiling < Number.POSITIVE_INFINITY ? ceiling : null;
}

/**
 * Yard fences and trees share the entity front band, which sits above player
 * walls. A panel just inside a wall (often the one beside a lifted tree)
 * then paints over that wall. Slip it into the open sliver under the wall
 * and above the behind-wall entity clamp, keeping nearer sprites in front.
 * Sprites already under the wall are left alone.
 */
export function tuckBehindPlayerWalls(
  depth: number,
  tx: number,
  ty: number,
): number {
  const wallDepth = playerWallOccluderDepth(tx, ty);
  if (wallDepth == null) return depth;
  const floor = wallDepth - PARTITION_ENTITY_STEP;
  const cap = wallDepth - PARTITION_ENTITY_STEP / 2;
  if (depth <= cap) return depth;
  const excess = depth - floor;
  const t = excess / (excess + 1);
  return floor + (cap - floor) * t;
}

function isChainLinkCornerFootprint(f: FurnitureDepthFootprint): boolean {
  return (
    !!f.partition &&
    !f.axis &&
    f.w === 1 &&
    f.h === 1 &&
    f.entityStep === CHAINLINK_ENTITY_STEP
  );
}

/**
 * A wall's rendered depth only ever diverges from its plain iso depth by a
 * building lift/sink (hundreds to thousands) or an interior corner bias (0 or
 * 1) — so a gap bigger than a handful of units means a building touched it.
 * Plain, unaffected walls are already ordered correctly (contradictions and
 * all) by {@link applyFurnitureEntityDepth}'s resolver, which reasons about
 * screen overlap; re-asserting a raw front/behind bound for them below would
 * only re-introduce the contradiction that resolver already settled.
 *
 * Chain-link corners intentionally sit ~3 tiles behind their iso key so they
 * paint under SW/SE panels. Compare those against their unlifted corner depth
 * instead of the raw partition key, or open-field corners would look
 * building-adjusted.
 */
function isBuildingAdjustedPartition(f: FurnitureDepthFootprint): boolean {
  const natural = isChainLinkCornerFootprint(f)
    ? chainLinkFenceCornerSortDepth(f.ox, f.oy, false)
    : interiorPartitionDepth(f.ox, f.oy);
  return Math.abs(footprintSortDepth(f) - natural) > 5;
}

function wallSunkBehindBuildingInFrontOfEntity(
  f: FurnitureDepthFootprint,
  tx: number,
  ty: number,
  memo?: Map<FurnitureDepthFootprint, boolean>,
): boolean {
  const cached = memo?.get(f);
  if (cached !== undefined) return cached;
  const wd = footprintSortDepth(f);
  let sunk = false;
  for (const bld of getBuildingsNearTile(
    f.ox,
    f.oy,
    PARTITION_BUILDING_SEARCH_REACH,
  )) {
    if (!isInFrontOfBuilding(tx, ty, bld)) continue;
    if (wd >= buildingWallDepth(bld)) continue;
    if (!buildingCoversTileOnScreen(f.ox, f.oy, bld)) continue;
    sunk = true;
    break;
  }
  memo?.set(f, sunk);
  return sunk;
}

/**
 * Overworld entity depth against player-built / temp walls.
 *
 * 1. Behind-walls that clear street cuboids win over contradiction resolution
 *    that dropped them (SW apron north/west of a wall must stay under it).
 *    Walls actually sunk behind a cuboid the entity is in front of are
 *    skipped — clamping to them and then rescuing above the cuboid leaves the
 *    player under other, unrelated street walls.
 * 2. Clear any cuboid the entity still visually sits under.
 * 3. Re-assert front for walls the entity is south of, unless that would jump
 *    a behind-wall that clears the cuboids.
 */
export function applyOverworldStructureEntityDepth(
  depth: number,
  tx: number,
  ty: number,
  footprints: readonly FurnitureDepthFootprint[],
): number {
  let result = applyFurnitureEntityDepth(depth, tx, ty, footprints);

  // Four passes below ask the same question about the same footprints, and each
  // answer costs a building search. (tx, ty) is fixed for this call, so one
  // answer per footprint is enough.
  const sunkMemo = new Map<FurnitureDepthFootprint, boolean>();

  for (const f of footprints) {
    if (!f.partition) continue;
    if (!isBuildingAdjustedPartition(f)) continue;
    if (!isWestOrNorthOfFurniture(tx, ty, f, PARTITION_DEPTH_REACH)) continue;
    if (wallSunkBehindBuildingInFrontOfEntity(f, tx, ty, sunkMemo)) continue;
    const wd = footprintSortDepth(f);
    if (result > wd) result = wd - PARTITION_ENTITY_STEP;
  }

  // Gate on buildingPinsTile rather than the looser isInFrontOfBuilding: the
  // latter is unconditional on x for the south face (fine when bounded to a
  // small reach for wall lifting, since a wall's own screen box catches
  // anything that matters), but here it would "rescue" entities many tiles to
  // the side of a building that never actually stood over its cuboid — which
  // then wins over a legitimate, closer wall clamp resolved above.
  let frontFloor = Number.NEGATIVE_INFINITY;
  let pinnedCuboid = Number.NEGATIVE_INFINITY;
  const natural = entityRenderDepth(tx + 0.5, ty + 0.5);
  for (const bld of getBuildingsNearTile(tx, ty, ENTITY_BUILDING_DEPTH_REACH)) {
    if (!buildingPinsTile(tx, ty, bld)) continue;
    const buildingDepth = buildingWallDepth(bld);
    pinnedCuboid = Math.max(pinnedCuboid, buildingDepth);
    frontFloor = Math.max(
      frontFloor,
      buildingFrontEntityDepth(bld, buildingDepth, natural),
    );
  }
  if (frontFloor > Number.NEGATIVE_INFINITY && result < frontFloor) {
    // A wall standing on the same apron is lifted into 0.25..0.75 above the
    // cuboid while entities lift to 1.0..1.5, so the rescue would paint the
    // sprite over a wall it stands west/north of. Rescue only as far as that
    // wall allows, while still clearing the cuboid so the sprite does not sink
    // into the house it is standing in front of.
    let cap = frontFloor;
    for (const f of footprints) {
      if (!f.partition) continue;
      if (!isWestOrNorthOfFurniture(tx, ty, f, PARTITION_DEPTH_REACH)) continue;
      if (wallSunkBehindBuildingInFrontOfEntity(f, tx, ty, sunkMemo)) continue;
      const ceiling = footprintSortDepth(f) - partitionEntityStep(f);
      if (ceiling <= pinnedCuboid) continue;
      cap = Math.min(cap, ceiling);
    }
    if (result < cap) result = cap;
  }

  // East/south cuboid pins sit in front of a tent gable and west of the
  // barracks SE chain-link at once. The pin above must not jump that mesh.
  for (const f of footprints) {
    if (!f.partition) continue;
    if (f.entityStep !== CHAINLINK_ENTITY_STEP) continue;
    if (!isWestOrNorthOfFurniture(tx, ty, f, PARTITION_DEPTH_REACH)) continue;
    if (wallSunkBehindBuildingInFrontOfEntity(f, tx, ty, sunkMemo)) continue;
    const wd = footprintSortDepth(f);
    if (result > wd) result = wd - partitionEntityStep(f);
  }

  for (const f of footprints) {
    if (!f.partition) continue;
    if (!isBuildingAdjustedPartition(f)) continue;
    if (ty < f.oy + f.h) continue; // not south of this wall
    if (
      tx < f.ox - PARTITION_DEPTH_REACH ||
      tx >= f.ox + f.w + PARTITION_DEPTH_REACH
    ) {
      continue;
    }
    const wd = footprintSortDepth(f);
    if (result > wd) continue;
    let jumpsBehind = false;
    for (const g of footprints) {
      if (!g.partition) continue;
      if (!isWestOrNorthOfFurniture(tx, ty, g, PARTITION_DEPTH_REACH)) continue;
      if (
        isBuildingAdjustedPartition(g) &&
        wallSunkBehindBuildingInFrontOfEntity(g, tx, ty, sunkMemo)
      ) {
        continue;
      }
      const gd = footprintSortDepth(g);
      if (gd < wd + PARTITION_ENTITY_STEP) {
        jumpsBehind = true;
        break;
      }
    }
    if (!jumpsBehind) result = wd + PARTITION_ENTITY_STEP;
  }
  return result;
}

/**
 * Overworld entity depth — bump above the building cuboid on street-facing
 * tiles (south / east / SW apron). Clamp below on the west and north faces so
 * a sprite standing up-screen of the lot does not draw over the wall it is
 * actually behind (the local player still gets the occlusion outline).
 */
export function overworldEntityRenderDepth(worldX: number, worldY: number) {
  const tx = Math.floor(worldX);
  const ty = Math.floor(worldY);
  return applyBuildingEntityDepth(entityRenderDepth(worldX, worldY), tx, ty);
}

/** Overworld corpse depth — same building rules as living entities. */
export function overworldCorpseRenderDepth(worldX: number, worldY: number) {
  const tx = Math.floor(worldX);
  const ty = Math.floor(worldY);
  return applyBuildingEntityDepth(corpseRenderDepth(worldX, worldY), tx, ty);
}
