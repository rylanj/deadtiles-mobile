import { isNativeApp } from "../native";
import { sendMobileDeadmarkBuyback } from "./mobileWalletAdapter";
import { sendBrowserDeadmarkBuyback } from "./solanaWallet";
import { lastWalletId } from "./walletOptions";

/** Sign and send Kevin's unsigned buyback. Returns the base58 transaction signature. */
export async function sendDeadmarkBuyback(
  unsignedTxBase64: string,
  expectedWallet: string,
): Promise<string> {
  if (isNativeApp()) {
    const last = lastWalletId();
    const packageName = last?.startsWith("mwa:") ? last.slice(4) : null;
    return sendMobileDeadmarkBuyback(unsignedTxBase64, expectedWallet, packageName);
  }
  return sendBrowserDeadmarkBuyback(unsignedTxBase64, expectedWallet, lastWalletId());
}
