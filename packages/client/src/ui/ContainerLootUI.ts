import {
  backpackOverflowWorsened,
  sealedBackpackStackCount,
  BACKPACK_SLOT_INDEX,
  BACKPACK_STORAGE_START,
  BASE_INVENTORY_SLOTS,
  CLOTHING_SLOT_INDEX,
  POCKET_SLOT_COUNT,
  retiredPocketIndices,
  shownBackpackStorageCount,
  inventorySlotAccess,
  isBackpackItem,
  isBackpackSlot,
  isBackpackStorageIndex,
  moveInventorySlot,
  shownExtraPockets,
  CONTAINER_INVENTORY_SLOTS,
  parseStorageBoxInventory,
  storageBoxSlotsForObjectType,
  RADIO_ITEM_ID,
  RADIO_SLOT_INDEX,
  MAP_ITEM_ID,
  MAP_SLOT_INDEX,
  WATCH_ITEM_ID,
  WATCH_SLOT_INDEX,
  WEAPON_SLOT_COUNT,
  getEntryDurability,
  getEntryRadioFreq,
  getItemDefinition,
  getMaxDurability,
  isRadioSlot,
  isWatchSlot,
  isMapSlot,
  itemFitsInSlot,
  canSplitInventoryStackHalf,
  shiftSplitQuantity,
  maxStackForItem,
  containerInventoryIsEmpty,
  parseContainerInventory,
  parseInventory,
  type Inventory,
} from "@zombie/shared";
import { isMobileDevice } from "../device";
import { appendItemDurabilityBar, appendItemIcon, appendItemWetnessBar, markQuestKeepsake } from "./itemIcons";
import { createDialogCloseButton } from "./dialogCloseBtn";
import { resetDialogScroll } from "./dialogScroll";
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
  canteenchair: "Canteen Chair",
  fallentree: "Fallen Tree",
  zombie: "Zombie",
  guard: "Guard",
  coyote: "Coyote",
  bear: "Bear",
  storagebox: "Storage Box",
  storagebox2: "Storage Box 2",
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
  onClose: () => void;
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
  private titleEl: HTMLElement;
  private containerSlotsEl: HTMLElement;
  private playerSlotsEl: HTMLElement;
  private playerWeaponsEl: HTMLElement;
  private playerRadioEl: HTMLElement;
  private playerEquipmentEl: HTMLElement;
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

    const playerHeader = document.createElement("div");
    playerHeader.className = "inventory-header";
    const playerTitle = document.createElement("h2");
    playerTitle.className = "inventory-title";
    playerTitle.textContent = "Inventory";
    const playerHint = document.createElement("span");
    playerHint.className = "inventory-hint";
    playerHint.textContent = "Weapons · Radio · Clothing · Backpack · Watch · Map · Pockets";
    playerHeader.append(playerTitle, playerHint);

    const playerBody = document.createElement("div");
    playerBody.className = "inventory-grid-wrap container-loot-player-body";

    const weaponsSection = document.createElement("div");
    weaponsSection.className = "inventory-section";
    const weaponRowLabels = document.createElement("div");
    weaponRowLabels.className = "inventory-weapon-row-labels";
    const weaponsLabel = document.createElement("div");
    weaponsLabel.className = "inventory-section-label inventory-weapon-row-label";
    weaponsLabel.textContent = "Weapons";
    const radioLabel = document.createElement("div");
    radioLabel.className = "inventory-section-label inventory-radio-row-label";
    radioLabel.textContent = "Radio";
    weaponRowLabels.append(weaponsLabel, radioLabel);
    const weaponRow = document.createElement("div");
    weaponRow.className = "inventory-weapon-row";
    this.playerWeaponsEl = document.createElement("div");
    this.playerWeaponsEl.className = "inventory-grid inventory-grid--weapons";
    this.playerRadioEl = document.createElement("div");
    this.playerRadioEl.className = "inventory-grid inventory-grid--radio";
    weaponRow.append(this.playerWeaponsEl, this.playerRadioEl);
    weaponsSection.append(weaponRowLabels, weaponRow);

    const equipmentSection = document.createElement("div");
    equipmentSection.className = "inventory-section";
    const equipmentLabels = document.createElement("div");
    equipmentLabels.className = "inventory-equipment-labels";
    for (const text of ["Clothing", "Backpack", "Watch", "Map"]) {
      const lab = document.createElement("div");
      lab.className = "inventory-section-label";
      lab.textContent = text;
      equipmentLabels.appendChild(lab);
    }
    this.playerEquipmentEl = document.createElement("div");
    this.playerEquipmentEl.className = "inventory-grid inventory-grid--equipment";
    equipmentSection.append(equipmentLabels, this.playerEquipmentEl);

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
    this.playerSlotsEl.append(weaponsSection, equipmentSection, carryScroll);
    playerBody.appendChild(this.playerSlotsEl);
    playerPanel.append(playerHeader, playerBody);

    layout.append(sourcePanel, playerPanel);
    this.overlay.appendChild(layout);
    document.body.appendChild(this.overlay);

    this.overlay.addEventListener("click", (event) => {
      if (event.target === this.overlay) this.close();
    });
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
    this.overlay.hidden = false;
    document.body.classList.add("container-loot-open");
    this.extraPockets = extraPockets;
    this.playerInventory = parseInventory(playerInventoryJson);
    this.containerInventory = this.piles[0]?.inventory ?? [];
    this.titleEl.textContent =
      this.piles.length > 1 ? "Loot" : furnitureDisplayName(this.objectType);
    this.rebuildGrids();
    resetDialogScroll(this.overlay);
  }

  close() {
    if (!this.visible) return;
    cancelAllSlotDrags();
    this.visible = false;
    this.overlay.hidden = true;
    this.containerId = "";
    this.piles = [];
    this.dragFromSlot = -1;
    this.dragFromSource = null;
    this.lastTap = null;
    document.body.classList.remove("container-loot-open");
    this.handlers.onClose();
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
    this.playerRadioEl.replaceChildren();
    this.playerEquipmentEl.replaceChildren();
    this.playerPocketsEl.replaceChildren();
    this.playerBackpackEl.replaceChildren();

    for (let i = 0; i < WEAPON_SLOT_COUNT; i++) {
      this.playerWeaponsEl.appendChild(
        this.createCell("player", i, this.playerInventory[i] ?? null),
      );
    }
    this.playerRadioEl.appendChild(
      this.createCell(
        "player",
        RADIO_SLOT_INDEX,
        this.playerInventory[RADIO_SLOT_INDEX] ?? null,
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

      cell.setAttribute(
        "aria-label",
        `${def?.name ?? slot.id}${slot.quantity > 1 ? ` ×${slot.quantity}` : ""}${
          packedCount > 0 ? ` · ${packedCount} inside` : ""
        }${
          getEntryRadioFreq(slot) > 0 ? ` · freq ${getEntryRadioFreq(slot)}` : ""
        }${
          getMaxDurability(slot.id) != null
            ? ` · ${getEntryDurability(slot)}/${getMaxDurability(slot.id)}`
            : ""
        }`,
      );

      const takeToInventory = () => {
        if (source !== "container") return;
        const toSlot = this.findFirstFittingPlayerSlot(slot.id);
        if (toSlot < 0) return;
        this.handlers.onTakeFromContainer(containerId, index, toSlot);
      };

      const storeToBox = () => {
        if (source !== "player" || this.storageBoxSlots() == null) return;
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
          if (shift) {
            return (
              source === "player" &&
              toSource === "player" &&
              canSplitInventoryStackHalf(
                this.playerInventory,
                index,
                toSlot,
                this.extraPockets,
              )
            );
          }
          return this.canDrop(source, slot.id, toSource, toSlot);
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
          if (shift && !(source === "player" && toSource === "player")) return;
          if (!this.canDrop(source, slot.id, toSource, toSlot)) return;

          if (source === "container" && toSource === "player") {
            this.handlers.onTakeFromContainer(containerId, index, toSlot);
          } else if (source === "container" && toSource === "container") {
            this.handlers.onMoveInContainer(containerId, index, toSlot);
          } else if (source === "player" && toSource === "player") {
            this.handlers.onMovePlayerSlot(index, toSlot, shift);
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
        onDoubleActivate:
          source === "container"
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

    return cell;
  }

  private canDrop(
    fromSource: DragSource,
    itemId: string,
    toSource: DragSource,
    toSlot: number,
  ): boolean {
    const access = inventorySlotAccess(this.playerInventory, this.extraPockets);
    if (fromSource === "container" && toSource === "player") {
      if (!itemFitsInSlot(itemId, toSlot, access)) return false;
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
      const dest = this.containerInventory[toSlot];
      if (!dest) return true;
      if (dest.id === itemId && maxStackForItem(itemId) > 1) return true;
      const fromSlot = this.dragFromSlot >= 0 ? this.dragFromSlot : toSlot;
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

  private findFirstFittingPlayerSlot(itemId: string): number {
    const maxStack = maxStackForItem(itemId);
    const access = inventorySlotAccess(this.playerInventory, this.extraPockets);
    const dedicated = isBackpackItem(itemId)
      ? BACKPACK_SLOT_INDEX
      : itemId === WATCH_ITEM_ID
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
        if (slot.quantity < maxStack) return i;
      }
    }

    for (let i = 0; i < this.playerInventory.length; i++) {
      if (this.playerInventory[i]) continue;
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
    this.overlay.hidden = true;
    this.containerId = "";
    document.body.classList.remove("container-loot-open");
    this.overlay.remove();
  }
}
