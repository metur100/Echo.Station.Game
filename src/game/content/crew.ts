import type { CrewMember } from '../engine/types';

export interface TraitDef {
  id: string;
  /** Multipliers on the work rate per task */
  repair?: number;
  research?: number;
  emergency?: number;
  prep?: number;
  /** Fatigue gain multiplier */
  fatigue?: number;
  /** Morale never drops below this */
  moraleFloor?: number;
  /** Extra health per minute to every resting crew member */
  healAura?: number;
  /** Health risk multiplier when fighting anomalies */
  anomalyRisk?: number;
  /** Expedition risk reduction */
  expeditionRisk?: number;
}

export const TRAITS: Record<string, TraitDef> = {
  steady_hands: { id: 'steady_hands', repair: 1.3 },
  stubborn: { id: 'stubborn', fatigue: 0.85, moraleFloor: 20 },
  curious: { id: 'curious', research: 1.25, anomalyRisk: 1.5 },
  night_owl: { id: 'night_owl', research: 1.1, fatigue: 0.9 },
  calm: { id: 'calm', moraleFloor: 35, emergency: 1.2 },
  pilot_instinct: { id: 'pilot_instinct', prep: 1.25, expeditionRisk: 0.08 },
  field_medic: { id: 'field_medic', healAura: 0.6, emergency: 1.1 },
  cryo_sick: { id: 'cryo_sick', fatigue: 1.15 },
};

type CrewSeed = Pick<CrewMember, 'id' | 'name' | 'role' | 'portrait' | 'skills' | 'traits'> & { health: number; morale: number; fatigue: number };

export const STARTING_CREW: CrewSeed[] = [
  {
    id: 'ines', name: 'Ines Varga', role: 'engineer', portrait: 'ines',
    skills: { engineering: 4, science: 2, piloting: 2, medicine: 1 }, traits: ['steady_hands', 'stubborn'],
    health: 80, morale: 55, fatigue: 25,
  },
  {
    id: 'tomas', name: 'Dr. Tomas Okafor', role: 'xenobiologist', portrait: 'tomas',
    skills: { engineering: 1, science: 5, piloting: 1, medicine: 3 }, traits: ['curious', 'night_owl'],
    health: 70, morale: 60, fatigue: 30,
  },
  {
    id: 'mira', name: 'Mira Sato', role: 'navigator', portrait: 'mira',
    skills: { engineering: 2, science: 2, piloting: 5, medicine: 1 }, traits: ['calm', 'pilot_instinct'],
    health: 85, morale: 50, fatigue: 20,
  },
];

/** Recovered from a drifting cryo pod in the Kessler Drift. */
export const RESCUED_CREW: CrewSeed = {
  id: 'elias', name: 'Elias Brandt', role: 'medic', portrait: 'elias',
  skills: { engineering: 2, science: 3, piloting: 1, medicine: 5 }, traits: ['field_medic', 'cryo_sick'],
  health: 40, morale: 45, fatigue: 50,
};
