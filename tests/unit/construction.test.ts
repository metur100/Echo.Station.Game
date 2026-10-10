import { executeCommand } from '@/game/engine/commands';
import { checkPlacement } from '@/game/engine/grid';
import { MODULES } from '@/game/content/modules';
import { bareShip, first, newGame, run } from '../helpers';

describe('placement validation', () => {
  it('accepts a connected placement inside the hull', () => {
    const s = bareShip();
    expect(checkPlacement(s, 'storage', 6, 4, 0)).toMatchObject({ valid: true, error: null });
  });

  it.each([
    ['out_of_hull', 'storage', 0, 0, 0],
    ['occupied', 'storage', 4, 4, 0],
    ['not_connected', 'storage', 8, 8, 0],
    ['needs_hull_edge', 'airlock', 6, 4, 0],
    ['needs_research', 'radiator', 6, 4, 0],
  ] as const)('rejects %s', (error, type, x, y, r) => {
    const s = bareShip();
    expect(checkPlacement(s, type, x, y, r).error).toBe(error);
  });

  it('rejects what the player cannot afford', () => {
    const s = bareShip();
    s.resources.materials = 0;
    expect(checkPlacement(s, 'lab', 6, 4, 0).error).toBe('cannot_afford');
  });

  it('rotation swaps the footprint', () => {
    const s = bareShip();
    // An oxygen generator is 1×2; rotated it is 2×1 and fits beside the reactor top edge.
    expect(checkPlacement(s, 'oxygen', 4, 3, 1).valid).toBe(true);
    expect(checkPlacement(s, 'oxygen', 4, 3, 0).error).toBe('occupied');
  });

  it('marks each preview cell as free or blocked', () => {
    const s = bareShip();
    const check = checkPlacement(s, 'lab', 5, 3, 0);
    expect(check.valid).toBe(false);
    expect(check.cells.filter((c) => !c.ok)).toEqual([{ x: 5, y: 4, ok: false }]);
  });
});

describe('build, dismantle, upgrade', () => {
  it('building deducts the cost, then becomes operational after its build time', () => {
    const s = bareShip();
    const before = s.resources.materials;
    const r = executeCommand(s, { type: 'PlaceModule', moduleType: 'storage', x: 6, y: 4, rotation: 0 });
    expect(r.ok).toBe(true);
    const next = r.state;
    expect(next.resources.materials).toBe(before - MODULES.storage.cost.materials);
    const st = first(next, 'storage');
    expect(st.buildRemaining).toBe(MODULES.storage.buildSeconds);
    run(next, 1);
    expect(st.offlineReason).toBe('constructing');
    run(next, MODULES.storage.buildSeconds);
    expect(st.online).toBe(true);
    expect(next.capacity.materials).toBeGreaterThan(s.capacity.materials);
  });

  it('a rejected command leaves the state untouched', () => {
    const s = bareShip();
    const json = JSON.stringify(s);
    const r = executeCommand(s, { type: 'PlaceModule', moduleType: 'storage', x: 0, y: 0, rotation: 0 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('placement.out_of_hull');
    expect(JSON.stringify(r.state)).toBe(json);
  });

  it('dismantling refunds half the materials of a finished module', () => {
    const s = bareShip([['lab', 6, 4]]);
    s.resources.materials = 10;
    const r = executeCommand(s, { type: 'RemoveModule', moduleId: first(s, 'lab').id });
    expect(r.ok).toBe(true);
    expect(r.state.resources.materials).toBe(10 + MODULES.lab.cost.materials / 2);
    expect(first(r.state, 'lab')).toBeUndefined();
  });

  it('refuses to split the ship or remove the last reactor', () => {
    const s = bareShip([['corridor', 6, 4], ['lab', 7, 4]]);
    const corridor = first(s, 'corridor');
    expect(executeCommand(s, { type: 'RemoveModule', moduleId: corridor.id })).toMatchObject({ ok: false, error: 'error.wouldDisconnect' });
    expect(executeCommand(s, { type: 'RemoveModule', moduleId: first(s, 'reactor').id })).toMatchObject({ ok: false, error: 'error.lastReactor' });
  });

  it('crew assigned to a dismantled module return to rest', () => {
    const s = bareShip([['storage', 6, 4, 0, { condition: 50 }]]);
    const st = first(s, 'storage');
    const a = executeCommand(s, { type: 'AssignCrewTask', crewId: 'ines', task: 'repair', targetId: st.id });
    const b = executeCommand(a.state, { type: 'RemoveModule', moduleId: st.id });
    expect(b.state.crew[0]).toMatchObject({ task: 'rest', targetId: null });
  });

  it('upgrades raise output; level 3 needs Modular Upgrades', () => {
    const s = bareShip([['recycler', 6, 4]]);
    s.resources.materials = 500;
    s.resources.credits = 500;
    const rec = first(s, 'recycler');
    const l2 = executeCommand(s, { type: 'UpgradeModule', moduleId: rec.id });
    expect(l2.ok).toBe(true);
    run(l2.state, 30);
    expect(l2.state.flows.water.production).toBeCloseTo(5 * 1.35, 2);
    expect(executeCommand(l2.state, { type: 'UpgradeModule', moduleId: rec.id })).toMatchObject({ ok: false, error: 'error.needsResearch' });
    l2.state.research.completed.push('eng_modular_upgrades');
    expect(executeCommand(l2.state, { type: 'UpgradeModule', moduleId: rec.id }).ok).toBe(true);
  });

  it('the starting ship is a single connected layout with free space to build', () => {
    const s = newGame();
    expect(checkPlacement(s, 'oxygen', 5, 2, 0).valid).toBe(true);
  });
});
