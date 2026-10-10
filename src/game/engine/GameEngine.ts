/**
 * GameEngine: the only way the app changes the authoritative state.
 *
 * - Fixed timestep: real time × speed accumulates, and the engine runs whole ticks of
 *   TICK_SECONDS. Rendering runs independently and only reads snapshots.
 * - Every snapshot is an immutable value: a batch of ticks or a command works on a clone, then
 *   replaces the current state. React can compare references safely.
 * - Deterministic: the same initial state and command sequence give the same result.
 */
import { executeCommand } from './commands';
import { TICK_SECONDS } from './constants';
import { cloneState } from './helpers';
import { initializeNewGame, type NewGameOptions } from './newGame';
import { simulateOffline } from './offline';
import { tick } from './step';
import type { Command, CommandResult, GameState } from './types';
import { validateGameState, type ValidationResult } from './validate';

/** Never run more than this many ticks per update call (protects against long frame stalls). */
export const MAX_TICKS_PER_UPDATE = 48;

export class GameEngine {
  private state: GameState;
  private accumulator = 0;
  private paused = false;

  constructor(state?: GameState) {
    this.state = state ?? initializeNewGame();
  }

  initializeNewGame(opts?: NewGameOptions): GameState {
    this.state = initializeNewGame(opts);
    this.accumulator = 0;
    return this.state;
  }

  /** Advance by real seconds at a speed multiplier. Returns the number of ticks run. */
  updateSimulation(deltaSeconds: number, speed = 1): number {
    if (this.paused || this.state.gameOver || !(deltaSeconds > 0) || speed <= 0) return 0;
    this.accumulator += Math.min(deltaSeconds, 1) * speed;
    let n = Math.floor(this.accumulator / TICK_SECONDS + 1e-9);
    if (n <= 0) return 0;
    n = Math.min(n, MAX_TICKS_PER_UPDATE);
    this.accumulator = Math.max(0, this.accumulator - n * TICK_SECONDS);
    if (this.accumulator > TICK_SECONDS * MAX_TICKS_PER_UPDATE) this.accumulator = 0;
    const draft = cloneState(this.state);
    for (let i = 0; i < n && !draft.gameOver; i++) tick(draft, TICK_SECONDS);
    this.state = draft;
    return n;
  }

  /** Run an exact number of ticks (tests, tools). */
  runTicks(n: number): GameState {
    const draft = cloneState(this.state);
    for (let i = 0; i < n && !draft.gameOver; i++) tick(draft, TICK_SECONDS);
    this.state = draft;
    return this.state;
  }

  pauseSimulation() {
    this.paused = true;
  }

  resumeSimulation() {
    this.paused = false;
  }

  isPaused() {
    return this.paused;
  }

  executeCommand(cmd: Command): CommandResult {
    const result = executeCommand(this.state, cmd);
    if (result.ok) this.state = result.state;
    return result;
  }

  getSnapshot(): GameState {
    return this.state;
  }

  serializeGame(): string {
    return JSON.stringify(this.state);
  }

  restoreGame(save: unknown): ValidationResult {
    const result = GameEngine.validateGameState(cloneState(save));
    if (result.ok) {
      this.state = result.state;
      this.accumulator = 0;
    }
    return result;
  }

  applyOffline(seconds: number, capped = 0) {
    const { state, summary } = simulateOffline(this.state, seconds, capped);
    this.state = state;
    return summary;
  }

  static validateGameState(state: unknown): ValidationResult {
    return validateGameState(state);
  }
}
