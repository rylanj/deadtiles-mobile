/**
 * First-session onboarding step ids + copy.
 */

export const ONBOARDING_STEP_IDS = [
  "wake",
  "move",
  "sprint",
  "aim_fire",
  "reload",
  "search",
  "inventory",
  "map",
  "exit_hospital",
] as const;

export type OnboardingStepId = (typeof ONBOARDING_STEP_IDS)[number];

export type OnboardingStepDef = {
  id: OnboardingStepId;
  title: string;
  body: string;
};

export const ONBOARDING_STEPS: readonly OnboardingStepDef[] = [
  {
    id: "wake",
    title: "Wake up",
    body: "You're in Birchport Hospital. Ashen Militia are watching the ward — don't point a gun at them.",
  },
  {
    id: "move",
    title: "Move",
    body: "Click the ground or use WASD / arrow keys to walk.",
  },
  {
    id: "sprint",
    title: "Sprint",
    body: "Double-click a destination (or hold Shift while moving) to sprint. Sprinting drains stamina.",
  },
  {
    id: "aim_fire",
    title: "Aim & fire",
    body: "Hold CTRL to aim a firearm, then click to fire toward your cursor. Shots stop at the first body or solid cover in the way.",
  },
  {
    id: "reload",
    title: "Reload",
    body: "Press R to reload a firearm when you have spare ammo.",
  },
  {
    id: "search",
    title: "Search",
    body: "Walk up to furniture and press E to search for supplies.",
  },
  {
    id: "inventory",
    title: "Inventory",
    body: "Press Tab to open your inventory. Drag items between slots; equip weapons from the hotbar (1 / 2).",
  },
  {
    id: "map",
    title: "Map",
    body: "Press M to open the map (you start with a Map in the Map slot).",
  },
  {
    id: "exit_hospital",
    title: "Leave the ward",
    body: "Find the hospital exit when you're ready. Birchport streets have militia patrols — fighting players or guards here turns the whole garrison hostile.",
  },
] as const;

export const ONBOARDING_CONTROLS_LEGEND = [
  { key: "Click / WASD", action: "Move" },
  { key: "Double-click", action: "Sprint" },
  { key: "CTRL", action: "Aim" },
  { key: "Click (aimed)", action: "Fire" },
  { key: "R", action: "Reload" },
  { key: "E", action: "Search / interact" },
  { key: "Tab", action: "Inventory" },
  { key: "M", action: "Map" },
  { key: "1 / 2", action: "Weapon hotbar" },
  { key: "B", action: "Build (hammer)" },
  { key: "Enter", action: "Chat" },
  { key: "Esc", action: "Close / controls" },
] as const;
