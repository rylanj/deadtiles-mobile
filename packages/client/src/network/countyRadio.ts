import { PushNotifications } from "@capacitor/push-notifications";
import { isNativeApp } from "../native";
import { apiRequest } from "./api";
import { loadStoredSessionToken, serverUrl } from "./ColyseusClient";

let started = false;
let deviceToken = "";
let sessionToken = "";

async function postToken(
  path: "push-token" | "push-token/clear",
  token: string,
  bearer = sessionToken || loadStoredSessionToken() || "",
): Promise<void> {
  if (!bearer || !token) return;
  await apiRequest(`${serverUrl()}/auth/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${bearer}` },
    json: { token },
  });
}

/** Ask once, then keep this phone on the county net for the signed-in wallet. */
export function ensureCountyRadio(nextSessionToken: string): void {
  if (!isNativeApp() || !nextSessionToken) return;
  sessionToken = nextSessionToken;
  if (deviceToken) {
    void postToken("push-token", deviceToken).catch(() => undefined);
  }
  if (started) return;
  started = true;
  void listen();
}

/** Drop this phone from the net before the session is cleared. */
export function forgetCountyRadio(): void {
  const token = deviceToken;
  const bearer = sessionToken || loadStoredSessionToken() || "";
  deviceToken = "";
  sessionToken = "";
  if (!isNativeApp() || !token || !bearer) return;
  void postToken("push-token/clear", token, bearer).catch(() => undefined);
}

async function listen(): Promise<void> {
  try {
    await PushNotifications.createChannel({
      id: "ashen-net",
      name: "Ashen radio",
      description: "County radio calls",
      importance: 4,
      visibility: 1,
      vibration: true,
    });
    const perm = await PushNotifications.checkPermissions();
    const receive =
      perm.receive === "granted"
        ? perm.receive
        : (await PushNotifications.requestPermissions()).receive;
    if (receive !== "granted") {
      started = false;
      return;
    }
    await PushNotifications.addListener("registration", (event) => {
      deviceToken = event.value;
      if (!sessionToken) return;
      void postToken("push-token", event.value).catch(() => undefined);
    });
    await PushNotifications.addListener("registrationError", () => undefined);
    await PushNotifications.register();
  } catch {
    started = false;
  }
}
