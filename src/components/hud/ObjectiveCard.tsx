import { memo, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { DESTINATION_BY_ID } from '../../game/content/destinations';
import { OBJECTIVES, type ObjectiveDef } from '../../game/content/objectives';
import { RESEARCH_BY_ID } from '../../game/content/research';
import type { GameState } from '../../game/engine/types';
import { currentObjective } from '../../game/systems/progression';
import { formatDuration, t } from '../../i18n';
import { colors, radius, space } from '../../theme/tokens';
import { Icon } from '../Icon';
import { Bar, Button, Label, Pill, Row, Text } from '../ui';

export function ObjectiveCard({ state, onHint }: { state: GameState; onHint: (o: ObjectiveDef) => void }) {
  return <ObjectiveView objectiveId={currentObjective(state)?.id ?? null} onHint={onHint} />;
}

const ObjectiveView = memo(function ObjectiveView({ objectiveId, onHint }: { objectiveId: string | null; onHint: (o: ObjectiveDef) => void }) {
  const [collapsed, setCollapsed] = useState(false);
  const obj = objectiveId ? OBJECTIVES.find((o) => o.id === objectiveId) ?? null : null;
  if (!obj) {
    return (
      <View style={styles.card}>
        <Label color={colors.success}>{t('hud.objective')}</Label>
        <Text variant="small" color={colors.textDim}>{t('hud.campaignDone')}</Text>
      </View>
    );
  }
  return (
    <Animated.View key={obj.id} entering={FadeIn.duration(300)} style={styles.card}>
      <Pressable onPress={() => setCollapsed(!collapsed)} accessibilityRole="button" accessibilityLabel={`${t('hud.objective')}: ${t(`objective.${obj.id}.title`)}`} accessibilityState={{ expanded: !collapsed }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Label color={colors.amber}>{`${t('hud.chapter', { chapter: obj.chapter })} · ${t('hud.objective')}`}</Label>
          <Icon name={collapsed ? 'chevron' : 'close'} size={14} color={colors.textFaint} />
        </Row>
        <Text variant="bodyStrong">{t(`objective.${obj.id}.title`)}</Text>
      </Pressable>
      {!collapsed ? (
        <View style={{ gap: space.sm }}>
          <Text variant="small" color={colors.textDim}>
            {t(`objective.${obj.id}.desc`)}
          </Text>
          {obj.hint.screen || obj.hint.module ? <Button label={t('hud.hint')} icon="target" small variant="warning" onPress={() => onHint(obj)} style={{ alignSelf: 'flex-start' }} /> : null}
        </View>
      ) : null}
    </Animated.View>
  );
});

/** One-line live status: incident, expedition, research, power. */
export function StatusStrip({ state, onIncident }: { state: GameState; onIncident: () => void }) {
  const ex = state.expeditions.active;
  const r = state.research.active;
  return (
    <StatusView
      incident={state.events.active?.defId ?? null}
      expedition={ex ? `${ex.destinationId}:${Math.floor((ex.elapsed / ex.duration) * 100)}` : null}
      research={r ? `${r.id}:${Math.floor((r.progress / r.duration) * 100)}` : null}
      shed={Object.values(state.modules).filter((m) => m.offlineReason === 'no_power').length}
      onIncident={onIncident}
    />
  );
}

const StatusView = memo(function StatusView({ incident, expedition, research, shed, onIncident }: { incident: string | null; expedition: string | null; research: string | null; shed: number; onIncident: () => void }) {
  const items: ReactNode[] = [];
  if (incident) {
    items.push(
      <Pressable key="ev" onPress={onIncident} accessibilityRole="button">
        <Pill text={`${t('hud.incident')}: ${t(`event.${incident}.title`)}`} tone="critical" icon="warning" />
      </Pressable>,
    );
  }
  if (expedition) {
    const [destination, pct] = expedition.split(':');
    items.push(<Pill key="ex" text={t('hud.expedition', { destination, pct })} tone="info" icon="mission" />);
  }
  if (research) {
    const [id, pct] = research.split(':');
    items.push(<Pill key="rs" text={t('hud.researching', { name: t(`research.${id}.name`), pct })} tone="anomaly" icon="research" />);
  }
  if (shed) items.push(<Pill key="pw" text={t('hud.powerShortage', { n: shed })} tone="warn" icon="bolt" />);
  if (!items.length) return null;
  return <View style={styles.strip}>{items}</View>;
});

export function ExpeditionProgress({ state }: { state: GameState }) {
  const ex = state.expeditions.active;
  if (!ex) return null;
  const d = DESTINATION_BY_ID[ex.destinationId];
  return (
    <View>
      <Text variant="caption" color={colors.textDim}>{t('expedition.returnsIn', { time: formatDuration(ex.duration - ex.elapsed) })}</Text>
      <Bar value={ex.elapsed} max={ex.duration} color={colors.cyan} label={d ? t(`destination.${d.id}.name`) : ''} />
    </View>
  );
}

export const researchName = (id: string) => (RESEARCH_BY_ID[id] ? t(`research.${id}.name`) : id);

const styles = StyleSheet.create({
  card: { backgroundColor: colors.panel, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, borderLeftColor: colors.amber, borderLeftWidth: 3, padding: space.md, gap: 4, maxWidth: 420 },
  strip: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});
