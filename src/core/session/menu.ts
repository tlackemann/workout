import type { PlanItem } from '../plan.ts';
import { actionItemIndex, nextCursor, remainingRefs } from './cursor.ts';
import { advanceFromRest, commitDraft, finish, moveTo, resume, startIntro } from './transitions.ts';
import { ADD_REST_MS, type MenuAction, type SessionState } from './types.ts';

function skipRefs(state: SessionState, refs: SessionState['skipped']): SessionState {
  return { ...state, skipped: [...state.skipped, ...refs] };
}

function skipSet(state: SessionState, now: number): SessionState {
  if (state.phase === 'rest') return advanceFromRest(resume(state, now), now);
  const resumed = resume(state, now);
  const skipped = skipRefs(resumed, remainingRefs(resumed, state.cursor.item, state.cursor.set).slice(0, 1));
  return moveTo(skipped, nextCursor(state.plan, state.cursor), now);
}

function skipWarmups(state: SessionState, now: number): SessionState {
  const item = state.plan.items[state.cursor.item];
  const firstWorking = item?.sets.findIndex((s) => s.kind === 'working') ?? -1;
  if (!item || firstWorking < 0) return resume(state, now);
  const committed = commitDraft(resume(state, now), now);
  const refs = remainingRefs(committed, state.cursor.item, 0).filter((r) => r.setIndex < firstWorking);
  return moveTo(skipRefs(committed, refs), { item: state.cursor.item, set: firstWorking }, now);
}

function skipExercise(state: SessionState, now: number): SessionState {
  const target = actionItemIndex(state);
  const committed = commitDraft(resume(state, now), now);
  const refs = remainingRefs(committed, target, 0);
  const skipped = skipRefs(committed, refs);
  const nextItem = target + 1;
  return nextItem < state.plan.items.length
    ? startIntro(skipped, { item: nextItem, set: 0 }, now)
    : finish(skipped, now, false);
}

export function applyMenu(state: SessionState, action: MenuAction, now: number): SessionState {
  switch (action) {
    case 'resume':
      return resume(state, now);
    case 'add30':
      return resume({ ...state, endsAt: state.endsAt === null ? null : state.endsAt + ADD_REST_MS }, now);
    case 'skipRest':
      return state.phase === 'rest' ? advanceFromRest(resume(state, now), now) : resume(state, now);
    case 'skipSet':
      return skipSet(state, now);
    case 'skipWarmups':
      return skipWarmups(state, now);
    case 'skipExercise':
      return skipExercise(state, now);
    case 'swap':
      return { ...state, overlay: 'swap' };
    case 'end':
      return { ...state, overlay: 'confirmEnd' };
    case 'confirmEnd':
      return finish(state, now, true);
    case 'cancel':
      return { ...state, overlay: 'menu' };
  }
}

/** Replace the current exercise; logged sets stay with the old one. */
export function applySwap(state: SessionState, replacement: PlanItem, now: number): SessionState {
  const index = actionItemIndex(state);
  const committed = commitDraft(state, now);
  const current = committed.plan.items[index];
  if (!current) return state;
  // Anything already logged or skipped stays with the old exercise; the replacement gets a fresh position.
  const hasLogs =
    committed.logs.some((l) => l.position === current.position) ||
    committed.skipped.some((s) => s.position === current.position);
  const items = committed.plan.items;
  const nextPosition = Math.max(...items.map((i) => i.position)) + 1;

  const swapped = hasLogs
    ? {
        ...skipRefs(committed, remainingRefs(committed, index, 0)),
        plan: { ...committed.plan, items: [...items.slice(0, index + 1), { ...replacement, position: nextPosition }, ...items.slice(index + 1)] },
      }
    : {
        ...committed,
        plan: { ...committed.plan, items: items.map((it, i) => (i === index ? { ...replacement, position: current.position } : it)) },
      };
  const target = { item: hasLogs ? index + 1 : index, set: 0 };
  return startIntro({ ...swapped, paused: null, overlay: 'none', notice: null }, target, now);
}
