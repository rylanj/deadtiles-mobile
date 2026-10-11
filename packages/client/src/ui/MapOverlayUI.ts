import type { QuestMapMarker } from "@zombie/shared";
import {
  ASHEN_COUNTY_WALK_BOUNDS,
  MAP_CHART_BARRACKS,
  MAP_CHART_BUILDING,
  MAP_CHART_CARPARK,
  MAP_CHART_FLOOR,
  MAP_CHART_PAVEMENT,
  MAP_CHART_ROAD,
  MAP_MARKER_LIMIT,
  MAP_MARKER_SHAPES,
  MAP_MARKER_TEXT_LIMIT,
  birchportMapChartKind,
  birchportMapChartRevision,
  birchportMapPois,
  birchportSafezoneRects,
  getBirchportMapChart,
  parseMapMarkers,
  serializeMapMarkersJson,
  worldMaxX,
  worldMaxY,
  type BirchportMapChart,
  type BirchportMapPoi,
  type MapMarker,
  type MapMarkerShape,
} from "@zombie/shared";
import { isMobileDevice } from "../device";
import { loadCachedAuthSession } from "../network/ColyseusClient";
import { resetDialogScroll } from "./dialogScroll";
import { type MinimapTileKind } from "../world/IsoTiles";

/** Tiles across the map the first time it opens, centered on the player. */
export const MAP_VIEW_TILES = 100;
/** Canvas resolution. Zoom changes how many tiles those pixels cover. */
const MAP_PIXELS = 400;
const MAP_VIEW_MIN = 40;
/** Far enough to frame the county border from Birchport, plus land past it. */
const MAP_VIEW_MAX = 4200;
const MAP_VIEW_STORAGE_KEY = "deadtiles.mapView";

type SavedMapView = {
  span: number;
};

function readSavedMapView(): SavedMapView | null {
  try {
    const raw = localStorage.getItem(MAP_VIEW_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedMapView>;
    if (typeof parsed.span !== "number" || !Number.isFinite(parsed.span)) {
      return null;
    }
    return {
      span: Math.max(MAP_VIEW_MIN, Math.min(MAP_VIEW_MAX, parsed.span)),
    };
  } catch {
    return null;
  }
}

function writeSavedMapView(view: SavedMapView) {
  try {
    localStorage.setItem(MAP_VIEW_STORAGE_KEY, JSON.stringify(view));
  } catch {
    // Private mode or a full disk. The open map still keeps its view.
  }
}

const MARKER_STORAGE_KEY = "deadtiles.mapMarkers";
const MARKER_DOUBLE_TAP_MS = 500;

const MARKER_SHAPE_LABEL: Record<MapMarkerShape, string> = {
  pin: "Pin",
  circle: "Circle",
  diamond: "Diamond",
  square: "Square",
  triangle: "Triangle",
  star: "Star",
  cross: "Cross",
  flag: "Flag",
};

const TIP_SHAPES: ReadonlySet<MapMarkerShape> = new Set(["pin", "flag"]);

const MARKER_SHAPE_PATH: Record<Exclude<MapMarkerShape, "circle">, string> = {
  pin: "M8 1.2c-2.65 0-4.6 2-4.6 4.65 0 3.4 4.6 8.95 4.6 8.95s4.6-5.55 4.6-8.95C12.6 3.2 10.65 1.2 8 1.2zm0 2.45a2.15 2.15 0 1 1 0 4.3 2.15 2.15 0 0 1 0-4.3z",
  diamond: "M8 1.3 14.5 8 8 14.7 1.5 8Z",
  square: "M2.4 2.4h11.2v11.2H2.4Z",
  triangle: "M8 1.6 14.6 14.2H1.4Z",
  star: "M8 1.3 9.62 5.78 14.37 5.93 10.62 8.85 11.94 13.42 8 10.75 4.06 13.42 5.38 8.85 1.63 5.93 6.38 5.78Z",
  cross: "M6.15 1.5h3.7v4.65h4.65v3.7H9.85v4.65h-3.7V9.85H1.5v-3.7h4.65Z",
  flag: "M6.6 1.2h1.8V14.8H6.6zm1.8.9h5.9L11.7 5.1 14.3 8.1H8.4z",
};

type MarkerDraft = {
  id: string | null;
  x: number;
  y: number;
  shape: MapMarkerShape;
  text: string;
};

function markerOwnerKey(): string {
  const wallet = loadCachedAuthSession()?.wallet ?? "";
  return wallet || "local";
}

function cleanMarkerText(raw: string, trim: boolean): string {
  const stripped = raw.replace(/[\u0000-\u001F\u007F]/g, "").slice(0, MAP_MARKER_TEXT_LIMIT);
  return trim ? stripped.trim() : stripped;
}

function readMarkerFile(): Record<string, unknown> {
  try {
    const raw = localStorage.getItem(MARKER_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** Pins saved in the browser before they were stored on the account. */
function readLegacyMarkers(): MapMarker[] {
  const owner = markerOwnerKey();
  const all = readMarkerFile();
  const owned = parseMapMarkers(all[owner]) ?? [];
  if (owned.length > 0 || owner === "local") return owned;
  return parseMapMarkers(all.local) ?? [];
}

function clearLegacyMarkers() {
  const owner = markerOwnerKey();
  const all = readMarkerFile();
  let changed = false;
  if (Object.prototype.hasOwnProperty.call(all, owner)) {
    delete all[owner];
    changed = true;
  }
  if (owner !== "local" && Object.prototype.hasOwnProperty.call(all, "local")) {
    delete all.local;
    changed = true;
  }
  if (!changed) return;
  try {
    if (Object.keys(all).length === 0) localStorage.removeItem(MARKER_STORAGE_KEY);
    else localStorage.setItem(MARKER_STORAGE_KEY, JSON.stringify(all));
  } catch {
    // Leave the browser copy. The next login can try again.
  }
}

function mergeMarkers(primary: readonly MapMarker[], extra: readonly MapMarker[]): MapMarker[] {
  const seen = new Set(primary.map((marker) => marker.id));
  const merged = [...primary];
  for (const marker of extra) {
    if (seen.has(marker.id) || merged.length >= MAP_MARKER_LIMIT) continue;
    seen.add(marker.id);
    merged.push(marker);
  }
  return merged;
}

function newMarkerId(): string {
  return `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function markerShapeIcon(shape: MapMarkerShape): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.classList.add("map-marker-shape");
  svg.setAttribute("aria-hidden", "true");
  if (shape === "circle") {
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", "8");
    circle.setAttribute("cy", "8");
    circle.setAttribute("r", "5.6");
    svg.appendChild(circle);
    return svg;
  }
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", MARKER_SHAPE_PATH[shape]);
  if (shape === "pin") path.setAttribute("fill-rule", "evenodd");
  svg.appendChild(path);
  return svg;
}

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
 * Personal markers are placed with a double-click and saved on the player account.
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
  private mapFrame: HTMLElement;
  private customLayer: HTMLElement;
  private markerEditor: HTMLElement;
  private markerTitle!: HTMLElement;
  private markerTextInput!: HTMLInputElement;
  private markerSaveBtn!: HTMLButtonElement;
  private markerRemoveBtn!: HTMLButtonElement;
  private markerNote!: HTMLElement;
  private readonly markerShapeButtons = new Map<MapMarkerShape, HTMLButtonElement>();
  private markers: MapMarker[] = [];
  private markersReady = false;
  /** Last list sent to the server. Older echoes are ignored until this one lands. */
  private pendingMarkerJson: string | null = null;
  private onMarkersChange: ((markers: MapMarker[]) => void) | null = null;
  private draft: MarkerDraft | null = null;
  private lastShape: MapMarkerShape = "pin";
  private lastCustomDataKey = "";
  private editorOpenedAt = 0;
  private editorOpenX = 0;
  private editorOpenY = 0;
  private pressOriginX = 0;
  private pressOriginY = 0;
  private lastTapAt = 0;
  private lastTapX = 0;
  private lastTapY = 0;
  /** Held Escape should cancel the editor, not also close the map. */
  private swallowMarkerEscapeRepeat = false;
  private readonly onMarkerEditorKey = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return;
    if (event.repeat && this.swallowMarkerEscapeRepeat) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    this.swallowMarkerEscapeRepeat = false;
    if (!this.draft) return;
    event.preventDefault();
    event.stopPropagation();
    this.swallowMarkerEscapeRepeat = true;
    this.dismissMarkerEditor(true);
  };
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

  constructor(options?: { onMarkersChange?: (markers: MapMarker[]) => void }) {
    this.onMarkersChange = options?.onMarkersChange ?? null;
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
      ? "Double-tap to mark · drag to move · pinch to zoom · tap outside to close"
      : "Double-click to mark · drag to move · scroll to zoom · M to close";
    header.append(title, hint);

    const frame = document.createElement("div");
    frame.className = "map-frame";
    this.mapFrame = frame;

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

    this.customLayer = document.createElement("div");
    this.customLayer.className = "map-custom-layer";

    this.markerEditor = this.buildMarkerEditor();

    frame.append(
      this.canvas,
      this.markerCanvas,
      this.labelsLayer,
      this.poiLayer,
      this.questLayer,
      this.radioLayer,
      this.customLayer,
      this.markerEditor,
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
    this.restoreSavedView();
    document.addEventListener("keydown", this.onMarkerEditorKey, true);
  }

  /** Last zoom. Reopening always recenters on the player. */
  private restoreSavedView() {
    const saved = readSavedMapView();
    if (!saved) return;
    this.viewSpan = saved.span;
  }

  private rememberView() {
    writeSavedMapView({ span: this.viewSpan });
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
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest(".map-quest-pin, .map-custom-pin, .map-marker-editor")
      ) {
        return;
      }
      this.dragging = true;
      this.dragMoved = false;
      this.dragPointer = event.pointerId;
      this.dragLastX = event.clientX;
      this.dragLastY = event.clientY;
      this.pressOriginX = event.clientX;
      this.pressOriginY = event.clientY;
      frame.classList.add("is-dragging");
      try {
        frame.setPointerCapture(event.pointerId);
      } catch {
        // The pointer can already be gone. Panning still tracks the move events.
      }
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
    const endDrag = (event: PointerEvent, cancelled: boolean) => {
      if (event.pointerId !== this.dragPointer) return;
      const pressDist = Math.hypot(
        event.clientX - this.pressOriginX,
        event.clientY - this.pressOriginY,
      );
      this.dragging = false;
      this.dragPointer = -1;
      frame.classList.remove("is-dragging");
      if (this.dragMoved) this.suppressCloseClick = true;
      const tapSlop = event.pointerType === "touch" ? 28 : 16;
      if (!cancelled && pressDist <= tapSlop && this.pinchDist <= 0) this.onMapTap(event);
      else this.lastTapAt = 0;
    };
    frame.addEventListener("pointerup", (event) => endDrag(event, false));
    frame.addEventListener("pointercancel", (event) => endDrag(event, true));
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
    this.followPlayer = true;
    this.visible = true;
    this.overlay.hidden = false;
    resetDialogScroll(this.overlay);
    document.body.classList.add("map-open");
  }

  close() {
    this.rememberView();
    this.dismissMarkerEditor(false);
    this.visible = false;
    this.overlay.hidden = true;
    this.centerTX = Number.NaN;
    this.centerTY = Number.NaN;
    this.dragging = false;
    this.lastTapAt = 0;
    this.lastKindsSize = -1;
    this.lastPaintKey = "";
    this.lastLabelKey = "";
    this.lastQuestKey = "";
    this.lastRadioKey = "";
    this.lastPoiKey = "";
    this.lastCustomDataKey = "";
    this.labelsLayer.replaceChildren();
    this.poiLayer.replaceChildren();
    this.questLayer.replaceChildren();
    this.radioLayer.replaceChildren();
    this.customLayer.replaceChildren();
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
    this.paintCustomMarkers();
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
    this.paintCountyBorder(ctx);
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

  /** Dashed edge of walkable Ashen County. Land past the line is scenery. */
  private paintCountyBorder(ctx: CanvasRenderingContext2D) {
    const bounds = ASHEN_COUNTY_WALK_BOUNDS;
    const a = this.project(bounds.minGlobalX, bounds.minGlobalY);
    const b = this.project(worldMaxX(bounds), worldMaxY(bounds));
    const x = Math.min(a.px, b.px);
    const y = Math.min(a.py, b.py);
    const w = Math.abs(b.px - a.px);
    const h = Math.abs(b.py - a.py);
    ctx.save();
    ctx.setLineDash([8, 5]);
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(42, 36, 18, 0.9)";
    ctx.strokeRect(x, y, w, h);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(226, 197, 106, 0.95)";
    ctx.strokeRect(x, y, w, h);
    ctx.restore();
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
      { label: "County border", swatch: "county" },
      { label: "Safezone", swatch: "safezone" },
      { label: "Building", swatch: "building" },
      { label: "Place", swatch: "place" },
      { label: "Marker", swatch: "marker" },
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
    document.removeEventListener("keydown", this.onMarkerEditorKey, true);
    this.rememberView();
    this.overlay.remove();
    document.body.classList.remove("map-open");
  }

  /**
   * Account pins from the server. The first copy also uploads any pins that
   * were still sitting in this browser from before they were saved.
   */
  applyServerMarkers(raw: unknown) {
    const incoming = parseMapMarkers(raw) ?? [];
    const first = !this.markersReady;
    this.markersReady = true;
    if (first && incoming.length === 0) {
      const merged = mergeMarkers(this.markers, readLegacyMarkers());
      if (merged.length > 0) {
        this.markers = merged;
        this.publishMarkers();
      }
    } else if (first && this.markers.length > 0) {
      const merged = mergeMarkers(incoming, this.markers);
      this.markers = merged;
      if (serializeMapMarkersJson(merged) !== serializeMapMarkersJson(incoming)) {
        this.publishMarkers();
      }
      if (incoming.length > 0) clearLegacyMarkers();
    } else {
      const incomingJson = serializeMapMarkersJson(incoming);
      if (!this.pendingMarkerJson || incomingJson === this.pendingMarkerJson) {
        this.pendingMarkerJson = null;
        this.markers = incoming;
        if (incoming.length > 0) clearLegacyMarkers();
      }
    }
    this.lastCustomDataKey = "";
    if (this.visible) this.paintCustomMarkers();
  }

  private persistMarkers() {
    if (!this.markersReady) return;
    this.publishMarkers();
  }

  private publishMarkers() {
    this.pendingMarkerJson = serializeMapMarkersJson(this.markers);
    this.onMarkersChange?.(this.markers);
  }

  /** Second quick tap on the map opens the marker editor at that spot. */
  private onMapTap(event: PointerEvent) {
    const now = performance.now();
    const gap = Math.hypot(event.clientX - this.lastTapX, event.clientY - this.lastTapY);
    const gapLimit = event.pointerType === "touch" ? 48 : 30;
    const repeat =
      this.lastTapAt > 0 && now - this.lastTapAt <= MARKER_DOUBLE_TAP_MS && gap <= gapLimit;
    if (!repeat) {
      this.lastTapAt = now;
      this.lastTapX = event.clientX;
      this.lastTapY = event.clientY;
      return;
    }
    this.lastTapAt = 0;
    if (this.draft?.id) return;
    const world = this.clientToWorld(event.clientX, event.clientY);
    if (!world) return;
    if (this.draft) {
      this.draft.x = world.x;
      this.draft.y = world.y;
      this.lastCustomDataKey = "";
      this.paintCustomMarkers();
      return;
    }
    this.openNewMarkerEditor(world.x, world.y, event.clientX, event.clientY);
  }

  private clientToWorld(clientX: number, clientY: number): { x: number; y: number } | null {
    if (!Number.isFinite(this.viewX) || !Number.isFinite(this.viewY)) return null;
    const rect = this.mapFrame.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const u = (clientX - rect.left) / rect.width;
    const v = (clientY - rect.top) / rect.height;
    if (u < 0 || v < 0 || u > 1 || v > 1) return null;
    return this.clampMarkerPoint(
      this.viewX - this.viewSpan / 2 + u * this.viewSpan,
      this.viewY - this.viewSpan / 2 + v * this.viewSpan,
    );
  }

  private clampMarkerPoint(x: number, y: number): { x: number; y: number } {
    const chart = this.mapChart ?? getBirchportMapChart();
    return {
      x: Math.min(chart.minX + chart.width, Math.max(chart.minX, x)),
      y: Math.min(chart.minY + chart.height, Math.max(chart.minY, y)),
    };
  }

  private buildMarkerEditor(): HTMLElement {
    const editor = document.createElement("div");
    editor.className = "map-marker-editor";
    editor.setAttribute("role", "dialog");
    editor.setAttribute("aria-label", "Map marker");
    editor.hidden = true;

    this.markerTitle = document.createElement("p");
    this.markerTitle.className = "map-marker-editor-title";
    this.markerTitle.textContent = "New marker";

    const shapes = document.createElement("div");
    shapes.className = "map-marker-shapes";
    shapes.setAttribute("role", "radiogroup");
    shapes.setAttribute("aria-label", "Icon shape");
    for (const shape of MAP_MARKER_SHAPES) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "map-marker-shape-btn";
      button.setAttribute("role", "radio");
      button.setAttribute("aria-checked", "false");
      button.title = MARKER_SHAPE_LABEL[shape];
      button.setAttribute("aria-label", MARKER_SHAPE_LABEL[shape]);
      button.appendChild(markerShapeIcon(shape));
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!this.draft) return;
        this.draft.shape = shape;
        this.lastShape = shape;
        this.syncMarkerEditor();
        this.lastCustomDataKey = "";
        this.paintCustomMarkers();
      });
      this.markerShapeButtons.set(shape, button);
      shapes.appendChild(button);
    }

    const field = document.createElement("label");
    field.className = "map-marker-field";
    const fieldLabel = document.createElement("span");
    fieldLabel.textContent = "Text";
    this.markerTextInput = document.createElement("input");
    this.markerTextInput.type = "text";
    this.markerTextInput.maxLength = MAP_MARKER_TEXT_LIMIT;
    this.markerTextInput.placeholder = "Label";
    this.markerTextInput.autocomplete = "off";
    this.markerTextInput.spellcheck = true;
    this.markerTextInput.enterKeyHint = "done";
    this.markerTextInput.setAttribute("aria-label", "Marker text");
    this.markerTextInput.addEventListener("input", () => {
      if (!this.draft) return;
      this.draft.text = cleanMarkerText(this.markerTextInput.value, false);
      this.lastCustomDataKey = "";
      this.paintCustomMarkers();
    });
    const keepKeyInField = (event: KeyboardEvent) => {
      event.stopPropagation();
    };
    this.markerTextInput.addEventListener("keydown", (event) => {
      keepKeyInField(event);
      if (event.key !== "Enter") return;
      event.preventDefault();
      this.saveMarkerDraft();
    });
    this.markerTextInput.addEventListener("keyup", keepKeyInField);
    field.append(fieldLabel, this.markerTextInput);

    this.markerNote = document.createElement("p");
    this.markerNote.className = "map-marker-note";
    this.markerNote.hidden = true;
    this.markerNote.textContent = `You can place ${MAP_MARKER_LIMIT} markers. Click one, then Remove.`;

    const actions = document.createElement("div");
    actions.className = "map-marker-actions";
    this.markerSaveBtn = document.createElement("button");
    this.markerSaveBtn.type = "button";
    this.markerSaveBtn.className = "inventory-action-btn";
    this.markerSaveBtn.textContent = "Place";
    this.markerSaveBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.saveMarkerDraft();
    });
    this.markerRemoveBtn = document.createElement("button");
    this.markerRemoveBtn.type = "button";
    this.markerRemoveBtn.className = "inventory-action-btn map-marker-remove";
    this.markerRemoveBtn.textContent = "Remove";
    this.markerRemoveBtn.hidden = true;
    this.markerRemoveBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.removeMarkerDraft();
    });
    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "inventory-action-btn";
    cancelBtn.textContent = "Cancel";
    cancelBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.dismissMarkerEditor(true);
    });
    actions.append(this.markerSaveBtn, this.markerRemoveBtn, cancelBtn);

    const swallowOpeningClick = (event: Event) => {
      if (!(event instanceof MouseEvent)) return false;
      const age = performance.now() - this.editorOpenedAt;
      const dist = Math.hypot(
        event.clientX - this.editorOpenX,
        event.clientY - this.editorOpenY,
      );
      return age < 700 && dist < 28;
    };
    editor.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
      if (!swallowOpeningClick(event)) return;
      event.preventDefault();
    });
    editor.addEventListener(
      "click",
      (event) => {
        if (!swallowOpeningClick(event)) return;
        event.preventDefault();
        event.stopPropagation();
      },
      true,
    );
    editor.addEventListener(
      "wheel",
      (event) => {
        event.preventDefault();
        event.stopPropagation();
      },
      { passive: false },
    );

    editor.append(this.markerTitle, shapes, field, this.markerNote, actions);
    return editor;
  }

  private openNewMarkerEditor(x: number, y: number, clientX: number, clientY: number) {
    this.draft = {
      id: null,
      x,
      y,
      shape: this.lastShape,
      text: "",
    };
    this.showMarkerEditor(true, clientX, clientY);
  }

  private openExistingMarkerEditor(
    marker: MapMarker,
    clientX: number,
    clientY: number,
  ) {
    this.lastTapAt = 0;
    this.draft = {
      id: marker.id,
      x: marker.x,
      y: marker.y,
      shape: marker.shape,
      text: marker.text,
    };
    this.showMarkerEditor(false, clientX, clientY);
  }

  /** Keep the form off the spot that was just marked. */
  private placeMarkerEditor(clientY: number) {
    const rect = this.mapFrame.getBoundingClientRect();
    const anchorBottom =
      !isMobileDevice() && clientY < rect.top + rect.height * 0.45;
    this.markerEditor.classList.toggle("is-bottom", anchorBottom);
  }

  private showMarkerEditor(fromMapTap: boolean, clientX: number, clientY: number) {
    if (!this.draft) return;
    this.placeMarkerEditor(clientY);
    this.editorOpenX = clientX;
    this.editorOpenY = clientY;
    const editing = this.draft.id !== null;
    this.markerTitle.textContent = editing ? "Edit marker" : "New marker";
    this.markerSaveBtn.textContent = editing ? "Save" : "Place";
    this.markerRemoveBtn.hidden = !editing;
    this.markerTextInput.value = this.draft.text;
    this.syncMarkerEditor();
    this.editorOpenedAt = performance.now();
    this.markerEditor.hidden = false;
    this.lastCustomDataKey = "";
    this.paintCustomMarkers();
    const focusField = (selectText: boolean) => {
      if (!this.draft || this.markerEditor.hidden) return;
      this.markerTextInput.focus({ preventScroll: true });
      if (selectText) this.markerTextInput.select();
    };
    focusField(true);
    if (fromMapTap) {
      window.addEventListener("click", () => focusField(false), {
        capture: true,
        once: true,
      });
    }
  }

  private syncMarkerEditor() {
    if (!this.draft) return;
    const full = this.draft.id === null && this.markers.length >= MAP_MARKER_LIMIT;
    this.markerNote.hidden = !full;
    this.markerSaveBtn.disabled = full;
    for (const [shape, button] of this.markerShapeButtons) {
      const selected = shape === this.draft.shape;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-checked", selected ? "true" : "false");
    }
  }

  private saveMarkerDraft() {
    if (!this.draft || this.markerSaveBtn.disabled) return;
    const text = cleanMarkerText(this.markerTextInput.value, true);
    const shape = this.draft.shape;
    this.lastShape = shape;
    if (this.draft.id) {
      const existing = this.markers.find((marker) => marker.id === this.draft?.id);
      if (!existing) {
        this.dismissMarkerEditor(true);
        return;
      }
      existing.shape = shape;
      existing.text = text;
    } else if (this.markers.length < MAP_MARKER_LIMIT) {
      this.markers.push({
        id: newMarkerId(),
        x: this.draft.x,
        y: this.draft.y,
        shape,
        text,
      });
    } else {
      this.syncMarkerEditor();
      return;
    }
    this.persistMarkers();
    this.dismissMarkerEditor(true);
  }

  private removeMarkerDraft() {
    const id = this.draft?.id;
    if (!id) return;
    this.markers = this.markers.filter((marker) => marker.id !== id);
    this.persistMarkers();
    this.dismissMarkerEditor(true);
  }

  private dismissMarkerEditor(paint: boolean) {
    this.draft = null;
    this.markerEditor.hidden = true;
    this.markerTextInput.blur();
    this.lastCustomDataKey = "";
    if (paint && this.visible) this.paintCustomMarkers();
  }

  private paintCustomMarkers() {
    if (!Number.isFinite(this.viewX) || !Number.isFinite(this.viewY)) return;
    const dataKey = this.customDataKey();
    if (dataKey !== this.lastCustomDataKey) {
      this.lastCustomDataKey = dataKey;
      this.rebuildCustomMarkers();
    }
    this.positionCustomMarkers();
  }

  private customDataKey(): string {
    const draft = this.draft
      ? `${this.draft.id ?? "new"}:${this.draft.x.toFixed(2)},${this.draft.y.toFixed(2)},${this.draft.shape},${this.draft.text}`
      : "";
    const body = this.markers
      .map((marker) => `${marker.id}:${marker.x.toFixed(2)},${marker.y.toFixed(2)},${marker.shape},${marker.text}`)
      .join(";");
    return `${body}|${draft}`;
  }

  private displayMarkers(): MapMarker[] {
    const list = this.markers.map((marker) => {
      if (this.draft?.id !== marker.id) return marker;
      return {
        ...marker,
        x: this.draft.x,
        y: this.draft.y,
        shape: this.draft.shape,
        text: this.draft.text,
      };
    });
    if (this.draft && this.draft.id === null) {
      list.push({
        id: "",
        x: this.draft.x,
        y: this.draft.y,
        shape: this.draft.shape,
        text: this.draft.text,
      });
    }
    return list;
  }

  private rebuildCustomMarkers() {
    const fragment = document.createDocumentFragment();
    for (const marker of this.displayMarkers()) {
      fragment.appendChild(this.buildCustomPin(marker));
    }
    this.customLayer.replaceChildren(fragment);
  }

  private buildCustomPin(marker: MapMarker): HTMLButtonElement {
    const preview = marker.id === "";
    const pin = document.createElement("button");
    pin.type = "button";
    pin.className = "map-custom-pin";
    if (TIP_SHAPES.has(marker.shape)) pin.classList.add("map-custom-pin--tip");
    if (preview || this.draft?.id === marker.id) pin.classList.add("is-draft");
    if (preview) pin.classList.add("is-preview");
    pin.dataset.x = String(marker.x);
    pin.dataset.y = String(marker.y);
    pin.appendChild(markerShapeIcon(marker.shape));
    const label = cleanMarkerText(marker.text, true);
    if (label) {
      const text = document.createElement("span");
      text.className = "map-custom-pin-label";
      text.textContent = label;
      pin.appendChild(text);
    }
    if (preview) {
      pin.tabIndex = -1;
      pin.setAttribute("aria-hidden", "true");
      return pin;
    }
    pin.title = label || "Edit marker";
    pin.setAttribute("aria-label", label ? `Edit marker ${label}` : "Edit marker");
    pin.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const existing = this.markers.find((item) => item.id === marker.id);
      if (!existing) return;
      this.openExistingMarkerEditor(existing, event.clientX, event.clientY);
    });
    return pin;
  }

  private positionCustomMarkers() {
    for (const node of this.customLayer.children) {
      if (!(node instanceof HTMLElement)) continue;
      const x = Number(node.dataset.x);
      const y = Number(node.dataset.y);
      const { px, py } = this.project(x, y);
      const visible =
        Number.isFinite(px) &&
        Number.isFinite(py) &&
        px >= -24 &&
        py >= -24 &&
        px <= MAP_PIXELS + 24 &&
        py <= MAP_PIXELS + 24;
      node.hidden = !visible;
      if (!visible) continue;
      node.style.left = `${(px / MAP_PIXELS) * 100}%`;
      node.style.top = `${(py / MAP_PIXELS) * 100}%`;
    }
  }
}
