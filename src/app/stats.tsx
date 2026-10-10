import { View } from 'react-native';

import { Icon } from '../components/Icon';
import { RESOURCE_ICON } from '../components/icons';
import { NoGame } from '../components/NoGame';
import { Screen } from '../components/Screen';
import { Bar, Label, Panel, Row, Text } from '../components/ui';
import { xpForLevel } from '../game/engine/helpers';
import { RESOURCE_IDS, type Stats as StatsT } from '../game/engine/types';
import { dispositionScores, dominantPath } from '../game/systems/progression';
import { formatDuration, formatNumber, t } from '../i18n';
import { useGame } from '../state/gameStore';
import { colors, space } from '../theme/tokens';

const KEYS: (keyof StatsT)[] = ['modulesBuilt', 'modulesRemoved', 'upgrades', 'repairsDone', 'researchCompleted', 'expeditions', 'eventsResolved', 'anomaliesContained', 'anomaliesExploited', 'echoesCreated', 'recoveries', 'oxygenLowSeconds', 'peakPower'];

export default function Stats() {
  const s = useGame((x) => x.snapshot);
  if (!s) return <NoGame title={t('stats.title')} />;
  const next = xpForLevel(s.captain.level + 1);
  const prev = xpForLevel(s.captain.level);
  const sc = dispositionScores(s);
  return (
    <Screen title={t('stats.title')} label={t('stats.shipTime')}>
      <Panel>
        <Row style={{ justifyContent: 'space-between' }}>
          <View>
            <Label color={colors.cyan}>{t('stats.captain')}</Label>
            <Text variant="title">{s.captain.level}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Label>{t('stats.shipTime')}</Label>
            <Text variant="heading">{formatDuration(s.time)}</Text>
          </View>
        </Row>
        <Bar value={s.captain.xp - prev} max={Math.max(1, next - prev)} color={colors.violet} style={{ marginTop: space.sm }} />
        <Text variant="caption" color={colors.textDim} style={{ marginTop: 4 }}>{t('stats.xp', { xp: s.captain.xp, next })}</Text>
        <Text variant="small" style={{ marginTop: space.sm }}>{`${t('stats.path')}: ${t(`ending.path.${dominantPath(s)}`)} (${sc.containment.toFixed(0)} / ${sc.symbiosis.toFixed(0)} / ${sc.resonance.toFixed(0)})`}</Text>
      </Panel>

      <Panel>
        <Label color={colors.amber}>{t('stats.power')}</Label>
        <Row style={{ justifyContent: 'space-between', marginTop: space.sm }}>
          <Text variant="small" color={colors.textDim}>{t('resource.production')}</Text>
          <Text variant="number">{`${formatNumber(s.power.supply)}${t('common.perMin')}`}</Text>
        </Row>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text variant="small" color={colors.textDim}>{t('resource.consumption')}</Text>
          <Text variant="number" color={s.power.shortage ? colors.danger : colors.text}>{`${formatNumber(s.power.demand)}${t('common.perMin')}`}</Text>
        </Row>
      </Panel>

      <Panel>
        <Label color={colors.cyan}>{t('stats.flows')}</Label>
        <View style={{ gap: space.sm, marginTop: space.sm }}>
          {RESOURCE_IDS.map((r) => {
            const f = s.flows[r];
            const net = f.production - f.consumption;
            return (
              <Row key={r}>
                <Icon name={RESOURCE_ICON[r]} size={16} color={colors.textDim} />
                <Text variant="small" style={{ flex: 1 }}>{t(`resource.${r}`)}</Text>
                <Text variant="caption" color={colors.success}>{`+${formatNumber(f.production)}`}</Text>
                <Text variant="caption" color={colors.amber}>{`−${formatNumber(f.consumption)}`}</Text>
                <Text variant="smallStrong" color={net < 0 ? colors.amber : colors.text} style={{ width: 64, textAlign: 'right' }}>{`${formatNumber(Math.floor(s.resources[r]))}/${formatNumber(s.capacity[r])}`}</Text>
              </Row>
            );
          })}
        </View>
      </Panel>

      <Panel>
        <View style={{ gap: space.sm }}>
          {KEYS.map((k) => (
            <Row key={k} style={{ justifyContent: 'space-between' }}>
              <Text variant="small" color={colors.textDim}>{t(`stats.${k}`)}</Text>
              <Text variant="number">{k === 'oxygenLowSeconds' ? formatDuration(s.stats[k]) : formatNumber(s.stats[k])}</Text>
            </Row>
          ))}
        </View>
      </Panel>
    </Screen>
  );
}
