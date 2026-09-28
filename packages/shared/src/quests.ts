/**
 * Shared quest definitions + per-player quest progress.
 */

import {
  ASHEN_MILITIA_AMMO_TASK,
  ASHEN_MILITIA_BARGATE_SCRAP_TASK,
  ASHEN_MILITIA_CAPTAIN_NAME,
  ASHEN_MILITIA_CIGARETTES_TASK,
  ASHEN_MILITIA_DOCTOR_NAME,
  ASHEN_MILITIA_DONT_FEED_THEM_TASK,
  ASHEN_MILITIA_LIGHTER_TASK,
  ASHEN_MILITIA_MEDICAL_TASK,
  ASHEN_MILITIA_MISSING_PAIR_TASK,
  ASHEN_MILITIA_NIGHT_WATCH_FUEL_TASK,
  ASHEN_MILITIA_QUIET_STRETCH_TASK,
  ASHEN_MILITIA_SPICY_FINGERS_TASK,
  ASHEN_MILITIA_TASK_WINDOW_MS,
  ASHEN_MILITIA_WATER_TASK,
  type AshenMilitiaTask,
} from "./ashenMilitia.js";
import { RED_ORDER_FACTION } from "./constants.js";
import { getBuildingAt } from "./worldgen.js";

export type QuestFaction = "redOrder" | "ashenTraders" | "ashenMilitia" | "none";

/** Who posts the job (journal + NPC accept checks). */
export type QuestGiverId = "redOrder" | "ashenCaptain" | "ashenDoctor";

export type QuestObjectiveKind =
  | "turnInItem"
  | "visitTile"
  | "killNpcKind"
  | "clearBuilding"
  | "escort";

export type QuestObjective = {
  id: string;
  kind: QuestObjectiveKind;
  /** Human-readable objective line for journal UI. */
  label: string;
  /** Item turn-in. */
  itemId?: string;
  quantity?: number;
  /** visitTile / clearBuilding / escort anchors. */
  tileX?: number;
  tileY?: number;
  buildingType?: string;
  settlementId?: string;
  /** killNpcKind — e.g. "zombie" | "bandit" | "ashen_guard". */
  npcKind?: string;
  /** How many kills / visits required (default 1). */
  count?: number;
};

export type QuestReward = {
  itemId?: string;
  quantity?: number;
  /** Faction reputation delta. */
  reputation?: number;
  faction?: QuestFaction;
  banknotes?: number;
};

export type QuestMapPin = {
  /** Absolute overworld tile, or omit when using settlementId. */
  x?: number;
  y?: number;
  settlementId?: string;
  label?: string;
};

export type QuestDefinition = {
  id: string;
  title: string;
  description: string;
  faction?: QuestFaction;
  giver?: QuestGiverId;
  /** Dialog line id that offers this quest (optional). */
  dialogLineId?: string;
  objectives: QuestObjective[];
  rewards: QuestReward[];
  mapPin?: QuestMapPin;
  /** After turn-in, the job can be accepted again. */
  repeatable?: boolean;
  /** Max completions in a rolling window (omit = unlimited). */
  maxCompletionsPerWindow?: number;
  completionWindowMs?: number;
  /** When true, definition is registered but not offered yet. */
  stub?: boolean;
};

export type QuestStatus = "available" | "active" | "completed" | "failed";

export type PlayerQuestState = {
  questId: string;
  status: QuestStatus;
  /** Objective id → progress count. */
  progress: Record<string, number>;
  /** Wall-clock ms when accepted / completed (optional). */
  acceptedAt?: number;
  completedAt?: number;
  /** Successful turn-ins (repeatable jobs keep counting). */
  timesCompleted?: number;
  /** Assigned building origin for visit / clear jobs. */
  targetX?: number;
  targetY?: number;
  /** Extra one-shot notes (e.g. missing pair found dead). */
  flags?: Record<string, boolean>;
};

export type QuestAcceptAssignment = {
  targetX?: number;
  targetY?: number;
};

export type PlayerQuestsState = {
  /** Active + completed quest progress keyed by quest id. */
  quests: Record<string, PlayerQuestState>;
  /**
   * Repeatable dialog task turn-in timestamps (ms), keyed by task id.
   * Used for rolling daily caps (e.g. Doctor Clark snack jobs).
   */
  taskCompletions?: Record<string, number[]>;
};

export const QUEST_GIVER_LABELS: Record<QuestGiverId, string> = {
  redOrder: RED_ORDER_FACTION,
  ashenCaptain: ASHEN_MILITIA_CAPTAIN_NAME,
  ashenDoctor: ASHEN_MILITIA_DOCTOR_NAME,
};

function questFromMilitiaTask(
  task: AshenMilitiaTask,
  extra: {
    description: string;
    giver: QuestGiverId;
    faction: QuestFaction;
  },
): QuestDefinition {
  const itemId = task.requireItemId ?? "wood";
  const itemLabel = (task.requireItemLabel ?? "supplies").toLowerCase();
  return {
    id: task.id,
    title: task.label,
    description: extra.description,
    faction: extra.faction,
    giver: extra.giver,
    dialogLineId: task.dialogLineId,
    repeatable: true,
    maxCompletionsPerWindow: task.maxCompletionsPerWindow,
    completionWindowMs: task.completionWindowMs,
    objectives: [
      {
        id: `turn_in_${itemId}`,
        kind: "turnInItem",
        label: `Turn in ${itemLabel}`,
        itemId,
        quantity: task.requireQty ?? 1,
        count: 1,
      },
    ],
    rewards: [
      { banknotes: task.rewardBanknotes },
      { faction: extra.faction, reputation: task.rewardReputation },
    ],
  };
}

/** Migrated Red Order dog-tag turn-in (was RED_ORDER_ASHEN_PATROL_TASK). */
export const QUEST_ASHEN_PATROL_DOGTAGS: QuestDefinition = {
  id: "ashen_patrol_dogtags",
  title: "Ashen Patrol Dog Tags",
  description:
    "Ashen Militia patrols have been a problem. Bring Red Order their dog tags.",
  faction: "redOrder",
  giver: "redOrder",
  dialogLineId: "jobs",
  repeatable: true,
  objectives: [
    {
      id: "turn_in_dogtag",
      kind: "turnInItem",
      label: "Turn in Ashen dog tags",
      itemId: "dogtag",
      quantity: 1,
      count: 1,
    },
  ],
  rewards: [
    { banknotes: 200 },
    { faction: "redOrder", reputation: 500 },
  ],
};

export const QUEST_ASHEN_MILITIA_LIVE: readonly QuestDefinition[] = [
  questFromMilitiaTask(ASHEN_MILITIA_AMMO_TASK, {
    description:
      "Captain Davis needs 7.62 for Birchport patrols. Accept the job, then turn the ammo in at the barracks.",
    giver: "ashenCaptain",
    faction: "ashenMilitia",
  }),
  questFromMilitiaTask(ASHEN_MILITIA_CIGARETTES_TASK, {
    description:
      "Cigarettes for the barracks board. Accept with Davis, then bring a pack in.",
    giver: "ashenCaptain",
    faction: "ashenMilitia",
  }),
  questFromMilitiaTask(ASHEN_MILITIA_LIGHTER_TASK, {
    description:
      "Lighters for field kits. Accept with Davis, then hand one over.",
    giver: "ashenCaptain",
    faction: "ashenMilitia",
  }),
  questFromMilitiaTask(ASHEN_MILITIA_MEDICAL_TASK, {
    description:
      "Doctor Clark is short on bandages for the ward. Accept the job, then turn them in at the hospital.",
    giver: "ashenDoctor",
    faction: "ashenMilitia",
  }),
  questFromMilitiaTask(ASHEN_MILITIA_WATER_TASK, {
    description:
      "Drinking water for Clark's patients. Accept the job, then drop the bottles at the ward.",
    giver: "ashenDoctor",
    faction: "ashenMilitia",
  }),
  questFromMilitiaTask(ASHEN_MILITIA_SPICY_FINGERS_TASK, {
    description:
      "Clark's snack run. Accept first. Hot chips only, and he will not take more than five in a day.",
    giver: "ashenDoctor",
    faction: "ashenMilitia",
  }),
  questFromMilitiaTask(ASHEN_MILITIA_NIGHT_WATCH_FUEL_TASK, {
    description:
      "Street braziers burn through wood after dark. Accept with Davis, then bring eight pieces to the barracks. One load a day.",
    giver: "ashenCaptain",
    faction: "ashenMilitia",
  }),
  questFromMilitiaTask(ASHEN_MILITIA_BARGATE_SCRAP_TASK, {
    description:
      "The chain-link by the bargate is tired. Accept with Davis, then turn in ten scrap metal at the barracks.",
    giver: "ashenCaptain",
    faction: "ashenMilitia",
  }),
];

export const QUEST_ID_QUIET_STRETCH = ASHEN_MILITIA_QUIET_STRETCH_TASK.id;
export const QUEST_ID_MISSING_PAIR = ASHEN_MILITIA_MISSING_PAIR_TASK.id;
export const QUEST_ID_DONT_FEED_THEM = ASHEN_MILITIA_DONT_FEED_THEM_TASK.id;

export const QUEST_QUIET_STRETCH: QuestDefinition = {
  id: QUEST_ID_QUIET_STRETCH,
  title: ASHEN_MILITIA_QUIET_STRETCH_TASK.label,
  description:
    "Walkers are still coming out of a building in Birchport. Accept with Davis, clear that building, then report back. Ask him again if you want another address.",
  faction: "ashenMilitia",
  giver: "ashenCaptain",
  dialogLineId: "jobs",
  repeatable: true,
  maxCompletionsPerWindow: ASHEN_MILITIA_QUIET_STRETCH_TASK.maxCompletionsPerWindow,
  completionWindowMs: ASHEN_MILITIA_QUIET_STRETCH_TASK.completionWindowMs,
  objectives: [
    {
      id: "clear_house",
      kind: "clearBuilding",
      label: "Clear walkers from the marked building",
      count: 1,
    },
  ],
  rewards: [
    { banknotes: ASHEN_MILITIA_QUIET_STRETCH_TASK.rewardBanknotes },
    {
      faction: "ashenMilitia",
      reputation: ASHEN_MILITIA_QUIET_STRETCH_TASK.rewardReputation,
    },
  ],
};

export const QUEST_MISSING_PAIR: QuestDefinition = {
  id: QUEST_ID_MISSING_PAIR,
  title: ASHEN_MILITIA_MISSING_PAIR_TASK.label,
  description:
    "Two troopers missed radio at a motel south of town. Accept with Davis, go in, confirm it is empty or clear it, then report back. If they did not make it, he will add a box of 7.62 from their kit.",
  faction: "ashenMilitia",
  giver: "ashenCaptain",
  dialogLineId: "jobs",
  objectives: [
    {
      id: "visit_motel",
      kind: "visitTile",
      label: "Enter the marked motel",
      buildingType: "motel",
      count: 1,
    },
    {
      id: "clear_motel",
      kind: "clearBuilding",
      label: "Confirm the motel is clear",
      buildingType: "motel",
      count: 1,
    },
  ],
  rewards: [
    { banknotes: ASHEN_MILITIA_MISSING_PAIR_TASK.rewardBanknotes },
    {
      faction: "ashenMilitia",
      reputation: ASHEN_MILITIA_MISSING_PAIR_TASK.rewardReputation,
    },
  ],
};

export const QUEST_DONT_FEED_THEM: QuestDefinition = {
  id: QUEST_ID_DONT_FEED_THEM,
  title: ASHEN_MILITIA_DONT_FEED_THEM_TASK.label,
  description:
    "Thin walkers on the roads outside Birchport. Davis will not pay for bodies dropped in town. Eight kills, then turn in at the barracks. One load a day.",
  faction: "ashenMilitia",
  giver: "ashenCaptain",
  dialogLineId: "jobs",
  repeatable: true,
  maxCompletionsPerWindow:
    ASHEN_MILITIA_DONT_FEED_THEM_TASK.maxCompletionsPerWindow,
  completionWindowMs: ASHEN_MILITIA_DONT_FEED_THEM_TASK.completionWindowMs,
  objectives: [
    {
      id: "kill_walkers",
      kind: "killNpcKind",
      label: "Kill walkers outside Birchport",
      npcKind: "zombie",
      count: 8,
    },
  ],
  rewards: [
    { banknotes: ASHEN_MILITIA_DONT_FEED_THEM_TASK.rewardBanknotes },
    {
      faction: "ashenMilitia",
      reputation: ASHEN_MILITIA_DONT_FEED_THEM_TASK.rewardReputation,
    },
  ],
};

/** Stub faction / POI jobs — content fills in later phases. */
export const QUEST_STUBS: readonly QuestDefinition[] = [
  {
    id: "red_clear_warehouse",
    title: "Clear the Warehouse",
    description: "Clear walkers from a Red Order warehouse.",
    faction: "redOrder",
    dialogLineId: "jobs",
    objectives: [
      {
        id: "clear_zombies",
        kind: "clearBuilding",
        label: "Clear zombies in the warehouse",
        buildingType: "warehouse",
        count: 1,
      },
    ],
    rewards: [{ faction: "redOrder", reputation: 300 }],
    stub: true,
  },
  {
    id: "ashen_medical_run",
    title: "Medical Run",
    description: "Gather medical supplies for an Ashen caravan.",
    faction: "ashenTraders",
    dialogLineId: "jobs",
    objectives: [
      {
        id: "visit_hospital",
        kind: "visitTile",
        label: "Visit a hospital",
        buildingType: "hospital",
        count: 1,
      },
      {
        id: "turn_in_meds",
        kind: "turnInItem",
        label: "Turn in bandages",
        itemId: "bandages",
        quantity: 2,
        count: 1,
      },
    ],
    rewards: [
      { banknotes: 150 },
      { faction: "ashenTraders", reputation: 400 },
    ],
    stub: true,
  },
  {
    id: "ashen_caravan_escort",
    title: "Caravan Escort",
    description: "Stay with an Ashen trader caravan until its endpoint.",
    faction: "ashenTraders",
    dialogLineId: "jobs",
    objectives: [
      {
        id: "escort_caravan",
        kind: "escort",
        label: "Escort the caravan to its destination",
        count: 1,
      },
    ],
    rewards: [{ faction: "ashenTraders", reputation: 500 }],
    stub: true,
  },
  {
    id: "bandit_dogtags",
    title: "Bandit Tags",
    description: "Bring bandit dog tags to prove the roads are safer.",
    faction: "redOrder",
    dialogLineId: "jobs",
    objectives: [
      {
        id: "turn_in_bandit_tag",
        kind: "turnInItem",
        label: "Turn in bandit dog tags",
        itemId: "bandit_dogtag",
        quantity: 1,
        count: 1,
      },
    ],
    rewards: [
      { banknotes: 250 },
      { faction: "redOrder", reputation: 400 },
    ],
    stub: true,
  },
] as const;

export const QUEST_REGISTRY: readonly QuestDefinition[] = [
  QUEST_ASHEN_PATROL_DOGTAGS,
  ...QUEST_ASHEN_MILITIA_LIVE,
  QUEST_QUIET_STRETCH,
  QUEST_MISSING_PAIR,
  QUEST_DONT_FEED_THEM,
  ...QUEST_STUBS,
];

const QUEST_BY_ID = new Map(QUEST_REGISTRY.map((q) => [q.id, q]));

export function getQuestDefinition(
  questId: string,
): QuestDefinition | undefined {
  return QUEST_BY_ID.get(questId);
}

export function createEmptyQuestsState(): PlayerQuestsState {
  return { quests: {}, taskCompletions: {} };
}

export function parseQuestsJson(
  json: string | null | undefined,
): PlayerQuestsState {
  if (!json || typeof json !== "string" || json.length === 0) {
    return createEmptyQuestsState();
  }
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!parsed || typeof parsed !== "object") return createEmptyQuestsState();
    const root = parsed as Record<string, unknown>;
    const questsRaw =
      root.quests && typeof root.quests === "object"
        ? (root.quests as Record<string, unknown>)
        : (parsed as Record<string, unknown>);

    const quests: Record<string, PlayerQuestState> = {};
    for (const [questId, raw] of Object.entries(questsRaw)) {
      if (!raw || typeof raw !== "object") continue;
      if (questId === "quests" || questId === "taskCompletions") continue;
      const obj = raw as Record<string, unknown>;
      const status = obj.status;
      if (
        status !== "available" &&
        status !== "active" &&
        status !== "completed" &&
        status !== "failed"
      ) {
        continue;
      }
      const progress: Record<string, number> = {};
      if (obj.progress && typeof obj.progress === "object") {
        for (const [oid, val] of Object.entries(
          obj.progress as Record<string, unknown>,
        )) {
          const n = Number(val);
          if (Number.isFinite(n) && n >= 0) progress[oid] = Math.floor(n);
        }
      }
      const timesCompleted = Number(obj.timesCompleted);
      const targetX = Number(obj.targetX);
      const targetY = Number(obj.targetY);
      const flags: Record<string, boolean> = {};
      if (obj.flags && typeof obj.flags === "object") {
        for (const [k, v] of Object.entries(obj.flags as Record<string, unknown>)) {
          if (v === true) flags[k] = true;
        }
      }
      const entry: PlayerQuestState = {
        questId,
        status,
        progress,
        acceptedAt:
          typeof obj.acceptedAt === "number" ? obj.acceptedAt : undefined,
        completedAt:
          typeof obj.completedAt === "number" ? obj.completedAt : undefined,
        timesCompleted:
          Number.isFinite(timesCompleted) && timesCompleted > 0
            ? Math.floor(timesCompleted)
            : undefined,
        targetX: Number.isFinite(targetX) ? Math.floor(targetX) : undefined,
        targetY: Number.isFinite(targetY) ? Math.floor(targetY) : undefined,
        flags: Object.keys(flags).length > 0 ? flags : undefined,
      };
      const def = getQuestDefinition(questId);
      const turnedInEarlier =
        entry.status === "active" &&
        entry.completedAt != null &&
        (entry.acceptedAt == null || entry.acceptedAt < entry.completedAt);
      if (def && turnedInEarlier) {
        entry.status = "completed";
        entry.progress = {};
        entry.acceptedAt = undefined;
        entry.targetX = undefined;
        entry.targetY = undefined;
        entry.flags = undefined;
      }
      quests[questId] = entry;
    }

    const taskCompletions: Record<string, number[]> = {};
    if (root.taskCompletions && typeof root.taskCompletions === "object") {
      for (const [taskId, raw] of Object.entries(
        root.taskCompletions as Record<string, unknown>,
      )) {
        if (!Array.isArray(raw)) continue;
        const stamps = raw
          .map((v) => Number(v))
          .filter((n) => Number.isFinite(n) && n > 0)
          .map((n) => Math.floor(n));
        if (stamps.length > 0) taskCompletions[taskId] = stamps;
      }
    }

    return { quests, taskCompletions };
  } catch {
    return createEmptyQuestsState();
  }
}

export function serializeQuestsJson(state: PlayerQuestsState): string {
  return JSON.stringify({
    quests: state.quests ?? {},
    taskCompletions: state.taskCompletions ?? {},
  });
}

export function isOfferableQuest(def: QuestDefinition | undefined): boolean {
  return !!def && !def.stub;
}

export function questGiverLabel(def: QuestDefinition): string {
  if (!def.giver) return "";
  return QUEST_GIVER_LABELS[def.giver];
}

export function getPlayerQuest(
  state: PlayerQuestsState,
  questId: string,
): PlayerQuestState | undefined {
  return state.quests[questId];
}

export function questStatusOf(
  state: PlayerQuestsState,
  questId: string,
): QuestStatus {
  return state.quests[questId]?.status ?? "available";
}

export function isQuestActive(
  state: PlayerQuestsState,
  questId: string,
): boolean {
  return questStatusOf(state, questId) === "active";
}

export function questCompletionsRemaining(
  state: PlayerQuestsState,
  def: QuestDefinition,
  now = Date.now(),
): number | null {
  const max = def.maxCompletionsPerWindow;
  if (max == null || max <= 0) return null;
  const windowMs = def.completionWindowMs ?? ASHEN_MILITIA_TASK_WINDOW_MS;
  const recent = taskCompletionsInWindow(state, def.id, windowMs, now).length;
  return Math.max(0, max - recent);
}

export function canAcceptQuest(
  state: PlayerQuestsState,
  questId: string,
  now = Date.now(),
): boolean {
  const def = getQuestDefinition(questId);
  if (!def || def.stub) return false;
  const status = questStatusOf(state, questId);
  if (status === "active" || status === "failed") return false;
  if (status === "completed" && !def.repeatable) return false;
  const remaining = questCompletionsRemaining(state, def, now);
  if (remaining === 0) return false;
  return true;
}

export function canAbandonQuest(
  state: PlayerQuestsState,
  questId: string,
): boolean {
  return isQuestActive(state, questId);
}

/** True when every non-item objective has reached its count. */
export function questProgressObjectivesComplete(
  state: PlayerQuestsState,
  def: QuestDefinition,
): boolean {
  const prev = state.quests[def.id];
  if (!prev) return false;
  for (const obj of def.objectives) {
    if (obj.kind === "turnInItem") continue;
    const need = Math.max(1, obj.count ?? 1);
    if ((prev.progress[obj.id] ?? 0) < need) return false;
  }
  return true;
}

/** True when the job is accepted, not at its daily cap, and field work is done. */
export function canTurnInQuest(
  state: PlayerQuestsState,
  questId: string,
  now = Date.now(),
): boolean {
  const def = getQuestDefinition(questId);
  if (!def || def.stub) return false;
  if (!isQuestActive(state, questId)) return false;
  if (questCompletionsRemaining(state, def, now) === 0) return false;
  return questProgressObjectivesComplete(state, def);
}

/** NPC talk-target that can accept / turn in this job. */
export function npcCanOfferQuest(
  def: QuestDefinition | undefined,
  giver: QuestGiverId | null,
): boolean {
  if (!def || def.stub || !giver) return false;
  return !def.giver || def.giver === giver;
}

export function acceptQuest(
  state: PlayerQuestsState,
  questId: string,
  now = Date.now(),
  assignment?: QuestAcceptAssignment,
): PlayerQuestsState | null {
  if (!canAcceptQuest(state, questId, now)) return null;
  const prev = state.quests[questId];
  return {
    ...state,
    quests: {
      ...state.quests,
      [questId]: {
        questId,
        status: "active",
        progress: {},
        acceptedAt: now,
        completedAt: prev?.completedAt,
        timesCompleted: prev?.timesCompleted,
        targetX: assignment?.targetX,
        targetY: assignment?.targetY,
      },
    },
  };
}

export function abandonQuest(
  state: PlayerQuestsState,
  questId: string,
): PlayerQuestsState | null {
  if (!canAbandonQuest(state, questId)) return null;
  const prev = state.quests[questId];
  const def = getQuestDefinition(questId);
  if (!prev || !def) return null;
  if (!def.repeatable && (prev.timesCompleted ?? 0) > 0) {
    return {
      ...state,
      quests: {
        ...state.quests,
        [questId]: {
          ...prev,
          status: "completed",
          progress: {},
        },
      },
    };
  }
  return {
    ...state,
    quests: {
      ...state.quests,
      [questId]: {
        ...prev,
        status: "available",
        progress: {},
        acceptedAt: undefined,
      },
    },
  };
}

/** Mark an active quest turned in. Repeatable jobs must be accepted again. */
export function completeAcceptedQuest(
  state: PlayerQuestsState,
  questId: string,
  now = Date.now(),
): PlayerQuestsState | null {
  const def = getQuestDefinition(questId);
  const prev = state.quests[questId];
  if (!def || !prev || prev.status !== "active") return null;
  const timesCompleted = (prev.timesCompleted ?? 0) + 1;
  return {
    ...state,
    quests: {
      ...state.quests,
      [questId]: {
        questId,
        status: "completed",
        progress: {},
        acceptedAt: undefined,
        completedAt: now,
        timesCompleted,
        targetX: undefined,
        targetY: undefined,
        flags: undefined,
      },
    },
  };
}

/** Accept-gated turn-in: requires an active job and records rolling-window caps. */
export function turnInAcceptedQuest(
  state: PlayerQuestsState,
  questId: string,
  now = Date.now(),
): PlayerQuestsState | null {
  if (!canTurnInQuest(state, questId, now)) return null;
  let next = completeAcceptedQuest(state, questId, now);
  if (!next) return null;
  const def = getQuestDefinition(questId);
  if (def && def.maxCompletionsPerWindow != null && def.maxCompletionsPerWindow > 0) {
    const windowMs = def.completionWindowMs ?? ASHEN_MILITIA_TASK_WINDOW_MS;
    next = recordTaskCompletion(next, questId, windowMs, now);
  }
  return next;
}

export function questNeedsBuildingTarget(def: QuestDefinition): boolean {
  return def.objectives.some(
    (obj) => obj.kind === "clearBuilding" || obj.kind === "visitTile",
  );
}

export function assignQuestTarget(
  state: PlayerQuestsState,
  questId: string,
  targetX: number,
  targetY: number,
): PlayerQuestsState | null {
  const prev = state.quests[questId];
  if (!prev || prev.status !== "active") return null;
  return {
    ...state,
    quests: {
      ...state.quests,
      [questId]: {
        ...prev,
        targetX,
        targetY,
        progress: {},
        flags: undefined,
      },
    },
  };
}

export function questFlag(
  state: PlayerQuestsState,
  questId: string,
  flag: string,
): boolean {
  return state.quests[questId]?.flags?.[flag] === true;
}

export function setQuestFlag(
  state: PlayerQuestsState,
  questId: string,
  flag: string,
  value = true,
): PlayerQuestsState | null {
  const prev = state.quests[questId];
  if (!prev || prev.status !== "active") return null;
  if (prev.flags?.[flag] === value) return state;
  return {
    ...state,
    quests: {
      ...state.quests,
      [questId]: {
        ...prev,
        flags: { ...prev.flags, [flag]: value },
      },
    },
  };
}

export function incrementQuestObjective(
  state: PlayerQuestsState,
  questId: string,
  objectiveId: string,
  amount = 1,
): PlayerQuestsState | null {
  const def = getQuestDefinition(questId);
  const prev = state.quests[questId];
  const obj = def?.objectives.find((o) => o.id === objectiveId);
  if (!def || !prev || prev.status !== "active" || !obj) return null;
  const cap = Math.max(1, obj.count ?? 1);
  const cur = prev.progress[objectiveId] ?? 0;
  if (cur >= cap || amount <= 0) return null;
  const next = Math.min(cap, cur + Math.floor(amount));
  return {
    ...state,
    quests: {
      ...state.quests,
      [questId]: {
        ...prev,
        progress: { ...prev.progress, [objectiveId]: next },
      },
    },
  };
}

export function setQuestObjectiveAtLeast(
  state: PlayerQuestsState,
  questId: string,
  objectiveId: string,
  value: number,
): PlayerQuestsState | null {
  const def = getQuestDefinition(questId);
  const prev = state.quests[questId];
  const obj = def?.objectives.find((o) => o.id === objectiveId);
  if (!def || !prev || prev.status !== "active" || !obj) return null;
  const cap = Math.max(1, obj.count ?? 1);
  const want = Math.max(0, Math.min(cap, Math.floor(value)));
  const cur = prev.progress[objectiveId] ?? 0;
  if (want <= cur) return null;
  return {
    ...state,
    quests: {
      ...state.quests,
      [questId]: {
        ...prev,
        progress: { ...prev.progress, [objectiveId]: want },
      },
    },
  };
}

export function questObjectiveLine(
  state: PlayerQuestsState,
  def: QuestDefinition,
  obj: QuestObjective,
): string {
  if (obj.kind === "turnInItem") {
    const qty = obj.quantity && obj.quantity > 1 ? ` ×${obj.quantity}` : "";
    return `${obj.label}${qty}`;
  }
  const need = Math.max(1, obj.count ?? 1);
  const have = Math.min(need, state.quests[def.id]?.progress[obj.id] ?? 0);
  return `${obj.label} (${have}/${need})`;
}

/** True when this stage's count is met on the current accepted run. */
export function isQuestObjectiveDone(
  state: PlayerQuestsState,
  def: QuestDefinition,
  obj: QuestObjective,
): boolean {
  const prev = state.quests[def.id];
  if (!prev || prev.status !== "active" || obj.kind === "turnInItem") return false;
  const need = Math.max(1, obj.count ?? 1);
  return (prev.progress[obj.id] ?? 0) >= need;
}

export function questAssignedLocationLabel(
  state: PlayerQuestsState,
  questId: string,
): string | null {
  const prev = state.quests[questId];
  if (prev?.targetX == null || prev.targetY == null) return null;
  const bld = getBuildingAt(prev.targetX, prev.targetY);
  const kind =
    bld?.buildingType === "motel"
      ? "motel"
      : bld?.buildingType === "house"
        ? "house"
        : "building";
  return `${kind} at ${prev.targetX}, ${prev.targetY}`;
}

export type QuestMapMarker = {
  questId: string;
  title: string;
  x: number;
  y: number;
};

/** Overworld point for an accepted job, or null when it has no map location. */
export function resolveQuestMapPoint(
  state: PlayerQuestsState,
  def: QuestDefinition,
): { x: number; y: number } | null {
  const prev = state.quests[def.id];
  if (!prev || prev.status !== "active") return null;
  if (prev.targetX != null && prev.targetY != null) {
    const bld = getBuildingAt(prev.targetX, prev.targetY);
    if (bld) {
      return { x: bld.ox + bld.w / 2, y: bld.oy + bld.h / 2 };
    }
    return { x: prev.targetX, y: prev.targetY };
  }
  if (def.mapPin?.x != null && def.mapPin?.y != null) {
    return { x: def.mapPin.x, y: def.mapPin.y };
  }
  for (const obj of def.objectives) {
    if (obj.tileX != null && obj.tileY != null) {
      return { x: obj.tileX, y: obj.tileY };
    }
  }
  return null;
}

/** Accepted jobs that have a place to mark. Dropped on abandon / complete. */
export function listActiveQuestMapMarkers(
  state: PlayerQuestsState,
): QuestMapMarker[] {
  const out: QuestMapMarker[] = [];
  for (const prev of Object.values(state.quests)) {
    if (prev.status !== "active") continue;
    const def = getQuestDefinition(prev.questId);
    if (!def || def.stub) continue;
    const pt = resolveQuestMapPoint(state, def);
    if (!pt) continue;
    out.push({ questId: def.id, title: def.title, x: pt.x, y: pt.y });
  }
  return out;
}

/** Building origins on active jobs (quest spawn occupancy). */
export function listActiveQuestBuildingTargets(
  state: PlayerQuestsState,
): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (const prev of Object.values(state.quests)) {
    if (prev.status !== "active") continue;
    if (prev.targetX == null || prev.targetY == null) continue;
    out.push({ x: prev.targetX, y: prev.targetY });
  }
  return out;
}

/**
 * Field objectives that just reached their count. Used for the task-updated
 * popup. Skips first sync, accept, abandon, and turn-in.
 */
export function listNewlyCompletedQuestStages(
  prev: PlayerQuestsState,
  next: PlayerQuestsState,
): { questId: string; title: string }[] {
  const seen = new Set<string>();
  const out: { questId: string; title: string }[] = [];
  for (const [questId, after] of Object.entries(next.quests)) {
    const before = prev.quests[questId];
    if (!before || before.status !== "active") continue;
    if (after.status !== "active" && after.status !== "completed") continue;
    const def = getQuestDefinition(questId);
    if (!def || def.stub) continue;
    for (const obj of def.objectives) {
      if (obj.kind === "turnInItem") continue;
      const need = Math.max(1, obj.count ?? 1);
      const had = before.progress[obj.id] ?? 0;
      const have = after.progress[obj.id] ?? 0;
      if (have < need || had >= need) continue;
      if (seen.has(questId)) continue;
      seen.add(questId);
      out.push({ questId, title: def.title });
    }
  }
  return out;
}

export function questHasItemTurnIn(def: QuestDefinition): boolean {
  return def.objectives.some((obj) => obj.kind === "turnInItem");
}

/** Full catalog of jobs NPCs can offer. Unaccepted jobs stay off the journal. */
export function listJournalQuests(): QuestDefinition[] {
  return QUEST_REGISTRY.filter((q) => isOfferableQuest(q));
}

/** True after the player accepted the job from its giver (or finished / failed it). */
export function isTrackedJournalQuest(
  state: PlayerQuestsState,
  questId: string,
): boolean {
  const status = questStatusOf(state, questId);
  return status === "active" || status === "completed" || status === "failed";
}

/** Jobs the journal should list: accepted, completed, or failed. */
export function listTrackedJournalQuests(
  state: PlayerQuestsState,
): QuestDefinition[] {
  return listJournalQuests().filter((q) => isTrackedJournalQuest(state, q.id));
}

/** Timestamps still inside a rolling window for a dialog task. */
export function taskCompletionsInWindow(
  state: PlayerQuestsState,
  taskId: string,
  windowMs: number,
  now = Date.now(),
): number[] {
  const all = state.taskCompletions?.[taskId] ?? [];
  return all.filter((t) => now - t < windowMs);
}

/** Append a completion and prune stamps older than the window. */
export function recordTaskCompletion(
  state: PlayerQuestsState,
  taskId: string,
  windowMs: number,
  now = Date.now(),
): PlayerQuestsState {
  const recent = taskCompletionsInWindow(state, taskId, windowMs, now);
  recent.push(now);
  return {
    ...state,
    taskCompletions: {
      ...(state.taskCompletions ?? {}),
      [taskId]: recent,
    },
  };
}

export const EMPTY_QUESTS_JSON = serializeQuestsJson(createEmptyQuestsState());

export type TutorialFlagsState = {
  done?: boolean;
  /** True after the coach was shown once — never auto-open again on reconnect. */
  seen?: boolean;
  steps?: Record<string, boolean>;
};

export function createEmptyTutorialFlags(): TutorialFlagsState {
  return { done: false, seen: false, steps: {} };
}

export function parseTutorialFlagsJson(
  json: string | null | undefined,
): TutorialFlagsState {
  if (!json || typeof json !== "string" || json.length === 0) {
    return createEmptyTutorialFlags();
  }
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return createEmptyTutorialFlags();
    }
    const obj = parsed as Record<string, unknown>;
    const steps: Record<string, boolean> = {};
    if (obj.steps && typeof obj.steps === "object") {
      for (const [k, v] of Object.entries(obj.steps as Record<string, unknown>)) {
        steps[k] = v === true;
      }
    }
    return {
      done: obj.done === true,
      seen: obj.seen === true,
      steps,
    };
  } catch {
    return createEmptyTutorialFlags();
  }
}

export function serializeTutorialFlagsJson(
  state: TutorialFlagsState,
): string {
  return JSON.stringify({
    done: state.done === true,
    seen: state.seen === true || state.done === true,
    steps: state.steps ?? {},
  });
}

export const EMPTY_TUTORIAL_FLAGS_JSON = serializeTutorialFlagsJson(
  createEmptyTutorialFlags(),
);
