/**
 * Seeded randomness. The generator state lives in GameState.rng, so a save restores the exact
 * sequence and the same seed + command sequence always produces the same game.
 */

/** mulberry32 step: returns [value in 0..1, next state] */
export function nextRandom(stateValue: number): [number, number] {
  const next = (stateValue + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return [value, next];
}

/** Draws from the state's generator and advances it in place. */
export function random(state: { rng: number }): number {
  const [value, next] = nextRandom(state.rng);
  state.rng = next;
  return value;
}

/** Hash a string seed to a 32-bit integer (FNV-1a). */
export function hashSeed(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
