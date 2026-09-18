/**
 * Shared quest definitions + per-player quest progress.
 */

import {
  ASHEN_MILITIA_AMMO_TASK,
  ASHEN_MILITIA_CAPTAIN_NAME,
  ASHEN_MILITIA_CIGARETTES_TASK,
  ASHEN_MILITIA_DOCTOR_NAME,
  ASHEN_MILITIA_LIGHTER_TASK,
  ASHEN_MILITIA_MEDICAL_TASK,
  ASHEN_MILITIA_SPICY_FINGERS_TASK,
  ASHEN_MILITIA_TASK_WINDOW_MS,
  ASHEN_MILITIA_WATER_TASK,
  type AshenMilitiaTask,
} from "./ashenMilitia.js";
import { RED_ORDER_FACTION } from "./constants.js";

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
        id: `turn_in_${task.requireItemId}`,
        kind: "turnInItem",
        label: `Turn in ${task.requireItemLabel.toLowerCase()}`,
        itemId: task.requireItemId,
        quantity: task.requireQty,
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
];

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
      quests[questId] = {
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
      };
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

/** True when the job is accepted and not at its rolling daily cap. */
export function canTurnInQuest(
  state: PlayerQuestsState,
  questId: string,
  now = Date.now(),
): boolean {
  const def = getQuestDefinition(questId);
  if (!def || def.stub) return false;
  if (!isQuestActive(state, questId)) return false;
  return questCompletionsRemaining(state, def, now) !== 0;
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

/** Mark an active quest turned in. Repeatable jobs stay accepted until abandoned. */
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
        status: def.repeatable ? "active" : "completed",
        progress: {},
        acceptedAt: prev.acceptedAt,
        completedAt: now,
        timesCompleted,
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
