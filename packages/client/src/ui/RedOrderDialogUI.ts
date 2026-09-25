import {
  RED_ORDER_ASHEN_PATROL_TASK,
  RED_ORDER_DIALOG_LINES,
  RED_ORDER_FACTION,
  RED_ORDER_REP_START,
  canAcceptQuest,
  canTurnInQuest,
  getQuestDefinition,
  parseQuestsJson,
  pickDialogVariant,
  redOrderStanding,
  redOrderStandingLabel,
  normalizeRedManSkin,
  questStatusOf,
} from "@zombie/shared";
import { appendItemIcon } from "./itemIcons";
import { createDialogCloseButton } from "./dialogCloseBtn";
import { resetDialogScroll } from "./dialogScroll";
import { playerAvatarSrc } from "./playerAvatar";

export type RedOrderDialogUIHandlers = {
  onClose: () => void;
  onAcceptQuest: (questId: string) => void;
  onCompleteTask: (taskId: string) => void;
};

function redManAvatar(skin: number): string {
  const s = normalizeRedManSkin(skin);
  return `/assets/UI/RedMan${s}/RedMan${s}_Avatar.png`;
}

function makeDisplayCell(opts: {
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

  if (opts.qtyLabel) {
    const qty = document.createElement("span");
    qty.className = "inventory-cell-qty";
    qty.textContent = opts.qtyLabel;
    cell.appendChild(qty);
  }

  return cell;
}

export class RedOrderDialogUI {
  private visible = false;
  private npcId = "";
  private npcSkin = 1;
  private redOrderReputation = RED_ORDER_REP_START;
  private dogtagCount = 0;
  private questsJson = "";
  private activeLineId: string | null = null;
  private denyTaskId = "";
  private denyReason = "";

  private overlay: HTMLElement;
  private playerAvatarEl: HTMLImageElement;
  private playerTitleEl: HTMLElement;
  private npcAvatarEl: HTMLImageElement;
  private standingPillEl: HTMLElement;
  private speechListEl: HTMLElement;
  private responseEl: HTMLElement;

  constructor(private handlers: RedOrderDialogUIHandlers) {
    this.overlay = document.createElement("div");
    this.overlay.id = "red-order-dialog-overlay";
    this.overlay.hidden = true;

    const layout = document.createElement("div");
    layout.className = "red-dialog-layout";

    const toolbar = document.createElement("div");
    toolbar.className = "red-dialog-toolbar";
    toolbar.append(createDialogCloseButton(() => this.handlers.onClose()));

    const columns = document.createElement("div");
    columns.className = "red-dialog-columns";

    // Player panel (speech options)
    const playerPanel = document.createElement("div");
    playerPanel.className = "inventory-panel red-dialog-panel";
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

    // NPC panel (response)
    const npcPanel = document.createElement("div");
    npcPanel.className = "inventory-panel red-dialog-panel";
    const npcHeader = document.createElement("div");
    npcHeader.className = "inventory-header trader-panel-header";
    this.npcAvatarEl = document.createElement("img");
    this.npcAvatarEl.className = "trader-avatar";
    this.npcAvatarEl.src = redManAvatar(1);
    this.npcAvatarEl.alt = RED_ORDER_FACTION;
    const npcTitleWrap = document.createElement("div");
    npcTitleWrap.className = "trader-panel-header-text";
    const npcTitleRow = document.createElement("div");
    npcTitleRow.className = "trader-title-row";
    const npcTitle = document.createElement("h2");
    npcTitle.className = "inventory-title";
    npcTitle.textContent = RED_ORDER_FACTION;
    this.standingPillEl = document.createElement("div");
    this.standingPillEl.className =
      "trader-standing-pill trader-standing-pill--wary";
    this.standingPillEl.textContent = "Wary";
    npcTitleRow.append(npcTitle, this.standingPillEl);
    const npcHint = document.createElement("span");
    npcHint.className = "inventory-hint";
    npcHint.textContent = "Their reply";
    npcTitleWrap.append(npcTitleRow, npcHint);
    npcHeader.append(this.npcAvatarEl, npcTitleWrap);

    const npcBody = document.createElement("div");
    npcBody.className = "red-dialog-body";
    this.responseEl = document.createElement("div");
    this.responseEl.className = "red-dialog-response red-dialog-response--empty";
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
    npcSkin: number;
    playerName?: string;
    redOrderReputation?: number;
    dogtagCount?: number;
    clothingSkin?: number;
    questsJson?: string;
  }) {
    this.npcId = opts.npcId;
    this.npcSkin = normalizeRedManSkin(opts.npcSkin);
    this.npcAvatarEl.src = redManAvatar(this.npcSkin);
    this.playerTitleEl.textContent = opts.playerName?.trim() || "You";
    this.playerAvatarEl.src = playerAvatarSrc(opts.clothingSkin);
    this.redOrderReputation = opts.redOrderReputation ?? RED_ORDER_REP_START;
    this.dogtagCount = opts.dogtagCount ?? 0;
    this.questsJson = opts.questsJson ?? "";
    this.activeLineId = null;
    this.visible = true;
    this.overlay.hidden = false;
    document.body.classList.add("red-order-dialog-open");
    this.render();
    resetDialogScroll(this.overlay);
  }

  noteDenied(taskId: string, reason: string) {
    if (!this.visible) return;
    this.denyTaskId = taskId;
    this.denyReason = reason;
    this.activeLineId = "jobs";
    this.render();
  }

  /** Refresh turn-in eligibility / standing while the dialog stays open. */
  sync(opts: {
    dogtagCount?: number;
    redOrderReputation?: number;
    questsJson?: string;
  }) {
    if (!this.visible) return;
    if (opts.dogtagCount !== undefined) this.dogtagCount = opts.dogtagCount;
    if (opts.redOrderReputation !== undefined) {
      this.redOrderReputation = opts.redOrderReputation;
    }
    if (opts.questsJson !== undefined) this.questsJson = opts.questsJson;
    this.render();
  }

  close() {
    this.visible = false;
    this.overlay.hidden = true;
    document.body.classList.remove("red-order-dialog-open");
    this.npcId = "";
    this.activeLineId = null;
    this.dogtagCount = 0;
    this.questsJson = "";
  }

  private render() {
    this.updateStandingPill();
    this.speechListEl.replaceChildren();
    for (const line of RED_ORDER_DIALOG_LINES) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "red-dialog-speech-btn";
      if (this.activeLineId === line.id) {
        btn.classList.add("red-dialog-speech-btn--active");
      }
      btn.textContent = line.player;
      btn.addEventListener("click", () => {
        this.activeLineId = line.id;
        this.render();
      });
      this.speechListEl.appendChild(btn);
    }

    const active = RED_ORDER_DIALOG_LINES.find((l) => l.id === this.activeLineId);
    this.responseEl.replaceChildren();
    if (!active) {
      this.responseEl.classList.add("red-dialog-response--empty");
      this.responseEl.textContent = "Waiting for you to speak…";
      return;
    }

    this.responseEl.classList.remove("red-dialog-response--empty");
    const reply = document.createElement("div");
    reply.className = "red-dialog-response-text";
    reply.textContent = pickDialogVariant(
      active.npc,
      `${this.npcId}|${active.id}`,
    );
    this.responseEl.appendChild(reply);

    if (active.id === RED_ORDER_ASHEN_PATROL_TASK.dialogLineId) {
      const def = getQuestDefinition(RED_ORDER_ASHEN_PATROL_TASK.id);
      const finished =
        !!def &&
        !def.repeatable &&
        questStatusOf(parseQuestsJson(this.questsJson), def.id) === "completed";
      if (!finished) this.responseEl.appendChild(this.buildTaskSection());
    }
  }

  private buildTaskSection(): HTMLElement {
    const task = RED_ORDER_ASHEN_PATROL_TASK;
    const section = document.createElement("div");
    section.className = "red-dialog-task";

    const needTitle = document.createElement("div");
    needTitle.className = "red-dialog-task-heading";
    needTitle.textContent = "Task";
    section.appendChild(needTitle);

    const needRow = document.createElement("div");
    needRow.className = "red-dialog-task-row";
    needRow.appendChild(
      makeDisplayCell({
        itemId: task.requireItemId,
        ariaLabel: "Ashen Militia dog tag",
      }),
    );
    section.appendChild(needRow);

    const rewardTitle = document.createElement("div");
    rewardTitle.className = "red-dialog-task-heading";
    rewardTitle.textContent = "Rewards";
    section.appendChild(rewardTitle);

    const rewardRow = document.createElement("div");
    rewardRow.className = "red-dialog-task-row";
    rewardRow.append(
      makeDisplayCell({
        itemId: "banknote",
        qtyLabel: `×${task.rewardBanknotes}`,
        ariaLabel: `${task.rewardBanknotes} banknotes`,
      }),
      makeDisplayCell({
        itemId: "rep",
        qtyLabel: `+${task.rewardReputation}`,
        ariaLabel: `+${task.rewardReputation} Red Order reputation`,
      }),
    );
    section.appendChild(rewardRow);

    const quests = parseQuestsJson(this.questsJson);
    const canAccept = canAcceptQuest(quests, task.id);
    const canComplete =
      canTurnInQuest(quests, task.id) && this.dogtagCount >= task.requireQty;
    if (canComplete) {
      const completeBtn = document.createElement("button");
      completeBtn.type = "button";
      completeBtn.className = "red-dialog-complete-btn";
      completeBtn.textContent = "Complete Task";
      completeBtn.addEventListener("click", () => {
        this.handlers.onCompleteTask(task.id);
      });
      section.appendChild(completeBtn);
    } else if (canAccept) {
      const acceptBtn = document.createElement("button");
      acceptBtn.type = "button";
      acceptBtn.className = "red-dialog-complete-btn";
      acceptBtn.textContent = "Accept Job";
      acceptBtn.addEventListener("click", () => {
        this.handlers.onAcceptQuest(task.id);
      });
      section.appendChild(acceptBtn);
      if (this.dogtagCount >= task.requireQty) {
        const hint = document.createElement("div");
        hint.className = "craft-recipe-hint";
        hint.textContent = "Accept this job, then turn the tags in.";
        section.appendChild(hint);
      }
    } else {
      const hint = document.createElement("div");
      hint.className = "craft-recipe-hint";
      hint.textContent =
        this.dogtagCount >= task.requireQty
          ? "Come back later for more turn-ins."
          : "Accepted. Bring Ashen dog tags.";
      section.appendChild(hint);
    }

    if (this.denyTaskId === task.id && this.denyReason) {
      const denied = document.createElement("div");
      denied.className = "craft-recipe-hint";
      denied.textContent = this.denyReason;
      section.appendChild(denied);
    }

    return section;
  }

  private updateStandingPill() {
    const standing = redOrderStanding(this.redOrderReputation);
    this.standingPillEl.textContent = redOrderStandingLabel(standing);
    this.standingPillEl.className = `trader-standing-pill trader-standing-pill--${standing}`;
    this.standingPillEl.title = `${RED_ORDER_FACTION}: ${Number(this.redOrderReputation.toFixed(1))}`;
  }
}
