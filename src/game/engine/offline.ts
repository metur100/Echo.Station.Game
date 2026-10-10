/**
 * Offline progression. Elapsed real time is clamped to [0, OFFLINE.maxSeconds] (negative gaps
 * from clock changes count as zero) and simulated in at most ~720 coarse steps. Incidents
 * resolve with their safe defaults, hazards don't strike, and life-critical values are held
 * above safety floors so the player never returns to a ship destroyed while they were away.
 */
import { OFFLINE } from './constants';
import { cloneState, tidy } from './helpers';
import { tick } from './step';
import { RESOURCE_IDS, type GameState, type ResourceMap } from './types';

export interface OfflineSummary {
  seconds: number;
  /** Real seconds that were not simulated because of the cap */
  cappedSeconds: number;
  resources: ResourceMap;
  hull: number;
  researchCompleted: string[];
  buildsCompleted: number;
  incidents: number;
  expeditionReturned: string | null;
  echoesCreated: number;
  anomalySpreads: number;
}

export function clampElapsed(lastSaved: number, now: number): { seconds: number; capped: number } {
  const raw = (now - lastSaved) / 1000;
  if (!Number.isFinite(raw) || raw <= 0) return { seconds: 0, capped: 0 };
  const seconds = Math.min(raw, OFFLINE.maxSeconds);
  return { seconds: Math.floor(seconds), capped: Math.floor(raw - seconds) };
}

function applyFloors(s: GameState) {
  const f = OFFLINE.floors;
  s.resources.oxygen = Math.max(s.resources.oxygen, s.capacity.oxygen * f.oxygen);
  s.resources.food = Math.max(s.resources.food, s.capacity.food * f.food);
  s.resources.water = Math.max(s.resources.water, s.capacity.water * f.water);
  if (s.hull < f.hull) s.hull = f.hull;
  for (const c of s.crew) {
    if (c.health < f.health) c.health = f.health;
    c.incapacitated = false;
  }
  s.gameOver = null;
}

export function simulateOffline(input: GameState, seconds: number, capped = 0): { state: GameState; summary: OfflineSummary | null } {
  if (seconds < OFFLINE.minSeconds || input.gameOver) return { state: input, summary: null };
  const s = cloneState(input);
  const before = { resources: { ...s.resources }, hull: s.hull, research: [...s.research.completed], log: s.nextLogId, echoes: s.stats.echoesCreated, expedition: s.expeditions.active?.destinationId ?? null };
  const step = Math.min(20, Math.max(OFFLINE.stepSeconds, seconds / 720));
  const steps = Math.ceil(seconds / step);
  for (let i = 0; i < steps; i++) {
    tick(s, Math.min(step, seconds - i * step), { offline: true });
    applyFloors(s);
  }
  const newLogs = s.log.filter((l) => l.id >= before.log);
  const resources = Object.fromEntries(RESOURCE_IDS.map((r) => [r, tidy(s.resources[r] - before.resources[r])])) as ResourceMap;
  return {
    state: s,
    summary: {
      seconds,
      cappedSeconds: capped,
      resources,
      hull: tidy(s.hull - before.hull),
      researchCompleted: s.research.completed.filter((r) => !before.research.includes(r)),
      buildsCompleted: newLogs.filter((l) => l.key === 'log.buildDone' || l.key === 'log.upgradeDone').length,
      incidents: newLogs.filter((l) => l.key === 'log.eventAuto').length,
      expeditionReturned: before.expedition && !s.expeditions.active ? before.expedition : null,
      echoesCreated: s.stats.echoesCreated - before.echoes,
      anomalySpreads: newLogs.filter((l) => l.key === 'log.anomalySpread').length,
    },
  };
}
