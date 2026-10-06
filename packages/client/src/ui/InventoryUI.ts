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
  jewelrySkillXpForItem,
  getItemDefinition,
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
  type Inventory,
} from "@zombie/shared";
import { AudioManager } from "../audio/AudioManager";
import { isMobileDevice } from "../device";
import { appendItemDurabilityBar, appendItemIcon, appendItemWetnessBar, markQuestKeepsake } from "./itemIcons";
import { createDialogCloseButton } from "./dialogCloseBtn";
import { resetDialogScroll } from "./dialogScroll";
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
  private gridEl: HTMLElement;
  private detailEl: HTMLElement;
  private footerEl: HTMLElement;
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

  constructor(private handlers: InventoryUIHandlers) {
    this.overlay = document.createElement("div");
    this.overlay.id = "inventory-overlay";
    this.overlay.hidden = true;

    const panel = document.createElement("div");
    panel.className = "inventory-panel";

    const header = document.createElement("div");
    header.className = "inventory-header";
    const headerTop = document.createElement("div");
    headerTop.className = "inventory-header-top";
    const title = document.createElement("h2");
    title.className = "inventory-title";
    title.textContent = "Inventory";
    headerTop.append(title, createDialogCloseButton(() => this.close()));
    const hint = document.createElement("span");
    hint.className = "inventory-hint";
    hint.textContent = isMobileDevice()
      ? "Drag to move · double-tap weapon to equip"
      : "Drag to move · shift-drag moves half · double-click weapon to equip · Tab to close";
    header.append(headerTop, hint);

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

    this.gridEl.append(weaponsSection, equipmentSection, carryScroll);

    this.detailEl = document.createElement("div");
    this.detailEl.className = "inventory-detail";

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
      this.useBtn,
      this.unloadBtn,
      this.dropBtn,
      this.dropAllBtn,
      this.unequipBtn,
    );
    this.footerEl.append(this.detailEl, actions);

    panel.append(header, this.gridEl, this.footerEl);
    this.overlay.appendChild(panel);
    document.body.appendChild(this.overlay);

    this.overlay.addEventListener("click", (event) => {
      if (event.target === this.overlay) this.close();
    });
  }

  toggle() {
    if (this.visible) this.close();
    else this.open();
  }

  open() {
    if (this.visible) return;
    this.visible = true;
    this.overlay.hidden = false;
    document.body.classList.add("inventory-open");
    resetDialogScroll(this.overlay);
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
    document.body.classList.remove("inventory-open");
    if (wasOpen) AudioManager.get().play("inventory_close");
  }

  isOpen() {
    return this.visible;
  }

  /**
   * Refresh the vitals the detail panel reads (a drink is greyed out when the
   * player is not thirsty) without rebuilding the slot grid. Health, hunger,
   * thirst and core temperature all drift while the bag sits open.
   */
  updateStats(playerStats: InventoryPlayerStats) {
    this.playerStats = playerStats;
    if (!this.visible) return;
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

    this.updateDetail();
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
      const isWeaponEquipped =
        weaponIndex >= 0 && this.equippedInventorySlot === index;
      const isClothingWorn =
        isClothingItem(slot.id) && index === CLOTHING_SLOT_INDEX;
      if (
        isWeaponEquipped ||
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
      cell.setAttribute(
        "aria-label",
        `${def?.name ?? slot.id}${slot.quantity > 1 ? ` ×${slot.quantity}` : ""}${freqLabel}${dur}${wetLabel}`,
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
          if (shift) {
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
          this.handlers.onMoveSlot(index, toSlot, shift);
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
      this.selectedSlot = slot || emptyGearSlotHint(index) ? index : -1;
      this.render(
        inventoryJson,
        this.equippedInventorySlot,
        undefined,
        this.equippedClothingSlot,
        this.weaponMagazinesJson,
        this.equippedMagazineRounds,
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
      this.detailEl.textContent = hint;
      this.hideActionButtons();
      return;
    }

    this.footerEl.hidden = false;

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
    const wornXp = jewelrySkillXpForItem(slot.id);
    if (wornXp > 0) {
      zoneHint += ` · +${wornXp} Bartering and Persuasion XP while worn`;
    }
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

  destroy() {
    cancelAllSlotDrags();
    this.overlay.remove();
    document.body.classList.remove("inventory-open");
  }
}
