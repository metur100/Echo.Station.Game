import { type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '../i18n';
import { useSettings } from '../state/settingsStore';
import { colors, radius, space, toneColor, type StatusTone } from '../theme/tokens';
import { Icon } from './Icon';
import type { IconName } from './icons';
import { Button, Label, Text } from './ui';

/** Centered modal card. Used for incidents, confirmations, offline summaries and the pause menu. */
export function Dialog({ visible, onClose, title, label, icon, tone = 'info', children, dismissable = true }: {
  visible: boolean;
  onClose?: () => void;
  title: string;
  label?: string;
  icon?: IconName;
  tone?: StatusTone;
  children: ReactNode;
  dismissable?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const reducedOS = useReducedMotion();
  const reduced = useSettings((s) => s.reducedMotion) || reducedOS;
  const c = toneColor[tone];
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={dismissable ? onClose : undefined} statusBarTranslucent supportedOrientations={['portrait', 'landscape']}>
      <Animated.View entering={reduced ? undefined : FadeIn.duration(180)} exiting={reduced ? undefined : FadeOut.duration(140)} style={styles.scrim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={dismissable ? onClose : undefined} accessibilityLabel={t('common.close')} accessible={dismissable} />
        <Animated.View entering={reduced ? undefined : SlideInDown.springify().damping(18)} style={[styles.card, { borderColor: c, marginTop: insets.top + space.lg, marginBottom: insets.bottom + space.lg }]} accessibilityViewIsModal>
          <View style={[styles.stripe, { backgroundColor: c }]} />
          <ScrollView contentContainerStyle={{ padding: space.xl, gap: space.md }} bounces={false}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              {icon ? (
                <View style={[styles.iconWrap, { borderColor: c, backgroundColor: `${c}1F` }]}>
                  <Icon name={icon} size={22} color={c} />
                </View>
              ) : null}
              <View style={{ flex: 1 }}>
                {label ? <Label color={c}>{label}</Label> : null}
                <Text variant="heading" accessibilityRole="header">
                  {title}
                </Text>
              </View>
            </View>
            {children}
          </ScrollView>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

export function ConfirmDialog({ visible, title, body, confirmLabel, onConfirm, onCancel, danger }: {
  visible: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}) {
  return (
    <Dialog visible={visible} onClose={onCancel} title={title} icon={danger ? 'warning' : 'info'} tone={danger ? 'critical' : 'info'}>
      <Text color={colors.textDim}>{body}</Text>
      <View style={{ flexDirection: 'row', gap: space.md, marginTop: space.sm }}>
        <Button label={t('common.cancel')} onPress={onCancel} style={{ flex: 1 }} />
        <Button label={confirmLabel} onPress={onConfirm} variant={danger ? 'danger' : 'primary'} style={{ flex: 1 }} />
      </View>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: colors.scrim, justifyContent: 'center', paddingHorizontal: space.lg },
  card: { width: '100%', maxWidth: 520, alignSelf: 'center', backgroundColor: colors.panelSolid, borderRadius: radius.lg, borderWidth: 1, overflow: 'hidden', maxHeight: '92%' },
  stripe: { height: 3, opacity: 0.9 },
  iconWrap: { width: 42, height: 42, borderRadius: radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
