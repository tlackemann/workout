import type { Plan, PlanItem, PlanSet } from '../plan.ts';
import type { Cursor, SessionState, SetRef } from './types.ts';

export function itemAt(plan: Plan, cursor: Cursor): PlanItem | undefined {
  return plan.items[cursor.item];
}

export function setAt(plan: Plan, cursor: Cursor): PlanSet | undefined {
  return itemAt(plan, cursor)?.sets[cursor.set];
}

export function nextCursor(plan: Plan, cursor: Cursor): Cursor | null {
  const item = itemAt(plan, cursor);
  if (item && cursor.set + 1 < item.sets.length) return { item: cursor.item, set: cursor.set + 1 };
  return cursor.item + 1 < plan.items.length ? { item: cursor.item + 1, set: 0 } : null;
}

/**
 * The exercise menu actions (skip exercise / swap) apply to. During the changeover rest
 * after an exercise's last set, that's the upcoming exercise, which is what the screen shows.
 */
export function actionItemIndex(state: SessionState): number {
  if (state.phase !== 'rest') return state.cursor.item;
  const next = nextCursor(state.plan, state.cursor);
  return next && next.item !== state.cursor.item ? next.item : state.cursor.item;
}

export function isFinalSet(plan: Plan, cursor: Cursor): boolean {
  return nextCursor(plan, cursor) === null;
}

/** Unlogged, unskipped set refs of an item from `fromSet` on. */
export function remainingRefs(state: SessionState, itemIndex: number, fromSet: number): SetRef[] {
  const item = state.plan.items[itemIndex];
  if (!item) return [];
  const done = (setIndex: number) =>
    state.logs.some((l) => l.position === item.position && l.setIndex === setIndex) ||
    state.skipped.some((s) => s.position === item.position && s.setIndex === setIndex);
  return item.sets
    .map((_, setIndex) => ({ position: item.position, setIndex }))
    .filter((ref) => ref.setIndex >= fromSet && !done(ref.setIndex));
}
