import type { Day, SessionLength } from '../days.ts';
import type { Library } from '../library/index.ts';
import type { ExerciseDef } from '../library/schema.ts';
import type { Plan, PlanItem } from '../plan.ts';
import { createRng, shuffled } from '../prng.ts';
import type { ExerciseHistory } from '../progression/types.ts';
import type { Prefs, Settings } from '../settings.ts';
import { buildItem } from './buildItem.ts';
import { usable, type GenContext } from './context.ts';
import { BUDGET_SEC, MAX_PRIORITY, planSeconds } from './estimate.ts';
import { pickAccessory, RECENCY_PENALTY } from './rank.ts';
import type { Slot, Templates } from './types.ts';

export interface GenerateInput {
  readonly day: Day;
  readonly length: SessionLength;
  readonly seed: number;
  readonly now: number;
  readonly settings: Settings;
  readonly prefs: Prefs;
  readonly history: ExerciseHistory;
  /** Exercise ids of the most recent sessions of this day, newest first. */
  readonly recent: readonly (readonly string[])[];
  readonly library: Library;
  readonly templates: Templates;
}

/** How many past sessions of a day count as "recent" (one recency penalty step each). */
export const RECENT_SESSIONS = RECENCY_PENALTY.length;
/** Mixed into the seed so the ordering shuffle doesn't disturb the exercise picks. */
const ORDER_SALT = 0x5bd1e995;

/** Exercise id → sessions ago it was last used (the most recent use wins). */
function recencyOf(recent: GenerateInput['recent']): ReadonlyMap<string, number> {
  const entries = recent
    .slice(0, RECENT_SESSIONS)
    .flatMap((ids, ago) => ids.map((id) => [id, ago] as const))
    .reverse();
  return new Map(entries);
}

export function makeContext(input: Omit<GenerateInput, 'length' | 'seed' | 'templates'>): GenContext {
  return {
    day: input.day,
    now: input.now,
    settings: input.settings,
    prefs: input.prefs,
    history: input.history,
    library: input.library,
    available: new Set(input.settings.equipment),
    recency: recencyOf(input.recent),
  };
}

function pickAnchor(ctx: GenContext, slot: Slot): { exercise: ExerciseDef; substituted: boolean } | null {
  const preferred = ctx.settings.anchors[ctx.day][slot.id] ?? slot.candidates[0];
  const order = [...new Set([preferred, ...slot.candidates, ...(slot.fallbacks ?? [])])];
  for (const id of order) {
    const ex = id ? ctx.library.get(id) : undefined;
    if (usable(ctx, ex)) return { exercise: ex, substituted: ex.id !== preferred };
  }
  return null;
}

interface Picked {
  readonly items: readonly PlanItem[];
  readonly dropped: readonly string[];
}

function pickAll(ctx: GenContext, slots: readonly Slot[], rng: () => number): Picked {
  return slots.reduce<Picked>(
    (acc, slot) => {
      const exclude = new Set(acc.items.map((i) => i.exerciseId));
      const usedFamilies = new Set(acc.items.map((i) => ctx.library.get(i.exerciseId)?.family ?? ''));
      const anchor = slot.role === 'anchor' ? pickAnchor(ctx, slot) : null;
      const accessory = slot.role === 'accessory' ? pickAccessory(ctx, slot, { exclude, usedFamilies, rng }) : null;
      const exercise = anchor?.exercise ?? accessory;
      if (!exercise || exclude.has(exercise.id)) return { ...acc, dropped: [...acc.dropped, slot.id] };
      const item = buildItem(ctx, slot, exercise, acc.items.length, anchor?.substituted ?? false);
      if (exclude.has(item.exerciseId)) return { ...acc, dropped: [...acc.dropped, slot.id] };
      return { ...acc, items: [...acc.items, item] };
    },
    { items: [], dropped: [] },
  );
}

/** Remove the least important accessories until the plan fits the budget. */
function trimToBudget(items: readonly PlanItem[], slots: readonly Slot[], budget: number, library: Library) {
  const priorityOf = (item: PlanItem) => slots.find((s) => s.id === item.slotId)?.priority ?? 4;
  let kept = [...items];
  const trimmed: string[] = [];
  while (planSeconds(kept, library) > budget) {
    const accessories = kept.filter((i) => i.role === 'accessory');
    const victim = [...accessories].sort((a, b) => priorityOf(b) - priorityOf(a) || b.position - a.position)[0];
    if (!victim) break;
    trimmed.push(victim.slotId);
    kept = kept.filter((i) => i !== victim);
  }
  return { kept, trimmed };
}

/**
 * Session order: anchors first in template order (heavy lifts while fresh), then the
 * accessories shuffled, then pinned-last slots (finisher, core). Positions follow the order.
 */
function arrange(items: readonly PlanItem[], slots: readonly Slot[], rng: () => number): PlanItem[] {
  const pinnedLast = (item: PlanItem) => slots.find((s) => s.id === item.slotId)?.pin === 'last';
  const anchors = items.filter((i) => i.role === 'anchor');
  const accessories = items.filter((i) => i.role !== 'anchor');
  const middle = shuffled(accessories.filter((i) => !pinnedLast(i)), rng);
  return [...anchors, ...middle, ...accessories.filter(pinnedLast)].map((item, position) => ({ ...item, position }));
}

export function generate(input: GenerateInput): Plan {
  const ctx = makeContext(input);
  const slots = input.templates[input.day].slots.filter((s) => s.priority <= MAX_PRIORITY[input.length]);
  const { items, dropped } = pickAll(ctx, slots, createRng(input.seed));
  const { kept, trimmed } = trimToBudget(items, slots, BUDGET_SEC[input.length], input.library);
  return {
    day: input.day,
    length: input.length,
    seed: input.seed,
    items: arrange(kept, slots, createRng((input.seed ^ ORDER_SALT) >>> 0)),
    droppedSlots: dropped,
    trimmedSlots: trimmed,
    estimatedSec: planSeconds(kept, input.library),
  };
}
