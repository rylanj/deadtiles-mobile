import {
  ASHEN_REP_START,
  ASHEN_TRADER_DIALOG_LINES,
  ASHEN_TRADERS_FACTION,
  isAshenMarketTraderId,
  GUARD_NPC_TRADER_GUARD,
  GUARD_NPC_TRADER_MAN,
  ashenStanding,
  ashenStandingLabel,
  pickDialogVariant,
} from "@zombie/shared";
import { createDialogCloseButton } from "./dialogCloseBtn";
import { fillSpeechButton } from "./itemIcons";
import { resetDialogScroll } from "./dialogScroll";
import { playerAvatarSrc } from "./playerAvatar";

export type AshenTraderDialogUIHandlers = {
  onClose: () => void;
  /** Player chose "Let's see what you have to trade" with a TraderMan. */
  onRequestTrade: (traderId: string) => void;
  /** Player chose the Birchport player board with the market trader. */
  onRequestBoard: (traderId: string) => void;
};

const TRADER_MAN_AVATAR = "/assets/UI/TraderMan1/TraderMan1_Avatar.png";
const TRADER_GUARD_AVATAR = "/assets/UI/TraderGuard1/TraderGuard1_Avatar.png";

export class AshenTraderDialogUI {
  private visible = false;
  private npcId = "";
  private npcKind = GUARD_NPC_TRADER_MAN;
  private ashenReputation = ASHEN_REP_START;
  private activeLineId: string | null = null;

  private overlay: HTMLElement;
  private playerAvatarEl: HTMLImageElement;
  private playerTitleEl: HTMLElement;
  private npcAvatarEl: HTMLImageElement;
  private npcTitleEl: HTMLElement;
  private standingPillEl: HTMLElement;
  private speechListEl: HTMLElement;
  private responseEl: HTMLElement;

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
    this.responseEl.textContent = "Waiting for you to speak…";
    npcBody.appendChild(this.responseEl);
    npcPanel.append(npcHeader, npcBody);

    columns.append(playerPanel, npcPanel);
    layout.append(toolbar, columns);
    this.overlay.appendChild(layout);

    this.overlay.addEventListener("click", (e) => {
      if (e.target === this.overlay) this.handlers.onClose();
    });

    document.body.appendChild(this.overlay);
  }

  isOpen() {
    return this.visible;
  }

  getNpcId() {
    return this.npcId;
  }

  open(opts: {
    npcId: string;
    npcKind: number;
    playerName?: string;
    ashenReputation?: number;
    clothingSkin?: number;
  }) {
    this.npcId = opts.npcId;
    this.npcKind = opts.npcKind;
    const isGuard = opts.npcKind === GUARD_NPC_TRADER_GUARD;
    this.npcAvatarEl.src = isGuard ? TRADER_GUARD_AVATAR : TRADER_MAN_AVATAR;
    this.npcAvatarEl.alt = isGuard ? "Trader Guard" : "Trader";
    this.npcTitleEl.textContent = ASHEN_TRADERS_FACTION;
    this.playerTitleEl.textContent = opts.playerName?.trim() || "You";
    this.playerAvatarEl.src = playerAvatarSrc(opts.clothingSkin);
    this.ashenReputation = opts.ashenReputation ?? ASHEN_REP_START;
    this.activeLineId = null;
    this.visible = true;
    this.overlay.hidden = false;
    document.body.classList.add("ashen-dialog-open");
    this.render();
    resetDialogScroll(this.overlay);
  }

  close() {
    this.visible = false;
    this.overlay.hidden = true;
    document.body.classList.remove("ashen-dialog-open");
    this.npcId = "";
    this.activeLineId = null;
  }

  private isTraderMan() {
    return this.npcKind === GUARD_NPC_TRADER_MAN;
  }

  private render() {
    this.updateStandingPill();
    this.speechListEl.replaceChildren();
    for (const line of ASHEN_TRADER_DIALOG_LINES) {
      if (
        line.action === "board" &&
        (!this.isTraderMan() || !isAshenMarketTraderId(this.npcId))
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
          : this.isTraderMan() && line.action === "board"
            ? "banknote"
            : undefined;
      fillSpeechButton(btn, line.player, iconId);
      btn.addEventListener("click", () => {
        this.activeLineId = line.id;
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
      });
      this.speechListEl.appendChild(btn);
    }

    const active = ASHEN_TRADER_DIALOG_LINES.find(
      (l) => l.id === this.activeLineId,
    );
    if (active) {
      this.responseEl.classList.remove("red-dialog-response--empty");
      const variants =
        !this.isTraderMan() && active.npcGuard
          ? active.npcGuard
          : active.npcMan;
      this.responseEl.textContent = pickDialogVariant(
        variants,
        `${this.npcId}|${active.id}`,
      );
    } else {
      this.responseEl.classList.add("red-dialog-response--empty");
      this.responseEl.textContent = "Waiting for you to speak…";
    }
  }

  private updateStandingPill() {
    const standing = ashenStanding(this.ashenReputation);
    this.standingPillEl.textContent = ashenStandingLabel(standing);
    this.standingPillEl.className = `trader-standing-pill trader-standing-pill--${standing}`;
    this.standingPillEl.title = `${ASHEN_TRADERS_FACTION}: ${Number(this.ashenReputation.toFixed(1))}`;
  }
}
