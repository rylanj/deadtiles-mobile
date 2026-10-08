import Phaser from "phaser";

export function loadCombatAssets(scene: Phaser.Scene) {
  scene.load.setPath("/assets");
  scene.load.image("bullet-impact", "BulletImpact.png");
  scene.load.image("decal-blood1", "Misc/Blood1.png");
}
