/**
 * Echo Memory archive: every trace the ship has recorded, where it sits, what caused it, what it
 * does now and what it has already done.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Icon } from '../components/Icon';
import { NoGame } from '../components/NoGame';
import { Screen } from '../components/Screen';
import { Bar, Label, Panel, Pill, Row, Text } from '../components/ui';
import { moduleAt } from '../game/engine/grid';
import type { EchoKind, EchoTrace, GameState } from '../game/engine/types';
import { ECHO_DECAY } from '../game/systems/echo';
import { dispositionScores } from '../game/systems/progression';
import { formatDuration, t } from '../i18n';
import { useGame } from '../state/gameStore';
import { colors, radius, space } from '../theme/tokens';

const KIND_COLOR: Record<EchoKind, string> = {
  residual_energy: colors.amber,
  contamination: colors.violet,
  structural: colors.steel,
  resonance: colors.cyan,
};

export default function EchoArchive() {
  const s = useGame((x) => x.snapshot);
  const [open, setOpen] = useState<string | null>(null);
  if (!s) return <NoGame title={t('echo.title')} />;
  const active = s.echoes.filter((e) => !e.archived).sort((a, b) => b.intensity - a.intensity);
  const archived = s.echoes.filter((e) => e.archived).sort((a, b) => b.createdAt - a.createdAt);
  const sc = dispositionScores(s);
  const max = Math.max(1, sc.containment, sc.symbiosis, sc.resonance);
  return (
    <Screen title={t('echo.title')} label={`${active.length} · ${t('echo.active')}`}>
      <Text color={colors.textDim}>{t('echo.subtitle')}</Text>
      <Panel>
        <Label color={colors.violet}>{t('stats.path')}</Label>
        <View style={{ gap: space.sm, marginTop: space.sm }}>
          {(['containment', 'symbiosis', 'resonance'] as const).map((k) => (
            <View key={k} style={{ gap: 3 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text variant="small">{t(`ending.path.${k}`)}</Text>
                <Text variant="caption" color={colors.textDim}>{sc[k].toFixed(1)}</Text>
              </Row>
              <Bar value={sc[k]} max={max} color={k === 'containment' ? colors.cyan : k === 'symbiosis' ? colors.green : colors.violet} height={5} label={t(`ending.path.${k}`)} />
            </View>
          ))}
        </View>
      </Panel>
      {active.length === 0 ? <Text color={colors.textDim}>{archived.length ? t('echo.noneActive') : t('echo.empty')}</Text> : null}
      {active.map((e) => (
        <EchoCard key={e.id} s={s} e={e} expanded={open === e.id} onPress={() => setOpen(open === e.id ? null : e.id)} />
      ))}
      {archived.length ? <Label>{t('echo.archived')}</Label> : null}
      {archived.map((e) => (
        <EchoCard key={e.id} s={s} e={e} expanded={open === e.id} onPress={() => setOpen(open === e.id ? null : e.id)} />
      ))}
    </Screen>
  );
}

function location(s: GameState, e: EchoTrace): string {
  if (!e.cells.length) return t('echo.shipWide');
  const c = e.cells[0];
  const m = moduleAt(s, c.x, c.y);
  return m ? `${t(`module.${m.type}.name`)} (${c.x},${c.y})` : `(${c.x},${c.y})`;
}

function EchoCard({ s, e, expanded, onPress }: { s: GameState; e: EchoTrace; expanded: boolean; onPress: () => void }) {
  const color = KIND_COLOR[e.kind];
  const decay = ECHO_DECAY[e.kind];
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ expanded }} style={[styles.card, { borderLeftColor: color }, e.archived && { opacity: 0.6 }]}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Row gap={space.sm} style={{ flex: 1 }}>
          <Icon name="echo" size={18} color={color} />
          <View style={{ flex: 1 }}>
            <Text variant="bodyStrong">{t(`echo.${e.kind}.name`)}</Text>
            <Text variant="caption" color={colors.textDim}>{location(s, e)}</Text>
          </View>
        </Row>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <Text variant="number" color={color}>{Math.round(e.intensity)}</Text>
          {e.harnessed ? <Pill text={t('echo.harnessed')} tone="ok" icon="check" /> : null}
        </View>
      </Row>
      <Bar value={e.intensity} color={color} height={4} style={{ marginTop: space.sm }} label={t('echo.intensity', { n: Math.round(e.intensity) })} />
      {expanded ? (
        <Animated.View entering={FadeIn.duration(200)} style={{ gap: space.sm, marginTop: space.md }}>
          <View>
            <Label>{t('echo.cause')}</Label>
            <Text variant="small">{t(e.causeKey, e.causeParams)}</Text>
            <Text variant="caption" color={colors.textFaint}>{t('echo.recorded', { time: formatDuration(e.createdAt) })}</Text>
          </View>
          <View>
            <Label>{t('echo.effects')}</Label>
            <Text variant="small" color={colors.textDim}>{t(`echo.${e.kind}.effect`)}</Text>
            <Text variant="caption" color={colors.textFaint}>{decay > 0 && !e.archived ? t('echo.fades', { time: formatDuration((e.intensity / decay) * 60) }) : decay === 0 ? t('echo.permanent') : ''}</Text>
          </View>
          <View>
            <Label>{t('echo.consequences')}</Label>
            {e.consequences.length ? (
              e.consequences.map((c, i) => (
                <Text key={i} variant="small" color={colors.text}>{`T+${formatDuration(c.time)} · ${t(c.key, c.params)}`}</Text>
              ))
            ) : (
              <Text variant="small" color={colors.textFaint}>{t('echo.noConsequences')}</Text>
            )}
          </View>
        </Animated.View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { padding: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, borderLeftWidth: 3, backgroundColor: colors.panel },
});
