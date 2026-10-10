import { Screen } from '../components/Screen';
import { Divider, Label, Panel, Row, Stepper, Text, Toggle } from '../components/ui';
import { t } from '../i18n';
import { useSettings } from '../state/settingsStore';
import { colors, space } from '../theme/tokens';
import { Icon } from '../components/Icon';

export default function Settings() {
  const s = useSettings();
  return (
    <Screen title={t('settings.title')}>
      <Panel>
        <Label color={colors.cyan}>{t('settings.audio')}</Label>
        <Stepper label={t('settings.music')} icon="music" value={s.music} onChange={(v) => s.update({ music: v })} />
        <Divider style={{ marginVertical: 0 }} />
        <Stepper label={t('settings.sfx')} icon="sound" value={s.sfx} onChange={(v) => s.update({ sfx: v })} />
      </Panel>
      <Panel>
        <Label color={colors.cyan}>{t('settings.gameplay')}</Label>
        <Toggle label={t('settings.pauseOnIncident')} description={t('settings.pauseOnIncidentDesc')} icon="pause" value={s.pauseOnIncident} onChange={(v) => s.update({ pauseOnIncident: v })} />
        <Toggle label={t('settings.offline')} description={t('settings.offlineDesc')} icon="clock" value={s.offlineProgress} onChange={(v) => s.update({ offlineProgress: v })} />
        <Toggle label={t('settings.autosave')} icon="save" value={s.autosave} onChange={(v) => s.update({ autosave: v })} />
      </Panel>
      <Panel>
        <Label color={colors.cyan}>{t('settings.accessibility')}</Label>
        <Toggle label={t('settings.haptics')} icon="vibrate" value={s.haptics} onChange={(v) => s.update({ haptics: v })} />
        <Toggle label={t('settings.reducedMotion')} description={t('settings.reducedMotionDesc')} icon="motion" value={s.reducedMotion} onChange={(v) => s.update({ reducedMotion: v })} />
        <Toggle label={t('settings.largeText')} icon="text" value={s.largeText} onChange={(v) => s.update({ largeText: v })} />
      </Panel>
      <Panel>
        <Row style={{ justifyContent: 'space-between' }}>
          <Row gap={space.md}>
            <Icon name="globe" size={20} color={colors.textDim} />
            <Text variant="bodyStrong">{t('settings.language')}</Text>
          </Row>
          <Text color={colors.textDim}>{t('settings.languageValue')}</Text>
        </Row>
        <Divider />
        <Label>{t('settings.data')}</Label>
        <Text variant="small" color={colors.textDim}>{t('settings.dataDesc')}</Text>
      </Panel>
    </Screen>
  );
}
