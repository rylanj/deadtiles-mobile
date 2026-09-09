import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Bundled WebView app. Do not set `server.url` here.
 * That would load a remote site and count as a website wrapper.
 */
const config: CapacitorConfig = {
  appId: "com.deadtiles.game",
  appName: "Deadtiles",
  webDir: "dist",
  server: {
    androidScheme: "https",
    // LAN Colyseus over HTTP while iterating. Use HTTPS in production builds.
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;
