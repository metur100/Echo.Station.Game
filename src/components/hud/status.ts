/**
 * Shared HUD status rules: when a resource counts as low or critical. Kept in one place so the
 * HUD, inspector and statistics agree.
 */
import type { GameState, ResourceId } from '../../game/engine/types';
import type { StatusTone } from '../../theme/tokens';

export type HudResource = ResourceId | 'hull' | 'temperature';

export function resourceTone(s: GameState, r: HudResource): StatusTone {
  if (r === 'hull') return s.hull < 25 ? 'critical' : s.hull < 45 ? 'warn' : 'ok';
  if (r === 'temperature') return s.temperature < 0 || s.temperature > 40 ? 'critical' : s.temperature < 5 || s.temperature > 35 ? 'warn' : 'ok';
  const v = s.resources[r];
  const cap = s.capacity[r];
  const flow = s.flows[r];
  const net = flow ? flow.production - flow.consumption : 0;
  switch (r) {
    case 'power':
      if (s.power.shortage) return 'critical';
      return v < cap * 0.15 && net < 0 ? 'warn' : 'ok';
    case 'oxygen':
      return v < cap * 0.12 ? 'critical' : v < cap * 0.25 || (net < 0 && v < cap * 0.4) ? 'warn' : 'ok';
    case 'food':
    case 'water':
      return v <= 1 ? 'critical' : v < 15 && net < 0 ? 'warn' : 'ok';
    default:
      return 'ok';
  }
}

export function netFlow(s: GameState, r: ResourceId): number {
  const f = s.flows[r];
  return f ? f.production - f.consumption : 0;
}

/** Minutes until a resource runs out at the current net rate, or null. */
export function minutesLeft(s: GameState, r: ResourceId): number | null {
  const net = netFlow(s, r);
  if (net >= -0.01) return null;
  return s.resources[r] / -net;
}
