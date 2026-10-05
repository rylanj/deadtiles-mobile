import Phaser from "phaser";
import {
  cartesianToIso,
  BIGSHELF_RENDER_HEIGHT_PX,
  FURNITURE_RENDER_HEIGHT_PX,
  getBuildingAt,
  hospitalCubiclesForBuilding,
  hospitalCubicleAtTile,
  motelRoomsForBuilding,
  houseRoomsForBuilding,
  houseRoomAtTile,
  motelRoomAtTile,
  officeMeetingRoomForBuilding,
  officeMeetingRoomAtTile,
  officeManagerRoomForBuilding,
  officeManagerRoomAtTile,
  interiorDimensions,
  interiorExitForBuildingAt,
  interiorWallCornerDepthBias,
  interiorWallsForBuilding,
  searchableFootprint,
  ENTITY_RENDER_HEIGHT,
  TILE_HEIGHT,
  TILE_WIDTH,
  WALL_DEPTH,
  parseStructureFenceFacing,
  parseStructureFenceCorner,
  structureFenceFootprint,
  structureOccupiedTiles,
  isStructurePanelKind,
  isStorageBoxKind,
  type HospitalCubicle,
  type HouseRoom,
  type InteriorWallTile,
  type MotelRoom,
  type OfficeMeetingRoom,
  type StructureBuildKind,
  type StructureFenceCorner,
  type StructureFenceFacing,
} from "@zombie/shared";
import {
  BUILDING_WALL_PLYWOOD_KEY,
  buildingHospitalDoorKey,
  buildingInternalDoor1Key,
  type InternalDoorFace,
} from "../sprites/BuildingAssets";
import { drawTexturedWallFace } from "./BuildingCuboid";
import {
  animatedFurnitureDef,
  configureInteriorAnimations,
  FIREPLACE1_ACTIVE_ANIM,
  FIREPLACE1_INACTIVE_KEY,
  STORAGE_BOX_RENDER_SCALE,
  storageBoxGroundOffset,
  storageBoxTextureKey,
  furnace1ActiveAnim,
  furnace1InactiveKey,
  mantel1ActiveAnim,
  mantel1InactiveKey,
  furnitureSearchedFrameKey,
  interiorTextureKey,
  type AnimatedFurnitureDef,
} from "../sprites/InteriorAssets";
import {
  addImageForKey,
  addSpriteForKey,
  applyTextureKey,
  resolveImageSource,
  spriteShowsKey,
  textureKeyExists,
} from "../sprites/atlasRegistry";
import { IS_MOBILE } from "../gameConfig";
import {
  chainLinkFenceCornerTextureKey,
  layoutChainLinkFenceCornerImage,
  layoutChainLinkFenceImage,
  structurePanelTextureKey,
} from "../sprites/FenceAssets";
import {
  chainLinkFenceCornerSortDepth,
  chainLinkFenceSortDepth,
  interiorFloorDepth,
  interiorFurnitureDepth,
  interiorFurnitureDepthBias,
  interiorPartitionDepth,
  strokeIsoFootprintOutline,
  strokeIsoTileOutline,
  tileIndicatorDepth,
} from "./IsoTiles";
import { createInteriorFloorImage, interiorFloorTextureKey } from "./TileTextures";
import {
  nearestManhattanTile,
  pickTopOpaqueImageAtWorld,
  spriteOpaqueAtWorldPoint,
} from "../sprites/spritePixelHit";

/**
 * Supersample factor for baked interior door canvases — matches exterior
 * building `WALL_RENDER_SCALE` so InternalDoor1 stays as sharp as Door1.
 */
const INTERNAL_DOOR_RENDER_SCALE = IS_MOBILE ? 2 : 4;

/** Client-side view of a persistent player-built door tile. */
export type InteriorDoorTile = {
  x: number;
  y: number;
  isOpen: boolean;
  isLocked: boolean;
  ownerWallet: string;
};

/** Client-side view of a persistent player-built Fireplace1 tile. */
export type InteriorFireplaceTile = {
  x: number;
  y: number;
  ownerWallet: string;
  /** Absolute ms timestamp when the fire goes inactive. */
  activeUntil: number;
  /** Wood pieces currently loaded (0–8). */
  fuelWood: number;
};

/** Client-side view of a persistent player-built 3×1 panel (barbed wire or bargate). */
export type InteriorFenceTile = {
  x: number;
  y: number;
  facing: StructureFenceFacing;
  ownerWallet: string;
  kind?: "fence" | "bargate";
};

/** Client-side view of a persistent auto-built barbed-wire corner post. */
export type InteriorFenceCornerTile = {
  x: number;
  y: number;
  corner: StructureFenceCorner;
  ownerWallet: string;
};

export type SearchableVisual = {
  id: string;
  kind: string;
  objectType: string;
  x: number;
  y: number;
  searched: boolean;
  buildingX: number;
  buildingY: number;
  facing?: string;
  /** Furnace burn end (unix ms). 0 when cold. */
  activeUntil?: number;
};

/** Interior partition height (fraction of one exterior storey). */
const PARTITION_HEIGHT = WALL_DEPTH * 0.65;
/** Footprint thickness in tile units — thin room dividers, not full-tile blocks. */
const PARTITION_THICKNESS = 0.16;
/** Below this span (tile units) a clipped wall face is degenerate — skip it. */
const PARTITION_FACE_EPS = 1e-6;
/** Generic partition face colors (warm off-white). */
const PARTITION_WALL_FRONT = "#f2efe8";
const PARTITION_WALL_SIDE = "#e0dbd2";
const PARTITION_WALL_TOP = "#ebe6dc";
/** Hospital partition faces — true white with cool iso shade. */
const HOSPITAL_WALL_FRONT = "#ffffff";
const HOSPITAL_WALL_SIDE = "#e6e6e6";
const HOSPITAL_WALL_TOP = "#f2f2f2";

type PartitionWallColors = {
  front: string;
  side: string;
  top: string;
  /** Sheet grain and panel seams. Building interiors stay flat. */
  plywood?: boolean;
};

/** Player-built walls: plywood sheets, lighter on the south face. */
export const PLAYER_WALL_STYLE: PartitionWallColors = {
  front: "#c6a36c",
  side: "#a78654",
  top: "#d8bc8e",
  plywood: true,
};
/** Alpha for cubicle SW/SE partitions while the player is inside that bay. */
const CUBICLE_WALL_FADE_ALPHA = 0.28;
/** Player-built / house-room door leaf colors — wood vs. stone/drywall partitions. */
const DOOR_FRONT = "#8b5a2b";
const DOOR_SIDE = "#6b4423";
const DOOR_TOP = "#7a4a20";
/** Hospital cubicle door leaf — warm sand matching DoorHospital art. */
const HOSPITAL_DOOR_FRONT = "#d0a95b";
const HOSPITAL_DOOR_SIDE = "#b2904d";
const HOSPITAL_DOOR_TOP = "#c09c54";
/** Open-door leaf thickness (a bit slimmer than the closed footprint). */
const DOOR_OPEN_THICKNESS = PARTITION_THICKNESS * 0.7;

const FURNITURE_RENDER_HEIGHT = FURNITURE_RENDER_HEIGHT_PX;
const BIGSHELF_RENDER_HEIGHT = BIGSHELF_RENDER_HEIGHT_PX;
/** Desk display height relative to generic furniture scale. */
const DESK_RENDER_HEIGHT = Math.round(FURNITURE_RENDER_HEIGHT * 0.968);
/** Desk2 L-desk. Was 1.12× generic furniture, then scaled down 10%. */
const DESK2_RENDER_HEIGHT = Math.round(FURNITURE_RENDER_HEIGHT * 1.12 * 0.9);
/**
 * Desk art has empty padding under the feet. Positive = lower on screen.
 * Tuned so legs sit on the tile, then raised 10% of display height.
 */
const DESK_BOTTOM_PAD = Math.round(DESK_RENDER_HEIGHT * 0.12);
/** Desk3 office bullpen. Desk1 size, then 10% larger. */
const DESK3_RENDER_HEIGHT = Math.round(DESK_RENDER_HEIGHT * 1.2);
const DESK3_BOTTOM_PAD = Math.round(DESK3_RENDER_HEIGHT * 0.12);
/** Stairs1 flight. Long enough to read across a 3-tile run. */
const STAIRS_RENDER_HEIGHT = Math.round(FURNITURE_RENDER_HEIGHT * 1.8);
/** Ascending flight. Positive pad moves the sprite down the screen. */
const STAIRS_BOTTOM_PAD = Math.round(STAIRS_RENDER_HEIGHT * 0.125);
/** Descending flight. Drops the sprite into the hole in the upper floor. */
const STAIRS_DESCEND_BOTTOM_PAD = Math.round(STAIRS_RENDER_HEIGHT * 0.55);
const DESK2_BOTTOM_PAD = Math.round(DESK2_RENDER_HEIGHT * 0.12);
/** BigShelf1 — lower by 10% of display height. */
const BIGSHELF_BOTTOM_PAD = Math.round(BIGSHELF_RENDER_HEIGHT * 0.1);
/** BigBox1 — lower by 10% of display height. */
const BIGBOX_BOTTOM_PAD = Math.round(FURNITURE_RENDER_HEIGHT * 0.1);
/** WaterContainer1 — lower by 10% of display height. */
const WATERCONTAINER_BOTTOM_PAD = Math.round(FURNITURE_RENDER_HEIGHT * 0.1);
/** Bed1 — 10% larger than generic furniture. */
const BED_RENDER_HEIGHT = Math.round(FURNITURE_RENDER_HEIGHT * 1.1);
/** Bed1 — lower by 10% of display height. */
const BED_BOTTOM_PAD = Math.round(BED_RENDER_HEIGHT * 0.125);
/** MilitaryBed1 — bed scale, then lower by 2.5%. */
const MILITARYBED_BOTTOM_PAD =
  BED_BOTTOM_PAD + Math.round(BED_RENDER_HEIGHT * 0.025);
/** Cabinet1 — raise by 5% of display height. */
const CABINET_BOTTOM_PAD = -Math.round(FURNITURE_RENDER_HEIGHT * 0.05);
/** Bookshelf1 — raise by 5% of display height. */
const BOOKSHELF_BOTTOM_PAD = -Math.round(FURNITURE_RENDER_HEIGHT * 0.05);
/** Bookshelf2 — raise by 5% of display height. */
const BOOKSHELF2_BOTTOM_PAD = -Math.round(FURNITURE_RENDER_HEIGHT * 0.05);
/** Lockers1 — taller 2-tile wall unit. */
const LOCKERS_RENDER_HEIGHT = Math.round(FURNITURE_RENDER_HEIGHT * 1.35);
const LOCKERS_BOTTOM_PAD = Math.round(LOCKERS_RENDER_HEIGHT * 0.02);
/** Dresser1 — lower by 15% of display height. */
const DRESSER_BOTTOM_PAD = Math.round(FURNITURE_RENDER_HEIGHT * 0.15);
/** Fridge1 — raise by 5% of display height. */
const FRIDGE_BOTTOM_PAD = -Math.round(FURNITURE_RENDER_HEIGHT * 0.05);
/** GunCabinet1 — raise by 10% of display height. */
const GUNCABINET_BOTTOM_PAD = -Math.round(FURNITURE_RENDER_HEIGHT * 0.1);
/** Drawers1 — raise by 5% of display height. */
const DRAWERS_BOTTOM_PAD = -Math.round(FURNITURE_RENDER_HEIGHT * 0.05);
/** KitchenSink1 — lower by 15% of display height. */
const KITCHENSINK_BOTTOM_PAD = Math.round(FURNITURE_RENDER_HEIGHT * 0.15);
/** Workbench1 — lower by 10% of display height. */
const WORKBENCH_BOTTOM_PAD = Math.round(FURNITURE_RENDER_HEIGHT * 0.1);
/** Nightstand1 — small bedside furniture, ~55% of generic furniture height. */
const NIGHTSTAND_RENDER_HEIGHT = Math.round(FURNITURE_RENDER_HEIGHT * 0.55);
/** Nightstand1 — raise by 10% of display height. */
const NIGHTSTAND_BOTTOM_PAD = -Math.round(NIGHTSTAND_RENDER_HEIGHT * 0.1);
/** DeadOfficer — 10% smaller than generic furniture. */
const DEADOFFICER_RENDER_HEIGHT = Math.round(FURNITURE_RENDER_HEIGHT * 0.9);
/** Suitcase1 — floor luggage, ~60% of generic furniture height. */
const SUITCASE_RENDER_HEIGHT = Math.round(FURNITURE_RENDER_HEIGHT * 0.6);
/** Suitcase1 — raise by 20% of display height. */
const SUITCASE_BOTTOM_PAD = -Math.round(SUITCASE_RENDER_HEIGHT * 0.2);
/** Footlocker1 — suitcase scale, then lower by 10% + 5% + 2.5%. */
const FOOTLOCKER_RENDER_HEIGHT = SUITCASE_RENDER_HEIGHT;
const FOOTLOCKER_BOTTOM_PAD =
  SUITCASE_BOTTOM_PAD + Math.round(FOOTLOCKER_RENDER_HEIGHT * 0.175);
/** Kitbag1 — 10% then 10% smaller than suitcase, then lower by 10% + 5%. */
const KITBAG_RENDER_HEIGHT = Math.round(SUITCASE_RENDER_HEIGHT * 0.9 * 0.9);
const KITBAG_BOTTOM_PAD =
  SUITCASE_BOTTOM_PAD + Math.round(KITBAG_RENDER_HEIGHT * 0.15);
/** MilitaryBasket1 — suitcase scale, then lower by 10% + 5%. */
const MILITARYBASKET_RENDER_HEIGHT = SUITCASE_RENDER_HEIGHT;
const MILITARYBASKET_BOTTOM_PAD =
  SUITCASE_BOTTOM_PAD + Math.round(MILITARYBASKET_RENDER_HEIGHT * 0.15);
/** Backpack1 — dropped floor bag (~half suitcase, then +20%). */
const GROUNDBACKPACK_RENDER_HEIGHT = Math.round(SUITCASE_RENDER_HEIGHT * 0.5 * 1.2);
/** Backpack1 — raise by 25% of display height. */
const GROUNDBACKPACK_BOTTOM_PAD = -Math.round(GROUNDBACKPACK_RENDER_HEIGHT * 0.25);
/** WaterCooler — tall office cooler. */
const WATERCOOLER_RENDER_HEIGHT = Math.round(FURNITURE_RENDER_HEIGHT * 1.05);
const WATERCOOLER_BOTTOM_PAD = -Math.round(WATERCOOLER_RENDER_HEIGHT * 0.05);
/** TrashCan1 — ~55% base, then 30% smaller. */
const TRASHCAN_RENDER_HEIGHT = Math.round(FURNITURE_RENDER_HEIGHT * 0.55 * 0.7);
/** TrashCan1 — raise by 30% of display height. */
const TRASHCAN_BOTTOM_PAD = -Math.round(TRASHCAN_RENDER_HEIGHT * 0.3);
/** Lantern1 — trash-can sit, then raised 10% of display height. */
const LANTERN_BOTTOM_PAD =
  TRASHCAN_BOTTOM_PAD - Math.round(TRASHCAN_RENDER_HEIGHT * 0.1);
/** Checkout1 — 50% larger than generic furniture. */
const CHECKOUT_RENDER_HEIGHT = Math.round(FURNITURE_RENDER_HEIGHT * 1.5);
/** Checkout1 — lower by 20% of display height. */
const CHECKOUT_BOTTOM_PAD = Math.round(CHECKOUT_RENDER_HEIGHT * 0.2);
/** SuperShelf1/2 — tall aisle gondolas. */
const SUPERSHELF_RENDER_HEIGHT = Math.round(FURNITURE_RENDER_HEIGHT * 1.4);
/** SuperShelf1/2 — lower by 10% of display height. */
const SUPERSHELF_BOTTOM_PAD = Math.round(SUPERSHELF_RENDER_HEIGHT * 0.1);
/** ClothingRack1-3: 2-tile rail. Opaque width fills that span at this height. */
const CLOTHING_RACK_RENDER_HEIGHT = Math.round(FURNITURE_RENDER_HEIGHT * 1.15);
/** Drop the few transparent rows under the wheels. */
const CLOTHING_RACK_BOTTOM_PAD = Math.round(CLOTHING_RACK_RENDER_HEIGHT * (8 / 256));
/** Mannequin1-3: about player height. */
const MANNEQUIN_RENDER_HEIGHT = Math.round(FURNITURE_RENDER_HEIGHT * 1.1);
/** Cart1/2: one tile. Slightly under generic so the basket stays on the diamond. */
const CART_RENDER_HEIGHT = Math.round(FURNITURE_RENDER_HEIGHT * 0.9);
/** Drop the transparent rows under the cart wheels. */
const CART_BOTTOM_PAD = Math.round(CART_RENDER_HEIGHT * (10 / 256));
/** RetailCase1/2: 3-tile glass counter. Same canvas scale as a gondola, so the length matches. */
const RETAIL_CASE_RENDER_HEIGHT = SUPERSHELF_RENDER_HEIGHT;
/** Feet sit 21px above the canvas bottom. */
const RETAIL_CASE_BOTTOM_PAD = Math.round(RETAIL_CASE_RENDER_HEIGHT * (21 / 256));
/** SuperFridge1 — commercial drink cooler bank. */
const SUPERFRIDGE_RENDER_HEIGHT = Math.round(FURNITURE_RENDER_HEIGHT * 1.25);
/** SuperFridge1 — lower by 10% of display height. */
const SUPERFRIDGE_BOTTOM_PAD = Math.round(SUPERFRIDGE_RENDER_HEIGHT * 0.1);
/** Shared base before the hospital +20% bump (also used by MotelBed1). */
const HOSPITALBED_BASE_RENDER_HEIGHT = Math.round(FURNITURE_RENDER_HEIGHT * 1.1);
/** HospitalBed1 — base scale +20%. */
const HOSPITALBED_RENDER_HEIGHT = Math.round(HOSPITALBED_BASE_RENDER_HEIGHT * 1.2);
const HOSPITALBED_BOTTOM_PAD = Math.round(HOSPITALBED_RENDER_HEIGHT * 0.1);
/** HospitalBed2/3 — occupied soldier beds, 20% larger than Bed1. */
const HOSPITALBED_OCCUPIED_RENDER_HEIGHT = Math.round(
  HOSPITALBED_RENDER_HEIGHT * 1.2,
);
const HOSPITALBED_OCCUPIED_BOTTOM_PAD = Math.round(
  HOSPITALBED_OCCUPIED_RENDER_HEIGHT * 0.1,
);
/** MotelBed1 — keeps the pre-bump hospital bed scale. */
const MOTELBED_RENDER_HEIGHT = HOSPITALBED_BASE_RENDER_HEIGHT;
/** MotelBed1 — base hospital pad, then lower by an extra 5%. */
const MOTELBED_BOTTOM_PAD =
  Math.round(MOTELBED_RENDER_HEIGHT * 0.1) +
  Math.round(MOTELBED_RENDER_HEIGHT * 0.05);
/** Counter1 — motel lobby reception desk. */
const COUNTER_RENDER_HEIGHT = Math.round(FURNITURE_RENDER_HEIGHT * 1.15);
const COUNTER_BOTTOM_PAD = Math.round(COUNTER_RENDER_HEIGHT * 0.1);
/** MiniFridge1 — compact room fridge (~85% of generic). */
const MINIFRIDGE_RENDER_HEIGHT = Math.round(FURNITURE_RENDER_HEIGHT * 0.85);
/** DinnerTable1 — low freestanding table with place settings. */
const DINNERTABLE_RENDER_HEIGHT = Math.round(FURNITURE_RENDER_HEIGHT * 0.95);
/** DinnerTable1 — sit slightly into the floor diamond. */
const DINNERTABLE_BOTTOM_PAD = Math.round(DINNERTABLE_RENDER_HEIGHT * 0.05);
/** CanteenTable1–3 — 20% larger than DinnerTable1, then lower by 2.5% + 5%. */
const CANTEENTABLE_RENDER_HEIGHT = Math.round(DINNERTABLE_RENDER_HEIGHT * 1.2);
const CANTEENTABLE_BOTTOM_PAD =
  DINNERTABLE_BOTTOM_PAD + Math.round(CANTEENTABLE_RENDER_HEIGHT * 0.075);
/** Range1 — 20% smaller than Counter1, then raise by 5% + 5%. */
const RANGE_RENDER_HEIGHT = Math.round(COUNTER_RENDER_HEIGHT * 0.8);
const RANGE_BOTTOM_PAD =
  COUNTER_BOTTOM_PAD - Math.round(RANGE_RENDER_HEIGHT * 0.1);
/** HotDisplay1 — counter pad, then raise by 5%. */
const HOTDISPLAY_BOTTOM_PAD =
  COUNTER_BOTTOM_PAD - Math.round(COUNTER_RENDER_HEIGHT * 0.05);
/** DrinkDisplay1 — 20% larger than Counter1, then lower by 2.5%. */
const DRINKDISPLAY_RENDER_HEIGHT = Math.round(COUNTER_RENDER_HEIGHT * 1.2);
const DRINKDISPLAY_BOTTOM_PAD =
  COUNTER_BOTTOM_PAD + Math.round(DRINKDISPLAY_RENDER_HEIGHT * 0.025);
/** BagChair1 — 20% smaller than generic furniture. */
const BAGCHAIR_RENDER_HEIGHT = Math.round(FURNITURE_RENDER_HEIGHT * 0.8);
/** Armchair1 — wingback, then 10% smaller. */
const ARMCHAIR_RENDER_HEIGHT = Math.round(FURNITURE_RENDER_HEIGHT * 0.95 * 0.9);
/** Sofa1: bench height so a 2-tile seat reads wide, then 10% smaller. */
const SOFA_RENDER_HEIGHT = Math.round(FURNITURE_RENDER_HEIGHT * 1.15);
/** Sofa1: bench drop of 12.5%, raised by 5%, then lowered by 10% of display height. */
const SOFA_BOTTOM_PAD = Math.round(SOFA_RENDER_HEIGHT * 0.2);
/** CampChair1 — 20% then 20% smaller than BagChair1, then 20% larger, then 10% smaller. */
const CAMPCHAIR_RENDER_HEIGHT = Math.round(
  BAGCHAIR_RENDER_HEIGHT * 0.8 * 0.8 * 1.2 * 0.9,
);
const CAMPCHAIR_BOTTOM_PAD = -Math.round(CAMPCHAIR_RENDER_HEIGHT * 0.1);
/** CanteenChair1 — BagChair1, two 10% cuts, then 10% larger. */
const CANTEENCHAIR_RENDER_HEIGHT = Math.round(
  BAGCHAIR_RENDER_HEIGHT * 0.9 * 0.9 * 1.1,
);
const CANTEENCHAIR_BOTTOM_PAD = -Math.round(CANTEENCHAIR_RENDER_HEIGHT * 0.1);
/** IVStand1 — tall thin stand. */
const IVSTAND_RENDER_HEIGHT = Math.round(FURNITURE_RENDER_HEIGHT * 1.15);
const IVSTAND_BOTTOM_PAD = -Math.round(IVSTAND_RENDER_HEIGHT * 0.05);
/** MedicalCart1 — waist-high cart. */
const MEDICALCART_RENDER_HEIGHT = Math.round(FURNITURE_RENDER_HEIGHT * 0.85);
/** MedicalCart1 — raise by 10% of display height. */
const MEDICALCART_BOTTOM_PAD = -Math.round(MEDICALCART_RENDER_HEIGHT * 0.1);
/** MedicalReception1 — large lobby desk (1.35× × 1.25 × 1.2). */
const MEDICALRECEPTION_RENDER_HEIGHT = Math.round(
  FURNITURE_RENDER_HEIGHT * 1.35 * 1.25 * 1.2,
);
/** MedicalReception1 — lower by 15% of display height. */
const MEDICALRECEPTION_BOTTOM_PAD = Math.round(MEDICALRECEPTION_RENDER_HEIGHT * 0.15);
/** MedicalDrawers1 — tall filing unit (1.2× then −10% twice). */
const MEDICALDRAWERS_RENDER_HEIGHT = Math.round(
  FURNITURE_RENDER_HEIGHT * 1.2 * 0.9 * 0.9,
);
/** MedicalDrawers1 — raise by 5% of display height. */
const MEDICALDRAWERS_BOTTOM_PAD = -Math.round(MEDICALDRAWERS_RENDER_HEIGHT * 0.05);
/** ThreeSeater — waiting-room bench (0.95× then +20%). */
const THREESEATER_RENDER_HEIGHT = Math.round(FURNITURE_RENDER_HEIGHT * 0.95 * 1.2);
/** ThreeSeater — lower by 12.5% of display height. */
const THREESEATER_BOTTOM_PAD = Math.round(THREESEATER_RENDER_HEIGHT * 0.125);
/** VendingMachine1 — raise by 10% of display height. */
const VENDINGMACHINE_BOTTOM_PAD = -Math.round(FURNITURE_RENDER_HEIGHT * 0.1);
/** Storage boxes share one canvas height. Box 2 reads larger because its art fills more of the PNG. */
const STORAGE_BOX_RENDER_HEIGHT = Math.round(
  FURNITURE_RENDER_HEIGHT * STORAGE_BOX_RENDER_SCALE,
);
/** Fireplace1 — slightly shorter than generic furniture. */
const FIREPLACE1_RENDER_HEIGHT = Math.round(FURNITURE_RENDER_HEIGHT * 0.95);
/** Fireplace1 — lower by 12.5% of display height. */
const FIREPLACE1_BOTTOM_PAD = Math.round(FIREPLACE1_RENDER_HEIGHT * 0.125);
/** Furnace1 — same screen height as other floor furniture. */
const FURNACE1_RENDER_HEIGHT = FURNITURE_RENDER_HEIGHT;
/** Furnace1 — lower by 5% of display height. */
const FURNACE1_BOTTOM_PAD = Math.round(FURNACE1_RENDER_HEIGHT * 0.05);
/** Mantel1 — taller than a stove so the breast reads above the hearth. */
const MANTEL1_RENDER_HEIGHT = Math.round(FURNITURE_RENDER_HEIGHT * 1.5);
/** Mantel1 — lower by 5% of display height, same as the furnace. */
const MANTEL1_BOTTOM_PAD = Math.round(MANTEL1_RENDER_HEIGHT * 0.05);
/**
 * ConferenceTable1 is 512². The floor ellipse covers a 4×3 tile diamond
 * (screen width 224). Opaque art is 481/512 of the canvas. The sprite is
 * 10% under that footprint-filling height, then another 20% smaller, anchored
 * on the footprint center. The pad drops the canvas so the chair wheels
 * (43px of empty canvas) meet the south corner. The atlas stays at the
 * pre-shrink height, so this cut does not throw away pixels.
 */
const CONFERENCE_RENDER_HEIGHT = Math.round(FURNITURE_RENDER_HEIGHT * 2);
const CONFERENCE_BOTTOM_PAD = Math.round(CONFERENCE_RENDER_HEIGHT * 0.25);
/** Copier1 reads as a tall machine on one tile. */
const COPIER_RENDER_HEIGHT = Math.round(FURNITURE_RENDER_HEIGHT * 0.8);
const COPIER_BOTTOM_PAD = -Math.round(COPIER_RENDER_HEIGHT * 0.05);
/** OfficeChair1, then scaled down 20%. */
const OFFICECHAIR_RENDER_HEIGHT = Math.round(FURNITURE_RENDER_HEIGHT * 0.7);
/**
 * Whiteboard1 on a 2×1 diamond (screen width 96). Opaque width is 176/256
 * of the canvas. Display height is two 10% cuts under the footprint-filling size.
 * Pad drops the stand onto the south edge, raises it by 10% of display height, then lowers it by 5%.
 */
const WHITEBOARD_RENDER_HEIGHT = Math.round(140 * 0.9 * 0.9);
const WHITEBOARD_BOTTOM_PAD =
  Math.round(12 * 0.9 * 0.9) -
  Math.round(WHITEBOARD_RENDER_HEIGHT * 0.1) +
  Math.round(WHITEBOARD_RENDER_HEIGHT * 0.05);

function furnitureRenderHeight(objectType: string): number {
  if (objectType === "desk") return DESK_RENDER_HEIGHT;
  if (objectType === "desk3") return DESK3_RENDER_HEIGHT;
  if (objectType === "stairs") return STAIRS_RENDER_HEIGHT;
  if (objectType === "desk2") return DESK2_RENDER_HEIGHT;
  if (objectType === "bigshelf") return BIGSHELF_RENDER_HEIGHT;
  if (objectType === "bed") return BED_RENDER_HEIGHT;
  if (objectType === "lockers") return LOCKERS_RENDER_HEIGHT;
  if (objectType === "nightstand") return NIGHTSTAND_RENDER_HEIGHT;
  if (objectType === "deadofficer") return DEADOFFICER_RENDER_HEIGHT;
  if (objectType === "suitcase") return SUITCASE_RENDER_HEIGHT;
  if (objectType === "watercooler") return WATERCOOLER_RENDER_HEIGHT;
  if (objectType === "trashcan") return TRASHCAN_RENDER_HEIGHT;
  if (objectType === "checkout") return CHECKOUT_RENDER_HEIGHT;
  if (objectType === "supershelf1" || objectType === "supershelf2") {
    return SUPERSHELF_RENDER_HEIGHT;
  }
  if (
    objectType === "retailshelf1" ||
    objectType === "retailshelf2" ||
    objectType === "retailshelf3"
  ) {
    return SUPERSHELF_RENDER_HEIGHT;
  }
  if (
    objectType === "clothingrack1" ||
    objectType === "clothingrack2" ||
    objectType === "clothingrack3"
  ) {
    return CLOTHING_RACK_RENDER_HEIGHT;
  }
  if (
    objectType === "mannequin1" ||
    objectType === "mannequin2" ||
    objectType === "mannequin3"
  ) {
    return MANNEQUIN_RENDER_HEIGHT;
  }
  if (objectType === "cart1" || objectType === "cart2") return CART_RENDER_HEIGHT;
  if (objectType === "retailcase1" || objectType === "retailcase2") {
    return RETAIL_CASE_RENDER_HEIGHT;
  }
  if (objectType === "superfridge1") return SUPERFRIDGE_RENDER_HEIGHT;
  if (objectType === "hospitalbed") return HOSPITALBED_RENDER_HEIGHT;
  if (objectType === "hospitalbed2" || objectType === "hospitalbed3") {
    return HOSPITALBED_OCCUPIED_RENDER_HEIGHT;
  }
  if (objectType === "motelbed") return MOTELBED_RENDER_HEIGHT;
  if (objectType === "counter") return COUNTER_RENDER_HEIGHT;
  if (objectType === "minifridge") return MINIFRIDGE_RENDER_HEIGHT;
  if (objectType === "dinnertable") return DINNERTABLE_RENDER_HEIGHT;
  if (objectType === "camptable") return DINNERTABLE_RENDER_HEIGHT;
  if (
    objectType === "canteentable1" ||
    objectType === "canteentable2" ||
    objectType === "canteentable3" ||
    objectType === "canteentable4"
  ) {
    return CANTEENTABLE_RENDER_HEIGHT;
  }
  if (objectType === "militarybed") return BED_RENDER_HEIGHT;
  if (objectType === "campchair") return CAMPCHAIR_RENDER_HEIGHT;
  if (objectType === "canteenchair") return CANTEENCHAIR_RENDER_HEIGHT;
  if (objectType === "footlocker") return FOOTLOCKER_RENDER_HEIGHT;
  if (objectType === "kitbag") return KITBAG_RENDER_HEIGHT;
  if (objectType === "militarybasket") return MILITARYBASKET_RENDER_HEIGHT;
  if (objectType === "lantern1") return TRASHCAN_RENDER_HEIGHT;
  if (objectType === "range") return RANGE_RENDER_HEIGHT;
  if (objectType === "hotdisplay") return COUNTER_RENDER_HEIGHT;
  if (objectType === "drinkdisplay") return DRINKDISPLAY_RENDER_HEIGHT;
  if (objectType === "bagchair") return BAGCHAIR_RENDER_HEIGHT;
  if (objectType === "armchair") return ARMCHAIR_RENDER_HEIGHT;
  if (objectType === "sofa") return SOFA_RENDER_HEIGHT;
  if (objectType === "groundbackpack") return GROUNDBACKPACK_RENDER_HEIGHT;
  if (objectType === "ivstand") return IVSTAND_RENDER_HEIGHT;
  if (objectType === "medicalcart") return MEDICALCART_RENDER_HEIGHT;
  if (objectType === "medicalreception") return MEDICALRECEPTION_RENDER_HEIGHT;
  if (objectType === "medicaldrawers") return MEDICALDRAWERS_RENDER_HEIGHT;
  if (
    objectType === "threeseater" ||
    objectType === "threeseater2" ||
    objectType === "threeseater3"
  ) {
    return THREESEATER_RENDER_HEIGHT;
  }
  if (objectType === "conferencetable") return CONFERENCE_RENDER_HEIGHT;
  if (objectType === "copier") return COPIER_RENDER_HEIGHT;
  if (objectType === "officechair") return OFFICECHAIR_RENDER_HEIGHT;
  if (objectType === "whiteboard") return WHITEBOARD_RENDER_HEIGHT;
  return FURNITURE_RENDER_HEIGHT;
}

function furnitureBottomPad(objectType: string): number {
  if (objectType === "desk") return DESK_BOTTOM_PAD;
  if (objectType === "desk3") return DESK3_BOTTOM_PAD;
  if (objectType === "stairs") return STAIRS_BOTTOM_PAD;
  if (objectType === "desk2") return DESK2_BOTTOM_PAD;
  if (objectType === "bigshelf") return BIGSHELF_BOTTOM_PAD;
  if (objectType === "bigbox") return BIGBOX_BOTTOM_PAD;
  if (objectType === "watercontainer") return WATERCONTAINER_BOTTOM_PAD;
  if (objectType === "bed") return BED_BOTTOM_PAD;
  if (objectType === "cabinet") return CABINET_BOTTOM_PAD;
  if (objectType === "bookshelf") return BOOKSHELF_BOTTOM_PAD;
  if (objectType === "bookshelf2") return BOOKSHELF2_BOTTOM_PAD;
  if (objectType === "lockers") return LOCKERS_BOTTOM_PAD;
  if (objectType === "dresser") return DRESSER_BOTTOM_PAD;
  if (objectType === "fridge") return FRIDGE_BOTTOM_PAD;
  if (objectType === "guncabinet") return GUNCABINET_BOTTOM_PAD;
  if (objectType === "drawers") return DRAWERS_BOTTOM_PAD;
  if (objectType === "kitchensink") return KITCHENSINK_BOTTOM_PAD;
  if (objectType === "workbench") return WORKBENCH_BOTTOM_PAD;
  if (objectType === "nightstand") return NIGHTSTAND_BOTTOM_PAD;
  if (objectType === "suitcase") return SUITCASE_BOTTOM_PAD;
  if (objectType === "watercooler") return WATERCOOLER_BOTTOM_PAD;
  if (objectType === "trashcan") return TRASHCAN_BOTTOM_PAD;
  if (objectType === "checkout") return CHECKOUT_BOTTOM_PAD;
  if (objectType === "supershelf1" || objectType === "supershelf2") {
    return SUPERSHELF_BOTTOM_PAD;
  }
  if (
    objectType === "retailshelf1" ||
    objectType === "retailshelf2" ||
    objectType === "retailshelf3"
  ) {
    return SUPERSHELF_BOTTOM_PAD;
  }
  if (
    objectType === "clothingrack1" ||
    objectType === "clothingrack2" ||
    objectType === "clothingrack3"
  ) {
    return CLOTHING_RACK_BOTTOM_PAD;
  }
  if (objectType === "cart1" || objectType === "cart2") return CART_BOTTOM_PAD;
  if (objectType === "retailcase1" || objectType === "retailcase2") {
    return RETAIL_CASE_BOTTOM_PAD;
  }
  if (objectType === "superfridge1") return SUPERFRIDGE_BOTTOM_PAD;
  if (objectType === "hospitalbed") return HOSPITALBED_BOTTOM_PAD;
  if (objectType === "hospitalbed2" || objectType === "hospitalbed3") {
    return HOSPITALBED_OCCUPIED_BOTTOM_PAD;
  }
  if (objectType === "motelbed") return MOTELBED_BOTTOM_PAD;
  if (objectType === "counter") return COUNTER_BOTTOM_PAD;
  if (objectType === "minifridge") return 0;
  if (objectType === "dinnertable") return DINNERTABLE_BOTTOM_PAD;
  if (objectType === "camptable") return DINNERTABLE_BOTTOM_PAD;
  if (
    objectType === "canteentable1" ||
    objectType === "canteentable2" ||
    objectType === "canteentable3" ||
    objectType === "canteentable4"
  ) {
    return CANTEENTABLE_BOTTOM_PAD;
  }
  if (objectType === "militarybed") return MILITARYBED_BOTTOM_PAD;
  if (objectType === "footlocker") return FOOTLOCKER_BOTTOM_PAD;
  if (objectType === "kitbag") return KITBAG_BOTTOM_PAD;
  if (objectType === "militarybasket") return MILITARYBASKET_BOTTOM_PAD;
  if (objectType === "lantern1") return LANTERN_BOTTOM_PAD;
  if (objectType === "range") return RANGE_BOTTOM_PAD;
  if (objectType === "hotdisplay") return HOTDISPLAY_BOTTOM_PAD;
  if (objectType === "drinkdisplay") return DRINKDISPLAY_BOTTOM_PAD;
  if (objectType === "campchair") return CAMPCHAIR_BOTTOM_PAD;
  if (objectType === "canteenchair") return CANTEENCHAIR_BOTTOM_PAD;
  if (objectType === "groundbackpack") return GROUNDBACKPACK_BOTTOM_PAD;
  if (objectType === "ivstand") return IVSTAND_BOTTOM_PAD;
  if (objectType === "medicalcart") return MEDICALCART_BOTTOM_PAD;
  if (objectType === "medicalreception") return MEDICALRECEPTION_BOTTOM_PAD;
  if (objectType === "medicaldrawers") return MEDICALDRAWERS_BOTTOM_PAD;
  if (
    objectType === "threeseater" ||
    objectType === "threeseater2" ||
    objectType === "threeseater3"
  ) {
    return THREESEATER_BOTTOM_PAD;
  }
  if (objectType === "sofa") return SOFA_BOTTOM_PAD;
  if (objectType === "vendingmachine") return VENDINGMACHINE_BOTTOM_PAD;
  if (objectType === "furnace") return FURNACE1_BOTTOM_PAD;
  if (objectType === "mantel") return MANTEL1_BOTTOM_PAD;
  if (objectType === "conferencetable") return CONFERENCE_BOTTOM_PAD;
  if (objectType === "copier") return COPIER_BOTTOM_PAD;
  if (objectType === "whiteboard") return WHITEBOARD_BOTTOM_PAD;
  return 0;
}

type ObjectSprite =
  | Phaser.GameObjects.Image
  | Phaser.GameObjects.Sprite
  | Phaser.GameObjects.Graphics;

type WallSpriteEntry = {
  x: number;
  y: number;
  /** "both" when the tile carries two runs and shares one Graphics object. */
  axis: "ns" | "ew" | "both";
  depth: number;
  graphics: Phaser.GameObjects.Graphics | Phaser.GameObjects.Image;
  plywood: boolean;
};

export class InteriorView {
  private floorSprites: Phaser.GameObjects.GameObject[] = [];
  private wallSprites: Phaser.GameObjects.GameObject[] = [];
  private wallEntries: WallSpriteEntry[] = [];
  /** Full interior wall occupancy — needed to redraw faded cubicle shells. */
  private partitionWallSet = new Set<string>();
  /**
   * Single render-texture for the active cubicle fade. Segments are stamped
   * opaque first, then the texture is alpha'd once — avoids double-blend seams
   * at partition joins (Graphics setAlpha applies per fill command).
   */
  private fadeComposite: Phaser.GameObjects.RenderTexture | null = null;
  /** Hospital cubicles + motel room bays — SW/SE faces fade while inside. */
  private fadeCubicles: Array<
    HospitalCubicle | MotelRoom | HouseRoom | OfficeMeetingRoom
  > = [];
  /** Last cubicle fade key — skip redundant rebuild when tile unchanged. */
  private lastCubicleFadeKey = "";
  private objectSprites = new Map<string, ObjectSprite>();
  private lanternIds = new Set<string>();
  /** Campchair tiles currently occupied by a sitting guard (Sit frame includes the chair). */
  private occupiedCampchairTiles: ReadonlySet<string> = new Set();
  /** Floor-bag tile coords — refreshed with placeable depths when walls change. */
  private groundBagTiles = new Map<string, { x: number; y: number }>();
  /** Last known searched flag per searchable — drives search anim transitions. */
  private searchedState = new Map<string, boolean>();
  /** Last known in-progress search per searchable (opens the sheet during the channel). */
  private searchingState = new Map<string, boolean>();
  private highlightGraphics: Phaser.GameObjects.Graphics | null = null;
  private buildGhostGraphics: Phaser.GameObjects.Graphics | null = null;
  private buildGhostWall: Phaser.GameObjects.Image | null = null;
  private buildGhostWallSig = "";
  private buildGhostFireplace: Phaser.GameObjects.Sprite | null = null;
  private buildGhostStorageBox: Phaser.GameObjects.Sprite | null = null;
  private buildGhostFence: Phaser.GameObjects.Image | null = null;
  /** Persistent un-built prefab ghosts (translucent), keyed by "x,y". */
  private prefabGhostGraphics = new Map<string, Phaser.GameObjects.Graphics>();
  private prefabGhostWalls = new Map<string, Phaser.GameObjects.Image>();
  private prefabGhostWallSig = new Map<string, string>();
  private prefabGhostFireplaces = new Map<string, Phaser.GameObjects.Sprite>();
  private prefabGhostStorageBoxes = new Map<string, Phaser.GameObjects.Sprite>();
  private prefabGhostFences = new Map<string, Phaser.GameObjects.Image>();
  /**
   * Prefab wall/door tiles counted for partition adjacency so solid walls keep
   * the same facing as their ghost row until neighbors finish building.
   */
  private prefabPartitionKeys = new Set<string>();
  /** Admin-placed walls layered on top of procedural generation. */
  private extraWalls: InteriorWallTile[] = [];
  /** Persistent player-built walls layered on top of procedural generation. */
  private structureWalls: InteriorWallTile[] = [];
  /** Persistent player-built doors — rendered as leaves, not solid partitions. */
  private extraDoors: InteriorDoorTile[] = [];
  /**
   * House room doors baked as Images (geometric leaf + InternalDoor1 painted
   * on the main face). Keyed by "x,y". Player-built doors elsewhere keep the
   * plain Graphics wood leaf.
   */
  private internalDoorSprites = new Map<string, Phaser.GameObjects.Image>();
  /** Dynamic canvas textures backing {@link internalDoorSprites}. */
  private internalDoorTextureKeys = new Map<string, string>();
  /** Persistent player-built fireplaces — furniture sprites, not partitions. */
  private fireplaces: InteriorFireplaceTile[] = [];
  private fireplaceSprites = new Map<string, Phaser.GameObjects.Sprite>();
  private storageBoxes: {
    x: number;
    y: number;
    ownerWallet: string;
    kind: string;
  }[] = [];
  private storageBoxSprites = new Map<string, Phaser.GameObjects.Sprite>();
  private fireplaceExpireEvents = new Map<string, Phaser.Time.TimerEvent>();
  /** Furnaces and house mantels currently drawn, keyed by searchable id. */
  private furnaceTiles = new Map<
    string,
    {
      x: number;
      y: number;
      w: number;
      h: number;
      activeUntil: number;
      objectType: string;
      facing: string;
    }
  >();
  private furnaceVisualUntil = new Map<string, number>();
  private furnaceExpireEvents = new Map<string, Phaser.Time.TimerEvent>();
  private fences: InteriorFenceTile[] = [];
  private fenceSprites = new Map<string, Phaser.GameObjects.Image>();
  private fenceCorners: InteriorFenceCornerTile[] = [];
  private fenceCornerSprites = new Map<string, Phaser.GameObjects.Image>();
  /**
   * Optional depth resolver for player-built placeables (fireplaces, …).
   * When set, matches living-entity wall occlusion instead of raw furniture depth.
   */
  private placeableDepthResolver:
    | ((tx: number, ty: number) => number)
    | null = null;
  /**
   * Optional depth resolver for floor bags. When set, matches corpse/entity
   * wall occlusion so bags cannot paint over players south of them.
   */
  private groundBagDepthResolver:
    | ((tx: number, ty: number) => number)
    | null = null;
  private visible = false;
  private buildingX = 0;
  private buildingY = 0;
  /** Current interior tile dimensions (2× the exterior footprint). */
  private iW = 4;
  private iH = 4;
  /** 0 is the ground floor. Upper floors are an empty shell. */
  private floorLevel = 0;
  /** Furniture currently drawn in this interior. Used to cut stair holes upstairs. */
  private syncedSearchables: SearchableVisual[] = [];
  /** Stair tiles omitted from the last upper-floor bake, so it is not rebaked every frame. */
  private stairHoleKey = "";

  constructor(private scene: Phaser.Scene) {}

  /**
   * Wire placeable depth to the scene's entity/wall occlusion helper so
   * fireplaces (and future props) sort like players next to partitions.
   */
  setPlaceableDepthResolver(fn: ((tx: number, ty: number) => number) | null) {
    this.placeableDepthResolver = fn;
    this.refreshPlaceableDepths();
  }

  setGroundBagDepthResolver(fn: ((tx: number, ty: number) => number) | null) {
    this.groundBagDepthResolver = fn;
    this.refreshPlaceableDepths();
  }

  /**
   * Lit fireplaces currently shown in this interior. `x,y` are sprite screen
   * positions (iso), used as night light origins.
   */
  /**
   * Floor lanterns in this interior. `x,y` are screen positions near the
   * flame, used as night light origins.
   */
  forEachLantern(cb: (x: number, y: number) => void) {
    if (!this.visible) return;
    for (const id of this.lanternIds) {
      const sprite = this.objectSprites.get(id);
      if (!sprite || !("x" in sprite) || !sprite.visible) continue;
      const height = "displayHeight" in sprite ? sprite.displayHeight : 0;
      cb(sprite.x, sprite.y - height * 0.62);
    }
  }

  forEachLitFireplace(
    nowMs: number,
    cb: (x: number, y: number) => void,
  ) {
    if (!this.visible) return;
    for (const tile of this.fireplaces) {
      if (nowMs >= tile.activeUntil) continue;
      const sprite = this.fireplaceSprites.get(`${tile.x},${tile.y}`);
      if (!sprite?.visible) continue;
      cb(sprite.x, sprite.y - sprite.displayHeight * 0.45);
    }
    for (const [id, tile] of this.furnaceTiles) {
      if (nowMs >= tile.activeUntil) continue;
      const sprite = this.objectSprites.get(id);
      if (!sprite || !("visible" in sprite) || !sprite.visible) continue;
      if (!("x" in sprite) || !("displayHeight" in sprite)) continue;
      const lift = tile.objectType === "mantel" ? 0.32 : 0.45;
      cb(sprite.x, sprite.y - sprite.displayHeight * lift);
    }
  }

  /** True when a lit fireplace is on or adjacent to this interior tile. */
  isNearLitFireplace(tx: number, ty: number, nowMs: number): boolean {
    if (!this.visible) return false;
    for (const tile of this.fireplaces) {
      if (nowMs >= tile.activeUntil) continue;
      if (Math.max(Math.abs(tile.x - tx), Math.abs(tile.y - ty)) <= 1) {
        return true;
      }
    }
    for (const tile of this.furnaceTiles.values()) {
      if (nowMs >= tile.activeUntil) continue;
      if (this.hearthNear(tile, tx, ty)) return true;
    }
    return false;
  }

  /** Re-clamp every placeable sprite after walls/doors change. */
  refreshPlaceableDepths() {
    if (!this.visible) return;
    for (const tile of this.fireplaces) {
      const sprite = this.fireplaceSprites.get(`${tile.x},${tile.y}`);
      if (!sprite) continue;
      sprite.setDepth(this.placeableDepthAt(tile.x, tile.y));
    }
    for (const tile of this.fences) {
      const sprite = this.fenceSprites.get(`${tile.x},${tile.y}`);
      if (!sprite) continue;
      sprite.setDepth(chainLinkFenceSortDepth(tile.x, tile.y, tile.facing));
    }
    for (const tile of this.fenceCorners) {
      const sprite = this.fenceCornerSprites.get(`${tile.x},${tile.y}`);
      if (!sprite) continue;
      sprite.setDepth(chainLinkFenceCornerSortDepth(tile.x, tile.y));
    }
    for (const [id, tile] of this.groundBagTiles) {
      const sprite = this.objectSprites.get(id);
      if (!sprite || !("setDepth" in sprite)) continue;
      sprite.setDepth(this.groundBagDepthAt(tile.x, tile.y));
    }
  }

  private placeableDepthAt(tx: number, ty: number): number {
    if (this.placeableDepthResolver) return this.placeableDepthResolver(tx, ty);
    return interiorFurnitureDepth(tx, ty);
  }

  private groundBagDepthAt(tx: number, ty: number): number {
    return (
      this.groundBagDepthResolver?.(tx, ty) ??
      this.placeableDepthResolver?.(tx, ty) ??
      interiorFurnitureDepth(tx, ty)
    );
  }

  /**
   * Floor bags must share living-entity wall occlusion. Raw furniture depth
   * ignores partition clamps, so a refund bag on a former door tile can paint
   * over a player standing south of it.
   */
  private searchableDepth(item: SearchableVisual): number {
    if (item.objectType === "groundbackpack") {
      return this.groundBagDepthAt(item.x, item.y);
    }
    // Upper-floor stairs sit under the carpet so the flight reads as a hole.
    if (item.objectType === "stairs" && this.floorLevel > 0) {
      return interiorFloorDepth(0, 0) - 2;
    }
    const { w, h } = searchableFootprint(item);
    return (
      interiorFurnitureDepth(item.x + w - 1, item.y + h - 1) +
      interiorFurnitureDepthBias(item.objectType)
    );
  }

  show(buildingX: number, buildingY: number) {
    if (this.visible && this.buildingX === buildingX && this.buildingY === buildingY) {
      return;
    }
    this.hide();
    this.visible = true;
    this.buildingX = buildingX;
    this.buildingY = buildingY;
    this.floorLevel = 0;
    const dims = interiorDimensions(buildingX, buildingY);
    this.iW = dims.iW;
    this.iH = dims.iH;
    this.fadeCubicles = this.groundFadeCubicles();
    this.drawFloor();
    this.drawWalls();
  }

  /** Redraw the shell when the player changes storey. Same building, no enter fade. */
  setFloorLevel(level: number) {
    const next = level > 0 ? level : 0;
    if (this.floorLevel === next) return;
    this.floorLevel = next;
    if (!this.visible) return;
    for (const sprite of this.floorSprites) sprite.destroy();
    this.floorSprites = [];
    this.clearWallSprites();
    this.clearInternalDoorSprites();
    this.clearFadeComposite();
    this.lastCubicleFadeKey = "";
    this.fadeCubicles = next > 0 ? [] : this.groundFadeCubicles();
    this.drawFloor();
    this.drawWalls();
    this.stairHoleKey = this.stairHoleSignature();
    this.applySearchableDepths();
  }

  private groundFadeCubicles(): Array<
    HospitalCubicle | MotelRoom | HouseRoom | OfficeMeetingRoom
  > {
    const officeRoom = officeMeetingRoomForBuilding(this.buildingX, this.buildingY);
    const managerRoom = officeManagerRoomForBuilding(this.buildingX, this.buildingY);
    return [
      ...hospitalCubiclesForBuilding(this.buildingX, this.buildingY),
      ...motelRoomsForBuilding(this.buildingX, this.buildingY),
      ...houseRoomsForBuilding(this.buildingX, this.buildingY),
      ...(officeRoom ? [officeRoom] : []),
      ...(managerRoom ? [managerRoom] : []),
    ];
  }

  /**
   * Replace admin-placed extras for the current building and redraw partitions.
   * Pass the full extra list for this building (not a delta).
   */
  setExtraWalls(walls: InteriorWallTile[]) {
    this.extraWalls = walls.map((w) => ({ x: w.x, y: w.y }));
    if (!this.visible) return;
    this.clearWallSprites();
    this.drawWalls();
    this.lastCubicleFadeKey = "";
  }

  /** Append one admin-placed wall and redraw (cheap enough for rare admin edits). */
  addExtraWall(x: number, y: number) {
    if (this.extraWalls.some((w) => w.x === x && w.y === y)) return;
    this.extraWalls.push({ x, y });
    if (!this.visible) return;
    this.clearWallSprites();
    this.drawWalls();
    this.lastCubicleFadeKey = "";
  }

  /**
   * Replace persistent player-built walls for the current building and redraw.
   * Pass the full list for this building (not a delta).
   */
  setStructureWalls(walls: InteriorWallTile[]) {
    this.structureWalls = walls.map((w) => ({ x: w.x, y: w.y }));
    if (!this.visible) return;
    this.clearWallSprites();
    this.drawWalls();
    this.lastCubicleFadeKey = "";
  }

  /** Append one persistent player-built wall and redraw. */
  addStructureWall(x: number, y: number) {
    if (this.structureWalls.some((w) => w.x === x && w.y === y)) return;
    this.structureWalls.push({ x, y });
    if (!this.visible) return;
    this.clearWallSprites();
    this.drawWalls();
    this.lastCubicleFadeKey = "";
  }

  /** Remove one persistent player-built wall and redraw. */
  removeStructureWall(x: number, y: number) {
    const before = this.structureWalls.length;
    this.structureWalls = this.structureWalls.filter((w) => w.x !== x || w.y !== y);
    if (this.structureWalls.length === before || !this.visible) return;
    this.clearWallSprites();
    this.drawWalls();
    this.lastCubicleFadeKey = "";
  }

  /** Replace all persistent doors for the current building and redraw. */
  setExtraDoors(doors: InteriorDoorTile[]) {
    this.extraDoors = doors.map((d) => ({ ...d }));
    if (!this.visible) return;
    this.clearWallSprites();
    this.drawWalls();
    this.lastCubicleFadeKey = "";
  }

  /** Insert or update one door's state and redraw. */
  upsertExtraDoor(door: InteriorDoorTile) {
    const idx = this.extraDoors.findIndex((d) => d.x === door.x && d.y === door.y);
    if (idx >= 0) this.extraDoors[idx] = { ...door };
    else this.extraDoors.push({ ...door });
    if (!this.visible) return;
    this.clearWallSprites();
    this.drawWalls();
    this.lastCubicleFadeKey = "";
  }

  /** Remove one persistent door and redraw. */
  removeExtraDoor(x: number, y: number) {
    const before = this.extraDoors.length;
    this.extraDoors = this.extraDoors.filter((d) => d.x !== x || d.y !== y);
    if (this.extraDoors.length === before || !this.visible) return;
    this.clearWallSprites();
    this.drawWalls();
    this.lastCubicleFadeKey = "";
  }

  getExtraDoors(): InteriorDoorTile[] {
    return this.extraDoors;
  }

  /** Replace all fireplaces for the current building and refresh sprites. */
  setFireplaces(tiles: InteriorFireplaceTile[]) {
    this.fireplaces = tiles.map((t) => ({ ...t }));
    this.syncFireplaceSprites();
  }

  /** Insert or update one fireplace and refresh its sprite. */
  upsertFireplace(tile: InteriorFireplaceTile) {
    const idx = this.fireplaces.findIndex((f) => f.x === tile.x && f.y === tile.y);
    if (idx >= 0) this.fireplaces[idx] = { ...tile };
    else this.fireplaces.push({ ...tile });
    this.upsertFireplaceSprite(tile);
  }

  /** Replace all storage boxes for the current building and refresh sprites. */
  setStorageBoxes(
    tiles: { x: number; y: number; ownerWallet: string; kind: string }[],
  ) {
    this.storageBoxes = tiles.map((t) => ({ ...t }));
    this.syncStorageBoxSprites();
  }

  /** Insert or update one storage box and refresh its sprite. */
  upsertStorageBox(tile: {
    x: number;
    y: number;
    ownerWallet: string;
    kind: string;
  }) {
    const idx = this.storageBoxes.findIndex((f) => f.x === tile.x && f.y === tile.y);
    if (idx >= 0) this.storageBoxes[idx] = { ...tile };
    else this.storageBoxes.push({ ...tile });
    this.upsertStorageBoxSprite(tile);
  }

  /** Remove one storage box sprite. */
  removeStorageBox(x: number, y: number) {
    this.storageBoxes = this.storageBoxes.filter((f) => f.x !== x || f.y !== y);
    const key = `${x},${y}`;
    this.storageBoxSprites.get(key)?.destroy();
    this.storageBoxSprites.delete(key);
  }

  /** Remove one fireplace sprite. */
  removeFireplace(x: number, y: number) {
    this.fireplaces = this.fireplaces.filter((f) => f.x !== x || f.y !== y);
    const key = `${x},${y}`;
    this.fireplaceExpireEvents.get(key)?.remove(false);
    this.fireplaceExpireEvents.delete(key);
    this.fireplaceSprites.get(key)?.destroy();
    this.fireplaceSprites.delete(key);
  }

  /** Replace all player-built fences for the current building. */
  setFences(tiles: InteriorFenceTile[]) {
    this.fences = tiles.map((t) => ({ ...t }));
    this.syncFenceSprites();
  }

  /** Insert or update one fence and refresh its sprite. */
  upsertFence(tile: InteriorFenceTile) {
    const idx = this.fences.findIndex((f) => f.x === tile.x && f.y === tile.y);
    if (idx >= 0) this.fences[idx] = { ...tile };
    else this.fences.push({ ...tile });
    this.upsertFenceSprite(tile);
  }

  /** Remove one fence sprite. */
  removeFence(x: number, y: number) {
    this.fences = this.fences.filter((f) => f.x !== x || f.y !== y);
    const key = `${x},${y}`;
    this.fenceSprites.get(key)?.destroy();
    this.fenceSprites.delete(key);
  }

  /** Replace all player-built barbed-wire corner posts for the current building. */
  setFenceCorners(tiles: InteriorFenceCornerTile[]) {
    this.fenceCorners = tiles.map((t) => ({ ...t }));
    this.syncFenceCornerSprites();
  }

  upsertFenceCorner(tile: InteriorFenceCornerTile) {
    const idx = this.fenceCorners.findIndex((f) => f.x === tile.x && f.y === tile.y);
    if (idx >= 0) this.fenceCorners[idx] = { ...tile };
    else this.fenceCorners.push({ ...tile });
    this.upsertFenceCornerSprite(tile);
  }

  removeFenceCorner(x: number, y: number) {
    this.fenceCorners = this.fenceCorners.filter((f) => f.x !== x || f.y !== y);
    const key = `${x},${y}`;
    this.fenceCornerSprites.get(key)?.destroy();
    this.fenceCornerSprites.delete(key);
  }

  /**
   * Solid chain-link mesh under a world point. Corner art is larger than its
   * 1×1 occupancy, so iso tile picks miss the post and land on neighbouring
   * floor. Prefab ghosts are ignored (walk-through, same as 3×1 panels).
   */
  pickSolidFenceBlockerAtWorld(
    worldX: number,
    worldY: number,
    clickTX: number,
    clickTY: number,
  ): { x: number; y: number } | null {
    const candidates: { image: Phaser.GameObjects.Image; x: number; y: number }[] =
      [];
    for (const tile of this.fenceCorners) {
      const image = this.fenceCornerSprites.get(`${tile.x},${tile.y}`);
      if (!image) continue;
      candidates.push({ image, x: tile.x, y: tile.y });
    }
    for (const tile of this.fences) {
      const image = this.fenceSprites.get(`${tile.x},${tile.y}`);
      if (!image) continue;
      const occ = nearestManhattanTile(
        structureOccupiedTiles({
          kind: tile.kind ?? "fence",
          x: tile.x,
          y: tile.y,
          facing: tile.facing,
        }),
        clickTX,
        clickTY,
      );
      candidates.push({ image, x: occ.x, y: occ.y });
    }
    return pickTopOpaqueImageAtWorld(worldX, worldY, candidates);
  }

  /** Merged procedural + admin + persistent-structure walls (doors count as wall presence too, for run adjacency). */
  getMergedWalls(): InteriorWallTile[] {
    if (this.floorLevel > 0) return [];
    const base = interiorWallsForBuilding(this.buildingX, this.buildingY);
    const seen = new Set(base.map((w) => `${w.x},${w.y}`));
    const out = [...base];
    const addIfNew = (w: { x: number; y: number }) => {
      const key = `${w.x},${w.y}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ x: w.x, y: w.y });
    };
    for (const w of this.extraWalls) addIfNew(w);
    for (const w of this.structureWalls) addIfNew(w);
    for (const d of this.extraDoors) addIfNew(d);
    return out;
  }

  hide() {
    this.visible = false;
    this.floorLevel = 0;
    this.syncedSearchables = [];
    this.stairHoleKey = "";
    const floorTexKey = interiorFloorTextureKey(this.buildingX, this.buildingY);
    for (const sprite of this.floorSprites) sprite.destroy();
    this.floorSprites = [];
    this.clearFadeComposite();
    this.clearWallSprites();
    this.fadeCubicles = [];
    this.lastCubicleFadeKey = "";
    this.extraWalls = [];
    this.structureWalls = [];
    this.extraDoors = [];
    this.clearInternalDoorSprites();
    this.clearFireplaces();
    this.clearStorageBoxes();
    this.clearFurnaceRuntime();
    this.clearFences();
    this.clearFenceCorners();
    this.clearBuildGhost();
    this.clearPrefabGhosts();
    if (this.scene.textures.exists(floorTexKey)) {
      this.scene.textures.remove(floorTexKey);
    }
    for (const sprite of this.objectSprites.values()) sprite.destroy();
    this.objectSprites.clear();
    this.lanternIds.clear();
    this.groundBagTiles.clear();
    this.searchedState.clear();
    this.searchingState.clear();
    this.highlightGraphics?.destroy();
    this.highlightGraphics = null;
  }

  private clearWallSprites() {
    for (const sprite of this.wallSprites) {
      destroyPartitionDisplay(this.scene, sprite);
    }
    this.wallSprites = [];
    this.wallEntries = [];
    this.partitionWallSet = new Set();
    // Door sprites are rebuilt from extraDoors at the end of drawWalls.
    this.clearInternalDoorSprites();
  }

  private clearInternalDoorSprites() {
    for (const sprite of this.internalDoorSprites.values()) sprite.destroy();
    this.internalDoorSprites.clear();
    for (const texKey of this.internalDoorTextureKeys.values()) {
      if (this.scene.textures.exists(texKey)) this.scene.textures.remove(texKey);
    }
    this.internalDoorTextureKeys.clear();
  }

  /**
   * Fade SW/SE partition faces of the hospital cubicle / motel room the player
   * is in (or standing on its entrance tile). Restores opacity when they leave.
   */
  updateCubicleWallFade(playerTX: number, playerTY: number) {
    if (!this.visible || this.fadeCubicles.length === 0) return;

    const cubicle =
      this.fadeCubicles.find(
        (c) =>
          (playerTX === c.entranceX && playerTY === c.entranceY) ||
          (playerTX >= c.x0 &&
            playerTX <= c.x1 &&
            playerTY >= c.y0 &&
            playerTY <= c.y1),
      ) ?? null;
    const fadeKey = cubicle
      ? `${cubicle.facing}:${cubicle.entranceX},${cubicle.entranceY}`
      : "";
    if (fadeKey === this.lastCubicleFadeKey) return;
    this.lastCubicleFadeKey = fadeKey;

    this.clearFadeComposite();

    const fadeSet = cubicle
      ? new Set(cubicle.wallTiles.map((w) => `${w.x},${w.y}`))
      : null;

    // House InternalDoor1 at this bay's entrance fades with the shell.
    for (const [key, sprite] of this.internalDoorSprites) {
      const fadeDoor =
        !!cubicle && key === `${cubicle.entranceX},${cubicle.entranceY}`;
      sprite.setAlpha(fadeDoor ? CUBICLE_WALL_FADE_ALPHA : 1);
    }

    if (!fadeSet) {
      for (const entry of this.wallEntries) {
        entry.graphics.setVisible(true);
        entry.graphics.setAlpha(1);
      }
      return;
    }

    const faded: WallSpriteEntry[] = [];
    let maxDepth = Number.NEGATIVE_INFINITY;
    for (const entry of this.wallEntries) {
      if (fadeSet.has(`${entry.x},${entry.y}`)) {
        if (entry.plywood) {
          entry.graphics.setVisible(true);
          entry.graphics.setAlpha(CUBICLE_WALL_FADE_ALPHA);
        } else {
          entry.graphics.setVisible(false);
          faded.push(entry);
        }
        maxDepth = Math.max(maxDepth, entry.depth);
      } else {
        entry.graphics.setVisible(true);
        entry.graphics.setAlpha(1);
      }
    }
    if (faded.length === 0) return;

    // Paint low→high depth so corner bias still wins within the composite.
    faded.sort((a, b) => a.depth - b.depth);
    const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
    for (const entry of faded) {
      const door = this.extraDoors.find((d) => d.x === entry.x && d.y === entry.y);
      drawWallTile(
        g,
        entry.x,
        entry.y,
        this.partitionWallSet,
        entry.axis,
        door,
        entry.plywood ? PLAYER_WALL_STYLE : this.partitionWallColors(),
      );
    }

    // Iso bounds of faded tiles (include raised wall tops).
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const pad = TILE_WIDTH + PARTITION_HEIGHT;
    for (const entry of faded) {
      const iso = cartesianToIso(entry.x + 0.5, entry.y + 0.5);
      minX = Math.min(minX, iso.x - pad);
      maxX = Math.max(maxX, iso.x + pad);
      minY = Math.min(minY, iso.y - pad);
      maxY = Math.max(maxY, iso.y + pad);
    }
    minX = Math.floor(minX);
    minY = Math.floor(minY);
    maxX = Math.ceil(maxX);
    maxY = Math.ceil(maxY);
    const width = Math.max(1, maxX - minX);
    const height = Math.max(1, maxY - minY);

    const rt = this.scene.add.renderTexture(minX, minY, width, height);
    rt.setOrigin(0, 0);
    rt.draw(g, -minX, -minY);
    g.destroy();
    rt.setDepth(maxDepth);
    rt.setAlpha(CUBICLE_WALL_FADE_ALPHA);
    this.fadeComposite = rt;
  }

  private clearFadeComposite() {
    this.fadeComposite?.destroy();
    this.fadeComposite = null;
  }

  /**
   * Player walls and doors near a clicked floor tile. The click outline mask
   * uses these so the diamond stays visible across the wall, same as a building.
   */
  playerWallOccludersNear(tileX: number, tileY: number): PlayerWallOccluder[] {
    const reach = PLAYER_WALL_OCCLUSION_REACH;
    const out: PlayerWallOccluder[] = [];
    const doors = new Map(this.extraDoors.map((d) => [`${d.x},${d.y}`, d]));
    for (const entry of this.wallEntries) {
      if (Math.abs(entry.x - tileX) > reach || Math.abs(entry.y - tileY) > reach) {
        continue;
      }
      if (!entry.graphics.visible) continue;
      const door = doors.get(`${entry.x},${entry.y}`);
      if (door) {
        out.push({
          kind: "door",
          x: entry.x,
          y: entry.y,
          axis: entry.axis,
          isOpen: door.isOpen,
          depth: entry.depth,
        });
        continue;
      }
      if (!entry.plywood) continue;
      out.push({
        kind: "wall",
        x: entry.x,
        y: entry.y,
        axis: entry.axis,
        depth: entry.depth,
        wallSet: this.partitionWallSet,
      });
    }
    return out;
  }

  /** Draws a diamond outline on a tile. Pass null to clear. */
  highlightTile(
    tx: number | null,
    ty: number | null,
    color = 0xffee44,
    alpha = 0.9,
  ) {
    if (tx === null || ty === null) {
      this.highlightGraphics?.clear();
      return;
    }
    if (!this.highlightGraphics) {
      this.highlightGraphics = this.scene.add.graphics();
    }
    // Ground-indicator band — above floor, behind furniture.
    this.highlightGraphics.setDepth(tileIndicatorDepth(tx, ty));
    strokeIsoTileOutline(this.highlightGraphics, tx, ty, color, alpha);
  }

  /**
   * See-through partition / fireplace ghost at the cursor tile for /build mode.
   * Pass null to clear. When `valid`, also draws a green tile outline.
   * `kind` picks wall vs. door leaf vs. Fireplace1_Active_SE_0001 ghost.
   */
  setBuildGhost(
    tx: number | null,
    ty: number | null,
    valid = false,
    kind: StructureBuildKind | "deconstruct" = "wall",
    facing: StructureFenceFacing = "SE",
  ) {
    if (tx === null || ty === null || !this.visible) {
      this.clearBuildGhost();
      this.highlightTile(null, null);
      return;
    }

    if (kind === "fence_corner") {
      this.highlightTile(tx, ty, valid ? 0x00ff88 : 0xff4444, valid ? 0.95 : 0.55);
      this.clearBuildGhostGraphics();
      this.buildGhostFireplace?.setVisible(false);
      this.buildGhostStorageBox?.setVisible(false);
      this.buildGhostFence?.setVisible(false);
      return;
    }

    if (isStructurePanelKind(kind)) {
      const { w, h } = structureFenceFootprint(facing);
      if (!this.highlightGraphics) {
        this.highlightGraphics = this.scene.add.graphics();
      }
      this.highlightGraphics.setDepth(tileIndicatorDepth(tx + w - 1, ty + h - 1));
      strokeIsoFootprintOutline(
        this.highlightGraphics,
        tx,
        ty,
        w,
        h,
        valid ? 0x00ff88 : 0xff4444,
        valid ? 0.95 : 0.55,
      );
      this.clearBuildGhostGraphics();
      this.buildGhostFireplace?.setVisible(false);
      this.buildGhostStorageBox?.setVisible(false);
      this.setFenceBuildGhost(tx, ty, facing, kind);
      return;
    }

    this.highlightTile(tx, ty, valid ? 0x00ff88 : 0xff4444, valid ? 0.95 : 0.55);

    if (kind === "deconstruct") {
      this.clearBuildGhostGraphics();
      this.buildGhostFireplace?.setVisible(false);
      this.buildGhostStorageBox?.setVisible(false);
      this.buildGhostFence?.setVisible(false);
      return;
    }

    if (kind === "fireplace") {
      this.clearBuildGhostGraphics();
      this.buildGhostFence?.setVisible(false);
      this.buildGhostStorageBox?.setVisible(false);
      this.setFireplaceBuildGhost(tx, ty);
      return;
    }

    if (isStorageBoxKind(kind)) {
      this.clearBuildGhostGraphics();
      this.buildGhostFireplace?.setVisible(false);
      this.buildGhostFence?.setVisible(false);
      this.setStorageBoxBuildGhost(tx, ty, kind);
      return;
    }

    this.buildGhostFireplace?.setVisible(false);
    this.buildGhostStorageBox?.setVisible(false);
    this.buildGhostFence?.setVisible(false);

    if (!this.buildGhostGraphics) {
      this.buildGhostGraphics = this.scene.add.graphics();
    }
    const g = this.buildGhostGraphics;
    g.clear();
    g.setAlpha(0.45);
    g.setDepth(interiorPartitionDepth(tx, ty, 2));
    const wallSet = new Set(this.partitionWallSet);
    wallSet.add(`${tx},${ty}`);
    const hasN = wallSet.has(`${tx},${ty - 1}`);
    const hasS = wallSet.has(`${tx},${ty + 1}`);
    const hasW = wallSet.has(`${tx - 1},${ty}`);
    const hasE = wallSet.has(`${tx + 1},${ty}`);
    const runNS = hasN || hasS;
    const runEW = hasW || hasE || (!hasN && !hasS);

    if (kind === "door") {
      this.buildGhostWall?.setVisible(false);
      drawInteriorDoorTile(g, tx, ty, runNS ? "ns" : "ew", false, false);
      return;
    }

    g.clear();
    const axis = runNS && runEW ? "both" : runNS ? "ns" : "ew";
    const sig = `${tx},${ty}:${axis}`;
    const depth = interiorPartitionDepth(tx, ty, 2);
    if (this.buildGhostWallSig === sig && this.buildGhostWall?.active) {
      this.buildGhostWall.setDepth(depth);
      this.buildGhostWall.setAlpha(0.45);
      this.buildGhostWall.setVisible(true);
      return;
    }
    this.buildGhostWallSig = sig;
    const display = createPlywoodPartition(
      this.scene,
      tx,
      ty,
      wallSet,
      axis,
      depth,
      0.45,
      "plywood-wall:ighost",
      this.buildGhostWall,
    );
    this.buildGhostWall = display instanceof Phaser.GameObjects.Image ? display : null;
  }

  private clearBuildGhostGraphics() {
    this.buildGhostGraphics?.clear();
    this.buildGhostWall?.setVisible(false);
  }

  private setFireplaceBuildGhost(tx: number, ty: number) {
    if (!textureKeyExists(this.scene, FIREPLACE1_INACTIVE_KEY)) {
      this.buildGhostFireplace?.setVisible(false);
      return;
    }
    const iso = cartesianToIso(tx + 0.5, ty + 0.5);
    const groundY = iso.y + TILE_HEIGHT / 2 + FIREPLACE1_BOTTOM_PAD;
    let sprite = this.buildGhostFireplace;
    if (!sprite) {
      sprite = addSpriteForKey(this.scene, iso.x, groundY, FIREPLACE1_INACTIVE_KEY);
      sprite.setOrigin(0.5, 1);
      sprite.setAlpha(0.45);
      this.buildGhostFireplace = sprite;
    } else {
      applyTextureKey(sprite, FIREPLACE1_INACTIVE_KEY);
      sprite.setPosition(iso.x, groundY);
    }
    this.fitInteriorSprite(sprite, FIREPLACE1_RENDER_HEIGHT);
    sprite.setDepth(this.placeableDepthAt(tx, ty));
    sprite.setVisible(true);
  }

  private setStorageBoxBuildGhost(tx: number, ty: number, kind: string) {
    const textureKey = storageBoxTextureKey(kind);
    if (!textureKeyExists(this.scene, textureKey)) {
      this.buildGhostStorageBox?.setVisible(false);
      return;
    }
    const iso = cartesianToIso(tx + 0.5, ty + 0.5);
    const groundY = iso.y + TILE_HEIGHT / 2 + this.storageBoxBottomPad(kind);
    let sprite = this.buildGhostStorageBox;
    if (!sprite) {
      sprite = addSpriteForKey(this.scene, iso.x, groundY, textureKey);
      sprite.setOrigin(0.5, 1);
      sprite.setAlpha(0.45);
      this.buildGhostStorageBox = sprite;
    }
    this.layoutStorageBoxGhost(sprite, tx, ty, kind);
    sprite.setAlpha(0.45);
    sprite.setVisible(true);
  }

  private setFenceBuildGhost(
    tx: number,
    ty: number,
    facing: StructureFenceFacing,
    kind: string = "fence",
  ) {
    const texKey = structurePanelTextureKey(kind, facing);
    if (!textureKeyExists(this.scene, texKey)) {
      this.buildGhostFence?.setVisible(false);
      return;
    }
    let image = this.buildGhostFence;
    if (!image) {
      image = addImageForKey(this.scene, 0, 0, texKey);
      this.buildGhostFence = image;
    } else {
      applyTextureKey(image, texKey);
    }
    layoutChainLinkFenceImage(image, tx, ty, facing, 0.45, kind);
    image.setDepth(chainLinkFenceSortDepth(tx, ty, facing));
    image.setVisible(true);
  }

  clearBuildGhost() {
    this.buildGhostGraphics?.destroy();
    this.buildGhostGraphics = null;
    if (this.buildGhostWall) destroyPartitionDisplay(this.scene, this.buildGhostWall);
    this.buildGhostWall = null;
    this.buildGhostWallSig = "";
    this.buildGhostFireplace?.destroy();
    this.buildGhostFireplace = null;
    this.buildGhostStorageBox?.destroy();
    this.buildGhostStorageBox = null;
    this.buildGhostFence?.destroy();
    this.buildGhostFence = null;
  }

  /**
   * Persistent ghost rendering for un-built prefab wall/door/fireplace tiles
   * in this building — same alpha'd art as the placement hover ghost, but one
   * per prefab tile and kept in sync with the server's prefab list.
   */
  setPrefabGhosts(
    tiles: {
      x: number;
      y: number;
      kind: StructureBuildKind;
      facing?: StructureFenceFacing | StructureFenceCorner;
    }[],
  ) {
    const want = new Set(tiles.map((t) => `${t.x},${t.y}`));
    for (const key of [...this.prefabGhostGraphics.keys()]) {
      if (!want.has(key)) this.dropPrefabGeom(key);
    }
    for (const key of [...this.prefabGhostWalls.keys()]) {
      if (!want.has(key)) this.dropPrefabWall(key);
    }
    for (const key of [...this.prefabGhostFireplaces.keys()]) {
      if (!want.has(key)) {
        this.prefabGhostFireplaces.get(key)?.destroy();
        this.prefabGhostFireplaces.delete(key);
      }
    }
    for (const key of [...this.prefabGhostStorageBoxes.keys()]) {
      if (!want.has(key)) {
        this.prefabGhostStorageBoxes.get(key)?.destroy();
        this.prefabGhostStorageBoxes.delete(key);
      }
    }
    for (const key of [...this.prefabGhostFences.keys()]) {
      if (!want.has(key)) {
        this.prefabGhostFences.get(key)?.destroy();
        this.prefabGhostFences.delete(key);
      }
    }

    // Fireplaces are props, not partitions — keep them out of wall adjacency.
    const nextPrefabPartitions = new Set<string>();
    for (const t of tiles) {
      if (t.kind === "wall" || t.kind === "door") {
        nextPrefabPartitions.add(`${t.x},${t.y}`);
      }
    }
    let prefabPartitionsChanged =
      nextPrefabPartitions.size !== this.prefabPartitionKeys.size;
    if (!prefabPartitionsChanged) {
      for (const key of nextPrefabPartitions) {
        if (!this.prefabPartitionKeys.has(key)) {
          prefabPartitionsChanged = true;
          break;
        }
      }
    }
    this.prefabPartitionKeys = nextPrefabPartitions;
    // Solid walls must re-resolve facing against remaining prefab neighbors.
    if (prefabPartitionsChanged && this.visible) {
      this.clearWallSprites();
      this.drawWalls();
      this.lastCubicleFadeKey = "";
    }

    const wallSet = new Set(this.partitionWallSet);
    for (const key of this.prefabPartitionKeys) wallSet.add(key);

    for (const t of tiles) {
      const key = `${t.x},${t.y}`;
      if (t.kind === "fireplace") {
        this.dropPrefabGeom(key);
        this.prefabGhostFences.get(key)?.destroy();
        this.prefabGhostFences.delete(key);
        this.prefabGhostStorageBoxes.get(key)?.destroy();
        this.prefabGhostStorageBoxes.delete(key);
        if (!textureKeyExists(this.scene, FIREPLACE1_INACTIVE_KEY)) continue;
        const iso = cartesianToIso(t.x + 0.5, t.y + 0.5);
        const groundY = iso.y + TILE_HEIGHT / 2 + FIREPLACE1_BOTTOM_PAD;
        let sprite = this.prefabGhostFireplaces.get(key);
        if (!sprite) {
          sprite = addSpriteForKey(
            this.scene,
            iso.x,
            groundY,
            FIREPLACE1_INACTIVE_KEY,
          );
          sprite.setOrigin(0.5, 1);
          sprite.setAlpha(0.45);
          this.prefabGhostFireplaces.set(key, sprite);
        } else {
          applyTextureKey(sprite, FIREPLACE1_INACTIVE_KEY);
          sprite.setPosition(iso.x, groundY);
        }
        this.fitInteriorSprite(sprite, FIREPLACE1_RENDER_HEIGHT);
        sprite.setDepth(this.placeableDepthAt(t.x, t.y));
        sprite.setVisible(this.visible);
        continue;
      }

      if (isStorageBoxKind(t.kind)) {
        this.dropPrefabGeom(key);
        this.prefabGhostFences.get(key)?.destroy();
        this.prefabGhostFences.delete(key);
        this.prefabGhostFireplaces.get(key)?.destroy();
        this.prefabGhostFireplaces.delete(key);
        const textureKey = storageBoxTextureKey(t.kind);
        if (!textureKeyExists(this.scene, textureKey)) continue;
        let sprite = this.prefabGhostStorageBoxes.get(key);
        if (!sprite) {
          const iso = cartesianToIso(t.x + 0.5, t.y + 0.5);
          const groundY = iso.y + TILE_HEIGHT / 2 + this.storageBoxBottomPad(t.kind);
          sprite = addSpriteForKey(this.scene, iso.x, groundY, textureKey);
          sprite.setOrigin(0.5, 1);
          sprite.setAlpha(0.45);
          this.prefabGhostStorageBoxes.set(key, sprite);
        }
        this.layoutStorageBoxGhost(sprite, t.x, t.y, t.kind);
        sprite.setAlpha(0.45);
        sprite.setVisible(this.visible);
        continue;
      }

      if (isStructurePanelKind(t.kind)) {
        this.dropPrefabGeom(key);
        this.prefabGhostFireplaces.get(key)?.destroy();
        this.prefabGhostFireplaces.delete(key);
        this.prefabGhostStorageBoxes.get(key)?.destroy();
        this.prefabGhostStorageBoxes.delete(key);
        const facing = parseStructureFenceFacing(t.facing);
        const texKey = structurePanelTextureKey(t.kind, facing);
        if (!textureKeyExists(this.scene, texKey)) continue;
        let image = this.prefabGhostFences.get(key);
        if (!image) {
          image = addImageForKey(this.scene, 0, 0, texKey);
          this.prefabGhostFences.set(key, image);
        } else {
          applyTextureKey(image, texKey);
        }
        layoutChainLinkFenceImage(image, t.x, t.y, facing, 0.45, t.kind);
        image.setDepth(chainLinkFenceSortDepth(t.x, t.y, facing));
        image.setVisible(this.visible);
        continue;
      }

      if (t.kind === "fence_corner") {
        this.dropPrefabGeom(key);
        this.prefabGhostFireplaces.get(key)?.destroy();
        this.prefabGhostFireplaces.delete(key);
        this.prefabGhostStorageBoxes.get(key)?.destroy();
        this.prefabGhostStorageBoxes.delete(key);
        const texKey = chainLinkFenceCornerTextureKey(
          parseStructureFenceCorner(t.facing),
        );
        if (!textureKeyExists(this.scene, texKey)) continue;
        let image = this.prefabGhostFences.get(key);
        if (!image) {
          image = addImageForKey(this.scene, 0, 0, texKey);
          this.prefabGhostFences.set(key, image);
        } else {
          applyTextureKey(image, texKey);
        }
        layoutChainLinkFenceCornerImage(
          image,
          t.x,
          t.y,
          parseStructureFenceCorner(t.facing),
          0.45,
        );
        image.setDepth(chainLinkFenceCornerSortDepth(t.x, t.y));
        image.setVisible(this.visible);
        continue;
      }

      this.prefabGhostFireplaces.get(key)?.destroy();
      this.prefabGhostFireplaces.delete(key);
      this.prefabGhostStorageBoxes.get(key)?.destroy();
      this.prefabGhostStorageBoxes.delete(key);
      this.prefabGhostFences.get(key)?.destroy();
      this.prefabGhostFences.delete(key);
      let g = this.prefabGhostGraphics.get(key);
      if (!g) {
        g = this.scene.add.graphics();
        this.prefabGhostGraphics.set(key, g);
      }
      g.clear();
      g.setAlpha(0.45);
      g.setDepth(interiorPartitionDepth(t.x, t.y, 2));
      g.setVisible(this.visible);
      const hasN = wallSet.has(`${t.x},${t.y - 1}`);
      const hasS = wallSet.has(`${t.x},${t.y + 1}`);
      const hasW = wallSet.has(`${t.x - 1},${t.y}`);
      const hasE = wallSet.has(`${t.x + 1},${t.y}`);
      const runNS = hasN || hasS;
      const runEW = hasW || hasE || (!hasN && !hasS);
      if (t.kind === "door") {
        this.dropPrefabWall(key);
        drawInteriorDoorTile(g, t.x, t.y, runNS ? "ns" : "ew", false, false);
      } else {
        g.clear();
        const axis = runNS && runEW ? "both" : runNS ? "ns" : "ew";
        const sig = `${hasN ? 1 : 0}${hasS ? 1 : 0}${hasE ? 1 : 0}${hasW ? 1 : 0}`;
        const depth = interiorPartitionDepth(t.x, t.y, 2);
        const prev = this.prefabGhostWalls.get(key);
        if (this.prefabGhostWallSig.get(key) === sig && prev?.active) {
          prev.setDepth(depth);
          prev.setAlpha(0.45);
          prev.setVisible(this.visible);
          continue;
        }
        this.prefabGhostWallSig.set(key, sig);
        const display = createPlywoodPartition(
          this.scene,
          t.x,
          t.y,
          wallSet,
          axis,
          depth,
          0.45,
          `plywood-wall:iprefab:${t.x},${t.y}`,
          prev ?? null,
        );
        if (display instanceof Phaser.GameObjects.Image) {
          this.prefabGhostWalls.set(key, display);
        } else {
          this.prefabGhostWalls.delete(key);
        }
      }
    }
  }

  private dropPrefabWall(key: string) {
    const wall = this.prefabGhostWalls.get(key);
    if (!wall) return;
    destroyPartitionDisplay(this.scene, wall);
    this.prefabGhostWalls.delete(key);
    this.prefabGhostWallSig.delete(key);
  }

  private dropPrefabGeom(key: string) {
    const g = this.prefabGhostGraphics.get(key);
    if (g) {
      g.destroy();
      this.prefabGhostGraphics.delete(key);
    }
    this.dropPrefabWall(key);
  }

  clearPrefabGhosts() {
    for (const g of this.prefabGhostGraphics.values()) g.destroy();
    this.prefabGhostGraphics.clear();
    for (const wall of this.prefabGhostWalls.values()) {
      destroyPartitionDisplay(this.scene, wall);
    }
    this.prefabGhostWalls.clear();
    this.prefabGhostWallSig.clear();
    for (const s of this.prefabGhostFireplaces.values()) s.destroy();
    this.prefabGhostFireplaces.clear();
    for (const s of this.prefabGhostStorageBoxes.values()) s.destroy();
    this.prefabGhostStorageBoxes.clear();
    for (const s of this.prefabGhostFences.values()) s.destroy();
    this.prefabGhostFences.clear();
    this.prefabPartitionKeys.clear();
  }

  /**
   * Topmost furniture sprite whose opaque pixels cover the world point.
   * Used so a click on tall wall art (furnaces) still selects that object
   * when the floor tile under the cursor is the wall behind it.
   */
  pickFurnitureIdAtWorld(worldX: number, worldY: number): string | null {
    let bestId: string | null = null;
    let bestDepth = -Infinity;
    for (const [id, sprite] of this.objectSprites) {
      if (sprite instanceof Phaser.GameObjects.Graphics) continue;
      if (!sprite.visible || !sprite.active) continue;
      if (!sprite.getBounds().contains(worldX, worldY)) continue;
      if (!spriteOpaqueAtWorldPoint(sprite, worldX, worldY)) continue;
      if (sprite.depth < bestDepth) continue;
      bestDepth = sprite.depth;
      bestId = id;
    }
    return bestId;
  }

  /** Draws a yellow outline around the hovered item's footprint. Pass null to clear. */
  setHoveredItem(id: string | null, items: SearchableVisual[]) {
    if (!id) {
      this.highlightGraphics?.clear();
      return;
    }
    const item = items.find((i) => i.id === id);
    if (!item) return;
    const { w, h } = searchableFootprint(item);
    if (!this.highlightGraphics) {
      this.highlightGraphics = this.scene.add.graphics();
    }
    // Ground-indicator band — above floor, behind furniture.
    this.highlightGraphics.setDepth(
      tileIndicatorDepth(item.x + w - 1, item.y + h - 1),
    );
    strokeIsoFootprintOutline(this.highlightGraphics, item.x, item.y, w, h);
  }

  /**
   * `rebuild` drops existing sprites first. Used when lazily loaded furniture
   * art arrives after the interior was already drawn with placeholders.
   */
  syncSearchables(
    items: SearchableVisual[],
    rebuild = false,
    searchingIds?: ReadonlySet<string>,
    occupiedCampchairTiles?: ReadonlySet<string>,
  ) {
    if (!this.visible) return;
    this.occupiedCampchairTiles = occupiedCampchairTiles ?? new Set();
    const relevant = items.filter(
      (item) => item.buildingX === this.buildingX && item.buildingY === this.buildingY,
    );
    this.syncedSearchables = relevant;
    const ids = new Set(relevant.map((item) => item.id));

    for (const [id, sprite] of this.objectSprites) {
      if (!ids.has(id) || rebuild) {
        sprite.destroy();
        this.objectSprites.delete(id);
        this.searchedState.delete(id);
        this.searchingState.delete(id);
        this.groundBagTiles.delete(id);
        this.lanternIds.delete(id);
        this.forgetFurnace(id);
      }
    }

    for (const item of relevant) {
      this.upsertSearchable(item, searchingIds?.has(item.id) === true);
    }
    this.refreshUpperStairHoles();
  }

  /** Tiles a stair occupies. Upper floors leave these out of the carpet. */
  private upperStairHoleKeys(): Set<string> {
    const holes = new Set<string>();
    if (this.floorLevel <= 0) return holes;
    for (const item of this.syncedSearchables) {
      if (item.objectType !== "stairs") continue;
      const { w, h } = searchableFootprint(item);
      for (let ty = item.y; ty < item.y + h; ty++) {
        for (let tx = item.x; tx < item.x + w; tx++) {
          holes.add(`${tx},${ty}`);
        }
      }
    }
    return holes;
  }

  private stairHoleSignature(): string {
    if (this.floorLevel <= 0) return "";
    const parts: string[] = [];
    for (const item of this.syncedSearchables) {
      if (item.objectType !== "stairs") continue;
      parts.push(`${item.x},${item.y},${item.facing ?? ""}`);
    }
    parts.sort();
    return parts.join("|");
  }

  /** Rebake the carpet when the upstairs stair opening changes. */
  private refreshUpperStairHoles() {
    if (this.floorLevel <= 0) return;
    const sig = this.stairHoleSignature();
    if (sig === this.stairHoleKey) return;
    this.stairHoleKey = sig;
    for (const sprite of this.floorSprites) sprite.destroy();
    this.floorSprites = [];
    this.drawFloor();
  }

  private applySearchableDepths() {
    for (const item of this.syncedSearchables) {
      const sprite = this.objectSprites.get(item.id);
      if (!sprite) continue;
      sprite.setDepth(this.searchableDepth(item));
      if (item.objectType === "stairs") this.placeStairSprite(sprite, item);
    }
  }

  /** Ascending stairs use the normal pad. Descending stairs drop into the floor hole. */
  private furniturePad(item: SearchableVisual): number {
    if (item.objectType === "stairs" && this.floorLevel > 0) {
      return STAIRS_DESCEND_BOTTOM_PAD;
    }
    return furnitureBottomPad(item.objectType);
  }

  private placeStairSprite(sprite: ObjectSprite, item: SearchableVisual) {
    const { w, h } = searchableFootprint(item);
    const iso = cartesianToIso(item.x + w / 2, item.y + h / 2);
    sprite.setPosition(iso.x, iso.y + TILE_HEIGHT / 2 + this.furniturePad(item));
  }

  private drawFloor() {
    const holes = this.upperStairHoleKeys();
    const tileCoords: { x: number; y: number }[] = [];
    for (let y = 0; y < this.iH; y++) {
      for (let x = 0; x < this.iW; x++) {
        if (holes.has(`${x},${y}`)) continue;
        tileCoords.push({ x, y });
      }
    }

    const exit = interiorExitForBuildingAt(this.buildingX, this.buildingY);
    const exitX = exit.outsideX;
    const exitY = exit.outsideY;
    if (this.floorLevel === 0) {
      tileCoords.push({ x: exitX, y: exitY });
    }

    // Houses get wood; police → GroundTiles; hospital → GroundHospital;
    // motel → GroundMotel carpet; office → GroundOffice carpet;
    // tent → barracks gravel; else concrete.
    const bType = getBuildingAt(this.buildingX, this.buildingY)?.buildingType;
    const floorKey =
      bType === "house" || bType === undefined
        ? "tile-wood"
        : bType === "police_station"
          ? "tile-ground-tiles"
          : bType === "hospital"
            ? "tile-hospital"
            : bType === "motel"
              ? "tile-motel"
              : bType === "office"
                ? "tile-office"
                : bType === "tent" || bType === "mess_hall"
                  ? "tile-barracks"
                  : "tile-concrete";
    const floor = createInteriorFloorImage(
      this.scene,
      this.buildingX,
      this.buildingY,
      tileCoords,
      floorKey,
    );
    if (floor) {
      floor.setDepth(interiorFloorDepth(0, 0));
      this.floorSprites.push(floor);
    }

    if (this.floorLevel > 0) return;

    // Arrow along the iso exit axis (SE face → +x / SE; SW face → +y / SW).
    const exitIso = cartesianToIso(exitX + 0.5, exitY + 0.5);
    const g = this.scene.add.graphics();
    g.setDepth(interiorFloorDepth(exitX, exitY) + 1);
    const px = Math.round(exitIso.x);
    const py = Math.round(exitIso.y);
    // Unit screen vector for one world step out the doorway.
    const dirX = exit.face === "SE" ? TILE_WIDTH / 2 : -TILE_WIDTH / 2;
    const dirY = TILE_HEIGHT / 2;
    const len = Math.hypot(dirX, dirY);
    const ux = dirX / len;
    const uy = dirY / len;
    const half = 12;
    const tip = 6;
    // Perpendicular for the arrowhead.
    const pxN = -uy;
    const pyN = ux;
    g.lineStyle(2, 0xffffff, 0.7);
    g.beginPath();
    g.moveTo(px - ux * half, py - uy * half);
    g.lineTo(px + ux * half, py + uy * half);
    g.lineTo(
      px + ux * half - ux * tip + pxN * tip,
      py + uy * half - uy * tip + pyN * tip,
    );
    g.moveTo(px + ux * half, py + uy * half);
    g.lineTo(
      px + ux * half - ux * tip - pxN * tip,
      py + uy * half - uy * tip - pyN * tip,
    );
    g.strokePath();
    this.floorSprites.push(g);
  }

  private addPartitionGraphics(
    x: number,
    y: number,
    wallSet: Set<string>,
    axis: "ns" | "ew" | "both",
    door: InteriorDoorTile | undefined,
    colors: PartitionWallColors,
    depth: number,
  ): Phaser.GameObjects.Graphics {
    const g = this.scene.add.graphics();
    g.setDepth(depth);
    drawWallTile(g, x, y, wallSet, axis, door, colors);
    return g;
  }

  /**
   * Procedural iso partitions. Straight-run tiles get one graphic per axis
   * segment. Join tiles draw both arms into a single Graphics object so they
   * share one WebGL draw call — separate draw calls would each be antialiased
   * independently and leave a hairline seam at the shared join — and so that
   * `drawInteriorPartitionTile` can order the two arms' faces against each
   * other by iso depth. The corner bias only sets the tile's depth (and the
   * matching entity clamp), never which arm paints on top.
   */
  private drawWalls() {
    const walls = this.getMergedWalls();
    if (walls.length === 0) {
      this.partitionWallSet = new Set();
      this.clearInternalDoorSprites();
      this.refreshPlaceableDepths();
      return;
    }
    walls.sort(
      (a, b) => a.x + a.y - (b.x + b.y) || a.y - b.y || a.x - b.x,
    );
    // Include prefab wall/door neighbors so a partially built row keeps one facing.
    const wallSet = new Set(walls.map((w) => `${w.x},${w.y}`));
    for (const key of this.prefabPartitionKeys) wallSet.add(key);
    this.partitionWallSet = wallSet;
    const doorMap = new Map(this.extraDoors.map((d) => [`${d.x},${d.y}`, d]));
    const proceduralKeys = new Set(
      interiorWallsForBuilding(this.buildingX, this.buildingY).map(
        (w) => `${w.x},${w.y}`,
      ),
    );
    const plywoodTiles = new Set(
      this.structureWalls
        .map((w) => `${w.x},${w.y}`)
        .filter((key) => !proceduralKeys.has(key)),
    );
    for (const wall of walls) {
      const door = doorMap.get(`${wall.x},${wall.y}`);
      const plywood = plywoodTiles.has(`${wall.x},${wall.y}`);
      const wallColors = plywood ? PLAYER_WALL_STYLE : this.partitionWallColors();
      // House room doors are baked Images (geom + InternalDoor1 on the face).
      // Keep the tile in the wall set for adjacency, skip the Graphics leaf.
      if (door && this.houseDoorFacingAt(wall.x, wall.y)) continue;

      const hasN = wallSet.has(`${wall.x},${wall.y - 1}`);
      const hasS = wallSet.has(`${wall.x},${wall.y + 1}`);
      const hasW = wallSet.has(`${wall.x - 1},${wall.y}`);
      const hasE = wallSet.has(`${wall.x + 1},${wall.y}`);
      const runNS = hasN || hasS;
      const runEW = hasW || hasE || (!hasN && !hasS);

      const segments: { axis: "ns" | "ew"; bias: number }[] = [];
      if (runNS) {
        segments.push({
          axis: "ns",
          bias: interiorWallCornerDepthBias(wallSet, wall.x, wall.y, "ns"),
        });
      }
      if (runEW) {
        segments.push({
          axis: "ew",
          bias: interiorWallCornerDepthBias(wallSet, wall.x, wall.y, "ew"),
        });
      }
      // Highest bias last — a join tile takes it as the whole tile's depth.
      segments.sort((a, b) => a.bias - b.bias);

      if (segments.length > 1) {
        // Corner join: one shared object so both arms sort as a single tile.
        const depth = interiorPartitionDepth(
          wall.x,
          wall.y,
          segments[segments.length - 1]!.bias,
        );
        const showPlywood = plywood && !door;
        const display = showPlywood
          ? createPlywoodPartition(
              this.scene,
              wall.x,
              wall.y,
              wallSet,
              "both",
              depth,
              1,
              `plywood-wall:in:${this.buildingX},${this.buildingY}:${wall.x},${wall.y}`,
            )
          : this.addPartitionGraphics(
              wall.x,
              wall.y,
              wallSet,
              "both",
              door,
              wallColors,
              depth,
            );
        this.wallSprites.push(display);
        this.wallEntries.push({
          x: wall.x,
          y: wall.y,
          axis: "both",
          depth,
          graphics: display,
          plywood: showPlywood && display instanceof Phaser.GameObjects.Image,
        });
        continue;
      }

      for (const seg of segments) {
        const depth = interiorPartitionDepth(wall.x, wall.y, seg.bias);
        const showPlywood = plywood && !door;
        const display = showPlywood
          ? createPlywoodPartition(
              this.scene,
              wall.x,
              wall.y,
              wallSet,
              seg.axis,
              depth,
              1,
              `plywood-wall:in:${this.buildingX},${this.buildingY}:${wall.x},${wall.y}:${seg.axis}`,
            )
          : this.addPartitionGraphics(
              wall.x,
              wall.y,
              wallSet,
              seg.axis,
              door,
              wallColors,
              depth,
            );
        this.wallSprites.push(display);
        this.wallEntries.push({
          x: wall.x,
          y: wall.y,
          axis: seg.axis,
          depth,
          graphics: display,
          plywood: showPlywood && display instanceof Phaser.GameObjects.Image,
        });
      }
    }
    this.syncInternalDoorSprites();
    // Walls moved — placeables must re-clamp against the new partition depths.
    this.refreshPlaceableDepths();
  }

  /**
   * Closed facing for a partitioned room/cubicle door, or null when the tile
   * is not a procedural room entrance.
   */
  private houseDoorFacingAt(tx: number, ty: number): InternalDoorFace | null {
    const house = houseRoomAtTile(this.buildingX, this.buildingY, tx, ty);
    if (house) return house.facing;
    const motel = motelRoomAtTile(this.buildingX, this.buildingY, tx, ty);
    if (motel) return motel.facing;
    const hospital = hospitalCubicleAtTile(this.buildingX, this.buildingY, tx, ty);
    if (hospital) return hospital.facing;
    const office = officeMeetingRoomAtTile(this.buildingX, this.buildingY, tx, ty);
    if (office) return office.facing;
    const manager = officeManagerRoomAtTile(this.buildingX, this.buildingY, tx, ty);
    if (manager) return manager.facing;
    return null;
  }

  private isHospitalCubicleDoor(tx: number, ty: number): boolean {
    return hospitalCubicleAtTile(this.buildingX, this.buildingY, tx, ty) != null;
  }

  /** Partition face colors for the current interior building type. */
  private partitionWallColors(): PartitionWallColors {
    if (getBuildingAt(this.buildingX, this.buildingY)?.buildingType === "hospital") {
      return {
        front: HOSPITAL_WALL_FRONT,
        side: HOSPITAL_WALL_SIDE,
        top: HOSPITAL_WALL_TOP,
      };
    }
    return {
      front: PARTITION_WALL_FRONT,
      side: PARTITION_WALL_SIDE,
      top: PARTITION_WALL_TOP,
    };
  }

  /**
   * Closed doors show art matching the room facing (SW = left hinge, SE = right
   * hinge). Open doors flip to the opposite face so the "inside" of the leaf
   * faces the new direction after the swing. Hospital cubicles use DoorHospital;
   * house/motel rooms use InternalDoor1.
   */
  private internalDoorTextureKey(
    tx: number,
    ty: number,
    closedFacing: InternalDoorFace,
    isOpen: boolean,
  ): string {
    const face: InternalDoorFace = isOpen
      ? closedFacing === "SW"
        ? "SE"
        : "SW"
      : closedFacing;
    return this.isHospitalCubicleDoor(tx, ty)
      ? buildingHospitalDoorKey(face)
      : buildingInternalDoor1Key(face);
  }

  private syncInternalDoorSprites() {
    if (!this.visible) return;
    const live = new Set<string>();
    for (const door of this.extraDoors) {
      const facing = this.houseDoorFacingAt(door.x, door.y);
      if (!facing) continue;
      const key = `${door.x},${door.y}`;
      live.add(key);
      this.upsertInternalDoorSprite(door, facing);
    }
    for (const [key, sprite] of this.internalDoorSprites) {
      if (live.has(key)) continue;
      sprite.destroy();
      this.internalDoorSprites.delete(key);
      const texKey = this.internalDoorTextureKeys.get(key);
      if (texKey && this.scene.textures.exists(texKey)) {
        this.scene.textures.remove(texKey);
      }
      this.internalDoorTextureKeys.delete(key);
    }
  }

  /**
   * Bake the geometric door leaf and paint door art onto its main
   * camera-facing parallelogram (same affine mapping as exterior wall doors).
   */
  private upsertInternalDoorSprite(
    door: InteriorDoorTile,
    closedFacing: InternalDoorFace,
  ) {
    const artKey = this.internalDoorTextureKey(
      door.x,
      door.y,
      closedFacing,
      door.isOpen,
    );
    if (!this.scene.textures.exists(artKey)) return;

    // Closed SE rooms use an NS leaf; closed SW rooms use an EW leaf. Open
    // pose still starts from that closed axis (hinge side is unchanged).
    const axis: "ns" | "ew" = closedFacing === "SE" ? "ns" : "ew";
    const hospital = this.isHospitalCubicleDoor(door.x, door.y);
    const baked = bakeTexturedInteriorDoor(
      this.scene,
      door.x,
      door.y,
      axis,
      door.isOpen,
      door.isLocked,
      artKey,
      hospital
        ? {
            front: HOSPITAL_DOOR_FRONT,
            side: HOSPITAL_DOOR_SIDE,
            top: HOSPITAL_DOOR_TOP,
          }
        : { front: DOOR_FRONT, side: DOOR_SIDE, top: DOOR_TOP },
    );
    if (!baked) return;

    const key = `${door.x},${door.y}`;
    const prevTex = this.internalDoorTextureKeys.get(key);
    const dynKey =
      `internal-door-bake:${this.buildingX},${this.buildingY}:${key}:` +
      `${artKey}:${door.isOpen ? "o" : "c"}`;
    if (prevTex && prevTex !== dynKey && this.scene.textures.exists(prevTex)) {
      this.scene.textures.remove(prevTex);
    }
    if (this.scene.textures.exists(dynKey)) this.scene.textures.remove(dynKey);
    this.scene.textures.addCanvas(dynKey, baked.canvas);
    this.scene.textures.get(dynKey).setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.internalDoorTextureKeys.set(key, dynKey);

    const depth = interiorPartitionDepth(door.x, door.y, 1);
    let sprite = this.internalDoorSprites.get(key);
    if (!sprite) {
      sprite = this.scene.add.image(baked.originX, baked.originY, dynKey);
      sprite.setOrigin(0, 0);
      this.internalDoorSprites.set(key, sprite);
    } else {
      sprite.setTexture(dynKey);
      sprite.setPosition(baked.originX, baked.originY);
    }
    // Bake at INTERNAL_DOOR_RENDER_SCALE, display at world size (same as exteriors).
    sprite.setScale(1 / baked.scale);
    sprite.setDepth(depth);
    sprite.setVisible(true);
    sprite.setAlpha(1);
  }

  private upsertSearchable(item: SearchableVisual, isSearching = false) {
    if (item.objectType === "furnace" || item.objectType === "mantel") {
      this.upsertFurnace(item);
      return;
    }
    if (item.objectType === "lantern1") this.lanternIds.add(item.id);
    if (
      (item.objectType === "campchair" || item.objectType === "canteenchair") &&
      this.occupiedCampchairTiles.has(`${item.x},${item.y}`)
    ) {
      const existing = this.objectSprites.get(item.id);
      if (existing) {
        existing.destroy();
        this.objectSprites.delete(item.id);
        this.searchedState.delete(item.id);
        this.searchingState.delete(item.id);
      }
      return;
    }

    const prevSearched = this.searchedState.get(item.id);
    const prevSearching = this.searchingState.get(item.id) === true;
    const visuallyOpen = item.searched || isSearching;
    const wasVisuallyOpen = prevSearched === true || prevSearching;
    let sprite = this.objectSprites.get(item.id);
    const animDef = animatedFurnitureDef(item.objectType, item.facing);

    if (sprite) {
      // Only react to open/close transitions — sync runs every frame and would
      // otherwise snap a playing search anim straight to the final frame.
      if (
        animDef &&
        sprite instanceof Phaser.GameObjects.Sprite &&
        visuallyOpen !== wasVisuallyOpen
      ) {
        this.applySearchAnimVisual(
          sprite,
          animDef,
          visuallyOpen,
          wasVisuallyOpen,
        );
      }
      // Keep depth in sync (footprint / sort rules can change without recreate).
      const depth = this.searchableDepth(item);
      if ("setDepth" in sprite) sprite.setDepth(depth);
      if (item.objectType === "stairs") this.placeStairSprite(sprite, item);
      this.trackGroundBagTile(item);
      this.searchedState.set(item.id, item.searched);
      this.searchingState.set(item.id, isSearching);
      return;
    }

    const { w, h } = searchableFootprint(item);
    const iso = cartesianToIso(item.x + w / 2, item.y + h / 2);
    const key = interiorTextureKey(item.kind, item.objectType);
    const renderHeight = furnitureRenderHeight(item.objectType);
    // Depth from the front-most footprint tile so multi-tile pieces occlude correctly.
    // Floor bags use wall-aware placeable depth (see searchableDepth).
    const depth = this.searchableDepth(item);

    // Anchor sprites to the south vertex of the tile diamond so they sit on the floor.
    const groundY = iso.y + TILE_HEIGHT / 2 + this.furniturePad(item);

    if (animDef && textureKeyExists(this.scene, animDef.idleKey)) {
      const animSprite = addSpriteForKey(this.scene, iso.x, groundY, animDef.idleKey);
      this.fitInteriorSprite(animSprite, renderHeight);
      animSprite.setOrigin(0.5, 1);
      animSprite.setDepth(depth);
      // Already-searched (re-enter / AOI) hold the open pose — no replay.
      // Mid-search on first draw plays the open sheet.
      this.applySearchAnimVisual(animSprite, animDef, visuallyOpen, item.searched);
      this.objectSprites.set(item.id, animSprite);
      this.trackGroundBagTile(item);
      this.searchedState.set(item.id, item.searched);
      this.searchingState.set(item.id, isSearching);
      return;
    }

    if (textureKeyExists(this.scene, key)) {
      const image = addImageForKey(this.scene, iso.x, groundY, key);
      this.fitInteriorSprite(image, renderHeight);
      image.setOrigin(0.5, 1);
      image.setDepth(depth);
      this.objectSprites.set(item.id, image);
      this.trackGroundBagTile(item);
      this.searchedState.set(item.id, item.searched);
      this.searchingState.set(item.id, isSearching);
      return;
    }

    const g = this.scene.add.graphics();
    g.setDepth(depth);
    g.fillStyle(0x8b6914, 1);
    g.fillRect(iso.x - 12, groundY - renderHeight, 24, renderHeight);
    this.objectSprites.set(item.id, g);
    this.trackGroundBagTile(item);
    this.searchedState.set(item.id, item.searched);
    this.searchingState.set(item.id, isSearching);
  }

  private clearFurnaceRuntime() {
    for (const ev of this.furnaceExpireEvents.values()) ev.remove(false);
    this.furnaceExpireEvents.clear();
    this.furnaceVisualUntil.clear();
    this.furnaceTiles.clear();
  }

  private forgetFurnace(id: string) {
    this.furnaceExpireEvents.get(id)?.remove(false);
    this.furnaceExpireEvents.delete(id);
    this.furnaceVisualUntil.delete(id);
    this.furnaceTiles.delete(id);
  }

  private hearthArt(objectType: string, facing: string): {
    inactiveKey: string;
    animKey: string;
    height: number;
  } {
    if (objectType === "mantel") {
      return {
        inactiveKey: mantel1InactiveKey(facing),
        animKey: mantel1ActiveAnim(facing),
        height: MANTEL1_RENDER_HEIGHT,
      };
    }
    return {
      inactiveKey: furnace1InactiveKey(facing),
      animKey: furnace1ActiveAnim(facing),
      height: FURNACE1_RENDER_HEIGHT,
    };
  }

  private hearthNear(
    tile: { x: number; y: number; w: number; h: number },
    tx: number,
    ty: number,
  ): boolean {
    const dx =
      tx < tile.x ? tile.x - tx : tx > tile.x + tile.w - 1 ? tx - (tile.x + tile.w - 1) : 0;
    const dy =
      ty < tile.y ? tile.y - ty : ty > tile.y + tile.h - 1 ? ty - (tile.y + tile.h - 1) : 0;
    return Math.max(dx, dy) <= 1;
  }

  /** Inactive still, or a looping active sheet while wood is burning. */
  private upsertFurnace(item: SearchableVisual) {
    configureInteriorAnimations(this.scene);
    const facing = item.facing === "SW" ? "SW" : "SE";
    const art = this.hearthArt(item.objectType, facing);
    const until = item.activeUntil ?? 0;
    const { w, h } = searchableFootprint(item);
    this.furnaceTiles.set(item.id, {
      x: item.x,
      y: item.y,
      w,
      h,
      activeUntil: until,
      objectType: item.objectType,
      facing,
    });

    if (!textureKeyExists(this.scene, art.inactiveKey)) return;

    const iso = cartesianToIso(item.x + w / 2, item.y + h / 2);
    const groundY = iso.y + TILE_HEIGHT / 2 + furnitureBottomPad(item.objectType);
    const depth = this.searchableDepth(item);

    const existing = this.objectSprites.get(item.id);
    let sprite: Phaser.GameObjects.Sprite;
    if (existing instanceof Phaser.GameObjects.Sprite) {
      existing.setPosition(iso.x, groundY);
      sprite = existing;
    } else {
      if (existing) existing.destroy();
      sprite = addSpriteForKey(this.scene, iso.x, groundY, art.inactiveKey);
      sprite.setOrigin(0.5, 1);
      this.objectSprites.set(item.id, sprite);
      this.furnaceVisualUntil.delete(item.id);
    }
    sprite.setDepth(depth);
    sprite.setVisible(true);
    sprite.setActive(true);

    if (this.furnaceVisualUntil.get(item.id) === until) return;
    this.furnaceVisualUntil.set(item.id, until);
    this.applyFurnaceVisual(sprite, item.objectType, facing, until);
    this.scheduleFurnaceExpire(item.id, until);
  }

  private applyFurnaceVisual(
    sprite: Phaser.GameObjects.Sprite,
    objectType: string,
    facing: string,
    activeUntil: number,
  ) {
    const art = this.hearthArt(objectType, facing);
    const active = Date.now() < activeUntil;
    if (active && this.scene.anims.exists(art.animKey)) {
      if (!sprite.anims.isPlaying || sprite.anims.currentAnim?.key !== art.animKey) {
        sprite.play(art.animKey);
      }
    } else {
      sprite.anims.stop();
      if (!spriteShowsKey(sprite, art.inactiveKey)) {
        applyTextureKey(sprite, art.inactiveKey);
      }
    }
    this.fitInteriorSprite(sprite, art.height);
  }

  private scheduleFurnaceExpire(id: string, activeUntil: number) {
    this.furnaceExpireEvents.get(id)?.remove(false);
    this.furnaceExpireEvents.delete(id);
    const remaining = activeUntil - Date.now();
    if (remaining <= 0) return;
    const ev = this.scene.time.delayedCall(remaining, () => {
      this.furnaceExpireEvents.delete(id);
      const sprite = this.objectSprites.get(id);
      const tile = this.furnaceTiles.get(id);
      if (!(sprite instanceof Phaser.GameObjects.Sprite) || !tile) return;
      if (Date.now() < tile.activeUntil) return;
      this.furnaceVisualUntil.set(id, tile.activeUntil);
      this.applyFurnaceVisual(sprite, tile.objectType, tile.facing, tile.activeUntil);
    });
    this.furnaceExpireEvents.set(id, ev);
  }

  private trackGroundBagTile(item: SearchableVisual) {
    if (item.objectType === "groundbackpack") {
      this.groundBagTiles.set(item.id, { x: item.x, y: item.y });
    } else {
      this.groundBagTiles.delete(item.id);
    }
  }

  private fitInteriorSprite(
    sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite,
    renderHeight: number,
  ) {
    // realWidth/realHeight are the untrimmed frame size, so atlas-packed art
    // (trimmed to its opaque bounds) keeps the same proportions as a loose PNG.
    const w = sprite.frame?.realWidth || 1;
    const h = sprite.frame?.realHeight || 1;
    sprite.setDisplaySize((w / h) * renderHeight, renderHeight);
  }

  private clearFireplaces() {
    for (const ev of this.fireplaceExpireEvents.values()) ev.remove(false);
    this.fireplaceExpireEvents.clear();
    for (const sprite of this.fireplaceSprites.values()) sprite.destroy();
    this.fireplaceSprites.clear();
    this.fireplaces = [];
  }

  private clearStorageBoxes() {
    for (const sprite of this.storageBoxSprites.values()) sprite.destroy();
    this.storageBoxSprites.clear();
    this.storageBoxes = [];
  }

  private syncStorageBoxSprites() {
    if (!this.visible) return;
    const live = new Set(this.storageBoxes.map((f) => `${f.x},${f.y}`));
    for (const [key, sprite] of this.storageBoxSprites) {
      if (live.has(key)) continue;
      sprite.destroy();
      this.storageBoxSprites.delete(key);
    }
    for (const tile of this.storageBoxes) this.upsertStorageBoxSprite(tile);
  }

  private storageBoxBottomPad(kind: string): number {
    return storageBoxGroundOffset(kind, STORAGE_BOX_RENDER_HEIGHT);
  }

  private upsertStorageBoxSprite(tile: { x: number; y: number; kind: string }) {
    if (!this.visible) return;
    const textureKey = storageBoxTextureKey(tile.kind);
    if (!textureKeyExists(this.scene, textureKey)) return;
    const key = `${tile.x},${tile.y}`;
    const iso = cartesianToIso(tile.x + 0.5, tile.y + 0.5);
    const groundY = iso.y + TILE_HEIGHT / 2 + this.storageBoxBottomPad(tile.kind);
    let sprite = this.storageBoxSprites.get(key);
    if (!sprite) {
      sprite = addSpriteForKey(this.scene, iso.x, groundY, textureKey);
      sprite.setOrigin(0.5, 1);
      this.storageBoxSprites.set(key, sprite);
    } else {
      applyTextureKey(sprite, textureKey);
      sprite.setPosition(iso.x, groundY);
    }
    this.fitInteriorSprite(sprite, STORAGE_BOX_RENDER_HEIGHT);
    sprite.setDepth(this.placeableDepthAt(tile.x, tile.y));
    sprite.setVisible(true);
  }

  private layoutStorageBoxGhost(
    sprite: Phaser.GameObjects.Sprite,
    tx: number,
    ty: number,
    kind: string,
  ) {
    const iso = cartesianToIso(tx + 0.5, ty + 0.5);
    const groundY = iso.y + TILE_HEIGHT / 2 + this.storageBoxBottomPad(kind);
    applyTextureKey(sprite, storageBoxTextureKey(kind));
    sprite.setPosition(iso.x, groundY);
    sprite.setOrigin(0.5, 1);
    this.fitInteriorSprite(sprite, STORAGE_BOX_RENDER_HEIGHT);
    sprite.setDepth(this.placeableDepthAt(tx, ty));
    sprite.setVisible(true);
  }

  private clearFences() {
    for (const sprite of this.fenceSprites.values()) sprite.destroy();
    this.fenceSprites.clear();
    this.fences = [];
  }

  private clearFenceCorners() {
    for (const sprite of this.fenceCornerSprites.values()) sprite.destroy();
    this.fenceCornerSprites.clear();
    this.fenceCorners = [];
  }

  private syncFenceSprites() {
    if (!this.visible) return;
    const live = new Set(this.fences.map((f) => `${f.x},${f.y}`));
    for (const [key, sprite] of this.fenceSprites) {
      if (live.has(key)) continue;
      sprite.destroy();
      this.fenceSprites.delete(key);
    }
    for (const tile of this.fences) this.upsertFenceSprite(tile);
  }

  private upsertFenceSprite(tile: InteriorFenceTile) {
    if (!this.visible) return;
    const texKey = structurePanelTextureKey(tile.kind, tile.facing);
    if (!textureKeyExists(this.scene, texKey)) return;
    const key = `${tile.x},${tile.y}`;
    let image = this.fenceSprites.get(key);
    if (!image) {
      image = addImageForKey(this.scene, 0, 0, texKey);
      this.fenceSprites.set(key, image);
    } else {
      applyTextureKey(image, texKey);
    }
    layoutChainLinkFenceImage(image, tile.x, tile.y, tile.facing, 1, tile.kind);
    image.setDepth(chainLinkFenceSortDepth(tile.x, tile.y, tile.facing));
    image.setVisible(true);
  }

  private syncFenceCornerSprites() {
    if (!this.visible) return;
    const live = new Set(this.fenceCorners.map((f) => `${f.x},${f.y}`));
    for (const [key, sprite] of this.fenceCornerSprites) {
      if (live.has(key)) continue;
      sprite.destroy();
      this.fenceCornerSprites.delete(key);
    }
    for (const tile of this.fenceCorners) this.upsertFenceCornerSprite(tile);
  }

  private upsertFenceCornerSprite(tile: InteriorFenceCornerTile) {
    if (!this.visible) return;
    const texKey = chainLinkFenceCornerTextureKey(tile.corner);
    if (!textureKeyExists(this.scene, texKey)) return;
    const key = `${tile.x},${tile.y}`;
    let image = this.fenceCornerSprites.get(key);
    if (!image) {
      image = addImageForKey(this.scene, 0, 0, texKey);
      this.fenceCornerSprites.set(key, image);
    } else {
      applyTextureKey(image, texKey);
    }
    layoutChainLinkFenceCornerImage(image, tile.x, tile.y, tile.corner, 1);
    image.setDepth(chainLinkFenceCornerSortDepth(tile.x, tile.y));
    image.setVisible(true);
  }

  private syncFireplaceSprites() {
    if (!this.visible) return;
    const live = new Set(this.fireplaces.map((f) => `${f.x},${f.y}`));
    for (const [key, sprite] of this.fireplaceSprites) {
      if (live.has(key)) continue;
      this.fireplaceExpireEvents.get(key)?.remove(false);
      this.fireplaceExpireEvents.delete(key);
      sprite.destroy();
      this.fireplaceSprites.delete(key);
    }
    for (const tile of this.fireplaces) this.upsertFireplaceSprite(tile);
  }

  private upsertFireplaceSprite(tile: InteriorFireplaceTile) {
    if (!this.visible) return;
    configureInteriorAnimations(this.scene);
    if (!textureKeyExists(this.scene, FIREPLACE1_INACTIVE_KEY)) return;

    const key = `${tile.x},${tile.y}`;
    const iso = cartesianToIso(tile.x + 0.5, tile.y + 0.5);
    const groundY = iso.y + TILE_HEIGHT / 2 + FIREPLACE1_BOTTOM_PAD;
    const depth = this.placeableDepthAt(tile.x, tile.y);

    let sprite = this.fireplaceSprites.get(key);
    if (!sprite) {
      sprite = addSpriteForKey(this.scene, iso.x, groundY, FIREPLACE1_INACTIVE_KEY);
      sprite.setOrigin(0.5, 1);
      this.fireplaceSprites.set(key, sprite);
    } else {
      sprite.setPosition(iso.x, groundY);
    }
    sprite.setDepth(depth);
    sprite.setVisible(true);
    sprite.setActive(true);
    this.applyFireplaceVisual(sprite, tile.activeUntil);
    this.scheduleFireplaceExpire(key, tile.activeUntil);
  }

  private applyFireplaceVisual(
    sprite: Phaser.GameObjects.Sprite,
    activeUntil: number,
  ) {
    const active = Date.now() < activeUntil;
    if (active && this.scene.anims.exists(FIREPLACE1_ACTIVE_ANIM)) {
      // After extinguish, Phaser keeps currentAnim keyed to Active while
      // stopped — so key-only checks skip play() on relight.
      if (
        !sprite.anims.isPlaying ||
        sprite.anims.currentAnim?.key !== FIREPLACE1_ACTIVE_ANIM
      ) {
        sprite.play(FIREPLACE1_ACTIVE_ANIM);
      }
    } else {
      sprite.anims.stop();
      if (!spriteShowsKey(sprite, FIREPLACE1_INACTIVE_KEY)) {
        applyTextureKey(sprite, FIREPLACE1_INACTIVE_KEY);
      }
    }
    this.fitInteriorSprite(sprite, FIREPLACE1_RENDER_HEIGHT);
  }

  private scheduleFireplaceExpire(key: string, activeUntil: number) {
    this.fireplaceExpireEvents.get(key)?.remove(false);
    this.fireplaceExpireEvents.delete(key);
    const remaining = activeUntil - Date.now();
    if (remaining <= 0) return;
    const tile = this.fireplaces.find((f) => `${f.x},${f.y}` === key);
    if (!tile) return;
    const ev = this.scene.time.delayedCall(remaining, () => {
      this.fireplaceExpireEvents.delete(key);
      const sprite = this.fireplaceSprites.get(key);
      if (!sprite) return;
      this.applyFireplaceVisual(sprite, tile.activeUntil);
    });
    this.fireplaceExpireEvents.set(key, ev);
  }

  /**
   * Idle until a search starts or the container is already open; then play the
   * open anim once and hold the last frame. Cancel / respawn returns to idle.
   */
  private applySearchAnimVisual(
    sprite: Phaser.GameObjects.Sprite,
    def: AnimatedFurnitureDef,
    searched: boolean,
    wasSearched: boolean,
  ) {
    const renderHeight = furnitureRenderHeight(def.objectType);

    // Idle-only pieces (no searched sheets yet).
    if (def.frameCount <= 0) {
      sprite.anims.stop();
      if (!spriteShowsKey(sprite, def.idleKey)) {
        applyTextureKey(sprite, def.idleKey);
        this.fitInteriorSprite(sprite, renderHeight);
      }
      return;
    }

    const holdLastFrame = () => {
      const lastKey = furnitureSearchedFrameKey(def, def.frameCount);
      if (applyTextureKey(sprite, lastKey)) {
        sprite.anims.stop();
        this.fitInteriorSprite(sprite, renderHeight);
      }
    };

    if (!searched) {
      sprite.anims.stop();
      sprite.off("animationcomplete");
      if (!spriteShowsKey(sprite, def.idleKey)) {
        applyTextureKey(sprite, def.idleKey);
        this.fitInteriorSprite(sprite, renderHeight);
      }
      return;
    }

    if (wasSearched) {
      holdLastFrame();
      return;
    }

    configureInteriorAnimations(this.scene);
    if (this.scene.anims.exists(def.animKey)) {
      sprite.off("animationcomplete");
      sprite.once("animationcomplete", holdLastFrame);
      sprite.play(def.animKey);
      this.fitInteriorSprite(sprite, renderHeight);
      return;
    }

    holdLastFrame();
  }
}

type PlywoodFace = {
  axis: "south" | "east";
  /** Constant world axis: y for a south face, x for an east face. */
  fixed: number;
  start: number;
  end: number;
};

/**
 * One wall tile: a door leaf when `door` is set, otherwise a partition spine.
 * `axis` "both" is a join tile carrying two runs. A door there gets a leaf
 * per run, matching how the partition draws both arms.
 */
export function drawWallTile(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  wallSet: Set<string>,
  axis: "ns" | "ew" | "both",
  door?: InteriorDoorTile,
  colors?: PartitionWallColors,
) {
  if (!door) {
    drawInteriorPartitionTile(g, x, y, wallSet, axis, colors);
    return;
  }
  if (axis === "both") {
    drawInteriorDoorTile(g, x, y, "ns", door.isOpen, door.isLocked);
    drawInteriorDoorTile(g, x, y, "ew", door.isOpen, door.isLocked);
    return;
  }
  drawInteriorDoorTile(g, x, y, axis, door.isOpen, door.isLocked);
}

/**
 * Draw one wall tile as a thin spine through the tile midline.
 * Straight runs span the full tile (flush to N/E/W interior edges).
 * Corner join tiles are L-shaped: each arm stops at the tile centre.
 * `axis` limits drawing when a corner is painted as part of a merged run.
 *
 * Only the two camera-facing faces (south, east) plus the top are drawn. At a
 * join the arms overlap over the centre block, so each arm's face is clipped
 * away where the perpendicular arm carries on past it: that stretch of face
 * lies *inside* the merged L and would otherwise paint over the arm that owns
 * the surface there — an E/W arm bleeding through its N/S neighbour.
 *
 * Faces are then painted far→near by their own iso key rather than arm by arm.
 * Both arms of a join are tall enough to overlap on screen, and which one wins
 * differs per side of the centre: at a 4-way join the N/S arm must cover the
 * E/W arm west of centre while the E/W arm covers the N/S arm north of it, so
 * no whole-arm ordering can be right. Raised tops go last — at any shared
 * screen point a top face is always the nearest surface.
 */
function collectPartitionFaces(
  ox: number,
  oy: number,
  wallSet: Set<string>,
  axis: "ns" | "ew" | "both" = "both",
  colors?: PartitionWallColors,
) {
  const d = PARTITION_HEIGHT;
  const t = PARTITION_THICKNESS;
  const halfT = t / 2;
  const hasW = wallSet.has(`${ox - 1},${oy}`);
  const hasE = wallSet.has(`${ox + 1},${oy}`);
  const hasN = wallSet.has(`${ox},${oy - 1}`);
  const hasS = wallSet.has(`${ox},${oy + 1}`);
  const runEW = hasW || hasE || (!hasN && !hasS);
  const runNS = hasN || hasS;
  const isCorner = runEW && runNS;

  const palette = colors ?? {
    front: PARTITION_WALL_FRONT,
    side: PARTITION_WALL_SIDE,
    top: PARTITION_WALL_TOP,
  };
  const front = hexToNum(palette.front);
  const side = hexToNum(palette.side);
  const top = hexToNum(palette.top);
  const cx = ox + 0.5;
  const cy = oy + 0.5;

  // Arm footprints. Corner arms stop at the tile centre; straight runs span
  // the full tile so neighbouring tiles butt together.
  const ewX0 = isCorner && !hasW ? cx - halfT : ox;
  const ewX1 = isCorner && !hasE ? cx + halfT : ox + 1;
  const ewY0 = cy - halfT;
  const ewY1 = cy + halfT;
  const nsX0 = cx - halfT;
  const nsX1 = cx + halfT;
  const nsY0 = isCorner && !hasN ? cy - halfT : oy;
  const nsY1 = isCorner && !hasS ? cy + halfT : oy + 1;

  /** Collected quads: side faces sorted by `key`, then tops, painted at the end. */
  const sides: {
    pts: { x: number; y: number }[];
    color: number;
    key: number;
    plywood?: PlywoodFace;
  }[] = [];
  const tops: {
    pts: { x: number; y: number }[];
    color: number;
    rect: { x0: number; y0: number; x1: number; y1: number };
  }[] = [];
  const usePlywood = palette.plywood === true;

  /** South-facing wall at `y`, spanning `x0`..`x1`. */
  const southFace = (y: number, x0: number, x1: number) => {
    if (x1 - x0 <= PARTITION_FACE_EPS) return;
    const a = cartesianToIso(x0, y);
    const b = cartesianToIso(x1, y);
    sides.push({
      pts: [a, b, { x: b.x, y: b.y - d }, { x: a.x, y: a.y - d }],
      color: front,
      key: (x0 + x1) / 2 + y,
      plywood: usePlywood
        ? { axis: "south", fixed: y, start: x0, end: x1 }
        : undefined,
    });
  };

  /** East-facing wall at `x`, spanning `y0`..`y1`. */
  const eastFace = (x: number, y0: number, y1: number) => {
    if (y1 - y0 <= PARTITION_FACE_EPS) return;
    const a = cartesianToIso(x, y0);
    const b = cartesianToIso(x, y1);
    sides.push({
      pts: [a, b, { x: b.x, y: b.y - d }, { x: a.x, y: a.y - d }],
      color: side,
      key: x + (y0 + y1) / 2,
      plywood: usePlywood
        ? { axis: "east", fixed: x, start: y0, end: y1 }
        : undefined,
    });
  };

  const topFace = (x0: number, y0: number, x1: number, y1: number) => {
    const nw = cartesianToIso(x0, y0);
    const ne = cartesianToIso(x1, y0);
    const se = cartesianToIso(x1, y1);
    const sw = cartesianToIso(x0, y1);
    tops.push({
      pts: [
        { x: nw.x, y: nw.y - d },
        { x: ne.x, y: ne.y - d },
        { x: se.x, y: se.y - d },
        { x: sw.x, y: sw.y - d },
      ],
      color: top,
      rect: { x0, y0, x1, y1 },
    });
  };

  if ((axis === "ew" || axis === "both") && runEW) {
    if (runNS && nsY1 > ewY1 + PARTITION_FACE_EPS) {
      // N/S arm runs on south of here, so it owns the surface over its width.
      southFace(ewY1, ewX0, Math.min(ewX1, nsX0));
      southFace(ewY1, Math.max(ewX0, nsX1), ewX1);
    } else {
      southFace(ewY1, ewX0, ewX1);
    }
    eastFace(ewX1, ewY0, ewY1);
    topFace(ewX0, ewY0, ewX1, ewY1);
  }

  if ((axis === "ns" || axis === "both") && runNS) {
    southFace(nsY1, nsX0, nsX1);
    if (runEW && ewX1 > nsX1 + PARTITION_FACE_EPS) {
      // E/W arm runs on east of here, so it owns the surface over its depth.
      eastFace(nsX1, nsY0, Math.min(nsY1, ewY0));
      eastFace(nsX1, Math.max(nsY0, ewY1), nsY1);
    } else {
      eastFace(nsX1, nsY0, nsY1);
    }
    topFace(nsX0, nsY0, nsX1, nsY1);
  }

  sides.sort((a, b) => a.key - b.key);
  return { sides, tops };
}

export function drawInteriorPartitionTile(
  g: Phaser.GameObjects.Graphics,
  ox: number,
  oy: number,
  wallSet: Set<string>,
  axis: "ns" | "ew" | "both" = "both",
  colors?: PartitionWallColors,
) {
  const { sides, tops } = collectPartitionFaces(ox, oy, wallSet, axis, colors);
  for (const face of sides) fillPartitionPoly(g, face.pts, face.color);
  for (const face of tops) fillPartitionPoly(g, face.pts, face.color);
}

/** Same supersample idea as exterior cuboids: paint sharp, display at world size. */
const PLYWOOD_BAKE_SCALE = 2;

type PlywoodComponent = {
  sig: string;
  key: string;
  originX: number;
  originY: number;
  scale: number;
  canvasW: number;
  canvasH: number;
  users: number;
};

const plywoodComponents = new Map<string, PlywoodComponent>();
let plywoodCompSeq = 0;

export function destroyPartitionDisplay(
  scene: Phaser.Scene,
  obj: Phaser.GameObjects.GameObject,
) {
  if (obj instanceof Phaser.GameObjects.Image) {
    const key = obj.texture.key;
    obj.destroy();
    releasePlywoodComponent(scene, key);
    return;
  }
  obj.destroy();
}

function releasePlywoodComponent(scene: Phaser.Scene, key: string) {
  if (!key.startsWith("plywood-comp:")) return;
  for (const comp of plywoodComponents.values()) {
    if (comp.key !== key) continue;
    comp.users -= 1;
    if (comp.users > 0) return;
    plywoodComponents.delete(comp.sig);
    if (scene.textures.exists(key)) scene.textures.remove(key);
    return;
  }
}

/**
 * One connected run is painted the same way as a brick building face, then
 * each tile shows its crop. The crop edge samples the next tile's wood, so
 * the join is not a separate image border.
 */
export function createPlywoodPartition(
  scene: Phaser.Scene,
  ox: number,
  oy: number,
  wallSet: Set<string>,
  axis: "ns" | "ew" | "both",
  depth: number,
  alpha: number,
  _dynKey: string,
  existing: Phaser.GameObjects.Image | null = null,
): Phaser.GameObjects.Graphics | Phaser.GameObjects.Image {
  const comp = ensurePlywoodComponent(scene, ox, oy, wallSet);
  const crop = comp ? plywoodTileCrop(ox, oy, wallSet, axis, comp) : null;
  if (!comp || !crop) {
    if (comp && comp.users === 0) {
      plywoodComponents.delete(comp.sig);
      if (scene.textures.exists(comp.key)) scene.textures.remove(comp.key);
    }
    if (existing) destroyPartitionDisplay(scene, existing);
    const g = scene.add.graphics();
    g.setDepth(depth);
    g.setAlpha(alpha);
    drawInteriorPartitionTile(g, ox, oy, wallSet, axis, PLAYER_WALL_STYLE);
    return g;
  }

  const reuse =
    existing && existing.active && existing.texture.key === comp.key
      ? existing
      : null;
  if (existing && !reuse) destroyPartitionDisplay(scene, existing);
  if (!reuse) comp.users += 1;

  const sprite =
    reuse ?? scene.add.image(comp.originX, comp.originY, comp.key);
  if (!reuse) sprite.setOrigin(0, 0);
  sprite.setPosition(comp.originX, comp.originY);
  sprite.setCrop(crop.x, crop.y, crop.w, crop.h);
  sprite.setScale(1 / comp.scale);
  sprite.setDepth(depth);
  sprite.setAlpha(alpha);
  sprite.setVisible(true);
  return sprite;
}

function plywoodComponentTiles(
  ox: number,
  oy: number,
  wallSet: Set<string>,
): string[] {
  const start = `${Math.floor(ox)},${Math.floor(oy)}`;
  if (!wallSet.has(start)) return [start];
  const seen = new Set<string>();
  const stack = [start];
  while (stack.length > 0) {
    const key = stack.pop();
    if (!key || seen.has(key) || !wallSet.has(key)) continue;
    seen.add(key);
    const [xs, ys] = key.split(",");
    const x = Number(xs);
    const y = Number(ys);
    stack.push(`${x + 1},${y}`, `${x - 1},${y}`, `${x},${y + 1}`, `${x},${y - 1}`);
  }
  return [...seen].sort();
}

function mergePlywoodFaces(faces: PlywoodFace[]): PlywoodFace[] {
  const groups = new Map<string, PlywoodFace[]>();
  for (const face of faces) {
    const key = `${face.axis}:${face.fixed.toFixed(4)}`;
    const list = groups.get(key);
    if (list) list.push(face);
    else groups.set(key, [face]);
  }
  const out: PlywoodFace[] = [];
  for (const list of groups.values()) {
    list.sort((a, b) => a.start - b.start);
    let cur: PlywoodFace = { ...list[0]! };
    for (let i = 1; i < list.length; i++) {
      const next = list[i]!;
      if (next.start <= cur.end + 1e-3) cur.end = Math.max(cur.end, next.end);
      else {
        out.push(cur);
        cur = { ...next };
      }
    }
    out.push(cur);
  }
  return out;
}

function plywoodFacePoint(face: PlywoodFace, t: number): { x: number; y: number } {
  return face.axis === "south"
    ? cartesianToIso(t, face.fixed)
    : cartesianToIso(face.fixed, t);
}

function ensurePlywoodComponent(
  scene: Phaser.Scene,
  ox: number,
  oy: number,
  wallSet: Set<string>,
): PlywoodComponent | null {
  const tiles = plywoodComponentTiles(ox, oy, wallSet);
  const sig = tiles.join("|");
  const cached = plywoodComponents.get(sig);
  if (cached && scene.textures.exists(cached.key)) return cached;
  if (cached) plywoodComponents.delete(sig);

  const baked = bakePlywoodComponent(scene, tiles, wallSet);
  if (!baked) return null;
  const key = `plywood-comp:${++plywoodCompSeq}`;
  scene.textures.addCanvas(key, baked.canvas);
  scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
  const comp: PlywoodComponent = {
    sig,
    key,
    originX: baked.originX,
    originY: baked.originY,
    scale: baked.scale,
    canvasW: baked.canvas.width,
    canvasH: baked.canvas.height,
    users: 0,
  };
  plywoodComponents.set(sig, comp);
  return comp;
}

function plywoodTileCrop(
  ox: number,
  oy: number,
  wallSet: Set<string>,
  axis: "ns" | "ew" | "both",
  comp: PlywoodComponent,
): { x: number; y: number; w: number; h: number } | null {
  const { sides, tops } = collectPartitionFaces(
    ox,
    oy,
    wallSet,
    axis,
    PLAYER_WALL_STYLE,
  );
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const consider = (p: { x: number; y: number }) => {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  };
  for (const face of sides) {
    for (const p of face.pts) consider(p);
  }
  for (const face of tops) {
    for (const p of face.pts) consider(p);
  }
  if (!Number.isFinite(minX)) return null;
  // A pixel of overlap samples the next tile's wood in this same texture,
  // so the cut is not a transparent image edge.
  const x = Math.max(0, Math.floor((minX - comp.originX) * comp.scale) - 2);
  const y = Math.max(0, Math.floor((minY - comp.originY) * comp.scale) - 2);
  const r = Math.min(
    comp.canvasW,
    Math.ceil((maxX - comp.originX) * comp.scale) + 2,
  );
  const b = Math.min(
    comp.canvasH,
    Math.ceil((maxY - comp.originY) * comp.scale) + 2,
  );
  return { x, y, w: Math.max(1, r - x), h: Math.max(1, b - y) };
}

type PlywoodTopRect = { x0: number; y0: number; x1: number; y1: number };

/** Butt-joints inside a straight run. The next tile already covers them. */
function dropInternalPlywoodCaps(faces: PlywoodFace[]): PlywoodFace[] {
  const merged = mergePlywoodFaces(faces);
  return merged.filter((face) => {
    const len = face.end - face.start;
    if (len > PARTITION_THICKNESS + 0.05) return true;
    for (const other of merged) {
      if (other.axis === face.axis) continue;
      const crosses =
        other.start < face.fixed - 1e-3 && other.end > face.fixed + 1e-3;
      const onLine =
        face.start - 1e-3 <= other.fixed && other.fixed <= face.end + 1e-3;
      if (crosses && onLine) return false;
    }
    return true;
  });
}

function mergePlywoodTops(rects: PlywoodTopRect[]): PlywoodTopRect[] {
  const list = rects.map((r) => ({ ...r }));
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < list.length && !changed; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i]!;
        const b = list[j]!;
        const sameY =
          Math.abs(a.y0 - b.y0) < 1e-3 && Math.abs(a.y1 - b.y1) < 1e-3;
        const sameX =
          Math.abs(a.x0 - b.x0) < 1e-3 && Math.abs(a.x1 - b.x1) < 1e-3;
        const touchX =
          Math.abs(a.x1 - b.x0) < 1e-3 || Math.abs(b.x1 - a.x0) < 1e-3;
        const touchY =
          Math.abs(a.y1 - b.y0) < 1e-3 || Math.abs(b.y1 - a.y0) < 1e-3;
        if ((sameY && touchX) || (sameX && touchY)) {
          a.x0 = Math.min(a.x0, b.x0);
          a.x1 = Math.max(a.x1, b.x1);
          a.y0 = Math.min(a.y0, b.y0);
          a.y1 = Math.max(a.y1, b.y1);
          list.splice(j, 1);
          changed = true;
          break;
        }
      }
    }
  }
  return list;
}

function plywoodFaceKey(face: PlywoodFace): number {
  return face.axis === "south"
    ? (face.start + face.end) / 2 + face.fixed
    : face.fixed + (face.start + face.end) / 2;
}

function bakePlywoodComponent(
  scene: Phaser.Scene,
  tiles: string[],
  wallSet: Set<string>,
): {
  canvas: HTMLCanvasElement;
  originX: number;
  originY: number;
  scale: number;
} | null {
  const source = resolveImageSource(scene, BUILDING_WALL_PLYWOOD_KEY);
  if (!source) return null;
  const plywoodFaces: PlywoodFace[] = [];
  const topRects: PlywoodTopRect[] = [];
  for (const key of tiles) {
    const [xs, ys] = key.split(",");
    const tx = Number(xs);
    const ty = Number(ys);
    const built = collectPartitionFaces(tx, ty, wallSet, "both", PLAYER_WALL_STYLE);
    for (const face of built.sides) {
      if (face.plywood) plywoodFaces.push(face.plywood);
    }
    for (const top of built.tops) topRects.push(top.rect);
  }
  const faces = dropInternalPlywoodCaps(plywoodFaces).sort(
    (a, b) => plywoodFaceKey(a) - plywoodFaceKey(b),
  );
  const tops = mergePlywoodTops(topRects);
  if (faces.length === 0 && tops.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const consider = (p: { x: number; y: number }) => {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  };
  for (const face of faces) {
    const bl = plywoodFacePoint(face, face.start);
    const br = plywoodFacePoint(face, face.end);
    consider(bl);
    consider(br);
    consider({ x: bl.x, y: bl.y - PARTITION_HEIGHT });
    consider({ x: br.x, y: br.y - PARTITION_HEIGHT });
  }
  for (const top of tops) {
    const nw = cartesianToIso(top.x0, top.y0);
    const ne = cartesianToIso(top.x1, top.y0);
    const se = cartesianToIso(top.x1, top.y1);
    const sw = cartesianToIso(top.x0, top.y1);
    consider(nw);
    consider(ne);
    consider(se);
    consider(sw);
    consider({ x: nw.x, y: nw.y - PARTITION_HEIGHT });
    consider({ x: ne.x, y: ne.y - PARTITION_HEIGHT });
    consider({ x: se.x, y: se.y - PARTITION_HEIGHT });
    consider({ x: sw.x, y: sw.y - PARTITION_HEIGHT });
  }
  if (!Number.isFinite(minX)) return null;

  const pad = 2;
  minX = Math.floor(minX) - pad;
  minY = Math.floor(minY) - pad;
  maxX = Math.ceil(maxX) + pad;
  maxY = Math.ceil(maxY) + pad;
  let scale = PLYWOOD_BAKE_SCALE;
  const spanX = maxX - minX;
  const spanY = maxY - minY;
  if (spanX * scale > 8192 || spanY * scale > 8192) scale = 1;
  if (spanX > 16384 || spanY > 16384) return null;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(spanX * scale));
  canvas.height = Math.max(1, Math.ceil(spanY * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.setTransform(scale, 0, 0, scale, -minX * scale, -minY * scale);

  for (const face of faces) {
    drawTexturedWallFace(
      ctx,
      source.src,
      plywoodFacePoint(face, face.start),
      plywoodFacePoint(face, face.end),
      PARTITION_HEIGHT,
      source.width,
      source.height,
    );
  }
  for (const top of tops) {
    paintMergedPlywoodTop(ctx, source.src, source.width, source.height, top);
  }
  return { canvas, originX: minX, originY: minY, scale };
}

function paintMergedPlywoodTop(
  ctx: CanvasRenderingContext2D,
  src: CanvasImageSource,
  srcW: number,
  srcH: number,
  top: PlywoodTopRect,
) {
  if (srcW < 1 || srcH < 1) return;
  const lift = (x: number, y: number) => {
    const p = cartesianToIso(x, y);
    return { x: p.x, y: p.y - PARTITION_HEIGHT };
  };
  const nw = lift(top.x0, top.y0);
  const ne = lift(top.x1, top.y0);
  const se = lift(top.x1, top.y1);
  const sw = lift(top.x0, top.y1);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(nw.x, nw.y);
  ctx.lineTo(ne.x, ne.y);
  ctx.lineTo(se.x, se.y);
  ctx.lineTo(sw.x, sw.y);
  ctx.closePath();
  ctx.clip();
  ctx.transform(
    (se.x - sw.x) / srcW,
    (se.y - sw.y) / srcW,
    (nw.x - sw.x) / srcH,
    (nw.y - sw.y) / srcH,
    sw.x,
    sw.y,
  );
  ctx.drawImage(src, 0, 0, srcW, srcH);
  ctx.restore();
}

function interiorDoorLeafBounds(
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
 * Main camera-facing door parallelogram bottom edge (bl→br = texture U).
 * Closed NS / open EW → east face; closed EW / open NS → south face.
 * U is oriented so the hinge end matches InternalDoor1 hinge side
 * (SE art = right hinge, SW art = left hinge).
 */
function interiorDoorMainFaceBottom(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  axis: "ns" | "ew",
  isOpen: boolean,
): { bl: { x: number; y: number }; br: { x: number; y: number } } {
  const useEastFace = (!isOpen && axis === "ns") || (isOpen && axis === "ew");
  if (useEastFace) {
    // East face: south → north. Hinge is at the north end for both closed-NS
    // (north jamb) and open-EW (north edge still at the west-hinge wall line).
    return {
      bl: cartesianToIso(x1, y1),
      br: cartesianToIso(x1, y0),
    };
  }
  // South face: west → east. Hinge is at the west end for both closed-EW and
  // open-NS (west edge still at the north-hinge wall line).
  return {
    bl: cartesianToIso(x0, y1),
    br: cartesianToIso(x1, y1),
  };
}

/**
 * Crop empty margins and flip upright — same prep as exterior `cropDoorContent`.
 * Face mapping puts source y=0 at the ground, so art must be flipped or it
 * paints upside-down on the parallelogram.
 */
function prepareInteriorDoorArt(
  src: CanvasImageSource,
  srcW: number,
  srcH: number,
): { src: CanvasImageSource; srcW: number; srcH: number } {
  const probe = document.createElement("canvas");
  probe.width = srcW;
  probe.height = srcH;
  const pctx = probe.getContext("2d", { willReadFrequently: true });
  if (!pctx) {
    const flipped = document.createElement("canvas");
    flipped.width = srcW;
    flipped.height = srcH;
    const fctx = flipped.getContext("2d");
    if (!fctx) return { src, srcW, srcH };
    fctx.translate(0, srcH);
    fctx.scale(1, -1);
    fctx.drawImage(src, 0, 0);
    return { src: flipped, srcW, srcH };
  }
  pctx.drawImage(src, 0, 0);
  const { data } = pctx.getImageData(0, 0, srcW, srcH);
  let minX = srcW;
  let minY = srcH;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < srcH; y++) {
    for (let x = 0; x < srcW; x++) {
      const i = (y * srcW + x) * 4;
      const a = data[i + 3]!;
      if (a < 8) continue;
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
  if (maxX < minX || maxY < minY) {
    const flipped = document.createElement("canvas");
    flipped.width = srcW;
    flipped.height = srcH;
    const fctx = flipped.getContext("2d");
    if (!fctx) return { src, srcW, srcH };
    fctx.translate(0, srcH);
    fctx.scale(1, -1);
    fctx.drawImage(src, 0, 0);
    return { src: flipped, srcW, srcH };
  }
  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { src, srcW, srcH };
  ctx.translate(0, h);
  ctx.scale(1, -1);
  ctx.drawImage(probe, minX, minY, w, h, 0, 0, w, h);
  return { src: canvas, srcW: w, srcH: h };
}

/** Affine-map door art onto a wall parallelogram (matches exterior wall doors). */
function paintImageOnDoorFace(
  ctx: CanvasRenderingContext2D,
  strip: CanvasImageSource,
  stripW: number,
  stripH: number,
  bottomLeft: { x: number; y: number },
  bottomRight: { x: number; y: number },
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
  // Exterior building faces bake with high-quality linear filtering — nearest
  // neighbour makes the affine warp look blocky on these tall door sheets.
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(strip, 0, 0, stripW, stripH);
  ctx.restore();
}

function fillDoorPolyCanvas(
  ctx: CanvasRenderingContext2D,
  pts: { x: number; y: number }[],
  color: string,
) {
  if (pts.length < 3) return;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(pts[0]!.x, pts[0]!.y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]!.x, pts[i]!.y);
  ctx.closePath();
  ctx.fill();
}

/**
 * Bake a geometric interior door leaf with door art painted on the main face.
 * Returns a canvas plus its world-space top-left for Image placement.
 */
function bakeTexturedInteriorDoor(
  scene: Phaser.Scene,
  ox: number,
  oy: number,
  axis: "ns" | "ew",
  isOpen: boolean,
  isLocked: boolean,
  artTextureKey: string,
  leafColors: { front: string; side: string; top: string } = {
    front: DOOR_FRONT,
    side: DOOR_SIDE,
    top: DOOR_TOP,
  },
): {
  canvas: HTMLCanvasElement;
  originX: number;
  originY: number;
  scale: number;
} | null {
  const source = resolveImageSource(scene, artTextureKey);
  if (!source || source.width < 1 || source.height < 1) return null;
  const art = prepareInteriorDoorArt(source.src, source.width, source.height);

  const scale = INTERNAL_DOOR_RENDER_SCALE;
  const d = PARTITION_HEIGHT;
  const { x0, y0, x1, y1 } = interiorDoorLeafBounds(ox, oy, axis, isOpen);
  const sw = cartesianToIso(x0, y1);
  const se = cartesianToIso(x1, y1);
  const ne = cartesianToIso(x1, y0);
  const nw = cartesianToIso(x0, y0);
  const face = interiorDoorMainFaceBottom(x0, y0, x1, y1, axis, isOpen);

  const pts = [
    sw,
    se,
    ne,
    nw,
    { x: sw.x, y: sw.y - d },
    { x: se.x, y: se.y - d },
    { x: ne.x, y: ne.y - d },
    { x: nw.x, y: nw.y - d },
  ];
  if (isLocked) {
    pts.push(...doorCodeLockLayout(x0, y0, x1, y1, axis, isOpen).body);
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  const pad = 2;
  minX = Math.floor(minX) - pad;
  minY = Math.floor(minY) - pad;
  maxX = Math.ceil(maxX) + pad;
  maxY = Math.ceil(maxY) + pad;
  const worldW = Math.max(1, maxX - minX);
  const worldH = Math.max(1, maxY - minY);

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(worldW * scale));
  canvas.height = Math.max(1, Math.ceil(worldH * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  // Draw in world units, supersampled — same approach as exterior buildings.
  ctx.scale(scale, scale);
  ctx.translate(-minX, -minY);

  // Leaf shell first; door art paints over the main camera face (exterior-style).
  fillDoorPolyCanvas(
    ctx,
    [sw, se, { x: se.x, y: se.y - d }, { x: sw.x, y: sw.y - d }],
    leafColors.front,
  );
  fillDoorPolyCanvas(
    ctx,
    [se, ne, { x: ne.x, y: ne.y - d }, { x: se.x, y: se.y - d }],
    leafColors.side,
  );
  // Stretch art across the full main face (width + height) — no wood lip.
  paintImageOnDoorFace(
    ctx,
    art.src,
    art.srcW,
    art.srcH,
    face.bl,
    face.br,
    d,
  );

  // Top cap only — side/front under the art is already covered.
  fillDoorPolyCanvas(
    ctx,
    [
      { x: nw.x, y: nw.y - d },
      { x: ne.x, y: ne.y - d },
      { x: se.x, y: se.y - d },
      { x: sw.x, y: sw.y - d },
    ],
    leafColors.top,
  );

  if (isLocked) {
    paintDoorCodeLockCanvas(ctx, doorCodeLockLayout(x0, y0, x1, y1, axis, isOpen));
  }

  return { canvas, originX: minX, originY: minY, scale };
}

/**
 * Draw a player-built door leaf on a wall-run tile. Reuses the same
 * south/east/top face geometry as `drawInteriorPartitionTile`, but colored
 * as wood and posed per `isOpen`: closed fills the run's gap exactly like a
 * normal wall arm; open swings 90° around the jamb where the leaf meets the
 * flanking wall (north hinge for ns runs, west hinge for ew runs).
 */
export function drawInteriorDoorTile(
  g: Phaser.GameObjects.Graphics,
  ox: number,
  oy: number,
  axis: "ns" | "ew",
  isOpen: boolean,
  isLocked: boolean,
) {
  const d = PARTITION_HEIGHT;
  const { x0, y0, x1, y1 } = interiorDoorLeafBounds(ox, oy, axis, isOpen);

  const front = hexToNum(DOOR_FRONT);
  const side = hexToNum(DOOR_SIDE);
  const top = hexToNum(DOOR_TOP);

  const sw = cartesianToIso(x0, y1);
  const se = cartesianToIso(x1, y1);
  fillPartitionPoly(
    g,
    [sw, se, { x: se.x, y: se.y - d }, { x: sw.x, y: sw.y - d }],
    front,
  );

  const ne = cartesianToIso(x1, y0);
  fillPartitionPoly(
    g,
    [se, ne, { x: ne.x, y: ne.y - d }, { x: se.x, y: se.y - d }],
    side,
  );

  const nw = cartesianToIso(x0, y0);
  fillPartitionPoly(
    g,
    [
      { x: nw.x, y: nw.y - d },
      { x: ne.x, y: ne.y - d },
      { x: se.x, y: se.y - d },
      { x: sw.x, y: sw.y - d },
    ],
    top,
  );

  if (isLocked) {
    paintDoorCodeLockGraphics(g, doorCodeLockLayout(x0, y0, x1, y1, axis, isOpen));
  }
}

type DoorFacePt = { x: number; y: number };

/**
 * Door-face axes at the latch. `along` runs latch to hinge (the isometric
 * bottom edge). Up the leaf is screen-up, same as the wall extrusion.
 */
function doorFaceAxes(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  axis: "ns" | "ew",
  isOpen: boolean,
): { latch: DoorFacePt; ux: number; uy: number; faceLen: number } {
  const face = interiorDoorMainFaceBottom(x0, y0, x1, y1, axis, isOpen);
  const useEastFace = (!isOpen && axis === "ns") || (isOpen && axis === "ew");
  const latch = useEastFace ? face.bl : face.br;
  const hinge = useEastFace ? face.br : face.bl;
  const dx = hinge.x - latch.x;
  const dy = hinge.y - latch.y;
  const faceLen = Math.hypot(dx, dy) || 1;
  return { latch, ux: dx / faceLen, uy: dy / faceLen, faceLen };
}

function doorFacePoint(
  axes: { latch: DoorFacePt; ux: number; uy: number },
  along: number,
  up: number,
): DoorFacePt {
  return {
    x: axes.latch.x + axes.ux * along,
    y: axes.latch.y + axes.uy * along - up,
  };
}

/** Parallelogram on the door face. `up0` is the lower edge. */
function doorFaceQuad(
  axes: { latch: DoorFacePt; ux: number; uy: number },
  along0: number,
  along1: number,
  up0: number,
  up1: number,
): DoorFacePt[] {
  return [
    doorFacePoint(axes, along0, up0),
    doorFacePoint(axes, along1, up0),
    doorFacePoint(axes, along1, up1),
    doorFacePoint(axes, along0, up1),
  ];
}

/**
 * Small keypad on the latch side, halfway up the leaf. Quads share the door
 * face so the lock skews with the leaf instead of sitting flat on the screen.
 */
function doorCodeLockLayout(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  axis: "ns" | "ew",
  isOpen: boolean,
): { body: DoorFacePt[]; keys: DoorFacePt[][]; led: DoorFacePt[] } {
  const axes = doorFaceAxes(x0, y0, x1, y1, axis, isOpen);
  const cu = axes.faceLen * 0.18;
  const cv = PARTITION_HEIGHT * 0.46;
  const hw = 6;
  const hh = 4.5;
  const body = doorFaceQuad(axes, cu - hw, cu + hw, cv - hh, cv + hh);
  const key = 1.7;
  const gap = 0.7;
  const baseU = cu - hw + 1.6;
  const baseV = cv - hh + 1.5;
  const keys: DoorFacePt[][] = [];
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 2; col++) {
      const u = baseU + col * (key + gap);
      const v = baseV + row * (key + gap);
      keys.push(doorFaceQuad(axes, u, u + key, v, v + key));
    }
  }
  const ledU = cu + hw - 2.8;
  const ledV = cv + hh - 2.6;
  const led = doorFaceQuad(axes, ledU, ledU + 1.4, ledV - 1.4, ledV);
  return { body, keys, led };
}

function paintDoorCodeLockCanvas(
  ctx: CanvasRenderingContext2D,
  lock: { body: DoorFacePt[]; keys: DoorFacePt[][]; led: DoorFacePt[] },
) {
  fillDoorPolyCanvas(ctx, lock.body, "#1a1a1a");
  for (const key of lock.keys) fillDoorPolyCanvas(ctx, key, "#5a5a5a");
  fillDoorPolyCanvas(ctx, lock.led, "#d7a24a");
}

function paintDoorCodeLockGraphics(
  g: Phaser.GameObjects.Graphics,
  lock: { body: DoorFacePt[]; keys: DoorFacePt[][]; led: DoorFacePt[] },
) {
  fillPartitionPoly(g, lock.body, 0x1a1a1a);
  for (const key of lock.keys) fillPartitionPoly(g, key, 0x5a5a5a);
  fillPartitionPoly(g, lock.led, 0xd7a24a);
}

function fillPartitionPoly(
  g: Phaser.GameObjects.Graphics,
  pts: { x: number; y: number }[],
  color: number,
  alpha = 1,
) {
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
 * Tiles this far away can still put a wall face over a floor diamond or a
 * standing sprite. The sprite is taller than the diamond, so the search is
 * sized for the body, not just the feet.
 */
export const PLAYER_WALL_OCCLUSION_REACH = 6;

export type PlayerWallOccluder =
  | {
      kind: "wall";
      x: number;
      y: number;
      axis: "ns" | "ew" | "both";
      depth: number;
      wallSet: Set<string>;
    }
  | {
      kind: "door";
      x: number;
      y: number;
      axis: "ns" | "ew" | "both";
      isOpen: boolean;
      depth: number;
    };

function polysCoverTarget(
  polys: { x: number; y: number }[][],
  tileX: number,
  tileY: number,
  coverSprite: boolean,
): boolean {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const poly of polys) {
    for (const p of poly) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
  }
  if (!Number.isFinite(minX)) return false;
  const halfW = TILE_WIDTH / 2;
  const halfH = TILE_HEIGHT / 2;
  const tMinX = (tileX - tileY - 1) * halfW;
  const tMaxX = (tileX - tileY + 1) * halfW;
  const tMaxY = (tileX + tileY + 2) * halfH;
  const tMinY = coverSprite
    ? (tileX + tileY + 1) * halfH - ENTITY_RENDER_HEIGHT
    : (tileX + tileY) * halfH;
  return maxX >= tMinX && minX <= tMaxX && maxY >= tMinY && minY <= tMaxY;
}

function doorOcclusionPolys(
  ox: number,
  oy: number,
  axis: "ns" | "ew" | "both",
  isOpen: boolean,
): { x: number; y: number }[][] {
  const polys: { x: number; y: number }[][] = [];
  const addLeaf = (leafAxis: "ns" | "ew") => {
    const d = PARTITION_HEIGHT;
    const { x0, y0, x1, y1 } = interiorDoorLeafBounds(ox, oy, leafAxis, isOpen);
    const sw = cartesianToIso(x0, y1);
    const se = cartesianToIso(x1, y1);
    const ne = cartesianToIso(x1, y0);
    const nw = cartesianToIso(x0, y0);
    polys.push(
      [sw, se, { x: se.x, y: se.y - d }, { x: sw.x, y: sw.y - d }],
      [se, ne, { x: ne.x, y: ne.y - d }, { x: se.x, y: se.y - d }],
      [
        { x: nw.x, y: nw.y - d },
        { x: ne.x, y: ne.y - d },
        { x: se.x, y: se.y - d },
        { x: sw.x, y: sw.y - d },
      ],
    );
  };
  if (axis === "ns" || axis === "both") addLeaf("ns");
  if (axis === "ew" || axis === "both") addLeaf("ew");
  return polys;
}

function wallOccluderPolys(
  wall: PlayerWallOccluder,
): { x: number; y: number }[][] {
  if (wall.kind === "door") {
    return doorOcclusionPolys(wall.x, wall.y, wall.axis, wall.isOpen);
  }
  const { sides, tops } = collectPartitionFaces(
    wall.x,
    wall.y,
    wall.wallSet,
    wall.axis,
  );
  return [...sides.map((face) => face.pts), ...tops.map((face) => face.pts)];
}

/** True when this wall paints over the floor diamond or the standing sprite. */
export function playerWallOccluderHits(
  wall: PlayerWallOccluder,
  depthLimit: number,
  tileX: number,
  tileY: number,
  coverSprite: boolean,
): boolean {
  if (wall.depth <= depthLimit) return false;
  return polysCoverTarget(
    wallOccluderPolys(wall),
    tileX,
    tileY,
    coverSprite,
  );
}

/** White wall or door silhouette. Same faces that are on screen. */
export function stampPlayerWallOccluder(
  g: Phaser.GameObjects.Graphics,
  wall: PlayerWallOccluder,
  depthLimit: number,
  tileX: number,
  tileY: number,
  coverSprite: boolean,
): boolean {
  if (!playerWallOccluderHits(wall, depthLimit, tileX, tileY, coverSprite)) {
    return false;
  }
  for (const poly of wallOccluderPolys(wall)) {
    fillPartitionPoly(g, poly, 0xffffff, 1);
  }
  return true;
}

function hexToNum(hex: string): number {
  return Number.parseInt(hex.replace("#", ""), 16);
}
