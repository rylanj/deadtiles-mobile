import Phaser from "phaser";
import type { BuildingInfo, BuildingType } from "@zombie/shared";

/** House / residential walls (Wall1–3). */
export const BUILDING_WALL_HOUSE_KEYS = [
  "building-wall-1",
  "building-wall-2",
  "building-wall-3",
] as const;

/** Warehouse wall (Wall4) — warehouses only. */
export const BUILDING_WALL_WAREHOUSE_KEY = "building-wall-4" as const;

/** Placeholder wall for types without dedicated art yet. */
export const BUILDING_WALL_BLANK_KEY = "building-wall-blank" as const;

/** Player-built partition walls. */
export const BUILDING_WALL_PLYWOOD_KEY = "building-wall-plywood" as const;

export const BUILDING_DOOR_1_KEY = "building-door-1" as const; // houses
/** Olive canvas tent flap (generated; not the wooden Door1). */
export const BUILDING_TENT_FLAP_KEY = "building-tent-flap-se" as const;
/** @deprecated Prefer buildingDoor2Key(face) — SE/SW Door2. */
export const BUILDING_DOOR_2_KEY = "building-door-2-se" as const;
export const BUILDING_DOOR_POLICE_KEY = "building-door-police" as const;
export const BUILDING_DOOR_3_KEY = "building-door-3" as const; // warehouse
/** @deprecated Prefer buildingDoor4Key(face) — SE/SW supermarket doors. */
export const BUILDING_DOOR_4_KEY = "building-door-4-se" as const;
/** @deprecated Prefer buildingWindow1Key(face) — SE/SW Window1. */
export const BUILDING_WINDOW_1_KEY = "building-window-1-se" as const;

/** House interior room-partition doors (InternalDoor1). */
export type InternalDoorFace = "SE" | "SW";
export function buildingInternalDoor1Key(face: InternalDoorFace): string {
  return `building-internal-door-1-${face.toLowerCase()}`;
}

/** Glass office door with no nameplate (InternalDoor2). */
export function buildingInternalDoor2Key(face: InternalDoorFace): string {
  return `building-internal-door-2-${face.toLowerCase()}`;
}

/** Sergeant's office door (InternalDoor3). */
export function buildingInternalDoor3Key(face: InternalDoorFace): string {
  return `building-internal-door-3-${face.toLowerCase()}`;
}

/** Manager's office door (InternalDoor4). */
export function buildingInternalDoor4Key(face: InternalDoorFace): string {
  return `building-internal-door-4-${face.toLowerCase()}`;
}

/** Captain Davis's office door (InternalDoor5). */
export function buildingInternalDoor5Key(face: InternalDoorFace): string {
  return `building-internal-door-5-${face.toLowerCase()}`;
}

/** Hospital cubicle interior doors (DoorHospital). */
export function buildingHospitalDoorKey(face: InternalDoorFace): string {
  return `building-hospital-door-${face.toLowerCase()}`;
}

/** Police jail cell doors (DoorJail). */
export function buildingJailDoorKey(face: InternalDoorFace): string {
  return `building-jail-door-${face.toLowerCase()}`;
}

/** SuperWindow1–6 facing variants (non–faction-owned supermarket façades). */
export const SUPER_WINDOW_VARIANTS = [1, 2, 3, 4, 5, 6] as const;
export type SuperWindowVariant = (typeof SUPER_WINDOW_VARIANTS)[number];
export type SuperWindowFace = "SE" | "SW";

/** Faction-owned supermarket boarded window (directionless). */
export const BUILDING_SUPER_WINDOW_BOARDED_KEY =
  "building-super-window-boarded-1" as const;

export function buildingSuperWindowKey(
  variant: SuperWindowVariant,
  face: SuperWindowFace,
): string {
  return `building-super-window-${variant}-${face.toLowerCase()}`;
}

export function buildingDoor2Key(face: SuperWindowFace): string {
  return `building-door-2-${face.toLowerCase()}`;
}

export function buildingDoor4Key(face: SuperWindowFace): string {
  return `building-door-4-${face.toLowerCase()}`;
}

export function buildingDoor5Key(face: SuperWindowFace): string {
  return `building-door-5-${face.toLowerCase()}`;
}

export function buildingDoor6Key(face: SuperWindowFace): string {
  return `building-door-6-${face.toLowerCase()}`;
}

export function buildingDoor7Key(face: SuperWindowFace): string {
  return `building-door-7-${face.toLowerCase()}`;
}

/** Retail shop double doors. Was Door9 before the rename. */
export function buildingDoor8Key(face: SuperWindowFace): string {
  return `building-door-8-${face.toLowerCase()}`;
}

export function buildingWindow1Key(face: SuperWindowFace): string {
  return `building-window-1-${face.toLowerCase()}`;
}

export function buildingBigWindow1Key(face: SuperWindowFace): string {
  return `building-big-window-1-${face.toLowerCase()}`;
}

/** @deprecated Prefer BUILDING_WALL_HOUSE_KEYS — kept for existing imports. */
export const BUILDING_WALL_RURAL_KEYS = BUILDING_WALL_HOUSE_KEYS;
/** @deprecated Prefer BUILDING_WALL_WAREHOUSE_KEY. */
export const BUILDING_WALL_CITY_KEYS = [BUILDING_WALL_WAREHOUSE_KEY] as const;
/** @deprecated Prefer BUILDING_DOOR_3_KEY. */
export const BUILDING_DOOR_CITY_KEY = BUILDING_DOOR_3_KEY;
/** @deprecated Prefer BUILDING_DOOR_1_KEY. */
export const BUILDING_DOOR_RURAL_KEY = BUILDING_DOOR_1_KEY;

export type BuildingWallHouseKey = (typeof BUILDING_WALL_HOUSE_KEYS)[number];
export type BuildingWallKey =
  | BuildingWallHouseKey
  | typeof BUILDING_WALL_WAREHOUSE_KEY
  | typeof BUILDING_WALL_BLANK_KEY;

const HOUSE_WALL_FILES = [
  "Buildings/Wall1.png",
  "Buildings/Wall2.png",
  "Buildings/Wall3.png",
] as const;

const WAREHOUSE_WALL_FILE = "Buildings/Wall4.png";
const PLYWOOD_WALL_FILE = "Buildings/Plywood.png";
const DOOR_1_FILE = "Buildings/Door1.png";
const DOOR_POLICE_FILE = "Buildings/DoorPolice.png";
const DOOR_3_FILE = "Buildings/Door3.png";

function internalDoor1File(face: InternalDoorFace): string {
  return `Buildings/InternalDoor1_${face}.png`;
}

function internalDoor2File(face: InternalDoorFace): string {
  return `Buildings/InternalDoor2_${face}.png`;
}

function internalDoor3File(face: InternalDoorFace): string {
  return `Buildings/InternalDoor3_${face}.png`;
}

function internalDoor4File(face: InternalDoorFace): string {
  return `Buildings/InternalDoor4_${face}.png`;
}

function internalDoor5File(face: InternalDoorFace): string {
  return `Buildings/InternalDoor5_${face}.png`;
}

function hospitalDoorFile(face: InternalDoorFace): string {
  return `Buildings/DoorHospital_${face}.png`;
}

function jailDoorFile(face: InternalDoorFace): string {
  return `Buildings/DoorJail_${face}.png`;
}

function door2File(face: SuperWindowFace): string {
  return `Buildings/Door2_${face}.png`;
}

function door4File(face: SuperWindowFace): string {
  return `Buildings/Door4_${face}.png`;
}

function door5File(face: SuperWindowFace): string {
  return `Buildings/Door5_${face}.png`;
}

function door6File(face: SuperWindowFace): string {
  return `Buildings/Door6_${face}.png`;
}

function door7File(face: SuperWindowFace): string {
  return `Buildings/Door7_${face}.png`;
}

function door8File(face: SuperWindowFace): string {
  return `Buildings/Door8_${face}.png`;
}

function window1File(face: SuperWindowFace): string {
  return `Buildings/Window1_${face}.png`;
}

function bigWindow1File(face: SuperWindowFace): string {
  return `Buildings/BigWindow1_${face}.png`;
}

function superWindowFile(
  variant: SuperWindowVariant,
  face: SuperWindowFace,
): string {
  return `Buildings/SuperWindow${variant}_${face}.png`;
}

const SUPER_WINDOW_BOARDED_FILE = "Buildings/SuperWindowBoarded1.png";
/** 1:2 white canvas used as a temp wall for unconfigured building types. */
const BLANK_WALL_W = 64;
const BLANK_WALL_H = 128;

export function loadBuildingAssets(scene: Phaser.Scene) {
  scene.load.setPath("/assets");
  for (let i = 0; i < BUILDING_WALL_HOUSE_KEYS.length; i++) {
    scene.load.image(BUILDING_WALL_HOUSE_KEYS[i]!, HOUSE_WALL_FILES[i]!);
  }
  scene.load.image(BUILDING_WALL_WAREHOUSE_KEY, WAREHOUSE_WALL_FILE);
  scene.load.image(BUILDING_WALL_PLYWOOD_KEY, PLYWOOD_WALL_FILE);
  scene.load.image(BUILDING_DOOR_1_KEY, DOOR_1_FILE);
  scene.load.image(BUILDING_DOOR_POLICE_KEY, DOOR_POLICE_FILE);
  scene.load.image(BUILDING_DOOR_3_KEY, DOOR_3_FILE);
  for (const face of ["SE", "SW"] as const) {
    scene.load.image(buildingInternalDoor1Key(face), internalDoor1File(face));
    scene.load.image(buildingInternalDoor2Key(face), internalDoor2File(face));
    scene.load.image(buildingInternalDoor3Key(face), internalDoor3File(face));
    scene.load.image(buildingInternalDoor4Key(face), internalDoor4File(face));
    scene.load.image(buildingInternalDoor5Key(face), internalDoor5File(face));
    scene.load.image(buildingHospitalDoorKey(face), hospitalDoorFile(face));
    scene.load.image(buildingJailDoorKey(face), jailDoorFile(face));
    scene.load.image(buildingDoor2Key(face), door2File(face));
    scene.load.image(buildingDoor4Key(face), door4File(face));
    scene.load.image(buildingDoor5Key(face), door5File(face));
    scene.load.image(buildingDoor6Key(face), door6File(face));
    scene.load.image(buildingDoor7Key(face), door7File(face));
    scene.load.image(buildingDoor8Key(face), door8File(face));
    scene.load.image(buildingWindow1Key(face), window1File(face));
    scene.load.image(buildingBigWindow1Key(face), bigWindow1File(face));
  }
  for (const variant of SUPER_WINDOW_VARIANTS) {
    for (const face of ["SE", "SW"] as const) {
      scene.load.image(
        buildingSuperWindowKey(variant, face),
        superWindowFile(variant, face),
      );
    }
  }
  scene.load.image(BUILDING_SUPER_WINDOW_BOARDED_KEY, SUPER_WINDOW_BOARDED_FILE);
}

/** Call once after the wall textures have finished loading. */
export function configureBuildingTextures(scene: Phaser.Scene) {
  ensureBlankWallTexture(scene);
  ensureHospitalDoorFallbacks(scene);
  ensureTentFlapTexture(scene);
  for (const key of [
    ...BUILDING_WALL_HOUSE_KEYS,
    BUILDING_WALL_WAREHOUSE_KEY,
    BUILDING_WALL_PLYWOOD_KEY,
    BUILDING_WALL_BLANK_KEY,
    BUILDING_TENT_FLAP_KEY,
    BUILDING_DOOR_1_KEY,
    BUILDING_DOOR_POLICE_KEY,
    BUILDING_DOOR_3_KEY,
    buildingInternalDoor1Key("SE"),
    buildingInternalDoor1Key("SW"),
    buildingInternalDoor2Key("SE"),
    buildingInternalDoor2Key("SW"),
    buildingInternalDoor3Key("SE"),
    buildingInternalDoor3Key("SW"),
    buildingInternalDoor4Key("SE"),
    buildingInternalDoor4Key("SW"),
    buildingInternalDoor5Key("SE"),
    buildingInternalDoor5Key("SW"),
    buildingHospitalDoorKey("SE"),
    buildingHospitalDoorKey("SW"),
    buildingJailDoorKey("SE"),
    buildingJailDoorKey("SW"),
    buildingDoor2Key("SE"),
    buildingDoor2Key("SW"),
    buildingDoor4Key("SE"),
    buildingDoor4Key("SW"),
    buildingDoor5Key("SE"),
    buildingDoor5Key("SW"),
    buildingDoor6Key("SE"),
    buildingDoor6Key("SW"),
    buildingDoor7Key("SE"),
    buildingDoor7Key("SW"),
    buildingDoor8Key("SE"),
    buildingDoor8Key("SW"),
    buildingWindow1Key("SE"),
    buildingWindow1Key("SW"),
    buildingBigWindow1Key("SE"),
    buildingBigWindow1Key("SW"),
    ...SUPER_WINDOW_VARIANTS.flatMap((variant) =>
      (["SE", "SW"] as const).map((face) => buildingSuperWindowKey(variant, face)),
    ),
    BUILDING_SUPER_WINDOW_BOARDED_KEY,
  ]) {
    if (!scene.textures.exists(key)) continue;
    scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
  }
}

/** Solid sand door leaf if DoorHospital_SE/SW.png is not yet present. */
function ensureHospitalDoorFallbacks(scene: Phaser.Scene) {
  for (const face of ["SE", "SW"] as const) {
    const key = buildingHospitalDoorKey(face);
    if (scene.textures.exists(key)) continue;
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    ctx.fillStyle = "#d0a95b";
    ctx.fillRect(0, 0, 64, 128);
    // Slight darker panel edge so the fallback still reads as a door.
    ctx.fillStyle = "#b2904d";
    ctx.fillRect(4, 4, 8, 120);
    ctx.fillRect(52, 4, 8, 120);
    scene.textures.addCanvas(key, canvas);
  }
}

/**
 * Olive canvas tent flap: rolled header, tied-back side panels, dark opening.
 * Colours match the procedural tent cuboid so the door does not read as wood.
 * Opening fill can be near-black: cropDoorContent only skips margin padding.
 */
function ensureTentFlapTexture(scene: Phaser.Scene) {
  if (scene.textures.exists(BUILDING_TENT_FLAP_KEY)) return;
  const w = 128;
  const h = 128;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  paintTentFlapTexture(ctx, w, h);
  scene.textures.addCanvas(BUILDING_TENT_FLAP_KEY, canvas);
}

function paintTentFlapTexture(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
) {
  const rollH = Math.round(h * 0.17);
  const interior = ctx.createLinearGradient(0, 0, 0, h);
  interior.addColorStop(0, "#2a2a2a");
  interior.addColorStop(0.45, "#1c1c1c");
  interior.addColorStop(1, "#242424");
  ctx.fillStyle = interior;
  ctx.fillRect(0, 0, w, h);

  const drawFlap = (left: boolean) => {
    ctx.beginPath();
    if (left) {
      ctx.moveTo(0, rollH);
      ctx.lineTo(w * 0.36, rollH);
      ctx.quadraticCurveTo(w * 0.2, h * 0.52, w * 0.17, h);
      ctx.lineTo(0, h);
    } else {
      ctx.moveTo(w, rollH);
      ctx.lineTo(w * 0.64, rollH);
      ctx.quadraticCurveTo(w * 0.8, h * 0.52, w * 0.83, h);
      ctx.lineTo(w, h);
    }
    ctx.closePath();
    ctx.fillStyle = left ? "#4a5a32" : "#3d4c2a";
    ctx.fill();

    ctx.save();
    ctx.clip();
    ctx.strokeStyle = left ? "#354226" : "#2c3820";
    ctx.lineWidth = 2;
    const foldX = left ? [w * 0.08, w * 0.18, w * 0.26] : [w * 0.92, w * 0.82, w * 0.74];
    for (const x of foldX) {
      ctx.beginPath();
      ctx.moveTo(x, rollH + 2);
      ctx.lineTo(left ? x - 4 : x + 4, h);
      ctx.stroke();
    }
    ctx.fillStyle = left ? "#3d4c2a" : "#334024";
    ctx.fillRect(left ? 0 : w - 7, rollH, 7, h - rollH);
    ctx.restore();
  };
  drawFlap(true);
  drawFlap(false);

  // Rolled canvas header.
  const roll = ctx.createLinearGradient(0, 0, 0, rollH);
  roll.addColorStop(0, "#6a7e4a");
  roll.addColorStop(0.28, "#5a6c3e");
  roll.addColorStop(0.62, "#3d4c2a");
  roll.addColorStop(1, "#2a341c");
  ctx.fillStyle = roll;
  ctx.beginPath();
  ctx.moveTo(2, rollH * 0.35);
  ctx.quadraticCurveTo(w * 0.5, -2, w - 2, rollH * 0.35);
  ctx.lineTo(w - 2, rollH);
  ctx.quadraticCurveTo(w * 0.5, rollH + 6, 2, rollH);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#2a341c";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(4, rollH * 0.72);
  ctx.quadraticCurveTo(w * 0.5, rollH + 2, w - 4, rollH * 0.72);
  ctx.stroke();

  // Khaki tie-straps hanging from the roll.
  ctx.strokeStyle = "#8a7a4a";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  for (const x of [w * 0.34, w * 0.66]) {
    ctx.beginPath();
    ctx.moveTo(x, rollH * 0.55);
    ctx.quadraticCurveTo(x + (x < w * 0.5 ? -6 : 6), rollH + 18, x, rollH + 28);
    ctx.stroke();
  }
}

function ensureBlankWallTexture(scene: Phaser.Scene) {
  if (scene.textures.exists(BUILDING_WALL_BLANK_KEY)) return;
  const canvas = document.createElement("canvas");
  canvas.width = BLANK_WALL_W;
  canvas.height = BLANK_WALL_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, BLANK_WALL_W, BLANK_WALL_H);
  scene.textures.addCanvas(BUILDING_WALL_BLANK_KEY, canvas);
}

/** Houses use the residential Wall1–3 set. */
export function isHouseStyleBuilding(
  bld: Pick<BuildingInfo, "buildingType"> | { buildingType?: BuildingType },
): boolean {
  return bld.buildingType === "house" || bld.buildingType === undefined;
}

/** @deprecated Prefer isHouseStyleBuilding. */
export function isRuralStyleBuilding(
  bld: Pick<BuildingInfo, "buildingType"> | { buildingType?: BuildingType },
): boolean {
  return isHouseStyleBuilding(bld);
}

/** Door texture for the building type (supermarket Door4 / hospital Door5 / retail Door8 / office, diner, and apartment Door7 / tent flap). */
export function doorTextureKeyForBuilding(
  bld: Pick<BuildingInfo, "buildingType"> | { buildingType?: BuildingType },
  face?: SuperWindowFace,
): string {
  switch (bld.buildingType) {
    case "warehouse":
      return BUILDING_DOOR_3_KEY;
    case "police_station":
      return BUILDING_DOOR_POLICE_KEY;
    case "supermarket":
      return buildingDoor4Key(face ?? "SE");
    case "hospital":
      return buildingDoor5Key(face ?? "SE");
    case "large_retail":
      return buildingDoor8Key(face ?? "SE");
    case "office":
    case "diner":
    case "apartment":
    case "gun_shop":
      return buildingDoor7Key(face ?? "SE");
    case "tent":
      return BUILDING_TENT_FLAP_KEY;
    case "mess_hall":
      return BUILDING_DOOR_3_KEY;
    case "house":
    case undefined:
      return BUILDING_DOOR_1_KEY;
    default:
      // Placeholder types — house door until dedicated art exists.
      return BUILDING_DOOR_1_KEY;
  }
}

/** Deterministic Wall1–3 pick from building origin (stable across sessions). */
export function houseWallTextureKeyForBuilding(bld: {
  ox: number;
  oy: number;
}): BuildingWallHouseKey {
  const h = Math.imul(bld.ox | 0, 73856093) ^ Math.imul(bld.oy | 0, 19349663);
  const idx = Math.abs(h) % BUILDING_WALL_HOUSE_KEYS.length;
  return BUILDING_WALL_HOUSE_KEYS[idx]!;
}

/** @deprecated Prefer houseWallTextureKeyForBuilding. */
export function ruralWallTextureKeyForBuilding(bld: {
  ox: number;
  oy: number;
}): BuildingWallHouseKey {
  return houseWallTextureKeyForBuilding(bld);
}

/** Wall texture set driven by designated building type. */
export function wallTextureKeyForBuilding(
  bld:
    | Pick<BuildingInfo, "ox" | "oy" | "buildingType">
    | { ox: number; oy: number; buildingType?: BuildingType },
): BuildingWallKey {
  if (bld.buildingType === "warehouse") return BUILDING_WALL_WAREHOUSE_KEY;
  if (bld.buildingType === "police_station") return BUILDING_WALL_HOUSE_KEYS[0]!; // Wall1
  if (isHouseStyleBuilding(bld) || bld.buildingType === "apartment") {
    return houseWallTextureKeyForBuilding(bld);
  }
  // Office, retail, and supermarket paint their own walls and ignore this key.
  return BUILDING_WALL_BLANK_KEY;
}
