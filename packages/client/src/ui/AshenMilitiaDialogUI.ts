import {
  ASHEN_MILITIA_DIALOG_LINES,
  ASHEN_MILITIA_FACTION,
  ASHEN_MILITIA_CAPTAIN_DIALOG_LINES,
  ASHEN_MILITIA_CAPTAIN_NAME,
  ASHEN_MILITIA_CAPTAIN_TASKS,
  ASHEN_MILITIA_DOCTOR_DIALOG_LINES,
  ASHEN_MILITIA_DOCTOR_NAME,
  ASHEN_MILITIA_DOCTOR_TASKS,
  ASHEN_MILITIA_DOCTOR_HEAL_COST,
  ASHEN_MILITIA_TASK_WINDOW_MS,
  ASHEN_REP_START,
  ashenMilitiaDoctorHealReplies,
  ashenMilitiaDoctorNeedsTreatment,
  ashenMilitiaStanding,
  ashenMilitiaStandingLabel,
  countItemInInventory,
  isMilitiaCaptainSkin,
  isMilitiaDoctorSkin,
  militiaGuardArtSkin,
  parseInventory,
  parseQuestsJson,
  canAcceptQuest,
  canTurnInQuest,
  pickDialogVariant,
  PLAYER_MAX_HEALTH,
  type AshenMilitiaTask,
} from "@zombie/shared";
import { appendItemIcon } from "./itemIcons";
import { createDialogCloseButton } from "./dialogCloseBtn";
import { resetDialogScroll } from "./dialogScroll";
import { playerAvatarSrc } from "./playerAvatar";

export type AshenMilitiaDialogUIHandlers = {
  onClose: () => void;
  onAcceptQuest: (questId: string) => void;
  onCompleteTask: (taskId: string) => void;
  onHeal?: () => void;
};

function militiaGuardAvatar(skin: number): string {
  const s = militiaGuardArtSkin(skin);
  return `/assets/UI/MilitiaGuard${s}/MilitiaGuard${s}_Avatar.png`;
}

const CAPTAIN_AVATAR =
  "/assets/UI/MilitiaCaptain1/MilitiaCaptain1_Avatar.png";
const DOCTOR_AVATAR =
  "/assets/UI/MilitiaDoctor1/MilitiaDoctor1_Avatar.png";

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

export class AshenMilitiaDialogUI {
  private visible = false;
  private npcId = "";
  private npcSkin = 1;
  private inInterior = false;
  private isCaptain = false;
  private isDoctor = false;
  private ashenReputation = ASHEN_REP_START;
  private inventoryJson = "[]";
  private playerHealth = PLAYER_MAX_HEALTH;
  private playerInfected = false;
  /** Completions used in the current rolling window, keyed by task id. */
  private taskCompletions: Record<string, number> = {};
  private questsJson = "";
  private doctorHealCost = ASHEN_MILITIA_DOCTOR_HEAL_COST;
  private activeLineId: string | null = null;
  /** Task id currently expanded on the jobs reply (null = all collapsed). */
  private expandedTaskId: string | null = null;

  private overlay: HTMLElement;
  private playerAvatarEl: HTMLImageElement;
  private playerTitleEl: HTMLElement;
  private npcAvatarEl: HTMLImageElement;
  private npcTitleEl: HTMLElement;
  private standingPillEl: HTMLElement;
  private speechListEl: HTMLElement;
  private responseEl: HTMLElement;

  constructor(private handlers: AshenMilitiaDialogUIHandlers) {
    this.overlay = document.createElement("div");
    this.overlay.id = "ashen-militia-dialog-overlay";
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
    this.npcAvatarEl.src = militiaGuardAvatar(1);
    this.npcAvatarEl.alt = ASHEN_MILITIA_FACTION;
    const npcTitleWrap = document.createElement("div");
    npcTitleWrap.className = "trader-panel-header-text";
    const npcTitleRow = document.createElement("div");
    npcTitleRow.className = "trader-title-row";
    this.npcTitleEl = document.createElement("h2");
    this.npcTitleEl.className = "inventory-title";
    this.npcTitleEl.textContent = ASHEN_MILITIA_FACTION;
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
      "red-dialog-response red-dialog-response--empty ashen-dialog-reply";
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
    ashenMilitiaReputation?: number;
    ashenReputation?: number;
    clothingSkin?: number;
    inInterior?: boolean;
    inventoryJson?: string;
    playerHealth?: number;
    playerInfected?: boolean;
    taskCompletionsJson?: string;
    questsJson?: string;
    doctorHealCost?: number;
  }) {
    this.npcId = opts.npcId;
    this.npcSkin = opts.npcSkin;
    this.inInterior = !!opts.inInterior;
    this.isCaptain = isMilitiaCaptainSkin(opts.npcSkin);
    this.isDoctor = isMilitiaDoctorSkin(opts.npcSkin);
    const npcName = this.isDoctor
      ? ASHEN_MILITIA_DOCTOR_NAME
      : this.isCaptain
        ? ASHEN_MILITIA_CAPTAIN_NAME
        : ASHEN_MILITIA_FACTION;
    this.npcAvatarEl.src = this.isDoctor
      ? DOCTOR_AVATAR
      : this.isCaptain
        ? CAPTAIN_AVATAR
        : militiaGuardAvatar(opts.npcSkin);
    this.npcAvatarEl.alt = npcName;
    this.npcTitleEl.textContent = npcName;
    this.playerTitleEl.textContent = opts.playerName?.trim() || "You";
    this.playerAvatarEl.src = playerAvatarSrc(opts.clothingSkin);
    this.ashenReputation =
      opts.ashenMilitiaReputation ??
      opts.ashenReputation ??
      ASHEN_REP_START;
    this.inventoryJson = opts.inventoryJson ?? "[]";
    this.playerHealth = opts.playerHealth ?? PLAYER_MAX_HEALTH;
    this.playerInfected = !!opts.playerInfected;
    this.taskCompletions = this.parseTaskCompletions(opts.taskCompletionsJson);
    this.questsJson = opts.questsJson ?? "";
    this.doctorHealCost =
      typeof opts.doctorHealCost === "number" && opts.doctorHealCost > 0
        ? Math.round(opts.doctorHealCost)
        : ASHEN_MILITIA_DOCTOR_HEAL_COST;
    this.activeLineId = null;
    this.expandedTaskId = null;
    this.visible = true;
    this.overlay.hidden = false;
    document.body.classList.add("ashen-dialog-open");
    this.render();
    resetDialogScroll(this.overlay);
  }

  sync(opts: {
    inventoryJson?: string;
    ashenMilitiaReputation?: number;
    ashenReputation?: number;
    playerHealth?: number;
    playerInfected?: boolean;
    taskCompletionsJson?: string;
    questsJson?: string;
  }) {
    if (opts.inventoryJson != null) this.inventoryJson = opts.inventoryJson;
    if (opts.ashenMilitiaReputation != null) {
      this.ashenReputation = opts.ashenMilitiaReputation;
    } else if (opts.ashenReputation != null) {
      this.ashenReputation = opts.ashenReputation;
    }
    if (opts.playerHealth != null) this.playerHealth = opts.playerHealth;
    if (opts.playerInfected != null) this.playerInfected = !!opts.playerInfected;
    if (opts.taskCompletionsJson != null) {
      this.taskCompletions = this.parseTaskCompletions(opts.taskCompletionsJson);
    }
    if (opts.questsJson != null) this.questsJson = opts.questsJson;
    if (this.visible) this.render();
  }

  close() {
    this.visible = false;
    this.overlay.hidden = true;
    document.body.classList.remove("ashen-dialog-open");
    this.npcId = "";
    this.activeLineId = null;
    this.expandedTaskId = null;
    this.isCaptain = false;
    this.isDoctor = false;
    this.inInterior = false;
    this.playerInfected = false;
    this.taskCompletions = {};
    this.questsJson = "";
  }

  private parseTaskCompletions(json: string | undefined): Record<string, number> {
    if (!json) return {};
    try {
      const parsed = JSON.parse(json) as unknown;
      if (!parsed || typeof parsed !== "object") return {};
      const out: Record<string, number> = {};
      for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
        const n = Number(v);
        if (Number.isFinite(n) && n >= 0) out[k] = Math.floor(n);
      }
      return out;
    } catch {
      return {};
    }
  }

  private dialogLines() {
    if (this.isDoctor) return ASHEN_MILITIA_DOCTOR_DIALOG_LINES;
    if (this.isCaptain) return ASHEN_MILITIA_CAPTAIN_DIALOG_LINES;
    return ASHEN_MILITIA_DIALOG_LINES;
  }

  private itemCount(itemId: string): number {
    return countItemInInventory(parseInventory(this.inventoryJson), itemId);
  }

  private render() {
    this.updateStandingPill();
    const lines = this.dialogLines();
    this.speechListEl.replaceChildren();
    for (const line of lines) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "red-dialog-speech-btn ashen-dialog-speech-btn";
      if (this.activeLineId === line.id) {
        btn.classList.add("red-dialog-speech-btn--active");
        btn.classList.add("ashen-dialog-speech-btn--active");
      }
      btn.textContent = line.player;
      btn.addEventListener("click", () => {
        if (this.activeLineId !== line.id) this.expandedTaskId = null;
        this.activeLineId = line.id;
        this.render();
      });
      this.speechListEl.appendChild(btn);
    }

    const active = lines.find((l) => l.id === this.activeLineId);
    this.responseEl.replaceChildren();
    if (!active) {
      this.responseEl.classList.add("red-dialog-response--empty");
      this.responseEl.textContent = "Waiting for you to speak…";
      return;
    }

    this.responseEl.classList.remove("red-dialog-response--empty");
    const reply = document.createElement("div");
    reply.className = "red-dialog-response-text";
    const guardLine = active as (typeof ASHEN_MILITIA_DIALOG_LINES)[number];
    const variants =
      this.isDoctor && active.id === "heal"
        ? ashenMilitiaDoctorHealReplies(
            this.playerHealth,
            PLAYER_MAX_HEALTH,
            this.playerInfected,
          )
        : !this.isCaptain &&
            !this.isDoctor &&
            this.inInterior &&
            "npcInterior" in guardLine &&
            guardLine.npcInterior
          ? guardLine.npcInterior
          : active.npc;
    reply.textContent = pickDialogVariant(
      variants,
      `${this.npcId}|${active.id}|${this.inInterior ? "in" : "out"}|${
        this.isDoctor && active.id === "heal"
          ? `${Math.floor(this.playerHealth)}|${this.playerInfected ? 1 : 0}`
          : ""
      }`,
    );
    this.responseEl.appendChild(reply);

    if (this.isDoctor && active.id === "heal") {
      const list = document.createElement("div");
      list.className = "craft-recipe-list red-dialog-task-list";
      list.appendChild(this.buildHealSection());
      this.responseEl.appendChild(list);
    }

    if (
      (this.isCaptain || this.isDoctor) &&
      active.id === "jobs"
    ) {
      const tasks = this.isDoctor
        ? ASHEN_MILITIA_DOCTOR_TASKS
        : ASHEN_MILITIA_CAPTAIN_TASKS;
      const list = document.createElement("div");
      list.className = "craft-recipe-list red-dialog-task-list";
      for (const task of tasks) {
        list.appendChild(this.buildTaskSection(task));
      }
      this.responseEl.appendChild(list);
    }
  }

  private buildHealSection(): HTMLElement {
    const section = document.createElement("div");
    section.className = "craft-recipe craft-recipe--expanded";
    const banknotes = this.itemCount("banknote");
    const needsTreatment = ashenMilitiaDoctorNeedsTreatment(
      this.playerHealth,
      this.playerInfected,
    );
    const canPay = banknotes >= this.doctorHealCost;
    const canHeal = needsTreatment && canPay;

    const details = document.createElement("div");
    details.className = "craft-recipe-details";

    const costTitle = document.createElement("div");
    costTitle.className = "red-dialog-task-heading";
    costTitle.textContent = this.playerInfected
      ? "Heal and clear infection"
      : "Treatment";
    details.appendChild(costTitle);

    const costRow = document.createElement("div");
    costRow.className = "red-dialog-task-row";
    costRow.appendChild(
      makeDisplayCell({
        itemId: "banknote",
        qtyLabel: `×${this.doctorHealCost}`,
        ariaLabel: `${this.doctorHealCost} banknotes`,
      }),
    );
    details.appendChild(costRow);

    if (canHeal) {
      section.classList.add("craft-recipe--ready");
      const healBtn = document.createElement("button");
      healBtn.type = "button";
      healBtn.className = "red-dialog-complete-btn";
      healBtn.textContent = `Pay $${this.doctorHealCost}`;
      healBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.handlers.onHeal?.();
      });
      details.appendChild(healBtn);
    } else {
      const hint = document.createElement("div");
      hint.className = "craft-recipe-hint";
      hint.textContent = !needsTreatment
        ? "You're already at full health"
        : `Need $${this.doctorHealCost} (you have $${banknotes})`;
      details.appendChild(hint);
    }

    section.appendChild(details);
    return section;
  }

  private buildTaskSection(task: AshenMilitiaTask): HTMLElement {
    const used = this.taskCompletions[task.id] ?? 0;
    const max = task.maxCompletionsPerWindow;
    const cappedRemaining =
      max != null ? Math.max(0, max - used) : null;
    const atCap = cappedRemaining === 0;
    const quests = parseQuestsJson(this.questsJson);
    const accepted = canTurnInQuest(quests, task.id);
    const haveItems = this.itemCount(task.requireItemId) >= task.requireQty;
    const canAccept = !atCap && canAcceptQuest(quests, task.id);
    const canComplete = accepted && haveItems;
    const expanded = this.expandedTaskId === task.id;

    const section = document.createElement("div");
    section.className = "craft-recipe";
    if (expanded) section.classList.add("craft-recipe--expanded");
    if (canComplete) section.classList.add("craft-recipe--ready");

    const summary = document.createElement("button");
    summary.type = "button";
    summary.className = "craft-recipe-summary";
    summary.setAttribute("aria-expanded", expanded ? "true" : "false");
    summary.setAttribute(
      "aria-label",
      `${expanded ? "Collapse" : "Expand"} ${task.label} task`,
    );
    summary.appendChild(
      makeDisplayCell({
        itemId: task.requireItemId,
        qtyLabel: `×${task.requireQty}`,
        ariaLabel: `${task.requireQty} ${task.requireItemLabel}`,
      }),
    );

    const label = document.createElement("div");
    label.className = "craft-recipe-summary-text";
    const nameEl = document.createElement("span");
    nameEl.className = "craft-recipe-summary-name";
    nameEl.textContent = task.label;
    const meta = document.createElement("span");
    meta.className = "craft-recipe-summary-meta";
    if (atCap) {
      meta.textContent = `Daily limit reached (${max}/day)`;
    } else if (canComplete) {
      meta.textContent =
        cappedRemaining != null
          ? `Ready to turn in (${cappedRemaining} left today)`
          : "Ready to turn in";
    } else if (canAccept) {
      meta.textContent = haveItems
        ? "Accept this job to turn in"
        : "Available · accept to start";
    } else if (accepted) {
      meta.textContent = `Need ×${task.requireQty} ${task.requireItemLabel}`;
    } else {
      meta.textContent = `Need ×${task.requireQty} ${task.requireItemLabel}`;
    }
    label.append(nameEl, meta);
    summary.appendChild(label);

    const chevron = document.createElement("span");
    chevron.className = "craft-recipe-chevron";
    chevron.setAttribute("aria-hidden", "true");
    chevron.textContent = expanded ? "▾" : "▸";
    summary.appendChild(chevron);

    summary.addEventListener("click", () => {
      this.expandedTaskId =
        this.expandedTaskId === task.id ? null : task.id;
      this.render();
    });
    section.appendChild(summary);

    if (!expanded) return section;

    const details = document.createElement("div");
    details.className = "craft-recipe-details";

    const needTitle = document.createElement("div");
    needTitle.className = "red-dialog-task-heading";
    needTitle.textContent = "Turn in";
    details.appendChild(needTitle);

    const needRow = document.createElement("div");
    needRow.className = "red-dialog-task-row";
    needRow.appendChild(
      makeDisplayCell({
        itemId: task.requireItemId,
        qtyLabel: `×${task.requireQty}`,
        ariaLabel: `${task.requireQty} ${task.requireItemLabel}`,
      }),
    );
    details.appendChild(needRow);

    const rewardTitle = document.createElement("div");
    rewardTitle.className = "red-dialog-task-heading";
    rewardTitle.textContent = "Rewards";
    details.appendChild(rewardTitle);

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
        ariaLabel: `+${task.rewardReputation} Ashen Militia reputation`,
      }),
    );
    details.appendChild(rewardRow);

    if (max != null) {
      const capHint = document.createElement("div");
      capHint.className = "craft-recipe-hint";
      const windowHrs = Math.round(
        (task.completionWindowMs ?? ASHEN_MILITIA_TASK_WINDOW_MS) / 3_600_000,
      );
      capHint.textContent = `${used}/${max} completed in the last ${windowHrs}h`;
      details.appendChild(capHint);
    }

    if (canComplete) {
      const completeBtn = document.createElement("button");
      completeBtn.type = "button";
      completeBtn.className = "red-dialog-complete-btn";
      completeBtn.textContent = "Complete Task";
      completeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.handlers.onCompleteTask(task.id);
      });
      details.appendChild(completeBtn);
    } else if (canAccept) {
      const acceptBtn = document.createElement("button");
      acceptBtn.type = "button";
      acceptBtn.className = "red-dialog-complete-btn";
      acceptBtn.textContent = "Accept Job";
      acceptBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.handlers.onAcceptQuest(task.id);
      });
      details.appendChild(acceptBtn);
      const hint = document.createElement("div");
      hint.className = "craft-recipe-hint";
      hint.textContent = haveItems
        ? "Accept this job, then turn the items in."
        : `Missing ${task.requireItemLabel.toLowerCase()}`;
      details.appendChild(hint);
    } else {
      const hint = document.createElement("div");
      hint.className = "craft-recipe-hint";
      hint.textContent = atCap
        ? "Come back later for more turn-ins"
        : accepted
          ? `Missing ${task.requireItemLabel.toLowerCase()}`
          : "This job is not available right now.";
      details.appendChild(hint);
    }

    section.appendChild(details);
    return section;
  }

  private updateStandingPill() {
    const standing = ashenMilitiaStanding(this.ashenReputation);
    this.standingPillEl.textContent = ashenMilitiaStandingLabel(standing);
    this.standingPillEl.className = `trader-standing-pill trader-standing-pill--${standing}`;
    this.standingPillEl.title = `${ASHEN_MILITIA_FACTION}: ${Number(this.ashenReputation.toFixed(1))}`;
  }
}
