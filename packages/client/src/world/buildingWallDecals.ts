import {
  mulberry32,
  xmur3,
  type BuildingType,
} from "@zombie/shared";

export type WallPoint = { x: number; y: number };

export type WallFace = {
  bottomLeft: WallPoint;
  bottomRight: WallPoint;
  depth: number;
};

type Rgb = readonly [number, number, number];

type WallLook = {
  alpha: number;
  mix: number;
  density: number;
  crackChance: number;
};

const DIRT: readonly Rgb[] = [
  [42, 30, 22],
  [34, 24, 18],
  [52, 36, 26],
  [28, 20, 14],
  [48, 34, 24],
];

const DUST: readonly Rgb[] = [
  [58, 50, 42],
  [46, 40, 34],
  [64, 54, 44],
  [38, 34, 28],
];

const CRACK: readonly Rgb[] = [
  [36, 32, 30],
  [48, 44, 40],
  [28, 26, 24],
  [56, 50, 46],
];

function rngFor(seed: string) {
  return mulberry32(xmur3(seed)());
}

function pick<T>(rng: () => number, list: readonly T[]): T {
  return list[Math.floor(rng() * list.length) % list.length]!;
}

function wallLook(seedKey: string): WallLook {
  const roll = rngFor(`wall-weight:${seedKey}`)();
  if (roll < 0.32) return { alpha: 0.72, mix: 0.7, density: 0.28, crackChance: 0.14 };
  if (roll < 0.64) return { alpha: 0.82, mix: 0.8, density: 0.4, crackChance: 0.26 };
  if (roll < 0.88) return { alpha: 0.9, mix: 0.88, density: 0.52, crackChance: 0.38 };
  return { alpha: 0.98, mix: 0.94, density: 0.68, crackChance: 0.5 };
}

function typeScale(type: BuildingType | undefined) {
  if (type === "hospital" || type === "police_station" || type === "office") {
    return 0.62;
  }
  if (type === "diner") return 0.7;
  if (type === "tent") return 0.6;
  if (type === "house") return 0.95;
  if (type === "warehouse" || type === "supermarket") return 0.9;
  return 0.85;
}

function usesDust(type: BuildingType | undefined) {
  return (
    type === "hospital" ||
    type === "police_station" ||
    type === "office" ||
    type === "motel" ||
    type === "diner"
  );
}

function allowsCracks(type: BuildingType | undefined) {
  return type !== "tent";
}

function hash01(x: number, y: number, salt: number) {
  let n = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + salt;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n >>> 0) % 1000) / 1000;
}

function applyMat(m: DOMMatrix, x: number, y: number) {
  return { x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f };
}

function invertMat(m: DOMMatrix, x: number, y: number) {
  const det = m.a * m.d - m.b * m.c;
  if (Math.abs(det) < 1e-8) return { x, y };
  const ix = x - m.e;
  const iy = y - m.f;
  return {
    x: (m.d * ix - m.c * iy) / det,
    y: (-m.b * ix + m.a * iy) / det,
  };
}

function uvToPoint(face: WallFace, u: number, v: number): WallPoint {
  const { bottomLeft: bl, bottomRight: br, depth } = face;
  return {
    x: bl.x + (br.x - bl.x) * u,
    y: bl.y + (br.y - bl.y) * u - depth * v,
  };
}

function pointToUv(face: WallFace, x: number, y: number) {
  const { bottomLeft: bl, bottomRight: br, depth } = face;
  const rx = br.x - bl.x;
  const ry = br.y - bl.y;
  const u =
    Math.abs(rx) >= 1e-6
      ? (x - bl.x) / rx
      : Math.abs(ry) >= 1e-6
        ? (y - bl.y) / ry
        : 0;
  const v = depth > 1e-6 ? (bl.y + u * ry - y) / depth : 0;
  return { u, v };
}

function inFace(face: WallFace, x: number, y: number) {
  const { u, v } = pointToUv(face, x, y);
  return u >= 0.02 && u <= 0.98 && v >= 0 && v <= 0.96;
}

function blendOnto(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  rgb: Rgb,
  amount: number,
) {
  const ix = Math.round(x);
  const iy = Math.round(y);
  if (ix < 0 || iy < 0 || ix >= width || iy >= height) return;
  const t = Math.max(0, Math.min(1, amount));
  if (t <= 0.01) return;
  const i = (iy * width + ix) * 4;
  if (data[i + 3]! < 8) return;
  data[i] = Math.round(data[i]! * (1 - t) + rgb[0] * t);
  data[i + 1] = Math.round(data[i + 1]! * (1 - t) + rgb[1] * t);
  data[i + 2] = Math.round(data[i + 2]! * (1 - t) + rgb[2] * t);
}

function paintSoftBlob(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  originX: number,
  originY: number,
  rx: number,
  ry: number,
  rgb: Rgb,
  amount: number,
  salt: number,
  face: WallFace,
  toUser: (x: number, y: number) => WallPoint,
  edgeNoise = 0.34,
  fallPower = 2,
) {
  const x0 = Math.floor(originX - rx - 1);
  const y0 = Math.floor(originY - ry - 1);
  const x1 = Math.ceil(originX + rx + 1);
  const y1 = Math.ceil(originY + ry + 1);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const user = toUser(x + 0.5, y + 0.5);
      if (!inFace(face, user.x, user.y)) continue;
      const nx = (x + 0.5 - originX) / Math.max(0.7, rx);
      const ny = (y + 0.5 - originY) / Math.max(0.4, ry);
      const wobble = (hash01(x, y, salt) - 0.5) * edgeNoise;
      const d = nx * nx + ny * ny + wobble;
      if (d >= 1) continue;
      const fall = Math.pow(1 - d, fallPower);
      blendOnto(data, width, height, x, y, rgb, amount * fall);
    }
  }
}

function paintWallDirt(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  face: WallFace,
  rng: () => number,
  look: WallLook,
  dirt: readonly Rgb[],
  toDevice: (x: number, y: number) => WallPoint,
  toUser: (x: number, y: number) => WallPoint,
) {
  const u = 0.08 + rng() * 0.84;
  const v = 0.14 + rng() * 0.72;
  const amount = 0.5;
  const clumps = 1 + Math.floor(rng() * 3);
  for (let i = 0; i < clumps; i++) {
    const pu = u + (rng() - 0.5) * 0.09;
    const pv = v + (rng() - 0.5) * 0.07;
    if (pv < 0.12 || pv > 0.9) continue;
    const at = uvToPoint(face, pu, pv);
    const p = toDevice(at.x, at.y);
    const rx = 3.6 + rng() * 4.8;
    paintSoftBlob(
      data,
      width,
      height,
      p.x,
      p.y,
      rx,
      rx * (0.42 + rng() * 0.3),
      pick(rng, dirt),
      amount,
      Math.floor(rng() * 100000),
      face,
      toUser,
      0.4,
      1.15,
    );
  }
}

function paintCrack(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  face: WallFace,
  rng: () => number,
  look: WallLook,
  toDevice: (x: number, y: number) => WallPoint,
) {
  let u = 0.1 + rng() * 0.8;
  let v = 0.16 + rng() * 0.52;
  const maxPx = 16 + rng() * 18;
  const lenV = Math.min(0.34, maxPx / Math.max(24, face.depth));
  const steps = 8 + Math.floor(rng() * 10);
  const dv = lenV / steps;
  const amount = Math.max(0.55, look.mix) * Math.max(0.5, look.alpha);
  let drift = (rng() - 0.5) * 0.004;
  for (let i = 0; i < steps; i++) {
    drift += (rng() - 0.5) * 0.0035;
    u += drift;
    v += dv;
    if (rng() < 0.1) u += (rng() - 0.5) * 0.01;
    if (u < 0.04 || u > 0.96 || v > 0.88) break;
    const at = uvToPoint(face, u, v);
    const p = toDevice(at.x, at.y);
    const rgb = pick(rng, CRACK);
    blendOnto(data, width, height, p.x, p.y, rgb, amount);
    blendOnto(data, width, height, p.x + 1, p.y, rgb, amount * 0.38);
    if (rng() < 0.16) {
      blendOnto(data, width, height, p.x, p.y + 1, rgb, amount * 0.22);
    }
  }
}

function paintFace(
  ctx: CanvasRenderingContext2D,
  face: WallFace,
  rng: () => number,
  look: WallLook,
  type: BuildingType | undefined,
  mat: DOMMatrix,
) {
  if (face.depth < 12) return;
  const { bottomLeft: bl, bottomRight: br, depth } = face;
  const tl = { x: bl.x, y: bl.y - depth };
  const tr = { x: br.x, y: br.y - depth };
  const toDevice = (x: number, y: number) => applyMat(mat, x, y);
  const toUser = (x: number, y: number) => invertMat(mat, x, y);
  const corners = [bl, br, tr, tl].map((p) => toDevice(p.x, p.y));
  const pad = 3;
  const dx0 = Math.max(0, Math.floor(Math.min(...corners.map((p) => p.x))) - pad);
  const dy0 = Math.max(0, Math.floor(Math.min(...corners.map((p) => p.y))) - pad);
  const dx1 = Math.min(
    ctx.canvas.width,
    Math.ceil(Math.max(...corners.map((p) => p.x))) + pad,
  );
  const dy1 = Math.min(
    ctx.canvas.height,
    Math.ceil(Math.max(...corners.map((p) => p.y))) + pad,
  );
  const dw = dx1 - dx0;
  const dh = dy1 - dy0;
  if (dw < 4 || dh < 4) return;

  const image = ctx.getImageData(dx0, dy0, dw, dh);
  const localToUser = (x: number, y: number) => toUser(x + dx0, y + dy0);
  const localToDevice = (x: number, y: number) => {
    const p = toDevice(x, y);
    return { x: p.x - dx0, y: p.y - dy0 };
  };

  const edgeLen = Math.hypot(br.x - bl.x, br.y - bl.y);
  const tiles = Math.max(1, Math.round(edgeLen / 36));
  const dirt = usesDust(type) ? DUST : DIRT;
  const splashCount = Math.min(
    6,
    Math.max(1, Math.round(tiles * 0.45 * look.density + 0.4)),
  );
  for (let i = 0; i < splashCount; i++) {
    paintWallDirt(
      image.data,
      dw,
      dh,
      face,
      rng,
      look,
      dirt,
      localToDevice,
      localToUser,
    );
  }

  if (allowsCracks(type) && rng() < look.crackChance * (tiles >= 4 ? 1 : 0.7)) {
    paintCrack(image.data, dw, dh, face, rng, look, localToDevice);
    if (look.density > 0.8 && tiles >= 7 && rng() < 0.28) {
      paintCrack(image.data, dw, dh, face, rng, look, localToDevice);
    }
  }

  ctx.putImageData(image, dx0, dy0);
}

/**
 * Dirt stains and hairline cracks on camera-facing wall faces.
 * Mixes into baked wall pixels. Seeded so a bake keeps the same wear.
 */
export function paintWallDecals(
  ctx: CanvasRenderingContext2D,
  faces: WallFace[],
  seedKey: string,
  buildingType?: BuildingType,
) {
  if (faces.length === 0) return;
  const rng = rngFor(`wall-wear:${seedKey}`);
  const look = wallLook(seedKey);
  const density = look.density * typeScale(buildingType);
  const scaled: WallLook = { ...look, density };
  const mat = ctx.getTransform();
  for (const face of faces) {
    paintFace(ctx, face, rng, scaled, buildingType, mat);
  }
}

/** SW + SE cuboid faces. */
export function paintCuboidWallDecals(
  ctx: CanvasRenderingContext2D,
  sw: WallPoint,
  se: WallPoint,
  ne: WallPoint,
  depth: number,
  seedKey: string,
  buildingType?: BuildingType,
) {
  paintWallDecals(
    ctx,
    [
      { bottomLeft: sw, bottomRight: se, depth },
      { bottomLeft: ne, bottomRight: se, depth },
    ],
    seedKey,
    buildingType,
  );
}
