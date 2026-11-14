import { describe, expect, it } from 'vitest';
import { indexLibrary } from '../library/index.ts';
import { MUSCLES } from '../muscles.ts';
import { LIBRARY } from '../../data/library.ts';
import { dated, set } from './fixtures.ts';
import { muscleBalance } from './muscleBalance.ts';

const library = indexLibrary(LIBRARY);
const TODAY = '2026-11-28';
const row = (b: ReturnType<typeof muscleBalance>, muscle: string) => b.rows.find((r) => r.muscle === muscle)!;

describe('muscleBalance', () => {
  it('credits primary muscles 1 set and secondary muscles half a set', () => {
    // Bench: chest primary; front delts + triceps secondary.
    const b = muscleBalance([dated('a', '2026-11-20', [set('bench-press', 135, 5), set('bench-press', 135, 5)])], library, TODAY);
    expect(row(b, 'chest')).toMatchObject({ primary: 2, secondary: 0, total: 2 });
    expect(row(b, 'triceps')).toMatchObject({ primary: 0, secondary: 1, total: 1 });
    expect(b.rows.map((r) => r.muscle)).toEqual([...MUSCLES]);
  });

  it('counts the last 28 days inclusive', () => {
    const b = muscleBalance(
      [dated('in', '2026-11-01', [set('barbell-curl', 65, 10)]), dated('out', '2026-10-31', [set('barbell-curl', 65, 10)])],
      library,
      TODAY,
    );
    expect(b).toMatchObject({ from: '2026-11-01', to: TODAY });
    expect(row(b, 'biceps').primary).toBe(1);
  });

  it('averages per week over at most 4 weeks, fewer for a new lifter', () => {
    const recent = muscleBalance([dated('a', '2026-11-26', [set('barbell-curl', 65, 10)])], library, TODAY);
    expect(recent.weeks).toBe(1);
    expect(row(recent, 'biceps').perWeek).toBe(1);
    const veteran = muscleBalance(
      [dated('old', '2026-06-01', [set('barbell-curl', 65, 10)]), dated('a', '2026-11-26', [set('barbell-curl', 65, 10)])],
      library,
      TODAY,
    );
    expect(veteran.weeks).toBe(4);
    expect(row(veteran, 'biceps').perWeek).toBe(0.25);
  });

  it('reports retired exercises it cannot map to muscles', () => {
    const b = muscleBalance([dated('a', '2026-11-20', [set('leg-press', 200, 10), set('leg-press', 200, 10)])], library, TODAY);
    expect(b.unmappedSets).toBe(2);
    expect(b.unmappedNames).toEqual(['Leg Press']);
    expect(row(b, 'quads').total).toBe(0);
  });
});
