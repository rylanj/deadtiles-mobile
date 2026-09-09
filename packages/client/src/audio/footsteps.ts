import {
  TileType,
  generateTile,
  getBuildingAt,
  type BuildingType,
} from "@zombie/shared";

export type FootstepSurface = "grass" | "concrete" | "carpet" | "wood";
export type FootstepGait = "walk" | "run";

export const FOOTSTEP_SURFACES: readonly FootstepSurface[] = [
  "grass",
  "concrete",
  "carpet",
  "wood",
];
export const FOOTSTEP_GAITS: readonly FootstepGait[] = ["walk", "run"];

/** Used when a tile / building has no row in the maps below. */
export const FOOTSTEP_DEFAULT_SURFACE: FootstepSurface = "concrete";

/**
 * Phaser playback rate per clip. 1 = file speed.
 * Below 1 slows the take (sprites feel slower than the recording).
 * Above 1 speeds it up.
 */
export const FOOTSTEP_RATE: Record<
  FootstepSurface,
  Record<FootstepGait, number>
> = {
  grass: { walk: 1.2, run: 1 },
  concrete: { walk: 1.2, run: 1.1 },
  carpet: { walk: 1.3, run: 1 },
  wood: { walk: 1.4, run: 1 },
};

/** Mix volume per clip. Applied live while walking. */
export const FOOTSTEP_GAIN: Record<
  FootstepSurface,
  Record<FootstepGait, number>
> = {
  grass: { walk: 0.1, run: 0.1 },
  concrete: { walk: 0.1, run: 0.1 },
  carpet: { walk: 0.1, run: 0.1 },
  wood: { walk: 0.1, run: 0.1 },
};

export const FOOTSTEP_FILE: Record<
  FootstepSurface,
  Record<FootstepGait, string>
> = {
  grass: { walk: "Ground/WalkGrass.wav", run: "Ground/RunGrass.wav" },
  concrete: { walk: "Ground/WalkConcrete.wav", run: "Ground/RunConcrete.wav" },
  carpet: { walk: "Ground/WalkCarpet.wav", run: "Ground/RunCarpet.wav" },
  wood: { walk: "Ground/WalkWood.wav", run: "Ground/RunWood.wav" },
};

/**
 * Interior floors. Types not listed use {@link FOOTSTEP_DEFAULT_SURFACE}.
 * house = wood boards, motel = carpet. Hospital / police / tents / shops stay concrete.
 */
export const FOOTSTEP_INTERIOR_BY_BUILDING: Partial<
  Record<BuildingType, FootstepSurface>
> = {
  house: "wood",
  motel: "carpet",
};

/**
 * Overworld tiles. Types not listed use {@link FOOTSTEP_DEFAULT_SURFACE}.
 * Floor is grass. Roads, pavement, car parks, and barracks yard stay concrete.
 */
export const FOOTSTEP_OVERWORLD_BY_TILE: Partial<
  Record<TileType, FootstepSurface>
> = {
  [TileType.Floor]: "grass",
};

export function resolveFootstepSurface(opts: {
  x: number;
  y: number;
  inInterior?: boolean;
  buildingX?: number;
  buildingY?: number;
}): FootstepSurface {
  if (opts.inInterior) {
    const type = getBuildingAt(opts.buildingX ?? 0, opts.buildingY ?? 0)
      ?.buildingType;
    if (type) {
      return FOOTSTEP_INTERIOR_BY_BUILDING[type] ?? FOOTSTEP_DEFAULT_SURFACE;
    }
    return FOOTSTEP_DEFAULT_SURFACE;
  }
  const tile = generateTile(Math.floor(opts.x), Math.floor(opts.y));
  return FOOTSTEP_OVERWORLD_BY_TILE[tile] ?? FOOTSTEP_DEFAULT_SURFACE;
}

export function footstepKey(
  surface: FootstepSurface,
  gait: FootstepGait,
): string {
  return `sfx:footstep:${surface}:${gait}`;
}
