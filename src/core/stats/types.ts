import type { Day } from '../days.ts';
import type { Library } from '../library/index.ts';
import type { Muscle } from '../muscles.ts';

/** Local calendar date in the stats time zone, 'YYYY-MM-DD'. Sorts chronologically as a string. */
export type DayKey = string;

export interface SessionFact {
  readonly id: string;
  readonly day: Day;
  readonly status: 'completed' | 'ended_early';
  readonly createdAt: number;
  readonly startedAt: number | null;
  readonly endedAt: number | null;
}

export interface WorkingSetFact {
  readonly sessionId: string;
  readonly exerciseId: string;
  readonly reps: number;
  readonly load: number;
  readonly loggedAt: number;
}

export interface StatsInput {
  readonly sessions: readonly SessionFact[];
  readonly sets: readonly WorkingSetFact[];
  readonly library: Library;
  /** When each finished stretch session ended. Shown on the heatmap; never counted as a workout. */
  readonly stretches?: readonly number[];
  readonly now: number;
  /** IANA time zone the calendar (days, weeks, streaks) is computed in. */
  readonly tz: string;
}

/** A finished session with its date resolved and its (non-empty) working sets attached. */
export interface DatedSession extends SessionFact {
  readonly date: number;
  readonly dayKey: DayKey;
  readonly sets: readonly WorkingSetFact[];
}

export type LiftMetric = 'e1rm' | 'reps';

export interface LiftPoint {
  readonly sessionId: string;
  readonly date: number;
  /** Epley estimated 1RM of the best set (0 for bodyweight). */
  readonly e1rm: number;
  readonly topLoad: number;
  /** Reps of the heaviest set. */
  readonly topReps: number;
  readonly bestReps: number;
  readonly sets: number;
  readonly isPr: boolean;
}

export interface LiftSeries {
  readonly exerciseId: string;
  readonly name: string;
  /** False for exercises no longer in the library (shown as retired). */
  readonly known: boolean;
  /** What the chart and PRs track: estimated 1RM, or best reps for bodyweight work. */
  readonly metric: LiftMetric;
  /** Oldest first, newest last (capped). */
  readonly points: readonly LiftPoint[];
  readonly best: number;
  readonly prCount: number;
  readonly lastAt: number;
}

export interface WeekBucket {
  readonly weekStart: DayKey;
  readonly push: number;
  readonly pull: number;
  readonly legs: number;
  readonly total: number;
}

export interface HeatCell {
  readonly date: DayKey;
  readonly workouts: number;
  /** Stretch sessions that day (recovery, not workouts). */
  readonly stretches: number;
  readonly isToday: boolean;
  readonly future: boolean;
}

export interface Streak {
  /** Consecutive weeks (Mon–Sun) with at least one workout. This week only breaks it once it's over. */
  readonly current: number;
  readonly best: number;
  /** Workouts so far this week. */
  readonly thisWeek: number;
}

export interface Consistency {
  /** Oldest first, one per week, zero-filled. */
  readonly weeks: readonly WeekBucket[];
  /** One column per week (same order as `weeks`), each Mon..Sun. */
  readonly heatmap: readonly (readonly HeatCell[])[];
  readonly streak: Streak;
  /** Average workouts per complete week (up to the last 8); null before the first full week. */
  readonly avgPerWeek: number | null;
}

export interface SessionPoint {
  readonly id: string;
  readonly day: Day;
  readonly date: number;
  readonly endedEarly: boolean;
  /** Null when unknown or implausible (no start time, or left running for hours). */
  readonly durationSec: number | null;
  readonly volume: number;
  readonly workingSets: number;
}

export interface SessionTrends {
  /** The most recent sessions per day, oldest first. */
  readonly byDay: Readonly<Record<Day, readonly SessionPoint[]>>;
  readonly avgDurationSec: number | null;
  readonly missingDuration: number;
}

export interface MuscleRow {
  readonly muscle: Muscle;
  readonly primary: number;
  /** Secondary-muscle credit, already halved. */
  readonly secondary: number;
  readonly total: number;
  readonly perWeek: number;
}

export interface MuscleBalance {
  readonly from: DayKey;
  readonly to: DayKey;
  /** Weeks the per-week figures average over (1–4: shorter for a new lifter). */
  readonly weeks: number;
  /** Every muscle, in `MUSCLES` order. */
  readonly rows: readonly MuscleRow[];
  /** Sets from exercises no longer in the library (no muscle data). */
  readonly unmappedSets: number;
  readonly unmappedNames: readonly string[];
}

export interface StatsDto {
  readonly generatedAt: number;
  readonly tz: string;
  readonly today: DayKey;
  readonly workouts: number;
  /** Finished stretch sessions, all time. */
  readonly stretches: number;
  readonly lifts: readonly LiftSeries[];
  readonly consistency: Consistency;
  readonly sessions: SessionTrends;
  readonly muscles: MuscleBalance;
}
