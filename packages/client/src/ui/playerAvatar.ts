import { PLAYER_SKIN_DEFAULT } from "@zombie/shared";

/** PlayerMan1–3 clothing variants. */
export const PLAYER_AVATAR_SKIN_COUNT = 3;

/** UI portrait path for a PlayerMan skin (default PlayerMan1). */
export function playerAvatarSrc(skin: number = PLAYER_SKIN_DEFAULT): string {
  const s = Math.max(1, Math.min(PLAYER_AVATAR_SKIN_COUNT, Math.floor(skin) || PLAYER_SKIN_DEFAULT));
  return `/assets/UI/PlayerMan${s}/PlayerMan${s}_Avatar.png`;
}
