/**
 * Shared quest definitions + per-player quest progress.
 * Phase 0: registry + persistence helpers. Handlers wire in later phases.
 */

export type QuestFaction = "redOrder" | "ashenTraders" | "none";

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
  /** Dialog line id that offers this quest (optional). */
  dialogLineId?: string;
  objectives: QuestObjective[];
  rewards: QuestReward[];
  mapPin?: QuestMapPin;
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

/** Migrated Red Order dog-tag turn-in (was RED_ORDER_ASHEN_PATROL_TASK). */
export const QUEST_ASHEN_PATROL_DOGTAGS: QuestDefinition = {
  id: "ashen_patrol_dogtags",
  title: "Ashen Patrol Dog Tags",
  description:
    "Ashen Militia patrols have been a problem. Bring Red Order their dog tags.",
  faction: "redOrder",
  dialogLineId: "jobs",
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
      quests[questId] = {
        questId,
        status,
        progress,
        acceptedAt:
          typeof obj.acceptedAt === "number" ? obj.acceptedAt : undefined,
        completedAt:
          typeof obj.completedAt === "number" ? obj.completedAt : undefined,
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
