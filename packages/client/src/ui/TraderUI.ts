import {
  ASHEN_REP_START,
  ASHEN_TRADERS_FACTION,
  ASHEN_REP_PER_DOLLAR_GIVEN,
  ASHEN_REP_PER_DOLLAR_TAKEN,
  ashenStanding,
  ashenStandingLabel,
  backpackHoldsItems,
  getItemDefinition,
  isArmorSlot,
  isBackpackItem,
  isBackpackSlot,
  isClothingItem,
  isClothingSlot,
  isJewelrySlot,
  isMapSlot,
  isQuestKeepsakeItem,
  isRadioSlot,
  isWatchSlot,
  wornGearEffectHint,
  isWeaponItem,
  isWeaponSlot,
  parseInventory,
  tradeOfferTotals,
  tradeOfferCashSettlement,
  tradeOfferStockFitProblem,
  traderItemMinStanding,
  traderPurchaseLock,
  TRADER_SHOP_CAPACITY,
  traderBuyPrice,
  traderSellPrice,
  type Inventory,
  type InventoryEntry,
  type TradeOfferBuyLine,
  type TradeOfferSellLine,
} from "@zombie/shared";
import { appendItemIcon, markQuestKeepsake } from "./itemIcons";
import { createDialogCloseButton } from "./dialogCloseBtn";
import { resetDialogScroll } from "./dialogScroll";
import { playerAvatarSrc } from "./playerAvatar";
import { claimPageOverlay } from "./pageOverlay";
import { bindPhoneDialogResize, usePhoneDialogSheet } from "./phoneDialog";
import {
  chip,
  createSheet,
  createStepper,
  drawerHead,
  kvCard,
  markSheetOpen,
  money,
  openDrawer,
  quickAmounts,
  renderTabs,
  sectionLabel,
  setButtonLabel,
  sheetButton,
  sheetRow,
  showSheetMessage,
  type Drawer,
  type KvRow,
  type Sheet,
  type Stepper,
} from "./mobileSheet";
import "./mobile/trader.css";

export type TraderUIHandlers = {
  onConfirm: (
    sells: TradeOfferSellLine[],
    buys: TradeOfferBuyLine[],
  ) => void;
  onClose: () => void;
};

const TRADER_AVATAR = "/assets/UI/TraderMan1/TraderMan1_Avatar.png";
/** Second click on the same stack within this window adds 1 to the offer. */
const OFFER_DOUBLE_CLICK_MS = 500;

function formatNotes(amount: number): string {
  return `$${amount}`;
}

function formatRep(value: number): string {
  return Number.isInteger(value) || Math.abs(value - Math.round(value)) < 1e-9
    ? String(Math.round(value))
    : value.toFixed(1);
}

function makeAmountPill(
  amount: number,
  className = "trader-notes-pill",
): HTMLElement {
  const el = document.createElement("div");
  el.className = className;
  el.textContent = formatNotes(amount);
  return el;
}

const CATEGORY_COLORS: Record<string, string> = {
  weapons: "#8b4558",
  equipment: "#5a6a4a",
  ammunition: "#6b7a3a",
  medical: "#3a7070",
  crafting: "#6a6040",
  junk: "#5a5a4a",
  magazine: "#4d5d73",
  food: "#8a6840",
  drink: "#406080",
};

type Selection =
  | { side: "player"; slotIndex: number; id: string; quantity: number }
  | { side: "trader"; stockIndex: number; id: string; quantity: number };

export class TraderUI {
  private visible = false;
  private traderId = "";
  private traderName = "Trader";
  private playerBanknotes = 0;
  private traderBanknotes = 0;
  private ashenReputation = ASHEN_REP_START;
  private barterT = 0;
  private playerInventory: Inventory = [];
  private stock: InventoryEntry[] = [];
  private stockCapacity = TRADER_SHOP_CAPACITY;
  private selection: Selection | null = null;
  /** Last stack click, so a rebuilt cell can still count as a double-click. */
  private lastOfferClick: { key: string; at: number } | null = null;
  /** Pending sell offers keyed by inventory slot. */
  private sellOffers = new Map<number, TradeOfferSellLine>();
  /** Pending buy offers keyed by stock index. */
  private buyOffers = new Map<number, TradeOfferBuyLine>();
  /** True after Confirm until the next tradeSync (prevents double-submit). */
  private confirmPending = false;
  private layoutEl!: HTMLElement;
  private phoneOn = false;
  private unbindPhoneResize: () => void = () => {};
  private sheet!: Sheet;
  private sheetPill!: HTMLElement;
  private sheetAvatar!: HTMLImageElement;
  private sheetSearch!: HTMLInputElement;
  private sheetList!: HTMLElement;
  private sheetTab: "buy" | "sell" = "buy";
  private sheetView: "shop" | "review" | "done" = "shop";
  private sheetQuery = "";
  private drawer: Drawer | null = null;
  private drawerStepper: Stepper | null = null;
  /** Lines sent with the last Confirm, for the success state. */
  private confirmedDeal: {
    sells: TradeOfferSellLine[];
    buys: TradeOfferBuyLine[];
    net: number;
    paid: number;
    received: number;
    repGain: number;
  } | null = null;

  private overlay: HTMLElement;
  private playerAvatarEl: HTMLImageElement;
  private playerNotesEl: HTMLElement;
  private traderNotesEl: HTMLElement;
  private standingPillEl: HTMLElement;
  private playerTitleEl: HTMLElement;
  private playerGridEl: HTMLElement;
  private traderGridEl: HTMLElement;
  private traderTitleEl: HTMLElement;
  private detailEl: HTMLElement;
  private settlementEl: HTMLElement;
  private footerEl: HTMLElement;
  private sellBtn: HTMLButtonElement;
  private sell5Btn: HTMLButtonElement;
  private sell10Btn: HTMLButtonElement;
  private sellAllBtn: HTMLButtonElement;
  private buyBtn: HTMLButtonElement;
  private buy5Btn: HTMLButtonElement;
  private buy10Btn: HTMLButtonElement;
  private confirmBtn: HTMLButtonElement;
  private clearOfferBtn: HTMLButtonElement;

  constructor(private handlers: TraderUIHandlers) {
    this.overlay = document.createElement("div");
    this.overlay.id = "trader-overlay";
    this.overlay.hidden = true;

    const layout = document.createElement("div");
    layout.className = "trader-layout";
    this.layoutEl = layout;

    const toolbar = document.createElement("div");
    toolbar.className = "trader-toolbar";
    toolbar.append(createDialogCloseButton(() => this.handlers.onClose()));

    const columns = document.createElement("div");
    columns.className = "trader-columns";

    // Player panel
    const playerPanel = document.createElement("div");
    playerPanel.className = "inventory-panel trader-panel";
    const playerHeader = document.createElement("div");
    playerHeader.className = "inventory-header trader-panel-header";
    this.playerAvatarEl = document.createElement("img");
    this.playerAvatarEl.className = "trader-avatar";
    this.playerAvatarEl.src = playerAvatarSrc();
    this.playerAvatarEl.alt = "You";
    const playerTitleWrap = document.createElement("div");
    playerTitleWrap.className = "trader-panel-header-text";
    this.playerTitleEl = document.createElement("h2");
    this.playerTitleEl.className = "inventory-title";
    this.playerTitleEl.textContent = "You";
    const playerHint = document.createElement("span");
    playerHint.className = "inventory-hint";
    playerHint.textContent = "+ or − changes the offer";
    playerTitleWrap.append(this.playerTitleEl, playerHint);
    const playerNotes = makeAmountPill(0);
    this.playerNotesEl = playerNotes;
    playerHeader.append(this.playerAvatarEl, playerTitleWrap, playerNotes);
    const playerBody = document.createElement("div");
    playerBody.className = "inventory-grid-wrap trader-grid-wrap";
    this.playerGridEl = document.createElement("div");
    this.playerGridEl.className = "inventory-grid trader-grid";
    playerBody.appendChild(this.playerGridEl);
    playerPanel.append(playerHeader, playerBody);

    // Trader panel
    const traderPanel = document.createElement("div");
    traderPanel.className = "inventory-panel trader-panel";
    const traderHeader = document.createElement("div");
    traderHeader.className = "inventory-header trader-panel-header";
    const traderAvatar = document.createElement("img");
    traderAvatar.className = "trader-avatar";
    traderAvatar.src = TRADER_AVATAR;
    traderAvatar.alt = "Trader";
    const traderTitleWrap = document.createElement("div");
    traderTitleWrap.className = "trader-panel-header-text";
    const traderTitleRow = document.createElement("div");
    traderTitleRow.className = "trader-title-row";
    this.traderTitleEl = document.createElement("h2");
    this.traderTitleEl.className = "inventory-title";
    this.traderTitleEl.textContent = ASHEN_TRADERS_FACTION;
    this.standingPillEl = document.createElement("div");
    this.standingPillEl.className =
      "trader-standing-pill trader-standing-pill--wary";
    this.standingPillEl.textContent = "Neutral";
    traderTitleRow.append(this.traderTitleEl, this.standingPillEl);
    const traderHint = document.createElement("span");
    traderHint.className = "inventory-hint";
    traderHint.textContent = "+ or − changes the offer";
    traderTitleWrap.append(traderTitleRow, traderHint);
    const traderNotes = makeAmountPill(0);
    this.traderNotesEl = traderNotes;
    traderHeader.append(traderAvatar, traderTitleWrap, traderNotes);
    const traderBody = document.createElement("div");
    traderBody.className = "inventory-grid-wrap trader-grid-wrap";
    this.traderGridEl = document.createElement("div");
    this.traderGridEl.className = "inventory-grid trader-grid";
    traderBody.appendChild(this.traderGridEl);
    traderPanel.append(traderHeader, traderBody);

    columns.append(playerPanel, traderPanel);

    this.footerEl = document.createElement("div");
    this.footerEl.className = "inventory-footer trader-footer";
    this.detailEl = document.createElement("div");
    this.detailEl.className = "inventory-detail";
    const actions = document.createElement("div");
    actions.className = "inventory-actions";
    this.sellBtn = this.makeActionBtn("Sell", () => this.addToOffer(1));
    this.sell5Btn = this.makeActionBtn("Sell 5", () => this.addToOffer(5));
    this.sell10Btn = this.makeActionBtn("Sell 10", () => this.addToOffer(10));
    this.sellAllBtn = this.makeActionBtn("Sell All", () => this.addToOffer(this.selection?.quantity ?? 0));
    this.buyBtn = this.makeActionBtn("Buy", () => this.addToOffer(1));
    this.buy5Btn = this.makeActionBtn("Buy 5", () => this.addToOffer(5));
    this.buy10Btn = this.makeActionBtn("Buy 10", () => this.addToOffer(10));
    actions.append(
      this.sellBtn,
      this.sell5Btn,
      this.sell10Btn,
      this.sellAllBtn,
      this.buyBtn,
      this.buy5Btn,
      this.buy10Btn,
    );

    this.settlementEl = document.createElement("div");
    this.settlementEl.className = "trader-settlement";
    this.settlementEl.hidden = true;

    const offerActions = document.createElement("div");
    offerActions.className = "trader-offer-actions";
    this.clearOfferBtn = this.makeActionBtn("Clear Offer", () =>
      this.resetOffer(),
    );
    this.clearOfferBtn.classList.add("trader-clear-offer-btn");
    this.clearOfferBtn.hidden = true;
    this.confirmBtn = this.makeActionBtn("Confirm", () => this.confirmOffer());
    this.confirmBtn.classList.add("trader-confirm-btn");
    this.confirmBtn.hidden = true;
    offerActions.append(this.clearOfferBtn, this.confirmBtn);

    this.footerEl.append(
      this.detailEl,
      actions,
      this.settlementEl,
      offerActions,
    );

    layout.append(toolbar, columns, this.footerEl);
    this.buildSheet();
    this.overlay.append(layout, this.sheet.root);

    this.overlay.addEventListener("click", (e) => {
      if (usePhoneDialogSheet()) return;
      if (e.target === this.overlay) this.handlers.onClose();
    });

    this.unbindPhoneResize = bindPhoneDialogResize(
      () => this.visible,
      () => this.overlay.classList.contains("ms-host"),
      () => this.render(),
      this.overlay,
    );

    claimPageOverlay(this.overlay.id);
    document.body.appendChild(this.overlay);
    this.updateActionButtons();
  }

  private makeActionBtn(label: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "inventory-action-btn";
    btn.textContent = label;
    btn.addEventListener("click", onClick);
    return btn;
  }

  isOpen() {
    return this.visible;
  }

  getTraderId() {
    return this.traderId;
  }

  open(opts: {
    traderId: string;
    traderName: string;
    playerName?: string;
    traderBanknotes: number;
    playerBanknotes: number;
    stockJson: string;
    stockCapacity?: number;
    inventoryJson: string;
    ashenReputation?: number;
    clothingSkin?: number;
    barterT?: number;
  }) {
    this.traderId = opts.traderId;
    this.traderName = opts.traderName || ASHEN_TRADERS_FACTION;
    this.traderTitleEl.textContent = ASHEN_TRADERS_FACTION;
    this.playerTitleEl.textContent = opts.playerName?.trim() || "You";
    this.playerAvatarEl.src = playerAvatarSrc(opts.clothingSkin);
    this.clearOffer();
    this.applySync(opts);
    this.selection = null;
    this.lastOfferClick = null;
    this.confirmPending = false;
    this.sheetTab = "buy";
    this.sheetView = "shop";
    this.sheetQuery = "";
    this.sheetSearch.value = "";
    this.confirmedDeal = null;
    this.closeDrawer();
    showSheetMessage(this.sheet.snackSlot, "");
    this.visible = true;
    this.overlay.hidden = false;
    document.body.classList.add("trader-open");
    this.render();
    resetDialogScroll(this.overlay);
    this.sheet.body.scrollTop = 0;
  }

  sync(opts: {
    traderId: string;
    traderBanknotes: number;
    playerBanknotes: number;
    stockJson: string;
    stockCapacity?: number;
    inventoryJson: string;
    ashenReputation?: number;
    barterT?: number;
    completed?: boolean;
  }) {
    if (!this.visible || opts.traderId !== this.traderId) return;
    const completedConfirm = this.confirmPending;
    this.confirmPending = false;
    this.applySync(opts);
    if (this.phoneOn) {
      this.syncSheet(completedConfirm, opts.completed === true);
      return;
    }
    if (completedConfirm) {
      // Successful Confirm — wipe the offer so leftover badges don't stick.
      this.clearOffer();
      this.selection = null;
      this.render();
      return;
    }
    this.pruneOffers();
    this.resolveSelection();
    this.render();
  }

  /** Keep the selection if still valid (re-resolve stock index by item id after splices). */
  private resolveSelection() {
    if (this.selection?.side === "player") {
      const slot = this.playerInventory[this.selection.slotIndex];
      if (!slot || slot.id !== this.selection.id) this.selection = null;
      else {
        this.selection = {
          ...this.selection,
          quantity: slot.quantity,
        };
      }
    } else if (this.selection?.side === "trader") {
      let stockIndex = this.selection.stockIndex;
      let entry: InventoryEntry | undefined = this.stock[stockIndex];
      if (!entry || entry.id !== this.selection.id) {
        stockIndex = this.stock.findIndex((e) => e.id === this.selection!.id);
        entry = stockIndex >= 0 ? this.stock[stockIndex] : undefined;
      }
      if (!entry) this.selection = null;
      else {
        this.selection = {
          side: "trader",
          stockIndex,
          id: entry.id,
          quantity: entry.quantity,
        };
      }
    }
  }

  private applySync(opts: {
    traderBanknotes: number;
    playerBanknotes: number;
    stockJson: string;
    stockCapacity?: number;
    inventoryJson: string;
    ashenReputation?: number;
    barterT?: number;
  }) {
    this.traderBanknotes = opts.traderBanknotes;
    this.playerBanknotes = opts.playerBanknotes;
    this.stockCapacity =
      typeof opts.stockCapacity === "number" && opts.stockCapacity > 0
        ? opts.stockCapacity
        : TRADER_SHOP_CAPACITY;
    this.ashenReputation = opts.ashenReputation ?? ASHEN_REP_START;
    this.barterT = Number.isFinite(opts.barterT) ? Math.max(0, Math.min(1, opts.barterT!)) : this.barterT;
    this.playerInventory = parseInventory(opts.inventoryJson);
    try {
      const parsed = JSON.parse(opts.stockJson) as InventoryEntry[];
      this.stock = Array.isArray(parsed)
        ? parsed.filter(
            (e) =>
              e &&
              typeof e.id === "string" &&
              typeof e.quantity === "number" &&
              e.quantity > 0,
          )
        : [];
    } catch {
      this.stock = [];
    }
  }

  close() {
    this.visible = false;
    this.overlay.hidden = true;
    this.overlay.classList.remove("ms-host");
    document.body.classList.remove("trader-open");
    markSheetOpen("trader", false);
    this.closeDrawer();
    this.traderId = "";
    this.selection = null;
    this.lastOfferClick = null;
    this.sheetView = "shop";
    this.confirmedDeal = null;
    this.clearOffer();
    this.footerEl.hidden = true;
  }

  destroy() {
    this.close();
    this.unbindPhoneResize();
    this.unbindPhoneResize = () => {};
    this.sheet.dispose();
    this.overlay.remove();
  }

  private clearOffer() {
    this.sellOffers.clear();
    this.buyOffers.clear();
    this.confirmPending = false;
  }

  /** Wipe the pending offer (and selection) from the UI. */
  private resetOffer() {
    this.clearOffer();
    this.selection = null;
    this.render();
  }

  private pruneOffers() {
    for (const [slotIndex, line] of [...this.sellOffers.entries()]) {
      const slot = this.playerInventory[slotIndex];
      if (!slot || slot.id !== line.itemId || slot.quantity <= 0) {
        this.sellOffers.delete(slotIndex);
        continue;
      }
      if (line.quantity > slot.quantity) {
        line.quantity = slot.quantity;
      }
    }
    for (const [stockIndex, line] of [...this.buyOffers.entries()]) {
      const entry = this.stock[stockIndex];
      if (!entry || entry.id !== line.itemId || entry.quantity <= 0) {
        this.buyOffers.delete(stockIndex);
        continue;
      }
      if (line.quantity > entry.quantity) {
        line.quantity = entry.quantity;
      }
      if (this.traderOfferLock(line.itemId)) this.buyOffers.delete(stockIndex);
    }
  }

  private traderOfferLock(itemId: string): string {
    return traderPurchaseLock(itemId, this.ashenReputation);
  }

  /** Standing label for a buy the trader is holding back. Empty when they will sell it. */
  private traderRepRequirement(itemId: string): string {
    if (!this.traderOfferLock(itemId)) return "";
    const standing = traderItemMinStanding(itemId);
    if (!standing) return "";
    return `Requires ${ashenStandingLabel(standing)} reputation`;
  }

  private offeredSellQty(slotIndex: number): number {
    return this.sellOffers.get(slotIndex)?.quantity ?? 0;
  }

  private offeredBuyQty(stockIndex: number): number {
    return this.buyOffers.get(stockIndex)?.quantity ?? 0;
  }

  private hasOffer(): boolean {
    return this.sellOffers.size > 0 || this.buyOffers.size > 0;
  }

  private render() {
    this.phoneOn = usePhoneDialogSheet();
    this.overlay.classList.toggle("ms-host", this.phoneOn);
    this.layoutEl.hidden = this.phoneOn;
    this.sheet.root.hidden = !this.phoneOn;
    markSheetOpen("trader", this.visible && this.phoneOn);
    if (this.phoneOn) {
      this.renderSheet();
      return;
    }
    this.closeDrawer();

    this.playerNotesEl.textContent = formatNotes(this.playerBanknotes);
    this.traderNotesEl.textContent = formatNotes(this.traderBanknotes);
    this.updateStandingPill();
    this.fillGrid(this.playerGridEl, "player");
    this.fillGrid(this.traderGridEl, "trader");
    this.updateDetail();
    this.updateSettlement();
    this.updateActionButtons();
  }

  private updateStandingPill() {
    const standing = ashenStanding(this.ashenReputation);
    const label = ashenStandingLabel(standing);
    const title = `${ASHEN_TRADERS_FACTION}: ${Number(this.ashenReputation.toFixed(1))}`;
    this.standingPillEl.textContent = label;
    this.standingPillEl.className = `trader-standing-pill trader-standing-pill--${standing}`;
    this.standingPillEl.title = title;
  }

  private fillGrid(
    grid: HTMLElement,
    side: "player" | "trader",
  ): void {
    grid.replaceChildren();
    let count = 0;
    if (side === "player") {
      for (let i = 0; i < this.playerInventory.length; i++) {
        const slot = this.playerInventory[i];
        if (!slot || slot.id === "banknote") continue;
        const def = getItemDefinition(slot.id);
        if (!def) continue;
        count++;
        const opts = {
            side: "player" as const,
            slotIndex: i,
            id: slot.id,
            quantity: slot.quantity,
            offered: this.offeredSellQty(i),
            category: def.category,
            selected:
              this.selection?.side === "player" && this.selection.slotIndex === i,
          };
        grid.appendChild(this.makeCell(opts));
      }
    } else {
      for (let i = 0; i < this.stock.length; i++) {
        const entry = this.stock[i]!;
        const def = getItemDefinition(entry.id);
        if (!def) continue;
        count++;
        const opts = {
            side: "trader" as const,
            stockIndex: i,
            id: entry.id,
            quantity: entry.quantity,
            offered: this.offeredBuyQty(i),
            category: def.category,
            selected:
              this.selection?.side === "trader" && this.selection.stockIndex === i,
          };
        grid.appendChild(this.makeCell(opts));
      }
    }
    if (count === 0) {
      const empty = document.createElement("div");
      empty.className = "trader-empty";
      empty.textContent = side === "player" ? "Nothing to sell" : "Sold out";
      grid.appendChild(empty);
    }
  }

  private makeCell(opts: {
    side: "player" | "trader";
    slotIndex?: number;
    stockIndex?: number;
    id: string;
    quantity: number;
    offered: number;
    category: string;
    selected: boolean;
  }) {
    const cell = document.createElement("div");
    cell.className = "inventory-cell inventory-cell--filled trader-cell";
    cell.tabIndex = 0;
    cell.setAttribute("role", "button");
    markQuestKeepsake(cell, opts.id);
    const equipped =
      opts.side === "player" &&
      opts.slotIndex != null &&
      this.isEquippedSellSlot(opts.slotIndex, opts.id);
    if (equipped) cell.classList.add("inventory-cell--equipped");
    if (opts.selected) cell.classList.add("inventory-cell--selected");
    const buyLock = opts.side === "trader" ? this.traderOfferLock(opts.id) : "";
    if (buyLock) cell.classList.add("trader-cell--locked");
    if (opts.offered > 0) cell.classList.add("trader-cell--offered");
    cell.style.setProperty(
      "--slot-accent",
      CATEGORY_COLORS[opts.category] ?? "#555",
    );

    const hasIcon = appendItemIcon(cell, opts.id, "inventory-cell-icon");
    if (hasIcon) cell.classList.add("inventory-cell--has-icon");

    if (opts.quantity > 1) {
      const qty = document.createElement("span");
      qty.className = "inventory-cell-qty";
      qty.textContent = String(opts.quantity);
      cell.appendChild(qty);
    }

    if (buyLock) {
      const lockBadge = document.createElement("span");
      lockBadge.className = "trader-cell-lock";
      const standing = traderItemMinStanding(opts.id);
      lockBadge.textContent = standing ? ashenStandingLabel(standing) : "Held";
      cell.appendChild(lockBadge);
    } else if (opts.offered > 0) {
      const offerBadge = document.createElement("span");
      offerBadge.className = "trader-cell-offer";
      offerBadge.textContent =
        opts.offered >= opts.quantity ? "Offered" : `Offer ×${opts.offered}`;
      cell.appendChild(offerBadge);
    }

    const amount =
      opts.side === "player"
        ? traderBuyPrice(opts.id, this.ashenReputation, this.barterT)
        : traderSellPrice(opts.id, this.ashenReputation, this.barterT);
    cell.appendChild(makeAmountPill(amount, "trader-cell-price"));

    const def = getItemDefinition(opts.id);
    const itemName = def?.name ?? opts.id;
    const effect = wornGearEffectHint(opts.id);
    const titleBits = [itemName];
    if (effect) titleBits.push(effect);
    if (equipped) titleBits.push("Equipped");
    if (buyLock) titleBits.push(buyLock);
    if (effect || equipped || buyLock) cell.title = titleBits.join(" · ");
    cell.setAttribute(
      "aria-label",
      `${itemName}${opts.quantity > 1 ? ` ×${opts.quantity}` : ""}${
        effect ? ` · ${effect}` : ""
      }${equipped ? " · equipped" : ""}${buyLock ? ` · ${buyLock}` : ""}`,
    );

    const selectCell = () => {
      if (opts.side === "player") {
        this.selection = {
          side: "player",
          slotIndex: opts.slotIndex!,
          id: opts.id,
          quantity: opts.quantity,
        };
      } else {
        this.selection = {
          side: "trader",
          stockIndex: opts.stockIndex!,
          id: opts.id,
          quantity: opts.quantity,
        };
      }
    };
    cell.addEventListener("click", () => {
      selectCell();
      const key =
        opts.side === "player"
          ? `p:${opts.slotIndex}:${opts.id}`
          : `t:${opts.stockIndex}:${opts.id}`;
      const now = performance.now();
      const prev = this.lastOfferClick;
      const doubled =
        !!prev && prev.key === key && now - prev.at <= OFFER_DOUBLE_CLICK_MS;
      this.lastOfferClick = doubled ? null : { key, at: now };
      if (doubled) this.addToOffer(1);
      else this.render();
    });
    cell.addEventListener("keydown", (e) => {
      if (e.target !== cell) return;
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      cell.click();
    });

    const lock =
      opts.side === "player"
        ? this.playerOfferLock(opts.slotIndex!, opts.id)
        : buyLock;
    const steps = document.createElement("div");
    steps.className = "trader-cell-step";
    steps.append(
      this.makeQtyButton("−", `Remove one ${def?.name ?? opts.id}`, opts.offered <= 0, () =>
        this.adjustLine(opts, -1),
      ),
      this.makeQtyButton(
        "+",
        `Add one ${def?.name ?? opts.id}`,
        !!lock || opts.offered >= opts.quantity,
        () => this.adjustLine(opts, 1),
        lock,
      ),
    );
    cell.appendChild(steps);
    return cell;
  }

  private makeQtyButton(
    label: string,
    aria: string,
    disabled: boolean,
    onClick: () => void,
    title = "",
  ): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "trader-cell-step-btn";
    btn.textContent = label;
    btn.setAttribute("aria-label", aria);
    btn.disabled = disabled || this.confirmPending;
    if (title) btn.title = title;
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (btn.disabled) return;
      onClick();
    });
    return btn;
  }

  private playerOfferLock(slotIndex: number, itemId: string): string {
    if (isQuestKeepsakeItem(itemId)) return "Traders will not buy these.";
    if (this.wornPackLocked(slotIndex, itemId)) return "Empty the pack to sell it.";
    return "";
  }

  /** Add or remove one of this stack from the offer, and select it. */
  private adjustLine(
    opts: {
      side: "player" | "trader";
      slotIndex?: number;
      stockIndex?: number;
      id: string;
      quantity: number;
    },
    delta: number,
  ) {
    if (opts.side === "player") {
      const slotIndex = opts.slotIndex!;
      this.selection = {
        side: "player",
        slotIndex,
        id: opts.id,
        quantity: opts.quantity,
      };
      if (delta > 0 && this.playerOfferLock(slotIndex, opts.id)) {
        this.render();
        return;
      }
      const next = Math.max(
        0,
        Math.min(opts.quantity, this.offeredSellQty(slotIndex) + delta),
      );
      if (next <= 0) this.sellOffers.delete(slotIndex);
      else {
        this.sellOffers.set(slotIndex, {
          slotIndex,
          itemId: opts.id,
          quantity: next,
        });
      }
    } else {
      const stockIndex = opts.stockIndex!;
      this.selection = {
        side: "trader",
        stockIndex,
        id: opts.id,
        quantity: opts.quantity,
      };
      if (delta > 0 && this.traderOfferLock(opts.id)) {
        this.render();
        return;
      }
      const next = Math.max(
        0,
        Math.min(opts.quantity, this.offeredBuyQty(stockIndex) + delta),
      );
      if (next <= 0) this.buyOffers.delete(stockIndex);
      else {
        this.buyOffers.set(stockIndex, {
          stockIndex,
          itemId: opts.id,
          quantity: next,
        });
      }
    }
    this.render();
  }

  private updateDetail() {
    this.detailEl.replaceChildren();
    this.footerEl.hidden = false;
    if (!this.selection && !this.hasOffer()) {
      this.detailEl.textContent = "No item selected";
      return;
    }
    if (!this.selection) {
      this.detailEl.textContent = "Review your offer";
      return;
    }
    const def = getItemDefinition(this.selection.id);
    const name = def?.name ?? this.selection.id;
    const label =
      this.selection.quantity > 1 ? `${name} ×${this.selection.quantity}` : name;
    const equipped =
      this.selection.side === "player" &&
      this.isEquippedSellSlot(this.selection.slotIndex, this.selection.id);
    const effect = wornGearEffectHint(this.selection.id);
    const bits = [equipped ? `${label} · Equipped` : label];
    if (effect) bits.push(effect);
    if (this.selection.side === "trader") {
      const lock = this.traderOfferLock(this.selection.id);
      if (lock) bits.push(lock);
    }
    this.detailEl.textContent = bits.join(" · ");
  }

  /**
   * True when this stack is sitting in a wear slot (weapon, clothing, radio, and the rest).
   * Pocket copies of the same item stay unmarked.
   */
  private isEquippedSellSlot(slotIndex: number, itemId: string): boolean {
    if (isWeaponSlot(slotIndex)) return isWeaponItem(itemId);
    if (isClothingSlot(slotIndex)) return isClothingItem(itemId);
    if (isBackpackSlot(slotIndex)) return isBackpackItem(itemId);
    return (
      isWatchSlot(slotIndex) ||
      isRadioSlot(slotIndex) ||
      isMapSlot(slotIndex) ||
      isJewelrySlot(slotIndex) ||
      isArmorSlot(slotIndex)
    );
  }

  private updateSettlement() {
    if (!this.hasOffer()) {
      this.settlementEl.hidden = false;
      this.settlementEl.replaceChildren();
      this.settlementEl.classList.remove("trader-settlement--shortfall");
      this.settlementEl.title = "";
      const empty = document.createElement("div");
      empty.className = "trader-settlement-cash";
      empty.textContent = "No offer yet";
      this.settlementEl.append(empty);
      this.clearOfferBtn.hidden = false;
      this.clearOfferBtn.disabled = true;
      this.confirmBtn.hidden = false;
      this.confirmBtn.disabled = true;
      this.confirmBtn.title = "";
      return;
    }

    const facts = this.offerFacts();
    const { net, cash, blockReason, repGain } = facts;

    this.settlementEl.hidden = false;
    this.settlementEl.replaceChildren();
    this.settlementEl.classList.toggle(
      "trader-settlement--shortfall",
      cash.shortfall > 0,
    );

    const cashLine = document.createElement("div");
    cashLine.className = "trader-settlement-cash";
    if (net === 0) {
      cashLine.textContent = "Even trade. No cash changes hands";
      this.settlementEl.title = "";
    } else if (net > 0) {
      cashLine.append("You receive ");
      const amount = document.createElement("span");
      amount.className = "trader-settlement-amount";
      amount.textContent = formatNotes(cash.playerReceives);
      cashLine.append(amount);
      const shortfallRep = cash.shortfall * ASHEN_REP_PER_DOLLAR_TAKEN;
      const shortfallRepText =
        Number.isInteger(shortfallRep) ||
        Math.abs(shortfallRep - Math.round(shortfallRep)) < 1e-9
          ? String(Math.round(shortfallRep))
          : shortfallRep.toFixed(1);
      this.settlementEl.title =
        cash.shortfall > 0
          ? `Trader is short $${cash.shortfall}. You still get their remaining cash, plus +${shortfallRepText} Ashen reputation`
          : "";
    } else {
      cashLine.append("You pay ");
      const amount = document.createElement("span");
      amount.className = "trader-settlement-amount";
      amount.textContent = formatNotes(cash.playerPays);
      cashLine.append(amount);
      this.settlementEl.title = "";
    }
    this.settlementEl.append(cashLine);

    if (repGain > 0) {
      const repLine = document.createElement("div");
      repLine.className = "trader-settlement-rep";
      const shown =
        Number.isInteger(repGain) || Math.abs(repGain - Math.round(repGain)) < 1e-9
          ? String(Math.round(repGain))
          : repGain.toFixed(1);
      repLine.textContent = `+${shown} reputation increase`;
      this.settlementEl.append(repLine);
    }

    if (blockReason) {
      const block = document.createElement("div");
      block.className = "trader-settlement-block";
      block.textContent = blockReason;
      this.settlementEl.append(block);
    }

    this.clearOfferBtn.hidden = false;
    this.clearOfferBtn.disabled = this.confirmPending;
    this.confirmBtn.hidden = false;
    this.confirmBtn.disabled = blockReason.length > 0;
    this.confirmBtn.title = blockReason;
  }

  private confirmBlockReason(
    playerCanAfford: boolean,
    sells: TradeOfferSellLine[],
    buys: TradeOfferBuyLine[],
  ): string {
    if (this.confirmPending) return "Confirming…";
    for (const line of buys) {
      const lock = this.traderOfferLock(line.itemId);
      if (lock) return lock;
    }
    const problem = tradeOfferStockFitProblem(
      this.stock,
      sells,
      buys,
      this.stockCapacity,
    );
    if (problem?.kind === "stale") return "That offer is no longer available.";
    if (problem?.kind === "shelf") {
      return "The merchant cannot accept any more goods right now.";
    }
    if (problem?.kind === "limit") {
      const name = getItemDefinition(problem.itemId)?.name ?? "that";
      if (problem.room === 1) {
        return `The merchant can only take one more ${name}.`;
      }
      return `The merchant can only take ${problem.room} more ${name}.`;
    }
    if (!playerCanAfford) return "Not enough banknotes.";
    return "";
  }

  private updateActionButtons() {
    const sell = this.selection?.side === "player";
    const buy = this.selection?.side === "trader";
    this.sellBtn.hidden = !sell;
    this.sell5Btn.hidden = !sell;
    this.sell10Btn.hidden = !sell;
    this.sellAllBtn.hidden = !sell;
    this.buyBtn.hidden = !buy;
    this.buy5Btn.hidden = !buy;
    this.buy10Btn.hidden = !buy;

    if (sell && this.selection?.side === "player") {
      const lock = this.playerOfferLock(this.selection.slotIndex, this.selection.id);
      const remaining =
        this.selection.quantity - this.offeredSellQty(this.selection.slotIndex);
      this.sellBtn.disabled = !!lock || remaining < 1;
      this.sellBtn.title = lock;
      this.sell5Btn.disabled = !!lock || remaining < 5;
      this.sell10Btn.disabled = !!lock || remaining < 10;
      this.sellAllBtn.disabled = !!lock || remaining < 1;
      this.sellAllBtn.title = lock;
    }
    if (buy && this.selection?.side === "trader") {
      const lock = this.traderOfferLock(this.selection.id);
      const remaining =
        this.selection.quantity - this.offeredBuyQty(this.selection.stockIndex);
      this.buyBtn.disabled = !!lock || remaining < 1;
      this.buy5Btn.disabled = !!lock || remaining < 5;
      this.buy10Btn.disabled = !!lock || remaining < 10;
      this.buyBtn.title = lock;
      this.buy5Btn.title = lock;
      this.buy10Btn.title = lock;
    }
  }

  private wornPackLocked(slotIndex: number, itemId: string): boolean {
    if (!isBackpackItem(itemId)) return false;
    return backpackHoldsItems(this.playerInventory, slotIndex);
  }

  private addToOffer(quantity: number) {
    if (!this.selection || quantity <= 0) return;
    if (this.selection.side === "player" && isQuestKeepsakeItem(this.selection.id)) {
      return;
    }
    if (
      this.selection.side === "player" &&
      this.wornPackLocked(this.selection.slotIndex, this.selection.id)
    ) {
      return;
    }
    if (this.selection.side === "player") {
      const already = this.offeredSellQty(this.selection.slotIndex);
      const add = Math.min(quantity, this.selection.quantity - already);
      if (add <= 0) return;
      const nextQty = already + add;
      this.sellOffers.set(this.selection.slotIndex, {
        slotIndex: this.selection.slotIndex,
        itemId: this.selection.id,
        quantity: nextQty,
      });
    } else {
      if (this.traderOfferLock(this.selection.id)) {
        this.render();
        return;
      }
      const already = this.offeredBuyQty(this.selection.stockIndex);
      const add = Math.min(quantity, this.selection.quantity - already);
      if (add <= 0) return;
      const nextQty = already + add;
      this.buyOffers.set(this.selection.stockIndex, {
        stockIndex: this.selection.stockIndex,
        itemId: this.selection.id,
        quantity: nextQty,
      });
    }
    this.render();
  }

  private confirmOffer() {
    if (!this.hasOffer() || this.confirmBtn.disabled || this.confirmPending) {
      return;
    }
    const sells = [...this.sellOffers.values()];
    const buys = [...this.buyOffers.values()];
    this.confirmPending = true;
    this.updateSettlement();
    this.handlers.onConfirm(sells, buys);
  }

  private offerFacts() {
    const sells = [...this.sellOffers.values()];
    const buys = [...this.buyOffers.values()];
    const totals = tradeOfferTotals(
      sells,
      buys,
      this.ashenReputation,
      this.barterT,
    );
    const cash = tradeOfferCashSettlement(
      totals.net,
      this.traderBanknotes,
      this.playerBanknotes,
    );
    return {
      sells,
      buys,
      ...totals,
      cash,
      blockReason: this.confirmBlockReason(cash.playerCanAfford, sells, buys),
      repGain:
        totals.buyTotal * ASHEN_REP_PER_DOLLAR_GIVEN +
        totals.sellTotal * ASHEN_REP_PER_DOLLAR_TAKEN +
        cash.shortfall * ASHEN_REP_PER_DOLLAR_TAKEN,
    };
  }

  private buildSheet(): void {
    this.sheet = createSheet({ onClose: () => this.handlers.onClose() });
    this.sheet.root.classList.add("trader-ms");
    this.sheet.root.hidden = true;
    this.sheetAvatar = document.createElement("img");
    this.sheetAvatar.src = TRADER_AVATAR;
    this.sheetAvatar.alt = "";
    this.sheet.header.avatarSlot.append(this.sheetAvatar);
    this.sheet.header.avatarSlot.hidden = false;
    this.sheetPill = document.createElement("span");
    this.sheet.header.pillSlot.append(this.sheetPill);
    this.sheetSearch = document.createElement("input");
    this.sheetSearch.type = "search";
    this.sheetSearch.className = "ms-search trader-ms-search";
    this.sheetSearch.autocomplete = "off";
    this.sheetSearch.addEventListener("input", () => {
      this.sheetQuery = this.sheetSearch.value.trim().toLowerCase();
      this.fillSheetList();
    });
    this.sheetList = document.createElement("div");
    this.sheetList.className = "trader-ms-list";
  }

  private closeDrawer(): void {
    const drawer = this.drawer;
    this.drawer = null;
    this.drawerStepper = null;
    drawer?.close();
  }

  private syncSheet(completedConfirm: boolean, completed: boolean): void {
    if (completed && this.confirmedDeal) {
      this.closeDrawer();
      this.clearOffer();
      this.selection = null;
      this.sheetView = "done";
      this.render();
      return;
    }
    this.pruneOffers();
    this.resolveSelection();
    if (completedConfirm) {
      this.closeDrawer();
      this.selection = null;
      this.sheetView = this.hasOffer() ? "review" : "shop";
      showSheetMessage(this.sheet.snackSlot, "The trade did not go through. Check the offer and try again.", "bad");
    }
    if (this.drawer && !this.selection) this.closeDrawer();
    this.render();
    if (this.drawer && this.drawer.el.dataset.key !== this.drawerKey()) this.fillDrawer();
  }

  private drawerKey(): string {
    const sel = this.selection;
    if (!sel) return "";
    const index = sel.side === "player" ? sel.slotIndex : sel.stockIndex;
    return `${sel.side}:${index}:${sel.id}:${sel.quantity}`;
  }

  private renderSheet(): void {
    if (this.sheetView === "review" && !this.hasOffer() && !this.confirmPending) this.sheetView = "shop";
    if (this.sheetView === "done" && !this.confirmedDeal) this.sheetView = "shop";
    const header = this.sheet.header;
    const standing = ashenStanding(this.ashenReputation);
    this.sheetPill.className = `ms-pill trader-standing-pill trader-standing-pill--${standing}`;
    this.sheetPill.textContent = ashenStandingLabel(standing);
    const shop = this.sheetView === "shop";
    header.avatarSlot.hidden = !shop;
    this.sheetPill.hidden = !shop;
    this.sheet.root.classList.toggle("trader-ms--shop", shop);
    if (this.sheetView === "review") this.renderReview();
    else if (this.sheetView === "done") this.renderDone();
    else this.renderShop();
    this.sheet.syncBar();
  }

  private renderShop(): void {
    const header = this.sheet.header;
    header.setTitle(ASHEN_TRADERS_FACTION);
    header.setBack(null);
    header.setSub(`You ${money(this.playerBanknotes)} · Them ${money(this.traderBanknotes)}`);
    const buyCount = [...this.buyOffers.values()].reduce((sum, line) => sum + line.quantity, 0);
    const sellCount = [...this.sellOffers.values()].reduce((sum, line) => sum + line.quantity, 0);
    renderTabs(
      this.sheet.tabsSlot,
      [
        { id: "buy", label: "Buy", count: buyCount || undefined },
        { id: "sell", label: "Sell", count: sellCount || undefined },
      ],
      this.sheetTab,
      (id) => {
        if (id === this.sheetTab) return;
        this.sheetTab = id === "sell" ? "sell" : "buy";
        this.sheetQuery = "";
        this.sheetSearch.value = "";
        this.closeDrawer();
        this.selection = null;
        this.render();
        this.sheet.body.scrollTop = 0;
      },
    );
    if (this.sheetSearch.parentElement !== this.sheet.body || this.sheetList.parentElement !== this.sheet.body) {
      this.sheet.body.replaceChildren(this.sheetSearch, this.sheetList);
    }
    this.sheetSearch.placeholder = this.sheetTab === "buy" ? "Search stock" : "Search your pack";
    this.fillSheetList();

    const summary = document.createElement("div");
    summary.className = "trader-ms-sum";
    const line = document.createElement("b");
    const hint = document.createElement("span");
    hint.className = "ms-hint";
    if (this.hasOffer()) {
      const parts: string[] = [];
      if (buyCount > 0) parts.push(`Buy ${buyCount}`);
      if (sellCount > 0) parts.push(`Sell ${sellCount}`);
      line.textContent = parts.join(" · ");
      hint.textContent = this.cashText(this.offerFacts());
    } else {
      line.textContent = "No offer yet";
      hint.textContent = "Tap an item to add it";
    }
    summary.append(line, hint);
    const review = sheetButton("Review deal", "pri", () => {
      if (!this.hasOffer()) return;
      this.closeDrawer();
      this.selection = null;
      this.sheetView = "review";
      this.render();
      this.sheet.body.scrollTop = 0;
    });
    review.disabled = !this.hasOffer();
    this.sheet.bar.className = "ms-bar trader-ms-bar";
    this.sheet.bar.replaceChildren(summary, review);
  }

  private fillSheetList(): void {
    const scroll = this.sheet.body.scrollTop;
    const rows: HTMLElement[] = [];
    let total = 0;
    const query = this.sheetQuery;
    const matches = (id: string) =>
      !query || (getItemDefinition(id)?.name ?? id).toLowerCase().includes(query);
    if (this.sheetTab === "buy") {
      this.stock.forEach((entry, stockIndex) => {
        if (!getItemDefinition(entry.id)) return;
        total++;
        if (!matches(entry.id)) return;
        rows.push(
          this.shopRow({ side: "trader", stockIndex, id: entry.id, quantity: entry.quantity }),
        );
      });
    } else {
      this.playerInventory.forEach((slot, slotIndex) => {
        if (!slot || slot.id === "banknote" || !getItemDefinition(slot.id)) return;
        total++;
        if (!matches(slot.id)) return;
        rows.push(this.shopRow({ side: "player", slotIndex, id: slot.id, quantity: slot.quantity }));
      });
    }
    this.sheetSearch.hidden = total <= 8 && !query;
    if (rows.length === 0) {
      const empty = document.createElement("p");
      empty.className = "ms-hint trader-ms-empty";
      empty.textContent = query
        ? "Nothing matches that."
        : this.sheetTab === "buy"
          ? "Sold out."
          : "Nothing to sell.";
      rows.push(empty);
    }
    this.sheetList.replaceChildren(...rows);
    this.sheet.body.scrollTop = scroll;
  }

  private shopRow(selection: Selection): HTMLElement {
    const def = getItemDefinition(selection.id);
    const player = selection.side === "player";
    const offered = player
      ? this.offeredSellQty(selection.slotIndex)
      : this.offeredBuyQty(selection.stockIndex);
    const each = player
      ? traderBuyPrice(selection.id, this.ashenReputation, this.barterT)
      : traderSellPrice(selection.id, this.ashenReputation, this.barterT);
    const lock = player
      ? this.playerOfferLock(selection.slotIndex, selection.id)
      : this.traderOfferLock(selection.id);
    const repNeed = player ? "" : this.traderRepRequirement(selection.id);
    const meta: (string | Node)[] = [];
    if (offered > 0) meta.push(chip(`In offer ×${offered}`, "lime"));
    const bits: string[] = [];
    if (repNeed) meta.push(this.repLockBadge(repNeed));
    else if (lock) bits.push(lock);
    else {
      if (player && this.isEquippedSellSlot(selection.slotIndex, selection.id)) bits.push("Worn");
      if (!player) bits.push(`${selection.quantity} in stock`);
    }
    if (bits.length) meta.push(bits.join(" · "));
    const row = sheetRow({
      iconItemId: selection.id,
      qty: player && selection.quantity > 1 ? selection.quantity : undefined,
      name: def?.name ?? selection.id,
      meta,
      metaTone: !repNeed && lock ? "warn" : undefined,
      end: money(each),
      state: offered > 0 ? "on" : !repNeed && lock ? "dim" : undefined,
      onTap: () => this.openItem(selection),
    });
    if (repNeed) row.classList.add("ms-row--rep");
    markQuestKeepsake(row, selection.id);
    return row;
  }

  private repLockBadge(text: string): HTMLElement {
    const badge = document.createElement("span");
    badge.className = "trader-rep-lock";
    badge.textContent = text;
    return badge;
  }

  private cashText(facts: ReturnType<TraderUI["offerFacts"]>): string {
    if (facts.net > 0) return `You get ${money(facts.cash.playerReceives)}`;
    if (facts.net < 0) return `You pay ${money(facts.cash.playerPays)}`;
    return "Even trade";
  }

  private openItem(selection: Selection): void {
    this.closeDrawer();
    this.selection = selection;
    const name = getItemDefinition(selection.id)?.name ?? selection.id;
    const drawer = openDrawer(this.sheet.root, {
      label: name,
      onClose: () => {
        if (this.drawer !== drawer) return;
        this.drawer = null;
        this.drawerStepper = null;
        this.selection = null;
      },
    });
    this.drawer = drawer;
    this.fillDrawer();
  }

  private fillDrawer(): void {
    const sel = this.selection;
    const drawer = this.drawer;
    if (!sel || !drawer) return;
    drawer.el.dataset.key = this.drawerKey();
    const player = sel.side === "player";
    const def = getItemDefinition(sel.id);
    const name = def?.name ?? sel.id;
    const each = player
      ? traderBuyPrice(sel.id, this.ashenReputation, this.barterT)
      : traderSellPrice(sel.id, this.ashenReputation, this.barterT);
    const offered = player ? this.offeredSellQty(sel.slotIndex) : this.offeredBuyQty(sel.stockIndex);
    const lock = player ? this.playerOfferLock(sel.slotIndex, sel.id) : this.traderOfferLock(sel.id);
    const repNeed = player ? "" : this.traderRepRequirement(sel.id);
    const subBits = [`${money(each)} each`];
    const effect = wornGearEffectHint(sel.id);
    if (effect) subBits.push(effect);
    if (!player) subBits.push(`${sel.quantity} in stock`);
    else if (this.isEquippedSellSlot(sel.slotIndex, sel.id)) subBits.push("Worn");
    else if (sel.quantity > 1) subBits.push(`You have ${sel.quantity}`);
    drawer.content.replaceChildren(drawerHead({ iconItemId: sel.id, title: name, sub: subBits.join(" · ") }));
    drawer.bar.replaceChildren();

    if (lock) {
      const note = document.createElement("p");
      if (repNeed) {
        note.className = "trader-rep-lock";
        note.textContent = repNeed;
      } else {
        note.className = "ms-hint ms-warn";
        note.textContent = lock;
      }
      drawer.content.append(note);
      drawer.bar.append(sheetButton("Close", "sec", () => this.closeDrawer()));
      return;
    }

    let draft = Math.max(1, Math.min(sel.quantity, offered > 0 ? offered : 1));
    const quickSlot = document.createElement("div");
    const totalSlot = document.createElement("div");
    const commit = sheetButton("", "pri", () => {
      if (this.confirmPending) return;
      this.setOfferQuantity(draft);
      this.closeDrawer();
      this.selection = null;
      showSheetMessage(this.sheet.snackSlot, `${name} ×${draft} ${player ? "to sell" : "to buy"}`);
    });
    const remove = sheetButton("Remove from offer", "sec", () => {
      if (this.confirmPending) return;
      this.setOfferQuantity(0);
      this.closeDrawer();
      this.selection = null;
      this.render();
    });
    remove.hidden = offered <= 0;
    const paint = () => {
      const options: { label: string; value: number }[] = [];
      for (const n of [1, 5, 10]) if (n < sel.quantity) options.push({ label: String(n), value: n });
      options.push({ label: sel.quantity > 1 ? `All ${sel.quantity}` : "1", value: sel.quantity });
      quickSlot.replaceChildren(
        quickAmounts(options, draft, (value) => {
          draft = value;
          this.drawerStepper?.set(value);
          paint();
        }),
      );
      totalSlot.replaceChildren(
        kvCard([{ label: `${draft} × ${money(each)}`, value: money(draft * each), total: true }]),
      );
      const same = offered > 0 && draft === offered;
      setButtonLabel(commit, same ? "In the offer" : offered > 0 ? "Update offer" : "Add to offer");
      commit.disabled = same || this.confirmPending;
    };
    this.drawerStepper = createStepper({
      value: draft,
      min: 1,
      max: sel.quantity,
      onChange: (value) => {
        draft = value;
        paint();
      },
    });
    paint();
    drawer.content.append(this.drawerStepper.el, quickSlot, totalSlot);
    drawer.bar.append(commit, remove);
  }

  private setOfferQuantity(quantity: number): void {
    const selection = this.selection;
    if (!selection || this.confirmPending) return;
    const qty = Math.max(0, Math.min(selection.quantity, Math.floor(quantity)));
    if (selection.side === "player") {
      if (qty > 0 && this.playerOfferLock(selection.slotIndex, selection.id)) return;
      if (qty <= 0) this.sellOffers.delete(selection.slotIndex);
      else {
        this.sellOffers.set(selection.slotIndex, {
          slotIndex: selection.slotIndex,
          itemId: selection.id,
          quantity: qty,
        });
      }
    } else if (qty <= 0) {
      this.buyOffers.delete(selection.stockIndex);
    } else {
      if (this.traderOfferLock(selection.id)) return;
      this.buyOffers.set(selection.stockIndex, {
        stockIndex: selection.stockIndex,
        itemId: selection.id,
        quantity: qty,
      });
    }
    this.render();
  }

  private renderReview(): void {
    const header = this.sheet.header;
    header.setTitle("Review deal");
    header.setSub(ASHEN_TRADERS_FACTION);
    header.setBack(() => {
      if (this.confirmPending) return;
      this.sheetView = "shop";
      this.render();
    });
    renderTabs(this.sheet.tabsSlot, [], "", () => {});
    const facts = this.offerFacts();
    const body: HTMLElement[] = [];
    if (facts.sells.length) {
      body.push(sectionLabel("You get"));
      for (const line of facts.sells) {
        const slot = this.playerInventory[line.slotIndex];
        const each = traderBuyPrice(line.itemId, this.ashenReputation, this.barterT);
        const where = this.isEquippedSellSlot(line.slotIndex, line.itemId) ? "Worn" : "From your pack";
        body.push(
          this.reviewRow(line.itemId, line.quantity, where, each * line.quantity, () => {
            if (slot) {
              this.openItem({ side: "player", slotIndex: line.slotIndex, id: slot.id, quantity: slot.quantity });
            }
          }),
        );
      }
    }
    if (facts.buys.length) {
      body.push(sectionLabel("You give"));
      for (const line of facts.buys) {
        const entry = this.stock[line.stockIndex];
        const each = traderSellPrice(line.itemId, this.ashenReputation, this.barterT);
        body.push(
          this.reviewRow(line.itemId, line.quantity, `${money(each)} each`, each * line.quantity, () => {
            if (entry) {
              this.openItem({ side: "trader", stockIndex: line.stockIndex, id: entry.id, quantity: entry.quantity });
            }
          }),
        );
      }
    }
    const rows: KvRow[] = [];
    if (facts.sellTotal > 0) rows.push({ label: "You get", value: money(facts.sellTotal) });
    if (facts.buyTotal > 0) rows.push({ label: "You give", value: money(facts.buyTotal) });
    if (facts.repGain > 0) rows.push({ label: "Ashen standing", value: `+${formatRep(facts.repGain)}`, tone: "ok" });
    if (facts.net < 0) rows.push({ label: "You pay", value: money(facts.cash.playerPays), total: true });
    else if (facts.net > 0) rows.push({ label: "You get paid", value: money(facts.cash.playerReceives), total: true });
    else rows.push({ label: "Even trade", value: money(0), total: true });
    rows.push({
      label: "Your notes after",
      value: money(this.playerBanknotes + facts.cash.playerReceives - facts.cash.playerPays),
    });
    body.push(kvCard(rows, true));
    const note = (text: string, tone = "") => {
      const p = document.createElement("p");
      p.className = tone ? `ms-hint ms-${tone}` : "ms-hint";
      p.textContent = text;
      body.push(p);
    };
    if (facts.cash.shortfall > 0 && facts.net > 0) {
      note(
        `Trader is short ${money(facts.cash.shortfall)}. You still get their remaining cash, plus +${formatRep(
          facts.cash.shortfall * ASHEN_REP_PER_DOLLAR_TAKEN,
        )} Ashen reputation.`,
        "warn",
      );
    }
    if (facts.blockReason && !this.confirmPending) note(facts.blockReason, "warn");
    note("Tap a line to change or remove it.");
    this.sheet.body.replaceChildren(...body);

    const label = this.confirmPending
      ? "Confirming…"
      : facts.net < 0
        ? `Confirm · pay ${money(facts.cash.playerPays)}`
        : facts.net > 0
          ? `Confirm · get ${money(facts.cash.playerReceives)}`
          : "Confirm trade";
    const confirm = sheetButton(label, "pri", () => this.confirmPhoneOffer());
    confirm.disabled = this.confirmPending || facts.blockReason.length > 0;
    this.sheet.bar.className = "ms-bar";
    this.sheet.bar.replaceChildren(confirm);
  }

  private reviewRow(itemId: string, quantity: number, meta: string, total: number, onTap: () => void): HTMLElement {
    const name = getItemDefinition(itemId)?.name ?? itemId;
    return sheetRow({
      iconItemId: itemId,
      qty: quantity > 1 ? quantity : undefined,
      name: quantity > 1 ? `${name} ×${quantity}` : name,
      meta: [meta],
      end: money(total),
      onTap: this.confirmPending ? undefined : onTap,
    });
  }

  private confirmPhoneOffer(): void {
    if (!this.hasOffer() || this.confirmPending) return;
    const facts = this.offerFacts();
    if (facts.blockReason) return;
    this.confirmedDeal = {
      sells: facts.sells.map((line) => ({ ...line })),
      buys: facts.buys.map((line) => ({ ...line })),
      net: facts.net,
      paid: facts.cash.playerPays,
      received: facts.cash.playerReceives,
      repGain: facts.repGain,
    };
    this.confirmPending = true;
    this.handlers.onConfirm(facts.sells, facts.buys);
    this.render();
  }

  private renderDone(): void {
    const deal = this.confirmedDeal!;
    const header = this.sheet.header;
    header.setTitle("Deal done");
    header.setSub(ASHEN_TRADERS_FACTION);
    header.setBack(null);
    renderTabs(this.sheet.tabsSlot, [], "", () => {});
    const body: HTMLElement[] = [];
    const lines = (heading: string, items: { itemId: string; quantity: number }[], sign: string) => {
      if (items.length === 0) return;
      body.push(sectionLabel(heading));
      for (const line of items) {
        const name = getItemDefinition(line.itemId)?.name ?? line.itemId;
        body.push(sheetRow({ iconItemId: line.itemId, name: `${sign}${line.quantity} ${name}` }));
      }
    };
    lines("Into your pack", deal.buys, "+");
    lines("Handed over", deal.sells, "−");
    const rows: KvRow[] = [];
    if (deal.paid > 0) rows.push({ label: "You paid", value: money(deal.paid), total: true });
    else if (deal.received > 0) rows.push({ label: "You got paid", value: money(deal.received), total: true });
    else rows.push({ label: "Even trade", value: money(0), total: true });
    if (deal.repGain > 0) rows.push({ label: "Ashen standing", value: `+${formatRep(deal.repGain)}`, tone: "ok" });
    rows.push({ label: "Your notes now", value: money(this.playerBanknotes) });
    body.push(kvCard(rows, true));
    this.sheet.body.replaceChildren(...body);
    this.sheet.bar.className = "ms-bar";
    const row = document.createElement("div");
    row.className = "ms-bar-row";
    row.append(
      sheetButton("Keep trading", "pri", () => {
        this.confirmedDeal = null;
        this.sheetView = "shop";
        this.render();
        this.sheet.body.scrollTop = 0;
      }),
      sheetButton("Leave", "sec", () => this.handlers.onClose()),
    );
    this.sheet.bar.replaceChildren(row);
  }
}
