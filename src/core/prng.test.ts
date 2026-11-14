import { describe, expect, it } from 'vitest';
import { shuffled, createRng, randomSeed } from './prng.ts';

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

describe('shuffled', () => {
  it('returns a permutation without touching the input', () => {
    const input = Object.freeze([1, 2, 3, 4, 5, 6]);
    const out = shuffled(input, createRng(42));
    expect([...out].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(input).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('is deterministic per seed and varies across seeds', () => {
    const list = ['a', 'b', 'c', 'd', 'e'];
    expect(shuffled(list, createRng(7))).toEqual(shuffled(list, createRng(7)));
    const orders = new Set(Array.from({ length: 20 }, (_, i) => shuffled(list, createRng(i + 1)).join('')));
    expect(orders.size).toBeGreaterThan(5);
  });

  it('handles empty and single lists', () => {
    expect(shuffled([], createRng(1))).toEqual([]);
    expect(shuffled(['x'], createRng(1))).toEqual(['x']);
  });
});
