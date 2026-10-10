/**
 * Incident runner. Every EVENT_CHECK_SECONDS it walks the event table in order and starts the
 * first incident whose cooldown has passed, whose occurrence limit isn't reached, whose (seeded)
 * chance roll passes and whose trigger matches the current state. One incident at a time.
 * Unanswered incidents resolve with their default choice after EVENT_AUTO_RESOLVE_SECONDS.
 */
import { EVENT_AUTO_RESOLVE_SECONDS, EVENT_CHECK_SECONDS } from '../engine/constants';
import { EVENT_BY_ID, EVENTS, type EventChoice } from '../content/events';
import { log } from '../engine/helpers';
import { random } from '../engine/rng';
import type { ActiveEvent, GameState } from '../engine/types';
import { createEcho, echoIntensity } from './echo';

export function choiceBlocked(s: GameState, ev: ActiveEvent, choice: EventChoice): string | null {
  return choice.requires ? choice.requires(s, ev) : null;
}

export function updateEvents(s: GameState, dtSec: number, autoResolveNow = false) {
  // Residual energy around a running reactor builds toward a power surge.
  const hotReactor = Object.values(s.modules).some((m) => m.type === 'reactor' && m.online && echoIntensity(s, m, 'residual_energy') >= 50);
  if (hotReactor) s.counters.surge = Math.min(100, (s.counters.surge ?? 0) + (dtSec / 60) * 12);

  const active = s.events.active;
  if (active) {
    if (autoResolveNow || s.time - active.startedAt >= EVENT_AUTO_RESOLVE_SECONDS) resolveEvent(s, null, true);
    return;
  }
  if (s.time < s.events.nextCheck) return;
  s.events.nextCheck = s.time + EVENT_CHECK_SECONDS;
  if (s.gameOver) return;

  for (const def of EVENTS) {
    if ((s.events.cooldowns[def.id] ?? 0) > s.time) continue;
    if (def.maxCount !== undefined && (s.events.counts[def.id] ?? 0) >= def.maxCount) continue;
    if (autoResolveNow && def.offline === false) continue;
    if (def.chance !== undefined && random(s) >= def.chance) continue;
    const target = def.trigger(s);
    if (!target) continue;
    const ev: ActiveEvent = { defId: def.id, targetId: target.targetId, secondaryId: target.secondaryId ?? null, startedAt: s.time };
    s.events.active = ev;
    s.events.counts[def.id] = (s.events.counts[def.id] ?? 0) + 1;
    def.onTrigger?.(s, ev);
    log(s, { severity: def.severity, category: 'event', key: `event.${def.id}.title` });
    if (autoResolveNow) resolveEvent(s, null, true);
    return;
  }
}

/** Resolve the active incident. `choiceId` null = default (or first available) choice. */
export function resolveEvent(s: GameState, choiceId: string | null, auto = false): string | null {
  const ev = s.events.active;
  if (!ev) return 'error.noEvent';
  const def = EVENT_BY_ID[ev.defId];
  if (!def) {
    s.events.active = null;
    return null;
  }
  let choice = def.choices.find((c) => c.id === (choiceId ?? def.defaultChoice));
  if (!choice) return 'error.unknownChoice';
  if (choiceBlocked(s, ev, choice)) {
    if (!auto) return choiceBlocked(s, ev, choice);
    choice = def.choices.find((c) => !choiceBlocked(s, ev, c)) ?? choice;
  }
  choice.apply(s, ev);
  s.events.active = null;
  s.events.cooldowns[def.id] = s.time + def.cooldown;
  s.stats.eventsResolved += 1;
  log(s, { severity: 'info', category: 'event', key: auto ? 'log.eventAuto' : 'log.eventResolved', params: { event: def.id, choice: choice.id } });
  if (choice.major) {
    createEcho(s, { kind: 'resonance', cells: [], intensity: 10, causeKey: 'echo.cause.decision', causeParams: { event: def.id, choice: choice.id } });
  }
  return null;
}
