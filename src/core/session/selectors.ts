import type { PlanItem, PlanSet } from '../plan.ts';
import { itemAt, nextCursor, setAt } from './cursor.ts';
import type { Cursor, SessionState } from './types.ts';

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

/**
 * Load a set starts with. The single source of truth for both starting a set and the
 * "Up next" preview, so the two can never disagree.
 * An adjusted load carries across consecutive *working* sets of one exercise only:
 * a warm-up's load never leaks into the first working set.
 */
export function startingLoad(state: SessionState, cursor: Cursor): number {
  // Weight adjusted during get-ready belongs to the set that's about to start.
  if (state.phase === 'intro' && state.cursor.item === cursor.item && state.cursor.set === cursor.set) return state.load;
  const set = setAt(state.plan, cursor);
  const prev = state.draft;
  const prevSet = prev && setAt(state.plan, prev.cursor);
  const sameItem = prev?.cursor.item === cursor.item;
  if (prev && prevSet && set && sameItem && prevSet.kind === 'working' && set.kind === 'working') return prev.load;
  return set?.targetLoad ?? state.load;
}

export interface UpNext {
  readonly item: PlanItem;
  readonly set: PlanSet;
  readonly setIndex: number;
  /** The load the next set will start with. */
  readonly load: number;
}

/** What comes after the current set (shown as "Up next" during rest). */
export function upNext(state: SessionState): UpNext | null {
  const next = nextCursor(state.plan, state.cursor);
  const item = next && itemAt(state.plan, next);
  const set = next && setAt(state.plan, next);
  return next && item && set ? { item, set, setIndex: next.set, load: startingLoad(state, next) } : null;
}

export function totalSets(state: SessionState): number {
  return state.plan.items.reduce((sum, item) => sum + item.sets.length, 0);
}

export function completedSets(state: SessionState): number {
  return state.logs.length + state.skipped.length;
}
