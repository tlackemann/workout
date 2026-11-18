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

/** Missed the bottom of the range at the top load (a missed heavier attempt above it doesn't count). */
function failed(exposure: Exposure): boolean {
  return topSet(exposure).sets.some((s) => s.reps < exposure.repMin);
}

export interface TopSet {
  /** Heaviest load that met the bottom of the rep range (or the heaviest at all, if none did). */
  readonly load: number;
  /** Every set done at that load, in order. */
  readonly sets: readonly LoggedSet[];
}

/**
 * The best weight actually handled in an exposure. Sets are often ramped (first sets light,
 * then heavier), so the first set says little about what the lifter can do.
 */
export function topSet(exposure: Pick<Exposure, 'sets' | 'repMin'>): TopSet {
  const qualifying = exposure.sets.filter((s) => s.reps >= exposure.repMin);
  const pool = qualifying.length > 0 ? qualifying : exposure.sets;
  const load = Math.max(0, ...pool.map((s) => s.load));
  return { load, sets: exposure.sets.filter((s) => s.load === load) };
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function result(load: number, reps: number[], reason: TargetReason, lastLoad: number | null): Target {
  return { load, reps, reason, promote: reason === 'promote', lastLoad };
}

/** Per-set +1 rep, clamped into [repMin, repMax]. */
function addReps(done: readonly LoggedSet[], sets: number, repMin: number, repMax: number): number[] {
  return Array.from({ length: sets }, (_, i) => clamp((done[i]?.reps ?? repMin) + 1, repMin, repMax));
}

function toppedOut(done: readonly LoggedSet[], sets: number, repMax: number): boolean {
  return done.length >= sets && done.slice(0, sets).every((s) => s.reps >= repMax);
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

  const top = topSet(last);
  const lastLoad = top.load;
  if (now - last.date > STALE_AFTER_MS) {
    return result(snapDown(lastLoad * DELOAD_FACTOR, options), fill(sets, repMin), 'stale', lastLoad);
  }

  const recent = complete.slice(0, 2);
  if (recent.length === 2 && recent.every(failed)) {
    return result(snapDown(lastLoad * DELOAD_FACTOR, options), fill(sets, repMin), 'deload', lastLoad);
  }

  if (exercise.load.type === 'bodyweight') {
    return toppedOut(last.sets, sets, repMax)
      ? result(0, fill(sets, repMax), 'promote', lastLoad)
      : result(0, addReps(last.sets, sets, repMin, repMax), 'add_reps', lastLoad);
  }

  return progressLoaded(top, options, { exercise, repMin, repMax, sets, settings });
}

/** Double progression on the top load; a top load not yet held for every set is consolidated first. */
function progressLoaded(
  top: TopSet,
  options: readonly number[],
  ctx: Pick<TargetInput, 'exercise' | 'repMin' | 'repMax' | 'sets' | 'settings'>,
): Target {
  const { exercise, repMin, repMax, sets, settings } = ctx;
  const lastLoad = top.load;
  const heaviest = options.at(-1) ?? lastLoad;
  const atMax = lastLoad >= heaviest;
  const effectiveMax = atMax ? repMax + MAXED_REP_EXTENSION : repMax;

  if (top.sets.length < sets) {
    const held = Math.min(...top.sets.map((s) => s.reps));
    return result(lastLoad, fill(sets, clamp(held, repMin, effectiveMax)), 'consolidate', lastLoad);
  }

  if (!atMax && toppedOut(top.sets, sets, repMax)) {
    const next = snapUp(lastLoad + loadIncrement(exercise, settings), options);
    return result(next, fill(sets, repMin), 'progress', lastLoad);
  }

  if (atMax && toppedOut(top.sets, sets, effectiveMax)) {
    return result(lastLoad, fill(sets, effectiveMax), 'maxed', lastLoad);
  }
  return result(lastLoad, addReps(top.sets, sets, repMin, effectiveMax), 'add_reps', lastLoad);
}
