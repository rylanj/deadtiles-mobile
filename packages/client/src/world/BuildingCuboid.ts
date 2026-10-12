import Phaser from "phaser";
import {
  CITY_BUILDING_SPECS,
  WALL_DEPTH,
  WAREHOUSE_ROOF_PEAK_HEIGHT,
  MOTEL_ROOF_PEAK_HEIGHT,
  MOTEL_PARAPET_HEIGHT,
  DINER_PARAPET_HEIGHT,
  TENT_ROOF_PEAK_HEIGHT,
  POLICE_ROOF_LIP_HEIGHT,
  POLICE_ROOF_PROP_HEIGHT,
  SUPERMARKET_ROOF_PROP_HEIGHT,
  HOUSE_ROOF_PEAK_HEIGHT,
  HOUSE_CHIMNEY_HEIGHT,
  TILE_WIDTH,
  buildingEntranceFace,
  buildingEntranceRun,
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
  buildingDoor7Key,
  buildingDoor8Key,
  BUILDING_DOOR_POLICE_KEY,
  BUILDING_WALL_BLANK_KEY,
  BUILDING_WALL_HOUSE_KEYS,
  BUILDING_WALL_WAREHOUSE_KEY,
  BUILDING_SUPER_WINDOW_BOARDED_KEY,
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
/** Roller shutters and loading dock on the long face. */
const WAREHOUSE_SHUTTER_TILES = 3;
/** Shutter opening height; the roll housing fills the rest of the wall. */
const WAREHOUSE_SHUTTER_TOP = 0.9;
const WAREHOUSE_SHUTTER = "#9a9fa5";
const WAREHOUSE_SHUTTER_SIDE = "#8a8f95";
const WAREHOUSE_SHUTTER_SLAT = "#7f848a";
const WAREHOUSE_SHUTTER_SLAT_SIDE = "#71767c";
const WAREHOUSE_TRIM = "#4b4f54";
const WAREHOUSE_TRIM_SIDE = "#41454a";
/** High strip windows under the eaves. */
const WAREHOUSE_CLERESTORY_BOTTOM = 0.8;
const WAREHOUSE_CLERESTORY_TOP = 0.92;
const WAREHOUSE_CLERESTORY_GLASS = "#9fb1b8";
const WAREHOUSE_CLERESTORY_GLASS_SIDE = "#8fa1a8";
/** Translucent rooflight panels on the slopes. */
const WAREHOUSE_ROOFLIGHT = "rgba(206, 220, 222, 0.6)";
const WAREHOUSE_ROOFLIGHT_DARK = "rgba(186, 200, 204, 0.55)";
/** House eave overhang past the wall top (px at 1× draw scale). */
const HOUSE_ROOF_OVERHANG = 3.5;
/** Shingle tints. The first matches the city spec colour. */
const HOUSE_ROOF_TINTS = ["#554840", "#4c4f55", "#5b3f37", "#4a4a42", "#625247"] as const;
/** Painted trim band under the eaves, [front, side] per house. */
const HOUSE_EAVE_TRIMS: readonly (readonly [string, string])[] = [
  ["#d9d0c0", "#c4bba9"],
  ["#e2dccf", "#ccc5b7"],
  ["#cfc2a8", "#b9ad94"],
  ["#c9c6bd", "#b4b1a8"],
  ["#d8c9b0", "#c2b49b"],
];
/** Share of houses with a timber hood over the front door. */
const HOUSE_HOOD_CHANCE = 0.45;
const HOUSE_HOOD_TOP = "#6b5443";
const HOUSE_HOOD_TOP_SIDE = "#5c4839";
const HOUSE_HOOD_EDGE = "#46362b";
/** Shallow motel eave. The street face rises into a parapet instead of a gable. */
const MOTEL_ROOF_OVERHANG = 3;
/** How thick the street false-front reads in screen pixels. */
const MOTEL_PARAPET_THICK = 6;

/**
 * Motel stucco (SW face). Side, trim, parapet and band tones are derived.
 * One entry per variant bucket so every bucket gets its own colour.
 */
const MOTEL_WALL_FRONTS: readonly string[] = [
  "#c4a882", // sand
  "#a3afb3", // dusty blue-grey
  "#d3c6aa", // cream
  "#bb9271", // faded terracotta
  "#a9b29a", // faded sage
  "#c9b27e", // ochre
  "#b6aea2", // warm grey
  "#b8ad8c", // khaki
];
/** Warm asphalt deck. Flat, not a shingle gable. */
const MOTEL_ROOF_DECK = "#5c4a3e";
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
/** Guy ropes from the eave corners out to ground pegs. */
const TENT_PEG_OUT_PX = 9;
const TENT_ROPE = "#b9a982";
const TENT_PEG = "#4a3a28";
const MESS_HALL_BASEBOARD = "#4f4533";
const MESS_HALL_BASEBOARD_SIDE = "#433a2b";
const MESS_HALL_WINDOW_FRAME = "#3f3628";
const MESS_HALL_WINDOW_GLASS = "#8fa3a8";
const MESS_HALL_WINDOW_GLASS_SIDE = "#7f9398";
/** Khaki prefab hut — SW face (camera-front). */
const MESS_HALL_WALL_FRONT = "#6b5e45";
/** Slightly deeper SE face. */
const MESS_HALL_WALL_SIDE = "#5a4e3a";
/** Dark tarpaper / tin deck. */
const MESS_HALL_ROOF_DECK = "#4a4034";
/** Gable end matches the khaki wall, a touch darker. */
const MESS_HALL_GABLE = "#5c5340";
const MESS_HALL_ROOF_OVERHANG = 3;
/** Painted MOTEL lettering on the street false-front, centred over the office door. */
const MOTEL_SIGN_TILES = 4;
const MOTEL_SIGN_TEXT_PAD_PX = 6;
const MOTEL_SIGN_RED = "#a9432d";
const MOTEL_SIGN_RED_SIDE = "#8c3826";
const MOTEL_SIGN_SHADOW = "#5f4c38";
/** Striped canvas awning over the office door. */
const MOTEL_AWNING_A = "#3f7a74";
const MOTEL_AWNING_A_SIDE = "#336560";
const MOTEL_AWNING_B = "#e6dcc6";
const MOTEL_AWNING_B_SIDE = "#cfc4ad";
const MOTEL_AWNING_STRIPES = 6;
/** Awning extends this far past the door on each side, in tiles. */
const MOTEL_AWNING_OVERHANG_TILES = 0.18;
/** Top edge of the awning on the wall, as a fraction of one storey. */
const MOTEL_AWNING_TOP_FRAC = 0.9;
/** Screen pixels the awning projects out from the wall, and how far it drops. */
const MOTEL_AWNING_PROJECT_PX = 7;
const MOTEL_AWNING_DROP_PX = 7;
const MOTEL_AWNING_VALANCE_PX = 2.5;
const MOTEL_VENT_TOP = "#8f8a82";
const MOTEL_VENT_SIDE = "#5e5a54";
const MOTEL_VENT_FRONT = "#74706a";
/** Dark base course, as a fraction of the storey. */
const MOTEL_PLINTH_FRAC = 0.08;
/** Belt just under the window sills. */
const MOTEL_BELT: readonly [number, number] = [0.22, 0.255];
/** Light sill ledge on top of the belt. */
const MOTEL_BELT_LIP: readonly [number, number] = [0.255, 0.275];
/**
 * Header just above Window1. The art tops out near 0.72 of the storey.
 * The office door covers the dark band on its own tile.
 */
const MOTEL_HEAD: readonly [number, number] = [0.748, 0.785];
const MOTEL_HEAD_LIP: readonly [number, number] = [0.785, 0.812];
/** Fascia under the eave. Pilasters stop at its underside. */
const MOTEL_CORNICE_FRAC = 0.12;
/** Raised stucco pilaster width, screen px at 1×. */
const MOTEL_PIER_PX = 6;
/** Share of street windows that grow a wall-pack AC unit. */
const MOTEL_AC_CHANCE = 0.22;
/** Top of that unit, just under the motel window sill (0.32). */
const MOTEL_AC_TOP = 0.31;

/** Weathered enamel. SW face is the lit iso wall. */
const DINER_WALL_FRONT = "#e4d7c4";
const DINER_WALL_SIDE = "#cbbda8";
const DINER_RED = "#9a3b2e";
const DINER_RED_SIDE = "#843228";
const DINER_CHECK_LIGHT = "#f3ecdf";
const DINER_CHECK_LIGHT_SIDE = "#e4d9c8";
const DINER_KICK = "#3f3b36";
const DINER_KICK_SIDE = "#322e2b";
const DINER_METAL = "#9aa0a3";
const DINER_METAL_SIDE = "#7e8488";
/** Weathered standing-seam metal. Matches the diner roof color in the city spec. */
const DINER_ROOF_DECK = "#8a847c";
const DINER_PARAPET_FACE = "#d7cbb8";
const DINER_PARAPET_FACE_SIDE = "#c4b6a2";
const DINER_PARAPET_CAP = "#9a3b2e";
const DINER_PARAPET_CAP_SIDE = "#7d3128";
/** Clearance from the parapet's bottom and top edges to the lettering. */
const DINER_SIGN_TEXT_PAD_PX = 3;
/** Two-row checker under the roof, as a fraction of one storey. */
const DINER_CHECK_FRAC = 0.16;
/** Checker cells along each façade tile. Sized to stay nearly square. */
const DINER_CHECK_PER_TILE = 4;
/** Picture-window height as a fraction of one storey, centred on the wall. */
const DINER_WINDOW_FRAC = 0.62;
/** Street sign width along the façade, in tiles. */
const DINER_SIGN_TILES = 3.2;
/** Painted façade signs stay at least this far from the building corners. */
const FACADE_SIGN_MARGIN_TILES = 0.4;
/** Standing-seam panels on the metal deck, per tile of street frontage. */
const DINER_ROOF_SEAMS_PER_TILE = 1.5;
const DINER_HVAC_TOP = "#a3a9ad";
const DINER_HVAC_SIDE = "#71777b";
const DINER_HVAC_FRONT = "#868c90";
const DINER_HOOD_TOP = "#8e9396";

/** 5×7 block glyphs for painted façade signs. */
const FACADE_GLYPHS: Record<string, readonly string[]> = {
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
};

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
export function drawTexturedWallFace(
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
/** Police stone dressings over Wall1 brick. */
const POLICE_STONE = "#d3cab8";
const POLICE_STONE_SIDE = "#bfb6a4";
const POLICE_STONE_LIGHT = "#e2dac9";
const POLICE_STONE_LIGHT_SIDE = "#cec6b5";
const POLICE_STONE_SHADOW = "#9e9584";
const POLICE_STONE_SHADOW_SIDE = "#8d8574";
const POLICE_PLINTH = "#8a8378";
const POLICE_PLINTH_SIDE = "#7a7368";
const POLICE_PLINTH_FRAC = 0.07;
const POLICE_CORNICE_FRAC = 0.1;
const POLICE_DOOR_PIER_PX = 6;
const POLICE_MAST_HEIGHT_PX = 30;
/**
 * Apartment render on the upper storeys (SW face). Side and pier tones are derived.
 * One entry per variant bucket so every bucket gets its own colour.
 */
const APARTMENT_RENDERS: readonly string[] = [
  "#e3d9c6", // cream
  "#c6ced2", // pale blue-grey
  "#d8c39c", // buff ochre
  "#c9cdbf", // pale sage
  "#c7a07e", // faded terracotta
  "#d6d4cc", // pale grey
  "#e2d8b2", // pale straw
  "#bdb7ad", // warm grey
];
/**
 * Gun shop painted block wall (SW face) and its accent (base band, stripe).
 * One entry per variant bucket pair; side tones are derived.
 */
const GUN_SHOP_PALETTES: readonly (readonly [string, string])[] = [
  ["#b5aa90", "#3e4a3b"], // tan block, dark green
  ["#a7a59e", "#5b302b"], // concrete grey, oxblood
  ["#97a091", "#3a3c3e"], // grey-green, charcoal
  ["#c2b593", "#4a3a2c"], // sand, dark brown
];
const GUN_SHOP_BASE_FRAC = 0.12;
const GUN_SHOP_STRIPE: readonly [number, number] = [0.84, 0.875];
const GUN_SHOP_COPING = "#7f7d77";
const GUN_SHOP_COPING_SIDE = "#686661";
const GUN_SHOP_BAR = "#2c2e31";
const GUN_SHOP_BAR_HI = "#55585c";
/** Display window band, fraction of the storey. */
const GUN_SHOP_WINDOW: readonly [number, number] = [0.3, 0.72];
const GUN_SHOP_DOOR_FRAC = 0.69;
/** Camera arm and body, the furthest anything reaches out from the wall. */
const GUN_SHOP_FIXTURE_PROJECT_PX = 10;
const APARTMENT_PLINTH_FRAC = 0.06;
const APARTMENT_PIER_PX = 5;
const APARTMENT_AC_CHANCE = 0.14;
const APARTMENT_BALCONY_CHANCE = 0.6;
const APARTMENT_BALCONY_PROJECT_PX = 13;
const APARTMENT_BALCONY_THICK_PX = 3;
const APARTMENT_RAIL_PX = 22;
const APARTMENT_RAIL = "#3d4146";

/** Supermarket exterior — light beige SW face. */
const SUPERMARKET_WALL_FRONT = "#e8dcc8";
/** Supermarket exterior — slightly deeper SE face for iso shading. */
const SUPERMARKET_WALL_SIDE = "#d4c4a8";
const SUPERMARKET_PLINTH = "#9a8870";
const SUPERMARKET_PLINTH_SIDE = "#8a7a63";
const SUPERMARKET_PLINTH_FRAC = 0.06;
const SUPERMARKET_PILASTER = "#f6efe3";
const SUPERMARKET_PILASTER_SIDE = "#e6dac5";
const SUPERMARKET_PILASTER_EDGE = "#b9a78a";
const SUPERMARKET_PILASTER_EDGE_SIDE = "#a8977b";
const SUPERMARKET_PILASTER_PX = 6;
/** Fascia stays above the SuperWindow art, which tops out at 0.875 of a storey. */
const SUPERMARKET_FASCIA_FRAC = 0.11;
const SUPERMARKET_FASCIA = "#a8977c";
const SUPERMARKET_FASCIA_SIDE = "#97876d";
const SUPERMARKET_FASCIA_SHADOW = "#85765f";
const SUPERMARKET_FASCIA_SHADOW_SIDE = "#76684f";
const SUPERMARKET_COPING = "#bcae95";
const SUPERMARKET_COPING_SIDE = "#ab9d84";

/** Department store concrete. SW face is the lit iso wall. */
const RETAIL_WALL_FRONT = "#d5d8dc";
const RETAIL_WALL_SIDE = "#c4c8ce";
/** Fascia band, a step darker than the concrete wall. */
const RETAIL_FASCIA_FRONT = "#aeb3b8";
const RETAIL_FASCIA_SIDE = "#9ea3a8";
/** Share of one storey taken by the fascia. Windows stop at its underside. */
const RETAIL_FASCIA_FRAC = 0.16;
/** Shadow line under the fascia and lighter coping along its top. */
const RETAIL_FASCIA_SHADOW = "#8c9197";
const RETAIL_FASCIA_SHADOW_SIDE = "#7f848a";
const RETAIL_COPING = "#c3c7cc";
const RETAIL_COPING_SIDE = "#b2b6bb";
/** Dark granite base course. */
const RETAIL_PLINTH = "#7c7f84";
const RETAIL_PLINTH_SIDE = "#6d7075";
const RETAIL_PLINTH_FRAC = 0.07;
/** Concrete pilasters between bays, a touch lighter than the wall. */
const RETAIL_PILASTER = "#e3e5e8";
const RETAIL_PILASTER_SIDE = "#d1d4d8";
const RETAIL_PILASTER_EDGE = "#b6babf";
const RETAIL_PILASTER_EDGE_SIDE = "#a8acb1";
const RETAIL_PILASTER_PX = 5;
/** Recessed blind panels on the windowless side wall. */
const RETAIL_PANEL = "#c9cdd2";
const RETAIL_PANEL_SIDE = "#b8bcc2";
const RETAIL_PANEL_SHADOW = "#aeb2b8";
const RETAIL_PANEL_SHADOW_SIDE = "#9fa3a9";
/** Flat metal canopy over the entrance doors. */
const RETAIL_CANOPY_TOP = "#7d838a";
const RETAIL_CANOPY_TOP_SIDE = "#6c7279";
const RETAIL_CANOPY_EDGE = "#4f545a";
const RETAIL_CANOPY_PROJECT_PX = 9;
const RETAIL_CANOPY_THICK_PX = 3;
const RETAIL_CANOPY_OVERHANG_TILES = 0.35;
/** Low rooflight boxes on the deck. */
const RETAIL_SKYLIGHT_GLASS = "#9fb4c0";
const RETAIL_SKYLIGHT_FRAME = "#8a9097";
const RETAIL_SKYLIGHT_FRAME_SIDE = "#71777e";

/** Office concrete, a step darker than the department store. */
const OFFICE_WALL_FRONT = "#b7bcc2";
const OFFICE_WALL_SIDE = "#a7adb4";
const OFFICE_GLASS = "#b7d4e7";
/** Lighter inner reveal on the lit jamb and sill. */
const OFFICE_GLASS_DEPTH = "#c2dced";
/** Jamb thickness as a fraction of one wall tile. */
const OFFICE_GLASS_JAMB = 0.16;
/** Sill thickness as a fraction of one storey. */
const OFFICE_GLASS_SILL = 0.07;
const OFFICE_FRAME = "#8e949c";
const OFFICE_MULLION = "#c5cad0";
const OFFICE_PLINTH = "#8f959c";
const OFFICE_PLINTH_SIDE = "#82888f";
const OFFICE_PLINTH_FRAC = 0.06;
/** Slab band at each floor line. */
const OFFICE_SPANDREL = "#a1a7ae";
const OFFICE_SPANDREL_SIDE = "#939aa1";
/** Piers every two tiles group the punched windows in pairs. */
const OFFICE_PIER = "#c9cdd2";
const OFFICE_PIER_SIDE = "#b9bec4";
const OFFICE_PIER_EDGE = "#9ca2a9";
const OFFICE_PIER_EDGE_SIDE = "#8f959c";
const OFFICE_PIER_PX = 5;
/** Fascia cap on the top storey, above the 0.72 window head. */
const OFFICE_CAP_FRAC = 0.12;
const OFFICE_CAP = "#9ea4ab";
const OFFICE_CAP_SIDE = "#90969d";
const OFFICE_CAP_SHADOW = "#858b92";
const OFFICE_CAP_SHADOW_SIDE = "#787e85";
const OFFICE_COPING = "#cfd2d6";
const OFFICE_COPING_SIDE = "#bfc3c8";
/** Warm off-white parapet, a step off the deck so the roof is not a clean white. */
const OFFICE_ROOF_LIP = "#ddd4c4";
const OFFICE_ROOF_LIP_FACE = "#c4b8a6";
/** Concrete parapet over the grey membrane deck. */
const RETAIL_ROOF_LIP = "#b7bcc1";
const RETAIL_ROOF_LIP_FACE = "#9aa0a5";
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
/** Floor-line slab band between storeys. */
const HOSPITAL_SLAB_BAND = "#d6d1c7";
const HOSPITAL_SLAB_BAND_SIDE = "#c4bfb5";
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
 * `grounded` sits the sill on the wall base instead of centring the pane.
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
  grounded = false,
) {
  const edgeLen = Math.hypot(
    bottomRight.x - bottomLeft.x,
    bottomRight.y - bottomLeft.y,
  );
  if (edgeLen < 1 || wallDepth < 1) return;
  const storeyDepth = Math.min(WALL_DEPTH, wallDepth);
  const windowDepth = storeyDepth * heightFrac;
  const lift = grounded ? 0 : (storeyDepth - windowDepth) / 2;
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
    ...(bld.buildingType === "large_retail"
      ? [
          buildingDoor8Key(doorFace === "SW" ? "SE" : "SW"),
          buildingDoor8Key("SE"),
          buildingDoor8Key("SW"),
        ]
      : []),
    ...(bld.buildingType === "office" ||
    bld.buildingType === "diner" ||
    bld.buildingType === "apartment" ||
    bld.buildingType === "gun_shop"
      ? [
          buildingDoor7Key(doorFace === "SW" ? "SE" : "SW"),
          buildingDoor7Key("SE"),
          buildingDoor7Key("SW"),
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

  const placements: { face: SuperWindowFace; along: number }[] = [];
  const drawAt = (face: SuperWindowFace, along: number) => {
    if (!spanEdge(face, along)) return;
    placements.push({ face, along });
  };
  const paintAll = () => {
    drawSupermarketFacadeDetail(ctx, bld, offset, placements, doorFace, ex, ey, doorSpan);
    for (const { face, along } of placements) {
      const art =
        boardedArt ??
        resolveUniqueSuperWindow(
          scene,
          variantSeedOf(bld),
          face,
          slot++,
          usedVariants,
        );
      if (!art) continue;
      const edge = spanEdge(face, along)!;
      // Face-specific U-flip for wall projection (boarded art is directionless).
      drawSuperWindowOnWallFace(
        ctx,
        art,
        edge.bottomLeft,
        edge.bottomRight,
        wallDepth,
        face === "SE",
      );
    }
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
  if (starts) {
    for (const start of starts) drawAt(sideFace, sideOrigin + start);
  }
  paintAll();
}

/**
 * Supermarket wall detail under the window art: base course, pilasters at
 * each window and door edge, and a fascia with a shadow line and coping.
 */
function drawSupermarketFacadeDetail(
  ctx: CanvasRenderingContext2D,
  bld: BuildingFootprint,
  offset: (p: Point) => Point,
  placements: { face: SuperWindowFace; along: number }[],
  doorFace: SuperWindowFace,
  ex: number,
  ey: number,
  doorSpan: number,
) {
  const { ox, oy, w, h } = bld;
  const oNe = offset(cartesianToIso(ox + w, oy));
  const oSe = offset(cartesianToIso(ox + w, oy + h));
  const oSw = offset(cartesianToIso(ox, oy + h));
  const fasciaBottom = 1 - SUPERMARKET_FASCIA_FRAC;
  fillFacadeBand(ctx, oSw, oSe, oNe, 0, SUPERMARKET_PLINTH_FRAC, 0, SUPERMARKET_PLINTH, SUPERMARKET_PLINTH_SIDE);
  for (const face of ["SW", "SE"] as const) {
    const faceLen = face === "SE" ? h : w;
    const origin = face === "SE" ? oy : ox;
    const marks = new Set<number>();
    for (const p of placements) {
      if (p.face !== face) continue;
      marks.add(p.along - origin);
      marks.add(p.along - origin + SUPERMARKET_WINDOW_SPAN);
    }
    if (face === doorFace) {
      const doorStart = (face === "SE" ? ey : ex) - origin;
      marks.add(doorStart);
      marks.add(doorStart + doorSpan);
    }
    const side = face === "SE";
    drawWallPiers(
      ctx,
      side ? oNe : oSw,
      oSe,
      faceLen,
      marks,
      SUPERMARKET_PILASTER_PX,
      SUPERMARKET_PLINTH_FRAC,
      fasciaBottom,
      side ? SUPERMARKET_PILASTER_SIDE : SUPERMARKET_PILASTER,
      side ? SUPERMARKET_PILASTER_EDGE_SIDE : SUPERMARKET_PILASTER_EDGE,
    );
  }
  fillFacadeBand(ctx, oSw, oSe, oNe, fasciaBottom, 1, 0, SUPERMARKET_FASCIA, SUPERMARKET_FASCIA_SIDE);
  fillFacadeBand(ctx, oSw, oSe, oNe, fasciaBottom, fasciaBottom + 0.02, 0, SUPERMARKET_FASCIA_SHADOW, SUPERMARKET_FASCIA_SHADOW_SIDE);
  fillFacadeBand(ctx, oSw, oSe, oNe, 0.97, 1, 0, SUPERMARKET_COPING, SUPERMARKET_COPING_SIDE);
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
  const run = buildingEntranceRun({
    ox,
    oy,
    w,
    h,
    entranceX: ex,
    entranceY: ey,
    entranceSpan: bld.entranceSpan,
    buildingType: bld.buildingType,
  });

  // East face (NE→SE).
  if (run.face === "SE" && run.y >= oy && run.y + run.span <= oy + h) {
    return {
      bottomLeft: offset(cartesianToIso(ox + w, run.y)),
      bottomRight: offset(cartesianToIso(ox + w, run.y + run.span)),
    };
  }
  // South face (SW→SE).
  if (run.face === "SW" && run.x >= ox && run.x + run.span <= ox + w) {
    return {
      bottomLeft: offset(cartesianToIso(run.x, oy + h)),
      bottomRight: offset(cartesianToIso(run.x + run.span, oy + h)),
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

/**
 * Police stone dressings over the brick: base course, a string course at the
 * floor line, a cornice under the parapet, and stone pilasters flanking the door.
 */
function drawPoliceFacadeDetail(
  ctx: CanvasRenderingContext2D,
  bld: BuildingFootprint,
  offset: (p: Point) => Point,
  oSw: Point,
  oSe: Point,
  oNe: Point,
) {
  const levels = Math.max(1, bld.exteriorLevels ?? 1);
  fillFacadeBand(ctx, oSw, oSe, oNe, 0, POLICE_PLINTH_FRAC, 0, POLICE_PLINTH, POLICE_PLINTH_SIDE);
  for (let level = 1; level < levels; level++) {
    fillFacadeBand(ctx, oSw, oSe, oNe, 0.96, 1.03, level - 1, POLICE_STONE, POLICE_STONE_SIDE);
  }
  const top = levels - 1;
  fillFacadeBand(ctx, oSw, oSe, oNe, 1 - POLICE_CORNICE_FRAC, 1, top, POLICE_STONE, POLICE_STONE_SIDE);
  fillFacadeBand(ctx, oSw, oSe, oNe, 1 - POLICE_CORNICE_FRAC, 1 - POLICE_CORNICE_FRAC + 0.025, top, POLICE_STONE_SHADOW, POLICE_STONE_SHADOW_SIDE);
  fillFacadeBand(ctx, oSw, oSe, oNe, 0.96, 1, top, POLICE_STONE_LIGHT, POLICE_STONE_LIGHT_SIDE);

  const edge = entranceWallEdge(bld, offset);
  const street = motelStreetFace(bld, offset);
  if (!edge || !street) return;
  const side = street.face === "SE";
  const len = Math.hypot(edge.bottomRight.x - edge.bottomLeft.x, edge.bottomRight.y - edge.bottomLeft.y) || 1;
  const pad = (POLICE_DOOR_PIER_PX / 2 + 1) / len;
  for (const t of [-pad, 1 + pad]) {
    drawWallPier(
      ctx,
      edge.bottomLeft,
      edge.bottomRight,
      t,
      POLICE_DOOR_PIER_PX,
      POLICE_PLINTH_FRAC,
      0.96,
      side ? POLICE_STONE_SIDE : POLICE_STONE,
      side ? POLICE_STONE_SHADOW_SIDE : POLICE_STONE_SHADOW,
    );
  }
}

/** Stable 0..1 roll per apartment variant. */
function apartmentRoll(bld: BuildingFootprint, salt: number): number {
  let h = (Math.imul(variantSeedOf(bld) + 5, 2246822519) ^ salt) >>> 0;
  h = (h ^ (h >>> 15)) >>> 0;
  h = Math.imul(h, 0x846ca68b) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 0x1_0000_0000;
}

function apartmentRender(bld: BuildingFootprint): readonly [string, string, string, string] {
  const front = APARTMENT_RENDERS[variantPaletteIndex(bld, APARTMENT_RENDERS.length)]!;
  return [front, shadeHex(front, 0.915), shadeHex(front, 1.04), shadeHex(front, 0.955)];
}

function apartmentHasBalconies(bld: BuildingFootprint): boolean {
  return apartmentRoll(bld, 0xba1c) < APARTMENT_BALCONY_CHANCE;
}

/**
 * Apartment block over the brick wall texture: render on the upper storeys,
 * stone base, floor-line courses and cornice, piers between window pairs,
 * Window1 on every inner tile, some sill-hung AC units, and street balconies.
 */
function drawApartmentFacade(
  ctx: CanvasRenderingContext2D,
  scene: Phaser.Scene,
  bld: BuildingFootprint,
  offset: (p: Point) => Point,
  oSw: Point,
  oSe: Point,
  oNe: Point,
) {
  const levels = Math.max(1, bld.exteriorLevels ?? 1);
  const [render, renderSide, pier, pierSide] = apartmentRender(bld);
  if (levels > 1) {
    fillFacadeBand(ctx, oSw, oSe, oNe, 0, levels - 1, 1, render, renderSide);
  }
  fillFacadeBand(ctx, oSw, oSe, oNe, 0, APARTMENT_PLINTH_FRAC, 0, POLICE_PLINTH, POLICE_PLINTH_SIDE);

  const run = retailEntrance(bld);
  const capBottom = levels - POLICE_CORNICE_FRAC;
  for (const face of ["SW", "SE"] as const) {
    const side = face === "SE";
    const faceLen = side ? bld.h : bld.w;
    const marks: number[] = [];
    for (let i = 1; i < faceLen; i += 2) marks.push(i);
    if (levels > 1) {
      const a = side ? oNe : oSw;
      const lenPx = Math.hypot(oSe.x - a.x, oSe.y - a.y) || 1;
      const half = APARTMENT_PIER_PX / 2 / lenPx;
      for (const t of [half, 1 - half, ...marks.map((i) => i / faceLen)]) {
        const t0 = Math.max(0, t - half);
        const t1 = Math.min(1, t + half);
        fillWallBand(ctx, lerpPoint(a, oSe, t0), lerpPoint(a, oSe, t1), 0, capBottom - 1, 1, side ? pierSide : pier);
      }
    }
  }
  for (let level = 1; level < levels; level++) {
    const thick = level === 1 ? 0.09 : 0.06;
    fillFacadeBand(ctx, oSw, oSe, oNe, 1 - thick, 1.03, level - 1, POLICE_STONE, POLICE_STONE_SIDE);
  }
  const top = levels - 1;
  fillFacadeBand(ctx, oSw, oSe, oNe, 1 - POLICE_CORNICE_FRAC, 1, top, POLICE_STONE, POLICE_STONE_SIDE);
  fillFacadeBand(ctx, oSw, oSe, oNe, 1 - POLICE_CORNICE_FRAC, 1 - POLICE_CORNICE_FRAC + 0.025, top, POLICE_STONE_SHADOW, POLICE_STONE_SHADOW_SIDE);
  fillFacadeBand(ctx, oSw, oSe, oNe, 0.96, 1, top, POLICE_STONE_LIGHT, POLICE_STONE_LIGHT_SIDE);

  const balconies = apartmentHasBalconies(bld);
  const balconySlots: { face: "SE" | "SW"; i: number; level: number }[] = [];
  for (const face of ["SW", "SE"] as const) {
    const side = face === "SE";
    const faceLen = side ? bld.h : bld.w;
    const origin = side ? bld.oy : bld.ox;
    const raw = resolveWindowSource(scene, face);
    const window = raw ? prepareWallOverlay(raw) : null;
    const doorTile = run && run.face === face ? (side ? run.y : run.x) - origin : -99;
    for (let level = 0; level < levels; level++) {
      for (let i = 1; i < faceLen - 1; i++) {
        if (level === 0 && i === doorTile) continue;
        const tx = side ? bld.ox + bld.w - 1 : origin + i;
        const ty = side ? origin + i : bld.oy + bld.h - 1;
        const edge = wallTileEdge(face, tx, ty, bld, offset);
        if (!edge) continue;
        if (window) {
          drawWindowOnWallTile(ctx, window, edge.bottomLeft, edge.bottomRight, level, side);
        }
        const roll = apartmentRoll(bld, (level * 31 + i) * 7 + (side ? 3 : 0));
        if (level > 0 && roll < APARTMENT_AC_CHANCE) {
          drawApartmentAcUnit(ctx, edge.bottomLeft, edge.bottomRight, level, side);
        }
        if (
          balconies &&
          level > 0 &&
          face === run?.face &&
          i !== doorTile &&
          (i - doorTile) % 2 === 0
        ) {
          balconySlots.push({ face, i, level });
        }
      }
    }
  }
  balconySlots.sort((a, b) => a.level - b.level);
  for (const slot of balconySlots) {
    const side = slot.face === "SE";
    const origin = side ? bld.oy : bld.ox;
    const edge = facadeSpanEdge(bld, slot.face, origin + slot.i, 1, offset);
    if (edge) drawApartmentBalcony(ctx, edge.bottomLeft, edge.bottomRight, slot.face, slot.level);
  }
}

/** Small AC box hung under a window sill. */
function drawApartmentAcUnit(
  ctx: CanvasRenderingContext2D,
  bottomLeft: Point,
  bottomRight: Point,
  level: number,
  side: boolean,
  /** Top of the box, as a fraction of the storey. */
  topFrac = 0.2,
) {
  const bottom = topFrac - 0.14;
  const l = lerpPoint(bottomLeft, bottomRight, 0.3);
  const r = lerpPoint(bottomLeft, bottomRight, 0.7);
  fillWallBand(ctx, l, r, bottom, topFrac, level, side ? "#a9adb0" : "#bcc0c3");
  fillWallBand(ctx, l, r, topFrac - 0.02, topFrac, level, side ? "#c4c8cb" : "#d5d8da");
  const gl = lerpPoint(bottomLeft, bottomRight, 0.36);
  const gr = lerpPoint(bottomLeft, bottomRight, 0.64);
  for (const f of [0.03, 0.06, 0.09]) {
    fillWallBand(ctx, gl, gr, bottom + f, bottom + f + 0.01, level, "#7b8084");
  }
}

/** Concrete balcony slab with a thin metal railing, projecting from one wall tile. */
function drawApartmentBalcony(
  ctx: CanvasRenderingContext2D,
  bottomLeft: Point,
  bottomRight: Point,
  face: "SE" | "SW",
  level: number,
) {
  const out = faceOutVector(face);
  const lift = level * WALL_DEPTH + 2;
  const wallA = raisePoint(lerpPoint(bottomLeft, bottomRight, 0.03), lift);
  const wallB = raisePoint(lerpPoint(bottomLeft, bottomRight, 0.97), lift);
  const o = (p: Point): Point => ({
    x: p.x + out.x * APARTMENT_BALCONY_PROJECT_PX,
    y: p.y + out.y * APARTMENT_BALCONY_PROJECT_PX,
  });
  const lipA = o(wallA);
  const lipB = o(wallB);
  const down = (p: Point) => raisePoint(p, -APARTMENT_BALCONY_THICK_PX);
  const up = (p: Point) => raisePoint(p, APARTMENT_RAIL_PX);
  const side = face === "SE";
  // The camera-facing end is the lower one on screen.
  const endWall = wallA.y > wallB.y ? wallA : wallB;
  const endLip = endWall === wallA ? lipA : lipB;
  fillPoly(ctx, [endWall, endLip, down(endLip), down(endWall)], "#8f8a80");
  fillPoly(ctx, [wallA, wallB, lipB, lipA], side ? "#bdb7ab" : "#cdc7bb");
  fillPoly(ctx, [lipA, lipB, down(lipB), down(lipA)], "#9e988c");

  const farWall = endWall === wallA ? wallB : wallA;
  const farLip = endWall === wallA ? lipB : lipA;
  // Side returns first so the front rail overlaps them.
  ctx.fillStyle = "rgba(40, 44, 50, 0.18)";
  for (const [w, l] of [[farWall, farLip], [endWall, endLip]] as const) {
    ctx.beginPath();
    ctx.moveTo(w.x, w.y);
    ctx.lineTo(l.x, l.y);
    ctx.lineTo(up(l).x, up(l).y);
    ctx.lineTo(up(w).x, up(w).y);
    ctx.closePath();
    ctx.fill();
  }
  ctx.beginPath();
  ctx.moveTo(lipA.x, lipA.y);
  ctx.lineTo(lipB.x, lipB.y);
  ctx.lineTo(up(lipB).x, up(lipB).y);
  ctx.lineTo(up(lipA).x, up(lipA).y);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = APARTMENT_RAIL;
  ctx.lineWidth = 1;
  ctx.beginPath();
  const lowRail = (p: Point) => raisePoint(p, 3);
  for (const [w, l] of [[farWall, farLip], [endWall, endLip]] as const) {
    ctx.moveTo(up(w).x, up(w).y);
    ctx.lineTo(up(l).x, up(l).y);
    ctx.moveTo(lowRail(w).x, lowRail(w).y);
    ctx.lineTo(lowRail(l).x, lowRail(l).y);
    ctx.moveTo(l.x, l.y);
    ctx.lineTo(up(l).x, up(l).y);
  }
  ctx.moveTo(lowRail(lipA).x, lowRail(lipA).y);
  ctx.lineTo(lowRail(lipB).x, lowRail(lipB).y);
  const len = Math.hypot(lipB.x - lipA.x, lipB.y - lipA.y);
  const count = Math.max(3, Math.round(len / 4));
  for (let k = 1; k < count; k++) {
    const p = lerpPoint(lipA, lipB, k / count);
    ctx.moveTo(p.x, p.y - 3);
    ctx.lineTo(p.x, p.y - APARTMENT_RAIL_PX);
  }
  ctx.stroke();

  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(up(lipA).x, up(lipA).y);
  ctx.lineTo(up(lipB).x, up(lipB).y);
  ctx.stroke();
}

/** Flat parapet roof with a stair bulkhead, water tank, vents, and an aerial or dish. */
function fillApartmentRoof(
  ctx: CanvasRenderingContext2D,
  nw: Point,
  ne: Point,
  se: Point,
  sw: Point,
  depth: number,
  bld: BuildingFootprint,
) {
  fillParapetRoof(
    ctx, nw, ne, se, sw, depth,
    roofColorForType("apartment"),
    POLICE_STONE,
    POLICE_STONE_SHADOW,
    POLICE_ROOF_LIP_HEIGHT,
    WAREHOUSE_ROOF_LIP_INSET,
    bld,
    "apartment",
  );
  const flip = apartmentRoll(bld, 0x5a) < 0.5;
  const uv = (u0: number, v0: number, u1: number, v1: number) =>
    flip ? [v0, u0, v1, u1] as const : [u0, v0, u1, v1] as const;
  type Item = { key: number; draw: () => void };
  const items: Item[] = [];

  {
    const [u0, v0, u1, v1] = uv(0.18, 0.18, 0.4, 0.42);
    items.push({
      key: u0 + v0,
      draw: () => {
        drawRoofPropBox(ctx, nw, ne, se, sw, depth, u0, v0, u1, v1, 16, "#b3ab9c", "#8a8274", "#9d9586");
        // Door on the camera-facing SW side of the bulkhead.
        const a = roofDeckPoint(nw, ne, se, sw, depth, u0 + (u1 - u0) * 0.35, v1);
        const b = roofDeckPoint(nw, ne, se, sw, depth, u0 + (u1 - u0) * 0.65, v1);
        fillPoly(ctx, [a, b, raisePoint(b, 11), raisePoint(a, 11)], "#4d4a45");
      },
    });
  }
  {
    const [u0, v0, u1, v1] = uv(0.6, 0.22, 0.74, 0.36);
    items.push({
      key: u0 + v0,
      draw: () => {
        ctx.strokeStyle = "#4a3d30";
        ctx.lineWidth = 1;
        for (const [pu, pv] of [[u0, v1], [u1, v1], [u1, v0]] as const) {
          const p = roofDeckPoint(nw, ne, se, sw, depth, pu, pv);
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x, p.y - 6);
          ctx.stroke();
        }
        drawRoofPropBox(ctx, nw, ne, se, sw, depth, u0, v0, u1, v1, 9, "#8a6f55", "#5e4a37", "#7a6048", 6);
      },
    });
  }
  for (const [a, b] of [[0.3, 0.66], [0.38, 0.66]] as const) {
    const [u0, v0, u1, v1] = uv(a, b, a + 0.04, b + 0.04);
    items.push({
      key: u0 + v0,
      draw: () => drawRoofPropBox(ctx, nw, ne, se, sw, depth, u0, v0, u1, v1, 6, "#8a929a", "#5e666e", "#727a82"),
    });
  }
  {
    const [u, v] = flip ? [0.72, 0.74] : [0.74, 0.72];
    const dish = apartmentRoll(bld, 0xd15) < 0.5;
    items.push({
      key: u + v,
      draw: () => {
        const base = roofDeckPoint(nw, ne, se, sw, depth, u, v);
        ctx.strokeStyle = "#5a5f66";
        ctx.lineWidth = 1;
        ctx.beginPath();
        if (dish) {
          ctx.moveTo(base.x, base.y);
          ctx.lineTo(base.x, base.y - 5);
          ctx.stroke();
          ctx.fillStyle = "#c9cdd0";
          ctx.beginPath();
          ctx.ellipse(base.x - 1, base.y - 7, 3.5, 2.5, -0.5, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.moveTo(base.x, base.y);
          ctx.lineTo(base.x, base.y - 16);
          for (const [f, half] of [[12, 4], [15, 3]] as const) {
            ctx.moveTo(base.x - half, base.y - f + half / 2);
            ctx.lineTo(base.x + half, base.y - f - half / 2);
          }
          ctx.stroke();
        }
      },
    });
  }
  items.sort((a, b) => a.key - b.key);
  for (const item of items) item.draw();
}

function gunShopPalette(bld: BuildingFootprint) {
  const [wall, accent] = GUN_SHOP_PALETTES[variantPaletteIndex(bld, GUN_SHOP_PALETTES.length)]!;
  return {
    wall,
    wallSide: shadeHex(wall, 0.87),
    accent,
    accentSide: shadeHex(accent, 0.85),
  };
}

/** Small box fixed to a wall face, projecting `px` toward the street. */
function drawWallMountedBox(
  ctx: CanvasRenderingContext2D,
  bottomLeft: Point,
  bottomRight: Point,
  bottomFrac: number,
  topFrac: number,
  face: "SE" | "SW",
  px: number,
  front: string,
  top: string,
  end: string,
) {
  const out = faceOutVector(face);
  const s = (p: Point): Point => ({ x: p.x + out.x * px, y: p.y + out.y * px });
  const a = raisePoint(bottomLeft, WALL_DEPTH * bottomFrac);
  const b = raisePoint(bottomRight, WALL_DEPTH * bottomFrac);
  const c = raisePoint(bottomRight, WALL_DEPTH * topFrac);
  const d = raisePoint(bottomLeft, WALL_DEPTH * topFrac);
  // The camera-facing end is the lower one on screen.
  const [eb, et] = a.y > b.y ? [a, d] : [b, c];
  fillPoly(ctx, [eb, et, s(et), s(eb)], end);
  fillPoly(ctx, [d, c, s(c), s(d)], top);
  fillPoly(ctx, [s(a), s(b), s(c), s(d)], front);
}

/** Steel security bars over an opening: rails at the ends and middle, bars every ~4px. */
function drawSecurityBars(
  ctx: CanvasRenderingContext2D,
  bottomLeft: Point,
  bottomRight: Point,
  bottomFrac: number,
  topFrac: number,
  midRails = 1,
) {
  const rail = 0.014;
  const rails = [bottomFrac, topFrac - rail];
  for (let k = 1; k <= midRails; k++) {
    rails.push(bottomFrac + ((topFrac - bottomFrac) * k) / (midRails + 1) - rail / 2);
  }
  for (const f of rails) {
    fillWallBand(ctx, bottomLeft, bottomRight, f, f + rail, 0, GUN_SHOP_BAR);
    fillWallBand(ctx, bottomLeft, bottomRight, f + rail - 0.004, f + rail, 0, GUN_SHOP_BAR_HI);
  }
  const len = Math.hypot(bottomRight.x - bottomLeft.x, bottomRight.y - bottomLeft.y);
  const count = Math.max(3, Math.round(len / 4));
  ctx.strokeStyle = GUN_SHOP_BAR;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let k = 0; k <= count; k++) {
    const p = lerpPoint(bottomLeft, bottomRight, k / count);
    ctx.moveTo(p.x, p.y - WALL_DEPTH * bottomFrac);
    ctx.lineTo(p.x, p.y - WALL_DEPTH * topFrac);
  }
  ctx.stroke();
}

/** Faint mortar courses and staggered head joints over a painted block wall. */
function drawBlockCoursing(
  ctx: CanvasRenderingContext2D,
  a: Point,
  b: Point,
  faceLen: number,
  fromFrac: number,
) {
  const courses = 8;
  const perTile = 2;
  ctx.strokeStyle = "rgba(40, 36, 30, 0.09)";
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  for (let k = 0; k < courses; k++) {
    const f0 = k / courses;
    const f1 = (k + 1) / courses;
    if (f1 <= fromFrac) continue;
    const lo = Math.max(f0, fromFrac);
    if (k > 0 && f0 >= fromFrac) {
      const p = raisePoint(a, WALL_DEPTH * f0);
      const q = raisePoint(b, WALL_DEPTH * f0);
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(q.x, q.y);
    }
    const n = faceLen * perTile;
    for (let j = 0; j < n; j++) {
      const t = (j + (k % 2) * 0.5) / n;
      if (t <= 0 || t >= 1) continue;
      const p = lerpPoint(a, b, t);
      ctx.moveTo(p.x, p.y - WALL_DEPTH * lo);
      ctx.lineTo(p.x, p.y - WALL_DEPTH * f1);
    }
  }
  ctx.stroke();
}

/**
 * Small-town gun store: painted block walls over a dark base band, an accent
 * stripe and metal coping, barred display windows on the street front, a high
 * barred storeroom window, electric meter and alarm box on the side wall, and
 * a security camera on the front corner.
 */
function drawGunShopFacade(
  ctx: CanvasRenderingContext2D,
  scene: Phaser.Scene,
  bld: BuildingFootprint,
  offset: (p: Point) => Point,
  oSw: Point,
  oSe: Point,
  oNe: Point,
) {
  const pal = gunShopPalette(bld);
  fillFacadeBand(ctx, oSw, oSe, oNe, 0, 1, 0, pal.wall, pal.wallSide);
  drawBlockCoursing(ctx, oSw, oSe, bld.w, GUN_SHOP_BASE_FRAC);
  drawBlockCoursing(ctx, oNe, oSe, bld.h, GUN_SHOP_BASE_FRAC);
  fillFacadeBand(ctx, oSw, oSe, oNe, 0, GUN_SHOP_BASE_FRAC, 0, pal.accent, pal.accentSide);
  fillFacadeBand(
    ctx, oSw, oSe, oNe, GUN_SHOP_BASE_FRAC, GUN_SHOP_BASE_FRAC + 0.012, 0,
    shadeHex(pal.wall, 1.06), shadeHex(pal.wallSide, 1.06),
  );
  fillFacadeBand(ctx, oSw, oSe, oNe, GUN_SHOP_STRIPE[0], GUN_SHOP_STRIPE[1], 0, pal.accent, pal.accentSide);
  fillFacadeBand(ctx, oSw, oSe, oNe, 0.95, 1, 0, GUN_SHOP_COPING, GUN_SHOP_COPING_SIDE);
  fillFacadeBand(ctx, oSw, oSe, oNe, 0.94, 0.95, 0, "rgba(0, 0, 0, 0.18)", "rgba(0, 0, 0, 0.18)");

  const run = retailEntrance(bld);
  const street: "SE" | "SW" = run?.face ?? "SW";
  const sideFace: "SE" | "SW" = street === "SE" ? "SW" : "SE";
  const streetSide = street === "SE";
  const streetLen = streetSide ? bld.h : bld.w;
  const streetOrigin = streetSide ? bld.oy : bld.ox;
  const doorStart = run ? (streetSide ? run.y : run.x) - streetOrigin : -99;
  const doorEnd = run ? doorStart + run.span : -99;
  const [wb, wt] = GUN_SHOP_WINDOW;

  const art = resolveBigWindow1Source(scene, street);
  for (let i = 1; i < streetLen - 1; i++) {
    if (i >= doorStart && i < doorEnd) continue;
    const edge = facadeSpanEdge(bld, street, streetOrigin + i, 1, offset);
    if (!edge) continue;
    const l = lerpPoint(edge.bottomLeft, edge.bottomRight, 0.1);
    const r = lerpPoint(edge.bottomLeft, edge.bottomRight, 0.9);
    fillWallBand(
      ctx,
      lerpPoint(edge.bottomLeft, edge.bottomRight, 0.07),
      lerpPoint(edge.bottomLeft, edge.bottomRight, 0.93),
      wb - 0.03, wb, 0,
      streetSide ? "#bab3a4" : "#cfc8b8",
    );
    if (art) {
      drawSuperWindowOnWallFace(ctx, art, l, r, WALL_DEPTH, streetSide, wt - wb, 0, false);
    } else {
      fillWallBand(ctx, l, r, wb, wt, 0, "#6f8a96");
    }
    drawSecurityBars(ctx, l, r, wb, wt);
  }

  const sideIsSe = sideFace === "SE";
  const sideLen = sideIsSe ? bld.h : bld.w;
  const sideOrigin = sideIsSe ? bld.oy : bld.ox;
  const sideA = sideIsSe ? oNe : oSw;
  // Storeroom window high on the middle of the side wall.
  {
    const edge = facadeSpanEdge(bld, sideFace, sideOrigin + Math.floor(sideLen / 2), 1, offset);
    if (edge) {
      const l = lerpPoint(edge.bottomLeft, edge.bottomRight, 0.2);
      const r = lerpPoint(edge.bottomLeft, edge.bottomRight, 0.8);
      fillWallBand(ctx, l, r, 0.56, 0.76, 0, sideIsSe ? "#a9a397" : "#bcb5a7");
      const gl = lerpPoint(edge.bottomLeft, edge.bottomRight, 0.25);
      const gr = lerpPoint(edge.bottomLeft, edge.bottomRight, 0.75);
      fillWallBand(ctx, gl, gr, 0.58, 0.74, 0, sideIsSe ? "#5d6e76" : "#6c7f88");
      drawSecurityBars(ctx, gl, gr, 0.58, 0.74, 0);
    }
  }
  // Electric meter low on the back end of the side wall, conduit up to the roof.
  {
    const t0 = 0.6 / sideLen;
    const t1 = 0.95 / sideLen;
    const ml = lerpPoint(sideA, oSe, t0);
    const mr = lerpPoint(sideA, oSe, t1);
    const cl = lerpPoint(sideA, oSe, (t0 + t1) / 2 - 0.04 / sideLen);
    const cr = lerpPoint(sideA, oSe, (t0 + t1) / 2 + 0.04 / sideLen);
    fillWallBand(ctx, cl, cr, 0.5, 0.95, 0, "#7a7e83");
    drawWallMountedBox(ctx, ml, mr, 0.34, 0.5, sideFace, 2, "#9a9ea3", "#b5b9bd", "#7d8186");
    const dial = raisePoint(lerpPoint(ml, mr, 0.5), WALL_DEPTH * 0.44);
    const o = faceOutVector(sideFace);
    ctx.fillStyle = "#e3e6e8";
    ctx.beginPath();
    ctx.arc(dial.x + o.x * 2, dial.y + o.y * 2, 1.2, 0, Math.PI * 2);
    ctx.fill();
  }
  // Alarm bell box high near the front corner of the side wall.
  {
    const t0 = 1 - 0.75 / sideLen;
    const t1 = 1 - 0.45 / sideLen;
    const al = lerpPoint(sideA, oSe, t0);
    const ar = lerpPoint(sideA, oSe, t1);
    drawWallMountedBox(ctx, al, ar, 0.7, 0.8, sideFace, 2, "#8f3d34", "#a8584e", "#6e2e28");
  }

  drawGunShopCamera(ctx, street, oSw, oSe, oNe);
}

/** Dome-less box camera on a short arm at the front corner, looking down the street front. */
function drawGunShopCamera(
  ctx: CanvasRenderingContext2D,
  street: "SE" | "SW",
  oSw: Point,
  oSe: Point,
  oNe: Point,
) {
  const a = street === "SE" ? oNe : oSw;
  const lenPx = Math.hypot(oSe.x - a.x, oSe.y - a.y) || 1;
  const base = raisePoint(lerpPoint(a, oSe, 1 - 4 / lenPx), WALL_DEPTH * 0.8);
  const out = faceOutVector(street);
  const arm = { x: base.x + out.x * 4, y: base.y + out.y * 4 };
  ctx.strokeStyle = "#4a4c4f";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(base.x, base.y);
  ctx.lineTo(arm.x, arm.y);
  ctx.stroke();
  // Point the body back along the wall toward the door side, tilted down.
  const along = { x: (a.x - oSe.x) / lenPx, y: (a.y - oSe.y) / lenPx };
  const angle = Math.atan2(along.y + out.y * 0.6 + 0.35, along.x + out.x * 0.6);
  ctx.save();
  ctx.translate(arm.x, arm.y);
  ctx.rotate(angle);
  ctx.scale(1.3, 1.3);
  ctx.fillStyle = "#d8d6cf";
  ctx.fillRect(-1, -1.6, 6.5, 3.2);
  ctx.fillStyle = "#a9a7a0";
  ctx.fillRect(-1, 0.8, 6.5, 0.8);
  ctx.fillStyle = "#e6e4dd";
  ctx.fillRect(-1.5, -2.2, 7.5, 0.9);
  ctx.fillStyle = "#24272b";
  ctx.fillRect(5.2, -1, 1, 2);
  ctx.restore();
}

/** Steel gate over the glass door and a wall-pack light above it. */
function drawGunShopEntrance(
  ctx: CanvasRenderingContext2D,
  bld: BuildingFootprint,
  offset: (p: Point) => Point,
) {
  const run = retailEntrance(bld);
  const edge = entranceWallEdge(bld, offset);
  if (!run || !edge) return;
  const l = lerpPoint(edge.bottomLeft, edge.bottomRight, 0.03);
  const r = lerpPoint(edge.bottomLeft, edge.bottomRight, 0.97);
  drawSecurityBars(ctx, l, r, 0.015, GUN_SHOP_DOOR_FRAC, 2);
  const jamb = 1.5 / (Math.hypot(r.x - l.x, r.y - l.y) || 1);
  fillWallBand(ctx, l, lerpPoint(l, r, jamb), 0.015, GUN_SHOP_DOOR_FRAC, 0, GUN_SHOP_BAR);
  fillWallBand(ctx, lerpPoint(l, r, 1 - jamb), r, 0.015, GUN_SHOP_DOOR_FRAC, 0, GUN_SHOP_BAR);

  const ll = lerpPoint(edge.bottomLeft, edge.bottomRight, 0.38);
  const lr = lerpPoint(edge.bottomLeft, edge.bottomRight, 0.62);
  drawWallMountedBox(ctx, ll, lr, 0.74, 0.8, run.face, 3, "#3b3a37", "#55534e", "#2c2b29");
  const out = faceOutVector(run.face);
  const lens = [ll, lr].map((p) => {
    const q = raisePoint(p, WALL_DEPTH * 0.74);
    return { x: q.x + out.x * 3, y: q.y + out.y * 3 };
  });
  fillPoly(
    ctx,
    [lens[0]!, lens[1]!, raisePoint(lens[1]!, 1.5), raisePoint(lens[0]!, 1.5)],
    "#e8dfb8",
  );
}

/** Weathered gravel deck behind a metal-capped parapet, with an HVAC unit and vents. */
function fillGunShopRoof(
  ctx: CanvasRenderingContext2D,
  nw: Point,
  ne: Point,
  se: Point,
  sw: Point,
  depth: number,
  bld: BuildingFootprint,
) {
  fillParapetRoof(
    ctx, nw, ne, se, sw, depth,
    roofColorForType("gun_shop"),
    GUN_SHOP_COPING,
    GUN_SHOP_COPING_SIDE,
    POLICE_ROOF_LIP_HEIGHT,
    WAREHOUSE_ROOF_LIP_INSET,
    bld,
    "gun_shop",
  );
  const flip = variantPaletteIndex(bld, 2) === 1;
  const uv = (u0: number, v0: number, u1: number, v1: number) =>
    flip ? [v0, u0, v1, u1] as const : [u0, v0, u1, v1] as const;
  type Item = { key: number; draw: () => void };
  const items: Item[] = [];
  {
    // About 1.3 x 1.2 tiles whatever the footprint.
    const su = Math.min(0.3, 1.3 / (flip ? bld.h : bld.w));
    const sv = Math.min(0.28, 1.2 / (flip ? bld.w : bld.h));
    const [u0, v0, u1, v1] = uv(0.52, 0.2, 0.52 + su, 0.2 + sv);
    const h = 10;
    items.push({
      key: u0 + v0,
      draw: () => {
        drawRoofPropBox(ctx, nw, ne, se, sw, depth, u0, v0, u1, v1, h, "#9aa2aa", "#6a727a", "#7e868e");
        const c = raisePoint(roofDeckPoint(nw, ne, se, sw, depth, (u0 + u1) / 2, (v0 + v1) / 2), h);
        ctx.fillStyle = "#4a4f55";
        ctx.beginPath();
        ctx.ellipse(c.x, c.y, 4.5, 2.3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#7b8188";
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(c.x - 3.5, c.y);
        ctx.lineTo(c.x + 3.5, c.y);
        ctx.moveTo(c.x, c.y - 1.8);
        ctx.lineTo(c.x, c.y + 1.8);
        ctx.stroke();
      },
    });
  }
  {
    const [u0, v0, u1, v1] = uv(0.18, 0.18, 0.32, 0.32);
    items.push({
      key: u0 + v0,
      draw: () => drawRoofPropBox(ctx, nw, ne, se, sw, depth, u0, v0, u1, v1, 3, "#8c8a84", "#666460", "#76746f"),
    });
  }
  for (const [a, b] of [[0.26, 0.64], [0.36, 0.72]] as const) {
    const [u0, v0, u1, v1] = uv(a, b, a + 0.04, b + 0.04);
    items.push({
      key: u0 + v0,
      draw: () => {
        drawRoofPropBox(ctx, nw, ne, se, sw, depth, u0, v0, u1, v1, 7, "#8a929a", "#5e666e", "#727a82");
        drawRoofPropBox(ctx, nw, ne, se, sw, depth, u0 - 0.008, v0 - 0.008, u1 + 0.008, v1 + 0.008, 1.5, "#4d5257", "#3a3e42", "#44484c", 7);
      },
    });
  }
  items.sort((a, b) => a.key - b.key);
  for (const item of items) item.draw();
}

/** Thin radio mast with crossbars near the back corner of the police roof. */
function drawPoliceRadioMast(
  ctx: CanvasRenderingContext2D,
  nw: Point,
  ne: Point,
  se: Point,
  sw: Point,
  depth: number,
) {
  const base = roofDeckPoint(nw, ne, se, sw, depth, 0.76, 0.24);
  const top = raisePoint(base, POLICE_MAST_HEIGHT_PX);
  // Small concrete footing, then the pole.
  drawRoofPropBox(ctx, nw, ne, se, sw, depth, 0.72, 0.2, 0.8, 0.28, 2, "#8f939a", "#6c7077", "#7c8087");
  const foot = raisePoint(base, 2);
  ctx.strokeStyle = "#5a5f66";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(foot.x, foot.y);
  ctx.lineTo(top.x, top.y);
  ctx.stroke();
  ctx.lineWidth = 1;
  for (const [f, half] of [
    [0.55, 3],
    [0.8, 2],
  ] as const) {
    const p = lerpPoint(foot, top, f);
    ctx.beginPath();
    ctx.moveTo(p.x - half, p.y + half / 2);
    ctx.lineTo(p.x + half, p.y - half / 2);
    ctx.stroke();
  }
  ctx.fillStyle = "#b8463c";
  ctx.fillRect(top.x - 1, top.y - 1.5, 2, 2);
}

/** Keep house Window1 ≥ this many tiles from both façade corners. */
const HOUSE_WINDOW_CORNER_GAP = 1;
/** Non-door faces at least this long get two windows instead of one. */
const HOUSE_TWO_WINDOW_MIN_LEN = 5;

/** Stable 0..1 roll per house variant. */
function houseRoll(bld: BuildingFootprint, salt: number): number {
  let h = (Math.imul(variantSeedOf(bld) + 1, 73856093) ^ salt) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  h = Math.imul(h, 0x7feb352d) >>> 0;
  h = (h ^ (h >>> 15)) >>> 0;
  return h / 0x1_0000_0000;
}

/** Roof shingle tint per house, so a street of houses is not uniform. */
function houseRoofColor(bld: BuildingFootprint | undefined): string {
  if (!bld) return roofColorForType("house");
  const i = Math.floor(houseRoll(bld, 0x2f00f) * HOUSE_ROOF_TINTS.length);
  return HOUSE_ROOF_TINTS[Math.min(i, HOUSE_ROOF_TINTS.length - 1)]!;
}

function houseHasHood(bld: BuildingFootprint): boolean {
  return houseRoll(bld, 0x40d1) < HOUSE_HOOD_CHANCE;
}

function houseEaveTrim(bld: BuildingFootprint): readonly [string, string] {
  const i = Math.floor(houseRoll(bld, 0x7a1e) * HOUSE_EAVE_TRIMS.length);
  return HOUSE_EAVE_TRIMS[Math.min(i, HOUSE_EAVE_TRIMS.length - 1)]!;
}

/**
 * Residential: Window1 on the non-door SE/SW face, ≥1 tile from each corner.
 * Longer faces get two windows, shorter ones a single centred window.
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

  const slots =
    faceLen >= HOUSE_TWO_WINDOW_MIN_LEN
      ? [minSlot, maxSlot]
      : [Math.min(maxSlot, Math.max(minSlot, Math.floor(faceLen / 2)))];
  for (const slot of slots) {
    const tx = sideFace === "SE" ? ox + w - 1 : ox + slot;
    const ty = sideFace === "SE" ? oy + slot : oy + h - 1;
    const edge = wallTileEdge(sideFace, tx, ty, bld, offset);
    if (!edge) continue;
    drawWindowOnWallTile(
      ctx,
      window,
      edge.bottomLeft,
      edge.bottomRight,
      0,
      sideFace === "SE",
    );
  }
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
  baseH = 0,
) {
  const lift = (p: Point): Point => ({ x: p.x, y: p.y - baseH });
  const bl = lift(roofDeckPoint(nw, ne, se, sw, depth, u0, v1)); // SW
  const br = lift(roofDeckPoint(nw, ne, se, sw, depth, u1, v1)); // SE
  const tr = lift(roofDeckPoint(nw, ne, se, sw, depth, u1, v0)); // NE
  const tl = lift(roofDeckPoint(nw, ne, se, sw, depth, u0, v0)); // NW
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
  drawPoliceRadioMast(ctx, nw, ne, se, sw, depth);
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

/** Flat retail roof: parapet plus one rooftop unit. */
function fillRetailRoof(
  ctx: CanvasRenderingContext2D,
  nw: Point,
  ne: Point,
  se: Point,
  sw: Point,
  depth: number,
  bld: BuildingFootprint,
) {
  fillParapetRoof(
    ctx,
    nw,
    ne,
    se,
    sw,
    depth,
    roofColorForType("large_retail"),
    RETAIL_ROOF_LIP,
    RETAIL_ROOF_LIP_FACE,
    POLICE_ROOF_LIP_HEIGHT,
    WAREHOUSE_ROOF_LIP_INSET,
    bld,
    "large_retail",
  );
  let h = Math.imul(variantSeedOf(bld) + 13, 2654435761) >>> 0;
  h ^= h >>> 16;
  const transpose = (h & 1) === 1;
  // Tallest unit stays within the parapet + prop allowance used for bounds.
  const unit = POLICE_ROOF_LIP_HEIGHT + Math.round(SUPERMARKET_ROOF_PROP_HEIGHT * 0.75) - 3;
  type Prop = {
    u0: number; v0: number; u1: number; v1: number; h: number; base?: number;
    top: string; side: string; front: string;
  };
  const plant = (u0: number, v0: number, u1: number, v1: number, height: number): Prop => ({
    u0, v0, u1, v1, h: height, top: "#9aa2aa", side: "#6a727a", front: "#7e868e",
  });
  const fan = (u0: number, v0: number, u1: number, v1: number): Prop => ({
    u0, v0, u1, v1, h: 2, base: unit, top: "#4f565d", side: "#5e656c", front: "#6a7178",
  });
  // Each group draws as one unit, so fan shrouds stay on top of their housing.
  const groups: Prop[][] = [
    [plant(0.12, 0.12, 0.34, 0.3, unit), fan(0.15, 0.15, 0.21, 0.21), fan(0.25, 0.21, 0.31, 0.27)],
    [plant(0.38, 0.14, 0.5, 0.26, unit - 3)],
    [plant(0.7, 0.16, 0.78, 0.24, 4)],
    [plant(0.2, 0.62, 0.24, 0.66, 7)],
    [plant(0.3, 0.62, 0.34, 0.66, 7)],
  ];
  for (const u of [0.46, 0.6, 0.74]) {
    groups.push([
      {
        u0: u, v0: 0.5, u1: u + 0.09, v1: 0.64, h: 4,
        top: RETAIL_SKYLIGHT_GLASS, side: RETAIL_SKYLIGHT_FRAME_SIDE, front: RETAIL_SKYLIGHT_FRAME,
      },
    ]);
  }
  const placed = groups.map((g) =>
    g.map((p) => (transpose ? { ...p, u0: p.v0, v0: p.u0, u1: p.v1, v1: p.u1 } : p)),
  );
  placed.sort((a, b) => a[0]!.u0 + a[0]!.v0 - (b[0]!.u0 + b[0]!.v0));
  for (const group of placed) {
    for (const p of group) {
      drawRoofPropBox(ctx, nw, ne, se, sw, depth, p.u0, p.v0, p.u1, p.v1, p.h, p.top, p.side, p.front, p.base);
    }
  }
}

/** Flat office roof. Two-storey blocks get one small rooftop unit. */
function fillOfficeRoof(
  ctx: CanvasRenderingContext2D,
  nw: Point,
  ne: Point,
  se: Point,
  sw: Point,
  depth: number,
  bld: BuildingFootprint,
) {
  fillParapetRoof(
    ctx,
    nw,
    ne,
    se,
    sw,
    depth,
    roofColorForType("office"),
    OFFICE_ROOF_LIP,
    OFFICE_ROOF_LIP_FACE,
    POLICE_ROOF_LIP_HEIGHT,
    WAREHOUSE_ROOF_LIP_INSET,
    bld,
    "office",
  );
  if ((bld.exteriorLevels ?? 1) < 2) {
    // Small condenser set back from the street so the low roof is not bare.
    drawRoofPropBox(
      ctx, nw, ne, se, sw, depth,
      0.62, 0.16, 0.78, 0.28,
      POLICE_ROOF_PROP_HEIGHT,
      "#9aa2aa", "#6a727a", "#7e868e",
    );
    return;
  }
  drawRoofPropBox(
    ctx,
    nw,
    ne,
    se,
    sw,
    depth,
    0.16,
    0.14,
    0.32,
    0.3,
    POLICE_ROOF_PROP_HEIGHT,
    "#9aa2aa",
    "#6a727a",
    "#7e868e",
  );
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
    const rtuH = SUPERMARKET_ROOF_PROP_HEIGHT * 0.85;
    const [u0, u1] = u(0.12, 0.32);
    box(u0, 0.12, u1, 0.30, rtuH, hvacTop, hvacSide, hvacFront);
    // Fan shrouds sit on the unit's lid.
    for (const [a, b, v0, v1] of [
      [0.15, 0.21, 0.15, 0.21],
      [0.24, 0.30, 0.21, 0.27],
    ] as const) {
      const [f0, f1] = u(a, b);
      drawRoofPropBox(ctx, nw, ne, se, sw, depth, f0, v0, f1, v1, 2, "#4f565d", "#5e656c", "#6a7178", rtuH);
    }
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
    box(u0, 0.62, u1, 0.76, 4, skyTop, skySide, skyFront);
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
  const base = houseRoofColor(bld);
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
    strokeRidgeCap(ctx, ridgeW, ridgeE, shadeHex(base, 0.6));
    return;
  }

  const ridgeN = raisePoint(lerpPoint(dNw, dNe, 0.5), peak);
  const ridgeS = raisePoint(lerpPoint(dSw, dSe, 0.5), peak);
  fillPoly(ctx, [dNw, dSw, ridgeS, ridgeN], lightSlope);
  fillPoly(ctx, [dNe, dSe, ridgeS, ridgeN], darkSlope);
  // South gable (SW end) — fills the gap at the short end.
  fillPoly(ctx, [dSw, dSe, ridgeS], gableEnd);
  paintGableRoofWear(ctx, [dNw, dSw, ridgeS, ridgeN], [dNe, dSe, ridgeS, ridgeN], bld, "house");
  strokeRidgeCap(ctx, ridgeN, ridgeS, shadeHex(base, 0.6));
}

function strokeRidgeCap(ctx: CanvasRenderingContext2D, a: Point, b: Point, color: string) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.lineCap = "butt";
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

  if (buildingType === "large_retail") {
    fillRetailRoof(ctx, nw, ne, se, sw, depth, bld!);
    return;
  }

  if (buildingType === "office") {
    fillOfficeRoof(ctx, nw, ne, se, sw, depth, bld!);
    return;
  }

  if (buildingType === "apartment") {
    fillApartmentRoof(ctx, nw, ne, se, sw, depth, bld!);
    return;
  }

  if (buildingType === "gun_shop") {
    fillGunShopRoof(ctx, nw, ne, se, sw, depth, bld!);
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
    drawWarehouseRoofDetail(ctx, [dNw, dNe, ridgeE, ridgeW], [dSw, dSe, ridgeE, ridgeW], ridgeW, ridgeE, WAREHOUSE_ROOF_DECK);
  } else {
    const ridgeN = raisePoint(lerpPoint(dNw, dNe, 0.5), peak);
    const ridgeS = raisePoint(lerpPoint(dSw, dSe, 0.5), peak);
    fillPoly(ctx, [dNw, dSw, ridgeS, ridgeN], lightSlope);
    fillPoly(ctx, [dNe, dSe, ridgeS, ridgeN], darkSlope);
    fillPoly(ctx, [dSw, dSe, ridgeS], gableEnd);
    paintGableRoofWear(ctx, [dNw, dSw, ridgeS, ridgeN], [dNe, dSe, ridgeS, ridgeN], bld, "warehouse");
    drawWarehouseRoofDetail(ctx, [dNw, dSw, ridgeS, ridgeN], [dNe, dSe, ridgeS, ridgeN], ridgeN, ridgeS, WAREHOUSE_ROOF_DECK);
  }
}

/** Flat motel deck at the wall plate, pushed out by the shallow eave. */
function motelFlatDeck(
  nw: Point,
  ne: Point,
  se: Point,
  sw: Point,
  depth: number,
): [Point, Point, Point, Point] {
  const wallDeck: [Point, Point, Point, Point] = [
    { x: nw.x, y: nw.y - depth },
    { x: ne.x, y: ne.y - depth },
    { x: se.x, y: se.y - depth },
    { x: sw.x, y: sw.y - depth },
  ];
  return outsetRoofQuad(wallDeck, MOTEL_ROOF_OVERHANG) as [
    Point,
    Point,
    Point,
    Point,
  ];
}

/**
 * Street false-front on the outer eave. `topA` is the north (SE door) or
 * west (SW door) end, matching door-centre interpolation along the façade.
 */
function motelStreetParapet(
  deck: [Point, Point, Point, Point],
  face: "SE" | "SW",
  height = MOTEL_PARAPET_HEIGHT,
): {
  front: Point[];
  cap: Point[];
  returnA: Point[];
  returnB: Point[];
  topA: Point;
  topB: Point;
} {
  const [dNw, dNe, dSe, dSw] = deck;
  const a = face === "SE" ? dNe : dSw;
  const b = dSe;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const cx = (dNw.x + dNe.x + dSe.x + dSw.x) / 4;
  const cy = (dNw.y + dNe.y + dSe.y + dSw.y) / 4;
  const mid = lerpPoint(a, b, 0.5);
  let ox = -dy / len;
  let oy = dx / len;
  if (ox * (mid.x - cx) + oy * (mid.y - cy) < 0) {
    ox = -ox;
    oy = -oy;
  }
  const inA = { x: a.x - ox * MOTEL_PARAPET_THICK, y: a.y - oy * MOTEL_PARAPET_THICK };
  const inB = { x: b.x - ox * MOTEL_PARAPET_THICK, y: b.y - oy * MOTEL_PARAPET_THICK };
  const topA = raisePoint(a, height);
  const topB = raisePoint(b, height);
  const inTopA = raisePoint(inA, height);
  const inTopB = raisePoint(inB, height);
  return {
    front: [a, b, topB, topA],
    cap: [topA, topB, inTopB, inTopA],
    returnA: [a, inA, inTopA, topA],
    returnB: [b, inB, inTopB, topB],
    topA,
    topB,
  };
}

/** Low asphalt deck plus a street false-front. No house gable. */
function fillMotelRoof(
  ctx: CanvasRenderingContext2D,
  nw: Point,
  ne: Point,
  se: Point,
  sw: Point,
  depth: number,
  bld: BuildingFootprint,
) {
  const fascia = shadeHex(MOTEL_ROOF_DECK, 0.55);
  const wallDeck: [Point, Point, Point, Point] = [
    { x: nw.x, y: nw.y - depth },
    { x: ne.x, y: ne.y - depth },
    { x: se.x, y: se.y - depth },
    { x: sw.x, y: sw.y - depth },
  ];
  const deck = motelFlatDeck(nw, ne, se, sw, depth);
  const [dNw, dNe, dSe, dSw] = deck;

  fillPoly(ctx, [wallDeck[3]!, wallDeck[2]!, dSe, dSw], fascia);
  fillPoly(ctx, [wallDeck[1]!, wallDeck[2]!, dSe, dNe], fascia);
  fillPoly(ctx, deck, shadeHex(MOTEL_ROOF_DECK, 1.04));
  paintRoofDecals(ctx, [deck], roofWearKey(bld, "flat"), "motel");

  if (bld.entranceX == null || bld.entranceY == null) return;
  const face = buildingEntranceFace({
    ox: bld.ox,
    oy: bld.oy,
    w: bld.w,
    h: bld.h,
    entranceX: bld.entranceX,
    entranceY: bld.entranceY,
  });
  drawMotelRoofVents(ctx, nw, ne, se, sw, depth, bld, face);
  const board = motelSignBoard(bld, deck);
  if (!board) return;
  const paint = (pts: Point[], color: string) => fillPoly(ctx, pts, color);
  paintMotelSignBoard(board, paint, motelPalette(bld));
  drawFacadeWord(
    ctx,
    board.text,
    "MOTEL",
    board.side ? MOTEL_SIGN_RED_SIDE : MOTEL_SIGN_RED,
    MOTEL_SIGN_TEXT_PAD_PX,
    MOTEL_SIGN_SHADOW,
  );
}

type MotelSignBoard = {
  side: boolean;
  front: Point[];
  cap: Point[];
  /** The board end the camera can see. The far end hides behind the front. */
  end: Point[];
  text: FacadeQuad;
};

/**
 * The raised street front, cut down to the span the MOTEL lettering occupies.
 * The rest of the eave stays a plain roof edge.
 */
function motelSignBoard(
  bld: BuildingFootprint,
  deck: [Point, Point, Point, Point],
): MotelSignBoard | null {
  if (bld.entranceX == null || bld.entranceY == null) return null;
  const face = buildingEntranceFace({
    ox: bld.ox,
    oy: bld.oy,
    w: bld.w,
    h: bld.h,
    entranceX: bld.entranceX,
    entranceY: bld.entranceY,
  });
  const side = face === "SE";
  const faceLen = Math.max(1, side ? bld.h : bld.w);
  const doorStart = side ? bld.entranceY - bld.oy : bld.entranceX - bld.ox;
  const doorT = (doorStart + buildingEntranceSpan(bld) * 0.5) / faceLen;
  const span = facadeSignSpan(faceLen, doorT, MOTEL_SIGN_TILES);
  if (!span) return null;

  const para = motelStreetParapet(deck, face);
  const a = para.front[0]!;
  const b = para.front[1]!;
  const inA = para.returnA[1]!;
  const inOff = { x: inA.x - a.x, y: inA.y - a.y };
  const outer = (t: number, rise: number) => raisePoint(lerpPoint(a, b, t), rise);
  const inner = (t: number, rise: number) => {
    const p = outer(t, rise);
    return { x: p.x + inOff.x, y: p.y + inOff.y };
  };
  const top = MOTEL_PARAPET_HEIGHT;
  let o0 = outer(span.t0, 0);
  let o1 = outer(span.t1, 0);
  let i0 = inner(span.t0, 0);
  let i1 = inner(span.t1, 0);
  if (o1.x < o0.x || (o1.x === o0.x && o1.y < o0.y)) {
    [o0, o1] = [o1, o0];
    [i0, i1] = [i1, i0];
  }
  const o0t = raisePoint(o0, top);
  const o1t = raisePoint(o1, top);
  // The end whose outward direction points down-screen faces the camera.
  const leftVisible = o0.y > o1.y;
  return {
    side,
    front: [o0, o1, o1t, o0t],
    cap: [o0t, o1t, raisePoint(i1, top), raisePoint(i0, top)],
    end: leftVisible
      ? [o0, i0, raisePoint(i0, top), o0t]
      : [o1, i1, raisePoint(i1, top), o1t],
    text: facadeTextArea(para, span.t0, span.t1, top),
  };
}

type MotelPalette = {
  wall: string;
  wallSide: string;
  trim: string;
  trimSide: string;
  /** Street false-front, a step darker than the wall it rises from. */
  parapet: string;
  parapetSide: string;
  /** Cap along the top of the false-front. The sign sits on this. */
  cap: string;
  /** Darker band along the parapet foot and the wall base. */
  band: string;
  bandSide: string;
  /** Raised pilaster, a step lighter than the stucco. */
  pier: string;
  pierSide: string;
  pierEdge: string;
  pierEdgeSide: string;
  /** Light cap on the cornice and the sill ledge. */
  coping: string;
  copingSide: string;
};

function motelPalette(bld: BuildingFootprint): MotelPalette {
  const wall = MOTEL_WALL_FRONTS[variantPaletteIndex(bld, MOTEL_WALL_FRONTS.length)]!;
  return {
    wall,
    wallSide: shadeHex(wall, 0.86),
    trim: shadeHex(wall, 0.73),
    trimSide: shadeHex(wall, 0.62),
    parapet: shadeHex(wall, 0.78),
    parapetSide: shadeHex(wall, 0.67),
    cap: shadeHex(wall, 0.84),
    band: shadeHex(wall, 0.65),
    bandSide: shadeHex(wall, 0.55),
    pier: shadeHex(wall, 1.08),
    pierSide: shadeHex(wall, 0.94),
    pierEdge: shadeHex(wall, 0.7),
    pierEdgeSide: shadeHex(wall, 0.58),
    coping: shadeHex(wall, 1.14),
    copingSide: shadeHex(wall, 1.0),
  };
}

function paintMotelSignBoard(
  board: MotelSignBoard,
  paint: (pts: Point[], color: string) => void,
  pal: MotelPalette,
) {
  const { side } = board;
  paint(board.end, side ? pal.parapet : pal.parapetSide);
  paint(board.cap, pal.cap);
  paint(board.front, side ? pal.parapetSide : pal.parapet);
  const [bl, br] = [board.front[0]!, board.front[1]!];
  paint(
    [bl, br, raisePoint(br, 4), raisePoint(bl, 4)],
    side ? pal.bandSide : pal.band,
  );
}

/** One small exhaust vent per few rooms, along the back of the deck. */
function drawMotelRoofVents(
  ctx: CanvasRenderingContext2D,
  nw: Point,
  ne: Point,
  se: Point,
  sw: Point,
  depth: number,
  bld: BuildingFootprint,
  face: "SE" | "SW",
) {
  const frontage = Math.max(1, face === "SE" ? bld.h : bld.w);
  const deep = Math.max(1, face === "SE" ? bld.w : bld.h);
  const count = Math.max(2, Math.round(frontage / 3.5));
  const size = 0.42;
  const vents: { u0: number; v0: number; u1: number; v1: number }[] = [];
  for (let i = 0; i < count; i++) {
    const c = (i + 0.5) / count;
    const a0 = c - size / frontage / 2;
    const a1 = c + size / frontage / 2;
    const b0 = 0.4 / deep;
    const b1 = (0.4 + size) / deep;
    vents.push(
      face === "SE"
        ? { u0: b0, u1: b1, v0: a0, v1: a1 }
        : { u0: a0, u1: a1, v0: b0, v1: b1 },
    );
  }
  vents.sort((p, q) => p.u0 + p.v0 - (q.u0 + q.v0));
  for (const v of vents) {
    drawRoofPropBox(
      ctx, nw, ne, se, sw, depth,
      v.u0, v.v0, v.u1, v.v1,
      5,
      MOTEL_VENT_TOP,
      MOTEL_VENT_SIDE,
      MOTEL_VENT_FRONT,
    );
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
    drawTentSeams(ctx, [dNw, dNe, ridgeE, ridgeW], [dSw, dSe, ridgeE, ridgeW], bld.w, lightSlope, darkSlope);
  } else {
    const ridgeN = raisePoint(lerpPoint(dNw, dNe, 0.5), peak);
    const ridgeS = raisePoint(lerpPoint(dSw, dSe, 0.5), peak);
    fillPoly(ctx, [dNw, dSw, ridgeS, ridgeN], lightSlope);
    fillPoly(ctx, [dNe, dSe, ridgeS, ridgeN], darkSlope);
    fillPoly(ctx, [dSw, dSe, ridgeS], TENT_GABLE);
    paintGableRoofWear(ctx, [dNw, dSw, ridgeS, ridgeN], [dNe, dSe, ridgeS, ridgeN], bld, "tent");
    drawTentSeams(ctx, [dNw, dSw, ridgeS, ridgeN], [dNe, dSe, ridgeS, ridgeN], bld.h, lightSlope, darkSlope);
  }
  drawTentGuyRopes(ctx, wallDeck, ne, se, sw);
}

/** Stitched panel seams across both canvas slopes, one per tile of length. */
function drawTentSeams(
  ctx: CanvasRenderingContext2D,
  light: [Point, Point, Point, Point],
  dark: [Point, Point, Point, Point],
  length: number,
  lightColor: string,
  darkColor: string,
) {
  ctx.lineWidth = 1;
  for (const [q, color] of [
    [light, lightColor],
    [dark, darkColor],
  ] as const) {
    ctx.strokeStyle = shadeHex(color, 0.8);
    for (let i = 1; i < length; i++) {
      const a = slopePoint(q, i / length, 0);
      const b = slopePoint(q, i / length, 1);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }
}

/** Guy ropes from the three camera-facing eave corners to pegs in the ground. */
function drawTentGuyRopes(
  ctx: CanvasRenderingContext2D,
  wallDeck: Point[],
  ne: Point,
  se: Point,
  sw: Point,
) {
  const corners: [Point, Point, Point][] = [
    [wallDeck[3]!, sw, { x: -1, y: 0.15 }],
    [wallDeck[2]!, se, { x: 0, y: 1 }],
    [wallDeck[1]!, ne, { x: 1, y: 0.15 }],
  ];
  ctx.strokeStyle = TENT_ROPE;
  ctx.lineWidth = 1;
  for (const [eave, ground, dir] of corners) {
    const peg = { x: ground.x + dir.x * TENT_PEG_OUT_PX, y: ground.y + dir.y * TENT_PEG_OUT_PX * 0.6 };
    ctx.beginPath();
    ctx.moveTo(eave.x, eave.y);
    ctx.lineTo(peg.x, peg.y);
    ctx.stroke();
    ctx.fillStyle = TENT_PEG;
    ctx.fillRect(peg.x - 1, peg.y - 2, 2, 3);
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
    drawStovepipe(ctx, slopePoint([dSw, dSe, ridgeE, ridgeW], 0.3, 0.6));
  } else {
    const ridgeN = raisePoint(lerpPoint(dNw, dNe, 0.5), peak);
    const ridgeS = raisePoint(lerpPoint(dSw, dSe, 0.5), peak);
    fillPoly(ctx, [dNw, dSw, ridgeS, ridgeN], lightSlope);
    fillPoly(ctx, [dNe, dSe, ridgeS, ridgeN], darkSlope);
    fillPoly(ctx, [dSw, dSe, ridgeS], MESS_HALL_GABLE);
    paintGableRoofWear(ctx, [dNw, dSw, ridgeS, ridgeN], [dNe, dSe, ridgeS, ridgeN], bld, "mess_hall");
    drawStovepipe(ctx, slopePoint([dNe, dSe, ridgeS, ridgeN], 0.3, 0.6));
  }
}

/** Galvanised stovepipe with a rain cap, rising from a roof slope point. */
function drawStovepipe(ctx: CanvasRenderingContext2D, base: Point) {
  const h = 20;
  const r = 2;
  fillPoly(ctx, [{ x: base.x - r, y: base.y + 1 }, { x: base.x, y: base.y + 1 }, { x: base.x, y: base.y - h }, { x: base.x - r, y: base.y - h }], "#8d9194");
  fillPoly(ctx, [{ x: base.x, y: base.y + 1 }, { x: base.x + r, y: base.y + 1 }, { x: base.x + r, y: base.y - h }, { x: base.x, y: base.y - h }], "#6b6f72");
  ctx.fillStyle = "#a3a7aa";
  ctx.beginPath();
  ctx.moveTo(base.x - 4.5, base.y - h + 0.5);
  ctx.lineTo(base.x, base.y - h - 3.5);
  ctx.lineTo(base.x + 4.5, base.y - h + 0.5);
  ctx.closePath();
  ctx.fill();
}

/** Plank courses, a dark base board, and small framed windows on the prefab hut. */
function drawMessHallDetail(
  ctx: CanvasRenderingContext2D,
  bld: BuildingFootprint,
  offset: (p: Point) => Point,
  oSw: Point,
  oSe: Point,
  oNe: Point,
) {
  const front = shadeHex(MESS_HALL_WALL_FRONT, 0.88);
  const sideLine = shadeHex(MESS_HALL_WALL_SIDE, 0.88);
  for (let f = 0.16; f < 0.98; f += 0.1) {
    fillFacadeBand(ctx, oSw, oSe, oNe, f, f + 0.009, 0, front, sideLine);
  }
  fillFacadeBand(ctx, oSw, oSe, oNe, 0, 0.08, 0, MESS_HALL_BASEBOARD, MESS_HALL_BASEBOARD_SIDE);

  const run = retailEntrance(bld);
  for (const face of ["SW", "SE"] as const) {
    const side = face === "SE";
    const faceLen = side ? bld.h : bld.w;
    const origin = side ? bld.oy : bld.ox;
    const doorStart = run && run.face === face ? (side ? run.y : run.x) - origin : -99;
    const doorEnd = run && run.face === face ? doorStart + run.span : -99;
    for (let i = 1; i < faceLen - 1; i += 2) {
      if (i >= doorStart - 1 && i <= doorEnd) continue;
      const edge = facadeSpanEdge(bld, face, origin + i, 1, offset);
      if (!edge) continue;
      drawGlassPanel(
        ctx,
        edge.bottomLeft,
        edge.bottomRight,
        0.38,
        0.68,
        0,
        MESS_HALL_WINDOW_FRAME,
        side ? MESS_HALL_WINDOW_GLASS_SIDE : MESS_HALL_WINDOW_GLASS,
        MESS_HALL_WINDOW_FRAME,
        true,
        false,
      );
    }
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
  drawMessHallDetail(ctx, bld, offset, oSw, oSe, oNe);

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

/** Office door span and the street windows that step out from it. */
function motelStreetOpenings(bld: BuildingFootprint): {
  face: "SE" | "SW";
  doorStart: number;
  doorEnd: number;
  windows: number[];
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
  const faceLen = face === "SE" ? bld.h : bld.w;
  const doorStart = face === "SE" ? bld.entranceY - bld.oy : bld.entranceX - bld.ox;
  const doorEnd = doorStart + buildingEntranceSpan(bld);
  const windows: number[] = [];
  const push = (i: number) => {
    if (i >= 1 && i < faceLen - 1) windows.push(i);
  };
  for (let i = doorStart - 2; i >= 1; i -= 2) push(i);
  for (let i = doorEnd + 1; i < faceLen - 1; i += 2) push(i);
  return { face, doorStart, doorEnd, windows };
}

/**
 * Breaks the flat stucco the way apartment upper floors do: a base course,
 * a sill belt, a header, pilasters, and a cornice. The existing windows
 * sit in that band.
 */
function drawMotelFacade(
  ctx: CanvasRenderingContext2D,
  bld: BuildingFootprint,
  oSw: Point,
  oSe: Point,
  oNe: Point,
) {
  const pal = motelPalette(bld);
  const openings = motelStreetOpenings(bld);
  const street = openings?.face ?? null;
  const corniceAt = 1 - MOTEL_CORNICE_FRAC;

  for (const face of ["SW", "SE"] as const) {
    const side = face === "SE";
    const a = side ? oNe : oSw;
    const faceLen = side ? bld.h : bld.w;
    const isStreet = face === street;
    const doorStart = isStreet && openings ? openings.doorStart : -1;
    const doorEnd = isStreet && openings ? openings.doorEnd : -1;
    const lenPx = Math.hypot(oSe.x - a.x, oSe.y - a.y) || 1;
    const half = MOTEL_PIER_PX / 2 / lenPx;
    const pier = side ? pal.pierSide : pal.pier;
    const pierEdge = side ? pal.pierEdgeSide : pal.pierEdge;

    const drawPier = (t: number) => {
      if (
        doorEnd > doorStart &&
        t > doorStart / faceLen + 0.004 &&
        t < doorEnd / faceLen - 0.004
      ) {
        return;
      }
      drawWallPier(
        ctx, a, oSe, t, MOTEL_PIER_PX,
        MOTEL_PLINTH_FRAC, corniceAt,
        pier, pierEdge,
      );
    };
    drawPier(half);
    drawPier(1 - half);
    for (let i = 2; i < faceLen; i += 2) drawPier(i / faceLen);
  }

  fillFacadeBand(ctx, oSw, oSe, oNe, 0, MOTEL_PLINTH_FRAC, 0, pal.band, pal.bandSide);
  fillFacadeBand(
    ctx, oSw, oSe, oNe,
    MOTEL_PLINTH_FRAC, MOTEL_PLINTH_FRAC + 0.018,
    0, pal.coping, pal.copingSide,
  );
  fillFacadeBand(ctx, oSw, oSe, oNe, MOTEL_BELT[0], MOTEL_BELT[1], 0, pal.trim, pal.trimSide);
  fillFacadeBand(ctx, oSw, oSe, oNe, MOTEL_BELT_LIP[0], MOTEL_BELT_LIP[1], 0, pal.coping, pal.copingSide);
  fillFacadeBand(ctx, oSw, oSe, oNe, MOTEL_HEAD[0], MOTEL_HEAD[1], 0, pal.trim, pal.trimSide);
  fillFacadeBand(ctx, oSw, oSe, oNe, MOTEL_HEAD_LIP[0], MOTEL_HEAD_LIP[1], 0, pal.coping, pal.copingSide);
  fillFacadeBand(ctx, oSw, oSe, oNe, corniceAt, 1, 0, pal.pier, pal.pierSide);
  fillFacadeBand(
    ctx, oSw, oSe, oNe,
    corniceAt, corniceAt + 0.028,
    0, pal.band, pal.bandSide,
  );
  fillFacadeBand(ctx, oSw, oSe, oNe, 0.968, 1, 0, pal.coping, pal.copingSide);
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
  const pal = motelPalette(bld);

  fillPoly(
    ctx,
    [
      oSw,
      oSe,
      { x: oSe.x, y: oSe.y - d },
      { x: oSw.x, y: oSw.y - d },
    ],
    pal.wall,
  );
  fillPoly(
    ctx,
    [
      oNe,
      oSe,
      { x: oSe.x, y: oSe.y - d },
      { x: oNe.x, y: oNe.y - d },
    ],
    pal.wallSide,
  );

  drawMotelFacade(ctx, bld, oSw, oSe, oNe);
  drawMotelWindowsAndDoors(ctx, scene, bld, offset, d);
  paintStandardWallWear(ctx, oSw, oSe, oNe, d, bld);
  drawMotelOfficeAwning(ctx, bld, offset);
  fillMotelRoof(ctx, oNw, oNe, oSe, oSw, d, bld);
}

/** Striped canvas awning sloping out from the wall above the office door. */
function drawMotelOfficeAwning(
  ctx: CanvasRenderingContext2D,
  bld: BuildingFootprint,
  offset: (p: Point) => Point,
) {
  const street = motelStreetFace(bld, offset);
  const edge = entranceWallEdge(bld, offset);
  if (!street || !edge) return;
  const side = street.face === "SE";
  const dx = edge.bottomRight.x - edge.bottomLeft.x;
  const dy = edge.bottomRight.y - edge.bottomLeft.y;
  const len = Math.hypot(dx, dy) || 1;
  const dir = { x: dx / len, y: dy / len };
  const over = (MOTEL_AWNING_OVERHANG_TILES * len) / Math.max(1, buildingEntranceSpan(bld));
  const rise = WALL_DEPTH * MOTEL_AWNING_TOP_FRAC;
  const wallA = {
    x: edge.bottomLeft.x - dir.x * over,
    y: edge.bottomLeft.y - dir.y * over - rise,
  };
  const wallB = {
    x: edge.bottomRight.x + dir.x * over,
    y: edge.bottomRight.y + dir.y * over - rise,
  };
  const push = (p: Point): Point => ({
    x: p.x + street.out.x * MOTEL_AWNING_PROJECT_PX,
    y: p.y + street.out.y * MOTEL_AWNING_PROJECT_PX + MOTEL_AWNING_DROP_PX,
  });
  const lipA = push(wallA);
  const lipB = push(wallB);
  const stripeA = side ? MOTEL_AWNING_A_SIDE : MOTEL_AWNING_A;
  const stripeB = side ? MOTEL_AWNING_B_SIDE : MOTEL_AWNING_B;
  for (let i = 0; i < MOTEL_AWNING_STRIPES; i++) {
    const t0 = i / MOTEL_AWNING_STRIPES;
    const t1 = (i + 1) / MOTEL_AWNING_STRIPES;
    const color = i % 2 === 0 ? stripeA : stripeB;
    fillPoly(
      ctx,
      [
        lerpPoint(wallA, wallB, t0),
        lerpPoint(wallA, wallB, t1),
        lerpPoint(lipA, lipB, t1),
        lerpPoint(lipA, lipB, t0),
      ],
      color,
    );
    fillPoly(
      ctx,
      [
        lerpPoint(lipA, lipB, t0),
        lerpPoint(lipA, lipB, t1),
        raisePoint(lerpPoint(lipA, lipB, t1), -MOTEL_AWNING_VALANCE_PX),
        raisePoint(lerpPoint(lipA, lipB, t0), -MOTEL_AWNING_VALANCE_PX),
      ],
      shadeHex(color, 0.82),
    );
  }
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
  const openings = motelStreetOpenings(bld);
  const windows = openings?.windows ?? [];
  const side = face === "SE";
  const forced =
    windows[Math.floor(apartmentRoll(bld, 0xac11) * windows.length)] ?? -1;

  for (const i of windows) {
    const tx = face === "SE" ? ox + w - 1 : ox + i;
    const ty = face === "SE" ? oy + i : oy + h - 1;
    const tileEdge = wallTileEdge(face, tx, ty, bld, offset);
    if (!tileEdge) continue;
    drawWindowOnWallTile(
      ctx,
      window,
      tileEdge.bottomLeft,
      tileEdge.bottomRight,
      0,
      side,
      0.32,
    );
    if (
      i === forced ||
      apartmentRoll(bld, 0x5a11 + i * 9 + (side ? 1 : 0)) < MOTEL_AC_CHANCE
    ) {
      drawApartmentAcUnit(
        ctx,
        tileEdge.bottomLeft,
        tileEdge.bottomRight,
        0,
        side,
        MOTEL_AC_TOP,
      );
    }
  }
}

function dinerEntranceFace(bld: BuildingFootprint): "SE" | "SW" | null {
  if (bld.entranceX == null || bld.entranceY == null) return null;
  return buildingEntranceFace({
    ox: bld.ox,
    oy: bld.oy,
    w: bld.w,
    h: bld.h,
    entranceX: bld.entranceX,
    entranceY: bld.entranceY,
  });
}

/** 2-tile picture windows, skipping the door and one tile at each corner. */
function dinerWindowSlots(
  faceLen: number,
  doorStart: number,
  doorEnd: number,
): number[] {
  const span = 2;
  const corner = 1;
  const slots: number[] = [];
  if (faceLen < corner * 2 + span) return slots;
  let i = corner;
  const limit = faceLen - corner;
  while (i + span <= limit) {
    const overlaps = doorEnd > doorStart && i < doorEnd && i + span > doorStart;
    if (overlaps) {
      i = Math.max(i + 1, doorEnd);
      continue;
    }
    slots.push(i);
    i += span;
  }
  return slots;
}

/** Sign span along a façade (0..1), centred on the door and kept off the corners. */
function facadeSignSpan(
  faceLen: number,
  doorT: number,
  tiles: number,
): { t0: number; t1: number } | null {
  if (faceLen < 4) return null;
  const margin = FACADE_SIGN_MARGIN_TILES / faceLen;
  const width = Math.min(tiles, faceLen - FACADE_SIGN_MARGIN_TILES * 2) / faceLen;
  const half = width / 2;
  let t0 = doorT - half;
  let t1 = doorT + half;
  if (t0 < margin) {
    t0 = margin;
    t1 = t0 + width;
  }
  if (t1 > 1 - margin) {
    t1 = 1 - margin;
    t0 = t1 - width;
  }
  if (t0 < margin) t0 = margin;
  return { t0, t1 };
}

type FacadeQuad = [Point, Point, Point, Point];

/** Lettering area on a street parapet face. Screen-left to screen-right: bl, br, tr, tl. */
function facadeTextArea(
  para: ReturnType<typeof motelStreetParapet>,
  t0: number,
  t1: number,
  height: number,
): FacadeQuad {
  const a = para.front[0]!;
  const b = para.front[1]!;
  let p0 = lerpPoint(a, b, t0);
  let p1 = lerpPoint(a, b, t1);
  if (p1.x < p0.x || (p1.x === p0.x && p1.y < p0.y)) [p0, p1] = [p1, p0];
  return [p0, p1, raisePoint(p1, height), raisePoint(p0, height)];
}

type DinerRoofParts = {
  fasciaSw: [Point, Point, Point, Point];
  fasciaSe: [Point, Point, Point, Point];
  deck: [Point, Point, Point, Point];
  parapet: ReturnType<typeof motelStreetParapet> | null;
  sign: { front: FacadeQuad } | null;
  face: "SE" | "SW" | null;
};

function dinerRoofParts(
  nw: Point,
  ne: Point,
  se: Point,
  sw: Point,
  depth: number,
  bld: BuildingFootprint,
): DinerRoofParts {
  const wallDeck: [Point, Point, Point, Point] = [
    { x: nw.x, y: nw.y - depth },
    { x: ne.x, y: ne.y - depth },
    { x: se.x, y: se.y - depth },
    { x: sw.x, y: sw.y - depth },
  ];
  const deck = motelFlatDeck(nw, ne, se, sw, depth);
  const fasciaSw: [Point, Point, Point, Point] = [
    wallDeck[3]!,
    wallDeck[2]!,
    deck[2]!,
    deck[3]!,
  ];
  const fasciaSe: [Point, Point, Point, Point] = [
    wallDeck[1]!,
    wallDeck[2]!,
    deck[2]!,
    deck[1]!,
  ];
  const face = dinerEntranceFace(bld);
  if (!face || bld.entranceX == null || bld.entranceY == null) {
    return { fasciaSw, fasciaSe, deck, parapet: null, sign: null, face };
  }
  const parapet = motelStreetParapet(deck, face, DINER_PARAPET_HEIGHT);
  const faceLen = Math.max(1, face === "SE" ? bld.h : bld.w);
  const doorStart = face === "SE" ? bld.entranceY - bld.oy : bld.entranceX - bld.ox;
  const doorT = (doorStart + buildingEntranceSpan(bld) * 0.5) / faceLen;
  const span = facadeSignSpan(faceLen, doorT, DINER_SIGN_TILES);
  return {
    fasciaSw,
    fasciaSe,
    deck,
    parapet,
    sign: span
      ? { front: facadeTextArea(parapet, span.t0, span.t1, DINER_PARAPET_HEIGHT) }
      : null,
    face,
  };
}

function dinerRoofPoints(parts: DinerRoofParts): Point[] {
  const pts: Point[] = [...parts.fasciaSw, ...parts.fasciaSe, ...parts.deck];
  if (parts.parapet) {
    pts.push(
      parts.parapet.topA,
      parts.parapet.topB,
      ...parts.parapet.cap,
      ...parts.parapet.front,
    );
  }
  return pts;
}

function paintDinerCrown(
  parts: DinerRoofParts,
  paint: (pts: Point[], color: string) => void,
) {
  const face = parts.face;
  if (!parts.parapet || !face) return;
  const side = face === "SE";
  paint(parts.parapet.returnA, DINER_PARAPET_CAP_SIDE);
  paint(parts.parapet.returnB, DINER_PARAPET_CAP_SIDE);
  paint(parts.parapet.front, side ? DINER_PARAPET_FACE_SIDE : DINER_PARAPET_FACE);
  paint(parts.parapet.cap, side ? DINER_PARAPET_CAP_SIDE : DINER_PARAPET_CAP);
}

/**
 * Block lettering painted onto a façade quad. Letters follow the wall slope.
 * `shadow` adds a 1px drop shadow so the letters read as raised.
 */
function drawFacadeWord(
  ctx: CanvasRenderingContext2D,
  front: readonly [Point, Point, Point, Point],
  word: string,
  color: string,
  padPx: number,
  shadow?: string,
) {
  if (shadow) {
    ctx.save();
    ctx.translate(1, 1);
    drawFacadeWord(ctx, front, word, shadow, padPx);
    ctx.restore();
  }
  const glyphs = [...word].map((ch) => FACADE_GLYPHS[ch]).filter((g) => !!g);
  const glyph = glyphs[0];
  if (!glyph) return;
  const [bl, br, tr, tl] = front;
  const rows = glyph.length;
  const glyphW = glyph[0]?.length ?? 0;
  if (rows < 1 || glyphW < 1) return;
  const gap = 1;
  const totalCols = glyphs.length * glyphW + (glyphs.length - 1) * gap;
  const lenPx = Math.hypot(br.x - bl.x, br.y - bl.y) || 1;
  const heightPx = Math.abs(bl.y - tl.y) || 1;
  const padV = Math.min(0.3, padPx / heightPx);
  const rowH = (1 - padV * 2) / rows;
  // Keep letter cells close to square so the word is not stretched along the slope.
  const colW = Math.min(
    (1 - (padPx * 2) / lenPx) / totalCols,
    (rowH * heightPx * 1.35) / lenPx,
  );
  const padU = (1 - colW * totalCols) / 2;
  const at = (u: number, v: number) => {
    const low = lerpPoint(bl, br, u);
    const high = lerpPoint(tl, tr, u);
    return lerpPoint(low, high, v);
  };
  // One path per word so touching cells merge into solid strokes without seams.
  ctx.fillStyle = color;
  ctx.beginPath();
  let col = 0;
  for (const rowBits of glyphs) {
    for (let r = 0; r < rows; r++) {
      const bits = rowBits[r] ?? "";
      let c = 0;
      while (c < bits.length) {
        if (bits[c] !== "1") {
          c++;
          continue;
        }
        const start = c;
        while (c < bits.length && bits[c] === "1") c++;
        const u0 = padU + (col + start) * colW;
        const u1 = padU + (col + c) * colW;
        const vTop = 1 - padV - r * rowH;
        const vBot = vTop - rowH;
        const quad = [at(u0, vBot), at(u1, vBot), at(u1, vTop), at(u0, vTop)];
        ctx.moveTo(quad[0]!.x, quad[0]!.y);
        for (let i = 1; i < 4; i++) ctx.lineTo(quad[i]!.x, quad[i]!.y);
        ctx.closePath();
      }
    }
    col += glyphW + gap;
  }
  ctx.fill("nonzero");
}

function drawDinerCheckers(
  ctx: CanvasRenderingContext2D,
  bottomLeft: Point,
  bottomRight: Point,
  tiles: number,
  side: boolean,
) {
  const squares = Math.max(4, tiles * DINER_CHECK_PER_TILE);
  const bot = 1 - DINER_CHECK_FRAC;
  const mid = bot + DINER_CHECK_FRAC / 2;
  const red = side ? DINER_RED_SIDE : DINER_RED;
  const light = side ? DINER_CHECK_LIGHT_SIDE : DINER_CHECK_LIGHT;
  const paintRow = (v0: number, v1: number, phase: number) => {
    for (let i = 0; i < squares; i++) {
      fillWallBand(
        ctx,
        lerpPoint(bottomLeft, bottomRight, i / squares),
        lerpPoint(bottomLeft, bottomRight, (i + 1) / squares),
        v0,
        v1,
        0,
        (i + phase) % 2 === 0 ? red : light,
      );
    }
  };
  paintRow(mid, 1, 0);
  paintRow(bot, mid, 1);
}

function drawDinerWindowsAndDoor(
  ctx: CanvasRenderingContext2D,
  scene: Phaser.Scene,
  bld: BuildingFootprint,
  offset: (p: Point) => Point,
  wallDepth: number,
) {
  const face = dinerEntranceFace(bld);
  if (!face || bld.entranceX == null || bld.entranceY == null) return;
  const { ox, oy, w, h } = bld;
  const doorSpan = buildingEntranceSpan(bld);
  const doorStart = face === "SE" ? bld.entranceY - oy : bld.entranceX - ox;
  const doorEnd = doorStart + doorSpan;

  for (const wall of ["SW", "SE"] as const) {
    const art = resolveBigWindow1Source(scene, wall);
    if (!art) continue;
    const faceLen = wall === "SE" ? h : w;
    const origin = wall === "SE" ? oy : ox;
    const onDoor = wall === face;
    const slots = dinerWindowSlots(
      faceLen,
      onDoor ? doorStart : 0,
      onDoor ? doorEnd : 0,
    );
    for (const i of slots) {
      const edge = facadeSpanEdge(bld, wall, origin + i, 2, offset);
      if (!edge) continue;
      drawSuperWindowOnWallFace(
        ctx,
        art,
        edge.bottomLeft,
        edge.bottomRight,
        wallDepth,
        wall === "SE",
        DINER_WINDOW_FRAC,
        0,
        false,
      );
    }
  }

  const door = resolveDoorSource(scene, bld);
  const edge = door ? entranceWallEdge(bld, offset) : null;
  if (door && edge) {
    drawDoorOnEntranceFace(
      ctx,
      door,
      edge.bottomLeft,
      edge.bottomRight,
      wallDepth,
      face === "SE",
      0.8,
    );
  }
}

/** Standing seams running from the back of the deck toward the street. */
function drawDinerRoofSeams(
  ctx: CanvasRenderingContext2D,
  parts: DinerRoofParts,
  bld: BuildingFootprint,
) {
  const [dNw, dNe, dSe, dSw] = parts.deck;
  const alongSe = parts.face === "SE";
  const frontage = alongSe ? bld.h : bld.w;
  const seams = Math.max(3, Math.round(frontage * DINER_ROOF_SEAMS_PER_TILE));
  ctx.save();
  ctx.lineWidth = 1;
  for (let i = 1; i < seams; i++) {
    const t = i / seams;
    const a = alongSe ? lerpPoint(dNw, dSw, t) : lerpPoint(dNw, dNe, t);
    const b = alongSe ? lerpPoint(dNe, dSe, t) : lerpPoint(dSw, dSe, t);
    ctx.strokeStyle = shadeHex(DINER_ROOF_DECK, 0.78);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.strokeStyle = shadeHex(DINER_ROOF_DECK, 1.25);
    ctx.beginPath();
    ctx.moveTo(a.x + 1, a.y);
    ctx.lineTo(b.x + 1, b.y);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Kitchen exhaust hood and a packaged HVAC unit along the back of the deck,
 * clear of the street parapet and sign. Side swaps per variant.
 */
function drawDinerRoofProps(
  ctx: CanvasRenderingContext2D,
  nw: Point,
  ne: Point,
  se: Point,
  sw: Point,
  depth: number,
  bld: BuildingFootprint,
  face: "SE" | "SW" | null,
) {
  let h = Math.imul(variantSeedOf(bld) + 7, 73856093) >>> 0;
  h ^= h >>> 15;
  const flip = (h & 1) === 1;
  const frontage = Math.max(1, face === "SE" ? bld.h : bld.w);
  const deep = Math.max(1, face === "SE" ? bld.w : bld.h);
  // `a` runs along the street frontage, `b` from the back wall toward the street.
  type Box = { a0: number; a1: number; b0: number; b1: number; h: number; top: string };
  /** Footprint in tiles: centre along the frontage (fraction), size, and distance from the back wall. */
  const box = (
    centre: number,
    sizeA: number,
    backTiles: number,
    sizeB: number,
    height: number,
    top: string,
  ): Box => {
    const c = flip ? 1 - centre : centre;
    const half = sizeA / frontage / 2;
    return {
      a0: c - half,
      a1: c + half,
      b0: backTiles / deep,
      b1: (backTiles + sizeB) / deep,
      h: height,
      top,
    };
  };
  const props: Box[][] = [
    [
      box(0.7, 0.9, 0.35, 0.9, 5, DINER_HOOD_TOP),
      box(0.7, 0.42, 0.59, 0.42, 12, DINER_HVAC_TOP),
    ],
    [box(0.24, 1.1, 0.3, 0.8, 10, DINER_HVAC_TOP)],
  ];
  const toUv = (box: Box) =>
    face === "SE"
      ? { u0: box.b0, u1: box.b1, v0: box.a0, v1: box.a1 }
      : { u0: box.a0, u1: box.a1, v0: box.b0, v1: box.b1 };
  const order = (group: Box[]) => {
    const uv = toUv(group[0]!);
    return uv.u0 + uv.u1 + uv.v0 + uv.v1;
  };
  props.sort((p, q) => order(p) - order(q));
  for (const group of props) {
    for (const box of group) {
      const { u0, u1, v0, v1 } = toUv(box);
      drawRoofPropBox(
        ctx, nw, ne, se, sw, depth,
        u0, v0, u1, v1,
        box.h,
        box.top,
        DINER_HVAC_SIDE,
        DINER_HVAC_FRONT,
      );
    }
  }
}

function fillDinerRoof(
  ctx: CanvasRenderingContext2D,
  nw: Point,
  ne: Point,
  se: Point,
  sw: Point,
  depth: number,
  bld: BuildingFootprint,
) {
  const parts = dinerRoofParts(nw, ne, se, sw, depth, bld);
  const fascia = shadeHex(DINER_ROOF_DECK, 0.55);
  fillPoly(ctx, parts.fasciaSw, fascia);
  fillPoly(ctx, parts.fasciaSe, fascia);
  fillPoly(ctx, parts.deck, shadeHex(DINER_ROOF_DECK, 1.05));
  drawDinerRoofSeams(ctx, parts, bld);
  paintRoofDecals(ctx, [parts.deck], roofWearKey(bld, "flat"), "diner");
  drawDinerRoofProps(ctx, nw, ne, se, sw, depth, bld, parts.face);
  paintDinerCrown(parts, (pts, color) => fillPoly(ctx, pts, color));
  if (parts.sign) {
    drawFacadeWord(
      ctx,
      parts.sign.front,
      "DINER",
      parts.face === "SE" ? DINER_RED_SIDE : DINER_RED,
      DINER_SIGN_TEXT_PAD_PX,
    );
  }
}

function paintDinerBuilding(
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
    [oSw, oSe, { x: oSe.x, y: oSe.y - d }, { x: oSw.x, y: oSw.y - d }],
    DINER_WALL_FRONT,
  );
  fillPoly(
    ctx,
    [oNe, oSe, { x: oSe.x, y: oSe.y - d }, { x: oNe.x, y: oNe.y - d }],
    DINER_WALL_SIDE,
  );
  drawVerticalCornerCladding(ctx, oSw, oSe, oNe, d, DINER_METAL, DINER_METAL_SIDE);
  fillWallBand(ctx, oSw, oSe, 0, 0.12, 0, DINER_KICK);
  fillWallBand(ctx, oNe, oSe, 0, 0.12, 0, DINER_KICK_SIDE);
  fillWallBand(ctx, oSw, oSe, 0.12, 0.15, 0, DINER_METAL);
  fillWallBand(ctx, oNe, oSe, 0.12, 0.15, 0, DINER_METAL_SIDE);
  fillWallBand(ctx, oSw, oSe, 0.15, 0.18, 0, DINER_RED);
  fillWallBand(ctx, oNe, oSe, 0.15, 0.18, 0, DINER_RED_SIDE);
  fillWallBand(ctx, oSw, oSe, 0.82, 0.84, 0, DINER_METAL);
  fillWallBand(ctx, oNe, oSe, 0.82, 0.84, 0, DINER_METAL_SIDE);

  drawDinerWindowsAndDoor(ctx, scene, bld, offset, d);
  drawDinerCheckers(ctx, oSw, oSe, bld.w, false);
  drawDinerCheckers(ctx, oNe, oSe, bld.h, true);
  paintStandardWallWear(ctx, oSw, oSe, oNe, d, bld);
  fillDinerRoof(ctx, oNw, oNe, oSe, oSw, d, bld);
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

/** Palette slot for this variant. Seeds can be negative, so wrap into 0..len-1. */
function variantPaletteIndex(bld: BuildingFootprint, len: number): number {
  const i = Math.trunc(variantSeedOf(bld)) % len;
  return Number.isFinite(i) ? (i + len) % len : 0;
}

/** House wall art, chosen from the bucketed variant rather than world position. */
function wallKeyForBake(bld: BuildingFootprint): BuildingWallKey {
  if (!isHouseStyleBuilding(bld) && bld.buildingType !== "apartment") {
    return wallTextureKeyForBuilding(bld);
  }
  return BUILDING_WALL_HOUSE_KEYS[variantPaletteIndex(bld, BUILDING_WALL_HOUSE_KEYS.length)]!;
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
  const isDiner = bld.buildingType === "diner";
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
        ? MOTEL_PARAPET_HEIGHT
        : isDiner
          ? DINER_PARAPET_HEIGHT
        : bld.buildingType === "police_station" ||
            bld.buildingType === "apartment" ||
            bld.buildingType === "gun_shop"
          ? POLICE_ROOF_LIP_HEIGHT + POLICE_ROOF_PROP_HEIGHT
          : bld.buildingType === "supermarket"
            ? POLICE_ROOF_LIP_HEIGHT + SUPERMARKET_ROOF_PROP_HEIGHT
            : bld.buildingType === "large_retail"
              ? POLICE_ROOF_LIP_HEIGHT + Math.round(SUPERMARKET_ROOF_PROP_HEIGHT * 0.75)
              : bld.buildingType === "office"
                ? POLICE_ROOF_LIP_HEIGHT +
                  ((bld.exteriorLevels ?? 1) >= 2 ? POLICE_ROOF_PROP_HEIGHT : 0)
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

  if (isMotel) {
    const deck = motelFlatDeck(nw, ne, se, sw, d);
    points.push(...deck);
    const board = motelSignBoard(bld, deck);
    if (board) points.push(...board.front, ...board.cap, ...board.end);
  }

  if (isDiner) {
    points.push(...dinerRoofPoints(dinerRoofParts(nw, ne, se, sw, d, bld)));
  }

  if (isHouse || isWarehouse || isTent || isMessHall) {
    const wallDeck: [Point, Point, Point, Point] = [
      { x: nw.x, y: nw.y - d },
      { x: ne.x, y: ne.y - d },
      { x: se.x, y: se.y - d },
      { x: sw.x, y: sw.y - d },
    ];
    const deck = (
      isHouse
        ? outsetRoofQuad(wallDeck, HOUSE_ROOF_OVERHANG)
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
      : isMessHall
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

  // Awnings, canopies, steps, docks, and tent pegs project out from the wall.
  const pad = isMotel ? 1 + MOTEL_AWNING_PROJECT_PX : 1 + entranceProjectionPx(bld);
  minX = Math.floor(minX) - pad;
  minY = Math.floor(minY) - pad;
  maxX = Math.ceil(maxX) + pad;
  maxY = Math.ceil(maxY) + pad;

  return { minX, minY, maxX, maxY, d, nw, ne, se, sw };
}

function facadeSpanEdge(
  bld: BuildingFootprint,
  face: "SE" | "SW",
  along: number,
  span: number,
  offset: (p: Point) => Point,
): { bottomLeft: Point; bottomRight: Point } | null {
  const { ox, oy, w, h } = bld;
  if (span < 1) return null;
  if (face === "SE") {
    if (along < oy || along + span > oy + h) return null;
    return {
      bottomLeft: offset(cartesianToIso(ox + w, along)),
      bottomRight: offset(cartesianToIso(ox + w, along + span)),
    };
  }
  if (along < ox || along + span > ox + w) return null;
  return {
    bottomLeft: offset(cartesianToIso(along, oy + h)),
    bottomRight: offset(cartesianToIso(along + span, oy + h)),
  };
}

/** Rectangle on one wall face, fractions of a storey up from that storey's floor. */
function fillWallBand(
  ctx: CanvasRenderingContext2D,
  bottomLeft: Point,
  bottomRight: Point,
  bottomFrac: number,
  topFrac: number,
  storeyIndex: number,
  color: string,
) {
  const yAt = (p: Point, frac: number): Point => ({
    x: p.x,
    y: p.y - storeyIndex * WALL_DEPTH - WALL_DEPTH * frac,
  });
  fillPoly(
    ctx,
    [
      yAt(bottomLeft, bottomFrac),
      yAt(bottomRight, bottomFrac),
      yAt(bottomRight, topFrac),
      yAt(bottomLeft, topFrac),
    ],
    color,
  );
}

/** Colored strip under the roof line. Height is a fraction of one storey. */
function fillWallCap(
  ctx: CanvasRenderingContext2D,
  bottomLeft: Point,
  bottomRight: Point,
  depth: number,
  capFrac: number,
  color: string,
) {
  const cap = WALL_DEPTH * capFrac;
  fillPoly(
    ctx,
    [
      { x: bottomLeft.x, y: bottomLeft.y - depth },
      { x: bottomRight.x, y: bottomRight.y - depth },
      { x: bottomRight.x, y: bottomRight.y - depth + cap },
      { x: bottomLeft.x, y: bottomLeft.y - depth + cap },
    ],
    color,
  );
}

function drawGlassPanel(
  ctx: CanvasRenderingContext2D,
  bottomLeft: Point,
  bottomRight: Point,
  bottomFrac: number,
  topFrac: number,
  storeyIndex: number,
  frame: string,
  glass: string,
  mullion: string,
  split: boolean,
  rail: boolean,
  /**
   * Inner reveal on the glass. `start` is the bottomLeft end of the wall
   * edge: screen-left on a SW face, screen-right on an SE face.
   */
  reveal: "start" | "end" | null = null,
) {
  fillWallBand(ctx, bottomLeft, bottomRight, bottomFrac, topFrac, storeyIndex, frame);
  const bl = lerpPoint(bottomLeft, bottomRight, 0.08);
  const br = lerpPoint(bottomLeft, bottomRight, 0.92);
  const glassBottom = bottomFrac + 0.025;
  const glassTop = topFrac - 0.02;
  if (glassTop <= glassBottom) return;
  fillWallBand(ctx, bl, br, glassBottom, glassTop, storeyIndex, glass);
  if (reveal) {
    const jambEnd = Math.min(0.92, 0.08 + OFFICE_GLASS_JAMB);
    const sideA = lerpPoint(
      bottomLeft,
      bottomRight,
      reveal === "start" ? 0.08 : 1 - jambEnd,
    );
    const sideB = lerpPoint(
      bottomLeft,
      bottomRight,
      reveal === "start" ? jambEnd : 0.92,
    );
    fillWallBand(ctx, sideA, sideB, glassBottom, glassTop, storeyIndex, OFFICE_GLASS_DEPTH);
    const sillTop = Math.min(glassTop, glassBottom + OFFICE_GLASS_SILL);
    fillWallBand(ctx, bl, br, glassBottom, sillTop, storeyIndex, OFFICE_GLASS_DEPTH);
  }
  if (split) {
    const ml = lerpPoint(bottomLeft, bottomRight, 0.46);
    const mr = lerpPoint(bottomLeft, bottomRight, 0.54);
    fillWallBand(ctx, ml, mr, glassBottom, glassTop, storeyIndex, mullion);
  }
  if (rail) {
    const mid = (glassBottom + glassTop) / 2;
    fillWallBand(ctx, bl, br, mid - 0.012, mid + 0.012, storeyIndex, mullion);
  }
}

function retailEntrance(
  bld: BuildingFootprint,
): ReturnType<typeof buildingEntranceRun> | null {
  if (bld.entranceX == null || bld.entranceY == null) return null;
  return buildingEntranceRun({
    ox: bld.ox,
    oy: bld.oy,
    w: bld.w,
    h: bld.h,
    entranceX: bld.entranceX,
    entranceY: bld.entranceY,
    entranceSpan: bld.entranceSpan,
    buildingType: bld.buildingType,
  });
}

/**
 * Department store: granite base, pilastered bays, display windows along the
 * street front, recessed blind panels on the side wall, a deep fascia, and a
 * flat canopy over the doors. Display panes run up to the fascia underside.
 */
function drawRetailFacade(
  ctx: CanvasRenderingContext2D,
  scene: Phaser.Scene,
  bld: BuildingFootprint,
  offset: (p: Point) => Point,
  depth: number,
  oSw: Point,
  oSe: Point,
  oNe: Point,
) {
  const top = 1 - RETAIL_FASCIA_FRAC;
  fillWallBand(ctx, oSw, oSe, 0, RETAIL_PLINTH_FRAC, 0, RETAIL_PLINTH);
  fillWallBand(ctx, oNe, oSe, 0, RETAIL_PLINTH_FRAC, 0, RETAIL_PLINTH_SIDE);

  const run = retailEntrance(bld);
  if (run) {
    const winSpan = 2;
    const drawWindow = (face: "SE" | "SW", along: number) => {
      const art = resolveBigWindow1Source(scene, face);
      const edge = facadeSpanEdge(bld, face, along, winSpan, offset);
      if (!art || !edge) return;
      drawSuperWindowOnWallFace(
        ctx,
        art,
        edge.bottomLeft,
        edge.bottomRight,
        depth,
        face === "SE",
        top,
        0,
        true,
      );
    };

    for (const face of ["SW", "SE"] as const) {
      const isStreet = face === run.face;
      const side = face === "SE";
      const faceLen = side ? bld.h : bld.w;
      const origin = side ? bld.oy : bld.ox;
      const wallA = side ? oNe : oSw;

      // Face-local [start, end) runs: glass and doors, plus blind panels.
      const windows: number[] = [];
      const panels: number[] = [];
      const bays: [number, number][] = [];
      if (isStreet) {
        const doorStart = (side ? run.y : run.x) - origin;
        const doorEnd = doorStart + run.span;
        bays.push([doorStart, doorEnd]);
        // One-tile piers beside the doors and between 2-tile display bays.
        for (let i = doorStart - 1 - winSpan; i >= 1; i -= winSpan + 1) windows.push(i);
        for (let i = doorEnd + 1; i + winSpan <= faceLen - 1; i += winSpan + 1) windows.push(i);
      } else {
        const win = Math.floor((faceLen - winSpan) / 2);
        windows.push(win);
        for (let i = win - 2; i >= 0; i -= 2) panels.push(i);
        for (let i = win + winSpan; i + 2 <= faceLen; i += 2) panels.push(i);
      }
      for (const i of windows) bays.push([i, i + winSpan]);
      for (const i of panels) bays.push([i, i + 2]);

      const lenPx = Math.hypot(oSe.x - wallA.x, oSe.y - wallA.y) || 1;
      const at = (t: number) => lerpPoint(wallA, oSe, t);
      const tile = 1 / Math.max(1, faceLen);

      for (const i of panels) {
        const t0 = (i + 0.3) * tile;
        const t1 = (i + 1.7) * tile;
        const ti = t0 + 2 / lenPx;
        fillWallBand(ctx, at(t0), at(t1), 0.2, 0.72, 0, side ? RETAIL_PANEL_SHADOW_SIDE : RETAIL_PANEL_SHADOW);
        fillWallBand(ctx, at(ti), at(t1), 0.2, 0.69, 0, side ? RETAIL_PANEL_SIDE : RETAIL_PANEL);
      }

      // Pilasters at the corners and on every bay boundary.
      const half = RETAIL_PILASTER_PX / 2 / lenPx;
      const pier = (t: number) => {
        const t0 = Math.max(0, t - half);
        const t1 = Math.min(1, t + half);
        fillWallBand(ctx, at(t0), at(t1), RETAIL_PLINTH_FRAC, top, 0, side ? RETAIL_PILASTER_SIDE : RETAIL_PILASTER);
        if (t1 < 1) {
          const te = Math.min(1, t1 + 1 / lenPx);
          fillWallBand(ctx, at(t1), at(te), RETAIL_PLINTH_FRAC, top, 0, side ? RETAIL_PILASTER_EDGE_SIDE : RETAIL_PILASTER_EDGE);
        }
      };
      pier(half);
      pier(1 - half);
      const marks = new Set<number>();
      for (const [s, e] of bays) {
        if (s > 0) marks.add(s);
        if (e < faceLen) marks.add(e);
      }
      for (const i of marks) pier(i * tile);

      // Window art goes over the pilasters, plinth and panels.
      for (const i of windows) drawWindow(face, origin + i);
    }
  }

  fillWallCap(ctx, oSw, oSe, depth, RETAIL_FASCIA_FRAC, RETAIL_FASCIA_FRONT);
  fillWallCap(ctx, oNe, oSe, depth, RETAIL_FASCIA_FRAC, RETAIL_FASCIA_SIDE);
  fillWallBand(ctx, oSw, oSe, top, top + 0.02, 0, RETAIL_FASCIA_SHADOW);
  fillWallBand(ctx, oNe, oSe, top, top + 0.02, 0, RETAIL_FASCIA_SHADOW_SIDE);
  fillWallBand(ctx, oSw, oSe, 0.97, 1, 0, RETAIL_COPING);
  fillWallBand(ctx, oNe, oSe, 0.97, 1, 0, RETAIL_COPING_SIDE);
}

type EntranceCanopyStyle = {
  /** Wall line of the canopy top, in storeys above the ground. */
  topFrac: number;
  projectPx: number;
  thickPx: number;
  /** Extra length past each side of the door run, in tiles. */
  overhangTiles: number;
  top: string;
  topSide: string;
  edge: string;
  /** Tie rods from the lip back up to the wall, this far above the canopy (px). */
  rodRisePx?: number;
  /** Posts from the lip corners down to the ground. */
  post?: string;
  postSide?: string;
  postPx?: number;
};

/** Flat canopy projecting from the entrance wall over the door run. */
function drawEntranceCanopy(
  ctx: CanvasRenderingContext2D,
  bld: BuildingFootprint,
  offset: (p: Point) => Point,
  style: EntranceCanopyStyle,
) {
  const street = motelStreetFace(bld, offset);
  const edge = entranceWallEdge(bld, offset);
  if (!street || !edge) return;
  const side = street.face === "SE";
  const dx = edge.bottomRight.x - edge.bottomLeft.x;
  const dy = edge.bottomRight.y - edge.bottomLeft.y;
  const len = Math.hypot(dx, dy) || 1;
  const dir = { x: dx / len, y: dy / len };
  const over = (style.overhangTiles * len) / Math.max(1, buildingEntranceSpan(bld));
  const rise = WALL_DEPTH * style.topFrac;
  const groundA = { x: edge.bottomLeft.x - dir.x * over, y: edge.bottomLeft.y - dir.y * over };
  const groundB = { x: edge.bottomRight.x + dir.x * over, y: edge.bottomRight.y + dir.y * over };
  const wallA = raisePoint(groundA, rise);
  const wallB = raisePoint(groundB, rise);
  const outDir = faceOutVector(street.face);
  const out = (p: Point): Point => ({
    x: p.x + outDir.x * style.projectPx,
    y: p.y + outDir.y * style.projectPx,
  });
  const lipA = out(wallA);
  const lipB = out(wallB);
  const down = (p: Point) => raisePoint(p, -style.thickPx);

  if (style.post) {
    const postSide = style.postSide ?? shadeHex(style.post, 0.85);
    const px = style.postPx ?? 3;
    const inset = Math.min(0.45, (px + 1) / Math.max(1, Math.hypot(lipB.x - lipA.x, lipB.y - lipA.y)));
    for (const t of [inset, 1 - inset]) {
      const head = down(lerpPoint(lipA, lipB, t));
      const foot = out(lerpPoint(groundA, groundB, t));
      const l = { x: foot.x - px / 2, y: foot.y };
      const r = { x: foot.x + px / 2, y: foot.y };
      fillPoly(ctx, [l, { x: foot.x, y: foot.y }, { x: head.x, y: head.y }, { x: l.x, y: head.y }], style.post);
      fillPoly(ctx, [{ x: foot.x, y: foot.y }, r, { x: r.x, y: head.y }, { x: head.x, y: head.y }], postSide);
    }
  }

  // The visible end face, then the top, then the front edge.
  const leftVisible = wallA.y > wallB.y;
  const endWall = leftVisible ? wallA : wallB;
  const endLip = leftVisible ? lipA : lipB;
  fillPoly(ctx, [endWall, endLip, down(endLip), down(endWall)], style.edge);
  fillPoly(ctx, [wallA, wallB, lipB, lipA], side ? style.topSide : style.top);
  fillPoly(ctx, [lipA, lipB, down(lipB), down(lipA)], style.edge);

  if (style.rodRisePx) {
    ctx.strokeStyle = style.edge;
    ctx.lineWidth = 1;
    for (const t of [0.12, 0.88]) {
      const lip = lerpPoint(lipA, lipB, t);
      const anchor = raisePoint(lerpPoint(wallA, wallB, t), style.rodRisePx);
      ctx.beginPath();
      ctx.moveTo(lip.x, lip.y);
      ctx.lineTo(anchor.x, anchor.y);
      ctx.stroke();
    }
  }
}

/** Flat metal canopy projecting from the wall just under the fascia, over the doors. */
function drawRetailCanopy(
  ctx: CanvasRenderingContext2D,
  bld: BuildingFootprint,
  offset: (p: Point) => Point,
) {
  drawEntranceCanopy(ctx, bld, offset, {
    topFrac: 1 - RETAIL_FASCIA_FRAC,
    projectPx: RETAIL_CANOPY_PROJECT_PX,
    thickPx: RETAIL_CANOPY_THICK_PX,
    overhangTiles: RETAIL_CANOPY_OVERHANG_TILES,
    top: RETAIL_CANOPY_TOP,
    topSide: RETAIL_CANOPY_TOP_SIDE,
    edge: RETAIL_CANOPY_EDGE,
    rodRisePx: WALL_DEPTH * RETAIL_FASCIA_FRAC * 0.6,
  });
}

/** Screen px each type's entrance canopy, step, or dock projects past the wall. */
function entranceProjectionPx(bld: BuildingFootprint): number {
  switch (bld.buildingType) {
    case "large_retail":
      return RETAIL_CANOPY_PROJECT_PX;
    case "police_station":
      return POLICE_CANOPY.projectPx;
    case "office":
      return OFFICE_CANOPY.projectPx;
    case "hospital":
      return HOSPITAL_CANOPY.projectPx;
    case "house":
      return houseHasHood(bld) ? HOUSE_HOOD.projectPx : 0;
    case "apartment":
      return Math.max(APARTMENT_CANOPY.projectPx, APARTMENT_BALCONY_PROJECT_PX);
    case "gun_shop":
      return GUN_SHOP_FIXTURE_PROJECT_PX;
    case "tent":
      return TENT_PEG_OUT_PX + 2;
    default:
      return 0;
  }
}

const POLICE_CANOPY: EntranceCanopyStyle = {
  topFrac: 0.86,
  projectPx: 10,
  thickPx: 3,
  overhangTiles: 0.3,
  top: POLICE_STONE_LIGHT,
  topSide: POLICE_STONE_LIGHT_SIDE,
  edge: POLICE_STONE_SHADOW,
  post: POLICE_STONE,
  postSide: POLICE_STONE_SIDE,
  postPx: 3,
};

const OFFICE_CANOPY: EntranceCanopyStyle = {
  topFrac: 0.8,
  projectPx: 6,
  thickPx: 2,
  overhangTiles: 0.15,
  top: "#7d838a",
  topSide: "#6c7279",
  edge: "#4f545a",
  rodRisePx: 8,
};

/** Drop-off canopy. It sits above the Door5 header so the art stays readable. */
const HOSPITAL_CANOPY: EntranceCanopyStyle = {
  topFrac: 1.14,
  projectPx: 14,
  thickPx: 3,
  overhangTiles: 0.5,
  top: "#e6e2da",
  topSide: "#d4cfc6",
  edge: "#a9a49b",
  post: "#d9d5cd",
  postSide: "#bdb8af",
  postPx: 3,
};

const APARTMENT_CANOPY: EntranceCanopyStyle = {
  topFrac: 0.8,
  projectPx: 9,
  thickPx: 2,
  overhangTiles: 0.25,
  top: "#7d838a",
  topSide: "#6c7279",
  edge: "#4f545a",
  post: "#5d6268",
  postSide: "#4b5056",
  postPx: 2,
};

const HOUSE_HOOD: EntranceCanopyStyle = {
  topFrac: 0.82,
  projectPx: 6,
  thickPx: 2,
  overhangTiles: 0.12,
  top: HOUSE_HOOD_TOP,
  topSide: HOUSE_HOOD_TOP_SIDE,
  edge: HOUSE_HOOD_EDGE,
  rodRisePx: 6,
};

/** Canopies and steps drawn over the door, per building type. */
function drawEntranceExtras(
  ctx: CanvasRenderingContext2D,
  bld: BuildingFootprint,
  offset: (p: Point) => Point,
) {
  switch (bld.buildingType) {
    case "large_retail":
      drawRetailCanopy(ctx, bld, offset);
      return;
    case "police_station":
      drawEntranceCanopy(ctx, bld, offset, POLICE_CANOPY);
      return;
    case "office":
      drawEntranceCanopy(ctx, bld, offset, OFFICE_CANOPY);
      return;
    case "house":
      if (houseHasHood(bld)) drawEntranceCanopy(ctx, bld, offset, HOUSE_HOOD);
      return;
    case "apartment":
      drawEntranceCanopy(ctx, bld, offset, APARTMENT_CANOPY);
      return;
    case "gun_shop":
      drawGunShopEntrance(ctx, bld, offset);
      return;
    default:
      return;
  }
}

/** Both visible faces get the same band; `front` on SW, `side` on SE. */
function fillFacadeBand(
  ctx: CanvasRenderingContext2D,
  oSw: Point,
  oSe: Point,
  oNe: Point,
  bottomFrac: number,
  topFrac: number,
  storeyIndex: number,
  front: string,
  side: string,
) {
  fillWallBand(ctx, oSw, oSe, bottomFrac, topFrac, storeyIndex, front);
  fillWallBand(ctx, oNe, oSe, bottomFrac, topFrac, storeyIndex, side);
}

/**
 * Vertical pier centred at `t` along the wall edge a→b, `px` wide, between two
 * storey fractions measured from the ground. A 1px darker edge on the far side
 * gives it depth.
 */
function drawWallPier(
  ctx: CanvasRenderingContext2D,
  a: Point,
  b: Point,
  t: number,
  px: number,
  bottomFrac: number,
  topFrac: number,
  color: string,
  edgeColor: string,
) {
  const lenPx = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const half = px / 2 / lenPx;
  const t0 = Math.max(0, t - half);
  const t1 = Math.min(1, t + half);
  fillWallBand(ctx, lerpPoint(a, b, t0), lerpPoint(a, b, t1), bottomFrac, topFrac, 0, color);
  if (t1 < 1) {
    const te = Math.min(1, t1 + 1 / lenPx);
    fillWallBand(ctx, lerpPoint(a, b, t1), lerpPoint(a, b, te), bottomFrac, topFrac, 0, edgeColor);
  }
}

/** Corner piers plus one at each listed tile boundary, on one wall edge. */
function drawWallPiers(
  ctx: CanvasRenderingContext2D,
  a: Point,
  b: Point,
  faceLen: number,
  boundaries: Iterable<number>,
  px: number,
  bottomFrac: number,
  topFrac: number,
  color: string,
  edgeColor: string,
) {
  const lenPx = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const half = px / 2 / lenPx;
  drawWallPier(ctx, a, b, half, px, bottomFrac, topFrac, color, edgeColor);
  drawWallPier(ctx, a, b, 1 - half, px, bottomFrac, topFrac, color, edgeColor);
  for (const i of boundaries) {
    if (i <= 0 || i >= faceLen) continue;
    drawWallPier(ctx, a, b, i / faceLen, px, bottomFrac, topFrac, color, edgeColor);
  }
}

/**
 * Warehouse wall detail: roller shutters with a raised loading dock on the
 * longer visible face (kept clear of the personnel door), and a row of high
 * clerestory windows under the eaves on both faces.
 */
function drawWarehouseDetail(
  ctx: CanvasRenderingContext2D,
  bld: BuildingFootprint,
  offset: (p: Point) => Point,
) {
  const { ox, oy, w, h } = bld;
  let doorFace: "SE" | "SW" | null = null;
  let doorStart = -99;
  const doorSpan = buildingEntranceSpan(bld);
  if (bld.entranceX != null && bld.entranceY != null) {
    doorFace = buildingEntranceFace({ ox, oy, w, h, entranceX: bld.entranceX, entranceY: bld.entranceY });
    doorStart = doorFace === "SE" ? bld.entranceY - oy : bld.entranceX - ox;
  }
  const shutterFace: "SE" | "SW" = h > w ? "SE" : "SW";
  const tileEdge = (face: "SE" | "SW", i: number, span: number) =>
    facadeSpanEdge(bld, face, (face === "SE" ? oy : ox) + i, span, offset);

  // Shutter tiles per face, so the clerestory row can skip over them.
  const shutterTiles = new Set<number>();
  const shutterLen = shutterFace === "SE" ? h : w;
  const shutters: number[] = [];
  const span = WAREHOUSE_SHUTTER_TILES;
  for (let s = shutterLen - 1 - span; s >= 1 && shutters.length < 2; s -= span + 1) {
    if (shutterFace === doorFace && s < doorStart + doorSpan + 1 && s + span > doorStart - 1) continue;
    shutters.push(s);
    for (let k = 0; k < span; k++) shutterTiles.add(k + s);
  }

  for (const face of ["SW", "SE"] as const) {
    const faceLen = face === "SE" ? h : w;
    const side = face === "SE";
    for (let i = 1; i < faceLen - 1; i += 2) {
      if (face === shutterFace && shutterTiles.has(i)) continue;
      const edge = tileEdge(face, i, 1);
      if (!edge) continue;
      drawGlassPanel(
        ctx,
        edge.bottomLeft,
        edge.bottomRight,
        WAREHOUSE_CLERESTORY_BOTTOM,
        WAREHOUSE_CLERESTORY_TOP,
        0,
        side ? WAREHOUSE_TRIM_SIDE : WAREHOUSE_TRIM,
        side ? WAREHOUSE_CLERESTORY_GLASS_SIDE : WAREHOUSE_CLERESTORY_GLASS,
        WAREHOUSE_TRIM,
        true,
        false,
      );
    }
  }

  const side = shutterFace === "SE";
  for (const s of shutters) {
    const edge = tileEdge(shutterFace, s, span);
    if (!edge) continue;
    const at = (t: number) => lerpPoint(edge.bottomLeft, edge.bottomRight, t);
    const frame = side ? WAREHOUSE_TRIM_SIDE : WAREHOUSE_TRIM;
    fillWallBand(ctx, at(0.02), at(0.98), 0, WAREHOUSE_SHUTTER_TOP, 0, frame);
    fillWallBand(ctx, at(0.05), at(0.95), 0, WAREHOUSE_SHUTTER_TOP, 0, side ? WAREHOUSE_SHUTTER_SIDE : WAREHOUSE_SHUTTER);
    const slat = side ? WAREHOUSE_SHUTTER_SLAT_SIDE : WAREHOUSE_SHUTTER_SLAT;
    for (let f = 0.05; f < WAREHOUSE_SHUTTER_TOP - 0.02; f += 0.045) {
      fillWallBand(ctx, at(0.05), at(0.95), f, f + 0.008, 0, slat);
    }
    // Roll housing between the opening and the eaves.
    fillWallBand(ctx, at(0), at(1), WAREHOUSE_SHUTTER_TOP, 1, 0, frame);
  }
}

/** Unit screen vector pointing out of a visible wall face. */
/** Unit screen vector for world +x (SE face) or +y (SW face), so projections stay on the iso grid. */
function faceOutVector(face: "SE" | "SW"): Point {
  const k = 1 / Math.hypot(1, 2);
  return face === "SE" ? { x: 2 * k, y: k } : { x: -2 * k, y: k };
}

/** Point on a roof slope quad [eaveA, eaveB, ridgeB, ridgeA]: `s` along, `r` eave→ridge. */
function slopePoint(q: [Point, Point, Point, Point], s: number, r: number): Point {
  return lerpPoint(lerpPoint(q[0], q[1], s), lerpPoint(q[3], q[2], s), r);
}

/** Rooflights on both slopes, a ridge cap, and turbine vents along the ridge. */
function drawWarehouseRoofDetail(
  ctx: CanvasRenderingContext2D,
  light: [Point, Point, Point, Point],
  dark: [Point, Point, Point, Point],
  ridgeA: Point,
  ridgeB: Point,
  baseColor: string,
) {
  for (const [q, glass] of [
    [light, WAREHOUSE_ROOFLIGHT],
    [dark, WAREHOUSE_ROOFLIGHT_DARK],
  ] as const) {
    for (const s of [0.2, 0.45, 0.7]) {
      const panel = [
        slopePoint(q, s, 0.3),
        slopePoint(q, s + 0.1, 0.3),
        slopePoint(q, s + 0.1, 0.78),
        slopePoint(q, s, 0.78),
      ];
      fillPoly(ctx, panel, glass);
      ctx.strokeStyle = shadeHex(baseColor, 0.75);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(panel[0]!.x, panel[0]!.y);
      for (const p of panel.slice(1)) ctx.lineTo(p.x, p.y);
      ctx.closePath();
      ctx.stroke();
    }
  }
  ctx.strokeStyle = shadeHex(baseColor, 0.62);
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(ridgeA.x, ridgeA.y);
  ctx.lineTo(ridgeB.x, ridgeB.y);
  ctx.stroke();
  for (const t of [0.3, 0.7]) {
    const p = lerpPoint(ridgeA, ridgeB, t);
    const r = 2.5;
    const hgt = 5;
    fillPoly(ctx, [{ x: p.x - r, y: p.y }, { x: p.x, y: p.y }, { x: p.x, y: p.y - hgt }, { x: p.x - r, y: p.y - hgt }], "#9a9ea3");
    fillPoly(ctx, [{ x: p.x, y: p.y }, { x: p.x + r, y: p.y }, { x: p.x + r, y: p.y - hgt }, { x: p.x, y: p.y - hgt }], "#7a7e83");
    ctx.fillStyle = "#b0b4b8";
    ctx.beginPath();
    ctx.ellipse(p.x, p.y - hgt, r, r * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Office wall detail under the windows: base course, slab bands between
 * floors, piers grouping the windows in pairs, and a fascia cap.
 */
function drawOfficeFacadeDetail(
  ctx: CanvasRenderingContext2D,
  bld: BuildingFootprint,
  oSw: Point,
  oSe: Point,
  oNe: Point,
) {
  const levels = Math.max(1, bld.exteriorLevels ?? 1);
  const capBottom = levels - OFFICE_CAP_FRAC;
  fillFacadeBand(ctx, oSw, oSe, oNe, 0, OFFICE_PLINTH_FRAC, 0, OFFICE_PLINTH, OFFICE_PLINTH_SIDE);
  for (let level = 1; level < levels; level++) {
    fillFacadeBand(ctx, oSw, oSe, oNe, 0.9, 1.05, level - 1, OFFICE_SPANDREL, OFFICE_SPANDREL_SIDE);
  }
  for (const face of ["SW", "SE"] as const) {
    const side = face === "SE";
    const faceLen = side ? bld.h : bld.w;
    const marks: number[] = [];
    for (let i = 2; i < faceLen - 1; i += 2) marks.push(i);
    drawWallPiers(
      ctx,
      side ? oNe : oSw,
      oSe,
      faceLen,
      marks,
      OFFICE_PIER_PX,
      OFFICE_PLINTH_FRAC,
      capBottom,
      side ? OFFICE_PIER_SIDE : OFFICE_PIER,
      side ? OFFICE_PIER_EDGE_SIDE : OFFICE_PIER_EDGE,
    );
  }
  fillFacadeBand(ctx, oSw, oSe, oNe, 1 - OFFICE_CAP_FRAC, 1, levels - 1, OFFICE_CAP, OFFICE_CAP_SIDE);
  fillFacadeBand(ctx, oSw, oSe, oNe, 1 - OFFICE_CAP_FRAC, 1 - OFFICE_CAP_FRAC + 0.02, levels - 1, OFFICE_CAP_SHADOW, OFFICE_CAP_SHADOW_SIDE);
  fillFacadeBand(ctx, oSw, oSe, oNe, 0.97, 1, levels - 1, OFFICE_COPING, OFFICE_COPING_SIDE);
}

/** Punched window on every visible tile, both floors. Ground floor skips the door. */
function drawOfficeWindows(
  ctx: CanvasRenderingContext2D,
  bld: BuildingFootprint,
  offset: (p: Point) => Point,
) {
  const run = retailEntrance(bld);
  if (!run) return;
  const levels = Math.max(1, bld.exteriorLevels ?? 1);
  for (const face of ["SW", "SE"] as const) {
    const faceLen = face === "SE" ? bld.h : bld.w;
    const origin = face === "SE" ? bld.oy : bld.ox;
    const doorHere = face === run.face;
    const doorStart = doorHere ? (face === "SE" ? run.y : run.x) - origin : -1;
    for (let level = 0; level < levels; level++) {
      for (let i = 0; i < faceLen; i++) {
        if (
          level === 0 &&
          doorHere &&
          i >= doorStart &&
          i < doorStart + run.span
        ) {
          continue;
        }
        const edge = facadeSpanEdge(bld, face, origin + i, 1, offset);
        if (!edge) continue;
        fillWallBand(
          ctx,
          edge.bottomLeft,
          edge.bottomRight,
          0.2,
          0.24,
          level,
          OFFICE_MULLION,
        );
        drawGlassPanel(
          ctx,
          edge.bottomLeft,
          edge.bottomRight,
          0.24,
          0.72,
          level,
          OFFICE_FRAME,
          OFFICE_GLASS,
          OFFICE_MULLION,
          false,
          false,
          // SW wants the screen-left jamb, SE the screen-right jamb.
          // Both are the start of this wall edge.
          "start",
        );
      }
    }
  }
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

  if (bld.buildingType === "diner") {
    paintDinerBuilding(scene, bld, ctx, offset);
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
  } else if (bld.buildingType === "large_retail" || bld.buildingType === "office") {
    const front = bld.buildingType === "large_retail" ? RETAIL_WALL_FRONT : OFFICE_WALL_FRONT;
    const side = bld.buildingType === "large_retail" ? RETAIL_WALL_SIDE : OFFICE_WALL_SIDE;
    fillPoly(
      ctx,
      [
        oSw,
        oSe,
        { x: oSe.x, y: oSe.y - d },
        { x: oSw.x, y: oSw.y - d },
      ],
      front,
    );
    fillPoly(
      ctx,
      [
        oNe,
        oSe,
        { x: oSe.x, y: oSe.y - d },
        { x: oNe.x, y: oNe.y - d },
      ],
      side,
    );
  } else {
    drawTexturedWallFace(ctx, src, oSw, oSe, d, srcW, srcH);
    drawTexturedWallFace(ctx, src, oNe, oSe, d, srcW, srcH);
  }

  if (bld.buildingType === "police_station") {
    drawPoliceFacadeDetail(ctx, bld, offset, oSw, oSe, oNe);
    drawPoliceWindows(ctx, scene, bld, offset, d);
  } else if (bld.buildingType === "supermarket") {
    drawSupermarketWindows(ctx, scene, bld, offset, d);
  } else if (bld.buildingType === "house") {
    const [trim, trimSide] = houseEaveTrim(bld);
    fillFacadeBand(ctx, oSw, oSe, oNe, 0.94, 1, 0, trim, trimSide);
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
    drawWarehouseDetail(ctx, bld, offset);
  } else if (bld.buildingType === "large_retail") {
    drawRetailFacade(ctx, scene, bld, offset, d, oSw, oSe, oNe);
  } else if (bld.buildingType === "office") {
    drawOfficeFacadeDetail(ctx, bld, oSw, oSe, oNe);
    drawOfficeWindows(ctx, bld, offset);
  } else if (bld.buildingType === "apartment") {
    drawApartmentFacade(ctx, scene, bld, offset, oSw, oSe, oNe);
  } else if (bld.buildingType === "gun_shop") {
    drawGunShopFacade(ctx, scene, bld, offset, oSw, oSe, oNe);
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
    // Face-specific doors: SE keeps the default U-flip; SW uses the art as drawn.
    const flipU =
      (bld.buildingType === "police_station" ||
        bld.buildingType === "supermarket" ||
        bld.buildingType === "large_retail" ||
        bld.buildingType === "office" ||
        bld.buildingType === "apartment" ||
        bld.buildingType === "gun_shop") &&
      doorFace != null
        ? doorFace === "SE"
        : true;
    // Door4 includes the supermarket header, so it sits taller than Door8.
    // Door8 is the retail double door. Door7 is a single door, so 0.69
    // keeps that aspect on a 1-tile span.
    const heightFrac =
      bld.buildingType === "supermarket"
        ? 0.95
        : bld.buildingType === "large_retail"
          ? 0.8
          : bld.buildingType === "office" || bld.buildingType === "apartment"
            ? 0.69
            : bld.buildingType === "gun_shop"
              ? GUN_SHOP_DOOR_FRAC
              : 0.75;
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
  drawEntranceExtras(ctx, bld, offset);

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
    drawHospitalTowerPlant(ctx, center, doorFace, offset);
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
  drawEntranceCanopy(ctx, bld, offset, HOSPITAL_CANOPY);

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
  for (let level = 1; level < strip.levels; level++) {
    fillFacadeBand(ctx, sw, se, ne, 0.93, 1, level - 1, HOSPITAL_SLAB_BAND, HOSPITAL_SLAB_BAND_SIDE);
  }

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

/** Rooftop air handler with fans, a smaller unit, and a flue on the tower roof. */
function drawHospitalTowerPlant(
  ctx: CanvasRenderingContext2D,
  strip: HospitalStrip,
  face: SuperWindowFace,
  offset: (p: Point) => Point,
) {
  const depth = WALL_DEPTH * strip.levels;
  const nw = offset(cartesianToIso(strip.ox, strip.oy));
  const ne = offset(cartesianToIso(strip.ox + strip.w, strip.oy));
  const se = offset(cartesianToIso(strip.ox + strip.w, strip.oy + strip.h));
  const sw = offset(cartesianToIso(strip.ox, strip.oy + strip.h));
  // `a` runs along the street frontage, `b` from the back wall toward the street.
  const along = face === "SE" ? strip.h : strip.w;
  const deep = face === "SE" ? strip.w : strip.h;
  const mid = along / 2;
  const box = (
    a0: number, a1: number, b0: number, b1: number, h: number,
    top: string, side: string, front: string, base = 0,
  ) => {
    const ua = [a0 / along, a1 / along];
    const vb = [b0 / deep, b1 / deep];
    const [u0, u1, v0, v1] =
      face === "SE" ? [vb[0]!, vb[1]!, ua[0]!, ua[1]!] : [ua[0]!, ua[1]!, vb[0]!, vb[1]!];
    drawRoofPropBox(ctx, nw, ne, se, sw, depth, u0, v0, u1, v1, h, top, side, front, base);
  };
  const ahuHalf = Math.min(1.1, along / 2 - 0.5);
  if (ahuHalf <= 0.2 || deep < 6) return;
  const ahuH = 9;
  box(mid - ahuHalf, mid + ahuHalf, 1.2, 3.4, ahuH, "#a3a9ae", "#70767b", "#868c91");
  box(mid - ahuHalf + 0.2, mid - ahuHalf + 0.8, 1.5, 2.1, 2, "#4f565d", "#5e656c", "#6a7178", ahuH);
  box(mid + ahuHalf - 0.8, mid + ahuHalf - 0.2, 2.4, 3.0, 2, "#4f565d", "#5e656c", "#6a7178", ahuH);
  box(mid - 0.5, mid + 0.5, 4.6, 5.6, 6, "#9aa2aa", "#6a727a", "#7e868e");
  box(mid + 0.6, mid + 0.85, 6.4, 6.65, 11, "#8a929a", "#5e666e", "#727a82");
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
   * Supersampling the bake was painted at. The tier alone is not enough: zoom
   * changes the scale within a tier, and a stale scale is what the refresh pass
   * looks for to repaint after a zoom.
   */
  bakeScale?: number;
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
      bakeScale: handle.scale,
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
    bld.buildingType === "hospital" ||
    bld.buildingType === "large_retail" ||
    bld.buildingType === "office" ||
    bld.buildingType === "apartment" ||
    bld.buildingType === "gun_shop";

  if (isMotel) {
    const deck = motelFlatDeck(nw, ne, se, sw, wallDepth);
    const mono = colors.flat === 0xffffff;
    const paint = (pts: Point[], hex: string) => {
      fillPolyGraphics(g, pts, mono ? 0xffffff : Number.parseInt(hex.slice(1), 16));
    };
    const wallDeck: [Point, Point, Point, Point] = [
      { x: nw.x, y: nw.y - wallDepth },
      { x: ne.x, y: ne.y - wallDepth },
      { x: se.x, y: se.y - wallDepth },
      { x: sw.x, y: sw.y - wallDepth },
    ];
    const [, dNe, dSe, dSw] = deck;
    paint([wallDeck[3]!, wallDeck[2]!, dSe, dSw], MOTEL_ROOF_DECK);
    paint([wallDeck[1]!, wallDeck[2]!, dSe, dNe], MOTEL_ROOF_DECK);
    paint(deck, MOTEL_ROOF_DECK);
    const board = motelSignBoard(bld, deck);
    if (board) paintMotelSignBoard(board, paint, motelPalette(bld));
    return;
  }

  if (bld.buildingType === "diner") {
    const parts = dinerRoofParts(nw, ne, se, sw, wallDepth, bld);
    const mono = colors.flat === 0xffffff;
    const paint = (pts: Point[], hex: string) => {
      fillPolyGraphics(g, pts, mono ? 0xffffff : Number.parseInt(hex.slice(1), 16));
    };
    paint(parts.fasciaSw, shadeHex(DINER_ROOF_DECK, 0.55));
    paint(parts.fasciaSe, shadeHex(DINER_ROOF_DECK, 0.55));
    paint(parts.deck, shadeHex(DINER_ROOF_DECK, 1.05));
    paintDinerCrown(parts, paint);
    return;
  }

  if (isHouse || isWarehouse || isTent || isMessHall) {
    // Peak only — chimney / HVAC props are small and drawn separately on the
    // real building; inflating the whole roof to clear them recreates the bug.
    const peak = isHouse
      ? HOUSE_ROOF_PEAK_HEIGHT
      : isWarehouse
        ? WAREHOUSE_ROOF_PEAK_HEIGHT
        : isTent
          ? TENT_ROOF_PEAK_HEIGHT
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
  const isDiner = bld.buildingType === "diner";
  const isWarehouse = bld.buildingType === "warehouse";
  const isTent = bld.buildingType === "tent";
  const isMessHall = bld.buildingType === "mess_hall";
  const flatPal = isMotel
    ? motelPalette(bld)
    : bld.buildingType === "gun_shop"
      ? gunShopPalette(bld)
      : null;

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
    isTent ? 0x4a5a32 : isMessHall ? 0x6b5e45 : flatPal ? Number.parseInt(flatPal.wall.slice(1), 16) : isDiner ? 0xe4d7c4 : 0xd2c18b,
  );
  fillPolyGraphics(
    g,
    [
      { x: ne.x, y: ne.y },
      { x: se.x, y: se.y },
      { x: se.x, y: se.y - d },
      { x: ne.x, y: ne.y - d },
    ],
    isTent ? 0x3d4c2a : isMessHall ? 0x5a4e3a : flatPal ? Number.parseInt(flatPal.wallSide.slice(1), 16) : isDiner ? 0xcbbda8 : 0x948962,
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
