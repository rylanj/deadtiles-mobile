import { armSharedAudioContext } from "./audio/audioContext";
import { applyMobileBodyClass } from "./device";
import { beginWorldJoin, endWorldJoin, isBootReady } from "./gameLoadState";
import type { AuthSession } from "./network/ColyseusClient";
import { MainMenu } from "./ui/MainMenu";
import {
  beginCodeLoadProgress,
  hideBootLoading,
  setBootLoadingStatus,
  showBootLoading,
} from "./ui/bootLoading";

try {
  applyMobileBodyClass();
} catch (err) {
  console.error(err);
}
try {
  // Audio must not be able to stop the menu from appearing.
  armSharedAudioContext();
} catch (err) {
  console.error(err);
}
hideBootLoading(true);

document.body.classList.add("main-menu-open");

let menu: MainMenu | undefined;
let gameModulePromise: Promise<typeof import("./gameRuntime")> | null = null;

function loadGameModule() {
  if (!gameModulePromise) {
    beginCodeLoadProgress();
    gameModulePromise = import("./gameRuntime").catch((err) => {
      gameModulePromise = null;
      throw err;
    });
  }
  return gameModulePromise;
}

try {
  menu = new MainMenu({
    onPlay: (session: AuthSession) => {
      const active = menu;
      if (!active) return;
      beginWorldJoin();
      if (!isBootReady()) showBootLoading();
      void loadGameModule()
        .then((mod) => mod.enterWorld(active, session))
        .catch((err) => {
          console.error(err);
          endWorldJoin();
          hideBootLoading(true);
          const detail = err instanceof Error ? err.message : "Could not load the game";
          active.showError(detail);
        });
    },
  });
} catch (err) {
  console.error(err);
  showBootLoading();
  setBootLoadingStatus(err instanceof Error ? err.message : "Could not open the menu");
}

// Let the menu paint before the game bundle is parsed. On a phone that parse
// was freezing the first screen on Starting 0%.
window.setTimeout(() => {
  void loadGameModule()
    .then((mod) => mod.beginBackgroundGameLoad())
    .catch((err) => {
      console.error(err);
    });
}, 50);
