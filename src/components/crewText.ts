import type { CrewMember, GameState } from '../game/engine/types';
import { t } from '../i18n';

/** "Repair · Reactor", "On expedition", … */
export function taskLine(s: GameState, c: CrewMember): string {
  if (c.away) return t('crew.away');
  if (c.incapacitated) return t('crew.incapacitated');
  const task = t(`task.${c.task}`);
  if (!c.targetId) return task;
  const m = s.modules[c.targetId];
  if (m) return `${task} · ${t(`module.${m.type}.name`)}`;
  const a = s.anomalies.find((x) => x.id === c.targetId);
  if (a) return `${task} · ${t(`anomaly.${a.kind}.name`)}`;
  return `${task} · ${t(`destination.${c.targetId}.name`)}`;
}
