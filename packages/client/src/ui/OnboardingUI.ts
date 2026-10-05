import { resetDialogScroll } from "./dialogScroll";
import {
  CONTROLS_DESKTOP,
  CONTROLS_MOBILE,
  ONBOARDING_STEP_IDS,
  ONBOARDING_STEPS,
  TUTORIAL_TIPS,
  onboardingChapterTitle,
  parseTutorialFlagsJson,
  type OnboardingStepDef,
  type OnboardingStepId,
  type TutorialCompleteStepMessage,
  type TutorialFlagsState,
  type TutorialTipId,
} from "@zombie/shared";
import { isMobileDevice } from "../device";

/** Where the player is with Davis's First Sweep job. */
export type FirstSweepState = "none" | "active" | "cleared" | "done";

export type OnboardingUIHandlers = {
  send: (payload: TutorialCompleteStepMessage) => void;
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
  private sweep: FirstSweepState = "none";
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
    legendPanel.append(legendTitle, list, legendHint, closeLegend);
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
    tipActions.append(
      makeButton("Got it", "tutorial-btn", () => this.dismissTip()),
      makeButton("Turn off tips", "tutorial-btn tutorial-btn--quiet", () => {
        this.flags.tipsOff = true;
        this.handlers.send({ tipsOff: true });
        this.tipQueue = [];
        this.dismissTip();
      }),
    );
    this.tipEl.append(this.tipTitleEl, this.tipBodyEl, tipActions);
    this.stack.appendChild(this.tipEl);
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

  setFirstSweepState(state: FirstSweepState) {
    if (state === this.sweep) return;
    this.sweep = state;
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

  /**
   * First step not yet done. First Sweep steps finish themselves once the
   * job is turned in, and point back at "take the job" if it was dropped.
   */
  private resolveCurrent(): OnboardingStepId | null {
    const steps = this.flags.steps ?? {};
    const autoDone: OnboardingStepId[] = [];
    if (this.sweep !== "none") autoDone.push("talk_davis", "accept_first_sweep");
    if (this.sweep === "cleared" || this.sweep === "done") autoDone.push("clear_target");
    if (this.sweep === "done") autoDone.push("turn_in_first_sweep");
    for (const id of autoDone) {
      if (!steps[id]) this.markStep(id);
    }
    for (const id of ONBOARDING_STEP_IDS) {
      if (this.flags.steps?.[id]) continue;
      const def = ONBOARDING_STEPS[id];
      if (def.needsFirstSweep) {
        if (this.sweep === "done") {
          this.markStep(id);
          continue;
        }
        if (this.sweep === "none") return "accept_first_sweep";
      }
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
    const minimized = this.flags.minimized === true;
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
    // Skipping "take the job" while it is not taken moves on past the whole job.
    if (this.currentId === "accept_first_sweep" && this.sweep === "none") {
      for (const id of ONBOARDING_STEP_IDS) {
        if (id === "accept_first_sweep" || ONBOARDING_STEPS[id].needsFirstSweep) {
          if (!this.flags.steps?.[id]) this.markStep(id);
        }
      }
      if (!this.flags.steps?.talk_davis) this.markStep("talk_davis");
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
    this.tipBodyEl.textContent = tip.body;
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
