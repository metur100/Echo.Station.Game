import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '../../components/Icon';
import { MODULE_ICON, type IconName } from '../../components/icons';
import { NoGame } from '../../components/NoGame';
import { Portrait } from '../../components/Portrait';
import { Screen } from '../../components/Screen';
import { Bar, Button, Label, Panel, Pill, Row, Text } from '../../components/ui';
import { DESTINATIONS } from '../../game/content/destinations';
import { MODULES } from '../../game/content/modules';
import { needsEmergency } from '../../game/engine/helpers';
import type { CrewTask, GameState } from '../../game/engine/types';
import { workRate } from '../../game/systems/crew';
import { destinationUnlocked } from '../../game/systems/expeditions';
import { formatDuration, t } from '../../i18n';
import { useGame } from '../../state/gameStore';
import { colors, radius, space } from '../../theme/tokens';
import { taskLine } from '../../components/crewText';

const TASKS: { task: CrewTask; icon: IconName }[] = [
  { task: 'repair', icon: 'build' },
  { task: 'research', icon: 'research' },
  { task: 'maintenance', icon: 'eye' },
  { task: 'expedition_prep', icon: 'mission' },
  { task: 'emergency', icon: 'warning' },
  { task: 'rest', icon: 'quarters' },
];

/** Valid targets for a task, with a label and icon. */
function targetsFor(s: GameState, task: CrewTask): { id: string; label: string; icon: IconName; detail: string }[] {
  const mods = Object.values(s.modules).filter((m) => m.buildRemaining <= 0);
  switch (task) {
    case 'repair':
      return mods.filter((m) => m.condition < 100).sort((a, b) => a.condition - b.condition).map((m) => ({ id: m.id, label: t(`module.${m.type}.name`), icon: MODULE_ICON[m.type] as IconName, detail: `${Math.round(m.condition)}%` }));
    case 'maintenance':
      return mods.filter((m) => m.type !== 'corridor').map((m) => ({ id: m.id, label: t(`module.${m.type}.name`), icon: MODULE_ICON[m.type] as IconName, detail: `${Math.round(m.condition)}%` }));
    case 'research':
      return mods.filter((m) => m.type === 'lab').map((m) => ({ id: m.id, label: t('module.lab.name'), icon: 'lab', detail: m.online ? t('module.status.online') : t('module.status.offline') }));
    case 'emergency':
      return [
        ...s.anomalies.map((a) => ({ id: a.id, label: s.discoveredAnomalies.includes(a.kind) ? t(`anomaly.${a.kind}.name`) : t('anomaly.undiscovered'), icon: a.kind as IconName, detail: `${t(`module.${s.modules[a.moduleId]?.type}.name`)} · ${Math.round(a.intensity)}` })),
        ...mods.filter((m) => needsEmergency(m, MODULES[m.type].maxTemp)).map((m) => ({ id: m.id, label: t(`module.${m.type}.name`), icon: 'warning' as IconName, detail: m.breached ? t('inspect.breached') : `${Math.round(m.temperature)}°C` })),
      ];
    case 'expedition_prep':
      return DESTINATIONS.filter((d) => destinationUnlocked(s, d) && (d.repeatable || !(s.expeditions.completed[d.id] ?? 0)) && (s.expeditions.readiness[d.id] ?? 0) < 100).map((d) => ({ id: d.id, label: t(`destination.${d.id}.name`), icon: 'map', detail: `${Math.round(s.expeditions.readiness[d.id] ?? 0)}%` }));
    case 'rest':
      return [];
  }
}

export default function CrewDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const s = useGame((x) => x.snapshot);
  const dispatch = useGame((x) => x.dispatch);
  const [task, setTask] = useState<CrewTask | null>(null);
  if (!s) return <NoGame title={t('crew.title')} />;
  const c = s.crew.find((x) => x.id === id);
  if (!c) return <NoGame title={t('crew.title')} />;
  const targets = task ? targetsFor(s, task) : [];
  const skills = Object.entries(c.skills) as [keyof typeof c.skills, number][];

  return (
    <Screen title={c.name} label={t(`crew.role.${c.role}`)}>
      <Panel>
        <Row gap={space.lg} style={{ alignItems: 'flex-start' }}>
          <Portrait id={c.portrait} size={104} dimmed={c.incapacitated} />
          <View style={{ flex: 1, gap: space.sm }}>
            <Pill text={taskLine(s, c)} tone={c.incapacitated ? 'critical' : c.away ? 'info' : 'ok'} />
            {c.task !== 'rest' && c.taskProgress > 0 ? <Bar value={c.taskProgress} color={colors.cyan} label={t('crew.task')} /> : null}
            <Vital label={t('crew.health')} value={c.health} color={c.health < 30 ? colors.danger : colors.success} />
            <Vital label={t('crew.morale')} value={c.morale} color={c.morale < 35 ? colors.amber : colors.cyan} />
            <Vital label={t('crew.fatigue')} value={c.fatigue} color={c.fatigue > 70 ? colors.amber : colors.teal} />
          </View>
        </Row>
      </Panel>

      <Panel>
        <Label color={colors.cyan}>{t('crew.skills')}</Label>
        <View style={{ gap: space.sm, marginTop: space.sm }}>
          {skills.map(([k, v]) => (
            <Row key={k}>
              <Text variant="small" style={{ width: 110 }}>{t(`crew.skill.${k}`)}</Text>
              <View style={{ flex: 1, flexDirection: 'row', gap: 4 }}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <View key={i} style={[styles.pip, i <= v && { backgroundColor: colors.cyan, borderColor: colors.cyan }]} />
                ))}
              </View>
              <Text variant="caption" color={colors.textDim}>{v}</Text>
            </Row>
          ))}
        </View>
      </Panel>

      <Panel>
        <Label color={colors.amber}>{t('crew.traits')}</Label>
        <View style={{ gap: space.sm, marginTop: space.sm }}>
          {c.traits.map((tr) => (
            <View key={tr}>
              <Text variant="bodyStrong">{t(`trait.${tr}.name`)}</Text>
              <Text variant="small" color={colors.textDim}>{t(`trait.${tr}.desc`)}</Text>
            </View>
          ))}
        </View>
      </Panel>

      {!c.away ? (
        <Panel raised>
          <Label color={colors.cyan}>{t('crew.assign')}</Label>
          <View style={styles.taskGrid}>
            {TASKS.map((x) => {
              const on = task === x.task;
              const current = c.task === x.task;
              return (
                <Pressable
                  key={x.task}
                  disabled={c.incapacitated && x.task !== 'rest'}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={t(`task.${x.task}`)}
                  onPress={() => {
                    if (x.task === 'rest') {
                      dispatch({ type: 'AssignCrewTask', crewId: c.id, task: 'rest', targetId: null });
                      setTask(null);
                    } else setTask(on ? null : x.task);
                  }}
                  style={[styles.task, on && { borderColor: colors.cyan, backgroundColor: 'rgba(69,224,220,0.1)' }, current && { borderColor: colors.success }, c.incapacitated && x.task !== 'rest' && { opacity: 0.4 }]}
                >
                  <Icon name={x.icon} size={20} color={on ? colors.cyan : colors.text} />
                  <Text variant="caption" center numberOfLines={2}>{t(`task.${x.task}`)}</Text>
                  {x.task !== 'rest' ? <Text variant="caption" color={colors.textFaint}>{t('crew.workRate', { pct: Math.round(workRate(c, x.task) * 100) })}</Text> : null}
                </Pressable>
              );
            })}
          </View>
          {task ? (
            <View style={{ gap: space.sm, marginTop: space.md }}>
              <Text variant="small" color={colors.textDim}>{t(`task.${task}.desc`)}</Text>
              <Label>{t('crew.chooseTarget')}</Label>
              {targets.length === 0 ? <Text variant="small" color={colors.textFaint}>{t('crew.noTargets')}</Text> : null}
              {targets.map((x) => (
                <Button
                  key={x.id}
                  label={`${x.label} · ${x.detail}`}
                  icon={x.icon}
                  small
                  variant={c.task === task && c.targetId === x.id ? 'primary' : 'secondary'}
                  onPress={() => {
                    const r = dispatch({ type: 'AssignCrewTask', crewId: c.id, task, targetId: x.id });
                    if (r?.ok) setTask(null);
                  }}
                  style={{ justifyContent: 'flex-start' }}
                />
              ))}
            </View>
          ) : null}
        </Panel>
      ) : null}

      <Panel>
        <Label>{t('crew.history')}</Label>
        <Text color={colors.textDim} style={{ marginTop: space.sm }}>{t(`crew.${c.id}.bio`)}</Text>
      </Panel>

      <Panel>
        <Label color={colors.violet}>{t('crew.memories')}</Label>
        <View style={{ gap: space.sm, marginTop: space.sm }}>
          {[...c.memories].reverse().map((m, i) => (
            <Row key={i} style={{ alignItems: 'flex-start' }}>
              <Icon name="echo" size={14} color={m.morale > 0 ? colors.success : m.morale < 0 ? colors.amber : colors.violet} />
              <View style={{ flex: 1 }}>
                <Text variant="small">{t(m.key, m.params)}</Text>
                <Text variant="caption" color={colors.textFaint}>{`T+${formatDuration(m.time)}${m.morale ? ` · ${t('crew.moraleShift', { n: `${m.morale > 0 ? '+' : ''}${m.morale}` })}` : ''}`}</Text>
              </View>
            </Row>
          ))}
        </View>
      </Panel>
    </Screen>
  );
}

function Vital({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={{ gap: 3 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text variant="caption" color={colors.textDim}>{label}</Text>
        <Text variant="caption">{Math.round(value)}</Text>
      </Row>
      <Bar value={value} color={color} height={5} label={label} />
    </View>
  );
}

const styles = StyleSheet.create({
  pip: { flex: 1, height: 8, borderRadius: 2, borderWidth: 1, borderColor: colors.lineStrong },
  taskGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm },
  task: { width: '31%', minWidth: 96, flexGrow: 1, minHeight: 82, padding: space.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, alignItems: 'center', justifyContent: 'center', gap: 3 },
});
