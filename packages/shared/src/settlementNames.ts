/**
 * Word pools for procedural city/town names.
 * Combined via patterns so results read like real place names (Ashford, New Pinehaven, …).
 */

/** Local PRNG — same xmur3/mulberry32 as worldgen, kept here to avoid circular imports. */
function xmur3(str: string) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

function mulberry32(a: number) {
  return () => {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededRandom(seedKey: string): () => number {
  return mulberry32(xmur3(seedKey)());
}

const PREFIXES = [
  "New",
  "Old",
  "North",
  "South",
  "East",
  "West",
  "Fort",
  "Port",
  "Mount",
  "Lake",
  "Upper",
  "Lower",
  "Saint",
] as const;

/** Leading roots that stand alone as the first word / stem. */
const ROOTS = [
  "Ash",
  "Birch",
  "Oak",
  "Pine",
  "Cedar",
  "Willow",
  "Maple",
  "Elm",
  "Holly",
  "Hawthorn",
  "Brook",
  "Creek",
  "River",
  "Stone",
  "Rock",
  "Hill",
  "Ridge",
  "Vale",
  "Glen",
  "Dale",
  "Mill",
  "Bridge",
  "Field",
  "Meadow",
  "Grove",
  "Wood",
  "Forest",
  "Spring",
  "Cliff",
  "Shore",
  "Bay",
  "Harbor",
  "Cross",
  "Gate",
  "Ford",
  "Bend",
  "Hollow",
  "Peak",
  "Bluff",
  "Marsh",
  "Moor",
  "Heath",
  "Thorn",
  "Iron",
  "Copper",
  "Silver",
  "Amber",
  "Raven",
  "Crow",
  "Fox",
  "Wolf",
  "Bear",
  "Deer",
  "Hawk",
  "Falcon",
  "Eagle",
  "Badger",
  "Otter",
  "Heron",
  "Black",
  "White",
  "Red",
  "Green",
  "Clear",
  "Fair",
  "Bright",
  "Cold",
  "Still",
  "Quiet",
] as const;

/** Suffixes glued to a root (Ash + ford → Ashford). */
const GLUED_SUFFIXES = [
  "ton",
  "ville",
  "burg",
  "ford",
  "field",
  "wood",
  "haven",
  "ridge",
  "dale",
  "hurst",
  "stead",
  "wick",
  "ham",
  "bury",
  "chester",
  "port",
  "view",
  "crest",
  "falls",
  "springs",
  "point",
  "creek",
  "hollow",
  "grove",
  "bluff",
  "gate",
  "bridge",
  "mill",
  "moor",
  "heath",
] as const;

/** Second words used as spaced geographic endings (Pine Hill). */
const TRAILERS = [
  "Hill",
  "Hills",
  "Ridge",
  "Creek",
  "River",
  "Falls",
  "Springs",
  "Point",
  "Landing",
  "Crossing",
  "Junction",
  "Station",
  "Heights",
  "Hollow",
  "Grove",
  "Woods",
  "Meadow",
  "Valley",
  "Bluff",
  "Shore",
  "Bay",
  "Harbor",
  "Mills",
  "Bridge",
  "Ferry",
  "Gate",
  "Pass",
] as const;

export type SettlementNameKind = "city" | "town";

function pick<T extends readonly string[]>(
  rng: () => number,
  pool: T,
): T[number] {
  return pool[Math.floor(rng() * pool.length)]!;
}

/** Avoid awkward doubles like Creekcreek / Hillhill. */
function rootCompatibleWithSuffix(root: string, suffix: string): boolean {
  const r = root.toLowerCase();
  const s = suffix.toLowerCase();
  if (r === s) return false;
  if (r.endsWith(s) || s.startsWith(r)) return false;
  if (s.length >= 4 && r.includes(s.slice(0, 4))) return false;
  return true;
}

function pickGluedSuffix(rng: () => number, root: string): string {
  for (let i = 0; i < 8; i++) {
    const suffix = pick(rng, GLUED_SUFFIXES);
    if (rootCompatibleWithSuffix(root, suffix)) return suffix;
  }
  return "ton";
}

function pickTrailer(rng: () => number, root: string): string {
  for (let i = 0; i < 8; i++) {
    const trailer = pick(rng, TRAILERS);
    if (rootCompatibleWithSuffix(root, trailer)) return trailer;
  }
  return "Hill";
}

/**
 * Deterministic place name from a seed key.
 * Cities lean toward grander patterns; towns toward shorter roadside names.
 */
export function generateSettlementName(
  seedKey: string,
  kind: SettlementNameKind = "city",
): string {
  const rng = seededRandom(`place-name:${kind}:${seedKey}`);
  const root = pick(rng, ROOTS);

  const roll = rng();
  if (kind === "city") {
    if (roll < 0.28) {
      return `${pick(rng, PREFIXES)} ${root}${pickGluedSuffix(rng, root)}`;
    }
    if (roll < 0.55) {
      return `${root}${pickGluedSuffix(rng, root)}`;
    }
    if (roll < 0.78) {
      return `${root} ${pickTrailer(rng, root)}`;
    }
    return `${pick(rng, PREFIXES)} ${root} ${pickTrailer(rng, root)}`;
  }

  // Towns — shorter, plainer.
  if (roll < 0.45) {
    return `${root}${pickGluedSuffix(rng, root)}`;
  }
  if (roll < 0.75) {
    return `${root} ${pickTrailer(rng, root)}`;
  }
  if (roll < 0.9) {
    return `${pick(rng, PREFIXES)} ${root}${pickGluedSuffix(rng, root)}`;
  }
  return `${pick(rng, ["Little", "East", "West", "North", "South"] as const)} ${root}`;
}
