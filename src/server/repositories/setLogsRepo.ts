import { and, asc, eq, inArray, ne, sql } from 'drizzle-orm';
import type { Db } from '../db/client.ts';
import { sessions, setLogs } from '../db/schema.ts';
import { FINISHED } from './sessionsRepo.ts';
import type { WorkingSetFact } from '../../core/stats/types.ts';
import type { SetLog } from '../../core/session/types.ts';
import type { Exposure, ExerciseHistory } from '../../core/progression/types.ts';

type LogRow = typeof setLogs.$inferSelect;

export interface SetLogsRepository {
  upsertMany(sessionId: string, logs: readonly SetLog[]): void;
  forSession(sessionId: string): SetLog[];
  /** Exposures (working sets + their warm-ups) per exercise, most recent first, excluding one session. */
  history(excludeSessionId?: string): ExerciseHistory;
  /** Working sets of finished sessions only (no abandoned or in-progress workouts). */
  finishedWorkingSets(): WorkingSetFact[];
}

const toSetLog = (r: LogRow): SetLog => ({
  position: r.position,
  setIndex: r.setIndex,
  exerciseId: r.exerciseId,
  kind: r.kind,
  reps: r.reps,
  load: r.load,
  targetReps: r.targetReps,
  targetLoad: r.targetLoad,
  repMin: r.repMin,
  repMax: r.repMax,
  plannedSets: r.plannedSets,
  loggedAt: r.loggedAt,
});

const toLoggedSets = (rows: readonly LogRow[]) =>
  [...rows].sort((a, b) => a.setIndex - b.setIndex).map((r) => ({ reps: r.reps, load: r.load }));

/** One exposure per session × plan position; groups with only warm-ups logged are left out. */
function groupExposures(rows: readonly LogRow[]): ExerciseHistory {
  const byExposure = Map.groupBy(rows, (r) => `${r.sessionId}:${r.position}`);
  const exposures = [...byExposure.values()].flatMap((group) => {
    const working = group.filter((r) => r.kind === 'working');
    const first = working[0];
    if (!first) return [];
    const exposure: Exposure = {
      sessionId: first.sessionId,
      date: Math.max(...working.map((r) => r.loggedAt)),
      repMin: first.repMin,
      repMax: first.repMax,
      plannedSets: first.plannedSets,
      sets: toLoggedSets(working),
      warmups: toLoggedSets(group.filter((r) => r.kind === 'warmup')),
    };
    return [{ exerciseId: first.exerciseId, exposure }];
  });
  const byExercise = Map.groupBy(exposures, (e) => e.exerciseId);
  return Object.fromEntries(
    [...byExercise.entries()].map(([id, list]) => [id, list.map((e) => e.exposure).sort((a, b) => b.date - a.date)]),
  );
}

export function createSetLogsRepo(db: Db): SetLogsRepository {
  return {
    upsertMany(sessionId, logs) {
      if (logs.length === 0) return;
      db.transaction((tx) => {
        for (const log of logs) {
          const values = { sessionId, ...log };
          tx.insert(setLogs)
            .values(values)
            .onConflictDoUpdate({
              target: [setLogs.sessionId, setLogs.position, setLogs.setIndex],
              set: { reps: sql`excluded.reps`, load: sql`excluded.load`, loggedAt: sql`excluded.logged_at`, exerciseId: sql`excluded.exercise_id` },
            })
            .run();
        }
      });
    },
    forSession(sessionId) {
      return db
        .select()
        .from(setLogs)
        .where(eq(setLogs.sessionId, sessionId))
        .orderBy(asc(setLogs.position), asc(setLogs.setIndex))
        .all()
        .map(toSetLog);
    },
    finishedWorkingSets() {
      return db
        .select({
          sessionId: setLogs.sessionId,
          exerciseId: setLogs.exerciseId,
          reps: setLogs.reps,
          load: setLogs.load,
          loggedAt: setLogs.loggedAt,
        })
        .from(setLogs)
        .innerJoin(sessions, eq(sessions.id, setLogs.sessionId))
        .where(and(eq(setLogs.kind, 'working'), inArray(sessions.status, [...FINISHED])))
        .all();
    },
    history(excludeSessionId) {
      const query = db.select().from(setLogs);
      const rows = excludeSessionId ? query.where(ne(setLogs.sessionId, excludeSessionId)).all() : query.all();
      return groupExposures(rows);
    },
  };
}
