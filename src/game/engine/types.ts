/**
 * Authoritative game-state types. Everything in GameState is plain JSON data so it can be cloned,
 * serialised, validated and migrated. Derived per-tick values (power allocation, flows) are stored
 * too, so the UI never has to recompute simulation rules.
 */

export type ResourceId = 'power' | 'oxygen' | 'food' | 'water' | 'research' | 'materials' | 'credits';
export const RESOURCE_IDS: readonly ResourceId[] = ['power', 'oxygen', 'food', 'water', 'research', 'materials', 'credits'];

export type ResourceMap = Record<ResourceId, number>;
export type PartialResources = Partial<Record<ResourceId, number>>;

export type ModuleType =
  | 'reactor'
  | 'oxygen'
  | 'hydroponics'
  | 'quarters'
  | 'lab'
  | 'storage'
  | 'airlock'
  | 'corridor'
  | 'workshop'
  | 'shield'
  | 'recycler'
  | 'radiator'
  | 'containment'
  | 'condenser';

export type Rotation = 0 | 1;

export type OfflineReason =
  | 'constructing'
  | 'disabled'
  | 'quarantined'
  | 'broken'
  | 'overheated'
  | 'too_cold'
  | 'disconnected'
  | 'no_power'
  | 'no_input'
  | 'overgrown';

export interface ModuleInstance {
  id: string;
  type: ModuleType;
  x: number;
  y: number;
  rotation: Rotation;
  level: number;
  /** 0–100. Below 60 efficiency drops, below 10 the module is broken. */
  condition: number;
  /** °C */
  temperature: number;
  enabled: boolean;
  /** Seconds of construction remaining. 0 = operational. */
  buildRemaining: number;
  quarantined: boolean;
  /** Hull breach on this module: vents oxygen until repaired. */
  breached: boolean;
  /** Number of damage incidents. Three or more leave a Structural Fatigue echo. */
  scars: number;
  /** True while the module stays above its shutdown temperature. Hysteresis for the overheat state. */
  overheated: boolean;
  /** Derived each tick */
  powered: boolean;
  online: boolean;
  offlineReason: OfflineReason | null;
  efficiency: number;
  /** Power drawn (+) or produced (−) this tick, per minute. Derived. */
  powerFlow: number;
}

export type CrewTask = 'rest' | 'repair' | 'research' | 'maintenance' | 'expedition_prep' | 'emergency';

export interface CrewSkills {
  engineering: number;
  science: number;
  piloting: number;
  medicine: number;
}

export interface CrewMemory {
  time: number;
  /** i18n key + params */
  key: string;
  params?: Record<string, string | number>;
  /** Permanent morale baseline shift caused by this memory. */
  morale: number;
}

export interface CrewMember {
  id: string;
  name: string;
  role: 'engineer' | 'xenobiologist' | 'navigator' | 'medic';
  portrait: string;
  skills: CrewSkills;
  traits: string[];
  health: number;
  morale: number;
  fatigue: number;
  task: CrewTask;
  /** Module id, anomaly id or destination id, depending on the task. */
  targetId: string | null;
  /** Generic progress for the current task (0–100) */
  taskProgress: number;
  /** On an expedition (not aboard). */
  away: boolean;
  incapacitated: boolean;
  memories: CrewMemory[];
  joinedAt: number;
}

export type AnomalyKind = 'bloom' | 'choir' | 'frost';

export interface AnomalyInstance {
  id: string;
  kind: AnomalyKind;
  moduleId: string;
  intensity: number;
  /** Spread pressure 0–100. At 100 the anomaly spreads to its most susceptible neighbour. */
  pressure: number;
  peak: number;
  exploited: boolean;
  createdAt: number;
  /** Reason the last tick changed its growth, for the inspector (derived). */
  growth: number;
}

export type EchoKind = 'residual_energy' | 'contamination' | 'structural' | 'resonance';

export interface EchoConsequence {
  time: number;
  key: string;
  params?: Record<string, string | number>;
}

export interface EchoTrace {
  id: string;
  kind: EchoKind;
  /** Grid cells the echo is anchored to. It outlives the module that was there. Empty = ship-wide. */
  cells: { x: number; y: number }[];
  intensity: number;
  peak: number;
  createdAt: number;
  causeKey: string;
  causeParams?: Record<string, string | number>;
  consequences: EchoConsequence[];
  /** Turned into something useful by research. */
  harnessed: boolean;
  /** Faded out; kept for the archive. */
  archived: boolean;
}

export type Severity = 'info' | 'warning' | 'critical';

export interface ActiveEvent {
  defId: string;
  /** Module / crew / anomaly id the event concerns, if any. */
  targetId: string | null;
  secondaryId: string | null;
  startedAt: number;
}

export interface LogEntry {
  id: number;
  time: number;
  severity: Severity | 'success';
  category: 'event' | 'system' | 'crew' | 'anomaly' | 'echo' | 'research' | 'expedition' | 'build' | 'story';
  key: string;
  params?: Record<string, string | number>;
}

export interface ActiveExpedition {
  destinationId: string;
  crewIds: string[];
  elapsed: number;
  duration: number;
  risk: number;
  /** Indexes of mid-expedition log beats already written */
  beats: number;
}

export interface ExpeditionState {
  /** 0–100 preparation per destination, built by crew on the expedition_prep task */
  readiness: Record<string, number>;
  active: ActiveExpedition | null;
  completed: Record<string, number>;
  lastOutcome: { destinationId: string; outcome: 'success' | 'partial' | 'failure'; time: number; rewards: PartialResources } | null;
}

export interface ResearchState {
  completed: string[];
  active: { id: string; progress: number; duration: number } | null;
}

export interface Disposition {
  containment: number;
  symbiosis: number;
  resonance: number;
}

export interface Flow {
  production: number;
  consumption: number;
}

export interface GameOverState {
  reason: 'hull_failure' | 'crew_lost';
  time: number;
}

export interface EndingState {
  id: 'clean_return' | 'garden_ship' | 'remembering';
  time: number;
}

export interface Stats {
  modulesBuilt: number;
  modulesRemoved: number;
  upgrades: number;
  repairsDone: number;
  anomaliesContained: number;
  anomaliesExploited: number;
  echoesCreated: number;
  expeditions: number;
  eventsResolved: number;
  researchCompleted: number;
  recoveries: number;
  oxygenLowSeconds: number;
  peakPower: number;
}

export interface GameState {
  schemaVersion: number;
  seed: number;
  rng: number;
  tick: number;
  /** Game seconds since the start */
  time: number;
  grid: { width: number; height: number; hull: string[] };
  modules: Record<string, ModuleInstance>;
  /** Bumps whenever modules are added, removed, rotated or upgraded. Renderers cache on it. */
  layoutVersion: number;
  nextId: number;
  resources: ResourceMap;
  capacity: ResourceMap;
  flows: Record<ResourceId, Flow>;
  hull: number;
  /** Average habitable temperature, derived. */
  temperature: number;
  power: { supply: number; demand: number; shortage: boolean };
  crew: CrewMember[];
  research: ResearchState;
  anomalies: AnomalyInstance[];
  discoveredAnomalies: AnomalyKind[];
  echoes: EchoTrace[];
  events: {
    active: ActiveEvent | null;
    cooldowns: Record<string, number>;
    counts: Record<string, number>;
    nextCheck: number;
    /** Timed effects from event choices, e.g. rationing */
    modifiers: { id: string; until: number }[];
  };
  expeditions: ExpeditionState;
  objectives: { completed: string[]; acknowledged: string[] };
  captain: { xp: number; level: number };
  achievements: Record<string, number>;
  disposition: Disposition;
  flags: Record<string, boolean>;
  /** Per-reason seconds accumulators, e.g. choir spawn pressure */
  counters: Record<string, number>;
  log: LogEntry[];
  nextLogId: number;
  stats: Stats;
  gameOver: GameOverState | null;
  ending: EndingState | null;
}

/* ---------- Commands ---------- */

export type Command =
  | { type: 'PlaceModule'; moduleType: ModuleType; x: number; y: number; rotation: Rotation }
  | { type: 'RemoveModule'; moduleId: string }
  | { type: 'UpgradeModule'; moduleId: string }
  | { type: 'ToggleModule'; moduleId: string; enabled: boolean }
  | { type: 'SetQuarantine'; moduleId: string; quarantined: boolean }
  | { type: 'AssignCrewTask'; crewId: string; task: CrewTask; targetId: string | null }
  | { type: 'StartResearch'; researchId: string }
  | { type: 'StartExpedition'; destinationId: string; crewIds: string[] }
  | { type: 'ContainAnomaly'; anomalyId: string; method: 'quarantine' | 'purge' }
  | { type: 'ExploitAnomaly'; anomalyId: string }
  | { type: 'ResolveEvent'; choiceId: string }
  | { type: 'AcknowledgeObjective'; objectiveId: string }
  | { type: 'EmergencyRecovery' };

export type CommandType = Command['type'];

export type CommandResult = { ok: true; state: GameState } | { ok: false; state: GameState; error: string; params?: Record<string, string | number> };
