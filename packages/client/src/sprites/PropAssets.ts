import Phaser from "phaser";
import type { StreetlightFacing } from "@zombie/shared";

export const STREETLIGHT_FACINGS: StreetlightFacing[] = ["SE", "SW"];

export function streetlightTextureKey(facing: StreetlightFacing): string {
  return `streetlight-1-${facing.toLowerCase()}`;
}

export function graveTextureKey(): string {
  return "grave-1-se";
}

export function cellarTextureKey(): string {
  return "cellar-1-se";
}

export function loadPropAssets(scene: Phaser.Scene) {
  scene.load.setPath("/assets");
  for (const facing of STREETLIGHT_FACINGS) {
    scene.load.image(
      streetlightTextureKey(facing),
      `Props/Streetlight1/Streetlight1_${facing}.png`,
    );
  }
  scene.load.image(
    graveTextureKey(),
    "Furniture/Grave1/Grave1_Idle_SE.png",
  );
  scene.load.image(
    cellarTextureKey(),
    "Furniture/Cellar1/Cellar1_Idle_SE.png",
  );
}

/** Call once after prop textures have finished loading. */
export function configurePropTextures(scene: Phaser.Scene) {
  for (const facing of STREETLIGHT_FACINGS) {
    const key = streetlightTextureKey(facing);
    if (!scene.textures.exists(key)) continue;
    scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
  }
  const graveKey = graveTextureKey();
  if (scene.textures.exists(graveKey)) {
    scene.textures.get(graveKey).setFilter(Phaser.Textures.FilterMode.LINEAR);
  }
  const cellarKey = cellarTextureKey();
  if (scene.textures.exists(cellarKey)) {
    scene.textures.get(cellarKey).setFilter(Phaser.Textures.FilterMode.LINEAR);
  }
}
