import Phaser from "phaser";
import {
  getBuildingsNearTile,
  getTreesNearTile,
  isInFrontOfBuilding,
  treeAsBuilding,
  type TreeInfo,
} from "@zombie/shared";
import {
  buildingWallDepth,
  createTreeMaskImage,
  drawBuildingCuboidMask,
  treeRenderDepth,
} from "./IsoTiles";
import {
  BUILDING_OCCLUSION_SEARCH_REACH,
  buildingCuboidCoversSprite,
  buildingCuboidCoversTile,
  tileIndicatorDepth,
} from "./depthSort";
import {
  playerWallOccluderHits,
  stampPlayerWallOccluder,
  type PlayerWallOccluder,
} from "./InteriorView";

/** Renders above all building cuboids (occluded portions of overlays). */
export const OCCLUSION_OVERLAY_DEPTH = 2_000_000;

/**
 * Cuboids that paint over this tile. Depth decides that, not tile-side rules:
 * anything further than the behind-clamp reach is already under the cuboid by
 * plain iso order, and a wall clamp can leave a sprite under a cuboid it is
 * nominally in front of.
 */
export function getOccludingBuildings(
  tileX: number,
  tileY: number,
  sortDepth: number,
) {
  return getBuildingsNearTile(
    tileX,
    tileY,
    BUILDING_OCCLUSION_SEARCH_REACH,
  ).filter((bld) => {
    // Coverage first: pure arithmetic, and it rejects most of the wide search
    // before the cuboid depth walk runs.
    if (!buildingCuboidCoversTile(tileX, tileY, bld)) return false;
    return sortDepth < buildingWallDepth(bld);
  });
}

/**
 * Player outline: same rule, with a sprite-height box. A tall block hides the
 * player from well beyond the adjacent tiles (a 3-storey hospital reaches ~18
 * rows up-screen), so the search has to cover the whole cuboid or the player
 * vanishes with no silhouette.
 */
export function getOccludingBuildingsForPlayerOutline(
  tileX: number,
  tileY: number,
  sortDepth: number,
) {
  return getBuildingsNearTile(
    tileX,
    tileY,
    BUILDING_OCCLUSION_SEARCH_REACH,
  ).filter((bld) => {
    if (!buildingCuboidCoversSprite(tileX, tileY, bld)) return false;
    // Already painting in front of this cuboid: no silhouette.
    return sortDepth < buildingWallDepth(bld);
  });
}

/** How far from a tree tile the tall canopy can still occlude the player. */
const TREE_OUTLINE_REACH = 6;

/**
 * Trees that may draw over the player. Tall sprites can cover the player up to
 * TREE_OUTLINE_REACH tiles away; the alpha mask limits the outline to real pixels.
 */
export function getOccludingTreesForPlayerOutline(
  tileX: number,
  tileY: number,
  sortDepth: number,
): TreeInfo[] {
  return getTreesNearTile(tileX, tileY, TREE_OUTLINE_REACH).filter((tree) => {
    const bld = treeAsBuilding(tree);
    if (isInFrontOfBuilding(tileX, tileY, bld)) return false;
    return sortDepth < treeRenderDepth(tree);
  });
}

type PlayerWallOcclusionQuery = (
  tileX: number,
  tileY: number,
) => readonly PlayerWallOccluder[];

let playerWallOccluders: PlayerWallOcclusionQuery | null = null;

/** WorldScene fills this with the player walls currently on screen. */
export function setPlayerWallOcclusionProvider(
  fn: PlayerWallOcclusionQuery | null,
) {
  playerWallOccluders = fn;
}

function stampPlayerWallsOnMask(
  g: Phaser.GameObjects.Graphics,
  tileX: number,
  tileY: number,
  depthLimit: number,
  coverSprite: boolean,
): boolean {
  const walls = playerWallOccluders?.(tileX, tileY);
  if (!walls || walls.length === 0) return false;
  let stamped = false;
  for (const wall of walls) {
    if (
      stampPlayerWallOccluder(
        g,
        wall,
        depthLimit,
        tileX,
        tileY,
        coverSprite,
      )
    ) {
      stamped = true;
    }
  }
  return stamped;
}

/** A player wall is in front of the standing sprite at this tile. */
export function playerBuiltWallsCoverSprite(
  tileX: number,
  tileY: number,
  sortDepth: number,
): boolean {
  const walls = playerWallOccluders?.(tileX, tileY);
  if (!walls) return false;
  for (const wall of walls) {
    if (playerWallOccluderHits(wall, sortDepth, tileX, tileY, true)) return true;
  }
  return false;
}

export class BuildingOcclusionMask {
  readonly maskContainer: Phaser.GameObjects.Container;
  readonly maskGraphics: Phaser.GameObjects.Graphics;
  readonly bitmapMask: Phaser.Display.Masks.BitmapMask;
  private spriteMaskImages: Phaser.GameObjects.Image[] = [];
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.maskGraphics = scene.make.graphics({ x: 0, y: 0 });
    this.maskContainer = scene.add.container(0, 0);
    this.maskContainer.setVisible(false);
    this.maskContainer.add(this.maskGraphics);
    // BitmapMask uses alpha of this container (white cuboids + tree sprites).
    this.bitmapMask = new Phaser.Display.Masks.BitmapMask(scene, this.maskContainer);
  }

  private clearSpriteMasks() {
    for (const img of this.spriteMaskImages) img.destroy();
    this.spriteMaskImages = [];
  }

  /**
   * Tile indicators (move / loot) — buildings, trees, and player walls.
   * Used as a mask on a high-depth overlay so the diamond redraws over occluders.
   */
  applyForTile(tileX: number, tileY: number, sortDepth: number): boolean {
    this.clearSpriteMasks();
    const buildings = getOccludingBuildings(tileX, tileY, sortDepth);
    const trees = getOccludingTreesForPlayerOutline(tileX, tileY, sortDepth);
    this.maskGraphics.clear();
    const walls = stampPlayerWallsOnMask(
      this.maskGraphics,
      tileX,
      tileY,
      tileIndicatorDepth(tileX, tileY),
      false,
    );
    if (buildings.length === 0 && trees.length === 0 && !walls) return false;

    for (const bld of buildings) {
      drawBuildingCuboidMask(this.maskGraphics, bld);
    }
    for (const tree of trees) {
      const img = createTreeMaskImage(this.scene, tree);
      img.setVisible(true);
      this.maskContainer.add(img);
      this.spriteMaskImages.push(img);
    }
    return true;
  }

  clear() {
    this.clearSpriteMasks();
    this.maskGraphics.clear();
  }

  destroy() {
    this.clearSpriteMasks();
    this.maskGraphics.destroy();
    this.maskContainer.destroy();
  }
}
