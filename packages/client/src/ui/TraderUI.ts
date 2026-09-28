import {
  ASHEN_REP_START,
  ASHEN_TRADERS_FACTION,
  ASHEN_REP_PER_DOLLAR_GIVEN,
  ASHEN_REP_PER_DOLLAR_TAKEN,
  ashenStanding,
  ashenStandingLabel,
  getItemDefinition,
  parseInventory,
  tradeOfferTotals,
  tradeOfferCashSettlement,
  tradeOfferFitsTraderStock,
  traderBuyPrice,
  traderSellPrice,
  type Inventory,
  type InventoryEntry,
  type TradeOfferBuyLine,
  type TradeOfferSellLine,
} from "@zombie/shared";
import { appendItemIcon } from "./itemIcons";
import { createDialogCloseButton } from "./dialogCloseBtn";
import { resetDialogScroll } from "./dialogScroll";
import { playerAvatarSrc } from "./playerAvatar";

export type TraderUIHandlers = {
  onConfirm: (
    sells: TradeOfferSellLine[],
    buys: TradeOfferBuyLine[],
  ) => void;
  onClose: () => void;
};

const TRADER_AVATAR = "/assets/UI/TraderMan1/TraderMan1_Avatar.png";

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
  private selection: Selection | null = null;
  /** Pending sell offers keyed by inventory slot. */
  private sellOffers = new Map<number, TradeOfferSellLine>();
  /** Pending buy offers keyed by stock index. */
  private buyOffers = new Map<number, TradeOfferBuyLine>();
  /** True after Confirm until the next tradeSync (prevents double-submit). */
  private confirmPending = false;

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
    playerHint.textContent = "Select to offer";
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
    traderHint.textContent = "Select to offer";
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
    this.footerEl.hidden = true;
    this.detailEl = document.createElement("div");
    this.detailEl.className = "inventory-detail";
    const actions = document.createElement("div");
    actions.className = "inventory-actions";
    this.sellBtn = this.makeActionBtn("Sell", () => this.addToOffer(1));
    this.sell5Btn = this.makeActionBtn("Sell 5", () => this.addToOffer(5));
    this.sell10Btn = this.makeActionBtn("Sell 10", () => this.addToOffer(10));
    this.buyBtn = this.makeActionBtn("Buy", () => this.addToOffer(1));
    this.buy5Btn = this.makeActionBtn("Buy 5", () => this.addToOffer(5));
    this.buy10Btn = this.makeActionBtn("Buy 10", () => this.addToOffer(10));
    actions.append(
      this.sellBtn,
      this.sell5Btn,
      this.sell10Btn,
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
    this.overlay.appendChild(layout);

    this.overlay.addEventListener("click", (e) => {
      if (e.target === this.overlay) this.handlers.onClose();
    });

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
    this.confirmPending = false;
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
    inventoryJson: string;
    ashenReputation?: number;
    barterT?: number;
  }) {
    this.traderBanknotes = opts.traderBanknotes;
    this.playerBanknotes = opts.playerBanknotes;
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
    document.body.classList.remove("trader-open");
    this.traderId = "";
    this.selection = null;
    this.clearOffer();
    this.footerEl.hidden = true;
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
    this.playerNotesEl.textContent = formatNotes(this.playerBanknotes);
    this.traderNotesEl.textContent = formatNotes(this.traderBanknotes);
    this.updateStandingPill();

    this.playerGridEl.replaceChildren();
    let playerCount = 0;
    for (let i = 0; i < this.playerInventory.length; i++) {
      const slot = this.playerInventory[i];
      if (!slot || slot.id === "banknote") continue;
      const def = getItemDefinition(slot.id);
      if (!def) continue;
      playerCount++;
      const offered = this.offeredSellQty(i);
      this.playerGridEl.appendChild(
        this.makeCell({
          side: "player",
          slotIndex: i,
          id: slot.id,
          quantity: slot.quantity,
          offered,
          category: def.category,
          selected:
            this.selection?.side === "player" &&
            this.selection.slotIndex === i,
        }),
      );
    }
    if (playerCount === 0) {
      const empty = document.createElement("div");
      empty.className = "trader-empty";
      empty.textContent = "Nothing to sell";
      this.playerGridEl.appendChild(empty);
    }

    this.traderGridEl.replaceChildren();
    let traderCount = 0;
    for (let i = 0; i < this.stock.length; i++) {
      const entry = this.stock[i]!;
      const def = getItemDefinition(entry.id);
      if (!def) continue;
      traderCount++;
      const offered = this.offeredBuyQty(i);
      this.traderGridEl.appendChild(
        this.makeCell({
          side: "trader",
          stockIndex: i,
          id: entry.id,
          quantity: entry.quantity,
          offered,
          category: def.category,
          selected:
            this.selection?.side === "trader" &&
            this.selection.stockIndex === i,
        }),
      );
    }
    if (traderCount === 0) {
      const empty = document.createElement("div");
      empty.className = "trader-empty";
      empty.textContent = "Sold out";
      this.traderGridEl.appendChild(empty);
    }

    this.updateDetail();
    this.updateSettlement();
    this.updateActionButtons();
  }

  private updateStandingPill() {
    const standing = ashenStanding(this.ashenReputation);
    this.standingPillEl.textContent = ashenStandingLabel(standing);
    this.standingPillEl.className = `trader-standing-pill trader-standing-pill--${standing}`;
    this.standingPillEl.title = `${ASHEN_TRADERS_FACTION}: ${Number(this.ashenReputation.toFixed(1))}`;
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
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "inventory-cell inventory-cell--filled trader-cell";
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
    cell.setAttribute(
      "aria-label",
      `${def?.name ?? opts.id}${opts.quantity > 1 ? ` ×${opts.quantity}` : ""}`,
    );

    cell.addEventListener("click", () => {
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
      this.render();
    });
    return cell;
  }

  private updateDetail() {
    this.detailEl.replaceChildren();
    if (!this.selection && !this.hasOffer()) {
      this.footerEl.hidden = true;
      this.detailEl.textContent = "";
      return;
    }
    this.footerEl.hidden = false;
    if (!this.selection) {
      this.detailEl.textContent = "Review your offer";
      return;
    }
    const def = getItemDefinition(this.selection.id);
    const name = def?.name ?? this.selection.id;
    this.detailEl.textContent =
      this.selection.quantity > 1
        ? `${name} ×${this.selection.quantity}`
        : name;
  }

  private updateSettlement() {
    if (!this.hasOffer()) {
      this.settlementEl.hidden = true;
      this.settlementEl.replaceChildren();
      this.settlementEl.classList.remove("trader-settlement--shortfall");
      this.clearOfferBtn.hidden = true;
      this.confirmBtn.hidden = true;
      this.confirmBtn.disabled = true;
      return;
    }

    const sells = [...this.sellOffers.values()];
    const buys = [...this.buyOffers.values()];
    const { sellTotal, buyTotal, net } = tradeOfferTotals(
      sells,
      buys,
      this.ashenReputation,
      this.barterT,
    );
    const cash = tradeOfferCashSettlement(
      net,
      this.traderBanknotes,
      this.playerBanknotes,
    );
    const fits = tradeOfferFitsTraderStock(this.stock, sells, buys);
    const repGain =
      buyTotal * ASHEN_REP_PER_DOLLAR_GIVEN +
      sellTotal * ASHEN_REP_PER_DOLLAR_TAKEN +
      cash.shortfall * ASHEN_REP_PER_DOLLAR_TAKEN;

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

    this.clearOfferBtn.hidden = false;
    this.clearOfferBtn.disabled = this.confirmPending;
    this.confirmBtn.hidden = false;
    this.confirmBtn.disabled =
      !cash.playerCanAfford || !fits || this.confirmPending;
    this.confirmBtn.title = this.confirmPending
      ? "Confirming…"
      : !fits
        ? "Trader can't carry that much"
        : cash.playerCanAfford
          ? ""
          : "Not enough banknotes";
  }

  private updateActionButtons() {
    const sell = this.selection?.side === "player";
    const buy = this.selection?.side === "trader";
    this.sellBtn.hidden = !sell;
    this.sell5Btn.hidden = !sell;
    this.sell10Btn.hidden = !sell;
    this.buyBtn.hidden = !buy;
    this.buy5Btn.hidden = !buy;
    this.buy10Btn.hidden = !buy;

    if (sell && this.selection?.side === "player") {
      const remaining =
        this.selection.quantity - this.offeredSellQty(this.selection.slotIndex);
      this.sellBtn.disabled = remaining < 1;
      this.sell5Btn.disabled = remaining < 5;
      this.sell10Btn.disabled = remaining < 10;
    }
    if (buy && this.selection?.side === "trader") {
      const remaining =
        this.selection.quantity - this.offeredBuyQty(this.selection.stockIndex);
      this.buyBtn.disabled = remaining < 1;
      this.buy5Btn.disabled = remaining < 5;
      this.buy10Btn.disabled = remaining < 10;
    }
  }

  private addToOffer(quantity: number) {
    if (!this.selection || quantity <= 0) return;
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
    this.handlers.onConfirm(sells, buys);
  }
}
