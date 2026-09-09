# deadtiles

Copyright (c) 2026 rylanj

All Rights Reserved.

This software and its associated documentation files are proprietary and confidential. 

Permission is hereby GRANTED to any person obtaining a copy of this software via GitHub 
strictly to view the source code and fork the repository within the GitHub platform, 
as permitted by the GitHub Terms of Service.

Unauthorized copying, distribution, modification, public display, or commercial use 
of this software, via any medium, is strictly prohibited without the express, 
prior written permission of the copyright holder.

## Run (web)

```bash
npm install
npm run dev
```

- Client: http://localhost:5173
- Server: ws://localhost:2567

## Android APK

The phone app is a Capacitor shell that **bundles** the Vite client. Do not set `server.url` in `capacitor.config.ts` (that would load a website).

1. Install [Android Studio](https://developer.android.com/studio) (JDK + Android SDK). This machine needs that before an APK will compile.
2. Copy `packages/client/.env.example` to `packages/client/.env` and set `VITE_SERVER_URL` to a host the phone can reach (your PC LAN IP for local tests, or a hosted Colyseus URL).
3. From the repo root:

```bash
npm install
npm run apk:sync
npm run apk:open
```

4. In Android Studio, pick a device or emulator (API 24+) and Run. The game files are inside the APK; Colyseus still runs on the URL baked in at build time.

Install **Phantom**, **Solflare**, or **Seed Vault** on the device before tapping Connect wallet. The APK uses Solana Mobile Wallet Adapter (same-device intents), not browser extensions.

Phantom verifies the APK against `https://play.deadtiles.com/.well-known/assetlinks.json`. That file must be live JSON (not the SPA `index.html`) and must include this debug signing fingerprint:

`CB:0F:B1:7D:9F:07:5B:E6:F3:9F:65:36:4D:D2:A9:0D:A8:83:46:29:85:A7:54:17:BB:C0:D2:3B:54:40:0E:98`

Confirm with:

```bash
curl --fail https://play.deadtiles.com/.well-known/assetlinks.json
```

If that 404s, Phantom shows "This app's identity could not be verified." Deploy the client `public/.well-known/assetlinks.json` (or restart the Node server, which also serves that path). SPA hosts must not rewrite `/.well-known/` to `index.html`.
