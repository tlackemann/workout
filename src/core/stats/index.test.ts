import { describe, expect, it } from 'vitest';
import { indexLibrary } from '../library/index.ts';
import { LIBRARY } from '../../data/library.ts';
import { buildStats } from './index.ts';
import type { SessionFact, WorkingSetFact } from './types.ts';

const library = indexLibrary(LIBRARY);
const NOW = Date.UTC(2026, 10, 14, 17); // Sat 12:00 in New York
const HOUR = 3_600_000;

const session = (id: string, endedAt: number, overrides: Partial<SessionFact> = {}): SessionFact => ({
  id,
  day: 'push',
  status: 'completed',
  createdAt: endedAt - 2 * HOUR,
  startedAt: endedAt - HOUR,
  endedAt,
  ...overrides,
});
const set = (sessionId: string, reps = 5): WorkingSetFact => ({ sessionId, exerciseId: 'bench-press', reps, load: 135, loggedAt: 0 });

describe('buildStats', () => {
  it('returns a complete, empty result with no data', () => {
    const stats = buildStats({ sessions: [], sets: [], library, now: NOW, tz: 'America/New_York' });
    expect(stats).toMatchObject({ workouts: 0, lifts: [], today: '2026-11-14', tz: 'America/New_York' });
    expect(stats.consistency.weeks).toHaveLength(26);
    expect(stats.muscles.rows.every((r) => r.total === 0)).toBe(true);
  });

  it('only counts sessions with logged working sets, dated in the given zone', () => {
    const sunEvening = Date.UTC(2026, 10, 9, 2); // Sun Nov 8, 21:00 in New York
    const stats = buildStats({
      sessions: [session('a', sunEvening), session('empty', NOW - HOUR), session('zero', NOW - 2 * HOUR)],
      sets: [set('a'), set('zero', 0)],
      library,
      now: NOW,
      tz: 'America/New_York',
    });
    expect(stats.workouts).toBe(1);
    expect(stats.consistency.weeks.at(-2)?.total).toBe(1); // week of Nov 2, not Nov 9
    expect(stats.consistency.streak).toEqual({ current: 1, best: 1, thisWeek: 0 });
    expect(stats.lifts[0]?.points).toHaveLength(1);
  });
});
