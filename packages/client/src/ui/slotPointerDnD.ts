/** Pixel movement before a press becomes a drag (vs tap / double-tap). */
export const SLOT_DRAG_THRESHOLD_PX = 10;
/** Max gap between taps for double-tap activate. */
export const SLOT_DOUBLE_TAP_MS = 350;

export type SlotTapState = { key: string; at: number } | null;

export type SlotPointerDnDOptions = {
  cell: HTMLElement;
  /** Overlay / panel root used for hit-testing drop targets. */
  root: HTMLElement;
  /** Stable id for double-tap matching (e.g. `player:3`). */
  tapKey: string;
  getLastTap: () => SlotTapState;
  setLastTap: (tap: SlotTapState) => void;
  resolveTarget: (el: Element | null) => HTMLElement | null;
  canDropOn: (target: HTMLElement, shift: boolean) => boolean;
  onDropOn: (target: HTMLElement, shift: boolean) => void;
  /**
   * Quantity drawn on the ghost while shift is held.
   * Null keeps the stack's normal label.
   */
  shiftGhostQuantity?: (shift: boolean) => number | null;
  onDragBegan?: () => void;
  onDragEnded?: () => void;
  /** Double-click / double-tap action (take / equip). */
  onDoubleActivate?: () => void;
  clearHover: () => void;
  setHover: (target: HTMLElement, valid: boolean) => void;
};

type ActiveSlotDrag = {
  pointerId: number;
  /** Cancel without dropping (UI closed / grids rebuilt). */
  cancel: () => void;
  /** Finish from a global pointer event (may drop). */
  finish: (event: PointerEvent, cancelled: boolean) => void;
};

const activeDrags = new Set<ActiveSlotDrag>();
const DRAG_LAYER_ID = "slot-drag-layer";
let globalGuardsInstalled = false;
/** Shift keydown/keyup. Pointer events can miss it while the game captures Shift. */
let shiftPhysicallyDown = false;
let shiftTrackerInstalled = false;

function installShiftTracker(): void {
  if (shiftTrackerInstalled || typeof window === "undefined") return;
  shiftTrackerInstalled = true;
  const onKey = (event: KeyboardEvent) => {
    if (
      event.key !== "Shift" &&
      event.code !== "ShiftLeft" &&
      event.code !== "ShiftRight"
    ) {
      return;
    }
    // Keydown of Shift is enough to latch it. Keyup clears it unless the
    // other Shift key is still held (shiftKey stays true in that case).
    shiftPhysicallyDown =
      event.type === "keydown" ||
      (event.shiftKey && event.getModifierState("Shift"));
  };
  window.addEventListener("keydown", onKey, true);
  window.addEventListener("keyup", onKey, true);
  window.addEventListener("blur", () => {
    shiftPhysicallyDown = false;
  });
}

function slotDragShiftDown(event?: Event): boolean {
  if (shiftPhysicallyDown) return true;
  if (!event || !("shiftKey" in event)) return false;
  const pointer = event as PointerEvent;
  if (pointer.shiftKey) return true;
  if (typeof pointer.getModifierState === "function" && pointer.getModifierState("Shift")) {
    return true;
  }
  return false;
}

function getDragLayer(): HTMLElement {
  let layer = document.getElementById(DRAG_LAYER_ID);
  if (!layer) {
    layer = document.createElement("div");
    layer.id = DRAG_LAYER_ID;
    layer.setAttribute("aria-hidden", "true");
    layer.style.cssText =
      "position:fixed;inset:0;z-index:10000;pointer-events:none;overflow:visible;";
    document.body.appendChild(layer);
  }
  return layer;
}

function clearDragLayer(): void {
  const layer = document.getElementById(DRAG_LAYER_ID);
  if (layer) layer.replaceChildren();
  document.querySelectorAll(".inventory-slot-ghost").forEach((el) => el.remove());
}

function clearDragVisualState(): void {
  clearDragLayer();
  document
    .querySelectorAll(".inventory-cell--dragging")
    .forEach((el) => el.classList.remove("inventory-cell--dragging"));
  document
    .querySelectorAll(".inventory-cell--drag-over, .inventory-cell--drag-invalid")
    .forEach((el) => {
      el.classList.remove("inventory-cell--drag-over", "inventory-cell--drag-invalid");
    });
}

function installGlobalDragGuards(): void {
  if (globalGuardsInstalled || typeof document === "undefined") return;
  globalGuardsInstalled = true;

  const onPointerEnd = (event: PointerEvent) => {
    const cancelled = event.type === "pointercancel";
    for (const drag of [...activeDrags]) {
      if (drag.pointerId !== event.pointerId) continue;
      drag.finish(event, cancelled);
    }
    // Safety net: no live drag should leave a ghost behind.
    if (activeDrags.size === 0) clearDragLayer();
  };

  document.addEventListener("pointerup", onPointerEnd, true);
  document.addEventListener("pointercancel", onPointerEnd, true);
  window.addEventListener("blur", () => cancelAllSlotDrags());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") cancelAllSlotDrags();
  });
}

/** Remove any leftover drag ghosts and cancel in-flight slot drags. */
export function cancelAllSlotDrags(): void {
  for (const drag of [...activeDrags]) {
    drag.cancel();
  }
  activeDrags.clear();
  clearDragVisualState();
}

/**
 * Pointer-based slot drag + double-tap.
 * Replaces HTML5 DnD so touch works and native text/image selection does not.
 */
export function bindSlotPointerDnD(opts: SlotPointerDnDOptions): void {
  installGlobalDragGuards();
  installShiftTracker();

  const { cell } = opts;
  cell.draggable = false;

  let pointerId: number | null = null;
  let startX = 0;
  let startY = 0;
  let lastX = 0;
  let lastY = 0;
  let dragging = false;
  let shiftHeld = false;
  let shownShift = false;
  let ghost: HTMLElement | null = null;
  let ghostQtyOriginal = "";
  let hoverTarget: HTMLElement | null = null;
  let suppressClick = false;
  let active: ActiveSlotDrag | null = null;
  let shiftListener: ((event: KeyboardEvent) => void) | null = null;
  let releasingCapture = false;

  const destroyGhost = () => {
    ghost?.remove();
    ghost = null;
    // Keep layer empty when nothing is dragging.
    if (activeDrags.size === 0) clearDragLayer();
  };

  const moveGhost = (clientX: number, clientY: number) => {
    if (!ghost) return;
    ghost.style.transform = `translate(${clientX + 12}px, ${clientY + 12}px)`;
  };

  const applyGhostQuantity = () => {
    if (!ghost || !opts.shiftGhostQuantity) return;
    const el = ghost.querySelector(".inventory-cell-qty");
    if (!(el instanceof HTMLElement)) return;
    const qty = opts.shiftGhostQuantity(shiftHeld);
    el.textContent = qty == null ? ghostQtyOriginal : String(qty);
  };

  const stopShiftWatch = () => {
    if (!shiftListener) return;
    window.removeEventListener("keydown", shiftListener, true);
    window.removeEventListener("keyup", shiftListener, true);
    shiftListener = null;
  };

  const startShiftWatch = () => {
    if (shiftListener) return;
    shiftListener = (event: KeyboardEvent) => {
      if (
        event.key !== "Shift" &&
        event.code !== "ShiftLeft" &&
        event.code !== "ShiftRight"
      ) {
        return;
      }
      shiftHeld =
        event.type === "keydown" ||
        (event.shiftKey && event.getModifierState("Shift"));
      applyGhostQuantity();
      updateHover(lastX, lastY);
    };
    window.addEventListener("keydown", shiftListener, true);
    window.addEventListener("keyup", shiftListener, true);
  };

  const updateHover = (clientX: number, clientY: number) => {
    if (ghost) ghost.style.visibility = "hidden";
    const el = document.elementFromPoint(clientX, clientY);
    if (ghost) ghost.style.visibility = "visible";

    const target = opts.resolveTarget(el);
    if (target === hoverTarget && shownShift === shiftHeld) return;

    shownShift = shiftHeld;
    opts.clearHover();
    hoverTarget = target;
    if (target && target !== cell) {
      opts.setHover(target, opts.canDropOn(target, shiftHeld));
    }
  };

  const unregisterActive = () => {
    if (!active) return;
    activeDrags.delete(active);
    active = null;
  };

  const endDrag = (
    clientX: number,
    clientY: number,
    cancelled: boolean,
    dropShift = false,
  ) => {
    const wasDragging = dragging;
    const dropTarget = wasDragging && !cancelled ? hoverTarget : null;

    dragging = false;
    pointerId = null;
    shiftHeld = false;
    shownShift = false;
    stopShiftWatch();
    unregisterActive();
    destroyGhost();
    cell.classList.remove("inventory-cell--dragging");
    opts.clearHover();
    hoverTarget = null;

    if (wasDragging) {
      suppressClick = true;
      if (
        dropTarget &&
        dropTarget !== cell &&
        opts.canDropOn(dropTarget, dropShift)
      ) {
        opts.onDropOn(dropTarget, dropShift);
      }
      opts.setLastTap(null);
      opts.onDragEnded?.();
      return;
    }

    opts.onDragEnded?.();

    if (cancelled) return;
    void clientX;
    void clientY;
  };

  const finishPointer = (event: PointerEvent, cancelled: boolean) => {
    if (pointerId !== event.pointerId) return;
    releasingCapture = true;
    try {
      cell.releasePointerCapture(event.pointerId);
    } catch {
      /* ignore */
    }
    releasingCapture = false;

    const wasDragging = dragging;
    endDrag(
      event.clientX,
      event.clientY,
      cancelled,
      !cancelled && (shiftHeld || slotDragShiftDown(event)),
    );

    if (!wasDragging && !cancelled) {
      handleTapActivate(event.pointerType);
    }
  };

  const cancelDrag = () => {
    if (pointerId === null && !dragging) return;
    try {
      if (pointerId !== null) cell.releasePointerCapture(pointerId);
    } catch {
      /* ignore */
    }
    endDrag(0, 0, true);
  };

  const handleTapActivate = (pointerType: string) => {
    if (pointerType === "mouse") return;
    if (!opts.onDoubleActivate) return;

    const now = Date.now();
    const prev = opts.getLastTap();
    if (prev && prev.key === opts.tapKey && now - prev.at < SLOT_DOUBLE_TAP_MS) {
      opts.setLastTap(null);
      opts.onDoubleActivate();
      suppressClick = true;
      return;
    }
    opts.setLastTap({ key: opts.tapKey, at: now });
  };

  cell.addEventListener("selectstart", (event) => event.preventDefault());

  cell.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    if (pointerId !== null) return;

    // Another slot still dragging (stale) — scrub before starting.
    if (activeDrags.size > 0) cancelAllSlotDrags();

    pointerId = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
    dragging = false;
    suppressClick = false;
    shiftHeld = slotDragShiftDown(event);

    try {
      cell.setPointerCapture(event.pointerId);
    } catch {
      /* ignore */
    }
  });

  cell.addEventListener("pointermove", (event) => {
    if (pointerId !== event.pointerId) return;

    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    lastX = event.clientX;
    lastY = event.clientY;
    shiftHeld = slotDragShiftDown(event);

    if (!dragging) {
      if (Math.hypot(dx, dy) < SLOT_DRAG_THRESHOLD_PX) return;
      dragging = true;
      opts.setLastTap(null);
      opts.onDragBegan?.();
      cell.classList.add("inventory-cell--dragging");
      startShiftWatch();

      clearDragLayer();
      ghost = cell.cloneNode(true) as HTMLElement;
      ghost.classList.add("inventory-slot-ghost");
      ghost.draggable = false;
      ghost.querySelectorAll("img").forEach((img) => {
        img.draggable = false;
        img.style.pointerEvents = "none";
      });
      ghost.style.position = "fixed";
      ghost.style.left = "0";
      ghost.style.top = "0";
      ghost.style.width = `${cell.offsetWidth}px`;
      ghost.style.height = `${cell.offsetHeight}px`;
      ghost.style.margin = "0";
      ghost.style.zIndex = "1";
      ghost.style.pointerEvents = "none";
      ghost.style.opacity = "0.92";
      ghost.style.visibility = "visible";
      getDragLayer().appendChild(ghost);
      const qtyEl = ghost.querySelector(".inventory-cell-qty");
      ghostQtyOriginal = qtyEl instanceof HTMLElement ? qtyEl.textContent ?? "" : "";
      applyGhostQuantity();
      moveGhost(event.clientX, event.clientY);

      active = {
        pointerId: event.pointerId,
        cancel: cancelDrag,
        finish: finishPointer,
      };
      activeDrags.add(active);
    }

    event.preventDefault();
    moveGhost(event.clientX, event.clientY);
    applyGhostQuantity();
    updateHover(event.clientX, event.clientY);
  });

  cell.addEventListener("lostpointercapture", () => {
    if (releasingCapture) return;
    if (!dragging && pointerId === null) return;
    // Capture lost (cell torn down / scroll steal). Cancel without drop.
    cancelDrag();
  });

  cell.addEventListener("pointerup", (event) => {
    finishPointer(event, false);
  });

  cell.addEventListener("pointercancel", (event) => {
    finishPointer(event, true);
  });

  cell.addEventListener(
    "click",
    (event) => {
      if (!suppressClick) return;
      event.preventDefault();
      event.stopPropagation();
      suppressClick = false;
    },
    true,
  );

  if (opts.onDoubleActivate) {
    cell.addEventListener("dblclick", (event) => {
      event.preventDefault();
      opts.setLastTap(null);
      opts.onDoubleActivate?.();
    });
  }
}
