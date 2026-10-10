import { Pressable, StyleSheet, View } from 'react-native';

import { EVENT_AUTO_RESOLVE_SECONDS } from '../../game/engine/constants';
import { EVENT_BY_ID } from '../../game/content/events';
import type { ActiveEvent, GameState } from '../../game/engine/types';
import { choiceBlocked } from '../../game/systems/events';
import { t } from '../../i18n';
import { useGame } from '../../state/gameStore';
import { useSettings } from '../../state/settingsStore';
import { colors, radius, space, type StatusTone } from '../../theme/tokens';
import { Dialog } from '../Dialog';
import { Icon } from '../Icon';
import { Label, Text } from '../ui';

/** Names and types an incident's text refers to. */
export function eventParams(s: GameState, ev: ActiveEvent): Record<string, string> {
  const params: Record<string, string> = {};
  const m = ev.targetId ? s.modules[ev.targetId] : undefined;
  const a = s.anomalies.find((x) => x.id === ev.targetId || x.id === ev.secondaryId);
  const crewA = s.crew.find((c) => c.id === ev.targetId);
  const crewB = s.crew.find((c) => c.id === ev.secondaryId);
  if (m) params.module = m.type;
  if (a) {
    params.kind = a.kind;
    if (!m && s.modules[a.moduleId]) params.module = s.modules[a.moduleId].type;
  }
  if (crewA) params.crew = crewA.name;
  if (crewB) params.other = crewB.name;
  return params;
}

export function EventDialog({ state }: { state: GameState }) {
  const dispatch = useGame((s) => s.dispatch);
  const pauseOn = useSettings((s) => s.pauseOnIncident);
  const ev = state.events.active;
  if (!ev) return null;
  const def = EVENT_BY_ID[ev.defId];
  if (!def) return null;
  const params = eventParams(state, ev);
  const tone: StatusTone = def.severity === 'critical' ? 'critical' : def.severity === 'warning' ? 'warn' : 'info';
  const left = Math.max(0, Math.ceil(EVENT_AUTO_RESOLVE_SECONDS - (state.time - ev.startedAt)));
  return (
    <Dialog visible title={t(`event.${def.id}.title`)} label={t('event.title')} icon={def.severity === 'info' ? 'info' : 'warning'} tone={tone} dismissable={false}>
      <Text color={colors.textDim}>{t(`event.${def.id}.body`, params)}</Text>
      <Label color={colors.textFaint}>{pauseOn ? t('event.decide') : t('event.autoIn', { n: left })}</Label>
      <View style={{ gap: space.sm }}>
        {def.choices.map((c) => {
          const blocked = choiceBlocked(state, ev, c);
          return (
            <Pressable
              key={c.id}
              disabled={!!blocked}
              accessibilityRole="button"
              accessibilityLabel={`${t(`event.${def.id}.${c.id}`, params)}. ${t(`event.${def.id}.${c.id}Desc`, params)}`}
              accessibilityState={{ disabled: !!blocked }}
              onPress={() => dispatch({ type: 'ResolveEvent', choiceId: c.id })}
              style={({ pressed }) => [styles.choice, pressed && { backgroundColor: colors.panelPressed }, blocked && { opacity: 0.45 }, c.id === def.defaultChoice && { borderColor: colors.cyanDeep }]}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="bodyStrong">{t(`event.${def.id}.${c.id}`, params)}</Text>
                <Text variant="small" color={colors.textDim}>{t(`event.${def.id}.${c.id}Desc`, params)}</Text>
                {blocked ? <Text variant="caption" color={colors.amber}>{t(blocked)}</Text> : null}
                {c.major ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Icon name="echo" size={12} color={colors.violet} />
                    <Text variant="caption" color={colors.violet}>{t('event.major')}</Text>
                  </View>
                ) : null}
              </View>
              <Icon name="chevron" size={18} color={colors.textFaint} />
            </Pressable>
          );
        })}
      </View>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  choice: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.lineStrong, backgroundColor: colors.panelRaised, minHeight: 56 },
});
