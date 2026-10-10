import { StyleSheet, View } from 'react-native';

import { Icon } from '../components/Icon';
import { ACHIEVEMENT_ICON } from '../components/icons';
import { Screen } from '../components/Screen';
import { Bar, Text } from '../components/ui';
import { ACHIEVEMENTS } from '../game/content/achievements';
import { formatDuration, t } from '../i18n';
import { useGame } from '../state/gameStore';
import { colors, radius, space } from '../theme/tokens';

export default function Achievements() {
  const s = useGame((x) => x.snapshot);
  const unlocked = s ? ACHIEVEMENTS.filter((a) => s.achievements[a.id] !== undefined).length : 0;
  return (
    <Screen title={t('achievements.title')} label={t('achievements.progress', { n: unlocked, total: ACHIEVEMENTS.length })}>
      {!s ? <Text color={colors.textDim}>{t('achievements.noGame')}</Text> : <Bar value={unlocked} max={ACHIEVEMENTS.length} color={colors.violet} />}
      <View style={styles.grid}>
        {ACHIEVEMENTS.map((a) => {
          const at = s?.achievements[a.id];
          const got = at !== undefined;
          return (
            <View key={a.id} style={[styles.card, got && { borderColor: colors.violet, backgroundColor: 'rgba(154,132,240,0.08)' }]} accessible accessibilityLabel={`${t(`achievement.${a.id}.name`)}: ${got ? t('common.completed') : t('achievements.hidden')}`}>
              <View style={[styles.icon, got && { borderColor: colors.violet }]}>
                <Icon name={got ? ACHIEVEMENT_ICON[a.icon] ?? 'star' : 'lock'} size={22} color={got ? colors.violet : colors.textFaint} />
              </View>
              <Text variant="smallStrong" color={got ? colors.text : colors.textDim}>{t(`achievement.${a.id}.name`)}</Text>
              <Text variant="caption" color={colors.textDim}>{t(`achievement.${a.id}.desc`)}</Text>
              {got ? <Text variant="caption" color={colors.violet}>{`T+${formatDuration(at)}`}</Text> : null}
            </View>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  card: { width: '48%', flexGrow: 1, minWidth: 150, padding: space.md, gap: 4, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel },
  icon: { width: 40, height: 40, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
});
