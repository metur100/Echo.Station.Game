import { router } from 'expo-router';
import { useEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { audio } from '../audio/audio';
import { Icon } from '../components/Icon';
import { Starfield } from '../components/Starfield';
import { Button, Label, Text } from '../components/ui';
import { dominantPath } from '../game/systems/progression';
import { t } from '../i18n';
import { useGame } from '../state/gameStore';
import { colors, space } from '../theme/tokens';

const COLOR = { clean_return: colors.cyan, garden_ship: colors.green, remembering: colors.violet } as const;

export default function Ending() {
  const insets = useSafeAreaInsets();
  const s = useGame((x) => x.snapshot);
  useEffect(() => {
    audio.play('mission');
  }, []);
  if (!s?.ending) return <View style={styles.root} />;
  const id = s.ending.id;
  const c = COLOR[id];
  const acknowledge = () => useGame.getState().dispatch({ type: 'AcknowledgeEnding' }, { silent: true });
  return (
    <View style={styles.root}>
      <Starfield seed={42} />
      <ScrollView contentContainerStyle={[styles.inner, { paddingTop: insets.top + space.xxl, paddingBottom: insets.bottom + space.xl }]}>
        <Animated.View entering={FadeIn.duration(1200)} style={{ alignItems: 'center', gap: space.md }}>
          <Icon name="ark" size={64} color={c} strokeWidth={1.3} />
          <Label color={c}>{t('ending.title')}</Label>
          <Text variant="hero" center>{t(`ending.${id}.title`)}</Text>
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(600).duration(800)} style={{ gap: space.lg }}>
          <Text variant="heading" style={{ fontSize: 19, lineHeight: 30 }} color={colors.text}>{t(`ending.${id}.body`)}</Text>
          <Text color={c}>{t('ending.path', { path: dominantPath(s) })}</Text>
          <Text variant="small" color={colors.textDim}>{t('ending.replay')}</Text>
          <Button label={t('ending.continue')} icon="play" variant="primary" onPress={() => { acknowledge(); router.back(); }} />
          <Button label={t('ending.menu')} icon="home" variant="ghost" onPress={async () => { acknowledge(); await useGame.getState().save(); useGame.getState().unload(); router.replace('/menu'); }} />
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg0 },
  inner: { flexGrow: 1, justifyContent: 'space-between', paddingHorizontal: space.xl, gap: space.xxl, maxWidth: 620, width: '100%', alignSelf: 'center' },
});
