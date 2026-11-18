import type { Library } from './library/index.ts';
import { computeTarget } from './progression/progression.ts';
import type { Exposure, ExerciseHistory, Target } from './progression/types.ts';
import type { SetLog, SetRef } from './session/types.ts';
import type { Settings } from './settings.ts';

/** Epley estimated one-rep max. */
export function estimate1rm(load: number, reps: number): number {
  if (load <= 0 || reps <= 0) return 0;
  return load * (1 + reps / 30);
}

export interface ExerciseSummary {
  readonly exerciseId: string;
  readonly sets: readonly SetLog[];
  readonly bestE1rm: number;
  readonly isPr: boolean;
  readonly next: Target | null;
}

export interface SessionSummary {
  readonly durationSec: number;
  readonly volume: number;
  readonly workingSets: number;
  readonly skippedSets: number;
  readonly exercises: readonly ExerciseSummary[];
}

export interface SummaryInput {
  readonly logs: readonly SetLog[];
  readonly skipped: readonly SetRef[];
  readonly startedAt: number;
  readonly endedAt: number;
  /** History *before* this session, most recent first per exercise. */
  readonly history: ExerciseHistory;
  readonly library: Library;
  readonly settings: Settings;
  readonly now: number;
}

/** Best Epley e1RM across a group of sets (0 for bodyweight / no sets). */
export const bestE1rm = (sets: readonly { readonly reps: number; readonly load: number }[]): number =>
  sets.reduce((best, s) => Math.max(best, estimate1rm(s.load, s.reps)), 0);

function exposureFrom(working: readonly SetLog[], warmups: readonly SetLog[], now: number): Exposure | null {
  const first = working[0];
  if (!first) return null;
  return {
    sessionId: 'current',
    date: now,
    repMin: first.repMin,
    repMax: first.repMax,
    plannedSets: first.plannedSets,
    sets: working.map((s) => ({ reps: s.reps, load: s.load })),
    warmups: warmups.map((s) => ({ reps: s.reps, load: s.load })),
  };
}

function summarizeExercise(exerciseId: string, sets: readonly SetLog[], input: SummaryInput): ExerciseSummary {
  const working = sets.filter((s) => s.kind === 'working');
  const past = input.history[exerciseId] ?? [];
  const best = bestE1rm(working);
  const prevBest = Math.max(0, ...past.map((e) => bestE1rm(e.sets)));
  const exercise = input.library.get(exerciseId);
  const current = exposureFrom(working, sets.filter((s) => s.kind === 'warmup'), input.now);
  const next =
    exercise && current
      ? computeTarget({
          exercise,
          repMin: current.repMin,
          repMax: current.repMax,
          sets: current.plannedSets,
          exposures: [current, ...past],
          settings: input.settings,
          startLoad: null,
          now: input.now,
        })
      : null;
  return { exerciseId, sets, bestE1rm: best, isPr: past.length > 0 && best > prevBest, next };
}

export function summarize(input: SummaryInput): SessionSummary {
  const working = input.logs.filter((l) => l.kind === 'working');
  const order = [...new Set(input.logs.map((l) => l.exerciseId))];
  return {
    durationSec: Math.max(0, Math.round((input.endedAt - input.startedAt) / 1000)),
    volume: working.reduce((sum, l) => sum + l.reps * l.load, 0),
    workingSets: working.length,
    skippedSets: input.skipped.length,
    exercises: order.map((id) => summarizeExercise(id, input.logs.filter((l) => l.exerciseId === id), input)),
  };
}
