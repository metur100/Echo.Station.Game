import type { AnomalyKind } from '../engine/types';

export type ResearchBranch = 'engineering' | 'xenobiology' | 'navigation' | 'echo';

export interface ResearchDef {
  id: string;
  branch: ResearchBranch;
  /** Column in the tree (0 = root) */
  tier: number;
  cost: number;
  /** Game seconds to integrate once started */
  seconds: number;
  requires: string[];
  /** Needs the anomaly to have been discovered */
  requiresAnomaly?: AnomalyKind;
  /** Needs a story flag */
  requiresFlag?: string;
  /** Pushes the ship toward an evolution path */
  disposition?: 'containment' | 'symbiosis' | 'resonance';
  icon: string;
}

export const RESEARCH: ResearchDef[] = [
  // Engineering
  { id: 'eng_reactor_tuning', branch: 'engineering', tier: 0, cost: 30, seconds: 40, requires: [], icon: 'reactor' },
  { id: 'eng_radiators', branch: 'engineering', tier: 1, cost: 45, seconds: 45, requires: ['eng_reactor_tuning'], icon: 'radiator' },
  { id: 'eng_modular_upgrades', branch: 'engineering', tier: 1, cost: 70, seconds: 60, requires: ['eng_reactor_tuning'], icon: 'upgrade' },
  { id: 'eng_shield_harmonics', branch: 'engineering', tier: 2, cost: 110, seconds: 75, requires: ['eng_radiators'], icon: 'shield' },
  { id: 'eng_lattice_alloys', branch: 'engineering', tier: 3, cost: 150, seconds: 90, requires: ['eng_modular_upgrades', 'echo_sensing'], disposition: 'resonance', icon: 'lattice' },

  // Xenobiology
  { id: 'xeno_bloom_taxonomy', branch: 'xenobiology', tier: 0, cost: 25, seconds: 35, requires: [], requiresAnomaly: 'bloom', icon: 'bloom' },
  { id: 'xeno_containment', branch: 'xenobiology', tier: 1, cost: 60, seconds: 55, requires: ['xeno_bloom_taxonomy'], disposition: 'containment', icon: 'containment' },
  { id: 'xeno_symbiosis', branch: 'xenobiology', tier: 1, cost: 70, seconds: 60, requires: ['xeno_bloom_taxonomy'], disposition: 'symbiosis', icon: 'symbiosis' },
  { id: 'xeno_sterilization', branch: 'xenobiology', tier: 2, cost: 90, seconds: 70, requires: ['xeno_containment'], disposition: 'containment', icon: 'sterile' },
  { id: 'xeno_cryo_lattice', branch: 'xenobiology', tier: 2, cost: 100, seconds: 70, requires: ['xeno_bloom_taxonomy'], requiresAnomaly: 'frost', disposition: 'symbiosis', icon: 'frost' },

  // Navigation
  { id: 'nav_drift_charting', branch: 'navigation', tier: 0, cost: 35, seconds: 40, requires: [], icon: 'chart' },
  { id: 'nav_efficient_burns', branch: 'navigation', tier: 1, cost: 60, seconds: 55, requires: ['nav_drift_charting'], icon: 'burn' },
  { id: 'nav_long_range', branch: 'navigation', tier: 1, cost: 80, seconds: 60, requires: ['nav_drift_charting'], requiresFlag: 'glacier_done', icon: 'scanner' },
  { id: 'nav_ark_coordinates', branch: 'navigation', tier: 2, cost: 160, seconds: 90, requires: ['nav_long_range', 'echo_cartography'], requiresFlag: 'lantern_done', icon: 'ark' },

  // Echo studies
  { id: 'echo_sensing', branch: 'echo', tier: 0, cost: 30, seconds: 35, requires: [], requiresFlag: 'first_echo', icon: 'echo' },
  { id: 'echo_condenser', branch: 'echo', tier: 1, cost: 75, seconds: 60, requires: ['echo_sensing'], disposition: 'resonance', icon: 'condenser' },
  { id: 'echo_choir_tap', branch: 'echo', tier: 2, cost: 100, seconds: 70, requires: ['echo_condenser'], requiresAnomaly: 'choir', disposition: 'resonance', icon: 'choir' },
  { id: 'echo_cartography', branch: 'echo', tier: 2, cost: 120, seconds: 80, requires: ['echo_sensing'], requiresFlag: 'lantern_done', icon: 'map' },
];

export const RESEARCH_BY_ID: Record<string, ResearchDef> = Object.fromEntries(RESEARCH.map((r) => [r.id, r]));
export const RESEARCH_BRANCHES: ResearchBranch[] = ['engineering', 'xenobiology', 'navigation', 'echo'];

/** Numeric effects, read by the systems. Keeping them here documents what each unlock does. */
export const RESEARCH_EFFECTS = {
  reactorOutput: 0.2, // eng_reactor_tuning
  emergencyContainment: 0.5, // xeno_bloom_taxonomy
  expeditionRisk: 0.08, // nav_drift_charting
  burnCost: 0.3, // nav_efficient_burns: costs −30 %
  burnDuration: 0.25, // nav_efficient_burns: duration −25 %
  latticeRegen: 0.01, // eng_lattice_alloys: condition per structural intensity per minute
  sterileDecay: 3, // xeno_sterilization: contamination decays 3× faster
} as const;
