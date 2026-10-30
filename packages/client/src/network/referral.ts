const STORAGE_KEY = "deadtiles.referral";

/** Site bounty button asked this visit to open Refer players. */
let referMenuRequested = false;

/** Shown above the invitation item icons. */
export const INVITE_BONUS_LINE =
  "Finish the tutorial and you will receive:";

/** Solana wallet alphabet and length. Player user ids are wallets. */
const WALLET_RE = /^[1-9A-HJ-NP-Za-km-z]{32,48}$/;

export function referralLink(userId: string): string {
  return `https://play.deadtiles.com/?ref=${encodeURIComponent(userId)}`;
}

/** Remember ?ref= so a wallet redirect does not drop it before character creation. */
export function captureReferralFromUrl(): void {
  try {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("ref")) return;
    const ref = params.get("ref")?.trim() ?? "";
    if (WALLET_RE.test(ref)) localStorage.setItem(STORAGE_KEY, ref);
    const url = new URL(window.location.href);
    url.searchParams.delete("ref");
    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
  } catch {
    /* storage or history unavailable */
  }
}

/**
 * The marketing site links here with ?refer=1. Remember it for this page load
 * and drop the query so a refresh does not open the dialog again.
 */
export function captureReferMenuRequest(): boolean {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("refer") === "1") {
      referMenuRequested = true;
      const url = new URL(window.location.href);
      url.searchParams.delete("refer");
      window.history.replaceState(
        window.history.state,
        "",
        `${url.pathname}${url.search}${url.hash}`,
      );
    }
  } catch {
    /* storage or history unavailable */
  }
  return referMenuRequested;
}

export function storedReferral(): string {
  try {
    const ref = localStorage.getItem(STORAGE_KEY)?.trim() ?? "";
    return WALLET_RE.test(ref) ? ref : "";
  } catch {
    return "";
  }
}

export function clearStoredReferral(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export async function copyReferralLink(userId: string): Promise<void> {
  const link = referralLink(userId);
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(link);
      return;
    } catch {
      /* fall through when the page cannot use the async clipboard */
    }
  }
  const area = document.createElement("textarea");
  area.value = link;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.left = "-9999px";
  document.body.appendChild(area);
  area.select();
  const ok = document.execCommand("copy");
  area.remove();
  if (!ok) throw new Error("Could not copy the referral link");
}
