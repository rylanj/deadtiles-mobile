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

## Play

This repository is the game client and the Android app. It signs in and plays against the live county at https://play.deadtiles.com. Do not create `packages/client/.env` unless you intend to point the build at a different server.

## Run in the browser

```bash
npm install
npm run dev
```

Open http://localhost:5173. The page talks to https://play.deadtiles.com.

## Android APK

Download the current build:

https://github.com/rylanj/deadtiles-mobile/releases/download/apk/deadtiles.apk

GitHub rebuilds that file whenever `main` changes. It is signed with the debug key the live county already trusts, so Phantom can verify the install.

The phone app is a Capacitor shell that bundles the Vite client. Do not set `server.url` in `capacitor.config.ts` (that would load a website).

1. Install [Android Studio](https://developer.android.com/studio) (JDK + Android SDK).
2. Leave `packages/client/.env` unset so the APK uses https://play.deadtiles.com.
3. From the repo root:

```bash
npm install
npm run apk:sync
npm run apk:open
```

4. In Android Studio, pick a device or emulator (API 24+) and Run. The game files are inside the APK. Colyseus runs at the URL baked in at build time.

Install Phantom, Solflare, or Seed Vault on the device before tapping Connect wallet. The APK uses Solana Mobile Wallet Adapter (same-device intents), not browser extensions.

Phantom verifies the APK against `https://play.deadtiles.com/.well-known/assetlinks.json`. That file must be live JSON (not the SPA `index.html`) and must include the signing fingerprint of the installed APK. Android Studio and the GitHub Actions APK use different debug keys:

`CB:0F:B1:7D:9F:07:5B:E6:F3:9F:65:36:4D:D2:A9:0D:A8:83:46:29:85:A7:54:17:BB:C0:D2:3B:54:40:0E:98` (Android Studio)

`B7:6F:E3:CC:D2:97:BD:39:F8:71:FE:7B:43:45:DC:99:F7:D0:E5:91:D1:FB:3B:4A:93:63:B1:E6:EA:61:45:D8` (GitHub Actions)

Confirm with:

```bash
curl --fail https://play.deadtiles.com/.well-known/assetlinks.json
```

If that 404s, Phantom shows "This app's identity could not be verified." SPA hosts must not rewrite `/.well-known/` to `index.html`.
