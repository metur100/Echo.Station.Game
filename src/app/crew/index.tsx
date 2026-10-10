import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { NoGame } from '../../components/NoGame';
import { Portrait } from '../../components/Portrait';
import { Screen } from '../../components/Screen';
import { Bar, Label, Pill, Row, Text } from '../../components/ui';
import { crewCapacity } from '../../game/systems/resources';
import { taskLine } from '../../components/crewText';
import { t } from '../../i18n';
import { useGame } from '../../state/gameStore';
import { colors, radius, space } from '../../theme/tokens';

export default function CrewRoster() {
  const s = useGame((x) => x.snapshot);
  if (!s) return <NoGame title={t('crew.title')} />;
  const bunks = crewCapacity(s);
  return (
    <Screen title={t('crew.title')} label={`${s.crew.length} · ${t('module.quarters.name')} ${bunks}`}>
      {s.crew.map((c) => (
        <Pressable
          key={c.id}
          onPress={() => router.push({ pathname: '/crew/[id]', params: { id: c.id } })}
          accessibilityRole="button"
          accessibilityLabel={`${c.name}, ${t(`crew.role.${c.role}`)}, ${taskLine(s, c)}`}
          style={({ pressed }) => [styles.card, pressed && { backgroundColor: colors.panelPressed }]}
        >
          <Portrait id={c.portrait} size={72} dimmed={c.incapacitated || c.away} />
          <View style={{ flex: 1, gap: 6 }}>
            <View>
              <Text variant="bodyStrong">{c.name}</Text>
              <Label color={colors.cyan}>{t(`crew.role.${c.role}`)}</Label>
            </View>
            <Pill text={taskLine(s, c)} tone={c.incapacitated ? 'critical' : c.away ? 'info' : c.task === 'rest' ? 'muted' : 'ok'} icon={c.away ? 'mission' : 'crew'} />
            <Row gap={space.sm}>
              <Stat label={t('crew.health')} value={c.health} color={c.health < 30 ? colors.danger : colors.success} />
              <Stat label={t('crew.morale')} value={c.morale} color={c.morale < 35 ? colors.amber : colors.cyan} />
              <Stat label={t('crew.fatigue')} value={c.fatigue} color={c.fatigue > 70 ? colors.amber : colors.teal} invert />
            </Row>
          </View>
        </Pressable>
      ))}
    </Screen>
  );
}

function Stat({ label, value, color, invert }: { label: string; value: number; color: string; invert?: boolean }) {
  return (
    <View style={{ flex: 1, gap: 3 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text variant="caption" color={colors.textFaint}>{label}</Text>
        <Text variant="caption" color={colors.textDim}>{Math.round(value)}</Text>
      </Row>
      <Bar value={invert ? value : value} color={color} height={4} label={label} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', gap: space.md, padding: space.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, alignItems: 'center' },
});
