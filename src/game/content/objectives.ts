import type { GameState, ModuleType, PartialResources } from '../engine/types';

export type HintScreen = 'build' | 'research' | 'crew' | 'expeditions' | 'echo' | null;

export interface ObjectiveDef {
  id: string;
  chapter: 1 | 2 | 3 | 4;
  check: (s: GameState) => boolean;
  /** Runs once when the objective becomes current */
  onStart?: (s: GameState) => void;
  hint: { screen: HintScreen; module?: ModuleType };
  reward: PartialResources & { xp: number };
}

const built = (s: GameState, type: ModuleType) => Object.values(s.modules).some((m) => m.type === type && m.buildRemaining <= 0);
const done = (s: GameState, id: string) => s.research.completed.includes(id);
const visited = (s: GameState, id: string) => (s.expeditions.completed[id] ?? 0) > 0;

/** The tutorial (chapter 1) and the campaign that follows, in order. */
export const OBJECTIVES: ObjectiveDef[] = [
  { id: 'inspect_reactor', chapter: 1, check: (s) => s.objectives.acknowledged.includes('inspect_reactor'), hint: { screen: null, module: 'reactor' }, reward: { xp: 10 } },
  {
    id: 'repair_reactor', chapter: 1,
    check: (s) => Object.values(s.modules).some((m) => m.type === 'reactor' && m.condition >= 60),
    hint: { screen: 'crew', module: 'reactor' }, reward: { xp: 30, materials: 20 },
  },
  { id: 'build_oxygen', chapter: 1, check: (s) => built(s, 'oxygen'), hint: { screen: 'build', module: 'oxygen' }, reward: { xp: 30 } },
  {
    id: 'start_research', chapter: 1,
    check: (s) => s.research.active !== null || s.research.completed.length > 0,
    hint: { screen: 'research' }, reward: { xp: 25, research: 10 },
  },
  {
    id: 'contain_bloom', chapter: 1,
    onStart: (s) => {
      s.flags.bloom_reveal = true;
    },
    check: (s) =>
      s.discoveredAnomalies.includes('bloom') &&
      s.events.active?.defId !== 'anomaly_discovery' &&
      s.anomalies.filter((a) => a.kind === 'bloom').every((a) => a.exploited || a.intensity < 20 || s.modules[a.moduleId]?.quarantined),
    hint: { screen: null, module: 'storage' }, reward: { xp: 40 },
  },
  {
    id: 'first_expedition', chapter: 1,
    onStart: (s) => {
      s.flags.hazards_on = true;
    },
    check: (s) => visited(s, 'kessler'),
    hint: { screen: 'expeditions' }, reward: { xp: 50, credits: 30 },
  },
  { id: 'research_charting', chapter: 2, check: (s) => done(s, 'nav_drift_charting'), hint: { screen: 'research' }, reward: { xp: 30 } },
  { id: 'build_radiator', chapter: 2, check: (s) => built(s, 'radiator'), hint: { screen: 'build', module: 'radiator' }, reward: { xp: 30, materials: 30 } },
  { id: 'visit_glacier', chapter: 2, check: (s) => visited(s, 'glacier'), hint: { screen: 'expeditions' }, reward: { xp: 60 } },
  { id: 'research_long_range', chapter: 3, check: (s) => done(s, 'nav_long_range'), hint: { screen: 'research' }, reward: { xp: 40 } },
  { id: 'visit_lantern', chapter: 3, check: (s) => visited(s, 'lantern'), hint: { screen: 'expeditions' }, reward: { xp: 80 } },
  { id: 'research_cartography', chapter: 3, check: (s) => done(s, 'echo_cartography'), hint: { screen: 'research' }, reward: { xp: 50 } },
  { id: 'research_ark', chapter: 4, check: (s) => done(s, 'nav_ark_coordinates'), hint: { screen: 'research' }, reward: { xp: 60 } },
  { id: 'visit_ark', chapter: 4, check: (s) => visited(s, 'ark'), hint: { screen: 'expeditions' }, reward: { xp: 150 } },
];

export const CHAPTERS = [1, 2, 3, 4] as const;
