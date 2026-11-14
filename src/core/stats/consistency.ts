import type { Day } from '../days.ts';
import { addDays, weekStart } from './calendar.ts';
import type { Consistency, DatedSession, DayKey, HeatCell, Streak, WeekBucket } from './types.ts';

export const HISTORY_WEEKS = 26;
const AVERAGE_WEEKS = 8;
const WEEK_DAYS = 7;

/**
 * Consecutive weeks with ≥1 workout, counted back from this week. The current week is
 * still in progress, so an empty one doesn't break the streak until it's over.
 */
export function streak(perWeek: ReadonlyMap<DayKey, number>, thisWeek: DayKey): Streak {
  const active = (week: DayKey) => (perWeek.get(week) ?? 0) > 0;
  let current = 0;
  for (let week = active(thisWeek) ? thisWeek : addDays(thisWeek, -WEEK_DAYS); active(week); week = addDays(week, -WEEK_DAYS)) current++;

  const weeks = [...perWeek.keys()].filter(active).sort();
  const runs = weeks.reduce<{ best: number; run: number; prev: DayKey | null }>(
    (acc, week) => {
      const run = acc.prev !== null && addDays(acc.prev, WEEK_DAYS) === week ? acc.run + 1 : 1;
      return { best: Math.max(acc.best, run), run, prev: week };
    },
    { best: 0, run: 0, prev: null },
  );
  return { current, best: Math.max(runs.best, current), thisWeek: perWeek.get(thisWeek) ?? 0 };
}

function averagePerWeek(perWeek: ReadonlyMap<DayKey, number>, thisWeek: DayKey, firstWeek: DayKey | null): number | null {
  if (firstWeek === null) return null;
  const complete = Array.from({ length: AVERAGE_WEEKS }, (_, i) => addDays(thisWeek, -WEEK_DAYS * (i + 1))).filter((w) => w >= firstWeek);
  if (complete.length === 0) return null;
  return complete.reduce((sum, w) => sum + (perWeek.get(w) ?? 0), 0) / complete.length;
}

export function consistency(sessions: readonly DatedSession[], today: DayKey, weeks = HISTORY_WEEKS): Consistency {
  const thisWeek = weekStart(today);
  const starts = Array.from({ length: weeks }, (_, i) => addDays(thisWeek, -WEEK_DAYS * (weeks - 1 - i)));
  const byWeek = Map.groupBy(sessions, (s) => weekStart(s.dayKey));
  const byDate = Map.groupBy(sessions, (s) => s.dayKey);

  const buckets: WeekBucket[] = starts.map((start) => {
    const inWeek = byWeek.get(start) ?? [];
    const count = (day: Day) => inWeek.filter((s) => s.day === day).length;
    return { weekStart: start, push: count('push'), pull: count('pull'), legs: count('legs'), total: inWeek.length };
  });

  const heatmap: HeatCell[][] = starts.map((start) =>
    Array.from({ length: WEEK_DAYS }, (_, i) => {
      const date = addDays(start, i);
      return { date, workouts: byDate.get(date)?.length ?? 0, isToday: date === today, future: date > today };
    }),
  );

  const perWeek = new Map([...byWeek.entries()].map(([week, list]) => [week, list.length]));
  const firstWeek = [...perWeek.keys()].sort()[0] ?? null;
  return { weeks: buckets, heatmap, streak: streak(perWeek, thisWeek), avgPerWeek: averagePerWeek(perWeek, thisWeek, firstWeek) };
}
