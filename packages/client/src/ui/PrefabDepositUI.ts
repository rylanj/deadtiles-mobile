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
import { claimPageOverlay } from "./pageOverlay";
import "./mobile/fire.css";
import {
  createSheet,
  markSheetOpen,
  meter,
  sheetButton,
  sheetRow,
  useMobileSheet,
  type Sheet,
} from "./mobileSheet";

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
  storage_box: "Storage Box",
  storage_box_2: "Storage Box 2",
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
  private layoutEl!: HTMLElement;
  private ms: Sheet | null = null;
  private msOn = false;
  private confirmCancel = false;
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
    this.layoutEl = layout;

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

  open(state: PrefabDepositUIState) {
    this.tile = { x: state.x, y: state.y };
    this.applyState(state);
    this.confirmCancel = false;
    this.visible = true;
    this.overlay.hidden = false;
    document.body.classList.add("prefab-open");
    this.applyPhone();
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
    this.overlay.classList.remove("ms-host");
    this.layoutEl.hidden = false;
    if (this.ms) this.ms.root.hidden = true;
    markSheetOpen("prefab", false);
    this.msOn = false;
    this.confirmCancel = false;
    this.tile = null;
    this.deposits = {};
    this.inventory = [];
  }

  destroy() {
    this.close();
    this.overlay.remove();
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
    if (this.msOn) {
      this.renderMobile();
      return;
    }
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

  private applyPhone() {
    this.msOn = useMobileSheet();
    this.overlay.classList.toggle("ms-host", this.msOn);
    this.layoutEl.hidden = this.msOn;
    if (this.msOn && !this.ms) {
      this.ms = createSheet({ onClose: () => this.handlers.onClose() });
      this.overlay.append(this.ms.root);
    }
    if (this.ms) this.ms.root.hidden = !this.msOn;
    markSheetOpen("prefab", this.visible && this.msOn);
  }

  private kindName(): string {
    return KIND_LABELS[this.kind] ?? "Build";
  }

  private depositPlans() {
    const plans: { itemId: string; quantity: number; name: string }[] = [];
    for (const line of getStructureBuildCosts(this.kind)) {
      const capacity = remainingDepositCapacity(this.kind, this.deposits, line.itemId);
      const inStock = countItemInInventory(this.inventory, line.itemId);
      const quantity = Math.min(capacity, Math.max(inStock, 0));
      if (quantity <= 0) continue;
      plans.push({
        itemId: line.itemId,
        quantity,
        name: getItemDefinition(line.itemId)?.name ?? line.itemId,
      });
    }
    return plans;
  }

  private renderMobile() {
    const sheet = this.ms;
    if (!sheet) return;
    const costs = getStructureBuildCosts(this.kind);
    const funded = structureDepositsMeetCost(this.kind, this.deposits);
    let filled = 0;
    let needSum = 0;
    let haveSum = 0;
    for (const line of costs) {
      const have = Math.min(this.deposits[line.itemId] ?? 0, line.quantity);
      if (have >= line.quantity) filled += 1;
      haveSum += have;
      needSum += line.quantity;
    }
    sheet.header.setBack(null);
    sheet.header.setTitle(`${this.kindName()} (unfinished)`);
    sheet.header.setSub(
      `${filled} of ${costs.length} ${costs.length === 1 ? "material" : "materials"} in`,
    );
    const nodes: HTMLElement[] = [];
    const total = meter(needSum > 0 ? (haveSum / needSum) * 100 : 0, "#5ec85e");
    total.classList.add("ms-prefab-total");
    nodes.push(total);
    for (const line of costs) {
      const have = this.deposits[line.itemId] ?? 0;
      const name = getItemDefinition(line.itemId)?.name ?? line.itemId;
      const done = have >= line.quantity;
      const carry = countItemInInventory(this.inventory, line.itemId);
      const row = sheetRow({
        iconItemId: line.itemId,
        name,
        meta: done ? undefined : [`you carry ${carry}`],
        state: !done && carry > 0 ? "on" : undefined,
        end: done ? this.okEnd(`${line.quantity} / ${line.quantity}`) : `${Math.min(have, line.quantity)} / ${line.quantity}`,
      });
      row.classList.add("ms-prefab-row");
      const track = meter(
        line.quantity > 0 ? (Math.min(have, line.quantity) / line.quantity) * 100 : 0,
        done ? "#5ec85e" : "#d9b43a",
      );
      row.querySelector(".ms-row-mid")?.append(track);
      nodes.push(row);
    }
    const note = document.createElement("p");
    note.className = "ms-hint";
    note.textContent = "Materials stay in the build if you walk away. Cancelling gives them back.";
    nodes.push(note);
    sheet.body.replaceChildren(...nodes);
    this.renderPrefabBar(sheet, funded);
  }

  private okEnd(text: string): HTMLElement {
    const end = document.createElement("span");
    end.className = "ms-ok";
    end.textContent = `${text} ✓`;
    return end;
  }

  private renderPrefabBar(sheet: Sheet, funded: boolean) {
    sheet.bar.replaceChildren();
    const plans = this.depositPlans();
    const seconds = Math.max(1, Math.round(this.durationMs / 1000));
    if (this.confirmCancel) {
      const yes = sheetButton("Refund materials", "danger", () => this.handlers.onCancel());
      const no = sheetButton("Keep building", "sec", () => {
        this.confirmCancel = false;
        this.render();
      });
      sheet.bar.append(yes, no);
    } else {
      if (!funded) {
        const label =
          plans.length === 0
            ? "Nothing to deposit"
            : plans.length === 1
              ? `Deposit ${plans[0]!.quantity} ${plans[0]!.name}`
              : "Deposit all";
        const deposit = sheetButton(
          label,
          "pri",
          () => {
            for (const plan of plans) this.handlers.onDeposit(plan.itemId, plan.quantity);
          },
          plans.length > 1 ? { sub: `${plans.length} materials` } : undefined,
        );
        deposit.disabled = plans.length === 0;
        sheet.bar.append(deposit);
      }
      const cancel = sheetButton(`Cancel ${this.kindName().toLowerCase()}`, "danger", () => {
        this.confirmCancel = true;
        this.render();
      });
      const build = sheetButton(`Build · ${seconds} s`, "sec", () => this.handlers.onBuild());
      build.disabled = !funded;
      sheet.bar.append(cancel, build);
    }
    sheet.syncBar();
  }
}
