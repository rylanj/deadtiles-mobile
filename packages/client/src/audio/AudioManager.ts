/**
 * Client audio — placeholder registry so real files can be dropped in later.
 *
 * How to add a sound:
 * 1. Drop a file under `public/assets/audio/` (gunshots, fireplace, ambience, rain, thunder, eat/drink, search, zombie groans live in folders)
 * 2. Add the matching id to {@link SFX_READY} (or a gunshot bank / groan bank below)
 * 3. Restart the client
 *
 * Missing / not-listed ids stay silent — no 404s, no code churn elsewhere.
 */

import type Phaser from "phaser";
import {
  GUNSHOT_VARIANT_COUNT,
  cartesianToIso,
  gunshotHearRadius,
  gunshotListenPoints,
  resolveGunshotVariant,
  getConsumeAction,
  getItemDefinition,
  WEAPONS,
  ACTION_SFX_HEAR_RADIUS,
  ACTION_SFX_FULL_DIST,
  ZOMBIE_GROAN_COUNT,
  ZOMBIE_GROAN_HEAR_RADIUS,
  RELOAD_DURATION_MS,
  UNLOAD_DURATION_MS,
} from "@zombie/shared";
import {
  FOOTSTEP_DEFAULT_SURFACE,
  FOOTSTEP_FILE,
  FOOTSTEP_GAIN,
  FOOTSTEP_GAITS,
  FOOTSTEP_RATE,
  FOOTSTEP_SURFACES,
  footstepKey,
  resolveFootstepSurface,
  type FootstepGait,
  type FootstepSurface,
} from "./footsteps";

/** Logical SFX ids used by gameplay code. */
export type SfxId =
  | "gunshot"
  | "reload"
  | "melee_swing"
  | "zombie_aggro"
  | "footstep_walk"
  | "footstep_run"
  | "ui_open"
  | "ui_close"
  | "inventory_open"
  | "inventory_close"
  | "journal"
  | "quest"
  | "trade"
  | "death"
  | "fireplace";

/**
 * Relative paths under `public/`. Prefer `.ogg` then `.mp3`.
 */
export const SFX_FILES: Record<SfxId, readonly string[]> = {
  gunshot: ["assets/audio/gunshot.ogg", "assets/audio/gunshot.mp3"],
  reload: ["assets/audio/reload.ogg", "assets/audio/reload.mp3"],
  melee_swing: ["assets/audio/melee_swing.ogg", "assets/audio/melee_swing.mp3"],
  zombie_aggro: ["assets/audio/zombie_aggro.ogg", "assets/audio/zombie_aggro.mp3"],
  footstep_walk: [
    "assets/audio/footstep_walk.ogg",
    "assets/audio/footstep_walk.mp3",
  ],
  footstep_run: [
    "assets/audio/footstep_run.ogg",
    "assets/audio/footstep_run.mp3",
  ],
  ui_open: ["assets/audio/ui_open.ogg", "assets/audio/ui_open.mp3"],
  ui_close: ["assets/audio/ui_close.ogg", "assets/audio/ui_close.mp3"],
  inventory_open: ["assets/audio/Inventory/OpenInventory.wav"],
  inventory_close: ["assets/audio/Inventory/CloseInventory.wav"],
  journal: ["assets/audio/Journal.wav"],
  quest: ["assets/audio/Quest.wav"],
  trade: ["assets/audio/Trade.wav"],
  death: ["assets/audio/death.ogg", "assets/audio/death.mp3"],
  fireplace: ["assets/audio/Fireplace/Fireplace1.wav"],
};

/**
 * Per-weapon shot banks. Files are `{stem}1.wav` … `{stem}{variants}.wav`.
 * Browser Web Audio only decodes 8/16-bit PCM WAV (not 24-bit / 96 kHz masters).
 * Re-run `node scripts/convert-gunshot-wavs.mjs` if new files fail to decode.
 */
const GUNSHOT_BANKS: Record<
  string,
  { dir: string; stem: string; variants?: number }
> = {
  weapon_pistol: { dir: "Pistol", stem: "Pistol", variants: 2 },
  weapon_revolver: { dir: "Revolver", stem: "Revolver" },
  weapon_shotgun: { dir: "Shotgun", stem: "Shotgun" },
  weapon_m4a1: { dir: "M4", stem: "M4" },
  weapon_assault_rifle: { dir: "AK", stem: "AK" },
  weapon_hunting_rifle: { dir: "HuntingRifle", stem: "HuntingRifle", variants: 1 },
};

/**
 * Extra trim for banks mastered well above the pistol takes.
 * Missing ids stay at 1. Shotguns remain the loudest shot.
 */
const GUNSHOT_BANK_GAIN: Record<string, number> = {
  weapon_shotgun: 0.6,
};

function gunshotBankVariants(itemId: string): number {
  const n = GUNSHOT_BANKS[itemId]?.variants ?? GUNSHOT_VARIANT_COUNT;
  return Math.max(1, n);
}

/**
 * Only these ids are loaded at boot (avoids 404 spam for missing placeholders).
 * Add an id here once its file exists under `public/assets/audio/`.
 */
export const SFX_READY: readonly SfxId[] = [
  "fireplace",
  "inventory_open",
  "inventory_close",
  "journal",
  "quest",
  "trade",
];

const VOLUME_KEY = "deadtiles.sfxVolume";
const MUTE_KEY = "deadtiles.sfxMute";

/** Heard distance in tiles that still plays at full volume. */
const GUNSHOT_FULL_DIST = 10;
/** Fireplace crackle is close-range compared to gunshots. */
const FIREPLACE_HEAR_RADIUS = 22;
const FIREPLACE_FULL_DIST = 5;
/** Loop peaks near full scale. Sit it with the rain bed, not on top of it. */
const FIREPLACE_GAIN = 0.6;
/** Extinguish hiss is a hotter file than the crackle loop. */
const FIREPLACE_EXTINGUISH_GAIN = 0.22;
/** Bed under outdoor scenes. Keep this just-noticeable, not a mix layer. */
const WIND_AMBIENCE_GAIN = 0.1;
const WIND_FADE_IN_PER_SEC = 0.14;
const WIND_FADE_OUT_PER_SEC = 0.22;
const EXTERIOR_RAIN_GAIN = 0.38;
const EXTERIOR_RAIN_VARIANTS = 3;
/** Overlap between rain takes so the next clip is already in when the last ends. */
const RAIN_CROSSFADE_MS = 1600;
const INTERIOR_RAIN_GAIN = 0.4;
/** Exterior takes are mastered near a gunshot. This keeps thunder under the shotgun. */
const THUNDER_GAIN = 0.55;
const THUNDER_COUNT = 2;
/** Quiet bed under the login panel. Sits under UI, not a title theme. */
const MENU_GAIN = 0.2;
const MENU_FADE_OUT_MS = 1500;
const MENU_RETRY_MS = 250;
const FOREST_AMBIENCE_GAIN = 0.3;
const FOREST_AMBIENCE_VARIANTS = { day: 2, night: 2 } as const;
/** First forest cue waits a bit so it does not fire on the treeline. */
const FOREST_ENTER_MIN_MS = 22_000;
const FOREST_ENTER_MAX_MS = 50_000;
/** Gap after a forest clip ends. Sparse on purpose. */
const FOREST_GAP_MIN_MS = 75_000;
const FOREST_GAP_MAX_MS = 160_000;
/** After day/night flips in-forest, wait a shorter beat before the other bed. */
const FOREST_PERIOD_SWITCH_MIN_MS = 8_000;
const FOREST_PERIOD_SWITCH_MAX_MS = 20_000;
const GUNSHOT_PAN_ISO_PX = 520;
/** Other-building / indoor-vs-outdoor volume (except street-into-interior). */
const GUNSHOT_WALL_MUFFLE = 0.5;
/** Street fire heard from inside: quieter plus a low-pass. */
const GUNSHOT_EXTERIOR_MUFFLE = 0.4;
const GUNSHOT_EXTERIOR_LOWPASS_HZ = 1700;
const GUNSHOT_MIN_GAIN = 0.02;
/** Volume multiplier at minimum camera zoom (fully zoomed out). */
const GUNSHOT_ZOOM_OUT_GAIN = 0.5;
/** Volume multiplier at maximum camera zoom (fully zoomed in). */
const GUNSHOT_ZOOM_IN_GAIN = 1;
export { ZOMBIE_GROAN_HEAR_RADIUS, ZOMBIE_GROAN_COUNT };
/** Full groan volume at this distance; linear fade to silent at hear radius. */
const ZOMBIE_GROAN_FULL_DIST = 1;
/** Groan files peak near full scale. Keep a close walker under a rifle shot. */
const ZOMBIE_GROAN_GAIN = 0.4;
const ZOMBIE_GROAN_MAX_LIVE = 4;
const TREE_FALL_HEAR_RADIUS = 50;
const TREE_FALL_FULL_DIST = 12;
const TREE_FALL_GAIN = 0.75;
/**
 * Phaser playback rate for Tree/Chop1.wav. 1 = file speed.
 * Below 1 slows the take, above 1 speeds it up.
 */
export const TREE_CHOP_RATE = 1.2;
/** Chop is a loop and stays loud out to the tree-fall distance. */
const TREE_CHOP_GAIN = 0.45;
const MELEE_HIT_COUNT = 4;
type MeleeHitBank = "blade" | "blunt";
const MELEE_HIT_BANKS: readonly MeleeHitBank[] = ["blade", "blunt"];
const MELEE_HIT_GAIN: Record<MeleeHitBank, number> = {
  blade: 0.7,
  blunt: 0.32,
};
const DOOR_HEAR_RADIUS = 22;
const DOOR_FULL_DIST = 6;
/** Wooden doors. Hospital cubicle files are hotter, so they use a lower gain. */
const DOOR_GAIN = 0.3;
const HOSPITAL_DOOR_GAIN = 0.2;
/**
 * LockedDoor1 peaks near OpenDoor1. Wooden doors play at 0.3, so this
 * stays under that baseline.
 */
const LOCKED_DOOR_GAIN = 0.25;
/**
 * Lockpicking1 peaks near a search take. Search plays at 0.15, and this
 * loop uses the same gain so a long pick stays at that level.
 */
const LOCKPICK_GAIN = 0.15;
/** Eat, drink, and medical clips. The louder takes (soda, vitamins) were above the doors. */
const CONSUME_GAIN = 0.35;
const INVENTORY_UI_GAIN = 0.12;
/**
 * Journal.wav peaks near OpenDoor1. Wooden doors play at 0.3, so this
 * stays under that baseline.
 */
const JOURNAL_GAIN = 0.25;
/**
 * Quest.wav peaks hotter than Journal.wav. 0.1 keeps the sting at the
 * journal level, under the wooden door.
 */
const QUEST_GAIN = 0.1;
/**
 * Trade.wav peaks at 0.34. Journal plays at 0.25 on a 0.20 peak and
 * quest at 0.1 on a 0.51 peak, so both land near 0.05. 0.15 matches that.
 */
const TRADE_GAIN = 0.15;

export type GunshotListener = {
  x: number;
  y: number;
  zoom: number;
  zoomMin: number;
  zoomMax: number;
  inInterior: boolean;
  buildingX: number;
  buildingY: number;
};

export type GunshotSource = {
  x: number;
  y: number;
  noiseRadius: number;
  inInterior?: boolean;
  buildingX?: number;
  buildingY?: number;
};

/** Lit fireplace the listener can hear. `id` is stable for the tile. */
export type FireplaceAudioSource = {
  id: string;
  x: number;
  y: number;
  inInterior?: boolean;
  buildingX?: number;
  buildingY?: number;
};

type LiveGunshot = {
  sound: Phaser.Sound.BaseSound;
  source: GunshotSource;
  fileGain: number;
};

type LiveFireplace = {
  sound: Phaser.Sound.BaseSound;
  source: GunshotSource;
  exteriorMuffle: boolean;
};

type LiveFootstep = {
  sound: Phaser.Sound.BaseSound;
  source: GunshotSource;
  surface: FootstepSurface;
  gait: FootstepGait;
  exteriorMuffle: boolean;
};

type LiveAction = {
  sound: Phaser.Sound.BaseSound;
  source: GunshotSource;
  baseVolume: number;
};

type LiveSpatial = LiveAction & {
  fullDist: number;
};

type LiveTreeFall = {
  sound: Phaser.Sound.BaseSound | null;
  delay: Phaser.Time.TimerEvent | null;
  source: GunshotSource;
};

type LiveTreeChop = {
  sound: Phaser.Sound.BaseSound;
  source: GunshotSource;
};

type ForestAmbiencePeriod = "day" | "night";

type FadedLoop = {
  sound: Phaser.Sound.BaseSound | null;
  gain: number;
};

/** One-shots crossfaded in random order (exterior rain 1–3). */
type RainPlaylist = {
  gain: number;
  outgoing: Phaser.Sound.BaseSound | null;
  incoming: Phaser.Sound.BaseSound | null;
  outgoingKey: string;
  incomingKey: string;
  lastVariant: number;
  mix: number;
  fadeMs: number;
};

function emptyRainPlaylist(): RainPlaylist {
  return {
    gain: 0,
    outgoing: null,
    incoming: null,
    outgoingKey: "",
    incomingKey: "",
    lastVariant: -1,
    mix: 0,
    fadeMs: RAIN_CROSSFADE_MS,
  };
}

let singleton: AudioManager | null = null;
let sharedAudioContext: AudioContext | null = null;
let unlockHooked = false;

function createSharedAudioContext(): AudioContext {
  if (sharedAudioContext) return sharedAudioContext;
  const Ctor =
    window.AudioContext ||
    (
      window as unknown as {
        webkitAudioContext: typeof AudioContext;
      }
    ).webkitAudioContext;
  sharedAudioContext = new Ctor();
  return sharedAudioContext;
}

export class AudioManager {
  private scene: Phaser.Scene | null = null;
  private loaded = new Set<string>();
  private volume = 0.7;
  private muted = false;
  private listener: GunshotListener | null = null;
  private liveGunshots: LiveGunshot[] = [];
  private liveOneShots: LiveSpatial[] = [];
  private liveFireplaces = new Map<string, LiveFireplace>();
  private liveFootsteps = new Map<string, LiveFootstep>();
  private windSound: Phaser.Sound.BaseSound | null = null;
  private windGain = 0;
  private forestSound: Phaser.Sound.BaseSound | null = null;
  private forestScheduled = false;
  private nextForestAt = 0;
  private forestPeriod: ForestAmbiencePeriod | null = null;
  private lastForestVariant = -1;
  private actionSounds = new Map<string, LiveAction>();
  private actionDelays = new Map<string, Phaser.Time.TimerEvent>();
  /** Cuts a clip that runs longer than the action bar. */
  private actionStopDelays = new Map<string, Phaser.Time.TimerEvent>();
  private treeFalls = new Map<string, LiveTreeFall>();
  private treeChops = new Map<string, LiveTreeChop>();
  private liveZombieGroans: LiveGunshot[] = [];
  private lastZombieGroanVariant = -1;
  private lastMeleeHitVariant: Partial<Record<MeleeHitBank, number>> = {};
  private exteriorRain: RainPlaylist = emptyRainPlaylist();
  private interiorRain: FadedLoop = { sound: null, gain: 0 };
  private menuSound: Phaser.Sound.BaseSound | null = null;
  private menuWanted = false;
  private menuFade = 1;
  private menuFading = false;
  private menuFadeRaf = 0;
  private menuRetryTimer = 0;
  private lastThunderVariant = -1;
  private backgroundAudioHooked = false;
  private phaserUnlockCalled = false;
  /** Cache key -> relative WAV path, for play debug logs. */
  private sourceFiles = new Map<string, string>();

  static get(): AudioManager {
    if (!singleton) singleton = new AudioManager();
    return singleton;
  }

  /**
   * Create the shared AudioContext and listen for page gestures before Phaser
   * boots. Clicks on the boot loader / HTML menu unlock Web Audio in the same
   * turn so the menu bed can start without a later click on the canvas.
   */
  static arm(): AudioContext {
    const ctx = createSharedAudioContext();
    AudioManager.get().installUnlockHook();
    if (ctx.state === "suspended" || ctx.state === "interrupted") {
      void ctx.resume();
    }
    return ctx;
  }

  /** Call from BootScene.preload — queues loads for {@link SFX_READY} only. */
  preload(scene: Phaser.Scene) {
    this.scene = scene;
    this.volume = readStoredVolume();
    this.muted = readStoredMute();
    scene.sound.pauseOnBlur = false;

    // Boot queues sprites with setPath("/assets"). Phaser prepends that to
    // every URL, so "assets/audio/..." would fetch /assets/assets/audio/...
    // and Vite would serve index.html. decodeAudioData then fails.
    const prevPath = scene.load.path;
    scene.load.setPath("");

    const loadWav = (key: string, rel: string) => {
      scene.load.audio(key, [audioUrl(rel)]);
      this.sourceFiles.set(key, rel);
    };

    for (const id of SFX_READY) {
      const paths = SFX_FILES[id];
      if (!paths?.length) continue;
      scene.load.audio(sfxKey(id), paths.map(audioUrl));
      this.sourceFiles.set(sfxKey(id), paths[0]!);
    }

    for (const [itemId, bank] of Object.entries(GUNSHOT_BANKS)) {
      const count = gunshotBankVariants(itemId);
      for (let i = 0; i < count; i++) {
        const n = i + 1;
        loadWav(gunshotKey(itemId, i), `${bank.dir}/${bank.stem}${n}.wav`);
      }
    }

    loadWav(menuKey(), "Menu.wav");
    loadWav(windAmbienceKey(), "Ambience/WindAmbience1.wav");
    for (let i = 0; i < EXTERIOR_RAIN_VARIANTS; i++) {
      loadWav(rainAmbienceKey("exterior", i), `Weather/ExteriorRain${i + 1}.wav`);
    }
    loadWav(rainAmbienceKey("interior", 0), "Weather/InteriorRain1.wav");
    for (const kind of ["exterior", "interior"] as const) {
      const stem = kind === "exterior" ? "ExteriorThunder" : "InteriorThunder";
      for (let i = 0; i < THUNDER_COUNT; i++) {
        loadWav(thunderKey(kind, i), `Weather/${stem}${i + 1}.wav`);
      }
    }
    for (const period of ["day", "night"] as const) {
      const count = FOREST_AMBIENCE_VARIANTS[period];
      for (let i = 0; i < count; i++) {
        loadWav(forestAmbienceKey(period, i), forestAmbienceFile(period, i));
      }
    }
    loadWav(consumeKey("drink", 0), "Drink/Drink1.wav");
    loadWav(consumeKey("drink", 1), "Drink/Drink2.wav");
    loadWav(consumeKey("eat", 0), "Eat/Eat1.wav");
    loadWav(consumeKey("eat", 1), "Eat/Eat2.wav");
    loadWav(consumeKey("eat", 2), "Eat/Eat3.wav");
    loadWav(consumeKey("bandage", 0), "Medical/Bandage1.wav");
    loadWav(consumeKey("tincture", 0), "Medical/Tincture1.wav");
    loadWav(consumeKey("vitamins", 0), "Medical/Vitamins1.wav");
    loadWav(consumeKey("pills", 0), "Medical/Pills1.wav");
    loadWav(fireplaceExtinguishKey(), "Fireplace/ExtinguishFireplace1.wav");
    loadWav(treeFallKey(), "Tree/Fall1.wav");
    loadWav(treeChopKey(), "Tree/Chop1.wav");
    for (const bank of MELEE_HIT_BANKS) {
      const dir = bank === "blade" ? "Blade" : "Blunt";
      for (let i = 0; i < MELEE_HIT_COUNT; i++) {
        loadWav(meleeHitKey(bank, i), `${dir}/Hit${i + 1}.wav`);
      }
    }
    loadWav(doorCloseKey("wood"), "Door/CloseDoor1.wav");
    loadWav(doorOpenKey("wood"), "Door/OpenDoor1.wav");
    loadWav(doorLockedKey(), "Door/LockedDoor1.wav");
    loadWav(doorLockpickKey(), "Door/Lockpicking1.wav");
    loadWav(doorCloseKey("hospital"), "Door/CloseDoor2.wav");
    loadWav(doorOpenKey("hospital"), "Door/OpenDoor2.wav");
    loadWav(searchKey("body", 0), "Search/SearchBody1.wav");
    for (let i = 1; i <= FURNITURE_SEARCH_BANK_COUNT; i++) {
      loadWav(furnitureSearchKey(i), `Search/Search${i}.wav`);
    }
    loadWav(reloadKey("pistol", 0), "Pistol/ReloadPistol1.wav");
    loadWav(reloadKey("ak", 0), "AK/ReloadAK1.wav");
    loadWav(reloadKey("m4", 0), "M4/ReloadM41.wav");
    loadWav(reloadKey("revolver", 0), "Revolver/ReloadRevolver1.wav");
    loadWav(reloadKey("hunting", 0), "HuntingRifle/ReloadHuntingRifle1.wav");
    loadWav(reloadKey("shotgun", 0), "Shotgun/ReloadShotgun1.wav");
    loadWav(unloadKey("pistol", 0), "Pistol/UnloadPistol1.wav");
    loadWav(unloadKey("ak", 0), "AK/UnloadAK1.wav");
    loadWav(unloadKey("m4", 0), "M4/UnloadM41.wav");
    loadWav(unloadKey("revolver", 0), "Revolver/UnloadRevolver1.wav");
    loadWav(unloadKey("hunting", 0), "HuntingRifle/UnloadHuntingRifle1.wav");
    loadWav(unloadKey("shotgun", 0), "Shotgun/UnloadShotgun1.wav");
    for (let i = 0; i < ZOMBIE_GROAN_COUNT; i++) {
      loadWav(zombieGroanKey(i), `Zombie/ZombieGroan${i + 1}.wav`);
    }
    for (const surface of FOOTSTEP_SURFACES) {
      for (const gait of FOOTSTEP_GAITS) {
        loadWav(footstepKey(surface, gait), FOOTSTEP_FILE[surface][gait]);
      }
    }

    scene.load.setPath(prevPath);

    scene.load.on("loaderror", (file: { key?: string }) => {
      if (typeof file?.key === "string" && file.key.startsWith("sfx:")) {
        /* noop — keep boot going */
      }
    });
  }

  /** Call from BootScene.create after load completes. */
  bind(scene: Phaser.Scene) {
    this.scene = scene;
    this.enableBackgroundAudio(scene);
    for (const id of SFX_READY) {
      if (scene.cache.audio.exists(sfxKey(id))) {
        this.loaded.add(id);
      }
    }
    for (const itemId of Object.keys(GUNSHOT_BANKS)) {
      const count = gunshotBankVariants(itemId);
      for (let i = 0; i < count; i++) {
        if (scene.cache.audio.exists(gunshotKey(itemId, i))) {
          this.loaded.add(gunshotKey(itemId, i));
        }
      }
    }
    if (scene.cache.audio.exists(menuKey())) {
      this.loaded.add(menuKey());
    }
    if (scene.cache.audio.exists(windAmbienceKey())) {
      this.loaded.add(windAmbienceKey());
    }
    for (let i = 0; i < EXTERIOR_RAIN_VARIANTS; i++) {
      const key = rainAmbienceKey("exterior", i);
      if (scene.cache.audio.exists(key)) this.loaded.add(key);
    }
    if (scene.cache.audio.exists(rainAmbienceKey("interior", 0))) {
      this.loaded.add(rainAmbienceKey("interior", 0));
    }
    for (const kind of ["exterior", "interior"] as const) {
      for (let i = 0; i < THUNDER_COUNT; i++) {
        const key = thunderKey(kind, i);
        if (scene.cache.audio.exists(key)) this.loaded.add(key);
      }
    }
    for (const period of ["day", "night"] as const) {
      const count = FOREST_AMBIENCE_VARIANTS[period];
      for (let i = 0; i < count; i++) {
        const key = forestAmbienceKey(period, i);
        if (scene.cache.audio.exists(key)) this.loaded.add(key);
      }
    }
    for (const key of [
      consumeKey("drink", 0),
      consumeKey("drink", 1),
      consumeKey("eat", 0),
      consumeKey("eat", 1),
      consumeKey("eat", 2),
      consumeKey("bandage", 0),
      consumeKey("tincture", 0),
      consumeKey("vitamins", 0),
      consumeKey("pills", 0),
      fireplaceExtinguishKey(),
      treeFallKey(),
      treeChopKey(),
      doorCloseKey("wood"),
      doorOpenKey("wood"),
      doorLockedKey(),
      doorLockpickKey(),
      doorCloseKey("hospital"),
      doorOpenKey("hospital"),
      searchKey("body", 0),
      ...Array.from({ length: FURNITURE_SEARCH_BANK_COUNT }, (_, i) =>
        furnitureSearchKey(i + 1),
      ),
      reloadKey("pistol", 0),
      reloadKey("ak", 0),
      reloadKey("m4", 0),
      reloadKey("revolver", 0),
      reloadKey("hunting", 0),
      reloadKey("shotgun", 0),
      unloadKey("pistol", 0),
      unloadKey("ak", 0),
      unloadKey("m4", 0),
      unloadKey("revolver", 0),
      unloadKey("hunting", 0),
      unloadKey("shotgun", 0),
    ]) {
      if (scene.cache.audio.exists(key)) this.loaded.add(key);
    }
    for (let i = 0; i < ZOMBIE_GROAN_COUNT; i++) {
      const key = zombieGroanKey(i);
      if (scene.cache.audio.exists(key)) this.loaded.add(key);
    }
    for (const bank of MELEE_HIT_BANKS) {
      for (let i = 0; i < MELEE_HIT_COUNT; i++) {
        const key = meleeHitKey(bank, i);
        if (scene.cache.audio.exists(key)) this.loaded.add(key);
      }
    }
    for (const surface of FOOTSTEP_SURFACES) {
      for (const gait of FOOTSTEP_GAITS) {
        const key = footstepKey(surface, gait);
        if (scene.cache.audio.exists(key)) this.loaded.add(key);
      }
    }
  }

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
    try {
      localStorage.setItem(VOLUME_KEY, String(this.volume));
    } catch {
      /* ignore */
    }
    this.refreshLiveGunshots();
    this.refreshLiveFireplaces();
    this.refreshLiveFootsteps();
    this.refreshLiveActionSounds();
    this.refreshLiveOneShots();
    this.refreshLiveZombieGroans();
    this.refreshLiveTreeFalls();
    this.refreshLiveTreeChops();
    this.refreshWindAmbience();
    this.refreshRainAmbience();
    this.refreshForestAmbience();
    this.refreshMenu();
  }

  getVolume(): number {
    return this.volume;
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    try {
      localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
    } catch {
      /* ignore */
    }
    if (muted) {
      for (const live of this.liveGunshots) {
        try {
          live.sound.stop();
        } catch {
          /* ignore */
        }
      }
      this.liveGunshots = [];
      for (const live of this.liveOneShots) {
        try {
          live.sound.stop();
        } catch {
          /* ignore */
        }
      }
      this.liveOneShots = [];
      this.stopFireplaces();
      this.stopAmbience();
      this.stopAllActionSounds();
      this.stopFootsteps();
      this.stopZombieGroans();
      this.stopAllTreeFalls();
      this.stopAllTreeChops();
      this.stopMenuFade();
      this.stopMenuSound();
    } else {
      this.unlockAudio();
    }
  }

  isMuted(): boolean {
    return this.muted;
  }

  /**
   * Local player + camera. Updates any gunshots still playing so zoom and
   * movement change volume and pan while the clip lasts.
   */
  setListener(next: GunshotListener) {
    this.listener = next;
    this.refreshLiveGunshots();
    this.refreshLiveFireplaces();
    this.refreshLiveFootsteps();
    this.refreshLiveActionSounds();
    this.refreshLiveOneShots();
    this.refreshLiveZombieGroans();
    this.refreshLiveTreeFalls();
    this.refreshLiveTreeChops();
    this.refreshWindAmbience();
    this.refreshRainAmbience();
    this.refreshForestAmbience();
  }

  /** Play a registered SFX if the asset loaded; otherwise silent. */
  play(
    id: SfxId,
    opts?: {
      volume?: number;
      rate?: number;
      source?: GunshotSource;
      hearRadius?: number;
      fullDist?: number;
    },
  ) {
    if (
      id === "ui_open" ||
      id === "ui_close" ||
      id === "inventory_open" ||
      id === "inventory_close" ||
      id === "journal" ||
      id === "quest" ||
      id === "trade"
    ) {
      const uiGain =
        id === "quest"
          ? QUEST_GAIN
          : id === "trade"
            ? TRADE_GAIN
            : id === "journal"
              ? JOURNAL_GAIN
              : id === "inventory_open" || id === "inventory_close"
                ? INVENTORY_UI_GAIN
                : 1;
      this.playKey(sfxKey(id), id, {
        volume: opts?.volume ?? uiGain,
        rate: opts?.rate,
      });
      return;
    }
    const origin = this.worldSource(
      opts?.source,
      opts?.hearRadius ?? ACTION_SFX_HEAR_RADIUS,
    );
    const fullDist = opts?.fullDist ?? ACTION_SFX_FULL_DIST;
    const spatial = this.positionalSpatial(origin, fullDist);
    if (spatial.gain < GUNSHOT_MIN_GAIN) return;
    const baseVolume = opts?.volume ?? 1;
    const sound = this.playKey(sfxKey(id), id, {
      volume: baseVolume * spatial.gain,
      rate: opts?.rate,
      pan: spatial.pan,
      exteriorMuffle: spatial.exteriorMuffle,
    });
    this.trackOneShot(sound, origin, baseVolume, fullDist);
  }

  /**
   * One-shot eat/drink/medical for a consumable. Starts with the use bar.
   * Bandage1 for bandaging, Tincture1 for alcohol, Vitamins1 for
   * multivitamins, Pills1 for antibiotics. Water Drink1, other drinks
   * Drink2. Chips Eat1, canned Eat2.
   */
  playConsume(
    itemId: string,
    opts?: { id?: string; source?: GunshotSource; durationMs?: number },
  ) {
    const key = consumeAudioKeyForItem(itemId);
    if (!key) return;
    const durationMs =
      opts?.durationMs ?? getItemDefinition(itemId)?.consumeDurationMs ?? 0;
    this.startActionSound(
      "consume",
      opts?.id ?? "local",
      key,
      CONSUME_GAIN,
      opts?.source,
      durationMs,
    );
  }

  /** Hiss when a fireplace is put out. Burn-out stays silent. */
  playFireplaceExtinguish(source?: GunshotSource) {
    const key = fireplaceExtinguishKey();
    this.playSpatial(key, key, FIREPLACE_EXTINGUISH_GAIN, source);
  }

  stopConsume(id = "local") {
    this.stopActionSound("consume", id);
  }

  /**
   * Search rummage. Furniture banks are Search1-19 by objectType.
   * Corpses, dead officers, armchairs, sofas, and clothing racks use SearchBody1.
   */
  playSearch(
    kind: "furniture" | "body",
    objectType?: string,
    opts?: { id?: string; source?: GunshotSource; durationMs?: number },
  ) {
    const key =
      kind === "body" ? searchKey("body", 0) : searchKeyForFurniture(objectType);
    this.startActionSound(
      "search",
      opts?.id ?? "local",
      key,
      searchGain(kind, objectType),
      opts?.source,
      0,
    );
  }

  stopSearch(id = "local") {
    this.stopActionSound("search", id);
  }

  /**
   * Lock scrape. Loops until the pick ends. A second call while it is
   * already running leaves the loop where it is.
   */
  playLockpick(opts?: { id?: string; source?: GunshotSource }) {
    const id = opts?.id ?? "local";
    const mapKey = this.actionSoundKey("lockpick", id);
    const existing = this.actionSounds.get(mapKey);
    if (existing && loopSoundAlive(existing.sound)) {
      if (opts?.source) existing.source = this.worldSource(opts.source);
      return;
    }
    this.startActionSound(
      "lockpick",
      id,
      doorLockpickKey(),
      LOCKPICK_GAIN,
      opts?.source,
      0,
      true,
    );
  }

  stopLockpick(id = "local") {
    this.stopActionSound("lockpick", id);
  }

  /** Magazine swap. Starts with the reload bar. */
  playReload(
    itemId: string,
    opts?: { id?: string; source?: GunshotSource; durationMs?: number },
  ) {
    const key = reloadKeyForWeapon(itemId);
    if (!key) return;
    this.startActionSound(
      "reload",
      opts?.id ?? "local",
      key,
      0.5,
      opts?.source,
      opts?.durationMs ?? RELOAD_DURATION_MS,
    );
  }

  stopReload(id = "local") {
    this.stopActionSound("reload", id);
  }

  /** Empty magazine back into inventory. Starts with the unload bar. */
  playUnload(
    itemId: string,
    opts?: { id?: string; source?: GunshotSource; durationMs?: number },
  ) {
    const key = unloadKeyForWeapon(itemId);
    if (!key) return;
    this.startActionSound(
      "unload",
      opts?.id ?? "local",
      key,
      0.5,
      opts?.source,
      opts?.durationMs ?? UNLOAD_DURATION_MS,
    );
  }

  stopUnload(id = "local") {
    this.stopActionSound("unload", id);
  }

  stopAllActionSounds() {
    for (const key of [...this.actionDelays.keys()]) {
      const delay = this.actionDelays.get(key);
      this.actionDelays.delete(key);
      delay?.remove(false);
    }
    for (const key of [...this.actionStopDelays.keys()]) {
      const delay = this.actionStopDelays.get(key);
      this.actionStopDelays.delete(key);
      delay?.remove(false);
    }
    for (const key of [...this.actionSounds.keys()]) {
      const live = this.actionSounds.get(key);
      this.actionSounds.delete(key);
      if (live) this.stopSound(live.sound);
    }
  }

  private actionSoundKey(
    kind: "search" | "reload" | "unload" | "consume" | "lockpick",
    id: string,
  ) {
    return `${kind}:${id}`;
  }

  private startActionSound(
    kind: "search" | "reload" | "unload" | "consume" | "lockpick",
    id: string,
    cacheKey: string,
    volume: number,
    source?: GunshotSource,
    durationMs = 0,
    loop = false,
  ) {
    this.stopActionSound(kind, id);
    const mapKey = this.actionSoundKey(kind, id);
    const clipMs = this.audioDurationMs(cacheKey);
    const delayMs =
      durationMs > 0 && clipMs > 0 && clipMs < durationMs
        ? Math.round((durationMs - clipMs) / 2)
        : 0;
    let delay: Phaser.Time.TimerEvent | undefined;
    const play = () => {
      if (delay && this.actionDelays.get(mapKey) !== delay) return;
      this.actionDelays.delete(mapKey);
      const origin = this.worldSource(source);
      const spatial = this.positionalSpatial(origin, ACTION_SFX_FULL_DIST);
      if (spatial.gain < GUNSHOT_MIN_GAIN) return;
      const sound = this.playKey(cacheKey, cacheKey, {
        volume: volume * spatial.gain,
        pan: spatial.pan,
        exteriorMuffle: spatial.exteriorMuffle,
        loop,
      });
      if (!sound) return;
      this.actionSounds.set(mapKey, {
        sound,
        source: origin,
        baseVolume: volume,
      });
      sound.once("destroy", () => {
        const cur = this.actionSounds.get(mapKey);
        if (cur?.sound === sound) this.actionSounds.delete(mapKey);
      });
    };
    if (delayMs <= 0 || !this.scene) {
      play();
    } else {
      delay = this.scene.time.delayedCall(delayMs, play);
      this.actionDelays.set(mapKey, delay);
    }
    if (durationMs > 0 && this.scene) {
      const stopDelay = this.scene.time.delayedCall(durationMs, () => {
        if (this.actionStopDelays.get(mapKey) !== stopDelay) return;
        this.actionStopDelays.delete(mapKey);
        this.stopActionSound(kind, id);
      });
      this.actionStopDelays.set(mapKey, stopDelay);
    }
  }

  private stopActionSound(
    kind: "search" | "reload" | "unload" | "consume" | "lockpick",
    id: string,
  ) {
    const mapKey = this.actionSoundKey(kind, id);
    const stopDelay = this.actionStopDelays.get(mapKey);
    if (stopDelay) {
      stopDelay.remove(false);
      this.actionStopDelays.delete(mapKey);
    }
    const delay = this.actionDelays.get(mapKey);
    if (delay) {
      delay.remove(false);
      this.actionDelays.delete(mapKey);
    }
    const sound = this.actionSounds.get(mapKey);
    if (!sound) return;
    this.actionSounds.delete(mapKey);
    this.stopSound(sound.sound);
  }

  private playSpatial(
    cacheKey: string,
    loadedId: string,
    volume: number,
    source?: GunshotSource,
  ) {
    const origin = this.worldSource(source);
    const spatial = this.positionalSpatial(origin, ACTION_SFX_FULL_DIST);
    if (spatial.gain < GUNSHOT_MIN_GAIN) return;
    const sound = this.playKey(cacheKey, loadedId, {
      volume: volume * spatial.gain,
      pan: spatial.pan,
      exteriorMuffle: spatial.exteriorMuffle,
    });
    this.trackOneShot(sound, origin, volume, ACTION_SFX_FULL_DIST);
  }

  playMelee(source?: GunshotSource, itemId?: string) {
    const bank = itemId
      ? WEAPONS.find((w) => w.itemId === itemId)?.meleeHitBank
      : undefined;
    if (bank === "blade" || bank === "blunt") {
      this.playMeleeHit(bank, source);
      return;
    }
    this.play("melee_swing", {
      volume: 0.7,
      source,
      hearRadius: ACTION_SFX_HEAR_RADIUS,
      fullDist: ACTION_SFX_FULL_DIST,
    });
  }

  /** Random Hit1-4 from a melee bank. Avoids repeating the last take when more than one is loaded. */
  private playMeleeHit(bank: MeleeHitBank, source?: GunshotSource) {
    const loaded: number[] = [];
    for (let i = 0; i < MELEE_HIT_COUNT; i++) {
      if (this.loaded.has(meleeHitKey(bank, i))) loaded.push(i);
    }
    if (loaded.length === 0) return;
    let pick = loaded[Math.floor(Math.random() * loaded.length)] ?? 0;
    const last = this.lastMeleeHitVariant[bank] ?? -1;
    if (loaded.length > 1 && pick === last) {
      const rest = loaded.filter((v) => v !== pick);
      pick = rest[Math.floor(Math.random() * rest.length)] ?? pick;
    }
    const origin = this.worldSource(source);
    const spatial = this.positionalSpatial(origin, ACTION_SFX_FULL_DIST);
    if (spatial.gain < GUNSHOT_MIN_GAIN) return;
    const key = meleeHitKey(bank, pick);
    const gain = MELEE_HIT_GAIN[bank];
    const sound = this.playKey(key, key, {
      volume: gain * spatial.gain,
      pan: spatial.pan,
      exteriorMuffle: spatial.exteriorMuffle,
    });
    if (!sound) return;
    this.lastMeleeHitVariant[bank] = pick;
    this.trackOneShot(sound, origin, gain, ACTION_SFX_FULL_DIST);
  }

  playDeath(source?: GunshotSource) {
    this.play("death", {
      volume: 0.85,
      source,
      hearRadius: ACTION_SFX_HEAR_RADIUS,
      fullDist: ACTION_SFX_FULL_DIST,
    });
  }

  /**
   * Looping walk / run bed per moving player. Surface comes from the tile
   * (grass / wood / carpet) or concrete when nothing is configured.
   */
  syncFootsteps(
    sources: readonly {
      id: string;
      sprint: boolean;
      x: number;
      y: number;
      inInterior?: boolean;
      buildingX?: number;
      buildingY?: number;
    }[],
  ) {
    if (this.muted || !this.scene) {
      this.stopFootsteps();
      return;
    }
    const keep = new Set<string>();
    for (const src of sources) {
      const gait: FootstepGait = src.sprint ? "run" : "walk";
      let surface = resolveFootstepSurface(src);
      let key = footstepKey(surface, gait);
      if (!this.loaded.has(key)) {
        surface = FOOTSTEP_DEFAULT_SURFACE;
        key = footstepKey(surface, gait);
      }
      if (!this.loaded.has(key)) continue;
      const spatialSource: GunshotSource = {
        x: src.x,
        y: src.y,
        noiseRadius: ACTION_SFX_HEAR_RADIUS,
        inInterior: src.inInterior,
        buildingX: src.buildingX,
        buildingY: src.buildingY,
      };
      const spatial = this.positionalSpatial(
        spatialSource,
        ACTION_SFX_FULL_DIST,
      );
      if (spatial.gain < GUNSHOT_MIN_GAIN) continue;
      keep.add(src.id);
      const existing = this.liveFootsteps.get(src.id);
      if (
        existing &&
        existing.surface === surface &&
        existing.gait === gait &&
        existing.sound.isPlaying &&
        existing.exteriorMuffle === spatial.exteriorMuffle
      ) {
        existing.source = spatialSource;
        try {
          applySoundVolume(
            existing.sound,
            this.volume * FOOTSTEP_GAIN[surface][gait] * spatial.gain,
          );
          applySoundPan(existing.sound, spatial.pan);
          applySoundRate(existing.sound, FOOTSTEP_RATE[surface][gait]);
        } catch {
          /* HTML5 backend may lack pan */
        }
        continue;
      }
      if (existing) {
        this.stopSound(existing.sound);
        this.liveFootsteps.delete(src.id);
      }
      const sound = this.playKey(key, key, {
        volume: FOOTSTEP_GAIN[surface][gait] * spatial.gain,
        rate: FOOTSTEP_RATE[surface][gait],
        pan: spatial.pan,
        exteriorMuffle: spatial.exteriorMuffle,
        loop: true,
      });
      if (!sound) continue;
      this.liveFootsteps.set(src.id, {
        sound,
        source: spatialSource,
        surface,
        gait,
        exteriorMuffle: spatial.exteriorMuffle,
      });
    }
    for (const [id, live] of [...this.liveFootsteps]) {
      if (keep.has(id)) continue;
      this.stopSound(live.sound);
      this.liveFootsteps.delete(id);
    }
  }

  stopFootsteps() {
    for (const live of this.liveFootsteps.values()) {
      this.stopSound(live.sound);
    }
    this.liveFootsteps.clear();
  }

  playZombieAggro(source: GunshotSource) {
    this.play("zombie_aggro", {
      volume: 0.85,
      source,
      hearRadius: ZOMBIE_GROAN_HEAR_RADIUS,
      fullDist: ZOMBIE_GROAN_FULL_DIST,
    });
  }

  /**
   * Tree crash. Starts when the last chop swing finishes (treeFelled).
   */
  playTreeFall(tx: number, ty: number) {
    const id = `${tx},${ty}`;
    if (this.treeFalls.has(id)) return;
    const key = treeFallKey();
    const source: GunshotSource = {
      x: tx + 0.5,
      y: ty + 0.5,
      noiseRadius: TREE_FALL_HEAR_RADIUS,
      inInterior: false,
      buildingX: 0,
      buildingY: 0,
    };
    const spatial = this.positionalSpatial(source, TREE_FALL_FULL_DIST);
    if (spatial.gain < GUNSHOT_MIN_GAIN) return;
    const sound = this.playKey(key, key, {
      volume: TREE_FALL_GAIN * spatial.gain,
      pan: spatial.pan,
      exteriorMuffle: spatial.exteriorMuffle,
    });
    if (!sound) return;
    const live: LiveTreeFall = { sound, delay: null, source };
    this.treeFalls.set(id, live);
    sound.once("destroy", () => {
      const cur = this.treeFalls.get(id);
      if (cur?.sound === sound) this.treeFalls.delete(id);
    });
  }

  stopTreeFall(tx: number, ty: number) {
    this.dropTreeFall(`${tx},${ty}`);
  }

  stopAllTreeFalls() {
    for (const id of [...this.treeFalls.keys()]) this.dropTreeFall(id);
  }

  /**
   * Hatchet bed while a tree is being chopped. Loops until the tree falls
   * or the chop is cancelled. {@link TREE_CHOP_RATE} is applied live.
   */
  playTreeChop(tx: number, ty: number) {
    const id = `${tx},${ty}`;
    if (this.treeChops.has(id)) return;
    const key = treeChopKey();
    const source: GunshotSource = {
      x: tx + 0.5,
      y: ty + 0.5,
      noiseRadius: TREE_FALL_HEAR_RADIUS,
      inInterior: false,
      buildingX: 0,
      buildingY: 0,
    };
    const spatial = this.positionalSpatial(source, TREE_FALL_FULL_DIST);
    if (spatial.gain < GUNSHOT_MIN_GAIN) return;
    const sound = this.playKey(key, key, {
      volume: TREE_CHOP_GAIN * spatial.gain,
      rate: TREE_CHOP_RATE,
      pan: spatial.pan,
      exteriorMuffle: spatial.exteriorMuffle,
      loop: true,
    });
    if (!sound) return;
    this.treeChops.set(id, { sound, source });
  }

  stopTreeChop(tx: number, ty: number) {
    this.dropTreeChop(`${tx},${ty}`);
  }

  stopAllTreeChops() {
    for (const id of [...this.treeChops.keys()]) this.dropTreeChop(id);
  }

  isChoppingTreeNear(x: number, y: number): boolean {
    const px = Math.floor(x);
    const py = Math.floor(y);
    for (const id of this.treeChops.keys()) {
      const comma = id.indexOf(",");
      const tx = Number(id.slice(0, comma));
      const ty = Number(id.slice(comma + 1));
      if (Math.max(Math.abs(px - tx), Math.abs(py - ty)) <= 1) return true;
    }
    return false;
  }

  private dropTreeChop(id: string) {
    const live = this.treeChops.get(id);
    if (!live) return;
    this.treeChops.delete(id);
    this.stopSound(live.sound);
  }

  /**
   * Door swing. Wooden doors (houses, motels, player-built) use Open/CloseDoor1.
   * Hospital cubicles use Open/CloseDoor2.
   */
  playDoor(
    open: boolean,
    style: "wood" | "hospital",
    source: GunshotSource,
  ) {
    const key = open ? doorOpenKey(style) : doorCloseKey(style);
    const gain = style === "hospital" ? HOSPITAL_DOOR_GAIN : DOOR_GAIN;
    const spatialSource = { ...source, noiseRadius: DOOR_HEAR_RADIUS };
    const spatial = this.positionalSpatial(spatialSource, DOOR_FULL_DIST);
    if (spatial.gain < GUNSHOT_MIN_GAIN) return;
    const sound = this.playKey(key, key, {
      volume: gain * spatial.gain,
      pan: spatial.pan,
      exteriorMuffle: spatial.exteriorMuffle,
    });
    this.trackOneShot(sound, spatialSource, gain, DOOR_FULL_DIST);
  }

  /** Handle rattle when a closed door is locked. Same distance as a door swing. */
  playLockedDoor(source: GunshotSource) {
    const key = doorLockedKey();
    const spatialSource = { ...source, noiseRadius: DOOR_HEAR_RADIUS };
    const spatial = this.positionalSpatial(spatialSource, DOOR_FULL_DIST);
    if (spatial.gain < GUNSHOT_MIN_GAIN) return;
    const sound = this.playKey(key, key, {
      volume: LOCKED_DOOR_GAIN * spatial.gain,
      pan: spatial.pan,
      exteriorMuffle: spatial.exteriorMuffle,
    });
    this.trackOneShot(sound, spatialSource, LOCKED_DOOR_GAIN, DOOR_FULL_DIST);
  }

  private dropTreeFall(id: string) {
    const live = this.treeFalls.get(id);
    if (!live) return;
    this.treeFalls.delete(id);
    if (live.delay) live.delay.remove(false);
    if (live.sound) this.stopSound(live.sound);
  }

  private audioDurationMs(key: string): number {
    const entry = this.scene?.cache.audio.get(key) as
      | { duration?: number; data?: { duration?: number } }
      | undefined;
    const sec = entry?.duration ?? entry?.data?.duration;
    if (!(typeof sec === "number") || !Number.isFinite(sec) || sec <= 0) {
      return 0;
    }
    return Math.round(sec * 1000);
  }

  /**
   * One idle/interior groan from a zombie. Picks a take (not the last one
   * if possible), spatialized like gunshots, capped so a pack does not stack.
   */
  playZombieGroan(
    source: GunshotSource,
    opts?: { ignoreCap?: boolean; variant?: number },
  ): boolean {
    this.pruneLiveZombieGroans();
    if (!opts?.ignoreCap && this.liveZombieGroans.length >= ZOMBIE_GROAN_MAX_LIVE) {
      return false;
    }
    const loaded: number[] = [];
    for (let i = 0; i < ZOMBIE_GROAN_COUNT; i++) {
      if (this.loaded.has(zombieGroanKey(i))) loaded.push(i);
    }
    if (loaded.length === 0) return false;
    let pick: number;
    if (opts?.variant != null && loaded.includes(opts.variant)) {
      pick = opts.variant;
    } else if (opts?.variant != null && loaded.length > 0) {
      pick = loaded[opts.variant % loaded.length]!;
    } else {
      pick = loaded[Math.floor(Math.random() * loaded.length)] ?? 0;
      if (loaded.length > 1 && pick === this.lastZombieGroanVariant) {
        const rest = loaded.filter((v) => v !== pick);
        pick = rest[Math.floor(Math.random() * rest.length)] ?? pick;
      }
    }
    const spatialSource: GunshotSource = {
      ...source,
      noiseRadius: ZOMBIE_GROAN_HEAR_RADIUS,
    };
    const spatial = this.positionalSpatial(
      spatialSource,
      ZOMBIE_GROAN_FULL_DIST,
      "linear",
    );
    if (spatial.gain < GUNSHOT_MIN_GAIN) return false;
    const key = zombieGroanKey(pick);
    const sound = this.playKey(key, key, {
      volume: ZOMBIE_GROAN_GAIN * spatial.gain,
      pan: spatial.pan,
      exteriorMuffle: spatial.exteriorMuffle,
    });
    if (!sound) return false;
    this.lastZombieGroanVariant = pick;
    this.liveZombieGroans.push({
      sound,
      source: spatialSource,
      fileGain: ZOMBIE_GROAN_GAIN,
    });
    sound.once("destroy", () => this.dropLiveZombieGroan(sound));
    return true;
  }

  stopZombieGroans() {
    for (const live of this.liveZombieGroans) {
      this.stopSound(live.sound);
    }
    this.liveZombieGroans = [];
  }

  /**
   * Play one of the shot takes for this gun. `variant` must be the same
   * index every client received for that shot (server `lastShotSfx`).
   * Mapped onto however many files this gun actually has.
   */
  playGunshot(
    itemId: string,
    variant?: number,
    source?: GunshotSource,
    opts?: { volume?: number; rate?: number },
  ) {
    if (!GUNSHOT_BANKS[itemId]) return;
    const count = gunshotBankVariants(itemId);
    const v = resolveGunshotVariant(variant) % count;
    const spatialSource = this.worldSource(
      source
        ? { ...source, noiseRadius: gunshotHearRadius(itemId) }
        : undefined,
      gunshotHearRadius(itemId),
    );
    spatialSource.noiseRadius = gunshotHearRadius(itemId);
    const spatial = this.gunshotSpatial(spatialSource);
    if (spatial.gain < GUNSHOT_MIN_GAIN) return;
    const fileGain = (opts?.volume ?? 1) * (GUNSHOT_BANK_GAIN[itemId] ?? 1);
    const sound = this.playKey(gunshotKey(itemId, v), gunshotKey(itemId, v), {
      volume: fileGain * spatial.gain,
      rate: opts?.rate,
      pan: spatial.pan,
      exteriorMuffle: spatial.exteriorMuffle,
    });
    if (!sound) return;
    this.liveGunshots.push({ sound, source: spatialSource, fileGain });
    sound.once("destroy", () => this.dropLiveGunshot(sound));
  }

  /**
   * Keep one looping crackle per lit fireplace in range. Starts when the fire
   * is lit (or you walk into earshot), stops when it goes out or you leave.
   */
  syncFireplaces(sources: readonly FireplaceAudioSource[]) {
    if (this.muted || !this.scene || !this.loaded.has("fireplace")) {
      this.stopFireplaces();
      return;
    }
    const keep = new Set<string>();
    for (const src of sources) {
      const spatialSource: GunshotSource = {
        x: src.x,
        y: src.y,
        noiseRadius: FIREPLACE_HEAR_RADIUS,
        inInterior: src.inInterior,
        buildingX: src.buildingX,
        buildingY: src.buildingY,
      };
      const spatial = this.positionalSpatial(spatialSource, FIREPLACE_FULL_DIST);
      if (spatial.gain < GUNSHOT_MIN_GAIN) continue;
      keep.add(src.id);
      const existing = this.liveFireplaces.get(src.id);
      if (
        existing?.sound.isPlaying &&
        existing.exteriorMuffle === spatial.exteriorMuffle
      ) {
        existing.source = spatialSource;
        try {
          applySoundVolume(
            existing.sound,
            this.volume * FIREPLACE_GAIN * spatial.gain,
          );
          applySoundPan(existing.sound, spatial.pan);
        } catch {
          /* HTML5 backend may lack pan */
        }
        continue;
      }
      if (existing) {
        this.stopSound(existing.sound);
        this.liveFireplaces.delete(src.id);
      }
      const sound = this.playKey(sfxKey("fireplace"), "fireplace", {
        volume: FIREPLACE_GAIN * spatial.gain,
        pan: spatial.pan,
        exteriorMuffle: spatial.exteriorMuffle,
        loop: true,
      });
      if (!sound) continue;
      this.liveFireplaces.set(src.id, {
        sound,
        source: spatialSource,
        exteriorMuffle: spatial.exteriorMuffle,
      });
    }
    for (const [id, live] of [...this.liveFireplaces]) {
      if (keep.has(id)) continue;
      this.stopSound(live.sound);
      this.liveFireplaces.delete(id);
    }
  }

  stopFireplaces() {
    for (const live of this.liveFireplaces.values()) {
      this.stopSound(live.sound);
    }
    this.liveFireplaces.clear();
  }

  /**
   * Outdoor beds: quiet looping wind whenever the player is outside, plus
   * occasional forest stingers among dense trees (day vs night clips).
   * Rain loops while precip is rain (exterior vs interior take).
   */
  syncOutdoorAmbience(opts: {
    outside: boolean;
    inForest: boolean;
    night: boolean;
    raining: boolean;
    dtMs: number;
  }) {
    if (this.muted) {
      this.stopAmbience();
      return;
    }
    this.tickWindAmbience(opts.outside, opts.dtMs);
    this.tickRainAmbience(opts.raining, opts.outside, opts.dtMs);
    this.tickForestAmbience(
      opts.outside && opts.inForest,
      opts.night ? "night" : "day",
    );
  }

  /** Distant thunder after a lightning flash. Interior takes when indoors. */
  playThunder(indoor: boolean) {
    let kind: "exterior" | "interior" = indoor ? "interior" : "exterior";
    let loaded = this.loadedThunderVariants(kind);
    let muffle = false;
    if (loaded.length === 0 && kind === "interior") {
      kind = "exterior";
      loaded = this.loadedThunderVariants(kind);
      muffle = true;
    }
    if (loaded.length === 0) return;
    let pick = loaded[Math.floor(Math.random() * loaded.length)] ?? 0;
    if (loaded.length > 1 && pick === this.lastThunderVariant) {
      const rest = loaded.filter((v) => v !== pick);
      pick = rest[Math.floor(Math.random() * rest.length)] ?? pick;
    }
    const key = thunderKey(kind, pick);
    const origin = this.worldSource();
    const spatial = this.positionalSpatial(origin, ACTION_SFX_FULL_DIST);
    if (spatial.gain < GUNSHOT_MIN_GAIN) return;
    const sound = this.playKey(key, key, {
      volume: THUNDER_GAIN * spatial.gain,
      pan: spatial.pan,
      exteriorMuffle: muffle,
    });
    if (!sound) return;
    this.lastThunderVariant = pick;
    this.trackOneShot(sound, origin, THUNDER_GAIN, ACTION_SFX_FULL_DIST);
  }

  private loadedThunderVariants(kind: "exterior" | "interior"): number[] {
    const loaded: number[] = [];
    for (let i = 0; i < THUNDER_COUNT; i++) {
      if (this.loaded.has(thunderKey(kind, i))) loaded.push(i);
    }
    return loaded;
  }

  stopAmbience() {
    this.stopWindAmbience();
    this.stopForestAmbience();
    this.stopRainPlaylist(this.exteriorRain);
    this.stopFadedLoop(this.interiorRain);
    this.windGain = 0;
    this.exteriorRain.gain = 0;
    this.interiorRain.gain = 0;
    this.forestScheduled = false;
    this.nextForestAt = 0;
    this.forestPeriod = null;
    this.lastForestVariant = -1;
  }

  /** Loop Menu.wav under the login screen. */
  playMenu() {
    this.menuWanted = true;
    this.stopMenuFade();
    this.menuFade = 1;
    this.unlockAudio();
  }

  stopMenu() {
    this.menuWanted = false;
    this.stopMenuRetry();
    this.stopMenuFade();
    this.stopMenuSound();
  }

  /** Soft exit when leaving the menu for the world. */
  fadeOutMenu(durationMs = MENU_FADE_OUT_MS) {
    this.menuWanted = false;
    this.stopMenuRetry();
    if (this.muted || !this.menuSound) {
      this.stopMenuFade();
      this.stopMenuSound();
      return;
    }
    if (this.menuFading) return;
    this.menuFading = true;
    const from = this.menuFade;
    const start = performance.now();
    const step = (now: number) => {
      if (!this.menuFading) return;
      const t = Math.min(1, (now - start) / Math.max(1, durationMs));
      this.menuFade = from * (1 - t);
      this.refreshMenu();
      if (t >= 1) {
        this.stopMenuFade();
        this.stopMenuSound();
        this.menuFade = 1;
        return;
      }
      this.menuFadeRaf = requestAnimationFrame(step);
    };
    this.menuFadeRaf = requestAnimationFrame(step);
  }

  private ensureMenu() {
    if (!this.menuWanted || this.muted) {
      this.stopMenuRetry();
      if (!this.menuFading) this.stopMenuSound();
      return;
    }
    // Buffer sources started while the context is still locked stay silent
    // after resume. Wait until running, then create (or recreate) the bed.
    if (!this.scene || this.audioContextBlocked()) {
      this.scheduleMenuRetry();
      return;
    }
    if (this.menuSound && loopSoundAlive(this.menuSound)) {
      this.refreshMenu();
      this.stopMenuRetry();
      return;
    }
    this.stopMenuSound();
    this.menuSound = this.playKey(menuKey(), menuKey(), {
      volume: MENU_GAIN * this.menuFade,
      loop: true,
    });
    if (this.menuSound && loopSoundAlive(this.menuSound)) {
      this.stopMenuRetry();
      return;
    }
    this.scheduleMenuRetry();
  }

  private scheduleMenuRetry() {
    if (this.menuRetryTimer || !this.menuWanted) return;
    this.menuRetryTimer = window.setInterval(() => {
      if (!this.menuWanted) {
        this.stopMenuRetry();
        return;
      }
      this.unlockAudio();
    }, MENU_RETRY_MS);
  }

  private stopMenuRetry() {
    if (!this.menuRetryTimer) return;
    window.clearInterval(this.menuRetryTimer);
    this.menuRetryTimer = 0;
  }

  private refreshMenu() {
    if (!this.menuSound) return;
    try {
      applySoundVolume(this.menuSound, this.volume * MENU_GAIN * this.menuFade);
    } catch {
      /* ignore */
    }
  }

  private stopMenuFade() {
    this.menuFading = false;
    if (this.menuFadeRaf) {
      cancelAnimationFrame(this.menuFadeRaf);
      this.menuFadeRaf = 0;
    }
  }

  private stopMenuSound() {
    if (!this.menuSound) return;
    this.stopSound(this.menuSound);
    this.menuSound = null;
  }

  /** Whether a real file was loaded for this id (false = still placeholder). */
  has(id: SfxId): boolean {
    return this.loaded.has(id);
  }

  /**
   * Phaser suspends the AudioContext on window blur by default. Shots still
   * queue from the network, then all start together on focus. Keep the context
   * running so unfocused windows hear fire in real time, and skip plays while
   * the browser has the context suspended (hidden tab) so they cannot pile up.
   */
  private enableBackgroundAudio(scene: Phaser.Scene) {
    scene.sound.pauseOnBlur = false;
    this.disablePhaserVisibleSuspend(scene);
    this.installUnlockHook();
    if (this.backgroundAudioHooked) return;
    this.backgroundAudioHooked = true;
    const resume = () => this.unlockAudio();
    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") resume();
    });
    const mgr = scene.sound as Phaser.Sound.BaseSoundManager & {
      on?: (event: string, fn: () => void) => void;
    };
    mgr.on?.("unlocked", () => this.ensureMenu());
  }

  /**
   * Capture-phase listeners fire before wallet / HTML menu handlers, so the
   * same click both interacts with the UI and resumes Web Audio.
   */
  private installUnlockHook() {
    if (unlockHooked) return;
    unlockHooked = true;
    createSharedAudioContext();
    const resume = () => this.unlockAudio();
    const opts: AddEventListenerOptions = { capture: true };
    document.addEventListener("pointerdown", resume, opts);
    document.addEventListener("touchstart", resume, opts);
    document.addEventListener("keydown", resume, opts);
    document.addEventListener("click", resume, opts);
  }

  /**
   * Phaser 3.88+ suspends then resumes the AudioContext 100ms after the tab
   * is visible again (iOS home-button workaround). That click is audible on
   * every looped bed. We already resume on visibility; do not suspend.
   */
  private disablePhaserVisibleSuspend(scene: Phaser.Scene) {
    const mgr = scene.sound as Phaser.Sound.BaseSoundManager & {
      onGameVisible?: (...args: unknown[]) => void;
    };
    const handler = mgr.onGameVisible;
    if (!handler) return;
    scene.game.events.off("visible", handler, mgr);
    mgr.onGameVisible = undefined;
  }

  /** Resume Web Audio now. Do not wait for a later window-focus event. */
  private unlockAudio() {
    const mgr = this.scene?.sound as
      | (Phaser.Sound.BaseSoundManager & { unlock?: () => void })
      | undefined;
    if (!this.phaserUnlockCalled) {
      this.phaserUnlockCalled = true;
      mgr?.unlock?.();
    }
    const ctx = this.audioContext();
    if (ctx && (ctx.state === "suspended" || ctx.state === "interrupted")) {
      void ctx.resume().then(() => this.ensureMenu());
    }
    this.ensureMenu();
  }

  private audioContext(): AudioContext | null {
    const sound = this.scene?.sound as { context?: AudioContext } | undefined;
    return sound?.context ?? sharedAudioContext;
  }

  private audioContextBlocked(): boolean {
    const ctx = this.audioContext();
    if (!ctx) return true;
    return ctx.state === "suspended" || ctx.state === "interrupted";
  }

  private playKey(
    cacheKey: string,
    loadedId: string,
    opts?: {
      volume?: number;
      rate?: number;
      pan?: number;
      exteriorMuffle?: boolean;
      loop?: boolean;
    },
  ): Phaser.Sound.BaseSound | null {
    if (this.muted || !this.scene || !this.loaded.has(loadedId)) return null;
    if (this.audioContextBlocked()) return null;
    try {
      const loop = opts?.loop === true;
      const sound = this.scene.sound.add(cacheKey, {
        volume: this.volume * (opts?.volume ?? 1),
        rate: opts?.rate ?? 1,
        loop,
      });
      applySoundPan(sound, opts?.pan ?? 0);
      if (!loop) {
        sound.once("complete", () => sound.destroy());
      }
      sound.play();
      if (loop) enableBackgroundSafeLoop(sound);
      if (opts?.rate != null && opts.rate !== 1) {
        applySoundRate(sound, opts.rate);
      }
      const file = this.sourceFiles.get(cacheKey) ?? cacheKey;
      console.log(`[audio] ${file}${loop ? " (loop)" : ""}`);
      if (opts?.exteriorMuffle) {
        applyExteriorLowpass(sound, this.audioContext());
      }
      return sound;
    } catch {
      return null;
    }
  }

  private gunshotSpatial(source: GunshotSource): {
    gain: number;
    pan: number;
    exteriorMuffle: boolean;
  } {
    return this.positionalSpatial(source, GUNSHOT_FULL_DIST, "ease", true);
  }

  /**
   * World origin for a clip. Missing source (own search, eat, melee, etc.)
   * uses the listener so zoom and walls still apply.
   */
  private worldSource(
    source?: GunshotSource,
    hearRadius = ACTION_SFX_HEAR_RADIUS,
  ): GunshotSource {
    if (source) {
      return {
        ...source,
        noiseRadius:
          source.noiseRadius > 0 ? source.noiseRadius : hearRadius,
      };
    }
    const listen = this.listener;
    if (!listen) {
      return { x: 0, y: 0, noiseRadius: hearRadius };
    }
    return {
      x: listen.x,
      y: listen.y,
      noiseRadius: hearRadius,
      inInterior: listen.inInterior,
      buildingX: listen.buildingX,
      buildingY: listen.buildingY,
    };
  }

  /** Zoom multiplier for beds that sit on the listener (wind, rain, forest). */
  private zoomMix(): number {
    const listen = this.listener;
    if (!listen) return 1;
    return zoomVolumeGain(
      Math.max(0.15, listen.zoom),
      listen.zoomMin,
      listen.zoomMax,
    );
  }

  private trackOneShot(
    sound: Phaser.Sound.BaseSound | null,
    source: GunshotSource,
    baseVolume: number,
    fullDist: number,
  ) {
    if (!sound) return;
    this.liveOneShots.push({ sound, source, baseVolume, fullDist });
    sound.once("destroy", () => {
      this.liveOneShots = this.liveOneShots.filter((live) => live.sound !== sound);
    });
  }

  /**
   * Distance / pan / wall muffle.
   * Only gunshots (`leakThroughWalls`) cross interior/exterior or other buildings.
   */
  private positionalSpatial(
    source: GunshotSource,
    fullDist: number,
    falloff: "ease" | "linear" = "ease",
    leakThroughWalls = false,
  ): {
    gain: number;
    pan: number;
    exteriorMuffle: boolean;
  } {
    const listen = this.listener;
    if (!listen) return { gain: 1, pan: 0, exteriorMuffle: false };
    if (!leakThroughWalls && spacesDiffer(listen, source)) {
      return { gain: 0, pan: 0, exteriorMuffle: false };
    }
    const zoom = Math.max(0.15, listen.zoom);
    const pts = gunshotListenPoints(
      source.x,
      source.y,
      !!source.inInterior,
      source.buildingX ?? 0,
      source.buildingY ?? 0,
      listen.x,
      listen.y,
      listen.inInterior,
      listen.buildingX,
      listen.buildingY,
    );
    const planar = Math.hypot(pts.ax - pts.bx, pts.ay - pts.by);
    const silentAt = Math.max(source.noiseRadius, fullDist + 1);
    let distGain: number;
    if (planar <= fullDist) distGain = 1;
    else if (planar >= silentAt) distGain = 0;
    else {
      const t = (planar - fullDist) / (silentAt - fullDist);
      distGain = falloff === "linear" ? 1 - t : Math.pow(1 - t, 1.2);
    }
    let gain = distGain * zoomVolumeGain(zoom, listen.zoomMin, listen.zoomMax);
    const exteriorMuffle = listen.inInterior && !source.inInterior;
    if (exteriorMuffle) gain *= GUNSHOT_EXTERIOR_MUFFLE;
    else if (spacesDiffer(listen, source)) gain *= GUNSHOT_WALL_MUFFLE;
    const isoSrc = cartesianToIso(pts.ax, pts.ay);
    const isoListen = cartesianToIso(pts.bx, pts.by);
    const pan = clamp(
      ((isoSrc.x - isoListen.x) * zoom) / GUNSHOT_PAN_ISO_PX,
      -1,
      1,
    );
    return { gain, pan, exteriorMuffle };
  }

  private refreshLiveGunshots() {
    if (this.muted) return;
    for (const live of this.liveGunshots) {
      if (!live.sound.isPlaying) continue;
      const spatial = this.gunshotSpatial(live.source);
      try {
        applySoundVolume(live.sound, this.volume * live.fileGain * spatial.gain);
        applySoundPan(live.sound, spatial.pan);
      } catch {
        /* HTML5 backend may lack pan */
      }
    }
  }

  private refreshLiveTreeFalls() {
    if (this.muted) return;
    for (const [id, live] of [...this.treeFalls]) {
      if (!live.sound?.isPlaying) continue;
      const spatial = this.positionalSpatial(live.source, TREE_FALL_FULL_DIST);
      if (spatial.gain < GUNSHOT_MIN_GAIN) {
        this.dropTreeFall(id);
        continue;
      }
      try {
        applySoundVolume(
          live.sound,
          this.volume * TREE_FALL_GAIN * spatial.gain,
        );
        applySoundPan(live.sound, spatial.pan);
      } catch {
        /* HTML5 backend may lack pan */
      }
    }
  }

  private refreshLiveTreeChops() {
    if (this.muted) return;
    for (const [id, live] of [...this.treeChops]) {
      if (!loopSoundAlive(live.sound)) {
        this.treeChops.delete(id);
        continue;
      }
      const spatial = this.positionalSpatial(live.source, TREE_FALL_FULL_DIST);
      if (spatial.gain < GUNSHOT_MIN_GAIN) {
        this.dropTreeChop(id);
        continue;
      }
      try {
        applySoundVolume(
          live.sound,
          this.volume * TREE_CHOP_GAIN * spatial.gain,
        );
        applySoundPan(live.sound, spatial.pan);
        applySoundRate(live.sound, TREE_CHOP_RATE);
      } catch {
        /* HTML5 backend may lack pan */
      }
    }
  }

  private refreshLiveZombieGroans() {
    if (this.muted) return;
    this.pruneLiveZombieGroans();
    for (const live of this.liveZombieGroans) {
      const spatial = this.positionalSpatial(
        live.source,
        ZOMBIE_GROAN_FULL_DIST,
        "linear",
      );
      try {
        applySoundVolume(
          live.sound,
          this.volume * ZOMBIE_GROAN_GAIN * spatial.gain,
        );
        applySoundPan(live.sound, spatial.pan);
      } catch {
        /* HTML5 backend may lack pan */
      }
    }
  }

  private pruneLiveZombieGroans() {
    this.liveZombieGroans = this.liveZombieGroans.filter(
      (live) => live.sound.isPlaying,
    );
  }

  private refreshLiveFireplaces() {
    if (this.muted) return;
    for (const [id, live] of [...this.liveFireplaces]) {
      if (!live.sound.isPlaying) {
        this.liveFireplaces.delete(id);
        continue;
      }
      const spatial = this.positionalSpatial(live.source, FIREPLACE_FULL_DIST);
      if (spatial.gain < GUNSHOT_MIN_GAIN) {
        this.stopSound(live.sound);
        this.liveFireplaces.delete(id);
        continue;
      }
      try {
        applySoundVolume(
          live.sound,
          this.volume * FIREPLACE_GAIN * spatial.gain,
        );
        applySoundPan(live.sound, spatial.pan);
      } catch {
        /* HTML5 backend may lack pan */
      }
    }
  }

  private refreshLiveFootsteps() {
    if (this.muted) return;
    for (const [id, live] of [...this.liveFootsteps]) {
      if (!live.sound.isPlaying) {
        this.liveFootsteps.delete(id);
        continue;
      }
      const spatial = this.positionalSpatial(live.source, ACTION_SFX_FULL_DIST);
      if (spatial.gain < GUNSHOT_MIN_GAIN) {
        this.stopSound(live.sound);
        this.liveFootsteps.delete(id);
        continue;
      }
      try {
        applySoundVolume(
          live.sound,
          this.volume * FOOTSTEP_GAIN[live.surface][live.gait] * spatial.gain,
        );
        applySoundPan(live.sound, spatial.pan);
        applySoundRate(live.sound, FOOTSTEP_RATE[live.surface][live.gait]);
      } catch {
        /* HTML5 backend may lack pan */
      }
    }
  }

  private refreshLiveActionSounds() {
    if (this.muted) return;
    for (const [id, live] of [...this.actionSounds]) {
      if (!loopSoundAlive(live.sound)) {
        this.actionSounds.delete(id);
        continue;
      }
      const spatial = this.positionalSpatial(live.source, ACTION_SFX_FULL_DIST);
      if (spatial.gain < GUNSHOT_MIN_GAIN) {
        this.stopSound(live.sound);
        this.actionSounds.delete(id);
        continue;
      }
      try {
        applySoundVolume(
          live.sound,
          this.volume * live.baseVolume * spatial.gain,
        );
        applySoundPan(live.sound, spatial.pan);
      } catch {
        /* HTML5 backend may lack pan */
      }
    }
  }

  private refreshLiveOneShots() {
    if (this.muted) return;
    this.liveOneShots = this.liveOneShots.filter((live) => live.sound.isPlaying);
    for (const live of this.liveOneShots) {
      const spatial = this.positionalSpatial(live.source, live.fullDist);
      try {
        applySoundVolume(
          live.sound,
          this.volume * live.baseVolume * spatial.gain,
        );
        applySoundPan(live.sound, spatial.pan);
      } catch {
        /* HTML5 backend may lack pan */
      }
    }
  }

  private tickWindAmbience(outside: boolean, dtMs: number) {
    const canPlay = outside && this.loaded.has(windAmbienceKey());
    const target = canPlay ? WIND_AMBIENCE_GAIN : 0;
    const rate =
      target > this.windGain ? WIND_FADE_IN_PER_SEC : WIND_FADE_OUT_PER_SEC;
    const step = (rate * Math.max(0, dtMs)) / 1000;
    if (this.windGain < target) this.windGain = Math.min(target, this.windGain + step);
    else if (this.windGain > target) {
      this.windGain = Math.max(target, this.windGain - step);
    }

    if (this.windGain <= 0.001) {
      this.windGain = 0;
      this.stopWindAmbience();
      return;
    }
    if (!loopSoundAlive(this.windSound)) {
      this.stopWindAmbience();
      this.windSound = this.playKey(windAmbienceKey(), windAmbienceKey(), {
        volume: this.windGain * this.zoomMix(),
        loop: true,
      });
      return;
    }
    this.refreshWindAmbience();
  }

  private refreshWindAmbience() {
    if (!this.windSound?.isPlaying || this.windGain <= 0) return;
    try {
      applySoundVolume(
        this.windSound,
        this.volume * this.windGain * this.zoomMix(),
      );
    } catch {
      /* ignore */
    }
  }

  private stopWindAmbience() {
    if (!this.windSound) return;
    this.stopSound(this.windSound);
    this.windSound = null;
  }

  private tickRainAmbience(raining: boolean, outside: boolean, dtMs: number) {
    const extReady = this.loadedRainVariants("exterior").length > 0;
    const intKey = rainAmbienceKey("interior", 0);
    const extTarget =
      raining && outside && extReady ? EXTERIOR_RAIN_GAIN : 0;
    const intTarget =
      raining && !outside && this.loaded.has(intKey) ? INTERIOR_RAIN_GAIN : 0;
    this.tickRainPlaylist(this.exteriorRain, "exterior", extTarget, dtMs);
    this.tickFadedLoop(this.interiorRain, intKey, intTarget, dtMs);
  }

  private refreshRainAmbience() {
    this.applyRainPlaylistVolumes(this.exteriorRain);
    if (!this.interiorRain.sound?.isPlaying || this.interiorRain.gain <= 0) {
      return;
    }
    try {
      applySoundVolume(
        this.interiorRain.sound,
        this.volume * this.interiorRain.gain * this.zoomMix(),
      );
    } catch {
      /* ignore */
    }
  }

  private loadedRainVariants(kind: "exterior" | "interior"): number[] {
    const count = kind === "exterior" ? EXTERIOR_RAIN_VARIANTS : 1;
    const loaded: number[] = [];
    for (let i = 0; i < count; i++) {
      if (this.loaded.has(rainAmbienceKey(kind, i))) loaded.push(i);
    }
    return loaded;
  }

  private pickRainVariant(
    kind: "exterior" | "interior",
    lastVariant: number,
  ): number {
    const loaded = this.loadedRainVariants(kind);
    if (loaded.length === 0) return 0;
    let pick = loaded[Math.floor(Math.random() * loaded.length)] ?? 0;
    if (loaded.length > 1 && pick === lastVariant) {
      pick = loaded.find((v) => v !== lastVariant) ?? pick;
    }
    return pick;
  }

  private playRainTake(
    kind: "exterior" | "interior",
    lastVariant: number,
    volume: number,
  ): { sound: Phaser.Sound.BaseSound; variant: number; key: string } | null {
    const variant = this.pickRainVariant(kind, lastVariant);
    const key = rainAmbienceKey(kind, variant);
    const sound = this.playKey(key, key, { volume, loop: false });
    if (!sound) return null;
    return { sound, variant, key };
  }

  private tickRainPlaylist(
    bed: RainPlaylist,
    kind: "exterior" | "interior",
    targetGain: number,
    dtMs: number,
  ) {
    const rate =
      targetGain > bed.gain ? WIND_FADE_IN_PER_SEC : WIND_FADE_OUT_PER_SEC;
    const step = (rate * Math.max(0, dtMs)) / 1000;
    if (bed.gain < targetGain) bed.gain = Math.min(targetGain, bed.gain + step);
    else if (bed.gain > targetGain) {
      bed.gain = Math.max(targetGain, bed.gain - step);
    }

    if (bed.gain <= 0.001) {
      bed.gain = 0;
      this.stopRainPlaylist(bed);
      return;
    }

    if (bed.outgoing && !rainTakeAlive(bed.outgoing)) {
      this.stopSound(bed.outgoing);
      bed.outgoing = null;
      bed.outgoingKey = "";
    }
    if (bed.incoming && !rainTakeAlive(bed.incoming)) {
      this.stopSound(bed.incoming);
      bed.incoming = null;
      bed.incomingKey = "";
      bed.mix = 0;
    }

    if (!bed.outgoing && bed.incoming) {
      bed.outgoing = bed.incoming;
      bed.outgoingKey = bed.incomingKey;
      bed.incoming = null;
      bed.incomingKey = "";
      bed.mix = 0;
    }

    if (!bed.outgoing) {
      const take = this.playRainTake(kind, bed.lastVariant, bed.gain);
      if (!take) return;
      bed.outgoing = take.sound;
      bed.outgoingKey = take.key;
      bed.lastVariant = take.variant;
      bed.mix = 0;
    }

    if (!bed.incoming) {
      const remainMs = rainTakeRemainMs(bed.outgoing, bed.outgoingKey, (key) =>
        this.audioDurationMs(key),
      );
      const fadeMs = Math.max(
        400,
        Math.min(RAIN_CROSSFADE_MS, remainMs || RAIN_CROSSFADE_MS),
      );
      if (remainMs > 0 && remainMs <= fadeMs) {
        const take = this.playRainTake(kind, bed.lastVariant, 0.001);
        if (take) {
          bed.incoming = take.sound;
          bed.incomingKey = take.key;
          bed.lastVariant = take.variant;
          bed.fadeMs = fadeMs;
          bed.mix = 0;
        }
      }
    }

    if (bed.incoming) {
      bed.mix = Math.min(1, bed.mix + dtMs / Math.max(400, bed.fadeMs));
      if (bed.mix >= 1) {
        this.stopSound(bed.outgoing);
        bed.outgoing = bed.incoming;
        bed.outgoingKey = bed.incomingKey;
        bed.incoming = null;
        bed.incomingKey = "";
        bed.mix = 0;
      }
    }

    this.applyRainPlaylistVolumes(bed);
  }

  private applyRainPlaylistVolumes(bed: RainPlaylist) {
    if (bed.gain <= 0) return;
    const mix = clamp(bed.mix, 0, 1);
    const outG = Math.cos(mix * Math.PI * 0.5);
    const inG = Math.sin(mix * Math.PI * 0.5);
    if (bed.outgoing) {
      try {
        applySoundVolume(
          bed.outgoing,
          this.volume * bed.gain * outG * this.zoomMix(),
        );
      } catch {
        /* ignore */
      }
    }
    if (bed.incoming) {
      try {
        applySoundVolume(
          bed.incoming,
          this.volume * bed.gain * inG * this.zoomMix(),
        );
      } catch {
        /* ignore */
      }
    }
  }

  private stopRainPlaylist(bed: RainPlaylist) {
    if (bed.outgoing) this.stopSound(bed.outgoing);
    if (bed.incoming) this.stopSound(bed.incoming);
    bed.outgoing = null;
    bed.incoming = null;
    bed.outgoingKey = "";
    bed.incomingKey = "";
    bed.mix = 0;
    bed.fadeMs = RAIN_CROSSFADE_MS;
  }

  private tickFadedLoop(
    loop: FadedLoop,
    key: string,
    targetGain: number,
    dtMs: number,
  ) {
    const rate =
      targetGain > loop.gain ? WIND_FADE_IN_PER_SEC : WIND_FADE_OUT_PER_SEC;
    const step = (rate * Math.max(0, dtMs)) / 1000;
    if (loop.gain < targetGain) {
      loop.gain = Math.min(targetGain, loop.gain + step);
    } else if (loop.gain > targetGain) {
      loop.gain = Math.max(targetGain, loop.gain - step);
    }

    if (loop.gain <= 0.001) {
      loop.gain = 0;
      this.stopFadedLoop(loop);
      return;
    }
    if (!loopSoundAlive(loop.sound)) {
      this.stopFadedLoop(loop);
      loop.sound = this.playKey(key, key, {
        volume: loop.gain * this.zoomMix(),
        loop: true,
      });
      return;
    }
    try {
      applySoundVolume(
        loop.sound,
        this.volume * loop.gain * this.zoomMix(),
      );
    } catch {
      /* ignore */
    }
  }

  private stopFadedLoop(loop: FadedLoop) {
    if (!loop.sound) return;
    this.stopSound(loop.sound);
    loop.sound = null;
  }

  private tickForestAmbience(inForest: boolean, period: ForestAmbiencePeriod) {
    if (!inForest) {
      this.stopForestAmbience();
      this.forestScheduled = false;
      this.nextForestAt = 0;
      this.forestPeriod = null;
      return;
    }
    const now = Date.now();
    if (this.forestPeriod !== period) {
      if (this.forestSound) this.stopForestAmbience();
      this.forestPeriod = period;
      if (this.forestScheduled) {
        this.nextForestAt =
          now + randRange(FOREST_PERIOD_SWITCH_MIN_MS, FOREST_PERIOD_SWITCH_MAX_MS);
      }
    }
    if (!this.forestScheduled) {
      this.nextForestAt = now + randRange(FOREST_ENTER_MIN_MS, FOREST_ENTER_MAX_MS);
      this.forestScheduled = true;
    }
    if (this.forestSound) return;
    if (now < this.nextForestAt) return;
    const loaded: number[] = [];
    const count = FOREST_AMBIENCE_VARIANTS[period];
    for (let i = 0; i < count; i++) {
      if (this.loaded.has(forestAmbienceKey(period, i))) loaded.push(i);
    }
    if (loaded.length === 0) {
      this.nextForestAt = now + randRange(FOREST_GAP_MIN_MS, FOREST_GAP_MAX_MS);
      return;
    }
    let pick = loaded[Math.floor(Math.random() * loaded.length)] ?? 0;
    if (loaded.length > 1 && pick === this.lastForestVariant) {
      pick = loaded.find((v) => v !== pick) ?? pick;
    }
    const key = forestAmbienceKey(period, pick);
    const sound = this.playKey(key, key, {
      volume: FOREST_AMBIENCE_GAIN * this.zoomMix(),
    });
    if (!sound) {
      this.nextForestAt = now + 3000;
      return;
    }
    this.lastForestVariant = pick;
    this.forestSound = sound;
    this.nextForestAt = now + FOREST_GAP_MIN_MS;
    sound.once("complete", () => {
      if (this.forestSound === sound) this.forestSound = null;
      if (!this.forestScheduled) return;
      this.nextForestAt = Date.now() + randRange(FOREST_GAP_MIN_MS, FOREST_GAP_MAX_MS);
    });
    sound.once("destroy", () => {
      if (this.forestSound === sound) this.forestSound = null;
    });
  }

  private refreshForestAmbience() {
    if (!this.forestSound?.isPlaying) return;
    try {
      applySoundVolume(
        this.forestSound,
        this.volume * FOREST_AMBIENCE_GAIN * this.zoomMix(),
      );
    } catch {
      /* ignore */
    }
  }

  private stopForestAmbience() {
    if (!this.forestSound) return;
    const sound = this.forestSound;
    this.forestSound = null;
    this.stopSound(sound);
  }

  private stopSound(sound: Phaser.Sound.BaseSound) {
    try {
      sound.stop();
      sound.destroy();
    } catch {
      /* already stopped / scene tearing down */
    }
  }

  private dropLiveGunshot(sound: Phaser.Sound.BaseSound) {
    this.liveGunshots = this.liveGunshots.filter((live) => live.sound !== sound);
  }

  private dropLiveZombieGroan(sound: Phaser.Sound.BaseSound) {
    this.liveZombieGroans = this.liveZombieGroans.filter(
      (live) => live.sound !== sound,
    );
  }
}

function zoomVolumeGain(zoom: number, zoomMin: number, zoomMax: number): number {
  if (!(zoomMax > zoomMin)) return GUNSHOT_ZOOM_IN_GAIN;
  const t = clamp((zoom - zoomMin) / (zoomMax - zoomMin), 0, 1);
  return GUNSHOT_ZOOM_OUT_GAIN + (GUNSHOT_ZOOM_IN_GAIN - GUNSHOT_ZOOM_OUT_GAIN) * t;
}

function spacesDiffer(
  listen: GunshotListener,
  source: GunshotSource,
): boolean {
  const srcIn = !!source.inInterior;
  if (listen.inInterior !== srcIn) return true;
  if (
    listen.inInterior &&
    srcIn &&
    (listen.buildingX !== (source.buildingX ?? 0) ||
      listen.buildingY !== (source.buildingY ?? 0))
  ) {
    return true;
  }
  return false;
}

/**
 * Phaser loops by scheduling the next buffer in Sound.update (rAF). Hidden
 * tabs pause that tick, so the current take finishes and the bed dies.
 * Native AudioBufferSourceNode.loop keeps playing without the game loop.
 */
function rainTakeAlive(sound: Phaser.Sound.BaseSound | null): boolean {
  if (!sound) return false;
  try {
    return sound.isPlaying || sound.isPaused;
  } catch {
    return false;
  }
}

function rainTakeRemainMs(
  sound: Phaser.Sound.BaseSound | null,
  key: string,
  durationMsOf: (key: string) => number,
): number {
  if (!sound) return 0;
  let duration = durationMsOf(key);
  if (duration <= 0) {
    const sec = (sound as Phaser.Sound.BaseSound & { duration?: number })
      .duration;
    duration =
      typeof sec === "number" && Number.isFinite(sec) ? Math.round(sec * 1000) : 0;
  }
  if (duration <= 0) return 0;
  let seekMs = 0;
  try {
    const seek = (sound as Phaser.Sound.BaseSound & { seek?: number }).seek;
    if (typeof seek === "number" && Number.isFinite(seek)) {
      seekMs = seek * 1000;
    }
  } catch {
    seekMs = 0;
  }
  return Math.max(0, duration - seekMs);
}

function loopSoundAlive(
  sound: Phaser.Sound.BaseSound | null,
): sound is Phaser.Sound.BaseSound {
  if (!sound) return false;
  if (sound.isPlaying || sound.isPaused) return true;
  const web = sound as Phaser.Sound.BaseSound & {
    source?: AudioBufferSourceNode | null;
  };
  return !!web.source?.loop;
}

function enableBackgroundSafeLoop(sound: Phaser.Sound.BaseSound) {
  const html = sound as Phaser.Sound.BaseSound & { audio?: HTMLAudioElement };
  if (html.audio) {
    html.audio.loop = true;
    const rate =
      typeof (sound as Phaser.Sound.BaseSound & { rate?: number }).rate ===
        "number"
        ? (sound as Phaser.Sound.BaseSound & { rate: number }).rate
        : 1;
    if (Number.isFinite(rate) && rate > 0) html.audio.playbackRate = rate;
    return;
  }

  const web = sound as Phaser.Sound.BaseSound & {
    source?: AudioBufferSourceNode | null;
    audioBuffer?: AudioBuffer | null;
    muteNode?: AudioNode;
    manager?: { context?: AudioContext };
    stopAndRemoveLoopBufferSource?: () => void;
    playTime?: number;
    startTime?: number;
    hasEnded?: boolean;
    hasLooped?: boolean;
    currentConfig?: { loop?: boolean };
    rate?: number;
  };
  const ctx = web.manager?.context;
  const buffer = web.audioBuffer;
  const mute = web.muteNode;
  if (!ctx || !buffer || !mute || !web.source) return;

  try {
    web.stopAndRemoveLoopBufferSource?.();
  } catch {
    /* Phaser loop source may already be gone */
  }

  let offset = 0;
  if (typeof web.startTime === "number") {
    offset = Math.max(0, ctx.currentTime - web.startTime);
  }
  offset %= buffer.duration;

  try {
    web.source.onended = null;
    web.source.stop();
    web.source.disconnect();
  } catch {
    /* already stopped */
  }

  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  const rate =
    typeof web.rate === "number" && Number.isFinite(web.rate) && web.rate > 0
      ? web.rate
      : 1;
  src.playbackRate.value = rate;
  src.connect(mute);
  web.source = src;
  const when = ctx.currentTime;
  src.start(when, offset);
  web.playTime = when - offset;
  web.startTime = when;
  web.hasEnded = false;
  web.hasLooped = false;
  // Phaser otherwise swaps buffer sources in update() after a tab-return
  // time jump and clicks the bed. Native loop does not need that path.
  if (web.currentConfig) web.currentConfig.loop = false;
}

function applyExteriorLowpass(
  sound: Phaser.Sound.BaseSound,
  ctx: AudioContext | null,
) {
  if (!ctx) return;
  const web = sound as Phaser.Sound.BaseSound & {
    volumeNode?: GainNode;
    spatialNode?: AudioNode;
    pannerNode?: AudioNode;
  };
  const vol = web.volumeNode;
  if (!vol) return;
  try {
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = GUNSHOT_EXTERIOR_LOWPASS_HZ;
    filter.Q.value = 0.5;
    vol.disconnect();
    vol.connect(filter);
    if (web.spatialNode) filter.connect(web.spatialNode);
    else if (web.pannerNode) filter.connect(web.pannerNode);
    else filter.connect(ctx.destination);
  } catch {
    /* HTML5 backend / graph already torn down */
  }
}

function applySoundVolume(sound: Phaser.Sound.BaseSound, volume: number) {
  (sound as Phaser.Sound.BaseSound & { volume: number }).volume = volume;
}

function applySoundRate(sound: Phaser.Sound.BaseSound, rate: number) {
  const r = Math.max(0.05, rate);
  const web = sound as Phaser.Sound.BaseSound & {
    rate?: number;
    source?: AudioBufferSourceNode | null;
    setRate?: (value: number) => void;
    audio?: HTMLAudioElement;
  };
  try {
    web.setRate?.(r);
  } catch {
    web.rate = r;
  }
  if (web.source) {
    try {
      web.source.playbackRate.value = r;
    } catch {
      /* source already stopped */
    }
  }
  if (web.audio) {
    try {
      web.audio.playbackRate = r;
    } catch {
      /* HTML5 backend */
    }
  }
}

function applySoundPan(sound: Phaser.Sound.BaseSound, pan: number) {
  const panned = sound as Phaser.Sound.BaseSound & {
    setPan?: (value: number) => void;
  };
  panned.setPan?.(clamp(pan, -1, 1));
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function audioUrl(rel: string): string {
  const trimmed = rel.replace(/^\/?assets\/audio\//, "");
  return `/assets/audio/${trimmed}`;
}

function sfxKey(id: SfxId): string {
  return `sfx:${id}`;
}

function gunshotKey(itemId: string, variant: number): string {
  return `sfx:gunshot:${itemId}:${variant}`;
}

function menuKey(): string {
  return "sfx:menu";
}

function windAmbienceKey(): string {
  return "sfx:ambience:wind";
}

function rainAmbienceKey(
  kind: "exterior" | "interior",
  variant = 0,
): string {
  return `sfx:ambience:rain:${kind}:${variant}`;
}

function thunderKey(
  kind: "exterior" | "interior",
  variant: number,
): string {
  return `sfx:ambience:thunder:${kind}:${variant}`;
}

function forestAmbienceKey(period: ForestAmbiencePeriod, variant: number): string {
  return `sfx:ambience:forest:${period}:${variant}`;
}

function forestAmbienceFile(period: ForestAmbiencePeriod, variant: number): string {
  const stem = period === "day" ? "DayForestAmbience" : "NightForestAmbience";
  return `Ambience/${stem}${variant + 1}.wav`;
}

function consumeKey(
  kind: "drink" | "eat" | "bandage" | "tincture" | "vitamins" | "pills",
  variant: number,
): string {
  return `sfx:consume:${kind}:${variant}`;
}

function fireplaceExtinguishKey(): string {
  return "sfx:fireplace:extinguish";
}

function treeFallKey(): string {
  return "sfx:tree:fall:0";
}

function treeChopKey(): string {
  return "sfx:tree:chop:0";
}

function meleeHitKey(bank: MeleeHitBank, variant: number): string {
  return `sfx:${bank}:hit:${variant}`;
}

function doorCloseKey(style: "wood" | "hospital"): string {
  return `sfx:door:close:${style}`;
}

function doorOpenKey(style: "wood" | "hospital"): string {
  return `sfx:door:open:${style}`;
}

function doorLockedKey(): string {
  return "sfx:door:locked";
}

function doorLockpickKey(): string {
  return "sfx:door:lockpick";
}

const FURNITURE_SEARCH_BANK_COUNT = 19;
const SEARCH_GAIN_DEFAULT = 0.15;
/** SearchBody1.wav */
const BODY_SEARCH_GAIN = 0.15;
/**
 * Per SearchN.wav gain. Unlisted banks use SEARCH_GAIN_DEFAULT.
 * 1 desk/dresser  2 beds  3 boxes  4 kitchen  5 fridges  6 cabinets
 * 7 lockers  8 bookshelves  9 bags/chairs  10 water  11 trash
 * 12 checkout  13 store shelves  14 IV  15 counter  16 vending
 * 17 tables  18 camp table  19 footlocker
 */
const FURNITURE_SEARCH_GAIN: Partial<Record<number, number>> = {
  1: 0.2,
  2: 0.1,
  3: 0.1,
  4: 0.3,
  5: 0.15,
  6: 0.15,
  7: 0.15,
  8: 0.075,
  9: 0.05,
  10: 0.15,
  11: 0.1,
  12: 0.15,
  13: 0.05,
  14: 0.15,
  15: 0.15,
  16: 0.15,
  17: 0.05,
  18: 0.1,
  19: 0.15,
};

/** objectType → SearchN.wav. Body-search types are handled in searchKeyForFurniture. */
const FURNITURE_SEARCH_BANK: Record<string, number> = {
  desk: 1,
  dresser: 1,
  nightstand: 1,
  desk2: 1,
  desk3: 1,
  conferencetable: 1,
  copier: 6,
  medicalreception: 1,
  drawers: 1,
  bed: 2,
  hospitalbed: 2,
  motelbed: 2,
  militarybed: 2,
  militarybasket: 2,
  bigbox: 3,
  bigshelf: 3,
  kitchensink: 4,
  superfridge1: 4,
  range: 4,
  drinkdisplay: 4,
  hotdisplay: 4,
  fridge: 5,
  minifridge: 5,
  medicalcart: 6,
  medicaldrawers: 6,
  cabinet: 6,
  guncabinet: 7,
  safe1: 7,
  lockers: 7,
  bookshelf: 8,
  bookshelf2: 8,
  bagchair: 9,
  threeseater2: 9,
  threeseater3: 9,
  groundbackpack: 9,
  kitbag: 9,
  suitcase: 9,
  watercooler: 10,
  watercontainer: 10,
  trashcan: 11,
  checkout: 12,
  retailcheckout1: 12,
  supershelf1: 13,
  supershelf2: 13,
  ivstand: 14,
  counter: 15,
  vendingmachine: 16,
  retailcase1: 16,
  retailcase2: 16,
  dinnertable: 17,
  canteentable1: 17,
  canteentable2: 17,
  canteentable3: 17,
  camptable: 18,
  footlocker: 19,
};

function searchKey(kind: string, variant: number): string {
  return `sfx:search:${kind}:${variant}`;
}

function furnitureSearchKey(bank: number): string {
  return `sfx:search:furniture:${bank}`;
}

function reloadKey(kind: string, variant: number): string {
  return `sfx:reload:${kind}:${variant}`;
}

function unloadKey(kind: string, variant: number): string {
  return `sfx:unload:${kind}:${variant}`;
}

function firearmSfxKind(itemId: string): string | null {
  if (itemId === "weapon_pistol") return "pistol";
  if (itemId === "weapon_assault_rifle") return "ak";
  if (itemId === "weapon_m4a1") return "m4";
  if (itemId === "weapon_revolver") return "revolver";
  if (itemId === "weapon_hunting_rifle") return "hunting";
  if (itemId === "weapon_shotgun") return "shotgun";
  return null;
}

function reloadKeyForWeapon(itemId: string): string | null {
  const kind = firearmSfxKind(itemId);
  return kind ? reloadKey(kind, 0) : null;
}

function unloadKeyForWeapon(itemId: string): string | null {
  const kind = firearmSfxKind(itemId);
  return kind ? unloadKey(kind, 0) : null;
}

function usesBodySearchSound(objectType?: string): boolean {
  return (
    objectType === "deadofficer" ||
    objectType === "armchair" ||
    objectType === "sofa" ||
    objectType === "clothingrack1" ||
    objectType === "clothingrack2" ||
    objectType === "clothingrack3"
  );
}

function searchKeyForFurniture(objectType?: string): string {
  if (usesBodySearchSound(objectType)) return searchKey("body", 0);
  const bank = objectType ? FURNITURE_SEARCH_BANK[objectType] : undefined;
  return furnitureSearchKey(bank ?? 1);
}

function searchGain(kind: "furniture" | "body", objectType?: string): number {
  if (kind === "body" || usesBodySearchSound(objectType)) return BODY_SEARCH_GAIN;
  const bank = objectType ? FURNITURE_SEARCH_BANK[objectType] : undefined;
  return FURNITURE_SEARCH_GAIN[bank ?? 1] ?? SEARCH_GAIN_DEFAULT;
}

function zombieGroanKey(variant: number): string {
  return `sfx:zombie:groan:${variant}`;
}

function consumeAudioKeyForItem(itemId: string): string | null {
  if (itemId === "bandages" || itemId === "rags") {
    return consumeKey("bandage", 0);
  }
  if (itemId === "alcohol") return consumeKey("tincture", 0);
  if (itemId === "multivitamins") return consumeKey("vitamins", 0);
  if (itemId === "antibiotics") return consumeKey("pills", 0);
  const action = getConsumeAction(itemId);
  if (action === "drink") {
    return consumeKey("drink", itemId === "water" ? 0 : 1);
  }
  if (
    itemId === "hot_chips" ||
    itemId === "onion_chips" ||
    itemId === "salted_chips"
  ) {
    return consumeKey("eat", 0);
  }
  if (
    itemId === "canned_beans" ||
    itemId === "canned_tuna" ||
    itemId === "canned_peaches"
  ) {
    return consumeKey("eat", 1);
  }
  if (action === "eat") return consumeKey("eat", 0);
  return null;
}

function randRange(min: number, max: number): number {
  return min + Math.random() * Math.max(0, max - min);
}

function readStoredVolume(): number {
  try {
    const raw = localStorage.getItem(VOLUME_KEY);
    if (raw == null) return 0.7;
    const n = Number(raw);
    return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0.7;
  } catch {
    return 0.7;
  }
}

function readStoredMute(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export { resolveGunshotVariant };
