/**
 * Ashen Militia dialog for MilitiaGuard1–3, MilitiaCaptain1 (Captain Davis),
 * and MilitiaDoctor1 (Doctor Clark). Standing uses `ashenMilitiaReputation`,
 * separate from Ashen Trader `ashenReputation`.
 */

import { PLAYER_MAX_HEALTH } from "./constants.js";
import {
  ashenStanding,
  ashenStandingLabel,
  canTradeWithAshen,
  dropAshenReputationLevel,
  type AshenStanding,
} from "./trade.js";

/** Ashen Militia faction display name. */
export const ASHEN_MILITIA_FACTION = "Ashen Militia";

/** Head of the Birchport Ashen Militia detachment (military barracks). */
export const ASHEN_MILITIA_CAPTAIN_NAME = "Captain Davis";

/** Birchport hospital medic (ward floor). */
export const ASHEN_MILITIA_DOCTOR_NAME = "Doctor Clark";

/** Full heal from Doctor Clark (banknotes). */
export const ASHEN_MILITIA_DOCTOR_HEAL_COST = 50;

/** Spoken when Hostile/Exiled try to open militia / trader dialog. */
export const ASHEN_TALK_REFUSE_REP_LINE =
  "We don't want to talk to you right now. Go away.";

/** Spoken when they try to talk with a weapon drawn. */
export const ASHEN_TALK_REFUSE_WEAPON_LINE =
  "Holster your weapon if you want to talk.";

export type AshenMilitiaDialogLine = {
  id: string;
  /** Player speech option. */
  player: string;
  /** Default reply variants (overworld / streets). Later entries tend to be more informative. */
  npc: readonly string[];
  /** Reply variants when talking inside a building (e.g. hospital ward). */
  npcInterior?: readonly string[];
};

export type AshenMilitiaCaptainDialogLine = {
  id: string;
  player: string;
  npc: readonly string[];
};

export type AshenMilitiaTask = {
  id: string;
  dialogLineId: string;
  /** Item turn-in. Omit on kill / clear / visit jobs. */
  requireItemId?: string;
  requireQty?: number;
  rewardBanknotes: number;
  rewardReputation: number;
  /** Short label under the Task heading. */
  label: string;
  requireItemLabel?: string;
  /** Icon in the jobs list when it is not the required item (map, etc.). */
  displayItemId?: string;
  /** Max completions in a rolling window (omit = unlimited). */
  maxCompletionsPerWindow?: number;
  /** Rolling window length in ms when {@link maxCompletionsPerWindow} is set. */
  completionWindowMs?: number;
};

/** Default 24h window for capped militia turn-ins. */
export const ASHEN_MILITIA_TASK_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Talk options for MilitiaGuard1–3.
 * Tone matches other Ashen dialogs: practical, no tough-guy pastiche.
 */
export const ASHEN_MILITIA_DIALOG_LINES: readonly AshenMilitiaDialogLine[] = [
  {
    id: "who",
    player: "Who are you?",
    npc: [
      "Ashen Militia. We hold settlements in Ashen County.",
      "Ashen Militia. We hold settlements in Ashen County and keep the roads around them walkable. Birchport is one detachment: military barracks, hospital, streets. Other towns have their own.",
      "Militia. This is Ashen County ground. Birchport's ours here. The military barracks is the hub. The hospital is where we treat the wounded. Captains talk when another post needs bodies or crates.",
      "Ashen Militia. Settlements and the roads that feed them. Each post has its own Captain. Birchport's barracks is the hub around here if you need more than a wave.",
    ],
  },
  {
    id: "birchport",
    player: "What's Birchport?",
    npc: [
      "Main settlement. Barracks, hospital, street patrols.",
      "Primary settlement for this detachment. The military barracks is the operational hub. The hospital is where Clark and the ward staff treat the wounded. We patrol the streets. Stay on the marked roads and don't start trouble in the ward.",
      "Birchport's our post. Barracks runs the detachment. Hospital's open for patch-ups. Traders pass through when they can. Stick to marked roads and keep weapons holstered in the ward.",
      "Biggest settlement we've got around here. Military barracks is the hub. Hospital's where we send the wounded. Patrols on the streets. Other detachments cover the rest of the county.",
    ],
  },
  {
    id: "traders",
    player: "Are you with the Ashen Traders?",
    npc: [
      "Separate outfit. They trade. We handle the guns.",
      "Separate outfit. They move goods through the county. We let them trade in our towns and ride out when bandits hit a caravan, when we can spare the people. They handle barter. We handle the guns.",
      "No. Ashen Traders are their own group. They move scrap and medicine through the county; we let them set up in our settlements and back them if bandits hit a caravan and we've got people to spare. Different jobs.",
      "Related, not the same. Traders do the barter. We keep the towns and roads from falling apart.",
    ],
  },
  {
    id: "job",
    player: "Any work for outsiders?",
    npc: [
      "Sometimes. Ask at Birchport. Don't shoot our people.",
      "Sometimes. Captain Davis at the barracks posts ammo and field kits, and Doctor Clark at the hospital takes bandages and water. They don't let outsiders through the gate. Get in better with the militia first. Until then: thin walkers, stay off our people.",
      "When we need hands, Davis posts barracks jobs and Clark posts ward jobs. Outsiders stay outside the gate until your standing's up. Until then: thin walkers, stay off our people, and don't make a mess on the marked roads.",
      "Captain Davis in the military barracks might have something for you, and Doctor Clark at the hospital takes medical and water. They don't allow outsiders in. Raise your standing with us and that might change.",
    ],
    npcInterior: [
      "Talk to Doctor Clark on this ward. He takes bandages, water, and the snack run. Davis posts the rest from the barracks.",
      "Clark handles ward stock here: bandages and water. Davis is at the military barracks for ammo and field kits. They don't let outsiders through that gate until you've earned it.",
      "You're in the right building for medical. Doctor Clark takes bandages and water on this ward. Captain Davis handles the barracks board if you can get through the gate.",
      "Ask Doctor Clark. Ward guards don't take the turn-ins. He does the medical and water jobs; Davis posts the rest at the barracks.",
    ],
  },
  {
    id: "roads",
    player: "How are the roads?",
    npc: [
      "Patrols near settlements. Walkers everywhere else. Watch for bandits.",
      "Patrols cover the arterials near our settlements. Quiet stretches don't stay quiet. Walkers are common. Bandits show up when they think nobody's watching.",
      "Near Birchport and the other posts we keep the main roads swept when we can. Out past that, walkers are routine and bandits hit lone travelers on the quiet stretches. Travel marked routes if you've got a choice.",
      "Arterials by the settlements are the best bet. Open country is walkers and the occasional ambush.",
    ],
  },
  {
    id: "redorder",
    player: "Know anything about the Red Order?",
    npc: [
      "City crew, red armbands. Stay clear of their buildings.",
      "City crew with red armbands. They don't share streets with us and they've been hunting patrols for dog tags. Stay clear of their buildings if you can help it.",
      "Red Order holds city blocks and wears red armbands. They've been hitting militia patrols for dog tags. Don't walk into their buildings looking for a chat. They don't share streets with Ashen.",
      "Red armbands, city turf. They've been taking dog tags off our patrols. Avoid their buildings.",
    ],
  },
  {
    id: "safe",
    player: "Am I safe talking to you?",
    npc: [
      "Holstered weapon, no fights. Yes. Attack us and we remember.",
      "If you keep your weapon holstered and don't pick a fight, yes. Attack us and every Ashen post in the area remembers. Reputation cuts both ways.",
      "Talk's fine with the gun put away. Start something and your standing with every Ashen post, militia and traders, drops. Reputation sticks.",
      "Yes, if you behave. Reputation with Ashen isn't local to this corner.",
    ],
  },
  {
    id: "bye",
    player: "That's all for now.",
    npc: [
      "Alright.",
      "Alright. Watch yourselves out there.",
      "Stay on the marked roads if you can. And keep that weapon holstered in town.",
      "Move careful.",
    ],
  },
];

/**
 * Talk options for MilitiaCaptain1 (Captain Davis) in the barracks mess hall.
 * Head of the Birchport detachment; posts barracks supply turn-ins.
 * Friendlier than street guards. Ward jobs (bandages, water) go through Clark.
 */
export const ASHEN_MILITIA_CAPTAIN_DIALOG_LINES: readonly AshenMilitiaCaptainDialogLine[] =
  [
    {
      id: "you_wanted",
      player: "You wanted to speak to me?",
      npc: [
        "I wanted to know what kind of trouble you got yourself into. The patrol that rescued you has since gone missing. They have not answered a radio call. That is not like them. They were with the National Guard before the world turned to shit. It is a shame you do not remember what happened before they brought you to the hospital.",
      ],
    },
    {
      id: "who",
      player: "Who are you?",
      npc: [
        "Captain Davis, Ashen Militia. I head the Birchport detachment.",
        "Captain Davis, Ashen Militia. I head the Birchport detachment from this barracks. Glad you made it in one piece.",
        "Captain Davis. I head Birchport's Ashen Militia. The military barracks is our operational hub. There are several detachments across the county, each with its own Captain. We coordinate when another post needs supplies or people.",
      ],
    },
    {
      id: "hospital",
      player: "Is the hospital your headquarters?",
      npc: [
        "No. This barracks is the hub. The hospital is where we treat the wounded. We keep it under militia control so the ward stays open.",
        "No. Command runs from this barracks. The hospital is for the wounded. Clark runs the ward. We hold the building so he can keep working.",
        "Headquarters is here. The hospital is a ward for hurt soldiers and anyone else we can patch up. Holster up if you go in, and stay out of Clark's way.",
      ],
    },
    {
      id: "birchport",
      player: "Is Birchport safe?",
      npc: [
        "Safer than the open road. Still, don't wander alone after dark.",
        "Safer than the open road. Street patrols keep the worst of it off the main avenues. Still, don't wander alone after dark if you can help it.",
        "Compared to the county roads, yes. This detachment holds the main streets. Side alleys and night walks are still a gamble. Stick with company if you can.",
      ],
    },
    {
      id: "detachments",
      player: "Are there other militia posts?",
      npc: [
        "Several detachments around the county. Each has its own Captain.",
        "Yes. Detachments across Ashen County, each with its own Captain. We talk when a post runs short on crates or people and can spare either.",
        "Birchport isn't the only one. Captains run their own detachments and coordinate when supplies or personnel need to move. Ask at the post you're nearest if you need work elsewhere.",
      ],
    },
    {
      id: "traders",
      player: "Do the Ashen Traders come through here?",
      npc: [
        "When they can. Separate group, but we look out for each other.",
        "When they can. We give them a place to set up, and they keep medicine and ammo moving. Separate group from us, but we look out for each other.",
        "Caravans stop here when the roads allow. Different outfit from the militia, but they move medicine and ammo we need, and we give them a safe stall. Ask them about stock, not me.",
      ],
    },
    {
      id: "jobs",
      player: "Do you have any work for me?",
      npc: [
        "Yes. Ammo, tape, mess food, smokes, lighters, wood, and scrap. Field work is a building in town, a motel, a supermarket to scout, walkers, and coyotes outside town. Ward stock is Clark's.",
        "I do. Bring 7.62 or 9mm, cigarettes, lighters, tape, wood, scrap, beans, or cooked coyote. There's a building sweep, a motel check, a supermarket scout, and thinning to do outside town. Ward stock is Clark's.",
        "Look at the board. Supply turn-ins, a supermarket scout, coyotes outside town, and the older field jobs. Clark still takes the ward list at the hospital.",
      ],
    },
    {
      id: "help",
      player: "Anything else I should know?",
      npc: [
        "Ask the street guards for directions. If you're hurt, go to the hospital. Avoid red armbands.",
        "Talk to the guards if you need directions. Survivors who need a bed go to the hospital, not here. If someone in a red armband starts asking questions, walk away.",
        "Street guards know the layout. Send anyone hurting to the hospital. Clark runs the ward and takes bandages and water there. Other detachments have their own Captains if you're out in the county. Red Order wears red armbands. Don't answer their questions and don't follow them into their buildings.",
      ],
    },
    {
      id: "bye",
      player: "Thanks for your time.",
      npc: [
        "Anytime. Stay safe.",
        "Anytime. Stay safe out there, and come back if you find those supplies.",
        "Glad to help. Check the board whenever you're stocked. The patrols feel it. Clark will take ward supplies at the hospital.",
      ],
    },
  ];

/** Turn-in: bandages for the hospital ward. Once a day. */
export const ASHEN_MILITIA_MEDICAL_TASK: AshenMilitiaTask = {
  id: "ashen_militia_bandages",
  dialogLineId: "jobs",
  requireItemId: "bandages",
  requireQty: 3,
  rewardBanknotes: 35,
  rewardReputation: 20,
  label: "Three's a Wrap",
  requireItemLabel: "Bandages",
  maxCompletionsPerWindow: 1,
  completionWindowMs: ASHEN_MILITIA_TASK_WINDOW_MS,
};

/** Turn-in: pistol ammo for sidearms. Once a day. */
export const ASHEN_MILITIA_POCKET_ROUNDS_TASK: AshenMilitiaTask = {
  id: "ashen_militia_pocket_rounds",
  dialogLineId: "jobs",
  requireItemId: "ammo_9x19",
  requireQty: 20,
  rewardBanknotes: 50,
  rewardReputation: 25,
  label: "Pocket Rounds",
  requireItemLabel: "9x19mm Rounds",
  maxCompletionsPerWindow: 1,
  completionWindowMs: ASHEN_MILITIA_TASK_WINDOW_MS,
};

/** Turn-in: rifle ammo for street patrols. Once a day. */
export const ASHEN_MILITIA_AMMO_TASK: AshenMilitiaTask = {
  id: "ashen_militia_ammo",
  dialogLineId: "jobs",
  requireItemId: "ammo_762x39",
  requireQty: 30,
  rewardBanknotes: 75,
  rewardReputation: 40,
  label: "Feed our Rifles",
  requireItemLabel: "7.62x39mm Rounds",
  maxCompletionsPerWindow: 1,
  completionWindowMs: ASHEN_MILITIA_TASK_WINDOW_MS,
};

/** Turn-in: drinking water for the hospital ward. Once a day. */
export const ASHEN_MILITIA_WATER_TASK: AshenMilitiaTask = {
  id: "ashen_militia_water",
  dialogLineId: "jobs",
  requireItemId: "water",
  requireQty: 5,
  rewardBanknotes: 30,
  rewardReputation: 15,
  label: "Dry Patrol",
  requireItemLabel: "Water",
  maxCompletionsPerWindow: 1,
  completionWindowMs: ASHEN_MILITIA_TASK_WINDOW_MS,
};

/** Turn-in: cigarettes for morale. Once a day. */
export const ASHEN_MILITIA_CIGARETTES_TASK: AshenMilitiaTask = {
  id: "ashen_militia_cigarettes",
  dialogLineId: "jobs",
  requireItemId: "blue_cigarettes",
  requireQty: 5,
  rewardBanknotes: 30,
  rewardReputation: 15,
  label: "Morale Sticks",
  requireItemLabel: "Cigarettes",
  maxCompletionsPerWindow: 1,
  completionWindowMs: ASHEN_MILITIA_TASK_WINDOW_MS,
};

/** Turn-in: duct tape for split patrol kits. Once a day. */
export const ASHEN_MILITIA_SPLIT_KIT_TASK: AshenMilitiaTask = {
  id: "ashen_militia_split_kit",
  dialogLineId: "jobs",
  requireItemId: "duct_tape",
  requireQty: 2,
  rewardBanknotes: 20,
  rewardReputation: 15,
  label: "Split Kit",
  requireItemLabel: "Duct Tape",
  maxCompletionsPerWindow: 1,
  completionWindowMs: ASHEN_MILITIA_TASK_WINDOW_MS,
};

/** Turn-in: lighter for field kits. */
export const ASHEN_MILITIA_LIGHTER_TASK: AshenMilitiaTask = {
  id: "ashen_militia_lighter",
  dialogLineId: "jobs",
  requireItemId: "lighter",
  requireQty: 1,
  rewardBanknotes: 15,
  rewardReputation: 10,
  label: "Firestarter",
  requireItemLabel: "Lighter",
  maxCompletionsPerWindow: 1,
  completionWindowMs: ASHEN_MILITIA_TASK_WINDOW_MS,
};

/** Turn-in: canned beans for the barracks mess. Once a day. */
export const ASHEN_MILITIA_COLD_TINS_TASK: AshenMilitiaTask = {
  id: "ashen_militia_cold_tins",
  dialogLineId: "jobs",
  requireItemId: "canned_beans",
  requireQty: 4,
  rewardBanknotes: 40,
  rewardReputation: 20,
  label: "Cold Tins",
  requireItemLabel: "Canned Beans",
  maxCompletionsPerWindow: 1,
  completionWindowMs: ASHEN_MILITIA_TASK_WINDOW_MS,
};

/** Turn-in: cooked coyote for the mess. Burnt meat will not do. Once a day. */
export const ASHEN_MILITIA_HOT_PLATE_TASK: AshenMilitiaTask = {
  id: "ashen_militia_hot_plate",
  dialogLineId: "jobs",
  requireItemId: "cooked_coyote_meat",
  requireQty: 2,
  rewardBanknotes: 45,
  rewardReputation: 25,
  label: "Hot Plate",
  requireItemLabel: "Cooked Coyote Meat",
  maxCompletionsPerWindow: 1,
  completionWindowMs: ASHEN_MILITIA_TASK_WINDOW_MS,
};

/** Turn-in: wood for street braziers after dark. */
export const ASHEN_MILITIA_NIGHT_WATCH_FUEL_TASK: AshenMilitiaTask = {
  id: "ashen_militia_night_watch_fuel",
  dialogLineId: "jobs",
  requireItemId: "wood",
  requireQty: 8,
  rewardBanknotes: 30,
  rewardReputation: 15,
  label: "Night Watch Fuel",
  requireItemLabel: "Wood",
  maxCompletionsPerWindow: 1,
  completionWindowMs: ASHEN_MILITIA_TASK_WINDOW_MS,
};

/** Clear walkers from a marked Birchport building. */
export const ASHEN_MILITIA_QUIET_STRETCH_TASK: AshenMilitiaTask = {
  id: "ashen_militia_quiet_stretch",
  dialogLineId: "jobs",
  rewardBanknotes: 70,
  rewardReputation: 40,
  label: "Quiet Stretch",
  displayItemId: "map",
  maxCompletionsPerWindow: 1,
  completionWindowMs: ASHEN_MILITIA_TASK_WINDOW_MS,
};

/** Check a motel south of town for two troopers who missed radio. */
export const ASHEN_MILITIA_MISSING_PAIR_TASK: AshenMilitiaTask = {
  id: "ashen_militia_missing_pair",
  dialogLineId: "jobs",
  rewardBanknotes: 100,
  rewardReputation: 80,
  label: "Missing Pair",
  displayItemId: "map",
};

/** Spare 7.62 from the pair's kit when the motel was not empty. */
export const QUEST_MISSING_PAIR_BONUS_AMMO = 6;

/** Turn-in: scrap for the barracks chain-link. */
export const ASHEN_MILITIA_BARGATE_SCRAP_TASK: AshenMilitiaTask = {
  id: "ashen_militia_bargate_scrap",
  dialogLineId: "jobs",
  requireItemId: "scrap_metal",
  requireQty: 10,
  rewardBanknotes: 40,
  rewardReputation: 20,
  label: "Bargate Scrap",
  requireItemLabel: "Scrap Metal",
  maxCompletionsPerWindow: 1,
  completionWindowMs: ASHEN_MILITIA_TASK_WINDOW_MS,
};

/** Scout a supermarket outside town. Search three shelves, then report. Once a day. */
export const ASHEN_MILITIA_AISLE_CHECK_TASK: AshenMilitiaTask = {
  id: "ashen_militia_aisle_check",
  dialogLineId: "jobs",
  rewardBanknotes: 40,
  rewardReputation: 20,
  label: "Aisle Check",
  displayItemId: "map",
  maxCompletionsPerWindow: 1,
  completionWindowMs: ASHEN_MILITIA_TASK_WINDOW_MS,
};

/**
 * One-shot. A bear on a road outside Birchport.
 * The player keeps the meat.
 */
export const ASHEN_MILITIA_BIG_TRACK_TASK: AshenMilitiaTask = {
  id: "ashen_militia_big_track",
  dialogLineId: "jobs",
  rewardBanknotes: 200,
  rewardReputation: 180,
  label: "Big Track",
  displayItemId: "raw_bear_meat",
};

/** Kill coyotes on the roads outside Birchport. Town kills do not count. */
export const ASHEN_MILITIA_THIN_THE_PACK_TASK: AshenMilitiaTask = {
  id: "ashen_militia_thin_the_pack",
  dialogLineId: "jobs",
  rewardBanknotes: 70,
  rewardReputation: 35,
  label: "Thin the Pack",
  displayItemId: "map",
  maxCompletionsPerWindow: 1,
  completionWindowMs: ASHEN_MILITIA_TASK_WINDOW_MS,
};

/** Kill walkers on the roads outside Birchport. Town kills do not count. */
export const ASHEN_MILITIA_DONT_FEED_THEM_TASK: AshenMilitiaTask = {
  id: "ashen_militia_dont_feed_them",
  dialogLineId: "jobs",
  rewardBanknotes: 50,
  rewardReputation: 30,
  label: "Don't Feed Them",
  displayItemId: "map",
  maxCompletionsPerWindow: 1,
  completionWindowMs: ASHEN_MILITIA_TASK_WINDOW_MS,
};

/**
 * One-shot starter job: clear a house just outside Birchport.
 * Davis lends a worn hammer on accept and takes it back on turn-in.
 */
export const ASHEN_MILITIA_FIRST_SWEEP_TASK: AshenMilitiaTask = {
  id: "ashen_militia_first_sweep",
  dialogLineId: "jobs",
  rewardBanknotes: 40,
  rewardReputation: 50,
  label: "First Sweep",
  displayItemId: "weapon_hammer",
};

/** Davis's loaner hammer for First Sweep. */
export const FIRST_SWEEP_LOANER_ITEM_ID = "weapon_hammer";
/** Loaner durability as a fraction of the hammer's max. */
export const FIRST_SWEEP_LOANER_DURABILITY_FRACTION = 0.1;

export const ASHEN_MILITIA_CAPTAIN_TASKS: readonly AshenMilitiaTask[] = [
  ASHEN_MILITIA_FIRST_SWEEP_TASK,
  ASHEN_MILITIA_AMMO_TASK,
  ASHEN_MILITIA_POCKET_ROUNDS_TASK,
  ASHEN_MILITIA_CIGARETTES_TASK,
  ASHEN_MILITIA_LIGHTER_TASK,
  ASHEN_MILITIA_SPLIT_KIT_TASK,
  ASHEN_MILITIA_NIGHT_WATCH_FUEL_TASK,
  ASHEN_MILITIA_BARGATE_SCRAP_TASK,
  ASHEN_MILITIA_COLD_TINS_TASK,
  ASHEN_MILITIA_HOT_PLATE_TASK,
  ASHEN_MILITIA_QUIET_STRETCH_TASK,
  ASHEN_MILITIA_MISSING_PAIR_TASK,
  ASHEN_MILITIA_AISLE_CHECK_TASK,
  ASHEN_MILITIA_DONT_FEED_THEM_TASK,
  ASHEN_MILITIA_THIN_THE_PACK_TASK,
  ASHEN_MILITIA_BIG_TRACK_TASK,
];

/** True if Clark's paid treatment should be offered (missing HP or infection). */
export function ashenMilitiaDoctorNeedsTreatment(
  health: number,
  infected: boolean,
  maxHealth = PLAYER_MAX_HEALTH,
): boolean {
  return !!infected || health < maxHealth;
}

/** Player HP band for Doctor Clark's "Can you patch me up?" reply. */
export type AshenMilitiaDoctorHealBand =
  | "full"
  | "infected"
  | "light"
  | "timely"
  | "critical";

/**
 * full = max HP and not infected; infected = max HP but infected;
 * light = 75–99%; timely = 50–74%; critical = under 50%.
 */
export function ashenMilitiaDoctorHealBand(
  health: number,
  maxHealth = PLAYER_MAX_HEALTH,
  infected = false,
): AshenMilitiaDoctorHealBand {
  const hp = Math.max(0, health);
  const max = Math.max(1, maxHealth);
  if (hp >= max) return infected ? "infected" : "full";
  const pct = (hp / max) * 100;
  if (pct >= 75) return "light";
  if (pct >= 50) return "timely";
  return "critical";
}

/** Heal replies keyed by {@link ashenMilitiaDoctorHealBand}. */
export const ASHEN_MILITIA_DOCTOR_HEAL_REPLIES: Record<
  AshenMilitiaDoctorHealBand,
  readonly string[]
> = {
  full: [
    "You're fine. Come back when you're actually hurt and I'll patch you up for fifty banknotes.",
    "Nothing for me to do. You're already at full strength. When you really need it, fifty banknotes and I'll sort you out.",
    "Save your money. You're not injured. If that changes, fifty banknotes gets you a full patch-up.",
  ],
  infected: [
    "You're not bleeding, but that infection will turn. Fifty banknotes and I'll clear it.",
    "Wounds look closed. The infection isn't. Fifty banknotes and I'll treat it before it spreads.",
    "You're walking, but you're infected. Fifty banknotes and I'll flush it out.",
  ],
  light: [
    "You're barely scratched. I can still do a full patch-up for fifty banknotes if you want the peace of mind.",
    "Looks light. You're not that bad off, but fifty banknotes will put you back to full if you'd rather not push it.",
    "I've seen worse paper cuts. Still, fifty banknotes and I'll top you off before you walk out.",
  ],
  timely: [
    "Good timing. You're hurt enough that a proper patch-up matters. Fifty banknotes and I'll get you back on your feet.",
    "You came at the right time. Fifty banknotes for a full patch-up before that gets worse.",
    "That needs attention, but you're not too far gone. Fifty banknotes and you'll leave the ward standing.",
  ],
  critical: [
    "I'm surprised you're still standing. Fifty banknotes and I'll put you back together before you hit the floor.",
    "How are you even talking? Sit down. Fifty banknotes for a full patch-up, and don't argue.",
    "You're a mess. Honestly shocked you walked in. Fifty banknotes and I'll fix what I can.",
  ],
};

/** Doctor Clark heal reply variants for the player's current HP and infection. */
export function ashenMilitiaDoctorHealReplies(
  health: number,
  maxHealth = PLAYER_MAX_HEALTH,
  infected = false,
): readonly string[] {
  return ASHEN_MILITIA_DOCTOR_HEAL_REPLIES[
    ashenMilitiaDoctorHealBand(health, maxHealth, infected)
  ];
}

/**
 * Talk options for MilitiaDoctor1 (Doctor Clark) on the hospital ward floor.
 * Medic for Ashen Militia: patches hurt soldiers and outsiders.
 */
export const ASHEN_MILITIA_DOCTOR_DIALOG_LINES: readonly AshenMilitiaCaptainDialogLine[] =
  [
    {
      id: "who",
      player: "Who are you?",
      npc: [
        "Doctor Clark. Ashen Militia medic. I keep the ward running.",
        "Doctor Clark, Ashen Militia. I patch up hurt soldiers and outsiders who make it to the ward.",
        "Clark. Militia medic for this hospital. Soldiers, patrols, survivors: if they're bleeding, they come through me.",
      ],
    },
    {
      id: "whathappened",
      player: "What happened to me?",
      npc: [
        "A patrol found you on the road and brought you in. I patched you up. Be more careful.",
        "One of our patrols found you in a bad way out on the road. They hauled you to this ward and I put you back together. You're lucky they came through when they did. Be more careful next time.",
        "You were down hard outside town. Militia patrol scooped you up and I treated you here. Without them you'd still be out there. Don't make them do it twice.",
      ],
    },
    {
      id: "militia",
      player: "You're with the Ashen Militia?",
      npc: [
        "Yes. I handle the wounded for this detachment.",
        "Yes. Captain Davis runs the detachment from the barracks. I deal with the bodies that come back hurt. Militia and outsiders alike, if they can pay or if they're ours.",
        "Ashen Militia, hospital side. The barracks is their hub. Keeping people breathing is mine.",
      ],
    },
    {
      id: "heal",
      player: "Can you patch me up?",
      /** Fallback; UI picks {@link ashenMilitiaDoctorHealReplies} by HP. */
      npc: ASHEN_MILITIA_DOCTOR_HEAL_REPLIES.timely,
    },
    {
      id: "jobs",
      player: "Need anything from outside?",
      npc: [
        "Bandages, water, alcohol, peaches. Hot chips if you can spare a bag. I also need a one-time stock of antibiotics and rags. And there's something of my wife's I want back.",
        "Daily: bandages, water, alcohol, peaches, and chips. Once: five antibiotic packs, ten rags, and a personal ask. I'll pay.",
        "Yes. Ward stock once a day. A stock of antibiotics and rags before the next wave, just once. And a pair of earrings I should have kept closer.",
      ],
    },
    {
      id: "bye",
      player: "Thanks, doc.",
      npc: [
        "Stay out of the morgue list.",
        "Try not to need me twice in one day.",
        "Go easy. The ward's short on beds.",
      ],
    },
  ];

/** Turn-in: alcohol for the ward. Once a day. */
export const ASHEN_MILITIA_CLEAN_HANDS_TASK: AshenMilitiaTask = {
  id: "ashen_militia_clean_hands",
  dialogLineId: "jobs",
  requireItemId: "alcohol",
  requireQty: 2,
  rewardBanknotes: 30,
  rewardReputation: 15,
  label: "Clean Hands",
  requireItemLabel: "Alcohol",
  maxCompletionsPerWindow: 1,
  completionWindowMs: ASHEN_MILITIA_TASK_WINDOW_MS,
};

/** One-shot. Five antibiotic packets stocked before the next wave. */
export const ASHEN_MILITIA_BEFORE_IT_TURNS_TASK: AshenMilitiaTask = {
  id: "ashen_militia_before_it_turns",
  dialogLineId: "jobs",
  requireItemId: "antibiotics",
  requireQty: 5,
  rewardBanknotes: 80,
  rewardReputation: 80,
  label: "Before It Turns",
  requireItemLabel: "Antibiotics",
};

/** One-shot. Ten rags Clark can boil for the ward. */
export const ASHEN_MILITIA_RAG_BIN_TASK: AshenMilitiaTask = {
  id: "ashen_militia_rag_bin",
  dialogLineId: "jobs",
  requireItemId: "rags",
  requireQty: 10,
  rewardBanknotes: 25,
  rewardReputation: 25,
  label: "Rag Bin",
  requireItemLabel: "Rags",
};

/** Turn-in: canned peaches for patients who will not eat chips. Once a day. */
export const ASHEN_MILITIA_SOMETHING_SOFT_TASK: AshenMilitiaTask = {
  id: "ashen_militia_something_soft",
  dialogLineId: "jobs",
  requireItemId: "canned_peaches",
  requireQty: 2,
  rewardBanknotes: 30,
  rewardReputation: 15,
  label: "Something Soft",
  requireItemLabel: "Canned Peaches",
  maxCompletionsPerWindow: 1,
  completionWindowMs: ASHEN_MILITIA_TASK_WINDOW_MS,
};

/**
 * One-shot. The anniversary earrings Clark gave his wife.
 * A house outside town hides the pair in one piece of furniture.
 */
export const ASHEN_MILITIA_DONT_HOCK_THEM_TASK: AshenMilitiaTask = {
  id: "ashen_militia_dont_hock_them",
  dialogLineId: "jobs",
  requireItemId: "clarks_earrings",
  requireQty: 1,
  rewardBanknotes: 80,
  rewardReputation: 80,
  label: "Don't Hock Them",
  requireItemLabel: "Anniversary Earrings",
};

/** Turn-in: one bag of hot chips. Once a day. */
export const ASHEN_MILITIA_SPICY_FINGERS_TASK: AshenMilitiaTask = {
  id: "ashen_militia_spicy_fingers",
  dialogLineId: "jobs",
  requireItemId: "hot_chips",
  requireQty: 1,
  rewardBanknotes: 8,
  rewardReputation: 10,
  label: "Spicy Fingers",
  requireItemLabel: "Hot Chips",
  maxCompletionsPerWindow: 1,
  completionWindowMs: ASHEN_MILITIA_TASK_WINDOW_MS,
};

export const ASHEN_MILITIA_DOCTOR_TASKS: readonly AshenMilitiaTask[] = [
  ASHEN_MILITIA_MEDICAL_TASK,
  ASHEN_MILITIA_WATER_TASK,
  ASHEN_MILITIA_CLEAN_HANDS_TASK,
  ASHEN_MILITIA_RAG_BIN_TASK,
  ASHEN_MILITIA_SOMETHING_SOFT_TASK,
  ASHEN_MILITIA_BEFORE_IT_TURNS_TASK,
  ASHEN_MILITIA_SPICY_FINGERS_TASK,
  ASHEN_MILITIA_DONT_HOCK_THEM_TASK,
];

export function ashenMilitiaDialogLineById(
  id: string,
): AshenMilitiaDialogLine | undefined {
  return ASHEN_MILITIA_DIALOG_LINES.find((line) => line.id === id);
}

export function ashenMilitiaCaptainDialogLineById(
  id: string,
): AshenMilitiaCaptainDialogLine | undefined {
  return ASHEN_MILITIA_CAPTAIN_DIALOG_LINES.find((line) => line.id === id);
}

export function ashenMilitiaCaptainTaskById(
  id: string,
): AshenMilitiaTask | undefined {
  return ASHEN_MILITIA_CAPTAIN_TASKS.find((task) => task.id === id);
}

export function ashenMilitiaDoctorDialogLineById(
  id: string,
): AshenMilitiaCaptainDialogLine | undefined {
  return ASHEN_MILITIA_DOCTOR_DIALOG_LINES.find((line) => line.id === id);
}

export function ashenMilitiaDoctorTaskById(
  id: string,
): AshenMilitiaTask | undefined {
  return ASHEN_MILITIA_DOCTOR_TASKS.find((task) => task.id === id);
}

/** Completions remaining in the task's rolling window (null = unlimited). */
export function ashenMilitiaTaskCompletionsRemaining(
  completions: readonly number[] | undefined,
  task: AshenMilitiaTask,
  now = Date.now(),
): number | null {
  const max = task.maxCompletionsPerWindow;
  if (max == null || max <= 0) return null;
  const windowMs = task.completionWindowMs ?? ASHEN_MILITIA_TASK_WINDOW_MS;
  const recent = (completions ?? []).filter((t) => now - t < windowMs).length;
  return Math.max(0, max - recent);
}

/** Standing helpers: same bands as Ashen Traders. */
export function ashenMilitiaStanding(reputation: number): AshenStanding {
  return ashenStanding(reputation);
}

export function ashenMilitiaStandingLabel(standing: AshenStanding): string {
  return ashenStandingLabel(standing);
}

/** Hostile / Exiled cannot open militia talk (same gate as Ashen trade). */
export function canTalkWithAshenMilitia(reputation: number): boolean {
  return canTradeWithAshen(reputation);
}

/** Anyone the militia will still talk to may use the Birchport barracks bargate. */
export function canEnterBirchportBarracks(reputation: number): boolean {
  return canTalkWithAshenMilitia(reputation);
}

export function dropAshenMilitiaReputationLevel(reputation: number): number {
  return dropAshenReputationLevel(reputation);
}
