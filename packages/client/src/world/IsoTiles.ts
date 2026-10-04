import Phaser from "phaser";
import {
  buildingWallScreenDepth,
  cartesianToIso,
  generateTile,
  getBuildingAt,
  getFencesAt,
  getStreetlightAt,
  getStreetTileType,
  getTreeAt,
  isTreeFelled,
  markTreeFelled,
  isoToCartesian,
  TileType,
  TILE_HEIGHT,
  TILE_WIDTH,
  TREE_FALL_FRAMES,
  TREE_FALL_FRAME_MS,
  worldMaxX,
  worldMaxY,
  CELL_BOUNDARY_PRELOAD,
  preWarmCellsNearPlayer,
  evictDistantCells,
  WORLDGEN_QUERY_REACH,
  type BuildingInfo,
  type BuildingType,
  type FenceInfo,
  type StreetlightInfo,
  type TreeInfo,
  type WorldBounds,
} from "@zombie/shared";
import {
  CLIENT_RENDER_RADIUS,
  TILES_PER_SYNC,
  BUILDINGS_PER_SYNC,
  BUILDING_CUBOID_CACHE_MAX,
  IS_MOBILE,
  EXTERIOR_PURGE_HYSTERESIS_TILES,
  EXTERIOR_PURGE_BUILDINGS_PER_FRAME,
  BUILDING_LOD_NEAR_TILES,
  BUILDING_LOD_HYSTERESIS_TILES,
} from "../gameConfig";
import {
  createGroundTileImage,
  TILE_DISPLAY_BLEED,
} from "./TileTextures";
import {
  createBuildingCuboid,
  destroyBuildingCuboid,
  drawBuildingOcclusionMask,
  type BuildingCuboidObject,
} from "./BuildingCuboid";
import {
  bakeZoomTierForZoom,
  evictIdleBuildingTextures,
  getBakeZoomTier,
  lodScale,
  purgeIdleBuildingTextures,
  setBakeZoomTier,
  type BakeZoomTier,
  type BuildingLod,
} from "./buildingTextureCache";
import {
  destroyBuildingEdgeDecals,
  spawnBuildingEdgeDecals,
} from "./buildingEdgeDecals";
import {
  destroyStreetSurfaceDecal,
  maybeSpawnStreetSurfaceDecal,
} from "./streetSurfaceDecals";
import {
  destroyRainPuddle,
  puddleSpecAt,
  spawnRainPuddle,
  tickRainPuddle,
  type PuddleSpec,
  type PuddleSprite,
} from "./rainPuddleDecals";
import {
  STREET_RECESS,
  isRoadTile,
  sidewalkLiftAt,
  streetSurfaceAt,
} from "./streetLevel";
import {
  BuildingOcclusionMask,
  OCCLUSION_OVERLAY_DEPTH,
} from "./BuildingOcclusion";
import {
  fenceCornerFromFacings,
  fenceCornerTextureKey,
  fenceTextureKey,
  type FenceCorner,
} from "../sprites/FenceAssets";
import { renderStats } from "../diagnostics/textureBudget";
import { streetlightTextureKey } from "../sprites/PropAssets";
import { ensureTreeFallFrames, entityFeetY } from "../sprites/EntitySprites";
import {
  buildingCuboidScreenBox,
  buildingWallDepth,
  entityRenderDepth,
  groundSortDepth,
  GROUND_LAYER_DEPTH,
  tileIndicatorDepth,
  ENTITY_BUILDING_DEPTH_REACH,
  applyBuildingTreeDepth,
  applyBuildingStreetlightDepth,
  applyBuildingFenceDepth,
  playerWallOccluderDepth,
  tuckBehindPlayerWalls,
} from "./depthSort";

export {
  applyFurnitureEntityDepth,
  applyOverworldStructureEntityDepth,
  buildingWallDepth,
  chainLinkFenceCornerDepthFootprint,
  chainLinkFenceCornerSortDepth,
  chainLinkFenceDepthFootprint,
  chainLinkFenceSortDepth,
  corpseRenderDepth,
  entityRenderDepth,
  interiorCorpseRenderDepth,
  interiorEntityRenderDepth,
  interiorFloorDepth,
  interiorFurnitureDepth,
  interiorFurnitureDepthBias,
  interiorPartitionDepth,
  LOCAL_PLAYER_DEPTH_BIAS,
  overworldCorpseRenderDepth,
  overworldEntityRenderDepth,
  overworldPartitionDepth,
  tileIndicatorDepth,
  wallRenderDepth,
  applyBuildingTreeDepth,
  setOverworldStructureFootprintProvider,
  type FurnitureDepthFootprint,
} from "./depthSort";

/** On-screen height for tree sprites (source art is 136×136). */
const TREE_DISPLAY_HEIGHT = 224;
/** Extra screen-Y for tree footing (positive = lower). */
const TREE_BOTTOM_PAD = Math.round(TREE_DISPLAY_HEIGHT * 0.10);
/** On-screen height for Streetlight1 (source art is 256×256). */
const STREETLIGHT_DISPLAY_HEIGHT = 208;
/** Extra screen-Y so the base sits lower on the curb (positive = lower). */
const STREETLIGHT_BOTTOM_PAD = Math.round(STREETLIGHT_DISPLAY_HEIGHT * 0.075);

/** Orange diamond outline on an iso tile centre — used for search/loot highlights. */
/** Stroke one iso tile diamond. Set `clearFirst` false to layer multiple tiles. */
export function strokeIsoTileOutline(
  graphics: Phaser.GameObjects.Graphics,
  tx: number,
  ty: number,
  color = 0xffee44,
  alpha = 0.9,
  clearFirst = true,
) {
  if (clearFirst) graphics.clear();
  const iso = cartesianToIso(tx + 0.5, ty + 0.5);
  const hw = TILE_WIDTH / 2;
  const hh = TILE_HEIGHT / 2;
  graphics.lineStyle(2, color, alpha);
  graphics.beginPath();
  graphics.moveTo(iso.x, iso.y - hh);
  graphics.lineTo(iso.x + hw, iso.y);
  graphics.lineTo(iso.x, iso.y + hh);
  graphics.lineTo(iso.x - hw, iso.y);
  graphics.closePath();
  graphics.strokePath();
}

function tileKey(x: number, y: number) {
  return `${x},${y}`;
}

function fenceObjectKey(fence: FenceInfo): string {
  return `${fence.ox},${fence.oy},${fence.facing}`;
}

function fenceCornerObjectKey(ox: number, oy: number, corner: FenceCorner): string {
  return `${ox},${oy},${corner}`;
}

/** Street tiles in one Graphics object per chunk to cut draw-object count in cities. */
const STREET_CHUNK_SIZE = 16;

/** Max new tiles to register per sync pass (generateTile + draw). */
// TILES_PER_SYNC imported from gameConfig (mobile vs desktop).

/**
 * Extra tiles beyond the camera viewport to pre-draw.
 * ≥ one street chunk so the next chunk is usually ready before it enters view.
 * Sized for sprint look-ahead (~5.4 tiles/s) so the fill stays ahead of the camera.
 */
const CAMERA_TILE_PADDING = 24;

/**
 * Keep drawn objects this far past the draw AABB before destroying them.
 * Prevents chunk-sized pop-in when sprinting into a freshly expanded edge.
 */
const CULL_HYSTERESIS_TILES = 12;

/**
 * Always paint this Chebyshev ring around the player first each sync.
 * Stops continuous sprint from racing into void while the regional scan lags.
 */
const PRIORITY_FILL_RADIUS = 14;

/**
 * Already-drawn visits are cheap, but each one still builds a tile key.
 * Cap them per frame so a zoom-out can skip the painted interior without
 * allocating the whole view in one go. The time deadline stops the scan too.
 */
const CHEAP_SKIP_CAP = 6000;
const CHEAP_SKIP_STRIDE = 48;

/**
 * Coarser building bakes wait until the wheel has settled. Applying the tier
 * mid-zoom rebakes the city on the same frames that are trying to fill ground.
 */
const BAKE_ZOOM_SETTLE_MS = 180;

/**
 * Flat cuboids placed while a textured bake waits. Cheap enough to keep
 * footprints from sitting empty, few enough that a zoomed-out city cannot
 * allocate a graphics object for every building in one frame.
 */
const SOLID_BUILDINGS_PER_SYNC = IS_MOBILE ? 4 : 12;

/**
 * Buildings re-tiered per sync. Each change destroys and re-creates a cuboid,
 * so it is budgeted like cold bakes rather than done for the whole view at once.
 */
const BUILDING_LOD_UPDATES_PER_SYNC = IS_MOBILE ? 3 : 16;

/**
 * Screen slack around the viewport for the near (3x supersampled) bake tier.
 *
 * Distance alone is a poor proxy for "can the player see this": the camera rect
 * maps to a diamond in tile space, so a Chebyshev square around the player is
 * roughly three times the area actually on screen and two thirds of the 3x bake
 * budget went to buildings nobody could see. That is what exhausted the budget
 * and pushed the buildings at your feet onto the flat fallback.
 *
 * Promote is the smaller ring so detail arrives before a building scrolls in
 * (128px is ~0.7s of sprint, and the tier pass runs every sync). Demote is
 * wider so a building hovering at the edge cannot re-bake every sync; the gap
 * between the two is pure hysteresis. Both are only ever tightenings of the
 * distance rule, never a widening, so no screen size can do worse than before.
 */
const NEAR_BAKE_PROMOTE_PAD_PX = 128;
const NEAR_BAKE_DEMOTE_PAD_PX = 256;

/**
 * Hard cap on how far tiles can be drawn from the player (Chebyshev).
 * Mobile always uses this as a fixed square; desktop uses camera visibility
 * clamped to this max so extreme zoom-out can't explode draw cost.
 */
export const RENDER_RADIUS = CLIENT_RENDER_RADIUS;

/** Categories for the M-key map — only tiles already drawn in the overworld. */
export type MinimapTileKind =
  | "floor"
  | "road"
  | "pavement"
  | "carpark"
  | "barracks"
  | "building"
  | "streetlight";

/** Fence source canvas size (WoodenFence_*.png). */
const FENCE_SRC_SIZE = 136;
/** Opaque content horizontal span in source px (shared across facings). */
const FENCE_CONTENT_SPAN_X = 107;
/**
 * Rail-midpoint origin — anchors the panel on the tile centre diamond.
 * (Feet/corner origins break the diagonal and cause gaps between panels.)
 */
const FENCE_ORIGIN_X = 68 / FENCE_SRC_SIZE;
const FENCE_ORIGIN_Y = 58 / FENCE_SRC_SIZE;
/** Slight overlap so rail joints don't show hairline gaps. */
const FENCE_SEAM_BLEED = 1.04;
/** Draw order within a tile: SW in front, then SE, NW, NE at the back. */
const FENCE_DEPTH_BY_FACING: Record<FenceInfo["facing"], number> = {
  NE: 0,
  NW: 1,
  SE: 2,
  SW: 3,
};
/** Corner piece depth bias from its two sides (front-most wins). */
const FENCE_DEPTH_BY_CORNER: Record<FenceCorner, number> = {
  NWNE: Math.max(FENCE_DEPTH_BY_FACING.NW, FENCE_DEPTH_BY_FACING.NE),
  SENE: Math.max(FENCE_DEPTH_BY_FACING.SE, FENCE_DEPTH_BY_FACING.NE),
  SWNW: Math.max(FENCE_DEPTH_BY_FACING.SW, FENCE_DEPTH_BY_FACING.NW),
  SWSE: Math.max(FENCE_DEPTH_BY_FACING.SW, FENCE_DEPTH_BY_FACING.SE),
};

type ViewRect = { minX: number; maxX: number; minY: number; maxY: number };

/**
 * Evict cells only once their boundary is this far from the player.
 * Desktop keep distance is computed per-frame from the live view size.
 */
function cacheKeepBoundaryDist(viewHalf: number): number {
  if (IS_MOBILE) return CLIENT_RENDER_RADIUS + 48;
  // Keep every cell a render-edge tile can query. Evicting sooner makes the
  // next zoom-out rebuild those layouts inside the paint budget.
  return Math.max(
    CELL_BOUNDARY_PRELOAD,
    viewHalf + 96,
    RENDER_RADIUS + WORLDGEN_QUERY_REACH,
  );
}

/**
 * Max uncached cells to generate per frame.  Spreads city generation across
 * frames so a single approach never blocks tile drawing for a full second.
 */
const PREWARM_CELLS_PER_FRAME = IS_MOBILE ? 1 : 2;

/**
 * Minimum player-tile / view-edge displacement before draw/cull runs.
 */
const SYNC_MOVE_THRESHOLD = 2;

/**
 * Tile AABB covered by the camera viewport (iso → cartesian), plus padding.
 * Does not clamp to world bounds — the overworld is procedural everywhere.
 */
export function cameraVisibleTileRegion(
  camera: Phaser.Cameras.Scene2D.Camera,
  paddingTiles = CAMERA_TILE_PADDING,
): ViewRect {
  const corners = [
    camera.getWorldPoint(0, 0),
    camera.getWorldPoint(camera.width, 0),
    camera.getWorldPoint(0, camera.height),
    camera.getWorldPoint(camera.width, camera.height),
  ];

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const point of corners) {
    const cart = isoToCartesian(point.x, point.y);
    const tx = Math.floor(cart.x);
    const ty = Math.floor(cart.y);
    minX = Math.min(minX, tx);
    maxX = Math.max(maxX, tx);
    minY = Math.min(minY, ty);
    maxY = Math.max(maxY, ty);
  }

  return {
    minX: minX - paddingTiles,
    maxX: maxX + paddingTiles,
    minY: minY - paddingTiles,
    maxY: maxY + paddingTiles,
  };
}

/** @deprecated Prefer cameraVisibleTileRegion — bounds clamp fights open-world drawing. */
export function visibleTileRegion(
  camera: Phaser.Cameras.Scene2D.Camera,
  bounds: WorldBounds,
  paddingTiles = CAMERA_TILE_PADDING,
): ViewRect {
  const region = cameraVisibleTileRegion(camera, paddingTiles);
  return {
    minX: Math.max(bounds.minGlobalX, region.minX),
    maxX: Math.min(worldMaxX(bounds) - 1, region.maxX),
    minY: Math.max(bounds.minGlobalY, region.minY),
    maxY: Math.min(worldMaxY(bounds) - 1, region.maxY),
  };
}

/** Clamp a camera region to ±maxRadius around the player. */
function clampRegionToPlayerRadius(
  region: ViewRect,
  cx: number,
  cy: number,
  maxRadius: number,
): ViewRect {
  const minX = Math.max(region.minX, cx - maxRadius);
  const maxX = Math.min(region.maxX, cx + maxRadius);
  const minY = Math.max(region.minY, cy - maxRadius);
  const maxY = Math.min(region.maxY, cy + maxRadius);
  // Camera far from the player → empty intersection. Fall back to the player
  // radius so join / pan glitches never leave a blank screen.
  if (minX > maxX || minY > maxY) {
    return {
      minX: cx - maxRadius,
      maxX: cx + maxRadius,
      minY: cy - maxRadius,
      maxY: cy + maxRadius,
    };
  }
  return { minX, maxX, minY, maxY };
}

type SyncCursor = { x: number; y: number; regionKey: string };

type FillBudget = {
  tiles: number;
  buildings: number;
  /** Flat stand-ins still allowed this frame. */
  solids: number;
  deadline: number;
  cheapSkips: number;
};

function placeholderCuboid(cuboid: BuildingCuboidObject): boolean {
  return cuboid.lod === "far" || cuboid.fallback;
}

/** One-tile strip of a newly exposed view edge, scanned inside-out. */
type EdgeBand = ViewRect & { cursor: SyncCursor };

function intersectView(a: ViewRect, b: ViewRect): ViewRect | null {
  const minX = Math.max(a.minX, b.minX);
  const maxX = Math.min(a.maxX, b.maxX);
  const minY = Math.max(a.minY, b.minY);
  const maxY = Math.min(a.maxY, b.maxY);
  if (minX > maxX || minY > maxY) return null;
  return { minX, maxX, minY, maxY };
}

function viewContains(outer: ViewRect, inner: ViewRect): boolean {
  return (
    outer.minX <= inner.minX &&
    outer.maxX >= inner.maxX &&
    outer.minY <= inner.minY &&
    outer.maxY >= inner.maxY
  );
}

/** Parts of `outer` that are not inside `inner`, as up to four rectangles. */
function subtractView(inner: ViewRect, outer: ViewRect): ViewRect[] {
  const ix0 = Math.max(inner.minX, outer.minX);
  const iy0 = Math.max(inner.minY, outer.minY);
  const ix1 = Math.min(inner.maxX, outer.maxX);
  const iy1 = Math.min(inner.maxY, outer.maxY);
  if (ix0 > ix1 || iy0 > iy1) return [];
  const out: ViewRect[] = [];
  if (outer.minY <= iy0 - 1) {
    out.push({
      minX: outer.minX,
      maxX: outer.maxX,
      minY: outer.minY,
      maxY: iy0 - 1,
    });
  }
  if (outer.maxY >= iy1 + 1) {
    out.push({
      minX: outer.minX,
      maxX: outer.maxX,
      minY: iy1 + 1,
      maxY: outer.maxY,
    });
  }
  if (outer.minX <= ix0 - 1) {
    out.push({
      minX: outer.minX,
      maxX: ix0 - 1,
      minY: iy0,
      maxY: iy1,
    });
  }
  if (outer.maxX >= ix1 + 1) {
    out.push({
      minX: ix1 + 1,
      maxX: outer.maxX,
      minY: iy0,
      maxY: iy1,
    });
  }
  return out;
}

/**
 * New tiles between the previous view and the next one, one row or column at
 * a time, starting at the edge that already touches painted ground.
 */
function inwardEdgeBands(prev: ViewRect, next: ViewRect): EdgeBand[] {
  if (!intersectView(prev, next)) return [];
  const make = (rect: ViewRect): EdgeBand => ({
    ...rect,
    cursor: { x: rect.minX, y: rect.minY, regionKey: "" },
  });
  const sides: EdgeBand[][] = [];
  for (const strip of subtractView(prev, next)) {
    const north = strip.maxY < prev.minY;
    const south = strip.minY > prev.maxY;
    const west = strip.maxX < prev.minX;
    const side: EdgeBand[] = [];
    if (north) {
      for (let y = strip.maxY; y >= strip.minY; y--) {
        side.push(make({ ...strip, minY: y, maxY: y }));
      }
    } else if (south) {
      for (let y = strip.minY; y <= strip.maxY; y++) {
        side.push(make({ ...strip, minY: y, maxY: y }));
      }
    } else if (west) {
      for (let x = strip.maxX; x >= strip.minX; x--) {
        side.push(make({ ...strip, minX: x, maxX: x }));
      }
    } else {
      for (let x = strip.minX; x <= strip.maxX; x++) {
        side.push(make({ ...strip, minX: x, maxX: x }));
      }
    }
    if (side.length > 0) sides.push(side);
  }
  // One row from each side before the next row, so the hole closes evenly
  // instead of finishing the north edge before the south edge starts.
  const bands: EdgeBand[] = [];
  const depth = sides.reduce((max, side) => Math.max(max, side.length), 0);
  for (let i = 0; i < depth; i++) {
    for (const side of sides) {
      const band = side[i];
      if (band) bands.push(band);
    }
  }
  return bands;
}

export function createGroundTile(
  scene: Phaser.Scene,
  x: number,
  y: number,
  parent: Phaser.GameObjects.Container,
  baseKey = "tile-ground",
): Phaser.GameObjects.Image | null {
  const tile = createGroundTileImage(scene, x, y, baseKey);
  if (!tile) return null;
  tile.setDepth(groundSortDepth(x, y));
  parent.add(tile);
  return tile;
}

function treeTextureKey(variant: number): string {
  const idx = ((variant % 5) + 5) % 5;
  return `tree-${idx + 1}`;
}

function treeFallTextureKey(variant: number, frame: number): string {
  const idx = ((variant % 5) + 5) % 5 + 1;
  return `tree-${idx}-fall-${frame}`;
}

function resolveTreeFallTexture(
  scene: Phaser.Scene,
  variant: number,
  frame: number,
): string {
  const key = treeFallTextureKey(variant, frame);
  if (scene.textures.exists(key)) return key;
  return treeTextureKey(variant);
}

function applyTreeTexture(
  scene: Phaser.Scene,
  img: Phaser.GameObjects.Image,
  textureKey: string,
) {
  const key = scene.textures.exists(textureKey) ? textureKey : "__DEFAULT";
  img.setTexture(key);
  if (scene.textures.exists(key) && key !== "__DEFAULT") {
    // Untrimmed frame size, so this stays correct if trees are ever atlased.
    const w = img.frame?.realWidth || 1;
    const h = img.frame?.realHeight || 1;
    img.setDisplaySize((w / h) * TREE_DISPLAY_HEIGHT, TREE_DISPLAY_HEIGHT);
  } else {
    img.setDisplaySize(TREE_DISPLAY_HEIGHT, TREE_DISPLAY_HEIGHT);
  }
}

function treeScreenPlacement(tree: TreeInfo): {
  x: number;
  feetY: number;
  displayWidth: number;
  displayHeight: number;
} {
  const iso = cartesianToIso(tree.ox + 0.5, tree.oy + 0.5);
  return {
    x: iso.x,
    feetY: entityFeetY(iso.y) + TREE_BOTTOM_PAD,
    displayWidth: TREE_DISPLAY_HEIGHT,
    displayHeight: TREE_DISPLAY_HEIGHT,
  };
}

/** Tree sprite standing on tile centre; blocks movement like a building. */
export function createTreeSprite(
  scene: Phaser.Scene,
  tree: TreeInfo,
  opts?: { felled?: boolean },
): Phaser.GameObjects.Image {
  const place = treeScreenPlacement(tree);
  const key = opts?.felled
    ? resolveTreeFallTexture(scene, tree.variant, TREE_FALL_FRAMES)
    : treeTextureKey(tree.variant);
  const img = scene.add.image(place.x, place.feetY, "__DEFAULT");
  img.setOrigin(0.5, 1.0);
  applyTreeTexture(scene, img, key);
  // Same iso tile sort as entities; buildings pull behind in-front trees.
  img.setDepth(treeRenderDepth(tree));
  return img;
}

/**
 * Tree image for BitmapMask — uses the sprite's alpha so the player outline
 * only appears where the tree actually covers them (not the full PNG box).
 * Felled trees use the fallen frame so the outline matches the stump/log art.
 */
export function createTreeMaskImage(
  scene: Phaser.Scene,
  tree: TreeInfo,
): Phaser.GameObjects.Image {
  return createTreeSprite(scene, tree, {
    felled: isTreeFelled(tree.ox, tree.oy),
  });
}

/**
 * A yard fence a couple of tiles south or east of this tree. Those panels
 * share the tree's front band, so when one slips under a player wall the
 * tree has to follow or its canopy paints over the panel.
 */
function yardFenceInFrontOfTree(tx: number, ty: number): boolean {
  const reach = 3;
  for (let y = ty; y <= ty + reach; y++) {
    for (let x = tx; x <= tx + reach; x++) {
      if (x === tx && y === ty) continue;
      if (getFencesAt(x, y).length > 0) return true;
    }
  }
  return false;
}

/** Sort depth for a tree sprite (matches createTreeSprite). */
export function treeRenderDepth(tree: TreeInfo): number {
  const base = entityRenderDepth(tree.ox + 0.5, tree.oy + 0.5);
  const depth = applyBuildingTreeDepth(base, tree.ox, tree.oy);
  if (playerWallOccluderDepth(tree.ox, tree.oy) == null) return depth;
  if (!yardFenceInFrontOfTree(tree.ox, tree.oy)) return depth;
  return tuckBehindPlayerWalls(depth, tree.ox, tree.oy);
}

/** Streetlight1 on curb centre; SE/SW lamp overhangs into the arterial. */
export function createStreetlightSprite(
  scene: Phaser.Scene,
  light: StreetlightInfo,
): Phaser.GameObjects.Image {
  const iso = cartesianToIso(light.ox + 0.5, light.oy + 0.5);
  const lift = sidewalkLiftAt(light.ox, light.oy);
  const textureKey = streetlightTextureKey(light.facing);
  const key = scene.textures.exists(textureKey) ? textureKey : "__DEFAULT";
  const img = scene.add.image(
    iso.x,
    entityFeetY(iso.y) + STREETLIGHT_BOTTOM_PAD - lift,
    key,
  );
  img.setOrigin(0.5, 1.0);
  if (scene.textures.exists(textureKey)) {
    const w = img.frame?.realWidth || 1;
    const h = img.frame?.realHeight || 1;
    img.setDisplaySize(
      (w / h) * STREETLIGHT_DISPLAY_HEIGHT,
      STREETLIGHT_DISPLAY_HEIGHT,
    );
  } else {
    img.setDisplaySize(
      STREETLIGHT_DISPLAY_HEIGHT * 0.45,
      STREETLIGHT_DISPLAY_HEIGHT,
    );
  }
  img.setDepth(streetlightRenderDepth(light));
  return img;
}

export function streetlightRenderDepth(light: StreetlightInfo): number {
  const base = entityRenderDepth(light.ox + 0.5, light.oy + 0.5);
  return applyBuildingStreetlightDepth(base, light.ox, light.oy);
}

function fenceRenderDepth(fence: FenceInfo): number {
  const base =
    entityRenderDepth(fence.ox + 0.5, fence.oy + 0.5) +
    FENCE_DEPTH_BY_FACING[fence.facing];
  return tuckBehindPlayerWalls(
    applyBuildingFenceDepth(base, fence.ox, fence.oy),
    fence.ox,
    fence.oy,
  );
}

function fenceCornerRenderDepth(
  ox: number,
  oy: number,
  corner: FenceCorner,
): number {
  const base = entityRenderDepth(ox + 0.5, oy + 0.5) + FENCE_DEPTH_BY_CORNER[corner];
  return tuckBehindPlayerWalls(
    applyBuildingFenceDepth(base, ox, oy),
    ox,
    oy,
  );
}

function fenceDisplaySize(): number {
  return (
    FENCE_SRC_SIZE *
    (((TILE_WIDTH / 2) / FENCE_CONTENT_SPAN_X) * FENCE_SEAM_BLEED)
  );
}

/** Straight fence panel centred on its occupied (blocked) tile. */
export function createFenceSprite(
  scene: Phaser.Scene,
  fence: FenceInfo,
): Phaser.GameObjects.Image {
  const pos = cartesianToIso(fence.ox + 0.5, fence.oy + 0.5);
  const display = fenceDisplaySize();
  const key = fenceTextureKey(fence.facing);
  const texture = scene.textures.exists(key) ? key : "__DEFAULT";
  const img = scene.add.image(pos.x, pos.y, texture);
  img.setOrigin(FENCE_ORIGIN_X, FENCE_ORIGIN_Y);
  img.setDisplaySize(display, display);
  img.setDepth(fenceRenderDepth(fence));
  return img;
}

/** Single corner asset when two facings share a tile. */
export function createFenceCornerSprite(
  scene: Phaser.Scene,
  ox: number,
  oy: number,
  corner: FenceCorner,
): Phaser.GameObjects.Image {
  const pos = cartesianToIso(ox + 0.5, oy + 0.5);
  const display = fenceDisplaySize();
  const key = fenceCornerTextureKey(corner);
  const texture = scene.textures.exists(key) ? key : "__DEFAULT";
  const img = scene.add.image(pos.x, pos.y, texture);
  img.setOrigin(FENCE_ORIGIN_X, FENCE_ORIGIN_Y);
  img.setDisplaySize(display, display);
  img.setDepth(fenceCornerRenderDepth(ox, oy, corner));
  return img;
}

/**
 * Draw a single road or pavement diamond centred on tile (x, y).
 * Uses tile-centre isometric coords (same as interior floors) plus a small
 * bleed so adjacent diamonds overlap cleanly with no gaps or half-tile seams.
 */
function fillStreetDiamond(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  hw: number,
  hh: number,
  color: number,
) {
  g.fillStyle(color, 1);
  g.beginPath();
  g.moveTo(cx, cy - hh);
  g.lineTo(cx + hw, cy);
  g.lineTo(cx, cy + hh);
  g.lineTo(cx - hw, cy);
  g.closePath();
  g.fillPath();
}

function fillIsoQuad(
  g: Phaser.GameObjects.Graphics,
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
  d: { x: number; y: number },
  color: number,
) {
  g.fillStyle(color, 1);
  g.beginPath();
  g.moveTo(a.x, a.y);
  g.lineTo(b.x, b.y);
  g.lineTo(c.x, c.y);
  g.lineTo(d.x, d.y);
  g.closePath();
  g.fillPath();
}

const WALK_TOP = 0x9a9a8e;
const CURB_SE = 0x7a7a70;
const CURB_SW = 0x88887c;
/** Only stretch open curb ends. Corners stay on the shared vertex. */
const CURB_OPEN_END_PX = 1.25;

function isoCorner(tx: number, ty: number, lift = 0) {
  const p = cartesianToIso(tx, ty);
  return { x: p.x, y: p.y - lift };
}

function isPavementTile(tx: number, ty: number) {
  return streetSurfaceAt(tx, ty) === TileType.Pavement;
}

function hasCurbEast(tx: number, ty: number) {
  return isPavementTile(tx, ty) && isRoadTile(tx + 1, ty);
}

function hasCurbSouth(tx: number, ty: number) {
  return isPavementTile(tx, ty) && isRoadTile(tx, ty + 1);
}

function hasCurbNorth(tx: number, ty: number) {
  return isPavementTile(tx, ty) && isRoadTile(tx, ty - 1);
}

function hasCurbWest(tx: number, ty: number) {
  return isPavementTile(tx, ty) && isRoadTile(tx - 1, ty);
}

function extendSegmentEnds(
  a: { x: number; y: number },
  b: { x: number; y: number },
  padA: number,
  padB: number,
) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return { a, b };
  const ux = dx / len;
  const uy = dy / len;
  return {
    a: { x: a.x - ux * padA, y: a.y - uy * padA },
    b: { x: b.x + ux * padB, y: b.y + uy * padB },
  };
}

/** One parallelogram for a whole sidewalk edge, not one quad per tile. */
function fillCurbRun(
  g: Phaser.GameObjects.Graphics,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color: number,
  padStart: number,
  padEnd: number,
) {
  const top = extendSegmentEnds(
    isoCorner(x0, y0),
    isoCorner(x1, y1),
    padStart,
    padEnd,
  );
  const road = extendSegmentEnds(
    isoCorner(x0, y0, -STREET_RECESS),
    isoCorner(x1, y1, -STREET_RECESS),
    padStart,
    padEnd,
  );
  fillIsoQuad(g, top.a, top.b, road.b, road.a, color);
}

function curbEndPad(isCorner: boolean) {
  return isCorner ? 0 : CURB_OPEN_END_PX;
}

function drawCurbRunsThrough(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
) {
  if (hasCurbSouth(x, y)) {
    let x0 = x;
    let x1 = x;
    while (hasCurbSouth(x0 - 1, y)) x0--;
    while (hasCurbSouth(x1 + 1, y)) x1++;
    fillCurbRun(
      g,
      x0,
      y + 1,
      x1 + 1,
      y + 1,
      CURB_SW,
      curbEndPad(hasCurbWest(x0, y)),
      curbEndPad(hasCurbEast(x1, y)),
    );
  }
  if (hasCurbEast(x, y)) {
    let y0 = y;
    let y1 = y;
    while (hasCurbEast(x, y0 - 1)) y0--;
    while (hasCurbEast(x, y1 + 1)) y1++;
    fillCurbRun(
      g,
      x + 1,
      y0,
      x + 1,
      y1 + 1,
      CURB_SE,
      curbEndPad(hasCurbNorth(x, y0)),
      curbEndPad(hasCurbSouth(x, y1)),
    );
  }

  // Only the camera-facing SE/SW lips. NE/NW sit behind the walk top.
  if (hasCurbSouth(x, y) && hasCurbEast(x, y)) {
    fillCurbCornerCap(g, x + 1, y + 1, CURB_SW);
  }
}

function fillCurbCornerCap(
  g: Phaser.GameObjects.Graphics,
  tx: number,
  ty: number,
  color: number,
) {
  const top = isoCorner(tx, ty);
  const road = isoCorner(tx, ty, -STREET_RECESS);
  fillIsoQuad(
    g,
    { x: top.x - 0.6, y: top.y },
    { x: top.x + 0.6, y: top.y },
    { x: road.x + 0.6, y: road.y },
    { x: road.x - 0.6, y: road.y },
    color,
  );
}

function drawPavementTile(g: Phaser.GameObjects.Graphics, x: number, y: number) {
  const n = isoCorner(x, y);
  const e = isoCorner(x + 1, y);
  const s = isoCorner(x + 1, y + 1);
  const w = isoCorner(x, y + 1);
  fillIsoQuad(g, n, e, s, w, WALK_TOP);
  // Lip last so a later road diamond cannot leave a notch at the tile join.
  drawCurbRunsThrough(g, x, y);
}

function stampPavementAroundRoad(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
) {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      if (isPavementTile(x + dx, y + dy)) {
        drawPavementTile(g, x + dx, y + dy);
      }
    }
  }
}

function drawStreetTile(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  ttype: TileType,
) {
  const hw = (TILE_WIDTH + TILE_DISPLAY_BLEED) / 2;
  const hh = (TILE_HEIGHT + TILE_DISPLAY_BLEED) / 2;

  if (ttype === TileType.Pavement) {
    drawPavementTile(g, x, y);
    return;
  }

  const center = cartesianToIso(x + 0.5, y + 0.5);
  fillStreetDiamond(g, center.x, center.y + STREET_RECESS, hw, hh, 0x3a3b3c);
  stampPavementAroundRoad(g, x, y);
}

/**
 * Draw an entire multi-tile building as one seamless cuboid.
 * The four screen-space corners of the footprint are:
 *   nw = cartesianToIso(ox,   oy)    — north tip
 *   ne = cartesianToIso(ox+w, oy)    — east tip
 *   se = cartesianToIso(ox+w, oy+h)  — south tip
 *   sw = cartesianToIso(ox,   oy+h)  — west tip
 * Walls extrude buildingWallScreenDepth; roofs use the pitched / parapet
 * silhouette (see drawBuildingOcclusionMask) so masks do not fill empty air
 * beside gables.
 */
export function drawBuildingCuboidInto(
  g: Phaser.GameObjects.Graphics,
  bld: {
    ox: number; oy: number; w: number; h: number;
    buildingType?: BuildingType; exteriorLevels?: number;
    entranceX?: number; entranceY?: number;
  },
  leftColor: number,
  rightColor: number,
  roofColor: number,
) {
  // Coloured debug / fallback path still uses a flat top. Occlusion masks go
  // through drawBuildingCuboidMask → drawBuildingOcclusionMask instead.
  const { ox, oy, w, h } = bld;
  const roofTop = buildingWallScreenDepth(bld);

  const nw = cartesianToIso(ox, oy);
  const ne = cartesianToIso(ox + w, oy);
  const se = cartesianToIso(ox + w, oy + h);
  const sw = cartesianToIso(ox, oy + h);

  g.fillStyle(leftColor, 1);
  g.beginPath();
  g.moveTo(sw.x, sw.y);
  g.lineTo(se.x, se.y);
  g.lineTo(se.x, se.y - roofTop);
  g.lineTo(sw.x, sw.y - roofTop);
  g.closePath();
  g.fillPath();

  g.fillStyle(rightColor, 1);
  g.beginPath();
  g.moveTo(ne.x, ne.y);
  g.lineTo(se.x, se.y);
  g.lineTo(se.x, se.y - roofTop);
  g.lineTo(ne.x, ne.y - roofTop);
  g.closePath();
  g.fillPath();

  g.fillStyle(roofColor, 1);
  g.beginPath();
  g.moveTo(nw.x, nw.y - roofTop);
  g.lineTo(ne.x, ne.y - roofTop);
  g.lineTo(se.x, se.y - roofTop);
  g.lineTo(sw.x, sw.y - roofTop);
  g.closePath();
  g.fillPath();
}

/** Solid white building silhouette for BitmapMask occlusion clipping. */
export function drawBuildingCuboidMask(
  g: Phaser.GameObjects.Graphics,
  bld: {
    ox: number; oy: number; w: number; h: number;
    buildingType?: BuildingType; exteriorLevels?: number;
    entranceX?: number; entranceY?: number;
    chimneyX?: number; chimneyY?: number;
  },
) {
  drawBuildingOcclusionMask(g, bld);
}

function tileVertex(bx: number, by: number, corner: "N" | "E" | "S" | "W") {
  const iso = cartesianToIso(bx + 0.5, by + 0.5);
  const hw = TILE_WIDTH / 2;
  const hh = TILE_HEIGHT / 2;
  switch (corner) {
    case "N": return { x: iso.x, y: iso.y - hh };
    case "E": return { x: iso.x + hw, y: iso.y };
    case "S": return { x: iso.x, y: iso.y + hh };
    case "W": return { x: iso.x - hw, y: iso.y };
  }
}

/** Fill the isometric ground diamond of a building's tile footprint. */
export function fillIsoFootprint(
  g: Phaser.GameObjects.Graphics,
  bld: { ox: number; oy: number; w: number; h: number },
  color = 0xffffff,
  alpha = 1,
) {
  const pts = isoFootprintOutlinePoints(bld);
  if (pts.length < 3) return;
  g.fillStyle(color, alpha);
  g.beginPath();
  g.moveTo(pts[0]!.x, pts[0]!.y);
  for (let i = 1; i < pts.length; i++) {
    g.lineTo(pts[i]!.x, pts[i]!.y);
  }
  g.closePath();
  g.fillPath();
}

/**
 * Ground footprint plus the two camera-facing outer walls. Fire-light puddles
 * use this as an inverted clip so glow stops at an enterable building's
 * exterior instead of washing over the cuboid.
 */
export function fillBuildingOuterBoundary(
  g: Phaser.GameObjects.Graphics,
  bld: {
    ox: number;
    oy: number;
    w: number;
    h: number;
    buildingType?: BuildingType;
    exteriorLevels?: number;
  },
) {
  fillIsoFootprint(g, bld);
  const d = buildingWallScreenDepth(bld);
  if (d <= 0) return;
  const { ox, oy, w, h } = bld;
  const ne = cartesianToIso(ox + w, oy);
  const se = cartesianToIso(ox + w, oy + h);
  const sw = cartesianToIso(ox, oy + h);
  g.fillStyle(0xffffff, 1);
  g.beginPath();
  g.moveTo(sw.x, sw.y);
  g.lineTo(se.x, se.y);
  g.lineTo(se.x, se.y - d);
  g.lineTo(sw.x, sw.y - d);
  g.closePath();
  g.fillPath();
  g.beginPath();
  g.moveTo(ne.x, ne.y);
  g.lineTo(se.x, se.y);
  g.lineTo(se.x, se.y - d);
  g.lineTo(ne.x, ne.y - d);
  g.closePath();
  g.fillPath();
}

/** Clockwise outer perimeter of a w×h tile footprint in isometric screen space. */
export function isoFootprintOutlinePoints(bld: {
  ox: number;
  oy: number;
  w: number;
  h: number;
}) {
  const { ox, oy, w, h } = bld;
  const pts: { x: number; y: number }[] = [];

  // Top edge — north tip then east vertices along the top row
  pts.push(tileVertex(ox, oy, "N"));
  for (let bx = ox; bx < ox + w - 1; bx++) {
    pts.push(tileVertex(bx, oy, "E"));
  }
  pts.push(tileVertex(ox + w - 1, oy, "E"));

  // Right edge — south vertices down the right column
  for (let by = oy; by < oy + h - 1; by++) {
    pts.push(tileVertex(ox + w - 1, by, "S"));
  }
  pts.push(tileVertex(ox + w - 1, oy + h - 1, "S"));

  // Bottom edge — west vertices along the bottom row (right to left)
  for (let bx = ox + w - 1; bx > ox; bx--) {
    pts.push(tileVertex(bx, oy + h - 1, "W"));
  }
  pts.push(tileVertex(ox, oy + h - 1, "W"));

  // Left edge — north vertices up the left column (bottom to top, excluding start)
  for (let by = oy + h - 1; by > oy; by--) {
    pts.push(tileVertex(ox, by, "N"));
  }

  return pts;
}

/** Stroke the outer perimeter of a w×h footprint (no internal tile borders). */
export function strokeIsoFootprintOutline(
  graphics: Phaser.GameObjects.Graphics,
  ox: number,
  oy: number,
  w: number,
  h: number,
  color = 0xffee44,
  alpha = 0.9,
) {
  graphics.clear();
  const pts = isoFootprintOutlinePoints({ ox, oy, w, h });
  if (pts.length < 3) return;
  graphics.lineStyle(2, color, alpha);
  graphics.beginPath();
  graphics.moveTo(pts[0]!.x, pts[0]!.y);
  for (let i = 1; i < pts.length; i++) {
    graphics.lineTo(pts[i]!.x, pts[i]!.y);
  }
  graphics.closePath();
  graphics.strokePath();
}

/** Soft-culled building canvases kept for reuse (LRU by Map insertion order). */
/** Soft-culled cuboids kept as invisible textures for reuse (LRU). */
// BUILDING_CUBOID_CACHE_MAX imported from gameConfig.


type TrackedBuilding = {
  cuboid: BuildingCuboidObject;
  ox: number;
  oy: number;
  w: number;
  h: number;
};

/** Supersampling a tier would be painted at right now. `far` is never baked. */
function bakeScaleFor(lod: BuildingLod): number {
  return lodScale(lod === "far" ? "mid" : lod);
}

/** Higher is more detailed. Used so a better bake is never thrown away. */
function lodRank(lod: BuildingLod): number {
  if (lod === "near") return 2;
  if (lod === "mid") return 1;
  return 0;
}

/**
 * Detail tier for a building at `dist` tiles from the player.
 *
 * Only `near` and `mid` are intentional. `far` (untextured solid) used to
 * kick in past mid-range, which is the "3D, then a wave flattens the city"
 * bug: first create often baked at near (distance 0 while lastSyncTile was
 * still NaN, or the player was close), then this refresh replaced those
 * Images with Graphics.
 *
 * `current` biases the near threshold outward so a building on the boundary
 * does not flip every step.
 */
function buildingLodForDistance(
  dist: number,
  current?: BuildingLod,
): Exclude<BuildingLod, "far"> {
  const h = BUILDING_LOD_HYSTERESIS_TILES;
  const nearEdge =
    current === "near" ? BUILDING_LOD_NEAR_TILES + h : BUILDING_LOD_NEAR_TILES;
  if (dist <= nearEdge) return "near";
  return "mid";
}

type TrackedStreetChunk = {
  graphics: Phaser.GameObjects.Graphics;
  /** Tile keys actually drawn into this chunk (road/pavement only). */
  tiles: Set<string>;
};

export class WorldTileManager {
  private drawn = new Set<string>();
  /** Minimap colors for tiles currently in the render square. */
  private minimapKinds = new Map<string, MinimapTileKind>();
  private drawnBuildings = new Set<string>();
  private groundLayer: Phaser.GameObjects.Container;
  /** Grass / concrete sit behind streets so bleed cannot cover sidewalk edges. */
  private grassLayer: Phaser.GameObjects.Container;
  private streetLayer: Phaser.GameObjects.Container;
  /** Open grass sprites keyed by tileKey. */
  private grassTiles = new Map<string, Phaser.GameObjects.Image>();
  /** Tree-underlay grass sprites keyed by tileKey. */
  private treeGroundTiles = new Map<string, Phaser.GameObjects.Image>();
  private streetChunks = new Map<string, TrackedStreetChunk>();
  /** Sparse dirt/debris/plant decals on road and pavement tiles. */
  private streetDecalObjects = new Map<string, Phaser.GameObjects.Image>();
  /** Candidate rain-puddle tiles (road / pavement / concrete). */
  private puddleSites = new Map<string, PuddleSpec>();
  private puddleObjects = new Map<string, PuddleSprite>();
  /** Building cuboids keyed by origin tileKey, with footprint for accurate culling. */
  private buildingObjects = new Map<string, TrackedBuilding>();
  /**
   * Soft-culled buildings — textures kept, displays hidden.
   * Map insertion order is LRU (oldest = first key).
   */
  private buildingCache = new Map<string, TrackedBuilding>();
  /** Ground-edge decals keyed by building origin tileKey. */
  private edgeDecalObjects = new Map<string, Phaser.GameObjects.Image>();
  /** Tree sprites keyed by tileKey. */
  private treeObjects = new Map<string, Phaser.GameObjects.Image>();
  /** Streetlight sprites keyed by tileKey. */
  private streetlightObjects = new Map<string, Phaser.GameObjects.Image>();
  /** Fence sprites keyed by `tx,ty,facing`. */
  private fenceObjects = new Map<string, Phaser.GameObjects.Image>();
  private buildingHighlight: Phaser.GameObjects.Graphics;
  private interactionHighlight: Phaser.GameObjects.Graphics;
  /** High-depth copy of the loot diamond, masked to building/tree pixels. */
  private interactionHighlightOccluded: Phaser.GameObjects.Graphics;
  private interactionOcclusionMask: BuildingOcclusionMask;
  /** Player tile at the last cull pass (throttled). */
  private lastSyncTile = { x: NaN, y: NaN };
  /** Live player tile for LOD. Updated every sync, not only on the 2-tile cull step. */
  private lodTile = { x: NaN, y: NaN };
  /** Last drawn/culled view AABB. */
  private view: ViewRect = { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  private lastView: ViewRect = { minX: NaN, maxX: NaN, minY: NaN, maxY: NaN };
  /**
   * Camera rect in world pixels from the last sync, for the near-bake screen
   * test. Tile rects cannot serve: the screen maps to a diamond in tile space,
   * which is the whole reason distance overspent the bake budget.
   */
  private cameraView: ViewRect | null = null;
  /** True while an interior is showing, so nothing exterior is on screen. */
  private overworldHidden = false;
  /** True while the render square still has undrawn tile keys. */
  private tilesRemainingInRegion = true;
  /** Resume point for incremental full-region sync. */
  private syncCursor: SyncCursor = { x: 0, y: 0, regionKey: "" };
  /**
   * Newly exposed rows and columns. Painted before a finished view is walked
   * again, from the inner edge outward, so a zoom-out fills the hole the
   * player can see first.
   */
  private edgeBands: EdgeBand[] = [];
  private edgeBandIndex = 0;
  /** Buildings discovered while ground was filling. Baked nearest first. */
  private deferredBuildings = new Map<string, BuildingInfo>();
  /** Coarser bake tier waiting for the wheel to settle. */
  private pendingCoarserBake: { tier: BakeZoomTier; since: number } | null = null;

  constructor(private scene: Phaser.Scene) {
    this.groundLayer = scene.add.container(0, 0);
    this.groundLayer.setDepth(GROUND_LAYER_DEPTH);
    this.grassLayer = scene.add.container(0, 0);
    this.streetLayer = scene.add.container(0, 0);
    this.groundLayer.add([this.grassLayer, this.streetLayer]);
    this.buildingHighlight = scene.add.graphics();
    this.interactionHighlight = scene.add.graphics();
    this.interactionHighlightOccluded = scene.add.graphics();
    this.interactionHighlightOccluded.setDepth(OCCLUSION_OVERLAY_DEPTH);
    this.interactionHighlightOccluded.setVisible(false);
    this.interactionOcclusionMask = new BuildingOcclusionMask(scene);
  }

  setOverworldVisible(visible: boolean) {
    this.overworldHidden = !visible;
    this.groundLayer.setVisible(visible);
    for (const chunk of this.streetChunks.values()) chunk.graphics.setVisible(visible);
    for (const b of this.buildingObjects.values()) b.cuboid.display.setVisible(visible);
    for (const b of this.buildingCache.values()) b.cuboid.display.setVisible(false);
    for (const t of this.treeObjects.values()) t.setVisible(visible);
    for (const s of this.streetlightObjects.values()) s.setVisible(visible);
    for (const f of this.fenceObjects.values()) f.setVisible(visible);
    for (const d of this.edgeDecalObjects.values()) d.setVisible(visible);
    for (const d of this.streetDecalObjects.values()) d.setVisible(visible);
    for (const p of this.puddleObjects.values()) {
      p.body.setVisible(visible && p.appear > 0.01);
      p.shine.setVisible(visible && p.appear > 0.01);
    }
    if (!visible) {
      this.buildingHighlight.clear();
      this.clearInteractionHighlight();
    }
  }

  /**
   * Hard-free overworld display objects + building textures.
   * Used on mobile when entering an interior so exterior VRAM isn't held idle.
   */
  purgeOverworld() {
    this.view = { minX: 1e9, maxX: 1e9, minY: 1e9, maxY: 1e9 };
    this.cullFarObjects();
    for (const [key, entry] of this.buildingCache) {
      destroyBuildingCuboid(this.scene, entry.cuboid);
      this.destroyEdgeDecals(key);
    }
    this.buildingCache.clear();
    for (const key of [...this.edgeDecalObjects.keys()]) {
      this.destroyEdgeDecals(key);
    }
    for (const key of [...this.streetDecalObjects.keys()]) {
      this.destroyStreetDecal(key);
    }
    for (const key of [...this.puddleObjects.keys()]) {
      this.destroyPuddle(key);
    }
    this.puddleSites.clear();
    this.lastSyncTile = { x: NaN, y: NaN };
    this.lodTile = { x: NaN, y: NaN };
    this.tilesRemainingInRegion = true;
    this.syncCursor = { x: 0, y: 0, regionKey: "" };
    this.edgeBands = [];
    this.edgeBandIndex = 0;
    this.deferredBuildings.clear();
    this.pendingCoarserBake = null;
    purgeIdleBuildingTextures(this.scene);
  }

  /**
   * Soft exterior VRAM reclaim — never touches grass/street in the live view.
   * Destroys buildings whose footprint lies entirely outside
   * `view ∪ player±radius` expanded by hysteresis, then shrinks idle pool
   * canvases. Spreads work across frames via `budget`.
   * @returns true if more purge work remains.
   */
  softPurgeFarBuildings(
    playerTileX: number,
    playerTileY: number,
    budget = EXTERIOR_PURGE_BUILDINGS_PER_FRAME,
  ): boolean {
    if (!Number.isFinite(playerTileX) || !Number.isFinite(playerTileY)) {
      return false;
    }
    if (budget <= 0) return false;

    const h = EXTERIOR_PURGE_HYSTERESIS_TILES;
    const view = this.hasActiveRenderView()
      ? this.view
      : {
          minX: playerTileX - CLIENT_RENDER_RADIUS,
          maxX: playerTileX + CLIENT_RENDER_RADIUS,
          minY: playerTileY - CLIENT_RENDER_RADIUS,
          maxY: playerTileY + CLIENT_RENDER_RADIUS,
        };

    // Keep anything near the drawn view OR near the player (whichever is wider).
    const keep: ViewRect = {
      minX:
        Math.min(view.minX, playerTileX - CLIENT_RENDER_RADIUS) - h,
      maxX:
        Math.max(view.maxX, playerTileX + CLIENT_RENDER_RADIUS) + h,
      minY:
        Math.min(view.minY, playerTileY - CLIENT_RENDER_RADIUS) - h,
      maxY:
        Math.max(view.maxY, playerTileY + CLIENT_RENDER_RADIUS) + h,
    };

    const outsideKeep = (
      ox: number,
      oy: number,
      w: number,
      hgt: number,
    ) => {
      const maxX = ox + w - 1;
      const maxY = oy + hgt - 1;
      return (
        maxX < keep.minX ||
        ox > keep.maxX ||
        maxY < keep.minY ||
        oy > keep.maxY
      );
    };

    let remaining = budget;

    // Live buildings far outside the keep ring.
    if (remaining > 0) {
      const toRemove: string[] = [];
      for (const [key, bld] of this.buildingObjects) {
        if (!outsideKeep(bld.ox, bld.oy, bld.w, bld.h)) continue;
        toRemove.push(key);
        if (toRemove.length >= remaining) break;
      }
      for (const key of toRemove) {
        const bld = this.buildingObjects.get(key);
        if (!bld) continue;
        destroyBuildingCuboid(this.scene, bld.cuboid);
        this.destroyEdgeDecals(key);
        this.buildingObjects.delete(key);
        this.drawnBuildings.delete(key);
        const maxX = bld.ox + bld.w - 1;
        const maxY = bld.oy + bld.h - 1;
        for (let ty = bld.oy; ty <= maxY; ty++) {
          for (let tx = bld.ox; tx <= maxX; tx++) {
            const tKey = tileKey(tx, ty);
            this.drawn.delete(tKey);
            this.minimapKinds.delete(tKey);
          }
        }
        remaining -= 1;
      }
    }

    // Soft-culled desktop cache entries outside the keep ring.
    if (remaining > 0 && this.buildingCache.size > 0) {
      const cacheRemove: string[] = [];
      for (const [key, bld] of this.buildingCache) {
        if (!outsideKeep(bld.ox, bld.oy, bld.w, bld.h)) continue;
        cacheRemove.push(key);
        if (cacheRemove.length >= remaining) break;
      }
      for (const key of cacheRemove) {
        const entry = this.buildingCache.get(key);
        this.buildingCache.delete(key);
        if (entry) destroyBuildingCuboid(this.scene, entry.cuboid);
        this.destroyEdgeDecals(key);
        remaining -= 1;
      }
    }

    // Released textures only cost bytes until the budget wants them back.
    if (remaining > 0) evictIdleBuildingTextures(this.scene);

    for (const bld of this.buildingObjects.values()) {
      if (outsideKeep(bld.ox, bld.oy, bld.w, bld.h)) return true;
    }
    for (const bld of this.buildingCache.values()) {
      if (outsideKeep(bld.ox, bld.oy, bld.w, bld.h)) return true;
    }
    return false;
  }

  /**
   * Highlight the outer perimeter of the building that contains (tx, ty).
   * Pass null to clear.
   */
  highlightBuilding(tx: number | null, ty: number | null) {
    this.buildingHighlight.clear();
    if (tx === null || ty === null) return;
    const bld = getBuildingAt(tx, ty);
    if (!bld) return;

    const pts = isoFootprintOutlinePoints(bld);
    if (pts.length < 3) return;

    this.buildingHighlight.setDepth(
      buildingWallDepth(bld) + 1,
    );
    this.buildingHighlight.lineStyle(2, 0xffee44, 0.85);
    this.buildingHighlight.beginPath();
    this.buildingHighlight.moveTo(pts[0]!.x, pts[0]!.y);
    for (let i = 1; i < pts.length; i++) {
      this.buildingHighlight.lineTo(pts[i]!.x, pts[i]!.y);
    }
    this.buildingHighlight.closePath();
    this.buildingHighlight.strokePath();
  }

  private clearInteractionHighlight() {
    this.interactionHighlight.clear();
    this.interactionHighlightOccluded.clearMask();
    this.interactionHighlightOccluded.clear();
    this.interactionHighlightOccluded.setVisible(false);
    this.interactionOcclusionMask.clear();
  }

  /** Orange diamond on a ground tile (loot / interact). Pass null to clear. */
  highlightInteractionTile(tx: number | null, ty: number | null) {
    if (tx === null || ty === null) {
      this.clearInteractionHighlight();
      return;
    }

    // Same band as interior furniture hover — above floor, behind furniture /
    // entities so the outline sits under backpacks and future overworld props.
    this.interactionHighlight.clearMask();
    this.interactionHighlight.setDepth(tileIndicatorDepth(tx, ty));
    strokeIsoTileOutline(this.interactionHighlight, tx, ty);

    // Dual masked layer unused for loot — full outline must stay readable.
    this.interactionHighlightOccluded.clearMask();
    this.interactionHighlightOccluded.clear();
    this.interactionHighlightOccluded.setVisible(false);
    this.interactionOcclusionMask.clear();
  }

  private streetChunkKey(x: number, y: number): string {
    const chunkX = Math.floor(x / STREET_CHUNK_SIZE) * STREET_CHUNK_SIZE;
    const chunkY = Math.floor(y / STREET_CHUNK_SIZE) * STREET_CHUNK_SIZE;
    return `${chunkX},${chunkY}`;
  }

  private getStreetChunk(x: number, y: number): TrackedStreetChunk {
    const key = this.streetChunkKey(x, y);
    let chunk = this.streetChunks.get(key);
    if (!chunk) {
      const chunkX = Math.floor(x / STREET_CHUNK_SIZE) * STREET_CHUNK_SIZE;
      const chunkY = Math.floor(y / STREET_CHUNK_SIZE) * STREET_CHUNK_SIZE;
      const graphics = this.scene.add.graphics();
      graphics.setDepth(groundSortDepth(chunkX, chunkY));
      this.streetLayer.add(graphics);
      chunk = { graphics, tiles: new Set() };
      this.streetChunks.set(key, chunk);
    }
    return chunk;
  }

  private destroyGroundTile(key: string) {
    const grass = this.grassTiles.get(key);
    if (grass) {
      this.grassLayer.remove(grass, true);
      this.grassTiles.delete(key);
      return;
    }

    const treeTile = this.treeGroundTiles.get(key);
    if (treeTile) {
      this.grassLayer.remove(treeTile, true);
      this.treeGroundTiles.delete(key);
    }
  }

  /** Re-apply tree/streetlight↔building depth after a cuboid appears. */
  private refreshTreeDepthsNearBuilding(bld: {
    ox: number;
    oy: number;
    w: number;
    h: number;
  }) {
    const pad = ENTITY_BUILDING_DEPTH_REACH;
    for (let ty = bld.oy - pad; ty < bld.oy + bld.h + pad; ty++) {
      for (let tx = bld.ox - pad; tx < bld.ox + bld.w + pad; tx++) {
        const key = tileKey(tx, ty);
        const treeImg = this.treeObjects.get(key);
        if (treeImg) {
          const tree = getTreeAt(tx, ty);
          if (tree) treeImg.setDepth(treeRenderDepth(tree));
        }
        const lightImg = this.streetlightObjects.get(key);
        if (lightImg) {
          const light = getStreetlightAt(tx, ty);
          if (light) lightImg.setDepth(streetlightRenderDepth(light));
        }
      }
    }
  }

  /** Keep live tree/streetlight depths in sync if building order changes. */
  private refreshAllTreeDepths() {
    for (const [key, img] of this.treeObjects) {
      const comma = key.indexOf(",");
      const tx = parseInt(key.slice(0, comma), 10);
      const ty = parseInt(key.slice(comma + 1), 10);
      const tree = getTreeAt(tx, ty);
      if (tree) img.setDepth(treeRenderDepth(tree));
    }
    for (const [key, img] of this.streetlightObjects) {
      const comma = key.indexOf(",");
      const tx = parseInt(key.slice(0, comma), 10);
      const ty = parseInt(key.slice(comma + 1), 10);
      const light = getStreetlightAt(tx, ty);
      if (light) img.setDepth(streetlightRenderDepth(light));
    }
  }

  /**
   * Player walls changed. Re-read tree and yard-fence depths so a panel that
   * was lifted with a nearby tree slips back under the wall in front of it.
   */
  refreshPlayerWallOcclusion() {
    for (const [key, img] of this.treeObjects) {
      const comma = key.indexOf(",");
      const tx = parseInt(key.slice(0, comma), 10);
      const ty = parseInt(key.slice(comma + 1), 10);
      const tree = getTreeAt(tx, ty);
      if (!tree) continue;
      const depth = treeRenderDepth(tree);
      if (img.depth !== depth) img.setDepth(depth);
    }
    for (const [key, img] of this.fenceObjects) {
      const depth = this.depthForFenceObject(key);
      if (img.depth !== depth) img.setDepth(depth);
    }
  }

  private depthForFenceObject(key: string): number {
    const parts = key.split(",");
    const ox = Number(parts[0]);
    const oy = Number(parts[1]);
    const tag = parts[2] ?? "";
    if (tag === "NE" || tag === "NW" || tag === "SE" || tag === "SW") {
      return fenceRenderDepth({ ox, oy, facing: tag });
    }
    return fenceCornerRenderDepth(ox, oy, tag as FenceCorner);
  }

  /**
   * Mark a tree felled and play Falling_0001–0008 (holds on 0008).
   * `animate=false` snaps to the final frame (join sync / off-screen).
   */
  /**
   * A chop started here: make sure this tree's fall frames are resident.
   *
   * Called on the first axe swing, several seconds before the tree moves, so the
   * animation is ready without paying for it at boot.
   */
  prepareTreeFall(tx: number, ty: number) {
    const tree = getTreeAt(tx, ty);
    if (!tree) return;
    ensureTreeFallFrames(this.scene, tree.variant);
  }

  applyTreeFelled(tx: number, ty: number, animate = true) {
    markTreeFelled(tx, ty);
    const tree = getTreeAt(tx, ty);
    if (!tree) return;
    const key = tileKey(tx, ty);
    let img = this.treeObjects.get(key);
    if (!img) {
      this.destroyGroundTile(key);
      const ground = createGroundTile(this.scene, tx, ty, this.grassLayer);
      if (ground) this.treeGroundTiles.set(key, ground);
      img = createTreeSprite(this.scene, tree, { felled: true });
      this.treeObjects.set(key, img);
      this.minimapKinds.set(key, "floor");
      this.drawn.add(key);
      return;
    }
    if (!animate) {
      applyTreeTexture(
        this.scene,
        img,
        resolveTreeFallTexture(this.scene, tree.variant, TREE_FALL_FRAMES),
      );
      return;
    }
    // Fall frames not resident: the chop began before we were watching (join,
    // or a rejoin mid-chop), so there was no prepareTreeFall. Snap to the
    // resting frame rather than flickering the standing sprite through eight
    // steps, and request the frames for the next tree.
    if (!this.scene.textures.exists(treeFallTextureKey(tree.variant, 1))) {
      ensureTreeFallFrames(this.scene, tree.variant);
      applyTreeTexture(
        this.scene,
        img,
        resolveTreeFallTexture(this.scene, tree.variant, TREE_FALL_FRAMES),
      );
      return;
    }

    let frame = 1;
    const step = () => {
      if (!this.treeObjects.has(key) || this.treeObjects.get(key) !== img) return;
      applyTreeTexture(
        this.scene,
        img!,
        resolveTreeFallTexture(this.scene, tree.variant, frame),
      );
      if (frame >= TREE_FALL_FRAMES) return;
      frame++;
      this.scene.time.delayedCall(TREE_FALL_FRAME_MS, step);
    };
    step();
  }

  /**
   * Returns true when the region still has undrawn tiles to register.
   * @param persistCursor when false, one-shot pass (priority ring) that does not
   *   move the regional resume cursor.
   * @param skipDrawnCheap when true, already-drawn tiles do not consume the visit
   *   budget (safe for small priority rings only).
   * @param preferX/preferY resume origin when the view AABB changes, so sprinting
   *   does not restart the scan at the NW corner every few tiles.
   */
  private syncTileRegion(
    minX: number,
    maxX: number,
    minY: number,
    maxY: number,
    opts?: {
      persistCursor?: boolean;
      skipDrawnCheap?: boolean;
      preferX?: number;
      preferY?: number;
      timeBudgetMs?: number;
      tileBudget?: number;
      cursor?: SyncCursor;
      budget?: FillBudget;
      /** Queue cold building bakes instead of stopping the ground scan. */
      deferBuildings?: boolean;
    },
  ): boolean {
    if (minX > maxX || minY > maxY) return false;

    const persistCursor = opts?.persistCursor !== false;
    const skipDrawnCheap = opts?.skipDrawnCheap === true;
    const regionKey = `${minX},${maxX},${minY},${maxY}`;
    const cursor = opts?.cursor ?? this.syncCursor;
    const budget = opts?.budget ?? {
      tiles: opts?.tileBudget ?? TILES_PER_SYNC,
      buildings: BUILDINGS_PER_SYNC,
      solids: SOLID_BUILDINGS_PER_SYNC,
      deadline:
        performance.now() + (opts?.timeBudgetMs ?? (IS_MOBILE ? 6 : 10)),
      cheapSkips: 0,
    };
    const saveCursor = (x: number, y: number) => {
      if (!persistCursor) return;
      cursor.x = x;
      cursor.y = y;
      cursor.regionKey = regionKey;
    };

    let startX: number;
    let startY: number;
    if (persistCursor) {
      if (cursor.regionKey !== regionKey) {
        let x = cursor.x;
        let y = cursor.y;
        const inside = x >= minX && x <= maxX && y >= minY && y <= maxY;
        // View AABB changed: keep the resume tile when still inside so sprinting
        // does not restart at the NW corner every few tiles (that left void
        // holes until the player stopped). Only cold-start / OOB uses prefer*.
        if (!inside) {
          if (
            opts?.preferX !== undefined &&
            opts?.preferY !== undefined &&
            Number.isFinite(opts.preferX) &&
            Number.isFinite(opts.preferY)
          ) {
            x = Math.min(Math.max(Math.floor(opts.preferX), minX), maxX);
            y = Math.min(Math.max(Math.floor(opts.preferY), minY), maxY);
          } else {
            x = minX;
            y = minY;
          }
        }
        cursor.x = x;
        cursor.y = y;
        cursor.regionKey = regionKey;
      }
      startX = cursor.x;
      startY = cursor.y;
    } else {
      startX = minX;
      startY = minY;
    }

    for (let y = startY; y <= maxY; y++) {
      for (let x = y === startY ? startX : minX; x <= maxX; x++) {
        // Undrawn visits always count against the tile cap and the deadline.
        // Drawn visits can be skipped cheaply, but a cap and a sampled clock
        // stop a full-view walk from allocating every key in one frame.
        const key = tileKey(x, y);
        const alreadyDrawn = this.drawn.has(key);
        if (alreadyDrawn && skipDrawnCheap) {
          budget.cheapSkips++;
          if (
            budget.cheapSkips >= CHEAP_SKIP_CAP ||
            (budget.cheapSkips % CHEAP_SKIP_STRIDE === 0 &&
              performance.now() >= budget.deadline)
          ) {
            saveCursor(x, y);
            return true;
          }
          continue;
        }
        if (budget.tiles <= 0 || performance.now() >= budget.deadline) {
          saveCursor(x, y);
          return true;
        }
        budget.tiles--;

        if (alreadyDrawn) continue;

        try {
          const ttype = generateTile(x, y);
          if (ttype === TileType.Wall) {
            const bld = getBuildingAt(x, y);
            if (bld) {
              const bldKey = tileKey(bld.ox, bld.oy);
              const resident =
                this.drawnBuildings.has(bldKey) &&
                (this.buildingObjects.has(bldKey) ||
                  this.buildingCache.has(bldKey));
              if (!resident) {
                // Textured bakes are queued. A flat cuboid goes up immediately
                // so the lot is not an empty footprint while that bake waits.
                // Past the solid cap, stop and resume here next frame.
                if (opts?.deferBuildings) {
                  const hasShape =
                    this.buildingObjects.has(bldKey) ||
                    this.buildingCache.has(bldKey);
                  if (!hasShape) {
                    if (
                      budget.solids <= 0 ||
                      performance.now() >= budget.deadline
                    ) {
                      saveCursor(x, y);
                      return true;
                    }
                    budget.solids--;
                    this.placeSolidBuilding(bld);
                  }
                  this.deferredBuildings.set(bldKey, bld);
                  this.drawn.add(key);
                  continue;
                }
                if (budget.buildings <= 0) {
                  saveCursor(x, y);
                  return true;
                }
                budget.buildings--;
                this.placeBuilding(bld);
              }
            } else {
              const light = getStreetlightAt(x, y);
              if (light) {
                const streetUnder =
                  getStreetTileType(x, y) ?? TileType.Pavement;
                this.destroyGroundTile(key);
                const chunk = this.getStreetChunk(x, y);
                drawStreetTile(chunk.graphics, x, y, streetUnder);
                chunk.tiles.add(key);
                this.ensureStreetDecal(x, y, streetUnder);
                this.ensurePuddleSite(x, y);
                if (!this.streetlightObjects.has(key)) {
                  this.streetlightObjects.set(
                    key,
                    createStreetlightSprite(this.scene, light),
                  );
                }
                this.minimapKinds.set(key, "streetlight");
              } else {
                const fences = getFencesAt(x, y);
                if (fences.length > 0) {
                  this.destroyGroundTile(key);
                  if (!this.treeGroundTiles.has(key)) {
                    const ground = createGroundTile(
                      this.scene,
                      x,
                      y,
                      this.grassLayer,
                    );
                    if (ground) this.treeGroundTiles.set(key, ground);
                  }
                  const corner =
                    fences.length >= 2
                      ? fenceCornerFromFacings(
                          fences[0]!.facing,
                          fences[1]!.facing,
                        )
                      : null;
                  if (corner) {
                    const cKey = fenceCornerObjectKey(x, y, corner);
                    if (!this.fenceObjects.has(cKey)) {
                      this.fenceObjects.set(
                        cKey,
                        createFenceCornerSprite(this.scene, x, y, corner),
                      );
                    }
                  } else {
                    for (const fence of fences) {
                      const fKey = fenceObjectKey(fence);
                      if (!this.fenceObjects.has(fKey)) {
                        this.fenceObjects.set(
                          fKey,
                          createFenceSprite(this.scene, fence),
                        );
                      }
                    }
                  }
                  this.minimapKinds.set(key, "floor");
                } else {
                  const tree = getTreeAt(x, y);
                  if (tree && !this.treeObjects.has(key)) {
                    this.destroyGroundTile(key);
                    const ground = createGroundTile(
                      this.scene,
                      x,
                      y,
                      this.grassLayer,
                    );
                    if (ground) this.treeGroundTiles.set(key, ground);
                    this.treeObjects.set(
                      key,
                      createTreeSprite(this.scene, tree, {
                        felled: isTreeFelled(x, y),
                      }),
                    );
                    this.minimapKinds.set(key, "floor");
                  }
                }
              }
            }
          } else if (ttype === TileType.Road || ttype === TileType.Pavement) {
            this.destroyGroundTile(key);
            const chunk = this.getStreetChunk(x, y);
            drawStreetTile(chunk.graphics, x, y, ttype);
            chunk.tiles.add(key);
            this.ensureStreetDecal(x, y, ttype);
            this.ensurePuddleSite(x, y);
            this.minimapKinds.set(
              key,
              ttype === TileType.Road ? "road" : "pavement",
            );
          } else {
            this.destroyGroundTile(key);
            if (!this.grassTiles.has(key)) {
              const baseKey =
                ttype === TileType.Barracks
                  ? "tile-barracks"
                  : ttype === TileType.CarPark
                    ? "tile-concrete"
                    : "tile-ground";
              const tile = createGroundTile(
                this.scene,
                x,
                y,
                this.grassLayer,
                baseKey,
              );
              if (tile) this.grassTiles.set(key, tile);
            }
            if (ttype === TileType.CarPark) this.ensurePuddleSite(x, y);
            // Felled trees are Floor for walkability but keep their fallen sprite.
            const felledTree = getTreeAt(x, y);
            if (
              felledTree &&
              isTreeFelled(x, y) &&
              !this.treeObjects.has(key)
            ) {
              this.treeObjects.set(
                key,
                createTreeSprite(this.scene, felledTree, { felled: true }),
              );
            }
            if (!this.treeObjects.has(key) || isTreeFelled(x, y)) {
              this.minimapKinds.set(
                key,
                ttype === TileType.Barracks
                  ? "barracks"
                  : ttype === TileType.CarPark
                    ? "carpark"
                    : "floor",
              );
            }
          }
          this.drawn.add(key);
        } catch (err) {
          console.error(`Failed to draw tile ${key}`, err);
          // Leave undrawn so a later pass can retry; budget already charged.
        }
      }
    }

    if (persistCursor) {
      cursor.x = minX;
      cursor.y = minY;
      cursor.regionKey = "";
    }
    return false;
  }

  syncBounds(bounds: WorldBounds) {
    this.syncTileRegion(
      bounds.minGlobalX,
      bounds.minGlobalX + bounds.mapWidth - 1,
      bounds.minGlobalY,
      bounds.minGlobalY + bounds.mapHeight - 1,
    );
  }

  /**
   * Hold a coarser bake tier until zoom has sat still. Sharper tiers apply
   * immediately so zooming back in does not leave the city blurry.
   */
  private noteCameraZoom(zoom: number) {
    const tier = bakeZoomTierForZoom(zoom);
    const current = getBakeZoomTier();
    if (tier === current) {
      this.pendingCoarserBake = null;
      return;
    }
    if (tier > current) {
      this.pendingCoarserBake = null;
      setBakeZoomTier(tier);
      return;
    }
    const now = performance.now();
    if (!this.pendingCoarserBake || this.pendingCoarserBake.tier !== tier) {
      this.pendingCoarserBake = { tier, since: now };
      return;
    }
    if (now - this.pendingCoarserBake.since >= BAKE_ZOOM_SETTLE_MS) {
      setBakeZoomTier(tier);
      this.pendingCoarserBake = null;
    }
  }

  private footprintOutsideView(bld: BuildingInfo): boolean {
    const h = CULL_HYSTERESIS_TILES;
    const maxX = bld.ox + bld.w - 1;
    const maxY = bld.oy + bld.h - 1;
    return (
      maxX < this.view.minX - h ||
      bld.ox > this.view.maxX + h ||
      maxY < this.view.minY - h ||
      bld.oy > this.view.maxY + h
    );
  }

  /** Drop a queued building and allow its tiles to be drawn again later. */
  private forgetDeferredBuilding(bld: BuildingInfo) {
    this.deferredBuildings.delete(tileKey(bld.ox, bld.oy));
    if (
      this.buildingObjects.has(tileKey(bld.ox, bld.oy)) ||
      this.buildingCache.has(tileKey(bld.ox, bld.oy))
    ) {
      return;
    }
    this.drawnBuildings.delete(tileKey(bld.ox, bld.oy));
    const maxX = bld.ox + bld.w - 1;
    const maxY = bld.oy + bld.h - 1;
    for (let ty = bld.oy; ty <= maxY; ty++) {
      for (let tx = bld.ox; tx <= maxX; tx++) {
        const key = tileKey(tx, ty);
        this.drawn.delete(key);
        this.minimapKinds.delete(key);
      }
    }
  }

  private markBuildingFootprintDrawn(bld: BuildingInfo) {
    const maxX = bld.ox + bld.w - 1;
    const maxY = bld.oy + bld.h - 1;
    for (let ty = bld.oy; ty <= maxY; ty++) {
      for (let tx = bld.ox; tx <= maxX; tx++) {
        const key = tileKey(tx, ty);
        this.drawn.add(key);
        this.minimapKinds.set(key, "building");
      }
    }
  }

  /**
   * Flat cuboid so a queued building still has a shape. Edge decals and the
   * textured bake land in placeBuilding.
   */
  private placeSolidBuilding(bld: BuildingInfo): boolean {
    const bldKey = tileKey(bld.ox, bld.oy);
    if (this.buildingObjects.has(bldKey) || this.buildingCache.has(bldKey)) {
      this.markBuildingFootprintDrawn(bld);
      return true;
    }
    const depth = buildingWallDepth(bld);
    try {
      this.buildingObjects.set(bldKey, {
        cuboid: createBuildingCuboid(this.scene, bld, depth, "far"),
        ox: bld.ox,
        oy: bld.oy,
        w: bld.w,
        h: bld.h,
      });
    } catch (err) {
      console.error(`Failed to place solid building ${bldKey}`, err);
      return false;
    }
    this.drawnBuildings.add(bldKey);
    this.markBuildingFootprintDrawn(bld);
    return true;
  }

  /**
   * Create or restore a textured cuboid. A flat stand-in already on the lot
   * is replaced. Returns false only when nothing could be shown.
   */
  private placeBuilding(bld: BuildingInfo): boolean {
    const bldKey = tileKey(bld.ox, bld.oy);
    const live = this.buildingObjects.get(bldKey);
    if (live && !placeholderCuboid(live.cuboid)) {
      this.markBuildingFootprintDrawn(bld);
      return true;
    }
    if (
      this.drawnBuildings.has(bldKey) &&
      !live &&
      !this.buildingCache.has(bldKey)
    ) {
      this.drawnBuildings.delete(bldKey);
    }
    const depth = buildingWallDepth(bld);
    const wantLod = this.lodForBuilding(bld);
    const cached = this.takeCachedBuilding(bldKey);
    let placed: TrackedBuilding | null = null;
    if (cached) {
      cached.cuboid.display.setDepth(depth);
      placed = cached;
    } else {
      try {
        const cuboid = createBuildingCuboid(this.scene, bld, depth, wantLod);
        // Keep the stand-in when the textured bake is refused. Retrying a
        // refusal every frame would spend the bake slots on the same lot.
        if (placeholderCuboid(cuboid) && live) {
          destroyBuildingCuboid(this.scene, cuboid);
          this.markBuildingFootprintDrawn(bld);
          return true;
        }
        placed = {
          cuboid,
          ox: bld.ox,
          oy: bld.oy,
          w: bld.w,
          h: bld.h,
        };
      } catch (err) {
        // A throw must not erase a visible stand-in.
        console.error(`Failed to bake building ${bldKey}`, err);
        if (live) {
          this.markBuildingFootprintDrawn(bld);
          return true;
        }
        return false;
      }
    }
    if (!placed) return false;
    if (live) {
      destroyBuildingCuboid(this.scene, live.cuboid);
      this.buildingObjects.delete(bldKey);
    }
    this.buildingObjects.set(bldKey, placed);
    this.drawnBuildings.add(bldKey);
    this.ensureBuildingEdgeDecals(bld, bldKey);
    this.refreshTreeDepthsNearBuilding(bld);
    this.markBuildingFootprintDrawn(bld);
    return true;
  }

  private edgeWorkPending(): boolean {
    return this.edgeBandIndex < this.edgeBands.length;
  }

  /** Paint queued view-edge strips until the shared frame budget runs out. */
  private drainEdgeBands(budget: FillBudget) {
    if (this.edgeBandIndex > 48) {
      this.edgeBands.splice(0, this.edgeBandIndex);
      this.edgeBandIndex = 0;
    }
    while (this.edgeBandIndex < this.edgeBands.length) {
      if (budget.tiles <= 0 || performance.now() >= budget.deadline) return;
      const band = this.edgeBands[this.edgeBandIndex]!;
      const clipped = intersectView(band, this.view);
      if (!clipped) {
        this.edgeBandIndex++;
        continue;
      }
      const more = this.syncTileRegion(
        clipped.minX,
        clipped.maxX,
        clipped.minY,
        clipped.maxY,
        {
          persistCursor: true,
          skipDrawnCheap: true,
          cursor: band.cursor,
          budget,
          deferBuildings: true,
        },
      );
      if (more) return;
      this.edgeBandIndex++;
    }
    this.edgeBands = [];
    this.edgeBandIndex = 0;
  }

  /**
   * Bake queued buildings, nearest to the player first.
   * Buildings that have left the cull ring are forgotten so a later visit
   * can draw them again.
   */
  private dropOutsideDeferredBuildings() {
    if (this.deferredBuildings.size === 0) return;
    for (const bld of [...this.deferredBuildings.values()]) {
      if (this.footprintOutsideView(bld)) this.forgetDeferredBuilding(bld);
    }
  }

  private drainDeferredBuildings(budget: FillBudget) {
    if (this.deferredBuildings.size === 0 || budget.buildings <= 0) return;
    const pending = [...this.deferredBuildings.values()];
    pending.sort(
      (a, b) =>
        this.buildingDistance(a.ox, a.oy, a.w, a.h) -
        this.buildingDistance(b.ox, b.oy, b.w, b.h),
    );
    for (const bld of pending) {
      if (budget.buildings <= 0 || performance.now() >= budget.deadline) return;
      const key = tileKey(bld.ox, bld.oy);
      if (!this.deferredBuildings.has(key)) continue;
      this.deferredBuildings.delete(key);
      budget.buildings--;
      if (!this.placeBuilding(bld)) this.markBuildingFootprintDrawn(bld);
    }
  }

  /**
   * Draw/cull tiles visible to the camera (desktop) or a fixed radius (mobile).
   * Desktop region = camera frustum + draw margin, capped by RENDER_RADIUS.
   * Cull uses an extra hysteresis ring so chunks aren't destroyed at the edge.
   * @param force treat a 1-tile view change as real (zoom / resize) without
   *   restarting the fill cursor.
   */
  syncAroundPlayer(
    playerTileX: number,
    playerTileY: number,
    _bounds?: WorldBounds,
    camera?: Phaser.Cameras.Scene2D.Camera,
    force = false,
  ) {
    const cx = playerTileX;
    const cy = playerTileY;

    if (!Number.isFinite(cx) || !Number.isFinite(cy)) return;

    // LOD must follow the player every frame. lastSyncTile stays throttled so
    // cull/fill do not restart on sub-tile camera noise.
    this.lodTile = { x: cx, y: cy };
    if (camera) this.noteCameraZoom(camera.zoom);

    let region: ViewRect;
    if (!IS_MOBILE && camera) {
      const world = camera.worldView;
      this.cameraView = {
        minX: world.x,
        maxX: world.x + world.width,
        minY: world.y,
        maxY: world.y + world.height,
      };
      region = clampRegionToPlayerRadius(
        cameraVisibleTileRegion(camera, CAMERA_TILE_PADDING),
        cx,
        cy,
        RENDER_RADIUS,
      );
    } else {
      region = {
        minX: cx - RENDER_RADIUS,
        maxX: cx + RENDER_RADIUS,
        minY: cy - RENDER_RADIUS,
        maxY: cy + RENDER_RADIUS,
      };
    }

    const hadSync =
      Number.isFinite(this.lastSyncTile.x) && Number.isFinite(this.lastSyncTile.y);
    const prevX = this.lastSyncTile.x;
    const prevY = this.lastSyncTile.y;
    const hadView = Number.isFinite(this.lastView.minX);
    const prevView = this.lastView;
    // Pin before any create. Distance 0 while lastSyncTile is unset bakes every
    // building at near, then the refresh wave flattens the ones that are not.
    if (!hadSync) this.lastSyncTile = { x: cx, y: cy };

    const playerMoved =
      !hadSync ||
      Math.abs(cx - prevX) >= SYNC_MOVE_THRESHOLD ||
      Math.abs(cy - prevY) >= SYNC_MOVE_THRESHOLD;
    // Camera float must not retrigger cull. Zoom passes force so a 1-tile
    // growth still opens an edge strip.
    const viewSlack = force ? 1 : 4;
    const rectChanged =
      !hadView ||
      Math.abs(region.minX - prevView.minX) >= viewSlack ||
      Math.abs(region.maxX - prevView.maxX) >= viewSlack ||
      Math.abs(region.minY - prevView.minY) >= viewSlack ||
      Math.abs(region.maxY - prevView.maxY) >= viewSlack;
    const viewStale = playerMoved || rectChanged;
    const fillPending =
      this.tilesRemainingInRegion ||
      this.edgeWorkPending() ||
      this.deferredBuildings.size > 0;

    // Stable view with nothing queued: a short underfoot pass, then warm
    // worldgen while the paint budget is free.
    if (!viewStale && !fillPending) {
      this.syncTileRegion(
        Math.max(this.view.minX, cx - PRIORITY_FILL_RADIUS),
        Math.min(this.view.maxX, cx + PRIORITY_FILL_RADIUS),
        Math.max(this.view.minY, cy - PRIORITY_FILL_RADIUS),
        Math.min(this.view.maxY, cy + PRIORITY_FILL_RADIUS),
        {
          persistCursor: false,
          skipDrawnCheap: true,
          timeBudgetMs: IS_MOBILE ? 2 : 3,
          tileBudget: IS_MOBILE ? 40 : 200,
        },
      );
      if (!IS_MOBILE) {
        const idleHalf = Math.max(
          Math.ceil((this.view.maxX - this.view.minX) / 2),
          Math.ceil((this.view.maxY - this.view.minY) / 2),
          1,
        );
        preWarmCellsNearPlayer(
          cx,
          cy,
          cacheKeepBoundaryDist(idleHalf),
          1,
        );
      }
      this.refreshBuildingLods();
      return;
    }

    const viewHalf = Math.max(
      Math.ceil((region.maxX - region.minX) / 2),
      Math.ceil((region.maxY - region.minY) / 2),
      1,
    );
    const keepDist = cacheKeepBoundaryDist(viewHalf);

    if (viewStale) {
      // Cull reads this.view, so publish the new rect before destroying
      // anything that fell outside it.
      this.view = region;
      const jump =
        hadSync &&
        (Math.abs(cx - prevX) > 24 || Math.abs(cy - prevY) > 24);
      const viewGrew = hadView && viewContains(region, prevView);
      // Growing the view cannot expose a tile that was inside the old cull
      // ring, so skip the full sprite walk on zoom-out.
      if (!viewGrew) this.cullFarObjects();

      let addedBands = 0;
      if (!hadView || jump) {
        this.edgeBands = [];
        this.edgeBandIndex = 0;
        this.syncCursor = { x: region.minX, y: region.minY, regionKey: "" };
        this.tilesRemainingInRegion = true;
      } else {
        const bands = inwardEdgeBands(prevView, region);
        addedBands = bands.length;
        if (addedBands > 0) this.edgeBands.push(...bands);
        if (
          this.syncCursor.x < region.minX ||
          this.syncCursor.x > region.maxX ||
          this.syncCursor.y < region.minY ||
          this.syncCursor.y > region.maxY
        ) {
          this.syncCursor = {
            x: Math.min(Math.max(this.syncCursor.x, region.minX), region.maxX),
            y: Math.min(Math.max(this.syncCursor.y, region.minY), region.maxY),
            regionKey: "",
          };
        } else {
          this.syncCursor.regionKey = "";
        }
      }

      // A big zoom already fills the frame with new tiles. Warm layouts on
      // smaller steps and while standing still instead.
      if (addedBands <= 8) {
        preWarmCellsNearPlayer(cx, cy, keepDist, PREWARM_CELLS_PER_FRAME);
      }

      if (playerMoved || !hadSync) this.lastSyncTile = { x: cx, y: cy };
      this.lastView = { ...region };
    }

    // One budget for underfoot, the open scan, and the new edge. Stacking
    // those used to spend two time slices on the same frame.
    const budget: FillBudget = {
      tiles: TILES_PER_SYNC,
      buildings: BUILDINGS_PER_SYNC,
      solids: SOLID_BUILDINGS_PER_SYNC,
      deadline: performance.now() + (IS_MOBILE ? 6 : 10),
      cheapSkips: 0,
    };

    // Nearest textured bakes first, inside the same time slice as the ground.
    // Waiting until the edge fill finished left every new lot empty.
    this.dropOutsideDeferredBuildings();
    this.drainDeferredBuildings(budget);

    this.syncTileRegion(
      Math.max(this.view.minX, cx - PRIORITY_FILL_RADIUS),
      Math.min(this.view.maxX, cx + PRIORITY_FILL_RADIUS),
      Math.max(this.view.minY, cy - PRIORITY_FILL_RADIUS),
      Math.min(this.view.maxY, cy + PRIORITY_FILL_RADIUS),
      {
        persistCursor: false,
        skipDrawnCheap: true,
        budget,
        deferBuildings: true,
      },
    );

    if (this.tilesRemainingInRegion) {
      const wasRemaining = this.tilesRemainingInRegion;
      this.tilesRemainingInRegion = this.syncTileRegion(
        this.view.minX,
        this.view.maxX,
        this.view.minY,
        this.view.maxY,
        {
          preferX: cx,
          preferY: cy,
          budget,
          deferBuildings: true,
          skipDrawnCheap: true,
        },
      );
      if (wasRemaining && !this.tilesRemainingInRegion) {
        this.refreshAllTreeDepths();
      }
    }

    this.drainEdgeBands(budget);

    this.dropOutsideDeferredBuildings();
    if (performance.now() < budget.deadline) {
      this.drainDeferredBuildings(budget);
    }

    const revealing =
      this.tilesRemainingInRegion ||
      this.edgeWorkPending() ||
      this.deferredBuildings.size > 0;
    if (!revealing) this.refreshBuildingLods();

    if (viewStale) {
      const snapCx = cx;
      const snapCy = cy;
      const snapKeep = keepDist;
      setTimeout(() => {
        evictDistantCells(snapCx, snapCy, snapKeep);
      }, 0);
    }
  }

  /** Whether a tile is inside the current overworld draw AABB. */
  isInRenderView(tx: number, ty: number): boolean {
    const { minX, maxX, minY, maxY } = this.view;
    return tx >= minX && tx <= maxX && ty >= minY && ty <= maxY;
  }

  /** True after at least one successful draw/cull sync. */
  hasActiveRenderView(): boolean {
    return Number.isFinite(this.lastView.minX);
  }

  /**
   * Run the building tier pass on its own, for interiors.
   *
   * The normal sync is skipped while indoors, which used to mean the whole
   * exterior city sat on full-resolution bakes nobody could see for as long as
   * the player stayed inside. Every building is off screen here, so this drops
   * them to the cheaper textured tier; stepping back out promotes the handful
   * that are actually visible within a sync or two.
   *
   * Deliberately a smaller budget than the outdoor pass: nothing is waiting on
   * these bytes, and re-tiering a whole city at 16 per frame would stutter
   * through the door fade for no gain.
   */
  releaseOffscreenBuildingDetail() {
    this.refreshBuildingLods(IS_MOBILE ? 1 : 4);
  }

  /** Force the next syncAroundPlayer to recompute view (zoom / resize). */
  invalidateRenderView() {
    this.lastView = { minX: NaN, maxX: NaN, minY: NaN, maxY: NaN };
  }

  /** Chebyshev tile distance from the live player tile to a footprint. */
  private buildingDistance(ox: number, oy: number, w: number, h: number): number {
    const px = this.lodTile.x;
    const py = this.lodTile.y;
    if (!Number.isFinite(px) || !Number.isFinite(py)) return 0;
    const dx = Math.max(ox - px, 0, px - (ox + w - 1));
    const dy = Math.max(oy - py, 0, py - (oy + h - 1));
    return Math.max(dx, dy);
  }

  /**
   * Is any part of this building's cuboid within `padPx` of the viewport?
   *
   * Interiors report false for everything: the overworld is hidden, so the whole
   * exterior city is invisible and has no claim on the bake budget.
   */
  private buildingOnScreen(bld: BuildingInfo, padPx: number): boolean {
    if (this.overworldHidden) return false;
    const view = this.cameraView;
    // No camera rect yet (join, mobile fixed-radius path). Assume visible rather
    // than stripping detail from buildings we have not measured.
    if (!view) return true;
    const box = buildingCuboidScreenBox(bld);
    return (
      box.maxX >= view.minX - padPx &&
      box.minX <= view.maxX + padPx &&
      box.maxY >= view.minY - padPx &&
      box.minY <= view.maxY + padPx
    );
  }

  /** Far enough outside the viewport that dropping its bake tier cannot be seen. */
  private buildingOffScreen(bld: BuildingInfo): boolean {
    return !this.buildingOnScreen(bld, NEAR_BAKE_DEMOTE_PAD_PX);
  }

  private lodForBuilding(bld: BuildingInfo, current?: BuildingLod): BuildingLod {
    const want = buildingLodForDistance(
      this.buildingDistance(bld.ox, bld.oy, bld.w, bld.h),
      current,
    );
    if (want !== "near") return want;
    // Near is only worth its 9x pixels on something the player can see.
    const pad =
      current === "near" ? NEAR_BAKE_DEMOTE_PAD_PX : NEAR_BAKE_PROMOTE_PAD_PX;
    return this.buildingOnScreen(bld, pad) ? "near" : "mid";
  }

  /**
   * Drop oldest soft-culled cuboids so their textures can go idle and be
   * evicted. Nearby near-upgrades were refused while 96 hidden bakes still
   * counted as live refs against the byte budget.
   */
  private evictCachedBuildings(count: number) {
    let n = 0;
    while (n < count && this.buildingCache.size > 0) {
      const oldest = this.buildingCache.keys().next().value as
        | string
        | undefined;
      if (oldest === undefined) break;
      const entry = this.buildingCache.get(oldest);
      this.buildingCache.delete(oldest);
      if (entry) destroyBuildingCuboid(this.scene, entry.cuboid);
      this.destroyEdgeDecals(oldest);
      n += 1;
    }
    if (n > 0) purgeIdleBuildingTextures(this.scene);
  }

  /**
   * Move live buildings onto the tier they now deserve, and retry flat
   * fallbacks.
   *
   * A fallback is a building that wanted a bake and could not get one, so it is
   * retried here rather than being stuck flat forever: the old code marked such
   * footprints as drawn and only re-baked when the cuboid vanished entirely,
   * which is why desktop stayed flat once VRAM ran out.
   *
   * Never replace a good textured cuboid with a solid. That is the visible
   * flatten-wave: 16 closest pending buildings per frame, 3D Images swapped
   * for far Graphics.
   */
  private refreshBuildingLods(budget = BUILDING_LOD_UPDATES_PER_SYNC) {
    const total = this.buildingObjects.size;
    if (budget <= 0 || total === 0) return;

    // Closest first so leftover far solids from an older session promote on
    // the street in front of you, not the horizon.
    type Pending = {
      key: string;
      tracked: TrackedBuilding;
      bld: BuildingInfo;
      want: BuildingLod;
      healing: boolean;
      dist: number;
    };
    const pending: Pending[] = [];
    for (const [key, tracked] of this.buildingObjects) {
      const cuboid = tracked.cuboid;
      const bld = getBuildingAt(tracked.ox, tracked.oy);
      if (!bld) continue;
      const want = this.lodForBuilding(bld, cuboid.lod);
      const healing = cuboid.fallback || cuboid.lod === "far";
      // Zoom moved the bake resolution out from under this building. Only
      // textured cuboids carry a scale; a flat one is already covered by
      // `healing`.
      const staleScale =
        !healing &&
        cuboid.bakeScale != null &&
        cuboid.bakeScale !== bakeScaleFor(want);
      if (want === cuboid.lod && !healing && !staleScale) continue;
      // Keep a better bake (near while we only need mid): softening a building
      // the player is looking at is a visible downgrade. Off screen it is not
      // visible at all, and those held 3x bakes are exactly what starves the
      // buildings underfoot into flat fallbacks, so there the swap is allowed.
      if (
        !healing &&
        !staleScale &&
        lodRank(want) < lodRank(cuboid.lod) &&
        !this.buildingOffScreen(bld)
      ) {
        continue;
      }
      pending.push({
        key,
        tracked,
        bld,
        want,
        healing,
        dist: this.buildingDistance(tracked.ox, tracked.oy, tracked.w, tracked.h),
      });
    }
    if (pending.length === 0) return;
    // Heals are a visible defect (a flat block on the street) so they take the
    // budget first, and so does a bake now coarser than the screen needs, which
    // reads as a blurry building after zooming in. Anything that hands bytes
    // back comes next even though nobody can see it, because running those
    // before promotions lets the promotion land this pass instead of being
    // refused and retried. Distance orders within each group, nearest first.
    const rank = (p: Pending) => {
      if (p.healing) return 0;
      const current = p.tracked.cuboid.bakeScale;
      const wanted = bakeScaleFor(p.want);
      if (current != null && current < wanted) return 0;
      if (current != null && current > wanted) return 1;
      return lodRank(p.want) < lodRank(p.tracked.cuboid.lod) ? 1 : 2;
    };
    pending.sort((a, b) => rank(a) - rank(b) || a.dist - b.dist);

    const nearbyPending = pending.some(
      (p) => p.dist <= BUILDING_LOD_NEAR_TILES,
    );
    if (nearbyPending && this.buildingCache.size > 0) {
      this.evictCachedBuildings(IS_MOBILE ? 0 : 16);
    }

    let remaining = budget;
    for (const { key, tracked, bld, want, healing, dist } of pending) {
      if (remaining <= 0) break;

      remaining -= 1;
      const depth = buildingWallDepth(bld);
      const tryReplace = (): BuildingCuboidObject | null => {
        try {
          return createBuildingCuboid(this.scene, bld, depth, want, {
            silentFail: healing || dist <= BUILDING_LOD_NEAR_TILES,
            displaceKey: tracked.cuboid.textureKey,
          });
        } catch (err) {
          console.error(`Failed to re-bake building ${key} at LOD ${want}`, err);
          return null;
        }
      };

      const bakeFailed = (cuboid: BuildingCuboidObject | null) =>
        !cuboid ||
        cuboid.fallback ||
        cuboid.lod === "far";

      let replacement = tryReplace();
      if (
        bakeFailed(replacement) &&
        dist <= BUILDING_LOD_NEAR_TILES &&
        this.buildingCache.size > 0
      ) {
        if (replacement) destroyBuildingCuboid(this.scene, replacement);
        this.evictCachedBuildings(IS_MOBILE ? 0 : 32);
        replacement = tryReplace();
      }
      if (!replacement) continue;

      // A heal that fails again must keep the building it already has, or the
      // retry becomes a destroy/create churn for no visual gain.
      if (healing && replacement.fallback) {
        destroyBuildingCuboid(this.scene, replacement);
        continue;
      }
      // Never flatten a textured cuboid. Budget refusal must leave the 3D bake.
      if (
        !tracked.cuboid.fallback &&
        tracked.cuboid.lod !== "far" &&
        (replacement.fallback || replacement.lod === "far")
      ) {
        destroyBuildingCuboid(this.scene, replacement);
        continue;
      }
      if (healing) renderStats.buildingFallbackHeals += 1;
      destroyBuildingCuboid(this.scene, tracked.cuboid);
      tracked.cuboid = replacement;
    }
  }

  /** Hide a building and park it in the LRU texture cache (or destroy on mobile). */
  private stashBuilding(key: string, bld: TrackedBuilding) {
    // Never cache a flat: fallbacks and far-LOD solids would be restored as-is
    // when you walk back in, which is a city of untextured blocks until a
    // slow heal pass catches up.
    if (
      BUILDING_CUBOID_CACHE_MAX <= 0 ||
      bld.cuboid.fallback ||
      bld.cuboid.lod === "far"
    ) {
      destroyBuildingCuboid(this.scene, bld.cuboid);
      this.destroyEdgeDecals(key);
      return;
    }
    bld.cuboid.display.setVisible(false);
    const decals = this.edgeDecalObjects.get(key);
    if (decals) decals.setVisible(false);
    // Refresh LRU position if somehow already cached.
    this.buildingCache.delete(key);
    this.buildingCache.set(key, bld);
    this.evictBuildingCache();
  }

  /** Pop a soft-culled building back into the live set (or undefined). */
  private takeCachedBuilding(key: string): TrackedBuilding | undefined {
    const cached = this.buildingCache.get(key);
    if (!cached) return undefined;
    this.buildingCache.delete(key);
    if (cached.cuboid.fallback || cached.cuboid.lod === "far") {
      destroyBuildingCuboid(this.scene, cached.cuboid);
      this.destroyEdgeDecals(key);
      return undefined;
    }
    // Restore whatever textured bake we have. Destroying mid to chase near
    // left a flat hole whenever the upgrade allocation failed; refresh
    // promotes the live cuboid once there is room.
    cached.cuboid.display.setVisible(true);
    const decals = this.edgeDecalObjects.get(key);
    if (decals) decals.setVisible(this.groundLayer.visible);
    return cached;
  }

  private ensureBuildingEdgeDecals(bld: BuildingInfo, key: string) {
    const existing = this.edgeDecalObjects.get(key);
    if (existing) {
      existing.setVisible(this.groundLayer.visible);
      return;
    }
    const image = spawnBuildingEdgeDecals(this.scene, bld);
    if (image) {
      image.setVisible(this.groundLayer.visible);
      this.edgeDecalObjects.set(key, image);
    }
  }

  private destroyEdgeDecals(key: string) {
    const image = this.edgeDecalObjects.get(key);
    if (!image) return;
    this.edgeDecalObjects.delete(key);
    destroyBuildingEdgeDecals(this.scene, image);
  }

  private ensureStreetDecal(tx: number, ty: number, ttype: TileType) {
    const key = tileKey(tx, ty);
    if (this.streetDecalObjects.has(key)) return;
    const image = maybeSpawnStreetSurfaceDecal(this.scene, tx, ty, ttype);
    if (!image) return;
    image.setVisible(this.groundLayer.visible);
    this.streetDecalObjects.set(key, image);
  }

  private destroyStreetDecal(key: string) {
    const image = this.streetDecalObjects.get(key);
    if (!image) return;
    this.streetDecalObjects.delete(key);
    destroyStreetSurfaceDecal(this.scene, image);
  }

  private ensurePuddleSite(tx: number, ty: number) {
    const key = tileKey(tx, ty);
    if (this.puddleSites.has(key)) return;
    const spec = puddleSpecAt(tx, ty);
    if (spec) this.puddleSites.set(key, spec);
  }

  private clearPuddleSite(key: string) {
    this.puddleSites.delete(key);
    this.destroyPuddle(key);
  }

  private destroyPuddle(key: string) {
    const sprite = this.puddleObjects.get(key);
    if (!sprite) return;
    this.puddleObjects.delete(key);
    destroyRainPuddle(sprite);
  }

  /**
   * Fade, grow, and spawn sparse puddles from current rain wetness (0..1).
   * Longer rain unlocks more sites and lets existing ones swell.
   */
  updateRainPuddles(wetness: number, dt: number, glare = 1) {
    const worldVisible = this.groundLayer.visible;
    if (wetness <= 0.001 && this.puddleObjects.size === 0) return;

    if (wetness > 0.001 && worldVisible) {
      for (const [key, spec] of this.puddleSites) {
        if (wetness < spec.unlock) continue;
        if (this.puddleObjects.has(key)) continue;
        const spawned = spawnRainPuddle(this.scene, spec);
        if (spawned) this.puddleObjects.set(key, spawned);
      }
    }

    const gone: string[] = [];
    for (const [key, sprite] of this.puddleObjects) {
      const keep = tickRainPuddle(sprite, wetness, dt, glare, worldVisible);
      if (!keep) gone.push(key);
    }
    for (const key of gone) this.destroyPuddle(key);
  }

  /** Drop oldest cached cuboids (and their textures) past the LRU cap. */
  private evictBuildingCache() {
    while (this.buildingCache.size > BUILDING_CUBOID_CACHE_MAX) {
      const oldest = this.buildingCache.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      const entry = this.buildingCache.get(oldest);
      this.buildingCache.delete(oldest);
      if (entry) destroyBuildingCuboid(this.scene, entry.cuboid);
      this.destroyEdgeDecals(oldest);
    }
  }

  /**
   * Destroy anything outside the draw AABB expanded by cull hysteresis.
   * Street chunks / buildings / 1×1 tiles all use the same fully-outside test
   * so we don't thrash edges while the incremental fill catches up.
   */
  private cullFarObjects() {
    const h = CULL_HYSTERESIS_TILES;
    const cull: ViewRect = {
      minX: this.view.minX - h,
      maxX: this.view.maxX + h,
      minY: this.view.minY - h,
      maxY: this.view.maxY + h,
    };
    const outside = (
      minX: number,
      minY: number,
      maxX: number,
      maxY: number,
    ) =>
      maxX < cull.minX ||
      minX > cull.maxX ||
      maxY < cull.minY ||
      minY > cull.maxY;

    // ── Grass tiles (1×1) ───────────────────────────────────────────────────
    const grassToRemove: string[] = [];
    for (const [key, img] of this.grassTiles) {
      const comma = key.indexOf(",");
      const tx = parseInt(key.slice(0, comma), 10);
      const ty = parseInt(key.slice(comma + 1), 10);
      if (!outside(tx, ty, tx, ty)) continue;
      grassToRemove.push(key);
      this.grassLayer.remove(img, true);
    }
    for (const key of grassToRemove) {
      this.grassTiles.delete(key);
      this.drawn.delete(key);
      this.minimapKinds.delete(key);
      this.clearPuddleSite(key);
    }

    // ── Tree underlay grass (1×1) ───────────────────────────────────────────
    const treeGroundToRemove: string[] = [];
    for (const key of this.treeGroundTiles.keys()) {
      const comma = key.indexOf(",");
      const tx = parseInt(key.slice(0, comma), 10);
      const ty = parseInt(key.slice(comma + 1), 10);
      if (outside(tx, ty, tx, ty)) treeGroundToRemove.push(key);
    }
    for (const key of treeGroundToRemove) {
      this.destroyGroundTile(key);
      this.drawn.delete(key);
      this.minimapKinds.delete(key);
    }

    // ── Street chunks — destroy only when fully outside the cull ring ────────
    const chunkKeysToRemove: string[] = [];
    for (const [key, chunk] of this.streetChunks) {
      const comma = key.indexOf(",");
      const chunkX = parseInt(key.slice(0, comma), 10);
      const chunkY = parseInt(key.slice(comma + 1), 10);
      const chunkMaxX = chunkX + STREET_CHUNK_SIZE - 1;
      const chunkMaxY = chunkY + STREET_CHUNK_SIZE - 1;
      if (!outside(chunkX, chunkY, chunkMaxX, chunkMaxY)) continue;
      chunkKeysToRemove.push(key);
      for (const tile of chunk.tiles) {
        this.drawn.delete(tile);
        this.minimapKinds.delete(tile);
        this.destroyStreetDecal(tile);
        this.clearPuddleSite(tile);
      }
      chunk.graphics.destroy();
    }
    for (const key of chunkKeysToRemove) {
      this.streetChunks.delete(key);
    }

    // ── Buildings — soft-cull (LRU) or hard-destroy when cache max is 0 ──────
    const buildingKeysToRemove: string[] = [];
    for (const [key, bld] of this.buildingObjects) {
      const maxX = bld.ox + bld.w - 1;
      const maxY = bld.oy + bld.h - 1;
      // Keep while any part still intersects the cull ring (was: must be fully
      // inside the tight draw view — that stashed buildings at the screen edge).
      if (!outside(bld.ox, bld.oy, maxX, maxY)) continue;
      buildingKeysToRemove.push(key);
      this.stashBuilding(key, bld);
      this.drawnBuildings.delete(key);
      for (let ty = bld.oy; ty <= maxY; ty++) {
        for (let tx = bld.ox; tx <= maxX; tx++) {
          const tKey = tileKey(tx, ty);
          this.drawn.delete(tKey);
          this.minimapKinds.delete(tKey);
        }
      }
    }
    for (const key of buildingKeysToRemove) {
      this.buildingObjects.delete(key);
    }

    // ── Trees (1×1) ─────────────────────────────────────────────────────────
    const treeKeysToRemove: string[] = [];
    for (const [key, img] of this.treeObjects) {
      const comma = key.indexOf(",");
      const tx = parseInt(key.slice(0, comma), 10);
      const ty = parseInt(key.slice(comma + 1), 10);
      if (!outside(tx, ty, tx, ty)) continue;
      treeKeysToRemove.push(key);
      img.destroy();
    }
    for (const key of treeKeysToRemove) {
      this.treeObjects.delete(key);
      this.drawn.delete(key);
      this.minimapKinds.delete(key);
      this.destroyGroundTile(key);
    }

    // ── Streetlights (1×1 curb poles; street underlay culled with chunks) ──
    const lightKeysToRemove: string[] = [];
    for (const [key, img] of this.streetlightObjects) {
      const comma = key.indexOf(",");
      const tx = parseInt(key.slice(0, comma), 10);
      const ty = parseInt(key.slice(comma + 1), 10);
      if (!outside(tx, ty, tx, ty)) continue;
      lightKeysToRemove.push(key);
      img.destroy();
    }
    for (const key of lightKeysToRemove) {
      this.streetlightObjects.delete(key);
      this.drawn.delete(key);
      this.minimapKinds.delete(key);
    }

    // ── Fences (edge panels; key is tx,ty,facing) ───────────────────────────
    const fenceKeysToRemove: string[] = [];
    for (const [key, img] of this.fenceObjects) {
      const parts = key.split(",");
      const tx = parseInt(parts[0]!, 10);
      const ty = parseInt(parts[1]!, 10);
      if (!outside(tx, ty, tx, ty)) continue;
      fenceKeysToRemove.push(key);
      img.destroy();
    }
    for (const key of fenceKeysToRemove) {
      this.fenceObjects.delete(key);
      const parts = key.split(",");
      const tile = parts[0] + "," + parts[1];
      this.drawn.delete(tile);
      this.minimapKinds.delete(tile);
      this.destroyGroundTile(tile);
    }
  }

  /** Visible streetlight sprites, for night lamp pools. */
  forEachStreetlightSprite(
    cb: (img: Phaser.GameObjects.Image) => void,
  ) {
    for (const img of this.streetlightObjects.values()) {
      if (img.visible) cb(img);
    }
  }

  /** Minimap colors for tiles currently drawn in the overworld render square. */
  getMinimapKinds(): ReadonlyMap<string, MinimapTileKind> {
    return this.minimapKinds;
  }

  /** True when this global tile has been drawn (camera-culled sync). */
  isTileDrawn(tx: number, ty: number): boolean {
    return this.drawn.has(tileKey(tx, ty));
  }

  /** Live cuboid display mix, for the VRAM line. */
  getLiveCuboidStats(): string {
    let images = 0;
    let graphics = 0;
    let fallback = 0;
    let far = 0;
    let missingTex = 0;
    let tiny = 0;
    for (const tracked of this.buildingObjects.values()) {
      const cuboid = tracked.cuboid;
      if (cuboid.fallback) fallback += 1;
      if (cuboid.lod === "far") far += 1;
      const display = cuboid.display;
      if (display instanceof Phaser.GameObjects.Graphics) {
        graphics += 1;
        continue;
      }
      images += 1;
      if (display instanceof Phaser.GameObjects.Image) {
        const key = display.texture?.key ?? "";
        if (!key || key === "__DEFAULT" || key === "__MISSING") missingTex += 1;
        if (display.displayWidth < 8 || display.displayHeight < 8) tiny += 1;
      }
    }
    return (
      `live=${this.buildingObjects.size} img=${images} gfx=${graphics} ` +
      `fallback=${fallback} far=${far} missingTex=${missingTex} tiny=${tiny}`
    );
  }
}

export function drawProceduralWorld(
  scene: Phaser.Scene,
  _bounds: WorldBounds,
): WorldTileManager {
  return new WorldTileManager(scene);
}
