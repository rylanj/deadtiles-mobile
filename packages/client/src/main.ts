import Phaser from "phaser";
import { AudioManager } from "./audio/AudioManager";
import { applyMobileBodyClass } from "./device";
import { BootScene } from "./scenes/BootScene";
import { MainMenuScene } from "./scenes/MainMenuScene";
import { WorldScene } from "./scenes/WorldScene";
import { setBootLoadingStatus } from "./ui/bootLoading";

applyMobileBodyClass();
setBootLoadingStatus("Starting game…");

// Create the Web Audio context before Phaser and resume it on the first
// pointer or key (boot overlay and HTML menu included). Starting the menu
// bed before the context is running leaves a silent source after unlock.
const audioContext = AudioManager.arm();

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: "#1a2332",
  roundPixels: true,
  render: {
    // Mobile previously forced antialias off → nearest-neighbor sampling looked
    // heavily pixelated whenever the camera zoomed. Linear filtering is cheap
    // relative to our already-reduced mobile draw radius.
    antialias: true,
    antialiasGL: true,
    pixelArt: false,
    powerPreference: "default",
  },
  audio: {
    context: audioContext,
  },
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
};

const game = new Phaser.Game(config);

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
function syncGameViewport() {
  const size = gameViewportSize();
  if (!size || !game.scale) return;
  const scale = game.scale;
  const canvas = game.canvas;
  const sizeMatches = scale.width === size.width && scale.height === size.height;
  const bufferMatches =
    !!canvas && canvas.width === size.width && canvas.height === size.height;
  if (sizeMatches && bufferMatches) return;
  if (sizeMatches) {
    // resize() ignores an unchanged game size, so step off it and back.
    scale.resize(size.width, size.height + 1);
  }
  scale.resize(size.width, size.height);
}

function syncGameViewportSoon() {
  syncGameViewport();
  window.setTimeout(syncGameViewport, 50);
  window.setTimeout(syncGameViewport, 250);
  window.setTimeout(syncGameViewport, 600);
}

window.addEventListener("resize", syncGameViewport);
window.addEventListener("orientationchange", syncGameViewportSoon);
window.visualViewport?.addEventListener("resize", syncGameViewportSoon);
screen.orientation?.addEventListener("change", syncGameViewportSoon);
