import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '../components/Icon';
import type { IconName } from '../components/icons';
import { NoGame } from '../components/NoGame';
import { Screen } from '../components/Screen';
import { Text } from '../components/ui';
import type { LogEntry } from '../game/engine/types';
import { formatDuration, t } from '../i18n';
import { useGame } from '../state/gameStore';
import { colors, radius, space, toneColor } from '../theme/tokens';

type Filter = 'all' | 'incidents' | 'crew' | 'anomaly' | 'story';
const FILTERS: Filter[] = ['all', 'incidents', 'crew', 'anomaly', 'story'];

const match = (f: Filter, e: LogEntry) =>
  f === 'all' ||
  (f === 'incidents' && (e.category === 'event' || e.severity === 'critical')) ||
  (f === 'crew' && (e.category === 'crew' || e.category === 'expedition')) ||
  (f === 'anomaly' && (e.category === 'anomaly' || e.category === 'echo')) ||
  (f === 'story' && (e.category === 'story' || e.category === 'research'));

const ICON: Record<LogEntry['category'], IconName> = {
  event: 'warning',
  system: 'settings',
  crew: 'crew',
  anomaly: 'bloom',
  echo: 'echo',
  research: 'research',
  expedition: 'mission',
  build: 'build',
  story: 'star',
};

const TONE = { info: 'info', success: 'ok', warning: 'warn', critical: 'critical' } as const;

export default function Log() {
  const s = useGame((x) => x.snapshot);
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<Filter>('all');
  if (!s) return <NoGame title={t('log.title')} />;
  const entries = [...s.log].reverse().filter((e) => match(filter, e));
  return (
    <Screen title={t('log.title')} label={`${s.log.length}`} scroll={false}>
      <View style={styles.filters}>
        {FILTERS.map((f) => (
          <Pressable key={f} onPress={() => setFilter(f)} accessibilityRole="tab" accessibilityState={{ selected: filter === f }} style={[styles.filter, filter === f && styles.filterOn]}>
            <Text variant="caption" color={filter === f ? colors.cyan : colors.textDim}>{t(`log.filter.${f}`)}</Text>
          </Pressable>
        ))}
      </View>
      <FlatList
        data={entries}
        keyExtractor={(e) => String(e.id)}
        contentContainerStyle={{ gap: space.xs, paddingBottom: insets.bottom + space.xxl }}
        ListEmptyComponent={<Text color={colors.textDim}>{t('log.empty')}</Text>}
        renderItem={({ item }) => {
          const tone = TONE[item.severity];
          return (
            <View style={[styles.row, item.severity === 'critical' && { borderColor: colors.danger }]}>
              <Icon name={ICON[item.category]} size={16} color={toneColor[tone]} />
              <View style={{ flex: 1 }}>
                <Text variant="small">{t(item.key, item.params)}</Text>
                <Text variant="caption" color={colors.textFaint}>{`T+${formatDuration(item.time)}`}</Text>
              </View>
            </View>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  filter: { paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, minHeight: 36, justifyContent: 'center' },
  filterOn: { borderColor: colors.cyan, backgroundColor: 'rgba(69,224,220,0.1)' },
  row: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start', padding: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel },
});
