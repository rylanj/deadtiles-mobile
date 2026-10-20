import {
  getItemDefinition,
  type StructureBuildKind,
} from "@zombie/shared";
import { appendItemIcon } from "./itemIcons";
import { createDialogCloseButton } from "./dialogCloseBtn";
import { resetDialogScroll } from "./dialogScroll";
import { claimPageOverlay } from "./pageOverlay";
import "./mobile/fire.css";
import { itemIconImg, markSheetOpen, sheetButton, useMobileSheet } from "./mobileSheet";

export type DeconstructUIHandlers = {
  onClose: () => void;
  onDeconstruct: () => void;
};

export type DeconstructUIState = {
  x: number;
  y: number;
  kind: StructureBuildKind;
  refund: { itemId: string; quantity: number }[];
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

function makeRefundCell(opts: {
  itemId: string;
  quantity: number;
  ariaLabel: string;
}): HTMLElement {
  const cell = document.createElement("div");
  cell.className = "inventory-cell inventory-cell--filled red-dialog-task-cell";
  cell.setAttribute("role", "img");
  cell.setAttribute("aria-label", opts.ariaLabel);
  cell.tabIndex = -1;

  const hasIcon = appendItemIcon(cell, opts.itemId, "inventory-cell-icon");
  if (hasIcon) cell.classList.add("inventory-cell--has-icon");

  const qty = document.createElement("span");
  qty.className = "inventory-cell-qty";
  qty.textContent = `×${opts.quantity}`;
  cell.appendChild(qty);

  return cell;
}

export class DeconstructUI {
  private visible = false;
  private tile: { x: number; y: number } | null = null;
  private kind: StructureBuildKind = "wall";
  private refund: { itemId: string; quantity: number }[] = [];

  private overlay: HTMLElement;
  private layoutEl!: HTMLElement;
  private phoneCard: HTMLElement | null = null;
  private msOn = false;
  private durationMs = 30_000;
  private titleEl: HTMLElement;
  private statusEl: HTMLElement;
  private refundListEl: HTMLElement;
  private deconstructBtn: HTMLButtonElement;

  constructor(private handlers: DeconstructUIHandlers) {
    this.overlay = document.createElement("div");
    this.overlay.id = "deconstruct-overlay";
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
    this.titleEl.textContent = "Deconstruct";
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
    label.textContent = "Resources refunded";

    this.refundListEl = document.createElement("div");
    this.refundListEl.className = "prefab-cost-list";

    const actions = document.createElement("div");
    actions.className = "fireplace-actions";

    this.deconstructBtn = document.createElement("button");
    this.deconstructBtn.type = "button";
    this.deconstructBtn.className = "red-dialog-complete-btn prefab-cancel-btn";
    this.deconstructBtn.textContent = "Deconstruct (30s)";
    this.deconstructBtn.addEventListener("click", () =>
      this.handlers.onDeconstruct(),
    );

    actions.append(this.deconstructBtn);

    body.append(label, this.refundListEl, actions);
    panel.append(header, body);
    layout.appendChild(panel);
    this.overlay.appendChild(layout);

    this.overlay.addEventListener("click", (e) => {
      if (useMobileSheet()) {
        if (e.target === this.overlay) this.handlers.onClose();
        return;
      }
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

  open(state: DeconstructUIState) {
    this.tile = { x: state.x, y: state.y };
    this.kind = state.kind;
    this.refund = state.refund.map((line) => ({ ...line }));
    const durationMs =
      typeof state.durationMs === "number" && state.durationMs > 0
        ? state.durationMs
        : 30_000;
    this.durationMs = durationMs;
    this.deconstructBtn.textContent = `Deconstruct (${Math.max(1, Math.round(durationMs / 1000))}s)`;
    this.visible = true;
    this.overlay.hidden = false;
    document.body.classList.add("deconstruct-open");
    this.applyPhone();
    this.render();
    resetDialogScroll(this.overlay);
  }

  close() {
    this.visible = false;
    this.overlay.hidden = true;
    document.body.classList.remove("deconstruct-open");
    this.overlay.classList.remove("ms-card-host");
    this.layoutEl.hidden = false;
    this.phoneCard?.remove();
    this.phoneCard = null;
    markSheetOpen("take-down", false);
    this.msOn = false;
    this.tile = null;
    this.refund = [];
  }

  destroy() {
    this.close();
    this.overlay.remove();
  }

  private render() {
    if (this.msOn) {
      this.renderMobile();
      return;
    }
    this.titleEl.textContent = `Deconstruct ${KIND_LABELS[this.kind] ?? "structure"}`;
    this.statusEl.textContent = "Only structures you built can be deconstructed";

    this.refundListEl.replaceChildren();
    for (const line of this.refund) {
      const row = document.createElement("div");
      row.className = "prefab-cost-row";

      const def = getItemDefinition(line.itemId);
      const name = def?.name ?? line.itemId;
      row.appendChild(
        makeRefundCell({
          itemId: line.itemId,
          quantity: line.quantity,
          ariaLabel: `${name} ×${line.quantity}`,
        }),
      );

      const info = document.createElement("div");
      info.className = "prefab-cost-info";
      const nameEl = document.createElement("span");
      nameEl.className = "prefab-cost-name";
      nameEl.textContent = name;
      info.appendChild(nameEl);
      row.appendChild(info);
      this.refundListEl.appendChild(row);
    }
  }

  private applyPhone() {
    this.msOn = useMobileSheet();
    this.overlay.classList.toggle("ms-card-host", this.msOn);
    this.layoutEl.hidden = this.msOn;
    markSheetOpen("take-down", this.visible && this.msOn);
  }

  private renderMobile() {
    this.phoneCard?.remove();
    const name = (KIND_LABELS[this.kind] ?? "structure").toLowerCase();
    const seconds = Math.max(1, Math.round(this.durationMs / 1000));
    const card = document.createElement("div");
    card.className = "ms-drawer ms-tone-red";
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-label", `Take down this ${name}?`);
    const grab = document.createElement("div");
    grab.className = "ms-grab";
    const body = document.createElement("div");
    body.className = "ms-drawer-scroll";
    const title = document.createElement("h2");
    title.className = "ms-take-title";
    title.textContent = `Take down this ${name}?`;
    const hint = document.createElement("p");
    hint.className = "ms-hint ms-take-hint";
    hint.textContent = `Stand still for ${seconds} s. You get these materials back.`;
    const list = document.createElement("div");
    list.className = "ms-card ms-take-card";
    if (this.refund.length === 0) {
      const empty = document.createElement("p");
      empty.className = "ms-hint";
      empty.textContent = "Nothing comes back.";
      list.append(empty);
    }
    for (const line of this.refund) {
      const row = document.createElement("div");
      row.className = "ms-kv";
      const label = document.createElement("span");
      label.className = "ms-kv-k";
      const img = itemIconImg(line.itemId);
      if (img) label.append(img);
      label.append(
        document.createTextNode(getItemDefinition(line.itemId)?.name ?? line.itemId),
      );
      const value = document.createElement("b");
      value.className = "ms-kv-v";
      value.textContent = `×${line.quantity}`;
      row.append(label, value);
      list.append(row);
    }
    body.append(title, hint, list);
    const bar = document.createElement("div");
    bar.className = "ms-bar";
    bar.append(
      sheetButton(`Take down · ${seconds} s`, "danger", () => this.handlers.onDeconstruct()),
      sheetButton("Keep it", "sec", () => this.handlers.onClose()),
    );
    card.append(grab, body, bar);
    this.overlay.append(card);
    this.phoneCard = card;
  }
}
