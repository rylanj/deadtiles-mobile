import {
  androidAppDownloadHref,
  METAMASK_DOWNLOAD_HREF,
  PHANTOM_DOWNLOAD_HREF,
  phantomBrowseHref,
  SOLFLARE_DOWNLOAD_HREF,
  solflareBrowseHref,
} from "../network/walletDeepLinks";
import { resetDialogScroll } from "./dialogScroll";

type HelpLink = {
  href: string;
  label: string;
  primary?: boolean;
  newTab?: boolean;
};

function showWalletHelpDialog(
  host: HTMLElement,
  opts: {
    title: string;
    ariaLabel: string;
    hint: string;
    links: HelpLink[];
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
      anchor.href = link.href;
      anchor.rel = "noopener";
      if (link.newTab) {
        anchor.target = "_blank";
        anchor.rel = "noopener noreferrer";
      }
      anchor.textContent = link.label;
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

    panel.append(title, hint, list, cancel);
    overlay.appendChild(panel);
    host.appendChild(overlay);
    resetDialogScroll(overlay);
    anchors[0]?.focus();
  });
}

/**
 * Prompt for phone browsers that have no injected wallet.
 * Phantom / Solflare links must be real taps so the OS can open the wallet app.
 */
export function showMobileWebWalletHelp(host: HTMLElement): Promise<void> {
  const links: HelpLink[] = [
    { href: phantomBrowseHref(), label: "Open in Phantom", primary: true },
    { href: solflareBrowseHref(), label: "Open in Solflare" },
  ];
  const androidHref = androidAppDownloadHref();
  if (androidHref) {
    links.push({ href: androidHref, label: "Download the Android app" });
  }
  return showWalletHelpDialog(host, {
    title: "Open in a wallet",
    ariaLabel: "Open in a wallet browser",
    hint:
      "This phone browser cannot see Phantom or Solflare. Open Deadtiles in a wallet browser, or play in the Deadtiles Android app.",
    links,
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
