/**
 * Fail fast when packages/shared is older than the server that imports it.
 * A leftover or partial VPS checkout compiles WorldRoom against an old tree
 * and looks like 30+ "has no exported member" errors.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sharedSrc = join(root, "packages/shared/src");
const indexPath = join(sharedSrc, "index.ts");
const requiredFiles = [
  "skillEffects.ts",
  "skills.ts",
  "quests.ts",
  "items.ts",
  "infection.ts",
  "trade.ts",
  "temperature.ts",
  "messages.ts",
];

const missing = requiredFiles.filter((name) => !existsSync(join(sharedSrc, name)));
if (missing.length > 0) {
  console.error(
    `[assert-shared] missing ${missing.map((n) => `packages/shared/src/${n}`).join(", ")}. ` +
      "The VPS tree is older than WorldRoom. Run `git pull` so commit 36d575f (skill system) is present.",
  );
  process.exit(1);
}

const indexSrc = readFileSync(indexPath, "utf8");
if (!indexSrc.includes('export * from "./skillEffects.js"')) {
  console.error(
    "[assert-shared] packages/shared/src/index.ts does not export skillEffects. " +
      "The shared package on this machine is out of date. git pull origin main.",
  );
  process.exit(1);
}

const skillEffects = readFileSync(join(sharedSrc, "skillEffects.ts"), "utf8");
for (const token of ["export const SKILL_XP", "export type PlayerSkillMods"]) {
  if (!skillEffects.includes(token)) {
    console.error(`[assert-shared] skillEffects.ts is missing ${token}. git pull origin main.`);
    process.exit(1);
  }
}

const items = readFileSync(join(sharedSrc, "items.ts"), "utf8");
if (!items.includes("wetness?: number")) {
  console.error("[assert-shared] InventoryEntry is missing wetness. git pull origin main.");
  process.exit(1);
}

const infection = readFileSync(join(sharedSrc, "infection.ts"), "utf8");
if (!infection.includes("tickUp: number") || !infection.includes("chance: number")) {
  console.error(
    "[assert-shared] infection.ts is missing skill-system args. git pull origin main.",
  );
  process.exit(1);
}

const trade = readFileSync(join(sharedSrc, "trade.ts"), "utf8");
if (!trade.includes("barterT")) {
  console.error("[assert-shared] applyTradeOffer is missing barterT. git pull origin main.");
  process.exit(1);
}

const quests = readFileSync(join(sharedSrc, "quests.ts"), "utf8");
if (!quests.includes("export function acceptQuest")) {
  console.error("[assert-shared] quests.ts is missing acceptQuest. git pull origin main.");
  process.exit(1);
}
