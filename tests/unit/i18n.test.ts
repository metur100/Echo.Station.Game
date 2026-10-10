import fs from 'node:fs';
import path from 'node:path';

import { ACHIEVEMENTS } from '@/game/content/achievements';
import { ANOMALY_KINDS } from '@/game/content/anomalies';
import { TRAITS, STARTING_CREW, RESCUED_CREW } from '@/game/content/crew';
import { DESTINATIONS, EXPEDITION_BEATS } from '@/game/content/destinations';
import { EVENTS } from '@/game/content/events';
import { MODULE_TYPES } from '@/game/content/modules';
import { OBJECTIVES } from '@/game/content/objectives';
import { RESEARCH, RESEARCH_BRANCHES } from '@/game/content/research';
import { en } from '@/i18n/en';
import { formatDuration, t } from '@/i18n';

describe('strings', () => {
  const need: string[] = [];
  for (const m of MODULE_TYPES) need.push(`module.${m}.name`, `module.${m}.desc`);
  for (const r of RESEARCH) need.push(`research.${r.id}.name`, `research.${r.id}.desc`);
  for (const b of RESEARCH_BRANCHES) need.push(`research.branch.${b}`);
  for (const k of ANOMALY_KINDS) need.push(`anomaly.${k}.name`, `anomaly.${k}.desc`);
  for (const d of DESTINATIONS) {
    need.push(`destination.${d.id}.name`, `destination.${d.id}.desc`, `destination.${d.id}.constraint`, `story.${d.id}`);
    for (let i = 1; i <= EXPEDITION_BEATS; i++) need.push(`expedition.${d.id}.beat${i}`);
  }
  for (const e of EVENTS) {
    need.push(`event.${e.id}.title`, `event.${e.id}.body`);
    for (const c of e.choices) need.push(`event.${e.id}.${c.id}`, `event.${e.id}.${c.id}Desc`);
  }
  for (const o of OBJECTIVES) need.push(`objective.${o.id}.title`, `objective.${o.id}.desc`);
  for (const a of ACHIEVEMENTS) need.push(`achievement.${a.id}.name`, `achievement.${a.id}.desc`);
  for (const tr of Object.keys(TRAITS)) need.push(`trait.${tr}.name`, `trait.${tr}.desc`);
  for (const c of [...STARTING_CREW, RESCUED_CREW]) need.push(`crew.${c.id}.bio`, `crew.role.${c.role}`);

  it('every content id has its strings', () => {
    expect(need.filter((k) => !(k in en))).toEqual([]);
  });

  it('every t() key and log key used in the source exists', () => {
    const root = path.resolve(__dirname, '../../src');
    const files: string[] = [];
    const walk = (d: string) => {
      for (const f of fs.readdirSync(d)) {
        const p = path.join(d, f);
        if (fs.statSync(p).isDirectory()) walk(p);
        else if (/\.(ts|tsx)$/.test(f)) files.push(p);
      }
    };
    walk(root);
    const missing = new Set<string>();
    let found = 0;
    const re = /(?:t\(|key: |causeKey: |'log\.|Key\b.*?)'((?:log|story|echo|error|event|hud|common|menu|slots|intro|resource|module|offline|inspect|build|placement|crew|task|trait|memory|research|anomaly|factor|expedition|destination|objective|ending|gameover|pause|away|stats|achievements|settings|manual|credits|boot|time|app)\.[A-Za-z0-9_.]+)'/g;
    for (const f of files) {
      const src = fs.readFileSync(f, 'utf8');
      for (const m of src.matchAll(re)) {
        const key = m[1];
        if (key.endsWith('.')) continue;
        found++;
        if (!(key in en)) missing.add(`${key} (${path.basename(f)})`);
      }
    }
    expect(found).toBeGreaterThan(150);
    expect([...missing]).toEqual([]);
  });

  it('interpolates and translates content-id params', () => {
    expect(t('log.buildDone', { module: 'oxygen' })).toBe('Construction complete: Oxygen Generator.');
    expect(t('log.anomalySpread', { kind: 'bloom', module: 'hydroponics' })).toBe('The Lumen Bloom has spread into the Hydroponics.');
    expect(t('no.such.key')).toBe('no.such.key');
    expect(formatDuration(3725)).toBe('1:02:05');
    expect(formatDuration(75)).toBe('1:15');
  });
});
