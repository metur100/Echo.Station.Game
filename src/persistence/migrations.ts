/**
 * Save-schema migrations. Each step takes a state at version N and returns version N+1.
 * History:
 *   1 → 2  ship evolution: `disposition` added
 *   2 → 3  echo consequences, event modifiers and generic counters added
 */
import { SCHEMA_VERSION } from '../game/engine/constants';

type Raw = Record<string, unknown> & { schemaVersion?: number };

export const MIGRATIONS: Record<number, (s: Raw) => Raw> = {
  1: (s) => ({ ...s, schemaVersion: 2, disposition: { containment: 0, symbiosis: 0, resonance: 0 } }),
  2: (s) => {
    const events = (s.events ?? {}) as Record<string, unknown>;
    const echoes = Array.isArray(s.echoes) ? (s.echoes as Record<string, unknown>[]) : [];
    return {
      ...s,
      schemaVersion: 3,
      counters: (s.counters as object) ?? {},
      events: { cooldowns: {}, counts: {}, nextCheck: 0, active: null, ...events, modifiers: Array.isArray(events.modifiers) ? events.modifiers : [] },
      echoes: echoes.map((e) => ({ consequences: [], harnessed: false, archived: false, peak: e.intensity ?? 0, ...e })),
    };
  },
};

export type MigrationResult = { ok: true; state: Raw; migratedFrom: number | null } | { ok: false; reason: 'newer' | 'unknown_version' };

export function migrate(input: Raw): MigrationResult {
  let s = input;
  const from = typeof s.schemaVersion === 'number' ? s.schemaVersion : NaN;
  if (!Number.isInteger(from) || from < 1) return { ok: false, reason: 'unknown_version' };
  if (from > SCHEMA_VERSION) return { ok: false, reason: 'newer' };
  while ((s.schemaVersion as number) < SCHEMA_VERSION) {
    const step = MIGRATIONS[s.schemaVersion as number];
    if (!step) return { ok: false, reason: 'unknown_version' };
    s = step(s);
  }
  return { ok: true, state: s, migratedFrom: from === SCHEMA_VERSION ? null : from };
}
