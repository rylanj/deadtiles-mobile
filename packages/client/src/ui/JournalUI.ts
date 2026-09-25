import {
  PARENT_SKILL_IDS,
  PARENT_SKILL_LABELS,
  SKILL_LEVEL_MAX,
  SUB_SKILLS_BY_PARENT,
  SUB_SKILL_LABELS,
  SUB_SKILL_BENEFIT,
  canAbandonQuest,
  listTrackedJournalQuests,
  parseQuestsJson,
  parseSkillsJson,
  questAssignedLocationLabel,
  questCompletionsRemaining,
  questFlag,
  questGiverLabel,
  questHasItemTurnIn,
  questObjectiveLine,
  isQuestObjectiveDone,
  questStatusOf,
  xpToNextLevel,
  type ParentSkillId,
  type PlayerQuestsState,
  type PlayerSkillsState,
  type QuestDefinition,
  type QuestStatus,
  type SkillProgress,
} from "@zombie/shared";
import { AudioManager } from "../audio/AudioManager";
import { isMobileDevice } from "../device";
import { createDialogCloseButton } from "./dialogCloseBtn";
import { resetDialogScroll } from "./dialogScroll";

export type JournalTab = "quests" | "skills";

export type JournalUIHandlers = {
  onClose: () => void;
  onAbandonQuest: (questId: string) => void;
};

function statusLabel(status: QuestStatus): string {
  if (status === "active") return "Active";
  if (status === "completed") return "Completed";
  if (status === "failed") return "Failed";
  return "Available";
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

function skillMeta(progress: SkillProgress, cap: number): string {
  if (progress.level >= cap) return `Lv ${progress.level} (max)`;
  const need = xpToNextLevel(progress.level);
  return `Lv ${progress.level}  ·  ${progress.xp}/${need} XP`;
}

export class JournalUI {
  private visible = false;
  private tab: JournalTab = "quests";
  private questsJson = "";
  private skillsJson = "";
  /** Quest id currently expanded (null = all collapsed). */
  private expandedQuestId: string | null = null;
  /** Parent skill currently expanded (null = all collapsed). */
  private expandedSkillId: ParentSkillId | null = null;
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

  open() {
    if (this.visible) return;
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

  render(questsJson: string, skillsJson: string) {
    const questsChanged = questsJson !== this.questsJson;
    const skillsChanged = skillsJson !== this.skillsJson;
    this.questsJson = questsJson;
    this.skillsJson = skillsJson;
    if (!this.visible) return;
    if (!questsChanged && !skillsChanged) return;
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
    this.tabsEl.append(makeTab("quests", "Quests"), makeTab("skills", "Skills"));
  }

  private renderBody(resetScroll = false) {
    const scrollTop = resetScroll ? 0 : this.bodyEl.scrollTop;
    this.bodyEl.replaceChildren();
    if (this.tab === "skills") {
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
    const remaining = questCompletionsRemaining(state, def);
    const expanded = this.expandedQuestId === def.id;
    const giver = questGiverLabel(def);
    const badgeText =
      remaining === 0 ? "Daily limit" : statusLabel(status);

    const section = document.createElement("div");
    section.className = "craft-recipe journal-quest";
    if (expanded) section.classList.add("craft-recipe--expanded");
    if (status === "active") {
      section.classList.add("journal-quest--active");
      section.classList.add("craft-recipe--ready");
    }

    const summary = document.createElement("button");
    summary.type = "button";
    summary.className = "craft-recipe-summary";
    summary.setAttribute("aria-expanded", expanded ? "true" : "false");
    summary.setAttribute(
      "aria-label",
      `${expanded ? "Collapse" : "Expand"} ${def.title}`,
    );

    const label = document.createElement("div");
    label.className = "craft-recipe-summary-text";
    const nameEl = document.createElement("span");
    nameEl.className = "craft-recipe-summary-name";
    nameEl.textContent = def.title;
    const meta = document.createElement("span");
    meta.className = "craft-recipe-summary-meta";
    meta.textContent = giver ? `${badgeText} · ${giver}` : badgeText;
    label.append(nameEl, meta);
    summary.appendChild(label);

    const chevron = document.createElement("span");
    chevron.className = "craft-recipe-chevron";
    chevron.setAttribute("aria-hidden", "true");
    chevron.textContent = expanded ? "▾" : "▸";
    summary.appendChild(chevron);

    summary.addEventListener("click", () => {
      this.expandedQuestId =
        this.expandedQuestId === def.id ? null : def.id;
      this.renderBody();
    });
    section.appendChild(summary);

    if (!expanded) return section;

    const details = document.createElement("div");
    details.className = "craft-recipe-details";

    const desc = document.createElement("p");
    desc.className = "journal-quest-desc";
    desc.textContent = def.description;
    details.appendChild(desc);

    if (def.objectives.length > 0) {
      const objList = document.createElement("ul");
      objList.className = "journal-quest-objectives";
      for (const obj of def.objectives) {
        const li = document.createElement("li");
        li.textContent = questObjectiveLine(state, def, obj);
        if (status === "completed" || isQuestObjectiveDone(state, def, obj)) {
          li.classList.add("quest-stage--done");
        }
        objList.appendChild(li);
      }
      details.appendChild(objList);
    }

    const location = questAssignedLocationLabel(state, def.id);
    if (location) {
      const loc = document.createElement("div");
      loc.className = "journal-quest-meta";
      loc.textContent = `Marked ${location}`;
      details.appendChild(loc);
    }
    if (questFlag(state, def.id, "foundDead")) {
      const found = document.createElement("div");
      found.className = "journal-quest-meta";
      found.textContent = "The pair did not make it. Davis will add 7.62.";
      details.appendChild(found);
    }

    const times = state.quests[def.id]?.timesCompleted ?? 0;
    if (times > 0 && def.repeatable) {
      const done = document.createElement("div");
      done.className = "journal-quest-meta";
      done.textContent =
        remaining != null
          ? `Turned in ${times} times · ${remaining} left today`
          : `Turned in ${times} times`;
      details.appendChild(done);
    } else if (remaining != null && remaining > 0) {
      const cap = document.createElement("div");
      cap.className = "journal-quest-meta";
      cap.textContent = `${remaining} left today`;
      details.appendChild(cap);
    }

    if (status === "active") {
      const hint = document.createElement("div");
      hint.className = "craft-recipe-hint";
      hint.textContent = questHasItemTurnIn(def)
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

    const label = document.createElement("div");
    label.className = "craft-recipe-summary-text";
    const nameEl = document.createElement("span");
    nameEl.className = "craft-recipe-summary-name";
    nameEl.textContent = PARENT_SKILL_LABELS[parentId];
    const meta = document.createElement("span");
    meta.className = "craft-recipe-summary-meta";
    meta.textContent = skillMeta(progress, SKILL_LEVEL_MAX);
    label.append(nameEl, meta);
    summary.appendChild(label);

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
    details.appendChild(skillBar(progress, SKILL_LEVEL_MAX));

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
      subMeta.textContent = skillMeta(sub, parentLevel);
      subHead.append(subName, subMeta);
      row.append(subHead, skillBar(sub, parentLevel));
      const benefit = document.createElement("div");
      benefit.className = "craft-recipe-hint journal-skill-benefit";
      benefit.textContent = SUB_SKILL_BENEFIT[subId];
      row.appendChild(benefit);
      subs.appendChild(row);
    }
    details.appendChild(subs);
    section.appendChild(details);
    return section;
  }
}
