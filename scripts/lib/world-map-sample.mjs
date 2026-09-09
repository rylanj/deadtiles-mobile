/**
 * Shared strip sampler for render-world-map (main + worker_threads).
 * Each worker process/thread imports this separately → isolated worldgen caches.
 */
import {
  TileType,
  getBuildingAt,
  getStreetTileType,
  getStreetlightAt,
  getFenceAt,
  getTreeAt,
  isCarParkLotTile,
  preWarmForRender,
  evictDistantCells,
  settlementsInTileRegion,
} from "@zombie/shared";

export const KIND = {
  floor: 0,
  road: 1,
  pavement: 2,
  carpark: 3,
  building: 4,
  tree: 5,
  fence: 6,
  streetlight: 7,
};

export function classifyTile(tx, ty, fast) {
  if (getBuildingAt(tx, ty)) return KIND.building;

  const street = getStreetTileType(tx, ty);
  if (street !== null) {
    if (!fast && getStreetlightAt(tx, ty)) return KIND.streetlight;
    if (street === TileType.Pavement) return KIND.pavement;
    return KIND.road;
  }

  if (!fast) {
    if (getFenceAt(tx, ty)) return KIND.fence;
    if (getTreeAt(tx, ty)) return KIND.tree;
  }

  if (isCarParkLotTile(tx, ty)) return KIND.carpark;
  return KIND.floor;
}

/**
 * Sample an inclusive tile rectangle. Returns a packed Uint8Array of kinds
 * sized (maxX-minX+1) * (maxY-minY+1), row-major.
 */
export function sampleStrip(job) {
  const {
    minX,
    maxX,
    minY,
    maxY,
    fast = false,
    chunk = 192,
    onProgress,
  } = job;

  const stripW = maxX - minX + 1;
  const stripH = maxY - minY + 1;
  const kinds = new Uint8Array(stripW * stripH);
  const settlementById = new Map();

  const half = (chunk / 2) | 0;
  const evictDist = chunk + 450;

  let sampled = 0;
  const chunks = [];
  for (let y0 = minY; y0 <= maxY; y0 += chunk) {
    for (let x0 = minX; x0 <= maxX; x0 += chunk) {
      const x1 = Math.min(maxX, x0 + chunk - 1);
      const y1 = Math.min(maxY, y0 + chunk - 1);
      chunks.push({
        x0,
        y0,
        x1,
        y1,
        cx: (x0 + x1) >> 1,
        cy: (y0 + y1) >> 1,
      });
    }
  }

  for (let ci = 0; ci < chunks.length; ci++) {
    const c = chunks[ci];
    preWarmForRender(c.cx, c.cy, half + 8);

    for (let ty = c.y0; ty <= c.y1; ty++) {
      const row = (ty - minY) * stripW;
      for (let tx = c.x0; tx <= c.x1; tx++) {
        kinds[row + (tx - minX)] = classifyTile(tx, ty, fast);
        sampled++;
      }
    }

    for (const s of settlementsInTileRegion(c.x0, c.x1, c.y0, c.y1)) {
      if (!settlementById.has(s.id)) settlementById.set(s.id, s);
    }

    evictDistantCells(c.cx, c.cy, evictDist);

    if (onProgress) {
      onProgress({
        chunkIndex: ci + 1,
        chunkTotal: chunks.length,
        sampled,
      });
    }
  }

  return {
    kinds,
    minX,
    maxX,
    minY,
    maxY,
    sampled,
    settlements: [...settlementById.values()],
  };
}
