/**
 * Boot progress and the "player already chose Enter world" flag.
 * Kept out of the Phaser bundle so the menu can read them immediately.
 */

type BootState = "pending" | "ready" | "failed";

let bootState: BootState = "pending";
let resolveReady: (() => void) | null = null;
let rejectReady: ((err: unknown) => void) | null = null;

export const bootAssetsReady: Promise<void> = new Promise((resolve, reject) => {
  resolveReady = resolve;
  rejectReady = reject;
});

export function isBootReady(): boolean {
  return bootState === "ready";
}

export function markBootAssetsReady(): void {
  if (bootState !== "pending") return;
  bootState = "ready";
  resolveReady?.();
  resolveReady = null;
  rejectReady = null;
}

export function failBootAssets(err: unknown): void {
  if (bootState !== "pending") return;
  bootState = "failed";
  rejectReady?.(err instanceof Error ? err : new Error("Could not load the game"));
  resolveReady = null;
  rejectReady = null;
}

let worldJoinActive = false;

export function beginWorldJoin(): void {
  worldJoinActive = true;
}

export function endWorldJoin(): void {
  worldJoinActive = false;
}

export function isWorldJoinActive(): boolean {
  return worldJoinActive;
}
