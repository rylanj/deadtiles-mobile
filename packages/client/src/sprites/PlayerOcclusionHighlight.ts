import Phaser from "phaser";
import {
  BuildingOcclusionMask,
  OCCLUSION_OVERLAY_DEPTH,
} from "../world/BuildingOcclusion";
import {
  registerSpriteAlphaOutlinePipeline,
  SPRITE_ALPHA_OUTLINE_PIPELINE,
} from "./SpriteAlphaOutlinePipeline";

/**
 * Draws a crisp white silhouette outline on the local player wherever a
 * building, tree, or player wall occludes them. The mask keeps it to real
 * pixels, not the full PNG bounding box.
 */
export class PlayerOcclusionHighlight {
  private outlineSprite: Phaser.GameObjects.Sprite;
  private occlusionMask: BuildingOcclusionMask;

  constructor(scene: Phaser.Scene) {
    registerSpriteAlphaOutlinePipeline(scene.game);

    this.outlineSprite = scene.add.sprite(0, 0, "__DEFAULT");
    this.outlineSprite.setVisible(false);
    this.outlineSprite.setDepth(OCCLUSION_OVERLAY_DEPTH);
    if (scene.game.renderer.type === Phaser.WEBGL) {
      this.outlineSprite.setPipeline(SPRITE_ALPHA_OUTLINE_PIPELINE);
    }

    this.occlusionMask = new BuildingOcclusionMask(scene);
    this.outlineSprite.setMask(this.occlusionMask.bitmapMask);
  }

  hide() {
    this.outlineSprite.setVisible(false);
    this.occlusionMask.clear();
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

    if (!this.occlusionMask.applyForPlayerOutline(tileX, tileY, playerDepth)) {
      this.hide();
      return;
    }

    this.syncSpriteFrom(player);
    this.outlineSprite.setVisible(true);
  }

  private syncSpriteFrom(source: Phaser.GameObjects.Sprite) {
    const key = source.texture?.key;
    if (!key || !this.outlineSprite.scene.textures.exists(key)) {
      this.hide();
      return;
    }
    this.outlineSprite.setTexture(key, source.frame.name);
    this.outlineSprite.setPosition(source.x, source.y);
    this.outlineSprite.setOrigin(source.originX, source.originY);
    this.outlineSprite.setScale(source.scaleX, source.scaleY);
    this.outlineSprite.setFlipX(source.flipX);
    this.outlineSprite.setFlipY(source.flipY);
    this.outlineSprite.setRotation(source.rotation);
    this.outlineSprite.setDisplaySize(source.displayWidth, source.displayHeight);
  }

  destroy() {
    this.outlineSprite.destroy();
    this.occlusionMask.destroy();
  }
}
