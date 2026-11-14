import type { Day } from '../days.ts';
import type { Library } from '../library/index.ts';
import type { ExerciseHistory } from '../progression/types.ts';
import type { Prefs, Settings } from '../settings.ts';
import type { ExerciseDef } from '../library/schema.ts';
import { isEligible } from '../equipment.ts';

export interface GenContext {
  readonly day: Day;
  readonly now: number;
  readonly settings: Settings;
  readonly prefs: Prefs;
  readonly history: ExerciseHistory;
  readonly library: Library;
  readonly available: ReadonlySet<string>;
  /** Exercise id → how many sessions of this day ago it was last used (0 = the last one). */
  readonly recency: ReadonlyMap<string, number>;
}

export function usable(ctx: GenContext, exercise: ExerciseDef | undefined): exercise is ExerciseDef {
  return !!exercise && !ctx.prefs[exercise.id]?.banned && isEligible(exercise.requires, ctx.available);
}
