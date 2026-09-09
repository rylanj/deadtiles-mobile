import Phaser from "phaser";
import { loadSurvivorAssets } from "../sprites/EntitySprites";
import { markBootEntityPacksReady } from "../sprites/EntityAssetLoader";
import { configureBuildingTextures, loadBuildingAssets } from "../sprites/BuildingAssets";
import { configureFenceTextures, loadFenceAssets } from "../sprites/FenceAssets";
import { configurePropTextures, loadPropAssets } from "../sprites/PropAssets";
import { configureInteriorAnimations } from "../sprites/InteriorAssets";
import { loadCombatAssets } from "../sprites/CombatAssets";
import { bakeIsoGroundTextures, groundTextureIsLoaded } from "../world/TileTextures";
import { AudioManager } from "../audio/AudioManager";
import {
  setBootLoadingProgress,
  setBootLoadingStatus,
} from "../ui/bootLoading";

function createBloodDropTexture(scene: Phaser.Scene) {
  const size = 8;
  const g = scene.add.graphics();
  g.fillStyle(0xcc1111, 1);
  g.fillCircle(size / 2, size / 2, size / 2);
  g.generateTexture("blood-drop", size, size);
  g.destroy();
}

function createDustParticleTexture(scene: Phaser.Scene) {
  const size = 14;
  const c = size / 2;
  const g = scene.add.graphics();
  g.fillStyle(0xffffff, 0.12);
  g.fillCircle(c, c, c);
  g.fillStyle(0xffffff, 0.28);
  g.fillCircle(c, c, c * 0.72);
  g.fillStyle(0xffffff, 0.5);
  g.fillCircle(c, c, c * 0.38);
  g.generateTexture("dust-particle", size, size);
  g.destroy();
}

function createBulletImpactFallback(scene: Phaser.Scene) {
  const w = 32;
  const h = 33;
  const g = scene.add.graphics();
  g.fillStyle(0xd8c878, 0.9);
  g.fillCircle(w / 2, h / 2, 10);
  g.fillStyle(0x8a7040, 0.85);
  g.fillCircle(w / 2, h / 2, 5);
  g.lineStyle(2, 0x4a3820, 0.6);
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    g.lineBetween(
      w / 2 + Math.cos(angle) * 6,
      h / 2 + Math.sin(angle) * 6,
      w / 2 + Math.cos(angle) * 14,
      h / 2 + Math.sin(angle) * 14,
    );
  }
  g.generateTexture("bullet-impact", w, h);
  g.destroy();
}

function createFallbackTile(scene: Phaser.Scene, key: string, color: number) {
  if (scene.textures.exists(key)) return;
  const g = scene.add.graphics();
  g.fillStyle(color, 1);
  g.fillPoints(
    [
      { x: 32, y: 0 },
      { x: 64, y: 16 },
      { x: 32, y: 32 },
      { x: 0, y: 16 },
    ],
    true,
  );
  g.generateTexture(key, 64, 32);
  g.destroy();
}



export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  preload() {
    setBootLoadingStatus("Loading assets…");
    this.load.on("progress", (value: number) => {
      setBootLoadingProgress(value);
    });
    this.load.on("complete", () => {
      setBootLoadingProgress(1);
      setBootLoadingStatus("Preparing…");
    });

    loadSurvivorAssets(this);
    loadBuildingAssets(this);
    loadFenceAssets(this);
    loadPropAssets(this);
    // Furniture is deliberately absent here: it is only visible inside
    // interiors and loads on first building enter (see ensureFurnitureAssets).
    loadCombatAssets(this);
    // Optional SFX — missing files stay silent (see public/assets/audio/README.md).
    AudioManager.get().preload(this);
  }

  create() {
    markBootEntityPacksReady(this);
    AudioManager.get().bind(this);
    bakeIsoGroundTextures(this);
    configureBuildingTextures(this);
    configureFenceTextures(this);
    configurePropTextures(this);
    configureInteriorAnimations(this);
    createBloodDropTexture(this);
    createDustParticleTexture(this);
    if (!this.textures.exists("bullet-impact")) {
      createBulletImpactFallback(this);
    }

    if (!groundTextureIsLoaded(this, "tile-ground")) {
      createFallbackTile(this, "tile-ground", 0x3d6b4f);
    }
    if (!groundTextureIsLoaded(this, "tile-path")) {
      createFallbackTile(this, "tile-path", 0x6b5344);
    }
    if (!groundTextureIsLoaded(this, "tile-wood")) {
      createFallbackTile(this, "tile-wood", 0x5c4033);
    }
    if (!groundTextureIsLoaded(this, "tile-concrete")) {
      createFallbackTile(this, "tile-concrete", 0x8a8a8a);
    }
    if (!groundTextureIsLoaded(this, "tile-barracks")) {
      createFallbackTile(this, "tile-barracks", 0x6a5c4a);
    }
    if (!groundTextureIsLoaded(this, "tile-ground-tiles")) {
      createFallbackTile(this, "tile-ground-tiles", 0x6e6e6e);
    }
    if (!groundTextureIsLoaded(this, "tile-hospital")) {
      createFallbackTile(this, "tile-hospital", 0xc8d0d8);
    }
    if (!groundTextureIsLoaded(this, "tile-motel")) {
      createFallbackTile(this, "tile-motel", 0x7a4e45);
    }

    // Re-bake after fallbacks so source cache + display textures exist.
    bakeIsoGroundTextures(this);

    // Furniture placeholders are deliberately NOT created here. Furniture art is
    // lazy now, so a boot-time placeholder under the same key would satisfy every
    // "is this loaded?" check and permanently hide the real art once it arrives.
    // Call sites already degrade gracefully while the pack is in flight.

    this.scene.start("MainMenuScene");
  }
}
