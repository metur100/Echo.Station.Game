/**
 * Boot screen: shown after the native splash while the ship "wakes". Three status lines, the
 * mark, then the main menu. Tapping skips it.
 */
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { LogoMark } from '../components/Logo';
import { Starfield } from '../components/Starfield';
import { Text } from '../components/ui';
import { t } from '../i18n';
import { colors, space } from '../theme/tokens';

export default function Boot() {
  const [line, setLine] = useState(0);
  useEffect(() => {
    const timers = [setTimeout(() => setLine(1), 450), setTimeout(() => setLine(2), 900), setTimeout(() => setLine(3), 1350), setTimeout(() => router.replace('/menu'), 2000)];
    return () => timers.forEach(clearTimeout);
  }, []);
  return (
    <Pressable style={styles.root} onPress={() => router.replace('/menu')} accessibilityLabel={t('common.skip')}>
      <Starfield />
      <Animated.View entering={FadeIn.duration(500)} style={styles.center}>
        <LogoMark size={132} />
        <Text variant="hero" center style={{ marginTop: space.lg }}>
          {t('app.title')}
        </Text>
        <Text variant="label" color={colors.cyan} center>
          {t('app.subtitle')}
        </Text>
      </Animated.View>
      <View style={styles.lines}>
        {['boot.line1', 'boot.line2', 'boot.line3'].slice(0, line).map((k, i) => (
          <Animated.View key={k} entering={FadeInDown.duration(260)}>
            <Text variant="caption" color={i === 2 ? colors.cyan : colors.textDim}>
              {`> ${t(k)}${i < 2 ? ' … OK' : ''}`}
            </Text>
          </Animated.View>
        ))}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg0 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  lines: { position: 'absolute', bottom: 64, left: 0, right: 0, alignItems: 'center', gap: 4, minHeight: 60 },
});
