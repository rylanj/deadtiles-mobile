/** 8-way compass labels — matches original Zombie Survival Game asset filenames. */
import {
  DIE_ANIM_MS,
  GUARD_NPC_HUMAN,
  GUARD_NPC_TRADER_GUARD,
  PLAYER_SPEED,
  SPRINT_SPEED,
  ZOMBIE_SPEED,
} from "./constants.js";
import { getBuildingAt, seededRandom } from "./worldgen.js";

export const DIRECTION_LABELS = [
  "N",
  "NE",
  "E",
  "SE",
  "S",
  "SW",
  "W",
  "NW",
] as const;

export type DirectionLabel = (typeof DIRECTION_LABELS)[number];

/** True when a militia guard anim is a chair sit pose. */
export function isGuardSitAnim(anim: string | undefined): boolean {
  if (!anim) return false;
  return anim === "sit" || anim.startsWith("sit-");
}

export type GuardSitChair = "campchair" | "canteenchair";

export function guardSitChairFromAnim(
  anim: string | undefined,
): GuardSitChair {
  return anim?.includes("campchair") ? "campchair" : "canteenchair";
}

export function guardSitAnimForChair(objectType: string): string {
  return objectType === "campchair" ? "sit-campchair" : "sit-canteenchair";
}

/** Horizontal walk/run strip frame count per direction (guards / HumanMan1). */
export const SPRITE_WALK_FRAMES = 8;

/** ZombieMan Walk frame count per direction. */
export const ZOMBIE_WALK_FRAMES = 9;

/** Death animation frame count per direction PNG (guards / HumanMan1 / ZombieMan1–7). */
export const SPRITE_DIE_FRAMES = 8;

/** ZombieMan8–11 Die frame count (newer packs). */
export const ZOMBIE_DIE_FRAMES_LONG = 9;

/** PlayerMan Walk / Run / Walk{Weapon} frame count. */
export const PLAYER_WALK_FRAMES = 9;

/** PlayerMan Die frame count. */
export const PLAYER_DIE_FRAMES = 9;

/** PlayerMan Fire{Weapon} frame count. */
export const PLAYER_FIRE_FRAMES = 5;

/** Default clothing variant until character select exists (PlayerMan1). */
export const PLAYER_SKIN_DEFAULT = 1;

export const SPRITE_DIRECTIONS = 8;

/** On-screen entity height in pixels. */
export const ENTITY_RENDER_HEIGHT = 80;

/** Player walk frame advance per 60fps tick (original ANIMATION_SPEED). */
export const PLAYER_ANIMATION_SPEED = 0.1;

/**
 * Grid tiles of movement required to advance the walk animation by one frame.
 * Higher value = slower animation relative to movement (use ~0.20 for walking).
 */
export const PLAYER_TILES_PER_RUN_FRAME = 0.20;

/**
 * WalkPistol leg cycle — 10% faster than the default walk strip
 * (lower tiles/frame = quicker steps).
 */
export const PLAYER_WALK_PISTOL_ANIM_BOOST = 1.1;

export const PLAYER_TILES_PER_WALK_PISTOL_FRAME =
  PLAYER_TILES_PER_RUN_FRAME / PLAYER_WALK_PISTOL_ANIM_BOOST;

/**
 * Run leg cycle vs movement — run art reads better slightly faster than the
 * walk-speed-matched formula alone (lower tiles/frame = quicker steps).
 */
export const SPRINT_ANIM_FRAME_BOOST = 1.35;

export const PLAYER_TILES_PER_SPRINT_FRAME =
  (PLAYER_TILES_PER_RUN_FRAME * (SPRINT_SPEED / PLAYER_SPEED)) /
  SPRINT_ANIM_FRAME_BOOST;

/** 0-based die frame index from elapsed ms; clamps on the last frame. */
export function dieAnimFrameIndex(
  elapsedMs: number,
  totalMs: number = DIE_ANIM_MS,
  frameCount: number = SPRITE_DIE_FRAMES,
): number {
  if (elapsedMs <= 0) return 0;
  const frame = Math.floor((elapsedMs / totalMs) * frameCount);
  return Math.min(frameCount - 1, frame);
}

/** Advance walk/run strip frame index from world distance traveled. */
export function advanceWalkAnimFrame(
  animFrame: number,
  distanceMoved: number,
  tilesPerFrame = PLAYER_TILES_PER_RUN_FRAME,
  frameCount: number = SPRITE_WALK_FRAMES,
) {
  if (distanceMoved <= 0) return animFrame;
  return (animFrame + distanceMoved / tilesPerFrame) % frameCount;
}

/**
 * World tiles covered by one full zombie walk cycle (tune to ZombieMan art).
 * One cycle at max speed takes ZOMBIE_WALK_CYCLE_TILES / ZOMBIE_SPEED seconds.
 */
export const ZOMBIE_WALK_CYCLE_TILES = 0.52;

/** Derived from art stride — do not tune directly; adjust ZOMBIE_WALK_CYCLE_TILES. */
export const ZOMBIE_TILES_PER_WALK_FRAME =
  ZOMBIE_WALK_CYCLE_TILES / ZOMBIE_WALK_FRAMES;

/** Duration of one walk cycle at max zombie speed (seconds). */
export const ZOMBIE_WALK_CYCLE_SEC = ZOMBIE_WALK_CYCLE_TILES / ZOMBIE_SPEED;

/** Sprite variant synced on ZombieState.skin (1–11 = ZombieMan1–11). */
export const ZOMBIE_SKIN_COUNT = 11;
/** Skins rolled everywhere (excludes the PD-only officer). */
export const ZOMBIE_COMMON_SKIN_COUNT = 10;
export const ZOMBIE_SKIN_MAN1 = 1;
export const ZOMBIE_SKIN_MAN2 = 2;
export const ZOMBIE_SKIN_MAN3 = 3;
export const ZOMBIE_SKIN_MAN4 = 4;
export const ZOMBIE_SKIN_MAN5 = 5;
export const ZOMBIE_SKIN_MAN6 = 6;
/** Share of ZombieMan6 and ZombieMan10 spawns that use IdleCrawl / Crawl. */
export const ZOMBIE_CRAWL_SPAWN_CHANCE = 0.5;
export const ZOMBIE_SKIN_MAN7 = 7;
export const ZOMBIE_SKIN_MAN8 = 8;
export const ZOMBIE_SKIN_MAN9 = 9;
export const ZOMBIE_SKIN_MAN10 = 10;
/** Police-officer zombie — only near / inside police stations. */
export const ZOMBIE_SKIN_MAN11 = 11;
export type ZombieSkinId =
  | typeof ZOMBIE_SKIN_MAN1
  | typeof ZOMBIE_SKIN_MAN2
  | typeof ZOMBIE_SKIN_MAN3
  | typeof ZOMBIE_SKIN_MAN4
  | typeof ZOMBIE_SKIN_MAN5
  | typeof ZOMBIE_SKIN_MAN6
  | typeof ZOMBIE_SKIN_MAN7
  | typeof ZOMBIE_SKIN_MAN8
  | typeof ZOMBIE_SKIN_MAN9
  | typeof ZOMBIE_SKIN_MAN10
  | typeof ZOMBIE_SKIN_MAN11;

/**
 * When a spawn is eligible (near/inside a PD), roll this chance for skin 11
 * instead of a common 1–10 skin.
 */
export const ZOMBIE_POLICE_OFFICER_SPAWN_CHANCE = 0.1;
/** Overworld Chebyshev tiles from a PD footprint that still allow skin 11. */
export const ZOMBIE_POLICE_NEAR_RADIUS = 20;

export function isZombiePoliceOfficerSkin(skin: number | undefined): boolean {
  return normalizeZombieSkin(skin) === ZOMBIE_SKIN_MAN11;
}

/** True when world coords sit inside a police station footprint. */
export function isInsidePoliceStation(x: number, y: number): boolean {
  const bld = getBuildingAt(Math.floor(x), Math.floor(y));
  return bld?.buildingType === "police_station";
}

/**
 * True when a spawn is on/near a police station, or inside a PD interior
 * (use building origin for interiors — interior local coords aren't world tiles).
 */
export function canSpawnPoliceOfficerZombie(
  x: number,
  y: number,
  opts?: { inInterior?: boolean; buildingX?: number; buildingY?: number },
): boolean {
  if (opts?.inInterior) {
    const bx = opts.buildingX ?? Math.floor(x);
    const by = opts.buildingY ?? Math.floor(y);
    const bld = getBuildingAt(bx, by);
    return bld?.buildingType === "police_station";
  }
  if (isInsidePoliceStation(x, y)) return true;
  return isNearPoliceStation(x, y, ZOMBIE_POLICE_NEAR_RADIUS);
}

/** True when within `radius` tiles of a police station AABB. */
export function isNearPoliceStation(
  x: number,
  y: number,
  radius: number = ZOMBIE_POLICE_NEAR_RADIUS,
): boolean {
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  const seen = new Set<string>();
  // Step by 2 — PDs are 7×7, so we still hit every station footprint.
  for (let dy = -radius; dy <= radius; dy += 2) {
    for (let dx = -radius; dx <= radius; dx += 2) {
      const bld = getBuildingAt(tx + dx, ty + dy);
      if (!bld || bld.buildingType !== "police_station") continue;
      const key = `${bld.ox},${bld.oy}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const closestX = Math.min(
        Math.max(tx, bld.ox),
        bld.ox + bld.w - 1,
      );
      const closestY = Math.min(
        Math.max(ty, bld.oy),
        bld.oy + bld.h - 1,
      );
      const chebyshev = Math.max(
        Math.abs(tx - closestX),
        Math.abs(ty - closestY),
      );
      if (chebyshev <= radius) return true;
    }
  }
  return false;
}

/**
 * Deterministic skin roll for a zombie id.
 * Skin 11 (police officer) only when `allowPoliceOfficer` is set.
 */
export function rollZombieSkin(
  seedKey: string,
  opts?: { allowPoliceOfficer?: boolean },
): ZombieSkinId {
  const rng = seededRandom(`zombie-skin:${seedKey}`);
  if (
    opts?.allowPoliceOfficer &&
    rng() < ZOMBIE_POLICE_OFFICER_SPAWN_CHANCE
  ) {
    return ZOMBIE_SKIN_MAN11;
  }
  return (Math.floor(rng() * ZOMBIE_COMMON_SKIN_COUNT) + 1) as ZombieSkinId;
}

/** Skins that ship IdleCrawl / Crawl and can roll the crawling posture. */
export function zombieHasCrawlVariant(skin: number | undefined): boolean {
  const s = normalizeZombieSkin(skin);
  return s === ZOMBIE_SKIN_MAN6 || s === ZOMBIE_SKIN_MAN10;
}

/** Stable per zombie id, so every client shows the same posture. */
export function isZombieCrawler(
  id: string,
  skin: number | undefined,
): boolean {
  if (!zombieHasCrawlVariant(skin)) return false;
  return seededRandom(`zombie-crawl:${id}`)() < ZOMBIE_CRAWL_SPAWN_CHANCE;
}

/** Crawlers stay at this fraction of a standing zombie's speed, day and night. */
export const ZOMBIE_CRAWL_SPEED_SCALE = 0.6;

/**
 * Crawl sheets fill more of the 256 frame than the standing body, so the
 * same render height makes them read much larger. Drawn at this fraction.
 */
export const ZOMBIE_CRAWL_RENDER_SCALE = 0.9;

export function zombieBaseSpeed(crawling: boolean): number {
  return crawling ? ZOMBIE_SPEED * ZOMBIE_CRAWL_SPEED_SCALE : ZOMBIE_SPEED;
}

export function normalizeZombieSkin(skin: number | undefined): ZombieSkinId {
  if (skin != null && skin >= 1 && skin <= ZOMBIE_SKIN_COUNT) {
    return skin as ZombieSkinId;
  }
  return ZOMBIE_SKIN_MAN1;
}

/** Per-skin display scale vs {@link ENTITY_RENDER_HEIGHT}. Missing = 1. */
const ZOMBIE_SKIN_RENDER_SCALE: Partial<Record<ZombieSkinId, number>> = {
  [ZOMBIE_SKIN_MAN9]: 0.9,
};

/** On-screen height for a zombie skin (ZombieMan9 is 10% shorter). */
export function zombieRenderHeight(skin?: number, crawling = false): number {
  const s = normalizeZombieSkin(skin);
  const scale =
    (ZOMBIE_SKIN_RENDER_SCALE[s] ?? 1) *
    (crawling ? ZOMBIE_CRAWL_RENDER_SCALE : 1);
  return ENTITY_RENDER_HEIGHT * scale;
}

/** Die frames shipped for a zombie skin. */
export function zombieDieFrameCount(skin: number | undefined): number {
  const s = normalizeZombieSkin(skin);
  return s >= ZOMBIE_SKIN_MAN8 ? ZOMBIE_DIE_FRAMES_LONG : SPRITE_DIE_FRAMES;
}

/** Die clip length — same pacing as {@link DIE_ANIM_MS} per frame. */
export function zombieDieAnimMs(skin: number | undefined): number {
  const frames = zombieDieFrameCount(skin);
  return Math.round((DIE_ANIM_MS * frames) / SPRITE_DIE_FRAMES);
}

/**
 * Sprite variant synced on GuardState.skin.
 * 1–2 = MilitiaGuard1–2; 5 = MilitiaGuard3 (3/4 are captain/doctor).
 */
export const GUARD_SKIN_1 = 1;
export const GUARD_SKIN_2 = 2;
/** MilitiaGuard3. Not 3: that id is {@link MILITIA_CAPTAIN_SKIN}. */
export const GUARD_SKIN_3 = 5;
/** MilitiaCaptain1 — Birchport military barracks mess hall (not rolled). */
export const MILITIA_CAPTAIN_SKIN = 3;
/** MilitiaDoctor1 — stationary Birchport hospital ward (not rolled). */
export const MILITIA_DOCTOR_SKIN = 4;
/** MilitiaCaptain1 / MilitiaDoctor1 / MilitiaGuard3 die strips are 9 frames. */
export const MILITIA_AMBIENT_DIE_FRAMES = 9;
/** MilitiaGuard3 Walk strip frame count (Guard1/2 are {@link SPRITE_WALK_FRAMES}). */
export const MILITIA_GUARD3_WALK_FRAMES = 9;
/** Rolled street / diner militia (excludes captain and doctor). */
export const MILITIA_GUARD_SKINS = [
  GUARD_SKIN_1,
  GUARD_SKIN_2,
  GUARD_SKIN_3,
] as const;
export const GUARD_SKIN_COUNT = MILITIA_GUARD_SKINS.length;
export type GuardSkinId =
  | typeof GUARD_SKIN_1
  | typeof GUARD_SKIN_2
  | typeof GUARD_SKIN_3
  | typeof MILITIA_CAPTAIN_SKIN
  | typeof MILITIA_DOCTOR_SKIN;

/** Deterministic even mix across MilitiaGuard1–3. */
export function rollGuardSkin(seedKey: string): GuardSkinId {
  const rng = seededRandom(`guard-skin:${seedKey}`);
  return MILITIA_GUARD_SKINS[
    Math.floor(rng() * MILITIA_GUARD_SKINS.length)
  ]!;
}

export function normalizeGuardSkin(skin: number | undefined): GuardSkinId {
  if (skin === MILITIA_CAPTAIN_SKIN) return MILITIA_CAPTAIN_SKIN;
  if (skin === MILITIA_DOCTOR_SKIN) return MILITIA_DOCTOR_SKIN;
  if (skin === GUARD_SKIN_3) return GUARD_SKIN_3;
  if (skin === GUARD_SKIN_2) return GUARD_SKIN_2;
  if (skin === GUARD_SKIN_1) return GUARD_SKIN_1;
  return GUARD_SKIN_1;
}

/**
 * MilitiaGuard folder / texture index (1–3). Captain and doctor are not
 * Guard3; callers must branch those skins first.
 */
export function militiaGuardArtSkin(skin: number | undefined): 1 | 2 | 3 {
  if (skin === GUARD_SKIN_2) return 2;
  if (skin === GUARD_SKIN_3) return 3;
  return 1;
}

export function isMilitiaCaptainSkin(skin: number | undefined): boolean {
  return normalizeGuardSkin(skin) === MILITIA_CAPTAIN_SKIN;
}

export function isMilitiaDoctorSkin(skin: number | undefined): boolean {
  return normalizeGuardSkin(skin) === MILITIA_DOCTOR_SKIN;
}

/** Captain / doctor — idle ambient posts that do not open fire. */
export function isMilitiaNonCombatSkin(skin: number | undefined): boolean {
  return isMilitiaCaptainSkin(skin) || isMilitiaDoctorSkin(skin);
}

/** MilitiaGuard1–3 and TraderGuard1 wear body armour. TraderMan, captain, doctor, and Red Order do not. */
export function isMilitiaArmoredGuard(
  npcKind: number | undefined,
  skin: number | undefined,
): boolean {
  if (npcKind === GUARD_NPC_TRADER_GUARD) return true;
  if (npcKind !== GUARD_NPC_HUMAN) return false;
  if (isMilitiaNonCombatSkin(skin)) return false;
  return (
    skin === GUARD_SKIN_1 ||
    skin === GUARD_SKIN_2 ||
    skin === GUARD_SKIN_3
  );
}

/** MilitiaGuard1–3, MilitiaCaptain1, or MilitiaDoctor1 — talk dialog skins. */
export function isMilitiaTalkSkin(skin: number | undefined): boolean {
  const s = normalizeGuardSkin(skin);
  return (
    s === GUARD_SKIN_1 ||
    s === GUARD_SKIN_2 ||
    s === GUARD_SKIN_3 ||
    s === MILITIA_CAPTAIN_SKIN ||
    s === MILITIA_DOCTOR_SKIN
  );
}

/** Die clip length for captain / doctor (9 frames). */
export function militiaAmbientDieAnimMs(): number {
  return Math.round(
    (DIE_ANIM_MS * MILITIA_AMBIENT_DIE_FRAMES) / SPRITE_DIE_FRAMES,
  );
}

export function militiaGuardWalkFrames(skin: number | undefined): number {
  if (isMilitiaCaptainSkin(skin)) return MILITIA_CAPTAIN_WALK_FRAMES;
  if (isMilitiaDoctorSkin(skin)) return MILITIA_DOCTOR_WALK_FRAMES;
  return militiaGuardArtSkin(skin) === 3
    ? MILITIA_GUARD3_WALK_FRAMES
    : SPRITE_WALK_FRAMES;
}

export function militiaGuardDieFrames(skin: number | undefined): number {
  if (isMilitiaNonCombatSkin(skin) || militiaGuardArtSkin(skin) === 3) {
    return MILITIA_AMBIENT_DIE_FRAMES;
  }
  return SPRITE_DIE_FRAMES;
}

export function militiaGuardDieAnimMs(skin: number | undefined): number {
  return Math.round(
    (DIE_ANIM_MS * militiaGuardDieFrames(skin)) / SPRITE_DIE_FRAMES,
  );
}

/** MilitiaDoctor1 Walk strip frame count (9 per direction). */
export const MILITIA_DOCTOR_WALK_FRAMES = 9;

/** MilitiaCaptain1 Walk strip frame count (9 per direction). */
export const MILITIA_CAPTAIN_WALK_FRAMES = 9;

/** @deprecated Prefer {@link isMilitiaTalkSkin}. */
export function isMilitiaGuardTalkSkin(skin: number | undefined): boolean {
  return isMilitiaTalkSkin(skin);
}

/** RedMan1–4 (pistol / shotgun / pistol / pistol). */
export type RedManSkinId = 1 | 2 | 3 | 4;

export function normalizeRedManSkin(skin: number | undefined): RedManSkinId {
  if (skin != null && skin >= 1 && skin <= 4) {
    return skin as RedManSkinId;
  }
  return 1;
}

/** Trader caravan sprite folders (TraderMan1 / TraderGuard1). */
export const TRADER_MAN_SKIN = 1;
export const TRADER_GUARD_SKIN = 1;

/** Idle weapon variants for Survivor1_Idle_{weapon}_{dir}.png */
export const IDLE_WEAPON_KEYS = [
  "NoWeapon",
  "Pistol",
  "Shotgun",
  "HuntingRifle",
  "Revolver",
  "AK",
  "Hammer",
  "Bat",
  "Hatchet",
  "M4",
] as const;

export type IdleWeaponKey = (typeof IDLE_WEAPON_KEYS)[number];

export function directionLabel(index: number): DirectionLabel {
  return DIRECTION_LABELS[((index % 8) + 8) % 8]!;
}

/** Screen-space angle → 8-way facing (original getDirectionFromAngle). */
export function directionFromScreenAngle(angleRad: number): number {
  let angleDeg = angleRad * (180 / Math.PI);
  angleDeg = (90 - angleDeg + 360) % 360;
  return Math.floor((angleDeg + 22.5) / 45) % 8;
}

/** WASD / arrow screen input (-1, 0, 1 each) → 8-way facing (original game_loop). */
export function directionFromScreenInput(screenDx: number, screenDy: number): number {
  const dxSign = screenDx > 0 ? 1 : screenDx < 0 ? -1 : 0;
  const dySign = screenDy > 0 ? 1 : screenDy < 0 ? -1 : 0;

  if (dySign === -1 && dxSign === -1) return 7; // NW
  if (dySign === -1 && dxSign === 0) return 0; // N
  if (dySign === -1 && dxSign === 1) return 1; // NE
  if (dySign === 0 && dxSign === 1) return 2; // E
  if (dySign === 1 && dxSign === 1) return 3; // SE
  if (dySign === 1 && dxSign === 0) return 4; // S
  if (dySign === 1 && dxSign === -1) return 5; // SW
  if (dySign === 0 && dxSign === -1) return 6; // W
  return 4;
}

/** Screen WASD vector → normalized world movement delta. */
export function screenInputToWorldDelta(screenDx: number, screenDy: number) {
  if (screenDx === 0 && screenDy === 0) return { x: 0, y: 0 };
  let wx = 0.5 * screenDx + 0.5 * screenDy;
  let wy = -0.5 * screenDx + 0.5 * screenDy;
  const len = Math.hypot(wx, wy);
  return { x: wx / len, y: wy / len };
}

/** World movement delta → screen angle → 8-way facing. */
export function directionFromWorldDelta(dx: number, dy: number): number {
  if (dx === 0 && dy === 0) return 4;
  const screenDx = dx - dy;
  const screenDy = dx + dy;
  const screenAngle = Math.atan2(-screenDy, screenDx);
  return directionFromScreenAngle(screenAngle);
}
