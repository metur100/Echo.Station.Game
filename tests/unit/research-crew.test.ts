import { executeCommand } from '@/game/engine/commands';
import { RESEARCH_BY_ID } from '@/game/content/research';
import { reactorOutput } from '@/game/systems/power';
import { researchAvailability } from '@/game/systems/research';
import { workRate } from '@/game/systems/crew';
import type { GameState } from '@/game/engine/types';
import { bareShip, first, run } from '../helpers';

const labShip = () => {
  const s = bareShip([['lab', 6, 4], ['quarters', 4, 6]]);
  s.resources.research = 200;
  return s;
};

describe('research', () => {
  it('enforces prerequisites', () => {
    const s = labShip();
    expect(researchAvailability(s, RESEARCH_BY_ID.eng_radiators).status).toBe('locked');
    expect(researchAvailability(s, RESEARCH_BY_ID.eng_reactor_tuning).status).toBe('available');
    expect(executeCommand(s, { type: 'StartResearch', researchId: 'eng_radiators' })).toMatchObject({ ok: false, error: 'error.researchLocked' });
  });

  it('anomaly research stays locked until the anomaly is discovered', () => {
    const s = labShip();
    expect(researchAvailability(s, RESEARCH_BY_ID.xeno_bloom_taxonomy).missing[0].key).toBe('research.missing.anomaly');
    s.discoveredAnomalies.push('bloom');
    expect(researchAvailability(s, RESEARCH_BY_ID.xeno_bloom_taxonomy).status).toBe('available');
  });

  it('starting spends research points; it completes after its duration with a lab online', () => {
    const s = labShip();
    const r = executeCommand(s, { type: 'StartResearch', researchId: 'eng_reactor_tuning' });
    expect(r.ok).toBe(true);
    const st = r.state;
    expect(st.resources.research).toBe(200 - RESEARCH_BY_ID.eng_reactor_tuning.cost);
    expect(executeCommand(st, { type: 'StartResearch', researchId: 'nav_drift_charting' })).toMatchObject({ ok: false, error: 'error.researchBusy' });
    run(st, RESEARCH_BY_ID.eng_reactor_tuning.seconds + 1);
    expect(st.research.completed).toContain('eng_reactor_tuning');
    expect(st.research.active).toBeNull();
  });

  it('Reactor Tuning raises reactor output by 20 %', () => {
    const s = labShip();
    const before = reactorOutput(s, first(s, 'reactor'));
    s.research.completed.push('eng_reactor_tuning');
    expect(reactorOutput(s, first(s, 'reactor'))).toBeCloseTo(before * 1.2, 5);
  });

  it('a scientist in the lab speeds up the project', () => {
    const solo = executeCommand(labShip(), { type: 'StartResearch', researchId: 'eng_reactor_tuning' }).state;
    const staffed = executeCommand(solo, { type: 'AssignCrewTask', crewId: 'tomas', task: 'research', targetId: first(solo, 'lab').id }).state;
    run(solo, 10);
    run(staffed, 10);
    expect(staffed.research.active!.progress).toBeGreaterThan(solo.research.active!.progress * 1.5);
  });

  it('refuses research without enough points', () => {
    const s = labShip();
    s.resources.research = 5;
    expect(executeCommand(s, { type: 'StartResearch', researchId: 'eng_reactor_tuning' })).toMatchObject({ ok: false, error: 'error.notEnoughResearch' });
  });
});

describe('crew', () => {
  const damaged = (): GameState => bareShip([['storage', 6, 4, 0, { condition: 40 }], ['quarters', 4, 6]]);

  it('repair raises condition and spends materials; skill matters', () => {
    const a = executeCommand(damaged(), { type: 'AssignCrewTask', crewId: 'ines', task: 'repair', targetId: 'm2' }).state;
    const b = executeCommand(damaged(), { type: 'AssignCrewTask', crewId: 'tomas', task: 'repair', targetId: 'm2' }).state;
    const mats = a.resources.materials;
    run(a, 30);
    run(b, 30);
    expect(a.modules.m2.condition).toBeGreaterThan(40);
    expect(a.resources.materials).toBeLessThan(mats);
    expect(a.modules.m2.condition - 40).toBeGreaterThan((b.modules.m2.condition - 40) * 1.8);
  });

  it('finishes the repair and returns to rest', () => {
    const s = executeCommand(damaged(), { type: 'AssignCrewTask', crewId: 'ines', task: 'repair', targetId: 'm2' }).state;
    run(s, 600);
    expect(s.modules.m2.condition).toBeGreaterThan(99);
    expect(s.crew[0].task).toBe('rest');
    expect(s.stats.repairsDone).toBe(1);
  });

  it('validates assignments', () => {
    const s = damaged();
    expect(executeCommand(s, { type: 'AssignCrewTask', crewId: 'ines', task: 'research', targetId: 'm2' })).toMatchObject({ ok: false, error: 'error.needsLab' });
    expect(executeCommand(s, { type: 'AssignCrewTask', crewId: 'ines', task: 'repair', targetId: 'm3' })).toMatchObject({ ok: false, error: 'error.nothingToRepair' });
    s.crew[0].away = true;
    expect(executeCommand(s, { type: 'AssignCrewTask', crewId: 'ines', task: 'repair', targetId: 'm2' })).toMatchObject({ ok: false, error: 'error.crewAway' });
    expect(executeCommand(s, { type: 'AssignCrewTask', crewId: 'nobody', task: 'rest', targetId: null })).toMatchObject({ ok: false, error: 'error.noCrew' });
  });

  it('exhaustion forces rest; tired and hurt crew work slower', () => {
    const s = executeCommand(damaged(), { type: 'AssignCrewTask', crewId: 'ines', task: 'maintenance', targetId: 'm2' }).state;
    const ines = s.crew[0];
    const fresh = workRate(ines, 'repair');
    ines.fatigue = 99.99;
    ines.health = 20;
    expect(workRate(ines, 'repair')).toBeLessThan(fresh * 0.4);
    run(s, 1);
    expect(ines.task).toBe('rest');
  });

  it('without oxygen crew lose health, become incapacitated, and the game ends when all are down', () => {
    const s = bareShip();
    s.resources.oxygen = 0;
    for (const c of s.crew) c.health = 3;
    run(s, 120);
    expect(s.crew.every((c) => c.incapacitated)).toBe(true);
    expect(s.gameOver?.reason).toBe('crew_lost');
  });

  it('resting in a bunk recovers fatigue faster than sleeping in a corridor', () => {
    const withBunks = damaged();
    const without = bareShip([['storage', 6, 4]]);
    for (const s of [withBunks, without]) for (const c of s.crew) c.fatigue = 80;
    run(withBunks, 60);
    run(without, 60);
    expect(withBunks.crew[0].fatigue).toBeLessThan(without.crew[0].fatigue - 3);
  });
});
