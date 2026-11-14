import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { addDays } from './calendar.ts';
import { consistency, streak } from './consistency.ts';
import { dated, set } from './fixtures.ts';

const work = [set('bench-press', 135, 5)];
const TODAY = '2026-11-14'; // a Saturday; week starts Mon 2026-11-09

describe('consistency', () => {
  it('buckets workouts into zero-filled Monday weeks by day type', () => {
    const c = consistency(
      [
        dated('a', '2026-11-09', work, { day: 'push' }),
        dated('b', '2026-11-11', work, { day: 'pull' }),
        dated('c', '2026-11-13', work, { day: 'legs' }),
        dated('d', '2026-11-08', work, { day: 'legs' }), // Sunday: previous week
      ],
      TODAY,
      4,
    );
    expect(c.weeks.map((w) => w.weekStart)).toEqual(['2026-10-19', '2026-10-26', '2026-11-02', '2026-11-09']);
    expect(c.weeks.at(-1)).toEqual({ weekStart: '2026-11-09', push: 1, pull: 1, legs: 1, total: 3 });
    expect(c.weeks.at(-2)?.legs).toBe(1);
    expect(c.weeks[0]?.total).toBe(0);
  });

  it('lays out a week-column heatmap with today and the future marked', () => {
    const c = consistency([dated('a', '2026-11-11', work), dated('b', '2026-11-11', work, { day: 'pull' })], TODAY, 26);
    expect(c.heatmap).toHaveLength(26);
    expect(c.heatmap.every((col) => col.length === 7)).toBe(true);
    const thisWeek = c.heatmap.at(-1)!;
    expect(thisWeek.map((cell) => cell.date)).toEqual(Array.from({ length: 7 }, (_, i) => addDays('2026-11-09', i)));
    expect(thisWeek[2]).toMatchObject({ date: '2026-11-11', workouts: 2 });
    expect(thisWeek[5]).toMatchObject({ isToday: true, future: false });
    expect(thisWeek[6]).toMatchObject({ future: true });
  });

  it('averages over complete weeks only, and only since the first workout', () => {
    expect(consistency([dated('a', '2026-11-10', work)], TODAY).avgPerWeek).toBeNull();
    const c = consistency([dated('a', '2026-10-27', work), dated('b', '2026-10-29', work), dated('c', '2026-11-03', work), dated('d', '2026-11-10', work)], TODAY);
    expect(c.avgPerWeek).toBe(1.5); // weeks of Oct 26 (2) and Nov 2 (1)
  });

  it('handles no data', () => {
    const c = consistency([], TODAY);
    expect(c.streak).toEqual({ current: 0, best: 0, thisWeek: 0 });
    expect(c.weeks.every((w) => w.total === 0)).toBe(true);
    expect(c.avgPerWeek).toBeNull();
  });
});

describe('streak', () => {
  const counts = (entries: [string, number][]) => new Map(entries);

  it('counts consecutive active weeks back from this week', () => {
    expect(streak(counts([['2026-11-09', 2], ['2026-11-02', 3], ['2026-10-26', 1]]), '2026-11-09')).toEqual({ current: 3, best: 3, thisWeek: 2 });
  });

  it('stays alive while this week is still in progress', () => {
    expect(streak(counts([['2026-11-02', 3], ['2026-10-26', 1]]), '2026-11-09')).toEqual({ current: 2, best: 2, thisWeek: 0 });
  });

  it('breaks on a missed week but remembers the best run', () => {
    const s = streak(counts([['2026-11-09', 1], ['2026-10-26', 1], ['2026-10-19', 1], ['2026-10-12', 1]]), '2026-11-09');
    expect(s).toEqual({ current: 1, best: 3, thisWeek: 1 });
  });

  it('property: current never exceeds best', () => {
    fc.assert(
      fc.property(fc.uniqueArray(fc.integer({ min: 0, max: 30 }), { maxLength: 30 }), (weeksAgo) => {
        const map = new Map(weeksAgo.map((n) => [addDays('2026-11-09', -7 * n), 1] as [string, number]));
        const s = streak(map, '2026-11-09');
        expect(s.current).toBeLessThanOrEqual(s.best);
      }),
    );
  });
});
