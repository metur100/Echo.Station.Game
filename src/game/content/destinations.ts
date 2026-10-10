import type { AnomalyKind, PartialResources } from '../engine/types';

export interface DestinationDef {
  id: string;
  chapter: number;
  /** Position on the expedition map, 0–1 */
  map: { x: number; y: number };
  requiresResearch: string[];
  requiresCompleted: string[];
  cost: PartialResources;
  /** Game seconds away */
  duration: number;
  crewMin: number;
  crewMax: number;
  baseRisk: number;
  /** Seconds of preparation work (at work rate 1) to reach full readiness */
  prepSeconds: number;
  rewards: PartialResources & { xp: number };
  repeatable: boolean;
  /** Reward factor on repeat visits */
  repeatYield: number;
  /** Anomaly brought aboard on the first return */
  introduces: AnomalyKind | null;
  /** Story flag set on first completion */
  flag: string;
  /** Hull damage on a failed run */
  failureHullDamage: number;
  accent: 'cyan' | 'teal' | 'amber' | 'violet';
  final?: boolean;
}

export const DESTINATIONS: DestinationDef[] = [
  {
    id: 'kessler', chapter: 1, map: { x: 0.24, y: 0.62 }, requiresResearch: [], requiresCompleted: [],
    cost: { food: 6, oxygen: 10 }, duration: 90, crewMin: 1, crewMax: 2, baseRisk: 0.25, prepSeconds: 40,
    rewards: { materials: 90, credits: 40, xp: 40 }, repeatable: true, repeatYield: 0.6, introduces: null,
    flag: 'kessler_done', failureHullDamage: 12, accent: 'amber',
  },
  {
    id: 'glacier', chapter: 2, map: { x: 0.46, y: 0.3 }, requiresResearch: ['nav_drift_charting'], requiresCompleted: ['kessler'],
    cost: { food: 8, oxygen: 12, power: 40 }, duration: 150, crewMin: 1, crewMax: 2, baseRisk: 0.35, prepSeconds: 60,
    rewards: { water: 120, research: 40, credits: 30, xp: 60 }, repeatable: true, repeatYield: 0.5, introduces: 'frost',
    flag: 'glacier_done', failureHullDamage: 8, accent: 'cyan',
  },
  {
    id: 'lantern', chapter: 3, map: { x: 0.7, y: 0.58 }, requiresResearch: ['nav_long_range'], requiresCompleted: ['glacier'],
    cost: { food: 10, oxygen: 14, materials: 20 }, duration: 180, crewMin: 2, crewMax: 3, baseRisk: 0.4, prepSeconds: 80,
    rewards: { research: 90, credits: 120, xp: 90 }, repeatable: true, repeatYield: 0.4, introduces: 'choir',
    flag: 'lantern_done', failureHullDamage: 10, accent: 'violet',
  },
  {
    id: 'ark', chapter: 4, map: { x: 0.86, y: 0.22 }, requiresResearch: ['nav_ark_coordinates'], requiresCompleted: ['lantern'],
    cost: { food: 16, oxygen: 20, materials: 40, power: 60 }, duration: 240, crewMin: 2, crewMax: 3, baseRisk: 0.45, prepSeconds: 100,
    rewards: { research: 150, credits: 200, xp: 200 }, repeatable: false, repeatYield: 0, introduces: null,
    flag: 'ark_done', failureHullDamage: 15, accent: 'teal', final: true,
  },
];

export const DESTINATION_BY_ID: Record<string, DestinationDef> = Object.fromEntries(DESTINATIONS.map((d) => [d.id, d]));

/** Mid-expedition log beats per destination (i18n keys `expedition.<id>.beat<N>`) */
export const EXPEDITION_BEATS = 3;
