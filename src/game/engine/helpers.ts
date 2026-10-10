import { LOG_LIMIT } from './constants';
import type { CrewMember, GameState, LogEntry, ModuleInstance, ResourceId } from './types';

export const clamp = (v: number, min: number, max: number) => (v < min ? min : v > max ? max : v);

/** Rounds to 6 decimals so saves stay compact without distorting slow per-tick rates. */
export const tidy = (v: number) => Math.round(v * 1e6) / 1e6;

export function hasResearch(s: GameState, id: string): boolean {
  return s.research.completed.includes(id);
}

export function hasModifier(s: GameState, id: string): boolean {
  return s.events.modifiers.some((m) => m.id === id && m.until > s.time);
}

export function addModifier(s: GameState, id: string, seconds: number) {
  s.events.modifiers = s.events.modifiers.filter((m) => m.id !== id && m.until > s.time);
  s.events.modifiers.push({ id, until: s.time + seconds });
}

export function log(s: GameState, entry: Omit<LogEntry, 'id' | 'time'>) {
  s.log.push({ ...entry, id: s.nextLogId++, time: Math.floor(s.time) });
  if (s.log.length > LOG_LIMIT) s.log.splice(0, s.log.length - LOG_LIMIT);
}

export function addResource(s: GameState, r: ResourceId, amount: number) {
  s.resources[r] = tidy(clamp(s.resources[r] + amount, 0, s.capacity[r]));
}

/** Spend if possible; returns false (and spends nothing) when short. */
export function spend(s: GameState, cost: Partial<Record<ResourceId, number>>): boolean {
  for (const [r, v] of Object.entries(cost) as [ResourceId, number][]) if (s.resources[r] < v) return false;
  for (const [r, v] of Object.entries(cost) as [ResourceId, number][]) s.resources[r] = tidy(s.resources[r] - v);
  return true;
}

export function captainLevelForXp(xp: number): number {
  return Math.min(10, Math.floor(Math.sqrt(Math.max(0, xp) / 50)) + 1);
}

export function xpForLevel(level: number): number {
  return (level - 1) ** 2 * 50;
}

export function grantXp(s: GameState, xp: number) {
  s.captain.xp += xp;
  const level = captainLevelForXp(s.captain.xp);
  if (level > s.captain.level) {
    s.captain.level = level;
    log(s, { severity: 'success', category: 'system', key: 'log.captainLevel', params: { level } });
  }
}

/** Captain bonus to all production: +2 % per level above 1 */
export const captainBonus = (s: GameState) => 1 + 0.02 * (s.captain.level - 1);

export function newId(s: GameState, prefix: string): string {
  return `${prefix}${s.nextId++}`;
}

export function crewById(s: GameState, id: string): CrewMember | undefined {
  return s.crew.find((c) => c.id === id);
}

export function operational(m: ModuleInstance): boolean {
  return m.buildRemaining <= 0;
}

export function modulesOfType(s: GameState, type: ModuleInstance['type'], onlineOnly = false): ModuleInstance[] {
  return Object.values(s.modules)
    .filter((m) => m.type === type && (!onlineOnly || m.online))
    .sort((a, b) => (a.id < b.id ? -1 : 1));
}

/** Efficiency from condition: full above 60 %, falling linearly to 40 % at 0. */
export function conditionEfficiency(condition: number): number {
  return condition >= 60 ? 1 : 0.4 + 0.6 * (condition / 60);
}

export function cloneState<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}
