// Balance probe (dev tool): npx tsx scripts/probe.ts
import { GameEngine } from '../src/game/engine/GameEngine';
const e = new GameEngine();
const s0 = e.getSnapshot();
const reactor = Object.values(s0.modules).find((m) => m.type === 'reactor')!;
const r1 = e.executeCommand({ type: 'PlaceModule', moduleType: 'oxygen', x: 5, y: 2, rotation: 0 });
console.log('place', r1.ok || r1.error);
const pr = (label: string) => {
  const s = e.getSnapshot();
  const r = s.modules[reactor.id];
  console.log(label, 'O2', s.resources.oxygen.toFixed(1), 'pwr', s.resources.power.toFixed(0), `sup ${s.power.supply.toFixed(1)}/dem ${s.power.demand.toFixed(1)}`, 'reactor', r.temperature.toFixed(1) + 'C', 'cond', r.condition.toFixed(0), 'mat', s.resources.materials.toFixed(0), 'ev', s.events.active?.defId ?? '-', 'ines', s.crew[0].task, s.crew[0].fatigue.toFixed(0), 'obj', s.objectives.completed.join(','));
};
for (let i = 1; i <= 16; i++) {
  e.runTicks(4 * 30);
  if (i === 2) console.log('assign', e.executeCommand({ type: 'AssignCrewTask', crewId: 'ines', task: 'repair', targetId: reactor.id }).ok);
  if (i === 1) e.executeCommand({ type: 'AcknowledgeObjective', objectiveId: 'inspect_reactor' });
  pr(`${i * 30}s`);
  const s = e.getSnapshot();
  if (s.events.active) console.log('  resolve', s.events.active.defId, e.executeCommand({ type: 'ResolveEvent', choiceId: s.events.active.defId === 'reactor_instability' ? 'vent' : 'quarantine' }).ok);
}
const s = e.getSnapshot();
for (const m of Object.values(s.modules)) console.log(m.id, m.type, m.temperature.toFixed(1), m.online ? 'on' : m.offlineReason, m.condition.toFixed(0));
console.log(s.log.map((l) => `${l.time} ${l.key} ${JSON.stringify(l.params ?? {})}`).join('\n'));
