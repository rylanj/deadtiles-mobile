/**
 * Shared quest definitions + per-player quest progress.
 */

import {
  ASHEN_MILITIA_AISLE_CHECK_TASK,
  ASHEN_MILITIA_AMMO_TASK,
  ASHEN_MILITIA_BARGATE_SCRAP_TASK,
  ASHEN_MILITIA_BEFORE_IT_TURNS_TASK,
  ASHEN_MILITIA_CAPTAIN_NAME,
  ASHEN_MILITIA_CIGARETTES_TASK,
  ASHEN_MILITIA_CLEAN_HANDS_TASK,
  ASHEN_MILITIA_COLD_TINS_TASK,
  ASHEN_MILITIA_DOCTOR_NAME,
  ASHEN_MILITIA_DONT_FEED_THEM_TASK,
  ASHEN_MILITIA_DONT_HOCK_THEM_TASK,
  ASHEN_MILITIA_FIRST_SWEEP_TASK,
  ASHEN_MILITIA_HOT_PLATE_TASK,
  ASHEN_MILITIA_LIGHTER_TASK,
  ASHEN_MILITIA_MEDICAL_TASK,
  ASHEN_MILITIA_MISSING_PAIR_TASK,
  ASHEN_MILITIA_NIGHT_WATCH_FUEL_TASK,
  ASHEN_MILITIA_POCKET_ROUNDS_TASK,
  ASHEN_MILITIA_QUIET_STRETCH_TASK,
  ASHEN_MILITIA_RAG_BIN_TASK,
  ASHEN_MILITIA_SOMETHING_SOFT_TASK,
  ASHEN_MILITIA_SPICY_FINGERS_TASK,
  ASHEN_MILITIA_SPLIT_KIT_TASK,
  ASHEN_MILITIA_TASK_WINDOW_MS,
  ASHEN_MILITIA_THIN_THE_PACK_TASK,
  ASHEN_MILITIA_WATER_TASK,
  type AshenMilitiaTask,
} from "./ashenMilitia.js";
import { RED_ORDER_FACTION } from "./constants.js";
import {
  RED_ORDER_CUT_CLOTH_TASK,
  RED_ORDER_FLOOR_SPACE_TASK,
  RED_ORDER_MELT_POT_TASK,
  type RedOrderTask,
} from "./redOrder.js";
import {
  CARAVAN_MANIFEST_ITEM_ID,
  SUPPLY_LIST_ITEM_ID,
  WAGON_NOTE_ITEM_ID,
} from "./items.js";
import { questTargetBuildingLabel } from "./questTargets.js";
import { ASHEN_MARKET_TRADER_NAME } from "./trade.js";
import { getBuildingAt } from "./worldgen.js";

export type QuestFaction = "redOrder" | "ashenTraders" | "ashenMilitia" | "none";

/** Who posts the job (journal + NPC accept checks). */
export type QuestGiverId =
  | "redOrder"
  | "ashenCaptain"
  | "ashenDoctor"
  | "ashenTrader";

export type QuestObjectiveKind =
  | "turnInItem"
  | "haveItem"
  | "visitTile"
  | "killNpcKind"
  | "clearBuilding"
  | "searchShelf"
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
  /** Icon on the jobs list when the job is not a single item turn-in. */
  iconItemId?: string;
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
  /** Furniture id that holds a player-only quest item. */
  stashId?: string;
  /** Shelf ids already counted for a search objective. */
  marks?: string[];
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
  ashenTrader: ASHEN_MARKET_TRADER_NAME,
};

function questFromMilitiaTask(
  task: AshenMilitiaTask | RedOrderTask,
  extra: {
    description: string;
    giver: QuestGiverId;
    faction: QuestFaction;
    /** Default true. False posts the job once, like Don't Hock Them. */
    repeatable?: boolean;
  },
): QuestDefinition {
  const itemId = task.requireItemId ?? "wood";
  const itemLabel = (task.requireItemLabel ?? "supplies").toLowerCase();
  const repeatable = extra.repeatable !== false;
  return {
    id: task.id,
    title: task.label,
    description: extra.description,
    faction: extra.faction,
    giver: extra.giver,
    dialogLineId: task.dialogLineId,
    repeatable,
    maxCompletionsPerWindow: repeatable
      ? task.maxCompletionsPerWindow
      : undefined,
    completionWindowMs: repeatable ? task.completionWindowMs : undefined,
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
  questFromMilitiaTask(ASHEN_MILITIA_POCKET_ROUNDS_TASK, {
    description:
      "Sidearms are running dry. Accept with Davis, then bring 20 rounds of 9mm to the barracks. Once a day.",
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
  questFromMilitiaTask(ASHEN_MILITIA_SPLIT_KIT_TASK, {
    description:
      "Patrol bags are splitting. Accept with Davis, then bring two rolls of duct tape. Once a day.",
    giver: "ashenCaptain",
    faction: "ashenMilitia",
  }),
  questFromMilitiaTask(ASHEN_MILITIA_MEDICAL_TASK, {
    description:
      "Doctor Clark is short on bandages for the ward. Accept the job, then turn them in at the hospital. Once a day.",
    giver: "ashenDoctor",
    faction: "ashenMilitia",
  }),
  questFromMilitiaTask(ASHEN_MILITIA_WATER_TASK, {
    description:
      "Drinking water for Clark's patients. Accept the job, then drop the bottles at the ward. Once a day.",
    giver: "ashenDoctor",
    faction: "ashenMilitia",
  }),
  questFromMilitiaTask(ASHEN_MILITIA_CLEAN_HANDS_TASK, {
    description:
      "Clark needs alcohol for wounds, not for drinking. Accept the job, then turn two bottles in at the ward. Once a day.",
    giver: "ashenDoctor",
    faction: "ashenMilitia",
  }),
  questFromMilitiaTask(ASHEN_MILITIA_RAG_BIN_TASK, {
    description:
      "The ward boils rags when the bandages run out. Accept with Clark, then bring ten. One time.",
    giver: "ashenDoctor",
    faction: "ashenMilitia",
    repeatable: false,
  }),
  questFromMilitiaTask(ASHEN_MILITIA_SOMETHING_SOFT_TASK, {
    description:
      "Some patients will not eat chips. Accept with Clark, then bring two cans of peaches. Once a day.",
    giver: "ashenDoctor",
    faction: "ashenMilitia",
  }),
  questFromMilitiaTask(ASHEN_MILITIA_BEFORE_IT_TURNS_TASK, {
    description:
      "Clark wants five packets of antibiotics stocked before the next wave of infections. Accept the job, then turn them in. One time.",
    giver: "ashenDoctor",
    faction: "ashenMilitia",
    repeatable: false,
  }),
  questFromMilitiaTask(ASHEN_MILITIA_SPICY_FINGERS_TASK, {
    description:
      "Clark's snack run. Accept first. Hot chips only, and he will take one bag a day.",
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
  questFromMilitiaTask(ASHEN_MILITIA_COLD_TINS_TASK, {
    description:
      "The mess wants beans, not another speech. Accept with Davis, then bring four cans. Once a day.",
    giver: "ashenCaptain",
    faction: "ashenMilitia",
  }),
  questFromMilitiaTask(ASHEN_MILITIA_HOT_PLATE_TASK, {
    description:
      "Davis wants coyote off a fire for the mess. Accept first. Cooked meat only. Burnt will not turn in. Once a day.",
    giver: "ashenCaptain",
    faction: "ashenMilitia",
  }),
];

export const QUEST_ID_QUIET_STRETCH = ASHEN_MILITIA_QUIET_STRETCH_TASK.id;
export const QUEST_ID_MISSING_PAIR = ASHEN_MILITIA_MISSING_PAIR_TASK.id;
export const QUEST_ID_DONT_FEED_THEM = ASHEN_MILITIA_DONT_FEED_THEM_TASK.id;
export const QUEST_ID_AISLE_CHECK = ASHEN_MILITIA_AISLE_CHECK_TASK.id;
export const QUEST_ID_THIN_THE_PACK = ASHEN_MILITIA_THIN_THE_PACK_TASK.id;
export const QUEST_ID_DONT_HOCK_THEM = ASHEN_MILITIA_DONT_HOCK_THEM_TASK.id;
/** Completes when the anniversary earrings are in the player's inventory. */
export const QUEST_DONT_HOCK_FIND_OBJECTIVE = "find_earrings";
export const QUEST_ID_FLOOR_SPACE = RED_ORDER_FLOOR_SPACE_TASK.id;
export const QUEST_ID_FIRST_SWEEP = ASHEN_MILITIA_FIRST_SWEEP_TASK.id;

export const QUEST_FIRST_SWEEP: QuestDefinition = {
  id: QUEST_ID_FIRST_SWEEP,
  title: ASHEN_MILITIA_FIRST_SWEEP_TASK.label,
  description:
    "Davis wants a house just outside Birchport cleared so patrols can use it. Accept the job and he lends you a worn hammer. Clear every walker inside, then report back. He takes the hammer back when you do.",
  faction: "ashenMilitia",
  giver: "ashenCaptain",
  dialogLineId: "jobs",
  objectives: [
    {
      id: "clear_house",
      kind: "clearBuilding",
      label: "Clear walkers from the marked house",
      buildingType: "house",
      count: 1,
    },
  ],
  rewards: [
    { banknotes: ASHEN_MILITIA_FIRST_SWEEP_TASK.rewardBanknotes },
    {
      faction: "ashenMilitia",
      reputation: ASHEN_MILITIA_FIRST_SWEEP_TASK.rewardReputation,
    },
  ],
};

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

export const QUEST_AISLE_CHECK: QuestDefinition = {
  id: QUEST_ID_AISLE_CHECK,
  title: ASHEN_MILITIA_AISLE_CHECK_TASK.label,
  description:
    "Davis wants a supermarket outside Birchport scouted for a supply run. Accept the job, search three shelves, then report what you found. You do not have to clear it. Once a day.",
  faction: "ashenMilitia",
  giver: "ashenCaptain",
  dialogLineId: "jobs",
  repeatable: true,
  maxCompletionsPerWindow: ASHEN_MILITIA_AISLE_CHECK_TASK.maxCompletionsPerWindow,
  completionWindowMs: ASHEN_MILITIA_AISLE_CHECK_TASK.completionWindowMs,
  objectives: [
    {
      id: "search_shelves",
      kind: "searchShelf",
      label: "Search shelves in the marked supermarket",
      count: 3,
    },
  ],
  rewards: [
    { banknotes: ASHEN_MILITIA_AISLE_CHECK_TASK.rewardBanknotes },
    {
      faction: "ashenMilitia",
      reputation: ASHEN_MILITIA_AISLE_CHECK_TASK.rewardReputation,
    },
  ],
};

export const QUEST_THIN_THE_PACK: QuestDefinition = {
  id: QUEST_ID_THIN_THE_PACK,
  title: ASHEN_MILITIA_THIN_THE_PACK_TASK.label,
  description:
    "Coyotes have been hitting the roads outside Birchport. Davis will not pay for a kill inside town. Three, then turn in at the barracks. Once a day.",
  faction: "ashenMilitia",
  giver: "ashenCaptain",
  dialogLineId: "jobs",
  repeatable: true,
  maxCompletionsPerWindow: ASHEN_MILITIA_THIN_THE_PACK_TASK.maxCompletionsPerWindow,
  completionWindowMs: ASHEN_MILITIA_THIN_THE_PACK_TASK.completionWindowMs,
  objectives: [
    {
      id: "kill_coyotes",
      kind: "killNpcKind",
      label: "Kill coyotes outside Birchport",
      npcKind: "coywolf",
      count: 3,
    },
  ],
  rewards: [
    { banknotes: ASHEN_MILITIA_THIN_THE_PACK_TASK.rewardBanknotes },
    {
      faction: "ashenMilitia",
      reputation: ASHEN_MILITIA_THIN_THE_PACK_TASK.rewardReputation,
    },
  ],
};

export const QUEST_DONT_HOCK_THEM: QuestDefinition = {
  id: QUEST_ID_DONT_HOCK_THEM,
  title: ASHEN_MILITIA_DONT_HOCK_THEM_TASK.label,
  description:
    "Clark bought his wife gold earrings for their anniversary. She died in the outbreak. He thinks that pair is still in a house outside town. Search the furniture. Once they are in your pack, bring them back to him.",
  faction: "ashenMilitia",
  giver: "ashenDoctor",
  dialogLineId: "jobs",
  objectives: [
    {
      id: QUEST_DONT_HOCK_FIND_OBJECTIVE,
      kind: "haveItem",
      label: "Find the anniversary earrings",
      itemId: "clarks_earrings",
      count: 1,
    },
    {
      id: "turn_in_earrings",
      kind: "turnInItem",
      label: "Hand the anniversary earrings to Clark",
      itemId: "clarks_earrings",
      quantity: 1,
      count: 1,
    },
  ],
  rewards: [
    { banknotes: ASHEN_MILITIA_DONT_HOCK_THEM_TASK.rewardBanknotes },
    {
      faction: "ashenMilitia",
      reputation: ASHEN_MILITIA_DONT_HOCK_THEM_TASK.rewardReputation,
    },
  ],
};

export const QUEST_FLOOR_SPACE: QuestDefinition = {
  id: QUEST_ID_FLOOR_SPACE,
  title: RED_ORDER_FLOOR_SPACE_TASK.label,
  description:
    "Walkers are denned in a warehouse the Red Order wants. Accept the job, clear it, then report back. Once a day.",
  faction: "redOrder",
  giver: "redOrder",
  dialogLineId: "jobs",
  repeatable: true,
  maxCompletionsPerWindow: RED_ORDER_FLOOR_SPACE_TASK.maxCompletionsPerWindow,
  completionWindowMs: RED_ORDER_FLOOR_SPACE_TASK.completionWindowMs,
  objectives: [
    {
      id: "clear_warehouse",
      kind: "clearBuilding",
      label: "Clear walkers from the marked warehouse",
      buildingType: "warehouse",
      count: 1,
    },
  ],
  rewards: [
    { banknotes: RED_ORDER_FLOOR_SPACE_TASK.rewardBanknotes },
    {
      faction: "redOrder",
      reputation: RED_ORDER_FLOOR_SPACE_TASK.rewardReputation,
    },
  ],
};

export const QUEST_ID_FLANK_LOAD = "ashen_trader_flank_load";
export const QUEST_ID_ROAD_TINS = "ashen_trader_road_tins";
export const QUEST_ID_CRATE_LIDS = "ashen_trader_crate_lids";
export const QUEST_ID_STILL_ON_THE_SHELF = "ashen_trader_still_on_the_shelf";
export const QUEST_ID_SCALING_UP = "ashen_trader_scaling_up";
export const QUEST_ID_SHORT_CRATE = "ashen_trader_short_crate";
export const QUEST_ID_X_MARKS = "ashen_trader_x_marks_the_spot";
export const QUEST_ID_PAID_AHEAD = "ashen_trader_paid_ahead";
export const QUEST_ID_FLOOR_MODEL = "ashen_trader_floor_model";
export const QUEST_ID_LEFT_ON_THE_DESK = "ashen_trader_left_on_the_desk";
export const QUEST_ID_BOTH_BARRELS = "ashen_trader_both_barrels";
export const QUEST_SHORT_CRATE_FIND_OBJECTIVE = "find_manifest";
export const QUEST_X_MARKS_FIND_OBJECTIVE = "find_note";
export const QUEST_LEFT_ON_THE_DESK_FIND_OBJECTIVE = "find_supply_list";

/**
 * Kevin's board at the Birchport market.
 * Repeatable rows are daily and always posted.
 * Two unfinished one-time rows show at a time, in the order below.
 * Turning one in opens the next. Reputation is Ashen Traders, never the militia.
 */
export const ASHEN_TRADER_QUESTS: readonly QuestDefinition[] = [
  {
    id: QUEST_ID_FLANK_LOAD,
    title: "Flank Load",
    description:
      "Trader guards on the roads are light on buckshot. Accept with Kevin, then bring eight shells to the Birchport market. Once a day.",
    faction: "ashenTraders",
    giver: "ashenTrader",
    dialogLineId: "jobs",
    iconItemId: "ammo_buckshot",
    repeatable: true,
    maxCompletionsPerWindow: 1,
    completionWindowMs: ASHEN_MILITIA_TASK_WINDOW_MS,
    objectives: [
      {
        id: "turn_in_buckshot",
        kind: "turnInItem",
        label: "Turn in buckshot",
        itemId: "ammo_buckshot",
        quantity: 8,
        count: 1,
      },
    ],
    rewards: [
      { banknotes: 70 },
      { faction: "ashenTraders", reputation: 120 },
    ],
  },
  {
    id: QUEST_ID_ROAD_TINS,
    title: "Road Tins",
    description:
      "Travelling traders eat between towns. Accept with Kevin, then bring four cans of tuna to the market. Once a day.",
    faction: "ashenTraders",
    giver: "ashenTrader",
    dialogLineId: "jobs",
    iconItemId: "canned_tuna",
    repeatable: true,
    maxCompletionsPerWindow: 1,
    completionWindowMs: ASHEN_MILITIA_TASK_WINDOW_MS,
    objectives: [
      {
        id: "turn_in_tuna",
        kind: "turnInItem",
        label: "Turn in canned tuna",
        itemId: "canned_tuna",
        quantity: 4,
        count: 1,
      },
    ],
    rewards: [
      { banknotes: 60 },
      { faction: "ashenTraders", reputation: 110 },
    ],
  },
  {
    id: QUEST_ID_CRATE_LIDS,
    title: "Crate Lids",
    description:
      "The market's storage crates are splitting. Accept with Kevin, then bring eight screws and four wood. Once a day.",
    faction: "ashenTraders",
    giver: "ashenTrader",
    dialogLineId: "jobs",
    iconItemId: "screws",
    repeatable: true,
    maxCompletionsPerWindow: 1,
    completionWindowMs: ASHEN_MILITIA_TASK_WINDOW_MS,
    objectives: [
      {
        id: "turn_in_screws",
        kind: "turnInItem",
        label: "Turn in screws",
        itemId: "screws",
        quantity: 8,
        count: 1,
      },
      {
        id: "turn_in_wood",
        kind: "turnInItem",
        label: "Turn in wood",
        itemId: "wood",
        quantity: 4,
        count: 1,
      },
    ],
    rewards: [
      { banknotes: 80 },
      { faction: "ashenTraders", reputation: 130 },
    ],
  },
  {
    id: QUEST_ID_STILL_ON_THE_SHELF,
    title: "Still on the Shelf",
    description:
      "Kevin wants a supermarket counted before he sends a buyer. Search three shelves and two fridges, then tell him what is left. You keep what you pocket. One time.",
    faction: "ashenTraders",
    giver: "ashenTrader",
    dialogLineId: "jobs",
    iconItemId: "map",
    objectives: [
      {
        id: "search_shelves",
        kind: "searchShelf",
        label: "Search shelves in the marked supermarket",
        count: 3,
      },
      {
        id: "search_fridges",
        kind: "searchShelf",
        label: "Search fridges in the marked supermarket",
        count: 2,
      },
    ],
    rewards: [
      { banknotes: 120 },
      { faction: "ashenTraders", reputation: 220 },
    ],
  },
  {
    id: QUEST_ID_FLOOR_MODEL,
    title: "Floor Model",
    description:
      "Kevin wants a department store counted before he sends a buyer. Search four shelves and two clothing racks, then tell him what is left. You keep what you pocket. One time.",
    faction: "ashenTraders",
    giver: "ashenTrader",
    dialogLineId: "jobs",
    iconItemId: "map",
    objectives: [
      {
        id: "search_shelves",
        kind: "searchShelf",
        label: "Search shelves in the marked department store",
        count: 4,
      },
      {
        id: "search_racks",
        kind: "searchShelf",
        label: "Search clothing racks in the marked department store",
        count: 2,
      },
    ],
    rewards: [
      { banknotes: 140 },
      { faction: "ashenTraders", reputation: 240 },
    ],
  },
  {
    id: QUEST_ID_SCALING_UP,
    title: "Scaling Up",
    description:
      "Kevin wants a warehouse the caravans can actually use. Accept the job, clear the walkers from the marked building, then report back. One time.",
    faction: "ashenTraders",
    giver: "ashenTrader",
    dialogLineId: "jobs",
    iconItemId: "map",
    objectives: [
      {
        id: "clear_warehouse",
        kind: "clearBuilding",
        label: "Clear walkers from the marked warehouse",
        buildingType: "warehouse",
        count: 1,
      },
    ],
    rewards: [
      { banknotes: 180 },
      { faction: "ashenTraders", reputation: 320 },
    ],
  },
  {
    id: QUEST_ID_SHORT_CRATE,
    title: "Short Crate",
    description:
      "The last caravan into Birchport was short a crate. The crew set the manifest down so they could argue about who had to carry the heavy one, then left without it. It is in a building in another city. Bring Kevin the page before he invents the numbers.",
    faction: "ashenTraders",
    giver: "ashenTrader",
    dialogLineId: "jobs",
    iconItemId: "journal",
    objectives: [
      {
        id: QUEST_SHORT_CRATE_FIND_OBJECTIVE,
        kind: "haveItem",
        label: "Find the caravan manifest",
        itemId: CARAVAN_MANIFEST_ITEM_ID,
        count: 1,
      },
      {
        id: "turn_in_manifest",
        kind: "turnInItem",
        label: "Hand the manifest to Kevin",
        itemId: CARAVAN_MANIFEST_ITEM_ID,
        quantity: 1,
        count: 1,
      },
    ],
    rewards: [
      { banknotes: 180 },
      { faction: "ashenTraders", reputation: 350 },
    ],
  },
  {
    id: QUEST_ID_LEFT_ON_THE_DESK,
    title: "Left on the Desk",
    description:
      "A militia patrol will not radio a supply order. The Red Order and bandits listen. They left the list in the manager's office of a department store in another city. Find it in the office furniture and bring it to Kevin. One time.",
    faction: "ashenTraders",
    giver: "ashenTrader",
    dialogLineId: "jobs",
    iconItemId: "journal",
    objectives: [
      {
        id: QUEST_LEFT_ON_THE_DESK_FIND_OBJECTIVE,
        kind: "haveItem",
        label: "Find the supply list",
        itemId: SUPPLY_LIST_ITEM_ID,
        count: 1,
      },
      {
        id: "turn_in_supply_list",
        kind: "turnInItem",
        label: "Hand the supply list to Kevin",
        itemId: SUPPLY_LIST_ITEM_ID,
        quantity: 1,
        count: 1,
      },
    ],
    rewards: [
      { banknotes: 180 },
      { faction: "ashenTraders", reputation: 360 },
    ],
  },
  {
    id: QUEST_ID_X_MARKS,
    title: "X Marks the Spot",
    description:
      "A trading caravan stopped answering the radio. Kevin has the last building they called from, in another city. Find what happened to them and bring back any note they left.",
    faction: "ashenTraders",
    giver: "ashenTrader",
    dialogLineId: "jobs",
    iconItemId: "journal",
    objectives: [
      {
        id: QUEST_X_MARKS_FIND_OBJECTIVE,
        kind: "haveItem",
        label: "Find the caravan's note",
        itemId: WAGON_NOTE_ITEM_ID,
        count: 1,
      },
      {
        id: "turn_in_note",
        kind: "turnInItem",
        label: "Hand the note to Kevin",
        itemId: WAGON_NOTE_ITEM_ID,
        quantity: 1,
        count: 1,
      },
    ],
    rewards: [
      { banknotes: 200 },
      { faction: "ashenTraders", reputation: 400 },
    ],
  },
  {
    id: QUEST_ID_PAID_AHEAD,
    title: "Paid Ahead",
    description:
      "Kevin wants to see every piece of a pistol before the stall tries to make one. Accept the job, then bring a frame, a slide, a small spring, and a trigger. One time.",
    faction: "ashenTraders",
    giver: "ashenTrader",
    dialogLineId: "jobs",
    iconItemId: "pistol_frame",
    objectives: [
      {
        id: "turn_in_frame",
        kind: "turnInItem",
        label: "Turn in a pistol frame",
        itemId: "pistol_frame",
        quantity: 1,
        count: 1,
      },
      {
        id: "turn_in_slide",
        kind: "turnInItem",
        label: "Turn in a pistol slide",
        itemId: "pistol_slide",
        quantity: 1,
        count: 1,
      },
      {
        id: "turn_in_spring",
        kind: "turnInItem",
        label: "Turn in a small spring",
        itemId: "small_spring",
        quantity: 1,
        count: 1,
      },
      {
        id: "turn_in_trigger",
        kind: "turnInItem",
        label: "Turn in a pistol trigger",
        itemId: "pistol_trigger",
        quantity: 1,
        count: 1,
      },
    ],
    rewards: [
      { banknotes: 220 },
      { faction: "ashenTraders", reputation: 400 },
    ],
  },
  {
    id: QUEST_ID_BOTH_BARRELS,
    title: "Both Barrels",
    description:
      "Kevin wants to see every piece of a shotgun before the stall tries to make one. Accept the job, then bring a receiver, a barrel, a stock, a large spring, and a trigger. One time.",
    faction: "ashenTraders",
    giver: "ashenTrader",
    dialogLineId: "jobs",
    iconItemId: "shotgun_receiver",
    objectives: [
      {
        id: "turn_in_receiver",
        kind: "turnInItem",
        label: "Turn in a shotgun receiver",
        itemId: "shotgun_receiver",
        quantity: 1,
        count: 1,
      },
      {
        id: "turn_in_barrel",
        kind: "turnInItem",
        label: "Turn in a shotgun barrel",
        itemId: "shotgun_barrel",
        quantity: 1,
        count: 1,
      },
      {
        id: "turn_in_stock",
        kind: "turnInItem",
        label: "Turn in a shotgun stock",
        itemId: "shotgun_stock",
        quantity: 1,
        count: 1,
      },
      {
        id: "turn_in_spring",
        kind: "turnInItem",
        label: "Turn in a large spring",
        itemId: "large_spring",
        quantity: 1,
        count: 1,
      },
      {
        id: "turn_in_trigger",
        kind: "turnInItem",
        label: "Turn in a shotgun trigger",
        itemId: "shotgun_trigger",
        quantity: 1,
        count: 1,
      },
    ],
    rewards: [
      { banknotes: 260 },
      { faction: "ashenTraders", reputation: 450 },
    ],
  },
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

export const QUEST_CUT_CLOTH: QuestDefinition = questFromMilitiaTask(
  RED_ORDER_CUT_CLOTH_TASK,
  {
    description:
      "Red Order cuts armbands out of rags. Accept the job, then bring six. Once a day.",
    giver: "redOrder",
    faction: "redOrder",
  },
);

export const QUEST_MELT_POT: QuestDefinition = questFromMilitiaTask(
  RED_ORDER_MELT_POT_TASK,
  {
    description:
      "They melt jewelry from empty houses. Accept the job, then bring one gold ring.",
    giver: "redOrder",
    faction: "redOrder",
  },
);

export const QUEST_REGISTRY: readonly QuestDefinition[] = [
  QUEST_FIRST_SWEEP,
  QUEST_ASHEN_PATROL_DOGTAGS,
  QUEST_CUT_CLOTH,
  QUEST_MELT_POT,
  QUEST_FLOOR_SPACE,
  ...QUEST_ASHEN_MILITIA_LIVE,
  QUEST_QUIET_STRETCH,
  QUEST_MISSING_PAIR,
  QUEST_DONT_FEED_THEM,
  QUEST_AISLE_CHECK,
  QUEST_THIN_THE_PACK,
  QUEST_DONT_HOCK_THEM,
  ...ASHEN_TRADER_QUESTS,
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
      const stashId =
        typeof obj.stashId === "string" &&
        obj.stashId.length > 0 &&
        obj.stashId.length <= 80
          ? obj.stashId
          : undefined;
      const marks = Array.isArray(obj.marks)
        ? obj.marks
            .filter((v): v is string => typeof v === "string" && v.length > 0 && v.length <= 80)
            .slice(0, 64)
        : undefined;
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
        stashId,
        marks: marks && marks.length > 0 ? marks : undefined,
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
        entry.stashId = undefined;
        entry.marks = undefined;
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

/**
 * Unfinished one-time jobs each giver posts at once. Repeatable jobs are not capped.
 */
export const ONE_TIME_QUESTS_LISTED = 2;

/**
 * Which one-time jobs to post, in catalog order.
 * Finished jobs are skipped, so the next one appears after a turn-in.
 * An accepted job stays posted until it is turned in, and it counts toward the cap.
 * If more than the cap are already accepted, those stay up and nothing new is added
 * until a slot opens.
 */
export function selectListedOneTimeQuestIds(
  orderedIds: readonly string[],
  statusOf: (questId: string) => QuestStatus,
  cap = ONE_TIME_QUESTS_LISTED,
): ReadonlySet<string> {
  const listed = new Set<string>();
  for (const id of orderedIds) {
    if (statusOf(id) === "active") listed.add(id);
  }
  if (listed.size >= cap) return listed;
  for (const id of orderedIds) {
    if (listed.size >= cap) break;
    if (listed.has(id)) continue;
    const status = statusOf(id);
    if (status === "completed" || status === "failed") continue;
    listed.add(id);
  }
  return listed;
}

/** One-time jobs this giver is posting right now. */
export function listedOneTimeQuestIds(
  state: PlayerQuestsState,
  giver: QuestGiverId,
): ReadonlySet<string> {
  const oneTime = QUEST_REGISTRY.filter(
    (q) => isOfferableQuest(q) && q.giver === giver && !q.repeatable,
  );
  return selectListedOneTimeQuestIds(
    oneTime.map((q) => q.id),
    (id) => questStatusOf(state, id),
    ONE_TIME_QUESTS_LISTED,
  );
}

/** Repeatable jobs are always posted. One-time jobs follow the board cap. */
export function isQuestListed(
  state: PlayerQuestsState,
  def: QuestDefinition | undefined,
): boolean {
  if (!isOfferableQuest(def) || !def) return false;
  if (def.repeatable) return true;
  if (!def.giver) return false;
  return listedOneTimeQuestIds(state, def.giver).has(def.id);
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

/**
 * While the tutorial is still running, Davis posts First Sweep and nothing else.
 * Turning that job in, or ending the tutorial, opens the rest of his board.
 * Jobs already accepted stay listed so they can be turned in.
 */
export function davisPostsOnlyFirstSweep(
  state: PlayerQuestsState,
  tutorialDone: boolean,
): boolean {
  if (tutorialDone) return false;
  const prev = state.quests[QUEST_ID_FIRST_SWEEP];
  if (prev?.status === "completed" || (prev?.timesCompleted ?? 0) > 0) {
    return false;
  }
  return true;
}

export function canAcceptQuest(
  state: PlayerQuestsState,
  questId: string,
  now = Date.now(),
): boolean {
  const def = getQuestDefinition(questId);
  if (!def || def.stub) return false;
  if (!isQuestListed(state, def)) return false;
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

export function questRewardBanknotes(def: QuestDefinition): number {
  let total = 0;
  for (const reward of def.rewards) total += reward.banknotes ?? 0;
  return total;
}

export function questRewardReputation(
  def: QuestDefinition,
  faction: QuestFaction,
): number {
  let total = 0;
  for (const reward of def.rewards) {
    if (reward.faction === faction) total += reward.reputation ?? 0;
  }
  return total;
}

/** Item stacks this job takes out of the pack on turn-in. */
export function questTurnInItems(
  def: QuestDefinition,
): { itemId: string; quantity: number; label: string }[] {
  const out: { itemId: string; quantity: number; label: string }[] = [];
  for (const obj of def.objectives) {
    if (obj.kind !== "turnInItem" || !obj.itemId) continue;
    out.push({
      itemId: obj.itemId,
      quantity: Math.max(1, obj.quantity ?? 1),
      label: obj.label,
    });
  }
  return out;
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
        stashId: undefined,
        marks: undefined,
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
        stashId: undefined,
        marks: undefined,
      },
    },
  };
}

export function setQuestStash(
  state: PlayerQuestsState,
  questId: string,
  stashId: string,
): PlayerQuestsState | null {
  const prev = state.quests[questId];
  if (!prev || prev.status !== "active") return null;
  if (prev.stashId === stashId) return null;
  return {
    ...state,
    quests: {
      ...state.quests,
      [questId]: { ...prev, stashId },
    },
  };
}

/**
 * Count a unique token toward an objective (a shelf id, for example).
 * Repeats of the same token do nothing.
 */
export function addQuestMark(
  state: PlayerQuestsState,
  questId: string,
  mark: string,
  objectiveId: string,
): PlayerQuestsState | null {
  const prev = state.quests[questId];
  const def = getQuestDefinition(questId);
  if (!def || !prev || prev.status !== "active") return null;
  if (!mark) return null;
  const obj = def.objectives.find((o) => o.id === objectiveId);
  if (!obj || obj.kind === "turnInItem") return null;
  const need = Math.max(1, obj.count ?? 1);
  if ((prev.progress[objectiveId] ?? 0) >= need) return null;
  if ((prev.marks ?? []).includes(mark)) return null;
  const marked: PlayerQuestsState = {
    ...state,
    quests: {
      ...state.quests,
      [questId]: {
        ...prev,
        marks: [...(prev.marks ?? []), mark].slice(-64),
      },
    },
  };
  return incrementQuestObjective(marked, questId, objectiveId);
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
  return questTargetBuildingLabel(prev.targetX, prev.targetY);
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
