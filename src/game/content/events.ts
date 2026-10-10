/**
 * Data-driven incidents. Each definition has a trigger that reads the real game state, a
 * severity, a cooldown, optional occurrence limits, and choices with explicit effects.
 * Choices can be unavailable (requires → reason key). `major` choices are remembered by the
 * ship as a Resonance echo.
 *
 * Text lives in i18n under `event.<id>.title|body` and `event.<id>.<choiceId>|<choiceId>Desc`.
 */
import { ANOMALIES } from './anomalies';
import { MODULES } from './modules';
import { isHullEdge, moduleCells } from '../engine/grid';
import { addModifier, addResource, clamp, crewById, hasResearch, log, spend, tidy } from '../engine/helpers';
import { random } from '../engine/rng';
import type { ActiveEvent, CrewMember, GameState, ModuleInstance, Severity } from '../engine/types';
import { addScar, breachModule, damageHull } from '../systems/condition';
import { remember } from '../systems/crew';
import { createEcho } from '../systems/echo';
import { removeAnomaly } from '../systems/anomalies';

export interface EventTarget {
  targetId: string | null;
  secondaryId?: string | null;
}

export interface EventChoice {
  id: string;
  /** Returns an i18n reason key when the choice can't be taken */
  requires?: (s: GameState, ev: ActiveEvent) => string | null;
  apply: (s: GameState, ev: ActiveEvent) => void;
  major?: boolean;
}

export interface EventDef {
  id: string;
  severity: Severity;
  /** Seconds before it can fire again */
  cooldown: number;
  maxCount?: number;
  /** Probability per check for chance-based events (seeded) */
  chance?: number;
  trigger: (s: GameState) => EventTarget | null;
  /** Immediate effects when the incident happens (before the choice) */
  onTrigger?: (s: GameState, ev: ActiveEvent) => void;
  choices: EventChoice[];
  defaultChoice: string;
  /** False for hazards that should not strike while the player is away (offline progression). */
  offline?: boolean;
}

const sorted = <T extends { id: string }>(xs: T[]) => [...xs].sort((a, b) => (a.id < b.id ? -1 : 1));
const mods = (s: GameState) => sorted(Object.values(s.modules));
const aboard = (s: GameState) => s.crew.filter((c) => !c.away && !c.incapacitated);

function bestCrew(s: GameState, skill: keyof CrewMember['skills']): CrewMember | null {
  const list = aboard(s).sort((a, b) => b.skills[skill] - a.skills[skill] || a.fatigue - b.fatigue || (a.id < b.id ? -1 : 1));
  return list[0] ?? null;
}

function assignEmergency(s: GameState, targetId: string, skill: keyof CrewMember['skills']): string | null {
  const c = bestCrew(s, skill);
  if (!c) return null;
  c.task = 'emergency';
  c.targetId = targetId;
  c.taskProgress = 0;
  return c.id;
}

const needsCrew = (skill: keyof CrewMember['skills'], min = 1) => (s: GameState) => (aboard(s).some((c) => c.skills[skill] >= min) ? null : 'event.requires.crew');
const needs = (cost: Partial<Record<'materials' | 'power' | 'credits' | 'research', number>>) => (s: GameState) =>
  Object.entries(cost).every(([r, v]) => s.resources[r as 'materials'] >= (v ?? 0)) ? null : 'event.requires.resources';

export const EVENTS: EventDef[] = [
  {
    id: 'decompression', severity: 'critical', cooldown: 90,
    trigger: (s) => {
      const m = mods(s).find((x) => x.breached && !x.quarantined);
      return m ? { targetId: m.id } : null;
    },
    choices: [
      { id: 'seal', apply: (s, ev) => { const m = s.modules[ev.targetId!]; if (m) m.quarantined = true; } },
      { id: 'patch', requires: needsCrew('engineering', 2), apply: (s, ev) => { assignEmergency(s, ev.targetId!, 'engineering'); } },
    ],
    defaultChoice: 'seal',
  },
  {
    id: 'reactor_instability', severity: 'critical', cooldown: 120,
    trigger: (s) => {
      const r = mods(s).find((m) => m.type === 'reactor' && m.online && m.temperature > MODULES.reactor.maxTemp - 12);
      return r ? { targetId: r.id } : null;
    },
    choices: [
      {
        id: 'vent', apply: (s, ev) => {
          const m = s.modules[ev.targetId!];
          if (m) m.temperature = tidy(m.temperature - 35);
          s.resources.power = tidy(s.resources.power * 0.6);
        },
      },
      {
        id: 'push', major: true, apply: (s, ev) => {
          const m = s.modules[ev.targetId!];
          if (m) m.temperature = tidy(m.temperature + 20);
          addResource(s, 'power', 40);
        },
      },
      {
        id: 'engineer', requires: needsCrew('engineering', 3), apply: (s, ev) => {
          const m = s.modules[ev.targetId!];
          if (m) m.temperature = tidy(m.temperature - 15);
          assignEmergency(s, ev.targetId!, 'engineering');
        },
      },
    ],
    defaultChoice: 'vent',
  },
  {
    id: 'oxygen_shortage', severity: 'critical', cooldown: 180,
    trigger: (s) => (s.resources.oxygen < s.capacity.oxygen * 0.2 ? { targetId: null } : null),
    choices: [
      {
        id: 'ration', apply: (s) => {
          addModifier(s, 'rationing', 180);
          for (const c of s.crew) c.morale = clamp(c.morale - 8, 0, 100);
        },
      },
      {
        id: 'divert', apply: (s) => {
          for (const m of mods(s)) if (MODULES[m.type].priority >= 3 && MODULES[m.type].power < 0) m.enabled = false;
        },
      },
      {
        id: 'reserve', requires: (s) => ((s.counters.reserve_tanks ?? 0) >= 1 ? 'event.requires.once' : needs({ materials: 15 })(s)),
        apply: (s) => {
          spend(s, { materials: 15 });
          s.counters.reserve_tanks = 1;
          addResource(s, 'oxygen', 50);
        },
      },
    ],
    defaultChoice: 'ration',
  },
  {
    id: 'anomaly_discovery', severity: 'critical', cooldown: 10,
    trigger: (s) => {
      const a = sorted(s.anomalies).find((x) => !s.discoveredAnomalies.includes(x.kind) && x.intensity >= 15 && (x.kind !== 'bloom' || s.flags.bloom_reveal));
      return a ? { targetId: a.id } : null;
    },
    onTrigger: (s, ev) => {
      const a = s.anomalies.find((x) => x.id === ev.targetId);
      if (a && !s.discoveredAnomalies.includes(a.kind)) s.discoveredAnomalies.push(a.kind);
    },
    choices: [
      {
        id: 'study', major: true, apply: (s) => {
          addResource(s, 'research', 15);
          s.disposition.symbiosis += 1;
        },
      },
      {
        id: 'quarantine', major: true, apply: (s, ev) => {
          const a = s.anomalies.find((x) => x.id === ev.targetId);
          if (a && s.modules[a.moduleId]) s.modules[a.moduleId].quarantined = true;
          s.disposition.containment += 1;
        },
      },
      {
        id: 'purge', major: true,
        requires: (s, ev) => {
          const a = s.anomalies.find((x) => x.id === ev.targetId);
          return a ? needs(ANOMALIES[a.kind].purgeCost)(s) : 'event.requires.resources';
        },
        apply: (s, ev) => {
          const a = s.anomalies.find((x) => x.id === ev.targetId);
          if (!a) return;
          purgeAnomaly(s, a.id);
        },
      },
    ],
    defaultChoice: 'quarantine',
  },
  {
    id: 'contamination_warning', severity: 'warning', cooldown: 200,
    trigger: (s) => {
      const a = sorted(s.anomalies).find((x) => {
        if (x.kind !== 'bloom' || x.exploited || x.intensity < 45) return false;
        const m = s.modules[x.moduleId];
        return !!m && !m.quarantined;
      });
      return a ? { targetId: a.id } : null;
    },
    choices: [
      { id: 'seal', apply: (s, ev) => { const a = s.anomalies.find((x) => x.id === ev.targetId); if (a && s.modules[a.moduleId]) s.modules[a.moduleId].quarantined = true; s.disposition.containment += 1; } },
      {
        id: 'sterilize', requires: needs({ power: 25, materials: 10 }), apply: (s, ev) => {
          spend(s, { power: 25, materials: 10 });
          const a = s.anomalies.find((x) => x.id === ev.targetId);
          if (!a) return;
          a.intensity = Math.max(0, a.intensity - 40);
          s.disposition.containment += 1;
          if (a.intensity <= 0) removeAnomaly(s, a, 'purged');
        },
      },
      { id: 'monitor', apply: () => undefined },
    ],
    defaultChoice: 'seal',
  },
  {
    id: 'power_surge', severity: 'critical', cooldown: 150,
    trigger: (s) => {
      const a = sorted(s.anomalies).find((x) => x.kind === 'choir' && !x.exploited && x.intensity >= 60);
      if (a) return { targetId: a.moduleId, secondaryId: a.id };
      if ((s.counters.surge ?? 0) >= 100) {
        const r = mods(s).find((m) => m.type === 'reactor');
        return r ? { targetId: r.id } : null;
      }
      return null;
    },
    onTrigger: (s) => {
      s.counters.surge = 0;
    },
    choices: [
      {
        id: 'ground', apply: (s, ev) => {
          damageHull(s, 5);
          const a = s.anomalies.find((x) => x.id === ev.secondaryId);
          if (a) a.intensity = Math.max(0, a.intensity - 30);
        },
      },
      {
        id: 'absorb', apply: (s, ev) => {
          s.resources.power = s.capacity.power;
          const storages = mods(s).filter((m) => m.type === 'storage');
          const targets = storages.length ? storages : [s.modules[ev.targetId!]].filter(Boolean);
          for (const m of targets) createEcho(s, { kind: 'residual_energy', cells: moduleCells(m), intensity: 40, causeKey: 'echo.cause.surge', causeParams: { module: m.type } });
          const a = s.anomalies.find((x) => x.id === ev.secondaryId);
          if (a) a.intensity = Math.max(0, a.intensity - 20);
        },
      },
      {
        id: 'tap', major: true, requires: (s, ev) => (hasResearch(s, 'echo_choir_tap') && ev.secondaryId ? null : 'event.requires.research'),
        apply: (s, ev) => {
          const a = s.anomalies.find((x) => x.id === ev.secondaryId);
          if (a && !a.exploited) {
            a.exploited = true;
            s.stats.anomaliesExploited += 1;
            s.disposition.resonance += 2;
          }
        },
      },
    ],
    defaultChoice: 'ground',
  },
  {
    id: 'hull_damage', severity: 'warning', cooldown: 150, chance: 0.03, offline: false,
    trigger: (s) => {
      if (!s.flags.hazards_on) return null;
      const edge = mods(s).filter((m) => m.buildRemaining <= 0 && moduleCells(m).some((c) => isHullEdge(s, c.x, c.y)));
      if (!edge.length) return null;
      return { targetId: edge[Math.floor(random(s) * edge.length)].id };
    },
    onTrigger: (s, ev) => {
      const m = s.modules[ev.targetId!];
      damageHull(s, 8);
      if (m) {
        m.condition = tidy(clamp(m.condition - 20, 0, 100));
        addScar(s, m, 'impact');
      }
    },
    choices: [
      {
        id: 'patch', requires: needs({ materials: 15 }), apply: (s, ev) => {
          spend(s, { materials: 15 });
          s.hull = tidy(clamp(s.hull + 4, 0, 100));
          const m = s.modules[ev.targetId!];
          if (m) m.condition = tidy(clamp(m.condition + 15, 0, 100));
        },
      },
      { id: 'defer', apply: (s, ev) => { const m = s.modules[ev.targetId!]; if (m) breachModule(s, m); } },
    ],
    defaultChoice: 'patch',
  },
  {
    id: 'crew_conflict', severity: 'warning', cooldown: 300,
    trigger: (s) => {
      const unhappy = aboard(s).filter((c) => c.morale < 40 && c.fatigue > 50).sort((a, b) => a.morale - b.morale || (a.id < b.id ? -1 : 1));
      return unhappy.length >= 2 ? { targetId: unhappy[0].id, secondaryId: unhappy[1].id } : null;
    },
    choices: [
      {
        id: 'mediate', apply: (s, ev) => {
          for (const id of [ev.targetId, ev.secondaryId]) {
            const c = id ? crewById(s, id) : undefined;
            if (!c) continue;
            c.morale = clamp(c.morale + 12, 0, 100);
            c.fatigue = clamp(c.fatigue + 10, 0, 100);
            remember(s, c, 'memory.mediated', 2);
          }
        },
      },
      {
        id: 'shifts', apply: (s, ev) => {
          for (const id of [ev.targetId, ev.secondaryId]) {
            const c = id ? crewById(s, id) : undefined;
            if (!c) continue;
            c.task = 'rest';
            c.targetId = null;
            c.morale = clamp(c.morale + 6, 0, 100);
          }
        },
      },
      {
        id: 'side', major: true, apply: (s, ev) => {
          const a = ev.targetId ? crewById(s, ev.targetId) : undefined;
          const b = ev.secondaryId ? crewById(s, ev.secondaryId) : undefined;
          if (a) {
            a.morale = clamp(a.morale + 20, 0, 100);
            remember(s, a, 'memory.backed', 4, { other: b?.name ?? '' });
          }
          if (b) {
            b.morale = clamp(b.morale - 15, 0, 100);
            remember(s, b, 'memory.overruled', -4, { other: a?.name ?? '' });
          }
        },
      },
    ],
    defaultChoice: 'mediate',
  },
  {
    id: 'echo_resurgence', severity: 'warning', cooldown: 400,
    trigger: (s) => {
      const e = sorted(s.echoes).find((x) => !x.archived && !x.harnessed && x.kind !== 'resonance' && x.intensity >= 65 && s.time - x.createdAt > 120);
      return e ? { targetId: e.id } : null;
    },
    choices: [
      {
        id: 'listen', major: true, apply: (s) => {
          addResource(s, 'research', 20);
          s.disposition.resonance += 2;
        },
      },
      {
        id: 'dampen', requires: needs({ power: 20 }), apply: (s, ev) => {
          spend(s, { power: 20 });
          const e = s.echoes.find((x) => x.id === ev.targetId);
          if (e) e.intensity = Math.max(1, e.intensity - 30);
          s.disposition.containment += 1;
        },
      },
    ],
    defaultChoice: 'dampen',
  },
  {
    id: 'research_breakthrough', severity: 'info', cooldown: 240, chance: 0.06,
    trigger: (s) => {
      if (!s.research.active) return null;
      const researching = s.crew.some((c) => !c.away && c.task === 'research' && c.targetId && s.modules[c.targetId]?.online);
      return researching ? { targetId: null } : null;
    },
    choices: [
      { id: 'publish', apply: (s) => addResource(s, 'research', 25) },
      {
        id: 'apply', apply: (s) => {
          const active = s.research.active;
          if (active) active.progress = Math.min(active.duration, active.progress + active.duration * 0.35);
        },
      },
    ],
    defaultChoice: 'publish',
  },
  {
    id: 'salvage', severity: 'info', cooldown: 200, chance: 0.03,
    trigger: (s) => (s.flags.hazards_on && Object.values(s.modules).some((m) => m.type === 'airlock' && m.online) ? { targetId: null } : null),
    choices: [
      {
        id: 'drone', requires: needs({ power: 15 }), apply: (s) => {
          spend(s, { power: 15 });
          addResource(s, 'materials', 35);
          addResource(s, 'credits', 15);
        },
      },
      {
        id: 'eva', requires: needsCrew('engineering', 2), apply: (s) => {
          const c = bestCrew(s, 'engineering');
          addResource(s, 'materials', 60);
          addResource(s, 'credits', 20);
          if (c) {
            c.fatigue = clamp(c.fatigue + 25, 0, 100);
            c.health = clamp(c.health - 5, 1, 100);
          }
        },
      },
      { id: 'ignore', apply: () => undefined },
    ],
    defaultChoice: 'drone',
  },
];

export const EVENT_BY_ID: Record<string, EventDef> = Object.fromEntries(EVENTS.map((e) => [e.id, e]));

/** Purge: costs resources, destroys the anomaly outright, damages and scars the module. */
export function purgeAnomaly(s: GameState, anomalyId: string): boolean {
  const a = s.anomalies.find((x) => x.id === anomalyId);
  if (!a) return false;
  if (!spend(s, ANOMALIES[a.kind].purgeCost)) return false;
  const m: ModuleInstance | undefined = s.modules[a.moduleId];
  if (m) {
    m.condition = tidy(clamp(m.condition - 30, 0, 100));
    addScar(s, m, 'purge');
  }
  s.disposition.containment += 2;
  removeAnomaly(s, a, 'purged');
  log(s, { severity: 'info', category: 'anomaly', key: 'log.purgeCost', params: { kind: a.kind } });
  return true;
}
