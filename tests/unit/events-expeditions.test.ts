import { executeCommand } from '@/game/engine/commands';
import { EVENT_AUTO_RESOLVE_SECONDS } from '@/game/engine/constants';
import { DESTINATION_BY_ID } from '@/game/content/destinations';
import { updateEvents } from '@/game/systems/events';
import { expeditionRisk, launchError } from '@/game/systems/expeditions';
import { spawnAnomaly } from '@/game/systems/anomalies';
import type { GameState } from '@/game/engine/types';
import { bareShip, first, newGame, run } from '../helpers';

const armed = (s: GameState) => {
  s.events.nextCheck = 0;
  return s;
};

describe('incidents', () => {
  it('oxygen shortage triggers below 20 % and rationing reduces consumption', () => {
    const s = armed(bareShip());
    s.resources.oxygen = s.capacity.oxygen * 0.15;
    updateEvents(s, 0.25);
    expect(s.events.active?.defId).toBe('oxygen_shortage');
    const r = executeCommand(s, { type: 'ResolveEvent', choiceId: 'ration' });
    expect(r.ok).toBe(true);
    const before = r.state.resources.oxygen;
    run(r.state, 60);
    expect(before - r.state.resources.oxygen).toBeCloseTo(9 * 0.7, 1);
  });

  it('respects cooldowns after resolution', () => {
    const s = armed(bareShip());
    s.resources.oxygen = 5;
    updateEvents(s, 0.25);
    const r = executeCommand(s, { type: 'ResolveEvent', choiceId: 'ration' }).state;
    r.events.nextCheck = 0;
    updateEvents(r, 0.25);
    expect(r.events.active).toBeNull();
  });

  it('auto-resolves with the default choice when ignored', () => {
    const s = armed(bareShip());
    s.resources.oxygen = 5;
    updateEvents(s, 0.25);
    s.time += EVENT_AUTO_RESOLVE_SECONDS + 1;
    updateEvents(s, 0.25);
    expect(s.events.active).toBeNull();
    expect(s.log.some((l) => l.key === 'log.eventAuto' && l.params?.choice === 'ration')).toBe(true);
  });

  it('blocked choices are refused with a reason', () => {
    const s = armed(bareShip());
    s.resources.oxygen = 5;
    s.resources.materials = 0;
    updateEvents(s, 0.25);
    expect(executeCommand(s, { type: 'ResolveEvent', choiceId: 'reserve' })).toMatchObject({ ok: false, error: 'event.requires.resources' });
  });

  it('the starting Bloom is only revealed when the tutorial reaches it', () => {
    const s = armed(newGame());
    run(s, 30);
    expect(s.events.active?.defId).not.toBe('anomaly_discovery');
    s.flags.bloom_reveal = true;
    s.events.nextCheck = 0;
    updateEvents(s, 0.25);
    expect(s.events.active?.defId).toBe('anomaly_discovery');
    expect(s.discoveredAnomalies).toContain('bloom');
  });

  it('major decisions are remembered as Resonance', () => {
    const s = armed(newGame());
    s.flags.bloom_reveal = true;
    updateEvents(s, 0.25);
    const r = executeCommand(s, { type: 'ResolveEvent', choiceId: 'study' });
    expect(r.state.echoes.some((e) => e.kind === 'resonance' && e.causeKey === 'echo.cause.decision')).toBe(true);
  });

  it('a Static Choir at high intensity causes a power surge', () => {
    const s = armed(bareShip([['lab', 6, 4]]));
    spawnAnomaly(s, 'choir', first(s, 'lab').id, 70, 'test');
    s.discoveredAnomalies.push('choir');
    updateEvents(s, 0.25);
    expect(s.events.active?.defId).toBe('power_surge');
    const r = executeCommand(s, { type: 'ResolveEvent', choiceId: 'absorb' });
    expect(r.state.echoes.some((e) => e.kind === 'residual_energy')).toBe(true);
  });
});

describe('expeditions', () => {
  function ready(): GameState {
    const s = bareShip([['corridor', 3, 5], ['airlock', 0, 5], ['corridor', 1, 5], ['corridor', 2, 5], ['quarters', 6, 4]]);
    run(s, 1);
    return s;
  }

  it('needs preparation before launch', () => {
    const s = ready();
    expect(launchError(s, 'kessler', ['mira'])).toBe('not_ready');
    const r = executeCommand(s, { type: 'AssignCrewTask', crewId: 'mira', task: 'expedition_prep', targetId: 'kessler' }).state;
    run(r, 60);
    expect(r.expeditions.readiness.kessler).toBe(100);
    expect(r.crew.find((c) => c.id === 'mira')!.task).toBe('rest');
    expect(launchError(r, 'kessler', ['mira'])).toBeNull();
  });

  it('locks destinations behind research and earlier visits', () => {
    const s = ready();
    expect(launchError(s, 'glacier', ['mira'])).toBe('locked');
    expect(executeCommand(s, { type: 'AssignCrewTask', crewId: 'mira', task: 'expedition_prep', targetId: 'glacier' })).toMatchObject({ ok: false, error: 'error.destinationLocked' });
  });

  it('refuses to send everyone or nobody, and needs a working airlock', () => {
    const s = ready();
    s.expeditions.readiness.kessler = 100;
    expect(launchError(s, 'kessler', [])).toBe('crew_count');
    s.crew = s.crew.slice(0, 2);
    expect(launchError(s, 'kessler', ['ines', 'tomas'])).toBe('crew_count');
    first(s, 'airlock').enabled = false;
    run(s, 1);
    expect(launchError(s, 'kessler', ['ines'])).toBe('no_airlock');
  });

  it('launch pays costs, crew leave, and they return with rewards; first Kessler run rescues Elias', () => {
    const s = ready();
    s.expeditions.readiness.kessler = 100;
    const food = s.resources.food;
    const r = executeCommand(s, { type: 'StartExpedition', destinationId: 'kessler', crewIds: ['mira'] });
    expect(r.ok).toBe(true);
    const st = r.state;
    expect(st.resources.food).toBe(food - DESTINATION_BY_ID.kessler.cost.food!);
    expect(st.crew.find((c) => c.id === 'mira')!.away).toBe(true);
    run(st, DESTINATION_BY_ID.kessler.duration + 1);
    expect(st.expeditions.active).toBeNull();
    expect(st.expeditions.completed.kessler).toBe(1);
    expect(st.crew.find((c) => c.id === 'mira')!.away).toBe(false);
    expect(st.crew.some((c) => c.id === 'elias')).toBe(true);
    expect(st.log.filter((l) => l.key.startsWith('expedition.kessler.beat'))).toHaveLength(3);
  });

  it('skilled pilots and research lower the risk', () => {
    const s = ready();
    const d = DESTINATION_BY_ID.kessler;
    expect(expeditionRisk(s, d, ['mira'])).toBeLessThan(expeditionRisk(s, d, ['tomas']));
    const before = expeditionRisk(s, d, ['tomas']);
    s.research.completed.push('nav_drift_charting');
    expect(expeditionRisk(s, d, ['tomas'])).toBeCloseTo(before - 0.08, 5);
  });

  it('outcomes are deterministic for the same seed', () => {
    const outcome = () => {
      const s = ready();
      s.expeditions.readiness.kessler = 100;
      const st = executeCommand(s, { type: 'StartExpedition', destinationId: 'kessler', crewIds: ['tomas'] }).state;
      run(st, 100);
      return st.expeditions.lastOutcome;
    };
    expect(outcome()).toEqual(outcome());
  });
});
