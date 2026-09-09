import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    // MWA ships a React Native build; the APK WebView must use the browser protocol.
    conditions: ["browser", "module", "import"],
  },
  server: {
    port: 5173,
    proxy: {
      "/colyseus": {
        target: "ws://localhost:2567",
        ws: true,
        rewrite: (path) => path.replace(/^\/colyseus/, ""),
      },
    },
  },
});
