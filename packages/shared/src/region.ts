/**
 * Shared region key space and lifecycle tiers.
 *
 * The same 96-tile grid was previously addressed two incompatible ways:
 * settlement cells keyed on tile origin ("96:192") while zombie zones keyed on
 * zone index ("1:2"). Nothing could reason about "is this area occupied?"
 * across both, so client streaming and server simulation drifted apart and
 * neither could tell whether work was still needed.
 *
 * This module is the single authority. Client and server feed it different
 * radii (the client uses its camera view rect, the server uses
 * PLAYER_VIEW_RADIUS) but share the key space, distance maths and hysteresis.
 */

/**
 * Tiles per region side. Regions are exactly settlement cells and exactly
 * server zombie zones, so worldgen caches and simulation zones map 1:1.
 *
 * This module owns the value (worldgen derives SETTLEMENT_CELL from it) so the
 * two key spaces cannot drift apart again.
 */
export const REGION_SIZE = 96;

/** Index-space key, e.g. tile (100, 200) → "1:2". Matches zombie zone keys. */
export type RegionKey = string;

/** Tile-origin key, e.g. "96:192". Matches settlement cell cache keys. */
export type RegionOriginKey = string;

export type RegionCoord = { rx: number; ry: number };

export function regionIndexAt(tx: number, ty: number): RegionCoord {
  return {
    rx: Math.floor(tx / REGION_SIZE),
    ry: Math.floor(ty / REGION_SIZE),
  };
}

export function regionKey(rx: number, ry: number): RegionKey {
  return `${rx}:${ry}`;
}

export function regionKeyAt(tx: number, ty: number): RegionKey {
  const { rx, ry } = regionIndexAt(tx, ty);
  return regionKey(rx, ry);
}

export function parseRegionKey(key: RegionKey): RegionCoord {
  const colon = key.indexOf(":");
  return {
    rx: parseInt(key.slice(0, colon), 10),
    ry: parseInt(key.slice(colon + 1), 10),
  };
}

/** Tile-space origin (top-left) of a region index. */
export function regionOrigin(rx: number, ry: number): { cx: number; cy: number } {
  return { cx: rx * REGION_SIZE, cy: ry * REGION_SIZE };
}

export function regionOriginKey(rx: number, ry: number): RegionOriginKey {
  return `${rx * REGION_SIZE}:${ry * REGION_SIZE}`;
}

export function regionOriginKeyAt(tx: number, ty: number): RegionOriginKey {
  const { rx, ry } = regionIndexAt(tx, ty);
  return regionOriginKey(rx, ry);
}

/** Convert a settlement-cell origin key ("96:192") to an index key ("1:2"). */
export function originKeyToRegionKey(key: RegionOriginKey): RegionKey {
  const colon = key.indexOf(":");
  const cx = parseInt(key.slice(0, colon), 10);
  const cy = parseInt(key.slice(colon + 1), 10);
  return regionKey(Math.floor(cx / REGION_SIZE), Math.floor(cy / REGION_SIZE));
}

/**
 * Chebyshev distance in tiles from a point to the nearest edge of a region.
 * Zero when the point is inside the region.
 */
export function regionDistanceToTile(
  rx: number,
  ry: number,
  tx: number,
  ty: number,
): number {
  const { cx, cy } = regionOrigin(rx, ry);
  const dx = Math.max(cx - tx, tx - (cx + REGION_SIZE - 1), 0);
  const dy = Math.max(cy - ty, ty - (cy + REGION_SIZE - 1), 0);
  return Math.max(dx, dy);
}

/** Same, from a settlement-cell origin rather than an index. */
export function cellDistanceToTile(
  cx: number,
  cy: number,
  tx: number,
  ty: number,
): number {
  const dx = Math.max(cx - tx, tx - (cx + REGION_SIZE - 1), 0);
  const dy = Math.max(cy - ty, ty - (cy + REGION_SIZE - 1), 0);
  return Math.max(dx, dy);
}

/** Inclusive region index range overlapping the square [tx±radius, ty±radius]. */
export function regionRange(
  tx: number,
  ty: number,
  radiusTiles: number,
): { rxMin: number; rxMax: number; ryMin: number; ryMax: number } {
  return {
    rxMin: Math.floor((tx - radiusTiles) / REGION_SIZE),
    rxMax: Math.floor((tx + radiusTiles) / REGION_SIZE),
    ryMin: Math.floor((ty - radiusTiles) / REGION_SIZE),
    ryMax: Math.floor((ty + radiusTiles) / REGION_SIZE),
  };
}

/** Every region index whose area is within `radiusTiles` of the point. */
export function forEachRegionNear(
  tx: number,
  ty: number,
  radiusTiles: number,
  fn: (rx: number, ry: number, dist: number) => void,
): void {
  const { rxMin, rxMax, ryMin, ryMax } = regionRange(tx, ty, radiusTiles);
  for (let ry = ryMin; ry <= ryMax; ry++) {
    for (let rx = rxMin; rx <= rxMax; rx++) {
      const dist = regionDistanceToTile(rx, ry, tx, ty);
      if (dist > radiusTiles) continue;
      fn(rx, ry, dist);
    }
  }
}

// ── Lifecycle tiers ──────────────────────────────────────────────────────────

/**
 * - hot:  full simulation and full detail render
 * - warm: procedural data cached, entities parked, reduced detail
 * - cold: evicted; regenerated deterministically on return
 */
export type RegionTier = "hot" | "warm" | "cold";

export const REGION_TIER_ORDER: Record<RegionTier, number> = {
  cold: 0,
  warm: 1,
  hot: 2,
};

export type RegionLifecycleOptions = {
  /** Regions within this tile distance of any observer are hot. */
  hotRadius: number;
  /** Regions within this distance (but not hot) are warm. */
  warmRadius: number;
  /**
   * Extra distance a region must travel past a boundary before demotion.
   * Prevents thrashing when a player paces across a region edge.
   */
  hysteresis?: number;
};

export type Observer = { x: number; y: number };

/**
 * Tracks the hot/warm/cold tier of each region against a set of observers.
 *
 * Promotion is immediate (a player arriving must not wait), demotion requires
 * clearing the boundary plus hysteresis, so walking back and forth across a
 * region edge cannot cause repeated evict/regenerate cycles.
 */
export class RegionLifecycle {
  private readonly hotRadius: number;
  private readonly warmRadius: number;
  private readonly hysteresis: number;
  private tiers = new Map<RegionKey, RegionTier>();

  constructor(opts: RegionLifecycleOptions) {
    this.hotRadius = opts.hotRadius;
    this.warmRadius = Math.max(opts.warmRadius, opts.hotRadius);
    this.hysteresis = opts.hysteresis ?? 0;
  }

  /** Current tier for a region. Unknown regions are cold. */
  tierOf(key: RegionKey): RegionTier {
    return this.tiers.get(key) ?? "cold";
  }

  tierAt(tx: number, ty: number): RegionTier {
    return this.tierOf(regionKeyAt(tx, ty));
  }

  isHot(tx: number, ty: number): boolean {
    return this.tierAt(tx, ty) === "hot";
  }

  /** Regions currently at the given tier. */
  keysAtTier(tier: RegionTier): RegionKey[] {
    const out: RegionKey[] = [];
    for (const [key, value] of this.tiers) {
      if (value === tier) out.push(key);
    }
    return out;
  }

  /**
   * Recompute tiers against the current observers.
   *
   * Returns the regions whose tier changed, so callers can drive exactly the
   * work a transition implies (warm a cache, park entities, evict) instead of
   * rescanning the world every tick.
   */
  update(observers: Iterable<Observer>): {
    key: RegionKey;
    from: RegionTier;
    to: RegionTier;
  }[] {
    const desired = new Map<RegionKey, RegionTier>();

    for (const observer of observers) {
      const tx = Math.floor(observer.x);
      const ty = Math.floor(observer.y);
      forEachRegionNear(tx, ty, this.warmRadius, (rx, ry, dist) => {
        const key = regionKey(rx, ry);
        const tier: RegionTier = dist <= this.hotRadius ? "hot" : "warm";
        const current = desired.get(key);
        if (!current || REGION_TIER_ORDER[tier] > REGION_TIER_ORDER[current]) {
          desired.set(key, tier);
        }
      });
    }

    const changes: { key: RegionKey; from: RegionTier; to: RegionTier }[] = [];

    for (const [key, tier] of desired) {
      const from = this.tierOf(key);
      if (from === tier) continue;
      // Promotions apply immediately.
      if (REGION_TIER_ORDER[tier] > REGION_TIER_ORDER[from]) {
        this.tiers.set(key, tier);
        changes.push({ key, from, to: tier });
      }
    }

    // Demotions: only once the region has cleared its boundary plus hysteresis.
    for (const [key, from] of [...this.tiers]) {
      const target = desired.get(key) ?? "cold";
      if (REGION_TIER_ORDER[target] >= REGION_TIER_ORDER[from]) continue;
      if (!this.clearedHysteresis(key, from, observers)) continue;
      if (target === "cold") this.tiers.delete(key);
      else this.tiers.set(key, target);
      changes.push({ key, from, to: target });
    }

    return changes;
  }

  /** True when the region is far enough past its tier boundary to demote. */
  private clearedHysteresis(
    key: RegionKey,
    from: RegionTier,
    observers: Iterable<Observer>,
  ): boolean {
    if (this.hysteresis <= 0) return true;
    const { rx, ry } = parseRegionKey(key);
    const boundary = from === "hot" ? this.hotRadius : this.warmRadius;
    const threshold = boundary + this.hysteresis;
    for (const observer of observers) {
      const dist = regionDistanceToTile(
        rx,
        ry,
        Math.floor(observer.x),
        Math.floor(observer.y),
      );
      if (dist <= threshold) return false;
    }
    return true;
  }

  /** Drop all tracking (world teardown / room dispose). */
  clear(): void {
    this.tiers.clear();
  }

  get size(): number {
    return this.tiers.size;
  }
}
