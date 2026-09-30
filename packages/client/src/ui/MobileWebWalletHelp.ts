import {
  clearDeeplinkSessions,
  deeplinkConnectHref,
  deeplinkHasSession,
  deeplinkSignHref,
  deeplinkWalletName,
  markDeeplinkActive,
  type DeeplinkWallet,
} from "../network/walletDeeplink";
import {
  androidAppDownloadHref,
  METAMASK_DOWNLOAD_HREF,
  PHANTOM_DOWNLOAD_HREF,
  SOLFLARE_DOWNLOAD_HREF,
  walletReturnIsHttps,
} from "../network/walletDeepLinks";
import { resetDialogScroll } from "./dialogScroll";

type HelpLink = {
  href?: string;
  label: string;
  pendingLabel?: string;
  primary?: boolean;
  newTab?: boolean;
  prepare?: () => Promise<string>;
  onActivate?: () => void;
};

function showWalletHelpDialog(
  host: HTMLElement,
  opts: {
    title: string;
    ariaLabel: string;
    hint: string;
    links: HelpLink[];
    onForget?: () => void;
  },
): Promise<void> {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "wallet-picker";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-label", opts.ariaLabel);

    const panel = document.createElement("div");
    panel.className = "wallet-picker-panel";

    const title = document.createElement("h2");
    title.className = "wallet-picker-title";
    title.textContent = opts.title;

    const hint = document.createElement("p");
    hint.className = "wallet-picker-hint";
    hint.textContent = opts.hint;

    const list = document.createElement("div");
    list.className = "wallet-picker-list";

    const anchors: HTMLAnchorElement[] = [];
    for (const link of opts.links) {
      const anchor = document.createElement("a");
      anchor.className = link.primary
        ? "wallet-picker-option wallet-picker-option--action wallet-picker-option--primary"
        : "wallet-picker-option wallet-picker-option--action";
      const readyNow = typeof link.href === "string" && link.href.length > 0;
      anchor.href = readyNow ? link.href! : "#";
      anchor.rel = "noopener";
      if (link.newTab) {
        anchor.target = "_blank";
        anchor.rel = "noopener noreferrer";
      }
      anchor.textContent = link.pendingLabel && !readyNow ? link.pendingLabel : link.label;
      if (readyNow) anchor.dataset.ready = "1";
      else anchor.classList.add("wallet-picker-option--pending");
      anchor.addEventListener("click", (event) => {
        if (anchor.dataset.ready !== "1") {
          event.preventDefault();
          return;
        }
        link.onActivate?.();
      });
      anchor.addEventListener("pointerdown", () => {
        if (anchor.dataset.ready === "1") link.onActivate?.();
      });
      if (link.prepare) {
        void link.prepare().then(
          (href) => {
            if (!anchor.isConnected) return;
            anchor.href = href;
            anchor.dataset.ready = "1";
            anchor.classList.remove("wallet-picker-option--pending");
            anchor.textContent = link.label;
          },
          (err) => {
            if (!anchor.isConnected) return;
            anchor.textContent = "Unavailable";
            hint.textContent =
              err instanceof Error ? err.message : "Could not prepare wallet sign-in.";
          },
        );
      }
      list.append(anchor);
      anchors.push(anchor);
    }

    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "wallet-picker-cancel";
    cancel.textContent = "Cancel";

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      document.removeEventListener("keydown", onKey);
      overlay.remove();
      resolve();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        finish();
      }
    };

    cancel.addEventListener("click", finish);
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) finish();
    });
    document.addEventListener("keydown", onKey);

    panel.append(title, hint, list);
    if (opts.onForget) {
      const forget = document.createElement("button");
      forget.type = "button";
      forget.className = "wallet-picker-cancel";
      forget.textContent = "Use a different account";
      forget.addEventListener("click", () => {
        const reopen = opts.onForget;
        finish();
        reopen?.();
      });
      panel.append(forget);
    }
    panel.append(cancel);
    overlay.appendChild(panel);
    host.appendChild(overlay);
    resetDialogScroll(overlay);
    anchors[0]?.focus();
  });
}

function walletLink(kind: DeeplinkWallet, primary: boolean): HelpLink {
  const name = deeplinkWalletName(kind);
  const onActivate = () => markDeeplinkActive(kind);
  if (deeplinkHasSession(kind)) {
    return {
      label: `Sign in with ${name}`,
      pendingLabel: `Preparing ${name}…`,
      primary,
      prepare: () => deeplinkSignHref(kind),
      onActivate,
    };
  }
  return {
    label: `Connect ${name}`,
    href: deeplinkConnectHref(kind),
    primary,
    onActivate,
  };
}

/**
 * Prompt for phone browsers that have no injected wallet.
 * Links must be real taps so the phone can open Phantom or Solflare, then return here.
 */
export function showMobileWebWalletHelp(host: HTMLElement): Promise<void> {
  if (!walletReturnIsHttps()) {
    return showWalletHelpDialog(host, {
      title: "Connect wallet",
      ariaLabel: "Connect a wallet",
      hint: "Phone wallet sign-in has to return to this page over https. Open Deadtiles at play.deadtiles.com in this browser.",
      links: [
        {
          href: "https://play.deadtiles.com/",
          label: "Open play.deadtiles.com",
          primary: true,
        },
      ],
    });
  }

  const saved =
    deeplinkHasSession("phantom") || deeplinkHasSession("solflare");
  const links: HelpLink[] = [walletLink("phantom", true), walletLink("solflare", false)];
  const androidHref = androidAppDownloadHref();
  if (androidHref) {
    links.push({ href: androidHref, label: "Download the Android app" });
  }
  return showWalletHelpDialog(host, {
    title: "Connect wallet",
    ariaLabel: "Connect a wallet",
    hint: "Phantom or Solflare will open so you can approve. You come back to this browser to play.",
    links,
    onForget: saved
      ? () => {
          clearDeeplinkSessions();
          void showMobileWebWalletHelp(host);
        }
      : undefined,
  });
}

/** Second tap after connect. iOS will not open the wallet again without a new tap. */
export function showMobileWalletSignStep(
  host: HTMLElement,
  kind: DeeplinkWallet,
): Promise<void> {
  const name = deeplinkWalletName(kind);
  if (!walletReturnIsHttps()) {
    return showWalletHelpDialog(host, {
      title: "Approve login",
      ariaLabel: "Approve wallet login",
      hint: "Phone wallet sign-in has to return to this page over https. Open Deadtiles at play.deadtiles.com in this browser.",
      links: [
        {
          href: "https://play.deadtiles.com/",
          label: "Open play.deadtiles.com",
          primary: true,
        },
      ],
    });
  }
  return showWalletHelpDialog(host, {
    title: "Approve login",
    ariaLabel: "Approve wallet login",
    hint: `Tap below to open ${name} and approve the login message. You will come back to this browser.`,
    links: [
      {
        label: `Sign in with ${name}`,
        pendingLabel: `Preparing ${name}…`,
        primary: true,
        prepare: () => deeplinkSignHref(kind),
        onActivate: () => markDeeplinkActive(kind),
      },
    ],
    onForget: () => {
      clearDeeplinkSessions();
      void showMobileWebWalletHelp(host);
    },
  });
}

/** Prompt for desktop browsers that have no wallet extension installed. */
export function showDesktopWalletHelp(host: HTMLElement): Promise<void> {
  return showWalletHelpDialog(host, {
    title: "Install a wallet",
    ariaLabel: "Install a Solana wallet",
    hint:
      "Deadtiles needs a Solana wallet in this browser. Install one, then refresh this page.",
    links: [
      {
        href: PHANTOM_DOWNLOAD_HREF,
        label: "Install Phantom",
        primary: true,
        newTab: true,
      },
      {
        href: SOLFLARE_DOWNLOAD_HREF,
        label: "Install Solflare",
        newTab: true,
      },
      {
        href: METAMASK_DOWNLOAD_HREF,
        label: "Install MetaMask",
        newTab: true,
      },
    ],
  });
}
