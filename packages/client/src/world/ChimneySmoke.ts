import Phaser from "phaser";
import {
  HOUSE_CHIMNEY_HEIGHT,
  HOUSE_ROOF_PEAK_HEIGHT,
  buildingWallScreenDepth,
  cartesianToIso,
  fireplaceIsActive,
  getBuildingAt,
  isoToCartesian,
  type BuildingInfo,
} from "@zombie/shared";
import { BUILDING_LOD_NEAR_TILES, IS_MOBILE } from "../gameConfig";
import { buildingWallDepth } from "./depthSort";

const TEX_KEY = "chimney-smoke-puff";
const TEX_SIZE = 32;
/** Shared sprites for every visible chimney. Extra houses wait for a free puff. */
const POOL = IS_MOBILE ? 24 : 40;
const MAX_SPAWN_PER_FRAME = IS_MOBILE ? 2 : 4;
/** Past this, the house is a far cuboid and the chimney stack is not drawn. */
const SMOKE_TILE_REACH = BUILDING_LOD_NEAR_TILES + 2;

/** Mid greys. The puff texture is a light mask, so these set the smoke color. */
const TINTS = [0xb0aaa3, 0x8e8982, 0x6f6b64];
/** Width relative to the rising scale, so the column stays narrow. */
const PUFF_WIDTH = 0.72;

type SmokePuff = {
  img: Phaser.GameObjects.Image;
  active: boolean;
  age: number;
  maxLife: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  phase: number;
  peak: number;
};

type ChimneySource = {
  ox: number;
  oy: number;
  w: number;
  h: number;
  chimneyX: number;
  chimneyY: number;
  activeUntil: number;
  emitX: number;
  emitY: number;
  depth: number;
  depthAt: number;
  nextEmit: number;
};

/**
 * A few soft puffs rising from lit house chimneys.
 * One shared pool, only for chimneys inside the camera, no particle emitters.
 * Flue position matches the baked stack in drawHouseChimney.
 */
export class ChimneySmoke {
  private readonly puffs: SmokePuff[] = [];
  private readonly free: SmokePuff[] = [];
  private readonly sources = new Map<string, ChimneySource>();
  private hidden = false;
  private lastVisible = 0;

  constructor(private scene: Phaser.Scene) {
    ensureSmokeTexture(scene);
    if (!scene.textures.exists(TEX_KEY)) return;
    for (let i = 0; i < POOL; i++) {
      const img = scene.add.image(0, 0, TEX_KEY);
      img.setOrigin(0.5, 0.55);
      img.setVisible(false);
      img.setBlendMode(Phaser.BlendModes.NORMAL);
      const puff: SmokePuff = {
        img,
        active: false,
        age: 0,
        maxLife: 1,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        phase: 0,
        peak: 0.4,
      };
      this.puffs.push(puff);
      this.free.push(puff);
    }
  }

  /** Replace the set of burning houses. Used when a client finishes loading. */
  sync(
    fires: { buildingX: number; buildingY: number; activeUntil: number }[],
  ) {
    const keep = new Set<string>();
    for (const fire of fires) {
      const key = `${fire.buildingX},${fire.buildingY}`;
      keep.add(key);
      this.setMantel(fire.buildingX, fire.buildingY, fire.activeUntil);
    }
    for (const key of this.sources.keys()) {
      if (!keep.has(key)) this.sources.delete(key);
    }
  }

  setMantel(buildingX: number, buildingY: number, activeUntil: number) {
    const key = `${buildingX},${buildingY}`;
    if (!fireplaceIsActive(activeUntil)) {
      this.sources.delete(key);
      return;
    }
    const existing = this.sources.get(key);
    if (existing) {
      existing.activeUntil = activeUntil;
      return;
    }
    const bld = getBuildingAt(buildingX, buildingY);
    if (
      !bld ||
      bld.ox !== buildingX ||
      bld.oy !== buildingY ||
      bld.buildingType !== "house" ||
      bld.chimneyX == null ||
      bld.chimneyY == null
    ) {
      return;
    }
    const flue = chimneyFluePoint(bld);
    if (!flue) return;
    const now = performance.now();
    this.sources.set(key, {
      ox: bld.ox,
      oy: bld.oy,
      w: bld.w,
      h: bld.h,
      chimneyX: bld.chimneyX,
      chimneyY: bld.chimneyY,
      activeUntil,
      emitX: flue.x,
      emitY: flue.y,
      depth: buildingWallDepth(bld) + 0.2,
      depthAt: now,
      nextEmit: now - Math.random() * 400,
    });
  }

  update(dtMs: number, indoor: boolean) {
    if (this.puffs.length === 0) return;
    if (indoor) {
      if (!this.hidden) {
        this.hidden = true;
        for (const puff of this.puffs) this.retire(puff);
      }
      return;
    }
    this.hidden = false;

    const nowMs = Date.now();
    for (const [key, src] of this.sources) {
      if (!fireplaceIsActive(src.activeUntil, nowMs)) this.sources.delete(key);
    }
    if (this.sources.size === 0 && this.free.length === this.puffs.length) return;

    const dt = Math.min(0.05, Math.max(0, dtMs) / 1000);
    const now = performance.now();
    const cam = this.scene.cameras.main;
    const view = cam.worldView;
    const left = view.x - 48;
    const right = view.right + 48;
    const top = view.y - 110;
    const bottom = view.bottom + 32;
    const focus = isoToCartesian(cam.midPoint.x, cam.midPoint.y);
    const wind = Math.sin(now / 5200) * 8;
    const gap = emitGapMs(this.lastVisible);

    let visible = 0;
    let spawned = 0;
    for (const src of this.sources.values()) {
      if (
        Math.max(
          Math.abs(src.chimneyX - focus.x),
          Math.abs(src.chimneyY - focus.y),
        ) > SMOKE_TILE_REACH
      ) {
        continue;
      }
      if (
        src.emitX < left ||
        src.emitX > right ||
        src.emitY < top ||
        src.emitY > bottom
      ) {
        continue;
      }
      visible++;
      if (now - src.depthAt > 800) {
        src.depth = buildingWallDepth(src) + 0.2;
        src.depthAt = now;
      }
      if (now < src.nextEmit || spawned >= MAX_SPAWN_PER_FRAME) continue;
      src.nextEmit = now + gap;
      if (this.spawn(src)) spawned++;
    }
    this.lastVisible = visible;

    for (const puff of this.puffs) {
      if (!puff.active) continue;
      puff.age += dt;
      const t = puff.age / puff.maxLife;
      if (t >= 1 || puff.y < top - 40) {
        this.retire(puff);
        continue;
      }
      puff.x += (puff.vx + wind) * dt;
      puff.y += puff.vy * dt;
      puff.vy += (-12 - puff.vy) * Math.min(1, dt * 0.7);
      const fadeIn = t < 0.08 ? t / 0.08 : 1;
      const fadeOut = t > 0.68 ? (1 - t) / 0.32 : 1;
      const scale = 0.46 + 1.7 * Math.pow(t, 0.55);
      const wobble = Math.sin(now / 420 + puff.phase) * (1 + 4.5 * t);
      puff.img.setPosition(puff.x + wobble, puff.y);
      puff.img.setScale(scale * PUFF_WIDTH, scale * 1.28);
      puff.img.setAlpha(fadeIn * fadeOut * puff.peak);
      puff.img.rotation = Math.sin(puff.phase + puff.age * 0.7) * 0.3;
    }
  }

  destroy() {
    for (const puff of this.puffs) puff.img.destroy();
    this.puffs.length = 0;
    this.free.length = 0;
    this.sources.clear();
  }

  private spawn(src: ChimneySource): boolean {
    const puff = this.free.pop();
    if (!puff) return false;
    puff.active = true;
    puff.age = 0;
    puff.maxLife = 2.15 + Math.random() * 0.85;
    puff.x = src.emitX + (Math.random() - 0.5) * 1.4;
    puff.y = src.emitY;
    puff.vx = (Math.random() - 0.5) * 3;
    puff.vy = -32 - Math.random() * 14;
    puff.phase = Math.random() * Math.PI * 2;
    puff.peak = 0.72 + Math.random() * 0.22;
    puff.img.setTint(TINTS[(Math.random() * TINTS.length) | 0]!);
    puff.img.setDepth(src.depth);
    puff.img.setAlpha(0);
    puff.img.setScale(0.46 * PUFF_WIDTH, 0.46 * 1.28);
    puff.img.setPosition(puff.x, puff.y);
    puff.img.setVisible(true);
    return true;
  }

  private retire(puff: SmokePuff) {
    if (!puff.active) return;
    puff.active = false;
    puff.img.setVisible(false);
    this.free.push(puff);
  }
}

function emitGapMs(visible: number): number {
  const base = visible <= 3 ? 260 : visible <= 7 ? 420 : 640;
  return IS_MOBILE ? Math.round(base * 1.3) : base;
}

/** Center of the chimney cap, in the same iso space as the baked building. */
function chimneyFluePoint(bld: BuildingInfo): { x: number; y: number } | null {
  if (bld.chimneyX == null || bld.chimneyY == null) return null;
  const { ox, oy, w, h } = bld;
  const lx = bld.chimneyX - ox;
  const ly = bld.chimneyY - oy;
  if (lx < 0 || ly < 0 || lx >= w || ly >= h || w <= 0 || h <= 0) return null;

  const padU = 0.22 / w;
  const padV = 0.22 / h;
  const u0 = lx / w + padU;
  const v0 = ly / h + padV;
  const u1 = (lx + 1) / w - padU;
  const v1 = (ly + 1) / h - padV;
  if (u1 <= u0 || v1 <= v0) return null;
  const u = (u0 + u1) / 2;
  const v = (v0 + v1) / 2;
  const depth = buildingWallScreenDepth(bld);
  const nw = cartesianToIso(ox, oy);
  const ne = cartesianToIso(ox + w, oy);
  const se = cartesianToIso(ox + w, oy + h);
  const sw = cartesianToIso(ox, oy + h);
  const nx = nw.x + (ne.x - nw.x) * u;
  const ny = nw.y - depth + (ne.y - nw.y) * u;
  const sx = sw.x + (se.x - sw.x) * u;
  const sy = sw.y - depth + (se.y - sw.y) * u;
  const deckY = ny + (sy - ny) * v;
  const deckX = nx + (sx - nx) * v;
  const stackH = HOUSE_ROOF_PEAK_HEIGHT + HOUSE_CHIMNEY_HEIGHT;
  const capH = Math.max(2, Math.round(HOUSE_CHIMNEY_HEIGHT * 0.22));
  return { x: deckX, y: deckY - stackH - capH };
}

function ensureSmokeTexture(scene: Phaser.Scene) {
  if (scene.textures.exists(TEX_KEY)) {
    scene.textures.get(TEX_KEY).setFilter(Phaser.Textures.FilterMode.LINEAR);
    return;
  }
  const canvas = document.createElement("canvas");
  canvas.width = TEX_SIZE;
  canvas.height = TEX_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const blot = (
    cx: number,
    cy: number,
    radius: number,
    inner: string,
    mid: string,
  ) => {
    const g = ctx.createRadialGradient(cx, cy, radius * 0.08, cx, cy, radius);
    g.addColorStop(0, inner);
    g.addColorStop(0.42, mid);
    g.addColorStop(1, "rgba(32,30,28,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
  };
  blot(16, 17, 15, "rgba(255,255,255,0.96)", "rgba(230,226,220,0.62)");
  blot(12, 14, 9, "rgba(255,255,255,0.55)", "rgba(210,206,200,0.22)");
  blot(20, 15, 8, "rgba(245,242,236,0.5)", "rgba(200,196,190,0.18)");
  scene.textures.addCanvas(TEX_KEY, canvas);
  scene.textures.get(TEX_KEY).setFilter(Phaser.Textures.FilterMode.LINEAR);
}
