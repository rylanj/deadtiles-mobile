import { createDialogCloseButton } from "./dialogCloseBtn";
import { usePhoneDialogSheet } from "./phoneDialog";

export type TalkPush = "jobs" | "wire" | "deposit" | "heal" | "story";

const PUSH_TITLE: Record<TalkPush, string> = {
  jobs: "Jobs",
  wire: "Wire",
  deposit: "Safe deposit",
  heal: "Treatment",
  story: "Story",
};

const REOPEN_LABEL: Record<TalkPush, string> = {
  jobs: "View jobs",
  wire: "View wire",
  deposit: "View deposit",
  heal: "View treatment",
  story: "View story",
};

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
  readonly subEl: HTMLElement;
  readonly subTitleEl: HTMLElement;
  readonly subBodyEl: HTMLElement;
  readonly subBarEl: HTMLElement;
  private readonly mainEl: HTMLElement;
  private shownLine: string | null = null;
  private subTitle = "";
  private keyboardHandler: (() => void) | null = null;

  constructor(
    tone: "ashen" | "red",
    onClose: () => void,
    onBack: () => void,
  ) {
    this.root = document.createElement("div");
    this.root.className = `talk-sheet talk-sheet--${tone}`;
    this.root.hidden = true;

    const header = document.createElement("div");
    header.className = "talk-sheet-header";
    this.avatarSlot = document.createElement("div");
    this.avatarSlot.className = "talk-sheet-avatar";
    const nameCol = document.createElement("div");
    nameCol.className = "talk-sheet-name";
    this.titleSlot = document.createElement("div");
    this.titleSlot.className = "talk-sheet-title";
    this.standingSlot = document.createElement("div");
    this.standingSlot.className = "talk-sheet-standing";
    nameCol.append(this.titleSlot, this.standingSlot);
    header.append(this.avatarSlot, nameCol, createDialogCloseButton(onClose));

    this.mainEl = document.createElement("div");
    this.mainEl.className = "talk-sheet-main";
    this.replyEl = document.createElement("div");
    this.replyEl.className = "talk-sheet-reply";
    const choices = document.createElement("div");
    choices.className = "talk-sheet-choices";
    const kicker = document.createElement("div");
    kicker.className = "talk-sheet-kicker";
    kicker.textContent = "Say";
    this.choicesEl = document.createElement("div");
    this.choicesEl.className = "talk-sheet-choice-scroll";
    this.choicesEl.setAttribute("aria-label", "Say");
    choices.append(kicker, this.choicesEl);
    this.mainEl.append(this.replyEl, choices);

    this.subEl = document.createElement("div");
    this.subEl.className = "talk-sheet-sub";
    this.subEl.hidden = true;
    const subHeader = document.createElement("div");
    subHeader.className = "talk-sheet-header talk-sheet-sub-header";
    const back = document.createElement("button");
    back.type = "button";
    back.className = "dialog-close-btn talk-sheet-back";
    back.textContent = "Back";
    back.addEventListener("click", () => onBack());
    this.subTitleEl = document.createElement("h2");
    this.subTitleEl.className = "talk-sheet-sub-title";
    subHeader.append(back, this.subTitleEl, createDialogCloseButton(onClose));
    this.subBodyEl = document.createElement("div");
    this.subBodyEl.className = "talk-sheet-sub-body";
    this.subBarEl = document.createElement("div");
    this.subBarEl.className = "talk-sheet-sub-bar";
    this.subBarEl.hidden = true;
    this.subEl.append(subHeader, this.subBodyEl, this.subBarEl);

    this.root.append(header, this.mainEl, this.subEl);
    this.bindKeyboardLift();
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
      if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
        return;
      }
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

export function syncTalkSheet(bind: TalkSheetBindings): void {
  const phone = usePhoneDialogSheet();
  bind.overlay.classList.toggle("talk-sheet-mode", phone);
  bind.layoutEl.hidden = phone;
  bind.sheet.root.hidden = !phone;
  bind.sheet.noteLine(bind.activeLineId);
  if (!phone) {
    restoreDesktop(bind);
    bind.sheet.closeSub();
    return;
  }

  bind.sheet.avatarSlot.replaceChildren(bind.npcAvatarEl);
  bind.sheet.titleSlot.replaceChildren(bind.npcTitleEl);
  bind.sheet.standingSlot.replaceChildren(bind.standingEl);
  bind.sheet.choicesEl.replaceChildren(bind.speechListEl);

  const { replyNodes, sheets } = splitResponse(bind.responseEl);
  bind.sheet.replyEl.replaceChildren(...normalizeReply(bind.responseEl, replyNodes));

  const kind = sheetKind(bind.nav, bind.push);
  const nodes = kind ? nodesFor(kind, sheets) : [];
  if (kind && nodes.length > 0) {
    const title =
      kind === "jobs" && sheets.story && !sheets.jobs ? "Story" : PUSH_TITLE[kind];
    bind.sheet.fillSub(title, nodes, leadText(replyNodes));
    pinTalkBar(bind.sheet.subBarEl, bind.sheet.subBodyEl, kind);
    return;
  }

  bind.sheet.closeSub();
  if (bind.push && bind.nav.dismissed && nodesFor(bind.push, sheets).length > 0) {
    bind.sheet.replyEl.append(reopenButton(REOPEN_LABEL[bind.push], () => {
      bind.nav.reopen();
      bind.rerender();
    }));
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
    value === "deposit" ||
    value === "heal" ||
    value === "story"
  );
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
  if (kind === "wire") {
    const wire = body.querySelector(".ashen-wire") ?? body;
    const row = wire.querySelector<HTMLElement>(".ashen-wire-amount-row");
    const hint = wire.querySelector<HTMLElement>("[data-wire-hint]");
    const blocked = wire.querySelector<HTMLElement>("[data-wire-blocked]");
    const ship = wire.querySelector<HTMLElement>("[data-wire-ship]");
    if (row) bar.append(row);
    if (hint) bar.append(hint);
    if (blocked) bar.append(blocked);
    if (ship) bar.append(ship);
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
