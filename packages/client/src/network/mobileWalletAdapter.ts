import bs58 from "bs58";
import { isNativeApp, SolanaMWA } from "../native";
import appIcon from "../brand/deadtiles-icon.png?inline";

/** Phantom fetches `icon` itself. A data URI always works; a site path 500s today. */
const APP_IDENTITY = {
  name: "Deadtiles",
  uri: "https://play.deadtiles.com",
  icon: appIcon,
} as const;

export type MobileWalletLogin = {
  wallet: string;
  nonce: string;
  signature: string;
};

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function base64ToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/** MWA account.address is usually base64 pubkey bytes; some wallets send base58. */
export function mwaAddressToBase58(address: string): string {
  const trimmed = address.trim();
  try {
    const as58 = bs58.decode(trimmed);
    if (as58.length === 32) return trimmed;
  } catch {
    /* not base58 */
  }
  try {
    const bytes = base64ToBytes(trimmed);
    if (bytes.length === 32) return bs58.encode(bytes);
  } catch {
    /* not base64 */
  }
  throw new Error("Wallet returned an unrecognized account address");
}

function extractDetachedSignature(
  signedPayload: Uint8Array,
  original: Uint8Array,
): Uint8Array {
  if (signedPayload.length === 64) return signedPayload;
  if (signedPayload.length === original.length + 64) {
    const prefix = signedPayload.slice(0, 64);
    const rest = signedPayload.slice(64);
    if (bytesEqual(rest, original)) return prefix;
    const message = signedPayload.slice(0, original.length);
    const suffix = signedPayload.slice(original.length);
    if (bytesEqual(message, original) && suffix.length === 64) return suffix;
  }
  throw new Error("Wallet did not return a login signature");
}

function decodeSignedPayload(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) return value;
  if (typeof value === "string") return base64ToBytes(value);
  throw new Error("Wallet did not return a login signature");
}

function mapMwaError(err: unknown): Error {
  const code =
    err && typeof err === "object" && "code" in err
      ? String((err as { code: unknown }).code)
      : "";
  const message = err instanceof Error ? err.message : String(err);

  if (
    code.includes("WALLET_NOT_FOUND") ||
    /no (installed )?wallet|not found/i.test(message)
  ) {
    return new Error(
      "No Solana wallet found. Install Phantom, Solflare, or Seed Vault on this device.",
    );
  }
  if (
    code.includes("AUTHORIZATION_FAILED") ||
    code.includes("NOT_SIGNED") ||
    /denied|rejected|cancel/i.test(message)
  ) {
    return new Error("Wallet request was cancelled.");
  }
  if (code.includes("SESSION_TIMEOUT") || code.includes("SESSION_CLOSED")) {
    return new Error("Wallet connection timed out. Try Connect wallet again.");
  }
  return err instanceof Error ? err : new Error(message);
}

export async function listMobileWallets(): Promise<
  { id: string; name: string; icon?: string; packageName: string }[]
> {
  if (!isNativeApp()) return [];
  try {
    const { wallets } = await SolanaMWA.listWallets();
    return wallets.map((wallet) => ({
      id: `mwa:${wallet.packageName}`,
      name: wallet.label,
      icon: wallet.icon,
      packageName: wallet.packageName,
    }));
  } catch {
    return [];
  }
}

export async function setPreferredMobileWallet(
  packageName: string | null,
): Promise<void> {
  if (!isNativeApp()) return;
  await SolanaMWA.setPreferredWallet({ packageName });
}

/**
 * One Phantom session: connect and sign the login nonce fetched while
 * Deadtiles is still in front (Android DNS fails if we fetch under Phantom).
 */
export async function signInWithMobileWallet(opts: {
  nonce: string;
  message: string;
  onPhase?: (message: string) => void;
  packageName?: string;
  walletName?: string;
}): Promise<MobileWalletLogin> {
  if (!isNativeApp()) {
    throw new Error("Mobile Wallet Adapter is only available in the Android app.");
  }

  const { transact } = await import(
    "@solana-mobile/mobile-wallet-adapter-protocol"
  );
  const encoded = new TextEncoder().encode(opts.message);

  try {
    await setPreferredMobileWallet(opts.packageName ?? null);
    opts.onPhase?.(
      opts.walletName
        ? `Approve connect and login in ${opts.walletName}…`
        : "Approve connect and login in Phantom…",
    );
    return await transact(async (wallet) => {
      const auth = await wallet.authorize({
        chain: "solana:mainnet",
        identity: APP_IDENTITY,
      });
      const account = auth.accounts?.[0];
      if (!account?.address) {
        throw new Error("Wallet did not return an account");
      }

      const { signed_payloads } = await wallet.signMessages({
        addresses: [account.address],
        payloads: [bytesToBase64(encoded)],
      });
      const first = signed_payloads?.[0];
      if (first == null) {
        throw new Error("Wallet did not return a login signature");
      }

      const signatureBytes = extractDetachedSignature(
        decodeSignedPayload(first),
        encoded,
      );
      return {
        wallet: mwaAddressToBase58(account.address),
        nonce: opts.nonce,
        signature: bs58.encode(signatureBytes),
      };
    });
  } catch (err) {
    throw mapMwaError(err);
  }
}
