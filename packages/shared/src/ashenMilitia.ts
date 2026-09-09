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
  requireItemId: string;
  requireQty: number;
  rewardBanknotes: number;
  rewardReputation: number;
  /** Short label under the Task heading. */
  label: string;
  requireItemLabel: string;
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
        "Yes. I've got a turn-in board: ammo, smokes, lighters. Pick what you can carry. Bandages and water go to Clark at the hospital.",
        "I do. Standing needs for this barracks: 7.62, cigarettes, and lighters. Bring any of it and I'll pay, plus put in a word with the militia. If you've got bandages or water, take them to Doctor Clark.",
        "Look at the board. Three standing turn-ins right now. Banknotes and reputation for whatever you can spare. Ward stock is Clark's problem, not mine.",
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

/** Turn-in: bandages for the hospital ward. */
export const ASHEN_MILITIA_MEDICAL_TASK: AshenMilitiaTask = {
  id: "ashen_militia_bandages",
  dialogLineId: "jobs",
  requireItemId: "bandages",
  requireQty: 3,
  rewardBanknotes: 50,
  rewardReputation: 100,
  label: "Three's a Wrap",
  requireItemLabel: "Bandages",
};

/** Turn-in: rifle ammo for street patrols. */
export const ASHEN_MILITIA_AMMO_TASK: AshenMilitiaTask = {
  id: "ashen_militia_ammo",
  dialogLineId: "jobs",
  requireItemId: "ammo_762x39",
  requireQty: 30,
  rewardBanknotes: 300,
  rewardReputation: 600,
  label: "Feed our Rifles",
  requireItemLabel: "7.62x39mm Rounds",
};

/** Turn-in: drinking water for the hospital ward. */
export const ASHEN_MILITIA_WATER_TASK: AshenMilitiaTask = {
  id: "ashen_militia_water",
  dialogLineId: "jobs",
  requireItemId: "water",
  requireQty: 5,
  rewardBanknotes: 50,
  rewardReputation: 100,
  label: "Dry Patrol",
  requireItemLabel: "Water",
};

/** Turn-in: cigarettes for morale. */
export const ASHEN_MILITIA_CIGARETTES_TASK: AshenMilitiaTask = {
  id: "ashen_militia_cigarettes",
  dialogLineId: "jobs",
  requireItemId: "blue_cigarettes",
  requireQty: 5,
  rewardBanknotes: 50,
  rewardReputation: 100,
  label: "Morale Sticks",
  requireItemLabel: "Cigarettes",
};

/** Turn-in: lighter for field kits. */
export const ASHEN_MILITIA_LIGHTER_TASK: AshenMilitiaTask = {
  id: "ashen_militia_lighter",
  dialogLineId: "jobs",
  requireItemId: "lighter",
  requireQty: 1,
  rewardBanknotes: 25,
  rewardReputation: 50,
  label: "Firestarter",
  requireItemLabel: "Lighter",
};

export const ASHEN_MILITIA_CAPTAIN_TASKS: readonly AshenMilitiaTask[] = [
  ASHEN_MILITIA_AMMO_TASK,
  ASHEN_MILITIA_CIGARETTES_TASK,
  ASHEN_MILITIA_LIGHTER_TASK,
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
        "Bandages and drinking water for the ward. Hot chips if you can spare them. I'll pay.",
        "The ward's always short on bandages and bottled water. Bring those, or a bag of hot chips, and I'll remember who helps and who doesn't.",
        "Yes. Bandages and water for the patients, hot chips for me. Don't flood me with snacks or Captain Davis will give me a hard time.",
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

/** Doctor Clark snack turn-in (capped). */
export const ASHEN_MILITIA_SPICY_FINGERS_TASK: AshenMilitiaTask = {
  id: "ashen_militia_spicy_fingers",
  dialogLineId: "jobs",
  requireItemId: "hot_chips",
  requireQty: 1,
  rewardBanknotes: 10,
  rewardReputation: 20,
  label: "Spicy Fingers",
  requireItemLabel: "Hot Chips",
  maxCompletionsPerWindow: 5,
  completionWindowMs: ASHEN_MILITIA_TASK_WINDOW_MS,
};

export const ASHEN_MILITIA_DOCTOR_TASKS: readonly AshenMilitiaTask[] = [
  ASHEN_MILITIA_MEDICAL_TASK,
  ASHEN_MILITIA_WATER_TASK,
  ASHEN_MILITIA_SPICY_FINGERS_TASK,
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

/** Friendly or Allied may use the Birchport barracks bargate. */
export function canEnterBirchportBarracks(reputation: number): boolean {
  const standing = ashenMilitiaStanding(reputation);
  return standing === "friendly" || standing === "allied";
}

export function dropAshenMilitiaReputationLevel(reputation: number): number {
  return dropAshenReputationLevel(reputation);
}
