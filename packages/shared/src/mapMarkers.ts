/** Personal map pins. Stored on the player row and pushed only to that player. */
export const MAP_MARKER_LIMIT = 40;
export const MAP_MARKER_TEXT_LIMIT = 32;
export const EMPTY_MAP_MARKERS_JSON = "[]";

export const MAP_MARKER_SHAPES = [
  "pin",
  "circle",
  "diamond",
  "square",
  "triangle",
  "star",
  "cross",
  "flag",
] as const;

export type MapMarkerShape = (typeof MAP_MARKER_SHAPES)[number];

export type MapMarker = {
  id: string;
  x: number;
  y: number;
  shape: MapMarkerShape;
  text: string;
};

const MARKER_ID = /^[A-Za-z0-9_-]{1,40}$/;
/** Wider than the charted county so a pin at the map edge still saves. */
const MARKER_COORD_LIMIT = 200_000;

function isShape(value: unknown): value is MapMarkerShape {
  return (
    typeof value === "string" &&
    (MAP_MARKER_SHAPES as readonly string[]).includes(value)
  );
}

function cleanText(raw: string): string {
  return raw
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim()
    .slice(0, MAP_MARKER_TEXT_LIMIT);
}

/**
 * Accept a client payload. Null when the value is not a marker list.
 * Entries that fail the shape check are dropped. More than the cap is rejected.
 */
export function parseMapMarkers(raw: unknown): MapMarker[] | null {
  if (!Array.isArray(raw) || raw.length > MAP_MARKER_LIMIT) return null;
  const markers: MapMarker[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    if (typeof row.id !== "string" || !MARKER_ID.test(row.id) || seen.has(row.id)) {
      continue;
    }
    if (typeof row.x !== "number" || typeof row.y !== "number") continue;
    if (!Number.isFinite(row.x) || !Number.isFinite(row.y)) continue;
    if (Math.abs(row.x) > MARKER_COORD_LIMIT || Math.abs(row.y) > MARKER_COORD_LIMIT) {
      continue;
    }
    if (!isShape(row.shape)) continue;
    if (typeof row.text !== "string") continue;
    seen.add(row.id);
    markers.push({
      id: row.id,
      x: Math.round(row.x * 100) / 100,
      y: Math.round(row.y * 100) / 100,
      shape: row.shape,
      text: cleanText(row.text),
    });
  }
  return markers;
}

export function parseMapMarkersJson(raw: string | null | undefined): MapMarker[] {
  if (!raw || !raw.trim()) return [];
  try {
    return parseMapMarkers(JSON.parse(raw) as unknown) ?? [];
  } catch {
    return [];
  }
}

export function serializeMapMarkersJson(markers: readonly MapMarker[]): string {
  return JSON.stringify(
    markers.map((marker) => ({
      id: marker.id,
      x: marker.x,
      y: marker.y,
      shape: marker.shape,
      text: marker.text,
    })),
  );
}
