import { describe, expect, it } from 'vitest';
import { createRng, randomSeed } from './prng.ts';

describe('createRng', () => {
  it('is deterministic for a seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    const seqA = [a(), a(), a()];
    const seqB = [b(), b(), b()];
    expect(seqA).toEqual(seqB);
  });

  it('produces values in [0, 1)', () => {
    const rng = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('differs across seeds', () => {
    expect(createRng(1)()).not.toBe(createRng(2)());
  });
});

describe('randomSeed', () => {
  it('returns a positive 32-bit integer', () => {
    const s = randomSeed();
    expect(Number.isInteger(s)).toBe(true);
    expect(s).toBeGreaterThan(0);
    expect(s).toBeLessThan(2 ** 32);
  });
});
