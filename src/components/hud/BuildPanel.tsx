import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { BUILD_ORDER, footprint, MODULES } from '../../game/content/modules';
import { checkPlacement } from '../../game/engine/grid';
import type { GameState, ModuleType } from '../../game/engine/types';
import { formatNumber, t } from '../../i18n';
import { useGame } from '../../state/gameStore';
import { colors, radius, space } from '../../theme/tokens';
import { Icon } from '../Icon';
import { MODULE_ICON, type IconName } from '../icons';
import { Button, IconButton, Label, Pill, Row, Text } from '../ui';

/** Construction menu (catalogue) or, while placing, the placement controls. */
export function BuildPanel({ state, onClose }: { state: GameState; onClose: () => void }) {
  const ghost = useGame((s) => s.build);
  const startBuild = useGame((s) => s.startBuild);
  const rotate = useGame((s) => s.rotateGhost);
  const confirm = useGame((s) => s.confirmBuild);
  const cancel = useGame((s) => s.cancelBuild);

  if (ghost) {
    const check = checkPlacement(state, ghost.type, ghost.x, ghost.y, ghost.rotation);
    const def = MODULES[ghost.type];
    const rotatable = def.size.w !== def.size.h;
    return (
      <View style={styles.panel}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Row gap={space.sm} style={{ flex: 1 }}>
            <Icon name={MODULE_ICON[ghost.type] as IconName} size={22} color={colors.cyan} />
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong" numberOfLines={1}>{t(`module.${ghost.type}.name`)}</Text>
              <Text variant="caption" color={colors.textDim}>{t('build.hint')}</Text>
            </View>
          </Row>
          <Pill text={check.valid ? t('build.valid') : t(`placement.${check.error}`)} tone={check.valid ? 'ok' : 'critical'} />
        </Row>
        <Row gap={space.sm} style={{ marginTop: space.md }}>
          <Button label={t('build.cancel')} icon="close" variant="ghost" onPress={cancel} style={{ flex: 1 }} />
          {rotatable ? <Button label={t('build.rotate')} icon="rotate" onPress={rotate} style={{ flex: 1 }} /> : null}
          <Button label={t('build.place')} icon="check" variant="primary" onPress={confirm} disabled={!check.valid} style={{ flex: 1.4 }} />
        </Row>
      </View>
    );
  }

  return (
    <View style={styles.panel}>
      <Row style={{ justifyContent: 'space-between', marginBottom: space.sm }}>
        <View>
          <Label color={colors.cyan}>{t('build.title')}</Label>
          <Text variant="caption" color={colors.textDim}>{`${formatNumber(Math.floor(state.resources.materials))} ${t('resource.materials')} · ${formatNumber(Math.floor(state.resources.credits))} ${t('resource.credits')}`}</Text>
        </View>
        <IconButton icon="close" label={t('common.close')} onPress={onClose} size={38} />
      </Row>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, paddingRight: space.sm }}>
        {BUILD_ORDER.map((type) => (
          <BuildCard key={type} state={state} type={type} onPress={() => startBuild(type)} />
        ))}
      </ScrollView>
    </View>
  );
}

function BuildCard({ state, type, onPress }: { state: GameState; type: ModuleType; onPress: () => void }) {
  const def = MODULES[type];
  const locked = !!def.research && !state.research.completed.includes(def.research);
  const affordable = state.resources.materials >= def.cost.materials && state.resources.credits >= def.cost.credits;
  const count = Object.values(state.modules).filter((m) => m.type === type).length;
  const maxed = count >= def.maxCount;
  const { w, h } = footprint(type, 0);
  const anySpot = !locked && !maxed && hasSpot(state, type);
  const disabled = locked || maxed;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`${t(`module.${type}.name`)}, ${def.cost.materials} ${t('resource.materials')}${locked ? `, ${t('common.locked')}` : ''}`}
      style={({ pressed }) => [styles.card, pressed && { backgroundColor: colors.panelPressed }, disabled && { opacity: 0.5 }, !affordable && !disabled && { borderColor: colors.amber }]}
    >
      <Row style={{ justifyContent: 'space-between' }}>
        <View style={styles.cardIcon}>
          <Icon name={MODULE_ICON[type] as IconName} size={22} color={locked ? colors.textFaint : colors.cyan} />
        </View>
        <Text variant="caption" color={colors.textFaint}>{t('build.size', { w, h })}</Text>
      </Row>
      <Text variant="smallStrong" numberOfLines={1}>{t(`module.${type}.name`)}</Text>
      {locked ? (
        <Row gap={4}>
          <Icon name="lock" size={12} color={colors.textFaint} />
          <Text variant="caption" color={colors.textFaint} numberOfLines={2} style={{ flex: 1 }}>{t(`research.${def.research}.name`)}</Text>
        </Row>
      ) : (
        <>
          <Row gap={4}>
            <Icon name="materials" size={12} color={affordable ? colors.textDim : colors.amber} />
            <Text variant="caption" color={affordable ? colors.textDim : colors.amber}>{def.cost.credits ? `${def.cost.materials} · ${def.cost.credits}¢` : String(def.cost.materials)}</Text>
          </Row>
          <Row gap={4}>
            <Icon name="bolt" size={12} color={def.power > 0 ? colors.amber : colors.textDim} />
            <Text variant="caption" color={colors.textDim}>{def.power > 0 ? `+${def.power}` : def.power === 0 ? '0' : `${def.power}`}</Text>
            {maxed ? <Text variant="caption" color={colors.textFaint}>{` · ${count}/${def.maxCount}`}</Text> : !anySpot ? <Icon name="warning" size={12} color={colors.amber} /> : null}
          </Row>
        </>
      )}
    </Pressable>
  );
}

function hasSpot(s: GameState, type: ModuleType): boolean {
  for (let y = 0; y < s.grid.height; y++) for (let x = 0; x < s.grid.width; x++) for (const r of [0, 1] as const) if (checkPlacement(s, type, x, y, r, true).valid) return true;
  return false;
}

const styles = StyleSheet.create({
  panel: { backgroundColor: colors.panelSolid, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.lineStrong, padding: space.md },
  card: { width: 128, padding: space.sm, gap: 4, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panelRaised },
  cardIcon: { width: 36, height: 36, borderRadius: radius.sm, backgroundColor: 'rgba(69,224,220,0.08)', alignItems: 'center', justifyContent: 'center' },
});
