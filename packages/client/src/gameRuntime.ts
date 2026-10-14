import Phaser from "phaser";
import { AudioManager } from "./audio/AudioManager";
import { armSharedAudioContext } from "./audio/audioContext";
import {
  beginWorldJoin,
  bootAssetsReady,
  endWorldJoin,
  isBootReady,
} from "./gameLoadState";
import type { AuthSession } from "./network/ColyseusClient";
import { BootScene } from "./scenes/BootScene";
import { MainMenuScene } from "./scenes/MainMenuScene";
import { WorldScene } from "./scenes/WorldScene";
import { startWorldSession } from "./startWorld";
import type { MainMenu } from "./ui/MainMenu";
import {
  hideBootLoading,
  isBootOverlayOpen,
  setBootLoadingStatus,
  showBootLoading,
} from "./ui/bootLoading";

let game: Phaser.Game | null = null;
let loadPromise: Promise<void> | null = null;
let viewportBound = false;

/** Parent box in CSS pixels. Skips the 0-size frame Android reports mid-rotation. */
function gameViewportSize(): { width: number; height: number } | null {
  const parent = document.getElementById("game");
  const rect = parent?.getBoundingClientRect();
  const width = Math.round(rect?.width || window.innerWidth);
  const height = Math.round(rect?.height || window.innerHeight);
  if (width < 2 || height < 2) return null;
  return { width, height };
}

/**
 * Phaser's resize listener treats a return to the previous size as a no-op,
 * so a bad size latched during rotation stays after you turn the phone back.
 * Re-measure the parent and push that size into the renderer.
 */
function syncGameViewport(target: Phaser.Game) {
  const size = gameViewportSize();
  if (!size || !target.scale) return;
  const scale = target.scale;
  const canvas = target.canvas;
  const sizeMatches = scale.width === size.width && scale.height === size.height;
  const bufferMatches =
    !!canvas && canvas.width === size.width && canvas.height === size.height;
  if (sizeMatches && bufferMatches) return;
  if (sizeMatches) {
    scale.resize(size.width, size.height + 1);
  }
  scale.resize(size.width, size.height);
}

function bindGameViewport(target: Phaser.Game) {
  if (viewportBound) return;
  viewportBound = true;
  const sync = () => syncGameViewport(target);
  const syncSoon = () => {
    sync();
    window.setTimeout(sync, 50);
    window.setTimeout(sync, 250);
    window.setTimeout(sync, 600);
  };
  window.addEventListener("resize", sync);
  window.addEventListener("orientationchange", syncSoon);
  window.visualViewport?.addEventListener("resize", syncSoon);
  screen.orientation?.addEventListener("change", syncSoon);
}

function createGame() {
  if (game) return;
  let audioContext: AudioContext | undefined;
  try {
    audioContext = AudioManager.arm();
  } catch (err) {
    console.error(err);
  }
  game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: "game",
      backgroundColor: "#1a2332",
      roundPixels: true,
      render: {
        antialias: true,
        antialiasGL: true,
        pixelArt: false,
        powerPreference: "default",
      },
      ...(audioContext ? { audio: { context: audioContext } } : {}),
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.NO_CENTER,
        width: window.innerWidth,
        height: window.innerHeight,
      },
      scene: [BootScene, MainMenuScene, WorldScene],
      input: {
        activePointers: 3,
      },
      // window.focus() during boot makes some mobile webviews drop frames
      // and never leave the loading screen.
      autoFocus: false,
    });
  bindGameViewport(game);
}

function launch(): Promise<void> {
  if (!game) {
    // One frame after the game bundle evaluates, so the menu can paint
    // before WebGL setup. Doing both in one turn left phones on Starting 0%.
    return new Promise((resolve, reject) => {
      window.setTimeout(() => {
        try {
          createGame();
          resolve(bootAssetsReady);
        } catch (err) {
          reject(err);
        }
      }, 0);
    });
  }
  return bootAssetsReady;
}

/** Start Phaser and asset fetches. Safe to call more than once. */
export function beginBackgroundGameLoad(): Promise<void> {
  if (!loadPromise) {
    loadPromise = launch().catch((err) => {
      if (!game) loadPromise = null;
      throw err;
    });
  }
  return loadPromise;
}

/**
 * Foreground the in-progress download if the player hits Enter world early,
 * then join the room.
 */
export async function enterWorld(menu: MainMenu, session: AuthSession): Promise<void> {
  beginWorldJoin();
  AudioManager.get().fadeOutMenu();
  if (!isBootReady()) showBootLoading();
  try {
    await beginBackgroundGameLoad();
  } catch (err) {
    console.error(err);
    hideBootLoading(true);
    endWorldJoin();
    const detail = err instanceof Error ? err.message : "Could not load the game";
    menu.showError(detail);
    return;
  }
  if (!game) {
    hideBootLoading(true);
    endWorldJoin();
    menu.showError("Could not load the game");
    return;
  }
  if (isBootOverlayOpen()) setBootLoadingStatus("Connecting to world…");
  // armSharedAudioContext is already installed from the menu entry. Touching
  // it here keeps the resumed context if Phaser was created on a later tick.
  armSharedAudioContext();
  await startWorldSession(game, menu, session);
}
