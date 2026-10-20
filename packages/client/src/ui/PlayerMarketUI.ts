import {
  ASHEN_REP_START,
  countItemInInventory,
  marketSalePayout,
  parseInventory,
  traderSellPriceRange,
  getItemDefinition,
  isMarketListableSlot,
  MARKET_LISTING_MS,
  MARKET_PRICE_MAX,
  wornGearEffectHint,
  type MarketDeskWire,
  type MarketListingWire,
  type MarketStatePayload,
} from "@zombie/shared";
import { createDialogCloseButton } from "./dialogCloseBtn";
import { appendItemIcon } from "./itemIcons";
import { resetDialogScroll } from "./dialogScroll";
import { usePhoneDialogSheet } from "./phoneDialog";
import {
  chip,
  createSheet,
  createStepper,
  drawerHead,
  filterChips,
  kvCard,
  markSheetOpen,
  money,
  openDrawer,
  renderTabs,
  sectionLabel,
  sheetButton,
  sheetRow,
  showSheetMessage,
  type Drawer,
  type KvRow,
  type Sheet,
} from "./mobileSheet";
import "./mobile/market.css";

function eachPrice(price: number, quantity: number): string {
  const each = price / Math.max(1, quantity);
  return Number.isInteger(each) ? `$${each}` : `$${each.toFixed(2)}`;
}

function traderRangeText(itemId: string): string {
  const range = traderSellPriceRange(itemId);
  return range.low === range.high ? `$${range.low}` : `$${range.low} - $${range.high}`;
}

export type PlayerMarketUIHandlers = {
  onClose: () => void;
  onList: (listing: {
    slotIndex: number;
    itemId: string;
    quantity: number;
    price: number;
  }) => void;
  onBuy: (listingId: number) => void;
  onCancel: (listingId: number) => void;
  onCollect: () => void;
  onCollectPayout: (listingId: number) => void;
  onCollectExpired: (listingId: number) => void;
  onBrowse: (browse: { page: number; sort: "new" | "cheap"; query: string }) => void;
};

function readListings(json: string): MarketListingWire[] {
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((row) => row && typeof row === "object") as MarketListingWire[];
  } catch {
    return [];
  }
}

function readDesk(json: string): MarketDeskWire {
  const empty: MarketDeskWire = {
    banknotes: 0,
    returns: [],
    listingCap: 0,
    activeCount: 0,
    feePercent: 10,
  };
  try {
    const parsed = JSON.parse(json) as Partial<MarketDeskWire> | null;
    if (!parsed || typeof parsed !== "object") return empty;
    return {
      banknotes: typeof parsed.banknotes === "number" ? parsed.banknotes : 0,
      returns: Array.isArray(parsed.returns) ? parsed.returns : [],
      listingCap: typeof parsed.listingCap === "number" ? parsed.listingCap : 0,
      activeCount: typeof parsed.activeCount === "number" ? parsed.activeCount : 0,
      feePercent: typeof parsed.feePercent === "number" ? parsed.feePercent : 10,
    };
  } catch {
    return empty;
  }
}

function listingTitle(itemId: string, condition: number, durability?: number): string {
  const name = getItemDefinition(itemId)?.name ?? itemId;
  const parts = [name];
  if (condition < 100) parts.push(`${condition}%`);
  if (durability != null) parts.push(`${durability} uses`);
  return parts.join(", ");
}

function itemLabel(itemId: string, quantity: number, condition: number, durability?: number): string {
  const name = getItemDefinition(itemId)?.name ?? itemId;
  const parts = [quantity > 1 ? `${name} x${quantity}` : name];
  if (condition < 100) parts.push(`${condition}%`);
  if (durability != null) parts.push(`${durability} uses`);
  return parts.join(", ");
}

function listingFee(price: number, payout: number): number {
  if (!Number.isInteger(price) || !Number.isInteger(payout)) return 0;
  return Math.max(0, price - payout);
}

function bindPositiveInteger(input: HTMLInputElement, onChange: () => void) {
  input.addEventListener("keydown", (event) => {
    if (event.key === "-" || event.key === "+" || event.key === "e" || event.key === "E") {
      event.preventDefault();
    }
  });
  input.addEventListener("beforeinput", (event) => {
    if (event.data?.includes("-") || event.data?.includes("+")) event.preventDefault();
  });
  input.addEventListener("input", () => {
    const cleaned = input.value.replace(/-/g, "");
    if (cleaned !== input.value) input.value = cleaned;
    const n = Number(input.value);
    if (input.value !== "" && Number.isFinite(n) && n < 1) input.value = "1";
    onChange();
  });
}

function listingIsExpired(listing: MarketListingWire, now: number): boolean {
  if (listing.awaitingPayout) return false;
  if (listing.expired) return true;
  return listing.expiresAt <= now;
}

function timeLeft(expiresAt: number, now: number): string {
  const ms = expiresAt - now;
  if (ms <= 0) return "Expired";
  const mins = Math.max(1, Math.ceil(ms / 60000));
  if (mins < 60) return `${mins}m left`;
  const hours = Math.floor(mins / 60);
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return remHours > 0 ? `${days}d ${remHours}h left` : `${days}d left`;
  }
  const rem = mins % 60;
  return rem > 0 ? `${hours}h ${rem}m left` : `${hours}h left`;
}

export class PlayerMarketUI {
  private visible = false;
  private traderId = "";
  private busy = false;
  /** Sold ad hidden locally until this payout collect is settled. */
  private pendingPayoutId: number | null = null;
  /** True after the listing form has been shown, so a refresh can keep the draft. */
  private formLive = false;
  private ashenReputation = ASHEN_REP_START;
  private inventoryJson = "[]";
  private equippedInventorySlot = -1;
  private listings: MarketListingWire[] = [];
  private lastPayload: MarketStatePayload | null = null;
  private busyTimer = 0;
  private expiryTimer = 0;
  private desk: MarketDeskWire = {
    banknotes: 0,
    returns: [],
    listingCap: 1,
    activeCount: 0,
    feePercent: 10,
  };

  private overlay: HTMLElement;
  private boardNotesEl: HTMLElement;
  private boardEl: HTMLElement;
  private deskEl: HTMLElement;
  private formEl: HTMLElement;
  private mineEl: HTMLElement;
  private selectedIndex = -1;
  private expandedBoardId: number | null = null;
  private expandedMineId: number | null = null;
  private boardQuery = "";
  private appliedQuery = "";
  private boardPage = 0;
  private boardPages = 0;
  private boardSort: "new" | "cheap" = "new";
  private boardViewKey = "";
  private formKey = "";
  private mineKey = "";
  private browseTimer = 0;
  private boardSearch: HTMLInputElement;
  private sortNewBtn: HTMLButtonElement;
  private sortCheapBtn: HTMLButtonElement;
  private pagerEl: HTMLElement;
  private pagePrev: HTMLButtonElement;
  private pageNext: HTMLButtonElement;
  private pageLabel: HTMLElement;
  private pickAbort = new AbortController();
  private qtyInput: HTMLInputElement;
  private priceInput: HTMLInputElement;
  private hintEl: HTMLElement;
  private layoutEl: HTMLElement;
  private ms: Sheet | null = null;
  private msOn = false;
  private msTab: "browse" | "sell" | "mine" = "browse";
  private msDrawer: Drawer | null = null;
  private msSearch: HTMLInputElement | null = null;
  private msList: HTMLElement | null = null;
  /** Board pages loaded so far on a phone, so the list grows as you scroll. */
  private msPages = new Map<number, MarketListingWire[]>();
  private msPagesKey = "";
  private msLoadingPage = -1;
  /** Ads with a Collect already sent, hidden until the server drops them. */
  private msCollecting = new Set<number>();
  private msSellQty = 1;
  private msSellEach = 1;
  private msSellKey = "";
  private msListPending: number | null = null;

  constructor(private handlers: PlayerMarketUIHandlers) {
    this.overlay = document.createElement("div");
    this.overlay.id = "market-overlay";
    this.overlay.hidden = true;

    const layout = document.createElement("div");
    layout.className = "trader-layout market-layout";
    this.layoutEl = layout;

    const toolbar = document.createElement("div");
    toolbar.className = "red-dialog-toolbar";
    toolbar.append(createDialogCloseButton(() => this.handlers.onClose()));

    const columns = document.createElement("div");
    columns.className = "market-columns";

    const boardPanel = document.createElement("div");
    boardPanel.className = "inventory-panel trader-panel market-panel";
    const boardHeader = document.createElement("div");
    boardHeader.className = "inventory-header trader-panel-header";
    const boardTitleWrap = document.createElement("div");
    boardTitleWrap.className = "trader-panel-header-text";
    const boardTitle = document.createElement("h2");
    boardTitle.className = "inventory-title";
    boardTitle.textContent = "Survivor ads";
    const boardHint = document.createElement("span");
    boardHint.className = "inventory-hint";
    boardHint.textContent = "Items for sale by other survivors";
    boardTitleWrap.append(boardTitle, boardHint);
    this.boardNotesEl = document.createElement("div");
    this.boardNotesEl.className = "trader-notes-pill";
    this.boardNotesEl.textContent = "$0";
    this.boardNotesEl.setAttribute("aria-label", "0 banknotes");
    boardHeader.append(boardTitleWrap, this.boardNotesEl);
    this.boardSearch = document.createElement("input");
    this.boardSearch.type = "search";
    this.boardSearch.className = "market-board-search";
    this.boardSearch.placeholder = "Search items";
    this.boardSearch.autocomplete = "off";
    this.boardSearch.spellcheck = false;
    this.boardSearch.setAttribute("aria-label", "Search survivor ads");
    this.boardSearch.addEventListener("input", () => {
      this.boardQuery = this.boardSearch.value;
      window.clearTimeout(this.browseTimer);
      this.browseTimer = window.setTimeout(() => this.requestBoard(0), 200);
    });
    const sortRow = document.createElement("div");
    sortRow.className = "market-board-sort";
    this.sortNewBtn = document.createElement("button");
    this.sortNewBtn.type = "button";
    this.sortNewBtn.className = "market-sort";
    this.sortNewBtn.textContent = "Newest";
    this.sortNewBtn.title = "Most recently listed";
    this.sortCheapBtn = document.createElement("button");
    this.sortCheapBtn.type = "button";
    this.sortCheapBtn.className = "market-sort";
    this.sortCheapBtn.textContent = "Cheapest each";
    this.sortCheapBtn.title = "Lowest price for one item";
    this.sortNewBtn.addEventListener("click", () => this.setBoardSort("new"));
    this.sortCheapBtn.addEventListener("click", () => this.setBoardSort("cheap"));
    sortRow.append(this.sortNewBtn, this.sortCheapBtn);
    this.pagerEl = document.createElement("div");
    this.pagerEl.className = "market-pager";
    this.pagePrev = document.createElement("button");
    this.pagePrev.type = "button";
    this.pagePrev.className = "market-action";
    this.pagePrev.textContent = "Prev";
    this.pageLabel = document.createElement("span");
    this.pageLabel.className = "market-page-label";
    this.pageNext = document.createElement("button");
    this.pageNext.type = "button";
    this.pageNext.className = "market-action";
    this.pageNext.textContent = "Next";
    this.pagePrev.addEventListener("click", () => {
      if (this.boardPage <= 0) return;
      this.requestBoard(this.boardPage - 1);
    });
    this.pageNext.addEventListener("click", () => {
      if (this.boardPage + 1 >= this.boardPages) return;
      this.requestBoard(this.boardPage + 1);
    });
    this.pagerEl.append(this.pagePrev, this.pageLabel, this.pageNext);
    this.boardEl = document.createElement("div");
    this.boardEl.className = "market-scroll";
    boardPanel.append(boardHeader, this.boardSearch, sortRow, this.boardEl, this.pagerEl);

    const yoursPanel = document.createElement("div");
    yoursPanel.className = "inventory-panel trader-panel market-panel";
    const yoursHeader = document.createElement("div");
    yoursHeader.className = "inventory-header";
    const yoursTitle = document.createElement("h2");
    yoursTitle.className = "inventory-title";
    yoursTitle.textContent = "Your ads";
    const yoursHint = document.createElement("span");
    yoursHint.className = "inventory-hint";
    yoursHint.textContent = "Your listings, payouts, and expired ads";
    yoursHeader.append(yoursTitle, yoursHint);
    this.deskEl = document.createElement("div");
    this.deskEl.className = "market-desk";
    this.formEl = document.createElement("div");
    this.formEl.className = "market-form";
    this.mineEl = document.createElement("div");
    this.mineEl.className = "market-scroll market-scroll--mine";

    this.qtyInput = document.createElement("input");
    this.qtyInput.type = "number";
    this.qtyInput.min = "1";
    this.qtyInput.step = "1";
    this.priceInput = document.createElement("input");
    this.priceInput.type = "number";
    this.priceInput.min = "1";
    this.priceInput.step = "1";
    this.priceInput.placeholder = "Banknotes";
    this.hintEl = document.createElement("div");
    this.hintEl.className = "market-hint";

    const body = document.createElement("div");
    body.className = "market-yours-body";
    body.append(this.deskEl, this.formEl, this.mineEl);
    yoursPanel.append(yoursHeader, body);

    columns.append(boardPanel, yoursPanel);
    layout.append(toolbar, columns);
    this.overlay.appendChild(layout);
    this.overlay.addEventListener("click", (event) => {
      if (this.msOn) return;
      if (event.target === this.overlay) this.handlers.onClose();
    });
    document.body.appendChild(this.overlay);
  }

  isOpen() {
    return this.visible;
  }

  getTraderId() {
    return this.traderId;
  }

  open(payload: MarketStatePayload) {
    this.traderId = payload.traderId;
    this.visible = true;
    this.busy = false;
    this.pendingPayoutId = null;
    this.formLive = false;
    this.boardQuery = "";
    this.appliedQuery = "";
    this.boardPage = 0;
    this.boardPages = 0;
    this.boardSort = "new";
    this.boardViewKey = "";
    this.formKey = "";
    this.mineKey = "";
    this.boardSearch.value = "";
    this.msTab = "browse";
    this.msPages.clear();
    this.msPagesKey = "";
    this.msLoadingPage = -1;
    this.msCollecting.clear();
    this.msSellKey = "";
    this.msListPending = null;
    if (this.msSearch) this.msSearch.value = "";
    if (this.ms) showSheetMessage(this.ms.snackSlot, "");
    this.overlay.hidden = false;
    this.overlay.classList.remove("dialog-overflows");
    document.body.classList.add("market-open");
    this.apply(payload);
    this.overlay.scrollTop = 0;
    resetDialogScroll(this.overlay);
  }

  sync(payload: MarketStatePayload) {
    if (!this.visible || payload.traderId !== this.traderId) return;
    if (!this.collectInFlight() || this.snapshotSettlesCollect(payload)) {
      this.busy = false;
    }
    this.apply(payload);
  }

  close() {
    this.visible = false;
    this.busy = false;
    this.pendingPayoutId = null;
    this.formLive = false;
    this.pickAbort.abort();
    this.pickAbort = new AbortController();
    this.expandedBoardId = null;
    this.expandedMineId = null;
    this.boardQuery = "";
    this.appliedQuery = "";
    this.boardSearch.value = "";
    this.formKey = "";
    this.mineKey = "";
    window.clearTimeout(this.browseTimer);
    window.clearTimeout(this.busyTimer);
    window.clearTimeout(this.expiryTimer);
    this.overlay.hidden = true;
    this.overlay.classList.remove("dialog-overflows", "ms-host");
    document.body.classList.remove("market-open");
    this.msCloseDrawer();
    markSheetOpen("market", false);
    this.traderId = "";
  }

  destroy() {
    this.close();
    this.overlay.remove();
  }

  private collectInFlight(): boolean {
    return this.pendingPayoutId != null;
  }

  /** True when this snapshot is the server's answer to the payout collect in flight. */
  private snapshotSettlesCollect(payload: MarketStatePayload): boolean {
    return (
      this.pendingPayoutId != null && payload.settledListingId === this.pendingPayoutId
    );
  }

  private markBusy() {
    this.busy = true;
    window.clearTimeout(this.busyTimer);
    this.busyTimer = window.setTimeout(() => {
      if (!this.busy || !this.visible || !this.lastPayload) return;
      this.busy = false;
      this.pendingPayoutId = null;
      this.apply(this.lastPayload);
    }, 2000);
  }

  /** Drop a sold or expired ad from Your ads as soon as Collect is pressed. */
  private beginPayoutCollect(listingId: number) {
    const listing = this.listings.find((row) => row.id === listingId && row.yours);
    this.pendingPayoutId = listingId;
    if (this.expandedMineId === listingId) this.expandedMineId = null;
    if (listing) {
      this.desk = {
        ...this.desk,
        activeCount: Math.max(0, this.desk.activeCount - 1),
      };
      this.paintListingCap();
      this.refreshHint();
    }
    this.mineKey = `${this.yoursMineKey()}|${listingId}`;
    this.renderMine();
  }

  private yoursMineKey(): string {
    const now = Date.now();
    return this.listings
      .filter((listing) => listing.yours)
      .map((listing) => {
        const expired = listingIsExpired(listing, now) ? 1 : 0;
        return `${listing.id}:${listing.awaitingPayout ? 1 : 0}:${expired}:${listing.price}:${listing.expiresAt}`;
      })
      .join("|");
  }

  /** Flip an ad to Expired as soon as its clock runs out, without waiting for a sync. */
  private armExpiryRefresh() {
    window.clearTimeout(this.expiryTimer);
    if (!this.visible) return;
    const now = Date.now();
    let next = Infinity;
    for (const listing of this.listings) {
      if (listing.awaitingPayout || listing.expired) continue;
      if (listing.expiresAt > now && listing.expiresAt < next) next = listing.expiresAt;
    }
    if (!Number.isFinite(next)) return;
    const delay = Math.min(Math.max(250, next - now + 50), 2_147_000_000);
    this.expiryTimer = window.setTimeout(() => {
      if (!this.visible) return;
      if (this.msOn) this.msRender();
      else {
        this.renderMine();
        this.renderBoard();
      }
      this.armExpiryRefresh();
    }, delay);
  }

  private paintListingCap() {
    const cap = this.formEl.querySelector(".market-cap");
    if (cap) {
      cap.textContent = `You have posted ${this.desk.activeCount}/${this.desk.listingCap} ads`;
    }
    const listBtn = this.formEl.querySelector("button.market-action");
    if (listBtn instanceof HTMLButtonElement) {
      const full = this.desk.activeCount >= this.desk.listingCap;
      listBtn.disabled = this.busy || full || !this.selectedSlot();
    }
  }

  private apply(payload: MarketStatePayload) {
    const settles = this.snapshotSettlesCollect(payload);
    if (!this.collectInFlight() || settles) {
      window.clearTimeout(this.busyTimer);
    }
    if (settles) this.pendingPayoutId = null;
    this.lastPayload = payload;
    this.ashenReputation = payload.ashenReputation ?? ASHEN_REP_START;
    this.inventoryJson = payload.inventoryJson;
    this.equippedInventorySlot = payload.equippedInventorySlot;
    this.listings = readListings(payload.listingsJson);
    this.desk = readDesk(payload.deskJson);
    if (this.pendingPayoutId != null) {
      this.desk = {
        ...this.desk,
        activeCount: Math.max(0, this.desk.activeCount - 1),
      };
    }
    const carried = countItemInInventory(parseInventory(this.inventoryJson), "banknote");
    this.boardNotesEl.textContent = `$${carried}`;
    this.boardNotesEl.setAttribute("aria-label", `${carried} banknotes`);
    this.boardPage = payload.boardPage ?? 0;
    this.boardPages = payload.boardPages ?? 0;
    this.boardSort = payload.boardSort === "cheap" ? "cheap" : "new";
    this.appliedQuery = payload.boardQuery ?? "";
    this.msOn = usePhoneDialogSheet();
    this.overlay.classList.toggle("ms-host", this.msOn);
    this.layoutEl.hidden = this.msOn;
    if (this.ms) this.ms.root.hidden = !this.msOn;
    markSheetOpen("market", this.visible && this.msOn);
    if (this.msOn) {
      this.msApply(payload);
      return;
    }
    this.msCloseDrawer();
    const formKey = `${payload.inventoryJson}|${payload.equippedInventorySlot}|${payload.deskJson}|${payload.ashenReputation}`;
    const displayKey = `${this.yoursMineKey()}|${this.pendingPayoutId ?? ""}`;
    if (this.formKey !== formKey) {
      this.formKey = formKey;
      this.renderDesk();
      this.renderForm(this.formLive);
      this.formLive = true;
    } else {
      const nextCap = `You have posted ${this.desk.activeCount}/${this.desk.listingCap} ads`;
      const cap = this.formEl.querySelector(".market-cap");
      if (!cap || cap.textContent !== nextCap) {
        this.paintListingCap();
        this.refreshHint();
      }
    }
    if (this.mineKey !== displayKey) {
      this.mineKey = displayKey;
      this.renderMine();
    }
    this.renderBoard();
    this.updateBoardChrome();
    this.armExpiryRefresh();
    this.pinOverlayIfNeeded();
  }

  private setBoardSort(sort: "new" | "cheap") {
    if (this.boardSort === sort) return;
    this.boardSort = sort;
    window.clearTimeout(this.browseTimer);
    this.requestBoard(0);
  }

  private requestBoard(page: number) {
    this.boardPage = Math.max(0, page);
    this.updateBoardChrome();
    this.handlers.onBrowse({
      page: this.boardPage,
      sort: this.boardSort,
      query: this.boardQuery.trim().slice(0, 40),
    });
  }

  private updateBoardChrome() {
    this.sortNewBtn.classList.toggle("market-sort--on", this.boardSort === "new");
    this.sortCheapBtn.classList.toggle("market-sort--on", this.boardSort === "cheap");
    this.sortNewBtn.setAttribute("aria-pressed", this.boardSort === "new" ? "true" : "false");
    this.sortCheapBtn.setAttribute("aria-pressed", this.boardSort === "cheap" ? "true" : "false");
    const showPages = this.boardPages > 1;
    this.pagerEl.hidden = !showPages;
    this.pagePrev.disabled = this.boardPage <= 0;
    this.pageNext.disabled = this.boardPage + 1 >= this.boardPages;
    this.pageLabel.textContent = showPages ? `Page ${this.boardPage + 1} of ${this.boardPages}` : "";
  }

  private listableSlots(): {
    index: number;
    itemId: string;
    quantity: number;
    condition: number;
    durability?: number;
  }[] {
    const inventory = parseInventory(this.inventoryJson);
    const rows: {
      index: number;
      itemId: string;
      quantity: number;
      condition: number;
      durability?: number;
    }[] = [];
    for (let i = 0; i < inventory.length; i++) {
      if (!isMarketListableSlot(inventory, i, this.equippedInventorySlot)) continue;
      const slot = inventory[i];
      if (!slot) continue;
      rows.push({
        index: i,
        itemId: slot.id,
        quantity: slot.quantity,
        condition: slot.condition ?? 100,
        durability: slot.durability,
      });
    }
    return rows;
  }

  private ensureSelection() {
    const rows = this.listableSlots();
    if (!rows.some((row) => row.index === this.selectedIndex)) {
      this.selectedIndex = rows[0]?.index ?? -1;
    }
  }

  private selectedSlot(): { index: number; itemId: string; quantity: number } | null {
    const row = this.listableSlots().find((entry) => entry.index === this.selectedIndex);
    if (!row) return null;
    return { index: row.index, itemId: row.itemId, quantity: row.quantity };
  }

  private fillPickFace(
    el: HTMLElement,
    row: {
      itemId: string;
      quantity: number;
      condition: number;
      durability?: number;
    } | null,
    caret: boolean,
  ) {
    el.replaceChildren();
    if (!row) {
      const text = document.createElement("span");
      text.className = "market-pick-label";
      text.textContent = "Nothing you can list";
      el.append(text);
      return;
    }
    const iconWrap = document.createElement("span");
    iconWrap.className = "market-pick-icon-wrap";
    appendItemIcon(iconWrap, row.itemId, "market-pick-icon");
    const text = document.createElement("span");
    text.className = "market-pick-label";
    text.textContent = itemLabel(row.itemId, row.quantity, row.condition, row.durability);
    el.append(iconWrap, text);
    if (caret) {
      const mark = document.createElement("span");
      mark.className = "market-pick-caret";
      mark.textContent = "▾";
      el.append(mark);
    }
  }

  private renderDesk() {
    this.deskEl.replaceChildren();
    const hasNotes = this.desk.banknotes > 0;
    const hasReturns = this.desk.returns.length > 0;
    if (!hasNotes && !hasReturns) return;

    if (hasNotes) {
      const notes = document.createElement("p");
      notes.className = "market-desk-notes";
      notes.textContent = `${this.desk.banknotes} banknotes waiting`;
      this.deskEl.append(notes);
    }
    const collect = document.createElement("button");
    collect.type = "button";
    collect.className = "market-action";
    collect.textContent = "Collect";
    collect.disabled = this.busy;
    collect.addEventListener("click", () => {
      if (this.busy) return;
      this.markBusy();
      this.handlers.onCollect();
    });
    this.deskEl.append(collect);
    if (!hasReturns) return;
    const heading = document.createElement("p");
    heading.className = "market-desk-returns";
    heading.textContent = "Returns waiting";
    this.deskEl.append(heading);
    for (const row of this.desk.returns) {
      const line = document.createElement("p");
      line.className = "market-desk-return";
      line.textContent = itemLabel(row.itemId, row.quantity, row.condition, row.durability);
      this.deskEl.append(line);
    }
  }

  private renderForm(keepDraft = false) {
    const draftPrice = keepDraft && this.priceInput ? this.priceInput.value : "";
    const draftQty = keepDraft && this.qtyInput ? this.qtyInput.value : "";
    this.pickAbort.abort();
    this.pickAbort = new AbortController();
    const signal = this.pickAbort.signal;
    this.ensureSelection();
    const rows = this.listableSlots();
    const selected = rows.find((row) => row.index === this.selectedIndex) ?? null;

    this.formEl.replaceChildren();
    const cap = document.createElement("p");
    cap.className = "market-cap";
    cap.textContent = `You have posted ${this.desk.activeCount}/${this.desk.listingCap} ads`;

    const slotField = document.createElement("div");
    slotField.className = "market-field";
    const slotName = document.createElement("span");
    slotName.textContent = "Item";
    const picker = document.createElement("div");
    picker.className = "market-pick";
    const current = document.createElement("button");
    current.type = "button";
    current.className = "market-pick-current";
    current.setAttribute("aria-expanded", "false");
    this.fillPickFace(current, selected, rows.length > 0);
    const list = document.createElement("div");
    list.className = "market-pick-list";
    list.hidden = true;

    const placeList = () => {
      const rect = current.getBoundingClientRect();
      const gap = 4;
      const below = window.innerHeight - rect.bottom - gap - 12;
      const above = rect.top - gap - 12;
      const openUp = below < 160 && above > below;
      list.style.left = `${rect.left}px`;
      list.style.width = `${rect.width}px`;
      list.style.maxHeight = `${Math.max(96, Math.min(240, openUp ? above : below))}px`;
      if (openUp) {
        list.style.top = "auto";
        list.style.bottom = `${window.innerHeight - rect.top + gap}px`;
      } else {
        list.style.bottom = "auto";
        list.style.top = `${rect.bottom + gap}px`;
      }
    };

    const setOpen = (open: boolean) => {
      list.hidden = !open;
      current.classList.toggle("market-pick-current--open", open);
      current.setAttribute("aria-expanded", open ? "true" : "false");
      if (open) placeList();
    };

    if (rows.length === 0) {
      current.disabled = true;
    } else {
      current.addEventListener("click", () => setOpen(list.hidden));
      for (const row of rows) {
        const option = document.createElement("button");
        option.type = "button";
        option.className = "market-pick-option";
        if (row.index === this.selectedIndex) {
          option.classList.add("market-pick-option--active");
        }
        this.fillPickFace(option, row, false);
        option.addEventListener("click", () => {
          this.selectedIndex = row.index;
          for (const child of list.children) {
            child.classList.toggle(
              "market-pick-option--active",
              child === option,
            );
          }
          this.fillPickFace(current, row, true);
          this.qtyInput.max = String(row.quantity);
          this.qtyInput.value = String(row.quantity);
          setOpen(false);
          this.refreshHint();
        });
        list.append(option);
      }
      document.addEventListener(
        "pointerdown",
        (event) => {
          if (list.hidden) return;
          const target = event.target;
          if (
            target instanceof Node &&
            (picker.contains(target) || list.contains(target))
          ) {
            return;
          }
          setOpen(false);
        },
        { signal, capture: true },
      );
      document.addEventListener(
        "keydown",
        (event) => {
          if (event.key !== "Escape" || list.hidden) return;
          setOpen(false);
          event.preventDefault();
          event.stopPropagation();
        },
        { signal, capture: true },
      );
      const scrollParent = this.formEl.closest(".market-yours-body");
      const placeIfOpen = () => {
        if (!list.hidden) placeList();
      };
      scrollParent?.addEventListener("scroll", placeIfOpen, { signal });
      this.overlay.addEventListener("scroll", placeIfOpen, { signal });
      window.addEventListener("resize", () => {
        if (!list.hidden) placeList();
      }, { signal });
    }
    document.body.append(list);
    signal.addEventListener("abort", () => list.remove());
    picker.append(current);
    slotField.append(slotName, picker);

    const qtyLabel = document.createElement("label");
    qtyLabel.textContent = "Quantity";
    this.qtyInput = document.createElement("input");
    this.qtyInput.type = "number";
    this.qtyInput.min = "1";
    this.qtyInput.step = "1";
    qtyLabel.append(this.qtyInput);

    const priceLabel = document.createElement("label");
    priceLabel.textContent = "Price for this listing";
    this.priceInput = document.createElement("input");
    this.priceInput.type = "number";
    this.priceInput.min = "1";
    this.priceInput.step = "1";
    this.priceInput.placeholder = "Banknotes";
    priceLabel.append(this.priceInput);

    this.hintEl = document.createElement("div");
    this.hintEl.className = "market-hint";

    const listBtn = document.createElement("button");
    listBtn.type = "button";
    listBtn.className = "market-action";
    listBtn.textContent = "List it";
    const full = this.desk.activeCount >= this.desk.listingCap;
    listBtn.disabled = this.busy || full || !selected;
    listBtn.addEventListener("click", () => this.submitList());

    const refreshHint = () => this.refreshHint();
    bindPositiveInteger(this.qtyInput, () => {
      const row = this.selectedSlot();
      const raw = Number(this.qtyInput.value);
      if (row && Number.isInteger(raw) && raw > row.quantity) {
        this.qtyInput.value = String(row.quantity);
      }
      refreshHint();
    });
    bindPositiveInteger(this.priceInput, refreshHint);

    if (selected) {
      this.qtyInput.max = String(selected.quantity);
      this.qtyInput.value = String(selected.quantity);
    }
    if (keepDraft && selected && draftQty !== "") {
      const n = Number(draftQty);
      if (Number.isInteger(n) && n >= 1) {
        this.qtyInput.value = String(Math.min(n, selected.quantity));
      }
    }
    if (keepDraft && draftPrice !== "") this.priceInput.value = draftPrice;
    this.formEl.append(cap, slotField, qtyLabel, priceLabel, this.hintEl, listBtn);
    this.refreshHint();
  }

  private refreshHint() {
    const selected = this.selectedSlot();
    if (!selected) {
      this.hintEl.textContent = this.desk.activeCount >= this.desk.listingCap
        ? "Collect a sold or expired ad, or cancel one, before posting another."
        : "Banknotes, worn clothes, and the weapon in your hands stay off the board.";
      return;
    }
    const traderLine = document.createElement("div");
    traderLine.textContent = `Trader sells for ${traderRangeText(selected.itemId)}`;
    this.hintEl.replaceChildren(traderLine);
    const price = Number(this.priceInput.value);
    if (Number.isInteger(price) && price >= 1) {
      const fee = document.createElement("div");
      fee.className = "market-fee";
      const cut = price - marketSalePayout(price, this.ashenReputation);
      fee.textContent = `Fee on sale is $${Math.max(0, cut)} (${this.desk.feePercent}%)`;
      this.hintEl.append(fee);
    }
  }

  private submitList() {
    if (this.busy) return;
    const selected = this.selectedSlot();
    if (!selected) return;
    let quantity = Number(this.qtyInput.value);
    const price = Number(this.priceInput.value);
    if (!Number.isInteger(quantity) || quantity < 1) return;
    if (quantity > selected.quantity) {
      quantity = selected.quantity;
      this.qtyInput.value = String(quantity);
    }
    if (!Number.isInteger(price) || price < 1) return;
    this.markBusy();
    this.handlers.onList({
      slotIndex: selected.index,
      itemId: selected.itemId,
      quantity,
      price,
    });
  }

  private renderMine() {
    const now = Date.now();
    const scrollTop = this.mineEl.scrollTop;
    this.mineEl.replaceChildren();
    const mine = this.listings.filter(
      (listing) => listing.id !== this.pendingPayoutId && listing.yours,
    );
    mine.sort((a, b) => {
      const rank = (row: MarketListingWire) =>
        row.awaitingPayout ? 0 : listingIsExpired(row, now) ? 1 : 2;
      return rank(a) - rank(b) || a.id - b.id;
    });
    if (mine.length === 0) {
      const empty = document.createElement("p");
      empty.className = "market-empty";
      empty.textContent = "You have nothing listed.";
      this.mineEl.append(empty);
      return;
    }
    for (const listing of mine) {
      this.mineEl.append(this.listingCard(listing, now, "mine"));
    }
    this.mineEl.scrollTop = scrollTop;
    this.revealExpanded(this.mineEl);
  }

  /**
   * On a phone the overlay is the scroller, so a tall sheet gets pinned to
   * the top instead of staying centered and clipped.
   */
  private pinOverlayIfNeeded() {
    const overlay = this.overlay;
    requestAnimationFrame(() => {
      if (!this.visible) return;
      if (overlay.scrollHeight > overlay.clientHeight + 1) {
        overlay.classList.add("dialog-overflows");
      }
    });
  }

  /** Keep an open ad, including its action button, inside the scrolling list. */
  private revealExpanded(container: HTMLElement) {
    const row = container.querySelector(".market-row--expanded");
    const scroller = row instanceof HTMLElement ? this.scrollingAncestor(container) : null;
    if (!(row instanceof HTMLElement) || !scroller || scroller.clientHeight <= 0) return;
    const rowBox = row.getBoundingClientRect();
    const view = scroller.getBoundingClientRect();
    const target = scroller;
    if (rowBox.height >= view.height) {
      target.scrollTop += rowBox.bottom - view.bottom;
      return;
    }
    if (rowBox.bottom > view.bottom) {
      target.scrollTop += rowBox.bottom - view.bottom;
    } else if (rowBox.top < view.top) {
      target.scrollTop -= view.top - rowBox.top;
    }
  }

  /** Inner list on a wide layout, otherwise the dialog itself. */
  private scrollingAncestor(start: HTMLElement): HTMLElement | null {
    let node: HTMLElement | null = start;
    while (node) {
      if (node.scrollHeight > node.clientHeight + 1) return node;
      if (node === this.overlay) break;
      node = node.parentElement;
    }
    return null;
  }

  private renderBoard() {
    const viewKey = `${this.boardPage}|${this.boardSort}|${this.appliedQuery}`;
    const reset = viewKey !== this.boardViewKey;
    this.boardViewKey = viewKey;
    const scrollTop = reset ? 0 : this.boardEl.scrollTop;
    this.boardEl.replaceChildren();
    const now = Date.now();
    const visible = this.listings.filter(
      (listing) =>
        listing.onBoard && !listing.awaitingPayout && !listing.expired && listing.expiresAt > now,
    );
    if (visible.length === 0) {
      const empty = document.createElement("p");
      empty.className = "market-empty";
      empty.textContent = this.appliedQuery.trim()
        ? "No ads match."
        : "Nothing is listed right now.";
      this.boardEl.append(empty);
      this.boardEl.scrollTop = 0;
      return;
    }
    for (const listing of visible) {
      this.boardEl.append(this.listingCard(listing, now, "board"));
    }
    this.boardEl.scrollTop = scrollTop;
  }

  private listingCard(
    listing: MarketListingWire,
    now: number,
    which: "board" | "mine",
  ): HTMLElement {
    const expandedId = which === "board" ? this.expandedBoardId : this.expandedMineId;
    const expanded = expandedId === listing.id;
    const onBoard = which === "board";
    const dimmed = onBoard && listing.yours;
    const expiredNow = !onBoard && listingIsExpired(listing, now);
    const name = listingTitle(listing.itemId, listing.condition, listing.durability);

    const row = document.createElement("div");
    row.className = dimmed ? "market-row market-row--yours" : "market-row";
    if (expanded) row.classList.add("market-row--expanded");

    const summary = document.createElement("button");
    summary.type = "button";
    summary.className = "market-row-summary";
    summary.setAttribute("aria-expanded", expanded ? "true" : "false");
    const stateLabel = listing.awaitingPayout ? ", sold" : expiredNow ? ", expired" : "";
    summary.setAttribute(
      "aria-label",
      `${expanded ? "Collapse" : "Expand"} ${name}, ×${listing.quantity}${stateLabel}, $${listing.price}`,
    );

    const icon = document.createElement("div");
    icon.className = "market-row-icon";
    appendItemIcon(icon, listing.itemId, "market-icon");

    const title = document.createElement("div");
    title.className = "market-row-name";
    title.textContent = name;

    const qty = document.createElement("span");
    qty.className = "market-row-qty";
    qty.textContent = `×${listing.quantity}`;

    const price = document.createElement("span");
    price.className = "market-row-price";
    price.textContent = `$${listing.price}`;

    const sold = document.createElement("span");
    sold.className = "market-row-sold";
    sold.textContent = "Sold";

    const expired = document.createElement("span");
    expired.className = "market-row-expired";
    expired.textContent = "Expired";

    const chevron = document.createElement("span");
    chevron.className = "market-row-chevron";
    chevron.setAttribute("aria-hidden", "true");
    chevron.textContent = expanded ? "▾" : "▸";

    if (!onBoard && listing.awaitingPayout) summary.append(icon, title, qty, sold, price, chevron);
    else if (expiredNow) summary.append(icon, title, qty, expired, price, chevron);
    else summary.append(icon, title, qty, price, chevron);
    summary.addEventListener("click", () => {
      if (which === "board") {
        this.expandedBoardId = expanded ? null : listing.id;
        this.renderBoard();
      } else {
        this.expandedMineId = expanded ? null : listing.id;
        this.renderMine();
      }
    });
    row.append(summary);
    if (!expanded) return row;

    const details = document.createElement("div");
    details.className = "market-row-details";
    if (onBoard) {
      const meta = document.createElement("div");
      meta.className = "market-row-meta";
      meta.textContent = timeLeft(listing.expiresAt, now);
      details.append(meta);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "market-action";
      button.textContent = dimmed ? "Yours" : "Buy";
      button.disabled = dimmed || this.busy;
      if (!dimmed) {
        button.addEventListener("click", () => {
          if (this.busy) return;
          this.markBusy();
          this.handlers.onBuy(listing.id);
        });
      }
      details.append(button);
    } else if (listing.awaitingPayout) {
      const line = document.createElement("div");
      line.className = "market-fee";
      line.textContent = `Collect $${listing.payout} (Fee $${listingFee(listing.price, listing.payout)})`;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "market-action";
      button.textContent = "Collect";
      button.disabled = this.busy;
      button.addEventListener("click", () => {
        if (this.busy) return;
        this.markBusy();
        this.beginPayoutCollect(listing.id);
        this.handlers.onCollectPayout(listing.id);
      });
      details.append(line, button);
    } else if (expiredNow) {
      const line = document.createElement("div");
      line.className = "market-fee";
      line.textContent = "This listing has expired.";
      const button = document.createElement("button");
      button.type = "button";
      button.className = "market-action";
      button.textContent = "Collect";
      button.disabled = this.busy;
      button.addEventListener("click", () => {
        if (this.busy) return;
        this.markBusy();
        this.beginPayoutCollect(listing.id);
        this.handlers.onCollectExpired(listing.id);
      });
      details.append(line, button);
    } else {
      const fee = document.createElement("div");
      fee.className = "market-fee";
      fee.textContent = `Fee on sale is $${listingFee(listing.price, listing.payout)} (${this.desk.feePercent}%)`;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "market-action";
      button.textContent = "Cancel";
      button.disabled = this.busy;
      button.addEventListener("click", () => {
        if (this.busy) return;
        this.markBusy();
        this.handlers.onCancel(listing.id);
      });
      details.append(fee, button);
    }
    row.append(details);
    return row;
  }

  // ── Phone sheet (design/mobile-dialogs board 07) ─────────────────────────

  private ensureMs(): Sheet {
    if (this.ms) return this.ms;
    const sheet = createSheet({ tone: "gold", onClose: () => this.handlers.onClose() });
    sheet.root.classList.add("market-ms");
    sheet.header.setTitle("Marketplace");
    const search = document.createElement("input");
    search.type = "search";
    search.className = "ms-search";
    search.placeholder = "Search items";
    search.autocomplete = "off";
    search.spellcheck = false;
    search.setAttribute("aria-label", "Search listings");
    search.addEventListener("input", () => {
      this.boardQuery = search.value;
      window.clearTimeout(this.browseTimer);
      this.browseTimer = window.setTimeout(() => this.requestBoard(0), 250);
    });
    this.msSearch = search;
    this.msList = document.createElement("div");
    sheet.body.addEventListener("scroll", () => this.msMaybeLoadMore(), { passive: true });
    this.overlay.append(sheet.root);
    this.ms = sheet;
    return sheet;
  }

  private msCloseDrawer(): void {
    const drawer = this.msDrawer;
    this.msDrawer = null;
    drawer?.close();
  }

  private msCarried(): number {
    return countItemInInventory(parseInventory(this.inventoryJson), "banknote");
  }

  private msApply(payload: MarketStatePayload): void {
    this.ensureMs();
    const key = `${this.boardSort}|${this.appliedQuery}`;
    const page = payload.boardPage ?? 0;
    if (key !== this.msPagesKey || page === 0) {
      this.msPages.clear();
      this.msPagesKey = key;
    }
    this.msPages.set(
      page,
      this.listings.filter((listing) => listing.onBoard),
    );
    if (this.msLoadingPage === page) this.msLoadingPage = -1;
    const now = Date.now();
    for (const id of [...this.msCollecting]) {
      const listing = this.listings.find((row) => row.id === id && row.yours);
      if (!listing || (!listing.awaitingPayout && !listingIsExpired(listing, now))) {
        this.msCollecting.delete(id);
      }
    }
    if (this.msListPending != null) {
      const live = this.listings.filter((row) => row.yours).length;
      if (live > this.msListPending) {
        this.msListPending = null;
        this.msSellKey = "";
        showSheetMessage(this.ms!.snackSlot, "Listed. It's on the board now.");
      } else if (!this.busy) {
        this.msListPending = null;
      }
    }
    this.msRender();
    this.armExpiryRefresh();
  }

  private msReady(now: number) {
    const mine = this.listings.filter((row) => row.yours && !this.msCollecting.has(row.id));
    const sold = mine.filter((row) => row.awaitingPayout);
    const expired = mine.filter((row) => !row.awaitingPayout && listingIsExpired(row, now));
    const live = mine.filter((row) => !row.awaitingPayout && !listingIsExpired(row, now));
    return { sold, expired, live, deskNotes: this.desk.banknotes, returns: this.desk.returns };
  }

  private msRender(): void {
    const sheet = this.ensureMs();
    const now = Date.now();
    const ready = this.msReady(now);
    const readyCount =
      ready.sold.length + ready.expired.length + ready.returns.length + (ready.deskNotes > 0 ? 1 : 0);
    renderTabs(
      sheet.tabsSlot,
      [
        { id: "browse", label: "Browse" },
        { id: "sell", label: "Sell" },
        readyCount > 0
          ? { id: "mine", label: "My ads", count: readyCount, alert: true }
          : { id: "mine", label: "My ads", count: ready.live.length || undefined },
      ],
      this.msTab,
      (id) => {
        if (id === this.msTab) return;
        this.msTab = id === "sell" ? "sell" : id === "mine" ? "mine" : "browse";
        this.msCloseDrawer();
        this.msRender();
        sheet.body.scrollTop = 0;
      },
    );
    sheet.header.setSub(
      this.msTab === "browse"
        ? `You have ${money(this.msCarried())}`
        : `Ads ${this.desk.activeCount} of ${this.desk.listingCap} used`,
    );
    sheet.bar.replaceChildren();
    if (this.msTab === "sell") this.msRenderSell();
    else if (this.msTab === "mine") this.msRenderMine(now, ready);
    else this.msRenderBrowse(now);
    sheet.syncBar();
  }

  private msBoardRows(): MarketListingWire[] {
    const seen = new Set<number>();
    const rows: MarketListingWire[] = [];
    const now = Date.now();
    for (const page of [...this.msPages.keys()].sort((a, b) => a - b)) {
      for (const listing of this.msPages.get(page) ?? []) {
        if (seen.has(listing.id)) continue;
        if (listing.awaitingPayout || listing.expired || listing.expiresAt <= now) continue;
        seen.add(listing.id);
        rows.push(listing);
      }
    }
    return rows;
  }

  private msRenderBrowse(now: number): void {
    const sheet = this.ms!;
    const list = this.msList!;
    const search = this.msSearch!;
    if (search.value !== this.boardQuery) search.value = this.boardQuery;
    const sort = filterChips(
      [
        { id: "new", label: "Newest" },
        { id: "cheap", label: "Cheapest each" },
      ],
      this.boardSort,
      (id) => this.setBoardSort(id === "cheap" ? "cheap" : "new"),
    );
    const rows = this.msBoardRows();
    const children: HTMLElement[] = [];
    if (rows.length === 0) {
      const empty = document.createElement("p");
      empty.className = "ms-hint market-ms-empty";
      empty.textContent = this.appliedQuery.trim() ? "No ads match." : "Nothing is listed right now.";
      children.push(empty);
    }
    for (const listing of rows) {
      const name = getItemDefinition(listing.itemId)?.name ?? listing.itemId;
      const meta: (string | Node)[] = [];
      if (listing.yours) meta.push(chip("Yours", "y"));
      if (listing.condition < 100) meta.push(chip(`${listing.condition}%`));
      const bits: string[] = [];
      if (listing.quantity > 1) bits.push(`${eachPrice(listing.price, listing.quantity)} each`);
      if (listing.durability != null) bits.push(`${listing.durability} uses`);
      const effect = wornGearEffectHint(listing.itemId);
      if (effect) bits.push(effect);
      if (!listing.yours) bits.push(timeLeft(listing.expiresAt, now));
      meta.push(bits.join(" · "));
      children.push(
        sheetRow({
          iconItemId: listing.itemId,
          qty: listing.quantity > 1 ? listing.quantity : undefined,
          name: listing.quantity > 1 ? `${name} ×${listing.quantity}` : name,
          meta,
          end: money(listing.price),
          onTap: () => this.msOpenBuy(listing),
        }),
      );
    }
    const morePages = this.msMorePages();
    if (rows.length > 0 && morePages) {
      const more = document.createElement("p");
      more.className = "ms-hint market-ms-more";
      more.textContent = "Loading more…";
      children.push(more);
    }
    list.replaceChildren(...children);
    if (sheet.body.firstChild !== search || !sheet.body.contains(list)) {
      sheet.body.replaceChildren(search, sort, list);
    } else {
      sheet.body.children[1]?.replaceWith(sort);
    }
    requestAnimationFrame(() => this.msMaybeLoadMore());
  }

  private msMorePages(): boolean {
    const loaded = Math.max(-1, ...this.msPages.keys());
    return loaded + 1 < this.boardPages;
  }

  private msMaybeLoadMore(): void {
    const body = this.ms?.body;
    if (!body || !this.visible || this.msTab !== "browse" || !this.msMorePages()) return;
    if (body.scrollTop + body.clientHeight < body.scrollHeight - 240) return;
    const next = Math.max(-1, ...this.msPages.keys()) + 1;
    if (this.msLoadingPage === next) return;
    this.msLoadingPage = next;
    this.requestBoard(next);
  }

  private msOpenBuy(listing: MarketListingWire): void {
    this.msCloseDrawer();
    const sheet = this.ms!;
    const name = getItemDefinition(listing.itemId)?.name ?? listing.itemId;
    const title = listing.quantity > 1 ? `${name} ×${listing.quantity}` : name;
    const drawer = openDrawer(sheet.root, {
      tone: "gold",
      label: title,
      onClose: () => {
        if (this.msDrawer === drawer) this.msDrawer = null;
      },
    });
    this.msDrawer = drawer;
    const now = Date.now();
    const sub = listing.yours
      ? `Your ad · ${timeLeft(listing.expiresAt, now)}`
      : timeLeft(listing.expiresAt, now);
    const carried = this.msCarried();
    const rows: KvRow[] = [];
    if (listing.quantity > 1) rows.push({ label: "Price each", value: eachPrice(listing.price, listing.quantity) });
    rows.push({ label: "Trader sells for", value: `${traderRangeText(listing.itemId)} each` });
    rows.push({ label: "You pay", value: money(listing.price), total: true });
    rows.push({ label: "Your notes after", value: money(carried - listing.price) });
    const hint = document.createElement("p");
    hint.className = "ms-hint market-ms-note";
    const short = listing.price - carried;
    let blocked = "";
    if (listing.yours) blocked = "This is your ad. Cancel it from My ads.";
    else if (short > 0) blocked = `You need ${money(short)} more.`;
    hint.textContent = blocked || "Goes straight into your bag.";
    if (blocked) hint.classList.add("ms-warn");
    drawer.content.append(
      drawerHead({ iconItemId: listing.itemId, title, sub }),
      kvCard(rows, true),
      hint,
    );
    const buy = sheetButton(
      listing.yours ? "Yours" : short > 0 ? "Not enough notes" : `Buy for ${money(listing.price)}`,
      "pri",
      () => {
        if (this.busy || blocked) return;
        this.markBusy();
        for (const rows of this.msPages.values()) {
          const at = rows.findIndex((row) => row.id === listing.id);
          if (at >= 0) rows.splice(at, 1);
        }
        this.msCloseDrawer();
        this.handlers.onBuy(listing.id);
        this.msRender();
      },
    );
    buy.disabled = !!blocked || this.busy;
    drawer.bar.append(buy);
  }

  private msRenderSell(): void {
    const sheet = this.ms!;
    const rows = this.listableSlots();
    this.ensureSelection();
    const selected = rows.find((row) => row.index === this.selectedIndex) ?? null;
    const full = this.desk.activeCount >= this.desk.listingCap;
    const body: HTMLElement[] = [];
    const note = (text: string, warn = false) => {
      const p = document.createElement("p");
      p.className = warn ? "ms-hint ms-warn market-ms-note" : "ms-hint market-ms-note";
      p.textContent = text;
      body.push(p);
    };
    if (full) note("Collect a sold or expired ad, or cancel one, before posting another.", true);
    if (!selected) {
      note("Nothing you can list. Banknotes, worn clothes, and the weapon in your hands stay off the board.");
      sheet.body.replaceChildren(...body);
      return;
    }
    const sellKey = `${selected.index}:${selected.itemId}:${selected.quantity}`;
    if (sellKey !== this.msSellKey) {
      this.msSellKey = sellKey;
      this.msSellQty = selected.quantity;
      this.msSellEach = Math.max(1, traderSellPriceRange(selected.itemId).low);
    }
    this.msSellQty = Math.max(1, Math.min(selected.quantity, this.msSellQty));
    const name = getItemDefinition(selected.itemId)?.name ?? selected.itemId;

    body.push(sectionLabel("Item"));
    body.push(
      sheetRow({
        iconItemId: selected.itemId,
        name: itemLabel(selected.itemId, 1, selected.condition, selected.durability),
        meta: [`You have ${selected.quantity}`],
        chevron: rows.length > 1,
        onTap: rows.length > 1 ? () => this.msOpenPicker() : undefined,
      }),
    );
    if (selected.quantity > 1) {
      body.push(sectionLabel("How many"));
      body.push(
        createStepper({
          value: this.msSellQty,
          min: 1,
          max: selected.quantity,
          onChange: (value) => {
            this.msSellQty = value;
            this.msRender();
          },
        }).el,
      );
    }
    body.push(sectionLabel("Price each", `Trader sells for ${traderRangeText(selected.itemId)}`));
    const maxEach = Math.max(1, Math.floor(MARKET_PRICE_MAX / this.msSellQty));
    body.push(
      createStepper({
        value: Math.min(this.msSellEach, maxEach),
        min: 1,
        max: maxEach,
        prefix: "$",
        onChange: (value) => {
          this.msSellEach = value;
          this.msRender();
        },
      }).el,
    );
    const total = Math.min(MARKET_PRICE_MAX, this.msSellEach * this.msSellQty);
    const payout = marketSalePayout(total, this.ashenReputation);
    const pay = kvCard(
      [
        { label: "Buyer pays", value: money(total) },
        { label: `Market fee (${this.desk.feePercent}%)`, value: `−${money(total - payout)}`, tone: "bad" },
        { label: "You get", value: money(payout), total: true },
      ],
      true,
    );
    pay.classList.add("market-ms-pay");
    body.push(pay);
    const days = Math.round(MARKET_LISTING_MS / 86_400_000);
    note(`Expires in ${days} days. Unsold items come back to My ads.`);
    sheet.body.replaceChildren(...body);

    const list = sheetButton(
      full ? "Your ads are full" : `List ${this.msSellQty} ${name} for ${money(total)}`,
      "pri",
      () => {
        if (this.busy || full) return;
        this.markBusy();
        this.msListPending = this.listings.filter((row) => row.yours).length;
        this.handlers.onList({
          slotIndex: selected.index,
          itemId: selected.itemId,
          quantity: this.msSellQty,
          price: total,
        });
        this.msRender();
      },
    );
    list.disabled = full || this.busy;
    sheet.bar.append(list);
  }

  private msOpenPicker(): void {
    this.msCloseDrawer();
    const sheet = this.ms!;
    const drawer = openDrawer(sheet.root, {
      tone: "gold",
      label: "Pick an item",
      onClose: () => {
        if (this.msDrawer === drawer) this.msDrawer = null;
      },
    });
    this.msDrawer = drawer;
    drawer.content.append(drawerHead({ title: "Pick an item", sub: "From your pockets and backpack" }));
    for (const row of this.listableSlots()) {
      drawer.content.append(
        sheetRow({
          iconItemId: row.itemId,
          qty: row.quantity > 1 ? row.quantity : undefined,
          name: itemLabel(row.itemId, 1, row.condition, row.durability),
          meta: [`Trader sells for ${traderRangeText(row.itemId)}`],
          state: row.index === this.selectedIndex ? "on" : undefined,
          onTap: () => {
            this.selectedIndex = row.index;
            this.msSellKey = "";
            this.msCloseDrawer();
            this.msRender();
          },
        }),
      );
    }
    drawer.bar.hidden = true;
  }

  private msRenderMine(now: number, ready: ReturnType<PlayerMarketUI["msReady"]>): void {
    const sheet = this.ms!;
    const body: HTMLElement[] = [];
    const anyReady =
      ready.sold.length > 0 || ready.expired.length > 0 || ready.returns.length > 0 || ready.deskNotes > 0;
    if (anyReady) {
      body.push(sectionLabel("Ready to collect"));
      if (ready.deskNotes > 0) {
        body.push(
          sheetRow({
            iconItemId: "banknote",
            name: `${money(ready.deskNotes)} in notes`,
            meta: ["Waiting at the desk"],
            state: "on",
          }),
        );
      }
      for (const listing of ready.sold) {
        body.push(this.msMineRow(listing, [chip("Sold", "y"), `You get ${money(listing.payout)}`], "on"));
      }
      for (const listing of ready.expired) {
        body.push(this.msMineRow(listing, [chip("Expired", "r"), "Comes back to your bag"], "on"));
      }
      for (const row of ready.returns) {
        const name = getItemDefinition(row.itemId)?.name ?? row.itemId;
        body.push(
          sheetRow({
            iconItemId: row.itemId,
            qty: row.quantity > 1 ? row.quantity : undefined,
            name: row.quantity > 1 ? `${name} ×${row.quantity}` : name,
            meta: [chip("Returned", "r"), "Waiting at the desk"],
            state: "on",
          }),
        );
      }
    }
    if (ready.live.length > 0) {
      body.push(sectionLabel("Live"));
      for (const listing of ready.live) {
        const bits: string[] = [];
        if (listing.quantity > 1) bits.push(`${eachPrice(listing.price, listing.quantity)} each`);
        else bits.push(money(listing.price));
        bits.push(timeLeft(listing.expiresAt, now));
        const cancel = sheetButton("Cancel", "sec", () => {
          if (this.busy) return;
          this.markBusy();
          this.handlers.onCancel(listing.id);
          this.msRender();
        }, { small: true });
        cancel.disabled = this.busy;
        body.push(this.msMineRow(listing, [bits.join(" · ")], undefined, cancel));
      }
    }
    if (!anyReady && ready.live.length === 0) {
      const empty = document.createElement("p");
      empty.className = "ms-hint market-ms-empty";
      empty.textContent = "You have nothing listed.";
      body.push(empty);
      sheet.bar.append(
        sheetButton("Sell something", "sec", () => {
          this.msTab = "sell";
          this.msRender();
        }),
      );
    }
    sheet.body.replaceChildren(...body);
    if (!anyReady) return;

    const notes =
      ready.deskNotes + ready.sold.reduce((sum, listing) => sum + listing.payout, 0);
    const items = ready.expired.length + ready.returns.length;
    const parts: string[] = [];
    if (notes > 0) parts.push(money(notes));
    if (items > 0) parts.push(items === 1 ? "1 item" : `${items} items`);
    const collect = sheetButton(`Collect ${parts.join(" and ")}`, "pri", () => {
      if (this.busy) return;
      this.markBusy();
      for (const listing of ready.sold) {
        this.msCollecting.add(listing.id);
        this.handlers.onCollectPayout(listing.id);
      }
      for (const listing of ready.expired) {
        this.msCollecting.add(listing.id);
        this.handlers.onCollectExpired(listing.id);
      }
      if (ready.deskNotes > 0 || ready.returns.length > 0) this.handlers.onCollect();
      this.msRender();
    });
    collect.disabled = this.busy;
    sheet.bar.append(collect);
  }

  private msMineRow(
    listing: MarketListingWire,
    meta: (string | Node)[],
    state?: "on",
    end?: HTMLElement,
  ): HTMLElement {
    const name = getItemDefinition(listing.itemId)?.name ?? listing.itemId;
    return sheetRow({
      iconItemId: listing.itemId,
      qty: listing.quantity > 1 ? listing.quantity : undefined,
      name: listing.quantity > 1 ? `${name} ×${listing.quantity}` : name,
      meta,
      state,
      end,
    });
  }
}
