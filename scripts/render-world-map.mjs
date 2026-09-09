/**
 * High-performance procedural world map exporter.
 *
 * Samples the same deterministic worldgen as the game (roads, buildings, trees,
 * fences, streetlights, car parks) and writes:
 *   - map.png          — 1px (or --scale) per tile
 *   - map.svg          — PNG reference + city/town name labels
 *   - settlements.json — machine-readable labels for external UIs
 *   - map.html         — simple pan/zoom viewer
 *
 * Usage (from repo root, after `npm run build -w @zombie/shared`):
 *   node scripts/render-world-map.mjs --spawn --radius 400
 *   node scripts/render-world-map.mjs --center 0,0 --radius 1500
 *   node scripts/render-world-map.mjs --min -2000,-2000 --max 2000,2000
 *   node scripts/render-world-map.mjs --center 5000,-3000 --radius 2000 --out scripts/maps/far
 *
 * Flags:
 *   --center X,Y     Region centre in tile coords (default 0,0)
 *   --radius N       Half-extent in tiles (region is (2N+1)² unless --min/--max)
 *   --min X,Y        Inclusive min corner (with --max)
 *   --max X,Y        Inclusive max corner (with --min)
 *   --spawn          Centre on Birchport player spawn instead of --center
 *   --scale N        Pixels per tile (default 1)
 *   --chunk N        Warm/sample chunk size in tiles (default 192)
 *   --workers N      Parallel worker threads (default: CPU count)
 *   --out DIR        Output directory (default scripts/maps/world)
 *   --no-html        Skip map.html
 *   --fast           Skip trees/fences/streetlights (roads + buildings only)
 *   --force          Allow huge regions without the soft memory warning abort
 *
 * Large exports (multi‑million tiles) may need more heap, e.g.:
 *   set NODE_OPTIONS=--max-old-space-size=16384
 *   npm run map:export -- --center 0,0 --radius 5000 --fast --workers 8
 */
import {
  SETTLEMENT_CELL_SIZE,
  INITIAL_WORLD_BOUNDS,
  findPlayerSpawn,
  settlementCellsInRegion,
  getSettlementType,
} from "@zombie/shared";
import { sampleStrip } from "./lib/world-map-sample.mjs";
import fs from "fs";
import path from "path";
import zlib from "zlib";
import os from "os";
import { Worker } from "worker_threads";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKER_PATH = path.join(__dirname, "render-world-map-worker.mjs");

function defaultWorkerCount() {
  const n =
    typeof os.availableParallelism === "function"
      ? os.availableParallelism()
      : os.cpus().length;
  return Math.max(1, n);
}

// ── CLI ─────────────────────────────────────────────────────────────────────

function parsePair(s) {
  const m = String(s).match(/^(-?\d+)\s*,\s*(-?\d+)$/);
  if (!m) throw new Error(`Expected X,Y got "${s}"`);
  return [Number(m[1]), Number(m[2])];
}

function parseArgs(argv) {
  const opts = {
    center: null,
    radius: 500,
    min: null,
    max: null,
    spawn: false,
    scale: 1,
    chunk: 192,
    workers: defaultWorkerCount(),
    out: path.join(__dirname, "maps", "world"),
    html: true,
    fast: false,
    force: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`Missing value after ${a}`);
      return v;
    };
    switch (a) {
      case "--center":
        opts.center = parsePair(next());
        break;
      case "--radius":
        opts.radius = Math.max(1, Number(next()) | 0);
        break;
      case "--min":
        opts.min = parsePair(next());
        break;
      case "--max":
        opts.max = parsePair(next());
        break;
      case "--spawn":
        opts.spawn = true;
        break;
      case "--scale":
        opts.scale = Math.max(1, Number(next()) | 0);
        break;
      case "--chunk":
        opts.chunk = Math.max(32, Number(next()) | 0);
        break;
      case "--workers":
        opts.workers = Math.max(1, Number(next()) | 0);
        break;
      case "--out":
        opts.out = path.resolve(next());
        break;
      case "--no-html":
        opts.html = false;
        break;
      case "--fast":
        opts.fast = true;
        break;
      case "--force":
        opts.force = true;
        break;
      case "-h":
      case "--help":
        opts.help = true;
        break;
      default:
        throw new Error(`Unknown arg: ${a}`);
    }
  }
  return opts;
}

// ── Colours (match in-game MapOverlayUI) ────────────────────────────────────

const RGBA = [
  [0x4a, 0x7a, 0x3a, 255], // floor
  [0x3a, 0x3b, 0x3c, 255], // road
  [0x9a, 0x9a, 0x8e, 255], // pavement
  [0x7a, 0x7a, 0x78, 255], // carpark
  [0x5c, 0x40, 0x33, 255], // building
  [0x2d, 0x4a, 0x2d, 255], // tree
  [0x6b, 0x4e, 0x2e, 255], // fence
  [0x8a, 0x8a, 0x70, 255], // streetlight
];

// ── PNG encoder (indexed palette — streams from kinds, no full RGBA copy) ───

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

/**
 * Write an indexed-color PNG (1 byte/pixel) from the kinds buffer.
 * Peak extra memory is one scanline + zlib window — not a full RGBA image.
 *
 * Important: each deflate.write() gets its own Buffer copy. Reusing one row
 * buffer while zlib still holds a reference produces striped/corrupt output.
 */
function writeIndexedPNGFromKinds(outPath, kinds, tileW, tileH, scale) {
  const imgW = tileW * scale;
  const imgH = tileH * scale;
  const plte = Buffer.alloc(RGBA.length * 3);
  for (let i = 0; i < RGBA.length; i++) {
    plte[i * 3] = RGBA[i][0];
    plte[i * 3 + 1] = RGBA[i][1];
    plte[i * 3 + 2] = RGBA[i][2];
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(imgW, 0);
  ihdr.writeUInt32BE(imgH, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 3; // indexed color
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  // Build raw filtered scanlines then deflate once (avoids async buffer reuse).
  const stride = 1 + imgW;
  // Stream in row batches so we don't need a second full-image copy for huge maps.
  const BATCH_ROWS = Math.max(1, Math.min(imgH, Math.floor((4 * 1024 * 1024) / stride)));
  const deflate = zlib.createDeflate({ level: 6 });
  const compressedChunks = [];
  deflate.on("data", (c) => compressedChunks.push(c));

  const batch = Buffer.alloc(stride * BATCH_ROWS);

  return new Promise((resolve, reject) => {
    deflate.on("error", reject);
    deflate.on("end", () => {
      try {
        const idat = Buffer.concat(compressedChunks);
        const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
        fs.writeFileSync(
          outPath,
          Buffer.concat([
            sig,
            pngChunk("IHDR", ihdr),
            pngChunk("PLTE", plte),
            pngChunk("IDAT", idat),
            pngChunk("IEND", Buffer.alloc(0)),
          ]),
        );
        resolve({ imgW, imgH });
      } catch (err) {
        reject(err);
      }
    });

    try {
      for (let y0 = 0; y0 < imgH; y0 += BATCH_ROWS) {
        const rows = Math.min(BATCH_ROWS, imgH - y0);
        for (let r = 0; r < rows; r++) {
          const y = y0 + r;
          const dest = r * stride;
          batch[dest] = 0; // filter None
          const ty = (y / scale) | 0;
          const srcRow = ty * tileW;
          const out = dest + 1;
          if (scale === 1) {
            for (let x = 0; x < imgW; x++) {
              batch[out + x] = kinds[srcRow + x] ?? 0;
            }
          } else {
            for (let x = 0; x < imgW; x++) {
              batch[out + x] = kinds[srcRow + ((x / scale) | 0)] ?? 0;
            }
          }
        }
        // Copy the used portion so Deflate owns stable bytes.
        deflate.write(Buffer.from(batch.subarray(0, rows * stride)));
      }
      deflate.end();
    } catch (err) {
      reject(err);
    }
  });
}

/** Labels to embed in HTML — cities always; towns only if under the cap. */
function settlementsForViewer(settlements, maxLabels = 2500) {
  const cities = settlements.filter((s) => s.kind === "city");
  if (cities.length >= maxLabels) return cities.slice(0, maxLabels);
  const towns = settlements.filter((s) => s.kind === "town");
  const room = maxLabels - cities.length;
  return cities.concat(towns.slice(0, room));
}

// ── Region sampling ─────────────────────────────────────────────────────────

function resolveBounds(opts) {
  if (opts.min && opts.max) {
    const minX = Math.min(opts.min[0], opts.max[0]);
    const maxX = Math.max(opts.min[0], opts.max[0]);
    const minY = Math.min(opts.min[1], opts.max[1]);
    const maxY = Math.max(opts.min[1], opts.max[1]);
    return { minX, maxX, minY, maxY };
  }

  let cx = opts.center?.[0] ?? 0;
  let cy = opts.center?.[1] ?? 0;
  if (opts.spawn) {
    const spawn = findPlayerSpawn("map-export", INITIAL_WORLD_BOUNDS);
    cx = Math.floor(spawn.x);
    cy = Math.floor(spawn.y);
  } else if (!opts.center) {
    cx = 0;
    cy = 0;
  }

  const r = opts.radius;
  return {
    minX: cx - r,
    maxX: cx + r,
    minY: cy - r,
    maxY: cy + r,
  };
}

function sampleRegionSync(bounds, opts) {
  const { minX, maxX, minY, maxY } = bounds;
  const W = maxX - minX + 1;
  const H = maxY - minY + 1;
  const tiles = W * H;
  const t0 = Date.now();
  let lastLog = t0;

  console.log(
    `Sampling ${W}×${H} = ${tiles.toLocaleString()} tiles (1 thread, chunk=${opts.chunk}, fast=${opts.fast})…`,
  );

  const result = sampleStrip({
    minX,
    maxX,
    minY,
    maxY,
    fast: opts.fast,
    chunk: opts.chunk,
    onProgress: ({ chunkIndex, chunkTotal, sampled }) => {
      const now = Date.now();
      if (now - lastLog > 1500 || chunkIndex === chunkTotal) {
        const rate = sampled / Math.max(0.001, (now - t0) / 1000);
        console.log(
          `  chunk ${chunkIndex}/${chunkTotal} · ${sampled.toLocaleString()} tiles · ${Math.round(rate).toLocaleString()} tiles/s`,
        );
        lastLog = now;
      }
    },
  });

  const settlements = result.settlements.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "city" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return {
    kinds: result.kinds,
    W,
    H,
    settlements,
    elapsedMs: Date.now() - t0,
  };
}

function buildStrips(bounds, workerCount, chunk) {
  const { minX, maxX, minY, maxY } = bounds;
  const H = maxY - minY + 1;
  // Enough strips to keep all workers busy; prefer ~chunk height but
  // shrink when the region is short relative to worker count.
  const targetStrips = Math.max(workerCount * 3, 1);
  const stripH = Math.max(
    48,
    Math.min(chunk, Math.ceil(H / targetStrips)),
  );
  const strips = [];
  let id = 0;
  for (let y0 = minY; y0 <= maxY; y0 += stripH) {
    strips.push({
      stripId: id++,
      minX,
      maxX,
      minY: y0,
      maxY: Math.min(maxY, y0 + stripH - 1),
    });
  }
  return strips;
}

function sampleRegionParallel(bounds, opts) {
  const { minX, maxX, minY, maxY } = bounds;
  const W = maxX - minX + 1;
  const H = maxY - minY + 1;
  const tiles = W * H;
  const workersN = Math.min(opts.workers, H);
  const strips = buildStrips(bounds, workersN, opts.chunk);
  const kinds = new Uint8Array(tiles);
  const settlementById = new Map();

  const t0 = Date.now();
  let sampled = 0;
  let stripsDone = 0;
  let lastLog = t0;

  console.log(
    `Sampling ${W}×${H} = ${tiles.toLocaleString()} tiles with ${workersN} workers · ${strips.length} strips (chunk=${opts.chunk}, fast=${opts.fast})…`,
  );

  return new Promise((resolve, reject) => {
    const queue = strips.slice();
    let failed = false;
    const workers = [];

    const logProgress = (force = false) => {
      const now = Date.now();
      if (!force && now - lastLog < 1500) return;
      const pct = ((100 * stripsDone) / strips.length).toFixed(1);
      const rate = sampled / Math.max(0.001, (now - t0) / 1000);
      console.log(
        `  strips ${stripsDone}/${strips.length} (${pct}%) · ${sampled.toLocaleString()} tiles · ${Math.round(rate).toLocaleString()} tiles/s · ${settlementById.size} places`,
      );
      lastLog = now;
    };

    const finishOk = () => {
      const settlements = [...settlementById.values()].sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === "city" ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      Promise.all(workers.map((w) => w.terminate().catch(() => {}))).finally(
        () => {
          resolve({
            kinds,
            W,
            H,
            settlements,
            elapsedMs: Date.now() - t0,
          });
        },
      );
    };

    const fail = (err) => {
      if (failed) return;
      failed = true;
      Promise.all(workers.map((w) => w.terminate().catch(() => {}))).finally(
        () => reject(err),
      );
    };

    const mergeResult = (msg) => {
      const stripW = msg.maxX - msg.minX + 1;
      const src =
        msg.kinds instanceof Uint8Array
          ? msg.kinds
          : new Uint8Array(msg.kinds);
      for (let ty = msg.minY; ty <= msg.maxY; ty++) {
        const srcRow = (ty - msg.minY) * stripW;
        const dstRow = (ty - minY) * W;
        kinds.set(
          src.subarray(srcRow, srcRow + stripW),
          dstRow + (msg.minX - minX),
        );
      }
      for (const s of msg.settlements) {
        if (!settlementById.has(s.id)) settlementById.set(s.id, s);
      }
      sampled += msg.sampled;
      stripsDone++;
      logProgress(stripsDone === strips.length);
    };

    const assign = (worker) => {
      if (failed) return;
      if (queue.length === 0) {
        worker._idle = true;
        if (workers.every((w) => w._idle) && stripsDone === strips.length) {
          finishOk();
        }
        return;
      }
      worker._idle = false;
      const job = queue.shift();
      worker.postMessage({
        type: "strip",
        stripId: job.stripId,
        minX: job.minX,
        maxX: job.maxX,
        minY: job.minY,
        maxY: job.maxY,
        fast: opts.fast,
        chunk: opts.chunk,
      });
    };

    for (let i = 0; i < workersN; i++) {
      const worker = new Worker(WORKER_PATH);
      worker._idle = true;
      worker.on("message", (msg) => {
        if (msg.type === "progress") return;
        if (msg.type === "done") {
          try {
            mergeResult(msg);
            assign(worker);
          } catch (err) {
            fail(err);
          }
        }
      });
      worker.on("error", fail);
      workers.push(worker);
      assign(worker);
    }
  });
}

async function sampleRegion(bounds, opts) {
  if (opts.workers <= 1) return sampleRegionSync(bounds, opts);
  return sampleRegionParallel(bounds, opts);
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildSvg({ imgW, imgH, scale, bounds, settlements, pngName }) {
  const { minX, minY } = bounds;
  let labels = "";
  for (const s of settlements) {
    const px = (s.x - minX) * scale;
    const py = (s.y - minY) * scale;
    const isCity = s.kind === "city";
    const fs = isCity ? Math.max(11, 12 * scale) : Math.max(9, 10 * scale);
    const fill = isCity ? "#f2e6c8" : "#d0d8d0";
    const weight = isCity ? 700 : 500;
    labels += `<text x="${px.toFixed(1)}" y="${py.toFixed(1)}" text-anchor="middle" dominant-baseline="middle" font-family="Georgia, serif" font-size="${fs}" font-weight="${weight}" fill="${fill}" stroke="#1a1c1a" stroke-width="${Math.max(2, scale)}" paint-order="stroke">${escapeXml(s.name)}</text>\n`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${imgW}" height="${imgH}" viewBox="0 0 ${imgW} ${imgH}">
  <title>Deadtiles world map (${bounds.minX},${bounds.minY})–(${bounds.maxX},${bounds.maxY})</title>
  <image href="${escapeXml(pngName)}" x="0" y="0" width="${imgW}" height="${imgH}" preserveAspectRatio="none"/>
  <g id="settlements">
${labels}  </g>
</svg>
`;
}

function buildHtml({ imgW, imgH, pngName, svgName, settlements, bounds, scale }) {
  const markers = settlements
    .map((s) => {
      const left = ((s.x - bounds.minX) * scale * 100) / imgW;
      const top = ((s.y - bounds.minY) * scale * 100) / imgH;
      return `<button class="label ${s.kind}" style="left:${left.toFixed(3)}%;top:${top.toFixed(3)}%" title="${escapeXml(s.name)} (${s.kind})">${escapeXml(s.name)}</button>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Deadtiles map</title>
<style>
  :root { color-scheme: dark; }
  html, body { margin: 0; height: 100%; background: #121412; overflow: hidden; font-family: system-ui, sans-serif; }
  #hud {
    position: fixed; z-index: 5; left: 12px; top: 12px; padding: 10px 12px;
    background: rgba(18,20,18,.88); border: 1px solid #3a403a; border-radius: 8px;
    color: #d8e0d8; font-size: 13px; line-height: 1.4; max-width: min(360px, 90vw);
    pointer-events: none;
  }
  #stage {
    position: absolute; inset: 0; cursor: grab; touch-action: none;
  }
  #stage.dragging { cursor: grabbing; }
  #world {
    position: absolute; left: 0; top: 0; transform-origin: 0 0;
    width: ${imgW}px; height: ${imgH}px;
    box-shadow: 0 0 0 1px #2a2e2a;
  }
  #world img { display: block; width: 100%; height: 100%; image-rendering: pixelated; }
  .label {
    position: absolute; transform: translate(-50%, -50%);
    border: 0; background: transparent; color: #f2e6c8; font: 700 12px/1 Georgia, serif;
    text-shadow: 0 0 3px #000, 0 1px 2px #000, 1px 0 2px #000; cursor: pointer;
    white-space: nowrap; padding: 2px 4px;
  }
  .label.town { color: #c8d4c8; font-weight: 500; font-size: 11px; }
  .label:hover { color: #fff; }
</style>
</head>
<body>
  <div id="hud">
    <div><strong>Deadtiles map</strong></div>
    <div>Tiles (${bounds.minX},${bounds.minY}) → (${bounds.maxX},${bounds.maxY})</div>
    <div>${settlements.length} named settlements · drag to pan · wheel to zoom</div>
    <div id="coords">—</div>
  </div>
  <div id="stage">
    <div id="world">
      <img src="${escapeXml(pngName)}" width="${imgW}" height="${imgH}" alt="world map" draggable="false"/>
      ${markers}
    </div>
  </div>
  <script>
    const stage = document.getElementById("stage");
    const world = document.getElementById("world");
    const coords = document.getElementById("coords");
    const imgW = ${imgW}, imgH = ${imgH};
    const minX = ${bounds.minX}, minY = ${bounds.minY}, scale = ${scale};
    let x = 40, y = 40, z = Math.min(window.innerWidth / imgW, window.innerHeight / imgH) * 0.92;
    let dragging = false, lx = 0, ly = 0;

    function apply() {
      world.style.transform = "translate(" + x + "px," + y + "px) scale(" + z + ")";
    }
    function tileAt(clientX, clientY) {
      const r = stage.getBoundingClientRect();
      const mx = (clientX - r.left - x) / z;
      const my = (clientY - r.top - y) / z;
      return [Math.floor(minX + mx / scale), Math.floor(minY + my / scale)];
    }
    stage.addEventListener("pointerdown", (e) => {
      dragging = true; lx = e.clientX; ly = e.clientY;
      stage.classList.add("dragging");
      stage.setPointerCapture(e.pointerId);
    });
    stage.addEventListener("pointermove", (e) => {
      const [tx, ty] = tileAt(e.clientX, e.clientY);
      coords.textContent = "Tile " + tx + ", " + ty;
      if (!dragging) return;
      x += e.clientX - lx; y += e.clientY - ly; lx = e.clientX; ly = e.clientY; apply();
    });
    stage.addEventListener("pointerup", () => { dragging = false; stage.classList.remove("dragging"); });
    stage.addEventListener("wheel", (e) => {
      e.preventDefault();
      const r = stage.getBoundingClientRect();
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      const before = 1 / z;
      const next = Math.min(8, Math.max(0.05, z * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
      x = mx - (mx - x) * (next / z);
      y = my - (my - y) * (next / z);
      z = next;
      apply();
    }, { passive: false });
    for (const btn of document.querySelectorAll(".label")) {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        coords.textContent = btn.title;
      });
    }
    apply();
  </script>
</body>
</html>
`;
}

// ── Main ────────────────────────────────────────────────────────────────────

const HELP = `render-world-map.mjs — export procedural Deadtiles region to PNG/SVG/HTML

  npm run map:export -- --center 5000,-4000 --radius 1500 --fast --workers 8
  npm run map:export -- --center 0,0 --radius 5000 --fast --workers 8 --force
  npm run map:export -- --min -8000,-8000 --max 8000,8000 --fast --workers 12

  Large maps: set NODE_OPTIONS=--max-old-space-size=16384
  No hard tile cap — size is limited by RAM (≈1 byte/tile + zlib).
`;

async function main() {
  const opts = parseArgs(process.argv);
  if (opts.help) {
    console.log(HELP);
    return;
  }

  const bounds = resolveBounds(opts);
  const W = bounds.maxX - bounds.minX + 1;
  const H = bounds.maxY - bounds.minY + 1;
  if (W < 1 || H < 1) throw new Error("Empty region");

  const tiles = W * H;
  // kinds buffer + overhead; warn before allocating multi‑GB regions
  const estMb = (tiles / (1024 * 1024)) * 1.35;
  console.log(
    `Region ${W}×${H} = ${tiles.toLocaleString()} tiles · ~${estMb.toFixed(0)} MB kinds buffer`,
  );
  if (tiles > 25_000_000 && !opts.force) {
    console.warn(
      `Warning: ${tiles.toLocaleString()} tiles is large. Re-run with --force to proceed, ` +
        `and consider NODE_OPTIONS=--max-old-space-size=16384`,
    );
    throw new Error("Aborted (pass --force to allow).");
  }
  if (tiles > Number.MAX_SAFE_INTEGER / 4) {
    throw new Error("Region exceeds safe buffer size.");
  }

  fs.mkdirSync(opts.out, { recursive: true });

  console.log("Bounds:", bounds);
  console.log(
    `Settlement cells covering region: ${settlementCellsInRegion(bounds.minX, bounds.maxX, bounds.minY, bounds.maxY).length}`,
  );

  const { kinds, settlements, elapsedMs } = await sampleRegion(bounds, opts);
  console.log(`Sampled in ${(elapsedMs / 1000).toFixed(1)}s`);
  console.log(`Settlements: ${settlements.length} (cities + towns)`);

  const pngName = "map.png";
  const svgName = "map.svg";
  const pngPath = path.join(opts.out, pngName);
  const svgPath = path.join(opts.out, svgName);
  const jsonPath = path.join(opts.out, "settlements.json");

  console.log(`Encoding indexed PNG…`);
  const { imgW, imgH } = await writeIndexedPNGFromKinds(
    pngPath,
    kinds,
    W,
    H,
    opts.scale,
  );

  const viewerSettlements = settlementsForViewer(settlements);

  fs.writeFileSync(
    svgPath,
    buildSvg({
      imgW,
      imgH,
      scale: opts.scale,
      bounds,
      settlements: viewerSettlements,
      pngName,
    }),
  );

  const payload = {
    generatedAt: new Date().toISOString(),
    bounds,
    widthTiles: W,
    heightTiles: H,
    scale: opts.scale,
    image: { png: pngName, width: imgW, height: imgH },
    settlementCellSize: SETTLEMENT_CELL_SIZE,
    settlements: settlements.map((s) => ({
      id: s.id,
      name: s.name,
      kind: s.kind,
      tileX: s.x,
      tileY: s.y,
      pixelX: (s.x - bounds.minX) * opts.scale,
      pixelY: (s.y - bounds.minY) * opts.scale,
    })),
  };
  fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2));

  if (opts.html) {
    fs.writeFileSync(
      path.join(opts.out, "map.html"),
      buildHtml({
        imgW,
        imgH,
        pngName,
        svgName,
        settlements: viewerSettlements,
        bounds,
        scale: opts.scale,
      }),
    );
  }

  // Quick cell-type summary near centre (debug aid).
  const midX = (bounds.minX + bounds.maxX) >> 1;
  const midY = (bounds.minY + bounds.maxY) >> 1;
  const cellOx =
    Math.floor(midX / SETTLEMENT_CELL_SIZE) * SETTLEMENT_CELL_SIZE;
  const cellOy =
    Math.floor(midY / SETTLEMENT_CELL_SIZE) * SETTLEMENT_CELL_SIZE;
  console.log(
    `Centre settlement cell (${cellOx},${cellOy}) type=${getSettlementType(cellOx, cellOy)}`,
  );
  console.log("Wrote", pngPath);
  console.log("Wrote", svgPath);
  console.log("Wrote", jsonPath);
  if (opts.html) console.log("Wrote", path.join(opts.out, "map.html"));
  console.log(
    `Done — open ${path.join(opts.out, "map.html")} for the interactive viewer.`,
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
