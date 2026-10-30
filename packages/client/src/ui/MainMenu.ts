import {
  ASHEN_MILITIA_FACTION,
  ASHEN_TRADERS_FACTION,
  BACKPACK_FANNY_ID,
  GIFT_BOX_ITEM_ID,
  HUNGER_MAX,
  INVITE_BONUS_BANKNOTES,
  INVITE_BONUS_REPUTATION,
  PLAYER_MAX_HEALTH,
  RED_ORDER_FACTION,
  REFERRER_PAYOUT_BANKNOTES,
  STAMINA_MAX,
  SURVIVOR_NAME_MAX,
  THIRST_MAX,
  TEMPERATURE_CORE_DEFAULT,
  createEmptyInventory,
  normalizeSurvivorName,
  playerMaxHealthFromInfection,
  serializeInventory,
  survivorNameValidationError,
  temperatureHudLook,
} from "@zombie/shared";
import {
  clearStoredSession,
  approveReferralPayout,
  banAdminPlayer,
  fetchAdminBoard,
  fetchPlayerPreview,
  fetchReferralBoard,
  kickAdminPlayer,
  loadCachedAuthSession,
  loginWithSolanaWallet,
  registerSurvivorName,
  restoreAuthSession,
  storeAuthSession,
  unbanAdminPlayer,
  type AdminBoard,
  type AuthSession,
  type PlayerPreview,
  type ReferralBoard,
  type ReferralPayout,
} from "../network/ColyseusClient";
import { ensureCountyRadio, forgetCountyRadio } from "../network/countyRadio";
import { getWallets } from "@wallet-standard/app";
import { shortWallet } from "../network/solanaWallet";
import { listWalletOptions, rememberWallet } from "../network/walletOptions";
import { isNativeApp } from "../native";
import { isMobileDevice } from "../device";
import { pickWallet } from "./WalletPicker";
import { resetDialogScroll } from "./dialogScroll";
import {
  showDesktopWalletHelp,
  showMobileWalletSignStep,
  showMobileWebWalletHelp,
} from "./MobileWebWalletHelp";
import {
  consumeWalletDeeplinkReturn,
  hasWalletDeeplinkCallback,
  onWalletDeeplinkHandoff,
  shouldHandOffWalletReturn,
  type DeeplinkResume,
} from "../network/walletDeeplink";
import {
  needsDesktopWalletHelp,
  needsMobileWebWalletHelp,
  PHANTOM_DOWNLOAD_HREF,
} from "../network/walletDeepLinks";
import { WeaponHotbar } from "./WeaponHotbar";
import { playerAvatarSrc } from "./playerAvatar";
import {
  captureReferMenuRequest,
  clearStoredReferral,
  copyReferralLink,
  INVITE_BONUS_LINE,
  storedReferral,
} from "../network/referral";
import { createDialogCloseButton } from "./dialogCloseBtn";
import { itemIconImg } from "./mobileSheet";

export type MainMenuHandlers = {
  onPlay: (session: AuthSession) => void;
};

function clampPct(value: number, max: number): number {
  if (!Number.isFinite(value) || max <= 0) return 0;
  return Math.max(0, Math.min(100, (value / max) * 100));
}

function makeBarRow(
  id: string,
  label: string,
  fillId: string,
): { row: HTMLElement; fill: HTMLElement } {
  const row = document.createElement("div");
  row.className = "player-bar-row";

  const labelEl = document.createElement("span");
  labelEl.className = "player-bar-label";
  labelEl.id = id;
  labelEl.textContent = label;

  const track = document.createElement("div");
  track.className = "player-bar-track";
  const fill = document.createElement("div");
  fill.id = fillId;
  fill.className = "player-bar-fill";
  fill.style.width = "100%";
  track.appendChild(fill);

  row.append(labelEl, track);
  return { row, fill };
}

function makeHealthBarRow(): {
  row: HTMLElement;
  fill: HTMLElement;
  cap: HTMLElement;
  lost: HTMLElement;
} {
  const row = document.createElement("div");
  row.className = "player-bar-row";

  const labelEl = document.createElement("span");
  labelEl.className = "player-bar-label";
  labelEl.id = "main-menu-health-label";
  labelEl.textContent = "Health";

  const track = document.createElement("div");
  track.className = "player-bar-track";
  track.id = "main-menu-health-track";

  const cap = document.createElement("div");
  cap.id = "main-menu-health-cap";

  const lost = document.createElement("div");
  lost.id = "main-menu-health-lost";

  const fill = document.createElement("div");
  fill.id = "main-menu-health-fill";
  fill.className = "player-bar-fill";
  fill.style.width = "100%";

  track.append(cap, lost, fill);
  row.append(labelEl, track);
  return { row, fill, cap, lost };
}

const SVG_NS = "http://www.w3.org/2000/svg";

function menuIcon(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("main-menu-btn-icon");
  return svg;
}

function filledPath(d: string): SVGPathElement {
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", d);
  path.setAttribute("fill", "currentColor");
  return path;
}

function strokedPath(d: string): SVGPathElement {
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", d);
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-width", "1.6");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");
  return path;
}

function playIcon(): SVGSVGElement {
  const svg = menuIcon();
  svg.classList.add("main-menu-btn-icon--play");
  svg.appendChild(filledPath("M5.15 3.05 12.6 8 5.15 12.95V3.05z"));
  return svg;
}

function adminIcon(): SVGSVGElement {
  const svg = menuIcon();
  svg.append(
    strokedPath("M8 2.4 13.4 4.7v3.35c0 3.35-2.2 5.55-5.4 6.55-3.2-1-5.4-3.2-5.4-6.55V4.7L8 2.4z"),
    strokedPath("M8 6.2v4.2"),
    strokedPath("M6.2 8.3h3.6"),
  );
  return svg;
}

function referIcon(): SVGSVGElement {
  const svg = menuIcon();
  const head = document.createElementNS(SVG_NS, "circle");
  head.setAttribute("cx", "6.1");
  head.setAttribute("cy", "5");
  head.setAttribute("r", "1.85");
  head.setAttribute("fill", "none");
  head.setAttribute("stroke", "currentColor");
  head.setAttribute("stroke-width", "1.6");
  svg.append(
    head,
    strokedPath("M2.55 12.7c.45-2.05 1.9-3.15 3.55-3.15s3.1 1.1 3.55 3.15"),
    strokedPath("M11.15 6.15h3.3"),
    strokedPath("M12.8 4.5v3.3"),
  );
  return svg;
}

function formatSignupWhen(createdAt: number): string {
  if (!Number.isFinite(createdAt) || createdAt <= 0) return "";
  const date = new Date(createdAt * 1000);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Copy pages, or a check once the link is on the clipboard. */
function paintReferralIcon(svg: SVGSVGElement, copied: boolean): void {
  svg.replaceChildren();
  if (copied) {
    svg.appendChild(strokedPath("M3.15 8.35 6.35 11.45 12.9 4.55"));
    return;
  }
  const page = document.createElementNS(SVG_NS, "rect");
  page.setAttribute("x", "2.45");
  page.setAttribute("y", "5.25");
  page.setAttribute("width", "7.85");
  page.setAttribute("height", "8.15");
  page.setAttribute("rx", "1.3");
  page.setAttribute("fill", "none");
  page.setAttribute("stroke", "currentColor");
  page.setAttribute("stroke-width", "1.6");
  svg.append(
    strokedPath("M6.05 4.55V3.85A1.2 1.2 0 0 1 7.25 2.65h4.05A1.2 1.2 0 0 1 12.5 3.85V8.2"),
    page,
  );
}

function appendRewardCell(
  parent: HTMLElement,
  name: string,
  qty: number,
  graphic: HTMLElement,
) {
  const cell = document.createElement("div");
  cell.className = "invite-item";
  const icon = document.createElement("div");
  icon.className = "invite-item-icon";
  icon.append(graphic);
  const qtyEl = document.createElement("span");
  qtyEl.className = "invite-item-qty";
  qtyEl.textContent = String(qty);
  icon.append(qtyEl);
  const label = document.createElement("div");
  label.className = "invite-item-name";
  label.textContent = name;
  cell.append(icon, label);
  parent.append(cell);
}

function appendInvitePackage(parent: HTMLElement) {
  const items = document.createElement("div");
  items.className = "invite-items";
  const rewards: { id: string; qty: number; name: string }[] = [
    { id: "banknote", qty: INVITE_BONUS_BANKNOTES, name: "Banknotes" },
    { id: BACKPACK_FANNY_ID, qty: 1, name: "Fanny Pack" },
    { id: GIFT_BOX_ITEM_ID, qty: 1, name: "Gift Box" },
    { id: "safe", qty: 1, name: "Safe Deposit Box" },
  ];
  for (const reward of rewards) {
    const img = itemIconImg(reward.id);
    appendRewardCell(items, reward.name, reward.qty, img ?? document.createElement("span"));
  }
  for (const faction of [ASHEN_TRADERS_FACTION, ASHEN_MILITIA_FACTION, RED_ORDER_FACTION]) {
    const img = itemIconImg("rep");
    appendRewardCell(items, faction, INVITE_BONUS_REPUTATION, img ?? document.createElement("span"));
  }
  parent.append(items);
}

function buttonLabel(text: string): HTMLSpanElement {
  const label = document.createElement("span");
  label.className = "main-menu-btn-label";
  label.textContent = text;
  return label;
}

/**
 * Full-screen Deatiles main menu — Solana wallet login + unique survivor name.
 */
export class MainMenu {
  private root: HTMLElement;
  private nameSection: HTMLElement;
  private nameInput: HTMLInputElement;
  private walletBtn: HTMLButtonElement;
  private playBtn: HTMLButtonElement;
  private playLabel: HTMLElement;
  private registerBtn: HTMLButtonElement;
  private adminBtn: HTMLButtonElement;
  private referralBtn: HTMLButtonElement;
  private referralLabel: HTMLElement;
  private signOutBtn: HTMLButtonElement;
  private inviteBanner: HTMLElement;
  private referralMenu?: HTMLElement;
  private referralMenuKey?: (event: KeyboardEvent) => void;
  private referralCopyTimer = 0;
  private adminMenu?: HTMLElement;
  private adminMenuKey?: (event: KeyboardEvent) => void;
  private adminUserIdDraft = "";
  private statusEl: HTMLElement;
  private survivorNameEl: HTMLElement;
  private previewSection: HTMLElement;
  private walletLabel: HTMLElement;
  private healthFill: HTMLElement;
  private healthCap: HTMLElement;
  private healthLost: HTMLElement;
  private staminaFill: HTMLElement;
  private hungerFill: HTMLElement;
  private thirstFill: HTMLElement;
  private tempFill: HTMLElement;
  private tempLabel: HTMLElement;
  private avatarImg: HTMLImageElement;
  private previewHotbar?: WeaponHotbar;
  private walletHint: HTMLElement;
  private busy = false;
  private session: AuthSession | null = null;
  /** Open Refer players once this visit if the site sent ?refer=1. */
  private referMenuPending = false;
  private stopWalletHandoff?: () => void;

  constructor(private handlers: MainMenuHandlers) {
    this.referMenuPending = captureReferMenuRequest();
    this.root = document.createElement("div");
    this.root.id = "main-menu";

    const panel = document.createElement("div");
    panel.className = "main-menu-panel";

    const header = document.createElement("div");
    header.className = "main-menu-header";

    const title = document.createElement("h1");
    title.className = "main-menu-title";
    const mark = document.createElement("img");
    mark.className = "brand-mark";
    mark.src = "/brand/deadtiles-mark.svg";
    mark.alt = "";
    mark.width = 32;
    mark.height = 32;
    const titleText = document.createElement("span");
    titleText.className = "main-menu-title-text";
    const tiles = document.createElement("span");
    tiles.className = "brand-tiles";
    tiles.textContent = "TILES";
    titleText.append("DEAD", tiles);
    title.append(mark, titleText);

    const subtitle = document.createElement("span");
    subtitle.className = "main-menu-subtitle";
    subtitle.textContent = "Isometric post-apocalyptic survival";

    header.append(title, subtitle);

    const body = document.createElement("div");
    body.className = "main-menu-body";

    const preview = document.createElement("div");
    preview.className = "main-menu-preview";
    preview.hidden = true;
    this.previewSection = preview;

    const avatar = document.createElement("div");
    avatar.className = "main-menu-preview-avatar";
    avatar.id = "main-menu-player-avatar";
    this.avatarImg = document.createElement("img");
    this.avatarImg.src = playerAvatarSrc();
    this.avatarImg.alt = "Avatar";
    avatar.appendChild(this.avatarImg);

    const identity = document.createElement("div");
    identity.className = "main-menu-preview-identity";
    this.survivorNameEl = document.createElement("div");
    this.survivorNameEl.className = "main-menu-survivor-name";
    this.survivorNameEl.textContent = "";
    this.walletLabel = document.createElement("div");
    this.walletLabel.className = "main-menu-wallet";
    this.walletLabel.hidden = true;
    identity.append(this.survivorNameEl, this.walletLabel);

    const bars = document.createElement("div");
    bars.className = "main-menu-preview-bars";
    const health = makeHealthBarRow();
    const stamina = makeBarRow("main-menu-stamina-label", "Stamina", "main-menu-stamina-fill");
    const hunger = makeBarRow("main-menu-hunger-label", "Hunger", "main-menu-hunger-fill");
    const thirst = makeBarRow("main-menu-thirst-label", "Thirst", "main-menu-thirst-fill");
    const temp = makeBarRow("main-menu-temp-label", "Temp", "main-menu-temp-fill");
    this.healthFill = health.fill;
    this.healthCap = health.cap;
    this.healthLost = health.lost;
    this.staminaFill = stamina.fill;
    this.hungerFill = hunger.fill;
    this.thirstFill = thirst.fill;
    this.tempFill = temp.fill;
    this.tempLabel = temp.row.querySelector(".player-bar-label") as HTMLElement;
    bars.append(health.row, stamina.row, hunger.row, thirst.row, temp.row);

    const identityRow = document.createElement("div");
    identityRow.className = "main-menu-preview-top";
    identityRow.append(avatar, identity);

    const hotbarMount = document.createElement("div");
    hotbarMount.className = "main-menu-preview-hotbar";

    preview.append(identityRow, bars, hotbarMount);

    this.previewHotbar = new WeaponHotbar(
      { onSlot: () => undefined },
      {
        rootId: "main-menu-weapon-hotbar",
        mount: hotbarMount,
        interactive: false,
      },
    );
    this.applyPreview({ exists: false });

    this.nameSection = document.createElement("div");
    this.nameSection.className = "main-menu-field";
    this.nameSection.hidden = true;

    const nameLabel = document.createElement("label");
    nameLabel.className = "main-menu-label";
    nameLabel.htmlFor = "main-menu-name";
    nameLabel.textContent = "Survivor name";

    this.nameInput = document.createElement("input");
    this.nameInput.id = "main-menu-name";
    this.nameInput.className = "main-menu-input";
    this.nameInput.type = "text";
    this.nameInput.maxLength = SURVIVOR_NAME_MAX;
    this.nameInput.autocomplete = "off";
    this.nameInput.spellcheck = false;
    this.nameInput.placeholder = "Letters and spaces only";

    const nameHint = document.createElement("div");
    nameHint.className = "main-menu-field-hint";
    nameHint.textContent = "2–30 letters · unique · permanent";

    this.nameSection.append(nameLabel, this.nameInput, nameHint);

    const actions = document.createElement("div");
    actions.className = "main-menu-actions";

    this.walletBtn = document.createElement("button");
    this.walletBtn.type = "button";
    this.walletBtn.className = "main-menu-play";
    this.walletBtn.textContent = "Connect wallet";

    this.registerBtn = document.createElement("button");
    this.registerBtn.type = "button";
    this.registerBtn.className = "main-menu-play";
    this.registerBtn.textContent = "Create survivor";
    this.registerBtn.hidden = true;

    this.playBtn = document.createElement("button");
    this.playBtn.type = "button";
    this.playBtn.className = "main-menu-play";
    this.playBtn.hidden = true;
    this.playBtn.append(playIcon());
    this.playLabel = buttonLabel("Enter world");
    this.playBtn.append(this.playLabel);

    this.adminBtn = document.createElement("button");
    this.adminBtn.type = "button";
    this.adminBtn.className = "main-menu-admin";
    this.adminBtn.hidden = true;
    this.adminBtn.append(adminIcon(), buttonLabel("Admin"));

    this.referralBtn = document.createElement("button");
    this.referralBtn.type = "button";
    this.referralBtn.className = "main-menu-referral";
    this.referralBtn.hidden = true;
    this.referralBtn.append(referIcon());
    this.referralLabel = buttonLabel("Refer players");
    this.referralBtn.append(this.referralLabel);

    this.signOutBtn = document.createElement("button");
    this.signOutBtn.type = "button";
    this.signOutBtn.className = "main-menu-sign-out";
    this.signOutBtn.textContent = "Sign out";
    this.signOutBtn.hidden = true;

    actions.append(
      this.walletBtn,
      this.registerBtn,
      this.playBtn,
      this.adminBtn,
      this.referralBtn,
      this.signOutBtn,
    );

    this.statusEl = document.createElement("div");
    this.statusEl.className = "main-menu-status";
    this.statusEl.hidden = true;

    this.walletHint = document.createElement("div");
    this.walletHint.className = "main-menu-wallet-hint";
    this.walletHint.hidden = true;
    if (isMobileDevice()) {
      this.walletHint.textContent =
        "No wallet in this browser. Tap Connect wallet to approve in Phantom or Solflare, then return here to play.";
    } else {
      this.walletHint.append("No wallet found in this browser. ");
      const installLink = document.createElement("a");
      installLink.href = PHANTOM_DOWNLOAD_HREF;
      installLink.target = "_blank";
      installLink.rel = "noopener noreferrer";
      installLink.textContent = "Install Phantom";
      this.walletHint.append(installLink, ", then refresh this page.");
    }

    this.inviteBanner = document.createElement("div");
    this.inviteBanner.className = "main-menu-invite";
    this.inviteBanner.hidden = true;
    const inviteKicker = document.createElement("div");
    inviteKicker.className = "main-menu-invite-kicker";
    inviteKicker.textContent = "You were invited";
    const inviteText = document.createElement("p");
    inviteText.className = "main-menu-invite-text";
    inviteText.textContent = INVITE_BONUS_LINE;
    this.inviteBanner.append(inviteKicker, inviteText);
    appendInvitePackage(this.inviteBanner);

    const hint = document.createElement("div");
    hint.className = "main-menu-hint";
    hint.innerHTML = isMobileDevice()
      ? "<span>Tap</span> move · interact · shoot"
      : "<span>Click</span> move · <span>RMB</span> aim · <span>R</span> reload · <span>TAB</span> inventory · <span>M</span> map";

    body.append(
      this.inviteBanner,
      preview,
      this.nameSection,
      actions,
      this.statusEl,
      this.walletHint,
      hint,
    );
    panel.append(header, body);
    this.root.appendChild(panel);
    document.body.appendChild(this.root);

    this.walletBtn.addEventListener("click", () => void this.handleConnectWallet());
    this.registerBtn.addEventListener("click", () => void this.handleRegister());
    this.playBtn.addEventListener("click", () => this.handlePlay());
    this.adminBtn.addEventListener("click", () => this.openAdminMenu());
    this.referralBtn.addEventListener("click", () => this.openReferralMenu());
    this.signOutBtn.addEventListener("click", () => this.handleSignOut());
    this.nameInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        void this.handleRegister();
      }
    });

    this.stopWalletHandoff = onWalletDeeplinkHandoff((resume) => {
      void this.applyDeeplinkResume(resume);
    });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") this.adoptCachedSession();
    });
    this.updateInviteBanner();
    void this.boot();
    resetDialogScroll(this.root);
    window.setTimeout(() => this.refreshWalletHint(), 400);
    window.setTimeout(() => this.refreshWalletHint(), 1600);
    try {
      getWallets().on("register", () => this.refreshWalletHint());
    } catch {
      /* Wallet Standard unavailable */
    }
  }

  private applyPreview(preview: PlayerPreview) {
    const health = preview.exists ? (preview.health ?? PLAYER_MAX_HEALTH) : PLAYER_MAX_HEALTH;
    const stamina = preview.exists ? (preview.stamina ?? STAMINA_MAX) : STAMINA_MAX;
    const staminaMax = preview.exists
      ? (preview.staminaMax ?? STAMINA_MAX)
      : STAMINA_MAX;
    const hunger = preview.exists ? (preview.hunger ?? HUNGER_MAX) : HUNGER_MAX;
    const thirst = preview.exists ? (preview.thirst ?? THIRST_MAX) : THIRST_MAX;
    const temperature = preview.exists
      ? (preview.temperature ?? TEMPERATURE_CORE_DEFAULT)
      : TEMPERATURE_CORE_DEFAULT;
    const tempLook = temperatureHudLook(temperature);
    const infected = !!(preview.exists && preview.infected);
    const infection = preview.exists ? (preview.infection ?? 0) : 0;
    const maxHp = playerMaxHealthFromInfection(infection, infected);
    const shownHealth = Math.min(health, maxHp);

    this.healthFill.style.width = `${clampPct(shownHealth, PLAYER_MAX_HEALTH)}%`;
    this.healthCap.style.width = `${clampPct(maxHp, PLAYER_MAX_HEALTH)}%`;
    this.healthLost.style.width = `${Math.max(0, 100 - clampPct(maxHp, PLAYER_MAX_HEALTH))}%`;
    this.staminaFill.style.width = `${clampPct(stamina, staminaMax)}%`;
    this.hungerFill.style.width = `${clampPct(hunger, HUNGER_MAX)}%`;
    this.thirstFill.style.width = `${clampPct(thirst, THIRST_MAX)}%`;
    this.tempFill.style.width = `${tempLook.percent}%`;
    this.tempFill.style.background = tempLook.fillColor;
    this.tempLabel.textContent = tempLook.label;
    this.avatarImg.src = playerAvatarSrc(
      preview.exists ? (preview.clothingSkin ?? 1) : 1,
    );

    const inventoryJson =
      preview.exists && preview.inventoryJson
        ? preview.inventoryJson
        : serializeInventory(createEmptyInventory());
    const magazinesJson =
      preview.exists && preview.weaponMagazinesJson
        ? preview.weaponMagazinesJson
        : "{}";

    this.previewHotbar?.render(
      inventoryJson,
      preview.exists ? (preview.equippedInventorySlot ?? -1) : -1,
      preview.exists ? (preview.magazineRounds ?? 0) : 0,
      magazinesJson,
      false,
    );
  }

  private setSession(session: AuthSession) {
    storeAuthSession(session);
    ensureCountyRadio(session.sessionToken);
    this.session = session;
    this.walletLabel.hidden = false;
    this.walletLabel.textContent = shortWallet(session.wallet);

    // Name is permanent once set — never show the picker again.
    if (session.name) {
      this.nameInput.value = "";
      this.nameInput.disabled = true;
      this.survivorNameEl.textContent = session.name;
      this.applyPreview(session.preview);
      this.syncAuthButtons();
      this.maybeOpenReferMenu();
      return;
    }

    this.nameInput.disabled = false;
    this.survivorNameEl.textContent = "";
    this.syncAuthButtons();
    requestAnimationFrame(() => this.nameInput.focus());
  }

  /** Logged out: Connect wallet only. Preview appears after a survivor exists. */
  private syncAuthButtons() {
    const loggedIn = this.session != null;
    const needsName = Boolean(this.session && !this.session.name);
    const ready = Boolean(this.session?.name);

    this.walletBtn.hidden = loggedIn;
    this.registerBtn.hidden = !needsName;
    this.playBtn.hidden = !ready;
    this.adminBtn.hidden = !ready || !this.session?.isAdmin;
    this.referralBtn.hidden = !ready;
    this.signOutBtn.hidden = !loggedIn;
    this.updateInviteBanner();
    this.nameSection.hidden = !needsName;
    this.previewSection.hidden = !ready;
    this.walletLabel.hidden = !loggedIn;

    if (!this.busy) {
      this.walletBtn.textContent = "Connect wallet";
      this.registerBtn.textContent = "Create survivor";
      this.playLabel.textContent = "Enter world";
    }
    this.refreshWalletHint();
  }

  private refreshWalletHint() {
    const needsHelp = needsMobileWebWalletHelp() || needsDesktopWalletHelp();
    this.walletHint.hidden = Boolean(this.session) || !needsHelp;
    resetDialogScroll(this.root);
  }

  private handleSignOut() {
    if (this.busy) return;
    this.closeReferralMenu();
    this.closeAdminMenu();
    forgetCountyRadio();
    clearStoredSession();
    this.session = null;
    this.nameInput.value = "";
    this.nameInput.disabled = false;
    this.survivorNameEl.textContent = "";
    this.applyPreview({ exists: false });
    this.setBusy(false);
    this.syncAuthButtons();
  }

  private dismissWalletDialogs() {
    document.querySelectorAll(".wallet-picker").forEach((node) => node.remove());
  }

  /** Another tab finished Phantom sign-in while this one still showed the prompt. */
  private adoptCachedSession() {
    if (this.session) return;
    const cached = loadCachedAuthSession();
    if (!cached) return;
    this.dismissWalletDialogs();
    this.setSession(cached);
  }

  private async boot() {
    const returning = hasWalletDeeplinkCallback();
    if (returning && shouldHandOffWalletReturn()) {
      this.setBusy(true, "Returning to your Deadtiles tab…");
    } else if (returning) {
      this.setBusy(true, "Finishing wallet sign-in…");
    }
    try {
      const resume = await consumeWalletDeeplinkReturn();
      if (resume) {
        await this.applyDeeplinkResume(resume);
        if (resume.type !== "error") return;
      } else if (returning) {
        this.setBusy(false);
      }
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      this.showError(detail);
    }
    await this.tryRestoreSession();
  }

  private async applyDeeplinkResume(resume: DeeplinkResume) {
    this.dismissWalletDialogs();
    if (resume.type === "handed-off") {
      this.setBusy(false);
      this.statusEl.hidden = false;
      this.statusEl.textContent = "Continue in your original Deadtiles tab.";
      this.statusEl.classList.remove("main-menu-status--error");
      return;
    }
    if (resume.type === "session") {
      this.setBusy(false);
      this.setSession(resume.session);
      return;
    }
    if (resume.type === "needs-sign") {
      this.setBusy(false);
      await showMobileWalletSignStep(this.root, resume.kind);
      await this.tryRestoreSession();
      return;
    }
    this.showError(resume.message);
  }

  private async tryRestoreSession() {
    try {
      const session = await restoreAuthSession();
      if (!session) return;
      if (!session.needsName && session.name) {
        try {
          session.preview = await fetchPlayerPreview(session.sessionToken);
        } catch {
          /* keep login / cached preview while server is restarting */
        }
      }
      this.setSession(session);
    } catch {
      const cached = loadCachedAuthSession();
      if (cached) this.setSession(cached);
    }
  }

  private async handleConnectWallet() {
    if (this.busy) return;
    try {
      const options = await listWalletOptions();
      if (options.length === 0) {
        if (needsMobileWebWalletHelp()) {
          await showMobileWebWalletHelp(this.root);
          return;
        }
        if (needsDesktopWalletHelp()) {
          await showDesktopWalletHelp(this.root);
          return;
        }
        this.showError(
          isNativeApp()
            ? "No Solana wallet found. Install Phantom, Solflare, or Seed Vault on this device."
            : "No Solana wallet found. Install Phantom, Solflare, or MetaMask to play.",
        );
        return;
      }

      const choice = await pickWallet(this.root, options);
      if (!choice) return;

      rememberWallet(choice.id);
      this.setBusy(true, `Connecting ${choice.name}…`);
      const session = await loginWithSolanaWallet((message) => {
        this.setBusy(true, message);
      }, choice);
      this.setBusy(false);
      this.setSession(session);
    } catch (err) {
      console.error(err);
      const detail = err instanceof Error ? err.message : String(err);
      this.showError(detail);
    }
  }

  private async handleRegister() {
    if (this.busy || !this.session) return;
    // Permanent once created — block any client-side retry path.
    if (!this.session.needsName || this.session.name) {
      this.showError("Survivor name is permanent and cannot be changed");
      this.setSession(this.session);
      return;
    }
    const validationError = survivorNameValidationError(this.nameInput.value);
    if (validationError) {
      this.showError(validationError);
      return;
    }
    const name = normalizeSurvivorName(this.nameInput.value);
    if (!name) {
      this.showError("Invalid survivor name");
      return;
    }

    this.setBusy(true, "Creating survivor…");
    try {
      const ref = storedReferral();
      const session = await registerSurvivorName(
        this.session.sessionToken,
        name,
        ref && ref !== this.session.wallet ? ref : "",
      );
      clearStoredReferral();
      this.setBusy(false);
      this.setSession(session);
    } catch (err) {
      console.error(err);
      const detail = err instanceof Error ? err.message : String(err);
      this.showError(detail);
      // If the wallet already has a name, refresh session state from the server.
      try {
        const restored = await restoreAuthSession();
        if (restored && restored.name) this.setSession(restored);
      } catch {
        /* ignore */
      }
    }
  }

  private updateInviteBanner() {
    const stored = storedReferral();
    const wallet = this.session?.wallet ?? "";
    const invitedArrival = !!stored && stored !== wallet && !this.session?.name;
    const bonusPending = this.session?.preview?.inviteBonusPending === true;
    this.inviteBanner.hidden = !(invitedArrival || bonusPending);
  }

  /** After a survivor exists, the bounty-site link opens Refer players once. */
  private maybeOpenReferMenu() {
    if (!this.referMenuPending) return;
    if (this.busy || !this.session?.name || !this.session.wallet) return;
    this.referMenuPending = false;
    if (this.referralMenu) return;
    this.openReferralMenu();
  }

  private closeReferralMenu() {
    window.clearTimeout(this.referralCopyTimer);
    this.referralCopyTimer = 0;
    if (this.referralMenuKey) {
      document.removeEventListener("keydown", this.referralMenuKey);
      this.referralMenuKey = undefined;
    }
    this.referralMenu?.remove();
    this.referralMenu = undefined;
  }

  private openReferralMenu() {
    if (this.busy || !this.session?.name || !this.session.wallet || this.referralMenu) return;
    const session = this.session;

    const overlay = document.createElement("div");
    overlay.className = "referral-menu";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-label", "Refer players");
    this.referralMenu = overlay;

    const panel = document.createElement("div");
    panel.className = "referral-menu-panel";

    const header = document.createElement("div");
    header.className = "referral-menu-header";
    const title = document.createElement("h2");
    title.className = "referral-menu-title";
    title.textContent = "Refer players";
    header.append(title, createDialogCloseButton(() => this.closeReferralMenu()));

    const offer = document.createElement("div");
    offer.className = "referral-menu-offer";
    const offerText = document.createElement("p");
    offerText.className = "main-menu-invite-text";
    offerText.textContent = "Referred survivors who finish the tutorial receive:";
    offer.append(offerText);
    appendInvitePackage(offer);
    const payoutNote = document.createElement("p");
    payoutNote.className = "referral-menu-payout-note";
    payoutNote.textContent = `When the referred survivor finishes the tutorial you will receive ${REFERRER_PAYOUT_BANKNOTES.toLocaleString()} banknotes pending manual approval`;
    offer.append(payoutNote);

    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "main-menu-referral";
    const copyIcon = menuIcon();
    paintReferralIcon(copyIcon, false);
    const copyLabel = buttonLabel("Copy Referral Link");
    copyBtn.append(copyIcon, copyLabel);
    copyBtn.addEventListener("click", () => {
      void (async () => {
        try {
          await copyReferralLink(session.wallet);
          paintReferralIcon(copyIcon, true);
          copyLabel.textContent = "Copied";
          window.clearTimeout(this.referralCopyTimer);
          this.referralCopyTimer = window.setTimeout(() => {
            this.referralCopyTimer = 0;
            if (!copyBtn.isConnected) return;
            paintReferralIcon(copyIcon, false);
            copyLabel.textContent = "Copy Referral Link";
          }, 1600);
        } catch (err) {
          console.error(err);
          copyLabel.textContent = "Could not copy";
        }
      })();
    });

    const countEl = document.createElement("div");
    countEl.className = "referral-menu-count";
    countEl.textContent = "Loading survivors…";

    const list = document.createElement("div");
    list.className = "referral-menu-list";

    panel.append(header, offer, copyBtn, countEl, list);
    overlay.append(panel);
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) this.closeReferralMenu();
    });
    this.referralMenuKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      this.closeReferralMenu();
    };
    document.addEventListener("keydown", this.referralMenuKey);

    this.root.appendChild(overlay);
    resetDialogScroll(overlay);

    void fetchReferralBoard(session.sessionToken)
      .then((board) => {
        if (!overlay.isConnected) return;
        this.renderReferralSignups(countEl, list, board);
      })
      .catch((err) => {
        console.error(err);
        if (!overlay.isConnected) return;
        countEl.textContent = "Could not load the list. You can still copy your link.";
      });
  }

  private renderReferralSignups(
    countEl: HTMLElement,
    list: HTMLElement,
    board: ReferralBoard,
  ) {
    const signups = board.signups;
    list.replaceChildren();
    if (signups.length === 0) {
      countEl.textContent = "No one has joined with your link yet.";
      return;
    }
    countEl.textContent =
      signups.length >= 50
        ? "Latest 50 survivors"
        : signups.length === 1
          ? "1 survivor"
          : `${signups.length} survivors`;
    for (const signup of signups) {
      const row = document.createElement("div");
      row.className = "referral-menu-row";
      const name = document.createElement("div");
      name.className = "referral-menu-name";
      name.textContent = signup.name;
      const meta = document.createElement("div");
      meta.className = "referral-menu-meta";
      const status = signup.tutorialDone ? "Tutorial finished" : "Tutorial not finished";
      const when = formatSignupWhen(signup.createdAt);
      meta.textContent = when ? `${status} · ${when}` : status;
      row.append(name, meta);
      list.append(row);
    }
  }

  private closeAdminMenu() {
    if (this.adminMenuKey) {
      document.removeEventListener("keydown", this.adminMenuKey);
      this.adminMenuKey = undefined;
    }
    this.adminMenu?.remove();
    this.adminMenu = undefined;
    this.adminUserIdDraft = "";
  }

  private openAdminMenu() {
    if (this.busy || !this.session?.name || !this.session.isAdmin || this.adminMenu) return;
    const session = this.session;

    const overlay = document.createElement("div");
    overlay.className = "referral-menu";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-label", "Admin");
    this.adminMenu = overlay;

    const panel = document.createElement("div");
    panel.className = "referral-menu-panel admin-menu-panel";

    const header = document.createElement("div");
    header.className = "referral-menu-header";
    const title = document.createElement("h2");
    title.className = "referral-menu-title";
    title.textContent = "Admin";
    header.append(title, createDialogCloseButton(() => this.closeAdminMenu()));

    const status = document.createElement("div");
    status.className = "admin-menu-status";
    status.textContent = "Loading…";

    const body = document.createElement("div");
    body.className = "admin-menu-body";

    panel.append(header, status, body);
    overlay.append(panel);
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) this.closeAdminMenu();
    });
    this.adminMenuKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      this.closeAdminMenu();
    };
    document.addEventListener("keydown", this.adminMenuKey);
    this.root.appendChild(overlay);
    resetDialogScroll(overlay);

    const load = () => {
      void fetchAdminBoard(session.sessionToken)
        .then((board) => {
          if (!overlay.isConnected) return;
          status.textContent = "";
          this.renderAdminBoard(body, board, load);
        })
        .catch((err) => {
          console.error(err);
          if (!overlay.isConnected) return;
          status.textContent = err instanceof Error ? err.message : "Could not load admin tools.";
        });
    };
    load();
  }

  private renderAdminBoard(
    body: HTMLElement,
    board: AdminBoard,
    reload: () => void,
  ) {
    body.replaceChildren();
    body.append(
      this.adminOnlineSection(board, reload),
      this.adminPayoutSection(board.payouts, reload),
      this.adminBanSection(board, reload),
    );
  }

  private adminOnlineSection(board: AdminBoard, reload: () => void): HTMLElement {
    const block = document.createElement("div");
    block.className = "admin-menu-section";
    const title = document.createElement("div");
    title.className = "referral-menu-count";
    title.textContent =
      board.players.length === 0
        ? "No one is in the world"
        : board.players.length === 1
          ? "1 player in the world"
          : `${board.players.length} players in the world`;
    block.append(title);
    if (board.players.length === 0) return block;
    const list = document.createElement("div");
    list.className = "referral-menu-list admin-menu-list";
    for (const player of board.players) {
      const row = document.createElement("div");
      row.className = "referral-menu-row admin-menu-row";
      const text = document.createElement("div");
      const name = document.createElement("div");
      name.className = "referral-menu-name";
      name.textContent = player.name;
      const meta = document.createElement("div");
      meta.className = "referral-menu-meta";
      meta.textContent = player.wallet ? shortWallet(player.wallet) : player.playerId;
      meta.title = player.wallet || player.playerId;
      text.append(name, meta);
      const actions = document.createElement("div");
      actions.className = "admin-menu-actions";
      const self = player.wallet === this.session?.wallet;
      const kick = document.createElement("button");
      kick.type = "button";
      kick.className = "admin-action";
      kick.textContent = "Kick";
      kick.disabled = self;
      kick.addEventListener("click", () => {
        const token = this.session?.sessionToken;
        if (!token || kick.disabled) return;
        kick.disabled = true;
        ban.disabled = true;
        kick.textContent = "Kicking…";
        void kickAdminPlayer(token, player.playerId)
          .then(reload)
          .catch((err) => {
            console.error(err);
            kick.disabled = false;
            ban.disabled = self;
            kick.textContent = "Kick";
            meta.textContent = err instanceof Error ? err.message : "Could not kick";
          });
      });
      const ban = document.createElement("button");
      ban.type = "button";
      ban.className = "admin-action admin-action--ban";
      ban.textContent = "Ban";
      ban.disabled = self;
      ban.addEventListener("click", () => {
        const token = this.session?.sessionToken;
        if (!token || ban.disabled) return;
        kick.disabled = true;
        ban.disabled = true;
        ban.textContent = "Banning…";
        void banAdminPlayer(token, player.playerId)
          .then(reload)
          .catch((err) => {
            console.error(err);
            kick.disabled = self;
            ban.disabled = false;
            ban.textContent = "Ban";
            meta.textContent = err instanceof Error ? err.message : "Could not ban";
          });
      });
      actions.append(kick, ban);
      row.append(text, actions);
      list.append(row);
    }
    block.append(list);
    return block;
  }

  private adminPayoutSection(payouts: ReferralPayout[], reload: () => void): HTMLElement {
    const block = document.createElement("div");
    block.className = "admin-menu-section";
    const title = document.createElement("div");
    title.className = "referral-menu-count";
    title.textContent =
      payouts.length === 0
        ? "No referrals waiting"
        : payouts.length === 1
          ? "1 referral waiting"
          : `${payouts.length} referrals waiting`;
    block.append(title);
    if (payouts.length === 0) return block;
    block.append(this.referralPayoutSection(payouts, reload));
    return block;
  }

  private adminBanSection(board: AdminBoard, reload: () => void): HTMLElement {
    const block = document.createElement("div");
    block.className = "admin-menu-section";
    const title = document.createElement("div");
    title.className = "referral-menu-count";
    title.textContent =
      board.bans.length === 0
        ? "No banned players"
        : board.bans.length === 1
          ? "1 banned player"
          : `${board.bans.length} banned players`;
    block.append(title, this.adminUserIdForm(reload));
    if (board.bans.length === 0) return block;
    const list = document.createElement("div");
    list.className = "referral-menu-list admin-menu-list";
    for (const ban of board.bans) {
      const row = document.createElement("div");
      row.className = "referral-menu-row admin-menu-row";
      const text = document.createElement("div");
      const name = document.createElement("div");
      name.className = "referral-menu-name";
      name.textContent = ban.name || shortWallet(ban.wallet);
      const meta = document.createElement("div");
      meta.className = "referral-menu-meta";
      const when = formatSignupWhen(ban.bannedAt);
      meta.textContent = when
        ? `${shortWallet(ban.wallet)} · ${when}`
        : shortWallet(ban.wallet);
      meta.title = ban.wallet;
      text.append(name, meta);
      const unban = document.createElement("button");
      unban.type = "button";
      unban.className = "admin-action";
      unban.textContent = "Unban";
      unban.addEventListener("click", () => {
        const token = this.session?.sessionToken;
        if (!token || unban.disabled) return;
        unban.disabled = true;
        unban.textContent = "Unbanning…";
        void unbanAdminPlayer(token, ban.wallet)
          .then(reload)
          .catch((err) => {
            console.error(err);
            unban.disabled = false;
            unban.textContent = "Unban";
            meta.textContent = err instanceof Error ? err.message : "Could not unban";
          });
      });
      row.append(text, unban);
      list.append(row);
    }
    block.append(list);
    return block;
  }

  private adminUserIdForm(reload: () => void): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "admin-menu-manual";
    const row = document.createElement("div");
    row.className = "referral-menu-row admin-menu-row admin-menu-manual-row";
    const input = document.createElement("input");
    input.id = "admin-menu-user-id";
    input.className = "admin-menu-id-input";
    input.type = "text";
    input.autocomplete = "off";
    input.spellcheck = false;
    input.placeholder = "User id";
    input.setAttribute("aria-label", "User id");
    input.value = this.adminUserIdDraft;
    input.addEventListener("input", () => {
      this.adminUserIdDraft = input.value;
    });
    const hint = document.createElement("div");
    hint.className = "admin-menu-manual-hint";
    const actions = document.createElement("div");
    actions.className = "admin-menu-actions";
    const readId = () => input.value.trim();
    const run = (kind: "ban" | "unban", button: HTMLButtonElement) => {
      const token = this.session?.sessionToken;
      const userId = readId();
      if (!token || button.disabled) return;
      if (!userId) {
        hint.textContent = "Paste a user id first.";
        input.focus();
        return;
      }
      this.adminUserIdDraft = userId;
      const banBtn = actions.querySelector(".admin-action--ban") as HTMLButtonElement;
      const unbanBtn = actions.querySelector(".admin-action--unban") as HTMLButtonElement;
      banBtn.disabled = true;
      unbanBtn.disabled = true;
      const idle = button.textContent ?? "";
      button.textContent = kind === "ban" ? "Banning…" : "Unbanning…";
      hint.textContent = "";
      const request =
        kind === "ban"
          ? banAdminPlayer(token, userId)
          : unbanAdminPlayer(token, userId);
      void request
        .then(reload)
        .catch((err) => {
          console.error(err);
          banBtn.disabled = false;
          unbanBtn.disabled = false;
          button.textContent = idle;
          hint.textContent = err instanceof Error ? err.message : "Could not update ban.";
        });
    };
    const ban = document.createElement("button");
    ban.type = "button";
    ban.className = "admin-action admin-action--ban";
    ban.textContent = "Ban";
    ban.addEventListener("click", () => run("ban", ban));
    const unban = document.createElement("button");
    unban.type = "button";
    unban.className = "admin-action admin-action--unban";
    unban.textContent = "Unban";
    unban.addEventListener("click", () => run("unban", unban));
    input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      run("ban", ban);
    });
    actions.append(ban, unban);
    row.append(input, actions);
    wrap.append(row, hint);
    return wrap;
  }

  private referralPayoutSection(payouts: ReferralPayout[], onApproved: () => void): HTMLElement {
    const block = document.createElement("div");
    block.className = "referral-payouts admin-menu-list";
    for (const payout of payouts) {
      const row = document.createElement("div");
      row.className = "referral-menu-row referral-payout-row admin-menu-row";
      const text = document.createElement("div");
      const name = document.createElement("div");
      name.className = "referral-menu-name";
      name.textContent = payout.referrerName;
      const meta = document.createElement("div");
      meta.className = "referral-menu-meta";
      meta.textContent = `${payout.amount.toLocaleString()} notes for ${payout.referredName}`;
      text.append(name, meta);
      const approve = document.createElement("button");
      approve.type = "button";
      approve.className = "referral-approve";
      approve.textContent = "Approve";
      approve.addEventListener("click", () => {
        const token = this.session?.sessionToken;
        if (!token || approve.disabled) return;
        approve.disabled = true;
        approve.textContent = "Approving…";
        void approveReferralPayout(token, payout.referredUserId)
          .then(() => onApproved())
          .catch((err) => {
            console.error(err);
            approve.disabled = false;
            approve.textContent = "Approve";
            meta.textContent = err instanceof Error ? err.message : "Could not approve";
          });
      });
      row.append(text, approve);
      block.append(row);
    }
    return block;
  }

  private handlePlay() {
    if (this.busy || !this.session || this.session.needsName || !this.session.name) {
      return;
    }
    // Latch busy synchronously so a second mobile tap cannot start another join.
    this.setBusy(true, "Connecting to world…");
    this.handlers.onPlay(this.session);
  }

  setBusy(busy: boolean, message?: string) {
    this.busy = busy;
    this.walletBtn.disabled = busy;
    this.playBtn.disabled = busy;
    this.registerBtn.disabled = busy;
    this.adminBtn.disabled = busy;
    this.referralBtn.disabled = busy;
    this.signOutBtn.disabled = busy;
    this.nameInput.disabled = busy || Boolean(this.session?.name);
    this.syncAuthButtons();
    if (busy) {
      if (!this.walletBtn.hidden) this.walletBtn.textContent = "Connecting…";
      if (!this.registerBtn.hidden) this.registerBtn.textContent = "Creating…";
      if (!this.playBtn.hidden) this.playLabel.textContent = "Entering…";
    }
    if (message) {
      this.statusEl.hidden = false;
      this.statusEl.textContent = message;
      this.statusEl.classList.toggle("main-menu-status--error", !busy);
    } else if (!busy) {
      this.statusEl.hidden = true;
      this.statusEl.textContent = "";
      this.statusEl.classList.remove("main-menu-status--error");
    }
    if (!busy) this.maybeOpenReferMenu();
  }

  showError(message: string) {
    this.setBusy(false, message);
  }

  destroy() {
    this.closeReferralMenu();
    this.closeAdminMenu();
    this.stopWalletHandoff?.();
    this.stopWalletHandoff = undefined;
    this.previewHotbar?.destroy();
    this.previewHotbar = undefined;
    this.root.remove();
  }
}
