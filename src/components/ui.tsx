/**
 * Design-system primitives. Screens compose these instead of styling raw RN components.
 */
import { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text as RNText, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { audio } from '../audio/audio';
import { haptic } from '../audio/haptics';
import { t } from '../i18n';
import { useSettings } from '../state/settingsStore';
import { colors, radius, space, toneColor, touch, type as typeScale, type StatusTone } from '../theme/tokens';
import { Icon } from './Icon';
import type { IconName } from './icons';

type Variant = keyof typeof typeScale;

export function Text({ variant = 'body', color = colors.text, style, children, numberOfLines, center, accessibilityRole }: {
  variant?: Variant;
  color?: string;
  style?: StyleProp<TextStyle>;
  children: ReactNode;
  numberOfLines?: number;
  center?: boolean;
  accessibilityRole?: 'header' | 'text';
}) {
  const large = useSettings((s) => s.largeText);
  const base = typeScale[variant] as TextStyle;
  const scale = large ? 1.15 : 1;
  return (
    <RNText
      accessibilityRole={accessibilityRole}
      numberOfLines={numberOfLines}
      maxFontSizeMultiplier={1.4}
      style={[base, { color, fontSize: (base.fontSize ?? 15) * scale, lineHeight: (base.lineHeight ?? 20) * scale }, center && { textAlign: 'center' }, style]}
    >
      {children}
    </RNText>
  );
}

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'warning' | 'anomaly';

const BUTTON: Record<ButtonVariant, { bg: string; border: string; fg: string; pressed: string }> = {
  primary: { bg: 'rgba(69, 224, 220, 0.14)', border: colors.cyan, fg: colors.cyan, pressed: 'rgba(69, 224, 220, 0.26)' },
  secondary: { bg: colors.panelRaised, border: colors.lineStrong, fg: colors.text, pressed: colors.panelPressed },
  ghost: { bg: 'transparent', border: 'transparent', fg: colors.textDim, pressed: 'rgba(255,255,255,0.05)' },
  danger: { bg: 'rgba(255, 88, 102, 0.12)', border: colors.danger, fg: colors.danger, pressed: 'rgba(255, 88, 102, 0.24)' },
  warning: { bg: 'rgba(255, 181, 71, 0.12)', border: colors.amber, fg: colors.amber, pressed: 'rgba(255, 181, 71, 0.24)' },
  anomaly: { bg: 'rgba(154, 132, 240, 0.13)', border: colors.violet, fg: colors.violet, pressed: 'rgba(154, 132, 240, 0.26)' },
};

export function Button({ label, onPress, variant = 'secondary', icon, disabled, style, small, accessibilityHint, sound = 'tap', full }: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  small?: boolean;
  accessibilityHint?: string;
  sound?: 'tap' | 'select' | null;
  full?: boolean;
}) {
  const v = BUTTON[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={() => {
        if (sound) audio.play(sound);
        haptic('light');
        onPress();
      }}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        full && { alignSelf: 'stretch' },
        { backgroundColor: pressed ? v.pressed : v.bg, borderColor: v.border, opacity: disabled ? 0.4 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
        style,
      ]}
    >
      {icon ? <Icon name={icon} size={small ? 16 : 18} color={v.fg} /> : null}
      <Text variant={small ? 'smallStrong' : 'bodyStrong'} color={v.fg} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export function IconButton({ icon, label, onPress, active, tone, size = touch, badge, disabled, style }: {
  icon: IconName;
  label: string;
  onPress: () => void;
  active?: boolean;
  tone?: StatusTone;
  size?: number;
  badge?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const color = tone ? toneColor[tone] : active ? colors.cyan : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!active, disabled: !!disabled }}
      disabled={disabled}
      hitSlop={6}
      onPress={() => {
        audio.play('tap');
        haptic('light');
        onPress();
      }}
      style={({ pressed }) => [
        styles.iconButton,
        { width: size, height: size, borderColor: active ? colors.cyan : colors.line, backgroundColor: pressed ? colors.panelPressed : active ? 'rgba(69,224,220,0.12)' : colors.panel, opacity: disabled ? 0.4 : 1 },
        style,
      ]}
    >
      <Icon name={icon} size={Math.round(size * 0.46)} color={color} />
      {badge ? <View style={styles.badge} /> : null}
    </Pressable>
  );
}

export function Panel({ children, style, tone, raised, padded = true }: { children: ReactNode; style?: StyleProp<ViewStyle>; tone?: StatusTone; raised?: boolean; padded?: boolean }) {
  return (
    <View style={[styles.panel, raised && { backgroundColor: colors.panelRaised }, tone && { borderColor: toneColor[tone] }, padded && { padding: space.lg }, style]}>
      {children}
    </View>
  );
}

/** Small uppercase system label, e.g. "SYS // POWER" */
export function Label({ children, color = colors.textDim, style }: { children: ReactNode; color?: string; style?: StyleProp<TextStyle> }) {
  return (
    <Text variant="label" color={color} style={style}>
      {children}
    </Text>
  );
}

export function Bar({ value, max = 100, color = colors.cyan, height = 6, style, label }: { value: number; max?: number; color?: string; height?: number; style?: StyleProp<ViewStyle>; label?: string }) {
  const pct = Math.max(0, Math.min(1, max > 0 ? value / max : 0));
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}
      style={[{ height, borderRadius: height, backgroundColor: 'rgba(255,255,255,0.07)', overflow: 'hidden' }, style]}
    >
      <View style={{ width: `${pct * 100}%`, height: '100%', backgroundColor: color, borderRadius: height }} />
    </View>
  );
}

const TONE_ICON: Record<StatusTone, IconName> = { ok: 'check', info: 'info', warn: 'warning', critical: 'critical', anomaly: 'bloom', muted: 'info' };

/** Status pill: always icon + word + colour, never colour alone. */
export function Pill({ text, tone = 'info', icon, style }: { text: string; tone?: StatusTone; icon?: IconName; style?: StyleProp<ViewStyle> }) {
  const c = toneColor[tone];
  return (
    <View style={[styles.pill, { borderColor: c, backgroundColor: `${c}1A` }, style]} accessible accessibilityLabel={text}>
      <Icon name={icon ?? TONE_ICON[tone]} size={13} color={c} strokeWidth={2} />
      <Text variant="caption" color={c} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: colors.lineStrong, marginVertical: space.md }, style]} />;
}

export function Row({ children, gap = space.sm, style, wrap }: { children: ReactNode; gap?: number; style?: StyleProp<ViewStyle>; wrap?: boolean }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, wrap && { flexWrap: 'wrap' }, style]}>{children}</View>;
}

export function Toggle({ label, description, value, onChange, icon }: { label: string; description?: string; value: boolean; onChange: (v: boolean) => void; icon?: IconName }) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      onPress={() => {
        audio.play('tap');
        haptic('select');
        onChange(!value);
      }}
      style={styles.toggleRow}
    >
      {icon ? <Icon name={icon} size={20} color={colors.textDim} /> : null}
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong">{label}</Text>
        {description ? (
          <Text variant="small" color={colors.textDim}>
            {description}
          </Text>
        ) : null}
      </View>
      <View style={[styles.switch, value && { backgroundColor: 'rgba(69,224,220,0.25)', borderColor: colors.cyan }]}>
        <View style={[styles.knob, value && { transform: [{ translateX: 20 }], backgroundColor: colors.cyan }]} />
      </View>
      <Text variant="caption" color={value ? colors.cyan : colors.textFaint} style={{ width: 26 }}>
        {value ? t('common.on') : t('common.off')}
      </Text>
    </Pressable>
  );
}

/** Ten-step value control (accessible alternative to a slider). */
export function Stepper({ label, value, onChange, icon }: { label: string; value: number; onChange: (v: number) => void; icon?: IconName }) {
  const steps = 10;
  const level = Math.round(value * steps);
  const set = (l: number) => {
    audio.play('tap');
    onChange(Math.max(0, Math.min(steps, l)) / steps);
  };
  return (
    <View style={styles.stepper} accessible accessibilityRole="adjustable" accessibilityLabel={label} accessibilityValue={{ min: 0, max: 100, now: level * 10 }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => set(level + (e.nativeEvent.actionName === 'increment' ? 1 : -1))}
    >
      <Row>
        {icon ? <Icon name={icon} size={20} color={colors.textDim} /> : null}
        <Text variant="bodyStrong" style={{ flex: 1 }}>
          {label}
        </Text>
        <Text variant="number" color={colors.cyan}>
          {level * 10}%
        </Text>
      </Row>
      <Row gap={space.sm} style={{ marginTop: space.sm }}>
        <IconButton icon="back" label={`${label} −`} onPress={() => set(level - 1)} size={36} />
        <View style={{ flex: 1, flexDirection: 'row', gap: 3 }}>
          {Array.from({ length: steps }, (_, i) => (
            <Pressable key={i} onPress={() => set(i + 1)} style={{ flex: 1, height: 18, borderRadius: 3, backgroundColor: i < level ? colors.cyan : 'rgba(255,255,255,0.08)' }} accessibilityElementsHidden importantForAccessibility="no" />
          ))}
        </View>
        <IconButton icon="chevron" label={`${label} +`} onPress={() => set(level + 1)} size={36} />
      </Row>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: touch,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  buttonSmall: { minHeight: 36, paddingHorizontal: space.md, borderRadius: radius.sm },
  iconButton: { borderRadius: radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 5, right: 5, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.amber, borderWidth: 1, borderColor: colors.bg0 },
  panel: { backgroundColor: colors.panel, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, borderWidth: 1, alignSelf: 'flex-start' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, minHeight: touch },
  switch: { width: 46, height: 26, borderRadius: 13, borderWidth: 1, borderColor: colors.lineStrong, backgroundColor: 'rgba(255,255,255,0.06)', padding: 2 },
  knob: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.textDim },
  stepper: { paddingVertical: space.md },
});
