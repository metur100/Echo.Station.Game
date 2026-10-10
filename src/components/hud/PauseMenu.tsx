import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { formatDuration, formatNumber, t } from '../../i18n';
import type { OfflineSummary } from '../../game/engine/offline';
import { RESOURCE_IDS } from '../../game/engine/types';
import { useGame } from '../../state/gameStore';
import { colors, space } from '../../theme/tokens';
import { Dialog } from '../Dialog';
import { Icon } from '../Icon';
import { RESOURCE_ICON } from '../icons';
import { Button, Pill, Row, Text } from '../ui';

/** `onNavigate` hides the dialog (RN modals sit above every screen) while the game stays paused. */
export function PauseMenu({ visible, onClose, onNavigate }: { visible: boolean; onClose: () => void; onNavigate: () => void }) {
  const save = useGame((s) => s.save);
  const slot = useGame((s) => s.slot);
  const [status, setStatus] = useState<'idle' | 'saved' | 'failed'>('idle');
  const go = (path: '/log' | '/stats' | '/manual' | '/settings' | '/achievements') => {
    onNavigate();
    router.push(path);
  };
  return (
    <Dialog visible={visible} onClose={onClose} title={t('pause.title')} icon="pause" tone="info">
      {status !== 'idle' ? <Pill text={status === 'saved' ? t('pause.saved', { slot }) : t('pause.saveFailed')} tone={status === 'saved' ? 'ok' : 'critical'} /> : null}
      <View style={{ gap: space.sm }}>
        <Button label={t('pause.resume')} icon="play" variant="primary" onPress={onClose} full />
        <Button label={t('pause.save')} icon="save" onPress={async () => setStatus((await save()) ? 'saved' : 'failed')} full />
        <Row gap={space.sm}>
          <Button label={t('pause.log')} icon="log" onPress={() => go('/log')} style={{ flex: 1 }} small />
          <Button label={t('pause.stats')} icon="stats" onPress={() => go('/stats')} style={{ flex: 1 }} small />
        </Row>
        <Row gap={space.sm}>
          <Button label={t('pause.achievements')} icon="trophy" onPress={() => go('/achievements')} style={{ flex: 1 }} small />
          <Button label={t('pause.manual')} icon="info" onPress={() => go('/manual')} style={{ flex: 1 }} small />
        </Row>
        <Button label={t('pause.settings')} icon="settings" onPress={() => go('/settings')} full small />
        <Button
          label={t('pause.quit')}
          icon="home"
          variant="ghost"
          onPress={async () => {
            await save();
            onClose();
            useGame.getState().unload();
            router.replace('/menu');
          }}
          full
        />
      </View>
    </Dialog>
  );
}

export function AwayDialog({ summary, onClose }: { summary: OfflineSummary | null; onClose: () => void }) {
  if (!summary) return null;
  const changed = RESOURCE_IDS.filter((r) => Math.abs(summary.resources[r]) >= 1);
  return (
    <Dialog visible onClose={onClose} title={t('away.title')} icon="clock" tone="info">
      <Text color={colors.textDim}>{t('away.body', { time: formatDuration(summary.seconds) })}</Text>
      {summary.cappedSeconds > 0 ? <Text variant="small" color={colors.amber}>{t('away.capped', { time: formatDuration(summary.seconds) })}</Text> : null}
      {changed.length ? (
        <View style={{ gap: 4 }}>
          <Text variant="label" color={colors.textDim}>{t('away.resources')}</Text>
          <Row wrap gap={space.md}>
            {changed.map((r) => (
              <Row key={r} gap={4}>
                <Icon name={RESOURCE_ICON[r]} size={14} color={colors.textDim} />
                <Text variant="smallStrong" color={summary.resources[r] >= 0 ? colors.success : colors.amber}>{`${summary.resources[r] >= 0 ? '+' : '−'}${formatNumber(Math.abs(summary.resources[r]))}`}</Text>
              </Row>
            ))}
          </Row>
        </View>
      ) : null}
      <View style={{ gap: 2 }}>
        {summary.buildsCompleted ? <Text variant="small">{t('away.builds', { n: summary.buildsCompleted })}</Text> : null}
        {summary.researchCompleted.length ? <Text variant="small">{t('away.research', { names: summary.researchCompleted.map((r) => t(`research.${r}.name`)).join(', ') })}</Text> : null}
        {summary.expeditionReturned ? <Text variant="small">{t('away.expedition', { destination: summary.expeditionReturned })}</Text> : null}
        {summary.incidents ? <Text variant="small">{t('away.incidents', { n: summary.incidents })}</Text> : null}
        {summary.echoesCreated ? <Text variant="small" color={colors.violet}>{t('away.echoes', { n: summary.echoesCreated })}</Text> : null}
        {summary.anomalySpreads ? <Text variant="small" color={colors.amber}>{t('away.spreads', { n: summary.anomalySpreads })}</Text> : null}
      </View>
      <Text variant="caption" color={colors.textFaint}>{t('away.safe')}</Text>
      <Button label={t('common.continue')} variant="primary" onPress={onClose} full />
    </Dialog>
  );
}
