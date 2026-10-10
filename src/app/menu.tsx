import Constants from 'expo-constants';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { audio } from '../audio/audio';
import { LogoMark } from '../components/Logo';
import { Starfield } from '../components/Starfield';
import { Button, Label, Text } from '../components/ui';
import { GameEngine } from '../game/engine/GameEngine';
import { ShipView } from '../game/rendering/ShipView';
import { formatDuration, t } from '../i18n';
import type { SaveSummary } from '../persistence/saveManager';
import { saveManager, useGame } from '../state/gameStore';
import { useSettings } from '../state/settingsStore';
import { colors, space } from '../theme/tokens';

export default function Menu() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  const lastSlot = useSettings((s) => s.lastSlot);
  const [cont, setCont] = useState<{ slot: 1 | 2 | 3; summary: SaveSummary } | null>(null);
  const [busy, setBusy] = useState(false);

  const showcase = useMemo(() => {
    const e = new GameEngine();
    e.initializeNewGame({ seed: 'menu' });
    e.runTicks(8);
    return e.getSnapshot();
  }, []);

  useFocusEffect(
    useCallback(() => {
      audio.startMusic();
      let alive = true;
      (async () => {
        if (!lastSlot) return setCont(null);
        const p = await saveManager.peek(lastSlot);
        if (alive) setCont(p.status === 'ok' ? { slot: lastSlot, summary: p.summary } : null);
      })();
      return () => {
        alive = false;
      };
    }, [lastSlot]),
  );

  const onContinue = async () => {
    if (!cont || busy) return;
    setBusy(true);
    const r = await useGame.getState().load(cont.slot);
    setBusy(false);
    if (r.ok) router.push('/ship');
    else router.push({ pathname: '/slots', params: { mode: 'load' } });
  };

  const version = Constants.expoConfig?.version ?? '1.0.0';
  const shipInsets = landscape ? { top: 40, bottom: 40, left: width * 0.42, right: 20 } : { top: insets.top + 40, bottom: height * 0.5, left: 10, right: 10 };

  return (
    <View style={styles.root}>
      <Starfield seed={11} />
      <Animated.View entering={FadeIn.duration(900)} style={StyleSheet.absoluteFill} pointerEvents="none">
        <ShipView state={showcase} path="neutral" interactive={false} insets={shipInsets} />
      </Animated.View>
      <View style={[styles.fade, landscape ? styles.fadeSide : styles.fadeBottom]} pointerEvents="none" />
      <View style={[styles.content, landscape ? { width: width * 0.42, paddingLeft: insets.left + space.xxl, justifyContent: 'center' } : { paddingBottom: insets.bottom + space.xl }]}>
        <Animated.View entering={FadeInDown.duration(500)} style={styles.titleBlock}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <LogoMark size={54} />
            <View>
              <Text variant="hero">{t('app.title')}</Text>
              <Label color={colors.cyan}>{t('app.subtitle')}</Label>
            </View>
          </View>
          <Text variant="small" color={colors.textDim} style={{ marginTop: space.sm }}>
            {t('app.tagline')}
          </Text>
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(120).duration(500)} style={styles.buttons}>
          {cont ? (
            <View>
              <Button label={t('menu.continue')} icon="play" variant="primary" onPress={onContinue} disabled={busy} full />
              <Text variant="caption" color={colors.textFaint} center style={{ marginTop: 4 }}>
                {t('menu.continueHint', { slot: cont.slot, chapter: cont.summary.chapter, time: formatDuration(cont.summary.time) })}
              </Text>
            </View>
          ) : null}
          <Button label={t('menu.newGame')} icon="plus" variant={cont ? 'secondary' : 'primary'} onPress={() => router.push({ pathname: '/slots', params: { mode: 'new' } })} full />
          <Button label={t('menu.load')} icon="save" onPress={() => router.push({ pathname: '/slots', params: { mode: 'load' } })} full />
          <View style={styles.row}>
            <Button label={t('menu.manual')} icon="info" onPress={() => router.push('/manual')} style={{ flex: 1 }} small />
            <Button label={t('menu.achievements')} icon="trophy" onPress={() => router.push('/achievements')} style={{ flex: 1 }} small />
          </View>
          <View style={styles.row}>
            <Button label={t('menu.settings')} icon="settings" onPress={() => router.push('/settings')} style={{ flex: 1 }} small />
            <Button label={t('menu.credits')} icon="star" onPress={() => router.push('/credits')} style={{ flex: 1 }} small />
          </View>
          <Text variant="caption" color={colors.textFaint} center>
            {`${t('app.by')} · ${t('menu.version', { version })}`}
          </Text>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg0 },
  fade: { position: 'absolute', backgroundColor: 'rgba(4,7,15,0.0)' },
  fadeBottom: { left: 0, right: 0, bottom: 0, height: '55%', backgroundColor: 'rgba(4,7,15,0.55)' },
  fadeSide: { left: 0, top: 0, bottom: 0, width: '45%', backgroundColor: 'rgba(4,7,15,0.55)' },
  content: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: space.xl, gap: space.xl, maxWidth: 520, width: '100%', alignSelf: 'flex-start' },
  titleBlock: {},
  buttons: { gap: space.md },
  row: { flexDirection: 'row', gap: space.md },
});
