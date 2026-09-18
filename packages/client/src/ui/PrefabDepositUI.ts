import {
  countItemInInventory,
  getItemDefinition,
  getStructureBuildCosts,
  parseInventory,
  parseStructureDepositsJson,
  remainingDepositCapacity,
  structureDepositsMeetCost,
  type Inventory,
  type StructureBuildKind,
  type StructureDeposits,
} from "@zombie/shared";
import { appendItemIcon } from "./itemIcons";
import { createDialogCloseButton } from "./dialogCloseBtn";
import { resetDialogScroll } from "./dialogScroll";

export type PrefabDepositUIHandlers = {
  onClose: () => void;
  onDeposit: (itemId: string, quantity: number) => void;
  onBuild: () => void;
  onCancel: () => void;
};

export type PrefabDepositUIState = {
  x: number;
  y: number;
  kind: StructureBuildKind;
  depositsJson: string;
  inventoryJson: string;
  funded?: boolean;
  durationMs?: number;
};

const KIND_LABELS: Record<StructureBuildKind, string> = {
  wall: "Wall",
  door: "Door",
  fireplace: "Fireplace",
  fence: "Barbed Wire Fence",
  fence_corner: "Barbed Wire Fence Corner",
  bargate: "Bargate",
};

function makeCostCell(opts: {
  itemId: string;
  have: number;
  need: number;
  ariaLabel: string;
}): HTMLElement {
  const cell = document.createElement("div");
  cell.className = "inventory-cell inventory-cell--filled red-dialog-task-cell";
  if (opts.have < opts.need) cell.classList.add("craft-cell--missing");
  cell.setAttribute("role", "img");
  cell.setAttribute("aria-label", opts.ariaLabel);
  cell.tabIndex = -1;

  const hasIcon = appendItemIcon(cell, opts.itemId, "inventory-cell-icon");
  if (hasIcon) cell.classList.add("inventory-cell--has-icon");

  const qty = document.createElement("span");
  qty.className = "inventory-cell-qty";
  qty.textContent = `${Math.min(opts.have, opts.need)}/${opts.need}`;
  cell.appendChild(qty);

  return cell;
}

export class PrefabDepositUI {
  private visible = false;
  private tile: { x: number; y: number } | null = null;
  private kind: StructureBuildKind = "wall";
  private deposits: StructureDeposits = {};
  private inventory: Inventory = [];
  private durationMs = 30_000;

  private overlay: HTMLElement;
  private titleEl: HTMLElement;
  private statusEl: HTMLElement;
  private costListEl: HTMLElement;
  private buildBtn: HTMLButtonElement;
  private cancelBtn: HTMLButtonElement;

  constructor(private handlers: PrefabDepositUIHandlers) {
    this.overlay = document.createElement("div");
    this.overlay.id = "prefab-overlay";
    this.overlay.hidden = true;

    const layout = document.createElement("div");
    layout.className = "fireplace-layout";

    const panel = document.createElement("div");
    panel.className = "inventory-panel craft-panel fireplace-panel";

    const header = document.createElement("div");
    header.className = "inventory-header";
    const headerTop = document.createElement("div");
    headerTop.className = "inventory-header-top";
    this.titleEl = document.createElement("h2");
    this.titleEl.className = "inventory-title";
    this.titleEl.textContent = "Prefab";
    headerTop.append(
      this.titleEl,
      createDialogCloseButton(() => this.handlers.onClose()),
    );
    this.statusEl = document.createElement("span");
    this.statusEl.className = "inventory-hint";
    header.append(headerTop, this.statusEl);

    const body = document.createElement("div");
    body.className = "craft-body fireplace-body";

    const label = document.createElement("div");
    label.className = "fireplace-section-label";
    label.textContent = "Materials needed";

    this.costListEl = document.createElement("div");
    this.costListEl.className = "prefab-cost-list";

    const actions = document.createElement("div");
    actions.className = "fireplace-actions";

    this.buildBtn = document.createElement("button");
    this.buildBtn.type = "button";
    this.buildBtn.className = "red-dialog-complete-btn";
    this.buildBtn.textContent = "Build (30s)";
    this.buildBtn.addEventListener("click", () => this.handlers.onBuild());

    this.cancelBtn = document.createElement("button");
    this.cancelBtn.type = "button";
    this.cancelBtn.className = "red-dialog-complete-btn prefab-cancel-btn";
    this.cancelBtn.textContent = "Cancel prefab";
    this.cancelBtn.addEventListener("click", () => this.handlers.onCancel());

    actions.append(this.buildBtn, this.cancelBtn);

    body.append(label, this.costListEl, actions);
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

  open(state: PrefabDepositUIState) {
    this.tile = { x: state.x, y: state.y };
    this.applyState(state);
    this.visible = true;
    this.overlay.hidden = false;
    document.body.classList.add("prefab-open");
    this.render();
    resetDialogScroll(this.overlay);
  }

  sync(state: PrefabDepositUIState) {
    if (!this.visible || !this.tile) return;
    if (state.x !== this.tile.x || state.y !== this.tile.y) return;
    this.applyState(state);
    this.render();
  }

  close() {
    this.visible = false;
    this.overlay.hidden = true;
    document.body.classList.remove("prefab-open");
    this.tile = null;
    this.deposits = {};
    this.inventory = [];
  }

  private applyState(state: PrefabDepositUIState) {
    this.kind = state.kind;
    this.deposits = parseStructureDepositsJson(state.depositsJson);
    this.inventory = parseInventory(state.inventoryJson);
    if (typeof state.durationMs === "number" && state.durationMs > 0) {
      this.durationMs = state.durationMs;
    }
  }

  private render() {
    this.titleEl.textContent = KIND_LABELS[this.kind] ?? "Prefab";
    const funded = structureDepositsMeetCost(this.kind, this.deposits);
    this.statusEl.textContent = funded
      ? "Fully stocked. Ready to build"
      : "Deposit the remaining materials";
    this.buildBtn.textContent = `Build (${Math.max(1, Math.round(this.durationMs / 1000))}s)`;

    this.costListEl.replaceChildren();
    for (const line of getStructureBuildCosts(this.kind)) {
      const row = document.createElement("div");
      row.className = "prefab-cost-row";

      const have = this.deposits[line.itemId] ?? 0;
      const def = getItemDefinition(line.itemId);
      const name = def?.name ?? line.itemId;
      row.appendChild(
        makeCostCell({
          itemId: line.itemId,
          have,
          need: line.quantity,
          ariaLabel: `${name} ${Math.min(have, line.quantity)}/${line.quantity}`,
        }),
      );

      const info = document.createElement("div");
      info.className = "prefab-cost-info";
      const nameEl = document.createElement("span");
      nameEl.className = "prefab-cost-name";
      nameEl.textContent = name;
      info.appendChild(nameEl);

      const capacity = remainingDepositCapacity(this.kind, this.deposits, line.itemId);
      const inStock = countItemInInventory(this.inventory, line.itemId);
      const depositAmount = Math.min(capacity, Math.max(inStock, 0));

      if (capacity > 0) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "red-dialog-complete-btn prefab-deposit-btn";
        btn.textContent = inStock > 0 ? `Deposit ×${depositAmount}` : "Deposit";
        btn.disabled = inStock <= 0;
        btn.title =
          inStock > 0
            ? `Deposit ${depositAmount} ${name}`
            : `No ${name} in inventory`;
        btn.addEventListener("click", () => {
          if (depositAmount > 0) this.handlers.onDeposit(line.itemId, depositAmount);
        });
        info.appendChild(btn);
      } else {
        const done = document.createElement("span");
        done.className = "prefab-cost-done";
        done.textContent = "Complete";
        info.appendChild(done);
      }

      row.appendChild(info);
      this.costListEl.appendChild(row);
    }

    this.buildBtn.hidden = !funded;
    this.buildBtn.disabled = !funded;
  }
}
