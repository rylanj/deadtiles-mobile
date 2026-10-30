import Phaser from "phaser";
import { directionFromWorldDelta } from "@zombie/shared";
import {
  getOccludingBuildingsForPlayerOutline,
  getOccludingTreesForPlayerOutline,
  OCCLUSION_OVERLAY_DEPTH,
  playerBuiltWallsCoverSprite,
} from "../world/BuildingOcclusion";

/** Faint enough to read as "behind that", solid enough to track while moving. */
const GHOST_ALPHA = 0.42;

/** Living sprites that can show through cover. Corpses stay on the ground. */
const SEEN_THROUGH_KINDS = new Set([
  "player",
  "zombie",
  "guard",
  "coywolf",
  "bear",
  "crow",
  "rabbit",
]);

/**
 * True when `facing` (0-7, N then clockwise) is the direction of (dx, dy)
 * or one bearing to either side. Same tile counts as looking at them.
 */
export function facingWithinOneBearing(
  facing: number,
  dx: number,
  dy: number,
): boolean {
  if (dx === 0 && dy === 0) return true;
  const toward = directionFromWorldDelta(dx, dy);
  const a = ((Math.round(facing) % 8) + 8) % 8;
  const raw = Math.abs(toward - a) % 8;
  const delta = raw > 4 ? 8 - raw : raw;
  return delta <= 1;
}

/** Building, tree, or player wall is drawn over the sprite at this tile. */
export function coverOccludesSprite(
  tileX: number,
  tileY: number,
  sortDepth: number,
): boolean {
  if (
    getOccludingBuildingsForPlayerOutline(tileX, tileY, sortDepth).length > 0 ||
    getOccludingTreesForPlayerOutline(tileX, tileY, sortDepth).length > 0
  ) {
    return true;
  }
  return playerBuiltWallsCoverSprite(tileX, tileY, sortDepth);
}

function paintGhost(
  ghost: Phaser.GameObjects.Sprite,
  source: Phaser.GameObjects.Sprite,
): boolean {
  const key = source.texture?.key;
  if (!key || !ghost.scene?.textures.exists(key)) {
    ghost.setVisible(false);
    return false;
  }
  ghost.setTexture(key, source.frame.name);
  ghost.setPosition(source.x, source.y);
  ghost.setOrigin(source.originX, source.originY);
  ghost.setScale(source.scaleX, source.scaleY);
  ghost.setFlipX(source.flipX);
  ghost.setFlipY(source.flipY);
  ghost.setRotation(source.rotation);
  ghost.setDisplaySize(source.displayWidth, source.displayHeight);
  if (source.isTinted) {
    ghost.setTint(
      source.tintTopLeft,
      source.tintTopRight,
      source.tintBottomLeft,
      source.tintBottomRight,
    );
  } else {
    ghost.clearTint();
  }
  ghost.setAlpha(source.alpha * GHOST_ALPHA);
  ghost.setVisible(true);
  return true;
}

function makeGhost(scene: Phaser.Scene): Phaser.GameObjects.Sprite {
  const ghost = scene.add.sprite(0, 0, "__DEFAULT");
  ghost.setVisible(false);
  ghost.setDepth(OCCLUSION_OVERLAY_DEPTH);
  return ghost;
}

export type SeenThroughViewer = {
  x: number;
  y: number;
  facing: number;
};

/**
 * Draws a faint copy of the local player above a building, tree, or wall that
 * covers them. One extra sprite, no mask and no extra textures.
 */
export class PlayerOccludedGhost {
  private ghost: Phaser.GameObjects.Sprite;

  constructor(scene: Phaser.Scene) {
    this.ghost = makeGhost(scene);
  }

  hide() {
    this.ghost.setVisible(false);
  }

  update(
    player: Phaser.GameObjects.Sprite,
    tileX: number,
    tileY: number,
    playerDepth: number,
  ) {
    if (!player.visible || player.alpha <= 0) {
      this.hide();
      return;
    }
    if (!coverOccludesSprite(tileX, tileY, playerDepth)) {
      this.hide();
      return;
    }
    paintGhost(this.ghost, player);
  }

  destroy() {
    this.ghost.destroy();
  }
}

/**
 * Faint copies of other players, zombies, NPCs, and animals that are drawn
 * under cover. Shown only while the local player is looking their way and
 * still has a clear sight line (the art hides them, the tiles do not).
 */
export class OccludedEntityGhosts {
  private readonly byId = new Map<string, Phaser.GameObjects.Sprite>();
  private readonly spare: Phaser.GameObjects.Sprite[] = [];

  constructor(private readonly scene: Phaser.Scene) {}

  hide(id: string) {
    const ghost = this.byId.get(id);
    if (!ghost) return;
    ghost.setVisible(false);
    this.byId.delete(id);
    this.spare.push(ghost);
  }

  hideAll() {
    for (const id of [...this.byId.keys()]) this.hide(id);
  }

  sync(args: {
    id: string;
    kind: string;
    sprite: Phaser.GameObjects.Sprite;
    tileX: number;
    tileY: number;
    depth: number;
    worldX: number;
    worldY: number;
    skip: boolean;
    viewer: SeenThroughViewer | null;
    hasLineOfSight: (fromX: number, fromY: number, toX: number, toY: number) => boolean;
  }) {
    const { id, sprite, viewer } = args;
    if (
      args.skip ||
      !viewer ||
      !SEEN_THROUGH_KINDS.has(args.kind) ||
      !sprite.visible ||
      sprite.alpha <= 0
    ) {
      this.hide(id);
      return;
    }
    const dx = args.worldX - viewer.x;
    const dy = args.worldY - viewer.y;
    if (!facingWithinOneBearing(viewer.facing, dx, dy)) {
      this.hide(id);
      return;
    }
    if (!coverOccludesSprite(args.tileX, args.tileY, args.depth)) {
      this.hide(id);
      return;
    }
    if (!args.hasLineOfSight(viewer.x, viewer.y, args.worldX, args.worldY)) {
      this.hide(id);
      return;
    }

    let ghost = this.byId.get(id);
    if (ghost && !ghost.scene) {
      this.byId.delete(id);
      ghost = undefined;
    }
    if (!ghost) {
      ghost = this.spare.pop() ?? makeGhost(this.scene);
      this.byId.set(id, ghost);
    }
    if (!paintGhost(ghost, sprite)) this.hide(id);
  }

  destroy() {
    for (const ghost of this.byId.values()) ghost.destroy();
    for (const ghost of this.spare) ghost.destroy();
    this.byId.clear();
    this.spare.length = 0;
  }
}
