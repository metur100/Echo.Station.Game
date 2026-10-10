import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { Icon } from '../components/Icon';
import { RESEARCH_ICON, type IconName } from '../components/icons';
import { NoGame } from '../components/NoGame';
import { Screen } from '../components/Screen';
import { Bar, Button, Label, Panel, Pill, Row, Text } from '../components/ui';
import { RESEARCH, RESEARCH_BRANCHES, RESEARCH_BY_ID, type ResearchBranch, type ResearchDef } from '../game/content/research';
import type { GameState } from '../game/engine/types';
import { researchAvailability, researchSpeed } from '../game/systems/research';
import { formatDuration, formatNumber, t } from '../i18n';
import { useGame } from '../state/gameStore';
import { colors, radius, space } from '../theme/tokens';

const BRANCH_COLOR: Record<ResearchBranch, string> = {
  engineering: colors.amber,
  xenobiology: colors.green,
  navigation: colors.cyan,
  echo: colors.violet,
};
const BRANCH_ICON: Record<ResearchBranch, IconName> = { engineering: 'build', xenobiology: 'bloom', navigation: 'map', echo: 'echo' };

export default function Research() {
  const s = useGame((x) => x.snapshot);
  const [branch, setBranch] = useState<ResearchBranch>('engineering');
  const [selected, setSelected] = useState<string | null>(null);
  if (!s) return <NoGame title={t('research.title')} />;
  const nodes = RESEARCH.filter((r) => r.branch === branch);
  const tiers = [...new Set(nodes.map((n) => n.tier))].sort();
  const active = s.research.active;
  const speed = researchSpeed(s);
  const sel = selected ? RESEARCH_BY_ID[selected] : null;

  return (
    <Screen title={t('research.title')} label={t('research.points', { n: formatNumber(Math.floor(s.resources.research)) })} footer={sel ? <Detail s={s} def={sel} color={BRANCH_COLOR[branch]} /> : undefined}>
      {active ? (
        <Panel tone="anomaly">
          <Row style={{ justifyContent: 'space-between' }}>
            <Label color={colors.violet}>{t('research.active')}</Label>
            <Text variant="caption" color={colors.textDim}>{speed > 0 ? formatDuration((active.duration - active.progress) / speed) : '—'}</Text>
          </Row>
          <Text variant="bodyStrong">{t(`research.${active.id}.name`)}</Text>
          <Bar value={active.progress} max={active.duration} color={colors.violet} style={{ marginTop: space.sm }} />
          {speed === 0 ? <Text variant="small" color={colors.amber} style={{ marginTop: space.sm }}>{t('research.noLab')}</Text> : null}
        </Panel>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
        {RESEARCH_BRANCHES.map((b) => {
          const on = b === branch;
          const done = RESEARCH.filter((r) => r.branch === b && s.research.completed.includes(r.id)).length;
          const total = RESEARCH.filter((r) => r.branch === b).length;
          return (
            <Pressable key={b} onPress={() => { setBranch(b); setSelected(null); }} accessibilityRole="tab" accessibilityState={{ selected: on }} style={[styles.tab, on && { borderColor: BRANCH_COLOR[b], backgroundColor: `${BRANCH_COLOR[b]}18` }]}>
              <Icon name={BRANCH_ICON[b]} size={18} color={on ? BRANCH_COLOR[b] : colors.textDim} />
              <View>
                <Text variant="smallStrong" color={on ? colors.text : colors.textDim}>{t(`research.branch.${b}`)}</Text>
                <Text variant="caption" color={colors.textFaint}>{`${done}/${total}`}</Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={{ gap: space.md }}>
        {tiers.map((tier) => (
          <View key={tier} style={{ gap: space.sm }}>
            <Label color={colors.textFaint}>{t('research.tier', { n: tier + 1 })}</Label>
            <View style={styles.tierRow}>
              {nodes
                .filter((n) => n.tier === tier)
                .map((n) => (
                  <Node key={n.id} s={s} def={n} color={BRANCH_COLOR[branch]} selected={selected === n.id} onPress={() => setSelected(n.id === selected ? null : n.id)} />
                ))}
            </View>
          </View>
        ))}
      </View>

      {!sel ? <Text variant="small" color={colors.textFaint}>{t('research.pick')}</Text> : null}
    </Screen>
  );
}

function Node({ s, def, color, selected, onPress }: { s: GameState; def: ResearchDef; color: string; selected: boolean; onPress: () => void }) {
  const a = researchAvailability(s, def);
  const done = a.status === 'completed';
  const locked = a.status === 'locked';
  const active = a.status === 'active';
  const c = done ? color : active ? colors.violet : locked ? colors.textFaint : colors.text;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${t(`research.${def.id}.name`)}, ${t(done ? 'common.completed' : locked ? 'common.locked' : active ? 'common.inProgress' : 'common.available')}`}
      style={[styles.node, selected && { borderColor: color }, done && { backgroundColor: `${color}14`, borderColor: `${color}88` }, locked && { opacity: 0.6 }]}
    >
      {done ? (
        <Animated.View entering={ZoomIn.duration(300)} style={[styles.check, { backgroundColor: color }]}>
          <Icon name="check" size={12} color={colors.bg0} strokeWidth={2.6} />
        </Animated.View>
      ) : null}
      <Icon name={locked ? 'lock' : RESEARCH_ICON[def.icon] ?? 'research'} size={22} color={c} />
      <Text variant="smallStrong" color={locked ? colors.textDim : colors.text} numberOfLines={2}>{t(`research.${def.id}.name`)}</Text>
      <Text variant="caption" color={a.affordable || done ? colors.textFaint : colors.amber}>{done ? t('common.completed') : t('research.cost', { cost: def.cost })}</Text>
    </Pressable>
  );
}

function Detail({ s, def, color }: { s: GameState; def: ResearchDef; color: string }) {
  const dispatch = useGame((x) => x.dispatch);
  const a = researchAvailability(s, def);
  const busy = !!s.research.active && s.research.active.id !== def.id;
  return (
    <Panel raised style={{ borderColor: color }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text variant="heading" style={{ flex: 1 }}>{t(`research.${def.id}.name`)}</Text>
        <Pill text={t(a.status === 'completed' ? 'common.completed' : a.status === 'locked' ? 'common.locked' : a.status === 'active' ? 'common.inProgress' : 'common.available')} tone={a.status === 'completed' ? 'ok' : a.status === 'locked' ? 'muted' : 'info'} />
      </Row>
      <Text color={colors.textDim} style={{ marginTop: space.sm }}>{t(`research.${def.id}.desc`)}</Text>
      <Row wrap gap={space.md} style={{ marginTop: space.sm }}>
        <Text variant="caption" color={colors.textDim}>{t('research.cost', { cost: def.cost })}</Text>
        <Text variant="caption" color={colors.textDim}>{t('research.duration', { n: def.seconds })}</Text>
      </Row>
      {a.missing.length ? (
        <View style={{ marginTop: space.sm, gap: 2 }}>
          <Label>{t('common.requires')}</Label>
          {a.missing.map((m, i) => (
            <Text key={i} variant="small" color={colors.amber}>
              {`• ${t(m.key, m.params?.id ? { id: String(m.params.id) } : m.params)}`}
            </Text>
          ))}
        </View>
      ) : null}
      {a.status === 'available' ? (
        <Button
          label={busy ? t('research.busy') : t('research.start')}
          icon="research"
          variant="primary"
          disabled={busy || !a.affordable}
          onPress={() => dispatch({ type: 'StartResearch', researchId: def.id })}
          style={{ marginTop: space.md }}
        />
      ) : null}
    </Panel>
  );
}

const styles = StyleSheet.create({
  tab: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, minHeight: 48 },
  tierRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  node: { width: 150, minHeight: 112, padding: space.md, gap: 6, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel },
  check: { position: 'absolute', top: 8, right: 8, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
});
