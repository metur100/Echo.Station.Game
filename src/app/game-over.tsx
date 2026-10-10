import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '../components/Icon';
import { Starfield } from '../components/Starfield';
import { Button, Label, Panel, Text } from '../components/ui';
import { t } from '../i18n';
import { useGame } from '../state/gameStore';
import { colors, space } from '../theme/tokens';

export default function GameOver() {
  const insets = useSafeAreaInsets();
  const s = useGame((x) => x.snapshot);
  const slot = useGame((x) => x.slot);
  const reason = s?.gameOver?.reason ?? 'hull_failure';
  return (
    <View style={styles.root}>
      <Starfield seed={99} dim={0.5} />
      <View style={[styles.inner, { paddingTop: insets.top + space.xxl, paddingBottom: insets.bottom + space.xl }]}>
        <Animated.View entering={FadeIn.duration(800)} style={{ alignItems: 'center', gap: space.md }}>
          <Icon name="critical" size={64} color={colors.danger} strokeWidth={1.4} />
          <Text variant="hero" center>{t('gameover.title')}</Text>
          <Text color={colors.textDim} center>{t(`gameover.${reason}`)}</Text>
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(300).duration(500)} style={{ gap: space.md }}>
          <Panel tone="warn">
            <Label color={colors.amber}>{t('gameover.recover')}</Label>
            <Text variant="small" color={colors.textDim} style={{ marginTop: space.xs }}>{t('gameover.recoverDesc')}</Text>
            <Button
              label={t('gameover.recover')}
              icon="recovery"
              variant="warning"
              style={{ marginTop: space.md }}
              onPress={() => {
                const r = useGame.getState().dispatch({ type: 'EmergencyRecovery' });
                if (r?.ok) router.back();
              }}
            />
          </Panel>
          <Button
            label={t('gameover.load')}
            icon="save"
            onPress={async () => {
              const r = await useGame.getState().load(slot);
              if (r.ok && !r.state.gameOver) router.back();
            }}
          />
          <Button
            label={t('gameover.menu')}
            icon="home"
            variant="ghost"
            onPress={() => {
              useGame.getState().unload();
              router.replace('/menu');
            }}
          />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg0 },
  inner: { flex: 1, justifyContent: 'space-between', paddingHorizontal: space.xl, maxWidth: 560, width: '100%', alignSelf: 'center' },
});
