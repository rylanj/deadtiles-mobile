import "./mobile/talk.css";
import {
  filterChips,
  itemIconImg,
  markSheetOpen,
  openDrawer,
  sectionLabel,
  setButtonLabel,
  sheetBackButton,
  sheetButton,
  sheetCloseButton,
  sheetRow,
  type Drawer,
} from "./mobileSheet";
import { usePhoneDialogSheet } from "./phoneDialog";

export type TalkPush = "jobs" | "wire" | "buyback" | "deposit" | "heal" | "story";

const PUSH_TITLE: Record<TalkPush, string> = {
  jobs: "Jobs",
  wire: "Wire notes east",
  buyback: "Buy notes with Deadmarks",
  deposit: "Safe deposit",
  heal: "Treatment",
  story: "Story",
};

const REOPEN_LABEL: Record<TalkPush, string> = {
  jobs: "View jobs",
  wire: "View wire",
  buyback: "View Deadmarks",
  deposit: "View deposit",
  heal: "View treatment",
  story: "View story",
};

const TILE_LABEL: Record<string, string> = {
  scales: "Trade",
  price_tag: "Marketplace",
  journal: "Jobs",
  wallet: "Wire notes",
  banknote: "Deadmarks",
  safe: "Safe deposit",
  bandages: "Treatment",
};

type JobRank = "ready" | "accepted" | "new" | "other";

const JOB_RANK: Record<JobRank, number> = {
  ready: 0,
  accepted: 1,
  new: 2,
  other: 3,
};

/** Reward line shown on a job tile in the phone sheet. */
export function talkJobReward(notes: number, rep: number, left: number | null): string {
  const parts: string[] = [];
  if (notes > 0) parts.push(`$${notes}`);
  if (rep > 0) parts.push(`+${rep} rep`);
  if (left != null && left > 0) parts.push(`${left} left today`);
  return parts.join(" · ");
}

export class PhoneTalkNav {
  dismissed = false;
  pinned: TalkPush | null = null;

  resetForLine(): void {
    this.dismissed = false;
    this.pinned = null;
  }

  back(): void {
    this.dismissed = true;
    this.pinned = null;
  }

  reopen(): void {
    this.dismissed = false;
    this.pinned = null;
  }

  openStory(): void {
    this.dismissed = false;
    this.pinned = "story";
  }
}

export class TalkSheet {
  readonly root: HTMLElement;
  readonly avatarSlot: HTMLElement;
  readonly titleSlot: HTMLElement;
  readonly standingSlot: HTMLElement;
  readonly replyEl: HTMLElement;
  readonly choicesEl: HTMLElement;
  readonly cardsEl: HTMLElement;
  readonly cardsBarEl: HTMLElement;
  readonly subEl: HTMLElement;
  readonly subTitleEl: HTMLElement;
  readonly subMetaEl: HTMLElement;
  readonly subBodyEl: HTMLElement;
  readonly subBarEl: HTMLElement;
  backOverride: (() => boolean) | null = null;
  jobFilter = "all";
  jobDetailKey = "";
  private readonly mainEl: HTMLElement;
  private readonly kickerEl: HTMLElement;
  private readonly tilesLabelEl: HTMLElement;
  private readonly tilesEl: HTMLElement;
  private readonly askBtn: HTMLButtonElement;
  private askDrawer: Drawer | null = null;
  private questions: HTMLButtonElement[] = [];
  private npcKey = "";
  private readonly asked = new Set<string>();
  private shownLine: string | null = null;
  private subTitle = "";
  private keyboardHandler: (() => void) | null = null;

  constructor(
    tone: "ashen" | "red",
    onClose: () => void,
    onBack: () => void,
  ) {
    this.root = document.createElement("div");
    this.root.className = `talk-sheet talk-sheet--${tone} ms-sheet${tone === "red" ? " ms-tone-red" : ""}`;
    this.root.hidden = true;

    const header = document.createElement("div");
    header.className = "ms-hdr talk-hdr";
    this.avatarSlot = document.createElement("div");
    this.avatarSlot.className = "ms-av talk-av";
    const nameCol = document.createElement("div");
    nameCol.className = "ms-hdr-t talk-name";
    this.titleSlot = document.createElement("div");
    this.titleSlot.className = "talk-title";
    this.standingSlot = document.createElement("div");
    this.standingSlot.className = "talk-standing";
    nameCol.append(this.titleSlot, this.standingSlot);
    header.append(this.avatarSlot, nameCol, sheetCloseButton(onClose));

    this.mainEl = document.createElement("div");
    this.mainEl.className = "talk-sheet-main talk-main";
    const scroll = document.createElement("div");
    scroll.className = "ms-body talk-scroll";
    this.replyEl = document.createElement("div");
    this.replyEl.className = "talk-log";
    this.cardsEl = document.createElement("div");
    this.cardsEl.className = "talk-sheet-cards talk-cards";
    this.cardsEl.hidden = true;
    scroll.append(this.replyEl, this.cardsEl);
    this.cardsBarEl = document.createElement("div");
    this.cardsBarEl.className = "talk-sheet-cards-bar talk-cards-bar";
    this.cardsBarEl.hidden = true;

    const bar = document.createElement("div");
    bar.className = "ms-bar talk-bar";
    this.tilesLabelEl = document.createElement("div");
    this.tilesLabelEl.className = "ms-lbl talk-tiles-lbl";
    this.tilesEl = document.createElement("div");
    this.tilesEl.className = "ms-tiles";
    const barRow = document.createElement("div");
    barRow.className = "ms-bar-row";
    this.askBtn = sheetButton("Ask something", "sec", () => this.openAsk());
    const bye = sheetButton("Bye", "sec", () => onClose());
    bye.classList.add("talk-bye");
    barRow.append(this.askBtn, bye);
    bar.append(this.cardsBarEl, this.tilesLabelEl, this.tilesEl, barRow);

    this.choicesEl = document.createElement("div");
    this.choicesEl.hidden = true;
    this.kickerEl = document.createElement("div");
    this.kickerEl.hidden = true;
    this.mainEl.append(scroll, bar, this.choicesEl);

    this.subEl = document.createElement("div");
    this.subEl.className = "talk-sheet-sub talk-sub";
    this.subEl.hidden = true;
    const subHeader = document.createElement("div");
    subHeader.className = "ms-hdr ms-hdr--back";
    this.subTitleEl = document.createElement("h2");
    this.subTitleEl.className = "ms-title talk-sub-title";
    this.subMetaEl = document.createElement("span");
    this.subMetaEl.className = "ms-sub";
    this.subMetaEl.hidden = true;
    const subTitles = document.createElement("div");
    subTitles.className = "ms-hdr-t";
    subTitles.append(this.subTitleEl, this.subMetaEl);
    const back = sheetBackButton(() => {
      if (this.backOverride?.()) return;
      onBack();
    });
    subHeader.append(back, subTitles, sheetCloseButton(onClose));
    this.subBodyEl = document.createElement("div");
    this.subBodyEl.className = "ms-body talk-sheet-sub-body talk-sub-body";
    this.subBarEl = document.createElement("div");
    this.subBarEl.className = "ms-bar talk-sheet-sub-bar talk-sub-bar";
    this.subBarEl.hidden = true;
    this.subEl.append(subHeader, this.subBodyEl, this.subBarEl);

    this.root.append(header, this.mainEl, this.subEl);
    this.bindKeyboardLift();
  }

  fillChoices(npcName: string, buttons: HTMLButtonElement[]): void {
    if (npcName !== this.npcKey) {
      this.npcKey = npcName;
      this.asked.clear();
      this.closeAsk();
    }
    const services = buttons.filter((btn) => !!btn.dataset.iconId);
    this.questions = buttons.filter((btn) => !btn.dataset.iconId);
    this.tilesEl.replaceChildren();
    for (const source of services) {
      const iconId = source.dataset.iconId ?? "";
      const tile = document.createElement("button");
      tile.type = "button";
      tile.className = "ms-tile";
      if (source.classList.contains("red-dialog-speech-btn--active")) {
        tile.classList.add("ms-tile--on");
      }
      const icon = itemIconImg(iconId);
      if (icon) tile.append(icon);
      const label = TILE_LABEL[iconId] ?? speechLabel(source);
      tile.append(document.createTextNode(label));
      tile.setAttribute("aria-label", speechLabel(source));
      tile.addEventListener("click", () => source.click());
      this.tilesEl.append(tile);
    }
    this.tilesEl.classList.toggle("ms-tiles--2", services.length > 0 && services.length <= 4);
    this.tilesEl.hidden = services.length === 0;
    this.tilesLabelEl.hidden = services.length === 0;
    this.tilesLabelEl.textContent = `${npcName} can`;
    const hasStory = this.questions.some((btn) => isStoryQuestion(btn));
    setButtonLabel(this.askBtn, "Ask something", String(this.questions.length));
    this.askBtn.classList.toggle("talk-ask--story", hasStory);
    this.askBtn.disabled = this.questions.length === 0;
    if (this.askDrawer?.isOpen()) this.fillAsk();
  }

  openAsk(): void {
    if (this.askDrawer?.isOpen() || this.questions.length === 0) return;
    this.askDrawer = openDrawer(this.root, {
      label: "Ask something",
      tone: this.root.classList.contains("ms-tone-red") ? "red" : undefined,
      onClose: () => {
        this.askDrawer = null;
      },
    });
    this.fillAsk();
  }

  private fillAsk(): void {
    const drawer = this.askDrawer;
    if (!drawer) return;
    const ordered = [
      ...this.questions.filter((btn) => isStoryQuestion(btn)),
      ...this.questions.filter((btn) => !isStoryQuestion(btn)),
    ];
    const rows: HTMLElement[] = [sectionLabel(`Ask ${this.npcKey}`)];
    for (const source of ordered) {
      const label = speechLabel(source);
      const story = isStoryQuestion(source);
      const asked = this.asked.has(label) && !story;
      rows.push(
        sheetRow({
          name: story ? `◆ ${label}` : label,
          state: story ? "story" : asked ? "dim" : undefined,
          end: asked ? "Asked" : undefined,
          chevron: !asked,
          onTap: () => {
            this.asked.add(label);
            this.askDrawer?.close();
            source.click();
          },
        }),
      );
    }
    drawer.content.replaceChildren(...rows);
    drawer.bar.hidden = true;
  }

  closeAsk(): void {
    const drawer = this.askDrawer;
    this.askDrawer = null;
    drawer?.close();
  }

  noteLine(lineId: string | null): void {
    if (lineId === this.shownLine) return;
    this.shownLine = lineId;
    this.replyEl.scrollTop = 0;
  }

  closeSub(): void {
    this.subEl.hidden = true;
    this.mainEl.hidden = false;
    this.subBodyEl.replaceChildren();
    this.subBarEl.replaceChildren();
    this.subBarEl.hidden = true;
    this.subTitle = "";
  }

  closeCards(): void {
    this.cardsEl.hidden = true;
    this.cardsEl.replaceChildren();
    this.cardsBarEl.replaceChildren();
    this.cardsBarEl.hidden = true;
  }

  fillCards(title: string, nodes: HTMLElement[], lead: string): void {
    this.cardsEl.hidden = false;
    this.cardsEl.replaceChildren();
    if (title) this.cardsEl.append(kicker(title));
    if (lead) {
      const intro = document.createElement("p");
      intro.className = "talk-sheet-sub-lead";
      intro.textContent = lead;
      this.cardsEl.append(intro);
    }
    this.cardsEl.append(...nodes);
  }

  fillSub(title: string, nodes: HTMLElement[], lead: string): void {
    const changed = title !== this.subTitle;
    this.subTitle = title;
    this.subTitleEl.textContent = title;
    this.subEl.setAttribute("aria-label", title);
    this.subEl.hidden = false;
    this.mainEl.hidden = true;
    this.subBodyEl.replaceChildren();
    if (lead) {
      const intro = document.createElement("p");
      intro.className = "talk-sheet-sub-lead";
      intro.textContent = lead;
      this.subBodyEl.append(intro);
    }
    this.subBodyEl.append(...nodes);
    if (changed) this.subBodyEl.scrollTop = 0;
  }

  private bindKeyboardLift(): void {
    this.root.addEventListener("focusin", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;
      this.watchKeyboard(true);
    });
    this.root.addEventListener("focusout", () => {
      window.setTimeout(() => {
        const active = document.activeElement;
        if (
          (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) &&
          this.root.contains(active)
        ) {
          return;
        }
        this.watchKeyboard(false);
      }, 50);
    });
  }

  dispose(): void {
    this.closeAsk();
    this.watchKeyboard(false);
  }

  private watchKeyboard(on: boolean): void {
    if (this.keyboardHandler) {
      window.visualViewport?.removeEventListener("resize", this.keyboardHandler);
      window.visualViewport?.removeEventListener("scroll", this.keyboardHandler);
      this.keyboardHandler = null;
    }
    if (!on) {
      this.root.style.setProperty("--talk-keyboard-inset", "0px");
      return;
    }
    const apply = () => {
      const viewport = window.visualViewport;
      const inset = viewport
        ? Math.max(0, Math.round(window.innerHeight - viewport.offsetTop - viewport.height))
        : 0;
      this.root.style.setProperty("--talk-keyboard-inset", `${inset}px`);
    };
    this.keyboardHandler = apply;
    window.visualViewport?.addEventListener("resize", apply);
    window.visualViewport?.addEventListener("scroll", apply);
    apply();
  }
}

export type TalkSheetBindings = {
  overlay: HTMLElement;
  layoutEl: HTMLElement;
  speechListEl: HTMLElement;
  responseEl: HTMLElement;
  playerBodyEl: HTMLElement;
  npcBodyEl: HTMLElement;
  npcAvatarEl: HTMLImageElement;
  npcTitleEl: HTMLElement;
  standingEl: HTMLElement;
  avatarHome: HTMLElement;
  titleHome: HTMLElement;
  sheet: TalkSheet;
  nav: PhoneTalkNav;
  push: TalkPush | null;
  activeLineId: string | null;
  rerender: () => void;
};

const watchedOverlays = new WeakSet<HTMLElement>();

function watchTalkOpen(overlay: HTMLElement, sheet: TalkSheet): void {
  const id = `talk:${overlay.id}`;
  const sync = () => {
    const open = !overlay.hidden && !sheet.root.hidden;
    if (!open) sheet.closeAsk();
    markSheetOpen(id, open);
  };
  sync();
  if (watchedOverlays.has(overlay)) return;
  watchedOverlays.add(overlay);
  new MutationObserver(sync).observe(overlay, { attributes: true, attributeFilter: ["hidden"] });
}

export function syncTalkSheet(bind: TalkSheetBindings): void {
  const phone = usePhoneDialogSheet();
  bind.overlay.classList.toggle("talk-sheet-mode", phone);
  bind.layoutEl.hidden = phone;
  bind.sheet.root.hidden = !phone;
  bind.sheet.noteLine(bind.activeLineId);
  watchTalkOpen(bind.overlay, bind.sheet);
  if (!phone) {
    restoreDesktop(bind);
    bind.sheet.closeSub();
    bind.sheet.closeCards();
    return;
  }

  bind.sheet.avatarSlot.replaceChildren(bind.npcAvatarEl);
  bind.sheet.titleSlot.replaceChildren(bind.npcTitleEl);
  bind.sheet.standingSlot.replaceChildren(bind.standingEl);
  bind.sheet.choicesEl.replaceChildren(bind.speechListEl);
  const npcName = (bind.npcTitleEl.textContent ?? "").trim() || "They";
  const buttons = [...bind.speechListEl.querySelectorAll<HTMLButtonElement>(".red-dialog-speech-btn")];
  bind.sheet.fillChoices(npcName, buttons);
  const { replyNodes, sheets } = splitResponse(bind.responseEl);
  const active = buttons.find((btn) => btn.classList.contains("red-dialog-speech-btn--active"));
  bind.sheet.replyEl.replaceChildren(
    ...talkBubbles(npcName, active ? speechLabel(active) : "", normalizeReply(bind.responseEl, replyNodes)),
  );

  const kind = sheetKind(bind.nav, bind.push);
  const nodes = kind ? nodesFor(kind, sheets) : [];
  const fullPage = kind === "wire" || kind === "buyback" || kind === "jobs" || kind === "story";
  if (kind && nodes.length > 0 && fullPage) {
    bind.sheet.closeCards();
    bind.sheet.closeAsk();
    const title = kind === "jobs" && sheets.story && !sheets.jobs ? "Story" : PUSH_TITLE[kind];
    const lead = kind === "wire" || kind === "buyback" ? firstSentence(leadText(replyNodes)) : "";
    bind.sheet.fillSub(title, nodes, lead);
    bind.sheet.subMetaEl.hidden = true;
    bind.sheet.backOverride = null;
    const sub = bind.sheet.subBodyEl.querySelector<HTMLElement>("[data-talk-sub]")?.dataset.talkSub;
    if (sub) {
      bind.sheet.subMetaEl.textContent = `${npcName} · ${sub}`;
      bind.sheet.subMetaEl.hidden = false;
    }
    pinTalkBar(bind.sheet.subBarEl, bind.sheet.subBodyEl, kind);
    if (kind === "jobs" || kind === "story") layoutJobs(bind, npcName);
    return;
  }

  bind.sheet.backOverride = null;
  bind.sheet.jobDetailKey = "";
  bind.sheet.closeSub();
  if (kind && nodes.length > 0) {
    const title = kind === "jobs" && sheets.story && !sheets.jobs ? "Story" : PUSH_TITLE[kind];
    bind.sheet.fillCards(title, nodes, "");
    pinTalkBar(bind.sheet.cardsBarEl, bind.sheet.cardsEl, kind);
  } else {
    bind.sheet.closeCards();
  }
  if (bind.push && bind.nav.dismissed && nodesFor(bind.push, sheets).length > 0) {
    bind.sheet.replyEl.append(
      reopenButton(REOPEN_LABEL[bind.push], () => {
        bind.nav.reopen();
        bind.rerender();
      }),
    );
  }
  if (sheets.story && bind.push !== "jobs") {
    bind.sheet.replyEl.append(
      reopenButton("View story", () => {
        bind.nav.openStory();
        bind.rerender();
      }),
    );
  }
}

function sheetKind(nav: PhoneTalkNav, push: TalkPush | null): TalkPush | null {
  if (nav.dismissed) return null;
  if (nav.pinned === "story") return "story";
  return push;
}

function nodesFor(
  kind: TalkPush,
  sheets: Partial<Record<TalkPush, HTMLElement>>,
): HTMLElement[] {
  if (kind === "jobs") {
    if (sheets.story && sheets.jobs) {
      return [kicker("Story"), sheets.story, kicker("Jobs"), sheets.jobs];
    }
    if (sheets.story) return [sheets.story];
    if (sheets.jobs) return [sheets.jobs];
    return [];
  }
  if (kind === "story") return sheets.story ? [sheets.story] : [];
  const node = sheets[kind];
  return node ? [node] : [];
}

function jobRank(el: HTMLElement): JobRank {
  if (el.classList.contains("craft-recipe--ready")) return "ready";
  if (el.classList.contains("craft-recipe--accepted")) return "accepted";
  if (el.classList.contains("craft-recipe--available")) return "new";
  return "other";
}

function layoutJobs(bind: TalkSheetBindings, npcName: string): void {
  const sheet = bind.sheet;
  const body = sheet.subBodyEl;
  const jobs = [...body.querySelectorAll<HTMLElement>(".craft-recipe")];
  if (jobs.length === 0) return;
  for (const job of jobs) {
    const rank = jobRank(job);
    job.classList.add("talk-job");
    const chip = job.querySelector<HTMLElement>(".quest-status-chip:not(.quest-status-chip--story)");
    if (rank === "ready" && chip) {
      chip.textContent = "Ready";
      chip.classList.add("quest-status-chip--ready");
    }
    const meta = job.querySelector<HTMLElement>(".craft-recipe-summary-meta");
    const reward = job.dataset.jobReward;
    if (meta && reward && (rank === "ready" || rank === "new")) meta.textContent = reward;
  }

  const open = jobs.find((job) => job.classList.contains("craft-recipe--expanded"));
  if (open) {
    for (const job of jobs) job.hidden = job !== open;
    body.querySelectorAll<HTMLElement>(".talk-sheet-sub-kicker, .talk-sheet-sub-lead").forEach((el) => {
      el.hidden = true;
    });
    open.classList.add("talk-job--detail");
    const title = open.querySelector(".craft-recipe-summary-name")?.firstChild?.textContent?.trim();
    if (title) sheet.subTitleEl.textContent = title;
    sheet.subMetaEl.textContent = npcName;
    sheet.subMetaEl.hidden = false;
    const summary = open.querySelector<HTMLElement>(".craft-recipe-summary");
    sheet.backOverride = () => {
      summary?.click();
      return true;
    };
    const complete = open.querySelector<HTMLElement>(".craft-recipe-details .red-dialog-complete-btn");
    if (complete) {
      complete.classList.add("ms-btn", "ms-btn--pri");
      sheet.subBarEl.replaceChildren(complete);
      sheet.subBarEl.hidden = false;
    }
    const key = title ?? "detail";
    if (key !== sheet.jobDetailKey) {
      sheet.jobDetailKey = key;
      body.scrollTop = 0;
    }
    return;
  }

  if (sheet.jobDetailKey) {
    sheet.jobDetailKey = "";
    body.scrollTop = 0;
  }
  const counts: Record<JobRank, number> = { ready: 0, accepted: 0, new: 0, other: 0 };
  for (const job of jobs) counts[jobRank(job)] += 1;
  const active =
    sheet.jobFilter !== "all" && counts[sheet.jobFilter as JobRank] > 0 ? sheet.jobFilter : "all";
  const parents = new Set(
    jobs.map((job) => job.parentElement).filter((parent): parent is HTMLElement => !!parent),
  );
  for (const parent of parents) {
    const group = jobs.filter((job) => job.parentElement === parent);
    group.sort((a, b) => JOB_RANK[jobRank(a)] - JOB_RANK[jobRank(b)]);
    for (const job of group) parent.append(job);
  }
  for (const job of jobs) job.hidden = active !== "all" && jobRank(job) !== active;
  if (jobs.length > 3) {
    const chips: { id: string; label: string; count: number }[] = [
      { id: "all", label: "All", count: jobs.length },
    ];
    if (counts.ready) chips.push({ id: "ready", label: "Ready", count: counts.ready });
    if (counts.accepted) chips.push({ id: "accepted", label: "Accepted", count: counts.accepted });
    if (counts.new) chips.push({ id: "new", label: "New", count: counts.new });
    body.prepend(
      filterChips(chips, active, (id) => {
        sheet.jobFilter = id;
        bind.rerender();
      }),
    );
  }
  sheet.subMetaEl.textContent = `${npcName} · ${jobs.length === 1 ? "1 job" : `${jobs.length} jobs`}`;
  sheet.subMetaEl.hidden = false;
}

function talkBubbles(npcName: string, playerLine: string, nodes: Node[]): Node[] {
  if (
    nodes.length === 0 ||
    nodes.some((node) => node instanceof HTMLElement && node.classList.contains("red-dialog-response--empty"))
  ) {
    const waiting = document.createElement("p");
    waiting.className = "ms-hint talk-waiting";
    waiting.textContent = "Pick a service below, or ask something.";
    return [waiting];
  }
  const bubbles: HTMLElement[] = [];
  if (playerLine) {
    const mine = document.createElement("div");
    mine.className = "talk-bub talk-bub--me";
    mine.textContent = playerLine;
    bubbles.push(mine);
  }
  const theirs = document.createElement("div");
  theirs.className = "talk-bub talk-bub--npc";
  const who = document.createElement("span");
  who.className = "talk-who";
  who.textContent = npcName;
  theirs.append(who, ...nodes);
  bubbles.push(theirs);
  return bubbles;
}

function firstSentence(text: string): string {
  if (!text) return "";
  const match = /^.*?[.!?](\s|$)/.exec(text);
  const sentence = (match ? match[0] : text).trim();
  return sentence.length > 140 ? `${sentence.slice(0, 137)}…` : sentence;
}

function kicker(text: string): HTMLElement {
  const el = document.createElement("div");
  el.className = "talk-sheet-sub-kicker";
  el.textContent = text;
  return el;
}

function reopenButton(label: string, onClick: () => void): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "talk-sheet-reopen";
  btn.textContent = label;
  btn.addEventListener("click", onClick);
  return btn;
}

function splitResponse(responseEl: HTMLElement): {
  replyNodes: Node[];
  sheets: Partial<Record<TalkPush, HTMLElement>>;
} {
  const replyNodes: Node[] = [];
  const sheets: Partial<Record<TalkPush, HTMLElement>> = {};
  for (const node of [...responseEl.childNodes]) {
    if (node instanceof HTMLElement && isTalkPush(node.dataset.talkSheet)) {
      sheets[node.dataset.talkSheet] = node;
      continue;
    }
    replyNodes.push(node);
  }
  return { replyNodes, sheets };
}

function isTalkPush(value: string | undefined): value is TalkPush {
  return (
    value === "jobs" ||
    value === "wire" ||
    value === "buyback" ||
    value === "deposit" ||
    value === "heal" ||
    value === "story"
  );
}

function speechLabel(button: HTMLElement): string {
  return (button.querySelector(".red-dialog-speech-label")?.textContent ?? button.textContent ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function isStoryQuestion(button: HTMLElement): boolean {
  return !!button.querySelector(".red-dialog-speech-quest");
}

function normalizeReply(responseEl: HTMLElement, nodes: Node[]): Node[] {
  if (nodes.length === 1 && nodes[0]?.nodeType === Node.TEXT_NODE) {
    const div = document.createElement("div");
    div.className = "red-dialog-response-text";
    if (responseEl.classList.contains("red-dialog-response--empty")) {
      div.classList.add("red-dialog-response--empty");
    }
    div.textContent = nodes[0].textContent ?? "";
    return [div];
  }
  return nodes;
}

function leadText(nodes: Node[]): string {
  const text = nodes
    .map((node) => node.textContent ?? "")
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text || text.startsWith("Waiting for you")) return "";
  return text;
}

function pinTalkBar(bar: HTMLElement, body: HTMLElement, kind: TalkPush): void {
  bar.replaceChildren();
  if (kind === "wire" || kind === "buyback") {
    const wire = body.querySelector(".ashen-wire") ?? body;
    const row = wire.querySelector<HTMLElement>(".ashen-wire-amount-row");
    const hint = wire.querySelector<HTMLElement>(
      kind === "buyback" ? "[data-buyback-hint]" : "[data-wire-hint]",
    );
    const blocked = wire.querySelector<HTMLElement>(
      kind === "buyback" ? "[data-buyback-blocked]" : "[data-wire-blocked]",
    );
    const ship = wire.querySelector<HTMLElement>(
      kind === "buyback" ? "[data-buyback-ship]" : "[data-wire-ship]",
    );
    const extras: HTMLElement[] =
      kind === "buyback"
        ? [...wire.querySelectorAll<HTMLElement>("[data-buyback-collect], [data-buyback-cancel]")]
        : [];
    if (row) bar.append(row);
    if (hint) bar.append(hint);
    if (blocked) bar.append(blocked);
    if (ship) bar.append(ship);
    for (const extra of extras) bar.append(extra);
  } else if (kind === "deposit" || kind === "heal") {
    const btn = body.querySelector<HTMLElement>(".red-dialog-complete-btn");
    if (btn) bar.append(btn);
    else {
      const hint = body.querySelector<HTMLElement>(".craft-recipe-hint");
      if (hint) bar.append(hint);
    }
  }
  let visible = false;
  for (const child of bar.children) {
    if (child instanceof HTMLElement && !child.hidden) visible = true;
  }
  bar.hidden = !visible;
}

function restoreDesktop(bind: TalkSheetBindings): void {
  bind.playerBodyEl.append(bind.speechListEl);
  bind.npcBodyEl.append(bind.responseEl);
  if (bind.avatarHome.firstChild !== bind.npcAvatarEl) {
    bind.avatarHome.insertBefore(bind.npcAvatarEl, bind.avatarHome.firstChild);
  }
  if (bind.titleHome.firstChild !== bind.npcTitleEl) {
    bind.titleHome.insertBefore(bind.npcTitleEl, bind.titleHome.firstChild);
  }
  if (bind.standingEl.parentElement !== bind.titleHome || bind.titleHome.lastElementChild !== bind.standingEl) {
    bind.titleHome.append(bind.standingEl);
  }
}
