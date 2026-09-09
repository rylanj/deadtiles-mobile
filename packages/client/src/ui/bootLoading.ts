/** DOM boot / world-enter overlay helpers. */

function el<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

export function setBootLoadingStatus(text: string) {
  const status = el<HTMLElement>("boot-loading-status");
  if (status) status.textContent = text;
}

export function setBootLoadingProgress(progress: number) {
  const pct = Math.round(Math.min(1, Math.max(0, progress)) * 100);
  const fill = el<HTMLElement>("boot-loading-fill");
  const label = el<HTMLElement>("boot-loading-pct");
  const bar = el<HTMLElement>("boot-loading-bar");
  if (fill) fill.style.width = `${pct}%`;
  if (label) label.textContent = `${pct}%`;
  if (bar) bar.setAttribute("aria-valuenow", String(pct));
  if (pct > 0 && pct < 100) {
    setBootLoadingStatus("Loading assets…");
  } else if (pct >= 100) {
    setBootLoadingStatus("Preparing…");
  }
}

export function hideBootLoading() {
  const root = el<HTMLElement>("boot-loading");
  if (!root || root.classList.contains("boot-loading--done")) return;
  root.classList.add("boot-loading--done");
  root.setAttribute("aria-busy", "false");
  window.setTimeout(() => root.remove(), 400);
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
