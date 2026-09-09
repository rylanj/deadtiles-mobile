import Phaser from "phaser";
import {
  getBuildingsNearTile,
  getTreesNearTile,
  isInFrontOfBuilding,
  isWestOrNorthWallOutlineRange,
  PLAYER_WEST_NORTH_OUTLINE_REACH,
  treeAsBuilding,
  type TreeInfo,
} from "@zombie/shared";
import {
  buildingWallDepth,
  createTreeMaskImage,
  drawBuildingCuboidMask,
  treeRenderDepth,
} from "./IsoTiles";

/** Renders above all building cuboids (occluded portions of overlays). */
export const OCCLUSION_OVERLAY_DEPTH = 2_000_000;

export function getOccludingBuildings(
  tileX: number,
  tileY: number,
  sortDepth: number,
) {
  return getBuildingsNearTile(tileX, tileY, 2).filter((bld) => {
    if (isInFrontOfBuilding(tileX, tileY, bld)) return false;
    return sortDepth < buildingWallDepth(bld);
  });
}

/** Player outline — extended west/north reach where feet clip the cuboid. */
export function getOccludingBuildingsForPlayerOutline(
  tileX: number,
  tileY: number,
  sortDepth: number,
) {
  const searchDist = PLAYER_WEST_NORTH_OUTLINE_REACH + 2;
  return getBuildingsNearTile(tileX, tileY, searchDist).filter((bld) => {
    if (isWestOrNorthWallOutlineRange(tileX, tileY, bld)) return true;
    if (isInFrontOfBuilding(tileX, tileY, bld)) return false;
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
   * Tile indicators (move / loot) — buildings (cuboid) + trees (sprite alpha).
   * Used as a mask on a high-depth overlay so the diamond redraws over occluders.
   */
  applyForTile(tileX: number, tileY: number, sortDepth: number): boolean {
    this.clearSpriteMasks();
    const buildings = getOccludingBuildings(tileX, tileY, sortDepth);
    const trees = getOccludingTreesForPlayerOutline(tileX, tileY, sortDepth);
    this.maskGraphics.clear();
    if (buildings.length === 0 && trees.length === 0) return false;

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

  /** Player sprite outline — buildings (cuboid) + trees (sprite alpha). */
  applyForPlayerOutline(tileX: number, tileY: number, sortDepth: number): boolean {
    this.clearSpriteMasks();
    const buildings = getOccludingBuildingsForPlayerOutline(tileX, tileY, sortDepth);
    const trees = getOccludingTreesForPlayerOutline(tileX, tileY, sortDepth);
    this.maskGraphics.clear();
    if (buildings.length === 0 && trees.length === 0) return false;

    for (const bld of buildings) {
      drawBuildingCuboidMask(this.maskGraphics, bld);
    }
    for (const tree of trees) {
      const img = createTreeMaskImage(this.scene, tree);
      // Mask source only — must not appear in the normal display list.
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
