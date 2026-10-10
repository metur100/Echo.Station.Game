// Dev tool: npx tsx scripts/diag-campaign.ts [seed] — plays the campaign bot and prints where it ends.
import { playCampaign } from '../tests/campaignBot';
import { launchError } from '../src/game/systems/expeditions';
import { currentObjective } from '../src/game/systems/progression';

const { s } = playCampaign(Number(process.argv[2] ?? 1));
console.log(JSON.stringify({
  minutes: Math.round(s.time / 60), ending: s.ending, stuckAt: currentObjective(s)?.id, research: s.research, readiness: s.expeditions.readiness, completed: s.expeditions.completed,
  res: Object.fromEntries(Object.entries(s.resources).map(([k, v]) => [k, Math.round(v)])), hull: Math.round(s.hull), lanternErr: launchError(s, 'lantern', ['mira', 'ines']),
  crew: s.crew.map((c) => [c.id, c.task, c.targetId, Math.round(c.health), Math.round(c.fatigue), c.away, c.incapacitated].join(':')),
  modules: Object.values(s.modules).map((m) => `${m.type}:${m.online ? 'on' : m.offlineReason}:${Math.round(m.condition)}`).join(' '),
  anomalies: s.anomalies.map((a) => `${a.kind}@${s.modules[a.moduleId]?.type}:${Math.round(a.intensity)}`),
  stats: s.stats,
}, null, 1));
