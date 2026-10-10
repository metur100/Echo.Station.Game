import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { audio } from '../../audio/audio';
import { haptic } from '../../audio/haptics';
import { t } from '../../i18n';
import { colors, radius } from '../../theme/tokens';
import { Icon } from '../Icon';
import type { IconName } from '../icons';
import { Text } from '../ui';

export type DockItem = 'build' | 'crew' | 'research' | 'missions' | 'echo';

const ITEMS: { id: DockItem; icon: IconName; label: string }[] = [
  { id: 'build', icon: 'build', label: 'hud.build' },
  { id: 'crew', icon: 'crew', label: 'hud.crew' },
  { id: 'research', icon: 'research', label: 'hud.research' },
  { id: 'missions', icon: 'map', label: 'hud.missions' },
  { id: 'echo', icon: 'echo', label: 'hud.echo' },
];

export const Dock = memo(function Dock({ onPress, active, research, crew, echo }: { onPress: (id: DockItem) => void; active?: DockItem | null; research?: boolean; crew?: boolean; echo?: boolean }) {
  const badges: Partial<Record<DockItem, boolean>> = { research, crew, echo };
  return (
    <View style={styles.dock} accessibilityRole="toolbar">
      {ITEMS.map((it) => {
        const on = active === it.id;
        return (
          <Pressable
            key={it.id}
            accessibilityRole="button"
            accessibilityLabel={t(it.label)}
            accessibilityState={{ selected: on }}
            onPress={() => {
              audio.play('tap');
              haptic('light');
              onPress(it.id);
            }}
            style={({ pressed }) => [styles.item, on && styles.itemOn, pressed && { backgroundColor: colors.panelPressed }]}
          >
            <View>
              <Icon name={it.icon} size={22} color={on ? colors.cyan : colors.text} />
              {badges?.[it.id] ? <View style={styles.badge} /> : null}
            </View>
            <Text variant="caption" color={on ? colors.cyan : colors.textDim} numberOfLines={1}>
              {t(it.label)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  dock: { flexDirection: 'row', backgroundColor: colors.panel, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: 4, gap: 4 },
  item: { flex: 1, minHeight: 54, alignItems: 'center', justifyContent: 'center', gap: 3, borderRadius: radius.md },
  itemOn: { backgroundColor: 'rgba(69,224,220,0.12)' },
  badge: { position: 'absolute', top: -2, right: -4, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.amber, borderWidth: 1, borderColor: colors.bg0 },
});
