import type { QuestMapMarker } from "@zombie/shared";
import {
  MAP_CHART_BARRACKS,
  MAP_CHART_BUILDING,
  MAP_CHART_CARPARK,
  MAP_CHART_FLOOR,
  MAP_CHART_PAVEMENT,
  MAP_CHART_ROAD,
  birchportMapChartKind,
  birchportMapChartRevision,
  birchportMapPois,
  birchportSafezoneRects,
  getBirchportMapChart,
  type BirchportMapChart,
  type BirchportMapPoi,
} from "@zombie/shared";
import { isMobileDevice } from "../device";
import { resetDialogScroll } from "./dialogScroll";
import { type MinimapTileKind } from "../world/IsoTiles";

/** Tiles across the map when it opens, centered on the player. */
export const MAP_VIEW_TILES = 100;
/** Canvas resolution. Zoom changes how many tiles those pixels cover. */
const MAP_PIXELS = 400;
const MAP_VIEW_MIN = 40;
const MAP_VIEW_MAX = 1000;

const COLOR_EMPTY = [0x1a, 0x1c, 0x1a, 255] as const;
const COLOR_FLOOR = [0x4a, 0x7a, 0x3a, 255] as const;
const COLOR_ROAD = [0x3a, 0x3b, 0x3c, 255] as const;
const COLOR_PAVEMENT = [0x9a, 0x9a, 0x8e, 255] as const;
const COLOR_CAR_PARK = [0x7a, 0x7a, 0x78, 255] as const;
const COLOR_BARRACKS = [0x6a, 0x5c, 0x4a, 255] as const;
const COLOR_BUILDING = [0x5c, 0x40, 0x33, 255] as const;
const COLOR_STREETLIGHT = [0x8a, 0x8a, 0x70, 255] as const;

const CHART_KIND: Record<number, MinimapTileKind | undefined> = {
  [MAP_CHART_FLOOR]: "floor",
  [MAP_CHART_ROAD]: "road",
  [MAP_CHART_PAVEMENT]: "pavement",
  [MAP_CHART_CARPARK]: "carpark",
  [MAP_CHART_BARRACKS]: "barracks",
  [MAP_CHART_BUILDING]: "building",
};

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
  streetlight: COLOR_STREETLIGHT,
};

export type RadioPingMarker = {
  playerId: string;
  name: string;
  x: number;
  y: number;
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
  private questLayer: HTMLElement;
  private radioLayer: HTMLElement;
  private poiLayer: HTMLElement;
  private lastKindsSize = -1;
  private lastPaintKey = "";
  private centerTX = Number.NaN;
  private centerTY = Number.NaN;
  private viewSpan = MAP_VIEW_TILES;
  private followPlayer = true;
  private dragging = false;
  private dragMoved = false;
  private suppressCloseClick = false;
  private dragPointer = -1;
  private dragLastX = 0;
  private dragLastY = 0;
  private pinchDist = 0;
  private lastLabelKey = "";
  private lastQuestKey = "";
  private lastRadioKey = "";
  private lastPoiKey = "";
  private pois: BirchportMapPoi[] | null = null;
  private mapChart: BirchportMapChart | null = null;

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
      ? "Drag to move · pinch to zoom · tap outside to close"
      : "Drag to move · scroll to zoom · M to close";
    header.append(title, hint);

    const frame = document.createElement("div");
    frame.className = "map-frame";

    this.canvas = document.createElement("canvas");
    this.canvas.className = "map-terrain";
    this.canvas.width = MAP_PIXELS;
    this.canvas.height = MAP_PIXELS;

    this.markerCanvas = document.createElement("canvas");
    this.markerCanvas.className = "map-markers";
    this.markerCanvas.width = MAP_PIXELS;
    this.markerCanvas.height = MAP_PIXELS;

    this.labelsLayer = document.createElement("div");
    this.labelsLayer.className = "map-labels";

    this.questLayer = document.createElement("div");
    this.questLayer.className = "map-quest-layer";

    this.radioLayer = document.createElement("div");
    this.radioLayer.className = "map-quest-layer";

    this.poiLayer = document.createElement("div");
    this.poiLayer.className = "map-poi-layer";

    frame.append(
      this.canvas,
      this.markerCanvas,
      this.labelsLayer,
      this.poiLayer,
      this.questLayer,
      this.radioLayer,
    );
    panel.append(header, frame, this.buildLegend());
    this.overlay.appendChild(panel);
    document.body.appendChild(this.overlay);

    this.overlay.addEventListener("click", (event) => {
      if (this.suppressCloseClick) {
        this.suppressCloseClick = false;
        return;
      }
      if (event.target === this.overlay) this.close();
    });
    this.bindPanZoom(frame);
  }

  /** Keep the view on the player until they pan or zoom. */
  syncFollow(playerX: number, playerY: number) {
    if (!this.followPlayer) return;
    this.viewX = playerX;
    this.viewY = playerY;
    this.clampView();
  }

  /** Tiles currently visible in the map frame. */
  viewTileBounds(): { minX: number; maxX: number; minY: number; maxY: number } {
    const half = this.viewSpan / 2;
    return {
      minX: Math.floor(this.viewX - half),
      maxX: Math.ceil(this.viewX + half),
      minY: Math.floor(this.viewY - half),
      maxY: Math.ceil(this.viewY + half),
    };
  }

  private viewX = Number.NaN;
  private viewY = Number.NaN;

  private bindPanZoom(frame: HTMLElement) {
    frame.addEventListener("pointerdown", (event) => {
      if ((event.target as HTMLElement).closest(".map-quest-pin")) return;
      this.dragging = true;
      this.dragMoved = false;
      this.dragPointer = event.pointerId;
      this.dragLastX = event.clientX;
      this.dragLastY = event.clientY;
      frame.classList.add("is-dragging");
      frame.setPointerCapture(event.pointerId);
    });
    frame.addEventListener("pointermove", (event) => {
      if (!this.dragging || event.pointerId !== this.dragPointer) return;
      const rect = frame.getBoundingClientRect();
      if (rect.width <= 0) return;
      const dx = event.clientX - this.dragLastX;
      const dy = event.clientY - this.dragLastY;
      if (Math.hypot(dx, dy) > 3) this.dragMoved = true;
      this.dragLastX = event.clientX;
      this.dragLastY = event.clientY;
      const tilesPerPx = this.viewSpan / rect.width;
      this.viewX -= dx * tilesPerPx;
      this.viewY -= dy * tilesPerPx;
      this.followPlayer = false;
      this.clampView();
    });
    const endDrag = (event: PointerEvent) => {
      if (event.pointerId !== this.dragPointer) return;
      this.dragging = false;
      this.dragPointer = -1;
      frame.classList.remove("is-dragging");
      if (this.dragMoved) this.suppressCloseClick = true;
    };
    frame.addEventListener("pointerup", endDrag);
    frame.addEventListener("pointercancel", endDrag);
    frame.addEventListener(
      "wheel",
      (event) => {
        event.preventDefault();
        this.zoomAt(frame, event.clientX, event.clientY, event.deltaY > 0 ? 1.15 : 1 / 1.15);
      },
      { passive: false },
    );
    this.bindPinch(frame);
  }

  private bindPinch(frame: HTMLElement) {
    const points = new Map<number, { x: number; y: number }>();
    frame.addEventListener("pointerdown", (event) => {
      points.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (points.size === 2) this.pinchDist = this.pointerSpread(points);
    });
    frame.addEventListener("pointermove", (event) => {
      if (!points.has(event.pointerId)) return;
      points.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (points.size !== 2) return;
      const dist = this.pointerSpread(points);
      if (this.pinchDist > 0 && dist > 0) {
        const mid = this.pointerMid(points);
        this.zoomAt(frame, mid.x, mid.y, this.pinchDist / dist);
        this.pinchDist = dist;
        this.dragging = false;
      }
    });
    const clear = (event: PointerEvent) => {
      points.delete(event.pointerId);
      this.pinchDist = points.size === 2 ? this.pointerSpread(points) : 0;
    };
    frame.addEventListener("pointerup", clear);
    frame.addEventListener("pointercancel", clear);
  }

  private pointerSpread(points: Map<number, { x: number; y: number }>): number {
    const [a, b] = [...points.values()];
    if (!a || !b) return 0;
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  private pointerMid(points: Map<number, { x: number; y: number }>): { x: number; y: number } {
    const [a, b] = [...points.values()];
    return { x: ((a?.x ?? 0) + (b?.x ?? 0)) / 2, y: ((a?.y ?? 0) + (b?.y ?? 0)) / 2 };
  }

  private zoomAt(frame: HTMLElement, clientX: number, clientY: number, factor: number) {
    const rect = frame.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const u = (clientX - rect.left) / rect.width;
    const v = (clientY - rect.top) / rect.height;
    const next = Math.max(MAP_VIEW_MIN, Math.min(MAP_VIEW_MAX, this.viewSpan * factor));
    if (next === this.viewSpan) return;
    const left = this.viewX - this.viewSpan / 2;
    const top = this.viewY - this.viewSpan / 2;
    const worldX = left + u * this.viewSpan;
    const worldY = top + v * this.viewSpan;
    this.viewSpan = next;
    this.viewX = worldX - u * next + next / 2;
    this.viewY = worldY - v * next + next / 2;
    this.followPlayer = false;
    this.clampView();
  }

  private clampView() {
    const chart = this.mapChart ?? getBirchportMapChart();
    const half = this.viewSpan / 2;
    const minCX = chart.minX + half;
    const maxCX = chart.minX + chart.width - half;
    const minCY = chart.minY + half;
    const maxCY = chart.minY + chart.height - half;
    this.viewX = minCX > maxCX ? chart.minX + chart.width / 2 : Math.max(minCX, Math.min(maxCX, this.viewX));
    this.viewY = minCY > maxCY ? chart.minY + chart.height / 2 : Math.max(minCY, Math.min(maxCY, this.viewY));
  }

  private project(tx: number, ty: number): { px: number; py: number } {
    const left = this.viewX - this.viewSpan / 2;
    const top = this.viewY - this.viewSpan / 2;
    return {
      px: ((tx - left) / this.viewSpan) * MAP_PIXELS,
      py: ((ty - top) / this.viewSpan) * MAP_PIXELS,
    };
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
    this.viewSpan = MAP_VIEW_TILES;
    this.followPlayer = true;
    this.dragging = false;
    this.lastKindsSize = -1;
    this.lastPaintKey = "";
    this.lastLabelKey = "";
    this.lastQuestKey = "";
    this.lastRadioKey = "";
    this.lastPoiKey = "";
    this.labelsLayer.replaceChildren();
    this.poiLayer.replaceChildren();
    this.questLayer.replaceChildren();
    this.radioLayer.replaceChildren();
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
    questMarkers: readonly QuestMapMarker[] = [],
    radioPings: readonly RadioPingMarker[] = [],
  ) {
    if (!this.visible) return;

    if (!Number.isFinite(this.viewX)) {
      this.viewX = centerX;
      this.viewY = centerY;
    }

    const paintKey = `${this.viewX.toFixed(1)}|${this.viewY.toFixed(1)}|${Math.round(this.viewSpan)}|${kinds.size}|${birchportMapChartRevision()}`;
    if (paintKey !== this.lastPaintKey) {
      this.lastPaintKey = paintKey;
      this.centerTX = Math.floor(this.viewX);
      this.centerTY = Math.floor(this.viewY);
      this.lastKindsSize = kinds.size;
      this.paintTerrain(kinds);
    }

    this.paintMarkers(markers);
    this.paintSettlementLabels(settlements);
    this.paintPoiMarkers();
    this.paintQuestMarkers(questMarkers);
    this.paintRadioPings(radioPings);
  }

  private paintTerrain(kinds: ReadonlyMap<string, MinimapTileKind>) {
    const ctx = this.canvas.getContext("2d");
    if (!ctx) return;
    if (!this.mapChart) this.mapChart = getBirchportMapChart();

    const image = ctx.createImageData(MAP_PIXELS, MAP_PIXELS);
    const data = image.data;
    const left = this.viewX - this.viewSpan / 2;
    const top = this.viewY - this.viewSpan / 2;
    const scale = this.viewSpan / MAP_PIXELS;
    let i = 0;

    for (let py = 0; py < MAP_PIXELS; py++) {
      const ty = Math.floor(top + (py + 0.5) * scale);
      for (let px = 0; px < MAP_PIXELS; px++) {
        const tx = Math.floor(left + (px + 0.5) * scale);
        const live = kinds.get(`${tx},${ty}`);
        const chartKind = live
          ? undefined
          : CHART_KIND[birchportMapChartKind(this.mapChart, tx, ty)];
        const kind = live ?? chartKind;
        const [r, g, b, a] = kind ? KIND_COLOR[kind] : COLOR_EMPTY;
        data[i++] = r;
        data[i++] = g;
        data[i++] = b;
        data[i++] = a;
      }
    }

    ctx.putImageData(image, 0, 0);
  }

  private paintMarkers(markers: MapOverlayMarker[]) {
    const ctx = this.markerCanvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, MAP_PIXELS, MAP_PIXELS);
    this.paintSafezone(ctx);

    for (const marker of markers) {
      const { px, py } = this.project(marker.x, marker.y);
      if (px < 0 || py < 0 || px >= MAP_PIXELS || py >= MAP_PIXELS) continue;

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

  /** Dashed edge of the Birchport exterior weapon restriction. */
  private paintSafezone(ctx: CanvasRenderingContext2D) {
    const rects = birchportSafezoneRects();
    ctx.save();
    ctx.strokeStyle = "rgba(226, 59, 59, 0.95)";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    for (const rect of rects) {
      const a = this.project(rect.minX, rect.minY);
      const b = this.project(rect.maxX, rect.maxY);
      const x = Math.min(a.px, b.px);
      const y = Math.min(a.py, b.py);
      ctx.strokeRect(x, y, Math.abs(b.px - a.px), Math.abs(b.py - a.py));
    }
    ctx.restore();
  }

  private buildLegend(): HTMLElement {
    const legend = document.createElement("div");
    legend.className = "map-legend";
    const items: { label: string; swatch: string }[] = [
      { label: "Safezone", swatch: "safezone" },
      { label: "Building", swatch: "building" },
      { label: "Place", swatch: "place" },
      { label: "Task", swatch: "task" },
      { label: "Road", swatch: "road" },
      { label: "Sidewalk", swatch: "sidewalk" },
    ];
    for (const item of items) {
      const row = document.createElement("span");
      row.className = "map-legend-item";
      const swatch = document.createElement("span");
      swatch.className = `map-legend-swatch map-legend-swatch--${item.swatch}`;
      swatch.setAttribute("aria-hidden", "true");
      const label = document.createElement("span");
      label.textContent = item.label;
      row.append(swatch, label);
      legend.appendChild(row);
    }
    return legend;
  }

  private paintSettlementLabels(
    settlements: readonly MapOverlaySettlementLabel[],
  ) {
    const key = `${this.viewX.toFixed(0)},${this.viewY.toFixed(0)},${Math.round(this.viewSpan)}|${settlements
      .map((s) => s.id)
      .join(";")}`;
    if (key === this.lastLabelKey) return;
    this.lastLabelKey = key;
    this.labelsLayer.replaceChildren();

    for (const place of settlements) {
      const { px, py } = this.project(place.x, place.y);
      if (px < -8 || py < -8 || px > MAP_PIXELS + 8 || py > MAP_PIXELS + 8) {
        continue;
      }

      const el = document.createElement("span");
      el.className =
        place.kind === "city" ? "map-place-label city" : "map-place-label town";
      el.textContent = place.name;
      el.style.left = `${(px / MAP_PIXELS) * 100}%`;
      el.style.top = `${(py / MAP_PIXELS) * 100}%`;
      this.labelsLayer.appendChild(el);
    }
  }

  private paintPoiMarkers() {
    if (!this.pois) this.pois = birchportMapPois();
    const key = `${this.viewX.toFixed(0)},${this.viewY.toFixed(0)},${Math.round(this.viewSpan)}|${this.pois
      .map((poi) => poi.id)
      .join(",")}`;
    if (key === this.lastPoiKey) return;
    this.lastPoiKey = key;
    this.poiLayer.replaceChildren();

    for (const poi of this.pois) {
      const { px, py } = this.project(poi.x, poi.y);
      if (px < 0 || py < 0 || px > MAP_PIXELS || py > MAP_PIXELS) continue;

      const el = document.createElement("span");
      el.className = "map-poi";
      el.style.left = `${(px / MAP_PIXELS) * 100}%`;
      el.style.top = `${(py / MAP_PIXELS) * 100}%`;

      const name = document.createElement("span");
      name.className = "map-poi-name";
      name.textContent = poi.name;

      const dot = document.createElement("span");
      dot.className = "map-poi-dot";
      dot.setAttribute("aria-hidden", "true");

      el.append(name, dot);
      this.poiLayer.appendChild(el);
    }
  }

  private paintQuestMarkers(markers: readonly QuestMapMarker[]) {
    const key = `${this.viewX.toFixed(0)},${this.viewY.toFixed(0)},${Math.round(this.viewSpan)}|${markers
      .map((m) => `${m.questId}:${m.x},${m.y}`)
      .join(";")}`;
    if (key === this.lastQuestKey) return;
    this.lastQuestKey = key;
    this.questLayer.replaceChildren();

    for (const marker of markers) {
      const projected = this.project(marker.x, marker.y);
      let px = projected.px;
      let py = projected.py;
      const offMap =
        px < 0 || py < 0 || px >= MAP_PIXELS || py >= MAP_PIXELS;
      px = Math.max(1.5, Math.min(MAP_PIXELS - 1.5, px));
      py = Math.max(1.5, Math.min(MAP_PIXELS - 1.5, py));

      const el = document.createElement("button");
      el.type = "button";
      const tipSide =
        py < 18 ? "below" : px < 22 ? "right" : px > MAP_PIXELS - 22 ? "left" : "above";
      el.className = offMap
        ? `map-quest-pin map-quest-pin--offmap map-quest-pin--${tipSide}`
        : `map-quest-pin map-quest-pin--${tipSide}`;
      el.setAttribute("aria-label", marker.title);
      el.style.left = `${(px / MAP_PIXELS) * 100}%`;
      el.style.top = `${(py / MAP_PIXELS) * 100}%`;

      const dot = document.createElement("span");
      dot.className = "map-quest-pin-dot";
      dot.setAttribute("aria-hidden", "true");

      const tip = document.createElement("span");
      tip.className = "map-quest-pin-tip";
      tip.textContent = marker.title;

      el.append(dot, tip);
      el.addEventListener("click", (event) => {
        event.stopPropagation();
        const open = el.classList.contains("is-open");
        for (const pin of this.questLayer.querySelectorAll(".map-quest-pin.is-open")) {
          pin.classList.remove("is-open");
        }
        if (!open) el.classList.add("is-open");
      });
      this.questLayer.appendChild(el);
    }
  }

  private paintRadioPings(markers: readonly RadioPingMarker[]) {
    const key = `${this.viewX.toFixed(0)},${this.viewY.toFixed(0)},${Math.round(this.viewSpan)}|${markers
      .map((m) => `${m.playerId}:${Math.floor(m.x)},${Math.floor(m.y)}`)
      .join(";")}`;
    if (key === this.lastRadioKey) return;
    this.lastRadioKey = key;
    this.radioLayer.replaceChildren();

    for (const marker of markers) {
      const projected = this.project(marker.x, marker.y);
      let px = projected.px;
      let py = projected.py;
      const offMap =
        px < 0 || py < 0 || px >= MAP_PIXELS || py >= MAP_PIXELS;
      px = Math.max(1.5, Math.min(MAP_PIXELS - 1.5, px));
      py = Math.max(1.5, Math.min(MAP_PIXELS - 1.5, py));

      const el = document.createElement("button");
      el.type = "button";
      const tipSide =
        py < 18 ? "below" : px < 22 ? "right" : px > MAP_PIXELS - 22 ? "left" : "above";
      el.className = offMap
        ? `map-quest-pin map-radio-pin map-quest-pin--offmap map-quest-pin--${tipSide}`
        : `map-quest-pin map-radio-pin map-quest-pin--${tipSide}`;
      el.setAttribute("aria-label", marker.name);
      el.style.left = `${(px / MAP_PIXELS) * 100}%`;
      el.style.top = `${(py / MAP_PIXELS) * 100}%`;

      const dot = document.createElement("span");
      dot.className = "map-quest-pin-dot";
      dot.setAttribute("aria-hidden", "true");

      const tip = document.createElement("span");
      tip.className = "map-quest-pin-tip";
      tip.textContent = marker.name;

      el.append(dot, tip);
      el.addEventListener("click", (event) => {
        event.stopPropagation();
        const open = el.classList.contains("is-open");
        for (const pin of this.radioLayer.querySelectorAll(".map-quest-pin.is-open")) {
          pin.classList.remove("is-open");
        }
        if (!open) el.classList.add("is-open");
      });
      this.radioLayer.appendChild(el);
    }
  }

  destroy() {
    this.overlay.remove();
    document.body.classList.remove("map-open");
  }
}
