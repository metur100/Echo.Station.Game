import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInUp, FadeOut, LinearTransition } from 'react-native-reanimated';

import { useGame } from '../state/gameStore';
import { colors, radius, space, toneColor } from '../theme/tokens';
import { Icon } from './Icon';
import type { IconName } from './icons';
import { Text } from './ui';

const ICON: Record<string, IconName> = { ok: 'check', info: 'info', warn: 'warning', critical: 'critical', anomaly: 'echo', muted: 'info' };

export function Toasts({ top }: { top: number }) {
  const toasts = useGame((s) => s.toasts);
  const dismiss = useGame((s) => s.dismissToast);
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { top }]}>
      {toasts.map((x) => (
        <Animated.View key={x.id} entering={FadeInUp.duration(200)} exiting={FadeOut.duration(160)} layout={LinearTransition}>
          <Pressable onPress={() => dismiss(x.id)} style={[styles.toast, { borderColor: toneColor[x.tone] }]} accessibilityRole="alert" accessibilityLiveRegion="polite">
            <Icon name={ICON[x.tone]} size={16} color={toneColor[x.tone]} />
            <Text variant="smallStrong" style={{ flexShrink: 1 }} numberOfLines={2}>
              {x.text}
            </Text>
          </Pressable>
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: space.lg, right: space.lg, alignItems: 'center', gap: space.xs },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    backgroundColor: colors.panelSolid,
    maxWidth: 460,
  },
});
