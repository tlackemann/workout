import type { ExerciseDef } from '../library/schema.ts';
import { loadOptions } from '../loads.ts';
import type { PlanItem, PlanSet } from '../plan.ts';
import { computeTarget } from '../progression/progression.ts';
import type { Target } from '../progression/types.ts';
import { learnedOpener, warmupSets } from '../progression/warmups.ts';
import { usable, type GenContext } from './context.ts';
import type { Slot } from './types.ts';

const WARMUP_REST_SEC = 60;
const LAST_WARMUP_REST_SEC = 90;

function targetFor(ctx: GenContext, slot: Slot, exercise: ExerciseDef): Target {
  return computeTarget({
    exercise,
    repMin: slot.repMin,
    repMax: slot.repMax,
    sets: slot.sets,
    exposures: ctx.history[exercise.id] ?? [],
    settings: ctx.settings,
    startLoad: ctx.prefs[exercise.id]?.startLoad ?? null,
    now: ctx.now,
  });
}

/** The chain variant trained most recently (falls back to the picked exercise). */
function latestInChain(ctx: GenContext, picked: ExerciseDef): ExerciseDef {
  const trained = (picked.progressionChain ?? [])
    .map((id) => ctx.library.get(id))
    .filter((ex): ex is ExerciseDef => usable(ctx, ex))
    .map((ex) => ({ ex, date: ctx.history[ex.id]?.[0]?.date ?? -Infinity }))
    .filter((t) => t.date > -Infinity)
    .sort((a, b) => b.date - a.date);
  return trained[0]?.ex ?? picked;
}

/**
 * Walk a bodyweight progression chain while the current variant is topped out, starting
 * from the variant actually being trained (so an old, stale top-out never demotes you).
 */
function promote(ctx: GenContext, slot: Slot, picked: ExerciseDef): { exercise: ExerciseDef; target: Target } {
  let current = latestInChain(ctx, picked);
  let target = targetFor(ctx, slot, current);
  const chain = current.progressionChain ?? [];
  for (let i = chain.indexOf(current.id) + 1; target.promote && i < chain.length; i++) {
    const next = ctx.library.get(chain[i] ?? '');
    if (!usable(ctx, next)) continue;
    current = next;
    target = targetFor(ctx, slot, current);
  }
  return { exercise: current, target };
}

function warmups(ctx: GenContext, slot: Slot, exercise: ExerciseDef, load: number): PlanSet[] {
  if (slot.role !== 'anchor' || exercise.load.type !== 'barbell') return [];
  const options = loadOptions(exercise, ctx.settings);
  const bar = ctx.settings.barWeight;
  const opener = learnedOpener(ctx.history[exercise.id] ?? [], load, options, bar);
  const sets = warmupSets(load, options, bar, opener);
  return sets.map((s, i) => ({
    kind: 'warmup',
    targetReps: s.reps,
    targetLoad: s.load,
    restSec: i === sets.length - 1 ? LAST_WARMUP_REST_SEC : WARMUP_REST_SEC,
  }));
}

function workingSets(ctx: GenContext, slot: Slot, target: Target): PlanSet[] {
  return target.reps.map((reps, i) => ({
    kind: 'working',
    targetReps: reps,
    targetLoad: target.load,
    restSec: i === target.reps.length - 1 ? slot.restSec + ctx.settings.changeoverSec : slot.restSec,
  }));
}

export function buildItem(
  ctx: GenContext,
  slot: Slot,
  picked: ExerciseDef,
  position: number,
  substituted: boolean,
): PlanItem {
  const { exercise, target } = promote(ctx, slot, picked);
  return {
    position,
    slotId: slot.id,
    slotLabel: slot.label,
    exerciseId: exercise.id,
    role: slot.role,
    repMin: slot.repMin,
    repMax: slot.repMax,
    amrap: slot.amrap ?? false,
    sets: [...warmups(ctx, slot, exercise, target.load), ...workingSets(ctx, slot, target)],
    workingSets: target.reps.length,
    substituted,
    reason: target.reason,
    lastLoad: target.lastLoad,
  };
}
