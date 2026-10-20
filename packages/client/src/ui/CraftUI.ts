import {
  CRAFT_RECIPES,
  DISASSEMBLY_RECIPES,
  blueprintDisassemblyYield,
  canCraftRecipe,
  canDisassemble,
  craftDurationForSkill,
  craftRecipeIsVisible,
  countItemInInventory,
  fireplaceIsActive,
  getItemDefinition,
  isCraftItemQty,
  isWeaponItem,
  parseInventory,
  type CraftIngredient,
  type CraftRecipe,
  type CraftStationKind,
  type DisassemblyRecipe,
  type Inventory,
} from "@zombie/shared";
import { appendItemIcon } from "./itemIcons";
import { createDialogCloseButton } from "./dialogCloseBtn";
import { resetDialogScroll } from "./dialogScroll";
import { claimPageOverlay } from "./pageOverlay";
import "./mobile/craft.css";
import {
  createSheet,
  filterChips,
  itemIconImg,
  markSheetOpen,
  meter,
  sectionLabel,
  sheetButton,
  sheetRow,
  showSheetMessage,
  useMobileSheet,
  type Sheet,
} from "./mobileSheet";

export type CraftProgress = {
  elapsedMs: number;
  durationMs: number;
  confirmed: boolean;
};

export type CraftResult = {
  crafted?: { id: string; quantity: number; name: string };
  salvaged?: { id: string; quantity: number; name: string }[];
  ruined?: { name: string }[];
};

export type CraftUIHandlers = {
  onClose: () => void;
  onCraft: (recipeId: string) => void;
  /** Re-open the bench session so another craft can start. */
  onReopen?: () => void;
  onStop?: () => void;
  onAbandon?: () => void;
  onEquip?: (itemId: string) => void;
  getCraftProgress?: () => CraftProgress | null;
};

function makeDisplayCell(opts: {
  itemId: string;
  qtyLabel?: string;
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

  if (opts.qtyLabel) {
    const qty = document.createElement("span");
    qty.className = "inventory-cell-qty";
    qty.textContent = opts.qtyLabel;
    cell.appendChild(qty);
  }

  return cell;
}

function ingredientSatisfied(inventory: Inventory, ing: CraftIngredient): boolean {
  if (isCraftItemQty(ing)) {
    return countItemInInventory(inventory, ing.itemId) >= ing.quantity;
  }
  return ing.anyOf.some(
    (opt) => countItemInInventory(inventory, opt.itemId) >= opt.quantity,
  );
}

function appendIngredientCells(
  row: HTMLElement,
  inventory: Inventory,
  ing: CraftIngredient,
) {
  if (isCraftItemQty(ing)) {
    const def = getItemDefinition(ing.itemId);
    row.appendChild(
      makeDisplayCell({
        itemId: ing.itemId,
        qtyLabel: `×${ing.quantity}`,
        ariaLabel: `${def?.name ?? ing.itemId} ×${ing.quantity}`,
        missing: countItemInInventory(inventory, ing.itemId) < ing.quantity,
      }),
    );
    return;
  }

  ing.anyOf.forEach((opt, i) => {
    if (i > 0) {
      const sep = document.createElement("span");
      sep.className = "craft-ingredient-or";
      sep.textContent = "/";
      row.appendChild(sep);
    }
    const def = getItemDefinition(opt.itemId);
    row.appendChild(
      makeDisplayCell({
        itemId: opt.itemId,
        qtyLabel: `×${opt.quantity}`,
        ariaLabel: `${def?.name ?? opt.itemId} ×${opt.quantity}`,
        missing: countItemInInventory(inventory, opt.itemId) < opt.quantity,
      }),
    );
  });
}

export class CraftUI {
  private visible = false;
  private workbenchId = "";
  private inventory: Inventory = [];
  private extraPockets = 0;
  /** Recipe id currently expanded (null = all collapsed). */
  private expandedRecipeId: string | null = null;
  private learnedRecipeIds = new Set<string>();

  private station: CraftStationKind = "workbench";
  private overlay: HTMLElement;
  private layoutEl: HTMLElement;
  private listEl: HTMLElement;
  private titleEl: HTMLHeadingElement;
  private hintEl: HTMLElement;
  private ms: Sheet | null = null;
  private msOn = false;
  private filter: "all" | "ready" | "weapons" | "break" = "all";
  private pageId: string | null = null;
  private craftDurationScale = 1;
  private furnaceActiveUntil: number | null = null;
  private run: {
    recipeId: string;
    sentAt: number;
    sawServer: boolean;
    quietSince: number;
    result: CraftResult | null;
  } | null = null;
  private recraftId: string | null = null;
  private recraftSentAt = 0;
  private tickTimer = 0;

  constructor(private handlers: CraftUIHandlers) {
    this.overlay = document.createElement("div");
    this.overlay.id = "craft-overlay";
    this.overlay.hidden = true;

    const layout = document.createElement("div");
    layout.className = "craft-layout";
    this.layoutEl = layout;

    const panel = document.createElement("div");
    panel.className = "inventory-panel craft-panel";

    const header = document.createElement("div");
    header.className = "inventory-header";
    const headerTop = document.createElement("div");
    headerTop.className = "inventory-header-top";
    const title = document.createElement("h2");
    title.className = "inventory-title";
    title.textContent = "Workbench";
    this.titleEl = title;
    headerTop.append(
      title,
      createDialogCloseButton(() => this.handlers.onClose()),
    );
    const hint = document.createElement("span");
    hint.className = "inventory-hint";
    hint.textContent = "Craft materials, or break a firearm into parts";
    this.hintEl = hint;
    header.append(headerTop, hint);

    const body = document.createElement("div");
    body.className = "craft-body";
    this.listEl = document.createElement("div");
    this.listEl.className = "craft-recipe-list";
    body.appendChild(this.listEl);
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

  getWorkbenchId() {
    return this.workbenchId;
  }

  getStation(): CraftStationKind {
    return this.station;
  }

  /** Weapon recipes the player has learned. Hidden until this set includes them. */
  setLearnedRecipes(recipeIds: Iterable<string>) {
    this.learnedRecipeIds = new Set(recipeIds);
    if (this.visible) this.render();
  }

  open(opts: {
    workbenchId: string;
    inventoryJson: string;
    station?: CraftStationKind;
    extraPockets?: number;
    craftDurationScale?: number;
    furnaceActiveUntil?: number;
  }) {
    this.workbenchId = opts.workbenchId;
    this.station = opts.station === "furnace" ? "furnace" : "workbench";
    this.extraPockets = opts.extraPockets ?? 0;
    this.craftDurationScale = opts.craftDurationScale ?? 1;
    this.furnaceActiveUntil =
      this.station === "furnace" ? (opts.furnaceActiveUntil ?? 0) : null;
    this.inventory = parseInventory(opts.inventoryJson);
    this.expandedRecipeId = null;
    this.filter = "all";
    this.pageId = null;
    this.run = null;
    this.recraftId = null;
    this.titleEl.textContent =
      this.station === "furnace" ? "Furnace" : "Workbench";
    this.hintEl.textContent =
      this.station === "furnace"
        ? "The fire must stay lit. If it goes out, the craft stops."
        : "Craft materials, build a weapon you have learned, or break a firearm into parts";
    this.visible = true;
    this.overlay.hidden = false;
    document.body.classList.add("craft-open");
    this.applyPhoneMode();
    this.render();
    resetDialogScroll(this.overlay);
  }

  /** Phone sheet stays up for the whole craft. Desktop closes and uses the world bar. */
  staysOpenWhileCrafting(): boolean {
    return this.visible && this.msOn;
  }

  /** The bench session was opened again so this recipe can be crafted. */
  takeRecraft(workbenchId: string): string | null {
    if (!this.visible || !this.recraftId || workbenchId !== this.workbenchId) return null;
    const recipeId = this.recraftId;
    this.recraftId = null;
    return recipeId;
  }

  noteCraftSent(recipeId: string) {
    this.run = {
      recipeId,
      sentAt: Date.now(),
      sawServer: false,
      quietSince: 0,
      result: null,
    };
    this.pageId = recipeId;
    this.startTick();
    this.render();
  }

  applyResult(result: CraftResult) {
    if (!this.visible) return;
    if (!this.run) {
      this.run = {
        recipeId: this.pageId ?? "",
        sentAt: Date.now(),
        sawServer: true,
        quietSince: 0,
        result,
      };
    } else {
      this.run.result = result;
    }
    if (result.crafted) this.pageId = this.run.recipeId || this.pageId;
    const ruined = (result.ruined ?? []).map((part) => part.name).filter((name) => name.length > 0);
    if (ruined.length > 0 && this.ms) {
      showSheetMessage(this.ms.snackSlot, `Ruined: ${ruined.join(", ")}.`, "warn", 4200);
    }
    this.render();
  }

  private patchCraftProgress(): boolean {
    const sheet = this.ms;
    const run = this.run;
    if (!sheet || !run || run.result) return false;
    const remain = sheet.bar.querySelector(".ms-craft-prog-line span:last-child");
    const fill = sheet.bar.querySelector(".ms-meter > i");
    if (!remain || !(fill instanceof HTMLElement)) return false;
    const progress = this.handlers.getCraftProgress?.() ?? null;
    const duration = Math.max(1, progress?.durationMs ?? this.durationMsFor(run.recipeId));
    const elapsed = progress?.elapsedMs ?? Date.now() - run.sentAt;
    const pct = Math.max(0, Math.min(100, (elapsed / duration) * 100));
    const left = Math.max(0, Math.ceil((duration - elapsed) / 1000));
    remain.textContent = left === 1 ? "1 s left" : `${left} s left`;
    fill.style.width = `${pct}%`;
    return true;
  }

  sync(opts: { workbenchId: string; inventoryJson: string }) {
    if (!this.visible || opts.workbenchId !== this.workbenchId) return;
    this.inventory = parseInventory(opts.inventoryJson);
    this.render();
  }

  close() {
    this.stopTick();
    this.visible = false;
    this.overlay.hidden = true;
    document.body.classList.remove("craft-open");
    this.overlay.classList.remove("ms-host", "craft-ms");
    this.layoutEl.hidden = false;
    if (this.ms) this.ms.root.hidden = true;
    markSheetOpen("craft", false);
    if (this.ms) showSheetMessage(this.ms.snackSlot, "");
    this.workbenchId = "";
    this.station = "workbench";
    this.inventory = [];
    this.expandedRecipeId = null;
    this.pageId = null;
    this.run = null;
    this.recraftId = null;
    this.msOn = false;
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
    this.renderDesktop();
  }

  private renderDesktop() {
    this.listEl.replaceChildren();
    const stationRecipes = CRAFT_RECIPES.filter(
      (recipe) =>
        recipe.station === this.station &&
        craftRecipeIsVisible(recipe, this.learnedRecipeIds),
    );
    for (const recipe of stationRecipes) {
      if (recipe.breakdown) continue;
      this.listEl.appendChild(this.buildRecipeCard(recipe));
    }

    const breakdowns = stationRecipes.filter((recipe) => recipe.breakdown);
    if (breakdowns.length === 0 && this.station !== "workbench") return;

    const breakHead = document.createElement("div");
    breakHead.className = "red-dialog-task-heading craft-break-heading";
    breakHead.textContent = "Break down";
    this.listEl.appendChild(breakHead);
    for (const recipe of breakdowns) {
      this.listEl.appendChild(this.buildToolBreakdownCard(recipe));
    }
    if (this.station !== "workbench") return;
    for (const recipe of DISASSEMBLY_RECIPES) {
      this.listEl.appendChild(this.buildDisassemblyCard(recipe));
    }
  }

  private buildRecipeCard(recipe: CraftRecipe): HTMLElement {
    const expanded = this.expandedRecipeId === recipe.id;
    const can = canCraftRecipe(this.inventory, recipe, this.extraPockets);
    const allInputsOk = recipe.inputs.every((ing) =>
      ingredientSatisfied(this.inventory, ing),
    );
    const outDef = getItemDefinition(recipe.output.itemId);
    const name = outDef?.name ?? recipe.output.itemId;

    const section = document.createElement("div");
    section.className = "craft-recipe";
    if (expanded) section.classList.add("craft-recipe--expanded");
    if (can) section.classList.add("craft-recipe--ready");

    const summary = document.createElement("button");
    summary.type = "button";
    summary.className = "craft-recipe-summary";
    summary.setAttribute("aria-expanded", expanded ? "true" : "false");
    summary.setAttribute(
      "aria-label",
      `${expanded ? "Collapse" : "Expand"} ${name} recipe`,
    );

    summary.appendChild(
      makeDisplayCell({
        itemId: recipe.output.itemId,
        qtyLabel: `×${recipe.output.quantity}`,
        ariaLabel: `${name} ×${recipe.output.quantity}`,
      }),
    );

    const label = document.createElement("div");
    label.className = "craft-recipe-summary-text";
    const nameEl = document.createElement("span");
    nameEl.className = "craft-recipe-summary-name";
    nameEl.textContent = name;
    const meta = document.createElement("span");
    meta.className = "craft-recipe-summary-meta";
    meta.textContent = can
      ? "Ready to craft"
      : allInputsOk
        ? "Inventory full"
        : "Missing materials";
    label.append(nameEl, meta);
    summary.appendChild(label);

    const chevron = document.createElement("span");
    chevron.className = "craft-recipe-chevron";
    chevron.setAttribute("aria-hidden", "true");
    chevron.textContent = expanded ? "▾" : "▸";
    summary.appendChild(chevron);

    summary.addEventListener("click", () => {
      this.expandedRecipeId =
        this.expandedRecipeId === recipe.id ? null : recipe.id;
      this.render();
    });
    section.appendChild(summary);

    if (!expanded) return section;

    const details = document.createElement("div");
    details.className = "craft-recipe-details";

    const needTitle = document.createElement("div");
    needTitle.className = "red-dialog-task-heading";
    needTitle.textContent = "Requires";
    details.appendChild(needTitle);

    const needRow = document.createElement("div");
    needRow.className = "red-dialog-task-row";
    for (let i = 0; i < recipe.inputs.length; i++) {
      if (i > 0) {
        const sep = document.createElement("span");
        sep.className = "craft-ingredient-and";
        sep.textContent = "+";
        needRow.appendChild(sep);
      }
      appendIngredientCells(needRow, this.inventory, recipe.inputs[i]!);
    }
    details.appendChild(needRow);

    if (can) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "red-dialog-complete-btn";
      btn.textContent = "Craft";
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.handlers.onCraft(recipe.id);
      });
      details.appendChild(btn);
    } else if (!allInputsOk) {
      const hint = document.createElement("div");
      hint.className = "craft-recipe-hint";
      hint.textContent = "Missing materials";
      details.appendChild(hint);
    } else {
      const hint = document.createElement("div");
      hint.className = "craft-recipe-hint";
      hint.textContent = "Inventory full";
      details.appendChild(hint);
    }

    section.appendChild(details);
    return section;
  }

  private buildToolBreakdownCard(recipe: CraftRecipe): HTMLElement {
    const input = recipe.inputs[0];
    const toolId = input && isCraftItemQty(input) ? input.itemId : "";
    const expanded = this.expandedRecipeId === recipe.id;
    const hasTool = countItemInInventory(this.inventory, toolId) >= 1;
    const can = canCraftRecipe(this.inventory, recipe, this.extraPockets);
    const tool = getItemDefinition(toolId);
    const name = tool?.name ?? toolId;
    const outDef = getItemDefinition(recipe.output.itemId);
    const outName = outDef?.name ?? recipe.output.itemId;

    const section = document.createElement("div");
    section.className = "craft-recipe";
    if (expanded) section.classList.add("craft-recipe--expanded");
    if (can) section.classList.add("craft-recipe--ready");

    const summary = document.createElement("button");
    summary.type = "button";
    summary.className = "craft-recipe-summary";
    summary.setAttribute("aria-expanded", expanded ? "true" : "false");
    summary.setAttribute(
      "aria-label",
      `${expanded ? "Collapse" : "Expand"} break down ${name}`,
    );
    summary.appendChild(
      makeDisplayCell({
        itemId: toolId,
        qtyLabel: "×1",
        ariaLabel: name,
      }),
    );

    const label = document.createElement("div");
    label.className = "craft-recipe-summary-text";
    const nameEl = document.createElement("span");
    nameEl.className = "craft-recipe-summary-name";
    nameEl.textContent = `Break down ${name}`;
    const meta = document.createElement("span");
    meta.className = "craft-recipe-summary-meta";
    meta.textContent = can
      ? "Ready to break down"
      : hasTool
        ? "Inventory full"
        : "Missing materials";
    label.append(nameEl, meta);
    summary.appendChild(label);

    const chevron = document.createElement("span");
    chevron.className = "craft-recipe-chevron";
    chevron.setAttribute("aria-hidden", "true");
    chevron.textContent = expanded ? "▾" : "▸";
    summary.appendChild(chevron);
    summary.addEventListener("click", () => {
      this.expandedRecipeId =
        this.expandedRecipeId === recipe.id ? null : recipe.id;
      this.render();
    });
    section.appendChild(summary);
    if (!expanded) return section;

    const details = document.createElement("div");
    details.className = "craft-recipe-details";

    const returnTitle = document.createElement("div");
    returnTitle.className = "red-dialog-task-heading";
    returnTitle.textContent = "Returns";
    details.appendChild(returnTitle);

    const returnRow = document.createElement("div");
    returnRow.className = "red-dialog-task-row";
    returnRow.appendChild(
      makeDisplayCell({
        itemId: recipe.output.itemId,
        qtyLabel: `×${recipe.output.quantity}`,
        ariaLabel: `${outName} ×${recipe.output.quantity}`,
      }),
    );
    details.appendChild(returnRow);

    if (recipe.note) {
      const hint = document.createElement("div");
      hint.className = "craft-recipe-hint";
      hint.textContent = recipe.note;
      details.appendChild(hint);
    }

    if (can) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "red-dialog-complete-btn";
      btn.textContent = "Break down";
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.handlers.onCraft(recipe.id);
      });
      details.appendChild(btn);
    }

    section.appendChild(details);
    return section;
  }

  private buildDisassemblyCard(recipe: DisassemblyRecipe): HTMLElement {
    const expanded = this.expandedRecipeId === recipe.id;
    const hasWeapon =
      countItemInInventory(this.inventory, recipe.weaponId) >= 1;
    const fullYield = blueprintDisassemblyYield(recipe, this.learnedRecipeIds);
    const can = canDisassemble(
      this.inventory,
      recipe,
      [],
      this.extraPockets,
      this.learnedRecipeIds,
    );
    const weapon = getItemDefinition(recipe.weaponId);
    const name = weapon?.name ?? recipe.weaponId;

    const section = document.createElement("div");
    section.className = "craft-recipe";
    if (expanded) section.classList.add("craft-recipe--expanded");
    if (can) section.classList.add("craft-recipe--ready");

    const summary = document.createElement("button");
    summary.type = "button";
    summary.className = "craft-recipe-summary";
    summary.setAttribute("aria-expanded", expanded ? "true" : "false");
    summary.setAttribute(
      "aria-label",
      `${expanded ? "Collapse" : "Expand"} break down ${name}`,
    );
    summary.appendChild(
      makeDisplayCell({
        itemId: recipe.weaponId,
        qtyLabel: "×1",
        ariaLabel: name,
      }),
    );

    const label = document.createElement("div");
    label.className = "craft-recipe-summary-text";
    const nameEl = document.createElement("span");
    nameEl.className = "craft-recipe-summary-name";
    nameEl.textContent = `Break down ${name}`;
    const meta = document.createElement("span");
    meta.className = "craft-recipe-summary-meta";
    meta.textContent = can
      ? fullYield
        ? "Every part comes back"
        : "Ready to break down"
      : hasWeapon
        ? "Inventory full"
        : "Missing materials";
    label.append(nameEl, meta);
    summary.appendChild(label);

    const chevron = document.createElement("span");
    chevron.className = "craft-recipe-chevron";
    chevron.setAttribute("aria-hidden", "true");
    chevron.textContent = expanded ? "▾" : "▸";
    summary.appendChild(chevron);
    summary.addEventListener("click", () => {
      this.expandedRecipeId =
        this.expandedRecipeId === recipe.id ? null : recipe.id;
      this.render();
    });
    section.appendChild(summary);
    if (!expanded) return section;

    const details = document.createElement("div");
    details.className = "craft-recipe-details";
    if (fullYield) {
      const returnTitle = document.createElement("div");
      returnTitle.className = "red-dialog-task-heading";
      returnTitle.textContent = "Returns";
      details.appendChild(returnTitle);

      const returnRow = document.createElement("div");
      returnRow.className = "red-dialog-task-row";
      fullYield.forEach((part, i) => {
        if (i > 0) {
          const sep = document.createElement("span");
          sep.className = "craft-ingredient-and";
          sep.textContent = "+";
          returnRow.appendChild(sep);
        }
        const def = getItemDefinition(part.id);
        const partName = def?.name ?? part.id;
        returnRow.appendChild(
          makeDisplayCell({
            itemId: part.id,
            qtyLabel: `×${part.quantity}`,
            ariaLabel: `${partName} ×${part.quantity}`,
          }),
        );
      });
      details.appendChild(returnRow);
    }
    const hint = document.createElement("div");
    hint.className = "craft-recipe-hint";
    hint.textContent = fullYield
      ? "You know this blueprint, so every part comes back."
      : `Destroys the ${name}. Returns ${recipe.returnCount} of ${recipe.parts.length} parts at random.`;
    details.appendChild(hint);

    if (can) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "red-dialog-complete-btn";
      btn.textContent = "Break down";
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.handlers.onCraft(recipe.id);
      });
      details.appendChild(btn);
    } else if (hasWeapon) {
      const room = document.createElement("div");
      room.className = "craft-recipe-hint";
      room.textContent = "Inventory full";
      details.appendChild(room);
    }

    section.appendChild(details);
    return section;
  }

  private applyPhoneMode() {
    this.msOn = useMobileSheet();
    this.overlay.classList.toggle("ms-host", this.msOn);
    this.overlay.classList.toggle("craft-ms", this.msOn);
    this.layoutEl.hidden = this.msOn;
    if (this.msOn && !this.ms) {
      this.ms = createSheet({ onClose: () => this.handlers.onClose() });
      this.ms.root.classList.add("ms-craft");
      this.overlay.append(this.ms.root);
    }
    if (this.ms) this.ms.root.hidden = !this.msOn;
    markSheetOpen("craft", this.visible && this.msOn);
  }

  private startTick() {
    if (this.tickTimer) return;
    this.tickTimer = window.setInterval(() => this.tickCraft(), 200);
  }

  private stopTick() {
    if (!this.tickTimer) return;
    window.clearInterval(this.tickTimer);
    this.tickTimer = 0;
  }

  private tickCraft() {
    if (!this.visible || !this.msOn) {
      this.stopTick();
      return;
    }
    if (this.recraftId && Date.now() - this.recraftSentAt > 3000) {
      this.recraftId = null;
      if (this.ms) showSheetMessage(this.ms.snackSlot, "Couldn't start that again.", "warn");
      this.render();
      return;
    }
    const run = this.run;
    if (!run || run.result) {
      if (!this.recraftId) this.stopTick();
      return;
    }
    const progress = this.handlers.getCraftProgress?.() ?? null;
    if (progress?.confirmed) run.sawServer = true;
    if (progress) {
      run.quietSince = 0;
      if (!this.patchCraftProgress()) this.renderMobile();
      return;
    }
    const now = Date.now();
    if (!run.sawServer) {
      if (now - run.sentAt > 3000) {
        this.run = null;
        this.stopTick();
        this.handlers.onAbandon?.();
        if (this.ms) {
          const out = this.fireIsOut();
          showSheetMessage(
            this.ms.snackSlot,
            out ? "The fire is out." : "That didn't start.",
            "warn",
          );
        }
        this.render();
      }
      return;
    }
    if (!run.quietSince) run.quietSince = now;
    if (now - run.quietSince > 2500) {
      this.run = null;
      this.stopTick();
      if (this.ms) {
        showSheetMessage(this.ms.snackSlot, "Crafting stopped. Nothing was used.", "warn");
      }
      this.render();
    }
  }

  private fireIsOut(): boolean {
    if (this.station !== "furnace" || this.furnaceActiveUntil == null) return false;
    return !fireplaceIsActive(this.furnaceActiveUntil);
  }

  private stationName(): string {
    return this.station === "furnace" ? "Furnace" : "Workbench";
  }

  private itemName(itemId: string): string {
    return getItemDefinition(itemId)?.name ?? itemId;
  }

  private durationMsFor(id: string): number {
    const recipe = CRAFT_RECIPES.find((entry) => entry.id === id);
    const disasm = DISASSEMBLY_RECIPES.find((entry) => entry.id === id);
    const job = recipe ?? disasm;
    if (!job) return 10_000;
    return craftDurationForSkill(job, this.craftDurationScale);
  }

  private secondsLabel(ms: number): string {
    return `${Math.max(1, Math.round(ms / 1000))} s`;
  }

  private mobileEntries(): CraftEntry[] {
    const entries: CraftEntry[] = [];
    const stationRecipes = CRAFT_RECIPES.filter(
      (recipe) =>
        recipe.station === this.station &&
        craftRecipeIsVisible(recipe, this.learnedRecipeIds),
    );
    for (const recipe of stationRecipes) {
      if (recipe.breakdown) entries.push(this.toolEntry(recipe));
      else entries.push(this.craftEntry(recipe));
    }
    if (this.station === "workbench") {
      for (const recipe of DISASSEMBLY_RECIPES) entries.push(this.disasmEntry(recipe));
    }
    return entries;
  }

  private craftEntry(recipe: CraftRecipe): CraftEntry {
    const can = canCraftRecipe(this.inventory, recipe, this.extraPockets);
    const inputsOk = recipe.inputs.every((ing) => ingredientSatisfied(this.inventory, ing));
    const gaps = recipe.inputs.filter((ing) => !ingredientSatisfied(this.inventory, ing));
    const weapon = !!recipe.blueprintItemId || isWeaponItem(recipe.output.itemId);
    let status = this.inputSummary(recipe, weapon);
    let warn = false;
    if (!can && inputsOk) {
      status = "No room in your bag";
      warn = true;
    } else if (!can) {
      status = gaps.length === 1 ? this.oneGap(gaps[0]!) : this.manyGaps(gaps.length, recipe.inputs.length, weapon);
      warn = true;
    }
    const qty = recipe.output.quantity;
    const base = this.itemName(recipe.output.itemId);
    return {
      id: recipe.id,
      kind: "craft",
      iconId: recipe.output.itemId,
      qty,
      name: qty > 1 ? `${base} ×${qty}` : base,
      baseName: base,
      ready: can,
      owned: true,
      weapon,
      breakDown: false,
      status,
      warn,
      durationMs: this.durationMsFor(recipe.id),
    };
  }

  private toolEntry(recipe: CraftRecipe): CraftEntry {
    const input = recipe.inputs[0];
    const toolId = input && isCraftItemQty(input) ? input.itemId : "";
    const owned = countItemInInventory(this.inventory, toolId) >= 1;
    const can = canCraftRecipe(this.inventory, recipe, this.extraPockets);
    const tool = this.itemName(toolId);
    const out = this.itemName(recipe.output.itemId);
    let status = recipe.note || `Returns ${recipe.output.quantity} ${out}`;
    let warn = false;
    if (!owned) {
      status = "You don't have one";
      warn = true;
    } else if (!can) {
      status = "No room in your bag";
      warn = true;
    }
    return {
      id: recipe.id,
      kind: "tool",
      iconId: toolId,
      name: `Break down ${tool}`,
      baseName: tool,
      ready: can,
      owned,
      weapon: false,
      breakDown: true,
      status,
      warn,
      durationMs: this.durationMsFor(recipe.id),
    };
  }

  private disasmEntry(recipe: DisassemblyRecipe): CraftEntry {
    const owned = countItemInInventory(this.inventory, recipe.weaponId) >= 1;
    const full = blueprintDisassemblyYield(recipe, this.learnedRecipeIds);
    const can = canDisassemble(this.inventory, recipe, [], this.extraPockets, this.learnedRecipeIds);
    const name = this.itemName(recipe.weaponId);
    let status = full
      ? "Every part comes back"
      : `Returns ${recipe.returnCount} of ${recipe.parts.length} parts at random`;
    let warn = false;
    if (!owned) {
      status = "You don't have one";
      warn = true;
    } else if (!can) {
      status = "No room in your bag";
      warn = true;
    }
    return {
      id: recipe.id,
      kind: "disasm",
      iconId: recipe.weaponId,
      name: `Break down ${name}`,
      baseName: name,
      ready: can,
      owned,
      weapon: true,
      breakDown: true,
      status,
      warn,
      durationMs: this.durationMsFor(recipe.id),
    };
  }

  private inputSummary(recipe: CraftRecipe, weapon: boolean): string {
    if (recipe.inputs.length >= 4) {
      return weapon ? `${recipe.inputs.length} parts` : `${recipe.inputs.length} materials`;
    }
    return recipe.inputs
      .map((ing) => {
        if (isCraftItemQty(ing)) return `${ing.quantity} ${this.itemName(ing.itemId)}`;
        const held = ing.anyOf.find(
          (opt) => countItemInInventory(this.inventory, opt.itemId) >= opt.quantity,
        );
        const opt = held ?? ing.anyOf[0];
        return opt ? `${opt.quantity} ${this.itemName(opt.itemId)}` : "";
      })
      .filter((part) => part.length > 0)
      .join(", ");
  }

  private oneGap(ing: CraftIngredient): string {
    if (isCraftItemQty(ing)) {
      const have = countItemInInventory(this.inventory, ing.itemId);
      const missing = Math.max(1, ing.quantity - have);
      const name = this.itemName(ing.itemId);
      return have > 0 ? `Need ${missing} more ${name}` : `Need ${missing} ${name}`;
    }
    const names = ing.anyOf.map((opt) => this.itemName(opt.itemId));
    return `Need any of ${names.join(" or ")}`;
  }

  private manyGaps(missing: number, total: number, weapon: boolean): string {
    const noun = weapon ? "parts" : "materials";
    return `Missing ${missing} of ${total} ${noun}`;
  }

  private renderMobile() {
    const sheet = this.ms;
    if (!sheet) return;
    const entries = this.mobileEntries();
    const page = entries.find((entry) => entry.id === this.pageId) ?? null;
    const readyCount = entries.filter((entry) => entry.ready).length;
    const running = !!this.run && !this.run.result;
    const done = this.run?.result ?? null;
    if (page) {
      sheet.header.setBack(() => {
        this.pageId = null;
        if (this.run?.result) this.run = null;
        this.render();
      });
      sheet.header.setTitle(page.baseName);
      sheet.header.setSub(`${this.stationName()} · takes ${this.secondsLabel(page.durationMs)}`);
    } else {
      sheet.header.setBack(null);
      sheet.header.setTitle(this.stationName());
      sheet.header.setSub(
        `${entries.length} ${entries.length === 1 ? "recipe" : "recipes"} · ${readyCount} ready`,
      );
    }
    const scroll = sheet.body.scrollTop;
    const body: HTMLElement[] = [];
    if (this.station === "furnace") body.push(this.fireBanner());
    if (page) body.push(...this.detailNodes(page, running));
    else body.push(...this.listNodes(entries));
    if (done) body.push(this.doneLine(done, page));
    sheet.body.replaceChildren(...body);
    sheet.body.scrollTop = scroll;
    this.renderCraftBar(sheet, page, entries, running, done);
  }

  private fireBanner(): HTMLElement {
    const lit = this.furnaceActiveUntil != null && fireplaceIsActive(this.furnaceActiveUntil);
    const banner = document.createElement("div");
    banner.className = lit ? "ms-craft-banner" : "ms-craft-banner ms-craft-banner--out";
    const title = document.createElement("b");
    title.textContent = lit ? "Fire is lit" : "Fire is out";
    banner.append(title);
    if (lit && this.furnaceActiveUntil != null) {
      const left = Math.max(0, this.furnaceActiveUntil - Date.now());
      const mins = Math.max(1, Math.ceil(left / 60000));
      banner.append(document.createTextNode(` · about ${mins} min left`));
    } else if (!lit) {
      banner.append(document.createTextNode(" · light it before you craft"));
    }
    return banner;
  }

  private listNodes(entries: CraftEntry[]): HTMLElement[] {
    const nodes: HTMLElement[] = [];
    const hasWeapons = entries.some((entry) => entry.weapon && !entry.breakDown);
    const hasBreak = entries.some((entry) => entry.breakDown);
    const readyCount = entries.filter((entry) => entry.ready).length;
    const chips: { id: string; label: string; count?: number }[] = [
      { id: "all", label: "All" },
      { id: "ready", label: "Ready", count: readyCount },
    ];
    if (hasWeapons) chips.push({ id: "weapons", label: "Weapons" });
    if (hasBreak) chips.push({ id: "break", label: "Break down" });
    if (!chips.some((chip) => chip.id === this.filter)) this.filter = "all";
    nodes.push(
      filterChips(chips, this.filter, (id) => {
        this.filter = id as CraftEntryFilter;
        this.render();
      }),
    );
    let shown = entries.filter((entry) => this.entryMatchesFilter(entry));
    shown = [
      ...shown.filter((entry) => entry.ready),
      ...shown.filter((entry) => !entry.ready),
    ];
    if (shown.length === 0) {
      const empty = document.createElement("div");
      empty.className = "ms-hint ms-craft-empty";
      empty.textContent =
        this.filter === "ready" ? "Nothing is ready." : "Nothing in this list.";
      nodes.push(empty);
      return nodes;
    }
    let breakLabelled = false;
    for (const entry of shown) {
      if (this.filter === "all" && entry.breakDown && !breakLabelled) {
        nodes.push(sectionLabel("Break down"));
        breakLabelled = true;
      }
      nodes.push(this.entryRow(entry));
    }
    return nodes;
  }

  private entryMatchesFilter(entry: CraftEntry): boolean {
    if (this.filter === "ready") return entry.ready;
    if (this.filter === "weapons") return entry.weapon && !entry.breakDown;
    if (this.filter === "break") return entry.breakDown;
    return true;
  }

  private entryRow(entry: CraftEntry): HTMLElement {
    const meta: (string | Node)[] = [];
    if (entry.ready && !entry.warn) meta.push(this.readyChip(), entry.status);
    else meta.push(entry.status);
    return sheetRow({
      iconItemId: entry.iconId,
      qty: entry.qty,
      name: entry.name,
      meta,
      metaTone: entry.warn ? "warn" : undefined,
      chevron: true,
      state: entry.owned ? undefined : "dim",
      ariaLabel: entry.name,
      onTap: () => {
        this.pageId = entry.id;
        this.render();
      },
    });
  }

  private readyChip(): HTMLElement {
    const node = document.createElement("span");
    node.className = "ms-chip ms-chip--lime";
    node.textContent = "Ready";
    return node;
  }

  private detailNodes(entry: CraftEntry, running: boolean): HTMLElement[] {
    const nodes: HTMLElement[] = [];
    nodes.push(this.hero(entry, running));
    if (entry.kind === "craft") {
      const recipe = CRAFT_RECIPES.find((item) => item.id === entry.id);
      if (recipe) nodes.push(...this.craftDetail(recipe, entry, running));
    } else if (entry.kind === "tool") {
      const recipe = CRAFT_RECIPES.find((item) => item.id === entry.id);
      if (recipe) nodes.push(...this.toolDetail(recipe, running));
    } else {
      const recipe = DISASSEMBLY_RECIPES.find((item) => item.id === entry.id);
      if (recipe) nodes.push(...this.disasmDetail(recipe, running));
    }
    return nodes;
  }

  private hero(entry: CraftEntry, running: boolean): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "ms-craft-hero";
    const cell = document.createElement("div");
    cell.className = running ? "ms-craft-hero-cell ms-craft-hero-cell--busy" : "ms-craft-hero-cell";
    const img = itemIconImg(entry.iconId);
    if (img) cell.append(img);
    if (entry.qty && entry.qty > 1) {
      const q = document.createElement("span");
      q.className = "ms-craft-hero-q";
      q.textContent = `×${entry.qty}`;
      cell.append(q);
    }
    wrap.append(cell);
    return wrap;
  }

  private craftDetail(recipe: CraftRecipe, entry: CraftEntry, running: boolean): HTMLElement[] {
    const note = entry.ready ? "all in your bag" : undefined;
    const nodes = [sectionLabel("Uses", note)];
    for (const ing of recipe.inputs) nodes.push(this.ingredientRow(ing, running));
    return nodes;
  }

  private toolDetail(recipe: CraftRecipe, running: boolean): HTMLElement[] {
    const nodes = [sectionLabel("Uses")];
    const input = recipe.inputs[0];
    if (input) nodes.push(this.ingredientRow(input, running));
    nodes.push(sectionLabel("You get"));
    nodes.push(
      sheetRow({
        iconItemId: recipe.output.itemId,
        name: this.itemName(recipe.output.itemId),
        end: `×${recipe.output.quantity}`,
        state: running ? "dim" : undefined,
      }),
    );
    if (recipe.note) {
      const hint = document.createElement("div");
      hint.className = "ms-hint ms-craft-hint";
      hint.textContent = recipe.note;
      nodes.push(hint);
    }
    return nodes;
  }

  private disasmDetail(recipe: DisassemblyRecipe, running: boolean): HTMLElement[] {
    const full = blueprintDisassemblyYield(recipe, this.learnedRecipeIds);
    const nodes = [sectionLabel("Uses")];
    const have = countItemInInventory(this.inventory, recipe.weaponId);
    nodes.push(
      sheetRow({
        iconItemId: recipe.weaponId,
        name: this.itemName(recipe.weaponId),
        end: running ? "1" : this.haveNeedEnd(have, 1),
        state: running ? "dim" : undefined,
      }),
    );
    nodes.push(sectionLabel(full ? "You get" : "Maybe"));
    if (full) {
      for (const part of full) {
        nodes.push(
          sheetRow({
            iconItemId: part.id,
            name: this.itemName(part.id),
            end: `×${part.quantity}`,
            state: running ? "dim" : undefined,
          }),
        );
      }
    } else {
      for (const partId of recipe.parts) {
        nodes.push(
          sheetRow({
            iconItemId: partId,
            name: this.itemName(partId),
            end: "Maybe",
            state: "dim",
          }),
        );
      }
      const hint = document.createElement("div");
      hint.className = "ms-hint ms-craft-hint";
      hint.textContent = `Destroys the ${this.itemName(recipe.weaponId)}. ${recipe.parts.length - recipe.returnCount} parts are lost.`;
      nodes.push(hint);
    }
    return nodes;
  }

  private ingredientRow(ing: CraftIngredient, running: boolean): HTMLElement {
    if (isCraftItemQty(ing)) {
      const have = countItemInInventory(this.inventory, ing.itemId);
      return sheetRow({
        iconItemId: ing.itemId,
        name: this.itemName(ing.itemId),
        end: running ? String(ing.quantity) : this.haveNeedEnd(have, ing.quantity),
        state: running ? "dim" : undefined,
      });
    }
    const held = ing.anyOf.find(
      (opt) => countItemInInventory(this.inventory, opt.itemId) >= opt.quantity,
    );
    const names = ing.anyOf.map((opt) => this.itemName(opt.itemId)).join(" / ");
    const shown = held ?? ing.anyOf[0];
    const have = shown ? countItemInInventory(this.inventory, shown.itemId) : 0;
    const need = shown?.quantity ?? 1;
    return sheetRow({
      iconItemId: shown?.itemId,
      name: `Any of ${names}`,
      end: running ? String(need) : this.haveNeedEnd(have, need),
      state: running ? "dim" : undefined,
    });
  }

  private haveNeedEnd(have: number, need: number): HTMLElement {
    const end = document.createElement("span");
    end.textContent = `${have} / ${need}`;
    if (have >= need) {
      end.className = "ms-ok";
      end.append(document.createTextNode(" ✓"));
    }
    return end;
  }

  private doneLine(result: CraftResult, page: CraftEntry | null): HTMLElement {
    const line = document.createElement("div");
    line.className = "ms-craft-done";
    if (result.crafted) {
      const qty = result.crafted.quantity;
      line.textContent =
        qty > 1 ? `Made ${qty} ${result.crafted.name}` : `Made ${result.crafted.name}`;
    } else if (result.salvaged && result.salvaged.length > 0) {
      const ruined = (result.ruined ?? []).map((part) => part.name).filter((name) => name.length > 0);
      line.textContent = ruined.length
        ? `Salvaged ${result.salvaged.length} ${result.salvaged.length === 1 ? "part" : "parts"}`
        : "You recovered every part.";
    } else {
      line.textContent = page?.breakDown ? "Broken down" : "Done";
    }
    return line;
  }

  private renderCraftBar(
    sheet: Sheet,
    page: CraftEntry | null,
    entries: CraftEntry[],
    running: boolean,
    done: CraftResult | null,
  ) {
    sheet.bar.replaceChildren();
    if (running && this.run) {
      const progress = this.handlers.getCraftProgress?.() ?? null;
      const duration = Math.max(1, progress?.durationMs ?? page?.durationMs ?? 10_000);
      const elapsed = progress?.elapsedMs ?? Date.now() - this.run.sentAt;
      const pct = Math.max(0, Math.min(100, (elapsed / duration) * 100));
      const left = Math.max(0, Math.ceil((duration - elapsed) / 1000));
      const prog = document.createElement("div");
      prog.className = "ms-craft-prog";
      const line = document.createElement("div");
      line.className = "ms-craft-prog-line";
      const label = document.createElement("span");
      label.textContent = "Crafting…";
      const remain = document.createElement("span");
      remain.textContent = left === 1 ? "1 s left" : `${left} s left`;
      line.append(label, remain);
      prog.append(line, meter(pct, "#5ec85e"));
      const stop = sheetButton("Stop crafting", "sec", () => this.stopCraft());
      sheet.bar.append(prog, stop);
      sheet.syncBar();
      return;
    }
    if (done && page) {
      const again = entries.find((entry) => entry.id === page.id);
      const againLabel = page.breakDown ? "Break down another" : "Craft another";
      const againBtn = sheetButton(againLabel, "pri", () => this.craftAgain(page.id));
      againBtn.disabled = !again?.ready || this.fireIsOut() || !!this.recraftId;
      sheet.bar.append(againBtn);
      const madeId = done.crafted?.id;
      if (madeId && isWeaponItem(madeId)) {
        sheet.bar.append(sheetButton("Equip", "sec", () => this.handlers.onEquip?.(madeId)));
      }
      sheet.syncBar();
      return;
    }
    if (!page) {
      sheet.syncBar();
      return;
    }
    const blocked = !page.ready || this.fireIsOut() || !!this.recraftId;
    const label = page.breakDown ? "Break down" : `Craft ${page.baseName}`;
    const sub = this.fireIsOut()
      ? "The fire is out"
      : !page.ready
        ? page.status
        : this.secondsLabel(page.durationMs);
    const craft = sheetButton(label, "pri", () => this.handlers.onCraft(page.id), { sub });
    craft.disabled = blocked;
    sheet.bar.append(craft);
    sheet.syncBar();
  }

  private stopCraft() {
    this.handlers.onStop?.();
    this.run = null;
    this.stopTick();
    if (this.ms) showSheetMessage(this.ms.snackSlot, "Crafting stopped. Nothing was used.", "warn");
    this.render();
  }

  private craftAgain(recipeId: string) {
    if (!this.handlers.onReopen) {
      this.handlers.onCraft(recipeId);
      return;
    }
    this.recraftId = recipeId;
    this.recraftSentAt = Date.now();
    this.run = null;
    this.startTick();
    this.handlers.onReopen();
    this.render();
  }
}

type CraftEntryFilter = "all" | "ready" | "weapons" | "break";

type CraftEntry = {
  id: string;
  kind: "craft" | "tool" | "disasm";
  iconId: string;
  qty?: number;
  name: string;
  baseName: string;
  ready: boolean;
  owned: boolean;
  weapon: boolean;
  breakDown: boolean;
  status: string;
  warn: boolean;
  durationMs: number;
};
