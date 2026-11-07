import { describe, expect, it } from 'vitest';
import { indexLibrary, requireExercise } from './library/index.ts';
import { loadIncrement, loadOptions } from './loads.ts';
import { DEFAULT_SETTINGS } from './settings.ts';
import { LIBRARY } from '../data/library.ts';

const lib = indexLibrary(LIBRARY);
const s = DEFAULT_SETTINGS;

describe('loadOptions', () => {
  it('barbell options start at the bar', () => {
    expect(loadOptions(requireExercise(lib, 'bench-press'), s)[0]).toBe(45);
  });

  it('EZ bar options start at the EZ bar weight', () => {
    expect(loadOptions(requireExercise(lib, 'ez-curl'), s)[0]).toBe(25);
  });

  it('stack options follow the station profile', () => {
    const opts = loadOptions(requireExercise(lib, 'leg-press'), {
      ...s,
      stations: { ...s.stations, 'mx.leg_press': { min: 20, max: 60, step: 20 } },
    });
    expect(opts).toEqual([20, 40, 60]);
  });

  it('bodyweight has a single zero option', () => {
    expect(loadOptions(requireExercise(lib, 'pushup'), s)).toEqual([0]);
  });

  it('dumbbells step by the dumbbell step', () => {
    expect(loadOptions(requireExercise(lib, 'db-curl'), s).slice(0, 3)).toEqual([5, 10, 15]);
  });
});

describe('loadIncrement', () => {
  it('uses lower/upper body barbell increments', () => {
    expect(loadIncrement(requireExercise(lib, 'back-squat'), s)).toBe(10);
    expect(loadIncrement(requireExercise(lib, 'bench-press'), s)).toBe(5);
  });

  it('uses the station step for stacks and zero for bodyweight', () => {
    expect(loadIncrement(requireExercise(lib, 'leg-press'), s)).toBe(10);
    expect(loadIncrement(requireExercise(lib, 'pushup'), s)).toBe(0);
  });
});
