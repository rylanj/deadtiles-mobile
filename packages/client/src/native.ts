import { Capacitor, registerPlugin } from "@capacitor/core";

/** True when running inside the Android (or iOS) Capacitor shell. */
export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

export type MobileWalletInfo = {
  packageName: string;
  label: string;
  icon?: string;
};

export interface SolanaMWAPlugin {
  isAvailable(): Promise<{ available: boolean }>;
  listWallets(): Promise<{ wallets: MobileWalletInfo[] }>;
  setPreferredWallet(options: { packageName: string | null }): Promise<void>;
  launchWalletUri(options: { uri: string }): Promise<{ launched: boolean }>;
}

export const SolanaMWA = registerPlugin<SolanaMWAPlugin>("SolanaMWA");
