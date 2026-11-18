import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { loadableTotals, nearestLoadable, nextLoadable, platesPerSide, roundDownLoadable, type PlatePair } from './plates.ts';

const HOME: PlatePair[] = [
  { weight: 45, pairs: 4 },
  { weight: 25, pairs: 1 },
  { weight: 10, pairs: 2 },
  { weight: 5, pairs: 1 },
  { weight: 2.5, pairs: 1 },
];

describe('platesPerSide', () => {
  it('returns the empty bar', () => {
    expect(platesPerSide(45, 45, HOME)).toEqual([]);
  });

  it('uses the fewest plates', () => {
    expect(platesPerSide(135, 45, HOME)).toEqual([45]);
    expect(platesPerSide(185, 45, HOME)).toEqual([45, 25]);
    expect(platesPerSide(160, 45, HOME)).toEqual([45, 10, 2.5]);
  });

  it('respects the limited inventory where greedy would fail', () => {
    const limited: PlatePair[] = [
      { weight: 45, pairs: 1 },
      { weight: 35, pairs: 1 },
      { weight: 25, pairs: 1 },
    ];
    // 60/side: greedy takes 45 and gets stuck; DP finds 35 + 25.
    expect(platesPerSide(165, 45, limited)).toEqual([35, 25]);
    expect(platesPerSide(235, 45, HOME)).toEqual([45, 45, 5]);
    expect(platesPerSide(105, 45, HOME)).toEqual([25, 5]);
  });

  it('returns null for an impossible total', () => {
    expect(platesPerSide(46, 45, HOME)).toBeNull();
    expect(platesPerSide(10_000, 45, HOME)).toBeNull();
    expect(platesPerSide(20, 45, HOME)).toBeNull();
  });
});

describe('loadableTotals', () => {
  it('is sorted, unique and starts at the bar', () => {
    const totals = loadableTotals(45, HOME);
    expect(totals[0]).toBe(45);
    expect([...totals].sort((a, b) => a - b)).toEqual(totals);
    expect(new Set(totals).size).toBe(totals.length);
  });

  it('every total is actually loadable', () => {
    fc.assert(
      fc.property(fc.constantFrom(...loadableTotals(45, HOME)), (total) => platesPerSide(total, 45, HOME) !== null),
    );
  });
});

describe('nextLoadable / roundDownLoadable', () => {
  const totals = loadableTotals(45, HOME);

  it('finds the smallest loadable total at or above a target', () => {
    expect(nextLoadable(140, totals)).toBe(140);
    expect(nextLoadable(141, totals)).toBe(145);
  });

  it('clamps to the heaviest loadable total', () => {
    expect(nextLoadable(10_000, totals)).toBe(totals.at(-1));
  });

  it('rounds down to a loadable total but never below the bar', () => {
    expect(roundDownLoadable(143, totals)).toBe(140);
    expect(roundDownLoadable(10, totals)).toBe(45);
  });
});

describe('nearestLoadable', () => {
  const totals = [45, 50, 55, 65, 95];

  it('picks the closest loadable total', () => {
    expect(nearestLoadable(63, totals)).toBe(65);
    expect(nearestLoadable(51, totals)).toBe(50);
    expect(nearestLoadable(94.5, totals)).toBe(95);
  });

  it('takes the lighter total on a tie', () => {
    expect(nearestLoadable(60, totals)).toBe(55);
  });

  it('clamps outside the loadable range', () => {
    expect(nearestLoadable(10, totals)).toBe(45);
    expect(nearestLoadable(500, totals)).toBe(95);
  });
});
