import type { PlanItem, PlanSet } from '../plan.ts';
import { itemAt, nextCursor, setAt } from './cursor.ts';
import type { SessionState } from './types.ts';

const clockNow = (state: SessionState, now: number) => state.paused?.at ?? now;

/** Countdown remaining (ms), clamped to [0, phase length]; null for count-up phases. */
export function remainingMs(state: SessionState, now: number): number | null {
  if (state.endsAt === null) return null;
  const length = state.endsAt - state.phaseStartedAt;
  return Math.min(length, Math.max(0, state.endsAt - clockNow(state, now)));
}

export function phaseLengthMs(state: SessionState): number | null {
  return state.endsAt === null ? null : state.endsAt - state.phaseStartedAt;
}

export function elapsedMs(state: SessionState, now: number): number {
  return Math.max(0, clockNow(state, now) - state.phaseStartedAt);
}

export function currentItem(state: SessionState): PlanItem | undefined {
  return itemAt(state.plan, state.cursor);
}

export function currentSet(state: SessionState): PlanSet | undefined {
  return setAt(state.plan, state.cursor);
}

/** What comes after the current set (shown as "Up next" during rest). */
export function upNext(state: SessionState): { item: PlanItem; set: PlanSet; setIndex: number } | null {
  const next = nextCursor(state.plan, state.cursor);
  const item = next && itemAt(state.plan, next);
  const set = next && setAt(state.plan, next);
  return next && item && set ? { item, set, setIndex: next.set } : null;
}

export function totalSets(state: SessionState): number {
  return state.plan.items.reduce((sum, item) => sum + item.sets.length, 0);
}

export function completedSets(state: SessionState): number {
  return state.logs.length + state.skipped.length;
}
