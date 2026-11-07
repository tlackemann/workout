import type { ExerciseDef } from '../library/schema.ts';
import { loadIncrement, loadOptions, snapDown, snapUp } from '../loads.ts';
import type { Settings } from '../settings.ts';
import type { Exposure, LoggedSet, Target, TargetReason } from './types.ts';

const DAY_MS = 86_400_000;
export const STALE_AFTER_MS = 42 * DAY_MS;
const DELOAD_FACTOR = 0.9;
/** Extra reps allowed when a weight stack is already at its heaviest plate. */
const MAXED_REP_EXTENSION = 2;

export interface TargetInput {
  readonly exercise: ExerciseDef;
  readonly repMin: number;
  readonly repMax: number;
  readonly sets: number;
  /** Most recent first. */
  readonly exposures: readonly Exposure[];
  readonly settings: Settings;
  readonly startLoad: number | null;
  readonly now: number;
}

const fill = (count: number, reps: number) => Array.from({ length: count }, () => reps);

export function isComplete(exposure: Exposure): boolean {
  return exposure.plannedSets > 0 && exposure.sets.length >= exposure.plannedSets;
}

function failed(exposure: Exposure): boolean {
  return exposure.sets.some((s) => s.reps < exposure.repMin);
}

function workingLoad(sets: readonly LoggedSet[]): number {
  return sets[0]?.load ?? 0;
}

function result(load: number, reps: number[], reason: TargetReason, lastLoad: number | null): Target {
  return { load, reps, reason, promote: reason === 'promote', lastLoad };
}

/** Per-set +1 rep, clamped into [repMin, repMax]. */
function addReps(last: Exposure, sets: number, repMin: number, repMax: number): number[] {
  return Array.from({ length: sets }, (_, i) => {
    const prev = last.sets[i]?.reps ?? repMin;
    return Math.min(repMax, Math.max(repMin, prev + 1));
  });
}

function toppedOut(last: Exposure, sets: number, repMax: number): boolean {
  return last.sets.length >= sets && last.sets.slice(0, sets).every((s) => s.reps >= repMax);
}

/** Double progression: chase reps to the top of the range, then add weight. */
export function computeTarget(input: TargetInput): Target {
  const { exercise, repMin, repMax, sets, settings, now } = input;
  const options = loadOptions(exercise, settings);
  const complete = input.exposures.filter(isComplete);
  const last = complete[0];

  if (!last) {
    const start = input.startLoad ?? exercise.startLoad;
    return result(snapDown(start, options), fill(sets, repMin), 'first', null);
  }

  const lastLoad = workingLoad(last.sets);
  if (now - last.date > STALE_AFTER_MS) {
    return result(snapDown(lastLoad * DELOAD_FACTOR, options), fill(sets, repMin), 'stale', lastLoad);
  }

  const recent = complete.slice(0, 2);
  if (recent.length === 2 && recent.every(failed)) {
    return result(snapDown(lastLoad * DELOAD_FACTOR, options), fill(sets, repMin), 'deload', lastLoad);
  }

  if (exercise.load.type === 'bodyweight') {
    return toppedOut(last, sets, repMax)
      ? result(0, fill(sets, repMax), 'promote', lastLoad)
      : result(0, addReps(last, sets, repMin, repMax), 'add_reps', lastLoad);
  }

  return progressLoaded(last, lastLoad, options, { exercise, repMin, repMax, sets, settings });
}

function progressLoaded(
  last: Exposure,
  lastLoad: number,
  options: readonly number[],
  ctx: Pick<TargetInput, 'exercise' | 'repMin' | 'repMax' | 'sets' | 'settings'>,
): Target {
  const { exercise, repMin, repMax, sets, settings } = ctx;
  const heaviest = options.at(-1) ?? lastLoad;
  const atMax = lastLoad >= heaviest;

  if (!atMax && toppedOut(last, sets, repMax)) {
    const next = snapUp(lastLoad + loadIncrement(exercise, settings), options);
    return result(next, fill(sets, repMin), 'progress', lastLoad);
  }

  const effectiveMax = atMax ? repMax + MAXED_REP_EXTENSION : repMax;
  if (atMax && toppedOut(last, sets, effectiveMax)) {
    return result(lastLoad, fill(sets, effectiveMax), 'maxed', lastLoad);
  }
  return result(lastLoad, addReps(last, sets, repMin, effectiveMax), 'add_reps', lastLoad);
}
