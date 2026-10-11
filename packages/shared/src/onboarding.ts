/**
 * First-session tutorial: chapters, steps, one-time tips, Field Guide pages,
 * and the persisted per-player tutorial flags.
 */

export const TUTORIAL_CHAPTERS = [
  { id: "wake", title: "Chapter 1: Wake Up" },
  { id: "birchport", title: "Chapter 2: Birchport" },
  { id: "patrol", title: "Chapter 3: The Patrol" },
  { id: "own", title: "Chapter 4: On Your Own" },
] as const;

export type TutorialChapterId = (typeof TUTORIAL_CHAPTERS)[number]["id"];

/** Ordered step ids. Steps also complete out of order when the player does them early. */
export const ONBOARDING_STEP_IDS = [
  "intro",
  "move",
  "talk_clark",
  "accept_aye_captain",
  "eat_drink",
  "map",
  "leave_hospital",
  "sprint",
  "talk_davis",
  "turn_in_aye",
  "accept_two_behind",
  "search_coleman",
  "finish",
] as const;

export type OnboardingStepId = (typeof ONBOARDING_STEP_IDS)[number];

export type OnboardingStepDef = {
  id: OnboardingStepId;
  chapter: TutorialChapterId;
  title: string;
  body: string;
  /** Replaces `body` on touch devices. */
  mobileBody?: string;
  /** Full-screen card with a button instead of the corner tracker. */
  card?: { button: string };
};

export const ONBOARDING_STEPS: Record<OnboardingStepId, OnboardingStepDef> = {
  intro: {
    id: "intro",
    chapter: "wake",
    title: "Welcome to Deadtiles",
    body:
      "Ashen County fell to the dead. A few towns still hold out, and everyone else scavenges what is left. " +
      "You share this world with other players. Stay fed, watered and warm. When you die, everything you carried stays on your body. " +
      "The factions you meet remember how you treat them.",
    card: { button: "Begin" },
  },
  move: {
    id: "move",
    chapter: "wake",
    title: "Find your feet",
    body: "Click the ground or use WASD to walk.",
    mobileBody: "Drag the stick in the corner, or tap the ground, to walk.",
  },
  talk_clark: {
    id: "talk_clark",
    chapter: "wake",
    title: "Talk to Doctor Clark",
    body:
      "Doctor Clark patched you up. Walk up to him and press E to talk, then ask what happened to you. " +
      "This ward belongs to the National Guard. Weapons can't be drawn here, and searching their furniture or their dead counts as theft.",
    mobileBody:
      "Doctor Clark patched you up. Tap him to talk, then ask what happened to you. " +
      "This ward belongs to the National Guard. Weapons can't be drawn here, and searching their furniture or their dead counts as theft.",
  },
  eat_drink: {
    id: "eat_drink",
    chapter: "wake",
    title: "Eat and drink",
    body:
      "You woke up hungry and thirsty. Press Tab to open your inventory and use the tuna or the water. " +
      "If hunger or thirst reaches zero, you start losing health.",
    mobileBody:
      "You woke up hungry and thirsty. Tap the backpack button to open your inventory and use the tuna or the water. " +
      "If hunger or thirst reaches zero, you start losing health.",
  },
  map: {
    id: "map",
    chapter: "wake",
    title: "Check your map",
    body:
      "Press M to open the map. Birchport's hospital, barracks and market are marked. Captain Davis runs the National Guard from the barracks.",
    mobileBody:
      "Tap the map button. Birchport's hospital, barracks and market are marked. Captain Davis runs the National Guard from the barracks.",
  },
  leave_hospital: {
    id: "leave_hospital",
    chapter: "wake",
    title: "Leave the ward",
    body: "Head for the hospital exit when you're ready.",
  },
  sprint: {
    id: "sprint",
    chapter: "birchport",
    title: "Sprint",
    body:
      "Hold Shift while moving, or double-click a destination, to sprint. Sprinting drains stamina. Once it runs out, you have to rest before it comes back.",
    mobileBody:
      "Push the stick all the way to its edge to sprint. Sprinting drains stamina. Once it runs out, you have to rest before it comes back.",
  },
  talk_davis: {
    id: "talk_davis",
    chapter: "birchport",
    title: "Report to Captain Davis",
    body:
      "Birchport is held by the National Guard. Weapons can't be drawn on its streets or inside faction buildings, so town is safe ground. " +
      "Go through the barracks gate (marked on your map) and find Captain Davis in the mess hall.",
  },
  accept_aye_captain: {
    id: "accept_aye_captain",
    chapter: "wake",
    title: "Accept Aye, aye, Captain",
    body:
      "Accept Aye, aye, Captain from Doctor Clark. He is sending you to Captain Davis in the barracks mess hall.",
  },
  turn_in_aye: {
    id: "turn_in_aye",
    chapter: "patrol",
    title: "Hear Davis out",
    body:
      "Choose 'You wanted to speak to me?' and hear him out. Then turn Aye, aye, Captain in.",
  },
  accept_two_behind: {
    id: "accept_two_behind",
    chapter: "patrol",
    title: "Accept Two Behind It",
    body:
      "Accept Two Behind It. Read it before you take it. That is how Davis says you earn the National Guard's trust.",
  },
  search_coleman: {
    id: "search_coleman",
    chapter: "patrol",
    title: "Search Coleman's house",
    body:
      "Sergeant Coleman's house is marked on your map in Birchport. Search the furniture. You will not be told which piece matters. Bring what you find back to Davis.",
    mobileBody:
      "Sergeant Coleman's house is marked on your map in Birchport. Tap furniture to search it. You will not be told which piece matters. Bring what you find back to Davis.",
  },
  finish: {
    id: "finish",
    chapter: "own",
    title: "You're on your own",
    body:
      "That's the basics. Scavenge, stay fed and warm, follow the story Davis offers, and build somewhere safe to keep your loot. " +
      "Once this tutorial ends, Davis and Clark post more work on their boards. The Field Guide in your Journal covers all of this in more detail.",
    card: { button: "Finish" },
  },
};

export function onboardingStepIndex(id: OnboardingStepId): number {
  return ONBOARDING_STEP_IDS.indexOf(id);
}

export function onboardingChapterTitle(chapter: TutorialChapterId): string {
  return TUTORIAL_CHAPTERS.find((c) => c.id === chapter)?.title ?? "";
}

/** One-time contextual tips, shown the first time each situation comes up. */
export const TUTORIAL_TIP_IDS = [
  "hungry",
  "thirsty",
  "cold",
  "hot",
  "wet",
  "infected",
  "raw_meat",
  "low_health",
  "night",
  "stamina_out",
  "weapon_blocked",
  "standing_hostile",
  "first_death",
  "zombie_near",
  "wildlife",
  "gunshot",
  "theft_warning",
  "weapon_broke",
  "firearm",
  "locked_door",
  "other_survivor",
  "skill_magazine",
  "radio",
  "rain",
  "search_noise",
  "combat_log",
  "red_order_intro",
  "red_order_inside",
  "ashen_traders_intro",
  "lockpick_kit",
] as const;

export type TutorialTipId = (typeof TUTORIAL_TIP_IDS)[number];

export type TutorialTipDef = {
  id: TutorialTipId;
  title: string;
  body: string;
};

export const TUTORIAL_TIPS: Record<TutorialTipId, TutorialTipDef> = {
  hungry: {
    id: "hungry",
    title: "Hungry",
    body: "Your hunger is low. Eat soon. At zero you lose health over time. Cook raw meat before you eat it.",
  },
  thirsty: {
    id: "thirsty",
    title: "Thirsty",
    body: "Your thirst is low, and it drains faster than hunger. Drink soon. At zero you lose health over time.",
  },
  cold: {
    id: "cold",
    title: "Getting cold",
    body: "Wear warmer clothes, get out of the rain, or stand near a lit fireplace. If your core temperature keeps falling, you start losing health.",
  },
  hot: {
    id: "hot",
    title: "Overheating",
    body: "Sprinting and heavy clothes build heat. Slow down, shed a layer, or get indoors. Heatstroke damages you.",
  },
  wet: {
    id: "wet",
    title: "Soaked",
    body: "Wet clothes keep in far less warmth. Dry off beside a fire or indoors before it gets cold.",
  },
  infected: {
    id: "infected",
    title: "Infected",
    body: "Infection slowly lowers your max health. Take antibiotics, or pay Doctor Clark at the hospital, to clear it.",
  },
  raw_meat: {
    id: "raw_meat",
    title: "Raw meat",
    body: "Eating raw meat can infect you. Cook it on a lit fireplace first, and take it off before it burns. Burnt meat barely feeds you and dries you out.",
  },
  low_health: {
    id: "low_health",
    title: "Badly hurt",
    body: "Back away from the fight. Bandages patch you up, and Doctor Clark can fully heal you for banknotes.",
  },
  night: {
    id: "night",
    title: "Nightfall",
    body: "Walkers move faster after dark and you see less. Light a campfire or get indoors.",
  },
  stamina_out: {
    id: "stamina_out",
    title: "Out of breath",
    body: "Your stamina is empty. It only starts coming back after a short rest, so don't get caught sprinting.",
  },
  weapon_blocked: {
    id: "weapon_blocked",
    title: "No weapons here",
    body: "Weapons can't be drawn on Birchport's streets or inside faction buildings. Leave town to fight.",
  },
  standing_hostile: {
    id: "standing_hostile",
    title: "Hostile standing",
    body: "A faction now treats you as Hostile. Their people won't talk to you and may open fire. Standing slowly recovers from Hostile over time, but Exiled never does.",
  },
  first_death: {
    id: "first_death",
    title: "Your body stays behind",
    body: "Everything you carried is on your corpse where you fell. It lasts one hour, so go back for it if it's safe. Any player can loot it.",
  },
  zombie_near: {
    id: "zombie_near",
    title: "Walkers nearby",
    body: "Walkers chase anything they see or hear. Gunshots pull them in from far away, while melee stays quiet.",
  },
  wildlife: {
    id: "wildlife",
    title: "Wildlife",
    body: "Coyotes may hunt survivors if the pack is large enough, and bears are temperamental. Both are best avoided.",
  },
  gunshot: {
    id: "gunshot",
    title: "Gunshot",
    body: "Gunshots carry a long way, and walkers come to investigate. Melee stays quiet.",
  },
  theft_warning: {
    id: "theft_warning",
    title: "Stop stealing",
    body: "They warned you. Finish searching their supplies or their dead and they open fire. Stop searching and they stand down. The National Guard turns the whole Birchport garrison. The Red Order turns the squad in that building.",
  },
  weapon_broke: {
    id: "weapon_broke",
    title: "Weapon broke",
    body: "That weapon wore out. A broken melee weapon is useless until you find or make another. Guns do not wear out.",
  },
  firearm: {
    id: "firearm",
    title: "Firearm",
    body: "This gun needs the matching ammunition. Reloading takes a moment, and you have to stand still while you do it.",
  },
  locked_door: {
    id: "locked_door",
    title: "Locked door",
    body: "This door is locked with a code. Other survivors lock their buildings. When you build your own, you can set a code too.",
  },
  other_survivor: {
    id: "other_survivor",
    title: "Another survivor",
    body: "Another survivor is nearby. Outside Birchport, other players can kill you and take what you are carrying. Town is the safe ground.",
  },
  skill_magazine: {
    id: "skill_magazine",
    title: "Skill magazine",
    body: "Read it. It trains the skill on the cover. The Skills tab in your Journal shows what each level does.",
  },
  radio: {
    id: "radio",
    title: "Radio",
    body: "Tune a channel with /freq, talk with /radio, and share your location with /ping. Anyone on that channel can hear you.",
  },
  rain: {
    id: "rain",
    title: "Rain",
    body: "Rain soaks your clothes, and wet clothes lose most of their warmth. Get indoors before you get wet.",
  },
  search_noise: {
    id: "search_noise",
    title: "Searching makes noise",
    body: "Walkers nearby can hear you search, though not from nearly as far as a gunshot.",
  },
  combat_log: {
    id: "combat_log",
    title: "In combat",
    body: "Your survivor stays vulnerable in the world until this timer ends, even if you close the game.",
  },
  red_order_intro: {
    id: "red_order_intro",
    title: "The Red Order",
    body: "The Red Order. They hold city blocks and want the Ashen out. Their people wear red armbands. In Birchport they run the supermarket, the building with the boarded up windows.",
  },
  red_order_inside: {
    id: "red_order_inside",
    title: "Inside their walls",
    body: "Weapons stay holstered here, the same as any faction building. If they see you finish searching their furniture or their dead, that squad turns hostile. Stop the search and they stand down. You can earn standing with the Red Order and the Ashen for now. That will not last forever.",
  },
  ashen_traders_intro: {
    id: "ashen_traders_intro",
    title: "The Ashen Traders",
    body: "The Ashen Traders run the caravans and keep Birchport's stores at the market (marked on your map). Kevin buys and sells gear there, and the market board lets players trade with each other. Better standing gets you better prices.",
  },
  lockpick_kit: {
    id: "lockpick_kit",
    title: "Lockpick",
    body: "A lockpick kit opens a lock like the one on that holding cell. Use it on the door and stay beside it until the pick finishes. The first one takes about a minute, and the noise can draw walkers. The kit wears down with use.",
  },
};

export type ControlsLegendRow = { key: string; action: string };

export const CONTROLS_DESKTOP: readonly ControlsLegendRow[] = [
  { key: "Click / WASD", action: "Move" },
  { key: "Shift / Dbl click", action: "Sprint" },
  { key: "E", action: "Talk, search, interact" },
  { key: "Tab", action: "Inventory" },
  { key: "1 / 2", action: "Equip hotbar weapon" },
  { key: "0", action: "Put weapon away" },
  { key: "CTRL + Click", action: "Aim and attack" },
  { key: "R", action: "Reload" },
  { key: "M", action: "Map" },
  { key: "J", action: "Journal and Field Guide" },
  { key: "B", action: "Build mode" },
  { key: "Enter", action: "Chat" },
  { key: "/freq 3-3000", action: "Tune your radio" },
  { key: "/radio message", action: "Radio chat" },
  { key: "/ping", action: "Ping your location on radio" },
  { key: "Esc", action: "Close windows, show controls" },
];

export const CONTROLS_MOBILE: readonly ControlsLegendRow[] = [
  { key: "Stick / Tap", action: "Move" },
  { key: "Stick to edge", action: "Sprint" },
  { key: "Tap a person or object", action: "Talk, search, interact" },
  { key: "Backpack button", action: "Inventory" },
  { key: "Hotbar", action: "Equip weapon" },
  { key: "Aim button + Tap", action: "Aim and attack" },
  { key: "Reload button", action: "Reload" },
  { key: "Map button", action: "Map" },
  { key: "Journal button", action: "Journal and Field Guide" },
  { key: "Build button", action: "Build mode" },
  { key: "Chat button", action: "Chat and radio commands" },
];

/** @deprecated Use {@link CONTROLS_DESKTOP}. */
export const ONBOARDING_CONTROLS_LEGEND = CONTROLS_DESKTOP;

export type FieldGuidePage = {
  id: string;
  title: string;
  paragraphs: readonly string[];
};

export const FIELD_GUIDE_PAGES: readonly FieldGuidePage[] = [
  {
    id: "basics",
    title: "What is Deadtiles?",
    paragraphs: [
      "Ashen County fell to the dead. Survivors hold a few towns, and everyone else scavenges what is left. The world is shared with every other player online.",
      "You need food, water and warmth to stay alive. Scavenge houses and shops, take jobs from the factions, trade for better gear, and build a base to keep it safe.",
    ],
  },
  {
    id: "survival",
    title: "Survival",
    paragraphs: [
      "Hunger and thirst drain constantly, thirst about twice as fast. At zero you lose health until you eat or drink.",
      "Your core temperature follows the weather. Rain soaks your clothes, and wet clothes lose most of their warmth. Lit fireplaces warm you and dry you off. Both hypothermia and heatstroke damage you.",
      "Stamina drains while you sprint. When it empties, you must rest a while before it recovers.",
    ],
  },
  {
    id: "combat",
    title: "Combat and noise",
    paragraphs: [
      "Equip a weapon from your hotbar, aim, and attack toward the cursor. Shots stop at the first body or solid cover in the way.",
      "Gunshots are loud. Walkers far away hear them and come to look. Melee is quiet, but melee weapons wear out with use.",
      "Walkers move faster at night. Never fight a group in the open if you can use a doorway.",
    ],
  },
  {
    id: "infection",
    title: "Infection and medicine",
    paragraphs: [
      "Walker bites and raw meat can infect you. Infection rises slowly, and each point lowers your max health.",
      "Antibiotics stop it and bring it back down. Doctor Clark in Birchport Hospital can fully heal you and clear infection for banknotes.",
      "Bandages restore some health. Cook meat on a lit fireplace before eating it.",
    ],
  },
  {
    id: "factions",
    title: "Factions and standing",
    paragraphs: [
      "National Guard: posts across the country. Birchport is their hub in Ashen County, with a few smaller outposts besides. Captain Davis at the barracks and Doctor Clark at the hospital post jobs.",
      "Ashen Traders: run caravans and the Birchport market. They buy, sell, and keep medicine and ammo moving.",
      "The Red Order: hold city blocks and want the Ashen gone. They run Birchport's supermarket and post their own work. Their furniture and their dead are protected. If they see you finish a search, that squad turns hostile.",
      "Standing runs Exiled, Hostile, Wary, Neutral, Warm, Friendly, Allied. Everyone starts Wary. Jobs raise it. Attacking a faction or stealing from it drops it a full level. Hostile groups refuse to talk and may shoot. Ashen standing recovers slowly from Hostile, but Exiled is permanent.",
      "For now you can work for both the Ashen and the Red Order. Later jobs will force you to pick a side.",
    ],
  },
  {
    id: "birchport",
    title: "Birchport rules",
    paragraphs: [
      "Weapons can't be drawn on Birchport's streets or inside faction buildings, so town is safe ground.",
      "The National Guard watches the hospital and barracks, and their dead wherever they fell. Searching their furniture or one of their bodies counts as theft. If a guard sees you finish, the whole Birchport garrison turns hostile. Stop the search and they stand down.",
      "Fighting players or guards in Birchport turns the whole garrison hostile.",
    ],
  },
  {
    id: "death",
    title: "Death and loot",
    paragraphs: [
      "When you die, everything you carried stays on your corpse for one hour. Anyone can loot it, including other players.",
      "You respawn with a few basic supplies. Your skills and faction standing carry over.",
    ],
  },
  {
    id: "skills",
    title: "Skills",
    paragraphs: [
      "Skills improve as you use them: fighting, searching, cooking, crafting, trading and more. Each sub-skill is capped by its parent skill.",
      "Reading a skill magazine trains the skill on its cover. Check the Skills tab to see what each level does.",
    ],
  },
  {
    id: "trading",
    title: "Money and trading",
    paragraphs: [
      "Banknotes are the county's currency. Jobs pay in banknotes, and traders buy what you scavenge.",
      "The Birchport market has a board where players list items for each other. Better standing with the Ashen Traders gets you better prices.",
    ],
  },
  {
    id: "building",
    title: "Building",
    paragraphs: [
      "Press B (or the build button) with a hammer to place walls, doors, storage and more. Each piece needs materials deposited before it goes up.",
      "Most structures can't be built inside Birchport. Build out in the county, and lock your doors with a code.",
    ],
  },
  {
    id: "radio",
    title: "Radio and other players",
    paragraphs: [
      "Other players can help you, trade with you, or kill you for your gear. Outside Birchport, nobody stops them.",
      "Carry a radio and use /freq to tune a channel, /radio to talk on it, and /ping to share your location with everyone on that channel.",
    ],
  },
];

export type TutorialFlagsState = {
  done?: boolean;
  /** Legacy: coach was shown once. No longer stops the tracker from reopening. */
  seen?: boolean;
  steps?: Record<string, boolean>;
  tips?: Record<string, boolean>;
  /** Player turned one-time tips off. */
  tipsOff?: boolean;
  /** Tracker collapsed to its small pill. */
  minimized?: boolean;
};

export function createEmptyTutorialFlags(): TutorialFlagsState {
  return { done: false, seen: false, steps: {}, tips: {}, tipsOff: false, minimized: false };
}

function readBoolMap(raw: unknown, allowed: readonly string[]): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (v === true && allowed.includes(k)) out[k] = true;
  }
  return out;
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
    return {
      done: obj.done === true,
      seen: obj.seen === true,
      steps: readBoolMap(obj.steps, ONBOARDING_STEP_IDS),
      tips: readBoolMap(obj.tips, TUTORIAL_TIP_IDS),
      tipsOff: obj.tipsOff === true,
      minimized: obj.minimized === true,
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
    tips: state.tips ?? {},
    tipsOff: state.tipsOff === true,
    minimized: state.minimized === true,
  });
}

export const EMPTY_TUTORIAL_FLAGS_JSON = serializeTutorialFlagsJson(
  createEmptyTutorialFlags(),
);

export function isOnboardingStepId(id: unknown): id is OnboardingStepId {
  return typeof id === "string" && (ONBOARDING_STEP_IDS as readonly string[]).includes(id);
}

export function isTutorialTipId(id: unknown): id is TutorialTipId {
  return typeof id === "string" && (TUTORIAL_TIP_IDS as readonly string[]).includes(id);
}
