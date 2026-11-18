import { snapDown, snapNearest, step } from '../loads.ts';
import { topSet } from './progression.ts';
import type { Exposure, LoggedSet } from './types.ts';

/** Opener × 10, then ~50% × 5, ~70% × 3, ~85% × 1 of the working load. */
const RAMP: readonly { pct: number; reps: number }[] = [
  { pct: 0.5, reps: 5 },
  { pct: 0.7, reps: 3 },
  { pct: 0.85, reps: 1 },
];
const OPENER_REPS = 10;

/**
 * Warm-up ramp to the working load. The first set is the opener (the empty bar unless a
 * learned opener is given); ramp steps that aren't heavier than the set before are dropped.
 */
export function warmupSets(working: number, options: readonly number[], bar: number, opener = bar): LoggedSet[] {
  if (working <= bar) return [];
  const ramp = RAMP.map(({ pct, reps }) => ({ reps, load: snapDown(working * pct, options) }));
  const candidates: LoggedSet[] = [{ reps: OPENER_REPS, load: Math.max(bar, opener) }, ...ramp];
  return candidates.reduce<LoggedSet[]>((acc, set) => {
    const prev = acc.at(-1);
    const increasing = !prev || set.load > prev.load;
    return increasing && set.load < working ? [...acc, set] : acc;
  }, []);
}

/** First warm-up as a fraction of that day's top working load; null when it isn't a usable sample. */
function openerRatio(exposure: Exposure): number | null {
  const first = exposure.warmups[0];
  const top = topSet(exposure).load;
  if (!first || top <= 0) return null;
  const ratio = first.load / top;
  // Logged at or above the working weight: not a real warm-up (e.g. warm-ups skipped by just pressing OK).
  return ratio < 1 ? ratio : null;
}

/**
 * The opener the lifter actually used most recently, scaled to today's working load, so it
 * rises with the working weight and follows any change made on the TV. Exposures newest first.
 */
export function learnedOpener(exposures: readonly Exposure[], working: number, options: readonly number[], bar: number): number {
  const ratio = exposures.map(openerRatio).find((r) => r !== null);
  if (ratio === undefined || ratio === null) return bar;
  const below = step(working, -1, options);
  return Math.max(bar, Math.min(snapNearest(working * ratio, options), below));
}
