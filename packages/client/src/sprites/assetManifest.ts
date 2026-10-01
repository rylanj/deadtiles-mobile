import {
  DIRECTION_LABELS,
  PLAYER_DIE_FRAMES,
  PLAYER_FIRE_FRAMES,
  PLAYER_SKIN_DEFAULT,
  PLAYER_WALK_FRAMES,
  COYWOLF_RUN_FRAMES,
  BEAR_RUN_FRAMES,
  BEAR_WALK_FRAMES,
  BEAR_DIE_FRAMES,
  ZOMBIE_WALK_FRAMES,
  zombieHasCrawlVariant,
  zombieDieFrameCount,
  normalizeRedManSkin,
  isMilitiaCaptainSkin,
  isMilitiaDoctorSkin,
  MILITIA_CAPTAIN_SKIN,
  MILITIA_DOCTOR_SKIN,
  GUARD_SKIN_3,
  MILITIA_AMBIENT_DIE_FRAMES,
  MILITIA_CAPTAIN_WALK_FRAMES,
  MILITIA_DOCTOR_WALK_FRAMES,
  militiaGuardArtSkin,
  militiaGuardWalkFrames,
  militiaGuardDieFrames,
} from "@zombie/shared";
import { ANIMATED_FURNITURE } from "./furnitureTable";

/**
 * Single source of truth for "which PNG files belong to which pack".
 *
 * Both the runtime loader and the offline atlas packer (scripts/pack-atlases.mts)
 * read this, so an atlas can never drift from what the game asks for. Keep this
 * module free of Phaser and DOM imports so it runs under plain node/tsx.
 */

export type EntityPackId =
  | `zombie-${number}`
  | `guard-${number}`
  | `redman-${number}`
  | `player-${number}`
  | "traderman"
  | "traderguard"
  | "coywolf"
  | "bear";

/** Packs that are not entities but still benefit from atlasing. */
export type ExtraPackId = "furniture";

export type PackId = EntityPackId | ExtraPackId;

export type PackEntry = {
  /** Phaser texture key used by all existing call sites. Becomes the atlas frame name. */
  key: string;
  /** Path relative to /assets. */
  path: string;
};

/** PlayerMan clothing skins shipped under /assets/PlayerMan{n}/. */
export function normalizePlayerClothingSkin(skin: number): number {
  const s = Math.floor(skin) || PLAYER_SKIN_DEFAULT;
  if (s === 2 || s === 3) return s;
  return PLAYER_SKIN_DEFAULT;
}

function animFrameTag(frame: number): string {
  return String(frame).padStart(4, "0");
}

type TrackFn = (key: string, path: string) => void;

function scheduleZombiePack(skin: number, track: TrackFn) {
  const man = `ZombieMan${skin}`;
  for (const dir of DIRECTION_LABELS) {
    track(`zombieman${skin}-idle-${dir}`, `${man}/Idle/${man}_Idle_${dir}.png`);
    for (let f = 1; f <= ZOMBIE_WALK_FRAMES; f++) {
      const tag = animFrameTag(f);
      track(
        `zombieman${skin}-walk-${dir}-${tag}`,
        `${man}/Walk/${man}_Walk_${dir}_${tag}.png`,
      );
    }
    for (let f = 1; f <= zombieDieFrameCount(skin); f++) {
      const tag = animFrameTag(f);
      track(
        `zombieman${skin}-die-${dir}-${tag}`,
        `${man}/Die/${man}_Die_${dir}_${tag}.png`,
      );
    }
    if (zombieHasCrawlVariant(skin)) {
      track(
        `zombieman${skin}-idlecrawl-${dir}`,
        `${man}/IdleCrawl/${man}_IdleCrawl_${dir}.png`,
      );
      for (let f = 1; f <= ZOMBIE_WALK_FRAMES; f++) {
        const tag = animFrameTag(f);
        track(
          `zombieman${skin}-crawl-${dir}-${tag}`,
          `${man}/Crawl/${man}_Crawl_${dir}_${tag}.png`,
        );
      }
    }
  }
}

function scheduleCoywolfPack(track: TrackFn) {
  for (const dir of DIRECTION_LABELS) {
    track(
      `coywolf-idle-${dir}`,
      `Coywolf1/Idle/Coywolf_Idle_${dir}.png`,
    );
    for (let f = 1; f <= 8; f++) {
      const tag = animFrameTag(f);
      track(
        `coywolf-walk-${dir}-${tag}`,
        `Coywolf1/Walk/Coywolf1_Walk_${dir}_${tag}.png`,
      );
    }
    for (let f = 1; f <= COYWOLF_RUN_FRAMES; f++) {
      const tag = animFrameTag(f);
      track(
        `coywolf-run-${dir}-${tag}`,
        `Coywolf1/Run/Coywolf1_Run_${dir}_${tag}.png`,
      );
    }
    for (let f = 1; f <= 9; f++) {
      const tag = animFrameTag(f);
      track(
        `coywolf-die-${dir}-${tag}`,
        `Coywolf1/Die/Coywolf1_Die_${dir}_${tag}.png`,
      );
    }
  }
}

function scheduleBearPack(track: TrackFn) {
  for (const dir of DIRECTION_LABELS) {
    track(`bear-idle-${dir}`, `Bear1/Idle/Bear1_Idle_${dir}.png`);
    for (let f = 1; f <= BEAR_WALK_FRAMES; f++) {
      const tag = animFrameTag(f);
      track(
        `bear-walk-${dir}-${tag}`,
        `Bear1/Walk/Bear1_Walk_${dir}_${tag}.png`,
      );
    }
    for (let f = 1; f <= BEAR_RUN_FRAMES; f++) {
      const tag = animFrameTag(f);
      track(
        `bear-run-${dir}-${tag}`,
        `Bear1/Run/Bear1_Run_${dir}_${tag}.png`,
      );
    }
    for (let f = 1; f <= BEAR_DIE_FRAMES; f++) {
      const tag = animFrameTag(f);
      track(
        `bear-die-${dir}-${tag}`,
        `Bear1/Die/Bear1_Die_${dir}_${tag}.png`,
      );
    }
  }
}

function scheduleMilitiaGuardSit(skin: number, track: TrackFn) {
  const s = militiaGuardArtSkin(skin);
  for (const chair of ["CampChair1", "CanteenChair1"] as const) {
    const chairKey = chair === "CampChair1" ? "campchair" : "canteenchair";
    for (const dir of ["NE", "NW"] as const) {
      track(
        `militiaguard${s}-sit-${chairKey}-${dir}`,
        `MilitiaGuard${s}/Sit/MilitiaGuard${s}_${chair}_${dir}.png`,
      );
    }
  }
}

function scheduleMilitiaGuardPack(skin: number, track: TrackFn) {
  const s = militiaGuardArtSkin(skin);
  const walkFrames = militiaGuardWalkFrames(skin);
  const dieFrames = militiaGuardDieFrames(skin);
  const hasFireAk = s !== 3;
  for (const dir of DIRECTION_LABELS) {
    track(
      `militiaguard${s}-idle-ak-${dir}`,
      `MilitiaGuard${s}/IdleAK/MilitiaGuard${s}_IdleAK_${dir}.png`,
    );
    for (let f = 1; f <= walkFrames; f++) {
      const tag = animFrameTag(f);
      track(
        `militiaguard${s}-walk-ak-${dir}-${tag}`,
        `MilitiaGuard${s}/WalkAK/MilitiaGuard${s}_WalkAK_${dir}_${tag}.png`,
      );
    }
    if (hasFireAk) {
      for (let f = 1; f <= 8; f++) {
        const tag = animFrameTag(f);
        track(
          `militiaguard${s}-fire-ak-${dir}-${tag}`,
          `MilitiaGuard${s}/FireAK/MilitiaGuard${s}_FireAK_${dir}_${tag}.png`,
        );
      }
    }
    for (let f = 1; f <= dieFrames; f++) {
      const tag = animFrameTag(f);
      track(
        `militiaguard${s}-die-${dir}-${tag}`,
        `MilitiaGuard${s}/Die/MilitiaGuard${s}_Die_${dir}_${tag}.png`,
      );
    }
  }
  scheduleMilitiaGuardSit(skin, track);
}

function scheduleMilitiaCaptainPack(track: TrackFn) {
  for (const dir of DIRECTION_LABELS) {
    track(
      `militiacaptain1-idle-${dir}`,
      `MilitiaCaptain1/Idle/MilitiaCaptain1_Idle_${dir}.png`,
    );
    for (let f = 1; f <= MILITIA_CAPTAIN_WALK_FRAMES; f++) {
      const tag = animFrameTag(f);
      track(
        `militiacaptain1-walk-${dir}-${tag}`,
        `MilitiaCaptain1/Walk/MilitiaCaptain1_Walk_${dir}_${tag}.png`,
      );
    }
    for (let f = 1; f <= MILITIA_AMBIENT_DIE_FRAMES; f++) {
      const tag = animFrameTag(f);
      track(
        `militiacaptain1-die-${dir}-${tag}`,
        `MilitiaCaptain1/Die/MilitiaCaptain1_Die_${dir}_${tag}.png`,
      );
    }
  }
}

function scheduleMilitiaDoctorPack(track: TrackFn) {
  for (const dir of DIRECTION_LABELS) {
    track(
      `militiadoctor1-idle-${dir}`,
      `MilitiaDoctor1/Idle/MilitiaDoctor1_Idle_${dir}.png`,
    );
    track(
      `militiadoctor1-idle2-${dir}`,
      `MilitiaDoctor1/Idle2/MilitiaDoctor1_Idle2_${dir}.png`,
    );
    for (let f = 1; f <= MILITIA_DOCTOR_WALK_FRAMES; f++) {
      const tag = animFrameTag(f);
      track(
        `militiadoctor1-walk-${dir}-${tag}`,
        `MilitiaDoctor1/Walk/MilitiaDoctor1_Walk_${dir}_${tag}.png`,
      );
    }
    for (let f = 1; f <= MILITIA_AMBIENT_DIE_FRAMES; f++) {
      const tag = animFrameTag(f);
      track(
        `militiadoctor1-die-${dir}-${tag}`,
        `MilitiaDoctor1/Die/MilitiaDoctor1_Die_${dir}_${tag}.png`,
      );
    }
  }
}

function scheduleGuardPack(skin: number, track: TrackFn) {
  if (isMilitiaCaptainSkin(skin) || skin === MILITIA_CAPTAIN_SKIN) {
    // Guard1 AK is boot-resident. Do NOT track those keys into this pack —
    // unloading would delete shared MilitiaGuard1 art and leave patrols missing.
    scheduleMilitiaCaptainPack(track);
    return;
  }
  if (isMilitiaDoctorSkin(skin) || skin === MILITIA_DOCTOR_SKIN) {
    scheduleMilitiaDoctorPack(track);
    return;
  }
  scheduleMilitiaGuardPack(skin, track);
}

function scheduleRedManPack(skin: number, track: TrackFn) {
  const s = normalizeRedManSkin(skin);
  const folder = `RedMan${s}`;
  const idle = s === 2 ? "IdleShotgun" : "IdlePistol";
  const walk = s === 2 ? "WalkShotgun" : "WalkPistol";
  const fire = s === 2 ? "FireShotgun" : "FirePistol";
  for (const dir of DIRECTION_LABELS) {
    track(
      `redman${s}-${idle.toLowerCase()}-${dir}`,
      `${folder}/${idle}/${folder}_${idle}_${dir}.png`,
    );
    for (let f = 1; f <= 8; f++) {
      const tag = animFrameTag(f);
      track(
        `redman${s}-${walk.toLowerCase()}-${dir}-${tag}`,
        `${folder}/${walk}/${folder}_${walk}_${dir}_${tag}.png`,
      );
      track(
        `redman${s}-${fire.toLowerCase()}-${dir}-${tag}`,
        `${folder}/${fire}/${folder}_${fire}_${dir}_${tag}.png`,
      );
      track(
        `redman${s}-die-${dir}-${tag}`,
        `${folder}/Die/${folder}_Die_${dir}_${tag}.png`,
      );
    }
  }
}

function scheduleTraderManPack(track: TrackFn) {
  for (const dir of DIRECTION_LABELS) {
    track(`traderman1-idle-${dir}`, `TraderMan1/Idle/TraderMan1_Idle_${dir}.png`);
    for (let f = 1; f <= 8; f++) {
      const tag = animFrameTag(f);
      track(
        `traderman1-walk-${dir}-${tag}`,
        `TraderMan1/Walk/TraderMan1_Walk_${dir}_${tag}.png`,
      );
      track(
        `traderman1-die-${dir}-${tag}`,
        `TraderMan1/Die/TraderMan1_Die_${dir}_${tag}.png`,
      );
    }
  }
}

function scheduleTraderGuardPack(track: TrackFn) {
  for (const dir of DIRECTION_LABELS) {
    track(
      `traderguard1-idle-${dir}`,
      `TraderGuard1/Idle/TraderGuard1_Idle_${dir}.png`,
    );
    track(
      `traderguard1-idle2-${dir}`,
      `TraderGuard1/Idle2/TraderGuard1_Idle2_${dir}.png`,
    );
    for (let f = 1; f <= 8; f++) {
      const tag = animFrameTag(f);
      track(
        `traderguard1-walk-${dir}-${tag}`,
        `TraderGuard1/Walk/TraderGuard1_Walk_${dir}_${tag}.png`,
      );
      track(
        `traderguard1-fire-pistol-${dir}-${tag}`,
        `TraderGuard1/FirePistol/TraderGuard1_FirePistol_${dir}_${tag}.png`,
      );
      track(
        `traderguard1-die-${dir}-${tag}`,
        `TraderGuard1/Die/TraderGuard1_Die_${dir}_${tag}.png`,
      );
    }
  }
}

const PLAYER_FIRE_WEAPON_NAMES = [
  "Pistol",
  "Shotgun",
  "Revolver",
  "AK",
  "HuntingRifle",
  "M4",
] as const;
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
const PLAYER_WALK_WEAPON_NAMES = PLAYER_IDLE_WEAPON_NAMES;
const PLAYER_HIT_WEAPON_NAMES = ["Bat", "Hammer", "Hatchet"] as const;

function schedulePlayerPack(skin: number, track: TrackFn) {
  const s = normalizePlayerClothingSkin(skin);
  const man = `PlayerMan${s}`;
  const prefix = `playerman${s}`;
  for (const dir of DIRECTION_LABELS) {
    track(`${prefix}-idle-${dir}`, `${man}/Idle/${man}_Idle_${dir}.png`);
    for (const weaponName of PLAYER_IDLE_WEAPON_NAMES) {
      track(
        `${prefix}-idle-${weaponName.toLowerCase()}-${dir}`,
        `${man}/Idle${weaponName}/${man}_Idle${weaponName}_${dir}.png`,
      );
    }
  }
  for (const weaponName of PLAYER_FIRE_WEAPON_NAMES) {
    for (const dir of DIRECTION_LABELS) {
      for (let f = 1; f <= PLAYER_FIRE_FRAMES; f++) {
        const tag = animFrameTag(f);
        track(
          `${prefix}-fire-${weaponName.toLowerCase()}-${dir}-${tag}`,
          `${man}/Fire${weaponName}/${man}_Fire${weaponName}_${dir}_${tag}.png`,
        );
      }
    }
  }
  for (const weaponName of PLAYER_WALK_WEAPON_NAMES) {
    for (const dir of DIRECTION_LABELS) {
      for (let f = 1; f <= PLAYER_WALK_FRAMES; f++) {
        const tag = animFrameTag(f);
        track(
          `${prefix}-walk-${weaponName.toLowerCase()}-${dir}-${tag}`,
          `${man}/Walk${weaponName}/${man}_Walk${weaponName}_${dir}_${tag}.png`,
        );
      }
    }
  }
  for (const weaponName of PLAYER_HIT_WEAPON_NAMES) {
    for (const dir of DIRECTION_LABELS) {
      for (let f = 1; f <= PLAYER_FIRE_FRAMES; f++) {
        const tag = animFrameTag(f);
        track(
          `${prefix}-hit-${weaponName.toLowerCase()}-${dir}-${tag}`,
          `${man}/Hit${weaponName}/${man}_Hit${weaponName}_${dir}_${tag}.png`,
        );
      }
    }
  }
  for (const dir of DIRECTION_LABELS) {
    for (let f = 1; f <= PLAYER_WALK_FRAMES; f++) {
      const tag = animFrameTag(f);
      track(
        `${prefix}-walk-${dir}-${tag}`,
        `${man}/Walk/${man}_Walk_${dir}_${tag}.png`,
      );
      track(`${prefix}-run-${dir}-${tag}`, `${man}/Run/${man}_Run_${dir}_${tag}.png`);
    }
    for (let f = 1; f <= PLAYER_DIE_FRAMES; f++) {
      const tag = animFrameTag(f);
      track(
        `${prefix}-die-${dir}-${tag}`,
        `${man}/Die/${man}_Die_${dir}_${tag}.png`,
      );
    }
  }
}

/**
 * Furniture is only ever visible inside a building interior, so it loads on
 * first interior enter rather than at boot (151MB of VRAM off the boot path).
 */
const FIREPLACE_ACTIVE_FRAMES = 8;

function scheduleFurniturePack(track: TrackFn) {
  for (const def of ANIMATED_FURNITURE) {
    track(
      def.idleKey,
      `${def.folder}/${def.filePrefix}_Idle_${def.facing}.png`,
    );
    if (def.frameCount <= 0) continue;
    for (let frame = 1; frame <= def.frameCount; frame++) {
      const tag = animFrameTag(frame);
      track(
        `${def.idleKey}-searched-${tag}`,
        `${def.folder}/${def.filePrefix}_Searched_${def.facing}_${tag}.png`,
      );
    }
  }
  track(
    "furniture-fireplace1-inactive",
    "Furniture/Fireplace1/Fireplace1_Inactive_SE.png",
  );
  track(
    "furniture-storagebox1",
    "Furniture/StorageBox1/StorageBox1_Inactive_SE.png",
  );
  track(
    "furniture-storagebox2",
    "Furniture/StorageBox2/StorageBox2_Inactive_SE.png",
  );
  for (let frame = 1; frame <= FIREPLACE_ACTIVE_FRAMES; frame++) {
    const tag = animFrameTag(frame);
    track(
      `furniture-fireplace1-active-${tag}`,
      `Furniture/Fireplace1/Fireplace1_Active_SE_${tag}.png`,
    );
  }
  for (const facing of ["SE", "SW"] as const) {
    const face = facing.toLowerCase();
    track(
      `furniture-furnace1-inactive-${face}`,
      `Furniture/Furnace1/Furnace1_Inactive_${facing}.png`,
    );
    for (let frame = 1; frame <= FIREPLACE_ACTIVE_FRAMES; frame++) {
      const tag = animFrameTag(frame);
      track(
        `furniture-furnace1-active-${face}-${tag}`,
        `Furniture/Furnace1/Furnace1_Active_${facing}_${tag}.png`,
      );
    }
  }
  for (const facing of ["SE", "SW"] as const) {
    const face = facing.toLowerCase();
    track(
      `furniture-mantel1-inactive-${face}`,
      `Furniture/Mantel1/Mantel1_Inactive_${facing}.png`,
    );
    for (let frame = 1; frame <= 9; frame++) {
      const tag = animFrameTag(frame);
      track(
        `furniture-mantel1-active-${face}-${tag}`,
        `Furniture/Mantel1/Mantel1_Active_${facing}_${tag}.png`,
      );
    }
  }
}

export function schedulePackTextures(id: PackId, track: TrackFn) {
  if (id === "furniture") {
    scheduleFurniturePack(track);
  } else if (id.startsWith("zombie-")) {
    scheduleZombiePack(Number(id.slice(7)), track);
  } else if (id.startsWith("guard-")) {
    scheduleGuardPack(Number(id.slice(6)), track);
  } else if (id.startsWith("redman-")) {
    scheduleRedManPack(Number(id.slice(7)), track);
  } else if (id.startsWith("player-")) {
    schedulePlayerPack(Number(id.slice(7)), track);
  } else if (id === "traderman") {
    scheduleTraderManPack(track);
  } else if (id === "traderguard") {
    scheduleTraderGuardPack(track);
  } else if (id === "coywolf") {
    scheduleCoywolfPack(track);
  } else if (id === "bear") {
    scheduleBearPack(track);
  }
}

/** Flat (key, path) list for one pack. Used by the packer and by fallback loads. */
export function packEntries(id: PackId): PackEntry[] {
  const entries: PackEntry[] = [];
  schedulePackTextures(id, (key, path) => entries.push({ key, path }));
  return entries;
}

/** Every pack the offline packer should build. */
export function allPackIds(): PackId[] {
  const ids: PackId[] = [];
  for (let s = 1; s <= 11; s++) ids.push(`zombie-${s}`);
  for (const s of [1, 2, MILITIA_CAPTAIN_SKIN, MILITIA_DOCTOR_SKIN, GUARD_SKIN_3]) {
    ids.push(`guard-${s}`);
  }
  for (let s = 1; s <= 4; s++) ids.push(`redman-${s}`);
  for (let s = 1; s <= 3; s++) ids.push(`player-${s}`);
  ids.push("traderman", "traderguard", "coywolf", "bear", "furniture");
  return ids;
}

/** Packs loaded at boot and never unloaded (fallback art for missing skins). */
export const BOOT_PACK_IDS: PackId[] = ["zombie-1", "guard-1", "player-1"];

export function isBootPackId(id: PackId): boolean {
  return BOOT_PACK_IDS.includes(id);
}

/** Atlas key for a pack, e.g. "atlas-player-1". */
export function atlasKeyForPack(id: PackId): string {
  return `atlas-${id}`;
}
