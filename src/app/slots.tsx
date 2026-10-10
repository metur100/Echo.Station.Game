import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { ConfirmDialog } from '../components/Dialog';
import { Icon } from '../components/Icon';
import { Screen } from '../components/Screen';
import { Button, Label, Panel, Pill, Row, Text } from '../components/ui';
import { formatDuration, formatWhen, t } from '../i18n';
import { SLOTS, type SaveSummary, type Slot } from '../persistence/saveManager';
import { saveManager, useGame } from '../state/gameStore';
import { colors, space } from '../theme/tokens';

type Peek = { status: 'empty' } | { status: 'corrupt' | 'newer' } | { status: 'ok'; savedAt: number; summary: SaveSummary };

export default function Slots() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const isNew = mode !== 'load';
  const [peeks, setPeeks] = useState<Record<number, Peek>>({});
  const [confirm, setConfirm] = useState<{ slot: Slot; kind: 'overwrite' | 'delete' } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const out: Record<number, Peek> = {};
    for (const s of SLOTS) out[s] = await saveManager.peek(s);
    setPeeks(out);
  }, []);
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const startNew = (slot: Slot) => {
    useGame.getState().startNew(slot);
    router.replace('/intro');
  };
  const load = async (slot: Slot) => {
    const r = await useGame.getState().load(slot);
    if (!r.ok) {
      setError(r.reason === 'newer' ? t('slots.newer') : t('slots.loadFailed'));
      return;
    }
    router.replace('/ship');
  };

  return (
    <Screen title={t('slots.title')} label={isNew ? t('menu.newGame') : t('menu.load')}>
      <Text color={colors.textDim}>{isNew ? t('slots.subtitleNew') : t('slots.subtitleLoad')}</Text>
      {error ? <Pill text={error} tone="critical" /> : null}
      {SLOTS.map((slot) => {
        const p = peeks[slot];
        const ok = p?.status === 'ok';
        return (
          <Panel key={slot} raised={ok} tone={ok ? undefined : p?.status === 'corrupt' ? 'critical' : undefined}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Label color={colors.cyan}>{t('slots.slot', { slot })}</Label>
              {ok ? <Text variant="caption" color={colors.textFaint}>{t('slots.savedAt', { when: formatWhen(p.savedAt) })}</Text> : null}
            </Row>
            {ok ? (
              <View style={{ marginTop: space.sm, gap: 4 }}>
                <Row>
                  <Icon name="clock" size={16} color={colors.textDim} />
                  <Text variant="bodyStrong">{t('slots.played', { time: formatDuration(p.summary.time) })}</Text>
                </Row>
                <Text variant="small" color={colors.textDim}>
                  {t('slots.summary', { chapter: p.summary.chapter, level: p.summary.captainLevel, crew: p.summary.crew, hull: p.summary.hull })}
                </Text>
                {p.summary.ending ? <Pill text={t('slots.ended')} tone="ok" /> : null}
              </View>
            ) : (
              <Text style={{ marginTop: space.sm }} color={colors.textDim}>
                {p?.status === 'corrupt' ? t('slots.corrupt') : p?.status === 'newer' ? t('slots.newer') : t('slots.empty')}
              </Text>
            )}
            <Row style={{ marginTop: space.md }} wrap>
              {isNew ? (
                <Button
                  label={ok || p?.status === 'corrupt' ? t('slots.overwrite') : t('slots.start')}
                  variant={ok ? 'warning' : 'primary'}
                  icon="plus"
                  small
                  onPress={() => (ok || p?.status === 'corrupt' ? setConfirm({ slot, kind: 'overwrite' }) : startNew(slot))}
                />
              ) : (
                <Button label={t('slots.load')} variant="primary" icon="play" small disabled={!ok} onPress={() => load(slot)} />
              )}
              {ok || p?.status === 'corrupt' ? <Button label={t('slots.delete')} variant="ghost" icon="trash" small onPress={() => setConfirm({ slot, kind: 'delete' })} /> : null}
            </Row>
          </Panel>
        );
      })}
      <ConfirmDialog
        visible={!!confirm}
        danger
        title={confirm ? t(confirm.kind === 'delete' ? 'slots.deleteTitle' : 'slots.overwriteTitle', { slot: confirm.slot }) : ''}
        body={confirm ? t(confirm.kind === 'delete' ? 'slots.deleteBody' : 'slots.overwriteBody') : ''}
        confirmLabel={confirm?.kind === 'delete' ? t('slots.delete') : t('slots.overwrite')}
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          const c = confirm;
          setConfirm(null);
          if (!c) return;
          await saveManager.remove(c.slot);
          if (c.kind === 'overwrite') startNew(c.slot);
          else refresh();
        }}
      />
    </Screen>
  );
}
