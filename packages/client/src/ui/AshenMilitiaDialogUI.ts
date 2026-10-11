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
  QUEST_MISSING_PAIR_BONUS_AMMO,
  ashenMilitiaDoctorHealReplies,
  ashenMilitiaDoctorNeedsTreatment,
  ashenMilitiaStanding,
  ashenMilitiaStandingLabel,
  canAddToInventory,
  countItemInInventory,
  getQuestDefinition,
  inventoryAfterTurnIn,
  isMilitiaCaptainSkin,
  isMilitiaDoctorSkin,
  davisPostsOnlyFirstSweep,
  isQuestActive,
  isQuestListed,
  militiaGuardArtSkin,
  parseInventory,
  parseQuestsJson,
  canAcceptQuest,
  canTurnInQuest,
  questAssignedLocationLabel,
  questCompletionsRemaining,
  questFlag,
  questObjectiveLine,
  isQuestObjectiveDone,
  questStatusOf,
  pickDialogVariant,
  questRewardReputation,
  STORY_QUESTS,
  STORY_LINE_WHAT_HAPPENED,
  STORY_LINE_YOU_WANTED,
  STORY_FOUND_REPLY,
  STORY_DAVIS_REPLY,
  STORY_OBJECTIVE_ASK_CLARK,
  STORY_OBJECTIVE_ASK_DAVIS,
  QUEST_ID_AYE_CAPTAIN,
  QUEST_ID_FOUND_ON_THE_ROAD,
  QUEST_ID_KNEW_THE_NAME,
  STORY_TURN_IN_ITEMS,
  STORY_ITEM_LABELS,
  COLEMAN_NAME,
  isColemanStoryNpcId,
  storySpeechLines,
  type QuestDefinition,
  type PlayerQuestsState,
  type QuestGiverId,
  PLAYER_MAX_HEALTH,
  type AshenMilitiaTask,
} from "@zombie/shared";
import { appendItemIcon, fillSpeechButton, markQuestKeepsake, markSpeechQuest } from "./itemIcons";
import { createDialogCloseButton } from "./dialogCloseBtn";
import { resetDialogScroll } from "./dialogScroll";
import { playerAvatarSrc } from "./playerAvatar";

export type AshenMilitiaDialogUIHandlers = {
  onClose: () => void;
  onAcceptQuest: (questId: string) => void;
  onCompleteTask: (taskId: string) => void;
  onChooseLine?: (lineId: string) => void;
  onHeal?: () => void;
};

function progressQtyLabel(
  state: PlayerQuestsState,
  def: QuestDefinition,
): string | undefined {
  const objs = def.objectives.filter((o) => o.kind !== "turnInItem");
  if (objs.length === 0) return undefined;
  const focus =
    objs.find((obj) => {
      const need = Math.max(1, obj.count ?? 1);
      return (state.quests[def.id]?.progress[obj.id] ?? 0) < need;
    }) ?? objs[objs.length - 1];
  if (!focus) return undefined;
  const need = Math.max(1, focus.count ?? 1);
  const have = Math.min(need, state.quests[def.id]?.progress[focus.id] ?? 0);
  return `${have}/${need}`;
}

type MilitiaDialogLine = {
  id: string;
  player: string;
  npc: readonly string[];
  npcInterior?: readonly string[];
};

const COLEMAN_SILENT_LINE: MilitiaDialogLine = {
  id: "coleman_silent",
  player: "Sergeant Coleman?",
  npc: ["Go on. Davis is waiting."],
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
  markQuestKeepsake(cell, opts.itemId);

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
  private isColeman = false;
  private ashenReputation = ASHEN_REP_START;
  private inventoryJson = "[]";
  private extraPockets = 0;
  private playerHealth = PLAYER_MAX_HEALTH;
  private playerInfected = false;
  /** Completions used in the current rolling window, keyed by task id. */
  private taskCompletions: Record<string, number> = {};
  private questsJson = "";
  private tutorialDone = false;
  private doctorHealCost = ASHEN_MILITIA_DOCTOR_HEAL_COST;
  private activeLineId: string | null = null;
  /** Hand-in speech kept on screen after the quest state refreshes. */
  private scriptedLineId: string | null = null;
  private scriptedReply: string | null = null;
  /** Task id currently expanded on the jobs reply (null = all collapsed). */
  private expandedTaskId: string | null = null;
  private denyTaskId = "";
  private denyReason = "";

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
    this.responseEl.textContent = "Waiting for you to say something...";
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

  noteDenied(taskId: string, reason: string) {
    if (!this.visible) return;
    this.denyTaskId = taskId;
    this.denyReason = reason;
    this.expandedTaskId = taskId;
    this.activeLineId = "jobs";
    this.render();
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
    tutorialDone?: boolean;
    doctorHealCost?: number;
    extraPockets?: number;
  }) {
    this.npcId = opts.npcId;
    this.npcSkin = opts.npcSkin;
    this.inInterior = !!opts.inInterior;
    this.isColeman = isColemanStoryNpcId(opts.npcId);
    this.isCaptain = !this.isColeman && isMilitiaCaptainSkin(opts.npcSkin);
    this.isDoctor = !this.isColeman && isMilitiaDoctorSkin(opts.npcSkin);
    const npcName = this.isColeman
      ? COLEMAN_NAME
      : this.isDoctor
        ? ASHEN_MILITIA_DOCTOR_NAME
        : this.isCaptain
          ? ASHEN_MILITIA_CAPTAIN_NAME
          : ASHEN_MILITIA_FACTION;
    this.standingPillEl.hidden = this.isColeman;
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
    this.extraPockets = opts.extraPockets ?? 0;
    this.playerHealth = opts.playerHealth ?? PLAYER_MAX_HEALTH;
    this.playerInfected = !!opts.playerInfected;
    this.taskCompletions = this.parseTaskCompletions(opts.taskCompletionsJson);
    this.questsJson = opts.questsJson ?? "";
    this.tutorialDone = opts.tutorialDone === true;
    this.doctorHealCost =
      typeof opts.doctorHealCost === "number" && opts.doctorHealCost > 0
        ? Math.round(opts.doctorHealCost)
        : ASHEN_MILITIA_DOCTOR_HEAL_COST;
    this.activeLineId = null;
    this.scriptedLineId = null;
    this.scriptedReply = null;
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
    tutorialDone?: boolean;
    extraPockets?: number;
  }) {
    if (opts.inventoryJson != null) this.inventoryJson = opts.inventoryJson;
    if (opts.extraPockets != null) this.extraPockets = opts.extraPockets;
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
    if (opts.tutorialDone != null) this.tutorialDone = opts.tutorialDone;
    if (this.visible) this.render();
  }

  close() {
    this.visible = false;
    this.overlay.hidden = true;
    document.body.classList.remove("ashen-dialog-open");
    this.npcId = "";
    this.activeLineId = null;
    this.scriptedLineId = null;
    this.scriptedReply = null;
    this.expandedTaskId = null;
    this.isCaptain = false;
    this.isDoctor = false;
    this.isColeman = false;
    this.inInterior = false;
    this.playerInfected = false;
    this.taskCompletions = {};
    this.questsJson = "";
    this.tutorialDone = false;
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

  private dialogLines(): readonly MilitiaDialogLine[] {
    if (this.isColeman) {
      const lines = storySpeechLines(
        "coleman",
        parseQuestsJson(this.questsJson),
        (itemId) => this.itemCount(itemId),
      ).map((line) => ({ id: line.id, player: line.player, npc: [line.reply ?? "…"] }));
      return lines.length > 0 ? lines : [COLEMAN_SILENT_LINE];
    }
    if (this.isDoctor) return ASHEN_MILITIA_DOCTOR_DIALOG_LINES;
    if (this.isCaptain) {
      const quests = parseQuestsJson(this.questsJson);
      if (isQuestActive(quests, QUEST_ID_AYE_CAPTAIN)) {
        return ASHEN_MILITIA_CAPTAIN_DIALOG_LINES;
      }
      return ASHEN_MILITIA_CAPTAIN_DIALOG_LINES.filter(
        (line) => line.id !== STORY_LINE_YOU_WANTED,
      );
    }
    return ASHEN_MILITIA_DIALOG_LINES;
  }

  /** Ask the server to advance a story line, and keep that reply on screen. */
  speak(lineId: string, text: string) {
    this.scriptedLineId = lineId;
    this.scriptedReply = text;
    if (this.activeLineId !== lineId) this.activeLineId = lineId;
    if (this.visible) this.render();
  }

  /** Davis's words on a story hand-in, kept on screen while the next quest is offered. */
  showReply(text: string) {
    this.scriptedLineId = "story_turn_in";
    this.scriptedReply = text;
    this.activeLineId = "story_turn_in";
    if (this.visible) this.render();
  }

  /** Speech that only exists to advance a story quest. */
  private isQuestChat(lineId: string): boolean {
    if (this.isColeman) return lineId !== COLEMAN_SILENT_LINE.id;
    if (this.isCaptain && lineId === STORY_LINE_YOU_WANTED) return true;
    if (this.isDoctor && lineId === STORY_LINE_WHAT_HAPPENED) {
      return this.storyPromptPending(lineId);
    }
    return false;
  }

  private storyPromptPending(lineId: string): boolean {
    const quests = parseQuestsJson(this.questsJson);
    if (this.isDoctor && lineId === STORY_LINE_WHAT_HAPPENED) {
      const quest = quests.quests[QUEST_ID_FOUND_ON_THE_ROAD];
      return (
        !!quest &&
        quest.status === "active" &&
        (quest.progress[STORY_OBJECTIVE_ASK_CLARK] ?? 0) < 1
      );
    }
    if (this.isCaptain && lineId === STORY_LINE_YOU_WANTED) {
      const quest = quests.quests[QUEST_ID_AYE_CAPTAIN];
      return (
        !!quest &&
        quest.status === "active" &&
        (quest.progress[STORY_OBJECTIVE_ASK_DAVIS] ?? 0) < 1
      );
    }
    return false;
  }

  private storyReplyText(lineId: string): string | null {
    if (lineId === STORY_LINE_WHAT_HAPPENED) return STORY_FOUND_REPLY;
    if (lineId === STORY_LINE_YOU_WANTED) return STORY_DAVIS_REPLY;
    return null;
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
      const iconId =
        (this.isCaptain || this.isDoctor) && line.id === "jobs"
          ? "journal"
          : this.isDoctor && line.id === "heal"
            ? "bandages"
            : undefined;
      fillSpeechButton(btn, line.player, iconId);
      if (this.isQuestChat(line.id)) markSpeechQuest(btn);
      btn.addEventListener("click", () => {
        if (this.activeLineId !== line.id) this.expandedTaskId = null;
        this.activeLineId = line.id;
        const scripted = this.storyReplyText(line.id);
        if (this.isColeman && line.id !== COLEMAN_SILENT_LINE.id) {
          this.scriptedLineId = line.id;
          this.scriptedReply = line.npc[0] ?? "…";
          this.handlers.onChooseLine?.(line.id);
        } else if (scripted && this.storyPromptPending(line.id)) {
          this.scriptedLineId = line.id;
          this.scriptedReply = scripted;
          this.handlers.onChooseLine?.(line.id);
        } else if (this.scriptedLineId !== line.id) {
          this.scriptedLineId = null;
          this.scriptedReply = null;
        }
        this.render();
      });
      this.speechListEl.appendChild(btn);
    }

    let active = lines.find((l) => l.id === this.activeLineId);
    if (!active && this.scriptedReply && this.scriptedLineId === this.activeLineId) {
      // The line that was spoken can vanish once its step is done. Keep the reply.
      this.responseEl.replaceChildren();
      this.responseEl.classList.remove("red-dialog-response--empty");
      const kept = document.createElement("div");
      kept.className = "red-dialog-response-text";
      kept.textContent = this.scriptedReply;
      this.responseEl.appendChild(kept);
      this.appendStoryQuests();
      return;
    }
    this.responseEl.replaceChildren();
    if (!active) {
      this.responseEl.classList.remove("red-dialog-response--empty");
      const waiting = document.createElement("div");
      waiting.className = "red-dialog-response-text red-dialog-response--empty";
      waiting.textContent = "Waiting for you to say something...";
      this.responseEl.appendChild(waiting);
      this.appendStoryQuests();
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
    const questsForReply = parseQuestsJson(this.questsJson);
    const boardClosed =
      this.isCaptain &&
      active.id === "jobs" &&
      davisPostsOnlyFirstSweep(questsForReply, this.tutorialDone);
    reply.textContent =
      this.scriptedReply && this.scriptedLineId === active.id
        ? this.scriptedReply
        : boardClosed
      ? "The board can wait until you're settled. The story is the work I have for you."
      : pickDialogVariant(
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
      const quests = parseQuestsJson(this.questsJson);
      const list = document.createElement("div");
      list.className = "craft-recipe-list red-dialog-task-list";
      for (const task of tasks) {
        const def = getQuestDefinition(task.id);
        if (def && !isQuestListed(quests, def)) continue;
        if (boardClosed && !isQuestActive(quests, task.id)) {
          continue;
        }
        list.appendChild(this.buildTaskSection(task));
      }
      if (list.childElementCount > 0) this.responseEl.appendChild(list);
    }
    this.appendStoryQuests();
  }

  private storyGiver(): QuestGiverId | null {
    if (this.isDoctor) return "ashenDoctor";
    if (this.isCaptain) return "ashenCaptain";
    return null;
  }

  private appendStoryQuests() {
    const giver = this.storyGiver();
    if (!giver) return;
    const quests = parseQuestsJson(this.questsJson);
    const defs = STORY_QUESTS.filter((def) => {
      const status = quests.quests[def.id]?.status;
      if (status !== "active" && status !== "available") return false;
      if (def.id === QUEST_ID_AYE_CAPTAIN) {
        return status === "available"
          ? giver === "ashenDoctor"
          : giver === "ashenCaptain";
      }
      return def.giver === giver;
    });
    if (defs.length === 0) return;
    const list = document.createElement("div");
    list.className = "craft-recipe-list red-dialog-task-list";
    for (const def of defs) list.appendChild(this.buildStorySection(def));
    this.responseEl.appendChild(list);
  }

  private buildStorySection(def: QuestDefinition): HTMLElement {
    const quests = parseQuestsJson(this.questsJson);
    const offered = quests.quests[def.id]?.status === "available";
    const ready = !offered && canTurnInQuest(quests, def.id);
    const missingItem =
      offered || def.id === QUEST_ID_KNEW_THE_NAME
        ? undefined
        : (STORY_TURN_IN_ITEMS[def.id] ?? []).find((id) => this.itemCount(id) < 1);
    const needsNote = !!missingItem;
    const canHandIn =
      ready && def.id !== QUEST_ID_FOUND_ON_THE_ROAD && !needsNote;
    const expanded = offered
      ? this.expandedTaskId !== `hide:${def.id}`
      : this.expandedTaskId === def.id || canHandIn;
    const section = document.createElement("div");
    section.className = "craft-recipe";
    if (expanded) section.classList.add("craft-recipe--expanded");
    if (offered) section.classList.add("craft-recipe--available");
    if (canHandIn) section.classList.add("craft-recipe--ready");

    const summary = document.createElement("button");
    summary.type = "button";
    summary.className = "craft-recipe-summary";
    summary.setAttribute("aria-expanded", expanded ? "true" : "false");
    summary.appendChild(
      makeDisplayCell({
        itemId: def.iconItemId ?? "map",
        ariaLabel: def.title,
      }),
    );
    const label = document.createElement("div");
    label.className = "craft-recipe-summary-text";
    const nameEl = document.createElement("span");
    nameEl.className = "craft-recipe-summary-name";
    nameEl.textContent = def.title;
    const storyChip = document.createElement("span");
    storyChip.className = "quest-status-chip quest-status-chip--story";
    storyChip.textContent = "Story";
    nameEl.appendChild(storyChip);
    const statusChip = document.createElement("span");
    statusChip.className = offered
      ? "quest-status-chip quest-status-chip--available"
      : "quest-status-chip quest-status-chip--accepted";
    statusChip.textContent = offered ? "Available" : "Accepted";
    nameEl.appendChild(statusChip);
    label.appendChild(nameEl);
    const meta = document.createElement("span");
    meta.className = "craft-recipe-summary-meta";
    const openStep = def.objectives.find(
      (obj) => !isQuestObjectiveDone(quests, def, obj),
    );
    meta.textContent = offered
      ? "Read it, then accept"
      : canHandIn
        ? "Ready to turn in"
        : openStep
          ? questObjectiveLine(quests, def, openStep)
          : def.title;
    label.appendChild(meta);
    summary.appendChild(label);
    summary.addEventListener("click", () => {
      if (offered) {
        this.expandedTaskId =
          this.expandedTaskId === `hide:${def.id}` ? null : `hide:${def.id}`;
      } else {
        this.expandedTaskId = this.expandedTaskId === def.id ? null : def.id;
      }
      this.render();
    });
    section.appendChild(summary);

    if (!expanded) return section;

    const details = document.createElement("div");
    details.className = "craft-recipe-details";
    if (def.description) {
      const description = document.createElement("div");
      description.className = "craft-recipe-hint";
      description.textContent = def.description;
      details.appendChild(description);
    }
    for (const obj of def.objectives) {
      const line = document.createElement("div");
      line.className = "craft-recipe-hint";
      line.textContent = questObjectiveLine(quests, def, obj);
      if (isQuestObjectiveDone(quests, def, obj)) {
        line.classList.add("quest-stage--done");
      }
      details.appendChild(line);
    }
    const rep = questRewardReputation(def, "ashenMilitia");
    const itemRewards = def.rewards.filter((reward) => reward.itemId && reward.quantity);
    const banknotes = def.rewards.reduce((sum, reward) => sum + (reward.banknotes ?? 0), 0);
    if (rep > 0 || itemRewards.length > 0 || banknotes > 0) {
      const rewardTitle = document.createElement("div");
      rewardTitle.className = "red-dialog-task-heading";
      rewardTitle.textContent = "Rewards";
      details.appendChild(rewardTitle);
      const rewardRow = document.createElement("div");
      rewardRow.className = "red-dialog-task-row";
      for (const reward of itemRewards) {
        rewardRow.appendChild(
          makeDisplayCell({
            itemId: reward.itemId!,
            qtyLabel: `×${reward.quantity}`,
            ariaLabel: reward.itemId!,
          }),
        );
      }
      if (banknotes > 0) {
        rewardRow.appendChild(
          makeDisplayCell({
            itemId: "banknote",
            qtyLabel: `×${banknotes}`,
            ariaLabel: `${banknotes} banknotes`,
          }),
        );
      }
      if (rep > 0) {
        rewardRow.appendChild(
          makeDisplayCell({
            itemId: "rep",
            qtyLabel: `+${rep}`,
            ariaLabel: `+${rep} ${ASHEN_MILITIA_FACTION} reputation`,
          }),
        );
      }
      details.appendChild(rewardRow);
    }
    if (offered) {
      const acceptBtn = document.createElement("button");
      acceptBtn.type = "button";
      acceptBtn.className = "red-dialog-complete-btn";
      acceptBtn.textContent = "Accept";
      acceptBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.handlers.onAcceptQuest(def.id);
      });
      details.appendChild(acceptBtn);
    } else if (needsNote && ready) {
      const hint = document.createElement("div");
      hint.className = "craft-recipe-hint";
      hint.textContent = `Bring ${STORY_ITEM_LABELS[missingItem ?? ""] ?? "the item"}.`;
      details.appendChild(hint);
    } else if (canHandIn) {
      const completeBtn = document.createElement("button");
      completeBtn.type = "button";
      completeBtn.className = "red-dialog-complete-btn";
      completeBtn.textContent = "Turn in";
      completeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.handlers.onCompleteTask(def.id);
      });
      details.appendChild(completeBtn);
    }
    section.appendChild(details);
    return section;
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
    const quests = parseQuestsJson(this.questsJson);
    const def = getQuestDefinition(task.id);
    const remaining = def ? questCompletionsRemaining(quests, def) : null;
    const max = task.maxCompletionsPerWindow ?? def?.maxCompletionsPerWindow;
    const used =
      remaining != null && max != null
        ? Math.max(0, max - remaining)
        : (this.taskCompletions[task.id] ?? 0);
    const atCap = remaining === 0;
    const accepted = isQuestActive(quests, task.id);
    const finishedOneShot =
      questStatusOf(quests, task.id) === "completed" && !def?.repeatable;
    const itemId = task.requireItemId;
    const itemQty = task.requireQty ?? 1;
    const haveItems = !itemId || this.itemCount(itemId) >= itemQty;
    const canAccept = !atCap && canAcceptQuest(quests, task.id);
    const canComplete = canTurnInQuest(quests, task.id) && haveItems;
    const afterTurnIn = inventoryAfterTurnIn(
      parseInventory(this.inventoryJson),
      itemId,
      itemId ? itemQty : undefined,
    );
    const payoutFits =
      !!afterTurnIn &&
      canAddToInventory(
        afterTurnIn,
        "banknote",
        task.rewardBanknotes,
        this.extraPockets,
      );
    const displayItemId = task.displayItemId ?? itemId;
    const location = questAssignedLocationLabel(quests, task.id);
    const expanded = this.expandedTaskId === task.id;

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
    const statusWord = accepted
      ? "accepted"
      : atCap
        ? "unavailable, daily limit reached"
        : canAccept
          ? "available"
          : "";
    summary.setAttribute(
      "aria-label",
      `${expanded ? "Collapse" : "Expand"} ${task.label} task${
        statusWord ? `, ${statusWord}` : ""
      }`,
    );
    if (displayItemId) {
      const qtyLabel = itemId
        ? `×${itemQty}`
        : def
          ? progressQtyLabel(quests, def)
          : undefined;
      summary.appendChild(
        makeDisplayCell({
          itemId: displayItemId,
          qtyLabel,
          ariaLabel: itemId
            ? `${itemQty} ${task.requireItemLabel ?? displayItemId}`
            : task.label,
        }),
      );
    }

    const label = document.createElement("div");
    label.className = "craft-recipe-summary-text";
    const nameEl = document.createElement("span");
    nameEl.className = "craft-recipe-summary-name";
    nameEl.textContent = task.label;
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
      meta.textContent = itemId && haveItems
        ? "Accept this job to turn in"
        : "Available · accept to start";
    } else if (accepted && def) {
      const stages = def.objectives.filter((obj) => obj.kind !== "turnInItem");
      const turnIns = def.objectives.filter((obj) => obj.kind === "turnInItem");
      const fieldOpen = stages.some(
        (obj) => !isQuestObjectiveDone(quests, def, obj),
      );
      const shown =
        stages.length > 0 && !fieldOpen && turnIns.length > 0
          ? turnIns
          : stages.length > 0
            ? stages
            : def.objectives;
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
    } else if (accepted && location) {
      meta.textContent = location;
    } else if (accepted && itemId) {
      meta.textContent = `Need ×${itemQty} ${task.requireItemLabel ?? "items"}`;
    } else if (itemId) {
      meta.textContent = `Need ×${itemQty} ${task.requireItemLabel ?? "items"}`;
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
      this.expandedTaskId =
        this.expandedTaskId === task.id ? null : task.id;
      this.render();
    });
    section.appendChild(summary);

    if (!expanded) return section;

    const details = document.createElement("div");
    details.className = "craft-recipe-details";

    if (def?.description) {
      const blurb = document.createElement("div");
      blurb.className = "craft-recipe-hint";
      blurb.textContent = def.description;
      details.appendChild(blurb);
    }

    if (itemId && def?.objectives.some((obj) => obj.kind !== "turnInItem")) {
      const fieldOpen = def.objectives.some(
        (obj) =>
          obj.kind !== "turnInItem" && !isQuestObjectiveDone(quests, def, obj),
      );
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
    }

    const needTitle = document.createElement("div");
    needTitle.className = "red-dialog-task-heading";
    needTitle.textContent = itemId ? "Turn in" : "Job";
    details.appendChild(needTitle);

    if (itemId) {
      const needRow = document.createElement("div");
      needRow.className = "red-dialog-task-row";
      needRow.appendChild(
        makeDisplayCell({
          itemId,
          qtyLabel: `×${itemQty}`,
          ariaLabel: `${itemQty} ${task.requireItemLabel ?? itemId}`,
        }),
      );
      details.appendChild(needRow);
    } else if (def) {
      for (const obj of def.objectives) {
        const line = document.createElement("div");
        line.className = "craft-recipe-hint";
        line.textContent = questObjectiveLine(quests, def, obj);
        if (isQuestObjectiveDone(quests, def, obj)) {
          line.classList.add("quest-stage--done");
        }
        details.appendChild(line);
      }
      if (location) {
        const loc = document.createElement("div");
        loc.className = "craft-recipe-hint";
        loc.textContent = `Marked ${location}`;
        details.appendChild(loc);
      }
      if (questFlag(quests, task.id, "foundDead")) {
        const found = document.createElement("div");
        found.className = "craft-recipe-hint";
        found.textContent = "The pair did not make it. Davis will add 7.62.";
        details.appendChild(found);
      }
    }

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
        ariaLabel: `+${task.rewardReputation} ${ASHEN_MILITIA_FACTION} reputation`,
      }),
    );
    if (questFlag(quests, task.id, "foundDead")) {
      rewardRow.appendChild(
        makeDisplayCell({
          itemId: "ammo_762x39",
          qtyLabel: `×${QUEST_MISSING_PAIR_BONUS_AMMO}`,
          ariaLabel: `${QUEST_MISSING_PAIR_BONUS_AMMO} 7.62x39mm rounds`,
        }),
      );
    }
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
      hint.textContent = itemId
        ? haveItems
          ? "Accept this job, then turn the items in."
          : `Missing ${(task.requireItemLabel ?? "items").toLowerCase()}`
        : "Accept this job to get the details.";
      details.appendChild(hint);
    } else {
      const hint = document.createElement("div");
      hint.className = "craft-recipe-hint";
      hint.textContent = finishedOneShot
        ? "Already reported."
        : atCap
          ? "Come back later for more turn-ins"
          : accepted
            ? itemId
              ? `Missing ${(task.requireItemLabel ?? "items").toLowerCase()}`
              : "Finish the job, then report back."
            : "This job is not available right now.";
      details.appendChild(hint);
    }

    if (
      this.denyTaskId === task.id &&
      this.denyReason &&
      !(canComplete && payoutFits) &&
      !(canComplete && !payoutFits && this.denyReason.startsWith("No room"))
    ) {
      const denied = document.createElement("div");
      denied.className = "craft-recipe-hint";
      denied.textContent = this.denyReason;
      details.appendChild(denied);
    } else if (this.denyTaskId === task.id && canComplete && payoutFits) {
      this.denyTaskId = "";
      this.denyReason = "";
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
