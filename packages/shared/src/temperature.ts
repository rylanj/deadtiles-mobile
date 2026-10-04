import type { SkyId, PrecipId } from "./worldClock.js";
import { parsePrecip, parseSky, sunlightLevel } from "./worldClock.js";
import {
  HUNGER_MAX,
  STARVATION_DAMAGE_INTERVAL_SEC,
  THIRST_MAX,
} from "./constants.js";
import { clothingInsulation, getEntryWetness, isClothingItem, setEntryWetness } from "./items.js";
import type { Inventory } from "./items.js";
import { getBuildingAt, type BuildingType } from "./worldgen.js";
import { isBirchportHospital } from "./birchport.js";
import { isBirchportBarracksMessHall } from "./birchportBarracks.js";

/** Core body temperature at spawn / respawn (°C). */
export const TEMPERATURE_CORE_DEFAULT = 37;
export const TEMPERATURE_CORE_MIN = 32;
export const TEMPERATURE_CORE_MAX = 41;

/**
 * Naked resting cold stress begins below this air temperature (°C).
 * Clothing warmth is added before the compare, so a t-shirt stays neutral
 * in cooler air than bare skin.
 */
export const TEMPERATURE_COMFORT_AIR_C = 18;
export const TEMPERATURE_COMFORT_LOW = 36.2;
/** Core above this is Hot. A sprint in mild air plateaus at or below it. */
export const TEMPERATURE_COMFORT_HIGH = 38;
export const TEMPERATURE_HYPOTHERMIA = 35;
/** Core above this is heatstroke and deals damage. */
export const TEMPERATURE_HEATSTROKE = 39;

/** Cold-side slope: core °C lost per degree of exposure below comfort. */
export const TEMPERATURE_EXPOSURE_TO_CORE = 0.14;
/** Chase rate of core toward the resting target (1/s). About a 10 minute time constant. */
export const TEMPERATURE_CHASE_RATE = 0.0016;
/** Cold-side clothing warmth per insulation point (dry tee = 1), °C of exposure. */
export const TEMPERATURE_INSULATION_C = 4;
/** Extra cold-side exposure when worn clothes are fully soaked (°C). */
export const TEMPERATURE_WET_PENALTY_C = 4;
/** Fraction of insulation lost when clothes are fully soaked. */
export const TEMPERATURE_WET_INSULATION_LOSS = 0.75;
/** Lit fireplace adjacent bonus at full strength (°C). */
export const TEMPERATURE_FIRE_BONUS_C = 12;
/** Full fire heat on the hearth and neighbouring tiles. */
export const FIREPLACE_AIR_FULL_TILES = 1;
/** Indoor Euclidean tiles where fire air heat reaches 0. */
export const FIREPLACE_AIR_RANGE_INDOOR = 10;
/** Outdoor Euclidean tiles where fire air heat reaches 0. */
export const FIREPLACE_AIR_RANGE_OUTDOOR = 5;
/** Skin temperature used when a sprint dumps heat to the air (°C). */
export const TEMPERATURE_SKIN_C = 33;
/** Naked rest starts storing heat above this air temperature (°C). */
export const TEMPERATURE_HEAT_ONSET_NAKED_C = 24;
/** Each insulation point lowers the air temperature where resting heat begins. */
export const TEMPERATURE_HEAT_ONSET_PER_INSULATION = 3;
/** Degrees above heat onset that use the shallow resting-heat slope. */
export const TEMPERATURE_HEAT_MILD_SPAN_C = 8;
/** Resting core °C gained per degree of air in the shallow heat band. */
export const TEMPERATURE_HEAT_MILD_SLOPE = 0.04;
/** Resting core °C gained per degree of air past the shallow heat band. */
export const TEMPERATURE_HEAT_HARD_SLOPE = 0.12;
/** Core offset a sprint would reach if the body could not cool (°C). */
export const TEMPERATURE_SPRINT_LOAD_C = 1.8;
/** Sweat cooling available during a sprint, before air and clothing (°C). */
export const TEMPERATURE_SPRINT_COOL_SWEAT_C = 0.55;
/** Extra sprint cooling per degree of air below skin temperature. */
export const TEMPERATURE_SPRINT_COOL_PER_AIR_C = 0.06;
/** Sprint heat gained per degree of air above skin temperature. */
export const TEMPERATURE_SPRINT_HEAT_PER_AIR_C = 0.1;
/** Sprint cooling lost per point of effective insulation. */
export const TEMPERATURE_SPRINT_INSULATION_PENALTY_C = 0.22;
/** Sprint cooling lost at full humidity. Rain, fog, snow, and cloud scale this. */
export const TEMPERATURE_SPRINT_HUMIDITY_PENALTY_C = 0.45;
/** How fast unmet sprint heat is stored (°C/s). */
export const TEMPERATURE_EXERTION_RISE_PER_SEC = 0.01;
/** How fast sprint heat sheds once core is above the resting target (°C/s). */
export const TEMPERATURE_EXERTION_SHED_PER_SEC = 0.008;
export const TEMPERATURE_FEVER_MAX_C = 1.4;
export const TEMPERATURE_DAMAGE_PER_SEC = 1;
export const TEMPERATURE_DAMAGE_INTERVAL_SEC = STARVATION_DAMAGE_INTERVAL_SEC;
export const TEMPERATURE_COLD_HUNGER_EXTRA_PER_SEC = 0.3 / 60;
export const TEMPERATURE_HOT_THIRST_EXTRA_PER_SEC = 0.4 / 60;

export const CLOTHING_WET_RAIN_PER_SEC = 1 / 180;
export const CLOTHING_WET_SNOW_PER_SEC = 1 / 360;
export const CLOTHING_WET_FOG_PER_SEC = 1 / 480;
export const CLOTHING_WET_FOG_MAX = 0.35;
export const CLOTHING_DRY_FIRE_PER_SEC = 1 / 50;
export const CLOTHING_DRY_INDOOR_PER_SEC = 1 / 180;
export const CLOTHING_DRY_OUTDOOR_PER_SEC = 1 / 600;
/**
 * Wetness step that counts as a display change, i.e. the step at which soak is
 * written back into the bag json (a broadcast schema field) and pushed to
 * clients. The UI shows soak as a ~30 px bar, so 5% is a 1.5 px move: finer
 * steps only bought extra serialisation and network traffic while it rains.
 * Temperature itself uses the continuous server-side value, not this.
 */
export const CLOTHING_WETNESS_WRITE_STEP = 0.05;

const DAY_AIR_C = 18;
const NIGHT_AIR_C = 5;
const CLOUDY_AIR_DELTA = -2;
const RAIN_AIR_DELTA = -6;
const SNOW_AIR_DELTA = -11;
const FOG_AIR_DELTA = -3;
const HUMIDITY_RAIN = 0.85;
const HUMIDITY_FOG = 0.5;
const HUMIDITY_SNOW = 0.2;
const HUMIDITY_CLOUDY = 0.1;

export type TemperatureBand =
  | "hypothermia"
  | "cold"
  | "comfort"
  | "warm"
  | "heatstroke";

export type IndoorShelter = {
  floorC: number;
  leak: number;
};

/** Exterior tiles (4×4 house). Smaller footprints clamp to this leak. */
export const INDOOR_LEAK_AREA_SMALL = 16;
/** Exterior tiles (12×12 hospital / warehouse). Larger footprints clamp here. */
export const INDOOR_LEAK_AREA_LARGE = 144;
export const INDOOR_LEAK_MIN = 0.1;
export const INDOOR_LEAK_MAX = 0.42;
/** HVAC / lights on: much less outdoor bleed. Size ranking still holds. */
export const INDOOR_POWERED_LEAK_MULT = 0.4;
/** Canvas walls. Same footprint as a small house, but far draftier. */
export const INDOOR_TENT_LEAK_MULT = 2.2;

export function clampTemperature(value: number): number {
  if (!Number.isFinite(value)) return TEMPERATURE_CORE_DEFAULT;
  return Math.max(
    TEMPERATURE_CORE_MIN,
    Math.min(TEMPERATURE_CORE_MAX, value),
  );
}

export function temperatureBand(temp: number): TemperatureBand {
  const t = clampTemperature(temp);
  if (t < TEMPERATURE_HYPOTHERMIA) return "hypothermia";
  if (t < TEMPERATURE_COMFORT_LOW) return "cold";
  if (t > TEMPERATURE_HEATSTROKE) return "heatstroke";
  if (t > TEMPERATURE_COMFORT_HIGH) return "warm";
  return "comfort";
}

/** Slight core shift from food/drink at hypothermia / heatstroke (°C). */
export const CONSUME_EXTREME_TEMP_DELTA = 0.2;

/**
 * Food warms only while freezing. Drinks cool only while overheating,
 * and never below the comfort band. Consumption never cools otherwise.
 */
export function applyConsumeCoreTemperature(
  current: number,
  kind: "food" | "drink",
): number {
  const core = clampTemperature(current);
  const band = temperatureBand(core);
  if (kind === "food") {
    if (band !== "hypothermia") return core;
    return clampTemperature(
      Math.min(core + CONSUME_EXTREME_TEMP_DELTA, TEMPERATURE_COMFORT_LOW),
    );
  }
  if (band !== "heatstroke") return core;
  return clampTemperature(
    Math.max(core - CONSUME_EXTREME_TEMP_DELTA, TEMPERATURE_COMFORT_HIGH),
  );
}

/** Birchport hospital and barracks hall: lights and HVAC stay on. */
export function buildingInteriorIsPowered(bx: number, by: number): boolean {
  return isBirchportHospital(bx, by) || isBirchportBarracksMessHall(bx, by);
}

export function indoorFloorCForBuilding(
  buildingType: BuildingType | string | undefined,
): number {
  switch (buildingType) {
    case "hospital":
      return 19;
    case "mess_hall":
      return 17;
    case "tent":
      return 11;
    case "warehouse":
    case "supermarket":
    case "large_retail":
      return 13;
    case "house":
    case "apartment":
    case "motel":
    case "diner":
    case "office":
    case "police_station":
    case "gun_shop":
      return 16;
    default:
      return 15;
  }
}

/** Bigger footprint leaks more. Powered buildings cut that leak. */
export function indoorLeakForBuilding(opts: {
  buildingType?: BuildingType | string;
  width: number;
  height: number;
  powered: boolean;
}): number {
  const w = Math.max(1, opts.width);
  const h = Math.max(1, opts.height);
  const area = w * h;
  const small = Math.sqrt(INDOOR_LEAK_AREA_SMALL);
  const large = Math.sqrt(INDOOR_LEAK_AREA_LARGE);
  const t = Math.max(
    0,
    Math.min(1, (Math.sqrt(area) - small) / Math.max(0.001, large - small)),
  );
  let leak = INDOOR_LEAK_MIN + t * (INDOOR_LEAK_MAX - INDOOR_LEAK_MIN);
  if (opts.buildingType === "tent") leak *= INDOOR_TENT_LEAK_MULT;
  if (opts.powered) leak *= INDOOR_POWERED_LEAK_MULT;
  return Math.max(0.03, Math.min(0.7, leak));
}

export function indoorShelterForBuilding(opts: {
  buildingType?: BuildingType | string;
  width: number;
  height: number;
  powered: boolean;
}): IndoorShelter {
  return {
    floorC: indoorFloorCForBuilding(opts.buildingType),
    leak: indoorLeakForBuilding(opts),
  };
}

export function indoorShelterAt(bx: number, by: number): IndoorShelter {
  const bld = getBuildingAt(bx, by);
  return indoorShelterForBuilding({
    buildingType: bld?.buildingType,
    width: bld?.w ?? 4,
    height: bld?.h ?? 4,
    powered: buildingInteriorIsPowered(bx, by),
  });
}

export function fireplaceAirRangeTiles(indoor: boolean): number {
  return indoor ? FIREPLACE_AIR_RANGE_INDOOR : FIREPLACE_AIR_RANGE_OUTDOOR;
}

/**
 * Linear fire-air strength. Distance ≤ 1 is hottest; indoor hits 0 at 10
 * tiles, outdoor at 5.
 */
export function fireplaceAirHeatFromDistance(
  dist: number,
  indoor: boolean,
): number {
  if (!Number.isFinite(dist) || dist < 0) return 0;
  const maxRange = fireplaceAirRangeTiles(indoor);
  if (dist >= maxRange) return 0;
  if (dist <= FIREPLACE_AIR_FULL_TILES) return 1;
  const span = maxRange - FIREPLACE_AIR_FULL_TILES;
  if (!(span > 0)) return 0;
  return Math.max(0, Math.min(1, 1 - (dist - FIREPLACE_AIR_FULL_TILES) / span));
}

/** Neighbours (including diagonals) are full heat; farther tiles fall off by range. */
export function fireplaceAirHeatFromOffset(
  dx: number,
  dy: number,
  indoor: boolean,
): number {
  if (
    Math.max(Math.abs(dx), Math.abs(dy)) <= FIREPLACE_AIR_FULL_TILES
  ) {
    return 1;
  }
  return fireplaceAirHeatFromDistance(Math.hypot(dx, dy), indoor);
}

export function outdoorAirTemperatureC(
  worldTimeMs: number,
  sky: SkyId,
  precip: PrecipId,
): number {
  const sun = sunlightLevel(worldTimeMs);
  let air = NIGHT_AIR_C + (DAY_AIR_C - NIGHT_AIR_C) * sun;
  if (sky === "cloudy") air += CLOUDY_AIR_DELTA;
  if (precip === "rain") air += RAIN_AIR_DELTA;
  else if (precip === "snow") air += SNOW_AIR_DELTA;
  else if (precip === "fog") air += FOG_AIR_DELTA;
  return air;
}

/**
 * Outdoor or room air, plus nearby fire. Clothing does not change this.
 * The clock shows it as Air.
 */
export function ambientAirTemperatureC(opts: {
  worldTimeMs: number;
  sky: SkyId | string;
  precip: PrecipId | string;
  indoor: boolean;
  buildingX?: number;
  buildingY?: number;
  fireHeat?: number;
}): number {
  const sky = parseSky(opts.sky);
  const precip = parsePrecip(opts.precip);
  const outdoor = outdoorAirTemperatureC(opts.worldTimeMs, sky, precip);
  let air = outdoor;
  if (opts.indoor) {
    const shelter = indoorShelterAt(opts.buildingX ?? 0, opts.buildingY ?? 0);
    air = shelter.floorC + (outdoor - shelter.floorC) * shelter.leak;
  }
  const fireHeat = Math.max(0, Math.min(1, opts.fireHeat ?? 0));
  if (fireHeat > 0) air += TEMPERATURE_FIRE_BONUS_C * fireHeat;
  return air;
}

/**
 * Humidity from 0 to 1. It blocks sweat. Indoor air is treated as dry. Precip wins
 * over a cloudy sky.
 */
export function ambientHumidity(opts: {
  sky: SkyId | string;
  precip: PrecipId | string;
  indoor: boolean;
}): number {
  if (opts.indoor) return 0;
  const precip = parsePrecip(opts.precip);
  if (precip === "rain") return HUMIDITY_RAIN;
  if (precip === "fog") return HUMIDITY_FOG;
  if (precip === "snow") return HUMIDITY_SNOW;
  if (parseSky(opts.sky) === "cloudy") return HUMIDITY_CLOUDY;
  return 0;
}

export function tickClothingWetness(
  wetness: number,
  dt: number,
  env: { precip: PrecipId; indoor: boolean; nearFire: boolean },
): number {
  if (!(dt > 0)) return Math.max(0, Math.min(1, wetness));
  let next = Math.max(0, Math.min(1, wetness));
  // Fire always dries. A shirt on the hearth should not keep soaking in rain.
  if (env.nearFire) {
    next -= CLOTHING_DRY_FIRE_PER_SEC * dt;
  } else if (!env.indoor && env.precip === "rain") {
    next += CLOTHING_WET_RAIN_PER_SEC * dt;
  } else if (!env.indoor && env.precip === "snow") {
    next += CLOTHING_WET_SNOW_PER_SEC * dt;
  } else if (!env.indoor && env.precip === "fog") {
    if (next < CLOTHING_WET_FOG_MAX) {
      next = Math.min(
        CLOTHING_WET_FOG_MAX,
        next + CLOTHING_WET_FOG_PER_SEC * dt,
      );
    } else {
      next -= CLOTHING_DRY_OUTDOOR_PER_SEC * dt;
    }
  } else if (env.indoor) {
    next -= CLOTHING_DRY_INDOOR_PER_SEC * dt;
  } else {
    next -= CLOTHING_DRY_OUTDOOR_PER_SEC * dt;
  }
  if (next < 0.0005) return 0;
  return Math.max(0, Math.min(1, next));
}

/** Dry (or soak) clothing sitting in a bag / loot grid. */
export function tickInventoryClothingWetness(
  inventory: Inventory,
  dt: number,
  env: { precip: PrecipId; indoor: boolean; nearFire: boolean },
): { persist: boolean; notify: boolean } {
  let persist = false;
  let notify = false;
  for (const slot of inventory) {
    if (!slot || !isClothingItem(slot.id)) continue;
    const before = getEntryWetness(slot);
    if (before <= 0) continue;
    const next = tickClothingWetness(before, dt, env);
    if (Math.abs(next - before) < 1e-8) continue;
    setEntryWetness(slot, next);
    persist = true;
    if (wetnessDisplayChanged(before, next)) notify = true;
  }
  return { persist, notify };
}

export function wetnessDisplayChanged(before: number, after: number): boolean {
  const from = Math.max(0, Math.min(1, before));
  const to = Math.max(0, Math.min(1, after));
  if ((from > 0) !== (to > 0)) return true;
  const a = Math.round(from / CLOTHING_WETNESS_WRITE_STEP);
  const b = Math.round(to / CLOTHING_WETNESS_WRITE_STEP);
  return a !== b;
}

export function wornClothingStats(inventory: Inventory, equippedSlot: number): {
  insulation: number;
  wetness: number;
} {
  if (equippedSlot < 0) return { insulation: 0, wetness: 0 };
  const slot = inventory[equippedSlot];
  if (!slot || !isClothingItem(slot.id)) return { insulation: 0, wetness: 0 };
  return {
    insulation: clothingInsulation(slot.id),
    wetness: getEntryWetness(slot),
  };
}

function wetFraction(wetness: number): number {
  if (!Number.isFinite(wetness)) return 0;
  return Math.max(0, Math.min(1, wetness));
}

/** Insulation after soak. A soaked garment keeps 25% of its dry value. */
export function effectiveClothingInsulation(
  insulation: number,
  wetness: number,
): number {
  const ins = Number.isFinite(insulation) ? Math.max(0, insulation) : 0;
  return ins * (1 - TEMPERATURE_WET_INSULATION_LOSS * wetFraction(wetness));
}

/** Exposure offset from clothes. Positive is warmer, wet clothes go negative. */
function clothingColdOffsetC(insulation: number, wetness: number): number {
  const wet = wetFraction(wetness);
  return (
    effectiveClothingInsulation(insulation, wet) * TEMPERATURE_INSULATION_C -
    wet * TEMPERATURE_WET_PENALTY_C
  );
}

/**
 * Core drop from cold air. Zero when clothes and air are at or above the
 * naked comfort point, so mild weather does not use this slope.
 */
export function restingColdDeltaC(
  airC: number,
  insulation: number,
  wetness: number,
): number {
  const exposure =
    airC + clothingColdOffsetC(insulation, wetness) - TEMPERATURE_COMFORT_AIR_C;
  if (!(exposure < 0)) return 0;
  return exposure * TEMPERATURE_EXPOSURE_TO_CORE;
}

/**
 * Core rise from air that is too warm to dump resting heat. Shallow at first,
 * then steeper. A t-shirt in 18°C air is below onset, so this stays zero.
 */
export function restingHeatDeltaC(
  airC: number,
  insulation: number,
  wetness: number,
): number {
  const onset =
    TEMPERATURE_HEAT_ONSET_NAKED_C -
    effectiveClothingInsulation(insulation, wetness) *
      TEMPERATURE_HEAT_ONSET_PER_INSULATION;
  const gap = Math.max(0, airC - onset);
  if (gap <= TEMPERATURE_HEAT_MILD_SPAN_C) {
    return gap * TEMPERATURE_HEAT_MILD_SLOPE;
  }
  return (
    TEMPERATURE_HEAT_MILD_SPAN_C * TEMPERATURE_HEAT_MILD_SLOPE +
    (gap - TEMPERATURE_HEAT_MILD_SPAN_C) * TEMPERATURE_HEAT_HARD_SLOPE
  );
}

export function targetCoreTemperatureC(opts: {
  airC: number;
  insulation: number;
  wornWetness: number;
  infection: number;
}): number {
  const cold = restingColdDeltaC(opts.airC, opts.insulation, opts.wornWetness);
  const heat = restingHeatDeltaC(opts.airC, opts.insulation, opts.wornWetness);
  const fever =
    (Math.max(0, Math.min(100, opts.infection)) / 100) * TEMPERATURE_FEVER_MAX_C;
  return clampTemperature(TEMPERATURE_CORE_DEFAULT + cold + heat + fever);
}

/** Core °C of sprint heat the air, clothes, and humidity cannot remove. */
export function sprintUnmetHeatC(opts: {
  airC: number;
  insulation: number;
  wornWetness: number;
  humidity: number;
}): number {
  const air = Number.isFinite(opts.airC) ? opts.airC : TEMPERATURE_COMFORT_AIR_C;
  const ins = effectiveClothingInsulation(opts.insulation, opts.wornWetness);
  const humidity = Math.max(0, Math.min(1, opts.humidity));
  const convection =
    air < TEMPERATURE_SKIN_C
      ? (TEMPERATURE_SKIN_C - air) * TEMPERATURE_SPRINT_COOL_PER_AIR_C
      : -(air - TEMPERATURE_SKIN_C) * TEMPERATURE_SPRINT_HEAT_PER_AIR_C;
  const cooling =
    TEMPERATURE_SPRINT_COOL_SWEAT_C +
    convection -
    ins * TEMPERATURE_SPRINT_INSULATION_PENALTY_C -
    humidity * TEMPERATURE_SPRINT_HUMIDITY_PENALTY_C;
  return Math.max(0, TEMPERATURE_SPRINT_LOAD_C - cooling);
}

/**
 * Highest core a sprint may hold.
 * Cold air with enough cooling warms you toward 37 and stops there.
 * Unmet heat (heavy clothes, hot air, humidity) can push past that.
 */
export function sprintHeatCapC(opts: {
  airC: number;
  insulation: number;
  wornWetness: number;
  humidity: number;
  infection?: number;
}): number {
  const resting = targetCoreTemperatureC({
    airC: opts.airC,
    insulation: opts.insulation,
    wornWetness: opts.wornWetness,
    infection: opts.infection ?? 0,
  });
  const unmet = sprintUnmetHeatC(opts);
  const coldWarmup =
    resting < TEMPERATURE_CORE_DEFAULT ? TEMPERATURE_CORE_DEFAULT : resting;
  return clampTemperature(Math.max(coldWarmup, resting + unmet));
}

export function temperatureStaminaMultipliers(temp: number): {
  drain: number;
  regen: number;
} {
  const band = temperatureBand(temp);
  if (band === "hypothermia" || band === "cold") {
    return { drain: 1, regen: 0.6 };
  }
  if (band === "heatstroke") return { drain: 1.35, regen: 0.85 };
  if (band === "warm") return { drain: 1.2, regen: 1 };
  return { drain: 1, regen: 1 };
}

export function temperatureHudPercent(temp: number): number {
  const t = clampTemperature(temp);
  const span = TEMPERATURE_CORE_MAX - TEMPERATURE_CORE_MIN;
  if (span <= 0) return 50;
  return Math.max(0, Math.min(100, ((t - TEMPERATURE_CORE_MIN) / span) * 100));
}

export function temperatureHudLook(temp: number): {
  percent: number;
  fillColor: string;
  label: string;
  critical: boolean;
  fx: "none" | "cold" | "hot";
} {
  const band = temperatureBand(temp);
  const percent = temperatureHudPercent(temp);
  if (band === "hypothermia") {
    return {
      percent,
      fillColor: "#3a7aad",
      label: "Freezing",
      critical: true,
      fx: "cold",
    };
  }
  if (band === "cold") {
    return {
      percent,
      fillColor: "#4a8ab8",
      label: "Cold",
      critical: false,
      fx: "cold",
    };
  }
  if (band === "heatstroke") {
    return {
      percent,
      fillColor: "#c04a18",
      label: "Overheating",
      critical: true,
      fx: "hot",
    };
  }
  if (band === "warm") {
    return {
      percent,
      fillColor: "#b45a20",
      label: "Hot",
      critical: false,
      fx: "hot",
    };
  }
  return {
    percent,
    fillColor: "#5a7a52",
    label: "Temp",
    critical: false,
    fx: "none",
  };
}

type TemperatureAcc = {
  hunger: number;
  thirst: number;
  damageTimer: number;
  /** Slow weather-driven core, without the current sprint's stored heat. */
  env: number;
  /** Heat stored by sprinting. Sheds quickly once core is above the resting target. */
  exertion: number;
};

const temperatureAcc = new Map<string, TemperatureAcc>();

function displayedCore(acc: TemperatureAcc): number {
  return clampTemperature(acc.env + acc.exertion);
}

export function clearTemperatureTick(playerId: string): void {
  temperatureAcc.delete(playerId);
}

export function syncTemperatureCore(playerId: string, value: number): void {
  const acc = temperatureAcc.get(playerId);
  if (!acc) return;
  const next = clampTemperature(value);
  acc.env = clampTemperature(next - acc.exertion);
}

export type TemperatureVitalState = {
  temperature: number;
  hunger: number;
  thirst: number;
  health: number;
  alive: boolean;
  anim: string;
};

export type TemperatureTickResult = {
  temperature: number;
  hunger: number;
  thirst: number;
  health: number;
  died: boolean;
};

/**
 * Drift resting core toward the air. Sprint heat is stored separately and
 * only up to what cooling cannot dump, so mild air does not cook a runner.
 * Applies light hunger / thirst extras and hypothermia / heatstroke damage.
 */
export function tickCoreTemperature(
  playerId: string,
  state: TemperatureVitalState,
  dt: number,
  opts: {
    airC: number;
    insulation: number;
    wornWetness: number;
    humidity: number;
    sprinting: boolean;
    infection: number;
    skipDamage: boolean;
    healthFloor: number;
  },
): TemperatureTickResult {
  let acc = temperatureAcc.get(playerId);
  if (!acc) {
    acc = {
      hunger: 0,
      thirst: 0,
      damageTimer: 0,
      env: clampTemperature(state.temperature),
      exertion: 0,
    };
    temperatureAcc.set(playerId, acc);
  }

  const balance = {
    airC: opts.airC,
    insulation: opts.insulation,
    wornWetness: opts.wornWetness,
    infection: opts.infection,
  };
  const resting = targetCoreTemperatureC(balance);
  let rate = TEMPERATURE_CHASE_RATE;
  if (state.hunger <= 0 && resting < acc.env) rate *= 1.3;
  if (state.thirst <= 0 && resting > acc.env) rate *= 1.3;
  const dtSec = Math.max(0, dt);
  acc.env += (resting - acc.env) * rate * dtSec;
  acc.env = clampTemperature(acc.env);

  if (opts.sprinting) {
    const cap = sprintHeatCapC({
      airC: opts.airC,
      insulation: opts.insulation,
      wornWetness: opts.wornWetness,
      humidity: opts.humidity,
      infection: opts.infection,
    });
    const want = Math.max(0, cap - acc.env);
    if (acc.exertion < want) {
      acc.exertion = Math.min(
        want,
        acc.exertion + TEMPERATURE_EXERTION_RISE_PER_SEC * dtSec,
      );
    } else if (acc.exertion > want) {
      acc.exertion = Math.max(
        want,
        acc.exertion - TEMPERATURE_EXERTION_SHED_PER_SEC * dtSec,
      );
    }
  } else if (acc.exertion > 0) {
    const extra = acc.env + acc.exertion - resting;
    if (extra > 0) {
      acc.exertion = Math.max(
        0,
        acc.exertion - Math.min(extra, TEMPERATURE_EXERTION_SHED_PER_SEC * dtSec),
      );
    }
  }
  if (acc.exertion < 1e-6) acc.exertion = 0;

  const shown = Math.round(displayedCore(acc) * 10) / 10;
  const band = temperatureBand(shown);
  let hunger = state.hunger;
  let thirst = state.thirst;
  if (band === "cold" || band === "hypothermia") {
    acc.hunger += TEMPERATURE_COLD_HUNGER_EXTRA_PER_SEC * dt;
    if (acc.hunger >= 0.1) {
      const steps = Math.floor(acc.hunger * 10) / 10;
      acc.hunger -= steps;
      hunger = Math.max(0, Math.min(HUNGER_MAX, Math.round((hunger - steps) * 10) / 10));
    }
  }
  if (band === "warm" || band === "heatstroke") {
    acc.thirst += TEMPERATURE_HOT_THIRST_EXTRA_PER_SEC * dt;
    if (acc.thirst >= 0.1) {
      const steps = Math.floor(acc.thirst * 10) / 10;
      acc.thirst -= steps;
      thirst = Math.max(0, Math.min(THIRST_MAX, Math.round((thirst - steps) * 10) / 10));
    }
  }

  let health = state.health;
  let died = false;
  const extreme = band === "hypothermia" || band === "heatstroke";
  if (opts.skipDamage || !extreme) {
    acc.damageTimer = 0;
  } else {
    acc.damageTimer += dt;
    if (acc.damageTimer >= TEMPERATURE_DAMAGE_INTERVAL_SEC) {
      acc.damageTimer -= TEMPERATURE_DAMAGE_INTERVAL_SEC;
      const damage =
        TEMPERATURE_DAMAGE_PER_SEC * TEMPERATURE_DAMAGE_INTERVAL_SEC;
      const floor = Math.max(0, opts.healthFloor);
      health = Math.max(floor, Math.round((health - damage) * 10) / 10);
      if (health <= 0) died = true;
    }
  }

  return {
    temperature: shown,
    hunger,
    thirst,
    health,
    died,
  };
}
