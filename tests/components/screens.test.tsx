import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import Menu from '@/app/menu';
import Settings from '@/app/settings';
import { EventDialog } from '@/components/hud/EventDialog';
import { Inspector } from '@/components/hud/Inspector';
import { ResourceBar } from '@/components/hud/TopBar';
import { GameEngine } from '@/game/engine/GameEngine';
import { MemoryStorage } from '@/persistence/storage';
import { useGame } from '@/state/gameStore';
import { setSettingsStorage, useSettings } from '@/state/settingsStore';

function loadGame(mutate?: (e: GameEngine) => void) {
  const engine = new GameEngine();
  engine.initializeNewGame({ seed: 4 });
  mutate?.(engine);
  engine.runTicks(1);
  useGame.setState({ engine, snapshot: engine.getSnapshot(), lastLogId: engine.getSnapshot().nextLogId, toasts: [] });
  return engine;
}

describe('main menu', () => {
  it('offers a new game and opens the slot picker', () => {
    render(<Menu />);
    fireEvent.press(screen.getByLabelText('New game'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/slots', params: { mode: 'new' } });
    fireEvent.press(screen.getByLabelText('Settings'));
    expect(router.push).toHaveBeenCalledWith('/settings');
  });
});

describe('settings', () => {
  it('toggles persist through the settings store', async () => {
    const storage = new MemoryStorage();
    setSettingsStorage(storage);
    render(<Settings />);
    const toggle = screen.getByLabelText('Pause on incidents');
    expect(toggle.props.accessibilityState.checked).toBe(true);
    fireEvent.press(toggle);
    expect(useSettings.getState().pauseOnIncident).toBe(false);
    await act(async () => undefined);
    expect(JSON.parse(storage.files.get('settings.json')!).pauseOnIncident).toBe(false);
  });
});

describe('incident dialog', () => {
  it('shows the choices and resolves the incident through the engine', () => {
    const engine = loadGame((e) => {
      const s = e.getSnapshot();
      s.resources.oxygen = 5;
      s.events.nextCheck = 0;
    });
    engine.runTicks(1);
    useGame.setState({ snapshot: engine.getSnapshot() });
    const state = useGame.getState().snapshot!;
    expect(state.events.active?.defId).toBe('oxygen_shortage');
    render(<EventDialog state={state} />);
    expect(screen.getByText('Oxygen shortage')).toBeTruthy();
    fireEvent.press(screen.getByLabelText(/^Ration air/));
    expect(useGame.getState().snapshot!.events.active).toBeNull();
  });
});

describe('module inspector', () => {
  it('shows the reactor and asks before dismantling', () => {
    loadGame();
    const state = useGame.getState().snapshot!;
    const reactor = Object.values(state.modules).find((m) => m.type === 'reactor')!;
    render(<Inspector state={state} moduleId={reactor.id} onClose={() => undefined} />);
    expect(screen.getByText('Reactor')).toBeTruthy();
    expect(screen.getByText('38%')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Dismantle'));
    expect(screen.getByText('Dismantle Reactor?')).toBeTruthy();
  });

  it('assigns a repair through the crew picker', () => {
    loadGame();
    const state = useGame.getState().snapshot!;
    const reactor = Object.values(state.modules).find((m) => m.type === 'reactor')!;
    render(<Inspector state={state} moduleId={reactor.id} onClose={() => undefined} />);
    fireEvent.press(screen.getByLabelText('Repair'));
    fireEvent.press(screen.getByLabelText(/^Ines Varga/));
    const ines = useGame.getState().snapshot!.crew.find((c) => c.id === 'ines')!;
    expect(ines).toMatchObject({ task: 'repair', targetId: reactor.id });
  });
});

describe('resource bar', () => {
  it('announces low resources in words, not just colour', () => {
    loadGame((e) => {
      e.getSnapshot().resources.oxygen = 10;
    });
    render(<ResourceBar state={useGame.getState().snapshot!} />);
    expect(screen.getByLabelText(/^Oxygen \d+, Critical$/)).toBeTruthy();
  });
});
