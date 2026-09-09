import {
  getFenceAt,
  getStreetlightAt,
  getStandingTreeAt,
  isBuildingTile,
} from "./worldgen.js";
import type { WorldBounds } from "./worldBounds.js";
import { isInWorldBounds } from "./worldBounds.js";
import {
  furnitureBlocksBullets,
  furnitureBlocksVision,
  interiorWallOccupiesTile,
  searchableOccupiesTile,
  type InteriorWallTile,
  type SearchableObject,
} from "./interior.js";
import { FIRE_ANIM_MS, FIRE_SHORT_ANIM_MS, PLAYER_FIRE_ANIM_MS } from "./constants.js";
import {
  bulletHeightScreenPos,
  cartesianToIso,
  entityScreenBox,
  type ScreenBox,
} from "./isometric.js";

export const HIT_RADIUS = 0.5;
export const RELOAD_DURATION_MS = 3000;
/** Empty a loaded magazine back into inventory. */
export const UNLOAD_DURATION_MS = 5_000;
export const FLASH_DURATION = 10;

/** @deprecated Use per-weapon missChanceAtMaxRange; kept for callers that omit distance. */
export const BASE_MISS_CHANCE = 0;

/**
 * Soft cover near the target multiplies hit chance.
 * Trees/fences are denser (0.5 → half hit chance). Warehouse furniture is
 * lighter (0.75 → 25% hit reduction). Cover next to the shooter is ignored.
 * Buildings still fully block.
 */
export const TREE_COVER_HIT_MULTIPLIER = 0.5;
export const FURNITURE_COVER_HIT_MULTIPLIER = 0.75;

/** Soft-cover tiles on the shot line within this many tiles of the target count. */
export const TREE_COVER_NEAR_TARGET_DIST = 3;

/**
 * Miss chance multiplier when the target is running / sprinting (`anim === "run"`).
 * 1.5 = +50% miss chance relative to the resolved distance/cover miss.
 */
export const TARGET_SPRINT_MISS_MULTIPLIER = 1.5;

export type ShooterMissContext = {
  /** Override resolved miss chance (0–1). Skills/modifiers will plug in here later. */
  missChance?: number;
  weapon?: WeaponDefinition;
  /** Shot distance in world units (same space as weapon.range). */
  distance?: number;
  /** Tree / fence soft cover near the target. */
  treeCover?: boolean;
  /** BigShelf1 / BigBox1 soft cover near the target (weaker than trees). */
  furnitureCover?: boolean;
  /** Target is sprinting / running — harder to hit. */
  targetSprinting?: boolean;
};

/** Linear miss chance from 0 at point-blank to missChanceAtMaxRange at weapon.range. */
export function missChanceAtDistance(
  weapon: WeaponDefinition,
  distance: number,
): number {
  if (distance <= 0 || weapon.range <= 0) return 0;
  const t = Math.min(distance / weapon.range, 1);
  return t * weapon.missChanceAtMaxRange;
}

/** True when an entity's synced anim is a sprint/run (not a normal walk). */
export function isSprintingAnim(anim: string | undefined | null): boolean {
  return anim === "run";
}

/** Clamp and resolve miss chance for a shooter (skills/modifiers hook). */
export function resolveMissChance(ctx: ShooterMissContext = {}): number {
  let miss: number;
  if (ctx.missChance !== undefined) {
    miss = ctx.missChance;
  } else if (ctx.weapon !== undefined && ctx.distance !== undefined) {
    miss = missChanceAtDistance(ctx.weapon, ctx.distance);
  } else {
    miss = 0;
  }
  miss = Math.max(0, Math.min(1, miss));
  const coverMult = ctx.treeCover
    ? TREE_COVER_HIT_MULTIPLIER
    : ctx.furnitureCover
      ? FURNITURE_COVER_HIT_MULTIPLIER
      : null;
  if (coverMult !== null) {
    // miss' = 1 - (1 - miss) * coverMult
    const hit = 1 - miss;
    miss = 1 - hit * coverMult;
  }
  if (ctx.targetSprinting) {
    miss = Math.min(1, miss * TARGET_SPRINT_MISS_MULTIPLIER);
  }
  return Math.max(0, Math.min(1, miss));
}

/** Roll whether an aimed entity shot misses. */
export function rollShotMiss(
  ctx: ShooterMissContext = {},
  random: () => number = Math.random,
): boolean {
  return random() < resolveMissChance(ctx);
}

/** World position for a miss impact — slightly past the target along the shot line. */
export function missImpactBehindTarget(
  shooterX: number,
  shooterY: number,
  targetX: number,
  targetY: number,
  overshoot = 0.65,
) {
  const dx = targetX - shooterX;
  const dy = targetY - shooterY;
  const len = Math.hypot(dx, dy);
  if (len <= 0.001) {
    return { impactX: targetX, impactY: targetY };
  }
  return {
    impactX: targetX + (dx / len) * overshoot,
    impactY: targetY + (dy / len) * overshoot,
  };
}

export type WeaponDefinition = {
  name: string;
  damage: number;
  range: number;
  /** Miss probability (0–1) at max range; linear from 0 at point-blank. */
  missChanceAtMaxRange: number;
  fireRate: number;
  magazineCapacity: number;
  itemId: string;
  /** Tiles within which overworld zombies hear a shot and investigate its origin. */
  noiseRadius: number;
  /** Melee weapons use Hit* animations (no ammo / gunshot noise). Range is Chebyshev tiles and may be fractional. */
  kind?: "ranged" | "melee";
  /** Hit SFX bank. "blade" uses Blade/Hit1-4, "blunt" uses Blunt/Hit1-4. Unset keeps the melee placeholder. */
  meleeHitBank?: "blade" | "blunt";
  /** Full attack / Hit* clip length in ms (defaults to FIRE_ANIM_MS). */
  attackAnimMs?: number;
  /** Hold fire while aiming: shoots at fireRate instead of one shot per click. */
  fullAuto?: boolean;
  /** Independent traces per trigger pull. Shotgun buckshot uses 6. */
  pelletCount?: number;
  /** Damage of one pellet. When set, each ray deals this instead of damage / pelletCount. */
  pelletDamage?: number;
  /** Half-angle of the pellet cone in radians (ignored when pelletCount is 1). */
  pelletConeRad?: number;
};

export function isMeleeWeapon(weapon: WeaponDefinition): boolean {
  return weapon.kind === "melee";
}

export function isFullAutoWeapon(weapon: WeaponDefinition): boolean {
  return weapon.fullAuto === true && !isMeleeWeapon(weapon);
}

/** Inclusive armour soak range. Rolled per hit. Melee and unknown guns stay at 1. */
export function armoredDamageRange(
  weapon: WeaponDefinition,
): { min: number; max: number } | undefined {
  switch (weapon.itemId) {
    case "weapon_pistol":
      return { min: 0.5, max: 0.6 };
    case "weapon_revolver":
      return { min: 0.6, max: 0.7 };
    case "weapon_shotgun":
      return { min: 0.7, max: 0.8 };
    case "weapon_m4a1":
      return { min: 0.75, max: 0.85 };
    case "weapon_assault_rifle":
      return { min: 0.8, max: 0.8 };
    case "weapon_hunting_rifle":
      return { min: 0.8, max: 1 };
    default:
      return undefined;
  }
}

/** Damage taken through body armour this hit. Other targets use 1. */
export function armoredDamageMultiplier(
  weapon: WeaponDefinition,
  random: () => number = Math.random,
): number {
  const range = armoredDamageRange(weapon);
  if (!range) return 1;
  if (range.max <= range.min) return range.min;
  return range.min + random() * (range.max - range.min);
}

export function scaleDamageForArmor(
  damage: number,
  weapon: WeaponDefinition | undefined,
  random: () => number = Math.random,
): number {
  if (!weapon) return damage;
  return damage * armoredDamageMultiplier(weapon, random);
}

export function weaponPelletCount(weapon: WeaponDefinition): number {
  const n = weapon.pelletCount ?? 1;
  return n > 1 ? Math.floor(n) : 1;
}

/**
 * Angles (radians) for each pellet around the aim line. Single-pellet guns
 * keep the normal accuracy cone. Shotguns pick irregular angles inside the
 * cone (triangular, so they cluster toward the aim line but never line up
 * as a perfect fan).
 */
export function pelletSpreadAngles(
  weapon: WeaponDefinition,
  random: () => number = Math.random,
): number[] {
  const n = weaponPelletCount(weapon);
  if (n <= 1) return [rollAimSpread(weapon, random)];
  const half = weapon.pelletConeRad ?? 0.34;
  const minGap = half * 0.08;
  const angles: number[] = [];
  for (let i = 0; i < n; i++) {
    let angle = (random() + random() - 1) * half;
    for (let tries = 0; tries < 6; tries++) {
      if (angles.every((a) => Math.abs(a - angle) >= minGap)) break;
      angle = (random() + random() - 1) * half;
    }
    angles.push(angle);
  }
  return angles;
}

/** Full or short attack animation duration for a weapon (NPC / legacy HumanMan1). */
export function weaponAttackAnimMs(
  weapon: WeaponDefinition | undefined,
  mode: "full" | "short" = "full",
): number {
  if (mode === "short") return FIRE_SHORT_ANIM_MS;
  return weapon?.attackAnimMs ?? FIRE_ANIM_MS;
}

/**
 * Player attack clip length. Ranged PlayerMan always plays the full Fire* strip
 * (no short burst from fighting stance). Melee still uses Hit* timing.
 */
export function playerAttackAnimMs(weapon: WeaponDefinition | undefined): number {
  if (weapon && isMeleeWeapon(weapon)) {
    return weapon.attackAnimMs ?? FIRE_ANIM_MS;
  }
  return weapon?.attackAnimMs ?? PLAYER_FIRE_ANIM_MS;
}

export const WEAPONS: WeaponDefinition[] = [
  {
    name: "Pistol",
    damage: 25,
    range: 30,
    missChanceAtMaxRange: 0.5,
    fireRate: 4,
    magazineCapacity: 17,
    itemId: "weapon_pistol",
    noiseRadius: 40,
  },
  {
    name: "Shotgun",
    damage: 120,
    range: 15,
    missChanceAtMaxRange: 0.4,
    fireRate: 1,
    magazineCapacity: 6,
    itemId: "weapon_shotgun",
    noiseRadius: 60,
    pelletCount: 6,
    pelletDamage: 20,
    /** ~20° each side. Pellets fan wide so range thins the pattern. */
    pelletConeRad: 0.35,
  },
  {
    name: "Hunting Rifle",
    damage: 110,
    range: 60,
    missChanceAtMaxRange: 0.25,
    fireRate: 1,
    magazineCapacity: 5,
    itemId: "weapon_hunting_rifle",
    noiseRadius: 70,
  },
  {
    name: "Revolver",
    damage: 40,
    range: 25,
    missChanceAtMaxRange: 0.6,
    fireRate: 2,
    magazineCapacity: 6,
    itemId: "weapon_revolver",
    noiseRadius: 50,
  },
  {
    name: "AK",
    damage: 75,
    range: 40,
    missChanceAtMaxRange: 0.4,
    fireRate: 8,
    magazineCapacity: 30,
    itemId: "weapon_assault_rifle",
    noiseRadius: 70,
    fullAuto: true,
  },
  {
    name: "Hammer",
    damage: 35,
    /** Chebyshev tiles (fractional OK). */
    range: 1.5,
    missChanceAtMaxRange: 0,
    /** Matches PlayerMan Hit* 5-frame swing (falls back to HumanMan1 HitHammer until art lands). */
    fireRate: 4,
    magazineCapacity: 0,
    itemId: "weapon_hammer",
    noiseRadius: 0,
    kind: "melee",
    meleeHitBank: "blunt",
  },
  {
    name: "Bat",
    damage: 30,
    /** Chebyshev tiles (fractional OK). */
    range: 2,
    missChanceAtMaxRange: 0,
    /** 30% slower than default Hit* swing. */
    fireRate: 1000 / Math.round(FIRE_ANIM_MS * 1.3),
    magazineCapacity: 0,
    itemId: "weapon_bat",
    noiseRadius: 0,
    kind: "melee",
    meleeHitBank: "blunt",
    attackAnimMs: Math.round(FIRE_ANIM_MS * 1.3),
  },
  {
    name: "Hatchet",
    damage: 35,
    /** Same Chebyshev reach as Hammer. */
    range: 1.5,
    missChanceAtMaxRange: 0,
    fireRate: 3,
    magazineCapacity: 0,
    itemId: "weapon_hatchet",
    noiseRadius: 0,
    kind: "melee",
    meleeHitBank: "blade",
  },
  {
    name: "M4",
    damage: 55,
    range: 40,
    missChanceAtMaxRange: 0.3,
    fireRate: 10,
    magazineCapacity: 30,
    itemId: "weapon_m4a1",
    noiseRadius: 60,
    fullAuto: true,
  },
];

/**
 * Player-ear range in tiles (not zombie aggro). Handguns carry far; rifles farther.
 */
export const GUNSHOT_HEAR_RADIUS: Record<string, number> = {
  weapon_pistol: 80,
  weapon_revolver: 90,
  weapon_shotgun: 120,
  weapon_m4a1: 140,
  weapon_assault_rifle: 150,
  weapon_hunting_rifle: 200,
};

export function gunshotHearRadius(itemId: string): number {
  return GUNSHOT_HEAR_RADIUS[itemId] ?? 0;
}

/**
 * Positions used for hearing distance and stereo pan.
 * Same overworld or same interior uses live coords. Cross-space (inside a
 * house vs street) uses the building's overworld tile so pan is relative
 * to the building, not interior local coords.
 */
export function gunshotListenPoints(
  ax: number,
  ay: number,
  aInInterior: boolean,
  aBuildingX: number,
  aBuildingY: number,
  bx: number,
  by: number,
  bInInterior: boolean,
  bBuildingX: number,
  bBuildingY: number,
): { ax: number; ay: number; bx: number; by: number } {
  const sameInterior =
    aInInterior &&
    bInInterior &&
    aBuildingX === bBuildingX &&
    aBuildingY === bBuildingY;
  if (sameInterior || (!aInInterior && !bInInterior)) {
    return { ax, ay, bx, by };
  }
  return {
    ax: aInInterior ? aBuildingX + 0.5 : ax,
    ay: aInInterior ? aBuildingY + 0.5 : ay,
    bx: bInInterior ? bBuildingX + 0.5 : bx,
    by: bInInterior ? bBuildingY + 0.5 : by,
  };
}

/**
 * Distance used for hearing. Same overworld or same interior uses live coords.
 * Cross-space (inside a house vs street) uses the building's overworld tile.
 */
export function gunshotListenDistance(
  ax: number,
  ay: number,
  aInInterior: boolean,
  aBuildingX: number,
  aBuildingY: number,
  bx: number,
  by: number,
  bInInterior: boolean,
  bBuildingX: number,
  bBuildingY: number,
): number {
  const p = gunshotListenPoints(
    ax,
    ay,
    aInInterior,
    aBuildingX,
    aBuildingY,
    bx,
    by,
    bInInterior,
    bBuildingX,
    bBuildingY,
  );
  return Math.hypot(p.ax - p.bx, p.ay - p.by);
}

export type RaycastTarget = {
  id: string;
  x: number;
  y: number;
  health: number;
  isDead: boolean;
  /** Drawn sprite height, for free-aim silhouette hits. Defaults to a full human. */
  renderHeight?: number;
};

/** @deprecated Use RaycastTarget */
export type RaycastZombie = RaycastTarget;

export type FireResult =
  | { kind: "noop" }
  | { kind: "reload" }
  | {
      kind: "impact";
      x: number;
      y: number;
      hitTargetId?: string;
      damage?: number;
      /** Shot line passed through a tree/fence near the target (dense soft cover). */
      treeCover?: boolean;
      /** Shot line passed through BigShelf1/BigBox1 near the target (light soft cover). */
      furnitureCover?: boolean;
      /** Soft-cover impact point (tile centre), when tree or furniture cover is set. */
      coverTreeX?: number;
      coverTreeY?: number;
    };

export function fireRaycast(params: {
  originX: number;
  originY: number;
  targetX: number;
  targetY: number;
  weapon: WeaponDefinition;
  inInterior: boolean;
  bounds: WorldBounds;
  targets: RaycastTarget[];
  /** When set, only this entity can be damaged (matches client hover targeting). */
  requiredTargetId?: string;
  /** Interior furniture — BigShelf1 / BigBox1 act as light soft cover near the target. */
  furnitures?: SearchableObject[];
  /** Interior partition walls — hard cover (fully block the shot). */
  walls?: InteriorWallTile[];
  /**
   * Extra hard cover for the space being fired in — outdoors this carries
   * player-built / admin walls and closed doors, which are not part of
   * procedural worldgen so `isBuildingTile` cannot see them.
   */
  blocksSightAt?: (tx: number, ty: number) => boolean;
}): FireResult {
  const {
    originX,
    originY,
    targetX,
    targetY,
    weapon,
    inInterior,
    bounds,
    targets,
    requiredTargetId,
    furnitures = [],
    walls = [],
    blocksSightAt,
  } = params;

  const activeTargets = requiredTargetId
    ? targets.filter((t) => t.id === requiredTargetId)
    : targets;

  const dx = targetX - originX;
  const dy = targetY - originY;
  const dist = Math.hypot(dx, dy);
  if (dist <= 0.001) return { kind: "noop" };
  if (!isInWeaponRange(originX, originY, targetX, targetY, weapon)) {
    return { kind: "noop" };
  }

  const stepSize = 0.05;
  const headOffset = 50 / 32;
  let treeCover = false;
  let furnitureCover = false;
  let coverTreeX: number | undefined;
  let coverTreeY: number | undefined;

  const originTX = Math.floor(originX);
  const originTY = Math.floor(originY);

  for (let t = 0; t < dist; t += stepSize) {
    const cx = originX + (dx / dist) * t;
    const cy = originY + (dy / dist) * t;
    const tx = Math.floor(cx);
    const ty = Math.floor(cy);

    // Never let the shooter's own tile stop the shot — a door can be closed on
    // top of whoever is standing in the doorway.
    if (
      (tx !== originTX || ty !== originTY) &&
      blocksSightAt?.(tx, ty)
    ) {
      return { kind: "impact", x: cx, y: cy, treeCover, furnitureCover };
    }

    if (!inInterior && isInWorldBounds(cx, cy, bounds)) {
      // Buildings fully block. Trees / wooden fences are soft cover only.
      if (isBuildingTile(tx, ty)) {
        return { kind: "impact", x: cx, y: cy, treeCover, furnitureCover };
      }
      if (
        (getStandingTreeAt(tx, ty) ||
          getFenceAt(tx, ty) ||
          getStreetlightAt(tx, ty)) &&
        dist - t <= TREE_COVER_NEAR_TARGET_DIST
      ) {
        if (!treeCover && !furnitureCover) {
          const tree = getStandingTreeAt(tx, ty);
          if (tree) {
            coverTreeX = tree.ox + 0.5;
            coverTreeY = tree.oy + 0.5;
          } else {
            coverTreeX = tx + 0.5;
            coverTreeY = ty + 0.5;
          }
        }
        treeCover = true;
      }
    }

    if (inInterior) {
      // Interior partitions fully block (same role as outdoor buildings).
      if (interiorWallOccupiesTile(walls, tx, ty)) {
        return { kind: "impact", x: cx, y: cy, treeCover, furnitureCover };
      }
      if (dist - t <= TREE_COVER_NEAR_TARGET_DIST) {
        for (const f of furnitures) {
          if (
            furnitureBlocksVision(f.objectType) &&
            searchableOccupiesTile(f, tx, ty)
          ) {
            if (!treeCover && !furnitureCover) {
              coverTreeX = f.x + 0.5;
              coverTreeY = f.y + 0.5;
            }
            furnitureCover = true;
            break;
          }
        }
      }
    }

    for (const target of activeTargets) {
      if (target.isDead || target.health <= 0) continue;
      const headX = target.x - headOffset;
      const headY = target.y - headOffset;
      const sdx = headX - target.x;
      const sdy = headY - target.y;
      let u = ((cx - target.x) * sdx + (cy - target.y) * sdy) / (sdx * sdx + sdy * sdy);
      u = Math.max(0, Math.min(1, u));
      const closestX = target.x + u * sdx;
      const closestY = target.y + u * sdy;
      const zdist = Math.hypot(cx - closestX, cy - closestY);
      if (zdist < HIT_RADIUS) {
        return {
          kind: "impact",
          x: cx,
          y: cy,
          hitTargetId: target.id,
          damage: weapon.damage,
          treeCover,
          furnitureCover,
          coverTreeX,
          coverTreeY,
        };
      }
    }
  }

  return {
    kind: "impact",
    x: targetX,
    y: targetY,
    treeCover,
    furnitureCover,
    coverTreeX,
    coverTreeY,
  };
}

/**
 * Aim-cone half angle in radians for a weapon with missChanceAtMaxRange = 1.
 * Lateral error grows with distance on its own, so range needs no extra term.
 */
export const MAX_AIM_SPREAD_RAD = 0.13;

/**
 * Random angular error applied to a free-aim shot. Triangular distribution, so
 * shots cluster on the aim line and only rarely sit at the edge of the cone.
 */
export function rollAimSpread(
  weapon: WeaponDefinition,
  random: () => number = Math.random,
): number {
  const max = weapon.missChanceAtMaxRange * MAX_AIM_SPREAD_RAD;
  if (max <= 0) return 0;
  return (random() + random() - 1) * max;
}

/** What a free-aim bullet stopped against. */
export type FreeAimSurface =
  | "entity"
  | "tree"
  | "building"
  | "structure"
  | "furniture"
  | "ground";

/**
 * Slab clip of the ray `origin + t * step` against a screen-space box.
 * Returns the entry/exit values of `t`, or null when the ray misses.
 */
function segmentBoxSpan(
  origin: { x: number; y: number },
  step: { x: number; y: number },
  box: ScreenBox,
): { enter: number; exit: number } | null {
  let enter = -Infinity;
  let exit = Infinity;

  for (const axis of ["x", "y"] as const) {
    const o = origin[axis];
    const d = step[axis];
    const lo = axis === "x" ? box.left : box.top;
    const hi = axis === "x" ? box.right : box.bottom;
    if (Math.abs(d) < 1e-9) {
      if (o < lo || o > hi) return null;
      continue;
    }
    const t1 = (lo - o) / d;
    const t2 = (hi - o) / d;
    enter = Math.max(enter, Math.min(t1, t2));
    exit = Math.min(exit, Math.max(t1, t2));
    if (enter > exit) return null;
  }

  return exit < 0 ? null : { enter, exit };
}

export type FreeAimResult = {
  /** Visual impact point, held just short of the blocker's near face. */
  x: number;
  y: number;
  /** Point inside the blocking tile, for resolving what actually took the round. */
  blockX: number;
  blockY: number;
  surface: FreeAimSurface;
  hitTargetId?: string;
  damage?: number;
};

/**
 * Free-aim projectile trace. The bullet leaves the muzzle toward the aim point
 * (offset by weapon spread) and stops at the first live entity or hard cover it
 * meets, otherwise at the aim point or max range, whichever is nearer.
 *
 * The round flies at a fixed height above the ground, so the two halves of the
 * trace look at different things:
 *  - Cover uses the ground shadow, the tiles the round genuinely passes over.
 *    A tall building beside or behind the shooter overlaps the shot on screen
 *    but is never under it, so it must not block.
 *  - Bodies use the drawn silhouette, since a body standing in the visible line
 *    of fire is one the player expects to hit.
 *
 * Returns null only when the aim point is on the muzzle.
 */
export function freeAimRaycast(params: {
  /** Muzzle: ground position of the gun (feet nudged toward the aim point). */
  originX: number;
  originY: number;
  aimX: number;
  aimY: number;
  /** Shooter's feet, so the tile they stand on cannot stop their own shot. */
  shooterX?: number;
  shooterY?: number;
  weapon: WeaponDefinition;
  inInterior: boolean;
  bounds: WorldBounds;
  targets: RaycastTarget[];
  furnitures?: SearchableObject[];
  walls?: InteriorWallTile[];
  blocksSightAt?: (tx: number, ty: number) => boolean;
  random?: () => number;
  /** Skip the weapon accuracy roll and use this angle (shotgun pellets). */
  spreadOverride?: number;
}): FreeAimResult | null {
  const {
    originX,
    originY,
    aimX,
    aimY,
    shooterX = originX,
    shooterY = originY,
    weapon,
    inInterior,
    bounds,
    targets,
    furnitures = [],
    walls = [],
    blocksSightAt,
    random = Math.random,
    spreadOverride,
  } = params;

  const aimDx = aimX - originX;
  const aimDy = aimY - originY;
  const aimDist = Math.hypot(aimDx, aimDy);
  if (aimDist <= 0.001) return null;

  const spread =
    spreadOverride !== undefined ? spreadOverride : rollAimSpread(weapon, random);
  const cos = Math.cos(spread);
  const sin = Math.sin(spread);
  const ux = (aimDx * cos - aimDy * sin) / aimDist;
  const uy = (aimDx * sin + aimDy * cos) / aimDist;

  const maxDist = Math.min(aimDist, weapon.range);

  // Bodies are tested against the drawn silhouette rather than a circle on the
  // floor. The round's on-screen path is the ground line raised by a constant,
  // so `t` (world distance along the ray) is the same parameter in both spaces
  // and stays comparable with the tile-cover march below.
  const screenOrigin = bulletHeightScreenPos(originX, originY);
  const screenStep = cartesianToIso(ux, uy);

  let bodyDist = Infinity;
  let bodyId: string | undefined;
  for (const target of targets) {
    if (target.isDead || target.health <= 0) continue;
    const box = entityScreenBox(target.x, target.y, target.renderHeight);
    const span = segmentBoxSpan(screenOrigin, screenStep, box);
    if (!span) continue;
    const entry = Math.max(0, span.enter);
    if (entry > Math.min(maxDist, span.exit)) continue;
    if (entry < bodyDist) {
      bodyDist = entry;
      bodyId = target.id;
    }
  }

  // Cover only has to be sampled once per tile the line crosses.
  const coverLimit = Math.min(maxDist, bodyDist);
  const stepSize = 0.05;
  // Seeded with the shooter's tile, not the muzzle's: an arm's length can reach
  // into the wall next door, and that wall still has to stop the round.
  let lastTX = Math.floor(shooterX);
  let lastTY = Math.floor(shooterY);

  /**
   * Stop just short of the blocking tile so the impact sits on the near face.
   * Inside the tile it would sort behind the wall and never be seen.
   */
  const stopBefore = (t: number) => {
    const back = Math.max(0, t - stepSize);
    return {
      x: originX + ux * back,
      y: originY + uy * back,
      blockX: originX + ux * t,
      blockY: originY + uy * t,
    };
  };

  for (let t = stepSize; t <= coverLimit; t += stepSize) {
    const cx = originX + ux * t;
    const cy = originY + uy * t;
    const tx = Math.floor(cx);
    const ty = Math.floor(cy);
    // The tile the shooter stands on never stops the shot — a door can be
    // closed on top of whoever stands in the doorway.
    if (tx === lastTX && ty === lastTY) continue;
    lastTX = tx;
    lastTY = ty;

    if (blocksSightAt?.(tx, ty)) {
      return { ...stopBefore(t), surface: "structure" };
    }

    if (inInterior) {
      if (interiorWallOccupiesTile(walls, tx, ty)) {
        return { ...stopBefore(t), surface: "building" };
      }
      for (const f of furnitures) {
        if (
          furnitureBlocksBullets(f.objectType) &&
          searchableOccupiesTile(f, tx, ty)
        ) {
          return { ...stopBefore(t), surface: "furniture" };
        }
      }
      continue;
    }

    if (isInWorldBounds(cx, cy, bounds)) {
      if (isBuildingTile(tx, ty)) {
        return { ...stopBefore(t), surface: "building" };
      }
      if (getStandingTreeAt(tx, ty)) {
        return { ...stopBefore(t), surface: "tree" };
      }
    }
  }

  if (bodyId && bodyDist <= maxDist) {
    const bx = originX + ux * bodyDist;
    const by = originY + uy * bodyDist;
    return {
      x: bx,
      y: by,
      blockX: bx,
      blockY: by,
      surface: "entity",
      hitTargetId: bodyId,
      damage: weapon.damage,
    };
  }

  const ex = originX + ux * maxDist;
  const ey = originY + uy * maxDist;
  return { x: ex, y: ey, blockX: ex, blockY: ey, surface: "ground" };
}

/**
 * One trigger pull: one ray for rifles/pistols, a cone of pellets for shotguns.
 * Each connecting pellet deals pelletDamage, or damage / pellet count if unset.
 */
export function freeAimPellets(
  params: Omit<Parameters<typeof freeAimRaycast>[0], "spreadOverride">,
): FreeAimResult[] {
  const angles = pelletSpreadAngles(params.weapon, params.random);
  const pelletDamage =
    params.weapon.pelletDamage ?? params.weapon.damage / angles.length;
  const out: FreeAimResult[] = [];
  for (const spread of angles) {
    const result = freeAimRaycast({ ...params, spreadOverride: spread });
    if (!result) continue;
    if (result.damage) result.damage = pelletDamage;
    out.push(result);
  }
  return out;
}

/** True when a shot would reach targetId without hitting a wall first. */
export function shotHitsTarget(params: {
  originX: number;
  originY: number;
  targetX: number;
  targetY: number;
  weapon: WeaponDefinition;
  inInterior: boolean;
  bounds: WorldBounds;
  targets: RaycastTarget[];
  targetId: string;
  furnitures?: SearchableObject[];
  walls?: InteriorWallTile[];
  blocksSightAt?: (tx: number, ty: number) => boolean;
}): boolean {
  const result = fireRaycast({ ...params, requiredTargetId: params.targetId });
  return result.kind === "impact" && result.hitTargetId === params.targetId;
}

/**
 * Entity vision ray for zombie aggro: blocked by buildings outdoors and by
 * interior walls + vision-blocking furniture indoors. `blocksSightAt` adds the
 * non-procedural blockers (player-built / admin walls, closed doors).
 */
export function hasEntityLineOfSight(params: {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  inInterior: boolean;
  furnitures?: SearchableObject[];
  walls?: InteriorWallTile[];
  blocksSightAt?: (tx: number, ty: number) => boolean;
}): boolean {
  const {
    fromX,
    fromY,
    toX,
    toY,
    inInterior,
    furnitures = [],
    walls = [],
    blocksSightAt,
  } = params;
  const dx = toX - fromX;
  const dy = toY - fromY;
  const dist = Math.hypot(dx, dy);
  if (dist <= 0.001) return true;

  const stepSize = 0.1;
  const fromTX = Math.floor(fromX);
  const fromTY = Math.floor(fromY);
  const toTX = Math.floor(toX);
  const toTY = Math.floor(toY);

  for (let t = stepSize; t < dist; t += stepSize) {
    const cx = fromX + (dx / dist) * t;
    const cy = fromY + (dy / dist) * t;
    const tx = Math.floor(cx);
    const ty = Math.floor(cy);
    // Don't treat the endpoints' own tiles as blockers.
    if ((tx === fromTX && ty === fromTY) || (tx === toTX && ty === toTY)) {
      continue;
    }

    if (blocksSightAt?.(tx, ty)) return false;

    if (!inInterior) {
      if (isBuildingTile(tx, ty)) return false;
      continue;
    }

    if (interiorWallOccupiesTile(walls, tx, ty)) return false;

    for (const f of furnitures) {
      if (
        furnitureBlocksVision(f.objectType) &&
        searchableOccupiesTile(f, tx, ty)
      ) {
        return false;
      }
    }
  }

  return true;
}

export function isMovingInput(screenDx: number, screenDy: number) {
  return screenDx !== 0 || screenDy !== 0;
}

export function shotDistance(
  originX: number,
  originY: number,
  targetX: number,
  targetY: number,
) {
  return Math.hypot(targetX - originX, targetY - originY);
}

export function isInWeaponRange(
  originX: number,
  originY: number,
  targetX: number,
  targetY: number,
  weapon: WeaponDefinition,
) {
  if (isMeleeWeapon(weapon)) {
    // Chebyshev tiles — supports fractional ranges (e.g. hammer 1.5).
    return (
      Math.max(Math.abs(targetX - originX), Math.abs(targetY - originY)) <=
      weapon.range
    );
  }
  return shotDistance(originX, originY, targetX, targetY) <= weapon.range;
}

export function evaluateAimState(params: {
  originX: number;
  originY: number;
  targetX: number;
  targetY: number;
  weapon: WeaponDefinition;
  isMoving: boolean;
  isReloading: boolean;
  magazineRounds: number;
  reserveAmmo: number;
}) {
  const inRange = isInWeaponRange(
    params.originX,
    params.originY,
    params.targetX,
    params.targetY,
    params.weapon,
  );
  const hasAmmo = isMeleeWeapon(params.weapon)
    ? true
    : params.magazineRounds > 0 || params.reserveAmmo > 0;
  const canShoot =
    inRange && !params.isMoving && !params.isReloading && hasAmmo;
  return { inRange, hasAmmo, canShoot };
}
