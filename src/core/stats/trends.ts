import { DAYS, type Day } from '../days.ts';
import type { DatedSession, SessionFact, SessionPoint, SessionTrends } from './types.ts';

export const SESSIONS_PER_DAY = 10;
/** Longer than this means the session was left open (paused overnight, forgotten). */
const MAX_PLAUSIBLE_MS = 4 * 3_600_000;

export function sessionDuration(session: SessionFact): number | null {
  if (session.startedAt === null || session.endedAt === null) return null;
  const ms = session.endedAt - session.startedAt;
  return ms > 0 && ms <= MAX_PLAUSIBLE_MS ? Math.round(ms / 1000) : null;
}

function pointFor(session: DatedSession): SessionPoint {
  return {
    id: session.id,
    day: session.day,
    date: session.date,
    endedEarly: session.status === 'ended_early',
    durationSec: sessionDuration(session),
    volume: session.sets.reduce((sum, s) => sum + s.reps * s.load, 0),
    workingSets: session.sets.length,
  };
}

export function sessionTrends(sessions: readonly DatedSession[], perDay = SESSIONS_PER_DAY): SessionTrends {
  const points = [...sessions].sort((a, b) => a.date - b.date).map(pointFor);
  const lastOf = (day: Day) => points.filter((p) => p.day === day).slice(-perDay);
  const byDay = { push: lastOf('push'), pull: lastOf('pull'), legs: lastOf('legs') };
  const shown = DAYS.flatMap((day) => byDay[day]);
  const durations = shown.map((p) => p.durationSec).filter((d): d is number => d !== null);
  return {
    byDay,
    avgDurationSec: durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null,
    missingDuration: shown.length - durations.length,
  };
}
