# Architecture

```
src/
  app/                 Expo Router screens (file-based routes)
  components/          design-system primitives (ui.tsx), icons, portraits, dialogs
    hud/               ship-screen HUD: top bar, resources, objective, dock, inspector, build panel, incidents
  game/
    engine/            GameEngine, tick pipeline, commands, state types, grid/topology, validation, offline
    systems/           power, resources, thermal, condition, crew, anomalies, echo, research, expeditions, events, progression
    content/           data tables: modules, research, anomalies, crew, destinations, events, objectives, achievements
    coordinates/       isometric projection and hit testing
    camera/            pure camera math (worklet-safe)
    rendering/         Skia: drawKit, ship picture, overlay geometry, ShipView
  state/               Zustand stores (game, settings), log → feedback, stable callbacks
  persistence/         save storage (file / memory), save manager, migrations
  audio/               expo-audio service, haptics
  analytics/           local-only analytics boundary (no provider)
  monetization/        disabled monetization boundary (no purchases, no ads)
  i18n/                English strings and t()
  dev/                 demo state for screenshots (development builds only)
  theme/               design tokens
```

## Engine

- `GameState` (`engine/types.ts`) is plain JSON — modules, crew, anomalies, echoes, events, expeditions, research, objectives, flags and statistics. Derived per-tick values (power allocation, flows, temperatures) are stored too, so the UI never re-implements rules.
- `GameEngine` exposes `initializeNewGame`, `updateSimulation(realSeconds, speed)`, `runTicks`, `pauseSimulation` / `resumeSimulation`, `executeCommand`, `getSnapshot`, `serializeGame`, `restoreGame`, `applyOffline` and `validateGameState`.
- **Immutability:** a batch of ticks or a command clones the state once, mutates the draft, then swaps it in. Every snapshot is therefore a stable value React can compare by reference.
- **Determinism:** the only randomness is a mulberry32 generator whose state lives in `GameState.rng`; the same seed and command sequence give the same game (tested).
- **Commands** (`engine/commands.ts`): `PlaceModule`, `RemoveModule`, `UpgradeModule`, `ToggleModule`, `SetQuarantine`, `AssignCrewTask`, `StartResearch`, `StartExpedition`, `ContainAnomaly`, `ExploitAnomaly`, `ResolveEvent`, `AcknowledgeObjective`, `AcknowledgeEnding`, `EmergencyRecovery`. Each is validated first; a rejected command returns an i18n error key and leaves the state untouched.
- Engine output for presentation is the **log**: sound, haptics, toasts and analytics react to new log entries (`state/feedback.ts`), so the engine never imports UI code.

## Rendering

- Grid ↔ world ↔ screen conversion lives only in `coordinates/iso.ts` and `camera/camera.ts`.
- The static ship (hull, rooms, machinery, damage, quarantine, echo marks) is recorded into one `SkPicture` and re-recorded only when its **visual signature** changes (layout, damage buckets, quarantine, echoes).
- The animated layer (reactor pulse, oxygen flow, anomalies, residual energy, breaches, construction, status lamps, crew markers, selection, build ghost, data overlays) re-renders only when its own signature changes — not every tick. Animation runs on the UI thread from a Skia clock through Reanimated derived values.
- No blur mask filters (expensive on mobile GPUs): glows are layered alpha shapes.
- Gestures (`react-native-gesture-handler`): one-finger pan (or drag-to-place while building), pinch zoom around the focal point, tap to select / place, long press to select and focus. Camera values are Reanimated shared values; hit testing runs on the JS thread against room silhouettes, front-most first.

## State and UI

- `useGame` holds the engine, the latest snapshot and transient UI state (selection, build ghost, overlay, toasts, offline summary). The HUD subscribes to the snapshot and memoises its pieces on the primitive values they display.
- The simulation freezes while the pause menu is open, while an incident waits for a decision (setting), and after a game over.
- `useSettings` persists settings to `settings.json`.

## Persistence

`persistence/saveManager.ts` — three slots, versioned envelope, validate → tmp → read back → backup → atomic replace, serialised writes, backup fallback, migrations (`persistence/migrations.ts`), refusal of newer schemas. Autosave every 30 s and on backgrounding; offline progression on load and resume.

## Testing

- `tests/unit` — engine systems, construction, crew, research, anomalies and echoes, incidents and expeditions, saves and offline, determinism and property-based invariants (fast-check), isometric math and camera, string completeness, and full campaign playthroughs (`campaign.test.ts` using `tests/campaignBot.ts`).
- `tests/components` — rendering and interaction tests for key screens (React Native Testing Library); native modules are mocked in `tests/setup.ts`.
