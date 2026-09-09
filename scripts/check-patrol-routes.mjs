/**
 * Replays the server patrol tick against real worldgen so a stalled Birchport
 * patrol shows up here instead of in game. Fails if any route idles for longer
 * than STALL_LIMIT_S, which is what "walks a few tiles then stops forever"
 * looks like offline.
 *
 * Run: node scripts/check-patrol-routes.mjs
 */
import {
  birchportBarracksYardPerimeterWaypoints,
  birchportStreetCoverageRoutes,
  getStreetTileType,
  isWallTile,
  worldChainlinkOccupiesTile,
  findPath,
  GUARD_SPEED,
  GUARD_PAIR_LATERAL_OFFSET,
} from "../packages/shared/dist/index.js";

// Mirrors of the server constants in systems/simulation.ts.
const WAYPOINT_ARRIVAL = 0.08;
const GUARD_WAYPOINT_ARRIVE = 0.35;
const GUARD_PATROL_STUCK_SKIP_TICKS = 30;

const SIM_SECONDS = 400;
const DT = 0.05;
const STALL_LIMIT_S = 3;

function tileOk(tx, ty, streetOnly) {
  if (worldChainlinkOccupiesTile(tx, ty)) return false;
  if (isWallTile(tx, ty)) return false;
  if (streetOnly && getStreetTileType(tx, ty) == null) return false;
  return true;
}

const makeCanMove = (streetOnly) => (x, y) =>
  tileOk(Math.floor(x), Math.floor(y), streetOnly);

const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
const tileCenter = (x, y) => ({ x: Math.floor(x) + 0.5, y: Math.floor(y) + 0.5 });

function snapGoal(x, y, canMove, maxRadius = 8) {
  const goal = tileCenter(x, y);
  if (canMove(goal.x, goal.y)) return goal;
  const tx = Math.floor(goal.x);
  const ty = Math.floor(goal.y);
  for (let r = 1; r <= maxRadius; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (canMove(tx + dx + 0.5, ty + dy + 0.5)) {
          return { x: tx + dx + 0.5, y: ty + dy + 0.5 };
        }
      }
    }
  }
  return goal;
}

function advanceWaypoint(state, waypoints) {
  const idx = state.patrolWaypointIndex;
  if (state.walkingToB) {
    if (idx < waypoints.length - 1) state.patrolWaypointIndex = idx + 1;
    else {
      state.walkingToB = false;
      state.patrolWaypointIndex = Math.max(0, waypoints.length - 2);
    }
  } else if (idx > 0) {
    state.patrolWaypointIndex = idx - 1;
  } else {
    state.walkingToB = true;
    state.patrolWaypointIndex = Math.min(1, waypoints.length - 1);
  }
}

function moveWithCollision(sim, nx, ny, canMove) {
  if (canMove(nx, ny)) {
    sim.x = nx;
    sim.y = ny;
    return true;
  }
  if (canMove(nx, sim.y)) {
    sim.x = nx;
    return true;
  }
  if (canMove(sim.x, ny)) {
    sim.y = ny;
    return true;
  }
  return false;
}

function ensurePath(sim, gx, gy, canMove, stats) {
  const goal = tileCenter(gx, gy);
  const last = sim.path[sim.path.length - 1];
  if (
    last &&
    Math.floor(last.x) === Math.floor(goal.x) &&
    Math.floor(last.y) === Math.floor(goal.y)
  ) {
    return;
  }
  if (
    Math.floor(sim.x) === Math.floor(goal.x) &&
    Math.floor(sim.y) === Math.floor(goal.y)
  ) {
    sim.path =
      dist(sim.x, sim.y, goal.x, goal.y) >= WAYPOINT_ARRIVAL
        ? [{ x: goal.x, y: goal.y }]
        : [];
    return;
  }
  const path = findPath(sim.x, sim.y, goal.x, goal.y, (tx, ty) =>
    canMove(tx + 0.5, ty + 0.5),
  );
  if (path === null) {
    stats.pathFail++;
    sim.path = [];
    return;
  }
  sim.path = path;
}

function followPath(sim, dt, canMove) {
  while (
    sim.path.length > 0 &&
    dist(sim.x, sim.y, sim.path[0].x, sim.path[0].y) < WAYPOINT_ARRIVAL
  ) {
    sim.path.shift();
  }
  if (sim.path.length === 0) return;
  const next = sim.path[0];
  const d = dist(sim.x, sim.y, next.x, next.y);
  if (d < 1e-6) {
    sim.path.shift();
    return;
  }
  const step = Math.min(sim.speed * dt, d);
  const nx = sim.x + ((next.x - sim.x) / d) * step;
  const ny = sim.y + ((next.y - sim.y) / d) * step;
  if (!moveWithCollision(sim, nx, ny, canMove)) sim.path = [];
}

function tickPatrol(sim, state, dt, canMove, stats) {
  const waypoints = sim.patrolWaypoints;
  let idx = state.patrolWaypointIndex;
  if (idx < 0 || idx >= waypoints.length) {
    idx = state.walkingToB ? waypoints.length - 1 : 0;
    state.patrolWaypointIndex = idx;
  }
  let { x: tx, y: ty } = waypoints[idx];
  if (dist(sim.x, sim.y, tx, ty) < GUARD_WAYPOINT_ARRIVE) {
    advanceWaypoint(state, waypoints);
    sim.path = [];
    ({ x: tx, y: ty } = waypoints[state.patrolWaypointIndex]);
  }

  const goal = snapGoal(tx, ty, canMove);
  ensurePath(sim, goal.x, goal.y, canMove, stats);

  // Waypoint reached at its tile centre (see tickGuardPatrol).
  if (
    sim.path.length === 0 &&
    dist(sim.x, sim.y, goal.x, goal.y) < GUARD_WAYPOINT_ARRIVE &&
    dist(sim.x, sim.y, tx, ty) >= GUARD_WAYPOINT_ARRIVE
  ) {
    stats.centreArrivals++;
    sim.patrolStuckTicks = 0;
    advanceWaypoint(state, waypoints);
    sim.path = [];
    return;
  }

  if (sim.path.length === 0 && dist(sim.x, sim.y, goal.x, goal.y) >= GUARD_WAYPOINT_ARRIVE) {
    sim.patrolStuckTicks += 1;
    stats.stuckTicks++;
    if (!canMove(goal.x, goal.y) || sim.patrolStuckTicks >= GUARD_PATROL_STUCK_SKIP_TICKS) {
      sim.patrolStuckTicks = 0;
      stats.skips++;
      advanceWaypoint(state, waypoints);
    }
    return;
  }

  sim.patrolStuckTicks = 0;
  followPath(sim, dt, canMove);
}

let failures = 0;

function run(label, waypoints, streetOnly) {
  if (waypoints.length < 2) {
    console.log(`FAIL ${label}: only ${waypoints.length} waypoint(s)`);
    failures++;
    return;
  }
  const canMove = makeCanMove(streetOnly);
  const sim = {
    x: waypoints[0].x,
    y: waypoints[0].y,
    speed: GUARD_SPEED,
    path: [],
    patrolWaypoints: waypoints.map((w) => ({ x: w.x, y: w.y })),
    patrolStuckTicks: 0,
  };
  const state = { patrolWaypointIndex: 1, walkingToB: true };
  const stats = { pathFail: 0, stuckTicks: 0, skips: 0, centreArrivals: 0 };

  const ticks = Math.round(SIM_SECONDS / DT);
  let travelled = 0;
  let longestIdle = 0;
  let idleRun = 0;
  let minIdx = 1;
  let maxIdx = 1;
  for (let t = 0; t < ticks; t++) {
    const px = sim.x;
    const py = sim.y;
    tickPatrol(sim, state, DT, canMove, stats);
    if (Math.hypot(sim.x - px, sim.y - py) > 0.001) {
      travelled += Math.hypot(sim.x - px, sim.y - py);
      idleRun = 0;
    } else if (++idleRun > longestIdle) {
      longestIdle = idleRun;
    }
    minIdx = Math.min(minIdx, state.patrolWaypointIndex);
    maxIdx = Math.max(maxIdx, state.patrolWaypointIndex);
  }

  const maxIdleS = longestIdle * DT;
  const ok = maxIdleS <= STALL_LIMIT_S;
  if (!ok) failures++;
  console.log(
    `${ok ? "ok  " : "FAIL"} ${label}: wps=${waypoints.length} ` +
      `walked=${travelled.toFixed(0)} tiles over ${SIM_SECONDS}s ` +
      `reached=${minIdx}..${maxIdx} maxIdle=${maxIdleS.toFixed(1)}s ` +
      `pathFail=${stats.pathFail} stuckTicks=${stats.stuckTicks} skips=${stats.skips}`,
  );
}

// Barracks yard: gravel, so the guard must not be street-locked.
run("barracks yard perimeter", birchportBarracksYardPerimeterWaypoints(), false);

// Street pairs walk lane-offset copies of each coverage centreline.
function offsetLane(waypoints, lateral) {
  const isH = (a, b) => Math.abs(b.x - a.x) >= Math.abs(b.y - a.y);
  const at = (p, h) => (h ? { x: p.x, y: p.y + lateral } : { x: p.x + lateral, y: p.y });
  const out = [];
  const push = (p) => {
    const last = out[out.length - 1];
    if (!last || Math.hypot(p.x - last.x, p.y - last.y) > 0.05) out.push(p);
  };
  push(at(waypoints[0], isH(waypoints[0], waypoints[1])));
  for (let i = 1; i < waypoints.length - 1; i++) {
    const inH = isH(waypoints[i - 1], waypoints[i]);
    const outH = isH(waypoints[i], waypoints[i + 1]);
    push(at(waypoints[i], inH));
    if (inH !== outH) push(at(waypoints[i], outH));
  }
  const n = waypoints.length - 1;
  push(at(waypoints[n], isH(waypoints[n - 1], waypoints[n])));
  return out;
}

function snapToStreet(waypoints) {
  return waypoints.map((w) => {
    const tx0 = Math.floor(w.x);
    const ty0 = Math.floor(w.y);
    if (getStreetTileType(tx0, ty0) != null && !isWallTile(tx0, ty0)) return w;
    for (let r = 1; r <= 8; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const tx = tx0 + dx;
          const ty = ty0 + dy;
          if (getStreetTileType(tx, ty) == null || isWallTile(tx, ty)) continue;
          return { x: tx + 0.5, y: ty + 0.5 };
        }
      }
    }
    return w;
  });
}

for (const route of birchportStreetCoverageRoutes()) {
  const centre = route.waypoints.map((w) => ({ x: w.x, y: w.y }));
  for (const [side, lateral] of [
    ["left", -GUARD_PAIR_LATERAL_OFFSET],
    ["right", GUARD_PAIR_LATERAL_OFFSET],
  ]) {
    run(`${route.routeKey} ${side} lane`, snapToStreet(offsetLane(centre, lateral)), true);
  }
}

if (failures > 0) {
  console.error(`\n${failures} patrol route(s) stall.`);
  process.exit(1);
}
console.log("\nAll patrol routes keep moving.");
