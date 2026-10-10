import { Pressable, StyleSheet, View } from 'react-native';

import { workRate } from '../../game/systems/crew';
import type { CrewTask, GameState } from '../../game/engine/types';
import { t } from '../../i18n';
import { useGame } from '../../state/gameStore';
import { colors, radius, space } from '../../theme/tokens';
import { Portrait } from '../Portrait';
import { Bar, Label, Row, Text } from '../ui';

/** Choose who does a task: aboard crew sorted by how well they would do it. */
export function CrewPicker({ state, task, targetId, onDone }: { state: GameState; task: CrewTask; targetId: string; onDone?: () => void }) {
  const dispatch = useGame((s) => s.dispatch);
  const crew = state.crew
    .filter((c) => !c.away)
    .map((c) => ({ c, rate: c.incapacitated ? 0 : workRate(c, task) }))
    .sort((a, b) => b.rate - a.rate);
  if (!crew.length) return <Text variant="small" color={colors.textDim}>{t('inspect.noCrewFree')}</Text>;
  return (
    <View style={{ gap: space.xs }}>
      <Label>{t('inspect.pickCrew')}</Label>
      {crew.map(({ c, rate }) => {
        const busyHere = c.task === task && c.targetId === targetId;
        return (
          <Pressable
            key={c.id}
            disabled={c.incapacitated || busyHere}
            accessibilityRole="button"
            accessibilityLabel={`${c.name}, ${t(`task.${c.task}`)}, ${t('crew.workRate', { pct: Math.round(rate * 100) })}`}
            onPress={() => {
              const r = dispatch({ type: 'AssignCrewTask', crewId: c.id, task, targetId });
              if (r?.ok) onDone?.();
            }}
            style={({ pressed }) => [styles.row, busyHere && { borderColor: colors.cyan }, pressed && { backgroundColor: colors.panelPressed }, c.incapacitated && { opacity: 0.45 }]}
          >
            <Portrait id={c.portrait} size={36} dimmed={c.incapacitated} />
            <View style={{ flex: 1, gap: 2 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text variant="smallStrong" numberOfLines={1}>{c.name}</Text>
                <Text variant="caption" color={colors.cyan}>{t('crew.workRate', { pct: Math.round(rate * 100) })}</Text>
              </Row>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text variant="caption" color={colors.textDim}>{c.incapacitated ? t('crew.incapacitated') : t(`task.${c.task}`)}</Text>
                <View style={{ width: 70 }}>
                  <Bar value={100 - c.fatigue} color={c.fatigue > 70 ? colors.amber : colors.teal} height={4} label={t('crew.fatigue')} />
                </View>
              </Row>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panelRaised, minHeight: 52 },
});
