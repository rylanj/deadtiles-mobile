# Dead Tiles SFX

1. Drop a file here, e.g. `gunshot.ogg` (or `.mp3`).
2. Add the matching id to `SFX_READY` in
   `packages/client/src/audio/AudioManager.ts`
   (ids are listed in `SFX_FILES`).
3. Restart the client.

Until then, gameplay calls stay silent — no 404s, no code churn elsewhere.
