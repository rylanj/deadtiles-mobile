import { resetDialogScroll } from "./dialogScroll";
import {
  ONBOARDING_CONTROLS_LEGEND,
  ONBOARDING_STEPS,
  type OnboardingStepId,
  type TutorialFlagsState,
  parseTutorialFlagsJson,
} from "@zombie/shared";

export type OnboardingUIHandlers = {
  onCompleteStep: (stepId: OnboardingStepId) => void;
  onSkipAll: () => void;
  /** Persist that the coach was shown so reconnects do not reopen it. */
  onSeen: () => void;
};

/**
 * First-session coach marks for Birchport hospital wake.
 * Controls legend stays available after the tutorial finishes.
 */
export class OnboardingUI {
  private overlay: HTMLElement;
  private titleEl: HTMLElement;
  private bodyEl: HTMLElement;
  private stepIndex = 0;
  private flags: TutorialFlagsState = { done: false, seen: false, steps: {} };
  private visible = false;
  private legendOpen = false;
  private legendEl: HTMLElement;

  constructor(private handlers: OnboardingUIHandlers) {
    this.overlay = document.createElement("div");
    this.overlay.id = "onboarding-overlay";
    this.overlay.hidden = true;

    const panel = document.createElement("div");
    panel.className = "inventory-panel onboarding-panel";

    this.titleEl = document.createElement("h2");
    this.titleEl.className = "onboarding-title";

    this.bodyEl = document.createElement("p");
    this.bodyEl.className = "onboarding-body";

    const actions = document.createElement("div");
    actions.className = "onboarding-actions";

    const nextBtn = document.createElement("button");
    nextBtn.type = "button";
    nextBtn.className = "onboarding-next";
    nextBtn.textContent = "Got it";
    nextBtn.addEventListener("click", () => this.completeCurrent());

    const skipBtn = document.createElement("button");
    skipBtn.type = "button";
    skipBtn.className = "onboarding-skip";
    skipBtn.textContent = "Skip tutorial";
    skipBtn.addEventListener("click", () => this.skipAll());

    const legendBtn = document.createElement("button");
    legendBtn.type = "button";
    legendBtn.className = "onboarding-legend-btn";
    legendBtn.textContent = "Controls";
    legendBtn.addEventListener("click", () => this.toggleLegend());

    actions.append(nextBtn, skipBtn, legendBtn);
    panel.append(this.titleEl, this.bodyEl, actions);
    this.overlay.appendChild(panel);
    document.body.appendChild(this.overlay);

    this.legendEl = document.createElement("div");
    this.legendEl.id = "onboarding-controls-legend";
    this.legendEl.hidden = true;
    const legendPanel = document.createElement("div");
    legendPanel.className = "inventory-panel onboarding-legend-panel";
    const legendTitle = document.createElement("h2");
    legendTitle.textContent = "Controls";
    const list = document.createElement("ul");
    list.className = "onboarding-legend-list";
    for (const row of ONBOARDING_CONTROLS_LEGEND) {
      const li = document.createElement("li");
      const k = document.createElement("kbd");
      k.textContent = row.key;
      const a = document.createElement("span");
      a.textContent = row.action;
      li.append(k, a);
      list.appendChild(li);
    }
    const closeLegend = document.createElement("button");
    closeLegend.type = "button";
    closeLegend.className = "onboarding-next";
    closeLegend.textContent = "Close";
    closeLegend.addEventListener("click", () => this.closeLegend());
    legendPanel.append(legendTitle, list, closeLegend);
    this.legendEl.appendChild(legendPanel);
    this.legendEl.addEventListener("click", (e) => {
      if (e.target === this.legendEl) this.closeLegend();
    });
    document.body.appendChild(this.legendEl);
  }

  isOpen() {
    return this.legendOpen;
  }

  isCoachVisible() {
    return this.visible;
  }

  isTutorialActive() {
    return this.visible && this.flags.done !== true;
  }

  applyFlagsJson(json: string) {
    this.flags = parseTutorialFlagsJson(json);
    // Only auto-open once — reconnects with seen/done keep the coach closed.
    if (this.flags.done || this.flags.seen) {
      this.hideCoach();
      return;
    }
    this.stepIndex = firstIncompleteStepIndex(this.flags);
    if (this.stepIndex < 0) {
      this.flags.done = true;
      this.flags.seen = true;
      this.hideCoach();
      return;
    }
    this.showCurrent();
    this.flags.seen = true;
    this.handlers.onSeen();
  }

  /** Advance when gameplay detects the player did the step. */
  notifyStep(stepId: OnboardingStepId) {
    if (this.flags.done) return;
    if (!this.visible && !this.flags.seen) return;
    if (this.flags.steps?.[stepId]) return;
    // Only advance the coach while it is actively on-screen this session.
    if (!this.visible) {
      this.handlers.onCompleteStep(stepId);
      this.flags.steps = { ...(this.flags.steps ?? {}), [stepId]: true };
      return;
    }
    this.handlers.onCompleteStep(stepId);
    this.flags.steps = { ...(this.flags.steps ?? {}), [stepId]: true };
    if (ONBOARDING_STEPS[this.stepIndex]?.id === stepId) {
      this.stepIndex = firstIncompleteStepIndex(this.flags);
      if (this.stepIndex < 0) {
        this.flags.done = true;
        this.hideCoach();
        this.handlers.onSkipAll();
        return;
      }
      this.showCurrent();
    }
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

  destroy() {
    this.hideCoach();
    this.closeLegend();
    this.overlay.remove();
    this.legendEl.remove();
  }

  private completeCurrent() {
    const step = ONBOARDING_STEPS[this.stepIndex];
    if (!step) {
      this.skipAll();
      return;
    }
    this.notifyStep(step.id);
  }

  private skipAll() {
    this.flags.done = true;
    this.flags.seen = true;
    this.hideCoach();
    this.handlers.onSkipAll();
  }

  private showCurrent() {
    const step = ONBOARDING_STEPS[this.stepIndex];
    if (!step) {
      this.hideCoach();
      return;
    }
    this.titleEl.textContent = step.title;
    this.bodyEl.textContent = step.body;
    this.visible = true;
    this.overlay.hidden = false;
    document.body.classList.add("onboarding-open");
    resetDialogScroll(this.overlay);
  }

  private hideCoach() {
    this.visible = false;
    this.overlay.hidden = true;
    document.body.classList.remove("onboarding-open");
  }
}

function firstIncompleteStepIndex(flags: TutorialFlagsState): number {
  const steps = flags.steps ?? {};
  for (let i = 0; i < ONBOARDING_STEPS.length; i++) {
    const id = ONBOARDING_STEPS[i]!.id;
    if (!steps[id]) return i;
  }
  return -1;
}
