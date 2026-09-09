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

new Phaser.Game(config);
