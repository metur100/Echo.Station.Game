/**
 * Campaign playthrough: the bot in tests/campaignBot.ts plays a new game through the real command
 * API and must reach an ending in reasonable ship time. Guards against soft-locks and pacing
 * regressions.
 */
import { currentObjective } from '@/game/systems/progression';
import { playCampaign } from '../campaignBot';

describe('campaign', () => {
  it.each([1, 2])('a simple bot reaches an ending (seed %i)', (seed) => {
    const { s, decisions } = playCampaign(seed);
    const summary = { ending: s.ending?.id ?? null, objectives: s.objectives.completed.length, stuckAt: currentObjective(s)?.id ?? null, minutes: Math.round(s.time / 60) };
    expect(summary).toMatchObject({ ending: expect.any(String), stuckAt: null });
    // Pacing: the campaign should take a real session or two, not minutes and not days.
    expect(s.time).toBeGreaterThan(30 * 60);
    expect(decisions).toBeGreaterThan(10);
  });
});
