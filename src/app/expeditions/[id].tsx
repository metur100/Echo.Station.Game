import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '../../components/Icon';
import { RESOURCE_ICON } from '../../components/icons';
import { NoGame } from '../../components/NoGame';
import { Portrait } from '../../components/Portrait';
import { Screen } from '../../components/Screen';
import { Bar, Button, Label, Panel, Pill, Row, Text } from '../../components/ui';
import { DESTINATION_BY_ID } from '../../game/content/destinations';
import type { ResourceId } from '../../game/engine/types';
import { workRate } from '../../game/systems/crew';
import { destinationUnlocked, expeditionCost, expeditionDuration, expeditionRisk, launchError } from '../../game/systems/expeditions';
import { formatDuration, t } from '../../i18n';
import { useGame } from '../../state/gameStore';
import { accentColor, colors, radius, space } from '../../theme/tokens';

export default function MissionDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const s = useGame((x) => x.snapshot);
  const dispatch = useGame((x) => x.dispatch);
  const [crew, setCrew] = useState<string[]>([]);
  if (!s) return <NoGame title={t('expedition.title')} />;
  const d = id ? DESTINATION_BY_ID[id] : undefined;
  if (!d) return <NoGame title={t('expedition.title')} />;
  const open = destinationUnlocked(s, d);
  const accent = accentColor[d.accent];
  const readiness = s.expeditions.readiness[d.id] ?? 0;
  const cost = expeditionCost(s, d);
  const risk = expeditionRisk(s, d, crew);
  const error = launchError(s, d.id, crew);
  const preparing = s.crew.filter((c) => c.task === 'expedition_prep' && c.targetId === d.id);
  const visits = s.expeditions.completed[d.id] ?? 0;
  const done = !d.repeatable && visits > 0;
  const toggle = (cid: string) => setCrew((cur) => (cur.includes(cid) ? cur.filter((x) => x !== cid) : cur.length >= d.crewMax ? cur : [...cur, cid]));

  const lockReason = !open
    ? [...d.requiresResearch.filter((r) => !s.research.completed.includes(r)).map((r) => t('expedition.lockedResearch', { name: t(`research.${r}.name`) })), ...d.requiresCompleted.filter((c) => !(s.expeditions.completed[c] ?? 0)).map((c) => t('expedition.lockedVisit', { name: t(`destination.${c}.name`) }))]
    : [];

  return (
    <Screen title={t(`destination.${d.id}.name`)} label={d.final ? t('expedition.final') : t('hud.chapter', { chapter: d.chapter })}>
      <Panel style={{ borderColor: accent }}>
        <Text>{t(`destination.${d.id}.desc`)}</Text>
        <Row style={{ marginTop: space.sm }}>
          <Icon name="warning" size={14} color={colors.amber} />
          <Text variant="small" color={colors.amber} style={{ flex: 1 }}>{t(`destination.${d.id}.constraint`)}</Text>
        </Row>
        {visits ? <Pill text={t('expedition.visited', { n: visits })} tone="ok" style={{ marginTop: space.sm }} /> : null}
      </Panel>

      {lockReason.length ? (
        <Panel>
          <Label>{t('expedition.locked')}</Label>
          {lockReason.map((r) => <Text key={r} variant="small" color={colors.amber}>{`• ${r}`}</Text>)}
        </Panel>
      ) : null}

      <View style={styles.facts}>
        <Fact label={t('expedition.duration')} value={formatDuration(expeditionDuration(s, d))} icon="clock" />
        <Fact label={t('expedition.risk')} value={`${Math.round(risk * 100)}%`} icon="warning" tone={risk > 0.4 ? colors.danger : risk > 0.25 ? colors.amber : colors.success} />
        <Fact label={t('expedition.crew', { min: d.crewMin, max: d.crewMax })} value={`${crew.length}`} icon="crew" />
      </View>

      <Panel>
        <Label>{t('common.cost')}</Label>
        <Row wrap gap={space.md} style={{ marginTop: space.sm }}>
          {(Object.entries(cost) as [ResourceId, number][]).map(([r, v]) => (
            <Row key={r} gap={4}>
              <Icon name={RESOURCE_ICON[r]} size={14} color={s.resources[r] >= v ? colors.textDim : colors.danger} />
              <Text variant="smallStrong" color={s.resources[r] >= v ? colors.text : colors.danger}>{`${v}`}</Text>
            </Row>
          ))}
        </Row>
        <Label style={{ marginTop: space.md }}>{t('common.reward')}</Label>
        <Row wrap gap={space.md} style={{ marginTop: space.sm }}>
          {Object.entries(d.rewards).filter(([r]) => r !== 'xp').map(([r, v]) => (
            <Row key={r} gap={4}>
              <Icon name={RESOURCE_ICON[r]} size={14} color={colors.success} />
              <Text variant="smallStrong" color={colors.success}>{`+${Math.round((v as number) * (visits ? d.repeatYield : 1))}`}</Text>
            </Row>
          ))}
          <Text variant="smallStrong" color={colors.violet}>{`+${d.rewards.xp} XP`}</Text>
        </Row>
        {d.repeatable && visits ? <Text variant="caption" color={colors.textFaint} style={{ marginTop: 4 }}>{t('expedition.repeatable', { pct: Math.round(d.repeatYield * 100) })}</Text> : null}
        {d.introduces && !visits ? <Text variant="caption" color={colors.violet} style={{ marginTop: 4 }}>{t('expedition.introduces')}</Text> : null}
      </Panel>

      {open && !done ? (
        <Panel raised>
          <Row style={{ justifyContent: 'space-between' }}>
            <Label color={colors.teal}>{t('expedition.readiness')}</Label>
            <Text variant="number" color={readiness >= 100 ? colors.success : colors.text}>{`${Math.floor(readiness)}%`}</Text>
          </Row>
          <Bar value={readiness} color={readiness >= 100 ? colors.success : colors.teal} style={{ marginTop: space.sm }} />
          {preparing.length ? <Text variant="caption" color={colors.textDim} style={{ marginTop: 4 }}>{preparing.map((c) => c.name).join(', ')}</Text> : null}
          {readiness < 100 ? (
            <View style={{ gap: space.xs, marginTop: space.md }}>
              <Label>{t('expedition.prepare')}</Label>
              {s.crew.filter((c) => !c.away && !c.incapacitated).map((c) => (
                <Button
                  key={c.id}
                  small
                  icon="mission"
                  variant={c.task === 'expedition_prep' && c.targetId === d.id ? 'primary' : 'secondary'}
                  label={`${c.name} · ${t('crew.workRate', { pct: Math.round(workRate(c, 'expedition_prep') * 100) })}`}
                  onPress={() => dispatch({ type: 'AssignCrewTask', crewId: c.id, task: 'expedition_prep', targetId: d.id })}
                  style={{ justifyContent: 'flex-start' }}
                />
              ))}
            </View>
          ) : null}
        </Panel>
      ) : null}

      {open && !done && !s.expeditions.active ? (
        <Panel>
          <Label>{t('expedition.selectCrew')}</Label>
          <View style={{ gap: space.xs, marginTop: space.sm }}>
            {s.crew.filter((c) => !c.away).map((c) => {
              const on = crew.includes(c.id);
              const unavailable = c.incapacitated || c.health < 30;
              return (
                <Pressable
                  key={c.id}
                  disabled={unavailable}
                  onPress={() => toggle(c.id)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on, disabled: unavailable }}
                  accessibilityLabel={c.name}
                  style={[styles.crew, on && { borderColor: colors.cyan, backgroundColor: 'rgba(69,224,220,0.08)' }, unavailable && { opacity: 0.4 }]}
                >
                  <Portrait id={c.portrait} size={40} />
                  <View style={{ flex: 1 }}>
                    <Text variant="smallStrong">{c.name}</Text>
                    <Text variant="caption" color={colors.textDim}>{`${t('crew.skill.piloting')} ${c.skills.piloting} · ${t('crew.health')} ${Math.round(c.health)} · ${t('crew.fatigue')} ${Math.round(c.fatigue)}`}</Text>
                  </View>
                  <Icon name={on ? 'check' : 'plus'} size={18} color={on ? colors.cyan : colors.textFaint} />
                </Pressable>
              );
            })}
          </View>
          {error && crew.length ? <Text variant="small" color={colors.amber} style={{ marginTop: space.sm }}>{t(`expedition.error.${error}`)}</Text> : null}
          <Button
            label={t('expedition.launch')}
            icon="mission"
            variant="primary"
            disabled={!!error}
            style={{ marginTop: space.md }}
            onPress={() => {
              const r = dispatch({ type: 'StartExpedition', destinationId: d.id, crewIds: crew });
              if (r?.ok) router.back();
            }}
          />
        </Panel>
      ) : null}
    </Screen>
  );
}

function Fact({ label, value, icon, tone }: { label: string; value: string; icon: 'clock' | 'warning' | 'crew'; tone?: string }) {
  return (
    <View style={styles.fact}>
      <Icon name={icon} size={16} color={tone ?? colors.textDim} />
      <Text variant="number" color={tone ?? colors.text}>{value}</Text>
      <Text variant="caption" color={colors.textFaint} center>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  facts: { flexDirection: 'row', gap: space.sm },
  fact: { flex: 1, alignItems: 'center', gap: 4, padding: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel },
  crew: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, minHeight: 52 },
});
