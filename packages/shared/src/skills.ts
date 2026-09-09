/**
 * Two-tier skill tree: parent skills gate sub-skill levels.
 * Sub effective level is always min(sub.level, parent.level).
 */

export const SKILL_LEVEL_MIN = 0;
export const SKILL_LEVEL_MAX = 100;

/** Fraction of sub XP also applied to the parent when a sub gains XP. */
export const PARENT_XP_DRIP_RATIO = 0.25;

export const PARENT_SKILL_IDS = [
  "strength",
  "endurance",
  "dexterity",
  "intelligence",
  "charisma",
] as const;

export type ParentSkillId = (typeof PARENT_SKILL_IDS)[number];

export const SUB_SKILLS_BY_PARENT = {
  strength: ["melee", "harvesting", "carrying", "construction"] as const,
  endurance: ["fitness", "immunity", "recovery"] as const,
  dexterity: [
    "accuracy",
    "crafting",
    "scavenging",
    "stealth",
    "cooking",
  ] as const,
  intelligence: ["medicine", "reading"] as const,
  charisma: ["bartering", "persuasion", "leadership"] as const,
} as const;

export type SubSkillId =
  (typeof SUB_SKILLS_BY_PARENT)[ParentSkillId][number];

export type SkillProgress = {
  level: number;
  xp: number;
};

export type ParentSkillState = SkillProgress & {
  subs: Partial<Record<SubSkillId, SkillProgress>>;
};

export type PlayerSkillsState = Partial<
  Record<ParentSkillId, ParentSkillState>
>;

/** XP required to advance from `level` to `level + 1` (level 0–99). */
export function xpToNextLevel(level: number): number {
  const clamped = Math.max(SKILL_LEVEL_MIN, Math.min(SKILL_LEVEL_MAX, level));
  if (clamped >= SKILL_LEVEL_MAX) return 0;
  // Gentle curve: 50, 55, … scales with level.
  return 50 + clamped * 5;
}

export function emptySkillProgress(): SkillProgress {
  return { level: 0, xp: 0 };
}

export function createEmptySkillsState(): PlayerSkillsState {
  const state: PlayerSkillsState = {};
  for (const parentId of PARENT_SKILL_IDS) {
    const subs: ParentSkillState["subs"] = {};
    for (const subId of SUB_SKILLS_BY_PARENT[parentId]) {
      subs[subId] = emptySkillProgress();
    }
    state[parentId] = {
      ...emptySkillProgress(),
      subs,
    };
  }
  return state;
}

export function parentOfSub(subId: SubSkillId): ParentSkillId | null {
  for (const parentId of PARENT_SKILL_IDS) {
    if (
      (SUB_SKILLS_BY_PARENT[parentId] as readonly string[]).includes(subId)
    ) {
      return parentId;
    }
  }
  return null;
}

function clampLevel(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(
    SKILL_LEVEL_MIN,
    Math.min(SKILL_LEVEL_MAX, Math.floor(n)),
  );
}

function clampXp(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

function normalizeProgress(raw: unknown): SkillProgress {
  if (!raw || typeof raw !== "object") return emptySkillProgress();
  const obj = raw as Record<string, unknown>;
  return {
    level: clampLevel(Number(obj.level ?? 0)),
    xp: clampXp(Number(obj.xp ?? 0)),
  };
}

/** Parse persisted skillsJson into a full tree (fills missing parents/subs). */
export function parseSkillsJson(json: string | null | undefined): PlayerSkillsState {
  const base = createEmptySkillsState();
  if (!json || typeof json !== "string" || json.length === 0) return base;
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!parsed || typeof parsed !== "object") return base;
    const obj = parsed as Record<string, unknown>;
    for (const parentId of PARENT_SKILL_IDS) {
      const rawParent = obj[parentId];
      if (!rawParent || typeof rawParent !== "object") continue;
      const parentObj = rawParent as Record<string, unknown>;
      const progress = normalizeProgress(parentObj);
      const subs: ParentSkillState["subs"] = {
        ...base[parentId]!.subs,
      };
      const rawSubs =
        parentObj.subs && typeof parentObj.subs === "object"
          ? (parentObj.subs as Record<string, unknown>)
          : {};
      for (const subId of SUB_SKILLS_BY_PARENT[parentId]) {
        if (rawSubs[subId] != null) {
          const subProgress = normalizeProgress(rawSubs[subId]);
          // Cap sub level to parent on load.
          subProgress.level = Math.min(subProgress.level, progress.level);
          subs[subId] = subProgress;
        }
      }
      base[parentId] = { ...progress, subs };
    }
    return base;
  } catch {
    return base;
  }
}

export function serializeSkillsJson(state: PlayerSkillsState): string {
  const full = parseSkillsJson(JSON.stringify(state));
  return JSON.stringify(full);
}

export function getParentLevel(
  state: PlayerSkillsState,
  parentId: ParentSkillId,
): number {
  return state[parentId]?.level ?? 0;
}

export function getSubLevel(
  state: PlayerSkillsState,
  subId: SubSkillId,
): number {
  const parentId = parentOfSub(subId);
  if (!parentId) return 0;
  return state[parentId]?.subs?.[subId]?.level ?? 0;
}

/** Level used for gameplay modifiers — never exceeds parent. */
export function effectiveSubLevel(
  state: PlayerSkillsState,
  subId: SubSkillId,
): number {
  const parentId = parentOfSub(subId);
  if (!parentId) return 0;
  const parentLevel = getParentLevel(state, parentId);
  const subLevel = getSubLevel(state, subId);
  return Math.min(subLevel, parentLevel);
}

function applyXpToProgress(
  progress: SkillProgress,
  amount: number,
  levelCap: number = SKILL_LEVEL_MAX,
): SkillProgress {
  if (amount <= 0) return { ...progress };
  let level = progress.level;
  let xp = progress.xp + amount;
  const cap = Math.min(SKILL_LEVEL_MAX, Math.max(0, levelCap));
  while (level < cap) {
    const need = xpToNextLevel(level);
    if (need <= 0 || xp < need) break;
    xp -= need;
    level += 1;
  }
  if (level >= cap) {
    level = cap;
    xp = 0;
  }
  return { level, xp };
}

/**
 * Award XP to a sub-skill and drip a fraction to its parent.
 * Sub level is clamped to the parent level after both awards.
 */
export function awardSubSkillXp(
  state: PlayerSkillsState,
  subId: SubSkillId,
  amount: number,
): PlayerSkillsState {
  const parentId = parentOfSub(subId);
  if (!parentId || amount <= 0) return state;

  const next = parseSkillsJson(JSON.stringify(state));
  const parent = next[parentId]!;
  const sub = parent.subs[subId] ?? emptySkillProgress();

  // Parent drip first so the sub can use any newly gained headroom.
  const drip = Math.max(1, Math.floor(amount * PARENT_XP_DRIP_RATIO));
  const parentProgress = applyXpToProgress(parent, drip);
  const subProgress = applyXpToProgress(
    sub,
    amount,
    parentProgress.level,
  );

  next[parentId] = {
    ...parentProgress,
    subs: {
      ...parent.subs,
      [subId]: subProgress,
    },
  };
  return next;
}

/** Default empty skills JSON for new players / DB defaults. */
export const EMPTY_SKILLS_JSON = serializeSkillsJson(createEmptySkillsState());
