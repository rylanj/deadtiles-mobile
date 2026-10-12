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
  private phoneTab: "player" | "trader" = "player";
  private phoneItemOpen = false;
  private phoneReviewOpen = false;
  private phoneDraftQty = 1;
  private phoneDraftKey = "";
  private unbindPhoneResize: () => void = () => {};
  private phoneRoot!: HTMLElement;
  private phoneStandingEl!: HTMLElement;
  private phoneYouNotes!: HTMLElement;
  private phoneThemNotes!: HTMLElement;
  private phonePackTab!: HTMLButtonElement;
  private phoneStockTab!: HTMLButtonElement;
  private phoneGridEl!: HTMLElement;
  private phoneStripEl!: HTMLElement;
  private phoneStripText!: HTMLElement;
  private phoneItemEl!: HTMLElement;
  private phoneReviewEl!: HTMLElement;

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
    this.buildPhoneSheet();
    this.overlay.append(layout, this.phoneRoot);

    this.overlay.addEventListener("click", (e) => {
      if (usePhoneDialogSheet()) return;
      if (e.target === this.overlay) this.handlers.onClose();
    });

    this.unbindPhoneResize = bindPhoneDialogResize(
      () => this.visible,
      () => this.overlay.classList.contains("trader-sheet-mode"),
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
    this.phoneTab = "player";
    this.phoneItemOpen = false;
    this.phoneReviewOpen = false;
    this.phoneDraftQty = 1;
    this.phoneDraftKey = "";
    this.visible = true;
    this.overlay.hidden = false;
    document.body.classList.add("trader-open");
    this.render();
    resetDialogScroll(this.overlay);
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
  }) {
    if (!this.visible || opts.traderId !== this.traderId) return;
    const completedConfirm = this.confirmPending;
    this.confirmPending = false;
    this.applySync(opts);
    if (completedConfirm) {
      // Successful Confirm — wipe the offer so leftover badges don't stick.
      this.clearOffer();
      this.selection = null;
      this.phoneItemOpen = false;
      this.phoneReviewOpen = false;
      this.phoneDraftKey = "";
      this.render();
      return;
    }
    this.pruneOffers();
    // Keep selection if still valid (re-resolve stock index by item id after splices).
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
    this.render();
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
    this.overlay.classList.remove("trader-sheet-mode");
    document.body.classList.remove("trader-open");
    this.traderId = "";
    this.selection = null;
    this.lastOfferClick = null;
    this.phoneItemOpen = false;
    this.phoneReviewOpen = false;
    this.phoneDraftKey = "";
    this.clearOffer();
    this.footerEl.hidden = true;
  }

  destroy() {
    this.close();
    this.unbindPhoneResize();
    this.unbindPhoneResize = () => {};
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
    this.phoneItemOpen = false;
    this.phoneReviewOpen = false;
    this.phoneDraftKey = "";
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
    }
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
    this.overlay.classList.toggle("trader-sheet-mode", this.phoneOn);
    this.layoutEl.hidden = this.phoneOn;
    this.phoneRoot.hidden = !this.phoneOn;
    if (this.phoneOn) {
      this.renderPhone();
      return;
    }
    this.phoneKeepGridScroll = true;

    this.playerNotesEl.textContent = formatNotes(this.playerBanknotes);
    this.traderNotesEl.textContent = formatNotes(this.traderBanknotes);
    this.updateStandingPill();
    this.fillGrid(this.playerGridEl, "player", false);
    this.fillGrid(this.traderGridEl, "trader", false);
    this.updateDetail();
    this.updateSettlement();
    this.updateActionButtons();
  }

  private updateStandingPill() {
    const standing = ashenStanding(this.ashenReputation);
    const label = ashenStandingLabel(standing);
    const title = `${ASHEN_TRADERS_FACTION}: ${Number(this.ashenReputation.toFixed(1))}`;
    for (const el of [this.standingPillEl, this.phoneStandingEl]) {
      el.textContent = label;
      el.className = `trader-standing-pill trader-standing-pill--${standing}`;
      el.title = title;
    }
  }

  private fillGrid(
    grid: HTMLElement,
    side: "player" | "trader",
    phone: boolean,
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
        grid.appendChild(
          this.makeCell({
            side: "player",
            slotIndex: i,
            id: slot.id,
            quantity: slot.quantity,
            offered: this.offeredSellQty(i),
            category: def.category,
            selected:
              this.selection?.side === "player" && this.selection.slotIndex === i,
            phone,
          }),
        );
      }
    } else {
      for (let i = 0; i < this.stock.length; i++) {
        const entry = this.stock[i]!;
        const def = getItemDefinition(entry.id);
        if (!def) continue;
        count++;
        grid.appendChild(
          this.makeCell({
            side: "trader",
            stockIndex: i,
            id: entry.id,
            quantity: entry.quantity,
            offered: this.offeredBuyQty(i),
            category: def.category,
            selected:
              this.selection?.side === "trader" && this.selection.stockIndex === i,
            phone,
          }),
        );
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
    phone?: boolean;
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

    if (opts.offered > 0) {
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
    if (effect || equipped) cell.title = titleBits.join(" · ");
    cell.setAttribute(
      "aria-label",
      `${itemName}${opts.quantity > 1 ? ` ×${opts.quantity}` : ""}${
        effect ? ` · ${effect}` : ""
      }${equipped ? " · equipped" : ""}`,
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
    if (opts.phone) {
      cell.addEventListener("click", () => {
        selectCell();
        this.phoneReviewOpen = false;
        this.phoneItemOpen = true;
        this.render();
      });
      cell.addEventListener("keydown", (event) => {
        if (event.target !== cell) return;
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        cell.click();
      });
      return cell;
    }
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
        : "";
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
      const remaining =
        this.selection.quantity - this.offeredBuyQty(this.selection.stockIndex);
      this.buyBtn.disabled = remaining < 1;
      this.buy5Btn.disabled = remaining < 5;
      this.buy10Btn.disabled = remaining < 10;
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
    if (this.phoneOn) this.renderPhone();
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

  private buildPhoneSheet(): void {
    this.phoneRoot = document.createElement("div");
    this.phoneRoot.className = "trader-sheet";
    this.phoneRoot.hidden = true;

    const header = document.createElement("div");
    header.className = "trader-sheet-header";
    const avatar = document.createElement("img");
    avatar.className = "trader-avatar";
    avatar.src = TRADER_AVATAR;
    avatar.alt = "Trader";
    const nameCol = document.createElement("div");
    nameCol.className = "trader-sheet-name";
    const title = document.createElement("h2");
    title.className = "inventory-title";
    title.textContent = ASHEN_TRADERS_FACTION;
    this.phoneStandingEl = document.createElement("div");
    this.phoneStandingEl.className = "trader-standing-pill trader-standing-pill--neutral";
    this.phoneStandingEl.textContent = "Neutral";
    nameCol.append(title, this.phoneStandingEl);
    const wallets = document.createElement("div");
    wallets.className = "trader-sheet-wallets";
    this.phoneYouNotes = document.createElement("span");
    this.phoneThemNotes = document.createElement("span");
    wallets.append(
      this.walletPill("You", this.phoneYouNotes),
      this.walletPill("Them", this.phoneThemNotes),
    );
    header.append(
      avatar,
      nameCol,
      wallets,
      createDialogCloseButton(() => this.handlers.onClose()),
    );

    const stage = document.createElement("div");
    stage.className = "trader-sheet-stage";
    const browse = document.createElement("div");
    browse.className = "trader-sheet-browse";
    const tabs = document.createElement("div");
    tabs.className = "trader-sheet-tabs";
    tabs.setAttribute("role", "tablist");
    this.phonePackTab = this.phoneTabButton("Your pack", "player");
    this.phoneStockTab = this.phoneTabButton("Their stock", "trader");
    tabs.append(this.phonePackTab, this.phoneStockTab);
    const gridWrap = document.createElement("div");
    gridWrap.className = "trader-sheet-grid-wrap";
    this.phoneGridEl = document.createElement("div");
    this.phoneGridEl.className = "trader-sheet-grid";
    gridWrap.append(this.phoneGridEl);
    this.phoneStripEl = document.createElement("div");
    this.phoneStripEl.className = "trader-sheet-strip";
    this.phoneStripEl.hidden = true;
    this.phoneStripText = document.createElement("span");
    this.phoneStripText.className = "trader-sheet-strip-text";
    const reviewBtn = document.createElement("button");
    reviewBtn.type = "button";
    reviewBtn.className = "trader-sheet-review-btn";
    reviewBtn.textContent = "Review";
    reviewBtn.addEventListener("click", () => {
      this.phoneReviewOpen = true;
      this.phoneItemOpen = false;
      this.render();
    });
    this.phoneStripEl.append(this.phoneStripText, reviewBtn);
    browse.append(tabs, gridWrap, this.phoneStripEl);
    this.phoneItemEl = document.createElement("div");
    this.phoneItemEl.className = "trader-sheet-item";
    this.phoneItemEl.hidden = true;
    stage.append(browse, this.phoneItemEl);
    this.phoneReviewEl = document.createElement("div");
    this.phoneReviewEl.className = "trader-sheet-review";
    this.phoneReviewEl.hidden = true;
    this.phoneRoot.append(header, stage, this.phoneReviewEl);
  }

  private walletPill(label: string, amount: HTMLElement): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "trader-sheet-wallet";
    const kicker = document.createElement("span");
    kicker.className = "trader-sheet-wallet-label";
    kicker.textContent = label;
    amount.className = "trader-notes-pill";
    wrap.append(kicker, amount);
    return wrap;
  }

  private phoneTabButton(
    label: string,
    tab: "player" | "trader",
  ): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "trader-sheet-tab";
    btn.textContent = label;
    btn.setAttribute("role", "tab");
    btn.addEventListener("click", () => this.setPhoneTab(tab));
    return btn;
  }

  private setPhoneTab(tab: "player" | "trader"): void {
    if (this.phoneTab === tab) return;
    this.phoneTab = tab;
    this.phoneItemOpen = false;
    this.selection = null;
    this.phoneDraftKey = "";
    this.phoneKeepGridScroll = false;
    this.render();
  }

  private phoneKeepGridScroll = true;

  private renderPhone(): void {
    this.phoneYouNotes.textContent = formatNotes(this.playerBanknotes);
    this.phoneThemNotes.textContent = formatNotes(this.traderBanknotes);
    this.updateStandingPill();
    const packOn = this.phoneTab === "player";
    this.phonePackTab.classList.toggle("trader-sheet-tab--on", packOn);
    this.phoneStockTab.classList.toggle("trader-sheet-tab--on", !packOn);
    this.phonePackTab.setAttribute("aria-selected", packOn ? "true" : "false");
    this.phoneStockTab.setAttribute("aria-selected", packOn ? "false" : "true");

    const wrap = this.phoneGridEl.parentElement;
    const scroll = this.phoneKeepGridScroll ? (wrap?.scrollTop ?? 0) : 0;
    this.phoneKeepGridScroll = true;
    this.fillGrid(this.phoneGridEl, this.phoneTab, true);
    if (wrap) wrap.scrollTop = scroll;

    if (this.phoneReviewOpen && !this.hasOffer()) this.phoneReviewOpen = false;
    const showReview = this.phoneReviewOpen && this.hasOffer();
    const showItem = this.phoneItemSheetVisible() && !showReview;
    this.phoneReviewEl.hidden = !showReview;
    this.phoneItemEl.hidden = !showItem;
    this.phoneRoot.classList.toggle("trader-sheet--review", showReview);
    this.phoneRoot.classList.toggle("trader-sheet--item", showItem);
    if (showItem) this.fillItemSheet();

    const showStrip = this.hasOffer() && !showReview;
    this.phoneStripEl.hidden = !showStrip;
    if (showStrip) this.phoneStripText.textContent = this.offerStripText();
    if (showReview) this.fillReview();
    this.updateSettlement();
  }

  private phoneItemSheetVisible(): boolean {
    if (!this.phoneItemOpen || !this.selection) return false;
    return this.selection.side === this.phoneTab;
  }

  private offerStripText(): string {
    const facts = this.offerFacts();
    let count = 0;
    for (const line of facts.sells) count += line.quantity;
    for (const line of facts.buys) count += line.quantity;
    const itemWord = count === 1 ? "item" : "items";
    let cash = "Even trade";
    if (facts.net > 0) cash = `You receive ${formatNotes(facts.cash.playerReceives)}`;
    else if (facts.net < 0) cash = `You pay ${formatNotes(facts.cash.playerPays)}`;
    return `Offer · ${count} ${itemWord} · ${cash}`;
  }

  private syncPhoneDraft(): void {
    const selection = this.selection;
    if (!selection) return;
    const key =
      selection.side === "player"
        ? `p:${selection.slotIndex}:${selection.id}`
        : `t:${selection.stockIndex}:${selection.id}`;
    if (key !== this.phoneDraftKey) {
      this.phoneDraftKey = key;
      const offered =
        selection.side === "player"
          ? this.offeredSellQty(selection.slotIndex)
          : this.offeredBuyQty(selection.stockIndex);
      const lock =
        selection.side === "player"
          ? this.playerOfferLock(selection.slotIndex, selection.id)
          : "";
      this.phoneDraftQty = lock
        ? 0
        : offered > 0
          ? offered
          : Math.min(1, selection.quantity);
    }
    this.phoneDraftQty = Math.max(0, Math.min(selection.quantity, this.phoneDraftQty));
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
      this.buyOffers.set(selection.stockIndex, {
        stockIndex: selection.stockIndex,
        itemId: selection.id,
        quantity: qty,
      });
    }
    this.render();
  }

  private draftButton(
    label: string,
    aria: string,
    disabled: boolean,
    onClick: () => void,
  ): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className =
      label === "−" || label === "+" ? "trader-sheet-step" : "trader-sheet-chip";
    btn.textContent = label;
    btn.setAttribute("aria-label", aria);
    btn.disabled = disabled;
    btn.addEventListener("click", () => {
      if (btn.disabled) return;
      onClick();
    });
    return btn;
  }

  private fillItemSheet(): void {
    const selection = this.selection;
    if (!selection) return;
    this.syncPhoneDraft();
    const def = getItemDefinition(selection.id);
    const name = def?.name ?? selection.id;
    const equipped =
      selection.side === "player" &&
      this.isEquippedSellSlot(selection.slotIndex, selection.id);
    const effect = wornGearEffectHint(selection.id);
    const lock =
      selection.side === "player"
        ? this.playerOfferLock(selection.slotIndex, selection.id)
        : "";
    const each =
      selection.side === "player"
        ? traderBuyPrice(selection.id, this.ashenReputation, this.barterT)
        : traderSellPrice(selection.id, this.ashenReputation, this.barterT);
    const offered =
      selection.side === "player"
        ? this.offeredSellQty(selection.slotIndex)
        : this.offeredBuyQty(selection.stockIndex);

    this.phoneItemEl.replaceChildren();
    const body = document.createElement("div");
    body.className = "trader-sheet-item-body";
    const top = document.createElement("div");
    top.className = "trader-sheet-item-top";
    const title = document.createElement("h3");
    title.className = "trader-sheet-item-name";
    title.textContent = equipped ? `${name} · Equipped` : name;
    const close = document.createElement("button");
    close.type = "button";
    close.className = "dialog-close-btn";
    close.textContent = "Close";
    close.addEventListener("click", () => {
      this.phoneItemOpen = false;
      this.selection = null;
      this.phoneDraftKey = "";
      this.render();
    });
    top.append(title, close);
    const price = document.createElement("div");
    price.className = "trader-sheet-item-price";
    price.textContent =
      selection.side === "player"
        ? `Sells for ${formatNotes(each)} each`
        : `Costs ${formatNotes(each)} each`;
    body.append(top, price);
    if (effect) {
      const effectEl = document.createElement("div");
      effectEl.className = "trader-sheet-item-effect";
      effectEl.textContent = effect;
      body.append(effectEl);
    }
    if (lock) {
      const lockEl = document.createElement("div");
      lockEl.className = "trader-sheet-lock";
      lockEl.textContent = lock;
      body.append(lockEl);
    }

    const controls = document.createElement("div");
    controls.className = "trader-sheet-controls";
    const stepper = document.createElement("div");
    stepper.className = "trader-sheet-stepper";
    const minus = this.draftButton(
      "−",
      "Less",
      !!lock || this.phoneDraftQty <= 0 || this.confirmPending,
      () => {
        this.phoneDraftQty = Math.max(0, this.phoneDraftQty - 1);
        this.render();
      },
    );
    const qty = document.createElement("span");
    qty.className = "trader-sheet-qty";
    qty.textContent = String(this.phoneDraftQty);
    const plus = this.draftButton(
      "+",
      "More",
      !!lock || this.phoneDraftQty >= selection.quantity || this.confirmPending,
      () => {
        this.phoneDraftQty = Math.min(selection.quantity, this.phoneDraftQty + 1);
        this.render();
      },
    );
    stepper.append(minus, qty, plus);
    const chips = document.createElement("div");
    chips.className = "trader-sheet-chips";
    chips.append(
      this.draftButton(
        "5",
        "Set 5",
        !!lock || selection.quantity < 5 || this.confirmPending,
        () => {
          this.phoneDraftQty = Math.min(5, selection.quantity);
          this.render();
        },
      ),
      this.draftButton(
        "10",
        "Set 10",
        !!lock || selection.quantity < 10 || this.confirmPending,
        () => {
          this.phoneDraftQty = Math.min(10, selection.quantity);
          this.render();
        },
      ),
      this.draftButton(
        "All",
        "All",
        !!lock || selection.quantity < 1 || this.confirmPending,
        () => {
          this.phoneDraftQty = selection.quantity;
          this.render();
        },
      ),
    );
    controls.append(stepper, chips);

    const action = document.createElement("button");
    action.type = "button";
    action.className = "trader-confirm-btn trader-sheet-add";
    if (lock) {
      action.disabled = true;
      action.textContent = "Cannot trade";
    } else if (this.phoneDraftQty <= 0) {
      action.textContent = "Remove from offer";
      action.disabled = offered <= 0 || this.confirmPending;
    } else if (this.phoneDraftQty === offered) {
      action.textContent = "In the offer";
      action.disabled = true;
    } else {
      action.textContent = offered > 0 ? "Update offer" : "Add to offer";
      action.disabled = this.confirmPending;
    }
    action.addEventListener("click", () => {
      if (action.disabled) return;
      this.setOfferQuantity(this.phoneDraftQty);
    });
    this.phoneItemEl.append(body, controls, action);
  }

  private fillReview(): void {
    const facts = this.offerFacts();
    this.phoneReviewEl.replaceChildren();
    const header = document.createElement("div");
    header.className = "trader-sheet-header trader-sheet-review-header";
    const back = document.createElement("button");
    back.type = "button";
    back.className = "dialog-close-btn";
    back.textContent = "Back";
    back.disabled = this.confirmPending;
    back.addEventListener("click", () => {
      if (this.confirmPending) return;
      this.phoneReviewOpen = false;
      this.render();
    });
    const title = document.createElement("h2");
    title.className = "trader-sheet-review-title";
    title.textContent = "Offer";
    header.append(back, title, createDialogCloseButton(() => this.handlers.onClose()));

    const body = document.createElement("div");
    body.className = "trader-sheet-review-body";
    this.appendOfferRows(
      body,
      "You sell",
      facts.sells.map((line) => ({
        itemId: line.itemId,
        quantity: line.quantity,
        price: traderBuyPrice(line.itemId, this.ashenReputation, this.barterT) * line.quantity,
        remove: () => {
          this.sellOffers.delete(line.slotIndex);
          if (!this.hasOffer()) this.phoneReviewOpen = false;
          this.render();
        },
      })),
    );
    this.appendOfferRows(
      body,
      "You buy",
      facts.buys.map((line) => ({
        itemId: line.itemId,
        quantity: line.quantity,
        price: traderSellPrice(line.itemId, this.ashenReputation, this.barterT) * line.quantity,
        remove: () => {
          this.buyOffers.delete(line.stockIndex);
          if (!this.hasOffer()) this.phoneReviewOpen = false;
          this.render();
        },
      })),
    );

    const summary = document.createElement("div");
    summary.className = "trader-sheet-summary";
    const addLine = (text: string, className: string) => {
      const line = document.createElement("div");
      line.className = className;
      line.textContent = text;
      summary.append(line);
    };
    if (facts.sellTotal > 0) addLine(`You sell ${formatNotes(facts.sellTotal)}`, "trader-sheet-summary-line");
    if (facts.buyTotal > 0) addLine(`You buy ${formatNotes(facts.buyTotal)}`, "trader-sheet-summary-line");
    if (facts.net === 0) {
      addLine("Even trade. No cash changes hands", "trader-sheet-summary-cash");
    } else if (facts.net > 0) {
      addLine(`You receive ${formatNotes(facts.cash.playerReceives)}`, "trader-sheet-summary-cash");
    } else {
      addLine(`You pay ${formatNotes(facts.cash.playerPays)}`, "trader-sheet-summary-cash");
    }
    if (facts.repGain > 0) {
      const shown =
        Number.isInteger(facts.repGain) ||
        Math.abs(facts.repGain - Math.round(facts.repGain)) < 1e-9
          ? String(Math.round(facts.repGain))
          : facts.repGain.toFixed(1);
      addLine(`+${shown} reputation`, "trader-sheet-summary-rep");
    }
    if (facts.cash.shortfall > 0 && facts.net > 0) {
      addLine(
        `Trader is short ${formatNotes(facts.cash.shortfall)}. You still get the cash they have.`,
        "trader-sheet-note",
      );
    }
    if (facts.blockReason) addLine(facts.blockReason, "trader-sheet-lock");
    body.append(summary);

    const bar = document.createElement("div");
    bar.className = "trader-sheet-review-bar";
    const clear = document.createElement("button");
    clear.type = "button";
    clear.className = "trader-clear-offer-btn";
    clear.textContent = "Clear";
    clear.disabled = this.confirmPending;
    clear.addEventListener("click", () => this.resetOffer());
    const confirm = document.createElement("button");
    confirm.type = "button";
    confirm.className = "trader-confirm-btn";
    confirm.textContent = this.confirmPending ? "Confirming…" : "Confirm";
    confirm.disabled = facts.blockReason.length > 0;
    confirm.addEventListener("click", () => this.confirmOffer());
    bar.append(clear, confirm);
    this.phoneReviewEl.append(header, body, bar);
  }

  private appendOfferRows(
    parent: HTMLElement,
    heading: string,
    lines: {
      itemId: string;
      quantity: number;
      price: number;
      remove: () => void;
    }[],
  ): void {
    if (lines.length === 0) return;
    const label = document.createElement("div");
    label.className = "trader-sheet-kicker";
    label.textContent = heading;
    parent.append(label);
    for (const line of lines) {
      const row = document.createElement("div");
      row.className = "trader-sheet-line";
      appendItemIcon(row, line.itemId, "trader-sheet-line-icon");
      const name = document.createElement("div");
      name.className = "trader-sheet-line-name";
      const def = getItemDefinition(line.itemId);
      name.textContent = `${def?.name ?? line.itemId} ×${line.quantity}`;
      const price = document.createElement("div");
      price.className = "trader-sheet-line-price";
      price.textContent = formatNotes(line.price);
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "trader-sheet-remove";
      remove.textContent = "Remove";
      remove.disabled = this.confirmPending;
      remove.addEventListener("click", line.remove);
      row.append(name, price, remove);
      parent.append(row);
    }
  }
}
