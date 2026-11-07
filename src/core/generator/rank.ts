import type { ExerciseDef } from '../library/schema.ts';
import type { Slot } from './types.ts';
import { usable, type GenContext } from './context.ts';

const FAVORITE_BONUS = 0.6;
const RECENT_PENALTY = 1;
const ORDER_WEIGHT = 0.3;

interface RankOptions {
  readonly exclude: ReadonlySet<string>;
  readonly usedFamilies: ReadonlySet<string>;
  readonly uniqueFamily: boolean;
  /** 0..1 noise source; omit for a deterministic ranking (swap lists). */
  readonly rng?: () => number;
}

function score(ctx: GenContext, ex: ExerciseDef, index: number, total: number, rng?: () => number): number {
  const order = ((total - index) / total) * ORDER_WEIGHT;
  const favorite = ctx.prefs[ex.id]?.favorite ? FAVORITE_BONUS : 0;
  const recent = ctx.recentIds.has(ex.id) ? RECENT_PENALTY : 0;
  return (rng ? rng() : 0) + order + favorite - recent;
}

function rankList(ctx: GenContext, ids: readonly string[], opts: RankOptions): ExerciseDef[] {
  const pool = ids
    .map((id) => ctx.library.get(id))
    .filter((ex): ex is ExerciseDef => usable(ctx, ex))
    .filter((ex) => !opts.exclude.has(ex.id))
    .filter((ex) => !opts.uniqueFamily || !opts.usedFamilies.has(ex.family));
  const scored = pool.map((ex, i) => ({ ex, s: score(ctx, ex, i, pool.length, opts.rng) }));
  return [...scored].sort((a, b) => b.s - a.s).map((x) => x.ex);
}

/** Library ids matching the slot's widen patterns that aren't already candidates. */
export function widenedIds(ctx: GenContext, slot: Slot): string[] {
  const patterns = new Set(slot.widen ?? []);
  return [...ctx.library.values()]
    .filter((ex) => patterns.has(ex.pattern) && !slot.candidates.includes(ex.id))
    .map((ex) => ex.id);
}

/**
 * Accessory pick with small-pool relaxation:
 * unique family → allow family repeats → widen to the slot's patterns → none.
 * (Recency is a soft penalty, so it relaxes automatically.)
 */
export function pickAccessory(ctx: GenContext, slot: Slot, opts: Omit<RankOptions, 'uniqueFamily'>): ExerciseDef | null {
  const passes: [readonly string[], boolean][] = [
    [slot.candidates, true],
    [slot.candidates, false],
    [widenedIds(ctx, slot), true],
    [widenedIds(ctx, slot), false],
  ];
  for (const [ids, uniqueFamily] of passes) {
    const best = rankList(ctx, ids, { ...opts, uniqueFamily })[0];
    if (best) return best;
  }
  return null;
}

/** Deterministic ranked alternatives for a slot (Swap list). */
export function rankAlternatives(ctx: GenContext, slot: Slot, exclude: ReadonlySet<string>): ExerciseDef[] {
  const opts = { exclude, usedFamilies: new Set<string>(), uniqueFamily: false };
  const fromSlot = rankList(ctx, [...slot.candidates, ...(slot.fallbacks ?? [])], opts);
  const widened = rankList(ctx, widenedIds(ctx, slot), opts);
  return [...fromSlot, ...widened.filter((w) => !fromSlot.some((f) => f.id === w.id))];
}
