import type { Library } from '../library/index.ts';
import { MUSCLES, type Muscle } from '../muscles.ts';
import { addDays, daysBetween } from './calendar.ts';
import { humanizeId } from './names.ts';
import type { DatedSession, DayKey, MuscleBalance } from './types.ts';

export const BALANCE_DAYS = 28;
const SECONDARY_CREDIT = 0.5;

interface Tally {
  readonly primary: ReadonlyMap<Muscle, number>;
  readonly secondary: ReadonlyMap<Muscle, number>;
}

const bump = (map: ReadonlyMap<Muscle, number>, muscles: readonly Muscle[], by: number) =>
  new Map([...map, ...muscles.map((m) => [m, (map.get(m) ?? 0) + by] as const)]);

/** Working sets per muscle over the last 4 weeks: 1 per set as a primary mover, ½ as a secondary. */
export function muscleBalance(sessions: readonly DatedSession[], library: Library, today: DayKey, windowDays = BALANCE_DAYS): MuscleBalance {
  const from = addDays(today, -(windowDays - 1));
  const sets = sessions.filter((s) => s.dayKey >= from && s.dayKey <= today).flatMap((s) => s.sets);
  const unmapped = sets.filter((s) => !library.has(s.exerciseId));

  const tally = sets.reduce<Tally>(
    (acc, s) => {
      const ex = library.get(s.exerciseId);
      if (!ex) return acc;
      const secondary = ex.muscles.secondary.filter((m) => !ex.muscles.primary.includes(m));
      return { primary: bump(acc.primary, ex.muscles.primary, 1), secondary: bump(acc.secondary, secondary, SECONDARY_CREDIT) };
    },
    { primary: new Map(), secondary: new Map() },
  );

  const first = [...sessions].map((s) => s.dayKey).sort()[0];
  const maxWeeks = windowDays / 7;
  const weeks = first ? Math.min(maxWeeks, Math.max(1, Math.ceil((daysBetween(first, today) + 1) / 7))) : maxWeeks;

  return {
    from,
    to: today,
    weeks,
    rows: MUSCLES.map((muscle) => {
      const primary = tally.primary.get(muscle) ?? 0;
      const secondary = tally.secondary.get(muscle) ?? 0;
      return { muscle, primary, secondary, total: primary + secondary, perWeek: (primary + secondary) / weeks };
    }),
    unmappedSets: unmapped.length,
    unmappedNames: [...new Set(unmapped.map((s) => humanizeId(s.exerciseId)))],
  };
}
