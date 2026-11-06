import { BACKPACK_FANNY_ID, GIFT_BOX_ITEM_ID } from "@zombie/shared";
import { getSharedAudioContext } from "./audioContext";
import { getItemIconPath } from "../ui/itemIcons";
import { PLAYER_AVATAR_SKIN_COUNT, playerAvatarSrc } from "../ui/playerAvatar";

const MENU_M4A = "/assets/audio/Menu.m4a";
const MENU_OGG = "/assets/audio/Menu.ogg";

/** Items the login screen can show: invite rewards and the weapon hotbar. */
const MENU_ITEM_IDS = [
  "banknote",
  BACKPACK_FANNY_ID,
  GIFT_BOX_ITEM_ID,
  "safe",
  "rep",
  "weapon_pistol",
  "weapon_revolver",
  "weapon_shotgun",
  "weapon_hunting_rifle",
  "weapon_assault_rifle",
  "weapon_m4a1",
  "weapon_hammer",
  "weapon_hatchet",
  "weapon_bat",
];

let started = false;
let buffer: AudioBuffer | null = null;
let source: AudioBufferSourceNode | null = null;
let gainNode: GainNode | null = null;
let loadedLabel = "Menu.m4a";
const readyListeners: Array<() => void> = [];

function prefersM4a(): boolean {
  const el = document.createElement("audio");
  return Boolean(
    el.canPlayType('audio/mp4; codecs="mp4a.40.2"') ||
      el.canPlayType("audio/x-m4a") ||
      el.canPlayType("audio/aac"),
  );
}

async function decodeUrl(url: string): Promise<AudioBuffer> {
  const res = await fetch(url, { priority: "high" });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const raw = await res.arrayBuffer();
  return getSharedAudioContext().decodeAudioData(raw.slice(0));
}

function warmImage(url: string) {
  const img = new Image();
  img.fetchPriority = "low";
  img.decoding = "async";
  img.src = url;
}

/** Avatars and menu icons. Issued after the music request so they stay behind it. */
function warmMenuImages() {
  for (let skin = 1; skin <= PLAYER_AVATAR_SKIN_COUNT; skin++) {
    warmImage(playerAvatarSrc(skin));
  }
  warmImage("/brand/deadtiles-mark.svg");
  for (const id of MENU_ITEM_IDS) {
    const path = getItemIconPath(id);
    if (path) warmImage(path);
  }
}

/**
 * First network request from the menu: the login music.
 * Playback can start as soon as this buffer decodes. The world loader does not fetch it again.
 */
export function startMenuPreload(): void {
  if (started) return;
  started = true;
  const first = prefersM4a() ? MENU_M4A : MENU_OGG;
  const second = first === MENU_M4A ? MENU_OGG : MENU_M4A;
  loadedLabel = first.endsWith(".ogg") ? "Menu.ogg" : "Menu.m4a";
  void decodeUrl(first)
    .catch(() => {
      loadedLabel = second.endsWith(".ogg") ? "Menu.ogg" : "Menu.m4a";
      return decodeUrl(second);
    })
    .then((audio) => {
      buffer = audio;
      for (const listener of readyListeners) listener();
      readyListeners.length = 0;
    })
    .catch((err) => {
      console.error("[audio] menu", err);
    });
  warmMenuImages();
}

export function whenMenuBufferReady(cb: () => void): void {
  if (buffer) {
    cb();
    return;
  }
  readyListeners.push(cb);
}

export function menuBedPlaying(): boolean {
  return source != null;
}

export function setMenuBedGain(value: number): void {
  if (!gainNode) return;
  gainNode.gain.value = value;
}

/** Start the loop if the buffer is decoded and Web Audio is running. */
export function startMenuBed(gainValue: number): boolean {
  if (source) {
    setMenuBedGain(gainValue);
    return true;
  }
  if (!buffer) return false;
  const ctx = getSharedAudioContext();
  if (ctx.state !== "running") return false;
  const gain = ctx.createGain();
  gain.gain.value = gainValue;
  gain.connect(ctx.destination);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  src.connect(gain);
  src.onended = () => {
    if (source !== src) return;
    source = null;
    gainNode = null;
  };
  try {
    src.start();
  } catch (err) {
    console.error("[audio] menu", err);
    try {
      src.disconnect();
      gain.disconnect();
    } catch {
      /* already disconnected */
    }
    return false;
  }
  source = src;
  gainNode = gain;
  console.log(`[audio] ${loadedLabel} (loop)`);
  return true;
}

export function stopMenuBed(): void {
  const src = source;
  const node = gainNode;
  source = null;
  gainNode = null;
  try {
    src?.stop();
    src?.disconnect();
    node?.disconnect();
  } catch {
    /* already stopped */
  }
}
