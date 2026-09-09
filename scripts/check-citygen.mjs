// Sanity checks for the type-first city generation rewrite.
// Run: node scripts/check-citygen.mjs
import {
  SETTLEMENT_CELL_SIZE,
  CITY_BUILDING_SPECS,
  getSettlementType,
  getBuildingAt,
  getBuildingsNearTile,
  getStreetTileType,
  isWalkableTile,
  buildingEntryApproachCandidates,
  buildingEntranceFace,
  TileType,
} from "../packages/shared/dist/index.js";

const CELL = SETTLEMENT_CELL_SIZE;

// Find some cities near the origin.
const cities = [];
for (let cx = -40; cx <= 40 && cities.length < 6; cx++) {
  for (let cy = -40; cy <= 40 && cities.length < 6; cy++) {
    if (getSettlementType(cx * CELL, cy * CELL) === "city") {
      cities.push({ cx: cx * CELL, cy: cy * CELL });
    }
  }
}
console.log(`Found ${cities.length} cities`);

let failures = 0;
const fail = (msg) => { failures++; console.log("FAIL:", msg); };

for (const { cx, cy } of cities) {
  // Collect unique buildings by scanning a wide area around the city cell.
  const seen = new Map();
  for (let ty = cy - 200; ty < cy + 300; ty += 4) {
    for (let tx = cx - 200; tx < cx + 300; tx += 4) {
      for (const b of getBuildingsNearTile(tx, ty, 4)) {
        seen.set(`${b.ox},${b.oy}`, b);
      }
    }
  }
  const buildings = [...seen.values()];
  const counts = {};
  for (const b of buildings) counts[b.buildingType] = (counts[b.buildingType] ?? 0) + 1;
  console.log(`\nCity @ ${cx},${cy}: ${buildings.length} buildings`, counts);

  // 1. No overlaps.
  for (let i = 0; i < buildings.length; i++) {
    for (let j = i + 1; j < buildings.length; j++) {
      const a = buildings[i], b = buildings[j];
      if (a.ox < b.ox + b.w && a.ox + a.w > b.ox && a.oy < b.oy + b.h && a.oy + a.h > b.oy) {
        fail(`overlap ${a.buildingType}@${a.ox},${a.oy} vs ${b.buildingType}@${b.ox},${b.oy}`);
      }
    }
  }

  for (const b of buildings) {
    const spec = CITY_BUILDING_SPECS[b.buildingType];

    // 2. Footprint never on a street.
    for (let tx = b.ox; tx < b.ox + b.w; tx++) {
      for (let ty = b.oy; ty < b.oy + b.h; ty++) {
        if (getStreetTileType(tx, ty) !== null) {
          fail(`${b.buildingType}@${b.ox},${b.oy} covers street tile ${tx},${ty}`);
          tx = b.ox + b.w; break;
        }
      }
    }

    // 3. Entrance on perimeter with a visible face and a walkable approach.
    const face = buildingEntranceFace(b);
    const span = Math.max(1, b.entranceSpan ?? 1);
    const onEast =
      b.entranceX === b.ox + b.w - 1 &&
      b.entranceY >= b.oy &&
      b.entranceY + span <= b.oy + b.h;
    const onSouth =
      b.entranceY === b.oy + b.h - 1 &&
      b.entranceX >= b.ox &&
      b.entranceX + span <= b.ox + b.w;
    if (!onEast && !onSouth) fail(`${b.buildingType}@${b.ox},${b.oy} entrance not on E/S perimeter`);
    if (face === "SE" && !onEast) fail(`${b.buildingType}@${b.ox},${b.oy} face SE but not east wall`);
    if (spec?.doorSpan && span !== spec.doorSpan) {
      fail(`${b.buildingType}@${b.ox},${b.oy} entranceSpan ${span}, expected ${spec.doorSpan}`);
    }
    const candidates = buildingEntryApproachCandidates(b);
    if (!candidates.some((c) => isWalkableTile(c.x, c.y))) {
      fail(`${b.buildingType}@${b.ox},${b.oy} has no walkable entry approach`);
    }

    // 4. Primary approach tile must be pavement. Commercial types only exist
    //    on city grids → hard requirement; houses also spawn in rural cells /
    //    arterial towns picked up by this scan, so they are reported only.
    const primary = face === "SE"
      ? { x: b.entranceX + 1, y: b.entranceY }
      : { x: b.entranceX, y: b.entranceY + 1 };
    const street = getStreetTileType(primary.x, primary.y);
    b._pavement = street === TileType.Pavement;
    if (b.buildingType !== "house" && !b._pavement) {
      fail(`${b.buildingType}@${b.ox},${b.oy} approach ${primary.x},${primary.y} not pavement (got ${street})`);
    }

    // 5. Levels within spec.
    if (spec && (b.exteriorLevels < spec.minLevels || b.exteriorLevels > spec.maxLevels)) {
      fail(`${b.buildingType}@${b.ox},${b.oy} levels ${b.exteriorLevels} outside spec`);
    }

    // 6. House doors inset from corners.
    if (b.buildingType === "house") {
      if (face === "SE" && (b.entranceY === b.oy || b.entranceY === b.oy + b.h - 1)) {
        fail(`house@${b.ox},${b.oy} SE door on corner`);
      }
      if (face === "SW" && (b.entranceX === b.ox || b.entranceX === b.ox + b.w - 1)) {
        fail(`house@${b.ox},${b.oy} SW door on corner`);
      }
    }

    // 6b. Police stations: fixed 7×7, 2 storeys, door centered on the face.
    if (b.buildingType === "police_station") {
      if (b.w !== 7 || b.h !== 7) {
        fail(`police_station@${b.ox},${b.oy} footprint ${b.w}x${b.h}, expected 7x7`);
      }
      if (b.exteriorLevels !== 2) {
        fail(`police_station@${b.ox},${b.oy} levels ${b.exteriorLevels}, expected 2`);
      }
      const midY = b.oy + Math.floor((b.h - 1) / 2);
      const midX = b.ox + Math.floor((b.w - 1) / 2);
      if (face === "SE" && b.entranceY !== midY) {
        fail(`police_station@${b.ox},${b.oy} SE door not centered`);
      }
      if (face === "SW" && b.entranceX !== midX) {
        fail(`police_station@${b.ox},${b.oy} SW door not centered`);
      }
    }

    // 7. getBuildingAt consistency (collision source of truth).
    const hit = getBuildingAt(b.ox, b.oy);
    if (!hit || hit.ox !== b.ox || hit.oy !== b.oy) {
      fail(`getBuildingAt mismatch for ${b.buildingType}@${b.ox},${b.oy}`);
    }
  }

  // Caps.
  for (const [type, spec] of Object.entries(CITY_BUILDING_SPECS)) {
    if (!Number.isFinite(spec.maxPerCity)) continue;
    // Arterial towns of neighbouring cities can add houses but not capped types;
    // this scan may include a neighbouring town though, so this is a soft check.
    if ((counts[type] ?? 0) > spec.maxPerCity) {
      fail(`cap exceeded for ${type}: ${counts[type]} > ${spec.maxPerCity}`);
    }
  }

  const pav = buildings.filter((b) => b._pavement).length;
  console.log(`  pavement-approach entrances: ${pav}/${buildings.length}`);
}

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
