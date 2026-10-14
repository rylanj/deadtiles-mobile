import type Phaser from "phaser";
import { AudioManager } from "./audio/AudioManager";
import type { AuthSession } from "./network/ColyseusClient";
import {
  connectToWorld,
  storeAuthSession,
} from "./network/ColyseusClient";
import { beginWorldJoin, endWorldJoin } from "./gameLoadState";
import type { MainMenu } from "./ui/MainMenu";
import { hideBootLoading, showWorldEntering } from "./ui/bootLoading";

type JoinPhase = "idle" | "joining" | "entered";

let joinPhase: JoinPhase = "idle";

/** Scene shutdown while a join is still in flight. Does not drop a live room. */
export function cancelPendingWorldJoin() {
  if (joinPhase === "entered") return;
  joinPhase = "idle";
  endWorldJoin();
}

/**
 * Connect and hand off to WorldScene. Assets are already loaded.
 * `isCancelled` aborts if the menu scene was torn down mid-connect.
 */
export async function startWorldSession(
  game: Phaser.Game,
  menu: MainMenu,
  session: AuthSession,
  isCancelled: () => boolean = () => !document.getElementById("main-menu"),
): Promise<void> {
  if (joinPhase === "joining" || joinPhase === "entered") return;
  joinPhase = "joining";
  beginWorldJoin();
  menu.setBusy(true, "Connecting to world…");
  AudioManager.get().fadeOutMenu();
  storeAuthSession(session);
  game.registry.set("playerName", session.name ?? "");
  game.registry.remove("menuError");

  let room: Awaited<ReturnType<typeof connectToWorld>>["room"] | undefined;
  try {
    const connected = await connectToWorld(session.sessionToken);
    room = connected.room;
    if (isCancelled()) {
      try {
        await room.leave();
      } catch {
        /* ignore */
      }
      joinPhase = "idle";
      endWorldJoin();
      return;
    }
    game.registry.set("worldRoom", room);
    game.registry.set("colyseusClient", connected.client);
    game.registry.set("playerId", connected.playerId);
    game.registry.set("spawnEntities", connected.spawnEntities);
    joinPhase = "entered";
    showWorldEntering("Entering world…");
    document.body.classList.remove("main-menu-open");
    menu.destroy();
    hideBootLoading();
    // ScenePlugin.start stops the scene it is called on and runs WorldScene
    // on the next tick. That is BootScene on the first visit and MainMenuScene
    // after a return. game.scene.start would leave the old camera running.
    const active = game.scene.getScenes(true)[0];
    if (active) active.scene.start("WorldScene");
    else game.scene.start("WorldScene");
    joinPhase = "idle";
    endWorldJoin();
  } catch (err) {
    console.error(err);
    const detail = err instanceof Error ? err.message : String(err);
    joinPhase = "idle";
    endWorldJoin();
    hideBootLoading(true);
    if (room) {
      try {
        await room.leave();
      } catch {
        /* ignore */
      }
    }
    if (!isCancelled()) {
      menu.showError(detail);
      AudioManager.get().playMenu();
    }
  }
}
