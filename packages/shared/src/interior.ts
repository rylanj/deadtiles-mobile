import { mulberry32, xmur3, getBuildingAt, buildingEntranceFace, buildingEntranceSpan, getPlayerSpawnFootprint, houseChimneyInteriorTiles, seededRandom, type BuildingInfo } from "./worldgen.js";
import { RED_MAN_SUPERMARKET_OWN_CHANCE } from "./constants.js";
import {
  isAshenTraderWarehouse,
  isBirchportHospital,
  isBuildingInBirchport,
} from "./birchport.js";

/** Fallback fixed interior size (legacy 2×2 building → 4×4 interior). */
export const INTERIOR_WIDTH = 4;
export const INTERIOR_HEIGHT = 4;

/**
 * Typical free floor tiles in a 2×2 building interior (~4×4 room) after
 * furniture. Zombie count rolls use this reference so larger city lots
 * do not inflate interior spawns.
 */
export const INTERIOR_ZOMBIE_DENSITY_REF_TILES = 12;
/** Hard cap on zombies inside residential (`house`) buildings. */
export const RESIDENTIAL_ZOMBIE_MAX = 4;
/** Forced walker count when a quest has claimed a building. */
export const QUEST_INTERIOR_ZOMBIE_MIN = 2;
export const QUEST_INTERIOR_ZOMBIE_MAX = 8;

/** Always-on pack for a quest-held interior (never rolls empty). */
export function rollQuestInteriorZombieCount(
  freeTileCount: number,
  residential: boolean,
): number {
  if (freeTileCount <= 0) return 0;
  const cap = residential
    ? RESIDENTIAL_ZOMBIE_MAX
    : QUEST_INTERIOR_ZOMBIE_MAX;
  const n = Math.max(
    QUEST_INTERIOR_ZOMBIE_MIN,
    Math.min(cap, Math.ceil(freeTileCount * 0.2) + 1),
  );
  return Math.min(n, freeTileCount);
}

/** Compute interior tile dimensions for the building at (bx, by). 1 exterior tile = 2 interior tiles. */
export function interiorDimensions(bx: number, by: number): { iW: number; iH: number } {
  const bld = getBuildingAt(bx, by);
  if (!bld) return { iW: INTERIOR_WIDTH, iH: INTERIOR_HEIGHT };
  return { iW: bld.w * 2, iH: bld.h * 2 };
}

/** Interior doorway aligned to the building's exterior entrance face. */
export type InteriorExit = {
  /** Floor tile just inside the doorway. */
  insideX: number;
  insideY: number;
  /** One step outside the wall (spawn / click-to-exit). */
  outsideX: number;
  outsideY: number;
  face: "SE" | "SW";
  /**
   * Inclusive interior-tile range along the doorway axis (Y for SE, X for SW).
   * Covers the full exterior entranceSpan × 2 interior tiles.
   */
  alongMin: number;
  alongMax: number;
};

/** Map exterior entrance → interior exit (2 interior tiles per exterior tile). */
export function interiorExitForBuilding(bld: BuildingInfo): InteriorExit {
  const iW = bld.w * 2;
  const iH = bld.h * 2;
  const lx = bld.entranceX - bld.ox;
  const ly = bld.entranceY - bld.oy;
  const span = buildingEntranceSpan(bld);
  if (buildingEntranceFace(bld) === "SE") {
    const alongMin = Math.max(0, ly * 2);
    const alongMax = Math.min(iH - 1, (ly + span) * 2 - 1);
    const iy = Math.max(alongMin, Math.min(alongMax, ly * 2 + 1));
    return {
      insideX: iW - 1,
      insideY: iy,
      outsideX: iW,
      outsideY: iy,
      face: "SE",
      alongMin,
      alongMax,
    };
  }
  const alongMin = Math.max(0, lx * 2);
  const alongMax = Math.min(iW - 1, (lx + span) * 2 - 1);
  const ix = Math.max(alongMin, Math.min(alongMax, lx * 2 + 1));
  return {
    insideX: ix,
    insideY: iH - 1,
    outsideX: ix,
    outsideY: iH,
    face: "SW",
    alongMin,
    alongMax,
  };
}

export function interiorExitForBuildingAt(bx: number, by: number): InteriorExit {
  const bld = getBuildingAt(bx, by);
  const { iW, iH } = interiorDimensions(bx, by);
  if (!bld) {
    return {
      insideX: iW - 1,
      insideY: Math.min(1, iH - 1),
      outsideX: iW,
      outsideY: Math.min(1, iH - 1),
      face: "SE",
      alongMin: Math.min(1, iH - 1),
      alongMax: Math.min(1, iH - 1),
    };
  }
  return interiorExitForBuilding(bld);
}

/** Interior spawn — centred on the outside exit tile. */
export function interiorSpawnPos(exit: InteriorExit) {
  return { x: exit.outsideX + 0.5, y: exit.outsideY + 0.5 };
}

/** Facing when entering: look into the room from the doorway. */
export function interiorEntryFacing(exit: InteriorExit): number {
  return exit.face === "SE" ? 7 : 1; // NW from east door, NE from south door
}

/** Facing when exiting: look outward along the door direction. */
export function interiorExitFacing(exit: InteriorExit): number {
  return exit.face === "SE" ? 3 : 5; // SE from east door, SW from south door
}

/** @deprecated use interiorExitForBuilding / outside tile */
export function interiorExitTile(iW: number) {
  return { x: iW, y: 1 };
}

export const SEARCH_RANGE = 1.5;
/**
 * Talk and trade distance across the Ashen market counter.
 * The player stands one lobby tile in front of a 1-tile counter, and the
 * trader stands one tile behind it, so the centers are 2 tiles apart.
 */
export const ASHEN_MARKET_TALK_RANGE = 2.75;
export const SEARCH_DURATION_MS = 5000;

/** Facing W, NW, N — enter from the east (SE face). */
export const BUILDING_ENTRY_FACINGS_SE = new Set([6, 7, 0]);
/** Facing N, NE, NW — enter from the south (SW face). */
export const BUILDING_ENTRY_FACINGS_SW = new Set([0, 1, 7]);
/** @deprecated prefer canEnterBuildingFacing(facing, bld) */
export const BUILDING_ENTRY_FACINGS = BUILDING_ENTRY_FACINGS_SE;

export const FURNITURE_TYPES = [
  "desk",
  "desk2",
  /** Office bullpen. Placed by layout, not rolled. */
  "desk3",
  "bigshelf",
  "bigbox",
  "watercontainer",
  "cabinet",
  "workbench",
  "bed",
  "dresser",
  "bookshelf",
  "bookshelf2",
  "lockers",
  "drawers",
  "guncabinet",
  "fridge",
  "kitchensink",
  "dinnertable",
  "nightstand",
  "deadofficer",
  "bagchair",
  /** House seating. Not placed in kitchens. */
  "armchair",
  "sofa",
  "suitcase",
  "watercooler",
  "trashcan",
  "checkout",
  "supershelf1",
  "supershelf2",
  "superfridge1",
  "hospitalbed",
  /** Occupied ward beds (soldier) — Birchport only, not searchable. */
  "hospitalbed2",
  "hospitalbed3",
  "ivstand",
  "medicalcart",
  "medicalreception",
  "medicaldrawers",
  "threeseater",
  "threeseater2",
  "threeseater3",
  "vendingmachine",
  "counter",
  "motelbed",
  "minifridge",
  /** Player-dropped floor bag (Backpack1) — walkable loot pile. */
  "groundbackpack",
  /** Birchport barracks tent / mess hall. */
  "militarybed",
  "footlocker",
  "kitbag",
  "camptable",
  "campchair",
  "militarybasket",
  "range",
  "hotdisplay",
  "drinkdisplay",
  "canteentable1",
  "canteentable2",
  "canteentable3",
  /** Empty canteen table used as the Ashen market counter. Not loot. */
  "canteentable4",
  "canteenchair",
  /** Barracks tent floor lantern. Not loot. */
  "lantern1",
  /** Warehouse Furnace1. Fueled like a fireplace. Not loot. */
  "furnace",
  /** House Mantel1. Fueled like a fireplace, aligned to the chimney. Not loot. */
  "mantel",
  /** Office meeting room. Chairs are in the art. */
  "conferencetable",
  /** Office. Searchable. */
  "copier",
  /** Office bullpen. Not loot. */
  "officechair",
  /** Office meeting room. Not loot. */
  "whiteboard",
  /** Office stairs between storeys. Not loot. */
  "stairs",
  /** Large retail. Placed by layout, not rolled. */
  "clothingrack1",
  "clothingrack2",
  "clothingrack3",
  "mannequin1",
  "mannequin2",
  "mannequin3",
  "cart1",
  "cart2",
  "retailshelf1",
  "retailshelf2",
  "retailshelf3",
  "retailcase1",
  "retailcase2",
] as const;

export type FurnitureType = (typeof FURNITURE_TYPES)[number];

const FURNITURE_DISPLAY_NAMES: Record<string, string> = {
  desk: "Desk",
  desk2: "Desk",
  desk3: "Desk",
  bigshelf: "Shelf",
  bigbox: "Crate",
  watercontainer: "Water Container",
  cabinet: "Cabinet",
  workbench: "Workbench",
  bed: "Bed",
  dresser: "Dresser",
  bookshelf: "Bookshelf",
  bookshelf2: "Bookshelf",
  lockers: "Lockers",
  drawers: "Drawers",
  guncabinet: "Gun Cabinet",
  fridge: "Fridge",
  kitchensink: "Kitchen Sink",
  dinnertable: "Dinner Table",
  nightstand: "Nightstand",
  deadofficer: "Dead Officer",
  bagchair: "Chair",
  armchair: "Armchair",
  sofa: "Sofa",
  suitcase: "Suitcase",
  watercooler: "Water Cooler",
  trashcan: "Trash Can",
  checkout: "Checkout",
  supershelf1: "Shelf",
  supershelf2: "Shelf",
  superfridge1: "Fridge",
  hospitalbed: "Hospital Bed",
  hospitalbed2: "Hospital Bed",
  hospitalbed3: "Hospital Bed",
  ivstand: "IV Stand",
  medicalcart: "Medical Cart",
  medicalreception: "Reception Desk",
  medicaldrawers: "Medical Drawers",
  threeseater: "Bench",
  threeseater2: "Bench",
  threeseater3: "Bench",
  vendingmachine: "Vending Machine",
  counter: "Counter",
  motelbed: "Bed",
  minifridge: "Mini Fridge",
  groundbackpack: "Dropped Items",
  militarybed: "Camp Bed",
  footlocker: "Footlocker",
  kitbag: "Kit Bag",
  camptable: "Camp Table",
  campchair: "Camp Chair",
  militarybasket: "Laundry Basket",
  range: "Range",
  hotdisplay: "Hot Display",
  drinkdisplay: "Drink Station",
  canteentable1: "Canteen Table",
  canteentable2: "Canteen Table",
  canteentable3: "Canteen Table",
  canteentable4: "Canteen Table",
  canteenchair: "Canteen Chair",
  lantern1: "Lantern",
  furnace: "Furnace",
  mantel: "Fireplace",
  conferencetable: "Conference Table",
  copier: "Copier",
  officechair: "Office Chair",
  whiteboard: "Whiteboard",
  stairs: "Stairs",
  clothingrack1: "Clothing Rack",
  clothingrack2: "Clothing Rack",
  clothingrack3: "Clothing Rack",
  mannequin1: "Mannequin",
  mannequin2: "Mannequin",
  mannequin3: "Mannequin",
  cart1: "Shopping Cart",
  cart2: "Shopping Cart",
  retailshelf1: "Shelf",
  retailshelf2: "Shelf",
  retailshelf3: "Shelf",
  retailcase1: "Jewelry Case",
  retailcase2: "Watch Case",
  fallentree: "Fallen Tree",
  zombie: "Zombie",
  guard: "Guard",
};

function furnitureDisplayKey(objectType: string): string {
  return objectType.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

/** Player-facing furniture name. Strips variant numbers (Desk2 → Desk). */
export function furnitureDisplayName(objectType: string): string {
  if (!objectType) return "Loot";
  const mapped = FURNITURE_DISPLAY_NAMES[furnitureDisplayKey(objectType)];
  if (mapped) return mapped;
  const spaced = objectType
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Za-z])\d+/g, "$1")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!spaced) return "Loot";
  return spaced.replace(/\b\w/g, (c) => c.toUpperCase());
}
export type SearchableKind = "furniture";
/** Iso facing encoded in furniture texture names (e.g. Desk1_Idle_SW). */
export type FurnitureFacing = "NE" | "NW" | "SE" | "SW";

export type SearchableObject = {
  id: string;
  kind: SearchableKind;
  objectType: string;
  /** Origin tile (min x / min y of footprint). */
  x: number;
  y: number;
  searched: boolean;
  /** Empty + on loot cooldown — not interactable. */
  depleted?: boolean;
  buildingX: number;
  buildingY: number;
  /** Interior storey. Omitted means the ground floor. */
  level?: number;
  /** Optional override when a piece has multiple texture facings (e.g. Fridge1 / KitchenSink1 SE/SW). */
  facing?: FurnitureFacing;
};

/** Non-searchable interior partition tile (blocks movement). */
export type InteriorWallTile = { x: number; y: number };

/** Screen-space sprite heights scaled to match the new 80px entity render height. */
export const FURNITURE_RENDER_HEIGHT_PX = 80;
/** BigShelf1 is a tall warehouse unit — slightly larger on screen. */
export const BIGSHELF_RENDER_HEIGHT_PX = Math.round(FURNITURE_RENDER_HEIGHT_PX * 1.35);

/** Player collision half-size in tile-grid units. */
export const INTERIOR_PLAYER_RADIUS = 0.12;

/** Tile footprint (w×h) for furniture. BigShelf1 is 2 tiles along the NE–SW wall axis. */
export function furnitureFootprint(
  objectType: string,
  facing?: string,
): { w: number; h: number } {
  // West wall runs NE–SW in iso (+y); shelf spans two tiles along that edge.
  if (objectType === "bigshelf") return { w: 1, h: 2 };
  // Lockers1: 2 tiles along the wall (SE→NW / +y, SW→NE / +x).
  if (objectType === "lockers") {
    const f =
      facing === "SE" || facing === "SW"
        ? facing
        : furnitureFacing("lockers");
    return f === "SE" ? { w: 1, h: 2 } : { w: 2, h: 1 };
  }
  // Bed1 SE: headboard NW → foot SE, two tiles along the SE–NW axis.
  if (objectType === "bed") return { w: 2, h: 1 };
  // KitchenSink1: 2 tiles along the wall it sits on (SE→NW wall / +y, SW→NE wall / +x).
  if (objectType === "kitchensink") {
    const f =
      facing === "SE" || facing === "SW"
        ? facing
        : furnitureFacing("kitchensink");
    return f === "SE" ? { w: 1, h: 2 } : { w: 2, h: 1 };
  }
  // Workbench1 — SE only. 2×1 along the NE–SW wall (same span as DinnerTable1 SE).
  if (objectType === "workbench") return { w: 1, h: 2 };
  // DinnerTable1 — 2×1 freestanding kitchen table (SE + SW art).
  if (objectType === "dinnertable") {
    const f =
      facing === "SE" || facing === "SW"
        ? facing
        : furnitureFacing("dinnertable");
    return f === "SE" ? { w: 1, h: 2 } : { w: 2, h: 1 };
  }
  // Checkout1 — SE: 2×3, SW: 3×2 (used for SE-facing supermarket entrances).
  if (objectType === "checkout") {
    const f =
      facing === "SE" || facing === "SW"
        ? facing
        : furnitureFacing("checkout");
    return f === "SE" ? { w: 2, h: 3 } : { w: 3, h: 2 };
  }
  // SuperShelf1 / SuperShelf2 — SE: 1×3, SW: 3×1 aisle gondolas.
  if (objectType === "supershelf1" || objectType === "supershelf2") {
    const f =
      facing === "SE" || facing === "SW"
        ? facing
        : furnitureFacing(objectType);
    return f === "SE" ? { w: 1, h: 3 } : { w: 3, h: 1 };
  }
  // SuperFridge1 — SW: 2×1 on NE wall; SE: 1×2 on NW wall.
  if (objectType === "superfridge1") {
    const f =
      facing === "SE" || facing === "SW"
        ? facing
        : furnitureFacing("superfridge1");
    return f === "SE" ? { w: 1, h: 2 } : { w: 2, h: 1 };
  }
  // HospitalBed1/2/3 — SE: 2×1 (head NW); SW: 1×2 (head NE).
  if (
    objectType === "hospitalbed" ||
    objectType === "hospitalbed2" ||
    objectType === "hospitalbed3"
  ) {
    const f =
      facing === "SE" || facing === "SW"
        ? facing
        : furnitureFacing(objectType);
    return f === "SE" ? { w: 2, h: 1 } : { w: 1, h: 2 };
  }
  // MotelBed1 — same footprint as HospitalBed1.
  if (objectType === "motelbed") {
    const f =
      facing === "SE" || facing === "SW"
        ? facing
        : furnitureFacing("motelbed");
    return f === "SE" ? { w: 2, h: 1 } : { w: 1, h: 2 };
  }
  // Counter1 — reception desk along the lobby: SE 1×2, SW 2×1.
  if (objectType === "counter") {
    const f =
      facing === "SE" || facing === "SW"
        ? facing
        : furnitureFacing("counter");
    return f === "SE" ? { w: 1, h: 2 } : { w: 2, h: 1 };
  }
  // MilitaryBed1 — same span as Bed1 / HospitalBed1.
  if (objectType === "militarybed") {
    const f =
      facing === "SE" || facing === "SW"
        ? facing
        : furnitureFacing("militarybed");
    return f === "SE" ? { w: 2, h: 1 } : { w: 1, h: 2 };
  }
  // CampTable1 / CanteenTable1-4 / HotDisplay1 / DrinkDisplay1.
  // Long axis along the wall they face (SE 1x2, SW 2x1). Range1 is 1x1.
  if (
    objectType === "camptable" ||
    objectType === "canteentable1" ||
    objectType === "canteentable2" ||
    objectType === "canteentable3" ||
    objectType === "canteentable4" ||
    objectType === "hotdisplay" ||
    objectType === "drinkdisplay"
  ) {
    const f =
      facing === "SE" || facing === "SW"
        ? facing
        : furnitureFacing(objectType);
    return f === "SE" ? { w: 1, h: 2 } : { w: 2, h: 1 };
  }
  // ConferenceTable1 — chairs are painted in. SE 3×4, SW 4×3.
  if (objectType === "conferencetable") {
    const f =
      facing === "SE" || facing === "SW"
        ? facing
        : furnitureFacing("conferencetable");
    return f === "SE" ? { w: 3, h: 5 } : { w: 5, h: 3 };
  }
  // Whiteboard1 — freestanding board. SE 1×2, SW 2×1.
  if (objectType === "whiteboard") {
    const f =
      facing === "SE" || facing === "SW"
        ? facing
        : furnitureFacing("whiteboard");
    return f === "SE" ? { w: 1, h: 2 } : { w: 2, h: 1 };
  }
  // Mantel1 — 2 tiles along the chimney wall (SE on the west wall, SW on the north).
  if (objectType === "mantel") {
    const f =
      facing === "SE" || facing === "SW"
        ? facing
        : furnitureFacing("mantel");
    return f === "SE" ? { w: 1, h: 2 } : { w: 2, h: 1 };
  }
  // MedicalReception1 — SW only: 3×2 lobby desk (same span as Checkout1 SW).
  if (objectType === "medicalreception") return { w: 3, h: 2 };
  // Sofa1 — two-seat couch. SE 1×2 along the west wall, SW 2×1 along the north.
  if (objectType === "sofa") {
    const f =
      facing === "SE" || facing === "SW"
        ? facing
        : furnitureFacing("sofa");
    return f === "SE" ? { w: 1, h: 2 } : { w: 2, h: 1 };
  }
  // ThreeSeater / 2 / 3 — SE waiting bench, 1×2 footprint.
  if (
    objectType === "threeseater" ||
    objectType === "threeseater2" ||
    objectType === "threeseater3"
  ) {
    const f =
      facing === "SE" || facing === "SW"
        ? facing
        : furnitureFacing(objectType);
    return f === "SE" ? { w: 1, h: 2 } : { w: 2, h: 1 };
  }
  // Desk3 — office bullpen. SW 2×1, SE 1×2.
  if (objectType === "desk3") {
    const f =
      facing === "SE" || facing === "SW"
        ? facing
        : furnitureFacing("desk3");
    return f === "SE" ? { w: 1, h: 2 } : { w: 2, h: 1 };
  }
  // ClothingRack1-3: long rail. SE 1x2, SW 2x1.
  if (
    objectType === "clothingrack1" ||
    objectType === "clothingrack2" ||
    objectType === "clothingrack3"
  ) {
    const f =
      facing === "SE" || facing === "SW"
        ? facing
        : furnitureFacing(objectType);
    return f === "SE" ? { w: 1, h: 2 } : { w: 2, h: 1 };
  }
  // RetailShelf1-3: aisle gondolas, same span as SuperShelf. SE 1x3, SW 3x1.
  // RetailCase1/2: glass counters, same span. SE 1x3, SW 3x1.
  if (
    objectType === "retailshelf1" ||
    objectType === "retailshelf2" ||
    objectType === "retailshelf3" ||
    objectType === "retailcase1" ||
    objectType === "retailcase2"
  ) {
    const f =
      facing === "SE" || facing === "SW"
        ? facing
        : furnitureFacing(objectType);
    return f === "SE" ? { w: 1, h: 3 } : { w: 3, h: 1 };
  }
  // Stairs1 — 2×3, flush to a wall on the long side.
  // SE runs along X (3×2, north edge on the wall). SW runs along Y (2×3, west edge on the wall).
  if (objectType === "stairs") {
    const f =
      facing === "SE" || facing === "SW"
        ? facing
        : furnitureFacing("stairs");
    return f === "SE" ? { w: 3, h: 2 } : { w: 2, h: 3 };
  }
  return { w: 1, h: 1 };
}

/**
 * Iso facing encoded in furniture texture names (e.g. Desk1_Idle_SW, BigShelf1_Idle_SE).
 * The player approaches from this side and faces back toward the furniture.
 */
const FURNITURE_FACING: Record<string, FurnitureFacing> = {
  desk: "SW",
  desk2: "SW",
  desk3: "SW",
  bigshelf: "SE",
  bigbox: "SW",
  watercontainer: "SW",
  cabinet: "SW",
  workbench: "SE",
  bed: "SE",
  dresser: "SW",
  bookshelf: "SE",
  bookshelf2: "SW",
  lockers: "SW",
  drawers: "SW",
  guncabinet: "SE",
  fridge: "SE",
  kitchensink: "SW",
  dinnertable: "SE",
  nightstand: "SE",
  deadofficer: "SW",
  bagchair: "SW",
  armchair: "SE",
  sofa: "SE",
  suitcase: "SW",
  watercooler: "SW",
  trashcan: "SE",
  checkout: "SE",
  supershelf1: "SE",
  supershelf2: "SE",
  superfridge1: "SW",
  hospitalbed: "SE",
  hospitalbed2: "SE",
  hospitalbed3: "SE",
  ivstand: "SE",
  medicalcart: "SE",
  medicalreception: "SW",
  medicaldrawers: "SW",
  threeseater: "SE",
  threeseater2: "SE",
  threeseater3: "SE",
  vendingmachine: "SW",
  counter: "SE",
  motelbed: "SE",
  minifridge: "SE",
  groundbackpack: "SE",
  militarybed: "SE",
  footlocker: "SE",
  kitbag: "SE",
  camptable: "SE",
  campchair: "SE",
  militarybasket: "SE",
  range: "SE",
  hotdisplay: "SE",
  drinkdisplay: "SE",
  canteentable1: "SE",
  canteentable2: "SE",
  canteentable3: "SE",
  canteentable4: "SE",
  canteenchair: "SE",
  lantern1: "SE",
  furnace: "SE",
  mantel: "SE",
  conferencetable: "SE",
  copier: "SW",
  officechair: "SW",
  whiteboard: "SW",
  stairs: "SW",
  clothingrack1: "SE",
  clothingrack2: "SE",
  clothingrack3: "SE",
  mannequin1: "SE",
  mannequin2: "SE",
  mannequin3: "SE",
  cart1: "SE",
  cart2: "SE",
  retailshelf1: "SE",
  retailshelf2: "SE",
  retailshelf3: "SE",
  retailcase1: "SE",
  retailcase2: "SE",
};

/** Facings available for Drawers1 art (SE + SW). */
export const DRAWERS_FACINGS: readonly FurnitureFacing[] = ["SE", "SW"];

/** Facings available for Bookshelf1 art (SE + SW). */
export const BOOKSHELF_FACINGS: readonly FurnitureFacing[] = ["SE", "SW"];

/**
 * True when a dinner-table footprint sits at most `maxGap` tiles from a room
 * edge (0 = flush, 1 = one empty tile between table and bound). Keeps tables
 * from parking in the middle and blocking kitchen appliance access.
 */
export function dinnerTableNearBound(
  x: number,
  y: number,
  tw: number,
  th: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  maxGap = 1,
): boolean {
  const gapX0 = x - x0;
  const gapX1 = x1 - (x + tw - 1);
  const gapY0 = y - y0;
  const gapY1 = y1 - (y + th - 1);
  return Math.min(gapX0, gapX1, gapY0, gapY1) <= maxGap;
}

/** Facings available for Fridge1 art (SE + SW). */
export const FRIDGE_FACINGS: readonly FurnitureFacing[] = ["SE", "SW"];

/** Facings available for Cabinet1 art (SE + SW). */
export const CABINET_FACINGS: readonly FurnitureFacing[] = ["SE", "SW"];

/** Facings available for Checkout1 art (SE + SW). */
export const CHECKOUT_FACINGS: readonly FurnitureFacing[] = ["SE", "SW"];

/** Facings available for SuperShelf1/2 art (SE + SW). */
export const SUPERSHELF_FACINGS: readonly FurnitureFacing[] = ["SE", "SW"];

/** Facings available for SuperFridge1 art (SE + SW). */
export const SUPERFRIDGE_FACINGS: readonly FurnitureFacing[] = ["SE", "SW"];

/** Facings available for HospitalBed1 / IVStand1 / MedicalCart1 art (SE + SW). */
export const HOSPITAL_FURNITURE_FACINGS: readonly FurnitureFacing[] = ["SE", "SW"];

/** Facings available for Counter1 / MotelBed1 art (SE + SW). */
export const MOTEL_FURNITURE_FACINGS: readonly FurnitureFacing[] = ["SE", "SW"];

/** World-tile step in the named iso facing (matches DIRECTION_LABELS / screen axes). */
const ISO_FACING_TILE_DELTA: Record<FurnitureFacing, { dx: number; dy: number }> = {
  NE: { dx: 0, dy: -1 },
  SE: { dx: 1, dy: 0 },
  SW: { dx: 0, dy: 1 },
  NW: { dx: -1, dy: 0 },
};

export function furnitureFacing(
  objectTypeOrObj: string | { objectType?: string; facing?: string },
): FurnitureFacing {
  if (typeof objectTypeOrObj !== "string") {
    const f = objectTypeOrObj.facing;
    if (f === "NE" || f === "NW" || f === "SE" || f === "SW") return f;
    return furnitureFacing(objectTypeOrObj.objectType ?? "");
  }
  return FURNITURE_FACING[objectTypeOrObj] ?? "SW";
}

/** Furniture that blocks zombie line-of-sight (aggro). */
const VISION_BLOCKING_FURNITURE = new Set([
  "bigshelf",
  "bigbox",
  "watercontainer",
  "supershelf1",
  "supershelf2",
  "superfridge1",
  "clothingrack1",
  "clothingrack2",
  "clothingrack3",
  "retailshelf1",
  "retailshelf2",
  "retailshelf3",
]);

export function furnitureBlocksVision(objectType: string): boolean {
  return VISION_BLOCKING_FURNITURE.has(objectType);
}

/**
 * Furniture tall and solid enough to stop a bullet. Deliberately separate from
 * VISION_BLOCKING_FURNITURE, which only drives zombie aggro line of sight.
 */
const BULLET_BLOCKING_FURNITURE = new Set([
  "bigshelf",
  "bookshelf",
  "bookshelf2",
  "cabinet",
  "guncabinet",
  "lockers",
  "range",
  "medicaldrawers",
  "superfridge1",
  "supershelf1",
  "supershelf2",
  "vendingmachine",
  "clothingrack1",
  "clothingrack2",
  "clothingrack3",
  "retailshelf1",
  "retailshelf2",
  "retailshelf3",
]);

export function furnitureBlocksBullets(objectType: string): boolean {
  return BULLET_BLOCKING_FURNITURE.has(objectType);
}

/** Furnace1 or house Mantel1. Opens the wood-fuel UI, not a loot container. */
export function furnitureIsFurnace(objectType: string): boolean {
  return objectType === "furnace" || objectType === "mantel";
}

/** Stairs1. Changes interior storey. Not a loot container. */
export function furnitureIsStairs(objectType: string): boolean {
  return objectType === "stairs";
}

/** Shop shelves a supply scout can count. */
const SUPPLY_SHELF_TYPES = new Set([
  "bigshelf",
  "supershelf1",
  "supershelf2",
  "retailshelf1",
  "retailshelf2",
  "retailshelf3",
]);

export function isSupplyShelf(objectType: string): boolean {
  return SUPPLY_SHELF_TYPES.has(objectType);
}

/** Fridges a supply scout can count. */
const SUPPLY_FRIDGE_TYPES = new Set(["fridge", "superfridge1", "minifridge"]);

export function isSupplyFridge(objectType: string): boolean {
  return SUPPLY_FRIDGE_TYPES.has(objectType);
}

export function searchableFootprint(obj: {
  kind: string;
  objectType?: string;
  facing?: string;
}): { w: number; h: number } {
  if (obj.objectType) {
    return furnitureFootprint(obj.objectType, obj.facing);
  }
  return { w: 1, h: 1 };
}

/** True when tile (tx, ty) lies inside the object's footprint. */
export function searchableOccupiesTile(
  obj: { kind: string; objectType?: string; x: number; y: number },
  tx: number,
  ty: number,
): boolean {
  const { w, h } = searchableFootprint(obj);
  return tx >= obj.x && tx < obj.x + w && ty >= obj.y && ty < obj.y + h;
}

/**
 * Walkable tiles on the furniture's front (texture-facing) side only.
 * Used for placement reservation so rooms stay densely packed.
 */
export function furnitureFrontApproachTiles(obj: {
  kind: string;
  objectType?: string;
  x: number;
  y: number;
  facing?: string;
}): { x: number; y: number }[] {
  if (obj.kind !== "furniture" || !obj.objectType) return [];
  const { dx, dy } = ISO_FACING_TILE_DELTA[furnitureFacing(obj)];
  const { w, h } = searchableFootprint(obj);

  // Stairs are walked from the open side, opposite the wall they sit against.
  if (obj.objectType === "stairs") {
    const out: { x: number; y: number }[] = [];
    if (h > w) {
      for (let ty = obj.y; ty < obj.y + h; ty++) out.push({ x: obj.x + w, y: ty });
    } else {
      for (let tx = obj.x; tx < obj.x + w; tx++) out.push({ x: tx, y: obj.y + h });
    }
    return out;
  }

  // SuperShelf1/2: loot tile is only the middle front neighbour.
  if (
    obj.objectType === "supershelf1" ||
    obj.objectType === "supershelf2" ||
    obj.objectType === "retailshelf1" ||
    obj.objectType === "retailshelf2" ||
    obj.objectType === "retailshelf3" ||
    obj.objectType === "retailcase1" ||
    obj.objectType === "retailcase2"
  ) {
    const mx = obj.x + Math.floor((w - 1) / 2);
    const my = obj.y + Math.floor((h - 1) / 2);
    const ax = mx + dx;
    const ay = my + dy;
    if (searchableOccupiesTile(obj, ax, ay)) return [];
    return [{ x: ax, y: ay }];
  }

  // MedicalReception1 (SW): loot from the nearest SE neighbour of the footprint.
  if (obj.objectType === "medicalreception") {
    const ax = obj.x + w;
    const ay = obj.y + Math.floor((h - 1) / 2);
    if (searchableOccupiesTile(obj, ax, ay)) return [];
    return [{ x: ax, y: ay }];
  }

  const out: { x: number; y: number }[] = [];
  const seen = new Set<string>();
  for (let ty = obj.y; ty < obj.y + h; ty++) {
    for (let tx = obj.x; tx < obj.x + w; tx++) {
      const ax = tx + dx;
      const ay = ty + dy;
      if (searchableOccupiesTile(obj, ax, ay)) continue;
      const key = `${ax},${ay}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ x: ax, y: ay });
    }
  }
  return out;
}

/**
 * Walkable orthogonal neighbour tiles of the footprint (any side).
 * Used for loot / craft adjacency and as a pathfinding approach target.
 */
export function furnitureApproachTiles(obj: {
  kind: string;
  objectType?: string;
  x: number;
  y: number;
  facing?: string;
}): { x: number; y: number }[] {
  if (obj.kind !== "furniture" || !obj.objectType) return [];
  const { w, h } = searchableFootprint(obj);
  const out: { x: number; y: number }[] = [];
  const seen = new Set<string>();
  const add = (ax: number, ay: number) => {
    if (searchableOccupiesTile(obj, ax, ay)) return;
    const key = `${ax},${ay}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ x: ax, y: ay });
  };
  for (let tx = obj.x; tx < obj.x + w; tx++) {
    add(tx, obj.y - 1);
    add(tx, obj.y + h);
  }
  for (let ty = obj.y; ty < obj.y + h; ty++) {
    add(obj.x - 1, ty);
    add(obj.x + w, ty);
  }
  return out;
}

/** Nearest walkable approach tile centre (any neighbouring side), or null. */
export function furnitureApproachGoal(
  startX: number,
  startY: number,
  obj: { kind: string; objectType?: string; x: number; y: number; facing?: string },
  isWalkable: (tx: number, ty: number) => boolean,
): { x: number; y: number } | null {
  const pickNearest = (tiles: { x: number; y: number }[]) => {
    let best: { x: number; y: number } | null = null;
    let bestDist = Infinity;
    for (const t of tiles) {
      if (!isWalkable(t.x, t.y)) continue;
      const d = Math.hypot(startX - (t.x + 0.5), startY - (t.y + 0.5));
      if (d < bestDist) {
        bestDist = d;
        best = t;
      }
    }
    return best;
  };

  // Floor bags / felled trees are walkable — path onto the tile itself.
  if (obj.objectType === "groundbackpack" || obj.objectType === "fallenTree") {
    if (isWalkable(obj.x, obj.y)) {
      return { x: obj.x + 0.5, y: obj.y + 0.5 };
    }
    const side = pickNearest(furnitureApproachTiles(obj));
    return side ? { x: side.x + 0.5, y: side.y + 0.5 } : null;
  }

  const best = pickNearest(furnitureApproachTiles(obj));
  if (!best) return null;
  return { x: best.x + 0.5, y: best.y + 0.5 };
}

export function findFurnitureAtTile<
  T extends { kind: string; objectType?: string; x: number; y: number },
>(furnitures: T[], tx: number, ty: number): T | null {
  for (const f of furnitures) {
    if (f.kind === "furniture" && searchableOccupiesTile(f, tx, ty)) return f;
  }
  return null;
}

/** Furniture whose front approach includes (tx, ty). Prefers front-side matches. */
export function findFurnitureByApproachTile<
  T extends { kind: string; objectType?: string; x: number; y: number; facing?: string },
>(furnitures: T[], tx: number, ty: number): T | null {
  const frontMatches: T[] = [];
  const anyMatches: T[] = [];
  for (const f of furnitures) {
    if (f.kind !== "furniture") continue;
    if (furnitureFrontApproachTiles(f).some((t) => t.x === tx && t.y === ty)) {
      frontMatches.push(f);
    } else if (furnitureApproachTiles(f).some((t) => t.x === tx && t.y === ty)) {
      anyMatches.push(f);
    }
  }
  const pool = frontMatches.length > 0 ? frontMatches : anyMatches;
  if (pool.length === 0) return null;
  if (pool.length === 1) return pool[0]!;

  let best = pool[0]!;
  let bestDist = distanceToSearchable(tx + 0.5, ty + 0.5, best);
  for (let i = 1; i < pool.length; i++) {
    const f = pool[i]!;
    const d = distanceToSearchable(tx + 0.5, ty + 0.5, f);
    if (d < bestDist) {
      bestDist = d;
      best = f;
    }
  }
  return best;
}

// ─── Generation ─────────────────────────────────────────────────────────────

const FURNITURE_SPAWN_CHANCE: Record<FurnitureType, number> = {
  desk: 0.5,
  /** Police bullpen — placed by layout, chance unused. */
  desk2: 1,
  /** Office bullpen — placed by layout, never rolled. */
  desk3: 0,
  bigshelf: 0.9,
  /** Per shelf aisle — rolled at the SW end of the row. */
  bigbox: 0.18,
  /** Per shelf aisle — rolled at the SW end of the row (same slot as BigBox1). */
  watercontainer: 0.18,
  /** Warehouses always place one office pair — chance unused. */
  cabinet: 1,
  /** Warehouses outside Birchport — at most one, not guaranteed. */
  workbench: 0.4,
  /** Residential (house) — try to place one flush against a wall. */
  bed: 1,
  dresser: 0.5,
  bookshelf: 0.5,
  /** Police — always placed by layout. */
  bookshelf2: 1,
  lockers: 1,
  drawers: 0.5,
  /** Residential — very rare. */
  guncabinet: 0.03,
  /** Residential — common kitchen appliance. */
  fridge: 0.75,
  /** Always placed beside a fridge when one exists — chance unused. */
  kitchensink: 1,
  /** House kitchens — freestanding DinnerTable1. */
  dinnertable: 0.5,
  /** Residential — only beside a bed, wall-flush. */
  nightstand: 0.55,
  /** Police — at most one, beside a Desk2. */
  deadofficer: 0.45,
  /** Police desk chair. Also one roll in a house living room or rural cabin. */
  bagchair: 0.55,
  /** Houses, outside the kitchen. */
  armchair: 0.5,
  sofa: 0.55,
  /** Residential — floor suitcase, up to 2 per house (20% per slot). */
  suitcase: 0.2,
  /** Police — one WaterCooler beside a Desk2 (always placed). */
  watercooler: 1,
  /** Police — per Desk2, chance to place TrashCan1 off the desk loot approach. */
  trashcan: 0.25,
  /** Supermarket — always place Checkout1 near the entrance (count rolled separately). */
  checkout: 1,
  /** Supermarket — aisle shelves placed by layout. */
  supershelf1: 1,
  supershelf2: 1,
  /** Supermarket — drink coolers on the NE wall (count from wall length). */
  superfridge1: 1,
  /** Hospital — ward beds placed by layout. */
  hospitalbed: 1,
  /** Birchport occupied beds — converted from hospitalbed, never rolled. */
  hospitalbed2: 0,
  hospitalbed3: 0,
  /** Hospital — beside bed headboards. */
  ivstand: 0.85,
  /** Hospital — aisle carts near beds (50% per cubicle). */
  medicalcart: 0.5,
  /** Hospital — always one MedicalReception1 in the lobby centre. */
  medicalreception: 1,
  /** Hospital — MedicalDrawers1 in the admin L (always when layout fits). */
  medicaldrawers: 1,
  /** Hospital — waiting benches by reception (always when layout fits). */
  threeseater: 1,
  threeseater2: 1,
  threeseater3: 1,
  /** Hospital — always one by the waiting bench; police — chance near a wall. */
  vendingmachine: 0.4,
  /** Motel — always one Counter1 in the lobby. */
  counter: 1,
  /** Motel — always one MotelBed1 per room. */
  motelbed: 1,
  /** Motel — MiniFridge1 per room. */
  minifridge: 0.75,
  /** Player drops only — never rolled by generators. */
  groundbackpack: 0,
  /** Barracks tent / mess hall — placed by layout. */
  militarybed: 1,
  footlocker: 1,
  kitbag: 1,
  camptable: 1,
  campchair: 1,
  militarybasket: 1,
  range: 1,
  hotdisplay: 1,
  drinkdisplay: 1,
  canteentable1: 1,
  canteentable2: 1,
  canteentable3: 1,
  /** Ashen market counter. Placed by layout, never rolled. */
  canteentable4: 0,
  canteenchair: 1,
  /** Barracks tents only — placed by layout, never rolled. */
  lantern1: 0,
  /** Warehouses — at most one Furnace1. */
  furnace: 0.5,
  /** Houses with a chimney — placed on that wall, never rolled. */
  mantel: 0,
  /** Office — placed by layout, never rolled. */
  conferencetable: 0,
  copier: 0,
  officechair: 0,
  whiteboard: 0,
  /** Office stairs — placed by layout when the exterior has a second storey. */
  stairs: 0,
  /** Large retail: placed by layout, never rolled. */
  clothingrack1: 0,
  clothingrack2: 0,
  clothingrack3: 0,
  mannequin1: 0,
  mannequin2: 0,
  mannequin3: 0,
  cart1: 0,
  cart2: 0,
  retailshelf1: 0,
  retailshelf2: 0,
  retailshelf3: 0,
  retailcase1: 0,
  retailcase2: 0,
};

/** Per motel room — chance to place a Suitcase1 on the floor. */
const MOTEL_SUITCASE_CHANCE = 0.25;

/** Furniture allowed per building type. */
const FURNITURE_BY_BUILDING: Record<
  "house" | "warehouse" | "none",
  readonly FurnitureType[]
> = {
  house: [
    "bed",
    "desk",
    "dresser",
    "bookshelf",
    "drawers",
    "guncabinet",
    "fridge",
    "kitchensink",
    "dinnertable",
    "nightstand",
    "armchair",
    "sofa",
    "bagchair",
  ],
  warehouse: ["bigshelf", "bigbox", "watercontainer", "desk", "cabinet", "workbench"],
  none: [],
};

/** True when the building at (bx, by) is a designated warehouse. */
export function isWarehouseInterior(bx: number, by: number): boolean {
  return getBuildingAt(bx, by)?.buildingType === "warehouse";
}

/** Residential interiors (`house`) — beds, dressers, etc. */
export function isResidentialInterior(bx: number, by: number): boolean {
  return getBuildingAt(bx, by)?.buildingType === "house";
}

/** Police station interiors — Desk2 bullpen layout. */
export function isPoliceInterior(bx: number, by: number): boolean {
  return getBuildingAt(bx, by)?.buildingType === "police_station";
}

/** Supermarket interiors — Checkout1 lanes near the entrance. */
export function isSupermarketInterior(bx: number, by: number): boolean {
  return getBuildingAt(bx, by)?.buildingType === "supermarket";
}

/** Hospital interiors — ward beds, IV stands, medical carts. */
export function isHospitalInterior(bx: number, by: number): boolean {
  return getBuildingAt(bx, by)?.buildingType === "hospital";
}

/** Motel interiors — lobby + corridor with room bays. */
export function isMotelInterior(bx: number, by: number): boolean {
  return getBuildingAt(bx, by)?.buildingType === "motel";
}

/** Birchport barracks wall-tent interiors — bunks and lockers. */
export function isTentInterior(bx: number, by: number): boolean {
  return getBuildingAt(bx, by)?.buildingType === "tent";
}

/** Birchport barracks mess hall — tables and a kitchen line. */
export function isMessHallInterior(bx: number, by: number): boolean {
  return getBuildingAt(bx, by)?.buildingType === "mess_hall";
}

/** Downtown office interiors — meeting room, manager's office, bullpen. */
export function isOfficeInterior(bx: number, by: number): boolean {
  return getBuildingAt(bx, by)?.buildingType === "office";
}

/** Department-store interiors: clothing, housewares, a small furniture display. */
export function isLargeRetailInterior(bx: number, by: number): boolean {
  return getBuildingAt(bx, by)?.buildingType === "large_retail";
}

const CANTEEN_TABLE_TYPES = [
  "canteentable1",
  "canteentable2",
  "canteentable3",
] as const;

export function isCanteenTable(objectType: string): boolean {
  return (
    objectType === "canteentable1" ||
    objectType === "canteentable2" ||
    objectType === "canteentable3"
  );
}

export function isCanteenChair(objectType: string): boolean {
  return objectType === "canteenchair";
}

/** True when a supermarket footprint overlaps the Birchport spawn hub. */
function supermarketInPlayerSpawnHub(bld: BuildingInfo): boolean {
  const f = getPlayerSpawnFootprint();
  return !(
    bld.ox + bld.w - 1 < f.minX ||
    bld.ox > f.maxX ||
    bld.oy + bld.h - 1 < f.minY ||
    bld.oy > f.maxY
  );
}

/**
 * Deterministic Red Order ownership for a supermarket at building origin (bx, by).
 * Birchport markets are always owned; others roll {@link RED_MAN_SUPERMARKET_OWN_CHANCE}.
 */
export function isRedOrderOwnedSupermarket(bx: number, by: number): boolean {
  const bld = getBuildingAt(bx, by);
  if (!bld || bld.buildingType !== "supermarket") return false;
  if (supermarketInPlayerSpawnHub(bld)) return true;
  return (
    seededRandom(`red-order-super:${bld.ox},${bld.oy}`)() <
    RED_MAN_SUPERMARKET_OWN_CHANCE
  );
}

export function buildingKey(bx: number, by: number) {
  return `${bx},${by}`;
}

export function canEnterBuildingFacing(
  facing: number,
  bld?: Pick<BuildingInfo, "ox" | "oy" | "w" | "h" | "entranceX" | "entranceY">,
) {
  const f = ((facing % 8) + 8) % 8;
  if (bld && buildingEntranceFace(bld) === "SW") {
    return BUILDING_ENTRY_FACINGS_SW.has(f);
  }
  return BUILDING_ENTRY_FACINGS_SE.has(f);
}

/** True when the tile is the outside exit corridor tile. */
export function isInteriorExitTile(
  tx: number,
  ty: number,
  exit: InteriorExit | number = INTERIOR_WIDTH,
) {
  if (typeof exit === "number") {
    // Legacy: east corridor at row 1
    return tx === exit && ty === 1;
  }
  if (exit.face === "SE") {
    return tx === exit.outsideX && ty >= exit.alongMin && ty <= exit.alongMax;
  }
  return ty === exit.outsideY && tx >= exit.alongMin && tx <= exit.alongMax;
}

export function interiorSearchableId(
  bx: number,
  by: number,
  kind: SearchableKind,
  index: number,
) {
  return `${bx},${by}:${kind}:${index}`;
}

/** Warehouse BigShelf1 aisle layout. */
const WAREHOUSE_SHELF_ROWS_MIN = 2;
const WAREHOUSE_SHELF_ROWS_MAX = 6;
const WAREHOUSE_SHELVES_PER_ROW_MIN = 1;
const WAREHOUSE_SHELVES_PER_ROW_MAX = 5;
/** Walkable tiles between consecutive shelf-row footprints (along SE / +x). */
const WAREHOUSE_SHELF_ROW_GAP_MIN = 2;

/**
 * Always place Desk1 + Cabinet1 on the NE wall (y = 0), facing SW, side by side.
 * Reserves the SW approach tiles so shelves/zombies do not block the office.
 */
function placeWarehouseOffice(
  bx: number,
  by: number,
  iW: number,
  iH: number,
  exitX: number,
  exitY: number,
  occupied: Set<string>,
  startIndex: number,
): SearchableObject[] {
  if (iW < 2 || iH < 2) return [];

  const y = 0; // NE wall
  // Keep clear of the east exit corridor; sit the pair toward the NW end.
  // Span: desk, 1-tile gap, cabinet → 3 tiles.
  let startX = 1;
  if (startX + 2 >= iW) startX = 0;
  if (startX + 2 >= iW) return [];

  const pair: FurnitureType[] = ["desk", "cabinet"];
  const furnitures: SearchableObject[] = [];
  let furnitureIndex = startIndex;

  // Desk then cabinet with a 1-tile gap between (facing SW on the NE wall).
  const positions = [startX, startX + 2];
  const gapX = startX + 1;
  occupied.add(`${gapX},${y}`);
  const gapApproachY = y + 1;
  if (gapApproachY < iH) occupied.add(`${gapX},${gapApproachY}`);

  for (let i = 0; i < pair.length; i++) {
    const type = pair[i]!;
    const x = positions[i]!;
    if (x >= iW) continue;
    if (x === exitX && y === exitY) continue;
    if (occupied.has(`${x},${y}`)) continue;

    furnitures.push({
      id: interiorSearchableId(bx, by, "furniture", furnitureIndex++),
      kind: "furniture",
      objectType: type,
      x,
      y,
      searched: false,
      buildingX: bx,
      buildingY: by,
    });
    occupied.add(`${x},${y}`);
    // Reserve SW approach tile (facing SW → +y).
    const approachY = y + 1;
    if (approachY < iH) occupied.add(`${x},${approachY}`);
  }

  return furnitures;
}

/**
 * Place BigShelf1 in SE-facing rows: 2–6 rows, 1–5 shelves side-by-side per row
 * (adjacent along NE–SW / +y), with ≥2 walkable tiles between rows.
 */
function placeWarehouseShelves(
  bx: number,
  by: number,
  iW: number,
  iH: number,
  exitX: number,
  exitY: number,
  rng: () => number,
  occupied: Set<string>,
  startIndex = 0,
): SearchableObject[] {
  const { w: sw, h: sh } = furnitureFootprint("bigshelf");
  const furnitures: SearchableObject[] = [];

  const markOccupied = (x: number, y: number, fw: number, fh: number) => {
    for (let ty = y; ty < y + fh; ty++) {
      for (let tx = x; tx < x + fw; tx++) occupied.add(`${tx},${ty}`);
    }
  };
  const canPlaceAt = (x: number, y: number, fw: number, fh: number) => {
    if (x < 0 || y < 0 || x + fw > iW || y + fh > iH) return false;
    for (let ty = y; ty < y + fh; ty++) {
      for (let tx = x; tx < x + fw; tx++) {
        if (tx === exitX && ty === exitY) return false;
        if (occupied.has(`${tx},${ty}`)) return false;
      }
    }
    return true;
  };

  const desiredRows =
    WAREHOUSE_SHELF_ROWS_MIN +
    Math.floor(rng() * (WAREHOUSE_SHELF_ROWS_MAX - WAREHOUSE_SHELF_ROWS_MIN + 1));

  // Leave one tile east of the last row so SE approach stays walkable toward the exit.
  const maxRowX = iW - sw - 1;
  let rowX = 0;
  let furnitureIndex = startIndex;

  for (let row = 0; row < desiredRows; row++) {
    if (rowX > maxRowX) break;

    let shelvesInRow =
      WAREHOUSE_SHELVES_PER_ROW_MIN +
      Math.floor(
        rng() *
          (WAREHOUSE_SHELVES_PER_ROW_MAX - WAREHOUSE_SHELVES_PER_ROW_MIN + 1),
      );
    // Leave 2 tiles at the SW end for optional BigBox/WaterContainer + SW approach.
    const maxShelves = Math.max(1, Math.floor(Math.max(0, iH - 2) / sh));
    shelvesInRow = Math.min(shelvesInRow, maxShelves);

    const rowLen = shelvesInRow * sh;
    const maxStartY = iH - 2 - rowLen;
    const startY = maxStartY <= 0 ? 0 : Math.floor(rng() * (maxStartY + 1));

    for (let s = 0; s < shelvesInRow; s++) {
      const fx = rowX;
      const fy = startY + s * sh;
      if (!canPlaceAt(fx, fy, sw, sh)) continue;
      furnitures.push({
        id: interiorSearchableId(bx, by, "furniture", furnitureIndex++),
        kind: "furniture",
        objectType: "bigshelf",
        x: fx,
        y: fy,
        searched: false,
        buildingX: bx,
        buildingY: by,
      });
      markOccupied(fx, fy, sw, sh);
    }

    // End-of-aisle furniture: BigBox1 or WaterContainer1 (same SW slot, mutually exclusive).
    // Both face SW — require an in-bounds free approach tile south of the piece.
    const aisleEndTypes: FurnitureType[] = [];
    if (rng() < FURNITURE_SPAWN_CHANCE.bigbox) aisleEndTypes.push("bigbox");
    if (rng() < FURNITURE_SPAWN_CHANCE.watercontainer) {
      aisleEndTypes.push("watercontainer");
    }
    if (aisleEndTypes.length > 0) {
      const pick =
        aisleEndTypes[Math.floor(rng() * aisleEndTypes.length)]!;
      const { w: ew, h: eh } = furnitureFootprint(pick);
      const endX = rowX;
      const endY = startY + shelvesInRow * sh;
      const { dx, dy } = ISO_FACING_TILE_DELTA[furnitureFacing(pick)];
      const ax = endX + dx;
      const ay = endY + dy;
      const approachOk =
        ax >= 0 &&
        ay >= 0 &&
        ax < iW &&
        ay < iH &&
        !(ax === exitX && ay === exitY) &&
        !occupied.has(`${ax},${ay}`);
      if (canPlaceAt(endX, endY, ew, eh) && approachOk) {
        furnitures.push({
          id: interiorSearchableId(bx, by, "furniture", furnitureIndex++),
          kind: "furniture",
          objectType: pick,
          x: endX,
          y: endY,
          searched: false,
          buildingX: bx,
          buildingY: by,
        });
        markOccupied(endX, endY, ew, eh);
        occupied.add(`${ax},${ay}`);
      }
    }

    const gap =
      WAREHOUSE_SHELF_ROW_GAP_MIN + Math.floor(rng() * 2); // 2–3 tiles
    rowX += sw + gap;
  }

  return furnitures;
}

/**
 * Workbench1 on a free floor tile (SE-facing). At most one per warehouse.
 * Birchport skips the chance roll so the bench is placed whenever a tile is free.
 */
function placeWarehouseWorkbench(
  bx: number,
  by: number,
  iW: number,
  iH: number,
  exitX: number,
  exitY: number,
  rng: () => number,
  occupied: Set<string>,
  startIndex: number,
  guaranteed = false,
): SearchableObject[] {
  if (!guaranteed && rng() >= FURNITURE_SPAWN_CHANCE.workbench) return [];

  const { w, h } = furnitureFootprint("workbench");

  const candidates: { x: number; y: number }[] = [];
  for (let y = 0; y <= iH - h; y++) {
    for (let x = 0; x <= iW - w; x++) {
      let blocked = false;
      for (let ty = y; ty < y + h && !blocked; ty++) {
        for (let tx = x; tx < x + w; tx++) {
          if ((tx === exitX && ty === exitY) || occupied.has(`${tx},${ty}`)) {
            blocked = true;
            break;
          }
        }
      }
      if (blocked) continue;
      const approaches = furnitureFrontApproachTiles({
        kind: "furniture",
        objectType: "workbench",
        x,
        y,
      });
      if (approaches.length === 0) continue;
      let approachBlocked = false;
      for (const tile of approaches) {
        if (tile.x < 0 || tile.y < 0 || tile.x >= iW || tile.y >= iH) {
          approachBlocked = true;
          break;
        }
        if (tile.x === exitX && tile.y === exitY) {
          approachBlocked = true;
          break;
        }
        if (occupied.has(`${tile.x},${tile.y}`)) {
          approachBlocked = true;
          break;
        }
      }
      if (approachBlocked) continue;
      candidates.push({ x, y });
    }
  }
  if (candidates.length === 0) return [];

  const pick = candidates[Math.floor(rng() * candidates.length)]!;
  for (let ty = pick.y; ty < pick.y + h; ty++) {
    for (let tx = pick.x; tx < pick.x + w; tx++) occupied.add(`${tx},${ty}`);
  }
  for (const tile of furnitureFrontApproachTiles({
    kind: "furniture",
    objectType: "workbench",
    x: pick.x,
    y: pick.y,
  })) {
    occupied.add(`${tile.x},${tile.y}`);
  }

  return [
    {
      id: interiorSearchableId(bx, by, "furniture", startIndex),
      kind: "furniture",
      objectType: "workbench",
      x: pick.x,
      y: pick.y,
      searched: false,
      buildingX: bx,
      buildingY: by,
    },
  ];
}

/**
 * Furnace1 flush against a warehouse wall. At most one.
 * SE art sits on the NW wall. SW art sits on the NE wall.
 * Placed after shelves and the workbench so those ids stay stable.
 */
function placeWarehouseFurnace(
  bx: number,
  by: number,
  iW: number,
  iH: number,
  exitX: number,
  exitY: number,
  rng: () => number,
  occupied: Set<string>,
  startIndex: number,
  existing: readonly SearchableObject[],
): SearchableObject[] {
  if (rng() >= FURNITURE_SPAWN_CHANCE.furnace) return [];

  // Keep the front tile of shelves and the workbench clear.
  const reservedApproach = new Set<string>();
  for (const obj of existing) {
    for (const tile of furnitureFrontApproachTiles(obj)) {
      reservedApproach.add(`${tile.x},${tile.y}`);
    }
  }

  const spotBlocked = (x: number, y: number) =>
    (x === exitX && y === exitY) ||
    occupied.has(`${x},${y}`) ||
    reservedApproach.has(`${x},${y}`);

  const candidates: { x: number; y: number; facing: FurnitureFacing }[] = [];
  const consider = (x: number, y: number, facing: FurnitureFacing) => {
    if (spotBlocked(x, y)) return;
    const { dx, dy } = ISO_FACING_TILE_DELTA[facing];
    const ax = x + dx;
    const ay = y + dy;
    if (ax < 0 || ay < 0 || ax >= iW || ay >= iH) return;
    if (ax === exitX && ay === exitY) return;
    if (occupied.has(`${ax},${ay}`)) return;
    candidates.push({ x, y, facing });
  };

  // NW wall: back against the wall, SE face into the room.
  for (let y = 0; y < iH; y++) consider(0, y, "SE");
  // NE wall: back against the wall, SW face into the room.
  for (let x = 0; x < iW; x++) consider(x, 0, "SW");

  if (candidates.length === 0) return [];

  const pick = candidates[Math.floor(rng() * candidates.length)]!;
  occupied.add(`${pick.x},${pick.y}`);

  return [
    {
      id: interiorSearchableId(bx, by, "furniture", startIndex),
      kind: "furniture",
      objectType: "furnace",
      x: pick.x,
      y: pick.y,
      searched: false,
      buildingX: bx,
      buildingY: by,
      facing: pick.facing,
    },
  ];
}

/**
 * Mantel1 flush to the chimney wall. One exterior chimney tile covers two
 * interior tiles along that wall, so the hearth spans both and sits on the
 * same stretch of wall as the stack outside.
 * SE art: west wall (x = 0). SW art: north wall (y = 0).
 */
export type HouseMantelSpot = {
  x: number;
  y: number;
  facing: "SE" | "SW";
  w: number;
  h: number;
};

export function houseMantelSpot(
  bld: Pick<BuildingInfo, "ox" | "oy" | "w" | "h" | "chimneyX" | "chimneyY">,
): HouseMantelSpot | null {
  const band = houseChimneyInteriorTiles(bld);
  if (!band || band.tiles.length < 2) return null;
  if (band.wall === "NE") {
    const x = Math.min(...band.tiles.map((t) => t.x));
    return { x, y: 0, facing: "SW", w: 2, h: 1 };
  }
  const y = Math.min(...band.tiles.map((t) => t.y));
  return { x: 0, y, facing: "SE", w: 1, h: 2 };
}

function placeHouseMantel(
  bx: number,
  by: number,
  iW: number,
  iH: number,
  exitX: number,
  exitY: number,
  occupied: Set<string>,
  startIndex: number,
): SearchableObject[] {
  const bld = getBuildingAt(bx, by);
  if (!bld || bld.buildingType !== "house") return [];
  const spot = houseMantelSpot(bld);
  if (!spot) return [];
  if (spot.x < 0 || spot.y < 0 || spot.x + spot.w > iW || spot.y + spot.h > iH) {
    return [];
  }

  const { dx, dy } = ISO_FACING_TILE_DELTA[spot.facing];
  for (let ty = spot.y; ty < spot.y + spot.h; ty++) {
    for (let tx = spot.x; tx < spot.x + spot.w; tx++) {
      if (tx === exitX && ty === exitY) return [];
      const ax = tx + dx;
      const ay = ty + dy;
      if (ax < 0 || ay < 0 || ax >= iW || ay >= iH) return [];
      if (ax === exitX && ay === exitY) return [];
    }
  }

  // The hearth wins over anything already reserved on its tiles.
  for (let ty = spot.y; ty < spot.y + spot.h; ty++) {
    for (let tx = spot.x; tx < spot.x + spot.w; tx++) {
      occupied.add(`${tx},${ty}`);
    }
  }
  for (let ty = spot.y; ty < spot.y + spot.h; ty++) {
    for (let tx = spot.x; tx < spot.x + spot.w; tx++) {
      occupied.add(`${tx + dx},${ty + dy}`);
    }
  }

  return [
    {
      id: interiorSearchableId(bx, by, "furniture", startIndex),
      kind: "furniture",
      objectType: "mantel",
      x: spot.x,
      y: spot.y,
      searched: false,
      buildingX: bx,
      buildingY: by,
      facing: spot.facing,
    },
  ];
}

/** Bedroom and kitchen pieces keep a tile of space from the mantel. */
const MANTEL_CLEARANCE = 1;

function activeHouseMantelTiles(
  bx: number,
  by: number,
  occupied: Set<string>,
): { x: number; y: number }[] | null {
  const bld = getBuildingAt(bx, by);
  if (!bld) return null;
  const spot = houseMantelSpot(bld);
  if (!spot || !occupied.has(`${spot.x},${spot.y}`)) return null;
  const tiles: { x: number; y: number }[] = [];
  for (let ty = spot.y; ty < spot.y + spot.h; ty++) {
    for (let tx = spot.x; tx < spot.x + spot.w; tx++) {
      tiles.push({ x: tx, y: ty });
    }
  }
  return tiles;
}

function footprintTooCloseToMantel(
  x: number,
  y: number,
  w: number,
  h: number,
  mantel: { x: number; y: number }[] | null,
): boolean {
  if (!mantel) return false;
  for (let ty = y; ty < y + h; ty++) {
    for (let tx = x; tx < x + w; tx++) {
      for (const tile of mantel) {
        if (
          Math.max(Math.abs(tx - tile.x), Math.abs(ty - tile.y)) <=
          MANTEL_CLEARANCE
        ) {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * Place Bed1 flush against the NW wall in residential (house) interiors.
 * SE-facing 2×1 footprint — headboard NW against the wall, foot SE; approach from the foot.
 * Kept off the mantel so the bed is not parked against the fire.
 */
function placeResidentialBed(
  bx: number,
  by: number,
  iW: number,
  iH: number,
  exitX: number,
  exitY: number,
  rng: () => number,
  occupied: Set<string>,
  startIndex: number,
): SearchableObject[] {
  if (rng() >= FURNITURE_SPAWN_CHANCE.bed) return [];

  const { w, h } = furnitureFootprint("bed");
  const { dx, dy } = ISO_FACING_TILE_DELTA[furnitureFacing("bed")];
  const mantelTiles = activeHouseMantelTiles(bx, by, occupied);

  const canPlaceAt = (x: number, y: number) => {
    if (x < 0 || y < 0 || x + w > iW || y + h > iH) return false;
    if (footprintTooCloseToMantel(x, y, w, h, mantelTiles)) return false;
    for (let ty = y; ty < y + h; ty++) {
      for (let tx = x; tx < x + w; tx++) {
        if (tx === exitX && ty === exitY) return false;
        if (occupied.has(`${tx},${ty}`)) return false;
      }
    }
    // SE approach (foot of the bed) must stay inside the room and free.
    const ax = x + (w - 1) + dx;
    const ay = y + dy;
    if (ax < 0 || ay < 0 || ax >= iW || ay >= iH) return false;
    if (ax === exitX && ay === exitY) return false;
    if (occupied.has(`${ax},${ay}`)) return false;
    return true;
  };

  // Headboard is on the NW end — only place flush against the NW wall (x = 0).
  const candidates: { x: number; y: number }[] = [];
  const x = 0;
  for (let y = 0; y <= iH - h; y++) {
    if (!canPlaceAt(x, y)) continue;
    candidates.push({ x, y });
  }
  if (candidates.length === 0) return [];

  const pick = candidates[Math.floor(rng() * candidates.length)]!;
  for (let ty = pick.y; ty < pick.y + h; ty++) {
    for (let tx = pick.x; tx < pick.x + w; tx++) occupied.add(`${tx},${ty}`);
  }
  for (const t of furnitureFrontApproachTiles({
    kind: "furniture",
    objectType: "bed",
    x: pick.x,
    y: pick.y,
  })) {
    occupied.add(`${t.x},${t.y}`);
  }

  return [
    {
      id: interiorSearchableId(bx, by, "furniture", startIndex),
      kind: "furniture",
      objectType: "bed",
      x: pick.x,
      y: pick.y,
      searched: false,
      buildingX: bx,
      buildingY: by,
    },
  ];
}

function placeGenericFurniture(
  bx: number,
  by: number,
  iW: number,
  iH: number,
  exitX: number,
  exitY: number,
  rng: () => number,
  occupied: Set<string>,
  startIndex = 0,
): SearchableObject[] {
  // Bed first so it claims a wall-flush slot before other furniture.
  // A chimney mantel, when present, is already reserved.
  const furnitures = placeResidentialBed(
    bx,
    by,
    iW,
    iH,
    exitX,
    exitY,
    rng,
    occupied,
    startIndex,
  );
  const mantelTiles = activeHouseMantelTiles(bx, by, occupied);

  const markOccupied = (x: number, y: number, w: number, h: number) => {
    for (let ty = y; ty < y + h; ty++) {
      for (let tx = x; tx < x + w; tx++) occupied.add(`${tx},${ty}`);
    }
  };
  const canPlaceAt = (x: number, y: number, w: number, h: number) => {
    if (x < 0 || y < 0 || x + w > iW || y + h > iH) return false;
    for (let ty = y; ty < y + h; ty++) {
      for (let tx = x; tx < x + w; tx++) {
        if (tx === exitX && ty === exitY) return false;
        if (occupied.has(`${tx},${ty}`)) return false;
      }
    }
    return true;
  };
  /** Footprint free and every front approach tile in-bounds + unoccupied. */
  const canPlaceFurniture = (
    type: FurnitureType,
    x: number,
    y: number,
    facing?: FurnitureFacing,
  ) => {
    const { w, h } = furnitureFootprint(type, facing);
    if (!canPlaceAt(x, y, w, h)) return false;
    const approaches = furnitureFrontApproachTiles({
      kind: "furniture",
      objectType: type,
      x,
      y,
      facing,
    });
    if (approaches.length === 0) return false;
    for (const t of approaches) {
      if (t.x < 0 || t.y < 0 || t.x >= iW || t.y >= iH) return false;
      if (t.x === exitX && t.y === exitY) return false;
      if (occupied.has(`${t.x},${t.y}`)) return false;
    }
    return true;
  };
  const reserveApproaches = (
    type: FurnitureType,
    x: number,
    y: number,
    facing?: FurnitureFacing,
  ) => {
    for (const t of furnitureFrontApproachTiles({
      kind: "furniture",
      objectType: type,
      x,
      y,
      facing,
    })) {
      occupied.add(`${t.x},${t.y}`);
    }
  };

  let furnitureIndex = startIndex + furnitures.length;

  // Nightstand1 — optional, only beside a bed, flush to a wall (SE on NW / SW on NE).
  const bed = furnitures.find((f) => f.objectType === "bed");
  if (bed && rng() < FURNITURE_SPAWN_CHANCE.nightstand) {
    const { w: bw, h: bh } = furnitureFootprint("bed");
    const candidates: { x: number; y: number; facing: FurnitureFacing }[] = [];
    // SE: NW wall (x=0), immediately north/south of the bed.
    for (const y of [bed.y - 1, bed.y + bh]) {
      if (footprintTooCloseToMantel(0, y, 1, 1, mantelTiles)) continue;
      if (canPlaceFurniture("nightstand", 0, y, "SE")) {
        candidates.push({ x: 0, y, facing: "SE" });
      }
    }
    // SW: NE wall (y=0), immediately east of the bed when the bed sits on that wall.
    if (bed.y === 0) {
      const x = bed.x + bw;
      if (
        !footprintTooCloseToMantel(x, 0, 1, 1, mantelTiles) &&
        canPlaceFurniture("nightstand", x, 0, "SW")
      ) {
        candidates.push({ x, y: 0, facing: "SW" });
      }
    }
    if (candidates.length > 0) {
      const pick = candidates[Math.floor(rng() * candidates.length)]!;
      const { w: nw, h: nh } = furnitureFootprint("nightstand", pick.facing);
      furnitures.push({
        id: interiorSearchableId(bx, by, "furniture", furnitureIndex++),
        kind: "furniture",
        objectType: "nightstand",
        x: pick.x,
        y: pick.y,
        searched: false,
        buildingX: bx,
        buildingY: by,
        facing: pick.facing,
      });
      markOccupied(pick.x, pick.y, nw, nh);
      reserveApproaches("nightstand", pick.x, pick.y, pick.facing);
    }
  }

  // Fridge next — farthest from the bed (SE or SW art), before other pieces.
  // Back flush to a wall: SE fridge on NW (x=0), SW fridge on NE (y=0).
  if (rng() < FURNITURE_SPAWN_CHANCE.fridge) {
    const bed = furnitures.find((f) => f.objectType === "bed");
    const { w: fw, h: fh } = furnitureFootprint("fridge");
    const bedCx = bed ? bed.x + furnitureFootprint("bed").w / 2 : iW / 2;
    const bedCy = bed ? bed.y + furnitureFootprint("bed").h / 2 : iH / 2;

    const bestRef: {
      current: { x: number; y: number; facing: FurnitureFacing; dist: number } | null;
    } = { current: null };
    const consider = (x: number, y: number, facing: FurnitureFacing) => {
      if (footprintTooCloseToMantel(x, y, fw, fh, mantelTiles)) return;
      if (!canPlaceFurniture("fridge", x, y, facing)) return;
      // Require a free 2-tile sink slot beside the fridge on the same wall.
      const { w: sw, h: sh } = furnitureFootprint("kitchensink", facing);
      const sinkOrigins =
        facing === "SW"
          ? [
              { x: x - sw, y: 0 },
              { x: x + fw, y: 0 },
            ]
          : [
              { x: 0, y: y - sh },
              { x: 0, y: y + fh },
            ];
      if (
        !sinkOrigins.some(
          (n) =>
            canPlaceFurniture("kitchensink", n.x, n.y, facing) &&
            !footprintTooCloseToMantel(n.x, n.y, sw, sh, mantelTiles),
        )
      ) {
        return;
      }
      const cx = x + fw / 2;
      const cy = y + fh / 2;
      const dist = Math.hypot(cx - bedCx, cy - bedCy);
      const best = bestRef.current;
      if (!best || dist > best.dist + 1e-6) {
        bestRef.current = { x, y, facing, dist };
      } else if (Math.abs(dist - best.dist) <= 1e-6 && rng() < 0.5) {
        bestRef.current = { x, y, facing, dist };
      }
    };
    for (const facing of FRIDGE_FACINGS) {
      // SE faces into the room from the NW wall; SW from the NE wall.
      if (facing === "SE") {
        for (let y = 0; y <= iH - fh; y++) consider(0, y, facing);
      } else {
        for (let x = 0; x <= iW - fw; x++) consider(x, 0, facing);
      }
    }
    const best = bestRef.current;
    if (best) {
      furnitures.push({
        id: interiorSearchableId(bx, by, "furniture", furnitureIndex++),
        kind: "furniture",
        objectType: "fridge",
        x: best.x,
        y: best.y,
        searched: false,
        buildingX: bx,
        buildingY: by,
        facing: best.facing,
      });
      markOccupied(best.x, best.y, fw, fh);
      reserveApproaches("fridge", best.x, best.y, best.facing);

      // KitchenSink1 — 2×1 along the same wall, same facing, flush beside the fridge.
      const sinkFacing = best.facing;
      const { w: sw, h: sh } = furnitureFootprint("kitchensink", sinkFacing);
      const sinkOrigins: { x: number; y: number }[] = [];
      if (sinkFacing === "SW") {
        // 2×1 on NE wall (y=0): origin left or right of the 1×1 fridge.
        sinkOrigins.push({ x: best.x - sw, y: 0 }, { x: best.x + fw, y: 0 });
      } else {
        // 1×2 on NW wall (x=0): origin above or below the 1×1 fridge.
        sinkOrigins.push({ x: 0, y: best.y - sh }, { x: 0, y: best.y + fh });
      }
      sinkOrigins.sort(() => rng() - 0.5);
      for (const n of sinkOrigins) {
        if (footprintTooCloseToMantel(n.x, n.y, sw, sh, mantelTiles)) continue;
        if (!canPlaceFurniture("kitchensink", n.x, n.y, sinkFacing)) continue;
        furnitures.push({
          id: interiorSearchableId(bx, by, "furniture", furnitureIndex++),
          kind: "furniture",
          objectType: "kitchensink",
          x: n.x,
          y: n.y,
          searched: false,
          buildingX: bx,
          buildingY: by,
          facing: sinkFacing,
        });
        markOccupied(n.x, n.y, sw, sh);
        reserveApproaches("kitchensink", n.x, n.y, sinkFacing);
        break;
      }
    }
  }

  const selectedTypes: FurnitureType[] = [];
  let placeDinnerTable = false;
  for (const type of FURNITURE_BY_BUILDING.house) {
    if (
      type === "bed" ||
      type === "fridge" ||
      type === "kitchensink" ||
      type === "nightstand" ||
      type === "dinnertable"
    ) {
      if (type === "dinnertable" && rng() < FURNITURE_SPAWN_CHANCE.dinnertable) {
        placeDinnerTable = true;
      }
      continue;
    }
    if (rng() < FURNITURE_SPAWN_CHANCE[type]) selectedTypes.push(type);
  }

  const rowOrder: number[] = [];
  for (let fy = 0; fy < iH; fy++) rowOrder.push(fy);
  rowOrder.sort(() => rng() - 0.5);

  for (const type of selectedTypes) {
    // BagChair1 only has SW art, so it stays on the NE wall.
    if (type === "bagchair") {
      const facing: FurnitureFacing = "SW";
      const { w, h } = furnitureFootprint(type, facing);
      const colOrder: number[] = [];
      for (let fx = 0; fx <= iW - w; fx++) colOrder.push(fx);
      colOrder.sort(() => rng() - 0.5);
      const fy = 0;
      for (const fx of colOrder) {
        if (!canPlaceFurniture(type, fx, fy, facing)) continue;
        furnitures.push({
          id: interiorSearchableId(bx, by, "furniture", furnitureIndex++),
          kind: "furniture",
          objectType: type,
          x: fx,
          y: fy,
          searched: false,
          buildingX: bx,
          buildingY: by,
          facing,
        });
        markOccupied(fx, fy, w, h);
        reserveApproaches(type, fx, fy, facing);
        break;
      }
      continue;
    }
    // Drawers, bookshelves, and house seating pick a wall and the matching facing.
    if (
      type === "drawers" ||
      type === "bookshelf" ||
      type === "armchair" ||
      type === "sofa"
    ) {
      const onNeWall = rng() < 0.5;
      const facing: FurnitureFacing = onNeWall ? "SW" : "SE";
      const { w, h } = furnitureFootprint(type, facing);
      if (onNeWall) {
        const colOrder: number[] = [];
        for (let fx = 0; fx <= iW - w; fx++) colOrder.push(fx);
        colOrder.sort(() => rng() - 0.5);
        const fy = 0;
        for (const fx of colOrder) {
          if (!canPlaceFurniture(type, fx, fy, facing)) continue;
          furnitures.push({
            id: interiorSearchableId(bx, by, "furniture", furnitureIndex++),
            kind: "furniture",
            objectType: type,
            x: fx,
            y: fy,
            searched: false,
            buildingX: bx,
            buildingY: by,
            facing,
          });
          markOccupied(fx, fy, w, h);
          reserveApproaches(type, fx, fy, facing);
          break;
        }
      } else {
        const rowOrderWall: number[] = [];
        for (let fy = 0; fy <= iH - h; fy++) rowOrderWall.push(fy);
        rowOrderWall.sort(() => rng() - 0.5);
        const fx = 0;
        for (const fy of rowOrderWall) {
          if (!canPlaceFurniture(type, fx, fy, facing)) continue;
          furnitures.push({
            id: interiorSearchableId(bx, by, "furniture", furnitureIndex++),
            kind: "furniture",
            objectType: type,
            x: fx,
            y: fy,
            searched: false,
            buildingX: bx,
            buildingY: by,
            facing,
          });
          markOccupied(fx, fy, w, h);
          reserveApproaches(type, fx, fy, facing);
          break;
        }
      }
      continue;
    }
    const { w, h } = furnitureFootprint(type);
    for (const fy of rowOrder) {
      const fx = 0;
      // Dressers read as bedroom furniture, so they stay off the hearth.
      if (
        type === "dresser" &&
        footprintTooCloseToMantel(fx, fy, w, h, mantelTiles)
      ) {
        continue;
      }
      if (!canPlaceFurniture(type, fx, fy)) continue;
      furnitures.push({
        id: interiorSearchableId(bx, by, "furniture", furnitureIndex++),
        kind: "furniture",
        objectType: type,
        x: fx,
        y: fy,
        searched: false,
        buildingX: bx,
        buildingY: by,
      });
      markOccupied(fx, fy, w, h);
      reserveApproaches(type, fx, fy);
      break;
    }
  }

  // DinnerTable1 — away from fridge/sink, but stay within 1 tile of a room edge
  // so the table cannot park mid-floor and block appliance access.
  if (placeDinnerTable) {
    const fridge = furnitures.find((f) => f.objectType === "fridge");
    const sink = furnitures.find((f) => f.objectType === "kitchensink");
    const applianceCx = fridge
      ? fridge.x + furnitureFootprint("fridge", fridge.facing).w / 2
      : sink
        ? sink.x + furnitureFootprint("kitchensink", sink.facing).w / 2
        : 0;
    const applianceCy = fridge
      ? fridge.y + furnitureFootprint("fridge", fridge.facing).h / 2
      : sink
        ? sink.y + furnitureFootprint("kitchensink", sink.facing).h / 2
        : 0;
    const tableFacings: FurnitureFacing[] = ["SE", "SW"];
    let best: {
      x: number;
      y: number;
      facing: FurnitureFacing;
      dist: number;
    } | null = null;
    for (const facing of tableFacings) {
      const { w: tw, h: th } = furnitureFootprint("dinnertable", facing);
      for (let fy = 0; fy <= iH - th; fy++) {
        for (let fx = 0; fx <= iW - tw; fx++) {
          if (!canPlaceFurniture("dinnertable", fx, fy, facing)) continue;
          if (footprintTooCloseToMantel(fx, fy, tw, th, mantelTiles)) continue;
          if (
            !dinnerTableNearBound(fx, fy, tw, th, 0, 0, iW - 1, iH - 1)
          ) {
            continue;
          }
          const dist = Math.hypot(
            fx + tw / 2 - applianceCx,
            fy + th / 2 - applianceCy,
          );
          if (!best || dist > best.dist + 1e-6) {
            best = { x: fx, y: fy, facing, dist };
          } else if (Math.abs(dist - best.dist) <= 1e-6 && rng() < 0.5) {
            best = { x: fx, y: fy, facing, dist };
          }
        }
      }
    }
    if (best) {
      const { w: tw, h: th } = furnitureFootprint("dinnertable", best.facing);
      furnitures.push({
        id: interiorSearchableId(bx, by, "furniture", furnitureIndex++),
        kind: "furniture",
        objectType: "dinnertable",
        x: best.x,
        y: best.y,
        searched: false,
        buildingX: bx,
        buildingY: by,
        facing: best.facing,
      });
      markOccupied(best.x, best.y, tw, th);
      reserveApproaches("dinnertable", best.x, best.y, best.facing);
    }
  }

  // Suitcase1 — up to 2 per house on free floor tiles (not on furniture or
  // their loot approaches). Own approach must stay clear so it is searchable.
  const suitcaseFacings: FurnitureFacing[] = ["SE", "SW"];
  for (let n = 0; n < 2; n++) {
    if (rng() >= FURNITURE_SPAWN_CHANCE.suitcase) continue;
    const candidates: { x: number; y: number; facing: FurnitureFacing }[] = [];
    for (let fy = 0; fy < iH; fy++) {
      for (let fx = 0; fx < iW; fx++) {
        for (const facing of suitcaseFacings) {
          if (canPlaceFurniture("suitcase", fx, fy, facing)) {
            candidates.push({ x: fx, y: fy, facing });
          }
        }
      }
    }
    if (candidates.length === 0) break;
    const pick = candidates[Math.floor(rng() * candidates.length)]!;
    furnitures.push({
      id: interiorSearchableId(bx, by, "furniture", furnitureIndex++),
      kind: "furniture",
      objectType: "suitcase",
      x: pick.x,
      y: pick.y,
      facing: pick.facing,
      searched: false,
      buildingX: bx,
      buildingY: by,
    });
    markOccupied(pick.x, pick.y, 1, 1);
    reserveApproaches("suitcase", pick.x, pick.y, pick.facing);
  }

  return furnitures;
}

/**
 * Lockers1 and Bookshelf2 always on different walls (NE vs NW).
 * Lockers: 1–2 flush against their wall; bookshelves: 1–4 on the other.
 * SE → NW wall (x=0); SW → NE wall (y=0).
 */
function placePoliceWallFurniture(
  bx: number,
  by: number,
  iW: number,
  iH: number,
  exit: InteriorExit,
  rng: () => number,
  occupied: Set<string>,
  startIndex: number,
): SearchableObject[] {
  const furnitures: SearchableObject[] = [];
  let furnitureIndex = startIndex;

  const blocksExit = (tx: number, ty: number): boolean => {
    if (tx === exit.insideX && ty === exit.insideY) return true;
    if (exit.face === "SE") {
      if (tx >= iW - 4 && ty >= exit.alongMin - 1 && ty <= exit.alongMax + 1) {
        return true;
      }
    } else if (ty >= iH - 4 && tx >= exit.alongMin - 1 && tx <= exit.alongMax + 1) {
      return true;
    }
    return false;
  };

  const canPlace = (
    objectType: string,
    ox: number,
    oy: number,
    facing: FurnitureFacing,
  ): boolean => {
    const { w, h } = furnitureFootprint(objectType, facing);
    if (ox < 0 || oy < 0 || ox + w > iW || oy + h > iH) return false;
    for (let ty = oy; ty < oy + h; ty++) {
      for (let tx = ox; tx < ox + w; tx++) {
        if (occupied.has(`${tx},${ty}`)) return false;
        if (blocksExit(tx, ty)) return false;
      }
    }
    const approaches = furnitureFrontApproachTiles({
      kind: "furniture",
      objectType,
      x: ox,
      y: oy,
      facing,
    });
    if (approaches.length === 0) return false;
    for (const t of approaches) {
      if (t.x < 0 || t.y < 0 || t.x >= iW || t.y >= iH) return false;
      if (occupied.has(`${t.x},${t.y}`)) return false;
      if (blocksExit(t.x, t.y)) return false;
    }
    return true;
  };

  const commit = (
    objectType: string,
    ox: number,
    oy: number,
    facing: FurnitureFacing,
  ): boolean => {
    if (!canPlace(objectType, ox, oy, facing)) return false;
    const { w, h } = furnitureFootprint(objectType, facing);
    for (let ty = oy; ty < oy + h; ty++) {
      for (let tx = ox; tx < ox + w; tx++) {
        occupied.add(`${tx},${ty}`);
      }
    }
    for (const t of furnitureFrontApproachTiles({
      kind: "furniture",
      objectType,
      x: ox,
      y: oy,
      facing,
    })) {
      occupied.add(`${t.x},${t.y}`);
    }
    furnitures.push({
      id: interiorSearchableId(bx, by, "furniture", furnitureIndex++),
      kind: "furniture",
      objectType,
      x: ox,
      y: oy,
      searched: false,
      buildingX: bx,
      buildingY: by,
      facing,
    });
    return true;
  };

  /**
   * Flush origins along one wall. `gapTiles` empty tiles between consecutive
   * footprints (0 = flush side-by-side).
   */
  const wallSlots = (
    objectType: string,
    facing: FurnitureFacing,
    gapTiles = 0,
  ): { x: number; y: number }[] => {
    const { w, h } = furnitureFootprint(objectType, facing);
    const slots: { x: number; y: number }[] = [];
    if (facing === "SW") {
      // NE wall — step by width (+ gap) so lockers sit along +x.
      const step = w + gapTiles;
      for (let x = 1; x + w <= iW - 1; x += step) slots.push({ x, y: 0 });
    } else {
      // NW wall — step by height (+ gap) so lockers sit along +y.
      const step = h + gapTiles;
      for (let y = 1; y + h <= iH - 1; y += step) slots.push({ x: 0, y });
    }
    return slots;
  };

  /**
   * Place `count` units in one continuous row on the wall. Picks a random
   * start among runs long enough to fit; falls back to the longest free run.
   */
  const placeOnWall = (
    objectType: string,
    facing: FurnitureFacing,
    count: number,
    gapTiles = 0,
  ): number => {
    const slots = wallSlots(objectType, facing, gapTiles);
    const free = slots.map((s) => canPlace(objectType, s.x, s.y, facing));

    // Collect start indices of contiguous free runs that fit `want` pieces.
    const startsFor = (want: number): number[] => {
      const starts: number[] = [];
      let run = 0;
      let runStart = 0;
      for (let i = 0; i <= free.length; i++) {
        if (i < free.length && free[i]) {
          if (run === 0) runStart = i;
          run++;
        } else {
          if (run >= want) {
            for (let s = runStart; s <= runStart + run - want; s++) {
              starts.push(s);
            }
          }
          run = 0;
        }
      }
      return starts;
    };

    let want = Math.min(count, slots.length);
    let starts = startsFor(want);
    while (want > 1 && starts.length === 0) {
      want--;
      starts = startsFor(want);
    }
    if (starts.length === 0) {
      for (const s of slots) {
        if (commit(objectType, s.x, s.y, facing)) return 1;
      }
      return 0;
    }

    const start = starts[Math.floor(rng() * starts.length)]!;
    let placed = 0;
    for (let i = 0; i < want; i++) {
      const s = slots[start + i]!;
      if (commit(objectType, s.x, s.y, facing)) placed++;
      else break;
    }
    return placed;
  };

  // Assign each type to a different wall at random.
  const lockersOnNE = rng() < 0.5;
  const lockersFacing: FurnitureFacing = lockersOnNE ? "SW" : "SE";
  const shelfFacing: FurnitureFacing = lockersOnNE ? "SE" : "SW";
  const lockerCount = 1 + Math.floor(rng() * 2); // 1–2
  const shelfCount = 1 + Math.floor(rng() * 4); // 1–4

  placeOnWall("lockers", lockersFacing, lockerCount, 0);
  placeOnWall("bookshelf2", shelfFacing, shelfCount, 0);
  return furnitures;
}

/**
 * Police bullpen: uniform Desk2 grid — 6, 8, or 10 desks in 2–3 rows.
 * At least 2 empty tiles between each desk. Keeps the entrance corridor clear.
 */
function placePoliceBullpen(
  bx: number,
  by: number,
  iW: number,
  iH: number,
  exit: InteriorExit,
  occupied: Set<string>,
  startIndex: number,
  rng: () => number,
): SearchableObject[] {
  const furnitures: SearchableObject[] = [];
  let furnitureIndex = startIndex;
  const { w: dw, h: dh } = furnitureFootprint("desk2");
  // Desk footprint + ≥2 empty tiles between desks.
  const gap = 2;
  const colPitch = dw + gap;
  const rowPitch = dh + gap;
  const margin = 2;
  const deskCounts = [6, 8, 10] as const;
  const target = deskCounts[Math.floor(rng() * deskCounts.length)]!;

  // Uniform rows×cols — prefer 2 or 3 rows.
  let rows: number;
  let cols: number;
  if (target === 6) {
    if (rng() < 0.5) {
      rows = 2;
      cols = 3;
    } else {
      rows = 3;
      cols = 2;
    }
  } else if (target === 8) {
    rows = 2;
    cols = 4;
  } else {
    rows = 2;
    cols = 5;
  }

  const facing: FurnitureFacing = "SW";

  const blocksExit = (tx: number, ty: number): boolean => {
    if (tx === exit.insideX && ty === exit.insideY) return true;
    // Keep a deep clear band at the street door so the bullpen doesn't clog entry.
    if (exit.face === "SE") {
      if (tx >= iW - 4 && ty >= exit.alongMin - 1 && ty <= exit.alongMax + 1) {
        return true;
      }
    } else if (ty >= iH - 4 && tx >= exit.alongMin - 1 && tx <= exit.alongMax + 1) {
      return true;
    }
    return false;
  };

  const footprintFree = (ox: number, oy: number): boolean => {
    if (ox < 0 || oy < 0 || ox + dw > iW || oy + dh > iH) return false;
    for (let ty = oy; ty < oy + dh; ty++) {
      for (let tx = ox; tx < ox + dw; tx++) {
        if (occupied.has(`${tx},${ty}`)) return false;
        if (blocksExit(tx, ty)) return false;
      }
    }
    const approaches = furnitureFrontApproachTiles({
      kind: "furniture",
      objectType: "desk2",
      x: ox,
      y: oy,
      facing,
    });
    if (approaches.length === 0) return false;
    for (const t of approaches) {
      if (t.x < 0 || t.y < 0 || t.x >= iW || t.y >= iH) return false;
      if (occupied.has(`${t.x},${t.y}`)) return false;
      if (blocksExit(t.x, t.y)) return false;
    }
    return true;
  };

  const placeDesk = (ox: number, oy: number): boolean => {
    if (!footprintFree(ox, oy)) return false;
    for (let ty = oy; ty < oy + dh; ty++) {
      for (let tx = ox; tx < ox + dw; tx++) {
        occupied.add(`${tx},${ty}`);
      }
    }
    for (const t of furnitureFrontApproachTiles({
      kind: "furniture",
      objectType: "desk2",
      x: ox,
      y: oy,
      facing,
    })) {
      occupied.add(`${t.x},${t.y}`);
    }
    furnitures.push({
      id: interiorSearchableId(bx, by, "furniture", furnitureIndex++),
      kind: "furniture",
      objectType: "desk2",
      x: ox,
      y: oy,
      searched: false,
      buildingX: bx,
      buildingY: by,
      facing,
    });
    return true;
  };

  const gridSpanX = (cols - 1) * colPitch + dw;
  const gridSpanY = (rows - 1) * rowPitch + dh;
  // Leave room for wall furniture on NW (x≈0) / NE (y≈0) and the exit band.
  const usableX0 = margin;
  const usableX1 = iW - margin;
  const usableY0 = margin;
  const usableY1 = iH - 5;
  const x0 = Math.max(
    usableX0,
    Math.min(
      usableX1 - gridSpanX,
      Math.floor((usableX0 + usableX1 - gridSpanX) / 2),
    ),
  );
  const y0 = Math.max(
    usableY0,
    Math.min(
      usableY1 - gridSpanY,
      Math.floor((usableY0 + usableY1 - gridSpanY) / 2),
    ),
  );

  for (let row = 0; row < rows; row++) {
    const y = y0 + row * rowPitch;
    for (let col = 0; col < cols; col++) {
      placeDesk(x0 + col * colPitch, y);
    }
  }

  return furnitures;
}

/**
 * WaterCooler — exactly one beside a random Desk2.
 * SW desk → SE cooler on the NE neighbour; SE desk → SW cooler on the NW neighbour.
 */
function placePoliceWaterCooler(
  bx: number,
  by: number,
  iW: number,
  iH: number,
  exit: InteriorExit,
  desks: SearchableObject[],
  allFurniture: SearchableObject[],
  occupied: Set<string>,
  startIndex: number,
  rng: () => number,
): SearchableObject[] {
  if (desks.length === 0) return [];

  const deskOrder = desks.slice();
  for (let i = deskOrder.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = deskOrder[i]!;
    deskOrder[i] = deskOrder[j]!;
    deskOrder[j] = tmp;
  }

  const onFurnitureFootprint = (tx: number, ty: number): boolean =>
    allFurniture.some((f) => searchableOccupiesTile(f, tx, ty));

  for (const desk of deskOrder) {
    const deskFacing = furnitureFacing(desk);
    // SW desk → SE cooler on NE; SE desk → SW cooler on NW.
    const coolerFacing: FurnitureFacing = deskFacing === "SW" ? "SE" : "SW";
    const neighbourFacing: FurnitureFacing = deskFacing === "SW" ? "NE" : "NW";
    const { dx, dy } = ISO_FACING_TILE_DELTA[neighbourFacing];
    const ox = desk.x + dx;
    const oy = desk.y + dy;
    if (ox < 0 || oy < 0 || ox >= iW || oy >= iH) continue;
    if (ox === exit.insideX && oy === exit.insideY) continue;
    if (onFurnitureFootprint(ox, oy)) continue;
    if (furnitureFrontApproachTiles(desk).some((t) => t.x === ox && t.y === oy)) {
      continue;
    }
    if (occupied.has(`${ox},${oy}`)) continue;

    const approaches = furnitureFrontApproachTiles({
      kind: "furniture",
      objectType: "watercooler",
      x: ox,
      y: oy,
      facing: coolerFacing,
    });
    if (approaches.length === 0) continue;
    let approachesOk = true;
    for (const t of approaches) {
      if (t.x < 0 || t.y < 0 || t.x >= iW || t.y >= iH) {
        approachesOk = false;
        break;
      }
      if (t.x === exit.insideX && t.y === exit.insideY) {
        approachesOk = false;
        break;
      }
      if (onFurnitureFootprint(t.x, t.y)) {
        approachesOk = false;
        break;
      }
    }
    if (!approachesOk) continue;

    occupied.add(`${ox},${oy}`);
    for (const t of approaches) occupied.add(`${t.x},${t.y}`);

    return [
      {
        id: interiorSearchableId(bx, by, "furniture", startIndex),
        kind: "furniture",
        objectType: "watercooler",
        x: ox,
        y: oy,
        searched: false,
        buildingX: bx,
        buildingY: by,
        facing: coolerFacing,
      },
    ];
  }

  return [];
}

/**
 * TrashCan1 — 25% chance per desk, beside the desk and off the loot approach.
 * SW desk: SE can on the tile just east of the footprint.
 * SE desk: SW can on the tile just south of the footprint.
 */
function placePoliceTrashCans(
  bx: number,
  by: number,
  iW: number,
  iH: number,
  exit: InteriorExit,
  desks: SearchableObject[],
  allFurniture: SearchableObject[],
  occupied: Set<string>,
  startIndex: number,
  rng: () => number,
  blocked: (tx: number, ty: number) => boolean = () => false,
): SearchableObject[] {
  if (desks.length === 0) return [];

  const furnitures: SearchableObject[] = [];
  let furnitureIndex = startIndex;

  const onFurnitureFootprint = (tx: number, ty: number): boolean =>
    allFurniture.some((f) => searchableOccupiesTile(f, tx, ty)) ||
    furnitures.some((f) => searchableOccupiesTile(f, tx, ty));

  for (const desk of desks) {
    if (rng() >= FURNITURE_SPAWN_CHANCE.trashcan) continue;

    const deskFacing = furnitureFacing(desk);
    // Keep the desk approach clear: SW desk gets the SE side, SE desk the SW side.
    const canFacing: FurnitureFacing = deskFacing === "SW" ? "SE" : "SW";
    const { dx, dy } = ISO_FACING_TILE_DELTA[canFacing];
    const { w, h } = searchableFootprint(desk);
    const ox = dx > 0 ? desk.x + w : dx < 0 ? desk.x - 1 : desk.x;
    const oy = dy > 0 ? desk.y + h : dy < 0 ? desk.y - 1 : desk.y;
    if (ox < 0 || oy < 0 || ox >= iW || oy >= iH) continue;
    if (blocked(ox, oy)) continue;
    if (ox === exit.insideX && oy === exit.insideY) continue;
    if (onFurnitureFootprint(ox, oy)) continue;
    if (furnitureFrontApproachTiles(desk).some((t) => t.x === ox && t.y === oy)) {
      continue;
    }
    if (occupied.has(`${ox},${oy}`)) continue;

    const approaches = furnitureFrontApproachTiles({
      kind: "furniture",
      objectType: "trashcan",
      x: ox,
      y: oy,
      facing: canFacing,
    });
    if (approaches.length === 0) continue;
    let approachesOk = true;
    for (const t of approaches) {
      if (t.x < 0 || t.y < 0 || t.x >= iW || t.y >= iH) {
        approachesOk = false;
        break;
      }
      if (t.x === exit.insideX && t.y === exit.insideY || blocked(t.x, t.y)) {
        approachesOk = false;
        break;
      }
      if (onFurnitureFootprint(t.x, t.y) || occupied.has(`${t.x},${t.y}`)) {
        approachesOk = false;
        break;
      }
    }
    if (!approachesOk) continue;

    occupied.add(`${ox},${oy}`);
    for (const t of approaches) occupied.add(`${t.x},${t.y}`);

    furnitures.push({
      id: interiorSearchableId(bx, by, "furniture", furnitureIndex++),
      kind: "furniture",
      objectType: "trashcan",
      x: ox,
      y: oy,
      searched: false,
      buildingX: bx,
      buildingY: by,
      facing: canFacing,
    });
  }

  return furnitures;
}

/**
 * BagChair1 (SW art) — at most one beside a random Desk2.
 * Never sits on the desk's loot approach: SW desks get the chair on SE,
 * SE desks get it on SW.
 */
function placePoliceBagChairs(
  bx: number,
  by: number,
  iW: number,
  iH: number,
  exit: InteriorExit,
  desks: SearchableObject[],
  allFurniture: SearchableObject[],
  occupied: Set<string>,
  startIndex: number,
  rng: () => number,
): SearchableObject[] {
  if (desks.length === 0) return [];
  if (rng() >= FURNITURE_SPAWN_CHANCE.bagchair) return [];

  // BagChair1 only has SW sheets.
  const chairFacing: FurnitureFacing = "SW";

  const deskOrder = desks.slice();
  for (let i = deskOrder.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = deskOrder[i]!;
    deskOrder[i] = deskOrder[j]!;
    deskOrder[j] = tmp;
  }

  const onFurnitureFootprint = (tx: number, ty: number): boolean =>
    allFurniture.some((f) => searchableOccupiesTile(f, tx, ty));

  for (const desk of deskOrder) {
    const deskFacing = furnitureFacing(desk);
    // Keep the desk approach clear for searching.
    const seatFacing: FurnitureFacing = deskFacing === "SW" ? "SE" : "SW";
    const { dx, dy } = ISO_FACING_TILE_DELTA[seatFacing];
    const ox = desk.x + dx;
    const oy = desk.y + dy;
    if (ox < 0 || oy < 0 || ox >= iW || oy >= iH) continue;
    if (ox === exit.insideX && oy === exit.insideY) continue;
    if (onFurnitureFootprint(ox, oy)) continue;
    if (furnitureFrontApproachTiles(desk).some((t) => t.x === ox && t.y === oy)) {
      continue;
    }
    if (occupied.has(`${ox},${oy}`)) continue;

    const approaches = furnitureFrontApproachTiles({
      kind: "furniture",
      objectType: "bagchair",
      x: ox,
      y: oy,
      facing: chairFacing,
    });
    if (approaches.length === 0) continue;
    let approachesOk = true;
    for (const t of approaches) {
      if (t.x < 0 || t.y < 0 || t.x >= iW || t.y >= iH) {
        approachesOk = false;
        break;
      }
      if (t.x === exit.insideX && t.y === exit.insideY) {
        approachesOk = false;
        break;
      }
      if (onFurnitureFootprint(t.x, t.y)) {
        approachesOk = false;
        break;
      }
    }
    if (!approachesOk) continue;

    occupied.add(`${ox},${oy}`);
    for (const t of approaches) occupied.add(`${t.x},${t.y}`);

    return [
      {
        id: interiorSearchableId(bx, by, "furniture", startIndex),
        kind: "furniture",
        objectType: "bagchair",
        x: ox,
        y: oy,
        searched: false,
        buildingX: bx,
        buildingY: by,
        facing: chairFacing,
      },
    ];
  }

  return [];
}

/**
 * At most one VendingMachine1 flush on the NE or NW wall (chance-gated).
 */
function placePoliceVendingMachine(
  bx: number,
  by: number,
  iW: number,
  iH: number,
  exit: InteriorExit,
  allFurniture: SearchableObject[],
  occupied: Set<string>,
  startIndex: number,
  rng: () => number,
): SearchableObject[] {
  if (rng() >= FURNITURE_SPAWN_CHANCE.vendingmachine) return [];

  const blocksExit = (tx: number, ty: number): boolean => {
    if (tx === exit.insideX && ty === exit.insideY) return true;
    if (exit.face === "SE") {
      if (tx >= iW - 4 && ty >= exit.alongMin - 1 && ty <= exit.alongMax + 1) {
        return true;
      }
    } else if (ty >= iH - 4 && tx >= exit.alongMin - 1 && tx <= exit.alongMax + 1) {
      return true;
    }
    return false;
  };

  const onFurnitureFootprint = (tx: number, ty: number): boolean =>
    allFurniture.some((f) => searchableOccupiesTile(f, tx, ty));

  const canPlace = (
    ox: number,
    oy: number,
    facing: FurnitureFacing,
  ): boolean => {
    const { w, h } = furnitureFootprint("vendingmachine", facing);
    if (ox < 0 || oy < 0 || ox + w > iW || oy + h > iH) return false;
    for (let ty = oy; ty < oy + h; ty++) {
      for (let tx = ox; tx < ox + w; tx++) {
        if (occupied.has(`${tx},${ty}`)) return false;
        if (onFurnitureFootprint(tx, ty)) return false;
        if (blocksExit(tx, ty)) return false;
      }
    }
    const approaches = furnitureFrontApproachTiles({
      kind: "furniture",
      objectType: "vendingmachine",
      x: ox,
      y: oy,
      facing,
    });
    if (approaches.length === 0) return false;
    for (const t of approaches) {
      if (t.x < 0 || t.y < 0 || t.x >= iW || t.y >= iH) return false;
      if (occupied.has(`${t.x},${t.y}`)) return false;
      if (onFurnitureFootprint(t.x, t.y)) return false;
      if (blocksExit(t.x, t.y)) return false;
    }
    return true;
  };

  type Slot = { x: number; y: number; facing: FurnitureFacing };
  const slots: Slot[] = [];
  // NE wall (y = 0) — face SW into the room.
  for (let x = 1; x < iW - 1; x++) {
    slots.push({ x, y: 0, facing: "SW" });
  }
  // NW wall (x = 0) — face SE into the room.
  for (let y = 1; y < iH - 1; y++) {
    slots.push({ x: 0, y, facing: "SE" });
  }
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = slots[i]!;
    slots[i] = slots[j]!;
    slots[j] = tmp;
  }

  for (const slot of slots) {
    if (!canPlace(slot.x, slot.y, slot.facing)) continue;
    const { w, h } = furnitureFootprint("vendingmachine", slot.facing);
    for (let ty = slot.y; ty < slot.y + h; ty++) {
      for (let tx = slot.x; tx < slot.x + w; tx++) {
        occupied.add(`${tx},${ty}`);
      }
    }
    for (const t of furnitureFrontApproachTiles({
      kind: "furniture",
      objectType: "vendingmachine",
      x: slot.x,
      y: slot.y,
      facing: slot.facing,
    })) {
      occupied.add(`${t.x},${t.y}`);
    }
    return [
      {
        id: interiorSearchableId(bx, by, "furniture", startIndex),
        kind: "furniture",
        objectType: "vendingmachine",
        x: slot.x,
        y: slot.y,
        searched: false,
        buildingX: bx,
        buildingY: by,
        facing: slot.facing,
      },
    ];
  }

  return [];
}

/**
 * At most one DeadOfficer beside a random Desk2 — never on the desk loot approach.
 * SW desk → SE neighbour (SE art); SE desk → SW neighbour (SW art).
 */
function placePoliceDeadOfficer(
  bx: number,
  by: number,
  iW: number,
  iH: number,
  exit: InteriorExit,
  desks: SearchableObject[],
  allFurniture: SearchableObject[],
  occupied: Set<string>,
  startIndex: number,
  rng: () => number,
): SearchableObject[] {
  if (desks.length === 0) return [];
  if (rng() >= FURNITURE_SPAWN_CHANCE.deadofficer) return [];

  const deskOrder = desks.slice();
  for (let i = deskOrder.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = deskOrder[i]!;
    deskOrder[i] = deskOrder[j]!;
    deskOrder[j] = tmp;
  }

  const onFurnitureFootprint = (tx: number, ty: number): boolean =>
    allFurniture.some((f) => searchableOccupiesTile(f, tx, ty));

  for (const desk of deskOrder) {
    const deskFacing = furnitureFacing(desk);
    // Never sit on the desk loot approach (SW of SW desk / SE of SE desk).
    const facing: FurnitureFacing = deskFacing === "SW" ? "SE" : "SW";
    const { dx, dy } = ISO_FACING_TILE_DELTA[facing];
    const ox = desk.x + dx;
    const oy = desk.y + dy;
    if (ox < 0 || oy < 0 || ox >= iW || oy >= iH) continue;
    if (ox === exit.insideX && oy === exit.insideY) continue;
    if (onFurnitureFootprint(ox, oy)) continue;
    if (furnitureFrontApproachTiles(desk).some((t) => t.x === ox && t.y === oy)) {
      continue;
    }
    if (occupied.has(`${ox},${oy}`)) continue;

    const bodyApproaches = furnitureFrontApproachTiles({
      kind: "furniture",
      objectType: "deadofficer",
      x: ox,
      y: oy,
      facing,
    });
    if (bodyApproaches.length === 0) continue;
    let approachesOk = true;
    for (const t of bodyApproaches) {
      if (t.x < 0 || t.y < 0 || t.x >= iW || t.y >= iH) {
        approachesOk = false;
        break;
      }
      if (t.x === exit.insideX && t.y === exit.insideY) {
        approachesOk = false;
        break;
      }
      if (onFurnitureFootprint(t.x, t.y)) {
        approachesOk = false;
        break;
      }
    }
    if (!approachesOk) continue;

    occupied.add(`${ox},${oy}`);
    for (const t of bodyApproaches) occupied.add(`${t.x},${t.y}`);

    return [
      {
        id: interiorSearchableId(bx, by, "furniture", startIndex),
        kind: "furniture",
        objectType: "deadofficer",
        x: ox,
        y: oy,
        searched: false,
        buildingX: bx,
        buildingY: by,
        facing,
      },
    ];
  }

  return [];
}

/** Checkout1 count near supermarket entrances. */
const SUPERMARKET_CHECKOUT_MIN = 3;
const SUPERMARKET_CHECKOUT_MAX = 5;
/** Walkable tiles between consecutive Checkout1 footprints. */
const SUPERMARKET_CHECKOUT_GAP = 3;
/** Keep Checkout1 at least this many tiles away from exterior walls. */
const SUPERMARKET_CHECKOUT_WALL_GAP = 1;
/** Min empty tiles between Checkout1 footprint and SuperShelf1/2 footprint. */
const SUPERMARKET_CHECKOUT_SHELF_GAP = 1;
/** Min empty tiles between SuperFridge1 footprint and SuperShelf1/2. */
const SUPERMARKET_FRIDGE_SHELF_GAP = 2;
/** Keep SuperFridge1 at least this many tiles from the free side walls. */
const SUPERMARKET_FRIDGE_SIDE_GAP = 1;
/** SuperFridge1 count along the back wall (packed as one contiguous bank). */
const SUPERMARKET_FRIDGE_MIN = 3;
const SUPERMARKET_FRIDGE_MAX = 6;

/**
 * Place 3–6 SuperFridge1 flush against each other on the back wall.
 * SE entrance → SE fridge (1×2) on the NW wall (x = 0);
 * SW entrance → SW fridge (2×1) on the NE wall (y = 0).
 * Bank is centred along the wall when space allows. Reserves approach tiles
 * and a 2-tile halo so SuperShelf aisles stay clear.
 */
function placeSupermarketFridges(
  bx: number,
  by: number,
  iW: number,
  iH: number,
  exit: InteriorExit,
  rng: () => number,
  occupied: Set<string>,
  startIndex: number,
): SearchableObject[] {
  // Match the entrance face so the fridge bank sits on the opposite wall.
  const facing: FurnitureFacing = exit.face === "SE" ? "SE" : "SW";
  const { w, h } = furnitureFootprint("superfridge1", facing);
  const sideGap = SUPERMARKET_FRIDGE_SIDE_GAP;
  const onNwWall = facing === "SE";
  const wallX = onNwWall ? 0 : -1;
  const wallY = onNwWall ? -1 : 0;

  if (onNwWall) {
    if (iW < 2 || iH < h + 2 * sideGap) return [];
  } else if (iH < 2 || iW < w + 2 * sideGap) {
    return [];
  }

  const target =
    SUPERMARKET_FRIDGE_MIN +
    Math.floor(
      rng() * (SUPERMARKET_FRIDGE_MAX - SUPERMARKET_FRIDGE_MIN + 1),
    );

  const clearFrontX =
    exit.face === "SE" ? exit.insideX - 1 : exit.insideX;
  const clearFrontY =
    exit.face === "SW" ? exit.insideY - 1 : exit.insideY;

  const blocksEntry = (tx: number, ty: number): boolean => {
    if (tx === exit.insideX && ty === exit.insideY) return true;
    if (tx === clearFrontX && ty === clearFrontY) return true;
    return false;
  };

  const markFootprint = (ox: number, oy: number) => {
    for (let ty = oy; ty < oy + h; ty++) {
      for (let tx = ox; tx < ox + w; tx++) occupied.add(`${tx},${ty}`);
    }
    for (const t of furnitureFrontApproachTiles({
      kind: "furniture",
      objectType: "superfridge1",
      x: ox,
      y: oy,
      facing,
    })) {
      if (t.x >= 0 && t.y >= 0 && t.x < iW && t.y < iH) {
        occupied.add(`${t.x},${t.y}`);
      }
    }
  };

  const canPlaceAt = (ox: number, oy: number): boolean => {
    if (onNwWall) {
      if (ox !== 0 || oy < sideGap) return false;
      if (oy + h > iH - sideGap) return false;
    } else {
      if (oy !== 0 || ox < sideGap) return false;
      if (ox + w > iW - sideGap) return false;
    }
    for (let ty = oy; ty < oy + h; ty++) {
      for (let tx = ox; tx < ox + w; tx++) {
        if (occupied.has(`${tx},${ty}`)) return false;
        if (blocksEntry(tx, ty)) return false;
      }
    }
    const approaches = furnitureFrontApproachTiles({
      kind: "furniture",
      objectType: "superfridge1",
      x: ox,
      y: oy,
      facing,
    });
    if (approaches.length === 0) return false;
    for (const t of approaches) {
      if (t.x < 0 || t.y < 0 || t.x >= iW || t.y >= iH) return false;
      if (occupied.has(`${t.x},${t.y}`)) return false;
      if (blocksEntry(t.x, t.y)) return false;
    }
    return true;
  };

  /** True when every unit in a flush bank starting at `bankStart` can place. */
  const canPlaceBank = (bankStart: number, count: number): boolean => {
    for (let i = 0; i < count; i++) {
      const ox = onNwWall ? wallX : bankStart + i * w;
      const oy = onNwWall ? bankStart + i * h : wallY;
      if (!canPlaceAt(ox, oy)) return false;
    }
    return true;
  };

  const runSpan = onNwWall ? iH : iW;
  const unitSpan = onNwWall ? h : w;

  let bankCount = 0;
  let bankStart = sideGap;
  for (let count = target; count >= 1; count--) {
    const bankLen = count * unitSpan;
    if (bankLen + 2 * sideGap > runSpan) continue;
    const prefer = Math.max(
      sideGap,
      Math.min(
        runSpan - sideGap - bankLen,
        Math.round((runSpan - bankLen) / 2),
      ),
    );
    const minS = sideGap;
    const maxS = runSpan - sideGap - bankLen;
    const candidates: number[] = [prefer];
    for (let s = minS; s <= maxS; s++) {
      if (s !== prefer) candidates.push(s);
    }
    candidates.sort((a, b) => Math.abs(a - prefer) - Math.abs(b - prefer));
    const fit = candidates.find((s) => canPlaceBank(s, count));
    if (fit !== undefined) {
      bankCount = count;
      bankStart = fit;
      break;
    }
  }
  if (bankCount < 1) return [];

  const placed: { x: number; y: number }[] = [];
  for (let i = 0; i < bankCount; i++) {
    const ox = onNwWall ? 0 : bankStart + i * w;
    const oy = onNwWall ? bankStart + i * h : 0;
    placed.push({ x: ox, y: oy });
    markFootprint(ox, oy);
  }

  const furnitures: SearchableObject[] = [];
  let furnitureIndex = startIndex;
  for (const p of placed) {
    furnitures.push({
      id: interiorSearchableId(bx, by, "furniture", furnitureIndex++),
      kind: "furniture",
      objectType: "superfridge1",
      x: p.x,
      y: p.y,
      searched: false,
      buildingX: bx,
      buildingY: by,
      facing,
    });
  }

  // Keep SuperShelf footprints ≥2 empty tiles away from SuperFridge1.
  const shelfGap = SUPERMARKET_FRIDGE_SHELF_GAP;
  for (const p of placed) {
    for (let ty = p.y - shelfGap; ty < p.y + h + shelfGap; ty++) {
      for (let tx = p.x - shelfGap; tx < p.x + w + shelfGap; tx++) {
        if (tx < 0 || ty < 0 || tx >= iW || ty >= iH) continue;
        occupied.add(`${tx},${ty}`);
      }
    }
  }

  return furnitures;
}

/**
 * Place 3–5 Checkout1 near the supermarket entrance with ≥3 tiles between
 * each footprint and ≥1 tile from exterior walls. Lined up parallel to the
 * door wall. SE entrance → SW checkout (3×2); SW entrance → SE checkout (2×3).
 */
function placeSupermarketCheckouts(
  bx: number,
  by: number,
  iW: number,
  iH: number,
  exit: InteriorExit,
  rng: () => number,
  occupied: Set<string>,
  startIndex: number,
): SearchableObject[] {
  // Opposite the entrance so the queue opens toward the door aisle.
  const facing: FurnitureFacing = exit.face === "SE" ? "SW" : "SE";
  const { w, h } = furnitureFootprint("checkout", facing);
  const gap = SUPERMARKET_CHECKOUT_GAP;
  const wallGap = SUPERMARKET_CHECKOUT_WALL_GAP;
  const target =
    SUPERMARKET_CHECKOUT_MIN +
    Math.floor(rng() * (SUPERMARKET_CHECKOUT_MAX - SUPERMARKET_CHECKOUT_MIN + 1));

  const clearFrontX =
    exit.face === "SE" ? exit.insideX - 1 : exit.insideX;
  const clearFrontY =
    exit.face === "SW" ? exit.insideY - 1 : exit.insideY;

  const blocksEntry = (tx: number, ty: number): boolean => {
    if (tx === exit.insideX && ty === exit.insideY) return true;
    if (tx === clearFrontX && ty === clearFrontY) return true;
    return false;
  };

  const markFootprint = (ox: number, oy: number) => {
    for (let ty = oy; ty < oy + h; ty++) {
      for (let tx = ox; tx < ox + w; tx++) occupied.add(`${tx},${ty}`);
    }
    for (const t of furnitureFrontApproachTiles({
      kind: "furniture",
      objectType: "checkout",
      x: ox,
      y: oy,
      facing,
    })) {
      if (t.x >= 0 && t.y >= 0 && t.x < iW && t.y < iH) {
        occupied.add(`${t.x},${t.y}`);
      }
    }
  };

  const canPlaceAt = (ox: number, oy: number): boolean => {
    if (ox < wallGap || oy < wallGap) return false;
    if (ox + w > iW - wallGap || oy + h > iH - wallGap) return false;
    for (let ty = oy; ty < oy + h; ty++) {
      for (let tx = ox; tx < ox + w; tx++) {
        if (occupied.has(`${tx},${ty}`)) return false;
        if (blocksEntry(tx, ty)) return false;
      }
    }
    const approaches = furnitureFrontApproachTiles({
      kind: "furniture",
      objectType: "checkout",
      x: ox,
      y: oy,
      facing,
    });
    if (approaches.length === 0) return false;
    for (const t of approaches) {
      if (t.x < 0 || t.y < 0 || t.x >= iW || t.y >= iH) return false;
      if (occupied.has(`${t.x},${t.y}`)) return false;
      if (blocksEntry(t.x, t.y)) return false;
    }
    return true;
  };

  /** True when footprints are closer than `gap` empty tiles along the lane axis. */
  const tooClose = (
    a: { x: number; y: number },
    b: { x: number; y: number },
  ): boolean => {
    if (exit.face === "SE") {
      // Same column lane — gap measured along Y.
      const dy = Math.abs(a.y - b.y);
      return dy < h + gap;
    }
    const dx = Math.abs(a.x - b.x);
    return dx < w + gap;
  };

  const candidates: { x: number; y: number }[] = [];
  if (exit.face === "SE") {
    // Parallel to east door; SW approach sits south of each lane.
    const ox = exit.insideX - 1 - w;
    if (ox >= wallGap) {
      for (let oy = wallGap; oy + h <= iH - wallGap; oy++) {
        // Leave room for SW approach tile south of the footprint.
        if (oy + h >= iH) continue;
        candidates.push({ x: ox, y: oy });
      }
      candidates.sort(
        (a, b) => Math.abs(a.y - exit.insideY) - Math.abs(b.y - exit.insideY),
      );
    }
  } else {
    // Parallel to south door; SE approach sits east of each lane.
    const oy = Math.min(exit.insideY - h, iH - wallGap - h);
    if (oy >= wallGap) {
      for (let ox = wallGap; ox + w <= iW - wallGap; ox++) {
        // Leave room for SE approach tile east of the footprint.
        if (ox + w >= iW) continue;
        candidates.push({ x: ox, y: oy });
      }
      candidates.sort(
        (a, b) => Math.abs(a.x - exit.insideX) - Math.abs(b.x - exit.insideX),
      );
    }
  }

  const placed: { x: number; y: number }[] = [];
  for (const c of candidates) {
    if (placed.length >= target) break;
    if (!canPlaceAt(c.x, c.y)) continue;
    if (placed.some((p) => tooClose(p, c))) continue;
    placed.push(c);
    markFootprint(c.x, c.y);
  }

  const furnitures: SearchableObject[] = [];
  let furnitureIndex = startIndex;
  for (const p of placed) {
    furnitures.push({
      id: interiorSearchableId(bx, by, "furniture", furnitureIndex++),
      kind: "furniture",
      objectType: "checkout",
      x: p.x,
      y: p.y,
      searched: false,
      buildingX: bx,
      buildingY: by,
      facing,
    });
  }

  // Keep ≥1 empty tile between Checkout1 and any SuperShelf footprint.
  const shelfGap = SUPERMARKET_CHECKOUT_SHELF_GAP;
  for (const p of placed) {
    for (let ty = p.y - shelfGap; ty < p.y + h + shelfGap; ty++) {
      for (let tx = p.x - shelfGap; tx < p.x + w + shelfGap; tx++) {
        if (tx < 0 || ty < 0 || tx >= iW || ty >= iH) continue;
        occupied.add(`${tx},${ty}`);
      }
    }
  }

  return furnitures;
}

/** Walkable tiles between SuperShelf gondola rows (along the facing axis). */
const SUPERMARKET_AISLE_GAP = 2;
/** Mid-gondola cross-aisle break (along the gondola run). */
const SUPERMARKET_CROSS_AISLE = 2;
/** Keep SuperShelf at least this many tiles from exterior walls. */
const SUPERMARKET_SHELF_WALL_GAP = 1;

/**
 * Fill the supermarket sales floor with SuperShelf1/2 aisles.
 * SE entrance → SW shelves (3×1); SW entrance → SE shelves (1×3).
 * Parallel gondola rows with ≥2-tile walk aisles between them, a mid-row
 * cross-aisle on longer runs, and wall / entrance clearance. Alternates
 * shelf variants along each gondola for visual variety.
 */
function placeSupermarketShelves(
  bx: number,
  by: number,
  iW: number,
  iH: number,
  exit: InteriorExit,
  rng: () => number,
  occupied: Set<string>,
  startIndex: number,
): SearchableObject[] {
  // Opposite the entrance so aisle fronts open toward the door approach.
  const facing: FurnitureFacing = exit.face === "SE" ? "SW" : "SE";
  const { w: sw, h: sh } = furnitureFootprint("supershelf1", facing);
  const wallGap = SUPERMARKET_SHELF_WALL_GAP;
  const aisleGap = SUPERMARKET_AISLE_GAP;
  const crossAisle = SUPERMARKET_CROSS_AISLE;
  const aisleAlongX = facing === "SE";

  const clearFrontX =
    exit.face === "SE" ? exit.insideX - 1 : exit.insideX;
  const clearFrontY =
    exit.face === "SW" ? exit.insideY - 1 : exit.insideY;

  const blocksEntry = (tx: number, ty: number): boolean => {
    if (tx === exit.insideX && ty === exit.insideY) return true;
    if (tx === clearFrontX && ty === clearFrontY) return true;
    return false;
  };

  const markFootprint = (ox: number, oy: number) => {
    for (let ty = oy; ty < oy + sh; ty++) {
      for (let tx = ox; tx < ox + sw; tx++) occupied.add(`${tx},${ty}`);
    }
    // Reserve a 2-tile-deep aisle (approach + one more) so rows stay shoppable.
    for (let d = 1; d <= aisleGap; d++) {
      if (aisleAlongX) {
        for (let ty = oy; ty < oy + sh; ty++) {
          const ax = ox + sw - 1 + d;
          if (ax >= 0 && ax < iW && ty >= 0 && ty < iH) {
            occupied.add(`${ax},${ty}`);
          }
        }
      } else {
        for (let tx = ox; tx < ox + sw; tx++) {
          const ay = oy + sh - 1 + d;
          if (tx >= 0 && tx < iW && ay >= 0 && ay < iH) {
            occupied.add(`${tx},${ay}`);
          }
        }
      }
    }
  };

  const canPlaceAt = (ox: number, oy: number): boolean => {
    if (ox < wallGap || oy < wallGap) return false;
    if (ox + sw > iW - wallGap || oy + sh > iH - wallGap) return false;
    // Need room for the aisle strip inside the interior.
    if (aisleAlongX) {
      if (ox + sw - 1 + aisleGap >= iW - wallGap + 1) return false;
    } else if (oy + sh - 1 + aisleGap >= iH - wallGap + 1) {
      return false;
    }
    for (let ty = oy; ty < oy + sh; ty++) {
      for (let tx = ox; tx < ox + sw; tx++) {
        if (occupied.has(`${tx},${ty}`)) return false;
        if (blocksEntry(tx, ty)) return false;
      }
    }
    for (let d = 1; d <= aisleGap; d++) {
      if (aisleAlongX) {
        for (let ty = oy; ty < oy + sh; ty++) {
          const ax = ox + sw - 1 + d;
          if (ax < 0 || ty < 0 || ax >= iW || ty >= iH) return false;
          if (occupied.has(`${ax},${ty}`)) return false;
          if (blocksEntry(ax, ty)) return false;
        }
      } else {
        for (let tx = ox; tx < ox + sw; tx++) {
          const ay = oy + sh - 1 + d;
          if (tx < 0 || ay < 0 || tx >= iW || ay >= iH) return false;
          if (occupied.has(`${tx},${ay}`)) return false;
          if (blocksEntry(tx, ay)) return false;
        }
      }
    }
    return true;
  };

  const furnitures: SearchableObject[] = [];
  let furnitureIndex = startIndex;
  // Start each store on a random variant so neighbouring buildings differ.
  let variantFlip = rng() < 0.5 ? 0 : 1;

  const pushShelf = (ox: number, oy: number) => {
    const objectType: FurnitureType =
      variantFlip % 2 === 0 ? "supershelf1" : "supershelf2";
    variantFlip++;
    furnitures.push({
      id: interiorSearchableId(bx, by, "furniture", furnitureIndex++),
      kind: "furniture",
      objectType,
      x: ox,
      y: oy,
      searched: false,
      buildingX: bx,
      buildingY: by,
      facing,
    });
    markFootprint(ox, oy);
  };

  if (aisleAlongX) {
    // SE shelves: gondola rows along X, units stack along Y.
    const rowPitch = sw + aisleGap;
    const maxRowX = iW - wallGap - sw - aisleGap;
    for (let rowX = wallGap; rowX <= maxRowX; rowX += rowPitch) {
      const spanY = iH - 2 * wallGap;
      const maxUnits = Math.floor(spanY / sh);
      if (maxUnits < 1) continue;
      const breakAfter = maxUnits >= 3 ? Math.floor(maxUnits / 2) : -1;
      let y = wallGap;
      for (let unit = 0; unit < maxUnits; unit++) {
        if (unit === breakAfter) y += crossAisle;
        if (y + sh > iH - wallGap) break;
        if (!canPlaceAt(rowX, y)) {
          y += sh;
          continue;
        }
        pushShelf(rowX, y);
        y += sh;
      }
    }
  } else {
    // SW shelves: gondola rows along Y, units stack along X.
    const rowPitch = sh + aisleGap;
    const maxRowY = iH - wallGap - sh - aisleGap;
    for (let rowY = wallGap; rowY <= maxRowY; rowY += rowPitch) {
      const spanX = iW - 2 * wallGap;
      const maxUnits = Math.floor(spanX / sw);
      if (maxUnits < 1) continue;
      const breakAfter = maxUnits >= 3 ? Math.floor(maxUnits / 2) : -1;
      let x = wallGap;
      for (let unit = 0; unit < maxUnits; unit++) {
        if (unit === breakAfter) x += crossAisle;
        if (x + sw > iW - wallGap) break;
        if (!canPlaceAt(x, rowY)) {
          x += sw;
          continue;
        }
        pushShelf(x, rowY);
        x += sw;
      }
    }
  }

  return furnitures;
}

/** Thickness of admin arms / cubicle depth (exterior → front wall). */
const HOSPITAL_CUBICLE_DEPTH = 4;
/** Open tiles between shared dividers. */
const HOSPITAL_CUBICLE_INNER = 3;
const HOSPITAL_CUBICLE_PITCH = HOSPITAL_CUBICLE_INNER + 1;
const HOSPITAL_MAX_CUBICLES = 3;
/** Extra tiles past DEPTH so admin arms form a true L, not a square. */
const HOSPITAL_ADMIN_MIN_ARM = HOSPITAL_CUBICLE_DEPTH + 2;
/** 1-tile open gap between the outer cubicle wall and the SE / SW interior edges. */
const HOSPITAL_EDGE_GAP = 1;

/** Hospital waiting-bench art variants (ThreeSeater / 2 / 3). */
const THREE_SEATER_VARIANTS = [
  "threeseater",
  "threeseater2",
  "threeseater3",
] as const;

function pickThreeSeaterVariant(rng: () => number): FurnitureType {
  return THREE_SEATER_VARIANTS[
    Math.floor(rng() * THREE_SEATER_VARIANTS.length)
  ]!;
}

type HospitalWardLayout = {
  depth: number;
  inner: number;
  pitch: number;
  adminNe: number;
  adminNw: number;
  swCount: number;
  seCount: number;
  maxNeEnd: number;
  maxNwEnd: number;
};

/**
 * Shared hospital ward sizing — null when the L + cubicle layout cannot fit
 * (caller falls back to an open ward with no partitions).
 */
function hospitalWardLayout(iW: number, iH: number): HospitalWardLayout | null {
  const depth = HOSPITAL_CUBICLE_DEPTH;
  const inner = HOSPITAL_CUBICLE_INNER;
  const pitch = HOSPITAL_CUBICLE_PITCH;
  const maxNeEnd = iW - HOSPITAL_EDGE_GAP - 1;
  const maxNwEnd = iH - HOSPITAL_EDGE_GAP - 1;
  const adminNe = Math.min(
    maxNeEnd - pitch,
    Math.max(HOSPITAL_ADMIN_MIN_ARM, maxNeEnd - HOSPITAL_MAX_CUBICLES * pitch),
  );
  const adminNw = Math.min(
    maxNwEnd - pitch,
    Math.max(HOSPITAL_ADMIN_MIN_ARM, maxNwEnd - HOSPITAL_MAX_CUBICLES * pitch),
  );
  const swCount = Math.max(
    0,
    Math.min(HOSPITAL_MAX_CUBICLES, Math.floor((maxNeEnd - adminNe) / pitch)),
  );
  const seCount = Math.max(
    0,
    Math.min(HOSPITAL_MAX_CUBICLES, Math.floor((maxNwEnd - adminNw) / pitch)),
  );
  const canLayout =
    adminNe >= HOSPITAL_ADMIN_MIN_ARM &&
    adminNw >= HOSPITAL_ADMIN_MIN_ARM &&
    maxNeEnd >= adminNe + pitch &&
    maxNwEnd >= adminNw + pitch &&
    swCount >= 1 &&
    seCount >= 1;
  if (!canLayout) return null;
  return {
    depth,
    inner,
    pitch,
    adminNe,
    adminNw,
    swCount,
    seCount,
    maxNeEnd,
    maxNwEnd,
  };
}

/** Center door in each cubicle bay (open tiles bayStart+1 .. bayStart+inner). */
function hospitalCubicleDoorAt(bayStart: number, inner: number): number {
  return bayStart + Math.ceil(inner / 2);
}

/** One hospital cubicle bay — floor bounds, entrance gap, and shell partitions. */
export type HospitalCubicle = {
  facing: "SW" | "SE";
  /** Inclusive walkable floor bounds inside the bay. */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Door gap on the shared front wall (walkable entrance tile). */
  entranceX: number;
  entranceY: number;
  /** Partition tiles whose SW/SE faces hide this bay's furniture. */
  wallTiles: InteriorWallTile[];
};

/**
 * Deterministic hospital cubicle bays for a building (same layout as ward gen).
 * Empty when not a hospital or when the open-ward fallback is used.
 */
export function hospitalCubiclesForBuilding(
  bx: number,
  by: number,
): HospitalCubicle[] {
  if (!isHospitalInterior(bx, by)) return [];
  const { iW, iH } = interiorDimensions(bx, by);
  const layout = hospitalWardLayout(iW, iH);
  if (!layout) return [];

  const { depth, inner, pitch, adminNe, adminNw, swCount, seCount } = layout;
  const cubicles: HospitalCubicle[] = [];

  for (let k = 0; k < swCount; k++) {
    const xWest = adminNe + k * pitch;
    const doorX = hospitalCubicleDoorAt(xWest, inner);
    const wallTiles: InteriorWallTile[] = [];
    for (let y = 0; y <= depth; y++) {
      wallTiles.push({ x: xWest, y });
      wallTiles.push({ x: xWest + pitch, y });
    }
    for (let x = xWest + 1; x <= xWest + inner; x++) {
      if (x === doorX) continue;
      wallTiles.push({ x, y: depth });
    }
    cubicles.push({
      facing: "SW",
      x0: xWest + 1,
      y0: 0,
      x1: xWest + inner,
      y1: depth - 1,
      entranceX: doorX,
      entranceY: depth,
      wallTiles,
    });
  }

  for (let k = 0; k < seCount; k++) {
    const yNorth = adminNw + k * pitch;
    const doorY = hospitalCubicleDoorAt(yNorth, inner);
    const wallTiles: InteriorWallTile[] = [];
    for (let x = 0; x <= depth; x++) {
      wallTiles.push({ x, y: yNorth });
      wallTiles.push({ x, y: yNorth + pitch });
    }
    for (let y = yNorth + 1; y <= yNorth + inner; y++) {
      if (y === doorY) continue;
      wallTiles.push({ x: depth, y });
    }
    cubicles.push({
      facing: "SE",
      x0: 0,
      y0: yNorth + 1,
      x1: depth - 1,
      y1: yNorth + inner,
      entranceX: depth,
      entranceY: doorY,
      wallTiles,
    });
  }

  return cubicles;
}

/** Cubicle containing this interior tile (floor or entrance), or null. */
export function hospitalCubicleAtTile(
  bx: number,
  by: number,
  tx: number,
  ty: number,
): HospitalCubicle | null {
  for (const cubicle of hospitalCubiclesForBuilding(bx, by)) {
    if (tx === cubicle.entranceX && ty === cubicle.entranceY) return cubicle;
    if (
      tx >= cubicle.x0 &&
      tx <= cubicle.x1 &&
      ty >= cubicle.y0 &&
      ty <= cubicle.y1
    ) {
      return cubicle;
    }
  }
  return null;
}

/**
 * Open lobby / ward floor south-east of the admin L and cubicle fronts.
 * When the partitioned layout cannot fit, the whole ward counts as lobby.
 */
export function isHospitalLobbyTile(
  bx: number,
  by: number,
  tx: number,
  ty: number,
): boolean {
  if (!isHospitalInterior(bx, by)) return false;
  const { iW, iH } = interiorDimensions(bx, by);
  if (tx < 0 || ty < 0 || tx >= iW || ty >= iH) return false;
  const layout = hospitalWardLayout(iW, iH);
  if (!layout) return true;
  // Front walls sit on x/y = depth; lobby is strictly past them.
  return tx > layout.depth && ty > layout.depth;
}

/**
 * Hospital admin L floor (desk / cabinet wing), excluding lobby and cubicles.
 * False when the partitioned layout cannot fit (open ward has no admin L).
 */
export function isHospitalAdminTile(
  bx: number,
  by: number,
  tx: number,
  ty: number,
): boolean {
  if (!isHospitalInterior(bx, by)) return false;
  const { iW, iH } = interiorDimensions(bx, by);
  if (tx < 0 || ty < 0 || tx >= iW || ty >= iH) return false;
  if (!hospitalWardLayout(iW, iH)) return false;
  if (isHospitalLobbyTile(bx, by, tx, ty)) return false;
  if (hospitalCubicleAtTile(bx, by, tx, ty) != null) return false;
  return true;
}

/** Min Manhattan distance from door tile to any footprint tile. */
const HOSPITAL_RECEPTION_DOOR_CLEARANCE = 4;

/**
 * Origin for MedicalReception1 — as close to the entrance as possible while
 * staying ≥ {@link HOSPITAL_RECEPTION_DOOR_CLEARANCE} tiles away (Manhattan).
 */
function hospitalReceptionOrigin(
  iW: number,
  iH: number,
  exit: InteriorExit,
  w: number,
  h: number,
  minXY = 0,
): { x: number; y: number } | null {
  let rx: number;
  let ry: number;
  if (exit.face === "SE") {
    // East door — sit just west of it, centred on the doorway band.
    rx = exit.insideX - HOSPITAL_RECEPTION_DOOR_CLEARANCE - (w - 1);
    ry = exit.insideY - Math.floor((h - 1) / 2);
  } else {
    // South door — sit just north of it, centred on the doorway band.
    rx = exit.insideX - Math.floor((w - 1) / 2);
    ry = exit.insideY - HOSPITAL_RECEPTION_DOOR_CLEARANCE - (h - 1);
  }
  rx = Math.max(minXY, Math.min(rx, iW - w));
  ry = Math.max(minXY, Math.min(ry, iH - h));
  if (rx < 0 || ry < 0 || rx + w > iW || ry + h > iH) return null;

  const footprintClearance = (x: number, y: number) => {
    let minDist = Infinity;
    for (let ty = y; ty < y + h; ty++) {
      for (let tx = x; tx < x + w; tx++) {
        minDist = Math.min(
          minDist,
          Math.abs(tx - exit.insideX) + Math.abs(ty - exit.insideY),
        );
      }
    }
    return minDist;
  };

  if (footprintClearance(rx, ry) < HOSPITAL_RECEPTION_DOOR_CLEARANCE) {
    // Clamping into the room may have pulled us too close — push away again.
    if (exit.face === "SE") {
      rx = Math.min(rx, exit.insideX - HOSPITAL_RECEPTION_DOOR_CLEARANCE - (w - 1));
      rx = Math.max(minXY, rx);
    } else {
      ry = Math.min(ry, exit.insideY - HOSPITAL_RECEPTION_DOOR_CLEARANCE - (h - 1));
      ry = Math.max(minXY, ry);
    }
    if (
      rx < 0 ||
      ry < 0 ||
      rx + w > iW ||
      ry + h > iH ||
      footprintClearance(rx, ry) < HOSPITAL_RECEPTION_DOOR_CLEARANCE
    ) {
      return null;
    }
  }
  return { x: rx, y: ry };
}

/**
 * Hospital ward — top-down schematic:
 * - True L-shaped admin along the NW (x=0) and NE (y=0) exterior walls,
 *   with entrance at the SE crook into the open corridor
 * - Up to 3 SW-facing cubicles continuing east along the NE wall
 * - Up to 3 SE-facing cubicles continuing south along the NW wall
 * - Shared continuous front walls; cubicle door gaps centered on each bay
 */
function placeHospitalWard(
  bx: number,
  by: number,
  iW: number,
  iH: number,
  exit: InteriorExit,
  rng: () => number,
  occupied: Set<string>,
  startIndex: number,
): {
  furnitures: SearchableObject[];
  walls: InteriorWallTile[];
  doors: { x: number; y: number }[];
} {
  const furnitures: SearchableObject[] = [];
  const walls: InteriorWallTile[] = [];
  const doors: { x: number; y: number }[] = [];
  let furnitureIndex = startIndex;

  const DEPTH = HOSPITAL_CUBICLE_DEPTH;
  const CUBICLE_INNER = HOSPITAL_CUBICLE_INNER;
  const PITCH = HOSPITAL_CUBICLE_PITCH;

  const markOccupied = (x: number, y: number, w: number, h: number) => {
    for (let ty = y; ty < y + h; ty++) {
      for (let tx = x; tx < x + w; tx++) occupied.add(`${tx},${ty}`);
    }
  };
  const canPlaceAt = (x: number, y: number, w: number, h: number) => {
    if (x < 0 || y < 0 || x + w > iW || y + h > iH) return false;
    for (let ty = y; ty < y + h; ty++) {
      for (let tx = x; tx < x + w; tx++) {
        if (tx === exit.insideX && ty === exit.insideY) return false;
        if (occupied.has(`${tx},${ty}`)) return false;
      }
    }
    return true;
  };
  const canPlaceFurniture = (
    type: FurnitureType,
    x: number,
    y: number,
    facing?: FurnitureFacing,
  ) => {
    const { w, h } = furnitureFootprint(type, facing);
    if (!canPlaceAt(x, y, w, h)) return false;
    const approaches = furnitureFrontApproachTiles({
      kind: "furniture",
      objectType: type,
      x,
      y,
      facing,
    });
    if (approaches.length === 0) return false;
    for (const t of approaches) {
      if (t.x < 0 || t.y < 0 || t.x >= iW || t.y >= iH) return false;
      if (t.x === exit.insideX && t.y === exit.insideY) return false;
      if (occupied.has(`${t.x},${t.y}`)) return false;
    }
    return true;
  };
  const reserveApproaches = (
    type: FurnitureType,
    x: number,
    y: number,
    facing?: FurnitureFacing,
  ) => {
    for (const t of furnitureFrontApproachTiles({
      kind: "furniture",
      objectType: type,
      x,
      y,
      facing,
    })) {
      occupied.add(`${t.x},${t.y}`);
    }
  };
  const push = (
    type: FurnitureType,
    x: number,
    y: number,
    facing: FurnitureFacing,
  ) => {
    const { w, h } = furnitureFootprint(type, facing);
    furnitures.push({
      id: interiorSearchableId(bx, by, "furniture", furnitureIndex++),
      kind: "furniture",
      objectType: type,
      x,
      y,
      searched: false,
      buildingX: bx,
      buildingY: by,
      facing,
    });
    markOccupied(x, y, w, h);
    reserveApproaches(type, x, y, facing);
  };
  const addWall = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= iW || y >= iH) return;
    if (x === exit.insideX && y === exit.insideY) return;
    const key = `${x},${y}`;
    if (occupied.has(key)) return;
    occupied.add(key);
    walls.push({ x, y });
  };

  // Keep the doorway and one tile in front clear.
  occupied.add(`${exit.insideX},${exit.insideY}`);
  const clearFrontX =
    exit.face === "SE" ? exit.insideX - 1 : exit.insideX;
  const clearFrontY =
    exit.face === "SW" ? exit.insideY - 1 : exit.insideY;
  if (
    clearFrontX >= 0 &&
    clearFrontY >= 0 &&
    clearFrontX < iW &&
    clearFrontY < iH
  ) {
    occupied.add(`${clearFrontX},${clearFrontY}`);
  }

  const nearExit = (x: number, y: number, w: number, h: number) => {
    for (let ty = y; ty < y + h; ty++) {
      for (let tx = x; tx < x + w; tx++) {
        if (Math.abs(tx - exit.insideX) + Math.abs(ty - exit.insideY) <= 2) {
          return true;
        }
      }
    }
    return false;
  };

  const tryIvBesideHead = (
    bedX: number,
    bedY: number,
    bedFacing: FurnitureFacing,
  ) => {
    if (rng() >= FURNITURE_SPAWN_CHANCE.ivstand) return;
    const { w: bw, h: bh } = furnitureFootprint("hospitalbed", bedFacing);
    const candidates: { x: number; y: number; facing: FurnitureFacing }[] = [];
    if (bedFacing === "SE") {
      for (const y of [bedY - 1, bedY + bh]) {
        for (const facing of HOSPITAL_FURNITURE_FACINGS) {
          if (canPlaceFurniture("ivstand", bedX, y, facing)) {
            candidates.push({ x: bedX, y, facing });
          }
        }
      }
    } else {
      for (const x of [bedX - 1, bedX + bw]) {
        for (const facing of HOSPITAL_FURNITURE_FACINGS) {
          if (canPlaceFurniture("ivstand", x, bedY, facing)) {
            candidates.push({ x, y: bedY, facing });
          }
        }
      }
    }
    if (candidates.length === 0) return;
    const pick = candidates[Math.floor(rng() * candidates.length)]!;
    push("ivstand", pick.x, pick.y, pick.facing);
  };

  const tryCartNearBed = (
    bedX: number,
    bedY: number,
    bedFacing: FurnitureFacing,
  ) => {
    if (rng() >= FURNITURE_SPAWN_CHANCE.medicalcart) return;
    const { w: bw, h: bh } = furnitureFootprint("hospitalbed", bedFacing);
    // SW cubicle bed → SE cart 2 tiles past the foot; SE bed → SW cart.
    if (bedFacing === "SW") {
      const cartX = bedX;
      const cartY = bedY + bh - 1 + 2; // foot tile + 2 south
      if (canPlaceFurniture("medicalcart", cartX, cartY, "SE")) {
        push("medicalcart", cartX, cartY, "SE");
      }
      return;
    }
    const cartX = bedX + bw - 1 + 2; // foot tile + 2 east
    const cartY = bedY;
    if (canPlaceFurniture("medicalcart", cartX, cartY, "SW")) {
      push("medicalcart", cartX, cartY, "SW");
    }
  };

  // 1-tile open gap between the outer cubicle wall and the SE / SW interior edges.
  const layout = hospitalWardLayout(iW, iH);

  if (layout) {
    const {
      adminNe,
      adminNw,
      swCount,
      seCount,
      maxNeEnd,
      maxNwEnd,
    } = layout;

    // Center door in each cubicle bay (open tiles xWest+1 .. xWest+CUBICLE_INNER).
    const cubicleDoorAt = (bayStart: number) =>
      hospitalCubicleDoorAt(bayStart, CUBICLE_INNER);

    const swDoorXs = new Set<number>();
    for (let k = 0; k < swCount; k++) {
      swDoorXs.add(cubicleDoorAt(adminNe + k * PITCH));
    }
    const seDoorYs = new Set<number>();
    for (let k = 0; k < seCount; k++) {
      seDoorYs.add(cubicleDoorAt(adminNw + k * PITCH));
    }

    const hWallEnd = adminNe + swCount * PITCH;
    const vWallEnd = adminNw + seCount * PITCH;

    // Shared south front at y=DEPTH: south of admin's NE arm, then N cubicles.
    // Leave DEPTH and DEPTH+1 open for the L crook entrance from the corridor.
    for (let x = DEPTH + 2; x <= hWallEnd && x <= maxNeEnd; x++) {
      if (swDoorXs.has(x)) continue;
      addWall(x, DEPTH);
    }
    // Shared east front at x=DEPTH: east of admin's NW arm, then W cubicles.
    for (let y = DEPTH + 2; y <= vWallEnd && y <= maxNwEnd; y++) {
      if (seDoorYs.has(y)) continue;
      addWall(DEPTH, y);
    }

    // Divider between admin NE arm and first N cubicle (+ further cubicle dividers).
    for (let k = 0; k <= swCount; k++) {
      const xDiv = adminNe + k * PITCH;
      if (xDiv > maxNeEnd) break;
      for (let y = 0; y < DEPTH; y++) addWall(xDiv, y);
      addWall(xDiv, DEPTH);
    }
    // Divider between admin NW arm and first W cubicle (+ further cubicle dividers).
    for (let k = 0; k <= seCount; k++) {
      const yDiv = adminNw + k * PITCH;
      if (yDiv > maxNwEnd) break;
      for (let x = 0; x < DEPTH; x++) addWall(x, yDiv);
      addWall(DEPTH, yDiv);
    }

    // Materialize cubicle entrance gaps as real doors (same path as house/motel).
    for (const cubicle of hospitalCubiclesForBuilding(bx, by)) {
      doors.push({ x: cubicle.entranceX, y: cubicle.entranceY });
      occupied.add(`${cubicle.entranceX},${cubicle.entranceY}`);
      const inside = roomDoorFrontTiles(cubicle).inside;
      if (
        inside.x >= cubicle.x0 &&
        inside.x <= cubicle.x1 &&
        inside.y >= cubicle.y0 &&
        inside.y <= cubicle.y1
      ) {
        occupied.add(`${inside.x},${inside.y}`);
      }
    }

    // Admin furniture along both exterior walls of the L.
    {
      const deskX = Math.min(2, adminNe - 2);
      if (
        deskX >= 1 &&
        !nearExit(deskX, 0, 1, 1) &&
        canPlaceFurniture("desk", deskX, 0, "SW")
      ) {
        push("desk", deskX, 0, "SW");
      }
      // Cabinet1 — always flush on the NE wall (y = 0), facing SW.
      let cabX = -1;
      for (const x of [
        deskX + 2,
        deskX + 3,
        Math.min(3, adminNe - 2),
        1,
      ]) {
        if (x < 1 || x === deskX || x > adminNe - 2) continue;
        if (nearExit(x, 0, 1, 1)) continue;
        if (!canPlaceFurniture("cabinet", x, 0, "SW")) continue;
        cabX = x;
        push("cabinet", x, 0, "SW");
        break;
      }
      // MedicalDrawers1 — SW on the NE wall, SE on the NW wall of the admin L.
      const drawersNeCandidates = [
        cabX >= 0 ? cabX + 2 : deskX + 2,
        deskX + 2,
        Math.min(4, adminNe - 2),
      ];
      for (const drawersNeX of drawersNeCandidates) {
        if (
          drawersNeX < 1 ||
          drawersNeX === deskX ||
          drawersNeX === cabX ||
          drawersNeX > adminNe - 2
        ) {
          continue;
        }
        if (nearExit(drawersNeX, 0, 1, 1)) continue;
        if (!canPlaceFurniture("medicaldrawers", drawersNeX, 0, "SW")) continue;
        push("medicaldrawers", drawersNeX, 0, "SW");
        break;
      }
      const drawersNwY = Math.min(2, adminNw - 2);
      if (
        drawersNwY >= 1 &&
        !nearExit(0, drawersNwY, 1, 1) &&
        canPlaceFurniture("medicaldrawers", 0, drawersNwY, "SE")
      ) {
        push("medicaldrawers", 0, drawersNwY, "SE");
      }
    }

    // Lobby reception desk — near the entrance, ≥4 tiles clear of the door.
    {
      const facing: FurnitureFacing = "SW";
      const { w, h } = furnitureFootprint("medicalreception", facing);
      const origin = hospitalReceptionOrigin(
        iW,
        iH,
        exit,
        w,
        h,
        DEPTH + 1,
      );
      if (
        origin &&
        canPlaceFurniture("medicalreception", origin.x, origin.y, facing)
      ) {
        push("medicalreception", origin.x, origin.y, facing);
        // Two SE waiting benches: front row, then 1 tile NW (behind) for a second row.
        const { w: bw, h: bh } = furnitureFootprint("threeseater", "SE");
        const benchX = origin.x + Math.floor((w - bw) / 2);
        const benchY = origin.y + h + 2;
        const frontType = pickThreeSeaterVariant(rng);
        if (
          benchX >= 0 &&
          benchY >= 0 &&
          benchX + bw <= iW &&
          benchY + bh <= iH &&
          !nearExit(benchX, benchY, bw, bh) &&
          canPlaceFurniture(frontType, benchX, benchY, "SE")
        ) {
          push(frontType, benchX, benchY, "SE");
          const backType = pickThreeSeaterVariant(rng);
          const backX = benchX - bw - 1;
          const backY = benchY;
          if (
            backX >= 0 &&
            backY >= 0 &&
            backX + bw <= iW &&
            backY + bh <= iH &&
            !nearExit(backX, backY, bw, bh) &&
            canPlaceFurniture(backType, backX, backY, "SE")
          ) {
            push(backType, backX, backY, "SE");
          }
          // VendingMachine1 — SE, 1 tile beyond the SW end of the front bench.
          {
            const vFacing: FurnitureFacing = "SE";
            const { w: vw, h: vh } = furnitureFootprint(
              "vendingmachine",
              vFacing,
            );
            const vx = benchX;
            const vy = benchY + bh + 1;
            if (
              vx >= 0 &&
              vy >= 0 &&
              vx + vw <= iW &&
              vy + vh <= iH &&
              !nearExit(vx, vy, vw, vh) &&
              canPlaceFurniture("vendingmachine", vx, vy, vFacing)
            ) {
              push("vendingmachine", vx, vy, vFacing);
            }
          }
        }
      }
    }

    // SW-facing cubicles along the NE wall, east of the admin NE arm.
    for (let k = 0; k < swCount; k++) {
      const xWest = adminNe + k * PITCH;
      const bedX = xWest + 1;
      const facing: FurnitureFacing = "SW";
      if (nearExit(bedX, 0, 1, 2)) continue;
      if (!canPlaceFurniture("hospitalbed", bedX, 0, facing)) continue;
      push("hospitalbed", bedX, 0, facing);
      tryIvBesideHead(bedX, 0, facing);
      tryCartNearBed(bedX, 0, facing);
    }

    // SE-facing cubicles along the NW wall, south of the admin NW arm.
    for (let k = 0; k < seCount; k++) {
      const yNorth = adminNw + k * PITCH;
      const bedY = yNorth + 1;
      const facing: FurnitureFacing = "SE";
      if (nearExit(0, bedY, 2, 1)) continue;
      if (!canPlaceFurniture("hospitalbed", 0, bedY, facing)) continue;
      push("hospitalbed", 0, bedY, facing);
      tryIvBesideHead(0, bedY, facing);
      tryCartNearBed(0, bedY, facing);
    }
  }

  // Fallback: open ward (no walls) if the L-layout placed nothing.
  if (furnitures.length === 0) {
    {
      const facing: FurnitureFacing = "SW";
      const { w, h } = furnitureFootprint("medicalreception", facing);
      const origin = hospitalReceptionOrigin(iW, iH, exit, w, h);
      if (
        origin &&
        canPlaceFurniture("medicalreception", origin.x, origin.y, facing)
      ) {
        push("medicalreception", origin.x, origin.y, facing);
        const { w: bw, h: bh } = furnitureFootprint("threeseater", "SE");
        const benchX = origin.x + Math.floor((w - bw) / 2);
        const benchY = origin.y + h + 2;
        const frontType = pickThreeSeaterVariant(rng);
        if (
          benchX >= 0 &&
          benchY >= 0 &&
          benchX + bw <= iW &&
          benchY + bh <= iH &&
          !nearExit(benchX, benchY, bw, bh) &&
          canPlaceFurniture(frontType, benchX, benchY, "SE")
        ) {
          push(frontType, benchX, benchY, "SE");
          const backType = pickThreeSeaterVariant(rng);
          const backX = benchX - bw - 1;
          const backY = benchY;
          if (
            backX >= 0 &&
            backY >= 0 &&
            backX + bw <= iW &&
            backY + bh <= iH &&
            !nearExit(backX, backY, bw, bh) &&
            canPlaceFurniture(backType, backX, backY, "SE")
          ) {
            push(backType, backX, backY, "SE");
          }
          {
            const vFacing: FurnitureFacing = "SE";
            const { w: vw, h: vh } = furnitureFootprint(
              "vendingmachine",
              vFacing,
            );
            const vx = benchX;
            const vy = benchY + bh + 1;
            if (
              vx >= 0 &&
              vy >= 0 &&
              vx + vw <= iW &&
              vy + vh <= iH &&
              !nearExit(vx, vy, vw, vh) &&
              canPlaceFurniture("vendingmachine", vx, vy, vFacing)
            ) {
              push("vendingmachine", vx, vy, vFacing);
            }
          }
        }
      }
    }
    {
      const facing: FurnitureFacing = "SE";
      const { w, h } = furnitureFootprint("hospitalbed", facing);
      const stride = h + 2;
      for (let y = 1; y + h <= iH - 1; y += stride) {
        const x = 0;
        if (nearExit(x, y, w, h)) continue;
        if (!canPlaceFurniture("hospitalbed", x, y, facing)) continue;
        push("hospitalbed", x, y, facing);
        tryIvBesideHead(x, y, facing);
        tryCartNearBed(x, y, facing);
      }
    }
    {
      const facing: FurnitureFacing = "SW";
      const { w, h } = furnitureFootprint("hospitalbed", facing);
      const stride = w + 2;
      const minX = 3;
      for (let x = minX; x + w <= iW - 1; x += stride) {
        const y = 0;
        if (nearExit(x, y, w, h)) continue;
        if (!canPlaceFurniture("hospitalbed", x, y, facing)) continue;
        push("hospitalbed", x, y, facing);
        tryIvBesideHead(x, y, facing);
        tryCartNearBed(x, y, facing);
      }
    }
  }

  // Birchport: two random ward beds become occupied soldier beds (Idle only).
  // Use Math.random (not the layout seed) so the pair differs each server restart.
  if (isBirchportHospital(bx, by)) {
    ensureBirchportOccupiedHospitalBeds(furnitures);
  }

  return { furnitures, walls, doors };
}

/**
 * Ensure Birchport has one HospitalBed2 and one HospitalBed3 (occupied soldier
 * beds). Converts random HospitalBed1 pieces (non-deterministic by default so
 * restarts pick a new pair). Idempotent if both already exist.
 * Non-searchable; client keeps Idle forever.
 * @returns true when any bed type was changed.
 */
export function ensureBirchportOccupiedHospitalBeds(
  furnitures: SearchableObject[],
  rng: () => number = Math.random,
): boolean {
  const need: ("hospitalbed2" | "hospitalbed3")[] = [];
  if (!furnitures.some((f) => f.objectType === "hospitalbed2")) {
    need.push("hospitalbed2");
  }
  if (!furnitures.some((f) => f.objectType === "hospitalbed3")) {
    need.push("hospitalbed3");
  }
  if (need.length === 0) return false;

  const beds = furnitures.filter((f) => f.objectType === "hospitalbed");
  if (beds.length === 0) return false;
  for (let i = beds.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = beds[i]!;
    beds[i] = beds[j]!;
    beds[j] = tmp;
  }
  const n = Math.min(need.length, beds.length);
  for (let i = 0; i < n; i++) {
    beds[i]!.objectType = need[i]!;
  }
  return n > 0;
}


// ─── Motel strip (lobby + corridor + room bays) ─────────────────────────────

/** Cubicle depth from exterior wall to corridor front wall (includes front wall tile). */
const MOTEL_ROOM_DEPTH = 4;
/** Open tiles between shared room dividers. */
const MOTEL_ROOM_INNER = 3;
const MOTEL_ROOM_PITCH = MOTEL_ROOM_INNER + 1;
/** Open lobby length along the corridor axis, centred on the entrance. */
const MOTEL_LOBBY_LEN = 5;
const MOTEL_MAX_ROOMS = 5;
/** Minimum walkable corridor tiles between room front wall and exterior door wall. */
const MOTEL_CORRIDOR_MIN = 2;

/** One motel room bay — floor bounds, entrance gap, and shell partitions. */
export type MotelRoom = {
  /** Facing from room into the corridor (door opens this way). */
  facing: "SW" | "SE";
  /** Inclusive walkable floor bounds inside the bay. */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Door gap on the shared front wall (walkable entrance tile). */
  entranceX: number;
  entranceY: number;
  wallTiles: InteriorWallTile[];
};

type MotelStripLayout = {
  face: "SE" | "SW";
  depth: number;
  inner: number;
  pitch: number;
  lobbyStart: number;
  lobbyEnd: number;
  /** Bay start coordinates along the long axis (divider at bayStart, bayStart+pitch). */
  bayStarts: number[];
  longMax: number;
  shortMax: number;
};

function motelDoorAt(bayStart: number, inner: number): number {
  return bayStart + Math.ceil(inner / 2);
}

/**
 * Lobby centred on the doorway along the long axis; room bays fill the
 * remaining strip on the inward (lot) side of a corridor.
 * Returns null when the footprint is too small for corridor + one room.
 */
function motelStripLayout(
  iW: number,
  iH: number,
  exit: InteriorExit,
): MotelStripLayout | null {
  const depth = MOTEL_ROOM_DEPTH;
  const inner = MOTEL_ROOM_INNER;
  const pitch = MOTEL_ROOM_PITCH;

  if (exit.face === "SE") {
    // Door on east wall — long axis = Y, rooms against west (x = 0).
    const shortMax = iW - 1;
    const longMax = iH - 1;
    if (iW < depth + 1 + MOTEL_CORRIDOR_MIN) return null;
    if (iH < MOTEL_LOBBY_LEN + pitch) return null;

    let lobbyStart = Math.max(
      0,
      exit.insideY - Math.floor(MOTEL_LOBBY_LEN / 2),
    );
    let lobbyEnd = Math.min(longMax, lobbyStart + MOTEL_LOBBY_LEN - 1);
    lobbyStart = Math.max(0, lobbyEnd - MOTEL_LOBBY_LEN + 1);
    // Keep the doorway inside the lobby band.
    if (exit.insideY < lobbyStart) {
      lobbyStart = exit.insideY;
      lobbyEnd = Math.min(longMax, lobbyStart + MOTEL_LOBBY_LEN - 1);
    } else if (exit.insideY > lobbyEnd) {
      lobbyEnd = exit.insideY;
      lobbyStart = Math.max(0, lobbyEnd - MOTEL_LOBBY_LEN + 1);
    }

    const bayStarts: number[] = [];
    // Pack rooms north of lobby (toward y = 0).
    for (
      let edge = lobbyStart;
      edge >= pitch && bayStarts.length < MOTEL_MAX_ROOMS;
      edge -= pitch
    ) {
      bayStarts.push(edge - pitch);
    }
    // Pack rooms south of lobby (toward y = longMax).
    for (
      let edge = lobbyEnd + 1;
      edge + pitch - 1 <= longMax && bayStarts.length < MOTEL_MAX_ROOMS;
      edge += pitch
    ) {
      bayStarts.push(edge);
    }
    bayStarts.sort((a, b) => a - b);
    if (bayStarts.length < 1) return null;

    return {
      face: "SE",
      depth,
      inner,
      pitch,
      lobbyStart,
      lobbyEnd,
      bayStarts,
      longMax,
      shortMax,
    };
  }

  // Door on south wall — long axis = X, rooms against north (y = 0).
  const shortMax = iH - 1;
  const longMax = iW - 1;
  if (iH < depth + 1 + MOTEL_CORRIDOR_MIN) return null;
  if (iW < MOTEL_LOBBY_LEN + pitch) return null;

  let lobbyStart = Math.max(
    0,
    exit.insideX - Math.floor(MOTEL_LOBBY_LEN / 2),
  );
  let lobbyEnd = Math.min(longMax, lobbyStart + MOTEL_LOBBY_LEN - 1);
  lobbyStart = Math.max(0, lobbyEnd - MOTEL_LOBBY_LEN + 1);
  if (exit.insideX < lobbyStart) {
    lobbyStart = exit.insideX;
    lobbyEnd = Math.min(longMax, lobbyStart + MOTEL_LOBBY_LEN - 1);
  } else if (exit.insideX > lobbyEnd) {
    lobbyEnd = exit.insideX;
    lobbyStart = Math.max(0, lobbyEnd - MOTEL_LOBBY_LEN + 1);
  }

  const bayStarts: number[] = [];
  for (
    let edge = lobbyStart;
    edge >= pitch && bayStarts.length < MOTEL_MAX_ROOMS;
    edge -= pitch
  ) {
    bayStarts.push(edge - pitch);
  }
  for (
    let edge = lobbyEnd + 1;
    edge + pitch - 1 <= longMax && bayStarts.length < MOTEL_MAX_ROOMS;
    edge += pitch
  ) {
    bayStarts.push(edge);
  }
  bayStarts.sort((a, b) => a - b);
  if (bayStarts.length < 1) return null;

  return {
    face: "SW",
    depth,
    inner,
    pitch,
    lobbyStart,
    lobbyEnd,
    bayStarts,
    longMax,
    shortMax,
  };
}

function motelWallsFromLayout(layout: MotelStripLayout): InteriorWallTile[] {
  const { face, depth, inner, pitch, bayStarts, longMax } = layout;
  const wallSet = new Set<string>();
  const add = (x: number, y: number) => wallSet.add(`${x},${y}`);

  if (face === "SE") {
    // Rooms on the west (low x); front wall at x=depth with door gaps on Y.
    const doorYs = new Set(bayStarts.map((b) => motelDoorAt(b, inner)));
    for (const bayStart of bayStarts) {
      for (let y = bayStart; y <= bayStart + pitch; y++) {
        if (y > longMax) break;
        if (y === bayStart || y === bayStart + pitch) {
          for (let x = 0; x <= depth; x++) add(x, y);
          continue;
        }
        if (doorYs.has(y)) continue;
        add(depth, y);
      }
    }
  } else {
    // Rooms on the north (low y); front wall at y=depth with door gaps on X.
    const doorXs = new Set(bayStarts.map((b) => motelDoorAt(b, inner)));
    for (const bayStart of bayStarts) {
      for (let x = bayStart; x <= bayStart + pitch; x++) {
        if (x > longMax) break;
        if (x === bayStart || x === bayStart + pitch) {
          for (let y = 0; y <= depth; y++) add(x, y);
          continue;
        }
        if (doorXs.has(x)) continue;
        add(x, depth);
      }
    }
  }

  const walls: InteriorWallTile[] = [];
  for (const key of wallSet) {
    const [xs, ys] = key.split(",");
    walls.push({ x: Number(xs), y: Number(ys) });
  }
  return walls;
}

/**
 * Deterministic motel room bays for a building (same layout as shell gen).
 * Empty when not a motel or when the footprint cannot fit corridor + rooms.
 */
export function motelRoomsForBuilding(bx: number, by: number): MotelRoom[] {
  if (!isMotelInterior(bx, by)) return [];
  const { iW, iH } = interiorDimensions(bx, by);
  const exit = interiorExitForBuildingAt(bx, by);
  const layout = motelStripLayout(iW, iH, exit);
  if (!layout) return [];

  const { face, depth, inner, pitch, bayStarts } = layout;
  const rooms: MotelRoom[] = [];

  if (face === "SE") {
    for (const bayStart of bayStarts) {
      const doorY = motelDoorAt(bayStart, inner);
      const wallTiles: InteriorWallTile[] = [];
      for (let y = bayStart; y <= bayStart + pitch; y++) {
        if (y === bayStart || y === bayStart + pitch) {
          for (let x = 0; x <= depth; x++) wallTiles.push({ x, y });
        } else if (y !== doorY) {
          wallTiles.push({ x: depth, y });
        }
      }
      rooms.push({
        facing: "SE",
        x0: 0,
        y0: bayStart + 1,
        x1: depth - 1,
        y1: bayStart + inner,
        entranceX: depth,
        entranceY: doorY,
        wallTiles,
      });
    }
  } else {
    for (const bayStart of bayStarts) {
      const doorX = motelDoorAt(bayStart, inner);
      const wallTiles: InteriorWallTile[] = [];
      for (let x = bayStart; x <= bayStart + pitch; x++) {
        if (x === bayStart || x === bayStart + pitch) {
          for (let y = 0; y <= depth; y++) wallTiles.push({ x, y });
        } else if (x !== doorX) {
          wallTiles.push({ x, y: depth });
        }
      }
      rooms.push({
        facing: "SW",
        x0: bayStart + 1,
        y0: 0,
        x1: bayStart + inner,
        y1: depth - 1,
        entranceX: doorX,
        entranceY: depth,
        wallTiles,
      });
    }
  }

  return rooms;
}

/** Cubicle containing this motel room tile (floor or entrance), or null. */
export function motelRoomAtTile(
  bx: number,
  by: number,
  tx: number,
  ty: number,
): MotelRoom | null {
  for (const room of motelRoomsForBuilding(bx, by)) {
    if (tx === room.entranceX && ty === room.entranceY) return room;
    if (
      tx >= room.x0 &&
      tx <= room.x1 &&
      ty >= room.y0 &&
      ty <= room.y1
    ) {
      return room;
    }
  }
  return null;
}

/**
 * Motel shell — lobby Counter1, corridor + room bays with MotelBed1,
 * optional MiniFridge1 / Suitcase1, and openable doors on each room entrance.
 */
function placeMotelShell(
  bx: number,
  by: number,
  iW: number,
  iH: number,
  exit: InteriorExit,
  rng: () => number,
  occupied: Set<string>,
  startIndex: number,
): {
  furnitures: SearchableObject[];
  walls: InteriorWallTile[];
  doors: { x: number; y: number }[];
} {
  const layout = motelStripLayout(iW, iH, exit);
  if (!layout) return { furnitures: [], walls: [], doors: [] };

  const walls = motelWallsFromLayout(layout);
  for (const w of walls) occupied.add(`${w.x},${w.y}`);

  // Materialize room entrance gaps as real doors (same path as house rooms).
  const rooms = motelRoomsForBuilding(bx, by);
  const doors: { x: number; y: number }[] = [];
  for (const room of rooms) {
    doors.push({ x: room.entranceX, y: room.entranceY });
    occupied.add(`${room.entranceX},${room.entranceY}`);
    const inside = roomDoorFrontTiles(room).inside;
    if (
      inside.x >= room.x0 &&
      inside.x <= room.x1 &&
      inside.y >= room.y0 &&
      inside.y <= room.y1
    ) {
      occupied.add(`${inside.x},${inside.y}`);
    }
  }

  const furnitures: SearchableObject[] = [];
  let furnitureIndex = startIndex;

  const markOccupied = (x: number, y: number, w: number, h: number) => {
    for (let ty = y; ty < y + h; ty++) {
      for (let tx = x; tx < x + w; tx++) occupied.add(`${tx},${ty}`);
    }
  };
  const canPlaceAt = (x: number, y: number, w: number, h: number) => {
    if (x < 0 || y < 0 || x + w > iW || y + h > iH) return false;
    for (let ty = y; ty < y + h; ty++) {
      for (let tx = x; tx < x + w; tx++) {
        if (tx === exit.insideX && ty === exit.insideY) return false;
        if (occupied.has(`${tx},${ty}`)) return false;
      }
    }
    return true;
  };
  const canPlaceFurniture = (
    type: FurnitureType,
    x: number,
    y: number,
    facing?: FurnitureFacing,
  ) => {
    const { w, h } = furnitureFootprint(type, facing);
    if (!canPlaceAt(x, y, w, h)) return false;
    const approaches = furnitureFrontApproachTiles({
      kind: "furniture",
      objectType: type,
      x,
      y,
      facing,
    });
    if (approaches.length === 0) return false;
    for (const t of approaches) {
      if (t.x < 0 || t.y < 0 || t.x >= iW || t.y >= iH) return false;
      if (t.x === exit.insideX && t.y === exit.insideY) return false;
      if (occupied.has(`${t.x},${t.y}`)) return false;
    }
    return true;
  };
  const reserveApproaches = (
    type: FurnitureType,
    x: number,
    y: number,
    facing?: FurnitureFacing,
  ) => {
    for (const t of furnitureFrontApproachTiles({
      kind: "furniture",
      objectType: type,
      x,
      y,
      facing,
    })) {
      occupied.add(`${t.x},${t.y}`);
    }
  };
  const push = (
    type: FurnitureType,
    x: number,
    y: number,
    facing: FurnitureFacing,
  ) => {
    const { w, h } = furnitureFootprint(type, facing);
    furnitures.push({
      id: interiorSearchableId(bx, by, "furniture", furnitureIndex++),
      kind: "furniture",
      objectType: type,
      x,
      y,
      searched: false,
      buildingX: bx,
      buildingY: by,
      facing,
    });
    markOccupied(x, y, w, h);
    reserveApproaches(type, x, y, facing);
  };

  // Keep the doorway and one tile in front clear.
  occupied.add(`${exit.insideX},${exit.insideY}`);
  const clearFrontX =
    exit.face === "SE" ? exit.insideX - 1 : exit.insideX;
  const clearFrontY =
    exit.face === "SW" ? exit.insideY - 1 : exit.insideY;
  if (
    clearFrontX >= 0 &&
    clearFrontY >= 0 &&
    clearFrontX < iW &&
    clearFrontY < iH
  ) {
    occupied.add(`${clearFrontX},${clearFrontY}`);
  }

  // Lobby Counter1 — flush with the room front-wall line across the lobby
  // opening (same depth as the corridor-facing room walls), facing the door.
  {
    const facing: FurnitureFacing = layout.face;
    const { w, h } = furnitureFootprint("counter", facing);
    // Room front walls sit at `depth`; place the desk on that same line.
    const wallLine = layout.depth;
    type CounterCand = { x: number; y: number; score: number };
    const candidates: CounterCand[] = [];

    const consider = (x: number, y: number) => {
      if (!canPlaceFurniture("counter", x, y, facing)) return;
      const midX = x + Math.floor((w - 1) / 2);
      const midY = y + Math.floor((h - 1) / 2);
      // Prefer centred on the doorway along the lobby band.
      const alongDist =
        layout.face === "SE"
          ? Math.abs(midY - exit.insideY)
          : Math.abs(midX - exit.insideX);
      const depthDist =
        layout.face === "SE" ? Math.abs(x - wallLine) : Math.abs(y - wallLine);
      candidates.push({ x, y, score: depthDist * 100 + alongDist });
    };

    if (layout.face === "SE") {
      // Prefer x = wallLine, then nearby depths; scan lobby Y.
      for (let y = layout.lobbyStart; y <= layout.lobbyEnd - (h - 1); y++) {
        consider(wallLine, y);
        for (const dx of [-1, 1, -2, 2]) consider(wallLine + dx, y);
      }
    } else {
      for (let x = layout.lobbyStart; x <= layout.lobbyEnd - (w - 1); x++) {
        consider(x, wallLine);
        for (const dy of [-1, 1, -2, 2]) consider(x, wallLine + dy);
      }
    }

    if (candidates.length > 0) {
      candidates.sort((a, b) => a.score - b.score || a.x - b.x || a.y - b.y);
      const pick = candidates[0]!;
      push("counter", pick.x, pick.y, facing);
    }
  }

  // Cabinet1 — 1–3 on the lobby back wall, behind the counter.
  {
    const want = 1 + Math.floor(rng() * 3);
    const facing: FurnitureFacing = layout.face;
    const slots: number[] = [];
    if (layout.face === "SE") {
      // West exterior wall (x = 0), facing SE into the lobby.
      for (let y = layout.lobbyStart; y <= layout.lobbyEnd; y++) {
        if (canPlaceFurniture("cabinet", 0, y, facing)) slots.push(y);
      }
    } else {
      // North exterior wall (y = 0), facing SW into the lobby.
      for (let x = layout.lobbyStart; x <= layout.lobbyEnd; x++) {
        if (canPlaceFurniture("cabinet", x, 0, facing)) slots.push(x);
      }
    }

    if (slots.length > 0) {
      const n = Math.min(want, slots.length);
      const chosen: number[] = [];
      for (let i = 0; i < n; i++) {
        const idx = Math.round(((i + 0.5) * slots.length) / n - 0.5);
        const s = slots[Math.max(0, Math.min(slots.length - 1, idx))]!;
        if (!chosen.includes(s)) chosen.push(s);
      }
      // Fill any duplicates from rounding with the nearest unused slots.
      for (const s of slots) {
        if (chosen.length >= n) break;
        if (!chosen.includes(s)) chosen.push(s);
      }
      chosen.sort((a, b) => a - b);
      for (const along of chosen) {
        if (layout.face === "SE") {
          if (canPlaceFurniture("cabinet", 0, along, facing)) {
            push("cabinet", 0, along, facing);
          }
        } else if (canPlaceFurniture("cabinet", along, 0, facing)) {
          push("cabinet", along, 0, facing);
        }
      }
    }
  }

  // One MotelBed1 per room (against the exterior wall, facing the corridor),
  // plus optional MiniFridge1 (75%) and Suitcase1 (25%) on the room floor.
  for (const room of rooms) {
    const bedFacing: FurnitureFacing = room.facing;
    const { w: bw, h: bh } = furnitureFootprint("motelbed", bedFacing);
    let bedX: number;
    let bedY: number;
    if (bedFacing === "SE") {
      bedX = room.x0;
      bedY = room.y0 + Math.floor((room.y1 - room.y0 + 1 - bh) / 2);
    } else {
      bedX = room.x0 + Math.floor((room.x1 - room.x0 + 1 - bw) / 2);
      bedY = room.y0;
    }
    if (canPlaceFurniture("motelbed", bedX, bedY, bedFacing)) {
      push("motelbed", bedX, bedY, bedFacing);
    }

    if (rng() < FURNITURE_SPAWN_CHANCE.minifridge) {
      const fridgeCandidates: {
        x: number;
        y: number;
        facing: FurnitureFacing;
      }[] = [];
      // Prefer corners near the room entrance (corridor-side wall).
      const preferred: { x: number; y: number }[] = [];
      if (bedFacing === "SE") {
        preferred.push(
          { x: room.x1, y: room.y0 },
          { x: room.x1, y: room.y1 },
          { x: room.x0, y: room.y0 },
          { x: room.x0, y: room.y1 },
        );
      } else {
        preferred.push(
          { x: room.x0, y: room.y1 },
          { x: room.x1, y: room.y1 },
          { x: room.x0, y: room.y0 },
          { x: room.x1, y: room.y0 },
        );
      }
      for (const tile of preferred) {
        for (const facing of MOTEL_FURNITURE_FACINGS) {
          if (canPlaceFurniture("minifridge", tile.x, tile.y, facing)) {
            fridgeCandidates.push({ x: tile.x, y: tile.y, facing });
          }
        }
      }
      if (fridgeCandidates.length === 0) {
        for (let ty = room.y0; ty <= room.y1; ty++) {
          for (let tx = room.x0; tx <= room.x1; tx++) {
            for (const facing of MOTEL_FURNITURE_FACINGS) {
              if (canPlaceFurniture("minifridge", tx, ty, facing)) {
                fridgeCandidates.push({ x: tx, y: ty, facing });
              }
            }
          }
        }
      }
      if (fridgeCandidates.length > 0) {
        const pick =
          fridgeCandidates[Math.floor(rng() * fridgeCandidates.length)]!;
        push("minifridge", pick.x, pick.y, pick.facing);
      }
    }

    if (rng() < MOTEL_SUITCASE_CHANCE) {
      const suitcaseCandidates: {
        x: number;
        y: number;
        facing: FurnitureFacing;
      }[] = [];
      for (let ty = room.y0; ty <= room.y1; ty++) {
        for (let tx = room.x0; tx <= room.x1; tx++) {
          for (const facing of MOTEL_FURNITURE_FACINGS) {
            if (canPlaceFurniture("suitcase", tx, ty, facing)) {
              suitcaseCandidates.push({ x: tx, y: ty, facing });
            }
          }
        }
      }
      if (suitcaseCandidates.length > 0) {
        const pick =
          suitcaseCandidates[Math.floor(rng() * suitcaseCandidates.length)]!;
        push("suitcase", pick.x, pick.y, pick.facing);
      }
    }
  }

  return { furnitures, walls, doors };
}

// ─── House rooms (bedroom / kitchen / office / living room) ────────────────
//
// Town/city houses (marked `houseRooms` in worldgen, a generation-context
// flag, NOT a size check, since urban footprints (4x4-6x6) now overlap the
// rural cabin range) are usually partitioned into rooms. SE bays line the
// west exterior wall (x = 0), SW bays line the north exterior wall (y = 0).
// The first west-wall bay starts on the corner, so that tile is floor
// instead of a leading wall. A kitchen and a living room that meet at that
// corner keep the wall between them. A few houses are vacant shells: no
// rooms, suitcases still roll.
// Rural cabins never set the `houseRooms` flag and keep the flat single-room
// `placeGenericFurniture` layout regardless of size.

/** Depth of each room bay (exterior wall to front partition wall). */
const HOUSE_ROOM_DEPTH = 3;
/**
 * About 3% of town/city houses are empty shells. Rolled from the interior
 * seed so the client room list matches the server.
 */
const HOUSE_VACANT_CHANCE = 0.03;
/**
 * Along-wall floor tiles. Depth stays HOUSE_ROOM_DEPTH: furniture sits on
 * the exterior wall, its front approach is the next row, and the door stand
 * is the inner row.
 * Bedroom min fits one bed (1 tile along, 2 deep) plus a second row so the
 * door is not standing on the bed. Kitchen min fits a sink (2 along) with a
 * fridge beside it. Living room min fits a mantel (2 along). Office min fits
 * a desk and a bookshelf side by side.
 */
const HOUSE_BEDROOM_ALONG_MIN = 2;
const HOUSE_BEDROOM_ALONG_MAX = 4;
const HOUSE_KITCHEN_ALONG_MIN = 3;
const HOUSE_KITCHEN_ALONG_MAX = 5;
const HOUSE_LIVING_ALONG_MIN = 2;
const HOUSE_LIVING_ALONG_MAX = 4;
const HOUSE_OFFICE_ALONG_MIN = 2;
const HOUSE_OFFICE_ALONG_MAX = 4;
/** 1-tile open gap between the outermost room wall and the far interior edge. */
const HOUSE_EDGE_GAP = 1;
/**
 * Free tiles between a room's outer partition and the house door edge.
 * Wall at `doorEdge - clearance`, hallway at `doorEdge - 1`, door at `doorEdge`.
 * Prevents bays from sitting on the entrance row (which used to punch holes in
 * walls so the overworld door stayed walkable).
 */
const HOUSE_ENTRANCE_CLEARANCE = 2;
/** Hard cap on room bays generated per exterior wall line. */
const HOUSE_MAX_BAYS_PER_LINE = 3;

export type HouseRoomRole = "bedroom" | "kitchen" | "office" | "livingroom";

/**
 * One partitioned house room. `facing` mirrors the hospital/motel convention:
 * "SE" rooms sit against the west wall (x fixed at `x0`, along-wall axis is Y);
 * "SW" rooms sit against the north wall (y fixed at `y0`, along-wall axis is X).
 * This also matches the Fridge1/Bed1-style furniture "facing" convention, so
 * wall-flush furniture can be placed with `facing: room.facing` directly.
 */
export type HouseRoom = {
  role: HouseRoomRole;
  facing: "SE" | "SW";
  /** Inclusive walkable floor bounds inside the room. */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Door gap tile on the shared front wall (becomes a real openable door). */
  entranceX: number;
  entranceY: number;
  /** Partition tiles whose faces hide this room's furniture. */
  wallTiles: InteriorWallTile[];
  /** Chimney mantel is on this bay's wall. Furnished as a living room. */
  hearth?: boolean;
  /** Opening into the neighbouring kitchen or living room, not a hallway door. */
  omitDoor?: boolean;
};

function houseRoomDoorAt(bayStart: number, inner: number): number {
  return bayStart + Math.ceil(inner / 2);
}

/**
 * True when a bay's walls/floor sit on the house door or the tile immediately
 * inside it — those bays must be omitted (never hole-punched).
 */
function houseBayBlocksEntrance(room: HouseRoom, exit: InteriorExit): boolean {
  const approachX = exit.face === "SE" ? exit.insideX - 1 : exit.insideX;
  const approachY = exit.face === "SW" ? exit.insideY - 1 : exit.insideY;
  if (
    exit.insideX >= room.x0 &&
    exit.insideX <= room.x1 &&
    exit.insideY >= room.y0 &&
    exit.insideY <= room.y1
  ) {
    return true;
  }
  if (
    approachX >= room.x0 &&
    approachX <= room.x1 &&
    approachY >= room.y0 &&
    approachY <= room.y1
  ) {
    return true;
  }
  for (const w of room.wallTiles) {
    if (w.x === exit.insideX && w.y === exit.insideY) return true;
    if (w.x === approachX && w.y === approachY) return true;
    if (
      exit.face === "SE" &&
      w.x === exit.insideX &&
      w.y >= exit.alongMin &&
      w.y <= exit.alongMax
    ) {
      return true;
    }
    if (
      exit.face === "SW" &&
      w.y === exit.insideY &&
      w.x >= exit.alongMin &&
      w.x <= exit.alongMax
    ) {
      return true;
    }
  }
  return false;
}

/** Flag the bay whose floor holds the mantel. A slid hearth bay wins. */
function markHouseHearthBay(
  bays: HouseRoom[],
  mantel: HouseMantelSpot | null,
  facing: "SE" | "SW",
): void {
  if (!mantel || mantel.facing !== facing) return;
  if (bays.some((bay) => bay.hearth)) return;
  const x1 = mantel.x + mantel.w - 1;
  const y1 = mantel.y + mantel.h - 1;
  for (const bay of bays) {
    if (x1 < bay.x0 || mantel.x > bay.x1 || y1 < bay.y0 || mantel.y > bay.y1) {
      continue;
    }
    bay.hearth = true;
    return;
  }
}

type HouseRoomPlan = {
  role: HouseRoomRole;
  inner: number;
  min: number;
  max: number;
};

/** Furthest floor row a west-wall bay may use. */
function houseSeMaxFloor(iH: number, exit?: InteriorExit): number {
  let maxY1 = iH - 1 - HOUSE_EDGE_GAP;
  if (exit?.face === "SW") {
    maxY1 = Math.min(maxY1, exit.insideY - HOUSE_ENTRANCE_CLEARANCE - 1);
  }
  return maxY1;
}

/** Furthest floor column a north-wall bay may use. */
function houseSwMaxFloor(iW: number, exit?: InteriorExit): number {
  let maxX1 = iW - 1 - HOUSE_EDGE_GAP;
  if (exit?.face === "SE") {
    maxX1 = Math.min(maxX1, exit.insideX - HOUSE_ENTRANCE_CLEARANCE - 1);
  }
  return maxX1;
}

/** `sum(lengths) + count` must stay within the wall budget. */
function houseWallFits(lengths: number[], budget: number): boolean {
  if (lengths.length === 0) return true;
  return lengths.reduce((sum, length) => sum + length, 0) + lengths.length <= budget;
}

function houseSpanUsed(plans: { inner: number }[]): number {
  return plans.reduce((sum, plan) => sum + plan.inner, 0) + plans.length;
}

/**
 * True when the bedroom still has a wall tile that is not the north room's
 * front wall and not the mantel. A 1x1 piece needs that tile.
 */
function bedroomKeepsAFreeTile(
  se: HouseRoomPlan[],
  mantel: HouseMantelSpot | null | undefined,
  hasNorth: boolean,
): boolean {
  if (!mantel || mantel.facing !== "SE") return true;
  let along = 0;
  for (const plan of se) {
    const corner = along === 0;
    const y0 = corner ? 0 : along + 1;
    const y1 = corner ? plan.inner - 1 : along + plan.inner;
    if (plan.role === "bedroom") {
      const frontY = se[0] && se[0] !== plan ? se[0].inner : -1;
      for (let y = y0; y <= y1; y++) {
        const wallRow = hasNorth && y === frontY;
        const mantelRow = y >= mantel.y && y < mantel.y + mantel.h;
        if (!wallRow && !mantelRow) return true;
      }
      return false;
    }
    along = corner ? plan.inner : along + plan.inner + 1;
  }
  return false;
}

/** How many of a north-wall bay's floor tiles the mantel already occupies. */
function mantelTilesInNorthBay(
  inner: number,
  mantel: HouseMantelSpot | null | undefined,
): number {
  if (!mantel || mantel.facing !== "SW") return 0;
  const x0 = HOUSE_ROOM_DEPTH + 1;
  const x1 = x0 + inner - 1;
  let count = 0;
  for (let x = mantel.x; x < mantel.x + mantel.w; x++) {
    if (x >= x0 && x <= x1) count++;
  }
  return count;
}

function rollHouseAlong(
  rng: () => number,
  min: number,
  max: number,
  used: number,
  budget: number,
): number | null {
  const cap = Math.min(max, budget - used - 1);
  if (cap < min) return null;
  return min + Math.floor(rng() * (cap - min + 1));
}

/**
 * West-wall budget is `maxY1 + 2` (first bay includes its corner tile).
 * North-wall bays start at HOUSE_ROOM_DEPTH, so their budget is `maxX1 - 2`.
 */
function planTownHouseRooms(
  iW: number,
  iH: number,
  exit: InteriorExit | undefined,
  mantel: HouseMantelSpot | null | undefined,
  rng: () => number,
): { se: HouseRoomPlan[]; sw: HouseRoomPlan[] } | null {
  if (rng() < HOUSE_VACANT_CHANCE) return null;

  const seBudget = houseSeMaxFloor(iH, exit) + 2;
  const swBudget = houseSwMaxFloor(iW, exit) - 2;
  const se: HouseRoomPlan[] = [];
  const sw: HouseRoomPlan[] = [];
  const bed = {
    min: HOUSE_BEDROOM_ALONG_MIN,
    max: HOUSE_BEDROOM_ALONG_MAX,
  };
  const kit = {
    min: HOUSE_KITCHEN_ALONG_MIN,
    max: HOUSE_KITCHEN_ALONG_MAX,
  };
  const liv = {
    min: HOUSE_LIVING_ALONG_MIN,
    max: HOUSE_LIVING_ALONG_MAX,
  };

  const push = (
    list: HouseRoomPlan[],
    role: HouseRoomRole,
    spec: { min: number; max: number },
    inner: number,
  ) => {
    list.push({ role, inner, min: spec.min, max: spec.max });
  };

  // Corner living room, bedroom south of it, kitchen on the north wall.
  // The bedroom door then sits south of the kitchen, so it opens into the hall.
  const preferred =
    houseWallFits([liv.min, bed.min], seBudget) &&
    houseWallFits([kit.min], swBudget);
  if (preferred) {
    const living = rollHouseAlong(rng, liv.min, liv.max, 0, seBudget - (bed.min + 1))!;
    const bedroom = rollHouseAlong(rng, bed.min, bed.max, living + 1, seBudget)!;
    const kitchen = rollHouseAlong(rng, kit.min, kit.max, 0, swBudget)!;
    push(se, "livingroom", liv, living);
    push(se, "bedroom", bed, bedroom);
    push(sw, "kitchen", kit, kitchen);
    // A north-wall hearth leaves too few tiles for a sink and a fridge.
    // The corner becomes the kitchen (still open to the north room) and the
    // north bay keeps the mantel as the living room.
    const north = sw[0]!;
    const covered = mantelTilesInNorthBay(north.inner, mantel);
    if (covered > 0 && north.inner - covered < kit.min) {
      const need = covered + kit.min;
      const grown = rollHouseAlong(rng, need, kit.max, 0, swBudget);
      if (grown != null) {
        north.inner = grown;
      } else if (se[0]?.role === "livingroom") {
        se[0].role = "kitchen";
        se[0].min = kit.min;
        se[0].max = kit.max;
        se[0].inner = Math.min(Math.max(se[0].inner, kit.min), HOUSE_ROOM_DEPTH);
        north.role = "livingroom";
        north.min = liv.min;
        north.max = liv.max;
      }
    }
  } else if (houseWallFits([bed.min, kit.min], seBudget)) {
    // North wall cannot hold a sink plus a fridge. Both required rooms go
    // on the west wall, and nothing is placed north of the bedroom door.
    const bedroom = rollHouseAlong(rng, bed.min, bed.max, 0, seBudget - (kit.min + 1))!;
    const kitchen = rollHouseAlong(rng, kit.min, kit.max, bedroom + 1, seBudget)!;
    push(se, "bedroom", bed, bedroom);
    push(se, "kitchen", kit, kitchen);
  } else {
    const bedroom = rollHouseAlong(rng, bed.min, bed.max, 0, seBudget);
    if (bedroom != null) push(se, "bedroom", bed, bedroom);
    const kitchenOnWest = rollHouseAlong(rng, kit.min, kit.max, houseSpanUsed(se), seBudget);
    if (kitchenOnWest != null) {
      push(se, "kitchen", kit, kitchenOnWest);
    } else {
      const kitchenOnNorth = rollHouseAlong(rng, kit.min, kit.max, 0, swBudget);
      if (kitchenOnNorth != null) push(sw, "kitchen", kit, kitchenOnNorth);
    }
  }

  const has = (role: HouseRoomRole) =>
    se.some((plan) => plan.role === role) || sw.some((plan) => plan.role === role);

  // A corner bedroom's door opens east into the first north-wall bay.
  // Optional rooms stay on the west wall in that layout.
  const cornerBedroom = se[0]?.role === "bedroom";
  const addOptional = (
    role: HouseRoomRole,
    spec: { min: number; max: number },
    preferNorth: boolean,
  ) => {
    if (has(role)) return;
    const order: ("se" | "sw")[] = preferNorth ? ["sw", "se"] : ["se", "sw"];
    for (const wall of order) {
      if (wall === "sw" && cornerBedroom) continue;
      const list = wall === "se" ? se : sw;
      const budget = wall === "se" ? seBudget : swBudget;
      if (list.length >= HOUSE_MAX_BAYS_PER_LINE) continue;
      if (!houseWallFits([...list.map((plan) => plan.inner), spec.min], budget)) continue;
      const inner = rollHouseAlong(rng, spec.min, spec.max, houseSpanUsed(list), budget);
      if (inner == null) continue;
      push(list, role, spec, inner);
      return;
    }
  };

  if (has("bedroom") && has("kitchen")) {
    addOptional("livingroom", liv, sw.some((plan) => plan.role === "kitchen"));
    addOptional(
      "office",
      { min: HOUSE_OFFICE_ALONG_MIN, max: HOUSE_OFFICE_ALONG_MAX },
      se.some((plan) => plan.role === "livingroom"),
    );
  }

  // The north room closes on the corner bay's far wall. A longer corner
  // would push that wall past the usual hallway, so keep it within DEPTH.
  if (sw.length > 0 && se[0]) {
    se[0].inner = Math.min(se[0].inner, HOUSE_ROOM_DEPTH);
    se[0].max = Math.min(se[0].max, HOUSE_ROOM_DEPTH);
  }

  // The south bedroom is only the hearth and the north room's front wall.
  // Move it to the corner. The north kitchen is one tile longer than its
  // minimum so the bedroom door can open into the hall beside it.
  const northKitchen = sw.find((plan) => plan.role === "kitchen");
  if (
    northKitchen &&
    northKitchen.inner >= HOUSE_KITCHEN_ALONG_MIN + 1 &&
    !bedroomKeepsAFreeTile(se, mantel, sw.length > 0)
  ) {
    const bedInner = Math.min(
      HOUSE_ROOM_DEPTH,
      Math.max(HOUSE_BEDROOM_ALONG_MIN, mantel && mantel.facing === "SE" ? mantel.y : HOUSE_BEDROOM_ALONG_MIN),
    );
    if (bedInner >= HOUSE_BEDROOM_ALONG_MIN && (!mantel || mantel.facing !== "SE" || bedInner <= mantel.y)) {
      se.length = 0;
      se.push({
        role: "bedroom",
        inner: bedInner,
        min: HOUSE_BEDROOM_ALONG_MIN,
        max: HOUSE_ROOM_DEPTH,
      });
    }
  }

  const tagged = [
    ...se.map((plan) => ({ plan, wall: se, budget: seBudget })),
    ...sw.map((plan) => ({ plan, wall: sw, budget: swBudget })),
  ];
  if (tagged.length >= 2 && tagged.every((entry) => entry.plan.inner === tagged[0]!.plan.inner)) {
    const order = tagged.slice();
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = order[i]!;
      order[i] = order[j]!;
      order[j] = tmp;
    }
    let changed = false;
    for (const entry of order) {
      if (entry.plan.inner >= entry.plan.max) continue;
      entry.plan.inner += 1;
      if (houseSpanUsed(entry.wall) <= entry.budget) {
        changed = true;
        break;
      }
      entry.plan.inner -= 1;
    }
    if (!changed) {
      for (const entry of order) {
        if (entry.plan.inner <= entry.plan.min) continue;
        entry.plan.inner -= 1;
        break;
      }
    }
  }

  return { se, sw };
}

/**
 * Bays lining the west wall (x = 0). The first bay starts at the corner
 * (y = 0) so the exterior edge is floor, not an extra wall.
 */
function houseSeBays(
  iW: number,
  iH: number,
  plans: HouseRoomPlan[],
  exit?: InteriorExit,
  mantel?: HouseMantelSpot | null,
): HouseRoom[] {
  const DEPTH = HOUSE_ROOM_DEPTH;
  const maxY1 = houseSeMaxFloor(iH, exit);
  const bays: HouseRoom[] = [];
  const spans: { a0: number; a1: number }[] = [];
  // A shared partition (the next bay starts where this one ends) is the wall
  // between rooms, not an overlap of their floors.
  const overlaps = (a0: number, a1: number) =>
    spans.some((s) => a0 < s.a1 && s.a0 < a1);

  const tryAdd = (along: number, plan: HouseRoomPlan): boolean => {
    const inner = plan.inner;
    // Corner bay: the north edge is the exterior wall, so that tile is floor.
    const corner = along === 0;
    const floor0 = corner ? along : along + 1;
    const floor1 = corner ? along + inner - 1 : along + inner;
    const far = corner ? along + inner : along + inner + 1;
    if (along < 0 || floor1 > maxY1) return false;
    const a0 = along;
    const a1 = far;
    if (overlaps(a0, a1)) return false;
    const doorY = houseRoomDoorAt(along, inner);
    const wallTiles: InteriorWallTile[] = [];
    for (let x = 0; x <= DEPTH; x++) {
      if (!corner) wallTiles.push({ x, y: along });
      wallTiles.push({ x, y: far });
    }
    for (let y = floor0; y <= floor1; y++) {
      if (y === doorY) continue;
      wallTiles.push({ x: DEPTH, y });
    }
    const room: HouseRoom = {
      role: plan.role,
      facing: "SE",
      x0: 0,
      y0: floor0,
      x1: DEPTH - 1,
      y1: floor1,
      entranceX: DEPTH,
      entranceY: doorY,
      wallTiles,
    };
    if (exit && houseBayBlocksEntrance(room, exit)) return false;
    bays.push(room);
    spans.push({ a0, a1 });
    return true;
  };

  let along = 0;
  for (const plan of plans) {
    // A west-wall hearth must not be the only tiles in the bedroom.
    // If the shift runs off the wall, keep the original spot.
    const unshifted = along;
    if (plan.role === "bedroom" && mantel?.facing === "SE" && along > 0) {
      const floor0 = along + 1;
      const floor1 = along + plan.inner;
      const mantelEnd = mantel.y + mantel.h;
      if (floor1 >= mantel.y && floor0 <= mantelEnd - 1) {
        const shifted = mantelEnd - 1;
        if (shifted > along) along = shifted;
      }
    }
    let placed = tryAdd(along, plan);
    if (!placed && along !== unshifted) {
      along = unshifted;
      placed = tryAdd(along, plan);
    }
    if (!placed && plan.role === "bedroom") {
      const original = plan.inner;
      for (let inner = original - 1; inner >= plan.min; inner--) {
        plan.inner = inner;
        if (tryAdd(along, plan)) {
          placed = true;
          break;
        }
      }
      if (!placed) plan.inner = original;
    }
    if (!placed) break;
    along = along === 0 ? plan.inner : along + plan.inner + 1;
  }
  markHouseHearthBay(bays, mantel ?? null, "SE");
  return bays;
}

/**
 * A north-wall living room that starts after the kitchen's depth can end
 * on the mantel, so the door sits in front of the hearth. Extend the room
 * along the wall until the mantel is floor, and put the door on another column.
 */
function fitNorthLivingRoomAroundMantel(
  room: HouseRoom,
  mantel: HouseMantelSpot,
  maxX1: number,
  others: HouseRoom[],
  exit?: InteriorExit,
): void {
  const mantelX0 = mantel.x;
  const mantelX1 = mantel.x + mantel.w - 1;
  if (mantelX1 < room.x0 || mantelX0 > room.x1 + 1) return;

  const next = others.find((other) => other.facing === "SW" && other.x0 > room.x0);
  let x1 = Math.max(room.x1, mantelX1);
  if (next) x1 = Math.min(x1, next.x0 - 2);
  if (x1 > maxX1) x1 = maxX1;
  if (x1 < room.x1) return;

  const onMantel = (x: number) => x >= mantelX0 && x <= mantelX1;
  let doorX = room.entranceX;
  if (doorX < room.x0 || doorX > x1 || onMantel(doorX)) {
    let best = -1;
    let bestDist = Infinity;
    for (let x = room.x0; x <= x1; x++) {
      if (onMantel(x)) continue;
      const dist = Math.abs(x - room.entranceX);
      if (dist < bestDist) {
        bestDist = dist;
        best = x;
      }
    }
    if (best < 0 && x1 < maxX1 && (!next || x1 + 1 <= next.x0 - 2)) {
      x1 += 1;
      best = x1;
    }
    if (best < 0) return;
    doorX = best;
  }
  if (x1 === room.x1 && doorX === room.entranceX) return;

  const savedX1 = room.x1;
  const savedDoor = room.entranceX;
  const savedWalls = room.wallTiles;
  const oldEast = room.x1 + 1;
  const depth = room.y1 + 1;
  room.wallTiles = room.wallTiles.filter((w) => {
    if (w.x === oldEast && w.y <= depth) return false;
    if (w.y === depth && w.x >= room.x0 && w.x <= oldEast) return false;
    return true;
  });
  room.x1 = x1;
  room.entranceX = doorX;
  const newEast = x1 + 1;
  for (let y = 0; y <= depth; y++) room.wallTiles.push({ x: newEast, y });
  for (let x = room.x0; x <= x1; x++) {
    if (x === doorX) continue;
    room.wallTiles.push({ x, y: depth });
  }
  if (exit && houseBayBlocksEntrance(room, exit)) {
    room.x1 = savedX1;
    room.entranceX = savedDoor;
    room.wallTiles = savedWalls;
  }
}

/**
 * A west-wall room whose east edge clips a north-wall mantel leaves the
 * doorway on the hearth's front tile. Extend the room until the mantel is
 * floor and move the door onto the new east wall.
 */
function fitWestRoomAroundNorthMantel(
  room: HouseRoom,
  mantel: HouseMantelSpot,
  maxX1: number,
  others: HouseRoom[],
  exit?: InteriorExit,
): void {
  if (room.facing !== "SE" || mantel.facing !== "SW") return;
  const mantelX0 = mantel.x;
  const mantelX1 = mantel.x + mantel.w - 1;
  if (mantelX1 < room.x0 || mantelX0 > room.x1 + 1) return;
  if (mantel.y > room.y1 || mantel.y + mantel.h <= room.y0) return;
  const onFloor = (x: number) =>
    x >= room.x0 && x <= room.x1 && mantel.y >= room.y0 && mantel.y <= room.y1;
  const doorOnStand =
    room.entranceX >= mantelX0 &&
    room.entranceX <= mantelX1 &&
    room.entranceY === mantel.y + 1;
  if (onFloor(mantelX0) && onFloor(mantelX1) && !doorOnStand) return;

  let x1 = Math.max(room.x1, mantelX1);
  const shifts: { room: HouseRoom; x0: number; door: number }[] = [];
  for (const other of others) {
    if (other === room) continue;
    if (other.y0 > room.y1 + 1 || other.y1 < room.y0) continue;
    if (other.x0 <= room.x1) continue;
    const neededX0 = mantelX1 + 2;
    const minLen =
      other.role === "kitchen"
        ? HOUSE_KITCHEN_ALONG_MIN
        : other.role === "livingroom"
          ? HOUSE_LIVING_ALONG_MIN
          : other.role === "bedroom"
            ? HOUSE_BEDROOM_ALONG_MIN
            : HOUSE_OFFICE_ALONG_MIN;
    if (
      other.facing === "SW" &&
      neededX0 > other.x0 &&
      other.x1 - neededX0 + 1 >= minLen
    ) {
      const door =
        other.entranceX < neededX0
          ? neededX0
          : Math.min(other.entranceX, other.x1);
      shifts.push({ room: other, x0: neededX0, door });
      continue;
    }
    x1 = Math.min(x1, other.x0 - 2);
  }
  if (x1 > maxX1) x1 = maxX1;
  if (x1 < mantelX1) shifts.length = 0;
  if (x1 <= room.x1) return;

  const savedX1 = room.x1;
  const savedDoorX = room.entranceX;
  const savedWalls = room.wallTiles;
  const savedShifts = shifts.map((shift) => ({
    room: shift.room,
    x0: shift.room.x0,
    door: shift.room.entranceX,
  }));
  for (const shift of shifts) {
    shift.room.x0 = shift.x0;
    shift.room.entranceX = shift.door;
  }
  const oldEast = room.x1 + 1;
  const far = room.y1 + 1;
  const north = room.y0 > 0 ? room.y0 - 1 : -1;
  room.wallTiles = room.wallTiles.filter((w) => {
    if (w.x === oldEast && w.y <= far && (north < 0 || w.y >= north)) return false;
    if (w.y === far && w.x >= room.x0 && w.x <= oldEast) return false;
    if (north >= 0 && w.y === north && w.x >= room.x0 && w.x <= oldEast) return false;
    return true;
  });
  room.x1 = x1;
  room.entranceX = x1 + 1;
  const newEast = room.entranceX;
  const yStart = north >= 0 ? north : room.y0;
  for (let y = yStart; y <= far; y++) {
    if (y === room.entranceY && y >= room.y0 && y <= room.y1) continue;
    room.wallTiles.push({ x: newEast, y });
  }
  for (let x = room.x0; x <= x1; x++) room.wallTiles.push({ x, y: far });
  if (north >= 0) {
    for (let x = room.x0; x <= x1; x++) room.wallTiles.push({ x, y: north });
  }
  const stillOnStand =
    room.entranceX >= mantelX0 &&
    room.entranceX <= mantelX1 &&
    room.entranceY === mantel.y + 1;
  if (stillOnStand || (exit && houseBayBlocksEntrance(room, exit))) {
    room.x1 = savedX1;
    room.entranceX = savedDoorX;
    room.wallTiles = savedWalls;
    for (const shift of savedShifts) {
      shift.room.x0 = shift.x0;
      shift.room.entranceX = shift.door;
    }
  }
}

/**
 * Bays lining the north wall (y = 0), stacked along X starting past the west-wall bays.
 * `roomDepth` is the corner room's far wall. A shorter corner used to leave the
 * next bedroom's wall on the kitchen's last floor row.
 */
function houseSwBays(
  iW: number,
  iH: number,
  plans: HouseRoomPlan[],
  exit?: InteriorExit,
  mantel?: HouseMantelSpot | null,
  roomDepth = HOUSE_ROOM_DEPTH,
): HouseRoom[] {
  const DEPTH = HOUSE_ROOM_DEPTH;
  const depth = Math.max(1, Math.min(roomDepth, HOUSE_ROOM_DEPTH));
  const maxX1 = houseSwMaxFloor(iW, exit);
  const bays: HouseRoom[] = [];
  const spans: { a0: number; a1: number }[] = [];
  // A shared partition (the next bay starts where this one ends) is the wall
  // between rooms, not an overlap of their floors.
  const overlaps = (a0: number, a1: number) =>
    spans.some((s) => a0 < s.a1 && s.a0 < a1);

  const tryAdd = (along: number, plan: HouseRoomPlan): boolean => {
    const inner = plan.inner;
    if (along < 0 || along + inner > maxX1) return false;
    const a0 = along;
    const a1 = along + inner + 1;
    if (overlaps(a0, a1)) return false;
    let doorX = houseRoomDoorAt(along, inner);
    // Shallow kitchens use the door row as the sink's approach. A centered
    // door blocks every 2-tile sink, so the door takes the last column.
    if (depth < HOUSE_ROOM_DEPTH && plan.role === "kitchen" && inner >= 3) {
      doorX = along + inner;
    }
    const wallTiles: InteriorWallTile[] = [];
    for (let y = 0; y <= depth; y++) {
      // The first bay skips its west divider (x = along = DEPTH) so the room
      // can include the NW corner. A west-wall (SE) neighbour normally
      // supplies the shared front wall and closes that L. Drawing the
      // divider here would cut the corner off and is not the SE doorway
      // (that gap sits further south on the same column).
      if (along !== DEPTH) wallTiles.push({ x: along, y });
      wallTiles.push({ x: along + inner + 1, y });
    }
    for (let x = along + 1; x <= along + inner; x++) {
      if (x === doorX) continue;
      wallTiles.push({ x, y: depth });
    }
    // When no SE bay sits on the west wall, nothing else draws the south
    // closer across the NW corner. Without it the kitchen opens into the
    // hallway. Harmless duplicate if the SE neighbour already placed these.
    if (along === DEPTH) {
      for (let x = 0; x <= along; x++) {
        wallTiles.push({ x, y: depth });
      }
    }
    const room: HouseRoom = {
      role: plan.role,
      facing: "SW",
      x0: along + 1,
      y0: 0,
      x1: along + inner,
      y1: depth - 1,
      entranceX: doorX,
      entranceY: depth,
      wallTiles,
    };
    if (exit && houseBayBlocksEntrance(room, exit)) return false;
    bays.push(room);
    spans.push({ a0, a1 });
    return true;
  };

  let along = DEPTH;
  for (const plan of plans) {
    if (!tryAdd(along, plan)) break;
    along += plan.inner + 1;
  }
  if (mantel?.facing === "SW") {
    const living = bays.find((bay) => bay.role === "livingroom");
    // The usual north-wall cap keeps a hallway in front of an east door.
    // The mantel only needs a few tiles at y = 0, so let this one room pass
    // that cap when the new wall still misses the door.
    if (living) {
      fitNorthLivingRoomAroundMantel(
        living,
        mantel,
        iW - 1 - HOUSE_EDGE_GAP,
        bays,
        exit,
      );
    }
  }
  markHouseHearthBay(bays, mantel ?? null, "SW");
  return bays;
}

/** Drop partition tiles that would cut through a mantel or its stand tiles. */
function stripHouseMantelWalls(
  rooms: HouseRoom[],
  mantel: HouseMantelSpot | null,
): void {
  if (!mantel) return;
  const { dx, dy } = ISO_FACING_TILE_DELTA[mantel.facing];
  const clear = new Set<string>();
  for (let ty = mantel.y; ty < mantel.y + mantel.h; ty++) {
    for (let tx = mantel.x; tx < mantel.x + mantel.w; tx++) {
      clear.add(`${tx},${ty}`);
      clear.add(`${tx + dx},${ty + dy}`);
    }
  }
  for (const room of rooms) {
    room.wallTiles = room.wallTiles.filter((w) => !clear.has(`${w.x},${w.y}`));
  }
}

/**
 * Expand each bay's floor AABB (and fade wall set) to the full orthogonal
 * region enclosed by solid partitions + that bay's door. Bay templates can
 * underspecify floor (e.g. SW kitchen skips its west divider so the room
 * includes the NW corner) — flood-fill captures the real L. The first SW
 * bay always draws the south closer across that corner, so the kitchen
 * stays enclosed when no west-wall room is there to share the wall.
 */
function finalizeHouseRoomsWithEnclosedBounds(
  rooms: HouseRoom[],
  iW: number,
  iH: number,
  exit?: InteriorExit,
): void {
  if (rooms.length === 0) return;

  const solidWalls = new Set<string>();
  for (const room of rooms) {
    for (const w of room.wallTiles) solidWalls.add(`${w.x},${w.y}`);
  }

  const blocked = new Set(solidWalls);
  for (const room of rooms) {
    blocked.add(`${room.entranceX},${room.entranceY}`);
  }

  const inBounds = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < iW && y < iH;
  const ORTHO: readonly [number, number][] = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  const templates = rooms.map((room) => ({
    x0: room.x0,
    y0: room.y0,
    x1: room.x1,
    y1: room.y1,
  }));

  for (let i = 0; i < rooms.length; i++) {
    const room = rooms[i]!;
    const seedX = Math.floor((room.x0 + room.x1) / 2);
    const seedY = Math.floor((room.y0 + room.y1) / 2);
    if (!inBounds(seedX, seedY) || blocked.has(`${seedX},${seedY}`)) continue;

    const floor = new Set<string>();
    const qx = [seedX];
    const qy = [seedY];
    floor.add(`${seedX},${seedY}`);
    let head = 0;
    let spilled = false;
    while (head < qx.length) {
      const cx = qx[head]!;
      const cy = qy[head]!;
      head++;
      for (const [dx, dy] of ORTHO) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (!inBounds(nx, ny)) continue;
        const key = `${nx},${ny}`;
        if (blocked.has(key) || floor.has(key)) continue;
        // If we reach the overworld door or another bay's floor, the bay
        // isn't sealed. Keep the template instead of swallowing that room.
        if (exit && nx === exit.insideX && ny === exit.insideY) {
          spilled = true;
          break;
        }
        const otherBay = templates.some(
          (t, j) =>
            j !== i &&
            nx >= t.x0 &&
            nx <= t.x1 &&
            ny >= t.y0 &&
            ny <= t.y1,
        );
        if (otherBay) {
          spilled = true;
          break;
        }
        floor.add(key);
        qx.push(nx);
        qy.push(ny);
      }
      if (spilled) break;
    }
    if (spilled || floor.size === 0) continue;
    // Pathological open plan — refuse to claim half the house.
    if (floor.size > (iW * iH) / 2) continue;

    let minX = iW;
    let minY = iH;
    let maxX = 0;
    let maxY = 0;
    for (const key of floor) {
      const comma = key.indexOf(",");
      const x = Number(key.slice(0, comma));
      const y = Number(key.slice(comma + 1));
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
    room.x0 = minX;
    room.y0 = minY;
    room.x1 = maxX;
    room.y1 = maxY;

    // Expand fade shell with walls touching the new floor — but keep the
    // template wallTiles. Corner posts sit diagonally off the floor and would
    // be dropped if we replaced the list with ortho-adjacent walls only.
    const wallSeen = new Set(room.wallTiles.map((w) => `${w.x},${w.y}`));
    for (const key of floor) {
      const comma = key.indexOf(",");
      const x = Number(key.slice(0, comma));
      const y = Number(key.slice(comma + 1));
      for (const [dx, dy] of ORTHO) {
        const nx = x + dx;
        const ny = y + dy;
        const nk = `${nx},${ny}`;
        if (!solidWalls.has(nk) || wallSeen.has(nk)) continue;
        wallSeen.add(nk);
        room.wallTiles.push({ x: nx, y: ny });
      }
    }
  }

  // If two bays still claim the same floor, keep the templates.
  for (let i = 0; i < rooms.length; i++) {
    for (let j = i + 1; j < rooms.length; j++) {
      const a = rooms[i]!;
      const c = rooms[j]!;
      if (a.x0 > c.x1 || c.x0 > a.x1 || a.y0 > c.y1 || c.y0 > a.y1) continue;
      const ta = templates[i]!;
      const tc = templates[j]!;
      a.x0 = ta.x0;
      a.y0 = ta.y0;
      a.x1 = ta.x1;
      a.y1 = ta.y1;
      c.x0 = tc.x0;
      c.y0 = tc.y0;
      c.x1 = tc.x1;
      c.y1 = tc.y1;
    }
  }
}

/**
 * Room layout for a town/city house. Vacant houses return no rooms. Every
 * other house is planned with a bedroom and a kitchen, each a random length
 * between its minimum and maximum. A living room and an office are added
 * when the walls still have space.
 *
 * Bays are clamped away from the overworld door so partition walls never sit
 * on the entrance row (hole-punching that row left open corners). Floor AABBs
 * are then expanded to the real wall-enclosed region.
 */
function layoutHouseRooms(
  iW: number,
  iH: number,
  exit: InteriorExit | undefined,
  mantel: HouseMantelSpot | null | undefined,
  rng: () => number,
): HouseRoom[] {
  const plan = planTownHouseRooms(iW, iH, exit, mantel, rng);
  if (!plan) return [];
  const seBays = houseSeBays(iW, iH, plan.se, exit, mantel).filter(
    (room) => !exit || !houseBayBlocksEntrance(room, exit),
  );
  const corner = seBays.find((room) => room.facing === "SE" && room.y0 === 0);
  // North rooms close on the corner room's far wall, so a longer bedroom
  // south of that corner starts past the kitchen instead of across it.
  const swDepth = corner ? corner.y1 + 1 : HOUSE_ROOM_DEPTH;
  const swBays = houseSwBays(iW, iH, plan.sw, exit, mantel, swDepth).filter(
    (room) => !exit || !houseBayBlocksEntrance(room, exit),
  );
  if (seBays.length === 0 && swBays.length === 0) return [];

  const ordered: HouseRoom[] = [];
  const maxLen = Math.max(seBays.length, swBays.length);
  for (let i = 0; i < maxLen; i++) {
    if (seBays[i]) ordered.push(seBays[i]!);
    if (swBays[i]) ordered.push(swBays[i]!);
  }

  if (mantel?.facing === "SW") {
    for (const room of ordered) {
      if (room.facing !== "SE") continue;
      fitWestRoomAroundNorthMantel(
        room,
        mantel,
        iW - 1 - HOUSE_EDGE_GAP,
        ordered,
        exit,
      );
    }
  }

  stripHouseMantelWalls(ordered, mantel ?? null);
  finalizeHouseRoomsWithEnclosedBounds(ordered, iW, iH, exit);
  separateDoorsFromOtherRooms(ordered);
  return ordered;
}

function tileInHouseRoom(room: HouseRoom, x: number, y: number): boolean {
  return x >= room.x0 && x <= room.x1 && y >= room.y0 && y <= room.y1;
}

/**
 * A door that opens onto another room's floor steps that room aside.
 * A kitchen and a living room keep the wall between them and the door in
 * it. That wall stays unless the rooms could not both exist with it.
 */
function separateDoorsFromOtherRooms(rooms: HouseRoom[]): void {
  for (const room of rooms) {
    if (room.omitDoor) continue;
    const outside = roomDoorFrontTiles(room).outside;
    const other = rooms.find(
      (candidate) => candidate !== room && tileInHouseRoom(candidate, outside.x, outside.y),
    );
    if (!other) continue;
    const openPair =
      (room.role === "kitchen" && other.role === "livingroom") ||
      (room.role === "livingroom" && other.role === "kitchen");
    if (openPair) continue;
    if (room.facing === "SE" && other.x1 >= outside.x + 1) {
      other.x0 = Math.max(other.x0, outside.x + 1);
    } else if (room.facing === "SW" && other.y1 >= outside.y + 1) {
      other.y0 = Math.max(other.y0, outside.y + 1);
    } else {
      room.omitDoor = true;
    }
  }
}

/**
 * Whether this building is a town/city house big enough for a partitioned
 * multi-room interior. This is a generation-context flag on `BuildingInfo`
 * (set by worldgen for town/city houses only) — NOT a size check, because
 * urban house footprints (4x4-6x6) now overlap the rural cabin range (3-4)
 * and size alone can no longer tell them apart.
 */
export function isMultiRoomHouseInterior(bx: number, by: number): boolean {
  return (
    isResidentialInterior(bx, by) && getBuildingAt(bx, by)?.houseRooms === true
  );
}

/**
 * Public room list for the building at (bx, by) — empty when not a
 * multi-room house. Mirrors `hospitalCubiclesForBuilding` / `motelRoomsForBuilding`.
 */
export function houseRoomsForBuilding(bx: number, by: number): HouseRoom[] {
  if (!isMultiRoomHouseInterior(bx, by)) return [];
  const { iW, iH } = interiorDimensions(bx, by);
  const bld = getBuildingAt(bx, by);
  const rng = mulberry32(xmur3(`interior_${bx},${by}`)());
  return layoutHouseRooms(
    iW,
    iH,
    interiorExitForBuildingAt(bx, by),
    bld ? houseMantelSpot(bld) : null,
    rng,
  );
}

/** Room containing this interior tile (floor or entrance), or null. */
export function houseRoomAtTile(
  bx: number,
  by: number,
  tx: number,
  ty: number,
): HouseRoom | null {
  for (const room of houseRoomsForBuilding(bx, by)) {
    if (tx === room.entranceX && ty === room.entranceY) return room;
    if (tx >= room.x0 && tx <= room.x1 && ty >= room.y0 && ty <= room.y1) {
      return room;
    }
  }
  return null;
}

/**
 * Minimal room/cubicle fields needed to pick the tile in front of a door.
 * Shared by house rooms, motel rooms, and hospital cubicles.
 */
export type RoomDoorRef = {
  facing: "SE" | "SW";
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  entranceX: number;
  entranceY: number;
};

/**
 * Room/cubicle whose *entrance door gap* is exactly (tx, ty), or null.
 * Does not match ordinary floor tiles — callers like fireplace / custom-door
 * approach must not be redirected to the procedural room door.
 */
export function roomAtInteriorDoor(
  bx: number,
  by: number,
  tx: number,
  ty: number,
): RoomDoorRef | null {
  for (const room of houseRoomsForBuilding(bx, by)) {
    if (tx === room.entranceX && ty === room.entranceY) return room;
  }
  for (const room of motelRoomsForBuilding(bx, by)) {
    if (tx === room.entranceX && ty === room.entranceY) return room;
  }
  for (const cubicle of hospitalCubiclesForBuilding(bx, by)) {
    if (tx === cubicle.entranceX && ty === cubicle.entranceY) return cubicle;
  }
  const meeting = officeMeetingRoomForBuilding(bx, by);
  if (
    meeting &&
    tx === meeting.entranceX &&
    ty === meeting.entranceY
  ) {
    return meeting;
  }
  const manager = officeManagerRoomForBuilding(bx, by);
  if (
    manager &&
    tx === manager.entranceX &&
    ty === manager.entranceY
  ) {
    return manager;
  }
  return null;
}

/** True when the player's tile is on the room's walkable floor (not the door gap). */
export function playerInRoomFloor(
  room: RoomDoorRef,
  px: number,
  py: number,
): boolean {
  const tx = Math.floor(px);
  const ty = Math.floor(py);
  return tx >= room.x0 && tx <= room.x1 && ty >= room.y0 && ty <= room.y1;
}

/**
 * Tiles directly inside / outside a room door along its facing axis.
 * SE doors open east (room −x, hallway +x); SW doors open south (room −y, hallway +y).
 */
export function roomDoorFrontTiles(room: RoomDoorRef): {
  inside: { x: number; y: number };
  outside: { x: number; y: number };
} {
  if (room.facing === "SE") {
    return {
      inside: { x: room.entranceX - 1, y: room.entranceY },
      outside: { x: room.entranceX + 1, y: room.entranceY },
    };
  }
  return {
    inside: { x: room.entranceX, y: room.entranceY - 1 },
    outside: { x: room.entranceX, y: room.entranceY + 1 },
  };
}

/**
 * Centre of the door-front tile the player should stand on to open/close:
 * inside the room when already on the room floor, otherwise outside.
 */
export function roomDoorApproachGoal(
  room: RoomDoorRef,
  px: number,
  py: number,
): { x: number; y: number } {
  const { inside, outside } = roomDoorFrontTiles(room);
  const tile = playerInRoomFloor(room, px, py) ? inside : outside;
  return { x: tile.x + 0.5, y: tile.y + 0.5 };
}

/** Position `along` tiles along a room's wall-flush axis. */
function houseRoomSlot(room: HouseRoom, along: number): { x: number; y: number } {
  return room.facing === "SE" ? { x: room.x0, y: along } : { x: along, y: room.y0 };
}

function houseRoomCanPlaceAt(
  room: HouseRoom,
  occupied: Set<string>,
  exitX: number,
  exitY: number,
  x: number,
  y: number,
  w: number,
  h: number,
): boolean {
  if (x < room.x0 || y < room.y0 || x + w - 1 > room.x1 || y + h - 1 > room.y1) return false;
  for (let ty = y; ty < y + h; ty++) {
    for (let tx = x; tx < x + w; tx++) {
      if (tx === exitX && ty === exitY) return false;
      if (occupied.has(`${tx},${ty}`)) return false;
    }
  }
  return true;
}

function houseRoomApproachClear(
  room: HouseRoom,
  occupied: Set<string>,
  exitX: number,
  exitY: number,
  approaches: { x: number; y: number }[],
): boolean {
  if (approaches.length === 0) return false;
  for (const t of approaches) {
    if (t.x < room.x0 || t.y < room.y0 || t.x > room.x1 || t.y > room.y1) return false;
    if (t.x === exitX && t.y === exitY) return false;
    if (occupied.has(`${t.x},${t.y}`)) return false;
  }
  return true;
}

function markHouseRoomOccupied(occupied: Set<string>, x: number, y: number, w: number, h: number) {
  for (let ty = y; ty < y + h; ty++) {
    for (let tx = x; tx < x + w; tx++) occupied.add(`${tx},${ty}`);
  }
}

/** Wall-flush single-slot furniture (desk, dresser, bookshelf, bagchair, etc.). */
function placeHouseWallItem(
  room: HouseRoom,
  type: FurnitureType,
  bx: number,
  by: number,
  exitX: number,
  exitY: number,
  rng: () => number,
  occupied: Set<string>,
  idx: number,
  force = false,
): SearchableObject | null {
  if (!force && rng() >= FURNITURE_SPAWN_CHANCE[type]) return null;
  const facing = room.facing;
  const { w, h } = furnitureFootprint(type, facing);
  const alongMin = room.facing === "SE" ? room.y0 : room.x0;
  const alongMax = room.facing === "SE" ? room.y1 : room.x1;
  const slots: { x: number; y: number }[] = [];
  for (let along = alongMin; along <= alongMax; along++) {
    const pos = houseRoomSlot(room, along);
    if (!houseRoomCanPlaceAt(room, occupied, exitX, exitY, pos.x, pos.y, w, h)) continue;
    const approaches = furnitureFrontApproachTiles({
      kind: "furniture",
      objectType: type,
      x: pos.x,
      y: pos.y,
      facing,
    });
    if (!houseRoomApproachClear(room, occupied, exitX, exitY, approaches)) continue;
    slots.push(pos);
  }
  if (slots.length === 0) return null;
  const pick = slots[Math.floor(rng() * slots.length)]!;
  markHouseRoomOccupied(occupied, pick.x, pick.y, w, h);
  for (const t of furnitureFrontApproachTiles({ kind: "furniture", objectType: type, x: pick.x, y: pick.y, facing })) {
    occupied.add(`${t.x},${t.y}`);
  }
  return {
    id: interiorSearchableId(bx, by, "furniture", idx),
    kind: "furniture",
    objectType: type,
    x: pick.x,
    y: pick.y,
    searched: false,
    buildingX: bx,
    buildingY: by,
    facing,
  };
}

/**
 * Bed against the room's exterior wall (Bed1 art is SE-only, so bedrooms are
 * always SE bays). A bed is common, but any one bedroom piece is enough.
 */
function placeBedroomFurniture(
  room: HouseRoom,
  bx: number,
  by: number,
  exitX: number,
  exitY: number,
  rng: () => number,
  occupied: Set<string>,
  startIndex: number,
): SearchableObject[] {
  const furnitures: SearchableObject[] = [];
  let idx = startIndex;

  const tryPlaceBed = (): SearchableObject | null => {
    if (room.facing !== "SE") return null;
    const { w, h } = furnitureFootprint("bed");
    const slots: number[] = [];
    for (let y = room.y0; y <= room.y1 - h + 1; y++) {
      if (!houseRoomCanPlaceAt(room, occupied, exitX, exitY, room.x0, y, w, h)) continue;
      const approaches = furnitureFrontApproachTiles({ kind: "furniture", objectType: "bed", x: room.x0, y });
      if (!houseRoomApproachClear(room, occupied, exitX, exitY, approaches)) continue;
      slots.push(y);
    }
    if (slots.length === 0) return null;
    const y = slots[Math.floor(rng() * slots.length)]!;
    markHouseRoomOccupied(occupied, room.x0, y, w, h);
    for (const t of furnitureFrontApproachTiles({ kind: "furniture", objectType: "bed", x: room.x0, y })) {
      occupied.add(`${t.x},${t.y}`);
    }
    const placed: SearchableObject = {
      id: interiorSearchableId(bx, by, "furniture", idx++),
      kind: "furniture",
      objectType: "bed",
      x: room.x0,
      y,
      searched: false,
      buildingX: bx,
      buildingY: by,
    };
    furnitures.push(placed);
    return placed;
  };

  // A bed is common. Missing the roll still leaves the other bedroom pieces.
  let bed: SearchableObject | null = null;
  if (rng() < 0.65) bed = tryPlaceBed();

  if (bed && rng() < FURNITURE_SPAWN_CHANCE.nightstand) {
    const { h: bh } = furnitureFootprint("bed");
    const candidates: number[] = [];
    for (const y of [bed.y - 1, bed.y + bh]) {
      if (y < room.y0 || y > room.y1) continue;
      if (!houseRoomCanPlaceAt(room, occupied, exitX, exitY, room.x0, y, 1, 1)) continue;
      const approaches = furnitureFrontApproachTiles({
        kind: "furniture",
        objectType: "nightstand",
        x: room.x0,
        y,
        facing: "SE",
      });
      if (!houseRoomApproachClear(room, occupied, exitX, exitY, approaches)) continue;
      candidates.push(y);
    }
    if (candidates.length > 0) {
      const y = candidates[Math.floor(rng() * candidates.length)]!;
      markHouseRoomOccupied(occupied, room.x0, y, 1, 1);
      for (const t of furnitureFrontApproachTiles({ kind: "furniture", objectType: "nightstand", x: room.x0, y, facing: "SE" })) {
        occupied.add(`${t.x},${t.y}`);
      }
      furnitures.push({
        id: interiorSearchableId(bx, by, "furniture", idx++),
        kind: "furniture",
        objectType: "nightstand",
        x: room.x0,
        y,
        searched: false,
        buildingX: bx,
        buildingY: by,
        facing: "SE",
      });
    }
  }

  for (const type of ["dresser", "drawers", "guncabinet", "armchair"] as const) {
    const placed = placeHouseWallItem(room, type, bx, by, exitX, exitY, rng, occupied, idx);
    if (placed) {
      furnitures.push(placed);
      idx++;
    }
  }

  if (furnitures.length === 0) {
    const options: ("dresser" | "drawers" | "armchair" | "bed")[] = [
      "dresser",
      "drawers",
      "armchair",
      "bed",
    ];
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = options[i]!;
      options[i] = options[j]!;
      options[j] = tmp;
    }
    for (const type of options) {
      if (type === "bed") {
        if (tryPlaceBed()) break;
        continue;
      }
      const placed = placeHouseWallItem(
        room,
        type,
        bx,
        by,
        exitX,
        exitY,
        rng,
        occupied,
        idx,
        true,
      );
      if (placed) {
        furnitures.push(placed);
        idx++;
        break;
      }
    }
  }

  return furnitures;
}

/** KitchenSink1 always on the exterior wall; optional fridge; DinnerTable1 opposite. */
function placeKitchenFurniture(
  room: HouseRoom,
  bx: number,
  by: number,
  exitX: number,
  exitY: number,
  rng: () => number,
  occupied: Set<string>,
  startIndex: number,
): SearchableObject[] {
  const furnitures: SearchableObject[] = [];
  let idx = startIndex;

  const facing = room.facing;
  const alongMin = room.facing === "SE" ? room.y0 : room.x0;
  const alongMax = room.facing === "SE" ? room.y1 : room.x1;
  const { w: sw, h: sh } = furnitureFootprint("kitchensink", facing);
  const { w: fw, h: fh } = furnitureFootprint("fridge", facing);

  const sinkApproachOk = (x: number, y: number) =>
    houseRoomCanPlaceAt(room, occupied, exitX, exitY, x, y, sw, sh) &&
    houseRoomApproachClear(
      room,
      occupied,
      exitX,
      exitY,
      furnitureFrontApproachTiles({
        kind: "furniture",
        objectType: "kitchensink",
        x,
        y,
        facing,
      }),
    );

  // Wall appliances first so the table never steals their flush slots.
  // Kitchens always get a sink; fridge is optional and prefers a seat beside it.
  let sinkPlaced = false;
  if (rng() < FURNITURE_SPAWN_CHANCE.fridge) {
    const slots: { x: number; y: number }[] = [];
    for (let along = alongMin; along <= alongMax; along++) {
      const pos = houseRoomSlot(room, along);
      if (!houseRoomCanPlaceAt(room, occupied, exitX, exitY, pos.x, pos.y, fw, fh)) {
        continue;
      }
      const approaches = furnitureFrontApproachTiles({
        kind: "furniture",
        objectType: "fridge",
        x: pos.x,
        y: pos.y,
        facing,
      });
      if (!houseRoomApproachClear(room, occupied, exitX, exitY, approaches)) {
        continue;
      }
      const sinkOrigins =
        facing === "SW"
          ? [
              { x: pos.x - sw, y: pos.y },
              { x: pos.x + fw, y: pos.y },
            ]
          : [
              { x: pos.x, y: pos.y - sh },
              { x: pos.x, y: pos.y + fh },
            ];
      if (!sinkOrigins.some((n) => sinkApproachOk(n.x, n.y))) continue;
      slots.push(pos);
    }

    if (slots.length > 0) {
      const pick = slots[Math.floor(rng() * slots.length)]!;
      markHouseRoomOccupied(occupied, pick.x, pick.y, fw, fh);
      for (const t of furnitureFrontApproachTiles({
        kind: "furniture",
        objectType: "fridge",
        x: pick.x,
        y: pick.y,
        facing,
      })) {
        occupied.add(`${t.x},${t.y}`);
      }
      furnitures.push({
        id: interiorSearchableId(bx, by, "furniture", idx++),
        kind: "furniture",
        objectType: "fridge",
        x: pick.x,
        y: pick.y,
        searched: false,
        buildingX: bx,
        buildingY: by,
        facing,
      });

      const sinkOrigins =
        facing === "SW"
          ? [
              { x: pick.x - sw, y: pick.y },
              { x: pick.x + fw, y: pick.y },
            ]
          : [
              { x: pick.x, y: pick.y - sh },
              { x: pick.x, y: pick.y + fh },
            ];
      for (const n of sinkOrigins.sort(() => rng() - 0.5)) {
        if (!sinkApproachOk(n.x, n.y)) continue;
        markHouseRoomOccupied(occupied, n.x, n.y, sw, sh);
        for (const t of furnitureFrontApproachTiles({
          kind: "furniture",
          objectType: "kitchensink",
          x: n.x,
          y: n.y,
          facing,
        })) {
          occupied.add(`${t.x},${t.y}`);
        }
        furnitures.push({
          id: interiorSearchableId(bx, by, "furniture", idx++),
          kind: "furniture",
          objectType: "kitchensink",
          x: n.x,
          y: n.y,
          searched: false,
          buildingX: bx,
          buildingY: by,
          facing,
        });
        sinkPlaced = true;
        break;
      }
    }
  }

  // No fridge (or paired sink failed) — still place a sink on the wall.
  if (!sinkPlaced) {
    const sinkSlots: { x: number; y: number }[] = [];
    for (let along = alongMin; along <= alongMax; along++) {
      const pos = houseRoomSlot(room, along);
      if (!sinkApproachOk(pos.x, pos.y)) continue;
      sinkSlots.push(pos);
    }
    if (sinkSlots.length > 0) {
      const pick = sinkSlots[Math.floor(rng() * sinkSlots.length)]!;
      markHouseRoomOccupied(occupied, pick.x, pick.y, sw, sh);
      for (const t of furnitureFrontApproachTiles({
        kind: "furniture",
        objectType: "kitchensink",
        x: pick.x,
        y: pick.y,
        facing,
      })) {
        occupied.add(`${t.x},${t.y}`);
      }
      furnitures.push({
        id: interiorSearchableId(bx, by, "furniture", idx++),
        kind: "furniture",
        objectType: "kitchensink",
        x: pick.x,
        y: pick.y,
        searched: false,
        buildingX: bx,
        buildingY: by,
        facing,
      });
    }
  }

  // DinnerTable1 after appliances — prefer the far end of the room (toward the
  // door wall), but stay within 1 tile of a room edge so it cannot sit mid-floor
  // and block fridge/sink access.
  if (rng() < FURNITURE_SPAWN_CHANCE.dinnertable) {
    const tableFacings: FurnitureFacing[] =
      room.facing === "SE" ? ["SW", "SE"] : ["SE", "SW"];
    const tableSlots: {
      x: number;
      y: number;
      facing: FurnitureFacing;
      depth: number;
    }[] = [];
    for (const facing of tableFacings) {
      const { w: tw, h: th } = furnitureFootprint("dinnertable", facing);
      for (let y = room.y0; y <= room.y1 - th + 1; y++) {
        for (let x = room.x0; x <= room.x1 - tw + 1; x++) {
          if (!houseRoomCanPlaceAt(room, occupied, exitX, exitY, x, y, tw, th)) {
            continue;
          }
          if (
            !dinnerTableNearBound(
              x,
              y,
              tw,
              th,
              room.x0,
              room.y0,
              room.x1,
              room.y1,
            )
          ) {
            continue;
          }
          const approaches = furnitureFrontApproachTiles({
            kind: "furniture",
            objectType: "dinnertable",
            x,
            y,
            facing,
          });
          if (!houseRoomApproachClear(room, occupied, exitX, exitY, approaches)) {
            continue;
          }
          // SE rooms: appliances on x0 → prefer high x. SW: appliances on y0 → high y.
          const depth =
            room.facing === "SE"
              ? x + tw - 1 - room.x0
              : y + th - 1 - room.y0;
          tableSlots.push({ x, y, facing, depth });
        }
      }
    }
    if (tableSlots.length > 0) {
      let bestDepth = -Infinity;
      for (const s of tableSlots) {
        if (s.depth > bestDepth) bestDepth = s.depth;
      }
      const farSlots = tableSlots.filter((s) => s.depth === bestDepth);
      const pick = farSlots[Math.floor(rng() * farSlots.length)]!;
      const { w: tw, h: th } = furnitureFootprint("dinnertable", pick.facing);
      markHouseRoomOccupied(occupied, pick.x, pick.y, tw, th);
      for (const t of furnitureFrontApproachTiles({
        kind: "furniture",
        objectType: "dinnertable",
        x: pick.x,
        y: pick.y,
        facing: pick.facing,
      })) {
        occupied.add(`${t.x},${t.y}`);
      }
      furnitures.push({
        id: interiorSearchableId(bx, by, "furniture", idx++),
        kind: "furniture",
        objectType: "dinnertable",
        x: pick.x,
        y: pick.y,
        searched: false,
        buildingX: bx,
        buildingY: by,
        facing: pick.facing,
      });
    }
  }

  return furnitures;
}

/** Desk, bookshelf, and a rare gun cabinet, flush against the room's exterior wall. */
function placeOfficeFurniture(
  room: HouseRoom,
  bx: number,
  by: number,
  exitX: number,
  exitY: number,
  rng: () => number,
  occupied: Set<string>,
  startIndex: number,
): SearchableObject[] {
  const furnitures: SearchableObject[] = [];
  let idx = startIndex;
  for (const type of ["desk", "bookshelf", "guncabinet", "armchair", "sofa"] as const) {
    const placed = placeHouseWallItem(room, type, bx, by, exitX, exitY, rng, occupied, idx);
    if (placed) {
      furnitures.push(placed);
      idx++;
    }
  }
  return furnitures;
}

/** Sofa, armchair, then a bag chair. ThreeSeater benches stay hospital-only. */
function placeLivingRoomFurniture(
  room: HouseRoom,
  bx: number,
  by: number,
  exitX: number,
  exitY: number,
  rng: () => number,
  occupied: Set<string>,
  startIndex: number,
): SearchableObject[] {
  const furnitures: SearchableObject[] = [];
  let idx = startIndex;
  for (const type of ["sofa", "armchair", "bagchair"] as const) {
    const placed = placeHouseWallItem(
      room,
      type,
      bx,
      by,
      exitX,
      exitY,
      rng,
      occupied,
      idx,
    );
    if (placed) {
      furnitures.push(placed);
      idx++;
    }
  }
  return furnitures;
}

/**
 * Partitioned town/city house. Vacant shells have no rooms. Every other house
 * has a bedroom and a kitchen. Suitcases still roll on the open floor.
 * `doors` are the room-entrance gap tiles WorldRoom should materialize as
 * real openable doors.
 */
function placeHouseSuitcases(
  bx: number,
  by: number,
  iW: number,
  iH: number,
  exitX: number,
  exitY: number,
  rng: () => number,
  occupied: Set<string>,
  startIndex: number,
): SearchableObject[] {
  const furnitures: SearchableObject[] = [];
  let idx = startIndex;
  const facings: FurnitureFacing[] = ["SE", "SW"];
  for (let n = 0; n < 2; n++) {
    if (rng() >= FURNITURE_SPAWN_CHANCE.suitcase) continue;
    const candidates: { x: number; y: number; facing: FurnitureFacing }[] = [];
    for (let y = 0; y < iH; y++) {
      for (let x = 0; x < iW; x++) {
        for (const facing of facings) {
          const { w, h } = furnitureFootprint("suitcase", facing);
          if (x < 0 || y < 0 || x + w > iW || y + h > iH) continue;
          let blocked = false;
          for (let ty = y; ty < y + h && !blocked; ty++) {
            for (let tx = x; tx < x + w; tx++) {
              if ((tx === exitX && ty === exitY) || occupied.has(`${tx},${ty}`)) {
                blocked = true;
                break;
              }
            }
          }
          if (blocked) continue;
          const approaches = furnitureFrontApproachTiles({
            kind: "furniture",
            objectType: "suitcase",
            x,
            y,
            facing,
          });
          if (approaches.length === 0) continue;
          for (const t of approaches) {
            if (t.x < 0 || t.y < 0 || t.x >= iW || t.y >= iH) {
              blocked = true;
              break;
            }
            if ((t.x === exitX && t.y === exitY) || occupied.has(`${t.x},${t.y}`)) {
              blocked = true;
              break;
            }
          }
          if (blocked) continue;
          candidates.push({ x, y, facing });
        }
      }
    }
    if (candidates.length === 0) break;
    const pick = candidates[Math.floor(rng() * candidates.length)]!;
    furnitures.push({
      id: interiorSearchableId(bx, by, "furniture", idx++),
      kind: "furniture",
      objectType: "suitcase",
      x: pick.x,
      y: pick.y,
      facing: pick.facing,
      searched: false,
      buildingX: bx,
      buildingY: by,
    });
    occupied.add(`${pick.x},${pick.y}`);
    for (const t of furnitureFrontApproachTiles({
      kind: "furniture",
      objectType: "suitcase",
      x: pick.x,
      y: pick.y,
      facing: pick.facing,
    })) {
      occupied.add(`${t.x},${t.y}`);
    }
  }
  return furnitures;
}

function placeHouseRooms(
  bx: number,
  by: number,
  iW: number,
  iH: number,
  exitX: number,
  exitY: number,
  rng: () => number,
  occupied: Set<string>,
  startIndex: number,
): { furnitures: SearchableObject[]; walls: InteriorWallTile[]; doors: { x: number; y: number }[] } {
  const bld = getBuildingAt(bx, by);
  const mantelSpot = bld ? houseMantelSpot(bld) : null;
  const rooms = layoutHouseRooms(
    iW,
    iH,
    interiorExitForBuildingAt(bx, by),
    mantelSpot,
    rng,
  );
  const walls: InteriorWallTile[] = [];
  const doors: { x: number; y: number }[] = [];
  const wallSet = new Set<string>();

  for (const room of rooms) {
    for (const w of room.wallTiles) {
      const key = `${w.x},${w.y}`;
      if (wallSet.has(key)) continue;
      wallSet.add(key);
      walls.push(w);
      occupied.add(key);
    }
    // A doorway into another room stays a real door. The wall around it stays.
    if (room.omitDoor) continue;
    doors.push({ x: room.entranceX, y: room.entranceY });
    // Keep the doorway and the tile just inside it clear so furniture
    // (e.g. kitchen DinnerTable1 parked toward the door wall) never blocks
    // the stand position used to open/close the room door.
    occupied.add(`${room.entranceX},${room.entranceY}`);
    const inside = roomDoorFrontTiles(room).inside;
    if (
      inside.x >= room.x0 &&
      inside.x <= room.x1 &&
      inside.y >= room.y0 &&
      inside.y <= room.y1
    ) {
      occupied.add(`${inside.x},${inside.y}`);
    }
  }

  const mantel = placeHouseMantel(
    bx,
    by,
    iW,
    iH,
    exitX,
    exitY,
    occupied,
    startIndex,
  );
  let furnitures: SearchableObject[] = [...mantel];
  let idx = startIndex + mantel.length;
  // A house with only a bedroom and a hearth used to park the sink beside the
  // bed. Keep kitchen pieces in their own room. Rural cabins stay one room.
  if (!rooms.some((room) => room.role === "kitchen")) {
    const host = rooms.find(
      (room) => room.role !== "bedroom" && room.role !== "livingroom",
    );
    if (host) host.role = "kitchen";
  }
  for (const room of rooms) {
    let placed: SearchableObject[];
    switch (room.role) {
      case "bedroom":
        placed = placeBedroomFurniture(
          room,
          bx,
          by,
          exitX,
          exitY,
          rng,
          occupied,
          idx,
        );
        break;
      case "kitchen":
        placed = placeKitchenFurniture(room, bx, by, exitX, exitY, rng, occupied, idx);
        break;
      case "office":
        placed = placeOfficeFurniture(room, bx, by, exitX, exitY, rng, occupied, idx);
        break;
      default:
        placed = placeLivingRoomFurniture(room, bx, by, exitX, exitY, rng, occupied, idx);
        break;
    }
    furnitures = furnitures.concat(placed);
    idx += placed.length;
  }

  furnitures = furnitures.concat(
    placeHouseSuitcases(bx, by, iW, iH, exitX, exitY, rng, occupied, idx),
  );
  return { furnitures, walls, doors };
}

/**
 * Barracks tent (12×8 interior): cots on the NW wall with a footlocker at
 * each foot, a camp table in the aisle with three camp chairs, door kept
 * clear on the SE gable.
 */
function placeTentBunks(
  bx: number,
  by: number,
  iW: number,
  iH: number,
  exit: InteriorExit,
  occupied: Set<string>,
  startIndex: number,
): SearchableObject[] {
  const furnitures: SearchableObject[] = [];
  let furnitureIndex = startIndex;

  const blocksExit = (tx: number, ty: number): boolean => {
    if (tx === exit.insideX && ty === exit.insideY) return true;
    if (exit.face === "SE") {
      if (tx >= iW - 3 && ty >= exit.alongMin - 1 && ty <= exit.alongMax + 1) {
        return true;
      }
    } else if (ty >= iH - 3 && tx >= exit.alongMin - 1 && tx <= exit.alongMax + 1) {
      return true;
    }
    return false;
  };

  const canPlace = (
    objectType: string,
    ox: number,
    oy: number,
    facing: FurnitureFacing,
    reserveApproach: boolean,
    doorClearance = true,
  ): boolean => {
    const { w, h } = furnitureFootprint(objectType, facing);
    if (ox < 0 || oy < 0 || ox + w > iW || oy + h > iH) return false;
    for (let ty = oy; ty < oy + h; ty++) {
      for (let tx = ox; tx < ox + w; tx++) {
        if (occupied.has(`${tx},${ty}`)) return false;
        if (tx === exit.insideX && ty === exit.insideY) return false;
        if (doorClearance && blocksExit(tx, ty)) return false;
      }
    }
    if (!reserveApproach) return true;
    const approaches = furnitureFrontApproachTiles({
      kind: "furniture",
      objectType,
      x: ox,
      y: oy,
      facing,
    });
    if (approaches.length === 0) return false;
    for (const t of approaches) {
      if (t.x < 0 || t.y < 0 || t.x >= iW || t.y >= iH) return false;
      if (occupied.has(`${t.x},${t.y}`)) return false;
      if (blocksExit(t.x, t.y)) return false;
    }
    return true;
  };

  const commit = (
    objectType: string,
    ox: number,
    oy: number,
    facing?: FurnitureFacing,
    opts?: { reserveApproach?: boolean; doorClearance?: boolean },
  ): boolean => {
    const face = facing ?? furnitureFacing(objectType);
    const reserveApproach = opts?.reserveApproach !== false;
    const doorClearance = opts?.doorClearance !== false;
    if (!canPlace(objectType, ox, oy, face, reserveApproach, doorClearance)) return false;
    const { w, h } = furnitureFootprint(objectType, face);
    for (let ty = oy; ty < oy + h; ty++) {
      for (let tx = ox; tx < ox + w; tx++) {
        occupied.add(`${tx},${ty}`);
      }
    }
    if (reserveApproach) {
      for (const t of furnitureFrontApproachTiles({
        kind: "furniture",
        objectType,
        x: ox,
        y: oy,
        facing: face,
      })) {
        occupied.add(`${t.x},${t.y}`);
      }
    }
    furnitures.push({
      id: interiorSearchableId(bx, by, "furniture", furnitureIndex++),
      kind: "furniture",
      objectType,
      x: ox,
      y: oy,
      searched: false,
      buildingX: bx,
      buildingY: by,
      facing: face,
    });
    return true;
  };

  // Cots on the NW wall, foot toward the aisle. Skip the bed's front
  // reserve so the footlocker can sit on that tile.
  for (const y of [1, 3, 5]) {
    commit("militarybed", 0, y, "SE", { reserveApproach: false });
    commit("footlocker", 2, y, "SE");
  }
  commit("kitbag", 3, 0, "SE");
  commit("kitbag", 3, 6, "SE");
  // Table faces SE; chairs sit on that aisle side (not between bunks and table).
  commit("camptable", 5, 2, "SE", { reserveApproach: false });
  commit("campchair", 6, 2, "SE", { reserveApproach: false });
  commit("campchair", 6, 3, "SE", { reserveApproach: false });
  commit("campchair", 6, 4, "SE", { reserveApproach: false });
  commit("militarybasket", 5, 5, "SE");

  // Beside the table, opposite the chairs (table occupies x=5, y=2 and y=3).
  commit("lantern1", 4, 2, "SE", { reserveApproach: false }) ||
    commit("lantern1", 4, 3, "SE", { reserveApproach: false });

  // Beside the doorway, one tile off the opening. The entrance tile and the step inside stay empty.
  const doorSides =
    exit.face === "SE"
      ? [
          { x: exit.insideX, y: exit.alongMin - 1 },
          { x: exit.insideX, y: exit.alongMax + 1 },
        ]
      : [
          { x: exit.alongMin - 1, y: exit.insideY },
          { x: exit.alongMax + 1, y: exit.insideY },
        ];
  doorSides.sort(
    (a, b) =>
      Math.abs(a.x - exit.insideX) +
      Math.abs(a.y - exit.insideY) -
      (Math.abs(b.x - exit.insideX) + Math.abs(b.y - exit.insideY)),
  );
  for (const spot of doorSides) {
    if (
      commit("lantern1", spot.x, spot.y, "SE", {
        reserveApproach: false,
        doorClearance: false,
      })
    ) {
      break;
    }
  }

  return furnitures;
}

/**
 * Barracks mess hall (16×14 interior): range on the NW wall, serving
 * counters two tiles SE of it, canteen tables in rows toward the door.
 */
function placeMessHall(
  bx: number,
  by: number,
  iW: number,
  iH: number,
  exit: InteriorExit,
  occupied: Set<string>,
  startIndex: number,
  rng: () => number,
): SearchableObject[] {
  const furnitures: SearchableObject[] = [];
  let furnitureIndex = startIndex;

  const blocksExit = (tx: number, ty: number): boolean => {
    if (tx === exit.insideX && ty === exit.insideY) return true;
    if (exit.face === "SE") {
      if (tx >= iW - 3 && ty >= exit.alongMin - 1 && ty <= exit.alongMax + 1) {
        return true;
      }
    } else if (ty >= iH - 3 && tx >= exit.alongMin - 1 && tx <= exit.alongMax + 1) {
      return true;
    }
    return false;
  };

  const canPlace = (
    objectType: string,
    ox: number,
    oy: number,
    facing: FurnitureFacing,
    reserveApproach: boolean,
  ): boolean => {
    const { w, h } = furnitureFootprint(objectType, facing);
    if (ox < 0 || oy < 0 || ox + w > iW || oy + h > iH) return false;
    for (let ty = oy; ty < oy + h; ty++) {
      for (let tx = ox; tx < ox + w; tx++) {
        if (occupied.has(`${tx},${ty}`)) return false;
        if (blocksExit(tx, ty)) return false;
      }
    }
    if (!reserveApproach) return true;
    const approaches = furnitureFrontApproachTiles({
      kind: "furniture",
      objectType,
      x: ox,
      y: oy,
      facing,
    });
    if (approaches.length === 0) return false;
    for (const t of approaches) {
      if (t.x < 0 || t.y < 0 || t.x >= iW || t.y >= iH) return false;
      if (occupied.has(`${t.x},${t.y}`)) return false;
      if (blocksExit(t.x, t.y)) return false;
    }
    return true;
  };

  const commit = (
    objectType: string,
    ox: number,
    oy: number,
    facing?: FurnitureFacing,
    opts?: { reserveApproach?: boolean },
  ): boolean => {
    const face = facing ?? furnitureFacing(objectType);
    const reserveApproach = opts?.reserveApproach !== false;
    if (!canPlace(objectType, ox, oy, face, reserveApproach)) return false;
    const { w, h } = furnitureFootprint(objectType, face);
    for (let ty = oy; ty < oy + h; ty++) {
      for (let tx = ox; tx < ox + w; tx++) {
        occupied.add(`${tx},${ty}`);
      }
    }
    if (reserveApproach) {
      for (const t of furnitureFrontApproachTiles({
        kind: "furniture",
        objectType,
        x: ox,
        y: oy,
        facing: face,
      })) {
        occupied.add(`${t.x},${t.y}`);
      }
    }
    furnitures.push({
      id: interiorSearchableId(bx, by, "furniture", furnitureIndex++),
      kind: "furniture",
      objectType,
      x: ox,
      y: oy,
      searched: false,
      buildingX: bx,
      buildingY: by,
      facing: face,
    });
    return true;
  };

  // Range flush to the NW wall (x = 0), facing the room. Serving line
  // sits two tiles SE, HotDisplay and DrinkDisplay side by side.
  commit("range", 0, 6, "SE");
  commit("hotdisplay", 2, 5, "SE");
  commit("drinkdisplay", 2, 7, "SE");

  for (const x of [6, 9]) {
    for (const y of [2, 6, 10]) {
      const table =
        CANTEEN_TABLE_TYPES[Math.floor(rng() * CANTEEN_TABLE_TYPES.length)]!;
      if (!commit(table, x, y, "SE", { reserveApproach: false })) continue;
      const chairX = x + furnitureFootprint(table, "SE").w;
      commit("canteenchair", chairX, y, "SE", { reserveApproach: false });
      commit("canteenchair", chairX, y + 1, "SE", { reserveApproach: false });
    }
  }

  return furnitures;
}

type AshenMarketFrame = {
  doorOnEast: boolean;
  iW: number;
  iH: number;
  span: number;
  depthMax: number;
  counterDepth: number;
  faceDoor: "SE" | "SW";
  facingNum: number;
};

function ashenMarketFrame(bx: number, by: number): AshenMarketFrame | null {
  if (!isAshenTraderWarehouse(bx, by)) return null;
  const { iW, iH } = interiorDimensions(bx, by);
  const exit = interiorExitForBuildingAt(bx, by);
  const doorOnEast = exit.face === "SE";
  const span = doorOnEast ? iH : iW;
  const depthMax = (doorOnEast ? iW : iH) - 1;
  if (span < 4 || depthMax < 4) return null;
  return {
    doorOnEast,
    iW,
    iH,
    span,
    depthMax,
    counterDepth: depthMax - 3,
    faceDoor: doorOnEast ? "SE" : "SW",
    facingNum: doorOnEast ? 3 : 5,
  };
}

function marketWorldTile(
  frame: AshenMarketFrame,
  depth: number,
  along: number,
): { x: number; y: number } {
  return frame.doorOnEast ? { x: depth, y: along } : { x: along, y: depth };
}

function marketDepthOf(frame: AshenMarketFrame, x: number, y: number): number {
  return frame.doorOnEast ? x : y;
}

export type AshenMarketNpcPost = {
  idSuffix: string;
  kind: "trader" | "exit" | "patrol" | "shelf";
  /** Tile coordinates. */
  x: number;
  y: number;
  patrolX: number;
  patrolY: number;
  facing: number;
  /**
   * Patrol polyline in tile coords. The shelf guard ignores this and
   * wanders the big shelves instead.
   */
  waypoints?: { x: number; y: number }[];
};

/**
 * Axis-aligned depth/along polyline on the trader side of the counter.
 * Returns null when a corner would leave the staff floor.
 */
function marketAxisRoute(
  frame: AshenMarketFrame,
  points: readonly (readonly [number, number])[],
): { x: number; y: number }[] | null {
  if (points.length < 2) return null;
  const alongFar = frame.span - 2;
  if (alongFar < 4) return null;
  const out: { x: number; y: number }[] = [];
  for (const [depth, along] of points) {
    if (along < 1 || along > alongFar) return null;
    if (depth < 1 || depth >= frame.counterDepth) return null;
    out.push(marketWorldTile(frame, depth, along));
  }
  for (let i = 1; i < out.length; i++) {
    const a = out[i - 1]!;
    const b = out[i]!;
    if ((a.x !== b.x && a.y !== b.y) || (a.x === b.x && a.y === b.y)) {
      return null;
    }
  }
  return out;
}

/**
 * Two floor patrols that run most of the warehouse length and turn,
 * plus a start tile in the shelf aisles for the clipboard guard.
 */
function marketGuardRoutes(frame: AshenMarketFrame): {
  shelf: { x: number; y: number } | null;
  patrols: { x: number; y: number }[][];
} {
  const far = frame.span - 2;
  const mid = Math.min(13, far - 2);
  const south = Math.min(18, far);
  const patrolSpecs: readonly (readonly [number, number])[][] = [
    [
      [7, 2],
      [7, 7],
      [10, 7],
      [10, 2],
      [13, 2],
      [13, 7],
      [13, mid],
      [10, mid],
      [10, south],
      [7, south],
      [7, mid],
      [7, 7],
    ],
    [
      [15, 1],
      [15, 6],
      [12, 6],
      [12, 11],
      [15, 11],
      [15, Math.min(16, far)],
      [12, Math.min(16, far)],
      [12, 11],
      [14, 11],
      [14, 6],
      [14, 1],
    ],
  ];
  const patrols: { x: number; y: number }[][] = [];
  for (const spec of patrolSpecs) {
    const route = marketAxisRoute(frame, spec);
    if (route) patrols.push(route);
  }
  const shelf =
    4 >= 1 && 4 <= far && 3 < frame.counterDepth
      ? marketWorldTile(frame, 3, 4)
      : null;
  return { shelf, patrols };
}

/** Trader, exit flanks, and trader-side patrols for the Ashen market. */
export function ashenMarketNpcPosts(bx: number, by: number): AshenMarketNpcPost[] {
  const frame = ashenMarketFrame(bx, by);
  if (!frame) return [];
  const posts: AshenMarketNpcPost[] = [];
  const mid = Math.floor(frame.span / 2);
  const trader = marketWorldTile(frame, frame.counterDepth - 1, mid);
  posts.push({
    idSuffix: "man",
    kind: "trader",
    x: trader.x,
    y: trader.y,
    patrolX: trader.x,
    patrolY: trader.y,
    facing: frame.facingNum,
  });
  // Lobby ends, one tile in from the east wall. 1 = NE, 5 = SW.
  const exitPosts: { x: number; y: number; facing: number }[] = [
    { x: 20, y: 19, facing: 1 },
    { x: 20, y: 0, facing: 5 },
  ];
  exitPosts.forEach((tile, i) => {
    posts.push({
      idSuffix: `exit${i}`,
      kind: "exit",
      x: tile.x,
      y: tile.y,
      patrolX: tile.x,
      patrolY: tile.y,
      facing: tile.facing,
    });
  });
  const routes = marketGuardRoutes(frame);
  if (routes.shelf) {
    posts.push({
      idSuffix: "patrol0",
      kind: "shelf",
      x: routes.shelf.x,
      y: routes.shelf.y,
      patrolX: routes.shelf.x,
      patrolY: routes.shelf.y,
      facing: frame.facingNum,
    });
  }
  routes.patrols.forEach((route, i) => {
    const a = route[0]!;
    const b = route[route.length - 1]!;
    posts.push({
      idSuffix: `patrol${i + 1}`,
      kind: "patrol",
      x: a.x,
      y: a.y,
      patrolX: b.x,
      patrolY: b.y,
      facing: frame.facingNum,
      waypoints: route,
    });
  });
  return posts;
}

/** Trader side of the Ashen market counter. The player lobby is excluded. */
export function isAshenMarketStaffFloor(
  bx: number,
  by: number,
  tx: number,
  ty: number,
): boolean {
  const frame = ashenMarketFrame(bx, by);
  if (!frame) return false;
  if (tx < 0 || ty < 0 || tx >= frame.iW || ty >= frame.iH) return false;
  const depth = marketDepthOf(frame, tx, ty);
  return depth > 0 && depth < frame.counterDepth;
}

/**
 * Stand tile on the player side of the counter, lined up with an NPC
 * who is behind it. NPCs already in the lobby are walked to directly.
 */
export function ashenMarketApproachPoint(
  bx: number,
  by: number,
  npcX: number,
  npcY: number,
): { x: number; y: number } | null {
  const frame = ashenMarketFrame(bx, by);
  if (!frame) return null;
  const tileX = Math.floor(npcX);
  const tileY = Math.floor(npcY);
  const depth = frame.doorOnEast ? tileX : tileY;
  const along = frame.doorOnEast ? tileY : tileX;
  if (depth > frame.counterDepth) return { x: npcX, y: npcY };
  const standAlong = Math.max(0, Math.min(frame.span - 1, along));
  const stand = marketWorldTile(frame, frame.counterDepth + 1, standAlong);
  return { x: stand.x + 0.5, y: stand.y + 0.5 };
}

/**
 * Birchport Ashen trader warehouse.
 * A full row of empty canteen tables seals the player lobby (door side)
 * from the trader floor. Props and patrols stay behind that counter.
 */
function placeAshenTraderMarket(
  bx: number,
  by: number,
  occupied: Set<string>,
): SearchableObject[] {
  const frame = ashenMarketFrame(bx, by);
  if (!frame) return [];
  const furnitures: SearchableObject[] = [];
  let index = 0;

  const markFootprint = (
    objectType: string,
    x: number,
    y: number,
    facing: FurnitureFacing,
  ) => {
    const { w, h } = furnitureFootprint(objectType, facing);
    for (let ty = y; ty < y + h; ty++) {
      for (let tx = x; tx < x + w; tx++) occupied.add(`${tx},${ty}`);
    }
  };

  const canPlace = (
    objectType: string,
    x: number,
    y: number,
    facing: FurnitureFacing,
  ): boolean => {
    const { w, h } = furnitureFootprint(objectType, facing);
    if (x < 0 || y < 0 || x + w > frame.iW || y + h > frame.iH) return false;
    for (let ty = y; ty < y + h; ty++) {
      for (let tx = x; tx < x + w; tx++) {
        if (occupied.has(`${tx},${ty}`)) return false;
      }
    }
    return true;
  };

  const put = (
    objectType: FurnitureType,
    x: number,
    y: number,
    facing: FurnitureFacing,
  ): boolean => {
    if (!canPlace(objectType, x, y, facing)) return false;
    furnitures.push({
      id: interiorSearchableId(bx, by, "furniture", index++),
      kind: "furniture",
      objectType,
      x,
      y,
      searched: false,
      buildingX: bx,
      buildingY: by,
      facing,
    });
    markFootprint(objectType, x, y, facing);
    return true;
  };

  const tile = (depth: number, along: number) =>
    marketWorldTile(frame, depth, along);

  const tableStep = frame.doorOnEast
    ? furnitureFootprint("canteentable4", "SE").h
    : furnitureFootprint("canteentable4", "SW").w;
  for (let along = 0; along < frame.span; ) {
    const origin = tile(frame.counterDepth, along);
    if (
      along + tableStep <= frame.span &&
      put("canteentable4", origin.x, origin.y, frame.faceDoor)
    ) {
      along += tableStep;
      continue;
    }
    if (!put("bigbox", origin.x, origin.y, "SW")) {
      occupied.add(`${origin.x},${origin.y}`);
    }
    along += 1;
  }

  const markSegment = (
    a: { x: number; y: number },
    b: { x: number; y: number },
  ) => {
    const x0 = Math.min(a.x, b.x);
    const x1 = Math.max(a.x, b.x);
    const y0 = Math.min(a.y, b.y);
    const y1 = Math.max(a.y, b.y);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) occupied.add(`${x},${y}`);
    }
  };
  for (const post of ashenMarketNpcPosts(bx, by)) {
    if (post.kind === "shelf") {
      occupied.add(`${post.x},${post.y}`);
      continue;
    }
    const pts =
      post.waypoints && post.waypoints.length >= 2
        ? post.waypoints
        : [
            { x: post.x, y: post.y },
            { x: post.patrolX, y: post.patrolY },
          ];
    occupied.add(`${pts[0]!.x},${pts[0]!.y}`);
    for (let i = 1; i < pts.length; i++) markSegment(pts[i - 1]!, pts[i]!);
  }

  if (frame.doorOnEast) {
    put("lockers", tile(0, 2).x, tile(0, 2).y, "SE");
    put("lockers", tile(0, 6).x, tile(0, 6).y, "SE");
    for (const depth of [2, 5]) {
      for (const along of [2, 6, 10]) {
        const p = tile(depth, along);
        put("bigshelf", p.x, p.y, "SE");
      }
    }
    put("desk", tile(8, 0).x, tile(8, 0).y, "SW");
    put("cabinet", tile(10, 0).x, tile(10, 0).y, "SW");
    const furnaceAlong = frame.span - 3;
    put("furnace", tile(0, furnaceAlong).x, tile(0, furnaceAlong).y, "SE");
    put("bigbox", tile(1, furnaceAlong).x, tile(1, furnaceAlong).y, "SW");
    const bench = tile(8, frame.span - 6);
    put("workbench", bench.x, bench.y, "SE");
  } else {
    put("lockers", tile(0, 2).x, tile(0, 2).y, "SW");
    put("lockers", tile(0, 6).x, tile(0, 6).y, "SW");
    for (const depth of [2, 6]) {
      for (const along of [2, 5, 8]) {
        const p = tile(depth, along);
        put("bigshelf", p.x, p.y, "SE");
      }
    }
    put("desk", tile(0, 12).x, tile(0, 12).y, "SW");
    put("cabinet", tile(0, 14).x, tile(0, 14).y, "SW");
    const furnaceAlong = frame.span - 3;
    put("furnace", tile(0, furnaceAlong).x, tile(0, furnaceAlong).y, "SW");
    put("bigbox", tile(1, furnaceAlong).x, tile(1, furnaceAlong).y, "SW");
    const bench = tile(10, 4);
    put("workbench", bench.x, bench.y, "SE");
  }

  const back = frame.counterDepth - 2;
  const backLine: { along: number; type: FurnitureType; facing: FurnitureFacing }[] = [
    { along: 1, type: "bigbox", facing: "SW" },
    { along: 3, type: "watercontainer", facing: "SW" },
    { along: 5, type: "footlocker", facing: frame.faceDoor },
    { along: 7, type: "kitbag", facing: frame.faceDoor },
    { along: 9, type: "militarybasket", facing: frame.faceDoor },
    { along: 14, type: "footlocker", facing: frame.faceDoor },
    { along: 16, type: "kitbag", facing: frame.faceDoor },
    { along: 18, type: "bigbox", facing: "SW" },
  ];
  for (const item of backLine) {
    const p = tile(back, item.along);
    put(item.type, p.x, p.y, item.facing);
  }

  const staff = frame.counterDepth - 1;
  const mid = Math.floor(frame.span / 2);
  const staffProps: { along: number; type: FurnitureType; facing: FurnitureFacing }[] = [
    { along: mid + 2, type: "campchair", facing: frame.faceDoor },
    { along: mid - 3, type: "footlocker", facing: frame.faceDoor },
    { along: mid + 4, type: "kitbag", facing: frame.faceDoor },
  ];
  for (const item of staffProps) {
    if (item.along < 0 || item.along >= frame.span) continue;
    const p = tile(staff, item.along);
    put(item.type, p.x, p.y, item.facing);
  }

  return furnitures;
}

/**
 * Office meeting room on the back wall, opposite the street door.
 * Depth 6, along 9. The door opens into the bullpen (SE east, SW south).
 * Left or right end of that wall, and SE or SW table facing, are chosen per building.
 * The manager's office sits on the inner side of that room. SW floors that
 * are only 12 or 14 tiles wide shorten the conference room so that office
 * still fits (6 and 8 tiles). The conference table still sits inside it.
 */
const MEET_DEPTH = 6;
const MEET_ALONG = 9;
const MEET_DOOR_AT = 4;
/** Manager's office floor tiles beside the conference room. */
const MGR_ALONG_WIDE = 6;

export type OfficeMeetingRoom = {
  facing: "SE" | "SW";
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  entranceX: number;
  entranceY: number;
  wallTiles: InteriorWallTile[];
};

function meetingRoomWalls(tiles: Iterable<string>): InteriorWallTile[] {
  const wallTiles: InteriorWallTile[] = [];
  for (const key of tiles) {
    const [xs, ys] = key.split(",");
    wallTiles.push({ x: Number(xs), y: Number(ys) });
  }
  return wallTiles;
}

/**
 * Corner room. `back` is the shell opposite the entrance. `side` is which
 * end of that wall. SE rooms open east; SW rooms open south.
 */
function officeMeetAlong(orient: "SE" | "SW", iW: number): number {
  if (orient !== "SW") return MEET_ALONG;
  // Manager's office needs 5 tiles beside the conference room.
  if (iW - MEET_ALONG - 1 >= 5) return MEET_ALONG;
  return iW - 6;
}

function buildOfficeMeetingRoom(
  iW: number,
  iH: number,
  side: "low" | "high",
  orient: "SE" | "SW",
  along: number,
): OfficeMeetingRoom | null {
  const wallSet = new Set<string>();
  if (orient === "SE") {
    const x0 = 0;
    const x1 = MEET_DEPTH - 1;
    const y0 = side === "low" ? 0 : iH - along;
    const y1 = y0 + along - 1;
    if (y0 < 0 || y1 >= iH || x1 + 1 >= iW) return null;
    const doorX = x0 + MEET_DEPTH;
    const doorY = y0 + MEET_DOOR_AT;
    const yClose = side === "low" ? y1 + 1 : y0 - 1;
    const yWall0 = Math.min(y0, yClose);
    const yWall1 = Math.max(y1, yClose);
    for (let y = yWall0; y <= yWall1; y++) {
      if (y === doorY) continue;
      wallSet.add(`${doorX},${y}`);
    }
    for (let x = x0; x <= doorX; x++) wallSet.add(`${x},${yClose}`);
    return {
      facing: "SE",
      x0,
      y0,
      x1,
      y1,
      entranceX: doorX,
      entranceY: doorY,
      wallTiles: meetingRoomWalls(wallSet),
    };
  }
  const y0 = 0;
  const y1 = MEET_DEPTH - 1;
  const x0 = side === "low" ? 0 : iW - along;
  const x1 = x0 + along - 1;
  if (x0 < 0 || x1 >= iW || y1 + 1 >= iH) return null;
  const doorX = x0 + MEET_DOOR_AT;
  const doorY = y0 + MEET_DEPTH;
  const xClose = side === "low" ? x1 + 1 : x0 - 1;
  const xWall0 = Math.min(x0, xClose);
  const xWall1 = Math.max(x1, xClose);
  for (let x = xWall0; x <= xWall1; x++) {
    if (x === doorX) continue;
    wallSet.add(`${x},${doorY}`);
  }
  for (let y = y0; y <= doorY; y++) wallSet.add(`${xClose},${y}`);
  return {
    facing: "SW",
    x0,
    y0,
    x1,
    y1,
    entranceX: doorX,
    entranceY: doorY,
    wallTiles: meetingRoomWalls(wallSet),
  };
}

function meetingLayoutValid(
  back: "west" | "north",
  side: "low" | "high",
  orient: "SE" | "SW",
): boolean {
  // SE rooms sit on the west shell (door opens east). SW rooms sit on the
  // north shell (door opens south). The other end would put the door in the exterior.
  if (back === "west") return orient === "SE" || side === "low";
  return orient === "SW" || side === "low";
}

export function layoutOfficeMeetingRoom(
  bx: number,
  by: number,
): OfficeMeetingRoom | null {
  const { iW, iH } = interiorDimensions(bx, by);
  if (iW < 12 || iH < 16) return null;
  const exit = interiorExitForBuildingAt(bx, by);
  const back = exit.face === "SE" ? "west" : "north";
  const options: { side: "low" | "high"; orient: "SE" | "SW" }[] = [];
  for (const side of ["low", "high"] as const) {
    for (const orient of ["SE", "SW"] as const) {
      if (meetingLayoutValid(back, side, orient)) options.push({ side, orient });
    }
  }
  if (options.length === 0) return null;
  const rng = mulberry32(xmur3(`office_meet_${bx},${by}`)());
  const pick = options[Math.floor(rng() * options.length)]!;
  return buildOfficeMeetingRoom(
    iW,
    iH,
    pick.side,
    pick.orient,
    officeMeetAlong(pick.orient, iW),
  );
}

export function officeMeetingRoomForBuilding(
  bx: number,
  by: number,
): OfficeMeetingRoom | null {
  if (!isOfficeInterior(bx, by)) return null;
  return layoutOfficeMeetingRoom(bx, by);
}

export function officeMeetingRoomAtTile(
  bx: number,
  by: number,
  tx: number,
  ty: number,
): OfficeMeetingRoom | null {
  const room = officeMeetingRoomForBuilding(bx, by);
  if (!room) return null;
  if (tx === room.entranceX && ty === room.entranceY) return room;
  if (tx >= room.x0 && tx <= room.x1 && ty >= room.y0 && ty <= room.y1) {
    return room;
  }
  return null;
}

/** Manager's office. Same shape as the conference room so doors and wall fade match. */
export type OfficeManagerRoom = OfficeMeetingRoom;

function managerSpare(meet: OfficeMeetingRoom, iW: number, iH: number): number {
  if (meet.facing === "SE") {
    return meet.y0 === 0 ? iH - (meet.y1 + 2) : meet.y0 - 1;
  }
  return meet.x0 === 0 ? iW - (meet.x1 + 2) : meet.x0 - 1;
}

/**
 * Walled office on the inner side of the conference room, same depth, door
 * opening the same way into the bullpen. Six tiles along that wall, or five
 * when the floor beside the conference room is only five tiles wide.
 */
function managerRoomBeside(
  meet: OfficeMeetingRoom,
  iW: number,
  iH: number,
): OfficeManagerRoom | null {
  const spare = managerSpare(meet, iW, iH);
  if (spare < 5) return null;
  const along = Math.min(MGR_ALONG_WIDE, spare);
  const doorSide = along >= MGR_ALONG_WIDE ? 4 : 3;
  const wallSet = new Set<string>();
  const add = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= iW || y >= iH) return;
    wallSet.add(`${x},${y}`);
  };

  if (meet.facing === "SE") {
    const x0 = 0;
    const x1 = MEET_DEPTH - 1;
    const doorX = MEET_DEPTH;
    const low = meet.y0 === 0;
    const y0 = low ? meet.y1 + 2 : meet.y0 - 1 - along;
    const y1 = y0 + along - 1;
    if (y0 < 0 || y1 >= iH || doorX >= iW) return null;
    const doorY = y0 + doorSide;
    const sharedY = low ? meet.y1 + 1 : meet.y0 - 1;
    for (let x = x0; x <= doorX; x++) add(x, sharedY);
    const capY = low ? (y1 < iH - 1 ? y1 + 1 : null) : y0 > 0 ? y0 - 1 : null;
    if (capY !== null) {
      for (let x = x0; x <= doorX; x++) add(x, capY);
    }
    const yWall0 = capY !== null && !low ? capY : y0;
    const yWall1 = capY !== null && low ? capY : y1;
    for (let y = yWall0; y <= yWall1; y++) {
      if (y === doorY) continue;
      add(doorX, y);
    }
    return {
      facing: "SE",
      x0,
      y0,
      x1,
      y1,
      entranceX: doorX,
      entranceY: doorY,
      wallTiles: meetingRoomWalls(wallSet),
    };
  }

  const y0 = 0;
  const y1 = MEET_DEPTH - 1;
  const doorY = MEET_DEPTH;
  const low = meet.x0 === 0;
  const x0 = low ? meet.x1 + 2 : meet.x0 - 1 - along;
  const x1 = x0 + along - 1;
  if (x0 < 0 || x1 >= iW || doorY >= iH) return null;
  const doorX = x0 + doorSide;
  const sharedX = low ? meet.x1 + 1 : meet.x0 - 1;
  for (let y = y0; y <= doorY; y++) add(sharedX, y);
  const capX = low ? (x1 < iW - 1 ? x1 + 1 : null) : x0 > 0 ? x0 - 1 : null;
  if (capX !== null) {
    for (let y = y0; y <= doorY; y++) add(capX, y);
  }
  const xWall0 = capX !== null && !low ? capX : x0;
  const xWall1 = capX !== null && low ? capX : x1;
  for (let x = xWall0; x <= xWall1; x++) {
    if (x === doorX) continue;
    add(x, doorY);
  }
  return {
    facing: "SW",
    x0,
    y0,
    x1,
    y1,
    entranceX: doorX,
    entranceY: doorY,
    wallTiles: meetingRoomWalls(wallSet),
  };
}

export function layoutOfficeManagerRoom(
  bx: number,
  by: number,
): OfficeManagerRoom | null {
  const meet = layoutOfficeMeetingRoom(bx, by);
  if (!meet) return null;
  const { iW, iH } = interiorDimensions(bx, by);
  return managerRoomBeside(meet, iW, iH);
}

export function officeManagerRoomForBuilding(
  bx: number,
  by: number,
): OfficeManagerRoom | null {
  if (!isOfficeInterior(bx, by)) return null;
  return layoutOfficeManagerRoom(bx, by);
}

export function officeManagerRoomAtTile(
  bx: number,
  by: number,
  tx: number,
  ty: number,
): OfficeManagerRoom | null {
  const room = officeManagerRoomForBuilding(bx, by);
  if (!room) return null;
  if (tx === room.entranceX && ty === room.entranceY) return room;
  if (tx >= room.x0 && tx <= room.x1 && ty >= room.y0 && ty <= room.y1) {
    return room;
  }
  return null;
}

const STAIR_RUN = 3;

function stairFootprintOverlapsRoom(
  room: { x0: number; y0: number; x1: number; y1: number } | null,
  x: number,
  y: number,
  w: number,
  h: number,
): boolean {
  if (!room) return false;
  return (
    x <= room.x1 &&
    x + w - 1 >= room.x0 &&
    y <= room.y1 &&
    y + h - 1 >= room.y0
  );
}

/** True when every stair tile sits on the shell edge or against a partition. */
function stairRunIsFlush(
  x: number,
  y: number,
  facing: FurnitureFacing,
  walls: InteriorWallTile[],
): boolean {
  const { w, h } = furnitureFootprint("stairs", facing);
  const wallAt = (tx: number, ty: number) =>
    walls.some((wall) => wall.x === tx && wall.y === ty);
  // SW is 2 deep in X and 3 along Y, so the west edge is the wall.
  if (facing === "SW") {
    for (let k = 0; k < h; k++) {
      if (x === 0) continue;
      if (!wallAt(x - 1, y + k)) return false;
    }
    return true;
  }
  // SE is 3 along X and 2 deep in Y, so the north edge is the wall.
  if (facing === "SE") {
    for (let k = 0; k < w; k++) {
      if (y === 0) continue;
      if (!wallAt(x + k, y - 1)) return false;
    }
    return true;
  }
  return false;
}

/**
 * Stair spots for a multi-storey office. The meeting-room door wall comes
 * first (bullpen side, clear of the doorway). Later spots are other
 * partitions, then the west and north shell edges.
 */
function officeStairCandidates(
  room: OfficeMeetingRoom,
  manager: OfficeManagerRoom | null,
  walls: InteriorWallTile[],
  iW: number,
  iH: number,
): { x: number; y: number; facing: FurnitureFacing }[] {
  const out: { x: number; y: number; facing: FurnitureFacing }[] = [];
  const seen = new Set<string>();
  const add = (x: number, y: number, facing: FurnitureFacing) => {
    const { w, h } = furnitureFootprint("stairs", facing);
    if (x < 0 || y < 0 || x + w > iW || y + h > iH) return;
    if (stairFootprintOverlapsRoom(room, x, y, w, h)) return;
    if (stairFootprintOverlapsRoom(manager, x, y, w, h)) return;
    const key = `${x},${y},${facing}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ x, y, facing });
  };
  const pushAlongWall = (
    facing: "SE" | "SW",
    origin: number,
    along0: number,
    along1: number,
    doorAlong: number,
  ) => {
    for (let a = along0; a + STAIR_RUN - 1 <= along1; a++) {
      let nearDoor = false;
      for (let k = 0; k < STAIR_RUN; k++) {
        if (Math.abs(a + k - doorAlong) <= 1) nearDoor = true;
      }
      if (nearDoor) continue;
      // SW runs along Y (vertical wall). SE runs along X (horizontal wall).
      if (facing === "SW") add(origin, a, "SW");
      else add(a, origin, "SE");
    }
  };
  if (room.facing === "SE") {
    pushAlongWall(
      "SW",
      room.entranceX + 1,
      room.y0,
      room.y1,
      room.entranceY,
    );
  } else {
    pushAlongWall(
      "SE",
      room.entranceY + 1,
      room.x0,
      room.x1,
      room.entranceX,
    );
  }
  if (manager) {
    if (manager.facing === "SE") {
      pushAlongWall(
        "SW",
        manager.entranceX + 1,
        manager.y0,
        manager.y1,
        manager.entranceY,
      );
    } else {
      pushAlongWall(
        "SE",
        manager.entranceY + 1,
        manager.x0,
        manager.x1,
        manager.entranceX,
      );
    }
  }
  const wallSet = new Set(walls.map((w) => `${w.x},${w.y}`));
  for (const w of walls) {
    if (
      wallSet.has(`${w.x},${w.y + 1}`) &&
      wallSet.has(`${w.x},${w.y + 2}`)
    ) {
      add(w.x + 1, w.y, "SW");
    }
    if (
      wallSet.has(`${w.x + 1},${w.y}`) &&
      wallSet.has(`${w.x + 2},${w.y}`)
    ) {
      add(w.x, w.y + 1, "SE");
    }
  }
  for (let y = 0; y + STAIR_RUN <= iH; y++) add(0, y, "SW");
  for (let x = 0; x + STAIR_RUN <= iW; x++) add(x, 0, "SE");
  return out;
}

/** Chance a stockroom shelf slot is filled. The slot itself stays on the grid. */
const OFFICE_LOFT_SHELF_CHANCE = 0.25;
/** Chance a stockroom crate slot is filled. */
const OFFICE_LOFT_BOX_CHANCE = 0.1;

/**
 * Upstairs stockroom. Shelf columns face east, crates sit on the east side,
 * and one open band connects the aisles to the stair landing.
 * Each shelf slot is filled 25% of the time, each crate slot 10%.
 */
function placeOfficeUpstairs(
  bx: number,
  by: number,
  iW: number,
  iH: number,
  exit: InteriorExit,
  stair: SearchableObject,
  startIndex: number,
  rng: () => number,
): SearchableObject[] {
  const reserved = new Set<string>();
  const solid = new Set<string>();
  const block = (tx: number, ty: number, asSolid: boolean) => {
    if (tx < 0 || ty < 0 || tx >= iW || ty >= iH) return;
    reserved.add(`${tx},${ty}`);
    if (asSolid) solid.add(`${tx},${ty}`);
  };
  const { w: stairW, h: stairH } = furnitureFootprint("stairs", stair.facing);
  for (let ty = stair.y; ty < stair.y + stairH; ty++) {
    for (let tx = stair.x; tx < stair.x + stairW; tx++) block(tx, ty, true);
  }
  const landing = furnitureFrontApproachTiles({
    kind: "furniture",
    objectType: "stairs",
    x: stair.x,
    y: stair.y,
    facing: stair.facing,
  });
  for (const t of landing) block(t.x, t.y, false);
  // A one-tile lane around the flight, so a shelf or crate cannot seal the landing.
  const ring = (tx: number, ty: number) => {
    block(tx + 1, ty, false);
    block(tx - 1, ty, false);
    block(tx, ty + 1, false);
    block(tx, ty - 1, false);
  };
  for (let ty = stair.y; ty < stair.y + stairH; ty++) {
    for (let tx = stair.x; tx < stair.x + stairW; tx++) ring(tx, ty);
  }
  for (const t of landing) ring(t.x, t.y);
  if (exit.face === "SE") {
    for (let ty = exit.alongMin; ty <= exit.alongMax; ty++) block(iW - 1, ty, false);
  } else {
    for (let tx = exit.alongMin; tx <= exit.alongMax; tx++) block(tx, iH - 1, false);
  }

  let band = Math.floor((iH - 2) / 2);
  if (band % 2 !== 0) band -= 1;
  if (band < 2) band = 2;

  const drafted: {
    type: FurnitureType;
    x: number;
    y: number;
    facing: FurnitureFacing;
  }[] = [];
  const canPut = (
    type: FurnitureType,
    x: number,
    y: number,
    facing: FurnitureFacing,
  ): boolean => {
    const { w, h } = furnitureFootprint(type, facing);
    if (x < 0 || y < 0 || x + w > iW || y + h > iH) return false;
    for (let ty = y; ty < y + h; ty++) {
      for (let tx = x; tx < x + w; tx++) {
        if (reserved.has(`${tx},${ty}`) || solid.has(`${tx},${ty}`)) return false;
      }
    }
    const approaches = furnitureFrontApproachTiles({
      kind: "furniture",
      objectType: type,
      x,
      y,
      facing,
    });
    if (approaches.length === 0) return false;
    for (const t of approaches) {
      if (t.x < 0 || t.y < 0 || t.x >= iW || t.y >= iH) return false;
      if (solid.has(`${t.x},${t.y}`)) return false;
    }
    return true;
  };
  const take = (
    type: FurnitureType,
    x: number,
    y: number,
    facing: FurnitureFacing,
  ) => {
    const { w, h } = furnitureFootprint(type, facing);
    for (let ty = y; ty < y + h; ty++) {
      for (let tx = x; tx < x + w; tx++) block(tx, ty, true);
    }
    for (const t of furnitureFrontApproachTiles({
      kind: "furniture",
      objectType: type,
      x,
      y,
      facing,
    })) {
      block(t.x, t.y, false);
    }
    drafted.push({ type, x, y, facing });
  };

  const lastShelf = Math.floor((iW - 5) / 3) * 3;
  for (let x = 0; x <= lastShelf; x += 3) {
    for (let y = 0; y + 2 <= iH; y += 2) {
      if (y === band) continue;
      if (!canPut("bigshelf", x, y, "SE")) continue;
      if (rng() < OFFICE_LOFT_SHELF_CHANCE) take("bigshelf", x, y, "SE");
    }
  }
  const boxStart = lastShelf + 3;
  for (let x = boxStart; x < iW; x++) {
    for (let y = 0; y + 1 < iH; y += 2) {
      if (y === band) continue;
      if (!canPut("bigbox", x, y, "SW")) continue;
      if (rng() < OFFICE_LOFT_BOX_CHANCE) take("bigbox", x, y, "SW");
    }
  }

  const seen = new Set<string>();
  const stack = landing.filter(
    (t) => t.x >= 0 && t.y >= 0 && t.x < iW && t.y < iH && !solid.has(`${t.x},${t.y}`),
  );
  while (stack.length > 0) {
    const p = stack.pop()!;
    const key = `${p.x},${p.y}`;
    if (seen.has(key) || solid.has(key)) continue;
    if (p.x < 0 || p.y < 0 || p.x >= iW || p.y >= iH) continue;
    seen.add(key);
    stack.push(
      { x: p.x + 1, y: p.y },
      { x: p.x - 1, y: p.y },
      { x: p.x, y: p.y + 1 },
      { x: p.x, y: p.y - 1 },
    );
  }

  const kept = drafted.filter((piece) =>
    furnitureFrontApproachTiles({
      kind: "furniture",
      objectType: piece.type,
      x: piece.x,
      y: piece.y,
      facing: piece.facing,
    }).some((t) => seen.has(`${t.x},${t.y}`)),
  );
  return kept.map((piece, i) => ({
    id: interiorSearchableId(bx, by, "furniture", startIndex + i),
    kind: "furniture" as const,
    objectType: piece.type,
    x: piece.x,
    y: piece.y,
    searched: false,
    buildingX: bx,
    buildingY: by,
    facing: piece.facing,
    level: 1,
  }));
}

/**
 * Walled meeting room and manager's office on the back wall, then a desk bullpen.
 * ConferenceTable1 already includes its chairs, so OfficeChair1 is only at desks
 * and behind the manager's desk. About one office in five has the table gone.
 * A second storey is a stockroom: a quarter of the shelf slots, a tenth of the crates.
 */
function placeOffice(
  bx: number,
  by: number,
  iW: number,
  iH: number,
  exit: InteriorExit,
  rng: () => number,
  occupied: Set<string>,
  startIndex: number,
): {
  furnitures: SearchableObject[];
  walls: InteriorWallTile[];
  doors: { x: number; y: number }[];
} {
  const room = layoutOfficeMeetingRoom(bx, by);
  if (!room) return { furnitures: [], walls: [], doors: [] };
  let manager: OfficeManagerRoom | null = null;
  let sealManager = false;

  const furnitures: SearchableObject[] = [];
  let furnitureIndex = startIndex;

  for (const w of room.wallTiles) occupied.add(`${w.x},${w.y}`);
  occupied.add(`${room.entranceX},${room.entranceY}`);
  if (room.facing === "SE") {
    occupied.add(`${room.entranceX + 1},${room.entranceY}`);
    occupied.add(`${room.entranceX + 1},${room.entranceY - 1}`);
    occupied.add(`${room.entranceX + 1},${room.entranceY + 1}`);
  } else {
    occupied.add(`${room.entranceX},${room.entranceY + 1}`);
    occupied.add(`${room.entranceX - 1},${room.entranceY + 1}`);
    occupied.add(`${room.entranceX + 1},${room.entranceY + 1}`);
  }

  const inSealedManager = (tx: number, ty: number): boolean =>
    sealManager &&
    !!manager &&
    tx >= manager.x0 &&
    tx <= manager.x1 &&
    ty >= manager.y0 &&
    ty <= manager.y1;

  const blocksExit = (tx: number, ty: number): boolean => {
    if (tx === exit.insideX && ty === exit.insideY) return true;
    if (exit.face === "SE") {
      if (
        tx >= iW - 2 &&
        ty >= exit.alongMin - 1 &&
        ty <= exit.alongMax + 1
      ) {
        return true;
      }
    } else if (
      ty >= iH - 2 &&
      tx >= exit.alongMin - 1 &&
      tx <= exit.alongMax + 1
    ) {
      return true;
    }
    return false;
  };

  const canPlace = (
    objectType: string,
    ox: number,
    oy: number,
    facing: FurnitureFacing,
  ): boolean => {
    const { w, h } = furnitureFootprint(objectType, facing);
    if (ox < 0 || oy < 0 || ox + w > iW || oy + h > iH) return false;
    for (let ty = oy; ty < oy + h; ty++) {
      for (let tx = ox; tx < ox + w; tx++) {
        if (inSealedManager(tx, ty)) return false;
        if (occupied.has(`${tx},${ty}`)) return false;
        if (blocksExit(tx, ty)) return false;
      }
    }
    const approaches = furnitureFrontApproachTiles({
      kind: "furniture",
      objectType,
      x: ox,
      y: oy,
      facing,
    });
    if (approaches.length === 0) return false;
    for (const t of approaches) {
      if (t.x < 0 || t.y < 0 || t.x >= iW || t.y >= iH) return false;
      if (inSealedManager(t.x, t.y)) return false;
      if (occupied.has(`${t.x},${t.y}`)) return false;
      if (blocksExit(t.x, t.y)) return false;
    }
    return true;
  };

  const commit = (
    objectType: FurnitureType,
    ox: number,
    oy: number,
    facing: FurnitureFacing,
  ): boolean => {
    if (!canPlace(objectType, ox, oy, facing)) return false;
    const { w, h } = furnitureFootprint(objectType, facing);
    for (let ty = oy; ty < oy + h; ty++) {
      for (let tx = ox; tx < ox + w; tx++) occupied.add(`${tx},${ty}`);
    }
    for (const t of furnitureFrontApproachTiles({
      kind: "furniture",
      objectType,
      x: ox,
      y: oy,
      facing,
    })) {
      occupied.add(`${t.x},${t.y}`);
    }
    furnitures.push({
      id: interiorSearchableId(bx, by, "furniture", furnitureIndex++),
      kind: "furniture",
      objectType,
      x: ox,
      y: oy,
      searched: false,
      buildingX: bx,
      buildingY: by,
      facing,
    });
    return true;
  };

  const rx = room.x0;
  const ry = room.y0;
  const stripped = rng() < 0.22;
  if (room.facing === "SE") {
    commit("whiteboard", rx + 2, ry, "SW");
    commit("cabinet", rx, ry + 1, "SE");
    commit("cabinet", rx, ry + 2, "SE");
    if (!stripped) commit("conferencetable", rx + 1, ry + 3, "SE");
  } else {
    const meetAlong = room.x1 - room.x0 + 1;
    commit("cabinet", rx, ry, "SW");
    if (meetAlong <= 6) {
      // Table shifts west so it still fits. The south cabinet replaces the
      // second north one, whose approach would land on the table.
      commit("cabinet", rx, ry + 5, "SE");
      if (!stripped) commit("conferencetable", rx + 1, ry + 1, "SW");
    } else {
      commit("whiteboard", rx, ry + 2, "SE");
      commit("cabinet", rx + 1, ry, "SW");
      if (!stripped) commit("conferencetable", rx + 2, ry + 1, "SW");
    }
  }

  manager = managerRoomBeside(room, iW, iH);
  if (manager) {
    const wallKeys = new Set<string>();
    for (const w of room.wallTiles) wallKeys.add(`${w.x},${w.y}`);
    for (const w of manager.wallTiles) {
      wallKeys.add(`${w.x},${w.y}`);
      occupied.add(`${w.x},${w.y}`);
    }
    occupied.add(`${manager.entranceX},${manager.entranceY}`);
    if (manager.facing === "SE") {
      occupied.add(`${manager.entranceX + 1},${manager.entranceY}`);
      occupied.add(`${manager.entranceX + 1},${manager.entranceY - 1}`);
      occupied.add(`${manager.entranceX + 1},${manager.entranceY + 1}`);
    } else {
      occupied.add(`${manager.entranceX},${manager.entranceY + 1}`);
      occupied.add(`${manager.entranceX - 1},${manager.entranceY + 1}`);
      occupied.add(`${manager.entranceX + 1},${manager.entranceY + 1}`);
    }

    const along =
      manager.facing === "SE"
        ? manager.y1 - manager.y0 + 1
        : manager.x1 - manager.x0 + 1;
    const tileAt = (back: number, side: number) =>
      manager!.facing === "SE"
        ? { x: manager!.x0 + back, y: manager!.y0 + side }
        : { x: manager!.x0 + side, y: manager!.y0 + back };
    const backFace: FurnitureFacing = manager.facing === "SE" ? "SE" : "SW";
    const lowFace: FurnitureFacing = manager.facing === "SE" ? "SW" : "SE";
    // Guests and the desk face along the room, toward the boss. One empty
    // tile sits between the armchairs and the desk. The boss faces back.
    const deskFace: FurnitureFacing = backFace;
    const bossFace: FurnitureFacing = deskFace === "SE" ? "NW" : "NE";

    const placeChair = (
      objectType: "armchair" | "officechair",
      x: number,
      y: number,
      facing: FurnitureFacing,
      freeFootprint: boolean,
    ): boolean => {
      const key = `${x},${y}`;
      if (freeFootprint) occupied.delete(key);
      if (x < 0 || y < 0 || x >= iW || y >= iH || occupied.has(key)) {
        if (freeFootprint) occupied.add(key);
        return false;
      }
      const { dx, dy } = ISO_FACING_TILE_DELTA[facing];
      const behindX = x - dx;
      const behindY = y - dy;
      const behindKey = `${behindX},${behindY}`;
      if (
        behindX < 0 ||
        behindY < 0 ||
        behindX >= iW ||
        behindY >= iH ||
        wallKeys.has(behindKey) ||
        blocksExit(behindX, behindY)
      ) {
        if (freeFootprint) occupied.add(key);
        return false;
      }
      occupied.add(key);
      occupied.add(behindKey);
      furnitures.push({
        id: interiorSearchableId(bx, by, "furniture", furnitureIndex++),
        kind: "furniture",
        objectType,
        x,
        y,
        searched: false,
        buildingX: bx,
        buildingY: by,
        facing,
      });
      return true;
    };

    // Guests sit one tile off the desk, on its back side. Sides 1 and 2 are
    // that pair. Side 0 stays open so the gap and the desk can be reached.
    const commitAt = (
      type: FurnitureType,
      spots: { back: number; side: number; facing: FurnitureFacing }[],
    ): boolean => {
      for (const spot of spots) {
        if (spot.side < 0 || spot.side >= along) continue;
        if (spot.back < 0 || spot.back >= MEET_DEPTH) continue;
        const at = tileAt(spot.back, spot.side);
        if (commit(type, at.x, at.y, spot.facing)) return true;
      }
      return false;
    };
    commitAt("bookshelf", [{ back: 0, side: 0, facing: backFace }]);
    commitAt("cabinet", [
      { back: 0, side: 3, facing: backFace },
      { back: 0, side: 4, facing: backFace },
    ]);
    commitAt("cabinet", [
      { back: 0, side: 4, facing: backFace },
      { back: 0, side: 5, facing: backFace },
    ]);
    commitAt("watercooler", [
      { back: 5, side: 0, facing: lowFace },
      { back: 0, side: 5, facing: backFace },
    ]);
    const armA = tileAt(1, 1);
    const armB = tileAt(1, 2);
    placeChair("armchair", armA.x, armA.y, deskFace, false);
    placeChair("armchair", armB.x, armB.y, deskFace, false);
    const desk = tileAt(3, 1);
    if (commit("desk3", desk.x, desk.y, deskFace)) {
      const boss = tileAt(4, 2);
      placeChair("officechair", boss.x, boss.y, bossFace, true);
      // Share an edge with the desk. The far end of the footprint, never a corner.
      commitAt("trashcan", [
        { back: 3, side: 3, facing: lowFace },
        { back: 3, side: 0, facing: backFace },
      ]);
    }
    sealManager = true;
  }

  let upstairsStair: SearchableObject | null = null;
  if ((getBuildingAt(bx, by)?.exteriorLevels ?? 1) >= 2) {
    const partitionWalls = [
      ...room.wallTiles,
      ...(manager?.wallTiles ?? []),
    ];
    const stairSpots = officeStairCandidates(
      room,
      manager,
      partitionWalls,
      iW,
      iH,
    );
    for (const spot of stairSpots) {
      if (!stairRunIsFlush(spot.x, spot.y, spot.facing, partitionWalls)) {
        continue;
      }
      if (!commit("stairs", spot.x, spot.y, spot.facing)) continue;
      const placed = furnitures[furnitures.length - 1];
      if (!placed) break;
      upstairsStair = {
        ...placed,
        id: interiorSearchableId(bx, by, "furniture", furnitureIndex++),
        level: 1,
      };
      furnitures.push(upstairsStair);
      break;
    }
  }

  const onRoomNorth = (x: number) =>
    (room.y0 === 0 && x >= room.x0 && x <= room.x1 + 1) ||
    (!!manager && manager.y0 === 0 && x >= manager.x0 && x <= manager.x1 + 1);
  const placeOnNorth = (objectType: FurnitureType): boolean => {
    const wallFacing: FurnitureFacing = "SW";
    const { w } = furnitureFootprint(objectType, wallFacing);
    for (let x = 1; x + w < iW; x++) {
      let blocked = false;
      for (let dx = 0; dx < w; dx++) {
        const tx = x + dx;
        if (occupied.has(`${tx},0`) || onRoomNorth(tx)) blocked = true;
      }
      if (blocked) continue;
      if (commit(objectType, x, 0, wallFacing)) return true;
    }
    return false;
  };
  if (!placeOnNorth("copier")) {
    for (let y = 1; y < iH - 1; y++) {
      if (room.x0 === 0 && y >= room.y0 && y <= room.y1 + 1) continue;
      if (manager && manager.x0 === 0 && y >= manager.y0 && y <= manager.y1 + 1) {
        continue;
      }
      if (commit("copier", 0, y, "SE")) break;
    }
  }
  placeOnNorth("cabinet");
  placeOnNorth("cabinet");
  placeOnNorth("watercooler");
  if (rng() < 0.55) placeOnNorth("vendingmachine");
  if (rng() < 0.7) placeOnNorth("bookshelf2");

  // Desk rows on the open side of the conference room and the manager's
  // office. Desk3 is 2 tiles wide, then a 2-tile gap. The block is one solid
  // rectangle. SE rooms sit on the west wall, so the columns start at the
  // east wall and step west. SW rooms sit on the north wall, so the rows
  // start at the south wall and step north. Half the desks get an
  // OfficeChair1 on a tile they face. The chair faces the desk.
  const facing: FurnitureFacing = "SW";
  const chairFacingFor = (deskFacing: FurnitureFacing): FurnitureFacing =>
    deskFacing === "SE" ? "NW" : "NE";
  const { w: deskW, h: deskH } = furnitureFootprint("desk3", facing);
  const pitchX = deskW + 2;
  const pitchY = deskH + 2;
  const roomsOnWest = room.facing === "SE";
  const openX = roomsOnWest ? room.entranceX + 1 : 2;
  const openY = roomsOnWest ? 2 : room.entranceY + 1;
  type DeskBlock = {
    xs: number[];
    ys: number[];
    desks: number;
    edgeDist: number;
    secondary: number;
  };
  const deskPick: { block: DeskBlock | null } = { block: null };
  const offerDeskBlock = (block: DeskBlock) => {
    if (block.desks <= 0) return;
    const current = deskPick.block;
    if (
      !current ||
      block.desks > current.desks ||
      (block.desks === current.desks && block.edgeDist < current.edgeDist) ||
      (block.desks === current.desks &&
        block.edgeDist === current.edgeDist &&
        block.secondary < current.secondary)
    ) {
      deskPick.block = block;
    }
  };
  if (roomsOnWest) {
    const rowFits = (xs: number[], y: number) => {
      for (const x of xs) {
        if (!canPlace("desk3", x, y, facing)) return false;
      }
      return true;
    };
    for (let anchor = iW - deskW; anchor >= openX; anchor--) {
      const cols: number[] = [];
      for (let x = anchor; x >= openX; x -= pitchX) cols.push(x);
      const edgeDist = iW - deskW - anchor;
      for (let phase = 0; phase < pitchY; phase++) {
        const rows: number[] = [];
        for (let y = openY + phase; y + deskH <= iH; y += pitchY) rows.push(y);
        for (let k = 1; k <= cols.length; k++) {
          const xs = cols.slice(0, k);
          let runStart = -1;
          const finish = (end: number) => {
            if (runStart < 0) return;
            const ys = rows.slice(runStart, end);
            offerDeskBlock({
              xs,
              ys,
              desks: xs.length * ys.length,
              edgeDist,
              secondary: ys[0] ?? 0,
            });
            runStart = -1;
          };
          for (let i = 0; i <= rows.length; i++) {
            if (i < rows.length && rowFits(xs, rows[i]!)) {
              if (runStart < 0) runStart = i;
            } else {
              finish(i);
            }
          }
        }
      }
    }
  } else {
    const colFits = (x: number, ys: number[]) => {
      for (const y of ys) {
        if (!canPlace("desk3", x, y, facing)) return false;
      }
      return true;
    };
    for (let anchor = iH - deskH; anchor >= openY; anchor--) {
      const rows: number[] = [];
      for (let y = anchor; y >= openY; y -= pitchY) rows.push(y);
      const edgeDist = iH - deskH - anchor;
      for (let phase = 0; phase < pitchX; phase++) {
        const cols: number[] = [];
        for (let x = openX + phase; x + deskW <= iW; x += pitchX) cols.push(x);
        for (let k = 1; k <= rows.length; k++) {
          const ys = rows.slice(0, k);
          let runStart = -1;
          const finish = (end: number) => {
            if (runStart < 0) return;
            const xs = cols.slice(runStart, end);
            offerDeskBlock({
              xs,
              ys,
              desks: xs.length * ys.length,
              edgeDist,
              secondary: xs[0] ?? 0,
            });
            runStart = -1;
          };
          for (let i = 0; i <= cols.length; i++) {
            if (i < cols.length && colFits(cols[i]!, ys)) {
              if (runStart < 0) runStart = i;
            } else {
              finish(i);
            }
          }
        }
      }
    }
  }
  const deskBlock = deskPick.block;
  if (deskBlock) {
    for (const y of deskBlock.ys) {
      for (const x of deskBlock.xs) {
        if (!commit("desk3", x, y, facing)) continue;
        if (rng() >= 0.5) continue;
        const { dx, dy } = ISO_FACING_TILE_DELTA[facing];
        const front: { x: number; y: number }[] = [];
        for (let ty = y; ty < y + deskH; ty++) {
          for (let tx = x; tx < x + deskW; tx++) {
            front.push({ x: tx + dx, y: ty + dy });
          }
        }
        const spot = front[Math.floor(rng() * front.length)];
        if (!spot) continue;
        // The desk reserves both front tiles. Free the chosen one for the chair.
        // The chair faces back at the desk, so its front tile is the desk.
        // Keep the tile behind the chair clear so it can still be searched.
        const chairFacing = chairFacingFor(facing);
        const key = `${spot.x},${spot.y}`;
        const back = { x: spot.x + dx, y: spot.y + dy };
        const backKey = `${back.x},${back.y}`;
        occupied.delete(key);
        const backOk =
          back.x >= 0 &&
          back.y >= 0 &&
          back.x < iW &&
          back.y < iH &&
          !occupied.has(backKey) &&
          !blocksExit(back.x, back.y);
        if (
          spot.x < 0 ||
          spot.y < 0 ||
          spot.x >= iW ||
          spot.y >= iH ||
          occupied.has(key) ||
          blocksExit(spot.x, spot.y) ||
          !backOk
        ) {
          occupied.add(key);
          continue;
        }
        occupied.add(key);
        occupied.add(backKey);
        furnitures.push({
          id: interiorSearchableId(bx, by, "furniture", furnitureIndex++),
          kind: "furniture",
          objectType: "officechair",
          x: spot.x,
          y: spot.y,
          searched: false,
          buildingX: bx,
          buildingY: by,
          facing: chairFacing,
        });
      }
    }
  }

  // Same 25% desk-side bin as the police bullpen. SW desks get it on the SE side.
  const deskCans = placePoliceTrashCans(
    bx,
    by,
    iW,
    iH,
    exit,
    furnitures.filter(
      (f) =>
        f.objectType === "desk3" &&
        !(
          manager &&
          f.x >= manager.x0 &&
          f.x <= manager.x1 &&
          f.y >= manager.y0 &&
          f.y <= manager.y1
        ),
    ),
    furnitures,
    occupied,
    furnitureIndex,
    rng,
    blocksExit,
  );
  furnitures.push(...deskCans);

  if (upstairsStair) {
    furnitures.push(
      ...placeOfficeUpstairs(
        bx,
        by,
        iW,
        iH,
        exit,
        upstairsStair,
        furnitureIndex + deskCans.length,
        rng,
      ),
    );
  }

  const walls: InteriorWallTile[] = [];
  const seenWall = new Set<string>();
  const addWall = (w: InteriorWallTile) => {
    const key = `${w.x},${w.y}`;
    if (seenWall.has(key)) return;
    seenWall.add(key);
    walls.push(w);
  };
  for (const w of room.wallTiles) addWall(w);
  if (manager) {
    for (const w of manager.wallTiles) addWall(w);
  }
  const doors = [{ x: room.entranceX, y: room.entranceY }];
  if (manager) doors.push({ x: manager.entranceX, y: manager.entranceY });
  return { furnitures, walls, doors };
}

const RETAIL_RACKS = ["clothingrack1", "clothingrack2", "clothingrack3"] as const;
const RETAIL_SHELVES = ["retailshelf1", "retailshelf2", "retailshelf3"] as const;
const RETAIL_MANNEQUINS = ["mannequin1", "mannequin2", "mannequin3"] as const;

/**
 * Department store. Gondolas run away from the door, with a clear aisle on
 * the door span. Housewares sit toward the back wall, clothing toward the
 * door. Checkouts flank the aisle. A jewelry case and a watch case sit on
 * the aisle just inside the registers. The back wall is a small furniture
 * display, with mannequins in the cross aisle and a few carts in the walks.
 */
function placeLargeRetail(
  bx: number,
  by: number,
  iW: number,
  iH: number,
  exit: InteriorExit,
  rng: () => number,
  occupied: Set<string>,
  startIndex: number,
): SearchableObject[] {
  const doorEast = exit.face === "SE";
  const aisleFace: FurnitureFacing = doorEast ? "SW" : "SE";
  const wallFace: FurnitureFacing = doorEast ? "SE" : "SW";
  const aisle0 = exit.alongMin;
  const aisle1 = exit.alongMax;
  const runN = doorEast ? iW : iH;
  const rowN = doorEast ? iH : iW;
  const runStart = 3;
  const runLimit = runN - 1;
  const toXY = (run: number, row: number) =>
    doorEast ? { x: run, y: row } : { x: row, y: run };

  const onAisle = (tx: number, ty: number) =>
    doorEast ? ty >= aisle0 && ty <= aisle1 : tx >= aisle0 && tx <= aisle1;

  const blocksEntry = (tx: number, ty: number) => {
    if (!onAisle(tx, ty)) return false;
    if (doorEast) return tx === exit.insideX || tx === exit.insideX - 1;
    return ty === exit.insideY || ty === exit.insideY - 1;
  };

  if (doorEast) {
    for (let y = aisle0; y <= aisle1; y++) {
      occupied.add(`${exit.insideX},${y}`);
      occupied.add(`${exit.insideX - 1},${y}`);
    }
  } else {
    for (let x = aisle0; x <= aisle1; x++) {
      occupied.add(`${x},${exit.insideY}`);
      occupied.add(`${x},${exit.insideY - 1}`);
    }
  }

  const frontTiles = (
    type: FurnitureType,
    x: number,
    y: number,
    face: FurnitureFacing,
  ) => {
    const { w, h } = furnitureFootprint(type, face);
    const dx = face === "SE" ? 1 : face === "NW" ? -1 : 0;
    const dy = face === "SW" ? 1 : face === "NE" ? -1 : 0;
    const out: { x: number; y: number }[] = [];
    const seen = new Set<string>();
    for (let ty = y; ty < y + h; ty++) {
      for (let tx = x; tx < x + w; tx++) {
        const ax = tx + dx;
        const ay = ty + dy;
        if (ax >= x && ax < x + w && ay >= y && ay < y + h) continue;
        const key = `${ax},${ay}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ x: ax, y: ay });
      }
    }
    return out;
  };

  const furnitures: SearchableObject[] = [];
  let furnitureIndex = startIndex;

  const canPlace = (
    type: FurnitureType,
    x: number,
    y: number,
    face: FurnitureFacing,
    needApproach = true,
  ) => {
    const { w, h } = furnitureFootprint(type, face);
    if (x < 0 || y < 0 || x + w > iW || y + h > iH) return false;
    for (let ty = y; ty < y + h; ty++) {
      for (let tx = x; tx < x + w; tx++) {
        if (occupied.has(`${tx},${ty}`)) return false;
        if (blocksEntry(tx, ty)) return false;
        if (onAisle(tx, ty)) return false;
      }
    }
    if (!needApproach) return true;
    const approaches = frontTiles(type, x, y, face);
    if (approaches.length === 0) return false;
    for (const t of approaches) {
      if (t.x < 0 || t.y < 0 || t.x >= iW || t.y >= iH) return false;
      if (occupied.has(`${t.x},${t.y}`)) return false;
      if (blocksEntry(t.x, t.y)) return false;
    }
    return true;
  };

  const push = (
    type: FurnitureType,
    x: number,
    y: number,
    face: FurnitureFacing,
    reserveFront = true,
  ) => {
    const { w, h } = furnitureFootprint(type, face);
    furnitures.push({
      id: interiorSearchableId(bx, by, "furniture", furnitureIndex++),
      kind: "furniture",
      objectType: type,
      x,
      y,
      searched: false,
      buildingX: bx,
      buildingY: by,
      facing: face,
    });
    for (let ty = y; ty < y + h; ty++) {
      for (let tx = x; tx < x + w; tx++) occupied.add(`${tx},${ty}`);
    }
    if (!reserveFront) return;
    for (const t of frontTiles(type, x, y, face)) {
      if (t.x >= 0 && t.y >= 0 && t.x < iW && t.y < iH) occupied.add(`${t.x},${t.y}`);
    }
  };

  const placeAt = (
    type: FurnitureType,
    run: number,
    row: number,
    face: FurnitureFacing,
    needApproach = true,
  ) => {
    const pos = toXY(run, row);
    if (!canPlace(type, pos.x, pos.y, face, needApproach)) return false;
    push(type, pos.x, pos.y, face, needApproach);
    return true;
  };

  // Back wall: coolers, a sofa, and a chair. Bed stays on the west wall
  // because Bed1 only has SE art.
  let cursor = doorEast ? 1 : 3;
  const placeWallPiece = (type: FurnitureType) => {
    const { w, h } = furnitureFootprint(type, wallFace);
    const rowSize = doorEast ? h : w;
    let steps = 0;
    while (cursor + rowSize < rowN - 1 && steps < rowN) {
      steps++;
      const pos = toXY(0, cursor);
      if (canPlace(type, pos.x, pos.y, wallFace)) {
        push(type, pos.x, pos.y, wallFace);
        cursor += rowSize + 1;
        return;
      }
      cursor += 1;
    }
  };
  placeWallPiece("superfridge1");
  placeWallPiece("superfridge1");
  placeWallPiece("sofa");
  placeWallPiece("armchair");
  if (doorEast) {
    placeWallPiece("bed");
    for (const x of [3, 5, 7, 9]) {
      if (canPlace("dresser", x, 0, "SW")) {
        push("dresser", x, 0, "SW");
        break;
      }
    }
  } else {
    placeWallPiece("dresser");
    for (let y = 2; y < iH - 2; y++) {
      if (!canPlace("bed", 0, y, "SE")) continue;
      push("bed", 0, y, "SE");
      break;
    }
  }

  const { w: cw, h: ch } = furnitureFootprint("checkout", aisleFace);
  const runSize = doorEast ? cw : ch;
  const rowSize = doorEast ? ch : cw;
  const doorRun = doorEast ? exit.insideX : exit.insideY;
  const checkoutRun = doorRun - 1 - runSize;
  placeAt("checkout", checkoutRun, aisle0 - rowSize, aisleFace);
  placeAt("checkout", checkoutRun, aisle1 + 1, aisleFace);
  // Bins and a vending machine just behind the registers, before gondolas claim that run.
  const behind = checkoutRun - 1;
  if (behind >= runStart) {
    placeAt("trashcan", behind, aisle0 - rowSize, aisleFace);
    placeAt("trashcan", behind, aisle1 + rowSize, aisleFace);
    placeAt("vendingmachine", behind, aisle0 - rowSize - 1, wallFace);
  }

  // Jewelry then watches, glass toward the aisle, just inside the registers.
  const placeCase = (type: FurnitureType) => {
    const { w, h } = furnitureFootprint(type, aisleFace);
    const along = doorEast ? w : h;
    const deep = doorEast ? h : w;
    const rows = [aisle0 - deep, aisle1 + 1];
    for (const row of rows) {
      if (row < 0 || row + deep > rowN) continue;
      for (let run = checkoutRun - along; run >= runStart; run--) {
        if (placeAt(type, run, row, aisleFace)) return;
      }
    }
  };
  placeCase("retailcase1");
  placeCase("retailcase2");

  const runSpan = runLimit - runStart;
  let gap0 = -1;
  let gap1 = -1;
  if (runSpan >= 10) {
    gap0 = runStart + Math.floor(runSpan / 2) - 1;
    gap1 = gap0 + 2;
  }

  let shelfVariant = Math.floor(rng() * RETAIL_SHELVES.length);
  let rackVariant = Math.floor(rng() * RETAIL_RACKS.length);
  const placedRows: number[] = [];

  const placeRun = (
    row: number,
    types: readonly FurnitureType[],
    alongSize: number,
    from: number,
    to: number,
    variant: { n: number },
  ) => {
    let along = from;
    let count = 0;
    while (along + alongSize <= to) {
      const type = types[variant.n % types.length]!;
      if (placeAt(type, along, row, aisleFace)) {
        variant.n++;
        along += alongSize;
        count++;
      } else {
        along += 1;
      }
    }
    return count;
  };

  const placeRow = (row: number) => {
    const mid = Math.floor((runStart + runLimit) / 2);
    const shelfEnd = gap0 >= 0 ? gap0 : mid;
    const rackFrom = gap0 >= 0 ? gap1 : mid;
    // Housewares toward the back wall, clothing toward the door.
    const shelves = placeRun(
      row,
      RETAIL_SHELVES,
      3,
      runStart,
      shelfEnd,
      { n: shelfVariant },
    );
    shelfVariant += shelves;
    const racks = placeRun(
      row,
      RETAIL_RACKS,
      2,
      rackFrom,
      runLimit,
      { n: rackVariant },
    );
    rackVariant += racks;
    if (shelves + racks > 0) placedRows.push(row);
  };

  for (let row = aisle0 - 1; row >= 1; row -= 3) placeRow(row);
  for (let row = aisle1 + 1; row + 1 <= rowN - 2; row += 3) placeRow(row);

  if (gap0 >= 0) {
    let m = 0;
    for (const row of placedRows) {
      if (m >= RETAIL_MANNEQUINS.length) break;
      const type = RETAIL_MANNEQUINS[m]!;
      if (placeAt(type, gap0, row, wallFace)) m++;
    }
  }

  for (const row of placedRows) {
    const cartRow = row + 2;
    if (cartRow >= aisle0 && cartRow <= aisle1) continue;
    if (cartRow < 1 || cartRow >= rowN - 1) continue;
    const type: FurnitureType = rng() < 0.5 ? "cart1" : "cart2";
    const span = Math.max(1, runLimit - runStart);
    for (let n = 0; n < 5; n++) {
      const along = runStart + Math.floor(rng() * span);
      if (gap0 >= 0 && along >= gap0 && along < gap1) continue;
      if (placeAt(type, along, cartRow, aisleFace, false)) break;
    }
  }

  return furnitures;
}

export function generateInteriorContent(bx: number, by: number): {
  furnitures: SearchableObject[];
  zombieSpawns: { x: number; y: number }[];
  walls: InteriorWallTile[];
  /** Room/cubicle entrance gap tiles that become real openable doors. */
  doors: { x: number; y: number }[];
} {
  const { iW, iH } = interiorDimensions(bx, by);
  const exit = interiorExitForBuildingAt(bx, by);
  const exitX = exit.insideX;
  const exitY = exit.insideY;

  const seed = xmur3(`interior_${bx},${by}`);
  const rng = mulberry32(seed());

  const occupied = new Set<string>();
  const warehouse = isWarehouseInterior(bx, by);
  const residential = isResidentialInterior(bx, by);
  const police = isPoliceInterior(bx, by);
  const supermarket = isSupermarketInterior(bx, by);
  const hospital = isHospitalInterior(bx, by);
  const motel = isMotelInterior(bx, by);
  const tent = isTentInterior(bx, by);
  const messHall = isMessHallInterior(bx, by);
  const officeInterior = isOfficeInterior(bx, by);
  const largeRetail = isLargeRetailInterior(bx, by);
  const multiRoomHouse = isMultiRoomHouseInterior(bx, by);
  let furnitures: SearchableObject[];
  let walls: InteriorWallTile[] = [];
  let doors: { x: number; y: number }[] = [];
  if (warehouse && isAshenTraderWarehouse(bx, by)) {
    furnitures = placeAshenTraderMarket(bx, by, occupied);
  } else if (warehouse) {
    const office = placeWarehouseOffice(
      bx,
      by,
      iW,
      iH,
      exitX,
      exitY,
      occupied,
      0,
    );
    const birchport = isBuildingInBirchport(bx, by);
    // Claim the bench before shelves so a Birchport warehouse cannot fill up without one.
    const earlyBench = birchport
      ? placeWarehouseWorkbench(
          bx,
          by,
          iW,
          iH,
          exitX,
          exitY,
          rng,
          occupied,
          office.length,
          true,
        )
      : [];
    const shelves = placeWarehouseShelves(
      bx,
      by,
      iW,
      iH,
      exitX,
      exitY,
      rng,
      occupied,
      office.length + earlyBench.length,
    );
    const lateBench = birchport
      ? []
      : placeWarehouseWorkbench(
          bx,
          by,
          iW,
          iH,
          exitX,
          exitY,
          rng,
          occupied,
          office.length + earlyBench.length + shelves.length,
        );
    const placed = [...office, ...earlyBench, ...shelves, ...lateBench];
    const furnace = placeWarehouseFurnace(
      bx,
      by,
      iW,
      iH,
      exitX,
      exitY,
      rng,
      occupied,
      placed.length,
      placed,
    );
    furnitures = [...placed, ...furnace];
  } else if (multiRoomHouse) {
    const rooms = placeHouseRooms(
      bx,
      by,
      iW,
      iH,
      exitX,
      exitY,
      rng,
      occupied,
      0,
    );
    furnitures = rooms.furnitures;
    walls = rooms.walls;
    doors = rooms.doors;
  } else if (residential) {
    const mantel = placeHouseMantel(
      bx,
      by,
      iW,
      iH,
      exitX,
      exitY,
      occupied,
      0,
    );
    furnitures = mantel.concat(
      placeGenericFurniture(
        bx,
        by,
        iW,
        iH,
        exitX,
        exitY,
        rng,
        occupied,
        mantel.length,
      ),
    );
  } else if (police) {
    const wall = placePoliceWallFurniture(
      bx,
      by,
      iW,
      iH,
      exit,
      rng,
      occupied,
      0,
    );
    const desks = placePoliceBullpen(
      bx,
      by,
      iW,
      iH,
      exit,
      occupied,
      wall.length,
      rng,
    );
    const cooler = placePoliceWaterCooler(
      bx,
      by,
      iW,
      iH,
      exit,
      desks,
      [...wall, ...desks],
      occupied,
      wall.length + desks.length,
      rng,
    );
    const trash = placePoliceTrashCans(
      bx,
      by,
      iW,
      iH,
      exit,
      desks,
      [...wall, ...desks, ...cooler],
      occupied,
      wall.length + desks.length + cooler.length,
      rng,
    );
    const chairs = placePoliceBagChairs(
      bx,
      by,
      iW,
      iH,
      exit,
      desks,
      [...wall, ...desks, ...cooler, ...trash],
      occupied,
      wall.length + desks.length + cooler.length + trash.length,
      rng,
    );
    const officer = placePoliceDeadOfficer(
      bx,
      by,
      iW,
      iH,
      exit,
      desks,
      [...wall, ...desks, ...cooler, ...trash, ...chairs],
      occupied,
      wall.length + desks.length + cooler.length + trash.length + chairs.length,
      rng,
    );
    const vending = placePoliceVendingMachine(
      bx,
      by,
      iW,
      iH,
      exit,
      [...wall, ...desks, ...cooler, ...trash, ...chairs, ...officer],
      occupied,
      wall.length +
        desks.length +
        cooler.length +
        trash.length +
        chairs.length +
        officer.length,
      rng,
    );
    furnitures = [
      ...wall,
      ...desks,
      ...cooler,
      ...trash,
      ...chairs,
      ...officer,
      ...vending,
    ];
  } else if (supermarket) {
    const fridges = placeSupermarketFridges(
      bx,
      by,
      iW,
      iH,
      exit,
      rng,
      occupied,
      0,
    );
    const checkouts = placeSupermarketCheckouts(
      bx,
      by,
      iW,
      iH,
      exit,
      rng,
      occupied,
      fridges.length,
    );
    const shelves = placeSupermarketShelves(
      bx,
      by,
      iW,
      iH,
      exit,
      rng,
      occupied,
      fridges.length + checkouts.length,
    );
    furnitures = [...fridges, ...checkouts, ...shelves];
  } else if (hospital) {
    const ward = placeHospitalWard(bx, by, iW, iH, exit, rng, occupied, 0);
    furnitures = ward.furnitures;
    walls = ward.walls;
    doors = ward.doors;
  } else if (motel) {
    const shell = placeMotelShell(bx, by, iW, iH, exit, rng, occupied, 0);
    furnitures = shell.furnitures;
    walls = shell.walls;
    doors = shell.doors;
  } else if (tent) {
    furnitures = placeTentBunks(bx, by, iW, iH, exit, occupied, 0);
  } else if (messHall) {
    furnitures = placeMessHall(bx, by, iW, iH, exit, occupied, 0, rng);
  } else if (officeInterior) {
    const placed = placeOffice(bx, by, iW, iH, exit, rng, occupied, 0);
    furnitures = placed.furnitures;
    walls = placed.walls;
    doors = placed.doors;
  } else if (largeRetail) {
    furnitures = placeLargeRetail(bx, by, iW, iH, exit, rng, occupied, 0);
  } else {
    // Gun shop, diner, apartment, and untyped shells stay empty until a layout is assigned.
    furnitures = [];
  }

  // Zombie spawns — never on the exit tile or the tile just inside it.
  const zombieSpawns: { x: number; y: number }[] = [];

  const clearFrontX =
    exit.face === "SE" ? exit.insideX - 1 : exit.insideX;
  const clearFrontY =
    exit.face === "SW" ? exit.insideY - 1 : exit.insideY;

  const freeTiles: { x: number; y: number }[] = [];
  for (let ty = 0; ty < iH; ty++) {
    for (let tx = 0; tx < iW; tx++) {
      if (tx === exitX && ty === exitY) continue;
      if (tx === clearFrontX && ty === clearFrontY) continue;
      if (occupied.has(`${tx},${ty}`)) continue;
      freeTiles.push({ x: tx, y: ty });
    }
  }

  // Fisher-Yates — non-deterministic so the same building can roll different
  // zombie counts / tiles each time its interior is generated.
  for (let i = freeTiles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = freeTiles[i]!;
    freeTiles[i] = freeTiles[j]!;
    freeTiles[j] = tmp;
  }

  const maxZombies = freeTiles.length;

  // Faction buildings stay clear: hospital, Red Order markets, the Ashen trader warehouse.
  const suppressZombies =
    (hospital && isBirchportHospital(bx, by)) ||
    (supermarket && isRedOrderOwnedSupermarket(bx, by)) ||
    (warehouse && isAshenTraderWarehouse(bx, by)) ||
    tent ||
    messHall;

  // 25% chance of a completely empty building
  if (!suppressZombies && Math.random() >= 0.25 && maxZombies > 0) {
    // Quadratic weighting (rng² heavily favours low counts) — density is
    // based on a reference room size, not total free tiles in oversized lots.
    const densityTiles = Math.min(maxZombies, INTERIOR_ZOMBIE_DENSITY_REF_TILES);
    let numZombies = Math.max(
      1,
      Math.ceil(densityTiles * Math.random() * Math.random()),
    );
    if (residential) numZombies = Math.min(numZombies, RESIDENTIAL_ZOMBIE_MAX);
    const count = Math.min(numZombies, maxZombies);
    for (let i = 0; i < count; i++) {
      const tile = freeTiles[i]!;
      zombieSpawns.push({ x: tile.x + 0.5, y: tile.y + 0.5 });
    }
  }

  return { furnitures, zombieSpawns, walls, doors };
}

// ─── Furniture collision ───────────────────────────────────────────────────

/** True when (x, y) sits on a furniture tile (full tile blocked, like trees). */
function isBlockedByFurniture(
  x: number,
  y: number,
  furnitures: SearchableObject[],
): boolean {
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  for (const f of furnitures) {
    // Floor bags are walkable loot piles.
    if (f.objectType === "groundbackpack") continue;
    if (searchableOccupiesTile(f, tx, ty)) return true;
  }
  return false;
}

function isBlockedByWall(
  x: number,
  y: number,
  walls: InteriorWallTile[] | undefined,
): boolean {
  return interiorWallOccupiesTile(walls, Math.floor(x), Math.floor(y));
}

/** True when an interior partition occupies tile (tx, ty). */
export function interiorWallOccupiesTile(
  walls: InteriorWallTile[] | undefined,
  tx: number,
  ty: number,
): boolean {
  if (!walls || walls.length === 0) return false;
  for (const w of walls) {
    if (w.x === tx && w.y === ty) return true;
  }
  return false;
}

// ─── Collision API ─────────────────────────────────────────────────────────

/** Returns true when (x, y) is a valid, unobstructed interior position. */
export function canMoveInInterior(
  x: number,
  y: number,
  furnitures: SearchableObject[],
  iW = INTERIOR_WIDTH,
  iH = INTERIOR_HEIGHT,
  exit?: InteriorExit,
  walls?: InteriorWallTile[],
  sealExit = false,
): boolean {
  // Allow the exit corridor: one tile beyond the doorway wall.
  // Upper floors seal it so the player cannot walk out the street door.
  if (!sealExit) {
    if (exit) {
      const fx = Math.floor(x);
      const fy = Math.floor(y);
      if (exit.face === "SE") {
        if (fx === exit.outsideX && fy >= exit.alongMin && fy <= exit.alongMax) {
          return true;
        }
      } else if (fy === exit.outsideY && fx >= exit.alongMin && fx <= exit.alongMax) {
        return true;
      }
    } else if (x >= iW && x < iW + 1 && y >= 1 && y < 2) {
      return true;
    }
  }
  if (x < 0 || y < 0 || x >= iW || y >= iH) return false;
  if (isBlockedByWall(x, y, walls)) return false;
  return !isBlockedByFurniture(x, y, furnitures);
}

/**
 * Deterministic interior wall tiles for a building (same seed as generation).
 * Safe for clients to call for rendering / local pathfinding.
 */
export function interiorWallsForBuilding(
  bx: number,
  by: number,
  level = 0,
): InteriorWallTile[] {
  if (level > 0) return [];
  return generateInteriorContent(bx, by).walls;
}

/** Clamp a saved storey to the building's exterior floor count. */
export function clampInteriorLevel(
  bx: number,
  by: number,
  level: number,
): number {
  const floors = getBuildingAt(bx, by)?.exteriorLevels ?? 1;
  const max = Math.max(0, floors - 1);
  if (!Number.isFinite(level)) return 0;
  return Math.max(0, Math.min(Math.floor(level), max));
}

/** Contiguous partition run — used so tall N/S walls share one iso depth. */
export type InteriorWallRun =
  | { axis: "ns"; x: number; y0: number; y1: number }
  | { axis: "ew"; y: number; x0: number; x1: number };

function wallParticipatesNS(wallSet: Set<string>, x: number, y: number): boolean {
  if (!wallSet.has(`${x},${y}`)) return false;
  return wallSet.has(`${x},${y - 1}`) || wallSet.has(`${x},${y + 1}`);
}

function wallParticipatesEW(wallSet: Set<string>, x: number, y: number): boolean {
  if (!wallSet.has(`${x},${y}`)) return false;
  const hasN = wallSet.has(`${x},${y - 1}`);
  const hasS = wallSet.has(`${x},${y + 1}`);
  const hasW = wallSet.has(`${x - 1},${y}`);
  const hasE = wallSet.has(`${x + 1},${y}`);
  return hasW || hasE || (!hasN && !hasS);
}

/**
   * Contiguous partition run — used so tall N/S walls share one iso depth.
   * Corner tiles belong to both; clients draw L arms as separate graphics so
   * E/W (SE-bound) arms sort above N/S (SW-bound) arms on the same tile.
   */
export function interiorWallRuns(walls: InteriorWallTile[]): InteriorWallRun[] {
  const wallSet = new Set(walls.map((w) => `${w.x},${w.y}`));
  const runs: InteriorWallRun[] = [];
  const visitedNS = new Set<string>();
  const visitedEW = new Set<string>();

  for (const { x, y } of walls) {
    const key = `${x},${y}`;
    if (wallParticipatesNS(wallSet, x, y) && !visitedNS.has(key)) {
      let y0 = y;
      while (wallParticipatesNS(wallSet, x, y0 - 1)) y0--;
      let y1 = y;
      while (wallParticipatesNS(wallSet, x, y1 + 1)) y1++;
      for (let ty = y0; ty <= y1; ty++) visitedNS.add(`${x},${ty}`);
      runs.push({ axis: "ns", x, y0, y1 });
    }
    if (wallParticipatesEW(wallSet, x, y) && !visitedEW.has(key)) {
      let x0 = x;
      while (wallParticipatesEW(wallSet, x0 - 1, y)) x0--;
      let x1 = x;
      while (wallParticipatesEW(wallSet, x1 + 1, y)) x1++;
      for (let tx = x0; tx <= x1; tx++) visitedEW.add(`${tx},${y}`);
      runs.push({ axis: "ew", y, x0, x1 });
    }
  }
  return runs;
}

/**
 * At L-corners, the shorter arm is the cubicle front (door wall) and must paint
 * over the longer side wall:
 * - SW cubicles: short E/W front over long N/S side
 * - SE cubicles: short N/S front over long E/W side
 * Non-corners return 0. Tie → E/W (matches SW cubicles).
 */
export function interiorWallCornerDepthBias(
  wallSet: Set<string>,
  x: number,
  y: number,
  axis: "ns" | "ew",
): number {
  const hasN = wallSet.has(`${x},${y - 1}`);
  const hasS = wallSet.has(`${x},${y + 1}`);
  const hasW = wallSet.has(`${x - 1},${y}`);
  const hasE = wallSet.has(`${x + 1},${y}`);
  const runNS = hasN || hasS;
  const runEW = hasW || hasE || (!hasN && !hasS);
  if (!runNS || !runEW) return 0;

  let y0 = y;
  let y1 = y;
  while (wallSet.has(`${x},${y0 - 1}`)) y0--;
  while (wallSet.has(`${x},${y1 + 1}`)) y1++;
  const nsLen = y1 - y0 + 1;

  let x0 = x;
  let x1 = x;
  while (wallSet.has(`${x0 - 1},${y}`)) x0--;
  while (wallSet.has(`${x1 + 1},${y}`)) x1++;
  const ewLen = x1 - x0 + 1;

  if (nsLen < ewLen) return axis === "ns" ? 1 : 0;
  if (ewLen < nsLen) return axis === "ew" ? 1 : 0;
  return axis === "ew" ? 1 : 0;
}

/**
 * Per-tile wall footprints for entity depth clamps. One entry per axis a tile
 * participates in. `depthBias` matches {@link interiorWallCornerDepthBias}.
 */
export function interiorWallFootprintsForBuilding(
  bx: number,
  by: number,
): {
  ox: number;
  oy: number;
  w: number;
  h: number;
  depthX: number;
  depthY: number;
  axis: "ns" | "ew";
  depthBias: number;
}[] {
  const walls = interiorWallsForBuilding(bx, by);
  if (walls.length === 0) return [];
  const wallSet = new Set(walls.map((w) => `${w.x},${w.y}`));
  const out: {
    ox: number;
    oy: number;
    w: number;
    h: number;
    depthX: number;
    depthY: number;
    axis: "ns" | "ew";
    depthBias: number;
  }[] = [];

  for (const { x, y } of walls) {
    const hasN = wallSet.has(`${x},${y - 1}`);
    const hasS = wallSet.has(`${x},${y + 1}`);
    const hasW = wallSet.has(`${x - 1},${y}`);
    const hasE = wallSet.has(`${x + 1},${y}`);
    const runNS = hasN || hasS;
    const runEW = hasW || hasE || (!hasN && !hasS);
    if (runNS) {
      out.push({
        ox: x,
        oy: y,
        w: 1,
        h: 1,
        depthX: x,
        depthY: y,
        axis: "ns",
        depthBias: interiorWallCornerDepthBias(wallSet, x, y, "ns"),
      });
    }
    if (runEW) {
      out.push({
        ox: x,
        oy: y,
        w: 1,
        h: 1,
        depthX: x,
        depthY: y,
        axis: "ew",
        depthBias: interiorWallCornerDepthBias(wallSet, x, y, "ew"),
      });
    }
  }
  return out;
}

// ─── Search / interaction ──────────────────────────────────────────────────

export function searchableInteractionPoint(obj: {
  kind: string;
  objectType?: string;
  x: number;
  y: number;
  facing?: string;
}) {
  const { w, h } = searchableFootprint(obj);
  const { dx, dy } = ISO_FACING_TILE_DELTA[furnitureFacing(obj)];
  // Front-centre of the footprint (just toward the approach side).
  return { x: obj.x + w * 0.5 + dx * 0.35, y: obj.y + h * 0.5 + dy * 0.35 };
}

export function distanceToSearchable(
  px: number,
  py: number,
  obj: { kind: string; objectType?: string; x: number; y: number; facing?: string },
): number {
  const pt = searchableInteractionPoint(obj);
  return Math.hypot(pt.x - px, pt.y - py);
}

export function playerNearSearchable(
  px: number,
  py: number,
  obj: { kind: string; objectType?: string; x: number; y: number; facing?: string },
  range = SEARCH_RANGE,
): boolean {
  return distanceToSearchable(px, py, obj) <= range;
}

/**
 * True when standing on any orthogonal neighbouring tile of the furniture
 * footprint (or on/beside a floor bag).
 */
export function playerAdjacentToSearchable(
  px: number,
  py: number,
  obj: { kind?: string; objectType?: string; x: number; y: number; facing?: string },
): boolean {
  const ptx = Math.floor(px);
  const pty = Math.floor(py);
  if (!obj.objectType) return false;

  // Floor bags / felled trees: stand on the tile or any neighbouring tile.
  if (obj.objectType === "groundbackpack" || obj.objectType === "fallenTree") {
    return Math.max(Math.abs(ptx - obj.x), Math.abs(pty - obj.y)) <= 1;
  }

  const desc = {
    kind: "furniture" as const,
    objectType: obj.objectType,
    x: obj.x,
    y: obj.y,
    facing: obj.facing,
  };
  return furnitureApproachTiles(desc).some((t) => t.x === ptx && t.y === pty);
}

export function playerNearEntity(
  px: number,
  py: number,
  ex: number,
  ey: number,
  range = SEARCH_RANGE,
): boolean {
  return Math.hypot(ex - px, ey - py) <= range;
}

export function findNearestSearchable<
  T extends { kind: string; objectType?: string; x: number; y: number; searched: boolean },
>(px: number, py: number, items: T[], range = SEARCH_RANGE): T | null {
  let best: T | null = null;
  let bestDist = range;
  for (const item of items) {
    if (item.searched) continue;
    const dist = distanceToSearchable(px, py, item);
    if (dist <= bestDist) {
      bestDist = dist;
      best = item;
    }
  }
  return best;
}
