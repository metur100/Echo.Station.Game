import { ACHIEVEMENTS } from '../content/achievements';
import { OBJECTIVES, type ObjectiveDef } from '../content/objectives';
import { addResource, clamp, grantXp, log } from '../engine/helpers';
import type { EndingState, GameState, ResourceId } from '../engine/types';
import { createEcho, resonance } from './echo';

export function currentObjective(s: GameState): ObjectiveDef | null {
  return OBJECTIVES.find((o) => !s.objectives.completed.includes(o.id)) ?? null;
}

export function currentChapter(s: GameState): number {
  return currentObjective(s)?.chapter ?? 4;
}

export function updateObjectives(s: GameState) {
  // Several objectives may complete in the same tick (e.g. after a big expedition).
  for (let guard = 0; guard < OBJECTIVES.length; guard++) {
    const obj = currentObjective(s);
    if (!obj) return;
    const startedFlag = `obj_started_${obj.id}`;
    if (!s.flags[startedFlag]) {
      s.flags[startedFlag] = true;
      obj.onStart?.(s);
    }
    if (!obj.check(s)) return;
    s.objectives.completed.push(obj.id);
    for (const [r, v] of Object.entries(obj.reward) as [string, number][]) {
      if (r === 'xp') grantXp(s, v);
      else addResource(s, r as ResourceId, v);
    }
    log(s, { severity: 'success', category: 'story', key: 'log.objectiveDone', params: { id: obj.id } });
    const next = currentObjective(s);
    if (next && next.chapter !== obj.chapter) log(s, { severity: 'info', category: 'story', key: `story.chapter${next.chapter}` });
  }
}

export function updateAchievements(s: GameState) {
  for (const a of ACHIEVEMENTS) {
    if (s.achievements[a.id] !== undefined) continue;
    if (a.check(s)) {
      s.achievements[a.id] = Math.floor(s.time);
      log(s, { severity: 'success', category: 'system', key: 'log.achievement', params: { id: a.id } });
    }
  }
}

export function checkGameOver(s: GameState) {
  if (s.gameOver) return;
  if (s.hull <= 0) {
    s.gameOver = { reason: 'hull_failure', time: Math.floor(s.time) };
  } else if (s.crew.length > 0 && s.crew.every((c) => c.incapacitated && !c.away)) {
    s.gameOver = { reason: 'crew_lost', time: Math.floor(s.time) };
  }
  if (s.gameOver) log(s, { severity: 'critical', category: 'system', key: `log.gameOver.${s.gameOver.reason}` });
}

/** Ship evolution path score; resonance echoes count toward the Resonance path. */
export function dispositionScores(s: GameState) {
  return {
    containment: s.disposition.containment,
    symbiosis: s.disposition.symbiosis,
    resonance: s.disposition.resonance + resonance(s) / 20,
  };
}

export function dominantPath(s: GameState): 'containment' | 'symbiosis' | 'resonance' {
  const sc = dispositionScores(s);
  if (sc.resonance > sc.containment && sc.resonance > sc.symbiosis) return 'resonance';
  if (sc.symbiosis > sc.containment) return 'symbiosis';
  return 'containment';
}

export function decideEnding(s: GameState): EndingState {
  const path = dominantPath(s);
  const id = path === 'containment' ? 'clean_return' : path === 'symbiosis' ? 'garden_ship' : 'remembering';
  s.ending = { id, time: Math.floor(s.time) };
  log(s, { severity: 'success', category: 'story', key: `story.ending.${id}` });
  return s.ending;
}

/**
 * Emergency recovery after a game over: the ship survives at a cost, and remembers it.
 * Keeps the game from being lost to a single mistake.
 */
export function emergencyRecovery(s: GameState) {
  s.gameOver = null;
  s.hull = Math.max(s.hull, 35);
  s.resources.oxygen = Math.max(s.resources.oxygen, s.capacity.oxygen * 0.5);
  s.resources.food = Math.max(s.resources.food, 20);
  s.resources.materials = Math.floor(s.resources.materials * 0.5);
  s.resources.credits = Math.floor(s.resources.credits * 0.7);
  for (const c of s.crew) {
    c.health = Math.max(c.health, 35);
    c.incapacitated = false;
    c.fatigue = clamp(c.fatigue, 0, 60);
  }
  for (const a of s.anomalies) a.intensity = Math.floor(a.intensity / 2);
  for (const m of Object.values(s.modules)) {
    if (m.breached) m.quarantined = true;
    if (m.type === 'reactor') {
      m.condition = Math.max(m.condition, 40);
      m.temperature = Math.min(m.temperature, 40);
      m.overheated = false;
    }
  }
  s.stats.recoveries += 1;
  createEcho(s, { kind: 'resonance', cells: [], intensity: 15, causeKey: 'echo.cause.nearDeath' });
  log(s, { severity: 'warning', category: 'system', key: 'log.emergencyRecovery' });
}
