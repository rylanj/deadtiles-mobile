import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Bundled WebView app. Do not set `server.url` here.
 * That would load a remote site and count as a website wrapper.
 */
const config: CapacitorConfig = {
  appId: "com.deadtiles.app",
  appName: "Deadtiles",
  webDir: "dist",
  server: {
    androidScheme: "https",
    // Do not set hostname to play.deadtiles.com. Capacitor would treat that
    // origin as the local asset server, so /auth and Colyseus would get
    // index.html instead of the live API.
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;
