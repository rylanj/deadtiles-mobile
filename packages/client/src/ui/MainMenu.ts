import {
  HUNGER_MAX,
  PLAYER_MAX_HEALTH,
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
  fetchPlayerPreview,
  loadCachedAuthSession,
  loginWithSolanaWallet,
  registerSurvivorName,
  restoreAuthSession,
  storeAuthSession,
  type AuthSession,
  type PlayerPreview,
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

/**
 * Full-screen Deatiles main menu — Solana wallet login + unique survivor name.
 */
export class MainMenu {
  private root: HTMLElement;
  private nameSection: HTMLElement;
  private nameInput: HTMLInputElement;
  private walletBtn: HTMLButtonElement;
  private playBtn: HTMLButtonElement;
  private registerBtn: HTMLButtonElement;
  private signOutBtn: HTMLButtonElement;
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
  private stopWalletHandoff?: () => void;

  constructor(private handlers: MainMenuHandlers) {
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
    this.playBtn.textContent = "Enter world";
    this.playBtn.hidden = true;

    this.signOutBtn = document.createElement("button");
    this.signOutBtn.type = "button";
    this.signOutBtn.className = "main-menu-sign-out";
    this.signOutBtn.textContent = "Sign out";
    this.signOutBtn.hidden = true;

    actions.append(
      this.walletBtn,
      this.registerBtn,
      this.playBtn,
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

    const hint = document.createElement("div");
    hint.className = "main-menu-hint";
    hint.innerHTML = isMobileDevice()
      ? "<span>Tap</span> move · interact · shoot"
      : "<span>Click</span> move · <span>CTRL</span> aim · <span>R</span> reload · <span>TAB</span> inventory · <span>M</span> map";

    body.append(
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
    this.signOutBtn.hidden = !loggedIn;
    this.nameSection.hidden = !needsName;
    this.previewSection.hidden = !ready;
    this.walletLabel.hidden = !loggedIn;

    if (!this.busy) {
      this.walletBtn.textContent = "Connect wallet";
      this.registerBtn.textContent = "Create survivor";
      this.playBtn.textContent = "Enter world";
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
      const session = await registerSurvivorName(this.session.sessionToken, name);
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
    this.signOutBtn.disabled = busy;
    this.nameInput.disabled = busy || Boolean(this.session?.name);
    this.syncAuthButtons();
    if (busy) {
      if (!this.walletBtn.hidden) this.walletBtn.textContent = "Connecting…";
      if (!this.registerBtn.hidden) this.registerBtn.textContent = "Creating…";
      if (!this.playBtn.hidden) this.playBtn.textContent = "Entering…";
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
  }

  showError(message: string) {
    this.setBusy(false, message);
  }

  destroy() {
    this.stopWalletHandoff?.();
    this.stopWalletHandoff = undefined;
    this.previewHotbar?.destroy();
    this.previewHotbar = undefined;
    this.root.remove();
  }
}
