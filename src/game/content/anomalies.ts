import type { AnomalyKind, EchoKind, ModuleType } from '../engine/types';

/**
 * Static description of each anomaly. The rules themselves live in systems/anomalies.ts; these
 * values are the tunable numbers and the links to research, echoes and visuals.
 */
export interface AnomalyDef {
  kind: AnomalyKind;
  /** Visual colour token and shape */
  color: 'violet' | 'cyan' | 'frost';
  shape: 'tendrils' | 'arcs' | 'crystals';
  /** Spread starts at this intensity */
  spreadThreshold: number;
  /** UI warning levels */
  warnAt: number;
  criticalAt: number;
  /** Research that lets you exploit it */
  exploitResearch: string;
  /** Research that unlocks studying it */
  studyResearch: string;
  /** Echo left behind when it dies */
  leaves: EchoKind;
  /** Purge cost */
  purgeCost: { materials: number; power: number };
  /** Modules it can never take hold in */
  immune: ModuleType[];
}

export const ANOMALIES: Record<AnomalyKind, AnomalyDef> = {
  bloom: {
    kind: 'bloom', color: 'violet', shape: 'tendrils', spreadThreshold: 50, warnAt: 40, criticalAt: 75,
    exploitResearch: 'xeno_symbiosis', studyResearch: 'xeno_bloom_taxonomy', leaves: 'contamination',
    purgeCost: { materials: 20, power: 30 }, immune: ['containment', 'radiator', 'reactor'],
  },
  choir: {
    kind: 'choir', color: 'cyan', shape: 'arcs', spreadThreshold: 50, warnAt: 40, criticalAt: 70,
    exploitResearch: 'echo_choir_tap', studyResearch: 'echo_sensing', leaves: 'residual_energy',
    purgeCost: { materials: 25, power: 0 }, immune: ['containment', 'corridor'],
  },
  frost: {
    kind: 'frost', color: 'frost', shape: 'crystals', spreadThreshold: 50, warnAt: 40, criticalAt: 75,
    exploitResearch: 'xeno_cryo_lattice', studyResearch: 'xeno_bloom_taxonomy', leaves: 'structural',
    purgeCost: { materials: 30, power: 20 }, immune: ['containment', 'reactor'],
  },
};

export const ANOMALY_KINDS = Object.keys(ANOMALIES) as AnomalyKind[];
