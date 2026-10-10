/**
 * Main simulation screen. Owns the frame loop (requestAnimationFrame → engine fixed timestep),
 * autosave, background/resume handling and the HUD layout.
 */
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { audio } from '../audio/audio';
import { BuildPanel } from '../components/hud/BuildPanel';
import { Dock, type DockItem } from '../components/hud/Dock';
import { EventDialog } from '../components/hud/EventDialog';
import { Inspector } from '../components/hud/Inspector';
import { ObjectiveCard, StatusStrip } from '../components/hud/ObjectiveCard';
import { AwayDialog, PauseMenu } from '../components/hud/PauseMenu';
import { ResourceBar, TopBar } from '../components/hud/TopBar';
import { Starfield } from '../components/Starfield';
import { Toasts } from '../components/Toasts';
import { IconButton } from '../components/ui';
import type { ObjectiveDef } from '../game/content/objectives';
import { clampElapsed } from '../game/engine/offline';
import type { ModuleType } from '../game/engine/types';
import { ShipView, type ShipViewHandle } from '../game/rendering/ShipView';
import type { ShipPath } from '../game/rendering/shipPicture';
import { dispositionScores, dominantPath } from '../game/systems/progression';
import { t } from '../i18n';
import { useGame, type Overlay } from '../state/gameStore';
import { useSettings } from '../state/settingsStore';
import { useStableCallback } from '../state/useStableCallback';
import { colors, space } from '../theme/tokens';

const AUTOSAVE_MS = 30_000;
const noop = () => undefined;
const OVERLAYS: { id: Overlay; icon: 'layers' | 'bolt' | 'heat' | 'echo' | 'build' }[] = [
  { id: 'none', icon: 'layers' },
  { id: 'power', icon: 'bolt' },
  { id: 'heat', icon: 'heat' },
  { id: 'condition', icon: 'build' },
  { id: 'echo', icon: 'echo' },
];

function useFrameLoop() {
  useEffect(() => {
    let raf = 0;
    let last = Date.now();
    const loop = () => {
      const now = Date.now();
      const dt = (now - last) / 1000;
      last = now;
      useGame.getState().advance(dt);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
}

function useAutosaveAndResume() {
  useEffect(() => {
    const timer = setInterval(() => {
      const g = useGame.getState();
      if (g.engine && useSettings.getState().autosave && !g.snapshot?.gameOver) g.save().catch(() => undefined);
    }, AUTOSAVE_MS);
    let backgroundAt = 0;
    const sub = AppState.addEventListener('change', (st) => {
      const g = useGame.getState();
      if (!g.engine) return;
      if (st === 'background' || st === 'inactive') {
        if (!backgroundAt) {
          backgroundAt = Date.now();
          g.save().catch(() => undefined);
        }
      } else if (st === 'active' && backgroundAt) {
        const { seconds, capped } = clampElapsed(backgroundAt, Date.now());
        backgroundAt = 0;
        if (useSettings.getState().offlineProgress) g.applyAway(seconds, capped);
      }
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, []);
}

export default function Ship() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const landscape = width > height && width > 700;
  const snapshot = useGame((s) => s.snapshot);
  const selectedId = useGame((s) => s.selectedId);
  const ghost = useGame((s) => s.build);
  const overlay = useGame((s) => s.overlay);
  const away = useGame((s) => s.away);
  const menuOpen = useGame((s) => s.menuOpen);
  const restoredBackup = useGame((s) => s.restoredBackup);
  const select = useGame((s) => s.select);
  const moveGhost = useGame((s) => s.moveGhost);
  const setOverlay = useGame((s) => s.setOverlay);
  const setMenuOpen = useGame((s) => s.setMenuOpen);
  const dismissAway = useGame((s) => s.dismissAway);
  const [panel, setPanel] = useState<'none' | 'build'>('none');
  const [pauseVisible, setPauseVisible] = useState(false);
  const [hintType, setHintType] = useState<ModuleType | null>(null);
  const [hudHeight, setHudHeight] = useState(180);
  const ship = useRef<ShipViewHandle>(null);

  useFrameLoop();
  useAutosaveAndResume();

  useEffect(() => {
    if (!snapshot) router.replace('/menu');
  }, [snapshot]);

  useEffect(() => {
    audio.startMusic();
    if (restoredBackup) useGame.getState().toast(t('slots.restoredBackup'), 'warn');
  }, [restoredBackup]);

  // Coming back from a screen opened from the pause menu: show the menu again.
  useFocusEffect(
    useCallback(() => {
      if (useGame.getState().menuOpen) setPauseVisible(true);
    }, []),
  );

  const gameOver = !!snapshot?.gameOver;
  const endingPending = !!snapshot?.ending && !snapshot.flags.ending_seen;
  useEffect(() => {
    if (gameOver) router.push('/game-over');
  }, [gameOver]);
  useEffect(() => {
    if (endingPending) router.push('/ending');
  }, [endingPending]);

  // Bring the selected room into the visible area above the inspector.
  useEffect(() => {
    if (!selectedId) return;
    const id = setTimeout(() => ship.current?.focusModule(selectedId), 60);
    return () => clearTimeout(id);
  }, [selectedId]);

  // Clear the hint highlight after a while
  useEffect(() => {
    if (!hintType) return;
    const id = setTimeout(() => setHintType(null), 6000);
    return () => clearTimeout(id);
  }, [hintType]);

  const openMenu = useStableCallback(() => {
    setMenuOpen(true);
    setPauseVisible(true);
  });
  const closeMenu = () => {
    setPauseVisible(false);
    setMenuOpen(false);
  };

  const onDock = useStableCallback((id: DockItem) => {
    if (id === 'build') {
      if (panel === 'build') {
        setPanel('none');
        useGame.getState().cancelBuild();
      } else {
        select(null);
        setPanel('build');
      }
      return;
    }
    const route = id === 'crew' ? '/crew' : id === 'research' ? '/research' : id === 'missions' ? '/expeditions' : '/echo';
    router.push(route);
  });

  const onHint = useStableCallback((o: ObjectiveDef) => {
    if (o.hint.module) {
      setHintType(o.hint.module);
      ship.current?.focusType(o.hint.module);
    }
    if (o.hint.screen === 'build') {
      select(null);
      setPanel('build');
      if (o.hint.module) useGame.getState().startBuild(o.hint.module);
    } else if (o.hint.screen === 'crew' && !o.hint.module) router.push('/crew');
    else if (o.hint.screen === 'research') router.push('/research');
    else if (o.hint.screen === 'expeditions') router.push('/expeditions');
    else if (o.hint.screen === 'echo') router.push('/echo');
  });

  if (!snapshot) return <View style={styles.root} />;

  const scores = dispositionScores(snapshot);
  const total = scores.containment + scores.symbiosis + scores.resonance;
  const path: ShipPath = total >= 4 ? dominantPath(snapshot) : 'neutral';

  const sheetOpen = panel === 'build' || !!selectedId;
  const sideW = landscape ? Math.min(400, width * 0.38) : 0;
  const shipInsets = landscape
    ? { top: insets.top + 70, bottom: insets.bottom + 90, left: insets.left + 300, right: sheetOpen ? sideW + 20 : 70 }
    : { top: insets.top + hudHeight, bottom: insets.bottom + (sheetOpen ? height * 0.42 : 90), left: 8, right: 8 };
  const badges = {
    research: !snapshot.research.active && snapshot.research.completed.length < 18 && snapshot.resources.research >= 25,
    crew: snapshot.crew.some((c) => !c.away && c.task === 'rest' && c.fatigue < 30 && !c.incapacitated),
    echo: snapshot.echoes.some((e) => !e.archived && e.createdAt > snapshot.time - 30),
  };

  return (
    <View style={styles.root}>
      <Starfield seed={5} />
      <ShipView
        ref={ship}
        state={snapshot}
        path={path}
        selectedId={selectedId}
        ghost={ghost}
        overlay={overlay}
        hintType={hintType}
        insets={shipInsets}
        onSelect={(id) => {
          if (panel === 'build' && !ghost) setPanel('none');
          select(id);
        }}
        onLongPress={(id) => {
          select(id);
          ship.current?.focusModule(id);
        }}
        onGhostMove={moveGhost}
      />

      {/* Top HUD */}
      <View
        style={[styles.top, { paddingTop: insets.top + space.xs, paddingLeft: insets.left + space.md, paddingRight: insets.right + space.md }, landscape && { width: Math.min(560, width * 0.55) }]}
        pointerEvents="box-none"
        onLayout={(e) => setHudHeight(e.nativeEvent.layout.height)}
      >
        <TopBar state={snapshot} onMenu={openMenu} />
        <ResourceBar state={snapshot} />
        <View style={{ gap: 6 }} pointerEvents="box-none">
          {!sheetOpen || landscape ? <ObjectiveCard state={snapshot} onHint={onHint} /> : null}
          <StatusStrip state={snapshot} onIncident={noop} />
        </View>
      </View>

      {/* Overlay switcher */}
      <View style={[styles.overlays, { top: landscape ? insets.top + 80 : insets.top + hudHeight + 4, right: insets.right + space.md }, sheetOpen && landscape && { right: sideW + insets.right + space.xl }]}>
        {OVERLAYS.map((o) => (
          <IconButton key={o.id} icon={o.icon} label={`${t('hud.overlay')}: ${t(`hud.overlay.${o.id}`)}`} active={overlay === o.id} onPress={() => setOverlay(o.id)} size={38} />
        ))}
        <IconButton icon="target" label={t('hud.fit')} onPress={() => ship.current?.fit()} size={38} />
      </View>

      {/* Bottom: sheet + dock */}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + space.sm, paddingLeft: insets.left + space.md, paddingRight: insets.right + space.md }]} pointerEvents="box-none">
        {sheetOpen ? (
          <Animated.View
            entering={FadeInDown.duration(220)}
            exiting={FadeOutDown.duration(160)}
            style={landscape ? [styles.side, { width: sideW, top: -(height - insets.bottom - 90) + insets.top + space.md, right: insets.right + space.md }] : { maxHeight: height * 0.44, marginBottom: space.sm }}
          >
            {panel === 'build' ? (
              <BuildPanel state={snapshot} onClose={() => { setPanel('none'); useGame.getState().cancelBuild(); }} />
            ) : selectedId ? (
              <Inspector state={snapshot} moduleId={selectedId} onClose={() => select(null)} compact={!landscape} />
            ) : null}
          </Animated.View>
        ) : null}
        <Animated.View entering={FadeIn.duration(400)} style={landscape ? { width: Math.min(520, width * 0.5), alignSelf: 'flex-start' } : undefined}>
          <Dock onPress={onDock} active={panel === 'build' ? 'build' : null} research={badges.research} crew={badges.crew} echo={badges.echo} />
        </Animated.View>
      </View>

      <Toasts top={insets.top + (landscape ? 70 : hudHeight + 8)} />

      {!menuOpen && !gameOver ? <EventDialog state={snapshot} /> : null}
      <PauseMenu visible={pauseVisible} onClose={closeMenu} onNavigate={() => setPauseVisible(false)} />
      {!pauseVisible ? <AwayDialog summary={away} onClose={dismissAway} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg0 },
  top: { position: 'absolute', top: 0, left: 0, right: 0, gap: 8 },
  overlays: { position: 'absolute', gap: 6 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  side: { position: 'absolute', bottom: 0 },
});
