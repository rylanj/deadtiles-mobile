import Phaser from "phaser";
import { AudioManager } from "../audio/AudioManager";
import type { AuthSession } from "../network/ColyseusClient";
import { cancelPendingWorldJoin, startWorldSession } from "../startWorld";
import { MainMenu } from "../ui/MainMenu";
import { hideBootLoading } from "../ui/bootLoading";

/**
 * Menu shown again after leaving the world. The first visit is mounted from
 * main.ts before this scene exists.
 */
export class MainMenuScene extends Phaser.Scene {
  private menu?: MainMenu;

  constructor() {
    super("MainMenuScene");
  }

  create() {
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onLeave, this);
    hideBootLoading(true);
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

  private startGame(session: AuthSession) {
    if (!this.menu) return;
    void startWorldSession(this.game, this.menu, session, () => !this.sys.isActive());
  }

  /** Phaser does not call a scene `shutdown` method. The SHUTDOWN event does. */
  private onLeave() {
    cancelPendingWorldJoin();
    AudioManager.get().fadeOutMenu();
    document.body.classList.remove("main-menu-open");
    this.menu?.destroy();
    this.menu = undefined;
  }
}
