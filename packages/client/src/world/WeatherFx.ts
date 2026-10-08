import Phaser from "phaser";
import {
  lerpRgb,
  parsePrecip,
  parseSky,
  sunlightLevel,
  type PrecipId,
  type SkyId,
} from "@zombie/shared";
import { IS_MOBILE } from "../gameConfig";
import { DAYNIGHT_AMBIENT_DEPTH, DAYNIGHT_LIGHT_DEPTH } from "./DayNightLighting";

const RAIN_TEX_KEY = "weather-rain-streak";
const SNOW_TEX_KEY = "weather-snow-speck";
const FOG_BANK_TEX_KEY = "weather-fog-bank-h2";
const FOG_WISP_TEX_KEY = "weather-fog-wisp-h2";

const WEATHER_CLOUDY_DEPTH = DAYNIGHT_AMBIENT_DEPTH + 0.4;
const WEATHER_FOG_DEPTH = DAYNIGHT_AMBIENT_DEPTH + 0.5;
const WEATHER_FOG_BLOB_DEPTH = DAYNIGHT_AMBIENT_DEPTH + 0.6;
const WEATHER_RAIN_DEPTH = DAYNIGHT_LIGHT_DEPTH + 24;
const WEATHER_SNOW_DEPTH = DAYNIGHT_LIGHT_DEPTH + 25;
const WEATHER_LIGHTNING_DEPTH = DAYNIGHT_LIGHT_DEPTH + 40;

const CROSSFADE_MS = 2800;
/** First puddles start after a few seconds of rain. */
const RAIN_WET_START_MS = 4500;
/** Full puddle set after this much continuous rain. */
const RAIN_WET_FULL_MS = 6 * 60 * 1000;
const WET_IN_MS = 700;
const WET_OUT_MS = 4200;
const CLOUDY_MULTIPLY = 0xcccccc;
const FOG_MULTIPLY = 0x6e7884;
const MAX_FOG_BLOBS = IS_MOBILE ? 36 : 80;

type FogLayer = {
  texKey: string;
  tint: number;
  spacingX: number;
  spacingY: number;
  baseW: number;
  baseH: number;
  /** World pixels per second. */
  windX: number;
  windY: number;
  sizeMin: number;
  sizeMax: number;
  /** 0..1 chance a cell is empty (irregular banks, not a polka grid). */
  skip: number;
  alpha: number;
  rot: number;
};

const FOG_LAYERS: readonly FogLayer[] = [
  {
    texKey: FOG_BANK_TEX_KEY,
    tint: 0xb8c2cc,
    spacingX: 1180,
    spacingY: 760,
    baseW: 1680,
    baseH: 1020,
    windX: 18,
    windY: 7,
    sizeMin: 0.72,
    sizeMax: 1.85,
    skip: 0.16,
    alpha: 0.3,
    rot: 0.1,
  },
  {
    texKey: FOG_WISP_TEX_KEY,
    tint: 0xa8b2bc,
    spacingX: 700,
    spacingY: 460,
    baseW: 560,
    baseH: 340,
    windX: 34,
    windY: -12,
    sizeMin: 0.42,
    sizeMax: 1.35,
    skip: 0.28,
    alpha: 0.3,
    rot: 0.16,
  },
];
const RAIN_FREQUENCY = IS_MOBILE ? 42 : 18;
const RAIN_QUANTITY = IS_MOBILE ? 2 : 5;
const SNOW_FREQUENCY = IS_MOBILE ? 48 : 22;
const SNOW_QUANTITY = IS_MOBILE ? 5 : 11;

const LIGHTNING_FLASH_MS = 420;
/** Skip a flash/thunder if we join after it already passed. */
const LIGHTNING_CATCHUP_MS = 750;

export type WeatherAmounts = {
  cloudy: number;
  rain: number;
  fog: number;
  snow: number;
  /** Ground wetness 0..1. Rises the longer rain has been falling. */
  wetness: number;
};

function approach(current: number, target: number, dt: number, ms: number): number {
  if (ms <= 0) return target;
  const t = 1 - Math.exp(-dt / ms);
  return current + (target - current) * t;
}

function ensureRainTexture(scene: Phaser.Scene) {
  if (scene.textures.exists(RAIN_TEX_KEY)) return;
  const w = 10;
  const h = 22;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.strokeStyle = "rgba(210, 228, 242, 0.95)";
  ctx.lineWidth = 1.25;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(2, 1);
  ctx.lineTo(w - 2, h - 1);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(1.5, 2);
  ctx.lineTo(w - 3, h - 2);
  ctx.stroke();
  scene.textures.addCanvas(RAIN_TEX_KEY, canvas);
}

function ensureSnowTexture(scene: Phaser.Scene) {
  if (scene.textures.exists(SNOW_TEX_KEY)) return;
  const size = 5;
  const c = size / 2;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const g = ctx.createRadialGradient(c, c, 0, c, c, c);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.55, "rgba(245,250,255,0.75)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  scene.textures.addCanvas(SNOW_TEX_KEY, canvas);
}

/** Flat haze disc: plateau in the core, then a soft edge. No hot center. */
function ensureFogTexture(
  scene: Phaser.Scene,
  key: string,
  inner: number,
  coreAlpha: number,
) {
  if (scene.textures.exists(key)) return;
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const c = size / 2;
  const g = ctx.createRadialGradient(c, c, c * inner, c, c, c);
  g.addColorStop(0, `rgba(184, 194, 204, ${coreAlpha})`);
  g.addColorStop(0.5, `rgba(176, 186, 198, ${coreAlpha * 0.55})`);
  g.addColorStop(1, "rgba(168, 178, 188, 0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  scene.textures.addCanvas(key, canvas);
}

function layoutPrecipZone(
  zone: Phaser.Geom.Rectangle,
  view: Phaser.Geom.Rectangle,
) {
  const padX = Math.max(80, view.width * 0.08);
  const padY = Math.max(240, view.height * 0.2);
  zone.setTo(
    view.x - padX,
    view.y - padY,
    view.width + padX * 2 + view.height * 0.25,
    view.height + padY + 80,
  );
}

function precipAreaScale(view: Phaser.Geom.Rectangle): number {
  return Math.min(6, Math.max(1, (view.width * view.height) / (1600 * 900)));
}

function lightningFlashAlpha(ageMs: number, indoor: boolean): number {
  const peak = indoor ? 0.62 : 0.9;
  if (ageMs < 0) return 0;
  if (ageMs < 45) return peak;
  if (ageMs < 80) return peak * 0.12;
  if (ageMs < 170) return peak * 0.72;
  if (ageMs < LIGHTNING_FLASH_MS) {
    return peak * 0.2 * (1 - (ageMs - 170) / (LIGHTNING_FLASH_MS - 170));
  }
  return 0;
}

function fogCellJitter(cx: number, cy: number, salt: number): number {
  const n = Math.sin(cx * 127.1 + cy * 311.7 + salt * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

type FogBlob = {
  img: Phaser.GameObjects.Image;
};

type FogCell = {
  layer: number;
  cx: number;
  cy: number;
  dist: number;
};

/**
 * Outdoor weather pass: cloudy dim, rain streaks, snow flakes, isometric fog.
 * Overlays sit with the day/night multiply so lamps still punch through.
 * Precip particles cover the camera world view at any zoom.
 * Lightning flash/thunder times come from the room (same storm for every client).
 */
export class WeatherFx {
  cloudy = 0;
  rain = 0;
  fog = 0;
  snow = 0;
  wetness = 0;
  private rainSinceWorldMs: number | null = null;

  private cloudyOverlay: Phaser.GameObjects.Rectangle;
  private fogOverlay: Phaser.GameObjects.Rectangle;
  private fogBlobs: FogBlob[] = [];
  private fogCells: FogCell[] = [];
  private rainEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;
  private rainZone: Phaser.Geom.Rectangle;
  private snowEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;
  private snowZone: Phaser.Geom.Rectangle;
  private flashOverlay: Phaser.GameObjects.Rectangle;
  private flashAgeMs = -1;
  private flashIndoor = false;
  private lastWorldTimeMs = -1;
  private lastFlashAt = 0;
  private lastThunderAt = 0;
  private pendingThunder = false;

  constructor(private scene: Phaser.Scene) {
    ensureRainTexture(scene);
    ensureSnowTexture(scene);
    ensureFogTexture(scene, FOG_BANK_TEX_KEY, 0.2, 0.4);
    ensureFogTexture(scene, FOG_WISP_TEX_KEY, 0.38, 0.28);
    try {
      scene.cameras.main.postFX?.clear();
    } catch {
      /* canvas renderer / teardown */
    }

    this.cloudyOverlay = scene.add.rectangle(0, 0, 64, 64, 0xffffff, 1);
    this.cloudyOverlay.setOrigin(0, 0);
    this.cloudyOverlay.setDepth(WEATHER_CLOUDY_DEPTH);
    this.cloudyOverlay.setBlendMode(Phaser.BlendModes.MULTIPLY);
    this.cloudyOverlay.setVisible(false);

    this.fogOverlay = scene.add.rectangle(0, 0, 64, 64, 0xffffff, 1);
    this.fogOverlay.setOrigin(0, 0);
    this.fogOverlay.setDepth(WEATHER_FOG_DEPTH);
    this.fogOverlay.setBlendMode(Phaser.BlendModes.MULTIPLY);
    this.fogOverlay.setVisible(false);

    this.flashOverlay = scene.add.rectangle(0, 0, 64, 64, 0xf2f6ff, 1);
    this.flashOverlay.setOrigin(0, 0);
    this.flashOverlay.setDepth(WEATHER_LIGHTNING_DEPTH);
    this.flashOverlay.setAlpha(0);
    this.flashOverlay.setVisible(false);

    this.rainZone = new Phaser.Geom.Rectangle(0, 0, 64, 64);
    this.rainEmitter = scene.add.particles(0, 0, RAIN_TEX_KEY, {
      speedX: { min: 118, max: 172 },
      speedY: { min: 340, max: 510 },
      lifespan: { min: 1400, max: 2600 },
      quantity: RAIN_QUANTITY,
      frequency: RAIN_FREQUENCY,
      scaleX: { min: 0.55, max: 1.05 },
      scaleY: { min: 0.85, max: 1.5 },
      alpha: { start: 0.42, end: 0.04 },
      tint: 0xc8dcec,
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    });
    this.rainEmitter.addEmitZone({
      type: "random",
      source: this.rainZone as Phaser.Types.GameObjects.Particles.RandomZoneSource,
    });
    this.rainEmitter.setDepth(WEATHER_RAIN_DEPTH);

    this.snowZone = new Phaser.Geom.Rectangle(0, 0, 64, 64);
    this.snowEmitter = scene.add.particles(0, 0, SNOW_TEX_KEY, {
      speedX: { min: 16, max: 52 },
      speedY: { min: 32, max: 78 },
      gravityY: 14,
      lifespan: { min: 2800, max: 5200 },
      quantity: SNOW_QUANTITY,
      frequency: SNOW_FREQUENCY,
      scale: { min: 0.18, max: 0.42 },
      alpha: { start: 0.92, end: 0.1 },
      rotate: { min: -220, max: 220 },
      tint: [0xffffff, 0xeef4ff, 0xdeeaf6],
      emitting: false,
    });
    this.snowEmitter.addEmitZone({
      type: "random",
      source: this.snowZone as Phaser.Types.GameObjects.Particles.RandomZoneSource,
    });
    this.snowEmitter.setDepth(WEATHER_SNOW_DEPTH);
  }

  amounts(): WeatherAmounts {
    return {
      cloudy: this.cloudy,
      rain: this.rain,
      fog: this.fog,
      snow: this.snow,
      wetness: this.wetness,
    };
  }

  destroy() {
    this.cloudyOverlay.destroy();
    this.fogOverlay.destroy();
    this.flashOverlay.destroy();
    for (const blob of this.fogBlobs) blob.img.destroy();
    this.fogBlobs.length = 0;
    this.rainEmitter?.destroy();
    this.rainEmitter = undefined;
    this.snowEmitter?.destroy();
    this.snowEmitter = undefined;
  }

  update(
    dt: number,
    indoor: boolean,
    skyRaw: unknown,
    precipRaw: unknown,
    worldTimeMs: number,
    lightningFlashAt: number,
    lightningThunderAt: number,
    alwaysLit = false,
    underground = false,
  ) {
    const sky: SkyId = parseSky(skyRaw);
    const precip: PrecipId = parsePrecip(precipRaw);
    const outdoor = !indoor;
    const sunlight = sunlightLevel(worldTimeMs);
    const targetCloudy =
      sky === "cloudy"
        ? indoor
          ? alwaysLit || underground
            ? 0
            : sunlight
          : 1
        : 0;
    const targetRain = outdoor && precip === "rain" ? 1 : 0;
    const targetFog = outdoor && precip === "fog" ? 1 : 0;
    const targetSnow = outdoor && precip === "snow" ? 1 : 0;

    this.cloudy = approach(this.cloudy, targetCloudy, dt, CROSSFADE_MS);
    if (indoor) {
      this.rain = 0;
      this.fog = 0;
      this.snow = 0;
    } else {
      this.rain = approach(this.rain, targetRain, dt, CROSSFADE_MS);
      this.fog = approach(this.fog, targetFog, dt, CROSSFADE_MS);
      this.snow = approach(this.snow, targetSnow, dt, CROSSFADE_MS);
    }
    this.tickWetness(dt, precip, worldTimeMs);

    this.layoutOverlays();
    this.applyCloudy();
    this.applyFog();
    this.applyRain();
    this.applySnow();
    this.tickLightning(
      dt,
      indoor,
      worldTimeMs,
      lightningFlashAt,
      lightningThunderAt,
    );
  }

  /** True once when the delayed thunder for the last flash should play. */
  consumeThunder(): boolean {
    if (!this.pendingThunder) return false;
    this.pendingThunder = false;
    return true;
  }

  private layoutOverlays() {
    const view = this.scene.cameras.main.worldView;
    const pad = 96;
    const x = view.x - pad;
    const y = view.y - pad;
    const w = view.width + pad * 2;
    const h = view.height + pad * 2;
    this.cloudyOverlay.setPosition(x, y);
    this.cloudyOverlay.setSize(w, h);
    this.fogOverlay.setPosition(x, y);
    this.fogOverlay.setSize(w, h);
    this.flashOverlay.setPosition(x, y);
    this.flashOverlay.setSize(w, h);
  }

  private tickLightning(
    dt: number,
    indoor: boolean,
    worldTimeMs: number,
    flashAt: number,
    thunderAt: number,
  ) {
    const prevWorld = this.lastWorldTimeMs;

    if (flashAt > 0 && flashAt !== this.lastFlashAt && worldTimeMs >= flashAt) {
      const crossed = prevWorld >= 0 && prevWorld < flashAt;
      const recent = worldTimeMs - flashAt <= LIGHTNING_CATCHUP_MS;
      this.lastFlashAt = flashAt;
      if (crossed || recent) {
        this.flashAgeMs = 0;
        this.flashIndoor = indoor;
      }
    }
    if (
      thunderAt > 0 &&
      thunderAt !== this.lastThunderAt &&
      worldTimeMs >= thunderAt
    ) {
      const crossed = prevWorld >= 0 && prevWorld < thunderAt;
      const recent = worldTimeMs - thunderAt <= LIGHTNING_CATCHUP_MS;
      this.lastThunderAt = thunderAt;
      if (crossed || recent) {
        this.pendingThunder = true;
      }
    }
    this.lastWorldTimeMs = worldTimeMs;

    if (this.flashAgeMs >= 0) {
      this.flashAgeMs += dt;
      const alpha = lightningFlashAlpha(this.flashAgeMs, this.flashIndoor);
      this.flashOverlay.setVisible(alpha > 0.01);
      this.flashOverlay.setAlpha(alpha);
      if (this.flashAgeMs >= LIGHTNING_FLASH_MS) this.flashAgeMs = -1;
    } else {
      this.flashOverlay.setVisible(false);
      this.flashOverlay.setAlpha(0);
    }
  }

  private applyCloudy() {
    const on = this.cloudy > 0.02;
    this.cloudyOverlay.setVisible(on);
    if (!on) {
      this.cloudyOverlay.setAlpha(0);
      return;
    }
    const color = lerpRgb(0xffffff, CLOUDY_MULTIPLY, this.cloudy);
    this.cloudyOverlay.setFillStyle(color, 1);
    this.cloudyOverlay.setAlpha(1);
  }

  private ensureFogBlob(): FogBlob {
    const img = this.scene.add.image(0, 0, FOG_BANK_TEX_KEY);
    img.setDepth(WEATHER_FOG_BLOB_DEPTH);
    img.setBlendMode(Phaser.BlendModes.NORMAL);
    img.setTint(FOG_LAYERS[0]!.tint);
    img.setScrollFactor(1);
    img.setVisible(false);
    const blob: FogBlob = { img };
    this.fogBlobs.push(blob);
    return blob;
  }

  private applyFog() {
    const on = this.fog > 0.02;
    this.fogOverlay.setVisible(on);
    if (!on) {
      this.fogOverlay.setAlpha(0);
      for (const blob of this.fogBlobs) blob.img.setVisible(false);
      return;
    }

    const color = lerpRgb(0xffffff, FOG_MULTIPLY, this.fog);
    this.fogOverlay.setFillStyle(color, 1);
    this.fogOverlay.setAlpha(1);

    const view = this.scene.cameras.main.worldView;
    const now = this.scene.time.now * 0.001;
    const midX = view.centerX;
    const midY = view.centerY;
    const cells = this.fogCells;
    let cellCount = 0;

    for (let li = 0; li < FOG_LAYERS.length; li++) {
      const layer = FOG_LAYERS[li]!;
      const windX = now * layer.windX;
      const windY = now * layer.windY;
      const padX = layer.baseW * layer.sizeMax * 0.55;
      const padY = layer.baseH * layer.sizeMax * 0.55;
      const minCX = Math.floor((view.x - padX - windX) / layer.spacingX);
      const maxCX = Math.floor((view.right + padX - windX) / layer.spacingX);
      const minCY = Math.floor((view.y - padY - windY) / layer.spacingY);
      const maxCY = Math.floor((view.bottom + padY - windY) / layer.spacingY);
      const salt = li * 17;
      for (let cy = minCY; cy <= maxCY; cy++) {
        for (let cx = minCX; cx <= maxCX; cx++) {
          if (fogCellJitter(cx, cy, salt + 9) < layer.skip) continue;
          const jx = (fogCellJitter(cx, cy, salt + 1) - 0.5) * layer.spacingX * 0.5;
          const jy = (fogCellJitter(cx, cy, salt + 2) - 0.5) * layer.spacingY * 0.5;
          const phase = fogCellJitter(cx, cy, salt + 3) * Math.PI * 2;
          const wx = cx * layer.spacingX + jx + windX + Math.sin(now * 0.13 + phase) * 70;
          const wy = cy * layer.spacingY + jy + windY + Math.cos(now * 0.09 + phase) * 42;
          const dx = wx - midX;
          const dy = wy - midY;
          const cell =
            cells[cellCount] ??
            (cells[cellCount] = { layer: 0, cx: 0, cy: 0, dist: 0 });
          cell.layer = li;
          cell.cx = cx;
          cell.cy = cy;
          cell.dist = dx * dx + dy * dy;
          cellCount += 1;
        }
      }
    }

    cells.length = cellCount;
    cells.sort((a, b) => a.layer - b.layer || a.dist - b.dist);

    const used = Math.min(cellCount, MAX_FOG_BLOBS);
    for (let i = 0; i < used; i++) {
      const cell = cells[i]!;
      const layer = FOG_LAYERS[cell.layer]!;
      const cx = cell.cx;
      const cy = cell.cy;
      const salt = cell.layer * 17;
      const blob = this.fogBlobs[i] ?? this.ensureFogBlob();
      const jx = (fogCellJitter(cx, cy, salt + 1) - 0.5) * layer.spacingX * 0.5;
      const jy = (fogCellJitter(cx, cy, salt + 2) - 0.5) * layer.spacingY * 0.5;
      const phase = fogCellJitter(cx, cy, salt + 3) * Math.PI * 2;
      const sizeU = fogCellJitter(cx, cy, salt + 4);
      const sizeMul =
        layer.sizeMin + (layer.sizeMax - layer.sizeMin) * (0.18 + 0.82 * sizeU);
      const aspect =
        layer.baseH / layer.baseW +
        (fogCellJitter(cx, cy, salt + 5) - 0.5) * 0.16;
      const w = layer.baseW * sizeMul;
      blob.img.setVisible(true);
      blob.img.setTexture(layer.texKey);
      blob.img.setTint(layer.tint);
      blob.img.setPosition(
        cx * layer.spacingX +
          jx +
          now * layer.windX +
          Math.sin(now * 0.13 + phase) * 70,
        cy * layer.spacingY +
          jy +
          now * layer.windY +
          Math.cos(now * 0.09 + phase) * 42,
      );
      blob.img.setDisplaySize(w, w * aspect);
      blob.img.setAlpha(layer.alpha + 0.12 * this.fog);
      blob.img.setRotation(
        layer.rot +
          (fogCellJitter(cx, cy, salt + 6) - 0.5) * 0.22 +
          Math.sin(now * 0.06 + phase) * 0.05,
      );
    }
    for (let i = used; i < this.fogBlobs.length; i++) {
      this.fogBlobs[i]!.img.setVisible(false);
    }
  }

  private tickWetness(dt: number, precip: PrecipId, worldTimeMs: number) {
    if (precip === "rain") {
      if (this.rainSinceWorldMs == null) this.rainSinceWorldMs = worldTimeMs;
      const elapsed = Math.max(0, worldTimeMs - this.rainSinceWorldMs);
      const t = Math.max(
        0,
        Math.min(
          1,
          (elapsed - RAIN_WET_START_MS) / (RAIN_WET_FULL_MS - RAIN_WET_START_MS),
        ),
      );
      // Ease-out: a few puddles show early, the rest fill in over the storm.
      const target = 1 - (1 - t) * (1 - t);
      this.wetness = approach(this.wetness, target, dt, WET_IN_MS);
      return;
    }
    this.rainSinceWorldMs = null;
    this.wetness = approach(this.wetness, 0, dt, WET_OUT_MS);
    if (this.wetness < 0.004) this.wetness = 0;
  }

  private applyRain() {
    const emitter = this.rainEmitter;
    if (!emitter) return;
    const on = this.rain > 0.04;
    emitter.setVisible(this.rain > 0.02);
    emitter.setAlpha(this.rain);
    if (!on) {
      if (emitter.emitting) emitter.stop();
      if (this.rain < 0.015) emitter.killAll();
      return;
    }
    const view = this.scene.cameras.main.worldView;
    layoutPrecipZone(this.rainZone, view);
    if (!emitter.emitting) emitter.start();
    const areaScale = precipAreaScale(view);
    emitter.quantity = Math.max(1, Math.round(RAIN_QUANTITY * areaScale));
    emitter.frequency = RAIN_FREQUENCY / Math.max(0.25, this.rain);
  }

  private applySnow() {
    const emitter = this.snowEmitter;
    if (!emitter) return;
    const on = this.snow > 0.04;
    emitter.setVisible(this.snow > 0.02);
    emitter.setAlpha(this.snow);
    if (!on) {
      if (emitter.emitting) emitter.stop();
      if (this.snow < 0.015) emitter.killAll();
      return;
    }
    const view = this.scene.cameras.main.worldView;
    layoutPrecipZone(this.snowZone, view);
    if (!emitter.emitting) emitter.start();
    const areaScale = precipAreaScale(view);
    emitter.quantity = Math.max(1, Math.round(SNOW_QUANTITY * areaScale));
    emitter.frequency = SNOW_FREQUENCY / Math.max(0.25, this.snow);
  }
}
