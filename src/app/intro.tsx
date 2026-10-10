import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '../components/Icon';
import type { IconName } from '../components/icons';
import { Starfield } from '../components/Starfield';
import { Button, Label, Text } from '../components/ui';
import { t } from '../i18n';
import { colors, radius, space } from '../theme/tokens';

const PAGES: { key: string; icon: IconName; color: string }[] = [
  { key: 'p1', icon: 'map', color: colors.cyan },
  { key: 'p2', icon: 'reactor', color: colors.amber },
  { key: 'p3', icon: 'bloom', color: colors.violet },
  { key: 'p4', icon: 'echo', color: colors.violet },
];

export default function Intro() {
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState(0);
  const p = PAGES[page];
  const last = page === PAGES.length - 1;
  const go = () => (last ? router.replace('/ship') : setPage(page + 1));
  return (
    <View style={styles.root}>
      <Starfield seed={page + 3} />
      <View style={[styles.inner, { paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.xl }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Label color={colors.textFaint}>{`${page + 1} / ${PAGES.length}`}</Label>
          <Button label={t('common.skip')} variant="ghost" small onPress={() => router.replace('/ship')} />
        </View>
        <Animated.View key={p.key} entering={FadeIn.duration(500)} exiting={FadeOut.duration(200)} style={styles.card}>
          <View style={[styles.icon, { borderColor: p.color, backgroundColor: `${p.color}18` }]}>
            <Icon name={p.icon} size={40} color={p.color} strokeWidth={1.5} />
          </View>
          <Label color={p.color}>{t(`intro.${p.key}.title`)}</Label>
          <Text variant="heading" style={{ fontSize: 21, lineHeight: 31 }}>
            {t(`intro.${p.key}.body`)}
          </Text>
        </Animated.View>
        <View style={styles.dots}>
          {PAGES.map((x, i) => (
            <View key={x.key} style={[styles.dot, i === page && { backgroundColor: colors.cyan, width: 22 }]} />
          ))}
        </View>
        <Button label={last ? t('intro.begin') : t('common.next')} variant="primary" icon={last ? 'play' : 'chevron'} onPress={go} full />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg0 },
  inner: { flex: 1, paddingHorizontal: space.xl, justifyContent: 'space-between', maxWidth: 620, width: '100%', alignSelf: 'center' },
  card: { gap: space.lg },
  icon: { width: 76, height: 76, borderRadius: radius.lg, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', gap: 6, justifyContent: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.lineStrong },
});
