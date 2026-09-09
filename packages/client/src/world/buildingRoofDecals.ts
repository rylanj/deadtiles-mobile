import {
  mulberry32,
  xmur3,
  type BuildingType,
} from "@zombie/shared";

export type RoofPoint = { x: number; y: number };
export type RoofFace = RoofPoint[];

type Family = "dirt" | "damage";

type Rgb = readonly [number, number, number];

type RoofLook = {
  /** Overall opacity of the wear. */
  alpha: number;
  /** How hard debris pulls away from the roof color. */
  mix: number;
  /** Patch count scale. */
  density: number;
};

const FAMILIES: readonly Family[] = ["dirt", "damage"];

const PALETTE: Record<Family, readonly Rgb[]> = {
  dirt: [
    [92, 64, 48],
    [74, 52, 38],
    [110, 82, 58],
    [64, 44, 32],
    [122, 92, 66],
  ],
  damage: [
    [32, 28, 26],
    [44, 40, 36],
    [22, 20, 18],
    [54, 48, 44],
  ],
};

const TYPE_WEIGHTS: Partial<Record<BuildingType, Record<Family, number>>> = {
  house: { dirt: 22, damage: 12 },
  apartment: { dirt: 16, damage: 16 },
  motel: { dirt: 18, damage: 16 },
  warehouse: { dirt: 16, damage: 22 },
  office: { dirt: 16, damage: 18 },
  police_station: { dirt: 14, damage: 16 },
  hospital: { dirt: 12, damage: 12 },
  supermarket: { dirt: 16, damage: 18 },
  large_retail: { dirt: 16, damage: 18 },
  diner: { dirt: 16, damage: 14 },
  gun_shop: { dirt: 16, damage: 14 },
  tent: { dirt: 22, damage: 10 },
  mess_hall: { dirt: 18, damage: 12 },
};

const DEFAULT_WEIGHTS: Record<Family, number> = {
  dirt: 18,
  damage: 14,
};

function rngFor(seed: string) {
  return mulberry32(xmur3(seed)());
}

function pick<T>(rng: () => number, list: readonly T[]): T {
  return list[Math.floor(rng() * list.length) % list.length]!;
}

function weightsFor(type: BuildingType | undefined) {
  return (type && TYPE_WEIGHTS[type]) || DEFAULT_WEIGHTS;
}

function typeDensity(type: BuildingType | undefined) {
  if (type === "hospital" || type === "police_station") return 0.48;
  if (type === "tent") return 0.42;
  if (type === "house") return 1;
  if (type === "warehouse" || type === "supermarket") return 0.85;
  return 0.72;
}

/** Same faint-to-heavy spread as ground edgeware. */
function roofLook(seedKey: string): RoofLook {
  const roll = rngFor(`roof-weight:${seedKey}`)();
  if (roll < 0.2) return { alpha: 0.26, mix: 0.34, density: 0.52 };
  if (roll < 0.48) return { alpha: 0.48, mix: 0.52, density: 0.74 };
  if (roll < 0.8) return { alpha: 0.76, mix: 0.7, density: 1 };
  return { alpha: 1.05, mix: 0.86, density: 1.18 };
}

function pickFamily(
  rng: () => number,
  weights: Record<Family, number>,
  avoid: Family | null,
): Family {
  let total = 0;
  for (const family of FAMILIES) {
    if (family === avoid) continue;
    total += weights[family];
  }
  if (total <= 0) return pick(rng, FAMILIES);
  let roll = rng() * total;
  for (const family of FAMILIES) {
    if (family === avoid) continue;
    roll -= weights[family];
    if (roll <= 0) return family;
  }
  return FAMILIES[FAMILIES.length - 1]!;
}

function shoelace(face: RoofFace) {
  let area = 0;
  for (let i = 0; i < face.length; i++) {
    const a = face[i]!;
    const b = face[(i + 1) % face.length]!;
    area += a.x * b.y - b.x * a.y;
  }
  return Math.abs(area) * 0.5;
}

function pointInFace(x: number, y: number, face: RoofFace) {
  let inside = false;
  for (let i = 0, j = face.length - 1; i < face.length; j = i++) {
    const a = face[i]!;
    const b = face[j]!;
    const crosses =
      a.y > y !== b.y > y &&
      x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y + 1e-6) + a.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

function faceBounds(face: RoofFace) {
  let minX = face[0]!.x;
  let maxX = minX;
  let minY = face[0]!.y;
  let maxY = minY;
  for (const p of face) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, maxX, minY, maxY };
}

function randomPointInFace(rng: () => number, face: RoofFace): RoofPoint | null {
  const b = faceBounds(face);
  for (let i = 0; i < 18; i++) {
    const x = b.minX + rng() * (b.maxX - b.minX);
    const y = b.minY + rng() * (b.maxY - b.minY);
    if (pointInFace(x, y, face)) return { x, y };
  }
  return null;
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

function insetFace(face: RoofFace, px: number): RoofFace {
  if (face.length < 3) return face;
  let cx = 0;
  let cy = 0;
  for (const p of face) {
    cx += p.x;
    cy += p.y;
  }
  cx /= face.length;
  cy /= face.length;
  return face.map((p) => {
    const dx = cx - p.x;
    const dy = cy - p.y;
    const len = Math.hypot(dx, dy) || 1;
    const t = Math.min(px / len, 0.28);
    return { x: p.x + dx * t, y: p.y + dy * t };
  });
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
  face: RoofFace,
  toUser: (x: number, y: number) => RoofPoint,
  edgeNoise = 0.28,
) {
  const x0 = Math.floor(originX - rx - 1);
  const y0 = Math.floor(originY - ry - 1);
  const x1 = Math.ceil(originX + rx + 1);
  const y1 = Math.ceil(originY + ry + 1);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const user = toUser(x + 0.5, y + 0.5);
      if (!pointInFace(user.x, user.y, face)) continue;
      const nx = (x + 0.5 - originX) / Math.max(0.6, rx);
      const ny = (y + 0.5 - originY) / Math.max(0.4, ry);
      const wobble = (hash01(x, y, salt) - 0.5) * edgeNoise;
      const d = nx * nx + ny * ny + wobble;
      if (d >= 1) continue;
      const fall = (1 - d) * (1 - d);
      blendOnto(data, width, height, x, y, rgb, amount * fall);
    }
  }
}

function familyAmount(family: Family, look: RoofLook, rng: () => number) {
  if (family === "dirt") {
    return look.mix * look.alpha * (0.28 + rng() * 0.5);
  }
  const visible = Math.max(0.58, look.alpha);
  const mix = Math.max(0.7, look.mix);
  return mix * visible * (0.62 + rng() * 0.38);
}

function paintCrack(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  origin: RoofPoint,
  rng: () => number,
  amount: number,
  face: RoofFace,
  toDevice: (x: number, y: number) => RoofPoint,
  toUser: (x: number, y: number) => RoofPoint,
) {
  const stain = toDevice(origin.x, origin.y);
  paintSoftBlob(
    data,
    width,
    height,
    stain.x,
    stain.y,
    3.2 + rng() * 2.4,
    1.6 + rng() * 1.2,
    pick(rng, PALETTE.damage),
    amount * 0.28,
    Math.floor(rng() * 100000),
    face,
    toUser,
    0.35,
  );

  const branches = 1 + (rng() < 0.45 ? 1 : 0);
  for (let b = 0; b < branches; b++) {
    let x = origin.x;
    let y = origin.y;
    let ang = rng() * Math.PI * 2 + b * 0.9;
    const steps = 9 + Math.floor(rng() * 10);
    for (let i = 0; i < steps; i++) {
      ang += (rng() - 0.5) * 0.7;
      x += Math.cos(ang) * 1.55;
      y += Math.sin(ang) * 0.82;
      if (!pointInFace(x, y, face)) break;
      const p = toDevice(x, y);
      const rgb = pick(rng, PALETTE.damage);
      blendOnto(data, width, height, p.x, p.y, rgb, amount);
      blendOnto(data, width, height, p.x + 1, p.y, rgb, amount * 0.42);
      if (rng() < 0.18) {
        blendOnto(data, width, height, p.x, p.y + 1, rgb, amount * 0.28);
      }
    }
  }
}

function paintPatch(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  face: RoofFace,
  family: Family,
  rng: () => number,
  look: RoofLook,
  toDevice: (x: number, y: number) => RoofPoint,
  toUser: (x: number, y: number) => RoofPoint,
) {
  const origin = randomPointInFace(rng, face);
  if (!origin) return;
  const amount = familyAmount(family, look, rng);

  if (family === "damage") {
    paintCrack(data, width, height, origin, rng, amount, face, toDevice, toUser);
    return;
  }

  const device = toDevice(origin.x, origin.y);
  const rx = 3.4 + rng() * 5.2;
  paintSoftBlob(
    data,
    width,
    height,
    device.x,
    device.y,
    rx,
    rx * (0.42 + rng() * 0.28),
    pick(rng, PALETTE.dirt),
    amount * 0.72,
    Math.floor(rng() * 100000),
    face,
    toUser,
  );
}

function familiesForFace(
  rng: () => number,
  weights: Record<Family, number>,
  count: number,
): Family[] {
  const out: Family[] = [];
  if (count >= 1) out.push("dirt");
  if (count >= 2) out.push("damage");
  let last = out[out.length - 1] ?? null;
  while (out.length < count) {
    const family = pickFamily(rng, weights, last);
    out.push(family);
    last = family;
  }
  return out;
}

/**
 * Scatter dirt and crack wear across roof faces.
 * Mixes into the baked roof pixels so the debris sits on the shingles.
 * Seeded by `seedKey` so a building keeps the same roof from bake to bake.
 */
export function paintRoofDecals(
  ctx: CanvasRenderingContext2D,
  faces: RoofFace[],
  seedKey: string,
  buildingType?: BuildingType,
) {
  if (faces.length === 0) return;
  const rng = rngFor(`roof-wear:${seedKey}`);
  const look = roofLook(seedKey);
  const weights = weightsFor(buildingType);
  const density = typeDensity(buildingType) * look.density;
  const mat = ctx.getTransform();
  const toDevice = (x: number, y: number) => applyMat(mat, x, y);
  const toUser = (x: number, y: number) => invertMat(mat, x, y);

  for (const raw of faces) {
    const face = insetFace(raw, 2.2);
    if (face.length < 3) continue;
    const area = shoelace(face);
    if (area < 40) continue;
    const count = Math.max(
      2,
      Math.min(24, Math.round((area / 280) * density)),
    );

    const b = faceBounds(face);
    const corners = [
      toDevice(b.minX, b.minY),
      toDevice(b.maxX, b.minY),
      toDevice(b.maxX, b.maxY),
      toDevice(b.minX, b.maxY),
    ];
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
    if (dw < 2 || dh < 2) continue;

    const image = ctx.getImageData(dx0, dy0, dw, dh);
    const localToUser = (x: number, y: number) => toUser(x + dx0, y + dy0);
    const localToDevice = (x: number, y: number) => {
      const p = toDevice(x, y);
      return { x: p.x - dx0, y: p.y - dy0 };
    };

    const families = familiesForFace(rng, weights, count);
    for (const family of families) {
      paintPatch(
        image.data,
        dw,
        dh,
        face,
        family,
        rng,
        look,
        localToDevice,
        localToUser,
      );
    }
    ctx.putImageData(image, dx0, dy0);
  }
}
