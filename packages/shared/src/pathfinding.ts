import { getBuildingAt, isWallTile, buildingEntryApproachCandidates, buildingEntranceSpan } from "./worldgen.js";
import { isInWorldBounds, type WorldBounds } from "./worldBounds.js";
import {
  canMoveInInterior,
  INTERIOR_WIDTH,
  INTERIOR_HEIGHT,
  type InteriorExit,
  type InteriorWallTile,
  type SearchableObject,
} from "./interior.js";

export type PathPoint = { x: number; y: number };

/**
 * Hard cap so a far click cannot stall the sim tick. Octile A* only needs a
 * band around the route, not the whole view square.
 */
const MAX_PATHFIND_NODES = 2800;

/**
 * Bidirectional reachability probe. Large enough to empty a sealed yard or
 * player compound, small enough that a long open-world click falls through
 * to A* instead of flooding first.
 */
const CONNECT_PROBE_MAX = 900;

/**
 * Tighter cap for zombie chase / wander (aggro is ~12 tiles).
 * Avoids burning the full player-view budget on every horde repath.
 */
export const ZOMBIE_PATHFIND_MAX_NODES = 900;

// Octile distance — admissible heuristic for 8-directional grids
function heuristic(ax: number, ay: number, bx: number, by: number): number {
  const dx = Math.abs(ax - bx);
  const dy = Math.abs(ay - by);
  return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
}

/**
 * A* pathfinding on an integer tile grid.
 *
 * isWalkable(tx, ty) receives INTEGER tile coordinates.
 * The goal tile may be unwalkable (e.g. a building wall the player wants to
 * enter); only intermediate tiles are required to be walkable.
 *
 * Returns an array of tile-centre positions {x: tx+0.5, y: ty+0.5}, or null
 * if no path was found within maxNodes explored nodes.
 *
 * Same-tile goals still return a single waypoint to the exact goal when the
 * start position is not already within PATH_ARRIVAL of it — otherwise a repath
 * after stepping onto the destination tile would clear the route and leave the
 * player stranded on the tile edge.
 */
/** Arrival distance matching server waypoint following. */
export const PATH_ARRIVAL = 0.08;

/** Node budget: linear in distance so a far building click cannot explode. */
export function pathfindMaxNodes(startX: number, startY: number, goalX: number, goalY: number): number {
  const dx = Math.abs(Math.floor(goalX) - Math.floor(startX));
  const dy = Math.abs(Math.floor(goalY) - Math.floor(startY));
  const chebyshev = Math.max(dx, dy);
  // Open terrain ~path length; cities need extra nodes to wrap footprints.
  return Math.min(MAX_PATHFIND_NODES, Math.max(500, chebyshev * 24 + 200));
}

/** Smaller A* budget for zombies — chase distance is short. */
export function zombiePathfindMaxNodes(
  startX: number,
  startY: number,
  goalX: number,
  goalY: number,
): number {
  const dx = Math.abs(Math.floor(goalX) - Math.floor(startX));
  const dy = Math.abs(Math.floor(goalY) - Math.floor(startY));
  const chebyshev = Math.max(dx, dy);
  return Math.min(
    ZOMBIE_PATHFIND_MAX_NODES,
    Math.max(120, (chebyshev + 6) * (chebyshev + 6)),
  );
}

function tileKey(x: number, y: number): string {
  return `${x},${y}`;
}

/** Worldgen walkability is expensive; cache it for one search. */
function memoWalkable(
  isWalkable: (tx: number, ty: number) => boolean,
): (tx: number, ty: number) => boolean {
  const cache = new Map<string, boolean>();
  return (tx, ty) => {
    const k = tileKey(tx, ty);
    const hit = cache.get(k);
    if (hit !== undefined) return hit;
    const v = isWalkable(tx, ty);
    cache.set(k, v);
    return v;
  };
}

type HeapNode = {
  k: string;
  tx: number;
  ty: number;
  f: number;
  g: number;
};

function heapPush(heap: HeapNode[], n: HeapNode): void {
  heap.push(n);
  let i = heap.length - 1;
  while (i > 0) {
    const p = (i - 1) >> 1;
    if (heap[p]!.f <= heap[i]!.f) break;
    const tmp = heap[p]!;
    heap[p] = heap[i]!;
    heap[i] = tmp;
    i = p;
  }
}

function heapPop(heap: HeapNode[]): HeapNode | undefined {
  const top = heap[0];
  if (!top) return undefined;
  const last = heap.pop()!;
  if (heap.length === 0) return top;
  heap[0] = last;
  let i = 0;
  const n = heap.length;
  while (true) {
    const l = i * 2 + 1;
    const r = l + 1;
    let s = i;
    if (l < n && heap[l]!.f < heap[s]!.f) s = l;
    if (r < n && heap[r]!.f < heap[s]!.f) s = r;
    if (s === i) break;
    const tmp = heap[s]!;
    heap[s] = heap[i]!;
    heap[i] = tmp;
    i = s;
  }
  return top;
}

/**
 * 8-way steps matching {@link findPath}: intermediates must be walkable, but
 * `allowUnwalkableKey` may be entered (building wall / closed door as a goal).
 * Diagonal steps cannot cut a solid corner.
 */
function forPathNeighbors(
  tx: number,
  ty: number,
  allowUnwalkableKey: string,
  isWalkable: (x: number, y: number) => boolean,
  visit: (nx: number, ny: number, nk: string) => void,
): void {
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (dx === 0 && dy === 0) continue;
      const nx = tx + dx;
      const ny = ty + dy;
      const nk = tileKey(nx, ny);
      if (nk !== allowUnwalkableKey && !isWalkable(nx, ny)) continue;
      if (dx !== 0 && dy !== 0) {
        if (!isWalkable(tx + dx, ty)) continue;
        if (!isWalkable(tx, ty + dy)) continue;
      }
      visit(nx, ny, nk);
    }
  }
}

/**
 * Bidirectional BFS reachability.
 * A sealed room (closed door, player walls, closed bargate) empties its
 * frontier quickly. Long open-world routes may hit the node budget before
 * the two searches meet; those stay `maybe` so A* can still find them.
 */
function walkableRegionsConnect(
  sTX: number,
  sTY: number,
  gTX: number,
  gTY: number,
  isWalkable: (tx: number, ty: number) => boolean,
  maxNodes: number,
): "yes" | "no" | "maybe" {
  const sKey = tileKey(sTX, sTY);
  const gKey = tileKey(gTX, gTY);
  if (sKey === gKey) return "yes";

  type Side = {
    visited: Set<string>;
    open: { x: number; y: number }[];
    head: number;
    allow: string;
  };
  const sides: [Side, Side] = [
    { visited: new Set([sKey]), open: [{ x: sTX, y: sTY }], head: 0, allow: gKey },
    { visited: new Set([gKey]), open: [{ x: gTX, y: gTY }], head: 0, allow: sKey },
  ];
  const pending = (s: Side) => s.open.length - s.head;

  let explored = 0;
  while (pending(sides[0]) > 0 && pending(sides[1]) > 0 && explored < maxNodes) {
    const i = pending(sides[0]) <= pending(sides[1]) ? 0 : 1;
    const side = sides[i]!;
    const other = sides[1 - i]!;
    const cur = side.open[side.head++]!;
    explored++;

    let met = false;
    forPathNeighbors(cur.x, cur.y, side.allow, isWalkable, (nx, ny, nk) => {
      if (met) return;
      if (other.visited.has(nk)) {
        met = true;
        return;
      }
      if (side.visited.has(nk)) return;
      side.visited.add(nk);
      side.open.push({ x: nx, y: ny });
    });
    if (met) return "yes";
  }

  if (pending(sides[0]) === 0 || pending(sides[1]) === 0) return "no";
  return "maybe";
}

export function findPath(
  startX: number,
  startY: number,
  goalX: number,
  goalY: number,
  isWalkable: (tx: number, ty: number) => boolean,
  maxNodes?: number,
): PathPoint[] | null {
  const sTX = Math.floor(startX);
  const sTY = Math.floor(startY);
  const gTX = Math.floor(goalX);
  const gTY = Math.floor(goalY);
  const limit = maxNodes ?? pathfindMaxNodes(startX, startY, goalX, goalY);
  const walkable = memoWalkable(isWalkable);

  if (sTX === gTX && sTY === gTY) {
    if (Math.hypot(startX - goalX, startY - goalY) >= PATH_ARRIVAL) {
      return [{ x: goalX, y: goalY }];
    }
    return [];
  }

  // Cheap sealed-room reject. Skip on short budgets (zombies / nearby clicks)
  // so we do not pay a full BFS before every A*.
  if (limit > ZOMBIE_PATHFIND_MAX_NODES) {
    const probe = Math.min(CONNECT_PROBE_MAX, limit);
    if (walkableRegionsConnect(sTX, sTY, gTX, gTY, walkable, probe) === "no") {
      return null;
    }
  }

  const startKey = tileKey(sTX, sTY);
  const goalKey = tileKey(gTX, gTY);

  const gScore = new Map<string, number>([[startKey, 0]]);
  const cameFrom = new Map<string, [number, number]>();
  const open: HeapNode[] = [];
  heapPush(open, {
    k: startKey,
    tx: sTX,
    ty: sTY,
    g: 0,
    f: heuristic(sTX, sTY, gTX, gTY),
  });

  let explored = 0;

  while (open.length > 0 && explored < limit) {
    const cur = heapPop(open);
    if (!cur) break;
    const bestG = gScore.get(cur.k) ?? Infinity;
    if (cur.g > bestG) continue;
    explored++;

    if (cur.k === goalKey) {
      const path: PathPoint[] = [];
      let tx = gTX;
      let ty = gTY;
      let steps = 0;
      const maxSteps = limit + 8;
      while (tileKey(tx, ty) !== startKey) {
        if (++steps > maxSteps) return null;
        const parent = cameFrom.get(tileKey(tx, ty));
        if (!parent) return null;
        path.unshift({ x: tx + 0.5, y: ty + 0.5 });
        [tx, ty] = parent;
      }
      return path;
    }

    forPathNeighbors(cur.tx, cur.ty, goalKey, walkable, (nx, ny, nk) => {
      const moveCost =
        nx !== cur.tx && ny !== cur.ty ? Math.SQRT2 : 1;
      const ng = cur.g + moveCost;
      if (ng >= (gScore.get(nk) ?? Infinity)) return;
      gScore.set(nk, ng);
      cameFrom.set(nk, [cur.tx, cur.ty]);
      heapPush(open, {
        k: nk,
        tx: nx,
        ty: ny,
        g: ng,
        f: ng + heuristic(nx, ny, gTX, gTY),
      });
    });
  }

  return null;
}

/**
 * When the player clicks a blocked tile (tree, fence, furniture, …), path to
 * the centre of the walkable neighbour facing them — not into the blocker.
 * Returns null if the tile is already walkable or no neighbour is free.
 */
export function blockedTileApproachGoal(
  startX: number,
  startY: number,
  blockTX: number,
  blockTY: number,
  isWalkable: (tx: number, ty: number) => boolean,
): PathPoint | null {
  if (isWalkable(blockTX, blockTY)) {
    return { x: blockTX + 0.5, y: blockTY + 0.5 };
  }

  const bx = blockTX + 0.5;
  const by = blockTY + 0.5;
  const toPlayerX = startX - bx;
  const toPlayerY = startY - by;

  const pickBest = (
    neighbors: { x: number; y: number }[],
  ): { x: number; y: number } | null => {
    let best: { x: number; y: number } | null = null;
    let bestScore = -Infinity;
    for (const n of neighbors) {
      if (!isWalkable(n.x, n.y)) continue;
      const nx = n.x + 0.5 - bx;
      const ny = n.y + 0.5 - by;
      // Prefer the side facing the player ("in front" of the blocker).
      const facing = nx * toPlayerX + ny * toPlayerY;
      const dist = Math.hypot(startX - (n.x + 0.5), startY - (n.y + 0.5));
      const score = facing * 10 - dist;
      if (score > bestScore) {
        bestScore = score;
        best = n;
      }
    }
    return best;
  };

  const approach =
    pickBest([
      { x: blockTX + 1, y: blockTY },
      { x: blockTX - 1, y: blockTY },
      { x: blockTX, y: blockTY + 1 },
      { x: blockTX, y: blockTY - 1 },
    ]) ??
    pickBest([
      { x: blockTX + 1, y: blockTY + 1 },
      { x: blockTX + 1, y: blockTY - 1 },
      { x: blockTX - 1, y: blockTY + 1 },
      { x: blockTX - 1, y: blockTY - 1 },
    ]);

  if (!approach) return null;
  return { x: approach.x + 0.5, y: approach.y + 0.5 };
}

/** Build a walkability predicate for the overworld tile grid. */
export function overworldWalkable(bounds: WorldBounds): (tx: number, ty: number) => boolean {
  return (tx, ty) =>
    isInWorldBounds(tx + 0.5, ty + 0.5, bounds) && !isWallTile(tx, ty);
}

/**
 * When the player clicks any wall tile of a building, path to the designated
 * entrance tile (not the clicked tile). Returns null if the click is not on a building.
 */
export function planBuildingEntryPath(
  startX: number,
  startY: number,
  clickTX: number,
  clickTY: number,
  walkable: (tx: number, ty: number) => boolean,
  maxNodes?: number,
): PathPoint[] | null {
  if (!isWallTile(clickTX, clickTY)) return null;
  const bld = getBuildingAt(clickTX, clickTY);
  if (!bld) return null;

  const { entranceX, entranceY } = bld;
  const span = buildingEntranceSpan(bld);
  const approachCandidates = buildingEntryApproachCandidates(bld);

  let bestApproach: { x: number; y: number } | null = null;
  let bestDist = Infinity;
  for (const c of approachCandidates) {
    if (!walkable(c.x, c.y)) continue;
    const d = Math.hypot(startX - (c.x + 0.5), startY - (c.y + 0.5));
    if (d < bestDist) {
      bestDist = d;
      bestApproach = c;
    }
  }

  if (!bestApproach) return null;

  const approachPath = findPath(
    startX,
    startY,
    bestApproach.x + 0.5,
    bestApproach.y + 0.5,
    walkable,
    maxNodes,
  );
  if (approachPath === null) return null;

  // Step onto the first doorway tile; span>1 doors still enter from the start cell.
  const faceIsSE = entranceX === bld.ox + bld.w - 1;
  const mid = (span - 1) * 0.5;
  approachPath.push({
    x: entranceX + 0.5 + (faceIsSE ? 0 : mid),
    y: entranceY + 0.5 + (faceIsSE ? mid : 0),
  });
  return approachPath;
}

/** Build a walkability predicate for an interior grid of given dimensions. */
export function interiorWalkable(
  furnitures: SearchableObject[],
  iW = INTERIOR_WIDTH,
  iH = INTERIOR_HEIGHT,
  exit?: InteriorExit,
  walls?: InteriorWallTile[],
): (tx: number, ty: number) => boolean {
  return (tx, ty) => {
    if (exit) {
      if (exit.face === "SE") {
        if (tx === exit.outsideX && ty >= exit.alongMin && ty <= exit.alongMax) {
          return true;
        }
      } else if (ty === exit.outsideY && tx >= exit.alongMin && tx <= exit.alongMax) {
        return true;
      }
    } else if (tx === iW && ty === 1) {
      return true;
    }
    return tx >= 0 && ty >= 0 && tx < iW && ty < iH &&
      canMoveInInterior(tx + 0.5, ty + 0.5, furnitures, iW, iH, exit, walls);
  };
}
