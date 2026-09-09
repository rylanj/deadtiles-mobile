import Phaser from "phaser";
import { atlasKeyForPack } from "./assetManifest";
import {
  animFrameFor,
  markAtlasUnavailable,
  onPackLoaded,
  queueMissingPackImages,
  queuePackLoad,
} from "./atlasRegistry";

/** Texture keys for interior furniture (fallbacks created in BootScene). */
export const INTERIOR_TEXTURE_KEYS = {
  furniture: {
    desk: "furniture-desk",
    desk2: "furniture-desk2-sw",
    bigshelf: "furniture-bigshelf",
    bigbox: "furniture-bigbox",
    watercontainer: "furniture-watercontainer",
    cabinet: "furniture-cabinet-sw",
    workbench: "furniture-workbench",
    bed: "furniture-bed",
    dresser: "furniture-dresser",
    bookshelf: "furniture-bookshelf-sw",
    bookshelf2: "furniture-bookshelf2-sw",
    lockers: "furniture-lockers-sw",
    drawers: "furniture-drawers-sw",
    guncabinet: "furniture-guncabinet",
    fridge: "furniture-fridge-se",
    kitchensink: "furniture-kitchensink-se",
    dinnertable: "furniture-dinnertable-se",
    nightstand: "furniture-nightstand-se",
    deadofficer: "furniture-deadofficer-sw",
    bagchair: "furniture-bagchair-sw",
    suitcase: "furniture-suitcase-sw",
    watercooler: "furniture-watercooler-sw",
    trashcan: "furniture-trashcan-se",
    checkout: "furniture-checkout-se",
    supershelf1: "furniture-supershelf1-se",
    supershelf2: "furniture-supershelf2-se",
    superfridge1: "furniture-superfridge1-sw",
    hospitalbed: "furniture-hospitalbed-se",
    hospitalbed2: "furniture-hospitalbed2-se",
    hospitalbed3: "furniture-hospitalbed3-se",
    ivstand: "furniture-ivstand-se",
    medicalcart: "furniture-medicalcart-se",
    medicalreception: "furniture-medicalreception-sw",
    medicaldrawers: "furniture-medicaldrawers-sw",
    threeseater: "furniture-threeseater-se",
    threeseater2: "furniture-threeseater2-se",
    threeseater3: "furniture-threeseater3-se",
    vendingmachine: "furniture-vendingmachine-sw",
    counter: "furniture-counter-se",
    motelbed: "furniture-motelbed-se",
    minifridge: "furniture-minifridge-se",
    groundbackpack: "furniture-groundbackpack-se",
    militarybed: "furniture-militarybed-se",
    footlocker: "furniture-footlocker-se",
    kitbag: "furniture-kitbag-se",
    camptable: "furniture-camptable-se",
    campchair: "furniture-campchair-se",
    militarybasket: "furniture-militarybasket-se",
    range: "furniture-range-se",
    hotdisplay: "furniture-hotdisplay-se",
    drinkdisplay: "furniture-drinkdisplay-se",
    canteentable1: "furniture-canteentable1-se",
    canteentable2: "furniture-canteentable2-se",
    canteentable3: "furniture-canteentable3-se",
    canteenchair: "furniture-canteenchair-se",
  },
} as const;

/** Furniture with Idle_<facing> + Searched_<facing>_0001–0008 sheets. */
import {
  ANIMATED_FURNITURE,
  type AnimatedFurnitureDef,
  type AnimatedFurnitureType,
} from "./furnitureTable";

export {
  ANIMATED_FURNITURE,
  type AnimatedFurnitureDef,
  type AnimatedFurnitureType,
};

/** @deprecated use animatedFurnitureDef("desk")?.idleKey */
export const DESK_IDLE_KEY = "furniture-desk";
/** @deprecated use animatedFurnitureDef("desk")?.animKey */
export const DESK_SEARCHED_ANIM = "furniture-desk-searched";
/** @deprecated */
export const DESK_SEARCHED_FRAME_COUNT = 8;

export function interiorTextureKey(_kind: string, objectType: string) {
  return `furniture-${objectType}`;
}

export function animatedFurnitureDef(
  objectType: string,
  facing?: string,
): AnimatedFurnitureDef | undefined {
  const matches = ANIMATED_FURNITURE.filter((d) => d.objectType === objectType);
  if (matches.length === 0) return undefined;
  if (facing) {
    const exact = matches.find((d) => d.facing === facing);
    if (exact) return exact;
  }
  return matches[0];
}

export function furnitureSearchedFrameKey(
  def: AnimatedFurnitureDef,
  frame: number,
): string {
  const tag = String(
    Math.max(1, Math.min(def.frameCount, frame)),
  ).padStart(4, "0");
  return `${def.idleKey}-searched-${tag}`;
}

/** @deprecated */
export function deskSearchedFrameKey(frame: number): string {
  const def = animatedFurnitureDef("desk")!;
  return furnitureSearchedFrameKey(def, frame);
}

/** Fireplace1 — Active loop + Inactive still (player-built structure). */
export const FIREPLACE1_INACTIVE_KEY = "furniture-fireplace1-inactive";
export const FIREPLACE1_ACTIVE_ANIM = "furniture-fireplace1-active";
export const FIREPLACE1_ACTIVE_FRAME_COUNT = 8;

export function fireplace1ActiveFrameKey(frame: number): string {
  const tag = String(
    Math.max(1, Math.min(FIREPLACE1_ACTIVE_FRAME_COUNT, frame)),
  ).padStart(4, "0");
  return `furniture-fireplace1-active-${tag}`;
}

type FurnitureLoadState = "absent" | "loading" | "ready";
let furnitureState: FurnitureLoadState = "absent";

export function isFurniturePackReady() {
  return furnitureState === "ready";
}

/**
 * Furniture is only ever visible inside an interior, so it loads on the first
 * building enter rather than at boot. It was 613 individual textures (~151MB of
 * VRAM) sitting resident for players who never went inside, which is a large
 * part of why mobile ran out of memory and reloaded.
 */
export function ensureFurnitureAssets(
  scene: Phaser.Scene,
  onReady?: () => void,
) {
  if (furnitureState === "ready") {
    onReady?.();
    return;
  }
  if (furnitureState === "loading") {
    if (onReady) scene.load.once(Phaser.Loader.Events.COMPLETE, onReady);
    return;
  }

  const request = queuePackLoad(scene, "furniture");
  furnitureState = "loading";

  const finish = () => {
    if (request.usedAtlas && !scene.textures.exists(atlasKeyForPack("furniture"))) {
      // Atlas missing (packer not run): retry once via loose PNGs.
      markAtlasUnavailable("furniture");
      furnitureState = "absent";
      ensureFurnitureAssets(scene, onReady);
      return;
    }
    onPackLoaded(scene, "furniture");
    const missing = queueMissingPackImages(scene, "furniture");
    if (missing > 0) {
      const afterMissing = () => {
        furnitureState = "ready";
        configureInteriorAnimations(scene);
        onReady?.();
      };
      scene.load.once(Phaser.Loader.Events.COMPLETE, afterMissing);
      if (!scene.load.isLoading()) scene.load.start();
      return;
    }
    furnitureState = "ready";
    configureInteriorAnimations(scene);
    onReady?.();
  };

  if (request.queued === 0) {
    finish();
    return;
  }
  scene.load.once(Phaser.Loader.Events.COMPLETE, finish);
  if (!scene.load.isLoading()) scene.load.start();
}

/** Reset on world teardown so a rejoin re-resolves against a fresh registry. */
export function resetFurnitureAssets() {
  furnitureState = "absent";
}

/** One-shot search anims; final frame held after complete. */
export function configureInteriorAnimations(scene: Phaser.Scene) {
  for (const def of ANIMATED_FURNITURE) {
    if (def.frameCount <= 0) continue;
    if (scene.anims.exists(def.animKey)) continue;

    const frames: Phaser.Types.Animations.AnimationFrame[] = [];
    for (let frame = 1; frame <= def.frameCount; frame++) {
      const animFrame = animFrameFor(scene, furnitureSearchedFrameKey(def, frame));
      if (!animFrame) break;
      frames.push(animFrame);
    }
    if (frames.length < def.frameCount) continue;

    scene.anims.create({
      key: def.animKey,
      frames,
      frameRate: 12,
      repeat: 0,
    });
  }

  if (!scene.anims.exists(FIREPLACE1_ACTIVE_ANIM)) {
    const frames: Phaser.Types.Animations.AnimationFrame[] = [];
    for (let frame = 1; frame <= FIREPLACE1_ACTIVE_FRAME_COUNT; frame++) {
      const animFrame = animFrameFor(scene, fireplace1ActiveFrameKey(frame));
      if (!animFrame) break;
      frames.push(animFrame);
    }
    if (frames.length === FIREPLACE1_ACTIVE_FRAME_COUNT) {
      scene.anims.create({
        key: FIREPLACE1_ACTIVE_ANIM,
        frames,
        frameRate: 10,
        repeat: -1,
      });
    }
  }
}
