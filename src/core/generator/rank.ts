import type { ExerciseDef } from '../library/schema.ts';
import type { Slot } from './types.ts';
import { usable, type GenContext } from './context.ts';

const FAVORITE_BONUS = 0.6;
const ORDER_WEIGHT = 0.3;
/**
 * Penalty by sessions ago (index 0 = last session of this day). Noise + order + favourite
 * tops out near 1.9, so last session's pick rarely repeats and the pool round-robins.
 */
export const RECENCY_PENALTY = [1.5, 0.75, 0.35] as const;
/** Relaxed pool only: exercises outside the slot's list, and repeats of a family already in the plan. */
const OFF_LIST_PENALTY = 0.4;
const FAMILY_REPEAT_PENALTY = 0.75;

interface RankOptions {
  readonly exclude: ReadonlySet<string>;
  readonly usedFamilies: ReadonlySet<string>;
  readonly uniqueFamily: boolean;
  /** 0..1 noise source; omit for a deterministic ranking (swap lists). */
  readonly rng?: () => number;
  /** Ids that aren't on the slot's own candidate list (scored lower). */
  readonly offList?: ReadonlySet<string>;
  /** Score family repeats lower instead of excluding them. */
  readonly penalizeFamilies?: boolean;
}

function recencyPenalty(ctx: GenContext, id: string): number {
  const ago = ctx.recency.get(id);
  return ago === undefined ? 0 : (RECENCY_PENALTY[ago] ?? 0);
}

function score(ctx: GenContext, ex: ExerciseDef, index: number, total: number, opts: RankOptions): number {
  const order = ((total - index) / total) * ORDER_WEIGHT;
  const favorite = ctx.prefs[ex.id]?.favorite ? FAVORITE_BONUS : 0;
  const offList = opts.offList?.has(ex.id) ? OFF_LIST_PENALTY : 0;
  const familyRepeat = opts.penalizeFamilies && opts.usedFamilies.has(ex.family) ? FAMILY_REPEAT_PENALTY : 0;
  return (opts.rng ? opts.rng() : 0) + order + favorite - recencyPenalty(ctx, ex.id) - offList - familyRepeat;
}

function rankList(ctx: GenContext, ids: readonly string[], opts: RankOptions): ExerciseDef[] {
  const pool = ids
    .map((id) => ctx.library.get(id))
    .filter((ex): ex is ExerciseDef => usable(ctx, ex))
    .filter((ex) => !opts.exclude.has(ex.id))
    .filter((ex) => !opts.uniqueFamily || !opts.usedFamilies.has(ex.family));
  const scored = pool.map((ex, i) => ({ ex, s: score(ctx, ex, i, pool.length, opts) }));
  return [...scored].sort((a, b) => b.s - a.s).map((x) => x.ex);
}

/** Library ids matching the slot's widen patterns that aren't already candidates. */
export function widenedIds(ctx: GenContext, slot: Slot): string[] {
  const patterns = new Set(slot.widen ?? []);
  return [...ctx.library.values()]
    .filter((ex) => patterns.has(ex.pattern) && !slot.candidates.includes(ex.id))
    .map((ex) => ex.id);
}

type PickOptions = Omit<RankOptions, 'uniqueFamily' | 'offList' | 'penalizeFamilies'>;

/** Small-pool relaxation: unique family → allow family repeats → widen to the slot's patterns. */
function strictPick(ctx: GenContext, slot: Slot, widened: readonly string[], opts: PickOptions): ExerciseDef | null {
  const passes: [readonly string[], boolean][] = [
    [slot.candidates, true],
    [slot.candidates, false],
    [widened, true],
    [widened, false],
  ];
  for (const [ids, uniqueFamily] of passes) {
    const best = rankList(ctx, ids, { ...opts, uniqueFamily })[0];
    if (best) return best;
  }
  return null;
}

/**
 * Accessory pick. Recency is a soft penalty, so a slot rotates through its list on its own.
 * When the strict pick would still repeat last session's exercise (a tiny pool, or the rest
 * blocked by family), re-rank a relaxed pool, each addition at a small penalty, so a fresh
 * option beats a repeat:
 *  - the slot's own candidates may repeat a family already in the plan (curated variations,
 *    e.g. an underhand pulldown after the wide-grip anchor);
 *  - the slot's widened patterns join in, but only from new families (never a deadlift
 *    as a hamstring accessory after the RDL anchor).
 */
export function pickAccessory(ctx: GenContext, slot: Slot, opts: PickOptions): ExerciseDef | null {
  const widened = widenedIds(ctx, slot);
  const strict = strictPick(ctx, slot, widened, opts);
  if (!strict || ctx.recency.get(strict.id) !== 0) return strict;
  const freshWidened = widened.filter((id) => !opts.usedFamilies.has(ctx.library.get(id)?.family ?? ''));
  const relaxed = rankList(ctx, [...slot.candidates, ...freshWidened], {
    ...opts,
    uniqueFamily: false,
    penalizeFamilies: true,
    offList: new Set(widened),
  });
  return relaxed[0] ?? strict;
}

/** Deterministic ranked alternatives for a slot (Swap list). */
export function rankAlternatives(ctx: GenContext, slot: Slot, exclude: ReadonlySet<string>): ExerciseDef[] {
  const opts = { exclude, usedFamilies: new Set<string>(), uniqueFamily: false };
  const fromSlot = rankList(ctx, [...slot.candidates, ...(slot.fallbacks ?? [])], opts);
  const widened = rankList(ctx, widenedIds(ctx, slot), opts);
  return [...fromSlot, ...widened.filter((w) => !fromSlot.some((f) => f.id === w.id))];
}
