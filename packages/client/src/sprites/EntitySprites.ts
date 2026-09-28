import Phaser from "phaser";
import {
  DIRECTION_LABELS,
  ENTITY_RENDER_HEIGHT,
  ZOMBIE_WALK_FRAMES,
  zombieDieFrameCount,
  zombieRenderHeight,
  PLAYER_WALK_FRAMES,
  PLAYER_DIE_FRAMES,
  PLAYER_FIRE_FRAMES,
  PLAYER_SKIN_DEFAULT,
  normalizeZombieSkin,
  isMilitiaCaptainSkin,
  isMilitiaDoctorSkin,
  isMilitiaNonCombatSkin,
  isGuardSitAnim,
  guardSitChairFromAnim,
  type GuardSitChair,
  MILITIA_CAPTAIN_SKIN,
  MILITIA_DOCTOR_SKIN,
  MILITIA_AMBIENT_DIE_FRAMES,
  MILITIA_CAPTAIN_WALK_FRAMES,
  MILITIA_DOCTOR_WALK_FRAMES,
  militiaGuardArtSkin,
  militiaGuardWalkFrames,
  militiaGuardDieFrames,
  ZOMBIE_SKIN_COUNT,
  ZOMBIE_SKIN_MAN6,
  ZOMBIE_SKIN_MAN10,
  zombieHasCrawlVariant,
  GUARD_NPC_HUMAN,
  GUARD_NPC_TRADER_MAN,
  GUARD_NPC_TRADER_GUARD,
  GUARD_NPC_RED_MAN,
  idleWeaponKeyFromIndex,
  normalizeRedManSkin,
  RED_MAN_SKIN_COUNT,
  TREE_FALL_FRAMES,
  TILE_HEIGHT,
  COYWOLF_RENDER_HEIGHT,
  COYWOLF_RUN_FRAMES,
  COYWOLF_WALK_FRAMES,
  type DirectionLabel,
  type IdleWeaponKey,
} from "@zombie/shared";
import {
  resolveLoadedGuardSkin,
  resolveLoadedPlayerSkin,
  resolveLoadedRedManSkin,
  resolveLoadedZombieSkin,
  traderGuardPackReady,
  traderManPackReady,
} from "./EntityAssetLoader";
import { BOOT_PACK_IDS } from "./assetManifest";
import {
  applyTextureKey,
  frameSourceSize,
  queuePackLoad,
  textureKeyExists,
} from "./atlasRegistry";

/** Walk strip PNGs are 1024×128 → 8 frames of 128×128. */
export const WALK_FRAME_WIDTH = 128;
export const WALK_FRAME_HEIGHT = 128;

/**
 * Normalized Y in source art where feet meet the tile (0 = top, 1 = bottom).
 * Shared across all zombie animations so walk/idle/die sit at the same height.
 */
/** Slightly above the PNG bottom so the sprite sits a bit lower on the tile. */
const ZOMBIE_FEET_ORIGIN_Y = 0.95;
/**
 * Crawl frames do not share the standing foot line. Origin is the lowest
 * opaque row of each direction, so the body sits on the same ground point.
 */
const ZOMBIE_CRAWL_ORIGIN_Y: Partial<
  Record<number, Record<DirectionLabel, number>>
> = {
  [ZOMBIE_SKIN_MAN6]: {
    N: 242 / 256,
    NE: 233 / 256,
    E: 196 / 256,
    SE: 223 / 256,
    S: 217 / 256,
    SW: 223 / 256,
    W: 196 / 256,
    NW: 234 / 256,
  },
  [ZOMBIE_SKIN_MAN10]: {
    N: 255 / 256,
    NE: 238 / 256,
    E: 185 / 256,
    SE: 216 / 256,
    S: 218 / 256,
    SW: 216 / 256,
    W: 185 / 256,
    NW: 238 / 256,
  },
};

function zombieCrawlOriginY(skin: number, dir: DirectionLabel): number {
  return ZOMBIE_CRAWL_ORIGIN_Y[skin]?.[dir] ?? ZOMBIE_FEET_ORIGIN_Y;
}

/** Screen-Y drop so a crawler sits 20% of a tile lower than a standing body. */
export const ZOMBIE_CRAWL_TILE_DROP_PX = TILE_HEIGHT * 0.2;
/** Screen-Y drop so a coyote sits 20% of a tile lower than a standing body. */
export const COYWOLF_TILE_DROP_PX = TILE_HEIGHT * 0.2;
const HUMAN_FEET_ORIGIN_Y = 0.95;
const HUMAN_DIE_FEET_ORIGIN_Y = 0.95;
/** Sit frame includes the campchair; match CampChair1 (raised 10% from the prior seat). */
const GUARD_SIT_FEET_ORIGIN_Y = HUMAN_FEET_ORIGIN_Y;
const GUARD_SIT_RENDER_HEIGHT = Math.round(ENTITY_RENDER_HEIGHT * 0.9 * 1.1);

/** @deprecated — old Survivor1 run sheets; placeholder key only. */
export function playerRunKey(dir: DirectionLabel) {
  return `player-run-${dir}`;
}

// ─── Shared sprite helpers ───────────────────────────────────────────────────

/** Frame index 1–8 → asset suffix `0001`–`0008`. */
function animFrameTag(frame: number): string {
  return String(frame).padStart(4, "0");
}

// ─── ZombieMan1–11 sprite keys ──────────────────────────────────────────────────

function zombieManName(skin: number): string {
  const s = normalizeZombieSkin(skin);
  return `ZombieMan${s}`;
}

/** Assets live under `/assets/ZombieMan{n}/{action}/`. */
function zombieManPath(skin: number, action: string, file: string): string {
  const man = zombieManName(skin);
  return `${man}/${action}/${file}`;
}

export function zombieIdleKey(dir: DirectionLabel, skin = 1) {
  return `zombieman${skin}-idle-${dir}`;
}

export function zombieWalkFrameKey(dir: DirectionLabel, frame: number, skin = 1) {
  return `zombieman${skin}-walk-${dir}-${animFrameTag(frame)}`;
}

export function zombieIdleCrawlKey(dir: DirectionLabel, skin = ZOMBIE_SKIN_MAN6) {
  return `zombieman${skin}-idlecrawl-${dir}`;
}

export function zombieCrawlFrameKey(dir: DirectionLabel, frame: number, skin = ZOMBIE_SKIN_MAN6) {
  return `zombieman${skin}-crawl-${dir}-${animFrameTag(frame)}`;
}

export function zombieDieFrameKey(dir: DirectionLabel, frame: number, skin = 1) {
  return `zombieman${skin}-die-${dir}-${animFrameTag(frame)}`;
}

export function coywolfIdleKey(dir: DirectionLabel) {
  return `coywolf-idle-${dir}`;
}

export function coywolfWalkFrameKey(dir: DirectionLabel, frame: number) {
  return `coywolf-walk-${dir}-${animFrameTag(frame)}`;
}

export function coywolfRunFrameKey(dir: DirectionLabel, frame: number) {
  return `coywolf-run-${dir}-${animFrameTag(frame)}`;
}

export function coywolfDieFrameKey(dir: DirectionLabel, frame: number) {
  return `coywolf-die-${dir}-${animFrameTag(frame)}`;
}

const COYWOLF_FEET_ORIGIN_Y = 0.92;
/**
 * Idle art fills more of its canvas than walk, so the same height makes a
 * standing coyote look larger.
 */
const COYWOLF_IDLE_RENDER_SCALE = 0.85;

function applyCoywolfFrame(
  sprite: Phaser.GameObjects.Sprite,
  textureKey: string,
  renderHeight = COYWOLF_RENDER_HEIGHT,
) {
  applyEntitySpriteFrame(
    sprite,
    textureKey,
    COYWOLF_FEET_ORIGIN_Y,
    renderHeight,
  );
}

/** @deprecated — Survivor1 weapon-specific idle. */
export function playerIdleKey(weapon: IdleWeaponKey, dir: DirectionLabel) {
  return `player-idle-${weapon}-${dir}`;
}

// ─── PlayerMan1–3 player sprite keys ─────────────────────────────────────────

/** PlayerMan assets live under `/assets/PlayerMan{n}/{action}/`. */
function playerManPath(skin: number, action: string, file: string): string {
  return `PlayerMan${skin}/${action}/${file}`;
}

function playerManPrefix(skin: number): string {
  return `playerman${skin}`;
}

export function playerManRunFrameKey(dir: DirectionLabel, frame: number, skin = PLAYER_SKIN_DEFAULT) {
  return `${playerManPrefix(skin)}-run-${dir}-${animFrameTag(frame)}`;
}

export function playerManWalkFrameKey(dir: DirectionLabel, frame: number, skin = PLAYER_SKIN_DEFAULT) {
  return `${playerManPrefix(skin)}-walk-${dir}-${animFrameTag(frame)}`;
}

export function playerManDieFrameKey(dir: DirectionLabel, frame: number, skin = PLAYER_SKIN_DEFAULT) {
  return `${playerManPrefix(skin)}-die-${dir}-${animFrameTag(frame)}`;
}

export function playerManIdleKey(dir: DirectionLabel, skin = PLAYER_SKIN_DEFAULT) {
  return `${playerManPrefix(skin)}-idle-${dir}`;
}

export function playerManIdleWeaponKey(
  weaponName: string,
  dir: DirectionLabel,
  skin = PLAYER_SKIN_DEFAULT,
) {
  return `${playerManPrefix(skin)}-idle-${weaponName.toLowerCase()}-${dir}`;
}

export function playerManFireFrameKey(
  weaponName: string,
  dir: DirectionLabel,
  frame: number,
  skin = PLAYER_SKIN_DEFAULT,
) {
  return `${playerManPrefix(skin)}-fire-${weaponName.toLowerCase()}-${dir}-${animFrameTag(frame)}`;
}

export function playerManHitFrameKey(
  weaponName: string,
  dir: DirectionLabel,
  frame: number,
  skin = PLAYER_SKIN_DEFAULT,
) {
  return `${playerManPrefix(skin)}-hit-${weaponName.toLowerCase()}-${dir}-${animFrameTag(frame)}`;
}

export function playerManWeaponWalkFrameKey(
  weaponName: string,
  dir: DirectionLabel,
  frame: number,
  skin = PLAYER_SKIN_DEFAULT,
) {
  return `${playerManPrefix(skin)}-walk-${weaponName.toLowerCase()}-${dir}-${animFrameTag(frame)}`;
}

/** PlayerMan Fire* folders currently filled (5 frames). */
const PLAYER_FIRE_WEAPON_NAMES = [
  "Pistol",
  "Shotgun",
  "Revolver",
  "AK",
  "HuntingRifle",
  "M4",
] as const;
/** PlayerMan Idle* folders currently filled. */
const PLAYER_IDLE_WEAPON_NAMES = [
  "Pistol",
  "Shotgun",
  "Revolver",
  "AK",
  "HuntingRifle",
  "M4",
  "Bat",
  "Hammer",
  "Hatchet",
] as const;
/** PlayerMan Walk{Weapon} folders (9 frames) — firearms + melee. */
const PLAYER_WALK_WEAPON_NAMES = [
  "Pistol",
  "Shotgun",
  "Revolver",
  "AK",
  "HuntingRifle",
  "M4",
  "Bat",
  "Hammer",
  "Hatchet",
] as const;
/** PlayerMan Hit* folders currently filled (5 frames, same strip length as Fire*). */
const PLAYER_HIT_WEAPON_NAMES = ["Bat", "Hammer", "Hatchet"] as const;

/** Clothing skins currently shipped under /assets/PlayerMan{n}/. */
export const PLAYER_CLOTHING_SKINS = [1, 2, 3] as const;

export type PlayerManTrackFn = (key: string, path: string) => void;

/** Queue all textures for one PlayerMan clothing skin (boot or lazy pack). */
export function schedulePlayerManSkinTextures(
  skin: number,
  track: PlayerManTrackFn,
) {
  const man = `PlayerMan${skin}`;
  for (const dir of DIRECTION_LABELS) {
    track(
      playerManIdleKey(dir, skin),
      playerManPath(skin, "Idle", `${man}_Idle_${dir}.png`),
    );
    for (const weaponName of PLAYER_IDLE_WEAPON_NAMES) {
      track(
        playerManIdleWeaponKey(weaponName, dir, skin),
        playerManPath(
          skin,
          `Idle${weaponName}`,
          `${man}_Idle${weaponName}_${dir}.png`,
        ),
      );
    }
  }

  for (const weaponName of PLAYER_FIRE_WEAPON_NAMES) {
    for (const dir of DIRECTION_LABELS) {
      for (let f = 1; f <= PLAYER_FIRE_FRAMES; f++) {
        track(
          playerManFireFrameKey(weaponName, dir, f, skin),
          playerManPath(
            skin,
            `Fire${weaponName}`,
            `${man}_Fire${weaponName}_${dir}_${animFrameTag(f)}.png`,
          ),
        );
      }
    }
  }

  for (const weaponName of PLAYER_WALK_WEAPON_NAMES) {
    for (const dir of DIRECTION_LABELS) {
      for (let f = 1; f <= PLAYER_WALK_FRAMES; f++) {
        track(
          playerManWeaponWalkFrameKey(weaponName, dir, f, skin),
          playerManPath(
            skin,
            `Walk${weaponName}`,
            `${man}_Walk${weaponName}_${dir}_${animFrameTag(f)}.png`,
          ),
        );
      }
    }
  }

  for (const weaponName of PLAYER_HIT_WEAPON_NAMES) {
    for (const dir of DIRECTION_LABELS) {
      for (let f = 1; f <= PLAYER_FIRE_FRAMES; f++) {
        track(
          playerManHitFrameKey(weaponName, dir, f, skin),
          playerManPath(
            skin,
            `Hit${weaponName}`,
            `${man}_Hit${weaponName}_${dir}_${animFrameTag(f)}.png`,
          ),
        );
      }
    }
  }

  for (const dir of DIRECTION_LABELS) {
    for (let f = 1; f <= PLAYER_WALK_FRAMES; f++) {
      const tag = animFrameTag(f);
      track(
        playerManWalkFrameKey(dir, f, skin),
        playerManPath(skin, "Walk", `${man}_Walk_${dir}_${tag}.png`),
      );
      track(
        playerManRunFrameKey(dir, f, skin),
        playerManPath(skin, "Run", `${man}_Run_${dir}_${tag}.png`),
      );
    }
    for (let f = 1; f <= PLAYER_DIE_FRAMES; f++) {
      const tag = animFrameTag(f);
      track(
        playerManDieFrameKey(dir, f, skin),
        playerManPath(skin, "Die", `${man}_Die_${dir}_${tag}.png`),
      );
    }
  }
}

function queuePlayerManSkin(scene: Phaser.Scene, skin: number) {
  schedulePlayerManSkinTextures(skin, (key, path) => {
    scene.load.image(key, path);
  });
}

/** Map from WEAPONS index → fire animation folder/name suffix (ranged only). */
export const FIRE_WEAPON_NAMES: Record<number, string> = {
  0: "Pistol",
  1: "Shotgun",
  2: "HuntingRifle",
  3: "Revolver",
  4: "AK",
  8: "M4",
};

/** Melee weapons use Hit{Name} folders instead of Fire{Name}. */
export const MELEE_HIT_WEAPON_NAMES: Record<number, string> = {
  5: "Hammer",
  6: "Bat",
  7: "Hatchet",
};

/** Melee weapons that ship PlayerMan Walk{Name} strips. */
export const MELEE_WALK_WEAPON_NAMES: Record<number, string> = {
  5: "Hammer",
  6: "Bat",
  7: "Hatchet",
};

// ─── MilitiaGuard1–3 / MilitiaCaptain1 / MilitiaDoctor1 NPC sprite keys ───────

function militiaGuardPath(skin: number, action: string, file: string): string {
  return `MilitiaGuard${militiaGuardArtSkin(skin)}/${action}/${file}`;
}

function militiaCaptainPath(action: string, file: string): string {
  return `MilitiaCaptain1/${action}/${file}`;
}

export function guardIdleAKKey(dir: DirectionLabel, skin = 1) {
  return `militiaguard${militiaGuardArtSkin(skin)}-idle-ak-${dir}`;
}

export function guardSitKey(
  dir: DirectionLabel,
  skin = 1,
  chair: GuardSitChair = "canteenchair",
) {
  return `militiaguard${militiaGuardArtSkin(skin)}-sit-${chair}-${dir}`;
}

export function guardWalkAKFrameKey(dir: DirectionLabel, frame: number, skin = 1) {
  return `militiaguard${militiaGuardArtSkin(skin)}-walk-ak-${dir}-${animFrameTag(frame)}`;
}

export function guardFireAKFrameKey(dir: DirectionLabel, frame: number, skin = 1) {
  // MilitiaGuard3 has no FireAK yet: reuse Guard1.
  const art = militiaGuardArtSkin(skin);
  const fireArt = art === 3 ? 1 : art;
  return `militiaguard${fireArt}-fire-ak-${dir}-${animFrameTag(frame)}`;
}

export function guardDieFrameKey(dir: DirectionLabel, frame: number, skin = 1) {
  return `militiaguard${militiaGuardArtSkin(skin)}-die-${dir}-${animFrameTag(frame)}`;
}

export function militiaCaptainIdleKey(dir: DirectionLabel) {
  return `militiacaptain1-idle-${dir}`;
}

export function militiaCaptainWalkFrameKey(dir: DirectionLabel, frame: number) {
  const f = ((Math.floor(frame) - 1) % MILITIA_CAPTAIN_WALK_FRAMES) + 1;
  return `militiacaptain1-walk-${dir}-${animFrameTag(f)}`;
}

export function militiaCaptainDieFrameKey(dir: DirectionLabel, frame: number) {
  return `militiacaptain1-die-${dir}-${animFrameTag(frame)}`;
}

export function militiaDoctorIdleKey(dir: DirectionLabel) {
  return `militiadoctor1-idle-${dir}`;
}

export function militiaDoctorIdle2Key(dir: DirectionLabel) {
  return `militiadoctor1-idle2-${dir}`;
}

export function militiaDoctorWalkFrameKey(dir: DirectionLabel, frame: number) {
  const f = ((Math.floor(frame) - 1) % MILITIA_DOCTOR_WALK_FRAMES) + 1;
  return `militiadoctor1-walk-${dir}-${animFrameTag(f)}`;
}

export function militiaDoctorDieFrameKey(dir: DirectionLabel, frame: number) {
  return `militiadoctor1-die-${dir}-${animFrameTag(frame)}`;
}

// ─── TraderMan1 / TraderGuard1 sprite keys ───────────────────────────────────

function traderPath(folder: string, action: string, file: string): string {
  return `${folder}/${action}/${file}`;
}

export function traderManIdleKey(dir: DirectionLabel) {
  return `traderman1-idle-${dir}`;
}
export function traderManWalkFrameKey(dir: DirectionLabel, frame: number) {
  return `traderman1-walk-${dir}-${animFrameTag(frame)}`;
}
export function traderManDieFrameKey(dir: DirectionLabel, frame: number) {
  return `traderman1-die-${dir}-${animFrameTag(frame)}`;
}

export function traderGuardIdleKey(dir: DirectionLabel) {
  return `traderguard1-idle-${dir}`;
}
export function traderGuardWalkFrameKey(dir: DirectionLabel, frame: number) {
  return `traderguard1-walk-${dir}-${animFrameTag(frame)}`;
}
export function traderGuardFirePistolFrameKey(dir: DirectionLabel, frame: number) {
  return `traderguard1-fire-pistol-${dir}-${animFrameTag(frame)}`;
}
export function traderGuardDieFrameKey(dir: DirectionLabel, frame: number) {
  return `traderguard1-die-${dir}-${animFrameTag(frame)}`;
}

// ─── RedMan1/3/4 IdlePistol+WalkPistol / RedMan2 IdleShotgun+WalkShotgun ─────

function redManFolder(skin: number): string {
  return `RedMan${normalizeRedManSkin(skin)}`;
}

function redManUsesShotgun(skin: number): boolean {
  return normalizeRedManSkin(skin) === 2;
}

function redManIdleAction(skin: number): string {
  return redManUsesShotgun(skin) ? "IdleShotgun" : "IdlePistol";
}

function redManWalkAction(skin: number): string {
  return redManUsesShotgun(skin) ? "WalkShotgun" : "WalkPistol";
}

function redManFireAction(skin: number): string {
  return redManUsesShotgun(skin) ? "FireShotgun" : "FirePistol";
}

function redManPath(skin: number, action: string, file: string): string {
  return `${redManFolder(skin)}/${action}/${file}`;
}

export function redManIdleKey(dir: DirectionLabel, skin: number) {
  const s = normalizeRedManSkin(skin);
  const action = redManIdleAction(s);
  return `redman${s}-${action.toLowerCase()}-${dir}`;
}

export function redManWalkFrameKey(dir: DirectionLabel, frame: number, skin: number) {
  const s = normalizeRedManSkin(skin);
  const action = redManWalkAction(s);
  return `redman${s}-${action.toLowerCase()}-${dir}-${animFrameTag(frame)}`;
}

export function redManFireFrameKey(
  dir: DirectionLabel,
  frame: number,
  skin: number,
) {
  const s = normalizeRedManSkin(skin);
  const action = redManFireAction(s);
  return `redman${s}-${action.toLowerCase()}-${dir}-${animFrameTag(frame)}`;
}

export function redManDieFrameKey(dir: DirectionLabel, frame: number, skin: number) {
  const s = normalizeRedManSkin(skin);
  return `redman${s}-die-${dir}-${animFrameTag(frame)}`;
}

/** Prefer guard-skin texture; fall back to MilitiaGuard1 when Guard2 lacks the anim. */
function resolveGuardTextureKey(
  sprite: Phaser.GameObjects.Sprite,
  preferredKey: string,
  fallbackKey: string,
): string {
  if (preferredKey !== fallbackKey && textureKeyExists(sprite.scene, preferredKey)) {
    return preferredKey;
  }
  return fallbackKey;
}

export function loadSurvivorAssets(scene: Phaser.Scene) {
  // Boot art is the fallback set for any skin whose pack has not loaded yet:
  // ZombieMan1, MilitiaGuard1, PlayerMan1. Each is a single packed atlas, so
  // boot costs ~3 GPU uploads instead of ~1,650 individual textures.
  for (const id of BOOT_PACK_IDS) {
    queuePackLoad(scene, id);
  }

  scene.load.setPath("/assets");

  scene.load.image("tile-ground", "GroundTile1.png");
  scene.load.image("tile-path", "PathUpLeft.png");
  scene.load.image("tile-wood", "GroundWood.png");
  scene.load.image("tile-concrete", "GroundConcrete.png");
  scene.load.image("tile-barracks", "GroundBarracks.png");
  scene.load.image("tile-ground-tiles", "GroundTiles.png");
  scene.load.image("tile-hospital", "GroundHospital.png");
  scene.load.image("tile-motel", "GroundMotel.png");

  // Standing sprite plus the resting frame of the fall, per variant.
  //
  // The in-between frames are only on screen while a tree is actually coming
  // down, so they load on the chop instead (see ensureTreeFallFrames): at
  // 256x256 they were ~9MB of permanent boot VRAM for an animation a session
  // may never play. The resting frame stays eager because treesSync paints
  // already-felled trees with no animation, and a felled tree that still looks
  // like it is standing is worse than a brief load.
  for (let n = 1; n <= 5; n++) {
    scene.load.image(`tree-${n}`, `Tree/Tree${n}/Tree${n}.png`);
    scene.load.image(
      treeFallFrameKey(n, TREE_FALL_FRAMES),
      treeFallFramePath(n, TREE_FALL_FRAMES),
    );
  }
}

function treeFallFrameKey(variant: number, frame: number): string {
  return `tree-${variant}-fall-${frame}`;
}

function treeFallFramePath(variant: number, frame: number): string {
  const tag = String(frame).padStart(4, "0");
  return `Tree/Tree${variant}/Tree${variant}_Falling_${tag}.png`;
}

/** Variants whose in-between fall frames are loaded or in flight. */
const treeFallFramesRequested = new Set<number>();

/**
 * Load the in-between frames of one tree variant's fall animation.
 *
 * Called when a chop starts, which is several seconds of axe swings before the
 * tree moves, so the frames are resident well before they are drawn. If a load
 * is somehow still pending, resolveTreeFallTexture falls back to the standing
 * sprite for those frames while the eager resting frame still lands, so the
 * tree ends up correctly felled either way.
 */
export function ensureTreeFallFrames(scene: Phaser.Scene, variant: number) {
  const idx = (((variant % 5) + 5) % 5) + 1;
  if (treeFallFramesRequested.has(idx)) return;
  treeFallFramesRequested.add(idx);

  let queued = 0;
  const prevPath = scene.load.path;
  scene.load.setPath("/assets");
  for (let f = 1; f < TREE_FALL_FRAMES; f++) {
    const key = treeFallFrameKey(idx, f);
    if (scene.textures.exists(key)) continue;
    scene.load.image(key, treeFallFramePath(idx, f));
    queued += 1;
  }
  scene.load.setPath(prevPath);
  if (queued > 0 && !scene.load.isLoading()) scene.load.start();
}

/** Scene teardown: the next scene re-requests against a fresh texture manager. */
export function resetTreeFallFrameRequests() {
  treeFallFramesRequested.clear();
}

function applyDisplaySizeFromWH(
  sprite: Phaser.GameObjects.Sprite,
  width: number,
  height: number,
  renderHeight = ENTITY_RENDER_HEIGHT,
) {
  const displayWidth = (width / height) * renderHeight;
  sprite.setDisplaySize(displayWidth, renderHeight);
}

function applyEntitySpriteFrame(
  sprite: Phaser.GameObjects.Sprite,
  textureKey: string,
  feetOriginY: number,
  renderHeight = ENTITY_RENDER_HEIGHT,
) {
  if (!applyTextureKey(sprite, textureKey)) {
    // Leave a live texture on the sprite so a later pack unload cannot strand
    // a visible GO on a destroyed glTexture (WebGL aborts the whole batch).
    const current = sprite.texture?.key;
    if (!current || !sprite.scene.textures.exists(current)) {
      sprite.setTexture("__DEFAULT");
    }
    return;
  }
  sprite.setOrigin(0.5, feetOriginY);
  // Atlas frames are trimmed to their opaque bounds, so size from the original
  // (untrimmed) frame size or every sprite would scale to its own crop.
  const size = frameSourceSize(sprite.scene, textureKey);
  if (size) applyDisplaySizeFromWH(sprite, size.width, size.height, renderHeight);
}

/** Static idle PNG — full image, no crop. */
export function applyIdleFrame(
  sprite: Phaser.GameObjects.Sprite,
  textureKey: string,
  feetOriginY = HUMAN_FEET_ORIGIN_Y,
  renderHeight = ENTITY_RENDER_HEIGHT,
) {
  applyEntitySpriteFrame(sprite, textureKey, feetOriginY, renderHeight);
}

/** Walk frame PNGs (frames 0001–0009) for the given zombie skin. */
function applyZombieWalkFrame(
  sprite: Phaser.GameObjects.Sprite,
  dir: DirectionLabel,
  animFrame: number,
  skin: number,
  crawling = false,
) {
  const frame = (Math.floor(animFrame) % ZOMBIE_WALK_FRAMES) + 1;
  const resolved = resolveLoadedZombieSkin(skin);
  if (crawling && zombieHasCrawlVariant(resolved)) {
    const crawl = zombieCrawlFrameKey(dir, frame, resolved);
    if (textureKeyExists(sprite.scene, crawl)) {
      applyEntitySpriteFrame(
        sprite,
        crawl,
        zombieCrawlOriginY(resolved, dir),
        zombieRenderHeight(skin, true),
      );
      return;
    }
  }
  const preferred = zombieWalkFrameKey(dir, frame, resolved);
  const fallback = zombieWalkFrameKey(dir, frame, 1);
  applyEntitySpriteFrame(
    sprite,
    textureKeyExists(sprite.scene, preferred) ? preferred : fallback,
    ZOMBIE_FEET_ORIGIN_Y,
    zombieRenderHeight(skin),
  );
}

/** Die frame PNGs for the given zombie skin. Falls back if Die/ is missing. */
function applyZombieDieFrame(
  sprite: Phaser.GameObjects.Sprite,
  dir: DirectionLabel,
  frame: number,
  skin: number,
) {
  const preferred = resolveLoadedZombieSkin(skin);
  const maxFrame = zombieDieFrameCount(preferred);
  const clamped = Math.max(1, Math.min(maxFrame, Math.floor(frame)));
  const candidates = [
    preferred,
    ...Array.from({ length: ZOMBIE_SKIN_COUNT }, (_, i) => i + 1).filter(
      (s) => s !== preferred,
    ),
  ];
  for (const candidate of candidates) {
    const key = zombieDieFrameKey(dir, clamped, candidate);
    if (textureKeyExists(sprite.scene, key)) {
      applyEntitySpriteFrame(
        sprite,
        key,
        ZOMBIE_FEET_ORIGIN_Y,
        zombieRenderHeight(skin),
      );
      return;
    }
  }
}

/** PlayerMan — walk frame; uses Walk{Weapon} when equipped, else base Walk. */
function applyPlayerWalkFrame(
  sprite: Phaser.GameObjects.Sprite,
  dir: DirectionLabel,
  animFrame: number,
  weaponName?: string,
  skin = PLAYER_SKIN_DEFAULT,
) {
  const frame = (Math.floor(animFrame) % PLAYER_WALK_FRAMES) + 1;
  if (weaponName) {
    const preferred = playerManWeaponWalkFrameKey(weaponName, dir, frame, skin);
    if (textureKeyExists(sprite.scene, preferred)) {
      applyEntitySpriteFrame(sprite, preferred, HUMAN_FEET_ORIGIN_Y);
      return;
    }
  }
  const key = playerManWalkFrameKey(dir, frame, skin);
  if (textureKeyExists(sprite.scene, key)) {
    applyEntitySpriteFrame(sprite, key, HUMAN_FEET_ORIGIN_Y);
    return;
  }
  applyPlayerIdleFrame(sprite, dir, weaponName, skin);
}

/** PlayerMan — die frame PNGs (frames 0001–0009). */
function applyPlayerDieFrame(
  sprite: Phaser.GameObjects.Sprite,
  dir: DirectionLabel,
  frame: number,
  skin = PLAYER_SKIN_DEFAULT,
) {
  const clamped = Math.max(1, Math.min(PLAYER_DIE_FRAMES, Math.floor(frame)));
  const candidates: DirectionLabel[] = [
    dir,
    "S",
    ...DIRECTION_LABELS.filter((d) => d !== dir && d !== "S"),
  ];
  for (const candidate of candidates) {
    const key = playerManDieFrameKey(candidate, clamped, skin);
    if (textureKeyExists(sprite.scene, key)) {
      applyEntitySpriteFrame(sprite, key, HUMAN_DIE_FEET_ORIGIN_Y);
      return;
    }
  }
}

/** PlayerMan — run frame PNGs (frames 0001–0009). */
function applyPlayerRunFrame(
  sprite: Phaser.GameObjects.Sprite,
  dir: DirectionLabel,
  animFrame: number,
  skin = PLAYER_SKIN_DEFAULT,
) {
  const frame = (Math.floor(animFrame) % PLAYER_WALK_FRAMES) + 1;
  const key = playerManRunFrameKey(dir, frame, skin);
  if (textureKeyExists(sprite.scene, key)) {
    applyEntitySpriteFrame(sprite, key, HUMAN_FEET_ORIGIN_Y);
    return;
  }
  applyPlayerWalkFrame(sprite, dir, animFrame, undefined, skin);
}

/** PlayerMan — fire animation frame; falls back to idle if the strip is missing. */
function applyPlayerFireFrame(
  sprite: Phaser.GameObjects.Sprite,
  dir: DirectionLabel,
  weaponName: string,
  frame: number,
  idleWeapon?: string,
  skin = PLAYER_SKIN_DEFAULT,
) {
  const clampedPlayer = Math.max(1, Math.min(PLAYER_FIRE_FRAMES, frame));
  const preferred = playerManFireFrameKey(weaponName, dir, clampedPlayer, skin);
  if (textureKeyExists(sprite.scene, preferred)) {
    applyEntitySpriteFrame(sprite, preferred, HUMAN_FEET_ORIGIN_Y);
    return;
  }
  applyPlayerIdleFrame(sprite, dir, idleWeapon ?? weaponName, skin);
}

/** Melee Hit{Weapon} — PlayerMan 5-frame strip; falls back to idle if missing. */
function applyPlayerHitFrame(
  sprite: Phaser.GameObjects.Sprite,
  dir: DirectionLabel,
  weaponName: string,
  frame: number,
  idleWeapon?: string,
  skin = PLAYER_SKIN_DEFAULT,
) {
  const clampedPlayer = Math.max(1, Math.min(PLAYER_FIRE_FRAMES, frame));
  const preferred = playerManHitFrameKey(weaponName, dir, clampedPlayer, skin);
  if (textureKeyExists(sprite.scene, preferred)) {
    applyEntitySpriteFrame(sprite, preferred, HUMAN_FEET_ORIGIN_Y);
    return;
  }
  applyPlayerIdleFrame(sprite, dir, idleWeapon ?? weaponName, skin);
}

/** PlayerMan — idle frame, optionally with a weapon pose. */
function applyPlayerIdleFrame(
  sprite: Phaser.GameObjects.Sprite,
  dir: DirectionLabel,
  idleWeapon?: string,
  skin = PLAYER_SKIN_DEFAULT,
) {
  if (idleWeapon) {
    const preferred = playerManIdleWeaponKey(idleWeapon, dir, skin);
    if (textureKeyExists(sprite.scene, preferred)) {
      applyEntitySpriteFrame(sprite, preferred, HUMAN_FEET_ORIGIN_Y);
      return;
    }
  }
  const key = playerManIdleKey(dir, skin);
  if (textureKeyExists(sprite.scene, key)) {
    applyEntitySpriteFrame(sprite, key, HUMAN_FEET_ORIGIN_Y);
    return;
  }
  if (skin !== PLAYER_SKIN_DEFAULT) {
    applyPlayerIdleFrame(sprite, dir, idleWeapon, PLAYER_SKIN_DEFAULT);
  }
}

/**
 * MilitiaGuard — IdleAK stance when stood still.
 * Captain uses plain Idle; doctor uses Idle or Idle2 (`idleVariant`).
 */
function applyGuardIdleAKFrame(
  sprite: Phaser.GameObjects.Sprite,
  dir: DirectionLabel,
  skin = 1,
  idleVariant: "idle" | "idle2" = "idle",
) {
  if (isMilitiaDoctorSkin(skin)) {
    const doctorKey =
      idleVariant === "idle2"
        ? militiaDoctorIdle2Key(dir)
        : militiaDoctorIdleKey(dir);
    const fallback = militiaDoctorIdleKey(dir);
    if (textureKeyExists(sprite.scene, doctorKey)) {
      applyEntitySpriteFrame(sprite, doctorKey, HUMAN_FEET_ORIGIN_Y);
      return;
    }
    if (doctorKey !== fallback && textureKeyExists(sprite.scene, fallback)) {
      applyEntitySpriteFrame(sprite, fallback, HUMAN_FEET_ORIGIN_Y);
      return;
    }
  }
  if (isMilitiaCaptainSkin(skin)) {
    const captainKey = militiaCaptainIdleKey(dir);
    if (textureKeyExists(sprite.scene, captainKey)) {
      applyEntitySpriteFrame(sprite, captainKey, HUMAN_FEET_ORIGIN_Y);
      return;
    }
  }
  const resolvedSkin = resolveLoadedGuardSkin(skin);
  const preferred = guardIdleAKKey(dir, resolvedSkin);
  const fallbackIdle = guardIdleAKKey(dir, 1);
  if (textureKeyExists(sprite.scene, preferred)) {
    applyEntitySpriteFrame(sprite, preferred, HUMAN_FEET_ORIGIN_Y);
    return;
  }
  if (preferred !== fallbackIdle && textureKeyExists(sprite.scene, fallbackIdle)) {
    applyEntitySpriteFrame(sprite, fallbackIdle, HUMAN_FEET_ORIGIN_Y);
    return;
  }
  applyGuardWalkAKFrame(sprite, dir, 1, resolvedSkin);
}

/** Sit frame includes the chair. CampChair1 / CanteenChair1 ship NE + NW. */
function applyGuardSitFrame(
  sprite: Phaser.GameObjects.Sprite,
  dir: DirectionLabel,
  skin = 1,
  anim?: string,
) {
  if (isMilitiaCaptainSkin(skin) || isMilitiaDoctorSkin(skin)) {
    applyGuardIdleAKFrame(sprite, dir, skin);
    return;
  }
  const chair = guardSitChairFromAnim(anim);
  const resolvedSkin = resolveLoadedGuardSkin(skin);
  // Tent camp chairs always use NW (toward the table). Never fall back to NE:
  // a missing NW texture used to show the NE sit pose.
  const fallbacks: string[] =
    chair === "campchair"
      ? [
          guardSitKey("NW", resolvedSkin, chair),
          guardSitKey("NW", 1, chair),
        ]
      : [
          guardSitKey(dir, resolvedSkin, chair),
          guardSitKey("NW", resolvedSkin, chair),
          guardSitKey("NE", resolvedSkin, chair),
          guardSitKey(dir, 1, chair),
          guardSitKey("NW", 1, chair),
          guardSitKey("NE", 1, chair),
        ];
  const seen = new Set<string>();
  for (const key of fallbacks) {
    if (seen.has(key)) continue;
    seen.add(key);
    if (!textureKeyExists(sprite.scene, key)) continue;
    applyEntitySpriteFrame(
      sprite,
      key,
      GUARD_SIT_FEET_ORIGIN_Y,
      GUARD_SIT_RENDER_HEIGHT,
    );
    return;
  }
  applyGuardIdleAKFrame(
    sprite,
    chair === "campchair" ? "NW" : dir,
    resolvedSkin,
  );
}

/** MilitiaDoctor1 — Walk frame (9-frame strip). */
function applyMilitiaDoctorWalkFrame(
  sprite: Phaser.GameObjects.Sprite,
  dir: DirectionLabel,
  animFrame: number,
) {
  const frame = (Math.floor(animFrame) % MILITIA_DOCTOR_WALK_FRAMES) + 1;
  const key = militiaDoctorWalkFrameKey(dir, frame);
  if (textureKeyExists(sprite.scene, key)) {
    applyEntitySpriteFrame(sprite, key, HUMAN_FEET_ORIGIN_Y);
    return;
  }
  applyGuardIdleAKFrame(sprite, dir, MILITIA_DOCTOR_SKIN, "idle");
}

/** MilitiaCaptain1 — Walk frame (9-frame strip). */
function applyMilitiaCaptainWalkFrame(
  sprite: Phaser.GameObjects.Sprite,
  dir: DirectionLabel,
  animFrame: number,
) {
  const frame = (Math.floor(animFrame) % MILITIA_CAPTAIN_WALK_FRAMES) + 1;
  const key = militiaCaptainWalkFrameKey(dir, frame);
  if (textureKeyExists(sprite.scene, key)) {
    applyEntitySpriteFrame(sprite, key, HUMAN_FEET_ORIGIN_Y);
    return;
  }
  applyGuardIdleAKFrame(sprite, dir, MILITIA_CAPTAIN_SKIN, "idle");
}

/** MilitiaGuard — WalkAK frame; frame 1 used as last-resort idle. Falls back to Guard1. */
function applyGuardWalkAKFrame(
  sprite: Phaser.GameObjects.Sprite,
  dir: DirectionLabel,
  animFrame: number,
  skin = 1,
) {
  if (isMilitiaDoctorSkin(skin)) {
    applyMilitiaDoctorWalkFrame(sprite, dir, animFrame);
    return;
  }
  if (isMilitiaCaptainSkin(skin)) {
    applyMilitiaCaptainWalkFrame(sprite, dir, animFrame);
    return;
  }
  const resolvedSkin = resolveLoadedGuardSkin(skin);
  const frame =
    (Math.floor(animFrame) % militiaGuardWalkFrames(resolvedSkin)) + 1;
  const key = resolveGuardTextureKey(
    sprite,
    guardWalkAKFrameKey(dir, frame, resolvedSkin),
    guardWalkAKFrameKey(dir, frame, 1),
  );
  applyEntitySpriteFrame(sprite, key, HUMAN_FEET_ORIGIN_Y);
}

function applyGuardFireAKFrame(
  sprite: Phaser.GameObjects.Sprite,
  dir: DirectionLabel,
  frame: number,
  skin = 1,
) {
  // Ambient posts have no fire set — use MilitiaGuard1 AK.
  const fireSkin = isMilitiaNonCombatSkin(skin) ? 1 : skin;
  const clampedFrame = Math.max(1, Math.min(8, frame));
  const resolvedSkin = resolveLoadedGuardSkin(fireSkin);
  const key = resolveGuardTextureKey(
    sprite,
    guardFireAKFrameKey(dir, clampedFrame, resolvedSkin),
    guardFireAKFrameKey(dir, clampedFrame, 1),
  );
  applyEntitySpriteFrame(sprite, key, HUMAN_FEET_ORIGIN_Y);
}

function applyGuardDieFrame(
  sprite: Phaser.GameObjects.Sprite,
  dir: DirectionLabel,
  frame: number,
  skin = 1,
) {
  if (isMilitiaDoctorSkin(skin)) {
    const max = MILITIA_AMBIENT_DIE_FRAMES;
    const clamped = Math.max(1, Math.min(max, Math.floor(frame)));
    const key = militiaDoctorDieFrameKey(dir, clamped);
    if (textureKeyExists(sprite.scene, key)) {
      applyEntitySpriteFrame(sprite, key, HUMAN_DIE_FEET_ORIGIN_Y);
      return;
    }
  }
  if (isMilitiaCaptainSkin(skin)) {
    const max = MILITIA_AMBIENT_DIE_FRAMES;
    const clamped = Math.max(1, Math.min(max, Math.floor(frame)));
    const key = militiaCaptainDieFrameKey(dir, clamped);
    if (textureKeyExists(sprite.scene, key)) {
      applyEntitySpriteFrame(sprite, key, HUMAN_DIE_FEET_ORIGIN_Y);
      return;
    }
  }
  const resolvedSkin = resolveLoadedGuardSkin(skin);
  const max = militiaGuardDieFrames(resolvedSkin);
  const clamped = Math.max(1, Math.min(max, Math.floor(frame)));
  const key = resolveGuardTextureKey(
    sprite,
    guardDieFrameKey(dir, clamped, resolvedSkin),
    guardDieFrameKey(dir, clamped, 1),
  );
  applyEntitySpriteFrame(sprite, key, HUMAN_DIE_FEET_ORIGIN_Y);
}

function applyTraderManIdle(sprite: Phaser.GameObjects.Sprite, dir: DirectionLabel) {
  if (!traderManPackReady()) {
    applyGuardIdleAKFrame(sprite, dir, 1);
    return;
  }
  applyEntitySpriteFrame(sprite, traderManIdleKey(dir), HUMAN_FEET_ORIGIN_Y);
}

function applyTraderManWalk(
  sprite: Phaser.GameObjects.Sprite,
  dir: DirectionLabel,
  animFrame: number,
) {
  if (!traderManPackReady()) {
    applyGuardWalkAKFrame(sprite, dir, animFrame, 1);
    return;
  }
  const frame = (Math.floor(animFrame) % 8) + 1;
  applyEntitySpriteFrame(sprite, traderManWalkFrameKey(dir, frame), HUMAN_FEET_ORIGIN_Y);
}

function applyTraderManDie(
  sprite: Phaser.GameObjects.Sprite,
  dir: DirectionLabel,
  frame: number,
) {
  if (!traderManPackReady()) {
    applyGuardDieFrame(sprite, dir, frame, 1);
    return;
  }
  const clamped = Math.max(1, Math.min(8, Math.floor(frame)));
  applyEntitySpriteFrame(sprite, traderManDieFrameKey(dir, clamped), HUMAN_DIE_FEET_ORIGIN_Y);
}

function applyTraderGuardIdle(sprite: Phaser.GameObjects.Sprite, dir: DirectionLabel) {
  if (!traderGuardPackReady()) {
    applyGuardIdleAKFrame(sprite, dir, 1);
    return;
  }
  applyEntitySpriteFrame(sprite, traderGuardIdleKey(dir), HUMAN_FEET_ORIGIN_Y);
}

function applyTraderGuardWalk(
  sprite: Phaser.GameObjects.Sprite,
  dir: DirectionLabel,
  animFrame: number,
) {
  if (!traderGuardPackReady()) {
    applyGuardWalkAKFrame(sprite, dir, animFrame, 1);
    return;
  }
  const frame = (Math.floor(animFrame) % 8) + 1;
  applyEntitySpriteFrame(sprite, traderGuardWalkFrameKey(dir, frame), HUMAN_FEET_ORIGIN_Y);
}

function applyTraderGuardFirePistol(
  sprite: Phaser.GameObjects.Sprite,
  dir: DirectionLabel,
  frame: number,
) {
  if (!traderGuardPackReady()) {
    applyGuardFireAKFrame(sprite, dir, frame, 1);
    return;
  }
  const clamped = Math.max(1, Math.min(8, frame));
  applyEntitySpriteFrame(
    sprite,
    traderGuardFirePistolFrameKey(dir, clamped),
    HUMAN_FEET_ORIGIN_Y,
  );
}

function applyTraderGuardDie(
  sprite: Phaser.GameObjects.Sprite,
  dir: DirectionLabel,
  frame: number,
) {
  if (!traderGuardPackReady()) {
    applyGuardDieFrame(sprite, dir, frame, 1);
    return;
  }
  const clamped = Math.max(1, Math.min(8, Math.floor(frame)));
  applyEntitySpriteFrame(
    sprite,
    traderGuardDieFrameKey(dir, clamped),
    HUMAN_DIE_FEET_ORIGIN_Y,
  );
}

function applyRedManIdle(
  sprite: Phaser.GameObjects.Sprite,
  dir: DirectionLabel,
  skin: number,
) {
  const resolved = resolveLoadedRedManSkin(skin);
  const key = redManIdleKey(dir, resolved);
  if (textureKeyExists(sprite.scene, key)) {
    applyEntitySpriteFrame(sprite, key, HUMAN_FEET_ORIGIN_Y);
    return;
  }
  applyGuardIdleAKFrame(sprite, dir, 1);
}

function applyRedManWalk(
  sprite: Phaser.GameObjects.Sprite,
  dir: DirectionLabel,
  animFrame: number,
  skin: number,
) {
  const frame = (Math.floor(animFrame) % 8) + 1;
  const resolved = resolveLoadedRedManSkin(skin);
  const preferred = redManWalkFrameKey(dir, frame, resolved);
  if (textureKeyExists(sprite.scene, preferred)) {
    applyEntitySpriteFrame(sprite, preferred, HUMAN_FEET_ORIGIN_Y);
    return;
  }
  applyGuardWalkAKFrame(sprite, dir, animFrame, 1);
}

function applyRedManFire(
  sprite: Phaser.GameObjects.Sprite,
  dir: DirectionLabel,
  frame: number,
  skin: number,
) {
  const clamped = Math.max(1, Math.min(8, frame));
  const resolved = resolveLoadedRedManSkin(skin);
  const preferred = redManFireFrameKey(dir, clamped, resolved);
  // Don't fall back across weapon types (shotgun ↔ pistol).
  if (redManUsesShotgun(resolved)) {
    if (textureKeyExists(sprite.scene, preferred)) {
      applyEntitySpriteFrame(sprite, preferred, HUMAN_FEET_ORIGIN_Y);
    } else {
      applyRedManIdle(sprite, dir, resolved);
    }
    return;
  }
  if (textureKeyExists(sprite.scene, preferred)) {
    applyEntitySpriteFrame(sprite, preferred, HUMAN_FEET_ORIGIN_Y);
    return;
  }
  applyRedManIdle(sprite, dir, resolved);
}

function applyRedManDie(
  sprite: Phaser.GameObjects.Sprite,
  dir: DirectionLabel,
  frame: number,
  skin: number,
) {
  const clamped = Math.max(1, Math.min(8, Math.floor(frame)));
  const resolved = resolveLoadedRedManSkin(skin);
  const preferred = redManDieFrameKey(dir, clamped, resolved);
  if (textureKeyExists(sprite.scene, preferred)) {
    applyEntitySpriteFrame(sprite, preferred, HUMAN_DIE_FEET_ORIGIN_Y);
    return;
  }
  applyGuardDieFrame(sprite, dir, clamped, 1);
}

export type EntityVisualState = {
  facing: number;
  anim: string;
  animFrame: number;
  idleWeapon?: string;
  equippedWeaponIndex?: number;
  /** PlayerMan clothing skin (1 bare, 2 white tee, 3 black tee). */
  clothingSkin?: number;
  /** 0-based die frame index (0–8 for PlayerMan); when set, plays Die frames. */
  dieFrame?: number;
  attackFrame?: number;
  isDead?: boolean;
  alive?: boolean;
  /** 1–11 = ZombieMan1–11 */
  zombieSkin?: number;
  /** ZombieMan6 / ZombieMan10 crawler: IdleCrawl / Crawl instead of Idle / Walk. */
  zombieCrawling?: boolean;
  /** 1–2 = MilitiaGuard1–2; 5 = MilitiaGuard3; 3 = MilitiaCaptain1; 4 = MilitiaDoctor1; 1–4 = RedMan1–4 */
  guardSkin?: number;
  /** See GUARD_NPC_* — MilitiaGuard / TraderMan / TraderGuard / RedMan. */
  guardNpcKind?: number;
};

function resolveEquippedWeaponAnimName(state: EntityVisualState): string | undefined {
  if (state.equippedWeaponIndex != null && state.equippedWeaponIndex >= 0) {
    return (
      FIRE_WEAPON_NAMES[state.equippedWeaponIndex] ??
      MELEE_HIT_WEAPON_NAMES[state.equippedWeaponIndex]
    );
  }
  return undefined;
}

/** Weapon idle pose from equipped slot (pistol / shotgun / revolver) when standing still. */
function resolvePlayerIdleWeapon(state: EntityVisualState): string | undefined {
  if (state.equippedWeaponIndex != null && state.equippedWeaponIndex >= 0) {
    const fromEquip = idleWeaponKeyFromIndex(state.equippedWeaponIndex);
    if (fromEquip !== "NoWeapon") return fromEquip;
  }
  if (state.idleWeapon && state.idleWeapon !== "NoWeapon") return state.idleWeapon;
  return undefined;
}

export function updateEntityVisual(
  sprite: Phaser.GameObjects.Sprite,
  kind: "player" | "zombie" | "guard" | "coywolf",
  state: EntityVisualState,
) {
  const dir = DIRECTION_LABELS[((state.facing % 8) + 8) % 8]!;
  const isWalking = state.anim === "walk";
  const isRunning = state.anim === "run";
  const isDead = state.isDead || state.anim === "dead" || state.alive === false;

  sprite.setVisible(true);
  sprite.setActive(true);

  if (kind === "coywolf") {
    if (isDead) {
      const frame = Math.min(9, Math.max(1, (state.dieFrame ?? 0) + 1));
      applyCoywolfFrame(sprite, coywolfDieFrameKey(dir, frame));
    } else if (isRunning) {
      const frame = (Math.floor(state.animFrame) % COYWOLF_RUN_FRAMES) + 1;
      applyCoywolfFrame(sprite, coywolfRunFrameKey(dir, frame));
    } else if (isWalking) {
      const frame = (Math.floor(state.animFrame) % COYWOLF_WALK_FRAMES) + 1;
      applyCoywolfFrame(sprite, coywolfWalkFrameKey(dir, frame));
    } else {
      applyCoywolfFrame(
        sprite,
        coywolfIdleKey(dir),
        COYWOLF_RENDER_HEIGHT * COYWOLF_IDLE_RENDER_SCALE,
      );
    }
    sprite.setAngle(0);
    sprite.setAlpha(1);
    return;
  }

  if (kind === "guard") {
    const npcKind = state.guardNpcKind ?? GUARD_NPC_HUMAN;
    const isAttacking = state.attackFrame != null;

    if (npcKind === GUARD_NPC_TRADER_MAN) {
      if (isDead) {
        const dieFrame = state.dieFrame ?? 7;
        applyTraderManDie(sprite, dir, dieFrame + 1);
      } else if (isWalking) {
        applyTraderManWalk(sprite, dir, state.animFrame);
      } else {
        applyTraderManIdle(sprite, dir);
      }
      sprite.setAngle(0);
      sprite.setAlpha(1);
      return;
    }

    if (npcKind === GUARD_NPC_TRADER_GUARD) {
      if (isDead) {
        const dieFrame = state.dieFrame ?? 7;
        applyTraderGuardDie(sprite, dir, dieFrame + 1);
      } else if (isAttacking) {
        applyTraderGuardFirePistol(sprite, dir, (state.attackFrame ?? 0) + 1);
      } else if (isWalking) {
        applyTraderGuardWalk(sprite, dir, state.animFrame);
      } else {
        applyTraderGuardIdle(sprite, dir);
      }
      sprite.setAngle(0);
      sprite.setAlpha(1);
      return;
    }

    if (npcKind === GUARD_NPC_RED_MAN) {
      const redSkin = resolveLoadedRedManSkin(state.guardSkin ?? 1);
      if (isDead) {
        const dieFrame = state.dieFrame ?? 7;
        applyRedManDie(sprite, dir, dieFrame + 1, redSkin);
      } else if (isAttacking) {
        applyRedManFire(sprite, dir, (state.attackFrame ?? 0) + 1, redSkin);
      } else if (isWalking) {
        applyRedManWalk(sprite, dir, state.animFrame, redSkin);
      } else {
        applyRedManIdle(sprite, dir, redSkin);
      }
      sprite.setAngle(0);
      sprite.setAlpha(1);
      return;
    }

    const guardSkin = state.guardSkin ?? 1;
    // Prefer raw captain/doctor skin so Idle/Die can resolve even before pack marks ready.
    const visualSkin = isMilitiaCaptainSkin(guardSkin)
      ? MILITIA_CAPTAIN_SKIN
      : isMilitiaDoctorSkin(guardSkin)
        ? MILITIA_DOCTOR_SKIN
        : resolveLoadedGuardSkin(guardSkin);
    if (isDead) {
      const dieFrame = state.dieFrame ?? 7;
      applyGuardDieFrame(sprite, dir, dieFrame + 1, visualSkin);
    } else if (isGuardSitAnim(state.anim)) {
      applyGuardSitFrame(sprite, dir, visualSkin, state.anim);
    } else if (isAttacking && !isMilitiaNonCombatSkin(visualSkin)) {
      applyGuardFireAKFrame(sprite, dir, (state.attackFrame ?? 0) + 1, visualSkin);
    } else if (isWalking) {
      applyGuardWalkAKFrame(sprite, dir, state.animFrame, visualSkin);
    } else {
      const idleVariant =
        isMilitiaDoctorSkin(visualSkin) && state.anim === "idle2"
          ? "idle2"
          : "idle";
      applyGuardIdleAKFrame(sprite, dir, visualSkin, idleVariant);
    }
    sprite.setAngle(0);
    sprite.setAlpha(1);
    return;
  }

  if (kind === "player") {
    const idleWeapon = resolvePlayerIdleWeapon(state);
    const isAttacking = state.attackFrame != null;
    const skin = resolveLoadedPlayerSkin(
      state.clothingSkin ?? PLAYER_SKIN_DEFAULT,
      sprite.scene,
    );
    if (isDead) {
      const dieFrame = state.dieFrame ?? PLAYER_DIE_FRAMES - 1;
      applyPlayerDieFrame(sprite, dir, dieFrame + 1, skin);
      sprite.setAngle(0);
      sprite.setAlpha(1);
    } else if (isAttacking) {
      const meleeName =
        state.equippedWeaponIndex != null
          ? MELEE_HIT_WEAPON_NAMES[state.equippedWeaponIndex]
          : undefined;
      if (meleeName) {
        applyPlayerHitFrame(
          sprite,
          dir,
          meleeName,
          (state.attackFrame ?? 0) + 1,
          idleWeapon,
          skin,
        );
      } else {
        const weaponName = resolveEquippedWeaponAnimName(state) ?? "Pistol";
        applyPlayerFireFrame(
          sprite,
          dir,
          weaponName,
          (state.attackFrame ?? 0) + 1,
          idleWeapon,
          skin,
        );
      }
      sprite.setAngle(0);
      sprite.setAlpha(1);
    } else if (isRunning) {
      applyPlayerRunFrame(sprite, dir, state.animFrame, skin);
      sprite.setAngle(0);
      sprite.setAlpha(1);
    } else if (isWalking) {
      applyPlayerWalkFrame(
        sprite,
        dir,
        state.animFrame,
        resolveEquippedWeaponAnimName(state),
        skin,
      );
      sprite.setAngle(0);
      sprite.setAlpha(1);
    } else {
      applyPlayerIdleFrame(sprite, dir, idleWeapon, skin);
      sprite.setAngle(0);
      sprite.setAlpha(1);
    }
    return;
  }

  const zombieSkin = resolveLoadedZombieSkin(state.zombieSkin ?? 1);
  const crawling =
    state.zombieCrawling === true && zombieHasCrawlVariant(zombieSkin);

  if (isDead) {
    const dieFrame = state.dieFrame ?? 7;
    applyZombieDieFrame(sprite, dir, dieFrame + 1, zombieSkin);
    sprite.setAngle(0);
    sprite.setAlpha(1);
  } else if (isWalking || state.anim === "attack") {
    applyZombieWalkFrame(sprite, dir, state.animFrame, zombieSkin, crawling);
    sprite.setAngle(0);
    sprite.setAlpha(1);
  } else {
    const crawlIdle = crawling ? zombieIdleCrawlKey(dir, zombieSkin) : "";
    const idleKey = zombieIdleKey(dir, zombieSkin);
    const fallback = zombieIdleKey(dir, 1);
    const key =
      crawlIdle && textureKeyExists(sprite.scene, crawlIdle)
        ? crawlIdle
        : textureKeyExists(sprite.scene, idleKey)
          ? idleKey
          : fallback;
    applyIdleFrame(
      sprite,
      key,
      key === crawlIdle ? zombieCrawlOriginY(zombieSkin, dir) : ZOMBIE_FEET_ORIGIN_Y,
      zombieRenderHeight(zombieSkin, key === crawlIdle),
    );
    sprite.setAngle(0);
    sprite.setAlpha(1);
  }
}

/** Extra downward nudge so the sprite clears bottom-padding in the PNG frames. */
const FEET_Y_PADDING = 6;

/** Screen Y for entity feet — tile vertical centre plus bottom-padding compensation. */
export function entityFeetY(isoY: number) {
  return isoY + FEET_Y_PADDING;
}

export function entityDepth(x: number, y: number) {
  return (x + y) * 10 + 5;
}
