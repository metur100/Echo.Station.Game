/**
 * Expedition map: the Meridian at the centre of a small star chart, destinations as nodes with
 * routes that light up as they unlock.
 */
import { Canvas, Circle, Group, Line, Path, RadialGradient, vec, DashPathEffect } from '@shopify/react-native-skia';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';

import { Icon } from '../../components/Icon';
import { NoGame } from '../../components/NoGame';
import { Screen } from '../../components/Screen';
import { Bar, Label, Panel, Pill, Row, Text } from '../../components/ui';
import { DESTINATIONS } from '../../game/content/destinations';
import { destinationUnlocked } from '../../game/systems/expeditions';
import { formatDuration, t } from '../../i18n';
import { useGame } from '../../state/gameStore';
import { accentColor, colors, radius, space } from '../../theme/tokens';

const HOME = { x: 0.1, y: 0.86 };

export default function ExpeditionMap() {
  const s = useGame((x) => x.snapshot);
  const { width } = useWindowDimensions();
  if (!s) return <NoGame title={t('expedition.title')} />;
  const mapW = Math.min(width - space.lg * 2, 728);
  const mapH = Math.round(mapW * 0.62);
  const ex = s.expeditions.active;
  const at = (p: { x: number; y: number }) => ({ x: p.x * mapW, y: p.y * mapH });

  return (
    <Screen title={t('expedition.title')} label={t('hud.missions')}>
      <Text color={colors.textDim}>{t('expedition.subtitle')}</Text>
      <View style={[styles.map, { width: mapW, height: mapH }]}>
        <Canvas style={StyleSheet.absoluteFill}>
          {DESTINATIONS.map((d, i) => {
            const prev = i === 0 ? HOME : DESTINATIONS[i - 1].map;
            const a = at(prev);
            const b = at(d.map);
            const open = destinationUnlocked(s, d);
            return (
              <Line key={d.id} p1={vec(a.x, a.y)} p2={vec(b.x, b.y)} color={open ? accentColor[d.accent] : colors.lineStrong} strokeWidth={open ? 1.6 : 1} opacity={open ? 0.8 : 0.5}>
                <DashPathEffect intervals={open ? [8, 5] : [3, 6]} />
              </Line>
            );
          })}
          {DESTINATIONS.map((d) => {
            const p = at(d.map);
            const open = destinationUnlocked(s, d);
            return (
              <Group key={`g${d.id}`}>
                <Circle cx={p.x} cy={p.y} r={30}>
                  <RadialGradient c={vec(p.x, p.y)} r={30} colors={[open ? `${accentColor[d.accent]}55` : 'rgba(80,100,140,0.18)', 'rgba(0,0,0,0)']} />
                </Circle>
              </Group>
            );
          })}
          <Circle cx={at(HOME).x} cy={at(HOME).y} r={22}>
            <RadialGradient c={vec(at(HOME).x, at(HOME).y)} r={22} colors={['rgba(69,224,220,0.5)', 'rgba(69,224,220,0)']} />
          </Circle>
          <Path path={`M ${at(HOME).x} ${at(HOME).y - 7} L ${at(HOME).x + 9} ${at(HOME).y} L ${at(HOME).x} ${at(HOME).y + 7} L ${at(HOME).x - 9} ${at(HOME).y} Z`} color={colors.cyan} />
        </Canvas>
        <View style={[styles.homeLabel, { left: at(HOME).x - 40, top: at(HOME).y + 12 }]}>
          <Text variant="caption" color={colors.cyan} center>{t('hud.shipName')}</Text>
        </View>
        {DESTINATIONS.map((d) => {
          const p = at(d.map);
          const open = destinationUnlocked(s, d);
          const done = (s.expeditions.completed[d.id] ?? 0) > 0;
          const c = open ? accentColor[d.accent] : colors.textFaint;
          return (
            <Pressable
              key={d.id}
              onPress={() => router.push({ pathname: '/expeditions/[id]', params: { id: d.id } })}
              accessibilityRole="button"
              accessibilityLabel={`${t(`destination.${d.id}.name`)}${open ? '' : `, ${t('common.locked')}`}`}
              style={[styles.node, { left: p.x - 22, top: p.y - 22, borderColor: c, backgroundColor: open ? `${c}22` : colors.panel }]}
            >
              <Icon name={open ? (done ? 'check' : d.final ? 'ark' : 'target') : 'lock'} size={20} color={c} />
            </Pressable>
          );
        })}
        {DESTINATIONS.map((d) => {
          const p = at(d.map);
          return (
            <View key={`l${d.id}`} style={[styles.nodeLabel, { left: Math.max(0, Math.min(mapW - 110, p.x - 55)), top: p.y + 26 }]} pointerEvents="none">
              <Text variant="caption" center color={destinationUnlocked(s, d) ? colors.text : colors.textFaint}>{t(`destination.${d.id}.name`)}</Text>
            </View>
          );
        })}
      </View>

      {ex ? (
        <Panel tone="info">
          <Row style={{ justifyContent: 'space-between' }}>
            <Label color={colors.cyan}>{t('expedition.active')}</Label>
            <Text variant="caption" color={colors.textDim}>{t('expedition.returnsIn', { time: formatDuration(ex.duration - ex.elapsed) })}</Text>
          </Row>
          <Text variant="bodyStrong">{t(`destination.${ex.destinationId}.name`)}</Text>
          <Bar value={ex.elapsed} max={ex.duration} color={colors.cyan} style={{ marginTop: space.sm }} />
          <Text variant="small" color={colors.textDim} style={{ marginTop: space.sm }}>{ex.crewIds.map((id) => s.crew.find((c) => c.id === id)?.name).join(', ')}</Text>
        </Panel>
      ) : null}

      {s.expeditions.lastOutcome ? (
        <Row gap={space.sm}>
          <Label>{t('expedition.lastOutcome')}</Label>
          <Pill text={`${t(`destination.${s.expeditions.lastOutcome.destinationId}.name`)} · ${t(`expedition.outcome.${s.expeditions.lastOutcome.outcome}`)}`} tone={s.expeditions.lastOutcome.outcome === 'success' ? 'ok' : s.expeditions.lastOutcome.outcome === 'partial' ? 'warn' : 'critical'} />
        </Row>
      ) : null}

      {DESTINATIONS.map((d) => {
        const open = destinationUnlocked(s, d);
        const readiness = s.expeditions.readiness[d.id] ?? 0;
        return (
          <Pressable key={`c${d.id}`} onPress={() => router.push({ pathname: '/expeditions/[id]', params: { id: d.id } })} style={({ pressed }) => [styles.card, pressed && { backgroundColor: colors.panelPressed }, !open && { opacity: 0.6 }]} accessibilityRole="button">
            <Icon name={open ? 'map' : 'lock'} size={20} color={open ? accentColor[d.accent] : colors.textFaint} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="bodyStrong">{t(`destination.${d.id}.name`)}</Text>
              <Text variant="caption" color={colors.textDim} numberOfLines={1}>{t(`destination.${d.id}.desc`)}</Text>
              {open && readiness > 0 && readiness < 100 ? <Bar value={readiness} color={colors.teal} height={4} label={t('expedition.readiness')} style={{ marginTop: 4 }} /> : null}
            </View>
            {(s.expeditions.completed[d.id] ?? 0) > 0 ? <Pill text={t('expedition.visited', { n: s.expeditions.completed[d.id] })} tone="ok" /> : readiness >= 100 ? <Pill text={t('expedition.readiness')} tone="ok" icon="check" /> : null}
          </Pressable>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  map: { alignSelf: 'center', borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: 'rgba(7,12,26,0.85)', overflow: 'hidden' },
  node: { position: 'absolute', width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  nodeLabel: { position: 'absolute', width: 110 },
  homeLabel: { position: 'absolute', width: 80 },
  card: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, minHeight: 64 },
});
