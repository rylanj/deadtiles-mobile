/**
 * Skill XP events and linear 0–100 bonuses.
 * Hot paths should cache PlayerSkillMods and never parse skillsJson per tick.
 */

import { ASHEN_MILITIA_DOCTOR_HEAL_COST } from "./ashenMilitia.js";
import {
  PREFAB_BUILD_DURATION_MS,
  PREFAB_BUILD_HAMMER_WEAR,
  STRUCTURE_DECONSTRUCT_DURATION_MS,
} from "./buildCosts.js";
import { RELOAD_DURATION_MS } from "./combat.js";
import {
  PLAYER_SPEED,
  STAMINA_MAX,
  ZOMBIE_AGGRO_RANGE,
} from "./constants.js";
import { craftRecipeDurationMs, type CraftRecipe } from "./crafting.js";
import { ANTIBIOTIC_DURATION_MS, ZOMBIE_INFECTION_CHANCE } from "./infection.js";
import { SEARCH_DURATION_MS } from "./interior.js";
import { BASE_INVENTORY_SLOTS } from "./items.js";
import {
  awardSubSkillXp,
  effectiveSubLevel,
  parentOfSub,
  parseSkillsJson,
  SKILL_LEVEL_MAX,
  SUB_SKILL_LABELS,
  PARENT_SKILL_LABELS,
  type ParentSkillId,
  type PlayerSkillsState,
  type SubSkillId,
} from "./skills.js";

export const TREE_CHOP_SWINGS_BASE = 10;
export const TREE_CHOP_SWINGS_MIN = 6;
export const HARVEST_WOOD_MIN_BASE = 2;
export const HARVEST_WOOD_MAX_BASE = 4;
export const HARVEST_WOOD_MIN_MAX = 3;
export const HARVEST_WOOD_MAX_MAX = 6;

/** XP granted per completed action. Tune here, not at call sites. */
export const SKILL_XP = {
  meleeHit: 6,
  meleeKill: 14,
  gunFire: 1,
  gunHit: 4,
  gunKill: 10,
  treeFell: 18,
  craft: 12,
  search: 8,
  build: 20,
  deconstruct: 12,
  tradeMin: 6,
  tradeMax: 36,
  questAccept: 8,
  questTurnIn: 16,
  medicalUse: 10,
  doctorHeal: 14,
  eatFood: 6,
  infectionResist: 4,
  infectionCure: 20,
  carryingPickup: 2,
  stealthAction: 10,
  fitnessWalkTiles: 8,
  fitnessWalk: 4,
  fitnessSprintTiles: 4,
  fitnessSprint: 5,
  recoveryHealHp: 5,
  recoveryHeal: 3,
} as const;

export const SUB_SKILL_BENEFIT: Record<SubSkillId, string> = {
  melee: "Melee hits deal more damage.",
  harvesting: "Trees fall in fewer swings and drop more wood.",
  carrying: "Unlock extra pocket slots at 25 / 50 / 75 / 100.",
  construction: "Build and deconstruct faster, with a better material refund.",
  fitness: "More stamina, slower sprint drain, slightly faster walk.",
  immunity: "Zombie bites infect less often and infection climbs slower.",
  recovery:
    "Bandage HoT and fire warmth heal more. Hunger and thirst drain slower.",
  accuracy: "Guns miss less, spray tighter, and reload faster.",
  crafting: "Workbench recipes finish faster.",
  scavenging: "Searches finish faster and containers roll loot more often.",
  stealth: "Zombies notice you from closer, and your gunshots carry less.",
  cooking: "Food restores more hunger and thirst.",
  medicine:
    "Meds heal more. Antibiotics last longer. Doctor Clark costs less.",
  reading: "Not trainable yet. Find books to study later.",
  bartering: "Ashen Traders charge less and pay more, on top of standing.",
  persuasion: "Turned-in jobs pay more notes and reputation.",
  leadership: "Not trainable yet. Lead other survivors later.",
};

export type PlayerSkillMods = {
  json: string;
  meleeDamageScale: number;
  harvestSwings: number;
  harvestWoodMin: number;
  harvestWoodMax: number;
  extraPockets: number;
  buildDurationMs: number;
  deconstructDurationMs: number;
  hammerWear: number;
  deconstructRefundScale: number;
  staminaMax: number;
  staminaDrainScale: number;
  walkSpeed: number;
  infectionChance: number;
  infectionTickUp: number;
  healScale: number;
  hungerDrainScale: number;
  missScale: number;
  spreadScale: number;
  reloadMs: number;
  craftDurationScale: number;
  searchDurationMs: number;
  lootChanceScale: number;
  stealthAggroRange: number;
  gunshotNoiseScale: number;
  foodRestoreScale: number;
  medicineHealScale: number;
  antibioticDurationMs: number;
  doctorHealCost: number;
  barterT: number;
  questRewardScale: number;
  questRepScale: number;
  carryingLevel: number;
};

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n <= 0) return 0;
  if (n >= 1) return 1;
  return n;
}

export function skillT(state: PlayerSkillsState, subId: SubSkillId): number {
  return clamp01(effectiveSubLevel(state, subId) / SKILL_LEVEL_MAX);
}

export function lerpSkill(
  state: PlayerSkillsState,
  subId: SubSkillId,
  at0: number,
  at100: number,
): number {
  const t = skillT(state, subId);
  return at0 + (at100 - at0) * t;
}

export function extraPocketSlotsForCarrying(level: number): number {
  if (level >= 100) return 4;
  if (level >= 75) return 3;
  if (level >= 50) return 2;
  if (level >= 25) return 1;
  return 0;
}

export function inventorySlotCountForCarrying(level: number): number {
  return BASE_INVENTORY_SLOTS + extraPocketSlotsForCarrying(level);
}

export function computePlayerSkillMods(
  skillsJson: string | null | undefined,
): PlayerSkillMods {
  const json = typeof skillsJson === "string" ? skillsJson : "";
  const state = parseSkillsJson(json);
  const carryingLevel = effectiveSubLevel(state, "carrying");
  return {
    json,
    meleeDamageScale: lerpSkill(state, "melee", 1, 1.35),
    harvestSwings: Math.round(
      lerpSkill(state, "harvesting", TREE_CHOP_SWINGS_BASE, TREE_CHOP_SWINGS_MIN),
    ),
    harvestWoodMin: Math.round(
      lerpSkill(state, "harvesting", HARVEST_WOOD_MIN_BASE, HARVEST_WOOD_MIN_MAX),
    ),
    harvestWoodMax: Math.round(
      lerpSkill(state, "harvesting", HARVEST_WOOD_MAX_BASE, HARVEST_WOOD_MAX_MAX),
    ),
    extraPockets: extraPocketSlotsForCarrying(carryingLevel),
    buildDurationMs: Math.round(
      lerpSkill(
        state,
        "construction",
        PREFAB_BUILD_DURATION_MS,
        PREFAB_BUILD_DURATION_MS * 0.5,
      ),
    ),
    deconstructDurationMs: Math.round(
      lerpSkill(
        state,
        "construction",
        STRUCTURE_DECONSTRUCT_DURATION_MS,
        STRUCTURE_DECONSTRUCT_DURATION_MS * 0.5,
      ),
    ),
    hammerWear: Math.max(
      1,
      Math.round(lerpSkill(state, "construction", PREFAB_BUILD_HAMMER_WEAR, 5)),
    ),
    deconstructRefundScale: lerpSkill(state, "construction", 0.5, 0.7),
    staminaMax: lerpSkill(state, "fitness", STAMINA_MAX, 90),
    staminaDrainScale: lerpSkill(state, "fitness", 1, 0.7),
    walkSpeed: lerpSkill(state, "fitness", PLAYER_SPEED, PLAYER_SPEED * 1.1),
    infectionChance: lerpSkill(state, "immunity", ZOMBIE_INFECTION_CHANCE, 0.03),
    infectionTickUp: lerpSkill(state, "immunity", 1, 0.5),
    healScale: lerpSkill(state, "recovery", 1, 1.5),
    hungerDrainScale: lerpSkill(state, "recovery", 1, 0.85),
    missScale: lerpSkill(state, "accuracy", 1, 0.5),
    spreadScale: lerpSkill(state, "accuracy", 1, 0.6),
    reloadMs: Math.round(lerpSkill(state, "accuracy", RELOAD_DURATION_MS, 2000)),
    craftDurationScale: lerpSkill(state, "crafting", 1, 0.5),
    searchDurationMs: Math.round(
      lerpSkill(state, "scavenging", SEARCH_DURATION_MS, SEARCH_DURATION_MS * 0.5),
    ),
    lootChanceScale: lerpSkill(state, "scavenging", 1, 1.45),
    stealthAggroRange: lerpSkill(state, "stealth", ZOMBIE_AGGRO_RANGE, 8),
    gunshotNoiseScale: lerpSkill(state, "stealth", 1, 0.7),
    foodRestoreScale: lerpSkill(state, "cooking", 1, 1.4),
    medicineHealScale: lerpSkill(state, "medicine", 1, 1.4),
    antibioticDurationMs: Math.round(
      lerpSkill(state, "medicine", ANTIBIOTIC_DURATION_MS, ANTIBIOTIC_DURATION_MS * 0.6),
    ),
    doctorHealCost: Math.max(
      20,
      Math.round(lerpSkill(state, "medicine", ASHEN_MILITIA_DOCTOR_HEAL_COST, 30)),
    ),
    barterT: skillT(state, "bartering"),
    questRewardScale: lerpSkill(state, "persuasion", 1, 1.25),
    questRepScale: lerpSkill(state, "persuasion", 1, 1.2),
    carryingLevel,
  };
}

export function craftDurationForSkill(
  recipe: CraftRecipe,
  craftDurationScale: number,
): number {
  return Math.max(
    1,
    Math.round(craftRecipeDurationMs(recipe) * craftDurationScale),
  );
}

export function barterAdjustedRates(
  buyRate: number,
  sellRate: number,
  barterT: number,
): { buyRate: number; sellRate: number } {
  const t = clamp01(barterT);
  return {
    buyRate: Math.max(0.65, buyRate * (1 - 0.15 * t)),
    sellRate: Math.min(0.5, sellRate * (1 + 0.15 * t)),
  };
}

export function tradeXpForCash(buyTotal: number, sellTotal: number): number {
  const volume = Math.max(0, buyTotal) + Math.max(0, sellTotal);
  return Math.max(
    SKILL_XP.tradeMin,
    Math.min(SKILL_XP.tradeMax, SKILL_XP.tradeMin + Math.floor(volume * 0.05)),
  );
}

export function scaledQuestBanknotes(base: number, scale: number): number {
  return Math.max(1, Math.round(Math.max(0, base) * scale));
}

export function scaledQuestRep(base: number, scale: number): number {
  const next = Math.max(0, base) * scale;
  return Math.round(next * 10) / 10;
}

export type SkillGrantResult = {
  json: string;
  subId: SubSkillId;
  subLeveledTo: number | null;
  parentId: ParentSkillId | null;
  parentLeveledTo: number | null;
};

export function grantSkillXp(
  json: string,
  subId: SubSkillId,
  amount: number,
): SkillGrantResult {
  const parentId = parentOfSub(subId);
  if (!parentId || !(amount > 0)) {
    return {
      json,
      subId,
      subLeveledTo: null,
      parentId,
      parentLeveledTo: null,
    };
  }
  const before = parseSkillsJson(json);
  const after = awardSubSkillXp(before, subId, amount);
  const prevSub = effectiveSubLevel(before, subId);
  const nextSub = effectiveSubLevel(after, subId);
  const prevParent = before[parentId]?.level ?? 0;
  const nextParent = after[parentId]?.level ?? 0;
  return {
    json: JSON.stringify(after),
    subId,
    subLeveledTo: nextSub > prevSub ? nextSub : null,
    parentId,
    parentLeveledTo: nextParent > prevParent ? nextParent : null,
  };
}

export function skillLevelUpLabel(subId: SubSkillId, _level: number): string {
  return SUB_SKILL_LABELS[subId];
}

export function skillParentLevelUpLabel(
  parentId: ParentSkillId,
  _level: number,
): string {
  return PARENT_SKILL_LABELS[parentId];
}
