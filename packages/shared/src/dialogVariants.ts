/**
 * Pick a dialog reply variant with a stable hash of `seed`.
 * Same NPC + line id → same wording every time; different NPCs diverge.
 */
export function pickDialogVariant(
  variants: readonly string[],
  seed: string,
): string {
  if (variants.length === 0) return "";
  if (variants.length === 1) return variants[0]!;
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return variants[(h >>> 0) % variants.length]!;
}
