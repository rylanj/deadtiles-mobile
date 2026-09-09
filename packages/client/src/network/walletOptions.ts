import { isNativeApp } from "../native";
import { listMobileWallets } from "./mobileWalletAdapter";
import { listBrowserWallets } from "./solanaWallet";

export type WalletOptionSource = "injected" | "metamask" | "standard" | "mwa";

export type WalletOption = {
  id: string;
  name: string;
  source: WalletOptionSource;
  icon?: string;
  packageName?: string;
};

const LAST_WALLET_KEY = "deadtiles_last_wallet";

export function lastWalletId(): string | null {
  try {
    return localStorage.getItem(LAST_WALLET_KEY);
  } catch {
    return null;
  }
}

export function rememberWallet(id: string) {
  try {
    localStorage.setItem(LAST_WALLET_KEY, id);
  } catch {
    /* ignore */
  }
}

function sortWalletOptions(options: WalletOption[]): WalletOption[] {
  const last = lastWalletId();
  return [...options].sort((a, b) => {
    if (last && a.id === last && b.id !== last) return -1;
    if (last && b.id === last && a.id !== last) return 1;
    return a.name.localeCompare(b.name);
  });
}

export async function listWalletOptions(): Promise<WalletOption[]> {
  if (isNativeApp()) {
    const wallets = await listMobileWallets();
    return sortWalletOptions(
      wallets.map((wallet) => ({
        id: wallet.id,
        name: wallet.name,
        source: "mwa",
        icon: wallet.icon,
        packageName: wallet.packageName,
      })),
    );
  }
  return sortWalletOptions(listBrowserWallets());
}
