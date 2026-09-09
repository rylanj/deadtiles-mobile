// Line-of-sight check for player-built / admin structures.
//
// Placed walls and closed doors are not part of procedural worldgen, so the
// combat rays cannot discover them from the tile grid — callers pass them in as
// `blocksSightAt`. This exercises the real shared functions (from
// packages/shared/dist, so run after a build) to pin the behaviour down:
// blocked shots and sight through solid tiles, open doorways still clear, and
// the shooter's own tile never stopping their own shot.
//
//   npm run build && node scripts/check-structure-los.mjs

import {
  fireRaycast,
  hasEntityLineOfSight,
  INITIAL_WORLD_BOUNDS,
  isBuildingTile,
  WEAPONS,
} from "../packages/shared/dist/index.js";

const weapon = WEAPONS.find((w) => w.range >= 8 && w.damage > 0);
if (!weapon) throw new Error("no ranged weapon found in WEAPONS");

/** Open ground with no procedural building on the shot line. */
function findClearRow(span) {
  for (let y = 0; y < 400; y++) {
    for (let x = 0; x < 400; x++) {
      let clear = true;
      for (let i = -1; i <= span + 1; i++) {
        if (isBuildingTile(x + i, y)) {
          clear = false;
          break;
        }
      }
      if (clear) return { x, y };
    }
  }
  throw new Error("no clear row found");
}

const SPAN = 6;
const origin = findClearRow(SPAN);
const shooter = { x: origin.x + 0.5, y: origin.y + 0.5 };
const target = {
  id: "z1",
  x: origin.x + SPAN + 0.5,
  y: origin.y + 0.5,
  health: 100,
  isDead: false,
};
/** Tile mid-way along the shot line, where the test structure sits. */
const midTX = origin.x + 3;
const midTY = origin.y;

const blockerAt = (tiles) => (tx, ty) => tiles.has(`${tx},${ty}`);

function shotHits(blocked) {
  const result = fireRaycast({
    originX: shooter.x,
    originY: shooter.y,
    targetX: target.x,
    targetY: target.y,
    weapon,
    inInterior: false,
    bounds: INITIAL_WORLD_BOUNDS,
    targets: [target],
    requiredTargetId: target.id,
    blocksSightAt: blocked ? blockerAt(blocked) : undefined,
  });
  return result.kind === "impact" && result.hitTargetId === target.id;
}

function sees(blocked) {
  return hasEntityLineOfSight({
    fromX: shooter.x,
    fromY: shooter.y,
    toX: target.x,
    toY: target.y,
    inInterior: false,
    blocksSightAt: blocked ? blockerAt(blocked) : undefined,
  });
}

const wall = new Set([`${midTX},${midTY}`]);
const openDoorway = new Set(); // an open door is simply absent from the set
const onShooterTile = new Set([`${origin.x},${origin.y}`]);
const onTargetTile = new Set([`${origin.x + SPAN},${origin.y}`]);

const cases = [
  ["shot reaches target across open ground", () => shotHits(null) === true],
  ["shot reaches target with an empty blocker set", () => shotHits(new Set()) === true],
  ["placed wall blocks the shot", () => shotHits(wall) === false],
  ["open doorway does not block the shot", () => shotHits(openDoorway) === true],
  [
    "a blocker on the shooter's own tile does not block their shot",
    () => shotHits(onShooterTile) === true,
  ],
  ["zombie sees target across open ground", () => sees(null) === true],
  ["placed wall blocks zombie sight", () => sees(wall) === false],
  ["open doorway does not block zombie sight", () => sees(openDoorway) === true],
  [
    "a blocker on either endpoint tile does not block sight",
    () => sees(onShooterTile) === true && sees(onTargetTile) === true,
  ],
];

let failed = 0;
console.log(`weapon: ${weapon.name ?? weapon.id ?? "?"} (range ${weapon.range})`);
console.log(`shot line: (${shooter.x}, ${shooter.y}) -> (${target.x}, ${target.y})`);
console.log(`structure tile: (${midTX}, ${midTY})\n`);
for (const [name, fn] of cases) {
  let ok = false;
  let err = "";
  try {
    ok = fn();
  } catch (e) {
    err = ` (${e.message})`;
  }
  if (!ok) failed++;
  console.log(`${ok ? "OK  " : "FAIL"} ${name}${err}`);
}

console.log(`\n${cases.length - failed}/${cases.length} passed`);
if (failed) process.exitCode = 1;
