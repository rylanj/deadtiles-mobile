/**
 * Flood-fill tiles reachable from exterior seeds without crossing seal barriers.
 * Used so zombies never spawn inside player-sealed compounds (walls/doors).
 * 8-connected to match pathfinding adjacency.
 */

const NEIGHBOR_DELTAS: readonly [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

export type ExteriorFloodOpts = {
  minTX: number;
  minTY: number;
  maxTX: number;
  maxTY: number;
  /** True when the tile cannot be entered for seal flood (walls, doors, fireplaces, …). */
  isSealBlocked: (tx: number, ty: number) => boolean;
  /** Optional seeds; defaults to the walkable perimeter of the bounds. */
  seeds?: ReadonlyArray<{ x: number; y: number }>;
};

/** Tile keys `"tx,ty"` reachable from exterior seeds without crossing seal blockers. */
export function floodExteriorReachableTiles(opts: ExteriorFloodOpts): Set<string> {
  const { minTX, minTY, maxTX, maxTY, isSealBlocked } = opts;
  if (maxTX < minTX || maxTY < minTY) return new Set();

  const width = maxTX - minTX + 1;
  const height = maxTY - minTY + 1;
  const blocked = new Uint8Array(width * height);
  for (let ty = minTY; ty <= maxTY; ty++) {
    const row = (ty - minTY) * width;
    for (let tx = minTX; tx <= maxTX; tx++) {
      if (isSealBlocked(tx, ty)) blocked[row + (tx - minTX)] = 1;
    }
  }

  const seedLocal = opts.seeds?.map((s) => ({
    x: s.x - minTX,
    y: s.y - minTY,
  }));
  const mask = floodExteriorReachableMask(width, height, blocked, seedLocal);

  const reachable = new Set<string>();
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] !== 1) continue;
    const lx = i % width;
    const ly = (i - lx) / width;
    reachable.add(`${minTX + lx},${minTY + ly}`);
  }
  return reachable;
}

/**
 * Fast exterior flood on a precomputed blocked grid.
 * `blocked[y * width + x] !== 0` ⇒ impassable.
 * Returns a mask of the same size: `1` = exterior-reachable, `0` otherwise.
 *
 * Optional `seeds` are local (0-based) coordinates; default = rectangle perimeter.
 */
export function floodExteriorReachableMask(
  width: number,
  height: number,
  blocked: Uint8Array,
  seeds?: ReadonlyArray<{ x: number; y: number }>,
): Uint8Array {
  const exterior = new Uint8Array(width * height);
  if (width <= 0 || height <= 0) return exterior;

  const idx = (x: number, y: number) => y * width + x;
  const blockedAt = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return true;
    return blocked[idx(x, y)] !== 0;
  };

  const queueX: number[] = [];
  const queueY: number[] = [];

  const trySeed = (x: number, y: number) => {
    if (blockedAt(x, y)) return;
    const i = idx(x, y);
    if (exterior[i] !== 0) return;
    exterior[i] = 1;
    queueX.push(x);
    queueY.push(y);
  };

  if (seeds && seeds.length > 0) {
    for (const s of seeds) trySeed(s.x, s.y);
  } else {
    for (let x = 0; x < width; x++) {
      trySeed(x, 0);
      if (height > 1) trySeed(x, height - 1);
    }
    for (let y = 1; y < height - 1; y++) {
      trySeed(0, y);
      if (width > 1) trySeed(width - 1, y);
    }
  }

  let head = 0;
  while (head < queueX.length) {
    const cx = queueX[head]!;
    const cy = queueY[head]!;
    head++;
    for (const [dx, dy] of NEIGHBOR_DELTAS) {
      if (dx !== 0 && dy !== 0) {
        if (blockedAt(cx + dx, cy) || blockedAt(cx, cy + dy)) continue;
      }
      const nx = cx + dx;
      const ny = cy + dy;
      if (blockedAt(nx, ny)) continue;
      const i = idx(nx, ny);
      if (exterior[i] !== 0) continue;
      exterior[i] = 1;
      queueX.push(nx);
      queueY.push(ny);
    }
  }

  return exterior;
}
