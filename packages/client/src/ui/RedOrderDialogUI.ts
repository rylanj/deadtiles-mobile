import {
  RED_ORDER_DIALOG_LINES,
  RED_ORDER_FACTION,
  RED_ORDER_REP_START,
  RED_ORDER_TASK_WINDOW_MS,
  RED_ORDER_TASKS,
  canAcceptQuest,
  canAddToInventory,
  canTurnInQuest,
  countItemInInventory,
  getQuestDefinition,
  inventoryAfterTurnIn,
  isQuestActive,
  isQuestListed,
  isQuestObjectiveDone,
  parseInventory,
  parseQuestsJson,
  pickDialogVariant,
  questAssignedLocationLabel,
  questCompletionsRemaining,
  questObjectiveLine,
  questStatusOf,
  redOrderStanding,
  redOrderStandingLabel,
  normalizeRedManSkin,
  type PlayerQuestsState,
  type QuestDefinition,
  type RedOrderTask,
} from "@zombie/shared";
import { appendItemIcon, fillSpeechButton, markQuestKeepsake } from "./itemIcons";
import { createDialogCloseButton } from "./dialogCloseBtn";
import { resetDialogScroll } from "./dialogScroll";
import { playerAvatarSrc } from "./playerAvatar";

export type RedOrderDialogUIHandlers = {
  onClose: () => void;
  onAcceptQuest: (questId: string) => void;
  onCompleteTask: (taskId: string) => void;
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
  markQuestKeepsake(cell, opts.itemId);

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
  private inventoryJson = "[]";
  private extraPockets = 0;
  private questsJson = "";
  private activeLineId: string | null = null;
  /** Task id currently expanded on the jobs reply (null = all collapsed). */
  private expandedTaskId: string | null = null;
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
    inventoryJson?: string;
    clothingSkin?: number;
    questsJson?: string;
    extraPockets?: number;
  }) {
    this.extraPockets = opts.extraPockets ?? 0;
    this.npcId = opts.npcId;
    this.npcSkin = normalizeRedManSkin(opts.npcSkin);
    this.npcAvatarEl.src = redManAvatar(this.npcSkin);
    this.playerTitleEl.textContent = opts.playerName?.trim() || "You";
    this.playerAvatarEl.src = playerAvatarSrc(opts.clothingSkin);
    this.redOrderReputation = opts.redOrderReputation ?? RED_ORDER_REP_START;
    this.dogtagCount = opts.dogtagCount ?? 0;
    this.inventoryJson = opts.inventoryJson ?? "[]";
    this.questsJson = opts.questsJson ?? "";
    this.activeLineId = null;
    this.expandedTaskId = null;
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
    this.expandedTaskId = taskId;
    this.activeLineId = "jobs";
    this.render();
  }

  /** Refresh turn-in eligibility / standing while the dialog stays open. */
  sync(opts: {
    dogtagCount?: number;
    inventoryJson?: string;
    redOrderReputation?: number;
    questsJson?: string;
    extraPockets?: number;
  }) {
    if (!this.visible) return;
    if (opts.extraPockets !== undefined) this.extraPockets = opts.extraPockets;
    if (opts.dogtagCount !== undefined) this.dogtagCount = opts.dogtagCount;
    if (opts.inventoryJson !== undefined) this.inventoryJson = opts.inventoryJson;
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
    this.expandedTaskId = null;
    this.dogtagCount = 0;
    this.inventoryJson = "[]";
    this.questsJson = "";
  }

  private itemCount(itemId: string): number {
    const fromBag = countItemInInventory(parseInventory(this.inventoryJson), itemId);
    if (itemId === "dogtag" && fromBag === 0 && this.dogtagCount > 0) {
      return this.dogtagCount;
    }
    return fromBag;
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
      fillSpeechButton(btn, line.player, line.id === "jobs" ? "journal" : undefined);
      btn.addEventListener("click", () => {
        if (this.activeLineId !== line.id) this.expandedTaskId = null;
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

    if (active.id === "jobs") {
      const quests = parseQuestsJson(this.questsJson);
      const list = document.createElement("div");
      list.className = "craft-recipe-list red-dialog-task-list";
      for (const task of RED_ORDER_TASKS) {
        const def = getQuestDefinition(task.id);
        if (def && !isQuestListed(quests, def)) continue;
        list.appendChild(this.buildTaskSection(task));
      }
      if (list.childElementCount > 0) this.responseEl.appendChild(list);
    }
  }

  private buildTaskSection(task: RedOrderTask): HTMLElement {
    const quests = parseQuestsJson(this.questsJson);
    const def = getQuestDefinition(task.id);
    const remaining = def ? questCompletionsRemaining(quests, def) : null;
    const max = task.maxCompletionsPerWindow ?? def?.maxCompletionsPerWindow;
    const used =
      remaining != null && max != null ? Math.max(0, max - remaining) : 0;
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
    const payoutFits = afterTurnIn
      ? canAddToInventory(
          afterTurnIn,
          "banknote",
          task.rewardBanknotes,
          this.extraPockets,
        )
      : true;
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
        ariaLabel: `+${task.rewardReputation} Red Order reputation`,
      }),
    );
    details.appendChild(rewardRow);

    if (max != null) {
      const capHint = document.createElement("div");
      capHint.className = "craft-recipe-hint";
      const windowHrs = Math.round(
        (task.completionWindowMs ?? RED_ORDER_TASK_WINDOW_MS) / 3_600_000,
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
      completeBtn.textContent = itemId ? "Complete Task" : "Report Back";
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

    if (this.denyTaskId === task.id && this.denyReason) {
      const noRoom = this.denyReason.startsWith("No room");
      if (canComplete && payoutFits && noRoom) {
        this.denyTaskId = "";
        this.denyReason = "";
      } else if (!(canComplete && !payoutFits && noRoom)) {
        const denied = document.createElement("div");
        denied.className = "craft-recipe-hint";
        denied.textContent = this.denyReason;
        details.appendChild(denied);
      }
    }

    section.appendChild(details);
    return section;
  }

  private updateStandingPill() {
    const standing = redOrderStanding(this.redOrderReputation);
    this.standingPillEl.textContent = redOrderStandingLabel(standing);
    this.standingPillEl.className = `trader-standing-pill trader-standing-pill--${standing}`;
    this.standingPillEl.title = `${RED_ORDER_FACTION}: ${Number(this.redOrderReputation.toFixed(1))}`;
  }
}
