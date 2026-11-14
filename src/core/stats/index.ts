import { dayKeyFormatter } from './calendar.ts';
import { consistency } from './consistency.ts';
import { liftSeries } from './lifts.ts';
import { muscleBalance } from './muscleBalance.ts';
import { sessionTrends } from './trends.ts';
import type { DatedSession, StatsDto, StatsInput } from './types.ts';

export type * from './types.ts';

/**
 * Everything the Progress screen shows, from finished sessions and their working sets.
 * A session counts as a workout once it has at least one working set with reps logged;
 * it's dated by when it ended (as History does), in the caller's time zone.
 */
export function buildStats(input: StatsInput): StatsDto {
  const toKey = dayKeyFormatter(input.tz);
  const today = toKey(input.now);
  const setsBySession = Map.groupBy(
    input.sets.filter((s) => s.reps > 0),
    (s) => s.sessionId,
  );
  const sessions: DatedSession[] = input.sessions
    .map((s) => {
      const date = s.endedAt ?? s.startedAt ?? s.createdAt;
      return { ...s, date, dayKey: toKey(date), sets: setsBySession.get(s.id) ?? [] };
    })
    .filter((s) => s.sets.length > 0)
    .sort((a, b) => a.date - b.date);

  return {
    generatedAt: input.now,
    tz: input.tz,
    today,
    workouts: sessions.length,
    lifts: liftSeries(sessions, input.library),
    consistency: consistency(sessions, today),
    sessions: sessionTrends(sessions),
    muscles: muscleBalance(sessions, input.library, today),
  };
}
