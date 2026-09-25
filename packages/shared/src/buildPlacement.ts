/**
 * Where players are allowed to put structures.
 *
 * Server (WorldRoom.handlePlacePrefab) and client (WorldScene.isValidBuildTile)
 * both call these so the build ghost never shows green on a tile the server
 * will reject. Admin /build temp walls deliberately skip these rules.
 */

import { isBuildingInBirchport, isInBirchport } from "./birchport.js";
import type { StructureBuildKind } from "./buildCosts.js";
import { isBuildingEntranceClearanceTile } from "./worldgen.js";

export type BuildDenialReason = "entrance" | "birchport";

/** Player-facing reason, shown through the same [build] feedback line. */
export const BUILD_DENIAL_MESSAGES: Record<BuildDenialReason, string> = {
  entrance: "You cannot obstruct entrances.",
  birchport: "You do not have permission to build in Birchport.",
};

/**
 * Fireplaces are the one thing Birchport permits: they are walkable, so a row
 * of them cannot wall anyone out of the hospital or the barracks.
 */
export function isBirchportAllowedKind(kind: StructureBuildKind): boolean {
  return kind === "fireplace";
}

/** Why an overworld tile refuses this structure, or null when it is fine. */
export function overworldBuildDenial(
  tx: number,
  ty: number,
  kind: StructureBuildKind,
): BuildDenialReason | null {
  // Doorway aprons are off limits to every kind, fireplaces included, so the
  // rule still holds if a structure ever goes back to blocking movement.
  if (isBuildingEntranceClearanceTile(tx, ty)) return "entrance";
  if (!isBirchportAllowedKind(kind) && isInBirchport(tx, ty)) {
    return "birchport";
  }
  return null;
}

/** Same rule for interiors, which inherit their building's settlement. */
export function interiorBuildDenial(
  buildingX: number,
  buildingY: number,
  kind: StructureBuildKind,
): BuildDenialReason | null {
  if (!isBirchportAllowedKind(kind) && isBuildingInBirchport(buildingX, buildingY)) {
    return "birchport";
  }
  return null;
}
