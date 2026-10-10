import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Icon } from '../components/Icon';
import type { IconName } from '../components/icons';
import { Screen } from '../components/Screen';
import { Text } from '../components/ui';
import { t } from '../i18n';
import { colors, radius, space } from '../theme/tokens';

const TOPICS: { id: string; icon: IconName; color: string }[] = [
  { id: 'camera', icon: 'target', color: colors.cyan },
  { id: 'power', icon: 'bolt', color: colors.amber },
  { id: 'life', icon: 'oxygen', color: colors.teal },
  { id: 'heat', icon: 'heat', color: colors.orange },
  { id: 'crew', icon: 'crew', color: colors.cyan },
  { id: 'build', icon: 'build', color: colors.amber },
  { id: 'echo', icon: 'echo', color: colors.violet },
  { id: 'anomaly', icon: 'bloom', color: colors.violet },
  { id: 'missions', icon: 'map', color: colors.cyan },
];

/** Tutorial reference: how every system works, in plain words. */
export default function Manual() {
  const [open, setOpen] = useState<string>('camera');
  return (
    <Screen title={t('manual.title')}>
      {TOPICS.map((x) => {
        const on = open === x.id;
        return (
          <Pressable key={x.id} onPress={() => setOpen(on ? '' : x.id)} accessibilityRole="button" accessibilityState={{ expanded: on }} style={[styles.card, on && { borderColor: x.color }]}>
            <View style={styles.head}>
              <View style={[styles.icon, { borderColor: x.color, backgroundColor: `${x.color}18` }]}>
                <Icon name={x.icon} size={20} color={x.color} />
              </View>
              <Text variant="bodyStrong" style={{ flex: 1 }}>{t(`manual.${x.id}.title`)}</Text>
              <Icon name="chevron" size={16} color={colors.textFaint} />
            </View>
            {on ? (
              <Animated.View entering={FadeIn.duration(200)}>
                <Text color={colors.textDim} style={{ marginTop: space.md }}>{t(`manual.${x.id}.body`)}</Text>
              </Animated.View>
            ) : null}
          </Pressable>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { padding: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  icon: { width: 38, height: 38, borderRadius: radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
