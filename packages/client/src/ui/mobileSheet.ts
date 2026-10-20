import "./mobile/sheet.css";
import { getItemIconPath } from "./itemIcons";

/**
 * Shared mobile sheet parts (design/mobile-dialogs/PLAN.md).
 * Phones and tablets use these. Desktop keeps the panels in index.html.
 */
export function useMobileSheet(): boolean {
  if (typeof document === "undefined") return false;
  return document.body.classList.contains("is-mobile");
}

export type SheetTone = "green" | "red" | "gold";

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

// ── Open state ─────────────────────────────────────────────────────────────

const openSheets = new Set<string>();

/** Hide the joystick, action stack, hotbar and build bar while any sheet is up. */
export function markSheetOpen(id: string, open: boolean): void {
  if (typeof document === "undefined") return;
  if (open) openSheets.add(id);
  else openSheets.delete(id);
  document.body.classList.toggle("sheet-open", openSheets.size > 0);
}

export function resetSheetOpen(): void {
  openSheets.clear();
  if (typeof document !== "undefined") document.body.classList.remove("sheet-open");
}

// ── Buttons ────────────────────────────────────────────────────────────────

export type SheetButtonVariant = "pri" | "sec" | "danger" | "gold";

export function sheetButton(
  label: string,
  variant: SheetButtonVariant,
  onClick: () => void,
  opts: { sub?: string; small?: boolean } = {},
): HTMLButtonElement {
  const btn = el("button", "ms-btn");
  btn.type = "button";
  if (variant !== "sec") btn.classList.add(`ms-btn--${variant}`);
  if (opts.small) btn.classList.add("ms-btn--sm");
  setButtonLabel(btn, label, opts.sub);
  btn.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (btn.disabled) return;
    onClick();
  });
  return btn;
}

export function setButtonLabel(btn: HTMLButtonElement, label: string, sub?: string): void {
  btn.replaceChildren(document.createTextNode(label));
  if (sub) btn.append(el("span", "ms-btn-sub", `· ${sub}`));
}

export function sheetCloseButton(onClose: () => void): HTMLButtonElement {
  const btn = el("button", "ms-x", "✕");
  btn.type = "button";
  btn.setAttribute("aria-label", "Close");
  btn.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    onClose();
  });
  return btn;
}

export function sheetBackButton(onBack: () => void): HTMLButtonElement {
  const btn = el("button", "ms-back", "‹");
  btn.type = "button";
  btn.setAttribute("aria-label", "Back");
  btn.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    onBack();
  });
  return btn;
}

// ── Sheet ──────────────────────────────────────────────────────────────────

export type SheetHeader = {
  el: HTMLElement;
  avatarSlot: HTMLElement;
  titleEl: HTMLElement;
  titleTextEl: HTMLElement;
  pillSlot: HTMLElement;
  subEl: HTMLElement;
  backBtn: HTMLButtonElement;
  closeBtn: HTMLButtonElement;
  setTitle(text: string): void;
  setSub(text: string): void;
  setBack(onBack: (() => void) | null): void;
};

export function createSheetHeader(onClose: () => void): SheetHeader {
  const header = el("div", "ms-hdr");
  let backHandler: (() => void) | null = null;
  const backBtn = sheetBackButton(() => backHandler?.());
  backBtn.hidden = true;
  const avatarSlot = el("div", "ms-av");
  avatarSlot.hidden = true;
  const t = el("div", "ms-hdr-t");
  const titleEl = el("h2", "ms-title");
  const titleTextEl = el("span", "ms-title-text");
  const pillSlot = el("span", "ms-pill-slot");
  titleEl.append(titleTextEl, pillSlot);
  const subEl = el("span", "ms-sub");
  subEl.hidden = true;
  t.append(titleEl, subEl);
  const closeBtn = sheetCloseButton(onClose);
  header.append(backBtn, avatarSlot, t, closeBtn);
  return {
    el: header,
    avatarSlot,
    titleEl,
    titleTextEl,
    pillSlot,
    subEl,
    backBtn,
    closeBtn,
    setTitle(text) {
      titleTextEl.textContent = text;
    },
    setSub(text) {
      subEl.textContent = text;
      subEl.hidden = !text;
    },
    setBack(onBack) {
      backHandler = onBack;
      backBtn.hidden = !onBack;
      header.classList.toggle("ms-hdr--back", !!onBack);
    },
  };
}

export type Sheet = {
  root: HTMLElement;
  header: SheetHeader;
  tabsSlot: HTMLElement;
  body: HTMLElement;
  snackSlot: HTMLElement;
  bar: HTMLElement;
  setTone(tone: SheetTone): void;
  /** Hide the bar when it has nothing visible. */
  syncBar(): void;
  dispose(): void;
};

/**
 * Full-screen sheet: header, optional tabs, one scrolling body, message slot, action bar.
 * Append `root` to an overlay that has the `ms-host` class.
 */
export function createSheet(opts: { tone?: SheetTone; onClose: () => void }): Sheet {
  const root = el("div", "ms-sheet");
  const header = createSheetHeader(opts.onClose);
  const tabsSlot = el("div");
  tabsSlot.hidden = true;
  const body = el("div", "ms-body");
  const snackSlot = el("div");
  const bar = el("div", "ms-bar");
  bar.hidden = true;
  root.append(header.el, tabsSlot, body, snackSlot, bar);
  const unbindKeyboard = bindKeyboardInset(root);
  const sheet: Sheet = {
    root,
    header,
    tabsSlot,
    body,
    snackSlot,
    bar,
    setTone(tone) {
      root.classList.toggle("ms-tone-red", tone === "red");
      root.classList.toggle("ms-tone-gold", tone === "gold");
    },
    syncBar() {
      bar.hidden = ![...bar.children].some((child) => !(child as HTMLElement).hidden);
    },
    dispose() {
      unbindKeyboard();
    },
  };
  sheet.setTone(opts.tone ?? "green");
  return sheet;
}

// ── Tabs ───────────────────────────────────────────────────────────────────

export type SheetTab = {
  id: string;
  label: string;
  count?: string | number;
  /** Gold count, for "needs attention". */
  alert?: boolean;
  iconItemId?: string;
  iconSrc?: string;
};

export function renderTabs(
  slot: HTMLElement,
  tabs: SheetTab[],
  active: string,
  onSelect: (id: string) => void,
  opts?: { iconTabs?: boolean },
): void {
  slot.hidden = tabs.length === 0;
  if (tabs.length === 0) {
    slot.replaceChildren();
    return;
  }
  const iconTabs = opts?.iconTabs === true;
  const wrap = el("div", iconTabs ? "ms-tabs ms-tabs--icons" : "ms-tabs");
  wrap.setAttribute("role", "tablist");
  for (const tab of tabs) {
    const btn = el("button", "ms-tab");
    btn.type = "button";
    btn.setAttribute("role", "tab");
    btn.setAttribute("aria-selected", tab.id === active ? "true" : "false");
    const showLabel = !iconTabs || tab.id === active;
    if (tab.id === active) btn.classList.add("ms-tab--on");
    if (!showLabel) btn.setAttribute("aria-label", tab.label);
    if (tab.iconItemId) {
      const icon = itemIconImg(tab.iconItemId);
      if (icon) btn.append(icon);
    } else if (tab.iconSrc) {
      const icon = el("img");
      icon.src = tab.iconSrc;
      icon.alt = "";
      icon.draggable = false;
      btn.append(icon);
    }
    const label = el("span", showLabel ? "ms-tab-label" : "ms-tab-label ms-tab-label--off", tab.label);
    btn.append(label);
    if (tab.count != null && tab.count !== "") {
      btn.append(
        el("span", tab.alert ? "ms-tab-n ms-tab-n--alert" : "ms-tab-n", String(tab.count)),
      );
    }
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      if (tab.id !== active) onSelect(tab.id);
    });
    wrap.append(btn);
  }
  slot.replaceChildren(wrap);
}

export type FilterChip = { id: string; label: string; count?: number };

export function filterChips(
  chips: FilterChip[],
  active: string,
  onSelect: (id: string) => void,
): HTMLElement {
  const wrap = el("div", "ms-chips");
  for (const chip of chips) {
    const btn = el("button", chip.id === active ? "ms-fchip ms-fchip--on" : "ms-fchip");
    btn.type = "button";
    btn.append(document.createTextNode(chip.label));
    if (chip.count != null) btn.append(el("span", "ms-fchip-n", String(chip.count)));
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      onSelect(chip.id);
    });
    wrap.append(btn);
  }
  return wrap;
}

// ── Content pieces ─────────────────────────────────────────────────────────

export function itemIconImg(itemId: string): HTMLImageElement | null {
  const path = getItemIconPath(itemId);
  if (!path) return null;
  const img = el("img");
  img.src = path;
  img.alt = "";
  img.draggable = false;
  return img;
}

export function sectionLabel(text: string, note?: string): HTMLElement {
  const lbl = el("div", "ms-lbl");
  lbl.append(el("span", undefined, text));
  if (note) lbl.append(el("span", "ms-lbl-note", note));
  return lbl;
}

export type ChipTone = "" | "g" | "y" | "r" | "b" | "lime";

export function chip(text: string, tone: ChipTone = ""): HTMLElement {
  return el("span", tone ? `ms-chip ms-chip--${tone}` : "ms-chip", text);
}

export type RowOptions = {
  iconItemId?: string;
  /** Used when there is no icon for the item. */
  iconText?: string;
  iconEl?: HTMLElement;
  qty?: number | string;
  name: string;
  meta?: (string | Node)[];
  metaTone?: "ok" | "warn" | "bad";
  end?: string | Node;
  chevron?: boolean;
  onTap?: () => void;
  state?: "on" | "dim" | "story";
  ariaLabel?: string;
};

/** 68px list row. The whole row is the tap target when `onTap` is set. */
export function sheetRow(opts: RowOptions): HTMLElement {
  const row = opts.onTap ? el("button", "ms-row ms-row--tap") : el("div", "ms-row");
  if (row instanceof HTMLButtonElement) row.type = "button";
  if (opts.state) row.classList.add(`ms-row--${opts.state}`);
  if (opts.ariaLabel) row.setAttribute("aria-label", opts.ariaLabel);
  if (opts.iconItemId || opts.iconEl || opts.iconText) {
    const ico = el("div", "ms-row-ico");
    const img = opts.iconEl ?? (opts.iconItemId ? itemIconImg(opts.iconItemId) : null);
    if (img) ico.append(img);
    else ico.append(el("span", "ms-row-ico-txt", opts.iconText ?? opts.name.slice(0, 10)));
    if (opts.qty != null && opts.qty !== "" && opts.qty !== 1) {
      ico.append(el("span", "ms-row-q", String(opts.qty)));
    }
    row.append(ico);
  }
  const mid = el("div", "ms-row-mid");
  mid.append(el("div", "ms-row-nm", opts.name));
  if (opts.meta && opts.meta.length > 0) {
    const mt = el("div", "ms-row-mt");
    if (opts.metaTone) mt.classList.add(`ms-${opts.metaTone}`);
    for (const part of opts.meta) {
      mt.append(typeof part === "string" ? document.createTextNode(part) : part);
    }
    mid.append(mt);
  }
  row.append(mid);
  if (opts.end != null) {
    const end = el("div", "ms-row-end");
    if (typeof opts.end === "string") end.textContent = opts.end;
    else end.append(opts.end);
    row.append(end);
  }
  if (opts.chevron) row.append(el("span", "ms-row-chev", "›"));
  if (opts.onTap) {
    const tap = opts.onTap;
    row.addEventListener("click", (event) => {
      if ((event.target as HTMLElement).closest(".ms-btn") && event.target !== row) return;
      event.preventDefault();
      tap();
    });
  }
  return row;
}

export type KvRow = {
  label: string | Node;
  value: string | Node;
  tone?: "ok" | "warn" | "bad";
  total?: boolean;
  iconItemId?: string;
};

export function kvCard(rows: KvRow[], highlight = false): HTMLElement {
  const card = el("div", highlight ? "ms-card ms-card--hl" : "ms-card");
  for (const row of rows) card.append(kvRow(row));
  return card;
}

export function kvRow(row: KvRow): HTMLElement {
  const line = el("div", row.total ? "ms-kv ms-kv--total" : "ms-kv");
  const k = el("span", "ms-kv-k");
  if (row.iconItemId) {
    const icon = itemIconImg(row.iconItemId);
    if (icon) k.append(icon);
  }
  k.append(typeof row.label === "string" ? document.createTextNode(row.label) : row.label);
  const v = el("span", "ms-kv-v");
  if (row.tone) v.classList.add(`ms-${row.tone}`);
  v.append(typeof row.value === "string" ? document.createTextNode(row.value) : row.value);
  line.append(k, v);
  return line;
}

export function meter(pct: number, color?: string): HTMLElement {
  const track = el("div", "ms-meter");
  const fill = el("i");
  fill.style.width = `${Math.max(0, Math.min(100, pct))}%`;
  if (color) fill.style.background = color;
  track.append(fill);
  return track;
}

// ── Stepper ────────────────────────────────────────────────────────────────

export type Stepper = {
  el: HTMLElement;
  input: HTMLInputElement;
  value(): number;
  set(value: number): void;
  setRange(min: number, max: number): void;
};

/** 52px − / value / + control. The value is typeable (16px, numeric keypad). */
export function createStepper(opts: {
  value: number;
  min: number;
  max: number;
  step?: number;
  prefix?: string;
  onChange: (value: number) => void;
}): Stepper {
  let min = opts.min;
  let max = Math.max(opts.min, opts.max);
  let current = clamp(opts.value, min, max);
  const step = opts.step ?? 1;
  const wrap = el("div", "ms-stepper");
  const minus = el("button", "ms-step", "−");
  minus.type = "button";
  minus.setAttribute("aria-label", "Less");
  const plus = el("button", "ms-step", "+");
  plus.type = "button";
  plus.setAttribute("aria-label", "More");
  const input = el("input", "ms-step-val");
  input.type = "text";
  input.inputMode = "numeric";
  input.autocomplete = "off";
  const prefix = opts.prefix ?? "";
  const paint = () => {
    input.value = `${prefix}${current.toLocaleString("en-US")}`;
    minus.disabled = current <= min;
    plus.disabled = current >= max;
  };
  const commit = (next: number) => {
    const clamped = clamp(next, min, max);
    const changed = clamped !== current;
    current = clamped;
    paint();
    if (changed) opts.onChange(current);
  };
  minus.addEventListener("click", (event) => {
    event.preventDefault();
    commit(current - step);
  });
  plus.addEventListener("click", (event) => {
    event.preventDefault();
    commit(current + step);
  });
  input.addEventListener("focus", () => {
    input.value = String(current);
    input.select();
  });
  input.addEventListener("input", () => {
    input.value = input.value.replace(/[^\d]/g, "").slice(0, 9);
  });
  const fromInput = () => {
    const parsed = Number.parseInt(input.value.replace(/[^\d]/g, ""), 10);
    commit(Number.isFinite(parsed) ? parsed : current);
  };
  input.addEventListener("blur", fromInput);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      input.blur();
    }
  });
  wrap.append(minus, input, plus);
  paint();
  return {
    el: wrap,
    input,
    value: () => current,
    set(value) {
      current = clamp(value, min, max);
      paint();
    },
    setRange(nextMin, nextMax) {
      min = nextMin;
      max = Math.max(nextMin, nextMax);
      current = clamp(current, min, max);
      paint();
    },
  };
}

export function quickAmounts(
  options: { label: string; value: number }[],
  active: number | null,
  onPick: (value: number) => void,
): HTMLElement {
  const wrap = el("div", "ms-quick");
  for (const option of options) {
    const btn = el("button", option.value === active ? "ms-quick--on" : "", option.label);
    btn.type = "button";
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      onPick(option.value);
    });
    wrap.append(btn);
  }
  return wrap;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
}

// ── Drawer ─────────────────────────────────────────────────────────────────

export type Drawer = {
  el: HTMLElement;
  scrim: HTMLElement;
  /** Scrolling content area. */
  content: HTMLElement;
  bar: HTMLElement;
  close(): void;
  isOpen(): boolean;
};

/**
 * Bottom drawer inside `host` (a sheet root or a full-screen overlay).
 * `scrim: false` keeps the sheet behind it usable, for the bag item drawer.
 */
export function openDrawer(
  host: HTMLElement,
  opts: { onClose?: () => void; scrim?: boolean; tone?: SheetTone; label?: string } = {},
): Drawer {
  const scrim = el("div", "ms-scrim");
  const drawer = el("div", "ms-drawer");
  drawer.setAttribute("role", "dialog");
  if (opts.label) drawer.setAttribute("aria-label", opts.label);
  if (opts.tone === "red") drawer.classList.add("ms-tone-red");
  if (opts.tone === "gold") drawer.classList.add("ms-tone-gold");
  const grab = el("div", "ms-grab");
  const content = el("div", "ms-drawer-scroll");
  const bar = el("div", "ms-bar");
  drawer.append(grab, content, bar);
  let open = true;
  let unbindSwipe = () => {};
  const close = () => {
    if (!open) return;
    open = false;
    unbindSwipe();
    unbindSwipe = () => {};
    scrim.remove();
    drawer.remove();
    unbind();
    opts.onClose?.();
  };
  scrim.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    close();
  });
  unbindSwipe = bindSwipeDown(drawer, content, close);
  if (opts.scrim !== false) host.append(scrim);
  host.append(drawer);
  const unbind = bindKeyboardInset(drawer);
  return { el: drawer, scrim, content, bar, close, isOpen: () => open };
}

export function drawerHead(opts: {
  iconItemId?: string;
  iconEl?: HTMLElement;
  title: string;
  sub?: string;
}): HTMLElement {
  const head = el("div", "ms-dhead");
  if (opts.iconItemId || opts.iconEl) {
    const ico = el("div", "ms-dhead-ico");
    const img = opts.iconEl ?? (opts.iconItemId ? itemIconImg(opts.iconItemId) : null);
    if (img) ico.append(img);
    head.append(ico);
  }
  const t = el("div", "ms-dhead-t");
  t.append(el("b", "ms-dhead-title", opts.title));
  if (opts.sub) t.append(el("span", "ms-dhead-sub", opts.sub));
  head.append(t);
  return head;
}

function bindSwipeDown(drawer: HTMLElement, content: HTMLElement, close: () => void): () => void {
  let startY: number | null = null;
  let startX = 0;
  let tracking = false;
  let pointerId = -1;

  const blocked = (target: EventTarget | null) =>
    target instanceof Element && !!target.closest("button, a, input, textarea, select, label, .ms-stepper");
  const fromHandle = (target: EventTarget | null) =>
    target instanceof Element && !!target.closest(".ms-grab, .ms-dhead");
  const contentFits = () => content.scrollHeight <= content.clientHeight + 1;
  const syncTouch = () => {
    content.style.touchAction = contentFits() ? "none" : "pan-y";
  };
  const watch = new ResizeObserver(syncTouch);
  watch.observe(content);
  syncTouch();

  const finish = (dy: number) => {
    if (startY == null) return;
    startY = null;
    tracking = false;
    pointerId = -1;
    if (dy > 72) {
      close();
      return;
    }
    drawer.style.transition = "";
    void drawer.offsetWidth;
    drawer.style.transform = "";
  };

  const onDown = (event: PointerEvent) => {
    if (event.button !== 0 || blocked(event.target)) return;
    if (!fromHandle(event.target) && !contentFits()) return;
    startY = event.clientY;
    startX = event.clientX;
    tracking = false;
    pointerId = event.pointerId;
    try {
      drawer.setPointerCapture(event.pointerId);
    } catch {
      /* The pointer can already be gone. */
    }
  };
  const onMove = (event: PointerEvent) => {
    if (startY == null || event.pointerId !== pointerId) return;
    const dy = event.clientY - startY;
    const dx = event.clientX - startX;
    if (!tracking) {
      if (dy < 10 || Math.abs(dx) > dy) {
        if (dy < -6 || Math.abs(dx) > 12) finish(0);
        return;
      }
      tracking = true;
      drawer.style.animation = "none";
      drawer.style.transition = "none";
    }
    event.preventDefault();
    drawer.style.transform = `translateY(${Math.max(0, dy)}px)`;
  };
  const onEnd = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return;
    finish(startY == null ? 0 : event.clientY - startY);
  };
  drawer.addEventListener("pointerdown", onDown);
  drawer.addEventListener("pointermove", onMove);
  drawer.addEventListener("pointerup", onEnd);
  drawer.addEventListener("pointercancel", onEnd);
  return () => {
    watch.disconnect();
    drawer.removeEventListener("pointerdown", onDown);
    drawer.removeEventListener("pointermove", onMove);
    drawer.removeEventListener("pointerup", onEnd);
    drawer.removeEventListener("pointercancel", onEnd);
  };
}

// ── Messages ───────────────────────────────────────────────────────────────

const snackTimers = new WeakMap<HTMLElement, number>();

/** Short feedback above the action bar. Replaces the previous message. */
export function showSheetMessage(
  slot: HTMLElement,
  text: string,
  tone: "good" | "warn" | "bad" = "good",
  ms = 2800,
): void {
  const prior = snackTimers.get(slot);
  if (prior) window.clearTimeout(prior);
  if (!text) {
    slot.replaceChildren();
    return;
  }
  const snack = el("div", tone === "good" ? "ms-snack" : `ms-snack ms-snack--${tone}`, text);
  snack.setAttribute("role", "status");
  slot.replaceChildren(snack);
  if (ms > 0) {
    snackTimers.set(
      slot,
      window.setTimeout(() => {
        if (snack.isConnected) snack.remove();
      }, ms),
    );
  }
}

// ── Keyboard ───────────────────────────────────────────────────────────────

/** Sets `--ms-kb` on `root` to the keyboard height while one of its inputs has focus. */
export function bindKeyboardInset(root: HTMLElement): () => void {
  if (typeof window === "undefined") return () => {};
  let watching = false;
  const apply = () => {
    const vv = window.visualViewport;
    const inset = vv ? Math.max(0, Math.round(window.innerHeight - vv.offsetTop - vv.height)) : 0;
    root.style.setProperty("--ms-kb", `${inset}px`);
  };
  const watch = (on: boolean) => {
    if (on === watching) return;
    watching = on;
    const vv = window.visualViewport;
    if (on) {
      vv?.addEventListener("resize", apply);
      vv?.addEventListener("scroll", apply);
      apply();
    } else {
      vv?.removeEventListener("resize", apply);
      vv?.removeEventListener("scroll", apply);
      root.style.setProperty("--ms-kb", "0px");
    }
  };
  const isField = (node: EventTarget | null) =>
    node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement;
  const onIn = (event: FocusEvent) => {
    if (isField(event.target)) watch(true);
  };
  const onOut = () => {
    window.setTimeout(() => {
      const active = document.activeElement;
      if (isField(active) && root.contains(active)) return;
      watch(false);
    }, 50);
  };
  root.addEventListener("focusin", onIn);
  root.addEventListener("focusout", onOut);
  return () => {
    watch(false);
    root.removeEventListener("focusin", onIn);
    root.removeEventListener("focusout", onOut);
  };
}

export function money(n: number): string {
  return `$${Math.max(0, Math.round(n)).toLocaleString("en-US")}`;
}

export function count(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}
