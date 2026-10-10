/**
 * Crew tasks and needs. No pathfinding: a crew member works on their assigned target directly.
 *
 * Work rate = skill factor × health × fatigue × morale × trait multiplier, where the skill factor
 * is 0.5 + 0.25 × the task's skill (1–5). Tasks raise fatigue; resting in a bunk lowers it.
 * At 100 fatigue a crew member collapses into rest. At 0 health they are incapacitated (never
 * killed outright) until they recover to 25.
 */
import { MEMORY_LIMIT } from '../engine/constants';
import { TRAITS, type TraitDef } from '../content/crew';
import { MODULES } from '../content/modules';
import { DESTINATION_BY_ID } from '../content/destinations';
import { RESEARCH_EFFECTS } from '../content/research';
import { captainBonus, clamp, hasResearch, log, tidy } from '../engine/helpers';
import type { CrewMember, CrewSkills, CrewTask, GameState } from '../engine/types';
import { drainEcho, echoOnModule } from './echo';
import { crewCapacity } from './resources';

const TASK_SKILL: Record<CrewTask, keyof CrewSkills | null> = {
  rest: null,
  repair: 'engineering',
  research: 'science',
  maintenance: 'engineering',
  expedition_prep: 'piloting',
  emergency: 'science',
};

const TASK_FATIGUE: Record<CrewTask, number> = {
  rest: 0,
  repair: 6,
  research: 5,
  maintenance: 3,
  expedition_prep: 4,
  emergency: 8,
};

const traitsOf = (c: CrewMember): TraitDef[] => c.traits.map((t) => TRAITS[t]).filter(Boolean);

function traitMultiplier(c: CrewMember, task: CrewTask): number {
  let f = 1;
  for (const t of traitsOf(c)) {
    if (task === 'repair' && t.repair) f *= t.repair;
    if (task === 'research' && t.research) f *= t.research;
    if (task === 'emergency' && t.emergency) f *= t.emergency;
    if (task === 'expedition_prep' && t.prep) f *= t.prep;
  }
  return f;
}

export function skillFor(c: CrewMember, task: CrewTask): number {
  const key = TASK_SKILL[task];
  if (!key) return 0;
  if (task === 'emergency') return Math.max(c.skills.science, c.skills.engineering, c.skills.medicine);
  return c.skills[key];
}

/** How effective this crew member is at a task right now (≈0.2 – 2.2). */
export function workRate(c: CrewMember, task: CrewTask): number {
  if (task === 'rest') return 0;
  const skill = 0.5 + 0.25 * skillFor(c, task);
  const health = c.health < 30 ? 0.5 : 1;
  const fatigue = c.fatigue > 80 ? 0.6 : 1;
  const morale = 0.7 + 0.3 * (c.morale / 100);
  return skill * health * fatigue * morale * traitMultiplier(c, task);
}

export function remember(s: GameState, c: CrewMember, key: string, morale: number, params?: Record<string, string | number>) {
  c.memories.push({ time: Math.floor(s.time), key, params, morale });
  if (c.memories.length > MEMORY_LIMIT) c.memories.splice(0, c.memories.length - MEMORY_LIMIT);
}

function finishTask(s: GameState, c: CrewMember, key: string, params?: Record<string, string | number>) {
  c.task = 'rest';
  c.targetId = null;
  c.taskProgress = 0;
  log(s, { severity: 'success', category: 'crew', key, params: { crew: c.name, ...params } });
}

/** Task targets that no longer exist send the crew member back to rest. */
function targetValid(s: GameState, c: CrewMember): boolean {
  switch (c.task) {
    case 'rest':
      return true;
    case 'repair':
    case 'maintenance':
      return !!c.targetId && !!s.modules[c.targetId] && s.modules[c.targetId].buildRemaining <= 0;
    case 'research':
      return !!c.targetId && s.modules[c.targetId]?.type === 'lab';
    case 'emergency':
      return !!c.targetId && (s.anomalies.some((a) => a.id === c.targetId) || !!s.modules[c.targetId]);
    case 'expedition_prep':
      return !!c.targetId && !!DESTINATION_BY_ID[c.targetId];
  }
}

export function moraleTarget(s: GameState, c: CrewMember, hasBunk: boolean): number {
  let t = 60;
  for (const m of c.memories) t += m.morale;
  t += hasBunk ? 5 : -10;
  if (s.resources.oxygen < s.capacity.oxygen * 0.2) t -= 15;
  if (s.resources.food <= 0) t -= 15;
  if (s.temperature < 5 || s.temperature > 35) t -= 10;
  if (s.events.active) t -= 3;
  const floor = Math.max(0, ...traitsOf(c).map((tr) => tr.moraleFloor ?? 0));
  return clamp(t, floor, 100);
}

export function updateCrew(s: GameState, dtMin: number) {
  const aboard = s.crew.filter((c) => !c.away);
  const bunks = crewCapacity(s);
  const resting = aboard.filter((c) => c.task === 'rest').sort((a, b) => (a.id < b.id ? -1 : 1));
  const bunked = new Set(resting.slice(0, bunks).map((c) => c.id));
  const healAura = aboard
    .filter((c) => c.task === 'rest' && !c.incapacitated)
    .reduce((sum, c) => sum + traitsOf(c).reduce((a, t) => a + (t.healAura ?? 0), 0), 0);
  const workshopBonus = Object.values(s.modules).some((m) => m.type === 'workshop' && m.online) ? 1.5 : 1;
  const suffocating = s.resources.oxygen <= 0.001;
  const starving = s.resources.food <= 0.001;

  for (const c of aboard) {
    if (!targetValid(s, c)) {
      c.task = 'rest';
      c.targetId = null;
      c.taskProgress = 0;
    }
    const fatigueMult = traitsOf(c).reduce((f, t) => f * (t.fatigue ?? 1), 1);
    const rate = workRate(c, c.task);

    switch (c.task) {
      case 'rest': {
        const bunk = bunked.has(c.id);
        c.fatigue -= (bunk ? 8 : 3) * dtMin;
        if (!suffocating && !starving) c.health += (1 + (c.incapacitated ? 0.5 : 0)) * dtMin + healAura * dtMin;
        break;
      }
      case 'repair': {
        const m = s.modules[c.targetId!];
        const gain = 4 * rate * workshopBonus * dtMin;
        const cost = gain * 0.15;
        if (s.resources.materials >= cost) {
          s.resources.materials = tidy(s.resources.materials - cost);
          m.condition = tidy(clamp(m.condition + gain, 0, 100));
          c.taskProgress = m.condition;
        }
        if (m.type === 'reactor' && m.condition >= 60) s.flags.reactor_restored = true;
        if (m.condition >= 100) {
          s.stats.repairsDone += 1;
          finishTask(s, c, 'log.repairDone', { module: m.type });
        }
        break;
      }
      case 'research': {
        // Output is added here; the research system also uses the crew rate to speed projects.
        const lab = s.modules[c.targetId!];
        if (lab.online) s.resources.research = tidy(Math.min(s.capacity.research, s.resources.research + 2 * rate * captainBonus(s) * dtMin));
        break;
      }
      case 'maintenance': {
        const m = s.modules[c.targetId!];
        m.condition = tidy(clamp(m.condition + 0.5 * rate * dtMin, 0, 100));
        const st = echoOnModule(s, m, 'structural');
        if (st && !st.harnessed) drainEcho(s, st, 0.5 * rate * dtMin);
        c.taskProgress = m.condition;
        break;
      }
      case 'emergency': {
        const anomaly = s.anomalies.find((a) => a.id === c.targetId);
        if (anomaly) {
          const taxonomy = hasResearch(s, 'xeno_bloom_taxonomy') ? 1 + RESEARCH_EFFECTS.emergencyContainment : 1;
          anomaly.intensity = tidy(Math.max(0, anomaly.intensity - 8 * rate * taxonomy * dtMin));
          c.taskProgress = 100 - anomaly.intensity;
          if (anomaly.intensity > 70) {
            const risk = traitsOf(c).reduce((f, t) => f * (t.anomalyRisk ?? 1), 1);
            c.health -= 1 * risk * dtMin;
          }
          if (anomaly.intensity <= 0) finishTask(s, c, 'log.emergencyDone', { kind: anomaly.kind });
        } else {
          const m = s.modules[c.targetId!];
          if (m.breached) m.condition = tidy(clamp(m.condition + 6 * rate * dtMin, 0, 100));
          const hot = m.overheated || m.temperature > MODULES[m.type].maxTemp - 10;
          if (hot) m.temperature = tidy(m.temperature - 6 * rate * dtMin);
          if (!m.breached && !hot) finishTask(s, c, 'log.emergencyModuleDone', { module: m.type });
        }
        break;
      }
      case 'expedition_prep': {
        const dest = DESTINATION_BY_ID[c.targetId!];
        const cur = s.expeditions.readiness[dest.id] ?? 0;
        const next = Math.min(100, cur + (100 / dest.prepSeconds) * 60 * rate * dtMin);
        s.expeditions.readiness[dest.id] = tidy(next);
        c.taskProgress = next;
        if (next >= 100) finishTask(s, c, 'log.prepDone', { destination: dest.id });
        break;
      }
    }

    c.fatigue += TASK_FATIGUE[c.task] * fatigueMult * dtMin;
    if (suffocating) {
      c.health -= 4 * dtMin;
      c.morale -= 3 * dtMin;
    }
    if (starving) {
      c.health -= 1 * dtMin;
      c.morale -= 2 * dtMin;
    }

    const target = moraleTarget(s, c, bunked.has(c.id));
    const step = 2 * dtMin;
    c.morale = c.morale < target ? Math.min(target, c.morale + step) : Math.max(target, c.morale - step);

    if (c.fatigue >= 100 && c.task !== 'rest') {
      c.task = 'rest';
      c.targetId = null;
      c.taskProgress = 0;
      c.morale -= 10;
      log(s, { severity: 'warning', category: 'crew', key: 'log.exhausted', params: { crew: c.name } });
    }

    c.health = tidy(clamp(c.health, 0, 100));
    c.fatigue = tidy(clamp(c.fatigue, 0, 100));
    c.morale = tidy(clamp(c.morale, 0, 100));

    if (!c.incapacitated && c.health <= 0) {
      c.incapacitated = true;
      c.task = 'rest';
      c.targetId = null;
      log(s, { severity: 'critical', category: 'crew', key: 'log.incapacitated', params: { crew: c.name } });
    } else if (c.incapacitated && c.health >= 25) {
      c.incapacitated = false;
      log(s, { severity: 'success', category: 'crew', key: 'log.crewRecovered', params: { crew: c.name } });
    }
  }
}

/** Combined research work of crew in online labs, used to speed the active project. */
export function crewResearchRate(s: GameState): number {
  return s.crew
    .filter((c) => !c.away && !c.incapacitated && c.task === 'research' && c.targetId && s.modules[c.targetId]?.online)
    .reduce((sum, c) => sum + workRate(c, 'research'), 0);
}
