/**
 * Linked National Guard story. Each quest is granted when the previous one
 * is turned in. They are not posted on the daily board.
 */

import type { PlayerQuestsState, QuestDefinition } from "./quests.js";
import { DAY_LENGTH_MS } from "./worldClock.js";

export const QUEST_ID_FOUND_ON_THE_ROAD = "ashen_story_found_on_the_road";
export const QUEST_ID_AYE_CAPTAIN = "ashen_story_aye_captain";
export const QUEST_ID_TWO_BEHIND = "ashen_story_two_behind";
export const QUEST_ID_DEAL_WITH_DEVIL = "ashen_story_deal_with_devil";
export const QUEST_ID_KNEW_THE_NAME = "ashen_story_knew_the_name";
export const QUEST_ID_HOLLANDS_DIARY = "ashen_story_hollands_diary";
export const QUEST_ID_BIRCHPORT_MARK = "ashen_story_birchport_mark";
export const QUEST_ID_FULL_COUNT = "ashen_story_full_count";
export const QUEST_ID_THE_CELL = "ashen_story_the_cell";
export const QUEST_ID_THE_KIT = "ashen_story_the_kit";
export const QUEST_ID_THE_HATCH = "ashen_story_the_hatch";
export const QUEST_ID_EVERY_MORNING = "ashen_story_every_morning";

export const STORY_LINE_WHAT_HAPPENED = "whathappened";
export const STORY_LINE_YOU_WANTED = "you_wanted";

export const STORY_INSPECT_MS = 5000;
export const INSPECT_BLOOD_ID_PREFIX = "inspect:blood:";

/** Story items. None of them can be sold. */
export const HOLLAND_DOGTAG_ITEM_ID = "holland_dogtag";
export const HOLLAND_DIARY_ITEM_ID = "holland_diary";
export const WANT_LIST_ITEM_ID = "want_list";
export const MISSING_ISSUE_ITEM_ID = "missing_issue";
export const HOLLAND_NOTE_ITEM_ID = "holland_note";
export const COLEMAN_SCRAP_ITEM_ID = "coleman_scrap";
export const COLEMAN_CONFESSION_ITEM_ID = "coleman_confession";

export const STORY_PAPER_ITEM_IDS = [
  HOLLAND_DOGTAG_ITEM_ID,
  HOLLAND_DIARY_ITEM_ID,
  WANT_LIST_ITEM_ID,
  MISSING_ISSUE_ITEM_ID,
  HOLLAND_NOTE_ITEM_ID,
  COLEMAN_SCRAP_ITEM_ID,
  COLEMAN_CONFESSION_ITEM_ID,
] as const;

export const STORY_OBJECTIVE_TALK_CLARK = "talk_clark";
export const STORY_OBJECTIVE_ASK_CLARK = "ask_clark";
export const STORY_OBJECTIVE_TALK_DAVIS = "talk_davis";
export const STORY_OBJECTIVE_ASK_DAVIS = "ask_davis";
export const STORY_OBJECTIVE_ENTER_HOUSE = "enter_house";
export const STORY_OBJECTIVE_FIND_NOTE = "find_note";
export const STORY_OBJECTIVE_ENTER_MOTEL = "enter_motel";
export const STORY_OBJECTIVE_INSPECT_BLOOD = "inspect_blood";
export const STORY_OBJECTIVE_FIND_TAG = "find_tag";
export const STORY_OBJECTIVE_SHOW_TAG = "show_tag";
export const STORY_OBJECTIVE_ENTER_HOLLAND = "enter_holland";
export const STORY_OBJECTIVE_FIND_DIARY = "find_diary";
export const STORY_OBJECTIVE_ENTER_DINER = "enter_diner";
export const STORY_OBJECTIVE_FIND_WANT_LIST = "find_want_list";
export const STORY_OBJECTIVE_ASK_KEVIN = "ask_kevin";
export const STORY_OBJECTIVE_GET_COUNT = "get_count";
export const STORY_OBJECTIVE_ENTER_STATION = "enter_station";
export const STORY_OBJECTIVE_CHECK_CELL = "check_cell";
export const STORY_OBJECTIVE_GET_KIT = "get_kit";
export const STORY_OBJECTIVE_OPEN_CELL = "open_cell";
export const STORY_OBJECTIVE_SEARCH_BODY = "search_body";
export const STORY_OBJECTIVE_SEARCH_BUNK = "search_bunk";
export const STORY_OBJECTIVE_ENTER_CELLAR = "enter_cellar";
export const STORY_OBJECTIVE_FREE_COLEMAN = "free_coleman";
export const STORY_OBJECTIVE_HEAR_COLEMAN = "hear_coleman";
export const STORY_OBJECTIVE_GET_CONFESSION = "get_confession";
export const STORY_OBJECTIVE_DELIVER_CONFESSION = "deliver_confession";

/** Kevin's full count takes three in-game hours on the world clock. */
export const STORY_COUNT_WAIT_MS = Math.round((DAY_LENGTH_MS / 24) * 3);

/** One in-game hour, in world-clock milliseconds. */
const STORY_GAME_HOUR_MS = DAY_LENGTH_MS / 24;

/**
 * Older readyAt values are unix timestamps from the wall clock.
 * A world-clock reading never gets this large.
 */
const STORY_COUNT_WALL_CLOCK_MS = 1_000_000_000_000;

/**
 * World-clock moment Kevin finishes the count.
 * Older saves stored a wall-clock deadline. Those keep whatever real time
 * is still left, measured from now on the world clock, and never more than
 * the current three-hour wait.
 */
export function resolveStoryCountReadyAt(
  stored: number | undefined,
  worldNow: number,
  wallNow: number,
): number {
  if (stored == null || !Number.isFinite(stored) || stored <= 0) return 0;
  let ready = stored;
  if (stored >= STORY_COUNT_WALL_CLOCK_MS) {
    const remain = Math.max(0, stored - wallNow);
    ready = worldNow + remain;
  }
  const cap = worldNow + STORY_COUNT_WAIT_MS;
  return ready > cap ? cap : ready;
}

/** "3 more hours", "1 hour and 20 minutes", "another minute". */
export function formatStoryCountRemaining(remainingMs: number): string {
  const ms = Math.max(0, remainingMs);
  const minuteMs = STORY_GAME_HOUR_MS / 60;
  let hours = Math.floor(ms / STORY_GAME_HOUR_MS);
  let minutes = Math.ceil((ms - hours * STORY_GAME_HOUR_MS) / minuteMs);
  if (minutes >= 60) {
    hours += 1;
    minutes = 0;
  }
  if (hours <= 0 && minutes <= 0) minutes = 1;

  const hourWord = hours === 1 ? "hour" : "hours";
  const minuteWord = minutes === 1 ? "minute" : "minutes";
  if (hours > 0 && minutes > 0) {
    return `${hours} ${hourWord} and ${minutes} ${minuteWord}`;
  }
  if (hours === 1) return "another hour";
  if (hours > 1) return `${hours} more hours`;
  if (minutes === 1) return "another minute";
  return `${minutes} more minutes`;
}

export function storyCountWaitingReply(remainingMs: number): string {
  return `Not yet. I'm still going through the shelves. Give me ${formatStoryCountRemaining(remainingMs)}.`;
}

/** Per-player story NPCs. Never simulated, never hurt, seen only by their owner. */
export const STORY_NPC_ID_PREFIX = "story-npc:";

export function isStoryNpcId(id: string): boolean {
  return id.startsWith(STORY_NPC_ID_PREFIX);
}

export function colemanStoryNpcId(playerId: string): string {
  return `${STORY_NPC_ID_PREFIX}coleman:${playerId}`;
}

export function isColemanStoryNpcId(id: string): boolean {
  return id.startsWith(`${STORY_NPC_ID_PREFIX}coleman:`);
}

export const COLEMAN_NAME = "Sergeant Coleman";
/** Kneeling with his hands tied, until the player cuts him loose. */
export const COLEMAN_ANIM_KNEEL = "kneel";
/** Standing, unarmed. */
export const COLEMAN_ANIM_STAND = "idle-unarmed";

export const STORY_FOUND_REPLY =
  "A week ago a patrol found you on the road, hurt bad. They carried you back here and I put you together again. Sergeant Coleman came in every day while you were under. He sat with you a while, hardly said a word, then went back out on patrol. I don't have any spare clothes to give you. Search a department store or a house if you want something to wear. Captain Davis runs the National Guard hub in Birchport. He is in the barracks mess hall, and he wants to speak to you about what happened.";

export const STORY_FOUND_NO_ROOM =
  "I would send you out with a map and a meal, but you have no free pocket. Make room, then ask me again.";

export const STORY_DAVIS_REPLY =
  "I wanted to know what kind of trouble you got yourself into. The patrol that brought you in was Sergeant Coleman and Corporal Holland. Both have been missing since yesterday, and neither is answering the radio. That is not like them. They've been National Guard since before the world turned to shit. It is a shame you do not remember what happened before they brought you to the hospital.";

export const STORY_BLOOD_BRIEF =
  "Blood on the carpet, and Holland's tag. I won't ask where it turned up. Something went wrong in that room, and the Red Order trade out of that end of Forestford. I'll hold on to the tag for now.";

const STORY_KNEW_NAME_BRIEF =
  "They knew his name, and they wanted nothing to do with his tag. Anyone who didn't know him would have taken it for the bounty. I'll keep it this time. Holland kept a diary. His house is marked. Go through it.";

const STORY_DIARY_BRIEF =
  "Coleman never told me who he was meeting out there, and I never asked. Holland waited at a diner while he went in. I want to know what was in that diner.";

const STORY_WANT_LIST_BRIEF =
  "Birchport stamps, and a shopping list in a hand I don't know. Somebody is walking our issue out the back door. Kevin's people keep the stores at the market. Tell him I sent you.";

const STORY_FULL_COUNT_BRIEF =
  "Weeks of it, a little at a time, so nobody would see the hole. And a battery with our stamp ground off, sold out of the police station in East Forestford. I've marked it. Go and look.";

const STORY_CELL_BRIEF =
  "Our issue, our jacket, and a body nobody can name. I won't guess who it is. Kevin will have something for you that opens that cell. Go and see him.";

const STORY_KIT_BRIEF =
  "Holland. And his note says things about Coleman I don't want to believe. This scrap is in Coleman's own hand. North of the diner, the west house of a pair, a hatch in the alley. He's alive, or he was. I've marked it. Bring him in, or bring me the truth. Keep the kit.";

const STORY_EVERY_MORNING_BRIEF =
  "\"I sold patrol issue out of my own pack. I left a stranger on the road because my buyer told me to. Holland made me go back. I went to the hospital every morning to see if that stranger knew my face. Holland followed me to the motel. They shot him and took us both. He died in that cell.\" He signed it. We bury Holland behind the barracks tonight. A detail is bringing Coleman in, and he goes east for court martial. You won't see him again. You found every piece of this. Thank you.";

/** Davis's words when a story quest is handed in. */
export const STORY_TURN_IN_HEADERS: Readonly<Record<string, string>> = {
  [QUEST_ID_DEAL_WITH_DEVIL]: STORY_BLOOD_BRIEF,
  [QUEST_ID_KNEW_THE_NAME]: STORY_KNEW_NAME_BRIEF,
  [QUEST_ID_HOLLANDS_DIARY]: STORY_DIARY_BRIEF,
  [QUEST_ID_BIRCHPORT_MARK]: STORY_WANT_LIST_BRIEF,
  [QUEST_ID_FULL_COUNT]: STORY_FULL_COUNT_BRIEF,
  [QUEST_ID_THE_CELL]: STORY_CELL_BRIEF,
  [QUEST_ID_THE_KIT]: STORY_KIT_BRIEF,
  [QUEST_ID_EVERY_MORNING]: STORY_EVERY_MORNING_BRIEF,
};

/** Items Davis takes when the quest is handed in. */
export const STORY_TURN_IN_ITEMS: Readonly<Record<string, readonly string[]>> = {
  [QUEST_ID_TWO_BEHIND]: ["coleman_note"],
  [QUEST_ID_DEAL_WITH_DEVIL]: [HOLLAND_DOGTAG_ITEM_ID],
  [QUEST_ID_KNEW_THE_NAME]: [HOLLAND_DOGTAG_ITEM_ID],
  [QUEST_ID_HOLLANDS_DIARY]: [HOLLAND_DIARY_ITEM_ID],
  [QUEST_ID_BIRCHPORT_MARK]: [WANT_LIST_ITEM_ID],
  [QUEST_ID_FULL_COUNT]: [MISSING_ISSUE_ITEM_ID],
  [QUEST_ID_THE_KIT]: [HOLLAND_NOTE_ITEM_ID, COLEMAN_SCRAP_ITEM_ID],
  [QUEST_ID_EVERY_MORNING]: [COLEMAN_CONFESSION_ITEM_ID],
};

export const STORY_ITEM_LABELS: Readonly<Record<string, string>> = {
  coleman_note: "Note for Coleman",
  [HOLLAND_DOGTAG_ITEM_ID]: "Holland's Dog Tag",
  [HOLLAND_DIARY_ITEM_ID]: "Holland's Diary",
  [WANT_LIST_ITEM_ID]: "Want List",
  [MISSING_ISSUE_ITEM_ID]: "Missing Issue",
  [HOLLAND_NOTE_ITEM_ID]: "Holland's Note",
  [COLEMAN_SCRAP_ITEM_ID]: "Coleman's Scrap",
  [COLEMAN_CONFESSION_ITEM_ID]: "Coleman's Confession",
};

/** Shown when a story paper lands in the pack. */
export const STORY_FIND_TEXT: Readonly<Record<string, string>> = {
  [HOLLAND_DOGTAG_ITEM_ID]:
    "A dog tag, chain snapped. CPL HOLLAND. It must have come off in a struggle.",
  [HOLLAND_DIARY_ITEM_ID]:
    "Holland's last entry: \"Sgt Coleman ordered me onto the Forestford road again. Motel first. If he runs long, I wait at the diner. He ordered me not to come in after him. He didn't say who he is meeting.\"",
  [WANT_LIST_ITEM_ID]:
    "Birchport issue on the booth table: an ammo can, field dressings and a battery, all stamped. Under the ammo can is a list in someone else's hand: rounds, batteries, antibiotics.",
  [HOLLAND_NOTE_ITEM_ID]:
    "Holland's note: \"He told me to wait at the diner and not follow. I followed him to the motel. A week ago he told me to stay with the truck. I heard a shout. He came back with blood on his cuff and said it was a fence. Then we found you. He didn't want to load you. I made him. He has been at the hospital every morning. He said he was checking on you. I don't think that's all of it.\"",
  [COLEMAN_SCRAP_ITEM_ID]:
    "A scrap in Coleman's hand: \"They're moving me. North of the diner. West house of the pair. Not the front door. Hatch in the alley on the east side.\"",
  [COLEMAN_CONFESSION_ITEM_ID]:
    "Coleman's confession, every page signed.",
};

export const STORY_STATION_ENTER_TEXT =
  "Birchport issue is stacked by the desks, every stamp scraped off.";

export const STORY_CELL_LOOK_TEXT =
  "The holding cell is locked. A body lies inside, wrapped in a bedsheet and tied off at the neck and ankles. A Birchport patrol jacket is folded on the bunk. No tag that you can see.";

export const STORY_BODY_TEXT =
  "You loosen the sheet. It's Corporal Holland. A folded note is tucked inside his shirt.";

export const STORY_BODY_DONE_TEXT = "Corporal Holland. You have already searched him.";

export const STORY_BUNK_EMPTY_TEXT = "Nothing else under the bunk.";

export const STORY_NO_ROOM_TEXT = "No free pocket. Make room first.";

/** Davis hands Holland's tag back when Q5 is accepted. */
export const STORY_TAG_RETURNED_TEXT = "Davis hands Holland's tag back.";

export const QUEST_FOUND_ON_THE_ROAD: QuestDefinition = {
  id: QUEST_ID_FOUND_ON_THE_ROAD,
  title: "Found on the Road",
  description:
    "You were found injured a week ago. A National Guard patrol carried you to the Birchport hospital. Speak to Doctor Clark and find out what happened to you.",
  faction: "ashenMilitia",
  giver: "ashenDoctor",
  story: true,
  iconItemId: "map",
  objectives: [
    {
      id: STORY_OBJECTIVE_TALK_CLARK,
      kind: "story",
      label: "Speak to Doctor Clark",
      count: 1,
    },
    {
      id: STORY_OBJECTIVE_ASK_CLARK,
      kind: "story",
      label: "Find out what happened to you",
      count: 1,
    },
  ],
  rewards: [
    { itemId: "map", quantity: 1 },
    { itemId: "water", quantity: 1 },
    { itemId: "canned_tuna", quantity: 1 },
    { faction: "ashenMilitia", reputation: 40 },
  ],
};

export const QUEST_AYE_CAPTAIN: QuestDefinition = {
  id: QUEST_ID_AYE_CAPTAIN,
  title: "Aye, aye, Captain",
  description:
    "Captain Davis wants to speak to you. He runs the National Guard hub in Birchport from the barracks mess hall. Go and find out what he wants.",
  faction: "ashenMilitia",
  giver: "ashenDoctor",
  story: true,
  iconItemId: "map",
  objectives: [
    {
      id: STORY_OBJECTIVE_TALK_DAVIS,
      kind: "story",
      label: "Speak to Captain Davis",
      count: 1,
    },
    {
      id: STORY_OBJECTIVE_ASK_DAVIS,
      kind: "story",
      label: "Find out what Captain Davis wants from you",
      count: 1,
    },
  ],
  rewards: [{ faction: "ashenMilitia", reputation: 50 }],
};

export const QUEST_TWO_BEHIND: QuestDefinition = {
  id: QUEST_ID_TWO_BEHIND,
  title: "Two Behind It",
  description:
    "If you want the National Guard to trust you, help find the patrol that saved you. Sergeant Coleman kept a house in Birchport. Something he left there may say where he went. Look through the rooms and bring what you find to Captain Davis.",
  faction: "ashenMilitia",
  giver: "ashenCaptain",
  story: true,
  iconItemId: "coleman_note",
  objectives: [
    {
      id: STORY_OBJECTIVE_ENTER_HOUSE,
      kind: "story",
      label: "Go to Sergeant Coleman's house",
      count: 1,
    },
    {
      id: STORY_OBJECTIVE_FIND_NOTE,
      kind: "story",
      label: "Look through Coleman's house for what he left",
      count: 1,
    },
  ],
  rewards: [{ faction: "ashenMilitia", reputation: 60 }],
};

export const QUEST_DEAL_WITH_DEVIL: QuestDefinition = {
  id: QUEST_ID_DEAL_WITH_DEVIL,
  title: "A Deal with the Devil",
  description:
    "The note told Coleman to meet its writer at the motel in East Forestford at midday the next day. Davis does not know when it was written. Coleman asked for patrol routes toward East Forestford last week. Check the motel for a sign of him or Holland, then tell Davis what you found.",
  faction: "ashenMilitia",
  giver: "ashenCaptain",
  story: true,
  iconItemId: "map",
  objectives: [
    {
      id: STORY_OBJECTIVE_ENTER_MOTEL,
      kind: "story",
      label: "Go to the motel in East Forestford",
      count: 1,
    },
    {
      id: STORY_OBJECTIVE_INSPECT_BLOOD,
      kind: "story",
      label: "Search for clues about Sergeant Coleman",
      count: 1,
    },
    {
      id: STORY_OBJECTIVE_FIND_TAG,
      kind: "story",
      label: "Search the room for anything else",
      count: 1,
    },
  ],
  rewards: [{ faction: "ashenMilitia", reputation: 70 }],
};

export const QUEST_KNEW_THE_NAME: QuestDefinition = {
  id: QUEST_ID_KNEW_THE_NAME,
  title: "They Knew the Name",
  description:
    "Davis gives Holland's tag back. The Red Order run the supermarket in Birchport, the building with the boarded up windows. Offer to sell them the tag, and say you found it scavenging in East Forestford. Watch how they take it, then bring the tag back to Davis.",
  faction: "ashenMilitia",
  giver: "ashenCaptain",
  story: true,
  iconItemId: HOLLAND_DOGTAG_ITEM_ID,
  objectives: [
    {
      id: STORY_OBJECTIVE_SHOW_TAG,
      kind: "story",
      label: "Offer Holland's tag to the Red Order at the Birchport supermarket",
      count: 1,
    },
  ],
  rewards: [
    { banknotes: 40 },
    { faction: "ashenMilitia", reputation: 80 },
  ],
};

export const QUEST_HOLLANDS_DIARY: QuestDefinition = {
  id: QUEST_ID_HOLLANDS_DIARY,
  title: "Holland's Diary",
  description:
    "Corporal Holland kept a diary. Davis has marked his house in Birchport. Look through the rooms and bring the diary to Davis.",
  faction: "ashenMilitia",
  giver: "ashenCaptain",
  story: true,
  iconItemId: HOLLAND_DIARY_ITEM_ID,
  objectives: [
    {
      id: STORY_OBJECTIVE_ENTER_HOLLAND,
      kind: "story",
      label: "Go to Corporal Holland's house",
      count: 1,
    },
    {
      id: STORY_OBJECTIVE_FIND_DIARY,
      kind: "story",
      label: "Look through Holland's house for his diary",
      count: 1,
    },
  ],
  rewards: [{ faction: "ashenMilitia", reputation: 70 }],
};

export const QUEST_BIRCHPORT_MARK: QuestDefinition = {
  id: QUEST_ID_BIRCHPORT_MARK,
  title: "Birchport Mark",
  description:
    "Holland waited at the diner in East Forestford while Coleman went into the motel. Davis has marked the diner. Look through it for anything left behind and bring it to Davis.",
  faction: "ashenMilitia",
  giver: "ashenCaptain",
  story: true,
  iconItemId: WANT_LIST_ITEM_ID,
  objectives: [
    {
      id: STORY_OBJECTIVE_ENTER_DINER,
      kind: "story",
      label: "Go to the diner in East Forestford",
      count: 1,
    },
    {
      id: STORY_OBJECTIVE_FIND_WANT_LIST,
      kind: "story",
      label: "Look through the diner",
      count: 1,
    },
  ],
  rewards: [{ faction: "ashenMilitia", reputation: 80 }],
};

export const QUEST_FULL_COUNT: QuestDefinition = {
  id: QUEST_ID_FULL_COUNT,
  title: "Full Count",
  description:
    "The Ashen Traders keep Birchport's stores at the market. Tell Kevin that Davis sent you about missing supplies, then bring whatever he finds back to Davis.",
  faction: "ashenMilitia",
  giver: "ashenCaptain",
  story: true,
  iconItemId: MISSING_ISSUE_ITEM_ID,
  objectives: [
    {
      id: STORY_OBJECTIVE_ASK_KEVIN,
      kind: "story",
      label: "Tell Kevin at the market that Davis sent you",
      count: 1,
    },
    {
      id: STORY_OBJECTIVE_GET_COUNT,
      kind: "story",
      label: "Collect Kevin's inventory count",
      count: 1,
    },
  ],
  rewards: [
    { banknotes: 40 },
    { faction: "ashenMilitia", reputation: 80 },
  ],
};

export const QUEST_THE_CELL: QuestDefinition = {
  id: QUEST_ID_THE_CELL,
  title: "The Cell",
  description:
    "The battery with the ground off stamp came from the police station in East Forestford. Davis has marked it. Find out what is going on there and report back.",
  faction: "ashenMilitia",
  giver: "ashenCaptain",
  story: true,
  iconItemId: "map",
  objectives: [
    {
      id: STORY_OBJECTIVE_ENTER_STATION,
      kind: "story",
      label: "Go to the police station in East Forestford",
      count: 1,
    },
    {
      id: STORY_OBJECTIVE_CHECK_CELL,
      kind: "story",
      label: "Check the holding cell",
      count: 1,
    },
  ],
  rewards: [
    { banknotes: 50 },
    { faction: "ashenMilitia", reputation: 90 },
  ],
};

export const QUEST_THE_KIT: QuestDefinition = {
  id: QUEST_ID_THE_KIT,
  title: "The Kit",
  description:
    "Davis has told Kevin to give you a lockpick kit. Collect it at the market, open the holding cell at the East Forestford police station, and find out who is in there.",
  faction: "ashenMilitia",
  giver: "ashenCaptain",
  story: true,
  iconItemId: "lockpick",
  objectives: [
    {
      id: STORY_OBJECTIVE_GET_KIT,
      kind: "story",
      label: "Collect the lockpick kit from Kevin",
      count: 1,
    },
    {
      id: STORY_OBJECTIVE_OPEN_CELL,
      kind: "story",
      label: "Get into the holding cell",
      count: 1,
    },
    {
      id: STORY_OBJECTIVE_SEARCH_BODY,
      kind: "story",
      label: "Search the body",
      count: 1,
    },
    {
      id: STORY_OBJECTIVE_SEARCH_BUNK,
      kind: "story",
      label: "Search the bunk",
      count: 1,
    },
  ],
  rewards: [
    { itemId: "ammo_762x39", quantity: 20 },
    { faction: "ashenMilitia", reputation: 120 },
  ],
};

export const QUEST_THE_HATCH: QuestDefinition = {
  id: QUEST_ID_THE_HATCH,
  title: "The Hatch",
  description:
    "Coleman's scrap points to a house north of the diner in East Forestford: the west house of the pair, with a hatch in the alley on its east side. Davis has marked it. Go down and find him.",
  faction: "ashenMilitia",
  giver: "ashenCaptain",
  story: true,
  iconItemId: COLEMAN_SCRAP_ITEM_ID,
  objectives: [
    {
      id: STORY_OBJECTIVE_ENTER_CELLAR,
      kind: "story",
      label: "Go down the hatch",
      count: 1,
    },
    {
      id: STORY_OBJECTIVE_FREE_COLEMAN,
      kind: "story",
      label: "Cut Sergeant Coleman loose",
      count: 1,
    },
    {
      id: STORY_OBJECTIVE_HEAR_COLEMAN,
      kind: "story",
      label: "Hear Coleman out",
      count: 3,
    },
    {
      id: STORY_OBJECTIVE_GET_CONFESSION,
      kind: "story",
      label: "Get Coleman's confession in writing",
      count: 1,
    },
  ],
  rewards: [{ faction: "ashenMilitia", reputation: 100 }],
};

export const QUEST_EVERY_MORNING: QuestDefinition = {
  id: QUEST_ID_EVERY_MORNING,
  title: "Every Morning",
  description:
    "Coleman wrote it all down. Take his confession to Captain Davis in the barracks mess hall.",
  faction: "ashenMilitia",
  giver: "ashenCaptain",
  story: true,
  iconItemId: COLEMAN_CONFESSION_ITEM_ID,
  objectives: [
    {
      id: STORY_OBJECTIVE_DELIVER_CONFESSION,
      kind: "story",
      label: "Carry Coleman's confession",
      count: 1,
    },
  ],
  rewards: [
    { banknotes: 100 },
    { faction: "ashenMilitia", reputation: 160 },
  ],
};

export const STORY_QUESTS: readonly QuestDefinition[] = [
  QUEST_FOUND_ON_THE_ROAD,
  QUEST_AYE_CAPTAIN,
  QUEST_TWO_BEHIND,
  QUEST_DEAL_WITH_DEVIL,
  QUEST_KNEW_THE_NAME,
  QUEST_HOLLANDS_DIARY,
  QUEST_BIRCHPORT_MARK,
  QUEST_FULL_COUNT,
  QUEST_THE_CELL,
  QUEST_THE_KIT,
  QUEST_THE_HATCH,
  QUEST_EVERY_MORNING,
];

export function isStoryQuestId(questId: string): boolean {
  return STORY_QUESTS.some((quest) => quest.id === questId);
}

function storyActive(state: PlayerQuestsState, questId: string): boolean {
  return state.quests[questId]?.status === "active";
}

function storyStep(
  state: PlayerQuestsState,
  questId: string,
  objectiveId: string,
): number {
  return state.quests[questId]?.progress[objectiveId] ?? 0;
}

function storyFlag(state: PlayerQuestsState, questId: string, flag: string): boolean {
  return state.quests[questId]?.flags?.[flag] === true;
}

/** Holland's cross gets its name once Every Morning is handed in. */
export function isHollandBuried(state: PlayerQuestsState): boolean {
  return (state.quests[QUEST_ID_EVERY_MORNING]?.timesCompleted ?? 0) > 0;
}

/** Coleman is in the cellar from The Hatch until Every Morning is handed in. */
export function colemanInCellarFor(state: PlayerQuestsState): boolean {
  if (storyActive(state, QUEST_ID_THE_HATCH)) return true;
  return storyActive(state, QUEST_ID_EVERY_MORNING);
}

export function colemanFreedFor(state: PlayerQuestsState): boolean {
  if (!storyActive(state, QUEST_ID_THE_HATCH)) {
    return colemanInCellarFor(state);
  }
  return storyStep(state, QUEST_ID_THE_HATCH, STORY_OBJECTIVE_FREE_COLEMAN) >= 1;
}

export type StorySpeaker = "redOrder" | "kevin" | "coleman";

export type StorySpeechLine = {
  id: string;
  player: string;
  /** Shown until the server answers. Omit when the answer depends on server state. */
  reply?: string;
};

export const STORY_LINE_SHOW_TAG = "story_show_tag";
export const STORY_LINE_DAVIS_SENT = "story_davis_sent";
export const STORY_LINE_COUNT_DONE = "story_count_done";
export const STORY_LINE_KIT = "story_kit";
export const STORY_LINE_COLEMAN_FREE = "story_coleman_free";
export const STORY_LINE_COLEMAN_ROAD = "story_coleman_road";
export const STORY_LINE_COLEMAN_HOSPITAL = "story_coleman_hospital";
export const STORY_LINE_COLEMAN_HOLLAND = "story_coleman_holland";
export const STORY_LINE_COLEMAN_CONFESS = "story_coleman_confess";
export const STORY_LINE_COLEMAN_WAIT = "story_coleman_wait";

/** Quest flag set when each part of Coleman's story has been heard. */
export const COLEMAN_HEARD_FLAGS: Readonly<Record<string, string>> = {
  [STORY_LINE_COLEMAN_ROAD]: "heardRoad",
  [STORY_LINE_COLEMAN_HOSPITAL]: "heardHospital",
  [STORY_LINE_COLEMAN_HOLLAND]: "heardHolland",
};

export const STORY_REPLY_SHOW_TAG =
  "Let me see that. Holland. Where did you say you got this? Scavenging. In East Forestford. We're not buying it. Put it away and get out, before I start asking how it got into your hands.";

export const STORY_REPLY_SHOW_TAG_WRONG_PLACE =
  "Never seen the name. Whatever you're selling, take it to the supermarket in Birchport.";

export const STORY_REPLY_DAVIS_SENT =
  "Missing? Not that I've noticed, and I notice most things. We're due a full count anyway. Give me three hours to get through the stock, then come back and I'll tell you what's short.";

export const STORY_REPLY_COUNT_READY =
  "Done, and it's worse than I thought. Patrol issue, mostly. Rounds, batteries, dressings. Never more than a little at a time, going back weeks. Here's the list. One more thing. A man tried to sell me a battery last month with the Birchport stamp ground off the casing. Said he got it from the police station in East Forestford. I sent him on his way.";

export const STORY_REPLY_COUNT_NO_ROOM =
  "The list is ready, but your hands are full. Make room and ask me again.";

export const STORY_REPLY_KIT =
  "The lockpick. Davis radioed ahead. Here. It's a decent kit, but it wears down, so don't waste it on every cupboard you pass.";

export const STORY_REPLY_KIT_NO_ROOM =
  "I have it ready, but you've no free pocket. I'll hold it here until you do.";

export const STORY_REPLY_COLEMAN_FREE =
  "You. Of all people. Thank you. I lost the feeling in my hands two days ago. They'll be back at dusk, so listen. I've had a long time down here to decide what I'd say to whoever came.";

export const STORY_REPLY_COLEMAN_ROAD =
  "I'd been selling patrol issue out of my own pack for months. Rounds, batteries, dressings. My buyer is Red Order, though you'd never know it. He keeps the armband in his pocket. That day you walked up on the hand-off. He told me to deal with you. I hit you and left you in the ditch. Holland heard the shout. He made me go back, and he made me load you into the truck.";

export const STORY_REPLY_COLEMAN_HOSPITAL =
  "Every morning. Clark thought I was being kind. I sat there watching your face for the moment you knew mine. If you had, I don't know what I would have done. You never did. That's the only reason you're standing here.";

export const STORY_REPLY_COLEMAN_HOLLAND =
  "I told him to wait at the diner. He followed me to the motel instead. The buyer had two men with him. Holland came through the door and they shot him. His tag came off in the fight and nobody could find it. They locked us both in that cell. He lasted two nights. When you put his name on their table, they knew someone had been in that room.";

export const STORY_REPLY_COLEMAN_CONFESS =
  "Give me your pen. There. All of it, and my name at the bottom. Take it to Davis. Tell him Holland was the better soldier. I'm not running. Tell him where I am.";

export const STORY_REPLY_COLEMAN_WAIT =
  "Then I'll be here. Go on. He'll want to read it himself.";

/** Story speech options for this speaker, given the player's quests and pack. */
export function storySpeechLines(
  speaker: StorySpeaker,
  state: PlayerQuestsState,
  itemCount: (itemId: string) => number,
): StorySpeechLine[] {
  const lines: StorySpeechLine[] = [];
  if (speaker === "redOrder") {
    if (
      storyActive(state, QUEST_ID_KNEW_THE_NAME) &&
      storyStep(state, QUEST_ID_KNEW_THE_NAME, STORY_OBJECTIVE_SHOW_TAG) < 1 &&
      itemCount(HOLLAND_DOGTAG_ITEM_ID) >= 1
    ) {
      lines.push({
        id: STORY_LINE_SHOW_TAG,
        player: "Found this tag scavenging in East Forestford. Want it?",
      });
    }
    return lines;
  }
  if (speaker === "kevin") {
    if (storyActive(state, QUEST_ID_FULL_COUNT)) {
      if (storyStep(state, QUEST_ID_FULL_COUNT, STORY_OBJECTIVE_ASK_KEVIN) < 1) {
        lines.push({
          id: STORY_LINE_DAVIS_SENT,
          player: "Captain Davis sent me. He thinks supplies are going missing.",
          reply: STORY_REPLY_DAVIS_SENT,
        });
      } else if (
        storyStep(state, QUEST_ID_FULL_COUNT, STORY_OBJECTIVE_GET_COUNT) < 1 ||
        itemCount(MISSING_ISSUE_ITEM_ID) < 1
      ) {
        lines.push({ id: STORY_LINE_COUNT_DONE, player: "Is the count done?" });
      }
    }
    if (
      storyActive(state, QUEST_ID_THE_KIT) &&
      storyStep(state, QUEST_ID_THE_KIT, STORY_OBJECTIVE_GET_KIT) < 1
    ) {
      lines.push({ id: STORY_LINE_KIT, player: "Davis said you have something for me." });
    }
    return lines;
  }
  if (storyActive(state, QUEST_ID_THE_HATCH)) {
    if (!colemanFreedFor(state)) {
      lines.push({
        id: STORY_LINE_COLEMAN_FREE,
        player: "Sergeant Coleman? Hold still. I'll cut you loose.",
        reply: STORY_REPLY_COLEMAN_FREE,
      });
      return lines;
    }
    lines.push(
      {
        id: STORY_LINE_COLEMAN_ROAD,
        player: "What happened on the road?",
        reply: STORY_REPLY_COLEMAN_ROAD,
      },
      {
        id: STORY_LINE_COLEMAN_HOSPITAL,
        player: "You came to the hospital every day.",
        reply: STORY_REPLY_COLEMAN_HOSPITAL,
      },
      {
        id: STORY_LINE_COLEMAN_HOLLAND,
        player: "What happened to Holland?",
        reply: STORY_REPLY_COLEMAN_HOLLAND,
      },
    );
    const heardAll = Object.values(COLEMAN_HEARD_FLAGS).every((flag) =>
      storyFlag(state, QUEST_ID_THE_HATCH, flag),
    );
    if (heardAll) {
      lines.push({
        id: STORY_LINE_COLEMAN_CONFESS,
        player: "Write it down. All of it. Davis gets every word.",
      });
    }
    return lines;
  }
  if (storyActive(state, QUEST_ID_EVERY_MORNING)) {
    if (itemCount(COLEMAN_CONFESSION_ITEM_ID) < 1) {
      lines.push({
        id: STORY_LINE_COLEMAN_CONFESS,
        player: "I lost your confession. Write it again.",
      });
    }
    lines.push({
      id: STORY_LINE_COLEMAN_WAIT,
      player: "Davis will send a detail for you.",
      reply: STORY_REPLY_COLEMAN_WAIT,
    });
  }
  return lines;
}
