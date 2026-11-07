import type { Plan } from '../plan.ts';
import { isFinalSet, itemAt, nextCursor, setAt } from './cursor.ts';
import { FINAL_LOG_WINDOW_SEC, type Cursor, type SessionState, type SetLog } from './types.ts';

const ms = (sec: number) => sec * 1000;

export function commitDraft(state: SessionState, now: number): SessionState {
  const draft = state.draft;
  const item = draft && itemAt(state.plan, draft.cursor);
  const set = draft && setAt(state.plan, draft.cursor);
  if (!draft || !item || !set) return { ...state, draft: null };
  const log: SetLog = {
    position: item.position,
    setIndex: draft.cursor.set,
    exerciseId: item.exerciseId,
    kind: set.kind,
    reps: draft.reps,
    load: draft.load,
    targetReps: set.targetReps,
    targetLoad: set.targetLoad,
    repMin: item.repMin,
    repMax: item.repMax,
    plannedSets: item.workingSets,
    loggedAt: now,
  };
  const others = state.logs.filter((l) => !(l.position === log.position && l.setIndex === log.setIndex));
  return { ...state, logs: [...others, log], draft: null };
}

/** Load for a new set: carry an adjusted load across consecutive working sets of one exercise. */
function loadFor(state: SessionState, cursor: Cursor): number {
  // Weight adjusted during get-ready belongs to the set that's about to start.
  if (state.phase === 'intro' && state.cursor.item === cursor.item && state.cursor.set === cursor.set) return state.load;
  const set = setAt(state.plan, cursor);
  const prev = state.draft ?? null;
  const prevSet = prev && setAt(state.plan, prev.cursor);
  const sameItem = prev?.cursor.item === cursor.item;
  if (prev && prevSet && set && sameItem && prevSet.kind === 'working' && set.kind === 'working') return prev.load;
  return set?.targetLoad ?? state.load;
}

export function startWork(state: SessionState, cursor: Cursor, now: number): SessionState {
  const load = loadFor(state, cursor);
  return { ...commitDraft(state, now), cursor, phase: 'work', phaseStartedAt: now, endsAt: null, load };
}

export function startIntro(state: SessionState, cursor: Cursor, now: number): SessionState {
  const load = setAt(state.plan, cursor)?.targetLoad ?? state.load;
  return {
    ...commitDraft(state, now),
    cursor,
    phase: 'intro',
    phaseStartedAt: now,
    endsAt: now + ms(state.getReadySec),
    load,
  };
}

export function startRest(state: SessionState, now: number): SessionState {
  const set = setAt(state.plan, state.cursor);
  if (!set) return state;
  const restSec = isFinalSet(state.plan, state.cursor) ? FINAL_LOG_WINDOW_SEC : set.restSec;
  return {
    ...state,
    phase: 'rest',
    phaseStartedAt: now,
    endsAt: now + ms(restSec),
    draft: { cursor: state.cursor, reps: set.targetReps, load: state.load },
  };
}

export function finish(state: SessionState, now: number, early: boolean): SessionState {
  return {
    ...commitDraft(state, now),
    phase: 'done',
    phaseStartedAt: now,
    endsAt: null,
    paused: null,
    overlay: 'none',
    notice: null,
    endedAt: now,
    endedEarly: early,
  };
}

/** Rest is over (timer or OK): log the set, then the next set or the end. */
export function advanceFromRest(state: SessionState, now: number): SessionState {
  const next = nextCursor(state.plan, state.cursor);
  return next ? startWork(state, next, now) : finish(state, now, false);
}

/** After a skip: same exercise → straight to work; new exercise → get-ready intro. */
export function moveTo(state: SessionState, next: Cursor | null, now: number): SessionState {
  if (!next) return finish(state, now, false);
  return next.item === state.cursor.item ? startWork(state, next, now) : startIntro(state, next, now);
}

/** Timer reached zero. */
export function expire(state: SessionState, at: number): SessionState {
  switch (state.phase) {
    case 'intro':
      return startWork(state, state.cursor, at);
    case 'work':
      return startRest(state, at);
    case 'rest':
      return advanceFromRest(state, at);
    case 'done':
      return state;
  }
}

export function pause(state: SessionState, now: number): SessionState {
  return { ...state, paused: { at: now }, overlay: 'menu' };
}

export function resume(state: SessionState, now: number): SessionState {
  if (!state.paused) return { ...state, overlay: 'none', notice: null };
  const delta = Math.max(0, now - state.paused.at);
  return {
    ...state,
    paused: null,
    overlay: 'none',
    notice: null,
    endsAt: state.endsAt === null ? null : state.endsAt + delta,
    phaseStartedAt: state.phaseStartedAt + delta,
  };
}

export function emptyPlan(plan: Plan): boolean {
  return plan.items.length === 0;
}
