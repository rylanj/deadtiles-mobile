import {
  backpackContentsHaveItems,
  backpackHoldsItems,
  backpackOverflowWorsened,
  loadedBackpackStowBlocked,
  sealedBackpackStackCount,
  ARMOR_SLOT_INDEX,
  BACKPACK_SLOT_INDEX,
  BACKPACK_STORAGE_START,
  BASE_INVENTORY_SLOTS,
  CLOTHING_SLOT_INDEX,
  LEFT_HAND_SLOT_INDEX,
  NECK_SLOT_INDEX,
  RIGHT_HAND_SLOT_INDEX,
  POCKET_SLOT_COUNT,
  retiredPocketIndices,
  shownBackpackStorageCount,
  inventorySlotAccess,
  isArmorSlot,
  isBackpackItem,
  isBackpackSlot,
  isBackpackStorageIndex,
  isHandSlot,
  isJewelrySlot,
  isNeckSlot,
  moveInventorySlot,
  shownExtraPockets,
  CONTAINER_INVENTORY_SLOTS,
  parseStorageBoxInventory,
  storageBoxSlotsForObjectType,
  RADIO_ITEM_ID,
  RADIO_SLOT_INDEX,
  MAP_ITEM_ID,
  MAP_SLOT_INDEX,
  WATCH_SLOT_INDEX,
  isWatchItem,
  wornGearEffectHint,
  WEAPON_SLOT_COUNT,
  getAmmoTypeForWeapon,
  getEntryDurability,
  getEntryRadioFreq,
  getEntryWetness,
  getItemDefinition,
  getMaxDurability,
  isHotbarOnlyItem,
  weaponIndexFromItemId,
  isRadioSlot,
  isWatchSlot,
  isMapSlot,
  itemFitsInSlot,
  slotStackLimit,
  canSplitInventoryStackHalf,
  shiftSplitQuantity,
  maxStackForItem,
  containerInventoryIsEmpty,
  parseContainerInventory,
  parseInventory,
  SAFE_DEPOSIT_OBJECT_TYPE,
  type Inventory,
} from "@zombie/shared";
import { isMobileDevice } from "../device";
import { carrySlotGroups, formatCarrySlots, usedSlotCount } from "./carrySlots";
import "./mobile/loot.css";
import {
  chip,
  createSheet,
  markSheetOpen,
  renderTabs,
  sectionLabel,
  sheetButton,
  sheetRow,
  showSheetMessage,
  useMobileSheet,
  type Sheet,
} from "./mobileSheet";
import { appendItemDurabilityBar, appendItemIcon, appendItemWetnessBar, markQuestKeepsake } from "./itemIcons";
import { createDialogCloseButton } from "./dialogCloseBtn";
import { resetDialogScroll } from "./dialogScroll";
import { bindPhoneDialogResize, usePhoneDialogSheet } from "./phoneDialog";
import {
  bindSlotPointerDnD,
  cancelAllSlotDrags,
  type SlotTapState,
} from "./slotPointerDnD";

const FURNITURE_DISPLAY_NAMES: Record<string, string> = {
  desk: "Desk",
  desk2: "Desk",
  desk3: "Desk",
  conferencetable: "Conference Table",
  copier: "Copier",
  bigshelf: "Shelf",
  bigbox: "Crate",
  watercontainer: "Water Container",
  cabinet: "Cabinet",
  workbench: "Workbench",
  bed: "Bed",
  dresser: "Dresser",
  bookshelf: "Bookshelf",
  bookshelf2: "Bookshelf",
  lockers: "Lockers",
  drawers: "Drawers",
  guncabinet: "Gun Cabinet",
  safe1: "Safe",
  fridge: "Fridge",
  kitchensink: "Kitchen Sink",
  dinnertable: "Dinner Table",
  nightstand: "Nightstand",
  deadofficer: "Dead Officer",
  bagchair: "Chair",
  armchair: "Armchair",
  sofa: "Sofa",
  suitcase: "Suitcase",
  watercooler: "Water Cooler",
  trashcan: "Trash Can",
  checkout: "Checkout",
  retailcheckout1: "Checkout",
  supershelf1: "Shelf",
  supershelf2: "Shelf",
  superfridge1: "Fridge",
  hospitalbed: "Hospital Bed",
  hospitalbed2: "Hospital Bed",
  hospitalbed3: "Hospital Bed",
  ivstand: "IV Stand",
  medicalcart: "Medical Cart",
  medicalreception: "Reception Desk",
  medicaldrawers: "Medical Drawers",
  threeseater: "Bench",
  threeseater2: "Bench",
  threeseater3: "Bench",
  vendingmachine: "Vending Machine",
  counter: "Counter",
  motelbed: "Bed",
  minifridge: "Mini Fridge",
  groundbackpack: "Dropped Items",
  militarybed: "Camp Bed",
  footlocker: "Footlocker",
  kitbag: "Kit Bag",
  camptable: "Camp Table",
  campchair: "Camp Chair",
  militarybasket: "Laundry Basket",
  range: "Range",
  hotdisplay: "Hot Display",
  drinkdisplay: "Drink Station",
  canteentable1: "Canteen Table",
  canteentable2: "Canteen Table",
  canteentable3: "Canteen Table",
  booth1: "Booth",
  booth2: "Booth",
  booth3: "Booth",
  dinercounter1: "Counter",
  dinercounter2: "Register",
  dinercounter3: "Counter",
  dinercounter4: "Counter",
  juke1: "Jukebox",
  sink2: "Sink",
  sink1: "Sink",
  guncase1: "Gun Case",
  guncase2: "Register",
  guncase3: "Parts Case",
  ammoshelf1: "Ammo Shelf",
  gunrack2: "Gun Rack",
  gunrack3: "Gun Rack",
  gunrack4: "Gun Rack",
  canteenchair: "Canteen Chair",
  fallentree: "Fallen Tree",
  zombie: "Zombie",
  guard: "Guard",
  coyote: "Coyote",
  bear: "Bear",
  crow: "Crow",
  rabbit: "Rabbit",
  storagebox: "Storage Box",
  storagebox2: "Storage Box 2",
  safedeposit: "Safe Deposit",
};

function furnitureDisplayName(objectType: string): string {
  if (!objectType) return "Loot";
  const key = objectType.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  const mapped = FURNITURE_DISPLAY_NAMES[key];
  if (mapped) return mapped;
  const spaced = objectType
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Za-z])\d+/g, "$1")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!spaced) return "Loot";
  return spaced.replace(/\b\w/g, (c) => c.toUpperCase());
}

export type LootPileView = {
  containerId: string;
  objectType: string;
  inventory: Inventory;
};

export type ContainerLootUIHandlers = {
  onTakeFromContainer: (containerId: string, fromSlot: number, toSlot: number) => void;
  onMoveInContainer: (containerId: string, fromSlot: number, toSlot: number) => void;
  onStoreInContainer: (containerId: string, fromSlot: number, toSlot: number) => void;
  onMovePlayerSlot: (
    fromSlot: number,
    toSlot: number,
    splitHalf?: boolean,
  ) => void;
  onClose: (containerId: string) => void;
};

const CATEGORY_COLORS: Record<string, string> = {
  weapons: "#8b4558",
  clothing: "#4a6a8a",
  backpack: "#5c6b45",
  equipment: "#5a6a4a",
  ammunition: "#6b7a3a",
  medical: "#3a7070",
  crafting: "#6a6040",
  junk: "#5a5a4a",
  magazine: "#4d5d73",
  food: "#8a6840",
  drink: "#406080",
};

const CATEGORY_LABELS: Record<string, string> = {
  weapons: "Weapon",
  clothing: "Clothing",
  equipment: "Gear",
  backpack: "Backpack",
  ammunition: "Ammo",
  medical: "Medical",
  crafting: "Material",
  food: "Food",
  drink: "Drink",
  junk: "Junk",
  magazine: "Magazine",
};

const MOBILE_WORN_SLOTS = [
  0,
  1,
  ARMOR_SLOT_INDEX,
  CLOTHING_SLOT_INDEX,
  BACKPACK_SLOT_INDEX,
  WATCH_SLOT_INDEX,
  RADIO_SLOT_INDEX,
  NECK_SLOT_INDEX,
  LEFT_HAND_SLOT_INDEX,
  RIGHT_HAND_SLOT_INDEX,
  MAP_SLOT_INDEX,
];

function itemCategoryLabel(itemId: string): string {
  const def = getItemDefinition(itemId);
  if (weaponIndexFromItemId(itemId) >= 0) {
    return getAmmoTypeForWeapon(itemId) ? "Firearm" : "Melee weapon";
  }
  return CATEGORY_LABELS[def?.category ?? ""] ?? "Item";
}

function shortLabel(name: string): string {
  if (name.length <= 10) return name;
  const first = name.split(/\s+/)[0] ?? name;
  return first.length <= 10 ? first : `${first.slice(0, 9)}…`;
}

type DragSource = "container" | "player";

export class ContainerLootUI {
  private visible = false;
  private containerId = "";
  private objectType = "";
  private piles: LootPileView[] = [];
  private containerInventory: Inventory = [];
  private playerInventory: Inventory = [];
  private extraPockets = 0;
  private dragFromSlot = -1;
  private dragFromSource: DragSource | null = null;
  /** Last tap on a container cell — used for mobile double-tap take. */
  private lastTap: SlotTapState = null;

  private overlay: HTMLElement;
  private layoutEl!: HTMLElement;
  private titleEl: HTMLElement;
  private playerPanelEl!: HTMLElement;
  private playerBodyEl!: HTMLElement;
  private containerSlotsEl: HTMLElement;
  private playerSlotsEl: HTMLElement;
  private phoneOn = false;
  private ms: Sheet | null = null;
  private phoneTab: "loot" | "bag" = "loot";
  private unbindPhoneResize: () => void = () => {};
  private phoneRoot!: HTMLElement;
  private phoneTitleEl!: HTMLElement;
  private phoneMetaEl!: HTMLElement;
  private phoneTabRow!: HTMLElement;
  private phoneLootTab!: HTMLButtonElement;
  private phoneBagTab!: HTMLButtonElement;
  private phoneListEl!: HTMLElement;
  private phoneLootPane!: HTMLElement;
  private phoneBagPane!: HTMLElement;
  private phoneFooterEl!: HTMLElement;
  private phoneTakeAllBtn!: HTMLButtonElement;
  private phoneStoreAllBtn!: HTMLButtonElement;
  private phonePeekBtn!: HTMLButtonElement;
  private playerWeaponsEl: HTMLElement;
  private playerArmorEl: HTMLElement;
  private playerEquipmentEl: HTMLElement;
  private playerJewelryEl: HTMLElement;
  private playerPocketsEl: HTMLElement;
  private playerBackpackSection: HTMLElement;
  private playerBackpackEl: HTMLElement;
  private hintEl: HTMLElement;

  constructor(private handlers: ContainerLootUIHandlers) {
    this.overlay = document.createElement("div");
    this.overlay.id = "container-loot-overlay";
    this.overlay.hidden = true;

    const layout = document.createElement("div");
    layout.className = "container-loot-layout";
    this.layoutEl = layout;

    const sourcePanel = document.createElement("div");
    sourcePanel.className = "inventory-panel container-loot-panel";

    const sourceHeader = document.createElement("div");
    sourceHeader.className = "inventory-header";
    const sourceHeaderTop = document.createElement("div");
    sourceHeaderTop.className = "inventory-header-top";
    this.titleEl = document.createElement("h2");
    this.titleEl.className = "inventory-title";
    this.titleEl.textContent = "Container";
    sourceHeaderTop.append(
      this.titleEl,
      createDialogCloseButton(() => this.close()),
    );
    this.hintEl = document.createElement("span");
    this.hintEl.className = "inventory-hint";
    this.hintEl.textContent = isMobileDevice()
      ? "Drag or double-tap to take"
      : "Drag or double-click to take · Esc to close";
    sourceHeader.append(sourceHeaderTop, this.hintEl);

    const sourceBody = document.createElement("div");
    sourceBody.className = "inventory-grid-wrap";
    this.containerSlotsEl = document.createElement("div");
    this.containerSlotsEl.className = "container-loot-piles";
    sourceBody.appendChild(this.containerSlotsEl);
    sourcePanel.append(sourceHeader, sourceBody);

    const playerPanel = document.createElement("div");
    playerPanel.className = "inventory-panel container-loot-panel";
    this.playerPanelEl = playerPanel;

    const playerHeader = document.createElement("div");
    playerHeader.className = "inventory-header";
    const playerTitle = document.createElement("h2");
    playerTitle.className = "inventory-title";
    playerTitle.textContent = "Inventory";
    const playerHint = document.createElement("span");
    playerHint.className = "inventory-hint";
    playerHint.textContent =
      "Weapons · Armor · Clothing · Backpack · Watch · Radio · Neck · Hands · Map · Pockets";
    playerHeader.append(playerTitle, playerHint);

    const playerBody = document.createElement("div");
    playerBody.className = "inventory-grid-wrap container-loot-player-body";
    this.playerBodyEl = playerBody;

    const weaponsSection = document.createElement("div");
    weaponsSection.className = "inventory-section";
    const weaponRowLabels = document.createElement("div");
    weaponRowLabels.className = "inventory-weapon-row-labels";
    const weaponsLabel = document.createElement("div");
    weaponsLabel.className = "inventory-section-label inventory-weapon-row-label";
    weaponsLabel.textContent = "Weapons";
    const armorLabel = document.createElement("div");
    armorLabel.className = "inventory-section-label inventory-radio-row-label";
    armorLabel.textContent = "Armor";
    weaponRowLabels.append(weaponsLabel, armorLabel);
    const weaponRow = document.createElement("div");
    weaponRow.className = "inventory-weapon-row";
    this.playerWeaponsEl = document.createElement("div");
    this.playerWeaponsEl.className = "inventory-grid inventory-grid--weapons";
    this.playerArmorEl = document.createElement("div");
    this.playerArmorEl.className = "inventory-grid inventory-grid--radio";
    weaponRow.append(this.playerWeaponsEl, this.playerArmorEl);
    weaponsSection.append(weaponRowLabels, weaponRow);

    const equipmentSection = document.createElement("div");
    equipmentSection.className = "inventory-section";
    const equipmentLabels = document.createElement("div");
    equipmentLabels.className = "inventory-equipment-labels";
    for (const text of ["Clothing", "Backpack", "Watch", "Radio"]) {
      const lab = document.createElement("div");
      lab.className = "inventory-section-label";
      lab.textContent = text;
      equipmentLabels.appendChild(lab);
    }
    this.playerEquipmentEl = document.createElement("div");
    this.playerEquipmentEl.className = "inventory-grid inventory-grid--equipment";
    const jewelryLabels = document.createElement("div");
    jewelryLabels.className = "inventory-equipment-labels inventory-equipment-labels--next";
    for (const text of ["Neck", "Left Hand", "Right Hand", "Map"]) {
      const lab = document.createElement("div");
      lab.className = "inventory-section-label";
      lab.textContent = text;
      jewelryLabels.appendChild(lab);
    }
    this.playerJewelryEl = document.createElement("div");
    this.playerJewelryEl.className = "inventory-grid inventory-grid--equipment";
    equipmentSection.append(
      equipmentLabels,
      this.playerEquipmentEl,
      jewelryLabels,
      this.playerJewelryEl,
    );

    const pocketsSection = document.createElement("div");
    pocketsSection.className = "inventory-section";
    const pocketsLabel = document.createElement("div");
    pocketsLabel.className = "inventory-section-label";
    pocketsLabel.textContent = "Pockets";
    this.playerPocketsEl = document.createElement("div");
    this.playerPocketsEl.className = "inventory-grid inventory-grid--pockets";
    pocketsSection.append(pocketsLabel, this.playerPocketsEl);

    this.playerBackpackSection = document.createElement("div");
    this.playerBackpackSection.className = "inventory-section";
    this.playerBackpackSection.hidden = true;
    const backpackLabel = document.createElement("div");
    backpackLabel.className = "inventory-section-label";
    backpackLabel.textContent = "Backpack";
    this.playerBackpackEl = document.createElement("div");
    this.playerBackpackEl.className = "inventory-grid inventory-grid--pockets";
    this.playerBackpackSection.append(backpackLabel, this.playerBackpackEl);

    const carryScroll = document.createElement("div");
    carryScroll.className = "inventory-carry-scroll";
    carryScroll.append(pocketsSection, this.playerBackpackSection);

    this.playerSlotsEl = document.createElement("div");
    this.playerSlotsEl.className = "container-loot-player-grids";
    const wornEl = document.createElement("div");
    wornEl.className = "inventory-worn";
    wornEl.append(weaponsSection, equipmentSection);
    this.playerSlotsEl.append(wornEl, carryScroll);
    playerBody.appendChild(this.playerSlotsEl);
    playerPanel.append(playerHeader, playerBody);

    layout.append(sourcePanel, playerPanel);
    this.buildPhoneSheet();
    this.overlay.append(layout, this.phoneRoot);
    document.body.appendChild(this.overlay);

    this.overlay.addEventListener("click", (event) => {
      if (usePhoneDialogSheet()) return;
      if (event.target === this.overlay) this.close();
    });
    this.unbindPhoneResize = bindPhoneDialogResize(
      () => this.visible,
      () => this.overlay.classList.contains("phone-sheet"),
      () => this.rebuildGrids(),
      this.overlay,
    );
  }

  open(
    containerId: string,
    objectType: string,
    containerJson: string,
    playerInventoryJson: string,
    piles?: { containerId: string; objectType: string; containerJson: string }[],
    extraPockets = 0,
  ) {
    const source =
      piles && piles.length > 0
        ? piles
        : [{ containerId, objectType, containerJson }];
    this.piles = source.map((pile) => ({
      containerId: pile.containerId,
      objectType: pile.objectType,
      inventory: this.parsePileInventory(pile.objectType, pile.containerJson),
    }));
    this.containerId = this.piles[0]?.containerId ?? containerId;
    this.objectType = this.piles.length > 1 ? "" : (this.piles[0]?.objectType ?? objectType);
    this.visible = true;
    this.phoneTab = "loot";
    this.overlay.hidden = false;
    document.body.classList.add("container-loot-open");
    this.extraPockets = extraPockets;
    this.playerInventory = parseInventory(playerInventoryJson);
    this.containerInventory = this.piles[0]?.inventory ?? [];
    this.titleEl.textContent =
      this.piles.length > 1 ? "Loot" : furnitureDisplayName(this.objectType);
    const deposit =
      this.objectType === SAFE_DEPOSIT_OBJECT_TYPE ||
      this.piles.some((pile) => pile.objectType === SAFE_DEPOSIT_OBJECT_TYPE);
    this.hintEl.textContent = deposit
      ? "Stays safe at the market until you collect it"
      : isMobileDevice()
        ? "Drag or double-tap to take"
        : "Drag or double-click to take · Esc to close";
    this.rebuildGrids();
    resetDialogScroll(this.overlay);
  }

  close() {
    if (!this.visible) return;
    const closedId = this.containerId;
    cancelAllSlotDrags();
    this.visible = false;
    this.overlay.hidden = true;
    this.containerId = "";
    this.piles = [];
    this.dragFromSlot = -1;
    this.dragFromSource = null;
    this.lastTap = null;
    this.overlay.classList.remove("phone-sheet");
    this.restoreDesktopBag();
    markSheetOpen("loot", false);
    if (this.ms) showSheetMessage(this.ms.snackSlot, "");
    document.body.classList.remove("container-loot-open");
    this.handlers.onClose(closedId);
  }

  isOpen() {
    return this.visible;
  }

  getContainerId() {
    return this.containerId;
  }

  getContainerIds() {
    return this.piles.map((pile) => pile.containerId);
  }

  syncContainer(containerId: string, containerJson: string) {
    if (!this.visible) return;
    const pile = this.piles.find((entry) => entry.containerId === containerId);
    if (!pile) return;
    const inventory = this.parsePileInventory(pile.objectType, containerJson);
    const keepWhenEmpty = this.isStorageBoxPile(pile.objectType);
    if (containerInventoryIsEmpty(inventory) && !keepWhenEmpty) {
      this.piles = this.piles.filter((entry) => entry.containerId !== containerId);
      this.containerId = this.piles[0]?.containerId ?? "";
      if (this.piles.length === 0) {
        this.close();
        return;
      }
    } else {
      pile.inventory = inventory;
    }
    this.containerInventory = this.piles[0]?.inventory ?? [];
    this.titleEl.textContent =
      this.piles.length > 1 ? "Loot" : furnitureDisplayName(this.piles[0]?.objectType ?? "");
    this.rebuildGrids();
  }

  syncPlayerInventory(playerInventoryJson: string, extraPockets = this.extraPockets) {
    if (!this.visible) return;
    this.extraPockets = extraPockets;
    this.playerInventory = parseInventory(playerInventoryJson);
    this.rebuildGrids();
  }

  render(containerJson: string, playerInventoryJson: string) {
    this.titleEl.textContent = furnitureDisplayName(this.objectType);
    this.containerInventory = this.parsePileInventory(this.objectType, containerJson);
    this.playerInventory = parseInventory(playerInventoryJson);
    this.rebuildGrids();
  }

  private rebuildGrids() {
    cancelAllSlotDrags();
    this.syncPhoneSheet();
    this.containerSlotsEl.replaceChildren();
    const showLabels = this.piles.length > 1;
    for (const pile of this.piles) {
      const block = document.createElement("div");
      block.className = "container-loot-pile";
      if (showLabels) {
        const label = document.createElement("div");
        label.className = "container-loot-pile-label";
        label.textContent = furnitureDisplayName(pile.objectType);
        block.appendChild(label);
      }
      const grid = document.createElement("div");
      grid.className = "inventory-grid inventory-grid--container";
      const slotCount = this.containerSlotCount(pile.objectType);
      for (let i = 0; i < slotCount; i++) {
        grid.appendChild(
          this.createCell(
            "container",
            i,
            pile.inventory[i] ?? null,
            pile.containerId,
          ),
        );
      }
      block.appendChild(grid);
      this.containerSlotsEl.appendChild(block);
    }
    this.playerWeaponsEl.replaceChildren();
    this.playerArmorEl.replaceChildren();
    this.playerEquipmentEl.replaceChildren();
    this.playerJewelryEl.replaceChildren();
    this.playerPocketsEl.replaceChildren();
    this.playerBackpackEl.replaceChildren();

    for (let i = 0; i < WEAPON_SLOT_COUNT; i++) {
      this.playerWeaponsEl.appendChild(
        this.createCell("player", i, this.playerInventory[i] ?? null),
      );
    }
    this.playerArmorEl.appendChild(
      this.createCell(
        "player",
        ARMOR_SLOT_INDEX,
        this.playerInventory[ARMOR_SLOT_INDEX] ?? null,
      ),
    );
    this.playerEquipmentEl.append(
      this.createCell(
        "player",
        CLOTHING_SLOT_INDEX,
        this.playerInventory[CLOTHING_SLOT_INDEX] ?? null,
      ),
      this.createCell(
        "player",
        BACKPACK_SLOT_INDEX,
        this.playerInventory[BACKPACK_SLOT_INDEX] ?? null,
      ),
      this.createCell(
        "player",
        WATCH_SLOT_INDEX,
        this.playerInventory[WATCH_SLOT_INDEX] ?? null,
      ),
      this.createCell(
        "player",
        RADIO_SLOT_INDEX,
        this.playerInventory[RADIO_SLOT_INDEX] ?? null,
      ),
    );
    this.playerJewelryEl.append(
      this.createCell(
        "player",
        NECK_SLOT_INDEX,
        this.playerInventory[NECK_SLOT_INDEX] ?? null,
      ),
      this.createCell(
        "player",
        LEFT_HAND_SLOT_INDEX,
        this.playerInventory[LEFT_HAND_SLOT_INDEX] ?? null,
      ),
      this.createCell(
        "player",
        RIGHT_HAND_SLOT_INDEX,
        this.playerInventory[RIGHT_HAND_SLOT_INDEX] ?? null,
      ),
      this.createCell(
        "player",
        MAP_SLOT_INDEX,
        this.playerInventory[MAP_SLOT_INDEX] ?? null,
      ),
    );
    for (let i = 0; i < POCKET_SLOT_COUNT; i++) {
      const idx = WEAPON_SLOT_COUNT + i;
      this.playerPocketsEl.appendChild(
        this.createCell("player", idx, this.playerInventory[idx] ?? null),
      );
    }
    for (const idx of retiredPocketIndices(this.playerInventory)) {
      this.playerPocketsEl.appendChild(
        this.createCell("player", idx, this.playerInventory[idx] ?? null),
      );
    }
    const extra = shownExtraPockets(this.playerInventory, this.extraPockets);
    for (let i = 0; i < extra; i++) {
      const idx = BASE_INVENTORY_SLOTS + i;
      this.playerPocketsEl.appendChild(
        this.createCell("player", idx, this.playerInventory[idx] ?? null),
      );
    }
    const packSlots = shownBackpackStorageCount(this.playerInventory);
    this.playerBackpackSection.hidden = packSlots <= 0;
    for (let i = 0; i < packSlots; i++) {
      const idx = BACKPACK_STORAGE_START + i;
      this.playerBackpackEl.appendChild(
        this.createCell("player", idx, this.playerInventory[idx] ?? null),
      );
    }
    if (this.phoneOn) this.fillPhoneList();
    if (this.ms && useMobileSheet()) this.msRender();
  }

  private isTwoWay(): boolean {
    return (
      this.storageBoxSlots() != null ||
      this.objectType === SAFE_DEPOSIT_OBJECT_TYPE ||
      this.piles.some((pile) => pile.objectType === SAFE_DEPOSIT_OBJECT_TYPE)
    );
  }

  private lootItemCount(): number {
    let count = 0;
    for (const pile of this.piles) {
      for (const slot of pile.inventory) {
        if (slot) count += 1;
      }
    }
    return count;
  }

  private buildPhoneSheet(): void {
    this.phoneRoot = document.createElement("div");
    this.phoneRoot.className = "loot-sheet";
    this.phoneRoot.hidden = true;

    const header = document.createElement("div");
    header.className = "loot-sheet-header";
    const titles = document.createElement("div");
    titles.className = "loot-sheet-titles";
    this.phoneTitleEl = document.createElement("h2");
    this.phoneTitleEl.className = "inventory-title";
    this.phoneTitleEl.textContent = "Loot";
    this.phoneMetaEl = document.createElement("div");
    this.phoneMetaEl.className = "loot-sheet-meta";
    titles.append(this.phoneTitleEl, this.phoneMetaEl);
    header.append(titles, createDialogCloseButton(() => this.close()));

    this.phoneTabRow = document.createElement("div");
    this.phoneTabRow.className = "loot-sheet-tabs";
    this.phoneLootTab = this.makePhoneTab("Box", "loot");
    this.phoneBagTab = this.makePhoneTab("Bag", "bag");
    this.phoneTabRow.append(this.phoneLootTab, this.phoneBagTab);

    this.phoneLootPane = document.createElement("div");
    this.phoneLootPane.className = "loot-sheet-pane";
    this.phoneListEl = document.createElement("div");
    this.phoneListEl.className = "loot-sheet-list";
    this.phoneLootPane.append(this.phoneListEl);

    this.phoneBagPane = document.createElement("div");
    this.phoneBagPane.className = "loot-sheet-pane loot-sheet-pane--bag";
    this.phoneBagPane.hidden = true;

    this.phoneFooterEl = document.createElement("div");
    this.phoneFooterEl.className = "loot-sheet-footer";
    this.phoneTakeAllBtn = document.createElement("button");
    this.phoneTakeAllBtn.type = "button";
    this.phoneTakeAllBtn.className = "loot-sheet-primary";
    this.phoneTakeAllBtn.textContent = "Take all";
    this.phoneTakeAllBtn.addEventListener("click", () => this.takeAll());
    this.phoneStoreAllBtn = document.createElement("button");
    this.phoneStoreAllBtn.type = "button";
    this.phoneStoreAllBtn.className = "loot-sheet-primary";
    this.phoneStoreAllBtn.textContent = "Store all";
    this.phoneStoreAllBtn.addEventListener("click", () => this.storeAll());
    this.phonePeekBtn = document.createElement("button");
    this.phonePeekBtn.type = "button";
    this.phonePeekBtn.className = "loot-sheet-peek";
    this.phonePeekBtn.addEventListener("click", () => {
      this.phoneTab = this.phoneTab === "bag" ? "loot" : "bag";
      this.rebuildGrids();
    });
    this.phoneFooterEl.append(
      this.phoneTakeAllBtn,
      this.phoneStoreAllBtn,
      this.phonePeekBtn,
    );

    this.phoneRoot.append(
      header,
      this.phoneTabRow,
      this.phoneLootPane,
      this.phoneBagPane,
      this.phoneFooterEl,
    );
  }

  private makePhoneTab(label: string, tab: "loot" | "bag"): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "loot-sheet-tab";
    btn.textContent = label;
    btn.addEventListener("click", () => {
      if (this.phoneTab === tab) return;
      this.phoneTab = tab;
      this.rebuildGrids();
    });
    return btn;
  }

  private syncPhoneSheet(): void {
    const mobile = useMobileSheet();
    if (mobile) this.ensureMs();
    this.overlay.classList.toggle("ms-host", mobile);
    if (this.ms) this.ms.root.hidden = !mobile;
    markSheetOpen("loot", mobile && this.visible);
    if (mobile) {
      this.phoneOn = false;
      this.overlay.classList.remove("phone-sheet");
      this.layoutEl.hidden = true;
      this.phoneRoot.hidden = true;
      this.restoreDesktopBag();
      this.msRender();
      return;
    }
    this.phoneOn = usePhoneDialogSheet();
    this.overlay.classList.toggle("phone-sheet", this.phoneOn);
    this.layoutEl.hidden = this.phoneOn;
    this.phoneRoot.hidden = !this.phoneOn;
    if (!this.phoneOn) {
      this.restoreDesktopBag();
      return;
    }

    const twoWay = this.isTwoWay();
    const bagOn = this.phoneTab === "bag";
    this.phoneLootTab.textContent = twoWay ? "Box" : "Loot";
    this.phoneTabRow.hidden = !twoWay;
    this.phoneLootTab.classList.toggle("loot-sheet-tab--on", !bagOn);
    this.phoneBagTab.classList.toggle("loot-sheet-tab--on", bagOn);
    this.phoneLootPane.hidden = bagOn;
    this.phoneBagPane.hidden = !bagOn;
    if (bagOn) {
      if (this.playerSlotsEl.parentElement !== this.phoneBagPane) {
        this.phoneBagPane.append(this.playerSlotsEl);
      }
    } else {
      this.restoreDesktopBag();
    }

    const count = this.lootItemCount();
    this.phoneTitleEl.textContent =
      this.piles.length > 1 ? "Loot" : furnitureDisplayName(this.objectType);
    this.phoneMetaEl.textContent =
      count === 1 ? "1 item" : `${count} items`;
    this.phoneTakeAllBtn.hidden = bagOn;
    this.phoneTakeAllBtn.disabled = count <= 0;
    this.phoneStoreAllBtn.hidden = !bagOn || !twoWay;
    this.phonePeekBtn.textContent = bagOn
      ? "Back to loot"
      : `Bag ${formatCarrySlots(this.playerInventory, this.extraPockets)}`;
  }

  private restoreDesktopBag(): void {
    if (this.playerSlotsEl.parentElement !== this.playerBodyEl) {
      this.playerBodyEl.append(this.playerSlotsEl);
    }
  }

  private fillPhoneList(): void {
    this.phoneListEl.replaceChildren();
    const showLabels = this.piles.length > 1;
    let rows = 0;
    for (const pile of this.piles) {
      if (showLabels) {
        const label = document.createElement("div");
        label.className = "loot-sheet-pile";
        label.textContent = furnitureDisplayName(pile.objectType);
        this.phoneListEl.append(label);
      }
      const slotCount = this.containerSlotCount(pile.objectType);
      for (let i = 0; i < slotCount; i++) {
        const slot = pile.inventory[i];
        if (!slot) continue;
        rows += 1;
        this.phoneListEl.append(this.makeLootRow(pile, i, slot));
      }
    }
    if (rows === 0) {
      const empty = document.createElement("div");
      empty.className = "loot-sheet-empty";
      empty.textContent = this.isTwoWay() ? "Nothing stored" : "Empty";
      this.phoneListEl.append(empty);
    }
  }

  private makeLootRow(
    pile: LootPileView,
    index: number,
    slot: NonNullable<Inventory[number]>,
  ): HTMLElement {
    const row = document.createElement("div");
    row.className = "loot-sheet-row";
    const icon = document.createElement("div");
    icon.className = "loot-sheet-icon";
    appendItemIcon(icon, slot.id, "loot-sheet-icon-img");
    markQuestKeepsake(icon, slot.id);
    const text = document.createElement("div");
    text.className = "loot-sheet-copy";
    const name = document.createElement("div");
    name.className = "loot-sheet-name";
    const def = getItemDefinition(slot.id);
    name.textContent = def?.name ?? slot.id;
    const meta = document.createElement("div");
    meta.className = "loot-sheet-qty";
    const packed = sealedBackpackStackCount(slot);
    const bits: string[] = [];
    if (slot.quantity > 1) bits.push(`×${slot.quantity}`);
    else if (packed > 0) bits.push(packed === 1 ? "1 inside" : `${packed} inside`);
    const effect = wornGearEffectHint(slot.id);
    if (effect) bits.push(effect);
    meta.textContent = bits.join(" · ");
    text.append(name, meta);
    const take = document.createElement("button");
    take.type = "button";
    take.className = "loot-sheet-take";
    const toSlot = this.findFirstFittingPlayerSlot(slot.id, slot);
    take.textContent = "Take";
    take.disabled = toSlot < 0;
    if (toSlot < 0) take.title = "No room";
    take.addEventListener("click", () => {
      if (this.takeSlot(pile, index)) this.rebuildGrids();
    });
    row.append(icon, text, take);
    return row;
  }

  /** How many were moved. 0 when nothing fit. */
  private takeSlot(pile: LootPileView, index: number): number {
    const slot = pile.inventory[index];
    if (!slot) return 0;
    const toSlot = this.findFirstFittingPlayerSlot(slot.id, slot);
    if (toSlot < 0) return 0;
    const moved = this.applyTakeLocal(pile, index, toSlot, slot);
    if (moved <= 0) return 0;
    this.handlers.onTakeFromContainer(pile.containerId, index, toSlot);
    return moved;
  }

  private applyTakeLocal(
    pile: LootPileView,
    fromSlot: number,
    toSlot: number,
    entry: NonNullable<Inventory[number]>,
  ): number {
    const nextPile = pile.inventory.slice();
    const nextPlayer = this.playerInventory.map((item) =>
      item ? { ...item } : null,
    );
    const dest = nextPlayer[toSlot];
    let moved = entry.quantity;
    if (!dest) {
      nextPlayer[toSlot] = { ...entry };
      nextPile[fromSlot] = null;
    } else if (dest.id === entry.id && slotStackLimit(entry.id, toSlot) > 1) {
      const room = slotStackLimit(entry.id, toSlot) - dest.quantity;
      moved = Math.min(Math.max(room, 0), entry.quantity);
      if (moved <= 0) return 0;
      nextPlayer[toSlot] = { ...dest, quantity: dest.quantity + moved };
      const left = entry.quantity - moved;
      nextPile[fromSlot] = left > 0 ? { ...entry, quantity: left } : null;
    } else {
      nextPile[fromSlot] = { ...dest };
      nextPlayer[toSlot] = { ...entry };
    }
    pile.inventory = nextPile;
    if (this.piles[0] === pile) this.containerInventory = nextPile;
    this.playerInventory = nextPlayer;
    return moved;
  }

  private ensureMs(): void {
    if (this.ms) return;
    const sheet = createSheet({ onClose: () => this.close() });
    sheet.root.classList.add("ms-loot");
    this.overlay.append(sheet.root);
    this.ms = sheet;
  }

  private isDeposit(): boolean {
    return (
      this.objectType === SAFE_DEPOSIT_OBJECT_TYPE ||
      this.piles.some((pile) => pile.objectType === SAFE_DEPOSIT_OBJECT_TYPE)
    );
  }

  private msRender(): void {
    const sheet = this.ms;
    if (!sheet) return;
    const twoWay = this.isTwoWay();
    const boxSlots = this.storageBoxSlots();
    const title = this.piles.length > 1 ? "Loot" : furnitureDisplayName(this.objectType);
    const count = this.lootItemCount();
    sheet.header.setTitle(title);
    if (this.isDeposit()) {
      sheet.header.setSub("Stays safe at the market until you collect it");
    } else if (boxSlots != null) {
      sheet.header.setSub(`${count} of ${boxSlots} slots used`);
    } else {
      sheet.header.setSub(
        count === 0 ? "Searched · empty" : `Searched · ${count === 1 ? "1 item" : `${count} items`}`,
      );
    }
    const { pockets, backpack } = carrySlotGroups(this.playerInventory, this.extraPockets);
    const bagSlots = [...pockets, ...backpack];
    const bagUsed = usedSlotCount(this.playerInventory, bagSlots);
    const lootLabel = boxSlots != null ? (this.isDeposit() ? "Deposit" : "Box") : title;
    renderTabs(
      sheet.tabsSlot,
      [
        {
          id: "loot",
          label: lootLabel,
          count: boxSlots != null ? `${count}/${boxSlots}` : count,
        },
        {
          id: "bag",
          label: "Your bag",
          count: `${bagUsed}/${bagSlots.length}`,
          alert: bagUsed >= bagSlots.length,
        },
      ],
      this.phoneTab,
      (id) => {
        this.phoneTab = id === "bag" ? "bag" : "loot";
        this.msRender();
        sheet.body.scrollTop = 0;
      },
    );
    const scroll = sheet.body.scrollTop;
    const rows = this.phoneTab === "bag" ? this.msBagRows(pockets, backpack, twoWay) : this.msLootRows();
    sheet.body.replaceChildren(...rows);
    sheet.body.scrollTop = scroll;
    sheet.bar.replaceChildren();
    if (this.phoneTab === "bag") {
      if (twoWay) {
        const storeCount = this.msStorePlanCount();
        const store = sheetButton("Store all", "pri", () => this.msStoreAll(), {
          sub: storeCount === 1 ? "1 item" : `${storeCount} items`,
        });
        store.disabled = storeCount <= 0;
        sheet.bar.append(store);
      }
    } else if (count > 0) {
      const takeCount = this.msTakePlanCount();
      const take = sheetButton("Take all", "pri", () => this.msTakeAll(), {
        sub: takeCount === count ? undefined : `${takeCount} fit`,
      });
      take.disabled = takeCount <= 0;
      sheet.bar.append(take);
    }
    sheet.syncBar();
  }

  private msOpenSlotRow(): HTMLElement {
    const row = sheetRow({
      iconEl: document.createElement("span"),
      name: "Empty",
      ariaLabel: "Empty slot",
    });
    row.classList.add("ms-row--open");
    return row;
  }

  private msMeta(slot: NonNullable<Inventory[number]>): (string | Node)[] {
    const chips: (string | Node)[] = [];
    const max = getMaxDurability(slot.id);
    if (max != null && max > 0) {
      const pct = Math.round((getEntryDurability(slot) / max) * 100);
      chips.push(chip(`${pct}%`, pct > 50 ? "g" : pct > 25 ? "y" : "r"));
    }
    const freq = getEntryRadioFreq(slot);
    if (freq > 0) chips.push(chip(String(freq), "y"));
    if (getEntryWetness(slot) > 0.005) chips.push(chip("Wet", "b"));
    const bits: string[] = [];
    const packed = sealedBackpackStackCount(slot);
    if (slot.quantity > 1) bits.push(`×${slot.quantity}`);
    else if (packed > 0) bits.push(packed === 1 ? "1 inside" : `${packed} inside`);
    const effect = wornGearEffectHint(slot.id);
    bits.push(effect || itemCategoryLabel(slot.id));
    chips.push(bits.join(" · "));
    return chips;
  }

  private msLootRows(): HTMLElement[] {
    const sheet = this.ms;
    const rows: HTMLElement[] = [];
    const showLabels = this.piles.length > 1;
    for (const pile of this.piles) {
      const filled: HTMLElement[] = [];
      const open: HTMLElement[] = [];
      const deposit = pile.objectType === SAFE_DEPOSIT_OBJECT_TYPE;
      const slotCount = this.containerSlotCount(pile.objectType);
      for (let i = 0; i < slotCount; i++) {
        const slot = pile.inventory[i];
        if (!slot) {
          if (deposit) open.push(this.msOpenSlotRow());
          continue;
        }
        const name = getItemDefinition(slot.id)?.name ?? slot.id;
        const fits = this.findFirstFittingPlayerSlot(slot.id, slot) >= 0;
        let meta = this.msMeta(slot);
        let metaTone: "warn" | undefined;
        let end: HTMLButtonElement | undefined;
        if (fits) {
          end = sheetButton(
            "Take",
            "pri",
            () => {
              const moved = this.takeSlot(pile, i);
              if (moved <= 0 || !sheet) return;
              this.rebuildGrids();
              showSheetMessage(
                sheet.snackSlot,
                `Took ${name}${moved > 1 ? ` ×${moved}` : ""}. Bag ${formatCarrySlots(this.playerInventory, this.extraPockets)}.`,
              );
            },
            { small: true },
          );
        } else if (
          isBackpackItem(slot.id) &&
          this.canDrop("container", slot, "player", BACKPACK_SLOT_INDEX)
        ) {
          meta = ["No room. Wear it to swap packs."];
          metaTone = "warn";
          end = sheetButton(
            "Wear",
            "sec",
            () => {
              this.handlers.onTakeFromContainer(pile.containerId, i, BACKPACK_SLOT_INDEX);
              if (sheet) showSheetMessage(sheet.snackSlot, `Wearing ${name}.`);
            },
            { small: true },
          );
        } else {
          meta = [
            isHotbarOnlyItem(slot.id)
              ? "Too large for pockets. Free a weapon slot."
              : "No room. Free a pocket first.",
          ];
          metaTone = "warn";
          const blocked = sheetButton("Take", "sec", () => {}, { small: true });
          blocked.disabled = true;
          end = blocked;
        }
        filled.push(
          sheetRow({
            iconItemId: slot.id,
            iconText: name,
            qty: slot.quantity,
            name,
            meta,
            metaTone,
            end,
          }),
        );
      }
      filled.push(...open);
      if (filled.length === 0 && showLabels) continue;
      if (showLabels) rows.push(sectionLabel(furnitureDisplayName(pile.objectType)));
      rows.push(...filled);
    }
    if (rows.length === 0) {
      const empty = document.createElement("p");
      empty.className = "ms-hint ms-loot-empty";
      empty.textContent = this.isTwoWay() ? "Nothing stored yet." : "Nothing left here.";
      rows.push(empty);
    }
    return rows;
  }

  private msBagRows(pockets: number[], backpack: number[], twoWay: boolean): HTMLElement[] {
    const sheet = this.ms;
    const rows: HTMLElement[] = [];
    const rowFor = (index: number): HTMLElement | null => {
      const slot = this.playerInventory[index];
      if (!slot) return null;
      const name = getItemDefinition(slot.id)?.name ?? slot.id;
      let meta = this.msMeta(slot);
      let metaTone: "warn" | undefined;
      let end: HTMLButtonElement | undefined;
      if (twoWay) {
        const stacked = this.containerInventory.reduce(
          (sum, entry) => (entry && entry.id === slot.id ? sum + entry.quantity : sum),
          0,
        );
        if (stacked > 0 && maxStackForItem(slot.id) > 1) {
          meta.push(` · stacks with ${stacked} in the box`);
        }
        let blocked = "";
        if (backpackHoldsItems(this.playerInventory, index)) {
          blocked = "Empty this pack before storing it.";
        } else if (this.findFirstStorageBoxSlot(slot.id) < 0) {
          blocked = "The box is full.";
        }
        if (blocked) {
          meta = [blocked];
          metaTone = "warn";
        }
        end = sheetButton(
          "Store",
          "sec",
          () => {
            const qty = slot.quantity;
            if (!this.storeSlot(index) || !sheet) return;
            this.rebuildGrids();
            showSheetMessage(
              sheet.snackSlot,
              `Stored ${name}${qty > 1 ? ` ×${qty}` : ""}.`,
            );
          },
          { small: true },
        );
        end.disabled = !!blocked;
      }
      return sheetRow({
        iconItemId: slot.id,
        iconText: name,
        qty: slot.quantity,
        name,
        meta,
        metaTone,
        end,
      });
    };
    const section = (label: string, indices: number[]) => {
      const items = indices.map(rowFor).filter((row): row is HTMLElement => !!row);
      if (items.length === 0) return;
      rows.push(sectionLabel(label), ...items);
    };
    section("Pockets", pockets);
    const pack = this.playerInventory[BACKPACK_SLOT_INDEX];
    section(pack ? (getItemDefinition(pack.id)?.name ?? "Backpack") : "Backpack", backpack);
    const worn = MOBILE_WORN_SLOTS.filter((index) => this.playerInventory[index]);
    if (worn.length > 0) {
      rows.push(sectionLabel("Worn", "stays on you"));
      for (const index of worn) {
        const slot = this.playerInventory[index];
        if (!slot) continue;
        const name = getItemDefinition(slot.id)?.name ?? slot.id;
        rows.push(
          sheetRow({
            iconItemId: slot.id,
            iconText: name,
            qty: slot.quantity,
            name,
            meta: twoWay ? ["Take it off in your bag to store it"] : this.msMeta(slot),
            state: twoWay ? "dim" : undefined,
          }),
        );
      }
    }
    if (rows.length === 0) {
      const empty = document.createElement("p");
      empty.className = "ms-hint ms-loot-empty";
      empty.textContent = "Your bag is empty.";
      rows.push(empty);
    }
    return rows;
  }

  private msTakePlanCount(): number {
    const saved = this.playerInventory;
    let draft = saved.map((slot) => (slot ? { ...slot } : null));
    let count = 0;
    try {
      for (const pile of this.piles) {
        const slotCount = this.containerSlotCount(pile.objectType);
        for (let i = 0; i < slotCount; i++) {
          const slot = pile.inventory[i];
          if (!slot) continue;
          this.playerInventory = draft;
          const toSlot = this.findFirstFittingPlayerSlot(slot.id, slot);
          if (toSlot < 0) continue;
          count += 1;
          draft = draft.slice();
          const dest = draft[toSlot];
          draft[toSlot] =
            dest && dest.id === slot.id
              ? { ...dest, quantity: dest.quantity + slot.quantity }
              : { ...slot };
        }
      }
    } finally {
      this.playerInventory = saved;
    }
    return count;
  }

  private msStorePlanCount(): number {
    const saved = this.containerInventory;
    let draft = saved.slice();
    let count = 0;
    try {
      const { pockets, backpack } = carrySlotGroups(this.playerInventory, this.extraPockets);
      for (const index of [...pockets, ...backpack]) {
        const slot = this.playerInventory[index];
        if (!slot || backpackHoldsItems(this.playerInventory, index)) continue;
        this.containerInventory = draft;
        const toSlot = this.findFirstStorageBoxSlot(slot.id);
        if (toSlot < 0) continue;
        count += 1;
        draft = draft.slice();
        const dest = draft[toSlot];
        draft[toSlot] =
          dest && dest.id === slot.id
            ? { ...dest, quantity: dest.quantity + slot.quantity }
            : { ...slot };
      }
    } finally {
      this.containerInventory = saved;
    }
    return count;
  }

  private msTakeAll(): void {
    const before = this.lootItemCount();
    this.takeAll();
    if (!this.visible || !this.ms) return;
    const moved = before - this.lootItemCount();
    const left = this.lootItemCount();
    showSheetMessage(
      this.ms.snackSlot,
      `Took ${moved === 1 ? "1 item" : `${moved} items`}.${left > 0 ? ` ${left} left, no room.` : ""}`,
      left > 0 ? "warn" : "good",
    );
  }

  private msStoreAll(): void {
    const count = this.msStorePlanCount();
    this.storeAll();
    if (this.ms) {
      showSheetMessage(
        this.ms.snackSlot,
        `Stored ${count === 1 ? "1 item" : `${count} items`}.`,
      );
    }
  }

  /** True when the item moved into the box. */
  private storeSlot(fromSlot: number): boolean {
    const slot = this.playerInventory[fromSlot];
    if (!slot || backpackHoldsItems(this.playerInventory, fromSlot)) return false;
    const toSlot = this.findFirstStorageBoxSlot(slot.id);
    if (toSlot < 0) return false;
    this.handlers.onStoreInContainer(this.containerId, fromSlot, toSlot);
    const nextPlayer = this.playerInventory.map((item) => (item ? { ...item } : null));
    nextPlayer[fromSlot] = null;
    this.playerInventory = nextPlayer;
    const nextBox = this.containerInventory.slice();
    const dest = nextBox[toSlot];
    if (dest && dest.id === slot.id) {
      nextBox[toSlot] = { ...dest, quantity: dest.quantity + slot.quantity };
    } else if (!dest) {
      nextBox[toSlot] = { ...slot };
    }
    this.containerInventory = nextBox;
    if (this.piles[0]) this.piles[0].inventory = nextBox;
    return true;
  }

  private takeAll(): void {
    for (const pile of this.piles) {
      const slotCount = this.containerSlotCount(pile.objectType);
      for (let i = 0; i < slotCount; i++) {
        this.takeSlot(pile, i);
      }
    }
    this.rebuildGrids();
  }

  private storeAll(): void {
    if (!this.isTwoWay()) return;
    const fromSlots = [
      ...this.playerInventory.keys(),
    ].filter((idx) => {
      if (!this.playerInventory[idx]) return false;
      if (idx < WEAPON_SLOT_COUNT) return false;
      if (
        idx === ARMOR_SLOT_INDEX ||
        idx === CLOTHING_SLOT_INDEX ||
        idx === BACKPACK_SLOT_INDEX ||
        idx === WATCH_SLOT_INDEX ||
        idx === RADIO_SLOT_INDEX ||
        idx === NECK_SLOT_INDEX ||
        idx === LEFT_HAND_SLOT_INDEX ||
        idx === RIGHT_HAND_SLOT_INDEX ||
        idx === MAP_SLOT_INDEX
      ) {
        return false;
      }
      return true;
    });
    for (const from of fromSlots) {
      const slot = this.playerInventory[from];
      if (!slot) continue;
      if (backpackHoldsItems(this.playerInventory, from)) continue;
      const toSlot = this.findFirstStorageBoxSlot(slot.id);
      if (toSlot < 0) continue;
      this.handlers.onStoreInContainer(this.containerId, from, toSlot);
      const nextPlayer = this.playerInventory.map((item) =>
        item ? { ...item } : null,
      );
      nextPlayer[from] = null;
      this.playerInventory = nextPlayer;
      const nextBox = this.containerInventory.slice();
      const dest = nextBox[toSlot];
      if (!dest) nextBox[toSlot] = { ...slot };
      else if (dest.id === slot.id) {
        nextBox[toSlot] = { ...dest, quantity: dest.quantity + slot.quantity };
      }
      this.containerInventory = nextBox;
      if (this.piles[0]) this.piles[0].inventory = nextBox;
    }
    this.rebuildGrids();
  }

  private createCell(
    source: DragSource,
    index: number,
    slot: Inventory[number],
    containerId = "",
  ): HTMLElement {
    const cell = document.createElement("div");
    cell.className = "inventory-cell";
    cell.dataset.slotIndex = String(index);
    cell.dataset.source = source;
    if (containerId) cell.dataset.containerId = containerId;
    cell.setAttribute("role", "button");
    cell.tabIndex = 0;

    if (source === "player" && index === CLOTHING_SLOT_INDEX) {
      cell.classList.add("inventory-cell--clothing");
    }
    if (source === "player" && isWatchSlot(index)) {
      cell.classList.add("inventory-cell--watch");
    }
    if (source === "player" && isRadioSlot(index)) {
      cell.classList.add("inventory-cell--radio");
    }
    if (source === "player" && isArmorSlot(index)) {
      cell.classList.add("inventory-cell--armor");
    }
    if (source === "player" && isNeckSlot(index)) {
      cell.classList.add("inventory-cell--neck");
    }
    if (source === "player" && isHandSlot(index)) {
      cell.classList.add("inventory-cell--hand");
    }
    if (source === "player" && isMapSlot(index)) {
      cell.classList.add("inventory-cell--map");
    }
    if (source === "player" && isBackpackSlot(index)) {
      cell.classList.add("inventory-cell--backpack");
    }
    if (source === "player" && isBackpackStorageIndex(index)) {
      cell.classList.add("inventory-cell--backpack-storage");
    }
    if (source === "player" && index < WEAPON_SLOT_COUNT) {
      cell.classList.add("inventory-cell--weapon");
      const keyEl = document.createElement("span");
      keyEl.className = "inventory-cell-key";
      keyEl.textContent = String(index + 1);
      cell.appendChild(keyEl);
    }

    if (!slot) {
      cell.classList.add("inventory-cell--empty");
      cell.setAttribute(
        "aria-label",
        `Empty ${source} slot ${index + 1}`,
      );
    } else {
      const def = getItemDefinition(slot.id);
      const category = def?.category ?? "crafting";
      cell.style.setProperty("--slot-accent", CATEGORY_COLORS[category] ?? "#555");
      cell.classList.add("inventory-cell--filled");
      markQuestKeepsake(cell, slot.id);

      if (!appendItemIcon(cell, slot.id, "inventory-cell-icon")) {
        const label = document.createElement("span");
        label.className = "inventory-cell-label";
        label.textContent = shortLabel(def?.name ?? slot.id);
        cell.appendChild(label);
      }

      const packedCount = sealedBackpackStackCount(slot);
      if (slot.quantity > 1 || packedCount > 0) {
        const qty = document.createElement("span");
        qty.className = "inventory-cell-qty";
        qty.textContent = String(slot.quantity > 1 ? slot.quantity : packedCount);
        if (packedCount > 0 && slot.quantity <= 1) {
          qty.title = packedCount === 1 ? "1 item inside" : `${packedCount} items inside`;
        }
        cell.appendChild(qty);
      }
      const radioFreq = getEntryRadioFreq(slot);
      if (radioFreq > 0) {
        const freqEl = document.createElement("span");
        freqEl.className = "inventory-cell-freq";
        freqEl.textContent = String(radioFreq);
        cell.appendChild(freqEl);
      }
      appendItemDurabilityBar(cell, slot);
      appendItemWetnessBar(cell, slot);

      const effect = wornGearEffectHint(slot.id);
      const itemName = def?.name ?? slot.id;
      if (effect) cell.title = `${itemName} · ${effect}`;
      cell.setAttribute(
        "aria-label",
        `${itemName}${slot.quantity > 1 ? ` ×${slot.quantity}` : ""}${
          packedCount > 0 ? ` · ${packedCount} inside` : ""
        }${
          getEntryRadioFreq(slot) > 0 ? ` · freq ${getEntryRadioFreq(slot)}` : ""
        }${
          getMaxDurability(slot.id) != null
            ? ` · ${getEntryDurability(slot)}/${getMaxDurability(slot.id)}`
            : ""
        }${effect ? ` · ${effect}` : ""}`,
      );

      const takeToInventory = () => {
        if (source !== "container") return;
        const toSlot = this.findFirstFittingPlayerSlot(slot.id, slot);
        if (toSlot < 0) return;
        this.handlers.onTakeFromContainer(containerId, index, toSlot);
      };

      const storeToBox = () => {
        if (source !== "player" || this.storageBoxSlots() == null) return;
        if (backpackHoldsItems(this.playerInventory, index)) return;
        const toSlot = this.findFirstStorageBoxSlot(slot.id);
        if (toSlot < 0) return;
        this.handlers.onStoreInContainer(this.containerId, index, toSlot);
      };

      bindSlotPointerDnD({
        cell,
        root: this.overlay,
        tapKey: `${source}:${containerId}:${index}`,
        getLastTap: () => this.lastTap,
        setLastTap: (tap) => {
          this.lastTap = tap;
        },
        resolveTarget: (el) => {
          const hit = el?.closest?.(".inventory-cell") as HTMLElement | null;
          return hit && this.overlay.contains(hit) ? hit : null;
        },
        canDropOn: (target, shift) => {
          const toSource = target.dataset.source as DragSource | undefined;
          const toSlot = Number(target.dataset.slotIndex);
          if (!toSource || !Number.isFinite(toSlot)) return false;
          if (
            toSource === source &&
            toSlot === index &&
            (source !== "container" || target.dataset.containerId === containerId)
          ) {
            return false;
          }
          if (
            source === "container" &&
            toSource === "container" &&
            target.dataset.containerId !== containerId
          ) {
            return false;
          }
          if (
            shift &&
            source === "player" &&
            shiftSplitQuantity(slot.quantity) >= 1
          ) {
            return (
              toSource === "player" &&
              canSplitInventoryStackHalf(
                this.playerInventory,
                index,
                toSlot,
                this.extraPockets,
              )
            );
          }
          return this.canDrop(source, slot, toSource, toSlot);
        },
        shiftGhostQuantity: (shift) => {
          if (!shift || source !== "player") return null;
          const qty = shiftSplitQuantity(slot.quantity);
          return qty >= 1 ? qty : null;
        },
        onDropOn: (target, shift) => {
          const toSource = target.dataset.source as DragSource | undefined;
          const toSlot = Number(target.dataset.slotIndex);
          if (!toSource || !Number.isFinite(toSlot)) return;
          if (
            toSource === source &&
            toSlot === index &&
            (source !== "container" || target.dataset.containerId === containerId)
          ) {
            return;
          }
          if (
            source === "container" &&
            toSource === "container" &&
            target.dataset.containerId !== containerId
          ) {
            return;
          }
          const split =
            shift &&
            source === "player" &&
            toSource === "player" &&
            shiftSplitQuantity(slot.quantity) >= 1;
          if (split) {
            if (
              !canSplitInventoryStackHalf(
                this.playerInventory,
                index,
                toSlot,
                this.extraPockets,
              )
            ) {
              return;
            }
            this.handlers.onMovePlayerSlot(index, toSlot, true);
            return;
          }
          if (!this.canDrop(source, slot, toSource, toSlot)) return;

          if (source === "container" && toSource === "player") {
            this.handlers.onTakeFromContainer(containerId, index, toSlot);
          } else if (source === "container" && toSource === "container") {
            this.handlers.onMoveInContainer(containerId, index, toSlot);
          } else if (source === "player" && toSource === "player") {
            this.handlers.onMovePlayerSlot(index, toSlot, false);
          } else if (
            source === "player" &&
            toSource === "container" &&
            this.storageBoxSlots() != null
          ) {
            // Player cells have no container id. The box id is on the slot dropped onto.
            const boxId = target.dataset.containerId || this.containerId;
            if (!boxId) return;
            this.handlers.onStoreInContainer(boxId, index, toSlot);
          }
        },
        onDragBegan: () => {
          this.dragFromSlot = index;
          this.dragFromSource = source;
        },
        onDragEnded: () => {
          this.dragFromSlot = -1;
          this.dragFromSource = null;
          cell.classList.remove("inventory-cell--dragging");
          this.clearDragOverStates();
        },
        onDoubleActivate: usePhoneDialogSheet()
          ? undefined
          : source === "container"
            ? takeToInventory
            : source === "player" && this.storageBoxSlots() != null
              ? storeToBox
              : undefined,
        clearHover: () => this.clearDragOverStates(),
        setHover: (target, valid) => {
          target.classList.toggle("inventory-cell--drag-over", valid);
          target.classList.toggle("inventory-cell--drag-invalid", !valid);
        },
      });
    }

    if (usePhoneDialogSheet() && slot) {
      cell.addEventListener("click", () => {
        if (source === "container") {
          const pile = this.piles.find((entry) => entry.containerId === containerId);
          if (!pile) return;
          if (this.takeSlot(pile, index)) this.rebuildGrids();
          return;
        }
        if (source === "player" && this.isTwoWay()) {
          if (backpackHoldsItems(this.playerInventory, index)) return;
          const toSlot = this.findFirstStorageBoxSlot(slot.id);
          if (toSlot < 0) return;
          this.handlers.onStoreInContainer(this.containerId, index, toSlot);
        }
      });
    }

    return cell;
  }

  private canDrop(
    fromSource: DragSource,
    entry: { id: string; quantity: number; contents?: ({ id: string; quantity: number } | null)[] },
    toSource: DragSource,
    toSlot: number,
  ): boolean {
    const itemId = entry.id;
    const access = inventorySlotAccess(this.playerInventory, this.extraPockets);
    if (fromSource === "container" && toSource === "player") {
      if (loadedBackpackStowBlocked(entry, toSlot)) return false;
      if (!itemFitsInSlot(itemId, toSlot, access)) return false;
      if (isJewelrySlot(toSlot)) {
        const dest = this.playerInventory[toSlot];
        if (dest && (entry.quantity > 1 || dest.id === itemId)) return false;
      }
      if (toSlot === BACKPACK_SLOT_INDEX && isBackpackItem(itemId)) return true;
      const next = this.playerInventory.map((slot) => (slot ? { ...slot } : null));
      next[toSlot] = { id: itemId, quantity: 1 };
      return !backpackOverflowWorsened(this.playerInventory, next);
    }
    if (fromSource === "container" && toSource === "container") return true;
    if (fromSource === "player" && toSource === "player") {
      const fromSlot = this.dragFromSlot >= 0 ? this.dragFromSlot : toSlot;
      return (
        moveInventorySlot(
          this.playerInventory,
          fromSlot,
          toSlot,
          this.extraPockets,
        ) !== this.playerInventory
      );
    }
    if (
      fromSource === "player" &&
      toSource === "container" &&
      this.storageBoxSlots() != null &&
      toSlot >= 0 &&
      toSlot < (this.storageBoxSlots() ?? 0)
    ) {
      const fromSlot = this.dragFromSlot >= 0 ? this.dragFromSlot : toSlot;
      if (backpackHoldsItems(this.playerInventory, fromSlot)) return false;
      const dest = this.containerInventory[toSlot];
      if (!dest) return true;
      if (dest.id === itemId && maxStackForItem(itemId) > 1) return true;
      return itemFitsInSlot(dest.id, fromSlot, access);
    }
    return false;
  }

  private isStorageBoxPile(objectType: string): boolean {
    return storageBoxSlotsForObjectType(objectType) != null;
  }

  private storageBoxSlots(): number | null {
    return storageBoxSlotsForObjectType(this.objectType);
  }

  private containerSlotCount(objectType: string): number {
    return storageBoxSlotsForObjectType(objectType) ?? CONTAINER_INVENTORY_SLOTS;
  }

  private parsePileInventory(objectType: string, containerJson: string): Inventory {
    const slots = storageBoxSlotsForObjectType(objectType);
    return slots != null
      ? parseStorageBoxInventory(containerJson, slots)
      : parseContainerInventory(containerJson);
  }

  private findFirstStorageBoxSlot(itemId: string): number {
    const limit = this.storageBoxSlots() ?? 0;
    const maxStack = maxStackForItem(itemId);
    if (maxStack > 1) {
      for (let i = 0; i < limit; i++) {
        const slot = this.containerInventory[i];
        if (slot?.id === itemId && slot.quantity < maxStack) return i;
      }
    }
    for (let i = 0; i < limit; i++) {
      if (!this.containerInventory[i]) return i;
    }
    return -1;
  }

  private findFirstFittingPlayerSlot(
    itemId: string,
    entry?: { id: string; contents?: ({ id: string; quantity: number } | null)[] },
  ): number {
    const maxStack = maxStackForItem(itemId);
    const access = inventorySlotAccess(this.playerInventory, this.extraPockets);
    const loadedPack = backpackContentsHaveItems(entry);
    const dedicated = isBackpackItem(itemId)
      ? BACKPACK_SLOT_INDEX
      : isWatchItem(itemId)
        ? WATCH_SLOT_INDEX
        : itemId === RADIO_ITEM_ID
          ? RADIO_SLOT_INDEX
          : itemId === MAP_ITEM_ID
            ? MAP_SLOT_INDEX
            : -1;
    if (dedicated >= 0) {
      const slot = this.playerInventory[dedicated];
      if (!slot && itemFitsInSlot(itemId, dedicated, access)) return dedicated;
    }

    // Prefer an existing stack with room before opening a new slot.
    if (maxStack > 1) {
      for (let i = 0; i < this.playerInventory.length; i++) {
        const slot = this.playerInventory[i];
        if (!slot || slot.id !== itemId) continue;
        if (!itemFitsInSlot(itemId, i, access)) continue;
        const cap = slotStackLimit(itemId, i);
        if (slot.quantity < cap) return i;
      }
    }

    for (let i = 0; i < this.playerInventory.length; i++) {
      if (this.playerInventory[i]) continue;
      if (loadedPack && loadedBackpackStowBlocked(entry, i)) continue;
      if (itemFitsInSlot(itemId, i, access)) return i;
    }
    return -1;
  }

  private clearDragOverStates() {
    this.overlay
      .querySelectorAll(
        ".inventory-cell--drag-over, .inventory-cell--drag-invalid",
      )
      .forEach((el) => {
        el.classList.remove(
          "inventory-cell--drag-over",
          "inventory-cell--drag-invalid",
        );
      });
  }

  destroy() {
    cancelAllSlotDrags();
    this.visible = false;
    this.unbindPhoneResize();
    this.unbindPhoneResize = () => {};
    this.restoreDesktopBag();
    this.overlay.hidden = true;
    this.containerId = "";
    document.body.classList.remove("container-loot-open");
    this.overlay.remove();
  }
}
