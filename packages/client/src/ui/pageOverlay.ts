import { cancelAllSlotDrags } from "./slotPointerDnD";

/**
 * Dialogs are mounted on document.body, so a scene restart does not remove
 * them. A reconnect then builds a second copy while the first stays on screen.
 */
const PAGE_OVERLAY_IDS = [
  "inventory-overlay",
  "journal-overlay",
  "container-loot-overlay",
  "craft-overlay",
  "fireplace-overlay",
  "prefab-overlay",
  "deconstruct-overlay",
  "trader-overlay",
  "market-overlay",
  "red-order-dialog-overlay",
  "ashen-dialog-overlay",
  "ashen-militia-dialog-overlay",
  "map-overlay",
  "faction-attack-warning-overlay",
  "death-screen-overlay",
  "onboarding-overlay",
  "onboarding-controls-legend",
  "tutorial-stack",
  "door-code-overlay",
  "loot-popup-container",
  "weapon-hotbar",
  "damage-overlay",
  "search-progress",
  "structure-build-hud",
  "slot-drag-layer",
  "combat-lock-banner",
  "radio-caption",
];

const PAGE_BODY_CLASSES = [
  "inventory-open",
  "journal-open",
  "container-loot-open",
  "trader-open",
  "market-open",
  "red-order-dialog-open",
  "ashen-dialog-open",
  "faction-attack-warning-open",
  "death-screen-open",
  "onboarding-open",
  "onboarding-legend-open",
  "map-open",
  "craft-open",
  "fireplace-open",
  "prefab-open",
  "deconstruct-open",
  "build-mode-open",
  "chat-open",
];

/** Remove every node with this id, including duplicates left by a previous join. */
export function claimPageOverlay(id: string): void {
  if (typeof document === "undefined") return;
  document.querySelectorAll(`[id="${id}"]`).forEach((node) => node.remove());
}

/** Drop dialogs and panels left in the page after a disconnect or scene restart. */
export function clearWorldPageUi(): void {
  if (typeof document === "undefined") return;
  try {
    cancelAllSlotDrags();
  } catch {
    /* drag layer already gone */
  }
  for (const id of PAGE_OVERLAY_IDS) claimPageOverlay(id);
  document.querySelectorAll(".market-pick-list").forEach((node) => node.remove());
  document.body.classList.remove(...PAGE_BODY_CLASSES);
}
