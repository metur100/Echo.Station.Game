import type { GameState } from '../engine/types';

export interface AchievementDef {
  id: string;
  icon: string;
  check: (s: GameState) => boolean;
}

const count = (s: GameState, type: string) => Object.values(s.modules).filter((m) => m.type === type && m.buildRemaining <= 0).length;

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_light', icon: 'reactor', check: (s) => s.flags.reactor_restored === true },
  { id: 'deep_breath', icon: 'oxygen', check: (s) => count(s, 'oxygen') >= 1 },
  { id: 'architect', icon: 'build', check: (s) => s.stats.modulesBuilt >= 10 },
  { id: 'master_builder', icon: 'upgrade', check: (s) => Object.values(s.modules).some((m) => m.level >= 3) },
  { id: 'first_contact', icon: 'bloom', check: (s) => s.discoveredAnomalies.length >= 1 },
  { id: 'warden', icon: 'containment', check: (s) => s.stats.anomaliesContained >= 3 },
  { id: 'symbiont', icon: 'symbiosis', check: (s) => s.stats.anomaliesExploited >= 1 },
  { id: 'it_remembers', icon: 'echo', check: (s) => s.stats.echoesCreated >= 1 },
  { id: 'archivist', icon: 'archive', check: (s) => s.stats.echoesCreated >= 8 },
  { id: 'scholar', icon: 'research', check: (s) => s.research.completed.length >= 8 },
  { id: 'all_hands', icon: 'crew', check: (s) => s.crew.length >= 4 },
  { id: 'outbound', icon: 'mission', check: (s) => s.stats.expeditions >= 1 },
  { id: 'cartographer', icon: 'map', check: (s) => ['kessler', 'glacier', 'lantern'].every((d) => (s.expeditions.completed[d] ?? 0) > 0) },
  { id: 'second_chance', icon: 'recovery', check: (s) => s.stats.recoveries >= 1 },
  { id: 'homecoming', icon: 'ark', check: (s) => s.ending !== null },
];
