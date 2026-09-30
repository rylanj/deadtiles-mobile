import nacl from "tweetnacl";
import bs58 from "bs58";
import { ApiHttpError } from "./api";
import {
  completeSignedLogin,
  fetchAuthNonce,
  type AuthSession,
} from "./ColyseusClient";
import { isNativeApp } from "../native";
import {
  nativeWalletReturnUrl,
  walletReturnIsHttps,
  walletReturnUrl,
} from "./walletDeepLinks";

/**
 * Phone browsers with no injected wallet.
 * Connect and signMessage open Phantom or Solflare, then redirect_link brings
 * the user back to this https page. Phantom reads the Deadtiles name from that
 * https address, so the return must not be a custom scheme. The Android app
 * claims app.deadtiles.com, so a play.deadtiles.com return stays in the browser.
 * The x25519 secret stays in localStorage and is never put in the URL.
 */

const STORAGE_KEY = "deatiles_wallet_deeplink";
const HOST_KEY = "deatiles_wallet_host";
const RETURN_KEY = "deatiles_wallet_return";
const CLAIM_KEY = "deatiles_wallet_return_claim";
const HANDOFF_CHANNEL = "deatiles-wallet-return";
/** How long a new tab waits for the original tab to take the wallet return. */
const HANDOFF_WAIT_MS = 1000;
/** Reuse an in-flight connect key so a late wallet return can still be decrypted. */
const CONNECT_KEY_REUSE_MS = 10 * 60 * 1000;

export type DeeplinkWallet = "phantom" | "solflare";

export type DeeplinkResume =
  | { type: "session"; session: AuthSession }
  | { type: "needs-sign"; kind: DeeplinkWallet }
  | { type: "handed-off" }
  | { type: "error"; message: string };

type WalletRecord = {
  dappPublicKey: string;
  dappSecretKey: string;
  walletEncryptionPublicKey?: string;
  session?: string;
  walletPublicKey?: string;
  /** Server login nonce. Not Phantom's encryption nonce. */
  loginNonce?: string;
  phase: "connect" | "sign" | "ready";
  updatedAt: number;
};

type DeeplinkStore = {
  active?: DeeplinkWallet;
  phantom?: WalletRecord;
  solflare?: WalletRecord;
};

const CALLBACK_KEYS = [
  "errorCode",
  "errorMessage",
  "data",
  "nonce",
  "phantom_encryption_public_key",
  "solflare_encryption_public_key",
  "dt_wallet",
];

export function deeplinkWalletName(kind: DeeplinkWallet): string {
  return kind === "phantom" ? "Phantom" : "Solflare";
}

export function deeplinkHasSession(kind: DeeplinkWallet): boolean {
  return hasSession(readStore()[kind]);
}

/** Real link. Must be opened from a tap so the phone can switch to the wallet app. */
export function deeplinkConnectHref(kind: DeeplinkWallet): string {
  assertHttps();
  if (deeplinkHasSession(kind)) {
    throw new Error(`Sign in with ${deeplinkWalletName(kind)} instead.`);
  }
  armWalletHostTab();
  const record = ensureConnectRecord(kind);
  return connectUrl(kind, record.dappPublicKey);
}

/** Fetch a login nonce, then build the signMessage link. Call before the tap. */
export async function deeplinkSignHref(kind: DeeplinkWallet): Promise<string> {
  assertHttps();
  const before = readStore()[kind];
  if (!hasSession(before)) {
    throw new Error(`Connect ${deeplinkWalletName(kind)} again.`);
  }
  const { nonce, message } = await fetchAuthNonce(before.walletPublicKey);
  const store = readStore();
  const record = store[kind];
  if (
    !hasSession(record) ||
    record.session !== before.session ||
    record.dappSecretKey !== before.dappSecretKey
  ) {
    throw new Error(`Connect ${deeplinkWalletName(kind)} again.`);
  }
  record.loginNonce = nonce;
  record.phase = "sign";
  record.updatedAt = Date.now();
  writeStore(store);
  armWalletHostTab();
  return signUrl(kind, record, message);
}

/** Drop saved Phantom and Solflare sessions so the next tap connects again. */
export function clearDeeplinkSessions() {
  writeStore({});
}

/** Remember which app the user just opened, in case the return URL drops dt_wallet. */
export function markDeeplinkActive(kind: DeeplinkWallet) {
  armWalletHostTab();
  const store = readStore();
  store.active = kind;
  writeStore(store);
}

/**
 * This tab should receive the wallet return. Android Chrome is asked to reuse
 * it. If a new tab opens anyway, that tab hands the result back here.
 */
export function armWalletHostTab() {
  try {
    sessionStorage.setItem(HOST_KEY, "1");
  } catch {
    /* private mode */
  }
  ensureHandoffListener();
}

export function isWalletHostTab(): boolean {
  try {
    return sessionStorage.getItem(HOST_KEY) === "1";
  } catch {
    return false;
  }
}

export function onWalletDeeplinkHandoff(
  handler: (resume: DeeplinkResume) => void,
): () => void {
  handoffHandlers.add(handler);
  ensureHandoffListener();
  return () => handoffHandlers.delete(handler);
}

export function hasWalletDeeplinkCallback(): boolean {
  return readCallbackParams() != null;
}

/**
 * Read a Phantom or Solflare return, then strip those query params.
 * Connect returns here for a second tap. Sign returns here logged in.
 */
export async function consumeWalletDeeplinkReturn(): Promise<DeeplinkResume | null> {
  const params = readCallbackParams();
  if (!params) return null;
  // Only Android can close the extra tab. On iOS the visible tab must finish
  // the login, because iOS will not switch back to the original one.
  if (shouldHandOffWalletReturn()) {
    const handed = await handoffToHostTab(params);
    if (handed) {
      stripCallbackParams();
      return { type: "handed-off" };
    }
  }
  stripCallbackParams();
  try {
    return await handleCallback(params);
  } catch (err) {
    return { type: "error", message: loginErrorMessage(err) };
  }
}

function assertHttps() {
  if (!walletReturnIsHttps()) {
    throw new Error(
      "Open https://play.deadtiles.com in this browser to sign in with a wallet.",
    );
  }
}

function connectUrl(kind: DeeplinkWallet, dappPublicKey: string): string {
  const host =
    kind === "phantom"
      ? "https://phantom.app/ul/v1/connect"
      : "https://solflare.com/ul/v1/connect";
  const params = new URLSearchParams({
    app_url: appUrl(),
    dapp_encryption_public_key: dappPublicKey,
    redirect_link: redirectLink(kind),
    cluster: "mainnet-beta",
  });
  return `${host}?${params.toString()}`;
}

function signUrl(kind: DeeplinkWallet, record: WalletRecord, message: string): string {
  const host =
    kind === "phantom"
      ? "https://phantom.app/ul/v1/signMessage"
      : "https://solflare.com/ul/v1/signMessage";
  const encrypted = encryptPayload(
    {
      session: record.session,
      message: bs58.encode(new TextEncoder().encode(message)),
      display: "utf8",
    },
    sharedSecret(record.walletEncryptionPublicKey, record.dappSecretKey),
  );
  const params = new URLSearchParams({
    dapp_encryption_public_key: record.dappPublicKey,
    nonce: encrypted.nonce,
    redirect_link: redirectLink(kind),
    payload: encrypted.data,
  });
  return `${host}?${params.toString()}`;
}

function appUrl(): string {
  return new URL(walletReturnUrl()).origin;
}

function redirectLink(kind: DeeplinkWallet): string {
  const url = new URL(isNativeApp() ? nativeWalletReturnUrl() : walletReturnUrl());
  url.searchParams.set("dt_wallet", kind);
  // Always https. Phantom labels the request from this address. A custom
  // scheme such as googlechromes:// makes the sheet say that scheme instead
  // of Deadtiles. The app host is app.deadtiles.com. Browsers use the site.
  return url.toString();
}

export function shouldHandOffWalletReturn(): boolean {
  return isAndroidChrome() && !isWalletHostTab();
}

function isAndroidChrome(): boolean {
  const ua = navigator.userAgent || "";
  if (!/Android/i.test(ua)) return false;
  if (/\bwv\b|EdgA|OPR\/|SamsungBrowser|Firefox|UCBrowser/i.test(ua)) return false;
  return /Chrome\/\d+/i.test(ua);
}

const handoffHandlers = new Set<(resume: DeeplinkResume) => void>();
const seenHandoffs = new Set<string>();
let handoffListening = false;

function ensureHandoffListener() {
  if (handoffListening || typeof window === "undefined") return;
  handoffListening = true;
  window.addEventListener("storage", (event) => {
    if (event.key !== RETURN_KEY || !event.newValue) return;
    const message = readHandoffRecord(event.newValue);
    if (message) void acceptHandoff(message.id, message.payload);
  });
  // The original tab is often frozen until Phantom returns. Pick up a return
  // that arrived while this tab could not run.
  window.addEventListener("pageshow", () => {
    void drainPendingHandoff();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void drainPendingHandoff();
  });
  try {
    const channel = new BroadcastChannel(HANDOFF_CHANNEL);
    channel.onmessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; id?: string; payload?: string } | null;
      if (data?.type === "return" && data.id && typeof data.payload === "string") {
        void acceptHandoff(data.id, data.payload);
      }
    };
  } catch {
    /* BroadcastChannel unavailable */
  }
}

async function drainPendingHandoff() {
  if (!isWalletHostTab()) return;
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(RETURN_KEY);
  } catch {
    return;
  }
  if (!raw) return;
  const message = readHandoffRecord(raw);
  if (!message) return;
  const claim = readClaim();
  if (claim === `${message.id}:host` || claim === `${message.id}:child`) return;
  await acceptHandoff(message.id, message.payload);
}

async function acceptHandoff(id: string, payload: string) {
  if (!isWalletHostTab() || seenHandoffs.has(id)) return;
  if (readClaim() === `${id}:child`) return;
  seenHandoffs.add(id);
  writeClaim(`${id}:host`);
  if (readClaim() !== `${id}:host`) return;
  try {
    const channel = new BroadcastChannel(HANDOFF_CHANNEL);
    channel.postMessage({ type: "ack", id });
    channel.close();
  } catch {
    /* ignore */
  }
  let resume: DeeplinkResume;
  try {
    resume = await handleCallback(new URLSearchParams(payload));
  } catch (err) {
    resume = { type: "error", message: loginErrorMessage(err) };
  }
  for (const handler of handoffHandlers) handler(resume);
}

async function handoffToHostTab(params: URLSearchParams): Promise<boolean> {
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const payload = params.toString();
  try {
    localStorage.setItem(RETURN_KEY, JSON.stringify({ id, payload }));
  } catch {
    return false;
  }
  try {
    const channel = new BroadcastChannel(HANDOFF_CHANNEL);
    channel.postMessage({ type: "return", id, payload });
    channel.close();
  } catch {
    /* storage event is the backup */
  }
  // Do not close this tab yet. Android freezes the original tab while Phantom
  // is open, so it can only take the result once it is on screen again.
  const started = Date.now();
  while (Date.now() - started < HANDOFF_WAIT_MS) {
    if (readClaim() === `${id}:host`) {
      tryCloseTab();
      return true;
    }
    await sleep(50);
  }
  if (readClaim() === `${id}:host`) {
    tryCloseTab();
    return true;
  }
  writeClaim(`${id}:child`);
  if (readClaim() !== `${id}:child`) {
    tryCloseTab();
    return true;
  }
  return false;
}

function readHandoffRecord(raw: string): { id: string; payload: string } | null {
  try {
    const parsed = JSON.parse(raw) as { id?: unknown; payload?: unknown };
    if (typeof parsed.id !== "string" || typeof parsed.payload !== "string") return null;
    return { id: parsed.id, payload: parsed.payload };
  } catch {
    return null;
  }
}

function readClaim(): string | null {
  try {
    return localStorage.getItem(CLAIM_KEY);
  } catch {
    return null;
  }
}

function writeClaim(value: string) {
  try {
    localStorage.setItem(CLAIM_KEY, value);
  } catch {
    /* ignore */
  }
}

function tryCloseTab() {
  try {
    window.close();
  } catch {
    /* Chrome only allows this for tabs a script opened. */
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function ensureConnectRecord(kind: DeeplinkWallet): WalletRecord {
  const store = readStore();
  const existing = store[kind];
  if (
    existing &&
    !existing.session &&
    existing.phase === "connect" &&
    existing.dappPublicKey &&
    existing.dappSecretKey &&
    Date.now() - existing.updatedAt < CONNECT_KEY_REUSE_MS
  ) {
    existing.updatedAt = Date.now();
    writeStore(store);
    return existing;
  }
  let pair: nacl.BoxKeyPair;
  try {
    pair = nacl.box.keyPair();
  } catch {
    throw new Error(
      "This browser could not prepare a secure wallet connection. Try again.",
    );
  }
  const record: WalletRecord = {
    dappPublicKey: bs58.encode(pair.publicKey),
    dappSecretKey: bs58.encode(pair.secretKey),
    phase: "connect",
    updatedAt: Date.now(),
  };
  store[kind] = record;
  writeStore(store);
  return record;
}

async function handleCallback(params: URLSearchParams): Promise<DeeplinkResume> {
  const kind = kindFromParams(params);
  if (!kind) {
    return {
      type: "error",
      message: "Wallet sign-in expired. Tap Connect wallet again.",
    };
  }
  const store = readStore();
  const record = store[kind];
  if (!record?.dappSecretKey) {
    return {
      type: "error",
      message: "Wallet sign-in expired. Tap Connect wallet again.",
    };
  }

  if (params.get("errorCode")) {
    const expiredSession =
      record.phase === "sign" &&
      /session|expired|invalid/i.test(params.get("errorMessage") ?? "");
    if (expiredSession) clearSession(record);
    else if (record.phase === "connect") {
      record.phase = "ready";
      record.updatedAt = 0;
    } else {
      record.phase = "ready";
      record.loginNonce = undefined;
    }
    writeStore(store);
    return {
      type: "error",
      message: expiredSession
        ? `That ${deeplinkWalletName(kind)} session expired. Tap Connect wallet and approve the connection again.`
        : declinedMessage(params),
    };
  }

  const data = params.get("data");
  const boxNonce = params.get("nonce");
  if (!data || !boxNonce) {
    return {
      type: "error",
      message: "Could not read the wallet response. Try Connect wallet again.",
    };
  }

  const encryptionPublicKey = encryptionKeyFromParams(params, kind);
  if (record.phase === "sign" && record.loginNonce && hasSession(record)) {
    const signed = finishSignReturn(store, record, data, boxNonce);
    if (signed) return signed;
    if (!encryptionPublicKey) {
      clearSession(record);
      writeStore(store);
      return {
        type: "error",
        message: "Could not read the wallet response. Tap Connect wallet again.",
      };
    }
  }

  if (encryptionPublicKey) {
    return finishConnectReturn(store, record, kind, data, boxNonce, encryptionPublicKey);
  }

  return {
    type: "error",
    message: "Wallet sign-in expired. Tap Connect wallet again.",
  };
}

function finishSignReturn(
  store: DeeplinkStore,
  record: WalletRecord,
  data: string,
  boxNonce: string,
): Promise<DeeplinkResume> | null {
  if (!hasSession(record) || !record.loginNonce) return null;
  let payload: Record<string, unknown>;
  try {
    payload = openBox(
      data,
      boxNonce,
      sharedSecret(record.walletEncryptionPublicKey, record.dappSecretKey),
    );
  } catch {
    return null;
  }
  const signature = payload.signature;
  if (typeof signature !== "string" || !isSignature(signature)) {
    return Promise.resolve({
      type: "error",
      message: "Wallet returned an unexpected signature. Try Connect wallet again.",
    });
  }
  const wallet = record.walletPublicKey;
  const loginNonce = record.loginNonce;
  record.loginNonce = undefined;
  record.phase = "ready";
  writeStore(store);
  return completeSignedLogin(wallet, loginNonce, signature).then((session) => ({
    type: "session" as const,
    session,
  }));
}

function finishConnectReturn(
  store: DeeplinkStore,
  record: WalletRecord,
  kind: DeeplinkWallet,
  data: string,
  boxNonce: string,
  encryptionPublicKey: string,
): DeeplinkResume {
  let payload: Record<string, unknown>;
  try {
    payload = openBox(
      data,
      boxNonce,
      sharedSecret(encryptionPublicKey, record.dappSecretKey),
    );
  } catch (err) {
    record.phase = "ready";
    record.updatedAt = 0;
    writeStore(store);
    throw err;
  }
  const publicKey = payload.public_key;
  const session = payload.session;
  if (!isPubkey(publicKey) || typeof session !== "string" || !session) {
    throw new Error("Could not read the wallet response. Try Connect wallet again.");
  }
  record.walletEncryptionPublicKey = encryptionPublicKey;
  record.walletPublicKey = publicKey;
  record.session = session;
  record.loginNonce = undefined;
  record.phase = "ready";
  record.updatedAt = Date.now();
  writeStore(store);
  return { type: "needs-sign", kind };
}

function kindFromParams(params: URLSearchParams): DeeplinkWallet | null {
  if (params.get("phantom_encryption_public_key") && !params.get("solflare_encryption_public_key")) {
    return "phantom";
  }
  if (params.get("solflare_encryption_public_key")) return "solflare";
  const hinted = params.get("dt_wallet");
  if (hinted === "phantom" || hinted === "solflare") return hinted;
  const active = readStore().active;
  return active === "phantom" || active === "solflare" ? active : null;
}

function encryptionKeyFromParams(
  params: URLSearchParams,
  kind: DeeplinkWallet,
): string | null {
  if (kind === "phantom") return params.get("phantom_encryption_public_key");
  return (
    params.get("solflare_encryption_public_key") ||
    params.get("phantom_encryption_public_key")
  );
}

function declinedMessage(params: URLSearchParams): string {
  const code = params.get("errorCode") ?? "";
  const message = (params.get("errorMessage") ?? "").replace(/\s+/g, " ").trim();
  if (code === "4001" || /reject|cancel|declin|denied/i.test(message)) {
    return "Wallet request was declined.";
  }
  if (message && message.length <= 160) return message;
  return "Wallet request was declined.";
}

function loginErrorMessage(err: unknown): string {
  if (err instanceof ApiHttpError && err.status === 401) {
    return "The login expired. Tap Connect wallet and approve the signature again.";
  }
  if (err instanceof Error && err.message.trim()) return err.message;
  return "Could not finish wallet sign-in.";
}

function hasSession(record: WalletRecord | undefined): record is WalletRecord & {
  session: string;
  walletPublicKey: string;
  walletEncryptionPublicKey: string;
} {
  return !!(
    record &&
    record.session &&
    record.walletPublicKey &&
    record.walletEncryptionPublicKey &&
    record.dappPublicKey &&
    record.dappSecretKey
  );
}

function clearSession(record: WalletRecord) {
  delete record.session;
  delete record.walletPublicKey;
  delete record.walletEncryptionPublicKey;
  delete record.loginNonce;
  record.phase = "ready";
  record.updatedAt = 0;
}

function sharedSecret(
  walletEncryptionPublicKey: string | undefined,
  dappSecretKey: string,
): Uint8Array {
  if (!walletEncryptionPublicKey) {
    throw new Error("Could not read the wallet response. Try Connect wallet again.");
  }
  try {
    return nacl.box.before(
      bs58.decode(walletEncryptionPublicKey),
      bs58.decode(dappSecretKey),
    );
  } catch {
    throw new Error("Could not read the wallet response. Try Connect wallet again.");
  }
}

function encryptPayload(
  payload: unknown,
  secret: Uint8Array,
): { nonce: string; data: string } {
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const encrypted = nacl.box.after(
    new TextEncoder().encode(JSON.stringify(payload)),
    nonce,
    secret,
  );
  return { nonce: bs58.encode(nonce), data: bs58.encode(encrypted) };
}

function openBox(
  data: string,
  nonce: string,
  secret: Uint8Array,
): Record<string, unknown> {
  let opened: Uint8Array | null;
  try {
    const nonceBytes = bs58.decode(nonce);
    if (nonceBytes.length !== nacl.box.nonceLength) {
      throw new Error("bad nonce");
    }
    opened = nacl.box.open.after(bs58.decode(data), nonceBytes, secret);
  } catch {
    throw new Error("Could not read the wallet response. Try Connect wallet again.");
  }
  if (!opened) {
    throw new Error("Could not read the wallet response. Try Connect wallet again.");
  }
  try {
    const parsed = JSON.parse(new TextDecoder().decode(opened)) as unknown;
    if (!parsed || typeof parsed !== "object") {
      throw new Error("bad payload");
    }
    return parsed as Record<string, unknown>;
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Could not read")) throw err;
    throw new Error("Could not read the wallet response. Try Connect wallet again.");
  }
}

function isPubkey(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    return bs58.decode(value).length === nacl.box.publicKeyLength;
  } catch {
    return false;
  }
}

function isSignature(value: string): boolean {
  try {
    return bs58.decode(value).length === nacl.sign.signatureLength;
  } catch {
    return false;
  }
}

function isWalletCallback(params: URLSearchParams): boolean {
  return (
    params.has("errorCode") ||
    params.has("data") ||
    params.has("phantom_encryption_public_key") ||
    params.has("solflare_encryption_public_key")
  );
}

function readCallbackParams(): URLSearchParams | null {
  if (typeof window === "undefined") return null;
  const merged = new URLSearchParams(window.location.search);
  const hash = window.location.hash.replace(/^#\??/, "");
  if (hash.includes("=")) {
    const hashParams = new URLSearchParams(hash);
    for (const [key, value] of hashParams) {
      if (!merged.has(key)) merged.set(key, value);
    }
  }
  return isWalletCallback(merged) ? merged : null;
}

function stripCallbackParams() {
  const url = new URL(window.location.href);
  for (const key of CALLBACK_KEYS) url.searchParams.delete(key);
  if (url.hash.includes("=")) {
    const hashParams = new URLSearchParams(url.hash.replace(/^#\??/, ""));
    let changed = false;
    for (const key of CALLBACK_KEYS) {
      if (hashParams.has(key)) {
        hashParams.delete(key);
        changed = true;
      }
    }
    if (changed) {
      const next = hashParams.toString();
      url.hash = next ? `#${next}` : "";
    }
  }
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
}

function readStore(): DeeplinkStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as DeeplinkStore;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed;
  } catch {
    return {};
  }
}

function writeStore(store: DeeplinkStore) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    throw new Error(
      "This browser blocked saved site data, so the wallet cannot return here. Allow site data for this page and try again.",
    );
  }
}
