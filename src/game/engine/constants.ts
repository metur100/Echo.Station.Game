/**
 * Simulation time unit: one game second. All content rates are expressed per game minute and
 * converted with `dt / 60`. The engine runs at a fixed timestep of four ticks per game second.
 */
export const TICKS_PER_SECOND = 4;
export const TICK_SECONDS = 1 / TICKS_PER_SECOND;

export const SCHEMA_VERSION = 3;

export const DEFAULT_GRID = { width: 10, height: 10 };

/** Temperature model (see docs/SIMULATION.md) */
export const THERMAL = {
  /** Temperature modules drift toward with no heat source (°C) */
  ambient: -5,
  /** Fraction of the gap to ambient lost per minute */
  passiveLoss: 0.25,
  /** Fraction of the gap to each connected neighbour exchanged per minute */
  conduction: 0.05,
  /** Overheat damage per minute while above the module's max temperature */
  overheatDamage: 3,
  /** Shutdown margin above max temperature */
  shutdownMargin: 15,
} as const;

export const CREW_NEEDS = {
  oxygenPerMinute: 3,
  foodPerMinute: 1,
} as const;

export const BASE_CAPACITY = {
  power: 80,
  oxygen: 150,
  food: 80,
  water: 100,
  research: 9999,
  materials: 150,
  credits: 99999,
} as const;

/** Events are evaluated every few seconds, not every tick. */
export const EVENT_CHECK_SECONDS = 5;
/** Unanswered events resolve with their default (safe) choice after this long. */
export const EVENT_AUTO_RESOLVE_SECONDS = 60;

export const LOG_LIMIT = 160;
export const ECHO_LIMIT = 40;
export const MEMORY_LIMIT = 8;
export const ECHO_CONSEQUENCE_LIMIT = 8;

/** Offline progression bounds */
export const OFFLINE = {
  /** Maximum real time credited on return */
  maxSeconds: 4 * 60 * 60,
  /** Offline simulation runs at a coarse step */
  stepSeconds: 5,
  /** Ignore gaps shorter than this */
  minSeconds: 30,
  /** Resources and hull never fall below these fractions while offline */
  floors: { oxygen: 0.25, food: 0.2, water: 0.2, hull: 30, health: 35 },
} as const;
