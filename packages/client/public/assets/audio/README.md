# Dead Tiles audio

Each sound is a pair:

- `Name.m4a` is AAC. Chrome, Edge, Safari, and the Android app play this.
- `Name.ogg` is Vorbis. Browsers that cannot play AAC, including some Firefox installs, play this.

The loader asks for the `.m4a` path and also queues the `.ogg` file with the same name. Phaser downloads whichever format that device can play.

To add a sound, drop both files under this folder, point the code at the `.m4a` path, and add the id to `SFX_READY` in `AudioManager.ts` if nothing else loads it. Missing files stay silent.
