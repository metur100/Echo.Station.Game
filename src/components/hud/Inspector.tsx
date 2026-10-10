/**
 * Module inspector: what a room is, whether it works and exactly why not, what it makes and
 * uses, what lives in it, what the ship remembers about it, and every action you can take.
 */
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ANOMALIES } from '../../game/content/anomalies';
import { DISMANTLE_REFUND, levelMultiplier, MODULES, UPGRADE_RESEARCH, upgradeCost } from '../../game/content/modules';
import { topology } from '../../game/engine/grid';
import { needsEmergency } from '../../game/engine/helpers';
import type { CrewTask, GameState, ModuleInstance, ResourceId } from '../../game/engine/types';
import { atRisk, growthFactors, secondsToSpread } from '../../game/systems/anomalies';
import { outputMultiplier } from '../../game/systems/resources';
import { powerDemand, reactorOutput } from '../../game/systems/power';
import { formatDuration, formatNumber, t } from '../../i18n';
import { useGame } from '../../state/gameStore';
import { colors, radius, space, type StatusTone } from '../../theme/tokens';
import { ConfirmDialog } from '../Dialog';
import { Icon } from '../Icon';
import { MODULE_ICON, RESOURCE_ICON, type IconName } from '../icons';
import { Bar, Button, IconButton, Label, Pill, Row, Text } from '../ui';
import { CrewPicker } from './CrewPicker';

function statusOf(m: ModuleInstance): { text: string; tone: StatusTone } {
  if (m.breached) return { text: t('inspect.breached'), tone: 'critical' };
  if (m.online) return { text: t('module.status.online'), tone: m.condition < 40 ? 'warn' : 'ok' };
  const reason = m.offlineReason ?? 'disabled';
  const tone: StatusTone = reason === 'constructing' ? 'info' : reason === 'disabled' || reason === 'quarantined' ? 'muted' : reason === 'overgrown' ? 'anomaly' : 'critical';
  return { text: t(`offline.${reason}`), tone };
}

export function Inspector({ state, moduleId, onClose, compact }: { state: GameState; moduleId: string; onClose: () => void; compact?: boolean }) {
  const dispatch = useGame((s) => s.dispatch);
  const [picker, setPicker] = useState<{ task: CrewTask; target: string } | null>(null);
  const [confirm, setConfirm] = useState<'dismantle' | 'purge' | null>(null);
  const m = state.modules[moduleId];
  const topo = useMemo(() => topology(state), [state]);
  if (!m) return null;
  const def = MODULES[m.type];
  const status = statusOf(m);
  const anomalies = state.anomalies.filter((a) => a.moduleId === m.id);
  const discovered = (k: string) => state.discoveredAnomalies.includes(k as never);
  const crewHere = state.crew.filter((c) => !c.away && (c.targetId === m.id || anomalies.some((a) => a.id === c.targetId)));
  const building = m.buildRemaining > 0;
  const mult = m.online ? outputMultiplier(state, m) : 0;
  const echoes = state.echoes.filter((e) => !e.archived && e.cells.some((c) => c.x >= m.x && c.y >= m.y && c.x < m.x + (m.rotation ? def.size.h : def.size.w) && c.y < m.y + (m.rotation ? def.size.w : def.size.h)));
  const cost = upgradeCost(m.type, m.level);
  const upResearch = UPGRADE_RESEARCH[m.level + 1];
  const canUpgrade = m.level < def.maxLevel && !building;
  const power = m.type === 'reactor' ? (m.online ? reactorOutput(state, m) : 0) : powerDemand(state, m);
  const help = m.offlineReason ? `offline.reasonHelp.${m.offlineReason}` : null;
  const emergency = needsEmergency(m, def.maxTemp);

  const flows = (rec: Partial<Record<ResourceId, number>>, f: number) =>
    (Object.entries(rec) as [ResourceId, number][]).map(([r, v]) => (
      <Row key={r} gap={4}>
        <Icon name={RESOURCE_ICON[r]} size={14} color={colors.textDim} />
        <Text variant="caption">{`${formatNumber(v * f)}${t('common.perMin')}`}</Text>
      </Row>
    ));

  const body = (
    <View style={{ gap: space.md }}>
      {/* Header */}
      <Row style={{ alignItems: 'flex-start' }}>
        <View style={styles.iconBox}>
          <Icon name={MODULE_ICON[m.type] as IconName} size={24} color={colors.cyan} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text variant="heading" numberOfLines={1}>{t(`module.${m.type}.name`)}</Text>
          <Row wrap gap={6}>
            <Pill text={status.text} tone={status.tone} />
            {def.maxLevel > 1 ? <Pill text={t('common.level', { level: m.level })} tone="muted" icon="upgrade" /> : null}
          </Row>
        </View>
        <IconButton icon="close" label={t('common.close')} onPress={onClose} size={38} />
      </Row>
      {help && !m.online ? <Text variant="small" color={colors.amber}>{t(help)}</Text> : null}
      {building ? (
        <View style={{ gap: 4 }}>
          <Text variant="caption" color={colors.textDim}>{t('inspect.under', { pct: Math.floor((1 - m.buildRemaining / Math.max(1, def.buildSeconds * (m.level > 1 ? 0.5 : 1))) * 100) })}</Text>
          <Bar value={1 - m.buildRemaining / Math.max(1, def.buildSeconds * (m.level > 1 ? 0.5 : 1))} max={1} color={colors.cyan} />
        </View>
      ) : null}
      {!compact ? <Text variant="small" color={colors.textDim}>{t(`module.${m.type}.desc`)}</Text> : null}

      {/* Vitals */}
      <View style={styles.vitals}>
        <View style={styles.vital}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Label>{t('inspect.condition')}</Label>
            <Text variant="number" color={m.condition < 25 ? colors.danger : m.condition < 60 ? colors.amber : colors.text}>{`${Math.round(m.condition)}%`}</Text>
          </Row>
          <Bar value={m.condition} color={m.condition < 25 ? colors.danger : m.condition < 60 ? colors.amber : colors.success} label={t('inspect.condition')} />
        </View>
        <View style={styles.vital}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Label>{t('inspect.temperature')}</Label>
            <Text variant="number" color={m.temperature > def.maxTemp ? colors.danger : m.temperature > def.maxTemp - 12 ? colors.amber : m.temperature < def.minTemp + 3 ? colors.frost : colors.text}>{`${Math.round(m.temperature)}°C`}</Text>
          </Row>
          <Bar value={Math.max(0, m.temperature + 20)} max={def.maxTemp + 35} color={m.temperature > def.maxTemp - 12 ? colors.orange : colors.teal} label={t('inspect.temperature')} />
        </View>
      </View>

      {/* Power and flows */}
      <Row wrap gap={space.md}>
        {power > 0 ? (
          <Row gap={4}>
            <Icon name="bolt" size={14} color={m.type === 'reactor' ? colors.amber : colors.textDim} />
            <Text variant="caption">{`${m.type === 'reactor' ? '+' : '−'}${formatNumber(power)}${t('common.perMin')}`}</Text>
          </Row>
        ) : null}
        {def.priority && def.power < 0 ? <Text variant="caption" color={colors.textFaint}>{t(`inspect.priority.${def.priority}`)}</Text> : null}
        {m.online && mult > 0 && mult !== 1 && m.type !== 'reactor' ? <Text variant="caption" color={colors.textFaint}>{t('inspect.efficiency', { pct: Math.round(mult * 100) })}</Text> : null}
      </Row>
      {Object.keys(def.outputs).length || Object.keys(def.inputs).length ? (
        <Row wrap gap={space.lg}>
          {Object.keys(def.outputs).length ? (
            <View style={{ gap: 2 }}>
              <Label>{t('inspect.produces')}</Label>
              <Row wrap gap={space.sm}>{flows(def.outputs, m.online ? mult : 0)}</Row>
            </View>
          ) : null}
          {Object.keys(def.inputs).length ? (
            <View style={{ gap: 2 }}>
              <Label>{t('inspect.consumes')}</Label>
              <Row wrap gap={space.sm}>{flows(def.inputs, m.online ? levelMultiplier(m.level) : 0)}</Row>
            </View>
          ) : null}
        </Row>
      ) : null}

      {/* Anomalies */}
      {anomalies.map((a) => {
        const known = discovered(a.kind);
        const ad = ANOMALIES[a.kind];
        const g = growthFactors(state, a, topo);
        const spread = secondsToSpread(state, a);
        const risk = atRisk(state, a, topo)[0];
        const canExploit = state.research.completed.includes(ad.exploitResearch);
        return (
          <View key={a.id} style={styles.anomaly}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Row gap={6}>
                <Icon name={a.kind} size={18} color={colors.violet} />
                <Text variant="bodyStrong" color={colors.violet}>{known ? t(`anomaly.${a.kind}.name`) : t('anomaly.undiscovered')}</Text>
              </Row>
              <Text variant="number" color={colors.violet}>{Math.round(a.intensity)}</Text>
            </Row>
            <Bar value={a.intensity} color={a.intensity >= ad.criticalAt ? colors.danger : colors.violet} label={t('anomaly.intensity')} />
            <Row wrap gap={space.md}>
              <Text variant="caption" color={g.rate > 0 ? colors.amber : colors.success}>{t('anomaly.growth', { rate: `${g.rate >= 0 ? '+' : '−'}${formatNumber(Math.abs(g.rate))}` })}</Text>
              <Text variant="caption" color={spread ? colors.amber : colors.textDim}>{spread ? t('anomaly.spreadIn', { time: formatDuration(spread) }) : t('anomaly.notSpreading')}</Text>
              {a.exploited ? <Pill text={t('anomaly.exploited')} tone="ok" icon="symbiosis" /> : null}
            </Row>
            {known ? (
              <View style={{ gap: 2 }}>
                <Label>{t('anomaly.why')}</Label>
                {g.factors.map((f) => (
                  <Text key={f.key} variant="caption" color={colors.textDim}>{`• ${t(`factor.${f.key}`)}`}</Text>
                ))}
                {risk && spread ? <Text variant="caption" color={colors.amber}>{`${t('anomaly.atRisk')}: ${t(`module.${state.modules[risk.moduleId]?.type}.name`)}`}</Text> : null}
              </View>
            ) : null}
            <Row wrap gap={6}>
              {!m.quarantined ? <Button small variant="anomaly" icon="quarantine" label={t('anomaly.quarantine')} onPress={() => dispatch({ type: 'ContainAnomaly', anomalyId: a.id, method: 'quarantine' })} /> : null}
              <Button small variant="secondary" icon="crew" label={t('anomaly.respond')} onPress={() => setPicker({ task: 'emergency', target: a.id })} />
              <Button small variant="danger" icon="trash" label={t('anomaly.purge')} onPress={() => setConfirm('purge')} />
              {!a.exploited && known ? (
                <Button small variant={canExploit ? 'primary' : 'ghost'} icon="symbiosis" label={canExploit ? t('anomaly.exploit') : t('anomaly.exploitNeeds', { name: t(`research.${ad.exploitResearch}.name`) })} disabled={!canExploit} onPress={() => dispatch({ type: 'ExploitAnomaly', anomalyId: a.id })} />
              ) : null}
            </Row>
            <Text variant="caption" color={colors.textFaint}>{t('anomaly.purgeCost', { materials: ad.purgeCost.materials, power: ad.purgeCost.power })}</Text>
          </View>
        );
      })}

      {/* Echoes */}
      {echoes.length ? (
        <View style={{ gap: 4 }}>
          <Label color={colors.violet}>{t('inspect.echoes')}</Label>
          {echoes.map((e) => (
            <Row key={e.id} gap={6}>
              <Icon name="echo" size={14} color={e.kind === 'residual_energy' ? colors.amber : colors.violet} />
              <Text variant="caption" style={{ flex: 1 }}>{`${t(`echo.${e.kind}.name`)} · ${Math.round(e.intensity)}${e.harnessed ? ` · ${t('echo.harnessed')}` : ''}`}</Text>
            </Row>
          ))}
          <Button small variant="ghost" icon="archive" label={t('echo.title')} onPress={() => router.push('/echo')} style={{ alignSelf: 'flex-start' }} />
        </View>
      ) : null}

      {crewHere.length ? (
        <Row wrap gap={6}>
          <Label>{t('inspect.crewHere')}</Label>
          {crewHere.map((c) => (
            <Pill key={c.id} text={`${c.name.split(' ').slice(-1)[0]} · ${t(`task.${c.task}`)}`} tone="info" icon="crew" />
          ))}
        </Row>
      ) : null}

      {/* Actions */}
      {!building ? (
        <View style={{ gap: space.sm }}>
          <Row wrap gap={6}>
            {m.condition < 100 ? <Button small variant={m.condition < 60 ? 'warning' : 'secondary'} icon="build" label={t('inspect.repair')} onPress={() => setPicker({ task: 'repair', target: m.id })} /> : null}
            <Button small icon="eye" label={t('inspect.maintain')} onPress={() => setPicker({ task: 'maintenance', target: m.id })} />
            {m.type === 'lab' ? <Button small variant="anomaly" icon="research" label={t('inspect.research')} onPress={() => setPicker({ task: 'research', target: m.id })} /> : null}
            {emergency ? <Button small variant="danger" icon="warning" label={t('inspect.respond')} onPress={() => setPicker({ task: 'emergency', target: m.id })} /> : null}
          </Row>
          <Row wrap gap={6}>
            {canUpgrade ? (
              <Button
                small
                variant="primary"
                icon="upgrade"
                label={`${t('inspect.upgradeTo', { level: m.level + 1 })} · ${cost.materials}${cost.credits ? ` / ${cost.credits}¢` : ''}`}
                disabled={!!upResearch && !state.research.completed.includes(upResearch)}
                onPress={() => dispatch({ type: 'UpgradeModule', moduleId: m.id })}
              />
            ) : null}
            {def.power !== 0 || m.type === 'reactor' ? <Button small icon="power" label={m.enabled ? t('inspect.switchOff') : t('inspect.switchOn')} onPress={() => dispatch({ type: 'ToggleModule', moduleId: m.id, enabled: !m.enabled })} /> : null}
            <Button small variant="anomaly" icon="quarantine" label={m.quarantined ? t('inspect.liftQuarantine') : t('inspect.quarantine')} onPress={() => dispatch({ type: 'SetQuarantine', moduleId: m.id, quarantined: !m.quarantined })} />
            <Button small variant="ghost" icon="trash" label={t('inspect.dismantle')} onPress={() => setConfirm('dismantle')} />
          </Row>
          {upResearch && canUpgrade && !state.research.completed.includes(upResearch) ? <Text variant="caption" color={colors.textFaint}>{t('build.requiresResearch', { name: t(`research.${upResearch}.name`) })}</Text> : null}
        </View>
      ) : null}

      {picker ? (
        <View style={styles.picker}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Label color={colors.cyan}>{t(`task.${picker.task}`)}</Label>
            <IconButton icon="close" label={t('common.close')} onPress={() => setPicker(null)} size={32} />
          </Row>
          <Text variant="caption" color={colors.textDim}>{t(`task.${picker.task}.desc`)}</Text>
          <CrewPicker state={state} task={picker.task} targetId={picker.target} onDone={() => setPicker(null)} />
        </View>
      ) : null}

      <ConfirmDialog
        visible={confirm === 'dismantle'}
        danger
        title={t('inspect.dismantleTitle', { module: m.type })}
        body={t('inspect.dismantleBody', { materials: Math.floor(def.cost.materials * DISMANTLE_REFUND) })}
        confirmLabel={t('inspect.dismantle')}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null);
          const r = dispatch({ type: 'RemoveModule', moduleId: m.id });
          if (r?.ok) onClose();
        }}
      />
      <ConfirmDialog
        visible={confirm === 'purge'}
        danger
        title={t('anomaly.purgeTitle', { kind: anomalies[0]?.kind ?? 'bloom' })}
        body={t('anomaly.purgeBody')}
        confirmLabel={t('anomaly.purge')}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null);
          if (anomalies[0]) dispatch({ type: 'ContainAnomaly', anomalyId: anomalies[0].id, method: 'purge' });
        }}
      />
    </View>
  );

  return (
    <ScrollView style={styles.sheet} contentContainerStyle={{ padding: space.lg }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      {body}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  sheet: { backgroundColor: colors.panelSolid, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.lineStrong },
  iconBox: { width: 44, height: 44, borderRadius: radius.md, borderWidth: 1, borderColor: colors.lineStrong, backgroundColor: colors.panelRaised, alignItems: 'center', justifyContent: 'center' },
  vitals: { flexDirection: 'row', gap: space.md },
  vital: { flex: 1, gap: 5 },
  anomaly: { gap: 6, padding: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.violetDeep, backgroundColor: 'rgba(154,132,240,0.07)' },
  picker: { gap: space.sm, padding: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.cyanDeep, backgroundColor: colors.panelRaised },
});
