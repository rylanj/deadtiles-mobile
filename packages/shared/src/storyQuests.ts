/**
 * Linked Ashen Militia story. Each quest is granted when the previous one
 * is turned in. They are not posted on the daily board.
 */

import type { QuestDefinition } from "./quests.js";

export const QUEST_ID_FOUND_ON_THE_ROAD = "ashen_story_found_on_the_road";
export const QUEST_ID_AYE_CAPTAIN = "ashen_story_aye_captain";
export const QUEST_ID_TWO_BEHIND = "ashen_story_two_behind";
export const QUEST_ID_DEAL_WITH_DEVIL = "ashen_story_deal_with_devil";

export const STORY_LINE_WHAT_HAPPENED = "whathappened";
export const STORY_LINE_YOU_WANTED = "you_wanted";

export const STORY_INSPECT_MS = 5000;
export const INSPECT_BLOOD_ID_PREFIX = "inspect:blood:";

export const STORY_OBJECTIVE_TALK_CLARK = "talk_clark";
export const STORY_OBJECTIVE_ASK_CLARK = "ask_clark";
export const STORY_OBJECTIVE_TALK_DAVIS = "talk_davis";
export const STORY_OBJECTIVE_ASK_DAVIS = "ask_davis";
export const STORY_OBJECTIVE_ENTER_HOUSE = "enter_house";
export const STORY_OBJECTIVE_FIND_NOTE = "find_note";
export const STORY_OBJECTIVE_ENTER_MOTEL = "enter_motel";
export const STORY_OBJECTIVE_INSPECT_BLOOD = "inspect_blood";

export const STORY_FOUND_REPLY =
  "A week ago a patrol found you on the road, hurt bad. They carried you back here and I put you together again. I don't have any spare clothes to give you. Search a department store or a house if you want something to wear. Captain Davis runs the Birchport detachment. He is in the barracks mess hall, and he wants to speak to you about what happened.";

export const STORY_FOUND_NO_ROOM =
  "I would send you out with a map and a meal, but you have no free pocket. Make room, then ask me again.";

export const STORY_DAVIS_REPLY =
  "I wanted to know what kind of trouble you got yourself into. The patrol that rescued you has since gone missing. They have not answered a radio call. That is not like them. They were with the National Guard before the world turned to shit. It is a shame you do not remember what happened before they brought you to the hospital.";

export const STORY_BLOOD_BRIEF =
  "Blood on the carpet, and no Coleman. That meeting did not end clean. Give me time before I send you after the rest of it.";

export const QUEST_FOUND_ON_THE_ROAD: QuestDefinition = {
  id: QUEST_ID_FOUND_ON_THE_ROAD,
  title: "Found on the Road",
  description:
    "You were found injured a week ago. An Ashen Militia patrol carried you to the Birchport hospital. Speak to Doctor Clark and find out what happened to you.",
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
    "Captain Davis wants to speak to you. He runs the Birchport detachment from the barracks mess hall. Go and find out what he wants.",
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
    "If you want the Ashen Militia to trust you, help find the patrol that saved you. Search Sergeant Coleman's house in Birchport for anything that helps. You do not know which piece of furniture matters. Bring what you find back to Captain Davis.",
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
      label: "Search Sergeant Coleman's house for clues",
      count: 1,
    },
  ],
  rewards: [{ faction: "ashenMilitia", reputation: 60 }],
};

export const QUEST_DEAL_WITH_DEVIL: QuestDefinition = {
  id: QUEST_ID_DEAL_WITH_DEVIL,
  title: "A Deal with the Devil",
  description:
    "The note told Coleman to meet its writer at the motel in East Forestford at midday the next day. Davis does not know when it was written. Coleman asked for patrol routes toward East Forestford last week. Check the motel for a sign of him, then tell Davis what you found.",
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
  ],
  rewards: [],
};

export const STORY_QUESTS: readonly QuestDefinition[] = [
  QUEST_FOUND_ON_THE_ROAD,
  QUEST_AYE_CAPTAIN,
  QUEST_TWO_BEHIND,
  QUEST_DEAL_WITH_DEVIL,
];

export function isStoryQuestId(questId: string): boolean {
  return STORY_QUESTS.some((quest) => quest.id === questId);
}
