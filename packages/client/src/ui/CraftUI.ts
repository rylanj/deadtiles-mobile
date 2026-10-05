import {
  CRAFT_RECIPES,
  DISASSEMBLY_RECIPES,
  blueprintDisassemblyYield,
  canCraftRecipe,
  canDisassemble,
  craftRecipeIsVisible,
  countItemInInventory,
  getItemDefinition,
  isCraftItemQty,
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

export type CraftUIHandlers = {
  onClose: () => void;
  onCraft: (recipeId: string) => void;
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
  private listEl: HTMLElement;
  private titleEl: HTMLHeadingElement;
  private hintEl: HTMLElement;

  constructor(private handlers: CraftUIHandlers) {
    this.overlay = document.createElement("div");
    this.overlay.id = "craft-overlay";
    this.overlay.hidden = true;

    const layout = document.createElement("div");
    layout.className = "craft-layout";

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
      if (e.target === this.overlay) this.handlers.onClose();
    });

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
  }) {
    this.workbenchId = opts.workbenchId;
    this.station = opts.station === "furnace" ? "furnace" : "workbench";
    this.extraPockets = opts.extraPockets ?? 0;
    this.inventory = parseInventory(opts.inventoryJson);
    this.expandedRecipeId = null;
    this.titleEl.textContent =
      this.station === "furnace" ? "Furnace" : "Workbench";
    this.hintEl.textContent =
      this.station === "furnace"
        ? "The fire must stay lit. If it goes out, the craft stops."
        : "Craft materials, build a weapon you have learned, or break a firearm into parts";
    this.visible = true;
    this.overlay.hidden = false;
    document.body.classList.add("craft-open");
    this.render();
    resetDialogScroll(this.overlay);
  }

  sync(opts: { workbenchId: string; inventoryJson: string }) {
    if (!this.visible || opts.workbenchId !== this.workbenchId) return;
    this.inventory = parseInventory(opts.inventoryJson);
    this.render();
  }

  close() {
    this.visible = false;
    this.overlay.hidden = true;
    document.body.classList.remove("craft-open");
    this.workbenchId = "";
    this.station = "workbench";
    this.inventory = [];
    this.expandedRecipeId = null;
  }

  private render() {
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
}
