import Phaser from "phaser";
import { loadSurvivorAssets } from "../sprites/EntitySprites";
import { markBootEntityPacksReady } from "../sprites/EntityAssetLoader";
import { configureBuildingTextures, loadBuildingAssets } from "../sprites/BuildingAssets";
import { configureFenceTextures, loadFenceAssets } from "../sprites/FenceAssets";
import { configurePropTextures, loadPropAssets } from "../sprites/PropAssets";
import { configureInteriorAnimations } from "../sprites/InteriorAssets";
import { loadCombatAssets } from "../sprites/CombatAssets";
import {
  bakeIsoGroundTextureAt,
  groundTextureIsLoaded,
  isoGroundTextureCount,
} from "../world/TileTextures";
import { AudioManager } from "../audio/AudioManager";
import { stepBirchportBootChart } from "@zombie/shared";
import { isWorldJoinActive, markBootAssetsReady } from "../gameLoadState";
import {
  noteAssetLoadStarted,
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



type BootPhase = "bake" | "setup" | "rebake" | "chart" | "charting" | "done";

export class BootScene extends Phaser.Scene {
  private bootPhase: BootPhase = "bake";
  private bakeIndex = 0;
  private bootTimer = 0;

  constructor() {
    super("BootScene");
  }

  preload() {
    noteAssetLoadStarted();
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
    // Optional SFX. Missing files stay silent (see public/assets/audio/README.md).
    AudioManager.get().preload(this);
  }

  create() {
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.clearTimeout(this.bootTimer);
    });
    // setTimeout, not Phaser's clock. On mobile the game loop can stall after
    // the last asset lands, which left the loader on Preparing 100%.
    this.bootTimer = window.setTimeout(() => this.stepBoot(), 0);
  }

  /** One small piece of boot work, then yield so the phone can paint. */
  private stepBoot() {
    this.bootTimer = 0;
    if (!this.sys.isActive() || this.bootPhase === "done") return;
    this.wakeGameLoop();
    let finished = false;
    try {
      if (this.bootPhase === "bake" || this.bootPhase === "rebake") {
        setBootLoadingStatus("Preparing world…");
        bakeIsoGroundTextureAt(this, this.bakeIndex);
        this.bakeIndex++;
        if (this.bakeIndex >= isoGroundTextureCount()) {
          this.bakeIndex = 0;
          this.bootPhase = this.bootPhase === "bake" ? "setup" : "chart";
        }
      } else if (this.bootPhase === "setup") {
        this.installFallbacks();
        this.bootPhase = "rebake";
      } else if (this.bootPhase === "chart") {
        // Paint the new status before the chart buffer is allocated.
        setBootLoadingStatus("Charting Birchport");
        this.bootPhase = "charting";
      } else if (this.bootPhase === "charting") {
        if (stepBirchportBootChart(12)) {
          this.finishBoot();
          finished = true;
        }
      }
    } catch (err) {
      console.error(err);
      // A failed texture or chart must not trap the player on the loader.
      if (this.bootPhase === "bake") {
        try {
          this.installFallbacks();
        } catch (fallbackErr) {
          console.error(fallbackErr);
        }
      }
      this.finishBoot();
      return;
    }
    if (!finished && this.sys.isActive()) {
      this.bootTimer = window.setTimeout(() => this.stepBoot(), 0);
    }
  }

  private wakeGameLoop() {
    const loop = this.game.loop;
    if (!loop.running) loop.wake();
  }

  private installFallbacks() {
    markBootEntityPacksReady(this);
    AudioManager.get().bind(this);
    configureBuildingTextures(this);
    configureFenceTextures(this);
    configurePropTextures(this);
    configureInteriorAnimations(this);
    createBloodDropTexture(this);
    createDustParticleTexture(this);
    if (!this.textures.exists("bullet-impact")) {
      createBulletImpactFallback(this);
    }
    if (this.textures.exists("decal-blood1")) {
      this.textures.get("decal-blood1").setFilter(Phaser.Textures.FilterMode.NEAREST);
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
    if (!groundTextureIsLoaded(this, "tile-office")) {
      createFallbackTile(this, "tile-office", 0x8d8d90);
    }
    if (!groundTextureIsLoaded(this, "tile-retail")) {
      createFallbackTile(this, "tile-retail", 0x765836);
    }
    if (!groundTextureIsLoaded(this, "tile-diner")) {
      createFallbackTile(this, "tile-diner", 0x9a9a96);
    }
    if (!groundTextureIsLoaded(this, "tile-gunshop")) {
      createFallbackTile(this, "tile-gunshop", 0x3e2a1c);
    }
    if (!groundTextureIsLoaded(this, "tile-hallway")) {
      createFallbackTile(this, "tile-hallway", 0x969c90);
    }
    if (!groundTextureIsLoaded(this, "tile-linoleum")) {
      createFallbackTile(this, "tile-linoleum", 0xb4b29a);
    }
    if (!groundTextureIsLoaded(this, "tile-carpet-blue")) {
      createFallbackTile(this, "tile-carpet-blue", 0x425476);
    }
    if (!groundTextureIsLoaded(this, "tile-carpet-beige")) {
      createFallbackTile(this, "tile-carpet-beige", 0xbeac8c);
    }

    // Furniture placeholders are deliberately NOT created here. Furniture art is
    // lazy now, so a boot-time placeholder under the same key would satisfy every
    // "is this loaded?" check and permanently hide the real art once it arrives.
    // Call sites already degrade gracefully while the pack is in flight.
  }

  private finishBoot() {
    if (this.bootPhase === "done") {
      markBootAssetsReady();
      return;
    }
    this.bootPhase = "done";
    try {
      if (document.body.classList.contains("main-menu-open") && !isWorldJoinActive()) {
        AudioManager.get().playMenu();
      }
      // Stay alive for menu audio, but don't redraw a full canvas under the menu.
      this.scene.setVisible(false);
    } catch (err) {
      console.error(err);
    }
    markBootAssetsReady();
  }
}
