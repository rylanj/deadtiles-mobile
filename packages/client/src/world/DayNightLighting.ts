import Phaser from "phaser";
import {
  dayNightLook,
  getBuildingsNearTile,
  isoToCartesian,
  TILE_HEIGHT,
  type DayNightLook,
} from "@zombie/shared";
import { IS_MOBILE } from "../gameConfig";
import { fillBuildingOuterBoundary } from "./IsoTiles";

const LIGHT_TEX_KEY = "daynight-light";
const FIRE_TEX_KEY = "daynight-fire-fill";
const VIGNETTE_TEX_KEY = "daynight-vignette";

/** Above cuboids / entities, below Phaser action labels (9.9e6). */
export const DAYNIGHT_AMBIENT_DEPTH = 3_500_000;
const DAYNIGHT_VIGNETTE_DEPTH = 3_500_001;
export const DAYNIGHT_LIGHT_DEPTH = 3_500_002;

const MAX_LIGHTS = IS_MOBILE ? 18 : 48;
const FIRELIT_FADE_MS = 380;

export type NightLight = {
  x: number;
  y: number;
  radius: number;
  color: number;
  /** 0..1 extra dimmer on top of look.lampStrength. */
  strength?: number;
  /** Streetlamps stay round and steady. Fire gets an oval blob + flicker. */
  kind?: "lamp" | "fire";
  /** Phase offset so two fires do not pulse in lockstep. */
  seed?: number;
  /** Foot tile of an overworld campfire, used to find nearby building clips. */
  tileX?: number;
  tileY?: number;
};

function ensureRadialTexture(
  scene: Phaser.Scene,
  key: string,
  size: number,
  inner: number,
  outer: number,
  invert: boolean,
) {
  if (scene.textures.exists(key)) return;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const g = ctx.createRadialGradient(
    size / 2,
    size / 2,
    inner * size,
    size / 2,
    size / 2,
    outer * size,
  );
  if (invert) {
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.42, "rgba(170,170,170,1)");
    g.addColorStop(1, "rgba(0,0,0,1)");
  } else {
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.35, "rgba(255,255,255,0.55)");
    g.addColorStop(1, "rgba(255,255,255,0)");
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  scene.textures.addCanvas(key, canvas);
}

/** Soft ellipse of white. Overlap a few to break the perfect circle. */
function fillEllipseBlob(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  alpha: number,
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, `rgba(255,255,255,${alpha})`);
  g.addColorStop(0.32, `rgba(255,255,255,${alpha * 0.5})`);
  g.addColorStop(0.68, `rgba(255,255,255,${alpha * 0.14})`);
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function ensureFireLightTexture(scene: Phaser.Scene) {
  if (scene.textures.exists(FIRE_TEX_KEY)) return;
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  // Floor puddle: wide oval plus two offset lobes so the edge is uneven.
  fillEllipseBlob(ctx, 128, 138, 118, 78, 0.95);
  fillEllipseBlob(ctx, 98, 128, 72, 52, 0.42);
  fillEllipseBlob(ctx, 158, 122, 64, 46, 0.36);
  fillEllipseBlob(ctx, 126, 112, 40, 34, 0.55);
  scene.textures.addCanvas(FIRE_TEX_KEY, canvas);
}

/** Layered sines: mostly 0.76–1.02 with a small irregular dip. */
function fireFlicker(nowMs: number, seed: number): number {
  const t = nowMs * 0.001;
  const a = Math.sin(t * 6.4 + seed);
  const b = Math.sin(t * 11.7 + seed * 1.8);
  const c = Math.sin(t * 19.3 + seed * 0.6);
  const d = Math.sin(t * 31.1 + seed * 2.3);
  return 0.82 + 0.10 * a + 0.06 * b + 0.04 * c + 0.03 * d;
}

function fireClipTile(src: NightLight): { x: number; y: number } {
  if (Number.isFinite(src.tileX) && Number.isFinite(src.tileY)) {
    return { x: src.tileX!, y: src.tileY! };
  }
  const cart = isoToCartesian(src.x, src.y);
  return { x: Math.floor(cart.x), y: Math.floor(cart.y) };
}

/**
 * Sky, multiply darkness, night vignette, and additive lamp pools.
 * Driven by the authoritative world clock.
 */
export class DayNightLighting {
  private ambient: Phaser.GameObjects.Rectangle;
  private vignette: Phaser.GameObjects.Image;
  private lights: Phaser.GameObjects.Image[] = [];
  private lastSky = -1;
  private firelitAmount = 0;
  /** World-space stencil of enterable-building exteriors. Inverted on fire lights. */
  private fireClipGraphics: Phaser.GameObjects.Graphics;
  private fireClipMask: Phaser.Display.Masks.GeometryMask;

  constructor(private scene: Phaser.Scene) {
    ensureRadialTexture(scene, LIGHT_TEX_KEY, 256, 0, 0.5, false);
    ensureFireLightTexture(scene);
    ensureRadialTexture(scene, VIGNETTE_TEX_KEY, 256, 0, 0.5, true);

    this.ambient = scene.add.rectangle(0, 0, 64, 64, 0x0c1424, 0);
    this.ambient.setOrigin(0, 0);
    this.ambient.setDepth(DAYNIGHT_AMBIENT_DEPTH);
    this.ambient.setBlendMode(Phaser.BlendModes.MULTIPLY);
    this.ambient.setVisible(false);

    this.vignette = scene.add.image(0, 0, VIGNETTE_TEX_KEY);
    this.vignette.setDepth(DAYNIGHT_VIGNETTE_DEPTH);
    this.vignette.setBlendMode(Phaser.BlendModes.MULTIPLY);
    this.vignette.setVisible(false);

    this.fireClipGraphics = scene.make.graphics({ x: 0, y: 0 }, false);
    this.fireClipMask = this.fireClipGraphics.createGeometryMask();
    this.fireClipMask.setInvertAlpha(true);
  }

  destroy() {
    this.ambient.destroy();
    this.vignette.destroy();
    for (const img of this.lights) img.destroy();
    this.lights.length = 0;
    this.fireClipGraphics.destroy();
  }

  update(
    worldTimeMs: number,
    indoor: boolean,
    lights: readonly NightLight[],
    opts?: {
      alwaysLit?: boolean;
      underground?: boolean;
      firelit?: boolean;
      dtMs?: number;
      cloudyAmount?: number;
      fogAmount?: number;
      rainAmount?: number;
      snowAmount?: number;
    },
  ) {
    const target = indoor && !opts?.alwaysLit && opts?.firelit ? 1 : 0;
    const step = Math.max(0, opts?.dtMs ?? 16) / FIRELIT_FADE_MS;
    if (this.firelitAmount < target) {
      this.firelitAmount = Math.min(target, this.firelitAmount + step);
    } else if (this.firelitAmount > target) {
      this.firelitAmount = Math.max(target, this.firelitAmount - step);
    }
    const look = dayNightLook(worldTimeMs, {
      indoor,
      alwaysLit: opts?.alwaysLit,
      underground: opts?.underground,
      firelitAmount: this.firelitAmount,
      cloudyAmount: opts?.cloudyAmount,
      fogAmount: opts?.fogAmount,
      rainAmount: opts?.rainAmount,
      snowAmount: opts?.snowAmount,
    });
    this.applySky(look);
    this.applyAmbient(look);
    this.applyVignette(look);
    this.applyLights(look, lights, indoor);
  }

  private applySky(look: DayNightLook) {
    if (look.skyColor === this.lastSky) return;
    this.lastSky = look.skyColor;
    this.scene.cameras.main.setBackgroundColor(look.skyColor);
  }

  private applyAmbient(look: DayNightLook) {
    const view = this.scene.cameras.main.worldView;
    const pad = 96;
    this.ambient.setPosition(view.x - pad, view.y - pad);
    this.ambient.setSize(view.width + pad * 2, view.height + pad * 2);
    // Phaser Rectangle uses fillColor + fillAlpha; MULTIPLY needs a non-white fill.
    this.ambient.setFillStyle(look.ambientColor, 1);
    const on = look.ambientAlpha > 0.02;
    this.ambient.setVisible(on);
    this.ambient.setAlpha(on ? look.ambientAlpha : 0);
  }

  private applyVignette(look: DayNightLook) {
    const view = this.scene.cameras.main.worldView;
    this.vignette.setPosition(view.centerX, view.centerY);
    this.vignette.setDisplaySize(view.width * 1.2, view.height * 1.2);
    const on = look.vignetteAlpha > 0.04;
    this.vignette.setVisible(on);
    this.vignette.setAlpha(on ? look.vignetteAlpha : 0);
  }

  private applyLights(
    look: DayNightLook,
    sources: readonly NightLight[],
    indoor: boolean,
  ) {
    const lamp = look.lampStrength;
    const fire = look.fireStrength;
    if (lamp < 0.04 && fire < 0.04) {
      for (const img of this.lights) {
        img.clearMask(false);
        img.setVisible(false);
      }
      return;
    }

    const view = this.scene.cameras.main.worldView;
    const pad = 280;
    const minX = view.x - pad;
    const maxX = view.right + pad;
    const minY = view.y - pad;
    const maxY = view.bottom + pad;
    const now = this.scene.time.now;
    const clipFire = !indoor && fire >= 0.04;
    const hasClip = clipFire && this.refreshFireBuildingClip(sources);

    let used = 0;
    for (const src of sources) {
      if (used >= MAX_LIGHTS) break;
      if (src.x < minX || src.x > maxX || src.y < minY || src.y > maxY) {
        continue;
      }
      const isFire = src.kind === "fire";
      const base = isFire ? fire : lamp;
      if (base < 0.04) continue;
      const img = this.ensureLight(used);
      used += 1;
      const strength = base * (src.strength ?? 1);
      img.setTexture(isFire ? FIRE_TEX_KEY : LIGHT_TEX_KEY);
      img.setTint(src.color);
      img.setVisible(true);
      if (isFire && hasClip) img.setMask(this.fireClipMask);
      else img.clearMask(false);
      if (isFire) {
        const seed = src.seed ?? used;
        const flick = fireFlicker(now, seed);
        const radius = src.radius * (0.9 + 0.12 * flick);
        img.setPosition(
          src.x + 2.6 * Math.sin(now * 0.007 + seed),
          src.y + 1.8 * Math.sin(now * 0.01 + seed * 1.4),
        );
        img.setDisplaySize(radius * 4, radius * 4);
        img.setRotation(0.09 * Math.sin(now * 0.0045 + seed));
        img.setAlpha(0.75 * strength * flick);
      } else {
        img.setPosition(src.x, src.y);
        img.setDisplaySize(src.radius * 2, src.radius * 2);
        img.setRotation(0);
        img.setAlpha(0.55 * strength);
      }
    }
    for (let i = used; i < this.lights.length; i++) {
      this.lights[i]!.clearMask(false);
      this.lights[i]!.setVisible(false);
    }
  }

  /**
   * Rebuild the inverted stencil of nearby enterable-building exteriors.
   * Returns false when nothing overlaps, so fire lights can draw unmasked.
   */
  private refreshFireBuildingClip(sources: readonly NightLight[]): boolean {
    this.fireClipGraphics.clear();
    const seen = new Set<string>();
    let any = false;
    for (const src of sources) {
      if (src.kind !== "fire") continue;
      const tile = fireClipTile(src);
      const reach = Math.max(
        8,
        Math.ceil((src.radius * 2) / TILE_HEIGHT) + 2,
      );
      for (const bld of getBuildingsNearTile(tile.x, tile.y, reach)) {
        const key = `${bld.ox},${bld.oy}`;
        if (seen.has(key)) continue;
        seen.add(key);
        fillBuildingOuterBoundary(this.fireClipGraphics, bld);
        any = true;
      }
    }
    return any;
  }

  private ensureLight(index: number): Phaser.GameObjects.Image {
    const existing = this.lights[index];
    if (existing) return existing;
    const img = this.scene.add.image(0, 0, LIGHT_TEX_KEY);
    img.setDepth(DAYNIGHT_LIGHT_DEPTH);
    img.setBlendMode(Phaser.BlendModes.ADD);
    img.setVisible(false);
    this.lights[index] = img;
    return img;
  }
}
