import {
  PARENT_SKILL_IDS,
  PARENT_SKILL_LABELS,
  SKILL_LEVEL_MAX,
  SUB_SKILLS_BY_PARENT,
  SUB_SKILL_LABELS,
  SUB_SKILL_BENEFIT,
  ASHEN_MILITIA_FACTION,
  ASHEN_TRADERS_FACTION,
  RED_ORDER_FACTION,
  FACTION_REP_START,
  ashenTraderRates,
  canTalkWithAshenMilitia,
  canTradeWithAshen,
  factionNextStanding,
  factionNextStandingAt,
  factionStanding,
  factionStandingLabel,
  factionStandingProgressPct,
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
  resolveQuestMapPoint,
  xpToNextLevel,
  type FactionStanding,
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
import {
  chip,
  createSheet,
  filterChips,
  markSheetOpen,
  meter,
  renderTabs,
  sectionLabel,
  sheetButton,
  sheetRow,
  useMobileSheet,
  type ChipTone,
  type Sheet,
} from "./mobileSheet";
import "./mobile/journal.css";

const STANDING_BANDS: readonly { id: FactionStanding; color: string }[] = [
  { id: "exiled", color: "#7a2a2a" },
  { id: "hostile", color: "#8a3a3a" },
  { id: "wary", color: "#d9a43a" },
  { id: "neutral", color: "#8a8a8a" },
  { id: "warm", color: "#a8c84a" },
  { id: "friendly", color: "#5ac05a" },
  { id: "allied", color: "#3ad0a0" },
];

type QuestFilter = "active" | "done" | "failed";

const PARENT_SKILL_ICONS: Record<ParentSkillId, string> = {
  strength: "/assets/UI/UI_strength.png",
  endurance: "/assets/UI/UI_endurance.png",
  dexterity: "/assets/UI/UI_dexterity.png",
  intelligence: "/assets/UI/UI_intelligence.png",
  charisma: "/assets/UI/UI_charisma.png",
};

export type JournalTab = "quests" | "skills" | "rep" | "guide";

export type JournalReputation = {
  ashenMilitia: number;
  ashenTraders: number;
  redOrder: number;
};

type JournalFactionId = "ashenMilitia" | "ashenTraders" | "redOrder";

const JOURNAL_FACTIONS: readonly {
  id: JournalFactionId;
  name: string;
  icon: string;
}[] = [
  {
    id: "ashenMilitia",
    name: ASHEN_MILITIA_FACTION,
    icon: "/assets/UI/UI_dogtag.png",
  },
  {
    id: "ashenTraders",
    name: ASHEN_TRADERS_FACTION,
    icon: "/assets/UI/UI_scales.png",
  },
  {
    id: "redOrder",
    name: RED_ORDER_FACTION,
    icon: "/assets/UI/UI_red_order.png",
  },
];

export type JournalUIHandlers = {
  onClose: () => void;
  onAbandonQuest: (questId: string) => void;
  onShowControls: () => void;
  onReplayTutorial: () => void;
  /** Close the journal and open the map on this overworld tile. */
  onShowOnMap?: (x: number, y: number) => void;
  canShowMap?: () => boolean;
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

function formatRepValue(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
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

function repBar(reputation: number): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "journal-xp";
  const fill = document.createElement("div");
  fill.className = "journal-xp-fill";
  fill.style.width = `${factionStandingProgressPct(reputation)}%`;
  wrap.appendChild(fill);
  return wrap;
}

function repMeta(reputation: number): string {
  const standing = factionStanding(reputation);
  const label = factionStandingLabel(standing);
  const nextAt = factionNextStandingAt(standing);
  const current = formatRepValue(reputation);
  if (nextAt == null) return `${label}  ·  ${current}`;
  return `${label}  ·  ${current} / ${nextAt}`;
}

function repNotes(id: JournalFactionId, reputation: number): string[] {
  const standing = factionStanding(reputation);
  const next = factionNextStanding(standing);
  const nextAt = factionNextStandingAt(standing);
  const lines: string[] = [];
  if (id === "ashenMilitia") {
    if (standing === "exiled") {
      lines.push("They shoot on sight.");
    } else if (standing === "hostile") {
      lines.push("They will not talk. Standing recovers toward Wary.");
    } else if (canTalkWithAshenMilitia(reputation)) {
      lines.push("They will talk, and you can enter the Birchport barracks.");
    }
  } else if (id === "ashenTraders") {
    if (standing === "exiled") {
      lines.push("They shoot on sight. Trade is closed.");
    } else if (!canTradeWithAshen(reputation)) {
      lines.push("Trade is closed. Standing recovers toward Wary.");
    } else {
      const rates = ashenTraderRates(reputation);
      lines.push(
        `Buy ${Math.round(rates.buyRate * 100)}%. Sell ${Math.round(rates.sellRate * 100)}%.`,
      );
    }
  } else if (standing === "exiled") {
    lines.push("They treat you as an enemy.");
  } else if (standing === "hostile") {
    lines.push("Standing recovers toward Wary.");
  }
  if (next && nextAt != null) {
    const remain = Math.max(0, nextAt - reputation);
    lines.push(
      `Next: ${factionStandingLabel(next)} at ${nextAt} (${formatRepValue(remain)} to go).`,
    );
  } else if (standing === "allied") {
    lines.push("Highest standing.");
  }
  return lines;
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
  private reputation: JournalReputation = {
    ashenMilitia: FACTION_REP_START,
    ashenTraders: FACTION_REP_START,
    redOrder: FACTION_REP_START,
  };
  /** Faction currently expanded (null = all collapsed). */
  private expandedFactionId: JournalFactionId | null = null;
  /** Temporary Bartering and Persuasion XP from worn jewelry and watches. */
  private jewelrySkillXp = 0;
  /** Quest id currently expanded (null = all collapsed). */
  private expandedQuestId: string | null = null;
  /** Parent skill currently expanded (null = all collapsed). */
  private expandedSkillId: ParentSkillId | null = null;
  /** Field Guide page currently expanded (null = all collapsed). */
  private expandedGuideId: string | null = null;
  private overlay: HTMLElement;
  private panel: HTMLElement;
  private hintEl: HTMLElement;
  private tabsEl: HTMLElement;
  private bodyEl: HTMLElement;
  private ms?: Sheet;
  private msOn = false;
  private questFilter: QuestFilter = "active";
  private detailQuestId: string | null = null;
  private confirmAbandonId: string | null = null;

  constructor(private handlers: JournalUIHandlers) {
    this.overlay = document.createElement("div");
    this.overlay.id = "journal-overlay";
    this.overlay.hidden = true;

    const panel = document.createElement("div");
    panel.className = "inventory-panel journal-panel";
    this.panel = panel;

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
    if (tab && tab !== this.tab) {
      this.tab = tab;
      this.detailQuestId = null;
    }
    if (this.visible) {
      this.renderTabs();
      this.renderBody(true);
      return;
    }
    this.visible = true;
    this.overlay.hidden = false;
    document.body.classList.add("journal-open");
    this.msOn = useMobileSheet();
    this.panel.hidden = this.msOn;
    this.overlay.classList.toggle("ms-host", this.msOn);
    if (this.msOn && !this.ms) {
      this.ms = createSheet({ onClose: () => this.handlers.onClose() });
      this.ms.header.setTitle("Journal");
      this.overlay.append(this.ms.root);
    }
    if (this.ms) this.ms.root.hidden = !this.msOn;
    markSheetOpen("journal", this.msOn);
    this.detailQuestId = null;
    this.confirmAbandonId = null;
    resetDialogScroll(this.overlay);
    this.renderTabs();
    this.renderBody(true);
    AudioManager.get().play("ui_open");
  }

  close() {
    const wasOpen = this.visible;
    this.visible = false;
    this.overlay.hidden = true;
    document.body.classList.remove("journal-open");
    markSheetOpen("journal", false);
    if (wasOpen) AudioManager.get().play("ui_close");
  }

  isOpen() {
    return this.visible;
  }

  render(
    questsJson: string,
    skillsJson: string,
    jewelrySkillXp = this.jewelrySkillXp,
    reputation?: JournalReputation,
  ) {
    const questsChanged = questsJson !== this.questsJson;
    const skillsChanged = skillsJson !== this.skillsJson;
    const jewelryChanged = jewelrySkillXp !== this.jewelrySkillXp;
    const nextRep = reputation ?? this.reputation;
    const repChanged =
      nextRep.ashenMilitia !== this.reputation.ashenMilitia ||
      nextRep.ashenTraders !== this.reputation.ashenTraders ||
      nextRep.redOrder !== this.reputation.redOrder;
    this.questsJson = questsJson;
    this.skillsJson = skillsJson;
    this.jewelrySkillXp = jewelrySkillXp;
    this.reputation = nextRep;
    if (!this.visible) return;
    if (!questsChanged && !skillsChanged && !jewelryChanged && !repChanged) return;
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
    this.visible = false;
    this.overlay.hidden = true;
    this.ms?.dispose();
    this.overlay.remove();
    document.body.classList.remove("journal-open");
    markSheetOpen("journal", false);
  }

  private renderTabs() {
    if (this.msOn) return;
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
      makeTab("rep", "Reputation"),
      makeTab("guide", "Field Guide"),
    );
  }

  private renderBody(resetScroll = false) {
    if (this.msOn) {
      this.msRender(resetScroll);
      return;
    }
    const scrollTop = resetScroll ? 0 : this.bodyEl.scrollTop;
    this.bodyEl.replaceChildren();
    if (this.tab === "guide") {
      this.bodyEl.appendChild(this.buildGuide());
    } else if (this.tab === "skills") {
      this.bodyEl.appendChild(this.buildSkills(parseSkillsJson(this.skillsJson)));
    } else if (this.tab === "rep") {
      this.bodyEl.appendChild(this.buildReputation());
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

  private buildReputation(): HTMLElement {
    const list = document.createElement("div");
    list.className = "craft-recipe-list journal-skill-list";
    for (const faction of JOURNAL_FACTIONS) {
      list.appendChild(this.buildFactionRep(faction));
    }
    return list;
  }

  private buildFactionRep(faction: (typeof JOURNAL_FACTIONS)[number]): HTMLElement {
    const reputation = this.reputation[faction.id];
    const expanded = this.expandedFactionId === faction.id;

    const section = document.createElement("section");
    section.className = "craft-recipe journal-skill";
    if (expanded) section.classList.add("craft-recipe--expanded");

    const summary = document.createElement("button");
    summary.type = "button";
    summary.className = "craft-recipe-summary";
    summary.setAttribute("aria-expanded", expanded ? "true" : "false");
    summary.setAttribute(
      "aria-label",
      `${expanded ? "Collapse" : "Expand"} ${faction.name}`,
    );

    const icon = document.createElement("img");
    icon.className = "journal-skill-icon";
    icon.src = faction.icon;
    icon.alt = "";
    icon.draggable = false;

    const label = document.createElement("div");
    label.className = "craft-recipe-summary-text";
    const nameEl = document.createElement("span");
    nameEl.className = "craft-recipe-summary-name";
    nameEl.textContent = faction.name;
    const meta = document.createElement("span");
    meta.className = "craft-recipe-summary-meta";
    meta.textContent = repMeta(reputation);
    const bar = repBar(reputation);
    bar.classList.add("journal-skill-summary-bar");
    label.append(nameEl, meta, bar);
    summary.append(icon, label);

    const chevron = document.createElement("span");
    chevron.className = "craft-recipe-chevron";
    chevron.setAttribute("aria-hidden", "true");
    chevron.textContent = expanded ? "▾" : "▸";
    summary.appendChild(chevron);

    summary.addEventListener("click", () => {
      this.expandedFactionId =
        this.expandedFactionId === faction.id ? null : faction.id;
      this.renderBody();
    });
    section.appendChild(summary);

    if (!expanded) return section;

    const details = document.createElement("div");
    details.className = "craft-recipe-details";
    for (const line of repNotes(faction.id, reputation)) {
      const hint = document.createElement("div");
      hint.className = "craft-recipe-hint journal-skill-benefit";
      hint.textContent = line;
      details.appendChild(hint);
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

  // ── Phone sheet (design/mobile-dialogs board 11) ─────────────────────────

  private msRender(resetScroll: boolean) {
    const ms = this.ms;
    if (!ms) return;
    const scrollTop = resetScroll ? 0 : ms.body.scrollTop;
    renderTabs(
      ms.tabsSlot,
      [
        { id: "quests", label: "Quests", iconItemId: "journal" },
        { id: "skills", label: "Skills", iconSrc: PARENT_SKILL_ICONS.strength },
        { id: "rep", label: "Standing", iconItemId: "rep" },
        { id: "guide", label: "Guide", iconSrc: "/assets/UI/UI_note1.png" },
      ],
      this.tab,
      (id) => {
        this.tab = id as JournalTab;
        this.detailQuestId = null;
        this.confirmAbandonId = null;
        this.msRender(true);
      },
      { iconTabs: true },
    );
    ms.header.setTitle("Journal");
    ms.header.setBack(null);
    ms.bar.replaceChildren();
    ms.body.replaceChildren();
    const wrap = document.createElement("div");
    wrap.className = "jr-ms";
    if (this.tab === "skills") this.msSkills(wrap);
    else if (this.tab === "rep") this.msStanding(wrap);
    else if (this.tab === "guide") this.msGuide(wrap);
    else this.msQuests(wrap);
    ms.body.append(wrap);
    ms.syncBar();
    ms.body.scrollTop = scrollTop;
  }

  private msQuests(wrap: HTMLElement) {
    const state = parseQuestsJson(this.questsJson);
    const groups: Record<QuestFilter, QuestDefinition[]> = { active: [], done: [], failed: [] };
    for (const def of listTrackedJournalQuests(state)) {
      const status = questStatusOf(state, def.id);
      groups[status === "active" ? "active" : status === "failed" ? "failed" : "done"].push(def);
    }

    const detail = this.detailQuestId
      ? listTrackedJournalQuests(state).find((def) => def.id === this.detailQuestId)
      : undefined;
    if (detail) {
      this.msQuestDetail(wrap, state, detail);
      return;
    }
    this.detailQuestId = null;

    wrap.append(
      filterChips(
        [
          { id: "active", label: "Active", count: groups.active.length },
          { id: "done", label: "Done", count: groups.done.length },
          { id: "failed", label: "Failed", count: groups.failed.length },
        ],
        this.questFilter,
        (id) => {
          this.questFilter = id as QuestFilter;
          this.msRender(true);
        },
      ),
    );
    const shown = groups[this.questFilter];
    if (shown.length === 0) {
      const empty = document.createElement("p");
      empty.className = "ms-hint jr-empty";
      empty.textContent =
        this.questFilter === "active"
          ? "No jobs yet. Talk to a quest giver to accept one."
          : this.questFilter === "done"
            ? "Finished jobs show up here."
            : "Nothing failed. Keep it that way.";
      wrap.append(empty);
      return;
    }
    for (const def of shown) wrap.append(this.msQuestCard(state, def));
  }

  private questFacts(state: PlayerQuestsState, def: QuestDefinition) {
    const status = questStatusOf(state, def.id);
    const giver = questGiverLabel(def);
    const field = def.objectives.filter((obj) => obj.kind !== "turnInItem");
    const fieldOpen =
      status === "active" && field.some((obj) => !isQuestObjectiveDone(state, def, obj));
    const readyToReport = status === "active" && !fieldOpen && !questHasItemTurnIn(def);
    const point = status === "active" ? resolveQuestMapPoint(state, def) : null;
    return { status, giver, field, fieldOpen, readyToReport, point };
  }

  private questRewardText(def: QuestDefinition): string {
    const parts: string[] = [];
    const notes = questRewardBanknotes(def);
    if (notes > 0) parts.push(`$${notes}`);
    let rep = 0;
    for (const faction of REP_FACTIONS) rep += Math.max(0, questRewardReputation(def, faction));
    if (rep > 0) parts.push(`+${formatRepValue(rep)} rep`);
    return parts.join(" · ");
  }

  private msQuestCard(state: PlayerQuestsState, def: QuestDefinition): HTMLElement {
    const f = this.questFacts(state, def);
    const card = document.createElement("div");
    card.className = "ms-card jr-quest";
    if (def.story && f.status === "active") card.classList.add("ms-card--hl", "jr-quest--story");

    const top = document.createElement("div");
    top.className = "jr-quest-top";
    const name = document.createElement("b");
    name.className = "jr-quest-name";
    name.textContent = def.title;
    let tag: [string, ChipTone];
    if (f.status === "failed") tag = ["Failed", "r"];
    else if (f.status !== "active") tag = [def.repeatable ? "Repeatable" : "Done", ""];
    else if (f.readyToReport) tag = ["Ready", "lime"];
    else if (def.story) tag = ["Story", "y"];
    else tag = ["Accepted", "g"];
    top.append(name, chip(tag[0], tag[1]));
    card.append(top);

    const sub = document.createElement("div");
    sub.className = "ms-hint jr-quest-sub";
    sub.textContent = [f.giver, this.questRewardText(def)].filter(Boolean).join(" · ");
    if (sub.textContent) card.append(sub);

    if (f.status === "active") {
      const next = document.createElement("div");
      next.className = "jr-quest-next";
      const label = document.createElement("span");
      label.className = "ms-ok";
      label.textContent = "Next: ";
      next.append(label);
      card.append(next);
      if (f.readyToReport) {
        next.append(f.giver ? `Report back to ${f.giver}.` : "Report back to the quest giver.");
      } else {
        const pending =
          def.objectives.find(
            (obj) =>
              (f.fieldOpen ? obj.kind !== "turnInItem" : obj.kind === "turnInItem") &&
              !isQuestObjectiveDone(state, def, obj),
          ) ?? def.objectives.find((obj) => obj.kind === "turnInItem");
        if (pending) next.append(questObjectiveLine(state, def, pending));
        else next.append(f.giver ? `Turn in with ${f.giver}.` : "Turn in with the quest giver.");
        if (pending && f.fieldOpen) {
          const need = Math.max(1, pending.count ?? 1);
          const have = Math.min(need, state.quests[def.id]?.progress[pending.id] ?? 0);
          if (need > 1) {
            const bar = meter((have / need) * 100, "#d9b43a");
            bar.classList.add("jr-quest-meter");
            card.append(bar);
          }
        }
      }
    } else {
      const line = document.createElement("div");
      line.className = "ms-hint";
      line.textContent = f.status === "failed" ? "This job failed." : "Already reported.";
      card.append(line);
    }

    const actions = document.createElement("div");
    actions.className = "jr-quest-actions";
    if (f.point && this.handlers.onShowOnMap && (this.handlers.canShowMap?.() ?? true)) {
      const point = f.point;
      const mapBtn = sheetButton("Show on map", "sec", () => this.handlers.onShowOnMap?.(point.x, point.y), {
        small: true,
      });
      mapBtn.classList.add("jr-grow");
      actions.append(mapBtn);
    }
    actions.append(
      sheetButton("Details", "sec", () => {
        this.detailQuestId = def.id;
        this.confirmAbandonId = null;
        this.msRender(true);
      }, { small: true }),
    );
    card.append(actions);
    return card;
  }

  private msQuestDetail(wrap: HTMLElement, state: PlayerQuestsState, def: QuestDefinition) {
    const ms = this.ms!;
    const f = this.questFacts(state, def);
    ms.header.setTitle(def.title);
    ms.header.setBack(() => {
      this.detailQuestId = null;
      this.confirmAbandonId = null;
      this.msRender(true);
    });

    const card = document.createElement("div");
    card.className = "ms-card ms-card--pad";
    if (f.giver) {
      const giver = document.createElement("div");
      giver.className = "ms-hint";
      giver.textContent = f.giver;
      card.append(giver);
    }
    const desc = document.createElement("p");
    desc.className = "jr-desc";
    desc.textContent = def.description;
    card.append(desc);
    wrap.append(card);

    wrap.append(sectionLabel("Steps"));
    const steps = document.createElement("div");
    steps.className = "ms-card ms-card--pad jr-steps";
    for (const obj of def.objectives) {
      const done = f.status === "completed" || isQuestObjectiveDone(state, def, obj);
      const line = document.createElement("div");
      line.className = done ? "jr-step jr-step--done" : "jr-step";
      line.textContent = `${done ? "✓" : "•"} ${questObjectiveLine(state, def, obj)}`;
      steps.append(line);
    }
    const location = questAssignedLocationLabel(state, def.id);
    if (location && (f.fieldOpen || f.status !== "active")) {
      const loc = document.createElement("div");
      loc.className = "ms-hint";
      loc.textContent = `Marked ${location}`;
      steps.append(loc);
    }
    if (questFlag(state, def.id, "foundDead")) {
      const found = document.createElement("div");
      found.className = "ms-hint";
      found.textContent = "The pair did not make it. Davis will add 7.62.";
      steps.append(found);
    }
    wrap.append(steps);

    const turnIns = questTurnInItems(def);
    if (turnIns.length > 0) {
      wrap.append(sectionLabel("Turn in"));
      for (const item of turnIns) {
        wrap.append(
          sheetRow({
            iconItemId: item.itemId,
            qty: item.quantity,
            name: getItemDefinition(item.itemId)?.name ?? item.label,
            meta: [`${item.quantity} needed`],
          }),
        );
      }
    }

    const rewards: HTMLElement[] = [];
    const notes = questRewardBanknotes(def);
    if (notes > 0) {
      rewards.push(sheetRow({ iconItemId: "banknote", qty: notes, name: "Banknotes", meta: [`$${notes}`] }));
    }
    for (const faction of REP_FACTIONS) {
      const rep = questRewardReputation(def, faction);
      if (rep <= 0) continue;
      rewards.push(
        sheetRow({ iconItemId: "rep", name: `+${formatRepValue(rep)}`, meta: [reputationLabel(faction)] }),
      );
    }
    for (const reward of def.rewards) {
      if (!reward.itemId || (reward.quantity ?? 0) <= 0) continue;
      rewards.push(
        sheetRow({
          iconItemId: reward.itemId,
          qty: reward.quantity ?? 1,
          name: getItemDefinition(reward.itemId)?.name ?? reward.itemId,
        }),
      );
    }
    if (rewards.length > 0) wrap.append(sectionLabel("Rewards"), ...rewards);

    if (f.status === "active") {
      const hint = document.createElement("p");
      hint.className = "ms-hint jr-detail-hint";
      hint.textContent = f.fieldOpen
        ? f.giver
          ? `Finish the steps, then turn in with ${f.giver}.`
          : "Finish the steps, then turn them in."
        : questHasItemTurnIn(def)
          ? f.giver
            ? `Turn in with ${f.giver} once you have the items.`
            : "Turn in with the quest giver once you have the items."
          : f.giver
            ? `Report back to ${f.giver} when the job is done.`
            : "Report back to the quest giver when the job is done.";
      wrap.append(hint);
    }

    if (f.point && this.handlers.onShowOnMap && (this.handlers.canShowMap?.() ?? true)) {
      const point = f.point;
      ms.bar.append(sheetButton("Show on map", "pri", () => this.handlers.onShowOnMap?.(point.x, point.y)));
    }
    if (canAbandonQuest(state, def.id)) {
      const confirming = this.confirmAbandonId === def.id;
      const abandon = sheetButton(confirming ? "Tap again to abandon" : "Abandon", "danger", () => {
        if (this.confirmAbandonId !== def.id) {
          this.confirmAbandonId = def.id;
          this.msRender(false);
          return;
        }
        this.confirmAbandonId = null;
        this.detailQuestId = null;
        this.handlers.onAbandonQuest(def.id);
        this.msRender(true);
      });
      ms.bar.append(abandon);
      if (confirming) {
        const note = document.createElement("p");
        note.className = "ms-bar-note ms-bar-note--warn";
        note.textContent = "You lose progress on this job.";
        ms.bar.prepend(note);
      }
    }
  }

  private msSkills(wrap: HTMLElement) {
    const state = parseSkillsJson(this.skillsJson);
    for (const parentId of PARENT_SKILL_IDS) {
      const parent = state[parentId];
      const progress = parent ?? { level: 0, xp: 0 };
      const open = this.expandedSkillId === parentId;
      const pct =
        progress.level >= SKILL_LEVEL_MAX
          ? 100
          : Math.max(0, Math.min(100, (progress.xp / Math.max(1, xpToNextLevel(progress.level))) * 100));
      const icon = document.createElement("img");
      icon.src = PARENT_SKILL_ICONS[parentId];
      icon.alt = "";
      icon.draggable = false;
      const lv = document.createElement("span");
      lv.className = "jr-lv";
      lv.textContent = open ? skillMeta(progress, SKILL_LEVEL_MAX) : `Lv ${progress.level}`;
      const bar = meter(pct, "linear-gradient(90deg,#5a9a5a,#9fe830)");
      const row = sheetRow({
        iconEl: icon,
        name: PARENT_SKILL_LABELS[parentId],
        meta: [lv, bar],
        chevron: true,
        state: open ? "on" : undefined,
        ariaLabel: `${open ? "Collapse" : "Expand"} ${PARENT_SKILL_LABELS[parentId]}`,
        onTap: () => {
          this.expandedSkillId = open ? null : parentId;
          this.msRender(false);
        },
      });
      row.classList.add("jr-skill-row");
      if (!open) {
        wrap.append(row);
        continue;
      }
      const card = document.createElement("div");
      card.className = "ms-card ms-card--hl jr-skill-open";
      const subs = document.createElement("div");
      subs.className = "jr-subs";
      for (const subId of SUB_SKILLS_BY_PARENT[parentId]) {
        const sub = parent?.subs?.[subId] ?? { level: 0, xp: 0 };
        const cell = document.createElement("div");
        cell.className = "jr-sub";
        const head = document.createElement("div");
        head.className = "jr-sub-head";
        const nm = document.createElement("b");
        nm.textContent = SUB_SKILL_LABELS[subId];
        const capped = sub.level >= progress.level && progress.level < SKILL_LEVEL_MAX;
        const lvText = document.createElement("div");
        lvText.className = "jr-sub-lv";
        lvText.textContent = `Lv ${sub.level}`;
        if (
          this.jewelrySkillXp > 0 &&
          (subId === "bartering" || subId === "persuasion")
        ) {
          lvText.textContent += ` · Buffed ${buffedSubSkillLevel(state, subId, this.jewelrySkillXp)}`;
        }
        if (capped) lvText.append(" ", chip("capped", "y"));
        head.append(nm, lvText);
        const benefit = document.createElement("div");
        benefit.className = "jr-sub-fx";
        benefit.textContent = SUB_SKILL_BENEFIT[subId].join(". ");
        cell.append(head, benefit);
        if (capped) cell.title = `Capped by ${PARENT_SKILL_LABELS[parentId]}`;
        subs.append(cell);
      }
      card.append(row, subs);
      if (SUB_SKILLS_BY_PARENT[parentId].some((id) => (parent?.subs?.[id]?.level ?? 0) >= progress.level) &&
        progress.level < SKILL_LEVEL_MAX) {
        const note = document.createElement("p");
        note.className = "ms-hint jr-cap-note";
        note.textContent = `Capped sub-skills can't go above your ${PARENT_SKILL_LABELS[parentId]} level.`;
        card.append(note);
      }
      wrap.append(card);
    }
  }

  private msStanding(wrap: HTMLElement) {
    for (const faction of JOURNAL_FACTIONS) {
      const reputation = this.reputation[faction.id];
      const standing = factionStanding(reputation);
      const at = STANDING_BANDS.findIndex((band) => band.id === standing);
      const card = document.createElement("div");
      card.className = "ms-card ms-card--pad jr-rep";
      if (at <= 1) card.classList.add("jr-rep--bad");

      const top = document.createElement("div");
      top.className = "jr-rep-top";
      const icon = document.createElement("img");
      icon.src = faction.icon;
      icon.alt = "";
      icon.draggable = false;
      const name = document.createElement("b");
      name.textContent = faction.name;
      const pill = document.createElement("span");
      pill.className = "jr-rep-pill";
      pill.style.borderColor = STANDING_BANDS[at]?.color ?? "";
      pill.style.color = STANDING_BANDS[at]?.color ?? "";
      pill.textContent = factionStandingLabel(standing);
      top.append(icon, name, pill);

      const bands = document.createElement("div");
      bands.className = "jr-bands";
      bands.setAttribute("aria-label", `${factionStandingLabel(standing)}, ${repMeta(reputation)}`);
      STANDING_BANDS.forEach((band, i) => {
        const seg = document.createElement("i");
        if (i <= at) seg.style.background = band.color;
        if (i === at) seg.className = "jr-band--on";
        bands.append(seg);
      });

      const lines = repNotes(faction.id, reputation);
      const nextAt = factionNextStandingAt(standing);
      const next = factionNextStanding(standing);
      const head = document.createElement("div");
      head.className = at <= 2 ? "ms-hint ms-warn" : "ms-hint";
      head.textContent =
        next && nextAt != null
          ? `${formatRepValue(reputation)} / ${nextAt} to ${factionStandingLabel(next)}.`
          : `${formatRepValue(reputation)}. Highest standing.`;
      const meaning = document.createElement("div");
      meaning.className = "jr-rep-note";
      meaning.textContent = lines.filter((line) => !line.startsWith("Next:") && line !== "Highest standing.").join(" ");
      card.append(top, bands, head);
      if (meaning.textContent) card.append(meaning);
      wrap.append(card);
    }
    const legend = document.createElement("p");
    legend.className = "ms-hint jr-legend";
    legend.textContent = STANDING_BANDS.map((band) => factionStandingLabel(band.id)).join(" · ");
    wrap.append(legend);
  }

  private msGuide(wrap: HTMLElement) {
    const actions = document.createElement("div");
    actions.className = "jr-guide-actions";
    actions.append(
      sheetButton("Controls", "sec", () => this.handlers.onShowControls()),
      sheetButton("Replay tutorial", "sec", () => this.handlers.onReplayTutorial()),
    );
    wrap.append(actions);
    for (const page of FIELD_GUIDE_PAGES) {
      const open = this.expandedGuideId === page.id;
      const row = sheetRow({
        name: page.title,
        chevron: true,
        state: open ? "on" : undefined,
        onTap: () => {
          this.expandedGuideId = open ? null : page.id;
          this.msRender(false);
        },
      });
      row.classList.add("jr-guide-row");
      if (open) row.classList.add("jr-guide-row--open");
      wrap.append(row);
      if (!open) continue;
      const body = document.createElement("div");
      body.className = "ms-card ms-card--pad jr-guide-page";
      for (const text of page.paragraphs) {
        const p = document.createElement("p");
        p.textContent = text;
        body.append(p);
      }
      wrap.append(body);
    }
  }
}
