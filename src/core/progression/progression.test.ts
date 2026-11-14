import { describe, expect, it } from 'vitest';
import { computeTarget } from './progression.ts';
import type { Exposure } from './types.ts';
import { indexLibrary, requireExercise } from '../library/index.ts';
import { DEFAULT_SETTINGS } from '../settings.ts';
import { LIBRARY } from '../../data/library.ts';

const lib = indexLibrary(LIBRARY);
const DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 7);

function exposure(load: number, reps: number[], daysAgo = 3, range: [number, number] = [5, 8]): Exposure {
  return {
    sessionId: `s-${daysAgo}`,
    date: NOW - daysAgo * DAY,
    repMin: range[0],
    repMax: range[1],
    plannedSets: reps.length,
    sets: reps.map((r) => ({ reps: r, load })),
  };
}

const base = {
  repMin: 5,
  repMax: 8,
  sets: 4,
  settings: DEFAULT_SETTINGS,
  startLoad: null,
  now: NOW,
};

describe('computeTarget — barbell', () => {
  const bench = requireExercise(lib, 'bench-press');

  it('first exposure uses the library start load at the bottom of the range', () => {
    const t = computeTarget({ ...base, exercise: bench, exposures: [] });
    expect(t).toMatchObject({ load: 95, reps: [5, 5, 5, 5], reason: 'first', lastLoad: null });
  });

  it('first exposure honours a preferred start load, snapped down to loadable', () => {
    const t = computeTarget({ ...base, exercise: bench, exposures: [], startLoad: 137 });
    expect(t.load).toBe(135);
  });

  it('adds one rep per set until every set tops out', () => {
    const t = computeTarget({ ...base, exercise: bench, exposures: [exposure(135, [8, 7, 6, 5])] });
    expect(t).toMatchObject({ load: 135, reps: [8, 8, 7, 6], reason: 'add_reps', lastLoad: 135 });
  });

  it('adds the upper-body increment once all sets hit the top', () => {
    const t = computeTarget({ ...base, exercise: bench, exposures: [exposure(135, [8, 8, 8, 8])] });
    expect(t).toMatchObject({ load: 140, reps: [5, 5, 5, 5], reason: 'progress' });
  });

  it('uses the lower-body increment for squats', () => {
    const squat = requireExercise(lib, 'back-squat');
    const t = computeTarget({ ...base, exercise: squat, exposures: [exposure(185, [8, 8, 8, 8])] });
    expect(t.load).toBe(195);
  });

  it('deloads 10% after two consecutive failed exposures', () => {
    const t = computeTarget({
      ...base,
      exercise: bench,
      exposures: [exposure(185, [5, 4, 4, 3], 3), exposure(185, [5, 5, 4, 4], 6)],
    });
    expect(t).toMatchObject({ load: 165, reps: [5, 5, 5, 5], reason: 'deload' });
  });

  it('does not deload after a single failure', () => {
    const t = computeTarget({
      ...base,
      exercise: bench,
      exposures: [exposure(185, [5, 4, 4, 3], 3), exposure(185, [6, 6, 5, 5], 6)],
    });
    expect(t.reason).toBe('add_reps');
    expect(t.load).toBe(185);
    expect(t.reps).toEqual([6, 5, 5, 5]);
  });

  it('drops 10% when the exercise is stale (> 6 weeks)', () => {
    const t = computeTarget({ ...base, exercise: bench, exposures: [exposure(200, [8, 8, 8, 8], 50)] });
    expect(t).toMatchObject({ load: 180, reason: 'stale' });
  });

  it('ignores incomplete exposures (e.g. swapped out mid-exercise)', () => {
    const partial: Exposure = { ...exposure(225, [3]), plannedSets: 4 };
    const t = computeTarget({ ...base, exercise: bench, exposures: [partial, exposure(135, [8, 8, 8, 8], 7)] });
    expect(t.load).toBe(140);
  });
});

describe('computeTarget — stack', () => {
  const press = requireExercise(lib, 'leg-extension');
  const settings = {
    ...DEFAULT_SETTINGS,
    stations: { ...DEFAULT_SETTINGS.stations, 'mx.leg_ext': { min: 10, max: 200, step: 10 } },
  };

  it('adds one plate when topped out', () => {
    const t = computeTarget({ ...base, settings, repMin: 8, repMax: 12, sets: 3, exercise: press, exposures: [exposure(150, [12, 12, 12], 3, [8, 12])] });
    expect(t).toMatchObject({ load: 160, reps: [8, 8, 8], reason: 'progress' });
  });

  it('extends the rep range by 2 when the stack is maxed', () => {
    const t = computeTarget({ ...base, settings, repMin: 8, repMax: 12, sets: 3, exercise: press, exposures: [exposure(200, [12, 12, 11], 3, [8, 12])] });
    expect(t).toMatchObject({ load: 200, reps: [13, 13, 12], reason: 'add_reps' });
  });

  it('flags maxed once the extended range is topped out too', () => {
    const t = computeTarget({ ...base, settings, repMin: 8, repMax: 12, sets: 3, exercise: press, exposures: [exposure(200, [14, 14, 14], 3, [8, 12])] });
    expect(t).toMatchObject({ load: 200, reps: [14, 14, 14], reason: 'maxed' });
  });
});

describe('computeTarget — bodyweight', () => {
  const pushup = requireExercise(lib, 'pushup');

  it('progresses reps with zero load', () => {
    const t = computeTarget({ ...base, repMin: 10, repMax: 15, sets: 3, exercise: pushup, exposures: [exposure(0, [12, 11, 10], 3, [10, 15])] });
    expect(t).toMatchObject({ load: 0, reps: [13, 12, 11], reason: 'add_reps', promote: false });
  });

  it('asks for promotion once the top of the range is reached', () => {
    const t = computeTarget({ ...base, repMin: 10, repMax: 15, sets: 3, exercise: pushup, exposures: [exposure(0, [15, 15, 15], 3, [10, 15])] });
    expect(t).toMatchObject({ load: 0, reps: [15, 15, 15], reason: 'promote', promote: true });
  });
});
