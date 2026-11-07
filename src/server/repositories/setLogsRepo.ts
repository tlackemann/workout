import { and, asc, eq, ne, sql } from 'drizzle-orm';
import type { Db } from '../db/client.ts';
import { setLogs } from '../db/schema.ts';
import type { SetLog } from '../../core/session/types.ts';
import type { Exposure, ExerciseHistory } from '../../core/progression/types.ts';

type LogRow = typeof setLogs.$inferSelect;

export interface SetLogsRepository {
  upsertMany(sessionId: string, logs: readonly SetLog[]): void;
  forSession(sessionId: string): SetLog[];
  /** Working-set exposures per exercise, most recent first, excluding one session. */
  history(excludeSessionId?: string): ExerciseHistory;
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

function groupExposures(rows: readonly LogRow[]): ExerciseHistory {
  const byExposure = Map.groupBy(rows, (r) => `${r.sessionId}:${r.position}`);
  const exposures = [...byExposure.values()].map((group) => {
    const first = group[0]!;
    const exposure: Exposure = {
      sessionId: first.sessionId,
      date: Math.max(...group.map((r) => r.loggedAt)),
      repMin: first.repMin,
      repMax: first.repMax,
      plannedSets: first.plannedSets,
      sets: [...group].sort((a, b) => a.setIndex - b.setIndex).map((r) => ({ reps: r.reps, load: r.load })),
    };
    return { exerciseId: first.exerciseId, exposure };
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
    history(excludeSessionId) {
      const working = eq(setLogs.kind, 'working');
      const where = excludeSessionId ? and(working, ne(setLogs.sessionId, excludeSessionId)) : working;
      return groupExposures(db.select().from(setLogs).where(where).all());
    },
  };
}
