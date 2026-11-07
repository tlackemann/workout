import { snapDown } from '../loads.ts';
import type { LoggedSet } from './types.ts';

/** Bar × 10, then ~50% × 5, ~70% × 3, ~85% × 1 of the working load. */
const RAMP: readonly { pct: number; reps: number }[] = [
  { pct: 0.5, reps: 5 },
  { pct: 0.7, reps: 3 },
  { pct: 0.85, reps: 1 },
];
const BAR_REPS = 10;

export function warmupSets(working: number, options: readonly number[], bar: number): LoggedSet[] {
  if (working <= bar) return [];
  const ramp = RAMP.map(({ pct, reps }) => ({ reps, load: snapDown(working * pct, options) }));
  const candidates: LoggedSet[] = [{ reps: BAR_REPS, load: bar }, ...ramp];
  return candidates.reduce<LoggedSet[]>((acc, set) => {
    const prev = acc.at(-1);
    const increasing = !prev || set.load > prev.load;
    return increasing && set.load < working ? [...acc, set] : acc;
  }, []);
}
