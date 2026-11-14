import type { Library } from '../library/index.ts';
import { bestE1rm } from '../summary.ts';
import { exerciseLabel } from './names.ts';
import type { DatedSession, LiftMetric, LiftPoint, LiftSeries, WorkingSetFact } from './types.ts';

/** Enough for ~2 years of weekly training; older points still count toward PRs. */
export const MAX_POINTS = 120;

function pointFor(session: DatedSession, sets: readonly WorkingSetFact[]): Omit<LiftPoint, 'isPr'> {
  const topLoad = Math.max(...sets.map((s) => s.load));
  return {
    sessionId: session.id,
    date: session.date,
    e1rm: bestE1rm(sets),
    topLoad,
    topReps: Math.max(...sets.filter((s) => s.load === topLoad).map((s) => s.reps)),
    bestReps: Math.max(...sets.map((s) => s.reps)),
    sets: sets.length,
  };
}

function metricOf(exerciseId: string, sets: readonly WorkingSetFact[], library: Library): LiftMetric {
  const exercise = library.get(exerciseId);
  if (exercise) return exercise.load.type === 'bodyweight' ? 'reps' : 'e1rm';
  return sets.every((s) => s.load === 0) ? 'reps' : 'e1rm';
}

/** PR = strictly beats every earlier session (never on the first), as on the Summary screen. */
function withPrs(points: readonly Omit<LiftPoint, 'isPr'>[], metric: LiftMetric): LiftPoint[] {
  const value = (p: Omit<LiftPoint, 'isPr'>) => (metric === 'e1rm' ? p.e1rm : p.bestReps);
  return points.map((p, i) => ({ ...p, isPr: i > 0 && value(p) > Math.max(...points.slice(0, i).map(value)) }));
}

function seriesFor(exerciseId: string, sessions: readonly DatedSession[], library: Library): LiftSeries {
  const exposures = sessions
    .map((session) => ({ session, sets: session.sets.filter((s) => s.exerciseId === exerciseId) }))
    .filter((e) => e.sets.length > 0);
  const metric = metricOf(exerciseId, exposures.flatMap((e) => e.sets), library);
  const all = withPrs(exposures.map((e) => pointFor(e.session, e.sets)), metric);
  const values = all.map((p) => (metric === 'e1rm' ? p.e1rm : p.bestReps));
  return {
    exerciseId,
    ...exerciseLabel(exerciseId, library),
    metric,
    points: all.slice(-MAX_POINTS),
    best: Math.max(0, ...values),
    prCount: all.filter((p) => p.isPr).length,
    lastAt: all.at(-1)?.date ?? 0,
  };
}

/**
 * Per-exercise progress, one point per session. Most-trained lifts first, then the most
 * recent; exercises no longer in the library go last.
 */
export function liftSeries(sessions: readonly DatedSession[], library: Library): LiftSeries[] {
  const chronological = [...sessions].sort((a, b) => a.date - b.date);
  const ids = [...new Set(chronological.flatMap((s) => s.sets.map((set) => set.exerciseId)))];
  return ids
    .map((id) => seriesFor(id, chronological, library))
    .sort(
      (a, b) =>
        Number(b.known) - Number(a.known) ||
        b.points.length - a.points.length ||
        b.lastAt - a.lastAt ||
        a.name.localeCompare(b.name),
    );
}
