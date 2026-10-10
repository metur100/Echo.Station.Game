import fc from 'fast-check';
import { GameEngine } from '@/game/engine/GameEngine';
import { cellKey, moduleCells } from '@/game/engine/grid';
import { MODULE_TYPES } from '@/game/content/modules';
import { RESEARCH } from '@/game/content/research';
import { RESOURCE_IDS, type Command, type GameState } from '@/game/engine/types';

const crewIds = ['ines', 'tomas', 'mira'];
const tasks = ['rest', 'repair', 'research', 'maintenance', 'emergency', 'expedition_prep'] as const;

/** Random but structurally valid commands; many will be rejected, which is part of the test. */
const commandArb = (moduleIds: string[]) =>
  fc.oneof(
    fc.record({ type: fc.constant('PlaceModule' as const), moduleType: fc.constantFrom(...MODULE_TYPES), x: fc.integer({ min: -1, max: 10 }), y: fc.integer({ min: -1, max: 10 }), rotation: fc.constantFrom(0 as const, 1 as const) }),
    fc.record({ type: fc.constant('RemoveModule' as const), moduleId: fc.constantFrom(...moduleIds) }),
    fc.record({ type: fc.constant('UpgradeModule' as const), moduleId: fc.constantFrom(...moduleIds) }),
    fc.record({ type: fc.constant('ToggleModule' as const), moduleId: fc.constantFrom(...moduleIds), enabled: fc.boolean() }),
    fc.record({ type: fc.constant('SetQuarantine' as const), moduleId: fc.constantFrom(...moduleIds), quarantined: fc.boolean() }),
    fc.record({ type: fc.constant('AssignCrewTask' as const), crewId: fc.constantFrom(...crewIds), task: fc.constantFrom(...tasks), targetId: fc.constantFrom<string | null>(null, 'kessler', ...moduleIds) }),
    fc.record({ type: fc.constant('StartResearch' as const), researchId: fc.constantFrom(...RESEARCH.map((r) => r.id)) }),
    fc.record({ type: fc.constant('StartExpedition' as const), destinationId: fc.constant('kessler'), crewIds: fc.subarray(crewIds) }),
    fc.record({ type: fc.constant('ResolveEvent' as const), choiceId: fc.constantFrom('vent', 'push', 'ration', 'quarantine', 'study', 'patch', 'defer', 'mediate', 'seal') }),
  ) as fc.Arbitrary<Command>;

function checkInvariants(s: GameState) {
  for (const r of RESOURCE_IDS) {
    expect(Number.isFinite(s.resources[r])).toBe(true);
    expect(s.resources[r]).toBeGreaterThanOrEqual(0);
    expect(s.resources[r]).toBeLessThanOrEqual(s.capacity[r] + 1e-6);
  }
  expect(s.hull).toBeGreaterThanOrEqual(0);
  expect(s.hull).toBeLessThanOrEqual(100);
  const cells = new Set<string>();
  for (const m of Object.values(s.modules)) {
    expect(m.condition).toBeGreaterThanOrEqual(0);
    expect(m.condition).toBeLessThanOrEqual(100);
    expect(Number.isFinite(m.temperature)).toBe(true);
    for (const c of moduleCells(m)) {
      const k = cellKey(c.x, c.y);
      expect(cells.has(k)).toBe(false);
      expect(s.grid.hull[c.y][c.x]).toBe('#');
      cells.add(k);
    }
  }
  for (const c of s.crew) for (const v of [c.health, c.morale, c.fatigue]) expect(v >= 0 && v <= 100).toBe(true);
  for (const a of s.anomalies) {
    expect(s.modules[a.moduleId]).toBeDefined();
    expect(a.intensity >= 0 && a.intensity <= 100).toBe(true);
  }
  expect(s.log.length).toBeLessThanOrEqual(160);
  expect(s.echoes.length).toBeLessThanOrEqual(40);
}

describe('determinism', () => {
  it('the same seed and command sequence produce the same game', () => {
    const play = () => {
      const e = new GameEngine();
      e.initializeNewGame({ seed: 'meridian' });
      e.executeCommand({ type: 'PlaceModule', moduleType: 'oxygen', x: 5, y: 2, rotation: 0 });
      e.executeCommand({ type: 'AssignCrewTask', crewId: 'ines', task: 'repair', targetId: 'm1' });
      for (let i = 0; i < 40; i++) e.updateSimulation(0.5, 4);
      e.executeCommand({ type: 'AcknowledgeObjective', objectiveId: 'inspect_reactor' });
      e.runTicks(2000);
      return e.serializeGame();
    };
    expect(play()).toBe(play());
  });

  it('the fixed timestep is independent of frame rate', () => {
    const a = new GameEngine();
    const b = new GameEngine();
    for (let i = 0; i < 120; i++) a.updateSimulation(1 / 60);
    for (let i = 0; i < 30; i++) b.updateSimulation(1 / 15);
    expect(a.getSnapshot().tick).toBe(b.getSnapshot().tick);
    expect(a.serializeGame()).toBe(b.serializeGame());
  });

  it('pausing stops time', () => {
    const e = new GameEngine();
    e.pauseSimulation();
    expect(e.updateSimulation(1)).toBe(0);
    e.resumeSimulation();
    expect(e.updateSimulation(1)).toBe(4);
  });
});

describe('invariants under random play (property-based)', () => {
  const ids = Array.from({ length: 24 }, (_, i) => `m${i + 1}`);
  it('resources, grid and crew stay valid for any command sequence', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 1e6 }), fc.array(fc.tuple(commandArb(ids), fc.integer({ min: 1, max: 240 })), { maxLength: 25 }), (seed, steps) => {
        const e = new GameEngine();
        e.initializeNewGame({ seed });
        for (const [cmd, ticks] of steps) {
          e.executeCommand(cmd);
          e.runTicks(ticks);
        }
        checkInvariants(e.getSnapshot());
      }),
      { numRuns: 60 },
    );
  });

  it('a save round trip of any reachable state validates without repairs', () => {
    fc.assert(
      fc.property(fc.array(fc.tuple(commandArb(ids), fc.integer({ min: 1, max: 200 })), { maxLength: 12 }), (steps) => {
        const e = new GameEngine();
        for (const [cmd, ticks] of steps) {
          e.executeCommand(cmd);
          e.runTicks(ticks);
        }
        const copy = new GameEngine();
        const r = copy.restoreGame(JSON.parse(e.serializeGame()));
        expect(r.ok).toBe(true);
        if (r.ok) expect(r.repairs).toEqual([]);
        expect(copy.serializeGame()).toBe(e.serializeGame());
      }),
      { numRuns: 30 },
    );
  });
});
