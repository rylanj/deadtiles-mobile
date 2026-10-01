import { isStructureBuildKind, type StructureBuildKind } from "./buildCosts.js";
import { MARKET_PRICE_MAX } from "./playerMarket.js";
import { COOK_SLOT_COUNT, isRawMeat } from "./cooking.js";
import type { FreeAimSurface } from "./combat.js";
import {
  isStructureFenceFacing,
  type StructureFenceCorner,
  type StructureFenceFacing,
} from "./structureFence.js";

export type MoveToMessage = {
  /** World-grid X coordinate of the destination tile (integer or tile-centre). */
  targetX: number;
  /** World-grid Y coordinate of the destination tile. */
  targetY: number;
  /** When true the player sprints (double-click). */
  sprint?: boolean;
  /**
   * Halt path-following only (e.g. before firing). Must not trigger building
   * exit when the player is already standing on the interior exit tile.
   */
  stopOnly?: boolean;
  /** When true, append to the current path instead of replacing it (Shift+click). */
  queue?: boolean;
};

export type AttackMessage = {
  targetId: string;
};

export type FireMessage = {
  targetX: number;
  targetY: number;
  /** When set, the shot only registers if this entity is hit (click-to-target). */
  targetId?: string;
  /** Which of the 3 per-gun shot files to play (0–2). Echoed so every client hears the same take. */
  sfxVariant?: number;
};

export type SearchMessage = {
  searchableId: string;
};

export type LootZombieMessage = {
  zombieId: string;
};

export type LootCoyoteMessage = {
  coywolfId: string;
};

export type LootBearMessage = {
  bearId: string;
};

export type LootGuardMessage = {
  guardId: string;
};

export type LootPlayerMessage = {
  corpseId: string;
};

export type EquipWeaponMessage = {
  /** Inventory slot to equip, or -1 to unequip. */
  slotIndex: number;
};

export type EquipClothingMessage = {
  /** Inventory slot to wear, or -1 to remove. */
  slotIndex: number;
};

export type DropItemMessage = {
  slotIndex: number;
  quantity?: number;
};

export type MoveInventorySlotMessage = {
  fromSlot: number;
  toSlot: number;
  /** Move half the stack onto a slot that already holds the same item. */
  splitHalf?: boolean;
};

export type TakeFromContainerMessage = {
  /** Furniture searchable id, zombie id, or guard id. */
  containerId: string;
  fromSlot: number;
  toSlot: number;
};

export type MoveInContainerMessage = {
  /** Furniture searchable id, zombie id, or guard id. */
  containerId: string;
  fromSlot: number;
  toSlot: number;
};

/** Move a player stack into a storage box (or swap with the box slot). */
export type StoreInContainerMessage = {
  containerId: string;
  fromSlot: number;
  toSlot: number;
};

export type ChatMessage = {
  text: string;
  /** Global (default) or radio party channel. */
  channel?: "global" | "radio";
};

export type ConsumeStartMessage = { slotIndex: number };

export type TradeOpenMessage = {
  traderId: string;
};

export type TradeOfferSellLineMessage = {
  slotIndex: number;
  itemId: string;
  quantity: number;
};

export type TradeOfferBuyLineMessage = {
  stockIndex: number;
  itemId: string;
  quantity: number;
};

/** Confirm a pending multi-line trade offer (net cash settlement). */
export type TradeConfirmMessage = {
  traderId: string;
  sells: TradeOfferSellLineMessage[];
  buys: TradeOfferBuyLineMessage[];
};

/** Open the Birchport player board at the market trader. */
export type MarketOpenMessage = {
  traderId: string;
};

/** Escrow a stack onto the player board. Price is the whole listing, in banknotes. */
export type MarketListMessage = {
  traderId: string;
  slotIndex: number;
  itemId: string;
  quantity: number;
  price: number;
};

export type MarketListingIdMessage = {
  traderId: string;
  listingId: number;
};

export type MarketCollectMessage = {
  traderId: string;
};

export type MarketBrowseMessage = {
  traderId: string;
  page: number;
  sort: "new" | "cheap";
  query: string;
};

/** Authoritative player-board snapshot. Listings and the desk are JSON. */
export type MarketStatePayload = {
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
  /** Search text this page was built from. */
  boardQuery?: string;
  /** Close the market dialog after this snapshot. */
  close?: boolean;
};

/** Open a talk dialog with a Red Order NPC. */
export type DialogOpenMessage = {
  npcId: string;
};

/** Complete a Red Order dialog task (e.g. Ashen dog-tag turn-in). */
export type DialogCompleteTaskMessage = {
  npcId: string;
  taskId: string;
};

/** Pay Doctor Clark for a full heal while talking. */
export type DialogHealMessage = {
  npcId: string;
};

/** Open craft UI at a workbench (or other craft station). */
export type CraftOpenMessage = {
  workbenchId: string;
};

/** Perform a craft recipe at the open workbench. */
export type CraftPerformMessage = {
  workbenchId: string;
  recipeId: string;
};

/** Admin /build mode — place a temporary interior partition wall. */
export type PlaceTempWallMessage = {
  x: number;
  y: number;
};

/** Lite base-building — place a persistent player-owned wall, door, fireplace, or fence. */
export type PlaceStructureMessage = {
  x: number;
  y: number;
  kind: StructureBuildKind;
};

/** Open deconstruct confirm UI on an owned solid structure. */
export type DeconstructOpenMessage = {
  x: number;
  y: number;
};

/** Start the 30s deconstruct channel. */
export type DeconstructStartMessage = {
  x: number;
  y: number;
};

/** Open/close a door the player is adjacent to (unlocked, or already open). */
export type ToggleDoorMessage = {
  x: number;
  y: number;
};

/** Owner sets or clears a numeric code lock on their door (null clears it). */
export type SetDoorCodeMessage = {
  x: number;
  y: number;
  code: string | null;
};

/** Attempt to open a locked door with a candidate code. */
export type EnterDoorCodeMessage = {
  x: number;
  y: number;
  code: string;
};

/** Open the Fireplace1 fuel dialog at a structure tile. */
export type FireplaceOpenMessage = {
  x: number;
  y: number;
};

/** Open a player-built storage box at a structure tile. */
export type StorageBoxOpenMessage = {
  x: number;
  y: number;
};

/** Add one wood to the open Fireplace1. */
export type FireplaceAddWoodMessage = {
  x: number;
  y: number;
};

/** Light an inactive Fireplace1 that already has fuel (requires lighter). */
export type FireplaceLightMessage = {
  x: number;
  y: number;
};

/** Place one raw meat into an empty cook slot, or take the piece already there. */
export type FireplaceCookMessage = {
  x: number;
  y: number;
  slot: number;
  /** Raw meat to place. Omitted on take, and on a click that uses the first raw stack. */
  itemId?: string;
};

/** Extinguish an active Fireplace1 (wood + partial burn time preserved). */
export type FireplaceExtinguishMessage = {
  x: number;
  y: number;
};

/** Chop a standing overworld tree with an equipped hatchet. */
export type ChopTreeMessage = {
  x: number;
  y: number;
};

/** Hold / release firearm aim stance (CTRL). */
export type AimMessage = {
  aiming: boolean;
};

/** 8-way facing while CTRL-aiming (mouse look). */
export type AimLookMessage = {
  facing: number;
};

/** Accept a quest from the NPC currently offering it. */
export type QuestAcceptMessage = {
  questId: string;
  npcId: string;
};

/** Abandon an active quest. */
export type QuestAbandonMessage = {
  questId: string;
};

/** Set in-game radio channel (1–99). 0 clears. */
export type RadioSetChannelMessage = {
  channel: number;
};

/** Mark a tutorial step complete (or skip all when done=true / mark seen). */
export type TutorialCompleteStepMessage = {
  stepId?: string;
  done?: boolean;
  /** Coach was shown once — do not auto-open again on reconnect. */
  seen?: boolean;
};

/** Place a ghost prefab (no collision until built). */
export type PlacePrefabMessage = {
  x: number;
  y: number;
  kind: StructureBuildKind;
  /** Fence panel facing. Ignored for other kinds. */
  facing?: StructureFenceFacing;
};

/** Open prefab deposit UI at a tile. */
export type PrefabOpenMessage = {
  x: number;
  y: number;
};

/** Deposit one unit of an item into a prefab. */
export type PrefabDepositMessage = {
  x: number;
  y: number;
  itemId: string;
  quantity?: number;
};

/** Start the 30s build channel on a funded prefab. */
export type PrefabStartBuildMessage = {
  x: number;
  y: number;
};

/** Cancel a prefab and spill deposited materials. */
export type PrefabCancelMessage = {
  x: number;
  y: number;
};

export type ClientMessage =
  | { type: "moveTo"; payload: MoveToMessage }
  | { type: "attack"; payload: AttackMessage }
  | { type: "fire"; payload: FireMessage }
  | { type: "aim"; payload: AimMessage }
  | { type: "aimLook"; payload: AimLookMessage }
  | { type: "reloadStart" }
  | { type: "reloadCancel" }
  | { type: "unloadStart"; payload: ConsumeStartMessage }
  | { type: "unloadCancel" }
  | { type: "searchStart"; payload: SearchMessage }
  | { type: "searchCancel" }
  | { type: "lootZombieStart"; payload: LootZombieMessage }
  | { type: "lootCoyoteStart"; payload: LootCoyoteMessage }
  | { type: "lootBearStart"; payload: LootBearMessage }
  | { type: "lootGuardStart"; payload: LootGuardMessage }
  | { type: "lootPlayerStart"; payload: LootPlayerMessage }
  | { type: "equipWeapon"; payload: EquipWeaponMessage }
  | { type: "equipClothing"; payload: EquipClothingMessage }
  | { type: "clothingCancel" }
  | { type: "dropItem"; payload: DropItemMessage }
  | { type: "moveInventorySlot"; payload: MoveInventorySlotMessage }
  | { type: "takeFromContainer"; payload: TakeFromContainerMessage }
  | { type: "moveInContainer"; payload: MoveInContainerMessage }
  | { type: "storeInContainer"; payload: StoreInContainerMessage }
  | { type: "consumeStart"; payload: ConsumeStartMessage }
  | { type: "consumeCancel" }
  | { type: "tradeOpen"; payload: TradeOpenMessage }
  | { type: "tradeConfirm"; payload: TradeConfirmMessage }
  | { type: "tradeClose" }
  | { type: "marketOpen"; payload: MarketOpenMessage }
  | { type: "marketList"; payload: MarketListMessage }
  | { type: "marketBuy"; payload: MarketListingIdMessage }
  | { type: "marketCancel"; payload: MarketListingIdMessage }
  | { type: "marketCollect"; payload: MarketCollectMessage }
  | { type: "marketCollectPayout"; payload: MarketListingIdMessage }
  | { type: "marketBrowse"; payload: MarketBrowseMessage }
  | { type: "marketClose" }
  | { type: "dialogOpen"; payload: DialogOpenMessage }
  | { type: "dialogCompleteTask"; payload: DialogCompleteTaskMessage }
  | { type: "dialogHeal"; payload: DialogHealMessage }
  | { type: "dialogClose" }
  | { type: "craftOpen"; payload: CraftOpenMessage }
  | { type: "craftPerform"; payload: CraftPerformMessage }
  | { type: "craftClose" }
  | { type: "craftCancel" }
  | { type: "buildCancel" }
  | { type: "chopTreeCancel" }
  | { type: "fireplaceOpen"; payload: FireplaceOpenMessage }
  | { type: "storageBoxOpen"; payload: StorageBoxOpenMessage }
  | { type: "fireplaceAddWood"; payload: FireplaceAddWoodMessage }
  | { type: "fireplaceLight"; payload: FireplaceLightMessage }
  | { type: "fireplaceExtinguish"; payload: FireplaceExtinguishMessage }
  | { type: "fireplaceCook"; payload: FireplaceCookMessage }
  | { type: "fireplaceClose" }
  | { type: "chopTree"; payload: ChopTreeMessage }
  | { type: "placeTempWall"; payload: PlaceTempWallMessage }
  | { type: "toggleStructureBuild" }
  | { type: "placeStructure"; payload: PlaceStructureMessage }
  | { type: "deconstructOpen"; payload: DeconstructOpenMessage }
  | { type: "deconstructStart"; payload: DeconstructStartMessage }
  | { type: "deconstructClose" }
  | { type: "toggleDoor"; payload: ToggleDoorMessage }
  | { type: "setDoorCode"; payload: SetDoorCodeMessage }
  | { type: "enterDoorCode"; payload: EnterDoorCodeMessage }
  | { type: "enterBarracksBargate" }
  | { type: "questAccept"; payload: QuestAcceptMessage }
  | { type: "questAbandon"; payload: QuestAbandonMessage }
  | { type: "radioSetChannel"; payload: RadioSetChannelMessage }
  | { type: "tutorialCompleteStep"; payload: TutorialCompleteStepMessage }
  | { type: "placePrefab"; payload: PlacePrefabMessage }
  | { type: "prefabOpen"; payload: PrefabOpenMessage }
  | { type: "prefabDeposit"; payload: PrefabDepositMessage }
  | { type: "prefabStartBuild"; payload: PrefabStartBuildMessage }
  | { type: "prefabCancel"; payload: PrefabCancelMessage }
  | { type: "prefabClose" }
  | { type: "clientReady" }
  | { type: "respawn" }
  | { type: "chat"; payload: ChatMessage };

const NO_PAYLOAD_TYPES = new Set([
  "reloadStart",
  "reloadCancel",
  "unloadCancel",
  "searchCancel",
  "consumeCancel",
  "clothingCancel",
  "craftCancel",
  "buildCancel",
  "chopTreeCancel",
  "tradeClose",
  "marketClose",
  "dialogClose",
  "craftClose",
  "fireplaceClose",
  "prefabClose",
  "deconstructClose",
  "toggleStructureBuild",
  "enterBarracksBargate",
  "clientReady",
  "respawn",
]);

function isFiniteNum(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

function isIntInRange(n: unknown, min: number, max: number): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= min && n <= max;
}

function isIdString(n: unknown): n is string {
  return typeof n === "string" && n.length > 0 && n.length <= 128;
}

/**
 * Validate a raw Colyseus action payload before handlers run.
 * Returns a typed message or null when shape/types are invalid.
 */
export function parseClientActionMessage(raw: unknown): ClientMessage | null {
  if (!raw || typeof raw !== "object") return null;
  const msg = raw as { type?: unknown; payload?: unknown };
  if (typeof msg.type !== "string") return null;
  const type = msg.type;
  const payload = msg.payload;

  if (NO_PAYLOAD_TYPES.has(type)) {
    return { type } as ClientMessage;
  }

  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;

  switch (type) {
    case "moveTo": {
      if (!isFiniteNum(p.targetX) || !isFiniteNum(p.targetY)) return null;
      if (Math.abs(p.targetX) > 1e7 || Math.abs(p.targetY) > 1e7) return null;
      return {
        type,
        payload: {
          targetX: p.targetX,
          targetY: p.targetY,
          sprint: p.sprint === true,
          stopOnly: p.stopOnly === true,
          queue: p.queue === true,
        },
      };
    }
    case "fire": {
      if (!isFiniteNum(p.targetX) || !isFiniteNum(p.targetY)) return null;
      if (Math.abs(p.targetX) > 1e7 || Math.abs(p.targetY) > 1e7) return null;
      const targetId =
        p.targetId === undefined
          ? undefined
          : isIdString(p.targetId)
            ? p.targetId
            : null;
      if (targetId === null) return null;
      const sfxVariant = isIntInRange(p.sfxVariant, 0, 2)
        ? p.sfxVariant
        : undefined;
      return {
        type,
        payload: { targetX: p.targetX, targetY: p.targetY, targetId, sfxVariant },
      };
    }
    case "aim": {
      return { type, payload: { aiming: p.aiming === true } };
    }
    case "aimLook": {
      if (!isIntInRange(p.facing, 0, 7)) return null;
      return { type, payload: { facing: p.facing } };
    }
    case "attack": {
      if (!isIdString(p.targetId)) return null;
      return { type, payload: { targetId: p.targetId } };
    }
    case "searchStart": {
      if (!isIdString(p.searchableId)) return null;
      return { type, payload: { searchableId: p.searchableId } };
    }
    case "lootZombieStart": {
      if (!isIdString(p.zombieId)) return null;
      return { type, payload: { zombieId: p.zombieId } };
    }
    case "lootCoyoteStart": {
      if (!isIdString(p.coywolfId)) return null;
      return { type, payload: { coywolfId: p.coywolfId } };
    }
    case "lootBearStart": {
      if (!isIdString(p.bearId)) return null;
      return { type, payload: { bearId: p.bearId } };
    }
    case "lootGuardStart": {
      if (!isIdString(p.guardId)) return null;
      return { type, payload: { guardId: p.guardId } };
    }
    case "lootPlayerStart": {
      if (!isIdString(p.corpseId)) return null;
      return { type, payload: { corpseId: p.corpseId } };
    }
    case "equipWeapon": {
      if (!isIntInRange(p.slotIndex, -1, 63)) return null;
      return { type, payload: { slotIndex: p.slotIndex } };
    }
    case "equipClothing": {
      if (!isIntInRange(p.slotIndex, -1, 63)) return null;
      return { type, payload: { slotIndex: p.slotIndex } };
    }
    case "consumeStart":
    case "unloadStart": {
      if (!isIntInRange(p.slotIndex, 0, 63)) return null;
      return { type, payload: { slotIndex: p.slotIndex } };
    }
    case "dropItem": {
      if (!isIntInRange(p.slotIndex, 0, 63)) return null;
      if (
        p.quantity !== undefined &&
        !isIntInRange(p.quantity, 1, 100_000)
      ) {
        return null;
      }
      return {
        type,
        payload: {
          slotIndex: p.slotIndex,
          quantity: typeof p.quantity === "number" ? p.quantity : undefined,
        },
      };
    }
    case "moveInventorySlot": {
      if (!isIntInRange(p.fromSlot, 0, 63) || !isIntInRange(p.toSlot, 0, 63)) {
        return null;
      }
      if (p.splitHalf !== undefined && p.splitHalf !== true) return null;
      return {
        type,
        payload: {
          fromSlot: p.fromSlot,
          toSlot: p.toSlot,
          ...(p.splitHalf === true ? { splitHalf: true as const } : {}),
        },
      };
    }
    case "takeFromContainer":
    case "moveInContainer":
    case "storeInContainer": {
      if (!isIdString(p.containerId)) return null;
      if (!isIntInRange(p.fromSlot, 0, 63) || !isIntInRange(p.toSlot, 0, 63)) {
        return null;
      }
      return {
        type,
        payload: {
          containerId: p.containerId,
          fromSlot: p.fromSlot,
          toSlot: p.toSlot,
        },
      };
    }
    case "tradeOpen": {
      if (!isIdString(p.traderId)) return null;
      return { type, payload: { traderId: p.traderId } };
    }
    case "marketOpen":
    case "marketCollect": {
      if (!isIdString(p.traderId)) return null;
      return { type, payload: { traderId: p.traderId } };
    }
    case "marketList": {
      if (!isIdString(p.traderId) || !isIdString(p.itemId)) return null;
      if (!isIntInRange(p.slotIndex, 0, 63)) return null;
      if (!isIntInRange(p.quantity, 1, 100_000)) return null;
      if (!isIntInRange(p.price, 1, MARKET_PRICE_MAX)) return null;
      return {
        type,
        payload: {
          traderId: p.traderId,
          slotIndex: p.slotIndex,
          itemId: p.itemId,
          quantity: p.quantity,
          price: p.price,
        },
      };
    }
    case "marketBrowse": {
      if (!isIdString(p.traderId)) return null;
      if (!isIntInRange(p.page, 0, 10_000)) return null;
      if (p.sort !== "new" && p.sort !== "cheap") return null;
      if (typeof p.query !== "string" || p.query.length > 40) return null;
      return {
        type,
        payload: {
          traderId: p.traderId,
          page: p.page,
          sort: p.sort,
          query: p.query,
        },
      };
    }
    case "marketBuy":
    case "marketCancel":
    case "marketCollectPayout": {
      if (!isIdString(p.traderId)) return null;
      if (!isIntInRange(p.listingId, 1, 2_000_000_000)) return null;
      return {
        type,
        payload: { traderId: p.traderId, listingId: p.listingId },
      };
    }
    case "tradeConfirm": {
      if (!isIdString(p.traderId)) return null;
      if (!Array.isArray(p.sells) || !Array.isArray(p.buys)) return null;
      if (p.sells.length > 64 || p.buys.length > 64) return null;
      const sells: TradeOfferSellLineMessage[] = [];
      for (const raw of p.sells) {
        if (!raw || typeof raw !== "object") return null;
        const line = raw as Record<string, unknown>;
        if (!isIntInRange(line.slotIndex, 0, 63)) return null;
        if (!isIdString(line.itemId)) return null;
        if (!isIntInRange(line.quantity, 1, 100_000)) return null;
        sells.push({
          slotIndex: line.slotIndex,
          itemId: line.itemId,
          quantity: line.quantity,
        });
      }
      const buys: TradeOfferBuyLineMessage[] = [];
      for (const raw of p.buys) {
        if (!raw || typeof raw !== "object") return null;
        const line = raw as Record<string, unknown>;
        if (!isIntInRange(line.stockIndex, 0, 10_000)) return null;
        if (!isIdString(line.itemId)) return null;
        if (!isIntInRange(line.quantity, 1, 100_000)) return null;
        buys.push({
          stockIndex: line.stockIndex,
          itemId: line.itemId,
          quantity: line.quantity,
        });
      }
      if (sells.length === 0 && buys.length === 0) return null;
      return {
        type,
        payload: { traderId: p.traderId, sells, buys },
      };
    }
    case "dialogOpen": {
      if (!isIdString(p.npcId)) return null;
      return { type, payload: { npcId: p.npcId } };
    }
    case "dialogCompleteTask": {
      if (!isIdString(p.npcId) || !isIdString(p.taskId)) return null;
      return { type, payload: { npcId: p.npcId, taskId: p.taskId } };
    }
    case "dialogHeal": {
      if (!isIdString(p.npcId)) return null;
      return { type, payload: { npcId: p.npcId } };
    }
    case "craftOpen": {
      if (!isIdString(p.workbenchId)) return null;
      return { type, payload: { workbenchId: p.workbenchId } };
    }
    case "craftPerform": {
      if (!isIdString(p.workbenchId) || !isIdString(p.recipeId)) return null;
      return {
        type,
        payload: { workbenchId: p.workbenchId, recipeId: p.recipeId },
      };
    }
    case "placeTempWall": {
      if (!isFiniteNum(p.x) || !isFiniteNum(p.y)) return null;
      if (!Number.isInteger(p.x) || !Number.isInteger(p.y)) return null;
      if (Math.abs(p.x) > 1e7 || Math.abs(p.y) > 1e7) return null;
      return { type, payload: { x: p.x, y: p.y } };
    }
    case "placeStructure": {
      if (!isFiniteNum(p.x) || !isFiniteNum(p.y)) return null;
      if (!Number.isInteger(p.x) || !Number.isInteger(p.y)) return null;
      if (Math.abs(p.x) > 1e7 || Math.abs(p.y) > 1e7) return null;
      if (!isStructureBuildKind(p.kind)) return null;
      return { type, payload: { x: p.x, y: p.y, kind: p.kind } };
    }
    case "deconstructOpen":
    case "deconstructStart": {
      if (!isFiniteNum(p.x) || !isFiniteNum(p.y)) return null;
      if (!Number.isInteger(p.x) || !Number.isInteger(p.y)) return null;
      if (Math.abs(p.x) > 1e7 || Math.abs(p.y) > 1e7) return null;
      return { type, payload: { x: p.x, y: p.y } };
    }
    case "toggleDoor": {
      if (!isFiniteNum(p.x) || !isFiniteNum(p.y)) return null;
      if (!Number.isInteger(p.x) || !Number.isInteger(p.y)) return null;
      if (Math.abs(p.x) > 1e7 || Math.abs(p.y) > 1e7) return null;
      return { type, payload: { x: p.x, y: p.y } };
    }
    case "setDoorCode": {
      if (!isFiniteNum(p.x) || !isFiniteNum(p.y)) return null;
      if (!Number.isInteger(p.x) || !Number.isInteger(p.y)) return null;
      let code: string | null = null;
      if (p.code !== null) {
        if (typeof p.code !== "string" || !/^[0-9]{4,8}$/.test(p.code)) return null;
        code = p.code;
      }
      return { type, payload: { x: p.x, y: p.y, code } };
    }
    case "enterDoorCode": {
      if (!isFiniteNum(p.x) || !isFiniteNum(p.y)) return null;
      if (!Number.isInteger(p.x) || !Number.isInteger(p.y)) return null;
      if (typeof p.code !== "string" || !/^[0-9]{4,8}$/.test(p.code)) return null;
      return { type, payload: { x: p.x, y: p.y, code: p.code } };
    }
    case "fireplaceCook": {
      if (!isFiniteNum(p.x) || !isFiniteNum(p.y)) return null;
      if (!Number.isInteger(p.x) || !Number.isInteger(p.y)) return null;
      if (Math.abs(p.x) > 1e7 || Math.abs(p.y) > 1e7) return null;
      if (!isIntInRange(p.slot, 0, COOK_SLOT_COUNT - 1)) return null;
      if (p.itemId != null && (typeof p.itemId !== "string" || !isRawMeat(p.itemId))) {
        return null;
      }
      return {
        type,
        payload: {
          x: p.x,
          y: p.y,
          slot: p.slot,
          ...(typeof p.itemId === "string" ? { itemId: p.itemId } : {}),
        },
      };
    }
    case "fireplaceOpen":
    case "storageBoxOpen":
    case "fireplaceAddWood":
    case "fireplaceLight":
    case "fireplaceExtinguish":
    case "chopTree":
    case "prefabOpen":
    case "prefabStartBuild":
    case "prefabCancel": {
      if (!isFiniteNum(p.x) || !isFiniteNum(p.y)) return null;
      if (!Number.isInteger(p.x) || !Number.isInteger(p.y)) return null;
      if (Math.abs(p.x) > 1e7 || Math.abs(p.y) > 1e7) return null;
      return { type, payload: { x: p.x, y: p.y } };
    }
    case "placePrefab": {
      if (!isFiniteNum(p.x) || !isFiniteNum(p.y)) return null;
      if (!Number.isInteger(p.x) || !Number.isInteger(p.y)) return null;
      if (Math.abs(p.x) > 1e7 || Math.abs(p.y) > 1e7) return null;
      if (!isStructureBuildKind(p.kind)) return null;
      const facing = isStructureFenceFacing(p.facing) ? p.facing : undefined;
      return { type, payload: { x: p.x, y: p.y, kind: p.kind, facing } };
    }
    case "prefabDeposit": {
      if (!isFiniteNum(p.x) || !isFiniteNum(p.y)) return null;
      if (!Number.isInteger(p.x) || !Number.isInteger(p.y)) return null;
      if (Math.abs(p.x) > 1e7 || Math.abs(p.y) > 1e7) return null;
      if (!isIdString(p.itemId)) return null;
      if (
        p.quantity !== undefined &&
        !isIntInRange(p.quantity, 1, 100_000)
      ) {
        return null;
      }
      return {
        type,
        payload: {
          x: p.x,
          y: p.y,
          itemId: p.itemId,
          quantity: typeof p.quantity === "number" ? p.quantity : undefined,
        },
      };
    }
    case "questAccept": {
      if (!isIdString(p.questId) || !isIdString(p.npcId)) return null;
      return {
        type,
        payload: {
          questId: p.questId,
          npcId: p.npcId,
        },
      };
    }
    case "questAbandon": {
      if (!isIdString(p.questId)) return null;
      return { type, payload: { questId: p.questId } };
    }
    case "radioSetChannel": {
      if (!isIntInRange(p.channel, 0, 99)) return null;
      return { type, payload: { channel: p.channel } };
    }
    case "tutorialCompleteStep": {
      if (p.stepId !== undefined && !isIdString(p.stepId)) return null;
      if (p.done !== undefined && typeof p.done !== "boolean") return null;
      if (p.seen !== undefined && typeof p.seen !== "boolean") return null;
      if (
        p.stepId === undefined &&
        p.done !== true &&
        p.seen !== true
      ) {
        return null;
      }
      return {
        type,
        payload: {
          stepId: typeof p.stepId === "string" ? p.stepId : undefined,
          done: p.done === true ? true : undefined,
          seen: p.seen === true ? true : undefined,
        },
      };
    }
    default:
      return null;
  }
}

export const DIRECTIONS = {
  NORTH: 0,
  NORTH_EAST: 1,
  EAST: 2,
  SOUTH_EAST: 3,
  SOUTH: 4,
  SOUTH_WEST: 5,
  WEST: 6,
  NORTH_WEST: 7,
} as const;

export type LootPilePayload = {
  containerId: string;
  objectType: string;
  containerJson: string;
};

export type ServerMessage =
  | { type: "lootFound"; payload: { items: { id: string; quantity: number; name: string }[] } }
  | { type: "searchDenied"; payload: { reason: string } }
  | {
      type: "containerOpen";
      payload: {
        containerId: string;
        objectType: string;
        containerJson: string;
        /** Every container and corpse opened by this search. */
        piles?: LootPilePayload[];
      };
    }
  | {
      type: "containerSync";
      payload: {
        containerId: string;
        containerJson: string;
      };
    }
  | {
      type: "tradeOpen";
      payload: {
        traderId: string;
        traderName: string;
        traderBanknotes: number;
        playerBanknotes: number;
        stockJson: string;
        inventoryJson: string;
      };
    }
  | {
      type: "tradeSync";
      payload: {
        traderId: string;
        traderBanknotes: number;
        playerBanknotes: number;
        stockJson: string;
        inventoryJson: string;
      };
    }
  | {
      type: "marketOpen";
      payload: MarketStatePayload;
    }
  | {
      type: "marketSync";
      payload: MarketStatePayload;
    }
  | {
      type: "dialogOpen";
      payload: {
        npcId: string;
        npcSkin: number;
        npcName: string;
        playerName: string;
        /** "redOrder" | "ashenTraders" | "ashenMilitia" */
        faction: "redOrder" | "ashenTraders" | "ashenMilitia";
        /** GuardState.npcKind — used for Ashen avatar / trade action. */
        npcKind: number;
        redOrderReputation?: number;
        ashenReputation?: number;
        ashenMilitiaReputation?: number;
        /** True when the NPC is indoors (militia hospital replies). */
        inInterior?: boolean;
        /**
         * Completions used in the rolling window per capped militia task id
         * (e.g. Doctor Clark snack jobs). JSON: Record<taskId, number>.
         */
        taskCompletionsJson?: string;
      };
    }
  | {
      type: "dialogTaskComplete";
      payload: {
        taskId: string;
        redOrderReputation?: number;
        ashenReputation?: number;
        ashenMilitiaReputation?: number;
        rewards: { id: string; quantity: number; name: string }[];
        /** Updated rolling-window counts for capped tasks. */
        taskCompletionsJson?: string;
      };
    }
  | {
      type: "dialogHealComplete";
      payload: {
        npcId: string;
        cost: number;
        health: number;
        curedInfection?: boolean;
      };
    }
  | {
      type: "craftOpen";
      payload: {
        workbenchId: string;
        inventoryJson: string;
      };
    }
  | {
      type: "craftSync";
      payload: {
        workbenchId: string;
        inventoryJson: string;
        crafted?: { id: string; quantity: number; name: string };
        salvaged?: { id: string; quantity: number; name: string }[];
        ruined?: { name: string }[];
      };
    }
  | {
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
        /** Null on warehouse furnaces, which do not cook. */
        cookSlots?: { itemId: string; stageStartedAt: number }[] | null;
      };
    }
  | {
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
      };
    }
  | { type: "shotMissed"; payload: { targetId: string; impactX: number; impactY: number; weaponIndex: number } }
  | { type: "entityHit"; payload: { targetId: string; x: number; y: number; weaponIndex: number } }
  | {
      /**
       * A gunshot the listener can hear even if the shooter is outside
       * render / AOI. Volume still falls off on the client.
       */
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
    }
  | {
      /** Free-aim bullet that stopped on cover or open ground instead of a body. */
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
    }
  | {
      /**
       * The exact free-aim line the server traced, spread included.
       * Broadcast to the room; the client still drops traces from another
       * interior / overworld mismatch.
       */
      type: "shotTrace";
      payload: {
        originX: number;
        originY: number;
        endX: number;
        endY: number;
        /** The line stopped on a body or cover rather than running out. */
        blocked: boolean;
        inInterior: boolean;
        buildingX?: number;
        buildingY?: number;
      };
    }
  | {
      /** Birchport barracks bargate opening for a Friendly+ crossing. */
      type: "bargateOpen";
      payload: {
        x: number;
        y: number;
        facing: "SE" | "SW";
      };
    }
  | {
      type: "tempWallPlaced";
      payload: {
        /** False = overworld partition wall. */
        inInterior: boolean;
        buildingX?: number;
        buildingY?: number;
        x: number;
        y: number;
      };
    }
  | {
      type: "tempWallsSync";
      payload: {
        inInterior: boolean;
        buildingX?: number;
        buildingY?: number;
        walls: { x: number; y: number }[];
      };
    }
  | {
      type: "structurePlaced";
      payload: StructureSyncEntry & {
        inInterior: boolean;
        buildingX?: number;
        buildingY?: number;
      };
    }
  | {
      type: "structureRemoved";
      payload: {
        x: number;
        y: number;
        kind: StructureBuildKind;
        inInterior: boolean;
        buildingX?: number;
        buildingY?: number;
      };
    }
  | {
      type: "structuresSync";
      payload: {
        inInterior: boolean;
        buildingX?: number;
        buildingY?: number;
        structures: StructureSyncEntry[];
      };
    }
  | {
      type: "doorStateChanged";
      payload: {
        x: number;
        y: number;
        inInterior: boolean;
        buildingX?: number;
        buildingY?: number;
        isOpen: boolean;
        isLocked: boolean;
      };
    }
  | {
      type: "fireplaceStateChanged";
      payload: {
        x: number;
        y: number;
        inInterior: boolean;
        buildingX?: number;
        buildingY?: number;
        fuelWood: number;
        activeUntil: number;
        /** Set for interior mantels and furnaces so outdoor clients can tell them apart. */
        objectType?: string;
      };
    }
  | {
      type: "treeFalling";
      payload: { x: number; y: number; endsInMs: number };
    }
  | {
      type: "treeFallCancelled";
      payload: { x: number; y: number };
    }
  | {
      type: "treeFelled";
      payload: { x: number; y: number };
    }
  | {
      type: "worldSfx";
      payload: WorldSfxPayload;
    }
  | {
      type: "worldSfxStop";
      payload: { id: string; kind: WorldSfxStopKind };
    }
  | {
      type: "treesSync";
      payload: { trees: { x: number; y: number }[] };
    }
  | {
      type: "questSync";
      payload: { questsJson: string };
    }
  | {
      type: "worldClockSync";
      payload: {
        worldTimeMs: number;
        sky: "clear" | "cloudy";
        weather: "none" | "rain" | "fog" | "snow";
        weatherUntilMs: number;
      };
    }
  | {
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
    }
  | {
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
    }
  | {
      type: "prefabBuilt";
      payload: StructureSyncEntry & {
        inInterior: boolean;
        buildingX?: number;
        buildingY?: number;
      };
    }
  | {
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
    }
  | {
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
    }
  | {
      type: "skillLevelUp";
      payload: { label: string; subId: string; level: number };
    }
  | {
      /** Owner-only note. Shown as a popup, not a chat bubble. */
      type: "playerNote";
      payload: {
        text: string;
        iconId?: string;
        durationMs?: number;
        items?: { id?: string; name: string; quantity: number }[];
      };
    };

/** One-shot / channelled world audio other clients in earshot should play. */
export type WorldSfxKind =
  | "search"
  | "reload"
  | "unload"
  | "consume"
  | "melee"
  | "extinguish"
  | "death";

export type WorldSfxStopKind = "search" | "reload" | "unload" | "consume";

export type WorldSfxPayload = {
  id: string;
  kind: WorldSfxKind;
  x: number;
  y: number;
  inInterior: boolean;
  buildingX: number;
  buildingY: number;
  itemId?: string;
  objectType?: string;
  searchKind?: "furniture" | "body";
};

/** Client-safe structure fields — never includes the code hash. */
export type StructureSyncEntry = {
  x: number;
  y: number;
  kind: StructureBuildKind;
  ownerWallet: string;
  isOpen: boolean;
  isLocked: boolean;
  /** Absolute ms when a fireplace goes inactive (0 for walls/doors). */
  activeUntil: number;
  /** Wood pieces currently in a fireplace (0 for walls/doors). */
  fuelWood: number;
  /** Prefab ghost vs completed solid structure. */
  status: "prefab" | "solid";
  /** JSON map of itemId → deposited qty (prefabs). */
  depositsJson: string;
  health: number;
  maxHealth: number;
  /** Fence panel facing, or auto-corner orientation (SWSE / SESW). */
  facing?: StructureFenceFacing | StructureFenceCorner;
};

export type ChatBroadcast = {
  senderId: string;
  senderName: string;
  text: string;
  channel?: "global" | "radio";
  /** Action captions (pings) stay italic and grey. Speech stays white. */
  tone?: "action";
  radioChannel?: number;
};
