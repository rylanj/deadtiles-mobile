/**
 * Verify city arterial connectivity.
 *
 * Usage: node scripts/check-city-connectivity.mjs [cellRadius]
 *   cellRadius = settlement cells from origin to scan (default 40)
 *
 * Reports:
 *   - orphan cities (zero arterial links anywhere)
 *   - how many in-region cities are reachable from Birchport (or the
 *     in-region city closest to origin) by following arterials
 */
import {
  SETTLEMENT_CELL_SIZE,
  getSettlementType,
  getCityName,
  getCityRoadLinks,
  PLAYER_SPAWN_HUB_NAME,
} from "@zombie/shared";

const CELL = SETTLEMENT_CELL_SIZE;
const cellRadius = Math.max(5, Number(process.argv[2]) || 40);

const cities = [];
for (let ix = -cellRadius; ix <= cellRadius; ix++) {
  for (let iy = -cellRadius; iy <= cellRadius; iy++) {
    const cx = ix * CELL;
    const cy = iy * CELL;
    if (getSettlementType(cx, cy) === "city") {
      cities.push({ cx, cy, name: getCityName(cx, cy) });
    }
  }
}

console.log(
  `Scanned ±${cellRadius} cells → ${cities.length} cities`,
);

const key = (c) => `${c.cx}:${c.cy}`;
const inRegion = new Set(cities.map(key));

const orphans = [];
for (const c of cities) {
  if (getCityRoadLinks(c.cx, c.cy).length === 0) orphans.push(c);
}

if (orphans.length) {
  console.log(`ORPHANS (${orphans.length}):`);
  for (const o of orphans) {
    console.log(`  - ${o.name} at cell (${o.cx},${o.cy})`);
  }
} else {
  console.log("No orphan cities — every city has ≥1 arterial link.");
}

let start =
  cities.find((c) => c.name === PLAYER_SPAWN_HUB_NAME) ??
  cities.slice().sort((a, b) => {
    const da = a.cx * a.cx + a.cy * a.cy;
    const db = b.cx * b.cx + b.cy * b.cy;
    return da - db;
  })[0];

if (!start) {
  console.log("No cities in region.");
  process.exit(orphans.length ? 1 : 0);
}

// BFS following live links (may leave the scanned rectangle).
const seen = new Set([key(start)]);
const queue = [start];
let visited = 0;
const MAX_VISIT = 20_000;
while (queue.length && visited < MAX_VISIT) {
  const c = queue.shift();
  visited++;
  for (const n of getCityRoadLinks(c.cx, c.cy)) {
    const k = key(n);
    if (seen.has(k)) continue;
    seen.add(k);
    queue.push({ cx: n.cx, cy: n.cy, name: getCityName(n.cx, n.cy) });
  }
}

let reachableInRegion = 0;
const unreachable = [];
for (const c of cities) {
  if (seen.has(key(c))) reachableInRegion++;
  else unreachable.push(c);
}

console.log(
  `From ${start.name}: visited ${seen.size} cities (cap ${MAX_VISIT}); ` +
    `${reachableInRegion}/${cities.length} in-region reachable`,
);

if (unreachable.length) {
  console.log(`Unreachable in-region (${unreachable.length}):`);
  for (const u of unreachable.slice(0, 12)) {
    const links = getCityRoadLinks(u.cx, u.cy);
    console.log(
      `  - ${u.name} (${u.cx},${u.cy}) links=${links.length}`,
    );
  }
}

for (const want of ["Whiteview", "Lake Silverbridge"]) {
  const hit = cities.find((c) => c.name === want);
  if (!hit) continue;
  const links = getCityRoadLinks(hit.cx, hit.cy);
  console.log(
    `${want}: ${seen.has(key(hit)) ? "reachable" : "UNREACHABLE"} · links: ` +
      (links
        .map((n) => getCityName(n.cx, n.cy))
        .join(", ") || "(none)"),
  );
}

const ok = orphans.length === 0 && unreachable.length === 0;
process.exit(ok ? 0 : 1);
