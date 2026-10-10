import { RESEARCH, RESEARCH_BY_ID, type ResearchDef } from '../content/research';
import { grantXp, log } from '../engine/helpers';
import type { GameState } from '../engine/types';
import { crewResearchRate } from './crew';
import { resonance } from './echo';

export type ResearchStatus = 'completed' | 'active' | 'available' | 'locked';

export interface ResearchAvailability {
  status: ResearchStatus;
  /** Why it is locked (i18n keys with params) */
  missing: { key: string; params?: Record<string, string | number> }[];
  affordable: boolean;
}

export function researchAvailability(s: GameState, def: ResearchDef): ResearchAvailability {
  if (s.research.completed.includes(def.id)) return { status: 'completed', missing: [], affordable: true };
  if (s.research.active?.id === def.id) return { status: 'active', missing: [], affordable: true };
  const missing: ResearchAvailability['missing'] = [];
  for (const req of def.requires) if (!s.research.completed.includes(req)) missing.push({ key: 'research.missing.prereq', params: { id: req } });
  if (def.requiresAnomaly && !s.discoveredAnomalies.includes(def.requiresAnomaly)) missing.push({ key: 'research.missing.anomaly', params: { kind: def.requiresAnomaly } });
  if (def.requiresFlag && !s.flags[def.requiresFlag]) missing.push({ key: `research.missing.flag.${def.requiresFlag}` });
  return { status: missing.length ? 'locked' : 'available', missing, affordable: s.resources.research >= def.cost };
}

/** Seconds per second of progress: crew in labs speed projects up; Echo studies feed on resonance. */
export function researchSpeed(s: GameState): number {
  const active = s.research.active;
  let speed = 1 + 0.5 * crewResearchRate(s);
  if (active && RESEARCH_BY_ID[active.id]?.branch === 'echo') speed *= 1 + resonance(s) / 100;
  const labs = Object.values(s.modules).some((m) => m.type === 'lab' && m.online);
  return labs ? speed : 0;
}

export function updateResearch(s: GameState, dtSec: number) {
  const active = s.research.active;
  if (!active) return;
  active.progress = Math.min(active.duration, active.progress + dtSec * researchSpeed(s));
  if (active.progress >= active.duration) completeResearch(s, active.id);
}

export function completeResearch(s: GameState, id: string) {
  const def = RESEARCH_BY_ID[id];
  if (!def || s.research.completed.includes(id)) return;
  s.research.completed.push(id);
  s.research.active = null;
  s.stats.researchCompleted += 1;
  if (def.disposition) s.disposition[def.disposition] += 2;
  log(s, { severity: 'success', category: 'research', key: 'log.researchDone', params: { id } });
  grantXp(s, 20 + Math.round(def.cost / 4));
}

export const RESEARCH_COUNT = RESEARCH.length;
