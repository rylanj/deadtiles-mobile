import { isMobileDevice } from "../device";
import { resetDialogScroll } from "./dialogScroll";
import {
  RENDER_RADIUS,
  type MinimapTileKind,
} from "../world/IsoTiles";

/** Matches the overworld render square (±RENDER_RADIUS). */
export const MAP_OVERLAY_RADIUS = RENDER_RADIUS;
const MAP_SIZE = MAP_OVERLAY_RADIUS * 2 + 1;

const COLOR_EMPTY = [0x1a, 0x1c, 0x1a, 255] as const;
const COLOR_FLOOR = [0x4a, 0x7a, 0x3a, 255] as const;
const COLOR_ROAD = [0x3a, 0x3b, 0x3c, 255] as const;
const COLOR_PAVEMENT = [0x9a, 0x9a, 0x8e, 255] as const;
const COLOR_CAR_PARK = [0x7a, 0x7a, 0x78, 255] as const;
const COLOR_BARRACKS = [0x6a, 0x5c, 0x4a, 255] as const;
const COLOR_BUILDING = [0x5c, 0x40, 0x33, 255] as const;
const COLOR_TREE = [0x2d, 0x4a, 0x2d, 255] as const;
const COLOR_FENCE = [0x6b, 0x4e, 0x2e, 255] as const;
const COLOR_STREETLIGHT = [0x8a, 0x8a, 0x70, 255] as const;

const KIND_COLOR: Record<
  MinimapTileKind,
  readonly [number, number, number, number]
> = {
  floor: COLOR_FLOOR,
  road: COLOR_ROAD,
  pavement: COLOR_PAVEMENT,
  carpark: COLOR_CAR_PARK,
  barracks: COLOR_BARRACKS,
  building: COLOR_BUILDING,
  tree: COLOR_TREE,
  fence: COLOR_FENCE,
  streetlight: COLOR_STREETLIGHT,
};

export type MapOverlayMarker = {
  x: number;
  y: number;
  kind: "self" | "player" | "zombie" | "guard";
};

export type MapOverlaySettlementLabel = {
  id: string;
  name: string;
  kind: "city" | "town";
  x: number;
  y: number;
};

/**
 * Top-down map overlay: paints only tiles already drawn in the overworld
 * render square (no worldgen on open). Settlement names are labelled in HTML
 * so they stay readable when the pixel map is scaled up.
 */
export class MapOverlayUI {
  private visible = false;
  private overlay: HTMLElement;
  private canvas: HTMLCanvasElement;
  private markerCanvas: HTMLCanvasElement;
  private labelsLayer: HTMLElement;
  private lastKindsSize = -1;
  private centerTX = Number.NaN;
  private centerTY = Number.NaN;
  private lastLabelKey = "";

  constructor() {
    this.overlay = document.createElement("div");
    this.overlay.id = "map-overlay";
    this.overlay.hidden = true;

    const panel = document.createElement("div");
    panel.className = "map-panel";

    const header = document.createElement("div");
    header.className = "map-header";
    const title = document.createElement("h2");
    title.className = "map-title";
    title.textContent = "Map";
    const hint = document.createElement("span");
    hint.className = "map-hint";
    hint.textContent = isMobileDevice()
      ? `Tap outside to close · ${MAP_OVERLAY_RADIUS} tiles each way`
      : `M to close · ${MAP_OVERLAY_RADIUS} tiles each way`;
    header.append(title, hint);

    const frame = document.createElement("div");
    frame.className = "map-frame";

    this.canvas = document.createElement("canvas");
    this.canvas.className = "map-terrain";
    this.canvas.width = MAP_SIZE;
    this.canvas.height = MAP_SIZE;

    this.markerCanvas = document.createElement("canvas");
    this.markerCanvas.className = "map-markers";
    this.markerCanvas.width = MAP_SIZE;
    this.markerCanvas.height = MAP_SIZE;

    this.labelsLayer = document.createElement("div");
    this.labelsLayer.className = "map-labels";

    frame.append(this.canvas, this.markerCanvas, this.labelsLayer);
    panel.append(header, frame);
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
    this.visible = true;
    this.overlay.hidden = false;
    resetDialogScroll(this.overlay);
    document.body.classList.add("map-open");
  }

  close() {
    this.visible = false;
    this.overlay.hidden = true;
    this.centerTX = Number.NaN;
    this.centerTY = Number.NaN;
    this.lastKindsSize = -1;
    this.lastLabelKey = "";
    this.labelsLayer.replaceChildren();
    document.body.classList.remove("map-open");
  }

  isOpen() {
    return this.visible;
  }

  /**
   * Paint terrain from already-rendered tile kinds when the center or
   * drawn-tile set changes, then redraw entity markers and place names.
   */
  render(
    centerX: number,
    centerY: number,
    markers: MapOverlayMarker[],
    kinds: ReadonlyMap<string, MinimapTileKind>,
    settlements: readonly MapOverlaySettlementLabel[] = [],
  ) {
    if (!this.visible) return;

    const tx = Math.floor(centerX);
    const ty = Math.floor(centerY);

    if (
      tx !== this.centerTX ||
      ty !== this.centerTY ||
      kinds.size !== this.lastKindsSize
    ) {
      this.centerTX = tx;
      this.centerTY = ty;
      this.lastKindsSize = kinds.size;
      this.paintTerrain(tx, ty, kinds);
    }

    this.paintMarkers(tx, ty, markers);
    this.paintSettlementLabels(tx, ty, settlements);
  }

  private paintTerrain(
    centerTX: number,
    centerTY: number,
    kinds: ReadonlyMap<string, MinimapTileKind>,
  ) {
    const ctx = this.canvas.getContext("2d");
    if (!ctx) return;

    const image = ctx.createImageData(MAP_SIZE, MAP_SIZE);
    const data = image.data;
    let i = 0;

    for (let dy = -MAP_OVERLAY_RADIUS; dy <= MAP_OVERLAY_RADIUS; dy++) {
      for (let dx = -MAP_OVERLAY_RADIUS; dx <= MAP_OVERLAY_RADIUS; dx++) {
        const kind = kinds.get(`${centerTX + dx},${centerTY + dy}`);
        const [r, g, b, a] = kind ? KIND_COLOR[kind] : COLOR_EMPTY;
        data[i++] = r;
        data[i++] = g;
        data[i++] = b;
        data[i++] = a;
      }
    }

    ctx.putImageData(image, 0, 0);
  }

  private paintMarkers(
    centerTX: number,
    centerTY: number,
    markers: MapOverlayMarker[],
  ) {
    const ctx = this.markerCanvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, MAP_SIZE, MAP_SIZE);

    for (const marker of markers) {
      const px = Math.floor(marker.x) - centerTX + MAP_OVERLAY_RADIUS;
      const py = Math.floor(marker.y) - centerTY + MAP_OVERLAY_RADIUS;
      if (px < 0 || py < 0 || px >= MAP_SIZE || py >= MAP_SIZE) continue;

      if (marker.kind === "self") {
        ctx.fillStyle = "#5ec85e";
        ctx.fillRect(px - 2, py - 2, 5, 5);
        ctx.strokeStyle = "#e8f8e8";
        ctx.lineWidth = 1;
        ctx.strokeRect(px - 2.5, py - 2.5, 6, 6);
      } else if (marker.kind === "player") {
        ctx.fillStyle = "#66ccff";
        ctx.fillRect(px - 1, py - 1, 3, 3);
      } else if (marker.kind === "guard") {
        ctx.fillStyle = "#c8a050";
        ctx.fillRect(px - 1, py - 1, 3, 3);
      } else {
        ctx.fillStyle = "#cc4444";
        ctx.fillRect(px, py, 2, 2);
      }
    }
  }

  private paintSettlementLabels(
    centerTX: number,
    centerTY: number,
    settlements: readonly MapOverlaySettlementLabel[],
  ) {
    const key = `${centerTX},${centerTY}|${settlements
      .map((s) => s.id)
      .join(";")}`;
    if (key === this.lastLabelKey) return;
    this.lastLabelKey = key;
    this.labelsLayer.replaceChildren();

    for (const place of settlements) {
      const px = place.x - centerTX + MAP_OVERLAY_RADIUS;
      const py = place.y - centerTY + MAP_OVERLAY_RADIUS;
      // Keep labels near the map; allow a little overflow for edge towns.
      if (px < -8 || py < -8 || px > MAP_SIZE + 8 || py > MAP_SIZE + 8) {
        continue;
      }

      const el = document.createElement("span");
      el.className =
        place.kind === "city" ? "map-place-label city" : "map-place-label town";
      el.textContent = place.name;
      el.style.left = `${(px / MAP_SIZE) * 100}%`;
      el.style.top = `${(py / MAP_SIZE) * 100}%`;
      this.labelsLayer.appendChild(el);
    }
  }

  destroy() {
    this.overlay.remove();
    document.body.classList.remove("map-open");
  }
}
