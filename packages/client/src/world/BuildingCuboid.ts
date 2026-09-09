import Phaser from "phaser";
import {
  CITY_BUILDING_SPECS,
  WALL_DEPTH,
  WAREHOUSE_ROOF_PEAK_HEIGHT,
  MOTEL_ROOF_PEAK_HEIGHT,
  TENT_ROOF_PEAK_HEIGHT,
  POLICE_ROOF_LIP_HEIGHT,
  POLICE_ROOF_PROP_HEIGHT,
  SUPERMARKET_ROOF_PROP_HEIGHT,
  HOUSE_ROOF_PEAK_HEIGHT,
  HOUSE_CHIMNEY_HEIGHT,
  TILE_WIDTH,
  buildingEntranceFace,
  buildingEntranceSpan,
  buildingWallScreenDepth,
  cartesianToIso,
  isRedOrderOwnedSupermarket,
  type BuildingType,
  type CityBuildingType,
} from "@zombie/shared";
import {
  BUILDING_DOOR_1_KEY,
  BUILDING_DOOR_3_KEY,
  BUILDING_DOOR_4_KEY,
  BUILDING_TENT_FLAP_KEY,
  buildingDoor2Key,
  buildingDoor4Key,
  buildingDoor5Key,
  BUILDING_DOOR_POLICE_KEY,
  BUILDING_WALL_BLANK_KEY,
  BUILDING_WALL_HOUSE_KEYS,
  BUILDING_WALL_WAREHOUSE_KEY,
  BUILDING_SUPER_WINDOW_BOARDED_KEY,
  BUILDING_MOTEL_SIGN_SE_KEY,
  buildingBigWindow1Key,
  buildingWindow1Key,
  SUPER_WINDOW_VARIANTS,
  buildingSuperWindowKey,
  doorTextureKeyForBuilding,
  wallTextureKeyForBuilding,
  isHouseStyleBuilding,
  type BuildingWallKey,
  type SuperWindowFace,
  type SuperWindowVariant,
} from "../sprites/BuildingAssets";

type Point = { x: number; y: number };
type BuildingFootprint = {
  ox: number;
  oy: number;
  w: number;
  h: number;
  buildingType?: BuildingType;
  exteriorLevels?: number;
  entranceX?: number;
  entranceY?: number;
  entranceSpan?: number;
  chimneyX?: number;
  chimneyY?: number;
  /**
   * Bucketed art variant. Present on normalised footprints used for baking;
   * absent means "derive from world position", which only the solid-cuboid
   * path still does.
   */
  variantSeed?: number;
  /** Pre-resolved world lookup: Red Order supermarkets board their windows. */
  boarded?: boolean;
};

import { IS_MOBILE } from "../gameConfig";
import { renderStats } from "../diagnostics/textureBudget";
import { resolveImageSource } from "../sprites/atlasRegistry";
import {
  acquireBuildingTexture,
  buildingSignature,
  buildingVariantSeed,
  lodScale,
  releaseBuildingTexture,
  type BuildingLod,
} from "./buildingTextureCache";
import { paintRoofDecals, type RoofFace } from "./buildingRoofDecals";
import { paintCuboidWallDecals } from "./buildingWallDecals";

/** Fallback horizontal repeat when aspect cannot be derived. */
const WALL_TEXTURE_REPEAT_PX = 128;
/** 1px overlap when tiling the strip canvas to hide bilinear seams. */
const WALL_STRIP_TILE_OVERLAP = 1;

/** Flat default roof (untyped shells). */
const ROOF_COLOR = "#3e3e3e";

/** Temp per-type flat roof fill from the shared spec table. */
function roofColorForType(buildingType?: BuildingType): string {
  if (!buildingType || buildingType === "none") return ROOF_COLOR;
  return (
    CITY_BUILDING_SPECS[buildingType as CityBuildingType]?.roofColor ?? ROOF_COLOR
  );
}
/** Warehouse roof deck — lighter corrugated-metal look. */
const WAREHOUSE_ROOF_DECK = "#6e6e6e";
/** Warehouse parapet lip (top + rim). */
const WAREHOUSE_ROOF_LIP = "#555555";
/** Warehouse parapet outer faces (SE / SW). */
const WAREHOUSE_ROOF_LIP_FACE = "#484848";
/** Inset of the deck from the outer lip edge (px at 1× draw scale). */
const WAREHOUSE_ROOF_LIP_INSET = 2.5;
/** House eave overhang past the wall top (px at 1× draw scale). */
const HOUSE_ROOF_OVERHANG = 3.5;
/** Motel porch / eave overhang past the wall top (match house scale). */
const MOTEL_ROOF_OVERHANG = 3.5;

/** Weathered roadside stucco — dusty peach, fits outskirts brick/cream palette. */
const MOTEL_WALL_FRONT = "#c4a882";
/** Slightly deeper SE face for iso shading. */
const MOTEL_WALL_SIDE = "#a88f6c";
/** Muted taupe trim / cladding (not stark white). */
const MOTEL_TRIM = "#8f816e";
const MOTEL_TRIM_SIDE = "#7a6e5c";
/** Warm asphalt shingle deck (same family as house roofs). */
const MOTEL_ROOF_DECK = "#5c4a3e";
/** Gable end reads as stucco, not metal. */
const MOTEL_GABLE = "#9a8468";
/** Olive drab canvas — SW face (camera-front). */
const TENT_WALL_FRONT = "#4a5a32";
/** Slightly deeper SE face for iso shading. */
const TENT_WALL_SIDE = "#3d4c2a";
/** Canvas roof deck. */
const TENT_ROOF_DECK = "#354226";
/** Gable end reads as the same canvas, a touch lighter. */
const TENT_GABLE = "#3a4a28";
/** Dark window / door-flap patches on the SE gable. */
const TENT_FLAP = "#2c3820";
/** Tight canvas eaves (less than house / motel). */
const TENT_ROOF_OVERHANG = 2;
/** Khaki prefab hut — SW face (camera-front). */
const MESS_HALL_WALL_FRONT = "#6b5e45";
/** Slightly deeper SE face. */
const MESS_HALL_WALL_SIDE = "#5a4e3a";
/** Dark tarpaper / tin deck. */
const MESS_HALL_ROOF_DECK = "#4a4034";
/** Gable end matches the khaki wall, a touch darker. */
const MESS_HALL_GABLE = "#5c5340";
const MESS_HALL_ROOF_OVERHANG = 3;
/** On-canvas width for the pre-iso MotelSign_SE (readable without dominating the façade). */
const MOTEL_SIGN_DISPLAY_W = TILE_WIDTH * 1.85;
/**
 * Fraction of sign display width to shift screen-left so the art centres over
 * the door (PNG visual mass sits slightly right of the canvas midpoint).
 */
const MOTEL_SIGN_NUDGE_X_FRAC = 0.08;
/** Extra AABB pad so the roof sign is not clipped from the cuboid canvas. */
const MOTEL_SIGN_BOUNDS_PAD = Math.ceil(MOTEL_SIGN_DISPLAY_W * 0.55);

/**
 * Pre-tile the wall bitmap horizontally at source resolution.
 * One texture covers a single storey height; multi-storey faces stack strips.
 * Horizontal repeat width preserves source aspect against the face screen height.
 */
function buildWallStrip(
  img: CanvasImageSource,
  srcW: number,
  srcH: number,
  screenEdgeLenPx: number,
  faceScreenHeightPx: number,
): HTMLCanvasElement {
  const aspect = srcH > 0 ? srcW / srcH : 1;
  const repeatPx = Math.max(
    1,
    faceScreenHeightPx > 0
      ? faceScreenHeightPx * aspect
      : WALL_TEXTURE_REPEAT_PX,
  );
  const numRepeats = Math.max(1, Math.ceil(screenEdgeLenPx / repeatPx));
  const stripW = numRepeats * srcW;
  const canvas = document.createElement("canvas");
  canvas.width = stripW;
  canvas.height = srcH;
  const sctx = canvas.getContext("2d");
  if (!sctx) return canvas;

  // Keep source pixels 1:1 here — the face affine transform resamples once.
  sctx.imageSmoothingEnabled = false;

  let x = 0;
  while (x < stripW) {
    const bleed = x > 0 ? WALL_STRIP_TILE_OVERLAP : 0;
    sctx.drawImage(img, 0, 0, srcW, srcH, x - bleed, 0, srcW + bleed, srcH);
    x += srcW;
  }
  return canvas;
}

/** Map a rectangular strip onto one wall parallelogram with a single draw call. */
function drawImageOnWallFace(
  ctx: CanvasRenderingContext2D,
  strip: CanvasImageSource,
  stripW: number,
  stripH: number,
  bottomLeft: Point,
  bottomRight: Point,
  depth: number,
) {
  const bl = bottomLeft;
  const br = bottomRight;
  const tl = { x: bl.x, y: bl.y - depth };
  const tr = { x: br.x, y: br.y - depth };

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(bl.x, bl.y);
  ctx.lineTo(br.x, br.y);
  ctx.lineTo(tr.x, tr.y);
  ctx.lineTo(tl.x, tl.y);
  ctx.closePath();
  ctx.clip();

  ctx.transform(
    (br.x - bl.x) / stripW,
    (br.y - bl.y) / stripW,
    (tl.x - bl.x) / stripH,
    (tl.y - bl.y) / stripH,
    bl.x,
    bl.y,
  );
  ctx.drawImage(strip, 0, 0, stripW, stripH);
  ctx.restore();
}

/**
 * Draw a wall face with the texture tiled once per storey (WALL_DEPTH band),
 * so 2-storey buildings get two full wall tiles instead of one stretch.
 */
function drawTexturedWallFace(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  bottomLeft: Point,
  bottomRight: Point,
  depth: number,
  srcW: number,
  srcH: number,
) {
  const edgeLen = Math.hypot(
    bottomRight.x - bottomLeft.x,
    bottomRight.y - bottomLeft.y,
  );
  const levels = Math.max(1, Math.round(depth / WALL_DEPTH));
  const storeyDepth = depth / levels;
  const strip = buildWallStrip(img, srcW, srcH, edgeLen, storeyDepth);

  for (let level = 0; level < levels; level++) {
    const lift = level * storeyDepth;
    drawImageOnWallFace(
      ctx,
      strip,
      strip.width,
      strip.height,
      { x: bottomLeft.x, y: bottomLeft.y - lift },
      { x: bottomRight.x, y: bottomRight.y - lift },
      storeyDepth,
    );
  }
}

/** White corner / edge trim (screen px at 1× draw scale). */
const CLADDING_WIDTH = 5;
/** Pale beige-grey pastel for police SW face. */
const CLADDING_FRONT = "#ddd6c8";
/** Slightly deeper pastel for the SE (east) face so iso shading reads. */
const CLADDING_SIDE = "#c9c0b0";

/** Supermarket exterior — light beige SW face. */
const SUPERMARKET_WALL_FRONT = "#e8dcc8";
/** Supermarket exterior — slightly deeper SE face for iso shading. */
const SUPERMARKET_WALL_SIDE = "#d4c4a8";
/** Supermarket roof parapet top / rim. */
const SUPERMARKET_ROOF_LIP = "#7a6c5a";
/** Supermarket roof parapet outer faces (SE / SW). */
const SUPERMARKET_ROOF_LIP_FACE = "#5c5345";

/** Hospital exterior — off-white SW face. */
const HOSPITAL_WALL_FRONT = "#f2efe8";
/** Hospital exterior — slightly deeper SE face for iso shading. */
const HOSPITAL_WALL_SIDE = "#e0dbd2";
/** Hospital parapet rim (matches pale cladding). */
const HOSPITAL_ROOF_LIP = "#ebe6dc";
/** Hospital parapet outer faces. */
const HOSPITAL_ROOF_LIP_FACE = "#d4cfc4";
/** Medical cross badge. */
const HOSPITAL_CROSS_BG = "#c62828";
const HOSPITAL_CROSS_FG = "#ffffff";

type HospitalStripKind = "wingA" | "center" | "wingB";

type HospitalStrip = {
  ox: number;
  oy: number;
  w: number;
  h: number;
  levels: number;
  kind: HospitalStripKind;
};

/**
 * Split a hospital into three full-depth strips along the street-facing wall:
 * wing (2) | center (3) | wing (2). Center gets the remainder of faceLen / 3.
 */
function hospitalMassingStrips(bld: BuildingFootprint): HospitalStrip[] {
  const ex = bld.entranceX;
  const ey = bld.entranceY;
  const face: SuperWindowFace =
    ex != null && ey != null
      ? buildingEntranceFace({
          ox: bld.ox,
          oy: bld.oy,
          w: bld.w,
          h: bld.h,
          entranceX: ex,
          entranceY: ey,
        })
      : "SW";
  const faceLen = face === "SE" ? bld.h : bld.w;
  const wing = Math.max(1, Math.floor(faceLen / 3));
  const center = Math.max(1, faceLen - 2 * wing);
  // Rebalance if rounding ate a wing (tiny faces).
  const wingA = wing;
  const wingB = faceLen - wingA - center;

  if (face === "SW") {
    return [
      { ox: bld.ox, oy: bld.oy, w: wingA, h: bld.h, levels: 2, kind: "wingA" },
      {
        ox: bld.ox + wingA,
        oy: bld.oy,
        w: center,
        h: bld.h,
        levels: 3,
        kind: "center",
      },
      {
        ox: bld.ox + wingA + center,
        oy: bld.oy,
        w: Math.max(1, wingB),
        h: bld.h,
        levels: 2,
        kind: "wingB",
      },
    ];
  }
  return [
    { ox: bld.ox, oy: bld.oy, w: bld.w, h: wingA, levels: 2, kind: "wingA" },
    {
      ox: bld.ox,
      oy: bld.oy + wingA,
      w: bld.w,
      h: center,
      levels: 3,
      kind: "center",
    },
    {
      ox: bld.ox,
      oy: bld.oy + wingA + center,
      w: bld.w,
      h: Math.max(1, wingB),
      levels: 2,
      kind: "wingB",
    },
  ];
}

function lerpPoint(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function raisePoint(p: Point, dy: number): Point {
  return { x: p.x, y: p.y - dy };
}

/** Lighten/darken a #rrggbb fill for iso roof face shading. */
function shadeHex(hex: string, factor: number): string {
  const raw = hex.replace("#", "");
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw;
  const n = Number.parseInt(full, 16);
  if (!Number.isFinite(n)) return hex;
  const r = Math.min(255, Math.max(0, Math.round(((n >> 16) & 255) * factor)));
  const g = Math.min(255, Math.max(0, Math.round(((n >> 8) & 255) * factor)));
  const b = Math.min(255, Math.max(0, Math.round((n & 255) * factor)));
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/**
 * Ridge along the long axis. On squares, face the street: door on east →
 * north–south ridge (gable to the street); door on south → east–west ridge.
 */
function gableRidgeAxis(bld: BuildingFootprint): "EW" | "NS" {
  if (bld.w > bld.h) return "EW";
  if (bld.h > bld.w) return "NS";
  if (bld.entranceX != null && bld.entranceY != null) {
    return buildingEntranceFace({
      ox: bld.ox,
      oy: bld.oy,
      w: bld.w,
      h: bld.h,
      entranceX: bld.entranceX,
      entranceY: bld.entranceY,
    }) === "SE"
      ? "NS"
      : "EW";
  }
  return "EW";
}

/** White vertical strip at one end of a wall parallelogram. */
function drawWallFaceVerticalCladding(
  ctx: CanvasRenderingContext2D,
  bottomLeft: Point,
  bottomRight: Point,
  depth: number,
  atStart: boolean,
  widthPx: number,
  color: string,
) {
  const edgeLen = Math.hypot(
    bottomRight.x - bottomLeft.x,
    bottomRight.y - bottomLeft.y,
  );
  if (edgeLen < 1) return;
  const t = Math.min(widthPx / edgeLen, 0.4);
  const a = atStart ? bottomLeft : lerpPoint(bottomLeft, bottomRight, 1 - t);
  const b = atStart ? lerpPoint(bottomLeft, bottomRight, t) : bottomRight;
  fillPoly(
    ctx,
    [
      a,
      b,
      { x: b.x, y: b.y - depth },
      { x: a.x, y: a.y - depth },
    ],
    color,
  );
}

/** Vertical corner quoins on both ends of the visible SW / SE faces. */
function drawVerticalCornerCladding(
  ctx: CanvasRenderingContext2D,
  sw: Point,
  se: Point,
  ne: Point,
  depth: number,
  frontColor = CLADDING_FRONT,
  sideColor = CLADDING_SIDE,
) {
  const w = CLADDING_WIDTH;
  drawWallFaceVerticalCladding(ctx, sw, se, depth, true, w, frontColor);
  drawWallFaceVerticalCladding(ctx, sw, se, depth, false, w, frontColor);
  drawWallFaceVerticalCladding(ctx, ne, se, depth, true, w, sideColor);
  drawWallFaceVerticalCladding(ctx, ne, se, depth, false, w, sideColor);
}

/**
 * Crop transparent / empty margins so the door fills the wall quad.
 * Door1 sits in the centre of a square canvas with large side padding.
 */
function cropDoorContent(
  src: CanvasImageSource,
  srcW: number,
  srcH: number,
): { canvas: HTMLCanvasElement; w: number; h: number } | null {
  const probe = document.createElement("canvas");
  probe.width = srcW;
  probe.height = srcH;
  const pctx = probe.getContext("2d", { willReadFrequently: true });
  if (!pctx) return null;
  pctx.drawImage(src, 0, 0);
  const { data } = pctx.getImageData(0, 0, srcW, srcH);

  let minX = srcW;
  let minY = srcH;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < srcH; y++) {
    for (let x = 0; x < srcW; x++) {
      const a = data[(y * srcW + x) * 4 + 3]!;
      if (a < 8) continue;
      // Treat near-black padding as empty (Door1 uses a black backdrop).
      const i = (y * srcW + x) * 4;
      const r = data[i]!;
      const g = data[i + 1]!;
      const b = data[i + 2]!;
      if (r < 12 && g < 12 && b < 12) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (maxX < minX || maxY < minY) return null;

  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  // Wall-face mapping puts source y=0 at the ground — flip so the door stands upright.
  ctx.translate(0, h);
  ctx.scale(1, -1);
  ctx.drawImage(probe, minX, minY, w, h, 0, 0, w, h);
  return { canvas, w, h };
}

/**
 * Project a flat door texture onto the entrance tile's wall parallelogram
 * (same affine mapping as Wall1). Height defaults to 75% of the bottom storey;
 * width spans the full entrance tile after cropping art padding.
 */
function drawDoorOnEntranceFace(
  ctx: CanvasRenderingContext2D,
  door: { src: CanvasImageSource; srcW: number; srcH: number },
  bottomLeft: Point,
  bottomRight: Point,
  wallDepth: number,
  /** Mirror along the wall so handle stays screen-left (skip for lettered doors). */
  flipU = true,
  /** Fraction of one storey height the door occupies (from the ground). */
  heightFrac = 0.75,
) {
  const edgeLen = Math.hypot(
    bottomRight.x - bottomLeft.x,
    bottomRight.y - bottomLeft.y,
  );
  if (edgeLen < 1 || wallDepth < 1) return;
  const storeyDepth = Math.min(WALL_DEPTH, wallDepth);
  const doorDepth = storeyDepth * Math.min(1, Math.max(0.05, heightFrac));
  const cropped = cropDoorContent(door.src, door.srcW, door.srcH);
  let src: CanvasImageSource = cropped?.canvas ?? door.src;
  let srcW = cropped?.w ?? door.srcW;
  let srcH = cropped?.h ?? door.srcH;
  // If crop failed, still flip so the door isn't upside-down on the wall face.
  if (!cropped) {
    const flipped = document.createElement("canvas");
    flipped.width = srcW;
    flipped.height = srcH;
    const fctx = flipped.getContext("2d");
    if (fctx) {
      fctx.translate(0, srcH);
      fctx.scale(1, -1);
      fctx.drawImage(src, 0, 0);
      src = flipped;
    }
  }
  const u0 = flipU ? bottomRight : bottomLeft;
  const u1 = flipU ? bottomLeft : bottomRight;
  drawImageOnWallFace(
    ctx,
    src,
    srcW,
    srcH,
    // East/south wall edges run opposite to screen-left → flip U so handle stays left.
    u0,
    u1,
    doorDepth,
  );
}

/**
 * Project SuperWindow art onto a 2-tile façade span, vertically centred on the
 * wall (same crop / U-flip as the door, but lifted off the ground).
 * `heightFrac` is the fraction of one storey the window occupies (default 0.75).
 * `storeyIndex` lifts the window to that storey (0 = ground).
 */
function drawSuperWindowOnWallFace(
  ctx: CanvasRenderingContext2D,
  art: { src: CanvasImageSource; srcW: number; srcH: number },
  bottomLeft: Point,
  bottomRight: Point,
  wallDepth: number,
  flipU = true,
  heightFrac = 0.75,
  storeyIndex = 0,
) {
  const edgeLen = Math.hypot(
    bottomRight.x - bottomLeft.x,
    bottomRight.y - bottomLeft.y,
  );
  if (edgeLen < 1 || wallDepth < 1) return;
  const storeyDepth = Math.min(WALL_DEPTH, wallDepth);
  const windowDepth = storeyDepth * heightFrac;
  const lift = (storeyDepth - windowDepth) / 2;
  const storeyLift = storeyIndex * WALL_DEPTH;

  const cropped = cropDoorContent(art.src, art.srcW, art.srcH);
  let src: CanvasImageSource = cropped?.canvas ?? art.src;
  let srcW = cropped?.w ?? art.srcW;
  let srcH = cropped?.h ?? art.srcH;
  if (!cropped) {
    const flipped = document.createElement("canvas");
    flipped.width = srcW;
    flipped.height = srcH;
    const fctx = flipped.getContext("2d");
    if (fctx) {
      fctx.translate(0, srcH);
      fctx.scale(1, -1);
      fctx.drawImage(src, 0, 0);
      src = flipped;
    }
  }

  const bl = { x: bottomLeft.x, y: bottomLeft.y - lift - storeyLift };
  const br = { x: bottomRight.x, y: bottomRight.y - lift - storeyLift };
  const u0 = flipU ? br : bl;
  const u1 = flipU ? bl : br;
  drawImageOnWallFace(ctx, src, srcW, srcH, u0, u1, windowDepth);
}

/** Prepare a wall-face overlay (door/window) — crop padding and flip upright. */
function prepareWallOverlay(
  art: { src: CanvasImageSource; srcW: number; srcH: number },
): { src: CanvasImageSource; srcW: number; srcH: number } {
  const cropped = cropDoorContent(art.src, art.srcW, art.srcH);
  if (cropped) return { src: cropped.canvas, srcW: cropped.w, srcH: cropped.h };
  const flipped = document.createElement("canvas");
  flipped.width = art.srcW;
  flipped.height = art.srcH;
  const fctx = flipped.getContext("2d");
  if (fctx) {
    fctx.translate(0, art.srcH);
    fctx.scale(1, -1);
    fctx.drawImage(art.src, 0, 0);
    return { src: flipped, srcW: art.srcW, srcH: art.srcH };
  }
  return art;
}

/**
 * Project a window onto one storey of a wall tile. Bottom sits on the original
 * sill; height follows the art aspect so smaller Window1 art is not stretched.
 * `flipU` matches Door4 / SuperWindow (SE flipped, SW not — face-specific art).
 */
function drawWindowOnWallTile(
  ctx: CanvasRenderingContext2D,
  window: { src: CanvasImageSource; srcW: number; srcH: number },
  bottomLeft: Point,
  bottomRight: Point,
  storeyIndex: number,
  flipU = true,
  /** Optional sill as fraction of WALL_DEPTH (overrides default raised ground-floor sill). */
  sillFrac?: number,
) {
  const edgeLen = Math.hypot(
    bottomRight.x - bottomLeft.x,
    bottomRight.y - bottomLeft.y,
  );
  if (edgeLen < 1) return;
  const storeyLift = storeyIndex * WALL_DEPTH;
  // Ground-floor windows sit a bit higher than the base sill.
  const sill =
    sillFrac != null
      ? WALL_DEPTH * sillFrac
      : WALL_DEPTH * (0.22 + (storeyIndex === 0 ? 0.2 : 0));
  const aspect = window.srcW > 0 ? window.srcH / window.srcW : 1;
  const windowDepth = Math.min(
    WALL_DEPTH - sill,
    Math.max(1, edgeLen * aspect),
  );
  const bl = { x: bottomLeft.x, y: bottomLeft.y - storeyLift - sill };
  const br = { x: bottomRight.x, y: bottomRight.y - storeyLift - sill };
  const u0 = flipU ? br : bl;
  const u1 = flipU ? bl : br;
  drawImageOnWallFace(
    ctx,
    window.src,
    window.srcW,
    window.srcH,
    u0,
    u1,
    windowDepth,
  );
}

function resolveDoorSource(
  scene: Phaser.Scene,
  bld: BuildingFootprint,
): { src: CanvasImageSource; srcW: number; srcH: number } | null {
  const doorFace: SuperWindowFace | undefined =
    bld.entranceX != null && bld.entranceY != null
      ? buildingEntranceFace({
          ox: bld.ox,
          oy: bld.oy,
          w: bld.w,
          h: bld.h,
          entranceX: bld.entranceX,
          entranceY: bld.entranceY,
        })
      : undefined;
  const preferred = doorTextureKeyForBuilding(bld, doorFace);
  const fallbacks = [
    preferred,
    // Prefer the other facing of the same door set before unrelated doors.
    ...(bld.buildingType === "supermarket"
      ? [
          buildingDoor4Key(doorFace === "SW" ? "SE" : "SW"),
          buildingDoor4Key("SE"),
          buildingDoor4Key("SW"),
        ]
      : []),
    ...(bld.buildingType === "hospital"
      ? [
          buildingDoor5Key(doorFace === "SW" ? "SE" : "SW"),
          buildingDoor5Key("SE"),
          buildingDoor5Key("SW"),
        ]
      : []),
    ...(bld.buildingType === "tent" ? [BUILDING_TENT_FLAP_KEY] : []),
    BUILDING_DOOR_1_KEY,
    BUILDING_DOOR_3_KEY,
    buildingDoor2Key(doorFace ?? "SE"),
    buildingDoor2Key(doorFace === "SW" ? "SE" : "SW"),
    BUILDING_DOOR_4_KEY,
    BUILDING_DOOR_POLICE_KEY,
  ].filter((key, i, arr) => arr.indexOf(key) === i);
  for (const key of fallbacks) {
    const art = artSource(scene, key);
    if (art) return art;
  }
  return null;
}

/**
 * Whole-image source for a building art key, resolved through the atlas
 * registry so these canvas bakes keep working if the family is ever packed.
 */
function artSource(
  scene: Phaser.Scene,
  key: string,
): { src: CanvasImageSource; srcW: number; srcH: number } | null {
  const art = resolveImageSource(scene, key);
  if (!art) return null;
  return { src: art.src, srcW: art.width, srcH: art.height };
}

function resolveWindowSource(scene: Phaser.Scene, face: SuperWindowFace) {
  return artSource(scene, buildingWindow1Key(face));
}

function resolveBigWindow1Source(scene: Phaser.Scene, face: SuperWindowFace) {
  return artSource(scene, buildingBigWindow1Key(face));
}

function resolveSuperWindowSource(
  scene: Phaser.Scene,
  variant: SuperWindowVariant,
  face: SuperWindowFace,
) {
  return artSource(scene, buildingSuperWindowKey(variant, face));
}

/** Directionless boarded window for Red Order–owned supermarkets. */
function resolveBoardedSuperWindowSource(scene: Phaser.Scene) {
  return artSource(scene, BUILDING_SUPER_WINDOW_BOARDED_KEY);
}

/** Stable pick among unused SuperWindow variants (same bake → same windows). */
function pickSuperWindowVariant(
  variantSeed: number,
  face: SuperWindowFace,
  slot: number,
  used: ReadonlySet<SuperWindowVariant>,
): SuperWindowVariant | null {
  const available = SUPER_WINDOW_VARIANTS.filter((v) => !used.has(v));
  if (available.length === 0) return null;

  let h =
    (Math.imul(variantSeed + 1, 73856093) ^
      Math.imul(slot + 1, 83492791) ^
      (face === "SE" ? 1 : 2)) >>>
    0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d) >>> 0;
  h ^= h >>> 15;
  const idx = h % available.length;
  return available[idx]!;
}

/**
 * Resolve a SuperWindow texture for this slot, never reusing a variant number
 * already used on this supermarket (SE and SW of the same number share a slot).
 */
function resolveUniqueSuperWindow(
  scene: Phaser.Scene,
  variantSeed: number,
  face: SuperWindowFace,
  slot: number,
  used: Set<SuperWindowVariant>,
): { src: CanvasImageSource; srcW: number; srcH: number } | null {
  const preferred = pickSuperWindowVariant(variantSeed, face, slot, used);
  if (preferred !== null) {
    const raw = resolveSuperWindowSource(scene, preferred, face);
    if (raw) {
      used.add(preferred);
      return raw;
    }
  }

  // Fall back through remaining unused variants if a texture failed to load.
  for (const variant of SUPER_WINDOW_VARIANTS) {
    if (used.has(variant) || variant === preferred) continue;
    const alt = resolveSuperWindowSource(scene, variant, face);
    if (alt) {
      used.add(variant);
      return alt;
    }
  }
  return null;
}

/** Min exterior tiles between SuperWindow and the supermarket doorway. */
const SUPERMARKET_WINDOW_DOOR_GAP = 2;
/** SuperWindow width in façade tiles (matches supermarket door span). */
const SUPERMARKET_WINDOW_SPAN = 2;
/** Prefer this many side windows on SW non-door; fall back for even spacing. */
const SUPERMARKET_SIDE_WINDOW_COUNT_MAX = 3;
const SUPERMARKET_SIDE_WINDOW_COUNT_MIN = 2;
/** Keep SW non-door SuperWindows ≥ this many tiles from both façade corners. */
const SUPERMARKET_SIDE_CORNER_GAP = 1;
/** SE non-door: exactly 2 windows, each this many tiles from the corners. */
const SUPERMARKET_SE_SIDE_CORNER_GAP = 2;

/**
 * Evenly spaced, centred window starts along a façade.
 * Outer margins and inter-window gaps are equal and ≥ `cornerGap`.
 */
function supermarketSideWindowStarts(
  faceLen: number,
  winSpan: number,
  count: number,
  cornerGap: number,
): number[] | null {
  if (count < 1 || faceLen < count * winSpan + 2 * cornerGap) return null;
  const free = faceLen - count * winSpan;
  const gap = free / (count + 1);
  if (gap + 1e-6 < cornerGap) return null;

  const starts: number[] = [];
  for (let i = 0; i < count; i++) {
    starts.push(Math.round(gap + i * (winSpan + gap)));
  }
  const first = starts[0]!;
  const last = starts[count - 1]!;
  if (first < cornerGap) return null;
  if (last + winSpan > faceLen - cornerGap) return null;
  return starts;
}

/**
 * SE non-door: two windows pinned 2 tiles in from each corner.
 */
function supermarketSeSideWindowStarts(
  faceLen: number,
  winSpan: number,
  cornerGap: number,
): number[] | null {
  const left = cornerGap;
  const right = faceLen - winSpan - cornerGap;
  if (left < 0 || right < left) return null;
  if (right + winSpan > faceLen) return null;
  return [left, right];
}

/**
 * Supermarket windows: each SuperWindow1–6 number is used at most once per
 * building (SE and SW of the same number share that slot). Door façade gets
 * two flanking windows; non-door SE gets two corner-inset windows; non-door SW
 * gets 2–3 evenly spaced. All 2 tiles wide, vertically centred.
 * Red Order–owned markets use SuperWindowBoarded1 on every slot.
 */
function drawSupermarketWindows(
  ctx: CanvasRenderingContext2D,
  scene: Phaser.Scene,
  bld: BuildingFootprint,
  offset: (p: Point) => Point,
  wallDepth: number,
) {
  const ex = bld.entranceX;
  const ey = bld.entranceY;
  if (ex === undefined || ey === undefined) return;
  const doorFace = buildingEntranceFace({
    ox: bld.ox,
    oy: bld.oy,
    w: bld.w,
    h: bld.h,
    entranceX: ex,
    entranceY: ey,
  });
  const sideFace: SuperWindowFace = doorFace === "SE" ? "SW" : "SE";
  const doorSpan = buildingEntranceSpan(bld);
  const winSpan = SUPERMARKET_WINDOW_SPAN;
  const gap = SUPERMARKET_WINDOW_DOOR_GAP;
  const { ox, oy, w, h } = bld;
  let slot = 0;
  const usedVariants = new Set<SuperWindowVariant>();
  const boarded = bld.boarded ?? isRedOrderOwnedSupermarket(ox, oy);
  const boardedArt = boarded ? resolveBoardedSuperWindowSource(scene) : null;

  const spanEdge = (
    face: SuperWindowFace,
    along: number,
  ): { bottomLeft: Point; bottomRight: Point } | null => {
    if (face === "SE") {
      if (along < oy || along + winSpan > oy + h) return null;
      return {
        bottomLeft: offset(cartesianToIso(ox + w, along)),
        bottomRight: offset(cartesianToIso(ox + w, along + winSpan)),
      };
    }
    if (along < ox || along + winSpan > ox + w) return null;
    return {
      bottomLeft: offset(cartesianToIso(along, oy + h)),
      bottomRight: offset(cartesianToIso(along + winSpan, oy + h)),
    };
  };

  const drawAt = (face: SuperWindowFace, along: number) => {
    const art =
      boardedArt ??
      resolveUniqueSuperWindow(
        scene,
        variantSeedOf(bld),
        face,
        slot++,
        usedVariants,
      );
    if (!art) return;
    const edge = spanEdge(face, along);
    if (!edge) return;
    // Face-specific U-flip for wall projection (boarded art is directionless).
    drawSuperWindowOnWallFace(
      ctx,
      art,
      edge.bottomLeft,
      edge.bottomRight,
      wallDepth,
      face === "SE",
    );
  };

  // Door façade: one window each side of the entrance.
  const doorAlongs: number[] = [];
  if (doorFace === "SE") {
    const doorMin = ey;
    const doorMax = ey + doorSpan - 1;
    doorAlongs.push(doorMin - gap - (winSpan - 1));
    doorAlongs.push(doorMax + gap);
  } else {
    const doorMin = ex;
    const doorMax = ex + doorSpan - 1;
    doorAlongs.push(doorMin - gap - (winSpan - 1));
    doorAlongs.push(doorMax + gap);
  }
  for (const along of doorAlongs) drawAt(doorFace, along);

  // Non-door façade.
  const faceLen = sideFace === "SE" ? h : w;
  const sideOrigin = sideFace === "SE" ? oy : ox;

  let starts: number[] | null = null;
  if (sideFace === "SE") {
    starts = supermarketSeSideWindowStarts(
      faceLen,
      winSpan,
      SUPERMARKET_SE_SIDE_CORNER_GAP,
    );
  } else {
    for (
      let count = SUPERMARKET_SIDE_WINDOW_COUNT_MAX;
      count >= SUPERMARKET_SIDE_WINDOW_COUNT_MIN;
      count--
    ) {
      starts = supermarketSideWindowStarts(
        faceLen,
        winSpan,
        count,
        SUPERMARKET_SIDE_CORNER_GAP,
      );
      if (starts) break;
    }
  }
  if (!starts) return;
  for (const start of starts) drawAt(sideFace, sideOrigin + start);
}

/** Hospital front: BigWindow1 width in façade tiles. */
const HOSPITAL_BIG_WINDOW_SPAN = 2;
/** Keep each street-façade BigWindow1 ≥ this many tiles from both corners. */
const HOSPITAL_BIG_WINDOW_CORNER_GAP = 1;
/** BigWindow1 height as a fraction of one storey (landscape). */
const HOSPITAL_BIG_WINDOW_HEIGHT_FRAC = 0.45;
/** Non-street side: windows per storey. */
const HOSPITAL_SIDE_WINDOW_COUNT = 3;
/** Non-street side: gap between consecutive BigWindow1s. */
const HOSPITAL_SIDE_WINDOW_GAP = 1;

/**
 * Side-façade starts: 3×2-tile windows, 1-tile inter-gap, leftover split to
 * corners (≥1 each when faceLen ≥ 10).
 */
function hospitalSideWindowStarts(faceLen: number): number[] | null {
  const count = HOSPITAL_SIDE_WINDOW_COUNT;
  const span = HOSPITAL_BIG_WINDOW_SPAN;
  const inter = HOSPITAL_SIDE_WINDOW_GAP;
  const used = count * span + (count - 1) * inter;
  if (faceLen < used) return null;
  const leftover = faceLen - used;
  // Prefer a 1-tile left inset when only one spare tile (faceLen 9).
  const left = leftover === 1 ? 1 : Math.floor(leftover / 2);
  const starts: number[] = [];
  for (let i = 0; i < count; i++) {
    starts.push(left + i * (span + inter));
  }
  if (starts[count - 1]! + span > faceLen) return null;
  return starts;
}

/**
 * Hospital street façade BigWindow1 layout:
 * - 1st storey: one window each side of the door (2 tiles, 1 tile from corners)
 * - 2nd storey: same side windows + one over the double door (middle 2 tiles)
 */
function drawHospitalWindows(
  ctx: CanvasRenderingContext2D,
  scene: Phaser.Scene,
  bld: BuildingFootprint,
  offset: (p: Point) => Point,
  doorFace: SuperWindowFace,
) {
  const ex = bld.entranceX;
  const ey = bld.entranceY;
  if (ex === undefined || ey === undefined) return;
  const art = resolveBigWindow1Source(scene, doorFace);
  if (!art) return;

  const winSpan = HOSPITAL_BIG_WINDOW_SPAN;
  const cornerGap = HOSPITAL_BIG_WINDOW_CORNER_GAP;
  const { ox, oy, w, h } = bld;
  const faceLen = doorFace === "SE" ? h : w;
  const sideStarts = supermarketSeSideWindowStarts(faceLen, winSpan, cornerGap);
  if (!sideStarts) return;

  const doorSpan = buildingEntranceSpan(bld);
  const doorMin = doorFace === "SE" ? ey : ex;
  const doorMax = doorMin + doorSpan - 1;
  const faceOrigin = doorFace === "SE" ? oy : ox;

  const spanEdge = (
    along: number,
  ): { bottomLeft: Point; bottomRight: Point } | null => {
    if (doorFace === "SE") {
      if (along < oy || along + winSpan > oy + h) return null;
      return {
        bottomLeft: offset(cartesianToIso(ox + w, along)),
        bottomRight: offset(cartesianToIso(ox + w, along + winSpan)),
      };
    }
    if (along < ox || along + winSpan > ox + w) return null;
    return {
      bottomLeft: offset(cartesianToIso(along, oy + h)),
      bottomRight: offset(cartesianToIso(along + winSpan, oy + h)),
    };
  };

  const drawAt = (along: number, storeyIndex: number) => {
    const edge = spanEdge(along);
    if (!edge) return;
    drawSuperWindowOnWallFace(
      ctx,
      art,
      edge.bottomLeft,
      edge.bottomRight,
      WALL_DEPTH,
      doorFace === "SE",
      HOSPITAL_BIG_WINDOW_HEIGHT_FRAC,
      storeyIndex,
    );
  };

  // 1st storey — flank the door (skip any slot that would cover the entrance).
  for (const start of sideStarts) {
    const along = faceOrigin + start;
    if (along + winSpan - 1 >= doorMin && along <= doorMax) continue;
    drawAt(along, 0);
  }

  // 2nd storey — same flanks + middle window directly above the double door.
  for (const start of sideStarts) {
    drawAt(faceOrigin + start, 1);
  }
  if (doorSpan >= winSpan) {
    drawAt(doorMin, 1);
  }
}

/**
 * Hospital non-street façade: replace pre-baked bands with BigWindow1 — 3 per
 * storey (2 tiles, 1-tile gaps, leftover to corners). Lower two storeys sit on
 * the exterior wing; the 3rd sits on the centre tower step above the wing roof.
 */
function drawHospitalSideWindows(
  ctx: CanvasRenderingContext2D,
  scene: Phaser.Scene,
  bld: BuildingFootprint,
  offset: (p: Point) => Point,
  doorFace: SuperWindowFace,
) {
  const sideFace: SuperWindowFace = doorFace === "SE" ? "SW" : "SE";
  const art = resolveBigWindow1Source(scene, sideFace);
  if (!art) return;

  const strips = hospitalMassingStrips(bld);
  const exteriorWing = strips.find((s) => s.kind === "wingB");
  const center = strips.find((s) => s.kind === "center");
  if (!exteriorWing || !center) return;

  const winSpan = HOSPITAL_BIG_WINDOW_SPAN;
  const faceLen = sideFace === "SE" ? exteriorWing.h : exteriorWing.w;
  const faceOrigin = sideFace === "SE" ? exteriorWing.oy : exteriorWing.ox;
  const starts = hospitalSideWindowStarts(faceLen);
  if (!starts) return;

  const spanEdge = (
    strip: HospitalStrip,
    along: number,
  ): { bottomLeft: Point; bottomRight: Point } | null => {
    if (sideFace === "SE") {
      if (along < strip.oy || along + winSpan > strip.oy + strip.h) return null;
      const x = strip.ox + strip.w;
      return {
        bottomLeft: offset(cartesianToIso(x, along)),
        bottomRight: offset(cartesianToIso(x, along + winSpan)),
      };
    }
    if (along < strip.ox || along + winSpan > strip.ox + strip.w) return null;
    const y = strip.oy + strip.h;
    return {
      bottomLeft: offset(cartesianToIso(along, y)),
      bottomRight: offset(cartesianToIso(along + winSpan, y)),
    };
  };

  const drawAt = (
    strip: HospitalStrip,
    along: number,
    storeyIndex: number,
  ) => {
    const edge = spanEdge(strip, along);
    if (!edge) return;
    drawSuperWindowOnWallFace(
      ctx,
      art,
      edge.bottomLeft,
      edge.bottomRight,
      WALL_DEPTH,
      sideFace === "SE",
      HOSPITAL_BIG_WINDOW_HEIGHT_FRAC,
      storeyIndex,
    );
  };

  for (const start of starts) {
    const along = faceOrigin + start;
    drawAt(exteriorWing, along, 0);
    drawAt(exteriorWing, along, 1);
    drawAt(center, along, 2);
  }
}

/** Ground-edge of a single perimeter tile on a visible SE/SW face. */
function wallTileEdge(
  face: "SE" | "SW",
  tx: number,
  ty: number,
  bld: BuildingFootprint,
  offset: (p: Point) => Point,
): { bottomLeft: Point; bottomRight: Point } | null {
  const { ox, oy, w, h } = bld;
  if (face === "SE") {
    if (tx !== ox + w - 1 || ty < oy || ty >= oy + h) return null;
    return {
      bottomLeft: offset(cartesianToIso(ox + w, ty)),
      bottomRight: offset(cartesianToIso(ox + w, ty + 1)),
    };
  }
  if (ty !== oy + h - 1 || tx < ox || tx >= ox + w) return null;
  return {
    bottomLeft: offset(cartesianToIso(tx, oy + h)),
    bottomRight: offset(cartesianToIso(tx + 1, oy + h)),
  };
}

/** Ground-edge of the entrance doorway on a visible cuboid face (may span tiles). */
function entranceWallEdge(
  bld: BuildingFootprint,
  offset: (p: Point) => Point,
): { bottomLeft: Point; bottomRight: Point } | null {
  const { ox, oy, w, h } = bld;
  const ex = bld.entranceX;
  const ey = bld.entranceY;
  if (ex === undefined || ey === undefined) return null;
  const span = buildingEntranceSpan(bld);

  // East face (NE→SE).
  if (ex === ox + w - 1 && ey >= oy && ey + span <= oy + h) {
    return {
      bottomLeft: offset(cartesianToIso(ox + w, ey)),
      bottomRight: offset(cartesianToIso(ox + w, ey + span)),
    };
  }
  // South face (SW→SE).
  if (ey === oy + h - 1 && ex >= ox && ex + span <= ox + w) {
    return {
      bottomLeft: offset(cartesianToIso(ex, oy + h)),
      bottomRight: offset(cartesianToIso(ex + span, oy + h)),
    };
  }
  return null;
}

/**
 * Police station windows: 3 evenly spaced on the SE face (and SW when that is
 * the door wall / for square façades), both storeys. Ground floor skips the door.
 */
function drawPoliceWindows(
  ctx: CanvasRenderingContext2D,
  scene: Phaser.Scene,
  bld: BuildingFootprint,
  offset: (p: Point) => Point,
  wallDepth: number,
) {
  const ex = bld.entranceX;
  const ey = bld.entranceY;
  if (ex === undefined || ey === undefined) return;
  const levels = Math.max(1, Math.round(wallDepth / WALL_DEPTH));

  const { ox, oy, w, h } = bld;
  const doorOnSW = ey === oy + h - 1;

  /** Even centres along a façade of length `faceLen` (7 → tiles 1, 3, 5). */
  const evenSlots = (faceLen: number): number[] => {
    const count = 3;
    const slots: number[] = [];
    for (let i = 0; i < count; i++) {
      slots.push(Math.floor(((2 * i + 1) * faceLen) / (count * 2)));
    }
    return slots;
  };

  const drawFace = (face: SuperWindowFace) => {
    const raw = resolveWindowSource(scene, face);
    if (!raw) return;
    const window = prepareWallOverlay(raw);
    const faceLen = face === "SE" ? h : w;
    const slots = evenSlots(faceLen);
    for (let level = 0; level < levels; level++) {
      for (const slot of slots) {
        const tx = face === "SE" ? ox + w - 1 : ox + slot;
        const ty = face === "SE" ? oy + slot : oy + h - 1;
        // Ground floor: leave the doorway clear.
        if (level === 0 && tx === ex && ty === ey) continue;
        const edge = wallTileEdge(face, tx, ty, bld, offset);
        if (!edge) continue;
        drawWindowOnWallTile(
          ctx,
          window,
          edge.bottomLeft,
          edge.bottomRight,
          level,
          face === "SE",
        );
      }
    }
  };

  // SE always gets the three-window rhythm; SW matches on square footprints.
  drawFace("SE");
  if (doorOnSW || w === h) drawFace("SW");
}

/** Residential house: 50% chance of one Window1 on the non-door façade. */
const HOUSE_WINDOW_CHANCE = 0.5;
/** Keep house Window1 ≥ this many tiles from both façade corners. */
const HOUSE_WINDOW_CORNER_GAP = 1;

/**
 * Stable 50% roll from building origin (same bake → same window presence).
 */
function houseRollsWindow(bld: BuildingFootprint): boolean {
  let h = (Math.imul(variantSeedOf(bld) + 1, 73856093) ^ 0x57a11) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  h = Math.imul(h, 0x7feb352d) >>> 0;
  h = (h ^ (h >>> 15)) >>> 0;
  return h / 0x1_0000_0000 < HOUSE_WINDOW_CHANCE;
}

/**
 * Residential: optional single Window1 on the non-door SE/SW face, ≥1 tile
 * from each corner, using the matching Window1_SE / Window1_SW texture.
 */
function drawHouseWindows(
  ctx: CanvasRenderingContext2D,
  scene: Phaser.Scene,
  bld: BuildingFootprint,
  offset: (p: Point) => Point,
) {
  const ex = bld.entranceX;
  const ey = bld.entranceY;
  if (ex === undefined || ey === undefined) return;
  if (!houseRollsWindow(bld)) return;

  const doorFace = buildingEntranceFace({
    ox: bld.ox,
    oy: bld.oy,
    w: bld.w,
    h: bld.h,
    entranceX: ex,
    entranceY: ey,
  });
  const sideFace: SuperWindowFace = doorFace === "SE" ? "SW" : "SE";
  const raw = resolveWindowSource(scene, sideFace);
  if (!raw) return;
  const window = prepareWallOverlay(raw);

  const { ox, oy, w, h } = bld;
  const faceLen = sideFace === "SE" ? h : w;
  const gap = HOUSE_WINDOW_CORNER_GAP;
  const minSlot = gap;
  const maxSlot = faceLen - 1 - gap;
  if (maxSlot < minSlot) return;

  // Centre the window in the valid inset range.
  const slot = Math.min(
    maxSlot,
    Math.max(minSlot, Math.floor(faceLen / 2)),
  );
  const tx = sideFace === "SE" ? ox + w - 1 : ox + slot;
  const ty = sideFace === "SE" ? oy + slot : oy + h - 1;
  const edge = wallTileEdge(sideFace, tx, ty, bld, offset);
  if (!edge) return;
  drawWindowOnWallTile(
    ctx,
    window,
    edge.bottomLeft,
    edge.bottomRight,
    0,
    sideFace === "SE",
  );
}

function fillPoly(
  ctx: CanvasRenderingContext2D,
  pts: Point[],
  color: string,
) {
  if (pts.length < 3) return;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(pts[0]!.x, pts[0]!.y);
  for (let i = 1; i < pts.length; i++) {
    ctx.lineTo(pts[i]!.x, pts[i]!.y);
  }
  ctx.closePath();
  ctx.fill();
}

/** Inset roof-corner points toward the diamond centre (screen space, already at roof height). */
function insetRoofQuad(pts: [Point, Point, Point, Point], insetPx: number): Point[] {
  const cx = (pts[0].x + pts[1].x + pts[2].x + pts[3].x) / 4;
  const cy = (pts[0].y + pts[1].y + pts[2].y + pts[3].y) / 4;
  return pts.map((p) => {
    const dx = cx - p.x;
    const dy = cy - p.y;
    const len = Math.hypot(dx, dy) || 1;
    const t = Math.min(insetPx / len, 0.4);
    return { x: p.x + dx * t, y: p.y + dy * t };
  });
}

/** Push roof-corner points outward for eave overhang. */
function outsetRoofQuad(pts: [Point, Point, Point, Point], outsetPx: number): Point[] {
  const cx = (pts[0].x + pts[1].x + pts[2].x + pts[3].x) / 4;
  const cy = (pts[0].y + pts[1].y + pts[2].y + pts[3].y) / 4;
  return pts.map((p) => {
    const dx = p.x - cx;
    const dy = p.y - cy;
    const len = Math.hypot(dx, dy) || 1;
    const t = Math.min(outsetPx / len, 0.35);
    return { x: p.x + dx * t, y: p.y + dy * t };
  });
}

/** Bilinear sample on the roof diamond (u west→east, v north→south). */
function roofDeckPoint(
  nw: Point,
  ne: Point,
  se: Point,
  sw: Point,
  depth: number,
  u: number,
  v: number,
): Point {
  const n = lerpPoint(
    { x: nw.x, y: nw.y - depth },
    { x: ne.x, y: ne.y - depth },
    u,
  );
  const s = lerpPoint(
    { x: sw.x, y: sw.y - depth },
    { x: se.x, y: se.y - depth },
    u,
  );
  return lerpPoint(n, s, v);
}

/** Raised iso box sitting on the roof deck (hatch, etc.). */
function drawRoofPropBox(
  ctx: CanvasRenderingContext2D,
  nw: Point,
  ne: Point,
  se: Point,
  sw: Point,
  depth: number,
  u0: number,
  v0: number,
  u1: number,
  v1: number,
  boxH: number,
  topColor: string,
  sideColor: string,
  frontColor: string,
) {
  const bl = roofDeckPoint(nw, ne, se, sw, depth, u0, v1); // SW
  const br = roofDeckPoint(nw, ne, se, sw, depth, u1, v1); // SE
  const tr = roofDeckPoint(nw, ne, se, sw, depth, u1, v0); // NE
  const tl = roofDeckPoint(nw, ne, se, sw, depth, u0, v0); // NW
  const raise = (p: Point): Point => ({ x: p.x, y: p.y - boxH });
  const tBl = raise(bl);
  const tBr = raise(br);
  const tTr = raise(tr);
  const tTl = raise(tl);

  // SW face then SE face, then top (iso draw order).
  fillPoly(ctx, [bl, br, tBr, tBl], frontColor);
  fillPoly(ctx, [br, tr, tTr, tBr], sideColor);
  fillPoly(ctx, [tTl, tTr, tBr, tBl], topColor);
}

function fillPoliceRoof(
  ctx: CanvasRenderingContext2D,
  nw: Point,
  ne: Point,
  se: Point,
  sw: Point,
  depth: number,
  bld?: BuildingFootprint,
) {
  const deckColor = roofColorForType("police_station");
  const lipH = POLICE_ROOF_LIP_HEIGHT;
  const lipInset = WAREHOUSE_ROOF_LIP_INSET;
  const lipTop = CLADDING_FRONT;
  const lipFace = CLADDING_SIDE;

  fillParapetRoof(
    ctx,
    nw,
    ne,
    se,
    sw,
    depth,
    deckColor,
    lipTop,
    lipFace,
    lipH,
    lipInset,
    bld,
    "police_station",
  );

  // Access hatch near the NW corner.
  drawRoofPropBox(
    ctx, nw, ne, se, sw, depth,
    0.14, 0.14, 0.30, 0.30,
    Math.min(3, POLICE_ROOF_PROP_HEIGHT),
    "#8a96a4",
    "#6a7684",
    "#7a8694",
  );
}

/** Flat roof deck + inset parapet lip (police / hospital / shared). */
function fillParapetRoof(
  ctx: CanvasRenderingContext2D,
  nw: Point,
  ne: Point,
  se: Point,
  sw: Point,
  depth: number,
  deckColor: string,
  lipTop: string,
  lipFace: string,
  lipH = POLICE_ROOF_LIP_HEIGHT,
  lipInset = WAREHOUSE_ROOF_LIP_INSET,
  bld?: BuildingFootprint,
  buildingType?: BuildingType,
) {
  const outerDeck: [Point, Point, Point, Point] = [
    { x: nw.x, y: nw.y - depth },
    { x: ne.x, y: ne.y - depth },
    { x: se.x, y: se.y - depth },
    { x: sw.x, y: sw.y - depth },
  ];
  const innerDeck = insetRoofQuad(outerDeck, lipInset) as [
    Point,
    Point,
    Point,
    Point,
  ];
  const outerLip: [Point, Point, Point, Point] = [
    { x: nw.x, y: nw.y - depth - lipH },
    { x: ne.x, y: ne.y - depth - lipH },
    { x: se.x, y: se.y - depth - lipH },
    { x: sw.x, y: sw.y - depth - lipH },
  ];
  const innerLip = insetRoofQuad(outerLip, lipInset) as [
    Point,
    Point,
    Point,
    Point,
  ];

  fillPoly(ctx, outerDeck, deckColor);

  fillPoly(ctx, [outerDeck[0]!, outerDeck[1]!, outerLip[1]!, outerLip[0]!], lipTop);
  fillPoly(ctx, [outerDeck[0]!, outerDeck[3]!, outerLip[3]!, outerLip[0]!], lipTop);
  fillPoly(ctx, [innerDeck[0]!, innerDeck[1]!, innerLip[1]!, innerLip[0]!], lipTop);
  fillPoly(ctx, [innerDeck[0]!, innerDeck[3]!, innerLip[3]!, innerLip[0]!], lipTop);

  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    fillPoly(
      ctx,
      [outerLip[i]!, outerLip[j]!, innerLip[j]!, innerLip[i]!],
      lipTop,
    );
  }

  fillPoly(ctx, [outerDeck[3]!, outerDeck[2]!, outerLip[2]!, outerLip[3]!], lipFace);
  fillPoly(ctx, [outerDeck[1]!, outerDeck[2]!, outerLip[2]!, outerLip[1]!], lipFace);
  fillPoly(ctx, [innerDeck[3]!, innerDeck[2]!, innerLip[2]!, innerLip[3]!], lipFace);
  fillPoly(ctx, [innerDeck[1]!, innerDeck[2]!, innerLip[2]!, innerLip[1]!], lipFace);

  if (bld) {
    paintRoofDecals(
      ctx,
      [innerLip],
      `${roofWearKey(bld, "parapet")}:${depth}`,
      buildingType ?? bld.buildingType,
    );
  }
}

/** Flat supermarket roof with parapet lip + mechanical / skylight clutter. */
function fillSupermarketRoof(
  ctx: CanvasRenderingContext2D,
  nw: Point,
  ne: Point,
  se: Point,
  sw: Point,
  depth: number,
  bld: BuildingFootprint,
) {
  const deckColor = roofColorForType("supermarket");
  const lipH = POLICE_ROOF_LIP_HEIGHT;
  const lipInset = WAREHOUSE_ROOF_LIP_INSET;
  const lipTop = SUPERMARKET_ROOF_LIP;
  const lipFace = SUPERMARKET_ROOF_LIP_FACE;

  const outerDeck: [Point, Point, Point, Point] = [
    { x: nw.x, y: nw.y - depth },
    { x: ne.x, y: ne.y - depth },
    { x: se.x, y: se.y - depth },
    { x: sw.x, y: sw.y - depth },
  ];
  const innerDeck = insetRoofQuad(outerDeck, lipInset) as [
    Point,
    Point,
    Point,
    Point,
  ];
  const outerLip: [Point, Point, Point, Point] = [
    { x: nw.x, y: nw.y - depth - lipH },
    { x: ne.x, y: ne.y - depth - lipH },
    { x: se.x, y: se.y - depth - lipH },
    { x: sw.x, y: sw.y - depth - lipH },
  ];
  const innerLip = insetRoofQuad(outerLip, lipInset) as [
    Point,
    Point,
    Point,
    Point,
  ];

  fillPoly(ctx, outerDeck, deckColor);

  fillPoly(ctx, [outerDeck[0]!, outerDeck[1]!, outerLip[1]!, outerLip[0]!], lipTop);
  fillPoly(ctx, [outerDeck[0]!, outerDeck[3]!, outerLip[3]!, outerLip[0]!], lipTop);
  fillPoly(ctx, [innerDeck[0]!, innerDeck[1]!, innerLip[1]!, innerLip[0]!], lipTop);
  fillPoly(ctx, [innerDeck[0]!, innerDeck[3]!, innerLip[3]!, innerLip[0]!], lipTop);

  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    fillPoly(
      ctx,
      [outerLip[i]!, outerLip[j]!, innerLip[j]!, innerLip[i]!],
      lipTop,
    );
  }

  fillPoly(ctx, [outerDeck[3]!, outerDeck[2]!, outerLip[2]!, outerLip[3]!], lipFace);
  fillPoly(ctx, [outerDeck[1]!, outerDeck[2]!, outerLip[2]!, outerLip[1]!], lipFace);
  fillPoly(ctx, [innerDeck[3]!, innerDeck[2]!, innerLip[2]!, innerLip[3]!], lipFace);
  fillPoly(ctx, [innerDeck[1]!, innerDeck[2]!, innerLip[2]!, innerLip[1]!], lipFace);

  paintRoofDecals(ctx, [innerLip], roofWearKey(bld, "market"), "supermarket");
  drawSupermarketRoofProps(ctx, nw, ne, se, sw, depth, bld);
}

/**
 * Sparse supermarket roof clutter: one RTU, optional condenser, hatch,
 * one skylight, and a vent — corners + gaps so the deck reads open.
 * Mirror east/west from building origin hash.
 */
function drawSupermarketRoofProps(
  ctx: CanvasRenderingContext2D,
  nw: Point,
  ne: Point,
  se: Point,
  sw: Point,
  depth: number,
  bld: BuildingFootprint,
) {
  let h = Math.imul(variantSeedOf(bld) + 1, 73856093) >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d) >>> 0;
  const flipU = (h & 1) === 1;
  const withCondenser = ((h >>> 1) & 1) === 1;
  const u = (a: number, b: number): [number, number] =>
    flipU ? [1 - b, 1 - a] : [a, b];

  const box = (
    u0: number,
    v0: number,
    u1: number,
    v1: number,
    boxH: number,
    top: string,
    side: string,
    front: string,
  ) => {
    drawRoofPropBox(
      ctx,
      nw,
      ne,
      se,
      sw,
      depth,
      u0,
      v0,
      u1,
      v1,
      boxH,
      top,
      side,
      front,
    );
  };

  // Metal HVAC palette (weathered grey).
  const hvacTop = "#9aa2aa";
  const hvacSide = "#6a727a";
  const hvacFront = "#7e868e";
  const hvacTopDark = "#8a929a";
  // Skylight — chalky polycarbonate.
  const skyTop = "#c8d6de";
  const skySide = "#8a9aa4";
  const skyFront = "#9aabb4";
  // Access hatch.
  const hatchTop = "#8a96a4";
  const hatchSide = "#6a7684";
  const hatchFront = "#7a8694";

  // Draw back→front (low v → high v) for iso occlusion.
  // Large rooftop unit — NW corner.
  {
    const [u0, u1] = u(0.12, 0.32);
    box(u0, 0.12, u1, 0.30, SUPERMARKET_ROOF_PROP_HEIGHT * 0.85, hvacTop, hvacSide, hvacFront);
  }
  // Smaller condenser opposite the RTU (skip half the roofs).
  if (withCondenser) {
    const [u0, u1] = u(0.70, 0.86);
    box(u0, 0.14, u1, 0.26, SUPERMARKET_ROOF_PROP_HEIGHT * 0.45, hvacTopDark, hvacSide, hvacFront);
  }
  // Access hatch — mid-west, clear of HVAC.
  {
    const [u0, u1] = u(0.14, 0.24);
    box(u0, 0.52, u1, 0.62, 3, hatchTop, hatchSide, hatchFront);
  }
  // Single skylight — street-side, leaving open deck around it.
  {
    const [u0, u1] = u(0.42, 0.62);
    box(u0, 0.62, u1, 0.76, 1.8, skyTop, skySide, skyFront);
  }
  // Exhaust stack — far SE corner.
  {
    const [u0, u1] = u(0.84, 0.90);
    box(u0, 0.78, u1, 0.86, SUPERMARKET_ROOF_PROP_HEIGHT, hvacTopDark, hvacSide, hvacFront);
  }
}

function roofWearKey(bld: BuildingFootprint, tag: string) {
  return `${tag}:${bld.buildingType ?? ""}:${bld.variantSeed ?? 0}:${bld.w}x${bld.h}`;
}

function wallWearKey(bld: BuildingFootprint, tag: string) {
  return `wall:${tag}:${bld.buildingType ?? ""}:${bld.variantSeed ?? 0}:${bld.w}x${bld.h}`;
}

function paintStandardWallWear(
  ctx: CanvasRenderingContext2D,
  sw: Point,
  se: Point,
  ne: Point,
  depth: number,
  bld: BuildingFootprint | undefined,
  tag = "faces",
) {
  if (!bld) return;
  paintCuboidWallDecals(
    ctx,
    sw,
    se,
    ne,
    depth,
    wallWearKey(bld, tag),
    bld.buildingType,
  );
}

function paintGableRoofWear(
  ctx: CanvasRenderingContext2D,
  light: RoofFace,
  dark: RoofFace,
  bld: BuildingFootprint | undefined,
  buildingType: BuildingType,
) {
  if (!bld) return;
  paintRoofDecals(ctx, [light, dark], roofWearKey(bld, "gable"), buildingType);
}

function fillHouseGabledRoof(
  ctx: CanvasRenderingContext2D,
  nw: Point,
  ne: Point,
  se: Point,
  sw: Point,
  depth: number,
  axis: "EW" | "NS",
  bld?: BuildingFootprint,
) {
  const peak = HOUSE_ROOF_PEAK_HEIGHT;
  const base = roofColorForType("house");
  // Soft iso shading — avoid bright pops against brick walls.
  const lightSlope = shadeHex(base, 1.06);
  const darkSlope = shadeHex(base, 0.82);
  // Gable reads as weathered siding, not a second roof plane.
  const gableEnd = "#7a6e60";
  const fascia = shadeHex(base, 0.55);

  const wallDeck: [Point, Point, Point, Point] = [
    { x: nw.x, y: nw.y - depth },
    { x: ne.x, y: ne.y - depth },
    { x: se.x, y: se.y - depth },
    { x: sw.x, y: sw.y - depth },
  ];
  const [dNw, dNe, dSe, dSw] = outsetRoofQuad(
    wallDeck,
    HOUSE_ROOF_OVERHANG,
  ) as [Point, Point, Point, Point];

  // Thin fascia under the visible eaves (SW + SE) before the slopes cover them.
  fillPoly(ctx, [wallDeck[3]!, wallDeck[2]!, dSe, dSw], fascia);
  fillPoly(ctx, [wallDeck[1]!, wallDeck[2]!, dSe, dNe], fascia);

  // Two pitched faces + only the camera-facing gable end (SE or SW).
  // NW/NE gables are never visible from the SE viewpoint.
  if (axis === "EW") {
    const ridgeW = raisePoint(lerpPoint(dNw, dSw, 0.5), peak);
    const ridgeE = raisePoint(lerpPoint(dNe, dSe, 0.5), peak);
    fillPoly(ctx, [dNw, dNe, ridgeE, ridgeW], lightSlope);
    fillPoly(ctx, [dSw, dSe, ridgeE, ridgeW], darkSlope);
    // East gable (SE end) — fills the gap at the short end.
    fillPoly(ctx, [dNe, dSe, ridgeE], gableEnd);
    paintGableRoofWear(ctx, [dNw, dNe, ridgeE, ridgeW], [dSw, dSe, ridgeE, ridgeW], bld, "house");
    return;
  }

  const ridgeN = raisePoint(lerpPoint(dNw, dNe, 0.5), peak);
  const ridgeS = raisePoint(lerpPoint(dSw, dSe, 0.5), peak);
  fillPoly(ctx, [dNw, dSw, ridgeS, ridgeN], lightSlope);
  fillPoly(ctx, [dNe, dSe, ridgeS, ridgeN], darkSlope);
  // South gable (SW end) — fills the gap at the short end.
  fillPoly(ctx, [dSw, dSe, ridgeS], gableEnd);
  paintGableRoofWear(ctx, [dNw, dSw, ridgeS, ridgeN], [dNe, dSe, ridgeS, ridgeN], bld, "house");
}

/** Brick chimney stack on the chosen exterior roof tile (above the gable peak). */
function drawHouseChimney(
  ctx: CanvasRenderingContext2D,
  nw: Point,
  ne: Point,
  se: Point,
  sw: Point,
  depth: number,
  bld: BuildingFootprint,
) {
  if (bld.chimneyX == null || bld.chimneyY == null) return;
  const { ox, oy, w, h } = bld;
  const lx = bld.chimneyX - ox;
  const ly = bld.chimneyY - oy;
  if (lx < 0 || ly < 0 || lx >= w || ly >= h) return;

  // Shrink inside the tile so it reads as a stack, not a full roof bay.
  const padU = 0.22 / w;
  const padV = 0.22 / h;
  const u0 = lx / w + padU;
  const v0 = ly / h + padV;
  const u1 = (lx + 1) / w - padU;
  const v1 = (ly + 1) / h - padV;
  if (u1 <= u0 || v1 <= v0) return;

  // Rise from wall plate through the gable so the pot clears the ridge.
  const stackH = HOUSE_ROOF_PEAK_HEIGHT + HOUSE_CHIMNEY_HEIGHT;
  drawRoofPropBox(
    ctx,
    nw,
    ne,
    se,
    sw,
    depth,
    u0,
    v0,
    u1,
    v1,
    stackH,
    "#6a5a4e",
    "#4e433a",
    "#5a4c42",
  );
  // Darker cap / flue lip on top.
  const capInsetU = (u1 - u0) * 0.18;
  const capInsetV = (v1 - v0) * 0.18;
  drawRoofPropBox(
    ctx,
    nw,
    ne,
    se,
    sw,
    depth + stackH,
    u0 + capInsetU,
    v0 + capInsetV,
    u1 - capInsetU,
    v1 - capInsetV,
    Math.max(2, Math.round(HOUSE_CHIMNEY_HEIGHT * 0.22)),
    "#3a322c",
    "#2a2420",
    "#322a24",
  );
}

function fillRoof(
  ctx: CanvasRenderingContext2D,
  nw: Point,
  ne: Point,
  se: Point,
  sw: Point,
  depth: number,
  bld?: BuildingFootprint,
) {
  const buildingType = bld?.buildingType;
  if (buildingType === "police_station") {
    fillPoliceRoof(ctx, nw, ne, se, sw, depth, bld);
    return;
  }

  if (buildingType === "supermarket") {
    fillSupermarketRoof(ctx, nw, ne, se, sw, depth, bld!);
    return;
  }

  if (buildingType === "hospital") {
    fillParapetRoof(
      ctx,
      nw,
      ne,
      se,
      sw,
      depth,
      roofColorForType("hospital"),
      HOSPITAL_ROOF_LIP,
      HOSPITAL_ROOF_LIP_FACE,
      POLICE_ROOF_LIP_HEIGHT,
      WAREHOUSE_ROOF_LIP_INSET,
      bld,
      "hospital",
    );
    return;
  }

  if (buildingType === "house") {
    fillHouseGabledRoof(ctx, nw, ne, se, sw, depth, gableRidgeAxis(bld!), bld);
    drawHouseChimney(ctx, nw, ne, se, sw, depth, bld!);
    return;
  }

  if (buildingType === "warehouse") {
    fillWarehouseRoof(ctx, nw, ne, se, sw, depth, bld!);
    return;
  }

  if (buildingType === "motel") {
    fillMotelRoof(ctx, nw, ne, se, sw, depth, bld!);
    return;
  }

  if (buildingType === "tent") {
    fillTentRoof(ctx, nw, ne, se, sw, depth, bld!);
    return;
  }

  if (buildingType === "mess_hall") {
    fillMessHallRoof(ctx, nw, ne, se, sw, depth, bld!);
    return;
  }

  fillPoly(
    ctx,
    [
      { x: nw.x, y: nw.y - depth },
      { x: ne.x, y: ne.y - depth },
      { x: se.x, y: se.y - depth },
      { x: sw.x, y: sw.y - depth },
    ],
    roofColorForType(buildingType),
  );
  if (bld) {
    paintRoofDecals(
      ctx,
      [
        [
          { x: nw.x, y: nw.y - depth },
          { x: ne.x, y: ne.y - depth },
          { x: se.x, y: se.y - depth },
          { x: sw.x, y: sw.y - depth },
        ],
      ],
      roofWearKey(bld, "flat"),
      buildingType,
    );
  }
}

function fillWarehouseRoof(
  ctx: CanvasRenderingContext2D,
  nw: Point,
  ne: Point,
  se: Point,
  sw: Point,
  depth: number,
  bld: BuildingFootprint,
) {
  const peak = WAREHOUSE_ROOF_PEAK_HEIGHT;
  const lightSlope = shadeHex(WAREHOUSE_ROOF_DECK, 1.05);
  const darkSlope = shadeHex(WAREHOUSE_ROOF_DECK, 0.86);
  const gableEnd = shadeHex(WAREHOUSE_ROOF_DECK, 0.94);

  const deck: [Point, Point, Point, Point] = [
    { x: nw.x, y: nw.y - depth },
    { x: ne.x, y: ne.y - depth },
    { x: se.x, y: se.y - depth },
    { x: sw.x, y: sw.y - depth },
  ];
  const [dNw, dNe, dSe, dSw] = deck;

  if (gableRidgeAxis(bld) === "EW") {
    const ridgeW = raisePoint(lerpPoint(dNw, dSw, 0.5), peak);
    const ridgeE = raisePoint(lerpPoint(dNe, dSe, 0.5), peak);
    fillPoly(ctx, [dNw, dNe, ridgeE, ridgeW], lightSlope);
    fillPoly(ctx, [dSw, dSe, ridgeE, ridgeW], darkSlope);
    fillPoly(ctx, [dNe, dSe, ridgeE], gableEnd);
    paintGableRoofWear(ctx, [dNw, dNe, ridgeE, ridgeW], [dSw, dSe, ridgeE, ridgeW], bld, "warehouse");
  } else {
    const ridgeN = raisePoint(lerpPoint(dNw, dNe, 0.5), peak);
    const ridgeS = raisePoint(lerpPoint(dSw, dSe, 0.5), peak);
    fillPoly(ctx, [dNw, dSw, ridgeS, ridgeN], lightSlope);
    fillPoly(ctx, [dNe, dSe, ridgeS, ridgeN], darkSlope);
    fillPoly(ctx, [dSw, dSe, ridgeS], gableEnd);
    paintGableRoofWear(ctx, [dNw, dSw, ridgeS, ridgeN], [dNe, dSe, ridgeS, ridgeN], bld, "warehouse");
  }
}

/** Warm asphalt gable — same language as house roofs, quieter than metal. */
function fillMotelRoof(
  ctx: CanvasRenderingContext2D,
  nw: Point,
  ne: Point,
  se: Point,
  sw: Point,
  depth: number,
  bld: BuildingFootprint,
) {
  const peak = MOTEL_ROOF_PEAK_HEIGHT;
  const lightSlope = shadeHex(MOTEL_ROOF_DECK, 1.06);
  const darkSlope = shadeHex(MOTEL_ROOF_DECK, 0.82);
  const fascia = shadeHex(MOTEL_ROOF_DECK, 0.55);
  const wallDeck: [Point, Point, Point, Point] = [
    { x: nw.x, y: nw.y - depth },
    { x: ne.x, y: ne.y - depth },
    { x: se.x, y: se.y - depth },
    { x: sw.x, y: sw.y - depth },
  ];
  const deck = outsetRoofQuad(wallDeck, MOTEL_ROOF_OVERHANG) as [
    Point,
    Point,
    Point,
    Point,
  ];
  const [dNw, dNe, dSe, dSw] = deck;

  fillPoly(ctx, [wallDeck[3]!, wallDeck[2]!, dSe, dSw], fascia);
  fillPoly(ctx, [wallDeck[1]!, wallDeck[2]!, dSe, dNe], fascia);

  if (gableRidgeAxis(bld) === "EW") {
    const ridgeW = raisePoint(lerpPoint(dNw, dSw, 0.5), peak);
    const ridgeE = raisePoint(lerpPoint(dNe, dSe, 0.5), peak);
    fillPoly(ctx, [dNw, dNe, ridgeE, ridgeW], lightSlope);
    fillPoly(ctx, [dSw, dSe, ridgeE, ridgeW], darkSlope);
    fillPoly(ctx, [dNe, dSe, ridgeE], MOTEL_GABLE);
    paintGableRoofWear(ctx, [dNw, dNe, ridgeE, ridgeW], [dSw, dSe, ridgeE, ridgeW], bld, "motel");
  } else {
    const ridgeN = raisePoint(lerpPoint(dNw, dNe, 0.5), peak);
    const ridgeS = raisePoint(lerpPoint(dSw, dSe, 0.5), peak);
    fillPoly(ctx, [dNw, dSw, ridgeS, ridgeN], lightSlope);
    fillPoly(ctx, [dNe, dSe, ridgeS, ridgeN], darkSlope);
    fillPoly(ctx, [dSw, dSe, ridgeS], MOTEL_GABLE);
    paintGableRoofWear(ctx, [dNw, dSw, ridgeS, ridgeN], [dNe, dSe, ridgeS, ridgeN], bld, "motel");
  }
}

/** Steep olive canvas gable — same language as the motel roof, military palette. */
function fillTentRoof(
  ctx: CanvasRenderingContext2D,
  nw: Point,
  ne: Point,
  se: Point,
  sw: Point,
  depth: number,
  bld: BuildingFootprint,
) {
  const peak = TENT_ROOF_PEAK_HEIGHT;
  const lightSlope = shadeHex(TENT_ROOF_DECK, 1.08);
  const darkSlope = shadeHex(TENT_ROOF_DECK, 0.78);
  const fascia = shadeHex(TENT_ROOF_DECK, 0.52);
  const wallDeck: [Point, Point, Point, Point] = [
    { x: nw.x, y: nw.y - depth },
    { x: ne.x, y: ne.y - depth },
    { x: se.x, y: se.y - depth },
    { x: sw.x, y: sw.y - depth },
  ];
  const deck = outsetRoofQuad(wallDeck, TENT_ROOF_OVERHANG) as [
    Point,
    Point,
    Point,
    Point,
  ];
  const [dNw, dNe, dSe, dSw] = deck;

  fillPoly(ctx, [wallDeck[3]!, wallDeck[2]!, dSe, dSw], fascia);
  fillPoly(ctx, [wallDeck[1]!, wallDeck[2]!, dSe, dNe], fascia);

  if (gableRidgeAxis(bld) === "EW") {
    const ridgeW = raisePoint(lerpPoint(dNw, dSw, 0.5), peak);
    const ridgeE = raisePoint(lerpPoint(dNe, dSe, 0.5), peak);
    fillPoly(ctx, [dNw, dNe, ridgeE, ridgeW], lightSlope);
    fillPoly(ctx, [dSw, dSe, ridgeE, ridgeW], darkSlope);
    fillPoly(ctx, [dNe, dSe, ridgeE], TENT_GABLE);
    paintGableRoofWear(ctx, [dNw, dNe, ridgeE, ridgeW], [dSw, dSe, ridgeE, ridgeW], bld, "tent");
  } else {
    const ridgeN = raisePoint(lerpPoint(dNw, dNe, 0.5), peak);
    const ridgeS = raisePoint(lerpPoint(dSw, dSe, 0.5), peak);
    fillPoly(ctx, [dNw, dSw, ridgeS, ridgeN], lightSlope);
    fillPoly(ctx, [dNe, dSe, ridgeS, ridgeN], darkSlope);
    fillPoly(ctx, [dSw, dSe, ridgeS], TENT_GABLE);
    paintGableRoofWear(ctx, [dNw, dSw, ridgeS, ridgeN], [dNe, dSe, ridgeS, ridgeN], bld, "tent");
  }
}

function fillMessHallRoof(
  ctx: CanvasRenderingContext2D,
  nw: Point,
  ne: Point,
  se: Point,
  sw: Point,
  depth: number,
  bld: BuildingFootprint,
) {
  const peak = MOTEL_ROOF_PEAK_HEIGHT;
  const lightSlope = shadeHex(MESS_HALL_ROOF_DECK, 1.08);
  const darkSlope = shadeHex(MESS_HALL_ROOF_DECK, 0.8);
  const fascia = shadeHex(MESS_HALL_ROOF_DECK, 0.52);
  const wallDeck: [Point, Point, Point, Point] = [
    { x: nw.x, y: nw.y - depth },
    { x: ne.x, y: ne.y - depth },
    { x: se.x, y: se.y - depth },
    { x: sw.x, y: sw.y - depth },
  ];
  const deck = outsetRoofQuad(wallDeck, MESS_HALL_ROOF_OVERHANG) as [
    Point,
    Point,
    Point,
    Point,
  ];
  const [dNw, dNe, dSe, dSw] = deck;

  fillPoly(ctx, [wallDeck[3]!, wallDeck[2]!, dSe, dSw], fascia);
  fillPoly(ctx, [wallDeck[1]!, wallDeck[2]!, dSe, dNe], fascia);

  if (gableRidgeAxis(bld) === "EW") {
    const ridgeW = raisePoint(lerpPoint(dNw, dSw, 0.5), peak);
    const ridgeE = raisePoint(lerpPoint(dNe, dSe, 0.5), peak);
    fillPoly(ctx, [dNw, dNe, ridgeE, ridgeW], lightSlope);
    fillPoly(ctx, [dSw, dSe, ridgeE, ridgeW], darkSlope);
    fillPoly(ctx, [dNe, dSe, ridgeE], MESS_HALL_GABLE);
    paintGableRoofWear(ctx, [dNw, dNe, ridgeE, ridgeW], [dSw, dSe, ridgeE, ridgeW], bld, "mess_hall");
  } else {
    const ridgeN = raisePoint(lerpPoint(dNw, dNe, 0.5), peak);
    const ridgeS = raisePoint(lerpPoint(dSw, dSe, 0.5), peak);
    fillPoly(ctx, [dNw, dSw, ridgeS, ridgeN], lightSlope);
    fillPoly(ctx, [dNe, dSe, ridgeS, ridgeN], darkSlope);
    fillPoly(ctx, [dSw, dSe, ridgeS], MESS_HALL_GABLE);
    paintGableRoofWear(ctx, [dNw, dSw, ridgeS, ridgeN], [dNe, dSe, ridgeS, ridgeN], bld, "mess_hall");
  }
}

function drawTentWindowFlaps(
  ctx: CanvasRenderingContext2D,
  bld: BuildingFootprint,
  offset: (p: Point) => Point,
  wallDepth: number,
) {
  const ex = bld.entranceX;
  const ey = bld.entranceY;
  if (ex === undefined || ey === undefined) return;
  const { ox, oy, w, h } = bld;
  const span = buildingEntranceSpan(bld);
  const flapTiles: { tx: number; ty: number }[] = [];
  if (ey > oy) flapTiles.push({ tx: ox + w - 1, ty: ey - 1 });
  if (ey + span < oy + h) flapTiles.push({ tx: ox + w - 1, ty: ey + span });
  for (const { tx, ty } of flapTiles) {
    const edge = wallTileEdge("SE", tx, ty, bld, offset);
    if (!edge) continue;
    const along = (t: number) => lerpPoint(edge.bottomLeft, edge.bottomRight, t);
    const lift = (p: Point, v: number) => ({
      x: p.x,
      y: p.y - wallDepth * v,
    });
    fillPoly(
      ctx,
      [
        lift(along(0.28), 0.38),
        lift(along(0.72), 0.38),
        lift(along(0.72), 0.72),
        lift(along(0.28), 0.72),
      ],
      TENT_FLAP,
    );
  }
}

function paintTentBuilding(
  scene: Phaser.Scene,
  bld: BuildingFootprint,
  ctx: CanvasRenderingContext2D,
  offset: (p: Point) => Point,
) {
  const d = buildingWallScreenDepth(bld);
  const oNw = offset(cartesianToIso(bld.ox, bld.oy));
  const oNe = offset(cartesianToIso(bld.ox + bld.w, bld.oy));
  const oSe = offset(cartesianToIso(bld.ox + bld.w, bld.oy + bld.h));
  const oSw = offset(cartesianToIso(bld.ox, bld.oy + bld.h));

  fillPoly(
    ctx,
    [
      oSw,
      oSe,
      { x: oSe.x, y: oSe.y - d },
      { x: oSw.x, y: oSw.y - d },
    ],
    TENT_WALL_FRONT,
  );
  fillPoly(
    ctx,
    [
      oNe,
      oSe,
      { x: oSe.x, y: oSe.y - d },
      { x: oNe.x, y: oNe.y - d },
    ],
    TENT_WALL_SIDE,
  );

  drawTentWindowFlaps(ctx, bld, offset, d);

  const door = resolveDoorSource(scene, bld);
  const edge = door ? entranceWallEdge(bld, offset) : null;
  if (door && edge) {
    drawDoorOnEntranceFace(
      ctx,
      door,
      edge.bottomLeft,
      edge.bottomRight,
      d,
      false,
      0.9,
    );
  }
  paintStandardWallWear(ctx, oSw, oSe, oNe, d, bld);

  fillTentRoof(ctx, oNw, oNe, oSe, oSw, d, bld);
}

function paintMessHallBuilding(
  scene: Phaser.Scene,
  bld: BuildingFootprint,
  ctx: CanvasRenderingContext2D,
  offset: (p: Point) => Point,
) {
  const d = buildingWallScreenDepth(bld);
  const oNw = offset(cartesianToIso(bld.ox, bld.oy));
  const oNe = offset(cartesianToIso(bld.ox + bld.w, bld.oy));
  const oSe = offset(cartesianToIso(bld.ox + bld.w, bld.oy + bld.h));
  const oSw = offset(cartesianToIso(bld.ox, bld.oy + bld.h));

  fillPoly(
    ctx,
    [
      oSw,
      oSe,
      { x: oSe.x, y: oSe.y - d },
      { x: oSw.x, y: oSw.y - d },
    ],
    MESS_HALL_WALL_FRONT,
  );
  fillPoly(
    ctx,
    [
      oNe,
      oSe,
      { x: oSe.x, y: oSe.y - d },
      { x: oNe.x, y: oNe.y - d },
    ],
    MESS_HALL_WALL_SIDE,
  );

  const door = resolveDoorSource(scene, bld);
  const edge = door ? entranceWallEdge(bld, offset) : null;
  if (door && edge) {
    drawDoorOnEntranceFace(
      ctx,
      door,
      edge.bottomLeft,
      edge.bottomRight,
      d,
      true,
      0.8,
    );
  }
  paintStandardWallWear(ctx, oSw, oSe, oNe, d, bld);

  fillMessHallRoof(ctx, oNw, oNe, oSe, oSw, d, bld);
}

/**
 * Street-face ground edge endpoints for the entrance wall (full façade length),
 * plus a unit outward offset in screen space for porch / bushes.
 */
function motelStreetFace(
  bld: BuildingFootprint,
  offset: (p: Point) => Point,
): {
  face: SuperWindowFace;
  a: Point;
  b: Point;
  out: Point;
} | null {
  if (bld.entranceX == null || bld.entranceY == null) return null;
  const face = buildingEntranceFace({
    ox: bld.ox,
    oy: bld.oy,
    w: bld.w,
    h: bld.h,
    entranceX: bld.entranceX,
    entranceY: bld.entranceY,
  });
  const { ox, oy, w, h } = bld;
  const a =
    face === "SE"
      ? offset(cartesianToIso(ox + w, oy))
      : offset(cartesianToIso(ox, oy + h));
  const b =
    face === "SE"
      ? offset(cartesianToIso(ox + w, oy + h))
      : offset(cartesianToIso(ox + w, oy + h));
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  // Perpendicular pointing "out" of the building (away from footprint centre).
  const cx = offset(cartesianToIso(ox + w / 2, oy + h / 2));
  const mid = lerpPoint(a, b, 0.5);
  let oxN = -dy / len;
  let oyN = dx / len;
  const toMidX = mid.x - cx.x;
  const toMidY = mid.y - cx.y;
  if (oxN * toMidX + oyN * toMidY < 0) {
    oxN = -oxN;
    oyN = -oyN;
  }
  return { face, a, b, out: { x: oxN, y: oyN } };
}

function paintMotelBuilding(
  scene: Phaser.Scene,
  bld: BuildingFootprint,
  ctx: CanvasRenderingContext2D,
  offset: (p: Point) => Point,
) {
  const d = buildingWallScreenDepth(bld);
  const oNw = offset(cartesianToIso(bld.ox, bld.oy));
  const oNe = offset(cartesianToIso(bld.ox + bld.w, bld.oy));
  const oSe = offset(cartesianToIso(bld.ox + bld.w, bld.oy + bld.h));
  const oSw = offset(cartesianToIso(bld.ox, bld.oy + bld.h));

  fillPoly(
    ctx,
    [
      oSw,
      oSe,
      { x: oSe.x, y: oSe.y - d },
      { x: oSw.x, y: oSw.y - d },
    ],
    MOTEL_WALL_FRONT,
  );
  fillPoly(
    ctx,
    [
      oNe,
      oSe,
      { x: oSe.x, y: oSe.y - d },
      { x: oNe.x, y: oNe.y - d },
    ],
    MOTEL_WALL_SIDE,
  );

  drawVerticalCornerCladding(
    ctx,
    oSw,
    oSe,
    oNe,
    d,
    MOTEL_TRIM,
    MOTEL_TRIM_SIDE,
  );

  drawMotelWindowsAndDoors(ctx, scene, bld, offset, d);
  paintStandardWallWear(ctx, oSw, oSe, oNe, d, bld);
  fillMotelRoof(ctx, oNw, oNe, oSe, oSw, d, bld);
  drawMotelSign(ctx, scene, bld, offset, d);
}

/**
 * Pre-isometric MotelSign_SE — SE-entrance motels only, drawn above the roof
 * deck on the street façade (no wall projection).
 */
function drawMotelSign(
  ctx: CanvasRenderingContext2D,
  scene: Phaser.Scene,
  bld: BuildingFootprint,
  offset: (p: Point) => Point,
  wallDepth: number,
) {
  if (bld.entranceX == null || bld.entranceY == null) return;
  const face = buildingEntranceFace({
    ox: bld.ox,
    oy: bld.oy,
    w: bld.w,
    h: bld.h,
    entranceX: bld.entranceX,
    entranceY: bld.entranceY,
  });
  if (face !== "SE") return;
  const sign = artSource(scene, BUILDING_MOTEL_SIGN_SE_KEY);
  if (!sign) return;

  const street = motelStreetFace(bld, offset);
  if (!street) return;

  // Align with door centre along the SE façade.
  const faceLen = Math.max(1, bld.h);
  const doorStart = bld.entranceY - bld.oy;
  const doorT = (doorStart + buildingEntranceSpan(bld) * 0.5) / faceLen;
  const mid = lerpPoint(street.a, street.b, doorT);
  const roof = {
    x: mid.x + street.out.x * 3,
    y: mid.y + street.out.y * 3 - wallDepth - MOTEL_ROOF_PEAK_HEIGHT * 0.35,
  };
  const scale = MOTEL_SIGN_DISPLAY_W / sign.srcW;
  const dw = sign.srcW * scale;
  const dh = sign.srcH * scale;
  const prevSmooth = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  // Anchor near roof; nudge left so the art sits over the door centre.
  ctx.drawImage(
    sign.src,
    roof.x - dw * 0.5 - dw * MOTEL_SIGN_NUDGE_X_FRAC,
    roof.y - dh * 0.755,
    dw,
    dh,
  );
  ctx.imageSmoothingEnabled = prevSmooth;
}

function drawMotelWindowsAndDoors(
  ctx: CanvasRenderingContext2D,
  scene: Phaser.Scene,
  bld: BuildingFootprint,
  offset: (p: Point) => Point,
  wallDepth: number,
) {
  if (bld.entranceX == null || bld.entranceY == null) return;
  const face = buildingEntranceFace({
    ox: bld.ox,
    oy: bld.oy,
    w: bld.w,
    h: bld.h,
    entranceX: bld.entranceX,
    entranceY: bld.entranceY,
  });
  const { ox, oy, w, h } = bld;
  const faceLen = face === "SE" ? h : w;
  const door = resolveDoorSource(scene, bld);
  const edge = door ? entranceWallEdge(bld, offset) : null;
  if (door && edge) {
    drawDoorOnEntranceFace(
      ctx,
      door,
      edge.bottomLeft,
      edge.bottomRight,
      wallDepth,
      true,
      0.78,
    );
  }

  const windowRaw = resolveWindowSource(scene, face);
  const window = windowRaw ? prepareWallOverlay(windowRaw) : null;
  if (!window) return;
  const span = buildingEntranceSpan(bld);
  // Face-local door span [doorStart, doorEnd).
  const doorStart = face === "SE" ? bld.entranceY - oy : bld.entranceX - ox;
  const doorEnd = doorStart + span;

  const placeAt = (i: number) => {
    // Keep clear of corner tiles.
    if (i < 1 || i >= faceLen - 1) return;
    const tx = face === "SE" ? ox + w - 1 : ox + i;
    const ty = face === "SE" ? oy + i : oy + h - 1;
    const tileEdge = wallTileEdge(face, tx, ty, bld, offset);
    if (!tileEdge) return;
    drawWindowOnWallTile(
      ctx,
      window,
      tileEdge.bottomLeft,
      tileEdge.bottomRight,
      0,
      face === "SE",
      0.32,
    );
  };

  // Walk outward from the door: leave ≥1 empty tile beside the span,
  // then every other bay toward each corner.
  for (let i = doorStart - 2; i >= 1; i -= 2) placeAt(i);
  for (let i = doorEnd + 1; i < faceLen - 1; i += 2) placeAt(i);
}

/**
 * Browser / GPU canvas limit. Above this, skip the bake and use solid Graphics
 * so a dense city cannot wipe the WebGL context with oversized textures.
 */
const BUILDING_CANVAS_DIM_MAX = 4096;

/**
 * Ensure a CanvasTexture exists at least `w`×`h`. Grows but never shrinks so
 * the GL texture object stays associated with the same key.
 * Returns null when the size is unsafe or allocation fails.
 */
function ensureBakeCanvas(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
): Phaser.Textures.CanvasTexture | null {
  const width = Math.max(1, Math.ceil(w));
  const height = Math.max(1, Math.ceil(h));
  if (width > BUILDING_CANVAS_DIM_MAX || height > BUILDING_CANVAS_DIM_MAX) {
    return null;
  }
  try {
    if (!scene.textures.exists(key)) {
      const created = scene.textures.createCanvas(key, width, height);
      if (!created) return null;
      created.setFilter(Phaser.Textures.FilterMode.LINEAR);
      return created;
    }
    const tex = scene.textures.get(key) as Phaser.Textures.CanvasTexture;
    if (tex.width < width || tex.height < height) {
      tex.setSize(Math.max(tex.width, width), Math.max(tex.height, height));
    } else {
      tex.clear();
    }
    tex.setFilter(Phaser.Textures.FilterMode.LINEAR);
    return tex;
  } catch (err) {
    console.error(`Building canvas allocate failed (${key} ${width}x${height})`, err);
    if (scene.textures.exists(key)) {
      scene.textures.remove(key);
    }
    return null;
  }
}


/**
 * Bucketed art variant for a footprint.
 *
 * Normalised (bake) footprints carry the seed explicitly. Anything still
 * painting from world coordinates derives the same bucket on the fly, so both
 * paths agree on which variant a building shows.
 */
function variantSeedOf(bld: BuildingFootprint): number {
  return bld.variantSeed ?? buildingVariantSeed(bld.ox, bld.oy);
}

/** House wall art, chosen from the bucketed variant rather than world position. */
function wallKeyForBake(bld: BuildingFootprint): BuildingWallKey {
  if (!isHouseStyleBuilding(bld)) return wallTextureKeyForBuilding(bld);
  const idx = variantSeedOf(bld) % BUILDING_WALL_HOUSE_KEYS.length;
  return BUILDING_WALL_HOUSE_KEYS[idx]!;
}

function resolveWallSource(scene: Phaser.Scene, bld: BuildingFootprint) {
  const preferred = wallKeyForBake(bld);
  // Prefer the type's wall; never fall warehouse Wall4 onto placeholders.
  const pool =
    preferred === BUILDING_WALL_WAREHOUSE_KEY
      ? [BUILDING_WALL_WAREHOUSE_KEY, BUILDING_WALL_BLANK_KEY, ...BUILDING_WALL_HOUSE_KEYS]
      : preferred === BUILDING_WALL_BLANK_KEY
        ? [BUILDING_WALL_BLANK_KEY, ...BUILDING_WALL_HOUSE_KEYS]
        : [...BUILDING_WALL_HOUSE_KEYS, BUILDING_WALL_BLANK_KEY];
  const candidates = [preferred, ...pool.filter((key) => key !== preferred)];
  for (const key of candidates) {
    const art = artSource(scene, key);
    if (art) return art;
  }
  return null;
}

/** Footprint AABB in iso space (unscaled), plus roof extras. */
function buildingIsoBounds(bld: BuildingFootprint): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  d: number;
  nw: Point;
  ne: Point;
  se: Point;
  sw: Point;
} | null {
  const { ox, oy, w, h } = bld;
  const d = buildingWallScreenDepth(bld);
  const isHouse = bld.buildingType === "house";
  const isWarehouse = bld.buildingType === "warehouse";
  const isMotel = bld.buildingType === "motel";
  const isTent = bld.buildingType === "tent";
  const isMessHall = bld.buildingType === "mess_hall";
  const roofExtra =
    isWarehouse
      ? WAREHOUSE_ROOF_PEAK_HEIGHT
      : isTent
        ? TENT_ROOF_PEAK_HEIGHT
      : isMessHall
        ? MOTEL_ROOF_PEAK_HEIGHT
      : isMotel
        ? MOTEL_ROOF_PEAK_HEIGHT +
          (bld.entranceX != null &&
          bld.entranceY != null &&
          buildingEntranceFace({
            ox: bld.ox,
            oy: bld.oy,
            w: bld.w,
            h: bld.h,
            entranceX: bld.entranceX,
            entranceY: bld.entranceY,
          }) === "SE"
            ? MOTEL_SIGN_BOUNDS_PAD
            : 0)
        : bld.buildingType === "police_station"
          ? POLICE_ROOF_LIP_HEIGHT + POLICE_ROOF_PROP_HEIGHT
          : bld.buildingType === "supermarket"
            ? POLICE_ROOF_LIP_HEIGHT + SUPERMARKET_ROOF_PROP_HEIGHT
            : bld.buildingType === "hospital"
              ? POLICE_ROOF_LIP_HEIGHT
              : isHouse
                ? HOUSE_ROOF_PEAK_HEIGHT + HOUSE_CHIMNEY_HEIGHT
                : 0;

  const nw = cartesianToIso(ox, oy);
  const ne = cartesianToIso(ox + w, oy);
  const se = cartesianToIso(ox + w, oy + h);
  const sw = cartesianToIso(ox, oy + h);

  const points: Point[] = [
    nw,
    ne,
    se,
    sw,
    { x: nw.x, y: nw.y - d - roofExtra },
    { x: ne.x, y: ne.y - d - roofExtra },
    { x: se.x, y: se.y - d - roofExtra },
    { x: sw.x, y: sw.y - d - roofExtra },
  ];

  if (isHouse || isWarehouse || isMotel || isTent || isMessHall) {
    const wallDeck: [Point, Point, Point, Point] = [
      { x: nw.x, y: nw.y - d },
      { x: ne.x, y: ne.y - d },
      { x: se.x, y: se.y - d },
      { x: sw.x, y: sw.y - d },
    ];
    const deck = (
      isHouse
        ? outsetRoofQuad(wallDeck, HOUSE_ROOF_OVERHANG)
        : isMotel
          ? outsetRoofQuad(wallDeck, MOTEL_ROOF_OVERHANG)
          : isTent
            ? outsetRoofQuad(wallDeck, TENT_ROOF_OVERHANG)
          : isMessHall
            ? outsetRoofQuad(wallDeck, MESS_HALL_ROOF_OVERHANG)
          : wallDeck
    ) as [Point, Point, Point, Point];
    const [dNw, dNe, dSe, dSw] = deck;
    const peak = isWarehouse
      ? WAREHOUSE_ROOF_PEAK_HEIGHT
      : isTent
        ? TENT_ROOF_PEAK_HEIGHT
      : isMotel || isMessHall
        ? MOTEL_ROOF_PEAK_HEIGHT
        : HOUSE_ROOF_PEAK_HEIGHT;
    points.push(dNw, dNe, dSe, dSw);
    if (gableRidgeAxis(bld) === "EW") {
      points.push(raisePoint(lerpPoint(dNw, dSw, 0.5), peak));
      points.push(raisePoint(lerpPoint(dNe, dSe, 0.5), peak));
    } else {
      points.push(raisePoint(lerpPoint(dNw, dNe, 0.5), peak));
      points.push(raisePoint(lerpPoint(dSw, dSe, 0.5), peak));
    }
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }

  const pad =
    isMotel &&
    bld.entranceX != null &&
    bld.entranceY != null &&
    buildingEntranceFace({
      ox: bld.ox,
      oy: bld.oy,
      w: bld.w,
      h: bld.h,
      entranceX: bld.entranceX,
      entranceY: bld.entranceY,
    }) === "SE"
      ? 1 + MOTEL_SIGN_BOUNDS_PAD
      : 1;
  minX = Math.floor(minX) - pad;
  minY = Math.floor(minY) - pad;
  maxX = Math.ceil(maxX) + pad;
  maxY = Math.ceil(maxY) + pad;

  return { minX, minY, maxX, maxY, d, nw, ne, se, sw };
}

/** Paint a building into an already-sized canvas context (origin at iso min). */
function paintBuildingOntoContext(
  scene: Phaser.Scene,
  bld: BuildingFootprint,
  ctx: CanvasRenderingContext2D,
  bounds: NonNullable<ReturnType<typeof buildingIsoBounds>>,
  wall: { src: CanvasImageSource; srcW: number; srcH: number },
  scale: number,
) {
  const { minX, minY, d, nw, ne, se, sw } = bounds;
  const { src, srcW, srcH } = wall;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.scale(scale, scale);

  const offset = (p: Point): Point => ({ x: p.x - minX, y: p.y - minY });
  const oNw = offset(nw);
  const oNe = offset(ne);
  const oSe = offset(se);
  const oSw = offset(sw);

  if (bld.buildingType === "hospital") {
    paintHospitalBuilding(scene, bld, ctx, offset);
    return;
  }

  if (bld.buildingType === "motel") {
    paintMotelBuilding(scene, bld, ctx, offset);
    return;
  }

  if (bld.buildingType === "tent") {
    paintTentBuilding(scene, bld, ctx, offset);
    return;
  }

  if (bld.buildingType === "mess_hall") {
    paintMessHallBuilding(scene, bld, ctx, offset);
    return;
  }

  if (bld.buildingType === "supermarket") {
    fillPoly(
      ctx,
      [
        oSw,
        oSe,
        { x: oSe.x, y: oSe.y - d },
        { x: oSw.x, y: oSw.y - d },
      ],
      SUPERMARKET_WALL_FRONT,
    );
    fillPoly(
      ctx,
      [
        oNe,
        oSe,
        { x: oSe.x, y: oSe.y - d },
        { x: oNe.x, y: oNe.y - d },
      ],
      SUPERMARKET_WALL_SIDE,
    );
  } else {
    drawTexturedWallFace(ctx, src, oSw, oSe, d, srcW, srcH);
    drawTexturedWallFace(ctx, src, oNe, oSe, d, srcW, srcH);
  }

  if (bld.buildingType === "police_station") {
    drawPoliceWindows(ctx, scene, bld, offset, d);
  } else if (bld.buildingType === "supermarket") {
    drawSupermarketWindows(ctx, scene, bld, offset, d);
  } else if (bld.buildingType === "house") {
    drawHouseWindows(ctx, scene, bld, offset);
  } else if (bld.buildingType === "warehouse") {
    drawVerticalCornerCladding(
      ctx,
      oSw,
      oSe,
      oNe,
      d,
      WAREHOUSE_ROOF_LIP,
      WAREHOUSE_ROOF_LIP_FACE,
    );
  }

  const door = resolveDoorSource(scene, bld);
  const edge = door ? entranceWallEdge(bld, offset) : null;
  if (door && edge) {
    const doorFace =
      bld.entranceX != null && bld.entranceY != null
        ? buildingEntranceFace({
            ox: bld.ox,
            oy: bld.oy,
            w: bld.w,
            h: bld.h,
            entranceX: bld.entranceX,
            entranceY: bld.entranceY,
          })
        : null;
    // Police / supermarket: SE keeps the default U-flip; SW mirrors the other way.
    const flipU =
      (bld.buildingType === "police_station" ||
        bld.buildingType === "supermarket") &&
      doorFace != null
        ? doorFace === "SE"
        : true;
    // Door4 (supermarket) reads taller on the façade than residential doors.
    const heightFrac = bld.buildingType === "supermarket" ? 0.95 : 0.75;
    drawDoorOnEntranceFace(
      ctx,
      door,
      edge.bottomLeft,
      edge.bottomRight,
      d,
      flipU,
      heightFrac,
    );
  }
  paintStandardWallWear(ctx, oSw, oSe, oNe, d, bld);

  fillRoof(ctx, oNw, oNe, oSe, oSw, d, bld);
}

/**
 * Hospital 2–3–2 stepped massing: strips back→front along the street axis
 * (wingA → center → wingB), then cross + Door5.
 */
function paintHospitalBuilding(
  scene: Phaser.Scene,
  bld: BuildingFootprint,
  ctx: CanvasRenderingContext2D,
  offset: (p: Point) => Point,
) {
  const strips = hospitalMassingStrips(bld);
  const doorFace =
    bld.entranceX != null && bld.entranceY != null
      ? buildingEntranceFace({
          ox: bld.ox,
          oy: bld.oy,
          w: bld.w,
          h: bld.h,
          entranceX: bld.entranceX,
          entranceY: bld.entranceY,
        })
      : "SW";
  // Iso painter's order: north/west wing first, south/east wing last so the
  // front wing is never covered by the taller centre (SE-face bug).
  for (const strip of strips) {
    paintHospitalStrip(ctx, strip, offset, bld.variantSeed);
  }
  // Re-paint the tower's top storey + roof so it still reads above the wings.
  const center = strips.find((s) => s.kind === "center");
  if (center) {
    paintHospitalStripTopStorey(ctx, center, offset, bld.variantSeed);
  }

  if (center) {
    drawHospitalMedicalCross(ctx, center, doorFace, offset);
  }

  drawHospitalWindows(ctx, scene, bld, offset, doorFace);
  drawHospitalSideWindows(ctx, scene, bld, offset, doorFace);

  const door = resolveDoorSource(scene, bld);
  const edge = door ? entranceWallEdge(bld, offset) : null;
  if (door && edge) {
    drawDoorOnEntranceFace(
      ctx,
      door,
      edge.bottomLeft,
      edge.bottomRight,
      // Ground storey only — don't stretch Door5 up the 3-storey tower.
      WALL_DEPTH,
      doorFace === "SE",
      0.95,
    );
  }

  for (const strip of strips) {
    const depth = WALL_DEPTH * strip.levels;
    const ne = offset(cartesianToIso(strip.ox + strip.w, strip.oy));
    const se = offset(cartesianToIso(strip.ox + strip.w, strip.oy + strip.h));
    const sw = offset(cartesianToIso(strip.ox, strip.oy + strip.h));
    paintCuboidWallDecals(
      ctx,
      sw,
      se,
      ne,
      depth,
      `wall:hospital:${bld.variantSeed ?? 0}:${strip.kind}:${strip.w}x${strip.h}:${strip.levels}`,
      "hospital",
    );
  }
}

function paintHospitalStrip(
  ctx: CanvasRenderingContext2D,
  strip: HospitalStrip,
  offset: (p: Point) => Point,
  variantSeed?: number,
) {
  const depth = WALL_DEPTH * strip.levels;
  const nw = offset(cartesianToIso(strip.ox, strip.oy));
  const ne = offset(cartesianToIso(strip.ox + strip.w, strip.oy));
  const se = offset(cartesianToIso(strip.ox + strip.w, strip.oy + strip.h));
  const sw = offset(cartesianToIso(strip.ox, strip.oy + strip.h));

  fillPoly(
    ctx,
    [sw, se, { x: se.x, y: se.y - depth }, { x: sw.x, y: sw.y - depth }],
    HOSPITAL_WALL_FRONT,
  );
  fillPoly(
    ctx,
    [ne, se, { x: se.x, y: se.y - depth }, { x: ne.x, y: ne.y - depth }],
    HOSPITAL_WALL_SIDE,
  );

  fillParapetRoof(
    ctx,
    nw,
    ne,
    se,
    sw,
    depth,
    roofColorForType("hospital"),
    HOSPITAL_ROOF_LIP,
    HOSPITAL_ROOF_LIP_FACE,
    POLICE_ROOF_LIP_HEIGHT,
    WAREHOUSE_ROOF_LIP_INSET,
    strip.kind === "center" && strip.levels >= 3
      ? undefined
      : {
          ox: strip.ox,
          oy: strip.oy,
          w: strip.w,
          h: strip.h,
          buildingType: "hospital",
          variantSeed,
        },
    "hospital",
  );
}

/** Top storey walls + roof of the centre tower (drawn after the front wing). */
function paintHospitalStripTopStorey(
  ctx: CanvasRenderingContext2D,
  strip: HospitalStrip,
  offset: (p: Point) => Point,
  variantSeed?: number,
) {
  if (strip.levels < 3) return;
  const depth = WALL_DEPTH * strip.levels;
  const topLift = WALL_DEPTH * (strip.levels - 1);
  const nw = offset(cartesianToIso(strip.ox, strip.oy));
  const ne = offset(cartesianToIso(strip.ox + strip.w, strip.oy));
  const se = offset(cartesianToIso(strip.ox + strip.w, strip.oy + strip.h));
  const sw = offset(cartesianToIso(strip.ox, strip.oy + strip.h));

  const raise = (p: Point): Point => ({ x: p.x, y: p.y - topLift });
  const sw2 = raise(sw);
  const se2 = raise(se);
  const ne2 = raise(ne);

  fillPoly(
    ctx,
    [sw2, se2, { x: se.x, y: se.y - depth }, { x: sw.x, y: sw.y - depth }],
    HOSPITAL_WALL_FRONT,
  );
  fillPoly(
    ctx,
    [ne2, se2, { x: se.x, y: se.y - depth }, { x: ne.x, y: ne.y - depth }],
    HOSPITAL_WALL_SIDE,
  );

  fillParapetRoof(
    ctx,
    nw,
    ne,
    se,
    sw,
    depth,
    roofColorForType("hospital"),
    HOSPITAL_ROOF_LIP,
    HOSPITAL_ROOF_LIP_FACE,
    POLICE_ROOF_LIP_HEIGHT,
    WAREHOUSE_ROOF_LIP_INSET,
    {
      ox: strip.ox,
      oy: strip.oy,
      w: strip.w,
      h: strip.h,
      buildingType: "hospital",
      variantSeed,
    },
    "hospital",
  );
}

/** Red square + white cross on the upper centre of the street-facing tower wall. */
function drawHospitalMedicalCross(
  ctx: CanvasRenderingContext2D,
  center: HospitalStrip,
  doorFace: SuperWindowFace,
  offset: (p: Point) => Point,
) {
  const storey = WALL_DEPTH;
  // Bottom of the top (3rd) storey on the street face.
  const lift = 2 * storey;
  const ne = offset(cartesianToIso(center.ox + center.w, center.oy));
  const se = offset(cartesianToIso(center.ox + center.w, center.oy + center.h));
  const sw = offset(cartesianToIso(center.ox, center.oy + center.h));

  const a = doorFace === "SE" ? ne : sw;
  const b = se;
  const faceLen = Math.hypot(b.x - a.x, b.y - a.y);
  if (faceLen < 1) return;

  // Equal extents along the face axes → 1:1 badge (UV fractions alone look
  // squished because the street span is wider than one storey is tall).
  const badge = Math.min(storey * 0.58, faceLen * 0.9);
  const halfU = badge / (2 * faceLen);
  const halfV = badge / (2 * storey);
  const mx = 0.5;
  const my = 0.5;
  const u0 = mx - halfU;
  const u1 = mx + halfU;
  const v0 = my - halfV;
  const v1 = my + halfV;

  const corner = (u: number, v: number): Point => {
    const along = lerpPoint(a, b, u);
    return { x: along.x, y: along.y - lift - storey * v };
  };

  fillPoly(
    ctx,
    [corner(u0, v0), corner(u1, v0), corner(u1, v1), corner(u0, v1)],
    HOSPITAL_CROSS_BG,
  );

  // Arm thickness matched in the same face-axis metric.
  const arm = badge * 0.18;
  const armU = arm / (2 * faceLen);
  const armV = arm / (2 * storey);
  const pad = badge * 0.1;
  const padU = pad / faceLen;
  const padV = pad / storey;
  // Vertical bar.
  fillPoly(
    ctx,
    [
      corner(mx - armU, v0 + padV),
      corner(mx + armU, v0 + padV),
      corner(mx + armU, v1 - padV),
      corner(mx - armU, v1 - padV),
    ],
    HOSPITAL_CROSS_FG,
  );
  // Horizontal bar.
  fillPoly(
    ctx,
    [
      corner(u0 + padU, my - armV),
      corner(u1 - padU, my - armV),
      corner(u1 - padU, my + armV),
      corner(u0 + padU, my + armV),
    ],
    HOSPITAL_CROSS_FG,
  );
}

/**
 * Draw building into a CanvasTexture (pool or unique). Returns used pixel size
 * and world-space top-left for positioning.
 */
function paintBuildingTexture(
  scene: Phaser.Scene,
  bld: BuildingFootprint,
  textureKey: string,
  scale: number,
): { minX: number; minY: number; usedW: number; usedH: number } | null {
  try {
    const wall = resolveWallSource(scene, bld);
    if (!wall) return null;
    const bounds = buildingIsoBounds(bld);
    if (!bounds) return null;

    const usedW = (bounds.maxX - bounds.minX) * scale;
    const usedH = (bounds.maxY - bounds.minY) * scale;
    const tex = ensureBakeCanvas(scene, textureKey, usedW, usedH);
    if (!tex) return null;
    const ctx = tex.getContext();
    if (!ctx) return null;

    paintBuildingOntoContext(scene, bld, ctx, bounds, wall, scale);
    tex.refresh();
    return { minX: bounds.minX, minY: bounds.minY, usedW, usedH };
  } catch (err) {
    console.error(
      `Building cuboid bake failed (${bld.ox},${bld.oy} ${bld.buildingType ?? "?"})`,
      err,
    );
    if (scene.textures.exists(textureKey)) {
      scene.textures.remove(textureKey);
    }
    return null;
  }
}

/**
 * Strip a footprint down to the shape that gets painted.
 *
 * Origin moves to (0, 0) so the bake is translation-invariant and shareable,
 * and every world-dependent decision (art variant, Red Order ownership) is
 * resolved here into explicit fields.
 */
function normalizeFootprint(bld: BuildingFootprint): BuildingFootprint {
  const rel = (v: number | undefined, origin: number) =>
    v === undefined ? undefined : v - origin;
  return {
    ox: 0,
    oy: 0,
    w: bld.w,
    h: bld.h,
    buildingType: bld.buildingType,
    exteriorLevels: bld.exteriorLevels,
    entranceX: rel(bld.entranceX, bld.ox),
    entranceY: rel(bld.entranceY, bld.oy),
    entranceSpan: bld.entranceSpan,
    chimneyX: rel(bld.chimneyX, bld.ox),
    chimneyY: rel(bld.chimneyY, bld.oy),
    variantSeed: variantSeedOf(bld),
    boarded:
      bld.buildingType === "supermarket"
        ? isRedOrderOwnedSupermarket(bld.ox, bld.oy)
        : false,
  };
}

function signatureFor(bld: BuildingFootprint, lod: BuildingLod): string {
  const norm = normalizeFootprint(bld);
  return buildingSignature(
    {
      buildingType: norm.buildingType ?? "house",
      w: norm.w,
      h: norm.h,
      levels: norm.exteriorLevels ?? 1,
      entranceX: norm.entranceX ?? -1,
      entranceY: norm.entranceY ?? -1,
      entranceSpan: norm.entranceSpan ?? 1,
      chimneyX: norm.chimneyX ?? -1,
      chimneyY: norm.chimneyY ?? -1,
      variantSeed: norm.variantSeed ?? 0,
      boarded: norm.boarded ?? false,
    },
    lod,
  );
}

export type BuildingCuboidObject = {
  display: Phaser.GameObjects.Image | Phaser.GameObjects.Graphics;
  textureKey?: string;
  /** Which detail tier this cuboid was built for. */
  lod: BuildingLod;
  /**
   * True when the flat solid is standing in for a bake that could not happen
   * (no budget, no art). Distinct from an intentional `far` tier: fallbacks are
   * re-baked once budget frees up, and are never parked in the soft cache.
   */
  fallback: boolean;
};

export function destroyBuildingCuboid(
  scene: Phaser.Scene,
  cuboid: BuildingCuboidObject,
) {
  // Detach from the canvas key before remove — otherwise a same-frame render
  // (or a lingering Image) can hit null glTexture and abort the WebGL batch.
  const display = cuboid.display;
  if (
    cuboid.textureKey &&
    display instanceof Phaser.GameObjects.Image &&
    display.scene
  ) {
    display.setTexture("__DEFAULT");
  }
  display.destroy();
  // Shared textures are refcounted; the cache decides when bytes come back.
  if (cuboid.textureKey) releaseBuildingTexture(scene, cuboid.textureKey);
}

/** Flat solid cuboid: the far LOD tier, and the fallback when a bake cannot run. */
function createSolidCuboid(
  scene: Phaser.Scene,
  bld: BuildingFootprint,
  depth: number,
  lod: BuildingLod,
  fallback: boolean,
  silentFail = false,
): BuildingCuboidObject {
  if (fallback) {
    if (!silentFail) renderStats.buildingBakeFailures += 1;
  } else {
    renderStats.buildingLodFlat += 1;
  }
  const g = scene.add.graphics();
  g.setDepth(depth);
  drawSolidBuildingCuboid(g, bld);
  return { display: g, lod, fallback };
}

export function createBuildingCuboid(
  scene: Phaser.Scene,
  bld: BuildingFootprint,
  depth: number,
  lod: BuildingLod = "near",
  opts?: { silentFail?: boolean; displaceKey?: string },
): BuildingCuboidObject {
  if (lod === "far") {
    return createSolidCuboid(scene, bld, depth, lod, false);
  }

  const signature = signatureFor(bld, lod);
  const normalized = normalizeFootprint(bld);
  const handle = acquireBuildingTexture(
    scene,
    signature,
    lod,
    (key, scale) => {
      const painted = paintBuildingTexture(scene, normalized, key, scale);
      if (!painted) return null;
      renderStats.buildingBakes += 1;
      // Painted at origin (0, 0), so the bounds min *is* the offset from the
      // building's iso origin.
      return {
        offX: painted.minX,
        offY: painted.minY,
        usedW: painted.usedW,
        usedH: painted.usedH,
      };
    },
    { silent: !!opts?.silentFail, displaceKey: opts?.displaceKey },
  );

  if (handle) {
    const isoOrigin = cartesianToIso(bld.ox, bld.oy);
    const image = scene.add.image(0, 0, handle.key);
    image.setOrigin(0, 0);
    // Bake offsets are relative to the iso origin, and the bounds min is the
    // roof apex rather than the ground diamond.
    image.setPosition(isoOrigin.x + handle.offX, isoOrigin.y + handle.offY);
    const src = image.texture.getSourceImage() as
      | HTMLImageElement
      | HTMLCanvasElement
      | undefined;
    const srcW = src?.width ?? handle.usedW;
    const srcH = src?.height ?? handle.usedH;
    // The bake canvas grows but never shrinks, so trim to the painted area.
    if (srcW > handle.usedW || srcH > handle.usedH) {
      image.setCrop(0, 0, handle.usedW, handle.usedH);
    } else {
      image.setCrop();
    }
    image.setScale(1 / handle.scale);
    image.setDepth(depth);
    return {
      display: image,
      textureKey: handle.key,
      lod,
      fallback: false,
    };
  }

  return createSolidCuboid(scene, bld, depth, lod, true, !!opts?.silentFail);
}

function fillPolyGraphics(
  g: Phaser.GameObjects.Graphics,
  pts: Point[],
  color: number,
) {
  if (pts.length < 3) return;
  g.fillStyle(color, 1);
  g.beginPath();
  g.moveTo(pts[0]!.x, pts[0]!.y);
  for (let i = 1; i < pts.length; i++) {
    g.lineTo(pts[i]!.x, pts[i]!.y);
  }
  g.closePath();
  g.fillPath();
}

/**
 * Paint the building's visible roof silhouette into Graphics.
 * Matches the pitched / parapet shapes used by the real cuboid, not a flat
 * box extruded through the peak — that over-covers empty air beside gables
 * and made the player outline fire when standing near a roof.
 */
function drawBuildingRoofSilhouette(
  g: Phaser.GameObjects.Graphics,
  bld: BuildingFootprint,
  nw: Point,
  ne: Point,
  se: Point,
  sw: Point,
  wallDepth: number,
  colors: { light: number; dark: number; gable: number; flat: number },
) {
  const isWarehouse = bld.buildingType === "warehouse";
  const isHouse = bld.buildingType === "house";
  const isMotel = bld.buildingType === "motel";
  const isTent = bld.buildingType === "tent";
  const isMessHall = bld.buildingType === "mess_hall";
  const isParapet =
    bld.buildingType === "police_station" ||
    bld.buildingType === "supermarket" ||
    bld.buildingType === "hospital";

  if (isHouse || isWarehouse || isMotel || isTent || isMessHall) {
    // Peak only — chimney / HVAC props are small and drawn separately on the
    // real building; inflating the whole roof to clear them recreates the bug.
    const peak = isHouse
      ? HOUSE_ROOF_PEAK_HEIGHT
      : isWarehouse
        ? WAREHOUSE_ROOF_PEAK_HEIGHT
        : isTent
          ? TENT_ROOF_PEAK_HEIGHT
          : isMessHall
            ? MOTEL_ROOF_PEAK_HEIGHT
          : MOTEL_ROOF_PEAK_HEIGHT;
    const axis = gableRidgeAxis(bld);
    const wallDeck: [Point, Point, Point, Point] = [
      { x: nw.x, y: nw.y - wallDepth },
      { x: ne.x, y: ne.y - wallDepth },
      { x: se.x, y: se.y - wallDepth },
      { x: sw.x, y: sw.y - wallDepth },
    ];
    const deck = (
      isHouse
        ? outsetRoofQuad(wallDeck, HOUSE_ROOF_OVERHANG)
        : isMotel
          ? outsetRoofQuad(wallDeck, MOTEL_ROOF_OVERHANG)
          : isTent
            ? outsetRoofQuad(wallDeck, TENT_ROOF_OVERHANG)
          : isMessHall
            ? outsetRoofQuad(wallDeck, MESS_HALL_ROOF_OVERHANG)
          : wallDeck
    ) as [Point, Point, Point, Point];
    const [dNw, dNe, dSe, dSw] = deck;
    if (axis === "EW") {
      const ridgeW = raisePoint(lerpPoint(dNw, dSw, 0.5), peak);
      const ridgeE = raisePoint(lerpPoint(dNe, dSe, 0.5), peak);
      fillPolyGraphics(g, [dNw, dNe, ridgeE, ridgeW], colors.light);
      fillPolyGraphics(g, [dSw, dSe, ridgeE, ridgeW], colors.dark);
      fillPolyGraphics(g, [dNe, dSe, ridgeE], colors.gable);
    } else {
      const ridgeN = raisePoint(lerpPoint(dNw, dNe, 0.5), peak);
      const ridgeS = raisePoint(lerpPoint(dSw, dSe, 0.5), peak);
      fillPolyGraphics(g, [dNw, dSw, ridgeS, ridgeN], colors.light);
      fillPolyGraphics(g, [dNe, dSe, ridgeS, ridgeN], colors.dark);
      fillPolyGraphics(g, [dSw, dSe, ridgeS], colors.gable);
    }
    return;
  }

  // Flat deck at the wall plate. Parapet lips rise a few px above that —
  // include the lip height as a flat top (props stay out so we don't fill
  // empty air around HVAC / hatches).
  const lip = isParapet ? POLICE_ROOF_LIP_HEIGHT : 0;
  const top = wallDepth + lip;
  fillPolyGraphics(
    g,
    [
      { x: nw.x, y: nw.y - top },
      { x: ne.x, y: ne.y - top },
      { x: se.x, y: se.y - top },
      { x: sw.x, y: sw.y - top },
    ],
    colors.flat,
  );
  if (lip > 0) {
    // Visible SW / SE lip faces so the mask covers the rim from the side.
    fillPolyGraphics(
      g,
      [
        { x: sw.x, y: sw.y - wallDepth },
        { x: se.x, y: se.y - wallDepth },
        { x: se.x, y: se.y - top },
        { x: sw.x, y: sw.y - top },
      ],
      colors.flat,
    );
    fillPolyGraphics(
      g,
      [
        { x: ne.x, y: ne.y - wallDepth },
        { x: se.x, y: se.y - wallDepth },
        { x: se.x, y: se.y - top },
        { x: ne.x, y: ne.y - top },
      ],
      colors.flat,
    );
  }
}

function drawSolidBuildingCuboid(
  g: Phaser.GameObjects.Graphics,
  bld: BuildingFootprint,
) {
  const { ox, oy, w, h } = bld;
  const d = buildingWallScreenDepth(bld);
  const isMotel = bld.buildingType === "motel";
  const isWarehouse = bld.buildingType === "warehouse";
  const isTent = bld.buildingType === "tent";
  const isMessHall = bld.buildingType === "mess_hall";

  const nw = cartesianToIso(ox, oy);
  const ne = cartesianToIso(ox + w, oy);
  const se = cartesianToIso(ox + w, oy + h);
  const sw = cartesianToIso(ox, oy + h);

  fillPolyGraphics(
    g,
    [
      { x: sw.x, y: sw.y },
      { x: se.x, y: se.y },
      { x: se.x, y: se.y - d },
      { x: sw.x, y: sw.y - d },
    ],
    isTent ? 0x4a5a32 : isMessHall ? 0x6b5e45 : isMotel ? 0xc4a882 : 0xd2c18b,
  );
  fillPolyGraphics(
    g,
    [
      { x: ne.x, y: ne.y },
      { x: se.x, y: se.y },
      { x: se.x, y: se.y - d },
      { x: ne.x, y: ne.y - d },
    ],
    isTent ? 0x3d4c2a : isMessHall ? 0x5a4e3a : isMotel ? 0xa88f6c : 0x948962,
  );

  drawBuildingRoofSilhouette(g, bld, nw, ne, se, sw, d, {
    light: isTent ? 0x3d4c2a : isMessHall ? 0x5a4e3a : isMotel ? 0x6a5848 : isWarehouse ? 0x757575 : 0x655850,
    dark: isTent ? 0x2a3420 : isMessHall ? 0x3a3228 : isMotel ? 0x4a3a30 : isWarehouse ? 0x5c5c5c : 0x453830,
    gable: isTent ? 0x3a4a28 : isMessHall ? 0x5c5340 : isMotel ? 0x9a8468 : isWarehouse ? 0x6a6a6a : 0x7a6e60,
    flat: 0x3e3e3e,
  });
}

/**
 * Solid white building silhouette for BitmapMask player / tile outlines.
 * Walls stop at the wall plate; roofs use the real pitched / parapet shape so
 * empty air beside a gable does not trigger the outline.
 */
export function drawBuildingOcclusionMask(
  g: Phaser.GameObjects.Graphics,
  bld: BuildingFootprint,
) {
  const { ox, oy, w, h } = bld;
  const d = buildingWallScreenDepth(bld);
  const nw = cartesianToIso(ox, oy);
  const ne = cartesianToIso(ox + w, oy);
  const se = cartesianToIso(ox + w, oy + h);
  const sw = cartesianToIso(ox, oy + h);
  const white = 0xffffff;

  fillPolyGraphics(
    g,
    [
      { x: sw.x, y: sw.y },
      { x: se.x, y: se.y },
      { x: se.x, y: se.y - d },
      { x: sw.x, y: sw.y - d },
    ],
    white,
  );
  fillPolyGraphics(
    g,
    [
      { x: ne.x, y: ne.y },
      { x: se.x, y: se.y },
      { x: se.x, y: se.y - d },
      { x: ne.x, y: ne.y - d },
    ],
    white,
  );
  drawBuildingRoofSilhouette(g, bld, nw, ne, se, sw, d, {
    light: white,
    dark: white,
    gable: white,
    flat: white,
  });
}
