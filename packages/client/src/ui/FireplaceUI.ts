import {
  FIREPLACE_MAX_FUEL,
  countItemInInventory,
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

export type FireplaceUIHandlers = {
  onClose: () => void;
  onAddWood: () => void;
  onLight: () => void;
  onExtinguish: () => void;
};

export type FireplaceUIState = {
  x: number;
  y: number;
  fuelWood: number;
  activeUntil: number;
  inventoryJson: string;
  hasLighter: boolean;
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
  }

  private applyState(state: FireplaceUIState) {
    this.fuelWood = Math.max(0, Math.min(FIREPLACE_MAX_FUEL, state.fuelWood));
    this.activeUntil = state.activeUntil;
    this.hasLighter = state.hasLighter;
    this.inventory = parseInventory(state.inventoryJson);
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
        ? "Fireplace is full"
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
  }
}
