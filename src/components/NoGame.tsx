import { router } from 'expo-router';

import { t } from '../i18n';
import { colors } from '../theme/tokens';
import { Screen } from './Screen';
import { Button, Text } from './ui';

/** Shown by in-game screens when no voyage is loaded (e.g. after a deep link). */
export function NoGame({ title }: { title: string }) {
  return (
    <Screen title={title}>
      <Text color={colors.textDim}>{t('achievements.noGame')}</Text>
      <Button label={t('menu.continue')} variant="primary" onPress={() => router.replace('/menu')} />
    </Screen>
  );
}
