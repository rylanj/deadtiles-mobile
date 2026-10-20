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
import { claimPageOverlay } from "./pageOverlay";
import "./mobile/fire.css";
import {
  createSheet,
  itemIconImg,
  markSheetOpen,
  sectionLabel,
  sheetButton,
  sheetRow,
  useMobileSheet,
  type Sheet,
} from "./mobileSheet";
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
  /** Warehouse furnace only. Opens metal recipes while the fire is lit. */
  onCraft?: () => void;
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
  /** Set on warehouse furnaces so metal recipes can be opened from this fire. */
  stationId?: string;
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
  private stationId = "";
  private inventory: Inventory = [];

  private overlay: HTMLElement;
  private layoutEl!: HTMLElement;
  private ms: Sheet | null = null;
  private msOn = false;
  private statusEl: HTMLElement;
  private fuelRowEl: HTMLElement;
  private lightSectionEl: HTMLElement;
  private lightReqRowEl: HTMLElement;
  private addBtn: HTMLButtonElement;
  private lightBtn: HTMLButtonElement;
  private extinguishBtn: HTMLButtonElement;
  private craftSectionEl: HTMLElement;
  private craftHintEl: HTMLElement;
  private craftBtn: HTMLButtonElement;
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
    this.layoutEl = layout;

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

    this.craftSectionEl = document.createElement("div");
    this.craftSectionEl.className = "fireplace-craft-section";
    this.craftSectionEl.hidden = true;
    const craftTitle = document.createElement("div");
    craftTitle.className = "fireplace-section-label";
    craftTitle.textContent = "Metalwork";
    this.craftHintEl = document.createElement("div");
    this.craftHintEl.className = "inventory-hint";
    this.craftBtn = document.createElement("button");
    this.craftBtn.type = "button";
    this.craftBtn.className = "red-dialog-complete-btn";
    this.craftBtn.textContent = "Craft";
    this.craftBtn.addEventListener("click", () => this.handlers.onCraft?.());
    this.craftSectionEl.append(craftTitle, this.craftHintEl, this.craftBtn);

    body.append(
      fuelLabel,
      this.fuelRowEl,
      this.cookSectionEl,
      fuelActions,
      this.lightSectionEl,
      this.craftSectionEl,
    );
    panel.append(header, body);
    layout.appendChild(panel);
    this.overlay.appendChild(layout);

    this.overlay.addEventListener("click", (e) => {
      if (useMobileSheet()) return;
      if (e.target === this.overlay) this.handlers.onClose();
    });

    claimPageOverlay(this.overlay.id);
    document.body.appendChild(this.overlay);
  }

  isOpen() {
    return this.visible;
  }

  getTile() {
    return this.tile;
  }

  getStationId() {
    return this.stationId;
  }

  getActiveUntil() {
    return this.activeUntil;
  }

  open(state: FireplaceUIState) {
    this.tile = { x: state.x, y: state.y };
    this.applyState(state);
    this.visible = true;
    this.overlay.hidden = false;
    document.body.classList.add("fireplace-open");
    this.applyPhone();
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
    this.overlay.classList.remove("ms-host");
    this.layoutEl.hidden = false;
    if (this.ms) this.ms.root.hidden = true;
    markSheetOpen("fire", false);
    this.msOn = false;
    this.tile = null;
    this.fuelWood = 0;
    this.activeUntil = 0;
    this.hasLighter = false;
    this.stationId = "";
    this.inventory = [];
    this.cookSlots = null;
    this.cookTimerEls = [];
    this.lastTap = null;
    cancelAllSlotDrags();
    this.stopCookTimer();
  }

  destroy() {
    this.close();
    this.overlay.remove();
  }

  private applyState(state: FireplaceUIState) {
    this.fuelWood = Math.max(0, Math.min(FIREPLACE_MAX_FUEL, state.fuelWood));
    this.activeUntil = state.activeUntil;
    this.hasLighter = state.hasLighter;
    this.stationId = state.stationId ?? "";
    this.titleName = state.title?.trim() || "Fireplace";
    this.titleEl.textContent = this.titleName;
    this.inventory = parseInventory(state.inventoryJson);
    this.cookSlots = state.cookSlots === undefined ? null : state.cookSlots;
  }

  private render() {
    if (this.msOn) {
      this.renderMobile();
      this.paintMobileCook();
      return;
    }
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

    const metal = this.stationId.length > 0;
    this.craftSectionEl.hidden = !metal;
    if (metal) {
      this.craftBtn.disabled = !burning;
      this.craftHintEl.textContent = burning
        ? "Screws, bolts, hammers, and hatchets. Break those tools back into scrap. The fire must stay lit."
        : "Light the furnace to work metal.";
      this.craftBtn.title = burning
        ? "Open metal recipes"
        : "Light the furnace first";
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
    if (this.msOn) {
      this.paintMobileCook();
      return;
    }
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

  private applyPhone() {
    this.msOn = useMobileSheet();
    this.overlay.classList.toggle("ms-host", this.msOn);
    this.layoutEl.hidden = this.msOn;
    if (this.msOn && !this.ms) {
      this.ms = createSheet({ onClose: () => this.handlers.onClose() });
      this.ms.root.classList.add("ms-fire");
      this.overlay.append(this.ms.root);
    }
    if (this.ms) this.ms.root.hidden = !this.msOn;
    markSheetOpen("fire", this.visible && this.msOn);
  }

  private renderMobile() {
    const sheet = this.ms;
    if (!sheet) return;
    const burning = fireplaceIsActive(this.activeUntil);
    sheet.header.setBack(null);
    sheet.header.setTitle(this.titleName);
    sheet.header.setSub(burning ? "Burning" : "Cold");
    const nodes: HTMLElement[] = [this.fireCard(burning)];
    if (this.cookSlots) {
      nodes.push(sectionLabel("On the fire", `${COOK_SLOT_COUNT} spots`));
      nodes.push(this.cookGrid());
      const hint = document.createElement("p");
      hint.className = "ms-hint";
      hint.textContent = "Tap cooked food to take it. It burns 60 s after it's done.";
      nodes.push(hint);
      nodes.push(sectionLabel("Raw meat in your bag"));
      nodes.push(...this.rawRows());
    }
    if (this.stationId) {
      nodes.push(sectionLabel("Metalwork"));
      nodes.push(
        sheetRow({
          name: "Craft at the furnace",
          meta: [
            burning
              ? "Screws, bolts, hammers, and hatchets"
              : "Light the furnace first",
          ],
          metaTone: burning ? undefined : "warn",
          chevron: true,
          state: burning ? undefined : "dim",
          onTap: burning ? () => this.handlers.onCraft?.() : undefined,
        }),
      );
    }
    const scroll = sheet.body.scrollTop;
    sheet.body.replaceChildren(...nodes);
    sheet.body.scrollTop = scroll;
    this.renderFireBar(sheet, burning);
  }

  private fireCard(burning: boolean): HTMLElement {
    const card = document.createElement("div");
    card.className = "ms-card ms-fire-card";
    const flame = document.createElement("div");
    flame.className = burning ? "ms-fire-flame" : "ms-fire-flame ms-fire-flame--cold";
    const text = document.createElement("div");
    text.className = "ms-fire-card-t";
    const state = document.createElement("div");
    state.className = "ms-fire-state";
    state.dataset.fireState = "1";
    state.textContent = burning ? "Burning" : "Cold";
    const hint = document.createElement("div");
    hint.className = "ms-hint";
    hint.dataset.fireHint = "1";
    text.append(state, hint);
    const pips = document.createElement("div");
    pips.className = "ms-fire-pips";
    pips.dataset.firePips = "1";
    for (let i = 0; i < FIREPLACE_MAX_FUEL; i++) {
      const pip = document.createElement("i");
      if (i < this.fuelWood) pip.className = "on";
      pips.append(pip);
    }
    text.append(pips);
    card.append(flame, text);
    return card;
  }

  private cookGrid(): HTMLElement {
    const grid = document.createElement("div");
    grid.className = "ms-fire-spots";
    const slots = this.cookSlots ?? [];
    const count = Math.max(COOK_SLOT_COUNT, slots.length);
    for (let i = 0; i < count; i++) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "ms-fire-spot";
      btn.dataset.cookIndex = String(i);
      const inner = document.createElement("div");
      inner.className = "ms-fire-spot-in";
      inner.dataset.cookInner = "1";
      const cap = document.createElement("span");
      cap.className = "ms-fire-cap";
      cap.dataset.cookCap = "1";
      const tag = document.createElement("span");
      tag.className = "ms-fire-tag";
      tag.dataset.cookTag = "1";
      tag.hidden = true;
      inner.append(cap, tag);
      btn.append(inner);
      btn.addEventListener("click", () => this.tapCookSpot(i));
      grid.append(btn);
    }
    return grid;
  }

  private tapCookSpot(index: number) {
    const slot = this.cookSlots?.[index];
    if (slot?.itemId) {
      this.handlers.onCookSlot(index);
      return;
    }
    const meatId = this.rawStacks()[0]?.itemId;
    if (meatId) this.handlers.onCookSlot(index, meatId);
  }

  private rawStacks(): { itemId: string; quantity: number; name: string }[] {
    const totals = new Map<string, number>();
    for (const slot of this.inventory) {
      if (!slot || slot.quantity <= 0 || !isRawMeat(slot.id)) continue;
      totals.set(slot.id, (totals.get(slot.id) ?? 0) + slot.quantity);
    }
    return [...totals.entries()].map(([itemId, quantity]) => ({
      itemId,
      quantity,
      name: getItemDefinition(itemId)?.name ?? "Raw meat",
    }));
  }

  private rawRows(): HTMLElement[] {
    const stacks = this.rawStacks();
    if (stacks.length === 0) {
      const empty = document.createElement("p");
      empty.className = "ms-hint";
      empty.textContent = "No raw meat in your bag.";
      return [empty];
    }
    const slots = this.cookSlots ?? [];
    let open = -1;
    for (let i = 0; i < COOK_SLOT_COUNT; i++) {
      if (!slots[i]?.itemId) {
        open = i;
        break;
      }
    }
    const burning = fireplaceIsActive(this.activeUntil);
    return stacks.map((stack) => {
      const cook = sheetButton("Cook", "pri", () => {
        if (open >= 0) this.handlers.onCookSlot(open, stack.itemId);
      }, { small: true });
      cook.disabled = open < 0;
      return sheetRow({
        iconItemId: stack.itemId,
        qty: stack.quantity,
        name: stack.name,
        meta: [
          open < 0
            ? "Fire is full"
            : burning
              ? `×${stack.quantity} · about 60 s`
              : `×${stack.quantity} · cooks once the fire is lit`,
        ],
        metaTone: open < 0 ? "warn" : undefined,
        end: cook,
      });
    });
  }

  private renderFireBar(sheet: Sheet, burning: boolean) {
    sheet.bar.replaceChildren();
    const woodCount = countItemInInventory(this.inventory, "wood");
    const canAdd = woodCount >= 1 && this.fuelWood < FIREPLACE_MAX_FUEL;
    if (burning) {
      const add = sheetButton("Add wood", "pri", () => this.handlers.onAddWood(), {
        sub: woodCount === 1 ? "1 in bag" : `${woodCount} in bag`,
      });
      add.disabled = !canAdd;
      const putOut = sheetButton("Put out", "sec", () => this.handlers.onExtinguish());
      sheet.bar.append(add, putOut);
    } else {
      const reason =
        this.fuelWood <= 0 ? "Add wood first" : !this.hasLighter ? "Need a lighter" : undefined;
      const light = sheetButton("Light fire", "pri", () => this.handlers.onLight(), {
        sub: reason,
      });
      light.disabled = !!reason;
      sheet.bar.append(light);
      if (this.fuelWood < FIREPLACE_MAX_FUEL) {
        const add = sheetButton("Add wood", "sec", () => this.handlers.onAddWood(), {
          sub: woodCount === 1 ? "1 in bag" : `${woodCount} in bag`,
        });
        add.disabled = woodCount < 1;
        sheet.bar.append(add);
      }
    }
    sheet.syncBar();
  }

  private paintMobileCook() {
    const sheet = this.ms;
    if (!sheet) return;
    const burning = fireplaceIsActive(this.activeUntil);
    const state = sheet.body.querySelector<HTMLElement>("[data-fire-state]");
    const hint = sheet.body.querySelector<HTMLElement>("[data-fire-hint]");
    if (state) state.textContent = burning ? "Burning" : "Cold";
    if (hint) {
      const wood = `${this.fuelWood} of ${FIREPLACE_MAX_FUEL} wood`;
      if (burning) {
        const mins = Math.max(1, Math.ceil((this.activeUntil - Date.now()) / 60000));
        hint.textContent = `About ${mins} min left · ${wood}`;
      } else {
        hint.textContent = wood;
      }
    }
    const flame = sheet.body.querySelector(".ms-fire-flame");
    flame?.classList.toggle("ms-fire-flame--cold", !burning);
    if (!this.cookSlots) return;
    const now = Date.now();
    const spots = sheet.body.querySelectorAll<HTMLButtonElement>(".ms-fire-spot");
    spots.forEach((spot) => {
      const index = Number(spot.dataset.cookIndex);
      const slot = this.cookSlots?.[index];
      const inner = spot.querySelector<HTMLElement>("[data-cook-inner]");
      const cap = spot.querySelector<HTMLElement>("[data-cook-cap]");
      const tag = spot.querySelector<HTMLElement>("[data-cook-tag]");
      if (!inner) return;
      spot.classList.remove("ms-fire-spot--empty", "ms-fire-spot--done", "ms-fire-spot--burnt");
      spot.style.background = "";
      if (tag) {
        tag.hidden = true;
        tag.className = "ms-fire-tag";
        tag.textContent = "";
      }
      if (cap) cap.textContent = "";
      if (!slot?.itemId) {
        spot.classList.add("ms-fire-spot--empty");
        if (cap) cap.textContent = "+";
        return;
      }
      if (!inner.querySelector("img")) {
        const img = itemIconImg(slot.itemId);
        if (img && cap) inner.insertBefore(img, cap);
      }
      const next = cookResultOf(slot.itemId);
      const raw = isRawMeat(slot.itemId);
      if (!next) {
        spot.classList.add("ms-fire-spot--burnt");
        if (tag) {
          tag.hidden = false;
          tag.classList.add("ms-fire-tag--bad");
          tag.textContent = "Burnt";
        }
        return;
      }
      const cooking = burning && slot.stageStartedAt > 0;
      const leftMs = COOK_STAGE_MS - (now - slot.stageStartedAt);
      const pct = cooking
        ? Math.max(0, Math.min(100, (1 - leftMs / COOK_STAGE_MS) * 100))
        : 0;
      if (!raw) {
        spot.classList.add("ms-fire-spot--done");
        if (tag) {
          tag.hidden = false;
          tag.classList.add("ms-fire-tag--ok");
          tag.textContent = "Done";
        }
      }
      if (cooking) {
        const color = raw ? "#5ec85e" : "#d9b43a";
        spot.style.background = `conic-gradient(${color} ${pct}%, rgba(255,255,255,0.06) 0)`;
        if (cap) cap.textContent = `${Math.max(0, Math.ceil(leftMs / 1000))}s`;
      }
    });
  }
}
