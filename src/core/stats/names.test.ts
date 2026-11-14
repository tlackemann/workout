import { describe, expect, it } from 'vitest';
import { indexLibrary } from '../library/index.ts';
import { LIBRARY } from '../../data/library.ts';
import { exerciseLabel, humanizeId } from './names.ts';

const library = indexLibrary(LIBRARY);

describe('names', () => {
  it('humanizes retired ids back into readable names', () => {
    expect(humanizeId('leg-press')).toBe('Leg Press');
    expect(humanizeId('leg-press-calf-raise')).toBe('Leg Press Calf Raise');
    expect(humanizeId('')).toBe('');
  });

  it('labels library exercises by name and others as retired', () => {
    expect(exerciseLabel('bench-press', library)).toEqual({ name: 'Bench Press', known: true });
    expect(exerciseLabel('lying-leg-curl', library)).toEqual({ name: 'Lying Leg Curl', known: false });
  });
});
