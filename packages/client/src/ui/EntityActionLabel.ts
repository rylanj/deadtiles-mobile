import Phaser from "phaser";
import { ENTITY_RENDER_HEIGHT } from "@zombie/shared";

/** Short-lived captions above entities (reload, search, bandage, eat, drink, use, …). */
export type EntityActionKind =
  | "reload"
  | "unload"
  | "search"
  | "bandage"
  | "eat"
  | "drink"
  | "use"
  | "craft"
  | "build"
  | "wear"
  | "remove";

const ACTION_TEXT: Record<EntityActionKind, string> = {
  reload: "Reloading",
  unload: "Unloading",
  search: "Searching",
  bandage: "Bandaging",
  eat: "Eating",
  drink: "Drinking",
  use: "Using",
  craft: "Crafting",
  build: "Building",
  wear: "Wearing",
  remove: "Removing",
};

const LABEL_DEPTH = 9_999_998;
const HEAD_GAP = 6;

const LABEL_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontSize: "11px",
  fontFamily: "system-ui, sans-serif",
  fontStyle: "italic",
  color: "#e8f8e8",
  backgroundColor: "rgba(10,14,10,0.78)",
  padding: { x: 5, y: 2 },
  shadow: { color: "#000", blur: 3, fill: true },
  align: "center",
};

type ActiveLabel = {
  text: Phaser.GameObjects.Text;
  entityId: string;
  stackBelowPx: number;
};

type TransientLabel = {
  text: Phaser.GameObjects.Text;
  entityId: string;
  expiresAt: number;
  stackBelowPx: number;
};

export const MISS_LABEL_MS = 1800;

/**
 * Small chat-style captions pinned above entity sprites.
 * One label per entity + action kind; call sync each frame from the scene.
 */
export class EntityActionLabelManager {
  private labels = new Map<string, ActiveLabel>();
  private transientLabels = new Map<string, TransientLabel>();

  constructor(private scene: Phaser.Scene) {}

  private labelKey(entityId: string, kind: EntityActionKind): string {
    return `${entityId}:${kind}`;
  }

  private placeLabel(entry: ActiveLabel, sprite: Phaser.GameObjects.Sprite) {
    entry.text.setPosition(
      sprite.x,
      sprite.y - ENTITY_RENDER_HEIGHT - HEAD_GAP - entry.stackBelowPx,
    );
  }

  /**
   * Show or hide an action caption.
   * stackBelowPx — extra lift when a chat bubble sits above the head.
   */
  sync(
    entityId: string,
    kind: EntityActionKind,
    active: boolean,
    sprite: Phaser.GameObjects.Sprite | null,
    stackBelowPx = 0,
    label = ACTION_TEXT[kind],
  ) {
    const key = this.labelKey(entityId, kind);

    if (!active) {
      this.remove(key);
      return;
    }

    let entry = this.labels.get(key);
    if (!entry) {
      const text = this.scene.add.text(0, 0, label, LABEL_STYLE);
      text.setOrigin(0.5, 1);
      text.setDepth(LABEL_DEPTH);
      entry = { text, entityId, stackBelowPx };
      this.labels.set(key, entry);
    } else {
      entry.stackBelowPx = stackBelowPx;
      if (entry.text.text !== label) entry.text.setText(label);
    }

    if (!sprite?.visible) {
      entry.text.setVisible(false);
      return;
    }

    entry.text.setVisible(true);
    this.placeLabel(entry, sprite);
  }

  /** Brief caption (e.g. combat "Miss") above any entity sprite. */
  flash(
    entityId: string,
    label: string,
    durationMs = MISS_LABEL_MS,
    stackBelowPx = 0,
  ) {
    const key = `transient:${entityId}`;
    const existing = this.transientLabels.get(key);
    if (existing) existing.text.destroy();

    const text = this.scene.add.text(0, 0, label, LABEL_STYLE);
    text.setOrigin(0.5, 1);
    text.setDepth(LABEL_DEPTH);
    this.transientLabels.set(key, {
      text,
      entityId,
      expiresAt: Date.now() + durationMs,
      stackBelowPx,
    });
  }

  /** Brief caption at a fixed screen point (e.g. miss on tree cover). */
  flashAtPosition(
    screenX: number,
    screenY: number,
    label: string,
    durationMs = MISS_LABEL_MS,
    offsetAbovePx = 14,
  ) {
    const text = this.scene.add.text(
      screenX,
      screenY - offsetAbovePx,
      label,
      LABEL_STYLE,
    );
    text.setOrigin(0.5, 1);
    text.setDepth(LABEL_DEPTH);
    this.scene.time.delayedCall(durationMs, () => text.destroy());
  }

  /** Reposition labels after sprites move (same frame as chat bubbles). */
  followSprites(getSprite: (entityId: string) => Phaser.GameObjects.Sprite | undefined) {
    for (const entry of this.labels.values()) {
      const sprite = getSprite(entry.entityId);
      if (!sprite?.visible) {
        entry.text.setVisible(false);
        continue;
      }
      entry.text.setVisible(true);
      this.placeLabel(entry, sprite);
    }

    const now = Date.now();
    for (const [key, entry] of this.transientLabels) {
      if (now >= entry.expiresAt) {
        entry.text.destroy();
        this.transientLabels.delete(key);
        continue;
      }
      const sprite = getSprite(entry.entityId);
      if (!sprite?.visible) {
        entry.text.setVisible(false);
        continue;
      }
      entry.text.setVisible(true);
      entry.text.setPosition(
        sprite.x,
        sprite.y - ENTITY_RENDER_HEIGHT - HEAD_GAP - entry.stackBelowPx,
      );
    }
  }

  private remove(key: string) {
    const entry = this.labels.get(key);
    if (!entry) return;
    entry.text.destroy();
    this.labels.delete(key);
  }

  /** Drop all active captions for an entity (e.g. when its sprite is removed). */
  clearEntity(entityId: string) {
    for (const key of [...this.labels.keys()]) {
      if (key.startsWith(`${entityId}:`)) this.remove(key);
    }
    const transientKey = `transient:${entityId}`;
    const transient = this.transientLabels.get(transientKey);
    if (transient) {
      transient.text.destroy();
      this.transientLabels.delete(transientKey);
    }
  }

  destroy() {
    for (const entry of this.labels.values()) entry.text.destroy();
    for (const entry of this.transientLabels.values()) entry.text.destroy();
    this.labels.clear();
    this.transientLabels.clear();
  }
}
