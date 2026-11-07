import { describe, expect, it } from 'vitest';
import { warmupSets } from './warmups.ts';
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
