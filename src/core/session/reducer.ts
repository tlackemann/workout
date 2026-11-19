import type { Plan } from '../plan.ts';
import { applyMenu, applySwap } from './menu.ts';
import { expire, pause, resume, startRest, startWork } from './transitions.ts';
import { isLateTick } from '../timing.ts';
import { SESSION_SCHEMA_VERSION, type SessionEvent, type SessionState } from './types.ts';

const MAX_REPS = 100;

export function createSession(sessionId: string, plan: Plan, now: number, getReadySec: number): SessionState {
  const first = plan.items[0]?.sets[0];
  return {
    schemaVersion: SESSION_SCHEMA_VERSION,
    rev: 0,
    sessionId,
    plan,
    getReadySec,
    cursor: { item: 0, set: 0 },
    phase: first ? 'intro' : 'done',
    phaseStartedAt: now,
    endsAt: first ? now + getReadySec * 1000 : null,
    paused: null,
    overlay: 'none',
    notice: null,
    load: first?.targetLoad ?? 0,
    draft: null,
    logs: [],
    skipped: [],
    startedAt: now,
    endedAt: first ? null : now,
    endedEarly: false,
  };
}

function onTick(state: SessionState, now: number): SessionState {
  if (state.paused || state.phase === 'done' || state.endsAt === null || now < state.endsAt) return state;
  if (isLateTick(state.endsAt, now)) {
    // The final log window ran out while away: finish at its deadline, not at wake-up time.
    const atDeadline = expire(state, state.endsAt);
    if (atDeadline.phase === 'done') return atDeadline;
    return { ...pause(expire(state, now), now), notice: 'caught_up' };
  }
  return expire(state, state.endsAt);
}

function onOk(state: SessionState, now: number): SessionState {
  if (state.overlay !== 'none' || state.paused) return state;
  switch (state.phase) {
    case 'intro':
      return startWork(state, state.cursor, now);
    case 'work':
      return startRest(state, now);
    case 'rest':
      return expire(state, now);
    case 'done':
      return state;
  }
}

function onBack(state: SessionState, now: number): SessionState {
  if (state.phase === 'done') return state;
  switch (state.overlay) {
    case 'none':
      return pause(state, now);
    case 'menu':
      return resume(state, now);
    case 'swap':
    case 'confirmEnd':
      return { ...state, overlay: 'menu' };
  }
}

function onAdjustReps(state: SessionState, delta: number): SessionState {
  if (!state.draft) return state;
  const reps = Math.min(MAX_REPS, Math.max(0, state.draft.reps + delta));
  return { ...state, draft: { ...state.draft, reps } };
}

function onSetLoad(state: SessionState, load: number): SessionState {
  if (state.phase === 'done' || !Number.isFinite(load) || load < 0) return state;
  if (state.phase === 'rest' && state.draft) return { ...state, draft: { ...state.draft, load } };
  return { ...state, load };
}

function transition(state: SessionState, event: SessionEvent): SessionState {
  switch (event.type) {
    case 'TICK':
      return onTick(state, event.now);
    case 'OK':
      return onOk(state, event.now);
    case 'BACK':
      return onBack(state, event.now);
    case 'ADJ_REPS':
      return onAdjustReps(state, event.delta);
    case 'SET_LOAD':
      return onSetLoad(state, event.load);
    case 'MENU':
      return state.phase === 'done' ? state : applyMenu(state, event.action, event.now);
    case 'SWAP_APPLY':
      return state.overlay === 'swap' ? applySwap(state, event.item, event.now) : state;
    case 'RESTORE':
      // Keep an existing pause: overwriting paused.at would throw away the remaining time.
      return state.phase === 'done'
        ? state
        : { ...state, paused: state.paused ?? { at: event.now }, overlay: 'menu', notice: 'welcome_back' };
  }
}

/** Pure session reducer. Every event carries `now`; nothing here reads the clock. */
export function reduce(state: SessionState, event: SessionEvent): SessionState {
  const next = transition(state, event);
  return next === state ? state : { ...next, rev: state.rev + 1 };
}
