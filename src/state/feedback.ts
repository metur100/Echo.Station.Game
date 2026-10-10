/**
 * Turns new engine log entries into sound, haptics, toasts and analytics. The engine stays
 * pure; presentation reacts to what it logged.
 */
import { track } from '../analytics/analytics';
import { audio, type Sfx } from '../audio/audio';
import { haptic } from '../audio/haptics';
import type { LogEntry } from '../game/engine/types';
import { t } from '../i18n';
import type { StatusTone } from '../theme/tokens';

export interface Toast {
  id: number;
  text: string;
  tone: StatusTone;
}

const SOUND: Record<string, Sfx> = {
  'log.buildDone': 'build',
  'log.upgradeDone': 'build',
  'log.researchDone': 'research',
  'log.expedition.success': 'mission',
  'log.expedition.partial': 'mission',
  'log.expedition.failure': 'warning',
  'log.echoCreated': 'echo',
  'log.reactorOverload': 'alarm',
  'log.breach': 'alarm',
  'log.anomalySpread': 'warning',
  'log.choirWoke': 'echo',
  'log.bloomRegrew': 'warning',
  'log.objectiveDone': 'success',
  'log.achievement': 'success',
  'log.repairDone': 'success',
  'log.incapacitated': 'alarm',
};

/** Log keys worth a toast (others stay in the log). */
const TOAST: Record<string, StatusTone> = {
  'log.buildDone': 'ok',
  'log.upgradeDone': 'ok',
  'log.researchDone': 'info',
  'log.objectiveDone': 'ok',
  'log.achievement': 'info',
  'log.echoCreated': 'anomaly',
  'log.anomalySpread': 'warn',
  'log.reactorOverload': 'critical',
  'log.breach': 'critical',
  'log.expedition.success': 'ok',
  'log.expedition.partial': 'warn',
  'log.expedition.failure': 'critical',
  'log.crewRescued': 'ok',
  'log.captainLevel': 'info',
  'log.exhausted': 'warn',
  'log.incapacitated': 'critical',
  'log.choirWoke': 'anomaly',
  'log.bloomRegrew': 'anomaly',
  'log.anomalyBroughtAboard': 'anomaly',
};

export function processLog(entries: LogEntry[], onToast: (t: Omit<Toast, 'id'>) => void) {
  let sfx: Sfx | null = null;
  for (const e of entries) {
    const s = SOUND[e.key] ?? (e.severity === 'critical' && e.category === 'event' ? 'alarm' : e.category === 'event' ? 'warning' : null);
    if (s && (!sfx || s === 'alarm')) sfx = s;
    const tone = TOAST[e.key];
    if (tone) onToast({ text: t(e.key, e.params), tone });
    if (e.severity === 'critical') haptic('warning');
    if (e.key === 'log.researchDone') track('research_unlocked', { id: String(e.params?.id ?? '') });
    if (e.key.startsWith('log.expedition.')) track('mission_completed', { destination: String(e.params?.destination ?? ''), outcome: e.key.split('.')[2] });
    if (e.key === 'log.expeditionLaunched') track('mission_started', { destination: String(e.params?.destination ?? '') });
    if (e.key === 'log.objectiveDone' && e.params?.id === 'first_expedition') track('tutorial_completed');
    if (e.key === 'event.anomaly_discovery.title') track('anomaly_discovered');
  }
  if (sfx) audio.play(sfx);
}
