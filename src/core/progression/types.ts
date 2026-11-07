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
}

/** exerciseId → exposures, most recent first. */
export type ExerciseHistory = Readonly<Record<string, readonly Exposure[]>>;

export type TargetReason = 'first' | 'progress' | 'add_reps' | 'deload' | 'stale' | 'maxed' | 'promote';

export interface Target {
  readonly load: number;
  readonly reps: readonly number[];
  readonly reason: TargetReason;
  /** Bodyweight exercise topped out: ready for the next variant in its chain. */
  readonly promote: boolean;
  readonly lastLoad: number | null;
}
