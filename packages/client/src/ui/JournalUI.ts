import {
  PARENT_SKILL_IDS,
  PARENT_SKILL_LABELS,
  SKILL_LEVEL_MAX,
  SUB_SKILLS_BY_PARENT,
  SUB_SKILL_LABELS,
  SUB_SKILL_BENEFIT,
  ASHEN_MILITIA_FACTION,
  FIELD_GUIDE_PAGES,
  canAbandonQuest,
  listTrackedJournalQuests,
  parseQuestsJson,
  buffedSubSkillLevel,
  parseSkillsJson,
  getItemDefinition,
  questAssignedLocationLabel,
  questFlag,
  questGiverLabel,
  questHasItemTurnIn,
  questObjectiveLine,
  questRewardBanknotes,
  questRewardReputation,
  questTurnInItems,
  isQuestObjectiveDone,
  questStatusOf,
  xpToNextLevel,
  type ParentSkillId,
  type PlayerQuestsState,
  type PlayerSkillsState,
  type QuestDefinition,
  type QuestFaction,
  type SkillProgress,
} from "@zombie/shared";
import { AudioManager } from "../audio/AudioManager";
import { isMobileDevice } from "../device";
import { createDialogCloseButton } from "./dialogCloseBtn";
import { appendItemIcon, markQuestKeepsake } from "./itemIcons";
import { resetDialogScroll } from "./dialogScroll";

const PARENT_SKILL_ICONS: Record<ParentSkillId, string> = {
  strength: "/assets/UI/UI_strength.png",
  endurance: "/assets/UI/UI_endurance.png",
  dexterity: "/assets/UI/UI_dexterity.png",
  intelligence: "/assets/UI/UI_intelligence.png",
  charisma: "/assets/UI/UI_charisma.png",
};

export type JournalTab = "quests" | "skills" | "guide";

export type JournalUIHandlers = {
  onClose: () => void;
  onAbandonQuest: (questId: string) => void;
  onShowControls: () => void;
  onReplayTutorial: () => void;
};

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

function progressQtyLabel(
  state: PlayerQuestsState,
  def: QuestDefinition,
): string | undefined {
  const objs = def.objectives.filter((obj) => obj.kind !== "turnInItem");
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

const REP_FACTIONS: readonly QuestFaction[] = [
  "ashenTraders",
  "ashenMilitia",
  "redOrder",
  "none",
];

function reputationLabel(faction: QuestFaction): string {
  if (faction === "ashenTraders") return "Ashen Traders reputation";
  if (faction === "ashenMilitia") return `${ASHEN_MILITIA_FACTION} reputation`;
  if (faction === "redOrder") return "Red Order reputation";
  return "reputation";
}

function skillBar(progress: SkillProgress, cap: number): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "journal-xp";
  const fill = document.createElement("div");
  fill.className = "journal-xp-fill";
  const need = xpToNextLevel(progress.level);
  let pct = 0;
  if (cap > 0 && progress.level >= cap) pct = 100;
  else if (cap > 0 && need > 0) {
    pct = Math.max(0, Math.min(100, (progress.xp / need) * 100));
  }
  fill.style.width = `${pct}%`;
  wrap.appendChild(fill);
  return wrap;
}

function skillMeta(
  progress: SkillProgress,
  cap: number,
  cappedBy?: string,
): string {
  if (progress.level >= cap) {
    if (cappedBy) return `Lv ${progress.level} (Capped by ${cappedBy})`;
    return `Lv ${progress.level} (max)`;
  }
  const need = xpToNextLevel(progress.level);
  return `Lv ${progress.level}  ·  ${progress.xp}/${need} XP`;
}

export class JournalUI {
  private visible = false;
  private tab: JournalTab = "quests";
  private questsJson = "";
  private skillsJson = "";
  /** Temporary Bartering and Persuasion XP from worn jewelry and watches. */
  private jewelrySkillXp = 0;
  /** Quest id currently expanded (null = all collapsed). */
  private expandedQuestId: string | null = null;
  /** Parent skill currently expanded (null = all collapsed). */
  private expandedSkillId: ParentSkillId | null = null;
  /** Field Guide page currently expanded (null = all collapsed). */
  private expandedGuideId: string | null = null;
  private overlay: HTMLElement;
  private hintEl: HTMLElement;
  private tabsEl: HTMLElement;
  private bodyEl: HTMLElement;

  constructor(private handlers: JournalUIHandlers) {
    this.overlay = document.createElement("div");
    this.overlay.id = "journal-overlay";
    this.overlay.hidden = true;

    const panel = document.createElement("div");
    panel.className = "inventory-panel journal-panel";

    const header = document.createElement("div");
    header.className = "inventory-header journal-header";
    const top = document.createElement("div");
    top.className = "inventory-header-top";
    const titleWrap = document.createElement("div");
    titleWrap.className = "journal-header-text";
    const title = document.createElement("h2");
    title.className = "inventory-title";
    title.textContent = "Journal";
    this.hintEl = document.createElement("span");
    this.hintEl.className = "inventory-hint";
    this.hintEl.textContent = isMobileDevice()
      ? "Tap outside to close"
      : "J to close";
    titleWrap.append(title, this.hintEl);
    top.append(titleWrap, createDialogCloseButton(() => this.handlers.onClose()));
    header.append(top);

    this.tabsEl = document.createElement("div");
    this.tabsEl.className = "journal-tabs";
    this.tabsEl.setAttribute("role", "tablist");

    this.bodyEl = document.createElement("div");
    this.bodyEl.className = "journal-body";

    panel.append(header, this.tabsEl, this.bodyEl);
    this.overlay.appendChild(panel);
    this.overlay.addEventListener("click", (event) => {
      if (event.target === this.overlay) this.handlers.onClose();
    });
    document.body.appendChild(this.overlay);
  }

  toggle() {
    if (this.visible) this.close();
    else this.open();
  }

  open(tab?: JournalTab) {
    if (tab) this.tab = tab;
    if (this.visible) {
      this.renderTabs();
      this.renderBody(true);
      return;
    }
    this.visible = true;
    this.overlay.hidden = false;
    document.body.classList.add("journal-open");
    resetDialogScroll(this.overlay);
    this.renderTabs();
    this.renderBody();
    AudioManager.get().play("ui_open");
  }

  close() {
    const wasOpen = this.visible;
    this.visible = false;
    this.overlay.hidden = true;
    document.body.classList.remove("journal-open");
    if (wasOpen) AudioManager.get().play("ui_close");
  }

  isOpen() {
    return this.visible;
  }

  render(questsJson: string, skillsJson: string, jewelrySkillXp = this.jewelrySkillXp) {
    const questsChanged = questsJson !== this.questsJson;
    const skillsChanged = skillsJson !== this.skillsJson;
    const jewelryChanged = jewelrySkillXp !== this.jewelrySkillXp;
    this.questsJson = questsJson;
    this.skillsJson = skillsJson;
    this.jewelrySkillXp = jewelrySkillXp;
    if (!this.visible) return;
    if (!questsChanged && !skillsChanged && !jewelryChanged) return;
    this.renderBody();
  }

  /** Worn jewelry changed. Skills stay open on the real level plus the buff. */
  setJewelrySkillXp(jewelrySkillXp: number) {
    if (jewelrySkillXp === this.jewelrySkillXp) return;
    this.jewelrySkillXp = jewelrySkillXp;
    if (!this.visible || this.tab !== "skills") return;
    this.renderBody();
  }

  destroy() {
    this.overlay.remove();
    document.body.classList.remove("journal-open");
  }

  private renderTabs() {
    this.tabsEl.replaceChildren();
    const makeTab = (id: JournalTab, label: string) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "journal-tab";
      btn.setAttribute("role", "tab");
      btn.setAttribute("aria-selected", this.tab === id ? "true" : "false");
      if (this.tab === id) btn.classList.add("journal-tab--active");
      btn.textContent = label;
      btn.addEventListener("click", () => {
        if (this.tab === id) return;
        this.tab = id;
        this.renderTabs();
        this.renderBody(true);
      });
      return btn;
    };
    this.tabsEl.append(
      makeTab("quests", "Quests"),
      makeTab("skills", "Skills"),
      makeTab("guide", "Field Guide"),
    );
  }

  private renderBody(resetScroll = false) {
    const scrollTop = resetScroll ? 0 : this.bodyEl.scrollTop;
    this.bodyEl.replaceChildren();
    if (this.tab === "guide") {
      this.bodyEl.appendChild(this.buildGuide());
    } else if (this.tab === "skills") {
      this.bodyEl.appendChild(this.buildSkills(parseSkillsJson(this.skillsJson)));
    } else {
      this.bodyEl.appendChild(this.buildQuests(parseQuestsJson(this.questsJson)));
    }
    this.bodyEl.scrollTop = scrollTop;
  }

  private buildQuests(state: PlayerQuestsState): HTMLElement {
    const list = document.createElement("div");
    list.className = "craft-recipe-list journal-quest-list";
    const defs = listTrackedJournalQuests(state);
    const active: QuestDefinition[] = [];
    const completed: QuestDefinition[] = [];
    const failed: QuestDefinition[] = [];
    for (const def of defs) {
      const status = questStatusOf(state, def.id);
      if (status === "active") active.push(def);
      else if (status === "failed") failed.push(def);
      else completed.push(def);
    }

    if (active.length === 0 && completed.length === 0 && failed.length === 0) {
      const empty = document.createElement("p");
      empty.className = "journal-empty";
      empty.textContent =
        "No jobs yet. Talk to a quest giver to accept one.";
      list.appendChild(empty);
      return list;
    }

    const addSection = (label: string, items: QuestDefinition[]) => {
      if (items.length === 0) return;
      const heading = document.createElement("div");
      heading.className = "journal-section-label";
      heading.textContent = label;
      list.appendChild(heading);
      for (const def of items) list.appendChild(this.buildQuestCard(state, def));
    };

    addSection("Active", active);
    addSection("Completed", completed);
    addSection("Failed", failed);
    return list;
  }

  private buildQuestCard(
    state: PlayerQuestsState,
    def: QuestDefinition,
  ): HTMLElement {
    const status = questStatusOf(state, def.id);
    const expanded = this.expandedQuestId === def.id;
    const giver = questGiverLabel(def);
    const turnIns = questTurnInItems(def);
    const notes = questRewardBanknotes(def);
    const field = def.objectives.filter((obj) => obj.kind !== "turnInItem");
    const fieldOpen =
      status === "active" &&
      field.some((obj) => !isQuestObjectiveDone(state, def, obj));
    const readyToReport =
      status === "active" && !fieldOpen && !questHasItemTurnIn(def);
    const location = questAssignedLocationLabel(state, def.id);
    const stageDone = (obj: (typeof def.objectives)[number]) =>
      status === "completed" || isQuestObjectiveDone(state, def, obj);

    const section = document.createElement("div");
    section.className = "craft-recipe journal-quest";
    if (expanded) section.classList.add("craft-recipe--expanded");
    if (status === "failed") section.classList.add("craft-recipe--capped");
    else if (status === "active") {
      section.classList.add("craft-recipe--accepted");
      if (readyToReport) section.classList.add("craft-recipe--ready");
    }

    const summary = document.createElement("button");
    summary.type = "button";
    summary.className = "craft-recipe-summary";
    summary.setAttribute("aria-expanded", expanded ? "true" : "false");
    const chips: { text: string; tone: "accepted" | "capped" | "neutral" | "story" }[] = [];
    if (def.story) chips.push({ text: "Story", tone: "story" });
    if (status === "failed") chips.push({ text: "Failed", tone: "capped" });
    else if (status === "completed") chips.push({ text: "Completed", tone: "accepted" });
    else if (status === "active") chips.push({ text: "Accepted", tone: "accepted" });
    if (status === "completed" && def.repeatable) {
      chips.push({ text: "Repeatable", tone: "neutral" });
    }
    summary.setAttribute(
      "aria-label",
      `${expanded ? "Collapse" : "Expand"} ${def.title}${
        chips.length > 0 ? `, ${chips.map((chip) => chip.text).join(", ")}` : ""
      }`,
    );

    const iconId = def.iconItemId ?? turnIns[0]?.itemId ?? "map";
    const qtyLabel =
      turnIns.length === 1
        ? `×${turnIns[0]!.quantity}`
        : progressQtyLabel(state, def);
    summary.appendChild(
      makeQuestCell({
        itemId: iconId,
        qtyLabel,
        ariaLabel: def.title,
      }),
    );

    const label = document.createElement("div");
    label.className = "craft-recipe-summary-text";
    const nameEl = document.createElement("span");
    nameEl.className = "craft-recipe-summary-name";
    nameEl.textContent = def.title;
    for (const chip of chips) {
      const chipEl = document.createElement("span");
      chipEl.className = `quest-status-chip quest-status-chip--${chip.tone}`;
      chipEl.textContent = chip.text;
      nameEl.appendChild(chipEl);
    }
    const meta = document.createElement("span");
    meta.className = "craft-recipe-summary-meta";
    const shown =
      field.length > 0 && !fieldOpen && turnIns.length > 0
        ? def.objectives.filter((obj) => obj.kind === "turnInItem")
        : field.length > 0
          ? field
          : def.objectives;
    if (status === "failed") {
      meta.textContent = giver ? `Failed · ${giver}` : "Failed";
    } else if (status === "completed" && !def.repeatable) {
      meta.textContent = giver ? `Already reported · ${giver}` : "Already reported";
    } else if (status === "completed") {
      if (giver) meta.textContent = giver;
    } else if (readyToReport) {
      meta.textContent = giver
        ? `Ready to turn in · ${giver}`
        : "Ready to turn in";
    } else if (shown.length > 0) {
      shown.forEach((obj, i) => {
        if (i > 0) meta.append(" · ");
        const stage = document.createElement("span");
        stage.textContent = questObjectiveLine(state, def, obj);
        if (stageDone(obj)) stage.classList.add("quest-stage--done");
        meta.appendChild(stage);
      });
      if (location && fieldOpen) meta.append(` · ${location}`);
      if (giver) meta.append(` · ${giver}`);
    } else if (giver) {
      meta.textContent = giver;
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
      this.renderBody();
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
      line.textContent = questObjectiveLine(state, def, obj);
      if (stageDone(obj)) line.classList.add("quest-stage--done");
      details.appendChild(line);
    }
    if (location && (fieldOpen || status !== "active")) {
      const loc = document.createElement("div");
      loc.className = "craft-recipe-hint";
      loc.textContent = `Marked ${location}`;
      details.appendChild(loc);
    }
    if (questFlag(state, def.id, "foundDead")) {
      const found = document.createElement("div");
      found.className = "craft-recipe-hint";
      found.textContent = "The pair did not make it. Davis will add 7.62.";
      details.appendChild(found);
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

    const rewardRow = document.createElement("div");
    rewardRow.className = "red-dialog-task-row";
    if (notes > 0) {
      rewardRow.appendChild(
        makeQuestCell({
          itemId: "banknote",
          qtyLabel: `×${notes}`,
          ariaLabel: `${notes} banknotes`,
        }),
      );
    }
    for (const faction of REP_FACTIONS) {
      const rep = questRewardReputation(def, faction);
      if (rep <= 0) continue;
      rewardRow.appendChild(
        makeQuestCell({
          itemId: "rep",
          qtyLabel: `+${rep}`,
          ariaLabel: `+${rep} ${reputationLabel(faction)}`,
        }),
      );
    }
    for (const reward of def.rewards) {
      if (!reward.itemId || (reward.quantity ?? 0) <= 0) continue;
      const qty = reward.quantity ?? 1;
      const name = getItemDefinition(reward.itemId)?.name ?? reward.itemId;
      rewardRow.appendChild(
        makeQuestCell({
          itemId: reward.itemId,
          qtyLabel: `×${qty}`,
          ariaLabel: `${qty} ${name}`,
        }),
      );
    }
    if (rewardRow.childElementCount > 0) {
      const rewardTitle = document.createElement("div");
      rewardTitle.className = "red-dialog-task-heading";
      rewardTitle.textContent = "Rewards";
      details.appendChild(rewardTitle);
      details.appendChild(rewardRow);
    }

    if (status === "active") {
      const hint = document.createElement("div");
      hint.className = "craft-recipe-hint";
      hint.textContent = fieldOpen
        ? giver
          ? `Finish the steps, then turn in with ${giver}.`
          : "Finish the steps, then turn them in."
        : questHasItemTurnIn(def)
          ? giver
            ? `Turn in with ${giver} once you have the items.`
            : "Turn in with the quest giver once you have the items."
          : giver
            ? `Report back to ${giver} when the job is done.`
            : "Report back to the quest giver when the job is done.";
      details.appendChild(hint);
    }

    if (canAbandonQuest(state, def.id)) {
      const actions = document.createElement("div");
      actions.className = "journal-quest-actions";
      const abandon = document.createElement("button");
      abandon.type = "button";
      abandon.className = "red-dialog-complete-btn journal-abandon-btn";
      abandon.textContent = "Abandon";
      abandon.addEventListener("click", (event) => {
        event.stopPropagation();
        this.handlers.onAbandonQuest(def.id);
      });
      actions.appendChild(abandon);
      details.appendChild(actions);
    }

    section.appendChild(details);
    return section;
  }

  private buildGuide(): HTMLElement {
    const list = document.createElement("div");
    list.className = "craft-recipe-list journal-guide-list";

    const actions = document.createElement("div");
    actions.className = "journal-guide-actions";
    const controls = document.createElement("button");
    controls.type = "button";
    controls.className = "red-dialog-complete-btn";
    controls.textContent = "Controls";
    controls.addEventListener("click", () => this.handlers.onShowControls());
    const replay = document.createElement("button");
    replay.type = "button";
    replay.className = "red-dialog-complete-btn";
    replay.textContent = "Replay tutorial";
    replay.addEventListener("click", () => this.handlers.onReplayTutorial());
    actions.append(controls, replay);
    list.appendChild(actions);

    for (const page of FIELD_GUIDE_PAGES) {
      const expanded = this.expandedGuideId === page.id;
      const section = document.createElement("section");
      section.className = "craft-recipe journal-guide-page";
      if (expanded) section.classList.add("craft-recipe--expanded");

      const summary = document.createElement("button");
      summary.type = "button";
      summary.className = "craft-recipe-summary";
      summary.setAttribute("aria-expanded", expanded ? "true" : "false");
      const label = document.createElement("div");
      label.className = "craft-recipe-summary-text";
      const nameEl = document.createElement("span");
      nameEl.className = "craft-recipe-summary-name";
      nameEl.textContent = page.title;
      label.appendChild(nameEl);
      const chevron = document.createElement("span");
      chevron.className = "craft-recipe-chevron";
      chevron.setAttribute("aria-hidden", "true");
      chevron.textContent = expanded ? "▾" : "▸";
      summary.append(label, chevron);
      summary.addEventListener("click", () => {
        this.expandedGuideId = expanded ? null : page.id;
        this.renderBody();
      });
      section.appendChild(summary);

      if (expanded) {
        const details = document.createElement("div");
        details.className = "craft-recipe-details";
        for (const text of page.paragraphs) {
          const p = document.createElement("p");
          p.className = "journal-quest-desc";
          p.textContent = text;
          details.appendChild(p);
        }
        section.appendChild(details);
      }
      list.appendChild(section);
    }
    return list;
  }

  private buildSkills(state: PlayerSkillsState): HTMLElement {
    const list = document.createElement("div");
    list.className = "craft-recipe-list journal-skill-list";
    for (const parentId of PARENT_SKILL_IDS) {
      list.appendChild(this.buildParentSkill(state, parentId));
    }
    return list;
  }

  private buildParentSkill(
    state: PlayerSkillsState,
    parentId: ParentSkillId,
  ): HTMLElement {
    const parent = state[parentId];
    const progress = parent ?? { level: 0, xp: 0 };
    const expanded = this.expandedSkillId === parentId;

    const section = document.createElement("section");
    section.className = "craft-recipe journal-skill";
    if (expanded) section.classList.add("craft-recipe--expanded");

    const summary = document.createElement("button");
    summary.type = "button";
    summary.className = "craft-recipe-summary";
    summary.setAttribute("aria-expanded", expanded ? "true" : "false");
    summary.setAttribute(
      "aria-label",
      `${expanded ? "Collapse" : "Expand"} ${PARENT_SKILL_LABELS[parentId]}`,
    );

    const icon = document.createElement("img");
    icon.className = "journal-skill-icon";
    icon.src = PARENT_SKILL_ICONS[parentId];
    icon.alt = "";
    icon.draggable = false;

    const label = document.createElement("div");
    label.className = "craft-recipe-summary-text";
    const nameEl = document.createElement("span");
    nameEl.className = "craft-recipe-summary-name";
    nameEl.textContent = PARENT_SKILL_LABELS[parentId];
    const meta = document.createElement("span");
    meta.className = "craft-recipe-summary-meta";
    meta.textContent = skillMeta(progress, SKILL_LEVEL_MAX);
    const bar = skillBar(progress, SKILL_LEVEL_MAX);
    bar.classList.add("journal-skill-summary-bar");
    label.append(nameEl, meta, bar);
    summary.append(icon, label);

    const chevron = document.createElement("span");
    chevron.className = "craft-recipe-chevron";
    chevron.setAttribute("aria-hidden", "true");
    chevron.textContent = expanded ? "▾" : "▸";
    summary.appendChild(chevron);

    summary.addEventListener("click", () => {
      this.expandedSkillId =
        this.expandedSkillId === parentId ? null : parentId;
      this.renderBody();
    });
    section.appendChild(summary);

    if (!expanded) return section;

    const details = document.createElement("div");
    details.className = "craft-recipe-details";

    const subs = document.createElement("div");
    subs.className = "journal-skill-subs";
    const parentLevel = progress.level;
    for (const subId of SUB_SKILLS_BY_PARENT[parentId]) {
      const sub = parent?.subs?.[subId] ?? { level: 0, xp: 0 };
      const row = document.createElement("div");
      row.className = "journal-skill-sub";
      const subHead = document.createElement("div");
      subHead.className = "journal-skill-head";
      const subName = document.createElement("div");
      subName.className = "journal-skill-sub-name";
      subName.textContent = SUB_SKILL_LABELS[subId];
      const subMeta = document.createElement("div");
      subMeta.className = "journal-skill-meta";
      subMeta.textContent = skillMeta(
        sub,
        parentLevel,
        PARENT_SKILL_LABELS[parentId],
      );
      if (
        this.jewelrySkillXp > 0 &&
        (subId === "bartering" || subId === "persuasion")
      ) {
        const buffed = buffedSubSkillLevel(state, subId, this.jewelrySkillXp);
        subMeta.append(document.createTextNode("  ·  "));
        const buff = document.createElement("span");
        buff.className = "journal-skill-buff";
        buff.textContent = `Buffed ${buffed}`;
        subMeta.append(buff);
      }
      subHead.append(subName, subMeta);
      row.append(subHead, skillBar(sub, parentLevel));
      for (const line of SUB_SKILL_BENEFIT[subId]) {
        const benefit = document.createElement("div");
        benefit.className = "craft-recipe-hint journal-skill-benefit";
        benefit.textContent = line;
        row.appendChild(benefit);
      }
      subs.appendChild(row);
    }
    details.appendChild(subs);
    section.appendChild(details);
    return section;
  }
}
