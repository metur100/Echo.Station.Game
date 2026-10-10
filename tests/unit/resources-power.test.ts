import { TICK_SECONDS } from '@/game/engine/constants';
import { tick } from '@/game/engine/step';
import { reactorOutput } from '@/game/systems/power';
import { heatSources } from '@/game/systems/thermal';
import { bareShip, first, run } from '../helpers';

describe('resources', () => {
  it('crew aboard breathe 3 oxygen and eat 1 food per minute each', () => {
    const s = bareShip();
    s.resources.oxygen = 100;
    s.resources.food = 50;
    run(s, 60);
    expect(s.resources.oxygen).toBeCloseTo(100 - 9, 1);
    expect(s.resources.food).toBeCloseTo(50 - 3, 1);
    expect(s.flows.oxygen.consumption).toBeCloseTo(9, 3);
  });

  it('an oxygen generator turns water into oxygen', () => {
    const s = bareShip([['oxygen', 6, 4]]);
    s.resources.oxygen = 100;
    s.resources.water = 60;
    run(s, 60);
    expect(s.resources.oxygen).toBeCloseTo(100 + 10 - 9, 1);
    expect(s.resources.water).toBeCloseTo(58, 1);
    expect(s.flows.oxygen.production).toBeCloseTo(10, 3);
  });

  it('a module whose inputs are empty goes offline with no_input', () => {
    const s = bareShip([['oxygen', 6, 4]]);
    s.resources.water = 0;
    run(s, 1);
    const gen = first(s, 'oxygen');
    expect(gen.online).toBe(false);
    expect(gen.offlineReason).toBe('no_input');
  });

  it('never exceeds capacity or drops below zero', () => {
    const s = bareShip([['oxygen', 6, 4], ['recycler', 4, 2]]);
    s.resources.oxygen = s.capacity.oxygen = 200;
    run(s, 120);
    expect(s.resources.oxygen).toBeLessThanOrEqual(s.capacity.oxygen);
    s.resources.food = 0.1;
    run(s, 120);
    expect(s.resources.food).toBe(0);
  });

  it('hull breaches vent oxygen unless the module is quarantined', () => {
    const a = bareShip([['storage', 6, 4, 0, { breached: true, condition: 30 }]]);
    const b = bareShip([['storage', 6, 4, 0, { breached: true, condition: 30, quarantined: true }]]);
    a.resources.oxygen = b.resources.oxygen = 100;
    run(a, 30);
    run(b, 30);
    expect(100 - a.resources.oxygen).toBeCloseTo(100 - b.resources.oxygen + 4, 1);
  });
});

describe('power', () => {
  function crowded() {
    // demand: oxygen 12 + recycler 8 (p1), hydroponics 8 + shield 16 (p2), lab 14 + workshop 10 (p3) = 68 > 60
    return bareShip([
      ['oxygen', 4, 2],
      ['recycler', 5, 2],
      ['hydroponics', 4, 6],
      ['shield', 2, 5],
      ['lab', 6, 4],
      ['workshop', 2, 4],
    ]);
  }

  it('serves consumers by priority and sheds the lowest when supply runs short', () => {
    const s = crowded();
    s.resources.power = 0;
    tick(s, TICK_SECONDS);
    expect(s.power.supply).toBeCloseTo(60, 3);
    expect(s.power.shortage).toBe(true);
    expect(first(s, 'oxygen').online).toBe(true);
    expect(first(s, 'shield').online).toBe(true);
    expect(first(s, 'lab').online).toBe(true);
    expect(first(s, 'workshop').offlineReason).toBe('no_power');
  });

  it('the battery covers a deficit while it lasts, then stays in reserve until 25 %', () => {
    const s = crowded();
    s.resources.power = 30;
    tick(s, TICK_SECONDS);
    expect(first(s, 'workshop').online).toBe(true);
    run(s, 300);
    // The battery ran flat and is recharging: the workshop is shed, not flickering.
    const states = new Set<boolean>();
    for (let i = 0; i < 20; i++) {
      tick(s, TICK_SECONDS);
      states.add(first(s, 'workshop').online);
    }
    expect(states.size).toBe(1);
  });

  it('surplus charges the battery', () => {
    const s = bareShip([['quarters', 6, 4]]);
    s.resources.power = 10;
    run(s, 60);
    expect(s.resources.power).toBeCloseTo(10 + 60 - 4, 0);
  });

  it('a broken corridor cuts a wing off the power network', () => {
    const s = bareShip([['corridor', 6, 4, 0, { condition: 5 }], ['lab', 7, 4]]);
    tick(s, TICK_SECONDS);
    expect(first(s, 'corridor').offlineReason).toBe('broken');
    expect(first(s, 'lab').offlineReason).toBe('disconnected');
  });

  it('with no working reactor, consumers report no_power', () => {
    const s = bareShip([['lab', 6, 4]]);
    first(s, 'reactor').enabled = false;
    tick(s, TICK_SECONDS);
    expect(first(s, 'reactor').offlineReason).toBe('disabled');
    expect(first(s, 'lab').offlineReason).toBe('no_power');
  });

  it('reactor output falls with condition', () => {
    const s = bareShip();
    const r = first(s, 'reactor');
    const healthy = reactorOutput(s, r);
    r.condition = 30;
    expect(reactorOutput(s, r)).toBeCloseTo(healthy * (0.4 + 0.6 * 0.5), 5);
  });
});

describe('temperature', () => {
  it('heat flows from a hot module to a cold neighbour', () => {
    const s = bareShip([['storage', 6, 4, 0, { temperature: 0 }]]);
    const r = first(s, 'reactor');
    r.enabled = false;
    r.temperature = 80;
    const st = first(s, 'storage');
    tick(s, TICK_SECONDS);
    expect(st.temperature).toBeGreaterThan(0);
    expect(r.temperature).toBeLessThan(80);
  });

  it('radiators cool their neighbours', () => {
    const a = bareShip([['storage', 3, 4, 0, { temperature: 40 }]]);
    const b = bareShip([['storage', 3, 4, 0, { temperature: 40 }], ['radiator', 3, 3]]);
    run(a, 30);
    run(b, 30);
    expect(first(b, 'storage').temperature).toBeLessThan(first(a, 'storage').temperature - 2);
  });

  it('modules shut down above max temperature + margin and restart once cool', () => {
    const s = bareShip([['lab', 6, 4, 0, { temperature: 75 }]]);
    tick(s, TICK_SECONDS);
    tick(s, TICK_SECONDS);
    const lab = first(s, 'lab');
    expect(lab.overheated).toBe(true);
    expect(lab.offlineReason).toBe('overheated');
    run(s, 240);
    expect(lab.overheated).toBe(false);
    expect(lab.online).toBe(true);
  });

  it('a reactor overload damages the reactor and leaves residual energy around it', () => {
    const s = bareShip([['storage', 6, 4]]);
    const r = first(s, 'reactor');
    r.temperature = 110;
    tick(s, TICK_SECONDS);
    expect(s.flags.reactor_overloaded).toBe(true);
    expect(r.scars).toBe(1);
    expect(r.condition).toBeLessThan(90);
    const residual = s.echoes.filter((e) => e.kind === 'residual_energy');
    expect(residual).toHaveLength(2);
    const [lo, hi] = residual.map((e) => e.intensity).sort((x, y) => x - y);
    expect(lo).toBeCloseTo(35, 1);
    expect(hi).toBeCloseTo(70, 1);
    // Residual energy heats the rooms it sits in: 0.06 °C/min per intensity point.
    const storage = first(s, 'storage');
    storage.online = false;
    expect(heatSources(s, storage, 0)).toBeCloseTo(35 * 0.06, 2);
  });
});
