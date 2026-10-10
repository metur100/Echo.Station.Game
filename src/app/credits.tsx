import Constants from 'expo-constants';
import { Linking } from 'react-native';

import { LogoMark } from '../components/Logo';
import { Screen } from '../components/Screen';
import { Button, Label, Panel, Row, Text } from '../components/ui';
import { LINKS } from '../constants/links';
import { t } from '../i18n';
import { colors, space } from '../theme/tokens';

const SECTIONS: [string, string][] = [
  ['credits.fonts', 'credits.fontsBody'],
  ['credits.icons', 'credits.iconsBody'],
  ['credits.audio', 'credits.audioBody'],
  ['credits.tech', 'credits.techBody'],
  ['credits.privacy', 'credits.privacyBody'],
];

export default function Credits() {
  return (
    <Screen title={t('credits.title')}>
      <Panel>
        <Row gap={space.lg}>
          <LogoMark size={72} />
          <View0 />
        </Row>
      </Panel>
      {SECTIONS.map(([h, b]) => (
        <Panel key={h}>
          <Label color={colors.cyan}>{t(h)}</Label>
          <Text variant="small" color={colors.textDim} style={{ marginTop: space.xs }}>{t(b)}</Text>
        </Panel>
      ))}
      <Row gap={space.sm} wrap>
        <Button label={t('credits.privacyLink')} icon="external" small onPress={() => Linking.openURL(LINKS.privacy).catch(() => undefined)} />
        <Button label={t('credits.website')} icon="globe" small onPress={() => Linking.openURL(LINKS.website).catch(() => undefined)} />
      </Row>
      <Text variant="caption" color={colors.textFaint}>{t('credits.copyright')}</Text>
      <Text variant="caption" color={colors.textFaint}>{t('credits.notAffiliated')}</Text>
    </Screen>
  );
}

function View0() {
  return (
    <Row style={{ flex: 1 }}>
      <Text variant="heading" style={{ flex: 1 }}>
        {`${t('app.title')}\n`}
        <Text variant="small" color={colors.textDim}>{`${t('credits.design')}: ${t('credits.name')} · v${Constants.expoConfig?.version ?? '1.0.0'}`}</Text>
      </Text>
    </Row>
  );
}
