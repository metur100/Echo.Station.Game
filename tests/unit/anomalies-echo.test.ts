import { executeCommand } from '@/game/engine/commands';
import { topology } from '@/game/engine/grid';
import { atRisk, growthFactors, spawnAnomaly } from '@/game/systems/anomalies';
import { addScar } from '@/game/systems/condition';
import { createEcho } from '@/game/systems/echo';
import { moduleCells } from '@/game/engine/grid';
import type { GameState } from '@/game/engine/types';
import { bareShip, first, run } from '../helpers';

/** Reactor, storage (organic) at (6,4), corridor at (6,5), hydroponics at (7,4). */
function bloomShip(intensity = 30): GameState {
  const s = bareShip([['storage', 6, 4, 0, { temperature: 22 }], ['corridor', 6, 5, 0, { temperature: 22 }], ['hydroponics', 7, 4, 0, { temperature: 22 }]]);
  spawnAnomaly(s, 'bloom', first(s, 'storage').id, intensity, 'test');
  return s;
}
const bloomIn = (s: GameState, type: string) => s.anomalies.find((a) => a.kind === 'bloom' && s.modules[a.moduleId]?.type === type);

describe('Lumen Bloom', () => {
  it('grows in a warm organic module', () => {
    const s = bloomShip(30);
    run(s, 60);
    expect(bloomIn(s, 'storage')!.intensity).toBeGreaterThan(32);
  });

  it('quarantine stops growth and spread', () => {
    const s = bloomShip(80);
    first(s, 'storage').quarantined = true;
    run(s, 300);
    expect(s.anomalies).toHaveLength(1);
    expect(bloomIn(s, 'storage')!.intensity).toBeLessThanOrEqual(80);
  });

  it('residual energy makes it grow faster (Echo Memory feeds the anomaly)', () => {
    const plain = bloomShip(30);
    const fed = bloomShip(30);
    createEcho(fed, { kind: 'residual_energy', cells: moduleCells(first(fed, 'storage')), intensity: 50, causeKey: 'test' });
    run(plain, 1);
    run(fed, 1);
    const a = growthFactors(plain, plain.anomalies[0], topology(plain));
    const b = growthFactors(fed, fed.anomalies[0], topology(fed));
    expect(b.rate).toBeCloseTo(a.rate * 2, 2);
    expect(b.factors.map((f) => f.key)).toContain('residual_energy');
    run(fed, 5);
    expect(fed.echoes[0].consequences.map((c) => c.key)).toContain('echo.consequence.bloomFeeds');
  });

  it('spreads deterministically to the most susceptible neighbour', () => {
    const s = bloomShip(90);
    const topo = topology(s);
    const risk = atRisk(s, s.anomalies[0], topo);
    // Organic hydroponics outranks the bare corridor.
    expect(s.modules[risk[0].moduleId].type).toBe('hydroponics');
    run(s, 480);
    expect(bloomIn(s, 'hydroponics')).toBeDefined();
    expect(s.log.some((l) => l.key === 'log.anomalySpread')).toBe(true);
  });

  it('emergency response removes it and leaves biological contamination in the cells', () => {
    const s = bloomShip(20);
    const a = s.anomalies[0];
    const next = executeCommand(s, { type: 'AssignCrewTask', crewId: 'tomas', task: 'emergency', targetId: a.id }).state;
    run(next, 240);
    expect(next.anomalies).toHaveLength(0);
    const echo = next.echoes.find((e) => e.kind === 'contamination');
    expect(echo).toBeDefined();
    expect(echo!.cells).toEqual(moduleCells(first(next, 'storage')));
    expect(next.stats.anomaliesContained).toBe(1);
  });

  it('contamination lets the Bloom grow back', () => {
    const s = bareShip([['storage', 6, 4, 0, { temperature: 22 }]]);
    createEcho(s, { kind: 'contamination', cells: moduleCells(first(s, 'storage')), intensity: 60, causeKey: 'test' });
    run(s, 330);
    expect(s.anomalies.some((a) => a.kind === 'bloom')).toBe(true);
    expect(s.log.some((l) => l.key === 'log.bloomRegrew')).toBe(true);
  });

  it('a containment field shuts growth down', () => {
    const s = bloomShip(40);
    const id = `m${s.nextId++}`;
    s.modules[id] = { ...first(s, 'storage'), id, type: 'containment', x: 6, y: 3, condition: 100, quarantined: false };
    run(s, 60);
    expect(s.anomalies.find((a) => s.modules[a.moduleId].type === 'storage')!.intensity).toBeLessThan(40);
  });

  it('exploiting requires the research', () => {
    const s = bloomShip(40);
    const a = s.anomalies[0];
    expect(executeCommand(s, { type: 'ExploitAnomaly', anomalyId: a.id })).toMatchObject({ ok: false, error: 'error.needsResearch' });
    s.research.completed.push('xeno_symbiosis');
    const r = executeCommand(s, { type: 'ExploitAnomaly', anomalyId: a.id });
    expect(r.ok).toBe(true);
    expect(r.state.disposition.symbiosis).toBe(2);
  });

  it('purge costs resources, kills it instantly and scars the room', () => {
    const s = bloomShip(60);
    const r = executeCommand(s, { type: 'ContainAnomaly', anomalyId: s.anomalies[0].id, method: 'purge' });
    expect(r.ok).toBe(true);
    expect(r.state.anomalies).toHaveLength(0);
    expect(first(r.state, 'storage').scars).toBe(1);
    expect(r.state.echoes[0].intensity).toBeCloseTo(60 * 0.8, 3);
  });
});

describe('Void Frost and Static Choir', () => {
  it('frost grows in cold modules and dies when warmed', () => {
    const cold = bareShip([['storage', 6, 4, 0, { temperature: -5, enabled: false }]]);
    spawnAnomaly(cold, 'frost', first(cold, 'storage').id, 30, 'test');
    const g = growthFactors(cold, cold.anomalies[0], topology(cold));
    expect(g.rate).toBeGreaterThan(0);
    first(cold, 'storage').temperature = 25;
    expect(growthFactors(cold, cold.anomalies[0], topology(cold)).rate).toBeLessThan(0);
  });

  it('the choir drains extra power and starves when its module is switched off', () => {
    const s = bareShip([['lab', 6, 4]]);
    run(s, 1);
    const base = s.power.demand;
    spawnAnomaly(s, 'choir', first(s, 'lab').id, 50, 'test');
    run(s, 1);
    expect(s.power.demand).toBeCloseTo(base + 0.2 * s.anomalies[0].intensity, 0);
    first(s, 'lab').enabled = false;
    run(s, 1);
    expect(s.anomalies[0].growth).toBeLessThan(0);
  });
});

describe('Echo Memory', () => {
  it('a third damage incident leaves Structural Fatigue that doubles wear', () => {
    const s = bareShip([['storage', 6, 4]]);
    const st = first(s, 'storage');
    addScar(s, st, 'test');
    addScar(s, st, 'test');
    expect(s.echoes).toHaveLength(0);
    addScar(s, st, 'test');
    expect(s.echoes[0]).toMatchObject({ kind: 'structural', intensity: 40 });
    const control = bareShip([['storage', 6, 4]]);
    run(s, 600);
    run(control, 600);
    const wearS = 100 - first(s, 'storage').condition;
    const wearC = 100 - first(control, 'storage').condition;
    expect(wearS).toBeCloseTo(wearC * 1.8, 1);
  });

  it('Lattice Alloys turn structural fatigue into self-repair', () => {
    const s = bareShip([['storage', 6, 4, 0, { condition: 50 }]]);
    createEcho(s, { kind: 'structural', cells: moduleCells(first(s, 'storage')), intensity: 60, causeKey: 'test' });
    s.research.completed.push('eng_lattice_alloys');
    run(s, 60);
    expect(first(s, 'storage').condition).toBeGreaterThan(50);
    expect(s.echoes[0].harnessed).toBe(true);
  });

  it('echoes are anchored to cells and outlive the module', () => {
    const s = bloomShip(50);
    const st = first(s, 'storage');
    const r = executeCommand(s, { type: 'RemoveModule', moduleId: st.id });
    expect(r.ok).toBe(true);
    const echo = r.state.echoes.find((e) => e.kind === 'contamination');
    expect(echo?.cells).toEqual([{ x: 6, y: 4 }]);
  });

  it('residual energy fades and is archived, not deleted', () => {
    const s = bareShip();
    createEcho(s, { kind: 'residual_energy', cells: [{ x: 4, y: 4 }], intensity: 5, causeKey: 'test' });
    run(s, 400);
    expect(s.echoes[0]).toMatchObject({ archived: true, intensity: 0 });
  });

  it('reinforcing an echo on the same cells strengthens it instead of duplicating it', () => {
    const s = bareShip();
    createEcho(s, { kind: 'residual_energy', cells: [{ x: 4, y: 4 }], intensity: 40, causeKey: 'a' });
    createEcho(s, { kind: 'residual_energy', cells: [{ x: 4, y: 4 }], intensity: 40, causeKey: 'b' });
    expect(s.echoes).toHaveLength(1);
    expect(s.echoes[0].intensity).toBeCloseTo(64, 5);
  });

  it('echo condensers harvest residual energy into research', () => {
    const s = bareShip([['condenser', 6, 4]]);
    createEcho(s, { kind: 'residual_energy', cells: [{ x: 6, y: 4 }], intensity: 50, causeKey: 'test' });
    s.resources.research = 0;
    run(s, 60);
    expect(s.resources.research).toBeGreaterThan(1);
    expect(s.echoes[0].intensity).toBeLessThan(50 - 1.5);
  });
});
