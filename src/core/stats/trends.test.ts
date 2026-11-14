import { describe, expect, it } from 'vitest';
import { dated, HOUR, set } from './fixtures.ts';
import { sessionDuration, sessionTrends } from './trends.ts';

const work = [set('bench-press', 100, 5), set('bench-press', 100, 4)];

describe('sessionDuration', () => {
  const base = { id: 'x', day: 'push' as const, status: 'completed' as const, createdAt: 0 };
  it('is the time from start to end in seconds', () => {
    expect(sessionDuration({ ...base, startedAt: 0, endedAt: HOUR })).toBe(3600);
  });
  it('is unknown without a start, when non-positive, or when implausibly long', () => {
    expect(sessionDuration({ ...base, startedAt: null, endedAt: HOUR })).toBeNull();
    expect(sessionDuration({ ...base, startedAt: HOUR, endedAt: HOUR })).toBeNull();
    expect(sessionDuration({ ...base, startedAt: 0, endedAt: 5 * HOUR })).toBeNull();
  });
});

describe('sessionTrends', () => {
  it('reports volume, sets and duration per session, grouped by day', () => {
    const t = sessionTrends([
      dated('a', '2026-11-02', work, { day: 'push' }),
      dated('b', '2026-11-03', [set('barbell-row', 135, 8)], { day: 'pull', status: 'ended_early' }),
    ]);
    expect(t.byDay.push).toEqual([{ id: 'a', day: 'push', date: expect.any(Number), endedEarly: false, durationSec: 3600, volume: 900, workingSets: 2 }]);
    expect(t.byDay.pull[0]).toMatchObject({ endedEarly: true, volume: 1080 });
    expect(t.byDay.legs).toEqual([]);
    expect(t.avgDurationSec).toBe(3600);
  });

  it('keeps the last N per day, oldest first', () => {
    const sessions = Array.from({ length: 12 }, (_, i) => dated(`s${i}`, `2026-10-${String(i + 1).padStart(2, '0')}`, work));
    const t = sessionTrends(sessions, 10);
    expect(t.byDay.push.map((p) => p.id)).toEqual(sessions.slice(2).map((s) => s.id));
  });

  it('skips unknown durations in the average and counts them', () => {
    const t = sessionTrends([dated('a', '2026-11-02', work), dated('b', '2026-11-03', work, { startedAt: null })]);
    expect(t.avgDurationSec).toBe(3600);
    expect(t.missingDuration).toBe(1);
    expect(sessionTrends([]).avgDurationSec).toBeNull();
  });
});
