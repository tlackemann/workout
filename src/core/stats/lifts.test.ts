import { describe, expect, it } from 'vitest';
import { indexLibrary } from '../library/index.ts';
import { LIBRARY } from '../../data/library.ts';
import { dated, set } from './fixtures.ts';
import { liftSeries } from './lifts.ts';

const library = indexLibrary(LIBRARY);
const bench = (load: number, reps: number) => set('bench-press', load, reps);

describe('liftSeries', () => {
  it('builds one point per session from the best set, oldest first', () => {
    const [series] = liftSeries([dated('a', '2026-11-02', [bench(135, 8), bench(155, 5), bench(155, 4)]), dated('b', '2026-11-09', [bench(160, 5)])], library);
    expect(series?.name).toBe('Bench Press');
    expect(series?.metric).toBe('e1rm');
    expect(series?.points.map((p) => p.sessionId)).toEqual(['a', 'b']);
    expect(series?.points[0]).toMatchObject({ topLoad: 155, topReps: 5, bestReps: 8, sets: 3 });
    expect(series?.points[0]?.e1rm).toBeCloseTo(155 * (1 + 5 / 30));
  });

  it('flags PRs only after the first session and only when strictly better', () => {
    const [series] = liftSeries(
      [dated('a', '2026-11-02', [bench(150, 5)]), dated('b', '2026-11-05', [bench(150, 5)]), dated('c', '2026-11-09', [bench(155, 5)])],
      library,
    );
    expect(series?.points.map((p) => p.isPr)).toEqual([false, false, true]);
    expect(series?.prCount).toBe(1);
    expect(series?.best).toBeCloseTo(155 * (1 + 5 / 30));
  });

  it('tracks best reps for bodyweight exercises', () => {
    const [series] = liftSeries([dated('a', '2026-11-02', [set('pushup', 0, 12)]), dated('b', '2026-11-09', [set('pushup', 0, 15), set('pushup', 0, 11)])], library);
    expect(series).toMatchObject({ metric: 'reps', best: 15, prCount: 1 });
    expect(series?.points.map((p) => p.bestReps)).toEqual([12, 15]);
  });

  it('keeps retired exercises, named and sorted last', () => {
    const lifts = liftSeries(
      [dated('a', '2026-11-02', [set('leg-press', 140, 10), bench(135, 5)]), dated('b', '2026-11-03', [set('leg-press', 150, 10)])],
      library,
    );
    expect(lifts.map((l) => l.name)).toEqual(['Bench Press', 'Leg Press']);
    expect(lifts[1]).toMatchObject({ known: false, metric: 'e1rm' });
  });

  it('uses best reps for a retired exercise that was only ever bodyweight', () => {
    const [series] = liftSeries([dated('a', '2026-11-02', [set('old-plank', 0, 30)])], library);
    expect(series?.metric).toBe('reps');
  });

  it('sorts by how often a lift was trained, then by recency', () => {
    const lifts = liftSeries(
      [
        dated('a', '2026-11-02', [bench(135, 5), set('pec-fly', 60, 12)]),
        dated('b', '2026-11-05', [bench(135, 5), set('triceps-pushdown', 50, 12)]),
      ],
      library,
    );
    expect(lifts.map((l) => l.exerciseId)).toEqual(['bench-press', 'triceps-pushdown', 'pec-fly']);
  });

  it('caps the points but keeps PR flags computed over the full history', () => {
    const sessions = Array.from({ length: 130 }, (_, i) =>
      dated(`s${i}`, `2026-01-01`, [bench(i === 0 ? 300 : 100 + i, 5)], { date: i }),
    );
    const [series] = liftSeries(sessions, library);
    expect(series?.points).toHaveLength(120);
    expect(series?.points.at(-1)?.sessionId).toBe('s129');
    expect(series?.points.some((p) => p.isPr)).toBe(false); // the 300 lb first session still stands
  });

  it('returns nothing without sets', () => {
    expect(liftSeries([], library)).toEqual([]);
  });
});
