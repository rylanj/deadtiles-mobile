import { TILE_HEIGHT, TILE_WIDTH } from "@zombie/shared";
import { isMobileDevice } from "./device";

export const IS_MOBILE = isMobileDevice();

/**
 * Client overworld draw radius cap (tiles each direction from the player).
 * Mobile: fixed square. Desktop: camera-visible tiles, clamped to this max.
 */
export const CLIENT_RENDER_RADIUS = IS_MOBILE ? 22 : 100;

export const CAMERA_ZOOM_MAX = 2;
/** Scroll-wheel zoom sensitivity (zoom change per wheel deltaY unit). */
export const CAMERA_ZOOM_WHEEL = 0.001;

/**
 * Minimum zoom so the viewport rectangle fits inside the iso diamond of the
 * ±CLIENT_RENDER_RADIUS tile square (camera is always centered on the player).
 */
export function getCameraZoomMin(
  viewWidth = typeof window !== "undefined" ? window.innerWidth : 390,
  viewHeight = typeof window !== "undefined" ? window.innerHeight : 844,
): number {
  if (!IS_MOBILE) return 0.4;

  const radius = CLIENT_RENDER_RADIUS;
  // Diamond fit: |x|/(R·TW) + |y|/(R·TH) ≤ 1 at the viewport corners.
  const fit =
    viewWidth / (2 * radius * TILE_WIDTH) +
    viewHeight / (2 * radius * TILE_HEIGHT);
  // Slight margin so void past the render edge stays off-screen.
  return Math.min(CAMERA_ZOOM_MAX, fit * 1.08);
}

/** Default camera zoom on load (<1 = farther out). */
export function getDefaultCameraZoom(): number {
  if (!IS_MOBILE) return 1;
  return Math.max(0.65, getCameraZoomMin());
}

/** @deprecated Prefer getDefaultCameraZoom() — evaluated once at import. */
export const CAMERA_ZOOM = getDefaultCameraZoom();

/** @deprecated Prefer getCameraZoomMin() — mobile min depends on viewport. */
export const CAMERA_ZOOM_MIN = getCameraZoomMin();

/** Max new overworld tiles registered per sync pass. */
export const TILES_PER_SYNC = IS_MOBILE ? 120 : 2000;

/**
 * Max cold building cuboid bakes per sync pass. Desktop used to bake every
 * newly discovered building in one frame (with TILES_PER_SYNC=2000), which
 * freezes the client after join until the whole view is painted.
 */
export const BUILDINGS_PER_SYNC = IS_MOBILE ? 1 : 2;

/** Soft-culled building cuboid LRU size (0 = hard-destroy / pool-release on cull). */
export const BUILDING_CUBOID_CACHE_MAX = IS_MOBILE ? 0 : 96;

/**
 * Fixed mobile pool of reusable building canvas textures.
 * Slots are redrawn in place (same GL texture key) so walking the map
 * does not allocate unbounded WebGL textures. 0 = disabled (desktop).
 *
 * @deprecated Superseded by the shape-signature cache and byte budget in
 * buildingTextureCache.ts. Kept only for the idle-canvas shrink helpers.
 */
export const BUILDING_TEXTURE_POOL_SIZE = IS_MOBILE ? 96 : 0;

/**
 * Hard ceiling on bytes held by baked building textures.
 *
 * Desktop previously had no ceiling at all: every building allocated its own
 * canvas keyed by world position, so exploring a city eventually failed
 * allocation and every new building fell back to a flat solid. A byte budget
 * bounds it directly, rather than by slot count, since a warehouse bake costs
 * an order of magnitude more than a house.
 */
export const BUILDING_TEXTURE_VRAM_BUDGET = IS_MOBILE
  ? 40 * 1024 * 1024
  : 192 * 1024 * 1024;

/** Supersampling factor for each baked building LOD tier. */
export const BUILDING_LOD_NEAR_SCALE = IS_MOBILE ? 2 : 3;
export const BUILDING_LOD_MID_SCALE = IS_MOBILE ? 1 : 2;

/** Chebyshev tile distance where buildings drop from the near bake to the mid bake. */
export const BUILDING_LOD_NEAR_TILES = 40;
/**
 * Past this used to force an untextured solid. That read as "the city went
 * flat": buildings baked at 3x, then a refresh wave replaced them with
 * Graphics blocks. Mid (textured) now covers the rest of the view. Solids
 * are only the budget-fallback path.
 */
export const BUILDING_LOD_MID_TILES = 75;
/** Distance a building must travel past a threshold before its tier flips. */
export const BUILDING_LOD_HYSTERESIS_TILES = 12;

/** Distinct art variants per building shape. Bounds the dedupe key space. */
export const BUILDING_VARIANT_BUCKETS = 8;

/** Soft exterior purge: keep buildings this many tiles past the live view AABB. */
export const EXTERIOR_PURGE_HYSTERESIS_TILES = 8;

/** Max buildings hard-freed per soft-purge tick (spread across frames). */
export const EXTERIOR_PURGE_BUILDINGS_PER_FRAME = IS_MOBILE ? 3 : 6;

/** Player must be still this long before idle soft-purge runs. */
export const EXTERIOR_PURGE_IDLE_MS = 2500;

/**
 * Cap for idle pool canvases after a soft purge (px). Slots that grew for
 * warehouses shrink back when free so VRAM does not stay at peak forever.
 */
export const BUILDING_POOL_CANVAS_SOFT_MAX = IS_MOBILE ? 1024 : 1536;
