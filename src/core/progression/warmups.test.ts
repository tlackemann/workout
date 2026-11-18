import { describe, expect, it } from 'vitest';
import { learnedOpener, warmupSets } from './warmups.ts';
import type { Exposure, LoggedSet } from './types.ts';
import { loadableTotals } from '../plates.ts';
import { DEFAULT_SETTINGS } from '../settings.ts';

const options = loadableTotals(45, DEFAULT_SETTINGS.plates);

describe('warmupSets', () => {
  it('ramps bar → 50% → 70% → 85% for a heavy working load', () => {
    expect(warmupSets(225, options, 45)).toEqual([
      { reps: 10, load: 45 },
      { reps: 5, load: 110 },
      { reps: 3, load: 155 },
      { reps: 1, load: 190 },
    ]);
  });

  it('drops duplicate and too-light steps for light working loads', () => {
    const sets = warmupSets(95, options, 45);
    expect(sets[0]).toEqual({ reps: 10, load: 45 });
    const loads = sets.map((s) => s.load);
    expect(new Set(loads).size).toBe(loads.length);
    expect(loads.every((l) => l < 95)).toBe(true);
    expect([...loads].sort((a, b) => a - b)).toEqual(loads);
  });

  it('returns nothing when working with the empty bar', () => {
    expect(warmupSets(45, options, 45)).toEqual([]);
  });
});

describe('warmupSets with a learned opener', () => {
  it('opens at the given load, then keeps only the ramp steps above it', () => {
    expect(warmupSets(115, options, 45, 65)).toEqual([
      { reps: 10, load: 65 },
      { reps: 3, load: 80 },
      { reps: 1, load: 95 },
    ]);
  });

  it('never opens below the bar', () => {
    expect(warmupSets(225, options, 45, 20)[0]).toEqual({ reps: 10, load: 45 });
  });

  it('drops an opener at or above the working load', () => {
    expect(warmupSets(115, options, 45, 115).every((s) => s.load < 115)).toBe(true);
  });
});

describe('learnedOpener', () => {
  let day = 0;
  function exposure(working: [load: number, reps: number][], warmups: LoggedSet[]): Exposure {
    day += 1;
    return {
      sessionId: `s${day}`,
      date: day,
      repMin: 5,
      repMax: 8,
      plannedSets: working.length,
      sets: working.map(([load, reps]) => ({ load, reps })),
      warmups,
    };
  }
  const w = (load: number, reps = 10): LoggedSet => ({ load, reps });

  it('falls back to the bar without any logged warm-ups', () => {
    expect(learnedOpener([], 115, options, 45)).toBe(45);
    expect(learnedOpener([exposure([[115, 7]], [])], 115, options, 45)).toBe(45);
  });

  it('reproduces the last opener when the working load is unchanged', () => {
    const bench = exposure([[95, 7], [95, 7], [115, 7], [115, 7]], [w(65), w(65, 3), w(95, 1)]);
    expect(learnedOpener([bench], 115, options, 45)).toBe(65);
  });

  it('scales the opener with the working load (relative to the top set), rounded to a loadable weight', () => {
    const squat = exposure([[95, 7], [95, 7], [115, 7], [135, 7]], [w(95)]);
    // 95 / 135 ≈ 0.70 of 155 ≈ 109 → 110
    expect(learnedOpener([squat], 155, options, 45)).toBe(110);
  });

  it('uses the most recent exposure that logged warm-ups', () => {
    const skipped = exposure([[115, 7]], []);
    const older = exposure([[100, 7]], [w(45)]);
    const recent = exposure([[100, 7]], [w(65)]);
    expect(learnedOpener([skipped, recent, older], 100, options, 45)).toBe(65);
  });

  it('ignores warm-ups logged at or above the working weight', () => {
    const lazy = exposure([[95, 7]], [w(95), w(95, 3)]);
    const real = exposure([[95, 7]], [w(65)]);
    expect(learnedOpener([lazy, real], 95, options, 45)).toBe(65);
  });

  it('stays below the working load', () => {
    const close = exposure([[100, 7]], [w(95)]);
    expect(learnedOpener([close], 60, options, 45)).toBeLessThan(60);
    expect(learnedOpener([close], 60, options, 45)).toBeGreaterThanOrEqual(45);
  });
});
