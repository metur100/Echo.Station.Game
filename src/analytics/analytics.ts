/**
 * Analytics boundary. The game ships with NO analytics provider: events go to a small
 * in-memory ring buffer on the device (useful for debugging) and are never transmitted.
 *
 * To add a provider later, implement AnalyticsSink, keep payloads free of personal data,
 * gate it behind explicit consent, update the privacy policy and the store privacy forms, and
 * register it with setAnalyticsSink(). Playing must never depend on it.
 */
export type AnalyticsEvent =
  | 'session_started'
  | 'tutorial_started'
  | 'tutorial_completed'
  | 'mission_started'
  | 'mission_completed'
  | 'anomaly_discovered'
  | 'research_unlocked'
  | 'save_loaded'
  | 'critical_error';

export type AnalyticsProps = Record<string, string | number | boolean>;

export interface AnalyticsSink {
  track(event: AnalyticsEvent, props?: AnalyticsProps): void;
}

export class LocalRingSink implements AnalyticsSink {
  readonly events: { event: AnalyticsEvent; props?: AnalyticsProps; at: number }[] = [];
  constructor(private limit = 100) {}
  track(event: AnalyticsEvent, props?: AnalyticsProps) {
    this.events.push({ event, props, at: Date.now() });
    if (this.events.length > this.limit) this.events.shift();
  }
}

let sink: AnalyticsSink = new LocalRingSink();

export function setAnalyticsSink(s: AnalyticsSink) {
  sink = s;
}

export function getAnalyticsSink() {
  return sink;
}

export function track(event: AnalyticsEvent, props?: AnalyticsProps) {
  try {
    sink.track(event, props);
  } catch {
    // Analytics must never break the game.
  }
}
