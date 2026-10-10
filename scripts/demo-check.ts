// Dev tool: npx tsx scripts/demo-check.ts — prints the screenshot demo state.
import { buildDemoState } from '../src/dev/demoState';
const s = buildDemoState();
console.log(Object.values(s.modules).map((m) => `${m.type}@${m.x},${m.y}:${m.online ? 'on' : m.offlineReason}`).join(' '));
console.log('anomalies', s.anomalies.map((a) => `${a.kind}:${Math.round(a.intensity)}`), 'power', s.power, 'O2', Math.round(s.resources.oxygen));
