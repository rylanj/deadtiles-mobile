/**
 * Top-down colour grid of tiles around player spawn.
 * Default: 50 tiles in each direction (101×101), matching "50 cells around spawn".
 * Usage: node scripts/render-spawn-map.mjs [radius]
 */
import {
  generateTile,
  findPlayerSpawn,
  getBuildingAt,
  TileType,
  worldCenter,
  INITIAL_WORLD_BOUNDS,
  getSettlementType,
  SETTLEMENT_CELL_SIZE,
} from "@zombie/shared";
import fs from "fs";
import zlib from "zlib";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const RADIUS = Math.max(1, Number(process.argv[2]) || 50);
const cell = 10;
const pad = 8;
const headerH = 22;
const legendH = 36;

const COLORS = {
  floor: [0x6b, 0xb3, 0x3a],
  road: [0x4a, 0x4a, 0x4a],
  pavement: [0xb8, 0xb8, 0xb0],
  building: [0x6b, 0x3a, 0x2a],
  entrance: [0xf0, 0xc0, 0x20],
  spawn: [0xff, 0x2a, 0x2a],
};

const spawn = findPlayerSpawn("preview-player", INITIAL_WORLD_BOUNDS);
const sx = Math.floor(spawn.x);
const sy = Math.floor(spawn.y);
const center = worldCenter(INITIAL_WORLD_BOUNDS);

const minTX = sx - RADIUS;
const minTY = sy - RADIUS;
const W = RADIUS * 2 + 1;
const H = RADIUS * 2 + 1;

const counts = { floor: 0, road: 0, pavement: 0, building: 0, entrance: 0 };
const grid = [];

for (let y = 0; y < H; y++) {
  const row = [];
  for (let x = 0; x < W; x++) {
    const tx = minTX + x;
    const ty = minTY + y;
    const bld = getBuildingAt(tx, ty);
    let kind;
    if (bld && bld.entranceX === tx && bld.entranceY === ty) {
      kind = "entrance";
    } else {
      const t = generateTile(tx, ty);
      if (t === TileType.Wall) kind = "building";
      else if (t === TileType.Road) kind = "road";
      else if (t === TileType.Pavement) kind = "pavement";
      else kind = "floor";
    }
    counts[kind]++;
    row.push(kind);
  }
  grid.push(row);
}

const imgW = pad * 2 + W * cell;
const imgH = pad * 2 + H * cell + headerH + legendH;
const pixels = Buffer.alloc(imgW * imgH * 4, 255);

function setPx(x, y, r, g, b, a = 255) {
  if (x < 0 || y < 0 || x >= imgW || y >= imgH) return;
  const i = (y * imgW + x) * 4;
  pixels[i] = r;
  pixels[i + 1] = g;
  pixels[i + 2] = b;
  pixels[i + 3] = a;
}

function fillRect(x0, y0, w, h, rgb) {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      setPx(x, y, rgb[0], rgb[1], rgb[2]);
    }
  }
}

fillRect(0, 0, imgW, imgH, [0x22, 0x22, 0x28]);

const gridOriginY = pad + headerH;

for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const kind = grid[y][x];
    const px = pad + x * cell;
    const py = gridOriginY + y * cell;
    fillRect(px, py, cell - 1, cell - 1, COLORS[kind]);
  }
}

// Initial world bounds outline (0..49, 0..49) if visible
{
  const ix0 = pad + (0 - minTX) * cell;
  const iy0 = gridOriginY + (0 - minTY) * cell;
  const iw = INITIAL_WORLD_BOUNDS.mapWidth * cell;
  const ih = INITIAL_WORLD_BOUNDS.mapHeight * cell;
  for (let i = 0; i < iw; i++) {
    setPx(ix0 + i, iy0, 0x40, 0xa0, 0xff);
    setPx(ix0 + i, iy0 + ih - 1, 0x40, 0xa0, 0xff);
  }
  for (let i = 0; i < ih; i++) {
    setPx(ix0, iy0 + i, 0x40, 0xa0, 0xff);
    setPx(ix0 + iw - 1, iy0 + i, 0x40, 0xa0, 0xff);
  }
}

// Spawn tile
{
  const px = pad + (sx - minTX) * cell;
  const py = gridOriginY + (sy - minTY) * cell;
  fillRect(px, py, cell - 1, cell - 1, COLORS.spawn);
  for (let i = 0; i < cell - 1; i++) {
    setPx(px + i, py, 255, 255, 255);
    setPx(px + i, py + cell - 2, 255, 255, 255);
    setPx(px, py + i, 255, 255, 255);
    setPx(px + cell - 2, py + i, 255, 255, 255);
  }
}

const items = [
  ["floor", "Grass/lot"],
  ["road", "Road"],
  ["pavement", "Pavement"],
  ["building", "Building"],
  ["entrance", "Entrance"],
  ["spawn", "Player spawn"],
];

const legendY = gridOriginY + H * cell + 10;
let lx = pad;
for (const [key] of items) {
  fillRect(lx, legendY, 12, 12, COLORS[key]);
  lx += 24;
}
// initial-bounds swatch
fillRect(lx, legendY, 12, 12, [0x40, 0xa0, 0xff]);

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePNG(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const compressed = zlib.deflateSync(raw);
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", compressed),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const pngPath = path.join(__dirname, "spawn-area-50x50.png");
fs.writeFileSync(pngPath, encodePNG(imgW, imgH, pixels));

// SVG with labels
const svgCell = 8;
const svgW = pad * 2 + W * svgCell;
const svgH = pad * 2 + H * svgCell + headerH + legendH + 8;
const hex = (rgb) => "#" + rgb.map((v) => v.toString(16).padStart(2, "0")).join("");
const gY = pad + headerH;

let rects = "";
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const kind = grid[y][x];
    const isSpawn = x === sx - minTX && y === sy - minTY;
    const fill = isSpawn ? hex(COLORS.spawn) : hex(COLORS[kind]);
    rects += `<rect x="${pad + x * svgCell}" y="${gY + y * svgCell}" width="${svgCell - 1}" height="${svgCell - 1}" fill="${fill}"/>`;
  }
}

const ibx = pad + (0 - minTX) * svgCell;
const iby = gY + (0 - minTY) * svgCell;
const ibw = INITIAL_WORLD_BOUNDS.mapWidth * svgCell;
const ibh = INITIAL_WORLD_BOUNDS.mapHeight * svgCell;
rects += `<rect x="${ibx}" y="${iby}" width="${ibw}" height="${ibh}" fill="none" stroke="#40a0ff" stroke-width="2"/>`;
rects += `<rect x="${pad + (sx - minTX) * svgCell}" y="${gY + (sy - minTY) * svgCell}" width="${svgCell - 1}" height="${svgCell - 1}" fill="none" stroke="#fff" stroke-width="2"/>`;

let legend = "";
let legX = pad;
const legY = gY + H * svgCell + 16;
const legendItems = [
  ...items,
  ["bounds", "Initial 50×50"],
];
const legendColors = { ...COLORS, bounds: [0x40, 0xa0, 0xff] };
for (const [key, label] of legendItems) {
  legend += `<rect x="${legX}" y="${legY}" width="12" height="12" fill="${hex(legendColors[key])}"/>`;
  legend += `<text x="${legX + 16}" y="${legY + 11}" font-family="sans-serif" font-size="11" fill="#eee">${label}</text>`;
  legX += 16 + label.length * 6.5 + 12;
}

const cellOx = Math.floor(sx / SETTLEMENT_CELL_SIZE) * SETTLEMENT_CELL_SIZE;
const cellOy = Math.floor(sy / SETTLEMENT_CELL_SIZE) * SETTLEMENT_CELL_SIZE;
const settleType = getSettlementType(cellOx, cellOy);

const title = `${W}×${H} tiles (±${RADIUS} from spawn) · spawn (${sx},${sy}) · settlement cell (${cellOx},${cellOy})=${settleType} · world center (${center.x},${center.y})`;
const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}">
  <rect width="100%" height="100%" fill="#222228"/>
  <text x="${pad}" y="16" font-family="sans-serif" font-size="12" fill="#ccc">${title}</text>
  ${rects}
  ${legend}
</svg>
`;

const svgPath = path.join(__dirname, "spawn-area-50x50.svg");
fs.writeFileSync(svgPath, svg);

console.log("Spawn:", spawn);
console.log("Tile:", sx, sy);
console.log("Range:", minTX, minTY, "→", minTX + W - 1, minTY + H - 1);
console.log("Settlement cell:", cellOx, cellOy, settleType);
console.log("Counts:", counts);
console.log("Wrote", pngPath);
console.log("Wrote", svgPath);
