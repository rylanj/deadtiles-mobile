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
import { CRAFT_DURATION_MS } from "./crafting.js";
import {
  ANTIBIOTIC_DURATION_MAX_MS,
  ANTIBIOTIC_DURATION_MS,
  ZOMBIE_INFECTION_CHANCE,
} from "./infection.js";
import { SEARCH_DURATION_MS } from "./interior.js";
import { BASE_INVENTORY_SLOTS, MAGAZINE_READ_MS } from "./items.js";
import {
  LOCKPICK_CONSUME_AT_0,
  LOCKPICK_CONSUME_AT_100,
  LOCKPICK_DURATION_AT_0_MS,
  LOCKPICK_DURATION_AT_100_MS,
  LOCKPICK_NOISE_AT_0,
  LOCKPICK_NOISE_AT_100,
} from "./lockpick.js";
import {
  awardSubSkillXp,
  buffedSubSkillLevel,
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
/** Wood per felled tree. Harvesting does not change this. */
export const HARVEST_WOOD_MIN_BASE = 2;
export const HARVEST_WOOD_MAX_BASE = 4;
/** Unenforced until carry weight is implemented. Level 0 to 100. */
export const CARRY_WEIGHT_KG_BASE = 16;
export const CARRY_WEIGHT_KG_MAX = 32;

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
  /** Reading XP from finishing a skill magazine, before the Reading bonus. */
  readMagazine: 200,
  /** Cover-skill XP from finishing a skill magazine, before the Reading bonus. */
  readMagazineSkill: 500,
  /** XP each extra skill on a magazine receives, before the Reading bonus. */
  readMagazineBonus: 250,
  /** Reading XP from finishing a crafting recipe. */
  readCraft: 12,
  /** Reading XP from learning a weapon blueprint. */
  readBlueprint: 200,
  /** Lockpicking XP from opening a lock. */
  lockpick: 20,
} as const;

export const SUB_SKILL_BENEFIT: Record<SubSkillId, readonly string[]> = {
  melee: ["Increases melee damage"],
  harvesting: ["Trees fall in fewer swings"],
  carrying: ["Maximum carry weight increases"],
  construction: ["Building takes less time, tools wear less, and more materials are refunded"],
  fitness: ["Maximum stamina increases"],
  immunity: ["Infection chance reduces and infection rises slower"],
  recovery: ["Hunger and thirst drain slower and healing effects increase"],
  accuracy: ["Bullet spread reduces"],
  crafting: ["Crafting time reduces"],
  scavenging: ["Searching time reduces"],
  stealth: ["Zombies do not notice you as easily"],
  cooking: ["Food and drink restore more"],
  lockpicking: ["Picking a lock takes less time, lockpicks break less often, can pick harder locks"],
  medicine: ["Medicine is more effective and lasts longer"],
  reading: ["Magazine XP increases and reading time reduces"],
  bartering: ["Buy and sell prices improve"],
  persuasion: ["Rewards from quests increase"],
};

export type PlayerSkillMods = {
  json: string;
  meleeDamageScale: number;
  harvestSwings: number;
  harvestWoodMin: number;
  harvestWoodMax: number;
  extraPockets: number;
  /** Planned carry limit in kg. Not enforced yet. */
  maxCarryKg: number;
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
  /** Time to finish picking a lock. */
  lockpickDurationMs: number;
  /** Chance a finished pick spends one lockpick use. */
  lockpickConsumeChance: number;
  /** Tiles that hear a lock being picked. */
  lockpickNoiseTiles: number;
  /** Effective lockpicking level (capped by Dexterity). */
  lockpickLevel: number;
  stealthAggroRange: number;
  gunshotNoiseScale: number;
  foodRestoreScale: number;
  medicineHealScale: number;
  /** Multiplier on XP granted by a finished skill magazine. */
  magazineXpScale: number;
  /** Time to read a skill magazine. */
  magazineReadMs: number;
  antibioticDurationMs: number;
  doctorHealCost: number;
  barterT: number;
  questRewardScale: number;
  questRepScale: number;
  carryingLevel: number;
  /** Temporary Bartering and Persuasion XP from worn jewelry. 0 when bare. */
  jewelrySkillXp: number;
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

/** Carrying used to unlock pockets. It no longer does. */
export function extraPocketSlotsForCarrying(_level: number): number {
  return 0;
}

export function inventorySlotCountForCarrying(level: number): number {
  return BASE_INVENTORY_SLOTS + extraPocketSlotsForCarrying(level);
}

function lerpLevel(level: number, at0: number, at100: number): number {
  const t = clamp01(level / SKILL_LEVEL_MAX);
  return at0 + (at100 - at0) * t;
}

export function computePlayerSkillMods(
  skillsJson: string | null | undefined,
  jewelrySkillXp = 0,
): PlayerSkillMods {
  const json = typeof skillsJson === "string" ? skillsJson : "";
  const state = parseSkillsJson(json);
  const carryingLevel = effectiveSubLevel(state, "carrying");
  const bonus = Math.max(0, Math.floor(jewelrySkillXp) || 0);
  const barterLevel = buffedSubSkillLevel(state, "bartering", bonus);
  const persuasionLevel = buffedSubSkillLevel(state, "persuasion", bonus);
  return {
    json,
    meleeDamageScale: lerpSkill(state, "melee", 1, 1.2),
    harvestSwings: Math.round(
      lerpSkill(state, "harvesting", TREE_CHOP_SWINGS_BASE, TREE_CHOP_SWINGS_MIN),
    ),
    harvestWoodMin: HARVEST_WOOD_MIN_BASE,
    harvestWoodMax: HARVEST_WOOD_MAX_BASE,
    extraPockets: extraPocketSlotsForCarrying(carryingLevel),
    maxCarryKg: lerpSkill(
      state,
      "carrying",
      CARRY_WEIGHT_KG_BASE,
      CARRY_WEIGHT_KG_MAX,
    ),
    buildDurationMs: Math.round(
      lerpSkill(state, "construction", PREFAB_BUILD_DURATION_MS, 20_000),
    ),
    deconstructDurationMs: Math.round(
      lerpSkill(state, "construction", STRUCTURE_DECONSTRUCT_DURATION_MS, 20_000),
    ),
    hammerWear: Math.max(
      1,
      Math.round(lerpSkill(state, "construction", PREFAB_BUILD_HAMMER_WEAR, 5)),
    ),
    deconstructRefundScale: lerpSkill(state, "construction", 0.5, 1),
    staminaMax: lerpSkill(state, "fitness", STAMINA_MAX, 100),
    staminaDrainScale: 1,
    walkSpeed: PLAYER_SPEED,
    infectionChance: lerpSkill(state, "immunity", ZOMBIE_INFECTION_CHANCE, 0.025),
    infectionTickUp: lerpSkill(state, "immunity", 1, 0.5),
    healScale: lerpSkill(state, "recovery", 1, 1.5),
    hungerDrainScale: lerpSkill(state, "recovery", 1, 0.75),
    missScale: 1,
    spreadScale: lerpSkill(state, "accuracy", 1, 0.5),
    reloadMs: RELOAD_DURATION_MS,
    craftDurationScale: lerpSkill(state, "crafting", 1, 0.5),
    searchDurationMs: Math.round(
      lerpSkill(state, "scavenging", SEARCH_DURATION_MS, 3_000),
    ),
    lockpickDurationMs: Math.round(
      lerpSkill(
        state,
        "lockpicking",
        LOCKPICK_DURATION_AT_0_MS,
        LOCKPICK_DURATION_AT_100_MS,
      ),
    ),
    lockpickConsumeChance: lerpSkill(
      state,
      "lockpicking",
      LOCKPICK_CONSUME_AT_0,
      LOCKPICK_CONSUME_AT_100,
    ),
    lockpickNoiseTiles: lerpSkill(
      state,
      "stealth",
      LOCKPICK_NOISE_AT_0,
      LOCKPICK_NOISE_AT_100,
    ),
    lockpickLevel: effectiveSubLevel(state, "lockpicking"),
    stealthAggroRange: lerpSkill(state, "stealth", ZOMBIE_AGGRO_RANGE, 8),
    gunshotNoiseScale: 1,
    foodRestoreScale: lerpSkill(state, "cooking", 1, 1.2),
    medicineHealScale: lerpSkill(state, "medicine", 1, 1.2),
    antibioticDurationMs: Math.round(
      lerpSkill(
        state,
        "medicine",
        ANTIBIOTIC_DURATION_MS,
        ANTIBIOTIC_DURATION_MAX_MS,
      ),
    ),
    doctorHealCost: ASHEN_MILITIA_DOCTOR_HEAL_COST,
    magazineXpScale: lerpSkill(state, "reading", 1, 1.5),
    magazineReadMs: Math.round(
      lerpSkill(state, "reading", MAGAZINE_READ_MS, 20_000),
    ),
    barterT: clamp01(barterLevel / SKILL_LEVEL_MAX),
    questRewardScale: lerpLevel(persuasionLevel, 1, 1.5),
    questRepScale: lerpLevel(persuasionLevel, 1, 1.5),
    carryingLevel,
    jewelrySkillXp: bonus,
  };
}

export function craftDurationForSkill(
  recipe: { durationMs?: number },
  craftDurationScale: number,
): number {
  const base = recipe.durationMs ?? CRAFT_DURATION_MS;
  return Math.max(1, Math.round(base * craftDurationScale));
}

export function barterAdjustedRates(
  buyRate: number,
  sellRate: number,
  barterT: number,
): { buyRate: number; sellRate: number } {
  const t = clamp01(barterT);
  return {
    buyRate: Math.max(0.65, buyRate * (1 - 0.1 * t)),
    sellRate: Math.min(0.5, sellRate * (1 + 0.1 * t)),
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
