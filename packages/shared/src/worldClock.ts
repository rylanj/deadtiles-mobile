/**
 * Authoritative world clock helpers (day/night + weather).
 * Server owns worldTimeMs / sky / precip / lightning; client uses these pure functions.
 *
 * Two independent axes, valid day or night:
 *   sky:    clear | cloudy
 *   precip: none  | rain | fog | snow   (mutually exclusive)
 */

import { ZOMBIE_SPEED } from "./constants.js";

export type DayPhase = "dawn" | "day" | "dusk" | "night";

export type SkyId = "clear" | "cloudy";
export type PrecipId = "none" | "rain" | "fog" | "snow";

export type WeatherState = {
  sky: SkyId;
  precip: PrecipId;
};

/** One real millisecond of sim time. */
const MINUTE_MS = 60 * 1000;

/**
 * Lit half of the cycle, including dawn and dusk transitions.
 * 120 minutes of daylight, then 60 minutes of night.
 */
export const DAYLIGHT_MS = 120 * MINUTE_MS;
export const NIGHT_MS = 60 * MINUTE_MS;

/** Soft sunrise / sunset inside the daylight window. */
export const DAWN_MS = 12 * MINUTE_MS;
export const DUSK_MS = 12 * MINUTE_MS;
/** Full sun, between dawn and dusk. */
export const DAY_MS = DAYLIGHT_MS - DAWN_MS - DUSK_MS;

/** Full day+night cycle length in ms (180 real minutes). */
export const DAY_LENGTH_MS = DAYLIGHT_MS + NIGHT_MS;

/**
 * Cycle origin is dawn (in-game 06:00). Midday is halfway through the
 * full-sun window so a fresh server starts in daylight.
 */
export const WORLD_TIME_MIDDAY_MS = DAWN_MS + DAY_MS / 2;

/** In-game clock hour at cycle origin (dawn). */
export const CYCLE_START_HOUR = 6;

/** Phase boundaries as fractions of DAY_LENGTH_MS [start, end). */
export const DAY_PHASE_FRACTIONS: Record<
  DayPhase,
  { start: number; end: number }
> = {
  dawn: { start: 0, end: DAWN_MS / DAY_LENGTH_MS },
  day: {
    start: DAWN_MS / DAY_LENGTH_MS,
    end: (DAWN_MS + DAY_MS) / DAY_LENGTH_MS,
  },
  dusk: {
    start: (DAWN_MS + DAY_MS) / DAY_LENGTH_MS,
    end: DAYLIGHT_MS / DAY_LENGTH_MS,
  },
  night: { start: DAYLIGHT_MS / DAY_LENGTH_MS, end: 1 },
};

/** How long a precip (or dry) stretch lasts in world-clock ms. */
export const PRECIP_DURATION_MS: Record<PrecipId, { min: number; max: number }> =
  {
    none: { min: 10 * 60 * 1000, max: 30 * 60 * 1000 },
    rain: { min: 10 * 60 * 1000, max: 30 * 60 * 1000 },
    fog: { min: 5 * 60 * 1000, max: 15 * 60 * 1000 },
    snow: { min: 5 * 60 * 1000, max: 15 * 60 * 1000 },
  };

/** Cloudy keeps this fraction of time-of-day brightness (20% dim). */
export const CLOUDY_BRIGHTNESS_KEEP = 0.8;

/** Overcast-day campfire puddle vs full night (streetlamps stay off). */
export const CLOUDY_DAY_FIRE_STRENGTH = 0.38;

/** Normalize world time into [0, dayLengthMs). */
export function worldTimeOfDayMs(
  worldTimeMs: number,
  dayLengthMs: number = DAY_LENGTH_MS,
): number {
  if (!Number.isFinite(worldTimeMs) || dayLengthMs <= 0) return 0;
  const t = worldTimeMs % dayLengthMs;
  return t < 0 ? t + dayLengthMs : t;
}

/** Fraction of the current day in [0, 1). */
export function dayFraction(
  worldTimeMs: number,
  dayLengthMs: number = DAY_LENGTH_MS,
): number {
  return worldTimeOfDayMs(worldTimeMs, dayLengthMs) / dayLengthMs;
}

export function phaseOfDay(
  worldTimeMs: number,
  dayLengthMs: number = DAY_LENGTH_MS,
): DayPhase {
  const t = worldTimeOfDayMs(worldTimeMs, dayLengthMs);
  if (t < DAWN_MS) return "dawn";
  if (t < DAWN_MS + DAY_MS) return "day";
  if (t < DAYLIGHT_MS) return "dusk";
  return "night";
}

export function isNightPhase(phase: DayPhase): boolean {
  return phase === "night" || phase === "dusk";
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  if (edge1 <= edge0) return x >= edge1 ? 1 : 0;
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * 0 at night, 1 at full day. Dawn/dusk ease so lighting does not pop.
 */
export function sunlightLevel(worldTimeMs: number): number {
  const t = worldTimeOfDayMs(worldTimeMs);
  if (t < DAWN_MS) return smoothstep(0, DAWN_MS, t);
  if (t < DAWN_MS + DAY_MS) return 1;
  if (t < DAYLIGHT_MS) {
    return 1 - smoothstep(DAWN_MS + DAY_MS, DAYLIGHT_MS, t);
  }
  return 0;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpChannel(a: number, b: number, t: number): number {
  return Math.round(lerp(a, b, t));
}

/** Blend two 0xRRGGBB colors. */
export function lerpRgb(a: number, b: number, t: number): number {
  const tt = Math.min(1, Math.max(0, t));
  const ar = (a >> 16) & 0xff;
  const ag = (a >> 8) & 0xff;
  const ab = a & 0xff;
  const br = (b >> 16) & 0xff;
  const bg = (b >> 8) & 0xff;
  const bb = b & 0xff;
  return (
    (lerpChannel(ar, br, tt) << 16) |
    (lerpChannel(ag, bg, tt) << 8) |
    lerpChannel(ab, bb, tt)
  );
}

const SKY_NIGHT = 0x0a101c;
const SKY_DAWN = 0xe8a06a;
const SKY_DAY = 0x8eb8d6;
const SKY_DUSK = 0xc45c32;
const SKY_DUSK_PURPLE = 0x2a1638;

/** Camera void around interior floors (no outdoor sky through the walls). */
export const INTERIOR_VOID_COLOR = SKY_NIGHT;

const AMBIENT_DAY = 0xffffff;
const AMBIENT_DAWN = 0x3a2218;
const AMBIENT_DUSK = 0x3a140c;
const AMBIENT_NIGHT = 0x0c1424;

export type DayNightLook = {
  phase: DayPhase;
  sunlight: number;
  /** 0 in full day, 1 in deep night. */
  darkness: number;
  skyColor: number;
  ambientColor: number;
  /** Multiply overlay alpha (0 = off). */
  ambientAlpha: number;
  /** Vignette strength for night visibility falloff. */
  vignetteAlpha: number;
  /** 0 when lamps should be off, 1 when fully on. */
  lampStrength: number;
  /**
   * Campfire puddles. Follows lamps at night; on overcast days a weaker
   * glow still shows (streetlamps stay off).
   */
  fireStrength: number;
  /** In-game clock "HH:MM". */
  clockLabel: string;
};

const CLOUDY_SKY = 0x6e7a88;
const FOG_SKY = 0x9aa3ae;
const RAIN_SKY = 0x5c6c7a;
const SNOW_SKY = 0xd0dce8;

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function skyColorFor(phase: DayPhase, sunlight: number, t: number): number {
  if (phase === "day") return SKY_DAY;
  if (phase === "dawn") return lerpRgb(SKY_NIGHT, SKY_DAWN, sunlight);
  if (phase === "dusk") {
    const duskT = 1 - sunlight;
    if (duskT < 0.55) return lerpRgb(SKY_DAY, SKY_DUSK, duskT / 0.55);
    return lerpRgb(SKY_DUSK, SKY_DUSK_PURPLE, (duskT - 0.55) / 0.45);
  }
  // Deep night, slight lift toward the end as dawn approaches.
  const nightT = (t - DAYLIGHT_MS) / NIGHT_MS;
  const preDawn = smoothstep(0.82, 1, nightT);
  return lerpRgb(SKY_NIGHT, SKY_DAWN, preDawn * 0.25);
}

function ambientColorFor(phase: DayPhase, sunlight: number): number {
  if (phase === "day") return AMBIENT_DAY;
  if (phase === "dawn") return lerpRgb(AMBIENT_NIGHT, AMBIENT_DAWN, sunlight);
  if (phase === "dusk") return lerpRgb(AMBIENT_DUSK, AMBIENT_NIGHT, 1 - sunlight);
  return AMBIENT_NIGHT;
}

/** Minutes since 00:00 on the in-game clock, in [0, 1440). */
export function inGameMinuteOfDay(worldTimeMs: number): number {
  const f = dayFraction(worldTimeMs);
  const wrapped = (((CYCLE_START_HOUR / 24 + f) % 1) + 1) % 1;
  return wrapped * 24 * 60;
}

/** Peak chase speed at 01:00 for a standing zombie. Daytime speed is each zombie's base. */
export const ZOMBIE_NIGHT_SPEED = 1;

const ZOMBIE_NIGHT_RAMP_START_MIN = 20 * 60;
const ZOMBIE_NIGHT_PEAK_MIN = 1 * 60;
const ZOMBIE_NIGHT_RAMP_END_MIN = 6 * 60;
const MINUTES_PER_DAY = 24 * 60;
const ZOMBIE_NIGHT_RISE_MIN =
  MINUTES_PER_DAY - ZOMBIE_NIGHT_RAMP_START_MIN + ZOMBIE_NIGHT_PEAK_MIN;
const ZOMBIE_NIGHT_FALL_MIN = ZOMBIE_NIGHT_RAMP_END_MIN - ZOMBIE_NIGHT_PEAK_MIN;

/**
 * 0 from 06:00 through 20:00. Rises linearly to 1 at 01:00, then falls
 * linearly back to 0 at 06:00.
 */
export function zombieNightRamp(worldTimeMs: number): number {
  const minutes = inGameMinuteOfDay(worldTimeMs);
  if (minutes >= ZOMBIE_NIGHT_RAMP_START_MIN) {
    return (minutes - ZOMBIE_NIGHT_RAMP_START_MIN) / ZOMBIE_NIGHT_RISE_MIN;
  }
  if (minutes <= ZOMBIE_NIGHT_PEAK_MIN) {
    return (MINUTES_PER_DAY - ZOMBIE_NIGHT_RAMP_START_MIN + minutes) /
      ZOMBIE_NIGHT_RISE_MIN;
  }
  if (minutes < ZOMBIE_NIGHT_RAMP_END_MIN) {
    return 1 - (minutes - ZOMBIE_NIGHT_PEAK_MIN) / ZOMBIE_NIGHT_FALL_MIN;
  }
  return 0;
}

/**
 * Daytime `baseSpeed` until 20:00, then up to the night peak at 01:00, base again at 06:00.
 * A slower base (crawlers) keeps the same fraction of standing speed at night.
 */
export function zombieSpeedAtTime(baseSpeed: number, worldTimeMs: number): number {
  const base = Number.isFinite(baseSpeed) ? baseSpeed : 0;
  const ramp = zombieNightRamp(worldTimeMs);
  if (ramp <= 0) return base;
  const scale = ZOMBIE_SPEED > 0 ? base / ZOMBIE_SPEED : 1;
  const peak = Math.max(base, ZOMBIE_NIGHT_SPEED * scale);
  return base + (peak - base) * ramp;
}

/** In-game clock from cycle origin (dawn = 06:00). */
export function formatInGameClock(worldTimeMs: number): string {
  const minutes = Math.floor(inGameMinuteOfDay(worldTimeMs));
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Visual parameters for the client lighting pass.
 * Interiors pass `indoor` to pin the camera void to night. At night the
 * indoor overlay is stronger than outdoors so rooms read darker than the street.
 * `alwaysLit` skips night overlay (powered interiors such as hospitals).
 * `firelitAmount` (0..1) lifts indoor night lighting by up to 20% when a
 * fireplace is burning.
 * Outdoor weather amounts (0..1) tint the sky only. Indoor cloudy still
 * drives overcast-day fire glow (the dim overlay lives on WeatherFx).
 * Cloudy dim and rain/fog particles live on the client weather pass.
 */
export function dayNightLook(
  worldTimeMs: number,
  opts?: {
    indoor?: boolean;
    alwaysLit?: boolean;
    firelitAmount?: number;
    cloudyAmount?: number;
    fogAmount?: number;
    rainAmount?: number;
    snowAmount?: number;
  },
): DayNightLook {
  const t = worldTimeOfDayMs(worldTimeMs);
  const phase = phaseOfDay(worldTimeMs);
  const sunlight = sunlightLevel(worldTimeMs);
  const alwaysLit = !!opts?.alwaysLit;
  const darkness = alwaysLit ? 0 : 1 - sunlight;
  const indoor = !!opts?.indoor;
  const cloudyAmt = clamp01(opts?.cloudyAmount ?? 0);
  const cloudy = indoor ? 0 : cloudyAmt;
  const fog = indoor ? 0 : clamp01(opts?.fogAmount ?? 0);
  const rain = indoor ? 0 : clamp01(opts?.rainAmount ?? 0);
  const snow = indoor ? 0 : clamp01(opts?.snowAmount ?? 0);
  const lampStrength = smoothstep(0.35, 0.72, darkness);
  const cloudyForFire = alwaysLit ? 0 : cloudyAmt;
  const cloudyDayFire = cloudyForFire * (1 - darkness) * CLOUDY_DAY_FIRE_STRENGTH;
  const fireStrength = Math.max(lampStrength, cloudyDayFire);
  let sky = indoor
    ? INTERIOR_VOID_COLOR
    : skyColorFor(phase, sunlight, t);
  if (!indoor) {
    sky = lerpRgb(sky, CLOUDY_SKY, cloudy * 0.55);
    sky = lerpRgb(sky, FOG_SKY, fog * 0.4);
    sky = lerpRgb(sky, RAIN_SKY, rain * 0.22);
    sky = lerpRgb(sky, SNOW_SKY, snow * 0.35);
  }
  const outdoorAmbient = ambientColorFor(phase, sunlight);
  const firelit =
    indoor && !alwaysLit ? clamp01(opts?.firelitAmount ?? 0) : 0;
  const fireLift = 1 - firelit * 0.2;
  const ambient = indoor
    ? lerpRgb(outdoorAmbient, 0x05080e, darkness * 0.55 * fireLift)
    : outdoorAmbient;
  const outdoorAlpha = darkness * 0.66;
  const indoorAlpha = darkness * 0.88 * fireLift;
  const vignette = indoor ? darkness * 0.22 * fireLift : darkness * 0.72;
  return {
    phase,
    sunlight,
    darkness,
    skyColor: sky,
    ambientColor: ambient,
    ambientAlpha: indoor ? indoorAlpha : outdoorAlpha,
    vignetteAlpha: Math.min(1, vignette),
    lampStrength,
    fireStrength,
    clockLabel: formatInGameClock(worldTimeMs),
  };
}

export function isSkyId(value: unknown): value is SkyId {
  return value === "clear" || value === "cloudy";
}

export function isPrecipId(value: unknown): value is PrecipId {
  return value === "none" || value === "rain" || value === "fog" || value === "snow";
}

/** Legacy `weather: "clear"` meant no precip. */
export function parseSky(value: unknown): SkyId {
  return value === "cloudy" ? "cloudy" : "clear";
}

export function parsePrecip(value: unknown): PrecipId {
  if (value === "rain" || value === "fog" || value === "snow") return value;
  return "none";
}

export function parseWeatherState(
  sky: unknown,
  precip: unknown,
): WeatherState {
  return { sky: parseSky(sky), precip: parsePrecip(precip) };
}

export function formatWeatherLabel(sky: SkyId, precip: PrecipId): string {
  if (precip === "none") return sky;
  return `${sky} ${precip}`;
}

export function rollWeatherDurationMs(
  precip: PrecipId,
  random: () => number = Math.random,
): number {
  const range = PRECIP_DURATION_MS[precip];
  const span = Math.max(0, range.max - range.min);
  return range.min + Math.floor(random() * (span + 1));
}

/**
 * Re-roll sky + precip together. Dry and clear are the common case.
 * Rain, fog, and snow bias the sky toward cloudy, but clear precip happens.
 */
export function rollNextWeatherState(
  current: WeatherState,
  random: () => number = Math.random,
): WeatherState {
  const pRoll = random();
  let precip: PrecipId;
  if (current.precip === "none") {
    if (pRoll < 0.65) precip = "none";
    else if (pRoll < 0.85) precip = "rain";
    else if (pRoll < 0.95) precip = "fog";
    else precip = "snow";
  } else if (current.precip === "rain") {
    if (pRoll < 0.55) precip = "none";
    else if (pRoll < 0.8) precip = "rain";
    else if (pRoll < 0.9) precip = "fog";
    else precip = "snow";
  } else if (current.precip === "fog") {
    if (pRoll < 0.5) precip = "none";
    else if (pRoll < 0.7) precip = "rain";
    else if (pRoll < 0.95) precip = "fog";
    else precip = "snow";
  } else if (pRoll < 0.5) precip = "none";
  else if (pRoll < 0.8) precip = "rain";
  else precip = "snow";

  let cloudyChance = 0.36;
  if (precip === "rain") cloudyChance = 0.7;
  else if (precip === "fog") cloudyChance = 0.58;
  else if (precip === "snow") cloudyChance = 0.66;
  if (current.sky === "cloudy") cloudyChance += 0.08;
  const sky: SkyId = random() < cloudyChance ? "cloudy" : "clear";
  return { sky, precip };
}

/** Night + cloudy. Snow never storms. */
export function lightningCanStrike(
  sky: SkyId,
  precip: PrecipId,
  night: boolean,
): boolean {
  return night && sky === "cloudy" && precip !== "snow";
}

/** Once per night+cloudy stretch. */
export const LIGHTNING_CHANCE = 0.2;
export const LIGHTNING_FIRST_MIN_MS = 8_000;
export const LIGHTNING_FIRST_MAX_MS = 22_000;
export const LIGHTNING_GAP_MIN_MS = 18_000;
export const LIGHTNING_GAP_MAX_MS = 48_000;
export const LIGHTNING_THUNDER_MIN_MS = 3_000;
export const LIGHTNING_THUNDER_MAX_MS = 10_000;

export function rollLightningMs(
  min: number,
  max: number,
  random: () => number = Math.random,
): number {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  return lo + Math.floor(random() * (hi - lo + 1));
}
