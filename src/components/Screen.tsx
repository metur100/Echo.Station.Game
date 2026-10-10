import { router } from 'expo-router';
import { type ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '../i18n';
import { colors, space } from '../theme/tokens';
import { Starfield } from './Starfield';
import { IconButton, Label, Text } from './ui';

/**
 * Standard full screen: starfield backdrop, safe-area aware header with back button, a system
 * label and title, then scrollable content constrained to a readable width on tablets.
 */
export function Screen({ title, label, children, scroll = true, right, onBack, contentStyle, footer }: {
  title: string;
  label?: string;
  children: ReactNode;
  scroll?: boolean;
  right?: ReactNode;
  onBack?: () => void;
  contentStyle?: StyleProp<ViewStyle>;
  footer?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const back = onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/menu')));
  const body = <View style={[styles.content, contentStyle]}>{children}</View>;
  return (
    <View style={styles.root}>
      <Starfield dim={0.6} />
      <View style={[styles.header, { paddingTop: insets.top + space.sm, paddingLeft: insets.left + space.lg, paddingRight: insets.right + space.lg }]}>
        <IconButton icon="back" label={t('common.back')} onPress={back} />
        <View style={{ flex: 1 }}>
          {label ? <Label color={colors.cyan}>{label}</Label> : null}
          <Text variant="title" accessibilityRole="header" numberOfLines={1}>
            {title}
          </Text>
        </View>
        {right}
      </View>
      {scroll ? (
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + space.xxl, paddingLeft: insets.left, paddingRight: insets.right }} showsVerticalScrollIndicator={false}>
          {body}
        </ScrollView>
      ) : (
        <View style={{ flex: 1, paddingBottom: insets.bottom, paddingLeft: insets.left, paddingRight: insets.right }}>{body}</View>
      )}
      {footer ? <View style={[styles.footer, { paddingBottom: insets.bottom + space.md }]}>{footer}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg0 },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingBottom: space.md },
  content: { paddingHorizontal: space.lg, gap: space.lg, width: '100%', maxWidth: 760, alignSelf: 'center' },
  footer: { paddingHorizontal: space.lg, paddingTop: space.md, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.bg1 },
});
