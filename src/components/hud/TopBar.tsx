import { memo, useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { RESOURCE_IDS, type GameState, type ResourceId } from '../../game/engine/types';
import { formatDuration, formatNumber, formatRate, t } from '../../i18n';
import { useGame, type Speed } from '../../state/gameStore';
import { colors, radius, space, toneColor, type StatusTone } from '../../theme/tokens';
import { Dialog } from '../Dialog';
import { Icon } from '../Icon';
import { RESOURCE_ICON } from '../icons';
import { Bar, IconButton, Label, Row, Text } from '../ui';
import { minutesLeft, netFlow, resourceTone, type HudResource } from './status';

/** Memoised on what it shows: whole seconds of ship time and the pause state. */
export function TopBar({ state, onMenu }: { state: GameState; onMenu: () => void }) {
  return <TopBarView seconds={Math.floor(state.time)} incident={!!state.events.active} onMenu={onMenu} />;
}

const TopBarView = memo(function TopBarView({ seconds, incident, onMenu }: { seconds: number; incident: boolean; onMenu: () => void }) {
  const speed = useGame((s) => s.speed);
  const paused = useGame((s) => s.paused);
  const setSpeed = useGame((s) => s.setSpeed);
  const togglePause = useGame((s) => s.togglePause);
  const frozen = paused || incident;
  return (
    <Row style={styles.bar}>
      <View style={{ flex: 1 }}>
        <Label color={colors.cyan}>{t('hud.shipName')}</Label>
        <Text variant="number" color={frozen ? colors.amber : colors.text}>
          {paused ? t('hud.paused') : t('hud.time', { time: formatDuration(seconds) })}
        </Text>
      </View>
      <View style={styles.segment} accessibilityRole="radiogroup">
        <IconButton icon={paused ? 'play' : 'pause'} label={paused ? t('hud.resume') : t('hud.pause')} onPress={togglePause} active={paused} size={40} style={styles.segBtn} />
        {([1, 2, 4] as Speed[]).map((sp) => (
          <Pressable
            key={sp}
            accessibilityRole="radio"
            accessibilityLabel={t('hud.speed', { speed: sp })}
            accessibilityState={{ selected: !paused && speed === sp }}
            onPress={() => setSpeed(sp)}
            style={[styles.speed, !paused && speed === sp && styles.speedOn]}
          >
            <Text variant="smallStrong" color={!paused && speed === sp ? colors.cyan : colors.textDim}>
              {`${sp}×`}
            </Text>
          </Pressable>
        ))}
      </View>
      <IconButton icon="menu" label={t('hud.menu')} onPress={onMenu} size={40} />
    </Row>
  );
});

const PRIMARY: HudResource[] = ['power', 'oxygen', 'food', 'water', 'hull'];
const SECONDARY: HudResource[] = ['materials', 'research', 'credits', 'temperature'];

interface ChipData {
  r: HudResource;
  text: string;
  /** Fill 0–1 rounded to 2 %, or null */
  pct: number | null;
  tone: StatusTone;
  rate: string | null;
  rateTone: 'up' | 'down' | 'flat';
}

function chipData(s: GameState, r: HudResource): ChipData {
  const tone = resourceTone(s, r);
  let text: string;
  let pct: number | null = null;
  if (r === 'hull') {
    text = `${Math.round(s.hull)}%`;
    pct = s.hull / 100;
  } else if (r === 'temperature') {
    text = `${Math.round(s.temperature)}°`;
  } else {
    const v = s.resources[r];
    const cap = s.capacity[r];
    text = formatNumber(Math.floor(v));
    if (r !== 'research' && r !== 'credits' && cap > 0) pct = v / cap;
  }
  const net = r === 'hull' || r === 'temperature' ? 0 : netFlow(s, r);
  return {
    r,
    text,
    pct: pct === null ? null : Math.round(pct * 50) / 50,
    tone,
    rate: r === 'hull' || r === 'temperature' ? null : formatRate(net),
    rateTone: net < -0.05 ? 'down' : net > 0.05 ? 'up' : 'flat',
  };
}

export function ResourceBar({ state }: { state: GameState }) {
  const [open, setOpen] = useState<HudResource | null>(null);
  const onOpen = useCallback((r: HudResource) => setOpen(r), []);
  return (
    <View style={{ gap: 6 }}>
      <View style={styles.grid}>
        {PRIMARY.map((r) => (
          <Chip key={r} {...chipData(state, r)} onOpen={onOpen} />
        ))}
      </View>
      <View style={styles.grid}>
        {SECONDARY.map((r) => (
          <Chip key={r} {...chipData(state, r)} compact onOpen={onOpen} />
        ))}
      </View>
      {open ? <ResourceDialog state={state} r={open} onClose={() => setOpen(null)} /> : null}
    </View>
  );
}

const Chip = memo(function Chip({ r, text, pct, tone, rate, rateTone, compact, onOpen }: ChipData & { compact?: boolean; onOpen: (r: HudResource) => void }) {
  const c = tone === 'ok' ? colors.text : toneColor[tone];
  const label = t(`resource.${r}`);
  return (
    <Pressable
      onPress={() => onOpen(r)}
      accessibilityRole="button"
      accessibilityLabel={`${label} ${text}${tone !== 'ok' ? `, ${t(tone === 'critical' ? 'resource.critical' : 'resource.low')}` : ''}`}
      style={({ pressed }) => [styles.chip, compact && styles.chipCompact, tone !== 'ok' && { borderColor: toneColor[tone] }, pressed && { backgroundColor: colors.panelPressed }]}
    >
      <Row gap={4}>
        <Icon name={RESOURCE_ICON[r]} size={compact ? 13 : 15} color={tone === 'ok' ? colors.textDim : c} />
        <Text variant={compact ? 'caption' : 'smallStrong'} color={c} numberOfLines={1}>
          {text}
        </Text>
        {tone !== 'ok' ? <Icon name={tone === 'critical' ? 'critical' : 'warning'} size={11} color={c} strokeWidth={2.2} /> : null}
      </Row>
      {!compact && pct !== null ? <Bar value={pct} max={1} height={3} color={tone === 'ok' ? colors.cyanDeep : c} style={{ marginTop: 3 }} /> : null}
      {!compact && rate ? (
        <Text variant="caption" color={rateTone === 'down' ? colors.amber : rateTone === 'up' ? colors.success : colors.textFaint} style={{ fontSize: 10, lineHeight: 12, marginTop: 1 }}>
          {rate}
        </Text>
      ) : null}
    </Pressable>
  );
});

function ResourceDialog({ state, r, onClose }: { state: GameState; r: HudResource | null; onClose: () => void }) {
  if (!r) return null;
  const isRes = (RESOURCE_IDS as readonly string[]).includes(r);
  const flow = isRes ? state.flows[r as ResourceId] : null;
  const left = isRes ? minutesLeft(state, r as ResourceId) : null;
  return (
    <Dialog visible onClose={onClose} title={t(`resource.${r}`)} icon={RESOURCE_ICON[r]} tone={resourceTone(state, r)}>
      <Text color={colors.textDim}>{t(`resource.${r}.desc`)}</Text>
      {flow ? (
        <View style={{ gap: 6 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text variant="small" color={colors.textDim}>{t('resource.production')}</Text>
            <Text variant="number" color={colors.success}>{`+${formatNumber(flow.production)}${t('common.perMin')}`}</Text>
          </Row>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text variant="small" color={colors.textDim}>{t('resource.consumption')}</Text>
            <Text variant="number" color={colors.amber}>{`−${formatNumber(flow.consumption)}${t('common.perMin')}`}</Text>
          </Row>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text variant="small" color={colors.textDim}>{t('resource.capacity')}</Text>
            <Text variant="number">{`${formatNumber(Math.floor(state.resources[r as ResourceId]))} / ${formatNumber(state.capacity[r as ResourceId])}`}</Text>
          </Row>
          {left !== null && left < 600 ? (
            <Text variant="smallStrong" color={colors.amber}>
              {`≈ ${formatDuration(left * 60)}`}
            </Text>
          ) : null}
        </View>
      ) : null}
      {r === 'power' && state.flags.battery_reserve ? <Text variant="small" color={colors.amber}>{t('hud.batteryReserve')}</Text> : null}
    </Dialog>
  );
}

const styles = StyleSheet.create({
  bar: { gap: space.sm },
  segment: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.panel, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: 2, gap: 2 },
  segBtn: { borderWidth: 0, backgroundColor: 'transparent' },
  speed: { width: 38, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  speedOn: { backgroundColor: 'rgba(69,224,220,0.14)' },
  grid: { flexDirection: 'row', gap: 6 },
  chip: { flex: 1, minHeight: 50, paddingHorizontal: 7, paddingVertical: 5, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, justifyContent: 'center' },
  chipCompact: { minHeight: 30, paddingVertical: 4 },
});
