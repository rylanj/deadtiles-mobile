import Phaser from "phaser";
import { IS_MOBILE } from "../gameConfig";
import {
  atlasKeyForPack,
  packEntries,
  type PackId,
} from "./assetManifest";

/**
 * Maps the legacy per-file texture keys onto atlas frames.
 *
 * Art used to be one WebGL texture per PNG. It is now packed into per-pack
 * multi-page atlases, but every call site still asks for keys like
 * `playerman1-walk-S-0003`. This registry resolves those to (atlasKey, frame)
 * so the rest of the client did not need rewriting, and so a pack can be freed
 * as a single texture instead of ~1,300 individual removes.
 *
 * If an atlas is missing (packer not run), loading falls back to individual
 * PNGs and the registry simply reports the key as its own texture.
 */

export type TextureRef = {
  key: string;
  /** Undefined when the key is a standalone texture rather than an atlas frame. */
  frame?: string;
};

/** Atlas variant to load. Mobile frames are capped at 128px, desktop at 160px. ConferenceTable1 is packed larger so its 512 art is not upscaled. */
const PROFILE = IS_MOBILE ? "mobile" : "desktop";
const ATLAS_BASE = `/assets/atlas/${PROFILE}`;

/** frameName -> atlasKey for every loaded atlas. */
const frameToAtlas = new Map<string, string>();
/** packId -> atlasKey, for unloading. */
const loadedAtlasByPack = new Map<PackId, string>();
/** Packs whose atlas file is known to be absent (fall back to loose PNGs). */
const atlasUnavailable = new Set<PackId>();

/**
 * Resolve a legacy texture key to whatever actually holds it.
 * Returns null when neither an atlas frame nor a loose texture exists.
 */
export function resolveTexture(
  scene: Phaser.Scene,
  key: string,
): TextureRef | null {
  const atlasKey = frameToAtlas.get(key);
  if (atlasKey && scene.textures.exists(atlasKey)) {
    return { key: atlasKey, frame: key };
  }
  if (scene.textures.exists(key)) return { key };
  return null;
}

/** Atlas-aware replacement for `scene.textures.exists(key)`. */
export function textureKeyExists(scene: Phaser.Scene, key: string): boolean {
  return resolveTexture(scene, key) !== null;
}

/** Atlas-aware `sprite.setTexture(key)`. Returns false when unresolvable. */
export function applyTextureKey(
  sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image,
  key: string,
): boolean {
  const scene = sprite.scene;
  if (!scene) return false;
  const ref = resolveTexture(scene, key);
  if (!ref) return false;
  if (ref.frame !== undefined) sprite.setTexture(ref.key, ref.frame);
  else sprite.setTexture(ref.key);
  return true;
}

/**
 * True when the sprite is currently displaying this logical key. Direct
 * `sprite.texture.key === key` comparisons break under atlases, where the
 * texture key is the atlas and the logical key is the frame name.
 */
export function spriteShowsKey(
  sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image,
  key: string,
): boolean {
  const scene = sprite.scene;
  if (!scene) return false;
  const ref = resolveTexture(scene, key);
  if (!ref) return false;
  if (ref.frame !== undefined) {
    return sprite.texture.key === ref.key && sprite.frame?.name === ref.frame;
  }
  return sprite.texture.key === ref.key;
}

/** `scene.add.sprite` for a logical key, resolving through the atlas. */
export function addSpriteForKey(
  scene: Phaser.Scene,
  x: number,
  y: number,
  key: string,
): Phaser.GameObjects.Sprite {
  const ref = resolveTexture(scene, key);
  return ref?.frame !== undefined
    ? scene.add.sprite(x, y, ref.key, ref.frame)
    : scene.add.sprite(x, y, ref?.key ?? key);
}

/** `scene.add.image` for a logical key, resolving through the atlas. */
export function addImageForKey(
  scene: Phaser.Scene,
  x: number,
  y: number,
  key: string,
): Phaser.GameObjects.Image {
  const ref = resolveTexture(scene, key);
  return ref?.frame !== undefined
    ? scene.add.image(x, y, ref.key, ref.frame)
    : scene.add.image(x, y, ref?.key ?? key);
}

/** Animation frame descriptor for `scene.anims.create({ frames })`. */
export function animFrameFor(
  scene: Phaser.Scene,
  key: string,
): Phaser.Types.Animations.AnimationFrame | null {
  const ref = resolveTexture(scene, key);
  if (!ref) return null;
  return ref.frame !== undefined
    ? { key: ref.key, frame: ref.frame }
    : { key: ref.key };
}

/**
 * Untrimmed frame size. Atlas frames are trimmed to their opaque bounds, so
 * `realWidth/realHeight` (not the source image size) is what preserves the
 * original on-screen proportions and origin placement.
 */
export function frameSourceSize(
  scene: Phaser.Scene,
  key: string,
): { width: number; height: number } | null {
  const ref = resolveTexture(scene, key);
  if (!ref) return null;
  const texture = scene.textures.get(ref.key);
  if (!texture) return null;
  const frame = ref.frame !== undefined ? texture.get(ref.frame) : texture.get();
  if (!frame) return null;
  return { width: frame.realWidth, height: frame.realHeight };
}

function registerAtlasFrames(scene: Phaser.Scene, id: PackId, atlasKey: string) {
  const texture = scene.textures.get(atlasKey);
  if (!texture) return;
  for (const frameName of texture.getFrameNames()) {
    frameToAtlas.set(frameName, atlasKey);
  }
  loadedAtlasByPack.set(id, atlasKey);
}

/**
 * Queue a pack onto the scene loader. Prefers the atlas; falls back to loose
 * PNGs when the atlas is unavailable so the game still runs before the packer
 * has been run.
 *
 * Returns the texture keys the pack owns (used for the loose-file unload path).
 */
export function queuePackLoad(
  scene: Phaser.Scene,
  id: PackId,
): { usedAtlas: boolean; keys: string[]; queued: number } {
  const atlasKey = atlasKeyForPack(id);

  if (scene.textures.exists(atlasKey)) {
    registerAtlasFrames(scene, id, atlasKey);
    return { usedAtlas: true, keys: [], queued: 0 };
  }

  if (!atlasUnavailable.has(id)) {
    // The third argument only tells Phaser where the atlas *page images* live.
    // The JSON itself resolves against loader.path, so that has to be set here:
    // boot queues packs before setPath("/assets"), which sent the request to
    // the site root and got index.html back, failing every atlas as bad JSON.
    const prevPath = scene.load.path;
    scene.load.setPath(ATLAS_BASE);
    scene.load.multiatlas(atlasKey, `${atlasKey}.json`, ATLAS_BASE);
    scene.load.setPath(prevPath);
    return { usedAtlas: true, keys: [], queued: 1 };
  }

  // Loose-PNG fallback. Phaser resolves each URL as it is queued, so the path
  // is restored afterwards rather than left pointing at /assets for whatever
  // gets queued next.
  const keys: string[] = [];
  let queued = 0;
  const prevPath = scene.load.path;
  scene.load.setPath("/assets");
  for (const entry of packEntries(id)) {
    keys.push(entry.key);
    if (scene.textures.exists(entry.key)) continue;
    scene.load.image(entry.key, entry.path);
    queued += 1;
  }
  scene.load.setPath(prevPath);
  return { usedAtlas: false, keys, queued };
}

/**
 * After an atlas loads, queue any pack entries the atlas does not contain.
 * New furniture added between atlas rebuilds would otherwise stay missing
 * (InteriorView then draws a brown placeholder).
 */
export function queueMissingPackImages(scene: Phaser.Scene, id: PackId): number {
  const prevPath = scene.load.path;
  scene.load.setPath("/assets");
  let queued = 0;
  for (const entry of packEntries(id)) {
    if (textureKeyExists(scene, entry.key)) continue;
    scene.load.image(entry.key, entry.path);
    queued += 1;
  }
  scene.load.setPath(prevPath);
  return queued;
}

/** Call after a load completes so atlas frames become resolvable. */
export function onPackLoaded(scene: Phaser.Scene, id: PackId) {
  const atlasKey = atlasKeyForPack(id);
  if (scene.textures.exists(atlasKey)) {
    registerAtlasFrames(scene, id, atlasKey);
  }
}

/**
 * Free a pack. Atlas packs drop 1-3 GPU textures instead of iterating
 * hundreds of keys, which is what made unload cheap enough to do eagerly.
 */
export function releasePackTextures(
  scene: Phaser.Scene,
  id: PackId,
  looseKeys: string[],
) {
  const atlasKey = loadedAtlasByPack.get(id);
  if (atlasKey) {
    if (scene.textures.exists(atlasKey)) {
      const texture = scene.textures.get(atlasKey);
      for (const frameName of texture.getFrameNames()) {
        if (frameToAtlas.get(frameName) === atlasKey) {
          frameToAtlas.delete(frameName);
          frameImageCache.delete(frameName);
        }
      }
      scene.textures.remove(atlasKey);
    }
    loadedAtlasByPack.delete(id);
    return;
  }
  for (const key of looseKeys) {
    if (scene.textures.exists(key)) scene.textures.remove(key);
  }
}

/** Extracted atlas frames, keyed by logical key. Cleared when the atlas goes. */
const frameImageCache = new Map<string, HTMLCanvasElement>();

/**
 * A whole-image source for a logical key, suitable for `drawImage(src, 0, 0)`
 * and `getImageData`.
 *
 * Standalone textures return their source image directly (no copy). Atlas
 * frames are extracted into a small canvas once and cached, so canvas-baking
 * code does not need sub-rect plumbing to stay correct under atlasing.
 */
export function resolveImageSource(
  scene: Phaser.Scene,
  key: string,
): { src: CanvasImageSource; width: number; height: number } | null {
  const ref = resolveTexture(scene, key);
  if (!ref) return null;

  if (ref.frame === undefined) {
    const src = scene.textures.get(ref.key).getSourceImage() as
      | HTMLImageElement
      | HTMLCanvasElement;
    if (!src || src.width <= 0 || src.height <= 0) return null;
    return { src, width: src.width, height: src.height };
  }

  const cached = frameImageCache.get(key);
  if (cached) return { src: cached, width: cached.width, height: cached.height };

  const frame = scene.textures.get(ref.key).get(ref.frame);
  if (!frame || frame.realWidth <= 0 || frame.realHeight <= 0) return null;

  // Draw the trimmed cut back into a full-size frame so callers see the same
  // dimensions and padding they would get from the original PNG.
  const canvas = document.createElement("canvas");
  canvas.width = frame.realWidth;
  canvas.height = frame.realHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(
    frame.source.image as CanvasImageSource,
    frame.cutX,
    frame.cutY,
    frame.cutWidth,
    frame.cutHeight,
    frame.x,
    frame.y,
    frame.cutWidth,
    frame.cutHeight,
  );
  frameImageCache.set(key, canvas);
  return { src: canvas, width: canvas.width, height: canvas.height };
}

/**
 * Note a failed atlas fetch so the pack retries as loose PNGs.
 *
 * Warn loudly: the fallback works, so a broken atlas path is invisible in
 * gameplay while quietly restoring the one-texture-per-PNG boot that discards
 * the tab on mobile. Silence here is what let exactly that ship unnoticed.
 */
export function markAtlasUnavailable(id: PackId) {
  if (!atlasUnavailable.has(id)) {
    console.warn(
      `[atlas] "${atlasKeyForPack(id)}" unavailable at ${ATLAS_BASE} — ` +
        `falling back to loose PNGs (run: npm run assets:atlas)`,
    );
  }
  atlasUnavailable.add(id);
}

export function isAtlasUnavailable(id: PackId): boolean {
  return atlasUnavailable.has(id);
}

/**
 * Re-sync registry state on world teardown (Phaser reuses the scene).
 *
 * Boot atlases stay resident across a rejoin, so this rebuilds the frame map
 * from textures that still exist rather than clearing it. Clearing outright
 * left every boot frame unresolvable on the second join.
 */
export function resetAtlasRegistry(scene?: Phaser.Scene) {
  frameToAtlas.clear();
  loadedAtlasByPack.clear();
  frameImageCache.clear();
  if (!scene?.textures) return;
  for (const key of scene.textures.getTextureKeys()) {
    if (!key.startsWith("atlas-")) continue;
    const id = key.slice("atlas-".length) as PackId;
    registerAtlasFrames(scene, id, key);
  }
}
