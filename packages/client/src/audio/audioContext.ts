let sharedAudioContext: AudioContext | null = null;
let unlockHooked = false;

/** One AudioContext for the page, created before the game bundle arrives. */
export function getSharedAudioContext(): AudioContext {
  if (sharedAudioContext) return sharedAudioContext;
  const Ctor =
    window.AudioContext ||
    (
      window as unknown as {
        webkitAudioContext: typeof AudioContext;
      }
    ).webkitAudioContext;
  sharedAudioContext = new Ctor();
  return sharedAudioContext;
}

/**
 * Resume Web Audio on the first gesture. The menu can be clicked before Phaser
 * exists, and that click has to unlock the same context the game later uses.
 */
export function armSharedAudioContext(): AudioContext {
  const ctx = getSharedAudioContext();
  if (!unlockHooked) {
    unlockHooked = true;
    const resume = () => {
      if (ctx.state === "suspended" || ctx.state === "interrupted") {
        void ctx.resume();
      }
    };
    const opts: AddEventListenerOptions = { capture: true };
    document.addEventListener("pointerdown", resume, opts);
    document.addEventListener("touchstart", resume, opts);
    document.addEventListener("keydown", resume, opts);
    document.addEventListener("click", resume, opts);
  }
  if (ctx.state === "suspended" || ctx.state === "interrupted") {
    void ctx.resume();
  }
  return ctx;
}
