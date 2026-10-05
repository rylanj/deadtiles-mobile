import Phaser from "phaser";
import {
  cartesianToIso,
  ENTITY_RENDER_HEIGHT,
  DIE_ANIM_MS,
  PLAYER_DIE_ANIM_MS,
  FIGHTING_STANCE_MS,
  PLAYER_FIRE_FRAMES,
  PLAYER_DIE_FRAMES,
  playerAttackAnimMs,
  weaponAttackAnimMs,
  GUNSHOT_SAME_INVESTIGATION_RADIUS,
  getBuildingAt,
  hospitalCubicleAtTile,
  getStandingTreeAt,
  isTreeFelled,
  playerReadyToChopTree,
  syncFelledTrees,
  INITIAL_WORLD_BOUNDS,
  isInWeaponRange,
  closestMeleeSwingTarget,
  isWallTile,
  isoToCartesian,
  aimPointCartesian,
  bulletHeightScreenPos,
  PLAYER_AIM_HEAD_LIFT_PX,
  blockedTileApproachGoal,
  PATH_ARRIVAL,
  findFurnitureAtTile,
  furnitureApproachGoal,
  interiorDimensions,
  interiorExitForBuildingAt,
  interiorWalkable,
  interiorWallsForBuilding,
  interiorWallCornerDepthBias,
  interiorWallOccupiesTile,
  isInteriorExitTile,
  isBirchportWeaponEquipRestricted,
  BIRCHPORT_WEAPON_EQUIP_DENIED,
  roomAtInteriorDoor,
  roomDoorApproachGoal,
  searchableFootprint,
  buildingKey,
  computePlayerSkillMods,
  type PlayerSkillMods,
  craftDurationForSkill,
  ACTION_SFX_HEAR_RADIUS,
  UNLOAD_DURATION_MS,
  playerNearEntity,
  ASHEN_MARKET_TALK_RANGE,
  isAshenTraderWarehouse,
  ashenMarketApproachPoint,
  weaponIndexFromItemId,
  parseInventory,
  countItemInInventory,
  PLAYER_MAX_HEALTH,
  HUNGER_MAX,
  THIRST_MAX,
  getItemDefinition,
  canUseConsumable,
  getConsumeAction,
  playerMaxHealthFromInfection,
  CONSUME_ACTION_LABELS,
  parseLearnedBlueprints,
  CLOTHING_CHANGE_DURATION_MS,
  CLOTHING_CHANGE_ACTION_LABELS,
  CLOTHING_SLOT_INDEX,
  WATCH_SLOT_INDEX,
  MAP_SLOT_INDEX,
  RADIO_SLOT_INDEX,
  clothingSkinFromItemId,
  isClothingItem,
  getEntryWetness,
  isRawMeat,
  isInBirchport,
  isMilitiaCaptainSkin,
  QUEST_ID_FIRST_SWEEP,
  isWatchItem,
  isMapItem,
  isRadioItem,
  isSkillMagazine,
  getEntryRadioFreq,
  TICK_MS,
  zombieSpeedAtTime,
  WEAPONS,
  isMeleeWeapon,
  isFullAutoWeapon,
  getAmmoTypeForWeapon,
  getInventoryAmmo,
  canAddToInventory,
  parseWeaponMagazines,
  getStoredMagazineRounds,
  shotHitsTarget,
  advanceWalkAnimFrame,
  dieAnimFrameIndex,
  isZombieCrawler,
  zombieRenderHeight,
  zombieBaseSpeed,
  ZOMBIE_WALK_FRAMES,
  ZOMBIE_TILES_PER_WALK_FRAME,
  zombieDieFrameCount,
  zombieDieAnimMs,
  COYWOLF_DIE_ANIM_MS,
  COYWOLF_DIE_FRAMES,
  COYWOLF_RENDER_HEIGHT,
  COYWOLF_RUN_FRAMES,
  COYWOLF_TILES_PER_RUN_FRAME,
  COYWOLF_TILES_PER_WALK_FRAME,
  COYWOLF_WALK_FRAMES,
  BEAR_DIE_ANIM_MS,
  BEAR_DIE_FRAMES,
  BEAR_RENDER_HEIGHT,
  BEAR_RUN_FRAMES,
  BEAR_TILES_PER_RUN_FRAME,
  BEAR_TILES_PER_WALK_FRAME,
  BEAR_WALK_FRAMES,
  CROW_DIE_ANIM_MS,
  CROW_DIE_FRAMES,
  CROW_FLY_RENDER_HEIGHT,
  CROW_RENDER_HEIGHT,
  crowFlightLiftPx,
  crowIsOutOfMeleeReach,
  aimPointForScreenLift,
  hasEntityLineOfSight,
  worldCenter,
  GUARD_WEAPON_INDEX,
  GUARD_NPC_TRADER_MAN,
  GUARD_NPC_TRADER_GUARD,
  GUARD_NPC_RED_MAN,
  GUARD_NPC_HUMAN,
  TRADER_WEAPON_INDEX,
  redManWeaponIndex,
  ASHEN_REP_START,
  ASHEN_TRADERS_FACTION,
  ASHEN_MILITIA_FACTION,
  RED_ORDER_REP_START,
  RED_ORDER_FACTION,
  factionStanding,
  isMilitiaTalkSkin,
  isMilitiaDoctorSkin,
  isMilitiaNonCombatSkin,
  isGuardSitAnim,
  isTentInterior,
  militiaGuardDieFrames,
  militiaGuardDieAnimMs,
  playerAdjacentToSearchable,
  furnitureIsSearchable,
  furnitureIsStairs,
  furnitureIsCraftStation,
  furnitureIsFurnace,
  searchableOccupiesTile,
  OVERWORLD_BAG_BUILDING,
  isGroundBackpackType,
  CRAFT_DURATION_MS,
  getCraftRecipe,
  getDisassemblyRecipe,
  TILE_HEIGHT,
  FURNITURE_RENDER_HEIGHT_PX,
  settlementsInTileRegion,
  directionFromScreenInput,
  directionFromWorldDelta,
  getStructureBuildCosts,
  playerStructureId,
  parseStructureDepositsJson,
  parseStructureFenceFacing,
  parseStructureFenceCorner,
  structureDepositsMeetCost,
  remainingDepositCapacity,
  PREFAB_BUILD_DURATION_MS,
  STRUCTURE_DECONSTRUCT_DURATION_MS,
  syncBuildingPlacementBlockedTiles,
  setBuildingPlacementBlockedTile,
  structureFenceFootprint,
  structureFenceTiles,
  structureOccupiedTiles,
  nextStructureFenceFacing,
  isStructurePanelKind,
  BUILD_DENIAL_MESSAGES,
  interiorBuildDenial,
  overworldBuildDenial,
  type BuildDenialReason,
  BIRCHPORT_BARRACKS_CORNERS,
  BIRCHPORT_BARRACKS_PANELS,
  BIRCHPORT_BARRACKS_BARGATE,
  birchportBarracksBargateOccupiesTile,
  birchportBarracksBargateOutsideStand,
  birchportBarracksBargateInsideStand,
  birchportBarracksBargateCrossStand,
  isInBirchportBarracksYard,
  canEnterBirchportBarracks,
  BARRACKS_BARGATE_ACTIVE_FRAMES,
  BARRACKS_BARGATE_FRAME_MS,
  BARRACKS_BARGATE_HOLD_MS,
  BARRACKS_BARGATE_OPEN_MS,
  WORLD_CHAINLINK_OWNER,
  getWorldChainlinkCornerAt,
  getWorldChainlinkPanelOrigin,
  worldChainlinkOccupiesTile,
  fireplaceIsActive,
  temperatureHudLook,
  buildingInteriorIsPowered,
  isStorageBoxKind,
  TEMPERATURE_CORE_DEFAULT,
  countStandingTreesNear,
  phaseOfDay,
  isNightPhase,
  type ChatBroadcast,
  type ClientMessage,
  type InteriorWallTile,
  type RaycastTarget,
  type StructureBuildKind,
  type StructureFenceCorner,
  type StructureFenceFacing,
  type WorldBounds,
  type WorldSfxPayload,
  type WorldSfxStopKind,
  dayNightLook,
  parseSky,
  parsePrecip,
  parseQuestsJson,
  listActiveQuestMapMarkers,
  listNewlyCompletedQuestStages,
  stepBirchportMapChart,
  type QuestMapMarker,
} from "@zombie/shared";
import {
  drawProceduralWorld,
  interiorCorpseRenderDepth,
  interiorEntityRenderDepth,
  interiorFurnitureDepthBias,
  LOCAL_PLAYER_DEPTH_BIAS,
  overworldCorpseRenderDepth,
  overworldEntityRenderDepth,
  applyOverworldStructureEntityDepth,
  chainLinkFenceCornerDepthFootprint,
  chainLinkFenceCornerSortDepth,
  chainLinkFenceDepthFootprint,
  chainLinkFenceSortDepth,
  overworldPartitionDepth,
  setOverworldStructureFootprintProvider,
  strokeIsoFootprintOutline,
  strokeIsoTileOutline,
  tileIndicatorDepth,
  RENDER_RADIUS,
  type FurnitureDepthFootprint,
  type WorldTileManager,
} from "../world/IsoTiles";
import {
  DayNightLighting,
  type NightLight,
} from "../world/DayNightLighting";
import { WeatherFx } from "../world/WeatherFx";
import { ChimneySmoke } from "../world/ChimneySmoke";
import {
  BuildingOcclusionMask,
  OCCLUSION_OVERLAY_DEPTH,
  setPlayerWallOcclusionProvider,
} from "../world/BuildingOcclusion";
import { resetBuildingTextureCache } from "../world/buildingTextureCache";
import {
  exposeVramDebugHook,
  resetRenderStats,
  setCuboidStatsProvider,
  startVramTelemetry,
  stopVramTelemetry,
} from "../diagnostics/textureBudget";
import {
  addImageForKey,
  addSpriteForKey,
  applyTextureKey,
  spriteShowsKey,
  textureKeyExists,
} from "../sprites/atlasRegistry";
import {
  InteriorView,
  createPlywoodPartition,
  destroyPartitionDisplay,
  drawInteriorPartitionTile,
  drawInteriorDoorTile,
  drawWallTile,
  PLAYER_WALL_OCCLUSION_REACH,
  type InteriorDoorTile,
  type PlayerWallOccluder,
  type InteriorFenceCornerTile,
  type InteriorFenceTile,
  type InteriorFireplaceTile,
} from "../world/InteriorView";
import { DoorCodeUI } from "../ui/DoorCodeUI";
import {
  loadCachedAuthSession,
  type BulletImpactEvent,
  type ShotTraceEvent,
  type ServerEvent,
  type PlayerCorpseSchema,
  type PlayerSchema,
  type SearchableSchema,
  type GuardSchema,
  type SpawnEntityManifest,
  type WorldRoom,
  type ZombieSchema,
} from "../network/ColyseusClient";
import { Client, getStateCallbacks } from "colyseus.js";
import {
  applyIdleFrame,
  entityFeetY,
  ZOMBIE_CRAWL_TILE_DROP_PX,
  COYWOLF_TILE_DROP_PX,
  BEAR_TILE_DROP_PX,
  guardIdleAKKey,
  playerManIdleKey,
  resetTreeFallFrameRequests,
  updateEntityVisual,
  zombieIdleKey,
  coywolfIdleKey,
  bearIdleKey,
  crowIdleKey,
} from "../sprites/EntitySprites";
import { DamageOverlay } from "../ui/DamageOverlay";
import { InventoryUI } from "../ui/InventoryUI";
import { JournalUI } from "../ui/JournalUI";
import { ContainerLootUI } from "../ui/ContainerLootUI";
import { CraftUI } from "../ui/CraftUI";
import { FireplaceUI, type FireplaceUIState } from "../ui/FireplaceUI";
import { PrefabDepositUI } from "../ui/PrefabDepositUI";
import { DeconstructUI } from "../ui/DeconstructUI";
import {
  chainLinkFenceCornerTextureKey,
  layoutChainLinkFenceCornerImage,
  layoutChainLinkFenceImage,
  structurePanelTextureKey,
  bargateTextureKey,
  bargateActiveTextureKey,
} from "../sprites/FenceAssets";
import { TraderUI } from "../ui/TraderUI";
import { PlayerMarketUI } from "../ui/PlayerMarketUI";
import { RedOrderDialogUI } from "../ui/RedOrderDialogUI";
import { AshenTraderDialogUI } from "../ui/AshenTraderDialogUI";
import { AshenMilitiaDialogUI } from "../ui/AshenMilitiaDialogUI";
import { WeaponHotbar } from "../ui/WeaponHotbar";
import { LootPopup } from "../ui/LootPopup";
import { FactionAttackWarningUI } from "../ui/FactionAttackWarningUI";
import { DeathScreenUI } from "../ui/DeathScreenUI";
import {
  AudioManager,
  resolveGunshotVariant,
  ZOMBIE_GROAN_COUNT,
  ZOMBIE_GROAN_HEAR_RADIUS,
  type FireplaceAudioSource,
  type GunshotSource,
} from "../audio/AudioManager";
import { OnboardingUI, type FirstSweepState } from "../ui/OnboardingUI";
import { EntityActionLabelManager } from "../ui/EntityActionLabel";
import {
  MapOverlayUI,
  type MapOverlayMarker,
  type RadioPingMarker,
} from "../ui/MapOverlayUI";
import { getItemIconPath } from "../ui/itemIcons";
import { playerAvatarSrc } from "../ui/playerAvatar";
import type {
  OnboardingStepId,
  PlayerQuestsState,
  TutorialCompleteStepMessage,
  TutorialEventMessage,
  TutorialTipId,
} from "@zombie/shared";
import { PlayerOcclusionHighlight } from "../sprites/PlayerOcclusionHighlight";
import { PlayerOccludedGhost } from "../sprites/PlayerOccludedGhost";
import {
  nearestManhattanTile,
  pickTopOpaqueImageAtWorld,
  spriteOpaqueAtWorldPoint,
} from "../sprites/spritePixelHit";
import {
  animatedFurnitureDef,
  configureInteriorAnimations,
  ensureFurnitureAssets,
  isFurniturePackReady,
  resetFurnitureAssets,
  FIREPLACE1_ACTIVE_ANIM,
  FIREPLACE1_INACTIVE_KEY,
  STORAGE_BOX_RENDER_SCALE,
  storageBoxGroundOffset,
  storageBoxTextureKey,
} from "../sprites/InteriorAssets";
import {
  ensurePlayerClothingPack,
  markBootEntityPacksReady,
  preloadNearbyEntityPacks,
  resetEntityAssetLoader,
  resolveLoadedGuardSkin,
  resolveLoadedPlayerSkin,
  resolveLoadedRedManSkin,
  resolveLoadedZombieSkin,
  syncEntityAssetPacks,
  traderGuardPackReady,
  traderManPackReady,
  coywolfPackReady,
  bearPackReady,
  crowPackReady,
} from "../sprites/EntityAssetLoader";
import {
  hideWorldEntering,
  setWorldEnteringStatus,
  showWorldEntering,
} from "../ui/bootLoading";
import {
  CAMERA_ZOOM_MAX,
  CAMERA_ZOOM_WHEEL,
  getCameraZoomMin,
  getDefaultCameraZoom,
  IS_MOBILE,
  EXTERIOR_PURGE_IDLE_MS,
  EXTERIOR_PURGE_BUILDINGS_PER_FRAME,
} from "../gameConfig";
import { isMobileDevice } from "../device";

type EntitySprite = Phaser.GameObjects.Sprite & {
  entityId: string;
};

type ZombieServerSnapshot = {
  x: number;
  y: number;
  facing: number;
  anim: string;
  animFrame: number;
  health: number;
  skin?: number;
  isDead?: boolean;
  looted?: boolean;
  inInterior?: boolean;
  buildingX?: number;
  buildingY?: number;
  investigating?: boolean;
  investigateX?: number;
  investigateY?: number;
  targetX?: number;
  targetY?: number;
};

/** Stable 32-bit hash so every client picks the same groan cycle / take. */
function fnv1a(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Pull render position toward server each frame (~60fps). */
const ZOMBIE_RENDER_LERP = 0.35;
/** Cap frame delta so hitch frames don't fast-forward walk/die animations. */
const MAX_FRAME_DELTA_MS = TICK_MS;
/** Tiles around an entity searched for placed walls when resolving depth. */
const OVERWORLD_STRUCTURE_DEPTH_REACH = 3;
type BloodConfig = {
  count: number;
  speed: { min: number; max: number };
  angle: { min: number; max: number };
  scale: { start: number; end: number };
  lifespan: { min: number; max: number };
  gravityY: number;
  originY: number;
  destroyAfter: number;
  alpha?: { start: number; end: number };
  tint?: number[];
};

/**
 * Blood particle config keyed by WEAPONS array index.
 *   -1  = default / zombie bite (no weapon)
 *    0  = Pistol
 *    1  = Shotgun
 *    2  = Hunting Rifle
 *    3  = Revolver
 *    4  = AK
 *    5  = Hammer
 *    6  = Bat
 *    7  = Hatchet
 *    8  = M4
 */
const BLOOD_BY_WEAPON: Record<number, BloodConfig> = {
  [-1]: { // default / no weapon
    count: 6, speed: { min: 15, max: 55 }, angle: { min: 0, max: 360 },
    scale: { start: 0.45, end: 0.05 }, lifespan: { min: 180, max: 360 },
    gravityY: 520, originY: 40, destroyAfter: 450,
  },
  [0]: { // Pistol — same as default
    count: 6, speed: { min: 15, max: 55 }, angle: { min: 0, max: 360 },
    scale: { start: 0.45, end: 0.05 }, lifespan: { min: 180, max: 360 },
    gravityY: 520, originY: 40, destroyAfter: 450,
  },
  [1]: { // Shotgun — big messy burst, wide spread
    count: 22, speed: { min: 35, max: 130 }, angle: { min: 0, max: 360 },
    scale: { start: 0.75, end: 0.08 }, lifespan: { min: 280, max: 520 },
    gravityY: 380, originY: 50, destroyAfter: 650,
  },
  [2]: { // Hunting Rifle — explosive fast streak, long travel, very visible
    count: 18, speed: { min: 120, max: 280 }, angle: { min: 145, max: 215 },
    scale: { start: 0.65, end: 0.02 }, lifespan: { min: 200, max: 420 },
    gravityY: 140, originY: 35, destroyAfter: 500,
  },
  [3]: { // Revolver — slightly bigger than pistol
    count: 9, speed: { min: 20, max: 72 }, angle: { min: 0, max: 360 },
    scale: { start: 0.55, end: 0.06 }, lifespan: { min: 200, max: 400 },
    gravityY: 480, originY: 42, destroyAfter: 500,
  },
  [4]: { // AK — like rifle but wider cone, a bit more volume
    count: 12, speed: { min: 70, max: 160 }, angle: { min: 140, max: 220 },
    scale: { start: 0.40, end: 0.03 }, lifespan: { min: 160, max: 310 },
    gravityY: 260, originY: 38, destroyAfter: 420,
  },
  [8]: { // M4 — similar to AK, slightly tighter
    count: 11, speed: { min: 75, max: 155 }, angle: { min: 145, max: 215 },
    scale: { start: 0.38, end: 0.03 }, lifespan: { min: 150, max: 300 },
    gravityY: 250, originY: 38, destroyAfter: 400,
  },
  [5]: { // Hammer — impact splash (between fine spray and chunky burst)
    count: 22, speed: { min: 28, max: 115 }, angle: { min: 0, max: 360 },
    scale: { start: 0.5, end: 0.07 }, lifespan: { min: 280, max: 520 },
    gravityY: 430, originY: 44, destroyAfter: 620,
    alpha: { start: 1, end: 0 },
    tint: [0xff2a2a, 0xee1515, 0xcc1010, 0xaa0808],
  },
  [6]: { // Bat — wide messy splash
    count: 28, speed: { min: 36, max: 145 }, angle: { min: 0, max: 360 },
    scale: { start: 0.52, end: 0.07 }, lifespan: { min: 300, max: 560 },
    gravityY: 400, originY: 46, destroyAfter: 660,
    alpha: { start: 1, end: 0 },
    tint: [0xff2a2a, 0xee1515, 0xcc1010, 0xaa0808],
  },
  [7]: { // Hatchet — same family as Hammer, slightly sharper
    count: 24, speed: { min: 32, max: 130 }, angle: { min: 0, max: 360 },
    scale: { start: 0.5, end: 0.07 }, lifespan: { min: 280, max: 540 },
    gravityY: 410, originY: 44, destroyAfter: 640,
    alpha: { start: 1, end: 0 },
    tint: [0xff2a2a, 0xee1515, 0xcc1010, 0xaa0808],
  },
};

type MissDustConfig = {
  burstCount: number;
  mistCount: number;
  speed: { min: number; max: number };
  /** Half-width of burst cone (degrees) around bullet direction. */
  coneHalfWidth: number;
  scale: { start: number; end: number };
  lifespan: { min: number; max: number };
  burstGravityY: number;
  mistGravityY: number;
  mistSpeedScale: number;
  /** When true the air-mist layer uses a wide upward fan instead of bullet cone. */
  mistUpwardFan: boolean;
  flashScale: number;
  destroyAfter: number;
};

/**
 * Miss-impact dust keyed by WEAPONS index — mirrors BLOOD_BY_WEAPON tuning.
 *   -1  = default    0 = Pistol   1 = Shotgun   2 = Hunting Rifle
 *    3  = Revolver   4 = AK
 */
const MISS_DUST_BY_WEAPON: Record<number, MissDustConfig> = {
  [-1]: {
    burstCount: 6, mistCount: 4,
    speed: { min: 15, max: 55 }, coneHalfWidth: 80,
    scale: { start: 0.45, end: 0.06 },
    lifespan: { min: 180, max: 360 },
    burstGravityY: 62, mistGravityY: -18, mistSpeedScale: 0.5,
    mistUpwardFan: true, flashScale: 0.24, destroyAfter: 450,
  },
  [0]: {
    burstCount: 6, mistCount: 4,
    speed: { min: 15, max: 55 }, coneHalfWidth: 80,
    scale: { start: 0.45, end: 0.06 },
    lifespan: { min: 180, max: 360 },
    burstGravityY: 62, mistGravityY: -18, mistSpeedScale: 0.5,
    mistUpwardFan: true, flashScale: 0.24, destroyAfter: 450,
  },
  [1]: { // Shotgun — big messy dirt cloud
    burstCount: 22, mistCount: 18,
    speed: { min: 35, max: 130 }, coneHalfWidth: 90,
    scale: { start: 0.75, end: 0.1 },
    lifespan: { min: 280, max: 520 },
    burstGravityY: 46, mistGravityY: -30, mistSpeedScale: 0.55,
    mistUpwardFan: true, flashScale: 0.4, destroyAfter: 650,
  },
  [2]: { // Hunting Rifle — fast, long, narrow streak
    burstCount: 18, mistCount: 10,
    speed: { min: 120, max: 280 }, coneHalfWidth: 35,
    scale: { start: 0.65, end: 0.04 },
    lifespan: { min: 200, max: 420 },
    burstGravityY: 17, mistGravityY: -8, mistSpeedScale: 0.42,
    mistUpwardFan: false, flashScale: 0.3, destroyAfter: 500,
  },
  [3]: { // Revolver — slightly heavier than pistol
    burstCount: 9, mistCount: 5,
    speed: { min: 20, max: 72 }, coneHalfWidth: 75,
    scale: { start: 0.55, end: 0.07 },
    lifespan: { min: 200, max: 400 },
    burstGravityY: 58, mistGravityY: -20, mistSpeedScale: 0.48,
    mistUpwardFan: true, flashScale: 0.27, destroyAfter: 500,
  },
  [4]: { // AK — rifle-like cone, more volume
    burstCount: 12, mistCount: 8,
    speed: { min: 70, max: 160 }, coneHalfWidth: 40,
    scale: { start: 0.4, end: 0.05 },
    lifespan: { min: 160, max: 310 },
    burstGravityY: 31, mistGravityY: -12, mistSpeedScale: 0.45,
    mistUpwardFan: false, flashScale: 0.28, destroyAfter: 420,
  },
  [8]: { // M4 — similar to AK
    burstCount: 11, mistCount: 7,
    speed: { min: 75, max: 155 }, coneHalfWidth: 38,
    scale: { start: 0.38, end: 0.05 },
    lifespan: { min: 150, max: 300 },
    burstGravityY: 30, mistGravityY: -12, mistSpeedScale: 0.45,
    mistUpwardFan: false, flashScale: 0.27, destroyAfter: 400,
  },
};

type CombatEntityKind = "player" | "zombie" | "guard" | "coywolf" | "bear" | "crow" | "crow";

/** Un-built prefab tile — mirrors a server StructureRecord with status "prefab". */
type StorageBoxTile = {
  x: number;
  y: number;
  ownerWallet: string;
  kind: "storage_box" | "storage_box_2";
};

type PrefabTile = {
  x: number;
  y: number;
  kind: StructureBuildKind;
  facing?: StructureFenceFacing | StructureFenceCorner;
};

export class WorldScene extends Phaser.Scene {
  private room?: WorldRoom;
  private sessionId = "";
  /**
   * False until nearby NPC packs are preloaded and the join overlay is dismissed.
   * Keeps the local player (and other entities) from spawning under a hidden canvas.
   */
  private worldRevealReady = false;
  /**
   * Bumped on every WorldScene boot / teardown so a stale async create() from a
   * dropped connection cannot finish after the player re-enters (blank canvas,
   * missing tiles/sprites, overlay dismissed early).
   */
  private worldJoinGeneration = 0;
  /** Targets that recently took gunfire — skip default bite blood on health sync. */
  private recentGunHits = new Set<string>();
  private playerSprites = new Map<string, EntitySprite>();
  private corpseSprites = new Map<string, EntitySprite>();
  private zombieSprites = new Map<string, EntitySprite>();
  private coywolfSprites = new Map<string, EntitySprite>();
  private bearSprites = new Map<string, EntitySprite>();
  private crowSprites = new Map<string, EntitySprite>();
  private guardSprites = new Map<string, EntitySprite>();
  /** Local /godmode — sprite AABB + id overlay. */
  private godModeDebug = false;
  /** Local /build — place temporary interior partition walls. */
  private buildMode = false;
  /** Admin-placed walls keyed by buildingKey (in-memory mirror of server). */
  private tempInteriorWallsByBuilding = new Map<string, InteriorWallTile[]>();
  /** Admin-placed overworld walls (`"tx,ty"`). */
  private tempOverworldWallKeys = new Set<string>();
  private overworldTempWallSprites = new Map<
    string,
    Phaser.GameObjects.Graphics | Phaser.GameObjects.Image
  >();
  private overworldBuildGhost?: Phaser.GameObjects.Graphics;
  private overworldBuildGhostWall?: Phaser.GameObjects.Image;
  private overworldBuildGhostWallSig = "";
  private overworldBuildGhostFireplace?: Phaser.GameObjects.Sprite;
  private overworldBuildGhostStorageBox?: Phaser.GameObjects.Sprite;
  private overworldBuildGhostFence?: Phaser.GameObjects.Image;
  private overworldBuildHighlight?: Phaser.GameObjects.Graphics;
  /** Lite base-building — local "place structure" mode + selected kind. */
  private structureBuildMode = false;
  /** One close request is in flight after the hammer left the hand. */
  private structureBuildCloseSent = false;
  private structureBuildKind: StructureBuildKind | "deconstruct" = "wall";
  private structureFenceFacing: StructureFenceFacing = "SE";
  private structureFenceRotateWasDown = false;
  private bKey?: Phaser.Input.Keyboard.Key;
  private bKeyWasDown = false;
  private structureBuildHudEl?: HTMLElement;
  private structureBuildWallBtn?: HTMLButtonElement;
  private structureBuildDoorBtn?: HTMLButtonElement;
  private structureBuildFireplaceBtn?: HTMLButtonElement;
  private structureBuildFenceBtn?: HTMLButtonElement;
  private structureBuildBargateBtn?: HTMLButtonElement;
  private structureBuildStorageBoxBtn?: HTMLButtonElement;
  private structureBuildStorageBox2Btn?: HTMLButtonElement;
  private structureBuildDeconstructBtn?: HTMLButtonElement;
  /** Persistent player-built walls/doors/fireplaces, mirrors server in-memory maps. */
  private structureWallsByBuilding = new Map<
    string,
    { x: number; y: number; ownerWallet: string }[]
  >();
  private structureDoorsByBuilding = new Map<string, InteriorDoorTile[]>();
  private structureFireplacesByBuilding = new Map<string, InteriorFireplaceTile[]>();
  private structureStorageBoxesByBuilding = new Map<string, StorageBoxTile[]>();
  private structureFencesByBuilding = new Map<string, InteriorFenceTile[]>();
  private structureFenceCornersByBuilding = new Map<
    string,
    InteriorFenceCornerTile[]
  >();
  private structureWallKeysOverworld = new Set<string>();
  /** Overworld solid wall tile key → owner wallet (for deconstruct gating). */
  private structureWallOwnersOverworld = new Map<string, string>();
  private structureDoorsOverworld = new Map<string, InteriorDoorTile>();
  private structureFireplacesOverworld = new Map<string, InteriorFireplaceTile>();
  private structureStorageBoxesOverworld = new Map<string, StorageBoxTile>();
  private structureFencesOverworld = new Map<string, InteriorFenceTile>();
  /** Any occupied fence tile → origin key. */
  private structureFenceOccupancyOverworld = new Map<string, string>();
  private structureFenceCornersOverworld = new Map<
    string,
    InteriorFenceCornerTile
  >();
  private overworldStructureSprites = new Map<
    string,
    Phaser.GameObjects.Graphics | Phaser.GameObjects.Image
  >();
  private overworldPrefabWalls = new Map<string, Phaser.GameObjects.Image>();
  private overworldPrefabWallSig = new Map<string, string>();
  private overworldFireplaceSprites = new Map<string, Phaser.GameObjects.Sprite>();
  private overworldStorageBoxSprites = new Map<string, Phaser.GameObjects.Sprite>();
  private overworldFireplaceExpireEvents = new Map<string, Phaser.Time.TimerEvent>();
  private overworldFenceSprites = new Map<string, Phaser.GameObjects.Image>();
  private overworldFenceCornerSprites = new Map<string, Phaser.GameObjects.Image>();
  /** Un-built prefab ghosts, mirrors server structuresById status:"prefab" entries. */
  private prefabsByBuilding = new Map<string, PrefabTile[]>();
  private prefabsOverworld = new Map<string, PrefabTile>();
  private overworldPrefabGraphics = new Map<string, Phaser.GameObjects.Graphics>();
  private overworldPrefabFireplaces = new Map<string, Phaser.GameObjects.Sprite>();
  private overworldPrefabStorageBoxes = new Map<string, Phaser.GameObjects.Sprite>();
  private overworldPrefabFences = new Map<string, Phaser.GameObjects.Image>();
  private prefabDepositUI?: PrefabDepositUI;
  private deconstructUI?: DeconstructUI;
  /** Prefab tile the player clicked while out of reach — walk up, then open UI. */
  private prefabTargetTile: { x: number; y: number } | null = null;
  private prefabSprint = false;
  private lastPrefabClickKey: string | null = null;
  private lastPrefabClickAt = 0;
  private doorCodeUI?: DoorCodeUI;
  private pendingDoorCodeTile: { x: number; y: number } | null = null;
  /** Door tile the player clicked while out of reach — walk up, then auto-interact. */
  private doorTargetTile: { x: number; y: number } | null = null;
  private doorSprint = false;
  private lastDoorClickKey: string | null = null;
  private lastDoorClickAt = 0;
  private forestAmbienceTileKey = "";
  private forestAmbienceInForest = false;
  /** Last synced groan cycle per zombie id (from worldTimeMs, not wall clock). */
  private zombieGroanNextAt = new Map<string, number>();
  /** Barracks bargate clicked while out of reach — walk up, then enter. */
  private bargateTargetTile: { x: number; y: number } | null = null;
  private bargateSprint = false;
  private lastBargateClickKey: string | null = null;
  private lastBargateClickAt = 0;
  private lastBargateEnterAt = 0;
  private barracksBargateAnimUntil = 0;
  private barracksBargateAnimEvents: Phaser.Time.TimerEvent[] = [];
  /** Fireplace tile the player clicked while out of reach — walk up, then open UI. */
  private fireplaceTargetTile: { x: number; y: number } | null = null;
  private fireplaceSprint = false;
  private lastFireplaceClickKey: string | null = null;
  private lastFireplaceClickAt = 0;
  /** Storage box the player clicked while out of reach. Walk up, then open it. */
  private storageBoxTargetTile: { x: number; y: number } | null = null;
  private storageBoxSprint = false;
  private lastStorageBoxClickKey: string | null = null;
  private lastStorageBoxClickAt = 0;
  /** Standing tree the player clicked with a hatchet — walk up, then chop. */
  private treeChopTargetTile: { x: number; y: number } | null = null;
  /** Locked neighbour tile to stand on (set once when the chase starts). */
  private treeChopApproachTile: { x: number; y: number } | null = null;
  private treeChopSprint = false;
  private lastTreeChopClickKey: string | null = null;
  private lastTreeChopClickAt = 0;
  /** Last time we sent chopTree while pursuing — retry if the server ignored us. */
  private treeChopStartSentAt = 0;
  /** Set right before sending placeStructure for a door — used to offer a lock prompt on success. */
  private pendingOwnDoorPlacement: { x: number; y: number } | null = null;
  private fireplaceUI?: FireplaceUI;
  private entityBoundsGfx?: Phaser.GameObjects.Graphics;
  private entityBoundsLabels = new Map<string, Phaser.GameObjects.Text>();
  private statusEl?: HTMLElement;
  private healthFillEl?: HTMLElement;
  private healthCapEl?: HTMLElement;
  private healthLostEl?: HTMLElement;
  private staminaFillEl?: HTMLElement;
  private hungerFillEl?: HTMLElement;
  private thirstFillEl?: HTMLElement;
  private tempFillEl?: HTMLElement;
  private playerAvatarImgEl?: HTMLImageElement;
  private lastHudAvatarSkin = -1;
  private lastInfectionLogAt = 0;
  private hungerTrackEl?: HTMLElement;
  private thirstTrackEl?: HTMLElement;
  private tempTrackEl?: HTMLElement;
  private hungerLabelEl?: HTMLElement;
  private thirstLabelEl?: HTMLElement;
  private tempLabelEl?: HTMLElement;
  private temperatureFxEl?: HTMLElement;
  private infectionFxEl?: HTMLElement;
  private worldClockEl?: HTMLElement;
  private worldClockTimeEl?: HTMLElement;
  private consumeActionLabel = "Eating";
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private shiftKey?: Phaser.Input.Keyboard.Key;
  private ctrlKey?: Phaser.Input.Keyboard.Key;
  /** Local CTRL aim — firearm raised to Fire frame 1. */
  private aimHeld = false;
  /** Mobile has no CTRL key — the HUD aim button latches the same state. */
  private mobileAimLatched = false;
  /** 8-way facing from mouse while CTRL-aiming. Null when not aiming. */
  private localAimFacing: number | null = null;
  private lastSentAimLookFacing = -1;
  /** Brief gunshot traces, oldest first. */
  private shotTraceFx: { g: Phaser.GameObjects.Graphics; tween: Phaser.Tweens.Tween }[] =
    [];
  private static readonly SHOT_TRACE_MAX = 24;
  private keys!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
    E: Phaser.Input.Keyboard.Key;
    R: Phaser.Input.Keyboard.Key;
  };
  /** True while WASD/arrows are driving movement (release → stop). */
  private keyboardMoveActive = false;
  /**
   * Set when the player uses stairs. Held movement must not continue into the
   * street door on the new floor. Clears once every move key is released.
   */
  private pauseMoveAfterStairs = false;
  /**
   * Floor the client just changed to, until the server schema catches up.
   * Without this, WASD still aims at the upstairs exit strip and the server
   * (already downstairs) walks them out.
   */
  private interiorLevelLatch: number | null = null;
  private lastKeyboardMoveSentAt = 0;
  private lastKeyboardMoveTargetKey = "";
  /** Last locked 8-way facing while keyboard-moving (-1 = none). */
  private lastKeyboardFacing = -1;
  private lastKeyboardGoalTX = 0;
  private lastKeyboardGoalTY = 0;
  /** Last sprint flag sent with keyboard moveTo. */
  private lastKeyboardSprint = false;
  private static readonly KEYBOARD_MOVE_RESEND_MS = 100;
  /**
   * Render-interpolation smoothing for all players, local included. The local
   * player deliberately does NOT get client-side forward prediction of new,
   * unconfirmed movement: it only ever smooths/extrapolates motion the server
   * has already confirmed (same formula as getZombieRenderPosition). This
   * makes an "illegal slide" impossible by construction — the rendered
   * position can never lead further than the server's own reported velocity.
   */
  private static readonly PLAYER_RENDER_LERP = 0.35;
  /** Jumps bigger than this are treated as teleports rather than smoothed movement. */
  private static readonly PLAYER_TELEPORT_DIST = 2.5;
  private cameraDrag = false;
  private dragStart = { x: 0, y: 0 };
  private cameraStart = { x: 0, y: 0 };
  private cameraZoom = getDefaultCameraZoom();
  /**
   * Wheel or pinch changed the camera. The tile fill runs once from update
   * so a notch cannot paint twice or restart the scan.
   */
  private cameraViewDirty = false;
  /** Two-finger pinch zoom (mobile). */
  private pinchActive = false;
  private pinchStartDistance = 0;
  private pinchStartZoom = getDefaultCameraZoom();
  /** Touch: defer tap-to-move until pointerup so pinches don't issue a move. */
  private pendingTouchTap: { id: number; x: number; y: number } | null = null;
  /** Ignore the next touch tap after a pinch ends. */
  private ignoreTouchTapUntil = 0;
  private static readonly TOUCH_TAP_SLOP_PX = 16;
  /** Last frame's overlay/chat blocking state — used to reset stolen touch pointers. */
  private wasBlockingUiOpen = false;
  private tileManager?: WorldTileManager;
  private interiorView?: InteriorView;
  private dayNightLighting?: DayNightLighting;
  private weatherFx?: WeatherFx;
  private chimneySmoke?: ChimneySmoke;
  private worldBounds: WorldBounds = { ...INITIAL_WORLD_BOUNDS };
  private lastBoundsKey = "";
  private lastInteriorKey = "";
  /** True while waiting for the lazy furniture pack so we rebuild sprites once. */
  private furnitureArtRebuildArmed = false;
  private searchablesCache: SearchableSchema[] = [];
  /** Overworld floor-bag sprites (interior bags render via InteriorView). */
  private groundBagSprites = new Map<string, Phaser.GameObjects.Image>();
  private searchKeyWasDown = false;
  private inventoryUI?: InventoryUI;
  private journalUI?: JournalUI;
  private mobileHudEl?: HTMLElement;
  private moveStickEl?: HTMLElement;
  private moveStickKnob?: HTMLElement;
  /** Pointer currently driving the thumb stick. Null when the stick is released. */
  private moveStickPointerId: number | null = null;
  /** Stick deflection, each axis in [-1, 1]. Positive Y is down (screen space). */
  private moveStickX = 0;
  private moveStickY = 0;
  /** True while the stick is pushed into the outer sprint ring. */
  private moveStickSprint = false;
  private static readonly MOVE_STICK_DEADZONE = 0.22;
  private static readonly MOVE_STICK_SPRINT = 0.88;
  private mobileInventoryBtn?: HTMLButtonElement;
  private mobileJournalBtn?: HTMLButtonElement;
  private mobileMapBtn?: HTMLButtonElement;
  private mobileAimBtn?: HTMLButtonElement;
  private mobileReloadBtn?: HTMLButtonElement;
  private mobileBuildBtn?: HTMLButtonElement;
  private mobileChatBtn?: HTMLButtonElement;
  /** Last ammo icon id shown on the mobile reload button (avoids DOM thrash). */
  private mobileReloadAmmoIconId = "";
  /** Last icon on the mobile aim button: crosshair, or the equipped melee item. */
  private mobileAimIconId = "";
  private containerLootUI?: ContainerLootUI;
  private craftUI?: CraftUI;
  private traderUI?: TraderUI;
  private playerMarketUI?: PlayerMarketUI;
  private redOrderDialogUI?: RedOrderDialogUI;
  private ashenTraderDialogUI?: AshenTraderDialogUI;
  private ashenMilitiaDialogUI?: AshenMilitiaDialogUI;
  private mapOverlayUI?: MapOverlayUI;
  /** Pings heard on the frequency tuned right now. Cleared when that frequency changes. */
  private radioPings = new Map<string, RadioPingMarker & { freq: number }>();
  private radioPingListenFreq = 0;
  private weaponHotbar?: WeaponHotbar;
  private damageOverlay?: DamageOverlay;
  private lootPopup?: LootPopup;
  private factionAttackWarningUI?: FactionAttackWarningUI;
  private deathScreenUI?: DeathScreenUI;
  private onboardingUI?: OnboardingUI;
  private tutorialVitals: { hunger: number; thirst: number } | null = null;
  private tutorialSawDeath = false;
  private lastTutorialWatchAt = 0;
  /** Last weather sample, so the rain tip fires when rain begins. */
  private tutorialPrecip: string | null = null;
  /**
   * Factions already warned this session — skip the attack popup next time.
   * Keys: "ashen" | "ashenMilitia" | "redOrder".
   */
  private factionAttackWarningsShown = new Set<
    "ashen" | "ashenMilitia" | "redOrder"
  >();
  private playerOcclusionHighlight?: PlayerOcclusionHighlight;
  /** Mobile replacement for the outline (no BitmapMask). */
  private playerOccludedGhost?: PlayerOccludedGhost;
  private entityActionLabels?: EntityActionLabelManager;
  private tabKey?: Phaser.Input.Keyboard.Key;
  private mKey?: Phaser.Input.Keyboard.Key;
  private jKey?: Phaser.Input.Keyboard.Key;
  private zeroKey?: Phaser.Input.Keyboard.Key;
  private hotbarKeys: Phaser.Input.Keyboard.Key[] = [];
  private tabWasDown = false;
  private mapKeyWasDown = false;
  private journalKeyWasDown = false;
  private zeroWasDown = false;
  private hotbarWasDown = [false, false];
  private lastInventoryRenderKey = "";
  /** Vitals half of the inventory refresh (detail panel only, no grid rebuild). */
  private lastInventoryVitalsKey = "";
  private lastHotbarRenderKey = "";
  /** Memo for {@link readLocalInventory} (read-only sharers). */
  private parsedLocalInventory: {
    json: string;
    inventory: ReturnType<typeof parseInventory>;
  } | null = null;
  /** Memo for {@link localSkillMods}, keyed on the skill json. */
  private cachedSkillMods: { json: string; mods: PlayerSkillMods } | null = null;
  /** Last values pushed to the HUD bars / labels (skip no-op DOM writes). */
  private lastHudBars = {
    healthPct: -1,
    capPct: -1,
    lostPct: -1,
    staminaPct: -1,
    hungerPct: -1,
    thirstPct: -1,
    tempPct: -1,
    tempColor: "",
    tempLabel: "",
    hungerCritical: null as boolean | null,
    thirstCritical: null as boolean | null,
    tempCritical: null as boolean | null,
    tempFx: "",
    infectionFx: "",
  };
  /** Last strings pushed to the world clock. */
  private lastWorldClock = {
    time: "",
    phase: "",
    clockHidden: null as boolean | null,
    timeHidden: null as boolean | null,
  };
  private lastQuestUiKey = "";
  /**
   * Quests and skills are owner-only: the server pushes them over questSync /
   * skillSync rather than broadcasting them on PlayerState, so these are the
   * only copies the client has.
   */
  private cachedQuestsJson = "";
  private localSkillsJson = "";
  /** Craft recipe ids unlocked by weapon blueprints. Owner-only. */
  private learnedRecipeIds = new Set<string>();
  /** Cached settlement labels for the open M map (recomputed when tile center moves). */
  private mapSettlementCache: {
    tx: number;
    ty: number;
    span: number;
    labels: ReturnType<typeof settlementsInTileRegion>;
  } | null = null;
  private mapQuestMarkerCache: {
    json: string;
    markers: QuestMapMarker[];
  } | null = null;
  /**
   * Authoritative inventory pushed by the server over the reliable channel.
   * Prefer this over Colyseus @view() string patches, which can desync.
   */
  private localInventorySync: {
    inventoryJson: string;
    weaponMagazinesJson: string;
    equippedInventorySlot: number;
    equippedWeaponIndex: number;
    equippedClothingSlot: number;
    clothingSkin: number;
    magazineRounds: number;
    idleWeapon: string;
    isReloading: boolean;
    isUnloading: boolean;
  } | null = null;
  /** Tile-click indicator graphic */
  private moveTarget?: Phaser.GameObjects.Graphics;
  private moveTargetOccluded?: Phaser.GameObjects.Graphics;
  private moveTargetOcclusionMask?: BuildingOcclusionMask;
  private moveTargetTile?: { wx: number; wy: number; sprint: boolean };
  private moveTargetFadeUntil = 0;
  /** ID of the searchable the cursor is currently hovering over */
  private hoveredSearchableId: string | null = null;
  /** Dead unlooted entity under the cursor (zombie, guard, or player corpse). */
  private hoveredLootableId: string | null = null;
  private hoveredLootableKind: "zombie" | "guard" | "player" | "coywolf" | "bear" | "crow" | null = null;
  private searchProgressEl?: HTMLElement;
  private searchProgressLabel?: HTMLElement;
  private searchProgressFill?: HTMLElement;
  private lastSearchProgressPct = -1;
  /**
   * Client-side timer for search/reload/consume UI.
   * Avoids using server absolute end timestamps (latency makes the bar jump).
   */
  private localTimedAction: {
    kind: "search" | "reload" | "unload" | "consume" | "craft" | "clothing" | "build";
    startedAt: number;
    durationMs: number;
    label: string;
    /** True from click until the server confirms the busy flag. */
    optimistic: boolean;
    /** After a successful finish, keep the bar at 100% until this time. */
    holdUntil?: number;
  } | null = null;
  private clothingActionLabel = "Wearing";
  /** Edge-triggered reload press. */
  private reloadKeyWasDown = false;
  private lastStatusText = "";
  /** Entity the cursor is hovering over (combat target or interactable NPC). */
  private hoveredEntityId: string | null = null;
  private hoveredEntityKind: CombatEntityKind | null = null;
  /** Active hover tint — combat red vs interact green. */
  private hoveredEntityTint: number | null = null;
  /** Entity the player is actively trying to attack (pursue + fire) */
  private combatTargetId: string | null = null;
  private combatTargetKind: CombatEntityKind | null = null;
  private combatSprint = false;
  /** Unarmed click on TraderMan — keep pathing to their live position. */
  private interactTargetId: string | null = null;
  private interactTargetKind: CombatEntityKind | null = null;
  /** What to open once adjacent: trade vs Red Order talk. */
  private interactAction: "trade" | "dialog" | null = null;
  private interactSprint = false;
  /** Double-click lootable — approach then auto-start search (no E required). */
  private lootTargetId: string | null = null;
  private lootTargetKind: "searchable" | "zombie" | "guard" | "player" | "coywolf" | "bear" | "crow" | "crow" | null = null;
  private lootSprint = false;
  private lastPursuitMoveSentAt = 0;
  /** Double-click sprint detection (time-only — tiles shift under cursor while moving). */
  private lastClickTime = 0;
  /** Last entity id clicked for combat (for double-click pursue detection). */
  private lastCombatClickId: string | null = null;
  private lastCombatClickAt = 0;
  /** Last lootable id clicked (furniture / corpse) for double-click search. */
  private lastLootClickId: string | null = null;
  private lastLootClickAt = 0;
  /** Tracks fire animation and fighting stance per entity. */
  private fireAnims = new Map<
    string,
    {
      startMs: number;
      weaponIndex: number;
      /** Melee / NPC may still use short; player ranged is always full. */
      mode: "full" | "short";
      stanceUntilMs: number;
      /** PlayerMan (5-frame Fire + stance frame 1) vs NPC MilitiaGuard/RedMan (8-frame). */
      style: "player" | "npc";
    }
  >();
  /**
   * Local clock (seconds) of the last fire we sent — bridges the gap between
   * Fire* ending (~300ms) and server fireRate cooldown (e.g. hunting rifle 1s).
   */
  private localLastFireTimeSec = 0;
  /** Entity id → die anim start ms, or -1 when frozen on the last frame. */
  private dieAnims = new Map<string, number>();
  /**
   * MilitiaDoctor1 ambient Idle ↔ Idle2. Random 1–3 minute intervals; not used once dead.
   */
  private doctorIdleVariants = new Map<
    string,
    { variant: "idle" | "idle2"; nextSwitchAt: number }
  >();
  /** Zombie ids with pending Colyseus data — flushed once per render frame. */
  private pendingZombieRefreshIds = new Set<string>();
  private static readonly FIGHTING_STANCE_MS = FIGHTING_STANCE_MS;
  private static readonly DOUBLE_CLICK_MS = 300;
  /** Chebyshev tiles: enough woodland to feel like a forest, cheap 4×4 tree scan. */
  private static readonly FOREST_AMBIENCE_RADIUS = 24;
  private static readonly FOREST_AMBIENCE_MIN_TREES = 10;
  /** Gap between groans from the same zombie (hashed onto worldTimeMs). */
  private static readonly ZOMBIE_GROAN_GAP_MIN_MS = 16_000;
  private static readonly ZOMBIE_GROAN_GAP_MAX_MS = 38_000;
  private static readonly DOCTOR_IDLE_SWITCH_MIN_MS = 60_000;
  private static readonly DOCTOR_IDLE_SWITCH_MAX_MS = 180_000;

  private fireAnimDuration(
    mode: "full" | "short",
    weaponIndex?: number,
    style: "player" | "npc" = "player",
  ) {
    const weapon = weaponIndex != null ? WEAPONS[weaponIndex] : undefined;
    if (style === "npc") {
      return weaponAttackAnimMs(weapon, mode);
    }
    return playerAttackAnimMs(weapon);
  }

  private isEntityInFightingStance(entityId: string) {
    const fire = this.fireAnims.get(entityId);
    const now = Date.now();
    if (fire) {
      if (fire.stanceUntilMs <= now) return false;
      return (
        now - fire.startMs >=
        this.fireAnimDuration(fire.mode, fire.weaponIndex, fire.style)
      );
    }
    // Server still holding aim after local fire pose was cleared (e.g. cancelled move).
    if (entityId === this.sessionId) {
      const me = this.room?.state?.players?.get(this.sessionId);
      return (me?.fightingStanceUntil ?? 0) > now;
    }
    return false;
  }

  private isEntityFiring(entityId: string) {
    const fire = this.fireAnims.get(entityId);
    if (!fire) return false;
    return (
      Date.now() - fire.startMs <
      this.fireAnimDuration(fire.mode, fire.weaponIndex, fire.style)
    );
  }

  private cancelEntityFireAnim(entityId: string) {
    this.fireAnims.delete(entityId);
  }

  private startEntityDieAnim(entityId: string) {
    this.dieAnims.set(entityId, Date.now());
    this.cancelEntityFireAnim(entityId);
  }

  private freezeEntityDieAnim(entityId: string) {
    this.dieAnims.set(entityId, -1);
  }

  private clearEntityDieAnim(entityId: string) {
    this.dieAnims.delete(entityId);
  }

  /** 0-based die frame; holds on last frame after the clip finishes. */
  private resolveDieFrame(
    entityId: string,
    isDead: boolean,
    frameCount = PLAYER_DIE_FRAMES,
    totalMs = PLAYER_DIE_ANIM_MS,
  ): number | undefined {
    const last = frameCount - 1;
    if (!isDead) {
      this.clearEntityDieAnim(entityId);
      return undefined;
    }
    let start = this.dieAnims.get(entityId);
    if (start === undefined) {
      // Already dead without a tracked clip (re-enter / AOI) — snap to last frame.
      this.freezeEntityDieAnim(entityId);
      return last;
    }
    if (start < 0) return last;
    return dieAnimFrameIndex(Date.now() - start, totalMs, frameCount);
  }

  /**
   * MilitiaDoctor1: in the lobby (server `idle`), swap Idle ↔ Idle2 on a random
   * 1–3 minute timer. Server `idle2` (bed clipboard check) stays Idle2.
   * Walk / die pass through unchanged.
   */
  private resolveDoctorIdleAnim(
    entityId: string,
    skin: number | undefined,
    anim: string,
  ): string {
    if (!isMilitiaDoctorSkin(skin)) return anim;
    if (anim === "idle2") {
      this.doctorIdleVariants.delete(entityId);
      return "idle2";
    }
    if (anim !== "idle") {
      this.doctorIdleVariants.delete(entityId);
      return anim;
    }
    const now = Date.now();
    let rec = this.doctorIdleVariants.get(entityId);
    if (!rec) {
      rec = {
        variant: Math.random() < 0.5 ? "idle2" : "idle",
        nextSwitchAt:
          now +
          WorldScene.DOCTOR_IDLE_SWITCH_MIN_MS +
          Math.random() *
            (WorldScene.DOCTOR_IDLE_SWITCH_MAX_MS -
              WorldScene.DOCTOR_IDLE_SWITCH_MIN_MS),
      };
      this.doctorIdleVariants.set(entityId, rec);
      return rec.variant;
    }
    if (now >= rec.nextSwitchAt) {
      rec.variant = rec.variant === "idle" ? "idle2" : "idle";
      rec.nextSwitchAt =
        now +
        WorldScene.DOCTOR_IDLE_SWITCH_MIN_MS +
        Math.random() *
          (WorldScene.DOCTOR_IDLE_SWITCH_MAX_MS -
            WorldScene.DOCTOR_IDLE_SWITCH_MIN_MS);
    }
    return rec.variant;
  }

  /** Local ears + camera so shots fall off with distance and zoom. */
  private syncGunshotListener() {
    const me = this.room?.state?.players?.get(this.sessionId);
    if (!me) return;
    AudioManager.get().setListener({
      x: me.x,
      y: me.y,
      zoom: this.cameraZoom,
      zoomMin: getCameraZoomMin(this.scale.width, this.scale.height),
      zoomMax: CAMERA_ZOOM_MAX,
      inInterior: me.inInterior,
      buildingX: me.buildingX,
      buildingY: me.buildingY,
    });
  }

  /** Play the gunshot take every client agreed on for this shot. */
  private playSyncedGunshot(
    weaponIndex: number,
    variant: number | undefined,
    source: {
      x: number;
      y: number;
      inInterior?: boolean;
      buildingX?: number;
      buildingY?: number;
    },
  ) {
    const weapon = WEAPONS[weaponIndex];
    if (!weapon || isMeleeWeapon(weapon)) return;
    this.syncGunshotListener();
    AudioManager.get().playGunshot(weapon.itemId, variant, {
      x: source.x,
      y: source.y,
      noiseRadius: weapon.noiseRadius,
      inInterior: source.inInterior,
      buildingX: source.buildingX,
      buildingY: source.buildingY,
    });
  }

  /** Loop crackle for every lit fireplace in earshot. */
  private syncFireplaceAudio() {
    const me = this.room?.state?.players?.get(this.sessionId);
    if (!me) {
      AudioManager.get().syncFireplaces([]);
      return;
    }
    const now = Date.now();
    const sources: FireplaceAudioSource[] = [];
    for (const tile of this.structureFireplacesOverworld.values()) {
      if (!fireplaceIsActive(tile.activeUntil, now)) continue;
      sources.push({
        id: `ow:${tile.x},${tile.y}`,
        x: tile.x + 0.5,
        y: tile.y + 0.5,
        inInterior: false,
      });
    }
    for (const [key, list] of this.structureFireplacesByBuilding) {
      const comma = key.indexOf(",");
      const buildingX = Number(key.slice(0, comma));
      const buildingY = Number(key.slice(comma + 1));
      for (const tile of list) {
        if (!fireplaceIsActive(tile.activeUntil, now)) continue;
        sources.push({
          id: `in:${key}:${tile.x},${tile.y}`,
          x: tile.x + 0.5,
          y: tile.y + 0.5,
          inInterior: true,
          buildingX,
          buildingY,
        });
      }
    }
    for (const s of this.searchablesCache) {
      if (!furnitureIsFurnace(s.objectType)) continue;
      if (!fireplaceIsActive(s.activeUntil, now)) continue;
      const { w, h } = searchableFootprint(s);
      sources.push({
        id: `fn:${s.id}`,
        x: s.x + w / 2,
        y: s.y + h / 2,
        inInterior: true,
        buildingX: s.buildingX,
        buildingY: s.buildingY,
      });
    }
    AudioManager.get().syncFireplaces(sources);
  }

  /** Quiet wind outdoors, sparse forest cues among trees (day vs night). */
  private syncOutdoorAmbience(dtMs: number) {
    const me = this.room?.state?.players?.get(this.sessionId);
    if (!me) {
      AudioManager.get().syncOutdoorAmbience({
        outside: false,
        inForest: false,
        night: false,
        raining: false,
        dtMs,
      });
      return;
    }
    const outside = !me.inInterior;
    const worldTimeMs = this.room?.state?.worldTimeMs ?? 0;
    AudioManager.get().syncOutdoorAmbience({
      outside,
      inForest: outside && this.playerInForest(me.x, me.y),
      night: isNightPhase(phaseOfDay(worldTimeMs)),
      raining: parsePrecip(this.room?.state?.weather) === "rain",
      dtMs,
    });
  }

  private playerInForest(x: number, y: number): boolean {
    const tx = Math.floor(x);
    const ty = Math.floor(y);
    const key = `${tx},${ty}`;
    if (key === this.forestAmbienceTileKey) return this.forestAmbienceInForest;
    this.forestAmbienceTileKey = key;
    this.forestAmbienceInForest =
      countStandingTreesNear(
        tx,
        ty,
        WorldScene.FOREST_AMBIENCE_RADIUS,
        WorldScene.FOREST_AMBIENCE_MIN_TREES,
      ) >= WorldScene.FOREST_AMBIENCE_MIN_TREES;
    return this.forestAmbienceInForest;
  }

  /**
   * Idle groans from living zombies in earshot. Timing and take are hashed
   * from worldTimeMs + zombie id so every listener hears the same clip.
   */
  private tickZombieGroans() {
    const me = this.room?.state?.players?.get(this.sessionId);
    const zombies = this.room?.state?.zombies;
    if (!me || !zombies) return;

    const worldTimeMs = this.room?.state?.worldTimeMs ?? 0;
    const hear = ZOMBIE_GROAN_HEAR_RADIUS;
    const span =
      WorldScene.ZOMBIE_GROAN_GAP_MAX_MS - WorldScene.ZOMBIE_GROAN_GAP_MIN_MS;
    const seen = new Set<string>();
    zombies.forEach((z, id) => {
      if (this.isZombieDead(z)) return;
      if (me.inInterior) {
        if (!z.inInterior) return;
        if ((me.interiorLevel ?? 0) !== 0) return;
        if (z.buildingX !== me.buildingX || z.buildingY !== me.buildingY) return;
      } else if (z.inInterior) {
        return;
      }
      const dist = Math.max(Math.abs(z.x - me.x), Math.abs(z.y - me.y));
      if (dist > hear) return;
      seen.add(id);

      const h = fnv1a(id);
      const period = WorldScene.ZOMBIE_GROAN_GAP_MIN_MS + (h % (span + 1));
      const phase = (h >>> 11) % period;
      const cycle = Math.floor((worldTimeMs + phase) / period);
      const last = this.zombieGroanNextAt.get(id);
      if (last == null) {
        this.zombieGroanNextAt.set(id, cycle);
        return;
      }
      if (last === cycle) return;
      this.zombieGroanNextAt.set(id, cycle);
      AudioManager.get().playZombieGroan(
        {
          x: z.x,
          y: z.y,
          noiseRadius: hear,
          inInterior: !!z.inInterior,
          buildingX: z.buildingX,
          buildingY: z.buildingY,
        },
        { variant: (h ^ cycle) % ZOMBIE_GROAN_COUNT },
      );
    });
    for (const id of [...this.zombieGroanNextAt.keys()]) {
      if (!seen.has(id)) this.zombieGroanNextAt.delete(id);
    }
  }

  /** Walk / run beds from every visible moving player, including us. */
  private tickFootsteps() {
    const sources: {
      id: string;
      sprint: boolean;
      x: number;
      y: number;
      inInterior?: boolean;
      buildingX?: number;
      buildingY?: number;
    }[] = [];
    for (const [id, sprite] of this.playerSprites) {
      const data = sprite.getData("server") as {
        x?: number;
        y?: number;
        anim?: string;
        alive?: boolean;
        inInterior?: boolean;
        buildingX?: number;
        buildingY?: number;
      } | undefined;
      const player = this.room?.state?.players?.get(id);
      const anim = data?.anim ?? player?.anim;
      const alive = data?.alive ?? player?.alive;
      if (!alive || !anim) continue;
      const sprint = anim === "run" || anim === "sprint";
      const walking = anim === "walk" || sprint;
      if (!walking) continue;
      const x = data?.x ?? player?.x;
      const y = data?.y ?? player?.y;
      if (x == null || y == null) continue;
      sources.push({
        id,
        sprint,
        x,
        y,
        inInterior: data?.inInterior ?? player?.inInterior,
        buildingX: data?.buildingX ?? player?.buildingX,
        buildingY: data?.buildingY ?? player?.buildingY,
      });
    }
    AudioManager.get().syncFootsteps(sources);
  }

  private worldSfxSource(msg: WorldSfxPayload): GunshotSource {
    return {
      x: msg.x,
      y: msg.y,
      noiseRadius: ACTION_SFX_HEAR_RADIUS,
      inInterior: msg.inInterior,
      buildingX: msg.buildingX,
      buildingY: msg.buildingY,
    };
  }

  private applyWorldSfx(msg: WorldSfxPayload) {
    if (!msg.id || !msg.kind || msg.x == null || msg.y == null) return;
    const source = this.worldSfxSource(msg);
    const audio = AudioManager.get();
    switch (msg.kind) {
      case "search":
        audio.playSearch(
          msg.searchKind === "furniture" ? "furniture" : "body",
          msg.objectType,
          { id: msg.id, source },
        );
        return;
      case "reload":
        if (msg.itemId) audio.playReload(msg.itemId, { id: msg.id, source });
        return;
      case "unload":
        if (msg.itemId) audio.playUnload(msg.itemId, { id: msg.id, source });
        return;
      case "consume":
        if (msg.itemId) audio.playConsume(msg.itemId, { id: msg.id, source });
        return;
      case "extinguish":
        audio.playFireplaceExtinguish(source);
        return;
      case "death":
        audio.playDeath(source);
        return;
      case "melee":
        audio.playMelee(source, msg.itemId);
        return;
    }
  }

  private applyWorldSfxStop(id: string, kind: WorldSfxStopKind) {
    const audio = AudioManager.get();
    if (kind === "search") audio.stopSearch(id);
    else if (kind === "reload") audio.stopReload(id);
    else if (kind === "unload") audio.stopUnload(id);
    else if (kind === "consume") audio.stopConsume(id);
  }

  private startEntityFireAnim(
    entityId: string,
    weaponIndex: number,
    fromStance = false,
    stanceUntilMs?: number,
    style: "player" | "npc" = "player",
  ) {
    const now = Date.now();
    const weapon = WEAPONS[weaponIndex];
    const melee = !!weapon && isMeleeWeapon(weapon);
    const useShort =
      style === "npc" && !melee && (fromStance || this.isEntityInFightingStance(entityId));
    this.fireAnims.set(entityId, {
      startMs: now,
      weaponIndex,
      // PlayerMan ranged always plays the full Fire* strip; NPCs keep short-from-stance.
      mode: useShort ? "short" : "full",
      // Melee returns to idle as soon as Hit* finishes — no stance hold.
      stanceUntilMs: melee ? now : (stanceUntilMs ?? now + WorldScene.FIGHTING_STANCE_MS),
      style,
    });
  }

  private resolveAttackFrame(
    entityId: string,
    serverStanceUntil = 0,
  ): number | undefined {
    const now = Date.now();
    const fire = this.fireAnims.get(entityId);
    if (fire) {
      const weapon = WEAPONS[fire.weaponIndex];
      const melee = !!weapon && isMeleeWeapon(weapon);
      const duration = this.fireAnimDuration(fire.mode, fire.weaponIndex, fire.style);
      const elapsed = now - fire.startMs;
      if (elapsed < duration) {
        if (fire.style === "npc") {
          if (fire.mode === "full") {
            return Math.min(7, Math.floor(elapsed / (duration / 8)));
          }
          // Short burst: frames 6–8 (0-indexed 5–7)
          return 5 + Math.min(2, Math.floor(elapsed / (duration / 3)));
        }
        // PlayerMan Fire* / Hit*: frames 0–4 over the full clip.
        return Math.min(
          PLAYER_FIRE_FRAMES - 1,
          Math.floor(elapsed / (duration / PLAYER_FIRE_FRAMES)),
        );
      }
      if (fire.stanceUntilMs > now) {
        // Player combat pose = Fire frame 1; NPC aim hold = FireAK 0006.
        return fire.style === "player" && !melee ? 0 : 5;
      }
      this.fireAnims.delete(entityId);
    }
    // Local CTRL aim — raise a firearm immediately (before server stance sync).
    // Melee stays on its idle pose until the swing; Hit frame 0 would look mid-swing.
    if (entityId === this.sessionId && this.aimHeld && !this.localEquippedIsMelee()) {
      return 0;
    }
    if (serverStanceUntil > now) {
      // Server stance without local fire anim — player holds frame 1;
      // MilitiaGuard / RedMan hold FireAK 0006 (0-based frame 5).
      const isPlayer =
        entityId === this.sessionId || this.playerSprites.has(entityId);
      return isPlayer ? 0 : 5;
    }
    return undefined;
  }

  private canHoldAimStance(): boolean {
    if (this.chatOpen || this.isOverlayOpen()) return false;
    const me = this.room?.state?.players?.get(this.sessionId);
    if (!me?.alive || (me.equippedWeaponIndex ?? -1) < 0) return false;
    if (this.isBusyWithTimedAction(me)) return false;
    const weapon = WEAPONS[me.equippedWeaponIndex];
    return !!weapon;
  }

  private localEquippedIsMelee(): boolean {
    const me = this.room?.state?.players?.get(this.sessionId);
    const idx =
      this.localInventorySync?.equippedWeaponIndex ??
      me?.equippedWeaponIndex ??
      -1;
    const weapon = idx >= 0 ? WEAPONS[idx] : undefined;
    return !!weapon && isMeleeWeapon(weapon);
  }

  /** CTRL held (or the mobile aim button latched) with a weapon → aim stance. */
  private handleAimInput() {
    if (this.mobileAimLatched && !this.canHoldAimStance()) {
      this.mobileAimLatched = false;
    }
    const wantAim =
      (this.mobileAimLatched || !!this.ctrlKey?.isDown) && this.canHoldAimStance();
    if (wantAim !== this.aimHeld) {
      this.setAimHeld(wantAim);
      this.refreshMobileAimButton();
      return;
    }
    if (this.aimHeld) this.updateAimLookFromPointer();
  }

  private equippedIsFullAuto(): boolean {
    const me = this.room?.state?.players?.get(this.sessionId);
    if (!me?.alive || me.equippedWeaponIndex < 0) return false;
    const weapon = WEAPONS[me.equippedWeaponIndex];
    return !!weapon && isFullAutoWeapon(weapon);
  }

  /**
   * AK / M4: while aiming, a held click (or finger) keeps firing at fireRate.
   */
  private handleAutoFire() {
    if (!this.aimHeld || !this.equippedIsFullAuto()) return;
    if (this.chatOpen || this.isOverlayOpen()) return;
    const pointer = this.input.activePointer;
    if (!pointer?.isDown) return;
    if (!this.isPointerOnGameCanvas(pointer)) return;
    if (this.cameraDrag || this.pinchActive) return;
    if (!pointer.wasTouch && !pointer.leftButtonDown()) return;
    this.fireFreeAimAt(pointer.x, pointer.y);
  }

  private setAimHeld(aiming: boolean) {
    if (this.aimHeld === aiming) return;
    this.aimHeld = aiming;
    if (aiming) {
      this.clearCombatTarget();
      this.clearInteractTarget();
      this.clearLootTarget();
      this.clearDoorTarget();
      this.clearFireplaceTarget();
      this.clearTreeChopTarget();
      this.stopPlayerMovement();
    } else {
      this.localAimFacing = null;
      this.lastSentAimLookFacing = -1;
      // Drop local post-fire stance hold when releasing CTRL.
      const fire = this.fireAnims.get(this.sessionId);
      if (fire && !this.isEntityFiring(this.sessionId)) {
        this.cancelEntityFireAnim(this.sessionId);
      }
    }
    const sprite = this.playerSprites.get(this.sessionId);
    sprite?.setData("visualKey", "");
    if (!this.room) return;
    this.room.send("action", {
      type: "aim",
      payload: { aiming },
    } satisfies ClientMessage);
    if (aiming) this.updateAimLookFromPointer(this.input.activePointer);
  }

  /**
   * While CTRL-aiming, face the 8-way octant toward the cursor.
   * Local sprite updates immediately; server is told only when the octant changes.
   */
  private updateAimLookFromPointer(pointer?: Phaser.Input.Pointer) {
    // Touch has no hover cursor — mobile facing is set by the shot itself.
    if (IS_MOBILE) return;
    if (!this.aimHeld || !this.room) return;
    if (this.chatOpen || this.isOverlayOpen()) return;
    const me = this.room.state?.players?.get(this.sessionId);
    if (!me?.alive) return;
    const equipped =
      me.equippedWeaponIndex >= 0 ? WEAPONS[me.equippedWeaponIndex] : undefined;
    if (
      this.isEntityFiring(this.sessionId) &&
      !(equipped && isFullAutoWeapon(equipped))
    ) {
      return;
    }
    const pt = pointer ?? this.input.activePointer;
    if (!pt) return;
    const world = this.cameras.main.getWorldPoint(pt.x, pt.y);
    const cart = aimPointCartesian(world.x, world.y);
    const dx = cart.x - me.x;
    const dy = cart.y - me.y;
    if (Math.hypot(dx, dy) < 0.12) return;
    const facing = directionFromWorldDelta(dx, dy);
    if (this.localAimFacing === facing) return;
    this.localAimFacing = facing;
    const sprite = this.playerSprites.get(this.sessionId);
    if (sprite) {
      sprite.setData("visualKey", "");
      this.updateEntityFromState(sprite, "player", this.sessionId);
    }
    if (facing === this.lastSentAimLookFacing) return;
    this.lastSentAimLookFacing = facing;
    this.room.send("action", {
      type: "aimLook",
      payload: { facing },
    } satisfies ClientMessage);
  }

  /** Chat system */
  private chatBarEl: HTMLElement | null = null;
  private chatInputEl: HTMLInputElement | null = null;
  private chatOpen = false;
  private chatBubbles = new Map<
    string,
    {
      root: Phaser.GameObjects.Container;
      bg: Phaser.GameObjects.Graphics;
      label: Phaser.GameObjects.Text;
      iconEl: HTMLElement | null;
      iconLocalX: number;
      iconLocalY: number;
      blockHeight: number;
      expiresAt: number;
    }
  >();
  private static readonly RADIO_BUBBLE_PREFIX = "[Radio] ";
  /**
   * Popup icon size (`.loot-item-icon-wrap`) at full zoom-in.
   * The bubble reserves this in world pixels. The glyph itself is an HTML
   * image, same as the popup, so it stays sharp and scales with the text.
   */
  private static readonly RADIO_BUBBLE_ICON_SCREEN_PX = 28;
  private static readonly CHAT_BUBBLE_MS = 6000;
  private static readonly CHAT_BUBBLE_FADE_MS = 800;
  /** True while we are intentionally leaving (shutdown) — skip onLeave → menu bounce. */
  private intentionalLeave = false;
  /** Colyseus client that opened this room, used to reconnect during combat. */
  private colyseusClient?: Client;
  /** Server epoch ms. Entity damage blocks leaving the world until this time. */
  private combatLockUntil = 0;
  private combatLockShownSec = -1;
  private combatReconnectAttempts = 0;
  private readonly onCombatBeforeUnload = (event: BeforeUnloadEvent) => {
    if (this.combatLockUntil <= Date.now()) return;
    event.preventDefault();
    event.returnValue = "";
  };
  /** Soft exterior purge: continue across frames until false. */
  private exteriorSoftPurgeActive = false;
  /** Tile where stillness tracking started. */
  private exteriorPurgeStillTile = { x: NaN, y: NaN };
  private exteriorPurgeStillSince = 0;
  private onVisibilityForPurge = () => {
    if (typeof document !== "undefined" && document.hidden) {
      this.exteriorSoftPurgeActive = true;
    }
  };

  constructor() {
    super("WorldScene");
  }

  async create() {
    this.events.off(
      Phaser.Scenes.Events.RENDER,
      this.placeChatBubbleIcons,
      this,
    );
    this.events.on(Phaser.Scenes.Events.RENDER, this.placeChatBubbleIcons, this);
    const joinGen = ++this.worldJoinGeneration;
    this.intentionalLeave = false;
    this.worldRevealReady = false;
    this.exteriorSoftPurgeActive = false;
    // Scene instance is reused — drop transition caches from the previous join.
    this.lastInteriorKey = "";
    this.lastBoundsKey = "";
    this.zombieGroanNextAt.clear();
    this.furnitureArtRebuildArmed = false;
    const combatRejoin = this.registry.get("combatRejoin") === true;
    this.registry.remove("combatRejoin");
    this.colyseusClient = this.registry.get("colyseusClient") as Client | undefined;
    this.registry.remove("colyseusClient");
    showWorldEntering(combatRejoin ? "Still in combat…" : "Entering world…");
    document.body.classList.remove("game-ready");
    this.exteriorPurgeStillTile = { x: NaN, y: NaN };
    this.exteriorPurgeStillSince = 0;
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", this.onVisibilityForPurge);
    }
    window.addEventListener("beforeunload", this.onCombatBeforeUnload);
    resetRenderStats();
    startVramTelemetry(this);
    AudioManager.get().bind(this);
    exposeVramDebugHook(this);
    this.statusEl = document.getElementById("status") ?? undefined;
    this.healthFillEl = document.getElementById("health-fill") ?? undefined;
    this.healthCapEl = document.getElementById("health-cap") ?? undefined;
    this.healthLostEl = document.getElementById("health-lost") ?? undefined;
    this.staminaFillEl = document.getElementById("stamina-fill") ?? undefined;
    this.hungerFillEl = document.getElementById("hunger-fill") ?? undefined;
    this.thirstFillEl = document.getElementById("thirst-fill") ?? undefined;
    this.tempFillEl = document.getElementById("temp-fill") ?? undefined;
    this.playerAvatarImgEl =
      (document.querySelector("#player-avatar img") as HTMLImageElement | null) ??
      undefined;
    this.hungerTrackEl = document.getElementById("hunger-track") ?? undefined;
    this.thirstTrackEl = document.getElementById("thirst-track") ?? undefined;
    this.tempTrackEl = document.getElementById("temp-track") ?? undefined;
    this.hungerLabelEl = document.getElementById("hunger-label") ?? undefined;
    this.thirstLabelEl = document.getElementById("thirst-label") ?? undefined;
    this.tempLabelEl = document.getElementById("temp-label") ?? undefined;
    this.temperatureFxEl = document.getElementById("temperature-fx") ?? undefined;
    this.infectionFxEl = document.getElementById("infection-fx") ?? undefined;
    this.worldClockEl = document.getElementById("world-clock") ?? undefined;
    this.worldClockTimeEl = document.getElementById("world-clock-time") ?? undefined;

    this.tileManager = drawProceduralWorld(this, this.worldBounds);
    setOverworldStructureFootprintProvider((tx, ty) =>
      this.overworldStructureDepthFootprints(tx + 0.5, ty + 0.5),
    );
    setPlayerWallOcclusionProvider((tx, ty) => this.playerWallOccluders(tx, ty));
    this.dayNightLighting = new DayNightLighting(this);
    this.weatherFx = new WeatherFx(this);
    this.chimneySmoke = new ChimneySmoke(this);
    setCuboidStatsProvider(() => this.tileManager?.getLiveCuboidStats() ?? "");
    this.interiorView = new InteriorView(this);
    this.interiorView.setPlaceableDepthResolver((tx, ty) =>
      this.placeableRenderDepth(tx + 0.5, ty + 0.5, {
        inInterior: true,
        excludeTX: tx,
        excludeTY: ty,
      }),
    );
    this.interiorView.setGroundBagDepthResolver((tx, ty) =>
      this.interiorCorpseDepth(tx + 0.5, ty + 0.5),
    );
    this.centerWorld();
    this.scale.on("resize", this.clampCameraZoomToViewport, this);

    this.inventoryUI = new InventoryUI({
      onEquip: (slotIndex) => this.equipWeaponBySlot(slotIndex),
      onUnequip: () => this.unequipWeapon(),
      onWearClothing: (slotIndex) => this.equipClothingBySlot(slotIndex),
      onRemoveClothing: () => this.unequipClothing(),
      onDrop: (slotIndex, quantity) => this.dropItem(slotIndex, quantity),
      onMoveSlot: (fromSlot, toSlot, splitHalf) =>
        this.moveInventorySlot(fromSlot, toSlot, splitHalf),
      onUse: (slotIndex) => this.sendConsumeStart(slotIndex),
      onUnload: (slotIndex) => this.sendUnloadStart(slotIndex),
    });
    this.journalUI = new JournalUI({
      onClose: () => this.journalUI?.close(),
      onAbandonQuest: (questId) => this.sendQuestAbandon(questId),
      onShowControls: () => this.onboardingUI?.openLegend(),
      onReplayTutorial: () => {
        this.journalUI?.close();
        this.onboardingUI?.replay();
      },
    });
    this.containerLootUI = new ContainerLootUI({
      onTakeFromContainer: (containerId, fromSlot, toSlot) =>
        this.takeFromContainer(containerId, fromSlot, toSlot),
      onMoveInContainer: (containerId, fromSlot, toSlot) =>
        this.moveInContainer(containerId, fromSlot, toSlot),
      onStoreInContainer: (containerId, fromSlot, toSlot) =>
        this.storeInContainer(containerId, fromSlot, toSlot),
      onMovePlayerSlot: (fromSlot, toSlot, splitHalf) =>
        this.moveInventorySlot(fromSlot, toSlot, splitHalf),
      onClose: () => {},
    });
    this.craftUI = new CraftUI({
      onClose: () => this.closeCraftUI(),
      onCraft: (recipeId) => this.sendCraftPerform(recipeId),
    });
    this.fireplaceUI = new FireplaceUI({
      onClose: () => this.closeFireplaceUI(),
      onAddWood: () => this.sendFireplaceAddWood(),
      onLight: () => this.sendFireplaceLight(),
      onExtinguish: () => this.sendFireplaceExtinguish(),
      onCookSlot: (slot, itemId) => this.sendFireplaceCook(slot, itemId),
      onCraft: () => this.sendFurnaceCraftOpen(),
    });
    this.prefabDepositUI = new PrefabDepositUI({
      onClose: () => this.closePrefabUI(),
      onDeposit: (itemId, quantity) => this.sendPrefabDeposit(itemId, quantity),
      onBuild: () => this.sendPrefabStartBuild(),
      onCancel: () => this.sendPrefabCancel(),
    });
    this.deconstructUI = new DeconstructUI({
      onClose: () => this.closeDeconstructUI(),
      onDeconstruct: () => this.sendDeconstructStart(),
    });
    this.traderUI = new TraderUI({
      onConfirm: (sells, buys) => this.sendTradeConfirm(sells, buys),
      onClose: () => this.closeTraderUI(),
    });
    this.playerMarketUI = new PlayerMarketUI({
      onClose: () => this.closePlayerMarketUI(),
      onList: (listing) => this.sendMarketList(listing),
      onBuy: (listingId) => this.sendMarketListing("marketBuy", listingId),
      onCancel: (listingId) => this.sendMarketListing("marketCancel", listingId),
      onCollect: () => this.sendMarketCollect(),
      onCollectPayout: (listingId) => this.sendMarketListing("marketCollectPayout", listingId),
      onBrowse: (browse) => this.sendMarketBrowse(browse),
    });
    this.redOrderDialogUI = new RedOrderDialogUI({
      onClose: () => this.closeRedOrderDialog(),
      onAcceptQuest: (questId) =>
        this.sendQuestAccept(questId, this.redOrderDialogUI?.getNpcId()),
      onCompleteTask: (taskId) => this.sendRedOrderCompleteTask(taskId),
    });
    this.ashenTraderDialogUI = new AshenTraderDialogUI({
      onClose: () => this.closeAshenTraderDialog(),
      onRequestTrade: (traderId) => this.requestTradeOpen(traderId),
      onRequestBoard: (traderId) => this.requestMarketOpen(traderId),
    });
    this.ashenMilitiaDialogUI = new AshenMilitiaDialogUI({
      onClose: () => this.closeAshenMilitiaDialog(),
      onAcceptQuest: (questId) =>
        this.sendQuestAccept(questId, this.ashenMilitiaDialogUI?.getNpcId()),
      onCompleteTask: (taskId) => this.sendAshenMilitiaCompleteTask(taskId),
      onHeal: () => this.sendAshenMilitiaHeal(),
    });
    this.mapOverlayUI = new MapOverlayUI();
    this.weaponHotbar?.destroy();
    this.weaponHotbar = new WeaponHotbar({
      onSlot: (slot) => {
        if (this.isOverlayOpen() || this.chatOpen) return;
        this.activateHotbarSlot(slot);
      },
    });
    const gameEl = document.getElementById("game");
    if (gameEl) this.damageOverlay = new DamageOverlay(gameEl);
    this.lootPopup = new LootPopup();
    this.factionAttackWarningUI = new FactionAttackWarningUI({
      onClose: () => {},
    });
    this.deathScreenUI = new DeathScreenUI({
      onRespawn: () => this.requestRespawn(),
    });
    this.onboardingUI = new OnboardingUI({
      send: (payload) => this.sendTutorialUpdate(payload),
    });
    this.doorCodeUI = new DoorCodeUI({
      onSubmitEnterCode: (code) => {
        const tile = this.pendingDoorCodeTile;
        if (!tile || !this.room) return;
        const message: ClientMessage = {
          type: "enterDoorCode",
          payload: { x: tile.x, y: tile.y, code },
        };
        this.room.send("action", message);
      },
      onSubmitSetCode: (code) => {
        const tile = this.pendingDoorCodeTile;
        if (!tile || !this.room) return;
        const message: ClientMessage = {
          type: "setDoorCode",
          payload: { x: tile.x, y: tile.y, code },
        };
        this.room.send("action", message);
      },
    });
    this.setupStructureBuildHud();
    // Bitmap-mask player outline is too heavy for mobile GPUs (tab OOM reload),
    // so phones get the mask-free ghost copy instead of no feedback at all.
    if (IS_MOBILE) {
      this.playerOccludedGhost = new PlayerOccludedGhost(this);
    } else {
      this.playerOcclusionHighlight = new PlayerOcclusionHighlight(this);
    }
    this.entityActionLabels = new EntityActionLabelManager(this);
    this.setupChatBar();
    this.setupMobileHud();

    // Search progress overlay
    const spOuter = document.createElement("div");
    spOuter.id = "search-progress";
    const spLabel = document.createElement("div");
    spLabel.id = "search-progress-label";
    spLabel.textContent = "Searching... 0%";
    const spTrack = document.createElement("div");
    spTrack.id = "search-progress-track";
    const spFill = document.createElement("div");
    spFill.id = "search-progress-fill";
    spTrack.appendChild(spFill);
    spOuter.appendChild(spLabel);
    spOuter.appendChild(spTrack);
    document.body.appendChild(spOuter);
    this.searchProgressEl = spOuter;
    this.searchProgressLabel = spLabel;
    this.searchProgressFill = spFill;

    const keyboard = this.input.keyboard;
    if (keyboard) {
      keyboard.addCapture([
        Phaser.Input.Keyboard.KeyCodes.E,
        Phaser.Input.Keyboard.KeyCodes.R,
        Phaser.Input.Keyboard.KeyCodes.TAB,
        Phaser.Input.Keyboard.KeyCodes.M,
        Phaser.Input.Keyboard.KeyCodes.B,
        Phaser.Input.Keyboard.KeyCodes.UP,
        Phaser.Input.Keyboard.KeyCodes.DOWN,
        Phaser.Input.Keyboard.KeyCodes.LEFT,
        Phaser.Input.Keyboard.KeyCodes.RIGHT,
        Phaser.Input.Keyboard.KeyCodes.SHIFT,
        Phaser.Input.Keyboard.KeyCodes.CTRL,
      ]);
      this.cursors = keyboard.createCursorKeys();
      this.keys = {
        W: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        A: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        S: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        D: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
        E: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E),
        R: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R),
      };
      this.shiftKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
      this.ctrlKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.CTRL);
      this.tabKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TAB);
      this.mKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.M);
      this.jKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.J);
      this.bKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.B);
      this.zeroKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ZERO);
      const hotbarKeyCodes = [
        Phaser.Input.Keyboard.KeyCodes.ONE,
        Phaser.Input.Keyboard.KeyCodes.TWO,
      ];
      this.hotbarKeys = hotbarKeyCodes.map((code) => keyboard.addKey(code));
    }

    // Tile indicator graphic (drawn once, repositioned on each click)
    this.moveTarget = this.add.graphics();
    this.moveTargetOccluded = this.add.graphics();
    this.moveTargetOccluded.setDepth(OCCLUSION_OVERLAY_DEPTH);
    this.moveTargetOccluded.setVisible(false);
    this.moveTargetOcclusionMask = new BuildingOcclusionMask(this);

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      // HTML HUD / dialogs also generate Phaser pointer events (window listeners).
      // Ignoring them prevents stuck isDown after menu open/close on mobile.
      if (!this.isPointerOnGameCanvas(pointer)) {
        this.releaseStolenTouchInput();
        return;
      }
      if (this.isOverlayOpen() || this.chatOpen) {
        this.releaseStolenTouchInput();
        return;
      }

      // Second finger → pinch zoom (don't treat as move / combat).
      if (this.countDownPointers(pointer) >= 1) {
        this.cameraDrag = false;
        this.clearPendingTouchTap();
        this.stopPlayerMovement();
        this.beginPinchZoom();
        this.ignoreTouchTapUntil = Date.now() + 350;
        return;
      }

      if (pointer.rightButtonDown() && !pointer.wasTouch) {
        this.cameraDrag = true;
        this.dragStart = { x: pointer.x, y: pointer.y };
        this.cameraStart = {
          x: this.cameras.main.scrollX,
          y: this.cameras.main.scrollY,
        };
        return;
      }

      if (!pointer.leftButtonDown() && !pointer.wasTouch) return;

      // Full-auto while aiming: fire on press (desktop and touch) so a short
      // tap still shoots, then hold continues in handleAutoFire.
      if (this.aimHeld && this.equippedIsFullAuto()) {
        this.pendingTouchTap = null;
        this.handlePrimaryPointerAt(pointer.x, pointer.y, pointer);
        return;
      }

      // Touch: wait for pointerup so a pinch's first finger never moves the player.
      if (pointer.wasTouch || isMobileDevice()) {
        this.pendingTouchTap = {
          id: pointer.id,
          x: pointer.x,
          y: pointer.y,
        };
        return;
      }

      this.handlePrimaryPointerAt(pointer.x, pointer.y, pointer);
    });

    this.input.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      this.cameraDrag = false;

      if (this.countDownPointers(pointer) < 1) {
        if (this.pinchActive) {
          this.ignoreTouchTapUntil = Date.now() + 350;
        }
        this.pinchActive = false;
      }

      // Hold-to-fire already handled the shot; don't fire again on release.
      if (this.aimHeld && this.equippedIsFullAuto()) {
        this.pendingTouchTap = null;
        return;
      }

      const pending = this.pendingTouchTap;
      if (!pending || pending.id !== pointer.id) return;
      this.pendingTouchTap = null;

      if (!this.isPointerOnGameCanvas(pointer)) return;
      if (this.isOverlayOpen() || this.chatOpen) return;
      if (Date.now() < this.ignoreTouchTapUntil) return;
      // Another finger still down (exclude the one that just released).
      if (this.countDownPointers(pointer) >= 1) return;

      const moved = Math.hypot(pointer.x - pending.x, pointer.y - pending.y);
      if (moved > WorldScene.TOUCH_TAP_SLOP_PX) return;

      this.handlePrimaryPointerAt(pending.x, pending.y, pointer);
    });

    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (!this.isPointerOnGameCanvas(pointer)) return;

      if (this.countDownPointers() >= 2) {
        this.clearPendingTouchTap();
        this.updatePinchZoom();
        return;
      }
      if (this.pinchActive) {
        this.pinchActive = false;
        this.ignoreTouchTapUntil = Date.now() + 350;
      }

      if (this.pendingTouchTap && pointer.id === this.pendingTouchTap.id) {
        const moved = Math.hypot(
          pointer.x - this.pendingTouchTap.x,
          pointer.y - this.pendingTouchTap.y,
        );
        if (moved > WorldScene.TOUCH_TAP_SLOP_PX) {
          this.clearPendingTouchTap();
        }
      }

      if (this.cameraDrag) {
        const dx = pointer.x - this.dragStart.x;
        const dy = pointer.y - this.dragStart.y;
        this.cameras.main.scrollX = this.cameraStart.x - dx;
        this.cameras.main.scrollY = this.cameraStart.y - dy;
        if (!IS_MOBILE) this.syncWorldTiles();
        return;
      }
      this.updateAimLookFromPointer(pointer);
      this.updateBuildingHover(pointer);
    });

    this.game.canvas.addEventListener("pointercancel", () => {
      this.releaseStolenTouchInput();
    });

    this.input.on(
      "wheel",
      (
        pointer: Phaser.Input.Pointer,
        _gameObjects: Phaser.GameObjects.GameObject[],
        _deltaX: number,
        deltaY: number,
      ) => {
        if (this.isOverlayOpen() || this.chatOpen) return;
        this.applyCameraWheelZoom(pointer, deltaY);
      },
    );

    this.game.canvas.addEventListener(
      "wheel",
      (e) => e.preventDefault(),
      { passive: false },
    );
    // Keep the browser from hijacking two-finger gestures on the canvas.
    this.game.canvas.style.touchAction = "none";

    try {
      const existingRoom = this.registry.get("worldRoom") as WorldRoom | undefined;
      this.registry.remove("worldRoom");
      if (!existingRoom) {
        hideWorldEntering();
        this.registry.set("menuError", "Wallet login required");
        this.scene.start("MainMenuScene");
        return;
      }
      const room = existingRoom;
      this.room = room;
      const cachedPlayerId = this.registry.get("playerId") as string | undefined;
      this.registry.remove("playerId");
      this.sessionId =
        typeof cachedPlayerId === "string" && cachedPlayerId.startsWith("player-")
          ? cachedPlayerId
          : "";
      room.onMessage("identity", (msg: { playerId?: string }) => {
        if (typeof msg?.playerId === "string" && msg.playerId.startsWith("player-")) {
          this.sessionId = msg.playerId;
        }
      });
      room.onMessage("combatLock", (msg: { until?: number }) => {
        this.applyCombatLock(msg?.until);
      });
      // Server pushes inventorySync from onJoin before WorldScene finishes
      // setup — register immediately or Colyseus drops it with
      // "onMessage() not registered for type 'inventorySync'".
      room.onMessage("inventorySync", (msg) => {
        this.applyInventorySync(msg);
      });
      this.setStatus("Connected");
      await this.waitForLocalPlayer(room, joinGen);
      if (!this.isWorldJoinCurrent(joinGen, room)) return;
      if (!this.sessionId.startsWith("player-")) {
        throw new Error("Failed to resolve local player id");
      }
      if (!room.state?.players?.get(this.sessionId)) {
        throw new Error("Timed out waiting for local player state");
      }
      setWorldEnteringStatus("Loading nearby sprites");
      await this.preloadSpawnEntityPacks();
      if (!this.isWorldJoinCurrent(joinGen, room)) return;
      // Center on the local player, then rebuild the camera matrix before the
      // first tile sync. getWorldPoint is stale until preRender — without it
      // the desktop view∩player clamp is a tiny square around the last matrix
      // (world origin from centerWorld) and later idle syncs think they are done.
      this.centerCameraOnLocalPlayer();
      this.cameras.main.preRender();
      // Reveal only after packs are ready so Ashen traders never flash as MilitiaGuard1.
      this.worldRevealReady = true;
      this.bindRoom(room);
      // Structure / temp-wall sync is sent from onJoin and again on clientReady.
      // Handlers must be registered before clientReady or the reconnect sync is
      // dropped (same race the server comment calls out for temp walls).
      this.bindStructureMessages(room);
      this.syncWorldTiles(true);
      this.syncInteriorView();
      this.refreshAllVisuals(0);
      document.body.classList.add("game-ready");
      hideWorldEntering();
      this.setStatus("");
      // One more pass after the first real render, in case scale/canvas size
      // was not committed during async create().
      this.time.delayedCall(0, () => {
        if (!this.isWorldJoinCurrent(joinGen, room)) return;
        this.centerCameraOnLocalPlayer();
        this.cameras.main.preRender();
        this.tileManager?.invalidateRenderView();
        this.syncWorldTiles(true);
        this.syncOverworldFenceSprites();
        this.syncOverworldFenceCornerSprites();
        this.refreshPlaceableDepths();
        this.refreshAllVisuals(0);
      });
      this.ensureWorldBarracksFences();
      this.syncOverworldFenceSprites();
      this.syncOverworldFenceCornerSprites();
      this.refreshPlaceableDepths();
      this.syncOverworldBuildingPlacementBlockers();

      room.onMessage("tutorialSync", (msg: { flagsJson?: string }) => {
        if (typeof msg?.flagsJson === "string") {
          this.onboardingUI?.applyFlagsJson(msg.flagsJson);
          this.syncAshenMilitiaDialogState();
        }
      });

      room.onMessage("tutorialEvent", (msg: TutorialEventMessage) => {
        if (msg?.event === "zombieKill") this.notifyTutorial("kill_zombie");
        else if (msg?.event === "weaponBroke") this.notifyTip("weapon_broke");
        else if (msg?.event === "theftWarning") this.notifyTip("theft_warning");
      });

      room.onMessage("event", (msg: ServerEvent) => {
        if (msg.type === "lootFound") {
          this.clearLocalSearchProgress();
          this.lootPopup?.show(msg.payload.items);
        } else if (msg.type === "containerOpen") {
          this.clearLocalSearchProgress();
          this.openContainerLootUI(
            msg.payload.containerId,
            msg.payload.objectType,
            msg.payload.containerJson,
            msg.payload.piles,
          );
        } else if (msg.type === "containerSync") {
          this.containerLootUI?.syncContainer(
            msg.payload.containerId,
            msg.payload.containerJson,
          );
        } else if (msg.type === "craftOpen") {
          this.openCraftUI(msg.payload);
        } else if (msg.type === "fireplaceOpen") {
          this.openFireplaceUI(msg.payload);
        } else if (msg.type === "fireplaceSync") {
          this.fireplaceUI?.sync(msg.payload);
          if (this.localInventorySync) {
            this.localInventorySync = {
              ...this.localInventorySync,
              inventoryJson: msg.payload.inventoryJson,
            };
          }
          this.lastInventoryRenderKey = "";
          this.lastHotbarRenderKey = "";
          this.applyFireplaceStateChanged({
            x: msg.payload.x,
            y: msg.payload.y,
            inInterior: msg.payload.inInterior,
            buildingX: msg.payload.buildingX ?? 0,
            buildingY: msg.payload.buildingY ?? 0,
            fuelWood: msg.payload.fuelWood,
            activeUntil: msg.payload.activeUntil,
          });
        } else if (msg.type === "craftSync") {
          // Craft finished (dialog already closed when channel started).
          if (this.localTimedAction?.kind === "craft") {
            this.localTimedAction = null;
            this.lastSearchProgressPct = -1;
            this.searchProgressEl?.classList.remove("search-progress--visible");
          }
          if (this.localInventorySync) {
            this.localInventorySync = {
              ...this.localInventorySync,
              inventoryJson: msg.payload.inventoryJson,
            };
          }
          this.lastInventoryRenderKey = "";
          this.lastHotbarRenderKey = "";
          if (msg.payload.salvaged && msg.payload.salvaged.length > 0) {
            const ruined = (msg.payload.ruined ?? [])
              .map((part) => part.name)
              .filter((name) => name.length > 0);
            const count = msg.payload.salvaged.length;
            const header = ruined.length
              ? `You salvaged ${count} ${count === 1 ? "part" : "parts"}. Ruined: ${ruined.join(", ")}.`
              : "You recovered every part.";
            this.lootPopup?.show(msg.payload.salvaged, { header });
          } else if (msg.payload.crafted) {
            this.lootPopup?.show([msg.payload.crafted], { header: "You made:" });
          }
        } else if (msg.type === "tradeOpen") {
          this.openTraderUI(msg.payload);
        } else if (msg.type === "tradeSync") {
          this.traderUI?.sync({
            ...msg.payload,
            barterT: this.localSkillMods().barterT,
          });
          if (this.localInventorySync) {
            this.localInventorySync = {
              ...this.localInventorySync,
              inventoryJson: msg.payload.inventoryJson,
            };
          }
          this.lastInventoryRenderKey = "";
          this.lastHotbarRenderKey = "";
        } else if (msg.type === "marketOpen") {
          this.openPlayerMarketUI(msg.payload);
        } else if (msg.type === "marketSync") {
          this.applyMarketInventory(msg.payload);
          if (msg.payload.close) {
            this.closePlayerMarketUI();
          } else {
            this.playerMarketUI?.sync(msg.payload);
          }
        } else if (msg.type === "dialogOpen") {
          this.openNpcDialog(msg.payload);
        } else if (msg.type === "questSync") {
          this.applyQuestSync(msg.payload.questsJson);
        } else if (msg.type === "skillSync") {
          this.applySkillSync(msg.payload.skillsJson);
        } else if (msg.type === "blueprintSync") {
          this.applyBlueprintSync(msg.payload.learnedBlueprintsJson);
          if (msg.payload.weaponId) {
            this.lootPopup?.show(
              [
                {
                  id: msg.payload.weaponId,
                  name: "You have learned a new recipe",
                  quantity: 1,
                  hideQuantity: true,
                },
              ],
              { header: "" },
            );
          }
        } else if (msg.type === "dialogTaskDenied") {
          this.ashenMilitiaDialogUI?.noteDenied(
            msg.payload.taskId,
            msg.payload.reason,
          );
          this.redOrderDialogUI?.noteDenied(
            msg.payload.taskId,
            msg.payload.reason,
          );
        } else if (msg.type === "dialogTaskComplete") {
          this.closeRedOrderDialog();
          this.closeAshenMilitiaDialog();
          this.lootPopup?.show(msg.payload.rewards, {
            header: "You received:",
          });
        } else if (msg.type === "dialogHealComplete") {
          this.closeAshenMilitiaDialog();
          this.lootPopup?.show([], {
            header: msg.payload.curedInfection
              ? "Wounds treated. Infection cleared."
              : "You're fully healed.",
          });
        } else if (msg.type === "skillLevelUp") {
          this.lootPopup?.show([], {
            header: msg.payload.label,
            arrow: "↑",
          });
        } else if (msg.type === "playerNote") {
          const text = msg.payload.text.trim();
          if (text === BIRCHPORT_WEAPON_EQUIP_DENIED) this.notifyTip("weapon_blocked");
          const noteItems = msg.payload.items?.filter((item) => item?.name);
          if (!text && (!noteItems || noteItems.length === 0)) return;
          const durationMs = msg.payload.durationMs;
          if (noteItems && noteItems.length > 0) {
            this.lootPopup?.show(
              noteItems.map((item) => ({
                id: item.id,
                name: item.name,
                quantity: item.quantity,
                hideQuantity: item.quantity <= 1,
              })),
              { header: text, durationMs },
            );
          } else if (msg.payload.iconId) {
            this.lootPopup?.show(
              [
                {
                  id: msg.payload.iconId,
                  name: text,
                  quantity: 1,
                  hideQuantity: true,
                },
              ],
              { header: "", durationMs },
            );
          } else {
            this.lootPopup?.show([], { header: text, durationMs });
          }
        } else if (msg.type === "shotMissed") {
          this.spawnMissImpact(
            msg.payload.impactX,
            msg.payload.impactY,
            msg.payload.targetId,
            msg.payload.weaponIndex,
            msg.payload.treeCoverMiss === true,
          );
        } else if (msg.type === "entityHit") {
          this.handleEntityHit(
            msg.payload.targetId,
            msg.payload.x,
            msg.payload.y,
            msg.payload.weaponIndex,
          );
        } else if (msg.type === "gunshotHeard") {
          this.playSyncedGunshot(
            msg.payload.weaponIndex,
            msg.payload.sfxVariant,
            msg.payload,
          );
        } else if (msg.type === "bulletImpact") {
          this.handleBulletImpact(msg.payload);
        } else if (msg.type === "shotTrace") {
          this.handleShotTrace(msg.payload);
        } else if (msg.type === "bargateOpen") {
          this.playBarracksBargateOpen(msg.payload.facing);
        } else if (msg.type === "prefabOpen") {
          this.openPrefabUI(msg.payload);
        } else if (msg.type === "prefabSync") {
          this.prefabDepositUI?.sync(msg.payload);
          if (this.localInventorySync) {
            this.localInventorySync = {
              ...this.localInventorySync,
              inventoryJson: msg.payload.inventoryJson,
            };
          }
          this.lastInventoryRenderKey = "";
          this.lastHotbarRenderKey = "";
        } else if (msg.type === "deconstructOpen") {
          this.openDeconstructUI(msg.payload);
        }
      });

      room.onMessage("chat", (msg: ChatBroadcast) => {
        this.showChatBubble(msg.senderId, msg.text, msg.tone === "action");
        if (msg.channel === "radio") {
          const sprite = this.getEntitySprite(msg.senderId);
          if (!sprite?.visible) {
            this.showRadioCaption(
              `${msg.senderName}: ${msg.text}`,
              msg.tone === "action",
            );
          }
        }
      });

      room.onMessage(
        "radioPing",
        (msg: { playerId?: string; name?: string; x?: number; y?: number; freq?: number }) => {
          const playerId = typeof msg.playerId === "string" ? msg.playerId : "";
          const name = typeof msg.name === "string" ? msg.name : "Radio";
          const x = typeof msg.x === "number" ? msg.x : NaN;
          const y = typeof msg.y === "number" ? msg.y : NaN;
          const freq = typeof msg.freq === "number" ? msg.freq : 0;
          if (!playerId || !Number.isFinite(x) || !Number.isFinite(y) || freq <= 0) return;
          if (freq !== this.localRadioFreq()) return;
          this.radioPings.set(playerId, { playerId, name, x, y, freq });
          this.refreshMapOverlay();
        },
      );

      room.onMessage("godmode", (msg: { enabled?: boolean }) => {
        this.godModeDebug = msg.enabled === true;
        if (!this.godModeDebug) this.clearEntitySpriteBoundsDebug();
      });

      room.onMessage("buildMode", (msg: { enabled?: boolean }) => {
        this.buildMode = msg.enabled === true;
        if (!this.buildMode) {
          this.clearBuildModePreview();
          this.game.canvas.style.cursor = "";
        } else {
          this.game.canvas.style.cursor = "crosshair";
        }
      });

      // Last: clientReady makes the server re-send the syncs it pushed during
      // onJoin (inventory, structures, quests, skills). Sending it before the
      // handlers above are bound is what drops them. It also clears join
      // invulnerability, which is fine now that the canvas is visible.
      this.room.send("action", { type: "clientReady" });
    } catch (err) {
      // Always drop the live room on failure so the server does not keep a
      // ghost session (next Enter world → "Signed in from another session").
      const roomToLeave = this.room;
      this.room = undefined;
      if (roomToLeave) {
        try {
          void roomToLeave.leave();
        } catch {
          /* ignore */
        }
      }
      if (joinGen !== this.worldJoinGeneration || !this.sys.isActive()) return;
      console.error(err);
      const detail = err instanceof Error ? err.message : String(err);
      this.setStatus(`Failed to connect: ${detail}`);
      this.worldRevealReady = false;
      document.body.classList.remove("game-ready");
      hideWorldEntering();
      this.registry.set("menuError", detail);
      this.scene.start("MainMenuScene");
    }
  }

  /** True while this async create() is still the active world join. */
  private isWorldJoinCurrent(joinGen: number, room: WorldRoom) {
    return (
      joinGen === this.worldJoinGeneration &&
      this.sys.isActive() &&
      this.room === room &&
      !this.intentionalLeave
    );
  }

  /** Wait until the local player exists in schema (or timeout). */
  private waitForLocalPlayer(room: WorldRoom, joinGen: number) {
    return new Promise<void>((resolve) => {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        room.onStateChange.remove(onChange);
        resolve();
      };
      const resolveLocalId = (): string | undefined => {
        if (this.sessionId.startsWith("player-")) {
          return this.sessionId;
        }
        const myName = (
          this.registry.get("playerName") as string | undefined
        )?.trim();
        if (!myName || !room.state?.players) return undefined;
        let found: string | undefined;
        room.state.players.forEach((player, id) => {
          if (player.name === myName) found = id;
        });
        return found;
      };
      /** Need the schema row, not just the id — blank canvas if we reveal without it. */
      const hasMe = () => {
        const id = resolveLocalId();
        if (!id) return false;
        if (!room.state?.players?.get(id)) return false;
        this.sessionId = id;
        return true;
      };
      const onChange = () => {
        if (hasMe()) done();
      };
      if (hasMe()) {
        done();
        return;
      }
      const started = Date.now();
      room.onStateChange(onChange);
      const tick = () => {
        if (settled) return;
        if (
          !this.isWorldJoinCurrent(joinGen, room) ||
          hasMe() ||
          Date.now() - started > 12_000
        ) {
          done();
          return;
        }
        window.setTimeout(tick, 50);
      };
      tick();
    });
  }

  /**
   * Wait for the server's spawn manifest, falling back to whatever schema has
   * arrived if it never comes.
   *
   * The fallback is deliberately a fallback: schema is empty this early on a
   * normal join, so relying on it is what let sprites pop in after the reveal.
   */
  private async awaitSpawnManifest(
    timeoutMs = 3000,
  ): Promise<SpawnEntityManifest | null> {
    const pending = this.registry.get("spawnEntities") as
      | Promise<SpawnEntityManifest | null>
      | undefined;
    if (!pending) return null;
    this.registry.remove("spawnEntities");
    let timer = 0;
    const timeout = new Promise<null>((resolve) => {
      timer = window.setTimeout(() => resolve(null), timeoutMs);
    });
    try {
      return await Promise.race([pending, timeout]);
    } finally {
      window.clearTimeout(timer);
    }
  }

  /** Batch-load NPC packs near the spawn before any sprites are created. */
  private async preloadSpawnEntityPacks() {
    const manifest = await this.awaitSpawnManifest();

    const me = this.room?.state?.players?.get(this.sessionId);
    if (!me || !this.room?.state) return;

    markBootEntityPacksReady();

    const zombies: { x: number; y: number; skin?: number }[] = [];
    const guards: {
      x: number;
      y: number;
      skin?: number;
      npcKind?: number;
    }[] = [];
    const players: { x: number; y: number; clothingSkin?: number }[] = [];

    if (manifest) {
      zombies.push(...manifest.zombies);
      guards.push(...manifest.guards);
      players.push(...manifest.players);
    } else {
      this.room.state.zombies.forEach((z) => {
        zombies.push({
          x: z.x,
          y: z.y,
          skin: (z as { skin?: number }).skin,
        });
      });
      this.room.state.guards.forEach((g) => {
        guards.push({
          x: g.x,
          y: g.y,
          skin: (g as { skin?: number }).skin,
          npcKind: (g as { npcKind?: number }).npcKind,
        });
      });
      this.room.state.players.forEach((p) => {
        players.push({
          x: p.x,
          y: p.y,
          clothingSkin: (p as { clothingSkin?: number }).clothingSkin ?? 1,
        });
      });
      this.room.state.corpses?.forEach((c) => {
        players.push({
          x: c.x,
          y: c.y,
          clothingSkin: (c as { clothingSkin?: number }).clothingSkin ?? 1,
        });
      });
    }

    // The local skin comes from the inventory sync, which is authoritative
    // sooner than the schema field and is never in the manifest.
    players.push({
      x: me.x,
      y: me.y,
      clothingSkin:
        this.localInventorySync?.clothingSkin ??
        (me as { clothingSkin?: number }).clothingSkin ??
        1,
    });

    await preloadNearbyEntityPacks(
      this,
      {
        playerX: Math.floor(me.x),
        playerY: Math.floor(me.y),
        zombies,
        guards,
        players,
      },
      8000,
    );
  }

  update(_time: number, delta: number) {
    if (!this.room?.state?.players || !this.worldRevealReady) return;
    const frameDelta = Math.min(delta, MAX_FRAME_DELTA_MS);
    this.syncBlockingUiInputState();
    this.flushPendingZombieRefreshes();
    this.handleInventoryInput();
    this.handleMapInput();
    this.handleJournalInput();
    this.handleStructureBuildInput();
    this.syncWorldTiles();
    this.syncInteriorView();
    this.updateSearchHover();
    this.updateLootableHover();
    this.updateEntityHover();
    this.updateDoorHover();
    this.updateBargateHover();
    this.updateFireplaceHover();
    this.updatePrefabHover();
    this.updateTreeChopHover();
    this.updateBuildModeHover();
    this.updateCombatPursuit();
    this.updateInteractPursuit();
    this.updateLootPursuit();
    this.updateDoorPursuit();
    this.updateBargatePursuit();
    this.updateFireplacePursuit();
    this.updateStorageBoxPursuit();
    this.updatePrefabPursuit();
    this.updateTreeChopPursuit();
    this.updateTraderProximity();
    this.updateMarketProximity();
    this.updateRedOrderDialogProximity();
    this.updateAshenTraderDialogProximity();
    this.updateAshenMilitiaDialogProximity();
    this.handleCombatInput(frameDelta);
    this.handleAimInput();
    this.handleAutoFire();
    this.handleKeyboardMovement();
    this.handleSearchInput();
    this.updateContainerLootProximity();
    this.updateCraftProximity();
    this.updateFireplaceProximity();
    this.updatePrefabProximity();
    this.tickMoveTargetIndicator();
    this.updateDamageOverlay(frameDelta);
    this.refreshInventoryUI();
    this.stepMapChart();
    this.refreshMapOverlay();
    this.refreshHotbar();
    this.refreshAllVisuals(frameDelta);
    this.tickExteriorSoftPurge(frameDelta);
    this.updateLocalPlayerHud();
    this.updateChatBubbles();
    this.updateEntityActionLabels();
    this.updateDayNightLighting(frameDelta);
    this.chimneySmoke?.update(
      frameDelta,
      !!this.room?.state?.players?.get(this.sessionId)?.inInterior,
    );
    this.syncGunshotListener();
    this.syncFireplaceAudio();
    this.syncOutdoorAmbience(frameDelta);
    this.tickZombieGroans();
    this.tickFootsteps();
    this.refreshCombatLockBanner();
  }

  private updateDamageOverlay(delta: number) {
    const me = this.room?.state?.players?.get(this.sessionId);
    if (!me || !this.damageOverlay) return;
    this.damageOverlay.update(
      me.health,
      playerMaxHealthFromInfection(me.infection ?? 0, !!me.infected) || 1,
      delta,
    );
  }

  shutdown() {
    document.removeEventListener("keydown", this.onFieldKeyDown);
    document.removeEventListener("keyup", this.onFieldKeyUp);
    this.events.off(
      Phaser.Scenes.Events.RENDER,
      this.placeChatBubbleIcons,
      this,
    );
    this.worldJoinGeneration++;
    this.intentionalLeave = true;
    this.worldRevealReady = false;
    AudioManager.get().stopFireplaces();
    AudioManager.get().stopAmbience();
    AudioManager.get().stopAllActionSounds();
    AudioManager.get().stopFootsteps();
    AudioManager.get().stopZombieGroans();
    AudioManager.get().stopAllTreeFalls();
    this.forestAmbienceTileKey = "";
    this.forestAmbienceInForest = false;
    this.zombieGroanNextAt.clear();
    stopVramTelemetry();
    resetFurnitureAssets();
    resetEntityAssetLoader(this);
    // Invalidate in-flight pack loads via loadEpoch only — do not reset/removeAll
    // on this.load (that tears down loader wiring and breaks tile/furniture redraw).
    hideWorldEntering();
    document.body.classList.remove("game-ready");
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", this.onVisibilityForPurge);
    }
    window.removeEventListener("beforeunload", this.onCombatBeforeUnload);
    this.combatLockBanner()?.remove();
    this.scale.off("resize", this.clampCameraZoomToViewport, this);
    const room = this.room;
    this.room = undefined;
    if (room) {
      try {
        void room.leave();
      } catch {
        /* ignore */
      }
    }
    // Phaser reuses this Scene instance — clear entity maps so a reconnect
    // does not refresh destroyed sprites (sprite.scene is null → textures crash).
    this.clearEntitySpriteMaps();
    this.fireAnims.clear();
    this.dieAnims.clear();
    this.doctorIdleVariants.clear();
    this.pendingZombieRefreshIds.clear();
    this.recentGunHits.clear();
    this.sessionId = "";
    this.lastInteriorKey = "";
    this.lastBoundsKey = "";
    this.parsedLocalInventory = null;
    this.cachedSkillMods = null;
    // HUD elements live in the page, not the scene: forget the written values
    // so a rejoin repaints them instead of trusting the last session's state.
    this.lastHudBars = {
      healthPct: -1,
      capPct: -1,
      lostPct: -1,
      staminaPct: -1,
      hungerPct: -1,
      thirstPct: -1,
      tempPct: -1,
      tempColor: "",
      tempLabel: "",
      hungerCritical: null,
      thirstCritical: null,
      tempCritical: null,
      tempFx: "",
      infectionFx: "",
    };
    this.lastWorldClock = {
      time: "",
      phase: "",
      clockHidden: null,
      timeHidden: null,
    };
    this.clearGroundBackpackSprites();
    try {
      this.interiorView?.hide();
    } catch {
      /* scene systems may already be down */
    }
    this.interiorView = undefined;
    this.dayNightLighting?.destroy();
    this.dayNightLighting = undefined;
    this.weatherFx?.destroy();
    this.weatherFx = undefined;
    this.chimneySmoke?.destroy();
    this.chimneySmoke = undefined;
    this.tileManager = undefined;
    setOverworldStructureFootprintProvider(null);
    setPlayerWallOcclusionProvider(null);
    setCuboidStatsProvider(null);
    resetBuildingTextureCache(this);
    resetTreeFallFrameRequests();
    this.inventoryUI?.destroy();
    this.journalUI?.destroy();
    this.containerLootUI?.destroy();
    this.craftUI?.close();
    this.craftUI = undefined;
    this.traderUI?.close();
    this.playerMarketUI?.destroy();
    this.playerMarketUI = undefined;
    this.redOrderDialogUI?.close();
    this.ashenTraderDialogUI?.close();
    this.ashenMilitiaDialogUI?.close();
    this.traderUI = undefined;
    this.redOrderDialogUI = undefined;
    this.ashenTraderDialogUI = undefined;
    this.ashenMilitiaDialogUI = undefined;
    this.mapOverlayUI?.destroy();
    this.mapOverlayUI = undefined;
    this.weaponHotbar?.destroy();
    this.weaponHotbar = undefined;
    this.damageOverlay?.destroy();
    this.damageOverlay = undefined;
    this.game.canvas.style.cursor = "";
    this.lootPopup?.destroy();
    this.lootPopup = undefined;
    this.factionAttackWarningUI?.destroy();
    this.factionAttackWarningUI = undefined;
    this.deathScreenUI?.destroy();
    this.deathScreenUI = undefined;
    this.onboardingUI?.destroy();
    this.onboardingUI = undefined;
    this.playerOcclusionHighlight?.destroy();
    this.playerOccludedGhost?.destroy();
    this.playerOccludedGhost = undefined;
    this.clearShotTraces();
    this.entityActionLabels?.destroy();
    this.moveTargetOcclusionMask?.destroy();
    this.godModeDebug = false;
    this.buildMode = false;
    this.tempInteriorWallsByBuilding.clear();
    this.clearOverworldTempWallSprites();
    this.tempOverworldWallKeys.clear();
    this.structureBuildMode = false;
    this.structureWallsByBuilding.clear();
    this.structureDoorsByBuilding.clear();
    this.structureFireplacesByBuilding.clear();
    this.structureStorageBoxesByBuilding.clear();
    this.structureFencesByBuilding.clear();
    this.structureFenceCornersByBuilding.clear();
    this.structureWallKeysOverworld.clear();
    this.structureWallOwnersOverworld.clear();
    this.structureDoorsOverworld.clear();
    this.structureFireplacesOverworld.clear();
    this.structureStorageBoxesOverworld.clear();
    this.structureFencesOverworld.clear();
    this.structureFenceOccupancyOverworld.clear();
    this.structureFenceCornersOverworld.clear();
    this.clearOverworldStructureSprites();
    this.clearOverworldFireplaceSprites();
    this.clearOverworldStorageBoxSprites();
    this.clearOverworldFenceSprites();
    this.clearOverworldFenceCornerSprites();
    this.prefabsByBuilding.clear();
    this.prefabsOverworld.clear();
    this.clearOverworldPrefabSprites();
    this.pendingOwnDoorPlacement = null;
    this.pendingDoorCodeTile = null;
    this.clearDoorTarget();
    this.clearFireplaceTarget();
    this.clearPrefabTarget();
    this.clearTreeChopTarget();
    this.clearBarracksBargateAnim();
    this.fireplaceUI?.close();
    this.prefabDepositUI?.close();
    this.deconstructUI?.close();
    this.doorCodeUI?.destroy();
    this.structureBuildHudEl?.remove();
    this.structureBuildHudEl = undefined;
    this.clearBuildModePreview();
    this.clearEntitySpriteBoundsDebug();
    this.entityBoundsGfx?.destroy();
    this.entityBoundsGfx = undefined;
    this.searchProgressEl?.remove();
    this.mobileHudEl?.remove();
    this.mobileHudEl = undefined;
    this.releaseMoveStick();
    this.moveStickEl?.remove();
    this.moveStickEl = undefined;
    this.moveStickKnob = undefined;
    this.mobileInventoryBtn = undefined;
    this.mobileMapBtn = undefined;
    this.mobileAimBtn = undefined;
    this.mobileAimLatched = false;
    this.mobileReloadBtn = undefined;
    this.mobileBuildBtn = undefined;
    this.mobileChatBtn = undefined;
    this.mobileReloadAmmoIconId = "";
    document.body.classList.remove("build-mode-open");
    this.closeChatBar();
    for (const bubble of this.chatBubbles.values()) this.destroyChatBubble(bubble);
    this.chatBubbles.clear();
  }

  /** Drop cached sprites from a prior WorldScene boot (Phaser reuses the instance). */
  private clearEntitySpriteMaps() {
    for (const map of [
      this.playerSprites,
      this.corpseSprites,
      this.zombieSprites,
      this.coywolfSprites,
      this.bearSprites,
      this.crowSprites,
      this.guardSprites,
    ]) {
      for (const sprite of map.values()) {
        try {
          if (sprite.scene) sprite.destroy();
        } catch {
          /* already destroyed with the display list */
        }
      }
      map.clear();
    }
  }

  // ── Chat ─────────────────────────────────────────────────────────────────

  private setupMobileHud() {
    if (this.mobileHudEl) return;

    const stack = document.createElement("div");
    stack.id = "mobile-hud-stack";
    stack.setAttribute("role", "toolbar");
    stack.setAttribute("aria-label", "Game actions");

    const makeBtn = (
      id: string,
      iconSrc: string | undefined,
      ariaLabel: string,
      onClick: () => void,
      opts?: { skipCloseChat?: boolean; label?: string },
    ) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.id = id;
      btn.className = "mobile-hud-btn";
      btn.setAttribute("aria-label", ariaLabel);
      if (opts?.label) {
        btn.textContent = opts.label;
      } else if (iconSrc) {
        const img = document.createElement("img");
        img.className = "mobile-hud-btn-icon";
        img.src = iconSrc;
        img.alt = "";
        img.draggable = false;
        btn.appendChild(img);
      }
      btn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.releaseStolenTouchInput({ swallowTapMs: 280 });
        if (!opts?.skipCloseChat && this.chatOpen) this.closeChatBar();
        onClick();
      });
      // Touch on HUD also hits Phaser via window listeners — clear immediately.
      btn.addEventListener(
        "pointerdown",
        () => this.releaseStolenTouchInput(),
        { capture: true },
      );
      return btn;
    };

    if (IS_MOBILE) {
      this.mobileAimBtn = makeBtn(
        "mobile-aim-btn",
        getItemIconPath("crosshair"),
        "Toggle aim",
        () => {
          this.mobileAimLatched = !this.mobileAimLatched && this.canHoldAimStance();
          this.handleAimInput();
          this.refreshMobileAimButton();
        },
      );
      this.mobileAimBtn.hidden = true;
    }
    this.mobileReloadBtn = makeBtn(
      "mobile-reload-btn",
      undefined,
      "Reload weapon",
      () => this.requestReload(),
    );
    this.mobileReloadBtn.hidden = true;
    this.mobileBuildBtn = makeBtn(
      "mobile-build-btn",
      getItemIconPath("build"),
      "Toggle build mode",
      () => this.toggleStructureBuildMode(),
    );
    this.mobileBuildBtn.hidden = true;
    this.mobileMapBtn = makeBtn(
      "mobile-map-btn",
      getItemIconPath("map"),
      "Open map",
      () => this.toggleMapOverlay(),
    );
    this.mobileMapBtn.hidden = true;
    this.mobileJournalBtn = makeBtn(
      "mobile-journal-btn",
      getItemIconPath("journal"),
      "Open journal",
      () => this.toggleJournalOverlay(),
    );
    this.mobileInventoryBtn = makeBtn(
      "mobile-inventory-btn",
      getItemIconPath("backpack"),
      "Open inventory",
      () => this.toggleInventoryOverlay(),
    );

    this.mobileChatBtn = makeBtn(
      "mobile-chat-btn",
      getItemIconPath("chat"),
      "Open chat",
      () => {
        if (this.chatOpen) this.closeChatBar();
        else this.openChatBar();
      },
      { skipCloseChat: true },
    );

    const combatButtons = [
      this.mobileAimBtn,
      this.mobileReloadBtn,
      this.mobileBuildBtn,
    ].filter((el): el is HTMLButtonElement => !!el);
    const utilityButtons = [
      this.mobileMapBtn,
      this.mobileJournalBtn,
      this.mobileInventoryBtn,
      this.mobileChatBtn,
    ].filter((el): el is HTMLButtonElement => !!el);
    for (const btn of combatButtons) btn.classList.add("mobile-hud-btn--combat");
    for (const btn of utilityButtons) btn.classList.add("mobile-hud-btn--utility");

    const combatGroup = document.createElement("div");
    combatGroup.className = "mobile-hud-group mobile-hud-combat";
    combatGroup.append(...combatButtons);
    const utilityGroup = document.createElement("div");
    utilityGroup.className = "mobile-hud-group mobile-hud-utility";
    utilityGroup.append(...utilityButtons);
    // Combat group first so desktop keeps aim/reload above the menus.
    // Mobile CSS reverses the groups so the fight buttons sit under the thumb.
    stack.append(combatGroup, utilityGroup);

    document.body.appendChild(stack);
    this.mobileHudEl = stack;
    this.setupMoveStick();
    this.refreshMobileActionButtons();
  }

  /** Bottom-left thumb stick. Feeds the same 8-way walk path as WASD. */
  private setupMoveStick() {
    if (!IS_MOBILE || this.moveStickEl) return;

    const root = document.createElement("div");
    root.id = "move-stick";
    root.setAttribute("aria-label", "Move");

    const base = document.createElement("div");
    base.className = "move-stick-base";
    const knob = document.createElement("div");
    knob.className = "move-stick-knob";
    base.appendChild(knob);
    root.appendChild(base);
    document.body.appendChild(root);
    this.moveStickEl = root;
    this.moveStickKnob = knob;

    const onDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      if (this.moveStickPointerId !== null) return;
      if (this.isOverlayOpen() || this.chatOpen) return;
      event.preventDefault();
      event.stopPropagation();
      this.moveStickPointerId = event.pointerId;
      root.classList.add("move-stick--active");
      root.setPointerCapture(event.pointerId);
      this.releaseStolenTouchInput();
      this.updateMoveStick(event);
    };
    const onMove = (event: PointerEvent) => {
      if (event.pointerId !== this.moveStickPointerId) return;
      event.preventDefault();
      this.updateMoveStick(event);
    };
    const onUp = (event: PointerEvent) => {
      if (event.pointerId !== this.moveStickPointerId) return;
      this.releaseMoveStick();
    };

    root.addEventListener("pointerdown", onDown);
    root.addEventListener("pointermove", onMove);
    root.addEventListener("pointerup", onUp);
    root.addEventListener("pointercancel", onUp);
    root.addEventListener("lostpointercapture", onUp);
    root.addEventListener("contextmenu", (event) => event.preventDefault());
  }

  private updateMoveStick(event: PointerEvent) {
    const base = this.moveStickEl?.querySelector(".move-stick-base");
    const knob = this.moveStickKnob;
    if (!(base instanceof HTMLElement) || !knob) return;

    const rect = base.getBoundingClientRect();
    const dx = event.clientX - (rect.left + rect.width / 2);
    const dy = event.clientY - (rect.top + rect.height / 2);
    const radius = Math.max(1, (rect.width - knob.offsetWidth) / 2);
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(dist, radius);
    const angle = Math.atan2(dy, dx);
    const kx = Math.cos(angle) * clamped;
    const ky = Math.sin(angle) * clamped;
    knob.style.transform = `translate(${kx}px, ${ky}px)`;

    const nx = kx / radius;
    const ny = ky / radius;
    const mag = Math.hypot(nx, ny);
    this.moveStickX = nx;
    this.moveStickY = ny;
    const sprint = mag >= WorldScene.MOVE_STICK_SPRINT;
    this.moveStickSprint = sprint;
    this.moveStickEl?.classList.toggle("move-stick--sprint", sprint);
  }

  private releaseMoveStick() {
    const pointerId = this.moveStickPointerId;
    this.moveStickPointerId = null;
    this.moveStickX = 0;
    this.moveStickY = 0;
    this.moveStickSprint = false;
    if (this.moveStickKnob) this.moveStickKnob.style.transform = "";
    this.moveStickEl?.classList.remove("move-stick--sprint", "move-stick--active");
    if (pointerId !== null && this.moveStickEl?.hasPointerCapture(pointerId)) {
      this.moveStickEl.releasePointerCapture(pointerId);
    }
  }

  /** 8-way screen vector from the thumb stick. Zero inside the dead zone. */
  private readMoveStickVector(): { screenDx: number; screenDy: number } {
    if (this.moveStickPointerId === null) {
      return { screenDx: 0, screenDy: 0 };
    }
    const mag = Math.hypot(this.moveStickX, this.moveStickY);
    if (mag < WorldScene.MOVE_STICK_DEADZONE) {
      return { screenDx: 0, screenDy: 0 };
    }
    const sector = Math.round(Math.atan2(this.moveStickY, this.moveStickX) / (Math.PI / 4));
    const steps: ReadonlyArray<readonly [number, number]> = [
      [1, 0],
      [1, 1],
      [0, 1],
      [-1, 1],
      [-1, 0],
      [-1, -1],
      [0, -1],
      [1, -1],
    ];
    const step = steps[((sector % 8) + 8) % 8] ?? [0, 0];
    return { screenDx: step[0], screenDy: step[1] };
  }

  /** Mobile stand-in for holding CTRL. Melee shows the weapon icon instead of a crosshair. */
  private refreshMobileAimButton() {
    const btn = this.mobileAimBtn;
    if (!btn) return;
    if (!IS_MOBILE) {
      btn.hidden = true;
      return;
    }
    const me = this.room?.state?.players?.get(this.sessionId);
    const equippedIndex =
      this.localInventorySync?.equippedWeaponIndex ??
      me?.equippedWeaponIndex ??
      -1;
    const weapon = equippedIndex >= 0 ? WEAPONS[equippedIndex] : undefined;
    const melee = !!weapon && isMeleeWeapon(weapon);
    btn.hidden = !weapon;
    btn.classList.toggle("mobile-hud-btn--active", this.aimHeld);
    btn.setAttribute("aria-pressed", this.aimHeld ? "true" : "false");
    if (!weapon) {
      this.mobileAimIconId = "";
      btn.replaceChildren();
      return;
    }
    const iconId = melee ? weapon.itemId : "crosshair";
    const label = melee ? `Aim ${weapon.name}` : "Toggle aim";
    btn.setAttribute("aria-label", label);
    if (iconId === this.mobileAimIconId && btn.querySelector("img")) return;
    this.mobileAimIconId = iconId;
    const path = getItemIconPath(iconId);
    btn.replaceChildren();
    if (!path) return;
    const img = document.createElement("img");
    img.className = "mobile-hud-btn-icon";
    img.src = path;
    img.alt = "";
    img.draggable = false;
    btn.appendChild(img);
  }

  /** Show reload for ranged weapons, build while a hammer is equipped, map when inventory has a map. */
  private refreshMobileActionButtons() {
    if (this.mobileMapBtn) {
      this.mobileMapBtn.hidden = !this.playerHasMapItem();
    }
    if (this.mobileBuildBtn) {
      this.mobileBuildBtn.hidden = !this.playerHasHammerEquipped();
    }
    this.closeStructureBuildWithoutHammer();

    this.refreshMobileAimButton();

    const btn = this.mobileReloadBtn;
    if (!btn) return;

    const me = this.room?.state?.players?.get(this.sessionId);
    const sync = this.localInventorySync;
    const equippedIndex =
      sync?.equippedWeaponIndex ?? me?.equippedWeaponIndex ?? -1;
    const weapon = equippedIndex >= 0 ? WEAPONS[equippedIndex] : undefined;
    const canReload = !!weapon && !isMeleeWeapon(weapon);

    btn.hidden = !canReload;
    if (!canReload) {
      this.mobileReloadAmmoIconId = "";
      btn.replaceChildren();
      return;
    }

    const ammoId = getAmmoTypeForWeapon(weapon.itemId) ?? "";
    if (ammoId === this.mobileReloadAmmoIconId && btn.querySelector("img")) {
      return;
    }
    this.mobileReloadAmmoIconId = ammoId;
    const path = ammoId ? getItemIconPath(ammoId) : undefined;
    btn.replaceChildren();
    if (path) {
      const img = document.createElement("img");
      img.className = "mobile-hud-btn-icon";
      img.src = path;
      img.alt = "";
      img.draggable = false;
      btn.appendChild(img);
    }
  }

  /** True when the hammer is the weapon currently in hand. */
  private playerHasHammerEquipped(): boolean {
    const me = this.room?.state?.players?.get(this.sessionId);
    const equipped =
      this.localInventorySync?.equippedWeaponIndex ??
      me?.equippedWeaponIndex ??
      -1;
    return equipped === weaponIndexFromItemId("weapon_hammer");
  }

  /**
   * Build mode stays up only while the hammer is equipped. Hide it immediately
   * and tell the server once; further frames wait for that reply.
   */
  private closeStructureBuildWithoutHammer() {
    if (!this.structureBuildMode || this.playerHasHammerEquipped()) {
      this.structureBuildCloseSent = false;
      return;
    }
    if (this.structureBuildCloseSent || !this.room) return;
    this.structureBuildCloseSent = true;
    this.structureBuildMode = false;
    document.body.classList.remove("build-mode-open");
    this.updateStructureBuildHud();
    if (this.deconstructUI?.isOpen()) this.closeDeconstructUI();
    this.clearBuildModePreview();
    if (!this.buildMode) this.game.canvas.style.cursor = "";
    const message: ClientMessage = { type: "toggleStructureBuild" };
    this.room.send("action", message);
  }

  /** Tab / mobile inventory button — shared open/close path. */
  private toggleInventoryOverlay() {
    if (this.traderUI?.isOpen()) {
      this.closeTraderUI();
      return;
    }
    if (this.playerMarketUI?.isOpen()) {
      this.closePlayerMarketUI();
      return;
    }
    if (this.redOrderDialogUI?.isOpen()) {
      this.closeRedOrderDialog();
      return;
    }
    if (this.ashenTraderDialogUI?.isOpen()) {
      this.closeAshenTraderDialog();
      return;
    }
    if (this.ashenMilitiaDialogUI?.isOpen()) {
      this.closeAshenMilitiaDialog();
      return;
    }
    if (this.containerLootUI?.isOpen()) {
      this.containerLootUI.close();
      return;
    }
    if (this.craftUI?.isOpen()) {
      this.closeCraftUI();
      return;
    }
    if (this.fireplaceUI?.isOpen()) {
      this.closeFireplaceUI();
      return;
    }
    if (this.prefabDepositUI?.isOpen()) {
      this.closePrefabUI();
      return;
    }
    if (this.deconstructUI?.isOpen()) {
      this.closeDeconstructUI();
      return;
    }
    if (this.journalUI?.isOpen()) this.journalUI.close();
    if (this.mapOverlayUI?.isOpen()) this.mapOverlayUI.close();
    const wasOpen = this.inventoryUI?.isOpen() ?? false;
    this.inventoryUI?.toggle();
    if (!wasOpen) {
      this.lastInventoryRenderKey = "";
      this.refreshInventoryUI();
    } else {
      this.lastInventoryRenderKey = "";
    }
  }

  /** M / mobile map button. */
  private toggleMapOverlay() {
    if (this.chatOpen) return;
    if (this.mapOverlayUI?.isOpen()) {
      this.mapOverlayUI.close();
      this.mapSettlementCache = null;
      AudioManager.get().play("ui_close");
      return;
    }
    if (!this.playerHasMapItem()) return;
    if (this.inventoryUI?.isOpen()) this.inventoryUI.close();
    if (this.journalUI?.isOpen()) this.journalUI.close();
    if (this.traderUI?.isOpen()) this.closeTraderUI();
    if (this.playerMarketUI?.isOpen()) this.closePlayerMarketUI();
    if (this.redOrderDialogUI?.isOpen()) this.closeRedOrderDialog();
    if (this.ashenTraderDialogUI?.isOpen()) this.closeAshenTraderDialog();
    if (this.ashenMilitiaDialogUI?.isOpen()) this.closeAshenMilitiaDialog();
    if (this.containerLootUI?.isOpen()) this.containerLootUI.close();
    if (this.craftUI?.isOpen()) this.closeCraftUI();
    if (this.fireplaceUI?.isOpen()) this.closeFireplaceUI();
    if (this.prefabDepositUI?.isOpen()) this.closePrefabUI();
    this.mapSettlementCache = null;
    this.mapOverlayUI?.open();
    AudioManager.get().play("ui_open");
    this.notifyTutorial("map");
    this.refreshMapOverlay();
  }

  /** J / HUD journal button. */
  private toggleJournalOverlay() {
    if (this.chatOpen) return;
    if (this.journalUI?.isOpen()) {
      this.journalUI.close();
      return;
    }
    if (this.inventoryUI?.isOpen()) this.inventoryUI.close();
    if (this.journalUI?.isOpen()) this.journalUI.close();
    if (this.mapOverlayUI?.isOpen()) this.mapOverlayUI.close();
    if (this.traderUI?.isOpen()) this.closeTraderUI();
    if (this.playerMarketUI?.isOpen()) this.closePlayerMarketUI();
    if (this.redOrderDialogUI?.isOpen()) this.closeRedOrderDialog();
    if (this.ashenTraderDialogUI?.isOpen()) this.closeAshenTraderDialog();
    if (this.ashenMilitiaDialogUI?.isOpen()) this.closeAshenMilitiaDialog();
    if (this.containerLootUI?.isOpen()) this.containerLootUI.close();
    if (this.craftUI?.isOpen()) this.closeCraftUI();
    if (this.fireplaceUI?.isOpen()) this.closeFireplaceUI();
    if (this.prefabDepositUI?.isOpen()) this.closePrefabUI();
    if (this.deconstructUI?.isOpen()) this.closeDeconstructUI();
    this.refreshQuestPanels();
    this.journalUI?.open();
  }

  private setupChatBar() {
    this.chatBarEl = document.getElementById("chat-bar");
    this.chatInputEl = document.getElementById("chat-input") as HTMLInputElement | null;
    const chatSendEl = document.getElementById("chat-send");

    // Enter key on the canvas/document opens the chat bar
    document.addEventListener("keydown", this.onDocumentKeyDown);
    // Phaser preventDefault on captured keys (hotbar 1 and 2, unequip 0) otherwise
    // eats those digits before a number field can show them.
    document.addEventListener("keydown", this.onFieldKeyDown);
    document.addEventListener("keyup", this.onFieldKeyUp);

    const submitChat = () => {
      const text = this.chatInputEl?.value.trim() ?? "";
      this.closeChatBar();
      if (text) this.sendChatMessage(text);
    };

    this.chatInputEl?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        submitChat();
      } else if (e.key === "Escape") {
        e.preventDefault();
        this.closeChatBar();
      }
      // Prevent game keys from firing while typing
      e.stopPropagation();
    });

    chatSendEl?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      submitChat();
    });

    if (IS_MOBILE && chatSendEl) {
      chatSendEl.textContent = "Send";
    }
  }

  private isTextField(target: EventTarget | null): boolean {
    return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
  }

  /** Keep typed keys in the field. Escape still closes the open dialog. */
  private readonly onFieldKeyDown = (event: KeyboardEvent) => {
    if (!this.isTextField(event.target) || event.key === "Escape") return;
    event.stopPropagation();
  };

  private readonly onFieldKeyUp = (event: KeyboardEvent) => {
    if (!this.isTextField(event.target)) return;
    event.stopPropagation();
  };

  private readonly onDocumentKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape" && !e.repeat) {
      // Progress-bar actions first — Esc aborts Wear/Reload/Search/etc.
      if (this.cancelProgressBarAction()) {
        e.preventDefault();
        return;
      }
      // Death stays up until Respawn. Do not open the controls legend over it.
      if (this.deathScreenUI?.isOpen()) {
        e.preventDefault();
        return;
      }
      if (this.mapOverlayUI?.isOpen()) {
        e.preventDefault();
        this.mapOverlayUI.close();
        this.mapSettlementCache = null;
        AudioManager.get().play("ui_close");
        return;
      }
      if (this.doorCodeUI?.isOpen()) {
        e.preventDefault();
        this.doorCodeUI.close();
        return;
      }
      if (this.onboardingUI?.isOpen()) {
        e.preventDefault();
        this.onboardingUI.closeTopmost();
        return;
      }
      if (this.redOrderDialogUI?.isOpen()) {
        e.preventDefault();
        this.closeRedOrderDialog();
        return;
      }
      if (this.ashenTraderDialogUI?.isOpen()) {
        e.preventDefault();
        this.closeAshenTraderDialog();
        return;
      }
      if (this.ashenMilitiaDialogUI?.isOpen()) {
        e.preventDefault();
        this.closeAshenMilitiaDialog();
        return;
      }
      if (this.traderUI?.isOpen()) {
        e.preventDefault();
        this.closeTraderUI();
        return;
      }
      if (this.playerMarketUI?.isOpen()) {
        e.preventDefault();
        this.closePlayerMarketUI();
        return;
      }
      if (this.containerLootUI?.isOpen()) {
        e.preventDefault();
        this.containerLootUI.close();
        return;
      }
      if (this.craftUI?.isOpen()) {
        e.preventDefault();
        this.closeCraftUI();
        return;
      }
      if (this.fireplaceUI?.isOpen()) {
        e.preventDefault();
        this.closeFireplaceUI();
        return;
      }
      if (this.prefabDepositUI?.isOpen()) {
        e.preventDefault();
        this.closePrefabUI();
        return;
      }
      if (this.deconstructUI?.isOpen()) {
        e.preventDefault();
        this.closeDeconstructUI();
        return;
      }
      if (this.journalUI?.isOpen()) {
        e.preventDefault();
        this.journalUI.close();
        return;
      }
      if (this.inventoryUI?.isOpen()) {
        e.preventDefault();
        this.inventoryUI.close();
        return;
      }
      if (this.factionAttackWarningUI?.isOpen()) {
        e.preventDefault();
        this.factionAttackWarningUI.close();
        return;
      }
      if (this.chatOpen) {
        e.preventDefault();
        this.closeChatBar();
        return;
      }
      if (this.structureBuildMode) {
        e.preventDefault();
        this.toggleStructureBuildMode();
        return;
      }
      // Nothing open: controls legend, and stop the current path or fight.
      e.preventDefault();
      this.onboardingUI?.openLegend();
      this.clearCombatTarget();
      this.clearInteractTarget();
      this.clearLootTarget();
      this.stopPlayerMovement();
      return;
    }
    if (this.chatOpen) return;
    // Don't open chat when inventory or other overlays are active
    if (this.isOverlayOpen()) return;
    if (e.key === "Enter" && !e.repeat) {
      e.preventDefault();
      this.openChatBar();
    }
  };

  private openChatBar() {
    if (!this.chatBarEl || !this.chatInputEl) return;
    if (this.isOverlayOpen()) return;
    this.chatOpen = true;
    this.chatBarEl.classList.add("chat-bar--open");
    document.body.classList.add("chat-open");
    this.chatInputEl.value = "";
    // Small delay so the Enter keypress doesn't bubble into the input
    setTimeout(() => this.chatInputEl?.focus(), 30);
  }

  private closeChatBar() {
    if (!this.chatBarEl) return;
    this.chatOpen = false;
    this.chatBarEl.classList.remove("chat-bar--open");
    document.body.classList.remove("chat-open");
    this.chatInputEl?.blur();
    document.removeEventListener("keydown", this.onDocumentKeyDown);
    // Re-attach so it works for subsequent uses
    document.addEventListener("keydown", this.onDocumentKeyDown);
  }

  private sendChatMessage(text: string) {
    if (!this.room) return;
    this.room.send("chat", { text });
  }

  private showRadioCaption(text: string, action = false) {
    let el = document.getElementById("radio-caption");
    if (!el) {
      el = document.createElement("div");
      el.id = "radio-caption";
      document.body.appendChild(el);
    }
    el.textContent = text;
    el.classList.toggle("is-action", action);
    el.classList.add("is-on");
    window.setTimeout(() => {
      if (el?.textContent === text) el.classList.remove("is-on");
    }, 4500);
  }

  private showChatBubble(senderId: string, text: string, action = false) {
    const radio = text.startsWith(WorldScene.RADIO_BUBBLE_PREFIX);
    const body = radio ? text.slice(WorldScene.RADIO_BUBBLE_PREFIX.length) : text;
    if (!this.sys?.isActive()) return;
    const iconSrc = action
      ? undefined
      : getItemIconPath(radio ? "handheld_radio" : "chat");
    this.mountChatBubble(senderId, body, action, iconSrc ?? null);
  }

  private destroyChatBubble(bubble: {
    root: Phaser.GameObjects.Container;
    iconEl: HTMLElement | null;
  }) {
    bubble.iconEl?.remove();
    bubble.root.destroy();
  }

  private mountChatBubble(
    senderId: string,
    text: string,
    action: boolean,
    iconSrc: string | null,
  ) {
    const existing = this.chatBubbles.get(senderId);
    if (existing) {
      this.destroyChatBubble(existing);
      this.chatBubbles.delete(senderId);
    }

    const bubbleText = this.add.text(0, 0, text, {
      fontSize: action ? "11px" : "13px",
      fontFamily: "system-ui, sans-serif",
      fontStyle: action ? "italic" : "normal",
      color: action ? "#b7bdb4" : "#e8f8e8",
      shadow: { color: "#000", blur: 4, fill: true },
      wordWrap: { width: 220, useAdvancedWrap: true },
      align: iconSrc ? "left" : "center",
      maxLines: 3,
    });
    bubbleText.setOrigin(0, 0.5);

    const bg = this.add.graphics();
    const root = this.add.container(0, 0, [bg, bubbleText]);
    root.setDepth(9_999_999);

    let iconEl: HTMLElement | null = null;
    if (iconSrc) {
      const wrap = document.createElement("span");
      wrap.className = "chat-bubble-icon loot-item-icon-wrap";
      const img = document.createElement("img");
      img.className = "loot-item-icon";
      img.src = iconSrc;
      img.alt = "";
      img.draggable = false;
      wrap.appendChild(img);
      wrap.style.visibility = "hidden";
      document.body.appendChild(wrap);
      iconEl = wrap;
    }

    const bubble = {
      root,
      bg,
      label: bubbleText,
      iconEl,
      iconLocalX: 0,
      iconLocalY: 0,
      blockHeight: 0,
      expiresAt: Date.now() + WorldScene.CHAT_BUBBLE_MS,
    };
    this.layoutChatBubble(bubble);
    this.chatBubbles.set(senderId, bubble);
  }

  /**
   * Icon slot matches the popup at max zoom. An HTML image fills that slot
   * so the glyph stays as sharp as the frequency popup and scales with the text.
   */
  private layoutChatBubble(bubble: {
    bg: Phaser.GameObjects.Graphics;
    label: Phaser.GameObjects.Text;
    iconEl: HTMLElement | null;
    iconLocalX: number;
    iconLocalY: number;
    blockHeight: number;
  }) {
    const iconSize = bubble.iconEl
      ? WorldScene.RADIO_BUBBLE_ICON_SCREEN_PX / CAMERA_ZOOM_MAX
      : 0;
    const gap = bubble.iconEl ? 6 : 0;
    const padX = 6;
    const padY = 3;
    const contentW = bubble.label.width + (bubble.iconEl ? iconSize + gap : 0);
    const contentH = Math.max(bubble.label.height, iconSize);
    const totalW = contentW + padX * 2;
    const totalH = contentH + padY * 2;
    const left = -totalW / 2;
    const top = -totalH;
    const midY = top + totalH / 2;

    bubble.bg.clear();
    bubble.bg.fillStyle(0x0a0e0a, 0.78);
    bubble.bg.fillRoundedRect(left, top, totalW, totalH, 3);
    bubble.label.setPosition(
      left + padX + (bubble.iconEl ? iconSize + gap : 0),
      midY,
    );
    if (bubble.iconEl) {
      bubble.iconLocalX = left + padX + iconSize / 2;
      bubble.iconLocalY = midY;
    }
    bubble.blockHeight = totalH;
  }

  /** After the camera updates, pin each HTML glyph to the bubble slot. */
  private placeChatBubbleIcons() {
    for (const bubble of this.chatBubbles.values()) {
      this.placeChatBubbleIcon(bubble, bubble.root.alpha);
    }
  }

  /** Keep the HTML chat or radio glyph on the bubble slot as the camera moves. */
  private placeChatBubbleIcon(
    bubble: {
      root: Phaser.GameObjects.Container;
      iconEl: HTMLElement | null;
      iconLocalX: number;
      iconLocalY: number;
    },
    alpha: number,
  ) {
    const icon = bubble.iconEl;
    if (!icon) return;
    if (!bubble.root.visible) {
      icon.style.visibility = "hidden";
      return;
    }
    const cam = this.cameras.main;
    const canvas = this.game.canvas;
    const rect = canvas.getBoundingClientRect();
    const zoom = cam.zoom || 1;
    const scaleX = canvas.width > 0 ? rect.width / canvas.width : 1;
    const scaleY = canvas.height > 0 ? rect.height / canvas.height : 1;
    const world = WorldScene.RADIO_BUBBLE_ICON_SCREEN_PX / CAMERA_ZOOM_MAX;
    const width = world * zoom * scaleX;
    const height = world * zoom * scaleY;
    const worldX = bubble.root.x + bubble.iconLocalX;
    const worldY = bubble.root.y + bubble.iconLocalY;
    // Match Camera.preRender: scroll is the top-left, zoom is about the origin.
    let scrollX = cam.scrollX;
    let scrollY = cam.scrollY;
    if (cam.roundPixels) {
      scrollX = Math.floor(scrollX);
      scrollY = Math.floor(scrollY);
    }
    const originX = cam.width * cam.originX;
    const originY = cam.height * cam.originY;
    const localX =
      zoom * (worldX - scrollX - originX) + Math.floor(cam.x + originX + 0.5);
    const localY =
      zoom * (worldY - scrollY - originY) + Math.floor(cam.y + originY + 0.5);
    const screenX = rect.left + localX * scaleX;
    const screenY = rect.top + localY * scaleY;
    icon.style.visibility = "visible";
    icon.style.width = `${width}px`;
    icon.style.height = `${height}px`;
    icon.style.left = `${screenX - width / 2}px`;
    icon.style.top = `${screenY - height / 2}px`;
    icon.style.opacity = String(alpha);
  }

  private updateChatBubbles() {
    const now = Date.now();
    for (const [id, bubble] of this.chatBubbles) {
      const remaining = bubble.expiresAt - now;
      if (remaining <= 0) {
        this.destroyChatBubble(bubble);
        this.chatBubbles.delete(id);
        continue;
      }

      // Fade out during the last CHAT_BUBBLE_FADE_MS
      const alpha = remaining < WorldScene.CHAT_BUBBLE_FADE_MS
        ? remaining / WorldScene.CHAT_BUBBLE_FADE_MS
        : 1;
      bubble.root.setAlpha(alpha);

      // Position above the player/zombie sprite
      const sprite = this.getEntitySprite(id);
      if (!sprite || !sprite.visible) {
        bubble.root.setVisible(false);
        continue;
      }
      bubble.root.setVisible(true);
      // sprite.y is the feet position; head is ENTITY_RENDER_HEIGHT px above
      bubble.root.setPosition(sprite.x, sprite.y - ENTITY_RENDER_HEIGHT - 8);
    }
  }

  /** Italic action captions above players/guards (reload, search, bandage, eat, …). */
  private updateEntityActionLabels() {
    if (!this.entityActionLabels || !this.room?.state) return;

    const now = Date.now();

    if (this.room.state.players) {
      for (const [id, sprite] of this.playerSprites) {
        const player = this.room.state.players.get(id);
        if (!player) continue;

        const chat = this.chatBubbles.get(id);
        const stackBelowPx =
          chat && chat.root.visible && chat.root.alpha > 0
            ? chat.blockHeight + 4
            : 0;

        const data = sprite.getData("server") as { inInterior?: boolean } | undefined;
        const visible =
          !!sprite.visible &&
          this.entityVisible("player", data ?? player, id);
        const labelSprite = visible ? sprite : null;
        const alive = player.alive;

        const searching =
          alive && !!player.searchTargetId && player.searchEndTime > now;

        this.entityActionLabels.sync(
          id,
          "reload",
          alive && player.isReloading,
          labelSprite,
          stackBelowPx,
        );
        this.entityActionLabels.sync(
          id,
          "unload",
          alive && player.isUnloading,
          labelSprite,
          stackBelowPx,
        );
        this.entityActionLabels.sync(
          id,
          "search",
          searching,
          labelSprite,
          stackBelowPx,
        );

        const consumeKind =
          player.consumeAction === "drink"
            ? "drink"
            : player.consumeAction === "bandage"
              ? "bandage"
              : player.consumeAction === "use"
                ? "use"
                : player.consumeAction === "learn"
                  ? "learn"
                  : player.consumeAction === "read"
                    ? "read"
                    : "eat";
        const consuming =
          alive && player.isConsuming && player.consumeEndTime > now;

        this.entityActionLabels.sync(
          id,
          "eat",
          consuming && consumeKind === "eat",
          labelSprite,
          stackBelowPx,
        );
        this.entityActionLabels.sync(
          id,
          "drink",
          consuming && consumeKind === "drink",
          labelSprite,
          stackBelowPx,
        );
        this.entityActionLabels.sync(
          id,
          "bandage",
          consuming && consumeKind === "bandage",
          labelSprite,
          stackBelowPx,
        );
        this.entityActionLabels.sync(
          id,
          "use",
          consuming && consumeKind === "use",
          labelSprite,
          stackBelowPx,
        );
        this.entityActionLabels.sync(
          id,
          "learn",
          consuming && consumeKind === "learn",
          labelSprite,
          stackBelowPx,
        );
        this.entityActionLabels.sync(
          id,
          "read",
          consuming && consumeKind === "read",
          labelSprite,
          stackBelowPx,
        );
        this.entityActionLabels.sync(
          id,
          "craft",
          alive && player.isCrafting && player.craftEndTime > now,
          labelSprite,
          stackBelowPx,
        );
        this.entityActionLabels.sync(
          id,
          "build",
          alive && player.isBuilding && player.buildEndTime > now,
          labelSprite,
          stackBelowPx,
        );

        const changingClothes =
          alive &&
          player.isChangingClothes &&
          player.clothingChangeEndTime > now;
        const clothingKind =
          player.clothingChangeAction === "remove" ? "remove" : "wear";
        this.entityActionLabels.sync(
          id,
          "wear",
          changingClothes && clothingKind === "wear",
          labelSprite,
          stackBelowPx,
        );
        this.entityActionLabels.sync(
          id,
          "remove",
          changingClothes && clothingKind === "remove",
          labelSprite,
          stackBelowPx,
        );
      }
    }

    if (this.room.state.guards) {
      for (const [id, sprite] of this.guardSprites) {
        const guard = this.room.state.guards.get(id);
        if (!guard) continue;

        const data = sprite.getData("server") as
          | {
              reloadEndTime?: number;
              x?: number;
              y?: number;
              alive?: boolean;
              inInterior?: boolean;
            }
          | undefined;
        const visible =
          !!sprite.visible && this.entityVisible("guard", data ?? guard, id);
        const reloading =
          guard.alive && (guard.reloadEndTime ?? data?.reloadEndTime ?? 0) > now;

        this.entityActionLabels.sync(
          id,
          "reload",
          reloading,
          visible ? sprite : null,
          0,
        );
      }
    }

    this.entityActionLabels.followSprites((entityId) => this.getEntitySprite(entityId));
  }

  /**
   * Free-aim round that stopped on cover or bare ground. Only drawn when the
   * impact happened in the same space the local player is standing in.
   */
  private handleBulletImpact(payload: BulletImpactEvent["payload"]) {
    const me = this.room?.state?.players?.get(this.sessionId);
    if (!me) return;
    if (payload.inInterior !== me.inInterior) return;
    if (
      payload.inInterior &&
      (payload.buildingX !== me.buildingX || payload.buildingY !== me.buildingY)
    ) {
      return;
    }
    // The round travels at bullet height, so the burst belongs up there too:
    // on cover it lands on the face, in the open it lands under the cursor.
    // Cover also needs a depth nudge or it sorts into the wall it just hit.
    const onCover = payload.surface !== "ground";
    this.spawnMissImpact(payload.x, payload.y, "", payload.weaponIndex, false, {
      screenLift: PLAYER_AIM_HEAD_LIFT_PX,
      depthBias: onCover ? 2 : 0,
    });
  }

  /**
   * Gunshot tracer: off-white line that draws from the muzzle to the impact,
   * then vanishes toward that point. The whole flash is ~0.1s.
   */
  private handleShotTrace(payload: ShotTraceEvent["payload"]) {
    const me = this.room?.state?.players?.get(this.sessionId);
    if (!me) return;
    if (payload.inInterior !== me.inInterior) return;
    if (
      payload.inInterior &&
      (payload.buildingX !== me.buildingX || payload.buildingY !== me.buildingY)
    ) {
      return;
    }

    const from = bulletHeightScreenPos(payload.originX, payload.originY);
    const to = bulletHeightScreenPos(payload.endX, payload.endY);
    const g = this.add.graphics().setDepth(9_999_996);
    const state = { p: 0 };
    const drawMs = 25;
    const fadeMs = 25;
    const totalMs = drawMs + fadeMs;
    const drawEnd = drawMs / totalMs;

    const redraw = () => {
      const p = state.p;
      let ax: number;
      let ay: number;
      let bx: number;
      let by: number;
      let alpha: number;
      if (p <= drawEnd) {
        const u = p / drawEnd;
        ax = from.x;
        ay = from.y;
        bx = from.x + (to.x - from.x) * u;
        by = from.y + (to.y - from.y) * u;
        alpha = u * 0.5;
      } else {
        const u = (p - drawEnd) / (1 - drawEnd);
        ax = from.x + (to.x - from.x) * u;
        ay = from.y + (to.y - from.y) * u;
        bx = to.x;
        by = to.y;
        alpha = (1 - u) * 0.25;
      }
      g.clear();
      if (alpha <= 0.02) return;
      g.lineStyle(1.5, 0xf3efe6, alpha);
      g.beginPath();
      g.moveTo(ax, ay);
      g.lineTo(bx, by);
      g.strokePath();
    };

    const tween = this.tweens.add({
      targets: state,
      p: 1,
      duration: totalMs,
      ease: "Linear",
      onUpdate: redraw,
      onComplete: () => {
        const i = this.shotTraceFx.findIndex((fx) => fx.g === g);
        if (i >= 0) this.shotTraceFx.splice(i, 1);
        g.destroy();
      },
    });

    this.shotTraceFx.push({ g, tween });
    while (this.shotTraceFx.length > WorldScene.SHOT_TRACE_MAX) {
      const old = this.shotTraceFx.shift();
      if (!old) break;
      old.tween.stop();
      old.g.destroy();
    }
  }

  private clearShotTraces() {
    for (const fx of this.shotTraceFx) {
      fx.tween.stop();
      fx.g.destroy();
    }
    this.shotTraceFx = [];
  }

  /** Dust burst + brief ground flash for a missed shot. */
  private spawnMissImpact(
    worldX: number,
    worldY: number,
    targetId: string,
    weaponIndex: number,
    onTree = false,
    opts?: { screenLift?: number; depthBias?: number },
  ) {
    const cfg = MISS_DUST_BY_WEAPON[weaponIndex] ?? MISS_DUST_BY_WEAPON[-1]!;
    const iso = cartesianToIso(worldX, worldY);
    const targetSprite = this.getEntitySprite(targetId);
    const me = this.room?.state?.players?.get(this.sessionId);
    const baseDepth = onTree
      ? overworldEntityRenderDepth(worldX, worldY)
      : (targetSprite?.depth ??
        (me?.inInterior
          ? this.interiorEntityDepth(worldX, worldY)
          : overworldEntityRenderDepth(worldX, worldY)));
    const depth = baseDepth - 1 + (opts?.depthBias ?? 0);
    const screenX = iso.x;
    const screenY = entityFeetY(iso.y) - 10 - (opts?.screenLift ?? 0);

    if (this.textures.exists("bullet-impact")) {
      const flash = this.add.sprite(screenX, screenY, "bullet-impact");
      flash.setOrigin(0.5, 0.5);
      flash.setScale(cfg.flashScale);
      flash.setDepth(depth);
      flash.setAlpha(0.9);
      this.tweens.add({
        targets: flash,
        alpha: 0,
        scale: cfg.flashScale * 1.65,
        duration: Math.min(320, cfg.destroyAfter * 0.55),
        onComplete: () => flash.destroy(),
      });
    }

    this.spawnImpactDust(
      screenX,
      screenY,
      depth,
      worldX,
      worldY,
      targetId,
      cfg,
    );
  }

  private spawnImpactDust(
    screenX: number,
    screenY: number,
    depth: number,
    worldX: number,
    worldY: number,
    targetId: string,
    cfg: MissDustConfig,
  ) {
    if (!this.textures.exists("dust-particle")) return;

    let baseAngle = 270;
    const targetSprite = this.getEntitySprite(targetId);
    const server = targetSprite?.getData("server") as
      | { x: number; y: number }
      | undefined;
    if (server) {
      const dx = worldX - server.x;
      const dy = worldY - server.y;
      if (Math.hypot(dx, dy) > 0.01) {
        baseAngle = Phaser.Math.RadToDeg(Math.atan2(dy, dx));
      }
    }

    const dustTint = [0xc8b898, 0xa89070, 0xd8ccb4, 0x908070, 0xe0d4bc];

    const burst = this.add.particles(screenX, screenY, "dust-particle", {
      speed: cfg.speed,
      angle: {
        min: baseAngle - cfg.coneHalfWidth,
        max: baseAngle + cfg.coneHalfWidth,
      },
      scale: cfg.scale,
      alpha: { start: 0.75, end: 0 },
      lifespan: cfg.lifespan,
      gravityY: cfg.burstGravityY,
      rotate: { min: 0, max: 360 },
      tint: dustTint,
      emitting: false,
    });
    burst.setDepth(depth);
    burst.explode(cfg.burstCount);

    const mistSpeed = {
      min: cfg.speed.min * cfg.mistSpeedScale,
      max: cfg.speed.max * cfg.mistSpeedScale,
    };
    const mistAngle = cfg.mistUpwardFan
      ? { min: 220, max: 320 }
      : {
          min: baseAngle - cfg.coneHalfWidth * 0.85,
          max: baseAngle + cfg.coneHalfWidth * 0.85,
        };

    const mist = this.add.particles(screenX, screenY - 6, "dust-particle", {
      speed: mistSpeed,
      angle: mistAngle,
      scale: { start: cfg.scale.start * 1.1, end: cfg.scale.end * 1.5 },
      alpha: { start: 0.5, end: 0 },
      lifespan: {
        min: cfg.lifespan.min + 120,
        max: cfg.lifespan.max + 280,
      },
      gravityY: cfg.mistGravityY,
      rotate: { min: 0, max: 360 },
      tint: dustTint,
      emitting: false,
    });
    mist.setDepth(depth - 1);
    mist.explode(cfg.mistCount);

    this.time.delayedCall(cfg.destroyAfter, () => {
      burst.destroy();
      mist.destroy();
    });
  }

  private isOverlayOpen() {
    return (
      (this.inventoryUI?.isOpen() ?? false) ||
      (this.containerLootUI?.isOpen() ?? false) ||
      (this.craftUI?.isOpen() ?? false) ||
      (this.traderUI?.isOpen() ?? false) ||
      (this.playerMarketUI?.isOpen() ?? false) ||
      (this.redOrderDialogUI?.isOpen() ?? false) ||
      (this.ashenTraderDialogUI?.isOpen() ?? false) ||
      (this.ashenMilitiaDialogUI?.isOpen() ?? false) ||
      (this.factionAttackWarningUI?.isOpen() ?? false) ||
      (this.deathScreenUI?.isOpen() ?? false) ||
      (this.onboardingUI?.isOpen() ?? false) ||
      (this.mapOverlayUI?.isOpen() ?? false) ||
      (this.doorCodeUI?.isOpen() ?? false) ||
      (this.fireplaceUI?.isOpen() ?? false) ||
      (this.prefabDepositUI?.isOpen() ?? false) ||
      (this.deconstructUI?.isOpen() ?? false) ||
      (this.journalUI?.isOpen() ?? false)
    );
  }

  private handleInventoryInput() {
    if (this.chatOpen) {
      this.tabWasDown = false;
      this.zeroWasDown = false;
      this.hotbarWasDown.fill(false);
      return;
    }
    const tabDown = this.tabKey?.isDown ?? false;
    if (tabDown && !this.tabWasDown) {
      this.toggleInventoryOverlay();
    }
    this.tabWasDown = tabDown;

    const zeroDown = this.zeroKey?.isDown ?? false;
    if (zeroDown && !this.zeroWasDown) {
      this.unequipWeapon();
    }
    this.zeroWasDown = zeroDown;

    if (!this.isOverlayOpen()) {
      for (let i = 0; i < this.hotbarKeys.length; i++) {
        const down = this.hotbarKeys[i]?.isDown ?? false;
        if (down && !this.hotbarWasDown[i]) {
          this.activateHotbarSlot(i);
        }
        this.hotbarWasDown[i] = down;
      }
    } else {
      this.hotbarWasDown.fill(false);
    }
  }

  private handleMapInput() {
    if (this.chatOpen) {
      this.mapKeyWasDown = false;
      return;
    }
    const mDown = this.mKey?.isDown ?? false;
    if (mDown && !this.mapKeyWasDown) {
      this.toggleMapOverlay();
    }
    this.mapKeyWasDown = mDown;
  }

  private handleJournalInput() {
    if (this.chatOpen) {
      this.journalKeyWasDown = false;
      return;
    }
    const jDown = this.jKey?.isDown ?? false;
    if (jDown && !this.journalKeyWasDown) {
      this.toggleJournalOverlay();
    }
    this.journalKeyWasDown = jDown;
  }

  private handleStructureBuildInput() {
    if (this.chatOpen || this.isOverlayOpen()) {
      this.bKeyWasDown = false;
      this.structureFenceRotateWasDown = false;
      return;
    }
    const bDown = this.bKey?.isDown ?? false;
    if (bDown && !this.bKeyWasDown) {
      this.toggleStructureBuildMode();
    }
    this.bKeyWasDown = bDown;

    const rDown = this.keys?.R?.isDown ?? false;
    if (
      this.structureBuildMode &&
      isStructurePanelKind(this.structureBuildKind) &&
      rDown &&
      !this.structureFenceRotateWasDown
    ) {
      this.structureFenceFacing = nextStructureFenceFacing(
        this.structureFenceFacing,
      );
      this.updateStructureBuildHud();
    }
    this.structureFenceRotateWasDown = rDown;
  }

  private toggleStructureBuildMode() {
    if (!this.room) return;
    // Entering needs the hammer in hand. Exiting (B / Esc / button) always works.
    if (!this.structureBuildMode && !this.playerHasHammerEquipped()) {
      this.lootPopup?.show([], {
        header: "Equip a hammer to build",
      });
      return;
    }
    const message: ClientMessage = { type: "toggleStructureBuild" };
    this.room.send("action", message);
  }

  private setupStructureBuildHud() {
    const hud = document.createElement("div");
    hud.id = "structure-build-hud";
    hud.hidden = true;

    const label = document.createElement("span");
    label.textContent = "Build:";

    const wallBtn = document.createElement("button");
    wallBtn.type = "button";
    wallBtn.className = "structure-build-kind-btn";
    wallBtn.textContent = "Wall";
    wallBtn.addEventListener("click", () => {
      this.structureBuildKind = "wall";
      this.updateStructureBuildHud();
    });

    const doorBtn = document.createElement("button");
    doorBtn.type = "button";
    doorBtn.className = "structure-build-kind-btn";
    doorBtn.textContent = "Door";
    doorBtn.addEventListener("click", () => {
      this.structureBuildKind = "door";
      this.updateStructureBuildHud();
    });

    const fireplaceBtn = document.createElement("button");
    fireplaceBtn.type = "button";
    fireplaceBtn.className = "structure-build-kind-btn";
    fireplaceBtn.textContent = "Fireplace";
    fireplaceBtn.addEventListener("click", () => {
      this.structureBuildKind = "fireplace";
      this.updateStructureBuildHud();
    });

    const fenceBtn = document.createElement("button");
    fenceBtn.type = "button";
    fenceBtn.className = "structure-build-kind-btn";
    fenceBtn.textContent = "Barbed Wire Fence";
    fenceBtn.addEventListener("click", () => {
      this.structureBuildKind = "fence";
      this.updateStructureBuildHud();
    });

    const bargateBtn = document.createElement("button");
    bargateBtn.type = "button";
    bargateBtn.className = "structure-build-kind-btn";
    bargateBtn.textContent = "Bargate";
    bargateBtn.addEventListener("click", () => {
      this.structureBuildKind = "bargate";
      this.updateStructureBuildHud();
    });

    const storageBoxBtn = document.createElement("button");
    storageBoxBtn.type = "button";
    storageBoxBtn.className = "structure-build-kind-btn";
    storageBoxBtn.textContent = "Storage Box";
    storageBoxBtn.addEventListener("click", () => {
      this.structureBuildKind = "storage_box";
      this.updateStructureBuildHud();
    });

    const storageBox2Btn = document.createElement("button");
    storageBox2Btn.type = "button";
    storageBox2Btn.className = "structure-build-kind-btn";
    storageBox2Btn.textContent = "Storage Box 2";
    storageBox2Btn.addEventListener("click", () => {
      this.structureBuildKind = "storage_box_2";
      this.updateStructureBuildHud();
    });

    const deconstructBtn = document.createElement("button");
    deconstructBtn.type = "button";
    deconstructBtn.className =
      "structure-build-kind-btn structure-build-kind-btn--deconstruct";
    deconstructBtn.textContent = "Deconstruct";
    deconstructBtn.addEventListener("click", () => {
      this.structureBuildKind = "deconstruct";
      this.updateStructureBuildHud();
    });

    const cost = document.createElement("span");
    cost.className = "structure-build-cost";

    const hint = document.createElement("span");
    hint.className = "structure-build-hint";
    hint.textContent = "Click a tile to place · B or Esc to exit";

    hud.append(
      label,
      wallBtn,
      doorBtn,
      fireplaceBtn,
      fenceBtn,
      bargateBtn,
      storageBoxBtn,
      storageBox2Btn,
      deconstructBtn,
      cost,
      hint,
    );
    document.body.appendChild(hud);
    this.structureBuildHudEl = hud;
    this.structureBuildWallBtn = wallBtn;
    this.structureBuildDoorBtn = doorBtn;
    this.structureBuildFireplaceBtn = fireplaceBtn;
    this.structureBuildFenceBtn = fenceBtn;
    this.structureBuildBargateBtn = bargateBtn;
    this.structureBuildStorageBoxBtn = storageBoxBtn;
    this.structureBuildStorageBox2Btn = storageBox2Btn;
    this.structureBuildDeconstructBtn = deconstructBtn;
  }

  private updateStructureBuildHud() {
    if (!this.structureBuildHudEl) return;
    this.structureBuildHudEl.hidden = !this.structureBuildMode;
    this.structureBuildWallBtn?.classList.toggle(
      "structure-build-kind-btn--active",
      this.structureBuildKind === "wall",
    );
    this.structureBuildDoorBtn?.classList.toggle(
      "structure-build-kind-btn--active",
      this.structureBuildKind === "door",
    );
    this.structureBuildFireplaceBtn?.classList.toggle(
      "structure-build-kind-btn--active",
      this.structureBuildKind === "fireplace",
    );
    this.structureBuildFenceBtn?.classList.toggle(
      "structure-build-kind-btn--active",
      this.structureBuildKind === "fence",
    );
    this.structureBuildBargateBtn?.classList.toggle(
      "structure-build-kind-btn--active",
      this.structureBuildKind === "bargate",
    );
    this.structureBuildStorageBoxBtn?.classList.toggle(
      "structure-build-kind-btn--active",
      this.structureBuildKind === "storage_box",
    );
    this.structureBuildStorageBox2Btn?.classList.toggle(
      "structure-build-kind-btn--active",
      this.structureBuildKind === "storage_box_2",
    );
    this.structureBuildDeconstructBtn?.classList.toggle(
      "structure-build-kind-btn--active",
      this.structureBuildKind === "deconstruct",
    );
    const hint = this.structureBuildHudEl.querySelector(".structure-build-hint");
    if (hint) {
      hint.textContent =
        this.structureBuildKind === "deconstruct"
          ? "Click your wall, door, fireplace, fence, or storage box to deconstruct · B or Esc to exit"
          : this.structureBuildKind === "door"
            ? "Doors need walls on both sides · B or Esc to exit"
            : this.structureBuildKind === "fireplace"
              ? "Click a tile to place Fireplace · B or Esc to exit"
              : this.structureBuildKind === "storage_box"
                ? "Click a tile to place Storage Box · B or Esc to exit"
              : this.structureBuildKind === "storage_box_2"
                ? "Click a tile to place Storage Box 2 · B or Esc to exit"
              : isStructurePanelKind(this.structureBuildKind)
                ? "R to rotate · 3×1 footprint · B or Esc to exit"
                : "Click a tile to place · B or Esc to exit";
    }
    const cost = this.structureBuildHudEl.querySelector(".structure-build-cost");
    if (cost) {
      if (this.structureBuildKind === "deconstruct") {
        cost.textContent = "Refunds 50% of build materials";
      } else {
        const lines = getStructureBuildCosts(this.structureBuildKind)
          .map((line) => `${line.quantity}× ${getItemDefinition(line.itemId)?.name ?? line.itemId}`)
          .join(", ");
        cost.textContent = `Costs: ${lines}`;
      }
    }
    if (this.structureBuildMode) this.updateBuildModeHover();
  }

  /**
   * Local inventory parsed once per distinct json string, for the readers that
   * run every frame (world clock, hotbar map check).
   *
   * READ ONLY: the array is shared between callers. Anything that edits slots
   * must call {@link parseInventory} itself to get its own copy.
   */
  private readLocalInventory(json: string): ReturnType<typeof parseInventory> {
    const cache = this.parsedLocalInventory;
    if (cache && cache.json === json) return cache.inventory;
    const inventory = parseInventory(json);
    this.parsedLocalInventory = { json, inventory };
    return inventory;
  }

  /** True when the local player has a Map in the Map slot. */
  private playerHasMapItem(): boolean {
    const me = this.room?.state?.players?.get(this.sessionId);
    if (!me) return false;
    const inventoryJson =
      this.localInventorySync?.inventoryJson ?? me.inventoryJson;
    const slot = this.readLocalInventory(inventoryJson)[MAP_SLOT_INDEX];
    return !!slot && isMapItem(slot.id);
  }

  /** Keep charting the map. The open map view is painted ahead of the player. */
  private stepMapChart() {
    const me = this.room?.state?.players?.get(this.sessionId);
    let x = me ? (me.inInterior ? me.overworldX : me.x) : 0;
    let y = me ? (me.inInterior ? me.overworldY : me.y) : 0;
    const mapOpen = this.mapOverlayUI?.isOpen() ?? false;
    if (mapOpen && this.mapOverlayUI) {
      const view = this.mapOverlayUI.viewTileBounds();
      x = (view.minX + view.maxX) / 2;
      y = (view.minY + view.maxY) / 2;
    }
    stepBirchportMapChart(mapOpen ? 8 : 4, x, y);
  }

  private refreshMapOverlay() {
    if (!this.mapOverlayUI?.isOpen()) return;
    if (!this.playerHasMapItem()) {
      this.mapOverlayUI.close();
      return;
    }
    const me = this.room?.state?.players?.get(this.sessionId);
    if (!me) return;

    // Interior coords are local — show the overworld map around the building.
    const centerX = me.inInterior ? me.overworldX : me.x;
    const centerY = me.inInterior ? me.overworldY : me.y;

    const markers: MapOverlayMarker[] = [
      { x: centerX, y: centerY, kind: "self" },
    ];

    this.mapOverlayUI.syncFollow(centerX, centerY);
    const view = this.mapOverlayUI.viewTileBounds();
    const minX = view.minX;
    const maxX = view.maxX;
    const minY = view.minY;
    const maxY = view.maxY;
    const tx = Math.floor((minX + maxX) / 2);
    const ty = Math.floor((minY + maxY) / 2);
    const span = maxX - minX;
    if (
      !this.mapSettlementCache ||
      this.mapSettlementCache.tx !== tx ||
      this.mapSettlementCache.ty !== ty ||
      this.mapSettlementCache.span !== span
    ) {
      this.mapSettlementCache = {
        tx,
        ty,
        span,
        labels: settlementsInTileRegion(minX, maxX, minY, maxY),
      };
    }

    this.mapOverlayUI.render(
      centerX,
      centerY,
      markers,
      this.tileManager?.getMinimapKinds() ?? new Map(),
      this.mapSettlementCache.labels,
      this.activeQuestMapMarkers(),
      this.activeRadioPings(),
    );
  }

  private localRadioFreq(): number {
    const me = this.room?.state?.players?.get(this.sessionId);
    if (!me) return 0;
    const inventoryJson =
      this.localInventorySync?.inventoryJson ?? me.inventoryJson;
    const slot = this.readLocalInventory(inventoryJson)[RADIO_SLOT_INDEX];
    if (!slot || !isRadioItem(slot.id)) return 0;
    return getEntryRadioFreq(slot);
  }

  private activeRadioPings(): RadioPingMarker[] {
    const freq = this.localRadioFreq();
    if (freq !== this.radioPingListenFreq) {
      if (this.radioPingListenFreq !== 0) this.radioPings.clear();
      this.radioPingListenFreq = freq;
    }
    if (freq <= 0) return [];
    const pins: RadioPingMarker[] = [];
    for (const ping of this.radioPings.values()) {
      if (ping.freq !== freq) continue;
      pins.push(ping);
    }
    return pins;
  }

  private activeQuestMapMarkers(): QuestMapMarker[] {
    const json = this.localQuestsJson();
    if (!this.mapQuestMarkerCache || this.mapQuestMarkerCache.json !== json) {
      this.mapQuestMarkerCache = {
        json,
        markers: listActiveQuestMapMarkers(parseQuestsJson(json)),
      };
    }
    return this.mapQuestMarkerCache.markers;
  }

  private applyInventorySync(msg: {
    inventoryJson: string;
    weaponMagazinesJson: string;
    equippedInventorySlot: number;
    equippedWeaponIndex: number;
    equippedClothingSlot: number;
    clothingSkin: number;
    magazineRounds: number;
    idleWeapon: string;
    isReloading: boolean;
    isUnloading?: boolean;
  }) {
    this.localInventorySync = {
      ...msg,
      isUnloading: msg.isUnloading === true,
    };
    this.lastInventoryRenderKey = "";
    this.lastHotbarRenderKey = "";
    const sprite = this.playerSprites.get(this.sessionId);
    const prev = sprite?.getData("server") as
      | {
          equippedWeaponIndex?: number;
          idleWeapon?: string;
          clothingSkin?: number;
        }
      | undefined;
    if (sprite && prev) {
      sprite.setData("server", {
        ...prev,
        equippedWeaponIndex: msg.equippedWeaponIndex,
        idleWeapon: msg.idleWeapon,
        clothingSkin: msg.clothingSkin,
        magazineRounds: msg.magazineRounds,
        isReloading: msg.isReloading,
        isUnloading: msg.isUnloading,
      });
      if (
        (prev.equippedWeaponIndex ?? -1) >= 0 &&
        msg.equippedWeaponIndex < 0
      ) {
        this.cancelEntityFireAnim(this.sessionId);
        sprite.setData("visualKey", "");
      }
      if ((prev.clothingSkin ?? 1) !== (msg.clothingSkin ?? 1)) {
        sprite.setData("visualKey", "");
        ensurePlayerClothingPack(this, msg.clothingSkin ?? 1);
        // Don't wait for the next game tick — swap as soon as idle art exists.
        this.updateEntityFromState(sprite, "player", this.sessionId);
      }
    }
    // Warm clothing packs while shirts sit in the bag so Wear is instant.
    const syncedInventory = parseInventory(msg.inventoryJson);
    for (const slot of syncedInventory) {
      if (slot && isClothingItem(slot.id)) {
        ensurePlayerClothingPack(this, clothingSkinFromItemId(slot.id));
      }
    }
    if (syncedInventory.some((slot) => slot && isRawMeat(slot.id))) {
      this.notifyTip("raw_meat");
    }
    if (syncedInventory.some((slot) => slot && isSkillMagazine(slot.id))) {
      this.notifyTip("skill_magazine");
    }
    if (syncedInventory.some((slot) => slot && isRadioItem(slot.id))) {
      this.notifyTip("radio");
    }
    if (syncedInventory.some((slot) => slot && isFirearmItemId(slot.id))) {
      this.notifyTip("firearm");
    }
    if (getEntryWetness(syncedInventory[msg.equippedClothingSlot]) >= 0.4) {
      this.notifyTip("wet");
    }
    if (msg.equippedWeaponIndex >= 0) this.notifyTutorial("equip_weapon");
    this.refreshInventoryUI();
    this.refreshHotbar();
    this.containerLootUI?.syncPlayerInventory(
      msg.inventoryJson,
      this.localExtraPockets(),
    );
    this.syncRedOrderDialogState();
    this.syncAshenMilitiaDialogState();
  }

  private refreshInventoryUI() {
    if (!this.inventoryUI?.isOpen()) return;
    const me = this.room?.state?.players?.get(this.sessionId);
    if (!me) return;
    const sync = this.localInventorySync;
    const inventoryJson = sync?.inventoryJson ?? me.inventoryJson;
    const equippedSlot = sync?.equippedInventorySlot ?? me.equippedInventorySlot ?? -1;
    const equippedClothingSlot =
      sync?.equippedClothingSlot ?? me.equippedClothingSlot ?? -1;
    const magazinesJson = sync?.weaponMagazinesJson ?? me.weaponMagazinesJson ?? "{}";
    const magazineRounds =
      sync && !me.isReloading
        ? Math.max(me.magazineRounds, sync.magazineRounds)
        : me.magazineRounds;
    const health = Math.ceil(me.health);
    const hunger = Math.ceil(me.hunger);
    const thirst = Math.ceil(me.thirst);
    const temperature = Math.round((me.temperature ?? TEMPERATURE_CORE_DEFAULT) * 10) / 10;
    const infected = me.infected ? 1 : 0;
    const infection = me.infection ?? 0;
    const stats = {
      health: me.health,
      hunger: me.hunger,
      thirst: me.thirst,
      temperature: me.temperature ?? TEMPERATURE_CORE_DEFAULT,
      maxHealth: playerMaxHealthFromInfection(infection, !!me.infected),
      maxHunger: HUNGER_MAX,
      maxThirst: THIRST_MAX,
      infected: !!me.infected,
    };
    // Vitals are kept out of the render key: they drift continuously (core
    // temperature every 0.1 °C) and only feed the detail panel, so rebuilding
    // every slot cell for them was wasted work.
    const vitalsKey = `${health}|${hunger}|${thirst}|${temperature}|${infected}|${infection}`;
    const extraPockets = this.localExtraPockets();
    const key = `${inventoryJson}|${equippedSlot}|${equippedClothingSlot}|${magazinesJson}|${magazineRounds}|${extraPockets}`;
    if (key === this.lastInventoryRenderKey) {
      if (vitalsKey !== this.lastInventoryVitalsKey) {
        this.lastInventoryVitalsKey = vitalsKey;
        this.inventoryUI.updateStats(stats);
      }
      return;
    }
    this.lastInventoryRenderKey = key;
    this.lastInventoryVitalsKey = vitalsKey;
    this.inventoryUI.render(
      inventoryJson,
      equippedSlot,
      stats,
      equippedClothingSlot,
      magazinesJson,
      magazineRounds,
      extraPockets,
    );
  }

  private applyQuestSync(questsJson: string) {
    const prev = parseQuestsJson(this.cachedQuestsJson);
    const next = parseQuestsJson(questsJson);
    this.cachedQuestsJson = questsJson;
    this.lastQuestUiKey = "";
    this.refreshQuestPanels();
    for (const stage of listNewlyCompletedQuestStages(prev, next)) {
      this.lootPopup?.show([], {
        header: `${stage.title} task updated`,
        arrow: "↑",
      });
    }
    this.onboardingUI?.setFirstSweepState(firstSweepStateOf(next));
  }

  private localExtraPockets(): number {
    return computePlayerSkillMods(this.localSkillsJson).extraPockets;
  }

  /** Owner-only skill tree, pushed by the server (never in the schema). */
  private applySkillSync(skillsJson: string) {
    this.localSkillsJson = skillsJson;
    this.lastQuestUiKey = "";
    this.lastInventoryRenderKey = "";
    this.refreshQuestPanels();
    this.refreshInventoryUI();
    const me = this.room?.state?.players?.get(this.sessionId);
    const inventoryJson =
      this.localInventorySync?.inventoryJson ?? me?.inventoryJson;
    if (inventoryJson) {
      this.containerLootUI?.syncPlayerInventory(
        inventoryJson,
        this.localExtraPockets(),
      );
    }
  }

  /** Weapon recipes unlocked by blueprints. Owner-only, never in the schema. */
  private applyBlueprintSync(learnedBlueprintsJson: string) {
    this.learnedRecipeIds = parseLearnedBlueprints(learnedBlueprintsJson);
    this.craftUI?.setLearnedRecipes(this.learnedRecipeIds);
  }

  private refreshQuestPanels() {
    const me = this.room?.state?.players?.get(this.sessionId);
    if (!me) return;
    const questsJson = this.localQuestsJson();
    const skillsJson = this.localSkillsJson;
    this.journalUI?.render(questsJson, skillsJson);
    const key = `${questsJson}|${skillsJson}`;
    if (key === this.lastQuestUiKey) return;
    this.lastQuestUiKey = key;
    this.syncRedOrderDialogStateWithQuests(questsJson);
    this.syncAshenMilitiaDialogStateWithQuests(questsJson);
  }

  private syncRedOrderDialogStateWithQuests(questsJson: string) {
    if (!this.redOrderDialogUI?.isOpen()) return;
    const me = this.room?.state?.players?.get(this.sessionId);
    this.redOrderDialogUI.sync({
      dogtagCount: this.localDogtagCount(),
      inventoryJson:
        this.localInventorySync?.inventoryJson ?? me?.inventoryJson ?? "[]",
      redOrderReputation: me?.redOrderReputation ?? RED_ORDER_REP_START,
      questsJson,
      extraPockets: this.localExtraPockets(),
    });
  }

  private syncAshenMilitiaDialogStateWithQuests(questsJson: string) {
    if (!this.ashenMilitiaDialogUI?.isOpen()) return;
    const me = this.room?.state?.players?.get(this.sessionId);
    this.ashenMilitiaDialogUI.sync({
      inventoryJson:
        this.localInventorySync?.inventoryJson ?? me?.inventoryJson ?? "[]",
      ashenMilitiaReputation: me?.ashenMilitiaReputation ?? ASHEN_REP_START,
      playerHealth: me?.health ?? PLAYER_MAX_HEALTH,
      playerInfected: !!me?.infected,
      questsJson,
      tutorialDone: this.onboardingUI?.isFinished() ?? false,
      extraPockets: this.localExtraPockets(),
    });
  }

  private boundsKey(bounds: WorldBounds) {
    return `${bounds.minGlobalX},${bounds.minGlobalY},${bounds.mapWidth},${bounds.mapHeight}`;
  }

  private refreshHotbar() {
    const me = this.room?.state?.players?.get(this.sessionId);
    if (!me || !this.weaponHotbar) return;
    const sync = this.localInventorySync;
    const inventoryJson = sync?.inventoryJson ?? me.inventoryJson;
    const equippedSlot = sync?.equippedInventorySlot ?? me.equippedInventorySlot ?? -1;
    // Prefer schema while reloading (hotbar shows "…"). After reload completes,
    // take the higher of schema vs inventorySync so a lagging schema patch can't
    // leave the mag looking empty when the reliable sync already has the fill.
    const magazineRounds =
      sync && !me.isReloading
        ? Math.max(me.magazineRounds, sync.magazineRounds)
        : me.magazineRounds;
    const magazinesJson = sync?.weaponMagazinesJson ?? me.weaponMagazinesJson ?? "{}";
    const isReloading = me.isReloading;
    const weaponRestricted = isBirchportWeaponEquipRestricted({
      inInterior: !!me.inInterior,
      buildingX: me.buildingX,
      buildingY: me.buildingY,
      x: me.x,
      y: me.y,
    });
    const key = `${inventoryJson}|${equippedSlot}|${magazineRounds}|${magazinesJson}|${isReloading}|${weaponRestricted ? 1 : 0}`;
    if (key !== this.lastHotbarRenderKey) {
      this.lastHotbarRenderKey = key;
      this.weaponHotbar.render(
        inventoryJson,
        equippedSlot,
        magazineRounds,
        magazinesJson,
        isReloading,
        weaponRestricted,
      );
    }
    this.refreshMobileActionButtons();
  }

  private syncWorldTiles(force = false) {
    const viewDirty = this.cameraViewDirty;
    this.cameraViewDirty = false;
    if (!this.tileManager || !this.room?.state?.players) return;
    const me = this.room.state.players.get(this.sessionId);
    if (!me) return;
    if (me.inInterior) {
      // No overworld draw indoors, but the exterior cuboids are still alive and
      // were still holding full-resolution bakes for a city behind a wall. This
      // hands those bytes back; they promote again once you step out.
      this.tileManager.releaseOffscreenBuildingDetail();
      return;
    }
    if (!Number.isFinite(me.x) || !Number.isFinite(me.y)) return;

    const bounds = {
      minGlobalX: this.room.state.minGlobalX,
      minGlobalY: this.room.state.minGlobalY,
      mapWidth: this.room.state.mapWidth,
      mapHeight: this.room.state.mapHeight,
    };
    const key = this.boundsKey(bounds);
    if (key !== this.lastBoundsKey) {
      this.lastBoundsKey = key;
      this.worldBounds = bounds;
    }
    // Player tile + camera view (desktop): only draw tiles visible at current zoom.
    this.tileManager.syncAroundPlayer(
      Math.floor(me.x),
      Math.floor(me.y),
      bounds,
      this.cameras.main,
      force || viewDirty,
    );
  }

  private occupiedSitCampchairTiles(): ReadonlySet<string> {
    const tiles = new Set<string>();
    const me = this.room?.state?.players?.get(this.sessionId);
    if (!me?.inInterior || !this.room?.state?.guards) return tiles;
    this.room.state.guards.forEach((g) => {
      if (!g.alive || !isGuardSitAnim(g.anim) || !g.inInterior) return;
      if (g.buildingX !== me.buildingX || g.buildingY !== me.buildingY) return;
      tiles.add(`${Math.floor(g.x)},${Math.floor(g.y)}`);
    });
    return tiles;
  }

  private syncInteriorView() {
    const me = this.room?.state?.players?.get(this.sessionId);
    if (!this.interiorView || !this.tileManager || !me) return;

    if (me.inInterior) {
      // Furniture art is lazy. Request it on entry and redraw once it lands so
      // the first interior does not sit on placeholder blocks. Do not rebuild
      // every frame once ready: that destroys playing search anims and snaps
      // to the final searched frame.
      if (!isFurniturePackReady()) {
        if (!this.furnitureArtRebuildArmed) {
          this.furnitureArtRebuildArmed = true;
          ensureFurnitureAssets(this, () => {
            this.furnitureArtRebuildArmed = false;
            this.refreshFurnitureDependentSprites();
            if (this.lastInteriorKey) {
            this.interiorView?.syncSearchables(
              this.searchablesCache.filter(
                (s) => (s.level ?? 0) === (me.interiorLevel ?? 0),
              ),
              true,
              this.currentSearchTargetIds(),
              this.occupiedSitCampchairTiles(),
            );
            }
          });
        }
      }
      const key = `${me.buildingX},${me.buildingY}`;
      if (key !== this.lastInteriorKey) {
        const wasOutside = !this.lastInteriorKey;
        this.lastInteriorKey = key;
        this.interiorView.show(me.buildingX, me.buildingY);
        const structKey = buildingKey(me.buildingX, me.buildingY);
        const extras = this.tempInteriorWallsByBuilding.get(structKey) ?? [];
        this.interiorView.setExtraWalls(extras);
        this.applyInteriorStructureVisuals(me.buildingX, me.buildingY);
        this.applyInteriorPrefabVisuals(me.buildingX, me.buildingY);
        this.setOverworldTempWallsVisible(false);
        this.setOverworldStructuresVisible(false);
        this.tileManager.setOverworldVisible(false);
        this.clearGroundBackpackSprites();
        // Free exterior building VRAM while indoors (full wipe on mobile;
        // soft far-building reclaim continues on both after exit).
        if (IS_MOBILE) {
          this.tileManager.purgeOverworld();
        } else {
          this.exteriorSoftPurgeActive = true;
        }
        this.tileManager.highlightBuilding(null, null);
        this.playerOcclusionHighlight?.hide();
        this.playerOccludedGhost?.hide();
        this.clearCombatTarget();
        this.clearInteractTarget();
        this.clearLootTarget();
        if (wasOutside) this.playDoorFade();
        this.syncGunshotListener();
      }
      this.interiorView.syncSearchables(
        this.searchablesCache.filter(
          (s) => (s.level ?? 0) === (me.interiorLevel ?? 0),
        ),
        false,
        this.currentSearchTargetIds(),
        this.occupiedSitCampchairTiles(),
      );
      this.interiorView.setFloorLevel(me.interiorLevel ?? 0);
      this.interiorView.updateCubicleWallFade(
        Math.floor(me.x),
        Math.floor(me.y),
      );
    } else if (this.lastInteriorKey) {
      this.lastInteriorKey = "";
      this.interiorView.hide();
      this.tileManager.setOverworldVisible(true);
      this.setOverworldTempWallsVisible(true);
      this.setOverworldStructuresVisible(true);
      this.syncOverworldFireplaceSprites();
      this.syncOverworldStorageBoxSprites();
      this.syncOverworldFenceSprites();
      this.syncOverworldFenceCornerSprites();
      this.exteriorSoftPurgeActive = true;
      this.clearCombatTarget();
      this.clearInteractTarget();
      this.clearLootTarget();
      this.playDoorFade();
      this.syncGroundBackpackSprites();
    }
  }

  /** Furniture ids currently being searched by anyone in the room. */
  private currentSearchTargetIds(): Set<string> {
    const ids = new Set<string>();
    this.room?.state?.players?.forEach((player) => {
      if (player.searchTargetId) ids.add(player.searchTargetId);
    });
    return ids;
  }

  /** Draw / cull overworld floor bags from the searchable AOI cache. */
  private syncGroundBackpackSprites() {
    const me = this.room?.state?.players?.get(this.sessionId);
    if (!me || me.inInterior) {
      this.clearGroundBackpackSprites();
      return;
    }

    const want = new Set<string>();
    for (const s of this.searchablesCache) {
      if (!isGroundBackpackType(s.objectType)) continue;
      if (s.buildingX !== OVERWORLD_BAG_BUILDING) continue;
      if (s.depleted) continue;
      want.add(s.id);

      let sprite = this.groundBagSprites.get(s.id);
      const iso = cartesianToIso(s.x + 0.5, s.y + 0.5);
      const renderHeight = Math.round(ENTITY_RENDER_HEIGHT * 0.3 * 1.2);
      const bottomPad = -Math.round(renderHeight * 0.25);
      const groundY = iso.y + TILE_HEIGHT / 2 + bottomPad;
      // Corpse-band + structure clamps: same occlusion path as living entities
      // so a refund bag on a former door tile stays under a player south of it.
      const depth = this.overworldCorpseDepth(s.x + 0.5, s.y + 0.5);
      if (!sprite) {
        const texKey =
          animatedFurnitureDef("groundbackpack", s.facing || "SE")?.idleKey ??
          "furniture-groundbackpack-se";
        if (!textureKeyExists(this, texKey)) {
          this.requestFurnitureArt();
          continue;
        }
        sprite = addImageForKey(this, iso.x, groundY, texKey);
        sprite.setOrigin(0.5, 1);
        this.fitFurnitureSprite(sprite, renderHeight);
        this.groundBagSprites.set(s.id, sprite);
      }
      sprite.setPosition(iso.x, groundY);
      sprite.setDepth(depth);
      sprite.setVisible(true);
    }

    for (const [id, sprite] of this.groundBagSprites) {
      if (want.has(id)) continue;
      sprite.destroy();
      this.groundBagSprites.delete(id);
    }
  }

  private clearGroundBackpackSprites() {
    for (const sprite of this.groundBagSprites.values()) sprite.destroy();
    this.groundBagSprites.clear();
  }

  /**
   * Furniture art is lazy (it is 151MB of VRAM), but a few pieces show up
   * outdoors: dropped bags, player-built fireplaces, and their build ghosts.
   * Request the pack when one of those first needs drawing, then rebuild
   * anything that skipped while the atlas was missing.
   */
  private requestFurnitureArt() {
    ensureFurnitureAssets(this, () => this.refreshFurnitureDependentSprites());
  }

  /** Fireplaces / fence ghosts that no-op'd while the furniture pack loaded. */
  private refreshFurnitureDependentSprites() {
    this.syncOverworldFireplaceSprites();
    this.syncOverworldStorageBoxSprites();
    this.redrawOverworldPrefabs();
    const me = this.room?.state?.players?.get(this.sessionId);
    if (me?.inInterior) {
      this.applyInteriorStructureVisuals(me.buildingX, me.buildingY);
      this.applyInteriorPrefabVisuals(me.buildingX, me.buildingY);
    }
    this.updateBuildModeHover();
  }

  /** Size furniture from the untrimmed frame so atlas-packed art matches PNGs. */
  private fitFurnitureSprite(
    sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite,
    renderHeight: number,
  ) {
    const w = sprite.frame?.realWidth || 1;
    const h = sprite.frame?.realHeight || 1;
    sprite.setDisplaySize((w / h) * renderHeight, renderHeight);
  }

  /** Brief full-viewport dim pulse covering interior enter/exit. */
  private playDoorFade() {
    // Camera flash covers everything the camera draws (tiles, walls, entities)
    // and is unaffected by world depth bands / zoom.
    this.cameras.main.flash(180, 8, 10, 14, true);
  }

  /**
   * Soft exterior VRAM reclaim: only far buildings + idle pool shrink.
   * Triggers when idle, after interior transitions, or when the tab hides.
   */
  private tickExteriorSoftPurge(deltaMs: number) {
    if (!this.tileManager || !this.room?.state) return;
    const me = this.room.state.players.get(this.sessionId);
    if (!me || me.inInterior) return;
    if (!Number.isFinite(me.x) || !Number.isFinite(me.y)) return;

    const tx = Math.floor(me.x);
    const ty = Math.floor(me.y);
    if (
      tx !== this.exteriorPurgeStillTile.x ||
      ty !== this.exteriorPurgeStillTile.y
    ) {
      this.exteriorPurgeStillTile = { x: tx, y: ty };
      this.exteriorPurgeStillSince = 0;
    } else {
      this.exteriorPurgeStillSince += deltaMs;
      if (
        !this.exteriorSoftPurgeActive &&
        this.exteriorPurgeStillSince >= EXTERIOR_PURGE_IDLE_MS
      ) {
        this.exteriorSoftPurgeActive = true;
      }
    }

    if (!this.exteriorSoftPurgeActive) return;

    const more = this.tileManager.softPurgeFarBuildings(
      tx,
      ty,
      EXTERIOR_PURGE_BUILDINGS_PER_FRAME,
    );
    if (!more) {
      this.exteriorSoftPurgeActive = false;
      // Keep stillness clock so we don't immediately re-trigger; reset on move.
      this.exteriorPurgeStillSince = 0;
    }
  }

  /** Furniture + interior wall footprints in the local player's current interior (for depth clamps). */
  private interiorFurnitureDepthFootprints(
    buildingX?: number,
    buildingY?: number,
  ): FurnitureDepthFootprint[] {
    const me = this.room?.state?.players?.get(this.sessionId);
    const bx = buildingX ?? me?.buildingX;
    const by = buildingY ?? me?.buildingY;
    if (bx === undefined || by === undefined) return [];
    const out: FurnitureDepthFootprint[] = [];
    for (const s of this.searchablesCache) {
      if (s.buildingX !== bx || s.buildingY !== by) continue;
      if (s.objectType === "groundbackpack") continue;
      const { w, h } = searchableFootprint(s);
      const depthBias = interiorFurnitureDepthBias(s.objectType);
      out.push(
        depthBias !== 0
          ? { ox: s.x, oy: s.y, w, h, depthBias }
          : { ox: s.x, oy: s.y, w, h },
      );
    }
    for (const wall of this.mergedInteriorWallFootprints(bx, by)) {
      out.push({ ...wall, partition: true });
    }
    // Open doors are excluded from mergedInteriorWalls (they don't block
    // movement), but the leaf graphic still draws at the tile's wall depth —
    // without a footprint here, entities walking through the doorway get no
    // front-lift and render underneath the leaf.
    const openDoors = (
      this.structureDoorsByBuilding.get(buildingKey(bx, by)) ?? []
    ).filter((d) => d.isOpen);
    for (const d of openDoors) {
      out.push({ ox: d.x, oy: d.y, w: 1, h: 1, partition: true });
    }
    for (const f of this.structureFireplacesByBuilding.get(buildingKey(bx, by)) ?? []) {
      out.push({ ox: f.x, oy: f.y, w: 1, h: 1 });
    }
    for (const box of this.structureStorageBoxesByBuilding.get(buildingKey(bx, by)) ?? []) {
      out.push({ ox: box.x, oy: box.y, w: 1, h: 1 });
    }
    for (const f of this.structureFencesByBuilding.get(buildingKey(bx, by)) ?? []) {
      out.push(chainLinkFenceDepthFootprint(f.x, f.y, f.facing));
    }
    for (const c of this.structureFenceCornersByBuilding.get(buildingKey(bx, by)) ?? []) {
      out.push(chainLinkFenceCornerDepthFootprint(c.x, c.y));
    }
    return out;
  }

  /**
   * Procedural interior walls plus admin /build extras and persistent
   * player-built structures. Doors only count as blocking while closed. Fences
   * and storage boxes always block. Fireplaces are walkable. Used for collision
   * and placement.
   */
  private mergedInteriorWalls(
    buildingX: number,
    buildingY: number,
  ): InteriorWallTile[] {
    const me = this.room?.state?.players?.get(this.sessionId);
    if (
      me?.inInterior &&
      me.buildingX === buildingX &&
      me.buildingY === buildingY &&
      (me.interiorLevel ?? 0) > 0
    ) {
      return [];
    }
    const base = interiorWallsForBuilding(buildingX, buildingY);
    const key = buildingKey(buildingX, buildingY);
    const extras = this.tempInteriorWallsByBuilding.get(key) ?? [];
    const structWalls = this.structureWallsByBuilding.get(key) ?? [];
    const closedDoors = (this.structureDoorsByBuilding.get(key) ?? []).filter(
      (d) => !d.isOpen,
    );
    const fences = this.structureFencesByBuilding.get(key) ?? [];
    const fenceTiles = fences.flatMap((f) =>
      structureOccupiedTiles({
        kind: "fence",
        x: f.x,
        y: f.y,
        facing: f.facing,
      }),
    );
    const fenceCorners = this.structureFenceCornersByBuilding.get(key) ?? [];
    const storageBoxes = this.structureStorageBoxesByBuilding.get(key) ?? [];
    if (
      extras.length === 0 &&
      structWalls.length === 0 &&
      closedDoors.length === 0 &&
      fenceTiles.length === 0 &&
      fenceCorners.length === 0 &&
      storageBoxes.length === 0
    ) {
      return base;
    }
    const seen = new Set(base.map((w) => `${w.x},${w.y}`));
    const out = [...base];
    for (const w of [
      ...extras,
      ...structWalls,
      ...closedDoors,
      ...fenceTiles,
      ...fenceCorners,
      ...storageBoxes,
    ]) {
      const k = `${w.x},${w.y}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ x: w.x, y: w.y });
    }
    return out;
  }

  /**
   * Hard cover for shots / entity LOS. Same as mergedInteriorWalls but
   * fireplaces are omitted — they sit low and never block bullets.
   */
  private mergedInteriorSightWalls(
    buildingX: number,
    buildingY: number,
  ): InteriorWallTile[] {
    const base = interiorWallsForBuilding(buildingX, buildingY);
    const key = buildingKey(buildingX, buildingY);
    const extras = this.tempInteriorWallsByBuilding.get(key) ?? [];
    const structWalls = this.structureWallsByBuilding.get(key) ?? [];
    const closedDoors = (this.structureDoorsByBuilding.get(key) ?? []).filter(
      (d) => !d.isOpen,
    );
    if (
      extras.length === 0 &&
      structWalls.length === 0 &&
      closedDoors.length === 0
    ) {
      return base;
    }
    const seen = new Set(base.map((w) => `${w.x},${w.y}`));
    const out = [...base];
    for (const w of [...extras, ...structWalls, ...closedDoors]) {
      const k = `${w.x},${w.y}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ x: w.x, y: w.y });
    }
    return out;
  }

  private mergedInteriorWallFootprints(
    buildingX: number,
    buildingY: number,
  ): { ox: number; oy: number; w: number; h: number }[] {
    // Match shared interiorWallFootprintsForBuilding but with merged walls.
    const walls = this.mergedInteriorWalls(buildingX, buildingY);
    return walls.map((w) => ({ ox: w.x, oy: w.y, w: 1, h: 1 }));
  }

  private applyTempWallPlaced(
    buildingX: number,
    buildingY: number,
    x: number,
    y: number,
  ) {
    const key = buildingKey(buildingX, buildingY);
    const list = this.tempInteriorWallsByBuilding.get(key) ?? [];
    if (!list.some((w) => w.x === x && w.y === y)) {
      list.push({ x, y });
      this.tempInteriorWallsByBuilding.set(key, list);
    }
    const me = this.room?.state?.players?.get(this.sessionId);
    if (
      me?.inInterior &&
      me.buildingX === buildingX &&
      me.buildingY === buildingY
    ) {
      this.interiorView?.addExtraWall(x, y);
    }
  }

  private applyTempWallsSync(
    buildingX: number,
    buildingY: number,
    walls: { x: number; y: number }[],
  ) {
    const key = buildingKey(buildingX, buildingY);
    this.tempInteriorWallsByBuilding.set(
      key,
      walls.map((w) => ({ x: w.x, y: w.y })),
    );
    const me = this.room?.state?.players?.get(this.sessionId);
    if (
      me?.inInterior &&
      me.buildingX === buildingX &&
      me.buildingY === buildingY
    ) {
      this.interiorView?.setExtraWalls(walls);
    }
  }

  private applyOverworldTempWallPlaced(x: number, y: number) {
    const key = `${x},${y}`;
    if (this.tempOverworldWallKeys.has(key)) return;
    this.tempOverworldWallKeys.add(key);
    this.redrawOverworldTempWalls();
  }

  private applyOverworldTempWallsSync(walls: { x: number; y: number }[]) {
    this.tempOverworldWallKeys.clear();
    for (const w of walls) this.tempOverworldWallKeys.add(`${w.x},${w.y}`);
    this.redrawOverworldTempWalls();
  }

  // ── Lite base building — persistent player walls/doors ───────────────────

  private applyStructurePlaced(msg: {
    inInterior: boolean;
    buildingX: number;
    buildingY: number;
    x: number;
    y: number;
    kind: StructureBuildKind;
    ownerWallet: string;
    isOpen: boolean;
    isLocked: boolean;
    activeUntil: number;
    fuelWood: number;
    status: "prefab" | "solid";
    facing?: StructureFenceFacing | StructureFenceCorner;
  }) {
    const fenceFacing = parseStructureFenceFacing(msg.facing);
    const corner =
      msg.kind === "fence_corner"
        ? parseStructureFenceCorner(msg.facing)
        : undefined;
    if (msg.status === "prefab") {
      this.addPrefabTile(
        msg.inInterior,
        msg.buildingX,
        msg.buildingY,
        msg.x,
        msg.y,
        msg.kind,
        corner ?? fenceFacing,
      );
      return;
    }
    if (msg.inInterior) {
      const key = buildingKey(msg.buildingX, msg.buildingY);
      if (msg.kind === "wall") {
        const list = this.structureWallsByBuilding.get(key) ?? [];
        if (!list.some((w) => w.x === msg.x && w.y === msg.y)) {
          list.push({
            x: msg.x,
            y: msg.y,
            ownerWallet: msg.ownerWallet,
          });
          this.structureWallsByBuilding.set(key, list);
        }
      } else if (msg.kind === "door") {
        const list = this.structureDoorsByBuilding.get(key) ?? [];
        if (!list.some((d) => d.x === msg.x && d.y === msg.y)) {
          list.push({
            x: msg.x,
            y: msg.y,
            isOpen: msg.isOpen,
            isLocked: msg.isLocked,
            ownerWallet: msg.ownerWallet,
          });
          this.structureDoorsByBuilding.set(key, list);
        }
      } else if (msg.kind === "fireplace") {
        const list = this.structureFireplacesByBuilding.get(key) ?? [];
        const existing = list.find((f) => f.x === msg.x && f.y === msg.y);
        if (existing) {
          existing.activeUntil = msg.activeUntil;
          existing.fuelWood = msg.fuelWood;
          existing.ownerWallet = msg.ownerWallet;
        } else {
          list.push({
            x: msg.x,
            y: msg.y,
            ownerWallet: msg.ownerWallet,
            activeUntil: msg.activeUntil,
            fuelWood: msg.fuelWood,
          });
          this.structureFireplacesByBuilding.set(key, list);
        }
      } else if (isStructurePanelKind(msg.kind)) {
        const list = this.structureFencesByBuilding.get(key) ?? [];
        const existing = list.find((f) => f.x === msg.x && f.y === msg.y);
        if (existing) {
          existing.facing = fenceFacing;
          existing.ownerWallet = msg.ownerWallet;
          existing.kind = msg.kind === "bargate" ? "bargate" : "fence";
        } else {
          list.push({
            x: msg.x,
            y: msg.y,
            facing: fenceFacing,
            ownerWallet: msg.ownerWallet,
            kind: msg.kind === "bargate" ? "bargate" : "fence",
          });
          this.structureFencesByBuilding.set(key, list);
        }
      } else if (msg.kind === "fence_corner" && corner) {
        const list = this.structureFenceCornersByBuilding.get(key) ?? [];
        const existing = list.find((f) => f.x === msg.x && f.y === msg.y);
        if (existing) {
          existing.ownerWallet = msg.ownerWallet;
          existing.corner = corner;
        } else {
          list.push({
            x: msg.x,
            y: msg.y,
            corner,
            ownerWallet: msg.ownerWallet,
          });
          this.structureFenceCornersByBuilding.set(key, list);
        }
      } else if (isStorageBoxKind(msg.kind)) {
        const list = this.structureStorageBoxesByBuilding.get(key) ?? [];
        const existing = list.find((f) => f.x === msg.x && f.y === msg.y);
        if (existing) {
          existing.ownerWallet = msg.ownerWallet;
          existing.kind = msg.kind;
        } else {
          list.push({
            x: msg.x,
            y: msg.y,
            ownerWallet: msg.ownerWallet,
            kind: msg.kind,
          });
          this.structureStorageBoxesByBuilding.set(key, list);
        }
      }
      const me = this.room?.state?.players?.get(this.sessionId);
      if (me?.inInterior && me.buildingX === msg.buildingX && me.buildingY === msg.buildingY) {
        if (msg.kind === "wall") this.interiorView?.addStructureWall(msg.x, msg.y);
        else if (msg.kind === "door") {
          this.interiorView?.upsertExtraDoor({
            x: msg.x,
            y: msg.y,
            isOpen: msg.isOpen,
            isLocked: msg.isLocked,
            ownerWallet: msg.ownerWallet,
          });
        } else if (msg.kind === "fireplace") {
          this.interiorView?.upsertFireplace({
            x: msg.x,
            y: msg.y,
            ownerWallet: msg.ownerWallet,
            activeUntil: msg.activeUntil,
            fuelWood: msg.fuelWood,
          });
          if (!isFurniturePackReady()) this.requestFurnitureArt();
        } else if (isStorageBoxKind(msg.kind)) {
          this.interiorView?.upsertStorageBox({
            x: msg.x,
            y: msg.y,
            ownerWallet: msg.ownerWallet,
            kind: msg.kind,
          });
          if (!isFurniturePackReady()) this.requestFurnitureArt();
        } else if (isStructurePanelKind(msg.kind)) {
          this.interiorView?.upsertFence({
            x: msg.x,
            y: msg.y,
            facing: fenceFacing,
            ownerWallet: msg.ownerWallet,
            kind: msg.kind === "bargate" ? "bargate" : "fence",
          });
        } else if (msg.kind === "fence_corner" && corner) {
          this.interiorView?.upsertFenceCorner({
            x: msg.x,
            y: msg.y,
            corner,
            ownerWallet: msg.ownerWallet,
          });
        }
      }
    } else {
      if (msg.kind === "wall") {
        const wallKey = `${msg.x},${msg.y}`;
        this.structureWallKeysOverworld.add(wallKey);
        this.structureWallOwnersOverworld.set(wallKey, msg.ownerWallet);
        this.redrawOverworldStructures();
      } else if (msg.kind === "door") {
        this.structureDoorsOverworld.set(`${msg.x},${msg.y}`, {
          x: msg.x,
          y: msg.y,
          isOpen: msg.isOpen,
          isLocked: msg.isLocked,
          ownerWallet: msg.ownerWallet,
        });
        this.redrawOverworldStructures();
      } else if (msg.kind === "fireplace") {
        this.structureFireplacesOverworld.set(`${msg.x},${msg.y}`, {
          x: msg.x,
          y: msg.y,
          ownerWallet: msg.ownerWallet,
          activeUntil: msg.activeUntil,
          fuelWood: msg.fuelWood,
        });
        this.upsertOverworldFireplaceSprite({
          x: msg.x,
          y: msg.y,
          ownerWallet: msg.ownerWallet,
          activeUntil: msg.activeUntil,
          fuelWood: msg.fuelWood,
        });
      } else if (isStorageBoxKind(msg.kind)) {
        const tile = {
          x: msg.x,
          y: msg.y,
          ownerWallet: msg.ownerWallet,
          kind: msg.kind,
        };
        this.structureStorageBoxesOverworld.set(`${msg.x},${msg.y}`, tile);
        this.upsertOverworldStorageBoxSprite(tile);
      } else if (isStructurePanelKind(msg.kind)) {
        this.rememberOverworldFence({
          x: msg.x,
          y: msg.y,
          facing: fenceFacing,
          ownerWallet: msg.ownerWallet,
          kind: msg.kind === "bargate" ? "bargate" : "fence",
        });
        this.upsertOverworldFenceSprite({
          x: msg.x,
          y: msg.y,
          facing: fenceFacing,
          ownerWallet: msg.ownerWallet,
          kind: msg.kind === "bargate" ? "bargate" : "fence",
        });
      } else if (msg.kind === "fence_corner" && corner) {
        this.structureFenceCornersOverworld.set(`${msg.x},${msg.y}`, {
          x: msg.x,
          y: msg.y,
          corner,
          ownerWallet: msg.ownerWallet,
        });
        this.upsertOverworldFenceCornerSprite({
          x: msg.x,
          y: msg.y,
          corner,
          ownerWallet: msg.ownerWallet,
        });
      }
      for (const t of structureOccupiedTiles({
        kind: msg.kind,
        x: msg.x,
        y: msg.y,
        facing: fenceFacing,
      })) {
        setBuildingPlacementBlockedTile(t.x, t.y, true);
      }
    }
  }

  /** A funded prefab finished its build channel — swap the ghost for a solid structure. */
  private applyPrefabBuilt(msg: {
    inInterior: boolean;
    buildingX?: number;
    buildingY?: number;
    x: number;
    y: number;
    kind: StructureBuildKind;
    ownerWallet: string;
    isOpen: boolean;
    isLocked: boolean;
    activeUntil: number;
    fuelWood: number;
    facing?: StructureFenceFacing | StructureFenceCorner;
  }) {
    this.removePrefabTile(msg.inInterior, msg.buildingX ?? 0, msg.buildingY ?? 0, msg.x, msg.y);
    if (this.prefabDepositUI?.isOpen()) this.closePrefabUI();
    this.applyStructurePlaced({
      inInterior: msg.inInterior,
      buildingX: msg.buildingX ?? 0,
      buildingY: msg.buildingY ?? 0,
      x: msg.x,
      y: msg.y,
      kind: msg.kind,
      ownerWallet: msg.ownerWallet,
      isOpen: msg.isOpen,
      isLocked: msg.isLocked,
      activeUntil: msg.activeUntil,
      fuelWood: msg.fuelWood,
      status: "solid",
      facing: msg.facing,
    });

    // Offer code lock only once the door is solid (ghosts aren't lockable yet).
    if (msg.kind !== "door") return;
    const wallet = this.localWallet();
    if (!wallet || msg.ownerWallet !== wallet) return;
    const pending = this.pendingOwnDoorPlacement;
    if (pending && pending.x === msg.x && pending.y === msg.y) {
      this.pendingOwnDoorPlacement = null;
    }
    this.pendingDoorCodeTile = { x: msg.x, y: msg.y };
    this.doorCodeUI?.openSet();
  }

  /** Brief red outline flash on a damaged solid structure tile. */
  private applyStructureDamaged(msg: {
    x: number;
    y: number;
    inInterior: boolean;
    buildingX?: number;
    buildingY?: number;
    health: number;
    maxHealth: number;
    destroyed?: boolean;
  }) {
    if (msg.destroyed) return;
    const me = this.room?.state?.players?.get(this.sessionId);
    if (!me) return;
    if (msg.inInterior) {
      if (!me.inInterior || me.buildingX !== msg.buildingX || me.buildingY !== msg.buildingY) {
        return;
      }
    } else if (me.inInterior) {
      return;
    }
    const g = this.add.graphics();
    g.setDepth(9_000_000);
    const fence = msg.inInterior
      ? this.interiorFenceAt(
          { buildingX: msg.buildingX ?? 0, buildingY: msg.buildingY ?? 0 },
          msg.x,
          msg.y,
        )
      : this.overworldFenceAt(msg.x, msg.y);
    if (fence) {
      const { w, h } = structureFenceFootprint(fence.facing);
      strokeIsoFootprintOutline(g, fence.x, fence.y, w, h, 0xff2a2a, 0.9);
    } else {
      strokeIsoTileOutline(g, msg.x, msg.y, 0xff2a2a, 0.9);
    }
    this.tweens.add({
      targets: g,
      alpha: 0,
      duration: 400,
      onComplete: () => g.destroy(),
    });
  }

  private applyStructureRemoved(msg: {
    inInterior: boolean;
    buildingX: number;
    buildingY: number;
    x: number;
    y: number;
    kind: StructureBuildKind;
  }) {
    this.removePrefabTile(msg.inInterior, msg.buildingX, msg.buildingY, msg.x, msg.y);
    if (
      this.pendingOwnDoorPlacement &&
      this.pendingOwnDoorPlacement.x === msg.x &&
      this.pendingOwnDoorPlacement.y === msg.y
    ) {
      this.pendingOwnDoorPlacement = null;
    }
    const openPrefab = this.prefabDepositUI?.getTile();
    if (
      openPrefab &&
      openPrefab.x === msg.x &&
      openPrefab.y === msg.y
    ) {
      this.closePrefabUI();
    }
    const openDeconstruct = this.deconstructUI?.getTile();
    if (
      openDeconstruct &&
      openDeconstruct.x === msg.x &&
      openDeconstruct.y === msg.y
    ) {
      this.closeDeconstructUI();
    }
    if (msg.inInterior) {
      const key = buildingKey(msg.buildingX, msg.buildingY);
      if (msg.kind === "wall") {
        const list = this.structureWallsByBuilding.get(key);
        if (list) {
          const next = list.filter((w) => w.x !== msg.x || w.y !== msg.y);
          if (next.length === 0) this.structureWallsByBuilding.delete(key);
          else this.structureWallsByBuilding.set(key, next);
        }
      } else if (msg.kind === "door") {
        const list = this.structureDoorsByBuilding.get(key);
        if (list) {
          const next = list.filter((d) => d.x !== msg.x || d.y !== msg.y);
          if (next.length === 0) this.structureDoorsByBuilding.delete(key);
          else this.structureDoorsByBuilding.set(key, next);
        }
      } else if (msg.kind === "fireplace") {
        const list = this.structureFireplacesByBuilding.get(key);
        if (list) {
          const next = list.filter((f) => f.x !== msg.x || f.y !== msg.y);
          if (next.length === 0) this.structureFireplacesByBuilding.delete(key);
          else this.structureFireplacesByBuilding.set(key, next);
        }
      } else if (isStorageBoxKind(msg.kind)) {
        const list = this.structureStorageBoxesByBuilding.get(key);
        if (list) {
          const next = list.filter((f) => f.x !== msg.x || f.y !== msg.y);
          if (next.length === 0) this.structureStorageBoxesByBuilding.delete(key);
          else this.structureStorageBoxesByBuilding.set(key, next);
        }
      } else if (isStructurePanelKind(msg.kind)) {
        const list = this.structureFencesByBuilding.get(key);
        if (list) {
          const next = list.filter((f) => f.x !== msg.x || f.y !== msg.y);
          if (next.length === 0) this.structureFencesByBuilding.delete(key);
          else this.structureFencesByBuilding.set(key, next);
        }
      } else if (msg.kind === "fence_corner") {
        const list = this.structureFenceCornersByBuilding.get(key);
        if (list) {
          const next = list.filter((f) => f.x !== msg.x || f.y !== msg.y);
          if (next.length === 0) this.structureFenceCornersByBuilding.delete(key);
          else this.structureFenceCornersByBuilding.set(key, next);
        }
      }
      const me = this.room?.state?.players?.get(this.sessionId);
      if (me?.inInterior && me.buildingX === msg.buildingX && me.buildingY === msg.buildingY) {
        if (msg.kind === "wall") this.interiorView?.removeStructureWall(msg.x, msg.y);
        else if (msg.kind === "door") this.interiorView?.removeExtraDoor(msg.x, msg.y);
        else if (msg.kind === "fireplace") this.interiorView?.removeFireplace(msg.x, msg.y);
        else if (isStorageBoxKind(msg.kind)) this.interiorView?.removeStorageBox(msg.x, msg.y);
        else if (isStructurePanelKind(msg.kind)) this.interiorView?.removeFence(msg.x, msg.y);
        else if (msg.kind === "fence_corner") {
          this.interiorView?.removeFenceCorner(msg.x, msg.y);
        }
      }
    } else {
      if (msg.kind === "wall") {
        const wallKey = `${msg.x},${msg.y}`;
        this.structureWallKeysOverworld.delete(wallKey);
        this.structureWallOwnersOverworld.delete(wallKey);
        this.redrawOverworldStructures();
      } else if (msg.kind === "door") {
        this.structureDoorsOverworld.delete(`${msg.x},${msg.y}`);
        this.redrawOverworldStructures();
      } else if (msg.kind === "fireplace") {
        this.structureFireplacesOverworld.delete(`${msg.x},${msg.y}`);
        this.removeOverworldFireplaceSprite(msg.x, msg.y);
      } else if (isStorageBoxKind(msg.kind)) {
        this.structureStorageBoxesOverworld.delete(`${msg.x},${msg.y}`);
        this.removeOverworldStorageBoxSprite(msg.x, msg.y);
      } else if (isStructurePanelKind(msg.kind)) {
        const fence = this.structureFencesOverworld.get(`${msg.x},${msg.y}`);
        this.forgetOverworldFence(msg.x, msg.y);
        this.removeOverworldFenceSprite(msg.x, msg.y);
        for (const t of structureOccupiedTiles({
          kind: msg.kind,
          x: msg.x,
          y: msg.y,
          facing: fence?.facing,
        })) {
          setBuildingPlacementBlockedTile(t.x, t.y, false);
        }
      } else if (msg.kind === "fence_corner") {
        this.structureFenceCornersOverworld.delete(`${msg.x},${msg.y}`);
        this.removeOverworldFenceCornerSprite(msg.x, msg.y);
      }
      if (
        getWorldChainlinkPanelOrigin(msg.x, msg.y) ||
        getWorldChainlinkCornerAt(msg.x, msg.y)
      ) {
        this.ensureWorldBarracksFences();
        this.syncOverworldFenceSprites();
        this.syncOverworldFenceCornerSprites();
      }
      if (!isStructurePanelKind(msg.kind)) {
        setBuildingPlacementBlockedTile(msg.x, msg.y, false);
      }
    }

    // Clear pending door-code flow if that door was destroyed.
    if (
      this.pendingDoorCodeTile &&
      this.pendingDoorCodeTile.x === msg.x &&
      this.pendingDoorCodeTile.y === msg.y
    ) {
      this.pendingDoorCodeTile = null;
      this.doorCodeUI?.close();
    }
    if (
      this.doorTargetTile &&
      this.doorTargetTile.x === msg.x &&
      this.doorTargetTile.y === msg.y
    ) {
      this.clearDoorTarget();
    }
    if (
      this.fireplaceTargetTile &&
      this.fireplaceTargetTile.x === msg.x &&
      this.fireplaceTargetTile.y === msg.y
    ) {
      this.clearFireplaceTarget();
    }
    if (
      this.storageBoxTargetTile &&
      this.storageBoxTargetTile.x === msg.x &&
      this.storageBoxTargetTile.y === msg.y
    ) {
      this.storageBoxTargetTile = null;
      this.storageBoxSprint = false;
    }
    const removedId = playerStructureId(
      msg.inInterior,
      msg.buildingX,
      msg.buildingY,
      msg.x,
      msg.y,
    );
    if (this.containerLootUI?.getContainerIds().includes(removedId)) {
      this.containerLootUI.close();
    }
    if (
      this.prefabTargetTile &&
      this.prefabTargetTile.x === msg.x &&
      this.prefabTargetTile.y === msg.y
    ) {
      this.clearPrefabTarget();
    }
    const openFp = this.fireplaceUI?.getTile();
    if (
      msg.kind === "fireplace" &&
      openFp &&
      openFp.x === msg.x &&
      openFp.y === msg.y
    ) {
      this.closeFireplaceUI();
    }
  }

  private applyStructuresSync(
    inInterior: boolean,
    buildingX: number,
    buildingY: number,
    structures: {
      x: number;
      y: number;
      kind: StructureBuildKind;
      ownerWallet: string;
      isOpen: boolean;
      isLocked: boolean;
      activeUntil?: number;
      fuelWood?: number;
      status?: "prefab" | "solid";
      facing?: StructureFenceFacing | StructureFenceCorner;
    }[],
  ) {
    if (inInterior) {
      const key = buildingKey(buildingX, buildingY);
      const walls: { x: number; y: number; ownerWallet: string }[] = [];
      const doors: InteriorDoorTile[] = [];
      const fireplaces: InteriorFireplaceTile[] = [];
      const storageBoxes: StorageBoxTile[] = [];
      const fences: InteriorFenceTile[] = [];
      const fenceCorners: InteriorFenceCornerTile[] = [];
      const prefabs: PrefabTile[] = [];
      for (const s of structures) {
        if (s.status === "prefab") {
          prefabs.push({
            x: s.x,
            y: s.y,
            kind: s.kind,
            facing:
              s.kind === "fence_corner"
                ? parseStructureFenceCorner(s.facing)
                : parseStructureFenceFacing(s.facing),
          });
          continue;
        }
        if (s.kind === "wall") {
          walls.push({ x: s.x, y: s.y, ownerWallet: s.ownerWallet });
        } else if (s.kind === "door") {
          doors.push({
            x: s.x,
            y: s.y,
            isOpen: s.isOpen,
            isLocked: s.isLocked,
            ownerWallet: s.ownerWallet,
          });
        } else if (s.kind === "fireplace") {
          fireplaces.push({
            x: s.x,
            y: s.y,
            ownerWallet: s.ownerWallet,
            activeUntil: Number(s.activeUntil ?? 0) || 0,
            fuelWood: Number(s.fuelWood ?? 0) || 0,
          });
        } else if (isStorageBoxKind(s.kind)) {
          storageBoxes.push({
            x: s.x,
            y: s.y,
            ownerWallet: s.ownerWallet,
            kind: s.kind,
          });
        } else if (isStructurePanelKind(s.kind)) {
          fences.push({
            x: s.x,
            y: s.y,
            facing: parseStructureFenceFacing(s.facing),
            ownerWallet: s.ownerWallet,
            kind: s.kind === "bargate" ? "bargate" : "fence",
          });
        } else if (s.kind === "fence_corner") {
          fenceCorners.push({
            x: s.x,
            y: s.y,
            corner: parseStructureFenceCorner(s.facing),
            ownerWallet: s.ownerWallet,
          });
        }
      }
      this.structureWallsByBuilding.set(key, walls);
      this.structureDoorsByBuilding.set(key, doors);
      this.structureFireplacesByBuilding.set(key, fireplaces);
      this.structureStorageBoxesByBuilding.set(key, storageBoxes);
      this.structureFencesByBuilding.set(key, fences);
      this.structureFenceCornersByBuilding.set(key, fenceCorners);
      this.prefabsByBuilding.set(key, prefabs);
      this.applyInteriorStructureVisuals(buildingX, buildingY);
      this.applyInteriorPrefabVisuals(buildingX, buildingY);
      return;
    }

    this.structureWallKeysOverworld.clear();
    this.structureWallOwnersOverworld.clear();
    this.structureDoorsOverworld.clear();
    this.structureFireplacesOverworld.clear();
    this.structureStorageBoxesOverworld.clear();
    this.structureFencesOverworld.clear();
    this.structureFenceOccupancyOverworld.clear();
    this.structureFenceCornersOverworld.clear();
    this.prefabsOverworld.clear();
    for (const s of structures) {
      if (s.status === "prefab") {
        this.prefabsOverworld.set(`${s.x},${s.y}`, {
          x: s.x,
          y: s.y,
          kind: s.kind,
          facing:
            s.kind === "fence_corner"
              ? parseStructureFenceCorner(s.facing)
              : parseStructureFenceFacing(s.facing),
        });
        continue;
      }
      if (s.kind === "wall") {
        const wallKey = `${s.x},${s.y}`;
        this.structureWallKeysOverworld.add(wallKey);
        this.structureWallOwnersOverworld.set(wallKey, s.ownerWallet);
      } else if (s.kind === "door") {
        this.structureDoorsOverworld.set(`${s.x},${s.y}`, {
          x: s.x,
          y: s.y,
          isOpen: s.isOpen,
          isLocked: s.isLocked,
          ownerWallet: s.ownerWallet,
        });
      } else if (s.kind === "fireplace") {
        this.structureFireplacesOverworld.set(`${s.x},${s.y}`, {
          x: s.x,
          y: s.y,
          ownerWallet: s.ownerWallet,
          activeUntil: Number(s.activeUntil ?? 0) || 0,
          fuelWood: Number(s.fuelWood ?? 0) || 0,
        });
      } else if (isStorageBoxKind(s.kind)) {
        this.structureStorageBoxesOverworld.set(`${s.x},${s.y}`, {
          x: s.x,
          y: s.y,
          ownerWallet: s.ownerWallet,
          kind: s.kind,
        });
      } else if (isStructurePanelKind(s.kind)) {
        this.rememberOverworldFence({
          x: s.x,
          y: s.y,
          facing: parseStructureFenceFacing(s.facing),
          ownerWallet: s.ownerWallet,
          kind: s.kind === "bargate" ? "bargate" : "fence",
        });
      } else if (s.kind === "fence_corner") {
        this.structureFenceCornersOverworld.set(`${s.x},${s.y}`, {
          x: s.x,
          y: s.y,
          corner: parseStructureFenceCorner(s.facing),
          ownerWallet: s.ownerWallet,
        });
      }
    }
    this.redrawOverworldPrefabs();
    this.redrawOverworldStructures();
    this.syncOverworldFireplaceSprites();
    this.syncOverworldStorageBoxSprites();
    this.syncOverworldFenceSprites();
    this.syncOverworldFenceCornerSprites();
    this.syncOverworldBuildingPlacementBlockers();
  }

  /**
   * Keep worldgen from placing buildings over player structures. Client and
   * server each maintain the shared blocked-tile set for their own worldgen.
   */
  private syncOverworldBuildingPlacementBlockers() {
    const tiles: string[] = [];
    for (const k of this.structureWallKeysOverworld) tiles.push(k);
    for (const k of this.structureDoorsOverworld.keys()) tiles.push(k);
    for (const k of this.structureFireplacesOverworld.keys()) tiles.push(k);
    for (const k of this.structureStorageBoxesOverworld.keys()) tiles.push(k);
    for (const k of this.structureFenceOccupancyOverworld.keys()) tiles.push(k);
    for (const k of this.structureFenceCornersOverworld.keys()) tiles.push(k);
    for (const p of this.prefabsOverworld.values()) {
      for (const t of structureOccupiedTiles(p)) tiles.push(`${t.x},${t.y}`);
    }
    syncBuildingPlacementBlockedTiles(tiles);
  }

  /** Push cached structure walls/doors/fireplaces into the visible interior view. */
  private applyInteriorStructureVisuals(buildingX: number, buildingY: number) {
    const me = this.room?.state?.players?.get(this.sessionId);
    if (!me?.inInterior) return;
    if (me.buildingX !== buildingX || me.buildingY !== buildingY) return;
    const key = buildingKey(buildingX, buildingY);
    this.interiorView?.setStructureWalls(
      (this.structureWallsByBuilding.get(key) ?? []).map((w) => ({
        x: w.x,
        y: w.y,
      })),
    );
    this.interiorView?.setExtraDoors(
      this.structureDoorsByBuilding.get(key) ?? [],
    );
    this.interiorView?.setFireplaces(
      this.structureFireplacesByBuilding.get(key) ?? [],
    );
    this.interiorView?.setStorageBoxes(
      this.structureStorageBoxesByBuilding.get(key) ?? [],
    );
    this.interiorView?.setFences(this.structureFencesByBuilding.get(key) ?? []);
    this.interiorView?.setFenceCorners(
      this.structureFenceCornersByBuilding.get(key) ?? [],
    );
    if (
      !isFurniturePackReady() &&
      ((this.structureFireplacesByBuilding.get(key) ?? []).length > 0 ||
        (this.structureStorageBoxesByBuilding.get(key) ?? []).length > 0)
    ) {
      this.requestFurnitureArt();
    }
  }

  // ── Lite base building — un-built prefab ghosts ──────────────────────────

  /** Register a newly placed prefab tile and render its ghost. */
  private addPrefabTile(
    inInterior: boolean,
    buildingX: number,
    buildingY: number,
    x: number,
    y: number,
    kind: StructureBuildKind,
    facing: StructureFenceFacing | StructureFenceCorner = "SE",
  ) {
    if (inInterior) {
      const key = buildingKey(buildingX, buildingY);
      const list = this.prefabsByBuilding.get(key) ?? [];
      const existing = list.find((p) => p.x === x && p.y === y);
      if (existing) {
        existing.kind = kind;
        existing.facing = facing;
      } else {
        list.push({ x, y, kind, facing });
        this.prefabsByBuilding.set(key, list);
      }
      this.applyInteriorPrefabVisuals(buildingX, buildingY);
      return;
    }
    this.prefabsOverworld.set(`${x},${y}`, { x, y, kind, facing });
    for (const t of structureOccupiedTiles({ kind, x, y, facing })) {
      setBuildingPlacementBlockedTile(t.x, t.y, true);
    }
    this.redrawOverworldPrefabs();
    // Prefab wall/door neighbors affect solid wall facing.
    if (kind === "wall" || kind === "door") this.redrawOverworldStructures();
  }

  /** Remove a prefab tile (built or cancelled). Safe no-op if not present. */
  private removePrefabTile(
    inInterior: boolean,
    buildingX: number,
    buildingY: number,
    x: number,
    y: number,
  ) {
    if (inInterior) {
      const key = buildingKey(buildingX, buildingY);
      const list = this.prefabsByBuilding.get(key);
      if (list) {
        const next = list.filter((p) => p.x !== x || p.y !== y);
        if (next.length === 0) this.prefabsByBuilding.delete(key);
        else this.prefabsByBuilding.set(key, next);
      }
      this.applyInteriorPrefabVisuals(buildingX, buildingY);
      return;
    }
    const removed = this.prefabsOverworld.get(`${x},${y}`);
    this.prefabsOverworld.delete(`${x},${y}`);
    if (removed) {
      for (const t of structureOccupiedTiles(removed)) {
        setBuildingPlacementBlockedTile(t.x, t.y, false);
      }
    } else {
      setBuildingPlacementBlockedTile(x, y, false);
    }
    this.redrawOverworldPrefabs();
    if (removed && (removed.kind === "wall" || removed.kind === "door")) {
      this.redrawOverworldStructures();
    }
  }

  /** Push cached prefab ghosts into the visible interior view. */
  private applyInteriorPrefabVisuals(buildingX: number, buildingY: number) {
    const me = this.room?.state?.players?.get(this.sessionId);
    if (!me?.inInterior) return;
    if (me.buildingX !== buildingX || me.buildingY !== buildingY) return;
    const key = buildingKey(buildingX, buildingY);
    const tiles = this.prefabsByBuilding.get(key) ?? [];
    if (
      tiles.some((t) => t.kind === "fireplace" || isStorageBoxKind(t.kind)) &&
      !isFurniturePackReady()
    ) {
      this.requestFurnitureArt();
    }
    this.interiorView?.setPrefabGhosts(tiles);
  }

  private dropOverworldPrefabWall(key: string) {
    const wall = this.overworldPrefabWalls.get(key);
    if (!wall) return;
    destroyPartitionDisplay(this, wall);
    this.overworldPrefabWalls.delete(key);
    this.overworldPrefabWallSig.delete(key);
  }

  private clearOverworldPrefabSprites() {
    for (const g of this.overworldPrefabGraphics.values()) g.destroy();
    this.overworldPrefabGraphics.clear();
    for (const wall of this.overworldPrefabWalls.values()) {
      destroyPartitionDisplay(this, wall);
    }
    this.overworldPrefabWalls.clear();
    this.overworldPrefabWallSig.clear();
    for (const s of this.overworldPrefabFireplaces.values()) s.destroy();
    this.overworldPrefabFireplaces.clear();
    for (const s of this.overworldPrefabStorageBoxes.values()) s.destroy();
    this.overworldPrefabStorageBoxes.clear();
    for (const s of this.overworldPrefabFences.values()) s.destroy();
    this.overworldPrefabFences.clear();
  }

  /** Redraw translucent overworld prefab ghosts (walls/doors/fireplaces). */
  private redrawOverworldPrefabs() {
    const me = this.room?.state?.players?.get(this.sessionId);
    if (me?.inInterior) {
      this.clearOverworldPrefabSprites();
      return;
    }
    const want = new Set(this.prefabsOverworld.keys());
    for (const key of [...this.overworldPrefabGraphics.keys()]) {
      if (!want.has(key)) {
        this.overworldPrefabGraphics.get(key)?.destroy();
        this.dropOverworldPrefabWall(key);
        this.overworldPrefabGraphics.delete(key);
      }
    }
    for (const key of [...this.overworldPrefabWalls.keys()]) {
      if (!want.has(key)) this.dropOverworldPrefabWall(key);
    }
    for (const key of [...this.overworldPrefabFireplaces.keys()]) {
      if (!want.has(key)) {
        this.overworldPrefabFireplaces.get(key)?.destroy();
        this.overworldPrefabFireplaces.delete(key);
      }
    }
    for (const key of [...this.overworldPrefabStorageBoxes.keys()]) {
      if (!want.has(key)) {
        this.overworldPrefabStorageBoxes.get(key)?.destroy();
        this.overworldPrefabStorageBoxes.delete(key);
      }
    }
    for (const key of [...this.overworldPrefabFences.keys()]) {
      if (!want.has(key)) {
        this.overworldPrefabFences.get(key)?.destroy();
        this.overworldPrefabFences.delete(key);
      }
    }

    // Fireplaces are props, not partitions — keep them out of wall adjacency.
    const wallSet = new Set(this.structureWallKeysOverworld);
    for (const k of this.structureDoorsOverworld.keys()) wallSet.add(k);
    for (const tile of this.prefabsOverworld.values()) {
      if (tile.kind === "wall" || tile.kind === "door") {
        wallSet.add(`${tile.x},${tile.y}`);
      }
    }

    for (const tile of this.prefabsOverworld.values()) {
      const key = `${tile.x},${tile.y}`;
      if (tile.kind === "fireplace") {
        this.overworldPrefabGraphics.get(key)?.destroy();
        this.dropOverworldPrefabWall(key);
        this.overworldPrefabGraphics.delete(key);
        this.overworldPrefabFences.get(key)?.destroy();
        this.overworldPrefabFences.delete(key);
        this.overworldPrefabStorageBoxes.get(key)?.destroy();
        this.overworldPrefabStorageBoxes.delete(key);
        if (!textureKeyExists(this, FIREPLACE1_INACTIVE_KEY)) {
          this.requestFurnitureArt();
          continue;
        }
        const iso = cartesianToIso(tile.x + 0.5, tile.y + 0.5);
        const renderHeight = Math.round(FURNITURE_RENDER_HEIGHT_PX * 0.95);
        const groundY = iso.y + TILE_HEIGHT / 2 + Math.round(renderHeight * 0.125);
        let sprite = this.overworldPrefabFireplaces.get(key);
        if (!sprite) {
          sprite = addSpriteForKey(this, iso.x, groundY, FIREPLACE1_INACTIVE_KEY);
          sprite.setOrigin(0.5, 1);
          sprite.setAlpha(0.45);
          this.overworldPrefabFireplaces.set(key, sprite);
        } else {
          applyTextureKey(sprite, FIREPLACE1_INACTIVE_KEY);
          sprite.setPosition(iso.x, groundY);
        }
        this.fitFurnitureSprite(sprite, renderHeight);
        sprite.setDepth(this.placeableRenderDepth(tile.x + 0.5, tile.y + 0.5));
        sprite.setVisible(true);
        continue;
      }

      if (isStorageBoxKind(tile.kind)) {
        this.overworldPrefabGraphics.get(key)?.destroy();
        this.dropOverworldPrefabWall(key);
        this.overworldPrefabGraphics.delete(key);
        this.overworldPrefabFences.get(key)?.destroy();
        this.overworldPrefabFences.delete(key);
        this.overworldPrefabFireplaces.get(key)?.destroy();
        this.overworldPrefabFireplaces.delete(key);
        const textureKey = storageBoxTextureKey(tile.kind);
        if (!textureKeyExists(this, textureKey)) {
          this.requestFurnitureArt();
          continue;
        }
        const layout = this.storageBoxScreenLayout(tile.x, tile.y, tile.kind);
        let sprite = this.overworldPrefabStorageBoxes.get(key);
        if (!sprite) {
          sprite = addSpriteForKey(
            this,
            layout.isoX,
            layout.groundY,
            textureKey,
          );
          sprite.setOrigin(0.5, 1);
          sprite.setAlpha(0.45);
          this.overworldPrefabStorageBoxes.set(key, sprite);
        } else {
          applyTextureKey(sprite, textureKey);
          sprite.setPosition(layout.isoX, layout.groundY);
        }
        this.fitFurnitureSprite(sprite, layout.renderHeight);
        sprite.setDepth(this.placeableRenderDepth(tile.x + 0.5, tile.y + 0.5));
        sprite.setAlpha(0.45);
        sprite.setVisible(true);
        continue;
      }

      if (isStructurePanelKind(tile.kind)) {
        this.overworldPrefabGraphics.get(key)?.destroy();
        this.dropOverworldPrefabWall(key);
        this.overworldPrefabGraphics.delete(key);
        this.overworldPrefabFireplaces.get(key)?.destroy();
        this.overworldPrefabFireplaces.delete(key);
        this.overworldPrefabStorageBoxes.get(key)?.destroy();
        this.overworldPrefabStorageBoxes.delete(key);
        const facing = parseStructureFenceFacing(tile.facing);
        const texKey = structurePanelTextureKey(tile.kind, facing);
        if (!textureKeyExists(this, texKey)) continue;
        let image = this.overworldPrefabFences.get(key);
        if (!image) {
          image = addImageForKey(this, 0, 0, texKey);
          this.overworldPrefabFences.set(key, image);
        } else {
          applyTextureKey(image, texKey);
        }
        layoutChainLinkFenceImage(image, tile.x, tile.y, facing, 0.45, tile.kind);
        image.setDepth(chainLinkFenceSortDepth(tile.x, tile.y, facing, true));
        image.setVisible(true);
        continue;
      }

      if (tile.kind === "fence_corner") {
        this.overworldPrefabGraphics.get(key)?.destroy();
        this.dropOverworldPrefabWall(key);
        this.overworldPrefabGraphics.delete(key);
        this.overworldPrefabFireplaces.get(key)?.destroy();
        this.overworldPrefabFireplaces.delete(key);
        this.overworldPrefabStorageBoxes.get(key)?.destroy();
        this.overworldPrefabStorageBoxes.delete(key);
        const texKey = chainLinkFenceCornerTextureKey(
          parseStructureFenceCorner(tile.facing),
        );
        if (!textureKeyExists(this, texKey)) continue;
        let image = this.overworldPrefabFences.get(key);
        if (!image) {
          image = addImageForKey(this, 0, 0, texKey);
          this.overworldPrefabFences.set(key, image);
        } else {
          applyTextureKey(image, texKey);
        }
        layoutChainLinkFenceCornerImage(
          image,
          tile.x,
          tile.y,
          parseStructureFenceCorner(tile.facing),
          0.45,
        );
        image.setDepth(chainLinkFenceCornerSortDepth(tile.x, tile.y, true));
        image.setVisible(true);
        continue;
      }

      this.overworldPrefabFireplaces.get(key)?.destroy();
      this.overworldPrefabFireplaces.delete(key);
      this.overworldPrefabStorageBoxes.get(key)?.destroy();
      this.overworldPrefabStorageBoxes.delete(key);
      this.overworldPrefabFences.get(key)?.destroy();
      this.overworldPrefabFences.delete(key);
      let g = this.overworldPrefabGraphics.get(key);
      if (!g) {
        g = this.add.graphics();
        this.overworldPrefabGraphics.set(key, g);
      }
      g.clear();
      g.setAlpha(0.45);
      const bias = Math.max(
        interiorWallCornerDepthBias(wallSet, tile.x, tile.y, "ns"),
        interiorWallCornerDepthBias(wallSet, tile.x, tile.y, "ew"),
      );
      g.setDepth(overworldPartitionDepth(tile.x, tile.y, bias));
      const hasN = wallSet.has(`${tile.x},${tile.y - 1}`);
      const hasS = wallSet.has(`${tile.x},${tile.y + 1}`);
      const hasW = wallSet.has(`${tile.x - 1},${tile.y}`);
      const hasE = wallSet.has(`${tile.x + 1},${tile.y}`);
      const runNS = hasN || hasS;
      const runEW = hasW || hasE || (!hasN && !hasS);
      if (tile.kind === "door") {
        this.dropOverworldPrefabWall(key);
        drawInteriorDoorTile(g, tile.x, tile.y, runNS ? "ns" : "ew", false, false);
      } else {
        g.clear();
        const axis = runNS && runEW ? "both" : runNS ? "ns" : "ew";
        const sig = `${hasN ? 1 : 0}${hasS ? 1 : 0}${hasE ? 1 : 0}${hasW ? 1 : 0}`;
        const depth = overworldPartitionDepth(tile.x, tile.y, bias);
        const prev = this.overworldPrefabWalls.get(key);
        if (this.overworldPrefabWallSig.get(key) === sig && prev?.active) {
          prev.setDepth(depth);
          prev.setAlpha(0.45);
          prev.setVisible(true);
          continue;
        }
        this.overworldPrefabWallSig.set(key, sig);
        const display = createPlywoodPartition(
          this,
          tile.x,
          tile.y,
          wallSet,
          axis,
          depth,
          0.45,
          `plywood-wall:oprefab:${tile.x},${tile.y}`,
          prev ?? null,
        );
        if (display instanceof Phaser.GameObjects.Image) {
          this.overworldPrefabWalls.set(key, display);
        } else {
          this.overworldPrefabWalls.delete(key);
        }
      }
    }
  }

  private applyFireplaceStateChanged(msg: {
    x: number;
    y: number;
    inInterior: boolean;
    buildingX: number;
    buildingY: number;
    fuelWood: number;
    activeUntil: number;
    objectType?: string;
  }) {
    if (msg.inInterior && msg.objectType === "mantel") {
      this.chimneySmoke?.setMantel(msg.buildingX, msg.buildingY, msg.activeUntil);
    }
    if (msg.inInterior) {
      const key = buildingKey(msg.buildingX, msg.buildingY);
      const list = this.structureFireplacesByBuilding.get(key);
      const tile = list?.find((f) => f.x === msg.x && f.y === msg.y);
      if (!tile) return;
      tile.fuelWood = msg.fuelWood;
      tile.activeUntil = msg.activeUntil;
      const me = this.room?.state?.players?.get(this.sessionId);
      if (me?.inInterior && me.buildingX === msg.buildingX && me.buildingY === msg.buildingY) {
        this.interiorView?.upsertFireplace(tile);
      }
      return;
    }
    const tile = this.structureFireplacesOverworld.get(`${msg.x},${msg.y}`);
    if (!tile) return;
    tile.fuelWood = msg.fuelWood;
    tile.activeUntil = msg.activeUntil;
    this.upsertOverworldFireplaceSprite(tile);
  }

  private applyDoorStateChanged(
    x: number,
    y: number,
    inInterior: boolean,
    buildingX: number,
    buildingY: number,
    isOpen: boolean,
    isLocked: boolean,
  ) {
    const playDoorSfx = (wasOpen: boolean) => {
      if (wasOpen === isOpen) return;
      const cubicle = inInterior
        ? hospitalCubicleAtTile(buildingX, buildingY, x, y)
        : null;
      const hospital =
        !!cubicle && cubicle.entranceX === x && cubicle.entranceY === y;
      AudioManager.get().playDoor(isOpen, hospital ? "hospital" : "wood", {
        x: x + 0.5,
        y: y + 0.5,
        noiseRadius: 22,
        inInterior,
        buildingX: inInterior ? buildingX : 0,
        buildingY: inInterior ? buildingY : 0,
      });
    };

    if (inInterior) {
      const key = buildingKey(buildingX, buildingY);
      const door = this.structureDoorsByBuilding.get(key)?.find((d) => d.x === x && d.y === y);
      if (!door) return;
      playDoorSfx(door.isOpen);
      door.isOpen = isOpen;
      door.isLocked = isLocked;
      const me = this.room?.state?.players?.get(this.sessionId);
      if (me?.inInterior && me.buildingX === buildingX && me.buildingY === buildingY) {
        this.interiorView?.upsertExtraDoor(door);
      }
      return;
    }

    const door = this.structureDoorsOverworld.get(`${x},${y}`);
    if (!door) return;
    playDoorSfx(door.isOpen);
    door.isOpen = isOpen;
    door.isLocked = isLocked;
    this.redrawOverworldStructures();
  }

  private clearOverworldStructureSprites() {
    for (const g of this.overworldStructureSprites.values()) {
      destroyPartitionDisplay(this, g);
    }
    this.overworldStructureSprites.clear();
  }

  private clearOverworldFireplaceSprites() {
    for (const ev of this.overworldFireplaceExpireEvents.values()) ev.remove(false);
    this.overworldFireplaceExpireEvents.clear();
    for (const sprite of this.overworldFireplaceSprites.values()) sprite.destroy();
    this.overworldFireplaceSprites.clear();
  }

  private setOverworldStructuresVisible(visible: boolean) {
    for (const g of this.overworldStructureSprites.values()) g.setVisible(visible);
    for (const sprite of this.overworldFireplaceSprites.values()) sprite.setVisible(visible);
    for (const sprite of this.overworldStorageBoxSprites.values()) sprite.setVisible(visible);
    for (const sprite of this.overworldFenceSprites.values()) sprite.setVisible(visible);
    for (const sprite of this.overworldFenceCornerSprites.values()) {
      sprite.setVisible(visible);
    }
  }

  private syncOverworldFireplaceSprites() {
    const me = this.room?.state?.players?.get(this.sessionId);
    if (me?.inInterior) {
      this.clearOverworldFireplaceSprites();
      return;
    }
    const want = new Set(this.structureFireplacesOverworld.keys());
    for (const key of [...this.overworldFireplaceSprites.keys()]) {
      if (want.has(key)) continue;
      const [xs, ys] = key.split(",");
      this.removeOverworldFireplaceSprite(Number(xs), Number(ys));
    }
    for (const tile of this.structureFireplacesOverworld.values()) {
      this.upsertOverworldFireplaceSprite(tile);
    }
  }

  private upsertOverworldFireplaceSprite(tile: InteriorFireplaceTile) {
    const me = this.room?.state?.players?.get(this.sessionId);
    if (me?.inInterior) return;
    // Ensure active loop exists after scene reuse / reconnect.
    configureInteriorAnimations(this);
    if (!textureKeyExists(this, FIREPLACE1_INACTIVE_KEY)) {
      this.requestFurnitureArt();
      return;
    }

    const key = `${tile.x},${tile.y}`;
    const iso = cartesianToIso(tile.x + 0.5, tile.y + 0.5);
    const renderHeight = Math.round(FURNITURE_RENDER_HEIGHT_PX * 0.95);
    const groundY = iso.y + TILE_HEIGHT / 2 + Math.round(renderHeight * 0.125);
    const depth = this.placeableRenderDepth(tile.x + 0.5, tile.y + 0.5);

    let sprite = this.overworldFireplaceSprites.get(key);
    if (!sprite) {
      sprite = addSpriteForKey(this, iso.x, groundY, FIREPLACE1_INACTIVE_KEY);
      sprite.setOrigin(0.5, 1);
      this.overworldFireplaceSprites.set(key, sprite);
    } else {
      sprite.setPosition(iso.x, groundY);
    }
    sprite.setDepth(depth);
    sprite.setVisible(true);
    this.applyOverworldFireplaceVisual(sprite, tile.activeUntil);
    this.scheduleOverworldFireplaceExpire(key, tile.activeUntil);
  }

  private removeOverworldFireplaceSprite(x: number, y: number) {
    const key = `${x},${y}`;
    this.overworldFireplaceExpireEvents.get(key)?.remove(false);
    this.overworldFireplaceExpireEvents.delete(key);
    this.overworldFireplaceSprites.get(key)?.destroy();
    this.overworldFireplaceSprites.delete(key);
  }

  private clearOverworldStorageBoxSprites() {
    for (const sprite of this.overworldStorageBoxSprites.values()) sprite.destroy();
    this.overworldStorageBoxSprites.clear();
  }

  private syncOverworldStorageBoxSprites() {
    const me = this.room?.state?.players?.get(this.sessionId);
    if (me?.inInterior) {
      this.clearOverworldStorageBoxSprites();
      return;
    }
    const want = new Set(this.structureStorageBoxesOverworld.keys());
    for (const key of [...this.overworldStorageBoxSprites.keys()]) {
      if (want.has(key)) continue;
      const [xs, ys] = key.split(",");
      this.removeOverworldStorageBoxSprite(Number(xs), Number(ys));
    }
    for (const tile of this.structureStorageBoxesOverworld.values()) {
      this.upsertOverworldStorageBoxSprite(tile);
    }
  }

  private storageBoxScreenLayout(tx: number, ty: number, kind: string) {
    const iso = cartesianToIso(tx + 0.5, ty + 0.5);
    const renderHeight = Math.round(
      FURNITURE_RENDER_HEIGHT_PX * STORAGE_BOX_RENDER_SCALE,
    );
    const groundY =
      iso.y + TILE_HEIGHT / 2 + storageBoxGroundOffset(kind, renderHeight);
    return { isoX: iso.x, groundY, renderHeight, textureKey: storageBoxTextureKey(kind) };
  }

  private upsertOverworldStorageBoxSprite(tile: StorageBoxTile) {
    const me = this.room?.state?.players?.get(this.sessionId);
    if (me?.inInterior) return;
    const textureKey = storageBoxTextureKey(tile.kind);
    if (!textureKeyExists(this, textureKey)) {
      this.requestFurnitureArt();
      return;
    }
    const key = `${tile.x},${tile.y}`;
    const layout = this.storageBoxScreenLayout(tile.x, tile.y, tile.kind);
    let sprite = this.overworldStorageBoxSprites.get(key);
    if (!sprite) {
      sprite = addSpriteForKey(this, layout.isoX, layout.groundY, textureKey);
      sprite.setOrigin(0.5, 1);
      this.overworldStorageBoxSprites.set(key, sprite);
    } else {
      applyTextureKey(sprite, textureKey);
      sprite.setPosition(layout.isoX, layout.groundY);
    }
    this.fitFurnitureSprite(sprite, layout.renderHeight);
    sprite.setDepth(this.placeableRenderDepth(tile.x + 0.5, tile.y + 0.5));
    sprite.setVisible(true);
  }

  private removeOverworldStorageBoxSprite(x: number, y: number) {
    const key = `${x},${y}`;
    this.overworldStorageBoxSprites.get(key)?.destroy();
    this.overworldStorageBoxSprites.delete(key);
  }

  /** Bake the Birchport barracks courtyard into the overworld fence maps. */
  private ensureWorldBarracksFences() {
    for (const panel of BIRCHPORT_BARRACKS_PANELS) {
      this.rememberOverworldFence({
        x: panel.x,
        y: panel.y,
        facing: panel.facing,
        ownerWallet: WORLD_CHAINLINK_OWNER,
        kind: panel.kind,
      });
    }
    for (const corner of BIRCHPORT_BARRACKS_CORNERS) {
      this.structureFenceCornersOverworld.set(`${corner.x},${corner.y}`, {
        x: corner.x,
        y: corner.y,
        corner: corner.corner,
        ownerWallet: WORLD_CHAINLINK_OWNER,
      });
    }
  }

  private rememberOverworldFence(tile: InteriorFenceTile) {
    const origin = `${tile.x},${tile.y}`;
    const prev = this.structureFencesOverworld.get(origin);
    if (prev) {
      for (const t of structureOccupiedTiles({
        kind: prev.kind ?? "fence",
        x: prev.x,
        y: prev.y,
        facing: prev.facing,
      })) {
        this.structureFenceOccupancyOverworld.delete(`${t.x},${t.y}`);
      }
    }
    this.structureFencesOverworld.set(origin, tile);
    for (const t of structureOccupiedTiles({
      kind: tile.kind ?? "fence",
      x: tile.x,
      y: tile.y,
      facing: tile.facing,
    })) {
      this.structureFenceOccupancyOverworld.set(`${t.x},${t.y}`, origin);
    }
  }

  private forgetOverworldFence(x: number, y: number) {
    const origin =
      this.structureFenceOccupancyOverworld.get(`${x},${y}`) ?? `${x},${y}`;
    const tile = this.structureFencesOverworld.get(origin);
    if (tile) {
      for (const t of structureOccupiedTiles({
        kind: tile.kind ?? "fence",
        x: tile.x,
        y: tile.y,
        facing: tile.facing,
      })) {
        this.structureFenceOccupancyOverworld.delete(`${t.x},${t.y}`);
      }
    } else {
      this.structureFenceOccupancyOverworld.delete(`${x},${y}`);
    }
    this.structureFencesOverworld.delete(origin);
  }

  private overworldFenceAt(tx: number, ty: number): InteriorFenceTile | undefined {
    const origin = this.structureFenceOccupancyOverworld.get(`${tx},${ty}`);
    if (!origin) return undefined;
    return this.structureFencesOverworld.get(origin);
  }

  private interiorFenceAt(
    me: { buildingX: number; buildingY: number },
    tx: number,
    ty: number,
  ): InteriorFenceTile | undefined {
    const list =
      this.structureFencesByBuilding.get(buildingKey(me.buildingX, me.buildingY)) ??
      [];
    return list.find((f) =>
      structureOccupiedTiles({
        kind: "fence",
        x: f.x,
        y: f.y,
        facing: f.facing,
      }).some((t) => t.x === tx && t.y === ty),
    );
  }

  private applyOverworldFireplaceVisual(
    sprite: Phaser.GameObjects.Sprite,
    activeUntil: number,
  ) {
    const active = Date.now() < activeUntil;
    if (active && this.anims.exists(FIREPLACE1_ACTIVE_ANIM)) {
      // After extinguish, Phaser keeps currentAnim keyed to Active while
      // stopped — so key-only checks skip play() on relight.
      if (
        !sprite.anims.isPlaying ||
        sprite.anims.currentAnim?.key !== FIREPLACE1_ACTIVE_ANIM
      ) {
        sprite.play(FIREPLACE1_ACTIVE_ANIM);
      }
    } else {
      sprite.anims.stop();
      if (!spriteShowsKey(sprite, FIREPLACE1_INACTIVE_KEY)) {
        applyTextureKey(sprite, FIREPLACE1_INACTIVE_KEY);
      }
    }
    this.fitFurnitureSprite(
      sprite,
      Math.round(FURNITURE_RENDER_HEIGHT_PX * 0.95),
    );
  }

  private scheduleOverworldFireplaceExpire(key: string, activeUntil: number) {
    this.overworldFireplaceExpireEvents.get(key)?.remove(false);
    this.overworldFireplaceExpireEvents.delete(key);
    const remaining = activeUntil - Date.now();
    if (remaining <= 0) return;
    const tile = this.structureFireplacesOverworld.get(key);
    if (!tile) return;
    const ev = this.time.delayedCall(remaining, () => {
      this.overworldFireplaceExpireEvents.delete(key);
      const sprite = this.overworldFireplaceSprites.get(key);
      if (!sprite) return;
      this.applyOverworldFireplaceVisual(sprite, tile.activeUntil);
    });
    this.overworldFireplaceExpireEvents.set(key, ev);
  }

  private clearOverworldFenceSprites() {
    for (const sprite of this.overworldFenceSprites.values()) sprite.destroy();
    this.overworldFenceSprites.clear();
  }

  private syncOverworldFenceSprites() {
    const me = this.room?.state?.players?.get(this.sessionId);
    if (me?.inInterior) {
      this.clearOverworldFenceSprites();
      return;
    }
    this.ensureWorldBarracksFences();
    const want = new Set(this.structureFencesOverworld.keys());
    for (const key of [...this.overworldFenceSprites.keys()]) {
      if (want.has(key)) continue;
      const [xs, ys] = key.split(",");
      this.removeOverworldFenceSprite(Number(xs), Number(ys));
    }
    for (const tile of this.structureFencesOverworld.values()) {
      this.upsertOverworldFenceSprite(tile);
    }
  }

  private upsertOverworldFenceSprite(tile: InteriorFenceTile) {
    const me = this.room?.state?.players?.get(this.sessionId);
    if (me?.inInterior) return;
    const texKey = structurePanelTextureKey(tile.kind, tile.facing);
    if (!textureKeyExists(this, texKey)) return;
    const key = `${tile.x},${tile.y}`;
    let image = this.overworldFenceSprites.get(key);
    if (!image) {
      image = addImageForKey(this, 0, 0, texKey);
      this.overworldFenceSprites.set(key, image);
    } else {
      const gate = BIRCHPORT_BARRACKS_BARGATE;
      const animating =
        tile.x === gate.x &&
        tile.y === gate.y &&
        this.barracksBargateAnimUntil > Date.now();
      if (!animating) applyTextureKey(image, texKey);
    }
    layoutChainLinkFenceImage(image, tile.x, tile.y, tile.facing, 1, tile.kind);
    image.setDepth(chainLinkFenceSortDepth(tile.x, tile.y, tile.facing, true));
    image.setVisible(true);
  }

  private removeOverworldFenceSprite(x: number, y: number) {
    const key = `${x},${y}`;
    this.overworldFenceSprites.get(key)?.destroy();
    this.overworldFenceSprites.delete(key);
  }

  private clearOverworldFenceCornerSprites() {
    for (const sprite of this.overworldFenceCornerSprites.values()) sprite.destroy();
    this.overworldFenceCornerSprites.clear();
  }

  private syncOverworldFenceCornerSprites() {
    const me = this.room?.state?.players?.get(this.sessionId);
    if (me?.inInterior) {
      this.clearOverworldFenceCornerSprites();
      return;
    }
    this.ensureWorldBarracksFences();
    const want = new Set(this.structureFenceCornersOverworld.keys());
    for (const key of [...this.overworldFenceCornerSprites.keys()]) {
      if (want.has(key)) continue;
      const [xs, ys] = key.split(",");
      this.removeOverworldFenceCornerSprite(Number(xs), Number(ys));
    }
    for (const tile of this.structureFenceCornersOverworld.values()) {
      this.upsertOverworldFenceCornerSprite(tile);
    }
  }

  private upsertOverworldFenceCornerSprite(tile: InteriorFenceCornerTile) {
    const me = this.room?.state?.players?.get(this.sessionId);
    if (me?.inInterior) return;
    const texKey = chainLinkFenceCornerTextureKey(tile.corner);
    if (!textureKeyExists(this, texKey)) return;
    const key = `${tile.x},${tile.y}`;
    let image = this.overworldFenceCornerSprites.get(key);
    if (!image) {
      image = addImageForKey(this, 0, 0, texKey);
      this.overworldFenceCornerSprites.set(key, image);
    } else {
      applyTextureKey(image, texKey);
    }
    layoutChainLinkFenceCornerImage(image, tile.x, tile.y, tile.corner, 1);
    image.setDepth(chainLinkFenceCornerSortDepth(tile.x, tile.y, true));
    image.setVisible(true);
  }

  private removeOverworldFenceCornerSprite(x: number, y: number) {
    const key = `${x},${y}`;
    this.overworldFenceCornerSprites.get(key)?.destroy();
    this.overworldFenceCornerSprites.delete(key);
  }

  /** Redraw persistent overworld walls + door leaves (open/closed poses). */
  private redrawOverworldStructures() {
    this.clearOverworldStructureSprites();
    if (
      this.structureWallKeysOverworld.size > 0 ||
      this.structureDoorsOverworld.size > 0
    ) {
      // Solid tiles to draw; adjacency also counts unfinished prefab wall/doors
      // so a partially built row keeps the same facing as the prefab ghosts.
      const solidKeys = new Set(this.structureWallKeysOverworld);
      for (const key of this.structureDoorsOverworld.keys()) solidKeys.add(key);
      const wallSet = new Set(solidKeys);
      for (const tile of this.prefabsOverworld.values()) {
        if (tile.kind === "wall" || tile.kind === "door") {
          wallSet.add(`${tile.x},${tile.y}`);
        }
      }
      for (const key of solidKeys) {
        const [xs, ys] = key.split(",");
        const tx = Number(xs);
        const ty = Number(ys);
        if (!Number.isFinite(tx) || !Number.isFinite(ty)) continue;
        const door = this.structureDoorsOverworld.get(key);
        const hasN = wallSet.has(`${tx},${ty - 1}`);
        const hasS = wallSet.has(`${tx},${ty + 1}`);
        const hasW = wallSet.has(`${tx - 1},${ty}`);
        const hasE = wallSet.has(`${tx + 1},${ty}`);
        const runNS = hasN || hasS;
        const runEW = hasW || hasE || (!hasN && !hasS);
        // One Graphics per tile — as in interiors, a join tile paints both arms
        // together so their faces can be ordered against each other by iso depth.
        const axis = runNS && runEW ? "both" : runNS ? "ns" : "ew";
        const bias = Math.max(
          interiorWallCornerDepthBias(wallSet, tx, ty, "ns"),
          interiorWallCornerDepthBias(wallSet, tx, ty, "ew"),
        );
        const depth = overworldPartitionDepth(tx, ty, bias);
        if (door) {
          const g = this.add.graphics();
          g.setDepth(depth);
          drawWallTile(g, tx, ty, wallSet, axis, door);
          this.overworldStructureSprites.set(key, g);
        } else {
          this.overworldStructureSprites.set(
            key,
            createPlywoodPartition(
              this,
              tx,
              ty,
              wallSet,
              axis,
              depth,
              1,
              `plywood-wall:ow:${tx},${ty}`,
            ),
          );
        }
      }
    }
    // Wall Graphics depths changed — re-clamp fireplaces against them.
    this.refreshPlaceableDepths();
    this.tileManager?.refreshPlayerWallOcclusion();
  }

  /** Find a persistent door at (tx, ty) in the player's current context. */
  private findDoorAt(
    me: {
      inInterior: boolean;
      buildingX: number;
      buildingY: number;
      interiorLevel?: number;
    },
    tx: number,
    ty: number,
  ): InteriorDoorTile | undefined {
    if (me.inInterior) {
      // Upper floors are empty. Ground-floor room doors must not highlight or open.
      if ((me.interiorLevel ?? 0) > 0) return undefined;
      return this.structureDoorsByBuilding
        .get(buildingKey(me.buildingX, me.buildingY))
        ?.find((d) => d.x === tx && d.y === ty);
    }
    return this.structureDoorsOverworld.get(`${tx},${ty}`);
  }

  /**
   * Click-to-use a door: if already standing at the door-front tile centre,
   * interact immediately (open+unlocked or open toggles directly; closed+locked
   * opens the code prompt). Otherwise walk there first — `updateDoorPursuit`
   * finishes the interaction once the player arrives. Returns true when the
   * click was consumed (a door was under the cursor).
   */
  private clearDoorTarget() {
    this.doorTargetTile = null;
    this.doorSprint = false;
    this.clearBargateTarget();
  }

  private clearBargateTarget() {
    this.bargateTargetTile = null;
    this.bargateSprint = false;
  }

  private clearFireplaceTarget() {
    this.fireplaceTargetTile = null;
    this.fireplaceSprint = false;
    this.storageBoxTargetTile = null;
    this.storageBoxSprint = false;
  }

  private clearTreeChopTarget() {
    this.treeChopTargetTile = null;
    this.treeChopApproachTile = null;
    this.treeChopSprint = false;
    this.treeChopStartSentAt = 0;
  }

  /** Prefer inventorySync — schema weapon index can lag / desync for the owner. */
  private localEquippedWeaponIndex(): number {
    const me = this.room?.state?.players?.get(this.sessionId);
    return (
      this.localInventorySync?.equippedWeaponIndex ??
      me?.equippedWeaponIndex ??
      -1
    );
  }

  private hatchetEquipped(): boolean {
    if (
      this.localEquippedWeaponIndex() ===
      weaponIndexFromItemId("weapon_hatchet")
    ) {
      return true;
    }
    const me = this.room?.state?.players?.get(this.sessionId);
    return me?.idleWeapon === "Hatchet";
  }

  private tryInteractDoorAt(screenX: number, screenY: number): boolean {
    if (!this.room) return false;
    const me = this.room.state?.players?.get(this.sessionId);
    if (!me?.alive) return false;
    const worldPt = this.cameras.main.getWorldPoint(screenX, screenY);
    const cart = isoToCartesian(worldPt.x, worldPt.y);
    const tx = Math.floor(cart.x);
    const ty = Math.floor(cart.y);

    const door = this.findDoorAt(me, tx, ty);
    if (!door) return false;

    const now = Date.now();
    const clickKey = `${tx},${ty}`;
    const isDoubleClick =
      clickKey === this.lastDoorClickKey &&
      now - this.lastDoorClickAt < WorldScene.DOUBLE_CLICK_MS;
    this.lastDoorClickKey = clickKey;
    this.lastDoorClickAt = now;
    this.lastClickTime = now;

    this.clearCombatTarget();
    this.clearInteractTarget();
    this.clearLootTarget();
    this.clearFireplaceTarget();
    this.clearTreeChopTarget();

    if (this.tryStartDoorInteract(me, tx, ty, door)) return true;

    this.doorTargetTile = { x: tx, y: ty };
    this.doorSprint = isDoubleClick && (me.stamina ?? 0) > 0;
    const goal = this.doorApproachGoal(me, tx, ty);
    if (goal) {
      this.sendMoveToCoords(goal.x, goal.y, this.doorSprint);
      this.drawMoveTarget(goal.x, goal.y, this.doorSprint);
      this.moveTargetFadeUntil = now + 800;
      this.lastPursuitMoveSentAt = now;
    }
    return true;
  }

  /**
   * If standing at the door-front tile centre, interact and clear the pursuit.
   * Returns false (without clearing) when not yet close enough.
   */
  private tryStartDoorInteract(
    me: {
      x: number;
      y: number;
      inInterior?: boolean;
      buildingX?: number;
      buildingY?: number;
    },
    tx: number,
    ty: number,
    door: InteriorDoorTile,
  ): boolean {
    if (!this.room) return false;
    const goal = this.doorApproachGoal(me, tx, ty);
    if (!goal) return false;
    if (Math.hypot(me.x - goal.x, me.y - goal.y) > PATH_ARRIVAL) {
      return false;
    }

    this.clearDoorTarget();
    this.stopPlayerMovement();

    if (!door.isOpen && door.isLocked) {
      this.pendingDoorCodeTile = { x: tx, y: ty };
      this.doorCodeUI?.openEnter();
      this.notifyTip("locked_door");
      return true;
    }

    const message: ClientMessage = { type: "toggleDoor", payload: { x: tx, y: ty } };
    this.room.send("action", message);
    return true;
  }

  /** Keep pathing toward the door-front tile centre, then interact. */
  private updateDoorPursuit() {
    if (!this.doorTargetTile) return;
    const { x: tx, y: ty } = this.doorTargetTile;
    const me = this.room?.state?.players?.get(this.sessionId);
    if (!me?.alive) {
      this.clearDoorTarget();
      return;
    }
    const door = this.findDoorAt(me, tx, ty);
    if (!door) {
      this.clearDoorTarget();
      return;
    }
    if (this.tryStartDoorInteract(me, tx, ty, door)) return;
    if (this.isBusyWithTimedAction(me)) return;

    const now = Date.now();
    if (now - this.lastPursuitMoveSentAt > 300) {
      const goal = this.doorApproachGoal(me, tx, ty);
      if (!goal) {
        this.clearDoorTarget();
        return;
      }
      const sprint = this.doorSprint && me.stamina > 0;
      this.sendMoveToCoords(goal.x, goal.y, sprint);
      this.lastPursuitMoveSentAt = now;
    }
  }

  /**
   * Walkable stand position for opening/closing a door (tile centre).
   * Room doors use the tile directly inside or outside along the door facing;
   * other doors fall back to the nearest walkable neighbour.
   */
  private doorApproachGoal(
    me: {
      x: number;
      y: number;
      inInterior?: boolean;
      buildingX?: number;
      buildingY?: number;
      interiorLevel?: number;
    },
    tx: number,
    ty: number,
  ): { x: number; y: number } | null {
    let isWalkable: (nx: number, ny: number) => boolean;
    if (me.inInterior && me.buildingX !== undefined && me.buildingY !== undefined) {
      const { iW, iH } = interiorDimensions(me.buildingX, me.buildingY);
      const exit = interiorExitForBuildingAt(me.buildingX, me.buildingY);
      const furnitures = this.searchablesCache
        .filter(
          (s) =>
            s.kind === "furniture" &&
            s.buildingX === me.buildingX &&
            s.buildingY === me.buildingY &&
            (s.level ?? 0) === (me.interiorLevel ?? 0),
        )
        .map((s) => ({
          id: s.id,
          kind: "furniture" as const,
          objectType: s.objectType,
          x: s.x,
          y: s.y,
          searched: s.searched,
          buildingX: s.buildingX,
          buildingY: s.buildingY,
          facing: (s.facing || undefined) as
            | "NE"
            | "NW"
            | "SE"
            | "SW"
            | undefined,
        }));
      isWalkable = interiorWalkable(
        furnitures,
        iW,
        iH,
        exit,
        this.mergedInteriorWalls(me.buildingX, me.buildingY),
        (me.interiorLevel ?? 0) > 0,
      );

      const room = roomAtInteriorDoor(me.buildingX, me.buildingY, tx, ty);
      if (room) {
        const goal = roomDoorApproachGoal(room, me.x, me.y);
        const gtx = Math.floor(goal.x);
        const gty = Math.floor(goal.y);
        if (isWalkable(gtx, gty)) return goal;
      }
    } else {
      isWalkable = (nx, ny) =>
        !isWallTile(nx, ny) &&
        !this.tempOverworldWallKeys.has(`${nx},${ny}`) &&
        !this.structureWallKeysOverworld.has(`${nx},${ny}`) &&
        !this.structureDoorsOverworld.has(`${nx},${ny}`) &&
        !this.structureFenceOccupancyOverworld.has(`${nx},${ny}`) &&
        !this.structureFenceCornersOverworld.has(`${nx},${ny}`) &&
        !this.structureStorageBoxesOverworld.has(`${nx},${ny}`) &&
        !worldChainlinkOccupiesTile(nx, ny);
    }

    const neighbours: { x: number; y: number }[] = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        neighbours.push({ x: tx + dx, y: ty + dy });
      }
    }

    let best: { x: number; y: number } | null = null;
    let bestDist = Infinity;
    for (const t of neighbours) {
      if (!isWalkable(t.x, t.y)) continue;
      const d = Math.hypot(me.x - (t.x + 0.5), me.y - (t.y + 0.5));
      if (d < bestDist) {
        bestDist = d;
        best = t;
      }
    }
    return best ? { x: best.x + 0.5, y: best.y + 0.5 } : null;
  }

  /**
   * Each frame: highlight + pointer-cursor the tile under the cursor when it
   * holds a persistent door, even out of reach (click walks the player up).
   */
  private updateDoorHover(pointer: { x: number; y: number } = this.input.activePointer) {
    const me = this.room?.state?.players?.get(this.sessionId);
    if (!me || this.isOverlayOpen() || this.chatOpen) return;

    const worldPt = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const cart = isoToCartesian(worldPt.x, worldPt.y);
    const tx = Math.floor(cart.x);
    const ty = Math.floor(cart.y);

    const door = this.findDoorAt(me, tx, ty);
    if (!door) return;

    this.game.canvas.style.cursor = "pointer";
    if (me.inInterior) {
      this.interiorView?.highlightTile(tx, ty);
    } else {
      this.tileManager?.highlightInteractionTile(tx, ty);
    }
  }

  private localMilitiaAllowsBarracksGate(): boolean {
    const me = this.room?.state?.players?.get(this.sessionId);
    if (!me) return false;
    return canEnterBirchportBarracks(
      me.ashenMilitiaReputation ?? ASHEN_REP_START,
    );
  }

  private barracksBargateClickable(): boolean {
    const me = this.room?.state?.players?.get(this.sessionId);
    if (!me?.alive || me.inInterior) return false;
    const ptx = Math.floor(me.x);
    const pty = Math.floor(me.y);
    if (isInBirchportBarracksYard(ptx, pty)) return true;
    return this.localMilitiaAllowsBarracksGate();
  }

  private updateBargateHover(pointer: { x: number; y: number } = this.input.activePointer) {
    const me = this.room?.state?.players?.get(this.sessionId);
    if (!me || this.isOverlayOpen() || this.chatOpen) return;
    if (!this.barracksBargateClickable()) return;

    const worldPt = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const cart = isoToCartesian(worldPt.x, worldPt.y);
    const tx = Math.floor(cart.x);
    const ty = Math.floor(cart.y);
    if (!birchportBarracksBargateOccupiesTile(tx, ty)) return;

    this.game.canvas.style.cursor = "pointer";
    this.tileManager?.highlightInteractionTile(tx, ty);
  }

  private bargateApproachGoal(me: { x: number; y: number }): {
    x: number;
    y: number;
  } {
    const inYard = isInBirchportBarracksYard(Math.floor(me.x), Math.floor(me.y));
    const stand = inYard
      ? birchportBarracksBargateInsideStand()
      : birchportBarracksBargateOutsideStand();
    return { x: stand.x + 0.5, y: stand.y + 0.5 };
  }

  private tryInteractBargateAt(screenX: number, screenY: number): boolean {
    if (!this.room || this.structureBuildMode) return false;
    const me = this.room.state?.players?.get(this.sessionId);
    if (!me?.alive || me.inInterior) return false;
    if (!this.barracksBargateClickable()) return false;

    const worldPt = this.cameras.main.getWorldPoint(screenX, screenY);
    const cart = isoToCartesian(worldPt.x, worldPt.y);
    const tx = Math.floor(cart.x);
    const ty = Math.floor(cart.y);
    if (!birchportBarracksBargateOccupiesTile(tx, ty)) return false;

    const now = Date.now();
    const clickKey = `${tx},${ty}`;
    const isDoubleClick =
      clickKey === this.lastBargateClickKey &&
      now - this.lastBargateClickAt < WorldScene.DOUBLE_CLICK_MS;
    this.lastBargateClickKey = clickKey;
    this.lastBargateClickAt = now;
    this.lastClickTime = now;

    this.clearCombatTarget();
    this.clearInteractTarget();
    this.clearLootTarget();
    this.clearFireplaceTarget();
    this.clearTreeChopTarget();
    this.doorTargetTile = null;
    this.doorSprint = false;
    this.bargateSprint = isDoubleClick && (me.stamina ?? 0) > 0;

    const onGate = birchportBarracksBargateOccupiesTile(
      Math.floor(me.x),
      Math.floor(me.y),
    );
    if (onGate || this.barracksBargateAnimUntil > Date.now()) {
      this.clearBargateTarget();
      const dest = birchportBarracksBargateCrossStand(me.x, me.y);
      this.sendMoveToCoords(
        dest.x + 0.5,
        dest.y + 0.5,
        this.bargateSprint,
      );
      this.drawMoveTarget(dest.x + 0.5, dest.y + 0.5, this.bargateSprint);
      this.moveTargetFadeUntil = now + 800;
      return true;
    }

    if (this.tryStartBargateInteract(me)) return true;

    this.bargateTargetTile = { x: tx, y: ty };
    const goal = this.bargateApproachGoal(me);
    this.sendMoveToCoords(goal.x, goal.y, this.bargateSprint);
    this.drawMoveTarget(goal.x, goal.y, this.bargateSprint);
    this.moveTargetFadeUntil = now + 800;
    this.lastPursuitMoveSentAt = now;
    return true;
  }

  private tryStartBargateInteract(me: { x: number; y: number }): boolean {
    if (!this.room) return false;
    const goal = this.bargateApproachGoal(me);
    if (Math.hypot(me.x - goal.x, me.y - goal.y) > PATH_ARRIVAL) {
      return false;
    }

    this.clearBargateTarget();
    const now = Date.now();
    if (now - this.lastBargateEnterAt < 500) return true;
    this.lastBargateEnterAt = now;
    this.playBarracksBargateOpen(BIRCHPORT_BARRACKS_BARGATE.facing);
    const message: ClientMessage = { type: "enterBarracksBargate" };
    this.room.send("action", message);
    return true;
  }

  private updateBargatePursuit() {
    if (!this.bargateTargetTile) return;
    const me = this.room?.state?.players?.get(this.sessionId);
    if (!me?.alive || me.inInterior) {
      this.clearBargateTarget();
      return;
    }
    if (!this.barracksBargateClickable()) {
      this.clearBargateTarget();
      return;
    }
    if (this.tryStartBargateInteract(me)) return;
    if (this.isBusyWithTimedAction(me)) return;

    const now = Date.now();
    if (now - this.lastPursuitMoveSentAt > 300) {
      const goal = this.bargateApproachGoal(me);
      const sprint = this.bargateSprint && me.stamina > 0;
      this.sendMoveToCoords(goal.x, goal.y, sprint);
      this.lastPursuitMoveSentAt = now;
    }
  }

  private clearBarracksBargateAnim() {
    for (const ev of this.barracksBargateAnimEvents) ev.remove(false);
    this.barracksBargateAnimEvents = [];
    this.barracksBargateAnimUntil = 0;
  }

  private barracksBargateSprite(): Phaser.GameObjects.Image | undefined {
    const gate = BIRCHPORT_BARRACKS_BARGATE;
    return this.overworldFenceSprites.get(`${gate.x},${gate.y}`);
  }

  private applyBarracksBargateTexture(texKey: string) {
    const image = this.barracksBargateSprite();
    if (!image || !textureKeyExists(this, texKey)) return;
    applyTextureKey(image, texKey);
    const gate = BIRCHPORT_BARRACKS_BARGATE;
    layoutChainLinkFenceImage(image, gate.x, gate.y, gate.facing, 1, "bargate");
  }

  private playBarracksBargateOpen(facing: "SE" | "SW") {
    const me = this.room?.state?.players?.get(this.sessionId);
    if (me?.inInterior) return;
    this.clearBarracksBargateAnim();
    const frames = BARRACKS_BARGATE_ACTIVE_FRAMES;
    const frameMs = BARRACKS_BARGATE_FRAME_MS;
    const holdMs = BARRACKS_BARGATE_HOLD_MS;
    this.barracksBargateAnimUntil = Date.now() + BARRACKS_BARGATE_OPEN_MS;
    const openMs = (frames - 1) * frameMs;

    const show = (frame: number) => {
      this.applyBarracksBargateTexture(bargateActiveTextureKey(facing, frame));
    };
    show(1);
    for (let f = 2; f <= frames; f++) {
      this.barracksBargateAnimEvents.push(
        this.time.delayedCall((f - 1) * frameMs, () => show(f)),
      );
    }
    this.barracksBargateAnimEvents.push(
      this.time.delayedCall(openMs + holdMs, () => {
        this.barracksBargateAnimUntil = 0;
        this.barracksBargateAnimEvents = [];
        this.applyBarracksBargateTexture(bargateTextureKey(facing));
      }),
    );
  }

  private findFireplaceAt(
    me: { inInterior: boolean; buildingX: number; buildingY: number },
    tx: number,
    ty: number,
  ): InteriorFireplaceTile | undefined {
    if (me.inInterior) {
      return this.structureFireplacesByBuilding
        .get(buildingKey(me.buildingX, me.buildingY))
        ?.find((f) => f.x === tx && f.y === ty);
    }
    return this.structureFireplacesOverworld.get(`${tx},${ty}`);
  }

  private tryInteractFireplaceAt(screenX: number, screenY: number): boolean {
    if (!this.room || this.structureBuildMode) return false;
    const me = this.room.state?.players?.get(this.sessionId);
    if (!me?.alive) return false;
    const worldPt = this.cameras.main.getWorldPoint(screenX, screenY);
    const cart = isoToCartesian(worldPt.x, worldPt.y);
    const tx = Math.floor(cart.x);
    const ty = Math.floor(cart.y);

    const fireplace = this.findFireplaceAt(me, tx, ty);
    if (!fireplace) return false;
    this.storageBoxTargetTile = null;
    this.storageBoxSprint = false;

    const now = Date.now();
    const clickKey = `${tx},${ty}`;
    const isDoubleClick =
      clickKey === this.lastFireplaceClickKey &&
      now - this.lastFireplaceClickAt < WorldScene.DOUBLE_CLICK_MS;
    this.lastFireplaceClickKey = clickKey;
    this.lastFireplaceClickAt = now;
    this.lastClickTime = now;

    this.clearCombatTarget();
    this.clearInteractTarget();
    this.clearLootTarget();
    this.clearDoorTarget();
    this.clearTreeChopTarget();

    if (this.tryStartFireplaceInteract(me, tx, ty)) return true;

    this.fireplaceTargetTile = { x: tx, y: ty };
    this.fireplaceSprint = isDoubleClick && (me.stamina ?? 0) > 0;
    const goal = this.doorApproachGoal(me, tx, ty);
    if (goal) {
      this.sendMoveToCoords(goal.x, goal.y, this.fireplaceSprint);
      this.drawMoveTarget(goal.x, goal.y, this.fireplaceSprint);
      this.moveTargetFadeUntil = now + 800;
      this.lastPursuitMoveSentAt = now;
    }
    return true;
  }

  private tryStartFireplaceInteract(
    me: { x: number; y: number },
    tx: number,
    ty: number,
  ): boolean {
    if (!this.room) return false;
    const ptx = Math.floor(me.x);
    const pty = Math.floor(me.y);
    const adjacent = Math.max(Math.abs(ptx - tx), Math.abs(pty - ty)) <= 1;
    if (!adjacent) return false;

    this.clearFireplaceTarget();
    this.stopPlayerMovement();
    const message: ClientMessage = {
      type: "fireplaceOpen",
      payload: { x: tx, y: ty },
    };
    this.room.send("action", message);
    return true;
  }

  private updateFireplacePursuit() {
    if (!this.fireplaceTargetTile) return;
    const { x: tx, y: ty } = this.fireplaceTargetTile;
    const me = this.room?.state?.players?.get(this.sessionId);
    if (!me?.alive) {
      this.clearFireplaceTarget();
      return;
    }
    const fireplace = this.findFireplaceAt(me, tx, ty);
    if (!fireplace) {
      this.clearFireplaceTarget();
      return;
    }
    if (this.tryStartFireplaceInteract(me, tx, ty)) return;
    if (this.isBusyWithTimedAction(me)) return;

    const now = Date.now();
    if (now - this.lastPursuitMoveSentAt > 300) {
      const goal = this.doorApproachGoal(me, tx, ty);
      if (!goal) {
        this.clearFireplaceTarget();
        return;
      }
      const sprint = this.fireplaceSprint && me.stamina > 0;
      this.sendMoveToCoords(goal.x, goal.y, sprint);
      this.lastPursuitMoveSentAt = now;
    }
  }

  private updateFireplaceHover(
    pointer: { x: number; y: number } = this.input.activePointer,
  ) {
    const me = this.room?.state?.players?.get(this.sessionId);
    if (!me || this.isOverlayOpen() || this.chatOpen || this.structureBuildMode) {
      return;
    }

    const hoveredStation = this.nearestSearchable();
    if (hoveredStation && furnitureIsFurnace(hoveredStation.objectType)) {
      this.game.canvas.style.cursor = "pointer";
      return;
    }

    const worldPt = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const cart = isoToCartesian(worldPt.x, worldPt.y);
    const tx = Math.floor(cart.x);
    const ty = Math.floor(cart.y);

    const fireplace = this.findFireplaceAt(me, tx, ty);
    const storageBox = fireplace ? undefined : this.findStorageBoxAt(me, tx, ty);
    if (!fireplace && !storageBox) return;

    this.game.canvas.style.cursor = "pointer";
    if (me.inInterior) {
      this.interiorView?.highlightTile(tx, ty);
    } else {
      this.tileManager?.highlightInteractionTile(tx, ty);
    }
  }

  private tryInteractTreeChopAt(screenX: number, screenY: number): boolean {
    if (!this.room || this.structureBuildMode) return false;
    const me = this.room.state?.players?.get(this.sessionId);
    if (!me?.alive || me.inInterior || !this.hatchetEquipped()) return false;

    const worldPt = this.cameras.main.getWorldPoint(screenX, screenY);
    const cart = isoToCartesian(worldPt.x, worldPt.y);
    const tx = Math.floor(cart.x);
    const ty = Math.floor(cart.y);
    if (!getStandingTreeAt(tx, ty)) return false;

    const now = Date.now();
    const clickKey = `${tx},${ty}`;
    const isDoubleClick =
      clickKey === this.lastTreeChopClickKey &&
      now - this.lastTreeChopClickAt < WorldScene.DOUBLE_CLICK_MS;
    this.lastTreeChopClickKey = clickKey;
    this.lastTreeChopClickAt = now;
    this.lastClickTime = now;

    this.clearCombatTarget();
    this.clearInteractTarget();
    this.clearLootTarget();
    this.clearDoorTarget();
    this.clearFireplaceTarget();

    this.treeChopTargetTile = { x: tx, y: ty };
    this.treeChopSprint = isDoubleClick && (me.stamina ?? 0) > 0;
    this.treeChopStartSentAt = 0;

    // Adjacent already — start chop and do not send moveTo (cancels chops).
    if (this.tryStartTreeChop(me, tx, ty)) return true;
    if (playerReadyToChopTree(me.x, me.y, tx, ty)) return true;

    const goal =
      this.doorApproachGoal(me, tx, ty) ??
      blockedTileApproachGoal(me.x, me.y, tx, ty, (nx, ny) =>
        this.overworldMoveWalkable(nx, ny),
      );
    if (!goal) {
      this.clearTreeChopTarget();
      return true;
    }
    // Lock the neighbour tile so pursuit doesn't retarget mid-walk.
    this.treeChopApproachTile = {
      x: Math.floor(goal.x),
      y: Math.floor(goal.y),
    };
    this.sendMoveToCoords(
      this.treeChopApproachTile.x + 0.5,
      this.treeChopApproachTile.y + 0.5,
      this.treeChopSprint,
    );
    this.drawMoveTarget(
      this.treeChopApproachTile.x + 0.5,
      this.treeChopApproachTile.y + 0.5,
      this.treeChopSprint,
    );
    this.moveTargetFadeUntil = now + 800;
    this.lastPursuitMoveSentAt = now;
    return true;
  }

  /**
   * Returns true once the chop has actually started (drop pursuit).
   * While adjacent we keep sending chopTree — do NOT stopOnly/moveTo here:
   * early stop can strand the server sim off the approach tile, and moveTo
   * cancels an in-progress chop session.
   */
  private tryStartTreeChop(
    me: { x: number; y: number; anim?: string },
    tx: number,
    ty: number,
  ): boolean {
    if (!this.room || !this.hatchetEquipped()) return false;
    if (!getStandingTreeAt(tx, ty)) return false;

    // Already chopping — drop the chase.
    if (me.anim === "attack" || this.isEntityFiring(this.sessionId)) {
      this.clearTreeChopTarget();
      return true;
    }

    if (!playerReadyToChopTree(me.x, me.y, tx, ty)) return false;

    const now = Date.now();
    if (now - this.treeChopStartSentAt < 350) return false;

    const message: ClientMessage = {
      type: "chopTree",
      payload: { x: tx, y: ty },
    };
    this.room.send("action", message);
    this.treeChopStartSentAt = now;
    return false;
  }

  private updateTreeChopPursuit() {
    if (!this.treeChopTargetTile) return;
    const { x: tx, y: ty } = this.treeChopTargetTile;
    const me = this.room?.state?.players?.get(this.sessionId);
    if (!me?.alive || me.inInterior || !this.hatchetEquipped()) {
      this.clearTreeChopTarget();
      return;
    }
    if (!getStandingTreeAt(tx, ty)) {
      this.clearTreeChopTarget();
      return;
    }
    if (this.tryStartTreeChop(me, tx, ty)) return;
    if (this.isBusyWithTimedAction(me)) return;

    // Adjacent: wait for chop to start — don't repath (moveTo cancels chops).
    if (playerReadyToChopTree(me.x, me.y, tx, ty)) return;

    const now = Date.now();
    if (now - this.lastPursuitMoveSentAt <= 300) return;

    // Prefer the locked approach tile; fall back to a fresh goal if missing.
    let ax = this.treeChopApproachTile?.x;
    let ay = this.treeChopApproachTile?.y;
    if (ax == null || ay == null) {
      const goal =
        this.doorApproachGoal(me, tx, ty) ??
        blockedTileApproachGoal(
          me.x,
          me.y,
          tx,
          ty,
          (nx, ny) => this.overworldMoveWalkable(nx, ny),
        );
      if (!goal) {
        this.clearTreeChopTarget();
        return;
      }
      ax = Math.floor(goal.x);
      ay = Math.floor(goal.y);
      this.treeChopApproachTile = { x: ax, y: ay };
    }

    const sprint =
      this.treeChopSprint &&
      me.stamina > 0 &&
      Math.max(Math.abs(Math.floor(me.x) - ax), Math.abs(Math.floor(me.y) - ay)) > 0;
    this.sendMoveToCoords(ax + 0.5, ay + 0.5, sprint);
    this.lastPursuitMoveSentAt = now;
  }

  private updateTreeChopHover(
    pointer: { x: number; y: number } = this.input.activePointer,
  ) {
    const me = this.room?.state?.players?.get(this.sessionId);
    if (
      !me ||
      me.inInterior ||
      !this.hatchetEquipped() ||
      this.isOverlayOpen() ||
      this.chatOpen ||
      this.structureBuildMode
    ) {
      return;
    }

    const worldPt = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const cart = isoToCartesian(worldPt.x, worldPt.y);
    const tx = Math.floor(cart.x);
    const ty = Math.floor(cart.y);
    if (!getStandingTreeAt(tx, ty)) return;

    this.game.canvas.style.cursor = "pointer";
    this.tileManager?.highlightInteractionTile(tx, ty);
  }

  private clearOverworldTempWallSprites() {
    for (const g of this.overworldTempWallSprites.values()) {
      destroyPartitionDisplay(this, g);
    }
    this.overworldTempWallSprites.clear();
  }

  private setOverworldTempWallsVisible(visible: boolean) {
    for (const g of this.overworldTempWallSprites.values()) {
      g.setVisible(visible);
    }
  }

  private redrawOverworldTempWalls() {
    this.clearOverworldTempWallSprites();
    if (this.tempOverworldWallKeys.size === 0) {
      this.tileManager?.refreshPlayerWallOcclusion();
      return;
    }
    const wallSet = new Set(this.tempOverworldWallKeys);
    for (const key of wallSet) {
      const [xs, ys] = key.split(",");
      const tx = Number(xs);
      const ty = Number(ys);
      if (!Number.isFinite(tx) || !Number.isFinite(ty)) continue;
      const hasN = wallSet.has(`${tx},${ty - 1}`);
      const hasS = wallSet.has(`${tx},${ty + 1}`);
      const hasW = wallSet.has(`${tx - 1},${ty}`);
      const hasE = wallSet.has(`${tx + 1},${ty}`);
      const runNS = hasN || hasS;
      const runEW = hasW || hasE || (!hasN && !hasS);
      const bias = Math.max(
        interiorWallCornerDepthBias(wallSet, tx, ty, "ns"),
        interiorWallCornerDepthBias(wallSet, tx, ty, "ew"),
      );
      const axis = runNS && runEW ? "both" : runNS ? "ns" : "ew";
      this.overworldTempWallSprites.set(
        key,
        createPlywoodPartition(
          this,
          tx,
          ty,
          wallSet,
          axis,
          overworldPartitionDepth(tx, ty, bias),
          1,
          `plywood-wall:temp:${tx},${ty}`,
        ),
      );
    }
    this.tileManager?.refreshPlayerWallOcclusion();
  }

  private clearBuildModePreview() {
    this.interiorView?.clearBuildGhost();
    this.interiorView?.highlightTile(null, null);
    this.overworldBuildGhost?.destroy();
    this.overworldBuildGhost = undefined;
    if (this.overworldBuildGhostWall) {
      destroyPartitionDisplay(this, this.overworldBuildGhostWall);
      this.overworldBuildGhostWall = undefined;
      this.overworldBuildGhostWallSig = "";
    }
    this.overworldBuildGhostFireplace?.destroy();
    this.overworldBuildGhostFireplace = undefined;
    this.overworldBuildGhostStorageBox?.destroy();
    this.overworldBuildGhostStorageBox = undefined;
    this.overworldBuildGhostFence?.destroy();
    this.overworldBuildGhostFence = undefined;
    this.overworldBuildHighlight?.destroy();
    this.overworldBuildHighlight = undefined;
  }

  /** Shared placement validity for both admin /build and player structure build. */
  private isValidBuildTile(tx: number, ty: number): boolean {
    const me = this.room?.state?.players?.get(this.sessionId);
    if (!me) return false;

    // Deconstruct mode: owned solids (any solid in /godmode).
    if (this.structureBuildMode && this.structureBuildKind === "deconstruct") {
      return this.godModeDebug
        ? this.hasPlayerStructureAt(me, tx, ty)
        : this.hasOwnPlayerStructureAt(me, tx, ty);
    }

    const tiles =
      this.structureBuildMode && isStructurePanelKind(this.structureBuildKind)
        ? structureFenceTiles(tx, ty, this.structureFenceFacing)
        : [{ x: tx, y: ty }];
    for (const t of tiles) {
      if (!this.isFreeBuildCell(me, t.x, t.y)) return false;
    }
    // Doorway / Birchport rules are player-build only; admin /build stays free.
    if (this.structureBuildMode && this.buildDenialAt(me, tiles)) return false;
    if (
      this.structureBuildMode &&
      this.structureBuildKind === "door" &&
      !this.isDoorFlankedByWallsClient(me, tx, ty)
    ) {
      return false;
    }
    if (this.structureBuildMode && this.structureBuildKind === "fence_corner") {
      return false;
    }
    return true;
  }

  /**
   * Doorway apron / Birchport rules, mirrored from the server so the ghost goes
   * red instead of the click being swallowed. Returns the reason to show.
   */
  private buildDenialAt(
    me: { inInterior: boolean; buildingX: number; buildingY: number },
    tiles: { x: number; y: number }[],
  ): BuildDenialReason | null {
    const kind = this.structureBuildKind;
    if (kind === "deconstruct") return null;
    if (me.inInterior) {
      return interiorBuildDenial(me.buildingX, me.buildingY, kind);
    }
    for (const t of tiles) {
      const denial = overworldBuildDenial(t.x, t.y, kind);
      if (denial) return denial;
    }
    return null;
  }

  /** One-tile occupancy check used by placement (and expanded for 3×1 fences). */
  private isFreeBuildCell(
    me: {
      inInterior: boolean;
      buildingX: number;
      buildingY: number;
      interiorLevel?: number;
    },
    tx: number,
    ty: number,
  ): boolean {
    if (me.inInterior) {
      const bx = me.buildingX;
      const by = me.buildingY;
      const { iW, iH } = interiorDimensions(bx, by);
      const exit = interiorExitForBuildingAt(bx, by);
      if (tx < 0 || ty < 0 || tx >= iW || ty >= iH) return false;
      if (isInteriorExitTile(tx, ty, exit)) return false;
      const walls = this.mergedInteriorWalls(bx, by);
      if (interiorWallOccupiesTile(walls, tx, ty)) return false;
      const bKey = buildingKey(bx, by);
      const doors = this.structureDoorsByBuilding.get(bKey) ?? [];
      if (doors.some((d) => d.x === tx && d.y === ty)) return false;
      const fireplaces = this.structureFireplacesByBuilding.get(bKey) ?? [];
      if (fireplaces.some((f) => f.x === tx && f.y === ty)) return false;
      if (this.interiorFenceAt(me, tx, ty)) return false;
      const corners = this.structureFenceCornersByBuilding.get(bKey) ?? [];
      if (corners.some((c) => c.x === tx && c.y === ty)) return false;
      const boxes = this.structureStorageBoxesByBuilding.get(bKey) ?? [];
      if (boxes.some((b) => b.x === tx && b.y === ty)) return false;
      const prefabs = this.prefabsByBuilding.get(bKey) ?? [];
      if (prefabs.some((p) => this.prefabOccupiesTile(p, tx, ty))) return false;
      for (const s of this.searchablesCache) {
        if (s.buildingX !== bx || s.buildingY !== by) continue;
        if (s.kind !== "furniture") continue;
        if ((s.level ?? 0) !== (me.interiorLevel ?? 0)) continue;
        if (s.objectType === "groundbackpack") continue;
        if (searchableOccupiesTile(s, tx, ty)) return false;
      }
      return true;
    }

    if (isWallTile(tx, ty)) return false;
    if (this.tempOverworldWallKeys.has(`${tx},${ty}`)) return false;
    if (this.structureWallKeysOverworld.has(`${tx},${ty}`)) return false;
    if (this.structureDoorsOverworld.has(`${tx},${ty}`)) return false;
    if (this.structureFireplacesOverworld.has(`${tx},${ty}`)) return false;
    if (this.structureStorageBoxesOverworld.has(`${tx},${ty}`)) return false;
    if (this.structureFenceOccupancyOverworld.has(`${tx},${ty}`)) return false;
    if (this.structureFenceCornersOverworld.has(`${tx},${ty}`)) return false;
    if (worldChainlinkOccupiesTile(tx, ty)) return false;
    for (const p of this.prefabsOverworld.values()) {
      if (this.prefabOccupiesTile(p, tx, ty)) return false;
    }
    return true;
  }

  private prefabOccupiesTile(p: PrefabTile, tx: number, ty: number): boolean {
    return structureOccupiedTiles(p).some((t) => t.x === tx && t.y === ty);
  }

  /** Local wallet used for ownership checks (deconstruct gating). */
  private localWallet(): string {
    return loadCachedAuthSession()?.wallet ?? "";
  }

  /** True when a solid player wall/door/fireplace exists at (tx, ty). */
  private hasPlayerStructureAt(
    me: { inInterior: boolean; buildingX: number; buildingY: number },
    tx: number,
    ty: number,
  ): boolean {
    if (me.inInterior) {
      const key = buildingKey(me.buildingX, me.buildingY);
      const walls = this.structureWallsByBuilding.get(key) ?? [];
      if (walls.some((w) => w.x === tx && w.y === ty)) return true;
      const doors = this.structureDoorsByBuilding.get(key) ?? [];
      if (doors.some((d) => d.x === tx && d.y === ty)) return true;
      const fireplaces = this.structureFireplacesByBuilding.get(key) ?? [];
      if (fireplaces.some((f) => f.x === tx && f.y === ty)) return true;
      if (this.interiorFenceAt(me, tx, ty)) return true;
      const corners = this.structureFenceCornersByBuilding.get(key) ?? [];
      if (corners.some((c) => c.x === tx && c.y === ty)) return true;
      const boxes = this.structureStorageBoxesByBuilding.get(key) ?? [];
      return boxes.some((b) => b.x === tx && b.y === ty);
    }
    const k = `${tx},${ty}`;
    if (this.structureWallKeysOverworld.has(k)) return true;
    if (this.structureDoorsOverworld.has(k)) return true;
    if (this.structureFireplacesOverworld.has(k)) return true;
    if (this.structureStorageBoxesOverworld.has(k)) return true;
    const fence = this.overworldFenceAt(tx, ty);
    if (fence) return fence.ownerWallet !== WORLD_CHAINLINK_OWNER;
    const corner = this.structureFenceCornersOverworld.get(k);
    return !!corner && corner.ownerWallet !== WORLD_CHAINLINK_OWNER;
  }

  /** True when the local player owns a solid wall/door/fireplace at (tx, ty). */
  private hasOwnPlayerStructureAt(
    me: { inInterior: boolean; buildingX: number; buildingY: number },
    tx: number,
    ty: number,
  ): boolean {
    const wallet = this.localWallet();
    if (!wallet) return false;
    if (me.inInterior) {
      const key = buildingKey(me.buildingX, me.buildingY);
      const walls = this.structureWallsByBuilding.get(key) ?? [];
      if (walls.some((w) => w.x === tx && w.y === ty && w.ownerWallet === wallet)) {
        return true;
      }
      const doors = this.structureDoorsByBuilding.get(key) ?? [];
      if (doors.some((d) => d.x === tx && d.y === ty && d.ownerWallet === wallet)) {
        return true;
      }
      const fireplaces = this.structureFireplacesByBuilding.get(key) ?? [];
      if (
        fireplaces.some(
          (f) => f.x === tx && f.y === ty && f.ownerWallet === wallet,
        )
      ) {
        return true;
      }
      const fence = this.interiorFenceAt(me, tx, ty);
      if (fence && fence.ownerWallet === wallet) return true;
      const corners = this.structureFenceCornersByBuilding.get(key) ?? [];
      if (
        corners.some(
          (c) => c.x === tx && c.y === ty && c.ownerWallet === wallet,
        )
      ) {
        return true;
      }
      const boxes = this.structureStorageBoxesByBuilding.get(key) ?? [];
      return boxes.some(
        (b) => b.x === tx && b.y === ty && b.ownerWallet === wallet,
      );
    }
    const k = `${tx},${ty}`;
    if (this.structureWallOwnersOverworld.get(k) === wallet) return true;
    if (this.structureDoorsOverworld.get(k)?.ownerWallet === wallet) return true;
    if (this.structureFireplacesOverworld.get(k)?.ownerWallet === wallet) {
      return true;
    }
    if (this.structureStorageBoxesOverworld.get(k)?.ownerWallet === wallet) {
      return true;
    }
    const fence = this.overworldFenceAt(tx, ty);
    if (fence && fence.ownerWallet === wallet) return true;
    return (
      this.structureFenceCornersOverworld.get(k)?.ownerWallet === wallet
    );
  }

  /**
   * Solid wall neighbour for door placement — walls only, never doors.
   * Includes procedural/temp walls in interiors and world/temp walls outside.
   */
  private isSolidWallNeighbor(
    me: { inInterior: boolean; buildingX: number; buildingY: number },
    tx: number,
    ty: number,
  ): boolean {
    if (me.inInterior) {
      const key = buildingKey(me.buildingX, me.buildingY);
      const doors = this.structureDoorsByBuilding.get(key) ?? [];
      if (doors.some((d) => d.x === tx && d.y === ty)) return false;
      const structWalls = this.structureWallsByBuilding.get(key) ?? [];
      if (structWalls.some((w) => w.x === tx && w.y === ty)) return true;
      const temp = this.tempInteriorWallsByBuilding.get(key) ?? [];
      if (temp.some((w) => w.x === tx && w.y === ty)) return true;
      return interiorWallOccupiesTile(
        interiorWallsForBuilding(me.buildingX, me.buildingY),
        tx,
        ty,
      );
    }
    const k = `${tx},${ty}`;
    if (this.structureDoorsOverworld.has(k)) return false;
    if (this.structureWallKeysOverworld.has(k)) return true;
    if (this.tempOverworldWallKeys.has(k)) return true;
    return isWallTile(tx, ty);
  }

  /** Door tiles must sit between opposite wall neighbours on one axis. */
  private isDoorFlankedByWallsClient(
    me: { inInterior: boolean; buildingX: number; buildingY: number },
    tx: number,
    ty: number,
  ): boolean {
    const n = this.isSolidWallNeighbor(me, tx, ty - 1);
    const s = this.isSolidWallNeighbor(me, tx, ty + 1);
    const w = this.isSolidWallNeighbor(me, tx - 1, ty);
    const e = this.isSolidWallNeighbor(me, tx + 1, ty);
    return (n && s) || (w && e);
  }

  private setOverworldBuildGhost(
    tx: number,
    ty: number,
    valid: boolean,
    kind: StructureBuildKind | "deconstruct" = "wall",
  ) {
    this.overworldBuildGhostWall?.setVisible(false);
    if (!this.overworldBuildHighlight) {
      this.overworldBuildHighlight = this.add.graphics();
    }
    const hl = this.overworldBuildHighlight;
    if (isStructurePanelKind(kind)) {
      const { w, h } = structureFenceFootprint(this.structureFenceFacing);
      hl.setDepth(tileIndicatorDepth(tx + w - 1, ty + h - 1));
      strokeIsoFootprintOutline(
        hl,
        tx,
        ty,
        w,
        h,
        valid ? 0x00ff88 : 0xff4444,
        valid ? 0.95 : 0.55,
      );
    } else {
      hl.setDepth(tileIndicatorDepth(tx, ty));
      strokeIsoTileOutline(
        hl,
        tx,
        ty,
        valid ? 0x00ff88 : 0xff4444,
        valid ? 0.95 : 0.55,
      );
    }

    if (kind === "deconstruct") {
      this.overworldBuildGhost?.clear();
      this.overworldBuildGhostFireplace?.setVisible(false);
      this.overworldBuildGhostStorageBox?.setVisible(false);
      this.overworldBuildGhostFence?.setVisible(false);
      return;
    }

    if (isStructurePanelKind(kind)) {
      this.overworldBuildGhost?.clear();
      this.overworldBuildGhostFireplace?.setVisible(false);
      this.overworldBuildGhostStorageBox?.setVisible(false);
      const facing = this.structureFenceFacing;
      const texKey = structurePanelTextureKey(kind, facing);
      if (!textureKeyExists(this, texKey)) {
        this.overworldBuildGhostFence?.setVisible(false);
        return;
      }
      let image = this.overworldBuildGhostFence;
      if (!image) {
        image = addImageForKey(this, 0, 0, texKey);
        this.overworldBuildGhostFence = image;
      } else {
        applyTextureKey(image, texKey);
      }
      layoutChainLinkFenceImage(image, tx, ty, facing, 0.45, kind);
      image.setDepth(chainLinkFenceSortDepth(tx, ty, facing, true));
      image.setVisible(true);
      return;
    }

    if (kind === "fence_corner") {
      this.overworldBuildGhost?.clear();
      this.overworldBuildGhostFireplace?.setVisible(false);
      this.overworldBuildGhostStorageBox?.setVisible(false);
      this.overworldBuildGhostFence?.setVisible(false);
      return;
    }

    this.overworldBuildGhostFence?.setVisible(false);

    if (kind === "fireplace") {
      this.overworldBuildGhost?.clear();
      this.overworldBuildGhostStorageBox?.setVisible(false);
      if (!textureKeyExists(this, FIREPLACE1_INACTIVE_KEY)) {
        this.requestFurnitureArt();
        this.overworldBuildGhostFireplace?.setVisible(false);
        return;
      }
      const iso = cartesianToIso(tx + 0.5, ty + 0.5);
      const renderHeight = Math.round(FURNITURE_RENDER_HEIGHT_PX * 0.95);
      const groundY = iso.y + TILE_HEIGHT / 2 + Math.round(renderHeight * 0.125);
      let sprite = this.overworldBuildGhostFireplace;
      if (!sprite) {
        sprite = addSpriteForKey(this, iso.x, groundY, FIREPLACE1_INACTIVE_KEY);
        sprite.setOrigin(0.5, 1);
        sprite.setAlpha(0.45);
        this.overworldBuildGhostFireplace = sprite;
      } else {
        applyTextureKey(sprite, FIREPLACE1_INACTIVE_KEY);
        sprite.setPosition(iso.x, groundY);
      }
      this.fitFurnitureSprite(sprite, renderHeight);
      sprite.setDepth(this.placeableRenderDepth(tx + 0.5, ty + 0.5));
      sprite.setVisible(true);
      return;
    }

    if (isStorageBoxKind(kind)) {
      this.overworldBuildGhost?.clear();
      this.overworldBuildGhostFireplace?.setVisible(false);
      const textureKey = storageBoxTextureKey(kind);
      if (!textureKeyExists(this, textureKey)) {
        this.requestFurnitureArt();
        this.overworldBuildGhostStorageBox?.setVisible(false);
        return;
      }
      const layout = this.storageBoxScreenLayout(tx, ty, kind);
      let sprite = this.overworldBuildGhostStorageBox;
      if (!sprite) {
        sprite = addSpriteForKey(this, layout.isoX, layout.groundY, textureKey);
        sprite.setOrigin(0.5, 1);
        sprite.setAlpha(0.45);
        this.overworldBuildGhostStorageBox = sprite;
      } else {
        applyTextureKey(sprite, textureKey);
        sprite.setPosition(layout.isoX, layout.groundY);
      }
      this.fitFurnitureSprite(sprite, layout.renderHeight);
      sprite.setDepth(this.placeableRenderDepth(tx + 0.5, ty + 0.5));
      sprite.setAlpha(0.45);
      sprite.setVisible(true);
      return;
    }

    this.overworldBuildGhostFireplace?.setVisible(false);
    this.overworldBuildGhostStorageBox?.setVisible(false);

    if (!this.overworldBuildGhost) {
      this.overworldBuildGhost = this.add.graphics();
    }
    const g = this.overworldBuildGhost;
    g.clear();
    g.setAlpha(0.45);
    g.setDepth(overworldPartitionDepth(tx, ty, 2));
    const wallSet = new Set(this.tempOverworldWallKeys);
    for (const k of this.structureWallKeysOverworld) wallSet.add(k);
    for (const k of this.structureDoorsOverworld.keys()) wallSet.add(k);
    for (const tile of this.prefabsOverworld.values()) {
      if (tile.kind === "wall" || tile.kind === "door") {
        wallSet.add(`${tile.x},${tile.y}`);
      }
    }
    wallSet.add(`${tx},${ty}`);
    const hasN = wallSet.has(`${tx},${ty - 1}`);
    const hasS = wallSet.has(`${tx},${ty + 1}`);
    const hasW = wallSet.has(`${tx - 1},${ty}`);
    const hasE = wallSet.has(`${tx + 1},${ty}`);
    const runNS = hasN || hasS;
    const runEW = hasW || hasE || (!hasN && !hasS);
    if (kind === "door") {
      drawInteriorDoorTile(g, tx, ty, runNS ? "ns" : "ew", false, false);
      return;
    }
    g.clear();
    const axis = runNS && runEW ? "both" : runNS ? "ns" : "ew";
    const sig = `${tx},${ty}:${hasN ? 1 : 0}${hasS ? 1 : 0}${hasE ? 1 : 0}${hasW ? 1 : 0}`;
    const depth = overworldPartitionDepth(tx, ty, 2);
    if (this.overworldBuildGhostWallSig === sig && this.overworldBuildGhostWall?.active) {
      this.overworldBuildGhostWall.setDepth(depth);
      this.overworldBuildGhostWall.setAlpha(0.45);
      this.overworldBuildGhostWall.setVisible(true);
      return;
    }
    this.overworldBuildGhostWallSig = sig;
    const display = createPlywoodPartition(
      this,
      tx,
      ty,
      wallSet,
      axis,
      depth,
      0.45,
      "plywood-wall:oghost",
      this.overworldBuildGhostWall ?? null,
    );
    this.overworldBuildGhostWall =
      display instanceof Phaser.GameObjects.Image ? display : undefined;
  }

  private updateBuildModeHover(
    pointer: { x: number; y: number } = this.input.activePointer,
  ) {
    const active = this.buildMode || this.structureBuildMode;
    if (!active) return;
    if (this.isOverlayOpen() || this.chatOpen) {
      this.clearBuildModePreview();
      return;
    }
    const me = this.room?.state?.players?.get(this.sessionId);
    if (!me) {
      this.clearBuildModePreview();
      return;
    }

    const kind: StructureBuildKind | "deconstruct" = this.buildMode
      ? "wall"
      : this.structureBuildKind;
    if (
      (kind === "fireplace" || isStorageBoxKind(kind)) &&
      !isFurniturePackReady()
    ) {
      this.requestFurnitureArt();
    }
    const worldPt = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const cart = isoToCartesian(worldPt.x, worldPt.y);
    const tx = Math.floor(cart.x);
    const ty = Math.floor(cart.y);
    const valid = this.isValidBuildTile(tx, ty);

    if (me.inInterior) {
      this.overworldBuildGhost?.destroy();
      this.overworldBuildGhost = undefined;
      if (this.overworldBuildGhostWall) {
        destroyPartitionDisplay(this, this.overworldBuildGhostWall);
        this.overworldBuildGhostWall = undefined;
        this.overworldBuildGhostWallSig = "";
      }
      this.overworldBuildGhostFireplace?.destroy();
      this.overworldBuildGhostFireplace = undefined;
      this.overworldBuildGhostStorageBox?.destroy();
      this.overworldBuildGhostStorageBox = undefined;
      this.overworldBuildGhostFence?.destroy();
      this.overworldBuildGhostFence = undefined;
      this.overworldBuildHighlight?.destroy();
      this.overworldBuildHighlight = undefined;
      this.interiorView?.setBuildGhost(
        tx,
        ty,
        valid,
        kind,
        this.structureFenceFacing,
      );
      return;
    }

    this.interiorView?.clearBuildGhost();
    this.interiorView?.highlightTile(null, null);
    this.setOverworldBuildGhost(tx, ty, valid, kind);
  }

  private tryBuildWallAt(screenX: number, screenY: number): boolean {
    if ((!this.buildMode && !this.structureBuildMode) || !this.room) return false;
    const me = this.room.state?.players?.get(this.sessionId);
    if (!me?.alive) return true;
    const worldPt = this.cameras.main.getWorldPoint(screenX, screenY);
    const cart = isoToCartesian(worldPt.x, worldPt.y);
    const tx = Math.floor(cart.x);
    const ty = Math.floor(cart.y);
    if (!this.isValidBuildTile(tx, ty)) {
      // An occupied tile reads as obvious, but "doorway" and "Birchport" do
      // not, so say why rather than letting the click do nothing.
      if (this.structureBuildMode) {
        const denial = this.buildDenialAt(
          me,
          isStructurePanelKind(this.structureBuildKind)
            ? structureFenceTiles(tx, ty, this.structureFenceFacing)
            : [{ x: tx, y: ty }],
        );
        if (denial) {
          this.lootPopup?.show([], {
            header: `${BUILD_DENIAL_MESSAGES[denial]}`,
          });
        }
      }
      return true;
    }

    if (this.buildMode) {
      const message: ClientMessage = {
        type: "placeTempWall",
        payload: { x: tx, y: ty },
      };
      this.room.send("action", message);
      return true;
    }

    if (this.structureBuildKind === "deconstruct") {
      const message: ClientMessage = {
        type: "deconstructOpen",
        payload: { x: tx, y: ty },
      };
      this.room.send("action", message);
      return true;
    }

    const placeKind = this.structureBuildKind;
    if (placeKind === "fence_corner") return true;
    if (placeKind === "door") {
      // Remember this tile so applyPrefabBuilt can clear the pending marker;
      // the set-code prompt itself runs on prefabBuilt for owned doors.
      this.pendingOwnDoorPlacement = { x: tx, y: ty };
    }
    const message: ClientMessage = {
      type: "placePrefab",
      payload: {
        x: tx,
        y: ty,
        kind: placeKind,
        facing: isStructurePanelKind(placeKind)
          ? this.structureFenceFacing
          : undefined,
      },
    };
    this.room.send("action", message);
    return true;
  }

  private interiorEntityDepth(
    worldX: number,
    worldY: number,
    buildingX?: number,
    buildingY?: number,
  ): number {
    return interiorEntityRenderDepth(
      worldX,
      worldY,
      this.interiorFurnitureDepthFootprints(buildingX, buildingY),
    );
  }

  /**
   * Depth for player-built placeables (fireplaces today; future props too).
   * Uses the same wall / partition occlusion path as living entities so a
   * fireplace north-west of a player wall sits under it, and south-east sits
   * in front — instead of the raw furniture iso key that paints over walls.
   *
   * `excludeTX/TY` drops the placeable's own footprint so it doesn't clamp
   * against itself when interiors include fireplaces in the furniture list.
   */
  private placeableRenderDepth(
    worldX: number,
    worldY: number,
    opts?: {
      inInterior?: boolean;
      buildingX?: number;
      buildingY?: number;
      excludeTX?: number;
      excludeTY?: number;
    },
  ): number {
    if (!opts?.inInterior) {
      return this.overworldEntityDepth(worldX, worldY);
    }
    const footprints = this.interiorFurnitureDepthFootprints(
      opts.buildingX,
      opts.buildingY,
    ).filter((f) => {
      if (f.partition) return true;
      if (opts.excludeTX === undefined || opts.excludeTY === undefined) {
        return true;
      }
      return !(
        f.ox === opts.excludeTX &&
        f.oy === opts.excludeTY &&
        f.w === 1 &&
        f.h === 1
      );
    });
    return interiorEntityRenderDepth(worldX, worldY, footprints);
  }

  /** Re-apply placeable depths after nearby walls/doors change. */
  private refreshPlaceableDepths() {
    for (const tile of this.structureFireplacesOverworld.values()) {
      const sprite = this.overworldFireplaceSprites.get(`${tile.x},${tile.y}`);
      if (!sprite) continue;
      sprite.setDepth(
        this.placeableRenderDepth(tile.x + 0.5, tile.y + 0.5),
      );
    }
    for (const tile of this.structureFencesOverworld.values()) {
      const sprite = this.overworldFenceSprites.get(`${tile.x},${tile.y}`);
      if (!sprite) continue;
      sprite.setDepth(
        chainLinkFenceSortDepth(tile.x, tile.y, tile.facing, true),
      );
    }
    for (const tile of this.structureFenceCornersOverworld.values()) {
      const sprite = this.overworldFenceCornerSprites.get(`${tile.x},${tile.y}`);
      if (!sprite) continue;
      sprite.setDepth(chainLinkFenceCornerSortDepth(tile.x, tile.y, true));
    }
    this.interiorView?.refreshPlaceableDepths();
  }

  private interiorCorpseDepth(
    worldX: number,
    worldY: number,
    buildingX?: number,
    buildingY?: number,
  ): number {
    return interiorCorpseRenderDepth(
      worldX,
      worldY,
      this.interiorFurnitureDepthFootprints(buildingX, buildingY),
    );
  }

  /**
   * Overworld wall / door / chain-link tiles near (worldX, worldY) as
   * partition footprints. They all draw at wall (or fence) depth, so entities
   * need the same treatment interiors give their partitions: without it an
   * entity on a NW / NE neighbour tile has the higher iso depth and paints
   * over the wall it is standing behind. Chain-link panels also need this so
   * a player east (screen bottom-right) of the north post stays in front of
   * the 3-tile sprite, while west/north of the south end stays behind it.
   *
   * Each footprint carries the depth its Graphics was actually given: overworld
   * walls are lifted in front of building cuboids, so an entity resolved
   * against the plain iso key would sort under the wall it stands in front of.
   */
  private overworldStructureDepthFootprints(
    worldX: number,
    worldY: number,
  ): FurnitureDepthFootprint[] {
    if (
      this.structureWallKeysOverworld.size === 0 &&
      this.structureDoorsOverworld.size === 0 &&
      this.tempOverworldWallKeys.size === 0 &&
      this.structureFencesOverworld.size === 0 &&
      this.structureFenceCornersOverworld.size === 0
    ) {
      return [];
    }
    const tx = Math.floor(worldX);
    const ty = Math.floor(worldY);
    const out: FurnitureDepthFootprint[] = [];
    // Probe the neighbourhood rather than scanning every placed tile — a base
    // can be hundreds of tiles and this runs per entity per frame.
    const reach = OVERWORLD_STRUCTURE_DEPTH_REACH;
    // The server ships every overworld structure to every client, so the fence
    // maps hold the whole world. Probing the occupancy index while walking the
    // box tells us whether iterating them can produce anything at all: it lists
    // every tile a 3-tile panel covers, which is the same overlap test the loops
    // below run. Order of `out` matters (the final pass in
    // applyOverworldStructureEntityDepth assigns, not clamps), so the loops stay
    // as they were and only get skipped when nothing is in range.
    let fenceInRange = false;
    let cornerInRange = false;
    for (let y = ty - reach; y <= ty + reach; y++) {
      for (let x = tx - reach; x <= tx + reach; x++) {
        const key = `${x},${y}`;
        if (!fenceInRange && this.structureFenceOccupancyOverworld.has(key)) {
          fenceInRange = true;
        }
        if (!cornerInRange && this.structureFenceCornersOverworld.has(key)) {
          cornerInRange = true;
        }
        if (
          !this.structureWallKeysOverworld.has(key) &&
          !this.tempOverworldWallKeys.has(key) &&
          !this.structureDoorsOverworld.has(key)
        ) {
          continue;
        }
        const drawn =
          this.overworldStructureSprites.get(key) ??
          this.overworldTempWallSprites.get(key);
        out.push({
          ox: x,
          oy: y,
          w: 1,
          h: 1,
          partition: true,
          depth: drawn?.depth ?? overworldPartitionDepth(x, y),
        });
      }
    }
    // 3-tile panels: AABB against the probe box (origin can sit 2 tiles off).
    if (fenceInRange) {
      for (const fence of this.structureFencesOverworld.values()) {
        const { w, h } = structureFenceFootprint(fence.facing);
        if (
          fence.x + w - 1 < tx - reach ||
          fence.x > tx + reach ||
          fence.y + h - 1 < ty - reach ||
          fence.y > ty + reach
        ) {
          continue;
        }
        out.push(
          chainLinkFenceDepthFootprint(fence.x, fence.y, fence.facing, true),
        );
      }
    }
    if (cornerInRange) {
      for (const corner of this.structureFenceCornersOverworld.values()) {
        if (
          corner.x < tx - reach ||
          corner.x > tx + reach ||
          corner.y < ty - reach ||
          corner.y > ty + reach
        ) {
          continue;
        }
        out.push(chainLinkFenceCornerDepthFootprint(corner.x, corner.y, true));
      }
    }
    return out;
  }

  /**
   * Mirror of the server's overworld hard-cover set (walls, admin /build walls,
   * closed doors) — used for shot line of sight. Fireplaces are excluded:
   * they block walking but not bullets.
   */
  private playerWallAxis(
    x: number,
    y: number,
    wallSet: Set<string>,
  ): "ns" | "ew" | "both" {
    const hasN = wallSet.has(`${x},${y - 1}`);
    const hasS = wallSet.has(`${x},${y + 1}`);
    const hasW = wallSet.has(`${x - 1},${y}`);
    const hasE = wallSet.has(`${x + 1},${y}`);
    const runNS = hasN || hasS;
    const runEW = hasW || hasE || (!hasN && !hasS);
    if (runNS && runEW) return "both";
    return runNS ? "ns" : "ew";
  }

  /**
   * Player walls and doors that may cover a clicked floor diamond. Interior
   * and overworld use the walls that are actually drawn.
   */
  private playerWallOccluders(
    tileX: number,
    tileY: number,
  ): readonly PlayerWallOccluder[] {
    const me = this.room?.state?.players?.get(this.sessionId);
    if (me?.inInterior) {
      return this.interiorView?.playerWallOccludersNear(tileX, tileY) ?? [];
    }
    return this.overworldPlayerWallOccluders(tileX, tileY);
  }

  private overworldPlayerWallOccluders(
    tileX: number,
    tileY: number,
  ): PlayerWallOccluder[] {
    const reach = PLAYER_WALL_OCCLUSION_REACH;
    const wallSet = new Set(this.structureWallKeysOverworld);
    for (const key of this.structureDoorsOverworld.keys()) wallSet.add(key);
    for (const tile of this.prefabsOverworld.values()) {
      if (tile.kind === "wall" || tile.kind === "door") {
        wallSet.add(`${tile.x},${tile.y}`);
      }
    }
    const out: PlayerWallOccluder[] = [];
    for (let y = tileY - reach; y <= tileY + reach; y++) {
      for (let x = tileX - reach; x <= tileX + reach; x++) {
        const key = `${x},${y}`;
        const temp = this.tempOverworldWallKeys.has(key);
        const door = this.structureDoorsOverworld.get(key);
        const solid = this.structureWallKeysOverworld.has(key);
        if (!solid && !door && !temp) continue;
        const placed = this.overworldStructureSprites.get(key);
        const sprite = placed ?? this.overworldTempWallSprites.get(key);
        if (!sprite?.visible) continue;
        const depth = sprite.depth;
        const shapeSet = placed ? wallSet : this.tempOverworldWallKeys;
        if (door && placed) {
          out.push({
            kind: "door",
            x,
            y,
            axis: this.playerWallAxis(x, y, wallSet),
            isOpen: door.isOpen,
            depth,
          });
          continue;
        }
        out.push({
          kind: "wall",
          x,
          y,
          axis: this.playerWallAxis(x, y, shapeSet),
          depth,
          wallSet: shapeSet,
        });
      }
    }
    return out;
  }

  private overworldSightBlockedAt(tx: number, ty: number): boolean {
    const key = `${tx},${ty}`;
    if (this.structureWallKeysOverworld.has(key)) return true;
    if (this.tempOverworldWallKeys.has(key)) return true;
    const door = this.structureDoorsOverworld.get(key);
    return !!door && !door.isOpen;
  }

  private overworldEntityDepth(worldX: number, worldY: number): number {
    const base = overworldEntityRenderDepth(worldX, worldY);
    const footprints = this.overworldStructureDepthFootprints(worldX, worldY);
    if (footprints.length === 0) return base;
    return applyOverworldStructureEntityDepth(
      base,
      Math.floor(worldX),
      Math.floor(worldY),
      footprints,
    );
  }

  private overworldCorpseDepth(worldX: number, worldY: number): number {
    const base = overworldCorpseRenderDepth(worldX, worldY);
    const footprints = this.overworldStructureDepthFootprints(worldX, worldY);
    if (footprints.length === 0) return base;
    return applyOverworldStructureEntityDepth(
      base,
      Math.floor(worldX),
      Math.floor(worldY),
      footprints,
    );
  }

  private clearPendingTouchTap() {
    this.pendingTouchTap = null;
  }

  /**
   * Primary click / tap: combat, interact, loot, or move.
   * `pointer` is optional (used for shift-queue on desktop).
   */
  private handlePrimaryPointerAt(
    screenX: number,
    screenY: number,
    pointer?: Phaser.Input.Pointer,
  ) {
    const pos = { x: screenX, y: screenY };

    // Aiming: every click is a shot or a melee swing down the cursor line.
    // Nothing else (interact, loot, move) may steal the click while aiming.
    if (this.aimHeld) {
      // Keeps the target tint under the tap on touch, where there is no move
      // event. It no longer feeds the aim point.
      this.updateEntityHover(pos);
      if (this.localEquippedIsMelee()) this.swingMeleeAt(screenX, screenY);
      else this.fireFreeAimAt(screenX, screenY);
      return;
    }

    if (this.tryBuildWallAt(screenX, screenY)) return;
    if (this.tryInteractDoorAt(screenX, screenY)) return;
    if (this.tryInteractBargateAt(screenX, screenY)) return;
    if (this.tryInteractFireplaceAt(screenX, screenY)) return;
    if (this.tryInteractStorageBoxAt(screenX, screenY)) return;
    if (this.tryInteractPrefabAt(screenX, screenY)) return;
    if (this.tryInteractTreeChopAt(screenX, screenY)) return;

    // The outside doorway always leaves. A zombie or a body on that strip must
    // not turn the click into a fight or a search.
    const leavingInterior = this.pointerIsInteriorExit(screenX, screenY);

    // Resolve hover at click position so combat vs move matches what the player sees
    if (!leavingInterior) this.updateEntityHover(pos);

    // Clicking an entity with a melee weapon → combat targeting. Firearms never
    // reach here: their hover is suppressed unless CTRL is held.
    if (!leavingInterior && this.hoveredEntityId && this.hoveredEntityKind) {
      const me = this.room?.state?.players?.get(this.sessionId);
      if (me?.alive && (me.equippedWeaponIndex ?? -1) >= 0) {
        this.clearDoorTarget();
        this.clearFireplaceTarget();
        this.clearTreeChopTarget();
        this.handleCombatClick();
        return;
      }
      // Unarmed click on TraderMan / Red Order → pursue the moving NPC
      if (
        me?.alive &&
        (me.equippedWeaponIndex ?? -1) < 0 &&
        this.getInteractableHoverAction()
      ) {
        this.clearDoorTarget();
        this.clearFireplaceTarget();
        this.clearTreeChopTarget();
        this.handleInteractClick();
        return;
      }
    }

    if (!leavingInterior) {
      // Furniture / lootable corpse: click walks (or double-click sprints) then searches
      this.updateSearchHover(pos);
      this.updateLootableHover(pos);
      const lootClick = this.handleLootClick();
      if (lootClick === "started" || lootClick === "armed") {
        this.clearDoorTarget();
        this.clearFireplaceTarget();
        this.clearTreeChopTarget();
        return;
      }
    }
    this.lastLootClickId = null;
    // Clicking ground or building → cancel any pursuit and move
    this.clearCombatTarget();
    this.clearInteractTarget();
    this.clearLootTarget();
    this.clearDoorTarget();
    this.clearFireplaceTarget();
    this.clearTreeChopTarget();
    // Show building highlight if clicking a wall tile
    const worldPt2 = this.cameras.main.getWorldPoint(screenX, screenY);
    const cart2 = isoToCartesian(worldPt2.x, worldPt2.y);
    const clickTX = Math.floor(cart2.x);
    const clickTY = Math.floor(cart2.y);
    const inside = this.room?.state?.players?.get(this.sessionId)?.inInterior;
    if (!inside && isWallTile(clickTX, clickTY)) {
      this.tileManager?.highlightBuilding(clickTX, clickTY);
    } else {
      this.tileManager?.highlightBuilding(null, null);
    }
    const queue =
      !!pointer &&
      pointer.event instanceof MouseEvent &&
      pointer.event.shiftKey;
    this.sendMoveToScreen(screenX, screenY, queue);
  }

  private sendMoveTo(pointer: Phaser.Input.Pointer) {
    const queue = pointer.event instanceof MouseEvent && pointer.event.shiftKey;
    this.sendMoveToScreen(pointer.x, pointer.y, queue);
  }

  private sendMoveToScreen(screenX: number, screenY: number, queue = false) {
    if (!this.room) return;
    const world = this.cameras.main.getWorldPoint(screenX, screenY);
    const cart = isoToCartesian(world.x, world.y);
    let clickTX = Math.floor(cart.x);
    let clickTY = Math.floor(cart.y);

    const me = this.room.state.players.get(this.sessionId);

    // Corner / panel art is larger than occupancy. Hitting the mesh counts as
    // clicking that structure so routing matches the 3×1 rows.
    const fenceHit = me?.inInterior
      ? this.interiorView?.pickSolidFenceBlockerAtWorld(
          world.x,
          world.y,
          clickTX,
          clickTY,
        )
      : this.pickOverworldSolidFenceBlockerAtWorld(
          world.x,
          world.y,
          clickTX,
          clickTY,
        );
    if (fenceHit) {
      if (
        me &&
        birchportBarracksBargateOccupiesTile(fenceHit.x, fenceHit.y) &&
        (this.localCanPassBarracksBargate(fenceHit.x, fenceHit.y) ||
          birchportBarracksBargateOccupiesTile(
            Math.floor(me.x),
            Math.floor(me.y),
          ))
      ) {
        const dest = birchportBarracksBargateCrossStand(me.x, me.y);
        clickTX = dest.x;
        clickTY = dest.y;
      } else {
        clickTX = fenceHit.x;
        clickTY = fenceHit.y;
      }
    }

    let tileX = clickTX + 0.5;
    let tileY = clickTY + 0.5;

    // Blocked tiles: show/path to the neighbour facing the player, not into the blocker.
    // Buildings still route to their entrance.
    if (me?.inInterior) {
      const { iW, iH } = interiorDimensions(me.buildingX, me.buildingY);
      const exit = interiorExitForBuildingAt(me.buildingX, me.buildingY);
      const furnitures = this.searchablesCache
        .filter(
          (s) =>
            s.kind === "furniture" &&
            s.buildingX === me.buildingX &&
            s.buildingY === me.buildingY &&
            (s.level ?? 0) === (me.interiorLevel ?? 0),
        )
        .map((s) => ({
          id: s.id,
          kind: "furniture" as const,
          objectType: s.objectType,
          x: s.x,
          y: s.y,
          searched: s.searched,
          buildingX: s.buildingX,
          buildingY: s.buildingY,
          facing: (s.facing || undefined) as
            | "NE"
            | "NW"
            | "SE"
            | "SW"
            | undefined,
        }));
      const walkable = interiorWalkable(
        furnitures,
        iW,
        iH,
        exit,
        this.mergedInteriorWalls(me.buildingX, me.buildingY),
        (me.interiorLevel ?? 0) > 0,
      );
      if (
        !isInteriorExitTile(clickTX, clickTY, exit) &&
        !walkable(clickTX, clickTY)
      ) {
        const furniture = findFurnitureAtTile(furnitures, clickTX, clickTY);
        const approach = furniture
          ? furnitureApproachGoal(me.x, me.y, furniture, walkable)
          : blockedTileApproachGoal(
              me.x,
              me.y,
              clickTX,
              clickTY,
              walkable,
            );
        if (approach) {
          tileX = approach.x;
          tileY = approach.y;
        }
      }
    } else if (isWallTile(clickTX, clickTY)) {
      const bld = getBuildingAt(clickTX, clickTY);
      if (bld) {
        const span = Math.max(1, bld.entranceSpan ?? 1);
        const mid = (span - 1) * 0.5;
        const onSE = bld.entranceX === bld.ox + bld.w - 1;
        tileX = bld.entranceX + 0.5 + (onSE ? 0 : mid);
        tileY = bld.entranceY + 0.5 + (onSE ? mid : 0);
      } else {
        const approach = blockedTileApproachGoal(
          me?.x ?? clickTX + 0.5,
          me?.y ?? clickTY + 0.5,
          clickTX,
          clickTY,
          (tx, ty) => this.overworldMoveWalkable(tx, ty),
        );
        if (approach) {
          tileX = approach.x;
          tileY = approach.y;
        }
      }
    } else if (this.isOverworldMovementBlocked(clickTX, clickTY)) {
      const approach = blockedTileApproachGoal(
        me?.x ?? clickTX + 0.5,
        me?.y ?? clickTY + 0.5,
        clickTX,
        clickTY,
        (tx, ty) => this.overworldMoveWalkable(tx, ty),
      );
      if (approach) {
        tileX = approach.x;
        tileY = approach.y;
      }
    }

    // Sprint on any second click within the time window (tile may differ while moving)
    const now = Date.now();
    const wantsSprint =
      !queue && now - this.lastClickTime < WorldScene.DOUBLE_CLICK_MS;
    const sprint = wantsSprint && (me?.stamina ?? 0) > 0;
    this.lastClickTime = now;

    this.sendMoveToCoords(tileX, tileY, sprint, queue);

    // Show tile-click indicator (orange for sprint, green for normal)
    this.drawMoveTarget(tileX, tileY, sprint);
    this.moveTargetFadeUntil = Date.now() + 800;
  }

  /** Draw a diamond outline at the clicked tile position. */
  private drawMoveTarget(wx: number, wy: number, sprint = false) {
    if (!this.moveTarget) return;
    const tx = Math.floor(wx);
    const ty = Math.floor(wy);
    const indicatorDepth = tileIndicatorDepth(tx, ty);
    const sortDepth = overworldEntityRenderDepth(wx, wy);
    const color = sprint ? 0xff8800 : 0x00ff88;

    this.moveTarget.clearMask();
    this.moveTarget.setDepth(indicatorDepth);
    strokeIsoTileOutline(this.moveTarget, tx, ty, color, 0.9);
    this.moveTarget.setAlpha(1);

    this.moveTargetTile = { wx, wy, sprint };
    this.syncMoveTargetOcclusion(tx, ty, sortDepth, color);
  }

  private isLocalPlayerOnMoveTargetTile(): boolean {
    if (!this.moveTargetTile || !this.room) return false;
    const me = this.room.state.players.get(this.sessionId);
    if (!me) return false;
    const { wx, wy } = this.moveTargetTile;
    return Math.floor(me.x) === Math.floor(wx) && Math.floor(me.y) === Math.floor(wy);
  }

  private syncMoveTargetOcclusion(
    tx: number,
    ty: number,
    sortDepth: number,
    color: number,
  ) {
    if (!this.moveTargetOccluded || !this.moveTargetOcclusionMask) return;

    // Mobile: BitmapMask + per-frame tree Images contribute to exterior OOMs.
    if (IS_MOBILE) {
      this.moveTargetOccluded.clearMask();
      this.moveTargetOccluded.clear();
      this.moveTargetOccluded.setVisible(false);
      this.moveTargetOcclusionMask.clear();
      return;
    }

    if (this.isLocalPlayerOnMoveTargetTile()) {
      this.moveTargetOccluded.clearMask();
      this.moveTargetOccluded.clear();
      this.moveTargetOccluded.setVisible(false);
      this.moveTargetOcclusionMask.clear();
      return;
    }

    if (this.moveTargetOcclusionMask.applyForTile(tx, ty, sortDepth)) {
      this.moveTargetOccluded.setMask(this.moveTargetOcclusionMask.bitmapMask);
      strokeIsoTileOutline(this.moveTargetOccluded, tx, ty, color, 0.9);
      this.moveTargetOccluded.setVisible(true);
    } else {
      this.moveTargetOccluded.clearMask();
      this.moveTargetOccluded.clear();
      this.moveTargetOccluded.setVisible(false);
      this.moveTargetOcclusionMask.clear();
    }
  }

  private tickMoveTargetIndicator() {
    if (!this.moveTarget) return;
    const remaining = this.moveTargetFadeUntil - Date.now();
    const alpha = remaining <= 0 ? 0 : Math.min(1, remaining / 300);
    this.moveTarget.setAlpha(alpha);

    if (!this.moveTargetOccluded || !this.moveTargetTile) return;

    if (alpha <= 0) {
      this.moveTargetOccluded.setVisible(false);
      this.moveTargetOccluded.setAlpha(0);
      return;
    }

    const { wx, wy, sprint } = this.moveTargetTile;
    const tx = Math.floor(wx);
    const ty = Math.floor(wy);
    const depth = overworldEntityRenderDepth(wx, wy);
    const color = sprint ? 0xff8800 : 0x00ff88;
    this.syncMoveTargetOcclusion(tx, ty, depth, color);
    this.moveTargetOccluded.setAlpha(alpha);
  }

  /** Highlight the building under the cursor as the pointer moves. */
  private updateBuildingHover(pointer: { x: number; y: number }) {
    if (!this.tileManager) return;
    const me = this.room?.state?.players?.get(this.sessionId);
    if (me?.inInterior) { this.tileManager.highlightBuilding(null, null); return; }
    const worldPt = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const cart = isoToCartesian(worldPt.x, worldPt.y);
    const tx = Math.floor(cart.x);
    const ty = Math.floor(cart.y);
    if (isWallTile(tx, ty)) {
      this.tileManager.highlightBuilding(tx, ty);
    } else {
      this.tileManager.highlightBuilding(null, null);
    }
  }

  /**
   * Each frame: tint the entity under the cursor.
   * Weapon equipped → red combat target (any living entity).
   * Unarmed → standing-colored interactable (TraderMan / Red Order) matching
   * that faction's reputation pill.
   * When multiple entities overlap, the one rendered on top (highest depth) wins.
   */
  private updateEntityHover(pointer: { x: number; y: number } = this.input.activePointer) {
    const me = this.room?.state?.players?.get(this.sessionId);
    if (!me?.alive || this.isOverlayOpen() || this.chatOpen) {
      this.clearEntityHover();
      return;
    }

    const equippedWeapon =
      (me.equippedWeaponIndex ?? -1) >= 0
        ? WEAPONS[me.equippedWeaponIndex]
        : undefined;
    // Firearms only mark targets while CTRL-aiming, since a plain click no
    // longer shoots. Melee keeps click-to-attack.
    const weaponEquipped =
      !!equippedWeapon && (isMeleeWeapon(equippedWeapon) || this.aimHeld);
    const worldPt = this.cameras.main.getWorldPoint(pointer.x, pointer.y);

    let bestId: string | null = null;
    let bestKind: CombatEntityKind | null = null;
    let bestDepth = -Infinity;
    let bestNpcKind: number | undefined;

    const considerSprite = (
      id: string,
      sprite: Phaser.GameObjects.Sprite | undefined,
      kind: CombatEntityKind,
      data: { isDead?: boolean; alive?: boolean; npcKind?: number } | undefined,
    ) => {
      if (!data || data.isDead || data.alive === false) return;
      if (!sprite?.visible) return;
      const bounds = sprite.getBounds();
      if (!bounds.contains(worldPt.x, worldPt.y)) return;
      // Desktop: ignore transparent PNG padding so hover/click follows the
      // silhouette (same alpha idea as the behind-cover outline). Mobile keeps
      // the cheap AABB — pixel samples are too heavy there.
      if (!IS_MOBILE && !spriteOpaqueAtWorldPoint(sprite, worldPt.x, worldPt.y)) {
        return;
      }
      if (sprite.depth > bestDepth) {
        bestDepth = sprite.depth;
        bestId = id;
        bestKind = kind;
        bestNpcKind = data.npcKind;
      }
    };

    if (weaponEquipped) {
      for (const [id, sprite] of this.playerSprites) {
        if (id === this.sessionId) continue;
        considerSprite(
          id,
          sprite as unknown as Phaser.GameObjects.Sprite,
          "player",
          sprite?.getData("server") as { isDead?: boolean; alive?: boolean } | undefined,
        );
      }
      for (const [id, sprite] of this.zombieSprites) {
        considerSprite(
          id,
          sprite as unknown as Phaser.GameObjects.Sprite,
          "zombie",
          sprite?.getData("server") as { isDead?: boolean; alive?: boolean } | undefined,
        );
      }
      for (const [id, sprite] of this.guardSprites) {
        considerSprite(
          id,
          sprite as unknown as Phaser.GameObjects.Sprite,
          "guard",
          sprite?.getData("server") as
            | { isDead?: boolean; alive?: boolean; npcKind?: number }
            | undefined,
        );
      }
      for (const [id, sprite] of this.coywolfSprites) {
        considerSprite(
          id,
          sprite as unknown as Phaser.GameObjects.Sprite,
          "coywolf",
          sprite?.getData("server") as { isDead?: boolean; alive?: boolean } | undefined,
        );
      }
      for (const [id, sprite] of this.bearSprites) {
        considerSprite(
          id,
          sprite as unknown as Phaser.GameObjects.Sprite,
          "bear",
          sprite?.getData("server") as { isDead?: boolean; alive?: boolean } | undefined,
        );
      }
      for (const [id, sprite] of this.crowSprites) {
        const data = sprite?.getData("server") as
          | { isDead?: boolean; alive?: boolean; altitude?: number }
          | undefined;
        if (
          equippedWeapon &&
          isMeleeWeapon(equippedWeapon) &&
          crowIsOutOfMeleeReach(data?.altitude ?? 0)
        ) {
          continue;
        }
        considerSprite(
          id,
          sprite as unknown as Phaser.GameObjects.Sprite,
          "crow",
          data,
        );
      }
    } else if (!equippedWeapon) {
      // Hands empty — talkable NPCs (Traders / MilitiaGuard / Red Order).
      for (const [id, sprite] of this.guardSprites) {
        if (!this.talkActionForGuard(id)) continue;
        const data = sprite?.getData("server") as
          | { isDead?: boolean; alive?: boolean; npcKind?: number }
          | undefined;
        considerSprite(
          id,
          sprite as unknown as Phaser.GameObjects.Sprite,
          "guard",
          data,
        );
      }
    }

    const desiredTint = weaponEquipped
      ? 0xff8888
      : bestId && bestKind
        ? this.factionStandingHoverTint(
            bestNpcKind,
            me.ashenReputation ?? ASHEN_REP_START,
            me.ashenMilitiaReputation ?? ASHEN_REP_START,
            me.redOrderReputation ?? RED_ORDER_REP_START,
          )
        : null;
    if (bestId !== this.hoveredEntityId || desiredTint !== this.hoveredEntityTint) {
      this.clearEntityHover();
      this.hoveredEntityId = bestId;
      this.hoveredEntityKind = bestKind;
      this.hoveredEntityTint = bestId && bestKind && desiredTint != null ? desiredTint : null;
      if (bestId && bestKind && this.hoveredEntityTint != null) {
        this.spriteMapForKind(bestKind).get(bestId)?.setTint(this.hoveredEntityTint);
      }
    }
  }

  /**
   * Unarmed hover tint from shared faction standing colours
   * (same palette as the trader / Red Order standing pills).
   */
  private factionStandingHoverTint(
    npcKind: number | undefined,
    ashenReputation: number,
    ashenMilitiaReputation: number,
    redOrderReputation: number,
  ): number {
    let reputation: number | null = null;
    if (
      npcKind === GUARD_NPC_TRADER_MAN ||
      npcKind === GUARD_NPC_TRADER_GUARD
    ) {
      reputation = ashenReputation;
    } else if (npcKind === GUARD_NPC_HUMAN) {
      reputation = ashenMilitiaReputation;
    } else if (npcKind === GUARD_NPC_RED_MAN) {
      reputation = redOrderReputation;
    }
    if (reputation === null) return 0x88ff88;

    switch (factionStanding(reputation)) {
      case "exiled":
        return 0xff7070;
      case "hostile":
        return 0xff6e6e;
      case "wary":
        return 0xffb040;
      case "neutral":
        return 0xc0c0c0;
      case "warm":
        return 0xd0dc50;
      case "friendly":
        return 0x70e880;
      case "allied":
        return 0x70a8f0;
    }
  }

  private spriteMapForKind(kind: CombatEntityKind) {
    if (kind === "player") return this.playerSprites;
    if (kind === "zombie") return this.zombieSprites;
    if (kind === "coywolf") return this.coywolfSprites;
    if (kind === "bear") return this.bearSprites;
    if (kind === "crow") return this.crowSprites;
    return this.guardSprites;
  }

  private resolveEntityKind(id: string): CombatEntityKind | null {
    if (this.playerSprites.has(id)) return "player";
    if (this.zombieSprites.has(id)) return "zombie";
    if (this.coywolfSprites.has(id)) return "coywolf";
    if (this.bearSprites.has(id)) return "bear";
    if (this.crowSprites.has(id)) return "crow";
    if (this.guardSprites.has(id)) return "guard";
    return null;
  }

  private getEntitySprite(id: string) {
    return (
      this.playerSprites.get(id) ??
      this.zombieSprites.get(id) ??
      this.coywolfSprites.get(id) ??
      this.bearSprites.get(id) ??
      this.crowSprites.get(id) ??
      this.guardSprites.get(id)
    );
  }

  private clearEntityHover() {
    if (this.hoveredEntityId && this.hoveredEntityKind) {
      this.spriteMapForKind(this.hoveredEntityKind).get(this.hoveredEntityId)?.clearTint();
    }
    this.hoveredEntityId = null;
    this.hoveredEntityKind = null;
    this.hoveredEntityTint = null;
  }

  /** Unarmed interact target: talk with Traders / MilitiaGuard / Red Order. */
  private getInteractableHoverAction(): "trade" | "dialog" | null {
    if (this.hoveredEntityKind !== "guard" || !this.hoveredEntityId) return null;
    return this.talkActionForGuard(this.hoveredEntityId);
  }

  private talkActionForGuard(guardId: string): "dialog" | null {
    const data = this.guardSprites.get(guardId)?.getData("server") as
      | { npcKind?: number; skin?: number; alive?: boolean; isDead?: boolean }
      | undefined;
    if (data?.alive === false || data?.isDead) return null;
    if (
      data?.npcKind === GUARD_NPC_TRADER_MAN ||
      data?.npcKind === GUARD_NPC_TRADER_GUARD ||
      data?.npcKind === GUARD_NPC_RED_MAN
    ) {
      return "dialog";
    }
    if (
      data?.npcKind === GUARD_NPC_HUMAN &&
      isMilitiaTalkSkin(data.skin)
    ) {
      return "dialog";
    }
    return null;
  }

  private playerInAshenMarket(me: {
    inInterior?: boolean;
    buildingX?: number;
    buildingY?: number;
  }): boolean {
    return (
      !!me.inInterior &&
      typeof me.buildingX === "number" &&
      typeof me.buildingY === "number" &&
      isAshenTraderWarehouse(me.buildingX, me.buildingY)
    );
  }

  /** Wider range only while standing in the Ashen trader warehouse. */
  private npcTalkRange(me: {
    inInterior?: boolean;
    buildingX?: number;
    buildingY?: number;
  }): number | undefined {
    return this.playerInAshenMarket(me) ? ASHEN_MARKET_TALK_RANGE : undefined;
  }

  /**
   * Chase point for talk. Behind the market counter, path to the lobby tile
   * in front of the NPC instead of their unreachable tile.
   */
  private interactChasePoint(
    me: {
      inInterior?: boolean;
      buildingX?: number;
      buildingY?: number;
    },
    npcX: number,
    npcY: number,
  ): { x: number; y: number } {
    if (
      this.playerInAshenMarket(me) &&
      typeof me.buildingX === "number" &&
      typeof me.buildingY === "number"
    ) {
      return (
        ashenMarketApproachPoint(me.buildingX, me.buildingY, npcX, npcY) ?? {
          x: npcX,
          y: npcY,
        }
      );
    }
    return { x: npcX, y: npcY };
  }

  /** Closest talkable NPC in interact range (unarmed E / click). */
  private nearestTalkableNpc(me: {
    x: number;
    y: number;
    inInterior?: boolean;
    buildingX?: number;
    buildingY?: number;
  }): string | null {
    let bestId: string | null = null;
    let bestDist = Infinity;
    const talkRange = this.npcTalkRange(me);
    for (const [id, sprite] of this.guardSprites) {
      if (!this.talkActionForGuard(id)) continue;
      const data = sprite.getData("server") as
        | { x?: number; y?: number; alive?: boolean; isDead?: boolean }
        | undefined;
      if (!data || data.alive === false || data.isDead) continue;
      if (typeof data.x !== "number" || typeof data.y !== "number") continue;
      if (!playerNearEntity(me.x, me.y, data.x, data.y, talkRange)) continue;
      const d = Math.hypot(data.x - me.x, data.y - me.y);
      if (d < bestDist) {
        bestDist = d;
        bestId = id;
      }
    }
    return bestId;
  }

  /**
   * Unarmed click on TraderMan / Red Order: chase their live position.
   * Double-click within the window sprints like normal move.
   */
  private handleInteractClick() {
    const me = this.room?.state?.players?.get(this.sessionId);
    if (!me || !this.hoveredEntityId || !this.hoveredEntityKind || !this.room) {
      return;
    }

    const action = this.getInteractableHoverAction();
    if (!action) return;

    const targetData = this.getEntityData(
      this.hoveredEntityId,
      this.hoveredEntityKind,
    );
    if (!targetData || targetData.isDead || targetData.alive === false) return;

    const now = Date.now();
    const isDoubleClick =
      this.hoveredEntityId === this.lastCombatClickId &&
      now - this.lastCombatClickAt < WorldScene.DOUBLE_CLICK_MS;
    this.lastCombatClickId = this.hoveredEntityId;
    this.lastCombatClickAt = now;
    this.lastClickTime = now;

    this.clearCombatTarget();
    this.clearLootTarget();
    this.interactTargetId = this.hoveredEntityId;
    this.interactTargetKind = this.hoveredEntityKind;
    this.interactAction = action;
    this.interactSprint = isDoubleClick && (me.stamina ?? 0) > 0;

    const talkRange = this.npcTalkRange(me);
    if (playerNearEntity(me.x, me.y, targetData.x, targetData.y, talkRange)) {
      const npcId = this.interactTargetId;
      this.stopPlayerMovement();
      this.clearInteractTarget();
      this.openInteractAction(action, npcId);
      return;
    }

    const chase = this.interactChasePoint(me, targetData.x, targetData.y);
    if (Math.hypot(me.x - chase.x, me.y - chase.y) <= 0.45) {
      this.clearInteractTarget();
      return;
    }
    this.sendMoveToCoords(chase.x, chase.y, this.interactSprint);
    this.lastPursuitMoveSentAt = now;
  }

  private openInteractAction(action: "trade" | "dialog", npcId: string | null) {
    if (!npcId) return;
    if (action === "trade") this.requestTradeOpen(npcId);
    else this.requestDialogOpen(npcId);
  }

  /**
   * Keep re-pathing to the NPC's current coords until adjacent (or cancelled).
   */
  private updateInteractPursuit() {
    if (!this.interactTargetId || !this.interactTargetKind || !this.interactAction) {
      return;
    }

    const me = this.room?.state?.players?.get(this.sessionId);
    if (!me?.alive || (me.equippedWeaponIndex ?? -1) >= 0) {
      this.clearInteractTarget();
      return;
    }

    const targetData = this.getEntityData(
      this.interactTargetId,
      this.interactTargetKind,
    );
    if (!targetData || targetData.isDead || targetData.alive === false) {
      this.clearInteractTarget();
      return;
    }

    const talkRange = this.npcTalkRange(me);
    if (playerNearEntity(me.x, me.y, targetData.x, targetData.y, talkRange)) {
      const npcId = this.interactTargetId;
      const action = this.interactAction;
      this.stopPlayerMovement();
      this.clearInteractTarget();
      this.openInteractAction(action, npcId);
      return;
    }

    const chase = this.interactChasePoint(me, targetData.x, targetData.y);
    if (Math.hypot(me.x - chase.x, me.y - chase.y) <= 0.45) {
      this.clearInteractTarget();
      return;
    }

    if (this.isBusyWithTimedAction(me)) return;

    const now = Date.now();
    if (now - this.lastPursuitMoveSentAt > 300) {
      const sprint = this.interactSprint && me.stamina > 0;
      this.sendMoveToCoords(chase.x, chase.y, sprint);
      this.lastPursuitMoveSentAt = now;
    }
  }

  private clearInteractTarget() {
    this.interactTargetId = null;
    this.interactTargetKind = null;
    this.interactAction = null;
    this.interactSprint = false;
  }

  /**
   * Click a searchable furniture piece or lootable corpse:
   * - single click: walk to the loot approach tile and auto-start search on arrival
   * - double click: same, but sprint if stamina allows
   * @returns "started" when a loot pursuit / search was begun,
   *   "armed" reserved for pairing (unused — both clicks start pursuit),
   *   "miss" when the click was not on a lootable.
   */
  /** Schema floor, or the floor a stair use just switched to. */
  private effectiveInteriorLevel(me: { interiorLevel?: number }): number {
    const schema = me.interiorLevel ?? 0;
    if (this.interiorLevelLatch === null) return schema;
    if (schema === this.interiorLevelLatch) {
      this.interiorLevelLatch = null;
      return schema;
    }
    return this.interiorLevelLatch;
  }

  /** Remember the new floor and do not keep walking out the street door. */
  private noteStairsUsed(currentLevel: number) {
    this.interiorLevelLatch = currentLevel === 0 ? 1 : 0;
    this.pauseMoveAfterStairs = true;
  }

  /** True when the cursor is on the interior's outside exit corridor. */
  private pointerIsInteriorExit(screenX: number, screenY: number): boolean {
    const me = this.room?.state?.players?.get(this.sessionId);
    if (!me?.inInterior || this.effectiveInteriorLevel(me) !== 0) return false;
    const world = this.cameras.main.getWorldPoint(screenX, screenY);
    const cart = isoToCartesian(world.x, world.y);
    const exit = interiorExitForBuildingAt(me.buildingX, me.buildingY);
    return isInteriorExitTile(Math.floor(cart.x), Math.floor(cart.y), exit);
  }

  private handleLootClick(): "started" | "armed" | "miss" {
    const me = this.room?.state?.players?.get(this.sessionId);
    if (!me?.alive || !this.room) return "miss";

    let targetId: string | null = null;
    let targetKind: "searchable" | "zombie" | "guard" | "player" | "coywolf" | "bear" | "crow" | "crow" | null = null;

    const searchable = this.nearestSearchable();
    if (searchable) {
      const overworldBag = searchable.buildingX === OVERWORLD_BAG_BUILDING;
      if (overworldBag ? !me.inInterior : me.inInterior) {
        targetId = searchable.id;
        targetKind = "searchable";
      }
    }
    if (!targetId && this.hoveredLootableId && this.hoveredLootableKind) {
      targetId = this.hoveredLootableId;
      targetKind = this.hoveredLootableKind;
    }
    if (!targetId || !targetKind) return "miss";

    const now = Date.now();
    const isDoubleClick =
      targetId === this.lastLootClickId &&
      now - this.lastLootClickAt < WorldScene.DOUBLE_CLICK_MS;
    this.lastLootClickId = targetId;
    this.lastLootClickAt = now;
    this.lastClickTime = now;

    this.clearCombatTarget();
    this.clearInteractTarget();

    const goal = this.lootApproachGoal(me, targetId, targetKind);

    // Both clicks auto-search on arrival; double-click sprints when possible.
    this.lootTargetId = targetId;
    this.lootTargetKind = targetKind;
    this.lootSprint = isDoubleClick && (me.stamina ?? 0) > 0;

    if (this.tryStartLootTarget(me)) {
      return "started";
    }

    if (goal) {
      this.sendMoveToCoords(goal.x, goal.y, this.lootSprint);
      this.drawMoveTarget(goal.x, goal.y, this.lootSprint);
      this.moveTargetFadeUntil = now + 800;
      this.lastPursuitMoveSentAt = now;
    }
    return "started";
  }

  /** Keep pathing to a loot target until adjacent, then start the search. */
  private updateLootPursuit() {
    if (!this.lootTargetId || !this.lootTargetKind) return;

    const me = this.room?.state?.players?.get(this.sessionId);
    if (!me?.alive) {
      this.clearLootTarget();
      return;
    }

    if (this.tryStartLootTarget(me)) return;
    if (this.isBusyWithTimedAction(me)) return;

    const now = Date.now();
    if (now - this.lastPursuitMoveSentAt > 300) {
      const goal = this.lootApproachGoal(
        me,
        this.lootTargetId,
        this.lootTargetKind,
      );
      if (!goal) {
        this.clearLootTarget();
        return;
      }
      const sprint = this.lootSprint && me.stamina > 0;
      this.sendMoveToCoords(goal.x, goal.y, sprint);
      this.lastPursuitMoveSentAt = now;
    }
  }

  private clearLootTarget() {
    this.lootTargetId = null;
    this.lootTargetKind = null;
    this.lootSprint = false;
  }

  /**
   * If adjacent to the active loot target, stop and send the same start message as E.
   * Clears the loot pursuit on success or if the target is gone / depleted.
   */
  private tryStartLootTarget(me: {
    x: number;
    y: number;
    inInterior?: boolean;
    buildingX?: number;
    buildingY?: number;
    interiorLevel?: number;
    isReloading?: boolean;
    searchTargetId?: string;
    isConsuming?: boolean;
  }): boolean {
    if (!this.room || !this.lootTargetId || !this.lootTargetKind) return false;
    if (this.isBusyWithTimedAction(me)) return false;

    if (this.lootTargetKind === "searchable") {
      const target = this.searchablesCache.find(
        (item) => item.id === this.lootTargetId,
      );
      if (!target) {
        this.clearLootTarget();
        return false;
      }
      const craftStation = furnitureIsCraftStation(target.objectType);
      const furnace = furnitureIsFurnace(target.objectType);
      const stairs = furnitureIsStairs(target.objectType);
      if (craftStation || furnace || stairs) {
        // Stations and stairs stay usable even if previously flagged searched/depleted.
      } else if (target.depleted || !furnitureIsSearchable(target.objectType)) {
        this.clearLootTarget();
        return false;
      }
      const overworldBag = target.buildingX === OVERWORLD_BAG_BUILDING;
      if (overworldBag) {
        if (me.inInterior) {
          this.clearLootTarget();
          return false;
        }
      } else if (
        !me.inInterior ||
        target.buildingX !== me.buildingX ||
        target.buildingY !== me.buildingY ||
        (target.level ?? 0) !== (me.interiorLevel ?? 0)
      ) {
        this.clearLootTarget();
        return false;
      }
      // Floor bags: click-loot waits until standing on the pile tile.
      if (isGroundBackpackType(target.objectType)) {
        if (
          Math.floor(me.x) !== target.x ||
          Math.floor(me.y) !== target.y
        ) {
          return false;
        }
      } else if (!playerAdjacentToSearchable(me.x, me.y, target)) {
        return false;
      }
      this.stopPlayerMovement();
      this.clearLootTarget();
      if (furnace) {
        const message: ClientMessage = {
          type: "fireplaceOpen",
          payload: { x: target.x, y: target.y },
        };
        this.room.send("action", message);
        return true;
      }
      if (stairs) {
        this.noteStairsUsed(me.interiorLevel ?? 0);
        const message: ClientMessage = {
          type: "useStairs",
          payload: { searchableId: target.id },
        };
        this.room.send("action", message);
        return true;
      }
      if (craftStation) {
        const message: ClientMessage = {
          type: "craftOpen",
          payload: { workbenchId: target.id },
        };
        this.room.send("action", message);
        return true;
      }
      const message: ClientMessage = {
        type: "searchStart",
        payload: { searchableId: target.id },
      };
      this.beginOptimisticSearch("furniture", target.objectType);
      this.room.send("action", message);
      this.notifyTutorial("search");
      return true;
    }

    if (this.lootTargetKind === "zombie") {
      const entitySprite = this.zombieSprites.get(this.lootTargetId);
      const entityData = entitySprite?.getData("server") as
        | {
            x: number;
            y: number;
            isDead?: boolean;
            looted?: boolean;
            inInterior?: boolean;
            buildingX?: number;
            buildingY?: number;
          }
        | undefined;
      if (
        !entityData?.isDead ||
        entityData.looted ||
        me.inInterior !== !!entityData.inInterior ||
        (me.inInterior &&
          (entityData.buildingX !== me.buildingX ||
            entityData.buildingY !== me.buildingY))
      ) {
        this.clearLootTarget();
        return false;
      }
      if (!playerNearEntity(me.x, me.y, entityData.x, entityData.y)) return false;
      this.stopPlayerMovement();
      const zombieId = this.lootTargetId;
      this.clearLootTarget();
      const message: ClientMessage = {
        type: "lootZombieStart",
        payload: { zombieId },
      };
      this.beginOptimisticSearch();
      this.room.send("action", message);
      return true;
    }

    if (this.lootTargetKind === "coywolf") {
      const entitySprite = this.coywolfSprites.get(this.lootTargetId);
      const entityData = entitySprite?.getData("server") as
        | { x: number; y: number; isDead?: boolean; looted?: boolean }
        | undefined;
      if (!entityData?.isDead || entityData.looted || me.inInterior) {
        this.clearLootTarget();
        return false;
      }
      if (!playerNearEntity(me.x, me.y, entityData.x, entityData.y)) return false;
      this.stopPlayerMovement();
      const coywolfId = this.lootTargetId;
      this.clearLootTarget();
      const message: ClientMessage = {
        type: "lootCoyoteStart",
        payload: { coywolfId },
      };
      this.beginOptimisticSearch();
      this.room.send("action", message);
      return true;
    }

    if (this.lootTargetKind === "bear") {
      const entitySprite = this.bearSprites.get(this.lootTargetId);
      const entityData = entitySprite?.getData("server") as
        | { x: number; y: number; isDead?: boolean; looted?: boolean }
        | undefined;
      if (!entityData?.isDead || entityData.looted || me.inInterior) {
        this.clearLootTarget();
        return false;
      }
      if (!playerNearEntity(me.x, me.y, entityData.x, entityData.y)) return false;
      this.stopPlayerMovement();
      const bearId = this.lootTargetId;
      this.clearLootTarget();
      const message: ClientMessage = {
        type: "lootBearStart",
        payload: { bearId },
      };
      this.beginOptimisticSearch();
      this.room.send("action", message);
      return true;
    }

    if (this.lootTargetKind === "crow") {
      const entitySprite = this.crowSprites.get(this.lootTargetId);
      const entityData = entitySprite?.getData("server") as
        | { x: number; y: number; isDead?: boolean; looted?: boolean }
        | undefined;
      if (!entityData?.isDead || entityData.looted || me.inInterior) {
        this.clearLootTarget();
        return false;
      }
      if (!playerNearEntity(me.x, me.y, entityData.x, entityData.y)) return false;
      this.stopPlayerMovement();
      const crowId = this.lootTargetId;
      this.clearLootTarget();
      const message: ClientMessage = {
        type: "lootCrowStart",
        payload: { crowId },
      };
      this.beginOptimisticSearch();
      this.room.send("action", message);
      return true;
    }

    if (this.lootTargetKind === "player") {
      const entitySprite = this.corpseSprites.get(this.lootTargetId);
      const entityData = entitySprite?.getData("server") as
        | {
            x: number;
            y: number;
            looted?: boolean;
            inInterior?: boolean;
            buildingX?: number;
            buildingY?: number;
          }
        | undefined;
      if (
        !entityData ||
        entityData.looted ||
        me.inInterior !== !!entityData.inInterior ||
        (me.inInterior &&
          (entityData.buildingX !== me.buildingX ||
            entityData.buildingY !== me.buildingY))
      ) {
        this.clearLootTarget();
        return false;
      }
      if (!playerNearEntity(me.x, me.y, entityData.x, entityData.y)) return false;
      this.stopPlayerMovement();
      const corpseId = this.lootTargetId;
      this.clearLootTarget();
      const message: ClientMessage = {
        type: "lootPlayerStart",
        payload: { corpseId },
      };
      this.beginOptimisticSearch();
      this.room.send("action", message);
      return true;
    }

    // guard
    const entitySprite = this.guardSprites.get(this.lootTargetId);
    const entityData = entitySprite?.getData("server") as
      | { x: number; y: number; isDead?: boolean; looted?: boolean }
      | undefined;
    if (!entityData?.isDead || entityData.looted) {
      this.clearLootTarget();
      return false;
    }
    if (me.inInterior) {
      // Dead Red Order / interior guards — same building only.
      const gIn = !!(entityData as { inInterior?: boolean }).inInterior;
      const gBx = (entityData as { buildingX?: number }).buildingX;
      const gBy = (entityData as { buildingY?: number }).buildingY;
      if (
        !gIn ||
        gBx !== me.buildingX ||
        gBy !== me.buildingY
      ) {
        this.clearLootTarget();
        return false;
      }
    } else if ((entityData as { inInterior?: boolean }).inInterior) {
      this.clearLootTarget();
      return false;
    }
    if (!playerNearEntity(me.x, me.y, entityData.x, entityData.y)) return false;
    this.stopPlayerMovement();
    const guardId = this.lootTargetId;
    this.clearLootTarget();
    const message: ClientMessage = {
      type: "lootGuardStart",
      payload: { guardId },
    };
    this.beginOptimisticSearch();
    this.room.send("action", message);
    return true;
  }

  /** Approach tile / corpse position for a loot pursuit. */
  private lootApproachGoal(
    me: {
      x: number;
      y: number;
      inInterior?: boolean;
      buildingX?: number;
      buildingY?: number;
      interiorLevel?: number;
    },
    targetId: string,
    targetKind: "searchable" | "zombie" | "guard" | "player" | "coywolf" | "bear" | "crow" | "crow",
  ): { x: number; y: number } | null {
    if (targetKind === "searchable") {
      const target = this.searchablesCache.find((item) => {
        if (item.id !== targetId) return false;
        // Furnaces are stations, not loot piles, so a depleted flag must not
        // cancel the walk-up that opens the fuel dialog.
        if (furnitureIsFurnace(item.objectType) || furnitureIsStairs(item.objectType)) return true;
        return !item.depleted;
      });
      if (!target) return null;

      // Overworld floor bags — walk onto the pile (always walkable outdoors).
      if (target.buildingX === OVERWORLD_BAG_BUILDING) {
        if (me.inInterior) return null;
        return { x: target.x + 0.5, y: target.y + 0.5 };
      }

      if (
        !me.inInterior ||
        target.buildingX !== me.buildingX ||
        target.buildingY !== me.buildingY
      ) {
        return null;
      }
      // Floor bags — walk onto the pile (walkable in interiors too).
      if (isGroundBackpackType(target.objectType)) {
        return { x: target.x + 0.5, y: target.y + 0.5 };
      }
      const { iW, iH } = interiorDimensions(me.buildingX!, me.buildingY!);
      const exit = interiorExitForBuildingAt(me.buildingX!, me.buildingY!);
      const furnitures = this.searchablesCache
        .filter(
          (s) =>
            s.kind === "furniture" &&
            s.buildingX === me.buildingX &&
            s.buildingY === me.buildingY &&
            (s.level ?? 0) === (me.interiorLevel ?? 0),
        )
        .map((s) => ({
          id: s.id,
          kind: "furniture" as const,
          objectType: s.objectType,
          x: s.x,
          y: s.y,
          searched: s.searched,
          buildingX: s.buildingX,
          buildingY: s.buildingY,
          facing: (s.facing || undefined) as
            | "NE"
            | "NW"
            | "SE"
            | "SW"
            | undefined,
        }));
      const walkable = interiorWalkable(
        furnitures,
        iW,
        iH,
        exit,
        this.mergedInteriorWalls(me.buildingX!, me.buildingY!),
        (me.interiorLevel ?? 0) > 0,
      );
      return furnitureApproachGoal(me.x, me.y, target, walkable);
    }

    const sprite =
      targetKind === "zombie"
        ? this.zombieSprites.get(targetId)
        : targetKind === "coywolf"
          ? this.coywolfSprites.get(targetId)
          : targetKind === "bear"
            ? this.bearSprites.get(targetId)
          : targetKind === "crow"
            ? this.crowSprites.get(targetId)
          : targetKind === "guard"
            ? this.guardSprites.get(targetId)
            : this.corpseSprites.get(targetId);
    const data = sprite?.getData("server") as
      | { x: number; y: number }
      | undefined;
    if (!data) return null;
    return { x: data.x, y: data.y };
  }

  /**
   * Single click: shoot from the current position only (no move).
   * Double click on the same entity: sprint-route toward them and pursue.
   */
  private handleCombatClick() {
    const me = this.room?.state?.players?.get(this.sessionId);
    if (!me || !this.hoveredEntityId || !this.hoveredEntityKind || !this.room) return;

    const targetData = this.getEntityData(this.hoveredEntityId, this.hoveredEntityKind);
    if (!targetData || targetData.isDead || targetData.alive === false) return;

    const weapon = WEAPONS[me.equippedWeaponIndex];
    if (!weapon) return;

    if (
      this.maybeWarnFactionAttack(
        this.hoveredEntityKind,
        targetData,
        me.ashenReputation ?? ASHEN_REP_START,
        me.ashenMilitiaReputation ?? ASHEN_REP_START,
        me.redOrderReputation ?? RED_ORDER_REP_START,
      )
    ) {
      return;
    }

    const now = Date.now();
    const isDoubleClick =
      this.hoveredEntityId === this.lastCombatClickId &&
      now - this.lastCombatClickAt < WorldScene.DOUBLE_CLICK_MS;
    this.lastCombatClickId = this.hoveredEntityId;
    this.lastCombatClickAt = now;
    this.lastClickTime = now;

    this.clearInteractTarget();
    this.clearLootTarget();

    // Single click — fire from here only; do nothing if out of range / blocked.
    if (!isDoubleClick) {
      if (
        !this.isEntityFiring(this.sessionId) &&
        this.canShootEntity(
          this.hoveredEntityId,
          this.hoveredEntityKind,
          targetData.x,
          targetData.y,
        )
      ) {
        this.fireAtTarget(targetData.x, targetData.y, this.hoveredEntityId);
        this.clearCombatTarget();
      }
      return;
    }

    // Double click — pursue (sprint if stamina allows). Never fire here: the
    // first click of the pair already shot if in range, and sendMoveToCoords
    // cancels the local aim/fire pose (which forces a full raise on the next shot).
    this.combatTargetId = this.hoveredEntityId;
    this.combatTargetKind = this.hoveredEntityKind;
    this.combatSprint = (me.stamina ?? 0) > 0;

    if (this.isEntityFiring(this.sessionId)) return;

    if (
      isInWeaponRange(me.x, me.y, targetData.x, targetData.y, weapon) &&
      this.canShootEntity(
        this.hoveredEntityId,
        this.hoveredEntityKind,
        targetData.x,
        targetData.y,
      )
    ) {
      return;
    }

    this.sendMoveToCoords(targetData.x, targetData.y, this.combatSprint);
    this.lastPursuitMoveSentAt = now;
  }

  /**
   * If the target is Ashen / Red Order and standing is better than Hostile,
   * show a one-shot session warning and block this click. Returns true when
   * the click was consumed by the warning.
   */
  private maybeWarnFactionAttack(
    kind: CombatEntityKind,
    targetData: { npcKind?: number },
    ashenReputation: number,
    ashenMilitiaReputation: number,
    redOrderReputation: number,
  ): boolean {
    if (kind !== "guard") return false;

    let factionKey: "ashen" | "ashenMilitia" | "redOrder" | null = null;
    let factionName = "";
    let reputation = 0;
    const npcKind = targetData.npcKind;
    if (
      npcKind === GUARD_NPC_TRADER_MAN ||
      npcKind === GUARD_NPC_TRADER_GUARD
    ) {
      factionKey = "ashen";
      factionName = ASHEN_TRADERS_FACTION;
      reputation = ashenReputation;
    } else if (npcKind === GUARD_NPC_HUMAN) {
      factionKey = "ashenMilitia";
      factionName = ASHEN_MILITIA_FACTION;
      reputation = ashenMilitiaReputation;
    } else if (npcKind === GUARD_NPC_RED_MAN) {
      factionKey = "redOrder";
      factionName = RED_ORDER_FACTION;
      reputation = redOrderReputation;
    }
    if (!factionKey) return false;
    if (this.factionAttackWarningsShown.has(factionKey)) return false;

    const standing = factionStanding(reputation);
    if (standing === "hostile" || standing === "exiled") return false;

    this.factionAttackWarningsShown.add(factionKey);
    this.clearCombatTarget();
    this.factionAttackWarningUI?.show(factionName);
    return true;
  }

  /**
   * Pursue combat target: path toward them, fire when in range with LoS.
   * Same behaviour for players and zombies.
   */
  private updateCombatPursuit() {
    if (!this.combatTargetId || !this.combatTargetKind) return;

    const me = this.room?.state?.players?.get(this.sessionId);
    if (!me?.alive || (me.equippedWeaponIndex ?? -1) < 0) {
      this.clearCombatTarget();
      return;
    }

    const targetData = this.getEntityData(this.combatTargetId, this.combatTargetKind);
    if (!targetData || targetData.isDead || targetData.alive === false) {
      this.clearCombatTarget();
      return;
    }

    const weapon = WEAPONS[me.equippedWeaponIndex];
    if (!weapon) { this.clearCombatTarget(); return; }

    if (
      isInWeaponRange(me.x, me.y, targetData.x, targetData.y, weapon) &&
      !this.isEntityFiring(this.sessionId) &&
      !this.isBusyWithTimedAction(me) &&
      this.canShootEntity(this.combatTargetId, this.combatTargetKind, targetData.x, targetData.y)
    ) {
      this.fireAtTarget(targetData.x, targetData.y, this.combatTargetId);
      this.clearCombatTarget();
      return;
    }

    if (this.isEntityFiring(this.sessionId) || this.isBusyWithTimedAction(me)) return;

    // Re-route toward target periodically (out of range or LoS blocked).
    const now = Date.now();
    if (now - this.lastPursuitMoveSentAt > 300) {
      const sprint = this.combatSprint && me.stamina > 0;
      this.sendMoveToCoords(targetData.x, targetData.y, sprint);
      this.lastPursuitMoveSentAt = now;
    }
  }

  private clearCombatTarget() {
    this.combatTargetId = null;
    this.combatTargetKind = null;
    this.combatSprint = false;
  }

  private showDeathScreen() {
    this.clearCombatTarget();
    this.clearInteractTarget();
    this.clearLootTarget();
    this.inventoryUI?.close();
    this.containerLootUI?.close();
    this.traderUI?.close();
    this.closePlayerMarketUI();
    this.redOrderDialogUI?.close();
    this.ashenTraderDialogUI?.close();
    this.ashenMilitiaDialogUI?.close();
    this.factionAttackWarningUI?.close();
    this.mapOverlayUI?.close();
    this.journalUI?.close();
    AudioManager.get().playDeath();
    this.deathScreenUI?.show();
  }

  private requestRespawn() {
    if (!this.room) return;
    this.room.send("action", { type: "respawn" });
  }

  private sendTutorialUpdate(payload: TutorialCompleteStepMessage) {
    if (!this.room) return;
    const message: ClientMessage = {
      type: "tutorialCompleteStep",
      payload,
    };
    this.room.send("action", message);
  }

  private notifyTutorial(stepId: OnboardingStepId) {
    this.onboardingUI?.notifyStep(stepId);
  }

  private notifyTip(tipId: TutorialTipId) {
    this.onboardingUI?.notifyTip(tipId);
  }

  private getEntityData(id: string, kind: CombatEntityKind) {
    const sprite = this.spriteMapForKind(kind).get(id);
    if (!sprite) return null;
    const data = sprite.getData("server") as {
      x: number;
      y: number;
      health?: number;
      isDead?: boolean;
      alive?: boolean;
      npcKind?: number;
      altitude?: number;
    } | undefined;
    return data ?? null;
  }

  /** Raycast check — false when a wall blocks the shot to an entity target. */
  private canShootEntity(
    targetId: string,
    kind: CombatEntityKind,
    targetX: number,
    targetY: number,
  ): boolean {
    const me = this.room?.state?.players?.get(this.sessionId);
    if (!me || me.equippedWeaponIndex < 0) return false;
    const weapon = WEAPONS[me.equippedWeaponIndex];
    if (!weapon) return false;
    const data = this.getEntityData(targetId, kind);
    if (!data || data.isDead || data.alive === false) return false;

    const zombie = kind === "zombie" ? this.room?.state?.zombies?.get(targetId) : undefined;
    const crowLift = kind === "crow" ? crowFlightLiftPx(data.altitude ?? 0) : 0;
    const crowAirborne = kind === "crow" && crowIsOutOfMeleeReach(data.altitude ?? 0);
    if (isMeleeWeapon(weapon) && crowAirborne) return false;
    if (!isMeleeWeapon(weapon) && crowLift > 0) {
      if (!isInWeaponRange(me.x, me.y, data.x, data.y, weapon)) return false;
      return hasEntityLineOfSight({
        fromX: me.x,
        fromY: me.y,
        toX: data.x,
        toY: data.y,
        inInterior: me.inInterior ?? false,
        walls:
          me.inInterior && me.buildingX != null && me.buildingY != null
            ? this.mergedInteriorSightWalls(me.buildingX, me.buildingY)
            : undefined,
        blocksSightAt: me.inInterior
          ? undefined
          : (tx, ty) => this.overworldSightBlockedAt(tx, ty),
      });
    }
    const target: RaycastTarget = {
      id: targetId,
      x: data.x,
      y: data.y,
      health: data.health ?? 1,
      isDead: false,
      renderHeight:
        kind === "coywolf"
          ? COYWOLF_RENDER_HEIGHT
          : kind === "bear"
            ? BEAR_RENDER_HEIGHT
          : kind === "crow"
            ? crowAirborne
              ? CROW_FLY_RENDER_HEIGHT
              : CROW_RENDER_HEIGHT
          : zombie
            ? zombieRenderHeight(zombie.skin, isZombieCrawler(targetId, zombie.skin))
            : undefined,
      screenLiftPx: crowLift,
      meleeImmune: crowAirborne,
    };

    return shotHitsTarget({
      originX: me.x,
      originY: me.y,
      targetX,
      targetY,
      weapon,
      inInterior: me.inInterior ?? false,
      bounds: this.worldBounds,
      targets: [target],
      targetId,
      walls:
        me.inInterior && me.buildingX != null && me.buildingY != null
          ? this.mergedInteriorSightWalls(me.buildingX, me.buildingY)
          : undefined,
      blocksSightAt: me.inInterior
        ? undefined
        : (tx, ty) => this.overworldSightBlockedAt(tx, ty),
    });
  }

  /** Halt path-following immediately (server + optimistic local idle). */
  private stopPlayerMovement() {
    if (!this.room) return;
    const me = this.room.state?.players?.get(this.sessionId);
    if (!me) return;

    // stopOnly: do not treat "stand still on exit tile" as an intentional leave.
    this.room.send("action", {
      type: "moveTo",
      payload: { targetX: me.x, targetY: me.y, sprint: false, stopOnly: true },
    });

    const sprite = this.playerSprites.get(this.sessionId);
    const server = sprite?.getData("server") as { anim?: string; animFrame?: number } | undefined;
    if (sprite && server) {
      sprite.setData("server", { ...server, anim: "idle", animFrame: 0 });
      sprite.setData("moveSpeed", 0);
      sprite.setData("visualKey", "");
    }
  }

  private isBusyWithTimedAction(me: {
    isReloading?: boolean;
    isUnloading?: boolean;
    searchTargetId?: string;
    isConsuming?: boolean;
    isCrafting?: boolean;
    isChangingClothes?: boolean;
    isBuilding?: boolean;
  }): boolean {
    return !!(
      me.isReloading ||
      me.isUnloading ||
      me.searchTargetId ||
      me.isConsuming ||
      me.isCrafting ||
      me.isChangingClothes ||
      me.isBuilding
    );
  }

  /** Start / continue a local progress bar for a timed action (search, reload, consume, craft, clothing, build). */
  private beginLocalTimedAction(
    kind: "search" | "reload" | "unload" | "consume" | "craft" | "clothing" | "build",
    durationMs: number,
    label: string,
    optimistic: boolean,
  ) {
    if (this.localTimedAction?.kind === kind) {
      this.localTimedAction.label = label;
      this.localTimedAction.durationMs = durationMs;
      // Keep the original local start time when optimistic → confirmed.
      // Do NOT re-sync to server absolute end timestamps — Colyseus patches +
      // RTT make that desync, so the bar stalls short of 100% and then gets
      // treated as a cancel when isReloading clears.
      if (!optimistic) {
        this.localTimedAction.optimistic = false;
      }
      return;
    }
    this.localTimedAction = {
      kind,
      startedAt: Date.now(),
      durationMs: Math.max(1, durationMs),
      label,
      optimistic,
    };
    this.lastSearchProgressPct = -1;
  }

  private canStartReload(me: {
    equippedWeaponIndex: number;
    magazineRounds: number;
    inventoryJson: string;
  }): boolean {
    if ((me.equippedWeaponIndex ?? -1) < 0) return false;
    const weapon = WEAPONS[me.equippedWeaponIndex];
    if (!weapon || isMeleeWeapon(weapon)) return false;
    const sync = this.localInventorySync;
    const magazineRounds = me.magazineRounds;
    if (magazineRounds >= weapon.magazineCapacity) return false;
    const inventoryJson = sync?.inventoryJson ?? me.inventoryJson;
    return getInventoryAmmo(parseInventory(inventoryJson), weapon.itemId) > 0;
  }

  /** R / mobile reload button. */
  private requestReload() {
    if (!this.room || this.isOverlayOpen() || this.chatOpen) return;
    const me = this.room.state?.players?.get(this.sessionId);
    if (!me?.alive) return;
    if (me.anim === "run" || this.isBusyWithTimedAction(me)) return;
    if (!this.canStartReload(me)) return;

    this.beginOptimisticReload();
    this.room.send("action", { type: "reloadStart" });
  }

  /**
   * Local skill multipliers, memoised on the skill json (same trick the server
   * uses): computing them parses the whole tree, and callers on the update loop
   * ask for them every frame while a timed action runs.
   */
  private localSkillMods(): PlayerSkillMods {
    const json = this.localSkillsJson;
    const cache = this.cachedSkillMods;
    if (cache && cache.json === json) return cache.mods;
    const mods = computePlayerSkillMods(json);
    this.cachedSkillMods = { json, mods };
    return mods;
  }

  private beginOptimisticSearch(
    kind: "furniture" | "loot" = "loot",
    objectType?: string,
  ) {
    this.beginLocalTimedAction(
      "search",
      this.localSkillMods().searchDurationMs,
      "Searching",
      true,
    );
    AudioManager.get().playSearch(kind === "furniture" ? "furniture" : "body", objectType);
    const me = this.room?.state?.players?.get(this.sessionId);
    if (me && this.isOutsideTown(me)) this.notifyTip("search_noise");
  }

  private beginOptimisticReload() {
    this.beginLocalTimedAction(
      "reload",
      this.localSkillMods().reloadMs,
      "Reloading",
      true,
    );
    const me = this.room?.state?.players?.get(this.sessionId);
    const weapon =
      me && me.equippedWeaponIndex >= 0
        ? WEAPONS[me.equippedWeaponIndex]
        : undefined;
    if (weapon) {
      AudioManager.get().playReload(weapon.itemId);
    }
  }

  private beginOptimisticConsume(durationMs: number, label: string) {
    this.beginLocalTimedAction("consume", durationMs, label, true);
  }

  private beginOptimisticCraft(durationMs: number) {
    this.beginLocalTimedAction("craft", durationMs, "Crafting", true);
  }

  private beginOptimisticClothingChange(label: string) {
    this.clothingActionLabel = label;
    this.beginLocalTimedAction(
      "clothing",
      CLOTHING_CHANGE_DURATION_MS,
      label,
      true,
    );
  }

  private clearLocalSearchProgress() {
    if (this.localTimedAction?.kind === "search") {
      this.localTimedAction = null;
      this.lastSearchProgressPct = -1;
      this.searchProgressEl?.classList.remove("search-progress--visible");
      AudioManager.get().stopSearch();
    }
  }

  /**
   * Cancellable timed channels. When adding a new progress-bar action:
   * 1. Add a schema busy flag (or localKind) + server `*Cancel` message
   * 2. Append a row here
   * Esc then cancels it automatically via {@link cancelProgressBarAction}.
   */
  private static readonly CANCELABLE_TIMED_CHANNELS: readonly {
    localKind: "search" | "reload" | "unload" | "consume" | "craft" | "clothing" | "build";
    isActive: (me: PlayerSchema) => boolean;
    cancelType:
      | "searchCancel"
      | "reloadCancel"
      | "unloadCancel"
      | "consumeCancel"
      | "craftCancel"
      | "clothingCancel"
      | "buildCancel";
  }[] = [
    {
      localKind: "search",
      isActive: (me) => !!me.searchTargetId,
      cancelType: "searchCancel",
    },
    {
      localKind: "reload",
      isActive: (me) => !!me.isReloading,
      cancelType: "reloadCancel",
    },
    {
      localKind: "unload",
      isActive: (me) => !!me.isUnloading,
      cancelType: "unloadCancel",
    },
    {
      localKind: "consume",
      isActive: (me) => !!me.isConsuming,
      cancelType: "consumeCancel",
    },
    {
      localKind: "craft",
      isActive: (me) => !!me.isCrafting,
      cancelType: "craftCancel",
    },
    {
      localKind: "clothing",
      isActive: (me) => !!me.isChangingClothes,
      cancelType: "clothingCancel",
    },
    {
      localKind: "build",
      isActive: (me) => !!me.isBuilding,
      cancelType: "buildCancel",
    },
  ];

  /**
   * Esc / abort: cancel the active progress-bar channel (search, reload, consume,
   * craft, clothing, build/deconstruct) and any in-progress tree chop.
   * Returns true when something was cancelled.
   */
  private cancelProgressBarAction(): boolean {
    const me = this.room?.state?.players?.get(this.sessionId);
    const action = this.localTimedAction;
    const active = WorldScene.CANCELABLE_TIMED_CHANNELS.filter(
      (channel) =>
        (!!me && channel.isActive(me)) || action?.kind === channel.localKind,
    );
    const chopping = !!this.treeChopTargetTile;

    if (active.length === 0 && !chopping) return false;

    this.localTimedAction = null;
    this.lastSearchProgressPct = -1;
    this.searchProgressEl?.classList.remove("search-progress--visible");
    if (active.some((channel) => channel.localKind === "consume")) {
      AudioManager.get().stopConsume();
    }
    if (active.some((channel) => channel.localKind === "search")) {
      AudioManager.get().stopSearch();
    }
    if (active.some((channel) => channel.localKind === "reload")) {
      AudioManager.get().stopReload();
    }
    if (active.some((channel) => channel.localKind === "unload")) {
      AudioManager.get().stopUnload();
    }

    if (chopping) this.clearTreeChopTarget();

    if (!this.room) return true;

    for (const channel of active) {
      this.room.send("action", { type: channel.cancelType });
    }
    if (chopping) {
      this.room.send("action", { type: "chopTreeCancel" });
    }
    return true;
  }

  /**
   * Mirror server fire-rate gate (`1 / weapon.fireRate` seconds).
   * Uses the later of server lastFireTime and our last optimistic send so we
   * don't play Fire* while the server would still reject the shot.
   */
  private canFireAtRate(
    weapon: (typeof WEAPONS)[number],
    serverLastFireTime: number,
  ): boolean {
    const nowSec = Date.now() / 1000;
    const lastSec = Math.max(serverLastFireTime || 0, this.localLastFireTimeSec);
    const minGap = 1 / Math.max(0.1, weapon.fireRate);
    return nowSec - lastSec >= minGap;
  }

  /**
   * Ground point the shot is aimed at. A cursor over a body aims at that body's
   * feet, so clicking a torso does not send the round into the dirt behind it.
   * Everything else aims at the tile under the cursor.
   */
  /**
   * Ground point the cursor is aiming at, on the bullet's flight plane. Never
   * snapped to a hovered body: the server hit-tests the shot line against
   * sprite silhouettes, so snapping would bend the line off the cursor and past
   * whatever else it was crossing.
   */
  private resolveAimPoint(screenX: number, screenY: number) {
    const world = this.cameras.main.getWorldPoint(screenX, screenY);
    return aimPointCartesian(world.x, world.y);
  }

  /** Living bodies the local player can reach with a melee swing. */
  private meleeSwingTargets(): RaycastTarget[] {
    const targets: RaycastTarget[] = [];
    const push = (
      id: string,
      sprite: { getData(key: string): unknown } | undefined,
      meleeImmune = false,
    ) => {
      if (!sprite) return;
      const data = sprite.getData("server") as
        | {
            x?: number;
            y?: number;
            health?: number;
            isDead?: boolean;
            alive?: boolean;
          }
        | undefined;
      if (!data || data.isDead || data.alive === false) return;
      if (typeof data.x !== "number" || typeof data.y !== "number") return;
      targets.push({
        id,
        x: data.x,
        y: data.y,
        health: data.health ?? 1,
        isDead: false,
        meleeImmune,
      });
    };
    for (const [id, sprite] of this.playerSprites) {
      if (id === this.sessionId) continue;
      push(id, sprite);
    }
    for (const [id, sprite] of this.zombieSprites) push(id, sprite);
    for (const [id, sprite] of this.guardSprites) push(id, sprite);
    for (const [id, sprite] of this.coywolfSprites) push(id, sprite);
    for (const [id, sprite] of this.bearSprites) push(id, sprite);
    for (const [id, sprite] of this.crowSprites) {
      const data = sprite?.getData("server") as { altitude?: number } | undefined;
      push(id, sprite, crowIsOutOfMeleeReach(data?.altitude ?? 0));
    }
    return targets;
  }

  /**
   * CTRL-aim click with a melee weapon: swing toward the cursor. The server
   * damages the closest target in range along that swing.
   */
  private swingMeleeAt(screenX: number, screenY: number) {
    if (!this.room) return;
    const me = this.room.state?.players?.get(this.sessionId);
    if (!me?.alive || me.equippedWeaponIndex < 0) return;
    if (this.isBusyWithTimedAction(me)) return;

    const weapon = WEAPONS[me.equippedWeaponIndex];
    if (!weapon || !isMeleeWeapon(weapon)) return;
    if (this.isEntityFiring(this.sessionId)) return;
    if (!this.canFireAtRate(weapon, me.lastFireTime ?? 0)) return;

    const aim = this.resolveAimPoint(screenX, screenY);
    if (Math.hypot(aim.x - me.x, aim.y - me.y) < 0.05) return;

    const inInterior = me.inInterior ?? false;
    const furnitures =
      inInterior && me.buildingX != null && me.buildingY != null
        ? this.searchablesCache
            .filter(
              (s) =>
                s.kind === "furniture" &&
                s.buildingX === me.buildingX &&
                s.buildingY === me.buildingY &&
                (s.level ?? 0) === (me.interiorLevel ?? 0),
            )
            .map((s) => ({
              id: s.id,
              kind: "furniture" as const,
              objectType: s.objectType,
              x: s.x,
              y: s.y,
              searched: s.searched,
              buildingX: s.buildingX,
              buildingY: s.buildingY,
              facing: (s.facing || undefined) as
                | "NE"
                | "NW"
                | "SE"
                | "SW"
                | undefined,
            }))
        : undefined;
    const hit = closestMeleeSwingTarget({
      originX: me.x,
      originY: me.y,
      aimX: aim.x,
      aimY: aim.y,
      weapon,
      targets: this.meleeSwingTargets(),
      inInterior,
      furnitures,
      walls:
        inInterior && me.buildingX != null && me.buildingY != null
          ? this.mergedInteriorSightWalls(me.buildingX, me.buildingY)
          : undefined,
      blocksSightAt: inInterior
        ? undefined
        : (tx, ty) => this.overworldSightBlockedAt(tx, ty),
    });
    if (hit) {
      const kind = this.resolveEntityKind(hit.id);
      const data = kind ? this.getEntityData(hit.id, kind) : null;
      if (
        kind &&
        data &&
        this.maybeWarnFactionAttack(
          kind,
          data,
          me.ashenReputation ?? ASHEN_REP_START,
          me.ashenMilitiaReputation ?? ASHEN_REP_START,
          me.redOrderReputation ?? RED_ORDER_REP_START,
        )
      ) {
        return;
      }
    }

    this.stopPlayerMovement();
    const facing = directionFromWorldDelta(aim.x - me.x, aim.y - me.y);
    this.localAimFacing = facing;
    this.lastSentAimLookFacing = facing;
    this.localLastFireTimeSec = Date.now() / 1000;
    this.startEntityFireAnim(
      this.sessionId,
      me.equippedWeaponIndex,
      false,
      Date.now(),
      "player",
    );
    this.room.send("action", {
      type: "fire",
      payload: { targetX: aim.x, targetY: aim.y },
    } satisfies ClientMessage);
    this.notifyTutorial("attack");
  }

  /**
   * CTRL-aim click: fire down the cursor line. The server traces the round and
   * reports what it struck, so nothing is target-locked here.
   */
  private fireFreeAimAt(screenX: number, screenY: number) {
    if (!this.room) return;
    const me = this.room.state?.players?.get(this.sessionId);
    if (!me?.alive || me.equippedWeaponIndex < 0) return;
    if (this.isBusyWithTimedAction(me)) return;

    const weapon = WEAPONS[me.equippedWeaponIndex];
    if (!weapon || isMeleeWeapon(weapon)) return;
    if (this.isEntityFiring(this.sessionId) && !isFullAutoWeapon(weapon)) return;
    if (!this.canFireAtRate(weapon, me.lastFireTime ?? 0)) return;

    if (me.magazineRounds <= 0) {
      this.requestReload();
      return;
    }

    const aim = this.resolveAimPoint(screenX, screenY);
    if (Math.hypot(aim.x - me.x, aim.y - me.y) < 0.05) return;

    this.stopPlayerMovement();

    // Lock the shot facing locally so the Fire clip starts pointed the right
    // way. The server derives the same facing from these coords.
    const facing = directionFromWorldDelta(aim.x - me.x, aim.y - me.y);
    this.localAimFacing = facing;
    this.lastSentAimLookFacing = facing;

    this.localLastFireTimeSec = Date.now() / 1000;
    const sfxVariant = resolveGunshotVariant();
    this.startEntityFireAnim(
      this.sessionId,
      me.equippedWeaponIndex,
      false,
      Date.now() + WorldScene.FIGHTING_STANCE_MS,
      "player",
    );
    this.room.send("action", {
      type: "fire",
      payload: { targetX: aim.x, targetY: aim.y, sfxVariant },
    } satisfies ClientMessage);
    this.playSyncedGunshot(me.equippedWeaponIndex, sfxVariant, me);
    this.notifyTutorial("attack");
    this.notifyTip("gunshot");
  }

  private fireAtTarget(tx: number, ty: number, targetId?: string) {
    if (!this.room || this.isEntityFiring(this.sessionId)) return;
    const me = this.room.state.players.get(this.sessionId);
    if (!me || me.equippedWeaponIndex < 0 || this.isBusyWithTimedAction(me)) return;

    const weapon = WEAPONS[me.equippedWeaponIndex];
    if (!weapon) return;
    if (!this.canFireAtRate(weapon, me.lastFireTime ?? 0)) return;

    if (targetId) {
      const kind = this.resolveEntityKind(targetId);
      if (!kind || !this.canShootEntity(targetId, kind, tx, ty)) return;
    }

    this.stopPlayerMovement();

    if (me.magazineRounds <= 0) {
      if (!isMeleeWeapon(weapon)) {
        this.requestReload();
        return;
      }
      // Melee has no magazine — still send the attack.
    }

    const melee = isMeleeWeapon(weapon);
    let aimX = tx;
    let aimY = ty;
    if (!melee && targetId) {
      const aimKind = this.resolveEntityKind(targetId);
      const aimData = aimKind ? this.getEntityData(targetId, aimKind) : null;
      const lift = aimKind === "crow" ? crowFlightLiftPx(aimData?.altitude ?? 0) : 0;
      if (lift > 0 && aimData) {
        const lifted = aimPointForScreenLift(aimData.x, aimData.y, lift);
        aimX = lifted.x;
        aimY = lifted.y;
      }
    }
    const sfxVariant = melee ? undefined : resolveGunshotVariant();
    this.localLastFireTimeSec = Date.now() / 1000;
    this.startEntityFireAnim(
      this.sessionId,
      me.equippedWeaponIndex,
      false,
      melee ? Date.now() : Date.now() + WorldScene.FIGHTING_STANCE_MS,
      "player",
    );
    this.room.send("action", {
      type: "fire",
      payload: { targetX: aimX, targetY: aimY, targetId, sfxVariant },
    } satisfies ClientMessage);
    if (!melee) this.playSyncedGunshot(me.equippedWeaponIndex, sfxVariant, me);
    this.notifyTutorial("attack");
    if (!melee) this.notifyTip("gunshot");
  }

  private sendMoveToCoords(
    wx: number,
    wy: number,
    sprint = false,
    queue = false,
  ) {
    if (!this.room) return;
    // CTRL aim blocks click-to-move; keyboard stopOnly (same tile) still allowed.
    if (this.aimHeld) {
      const me = this.room.state?.players?.get(this.sessionId);
      if (
        me &&
        Math.hypot(wx - me.x, wy - me.y) > 0.05
      ) {
        return;
      }
    }
    const me = this.room.state?.players?.get(this.sessionId);
    if (me && Math.hypot(wx - me.x, wy - me.y) > 0.05) {
      if (!queue) {
        this.cancelEntityFireAnim(this.sessionId);
      }
    }
    const message: ClientMessage = {
      type: "moveTo",
      payload: { targetX: wx, targetY: wy, sprint, queue },
    };
    this.room.send("action", message);
  }

  /** World tile step for each 8-way facing (matches screenInputToWorldDelta). */
  private static readonly KEYBOARD_TILE_STEP: ReadonlyArray<{
    dx: number;
    dy: number;
  }> = [
    { dx: -1, dy: -1 }, // N
    { dx: 0, dy: -1 }, // NE
    { dx: 1, dy: -1 }, // E
    { dx: 1, dy: 0 }, // SE
    { dx: 1, dy: 1 }, // S
    { dx: 0, dy: 1 }, // SW
    { dx: -1, dy: 1 }, // W
    { dx: -1, dy: 0 }, // NW
  ];

  /**
   * WASD / arrow movement driven only by keys currently held.
   * Release all move keys → stop immediately. Change combo → retarget that facing.
   */
  private handleKeyboardMovement() {
    if (!this.room || !this.keys || !this.cursors) return;

    const resetMoveState = () => {
      this.keyboardMoveActive = false;
      this.lastKeyboardMoveTargetKey = "";
      this.lastKeyboardFacing = -1;
      this.lastKeyboardSprint = false;
      this.lastKeyboardGoalTX = 0;
      this.lastKeyboardGoalTY = 0;
    };

    const stopKeyboardMove = () => {
      const wasActive = this.keyboardMoveActive || this.lastKeyboardFacing >= 0;
      resetMoveState();
      if (wasActive) this.stopPlayerMovement();
    };

    // Melee aim locks movement (WASD, arrows, and the thumb stick).
    const blocked =
      this.isOverlayOpen() ||
      this.chatOpen ||
      (this.aimHeld && this.localEquippedIsMelee());
    this.moveStickEl?.classList.toggle("move-stick--blocked", blocked);
    if (blocked) {
      if (this.moveStickPointerId !== null) this.releaseMoveStick();
      // UI steals keyup — clear stuck WASD/Shift so we don't keep walking.
      this.keys.W.reset();
      this.keys.A.reset();
      this.keys.S.reset();
      this.keys.D.reset();
      this.cursors.left.reset();
      this.cursors.right.reset();
      this.cursors.up.reset();
      this.cursors.down.reset();
      this.cursors.shift.reset();
      this.shiftKey?.reset();
      stopKeyboardMove();
      return;
    }

    const me = this.room.state?.players?.get(this.sessionId);
    if (!me?.alive) {
      resetMoveState();
      return;
    }

    const { screenDx, screenDy } = this.readKeyboardMoveVector();
    if (screenDx === 0 && screenDy === 0) {
      this.pauseMoveAfterStairs = false;
      stopKeyboardMove();
      return;
    }
    if (this.pauseMoveAfterStairs) {
      stopKeyboardMove();
      return;
    }

    const facing = directionFromScreenInput(screenDx, screenDy);
    const step = WorldScene.KEYBOARD_TILE_STEP[facing]!;
    const stepX = step.dx;
    const stepY = step.dy;
    const sprint = this.isSprintKeyDown() && (me.stamina ?? 0) > 0;
    const now = Date.now();

    const facingChanged = facing !== this.lastKeyboardFacing;
    const sprintChanged = sprint !== this.lastKeyboardSprint;

    const baseTX = Math.floor(me.x);
    const baseTY = Math.floor(me.y);

    // How far along the current facing until our last goal (≤0 = at/past it).
    const remainingToGoal = this.keyboardMoveActive
      ? (this.lastKeyboardGoalTX + 0.5 - me.x) * stepX +
        (this.lastKeyboardGoalTY + 0.5 - me.y) * stepY
      : 0;

    // Fresh command when starting, turning, toggling sprint, or finishing the tile.
    const needSend =
      !this.keyboardMoveActive ||
      facingChanged ||
      sprintChanged ||
      remainingToGoal < 0.75;

    if (!needSend) return;

    let goal: { x: number; y: number } | null = null;
    let goalTX = baseTX + stepX;
    let goalTY = baseTY + stepY;

    if (me.inInterior) {
      // Project straight to the room boundary along the held direction and
      // hand it to the server exactly like a click would be — the server's
      // own A* (interiorWalkable + findPath in handleMoveTo) then routes
      // around any furniture/walls in between. A short 1–2 tile "ahead" probe
      // can never reach a nook that requires walking *around* an obstacle
      // first (e.g. a gap tucked behind the far side of a bed); sending a
      // real far-away target and trusting server pathfinding gives WASD the
      // same reach as click-to-move. Releasing the keys still sends an
      // explicit stop, so this never "runs away" further than intended.
      const { iW, iH } = interiorDimensions(me.buildingX, me.buildingY);
      const exit = interiorExitForBuildingAt(me.buildingX, me.buildingY);

      let farTX = stepX > 0 ? iW - 1 : stepX < 0 ? 0 : baseTX;
      let farTY = stepY > 0 ? iH - 1 : stepY < 0 ? 0 : baseTY;
      // The doorway strip sits one tile past the floor grid. Extend onto it
      // when heading toward the door so WASD can still walk out the exit.
      // Upper floors have no street door.
      const onGroundFloor = this.effectiveInteriorLevel(me) === 0;
      if (
        onGroundFloor &&
        exit.face === "SE" &&
        stepX > 0 &&
        farTY >= exit.alongMin &&
        farTY <= exit.alongMax
      ) {
        farTX = exit.outsideX;
      } else if (
        onGroundFloor &&
        exit.face === "SW" &&
        stepY > 0 &&
        farTX >= exit.alongMin &&
        farTX <= exit.alongMax
      ) {
        farTY = exit.outsideY;
      }

      goalTX = farTX;
      goalTY = farTY;
      goal = { x: farTX + 0.5, y: farTY + 0.5 };
    } else {
      // Note: unlike a click, WASD never auto-routes into a building's
      // doorway when it bumps a wall tile — it should just stop at the wall.
      // Routing to the entrance is reserved for explicit clicks (see
      // handleWorldClick).
      const resolveGoal = (
        tx: number,
        ty: number,
      ): { x: number; y: number } | null => {
        if (!isWallTile(tx, ty) && !this.isOverworldMovementBlocked(tx, ty)) {
          return { x: tx + 0.5, y: ty + 0.5 };
        }
        return null;
      };

      // Always step from the tile we occupy along keys held RIGHT NOW.
      // Keep paths short (1–2 tiles) so releasing keys stops quickly.
      const preferAhead =
        facingChanged || sprintChanged || !this.keyboardMoveActive ? 1 : 2;

      for (let ahead = preferAhead; ahead >= 1; ahead--) {
        const tx = baseTX + stepX * ahead;
        const ty = baseTY + stepY * ahead;
        let clear = true;
        for (let i = 1; i < ahead; i++) {
          const ix = baseTX + stepX * i;
          const iy = baseTY + stepY * i;
          if (isWallTile(ix, iy) || this.isOverworldMovementBlocked(ix, iy)) {
            clear = false;
            break;
          }
        }
        if (!clear) continue;
        const candidate = resolveGoal(tx, ty);
        if (candidate) {
          goal = candidate;
          goalTX = Math.floor(candidate.x);
          goalTY = Math.floor(candidate.y);
          break;
        }
      }

      // Sprint toggle with nowhere new to step — re-issue current goal.
      if (!goal && sprintChanged && this.keyboardMoveActive) {
        goalTX = this.lastKeyboardGoalTX;
        goalTY = this.lastKeyboardGoalTY;
        goal = { x: goalTX + 0.5, y: goalTY + 0.5 };
      }

      // The tile directly ahead is an outdoor blocker (tree, fence, corner,
      // but not a building — those stop at the wall, see above) — approach
      // it the same way a click does instead of just refusing to move.
      if (!goal) {
        const blockTX = baseTX + stepX;
        const blockTY = baseTY + stepY;
        const outdoorBlocker =
          (isWallTile(blockTX, blockTY) && !getBuildingAt(blockTX, blockTY)) ||
          this.isOverworldMovementBlocked(blockTX, blockTY);
        if (outdoorBlocker) {
          const approach = blockedTileApproachGoal(
            me.x,
            me.y,
            blockTX,
            blockTY,
            (tx, ty) => this.overworldMoveWalkable(tx, ty),
          );
          if (approach) {
            goal = approach;
            goalTX = Math.floor(approach.x);
            goalTY = Math.floor(approach.y);
          }
        }
      }
    }
    if (!goal) return;

    const targetKey = `${goalTX},${goalTY},${sprint ? 1 : 0},${facing}`;
    if (
      !facingChanged &&
      !sprintChanged &&
      targetKey === this.lastKeyboardMoveTargetKey &&
      now - this.lastKeyboardMoveSentAt < WorldScene.KEYBOARD_MOVE_RESEND_MS
    ) {
      return;
    }

    if (!this.keyboardMoveActive) {
      this.clearCombatTarget();
      this.clearInteractTarget();
      this.clearLootTarget();
    }
    this.keyboardMoveActive = true;
    this.lastKeyboardFacing = facing;
    this.lastKeyboardMoveTargetKey = targetKey;
    this.lastKeyboardMoveSentAt = now;
    this.lastKeyboardGoalTX = goalTX;
    this.lastKeyboardGoalTY = goalTY;
    this.lastKeyboardSprint = sprint;
    this.sendMoveToCoords(goal.x, goal.y, sprint, false);
  }

  /** Screen-space move vector from WASD, arrows, or the mobile thumb stick. */
  private readKeyboardMoveVector(): { screenDx: number; screenDy: number } {
    let screenDx = 0;
    let screenDy = 0;
    if (this.keys.A.isDown || this.cursors.left.isDown) screenDx -= 1;
    if (this.keys.D.isDown || this.cursors.right.isDown) screenDx += 1;
    if (this.keys.W.isDown || this.cursors.up.isDown) screenDy -= 1;
    if (this.keys.S.isDown || this.cursors.down.isDown) screenDy += 1;
    if (screenDx !== 0 || screenDy !== 0) return { screenDx, screenDy };
    return this.readMoveStickVector();
  }

  private isSprintKeyDown(): boolean {
    return !!(
      this.moveStickSprint ||
      this.shiftKey?.isDown ||
      this.cursors?.shift?.isDown
    );
  }

  private handleCombatInput(_delta: number) {
    if (!this.room || !this.keys) return;

    const blocked = this.isOverlayOpen() || this.chatOpen;
    if (blocked) {
      // HTML menus steal focus and drop keyup — clear Phaser's stuck R state.
      this.reloadKeyWasDown = false;
      this.keys.R.reset();
      return;
    }

    const me = this.room.state?.players?.get(this.sessionId);
    if (!me?.alive) {
      this.reloadKeyWasDown = false;
      this.keys.R.reset();
      return;
    }

    const rDown = this.keys.R.isDown;
    if (!rDown) {
      this.reloadKeyWasDown = false;
      return;
    }
    if (this.reloadKeyWasDown) return;
    if (this.structureBuildMode && isStructurePanelKind(this.structureBuildKind)) {
      this.reloadKeyWasDown = true;
      return;
    }

    // Searching / already reloading / sprinting: don't latch the edge, so R can
    // fire as soon as the player is free (or on the next clean press).
    const sprinting = me.anim === "run";
    if (this.isBusyWithTimedAction(me) || sprinting) return;

    this.reloadKeyWasDown = true;
    this.requestReload();
  }

  /**
   * Returns the searchable currently under the cursor (highlight target).
   */
  private nearestSearchable() {
    if (!this.hoveredSearchableId) return null;
    return (
      this.searchablesCache.find((item) => {
        if (item.id !== this.hoveredSearchableId) return false;
        if (
          furnitureIsCraftStation(item.objectType) ||
          furnitureIsFurnace(item.objectType) ||
          furnitureIsStairs(item.objectType)
        ) {
          return true;
        }
        return !item.depleted;
      }) ?? null
    );
  }

  /**
   * Each frame: highlight the tile under the cursor when it contains a searchable.
   * Optional screen coords (e.g. click) override the active pointer.
   */
  private updateSearchHover(pointerPos?: { x: number; y: number }) {
    const me = this.room?.state?.players?.get(this.sessionId);

    if (!me) {
      if (this.hoveredSearchableId !== null) {
        this.hoveredSearchableId = null;
        this.interiorView?.setHoveredItem(null, []);
      }
      return;
    }

    const pointer = pointerPos ?? this.input.activePointer;
    const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const cart = isoToCartesian(world.x, world.y);
    const cursorTX = Math.floor(cart.x);
    const cursorTY = Math.floor(cart.y);

    let hovered =
      this.searchablesCache.find((item) => {
        const craftStation = furnitureIsCraftStation(item.objectType);
        const furnace = furnitureIsFurnace(item.objectType);
        const stairs = furnitureIsStairs(item.objectType);
        if (craftStation || furnace || stairs) {
          // Stations and stairs stay interactable even if previously marked searched.
        } else if (item.depleted || !furnitureIsSearchable(item.objectType)) {
          return false;
        }
        if (me.inInterior) {
          if (
            item.buildingX !== me.buildingX ||
            item.buildingY !== me.buildingY ||
            (item.level ?? 0) !== (me.interiorLevel ?? 0)
          ) {
            return false;
          }
        } else if (item.buildingX !== OVERWORLD_BAG_BUILDING) {
          return false;
        }
        return searchableOccupiesTile(item, cursorTX, cursorTY);
      }) ?? null;

    // Furnace art stands against the wall and rises well above its floor tile.
    // A click on the sprite often lands on the wall behind it, so also accept
    // an opaque hit on the furnace itself when nothing is drawn in front.
    if (me.inInterior) {
      const spriteId = this.interiorView?.pickFurnitureIdAtWorld(world.x, world.y);
      if (spriteId) {
        const spriteItem = this.searchablesCache.find((item) => item.id === spriteId);
        if (
          spriteItem &&
          furnitureIsFurnace(spriteItem.objectType) &&
          spriteItem.buildingX === me.buildingX &&
          spriteItem.buildingY === me.buildingY
        ) {
          hovered = spriteItem;
        }
      }
    }

    const newId = hovered?.id ?? null;
    if (newId !== this.hoveredSearchableId) {
      this.hoveredSearchableId = newId;
      if (me.inInterior) {
        this.interiorView?.setHoveredItem(newId, this.searchablesCache);
      } else if (hovered) {
        this.tileManager?.highlightInteractionTile(hovered.x, hovered.y);
      } else {
        this.tileManager?.highlightInteractionTile(null, null);
      }
    }
  }

  private updateLootableHover(pointer: { x: number; y: number } = this.input.activePointer) {
    const me = this.room?.state?.players?.get(this.sessionId);

    const clearLootHighlight = () => {
      if (me?.inInterior) {
        if (!this.hoveredSearchableId) {
          this.interiorView?.highlightTile(null, null);
        }
      } else {
        this.tileManager?.highlightInteractionTile(null, null);
      }
    };

    if (this.isOverlayOpen() || this.chatOpen || !me?.alive) {
      this.hoveredLootableId = null;
      this.hoveredLootableKind = null;
      clearLootHighlight();
      this.game.canvas.style.cursor = "";
      return;
    }

    const playerSim = this.playerSprites.get(this.sessionId)?.getData("server") as
      | { x: number; y: number }
      | undefined;
    const worldPt = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const cart = isoToCartesian(worldPt.x, worldPt.y);
    const cursorTX = Math.floor(cart.x);
    const cursorTY = Math.floor(cart.y);

    let bestId: string | null = null;
    let bestKind: "zombie" | "guard" | "player" | "coywolf" | "bear" | "crow" | null = null;
    let bestTX = 0;
    let bestTY = 0;
    let bestEntityX = 0;
    let bestEntityY = 0;

    for (const [id, sprite] of this.zombieSprites) {
      const data = sprite?.getData("server") as
        | {
            x: number;
            y: number;
            isDead?: boolean;
            looted?: boolean;
            inInterior?: boolean;
            buildingX?: number;
            buildingY?: number;
          }
        | undefined;
      if (!data?.isDead || data.looted) continue;
      if (me.inInterior !== !!data.inInterior) continue;
      if (
        me.inInterior &&
        (data.buildingX !== me.buildingX || data.buildingY !== me.buildingY)
      ) {
        continue;
      }

      const zTX = Math.floor(data.x);
      const zTY = Math.floor(data.y);
      if (cursorTX !== zTX || cursorTY !== zTY) continue;

      bestId = id;
      bestKind = "zombie";
      bestTX = zTX;
      bestTY = zTY;
      bestEntityX = data.x;
      bestEntityY = data.y;
      break;
    }

    if (!bestId && !me.inInterior) {
      for (const [id, sprite] of this.coywolfSprites) {
        const data = sprite?.getData("server") as
          | { x: number; y: number; isDead?: boolean; looted?: boolean }
          | undefined;
        if (!data?.isDead || data.looted) continue;
        const wTX = Math.floor(data.x);
        const wTY = Math.floor(data.y);
        if (cursorTX !== wTX || cursorTY !== wTY) continue;
        bestId = id;
        bestKind = "coywolf";
        bestTX = wTX;
        bestTY = wTY;
        bestEntityX = data.x;
        bestEntityY = data.y;
        break;
      }
    }

    if (!bestId && !me.inInterior) {
      for (const [id, sprite] of this.bearSprites) {
        const data = sprite?.getData("server") as
          | { x: number; y: number; isDead?: boolean; looted?: boolean }
          | undefined;
        if (!data?.isDead || data.looted) continue;
        const bTX = Math.floor(data.x);
        const bTY = Math.floor(data.y);
        if (cursorTX !== bTX || cursorTY !== bTY) continue;
        bestId = id;
        bestKind = "bear";
        bestTX = bTX;
        bestTY = bTY;
        bestEntityX = data.x;
        bestEntityY = data.y;
        break;
      }
    }

    if (!bestId && !me.inInterior) {
      for (const [id, sprite] of this.crowSprites) {
        const data = sprite?.getData("server") as
          | { x: number; y: number; isDead?: boolean; looted?: boolean }
          | undefined;
        if (!data?.isDead || data.looted) continue;
        const cTX = Math.floor(data.x);
        const cTY = Math.floor(data.y);
        if (cursorTX !== cTX || cursorTY !== cTY) continue;
        bestId = id;
        bestKind = "crow";
        bestTX = cTX;
        bestTY = cTY;
        bestEntityX = data.x;
        bestEntityY = data.y;
        break;
      }
    }

    if (!bestId) {
      for (const [id, sprite] of this.guardSprites) {
        const data = sprite?.getData("server") as
          | {
              x: number;
              y: number;
              isDead?: boolean;
              looted?: boolean;
              inInterior?: boolean;
              buildingX?: number;
              buildingY?: number;
            }
          | undefined;
        if (!data?.isDead || data.looted) continue;
        if (me.inInterior !== !!data.inInterior) continue;
        if (
          me.inInterior &&
          (data.buildingX !== me.buildingX || data.buildingY !== me.buildingY)
        ) {
          continue;
        }

        const gTX = Math.floor(data.x);
        const gTY = Math.floor(data.y);
        if (cursorTX !== gTX || cursorTY !== gTY) continue;

        bestId = id;
        bestKind = "guard";
        bestTX = gTX;
        bestTY = gTY;
        bestEntityX = data.x;
        bestEntityY = data.y;
        break;
      }
    }

    if (!bestId) {
      for (const [id, sprite] of this.corpseSprites) {
        const data = sprite?.getData("server") as
          | {
              x: number;
              y: number;
              looted?: boolean;
              inInterior?: boolean;
              buildingX?: number;
              buildingY?: number;
            }
          | undefined;
        if (!data || data.looted) continue;
        if (me.inInterior !== !!data.inInterior) continue;
        if (
          me.inInterior &&
          (data.buildingX !== me.buildingX || data.buildingY !== me.buildingY)
        ) {
          continue;
        }

        const cTX = Math.floor(data.x);
        const cTY = Math.floor(data.y);
        if (cursorTX !== cTX || cursorTY !== cTY) continue;

        bestId = id;
        bestKind = "player";
        bestTX = cTX;
        bestTY = cTY;
        bestEntityX = data.x;
        bestEntityY = data.y;
        break;
      }
    }

    this.hoveredLootableId = bestId;
    this.hoveredLootableKind = bestKind;

    if (me.inInterior) {
      if (!this.hoveredSearchableId) {
        if (bestId) this.interiorView?.highlightTile(bestTX, bestTY);
        else clearLootHighlight();
      }
    } else if (bestId) {
      this.tileManager?.highlightInteractionTile(bestTX, bestTY);
    } else if (!this.hoveredSearchableId) {
      this.tileManager?.highlightInteractionTile(null, null);
    }

    const canLoot =
      bestId !== null &&
      !me.searchTargetId &&
      !!playerSim &&
      playerNearEntity(playerSim.x, playerSim.y, bestEntityX, bestEntityY);
    this.game.canvas.style.cursor = canLoot ? "pointer" : "";
  }

  private handleSearchInput() {
    if (!this.room || !this.keys) return;
    if (this.isOverlayOpen() || this.chatOpen) {
      this.searchKeyWasDown = false;
      this.keys.E.reset();
      return;
    }
    const me = this.room.state?.players?.get(this.sessionId);
    if (!me?.alive) {
      this.searchKeyWasDown = false;
      this.keys.E.reset();
      return;
    }

    const eDown = this.keys.E.isDown;
    if (!eDown) {
      this.searchKeyWasDown = false;
      return;
    }
    if (this.searchKeyWasDown) return;
    if (this.isBusyWithTimedAction(me)) return;

    this.searchKeyWasDown = true;
    let started = false;

    const target = this.nearestSearchable();
    if (target && playerAdjacentToSearchable(me.x, me.y, target)) {
      const overworldBag = target.buildingX === OVERWORLD_BAG_BUILDING;
      if (overworldBag ? !me.inInterior : me.inInterior) {
        if (furnitureIsFurnace(target.objectType)) {
          this.stopPlayerMovement();
          const message: ClientMessage = {
            type: "fireplaceOpen",
            payload: { x: target.x, y: target.y },
          };
          this.room.send("action", message);
        } else if (furnitureIsStairs(target.objectType)) {
          this.stopPlayerMovement();
          this.noteStairsUsed(me.interiorLevel ?? 0);
          const message: ClientMessage = {
            type: "useStairs",
            payload: { searchableId: target.id },
          };
          this.room.send("action", message);
        } else if (furnitureIsCraftStation(target.objectType)) {
          const message: ClientMessage = {
            type: "craftOpen",
            payload: { workbenchId: target.id },
          };
          this.room.send("action", message);
        } else {
          const message: ClientMessage = {
            type: "searchStart",
            payload: { searchableId: target.id },
          };
          this.beginOptimisticSearch("furniture", target.objectType);
          this.room.send("action", message);
        }
        started = true;
      }
    }

    // Open adjacent Fireplace1 (structure tile).
    if (!started) {
      const fp = this.nearestAdjacentFireplace(me);
      if (fp) {
        this.stopPlayerMovement();
        const message: ClientMessage = {
          type: "fireplaceOpen",
          payload: { x: fp.x, y: fp.y },
        };
        this.room.send("action", message);
        started = true;
      }
    }

    if (!started) {
      const box = this.nearestAdjacentStorageBox(me);
      if (box) {
        this.stopPlayerMovement();
        const message: ClientMessage = {
          type: "storageBoxOpen",
          payload: { x: box.x, y: box.y },
        };
        this.room.send("action", message);
        started = true;
      }
    }

    // Open adjacent un-built prefab (deposit UI).
    if (!started) {
      const prefab = this.nearestAdjacentPrefab(me);
      if (prefab) {
        this.stopPlayerMovement();
        const message: ClientMessage = {
          type: "prefabOpen",
          payload: { x: prefab.x, y: prefab.y },
        };
        this.room.send("action", message);
        started = true;
      }
    }

    // Talk to nearby Trader / Red Order (works armed or unarmed).
    if (!started) {
      const npcId = this.nearestTalkableNpc(me);
      if (npcId) {
        this.stopPlayerMovement();
        this.clearInteractTarget();
        this.openInteractAction("dialog", npcId);
        started = true;
      }
    }

    if (
      !started &&
      this.hoveredLootableId &&
      this.hoveredLootableKind === "zombie"
    ) {
      const entitySprite = this.zombieSprites.get(this.hoveredLootableId);
      const entityData = entitySprite?.getData("server") as
        | { x: number; y: number }
        | undefined;
      if (
        entityData &&
        playerNearEntity(me.x, me.y, entityData.x, entityData.y)
      ) {
        const message: ClientMessage = {
          type: "lootZombieStart",
          payload: { zombieId: this.hoveredLootableId },
        };
        this.beginOptimisticSearch();
        this.room.send("action", message);
        started = true;
      }
    }

    if (
      !started &&
      this.hoveredLootableId &&
      this.hoveredLootableKind === "bear"
    ) {
      const entitySprite = this.bearSprites.get(this.hoveredLootableId);
      const entityData = entitySprite?.getData("server") as
        | { x: number; y: number }
        | undefined;
      if (
        entityData &&
        !me.inInterior &&
        playerNearEntity(me.x, me.y, entityData.x, entityData.y)
      ) {
        const message: ClientMessage = {
          type: "lootBearStart",
          payload: { bearId: this.hoveredLootableId },
        };
        this.beginOptimisticSearch();
        this.room.send("action", message);
        started = true;
      }
    }

    if (
      !started &&
      this.hoveredLootableId &&
      this.hoveredLootableKind === "crow"
    ) {
      const entitySprite = this.crowSprites.get(this.hoveredLootableId);
      const entityData = entitySprite?.getData("server") as
        | { x: number; y: number }
        | undefined;
      if (
        entityData &&
        !me.inInterior &&
        playerNearEntity(me.x, me.y, entityData.x, entityData.y)
      ) {
        const message: ClientMessage = {
          type: "lootCrowStart",
          payload: { crowId: this.hoveredLootableId },
        };
        this.beginOptimisticSearch();
        this.room.send("action", message);
        started = true;
      }
    }

    if (
      !started &&
      this.hoveredLootableId &&
      this.hoveredLootableKind === "coywolf"
    ) {
      const entitySprite = this.coywolfSprites.get(this.hoveredLootableId);
      const entityData = entitySprite?.getData("server") as
        | { x: number; y: number }
        | undefined;
      if (
        entityData &&
        !me.inInterior &&
        playerNearEntity(me.x, me.y, entityData.x, entityData.y)
      ) {
        const message: ClientMessage = {
          type: "lootCoyoteStart",
          payload: { coywolfId: this.hoveredLootableId },
        };
        this.beginOptimisticSearch();
        this.room.send("action", message);
        started = true;
      }
    }

    if (
      !started &&
      this.hoveredLootableId &&
      this.hoveredLootableKind === "guard"
    ) {
      const entitySprite = this.guardSprites.get(this.hoveredLootableId);
      const entityData = entitySprite?.getData("server") as
        | { x: number; y: number }
        | undefined;
      if (
        entityData &&
        playerNearEntity(me.x, me.y, entityData.x, entityData.y)
      ) {
        const message: ClientMessage = {
          type: "lootGuardStart",
          payload: { guardId: this.hoveredLootableId },
        };
        this.beginOptimisticSearch();
        this.room.send("action", message);
        started = true;
      }
    }

    if (
      !started &&
      this.hoveredLootableId &&
      this.hoveredLootableKind === "player"
    ) {
      const entitySprite = this.corpseSprites.get(this.hoveredLootableId);
      const entityData = entitySprite?.getData("server") as
        | { x: number; y: number }
        | undefined;
      if (
        entityData &&
        playerNearEntity(me.x, me.y, entityData.x, entityData.y)
      ) {
        const message: ClientMessage = {
          type: "lootPlayerStart",
          payload: { corpseId: this.hoveredLootableId },
        };
        this.beginOptimisticSearch();
        this.room.send("action", message);
      }
    }
  }

  private setStatus(text: string) {
    if (text === this.lastStatusText) return;
    this.lastStatusText = text;
    if (this.statusEl) this.statusEl.textContent = text;
  }

  /** Status bar + search progress — once per frame, not per entity update. */
  private updateDayNightLighting(dt = 16) {
    if (!this.dayNightLighting || !this.room?.state) return;
    const worldTimeMs = this.room.state.worldTimeMs ?? 0;
    const me = this.room.state.players?.get(this.sessionId);
    const indoor = !!me?.inInterior;
    const alwaysLit =
      indoor && !!me && buildingInteriorIsPowered(me.buildingX, me.buildingY);
    const sky = parseSky(this.room.state.sky);
    const precip = parsePrecip(this.room.state.weather);
    this.weatherFx?.update(
      dt,
      indoor,
      sky,
      precip,
      worldTimeMs,
      this.room.state.lightningFlashAt ?? 0,
      this.room.state.lightningThunderAt ?? 0,
      alwaysLit,
    );
    if (this.weatherFx?.consumeThunder()) {
      AudioManager.get().playThunder(indoor);
    }
    const weather = this.weatherFx?.amounts() ?? {
      cloudy: 0,
      rain: 0,
      fog: 0,
      snow: 0,
      wetness: 0,
    };
    this.tileManager?.updateRainPuddles(weather.wetness, dt);
    const look = dayNightLook(worldTimeMs, {
      indoor,
      alwaysLit,
      cloudyAmount: weather.cloudy,
      fogAmount: weather.fog,
      rainAmount: weather.rain,
      snowAmount: weather.snow,
    });
    if (this.worldClockEl) {
      const inventoryJson =
        this.localInventorySync?.inventoryJson ?? me?.inventoryJson ?? "[]";
      const inventory = this.readLocalInventory(inventoryJson);
      const wornWatch = inventory[WATCH_SLOT_INDEX];
      const showClock = !!wornWatch && isWatchItem(wornWatch.id);
      const clock = this.lastWorldClock;
      const clockHidden = !me || !showClock;
      if (clock.clockHidden !== clockHidden) {
        clock.clockHidden = clockHidden;
        this.worldClockEl.hidden = clockHidden;
      }
      if (this.worldClockTimeEl) {
        if (clock.timeHidden !== !showClock) {
          clock.timeHidden = !showClock;
          this.worldClockTimeEl.hidden = !showClock;
        }
        const timeText = showClock ? look.clockLabel : "";
        if (clock.time !== timeText) {
          clock.time = timeText;
          this.worldClockTimeEl.textContent = timeText;
        }
      }
      const phase = showClock ? look.phase : "";
      if (clock.phase !== phase) {
        clock.phase = phase;
        if (phase) {
          this.worldClockEl.dataset.phase = phase;
        } else {
          delete this.worldClockEl.dataset.phase;
          delete this.worldClockEl.dataset.weather;
        }
      }
    }

    const lights: NightLight[] = [];
    let firelit = false;

    if (indoor) {
      this.interiorView?.forEachLantern((x, y) => {
        lights.push({
          x,
          y,
          radius: 150,
          color: 0xffc878,
          strength: 0.7,
        });
      });
      this.interiorView?.forEachLitFireplace(Date.now(), (x, y) => {
        firelit = true;
        lights.push({
          x,
          y,
          radius: 128,
          color: 0xd46828,
          strength: 0.62,
          kind: "fire",
          seed: x * 0.17 + y * 0.31,
        });
      });
    } else {
      this.tileManager?.forEachStreetlightSprite((img) => {
        lights.push({
          x: img.x,
          y: img.y - 170,
          radius: 300,
          color: 0xffc878,
          strength: 0.75,
        });
      });
      const now = Date.now();
      for (const [key, tile] of this.structureFireplacesOverworld) {
        if (now >= tile.activeUntil) continue;
        const sprite = this.overworldFireplaceSprites.get(key);
        if (!sprite?.visible) continue;
        lights.push({
          x: sprite.x,
          y: sprite.y - sprite.displayHeight * 0.45,
          radius: 128,
          color: 0xd46828,
          strength: 0.62,
          kind: "fire",
          seed: sprite.x * 0.17 + sprite.y * 0.31,
          tileX: tile.x,
          tileY: tile.y,
        });
      }
    }

    this.dayNightLighting.update(worldTimeMs, indoor, lights, {
      alwaysLit,
      firelit,
      dtMs: dt,
      cloudyAmount: weather.cloudy,
      fogAmount: weather.fog,
      rainAmount: weather.rain,
      snowAmount: weather.snow,
    });
  }

  /** Throttled checks that advance tutorial steps and raise one-time tips. */
  private updateTutorialWatch(
    me: {
      alive?: boolean;
      anim?: string;
      x: number;
      y: number;
      inInterior?: boolean;
      buildingX: number;
      buildingY: number;
      hunger: number;
      thirst: number;
      infected?: boolean;
      redOrderReputation?: number;
      ashenReputation?: number;
      ashenMilitiaReputation?: number;
    },
    health: number,
    maxHp: number,
    staminaPct: number,
    tempFx: "none" | "cold" | "hot",
  ) {
    const ui = this.onboardingUI;
    if (!ui) return;
    if (!me.alive) {
      this.tutorialVitals = null;
      this.tutorialSawDeath = true;
      return;
    }
    if (this.tutorialSawDeath) {
      this.tutorialSawDeath = false;
      ui.notifyTip("first_death");
    }

    if (me.anim === "walk") ui.notifyStep("move");
    if (me.anim === "sprint" || me.anim === "run") {
      ui.notifyStep("move");
      ui.notifyStep("sprint");
    }
    const prevVitals = this.tutorialVitals;
    this.tutorialVitals = { hunger: me.hunger, thirst: me.thirst };
    if (
      prevVitals &&
      (me.hunger > prevVitals.hunger + 0.5 || me.thirst > prevVitals.thirst + 0.5)
    ) {
      ui.notifyStep("eat_drink");
    }

    const now = this.time.now;
    if (now - this.lastTutorialWatchAt < 500) return;
    this.lastTutorialWatchAt = now;

    if (me.inInterior === false) {
      ui.notifyStep("leave_hospital");
      if (!isInBirchport(me.x, me.y)) ui.notifyStep("leave_town");
    }
    if (me.inInterior) {
      const target = parseQuestsJson(this.cachedQuestsJson).quests[
        QUEST_ID_FIRST_SWEEP
      ];
      if (
        target?.status === "active" &&
        target.targetX === me.buildingX &&
        target.targetY === me.buildingY
      ) {
        ui.notifyStep("enter_target");
      }
    }

    if (me.hunger <= HUNGER_MAX * 0.25) ui.notifyTip("hungry");
    if (me.thirst <= THIRST_MAX * 0.25) ui.notifyTip("thirsty");
    if (tempFx === "cold") ui.notifyTip("cold");
    if (tempFx === "hot") ui.notifyTip("hot");
    if (me.infected) ui.notifyTip("infected");
    if (health > 0 && health < maxHp * 0.5) ui.notifyTip("low_health");
    if (staminaPct <= 0) ui.notifyTip("stamina_out");
    if (this.room && isNightPhase(phaseOfDay(this.room.state.worldTimeMs))) {
      ui.notifyTip("night");
    }
    const hostile = (rep: number | undefined) => {
      if (rep == null) return false;
      const standing = factionStanding(rep);
      return standing === "hostile" || standing === "exiled";
    };
    if (
      hostile(me.redOrderReputation) ||
      hostile(me.ashenReputation) ||
      hostile(me.ashenMilitiaReputation)
    ) {
      ui.notifyTip("standing_hostile");
    }
    if (!isInBirchport(me.x, me.y) && this.zombieWithinTiles(me, 10)) {
      ui.notifyTip("zombie_near");
    }
    if (me.inInterior === false && this.playerInForest(me.x, me.y)) {
      ui.notifyTip("wildlife");
    }
    if (this.isOutsideTown(me) && this.survivorWithinTiles(me, 16)) {
      ui.notifyTip("other_survivor");
    }
    if (this.room) {
      const precip = parsePrecip(this.room.state.weather);
      if (precip === "rain" && this.tutorialPrecip !== "rain") {
        ui.notifyTip("rain");
      }
      this.tutorialPrecip = precip;
    }
  }

  private isOutsideTown(me: {
    x: number;
    y: number;
    inInterior?: boolean;
    buildingX: number;
    buildingY: number;
  }): boolean {
    if (!me.inInterior) return !isInBirchport(me.x, me.y);
    const bld = getBuildingAt(me.buildingX, me.buildingY);
    if (bld) return !isInBirchport(bld.ox + bld.w / 2, bld.oy + bld.h / 2);
    return !isInBirchport(me.buildingX, me.buildingY);
  }

  private zombieWithinTiles(
    me: { x: number; y: number; inInterior?: boolean; buildingX: number; buildingY: number },
    tiles: number,
  ): boolean {
    const zombies = this.room?.state?.zombies;
    if (!zombies) return false;
    const r2 = tiles * tiles;
    let found = false;
    zombies.forEach((z: {
      x: number;
      y: number;
      health?: number;
      inInterior?: boolean;
      buildingX?: number;
      buildingY?: number;
    }) => {
      if (found || (z.health ?? 1) <= 0) return;
      if (!!z.inInterior !== !!me.inInterior) return;
      if (me.inInterior && (z.buildingX !== me.buildingX || z.buildingY !== me.buildingY)) {
        return;
      }
      const dx = z.x - me.x;
      const dy = z.y - me.y;
      if (dx * dx + dy * dy <= r2) found = true;
    });
    return found;
  }

  private survivorWithinTiles(
    me: { x: number; y: number; inInterior?: boolean; buildingX: number; buildingY: number },
    tiles: number,
  ): boolean {
    const players = this.room?.state?.players;
    if (!players) return false;
    const r2 = tiles * tiles;
    let found = false;
    players.forEach((p: {
      alive?: boolean;
      x: number;
      y: number;
      inInterior?: boolean;
      buildingX?: number;
      buildingY?: number;
    }, id: string) => {
      if (found || id === this.sessionId || !p.alive) return;
      if (!!p.inInterior !== !!me.inInterior) return;
      if (me.inInterior && (p.buildingX !== me.buildingX || p.buildingY !== me.buildingY)) {
        return;
      }
      const dx = p.x - me.x;
      const dy = p.y - me.y;
      if (dx * dx + dy * dy <= r2) found = true;
    });
    return found;
  }

  private logInfectionStatus(me: {
    infected?: boolean;
    infection?: number;
    antibioticUntil?: number;
    infectionTickAt?: number;
  }) {
    const now = Date.now();
    if (now - this.lastInfectionLogAt < 10_000) return;
    this.lastInfectionLogAt = now;
    const infected = !!me.infected;
    const infection = me.infection ?? 0;
    const abxLeft = Math.max(0, (me.antibioticUntil ?? 0) - now);
    const tickLeft = Math.max(0, (me.infectionTickAt ?? 0) - now);
    const remain = (ms: number) => {
      const sec = Math.max(0, Math.ceil(ms / 1000));
      const m = Math.floor(sec / 60);
      const s = sec % 60;
      return m > 0 ? `${m}m${String(s).padStart(2, "0")}s` : `${s}s`;
    };
    const parts = [
      `[infection] infected=${infected}`,
      `${infection}%`,
      `maxHp=${playerMaxHealthFromInfection(infection, infected)}`,
    ];
    if (abxLeft > 0) parts.push(`abx=${remain(abxLeft)}`);
    if (infected && tickLeft > 0) {
      parts.push(`nextTick=${remain(tickLeft)}`);
    }
    console.log(parts.join(" "));
  }

  private updateLocalPlayerHud() {
    const me = this.room?.state?.players?.get(this.sessionId);
    const sprite = this.playerSprites.get(this.sessionId);
    if (!me || !sprite) return;

    const data = sprite.getData("server") as { health?: number } | undefined;
    const health = data?.health ?? me.health;

    const infected = !!me.infected;
    const infection = me.infection ?? 0;
    const maxHp = playerMaxHealthFromInfection(infection, infected);
    const healthPct = Math.max(
      0,
      Math.min(100, (Math.min(health, maxHp) / PLAYER_MAX_HEALTH) * 100),
    );
    const capPct = Math.max(0, Math.min(100, (maxHp / PLAYER_MAX_HEALTH) * 100));
    const lostPct = Math.max(0, 100 - capPct);
    const staminaMax = Math.max(1, this.localSkillMods().staminaMax);
    const staminaPct = Math.max(0, Math.min(100, (me.stamina / staminaMax) * 100));
    const hungerPct = Math.max(0, Math.min(100, (me.hunger / HUNGER_MAX) * 100));
    const thirstPct = Math.max(0, Math.min(100, (me.thirst / THIRST_MAX) * 100));
    const tempLook = temperatureHudLook(
      me.temperature ?? TEMPERATURE_CORE_DEFAULT,
    );

    // Bars sit in a DOM layer over the canvas, so every write costs a style
    // recalc. Vitals only move every few seconds: write on change only.
    const bars = this.lastHudBars;
    if (this.healthFillEl && bars.healthPct !== healthPct) {
      bars.healthPct = healthPct;
      this.healthFillEl.style.width = `${healthPct}%`;
    }
    if (this.healthCapEl && bars.capPct !== capPct) {
      bars.capPct = capPct;
      this.healthCapEl.style.width = `${capPct}%`;
    }
    if (this.healthLostEl && bars.lostPct !== lostPct) {
      bars.lostPct = lostPct;
      this.healthLostEl.style.width = `${lostPct}%`;
    }
    this.logInfectionStatus(me);
    if (this.staminaFillEl && bars.staminaPct !== staminaPct) {
      bars.staminaPct = staminaPct;
      this.staminaFillEl.style.width = `${staminaPct}%`;
    }
    if (this.hungerFillEl && bars.hungerPct !== hungerPct) {
      bars.hungerPct = hungerPct;
      this.hungerFillEl.style.width = `${hungerPct}%`;
    }
    if (this.thirstFillEl && bars.thirstPct !== thirstPct) {
      bars.thirstPct = thirstPct;
      this.thirstFillEl.style.width = `${thirstPct}%`;
    }
    if (this.tempFillEl && bars.tempPct !== tempLook.percent) {
      bars.tempPct = tempLook.percent;
      this.tempFillEl.style.width = `${tempLook.percent}%`;
    }
    if (this.tempFillEl && bars.tempColor !== tempLook.fillColor) {
      bars.tempColor = tempLook.fillColor;
      this.tempFillEl.style.background = tempLook.fillColor;
    }
    if (this.tempLabelEl && bars.tempLabel !== tempLook.label) {
      bars.tempLabel = tempLook.label;
      this.tempLabelEl.textContent = tempLook.label;
    }

    const clothingSkin =
      this.localInventorySync?.clothingSkin ?? me.clothingSkin ?? 1;
    if (
      this.playerAvatarImgEl &&
      clothingSkin !== this.lastHudAvatarSkin
    ) {
      this.lastHudAvatarSkin = clothingSkin;
      this.playerAvatarImgEl.src = playerAvatarSrc(clothingSkin);
    }

    const hungerCritical = hungerPct <= 0;
    const thirstCritical = thirstPct <= 0;
    if (bars.hungerCritical !== hungerCritical) {
      bars.hungerCritical = hungerCritical;
      this.hungerTrackEl?.classList.toggle("player-bar-track--critical", hungerCritical);
      this.hungerLabelEl?.classList.toggle("player-bar-label--critical", hungerCritical);
    }
    if (bars.thirstCritical !== thirstCritical) {
      bars.thirstCritical = thirstCritical;
      this.thirstTrackEl?.classList.toggle("player-bar-track--critical", thirstCritical);
      this.thirstLabelEl?.classList.toggle("player-bar-label--critical", thirstCritical);
    }
    if (bars.tempCritical !== tempLook.critical) {
      bars.tempCritical = tempLook.critical;
      this.tempTrackEl?.classList.toggle("player-bar-track--critical", tempLook.critical);
      this.tempLabelEl?.classList.toggle("player-bar-label--critical", tempLook.critical);
    }
    if (bars.tempFx !== tempLook.fx) {
      bars.tempFx = tempLook.fx;
      this.temperatureFxEl?.classList.toggle("temp-fx-cold", tempLook.fx === "cold");
      this.temperatureFxEl?.classList.toggle("temp-fx-hot", tempLook.fx === "hot");
    }
    const infectionOpacity = infected
      ? (0.22 + (Math.max(0, Math.min(100, infection)) / 100) * 0.78).toFixed(2)
      : "0";
    if (this.infectionFxEl && bars.infectionFx !== infectionOpacity) {
      bars.infectionFx = infectionOpacity;
      this.infectionFxEl.style.opacity = infectionOpacity;
    }

    this.updateTutorialWatch(me, health, maxHp, staminaPct, tempLook.fx);

    // Progress from a local start time (not server absolute end timestamps),
    // so RTT doesn't make the bar jump to ~30% and vanish before loot arrives.
    // Use inventorySync only to confirm an optimistic reload (reliable channel);
    // once confirmed, schema isReloading=false must be allowed to finish the bar
    // even if a stale start-sync still says isReloading.
    const sync = this.localInventorySync;
    const searching = !!me.searchTargetId;
    const syncConfirmsOptimisticReload =
      !!sync?.isReloading &&
      this.localTimedAction?.kind === "reload" &&
      this.localTimedAction.optimistic;
    const reloading = !!me.isReloading || syncConfirmsOptimisticReload;
    const syncConfirmsOptimisticUnload =
      !!sync?.isUnloading &&
      this.localTimedAction?.kind === "unload" &&
      this.localTimedAction.optimistic;
    const unloading = !!me.isUnloading || syncConfirmsOptimisticUnload;
    const consuming = !!me.isConsuming;
    const crafting = !!me.isCrafting;
    const changingClothes = !!me.isChangingClothes;
    const building = !!me.isBuilding;

    if (searching) {
      this.beginLocalTimedAction(
        "search",
        this.localSkillMods().searchDurationMs,
        "Searching",
        false,
      );
    } else if (reloading) {
      this.beginLocalTimedAction(
        "reload",
        this.localSkillMods().reloadMs,
        "Reloading",
        false,
      );
    } else if (unloading) {
      this.beginLocalTimedAction("unload", UNLOAD_DURATION_MS, "Unloading", false);
    } else if (consuming) {
      this.beginLocalTimedAction(
        "consume",
        Math.max(1, me.consumeDurationMs || 1),
        this.consumeActionLabel,
        false,
      );
    } else if (crafting) {
      this.beginLocalTimedAction(
        "craft",
        Math.max(1, me.craftDurationMs || CRAFT_DURATION_MS),
        "Crafting",
        false,
      );
    } else if (changingClothes) {
      const action =
        me.clothingChangeAction === "remove" ? "remove" : "wear";
      this.clothingActionLabel = CLOTHING_CHANGE_ACTION_LABELS[action];
      this.beginLocalTimedAction(
        "clothing",
        Math.max(1, me.clothingChangeDurationMs || CLOTHING_CHANGE_DURATION_MS),
        this.clothingActionLabel,
        false,
      );
    } else if (building) {
      const deconstructing = me.buildAction === "deconstruct";
      this.beginLocalTimedAction(
        "build",
        Math.max(
          1,
          me.buildDurationMs ||
            (deconstructing
              ? STRUCTURE_DECONSTRUCT_DURATION_MS
              : PREFAB_BUILD_DURATION_MS),
        ),
        deconstructing ? "Deconstructing" : "Building",
        false,
      );
    } else if (this.localTimedAction) {
      const action = this.localTimedAction;
      const age = Date.now() - action.startedAt;
      if (action.kind === "search") {
        if (action.optimistic && age < 2500) {
          // Waiting for server confirm.
        } else if (
          !action.optimistic &&
          age >= action.durationMs - 150
        ) {
          // Search time elapsed — hold at 100% until loot UI, then time out.
          if (age > action.durationMs + 3000) {
            this.localTimedAction = null;
            AudioManager.get().stopSearch();
          }
        } else {
          // Cancelled / rejected before finishing.
          this.localTimedAction = null;
          AudioManager.get().stopSearch();
        }
      } else if (action.optimistic) {
        // Wait until the full action window (+ grace) before giving up — a short
        // abort (e.g. 2s on a 3s reload) cleared the bar, then a late confirm
        // restarted it and the finish looked like a cancel.
        if (age >= action.durationMs + 750) {
          this.localTimedAction = null;
        }
      } else if (action.holdUntil != null) {
        if (Date.now() >= action.holdUntil) {
          this.localTimedAction = null;
        }
      } else if (
        action.kind === "craft" &&
        age < action.durationMs - 500
      ) {
        // Fire went out or the player moved. Drop the bar instead of
        // flashing a finished craft.
        this.localTimedAction = null;
      } else if (action.kind === "build") {
        // A build cancelled by a step or a hit must not snap to 100%.
        // The server can still finish a few hundred ms before this clock
        // because the bar starts when the schema patch arrives.
        if (age >= action.durationMs - 750) {
          action.startedAt = Date.now() - action.durationMs;
          action.holdUntil = Date.now() + 180;
        } else {
          this.localTimedAction = null;
        }
      } else if (age >= Math.min(400, action.durationMs * 0.2)) {
        // Server cleared the busy flag after a confirmed action — treat as
        // success. Only very short ages are real cancels (sprint / unequip).
        action.startedAt = Date.now() - action.durationMs;
        action.holdUntil = Date.now() + 180;
      } else {
        // Cancelled mid-action (e.g. sprint).
        this.localTimedAction = null;
      }
    }

    const action = this.localTimedAction;
    if (action) {
      const elapsed = Date.now() - action.startedAt;
      const pct = Math.min(1, elapsed / action.durationMs);
      const pctInt = Math.floor(pct * 100);
      this.searchProgressEl?.classList.add("search-progress--visible");
      if (pctInt !== this.lastSearchProgressPct) {
        this.lastSearchProgressPct = pctInt;
        if (this.searchProgressLabel) {
          this.searchProgressLabel.textContent = `${action.label}... ${pctInt}%`;
        }
        if (this.searchProgressFill) {
          this.searchProgressFill.style.width = `${pctInt}%`;
        }
      }
    } else {
      this.lastSearchProgressPct = -1;
      this.searchProgressEl?.classList.remove("search-progress--visible");
    }
  }

  private spawnBlood(
    worldX: number,
    worldY: number,
    weaponIndex = -1,
    nearGround = false,
    /**
     * Extra screen pixels above a normal chest spray. Flying crows pass
     * their current lift so the burst sits on the bird, not the tile.
     */
    liftPx = 0,
    /** When set, spray this far above the feet instead of a human chest. */
    aboveFeetPx = 0,
  ) {
    if (!this.textures.exists("blood-drop")) return;
    const iso = cartesianToIso(worldX, worldY);
    const me = this.room?.state?.players?.get(this.sessionId);
    let depth =
      (me?.inInterior
        ? this.interiorEntityDepth(worldX, worldY)
        : overworldEntityRenderDepth(worldX, worldY)) + 1;
    if (liftPx > 0) {
      depth += (liftPx / (TILE_HEIGHT / 2)) * 1024;
    }

    // Weapon index matches WEAPONS array: 0=Pistol, 1=Shotgun, 2=Hunting Rifle, 3=Revolver, 4=AK
    const cfg = BLOOD_BY_WEAPON[weaponIndex] ?? BLOOD_BY_WEAPON[-1]!;
    const count = IS_MOBILE ? Math.max(2, Math.ceil(cfg.count * 0.4)) : cfg.count;

    // Standing hits spray from chest height. Crawlers lie on the tile, so
    // the same lift floats above the body. Start just above their feet.
    // A short bird uses aboveFeetPx so the burst is on the body. liftPx
    // then raises it with a flying crow.
    const sprayY = nearGround
      ? entityFeetY(iso.y) + ZOMBIE_CRAWL_TILE_DROP_PX - 8
      : aboveFeetPx > 0
        ? entityFeetY(iso.y) - aboveFeetPx - liftPx
        : iso.y - cfg.originY - liftPx;
    const emitter = this.add.particles(iso.x, sprayY, "blood-drop", {
      speed: cfg.speed,
      angle: cfg.angle,
      scale: cfg.scale,
      alpha: cfg.alpha ?? { start: 0.95, end: 0 },
      lifespan: cfg.lifespan,
      gravityY: cfg.gravityY,
      tint: cfg.tint ?? [0xaa0000, 0x880000, 0x771111, 0x550000],
      emitting: false,
    });
    emitter.setDepth(depth);
    emitter.explode(count);
    this.time.delayedCall(cfg.destroyAfter, () => emitter.destroy());
  }

  /** Altitude of a crow the player can see. Null when the id is not a crow. */
  private crowAltitude(targetId: string): number | null {
    const sprite = this.crowSprites.get(targetId);
    const fromSprite = sprite?.getData("server") as { altitude?: number } | undefined;
    if (fromSprite && typeof fromSprite.altitude === "number") return fromSprite.altitude;
    const schema = this.room?.state?.crows?.get(targetId);
    if (!schema && !sprite) return null;
    return schema?.altitude ?? 0;
  }

  /** Blood on the crow's body, raised by the same flight lift as the sprite. */
  private spawnCrowHitBlood(
    worldX: number,
    worldY: number,
    altitude: number,
    weaponIndex = -1,
  ) {
    this.spawnBlood(
      worldX,
      worldY,
      weaponIndex,
      false,
      crowFlightLiftPx(altitude),
      Math.round(CROW_RENDER_HEIGHT * 0.45),
    );
  }

  private handleEntityHit(
    targetId: string,
    worldX: number,
    worldY: number,
    weaponIndex: number,
  ) {
    this.recentGunHits.add(targetId);
    this.time.delayedCall(700, () => this.recentGunHits.delete(targetId));
    const crowAltitude = this.crowAltitude(targetId);
    if (crowAltitude != null) {
      this.spawnCrowHitBlood(worldX, worldY, crowAltitude, weaponIndex);
      return;
    }
    const zombie = this.room?.state?.zombies?.get(targetId);
    const crawler =
      !!zombie && isZombieCrawler(targetId, zombie.skin);
    this.spawnBlood(worldX, worldY, weaponIndex, crawler);
  }

  private centerWorld() {
    const center = cartesianToIso(
      worldCenter(this.worldBounds).x,
      worldCenter(this.worldBounds).y,
    );
    this.cameras.main.centerOn(center.x, center.y);
    this.cameraZoom = getDefaultCameraZoom();
    this.cameras.main.setZoom(this.cameraZoom);
  }

  /** Snap camera to the local player's schema position (join / respawn). */
  private centerCameraOnLocalPlayer() {
    const me = this.room?.state?.players?.get(this.sessionId);
    if (!me || !Number.isFinite(me.x) || !Number.isFinite(me.y)) return;
    const iso = cartesianToIso(me.x, me.y);
    this.cameras.main.centerOn(iso.x, iso.y);
  }

  /** Keep zoom tight enough that the viewport stays inside the rendered tile diamond. */
  private clampCameraZoomToViewport = () => {
    const minZoom = getCameraZoomMin(this.scale.width, this.scale.height);
    if (this.cameraZoom < minZoom) {
      this.cameraZoom = minZoom;
      this.cameras.main.setZoom(minZoom);
    }
    this.centerCameraOnLocalPlayer();
    this.cameras.main.preRender();
    this.tileManager?.invalidateRenderView();
    this.syncWorldTiles(true);
    this.refreshAllVisuals(0);
  };

  /** Scroll up = zoom in, scroll down = zoom out. */
  private applyCameraWheelZoom(pointer: Phaser.Input.Pointer, deltaY: number) {
    const nextZoom = Phaser.Math.Clamp(
      this.cameraZoom - deltaY * CAMERA_ZOOM_WHEEL,
      getCameraZoomMin(this.scale.width, this.scale.height),
      CAMERA_ZOOM_MAX,
    );
    this.applyCameraZoomAt(pointer.x, pointer.y, nextZoom);
  }

  /**
   * Apply zoom. Camera stays player-centered (same as every frame) so the sticky
   * tile/entity cull AABB is not baked from a cursor-offset scroll — that used to
   * soft-hide idle zombies until they moved / received a schema patch.
   */
  private applyCameraZoomAt(_screenX: number, _screenY: number, nextZoom: number) {
    if (nextZoom === this.cameraZoom) return;
    this.cameraZoom = nextZoom;
    this.cameras.main.setZoom(nextZoom);
    this.syncGunshotListener();
    this.centerCameraOnLocalPlayer();
    if (!IS_MOBILE) {
      // Rebuild the camera matrix before the frame's single tile sync.
      // getWorldPoint is stale until preRender. Filling here as well as in
      // update painted the new edge twice and restarted the scan per notch.
      this.cameras.main.preRender();
      this.cameraViewDirty = true;
    }
  }

  private countDownPointers(except?: Phaser.Input.Pointer): number {
    let n = 0;
    for (const p of this.input.manager.pointers) {
      if (except && p === except) continue;
      if (!p.active || !p.isDown) continue;
      // A held thumb stick must not count as a second finger (that starts pinch zoom).
      if (this.isMoveStickPointer(p)) continue;
      n++;
    }
    return n;
  }

  private isMoveStickPointer(pointer: Phaser.Input.Pointer): boolean {
    const stick = this.moveStickEl;
    if (!stick) return false;
    const target = pointer.event?.target;
    return target instanceof Node && stick.contains(target);
  }

  /** True when the DOM event for this Phaser pointer landed on the game canvas. */
  private isPointerOnGameCanvas(pointer: Phaser.Input.Pointer): boolean {
    const ev = pointer.event;
    if (!ev) return true;
    const target = ev.target;
    if (!(target instanceof Node)) return true;
    const canvas = this.game.canvas;
    return target === canvas || canvas.contains(target);
  }

  /**
   * HTML overlays/buttons steal pointerup from Phaser and leave isDown stuck,
   * which blocks deferred mobile tap-to-move. Reset touch gesture state.
   */
  private releaseStolenTouchInput(opts?: { swallowTapMs?: number }) {
    this.clearPendingTouchTap();
    this.pinchActive = false;
    this.cameraDrag = false;
    this.input.resetPointers();
    if (opts?.swallowTapMs && opts.swallowTapMs > 0) {
      this.ignoreTouchTapUntil = Date.now() + opts.swallowTapMs;
    }
  }

  /** Reset Phaser touch state whenever inventory/map/trader/chat opens or closes. */
  private syncBlockingUiInputState() {
    const blocked = this.isOverlayOpen() || this.chatOpen;
    if (blocked === this.wasBlockingUiOpen) return;
    this.wasBlockingUiOpen = blocked;
    // Closing: also swallow the same tap that dismissed the dialog if it falls through.
    this.releaseStolenTouchInput(blocked ? undefined : { swallowTapMs: 280 });
  }

  private getPinchPair():
    | [Phaser.Input.Pointer, Phaser.Input.Pointer]
    | null {
    const down: Phaser.Input.Pointer[] = [];
    for (const p of this.input.manager.pointers) {
      if (p.active && p.isDown) down.push(p);
      if (down.length >= 2) break;
    }
    if (down.length < 2) return null;
    return [down[0]!, down[1]!];
  }

  private beginPinchZoom() {
    const pair = this.getPinchPair();
    if (!pair) return;
    const [a, b] = pair;
    const dist = Math.hypot(a.x - b.x, a.y - b.y);
    this.pinchActive = true;
    this.pinchStartDistance = Math.max(1, dist);
    this.pinchStartZoom = this.cameraZoom;
  }

  private updatePinchZoom() {
    if (this.isOverlayOpen() || this.chatOpen) {
      this.pinchActive = false;
      return;
    }
    const pair = this.getPinchPair();
    if (!pair) {
      this.pinchActive = false;
      return;
    }
    const [a, b] = pair;
    const dist = Math.hypot(a.x - b.x, a.y - b.y);
    if (!this.pinchActive) {
      this.beginPinchZoom();
      return;
    }
    const scale = dist / this.pinchStartDistance;
    const nextZoom = Phaser.Math.Clamp(
      this.pinchStartZoom * scale,
      getCameraZoomMin(this.scale.width, this.scale.height),
      CAMERA_ZOOM_MAX,
    );
    const midX = (a.x + b.x) * 0.5;
    const midY = (a.y + b.y) * 0.5;
    this.applyCameraZoomAt(midX, midY, nextZoom);
  }

  /**
   * Temp-wall / structure sync messages — must be bound before `clientReady`
   * so reconnect sync from the server is not dropped.
   */
  private bindStructureMessages(room: WorldRoom) {
    room.onMessage(
      "tempWallPlaced",
      (msg: {
        inInterior?: boolean;
        buildingX?: number;
        buildingY?: number;
        x?: number;
        y?: number;
      }) => {
        if (msg.x == null || msg.y == null) return;
        if (msg.inInterior === false) {
          this.applyOverworldTempWallPlaced(msg.x, msg.y);
          return;
        }
        if (msg.buildingX == null || msg.buildingY == null) return;
        this.applyTempWallPlaced(msg.buildingX, msg.buildingY, msg.x, msg.y);
      },
    );

    room.onMessage(
      "tempWallsSync",
      (msg: {
        inInterior?: boolean;
        buildingX?: number;
        buildingY?: number;
        walls?: { x: number; y: number }[];
      }) => {
        if (!msg.walls) return;
        if (msg.inInterior === false) {
          this.applyOverworldTempWallsSync(msg.walls);
          return;
        }
        if (msg.buildingX == null || msg.buildingY == null) return;
        this.applyTempWallsSync(msg.buildingX, msg.buildingY, msg.walls);
      },
    );

    room.onMessage("structureBuildMode", (msg: { enabled?: boolean }) => {
      this.structureBuildMode = msg.enabled === true;
      document.body.classList.toggle("build-mode-open", this.structureBuildMode);
      this.updateStructureBuildHud();
      this.refreshMobileActionButtons();
      if (!this.structureBuildMode) {
        if (this.deconstructUI?.isOpen()) this.closeDeconstructUI();
        this.clearBuildModePreview();
        if (!this.buildMode) this.game.canvas.style.cursor = "";
      } else {
        this.game.canvas.style.cursor = "crosshair";
      }
    });

    room.onMessage(
      "structurePlaced",
      (msg: {
        inInterior?: boolean;
        buildingX?: number;
        buildingY?: number;
        x?: number;
        y?: number;
        kind?: StructureBuildKind;
        ownerWallet?: string;
        isOpen?: boolean;
        isLocked?: boolean;
        activeUntil?: number;
        fuelWood?: number;
        status?: "prefab" | "solid";
        facing?: StructureFenceFacing | StructureFenceCorner;
      }) => {
        if (msg.x == null || msg.y == null || !msg.kind || !msg.ownerWallet) return;
        this.applyStructurePlaced({
          inInterior: msg.inInterior === true,
          buildingX: msg.buildingX ?? 0,
          buildingY: msg.buildingY ?? 0,
          x: msg.x,
          y: msg.y,
          kind: msg.kind,
          ownerWallet: msg.ownerWallet,
          isOpen: msg.isOpen === true,
          isLocked: msg.isLocked === true,
          activeUntil: Number(msg.activeUntil ?? 0) || 0,
          fuelWood: Number(msg.fuelWood ?? 0) || 0,
          status: msg.status === "prefab" ? "prefab" : "solid",
          facing: msg.facing,
        });
      },
    );

    room.onMessage(
      "prefabBuilt",
      (msg: {
        inInterior?: boolean;
        buildingX?: number;
        buildingY?: number;
        x?: number;
        y?: number;
        kind?: StructureBuildKind;
        ownerWallet?: string;
        isOpen?: boolean;
        isLocked?: boolean;
        activeUntil?: number;
        fuelWood?: number;
        facing?: StructureFenceFacing | StructureFenceCorner;
      }) => {
        if (msg.x == null || msg.y == null || !msg.kind) return;
        this.applyPrefabBuilt({
          inInterior: msg.inInterior === true,
          buildingX: msg.buildingX,
          buildingY: msg.buildingY,
          x: msg.x,
          y: msg.y,
          kind: msg.kind,
          ownerWallet: msg.ownerWallet ?? "",
          isOpen: msg.isOpen === true,
          isLocked: msg.isLocked === true,
          activeUntil: Number(msg.activeUntil ?? 0) || 0,
          fuelWood: Number(msg.fuelWood ?? 0) || 0,
          facing: msg.facing,
        });
      },
    );

    room.onMessage(
      "structureDamaged",
      (msg: {
        x?: number;
        y?: number;
        inInterior?: boolean;
        buildingX?: number;
        buildingY?: number;
        health?: number;
        maxHealth?: number;
        destroyed?: boolean;
      }) => {
        if (msg.x == null || msg.y == null) return;
        this.applyStructureDamaged({
          x: msg.x,
          y: msg.y,
          inInterior: msg.inInterior === true,
          buildingX: msg.buildingX,
          buildingY: msg.buildingY,
          health: Number(msg.health ?? 0) || 0,
          maxHealth: Number(msg.maxHealth ?? 0) || 0,
          destroyed: msg.destroyed === true,
        });
      },
    );

    room.onMessage(
      "structureRemoved",
      (msg: {
        inInterior?: boolean;
        buildingX?: number;
        buildingY?: number;
        x?: number;
        y?: number;
        kind?: StructureBuildKind;
      }) => {
        if (msg.x == null || msg.y == null || !msg.kind) return;
        this.applyStructureRemoved({
          inInterior: msg.inInterior === true,
          buildingX: msg.buildingX ?? 0,
          buildingY: msg.buildingY ?? 0,
          x: msg.x,
          y: msg.y,
          kind: msg.kind,
        });
      },
    );

    room.onMessage(
      "structuresSync",
      (msg: {
        inInterior?: boolean;
        buildingX?: number;
        buildingY?: number;
        structures?: {
          x: number;
          y: number;
          kind: StructureBuildKind;
          ownerWallet: string;
          isOpen: boolean;
          isLocked: boolean;
          activeUntil?: number;
          fuelWood?: number;
          status?: "prefab" | "solid";
          facing?: StructureFenceFacing | StructureFenceCorner;
        }[];
      }) => {
        if (!msg.structures) return;
        this.applyStructuresSync(
          msg.inInterior === true,
          msg.buildingX ?? 0,
          msg.buildingY ?? 0,
          msg.structures,
        );
      },
    );

    room.onMessage(
      "doorStateChanged",
      (msg: {
        x?: number;
        y?: number;
        inInterior?: boolean;
        buildingX?: number;
        buildingY?: number;
        isOpen?: boolean;
        isLocked?: boolean;
      }) => {
        if (msg.x == null || msg.y == null) return;
        this.applyDoorStateChanged(
          msg.x,
          msg.y,
          msg.inInterior === true,
          msg.buildingX ?? 0,
          msg.buildingY ?? 0,
          msg.isOpen === true,
          msg.isLocked === true,
        );
      },
    );

    room.onMessage(
      "fireplaceStateChanged",
      (msg: {
        x?: number;
        y?: number;
        inInterior?: boolean;
        buildingX?: number;
        buildingY?: number;
        fuelWood?: number;
        activeUntil?: number;
        objectType?: string;
      }) => {
        if (msg.x == null || msg.y == null) return;
        this.applyFireplaceStateChanged({
          x: msg.x,
          y: msg.y,
          inInterior: msg.inInterior === true,
          buildingX: msg.buildingX ?? 0,
          buildingY: msg.buildingY ?? 0,
          fuelWood: Number(msg.fuelWood ?? 0) || 0,
          activeUntil: Number(msg.activeUntil ?? 0) || 0,
          objectType: typeof msg.objectType === "string" ? msg.objectType : undefined,
        });
      },
    );

    room.onMessage(
      "chimneySmokeSync",
      (msg: {
        fires?: { buildingX?: number; buildingY?: number; activeUntil?: number }[];
      }) => {
        const fires: {
          buildingX: number;
          buildingY: number;
          activeUntil: number;
        }[] = [];
        for (const fire of msg.fires ?? []) {
          if (fire.buildingX == null || fire.buildingY == null) continue;
          fires.push({
            buildingX: fire.buildingX,
            buildingY: fire.buildingY,
            activeUntil: Number(fire.activeUntil ?? 0) || 0,
          });
        }
        this.chimneySmoke?.sync(fires);
      },
    );

    room.onMessage(
      "treesSync",
      (msg: { trees?: { x: number; y: number }[] }) => {
        if (!msg.trees) return;
        syncFelledTrees(msg.trees);
        for (const t of msg.trees) {
          this.tileManager?.applyTreeFelled(t.x, t.y, false);
        }
      },
    );

    room.onMessage(
      "treeFalling",
      (msg: { x?: number; y?: number }) => {
        if (msg.x == null || msg.y == null) return;
        AudioManager.get().playTreeChop(msg.x, msg.y);
        this.tileManager?.prepareTreeFall(msg.x, msg.y);
      },
    );

    room.onMessage("treeFallCancelled", (msg: { x?: number; y?: number }) => {
      if (msg.x == null || msg.y == null) return;
      if (isTreeFelled(msg.x, msg.y)) return;
      AudioManager.get().stopTreeChop(msg.x, msg.y);
      AudioManager.get().stopTreeFall(msg.x, msg.y);
    });

    room.onMessage("treeFelled", (msg: { x?: number; y?: number }) => {
      if (msg.x == null || msg.y == null) return;
      if (
        this.treeChopTargetTile &&
        this.treeChopTargetTile.x === msg.x &&
        this.treeChopTargetTile.y === msg.y
      ) {
        this.clearTreeChopTarget();
      }
      AudioManager.get().stopTreeChop(msg.x, msg.y);
      AudioManager.get().playTreeFall(msg.x, msg.y);
      this.tileManager?.applyTreeFelled(msg.x, msg.y, true);
    });

    room.onMessage("worldSfx", (msg: WorldSfxPayload) => {
      this.applyWorldSfx(msg);
    });

    room.onMessage(
      "worldSfxStop",
      (msg: { id?: string; kind?: WorldSfxStopKind }) => {
        if (!msg.id || !msg.kind) return;
        this.applyWorldSfxStop(msg.id, msg.kind);
      },
    );
  }

  private bindRoom(room: WorldRoom) {
    const $ = getStateCallbacks(room);
    if (!$) throw new Error("Colyseus state callbacks unavailable");

    const state$ = $(room.state) as unknown as {
      players: {
        onAdd: (cb: (player: PlayerSchema, id: string) => void) => void;
        onRemove: (cb: (player: PlayerSchema, id: string) => void) => void;
      };
      zombies: {
        onAdd: (cb: (zombie: ZombieSchema, id: string) => void) => void;
        onRemove: (cb: (zombie: ZombieSchema, id: string) => void) => void;
      };
      guards: {
        onAdd: (cb: (guard: GuardSchema, id: string) => void) => void;
        onRemove: (cb: (guard: GuardSchema, id: string) => void) => void;
      };
      coywolves?: {
        onAdd: (cb: (wolf: ZombieSchema, id: string) => void) => void;
        onRemove: (cb: (wolf: ZombieSchema, id: string) => void) => void;
      };
      bears?: {
        onAdd: (cb: (bear: ZombieSchema, id: string) => void) => void;
        onRemove: (cb: (bear: ZombieSchema, id: string) => void) => void;
      };
      crows?: {
        onAdd: (
          cb: (
            crow: {
              x: number;
              y: number;
              facing: number;
              anim: string;
              animFrame: number;
              health: number;
              isDead?: boolean;
              looted?: boolean;
              altitude?: number;
            },
            id: string,
          ) => void,
        ) => void;
        onRemove: (cb: (crow: unknown, id: string) => void) => void;
      };
      corpses: {
        onAdd: (cb: (corpse: PlayerCorpseSchema, id: string) => void) => void;
        onRemove: (cb: (corpse: PlayerCorpseSchema, id: string) => void) => void;
      };
      searchables: {
        onAdd: (cb: (item: SearchableSchema, id: string) => void) => void;
        onRemove: (cb: (item: SearchableSchema, id: string) => void) => void;
      };
    };

    const copyPlayer = (data: PlayerSchema) => ({
      x: data.x,
      y: data.y,
      facing: data.facing,
      anim: data.anim,
      animFrame: data.animFrame,
      health: data.health,
      alive: data.alive,
      name: data.name,
      idleWeapon: data.idleWeapon,
      inInterior: data.inInterior,
      buildingX: data.buildingX,
      buildingY: data.buildingY,
      equippedWeaponIndex: data.equippedWeaponIndex,
      equippedInventorySlot: data.equippedInventorySlot,
      equippedClothingSlot: data.equippedClothingSlot,
      clothingSkin: data.clothingSkin ?? 1,
      magazineRounds: data.magazineRounds,
      isReloading: data.isReloading,
      searchTargetId: data.searchTargetId,
      searchEndTime: data.searchEndTime,
      lastFireTime: data.lastFireTime,
      lastShotSfx: data.lastShotSfx ?? 0,
      fightingStanceUntil: data.fightingStanceUntil,
    });

    const copyZombie = (data: ZombieSchema) => this.copyZombieSnapshot(data);

    const refreshPlayer = (id: string, data: PlayerSchema) => {
      const sprite = this.ensureEntity(this.playerSprites, id, "player");
      const prev = sprite.getData("server") as
        | ReturnType<typeof copyPlayer>
        | undefined;
      if (prev && typeof prev.health === "number" && data.health < prev.health) {
        // Starvation/dehydration — red flash only, no blood spray.
        const starving =
          id === this.sessionId &&
          (data.hunger <= 0 || data.thirst <= 0);
        if (!starving && !this.recentGunHits.has(id)) {
          this.spawnBlood(data.x, data.y);
        }
      }
      if (!data.alive) {
        if (!prev) {
          this.freezeEntityDieAnim(id);
          if (id === this.sessionId) this.showDeathScreen();
        } else if (prev.alive !== false) {
          this.cancelEntityFireAnim(id);
          this.startEntityDieAnim(id);
          if (id === this.sessionId) this.showDeathScreen();
        }
      } else if (prev?.alive === false) {
        this.clearEntityDieAnim(id);
        if (id === this.sessionId) this.deathScreenUI?.close();
      }
      if (prev && data.lastFireTime > (prev.lastFireTime ?? 0)) {
        const weapon = WEAPONS[data.equippedWeaponIndex];
        const melee = !!weapon && isMeleeWeapon(weapon);
        // Hit audio is a separate worldSfx, sent only when the swing connects.
        // lastFireTime still drives the Hit* clip, including whiffs and chops.
        if (id !== this.sessionId) {
          this.startEntityFireAnim(
            id,
            data.equippedWeaponIndex,
            false,
            data.fightingStanceUntil,
            "player",
          );
        } else if (melee) {
          // Server-driven melee (tree chop, etc.) never goes through sendFire —
          // restart Hit* on each lastFireTime bump so swings actually play.
          this.startEntityFireAnim(
            id,
            data.equippedWeaponIndex,
            false,
            0,
            "player",
          );
        } else {
          const fire = this.fireAnims.get(id);
          if (fire) {
            fire.stanceUntilMs = data.fightingStanceUntil;
          }
        }
      }
      if (
        id === this.sessionId &&
        (data.anim === "walk" || data.anim === "run") &&
        !this.isEntityFiring(id)
      ) {
        this.cancelEntityFireAnim(id);
      }
      if ((prev?.fightingStanceUntil ?? 0) > 0 && data.fightingStanceUntil === 0) {
        this.cancelEntityFireAnim(id);
      }
      if (
        id === this.sessionId &&
        (prev?.equippedWeaponIndex ?? -1) >= 0 &&
        (data.equippedWeaponIndex ?? -1) < 0
      ) {
        this.cancelEntityFireAnim(id);
        sprite.setData("visualKey", "");
      }
      const next = copyPlayer(data);
      this.applyPlayerServerSnapshot(sprite, prev, next);
      sprite.setData("server", next);
      // Paint immediately on spawn/schema — don't wait for the next movement patch.
      this.updateEntityFromState(sprite, "player", id);
      if (id === this.sessionId) this.refreshQuestPanels();
    };

    const refreshCorpse = (id: string, data: PlayerCorpseSchema) => {
      this.applyCorpseServerData(id, data);
    };

    const refreshZombie = (id: string) => {
      this.pendingZombieRefreshIds.add(id);
    };

    const refreshGuard = (id: string, data: GuardSchema) => {
      this.applyGuardServerData(id, data);
    };

    const refreshSearchables = () => {
      const map = room.state?.searchables as unknown as
        | Map<string, SearchableSchema>
        | undefined;
      this.searchablesCache = map ? [...map.values()] : [];
      this.syncGroundBackpackSprites();
    };

    state$.players.onAdd((player, id) => {
      refreshPlayer(id, player);
      $(player).onChange(() => refreshPlayer(id, player));
      // Local player just appeared — draw tiles immediately (don't wait for
      // the next movement-driven sync).
      if (id === this.sessionId) this.syncWorldTiles();
    });
    state$.players.onRemove((_p, id) => this.removeEntity(this.playerSprites, id));

    state$.corpses.onAdd((corpse, id) => {
      refreshCorpse(id, corpse);
      $(corpse).onChange(() => refreshCorpse(id, corpse));
    });
    state$.corpses.onRemove((_c, id) => this.removeEntity(this.corpseSprites, id));

    state$.zombies.onAdd((zombie, id) => {
      refreshZombie(id);
      $(zombie).onChange(() => refreshZombie(id));
    });
    state$.zombies.onRemove((_z, id) => this.removeEntity(this.zombieSprites, id));

    state$.guards.onAdd((guard, id) => {
      refreshGuard(id, guard);
      $(guard).onChange(() => refreshGuard(id, guard));
    });
    state$.guards.onRemove((_g, id) => this.removeEntity(this.guardSprites, id));

    state$.coywolves?.onAdd((wolf, id) => {
      this.refreshCoywolf(id, wolf);
      $(wolf).onChange(() => this.refreshCoywolf(id, wolf));
    });
    state$.coywolves?.onRemove((_w, id) => this.removeEntity(this.coywolfSprites, id));

    state$.bears?.onAdd((bear, id) => {
      this.refreshBear(id, bear);
      $(bear).onChange(() => this.refreshBear(id, bear));
    });
    state$.bears?.onRemove((_b, id) => this.removeEntity(this.bearSprites, id));

    state$.crows?.onAdd((crow, id) => {
      this.refreshCrow(id, crow);
      $(crow).onChange(() => this.refreshCrow(id, crow));
    });
    state$.crows?.onRemove((_c, id) => this.removeEntity(this.crowSprites, id));

    if (state$.searchables) {
      state$.searchables.onAdd((item, id) => {
        refreshSearchables();
        $(item).onChange(refreshSearchables);
        void id;
      });
      state$.searchables.onRemove(() => refreshSearchables());
    }

    room.onStateChange(() => refreshSearchables());
    refreshSearchables();

    // Draw the overworld as soon as we have a local player (onAdd may have
    // already run above; this covers the already-present case too).
    this.syncWorldTiles();

    room.onLeave((code, reason) => {
      this.setStatus("Disconnected");
      if (this.intentionalLeave) return;
      if (this.tryStayInCombat(room, code, reason)) return;
      this.leaveWorldToMenu(code, reason);
    });
  }

  /**
   * Connection dropped during the combat lock. Stay on this scene and rejoin
   * the same body instead of returning to the menu.
   */
  private tryStayInCombat(room: WorldRoom, code: number, reason?: string): boolean {
    if (code === 4001 || code === 4002 || code === 4003) return false;
    if (this.combatLockUntil <= Date.now()) return false;
    const client = this.colyseusClient;
    const token = room.reconnectionToken;
    if (!client || !token || this.combatReconnectAttempts >= 2) return false;
    this.combatReconnectAttempts += 1;
    const playerId = this.sessionId;
    showWorldEntering("Still in combat…");
    void this.rejoinCombat(client, token, playerId, code, reason);
    return true;
  }

  private async rejoinCombat(
    client: Client,
    token: string,
    playerId: string,
    code: number,
    reason?: string,
  ) {
    try {
      const newRoom = (await client.reconnect(token)) as WorldRoom;
      if (!this.sys.isActive()) {
        try {
          newRoom.leave();
        } catch {
          /* page already gone */
        }
        return;
      }
      this.registry.set("worldRoom", newRoom);
      this.registry.set("colyseusClient", client);
      if (playerId.startsWith("player-")) this.registry.set("playerId", playerId);
      this.registry.set("combatRejoin", true);
      this.intentionalLeave = true;
      this.room = undefined;
      this.scene.restart();
    } catch {
      this.leaveWorldToMenu(code, reason);
    }
  }

  /** Back to Enter world. Auth session stays so this is not a wallet logout. */
  private leaveWorldToMenu(code: number, reason?: string) {
    if (this.intentionalLeave) return;
    this.intentionalLeave = true;
    this.worldJoinGeneration++;
    this.worldRevealReady = false;
    resetEntityAssetLoader(this);
    this.clearEntitySpriteMaps();
    const kickReason = typeof reason === "string" ? reason.trim() : "";
    const detail =
      code === 4001
        ? "Signed in from another session"
        : code === 4002
          ? kickReason
            ? `You have been kicked from the server: ${kickReason}`
            : "You have been kicked from the server"
          : code === 4003
            ? "You are banned from the server"
            : "Lost connection with the server";
    this.registry.set("menuError", detail);
    document.body.classList.remove("game-ready");
    hideWorldEntering();
    this.room = undefined;
    this.scene.start("MainMenuScene");
  }

  private applyCombatLock(until: unknown) {
    const next = typeof until === "number" && Number.isFinite(until) ? until : 0;
    this.combatLockUntil = next > Date.now() ? next : 0;
    if (this.combatLockUntil > 0) {
      this.combatReconnectAttempts = 0;
      this.notifyTip("combat_log");
    }
    this.combatLockShownSec = -1;
    this.refreshCombatLockBanner();
  }

  private combatLockBanner(): HTMLElement | null {
    return document.getElementById("combat-lock-banner");
  }

  private refreshCombatLockBanner() {
    const leftMs = this.combatLockUntil - Date.now();
    let banner = this.combatLockBanner();
    if (leftMs <= 0) {
      banner?.remove();
      this.combatLockShownSec = -1;
      return;
    }
    const secs = Math.max(1, Math.ceil(leftMs / 1000));
    if (secs === this.combatLockShownSec && banner) return;
    this.combatLockShownSec = secs;
    if (!banner) {
      banner = document.createElement("div");
      banner.id = "combat-lock-banner";
      document.body.appendChild(banner);
    }
    banner.textContent = `In combat. You can't leave for ${secs}s.`;
  }

  private entityVisible(
    kind: "player" | "zombie" | "guard" | "corpse" | "coywolf" | "bear" | "crow",
    data: {
      x?: number;
      y?: number;
      alive?: boolean;
      inInterior?: boolean;
      buildingX?: number;
      buildingY?: number;
    },
    entityId: string,
  ) {
    const me = this.room?.state?.players?.get(this.sessionId);
    if (!me) return true;
    if (kind === "player" && data.alive === false) return false;

    if (!me.inInterior) {
      if (data.inInterior) return false;

      // The local player is always shown.
      if (entityId === this.sessionId) return true;

      // All overworld entities are only rendered inside the current draw view.
      if (data.x != null && data.y != null) {
        const tx = Math.floor(data.x);
        const ty = Math.floor(data.y);
        if (this.tileManager?.hasActiveRenderView()) {
          return this.tileManager.isInRenderView(tx, ty);
        }
        const dx = Math.abs(tx - Math.floor(me.x));
        const dy = Math.abs(ty - Math.floor(me.y));
        return dx <= RENDER_RADIUS && dy <= RENDER_RADIUS;
      }
      return true;
    }

    if (kind === "player" && entityId === this.sessionId) return true;
    if (kind === "zombie" || kind === "guard") {
      if ((me.interiorLevel ?? 0) !== 0) return false;
    }
    if (kind === "player") {
      const other = this.room?.state?.players?.get(entityId);
      if ((other?.interiorLevel ?? 0) !== (me.interiorLevel ?? 0)) return false;
    }
    if (kind === "corpse") {
      const corpse = this.room?.state?.corpses?.get(entityId);
      if ((corpse?.interiorLevel ?? 0) !== (me.interiorLevel ?? 0)) return false;
    }
    return (
      !!data.inInterior &&
      data.buildingX === me.buildingX &&
      data.buildingY === me.buildingY
    );
  }

  private isZombieOnDrawnTile(sprite: EntitySprite): boolean {
    const data = sprite.getData("server") as { x?: number; y?: number } | undefined;
    if (!data || data.x == null || data.y == null || !this.tileManager) return true;
    return this.tileManager.isTileDrawn(Math.floor(data.x), Math.floor(data.y));
  }

  private copyZombieSnapshot(data: ZombieSchema): ZombieServerSnapshot {
    const extended = data as ZombieSchema & {
      investigating?: boolean;
      investigateX?: number;
      investigateY?: number;
    };
    return {
      x: data.x,
      y: data.y,
      facing: data.facing,
      anim: data.anim,
      animFrame: data.animFrame,
      health: data.health,
      skin: data.skin,
      isDead: data.isDead,
      looted: data.looted,
      inInterior: data.inInterior,
      buildingX: data.buildingX,
      buildingY: data.buildingY,
      investigating: extended.investigating,
      investigateX: extended.investigateX,
      investigateY: extended.investigateY,
      targetX: data.targetX,
      targetY: data.targetY,
    };
  }

  private refreshCoywolf(
    id: string,
    data: { x: number; y: number; facing: number; anim: string; animFrame: number; health: number; isDead?: boolean; looted?: boolean },
  ) {
    if (!this.entityVisible("coywolf", data, id)) {
      const existing = this.coywolfSprites.get(id);
      if (existing) {
        existing.setData("server", {
          ...data,
          isDead: !!data.isDead,
          looted: !!data.looted,
        });
        this.softHideEntitySprite(existing);
      }
      return;
    }

    const sprite = this.ensureEntity(this.coywolfSprites, id, "coywolf");
    const prev = sprite.getData("server") as { isDead?: boolean; x?: number; y?: number; anim?: string } | undefined;
    const next = {
      x: data.x,
      y: data.y,
      facing: data.facing,
      anim: data.anim,
      animFrame: data.animFrame,
      health: data.health,
      isDead: !!data.isDead,
      looted: !!data.looted,
      alive: !data.isDead,
    };
    if (!prev && next.isDead) {
      this.freezeEntityDieAnim(id);
    } else if (prev && !prev.isDead && next.isDead) {
      this.startEntityDieAnim(id);
      sprite.setData("visualKey", "");
      sprite.setData("velX", 0);
      sprite.setData("velY", 0);
    }
    this.applyCoywolfMotion(sprite, prev, next);
    sprite.setData("server", next);
    this.updateEntityFromState(sprite, "coywolf", id);
  }

  private refreshBear(
    id: string,
    data: { x: number; y: number; facing: number; anim: string; animFrame: number; health: number; isDead?: boolean; looted?: boolean },
  ) {
    if (!this.entityVisible("bear", data, id)) {
      const existing = this.bearSprites.get(id);
      if (existing) {
        existing.setData("server", {
          ...data,
          isDead: !!data.isDead,
          looted: !!data.looted,
        });
        this.softHideEntitySprite(existing);
      }
      return;
    }

    const sprite = this.ensureEntity(this.bearSprites, id, "bear");
    const prev = sprite.getData("server") as { isDead?: boolean; x?: number; y?: number; anim?: string } | undefined;
    const next = {
      x: data.x,
      y: data.y,
      facing: data.facing,
      anim: data.anim,
      animFrame: data.animFrame,
      health: data.health,
      isDead: !!data.isDead,
      looted: !!data.looted,
      alive: !data.isDead,
    };
    if (!prev && next.isDead) {
      this.freezeEntityDieAnim(id);
    } else if (prev && !prev.isDead && next.isDead) {
      this.startEntityDieAnim(id);
      sprite.setData("visualKey", "");
      sprite.setData("velX", 0);
      sprite.setData("velY", 0);
    }
    this.applyCoywolfMotion(sprite, prev, next);
    sprite.setData("server", next);
    this.updateEntityFromState(sprite, "bear", id);
  }

  private refreshCrow(
    id: string,
    data: {
      x: number;
      y: number;
      facing: number;
      anim: string;
      animFrame: number;
      health: number;
      isDead?: boolean;
      looted?: boolean;
      altitude?: number;
    },
  ) {
    if (!this.entityVisible("crow", data, id)) {
      const existing = this.crowSprites.get(id);
      if (existing) {
        existing.setData("server", {
          ...data,
          isDead: !!data.isDead,
          looted: !!data.looted,
          altitude: data.altitude ?? 0,
        });
        this.softHideEntitySprite(existing);
      }
      return;
    }

    const sprite = this.ensureEntity(this.crowSprites, id, "crow");
    const prev = sprite.getData("server") as {
      isDead?: boolean;
      x?: number;
      y?: number;
      anim?: string;
      health?: number;
    } | undefined;
    if (
      prev &&
      typeof prev.health === "number" &&
      data.health < prev.health &&
      !this.recentGunHits.has(id)
    ) {
      this.spawnCrowHitBlood(data.x, data.y, data.altitude ?? 0);
    }
    const next = {
      x: data.x,
      y: data.y,
      facing: data.facing,
      anim: data.anim,
      animFrame: data.animFrame,
      health: data.health,
      isDead: !!data.isDead,
      looted: !!data.looted,
      altitude: data.altitude ?? 0,
      alive: !data.isDead,
    };
    if (!prev && next.isDead) {
      this.freezeEntityDieAnim(id);
    } else if (prev && !prev.isDead && next.isDead) {
      this.startEntityDieAnim(id);
      sprite.setData("visualKey", "");
      sprite.setData("velX", 0);
      sprite.setData("velY", 0);
    }
    this.applyCoywolfMotion(sprite, prev, next);
    sprite.setData("server", next);
    this.updateEntityFromState(sprite, "crow", id);
  }

  private applyCoywolfMotion(
    sprite: EntitySprite,
    prev: { x?: number; y?: number; anim?: string; isDead?: boolean } | undefined,
    next: { x: number; y: number; anim: string; isDead: boolean },
  ) {
    const minTickSec = TICK_MS / 1000;
    const stopped = next.anim === "idle" || next.isDead;
    if (!prev || prev.x == null || prev.y == null) {
      sprite.setData("renderX", next.x);
      sprite.setData("renderY", next.y);
      sprite.setData("snapX", next.x);
      sprite.setData("snapY", next.y);
      sprite.setData("snapAt", performance.now());
      sprite.setData("velX", 0);
      sprite.setData("velY", 0);
      return;
    }
    if (prev.x !== next.x || prev.y !== next.y) {
      const now = performance.now();
      const prevSnapAt = (sprite.getData("snapAt") as number | undefined) ?? now - TICK_MS;
      const deltaSec = Math.min(
        Math.max((now - prevSnapAt) / 1000, minTickSec),
        minTickSec * 4,
      );
      sprite.setData("velX", (next.x - prev.x) / deltaSec);
      sprite.setData("velY", (next.y - prev.y) / deltaSec);
      sprite.setData("snapX", next.x);
      sprite.setData("snapY", next.y);
      sprite.setData("snapAt", now);
      return;
    }
    if (stopped) {
      sprite.setData("velX", 0);
      sprite.setData("velY", 0);
      sprite.setData("snapX", next.x);
      sprite.setData("snapY", next.y);
      sprite.setData("snapAt", performance.now());
    }
  }

  /** Apply queued zombie schema updates (batched off the network thread). */
  private flushPendingZombieRefreshes() {
    if (this.pendingZombieRefreshIds.size === 0 || !this.room?.state?.zombies) return;

    const zombies = this.room.state.zombies;
    for (const id of this.pendingZombieRefreshIds) {
      const data = zombies.get(id) as ZombieSchema | undefined;
      if (!data) continue;

      const next = this.copyZombieSnapshot(data);
      if (!this.entityVisible("zombie", next, id)) {
        // Soft-hide when culled so zoom/pan can restore without a schema patch.
        const existing = this.zombieSprites.get(id);
        if (existing) {
          existing.setData("server", next);
          this.softHideEntitySprite(existing);
        }
        continue;
      }

      const sprite = this.ensureEntity(this.zombieSprites, id, "zombie");
      const prev = sprite.getData("server") as ZombieServerSnapshot | undefined;

      if (this.isRedundantGunshotInvestigationPatch(prev, next)) {
        sprite.setData("server", next);
        continue;
      }

      const dead = this.isZombieDead(next);
      const wasDead = prev ? this.isZombieDead(prev) : false;

      if (!prev && dead) {
        this.freezeEntityDieAnim(id);
      } else if (!wasDead && dead) {
        this.startEntityDieAnim(id);
        sprite.setData("visualKey", "");
        sprite.setData("velX", 0);
        sprite.setData("velY", 0);
        sprite.setData("moveSpeed", 0);
      }

      this.applyZombieServerSnapshot(sprite, prev, next);

      const localAnimFrame = sprite.getData("localAnimFrame") as number | undefined;
      if (
        localAnimFrame === undefined ||
        Math.abs(localAnimFrame - next.animFrame) > 2
      ) {
        sprite.setData("localAnimFrame", next.animFrame);
      }

      sprite.setData("server", next);
      // Paint immediately on spawn/schema — idle zombies used to keep the
      // placeholder/fallback frame until a movement patch changed visualKey.
      this.updateEntityFromState(sprite, "zombie", id);
    }
    this.pendingZombieRefreshIds.clear();
  }

  /** Client-side walk velocity toward a target (used when server patches anim without position). */
  private seedZombieWalkVelocity(
    sprite: EntitySprite,
    x: number,
    y: number,
    targetX: number,
    targetY: number,
    skin?: number,
  ) {
    const dx = targetX - x;
    const dy = targetY - y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.05) return;
    const speed = zombieSpeedAtTime(
      zombieBaseSpeed(isZombieCrawler(sprite.entityId, skin)),
      this.room?.state?.worldTimeMs ?? 0,
    );
    sprite.setData("velX", (dx / dist) * speed);
    sprite.setData("velY", (dy / dist) * speed);
    sprite.setData("moveSpeed", speed);
  }

  private zombieWalkTarget(next: ZombieServerSnapshot): { x: number; y: number } {
    if (next.investigating) {
      return { x: next.investigateX ?? next.x, y: next.investigateY ?? next.y };
    }
    return { x: next.targetX ?? next.x, y: next.targetY ?? next.y };
  }

  /** No-op patch — zombie already investigating this gunshot area, position unchanged. */
  private isRedundantGunshotInvestigationPatch(
    prev: ZombieServerSnapshot | undefined,
    next: ZombieServerSnapshot,
  ): boolean {
    if (!prev || prev.x !== next.x || prev.y !== next.y) return false;
    // Never skip death patches — client must run die-anim bookkeeping.
    if (this.isZombieDead(next) || this.isZombieDead(prev)) return false;
    if (!prev.investigating || !next.investigating) return false;
    const prevIx = prev.investigateX ?? prev.x;
    const prevIy = prev.investigateY ?? prev.y;
    const nextIx = next.investigateX ?? next.x;
    const nextIy = next.investigateY ?? next.y;
    return (
      Math.hypot(prevIx - nextIx, prevIy - nextIy) <= GUNSHOT_SAME_INVESTIGATION_RADIUS
    );
  }

  /** Track server velocity so zombies keep gliding between network ticks. */
  private applyZombieServerSnapshot(
    sprite: EntitySprite,
    prev: ZombieServerSnapshot | undefined,
    next: ZombieServerSnapshot,
  ) {
    const minTickSec = TICK_MS / 1000;
    let deltaSec = minTickSec;
    const stopped = next.anim === "idle" || this.isZombieDead(next);

    if (!prev) {
      sprite.setData("renderX", next.x);
      sprite.setData("renderY", next.y);
      sprite.setData("snapX", next.x);
      sprite.setData("snapY", next.y);
      sprite.setData("snapAt", performance.now());
      sprite.setData("velX", 0);
      sprite.setData("velY", 0);
    } else if (prev.x !== next.x || prev.y !== next.y) {
      const now = performance.now();
      const prevSnapAt = (sprite.getData("snapAt") as number | undefined) ?? now - TICK_MS;
      deltaSec = Math.min(
        Math.max((now - prevSnapAt) / 1000, minTickSec),
        minTickSec * 4,
      );
      const dx = next.x - prev.x;
      const dy = next.y - prev.y;
      sprite.setData("velX", dx / deltaSec);
      sprite.setData("velY", dy / deltaSec);
      sprite.setData("snapX", next.x);
      sprite.setData("snapY", next.y);
      sprite.setData("snapAt", now);
    } else if (stopped) {
      sprite.setData("velX", 0);
      sprite.setData("velY", 0);
      sprite.setData("snapX", next.x);
      sprite.setData("snapY", next.y);
      sprite.setData("snapAt", performance.now());
    }
    // Position unchanged and still moving — keep velX/velY/snapAt for extrapolation.

    if (prev && !prev.investigating && next.investigating) {
      AudioManager.get().playZombieAggro({
        x: next.x,
        y: next.y,
        noiseRadius: ZOMBIE_GROAN_HEAR_RADIUS,
        inInterior: next.inInterior,
        buildingX: next.buildingX,
        buildingY: next.buildingY,
      });
      const target = this.zombieWalkTarget(next);
      this.seedZombieWalkVelocity(
        sprite,
        next.x,
        next.y,
        target.x,
        target.y,
        next.skin,
      );
    }

    if (next.anim === "walk" || next.anim === "attack") {
      if (prev && (prev.x !== next.x || prev.y !== next.y)) {
        sprite.setData(
          "moveSpeed",
          Math.hypot(next.x - prev.x, next.y - prev.y) / deltaSec,
        );
      } else if (stopped) {
        sprite.setData("moveSpeed", 0);
      }
      // Unchanged position while "walk": keep existing vel for extrapolation,
      // but do not seed full ZOMBIE_SPEED — that causes walk-in-place after
      // join hitches when schema position patches stall.
    } else {
      sprite.setData("moveSpeed", 0);
      if (next.anim === "idle") {
        sprite.setData("localAnimFrame", 0);
      }
    }
  }

  /** True when an overworld tile blocks zombie feet (player wall / closed door / fence). */
  private isOverworldStructureBlocking(tx: number, ty: number): boolean {
    if (worldChainlinkOccupiesTile(tx, ty)) return true;
    if (this.structureWallKeysOverworld.has(`${tx},${ty}`)) return true;
    if (this.tempOverworldWallKeys.has(`${tx},${ty}`)) return true;
    if (this.structureFenceOccupancyOverworld.has(`${tx},${ty}`)) return true;
    if (this.structureFenceCornersOverworld.has(`${tx},${ty}`)) return true;
    if (this.structureStorageBoxesOverworld.has(`${tx},${ty}`)) return true;
    const door = this.structureDoorsOverworld.get(`${tx},${ty}`);
    return !!door && !door.isOpen;
  }

  private localCanPassBarracksBargate(tx: number, ty: number): boolean {
    if (!birchportBarracksBargateOccupiesTile(tx, ty)) return false;
    const me = this.room?.state?.players?.get(this.sessionId);
    if (!me?.alive || me.inInterior) return false;
    const ptx = Math.floor(me.x);
    const pty = Math.floor(me.y);
    if (birchportBarracksBargateOccupiesTile(ptx, pty)) return true;
    if (this.barracksBargateAnimUntil <= Date.now()) return false;
    if (this.localMilitiaAllowsBarracksGate()) return true;
    return isInBirchportBarracksYard(ptx, pty);
  }

  /** Player-built overworld blockers (matches server movement — fireplaces are walkable). */
  private isOverworldMovementBlocked(tx: number, ty: number): boolean {
    if (this.localCanPassBarracksBargate(tx, ty)) return false;
    return this.isOverworldStructureBlocking(tx, ty);
  }

  /** Overworld click / WASD walkable probe: not a tree/building wall, not a player structure. */
  private overworldMoveWalkable(tx: number, ty: number): boolean {
    return !isWallTile(tx, ty) && !this.isOverworldMovementBlocked(tx, ty);
  }

  /**
   * Solid overworld chain-link mesh under a world point. Corners use 1×1
   * occupancy with panel-sized art, so iso picks often miss the post.
   */
  private pickOverworldSolidFenceBlockerAtWorld(
    worldX: number,
    worldY: number,
    clickTX: number,
    clickTY: number,
  ): { x: number; y: number } | null {
    const candidates: { image: Phaser.GameObjects.Image; x: number; y: number }[] =
      [];
    for (const [key, image] of this.overworldFenceCornerSprites) {
      const [xs, ys] = key.split(",");
      candidates.push({ image, x: Number(xs), y: Number(ys) });
    }
    for (const [key, image] of this.overworldFenceSprites) {
      const fence = this.structureFencesOverworld.get(key);
      const [xs, ys] = key.split(",");
      const ox = Number(xs);
      const oy = Number(ys);
      const tile = fence
        ? nearestManhattanTile(
            structureOccupiedTiles({
              kind: fence.kind ?? "fence",
              x: fence.x,
              y: fence.y,
              facing: fence.facing,
            }),
            clickTX,
            clickTY,
          )
        : { x: ox, y: oy };
      candidates.push({ image, x: tile.x, y: tile.y });
    }
    return pickTopOpaqueImageAtWorld(worldX, worldY, candidates);
  }

  /**
   * Keep client-extrapolated feet out of overworld blockers. Leftover walk
   * velocity toward a SE face can step the sprite onto a building / wall tile
   * between server snaps; depth then behind-clamps and the sprite paints under
   * the cuboid. Only neighbouring tiles overlap the wall, so that is where it
   * shows.
   */
  private clampRenderAwayFromOverworldStructures(x: number, y: number): {
    x: number;
    y: number;
  } {
    let cx = x;
    let cy = y;
    const tx = Math.floor(cx);
    const ty = Math.floor(cy);
    const blocked = (nx: number, ny: number) => !this.overworldMoveWalkable(nx, ny);
    if (blocked(tx, ty)) {
      // Prefer the side closest to the current point.
      const candidates = [
        { x: tx + 1.5, y: ty + 0.5 },
        { x: tx - 0.5, y: ty + 0.5 },
        { x: tx + 0.5, y: ty + 1.5 },
        { x: tx + 0.5, y: ty - 0.5 },
      ];
      let best = candidates[0]!;
      let bestDist = Infinity;
      for (const c of candidates) {
        if (blocked(Math.floor(c.x), Math.floor(c.y))) {
          continue;
        }
        const d = Math.hypot(c.x - cx, c.y - cy);
        if (d < bestDist) {
          bestDist = d;
          best = c;
        }
      }
      return best;
    }
    if (blocked(tx + 1, ty)) cx = Math.min(cx, tx + 0.5);
    if (blocked(tx - 1, ty)) cx = Math.max(cx, tx + 0.5);
    if (blocked(tx, ty + 1)) cy = Math.min(cy, ty + 0.5);
    if (blocked(tx, ty - 1)) cy = Math.max(cy, ty + 0.5);
    return { x: cx, y: cy };
  }

  private getZombieRenderPosition(
    sprite: EntitySprite,
    serverX: number,
    serverY: number,
  ): { x: number; y: number } {
    const snapX = (sprite.getData("snapX") as number | undefined) ?? serverX;
    const snapY = (sprite.getData("snapY") as number | undefined) ?? serverY;
    const velX = (sprite.getData("velX") as number | undefined) ?? 0;
    const velY = (sprite.getData("velY") as number | undefined) ?? 0;
    const snapAt = (sprite.getData("snapAt") as number | undefined) ?? performance.now();
    const tickSec = TICK_MS / 1000;
    const elapsed = Math.min((performance.now() - snapAt) / 1000, tickSec * 2);

    let x = snapX + velX * elapsed;
    let y = snapY + velY * elapsed;
    x += (serverX - x) * ZOMBIE_RENDER_LERP;
    y += (serverY - y) * ZOMBIE_RENDER_LERP;

    const data = sprite.getData("server") as
      | { inInterior?: boolean }
      | undefined;
    if (!data?.inInterior) {
      const clamped = this.clampRenderAwayFromOverworldStructures(x, y);
      x = clamped.x;
      y = clamped.y;
    }

    sprite.setData("renderX", x);
    sprite.setData("renderY", y);
    return { x, y };
  }

  /**
   * Track server velocity (for smooth remote-player rendering) and, for the
   * local player, reconcile the client-predicted position toward confirmed
   * server truth every tick. Large jumps (respawn, building enter/exit, admin
   * warp) are treated as hard teleports rather than smoothed/predicted.
   */
  private applyPlayerServerSnapshot(
    sprite: EntitySprite,
    prev:
      | {
          x: number;
          y: number;
          inInterior?: boolean;
          buildingX?: number;
          buildingY?: number;
          anim?: string;
          alive?: boolean;
        }
      | undefined,
    next: {
      x: number;
      y: number;
      inInterior?: boolean;
      buildingX?: number;
      buildingY?: number;
      anim?: string;
      alive?: boolean;
    },
  ) {
    const now = performance.now();

    const teleported =
      !prev ||
      prev.inInterior !== next.inInterior ||
      prev.buildingX !== next.buildingX ||
      prev.buildingY !== next.buildingY ||
      Math.hypot(next.x - prev.x, next.y - prev.y) >
        WorldScene.PLAYER_TELEPORT_DIST;

    if (teleported) {
      sprite.setData("snapX", next.x);
      sprite.setData("snapY", next.y);
      sprite.setData("snapAt", now);
      sprite.setData("velX", 0);
      sprite.setData("velY", 0);
      return;
    }

    if (prev.x !== next.x || prev.y !== next.y) {
      const minTickSec = TICK_MS / 1000;
      const prevSnapAt = (sprite.getData("snapAt") as number | undefined) ?? now - TICK_MS;
      const deltaSec = Math.min(
        Math.max((now - prevSnapAt) / 1000, minTickSec),
        minTickSec * 4,
      );
      sprite.setData("velX", (next.x - prev.x) / deltaSec);
      sprite.setData("velY", (next.y - prev.y) / deltaSec);
      sprite.setData("snapX", next.x);
      sprite.setData("snapY", next.y);
      sprite.setData("snapAt", now);
    } else if (next.anim === "idle" || next.alive === false) {
      sprite.setData("velX", 0);
      sprite.setData("velY", 0);
      sprite.setData("snapX", next.x);
      sprite.setData("snapY", next.y);
      sprite.setData("snapAt", now);
    }
  }

  /**
   * Render position for a player sprite: smooth tick-interpolation using the
   * server's own confirmed velocity (matches getZombieRenderPosition). This
   * is intentionally the ONLY rendering path for the local player too — it
   * never extrapolates further than the server's last confirmed motion, so
   * an "illegal" move (blocked by a wall/furniture) simply reports zero
   * velocity and the sprite never visibly enters the blocked tile.
   */
  private getPlayerRenderPosition(
    sprite: EntitySprite,
    serverX: number,
    serverY: number,
  ): { x: number; y: number } {
    const snapX = (sprite.getData("snapX") as number | undefined) ?? serverX;
    const snapY = (sprite.getData("snapY") as number | undefined) ?? serverY;
    const velX = (sprite.getData("velX") as number | undefined) ?? 0;
    const velY = (sprite.getData("velY") as number | undefined) ?? 0;
    const snapAt = (sprite.getData("snapAt") as number | undefined) ?? performance.now();
    const tickSec = TICK_MS / 1000;
    const elapsed = Math.min((performance.now() - snapAt) / 1000, tickSec * 2);

    let x = snapX + velX * elapsed;
    let y = snapY + velY * elapsed;
    x += (serverX - x) * WorldScene.PLAYER_RENDER_LERP;
    y += (serverY - y) * WorldScene.PLAYER_RENDER_LERP;

    const data = sprite.getData("server") as
      | { inInterior?: boolean }
      | undefined;
    if (!data?.inInterior) {
      const clamped = this.clampRenderAwayFromOverworldStructures(x, y);
      x = clamped.x;
      y = clamped.y;
    }

    sprite.setData("renderX", x);
    sprite.setData("renderY", y);
    return { x, y };
  }

  private isZombieDead(data: {
    isDead?: boolean;
    anim?: string;
    health?: number;
  }): boolean {
    return !!(data.isDead || data.anim === "dead" || (data.health ?? 1) <= 0);
  }

  /** Recreate / refresh a player sprite from room state (zoom restore path). */
  private applyPlayerServerData(id: string, data: PlayerSchema) {
    const visible = this.entityVisible(
      "player",
      {
        x: data.x,
        y: data.y,
        alive: data.alive,
        inInterior: data.inInterior,
        buildingX: data.buildingX,
        buildingY: data.buildingY,
      },
      id,
    );
    const next = {
      x: data.x,
      y: data.y,
      facing: data.facing,
      anim: data.anim,
      animFrame: data.animFrame,
      health: data.health,
      alive: data.alive,
      name: data.name,
      idleWeapon: data.idleWeapon,
      inInterior: data.inInterior,
      buildingX: data.buildingX,
      buildingY: data.buildingY,
      equippedWeaponIndex: data.equippedWeaponIndex,
      equippedInventorySlot: data.equippedInventorySlot,
      equippedClothingSlot: data.equippedClothingSlot,
      clothingSkin: data.clothingSkin ?? 1,
      magazineRounds: data.magazineRounds,
      isReloading: data.isReloading,
      searchTargetId: data.searchTargetId,
      searchEndTime: data.searchEndTime,
      lastFireTime: data.lastFireTime,
      lastShotSfx: data.lastShotSfx ?? 0,
      fightingStanceUntil: data.fightingStanceUntil,
    };
    if (!visible) {
      const existing = this.playerSprites.get(id);
      if (existing) {
        existing.setData("server", next);
        this.softHideEntitySprite(existing);
      }
      return;
    }

    const sprite = this.ensureEntity(this.playerSprites, id, "player");
    const prev = sprite.getData("server") as typeof next | undefined;
    if (!prev && !data.alive) {
      this.freezeEntityDieAnim(id);
    } else if (prev?.alive !== false && !data.alive) {
      this.cancelEntityFireAnim(id);
      this.startEntityDieAnim(id);
    }
    this.applyPlayerServerSnapshot(sprite, prev, next);
    sprite.setData("server", next);
    this.updateEntityFromState(sprite, "player", id);
  }

  private applyCorpseServerData(id: string, data: PlayerCorpseSchema) {
    const sprite = this.ensureEntity(this.corpseSprites, id, "player");
    if (!this.dieAnims.has(id)) {
      this.freezeEntityDieAnim(id);
    }
    sprite.setData("server", {
      x: data.x,
      y: data.y,
      facing: data.facing,
      anim: "dead",
      animFrame: 0,
      idleWeapon: data.idleWeapon,
      equippedWeaponIndex: data.equippedWeaponIndex,
      clothingSkin: data.clothingSkin ?? 1,
      inInterior: data.inInterior,
      buildingX: data.buildingX,
      buildingY: data.buildingY,
      alive: false,
      looted: !!data.looted,
    });
    this.updateEntityFromState(sprite, "corpse", id);
  }

  private applyGuardServerData(id: string, data: GuardSchema) {
    const visible = this.entityVisible(
      "guard",
      {
        x: data.x,
        y: data.y,
        alive: data.alive,
        inInterior: data.inInterior,
        buildingX: data.buildingX,
        buildingY: data.buildingY,
      },
      id,
    );
    if (!visible) {
      // Soft-hide when culled so zoom/pan can restore without a schema patch.
      // (Hard-destroy left living NPCs missing until the next position change —
      // idle traders can sit silent for minutes.)
      const existing = this.guardSprites.get(id);
      if (existing) {
        existing.setData("server", {
          x: data.x,
          y: data.y,
          facing: data.facing,
          anim: data.anim,
          animFrame: data.animFrame,
          health: data.health,
          skin: data.skin,
          npcKind: data.npcKind ?? 0,
          alive: data.alive,
          isDead: !data.alive,
          looted: data.looted,
          inInterior: data.inInterior,
          buildingX: data.buildingX,
          buildingY: data.buildingY,
          lastFireTime: data.lastFireTime,
          lastShotSfx: data.lastShotSfx ?? 0,
          fightingStanceUntil: data.fightingStanceUntil,
          magazineRounds: data.magazineRounds,
          reloadEndTime: data.reloadEndTime,
        });
        this.softHideEntitySprite(existing);
      }
      return;
    }

    const sprite = this.ensureEntity(this.guardSprites, id, "guard");
    const prev = sprite.getData("server") as {
      health?: number;
      lastFireTime?: number;
      fightingStanceUntil?: number;
      alive?: boolean;
      anim?: string;
      reloadEndTime?: number;
    } | undefined;
    if (prev && typeof prev.health === "number" && data.health < prev.health) {
      if (!this.recentGunHits.has(id)) {
        this.spawnBlood(data.x, data.y);
      }
    }
    if (!data.alive) {
      if (!prev) {
        this.freezeEntityDieAnim(id);
        this.doctorIdleVariants.delete(id);
      } else if (prev.alive !== false) {
        this.cancelEntityFireAnim(id);
        this.startEntityDieAnim(id);
        this.doctorIdleVariants.delete(id);
        sprite.setData("visualKey", "");
        AudioManager.get().stopReload(`guard:${id}`);
      }
    }
    const guardWeaponIndex =
      data.npcKind === GUARD_NPC_TRADER_GUARD
        ? TRADER_WEAPON_INDEX
        : data.npcKind === GUARD_NPC_RED_MAN
          ? redManWeaponIndex(data.skin ?? 1)
          : GUARD_WEAPON_INDEX;
    if (prev && data.lastFireTime > (prev.lastFireTime ?? 0)) {
      const fromStance = (prev.fightingStanceUntil ?? 0) > Date.now();
      this.startEntityFireAnim(
        id,
        guardWeaponIndex,
        fromStance,
        data.fightingStanceUntil,
        "npc",
      );
    }
    const prevReload = prev?.reloadEndTime ?? 0;
    const nextReload = data.reloadEndTime ?? 0;
    const nowMs = Date.now();
    if (prev && nextReload > prevReload && nextReload > nowMs) {
      const weapon = WEAPONS[guardWeaponIndex];
      if (weapon) {
        AudioManager.get().playReload(weapon.itemId, {
          id: `guard:${id}`,
          source: {
            x: data.x,
            y: data.y,
            noiseRadius: ACTION_SFX_HEAR_RADIUS,
            inInterior: data.inInterior,
            buildingX: data.buildingX,
            buildingY: data.buildingY,
          },
        });
      }
    } else if (prev && prevReload > 0 && nextReload <= 0) {
      AudioManager.get().stopReload(`guard:${id}`);
    }
    if (
      prev &&
      (prev.fightingStanceUntil ?? 0) > Date.now() &&
      (data.fightingStanceUntil ?? 0) <= Date.now() &&
      (data.anim === "walk" || data.anim === "idle")
    ) {
      this.cancelEntityFireAnim(id);
      sprite.setData("visualKey", "");
    }
    sprite.setData("server", {
      x: data.x,
      y: data.y,
      facing: data.facing,
      anim: data.anim,
      animFrame: data.animFrame,
      health: data.health,
      skin: data.skin,
      npcKind: data.npcKind ?? 0,
      alive: data.alive,
      isDead: !data.alive,
      looted: data.looted,
      inInterior: data.inInterior,
      buildingX: data.buildingX,
      buildingY: data.buildingY,
      lastFireTime: data.lastFireTime,
      lastShotSfx: data.lastShotSfx ?? 0,
      fightingStanceUntil: data.fightingStanceUntil,
      magazineRounds: data.magazineRounds,
      reloadEndTime: data.reloadEndTime,
    });
    this.updateEntityFromState(sprite, "guard", id);
  }

  /**
   * Soft-cull without destroying the GO. Clear visualKey so a later pack
   * unload/reload cannot reuse a cached key and leave the sprite on a dead
   * glTexture (that aborts the whole WebGL frame: buildings + NPCs vanish).
   */
  private softHideEntitySprite(sprite: EntitySprite) {
    sprite.setData("visualKey", "");
    const key = sprite.texture?.key;
    if (
      !key ||
      key === "__MISSING" ||
      !this.textures.exists(key)
    ) {
      sprite.setTexture("__DEFAULT");
    }
    sprite.setVisible(false);
  }

  private entitySpriteTextureBroken(sprite: EntitySprite): boolean {
    const key = sprite.texture?.key;
    if (!key || key === "__DEFAULT") return false;
    // Phaser's missing placeholder (black + green border) — force a rebind.
    if (key === "__MISSING") return true;
    if (!this.textures.exists(key)) return true;
    const source = sprite.frame?.source as { glTexture?: unknown } | undefined;
    if (
      this.game.renderer.type === Phaser.WEBGL &&
      source &&
      source.glTexture == null
    ) {
      return true;
    }
    return false;
  }

  private ensureEntity(
    map: Map<string, EntitySprite>,
    id: string,
    kind: "player" | "zombie" | "guard" | "coywolf" | "bear" | "crow",
  ) {
    let sprite = map.get(id);
    // Stale entries after kick/reconnect: GameObject destroyed, scene unset.
    if (sprite && !sprite.scene) {
      map.delete(id);
      sprite = undefined;
    }
    if (!sprite) {
      const coywolfKey = coywolfIdleKey("S");
      const bearKey = bearIdleKey("S");
      const placeholder =
        kind === "player"
          ? playerManIdleKey("S")
          : kind === "guard"
            ? guardIdleAKKey("S")
            : kind === "coywolf" && this.textures.exists(coywolfKey)
              ? coywolfKey
              : kind === "coywolf"
                ? "__DEFAULT"
                : kind === "bear" && this.textures.exists(bearKey)
                  ? bearKey
                  : kind === "bear"
                    ? "__DEFAULT"
                : kind === "crow" && this.textures.exists(crowIdleKey("S"))
                  ? crowIdleKey("S")
                  : kind === "crow"
                    ? "__DEFAULT"
                : zombieIdleKey("S");
      sprite = this.add.sprite(0, 0, placeholder, 0) as EntitySprite;
      sprite.entityId = id;
      if (placeholder !== "__DEFAULT") applyIdleFrame(sprite, placeholder);
      // Force the first updateEntityFromState to apply facing/anim/skin.
      sprite.setData("visualKey", "");
      map.set(id, sprite);
    }
    return sprite;
  }

  private removeEntity(map: Map<string, EntitySprite>, id: string) {
    const image = map.get(id);
    if (!image) return;
    this.clearEntityDieAnim(id);
    this.entityActionLabels?.clearEntity(id);
    image.destroy();
    map.delete(id);
  }

  private refreshAllVisuals(delta = 0) {
    this.tickZombieWalkAnims(delta / 1000);
    this.tickCoywolfWalkAnims(delta / 1000);
    this.tickBearWalkAnims(delta / 1000);
    this.syncNearbyEntityAssets();
    this.ensureVisibleEntities();
    // Create any zombies queued by ensure (living flush already ran earlier).
    this.flushPendingZombieRefreshes();

    for (const sprite of this.playerSprites.values()) {
      const data = sprite.getData("server") as
        | { x?: number; y?: number; alive?: boolean; inInterior?: boolean }
        | undefined;
      if (!data) continue;
      if (
        sprite.entityId !== this.sessionId &&
        !this.entityVisible("player", data, sprite.entityId)
      ) {
        // Soft-hide like zombies/guards — hard-destroy left idle players missing
        // after zoom/pan until their next schema patch.
        this.softHideEntitySprite(sprite);
        continue;
      }
      this.updateEntityFromState(sprite, "player", sprite.entityId);
    }

    for (const sprite of this.corpseSprites.values()) {
      const data = sprite.getData("server") as
        | { x?: number; y?: number; inInterior?: boolean }
        | undefined;
      if (!data) continue;
      // Corpses are static — hide when culled so zoom/pan can restore them.
      this.updateEntityFromState(sprite, "corpse", sprite.entityId);
    }

    for (const sprite of this.zombieSprites.values()) {
      const data = sprite.getData("server") as ZombieServerSnapshot | undefined;
      if (!data) continue;
      if (!this.entityVisible("zombie", data, sprite.entityId)) {
        // Soft-hide living and dead — hard-destroy left idle NPCs missing on zoom.
        this.softHideEntitySprite(sprite);
        continue;
      }
      this.updateEntityFromState(sprite, "zombie", sprite.entityId);
    }

    for (const sprite of this.coywolfSprites.values()) {
      const data = sprite.getData("server") as
        | { x?: number; y?: number; isDead?: boolean }
        | undefined;
      if (!data) continue;
      if (!this.entityVisible("coywolf", data, sprite.entityId)) {
        this.softHideEntitySprite(sprite);
        continue;
      }
      this.updateEntityFromState(sprite, "coywolf", sprite.entityId);
    }

    for (const sprite of this.bearSprites.values()) {
      const data = sprite.getData("server") as
        | { x?: number; y?: number; isDead?: boolean }
        | undefined;
      if (!data) continue;
      if (!this.entityVisible("bear", data, sprite.entityId)) {
        this.softHideEntitySprite(sprite);
        continue;
      }
      this.updateEntityFromState(sprite, "bear", sprite.entityId);
    }

    for (const sprite of this.crowSprites.values()) {
      const data = sprite.getData("server") as
        | { x?: number; y?: number; isDead?: boolean }
        | undefined;
      if (!data) continue;
      if (!this.entityVisible("crow", data, sprite.entityId)) {
        this.softHideEntitySprite(sprite);
        continue;
      }
      this.updateEntityFromState(sprite, "crow", sprite.entityId);
    }

    for (const sprite of this.guardSprites.values()) {
      const data = sprite.getData("server") as
        | { x?: number; y?: number; alive?: boolean; inInterior?: boolean }
        | undefined;
      if (!data) continue;
      if (!this.entityVisible("guard", data, sprite.entityId)) {
        this.softHideEntitySprite(sprite);
        continue;
      }
      this.updateEntityFromState(sprite, "guard", sprite.entityId);
    }

    this.drawEntitySpriteBoundsDebug();
  }

  private clearEntitySpriteBoundsDebug() {
    this.entityBoundsGfx?.clear();
    for (const label of this.entityBoundsLabels.values()) label.destroy();
    this.entityBoundsLabels.clear();
  }

  /** Godmode: stroke sprite bounds + id label (player green, zombie red, NPC cyan, coyote amber). */
  private drawEntitySpriteBoundsDebug() {
    if (!this.godModeDebug) {
      this.clearEntitySpriteBoundsDebug();
      return;
    }
    if (!this.entityBoundsGfx || !this.entityBoundsGfx.scene) {
      this.entityBoundsGfx = this.add.graphics().setDepth(9_999_998);
    }
    const g = this.entityBoundsGfx;
    g.clear();
    const seen = new Set<string>();

    const draw = (sprite: EntitySprite, color: number) => {
      if (!sprite.visible || sprite.alpha <= 0) return;
      const id = sprite.entityId;
      seen.add(id);
      const b = sprite.getBounds();
      g.lineStyle(1, color, 0.95);
      g.strokeRect(b.x, b.y, b.width, b.height);
      g.fillStyle(color, 1);
      g.fillCircle(sprite.x, sprite.y, 2.5);
      g.lineStyle(1, 0xffffff, 0.8);
      g.strokeCircle(sprite.x, sprite.y, 2.5);

      let label = this.entityBoundsLabels.get(id);
      if (!label || !label.scene) {
        label = this.add
          .text(0, 0, id, {
            fontFamily: "monospace",
            fontSize: "10px",
            color: "#ffffff",
            backgroundColor: "#000000aa",
            padding: { x: 2, y: 1 },
          })
          .setOrigin(0.5, 1)
          .setDepth(9_999_999);
        this.entityBoundsLabels.set(id, label);
      }
      label.setText(id);
      label.setPosition(b.x + b.width / 2, b.y - 2);
      label.setVisible(true);
    };

    for (const sprite of this.playerSprites.values()) draw(sprite, 0x22ee88);
    for (const sprite of this.zombieSprites.values()) draw(sprite, 0xff4444);
    for (const sprite of this.guardSprites.values()) draw(sprite, 0x44aaff);
    for (const sprite of this.coywolfSprites.values()) draw(sprite, 0xffaa33);
    for (const sprite of this.bearSprites.values()) draw(sprite, 0xc4783a);

    for (const [id, label] of this.entityBoundsLabels) {
      if (!seen.has(id)) {
        label.destroy();
        this.entityBoundsLabels.delete(id);
      }
    }
  }

  /**
   * Cull soft-hides sprites, and hard-destroy used to drop living NPCs that then
   * never came back (idle traders send no schema patches for minutes). Re-create
   * any room-state entity that is in the current render view but missing a sprite.
   */
  private ensureVisibleEntities() {
    const state = this.room?.state;
    if (!state) return;

    state.players?.forEach((player, id) => {
      if (this.playerSprites.has(id)) return;
      if (
        !this.entityVisible(
          "player",
          {
            x: player.x,
            y: player.y,
            alive: player.alive,
            inInterior: player.inInterior,
            buildingX: player.buildingX,
            buildingY: player.buildingY,
          },
          id,
        )
      ) {
        return;
      }
      this.applyPlayerServerData(id, player);
    });

    state.corpses?.forEach((corpse, id) => {
      if (this.corpseSprites.has(id)) return;
      if (
        !this.entityVisible(
          "corpse",
          {
            x: corpse.x,
            y: corpse.y,
            inInterior: corpse.inInterior,
            buildingX: corpse.buildingX,
            buildingY: corpse.buildingY,
          },
          id,
        )
      ) {
        return;
      }
      this.applyCorpseServerData(id, corpse);
    });

    state.zombies?.forEach((zombie, id) => {
      if (this.zombieSprites.has(id)) return;
      if (!this.entityVisible("zombie", zombie, id)) return;
      this.pendingZombieRefreshIds.add(id);
    });

    state.guards?.forEach((guard, id) => {
      if (this.guardSprites.has(id)) return;
      if (
        !this.entityVisible(
          "guard",
          {
            x: guard.x,
            y: guard.y,
            alive: guard.alive,
            inInterior: guard.inInterior,
            buildingX: guard.buildingX,
            buildingY: guard.buildingY,
          },
          id,
        )
      ) {
        return;
      }
      this.applyGuardServerData(id, guard);
    });

    state.coywolves?.forEach((wolf, id) => {
      if (this.coywolfSprites.has(id)) return;
      if (!this.entityVisible("coywolf", wolf, id)) return;
      this.refreshCoywolf(id, wolf);
    });

    state.bears?.forEach((bear, id) => {
      if (this.bearSprites.has(id)) return;
      if (!this.entityVisible("bear", bear, id)) return;
      this.refreshBear(id, bear);
    });

    state.crows?.forEach((crow, id) => {
      if (this.crowSprites.has(id)) return;
      if (!this.entityVisible("crow", crow, id)) return;
      this.refreshCrow(id, crow);
    });
  }

  /** Lazy-load NPC sprite packs for entities near the local player. */
  private syncNearbyEntityAssets() {
    const me = this.room?.state?.players?.get(this.sessionId);
    if (!me || !this.room?.state) return;

    const zombies: { x: number; y: number; skin?: number }[] = [];
    this.room.state.zombies.forEach((z) => {
      zombies.push({
        x: z.x,
        y: z.y,
        skin: (z as { skin?: number }).skin,
      });
    });
    const guards: {
      x: number;
      y: number;
      skin?: number;
      npcKind?: number;
    }[] = [];
    this.room.state.guards.forEach((g) => {
      guards.push({
        x: g.x,
        y: g.y,
        skin: (g as { skin?: number }).skin,
        npcKind: (g as { npcKind?: number }).npcKind,
      });
    });
    const players: { x: number; y: number; clothingSkin?: number }[] = [];
    this.room.state.players.forEach((p, id) => {
      const clothingSkin =
        id === this.sessionId
          ? (this.localInventorySync?.clothingSkin ??
            (p as { clothingSkin?: number }).clothingSkin ??
            1)
          : ((p as { clothingSkin?: number }).clothingSkin ?? 1);
      players.push({ x: p.x, y: p.y, clothingSkin });
    });
    this.room.state.corpses?.forEach((c) => {
      players.push({
        x: c.x,
        y: c.y,
        clothingSkin: (c as { clothingSkin?: number }).clothingSkin ?? 1,
      });
    });

    syncEntityAssetPacks(this, {
      playerX: Math.floor(me.x),
      playerY: Math.floor(me.y),
      // While indoors, also keep packs for street NPCs near the building door.
      ...(me.inInterior
        ? {
            alsoNearX: Math.floor(me.overworldX),
            alsoNearY: Math.floor(me.overworldY),
          }
        : {}),
      zombies,
      guards,
      players,
      coywolves: (() => {
        const list: { x: number; y: number }[] = [];
        this.room.state.coywolves?.forEach((wolf) => {
          list.push({ x: wolf.x, y: wolf.y });
        });
        return list;
      })(),
      bears: (() => {
        const list: { x: number; y: number }[] = [];
        this.room.state.bears?.forEach((bear) => {
          list.push({ x: bear.x, y: bear.y });
        });
        return list;
      })(),
      crows: (() => {
        const list: { x: number; y: number }[] = [];
        this.room.state.crows?.forEach((crow) => {
          list.push({ x: crow.x, y: crow.y });
        });
        return list;
      })(),
    });
  }

  /** Advance zombie walk frames from actual rendered displacement (not seeded speed). */
  private tickZombieWalkAnims(dtSec: number) {
    if (dtSec <= 0) return;
    for (const sprite of this.zombieSprites.values()) {
      if (!this.isZombieOnDrawnTile(sprite)) continue;
      const data = sprite.getData("server") as ZombieServerSnapshot | undefined;
      if (!data || this.isZombieDead(data)) continue;
      if (data.anim !== "walk" && data.anim !== "attack") continue;

      const rx = (sprite.getData("renderX") as number | undefined) ?? data.x;
      const ry = (sprite.getData("renderY") as number | undefined) ?? data.y;
      const prevRx = (sprite.getData("prevRenderX") as number | undefined) ?? rx;
      const prevRy = (sprite.getData("prevRenderY") as number | undefined) ?? ry;
      sprite.setData("prevRenderX", rx);
      sprite.setData("prevRenderY", ry);

      const dist = Math.hypot(rx - prevRx, ry - prevRy);
      // Stuck near a stale server snap (e.g. after a join hitch) — don't moonwalk.
      if (dist < 0.0005) continue;

      const localAnimFrame =
        (sprite.getData("localAnimFrame") as number | undefined) ?? 0;
      sprite.setData(
        "localAnimFrame",
        advanceWalkAnimFrame(
          localAnimFrame,
          dist,
          ZOMBIE_TILES_PER_WALK_FRAME,
          ZOMBIE_WALK_FRAMES,
        ),
      );
    }
  }

  /** Advance bear walk and charge frames from rendered displacement. */
  private tickBearWalkAnims(dtSec: number) {
    if (dtSec <= 0) return;
    for (const sprite of this.bearSprites.values()) {
      const data = sprite.getData("server") as
        | { x?: number; y?: number; anim?: string; isDead?: boolean }
        | undefined;
      if (!data || data.isDead) continue;
      const running = data.anim === "run";
      if (data.anim !== "walk" && !running) continue;
      if (data.x == null || data.y == null || !this.tileManager?.isTileDrawn(Math.floor(data.x), Math.floor(data.y))) {
        continue;
      }
      const rx = (sprite.getData("renderX") as number | undefined) ?? data.x;
      const ry = (sprite.getData("renderY") as number | undefined) ?? data.y;
      const prevRx = (sprite.getData("prevRenderX") as number | undefined) ?? rx;
      const prevRy = (sprite.getData("prevRenderY") as number | undefined) ?? ry;
      sprite.setData("prevRenderX", rx);
      sprite.setData("prevRenderY", ry);
      const dist = Math.hypot(rx - prevRx, ry - prevRy);
      if (dist < 0.0005) continue;
      const localAnimFrame =
        (sprite.getData("localAnimFrame") as number | undefined) ?? 0;
      sprite.setData(
        "localAnimFrame",
        advanceWalkAnimFrame(
          localAnimFrame,
          dist,
          running ? BEAR_TILES_PER_RUN_FRAME : BEAR_TILES_PER_WALK_FRAME,
          running ? BEAR_RUN_FRAMES : BEAR_WALK_FRAMES,
        ),
      );
    }
  }

  /** Advance coywolf walk frames from rendered displacement, same idea as zombies. */
  private tickCoywolfWalkAnims(dtSec: number) {
    if (dtSec <= 0) return;
    for (const sprite of this.coywolfSprites.values()) {
      const data = sprite.getData("server") as
        | { x?: number; y?: number; anim?: string; isDead?: boolean }
        | undefined;
      if (!data || data.isDead) continue;
      const running = data.anim === "run";
      if (data.anim !== "walk" && !running) continue;
      if (data.x == null || data.y == null || !this.tileManager?.isTileDrawn(Math.floor(data.x), Math.floor(data.y))) {
        continue;
      }
      const rx = (sprite.getData("renderX") as number | undefined) ?? data.x;
      const ry = (sprite.getData("renderY") as number | undefined) ?? data.y;
      const prevRx = (sprite.getData("prevRenderX") as number | undefined) ?? rx;
      const prevRy = (sprite.getData("prevRenderY") as number | undefined) ?? ry;
      sprite.setData("prevRenderX", rx);
      sprite.setData("prevRenderY", ry);
      const dist = Math.hypot(rx - prevRx, ry - prevRy);
      if (dist < 0.0005) continue;
      const localAnimFrame =
        (sprite.getData("localAnimFrame") as number | undefined) ?? 0;
      sprite.setData(
        "localAnimFrame",
        advanceWalkAnimFrame(
          localAnimFrame,
          dist,
          running ? COYWOLF_TILES_PER_RUN_FRAME : COYWOLF_TILES_PER_WALK_FRAME,
          running ? COYWOLF_RUN_FRAMES : COYWOLF_WALK_FRAMES,
        ),
      );
    }
  }

  private buildEntityVisualKey(
    kind: "player" | "zombie" | "guard" | "corpse" | "coywolf" | "bear" | "crow",
    data: {
      facing: number;
      anim: string;
      idleWeapon?: string;
      equippedWeaponIndex?: number;
      clothingSkin?: number;
      skin?: number;
      npcKind?: number;
      alive?: boolean;
      isDead?: boolean;
      looted?: boolean;
    },
    animFrame: number,
    attackFrame: number | undefined,
    dieFrame: number | undefined,
    isDead: boolean,
    zombieCrawling = false,
  ): string {
    // Use *resolved* (loaded) skins / pack readiness — not preferred ids.
    // Otherwise lazy packs finish loading while idle entities keep a cached key
    // and stay on the fallback sprite until facing/anim changes from movement.
    const npcKind = data.npcKind ?? 0;
    let resolvedSkin = "";
    let packReady = "";
    if (kind === "player" || kind === "corpse") {
      resolvedSkin = String(
        resolveLoadedPlayerSkin(data.clothingSkin ?? 1, this),
      );
    } else if (kind === "zombie") {
      resolvedSkin = String(resolveLoadedZombieSkin(data.skin ?? 1));
    } else if (kind === "guard") {
      if (npcKind === GUARD_NPC_TRADER_MAN) {
        packReady = traderManPackReady() ? "1" : "0";
      } else if (npcKind === GUARD_NPC_TRADER_GUARD) {
        packReady = traderGuardPackReady() ? "1" : "0";
      } else if (npcKind === GUARD_NPC_RED_MAN) {
        resolvedSkin = String(resolveLoadedRedManSkin(data.skin ?? 1));
      } else {
        resolvedSkin = String(resolveLoadedGuardSkin(data.skin ?? 1));
      }
    } else if (kind === "coywolf") {
      packReady = coywolfPackReady() ? "1" : "0";
    } else if (kind === "bear") {
      packReady = bearPackReady() ? "1" : "0";
    } else if (kind === "crow") {
      packReady = crowPackReady() ? "1" : "0";
    }

    return [
      kind,
      data.facing,
      data.anim,
      animFrame,
      data.idleWeapon ?? "",
      data.equippedWeaponIndex ?? -1,
      resolvedSkin,
      attackFrame ?? -1,
      dieFrame ?? -1,
      isDead ? 1 : 0,
      data.looted ? 1 : 0,
      kind === "guard" ? npcKind : "",
      packReady,
      data.alive === false ? 1 : 0,
      data.isDead ? 1 : 0,
      zombieCrawling ? 1 : 0,
    ].join("|");
  }

  private updateEntityFromState(
    sprite: EntitySprite,
    kind: "player" | "zombie" | "guard" | "corpse" | "coywolf" | "bear" | "crow",
    entityId: string,
  ) {
    let data = sprite.getData("server") as
      | {
          x: number;
          y: number;
          facing: number;
          anim: string;
          animFrame: number;
          health: number;
          alive?: boolean;
          idleWeapon?: string;
          clothingSkin?: number;
          isDead?: boolean;
          looted?: boolean;
          skin?: number;
          npcKind?: number;
          inInterior?: boolean;
          buildingX?: number;
          buildingY?: number;
          equippedWeaponIndex?: number;
          magazineRounds?: number;
          isReloading?: boolean;
          searchTargetId?: string;
          searchEndTime?: number;
          fightingStanceUntil?: number;
          altitude?: number;
        }
      | undefined;

    if (!data) {
      return;
    }

    const visible = this.entityVisible(kind, data, entityId);
    if (!visible) {
      this.softHideEntitySprite(sprite);
      return;
    }

    // Pack unload can destroy the sprite's texture while visualKey still matches
    // the reloaded pack id — force a rebind before making the GO visible again.
    if (this.entitySpriteTextureBroken(sprite)) {
      sprite.setData("visualKey", "");
      sprite.setTexture("__DEFAULT");
    }

    let attackFrame: number | undefined;
    if (kind === "player") {
      attackFrame = this.resolveAttackFrame(entityId, data.fightingStanceUntil ?? 0);
    } else if (
      kind === "guard" &&
      !isMilitiaNonCombatSkin(data.skin) &&
      data.anim !== "walk" &&
      !isGuardSitAnim(data.anim) &&
      ((data.fightingStanceUntil ?? 0) > Date.now() || data.anim === "attack")
    ) {
      attackFrame = this.resolveAttackFrame(entityId, data.fightingStanceUntil ?? 0);
      // Aim / combat hold without a local fire clip — FireAK 0006.
      if (attackFrame === undefined && data.anim === "attack") {
        attackFrame = 5;
      }
    }

    const animFrame =
      kind === "zombie" || kind === "coywolf" || kind === "bear"
        ? Math.floor(
            (sprite.getData("localAnimFrame") as number | undefined) ??
              data.animFrame ??
              0,
          )
        : (data.animFrame ?? 0);

    const isDead =
      kind === "corpse"
        ? true
        : kind === "zombie" || kind === "coywolf" || kind === "bear" || kind === "crow"
          ? this.isZombieDead(data)
          : kind === "guard"
            ? data.alive === false
            : data.alive === false;
    const dieFrame =
      kind === "player" || kind === "corpse"
        ? this.resolveDieFrame(entityId, isDead, PLAYER_DIE_FRAMES, PLAYER_DIE_ANIM_MS)
        : kind === "zombie"
          ? this.resolveDieFrame(
              entityId,
              isDead,
              zombieDieFrameCount(data.skin),
              zombieDieAnimMs(data.skin),
            )
          : kind === "coywolf"
            ? this.resolveDieFrame(
                entityId,
                isDead,
                COYWOLF_DIE_FRAMES,
                COYWOLF_DIE_ANIM_MS,
              )
          : kind === "bear"
            ? this.resolveDieFrame(
                entityId,
                isDead,
                BEAR_DIE_FRAMES,
                BEAR_DIE_ANIM_MS,
              )
          : kind === "crow"
            ? this.resolveDieFrame(
                entityId,
                isDead,
                CROW_DIE_FRAMES,
                CROW_DIE_ANIM_MS,
              )
          : kind === "guard"
            ? this.resolveDieFrame(
                entityId,
                isDead,
                militiaGuardDieFrames(data.skin),
                militiaGuardDieAnimMs(data.skin),
              )
            : this.resolveDieFrame(entityId, isDead, 8, DIE_ANIM_MS);

    const fireWeapon = this.fireAnims.get(entityId)?.weaponIndex;
    const equippedWeaponIndex =
      kind === "player" || kind === "corpse"
        ? (fireWeapon ??
            (entityId === this.sessionId
              ? this.localEquippedWeaponIndex()
              : (data.equippedWeaponIndex ?? -1)))
        : (data.equippedWeaponIndex ?? -1);

    const clothingSkin =
      kind === "player" || kind === "corpse"
        ? entityId === this.sessionId
          ? (this.localInventorySync?.clothingSkin ?? data.clothingSkin ?? 1)
          : (data.clothingSkin ?? 1)
        : undefined;
    let displayAnim =
      kind === "corpse"
        ? "dead"
        : kind === "guard" && !isDead
          ? this.resolveDoctorIdleAnim(entityId, data.skin, data.anim ?? "idle")
          : (data.anim ?? "idle");
    let displayFacing =
      entityId === this.sessionId &&
      this.aimHeld &&
      this.localAimFacing != null
        ? this.localAimFacing
        : (data.facing ?? 4);
    if (
      kind === "guard" &&
      isGuardSitAnim(displayAnim) &&
      data.inInterior &&
      isTentInterior(data.buildingX ?? 0, data.buildingY ?? 0)
    ) {
      displayFacing = 7;
      displayAnim = "sit-campchair";
      attackFrame = undefined;
    }
    const zombieCrawling =
      kind === "zombie" && isZombieCrawler(entityId, data.skin);
    const visualKey = this.buildEntityVisualKey(
      kind,
      {
        ...data,
        facing: displayFacing,
        anim: displayAnim,
        equippedWeaponIndex,
        clothingSkin,
      },
      animFrame,
      attackFrame,
      dieFrame,
      isDead,
      zombieCrawling,
    );
    if (sprite.getData("visualKey") !== visualKey) {
      sprite.setData("visualKey", visualKey);
      updateEntityVisual(sprite, kind === "corpse" ? "player" : kind, {
        facing: displayFacing,
        anim: displayAnim,
        animFrame,
        idleWeapon: data.idleWeapon ?? "NoWeapon",
        equippedWeaponIndex:
          kind === "player" || kind === "corpse"
            ? equippedWeaponIndex
            : undefined,
        clothingSkin,
        attackFrame,
        dieFrame,
        isDead,
        looted: !!data.looted,
        alive: kind === "corpse" ? false : data.alive,
        zombieSkin: kind === "zombie" ? (data.skin ?? 1) : undefined,
        zombieCrawling,
        guardSkin: kind === "guard" ? (data.skin ?? 1) : undefined,
        guardNpcKind: kind === "guard" ? (data.npcKind ?? 0) : undefined,
      });
    }

    sprite.setVisible(true);

    const renderPos =
      kind === "zombie" || kind === "coywolf" || kind === "bear" || kind === "crow"
        ? this.getZombieRenderPosition(sprite, data.x, data.y)
        : kind === "player"
          ? this.getPlayerRenderPosition(sprite, data.x, data.y)
          : { x: data.x, y: data.y };
    const iso = cartesianToIso(renderPos.x, renderPos.y);
    let depth = isDead
      ? data.inInterior
        ? this.interiorCorpseDepth(
            renderPos.x,
            renderPos.y,
            data.buildingX,
            data.buildingY,
          )
        : this.overworldCorpseDepth(renderPos.x, renderPos.y)
      : data.inInterior
        ? this.interiorEntityDepth(
            renderPos.x,
            renderPos.y,
            data.buildingX,
            data.buildingY,
          )
        : this.overworldEntityDepth(renderPos.x, renderPos.y);
    // Local player: tie-break only — a full +1 leaps over entities up to ~0.1
    // tiles south with continuous (x+y)*10 depth, and anything as big as the
    // step a wall clamp uses cancels that clamp (see LOCAL_PLAYER_DEPTH_BIAS).
    if (entityId === this.sessionId && kind === "player" && !isDead) {
      depth += LOCAL_PLAYER_DEPTH_BIAS;
    }
    const crawlDrop = zombieCrawling && !isDead ? ZOMBIE_CRAWL_TILE_DROP_PX : 0;
    const coyoteDrop = kind === "coywolf" ? COYWOLF_TILE_DROP_PX : 0;
    const bearDrop = kind === "bear" ? BEAR_TILE_DROP_PX : 0;
    const crowLift = kind === "crow" ? crowFlightLiftPx(data.altitude ?? 0) : 0;
    if (kind === "crow" && crowLift > 0) {
      // One (x+y) step is TILE_HEIGHT/2 pixels and 1024 depth, matching groundSortDepth.
      depth += (crowLift / (TILE_HEIGHT / 2)) * 1024;
    }
    sprite.setPosition(
      iso.x,
      entityFeetY(iso.y) + crawlDrop + coyoteDrop + bearDrop - crowLift,
    );
    sprite.setDepth(depth);

    if (entityId === this.sessionId && kind === "player") {
      if (data.inInterior) {
        this.playerOcclusionHighlight?.hide();
        this.playerOccludedGhost?.hide();
      } else {
        this.playerOcclusionHighlight?.update(
          sprite,
          Math.floor(renderPos.x),
          Math.floor(renderPos.y),
          depth,
        );
        this.playerOccludedGhost?.update(
          sprite,
          Math.floor(renderPos.x),
          Math.floor(renderPos.y),
          depth,
        );
      }
    }

    if (entityId === this.sessionId && kind === "player") {
      this.cameras.main.centerOn(iso.x, iso.y);
    }
  }

  private equipWeaponBySlot(slotIndex: number) {
    if (!this.room) return;
    const message: ClientMessage = {
      type: "equipWeapon",
      payload: { slotIndex },
    };
    this.room.send("action", message);
  }

  private unequipWeapon() {
    this.equipWeaponBySlot(-1);
  }

  /** Close inventory / loot UI so the Wear/Remove progress bar is visible. */
  private closeDialogsForClothingAction() {
    if (this.inventoryUI?.isOpen()) this.inventoryUI.close();
    if (this.journalUI?.isOpen()) this.journalUI.close();
    if (this.containerLootUI?.isOpen()) this.containerLootUI.close();
  }

  private equipClothingBySlot(slotIndex: number) {
    if (!this.room) return;
    const me = this.room.state.players.get(this.sessionId);
    if (!me?.alive || this.isBusyWithTimedAction(me)) return;

    const removing = slotIndex < 0 || slotIndex === CLOTHING_SLOT_INDEX;
    this.stopPlayerMovement();
    this.closeDialogsForClothingAction();
    this.beginOptimisticClothingChange(
      CLOTHING_CHANGE_ACTION_LABELS[removing ? "remove" : "wear"],
    );

    const message: ClientMessage = {
      type: "equipClothing",
      payload: { slotIndex },
    };
    this.room.send("action", message);
  }

  private unequipClothing() {
    this.equipClothingBySlot(-1);
  }

  private dropItem(slotIndex: number, quantity = 1) {
    if (!this.room) return;
    const message: ClientMessage = {
      type: "dropItem",
      payload: { slotIndex, quantity },
    };
    this.room.send("action", message);
    this.lastInventoryRenderKey = "";
    this.lastHotbarRenderKey = "";
  }

  private moveInventorySlot(
    fromSlot: number,
    toSlot: number,
    splitHalf = false,
  ) {
    if (!this.room) return;
    const me = this.room.state.players.get(this.sessionId);
    // Drag onto/from the clothing slot starts the same Wear/Remove channel.
    // A shift-split never wears or removes clothing.
    if (
      !splitHalf &&
      me &&
      (fromSlot === CLOTHING_SLOT_INDEX || toSlot === CLOTHING_SLOT_INDEX)
    ) {
      if (this.isBusyWithTimedAction(me)) return;
      const removing = fromSlot === CLOTHING_SLOT_INDEX;
      this.stopPlayerMovement();
      this.closeDialogsForClothingAction();
      this.beginOptimisticClothingChange(
        CLOTHING_CHANGE_ACTION_LABELS[removing ? "remove" : "wear"],
      );
    }
    const message: ClientMessage = {
      type: "moveInventorySlot",
      payload: splitHalf
        ? { fromSlot, toSlot, splitHalf: true }
        : { fromSlot, toSlot },
    };
    this.room.send("action", message);
    this.lastInventoryRenderKey = "";
    this.lastHotbarRenderKey = "";
  }

  private openContainerLootUI(
    containerId: string,
    objectType: string,
    containerJson: string,
    piles?: { containerId: string; objectType: string; containerJson: string }[],
  ) {
    if (this.inventoryUI?.isOpen()) this.inventoryUI.close();
    if (this.journalUI?.isOpen()) this.journalUI.close();
    if (this.mapOverlayUI?.isOpen()) this.mapOverlayUI.close();
    if (this.traderUI?.isOpen()) this.closeTraderUI();
    if (this.playerMarketUI?.isOpen()) this.closePlayerMarketUI();
    if (this.craftUI?.isOpen()) this.closeCraftUI();
    if (this.fireplaceUI?.isOpen()) this.closeFireplaceUI();
    if (this.prefabDepositUI?.isOpen()) this.closePrefabUI();
    if (this.redOrderDialogUI?.isOpen()) this.closeRedOrderDialog();
    if (this.ashenTraderDialogUI?.isOpen()) this.closeAshenTraderDialog();
    if (this.ashenMilitiaDialogUI?.isOpen()) this.closeAshenMilitiaDialog();

    const me = this.room?.state?.players?.get(this.sessionId);
    const inventoryJson =
      this.localInventorySync?.inventoryJson ?? me?.inventoryJson ?? "[]";
    this.containerLootUI?.open(
      containerId,
      objectType,
      containerJson,
      inventoryJson,
      piles,
      this.localExtraPockets(),
    );
  }

  private openCraftUI(payload: {
    workbenchId: string;
    inventoryJson: string;
    station?: "workbench" | "furnace";
  }) {
    if (this.inventoryUI?.isOpen()) this.inventoryUI.close();
    if (this.journalUI?.isOpen()) this.journalUI.close();
    if (this.mapOverlayUI?.isOpen()) this.mapOverlayUI.close();
    if (this.traderUI?.isOpen()) this.closeTraderUI();
    if (this.playerMarketUI?.isOpen()) this.closePlayerMarketUI();
    if (this.containerLootUI?.isOpen()) this.containerLootUI.close();
    if (this.redOrderDialogUI?.isOpen()) this.closeRedOrderDialog();
    if (this.ashenTraderDialogUI?.isOpen()) this.closeAshenTraderDialog();
    if (this.ashenMilitiaDialogUI?.isOpen()) this.closeAshenMilitiaDialog();
    if (this.fireplaceUI?.isOpen()) this.closeFireplaceUI();
    if (this.prefabDepositUI?.isOpen()) this.closePrefabUI();
    this.craftUI?.setLearnedRecipes(this.learnedRecipeIds);
    this.craftUI?.open({
      ...payload,
      extraPockets: this.localExtraPockets(),
    });
  }

  private closeCraftUI() {
    if (!this.craftUI?.isOpen()) return;
    this.craftUI.close();
    if (!this.room) return;
    const message: ClientMessage = { type: "craftClose" };
    this.room.send("action", message);
  }

  private openFireplaceUI(payload: FireplaceUIState) {
    if (this.inventoryUI?.isOpen()) this.inventoryUI.close();
    if (this.journalUI?.isOpen()) this.journalUI.close();
    if (this.mapOverlayUI?.isOpen()) this.mapOverlayUI.close();
    if (this.traderUI?.isOpen()) this.closeTraderUI();
    if (this.playerMarketUI?.isOpen()) this.closePlayerMarketUI();
    if (this.containerLootUI?.isOpen()) this.containerLootUI.close();
    if (this.redOrderDialogUI?.isOpen()) this.closeRedOrderDialog();
    if (this.ashenTraderDialogUI?.isOpen()) this.closeAshenTraderDialog();
    if (this.ashenMilitiaDialogUI?.isOpen()) this.closeAshenMilitiaDialog();
    if (this.craftUI?.isOpen()) this.closeCraftUI();
    if (this.prefabDepositUI?.isOpen()) this.closePrefabUI();
    this.fireplaceUI?.open(payload);
  }

  private closeFireplaceUI() {
    if (!this.fireplaceUI?.isOpen()) return;
    this.fireplaceUI.close();
    if (!this.room) return;
    const message: ClientMessage = { type: "fireplaceClose" };
    this.room.send("action", message);
  }

  private sendFireplaceAddWood() {
    if (!this.room || !this.fireplaceUI?.isOpen()) return;
    const tile = this.fireplaceUI.getTile();
    if (!tile) return;
    const message: ClientMessage = {
      type: "fireplaceAddWood",
      payload: { x: tile.x, y: tile.y },
    };
    this.room.send("action", message);
  }

  private sendFireplaceLight() {
    if (!this.room || !this.fireplaceUI?.isOpen()) return;
    const tile = this.fireplaceUI.getTile();
    if (!tile) return;
    const message: ClientMessage = {
      type: "fireplaceLight",
      payload: { x: tile.x, y: tile.y },
    };
    this.room.send("action", message);
  }

  private sendFireplaceCook(slot: number, itemId?: string) {
    if (!this.room || !this.fireplaceUI?.isOpen()) return;
    const tile = this.fireplaceUI.getTile();
    if (!tile) return;
    const message: ClientMessage = {
      type: "fireplaceCook",
      payload: {
        x: tile.x,
        y: tile.y,
        slot,
        ...(itemId ? { itemId } : {}),
      },
    };
    this.room.send("action", message);
  }

  private sendFireplaceExtinguish() {
    if (!this.room || !this.fireplaceUI?.isOpen()) return;
    const tile = this.fireplaceUI.getTile();
    if (!tile) return;
    const message: ClientMessage = {
      type: "fireplaceExtinguish",
      payload: { x: tile.x, y: tile.y },
    };
    this.room.send("action", message);
    AudioManager.get().playFireplaceExtinguish();
  }

  private furnaceSearchableAt(
    me: { inInterior: boolean; buildingX: number; buildingY: number },
    tx: number,
    ty: number,
  ) {
    if (!me.inInterior) return undefined;
    return this.searchablesCache.find(
      (item) =>
        furnitureIsFurnace(item.objectType) &&
        item.buildingX === me.buildingX &&
        item.buildingY === me.buildingY &&
        searchableOccupiesTile(item, tx, ty),
    );
  }

  private updateFireplaceProximity() {
    if (!this.fireplaceUI?.isOpen() || !this.room) return;
    const tile = this.fireplaceUI.getTile();
    if (!tile) return;

    const me = this.room.state.players.get(this.sessionId);
    if (!me?.alive) {
      this.closeFireplaceUI();
      return;
    }

    // Warehouse furnaces reuse this panel but are furniture, not structures.
    const furnace = this.furnaceSearchableAt(me, tile.x, tile.y);
    if (furnace) {
      if (!me.inInterior || !playerAdjacentToSearchable(me.x, me.y, furnace)) {
        this.closeFireplaceUI();
      }
      return;
    }

    const fireplace = this.findFireplaceAt(me, tile.x, tile.y);
    if (!fireplace) {
      this.closeFireplaceUI();
      return;
    }
    const ptx = Math.floor(me.x);
    const pty = Math.floor(me.y);
    if (Math.max(Math.abs(ptx - tile.x), Math.abs(pty - tile.y)) > 1) {
      this.closeFireplaceUI();
    }
  }

  private nearestAdjacentFireplace(me: {
    x: number;
    y: number;
    inInterior: boolean;
    buildingX: number;
    buildingY: number;
  }): InteriorFireplaceTile | null {
    const ptx = Math.floor(me.x);
    const pty = Math.floor(me.y);
    const list = me.inInterior
      ? (this.structureFireplacesByBuilding.get(
          buildingKey(me.buildingX, me.buildingY),
        ) ?? [])
      : [...this.structureFireplacesOverworld.values()];
    let best: InteriorFireplaceTile | null = null;
    let bestDist = Infinity;
    for (const f of list) {
      const d = Math.max(Math.abs(ptx - f.x), Math.abs(pty - f.y));
      if (d > 1) continue;
      if (d < bestDist) {
        bestDist = d;
        best = f;
      }
    }
    return best;
  }

  private findStorageBoxAt(
    me: { inInterior: boolean; buildingX: number; buildingY: number },
    tx: number,
    ty: number,
  ): StorageBoxTile | undefined {
    if (me.inInterior) {
      return this.structureStorageBoxesByBuilding
        .get(buildingKey(me.buildingX, me.buildingY))
        ?.find((box) => box.x === tx && box.y === ty);
    }
    return this.structureStorageBoxesOverworld.get(`${tx},${ty}`);
  }

  private findStorageBoxById(
    me: { inInterior: boolean; buildingX: number; buildingY: number },
    containerId: string,
  ): StorageBoxTile | undefined {
    if (me.inInterior) {
      const list =
        this.structureStorageBoxesByBuilding.get(
          buildingKey(me.buildingX, me.buildingY),
        ) ?? [];
      return list.find(
        (box) =>
          playerStructureId(true, me.buildingX, me.buildingY, box.x, box.y) ===
          containerId,
      );
    }
    for (const box of this.structureStorageBoxesOverworld.values()) {
      if (playerStructureId(false, 0, 0, box.x, box.y) === containerId) return box;
    }
    return undefined;
  }

  private nearestAdjacentStorageBox(me: {
    x: number;
    y: number;
    inInterior: boolean;
    buildingX: number;
    buildingY: number;
  }): StorageBoxTile | null {
    const ptx = Math.floor(me.x);
    const pty = Math.floor(me.y);
    const list = me.inInterior
      ? (this.structureStorageBoxesByBuilding.get(
          buildingKey(me.buildingX, me.buildingY),
        ) ?? [])
      : [...this.structureStorageBoxesOverworld.values()];
    let best: StorageBoxTile | null = null;
    let bestDist = Infinity;
    for (const box of list) {
      const d = Math.max(Math.abs(ptx - box.x), Math.abs(pty - box.y));
      if (d > 1) continue;
      if (d < bestDist) {
        bestDist = d;
        best = box;
      }
    }
    return best;
  }

  private tryInteractStorageBoxAt(screenX: number, screenY: number): boolean {
    if (!this.room || this.structureBuildMode) return false;
    const me = this.room.state?.players?.get(this.sessionId);
    if (!me?.alive) return false;
    const worldPt = this.cameras.main.getWorldPoint(screenX, screenY);
    const cart = isoToCartesian(worldPt.x, worldPt.y);
    const tx = Math.floor(cart.x);
    const ty = Math.floor(cart.y);
    const box = this.findStorageBoxAt(me, tx, ty);
    if (!box) return false;

    const now = Date.now();
    const clickKey = `${tx},${ty}`;
    const isDoubleClick =
      clickKey === this.lastStorageBoxClickKey &&
      now - this.lastStorageBoxClickAt < WorldScene.DOUBLE_CLICK_MS;
    this.lastStorageBoxClickKey = clickKey;
    this.lastStorageBoxClickAt = now;
    this.lastClickTime = now;

    this.clearCombatTarget();
    this.clearInteractTarget();
    this.clearLootTarget();
    this.clearDoorTarget();
    this.clearTreeChopTarget();
    this.fireplaceTargetTile = null;
    this.fireplaceSprint = false;

    if (this.tryStartStorageBoxInteract(me, tx, ty)) return true;

    this.storageBoxTargetTile = { x: tx, y: ty };
    this.storageBoxSprint = isDoubleClick && (me.stamina ?? 0) > 0;
    const goal = this.doorApproachGoal(me, tx, ty);
    if (goal) {
      this.sendMoveToCoords(goal.x, goal.y, this.storageBoxSprint);
      this.drawMoveTarget(goal.x, goal.y, this.storageBoxSprint);
      this.moveTargetFadeUntil = now + 800;
      this.lastPursuitMoveSentAt = now;
    }
    return true;
  }

  private tryStartStorageBoxInteract(
    me: { x: number; y: number },
    tx: number,
    ty: number,
  ): boolean {
    if (!this.room) return false;
    const ptx = Math.floor(me.x);
    const pty = Math.floor(me.y);
    if (Math.max(Math.abs(ptx - tx), Math.abs(pty - ty)) > 1) return false;
    this.clearFireplaceTarget();
    this.stopPlayerMovement();
    const message: ClientMessage = {
      type: "storageBoxOpen",
      payload: { x: tx, y: ty },
    };
    this.room.send("action", message);
    return true;
  }

  private updateStorageBoxPursuit() {
    if (!this.storageBoxTargetTile) return;
    const { x: tx, y: ty } = this.storageBoxTargetTile;
    const me = this.room?.state?.players?.get(this.sessionId);
    if (!me?.alive) {
      this.clearFireplaceTarget();
      return;
    }
    if (!this.findStorageBoxAt(me, tx, ty)) {
      this.storageBoxTargetTile = null;
      this.storageBoxSprint = false;
      return;
    }
    if (this.tryStartStorageBoxInteract(me, tx, ty)) return;
    if (this.isBusyWithTimedAction(me)) return;
    const now = Date.now();
    if (now - this.lastPursuitMoveSentAt > 300) {
      const goal = this.doorApproachGoal(me, tx, ty);
      if (!goal) {
        this.storageBoxTargetTile = null;
        this.storageBoxSprint = false;
        return;
      }
      const sprint = this.storageBoxSprint && me.stamina > 0;
      this.sendMoveToCoords(goal.x, goal.y, sprint);
      this.lastPursuitMoveSentAt = now;
    }
  }

  private nearestAdjacentPrefab(me: {
    x: number;
    y: number;
    inInterior: boolean;
    buildingX: number;
    buildingY: number;
  }): PrefabTile | null {
    const ptx = Math.floor(me.x);
    const pty = Math.floor(me.y);
    const list = me.inInterior
      ? (this.prefabsByBuilding.get(buildingKey(me.buildingX, me.buildingY)) ?? [])
      : [...this.prefabsOverworld.values()];
    let best: PrefabTile | null = null;
    let bestDist = Infinity;
    for (const p of list) {
      if (p.kind === "fence_corner") continue;
      const d = this.chebyshevToOccupied(ptx, pty, p);
      if (d > 1) continue;
      if (d < bestDist) {
        bestDist = d;
        best = p;
      }
    }
    return best;
  }

  private openPrefabUI(payload: {
    x: number;
    y: number;
    inInterior: boolean;
    buildingX?: number;
    buildingY?: number;
    kind: StructureBuildKind;
    depositsJson: string;
    inventoryJson: string;
  }) {
    if (this.inventoryUI?.isOpen()) this.inventoryUI.close();
    if (this.journalUI?.isOpen()) this.journalUI.close();
    if (this.mapOverlayUI?.isOpen()) this.mapOverlayUI.close();
    if (this.traderUI?.isOpen()) this.closeTraderUI();
    if (this.playerMarketUI?.isOpen()) this.closePlayerMarketUI();
    if (this.containerLootUI?.isOpen()) this.containerLootUI.close();
    if (this.redOrderDialogUI?.isOpen()) this.closeRedOrderDialog();
    if (this.ashenTraderDialogUI?.isOpen()) this.closeAshenTraderDialog();
    if (this.ashenMilitiaDialogUI?.isOpen()) this.closeAshenMilitiaDialog();
    if (this.craftUI?.isOpen()) this.closeCraftUI();
    if (this.fireplaceUI?.isOpen()) this.closeFireplaceUI();
    if (this.deconstructUI?.isOpen()) this.closeDeconstructUI();
    this.prefabDepositUI?.open({
      ...payload,
      durationMs: this.localSkillMods().buildDurationMs,
    });
  }

  private openDeconstructUI(payload: {
    x: number;
    y: number;
    inInterior: boolean;
    buildingX?: number;
    buildingY?: number;
    kind: StructureBuildKind;
    refund: { itemId: string; quantity: number }[];
  }) {
    if (this.inventoryUI?.isOpen()) this.inventoryUI.close();
    if (this.journalUI?.isOpen()) this.journalUI.close();
    if (this.mapOverlayUI?.isOpen()) this.mapOverlayUI.close();
    if (this.traderUI?.isOpen()) this.closeTraderUI();
    if (this.playerMarketUI?.isOpen()) this.closePlayerMarketUI();
    if (this.containerLootUI?.isOpen()) this.containerLootUI.close();
    if (this.redOrderDialogUI?.isOpen()) this.closeRedOrderDialog();
    if (this.ashenTraderDialogUI?.isOpen()) this.closeAshenTraderDialog();
    if (this.ashenMilitiaDialogUI?.isOpen()) this.closeAshenMilitiaDialog();
    if (this.craftUI?.isOpen()) this.closeCraftUI();
    if (this.fireplaceUI?.isOpen()) this.closeFireplaceUI();
    if (this.prefabDepositUI?.isOpen()) this.closePrefabUI();
    this.deconstructUI?.open({
      ...payload,
      durationMs: this.localSkillMods().deconstructDurationMs,
    });
  }

  private closeDeconstructUI() {
    if (!this.deconstructUI?.isOpen()) return;
    this.deconstructUI.close();
    if (!this.room) return;
    const message: ClientMessage = { type: "deconstructClose" };
    this.room.send("action", message);
  }

  private sendDeconstructStart() {
    if (!this.room || !this.deconstructUI?.isOpen()) return;
    const tile = this.deconstructUI.getTile();
    if (!tile) return;
    this.deconstructUI.close();
    const message: ClientMessage = {
      type: "deconstructStart",
      payload: { x: tile.x, y: tile.y },
    };
    this.room.send("action", message);
  }

  private closePrefabUI() {
    if (!this.prefabDepositUI?.isOpen()) return;
    this.prefabDepositUI.close();
    if (!this.room) return;
    const message: ClientMessage = { type: "prefabClose" };
    this.room.send("action", message);
  }

  private sendPrefabDeposit(itemId: string, quantity: number) {
    if (!this.room || !this.prefabDepositUI?.isOpen()) return;
    const tile = this.prefabDepositUI.getTile();
    if (!tile) return;
    const message: ClientMessage = {
      type: "prefabDeposit",
      payload: { x: tile.x, y: tile.y, itemId, quantity },
    };
    this.room.send("action", message);
  }

  private sendPrefabStartBuild() {
    if (!this.room || !this.prefabDepositUI?.isOpen()) return;
    const tile = this.prefabDepositUI.getTile();
    if (!tile) return;
    this.prefabDepositUI.close();
    const message: ClientMessage = {
      type: "prefabStartBuild",
      payload: { x: tile.x, y: tile.y },
    };
    this.room.send("action", message);
  }

  private sendPrefabCancel() {
    if (!this.room || !this.prefabDepositUI?.isOpen()) return;
    const tile = this.prefabDepositUI.getTile();
    if (!tile) return;
    this.prefabDepositUI.close();
    const message: ClientMessage = {
      type: "prefabCancel",
      payload: { x: tile.x, y: tile.y },
    };
    this.room.send("action", message);
  }

  private updatePrefabProximity() {
    if (!this.prefabDepositUI?.isOpen() || !this.room) return;
    const tile = this.prefabDepositUI.getTile();
    if (!tile) return;

    const me = this.room.state.players.get(this.sessionId);
    if (!me?.alive) {
      this.closePrefabUI();
      return;
    }

    const prefab = this.findPrefabAt(me, tile.x, tile.y);
    if (!prefab) {
      this.closePrefabUI();
      return;
    }
    const ptx = Math.floor(me.x);
    const pty = Math.floor(me.y);
    if (this.chebyshevToOccupied(ptx, pty, prefab) > 1) {
      this.closePrefabUI();
    }
  }

  private chebyshevToOccupied(
    ptx: number,
    pty: number,
    rec: { kind: string; x: number; y: number; facing?: string | null },
  ): number {
    let best = Infinity;
    for (const t of structureOccupiedTiles(rec)) {
      const d = Math.max(Math.abs(ptx - t.x), Math.abs(pty - t.y));
      if (d < best) best = d;
    }
    return best;
  }

  private findPrefabAt(
    me: { inInterior: boolean; buildingX: number; buildingY: number },
    tx: number,
    ty: number,
  ): PrefabTile | undefined {
    if (me.inInterior) {
      return this.prefabsByBuilding
        .get(buildingKey(me.buildingX, me.buildingY))
        ?.find((p) => this.prefabOccupiesTile(p, tx, ty));
    }
    const origin = this.prefabsOverworld.get(`${tx},${ty}`);
    if (origin) return origin;
    for (const p of this.prefabsOverworld.values()) {
      if (this.prefabOccupiesTile(p, tx, ty)) return p;
    }
    return undefined;
  }

  private clearPrefabTarget() {
    this.prefabTargetTile = null;
    this.prefabSprint = false;
  }

  /** Click-to-use a prefab: open the deposit UI if adjacent, else walk up first. */
  private tryInteractPrefabAt(screenX: number, screenY: number): boolean {
    if (!this.room || this.structureBuildMode) return false;
    const me = this.room.state?.players?.get(this.sessionId);
    if (!me?.alive) return false;
    const worldPt = this.cameras.main.getWorldPoint(screenX, screenY);
    const cart = isoToCartesian(worldPt.x, worldPt.y);
    const tx = Math.floor(cart.x);
    const ty = Math.floor(cart.y);

    const prefab = this.findPrefabAt(me, tx, ty);
    if (!prefab || prefab.kind === "fence_corner") return false;

    const now = Date.now();
    const clickKey = `${tx},${ty}`;
    const isDoubleClick =
      clickKey === this.lastPrefabClickKey &&
      now - this.lastPrefabClickAt < WorldScene.DOUBLE_CLICK_MS;
    this.lastPrefabClickKey = clickKey;
    this.lastPrefabClickAt = now;
    this.lastClickTime = now;

    this.clearCombatTarget();
    this.clearInteractTarget();
    this.clearLootTarget();
    this.clearDoorTarget();
    this.clearFireplaceTarget();
    this.clearTreeChopTarget();

    if (this.tryStartPrefabInteract(me, tx, ty)) return true;

    this.prefabTargetTile = { x: tx, y: ty };
    this.prefabSprint = isDoubleClick && (me.stamina ?? 0) > 0;
    const goal = this.doorApproachGoal(me, tx, ty);
    if (goal) {
      this.sendMoveToCoords(goal.x, goal.y, this.prefabSprint);
      this.drawMoveTarget(goal.x, goal.y, this.prefabSprint);
      this.moveTargetFadeUntil = now + 800;
      this.lastPursuitMoveSentAt = now;
    }
    return true;
  }

  private tryStartPrefabInteract(
    me: { x: number; y: number },
    tx: number,
    ty: number,
  ): boolean {
    if (!this.room) return false;
    const mePlayer = this.room.state?.players?.get(this.sessionId);
    if (mePlayer) {
      const prefab = this.findPrefabAt(mePlayer, tx, ty);
      if (prefab?.kind === "fence_corner") return false;
    }
    const ptx = Math.floor(me.x);
    const pty = Math.floor(me.y);
    const adjacent = Math.max(Math.abs(ptx - tx), Math.abs(pty - ty)) <= 1;
    if (!adjacent) return false;

    this.clearPrefabTarget();
    this.stopPlayerMovement();
    const message: ClientMessage = {
      type: "prefabOpen",
      payload: { x: tx, y: ty },
    };
    this.room.send("action", message);
    return true;
  }

  private updatePrefabPursuit() {
    if (!this.prefabTargetTile) return;
    const { x: tx, y: ty } = this.prefabTargetTile;
    const me = this.room?.state?.players?.get(this.sessionId);
    if (!me?.alive) {
      this.clearPrefabTarget();
      return;
    }
    const prefab = this.findPrefabAt(me, tx, ty);
    if (!prefab || prefab.kind === "fence_corner") {
      this.clearPrefabTarget();
      return;
    }
    if (this.tryStartPrefabInteract(me, tx, ty)) return;
    if (this.isBusyWithTimedAction(me)) return;

    const now = Date.now();
    if (now - this.lastPursuitMoveSentAt > 300) {
      const goal = this.doorApproachGoal(me, tx, ty);
      if (!goal) {
        this.clearPrefabTarget();
        return;
      }
      const sprint = this.prefabSprint && me.stamina > 0;
      this.sendMoveToCoords(goal.x, goal.y, sprint);
      this.lastPursuitMoveSentAt = now;
    }
  }

  /**
   * Each frame: highlight + pointer-cursor the tile under the cursor when it
   * holds an un-built prefab, even out of reach (click walks the player up).
   */
  private updatePrefabHover(
    pointer: { x: number; y: number } = this.input.activePointer,
  ) {
    const me = this.room?.state?.players?.get(this.sessionId);
    if (!me || this.isOverlayOpen() || this.chatOpen || this.structureBuildMode) {
      return;
    }

    const worldPt = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const cart = isoToCartesian(worldPt.x, worldPt.y);
    const tx = Math.floor(cart.x);
    const ty = Math.floor(cart.y);

    const prefab = this.findPrefabAt(me, tx, ty);
    if (!prefab || prefab.kind === "fence_corner") return;

    this.game.canvas.style.cursor = "pointer";
    if (me.inInterior) {
      this.interiorView?.highlightTile(tx, ty);
    } else {
      this.tileManager?.highlightInteractionTile(tx, ty);
    }
  }

  private sendFurnaceCraftOpen() {
    const stationId = this.fireplaceUI?.getStationId();
    if (!stationId || !this.room) return;
    const message: ClientMessage = {
      type: "craftOpen",
      payload: { workbenchId: stationId },
    };
    this.room.send("action", message);
  }

  private sendCraftPerform(recipeId: string) {
    if (!this.room || !this.craftUI?.isOpen()) return;
    const workbenchId = this.craftUI.getWorkbenchId();
    if (!workbenchId) return;
    const furnace = this.craftUI.getStation() === "furnace";
    const recipe = getCraftRecipe(recipeId) ?? getDisassemblyRecipe(recipeId);
    const durationMs = recipe
      ? craftDurationForSkill(
          recipe,
          this.localSkillMods().craftDurationScale,
        )
      : CRAFT_DURATION_MS;

    // Soft-close the dialog (no craftClose) so the server can start the channel
    // from the still-open craft session.
    this.craftUI.close();
    document.body.classList.remove("craft-open");

    // Furnace crafts wait for the server. A cold or extinguished fire
    // must not leave a progress bar running.
    if (!furnace) this.beginOptimisticCraft(durationMs);
    const message: ClientMessage = {
      type: "craftPerform",
      payload: { workbenchId, recipeId },
    };
    this.room.send("action", message);
  }

  private updateCraftProximity() {
    if (!this.craftUI?.isOpen() || !this.room) return;
    const workbenchId = this.craftUI.getWorkbenchId();
    if (!workbenchId) return;

    const me = this.room.state.players.get(this.sessionId);
    if (!me?.alive || !me.inInterior) {
      this.closeCraftUI();
      return;
    }

    const searchable = this.searchablesCache.find((s) => s.id === workbenchId);
    if (
      !searchable ||
      searchable.buildingX !== me.buildingX ||
      searchable.buildingY !== me.buildingY ||
      !playerAdjacentToSearchable(me.x, me.y, searchable)
    ) {
      this.closeCraftUI();
    }
  }

  private requestTradeOpen(traderId: string) {
    if (!this.room || !traderId) return;
    if (this.traderUI?.isOpen() && this.traderUI.getTraderId() === traderId) {
      return;
    }
    const message: ClientMessage = {
      type: "tradeOpen",
      payload: { traderId },
    };
    this.room.send("action", message);
  }

  private closeTraderUI() {
    if (!this.traderUI?.isOpen()) return;
    this.traderUI.close();
    if (!this.room) return;
    const message: ClientMessage = { type: "tradeClose" };
    this.room.send("action", message);
  }

  private closePlayerMarketUI() {
    if (!this.playerMarketUI?.isOpen()) return;
    this.playerMarketUI.close();
    if (!this.room) return;
    const message: ClientMessage = { type: "marketClose" };
    this.room.send("action", message);
  }

  private requestMarketOpen(traderId: string) {
    if (!this.room || !traderId) return;
    if (this.playerMarketUI?.isOpen() && this.playerMarketUI.getTraderId() === traderId) {
      return;
    }
    const message: ClientMessage = {
      type: "marketOpen",
      payload: { traderId },
    };
    this.room.send("action", message);
  }

  private sendMarketList(listing: {
    slotIndex: number;
    itemId: string;
    quantity: number;
    price: number;
  }) {
    if (!this.room || !this.playerMarketUI?.isOpen()) return;
    const traderId = this.playerMarketUI.getTraderId();
    if (!traderId) return;
    const message: ClientMessage = {
      type: "marketList",
      payload: { traderId, ...listing },
    };
    this.room.send("action", message);
  }

  private sendMarketListing(
    type: "marketBuy" | "marketCancel" | "marketCollectPayout",
    listingId: number,
  ) {
    if (!this.room || !this.playerMarketUI?.isOpen()) return;
    const traderId = this.playerMarketUI.getTraderId();
    if (!traderId) return;
    const message: ClientMessage = {
      type,
      payload: { traderId, listingId },
    };
    this.room.send("action", message);
  }

  private sendMarketBrowse(browse: { page: number; sort: "new" | "cheap"; query: string }) {
    if (!this.room || !this.playerMarketUI?.isOpen()) return;
    const traderId = this.playerMarketUI.getTraderId();
    if (!traderId) return;
    const message: ClientMessage = {
      type: "marketBrowse",
      payload: { traderId, ...browse },
    };
    this.room.send("action", message);
  }

  private sendMarketCollect() {
    if (!this.room || !this.playerMarketUI?.isOpen()) return;
    const traderId = this.playerMarketUI.getTraderId();
    if (!traderId) return;
    const message: ClientMessage = {
      type: "marketCollect",
      payload: { traderId },
    };
    this.room.send("action", message);
  }

  private applyMarketInventory(payload: {
    inventoryJson: string;
    weaponMagazinesJson: string;
    equippedInventorySlot: number;
    equippedWeaponIndex: number;
    magazineRounds: number;
  }) {
    if (this.localInventorySync) {
      this.localInventorySync = {
        ...this.localInventorySync,
        inventoryJson: payload.inventoryJson,
        weaponMagazinesJson: payload.weaponMagazinesJson,
        equippedInventorySlot: payload.equippedInventorySlot,
        equippedWeaponIndex: payload.equippedWeaponIndex,
        magazineRounds: payload.magazineRounds,
      };
    }
    this.lastInventoryRenderKey = "";
    this.lastHotbarRenderKey = "";
  }

  private openPlayerMarketUI(payload: {
    traderId: string;
    inventoryJson: string;
    weaponMagazinesJson: string;
    equippedInventorySlot: number;
    equippedWeaponIndex: number;
    magazineRounds: number;
    ashenReputation: number;
    listingsJson: string;
    deskJson: string;
    boardPage?: number;
    boardPages?: number;
    boardTotal?: number;
    boardSort?: "new" | "cheap";
    boardQuery?: string;
  }) {
    if (this.inventoryUI?.isOpen()) this.inventoryUI.close();
    if (this.journalUI?.isOpen()) this.journalUI.close();
    if (this.mapOverlayUI?.isOpen()) this.mapOverlayUI.close();
    if (this.containerLootUI?.isOpen()) this.containerLootUI.close();
    if (this.traderUI?.isOpen()) this.closeTraderUI();
    if (this.redOrderDialogUI?.isOpen()) this.closeRedOrderDialog();
    if (this.ashenTraderDialogUI?.isOpen()) this.closeAshenTraderDialog();
    if (this.ashenMilitiaDialogUI?.isOpen()) this.closeAshenMilitiaDialog();
    this.notifyTutorial("visit_traders");
    this.playerMarketUI?.open(payload);
    this.applyMarketInventory(payload);
  }

  private updateMarketProximity() {
    if (!this.playerMarketUI?.isOpen() || !this.room) return;
    const traderId = this.playerMarketUI.getTraderId();
    if (!traderId) return;
    const me = this.room.state.players.get(this.sessionId);
    if (!me?.alive || (me.equippedWeaponIndex ?? -1) >= 0) {
      this.closePlayerMarketUI();
      return;
    }
    const trader = this.guardSprites.get(traderId)?.getData("server") as
      | { x: number; y: number; alive?: boolean; isDead?: boolean }
      | undefined;
    if (
      !trader ||
      trader.alive === false ||
      trader.isDead ||
      !playerNearEntity(me.x, me.y, trader.x, trader.y, this.npcTalkRange(me))
    ) {
      this.closePlayerMarketUI();
    }
  }

  private openTraderUI(payload: {
    traderId: string;
    traderName: string;
    traderBanknotes: number;
    playerBanknotes: number;
    stockJson: string;
    stockCapacity?: number;
    inventoryJson: string;
    ashenReputation?: number;
  }) {
    if (this.inventoryUI?.isOpen()) this.inventoryUI.close();
    if (this.journalUI?.isOpen()) this.journalUI.close();
    if (this.mapOverlayUI?.isOpen()) this.mapOverlayUI.close();
    if (this.containerLootUI?.isOpen()) this.containerLootUI.close();
    if (this.redOrderDialogUI?.isOpen()) this.closeRedOrderDialog();
    if (this.ashenTraderDialogUI?.isOpen()) this.closeAshenTraderDialog();
    if (this.ashenMilitiaDialogUI?.isOpen()) this.closeAshenMilitiaDialog();
    if (this.playerMarketUI?.isOpen()) this.closePlayerMarketUI();
    this.notifyTutorial("visit_traders");
    const me = this.room?.state?.players?.get(this.sessionId);
    this.traderUI?.open({
      ...payload,
      playerName: me?.name ?? "You",
      clothingSkin:
        this.localInventorySync?.clothingSkin ?? me?.clothingSkin ?? 1,
      barterT: this.localSkillMods().barterT,
    });
    if (this.localInventorySync) {
      this.localInventorySync = {
        ...this.localInventorySync,
        inventoryJson: payload.inventoryJson,
      };
    }
  }

  private sendTradeConfirm(
    sells: { slotIndex: number; itemId: string; quantity: number }[],
    buys: { stockIndex: number; itemId: string; quantity: number }[],
  ) {
    if (!this.room || !this.traderUI?.isOpen()) return;
    const traderId = this.traderUI.getTraderId();
    if (!traderId) return;
    if (sells.length === 0 && buys.length === 0) return;
    const message: ClientMessage = {
      type: "tradeConfirm",
      payload: { traderId, sells, buys },
    };
    this.room.send("action", message);
  }

  private updateTraderProximity() {
    if (!this.traderUI?.isOpen() || !this.room) return;
    const traderId = this.traderUI.getTraderId();
    if (!traderId) return;
    const me = this.room.state.players.get(this.sessionId);
    if (!me?.alive || (me.equippedWeaponIndex ?? -1) >= 0) {
      this.closeTraderUI();
      return;
    }
    const trader = this.guardSprites.get(traderId)?.getData("server") as
      | { x: number; y: number; alive?: boolean; isDead?: boolean }
      | undefined;
    if (
      !trader ||
      trader.alive === false ||
      trader.isDead ||
      !playerNearEntity(me.x, me.y, trader.x, trader.y, this.npcTalkRange(me))
    ) {
      this.closeTraderUI();
    }
  }

  private requestDialogOpen(npcId: string) {
    if (!this.room || !npcId) return;
    if (
      (this.redOrderDialogUI?.isOpen() &&
        this.redOrderDialogUI.getNpcId() === npcId) ||
      (this.ashenTraderDialogUI?.isOpen() &&
        this.ashenTraderDialogUI.getNpcId() === npcId) ||
      (this.ashenMilitiaDialogUI?.isOpen() &&
        this.ashenMilitiaDialogUI.getNpcId() === npcId)
    ) {
      return;
    }
    const message: ClientMessage = {
      type: "dialogOpen",
      payload: { npcId },
    };
    this.room.send("action", message);
  }

  private closeRedOrderDialog() {
    if (!this.redOrderDialogUI?.isOpen()) return;
    this.redOrderDialogUI.close();
    if (!this.room) return;
    const message: ClientMessage = { type: "dialogClose" };
    this.room.send("action", message);
  }

  private closeAshenTraderDialog() {
    if (!this.ashenTraderDialogUI?.isOpen()) return;
    this.ashenTraderDialogUI.close();
    if (!this.room) return;
    const message: ClientMessage = { type: "dialogClose" };
    this.room.send("action", message);
  }

  private closeAshenMilitiaDialog() {
    if (!this.ashenMilitiaDialogUI?.isOpen()) return;
    this.ashenMilitiaDialogUI.close();
    if (!this.room) return;
    const message: ClientMessage = { type: "dialogClose" };
    this.room.send("action", message);
  }

  private openNpcDialog(payload: {
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
  }) {
    if (payload.faction === "ashenMilitia") {
      this.openAshenMilitiaDialog(payload);
      return;
    }
    if (payload.faction === "ashenTraders") {
      this.openAshenTraderDialog(payload);
      return;
    }
    this.openRedOrderDialog({
      npcId: payload.npcId,
      npcSkin: payload.npcSkin,
      npcName: payload.npcName,
      playerName: payload.playerName,
      redOrderReputation: payload.redOrderReputation ?? 0,
    });
  }

  private openRedOrderDialog(payload: {
    npcId: string;
    npcSkin: number;
    npcName: string;
    playerName: string;
    redOrderReputation: number;
  }) {
    if (this.inventoryUI?.isOpen()) this.inventoryUI.close();
    if (this.journalUI?.isOpen()) this.journalUI.close();
    if (this.mapOverlayUI?.isOpen()) this.mapOverlayUI.close();
    if (this.containerLootUI?.isOpen()) this.containerLootUI.close();
    if (this.traderUI?.isOpen()) this.closeTraderUI();
    if (this.playerMarketUI?.isOpen()) this.closePlayerMarketUI();
    if (this.ashenTraderDialogUI?.isOpen()) this.closeAshenTraderDialog();
    if (this.ashenMilitiaDialogUI?.isOpen()) this.closeAshenMilitiaDialog();
    this.notifyTutorial("talk_red_order");
    const me = this.room?.state?.players?.get(this.sessionId);
    this.redOrderDialogUI?.open({
      npcId: payload.npcId,
      npcSkin: payload.npcSkin,
      playerName: payload.playerName,
      redOrderReputation: payload.redOrderReputation,
      dogtagCount: this.localDogtagCount(),
      inventoryJson:
        this.localInventorySync?.inventoryJson ?? me?.inventoryJson ?? "[]",
      clothingSkin:
        this.localInventorySync?.clothingSkin ?? me?.clothingSkin ?? 1,
      questsJson: this.localQuestsJson(),
      extraPockets: this.localExtraPockets(),
    });
  }

  private localDogtagCount(): number {
    const me = this.room?.state?.players?.get(this.sessionId);
    const inventoryJson =
      this.localInventorySync?.inventoryJson ?? me?.inventoryJson ?? "[]";
    return countItemInInventory(parseInventory(inventoryJson), "dogtag");
  }

  private sendRedOrderCompleteTask(taskId: string) {
    if (!this.room || !this.redOrderDialogUI?.isOpen()) return;
    const npcId = this.redOrderDialogUI.getNpcId();
    if (!npcId) return;
    const message: ClientMessage = {
      type: "dialogCompleteTask",
      payload: { npcId, taskId },
    };
    this.room.send("action", message);
  }

  private syncRedOrderDialogState() {
    this.syncRedOrderDialogStateWithQuests(this.localQuestsJson());
  }

  private syncAshenMilitiaDialogState() {
    this.syncAshenMilitiaDialogStateWithQuests(this.localQuestsJson());
  }

  private localQuestsJson(): string {
    return this.cachedQuestsJson;
  }

  private openAshenTraderDialog(payload: {
    npcId: string;
    npcKind: number;
    playerName: string;
    ashenReputation?: number;
  }) {
    if (this.inventoryUI?.isOpen()) this.inventoryUI.close();
    if (this.journalUI?.isOpen()) this.journalUI.close();
    if (this.mapOverlayUI?.isOpen()) this.mapOverlayUI.close();
    if (this.containerLootUI?.isOpen()) this.containerLootUI.close();
    if (this.traderUI?.isOpen()) this.closeTraderUI();
    if (this.playerMarketUI?.isOpen()) this.closePlayerMarketUI();
    if (this.redOrderDialogUI?.isOpen()) this.closeRedOrderDialog();
    if (this.ashenMilitiaDialogUI?.isOpen()) this.closeAshenMilitiaDialog();
    this.notifyTutorial("visit_traders");
    const me = this.room?.state?.players?.get(this.sessionId);
    this.ashenTraderDialogUI?.open({
      npcId: payload.npcId,
      npcKind: payload.npcKind,
      playerName: payload.playerName,
      ashenReputation: payload.ashenReputation,
      clothingSkin:
        this.localInventorySync?.clothingSkin ?? me?.clothingSkin ?? 1,
    });
  }

  private openAshenMilitiaDialog(payload: {
    npcId: string;
    npcSkin: number;
    playerName: string;
    ashenReputation?: number;
    ashenMilitiaReputation?: number;
    inInterior?: boolean;
    taskCompletionsJson?: string;
  }) {
    if (this.inventoryUI?.isOpen()) this.inventoryUI.close();
    if (this.journalUI?.isOpen()) this.journalUI.close();
    if (this.mapOverlayUI?.isOpen()) this.mapOverlayUI.close();
    if (this.containerLootUI?.isOpen()) this.containerLootUI.close();
    if (this.traderUI?.isOpen()) this.closeTraderUI();
    if (this.playerMarketUI?.isOpen()) this.closePlayerMarketUI();
    if (this.redOrderDialogUI?.isOpen()) this.closeRedOrderDialog();
    if (this.ashenTraderDialogUI?.isOpen()) this.closeAshenTraderDialog();
    if (isMilitiaDoctorSkin(payload.npcSkin)) this.notifyTutorial("talk_clark");
    if (isMilitiaCaptainSkin(payload.npcSkin)) this.notifyTutorial("talk_davis");
    const me = this.room?.state?.players?.get(this.sessionId);
    const inventoryJson =
      this.localInventorySync?.inventoryJson ?? me?.inventoryJson ?? "[]";
    this.ashenMilitiaDialogUI?.open({
      npcId: payload.npcId,
      npcSkin: payload.npcSkin,
      playerName: payload.playerName,
      ashenMilitiaReputation:
        payload.ashenMilitiaReputation ?? payload.ashenReputation,
      inInterior: payload.inInterior,
      inventoryJson,
      playerHealth: me?.health ?? PLAYER_MAX_HEALTH,
      playerInfected: !!me?.infected,
      taskCompletionsJson: payload.taskCompletionsJson,
      questsJson: this.localQuestsJson(),
      tutorialDone: this.onboardingUI?.isFinished() ?? false,
      clothingSkin:
        this.localInventorySync?.clothingSkin ?? me?.clothingSkin ?? 1,
      doctorHealCost: this.localSkillMods().doctorHealCost,
      extraPockets: this.localExtraPockets(),
    });
  }

  private sendQuestAccept(questId: string, npcId?: string) {
    if (!this.room || !questId || !npcId) return;
    const message: ClientMessage = {
      type: "questAccept",
      payload: { questId, npcId },
    };
    this.room.send("action", message);
  }

  private sendQuestAbandon(questId: string) {
    if (!this.room || !questId) return;
    const message: ClientMessage = {
      type: "questAbandon",
      payload: { questId },
    };
    this.room.send("action", message);
  }

  private sendAshenMilitiaCompleteTask(taskId: string) {
    if (!this.room || !this.ashenMilitiaDialogUI?.isOpen()) return;
    const npcId = this.ashenMilitiaDialogUI.getNpcId();
    if (!npcId) return;
    const message: ClientMessage = {
      type: "dialogCompleteTask",
      payload: { npcId, taskId },
    };
    this.room.send("action", message);
  }

  private sendAshenMilitiaHeal() {
    if (!this.room || !this.ashenMilitiaDialogUI?.isOpen()) return;
    const npcId = this.ashenMilitiaDialogUI.getNpcId();
    if (!npcId) return;
    const message: ClientMessage = {
      type: "dialogHeal",
      payload: { npcId },
    };
    this.room.send("action", message);
  }

  private updateRedOrderDialogProximity() {
    if (!this.redOrderDialogUI?.isOpen() || !this.room) return;
    const npcId = this.redOrderDialogUI.getNpcId();
    if (!npcId) return;
    const me = this.room.state.players.get(this.sessionId);
    if (!me?.alive || (me.equippedWeaponIndex ?? -1) >= 0) {
      this.closeRedOrderDialog();
      return;
    }
    const npc = this.guardSprites.get(npcId)?.getData("server") as
      | {
          x: number;
          y: number;
          alive?: boolean;
          isDead?: boolean;
          inInterior?: boolean;
          buildingX?: number;
          buildingY?: number;
        }
      | undefined;
    if (!npc || npc.alive === false || npc.isDead) {
      this.closeRedOrderDialog();
      return;
    }
    if (me.inInterior || npc.inInterior) {
      if (
        !me.inInterior ||
        !npc.inInterior ||
        me.buildingX !== npc.buildingX ||
        me.buildingY !== npc.buildingY
      ) {
        this.closeRedOrderDialog();
        return;
      }
    }
    if (!playerNearEntity(me.x, me.y, npc.x, npc.y)) {
      this.closeRedOrderDialog();
    }
  }

  private updateAshenTraderDialogProximity() {
    if (!this.ashenTraderDialogUI?.isOpen() || !this.room) return;
    const npcId = this.ashenTraderDialogUI.getNpcId();
    if (!npcId) return;
    const me = this.room.state.players.get(this.sessionId);
    if (!me?.alive || (me.equippedWeaponIndex ?? -1) >= 0) {
      this.closeAshenTraderDialog();
      return;
    }
    const npc = this.guardSprites.get(npcId)?.getData("server") as
      | {
          x: number;
          y: number;
          alive?: boolean;
          isDead?: boolean;
          inInterior?: boolean;
          buildingX?: number;
          buildingY?: number;
        }
      | undefined;
    if (!npc || npc.alive === false || npc.isDead) {
      this.closeAshenTraderDialog();
      return;
    }
    if (me.inInterior || npc.inInterior) {
      if (
        !me.inInterior ||
        !npc.inInterior ||
        me.buildingX !== npc.buildingX ||
        me.buildingY !== npc.buildingY ||
        !isAshenTraderWarehouse(me.buildingX, me.buildingY)
      ) {
        this.closeAshenTraderDialog();
        return;
      }
    }
    if (!playerNearEntity(me.x, me.y, npc.x, npc.y, this.npcTalkRange(me))) {
      this.closeAshenTraderDialog();
    }
  }

  private updateAshenMilitiaDialogProximity() {
    if (!this.ashenMilitiaDialogUI?.isOpen() || !this.room) return;
    const npcId = this.ashenMilitiaDialogUI.getNpcId();
    if (!npcId) return;
    const me = this.room.state.players.get(this.sessionId);
    if (!me?.alive || (me.equippedWeaponIndex ?? -1) >= 0) {
      this.closeAshenMilitiaDialog();
      return;
    }
    const npc = this.guardSprites.get(npcId)?.getData("server") as
      | {
          x: number;
          y: number;
          alive?: boolean;
          isDead?: boolean;
          inInterior?: boolean;
          buildingX?: number;
          buildingY?: number;
        }
      | undefined;
    if (!npc || npc.alive === false || npc.isDead) {
      this.closeAshenMilitiaDialog();
      return;
    }
    if (me.inInterior || npc.inInterior) {
      if (
        !me.inInterior ||
        !npc.inInterior ||
        me.buildingX !== npc.buildingX ||
        me.buildingY !== npc.buildingY
      ) {
        this.closeAshenMilitiaDialog();
        return;
      }
    }
    if (!playerNearEntity(me.x, me.y, npc.x, npc.y)) {
      this.closeAshenMilitiaDialog();
    }
  }

  private takeFromContainer(containerId: string, fromSlot: number, toSlot: number) {
    if (!this.room || !this.containerLootUI?.isOpen()) return;
    if (!containerId) return;

    // Drag clothing into the clothing slot → Wear channel; close loot so the bar shows.
    if (toSlot === CLOTHING_SLOT_INDEX) {
      const me = this.room.state.players.get(this.sessionId);
      if (!me?.alive || this.isBusyWithTimedAction(me)) return;
      this.stopPlayerMovement();
      this.closeDialogsForClothingAction();
      this.beginOptimisticClothingChange(CLOTHING_CHANGE_ACTION_LABELS.wear);
    }

    const message: ClientMessage = {
      type: "takeFromContainer",
      payload: { containerId, fromSlot, toSlot },
    };
    this.room.send("action", message);
    this.lastInventoryRenderKey = "";
    this.lastHotbarRenderKey = "";
  }

  private storeInContainer(containerId: string, fromSlot: number, toSlot: number) {
    if (!this.room || !this.containerLootUI?.isOpen()) return;
    if (!containerId) return;
    const message: ClientMessage = {
      type: "storeInContainer",
      payload: { containerId, fromSlot, toSlot },
    };
    this.room.send("action", message);
    this.lastInventoryRenderKey = "";
    this.lastHotbarRenderKey = "";
  }

  private moveInContainer(containerId: string, fromSlot: number, toSlot: number) {
    if (!this.room || !this.containerLootUI?.isOpen()) return;
    if (!containerId) return;
    const message: ClientMessage = {
      type: "moveInContainer",
      payload: { containerId, fromSlot, toSlot },
    };
    this.room.send("action", message);
  }

  private updateContainerLootProximity() {
    if (!this.containerLootUI?.isOpen() || !this.room) return;
    const ids = this.containerLootUI.getContainerIds();
    if (ids.length === 0) {
      this.containerLootUI.close();
      return;
    }

    const me = this.room.state.players.get(this.sessionId);
    if (!me) {
      this.containerLootUI.close();
      return;
    }
    if (ids.some((id) => this.lootPileStillNear(me, id))) return;
    this.containerLootUI.close();
  }

  private lootPileStillNear(
    me: {
      x: number;
      y: number;
      inInterior: boolean;
      buildingX: number;
      buildingY: number;
    },
    containerId: string,
  ): boolean {
    const storageBox = this.findStorageBoxById(me, containerId);
    if (storageBox) {
      const ptx = Math.floor(me.x);
      const pty = Math.floor(me.y);
      return Math.max(Math.abs(ptx - storageBox.x), Math.abs(pty - storageBox.y)) <= 1;
    }

    const searchable = this.searchablesCache.find((s) => s.id === containerId);
    if (searchable) {
      const overworldBag = searchable.buildingX === OVERWORLD_BAG_BUILDING;
      if (overworldBag) {
        return !me.inInterior && playerAdjacentToSearchable(me.x, me.y, searchable);
      }
      return (
        me.inInterior &&
        searchable.buildingX === me.buildingX &&
        searchable.buildingY === me.buildingY &&
        playerAdjacentToSearchable(me.x, me.y, searchable)
      );
    }

    const room = this.room;
    if (!room) return false;

    const zombie = room.state.zombies.get(containerId);
    if (zombie) {
      return (
        zombie.isDead &&
        !zombie.looted &&
        me.inInterior === zombie.inInterior &&
        (!me.inInterior ||
          (me.buildingX === zombie.buildingX && me.buildingY === zombie.buildingY)) &&
        playerNearEntity(me.x, me.y, zombie.x, zombie.y)
      );
    }

    const guard = room.state.guards.get(containerId);
    if (guard) {
      return (
        !guard.alive &&
        !guard.looted &&
        me.inInterior === !!guard.inInterior &&
        (!me.inInterior ||
          (me.buildingX === guard.buildingX && me.buildingY === guard.buildingY)) &&
        playerNearEntity(me.x, me.y, guard.x, guard.y)
      );
    }

    const corpse = room.state.corpses?.get(containerId);
    const corpseData =
      corpse ??
      (this.corpseSprites.get(containerId)?.getData("server") as
        | {
            x: number;
            y: number;
            looted?: boolean;
            inInterior?: boolean;
            buildingX?: number;
            buildingY?: number;
          }
        | undefined);
    if (corpseData) {
      return (
        !corpseData.looted &&
        me.inInterior === !!corpseData.inInterior &&
        (!me.inInterior ||
          (me.buildingX === corpseData.buildingX &&
            me.buildingY === corpseData.buildingY)) &&
        playerNearEntity(me.x, me.y, corpseData.x, corpseData.y)
      );
    }

    const wolf = room.state.coywolves?.get(containerId);
    const wolfData =
      wolf ??
      (this.coywolfSprites.get(containerId)?.getData("server") as
        | { x: number; y: number; isDead?: boolean; looted?: boolean }
        | undefined);
    if (wolfData) {
      return (
        !!wolfData.isDead &&
        !wolfData.looted &&
        !me.inInterior &&
        playerNearEntity(me.x, me.y, wolfData.x, wolfData.y)
      );
    }

    const bear = room.state.bears?.get(containerId);
    const bearData =
      bear ??
      (this.bearSprites.get(containerId)?.getData("server") as
        | { x: number; y: number; isDead?: boolean; looted?: boolean }
        | undefined);
    if (bearData) {
      return (
        !!bearData.isDead &&
        !bearData.looted &&
        !me.inInterior &&
        playerNearEntity(me.x, me.y, bearData.x, bearData.y)
      );
    }

    const crow = room.state.crows?.get(containerId);
    const crowData =
      crow ??
      (this.crowSprites.get(containerId)?.getData("server") as
        | { x: number; y: number; isDead?: boolean; looted?: boolean }
        | undefined);
    if (crowData) {
      return (
        !!crowData.isDead &&
        !crowData.looted &&
        !me.inInterior &&
        playerNearEntity(me.x, me.y, crowData.x, crowData.y)
      );
    }

    return false;
  }

  private activateHotbarSlot(hotbarIndex: number) {
    if (!this.room) return;
    const me = this.room.state.players.get(this.sessionId);
    if (!me) return;

    const inventoryJson =
      this.localInventorySync?.inventoryJson ?? me.inventoryJson;
    const equippedSlot =
      this.localInventorySync?.equippedInventorySlot ??
      me.equippedInventorySlot ??
      -1;
    const inventory = parseInventory(inventoryJson);
    const slot = inventory[hotbarIndex];
    if (!slot) return;

    const weaponIndex = weaponIndexFromItemId(slot.id);
    if (weaponIndex < 0) return;

    if (equippedSlot === hotbarIndex) {
      this.unequipWeapon();
    } else {
      this.equipWeaponBySlot(hotbarIndex);
    }
  }

  private sendConsumeStart(slotIndex: number) {
    if (!this.room) return;
    const me = this.room.state.players.get(this.sessionId);
    if (!me || this.isBusyWithTimedAction(me)) return;

    const inventoryJson =
      this.localInventorySync?.inventoryJson ?? me.inventoryJson;
    const inventory = parseInventory(inventoryJson);
    const slot = inventory[slotIndex];
    if (!slot) return;

    const def = getItemDefinition(slot.id);
    if (!def?.consumeDurationMs) return;

    if (
      !canUseConsumable(slot.id, {
        health: me.health,
        hunger: me.hunger,
        thirst: me.thirst,
        maxHealth: playerMaxHealthFromInfection(me.infection ?? 0, !!me.infected),
        maxHunger: HUNGER_MAX,
        maxThirst: THIRST_MAX,
        infected: !!me.infected,
      })
    ) {
      return;
    }

    this.consumeActionLabel = CONSUME_ACTION_LABELS[getConsumeAction(slot.id)];
    const durationMs = getItemDefinition(slot.id)?.consumeDurationMs ?? 2000;
    this.beginOptimisticConsume(durationMs, this.consumeActionLabel);
    AudioManager.get().playConsume(slot.id);

    const msg: ClientMessage = { type: "consumeStart", payload: { slotIndex } };
    this.room.send("action", msg);
  }

  private sendUnloadStart(slotIndex: number) {
    if (!this.room) return;
    const me = this.room.state.players.get(this.sessionId);
    if (!me?.alive || this.isBusyWithTimedAction(me)) return;
    if (me.anim === "run") return;

    const sync = this.localInventorySync;
    const inventory = parseInventory(sync?.inventoryJson ?? me.inventoryJson);
    const slot = inventory[slotIndex];
    if (!slot) return;
    const ammoType = getAmmoTypeForWeapon(slot.id);
    if (!ammoType) return;

    const magazinesJson =
      sync?.weaponMagazinesJson ?? me.weaponMagazinesJson ?? "{}";
    const equippedSlot =
      sync?.equippedInventorySlot ?? me.equippedInventorySlot ?? -1;
    const liveRounds =
      sync && !me.isReloading
        ? Math.max(me.magazineRounds, sync.magazineRounds)
        : me.magazineRounds;
    const rounds =
      slotIndex === equippedSlot
        ? Math.max(0, Math.floor(liveRounds))
        : (getStoredMagazineRounds(
            parseWeaponMagazines(magazinesJson),
            slotIndex,
          ) ?? 0);
    if (rounds <= 0) return;
    if (!canAddToInventory(inventory, ammoType, rounds, this.localExtraPockets())) return;

    this.beginLocalTimedAction("unload", UNLOAD_DURATION_MS, "Unloading", true);
    AudioManager.get().playUnload(slot.id);
    const msg: ClientMessage = { type: "unloadStart", payload: { slotIndex } };
    this.room.send("action", msg);
  }
}

function isFirearmItemId(itemId: string): boolean {
  const weapon = WEAPONS.find((entry) => entry.itemId === itemId);
  return !!weapon && !isMeleeWeapon(weapon);
}

function firstSweepStateOf(state: PlayerQuestsState): FirstSweepState {
  const q = state.quests[QUEST_ID_FIRST_SWEEP];
  if (!q) return "none";
  if (q.status === "completed" || (q.timesCompleted ?? 0) > 0) return "done";
  if (q.status !== "active") return "none";
  return (q.progress.clear_house ?? 0) >= 1 ? "cleared" : "active";
}
