import { isLateTick, resumeShift } from '../timing.ts';
import { ADD_HOLD_MS, STRETCH_SCHEMA_VERSION, type StretchEvent, type StretchMenuAction, type StretchState } from './state.ts';
import type { StretchPlan } from './types.ts';

const ms = (sec: number) => sec * 1000;

export function createStretchSession(sessionId: string, plan: StretchPlan, now: number): StretchState {
  const first = plan.steps[0];
  return {
    schemaVersion: STRETCH_SCHEMA_VERSION,
    rev: 0,
    sessionId,
    plan,
    index: 0,
    phase: first ? 'setup' : 'done',
    phaseStartedAt: now,
    endsAt: first ? now + ms(first.setupSec) : null,
    paused: null,
    overlay: 'none',
    notice: null,
    completed: [],
    skipped: [],
    startedAt: now,
    endedAt: first ? null : now,
    endedEarly: false,
  };
}

function finish(state: StretchState, now: number, early: boolean): StretchState {
  return {
    ...state,
    index: state.plan.steps.length,
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

function startSetup(state: StretchState, index: number, now: number): StretchState {
  const step = state.plan.steps[index];
  if (!step) return finish(state, now, false);
  return { ...state, index, phase: 'setup', phaseStartedAt: now, endsAt: now + ms(step.setupSec) };
}

function startHold(state: StretchState, now: number): StretchState {
  const step = state.plan.steps[state.index];
  if (!step) return finish(state, now, false);
  return { ...state, phase: 'hold', phaseStartedAt: now, endsAt: now + ms(step.holdSec) };
}

function completeHold(state: StretchState, now: number): StretchState {
  return startSetup({ ...state, completed: [...state.completed, state.index] }, state.index + 1, now);
}

/** The countdown reached zero. */
function expire(state: StretchState, at: number): StretchState {
  switch (state.phase) {
    case 'setup':
      return startHold(state, at);
    case 'hold':
      return completeHold(state, at);
    case 'done':
      return state;
  }
}

function pause(state: StretchState, now: number): StretchState {
  return { ...state, paused: { at: now }, overlay: 'menu' };
}

function resume(state: StretchState, now: number): StretchState {
  return { ...state, ...resumeShift(state, now), overlay: 'none', notice: null };
}

/** Skip the current step, and its second side when on the first side. */
function skipStretch(state: StretchState, now: number): StretchState {
  const resumed = resume(state, now);
  const step = state.plan.steps[state.index];
  const pairsWithNext = step?.side === 1 && state.plan.steps[state.index + 1]?.stretchId === step.stretchId;
  const skipped = pairsWithNext ? [state.index, state.index + 1] : [state.index];
  return startSetup({ ...resumed, skipped: [...state.skipped, ...skipped] }, state.index + skipped.length, now);
}

function onTick(state: StretchState, now: number): StretchState {
  if (state.paused || state.phase === 'done' || state.endsAt === null || now < state.endsAt) return state;
  if (isLateTick(state.endsAt, now)) {
    // The last hold ran out while away: finish at its deadline, not at wake-up time.
    const atDeadline = expire(state, state.endsAt);
    if (atDeadline.phase === 'done') return atDeadline;
    return { ...pause(expire(state, now), now), notice: 'caught_up' };
  }
  return expire(state, state.endsAt);
}

function onOk(state: StretchState, now: number): StretchState {
  if (state.overlay !== 'none' || state.paused) return state;
  return expire(state, now);
}

function onBack(state: StretchState, now: number): StretchState {
  if (state.phase === 'done') return state;
  switch (state.overlay) {
    case 'none':
      return pause(state, now);
    case 'menu':
      return resume(state, now);
    case 'confirmEnd':
      return { ...state, overlay: 'menu' };
  }
}

function onMenu(state: StretchState, action: StretchMenuAction, now: number): StretchState {
  if (state.phase === 'done') return state;
  switch (action) {
    case 'resume':
      return resume(state, now);
    case 'add15':
      return resume({ ...state, endsAt: state.endsAt === null ? null : state.endsAt + ADD_HOLD_MS }, now);
    case 'skipStretch':
      return skipStretch(state, now);
    case 'end':
      return { ...state, overlay: 'confirmEnd' };
    case 'confirmEnd':
      return finish(state, now, true);
    case 'cancel':
      return { ...state, overlay: 'menu' };
  }
}

function transition(state: StretchState, event: StretchEvent): StretchState {
  switch (event.type) {
    case 'TICK':
      return onTick(state, event.now);
    case 'OK':
      return onOk(state, event.now);
    case 'BACK':
      return onBack(state, event.now);
    case 'MENU':
      return onMenu(state, event.action, event.now);
    case 'RESTORE':
      // Keep an existing pause: overwriting paused.at would throw away the remaining time.
      return state.phase === 'done'
        ? state
        : { ...state, paused: state.paused ?? { at: event.now }, overlay: 'menu', notice: 'welcome_back' };
  }
}

/** Pure stretch-session reducer. Every event carries `now`; nothing here reads the clock. */
export function reduceStretch(state: StretchState, event: StretchEvent): StretchState {
  const next = transition(state, event);
  return next === state ? state : { ...next, rev: state.rev + 1 };
}
