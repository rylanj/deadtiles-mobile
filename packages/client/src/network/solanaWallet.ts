import bs58 from "bs58";
import { getWallets } from "@wallet-standard/app";

export class DeadmarkWalletError extends Error {
  readonly cancelled: boolean;

  constructor(message: string, cancelled: boolean) {
    super(message);
    this.name = "DeadmarkWalletError";
    this.cancelled = cancelled;
  }
}

export type SolanaWalletProvider = {
  isPhantom?: boolean;
  isSolflare?: boolean;
  publicKey?: { toBase58(): string } | { toString(): string };
  connect(opts?: { onlyIfTrusted?: boolean }): Promise<{ publicKey: { toString(): string } }>;
  disconnect?(): Promise<void>;
  signMessage(message: Uint8Array, display?: "utf8" | "hex"): Promise<
    | { signature: Uint8Array }
    | Uint8Array
  >;
  on?(event: string, handler: (...args: unknown[]) => void): void;
  off?(event: string, handler: (...args: unknown[]) => void): void;
};

type WalletStandardAccount = { address: string };
type WalletStandardWallet = {
  features: {
    "standard:connect"?: {
      connect: () => Promise<{ accounts: WalletStandardAccount[] }>;
    };
    "solana:signMessage"?: {
      signMessage: (input: {
        account: WalletStandardAccount;
        message: Uint8Array;
      }) => Promise<readonly { signature: Uint8Array }[]>;
    };
  };
};

declare global {
  interface Window {
    solana?: SolanaWalletProvider;
    solflare?: SolanaWalletProvider;
    phantom?: { solana?: SolanaWalletProvider };
  }
}

type BrowserWalletChoice = {
  id: string;
  name: string;
  source: "injected" | "metamask" | "standard";
  icon?: string;
};

const injectedProviders = new Map<string, SolanaWalletProvider>();
const standardWallets = new Map<string, WalletStandardWallet>();

function hasMetaMask(): boolean {
  if (typeof window === "undefined") return false;
  const eth = (
    window as Window & {
      ethereum?: { isMetaMask?: boolean; providers?: { isMetaMask?: boolean }[] };
    }
  ).ethereum;
  if (!eth) return false;
  if (eth.isMetaMask) return true;
  return Boolean(eth.providers?.some((provider) => provider.isMetaMask));
}

/** Injected Phantom / Solflare / generic window.solana providers. */
export function getInjectedSolanaProvider(): SolanaWalletProvider | null {
  if (typeof window === "undefined") return null;
  const phantom =
    window.phantom?.solana ?? (window.solana?.isPhantom ? window.solana : null);
  if (phantom) return phantom;
  if (window.solflare) return window.solflare;
  if (window.solana) return window.solana;
  return null;
}

export function listBrowserWallets(): BrowserWalletChoice[] {
  injectedProviders.clear();
  standardWallets.clear();
  const options: BrowserWalletChoice[] = [];
  const seen = new Set<string>();

  const add = (option: BrowserWalletChoice) => {
    const key = option.name.trim().toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    options.push(option);
  };

  if (typeof window !== "undefined") {
    const phantom =
      window.phantom?.solana ?? (window.solana?.isPhantom ? window.solana : null);
    if (phantom) {
      injectedProviders.set("injected:phantom", phantom);
      add({ id: "injected:phantom", name: "Phantom", source: "injected" });
    }
    if (window.solflare) {
      injectedProviders.set("injected:solflare", window.solflare);
      add({ id: "injected:solflare", name: "Solflare", source: "injected" });
    }
    if (window.solana && !window.solana.isPhantom && window.solana !== window.solflare) {
      injectedProviders.set("injected:solana", window.solana);
      add({ id: "injected:solana", name: "Solana wallet", source: "injected" });
    }
    if (hasMetaMask()) {
      add({ id: "metamask", name: "MetaMask", source: "metamask" });
    }
  }

  for (const wallet of getWallets().get()) {
    const features = wallet.features as Record<string, unknown>;
    if (!features["standard:connect"] || !features["solana:signMessage"]) {
      continue;
    }
    const id = `standard:${wallet.name}`;
    standardWallets.set(id, wallet as unknown as WalletStandardWallet);
    add({
      id,
      name: wallet.name,
      source: "standard",
      icon: typeof wallet.icon === "string" ? wallet.icon : undefined,
    });
  }

  return options;
}

/** @deprecated Prefer {@link getInjectedSolanaProvider}. */
export function getSolanaProvider(): SolanaWalletProvider | null {
  return getInjectedSolanaProvider();
}

export function shortWallet(wallet: string): string {
  if (wallet.length <= 10) return wallet;
  return `${wallet.slice(0, 4)}…${wallet.slice(-4)}`;
}

function signatureToBytes(signature: unknown): Uint8Array {
  if (signature instanceof Uint8Array) return signature;
  if (
    signature &&
    typeof signature === "object" &&
    "signature" in signature &&
    (signature as { signature: unknown }).signature instanceof Uint8Array
  ) {
    return (signature as { signature: Uint8Array }).signature;
  }
  throw new Error("Wallet did not return a signature");
}

async function getMetaMaskSolanaWallet(): Promise<WalletStandardWallet> {
  const { createSolanaClient } = await import("@metamask/connect-solana");
  const client = await createSolanaClient({
    dapp: {
      name: "Deadtiles",
      url: window.location.origin,
    },
  });
  const wallet = client.getWallet() as WalletStandardWallet;
  if (
    !wallet?.features?.["standard:connect"]?.connect ||
    !wallet?.features?.["solana:signMessage"]?.signMessage
  ) {
    throw new Error(
      "MetaMask Solana not available. Update MetaMask or install Phantom / Solflare.",
    );
  }
  return wallet;
}

async function connectInjected(
  provider: SolanaWalletProvider,
): Promise<{ provider: SolanaWalletProvider; wallet: string }> {
  const result = await provider.connect();
  const wallet =
    result.publicKey?.toString() ||
    (provider.publicKey
      ? "toBase58" in provider.publicKey
        ? provider.publicKey.toBase58()
        : provider.publicKey.toString()
      : "");
  if (!wallet) throw new Error("Wallet connect failed");
  return { provider, wallet };
}

async function connectMetaMask(): Promise<{
  provider: SolanaWalletProvider;
  wallet: string;
}> {
  const mmWallet = await getMetaMaskSolanaWallet();
  const { accounts } = await mmWallet.features["standard:connect"]!.connect();
  const account = accounts?.[0];
  if (!account?.address) {
    throw new Error("No Solana account returned from MetaMask");
  }

  // Adapt Wallet Standard to the injected-provider shape used by signLoginMessage.
  const adapter: SolanaWalletProvider = {
    connect: async () => ({ publicKey: { toString: () => account.address } }),
    signMessage: async (message: Uint8Array) => {
      const [out] = await mmWallet.features["solana:signMessage"]!.signMessage({
        account,
        message,
      });
      if (!out?.signature) throw new Error("MetaMask did not return a signature");
      return { signature: out.signature };
    },
  };
  return { provider: adapter, wallet: account.address };
}

async function connectStandardWallet(
  id: string,
): Promise<{ provider: SolanaWalletProvider; wallet: string }> {
  const wallet = standardWallets.get(id);
  if (!wallet) {
    throw new Error("That wallet is no longer available. Try Connect wallet again.");
  }
  const { accounts } = await wallet.features["standard:connect"]!.connect();
  const account = accounts?.[0];
  if (!account?.address) {
    throw new Error("Wallet did not return an account");
  }
  const adapter: SolanaWalletProvider = {
    connect: async () => ({ publicKey: { toString: () => account.address } }),
    signMessage: async (message: Uint8Array) => {
      const [out] = await wallet.features["solana:signMessage"]!.signMessage({
        account,
        message,
      });
      if (!out?.signature) throw new Error("Wallet did not return a signature");
      return { signature: out.signature };
    },
  };
  return { provider: adapter, wallet: account.address };
}

/**
 * Connect a specific browser wallet, or the first one found.
 * The Android APK uses Mobile Wallet Adapter instead (see loginWithSolanaWallet).
 */
export async function connectSolanaWallet(choice?: {
  id: string;
  source: "injected" | "metamask" | "standard" | "mwa";
}): Promise<{
  provider: SolanaWalletProvider;
  wallet: string;
}> {
  if (choice?.source === "injected") {
    const provider = injectedProviders.get(choice.id) ?? getInjectedSolanaProvider();
    if (!provider) {
      throw new Error("That wallet is no longer available. Try Connect wallet again.");
    }
    return connectInjected(provider);
  }
  if (choice?.source === "metamask") {
    return connectMetaMask();
  }
  if (choice?.source === "standard") {
    return connectStandardWallet(choice.id);
  }

  const injected = getInjectedSolanaProvider();
  if (injected) {
    return connectInjected(injected);
  }

  try {
    return await connectMetaMask();
  } catch {
    throw new Error(
      "No Solana wallet found. Install Phantom, Solflare, or MetaMask to play.",
    );
  }
}

export async function signLoginMessage(
  provider: SolanaWalletProvider,
  message: string,
): Promise<string> {
  const encoded = new TextEncoder().encode(message);
  const result = await provider.signMessage(encoded, "utf8");
  return bs58.encode(signatureToBytes(result));
}

type StandardAccount = { address: string };
type SignAndSendWallet = {
  name: string;
  features: {
    "standard:connect"?: {
      connect: () => Promise<{ accounts: StandardAccount[] }>;
    };
    "solana:signAndSendTransaction"?: {
      signAndSendTransaction: (
        ...inputs: {
          account: StandardAccount;
          transaction: Uint8Array;
          chain?: string;
        }[]
      ) => Promise<readonly { signature: Uint8Array | string }[]>;
    };
  };
};

function bytesFromBase64(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function signatureBase58(signature: Uint8Array | string): string {
  if (typeof signature === "string") {
    try {
      if (bs58.decode(signature).length === 64) return signature;
    } catch {
      /* base64 below */
    }
    const bytes = bytesFromBase64(signature);
    if (bytes.length === 64) return bs58.encode(bytes);
    throw new Error("Wallet did not return a transfer signature");
  }
  if (signature.length !== 64) throw new Error("Wallet did not return a transfer signature");
  return bs58.encode(signature);
}

function walletNameHint(id: string | null): string | null {
  if (!id) return null;
  const lower = id.toLowerCase();
  if (lower.includes("phantom")) return "phantom";
  if (lower.includes("solflare")) return "solflare";
  if (lower.includes("metamask")) return "metamask";
  if (lower.startsWith("standard:")) return lower.slice("standard:".length);
  return null;
}

function walletFailure(err: unknown): DeadmarkWalletError {
  if (err instanceof DeadmarkWalletError) return err;
  const message = err instanceof Error ? err.message : "The wallet could not send the transfer.";
  const cancelled = /reject|denied|cancel/i.test(message);
  return new DeadmarkWalletError(cancelled ? "Wallet request was cancelled." : message, cancelled);
}

/**
 * Ask the browser wallet that matches this session to sign and send the
 * coast's unsigned transfer. The signature is base58.
 */
export async function sendBrowserDeadmarkBuyback(
  unsignedTxBase64: string,
  expectedWallet: string,
  walletHint: string | null,
): Promise<string> {
  const bytes = bytesFromBase64(unsignedTxBase64);
  const wanted = walletNameHint(walletHint);
  const wallets = getWallets().get() as unknown as SignAndSendWallet[];
  const capable = wallets.filter(
    (wallet) =>
      wallet.features["standard:connect"] && wallet.features["solana:signAndSendTransaction"],
  );
  const wallet =
    capable.find((entry) => wanted && entry.name.toLowerCase().includes(wanted)) ?? capable[0];
  if (!wallet?.features["standard:connect"] || !wallet.features["solana:signAndSendTransaction"]) {
    throw new DeadmarkWalletError(
      "No Solana wallet can send this transfer. Open Phantom or Solflare and try again.",
      false,
    );
  }
  let accounts: StandardAccount[] = [];
  try {
    accounts = (await wallet.features["standard:connect"].connect()).accounts ?? [];
  } catch (err) {
    throw walletFailure(err);
  }
  const account = accounts.find((entry) => entry.address === expectedWallet) ?? accounts[0];
  if (!account || account.address !== expectedWallet) {
    throw new DeadmarkWalletError(
      "That wallet isn't the one on your ledger. Connect the wallet you signed in with.",
      false,
    );
  }
  try {
    const [out] = await wallet.features["solana:signAndSendTransaction"].signAndSendTransaction({
      account,
      transaction: bytes,
      chain: "solana:mainnet",
    });
    if (!out?.signature) throw new Error("Wallet did not return a transfer signature");
    return signatureBase58(out.signature);
  } catch (err) {
    throw walletFailure(err);
  }
}
