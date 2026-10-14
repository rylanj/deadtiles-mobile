/** DOM boot / world-enter overlay helpers. */

function el<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

/** Highest percent written so far. Background loading must not rewind the bar. */
let shownProgress = 0;
let assetPhase = false;
let codePump = 0;

export function setBootLoadingStatus(text: string) {
  const status = el<HTMLElement>("boot-loading-status");
  if (status) status.textContent = text;
}

export function setBootLoadingProgress(progress: number, status?: string) {
  const next = Math.min(1, Math.max(0, progress));
  shownProgress = Math.max(shownProgress, next);
  const pct = Math.round(shownProgress * 100);
  const fill = el<HTMLElement>("boot-loading-fill");
  const label = el<HTMLElement>("boot-loading-pct");
  const bar = el<HTMLElement>("boot-loading-bar");
  if (fill) fill.style.width = `${pct}%`;
  if (label) label.textContent = `${pct}%`;
  if (bar) bar.setAttribute("aria-valuenow", String(pct));
  if (status !== undefined) setBootLoadingStatus(status);
  else if (pct >= 100) setBootLoadingStatus("Preparing…");
  else if (pct > 0) setBootLoadingStatus("Loading assets…");
}

/**
 * Ease the hidden bar a little while the game script downloads, so Enter world
 * does not open on a frozen 0%. Real asset progress takes over once it starts.
 */
export function beginCodeLoadProgress() {
  if (codePump || assetPhase || shownProgress >= 1) return;
  const started = performance.now();
  const cap = 0.14;
  const tick = () => {
    codePump = 0;
    if (assetPhase || shownProgress >= 1) return;
    const t = Math.min(1, (performance.now() - started) / 8000);
    const eased = cap * (1 - (1 - t) * (1 - t));
    setBootLoadingProgress(eased, "Loading game…");
    if (!assetPhase && t < 1 && shownProgress < cap) {
      codePump = window.setTimeout(tick, 100);
    }
  };
  codePump = window.setTimeout(tick, 100);
}

/** Phaser has started fetching textures and audio. Stop the script-phase ease. */
export function noteAssetLoadStarted() {
  assetPhase = true;
  if (codePump) {
    window.clearTimeout(codePump);
    codePump = 0;
  }
}

export function isBootOverlayOpen(): boolean {
  const root = el<HTMLElement>("boot-loading");
  return !!root && !root.classList.contains("boot-loading--done");
}

/** Cover the menu with the spinner and percent. Progress already on the bar stays. */
export function showBootLoading() {
  const root = el<HTMLElement>("boot-loading");
  if (!root) return;
  // Drop the hide transition so the spinner appears on the same frame as the click.
  root.classList.add("boot-loading--instant");
  root.classList.remove("boot-loading--done");
  root.setAttribute("aria-busy", "true");
  void root.offsetWidth;
  root.classList.remove("boot-loading--instant");
  if (!assetPhase && shownProgress <= 0) {
    setBootLoadingStatus("Loading game…");
  }
}

export function hideBootLoading(immediate = false) {
  const root = el<HTMLElement>("boot-loading");
  if (!root || root.classList.contains("boot-loading--done")) return;
  root.classList.toggle("boot-loading--instant", immediate);
  root.classList.add("boot-loading--done");
  root.setAttribute("aria-busy", "false");
}

/** Show the join gate while nearby NPC packs finish loading. */
export function showWorldEntering(status = "Entering world…") {
  document.body.classList.add("world-entering");
  const root = el<HTMLElement>("world-entering");
  if (!root) return;
  root.hidden = false;
  root.setAttribute("aria-busy", "true");
  const statusEl = el<HTMLElement>("world-entering-status");
  if (statusEl) statusEl.textContent = status;
}

export function setWorldEnteringStatus(text: string) {
  const statusEl = el<HTMLElement>("world-entering-status");
  if (statusEl) statusEl.textContent = text;
}

export function hideWorldEntering() {
  document.body.classList.remove("world-entering");
  const root = el<HTMLElement>("world-entering");
  if (!root) return;
  root.setAttribute("aria-busy", "false");
  root.hidden = true;
}
