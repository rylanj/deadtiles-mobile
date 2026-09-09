import Phaser from "phaser";
import type { StreetlightFacing } from "@zombie/shared";

export const STREETLIGHT_FACINGS: StreetlightFacing[] = ["SE", "SW"];

export function streetlightTextureKey(facing: StreetlightFacing): string {
  return `streetlight-1-${facing.toLowerCase()}`;
}

export function loadPropAssets(scene: Phaser.Scene) {
  scene.load.setPath("/assets");
  for (const facing of STREETLIGHT_FACINGS) {
    scene.load.image(
      streetlightTextureKey(facing),
      `Props/Streetlight1/Streetlight1_${facing}.png`,
    );
  }
}

/** Call once after prop textures have finished loading. */
export function configurePropTextures(scene: Phaser.Scene) {
  for (const facing of STREETLIGHT_FACINGS) {
    const key = streetlightTextureKey(facing);
    if (!scene.textures.exists(key)) continue;
    scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
  }
}
