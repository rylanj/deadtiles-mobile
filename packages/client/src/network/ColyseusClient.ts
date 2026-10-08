import { Client, Room } from "colyseus.js";
import {
  WORLD_FULL_MESSAGE,
  WORLD_ROOM_NAME,
  type FreeAimSurface,
  type MarketStatePayload,
  type StructureBuildKind,
  type StructureFenceCorner,
  type StructureFenceFacing,
} from "@zombie/shared";
import {
  connectSolanaWallet,
  signLoginMessage,
  type SolanaWalletProvider,
} from "./solanaWallet";
import { isNativeApp } from "../native";
import { signInWithMobileWallet } from "./mobileWalletAdapter";
import { ApiHttpError, apiRequest } from "./api";
import type { WalletOption } from "./walletOptions";

const SESSION_KEY = "deatiles_session";
const SESSION_META_KEY = "deatiles_session_meta";
const DEFAULT_GAME_SERVER_URL = "https://play.deadtiles.com";

export type PlayerPreview = {
  exists: boolean;
  needsName?: boolean;
  name?: string | null;
  health?: number;
  stamina?: number;
  /** Fitness cap used to draw the stamina bar. Defaults to the unskilled max. */
  staminaMax?: number;
  hunger?: number;
  thirst?: number;
  temperature?: number;
  inventoryJson?: string;
  weaponMagazinesJson?: string;
  equippedInventorySlot?: number;
  magazineRounds?: number;
  /** PlayerMan clothing skin (1 bare, 2 white tee, 3 black tee). */
  clothingSkin?: number;
  infected?: boolean;
  infection?: number;
};

export type AuthSession = {
  sessionToken: string;
  wallet: string;
  needsName: boolean;
  name: string | null;
  preview: PlayerPreview;
};

type StoredSessionMeta = {
  wallet: string;
  needsName: boolean;
  name: string | null;
  preview: PlayerPreview;
};

function configuredServerUrl(): string | null {
  const raw = import.meta.env.VITE_SERVER_URL?.trim();
  if (!raw) return null;
  return raw.replace(/\/$/, "");
}

/**
 * Local: set VITE_SERVER_URL in gitignored packages/client/.env
 * (e.g. http://192.168.0.184:2567). VPS builds have no .env, so this falls
 * back to the public Colyseus host.
 */
export function serverUrl() {
  return configuredServerUrl() ?? DEFAULT_GAME_SERVER_URL;
}

export function loadStoredSessionToken(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

export function storeSessionToken(token: string) {
  try {
    localStorage.setItem(SESSION_KEY, token);
  } catch {
    /* ignore */
  }
}

/** Persist token + profile so disconnects during server restarts don't look like a logout. */
export function storeAuthSession(session: AuthSession) {
  storeSessionToken(session.sessionToken);
  try {
    const meta: StoredSessionMeta = {
      wallet: session.wallet,
      needsName: session.needsName,
      name: session.name,
      preview: session.preview,
    };
    localStorage.setItem(SESSION_META_KEY, JSON.stringify(meta));
  } catch {
    /* ignore */
  }
}

/** Build a session from localStorage without hitting the auth API. */
export function loadCachedAuthSession(): AuthSession | null {
  const sessionToken = loadStoredSessionToken();
  if (!sessionToken) return null;
  try {
    const raw = localStorage.getItem(SESSION_META_KEY);
    if (!raw) return null;
    const meta = JSON.parse(raw) as StoredSessionMeta;
    if (!meta || typeof meta.wallet !== "string" || !meta.wallet) return null;
    return {
      sessionToken,
      wallet: meta.wallet,
      needsName: Boolean(meta.needsName),
      name: meta.name ?? null,
      preview: meta.preview ?? { exists: Boolean(meta.name) },
    };
  } catch {
    return null;
  }
}

export function clearStoredSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_META_KEY);
  } catch {
    /* ignore */
  }
}

export async function fetchAuthNonce(
  walletAddress?: string,
): Promise<{ nonce: string; message: string }> {
  const query = walletAddress
    ? `?wallet=${encodeURIComponent(walletAddress)}`
    : "";
  return apiRequest<{ nonce: string; message: string }>(
    `${serverUrl()}/auth/nonce${query}`,
  );
}

/**
 * Restore a still-valid server session without re-signing.
 * Network / 5xx failures keep the cached session so a world disconnect during
 * a server restart returns to Enter world instead of Connect wallet.
 */
export async function restoreAuthSession(): Promise<AuthSession | null> {
  const sessionToken = loadStoredSessionToken();
  if (!sessionToken) return null;

  try {
    const data = await apiRequest<{
      wallet: string;
      needsName: boolean;
      name: string | null;
      preview: PlayerPreview;
    }>(`${serverUrl()}/auth/session`, {
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    const session: AuthSession = {
      sessionToken,
      wallet: data.wallet,
      needsName: data.needsName,
      name: data.name,
      preview: data.preview,
    };
    storeAuthSession(session);
    return session;
  } catch (err) {
    if (
      err instanceof ApiHttpError &&
      (err.status === 401 || err.status === 403)
    ) {
      clearStoredSession();
      return null;
    }
    return loadCachedAuthSession();
  }
}

export async function loginWithSolanaWallet(
  onPhase?: (message: string) => void,
  choice?: WalletOption,
): Promise<AuthSession> {
  if (isNativeApp()) {
    onPhase?.("Checking the Deadtiles server…");
    await apiRequest<{ ok: boolean }>(`${serverUrl()}/health`);
    const challenge = await fetchAuthNonce();
    const { wallet, nonce, signature } = await signInWithMobileWallet({
      nonce: challenge.nonce,
      message: challenge.message,
      onPhase,
      packageName: choice?.packageName,
      walletName: choice?.name,
    });
    return completeSignedLogin(wallet, nonce, signature);
  }

  const { provider, wallet } = await connectSolanaWallet(choice);
  return completeWalletLogin(provider, wallet);
}

export async function completeWalletLogin(
  provider: SolanaWalletProvider,
  wallet: string,
): Promise<AuthSession> {
  const { nonce, message } = await fetchAuthNonce(wallet);
  const signature = await signLoginMessage(provider, message);
  return completeSignedLogin(wallet, nonce, signature);
}

export async function completeSignedLogin(
  wallet: string,
  nonce: string,
  signature: string,
): Promise<AuthSession> {
  const data = await apiRequest<AuthSession>(`${serverUrl()}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    json: { wallet, nonce, signature },
  });
  storeAuthSession(data);
  return data;
}

export async function registerSurvivorName(
  sessionToken: string,
  name: string,
): Promise<AuthSession> {
  const data = await apiRequest<{
    name: string;
    wallet: string;
    preview: PlayerPreview;
  }>(`${serverUrl()}/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sessionToken}`,
    },
    json: { name },
  });
  const session: AuthSession = {
    sessionToken,
    wallet: data.wallet,
    needsName: false,
    name: data.name,
    preview: data.preview,
  };
  storeAuthSession(session);
  return session;
}

export async function fetchPlayerPreview(
  sessionToken: string,
): Promise<PlayerPreview> {
  return apiRequest<PlayerPreview>(`${serverUrl()}/player-preview`, {
    headers: { Authorization: `Bearer ${sessionToken}` },
  });
}

export async function connectToWorld(sessionToken: string) {
  const client = new Client(serverUrl());
  let room: Room<WorldRoomState>;
  try {
    room = await client.joinOrCreate<WorldRoomState>(WORLD_ROOM_NAME, {
      sessionToken,
    });
  } catch (err) {
    // Colyseus MatchMakeError.message is the ServerError text from onCreate.
    const detail = err instanceof Error ? err.message : String(err);
    if (
      detail === WORLD_FULL_MESSAGE ||
      /no slots|world.*full|no rooms found/i.test(detail)
    ) {
      throw new Error(WORLD_FULL_MESSAGE);
    }
    throw err instanceof Error ? err : new Error(detail);
  }

  // Same timing hazard as identity: the manifest is sent during onJoin and
  // would be dropped if we waited for WorldScene to register a handler.
  let resolveSpawnEntities: (m: SpawnEntityManifest | null) => void = () => {};
  const spawnEntities = new Promise<SpawnEntityManifest | null>((resolve) => {
    resolveSpawnEntities = resolve;
  });
  room.onMessage("spawnEntities", (msg: SpawnEntityManifest) => {
    resolveSpawnEntities(msg ?? null);
  });

  // Server sends "identity" during onJoin — it can arrive before WorldScene mounts.
  // Wait here (and nudge with whoami) so the player-* id is never missed.
  const playerId = await new Promise<string>((resolve, reject) => {
    let settled = false;
    const finish = (id: string) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve(id);
    };
    const timer = window.setTimeout(() => {
      if (!settled) {
        reject(new Error("Timed out waiting for player identity"));
      }
    }, 20_000);
    room.onMessage("identity", (msg: { playerId?: string }) => {
      if (typeof msg?.playerId === "string" && msg.playerId.startsWith("player-")) {
        finish(msg.playerId);
      }
    });
    try {
      room.send("whoami");
    } catch {
      /* ignore — identity may still arrive from onJoin */
    }
  });

  return { client, room, playerId, spawnEntities };
}

/**
 * Entities in view at spawn, sent by the server once the join AOI is seeded.
 * Drives the "Loading nearby sprites" gate so nothing is drawn unloaded.
 */
export type SpawnEntityManifest = {
  zombies: { x: number; y: number; skin: number }[];
  guards: { x: number; y: number; skin: number; npcKind: number }[];
  players: { x: number; y: number; clothingSkin: number }[];
};

export type WorldRoom = Room<WorldRoomState>;

export type PlayerSchema = {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  health: number;
  facing: number;
  anim: string;
  animFrame: number;
  name: string;
  alive: boolean;
  idleWeapon: string;
  inInterior: boolean;
  buildingX: number;
  buildingY: number;
  interiorLevel: number;
  overworldX: number;
  overworldY: number;
  equippedWeaponIndex: number;
  equippedInventorySlot: number;
  equippedClothingSlot: number;
  clothingSkin: number;
  magazineRounds: number;
  isReloading: boolean;
  reloadEndTime: number;
  isUnloading: boolean;
  unloadEndTime: number;
  searchTargetId: string;
  searchEndTime: number;
  inventoryJson: string;
  weaponMagazinesJson: string;
  lastFireTime: number;
  lastShotSfx: number;
  fightingStanceUntil: number;
  stamina: number;
  staminaRegenAfter: number;
  hunger: number;
  thirst: number;
  temperature: number;
  isConsuming: boolean;
  consumeEndTime: number;
  consumeDurationMs: number;
  consumeAction: string;
  isCrafting: boolean;
  craftEndTime: number;
  craftDurationMs: number;
  isChangingClothes: boolean;
  clothingChangeEndTime: number;
  clothingChangeDurationMs: number;
  clothingChangeAction: string;
  ashenReputation: number;
  ashenRepCheckMs: number;
  ashenMilitiaReputation: number;
  ashenMilitiaRepCheckMs: number;
  redOrderReputation: number;
  radioChannel: number;
  isBuilding: boolean;
  buildEndTime: number;
  buildDurationMs: number;
  buildPrefabId: string;
  /** "" | "prefab" | "deconstruct" */
  buildAction: string;
  infected: boolean;
  infection: number;
  antibioticUntil: number;
  infectionTickAt: number;
};

export type ZombieSchema = {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  health: number;
  facing: number;
  anim: string;
  animFrame: number;
  skin: number;
  targetPlayerId: string;
  targetGuardId: string;
  isDead: boolean;
  looted: boolean;
  inInterior: boolean;
  buildingX: number;
  buildingY: number;
  investigating: boolean;
  investigateX: number;
  investigateY: number;
};

export type GuardSchema = {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  health: number;
  facing: number;
  anim: string;
  animFrame: number;
  skin: number;
  npcKind: number;
  alive: boolean;
  inInterior: boolean;
  buildingX: number;
  buildingY: number;
  patrolAx: number;
  patrolAy: number;
  patrolBx: number;
  patrolBy: number;
  walkingToB: boolean;
  patrolWaypointIndex: number;
  partnerId: string;
  groupId: string;
  leaderId: string;
  targetZombieId: string;
  hostilePlayerId: string;
  looted: boolean;
  lastFireTime: number;
  lastShotSfx: number;
  fightingStanceUntil: number;
  magazineRounds: number;
  reloadEndTime: number;
};

export type PlayerCorpseSchema = {
  x: number;
  y: number;
  facing: number;
  name: string;
  idleWeapon: string;
  equippedWeaponIndex: number;
  clothingSkin: number;
  inInterior: boolean;
  buildingX: number;
  buildingY: number;
  interiorLevel: number;
  looted: boolean;
};

export type SearchableSchema = {
  id: string;
  kind: string;
  objectType: string;
  x: number;
  y: number;
  searched: boolean;
  depleted: boolean;
  buildingX: number;
  buildingY: number;
  level: number;
  facing: string;
  /** Unix ms when a furnace's fire goes out. 0 when cold or not a furnace. */
  activeUntil: number;
  /** Safe is cracked and waiting for its loot search. The door stays closed. */
  cracked: boolean;
};

export type WorldRoomState = {
  minGlobalX: number;
  minGlobalY: number;
  mapWidth: number;
  mapHeight: number;
  worldTimeMs: number;
  sky: string;
  weather: string;
  weatherUntilMs: number;
  lightningActive: boolean;
  lightningFlashAt: number;
  lightningThunderAt: number;
  players: {
    get(id: string): PlayerSchema | undefined;
    forEach(cb: (player: PlayerSchema, id: string) => void): void;
  };
  zombies: {
    get(id: string): ZombieSchema | undefined;
    forEach(cb: (zombie: ZombieSchema, id: string) => void): void;
  };
  guards: {
    get(id: string): GuardSchema | undefined;
    forEach(cb: (guard: GuardSchema, id: string) => void): void;
  };
  coywolves: {
    get(id: string): {
      x: number;
      y: number;
      facing: number;
      anim: string;
      animFrame: number;
      health: number;
      isDead: boolean;
      looted?: boolean;
    } | undefined;
    forEach(
      cb: (
        wolf: {
          x: number;
          y: number;
          facing: number;
          anim: string;
          animFrame: number;
          health: number;
          isDead: boolean;
          looted?: boolean;
        },
        id: string,
      ) => void,
    ): void;
  };
  bears: {
    get(id: string): {
      x: number;
      y: number;
      facing: number;
      anim: string;
      animFrame: number;
      health: number;
      isDead: boolean;
      looted?: boolean;
    } | undefined;
    forEach(
      cb: (
        bear: {
          x: number;
          y: number;
          facing: number;
          anim: string;
          animFrame: number;
          health: number;
          isDead: boolean;
          looted?: boolean;
        },
        id: string,
      ) => void,
    ): void;
  };
  crows: {
    get(id: string): {
      x: number;
      y: number;
      facing: number;
      anim: string;
      animFrame: number;
      health: number;
      isDead: boolean;
      looted?: boolean;
      altitude: number;
    } | undefined;
    forEach(
      cb: (
        crow: {
          x: number;
          y: number;
          facing: number;
          anim: string;
          animFrame: number;
          health: number;
          isDead: boolean;
          looted?: boolean;
          altitude: number;
        },
        id: string,
      ) => void,
    ): void;
  };
  rabbits: {
    get(id: string): {
      x: number;
      y: number;
      facing: number;
      anim: string;
      animFrame: number;
      health: number;
      isDead: boolean;
      looted?: boolean;
    } | undefined;
    forEach(
      cb: (
        rabbit: {
          x: number;
          y: number;
          facing: number;
          anim: string;
          animFrame: number;
          health: number;
          isDead: boolean;
          looted?: boolean;
        },
        id: string,
      ) => void,
    ): void;
  };
  corpses: {
    get(id: string): PlayerCorpseSchema | undefined;
    forEach(cb: (corpse: PlayerCorpseSchema, id: string) => void): void;
  };
  searchables: {
    get(id: string): SearchableSchema | undefined;
    forEach(cb: (item: SearchableSchema, id: string) => void): void;
  };
};

export type LootEvent = {
  type: "lootFound";
  payload: { items: { id: string; quantity: number; name: string }[] };
};

export type ContainerOpenEvent = {
  type: "containerOpen";
  payload: {
    containerId: string;
    objectType: string;
    containerJson: string;
    piles?: {
      containerId: string;
      objectType: string;
      containerJson: string;
    }[];
  };
};

export type ContainerSyncEvent = {
  type: "containerSync";
  payload: {
    containerId: string;
    containerJson: string;
  };
};

export type TradeOpenEvent = {
  type: "tradeOpen";
  payload: {
    traderId: string;
    traderName: string;
    traderBanknotes: number;
    playerBanknotes: number;
    stockJson: string;
    stockCapacity?: number;
    inventoryJson: string;
  };
};

export type TradeSyncEvent = {
  type: "tradeSync";
  payload: {
    traderId: string;
    traderBanknotes: number;
    playerBanknotes: number;
    stockJson: string;
    stockCapacity?: number;
    inventoryJson: string;
    /** Set only for the player whose offer just went through. */
    completed?: boolean;
  };
};

export type DialogOpenEvent = {
  type: "dialogOpen";
  payload: {
    npcId: string;
    npcSkin: number;
    npcName: string;
    playerName: string;
    faction: "redOrder" | "ashenTraders" | "ashenMilitia";
    npcKind: number;
    redOrderReputation?: number;
    ashenReputation?: number;
    ashenMilitiaReputation?: number;
    inInterior?: boolean;
    taskCompletionsJson?: string;
    /** Kevin only. True after the safe deposit fee is paid. */
    safeDepositRented?: boolean;
  };
};

export type DialogTaskDeniedEvent = {
  type: "dialogTaskDenied";
  payload: {
    npcId: string;
    taskId: string;
    reason: string;
  };
};

export type DialogTaskCompleteEvent = {
  type: "dialogTaskComplete";
  payload: {
    taskId: string;
    redOrderReputation?: number;
    ashenReputation?: number;
    ashenMilitiaReputation?: number;
    rewards: { id: string; quantity: number; name: string }[];
    header?: string;
    keepOpen?: boolean;
    taskCompletionsJson?: string;
  };
};

export type DialogSpokenEvent = {
  type: "dialogSpoken";
  payload: {
    npcId: string;
    lineId: string;
    text: string;
  };
};

export type SafeDepositCloseEvent = {
  type: "safeDepositClose";
};

export type DialogHealCompleteEvent = {
  type: "dialogHealComplete";
  payload: {
    npcId: string;
    cost: number;
    health: number;
    curedInfection?: boolean;
  };
};

export type QuestSyncEvent = {
  type: "questSync";
  payload: { questsJson: string };
};

/** Skills are owner-only state, pushed here instead of riding the schema. */
export type SkillSyncEvent = {
  type: "skillSync";
  payload: { skillsJson: string };
};

/** Learned weapon recipes. Owner-only, same channel style as skills. */
export type BlueprintSyncEvent = {
  type: "blueprintSync";
  payload: {
    learnedBlueprintsJson: string;
    /** Set only when this sync is a blueprint the player just finished reading. */
    weaponId?: string;
  };
};

export type CraftOpenEvent = {
  type: "craftOpen";
  payload: {
    workbenchId: string;
    inventoryJson: string;
    station?: "workbench" | "furnace";
  };
};

export type CraftSyncEvent = {
  type: "craftSync";
  payload: {
    workbenchId: string;
    inventoryJson: string;
    crafted?: { id: string; quantity: number; name: string };
    salvaged?: { id: string; quantity: number; name: string }[];
    ruined?: { name: string }[];
  };
};

export type FireplaceOpenEvent = {
  type: "fireplaceOpen";
  payload: {
    x: number;
    y: number;
    inInterior: boolean;
    buildingX?: number;
    buildingY?: number;
    fuelWood: number;
    activeUntil: number;
    inventoryJson: string;
    hasLighter: boolean;
    title?: string;
    cookSlots?: { itemId: string; stageStartedAt: number }[] | null;
    stationId?: string;
  };
};

export type FireplaceSyncEvent = {
  type: "fireplaceSync";
  payload: {
    x: number;
    y: number;
    inInterior: boolean;
    buildingX?: number;
    buildingY?: number;
    fuelWood: number;
    activeUntil: number;
    inventoryJson: string;
    hasLighter: boolean;
    title?: string;
    cookSlots?: { itemId: string; stageStartedAt: number }[] | null;
    stationId?: string;
  };
};

export type ShotMissEvent = {
  type: "shotMissed";
  payload: {
    targetId: string;
    impactX: number;
    impactY: number;
    weaponIndex: number;
    treeCoverMiss?: boolean;
  };
};

export type EntityHitEvent = {
  type: "entityHit";
  payload: {
    targetId: string;
    x: number;
    y: number;
    weaponIndex: number;
  };
};

export type GunshotHeardEvent = {
  type: "gunshotHeard";
  payload: {
    x: number;
    y: number;
    weaponIndex: number;
    sfxVariant: number;
    inInterior: boolean;
    buildingX: number;
    buildingY: number;
  };
};

export type ZombieSpotGroanEvent = {
  type: "zombieSpotGroan";
  payload: {
    x: number;
    y: number;
    variant: number;
    inInterior: boolean;
    buildingX: number;
    buildingY: number;
  };
};

export type BulletImpactEvent = {
  type: "bulletImpact";
  payload: {
    x: number;
    y: number;
    weaponIndex: number;
    surface: FreeAimSurface;
    inInterior: boolean;
    buildingX?: number;
    buildingY?: number;
  };
};

export type ShotTraceEvent = {
  type: "shotTrace";
  payload: {
    originX: number;
    originY: number;
    endX: number;
    endY: number;
    blocked: boolean;
    inInterior: boolean;
    buildingX?: number;
    buildingY?: number;
  };
};

export type BargateOpenEvent = {
  type: "bargateOpen";
  payload: {
    x: number;
    y: number;
    facing: "SE" | "SW";
  };
};

export type PrefabOpenEvent = {
  type: "prefabOpen";
  payload: {
    x: number;
    y: number;
    inInterior: boolean;
    buildingX?: number;
    buildingY?: number;
    kind: StructureBuildKind;
    depositsJson: string;
    inventoryJson: string;
  };
};

export type PrefabSyncEvent = {
  type: "prefabSync";
  payload: {
    x: number;
    y: number;
    inInterior: boolean;
    buildingX?: number;
    buildingY?: number;
    kind: StructureBuildKind;
    depositsJson: string;
    inventoryJson: string;
    funded: boolean;
  };
};

export type PrefabBuiltEvent = {
  type: "prefabBuilt";
  payload: {
    x: number;
    y: number;
    kind: StructureBuildKind;
    ownerWallet: string;
    isOpen: boolean;
    isLocked: boolean;
    activeUntil: number;
    fuelWood: number;
    status: "prefab" | "solid";
    depositsJson: string;
    health: number;
    maxHealth: number;
    inInterior: boolean;
    buildingX?: number;
    buildingY?: number;
    facing?: StructureFenceFacing | StructureFenceCorner;
  };
};

export type StructureDamagedEvent = {
  type: "structureDamaged";
  payload: {
    x: number;
    y: number;
    inInterior: boolean;
    buildingX?: number;
    buildingY?: number;
    health: number;
    maxHealth: number;
    destroyed?: boolean;
  };
};

export type DeconstructOpenEvent = {
  type: "deconstructOpen";
  payload: {
    x: number;
    y: number;
    inInterior: boolean;
    buildingX?: number;
    buildingY?: number;
    kind: StructureBuildKind;
    refund: { itemId: string; quantity: number }[];
  };
};

export type SkillLevelUpEvent = {
  type: "skillLevelUp";
  payload: { label: string; subId: string; level: number };
};

export type PlayerNoteEvent = {
  type: "playerNote";
  payload: {
    text: string;
    iconId?: string;
    durationMs?: number;
    items?: { id?: string; name: string; quantity: number }[];
  };
};

export type InventorySyncEvent = {
  inventoryJson: string;
  weaponMagazinesJson: string;
  equippedInventorySlot: number;
  magazineRounds: number;
};

export type MarketBoardEvent = {
  type: "marketOpen" | "marketSync";
  payload: MarketStatePayload;
};

export type ServerEvent =
  | LootEvent
  | ContainerOpenEvent
  | ContainerSyncEvent
  | TradeOpenEvent
  | TradeSyncEvent
  | MarketBoardEvent
  | DialogOpenEvent
  | DialogTaskDeniedEvent
  | DialogTaskCompleteEvent
  | DialogSpokenEvent
  | DialogHealCompleteEvent
  | SafeDepositCloseEvent
  | QuestSyncEvent
  | SkillSyncEvent
  | BlueprintSyncEvent
  | CraftOpenEvent
  | CraftSyncEvent
  | FireplaceOpenEvent
  | FireplaceSyncEvent
  | ShotMissEvent
  | EntityHitEvent
  | GunshotHeardEvent
  | ZombieSpotGroanEvent
  | BulletImpactEvent
  | ShotTraceEvent
  | BargateOpenEvent
  | PrefabOpenEvent
  | PrefabSyncEvent
  | PrefabBuiltEvent
  | StructureDamagedEvent
  | DeconstructOpenEvent
  | SkillLevelUpEvent
  | PlayerNoteEvent;
