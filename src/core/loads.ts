import type { ExerciseDef } from './library/schema.ts';
import { loadableTotals, nextLoadable, roundDownLoadable, stepLoadable } from './plates.ts';
import type { Settings } from './settings.ts';

const DUMBBELL_MAX = 150;
const DEFAULT_STACK = { min: 10, max: 200, step: 10 };

function range(min: number, max: number, step: number): number[] {
  const count = Math.floor((max - min) / step + 1e-9) + 1;
  return Array.from({ length: count }, (_, i) => Math.round((min + i * step) * 100) / 100);
}

/** Every load the user can actually set for this exercise, ascending. */
export function loadOptions(exercise: ExerciseDef, settings: Settings): number[] {
  const load = exercise.load;
  switch (load.type) {
    case 'barbell':
      return loadableTotals(settings.barWeight, settings.plates);
    case 'ez_bar':
      return loadableTotals(settings.ezBarWeight, settings.plates);
    case 'dumbbell':
      return range(settings.dumbbellStep, DUMBBELL_MAX, settings.dumbbellStep);
    case 'stack': {
      const station = settings.stations[load.station] ?? DEFAULT_STACK;
      return range(station.min, station.max, station.step);
    }
    case 'bodyweight':
      return [0];
  }
}

/** The weight jump used when double progression says "add weight". */
export function loadIncrement(exercise: ExerciseDef, settings: Settings): number {
  const load = exercise.load;
  switch (load.type) {
    case 'barbell':
      return load.lower ? settings.increments.lower : settings.increments.upper;
    case 'ez_bar':
      return settings.increments.upper;
    case 'dumbbell':
      return settings.dumbbellStep;
    case 'stack':
      return (settings.stations[load.station] ?? DEFAULT_STACK).step;
    case 'bodyweight':
      return 0;
  }
}

export function isLoaded(exercise: ExerciseDef): boolean {
  return exercise.load.type !== 'bodyweight';
}

export const snapUp = nextLoadable;
export const snapDown = roundDownLoadable;
export const step = stepLoadable;
