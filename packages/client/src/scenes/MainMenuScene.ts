import Phaser from "phaser";
import {
  connectToWorld,
  storeAuthSession,
  type AuthSession,
} from "../network/ColyseusClient";
import { AudioManager } from "../audio/AudioManager";
import { MainMenu } from "../ui/MainMenu";
import { hideBootLoading, showWorldEntering } from "../ui/bootLoading";

/**
 * Post-boot menu — wallet login, then connect to the world room.
 */
export class MainMenuScene extends Phaser.Scene {
  private menu?: MainMenu;
  /** Prevents double-tap / duplicate Enter world from starting two joins. */
  private startingGame = false;

  constructor() {
    super("MainMenuScene");
  }

  create() {
    hideBootLoading();
    this.startingGame = false;
    document.body.classList.add("main-menu-open");
    AudioManager.get().bind(this);
    AudioManager.get().playMenu();
    this.menu = new MainMenu({
      onPlay: (session) => {
        void this.startGame(session);
      },
    });

    const menuError = this.registry.get("menuError") as string | undefined;
    if (menuError) {
      this.menu.showError(menuError);
      this.registry.remove("menuError");
    }
  }

  private async startGame(session: AuthSession) {
    if (this.startingGame || !this.menu) return;
    this.startingGame = true;
    this.menu.setBusy(true, "Connecting to world…");
    AudioManager.get().fadeOutMenu();
    // Ensure profile is cached before entering so a mid-session server drop
    // can return to Enter world without clearing the login.
    storeAuthSession(session);
    this.registry.set("playerName", session.name ?? "");
    this.registry.remove("menuError");

    let room: Awaited<ReturnType<typeof connectToWorld>>["room"] | undefined;
    try {
      const connected = await connectToWorld(session.sessionToken);
      room = connected.room;
      // Aborted if this scene was replaced while connecting (duplicate Enter world).
      if (!this.sys.isActive()) {
        try {
          await room.leave();
        } catch {
          /* ignore */
        }
        return;
      }
      this.registry.set("worldRoom", room);
      this.registry.set("playerId", connected.playerId);
      this.registry.set("spawnEntities", connected.spawnEntities);
      // Cover the canvas before WorldScene mounts so no fallback sprites flash.
      showWorldEntering("Entering world…");
      document.body.classList.remove("main-menu-open");
      this.menu.destroy();
      this.menu = undefined;
      this.scene.start("WorldScene");
    } catch (err) {
      console.error(err);
      const detail = err instanceof Error ? err.message : String(err);
      this.startingGame = false;
      if (room) {
        try {
          await room.leave();
        } catch {
          /* ignore */
        }
      }
      this.menu?.showError(detail);
      AudioManager.get().playMenu();
    }
  }

  shutdown() {
    AudioManager.get().fadeOutMenu();
    document.body.classList.remove("main-menu-open");
    this.startingGame = false;
    this.menu?.destroy();
    this.menu = undefined;
  }
}
