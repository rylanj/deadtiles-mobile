import {
  COOK_SLOT_COUNT,
  COOK_STAGE_MS,
  FIREPLACE_MAX_FUEL,
  cookResultOf,
  countItemInInventory,
  isRawMeat,
  fireplaceIsActive,
  findFirstItemSlot,
  getEntryDurability,
  getItemDefinition,
  getMaxDurability,
  parseInventory,
  type Inventory,
} from "@zombie/shared";
import { appendItemIcon } from "./itemIcons";
import { createDialogCloseButton } from "./dialogCloseBtn";
import { resetDialogScroll } from "./dialogScroll";
import {
  bindSlotPointerDnD,
  cancelAllSlotDrags,
  type SlotTapState,
} from "./slotPointerDnD";

export type FireplaceUIHandlers = {
  onClose: () => void;
  onAddWood: () => void;
  onLight: () => void;
  onExtinguish: () => void;
  onCookSlot: (slot: number, itemId?: string) => void;
};

export type FireplaceUIState = {
  x: number;
  y: number;
  fuelWood: number;
  activeUntil: number;
  inventoryJson: string;
  hasLighter: boolean;
  /** Panel title. Warehouses use Furnace; player fireplaces stay Fireplace. */
  title?: string;
  /** Null hides cooking. Warehouse furnaces do not cook. */
  cookSlots?: { itemId: string; stageStartedAt: number }[] | null;
};

function makeReqCell(opts: {
  itemId: string;
  qtyLabel: string;
  ariaLabel: string;
  missing?: boolean;
}): HTMLElement {
  const cell = document.createElement("div");
  cell.className = "inventory-cell inventory-cell--filled red-dialog-task-cell";
  if (opts.missing) cell.classList.add("craft-cell--missing");
  cell.setAttribute("role", "img");
  cell.setAttribute("aria-label", opts.ariaLabel);
  cell.tabIndex = -1;

  const hasIcon = appendItemIcon(cell, opts.itemId, "inventory-cell-icon");
  if (hasIcon) cell.classList.add("inventory-cell--has-icon");

  const qty = document.createElement("span");
  qty.className = "inventory-cell-qty";
  qty.textContent = opts.qtyLabel;
  cell.appendChild(qty);

  return cell;
}

export class FireplaceUI {
  private visible = false;
  private tile: { x: number; y: number } | null = null;
  private fuelWood = 0;
  private activeUntil = 0;
  private hasLighter = false;
  private inventory: Inventory = [];

  private overlay: HTMLElement;
  private statusEl: HTMLElement;
  private fuelRowEl: HTMLElement;
  private lightSectionEl: HTMLElement;
  private lightReqRowEl: HTMLElement;
  private addBtn: HTMLButtonElement;
  private lightBtn: HTMLButtonElement;
  private extinguishBtn: HTMLButtonElement;
  private titleEl: HTMLHeadingElement;
  private titleName = "Fireplace";
  private cookSlots: { itemId: string; stageStartedAt: number }[] | null = null;
  private cookSectionEl: HTMLElement;
  private cookRowEl: HTMLElement;
  private packSectionEl!: HTMLElement;
  private packRowEl!: HTMLElement;
  private cookTimerEls: HTMLElement[] = [];
  private cookTimer: number | null = null;
  private lastTap: SlotTapState = null;

  constructor(private handlers: FireplaceUIHandlers) {
    this.overlay = document.createElement("div");
    this.overlay.id = "fireplace-overlay";
    this.overlay.hidden = true;

    const layout = document.createElement("div");
    layout.className = "fireplace-layout";

    const panel = document.createElement("div");
    panel.className = "inventory-panel craft-panel fireplace-panel";

    const header = document.createElement("div");
    header.className = "inventory-header";
    const headerTop = document.createElement("div");
    headerTop.className = "inventory-header-top";
    const title = document.createElement("h2");
    title.className = "inventory-title";
    title.textContent = "Fireplace";
    this.titleEl = title;
    headerTop.append(
      title,
      createDialogCloseButton(() => this.handlers.onClose()),
    );
    this.statusEl = document.createElement("span");
    this.statusEl.className = "inventory-hint";
    header.append(headerTop, this.statusEl);

    const body = document.createElement("div");
    body.className = "craft-body fireplace-body";

    const fuelLabel = document.createElement("div");
    fuelLabel.className = "fireplace-section-label";
    fuelLabel.textContent = "Fuel";

    this.fuelRowEl = document.createElement("div");
    this.fuelRowEl.className = "fireplace-fuel-row";

    this.cookSectionEl = document.createElement("div");
    this.cookSectionEl.className = "fireplace-cook-section";
    this.cookSectionEl.hidden = true;
    const cookLabel = document.createElement("div");
    cookLabel.className = "fireplace-section-label";
    cookLabel.textContent = "Meat";
    const cookHint = document.createElement("div");
    cookHint.className = "inventory-hint fireplace-cook-hint";
    cookHint.textContent =
      "Drag raw meat onto the fire. Click a piece to take it back.";
    this.cookRowEl = document.createElement("div");
    this.cookRowEl.className = "fireplace-cook-row";
    this.packSectionEl = document.createElement("div");
    this.packSectionEl.className = "fireplace-pack-drop";
    const packLabel = document.createElement("div");
    packLabel.className = "fireplace-section-label";
    packLabel.textContent = "In pack";
    this.packRowEl = document.createElement("div");
    this.packRowEl.className = "fireplace-pack-row";
    this.packSectionEl.append(packLabel, this.packRowEl);
    this.cookSectionEl.append(
      cookLabel,
      cookHint,
      this.cookRowEl,
      this.packSectionEl,
    );

    const fuelActions = document.createElement("div");
    fuelActions.className = "fireplace-actions";

    this.addBtn = document.createElement("button");
    this.addBtn.type = "button";
    this.addBtn.className = "red-dialog-complete-btn";
    this.addBtn.textContent = "Add wood";
    this.addBtn.addEventListener("click", () => this.handlers.onAddWood());

    this.extinguishBtn = document.createElement("button");
    this.extinguishBtn.type = "button";
    this.extinguishBtn.className = "red-dialog-complete-btn";
    this.extinguishBtn.textContent = "Extinguish";
    this.extinguishBtn.addEventListener("click", () =>
      this.handlers.onExtinguish(),
    );

    fuelActions.append(this.addBtn, this.extinguishBtn);

    this.lightSectionEl = document.createElement("div");
    this.lightSectionEl.className = "fireplace-light-section red-dialog-task";

    const lightTitle = document.createElement("div");
    lightTitle.className = "fireplace-section-label";
    lightTitle.textContent = "Light fire";

    const needTitle = document.createElement("div");
    needTitle.className = "red-dialog-task-heading";
    needTitle.textContent = "Requires";

    this.lightReqRowEl = document.createElement("div");
    this.lightReqRowEl.className = "red-dialog-task-row";

    this.lightBtn = document.createElement("button");
    this.lightBtn.type = "button";
    this.lightBtn.className = "red-dialog-complete-btn";
    this.lightBtn.textContent = "Light fire";
    this.lightBtn.addEventListener("click", () => this.handlers.onLight());

    this.lightSectionEl.append(
      lightTitle,
      needTitle,
      this.lightReqRowEl,
      this.lightBtn,
    );

    body.append(
      fuelLabel,
      this.fuelRowEl,
      this.cookSectionEl,
      fuelActions,
      this.lightSectionEl,
    );
    panel.append(header, body);
    layout.appendChild(panel);
    this.overlay.appendChild(layout);

    this.overlay.addEventListener("click", (e) => {
      if (e.target === this.overlay) this.handlers.onClose();
    });

    document.body.appendChild(this.overlay);
  }

  isOpen() {
    return this.visible;
  }

  getTile() {
    return this.tile;
  }

  open(state: FireplaceUIState) {
    this.tile = { x: state.x, y: state.y };
    this.applyState(state);
    this.visible = true;
    this.overlay.hidden = false;
    document.body.classList.add("fireplace-open");
    this.render();
    this.startCookTimer();
    resetDialogScroll(this.overlay);
  }

  sync(state: FireplaceUIState) {
    if (!this.visible || !this.tile) return;
    if (state.x !== this.tile.x || state.y !== this.tile.y) return;
    this.applyState(state);
    this.render();
  }

  close() {
    this.visible = false;
    this.overlay.hidden = true;
    document.body.classList.remove("fireplace-open");
    this.tile = null;
    this.fuelWood = 0;
    this.activeUntil = 0;
    this.hasLighter = false;
    this.inventory = [];
    this.cookSlots = null;
    this.cookTimerEls = [];
    this.lastTap = null;
    cancelAllSlotDrags();
    this.stopCookTimer();
  }

  private applyState(state: FireplaceUIState) {
    this.fuelWood = Math.max(0, Math.min(FIREPLACE_MAX_FUEL, state.fuelWood));
    this.activeUntil = state.activeUntil;
    this.hasLighter = state.hasLighter;
    this.titleName = state.title?.trim() || "Fireplace";
    this.titleEl.textContent = this.titleName;
    this.inventory = parseInventory(state.inventoryJson);
    this.cookSlots = state.cookSlots === undefined ? null : state.cookSlots;
  }

  private render() {
    const burning = fireplaceIsActive(this.activeUntil);
    const woodCount = countItemInInventory(this.inventory, "wood");
    const canAdd = woodCount >= 1 && this.fuelWood < FIREPLACE_MAX_FUEL;
    const canLight = !burning && this.fuelWood > 0 && this.hasLighter;

    this.statusEl.textContent = burning
      ? `Burning · ${this.fuelWood}/${FIREPLACE_MAX_FUEL} wood`
      : `Cold · ${this.fuelWood}/${FIREPLACE_MAX_FUEL} wood`;

    this.fuelRowEl.replaceChildren();
    for (let i = 0; i < FIREPLACE_MAX_FUEL; i++) {
      const cell = document.createElement("div");
      cell.className = "inventory-cell fireplace-fuel-cell";
      if (i < this.fuelWood) {
        cell.classList.add("inventory-cell--filled", "red-dialog-task-cell");
        const hasIcon = appendItemIcon(cell, "wood", "inventory-cell-icon");
        if (hasIcon) cell.classList.add("inventory-cell--has-icon");
        else {
          const fallback = document.createElement("span");
          fallback.className = "fireplace-fuel-fallback";
          fallback.textContent = "W";
          cell.appendChild(fallback);
        }
      } else {
        cell.classList.add("fireplace-fuel-cell--empty");
      }
      this.fuelRowEl.appendChild(cell);
    }

    this.addBtn.disabled = !canAdd;
    this.addBtn.title = canAdd
      ? "Add 1 wood (+10 minutes if burning)"
      : this.fuelWood >= FIREPLACE_MAX_FUEL
        ? `${this.titleName} is full`
        : "No wood in inventory";

    this.extinguishBtn.hidden = !burning;
    this.extinguishBtn.disabled = !burning;

    this.lightSectionEl.hidden = burning;
    if (!burning) {
      const lighterDef = getItemDefinition("lighter");
      const lighterSlot = findFirstItemSlot(this.inventory, "lighter");
      const lighterEntry =
        lighterSlot >= 0 ? this.inventory[lighterSlot] : null;
      const maxDur = getMaxDurability("lighter");
      const remaining =
        lighterEntry && maxDur != null
          ? getEntryDurability(lighterEntry)
          : 0;
      this.lightReqRowEl.replaceChildren(
        makeReqCell({
          itemId: "lighter",
          qtyLabel:
            maxDur != null && remaining > 0
              ? `${remaining}/${maxDur}`
              : "×1",
          ariaLabel: `${lighterDef?.name ?? "Lighter"}${
            maxDur != null ? ` ${remaining}/${maxDur}` : " ×1"
          }`,
          missing: !this.hasLighter,
        }),
      );
      this.lightBtn.disabled = !canLight;
      this.lightBtn.title = canLight
        ? `Light the fire (−1 lighter use, ${remaining} left)`
        : this.fuelWood <= 0
          ? "Add wood first"
          : "Need a lighter with uses remaining";
    }

    this.renderCookSlots();
    this.paintCookTimers();
  }

  private renderCookSlots() {
    cancelAllSlotDrags();
    const slots = this.cookSlots;
    this.cookSectionEl.hidden = !slots;
    this.cookRowEl.replaceChildren();
    this.packRowEl.replaceChildren();
    this.cookTimerEls = [];
    if (!slots) return;

    const rawCount = this.countRawMeat();
    const count = Math.max(COOK_SLOT_COUNT, slots.length);
    for (let i = 0; i < count; i++) {
      const slot = slots[i] ?? { itemId: "", stageStartedAt: 0 };
      const cell = document.createElement("div");
      cell.className = "inventory-cell fireplace-fuel-cell fireplace-cook-cell";
      cell.dataset.cookIndex = String(i);
      cell.dataset.filled = slot.itemId.length > 0 ? "1" : "0";
      cell.tabIndex = 0;
      const filled = slot.itemId.length > 0;
      if (filled) {
        cell.classList.add("inventory-cell--filled");
        const def = getItemDefinition(slot.itemId);
        if (appendItemIcon(cell, slot.itemId, "inventory-cell-icon")) {
          cell.classList.add("inventory-cell--has-icon");
        }
        cell.title = def
          ? `${def.name}. Click or drag it off the fire`
          : "Click or drag it off the fire";
        cell.setAttribute("aria-label", cell.title);
        this.bindCookDrag(cell, i);
      } else {
        cell.classList.add("fireplace-fuel-cell--empty");
        cell.title = rawCount > 0 ? "Drop raw meat" : "Needs raw meat";
        cell.setAttribute("aria-label", cell.title);
      }
      const timer = document.createElement("span");
      timer.className = "inventory-cell-qty";
      cell.appendChild(timer);
      this.cookTimerEls.push(timer);
      cell.addEventListener("click", () => this.handlers.onCookSlot(i));
      cell.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        this.handlers.onCookSlot(i);
      });
      this.cookRowEl.appendChild(cell);
    }
    this.renderPackMeat();
  }

  private countRawMeat(): number {
    let total = 0;
    for (const slot of this.inventory) {
      if (slot && isRawMeat(slot.id)) total += slot.quantity;
    }
    return total;
  }

  /** Raw meat in the player's pack. Drag a stack onto an empty fire slot. */
  private renderPackMeat() {
    const stacks: { index: number; itemId: string; quantity: number; name: string }[] = [];
    for (let i = 0; i < this.inventory.length; i++) {
      const slot = this.inventory[i];
      if (!slot || slot.quantity <= 0 || !isRawMeat(slot.id)) continue;
      stacks.push({
        index: i,
        itemId: slot.id,
        quantity: slot.quantity,
        name: getItemDefinition(slot.id)?.name ?? "Raw meat",
      });
    }
    if (stacks.length === 0) {
      const empty = document.createElement("div");
      empty.className = "fireplace-pack-empty";
      empty.textContent = "No raw meat";
      this.packRowEl.appendChild(empty);
      return;
    }
    for (const stack of stacks) {
      const cell = document.createElement("div");
      cell.className =
        "inventory-cell fireplace-fuel-cell fireplace-pack-cell inventory-cell--filled";
      cell.dataset.packSlot = String(stack.index);
      cell.dataset.meatId = stack.itemId;
      cell.title = `Drag ${stack.name} onto the fire`;
      cell.setAttribute("aria-label", `${stack.name} ×${stack.quantity}`);
      if (appendItemIcon(cell, stack.itemId, "inventory-cell-icon")) {
        cell.classList.add("inventory-cell--has-icon");
      }
      if (stack.quantity > 1) {
        const qty = document.createElement("span");
        qty.className = "inventory-cell-qty";
        qty.textContent = String(stack.quantity);
        cell.appendChild(qty);
      }
      this.bindPackDrag(cell);
      this.packRowEl.appendChild(cell);
    }
  }

  private bindPackDrag(cell: HTMLElement) {
    bindSlotPointerDnD({
      cell,
      root: this.overlay,
      tapKey: `fire-pack:${cell.dataset.packSlot ?? ""}`,
      getLastTap: () => this.lastTap,
      setLastTap: (tap) => {
        this.lastTap = tap;
      },
      resolveTarget: (el) => this.cookDropTarget(el),
      canDropOn: (target) => target.dataset.filled === "0",
      onDropOn: (target) => {
        const slot = Number(target.dataset.cookIndex);
        const meatId = cell.dataset.meatId;
        if (Number.isInteger(slot) && meatId) this.handlers.onCookSlot(slot, meatId);
      },
      clearHover: () => this.clearCookDragHover(),
      setHover: (target, valid) => {
        target.classList.toggle("inventory-cell--drag-over", valid);
        target.classList.toggle("inventory-cell--drag-invalid", !valid);
      },
    });
  }

  private bindCookDrag(cell: HTMLElement, cookIndex: number) {
    bindSlotPointerDnD({
      cell,
      root: this.overlay,
      tapKey: `fire-cook:${cookIndex}`,
      getLastTap: () => this.lastTap,
      setLastTap: (tap) => {
        this.lastTap = tap;
      },
      resolveTarget: () => this.packSectionEl,
      canDropOn: () => true,
      onDropOn: () => this.handlers.onCookSlot(cookIndex),
      clearHover: () => this.clearCookDragHover(),
      setHover: (target, valid) => {
        target.classList.toggle("inventory-cell--drag-over", valid);
        target.classList.toggle("inventory-cell--drag-invalid", !valid);
      },
    });
  }

  /** Empty cook slot under the pointer, or the first empty slot if they drop on the row. */
  private cookDropTarget(el: Element | null): HTMLElement | null {
    const hit = el?.closest?.(".fireplace-cook-cell") as HTMLElement | null;
    if (hit && this.overlay.contains(hit)) return hit;
    if (
      el?.closest?.(".fireplace-cook-row") ||
      el?.closest?.(".fireplace-cook-section")
    ) {
      if (el.closest(".fireplace-pack-drop")) return null;
      return this.cookRowEl.querySelector<HTMLElement>(
        ".fireplace-cook-cell[data-filled='0']",
      );
    }
    return null;
  }

  private clearCookDragHover() {
    this.overlay
      .querySelectorAll(".inventory-cell--drag-over, .inventory-cell--drag-invalid, .fireplace-pack-drop.inventory-cell--drag-over")
      .forEach((el) => {
        el.classList.remove("inventory-cell--drag-over", "inventory-cell--drag-invalid");
      });
  }

  private paintCookTimers() {
    if (!this.cookSlots) return;
    const burning = fireplaceIsActive(this.activeUntil);
    const now = Date.now();
    for (let i = 0; i < this.cookSlots.length; i++) {
      const el = this.cookTimerEls[i];
      const slot = this.cookSlots[i];
      if (!el || !slot) continue;
      const cooking =
        burning && slot.stageStartedAt > 0 && cookResultOf(slot.itemId) != null;
      const leftMs = COOK_STAGE_MS - (now - slot.stageStartedAt);
      el.textContent = cooking ? `${Math.max(0, Math.ceil(leftMs / 1000))}s` : "";
    }
  }

  private startCookTimer() {
    this.stopCookTimer();
    this.cookTimer = window.setInterval(() => this.paintCookTimers(), 250);
  }

  private stopCookTimer() {
    if (this.cookTimer == null) return;
    window.clearInterval(this.cookTimer);
    this.cookTimer = null;
  }
}
