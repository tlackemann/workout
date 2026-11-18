export interface LoggedSet {
  readonly reps: number;
  readonly load: number;
}

/** One past session's working sets for a single exercise. */
export interface Exposure {
  readonly sessionId: string;
  readonly date: number;
  readonly repMin: number;
  readonly repMax: number;
  readonly plannedSets: number;
  readonly sets: readonly LoggedSet[];
  /** Warm-up sets logged before the working sets, in order. */
  readonly warmups: readonly LoggedSet[];
}

/** exerciseId → exposures, most recent first. */
export type ExerciseHistory = Readonly<Record<string, readonly Exposure[]>>;

export const TARGET_REASONS = ['first', 'progress', 'add_reps', 'consolidate', 'deload', 'stale', 'maxed', 'promote'] as const;
/** `consolidate`: last time the top load wasn't held for every set, so do all sets there. */
export type TargetReason = (typeof TARGET_REASONS)[number];

export interface Target {
  readonly load: number;
  readonly reps: readonly number[];
  readonly reason: TargetReason;
  /** Bodyweight exercise topped out: ready for the next variant in its chain. */
  readonly promote: boolean;
  readonly lastLoad: number | null;
}
