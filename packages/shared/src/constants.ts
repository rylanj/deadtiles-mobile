/** Initial map chunk size — grows via EXTEND_AMOUNT when players near edges. */
export const INITIAL_MAP_WIDTH = 50;
export const INITIAL_MAP_HEIGHT = 50;
export const EXTEND_THRESHOLD = 30;
export const EXTEND_AMOUNT = 50;

/**
 * Half-side of the client render / click-to-move square (200×200 tiles).
 * Server expands world bounds and pathfinding budget to cover this range.
 */
export const PLAYER_VIEW_RADIUS = 100;

/**
 * Hard cap on mapWidth / mapHeight. Must stay below schema uint16 (65535)
 * to avoid wrap corruption from unbounded world growth.
 */
export const MAX_MAP_DIMENSION = 10_000;

/** @deprecated Use INITIAL_MAP_WIDTH — kept for legacy imports. */
export const WORLD_COLS = INITIAL_MAP_WIDTH;
/** @deprecated Use INITIAL_MAP_HEIGHT — kept for legacy imports. */
export const WORLD_ROWS = INITIAL_MAP_HEIGHT;

/** Isometric tile footprint in screen pixels (client rendering). */
export const TILE_WIDTH = 64;
export const TILE_HEIGHT = 32;

/** Procedural map — matches original Zombie Survival Game. */
export const MAP_SEED_WORD = "rghdfihgbfdhgb";
export const WALL_PROB = 1 / 200;
export const WALL_DEPTH = 96;
/** Extra screen-Y for warehouse roof parapet above the top storey. */
export const WAREHOUSE_ROOF_LIP_HEIGHT = 6;
/** Extra screen-Y for a warehouse roof ridge above the deck. */
export const WAREHOUSE_ROOF_PEAK_HEIGHT = 16;
/** Extra screen-Y for a motel roof ridge above the deck. */
export const MOTEL_ROOF_PEAK_HEIGHT = 16;
/** Extra screen-Y for a barracks tent canvas ridge above the wall plate. */
export const TENT_ROOF_PEAK_HEIGHT = 18;
/** Extra screen-Y for police-station roof parapet above the deck. */
export const POLICE_ROOF_LIP_HEIGHT = 6;
/** Extra screen-Y for police-station roof props (HVAC / hatch) above the deck. */
export const POLICE_ROOF_PROP_HEIGHT = 5;
/** Extra screen-Y for supermarket roof props (RTU / vents) above the deck. */
export const SUPERMARKET_ROOF_PROP_HEIGHT = 10;
/** Extra screen-Y for house gable ridge above the wall top. */
export const HOUSE_ROOF_PEAK_HEIGHT = 20;
/** Extra stack height above the house gable peak for residential chimneys. */
export const HOUSE_CHIMNEY_HEIGHT = 10;
/** Deterministic chimney spawn rates by settlement context. */
export const HOUSE_CHIMNEY_CHANCE_RURAL = 0.75;
export const HOUSE_CHIMNEY_CHANCE_TOWN = 0.25;
export const HOUSE_CHIMNEY_CHANCE_CITY = 0.1;
export const GROUND_DEPTH = 0;

/** Server simulation */
export const TICK_RATE = 20;
export const TICK_MS = 1000 / TICK_RATE;
export const PLAYER_SPEED = 1.8;
export const SPRINT_SPEED = 5.4;
/** Movement multiplier while /godmode is active. */
export const GODMODE_SPEED_MULT = 10;

export function playerWalkSpeed(godMode = false): number {
  return godMode ? PLAYER_SPEED * GODMODE_SPEED_MULT : PLAYER_SPEED;
}

export function playerSprintSpeed(godMode = false): number {
  return godMode ? SPRINT_SPEED * GODMODE_SPEED_MULT : SPRINT_SPEED;
}

/** ~60s of continuous sprint at 1 stamina/sec drain. */
export const STAMINA_MAX = 60;
export const STAMINA_DRAIN_PER_SEC = 1;
export const STAMINA_REGEN_PER_SEC = 1;
/** Delay after hitting 0 stamina before regen begins. */
export const STAMINA_REGEN_DELAY_MS = 10_000;

/** Hunger drains 0.5 per minute; thirst drains 1 per minute. */
export const HUNGER_MAX = 100;
export const THIRST_MAX = 100;
export const HUNGER_DRAIN_PER_SEC = 0.5 / 60;
export const THIRST_DRAIN_PER_SEC = 1 / 60;
/** Health lost per second while hunger is empty. */
export const STARVATION_DAMAGE_PER_SEC = 1;
/** Health lost per second while thirst is empty. */
export const DEHYDRATION_DAMAGE_PER_SEC = 1;
/** Apply starvation/dehydration damage in one chunk on this interval (matches red flash). */
export const STARVATION_DAMAGE_INTERVAL_SEC = 5;

export const ZOMBIE_SPEED = 0.55;
export const ZOMBIE_AGGRO_RANGE = 12;
export const ZOMBIE_ATTACK_RANGE = 0.5;
export const ZOMBIE_DAMAGE = 8;
export const ZOMBIE_ATTACK_COOLDOWN_MS = 1000;
export const PLAYER_MAX_HEALTH = 100;
export const ZOMBIE_MAX_HEALTH = 40;
/** @deprecated Auto-respawn removed — players must press Respawn. Kept for save compat. */
export const PLAYER_RESPAWN_MS = 3000;
/** Procedural settlement name used as the player spawn / respawn hub. */
export const PLAYER_SPAWN_HUB_NAME = "Birchport";
/**
 * Max Euclidean tile distance outside the hub settlement footprint.
 * Spawns stay outside the city proper, within this band of its outskirts.
 */
export const PLAYER_SPAWN_RADIUS_TILES = 50;
/**
 * Minimum Chebyshev distance from roads and living zombies for spawn / respawn.
 * Must be ≥ {@link ZOMBIE_AGGRO_RANGE} so fresh spawns are not immediately chased.
 */
export const PLAYER_SPAWN_CLEARANCE_TILES = 14;
/**
 * Max time a joining/respawning player is immune to damage while the client
 * finishes loading (canvas reveal). Cleared earlier by `clientReady`.
 */
export const PLAYER_SPAWN_PROTECT_MS = 8000;

/** Chance (0–1) that an inter-city arterial connection spawns a patrolling guard. */
export const GUARD_ARTERIAL_PATROL_CHANCE = 0.1;
export const GUARD_SPEED = 1.5;
/** Same pool as players. MilitiaGuard1/2 and TraderGuard1 soak gunfire via armour. */
export const GUARD_MAX_HEALTH = PLAYER_MAX_HEALTH;
/** Lateral tile offset between paired guards walking the same arterial. */
export const GUARD_PAIR_LATERAL_OFFSET = 1.25;
/** Chebyshev tile distance at which a guard stops patrolling and opens fire. */
export const GUARD_ENGAGE_RANGE = 6;
/** @deprecated Use GUARD_ENGAGE_RANGE — kept as alias for existing imports. */
export const GUARD_ZOMBIE_ENGAGE_RANGE = GUARD_ENGAGE_RANGE;
/** How long a guard holds combat stance (frozen, firing) after engaging. */
export const GUARD_COMBAT_STANCE_MS = 3000;
/** WEAPONS index — guards always carry the AK. */
export const GUARD_WEAPON_INDEX = 4;

/** Shot variations per gun. Clients play the index the server stored on the shot. */
export const GUNSHOT_VARIANT_COUNT = 3;

/** Clamp a client-supplied index, or pick one when missing / invalid. */
export function resolveGunshotVariant(raw?: number): number {
  if (
    typeof raw === "number" &&
    Number.isInteger(raw) &&
    raw >= 0 &&
    raw < GUNSHOT_VARIANT_COUNT
  ) {
    return raw;
  }
  return Math.floor(Math.random() * GUNSHOT_VARIANT_COUNT);
}

/**
 * GuardState.npcKind — arterial MilitiaGuard vs trader caravan members vs Red Order.
 * 0 = MilitiaGuard patrol, 1 = TraderMan (no shoot), 2 = TraderGuard (pistol),
 * 3 = RedMan (warehouse / Red Order supermarket — pistol/shotgun by skin 1–4).
 */
export const GUARD_NPC_HUMAN = 0;
export const GUARD_NPC_TRADER_MAN = 1;
export const GUARD_NPC_TRADER_GUARD = 2;
export const GUARD_NPC_RED_MAN = 3;

export type GuardNpcFaction = "militia" | "trader" | "red";

/** Militia, Ashen traders, and Red Order each treat their own as friendlies. */
export function guardNpcFaction(npcKind: number): GuardNpcFaction {
  if (npcKind === GUARD_NPC_RED_MAN) return "red";
  if (
    npcKind === GUARD_NPC_TRADER_MAN ||
    npcKind === GUARD_NPC_TRADER_GUARD
  ) {
    return "trader";
  }
  return "militia";
}

export function guardsAreAllied(aNpcKind: number, bNpcKind: number): boolean {
  return guardNpcFaction(aNpcKind) === guardNpcFaction(bNpcKind);
}

/** Faction label for RedMan1–4 warehouse / supermarket NPCs. */
export const RED_ORDER_FACTION = "The Red Order";
/** Chance (0–1) a warehouse interior seeds Red Order patrols. */
export const RED_MAN_WAREHOUSE_SPAWN_CHANCE = 0.05;
/**
 * Chance (0–1) a supermarket is owned by The Red Order (seeded per building).
 * Birchport's supermarket(s) are always owned regardless of this roll.
 */
export const RED_MAN_SUPERMARKET_OWN_CHANCE = 0.1;
/** How many RedMen to place when a warehouse / Red Order supermarket seeds. */
export const RED_MAN_WAREHOUSE_COUNT = 4;
/** Euclidean engage range — kill zombies within this distance. */
export const RED_MAN_ENGAGE_RANGE = 6;
/** RedMan2 = shotgun; RedMan1 / 3 / 4 = pistol. */
export const RED_MAN_SKIN_COUNT = 4;

/** WEAPONS index for a RedMan skin (2=shotgun, otherwise pistol). */
export function redManWeaponIndex(skin: number): number {
  return skin === 2 ? 1 : 0;
}

/** Chance (0–1) an arterial also spawns a TraderMan + 2 TraderGuards. */
export const TRADER_ARTERIAL_SPAWN_CHANCE = 0.15;
/** Hostile-rep players get a spoken warning within this Euclidean tile radius. */
export const ASHEN_HOSTILE_WARN_RADIUS = 20;
/** After the warning, escorts open fire if the player is still inside the radius. */
export const ASHEN_HOSTILE_WARN_DELAY_MS = 10_000;
export const ASHEN_HOSTILE_WARN_LINE =
  "We don't want to trade with you right now, go away or we will shoot!";
/**
 * Birchport hospital: after a player draws a weapon, militia aim and warn;
 * if still armed inside after this delay, the whole Birchport garrison opens fire.
 */
export const HOSPITAL_WEAPON_WARN_DELAY_MS = 10_000;
export const HOSPITAL_WEAPON_WARN_LINE = "Put your weapon away now!";
/**
 * Birchport hospital and military barracks: searching furniture in a
 * militia guard's LOS aims and warns. Cancelling the search stands them
 * down. Completing it uses one free pass per server restart; a second
 * completed theft turns the garrison hostile.
 */
export const HOSPITAL_SEARCH_WARN_LINE = "Stop stealing now!";
/**
 * Barracks bargate: one street guard warns when a player comes this close
 * (Euclidean tiles). Leave radius is a bit larger so the edge does not spam.
 */
export const BARRACKS_GATE_WARN_RADIUS = 5;
export const BARRACKS_GATE_WARN_LEAVE_RADIUS = 6;
export const BARRACKS_GATE_WARN_LINE =
  "This is a restricted area. You need to leave.";
/**
 * Market door: one outside trader guard speaks when a Hostile or Exiled
 * player comes this close. Leave radius is larger so the edge does not spam.
 */
export const ASHEN_MARKET_DOOR_WARN_RADIUS = 5;
export const ASHEN_MARKET_DOOR_WARN_LEAVE_RADIUS = 7;
export const ASHEN_MARKET_DOOR_LINES = [
  "We don't want your kind inside.",
  "We don't do business with your kind.",
  "We don't want your kind in this market.",
  "We don't do business with your kind. Move along.",
  "Your kind isn't coming in. We don't want you inside.",
  "Turn around. We don't do business with your kind.",
] as const;
/** Bargate1_Active frames when a Friendly+ player uses the barracks gate. */
export const BARRACKS_BARGATE_ACTIVE_FRAMES = 5;
/** Ms per Active frame before the last pose is held. */
export const BARRACKS_BARGATE_FRAME_MS = 80;
/** After the last Active frame, wait this long before returning to Idle. */
export const BARRACKS_BARGATE_HOLD_MS = 3_000;
/** Total time the barracks bargate stays walkable after a Friendly+ open. */
export const BARRACKS_BARGATE_OPEN_MS =
  (BARRACKS_BARGATE_ACTIVE_FRAMES - 1) * BARRACKS_BARGATE_FRAME_MS +
  BARRACKS_BARGATE_HOLD_MS;
/** Lateral offset for TraderGuards flanking the centreline TraderMan. */
export const TRADER_PAIR_LATERAL_OFFSET = GUARD_PAIR_LATERAL_OFFSET;
/** How far behind TraderMan the flanking guards trail (triangle formation). */
export const TRADER_PAIR_REAR_OFFSET = 1;
/** WEAPONS index — TraderGuard1 carries the pistol. */
export const TRADER_WEAPON_INDEX = 0;
/**
 * Effective firing range for TraderGuard1 (skilled marksmen).
 * Overrides the pistol's base range without changing player pistols.
 */
export const TRADER_WEAPON_RANGE = 30;
/** Zombie engage range for TraderGuard1 (same as MilitiaGuard). */
export const TRADER_ZOMBIE_ENGAGE_RANGE = GUARD_ENGAGE_RANGE;
/** How long the trader caravan waits at each arterial endpoint before turning around. */
export const TRADER_ENDPOINT_DWELL_MS = 5 * 60_000;
/**
 * Birchport hospital lobby patrols: IdleAK pause at each route end before reversing.
 * Rolled per stop between min and max (inclusive).
 */
export const HOSPITAL_PATROL_DWELL_MS_MIN = 3_000;
export const HOSPITAL_PATROL_DWELL_MS_MAX = 7_000;

/**
 * Doctor Clark ward rounds: lobby Idle/Idle2 dwell before visiting a patient bed.
 */
export const DOCTOR_LOBBY_DWELL_MS_MIN = 45_000;
export const DOCTOR_LOBBY_DWELL_MS_MAX = 90_000;
/** Idle2 clipboard check beside HospitalBed2/3. */
export const DOCTOR_BED_DWELL_MS = 60_000;

/** Ashen market shelf guard: Idle2 clipboard check facing a big shelf. */
export const MARKET_SHELF_LOOK_MS_MIN = 4_000;
export const MARKET_SHELF_LOOK_MS_MAX = 8_000;
/** Brief stand between walks around the market shelves. */
export const MARKET_SHELF_PAUSE_MS_MIN = 1_200;
export const MARKET_SHELF_PAUSE_MS_MAX = 2_800;

/**
 * Captain Davis mess hall wander: Idle pause in the barracks mess hall
 * before the next short walk. Rolled per stop between min and max (inclusive).
 */
export const CAPTAIN_ADMIN_DWELL_MS_MIN = 12_000;
export const CAPTAIN_ADMIN_DWELL_MS_MAX = 28_000;

/**
 * Mess-hall diners: chance to walk to a canteen chair after an idle pause,
 * and how long they stay seated before standing again.
 */
export const MESS_HALL_DINER_SIT_CHANCE = 0.4;
export const MESS_HALL_DINER_SIT_MS_MIN = 10_000;
export const MESS_HALL_DINER_SIT_MS_MAX = 22_000;

/** Tiles between streetlight candidate slots along an arterial curb. */
export const STREETLIGHT_SPACING = 30;
/** Chance (0–1) a spaced curb slot actually gets a Streetlight1. */
export const STREETLIGHT_CHANCE = 0.42;
/** Skip this many tiles from each arterial tip so lights don't stack on junctions. */
export const STREETLIGHT_END_MARGIN = 3;

/** Tree Falling_0001–0008. Last frame is the tree on the ground. */
export const TREE_FALL_FRAMES = 8;
export const TREE_FALL_FRAME_MS = 120;
export const TREE_FALL_DURATION_MS =
  (TREE_FALL_FRAMES - 1) * TREE_FALL_FRAME_MS;

/** Duration of the 8-frame NPC/melee fire animation in ms. */
export const FIRE_ANIM_MS = 480;
/** PlayerMan Fire* clip — 5 frames at the same ~60ms/frame pacing as FIRE_ANIM_MS. */
export const PLAYER_FIRE_ANIM_MS = Math.round((FIRE_ANIM_MS * 5) / 8);
/**
 * Minimum ms between semi-auto NPC shots so the Fire* clip can finish.
 * Full-auto NPCs ignore this and use the weapon fireRate, same as the player.
 */
export const GUARD_FIRE_INTERVAL_MS = FIRE_ANIM_MS;
/** First shot after a clear lane opens (notice, raise, fire). */
export const GUARD_REACTION_MS_MIN = 340;
export const GUARD_REACTION_MS_MAX = 620;
/** Shorter wait when they already had the gun up or just fired. */
export const GUARD_REACQUIRE_MS_MIN = 100;
export const GUARD_REACQUIRE_MS_MAX = 200;
/** Chebyshev tile distance at which a guard greets a nearby player. */
export const GUARD_GREETING_RANGE = 10;
/** Minimum ms between greetings from a guard pair to the same player. */
export const GUARD_GREETING_COOLDOWN_MS = 5 * 60_000;
/** Random lines spoken when a player enters greeting range. */
export const GUARD_GREETINGS = [
  "Keep your weapon ready. You never know out here",
  "Heard gunfire east of town last night. Stay sharp",
  "If you see shamblers, don't lead them back this way",
  "Road's clear for now. Enjoy it while it lasts",
  "You look like you've seen some miles. Rest up if you need to",
  "No searching. We're watching",
  "Curfew's not a suggestion around here",
  "Lost someone to the horde? Sorry. Happens too often",
  "Fresh water's scarce. Don't waste what you've got",
  "Bandits love ambushing folks on the outskirts. Move in pairs if you can",
  "We've got eyes on the perimeter. You're in safe range",
  "Heard a scream from the old warehouse. Probably nothing. Probably",
  "Keep noise down. Sound travels far out here",
  "You packing enough ammo for a real fight?",
  "Welcome. Just don't make my job harder",
  "The dead don't sleep. Neither should you",
  "Trade's welcome. Trouble isn't",
  "Seen any survivors headed this way?",
  "Watch the tree line. They like to come from cover",
  "You're on patrol too, or just passing through?",
  "Good timing. Shift change in an hour. Streets'll be quiet",
  "If you're hurt, say so now. Med supplies aren't free",
  "I've shot three today already. Make it four and you'll regret it",
  "Nice gear. Shame if something happened to it out there",
  "Stay off the rooftops unless you want attention",
  "Mind the fences. Climb over and you're on your own",
  "Got bitten? Don't hide it. We deal with it fast",
  "I don't care where you came from. Just behave while you're here",
  "Last wanderer ignored the warning. We buried what was left",
  "You smell like smoke. Campfire or trouble?",
  "Nothing good happens after dark in these parts",
  "Keep moving if you're just browsing. Loitering gets you searched",
  "Zombies aren't the only thing that'll kill you out there",
  "I've seen tougher folks than you come back in pieces",
  "Don't touch the barricades. We spent all day on those",
  "Head north and you'll hit the badlands. Turn back while you can",
  "You got a name? Doesn't matter. Just stay in sight",
  "We lost the north gate yesterday. Patrols are doubled",
  "If it moans, shoot it. If it talks, listen first",
  "Supplies are tight. Don't expect a handout",
  "Nice to see a face that isn't grey and hungry",
  "Watch your back in the alleys. Pickpockets and worse",
  "Stay safe, traveller",
  "Be careful of the bandits in this area",
  "There have been reports of hordes nearby",
  "Don't try anything stupid",
  "How's your day going?",
  "Don't bother me",
] as const;
/** Duration of the 8-frame NPC death animation (plays once, holds on last frame). */
export const DIE_ANIM_MS = 640;
/** PlayerMan Die clip — 9 frames at the same pacing as DIE_ANIM_MS. */
export const PLAYER_DIE_ANIM_MS = Math.round((DIE_ANIM_MS * 9) / 8);
/** Deprecated: HumanMan1 short burst (frames 6–8). PlayerMan always plays the full Fire clip. */
export const FIRE_SHORT_ANIM_MS = Math.round((FIRE_ANIM_MS * 3) / 8);
/** How long the player holds Fire frame 1 after shooting (ms). */
export const FIGHTING_STANCE_MS = 10_000;
/** Re-alert skip radius — zombies already investigating within this range of a new shot are left alone. */
export const GUNSHOT_SAME_INVESTIGATION_RADIUS = 20;
/** Max distance from the shot origin for a zombie's personal investigate tile. */
export const GUNSHOT_INVESTIGATE_SPREAD = 6;
/** How close a zombie must get to its personal target to count as "in the vicinity". */
export const GUNSHOT_INVESTIGATE_ARRIVE_RADIUS = 2.5;
/** Idle in the gunshot vicinity this long, then wander off if nothing else aggro'd them. */
export const GUNSHOT_INVESTIGATE_LOITER_MS = 60_000;
/**
 * Nearby player actions (search, reload, consume, melee, death, footsteps).
 * Same ballpark as door / groan hearing, not rifle range.
 */
export const ACTION_SFX_HEAR_RADIUS = 22;
/** Full-volume distance for action SFX before falloff. */
export const ACTION_SFX_FULL_DIST = 6;
/**
 * Max time a zombie will keep pursuing an investigate target it never reaches
 * (e.g. gunshot behind player-built walls). Then wanders off like after loitering.
 */
export const GUNSHOT_INVESTIGATE_GIVE_UP_MS = 180_000;

/** Colyseus */
export const WORLD_ROOM_NAME = "world";
/** Shown when the single shared world is at maxClients and join is refused. */
export const WORLD_FULL_MESSAGE = "No slots in world available";
export const DEFAULT_SERVER_PORT = 2567;
