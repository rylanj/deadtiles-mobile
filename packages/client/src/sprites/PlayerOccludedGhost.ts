import Phaser from "phaser";
import {
  getOccludingBuildingsForPlayerOutline,
  getOccludingTreesForPlayerOutline,
  OCCLUSION_OVERLAY_DEPTH,
} from "../world/BuildingOcclusion";

/** Faint enough to read as "behind that", solid enough to track while moving. */
const GHOST_ALPHA = 0.42;

/**
 * Mobile stand-in for PlayerOcclusionHighlight.
 *
 * The silhouette outline needs a BitmapMask plus per-frame tree mask images,
 * which contributed to GPU memory crashes on phones. This draws a faint copy of
 * the player above the occluder instead: same "you are behind this" read, one
 * extra sprite, no mask and no extra textures.
 */
export class PlayerOccludedGhost {
  private ghost: Phaser.GameObjects.Sprite;

  constructor(scene: Phaser.Scene) {
    this.ghost = scene.add.sprite(0, 0, "__DEFAULT");
    this.ghost.setVisible(false);
    this.ghost.setDepth(OCCLUSION_OVERLAY_DEPTH);
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

    const occluded =
      getOccludingBuildingsForPlayerOutline(tileX, tileY, playerDepth).length >
        0 ||
      getOccludingTreesForPlayerOutline(tileX, tileY, playerDepth).length > 0;
    if (!occluded) {
      this.hide();
      return;
    }

    const key = player.texture?.key;
    if (!key || !this.ghost.scene.textures.exists(key)) {
      this.hide();
      return;
    }
    this.ghost.setTexture(key, player.frame.name);
    this.ghost.setPosition(player.x, player.y);
    this.ghost.setOrigin(player.originX, player.originY);
    this.ghost.setScale(player.scaleX, player.scaleY);
    this.ghost.setFlipX(player.flipX);
    this.ghost.setFlipY(player.flipY);
    this.ghost.setRotation(player.rotation);
    this.ghost.setDisplaySize(player.displayWidth, player.displayHeight);
    // Keep damage flashes and fades readable on the copy too.
    if (player.isTinted) {
      this.ghost.setTint(
        player.tintTopLeft,
        player.tintTopRight,
        player.tintBottomLeft,
        player.tintBottomRight,
      );
    } else {
      this.ghost.clearTint();
    }
    this.ghost.setAlpha(player.alpha * GHOST_ALPHA);
    this.ghost.setVisible(true);
  }

  destroy() {
    this.ghost.destroy();
  }
}
