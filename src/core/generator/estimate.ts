import type { SessionLength } from '../days.ts';
import { repSeconds, type Library } from '../library/index.ts';
import type { Plan, PlanItem } from '../plan.ts';
import type { Priority } from './types.ts';

const MIN = 60;

/** Session-length time budgets (seconds). Anchors are never trimmed. */
export const BUDGET_SEC: Readonly<Record<SessionLength, number>> = {
  quick: 50 * MIN,
  standard: 70 * MIN,
  long: 95 * MIN,
};

export const MAX_PRIORITY: Readonly<Record<SessionLength, Priority>> = {
  quick: 2,
  standard: 3,
  long: 4,
};

export function itemSeconds(item: PlanItem, library: Library): number {
  const exercise = library.get(item.exerciseId);
  const perRep = exercise ? repSeconds(exercise) : 3;
  return item.sets.reduce((sum, set) => sum + set.targetReps * perRep + set.restSec, 0);
}

export function planSeconds(items: readonly PlanItem[], library: Library): number {
  return items.reduce((sum, item) => sum + itemSeconds(item, library), 0);
}

export function estimatedMinutes(plan: Pick<Plan, 'estimatedSec'>): number {
  return Math.round(plan.estimatedSec / MIN);
}
