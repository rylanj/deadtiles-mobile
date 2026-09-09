/**
 * The Red Order — dialog lines + reputation (shared faction standing scale).
 * Reputation uses the same Exiled → Allied bands as Ashen Traders.
 */

import {
  FACTION_REP_ALLIED,
  FACTION_REP_EXILED,
  FACTION_REP_EXILED_THRESHOLD,
  FACTION_REP_FRIENDLY,
  FACTION_REP_HOSTILE,
  FACTION_REP_NEUTRAL,
  FACTION_REP_START,
  FACTION_REP_WARM,
  FACTION_REP_WARY,
  dropFactionReputationLevel,
  factionStanding,
  factionStandingLabel,
  type FactionStanding,
} from "./factionRep.js";

/** Starting reputation (Wary). */
export const RED_ORDER_REP_START = FACTION_REP_START;
export const RED_ORDER_REP_EXILED_THRESHOLD = FACTION_REP_EXILED_THRESHOLD;
export const RED_ORDER_REP_EXILED = FACTION_REP_EXILED;
export const RED_ORDER_REP_HOSTILE = FACTION_REP_HOSTILE;
export const RED_ORDER_REP_WARY = FACTION_REP_WARY;
export const RED_ORDER_REP_NEUTRAL = FACTION_REP_NEUTRAL;
export const RED_ORDER_REP_WARM = FACTION_REP_WARM;
export const RED_ORDER_REP_FRIENDLY = FACTION_REP_FRIENDLY;
export const RED_ORDER_REP_ALLIED = FACTION_REP_ALLIED;

export type RedOrderStanding = FactionStanding;

export function redOrderStanding(reputation: number): RedOrderStanding {
  return factionStanding(reputation);
}

export function redOrderStandingLabel(standing: RedOrderStanding): string {
  return factionStandingLabel(standing);
}

export function dropRedOrderReputationLevel(reputation: number): number {
  return dropFactionReputationLevel(reputation);
}

export type RedOrderDialogLine = {
  id: string;
  /** Player speech option. */
  player: string;
  /**
   * NPC reply variants — same meaning, different wording.
   * Later entries tend to be a bit more informative.
   */
  npc: readonly string[];
};

/** Starter talk options — dry, practical, no tough-guy pastiche. */
export const RED_ORDER_DIALOG_LINES: readonly RedOrderDialogLine[] = [
  {
    id: "who",
    player: "Who are you?",
    npc: [
      "Red Order. We hold city blocks. Ashen stay out.",
      "Red Order. We hold parts of the cities and put people to work keeping them that way. If you're looking for the Ashen, try somewhere else. We don't share streets with them.",
      "We're the Red Order. City crews, red armbands. We clear buildings, put survivors to work, and keep Ashen Militia off our turf. You won't find their checkpoints in our streets.",
      "Name's Red Order. We take city ground and keep it. Ashen run their county roads. We don't share.",
    ],
  },
  {
    id: "join",
    player: "How do I get in?",
    npc: [
      "Show up useful. Killing Ashen Militia helps.",
      "You don't ask. You show up useful. Killing Ashen Militia helps. They're armored and they look out for each other, so don't treat it like target practice.",
      "Nobody fills out a form. Bring proof you can handle Ashen Militia: dog tags from their patrols. They're armored, they fight as a group, and they don't forget. Do that and people start noticing.",
      "Earn it. Hit Ashen patrols, bring dog tags, don't get yourself killed. Asking alone doesn't get you an armband.",
    ],
  },
  {
    id: "trade",
    player: "Can I buy anything here?",
    npc: [
      "No shop. We take what we need.",
      "We don't run a shop. Supply comes from what we take. Ashen caravans are usually carrying something worth the risk.",
      "There's no counter. Gear comes off Ashen caravans and whatever we strip from the buildings we clear. If you want stock, hit a trader convoy or scavenge yourself.",
      "Not a market. We live off what we seize. Ashen caravans especially.",
    ],
  },
  {
    id: "armbands",
    player: "The armbands?",
    npc: [
      "So you can tell us apart. Don't wear one unless you belong.",
      "So you can tell us from everyone else. Wear one only if you belong. Wearing one without permission ends badly.",
      "Red cloth means Red Order. It's how we spot our own in a fight. Put one on without being brought in and you'll wish you hadn't.",
      "Marks us. Fake one and someone will notice.",
    ],
  },
  {
    id: "ashen",
    player: "What's your problem with the Ashen?",
    npc: [
      "They hold checkpoints and leave towns hollow. We stay.",
      "Militia hold checkpoints and call it order. Traders move scrap and call it a market. Both leave towns hollow. We stay and rebuild.",
      "Ashen Militia lock down roads and settlements in their county. Their traders skim the leftovers. Neither of them rebuilds a city block. We clear buildings, put people to work, and keep the walkers out of our streets.",
      "Militia play sheriff on the roads. Traders chase scrap. We hold ground that actually matters.",
    ],
  },
  {
    id: "jobs",
    player: "Do you have any jobs for me?",
    npc: [
      "Bring Ashen Militia dog tags. We'll pay.",
      "Ashen Militia patrols have been a problem lately. We need some of them taken out. Bring us their dog tags and we'll make it worth your while.",
      "Work's simple: Ashen Militia patrols. Kill them, bring the dog tags here. You'll get banknotes and we'll remember you helped. They're not soft targets. Armor and numbers, so don't get cocky.",
      "Yes. Thin out Ashen Militia and bring their tags. Pay's decent if you survive it.",
    ],
  },
  {
    id: "safe",
    player: "Am I safe in here?",
    npc: [
      "Safer than the roads. Don't steal. Don't start fights.",
      "Safer than the roads. We clear walkers from our buildings. Don't steal from us and don't start fights you can't finish.",
      "Inside our walls you're clearer of walkers than outside. Steal from a stash or pick a fight you can't win and that changes fast. Keep your head and you'll walk out fine.",
      "For now. We keep walkers out. You keep your hands to yourself.",
    ],
  },
  {
    id: "bye",
    player: "That's all I needed.",
    npc: [
      "Fine.",
      "Fine. Don't make me regret the conversation.",
      "Alright. Don't waste what I told you, and don't bring Ashen heat back here.",
      "We're done. Watch yourself.",
    ],
  },
];

/** Turn-in: Ashen Militia dog tags for banknotes + Red Order reputation. */
export const RED_ORDER_ASHEN_PATROL_TASK = {
  id: "ashen_patrol_dogtags",
  dialogLineId: "jobs",
  requireItemId: "dogtag",
  requireQty: 1,
  rewardBanknotes: 200,
  rewardReputation: 500,
} as const;

export function redOrderDialogLineById(
  id: string,
): RedOrderDialogLine | undefined {
  return RED_ORDER_DIALOG_LINES.find((line) => line.id === id);
}
