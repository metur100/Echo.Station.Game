/**
 * Development-only entry point for screenshots and QA: loads a demo state and opens a screen.
 *   exp://…/--/dev-demo?scene=ship|inspect|build|power|incident|research|crew|map|echo
 * In release builds it simply returns to the menu.
 */
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

import { buildDemoState, withIncident } from '../dev/demoState';
import { GameEngine } from '../game/engine/GameEngine';
import { useGame } from '../state/gameStore';
import { colors } from '../theme/tokens';

export default function DevDemo() {
  const { scene = 'ship' } = useLocalSearchParams<{ scene?: string }>();
  useEffect(() => {
    if (!__DEV__) return;
    const state = buildDemoState();
    const engine = new GameEngine(state);
    const hydro = Object.values(state.modules).find((m) => m.type === 'hydroponics');
    useGame.setState({
      engine,
      snapshot: engine.getSnapshot(),
      slot: 3,
      speed: 1,
      paused: false,
      menuOpen: false,
      away: null,
      toasts: [],
      lastLogId: state.nextLogId,
      selectedId: scene === 'inspect' ? (hydro?.id ?? null) : null,
      overlay: scene === 'power' ? 'power' : 'none',
      build: null,
    });
    if (scene === 'build') useGame.getState().startBuild('hydroponics');
    const target = scene === 'research' ? '/research' : scene === 'crew' ? '/crew/ines' : scene === 'map' ? '/expeditions' : scene === 'echo' ? '/echo' : '/ship';
    router.replace(target as '/ship');
    // Raise the incident once the ship has rendered (a modal open at mount hides the canvas below it).
    if (scene === 'incident') {
      setTimeout(() => {
        const g = useGame.getState();
        if (!g.engine) return;
        g.engine.restoreGame(withIncident(JSON.parse(g.engine.serializeGame())));
        useGame.setState({ snapshot: g.engine.getSnapshot() });
      }, 6000);
    }
  }, [scene]);
  if (!__DEV__) return <Redirect href="/menu" />;
  return <View style={{ flex: 1, backgroundColor: colors.bg0 }} />;
}
