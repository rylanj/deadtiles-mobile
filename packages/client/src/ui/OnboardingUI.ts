import { resetDialogScroll } from "./dialogScroll";
import {
  CONTROLS_DESKTOP,
  CONTROLS_MOBILE,
  ONBOARDING_STEP_IDS,
  ONBOARDING_STEPS,
  QUEST_ID_AYE_CAPTAIN,
  QUEST_ID_FOUND_ON_THE_ROAD,
  QUEST_ID_TWO_BEHIND,
  TUTORIAL_TIPS,
  onboardingChapterTitle,
  parseTutorialFlagsJson,
  type OnboardingStepDef,
  type OnboardingStepId,
  type PlayerQuestsState,
  type TutorialCompleteStepMessage,
  type TutorialFlagsState,
  type TutorialTipDef,
  type TutorialTipId,
} from "@zombie/shared";
import { isMobileDevice } from "../device";
import { sheetCloseButton } from "./mobileSheet";
import "./mobile/alerts.css";

export type OnboardingUIHandlers = {
  send: (payload: TutorialCompleteStepMessage) => void;
  openBag?: () => void;
  openJournal?: () => void;
};

/** Phone tips get one button that does the thing the tip asks for. */
const TIP_ACTIONS: Partial<Record<TutorialTipId, { label: string; run: "bag" | "journal" }>> = {
  hungry: { label: "Open bag", run: "bag" },
  thirsty: { label: "Open bag", run: "bag" },
  cold: { label: "Open bag", run: "bag" },
  hot: { label: "Open bag", run: "bag" },
  wet: { label: "Open bag", run: "bag" },
  infected: { label: "Open bag", run: "bag" },
  raw_meat: { label: "Open bag", run: "bag" },
  low_health: { label: "Open bag", run: "bag" },
  weapon_broke: { label: "Open bag", run: "bag" },
  standing_hostile: { label: "Open journal", run: "journal" },
};

const TIP_SHOW_MS = 14_000;
const STEP_DONE_FLASH_MS = 900;

/**
 * Tutorial coach: a small non-modal tracker with one objective at a time,
 * full cards for the intro and finish, and one-time contextual tips.
 * Nothing here blocks play. The player can hide or end it at any point.
 */
export class OnboardingUI {
  private flags: TutorialFlagsState = parseTutorialFlagsJson("");
  private loaded = false;
  private quests: PlayerQuestsState = { quests: {} };
  private questsReady = false;
  private mobile = isMobileDevice();
  private currentId: OnboardingStepId | null = null;

  private stack: HTMLElement;
  private tracker: HTMLElement;
  private chapterEl: HTMLElement;
  private progressEl: HTMLElement;
  private titleEl: HTMLElement;
  private bodyEl: HTMLElement;
  private pill: HTMLElement;
  private endBtn: HTMLButtonElement;
  private endConfirmTimer: number | null = null;
  private flashTimer: number | null = null;

  private cardOverlay: HTMLElement;
  private cardChapterEl: HTMLElement;
  private cardTitleEl: HTMLElement;
  private cardBodyEl: HTMLElement;
  private cardBtn: HTMLButtonElement;
  private cardSkipBtn: HTMLButtonElement;
  private cardOpen = false;

  private legendEl: HTMLElement;
  private legendOpen = false;

  private tipEl: HTMLElement;
  private tipTitleEl: HTMLElement;
  private tipBodyEl: HTMLElement;
  private tipQueue: TutorialTipId[] = [];
  private tipShowing: TutorialTipId | null = null;
  private tipTimer: number | null = null;
  private tipActionBtn: HTMLButtonElement;
  private lineProgressEl?: HTMLElement;
  private lineTitleEl?: HTMLElement;
  private lineChevronEl?: HTMLElement;
  private trackerExpanded = false;

  constructor(private handlers: OnboardingUIHandlers) {
    this.stack = document.createElement("div");
    this.stack.id = "tutorial-stack";
    document.body.appendChild(this.stack);

    // Tracker
    this.tracker = document.createElement("div");
    this.tracker.id = "tutorial-tracker";
    this.tracker.className = "inventory-panel tutorial-tracker";
    this.tracker.hidden = true;

    const head = document.createElement("div");
    head.className = "tutorial-tracker-head";
    this.chapterEl = document.createElement("span");
    this.chapterEl.className = "tutorial-tracker-chapter";
    this.progressEl = document.createElement("span");
    this.progressEl.className = "tutorial-tracker-progress";
    const hideBtn = makeButton("Hide", "tutorial-btn tutorial-btn--quiet", () =>
      this.setMinimized(true),
    );
    head.append(this.chapterEl, this.progressEl, hideBtn);

    this.titleEl = document.createElement("div");
    this.titleEl.className = "tutorial-tracker-title";
    this.bodyEl = document.createElement("p");
    this.bodyEl.className = "tutorial-tracker-body";

    const actions = document.createElement("div");
    actions.className = "tutorial-tracker-actions";
    const skipBtn = makeButton("Skip step", "tutorial-btn", () => this.skipCurrent());
    const controlsBtn = makeButton("Controls", "tutorial-btn", () => this.openLegend());
    this.endBtn = makeButton("End tutorial", "tutorial-btn tutorial-btn--quiet", () =>
      this.confirmEnd(),
    );
    actions.append(skipBtn, controlsBtn, this.endBtn);

    this.tracker.append(head, this.titleEl, this.bodyEl, actions);
    if (this.mobile) {
      // One 44px line under the HUD. The arrow opens the step text and actions.
      this.tracker.classList.add("tutorial-tracker--phone");
      const line = makeButton("", "tutorial-line", () => {
        this.trackerExpanded = !this.trackerExpanded;
        this.syncTrackerExpanded();
      });
      this.lineProgressEl = document.createElement("span");
      this.lineProgressEl.className = "ms-chip ms-chip--g tutorial-line-n";
      this.lineTitleEl = document.createElement("span");
      this.lineTitleEl.className = "tutorial-line-title";
      this.lineChevronEl = document.createElement("span");
      this.lineChevronEl.className = "tutorial-line-chev";
      this.lineChevronEl.setAttribute("aria-hidden", "true");
      line.append(this.lineProgressEl, this.lineTitleEl, this.lineChevronEl);
      this.tracker.prepend(line);
      actions.append(
        makeButton("Turn off tips", "tutorial-btn tutorial-btn--quiet", () => {
          this.flags.tipsOff = true;
          this.handlers.send({ tipsOff: true });
          this.tipQueue = [];
          if (this.tipShowing) this.dismissTip();
        }),
      );
      this.syncTrackerExpanded();
    }

    this.pill = makeButton("", "tutorial-pill", () => this.setMinimized(false));
    this.pill.id = "tutorial-pill";
    this.pill.hidden = true;
    this.stack.append(this.tracker, this.pill);

    // Intro / finish card
    this.cardOverlay = document.createElement("div");
    this.cardOverlay.id = "onboarding-overlay";
    this.cardOverlay.hidden = true;
    const card = document.createElement("div");
    card.className = "inventory-panel onboarding-panel";
    this.cardChapterEl = document.createElement("div");
    this.cardChapterEl.className = "tutorial-tracker-chapter";
    this.cardTitleEl = document.createElement("h2");
    this.cardTitleEl.className = "onboarding-title";
    this.cardBodyEl = document.createElement("p");
    this.cardBodyEl.className = "onboarding-body";
    const cardActions = document.createElement("div");
    cardActions.className = "onboarding-actions";
    this.cardBtn = makeButton("Begin", "onboarding-next", () => this.completeCard());
    this.cardSkipBtn = makeButton("Skip tutorial", "onboarding-skip", () => {
      this.closeCard();
      this.endTutorial();
    });
    const cardControls = makeButton("Controls", "onboarding-legend-btn", () =>
      this.openLegend(),
    );
    cardActions.append(this.cardBtn, this.cardSkipBtn, cardControls);
    card.append(this.cardChapterEl, this.cardTitleEl, this.cardBodyEl, cardActions);
    this.cardOverlay.appendChild(card);
    document.body.appendChild(this.cardOverlay);

    // Controls legend
    this.legendEl = document.createElement("div");
    this.legendEl.id = "onboarding-controls-legend";
    this.legendEl.hidden = true;
    const legendPanel = document.createElement("div");
    legendPanel.className = "inventory-panel onboarding-legend-panel";
    const legendTitle = document.createElement("h2");
    legendTitle.className = "onboarding-title";
    legendTitle.textContent = "Controls";
    const list = document.createElement("ul");
    list.className = "onboarding-legend-list";
    for (const row of this.mobile ? CONTROLS_MOBILE : CONTROLS_DESKTOP) {
      const li = document.createElement("li");
      const k = document.createElement("kbd");
      k.textContent = row.key;
      const a = document.createElement("span");
      a.textContent = row.action;
      li.append(k, a);
      list.appendChild(li);
    }
    const legendHint = document.createElement("p");
    legendHint.className = "onboarding-body";
    legendHint.textContent = this.mobile
      ? "The Field Guide in your Journal explains the rest."
      : "Press J for the Field Guide in your Journal. Esc reopens this list.";
    const closeLegend = makeButton("Close", "onboarding-next", () => this.closeLegend());
    if (this.mobile) {
      this.legendEl.classList.add("onboarding-legend--phone");
      const legendHead = document.createElement("div");
      legendHead.className = "onboarding-legend-head";
      legendHead.append(legendTitle, sheetCloseButton(() => this.closeLegend()));
      legendPanel.append(legendHead, list, legendHint);
    } else {
      legendPanel.append(legendTitle, list, legendHint, closeLegend);
    }
    this.legendEl.appendChild(legendPanel);
    this.legendEl.addEventListener("click", (e) => {
      if (e.target === this.legendEl) this.closeLegend();
    });
    document.body.appendChild(this.legendEl);

    // Tip toast
    this.tipEl = document.createElement("div");
    this.tipEl.id = "tutorial-tip";
    this.tipEl.className = "inventory-panel tutorial-tip";
    this.tipEl.hidden = true;
    this.tipTitleEl = document.createElement("div");
    this.tipTitleEl.className = "tutorial-tracker-title";
    this.tipBodyEl = document.createElement("p");
    this.tipBodyEl.className = "tutorial-tracker-body";
    const tipActions = document.createElement("div");
    tipActions.className = "tutorial-tracker-actions";
    this.tipActionBtn = makeButton("", "tutorial-btn tutorial-btn--do", () => {
      const action = this.tipShowing ? TIP_ACTIONS[this.tipShowing] : undefined;
      this.dismissTip();
      if (action?.run === "bag") this.handlers.openBag?.();
      else if (action?.run === "journal") this.handlers.openJournal?.();
    });
    this.tipActionBtn.hidden = true;
    tipActions.append(this.tipActionBtn, makeButton("Got it", "tutorial-btn", () => this.dismissTip()));
    if (!this.mobile) {
      tipActions.append(
        makeButton("Turn off tips", "tutorial-btn tutorial-btn--quiet", () => {
          this.flags.tipsOff = true;
          this.handlers.send({ tipsOff: true });
          this.tipQueue = [];
          this.dismissTip();
        }),
      );
    }
    this.tipEl.append(this.tipTitleEl, this.tipBodyEl, tipActions);
    if (this.mobile) {
      // Above the joystick, out of the top HUD.
      this.tipEl.classList.add("tutorial-tip--phone");
      document.body.appendChild(this.tipEl);
    } else {
      this.stack.appendChild(this.tipEl);
    }
  }

  private syncTrackerExpanded() {
    this.tracker.classList.toggle("tutorial-tracker--open", this.trackerExpanded);
    if (this.lineChevronEl) this.lineChevronEl.textContent = this.trackerExpanded ? "⌃" : "⌄";
  }

  /** A modal piece (legend or card) is open and should take Esc first. */
  isOpen() {
    return this.legendOpen || this.cardOpen;
  }

  isTutorialActive() {
    return this.loaded && this.flags.done !== true;
  }

  /** True once the player finishes or ends the tutorial. */
  isFinished() {
    return this.flags.done === true;
  }

  applyFlagsJson(json: string) {
    this.flags = parseTutorialFlagsJson(json);
    this.loaded = true;
    this.render();
  }

  setQuestState(state: PlayerQuestsState) {
    this.quests = state;
    this.questsReady = true;
    if (this.loaded) this.render();
  }

  /** Gameplay saw the player do a step. Steps complete in any order. */
  notifyStep(stepId: OnboardingStepId) {
    if (!this.loaded || this.flags.done) return;
    if (this.flags.steps?.[stepId]) return;
    this.markStep(stepId);
    this.render();
  }

  hasStep(stepId: OnboardingStepId) {
    return this.flags.steps?.[stepId] === true;
  }

  /** Show a one-time tip the first time its situation comes up. */
  notifyTip(tipId: TutorialTipId) {
    if (!this.loaded || this.flags.tipsOff) return;
    if (this.flags.tips?.[tipId]) return;
    this.flags.tips = { ...(this.flags.tips ?? {}), [tipId]: true };
    this.handlers.send({ tipId });
    this.tipQueue.push(tipId);
    this.pumpTips();
  }

  /** Restart from the intro card. Seen tips stay seen. */
  replay() {
    this.flags = {
      ...this.flags,
      done: false,
      steps: {},
      minimized: false,
    };
    this.handlers.send({ reset: true });
    this.render();
  }

  toggleLegend() {
    if (this.legendOpen) this.closeLegend();
    else this.openLegend();
  }

  openLegend() {
    this.legendOpen = true;
    this.legendEl.hidden = false;
    document.body.classList.add("onboarding-legend-open");
    resetDialogScroll(this.legendEl);
  }

  closeLegend() {
    if (!this.legendOpen) return;
    this.legendOpen = false;
    this.legendEl.hidden = true;
    document.body.classList.remove("onboarding-legend-open");
  }

  /** Esc: close the legend first, then treat the card as acknowledged. */
  closeTopmost() {
    if (this.legendOpen) {
      this.closeLegend();
      return;
    }
    if (this.cardOpen) this.completeCard();
  }

  destroy() {
    this.closeLegend();
    this.closeCard();
    if (this.tipTimer != null) window.clearTimeout(this.tipTimer);
    if (this.flashTimer != null) window.clearTimeout(this.flashTimer);
    if (this.endConfirmTimer != null) window.clearTimeout(this.endConfirmTimer);
    this.stack.remove();
    this.tipEl.remove();
    this.cardOverlay.remove();
    this.legendEl.remove();
  }

  private markStep(stepId: OnboardingStepId) {
    this.flags.steps = { ...(this.flags.steps ?? {}), [stepId]: true };
    this.handlers.send({ stepId });
    if (ONBOARDING_STEP_IDS.every((id) => this.flags.steps?.[id])) {
      this.flags.done = true;
    }
  }

  private storyActive(questId: string): boolean {
    return this.quests.quests[questId]?.status === "active";
  }

  private storyDone(questId: string): boolean {
    const quest = this.quests.quests[questId];
    return quest?.status === "completed" || (quest?.timesCompleted ?? 0) > 0;
  }

  /**
   * First step not yet done. Story steps finish themselves once the quest
   * moves on, and point back at the accept step if it was dropped.
   */
  private resolveCurrent(): OnboardingStepId | null {
    const ayeOn = this.storyActive(QUEST_ID_AYE_CAPTAIN) || this.storyDone(QUEST_ID_AYE_CAPTAIN);
    const ayeDone = this.storyDone(QUEST_ID_AYE_CAPTAIN);
    const twoOn = this.storyActive(QUEST_ID_TWO_BEHIND) || this.storyDone(QUEST_ID_TWO_BEHIND);
    const noteFound = this.storyDone(QUEST_ID_TWO_BEHIND);
    const autoDone: OnboardingStepId[] = [];
    if (ayeOn) autoDone.push("accept_aye_captain");
    if (ayeDone) autoDone.push("talk_davis", "turn_in_aye");
    if (twoOn) autoDone.push("accept_two_behind");
    if (noteFound) autoDone.push("search_coleman");
    const found = this.quests.quests[QUEST_ID_FOUND_ON_THE_ROAD];
    const onStory =
      ayeOn ||
      found?.status === "active" ||
      found?.status === "completed" ||
      (found?.timesCompleted ?? 0) > 0;
    if (this.questsReady && !onStory) {
      autoDone.push(
        "accept_aye_captain",
        "turn_in_aye",
        "accept_two_behind",
        "search_coleman",
      );
    }
    for (const id of autoDone) {
      if (!this.flags.steps?.[id]) this.markStep(id);
    }
    for (const id of ONBOARDING_STEP_IDS) {
      if (this.flags.steps?.[id]) continue;
      if (id === "talk_davis" && onStory && !ayeOn) return "accept_aye_captain";
      if (id === "turn_in_aye" && !ayeOn) return "accept_aye_captain";
      if ((id === "accept_two_behind" || id === "search_coleman") && !ayeDone) {
        return ayeOn ? "turn_in_aye" : "accept_aye_captain";
      }
      if (id === "search_coleman" && !twoOn) return "accept_two_behind";
      return id;
    }
    return null;
  }

  private render() {
    if (!this.loaded || this.flags.done) {
      this.currentId = null;
      this.tracker.hidden = true;
      this.pill.hidden = true;
      this.closeCard();
      return;
    }
    const nextId = this.resolveCurrent();
    if (nextId == null || this.flags.done) {
      this.currentId = null;
      this.tracker.hidden = true;
      this.pill.hidden = true;
      this.closeCard();
      return;
    }
    const advanced = this.currentId != null && this.currentId !== nextId;
    this.currentId = nextId;
    const def = ONBOARDING_STEPS[nextId];

    if (def.card) {
      this.tracker.hidden = true;
      this.pill.hidden = true;
      this.openCard(def);
      return;
    }
    this.closeCard();

    this.chapterEl.textContent = onboardingChapterTitle(def.chapter);
    this.progressEl.textContent = this.progressLabel();
    this.titleEl.textContent = def.title;
    this.bodyEl.textContent = this.bodyFor(def);
    this.pill.textContent = `Tutorial: ${def.title}`;
    if (this.lineTitleEl && this.lineProgressEl) {
      this.lineTitleEl.textContent = def.title;
      this.lineProgressEl.textContent = this.progressLabel();
    }
    const minimized = !this.mobile && this.flags.minimized === true;
    this.tracker.hidden = minimized;
    this.pill.hidden = !minimized;
    if (advanced) this.flashAdvance();
  }

  private progressLabel(): string {
    const total = ONBOARDING_STEP_IDS.length;
    const done = ONBOARDING_STEP_IDS.filter((id) => this.flags.steps?.[id]).length;
    return `${done}/${total}`;
  }

  private bodyFor(def: OnboardingStepDef): string {
    return this.mobile && def.mobileBody ? def.mobileBody : def.body;
  }

  private tipBodyFor(tip: TutorialTipDef): string {
    return this.mobile && tip.mobileBody ? tip.mobileBody : tip.body;
  }

  private flashAdvance() {
    const target = this.flags.minimized ? this.pill : this.tracker;
    target.classList.remove("tutorial--advanced");
    void target.offsetWidth;
    target.classList.add("tutorial--advanced");
    if (this.flashTimer != null) window.clearTimeout(this.flashTimer);
    this.flashTimer = window.setTimeout(() => {
      this.tracker.classList.remove("tutorial--advanced");
      this.pill.classList.remove("tutorial--advanced");
      this.flashTimer = null;
    }, STEP_DONE_FLASH_MS);
  }

  private openCard(def: OnboardingStepDef) {
    this.cardChapterEl.textContent = onboardingChapterTitle(def.chapter);
    this.cardTitleEl.textContent = def.title;
    this.cardBodyEl.textContent = this.bodyFor(def);
    this.cardBtn.textContent = def.card?.button ?? "Continue";
    this.cardSkipBtn.hidden = def.id !== "intro";
    if (this.cardOpen) return;
    this.cardOpen = true;
    this.cardOverlay.hidden = false;
    document.body.classList.add("onboarding-open");
    resetDialogScroll(this.cardOverlay);
  }

  private closeCard() {
    if (!this.cardOpen) return;
    this.cardOpen = false;
    this.cardOverlay.hidden = true;
    document.body.classList.remove("onboarding-open");
    this.pumpTips();
  }

  private completeCard() {
    const id = this.currentId;
    if (!id || !ONBOARDING_STEPS[id].card) {
      this.closeCard();
      return;
    }
    this.markStep(id);
    this.render();
  }

  private skipCurrent() {
    if (!this.currentId) return;
    // Skipping the first story accept moves on past the rest of that chapter.
    if (
      this.currentId === "accept_aye_captain" &&
      !this.storyActive(QUEST_ID_AYE_CAPTAIN) &&
      !this.storyDone(QUEST_ID_AYE_CAPTAIN)
    ) {
      for (const id of [
        "accept_aye_captain",
        "turn_in_aye",
        "accept_two_behind",
        "search_coleman",
      ] as const) {
        if (!this.flags.steps?.[id]) this.markStep(id);
      }
    } else {
      this.markStep(this.currentId);
    }
    this.render();
  }

  private confirmEnd() {
    if (this.endConfirmTimer != null) {
      window.clearTimeout(this.endConfirmTimer);
      this.endConfirmTimer = null;
      this.endBtn.textContent = "End tutorial";
      this.endTutorial();
      return;
    }
    this.endBtn.textContent = "Tap again to end";
    this.endConfirmTimer = window.setTimeout(() => {
      this.endConfirmTimer = null;
      this.endBtn.textContent = "End tutorial";
    }, 3000);
  }

  private endTutorial() {
    this.flags.done = true;
    this.handlers.send({ done: true });
    this.render();
  }

  private setMinimized(minimized: boolean) {
    if ((this.flags.minimized === true) === minimized) return;
    this.flags.minimized = minimized;
    this.handlers.send({ minimized });
    this.render();
  }

  private pumpTips() {
    if (this.tipShowing || this.cardOpen) return;
    const next = this.tipQueue.shift();
    if (!next) return;
    const tip = TUTORIAL_TIPS[next];
    this.tipShowing = next;
    this.tipTitleEl.textContent = tip.title;
    this.tipBodyEl.textContent = this.tipBodyFor(tip);
    const action = this.mobile ? TIP_ACTIONS[next] : undefined;
    this.tipActionBtn.hidden = !action;
    this.tipActionBtn.textContent = action?.label ?? "";
    this.tipEl.hidden = false;
    this.tipTimer = window.setTimeout(() => this.dismissTip(), TIP_SHOW_MS);
  }

  private dismissTip() {
    if (this.tipTimer != null) window.clearTimeout(this.tipTimer);
    this.tipTimer = null;
    this.tipShowing = null;
    this.tipEl.hidden = true;
    window.setTimeout(() => this.pumpTips(), 400);
  }
}

function makeButton(
  text: string,
  className: string,
  onClick: () => void,
): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = className;
  btn.textContent = text;
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    onClick();
  });
  return btn;
}
