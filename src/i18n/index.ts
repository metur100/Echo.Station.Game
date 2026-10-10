/**
 * Minimal i18n: t(key, params). Params that hold content ids (module types, anomaly kinds,
 * research ids, …) are translated automatically, so the engine can log ids, not prose.
 */
import { en } from './en';

export type Locale = 'en';
const dictionaries: Record<Locale, Record<string, string>> = { en };
let locale: Locale = 'en';

export function setLocale(l: Locale) {
  locale = l;
}

export function has(key: string): boolean {
  return key in dictionaries[locale] || key in en;
}

function raw(key: string): string | undefined {
  return dictionaries[locale][key] ?? en[key];
}

/** Content-id params are looked up in these namespaces, in order. */
const PARAM_NAMESPACES: Record<string, string[]> = {
  module: ['module.{v}.name'],
  kind: ['anomaly.{v}.name', 'echo.{v}.name'],
  destination: ['destination.{v}.name'],
  task: ['task.{v}'],
  event: ['event.{v}.title'],
  id: ['research.{v}.name', 'objective.{v}.title', 'achievement.{v}.name'],
  path: ['ending.path.{v}'],
};

function resolveParam(name: string, value: string | number): string {
  if (typeof value === 'number') return formatNumber(value);
  for (const pattern of PARAM_NAMESPACES[name] ?? []) {
    const hit = raw(pattern.replace('{v}', value));
    if (hit) return hit;
  }
  return value;
}

export function t(key: string, params?: Record<string, string | number>): string {
  const template = raw(key);
  if (template === undefined) return key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => (name in params ? resolveParam(name, params[name]) : `{${name}}`));
}

/** Choice labels of an event, which use the event id as a prefix. */
export const eventChoice = (eventId: string, choiceId: string) => t(`event.${eventId}.${choiceId}`);

export function formatNumber(v: number): string {
  if (!Number.isFinite(v)) return '—';
  const a = Math.abs(v);
  if (a >= 10000) return `${Math.round(v / 1000)}k`;
  if (a >= 100 || Number.isInteger(v)) return String(Math.round(v));
  return v.toFixed(1);
}

/** 754 → "12:34", 3725 → "1:02:05" */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(h ? 2 : 1, '0');
  const ss = String(sec).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function formatRate(perMin: number): string {
  const sign = perMin > 0.05 ? '+' : perMin < -0.05 ? '−' : '±';
  return `${sign}${formatNumber(Math.abs(perMin))}`;
}

export function formatWhen(ms: number, now = Date.now()): string {
  const d = Math.max(0, now - ms) / 1000;
  if (d < 60) return t('time.justNow');
  if (d < 3600) return t('time.minutesAgo', { n: Math.floor(d / 60) });
  if (d < 86400) return t('time.hoursAgo', { n: Math.floor(d / 3600) });
  return new Date(ms).toLocaleDateString(t('time.locale'), { day: 'numeric', month: 'short', year: 'numeric' });
}
