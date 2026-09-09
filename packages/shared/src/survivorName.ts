/** Survivor display-name rules for Deatiles. */

export const SURVIVOR_NAME_MIN = 2;
export const SURVIVOR_NAME_MAX = 30;

/** Letters and spaces only; length 2–30 after trim/collapse. */
const SURVIVOR_NAME_RE = /^[A-Za-z ]+$/;

/**
 * Normalize and validate a survivor name.
 * Returns the canonical name, or null if invalid.
 */
export function normalizeSurvivorName(raw: string): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.trim().replace(/\s+/g, " ");
  if (name.length < SURVIVOR_NAME_MIN || name.length > SURVIVOR_NAME_MAX) {
    return null;
  }
  if (!SURVIVOR_NAME_RE.test(name)) return null;
  return name;
}

export function survivorNameValidationError(raw: string): string | null {
  if (typeof raw !== "string" || !raw.trim()) {
    return "Enter a survivor name";
  }
  const collapsed = raw.trim().replace(/\s+/g, " ");
  if (collapsed.length < SURVIVOR_NAME_MIN) {
    return `Name must be at least ${SURVIVOR_NAME_MIN} characters`;
  }
  if (collapsed.length > SURVIVOR_NAME_MAX) {
    return `Name must be at most ${SURVIVOR_NAME_MAX} characters`;
  }
  if (!SURVIVOR_NAME_RE.test(collapsed)) {
    return "Name may only contain letters and spaces";
  }
  return null;
}
