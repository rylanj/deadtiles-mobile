import {
  ASHEN_MARKET_TRADER_NAME,
  ASHEN_MILITIA_TASK_WINDOW_MS,
  ASHEN_REP_START,
  ASHEN_TRADER_DIALOG_LINES,
  SAFE_DEPOSIT_COST,
  ASHEN_TRADER_QUESTS,
  ASHEN_TRADERS_FACTION,
  isAshenMarketTraderId,
  deadmarkWireClosedReason,
  type WireDeskPayload,
  GUARD_NPC_TRADER_GUARD,
  GUARD_NPC_TRADER_MAN,
  ashenStanding,
  ashenStandingLabel,
  canAcceptQuest,
  canAddToInventory,
  canTurnInQuest,
  countItemInInventory,
  getItemDefinition,
  inventoryAfterTurnIns,
  isQuestActive,
  isQuestListed,
  isQuestObjectiveDone,
  parseInventory,
  parseQuestsJson,
  pickDialogVariant,
  questAssignedLocationLabel,
  questCompletionsRemaining,
  questObjectiveLine,
  questRewardBanknotes,
  questRewardReputation,
  questStatusOf,
  questTurnInItems,
  storySpeechLines,
  type QuestDefinition,
  type StorySpeechLine,
} from "@zombie/shared";
import { createDialogCloseButton } from "./dialogCloseBtn";
import { appendItemIcon, fillSpeechButton, markQuestKeepsake, markSpeechQuest } from "./itemIcons";
import { resetDialogScroll } from "./dialogScroll";
import { playerAvatarSrc } from "./playerAvatar";
import { claimPageOverlay } from "./pageOverlay";
import { bindPhoneDialogResize, usePhoneDialogSheet } from "./phoneDialog";
import { PhoneTalkNav, TalkSheet, syncTalkSheet, type TalkPush } from "./talkSheet";

export type AshenTraderDialogUIHandlers = {
  onClose: () => void;
  /** Player chose "Let's see what you have to trade" with a TraderMan. */
  onRequestTrade: (traderId: string) => void;
  /** Player chose the Birchport player board with the market trader. */
  onRequestBoard: (traderId: string) => void;
  /** Player already paid for a safe deposit box and wants it open. */
  onRequestDeposit: (traderId: string) => void;
  /** Player is paying the one-time safe deposit fee. */
  onPayDeposit: (traderId: string) => void;
  /** Kevin checks what the coast will still wire today. */
  onRequestWire: (traderId: string) => void;
  /** Ship this many notes. The server refuses if the book moved. */
  onConfirmWire: (traderId: string, notes: number) => void;
  onAcceptQuest: (questId: string) => void;
  onCompleteTask: (taskId: string) => void;
  onChooseLine?: (lineId: string) => void;
};

const TRADER_MAN_AVATAR = "/assets/UI/TraderMan1/TraderMan1_Avatar.png";
const TRADER_GUARD_AVATAR = "/assets/UI/TraderGuard1/TraderGuard1_Avatar.png";

function makeQuestCell(opts: {
  itemId: string;
  qtyLabel?: string;
  ariaLabel: string;
}): HTMLElement {
  const cell = document.createElement("div");
  cell.className = "inventory-cell inventory-cell--filled red-dialog-task-cell";
  cell.setAttribute("role", "img");
  cell.setAttribute("aria-label", opts.ariaLabel);
  cell.tabIndex = -1;
  const hasIcon = appendItemIcon(cell, opts.itemId, "inventory-cell-icon");
  if (hasIcon) cell.classList.add("inventory-cell--has-icon");
  markQuestKeepsake(cell, opts.itemId);
  if (opts.qtyLabel) {
    const qty = document.createElement("span");
    qty.className = "inventory-cell-qty";
    qty.textContent = opts.qtyLabel;
    cell.appendChild(qty);
  }
  return cell;
}

export class AshenTraderDialogUI {
  private visible = false;
  private npcId = "";
  private npcKind = GUARD_NPC_TRADER_MAN;
  private ashenReputation = ASHEN_REP_START;
  private activeLineId: string | null = null;
  /** Story reply kept on screen after its line goes away. */
  private scriptedLineId: string | null = null;
  private scriptedReply: string | null = null;
  private questsJson = "";
  private inventoryJson = "[]";
  private extraPockets = 0;
  private safeDepositRented = false;
  private expandedQuestId: string | null = null;
  private denyQuestId = "";
  private denyReason = "";
  private wireDesk: WireDeskPayload | null = null;
  private wireNotice = "";
  private wireBusy = false;
  private wireAmountDraft = "";
  private wireWaitTimer: number | null = null;

  private overlay: HTMLElement;
  private playerAvatarEl: HTMLImageElement;
  private playerTitleEl: HTMLElement;
  private npcAvatarEl: HTMLImageElement;
  private npcTitleEl: HTMLElement;
  private standingPillEl: HTMLElement;
  private speechListEl: HTMLElement;
  private responseEl: HTMLElement;
  private layoutEl!: HTMLElement;
  private playerBodyEl!: HTMLElement;
  private npcBodyEl!: HTMLElement;
  private avatarHome!: HTMLElement;
  private titleHome!: HTMLElement;
  private sheet!: TalkSheet;
  private phoneNav = new PhoneTalkNav();
  private unbindPhoneResize: () => void = () => {};

  constructor(private handlers: AshenTraderDialogUIHandlers) {
    this.overlay = document.createElement("div");
    this.overlay.id = "ashen-dialog-overlay";
    this.overlay.hidden = true;

    const layout = document.createElement("div");
    layout.className = "red-dialog-layout";

    const toolbar = document.createElement("div");
    toolbar.className = "red-dialog-toolbar";
    toolbar.append(createDialogCloseButton(() => this.handlers.onClose()));

    const columns = document.createElement("div");
    columns.className = "red-dialog-columns";

    const playerPanel = document.createElement("div");
    playerPanel.className = "inventory-panel red-dialog-panel ashen-dialog-panel";
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
    playerHint.textContent = "Choose what to say";
    playerTitleWrap.append(this.playerTitleEl, playerHint);
    playerHeader.append(this.playerAvatarEl, playerTitleWrap);

    const playerBody = document.createElement("div");
    playerBody.className = "red-dialog-body";
    this.speechListEl = document.createElement("div");
    this.speechListEl.className = "red-dialog-speech-list";
    playerBody.appendChild(this.speechListEl);
    playerPanel.append(playerHeader, playerBody);

    const npcPanel = document.createElement("div");
    npcPanel.className = "inventory-panel red-dialog-panel ashen-dialog-panel";
    const npcHeader = document.createElement("div");
    npcHeader.className = "inventory-header trader-panel-header";
    this.npcAvatarEl = document.createElement("img");
    this.npcAvatarEl.className = "trader-avatar";
    this.npcAvatarEl.src = TRADER_MAN_AVATAR;
    this.npcAvatarEl.alt = ASHEN_TRADERS_FACTION;
    const npcTitleWrap = document.createElement("div");
    npcTitleWrap.className = "trader-panel-header-text";
    const npcTitleRow = document.createElement("div");
    npcTitleRow.className = "trader-title-row";
    this.npcTitleEl = document.createElement("h2");
    this.npcTitleEl.className = "inventory-title";
    this.npcTitleEl.textContent = ASHEN_TRADERS_FACTION;
    this.standingPillEl = document.createElement("div");
    this.standingPillEl.className =
      "trader-standing-pill trader-standing-pill--wary";
    this.standingPillEl.textContent = "Wary";
    npcTitleRow.append(this.npcTitleEl, this.standingPillEl);
    const npcHint = document.createElement("span");
    npcHint.className = "inventory-hint";
    npcHint.textContent = "Their reply";
    npcTitleWrap.append(npcTitleRow, npcHint);
    npcHeader.append(this.npcAvatarEl, npcTitleWrap);

    const npcBody = document.createElement("div");
    npcBody.className = "red-dialog-body";
    this.responseEl = document.createElement("div");
    this.responseEl.className =
      "red-dialog-response red-dialog-response--empty ashen-dialog-response";
    this.responseEl.textContent = "Waiting for you to say something...";
    npcBody.appendChild(this.responseEl);
    npcPanel.append(npcHeader, npcBody);

    columns.append(playerPanel, npcPanel);
    layout.append(toolbar, columns);
    this.layoutEl = layout;
    this.playerBodyEl = playerBody;
    this.npcBodyEl = npcBody;
    this.avatarHome = npcHeader;
    this.titleHome = npcTitleRow;
    this.sheet = new TalkSheet("ashen", () => this.handlers.onClose(), () => {
      this.phoneNav.back();
      this.render();
    });
    this.overlay.append(layout, this.sheet.root);

    this.overlay.addEventListener("click", (e) => {
      if (usePhoneDialogSheet()) return;
      if (e.target === this.overlay) this.handlers.onClose();
    });

    this.unbindPhoneResize = bindPhoneDialogResize(
      () => this.visible,
      () => this.overlay.classList.contains("talk-sheet-mode"),
      () => this.render(),
      this.overlay,
    );

    claimPageOverlay(this.overlay.id);
    document.body.appendChild(this.overlay);
  }

  isOpen() {
    return this.visible;
  }

  getNpcId() {
    return this.npcId;
  }

  noteDenied(taskId: string, reason: string) {
    if (!this.visible) return;
    this.denyQuestId = taskId;
    this.denyReason = reason;
    this.expandedQuestId = taskId;
    this.activeLineId = "jobs";
    this.phoneNav.reopen();
    this.render();
  }

  open(opts: {
    npcId: string;
    npcKind: number;
    playerName?: string;
    ashenReputation?: number;
    clothingSkin?: number;
    inventoryJson?: string;
    questsJson?: string;
    extraPockets?: number;
    safeDepositRented?: boolean;
  }) {
    this.npcId = opts.npcId;
    this.npcKind = opts.npcKind;
    const isGuard = opts.npcKind === GUARD_NPC_TRADER_GUARD;
    const isKevin = this.isMarketTrader();
    this.npcAvatarEl.src = isGuard ? TRADER_GUARD_AVATAR : TRADER_MAN_AVATAR;
    this.npcAvatarEl.alt = isKevin
      ? ASHEN_MARKET_TRADER_NAME
      : isGuard
        ? "Trader Guard"
        : "Trader";
    this.npcTitleEl.textContent = isKevin
      ? ASHEN_MARKET_TRADER_NAME
      : ASHEN_TRADERS_FACTION;
    this.inventoryJson = opts.inventoryJson ?? "[]";
    this.questsJson = opts.questsJson ?? "";
    this.extraPockets = opts.extraPockets ?? 0;
    this.safeDepositRented = !!opts.safeDepositRented;
    this.expandedQuestId = null;
    this.denyQuestId = "";
    this.denyReason = "";
    this.wireDesk = null;
    this.wireNotice = "";
    this.wireBusy = false;
    this.wireAmountDraft = "";
    this.clearWireWait();
    this.playerTitleEl.textContent = opts.playerName?.trim() || "You";
    this.playerAvatarEl.src = playerAvatarSrc(opts.clothingSkin);
    this.ashenReputation = opts.ashenReputation ?? ASHEN_REP_START;
    this.activeLineId = null;
    this.scriptedLineId = null;
    this.scriptedReply = null;
    this.phoneNav.resetForLine();
    this.visible = true;
    this.overlay.hidden = false;
    document.body.classList.add("ashen-dialog-open");
    this.render();
    resetDialogScroll(this.overlay);
  }

  close() {
    this.visible = false;
    this.overlay.hidden = true;
    this.overlay.classList.remove("talk-sheet-mode");
    document.body.classList.remove("ashen-dialog-open");
    this.npcId = "";
    this.activeLineId = null;
    this.scriptedLineId = null;
    this.scriptedReply = null;
    this.expandedQuestId = null;
    this.denyQuestId = "";
    this.denyReason = "";
    this.phoneNav.resetForLine();
    this.wireDesk = null;
    this.wireNotice = "";
    this.wireBusy = false;
    this.wireAmountDraft = "";
    this.clearWireWait();
  }

  destroy() {
    this.close();
    this.unbindPhoneResize();
    this.unbindPhoneResize = () => {};
    this.sheet.dispose();
    this.overlay.remove();
  }

  sync(opts: {
    inventoryJson?: string;
    questsJson?: string;
    ashenReputation?: number;
    extraPockets?: number;
  }) {
    if (!this.visible) return;
    if (opts.inventoryJson != null) this.inventoryJson = opts.inventoryJson;
    if (opts.questsJson != null) this.questsJson = opts.questsJson;
    if (opts.ashenReputation != null) this.ashenReputation = opts.ashenReputation;
    if (opts.extraPockets != null) this.extraPockets = opts.extraPockets;
    this.render();
  }

  applyWire(
    payload: WireDeskPayload,
    result?: { ok: boolean; pending: boolean; reason: string },
  ) {
    if (!this.visible || !this.isMarketTrader()) return;
    this.wireDesk = payload;
    if (payload.inventoryJson) this.inventoryJson = payload.inventoryJson;
    this.wireBusy = false;
    this.clearWireWait();
    if (result) this.wireNotice = result.reason;
    else if (
      this.wireNotice === "Checking today's book." ||
      this.wireNotice === "Counting the notes."
    ) {
      this.wireNotice = "";
    }
    if (this.activeLineId === "wire") this.render();
  }

  private clearWireWait() {
    if (this.wireWaitTimer == null) return;
    window.clearTimeout(this.wireWaitTimer);
    this.wireWaitTimer = null;
  }

  private armWireWait() {
    this.clearWireWait();
    this.wireWaitTimer = window.setTimeout(() => {
      if (!this.wireBusy) return;
      this.wireBusy = false;
      this.wireNotice = "No answer yet. If the notes left your pack, the wire is still on the book.";
      if (this.visible && this.activeLineId === "wire") this.render();
    }, 35_000);
  }

  private isTraderMan() {
    return this.npcKind === GUARD_NPC_TRADER_MAN;
  }

  private isMarketTrader() {
    return this.isTraderMan() && isAshenMarketTraderId(this.npcId);
  }

  private itemCount(itemId: string): number {
    return countItemInInventory(parseInventory(this.inventoryJson), itemId);
  }

  /** Server answer to a story line. */
  speak(lineId: string, text: string) {
    this.scriptedLineId = lineId;
    this.scriptedReply = text;
    this.activeLineId = lineId;
    if (this.visible) this.render();
  }

  private storyLines(): StorySpeechLine[] {
    if (!this.isMarketTrader()) return [];
    return storySpeechLines("kevin", parseQuestsJson(this.questsJson), (itemId) =>
      this.itemCount(itemId),
    );
  }

  private render() {
    this.renderContents();
    this.presentTalk();
  }

  private presentTalk() {
    const push: TalkPush | null = !this.isMarketTrader()
      ? null
      : this.activeLineId === "jobs"
        ? "jobs"
        : this.activeLineId === "wire"
          ? "wire"
          : this.activeLineId === "deposit" && !this.safeDepositRented
            ? "deposit"
            : null;
    syncTalkSheet({
      overlay: this.overlay,
      layoutEl: this.layoutEl,
      speechListEl: this.speechListEl,
      responseEl: this.responseEl,
      playerBodyEl: this.playerBodyEl,
      npcBodyEl: this.npcBodyEl,
      npcAvatarEl: this.npcAvatarEl,
      npcTitleEl: this.npcTitleEl,
      standingEl: this.standingPillEl,
      avatarHome: this.avatarHome,
      titleHome: this.titleHome,
      sheet: this.sheet,
      nav: this.phoneNav,
      push,
      activeLineId: this.activeLineId,
      rerender: () => this.render(),
    });
  }

  private renderContents() {
    this.updateStandingPill();
    this.speechListEl.replaceChildren();
    for (const line of ASHEN_TRADER_DIALOG_LINES) {
      if (
        (line.action === "board" || line.action === "deposit" || line.action === "wire") &&
        !this.isMarketTrader()
      ) {
        continue;
      }
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "red-dialog-speech-btn ashen-dialog-speech-btn";
      if (this.activeLineId === line.id) {
        btn.classList.add("red-dialog-speech-btn--active");
        btn.classList.add("ashen-dialog-speech-btn--active");
      }
      const iconId =
        this.isTraderMan() && line.action === "trade"
          ? "backpack"
          : this.isTraderMan() && (line.action === "board" || line.action === "wire")
            ? "banknote"
            : this.isTraderMan() && line.action === "deposit"
              ? "safe"
              : line.id === "jobs"
                ? "journal"
                : undefined;
      const speech =
        line.action === "deposit" && this.safeDepositRented && line.playerRented
          ? line.playerRented
          : line.player;
      fillSpeechButton(btn, speech, iconId);
      btn.addEventListener("click", () => {
        this.phoneNav.resetForLine();
        this.activeLineId = line.id;
        if (line.action === "wire" && this.isMarketTrader()) {
          this.wireDesk = null;
          this.wireNotice = "Checking today's book.";
          this.wireBusy = false;
          this.clearWireWait();
        }
        this.render();
        if (line.action === "trade" && this.isTraderMan() && this.npcId) {
          // Close talk first, then open the shop against this TraderMan.
          const traderId = this.npcId;
          this.handlers.onClose();
          this.handlers.onRequestTrade(traderId);
        }
        if (line.action === "board" && this.isTraderMan() && this.npcId) {
          const traderId = this.npcId;
          this.handlers.onClose();
          this.handlers.onRequestBoard(traderId);
        }
        if (
          line.action === "deposit" &&
          this.isMarketTrader() &&
          this.safeDepositRented &&
          this.npcId
        ) {
          const traderId = this.npcId;
          this.handlers.onClose();
          this.handlers.onRequestDeposit(traderId);
        }
        if (line.action === "wire" && this.isMarketTrader() && this.npcId) {
          this.handlers.onRequestWire(this.npcId);
        }
      });
      this.speechListEl.appendChild(btn);
    }
    const storyLines = this.storyLines();
    for (const line of storyLines) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "red-dialog-speech-btn ashen-dialog-speech-btn";
      if (this.activeLineId === line.id) {
        btn.classList.add("red-dialog-speech-btn--active");
        btn.classList.add("ashen-dialog-speech-btn--active");
      }
      fillSpeechButton(btn, line.player);
      markSpeechQuest(btn);
      btn.addEventListener("click", () => {
        this.phoneNav.resetForLine();
        this.activeLineId = line.id;
        this.scriptedLineId = line.id;
        this.scriptedReply = line.reply ?? "…";
        this.handlers.onChooseLine?.(line.id);
        this.render();
      });
      this.speechListEl.appendChild(btn);
    }

    const active = ASHEN_TRADER_DIALOG_LINES.find(
      (l) => l.id === this.activeLineId,
    );
    this.responseEl.replaceChildren();
    if (!active && this.scriptedReply && this.scriptedLineId === this.activeLineId) {
      this.responseEl.classList.remove("red-dialog-response--empty");
      const kept = document.createElement("div");
      kept.className = "red-dialog-response-text";
      kept.textContent = this.scriptedReply;
      this.responseEl.appendChild(kept);
      return;
    }
    if (!active) {
      this.responseEl.classList.add("red-dialog-response--empty");
      this.responseEl.textContent = "Waiting for you to say something...";
      return;
    }
    this.responseEl.classList.remove("red-dialog-response--empty");
    const variants =
      !this.isTraderMan() && active.npcGuard
        ? active.npcGuard
        : this.isMarketTrader() && active.npcMarket
          ? active.npcMarket
          : active.npcMan;
    const reply = document.createElement("div");
    reply.className = "red-dialog-response-text";
    reply.textContent = pickDialogVariant(variants, `${this.npcId}|${active.id}`);
    this.responseEl.appendChild(reply);
    if (this.isMarketTrader() && active.id === "jobs") {
      this.appendJobList();
    }
    if (
      this.isMarketTrader() &&
      active.id === "deposit" &&
      !this.safeDepositRented
    ) {
      this.appendSafeDepositOffer();
    }
    if (this.isMarketTrader() && active.id === "wire") {
      this.appendWirePanel();
    }
  }

  private wireFloor(desk: WireDeskPayload): number {
    return desk.minWire;
  }

  private wireBlockReason(desk: WireDeskPayload): string | null {
    if (desk.configured && desk.max > 0) return null;
    return deadmarkWireClosedReason({
      configured: desk.configured,
      outage: desk.outage,
      cap: desk.personalCap,
      notesInPack: desk.notesInPack,
      coastLeft: desk.coastLeft,
      personalLeft: desk.personalLeft,
      penaltyDue: desk.penaltyDue ?? 0,
    });
  }

  private shipLabel(notes: number | null, penalty: number): string {
    if (notes == null) return "Ship notes";
    const base = `Ship ${notes.toLocaleString("en-US")} notes`;
    return penalty > 0 ? `${base} (+${penalty.toLocaleString("en-US")} penalty)` : base;
  }

  private wireAmountHint(amount: number | null, max: number, minWire: number): string {
    if (amount == null) return "";
    if (amount < minWire) {
      return `I don't wire fewer than ${minWire.toLocaleString("en-US")} notes.`;
    }
    if (amount > max) {
      return `The book can take ${max.toLocaleString("en-US")} right now.`;
    }
    return "";
  }

  private readWireAmount(): number | null {
    if (!/^[0-9]+$/.test(this.wireAmountDraft)) return null;
    const notes = Number(this.wireAmountDraft);
    if (!Number.isSafeInteger(notes) || notes < 1) return null;
    return notes;
  }

  private appendWirePanel() {
    const section = document.createElement("div");
    section.className = "ashen-wire";
    section.dataset.talkSheet = "wire";
    const desk = this.wireDesk;

    const addRow = (label: string, value: string) => {
      const row = document.createElement("div");
      row.className = "ashen-wire-row";
      const name = document.createElement("span");
      name.textContent = label;
      const amount = document.createElement("span");
      amount.textContent = value;
      row.append(name, amount);
      section.appendChild(row);
    };

    if (!desk) {
      const waiting = document.createElement("div");
      waiting.className = "ashen-wire-note";
      waiting.textContent = this.wireNotice || "Checking today's book.";
      section.appendChild(waiting);
      this.responseEl.appendChild(section);
      return;
    }

    addRow("Standing", desk.standing);
    addRow("Notes in your pack", desk.notesInPack.toLocaleString("en-US"));
    addRow(
      "Your wire left today",
      `${desk.personalLeft.toLocaleString("en-US")} of ${desk.personalCap.toLocaleString("en-US")}`,
    );
    addRow(
      "Coast still buying",
      `${desk.coastLeft.toLocaleString("en-US")} of ${desk.coastCap.toLocaleString("en-US")}`,
    );
    addRow("Marks go to", desk.destination.length > 12
      ? `${desk.destination.slice(0, 4)}...${desk.destination.slice(-4)}`
      : desk.destination);
    addRow("Rate", "1 note = 1 mark");
    const floor = this.wireFloor(desk);
    addRow("Smallest wire", `${floor.toLocaleString("en-US")} notes`);
    const penalty = desk.penaltyDue ?? 0;
    if (penalty > 0) {
      addRow("Coast penalty", `${penalty.toLocaleString("en-US")} notes, once`);
      const owed = document.createElement("div");
      owed.className = "ashen-wire-note";
      owed.textContent =
        "You closed the account the coast paid for and kept the deposit. The penalty comes out with your next wire.";
      section.appendChild(owed);
    }

    if (desk.pendingNotes > 0) {
      const pending = document.createElement("div");
      pending.className = "ashen-wire-note";
      pending.textContent = `A wire for ${desk.pendingNotes.toLocaleString("en-US")} notes is still on the book.`;
      section.appendChild(pending);
    }
    if (this.wireNotice) {
      const notice = document.createElement("div");
      notice.className = "ashen-wire-note";
      notice.textContent = this.wireNotice;
      section.appendChild(notice);
    }

    const blocked = this.wireBlockReason(desk);
    const amount = this.readWireAmount();
    const canShip =
      !this.wireBusy &&
      blocked == null &&
      amount != null &&
      amount >= floor &&
      amount <= desk.max;
    if (blocked && !this.wireBusy) {
      const line = document.createElement("div");
      line.className = "ashen-wire-note";
      line.dataset.wireBlocked = "1";
      line.textContent = blocked;
      section.appendChild(line);
    } else if (!blocked) {
      const hint = document.createElement("div");
      hint.className = "ashen-wire-note";
      hint.dataset.wireHint = "1";
      const showHint = (amount: number | null) => {
        hint.textContent = this.wireAmountHint(amount, desk.max, floor);
        hint.hidden = hint.textContent.length === 0;
      };
      const amountRow = document.createElement("div");
      amountRow.className = "ashen-wire-amount-row";
      const input = document.createElement("input");
      input.className = "ashen-wire-amount";
      input.inputMode = "numeric";
      input.autocomplete = "off";
      input.placeholder = floor < desk.max ? `${floor} or more` : `${floor}`;
      input.value = this.wireAmountDraft;
      input.disabled = this.wireBusy;
      input.addEventListener("input", () => {
        this.wireAmountDraft = input.value.replace(/\D/g, "").slice(0, 6);
        if (input.value !== this.wireAmountDraft) input.value = this.wireAmountDraft;
        const ship =
          section.querySelector<HTMLButtonElement>("[data-wire-ship]") ??
          this.overlay.querySelector<HTMLButtonElement>("[data-wire-ship]");
        const next = this.readWireAmount();
        showHint(next);
        if (ship && this.wireDesk) {
          const fits =
            next != null &&
            next >= this.wireFloor(this.wireDesk) &&
            next <= this.wireDesk.max;
          ship.disabled = this.wireBusy || !fits;
          ship.textContent = this.shipLabel(fits ? next : null, this.wireDesk.penaltyDue ?? 0);
        }
      });
      const maxBtn = document.createElement("button");
      maxBtn.type = "button";
      maxBtn.className = "ashen-wire-max";
      maxBtn.textContent = "Max";
      maxBtn.disabled = this.wireBusy || desk.max < 1;
      maxBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        this.wireAmountDraft = String(desk.max);
        this.render();
      });
      amountRow.append(input, maxBtn);
      section.appendChild(amountRow);
      showHint(amount);
      section.appendChild(hint);

      const ship = document.createElement("button");
      ship.type = "button";
      ship.className = "red-dialog-complete-btn";
      ship.dataset.wireShip = "1";
      ship.disabled = !canShip;
      ship.textContent = this.shipLabel(canShip ? amount : null, penalty);
      ship.addEventListener("click", (event) => {
        event.stopPropagation();
        const notes = this.readWireAmount();
        if (
          !this.npcId ||
          !this.wireDesk ||
          notes == null ||
          notes < this.wireFloor(this.wireDesk) ||
          notes > this.wireDesk.max
        ) {
          return;
        }
        this.wireBusy = true;
        this.wireNotice = "Counting the notes.";
        this.render();
        this.armWireWait();
        this.handlers.onConfirmWire(this.npcId, notes);
      });
      section.appendChild(ship);
    }

    this.responseEl.appendChild(section);
  }

  private appendSafeDepositOffer() {
    const banknotes = this.itemCount("banknote");
    const canPay = banknotes >= SAFE_DEPOSIT_COST;
    const section = document.createElement("div");
    section.className = "craft-recipe craft-recipe--expanded";
    section.dataset.talkSheet = "deposit";
    if (canPay) section.classList.add("craft-recipe--ready");

    const details = document.createElement("div");
    details.className = "craft-recipe-details";
    const costTitle = document.createElement("div");
    costTitle.className = "red-dialog-task-heading";
    costTitle.textContent = "Safe deposit box";
    details.appendChild(costTitle);

    const costRow = document.createElement("div");
    costRow.className = "red-dialog-task-row";
    costRow.appendChild(
      makeQuestCell({
        itemId: "banknote",
        qtyLabel: `×${SAFE_DEPOSIT_COST}`,
        ariaLabel: `${SAFE_DEPOSIT_COST} banknotes`,
      }),
    );
    details.appendChild(costRow);

    if (canPay) {
      const payBtn = document.createElement("button");
      payBtn.type = "button";
      payBtn.className = "red-dialog-complete-btn";
      payBtn.textContent = `Pay $${SAFE_DEPOSIT_COST}`;
      payBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (this.npcId) this.handlers.onPayDeposit(this.npcId);
      });
      details.appendChild(payBtn);
    } else {
      const hint = document.createElement("div");
      hint.className = "craft-recipe-hint";
      hint.textContent = `Need $${SAFE_DEPOSIT_COST} (you have $${banknotes})`;
      details.appendChild(hint);
    }

    section.appendChild(details);
    this.responseEl.appendChild(section);
  }

  private appendJobList() {
    const quests = parseQuestsJson(this.questsJson);
    const list = document.createElement("div");
    list.className = "craft-recipe-list red-dialog-task-list";
    list.dataset.talkSheet = "jobs";
    for (const def of ASHEN_TRADER_QUESTS) {
      if (!isQuestListed(quests, def)) continue;
      list.appendChild(this.buildQuestSection(def));
    }
    if (list.childElementCount > 0) this.responseEl.appendChild(list);
  }

  private buildQuestSection(def: QuestDefinition): HTMLElement {
    const quests = parseQuestsJson(this.questsJson);
    const turnIns = questTurnInItems(def);
    const notes = questRewardBanknotes(def);
    const rep = questRewardReputation(def, "ashenTraders");
    const remaining = questCompletionsRemaining(quests, def);
    const max = def.maxCompletionsPerWindow;
    const used =
      remaining != null && max != null
        ? Math.max(0, max - remaining)
        : 0;
    const atCap = remaining === 0;
    const accepted = isQuestActive(quests, def.id);
    const finishedOneShot =
      questStatusOf(quests, def.id) === "completed" && !def.repeatable;
    const haveItems = turnIns.every(
      (item) => this.itemCount(item.itemId) >= item.quantity,
    );
    const canAccept = !atCap && canAcceptQuest(quests, def.id);
    const canComplete = canTurnInQuest(quests, def.id) && haveItems;
    const afterTurnIn = inventoryAfterTurnIns(
      parseInventory(this.inventoryJson),
      turnIns,
    );
    const payoutFits =
      !!afterTurnIn &&
      canAddToInventory(afterTurnIn, "banknote", notes, this.extraPockets);
    const location = questAssignedLocationLabel(quests, def.id);
    const expanded = this.expandedQuestId === def.id;
    const field = def.objectives.filter((obj) => obj.kind !== "turnInItem");
    const fieldOpen = field.some(
      (obj) => !isQuestObjectiveDone(quests, def, obj),
    );

    const section = document.createElement("div");
    section.className = "craft-recipe";
    if (expanded) section.classList.add("craft-recipe--expanded");
    if (canComplete) section.classList.add("craft-recipe--ready");
    if (accepted) section.classList.add("craft-recipe--accepted");
    else if (atCap) section.classList.add("craft-recipe--capped");
    else if (canAccept) section.classList.add("craft-recipe--available");

    const summary = document.createElement("button");
    summary.type = "button";
    summary.className = "craft-recipe-summary";
    summary.setAttribute("aria-expanded", expanded ? "true" : "false");
    const iconId = def.iconItemId ?? turnIns[0]?.itemId ?? "map";
    summary.appendChild(
      makeQuestCell({
        itemId: iconId,
        qtyLabel: turnIns.length === 1 ? `×${turnIns[0]!.quantity}` : undefined,
        ariaLabel: def.title,
      }),
    );

    const label = document.createElement("div");
    label.className = "craft-recipe-summary-text";
    const nameEl = document.createElement("span");
    nameEl.className = "craft-recipe-summary-name";
    nameEl.textContent = def.title;
    if (accepted || canAccept || atCap) {
      const chip = document.createElement("span");
      chip.className = accepted
        ? "quest-status-chip quest-status-chip--accepted"
        : atCap
          ? "quest-status-chip quest-status-chip--capped"
          : "quest-status-chip quest-status-chip--available";
      chip.textContent = accepted ? "Accepted" : atCap ? "Daily limit" : "Available";
      nameEl.appendChild(chip);
    }
    const meta = document.createElement("span");
    meta.className = "craft-recipe-summary-meta";
    if (finishedOneShot) {
      meta.textContent = "Already reported";
    } else if (atCap) {
      meta.textContent = `Daily limit reached (${max}/day)`;
    } else if (canComplete) {
      meta.textContent =
        remaining != null
          ? `Ready to turn in (${remaining} left today)`
          : "Ready to turn in";
    } else if (canAccept) {
      meta.textContent =
        turnIns.length > 0 && haveItems
          ? "Accept this job to turn in"
          : "Available · accept to start";
    } else if (accepted && field.length > 0) {
      const shown = !fieldOpen && turnIns.length > 0 ? def.objectives.filter((obj) => obj.kind === "turnInItem") : field;
      shown.forEach((obj, i) => {
        if (i > 0) meta.append(" · ");
        const stage = document.createElement("span");
        stage.textContent = questObjectiveLine(quests, def, obj);
        if (isQuestObjectiveDone(quests, def, obj)) {
          stage.classList.add("quest-stage--done");
        }
        meta.appendChild(stage);
      });
      if (location && fieldOpen) {
        if (shown.length > 0) meta.append(" · ");
        meta.append(location);
      }
    } else if (accepted && turnIns.length > 0) {
      meta.textContent = turnIns
        .map((item) => {
          const name = getItemDefinition(item.itemId)?.name ?? item.label;
          return `${this.itemCount(item.itemId)}/${item.quantity} ${name}`;
        })
        .join(" · ");
    } else if (turnIns.length > 0) {
      meta.textContent = turnIns
        .map((item) => {
          const name = getItemDefinition(item.itemId)?.name ?? item.label;
          return `×${item.quantity} ${name}`;
        })
        .join(" · ");
    } else {
      meta.textContent = "Available · accept to start";
    }
    label.append(nameEl, meta);
    summary.appendChild(label);

    const chevron = document.createElement("span");
    chevron.className = "craft-recipe-chevron";
    chevron.setAttribute("aria-hidden", "true");
    chevron.textContent = expanded ? "▾" : "▸";
    summary.appendChild(chevron);
    summary.addEventListener("click", () => {
      this.expandedQuestId = this.expandedQuestId === def.id ? null : def.id;
      this.render();
    });
    section.appendChild(summary);
    if (!expanded) return section;

    const details = document.createElement("div");
    details.className = "craft-recipe-details";
    const blurb = document.createElement("div");
    blurb.className = "craft-recipe-hint";
    blurb.textContent = def.description;
    details.appendChild(blurb);

    for (const obj of def.objectives) {
      const line = document.createElement("div");
      line.className = "craft-recipe-hint";
      line.textContent = questObjectiveLine(quests, def, obj);
      if (isQuestObjectiveDone(quests, def, obj)) {
        line.classList.add("quest-stage--done");
      }
      details.appendChild(line);
    }
    if (location && fieldOpen) {
      const loc = document.createElement("div");
      loc.className = "craft-recipe-hint";
      loc.textContent = `Marked ${location}`;
      details.appendChild(loc);
    }

    if (turnIns.length > 0) {
      const needTitle = document.createElement("div");
      needTitle.className = "red-dialog-task-heading";
      needTitle.textContent = "Turn in";
      details.appendChild(needTitle);
      const needRow = document.createElement("div");
      needRow.className = "red-dialog-task-row";
      for (const item of turnIns) {
        const name = getItemDefinition(item.itemId)?.name ?? item.label;
        needRow.appendChild(
          makeQuestCell({
            itemId: item.itemId,
            qtyLabel: `×${item.quantity}`,
            ariaLabel: `${item.quantity} ${name}`,
          }),
        );
      }
      details.appendChild(needRow);
    }

    const rewardTitle = document.createElement("div");
    rewardTitle.className = "red-dialog-task-heading";
    rewardTitle.textContent = "Rewards";
    details.appendChild(rewardTitle);
    const rewardRow = document.createElement("div");
    rewardRow.className = "red-dialog-task-row";
    rewardRow.append(
      makeQuestCell({
        itemId: "banknote",
        qtyLabel: `×${notes}`,
        ariaLabel: `${notes} banknotes`,
      }),
      makeQuestCell({
        itemId: "rep",
        qtyLabel: `+${rep}`,
        ariaLabel: `+${rep} Ashen Traders reputation`,
      }),
    );
    details.appendChild(rewardRow);

    if (max != null) {
      const capHint = document.createElement("div");
      capHint.className = "craft-recipe-hint";
      const windowHrs = Math.round(
        (def.completionWindowMs ?? ASHEN_MILITIA_TASK_WINDOW_MS) / 3_600_000,
      );
      capHint.textContent = `${used}/${max} completed in the last ${windowHrs}h`;
      details.appendChild(capHint);
    }

    if (canComplete && !payoutFits) {
      const hint = document.createElement("div");
      hint.className = "craft-recipe-hint";
      hint.textContent = "No room for the payout. Free a pocket.";
      details.appendChild(hint);
    } else if (canComplete) {
      const completeBtn = document.createElement("button");
      completeBtn.type = "button";
      completeBtn.className = "red-dialog-complete-btn";
      completeBtn.textContent = "Complete Task";
      completeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.handlers.onCompleteTask(def.id);
      });
      details.appendChild(completeBtn);
    } else if (canAccept) {
      const acceptBtn = document.createElement("button");
      acceptBtn.type = "button";
      acceptBtn.className = "red-dialog-complete-btn";
      acceptBtn.textContent = "Accept Job";
      acceptBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.handlers.onAcceptQuest(def.id);
      });
      details.appendChild(acceptBtn);
    } else {
      const hint = document.createElement("div");
      hint.className = "craft-recipe-hint";
      hint.textContent = finishedOneShot
        ? "Already reported."
        : atCap
          ? "Come back later for more turn-ins"
          : accepted
            ? fieldOpen
              ? "Finish the job, then report back."
              : "You don't have everything yet."
            : "This job is not available right now.";
      details.appendChild(hint);
    }

    if (this.denyQuestId === def.id && this.denyReason) {
      const denied = document.createElement("div");
      denied.className = "craft-recipe-hint";
      denied.textContent = this.denyReason;
      details.appendChild(denied);
    }

    section.appendChild(details);
    return section;
  }

  private updateStandingPill() {
    const standing = ashenStanding(this.ashenReputation);
    this.standingPillEl.textContent = ashenStandingLabel(standing);
    this.standingPillEl.className = `trader-standing-pill trader-standing-pill--${standing}`;
    this.standingPillEl.title = `${ASHEN_TRADERS_FACTION}: ${Number(this.ashenReputation.toFixed(1))}`;
  }
}
