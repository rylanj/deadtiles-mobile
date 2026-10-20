import {
  BASE_INVENTORY_SLOTS,
  BACKPACK_SLOT_INDEX,
  BACKPACK_STORAGE_START,
  sealedBackpackStackCount,
  canUseConsumable,
  ARMOR_SLOT_INDEX,
  CLOTHING_SLOT_INDEX,
  LEFT_HAND_SLOT_INDEX,
  NECK_SLOT_INDEX,
  RIGHT_HAND_SLOT_INDEX,
  WATCH_SLOT_INDEX,
  RADIO_SLOT_INDEX,
  MAP_SLOT_INDEX,
  POCKET_SLOT_COUNT,
  retiredPocketIndices,
  shownBackpackStorageCount,
  isArmorSlot,
  isBackpackItem,
  isBackpackSlot,
  isBackpackStorageIndex,
  isHandSlot,
  isJewelrySlot,
  isNeckSlot,
  getEntryDurability,
  getEntryRadioFreq,
  getEntryWetness,
  isListenOnlyRadioFreq,
  isRadioItem,
  wornGearEffectHint,
  getItemDefinition,
  getReadableItemText,
  isReadableItem,
  getMaxDurability,
  WEAPON_SLOT_COUNT,
  isClothingItem,
  isConsumable,
  isWeaponBlueprint,
  isSkillMagazine,
  isHotbarOnlyItem,
  isRadioSlot,
  isWatchSlot,
  isMapSlot,
  moveInventorySlot,
  canSplitInventoryStackHalf,
  shownExtraPockets,
  shiftSplitQuantity,
  parseInventory,
  parseWeaponMagazines,
  getStoredMagazineRounds,
  getAmmoTypeForWeapon,
  canAddToInventory,
  weaponIndexFromItemId,
  backpackContentsHaveItems,
  inventorySlotAccess,
  itemFitsInSlot,
  loadedBackpackStowBlocked,
  type Inventory,
} from "@zombie/shared";
import { AudioManager } from "../audio/AudioManager";
import { isMobileDevice } from "../device";
import "./mobile/bag.css";
import { carrySlotGroups, formatCarrySlots, usedSlotCount } from "./carrySlots";
import {
  createSheet,
  createStepper,
  drawerHead,
  itemIconImg,
  kvCard,
  markSheetOpen,
  meter,
  openDrawer,
  quickAmounts,
  sectionLabel,
  setButtonLabel,
  sheetButton,
  showSheetMessage,
  useMobileSheet,
  type Drawer,
  type KvRow,
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

export type InventoryUIHandlers = {
  onEquip: (slotIndex: number) => void;
  onUnequip: () => void;
  onWearClothing: (slotIndex: number) => void;
  onRemoveClothing: () => void;
  onDrop: (slotIndex: number, quantity?: number) => void;
  onMoveSlot: (fromSlot: number, toSlot: number, splitHalf?: boolean) => void;
  onUse: (slotIndex: number) => void;
  onUnload: (slotIndex: number) => void;
};

export type InventoryPlayerStats = {
  health: number;
  hunger: number;
  thirst: number;
  temperature?: number;
  maxHealth: number;
  maxHunger: number;
  maxThirst: number;
  infected?: boolean;
};

const CATEGORY_COLORS: Record<string, string> = {
  weapons: "#8b4558",
  clothing: "#4a6a8a",
  equipment: "#5a6a4a",
  backpack: "#5c6b45",
  ammunition: "#6b7a3a",
  medical: "#3a7070",
  crafting: "#6a6040",
  food: "#8a6840",
  drink: "#406080",
  junk: "#5a5a4a",
  magazine: "#4d5d73",
};

function emptyGearSlotHint(slotIndex: number): string | null {
  if (isArmorSlot(slotIndex)) return "Armor slot. Reserved for armor.";
  if (isNeckSlot(slotIndex)) return "Neck. Gold chain, silver chain, or dog tag.";
  if (slotIndex === LEFT_HAND_SLOT_INDEX) return "Left hand. Gold ring or silver ring.";
  if (slotIndex === RIGHT_HAND_SLOT_INDEX) return "Right hand. Gold ring or silver ring.";
  return null;
}

function shortLabel(name: string): string {
  if (name.length <= 10) return name;
  const first = name.split(/\s+/)[0] ?? name;
  return first.length <= 10 ? first : `${first.slice(0, 9)}…`;
}

/** Worn row on the mobile bag, in board order. */
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

/** Caption and faint silhouette for an empty worn slot. */
function wornSlotGhost(slotIndex: number): { caption: string; iconId?: string } {
  if (slotIndex === 0) return { caption: "Weapon", iconId: "weapon_bat" };
  if (slotIndex === 1) return { caption: "Weapon", iconId: "weapon_pistol" };
  if (isArmorSlot(slotIndex)) return { caption: "Armor" };
  if (slotIndex === CLOTHING_SLOT_INDEX) return { caption: "Clothing", iconId: "white_tshirt" };
  if (isBackpackSlot(slotIndex)) return { caption: "Pack", iconId: "backpack_small" };
  if (isWatchSlot(slotIndex)) return { caption: "Watch", iconId: "watch" };
  if (isRadioSlot(slotIndex)) return { caption: "Radio", iconId: "handheld_radio" };
  if (isNeckSlot(slotIndex)) return { caption: "Neck", iconId: "gold_chain" };
  if (slotIndex === LEFT_HAND_SLOT_INDEX) return { caption: "L hand", iconId: "silver_ring" };
  if (slotIndex === RIGHT_HAND_SLOT_INDEX) return { caption: "R hand", iconId: "gold_ring" };
  if (isMapSlot(slotIndex)) return { caption: "Map", iconId: "map" };
  return { caption: "" };
}

function emptyWornSlotHint(slotIndex: number): string | null {
  if (slotIndex < WEAPON_SLOT_COUNT) {
    return `Weapon slot ${slotIndex + 1}. Holds a weapon for the hotbar.`;
  }
  if (slotIndex === CLOTHING_SLOT_INDEX) return "Clothing slot. Wear a shirt or jacket here.";
  if (isBackpackSlot(slotIndex)) return "Backpack slot. Wear a pack for more room.";
  if (isWatchSlot(slotIndex)) return "Watch slot. Wear a watch to see the time.";
  if (isRadioSlot(slotIndex)) return "Radio slot. Holds a handheld radio.";
  if (isMapSlot(slotIndex)) return "Map slot. Holds a map.";
  return emptyGearSlotHint(slotIndex);
}

function isMobileWornSlot(slotIndex: number): boolean {
  return MOBILE_WORN_SLOTS.includes(slotIndex);
}

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

function itemCategoryLabel(itemId: string): string {
  const def = getItemDefinition(itemId);
  if (weaponIndexFromItemId(itemId) >= 0) {
    return getAmmoTypeForWeapon(itemId) ? "Firearm" : "Melee weapon";
  }
  return CATEGORY_LABELS[def?.category ?? ""] ?? "Item";
}

function itemName(itemId: string): string {
  return getItemDefinition(itemId)?.name ?? itemId;
}

function signed(n: number): string {
  const v = Math.round(n);
  return v >= 0 ? `+${v}` : `−${Math.abs(v)}`;
}

function seconds(ms: number): string {
  const s = Math.round(ms / 100) / 10;
  return `${s} s`;
}

export class InventoryUI {
  private visible = false;
  private selectedSlot = -1;
  private dragFromSlot = -1;
  private currentInventory: Inventory = [];
  private equippedInventorySlot = -1;
  private equippedClothingSlot = -1;
  private weaponMagazinesJson = "{}";
  private equippedMagazineRounds = 0;
  /** Last tap on a weapon cell — used for mobile double-tap equip. */
  private lastTap: SlotTapState = null;
  private playerStats: InventoryPlayerStats = {
    health: 100,
    hunger: 100,
    thirst: 100,
    temperature: 37,
    maxHealth: 100,
    maxHunger: 100,
    maxThirst: 100,
  };
  private overlay: HTMLElement;
  private titleEl!: HTMLElement;
  private countEl!: HTMLElement;
  private hintEl!: HTMLElement;
  private gridEl: HTMLElement;
  private wornEl!: HTMLElement;
  private detailEl: HTMLElement;
  private vitalsEl!: HTMLElement;
  private footerEl: HTMLElement;
  private unbindPhoneResize: () => void = () => {};
  private extraPockets = 0;
  private weaponSlotsEl: HTMLElement;
  private armorSlotEl: HTMLElement;
  private equipmentSlotsEl: HTMLElement;
  private jewelrySlotsEl: HTMLElement;
  private pocketSlotsEl: HTMLElement;
  private backpackSection: HTMLElement;
  private backpackSlotsEl: HTMLElement;
  private dropBtn: HTMLButtonElement;
  private dropAllBtn: HTMLButtonElement;
  private useBtn: HTMLButtonElement;
  private unloadBtn: HTMLButtonElement;
  private equipBtn: HTMLButtonElement;
  private unequipBtn: HTMLButtonElement;
  private wearBtn: HTMLButtonElement;
  private readBtn: HTMLButtonElement;
  private readOverlay!: HTMLElement;
  private readTitleEl!: HTMLElement;
  private readBodyEl!: HTMLElement;
  private panelEl!: HTMLElement;
  private ms: Sheet | null = null;
  private msVitalsEl: HTMLElement | null = null;
  private msCancelBtn: HTMLButtonElement | null = null;
  private msDrawer: Drawer | null = null;
  private msDrawerKey = "";
  private msDrawerResize: ResizeObserver | null = null;
  /** Drop quantity picker, shown in the drawer while set. */
  private msDropQty: number | null = null;
  private msMove: { from: number; half: boolean } | null = null;
  private msScrollToSelection = false;
  /** Ignore the click a finished drag can leave on the cell under the finger. */
  private msTapGuardUntil = 0;

  constructor(private handlers: InventoryUIHandlers) {
    this.overlay = document.createElement("div");
    this.overlay.id = "inventory-overlay";
    this.overlay.hidden = true;

    const panel = document.createElement("div");
    panel.className = "inventory-panel";
    this.panelEl = panel;

    const header = document.createElement("div");
    header.className = "inventory-header";
    const headerTop = document.createElement("div");
    headerTop.className = "inventory-header-top";
    this.titleEl = document.createElement("h2");
    this.titleEl.className = "inventory-title";
    this.titleEl.textContent = "Inventory";
    this.countEl = document.createElement("span");
    this.countEl.className = "inventory-count";
    this.countEl.textContent = "0/0";
    headerTop.append(
      this.titleEl,
      this.countEl,
      createDialogCloseButton(() => this.close()),
    );
    this.hintEl = document.createElement("span");
    this.hintEl.className = "inventory-hint";
    this.hintEl.textContent = isMobileDevice()
      ? "Tap a slot, then tap another to move"
      : "Drag to move · shift-drag moves half · double-click weapon to equip · Tab to close";
    header.append(headerTop, this.hintEl);

    this.gridEl = document.createElement("div");
    this.gridEl.className = "inventory-grid-wrap";

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
    this.weaponSlotsEl = document.createElement("div");
    this.weaponSlotsEl.className = "inventory-grid inventory-grid--weapons";
    this.armorSlotEl = document.createElement("div");
    this.armorSlotEl.className = "inventory-grid inventory-grid--radio";
    weaponRow.append(this.weaponSlotsEl, this.armorSlotEl);
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
    this.equipmentSlotsEl = document.createElement("div");
    this.equipmentSlotsEl.className = "inventory-grid inventory-grid--equipment";
    const jewelryLabels = document.createElement("div");
    jewelryLabels.className = "inventory-equipment-labels inventory-equipment-labels--next";
    for (const text of ["Neck", "Left Hand", "Right Hand", "Map"]) {
      const lab = document.createElement("div");
      lab.className = "inventory-section-label";
      lab.textContent = text;
      jewelryLabels.appendChild(lab);
    }
    this.jewelrySlotsEl = document.createElement("div");
    this.jewelrySlotsEl.className = "inventory-grid inventory-grid--equipment";
    equipmentSection.append(
      equipmentLabels,
      this.equipmentSlotsEl,
      jewelryLabels,
      this.jewelrySlotsEl,
    );

    const pocketsSection = document.createElement("div");
    pocketsSection.className = "inventory-section";
    const pocketsLabel = document.createElement("div");
    pocketsLabel.className = "inventory-section-label";
    pocketsLabel.textContent = "Pockets";
    this.pocketSlotsEl = document.createElement("div");
    this.pocketSlotsEl.className = "inventory-grid inventory-grid--pockets";
    pocketsSection.append(pocketsLabel, this.pocketSlotsEl);

    this.backpackSection = document.createElement("div");
    this.backpackSection.className = "inventory-section";
    this.backpackSection.hidden = true;
    const backpackLabel = document.createElement("div");
    backpackLabel.className = "inventory-section-label";
    backpackLabel.textContent = "Backpack";
    this.backpackSlotsEl = document.createElement("div");
    this.backpackSlotsEl.className = "inventory-grid inventory-grid--pockets";
    this.backpackSection.append(backpackLabel, this.backpackSlotsEl);

    const carryScroll = document.createElement("div");
    carryScroll.className = "inventory-carry-scroll";
    carryScroll.append(pocketsSection, this.backpackSection);

    this.wornEl = document.createElement("div");
    this.wornEl.className = "inventory-worn";
    this.wornEl.append(weaponsSection, equipmentSection);
    this.gridEl.append(this.wornEl, carryScroll);

    this.detailEl = document.createElement("div");
    this.detailEl.className = "inventory-detail";
    this.vitalsEl = document.createElement("div");
    this.vitalsEl.className = "inventory-vitals";
    this.vitalsEl.hidden = true;

    this.footerEl = document.createElement("div");
    this.footerEl.className = "inventory-footer";
    this.footerEl.hidden = true;

    const actions = document.createElement("div");
    actions.className = "inventory-actions";

    this.equipBtn = document.createElement("button");
    this.equipBtn.type = "button";
    this.equipBtn.className = "inventory-action-btn inventory-equip-btn";
    this.equipBtn.textContent = "Equip";
    this.equipBtn.hidden = true;
    this.equipBtn.addEventListener("click", () => this.equipSelected());

    this.wearBtn = document.createElement("button");
    this.wearBtn.type = "button";
    this.wearBtn.className = "inventory-action-btn inventory-wear-btn";
    this.wearBtn.textContent = "Wear";
    this.wearBtn.hidden = true;
    this.wearBtn.addEventListener("click", () => this.wearOrRemoveSelected());

    this.dropBtn = document.createElement("button");
    this.dropBtn.type = "button";
    this.dropBtn.className = "inventory-action-btn inventory-drop-btn";
    this.dropBtn.textContent = "Drop 1";
    this.dropBtn.hidden = true;
    this.dropBtn.addEventListener("click", () => this.dropSelected(1));

    this.dropAllBtn = document.createElement("button");
    this.dropAllBtn.type = "button";
    this.dropAllBtn.className = "inventory-action-btn inventory-drop-btn";
    this.dropAllBtn.textContent = "Drop All";
    this.dropAllBtn.hidden = true;
    this.dropAllBtn.addEventListener("click", () => this.dropAllSelected());

    this.readBtn = document.createElement("button");
    this.readBtn.type = "button";
    this.readBtn.className = "inventory-action-btn inventory-read-btn";
    this.readBtn.textContent = "Read";
    this.readBtn.hidden = true;
    this.readBtn.addEventListener("click", () => this.readSelected());

    this.useBtn = document.createElement("button");
    this.useBtn.type = "button";
    this.useBtn.className = "inventory-action-btn inventory-use-btn";
    this.useBtn.textContent = "Use";
    this.useBtn.hidden = true;
    this.useBtn.addEventListener("click", () => this.useSelected());

    this.unloadBtn = document.createElement("button");
    this.unloadBtn.type = "button";
    this.unloadBtn.className = "inventory-action-btn inventory-unload-btn";
    this.unloadBtn.textContent = "Unload";
    this.unloadBtn.hidden = true;
    this.unloadBtn.addEventListener("click", () => this.unloadSelected());

    this.unequipBtn = document.createElement("button");
    this.unequipBtn.type = "button";
    this.unequipBtn.className = "inventory-action-btn inventory-unequip";
    this.unequipBtn.textContent = "Unequip";
    this.unequipBtn.hidden = true;
    this.unequipBtn.addEventListener("click", () => this.unequipSelected());

    actions.append(
      this.equipBtn,
      this.wearBtn,
      this.readBtn,
      this.useBtn,
      this.unloadBtn,
      this.dropBtn,
      this.dropAllBtn,
      this.unequipBtn,
    );
    this.footerEl.append(this.vitalsEl, this.detailEl, actions);

    panel.append(header, this.gridEl, this.footerEl);
    this.overlay.appendChild(panel);
    this.overlay.appendChild(this.buildReadOverlay());
    document.body.appendChild(this.overlay);

    this.overlay.addEventListener("click", (event) => {
      if (event.target === this.overlay) this.close();
    });
    this.unbindPhoneResize = bindPhoneDialogResize(
      () => this.visible,
      () => this.overlay.classList.contains("phone-sheet"),
      () => this.syncPhoneSheet(),
      this.overlay,
    );
  }

  toggle() {
    if (this.visible) this.close();
    else this.open();
  }

  open() {
    if (this.visible) return;
    this.visible = true;
    this.overlay.hidden = false;
    this.syncPhoneSheet();
    document.body.classList.add("inventory-open");
    resetDialogScroll(this.overlay);
    if (this.ms && useMobileSheet()) {
      markSheetOpen("bag", true);
      this.ms.body.scrollTop = 0;
    }
    AudioManager.get().play("inventory_open");
  }

  close() {
    const wasOpen = this.visible;
    cancelAllSlotDrags();
    this.visible = false;
    this.overlay.hidden = true;
    this.selectedSlot = -1;
    this.dragFromSlot = -1;
    this.lastTap = null;
    this.footerEl.hidden = true;
    this.hideActionButtons();
    this.closeRead();
    this.msReset();
    markSheetOpen("bag", false);
    this.overlay.classList.remove("phone-sheet");
    document.body.classList.remove("inventory-open");
    if (wasOpen) AudioManager.get().play("inventory_close");
  }

  isOpen() {
    return this.visible;
  }

  isReading(): boolean {
    return !this.readOverlay.hidden;
  }

  closeRead() {
    this.readOverlay.hidden = true;
    this.readTitleEl.textContent = "";
    this.readBodyEl.textContent = "";
  }

  /**
   * Refresh the vitals the detail panel reads (a drink is greyed out when the
   * player is not thirsty) without rebuilding the slot grid. Health, hunger,
   * thirst and core temperature all drift while the bag sits open.
   */
  updateStats(playerStats: InventoryPlayerStats) {
    this.playerStats = playerStats;
    if (!this.visible) return;
    if (this.msActive()) {
      this.msRenderVitals();
      this.msSyncDrawer();
      return;
    }
    this.updateDetail();
  }

  render(
    inventoryJson: string,
    equippedInventorySlot: number,
    playerStats?: InventoryPlayerStats,
    equippedClothingSlot = -1,
    weaponMagazinesJson = "{}",
    equippedMagazineRounds = 0,
    extraPockets = 0,
  ) {
    cancelAllSlotDrags();
    const inventory = parseInventory(inventoryJson);
    this.extraPockets = extraPockets;
    this.currentInventory = inventory;
    this.equippedInventorySlot = equippedInventorySlot;
    this.equippedClothingSlot = equippedClothingSlot;
    this.weaponMagazinesJson = weaponMagazinesJson;
    this.equippedMagazineRounds = equippedMagazineRounds;
    if (playerStats) this.playerStats = playerStats;

    if (
      this.selectedSlot >= inventory.length ||
      (!inventory[this.selectedSlot] && !emptyGearSlotHint(this.selectedSlot))
    ) {
      this.selectedSlot = -1;
    }

    this.syncPhoneSheet();
    if (this.msActive()) {
      this.renderMobile();
      return;
    }

    this.weaponSlotsEl.replaceChildren();
    this.armorSlotEl.replaceChildren();
    this.equipmentSlotsEl.replaceChildren();
    this.jewelrySlotsEl.replaceChildren();
    this.pocketSlotsEl.replaceChildren();
    this.backpackSlotsEl.replaceChildren();

    for (let i = 0; i < WEAPON_SLOT_COUNT; i++) {
      this.weaponSlotsEl.appendChild(
        this.createCell(i, inventory[i] ?? null, inventoryJson),
      );
    }
    this.armorSlotEl.appendChild(
      this.createCell(
        ARMOR_SLOT_INDEX,
        inventory[ARMOR_SLOT_INDEX] ?? null,
        inventoryJson,
      ),
    );
    this.equipmentSlotsEl.append(
      this.createCell(
        CLOTHING_SLOT_INDEX,
        inventory[CLOTHING_SLOT_INDEX] ?? null,
        inventoryJson,
      ),
      this.createCell(
        BACKPACK_SLOT_INDEX,
        inventory[BACKPACK_SLOT_INDEX] ?? null,
        inventoryJson,
      ),
      this.createCell(
        WATCH_SLOT_INDEX,
        inventory[WATCH_SLOT_INDEX] ?? null,
        inventoryJson,
      ),
      this.createCell(
        RADIO_SLOT_INDEX,
        inventory[RADIO_SLOT_INDEX] ?? null,
        inventoryJson,
      ),
    );
    this.jewelrySlotsEl.append(
      this.createCell(
        NECK_SLOT_INDEX,
        inventory[NECK_SLOT_INDEX] ?? null,
        inventoryJson,
      ),
      this.createCell(
        LEFT_HAND_SLOT_INDEX,
        inventory[LEFT_HAND_SLOT_INDEX] ?? null,
        inventoryJson,
      ),
      this.createCell(
        RIGHT_HAND_SLOT_INDEX,
        inventory[RIGHT_HAND_SLOT_INDEX] ?? null,
        inventoryJson,
      ),
      this.createCell(
        MAP_SLOT_INDEX,
        inventory[MAP_SLOT_INDEX] ?? null,
        inventoryJson,
      ),
    );
    for (let i = 0; i < POCKET_SLOT_COUNT; i++) {
      const idx = WEAPON_SLOT_COUNT + i;
      this.pocketSlotsEl.appendChild(
        this.createCell(idx, inventory[idx] ?? null, inventoryJson),
      );
    }
    for (const idx of retiredPocketIndices(inventory)) {
      this.pocketSlotsEl.appendChild(
        this.createCell(idx, inventory[idx] ?? null, inventoryJson),
      );
    }
    const extra = shownExtraPockets(inventory, extraPockets);
    for (let i = 0; i < extra; i++) {
      const idx = BASE_INVENTORY_SLOTS + i;
      this.pocketSlotsEl.appendChild(
        this.createCell(idx, inventory[idx] ?? null, inventoryJson),
      );
    }
    const packSlots = shownBackpackStorageCount(inventory);
    this.backpackSection.hidden = packSlots <= 0;
    for (let i = 0; i < packSlots; i++) {
      const idx = BACKPACK_STORAGE_START + i;
      this.backpackSlotsEl.appendChild(
        this.createCell(idx, inventory[idx] ?? null, inventoryJson),
      );
    }

    this.countEl.textContent = formatCarrySlots(inventory, extraPockets);
    this.syncPhoneSheet();
    this.updateDetail();
  }

  private syncPhoneSheet() {
    const mobile = useMobileSheet();
    if (mobile) this.ensureMobileSheet();
    this.panelEl.hidden = mobile;
    this.overlay.classList.toggle("ms-host", mobile);
    if (this.ms) this.ms.root.hidden = !mobile;
    if (!mobile && this.ms) {
      this.msReset();
      markSheetOpen("bag", false);
    }
    const phone = !mobile && usePhoneDialogSheet();
    this.overlay.classList.toggle("phone-sheet", phone);
    this.titleEl.textContent = phone ? "Bag" : "Inventory";
    this.hintEl.hidden = phone;
    this.vitalsEl.hidden = !phone;
  }

  private createCell(
    index: number,
    slot: Inventory[number],
    inventoryJson: string,
  ): HTMLElement {
    const cell = document.createElement("div");
    cell.className = "inventory-cell";
    cell.dataset.slotIndex = String(index);
    cell.setAttribute("role", "button");
    cell.tabIndex = 0;

    if (index < WEAPON_SLOT_COUNT) {
      cell.classList.add("inventory-cell--weapon");
      const keyEl = document.createElement("span");
      keyEl.className = "inventory-cell-key";
      keyEl.textContent = String(index + 1);
      cell.appendChild(keyEl);
    } else if (index === CLOTHING_SLOT_INDEX) {
      cell.classList.add("inventory-cell--clothing");
    } else if (isWatchSlot(index)) {
      cell.classList.add("inventory-cell--watch");
    } else if (isRadioSlot(index)) {
      cell.classList.add("inventory-cell--radio");
    } else if (isArmorSlot(index)) {
      cell.classList.add("inventory-cell--armor");
    } else if (isNeckSlot(index)) {
      cell.classList.add("inventory-cell--neck");
    } else if (isHandSlot(index)) {
      cell.classList.add("inventory-cell--hand");
    } else if (isMapSlot(index)) {
      cell.classList.add("inventory-cell--map");
    } else if (isBackpackSlot(index)) {
      cell.classList.add("inventory-cell--backpack");
    } else if (isBackpackStorageIndex(index)) {
      cell.classList.add("inventory-cell--backpack-storage");
    }

    if (index === this.selectedSlot) {
      cell.classList.add("inventory-cell--selected");
    }

    if (!slot) {
      cell.classList.add("inventory-cell--empty");
      cell.setAttribute(
        "aria-label",
        emptyGearSlotHint(index) ?? `Empty slot ${index + 1}`,
      );
    } else {
      const def = getItemDefinition(slot.id);
      const category = def?.category ?? "crafting";
      cell.style.setProperty("--slot-accent", CATEGORY_COLORS[category] ?? "#555");
      cell.classList.add("inventory-cell--filled");
      markQuestKeepsake(cell, slot.id);

      const hasIcon = appendItemIcon(cell, slot.id, "inventory-cell-icon");
      if (hasIcon) {
        cell.classList.add("inventory-cell--has-icon");
      }

      const label = document.createElement("span");
      label.className = "inventory-cell-label";
      label.textContent = shortLabel(def?.name ?? slot.id);
      cell.appendChild(label);

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

      const weaponIndex = weaponIndexFromItemId(slot.id);
      const isClothingWorn =
        isClothingItem(slot.id) && index === CLOTHING_SLOT_INDEX;
      if (
        index < WEAPON_SLOT_COUNT ||
        isArmorSlot(index) ||
        isClothingWorn ||
        isWatchSlot(index) ||
        isRadioSlot(index) ||
        isJewelrySlot(index) ||
        isMapSlot(index) ||
        (isBackpackSlot(index) && isBackpackItem(slot.id))
      ) {
        cell.classList.add("inventory-cell--equipped");
      }

      const freqLabel =
        radioFreq > 0
          ? isListenOnlyRadioFreq(radioFreq)
            ? ` · freq ${radioFreq} · listen only`
            : ` · freq ${radioFreq}`
          : "";
      const dur =
        getMaxDurability(slot.id) != null
          ? ` · ${getEntryDurability(slot)}/${getMaxDurability(slot.id)}`
          : "";
      const wet = getEntryWetness(slot);
      const wetLabel = wet > 0.005 ? ` · ${Math.round(wet * 100)}% wet` : "";
      const effect = wornGearEffectHint(slot.id);
      const effectLabel = effect ? ` · ${effect}` : "";
      const itemName = def?.name ?? slot.id;
      if (effect) cell.title = `${itemName} · ${effect}`;
      cell.setAttribute(
        "aria-label",
        `${itemName}${slot.quantity > 1 ? ` ×${slot.quantity}` : ""}${freqLabel}${dur}${wetLabel}${effectLabel}`,
      );

      const toggleEquip = () => {
        if (weaponIndex < 0) return;
        if (this.equippedInventorySlot === index) {
          this.handlers.onUnequip();
        } else {
          this.handlers.onEquip(index);
        }
      };

      bindSlotPointerDnD({
        cell,
        root: this.overlay,
        tapKey: `inv:${index}`,
        getLastTap: () => this.lastTap,
        setLastTap: (tap) => {
          this.lastTap = tap;
        },
        resolveTarget: (el) => {
          const hit = el?.closest?.(".inventory-cell") as HTMLElement | null;
          return hit && this.overlay.contains(hit) ? hit : null;
        },
        canDropOn: (target, shift) => {
          const toSlot = Number(target.dataset.slotIndex);
          if (!Number.isFinite(toSlot) || toSlot === index) return false;
          const fromItem = this.currentInventory[index];
          if (!fromItem) return false;
          if (shift && shiftSplitQuantity(fromItem.quantity) >= 1) {
            return canSplitInventoryStackHalf(
              this.currentInventory,
              index,
              toSlot,
              this.extraPockets,
            );
          }
          return (
            moveInventorySlot(
              this.currentInventory,
              index,
              toSlot,
              this.extraPockets,
            ) !== this.currentInventory
          );
        },
        onDropOn: (target, shift) => {
          const toSlot = Number(target.dataset.slotIndex);
          if (!Number.isFinite(toSlot) || toSlot === index) return;
          const qty = this.currentInventory[index]?.quantity ?? 0;
          const split = shift && shiftSplitQuantity(qty) >= 1;
          this.handlers.onMoveSlot(index, toSlot, split);
          this.selectedSlot = toSlot;
        },
        shiftGhostQuantity: (shift) => {
          if (!shift) return null;
          const qty = shiftSplitQuantity(this.currentInventory[index]?.quantity ?? 0);
          return qty >= 1 ? qty : null;
        },
        onDragBegan: () => {
          this.dragFromSlot = index;
        },
        onDragEnded: () => {
          this.dragFromSlot = -1;
          cell.classList.remove("inventory-cell--dragging");
          this.clearDragOverStates();
        },
        onDoubleActivate: weaponIndex >= 0 ? toggleEquip : undefined,
        clearHover: () => this.clearDragOverStates(),
        setHover: (target, valid) => {
          target.classList.toggle("inventory-cell--drag-over", valid);
          target.classList.toggle("inventory-cell--drag-invalid", !valid);
        },
      });
    }

    cell.addEventListener("click", () => {
      if (
        usePhoneDialogSheet() &&
        this.selectedSlot >= 0 &&
        this.selectedSlot !== index &&
        this.currentInventory[this.selectedSlot]
      ) {
        const moved = moveInventorySlot(
          this.currentInventory,
          this.selectedSlot,
          index,
          this.extraPockets,
        );
        if (moved !== this.currentInventory) {
          this.handlers.onMoveSlot(this.selectedSlot, index, false);
          this.selectedSlot = index;
          return;
        }
      }
      this.selectedSlot = slot || emptyGearSlotHint(index) ? index : -1;
      this.render(
        inventoryJson,
        this.equippedInventorySlot,
        undefined,
        this.equippedClothingSlot,
        this.weaponMagazinesJson,
        this.equippedMagazineRounds,
        this.extraPockets,
      );
    });

    return cell;
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

  private hideActionButtons() {
    this.equipBtn.hidden = true;
    this.wearBtn.hidden = true;
    this.readBtn.hidden = true;
    this.useBtn.hidden = true;
    this.unloadBtn.hidden = true;
    this.dropBtn.hidden = true;
    this.dropAllBtn.hidden = true;
    this.unequipBtn.hidden = true;
  }

  private updateDetail() {
    const slot =
      this.selectedSlot >= 0 ? this.currentInventory[this.selectedSlot] : null;

    if (!slot) {
      const hint = emptyGearSlotHint(this.selectedSlot);
      if (!hint) {
        this.footerEl.hidden = true;
        this.detailEl.textContent = "";
        this.hideActionButtons();
        return;
      }
      this.footerEl.hidden = false;
      this.updateVitals();
      this.detailEl.textContent = hint;
      this.hideActionButtons();
      return;
    }

    this.footerEl.hidden = false;
    this.updateVitals();

    const def = getItemDefinition(slot.id);
    const name = def?.name ?? slot.id;
    const category = def?.category ?? "";
    const weaponIndex = weaponIndexFromItemId(slot.id);
    const isWeapon = weaponIndex >= 0;
    const isClothing = isClothingItem(slot.id);
    const equipped = isWeapon && this.equippedInventorySlot === this.selectedSlot;
    const inClothingSlot = this.selectedSlot === CLOTHING_SLOT_INDEX;
    const worn = isClothing && inClothingSlot;
    const isFood = category === "food";
    const isDrink = category === "drink";
    const isMedical = category === "medical";
    const isUsableType = isFood || isDrink || isMedical || isConsumable(slot.id);
    const needed = canUseConsumable(slot.id, this.playerStats);
    let zoneHint = "";
    if (this.selectedSlot < WEAPON_SLOT_COUNT) zoneHint = " · weapon slot";
    else if (inClothingSlot) zoneHint = " · clothing slot";
    else if (isBackpackSlot(this.selectedSlot)) zoneHint = " · backpack slot";
    else if (isWatchSlot(this.selectedSlot)) zoneHint = " · watch slot";
    else if (isRadioSlot(this.selectedSlot)) zoneHint = " · radio slot";
    else if (isArmorSlot(this.selectedSlot)) zoneHint = " · armor slot";
    else if (isNeckSlot(this.selectedSlot)) zoneHint = " · neck slot";
    else if (this.selectedSlot === LEFT_HAND_SLOT_INDEX) zoneHint = " · left hand";
    else if (this.selectedSlot === RIGHT_HAND_SLOT_INDEX) zoneHint = " · right hand";
    else if (isMapSlot(this.selectedSlot)) zoneHint = " · map slot";
    else if (isBackpackStorageIndex(this.selectedSlot)) zoneHint = " · backpack";
    else zoneHint = " · pocket";
    if (isHotbarOnlyItem(slot.id)) zoneHint += " · too large for pockets";
    if (worn) zoneHint += " · worn";
    const packedCount = sealedBackpackStackCount(slot);
    if (packedCount > 0) {
      zoneHint += packedCount === 1 ? " · 1 item inside" : ` · ${packedCount} items inside`;
    }
    const wet = getEntryWetness(slot);
    if (wet > 0.7) zoneHint += " · soaked";
    else if (wet > 0.005) zoneHint += ` · ${Math.round(wet * 100)}% wet`;
    const loadedRounds = this.slotLoadedRounds(this.selectedSlot, slot.id);
    if (loadedRounds > 0) zoneHint += ` · ${loadedRounds} loaded`;
    const effect = wornGearEffectHint(slot.id);
    if (effect) zoneHint += ` · ${effect}`;
    if (isRadioItem(slot.id)) {
      const freq = getEntryRadioFreq(slot);
      zoneHint +=
        freq > 0
          ? isListenOnlyRadioFreq(freq)
            ? ` · freq ${freq} · listen only`
            : ` · freq ${freq}`
          : " · untuned";
    }

    this.detailEl.textContent =
      (slot.quantity > 1 ? `${name} ×${slot.quantity}` : name) + zoneHint;

    // Only show actions that apply — never leave disabled stubs visible.
    this.equipBtn.hidden = !isWeapon || equipped;
    this.equipBtn.disabled = false;
    this.equipBtn.textContent = "Equip";

    this.wearBtn.hidden = !isClothing;
    this.wearBtn.disabled = false;
    this.wearBtn.textContent = inClothingSlot ? "Remove" : "Wear";

    this.readBtn.hidden = !isReadableItem(slot.id);
    this.readBtn.disabled = false;
    this.readBtn.textContent = "Read";

    this.useBtn.hidden = !isUsableType || !needed;
    this.useBtn.disabled = false;
    if (isWeaponBlueprint(slot.id)) this.useBtn.textContent = "Learn";
    else if (isSkillMagazine(slot.id)) this.useBtn.textContent = "Read";
    else if (isDrink) this.useBtn.textContent = "Drink";
    else if (isFood) this.useBtn.textContent = "Eat";
    else this.useBtn.textContent = "Use";

    const ammoType = getAmmoTypeForWeapon(slot.id);
    const canUnload =
      loadedRounds > 0 &&
      !!ammoType &&
      canAddToInventory(
        this.currentInventory,
        ammoType,
        loadedRounds,
        this.extraPockets,
      );
    this.unloadBtn.hidden = !canUnload;
    this.unloadBtn.disabled = false;
    this.unloadBtn.textContent = "Unload";

    this.dropBtn.hidden = false;
    this.dropBtn.disabled = false;
    this.dropBtn.textContent = "Drop 1";

    this.dropAllBtn.hidden = slot.quantity <= 1;
    this.dropAllBtn.disabled = false;
    this.dropAllBtn.textContent = "Drop All";

    this.unequipBtn.hidden = !equipped;
    this.unequipBtn.disabled = false;
  }

  private updateVitals() {
    if (!usePhoneDialogSheet()) {
      this.vitalsEl.hidden = true;
      this.vitalsEl.replaceChildren();
      return;
    }
    this.vitalsEl.hidden = false;
    this.vitalsEl.replaceChildren();
    const stats = this.playerStats;
    const rows: [string, number, number, string][] = [
      ["HP", stats.health, stats.maxHealth, "#c45a5a"],
      ["Hunger", stats.hunger, stats.maxHunger, "#c4a05a"],
      ["Thirst", stats.thirst, stats.maxThirst, "#5a9cc4"],
    ];
    for (const [label, value, max, color] of rows) {
      const row = document.createElement("div");
      row.className = "inventory-vital";
      const name = document.createElement("span");
      name.className = "inventory-vital-label";
      name.textContent = label;
      const track = document.createElement("div");
      track.className = "inventory-vital-track";
      const fill = document.createElement("div");
      fill.className = "inventory-vital-fill";
      fill.style.background = color;
      const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
      fill.style.width = `${pct}%`;
      track.appendChild(fill);
      row.append(name, track);
      this.vitalsEl.appendChild(row);
    }
  }

  private equipSelected() {
    if (this.selectedSlot < 0) return;
    const slot = this.currentInventory[this.selectedSlot];
    if (!slot) return;
    if (weaponIndexFromItemId(slot.id) >= 0) {
      this.handlers.onEquip(this.selectedSlot);
    }
  }

  private unequipSelected() {
    if (this.selectedSlot < 0) return;
    const slot = this.currentInventory[this.selectedSlot];
    if (!slot) return;
    if (weaponIndexFromItemId(slot.id) >= 0) {
      this.handlers.onUnequip();
    }
  }

  private wearOrRemoveSelected() {
    if (this.selectedSlot < 0) return;
    const slot = this.currentInventory[this.selectedSlot];
    if (!slot || !isClothingItem(slot.id)) return;
    if (this.selectedSlot === CLOTHING_SLOT_INDEX) {
      this.handlers.onRemoveClothing();
    } else {
      this.handlers.onWearClothing(this.selectedSlot);
    }
  }

  private dropSelected(quantity: number) {
    if (this.selectedSlot < 0) return;
    this.handlers.onDrop(this.selectedSlot, quantity);
  }

  private dropAllSelected() {
    if (this.selectedSlot < 0) return;
    const slot = this.currentInventory[this.selectedSlot];
    if (!slot || slot.quantity <= 0) return;
    this.handlers.onDrop(this.selectedSlot, slot.quantity);
  }

  private useSelected() {
    if (this.selectedSlot < 0) return;
    this.handlers.onUse(this.selectedSlot);
    this.close();
  }

  private buildReadOverlay(): HTMLElement {
    this.readOverlay = document.createElement("div");
    this.readOverlay.className = "item-read-overlay";
    this.readOverlay.hidden = true;
    this.readOverlay.addEventListener("click", (event) => {
      if (event.target === this.readOverlay) this.closeRead();
    });

    const panel = document.createElement("div");
    panel.className = "item-read-panel";
    panel.addEventListener("click", (event) => event.stopPropagation());

    const header = document.createElement("div");
    header.className = "item-read-header";
    this.readTitleEl = document.createElement("h3");
    this.readTitleEl.className = "item-read-title";
    header.append(this.readTitleEl, createDialogCloseButton(() => this.closeRead()));

    this.readBodyEl = document.createElement("p");
    this.readBodyEl.className = "item-read-body";

    panel.append(header, this.readBodyEl);
    this.readOverlay.appendChild(panel);
    return this.readOverlay;
  }

  private readSelected() {
    if (this.selectedSlot < 0) return;
    const slot = this.currentInventory[this.selectedSlot];
    if (!slot) return;
    const text = getReadableItemText(slot.id);
    if (!text) return;
    const def = getItemDefinition(slot.id);
    this.readTitleEl.textContent = def?.name ?? slot.id;
    this.readBodyEl.textContent = text;
    this.readOverlay.hidden = false;
  }

  private slotLoadedRounds(slotIndex: number, itemId: string): number {
    if (!getAmmoTypeForWeapon(itemId)) return 0;
    if (slotIndex === this.equippedInventorySlot) {
      return Math.max(0, Math.floor(this.equippedMagazineRounds));
    }
    return (
      getStoredMagazineRounds(
        parseWeaponMagazines(this.weaponMagazinesJson),
        slotIndex,
      ) ?? 0
    );
  }

  private unloadSelected() {
    if (this.selectedSlot < 0) return;
    const slot = this.currentInventory[this.selectedSlot];
    if (!slot || this.slotLoadedRounds(this.selectedSlot, slot.id) <= 0) return;
    this.handlers.onUnload(this.selectedSlot);
    this.close();
  }

  // Mobile sheet (design/mobile-dialogs board 01)

  private msActive(): boolean {
    return !!this.ms && useMobileSheet();
  }

  private ensureMobileSheet() {
    if (this.ms) return;
    const sheet = createSheet({ onClose: () => this.close() });
    sheet.root.classList.add("ms-bag");
    sheet.header.setTitle("Bag");
    const vitals = document.createElement("div");
    vitals.className = "ms-bag-vitals";
    sheet.root.insertBefore(vitals, sheet.tabsSlot);
    this.msVitalsEl = vitals;
    const cancel = sheetButton("Cancel", "sec", () => this.msCancelMove(), { small: true });
    cancel.classList.add("ms-bag-cancel");
    cancel.hidden = true;
    sheet.header.el.insertBefore(cancel, sheet.header.closeBtn);
    this.msCancelBtn = cancel;
    this.panelEl.after(sheet.root);
    this.ms = sheet;
  }

  private msReset() {
    this.msMove = null;
    this.msDropQty = null;
    this.msDetachDrawer()?.close();
    if (this.ms) showSheetMessage(this.ms.snackSlot, "");
  }

  /** Forget the open drawer without running its user-close handler. */
  private msDetachDrawer(): Drawer | null {
    const drawer = this.msDrawer;
    this.msDrawer = null;
    this.msDrawerKey = "";
    this.msDrawerResize?.disconnect();
    this.msDrawerResize = null;
    if (this.ms) this.ms.body.style.paddingBottom = "";
    return drawer;
  }

  private msRenderVitals() {
    const el = this.msVitalsEl;
    if (!el) return;
    const s = this.playerStats;
    const temp = s.temperature ?? 37;
    const vital = (label: string, value: string, pct: number, color: string, tone: string) => {
      const box = document.createElement("div");
      box.className = "ms-bag-vital";
      const num = document.createElement("b");
      num.textContent = value;
      if (tone) num.className = tone;
      box.append(document.createTextNode(label), num, meter(pct, color));
      return box;
    };
    const pct = (v: number, max: number) => (max > 0 ? (v / max) * 100 : 0);
    const need = (p: number) => (p < 15 ? "ms-bad" : p < 35 ? "ms-warn" : "");
    const hp = pct(s.health, s.maxHealth);
    const food = pct(s.hunger, s.maxHunger);
    const water = pct(s.thirst, s.maxThirst);
    el.replaceChildren(
      vital("Health", String(Math.round(s.health)), hp, "#c45a5a", need(hp)),
      vital("Food", String(Math.round(s.hunger)), food, "#c4a05a", need(food)),
      vital("Water", String(Math.round(s.thirst)), water, "#5a9cc4", need(water)),
      vital(
        "Temp",
        `${temp.toFixed(1)}°`,
        ((temp - 34) / 6) * 100,
        "#c47a5a",
        temp < 35 || temp > 39 ? "ms-bad" : temp < 35.8 || temp > 38.2 ? "ms-warn" : "",
      ),
    );
  }

  private renderMobile() {
    const sheet = this.ms;
    if (!sheet) return;
    const inv = this.currentInventory;
    if (this.msMove && !inv[this.msMove.from]) this.msMove = null;
    const move = this.msMove;
    const moving = move ? inv[move.from] : null;
    const { pockets, backpack } = carrySlotGroups(inv, this.extraPockets);

    if (move && moving) {
      const qty = move.half ? shiftSplitQuantity(moving.quantity) : moving.quantity;
      sheet.header.setTitle(`Move ${itemName(moving.id)}${qty > 1 ? ` ×${qty}` : ""}`);
      sheet.header.setSub("Tap a highlighted slot");
    } else {
      sheet.header.setTitle("Bag");
      const parts = [`Pockets ${usedSlotCount(inv, pockets)}/${pockets.length}`];
      if (backpack.length > 0) {
        parts.push(`Backpack ${usedSlotCount(inv, backpack)}/${backpack.length}`);
      }
      sheet.header.setSub(parts.join(" · "));
    }
    sheet.header.closeBtn.hidden = !!move;
    if (this.msCancelBtn) this.msCancelBtn.hidden = !move;
    if (this.msVitalsEl) this.msVitalsEl.hidden = !!move;
    this.msRenderVitals();

    const grid = (indices: number[]) => {
      const wrap = document.createElement("div");
      wrap.className = "ms-bag-grid";
      for (const idx of indices) wrap.append(this.msCell(idx));
      return wrap;
    };
    const wornUsed = usedSlotCount(inv, MOBILE_WORN_SLOTS);
    const sections: HTMLElement[] = [
      sectionLabel("Worn", `${wornUsed} / ${MOBILE_WORN_SLOTS.length}`),
      grid(MOBILE_WORN_SLOTS),
      sectionLabel("Pockets", `${usedSlotCount(inv, pockets)} / ${pockets.length}`),
      grid(pockets),
    ];
    if (backpack.length > 0) {
      const pack = inv[BACKPACK_SLOT_INDEX];
      sections.push(
        sectionLabel(
          pack ? itemName(pack.id) : "Backpack",
          `${usedSlotCount(inv, backpack)} / ${backpack.length}`,
        ),
        grid(backpack),
      );
    }
    const scrollTop = sheet.body.scrollTop;
    sheet.body.replaceChildren(...sections);
    sheet.body.scrollTop = scrollTop;

    this.msRenderBar();
    this.msSyncDrawer();
    if (this.msScrollToSelection) {
      this.msScrollToSelection = false;
      requestAnimationFrame(() => this.msRevealSelection());
    }
  }

  private msCell(index: number): HTMLElement {
    const slot = this.currentInventory[index] ?? null;
    const move = this.msMove;
    const cell = document.createElement("div");
    cell.className = "ms-bag-cell";
    cell.dataset.slotIndex = String(index);
    cell.setAttribute("role", "button");
    const worn = isMobileWornSlot(index);

    if (slot) {
      cell.classList.add("ms-bag-cell--filled");
      markQuestKeepsake(cell, slot.id);
      const icon = itemIconImg(slot.id);
      if (icon) cell.append(icon);
      else {
        const txt = document.createElement("span");
        txt.className = "ms-bag-cell-txt";
        txt.textContent = shortLabel(itemName(slot.id));
        cell.append(txt);
      }
      const packed = sealedBackpackStackCount(slot);
      if (slot.quantity > 1 || packed > 0) {
        const q = document.createElement("span");
        q.className = "ms-bag-cell-q";
        q.textContent = String(slot.quantity > 1 ? slot.quantity : packed);
        cell.append(q);
      }
      const freq = getEntryRadioFreq(slot);
      const tagText = index < WEAPON_SLOT_COUNT ? String(index + 1) : freq > 0 ? String(freq) : "";
      if (tagText) {
        const tag = document.createElement("span");
        tag.className = freq > 0 && index >= WEAPON_SLOT_COUNT ? "ms-bag-cell-tag ms-bag-cell-tag--freq" : "ms-bag-cell-tag";
        tag.textContent = tagText;
        cell.append(tag);
      }
      appendItemDurabilityBar(cell, slot);
      appendItemWetnessBar(cell, slot);
      if (worn) cell.classList.add("ms-bag-cell--eq");
      if (index === this.equippedInventorySlot) cell.classList.add("ms-bag-cell--held");
      if (index === this.selectedSlot && !move) cell.classList.add("ms-bag-cell--sel");
      cell.setAttribute(
        "aria-label",
        `${itemName(slot.id)}${slot.quantity > 1 ? ` ×${slot.quantity}` : ""}`,
      );
    } else {
      cell.classList.add("ms-bag-cell--empty");
      if (worn) {
        const ghost = wornSlotGhost(index);
        cell.classList.add("ms-bag-cell--ghost");
        if (ghost.iconId) {
          const img = itemIconImg(ghost.iconId);
          if (img) cell.append(img);
        }
        const cap = document.createElement("span");
        cap.className = "ms-bag-cell-cap";
        cap.textContent = ghost.caption;
        cell.append(cap);
      }
      cell.setAttribute("aria-label", (worn ? emptyWornSlotHint(index) : null) ?? "Empty slot");
    }

    if (move) {
      if (index === move.from) cell.classList.add("ms-bag-cell--lift");
      else if (this.msCanMoveTo(move.from, index, move.half)) cell.classList.add("ms-bag-cell--target");
      else cell.classList.add("ms-bag-cell--dim");
    }

    cell.addEventListener("click", () => this.msTapCell(index));
    if (slot && !move) this.msBindDrag(cell, index);
    return cell;
  }

  private msCanMoveTo(from: number, to: number, half: boolean): boolean {
    if (from === to) return false;
    const inv = this.currentInventory;
    if (!inv[from]) return false;
    if (half) return canSplitInventoryStackHalf(inv, from, to, this.extraPockets);
    return moveInventorySlot(inv, from, to, this.extraPockets) !== inv;
  }

  private msBlockedReason(from: number, to: number): string {
    const item = this.currentInventory[from];
    if (!item) return "";
    const name = itemName(item.id);
    if (loadedBackpackStowBlocked(item, to)) {
      return `Empty the ${name} before packing it away.`;
    }
    const access = inventorySlotAccess(this.currentInventory, this.extraPockets);
    if (!itemFitsInSlot(item.id, to, access)) {
      if (isMobileWornSlot(to)) {
        return `${name} can't go in that gear slot. Pick a pocket or backpack slot.`;
      }
      if (isHotbarOnlyItem(item.id)) {
        return `${name} is too large for pockets. Use a weapon slot or a backpack.`;
      }
      return "That slot is locked.";
    }
    if (this.currentInventory[to]) return "Those two items can't swap places.";
    return `${name} can't go there.`;
  }

  private msTapCell(index: number) {
    if (Date.now() < this.msTapGuardUntil) return;
    const sheet = this.ms;
    if (!sheet) return;
    const move = this.msMove;
    if (move) {
      if (index === move.from) {
        this.msCancelMove();
        return;
      }
      if (this.msCanMoveTo(move.from, index, move.half)) {
        this.handlers.onMoveSlot(move.from, index, move.half);
        this.msMove = null;
        this.selectedSlot = -1;
        showSheetMessage(sheet.snackSlot, "");
        this.renderMobile();
      } else {
        showSheetMessage(sheet.snackSlot, this.msBlockedReason(move.from, index), "warn");
      }
      return;
    }
    if (!this.currentInventory[index]) {
      if (this.selectedSlot >= 0) {
        this.selectedSlot = -1;
        this.renderMobile();
        return;
      }
      const hint = isMobileWornSlot(index) ? emptyWornSlotHint(index) : null;
      if (hint) showSheetMessage(sheet.snackSlot, hint);
      return;
    }
    this.selectedSlot = this.selectedSlot === index ? -1 : index;
    this.msDropQty = null;
    this.renderMobile();
  }

  private msBindDrag(cell: HTMLElement, index: number) {
    let dragged = false;
    bindSlotPointerDnD({
      cell,
      root: this.overlay,
      tapKey: `bag:${index}`,
      getLastTap: () => this.lastTap,
      setLastTap: (tap) => {
        this.lastTap = tap;
      },
      canStartDrag: () => this.selectedSlot === index && !this.msMove,
      resolveTarget: (el) => {
        const hit = el?.closest?.(".ms-bag-cell") as HTMLElement | null;
        return hit && this.ms?.root.contains(hit) ? hit : null;
      },
      canDropOn: (target) => {
        const to = Number(target.dataset.slotIndex);
        return Number.isFinite(to) && this.msCanMoveTo(index, to, false);
      },
      onDropOn: (target) => {
        const to = Number(target.dataset.slotIndex);
        if (!Number.isFinite(to)) return;
        this.handlers.onMoveSlot(index, to, false);
        this.selectedSlot = -1;
        window.setTimeout(() => {
          if (this.visible && this.msActive()) this.renderMobile();
        }, 0);
      },
      onDragBegan: () => {
        dragged = true;
        this.dragFromSlot = index;
        this.msDrawer?.el.classList.add("ms-bag-drawer--away");
      },
      onDragEnded: () => {
        this.dragFromSlot = -1;
        this.msDrawer?.el.classList.remove("ms-bag-drawer--away");
        this.clearDragOverStates();
        if (dragged) this.msTapGuardUntil = Date.now() + 350;
        dragged = false;
      },
      clearHover: () => this.clearDragOverStates(),
      setHover: (target, valid) => {
        target.classList.toggle("inventory-cell--drag-over", valid);
        target.classList.toggle("inventory-cell--drag-invalid", !valid);
      },
    });
  }

  private msCancelMove() {
    this.msMove = null;
    if (this.ms) showSheetMessage(this.ms.snackSlot, "");
    this.renderMobile();
  }

  private msRenderBar() {
    const sheet = this.ms;
    if (!sheet) return;
    sheet.bar.replaceChildren();
    const move = this.msMove;
    const item = move ? this.currentInventory[move.from] : null;
    if (move && item && item.quantity > 1 && shiftSplitQuantity(item.quantity) >= 1) {
      const half = shiftSplitQuantity(item.quantity);
      const row = document.createElement("div");
      row.className = "ms-bar-row";
      row.append(
        sheetButton(`Move ${half} of ${item.quantity}`, move.half ? "pri" : "sec", () => {
          this.msMove = { from: move.from, half: true };
          this.renderMobile();
        }),
        sheetButton(`Move all ${item.quantity}`, move.half ? "sec" : "pri", () => {
          this.msMove = { from: move.from, half: false };
          this.renderMobile();
        }),
      );
      sheet.bar.append(row);
    }
    sheet.syncBar();
  }

  private msSyncDrawer() {
    const sheet = this.ms;
    if (!sheet) return;
    const index = this.selectedSlot;
    const slot = index >= 0 ? this.currentInventory[index] : null;
    if (!slot || this.msMove || !this.visible) {
      this.msDetachDrawer()?.close();
      return;
    }
    const needed = canUseConsumable(slot.id, this.playerStats);
    const key = [
      index,
      slot.id,
      slot.quantity,
      getEntryDurability(slot),
      getEntryWetness(slot).toFixed(2),
      getEntryRadioFreq(slot),
      sealedBackpackStackCount(slot),
      this.equippedInventorySlot,
      this.slotLoadedRounds(index, slot.id),
      needed,
      this.msDropQty == null ? "" : "drop",
    ].join("|");
    if (this.msDrawer?.isOpen() && key === this.msDrawerKey) return;
    if (!this.msDrawer?.isOpen()) {
      const drawer = openDrawer(sheet.root, {
        scrim: false,
        label: itemName(slot.id),
        onClose: () => {
          if (this.msDrawer !== drawer) return;
          this.msDetachDrawer();
          this.selectedSlot = -1;
          this.msDropQty = null;
          this.renderMobile();
        },
      });
      drawer.el.classList.add("ms-bag-drawer");
      this.msDrawer = drawer;
      const resize = new ResizeObserver(() => {
        sheet.body.style.paddingBottom = `${drawer.el.offsetHeight + 12}px`;
      });
      resize.observe(drawer.el);
      this.msDrawerResize = resize;
      this.msScrollToSelection = true;
    }
    this.msDrawerKey = key;
    this.msFillDrawer(this.msDrawer!, index, slot, needed);
  }

  private msRevealSelection() {
    const sheet = this.ms;
    const cell = sheet?.body.querySelector(".ms-bag-cell--sel") as HTMLElement | null;
    if (!sheet || !cell) return;
    const bodyRect = sheet.body.getBoundingClientRect();
    const cellRect = cell.getBoundingClientRect();
    const drawerTop = this.msDrawer?.el.getBoundingClientRect().top ?? bodyRect.bottom;
    const limit = Math.min(bodyRect.bottom, drawerTop) - 12;
    if (cellRect.bottom > limit) sheet.body.scrollTop += cellRect.bottom - limit;
    else if (cellRect.top < bodyRect.top) sheet.body.scrollTop -= bodyRect.top - cellRect.top + 8;
  }

  private msWhere(index: number): string {
    if (index < WEAPON_SLOT_COUNT) return `weapon slot ${index + 1}`;
    if (isMobileWornSlot(index)) return "worn";
    if (isBackpackStorageIndex(index)) return "in your backpack";
    return "in your pockets";
  }

  private msFillDrawer(drawer: Drawer, index: number, slot: NonNullable<Inventory[number]>, needed: boolean) {
    const def = getItemDefinition(slot.id);
    const name = def?.name ?? slot.id;
    const head = drawerHead({
      iconItemId: slot.id,
      title: slot.quantity > 1 ? `${name} ×${slot.quantity}` : name,
      sub: `${itemCategoryLabel(slot.id)} · ${this.msWhere(index)}`,
    });
    drawer.content.replaceChildren(head);

    const rows: KvRow[] = [];
    if (def) {
      const effect = (label: string, n: number | undefined) => {
        if (!n) return;
        rows.push({ label, value: signed(n), tone: n > 0 ? "ok" : "bad" });
      };
      effect("Health", def.restoreHealth);
      effect("Food", def.restoreHunger);
      effect("Water", def.restoreThirst);
      if (def.healOverTimeHp && def.healOverTimeIntervalMs && def.healOverTimeDurationMs) {
        const total = Math.round(
          (def.healOverTimeHp * def.healOverTimeDurationMs) / def.healOverTimeIntervalMs,
        );
        rows.push({
          label: "Heals",
          value: `+${total} over ${Math.round(def.healOverTimeDurationMs / 1000)} s`,
          tone: "ok",
        });
      }
      if (def.treatsInfection) rows.push({ label: "Infection", value: "Treats it", tone: "ok" });
      if (def.consumeDurationMs) rows.push({ label: "Takes", value: seconds(def.consumeDurationMs) });
    }
    const max = getMaxDurability(slot.id);
    if (max != null && max > 0) {
      const left = getEntryDurability(slot);
      rows.push({ label: "Condition", value: `${left} / ${max}`, tone: left / max < 0.25 ? "warn" : undefined });
    }
    const wet = getEntryWetness(slot);
    if (wet > 0.005) rows.push({ label: "Wet", value: `${Math.round(wet * 100)}%`, tone: "warn" });
    const loaded = this.slotLoadedRounds(index, slot.id);
    if (loaded > 0) rows.push({ label: "Loaded", value: `${loaded} rounds` });
    if (isRadioItem(slot.id)) {
      const freq = getEntryRadioFreq(slot);
      rows.push({
        label: "Frequency",
        value: freq > 0 ? (isListenOnlyRadioFreq(freq) ? `${freq} · listen only` : String(freq)) : "Untuned",
      });
    }
    const gearEffect = wornGearEffectHint(slot.id);
    if (gearEffect) rows.push({ label: "Effect", value: gearEffect, tone: "ok" });
    const packed = sealedBackpackStackCount(slot);
    if (packed > 0) rows.push({ label: "Inside", value: packed === 1 ? "1 item" : `${packed} items` });
    if (isHotbarOnlyItem(slot.id)) rows.push({ label: "Size", value: "Too large for pockets" });
    if (index === this.equippedInventorySlot) rows.push({ label: "In hand", value: "Yes", tone: "ok" });
    if (rows.length > 0) {
      const card = kvCard(rows);
      card.classList.add("ms-card--pad");
      drawer.content.append(card);
    }

    drawer.bar.replaceChildren();
    if (this.msDropQty != null) {
      this.msFillDropPicker(drawer, index, slot);
      return;
    }

    const primary = this.msPrimaryAction(index, slot, needed);
    if (primary) {
      const btn = sheetButton(primary.label, "pri", primary.run, { sub: primary.sub });
      btn.disabled = !!primary.disabled;
      if (primary.disabled) btn.classList.add("ms-btn--off");
      drawer.bar.append(btn);
    }
    const row = document.createElement("div");
    row.className = "ms-bar-row";
    const ammoType = getAmmoTypeForWeapon(slot.id);
    if (
      loaded > 0 &&
      ammoType &&
      canAddToInventory(this.currentInventory, ammoType, loaded, this.extraPockets)
    ) {
      row.append(sheetButton("Unload", "sec", () => this.handlers.onUnload(index)));
    }
    row.append(
      sheetButton("Move", "sec", () => {
        this.msMove = { from: index, half: false };
        this.renderMobile();
      }),
    );
    if (slot.quantity > 1 && shiftSplitQuantity(slot.quantity) >= 1) {
      row.append(
        sheetButton("Split", "sec", () => {
          this.msMove = { from: index, half: true };
          this.renderMobile();
        }),
      );
    }
    row.append(
      sheetButton(slot.quantity > 1 ? "Drop…" : "Drop", "danger", () => {
        if (slot.quantity > 1) {
          this.msDropQty = 1;
          this.msSyncDrawer();
        } else {
          this.handlers.onDrop(index, 1);
        }
      }),
    );
    drawer.bar.append(row);
  }

  private msFillDropPicker(drawer: Drawer, index: number, slot: NonNullable<Inventory[number]>) {
    const total = slot.quantity;
    const half = Math.max(1, Math.floor(total / 2));
    let value = Math.max(1, Math.min(total, this.msDropQty ?? 1));
    const options = [
      { label: "1", value: 1 },
      ...(half > 1 && half < total ? [{ label: `Half (${half})`, value: half }] : []),
      { label: `All (${total})`, value: total },
    ];
    const quickSlot = document.createElement("div");
    const dropBtn = sheetButton("", "danger", () => {
      this.msDropQty = null;
      this.handlers.onDrop(index, value);
      this.msSyncDrawer();
    });
    const sync = () => {
      this.msDropQty = value;
      setButtonLabel(dropBtn, `Drop ${value}`);
      quickSlot.replaceChildren(quickAmounts(options, value, pick));
    };
    const stepper = createStepper({
      value,
      min: 1,
      max: total,
      onChange: (next) => {
        value = next;
        sync();
      },
    });
    const pick = (next: number) => {
      value = next;
      stepper.set(next);
      sync();
    };
    drawer.content.append(sectionLabel("Drop how many?"), stepper.el, quickSlot);
    sync();
    const row = document.createElement("div");
    row.className = "ms-bar-row";
    row.append(
      sheetButton("Cancel", "sec", () => {
        this.msDropQty = null;
        this.msSyncDrawer();
      }),
      dropBtn,
    );
    drawer.bar.append(row);
  }

  private msPrimaryAction(
    index: number,
    slot: NonNullable<Inventory[number]>,
    needed: boolean,
  ): { label: string; run: () => void; sub?: string; disabled?: boolean } | null {
    const def = getItemDefinition(slot.id);
    if (weaponIndexFromItemId(slot.id) >= 0) {
      return this.equippedInventorySlot === index
        ? { label: "Unequip", run: () => this.handlers.onUnequip() }
        : { label: "Equip", run: () => this.handlers.onEquip(index) };
    }
    if (isClothingItem(slot.id)) {
      return index === CLOTHING_SLOT_INDEX
        ? { label: "Take off", run: () => this.handlers.onRemoveClothing() }
        : { label: "Wear", run: () => this.handlers.onWearClothing(index) };
    }
    if (def?.consumeDurationMs) {
      let label = "Use";
      if (isWeaponBlueprint(slot.id)) label = "Learn";
      else if (isSkillMagazine(slot.id)) label = "Read";
      else if (def.category === "drink") label = "Drink one";
      else if (def.category === "food") label = "Eat one";
      return {
        label,
        run: () => this.handlers.onUse(index),
        disabled: !needed,
        sub: needed ? undefined : "not needed now",
      };
    }
    if (isReadableItem(slot.id)) {
      return {
        label: "Read",
        run: () => {
          this.selectedSlot = index;
          this.readSelected();
        },
      };
    }
    const access = inventorySlotAccess(this.currentInventory, this.extraPockets);
    if (isMobileWornSlot(index)) {
      const { pockets, backpack } = carrySlotGroups(this.currentInventory, this.extraPockets);
      const dest = [...pockets, ...backpack].find(
        (to) => !this.currentInventory[to] && this.msCanMoveTo(index, to, false),
      );
      return dest == null
        ? { label: "Take off", run: () => {}, disabled: true, sub: "no free slot" }
        : { label: "Take off", run: () => this.handlers.onMoveSlot(index, dest, false) };
    }
    const wear = MOBILE_WORN_SLOTS.find(
      (to) =>
        to >= WEAPON_SLOT_COUNT &&
        itemFitsInSlot(slot.id, to, access) &&
        this.msCanMoveTo(index, to, false),
    );
    if (wear != null) {
      return { label: "Wear", run: () => this.handlers.onMoveSlot(index, wear, false) };
    }
    return null;
  }

  destroy() {
    cancelAllSlotDrags();
    this.visible = false;
    this.closeRead();
    this.unbindPhoneResize();
    this.unbindPhoneResize = () => {};
    this.overlay.hidden = true;
    this.overlay.remove();
    document.body.classList.remove("inventory-open");
  }
}
