import Phaser from "phaser";
import {
  GUARD_NPC_HUMAN,
  GUARD_NPC_RED_MAN,
  GUARD_NPC_TRADER_GUARD,
  GUARD_NPC_TRADER_MAN,
  GUARD_SKIN_3,
  PLAYER_SKIN_DEFAULT,
  normalizeGuardSkin,
  normalizeRedManSkin,
  normalizeZombieSkin,
} from "@zombie/shared";
import { CLIENT_RENDER_RADIUS, IS_MOBILE } from "../gameConfig";
import {
  atlasKeyForPack,
  BOOT_PACK_IDS,
  isBootPackId,
  normalizePlayerClothingSkin,
  type EntityPackId,
} from "./assetManifest";
import {
  isAtlasUnavailable,
  markAtlasUnavailable,
  onPackLoaded,
  queueMissingPackImages,
  queuePackLoad,
  releasePackTextures,
  resetAtlasRegistry,
  textureKeyExists,
} from "./atlasRegistry";

/**
 * Proximity lazy-load for NPC / clothing sprite packs.
 * Boot keeps PlayerMan1 + ZombieMan1 + MilitiaGuard1 (fallbacks).
 * Other skins load when an entity is within render radius + preload margin,
 * and unload after staying outside a wider keep radius for a grace period.
 *
 * Each pack is a single multi-page atlas, so packs no longer share individual
 * texture keys and unloading one can never delete another's art.
 */

export type { EntityPackId } from "./assetManifest";
export { normalizePlayerClothingSkin } from "./assetManifest";

type PackState = "absent" | "loading" | "ready";

type PackRecord = {
  id: EntityPackId;
  state: PackState;
  /** Loose-PNG keys owned by this pack (empty when the atlas path is used). */
  keys: string[];
  /** Last time this pack was required by a nearby entity. */
  lastNeededAt: number;
};

/** Start loading before the entity enters the drawn view. */
const PRELOAD_MARGIN = IS_MOBILE ? 14 : 20;
/** Keep textures until well outside the view (avoids thrash at the edge). */
const KEEP_MARGIN = IS_MOBILE ? 28 : 40;
/** Unload only after the pack stays unneeded this long. */
const UNLOAD_GRACE_MS = 45_000;

const packs = new Map<EntityPackId, PackRecord>();
let loadInFlight = false;
const loadQueue: EntityPackId[] = [];
/** Bumped by resetEntityAssetLoader so in-flight loads ignore stale completions. */
let loadEpoch = 0;

function ensureRecord(id: EntityPackId): PackRecord {
  let rec = packs.get(id);
  if (!rec) {
    rec = { id, state: "absent", keys: [], lastNeededAt: 0 };
    packs.set(id, rec);
  }
  return rec;
}

export function coywolfPackReady(): boolean {
  return isEntityPackReady("coywolf");
}

export function bearPackReady(): boolean {
  return isEntityPackReady("bear");
}

export function crowPackReady(): boolean {
  return isEntityPackReady("crow");
}

export function rabbitPackReady(): boolean {
  return isEntityPackReady("rabbit");
}

export function isEntityPackReady(id: EntityPackId): boolean {
  return packs.get(id)?.state === "ready";
}

/**
 * Boot-resident fallbacks — never unloaded. Called once BootScene's loader has
 * finished so the atlas frames become resolvable by their legacy keys.
 */
export function markBootEntityPacksReady(scene?: Phaser.Scene) {
  for (const id of BOOT_PACK_IDS) {
    const rec = ensureRecord(id as EntityPackId);
    if (scene) {
      // A missing atlas file leaves the pack absent so it retries as loose PNGs.
      if (!scene.textures.exists(atlasKeyForPack(id)) && !isAtlasUnavailable(id)) {
        markAtlasUnavailable(id);
        rec.state = "absent";
        queuePack(id as EntityPackId);
        continue;
      }
      onPackLoaded(scene, id);
    }
    rec.state = "ready";
  }
  if (scene) {
    const missingSit = queueMissingPackImages(scene, "guard-1");
    if (missingSit > 0 && !scene.load.isLoading()) scene.load.start();
    startNextLoad(scene);
  }
}

/**
 * Re-queue the boot fallback pack if its art went missing (scene restart, or a
 * failed atlas fetch). Otherwise patrols sit on Phaser's __MISSING texture
 * until a full page reload.
 */
function repairBootResidentTextures(scene: Phaser.Scene) {
  const sentinel = "militiaguard1-idle-ak-S";
  if (textureKeyExists(scene, sentinel)) return;
  const rec = ensureRecord("guard-1");
  if (rec.state === "loading") return;
  rec.state = "absent";
  rec.keys = [];
  queuePack("guard-1");
}

function queuePack(id: EntityPackId) {
  const rec = ensureRecord(id);
  rec.lastNeededAt = Date.now();
  if (rec.state === "ready" || rec.state === "loading") return;
  if (!loadQueue.includes(id)) loadQueue.push(id);
}

/** Move a pack to the front of the lazy-load queue (no-op if ready/loading). */
export function prioritizeEntityPack(id: EntityPackId) {
  const rec = ensureRecord(id);
  rec.lastNeededAt = Date.now();
  if (rec.state === "ready" || rec.state === "loading") return;
  const idx = loadQueue.indexOf(id);
  if (idx >= 0) loadQueue.splice(idx, 1);
  loadQueue.unshift(id);
}

/**
 * Ensure a PlayerMan clothing skin pack is loading ASAP (Wear / inventory has
 * the shirt). Idle frames are scheduled first so the sprite can swap early.
 */
export function ensurePlayerClothingPack(scene: Phaser.Scene, skin: number) {
  const s = normalizePlayerClothingSkin(skin);
  if (s === PLAYER_SKIN_DEFAULT) return;
  const id = `player-${s}` as EntityPackId;
  prioritizeEntityPack(id);
  startNextLoad(scene);
}

/**
 * Packs whose newest frames may be missing from the last atlas build.
 * Those PNGs load loose before the pack is marked ready.
 */
function packLoadsLooseExtras(id: EntityPackId): boolean {
  return (
    id === "zombie-6" ||
    id === "zombie-10" ||
    id === "coywolf" ||
    id === "bear" ||
    id === "crow" ||
    id === "rabbit" ||
    id === "traderguard" ||
    id === `guard-${GUARD_SKIN_3}`
  );
}

function startNextLoad(scene: Phaser.Scene) {
  if (loadInFlight) return;
  if (!scene.sys?.isActive()) {
    loadInFlight = false;
    loadQueue.length = 0;
    return;
  }
  const id = loadQueue.shift();
  if (!id) return;

  const rec = ensureRecord(id);
  if (rec.state === "ready") {
    startNextLoad(scene);
    return;
  }

  rec.state = "loading";
  loadInFlight = true;

  const request = queuePackLoad(scene, id);

  const finish = () => {
    // An atlas request that produced no texture means the file is missing;
    // fall back to loose PNGs so the pack still renders.
    if (request.usedAtlas && !scene.textures.exists(atlasKeyForPack(id))) {
      markAtlasUnavailable(id);
      rec.state = "absent";
      loadInFlight = false;
      queuePack(id);
      startNextLoad(scene);
      return;
    }
    onPackLoaded(scene, id);
    const markReady = () => {
      rec.keys = request.keys;
      rec.state = "ready";
      rec.lastNeededAt = Date.now();
      loadInFlight = false;
      startNextLoad(scene);
    };
    // Frames added after the last atlas build still need to land before the
    // pack is ready. Otherwise crawlers stay on the standing walk, coyotes
    // keep a walk frame while they bolt, and the market guard never shows
    // the clipboard idle.
    const extras = packLoadsLooseExtras(id)
      ? queueMissingPackImages(scene, id)
      : 0;
    if (extras > 0) {
      const epoch = loadEpoch;
      scene.load.once(Phaser.Loader.Events.COMPLETE, () => {
        if (epoch !== loadEpoch) {
          loadInFlight = false;
          return;
        }
        markReady();
      });
      if (!scene.load.isLoading()) scene.load.start();
      return;
    }
    markReady();
  };

  if (request.queued === 0) {
    finish();
    return;
  }

  scene.load.once(Phaser.Loader.Events.COMPLETE, finish);
  if (!scene.load.isLoading()) {
    scene.load.start();
  }
}

function unloadPack(scene: Phaser.Scene, rec: PackRecord) {
  if (isBootPackId(rec.id)) return;
  // Mark absent first so resolveLoaded* / packReady fall back before any
  // mid-remove render or visual update can still treat the pack as ready.
  const keys = rec.keys;
  rec.keys = [];
  rec.state = "absent";
  releasePackTextures(scene, rec.id, keys);
}

function packForZombieSkin(skin: number): EntityPackId {
  return `zombie-${normalizeZombieSkin(skin)}`;
}

function packForPlayerClothingSkin(skin: number): EntityPackId {
  return `player-${normalizePlayerClothingSkin(skin)}`;
}

function packForGuard(npcKind: number, skin: number): EntityPackId | null {
  if (npcKind === GUARD_NPC_TRADER_MAN) return "traderman";
  if (npcKind === GUARD_NPC_TRADER_GUARD) return "traderguard";
  if (npcKind === GUARD_NPC_RED_MAN) {
    return `redman-${normalizeRedManSkin(skin)}`;
  }
  if (npcKind === GUARD_NPC_HUMAN || npcKind == null) {
    const s = normalizeGuardSkin(skin);
    if (s <= 1) return "guard-1";
    return `guard-${s}`;
  }
  return null;
}

/**
 * Request packs for entities near the local player. Call once per frame from WorldScene.
 */
export function syncEntityAssetPacks(
  scene: Phaser.Scene,
  opts: {
    playerX: number;
    playerY: number;
    /**
     * Second keep/preload origin (e.g. overworld tile while the player is
     * inside a building). Prevents street NPC packs from unloading during an
     * interior visit just because interior coords are far from outdoor NPCs.
     */
    alsoNearX?: number;
    alsoNearY?: number;
    zombies: Iterable<{ x: number; y: number; skin?: number }>;
    guards: Iterable<{
      x: number;
      y: number;
      skin?: number;
      npcKind?: number;
    }>;
    /** Nearby players / corpses that need clothing skins. */
    players?: Iterable<{ x: number; y: number; clothingSkin?: number }>;
    coywolves?: Iterable<{ x: number; y: number }>;
    bears?: Iterable<{ x: number; y: number }>;
    crows?: Iterable<{ x: number; y: number }>;
    rabbits?: Iterable<{ x: number; y: number }>;
  },
) {
  repairBootResidentTextures(scene);

  const needed = collectNeededEntityPacks(opts);
  if (opts.alsoNearX != null && opts.alsoNearY != null) {
    for (const id of collectNeededEntityPacks({
      ...opts,
      playerX: opts.alsoNearX,
      playerY: opts.alsoNearY,
    })) {
      needed.add(id);
    }
  }
  const keepR = CLIENT_RENDER_RADIUS + KEEP_MARGIN;
  const now = Date.now();
  const origins: { x: number; y: number }[] = [
    { x: opts.playerX, y: opts.playerY },
  ];
  if (opts.alsoNearX != null && opts.alsoNearY != null) {
    origins.push({ x: opts.alsoNearX, y: opts.alsoNearY });
  }

  const nearAnyOrigin = (x: number, y: number) => {
    const tx = Math.floor(x);
    const ty = Math.floor(y);
    for (const o of origins) {
      if (Math.max(Math.abs(tx - o.x), Math.abs(ty - o.y)) <= keepR) {
        return true;
      }
    }
    return false;
  };

  const refreshKeep = (x: number, y: number, pack: EntityPackId | null) => {
    if (!pack || needed.has(pack)) return;
    const rec = packs.get(pack);
    if (rec?.state !== "ready") return;
    if (!nearAnyOrigin(x, y)) return;
    rec.lastNeededAt = now;
    needed.add(pack);
  };

  for (const z of opts.zombies) {
    refreshKeep(z.x, z.y, packForZombieSkin(z.skin ?? 1));
  }
  for (const g of opts.guards) {
    refreshKeep(
      g.x,
      g.y,
      packForGuard(g.npcKind ?? GUARD_NPC_HUMAN, g.skin ?? 1),
    );
  }
  for (const p of opts.players ?? []) {
    refreshKeep(p.x, p.y, packForPlayerClothingSkin(p.clothingSkin ?? 1));
  }

  for (const id of needed) {
    queuePack(id);
  }

  for (const rec of packs.values()) {
    if (needed.has(rec.id)) continue;
    if (rec.state !== "ready") continue;
    if (now - rec.lastNeededAt < UNLOAD_GRACE_MS) continue;
    unloadPack(scene, rec);
  }

  startNextLoad(scene);
}

/** Packs that should be loaded for the current spawn view (no side effects). */
export function collectNeededEntityPacks(opts: {
  playerX: number;
  playerY: number;
  zombies: Iterable<{ x: number; y: number; skin?: number }>;
  guards: Iterable<{
    x: number;
    y: number;
    skin?: number;
    npcKind?: number;
  }>;
  players?: Iterable<{ x: number; y: number; clothingSkin?: number }>;
  coywolves?: Iterable<{ x: number; y: number }>;
  bears?: Iterable<{ x: number; y: number }>;
  crows?: Iterable<{ x: number; y: number }>;
  rabbits?: Iterable<{ x: number; y: number }>;
}): Set<EntityPackId> {
  const preloadR = CLIENT_RENDER_RADIUS + PRELOAD_MARGIN;
  const needed = new Set<EntityPackId>();

  const consider = (x: number, y: number, pack: EntityPackId | null) => {
    if (!pack) return;
    const dx = Math.abs(Math.floor(x) - opts.playerX);
    const dy = Math.abs(Math.floor(y) - opts.playerY);
    const dist = Math.max(dx, dy);
    if (dist <= preloadR) needed.add(pack);
  };

  for (const z of opts.zombies) {
    consider(z.x, z.y, packForZombieSkin(z.skin ?? 1));
  }
  for (const g of opts.guards) {
    consider(g.x, g.y, packForGuard(g.npcKind ?? GUARD_NPC_HUMAN, g.skin ?? 1));
  }
  for (const p of opts.players ?? []) {
    consider(p.x, p.y, packForPlayerClothingSkin(p.clothingSkin ?? 1));
  }
  for (const wolf of opts.coywolves ?? []) {
    consider(wolf.x, wolf.y, "coywolf");
  }
  for (const bear of opts.bears ?? []) {
    consider(bear.x, bear.y, "bear");
  }
  for (const crow of opts.crows ?? []) {
    consider(crow.x, crow.y, "crow");
  }
  for (const rabbit of opts.rabbits ?? []) {
    consider(rabbit.x, rabbit.y, "rabbit");
  }

  needed.add("zombie-1");
  needed.add("guard-1");
  needed.add("player-1");
  return needed;
}

/**
 * One-shot parallel load of nearby NPC packs for world join.
 * Avoids the MilitiaGuard1 fallback flash without changing steady-state lazy loading.
 */
export function preloadNearbyEntityPacks(
  scene: Phaser.Scene,
  opts: {
    playerX: number;
    playerY: number;
    zombies: Iterable<{ x: number; y: number; skin?: number }>;
    guards: Iterable<{
      x: number;
      y: number;
      skin?: number;
      npcKind?: number;
    }>;
    players?: Iterable<{ x: number; y: number; clothingSkin?: number }>;
  },
  timeoutMs = 4500,
): Promise<void> {
  markBootEntityPacksReady();
  const needed = [...collectNeededEntityPacks(opts)];
  const now = Date.now();
  for (const id of needed) {
    ensureRecord(id).lastNeededAt = now;
  }

  const missing = needed.filter((id) => !isEntityPackReady(id));
  if (missing.length === 0) return Promise.resolve();

  // Pause the serial queue — this batch owns the loader until finished.
  loadInFlight = true;
  for (const id of missing) {
    const idx = loadQueue.indexOf(id);
    if (idx >= 0) loadQueue.splice(idx, 1);
    ensureRecord(id).state = "loading";
  }

  return new Promise((resolve) => {
    let settled = false;
    const epoch = loadEpoch;
    const finish = (timedOut: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      // World left / re-entered while this batch was loading — drop results.
      if (epoch !== loadEpoch) {
        resolve();
        return;
      }
      if (timedOut) {
        for (const id of missing) {
          const rec = ensureRecord(id);
          if (rec.state === "loading") {
            rec.state = "absent";
            queuePack(id);
          }
        }
      }
      loadInFlight = false;
      startNextLoad(scene);
      resolve();
    };

    const timer = window.setTimeout(() => finish(true), timeoutMs);

    const keysByPack = new Map<EntityPackId, string[]>();
    const atlasRequested = new Set<EntityPackId>();
    let queued = 0;
    for (const id of missing) {
      const request = queuePackLoad(scene, id);
      if (request.usedAtlas) atlasRequested.add(id);
      keysByPack.set(id, request.keys);
      queued += request.queued;
    }

    const onComplete = () => {
      if (epoch !== loadEpoch) {
        finish(false);
        return;
      }
      const pendingExtras: EntityPackId[] = [];
      for (const id of missing) {
        const rec = ensureRecord(id);
        // Missing atlas file: drop back to the loose-PNG path on the next pass.
        if (atlasRequested.has(id) && !scene.textures.exists(atlasKeyForPack(id))) {
          markAtlasUnavailable(id);
          rec.state = "absent";
          rec.keys = [];
          queuePack(id);
          continue;
        }
        onPackLoaded(scene, id);
        const extras = packLoadsLooseExtras(id)
          ? queueMissingPackImages(scene, id)
          : 0;
        if (extras > 0) {
          pendingExtras.push(id);
          continue;
        }
        rec.keys = keysByPack.get(id) ?? [];
        rec.state = "ready";
        rec.lastNeededAt = Date.now();
      }
      if (pendingExtras.length > 0) {
        scene.load.once(Phaser.Loader.Events.COMPLETE, () => {
          if (epoch !== loadEpoch) {
            finish(false);
            return;
          }
          for (const id of pendingExtras) {
            const rec = ensureRecord(id);
            rec.keys = keysByPack.get(id) ?? [];
            rec.state = "ready";
            rec.lastNeededAt = Date.now();
          }
          finish(false);
        });
        if (!scene.load.isLoading()) scene.load.start();
        return;
      }
      finish(false);
    };

    if (queued === 0) {
      onComplete();
      return;
    }

    scene.load.once(Phaser.Loader.Events.COMPLETE, onComplete);
    if (!scene.load.isLoading()) {
      scene.load.start();
    }
  });
}

/** Resolve which texture skin to use (preferred if pack ready, else 1). */
export function resolveLoadedZombieSkin(preferred: number): number {
  const skin = normalizeZombieSkin(preferred);
  if (skin === 1 || isEntityPackReady(`zombie-${skin}`)) return skin;
  return 1;
}

/**
 * Prefer the worn clothing skin once its idle art is available. Full packs are
 * huge (every weapon strip); waiting for pack `ready` left the bare skin on
 * screen for a long time after Wear completed.
 */
export function resolveLoadedPlayerSkin(
  preferred: number,
  scene?: Phaser.Scene,
): number {
  const skin = normalizePlayerClothingSkin(preferred);
  if (skin === PLAYER_SKIN_DEFAULT) return skin;
  if (isEntityPackReady(`player-${skin}`)) return skin;
  if (scene?.textures.exists(`playerman${skin}-idle-S`)) return skin;
  return PLAYER_SKIN_DEFAULT;
}

export function resolveLoadedGuardSkin(preferred: number): number {
  const skin = normalizeGuardSkin(preferred);
  if (skin === 1 || isEntityPackReady(`guard-${skin}`)) return skin;
  return 1;
}

export function resolveLoadedRedManSkin(preferred: number): number {
  const skin = normalizeRedManSkin(preferred);
  if (isEntityPackReady(`redman-${skin}`)) return skin;
  for (let s = 1; s <= 4; s++) {
    if (isEntityPackReady(`redman-${s}`)) return s;
  }
  return 1;
}

export function traderManPackReady() {
  return isEntityPackReady("traderman");
}

export function traderGuardPackReady() {
  return isEntityPackReady("traderguard");
}

/**
 * Clear loader state when leaving the world. Boot atlases stay resident, so
 * the registry re-syncs from surviving textures instead of being wiped.
 */
export function resetEntityAssetLoader(scene?: Phaser.Scene) {
  loadEpoch++;
  packs.clear();
  loadQueue.length = 0;
  loadInFlight = false;
  resetAtlasRegistry(scene);
}
