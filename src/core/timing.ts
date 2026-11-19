/**
 * Phase timing shared by the lifting and stretch players. A phase either counts down to
 * `endsAt` or (endsAt null) counts up. Pausing freezes the clock at `paused.at`.
 */

/** A TICK this late (Home pressed, TV slept, reload) advances one phase then pauses. */
export const CATCH_UP_THRESHOLD_MS = 15_000;

export interface Timed {
  readonly phaseStartedAt: number;
  readonly endsAt: number | null;
  readonly paused: { readonly at: number } | null;
}

const clockNow = (state: Timed, now: number) => state.paused?.at ?? now;

/** Countdown remaining (ms), clamped to [0, phase length]; null for count-up phases. */
export function remainingMs(state: Timed, now: number): number | null {
  if (state.endsAt === null) return null;
  const length = state.endsAt - state.phaseStartedAt;
  return Math.min(length, Math.max(0, state.endsAt - clockNow(state, now)));
}

export function phaseLengthMs(state: Timed): number | null {
  return state.endsAt === null ? null : state.endsAt - state.phaseStartedAt;
}

export function elapsedMs(state: Timed, now: number): number {
  return Math.max(0, clockNow(state, now) - state.phaseStartedAt);
}

/** Unpause: push the deadline and phase start back by the time spent paused. */
export function resumeShift(state: Timed, now: number): Pick<Timed, 'phaseStartedAt' | 'endsAt'> & { readonly paused: null } {
  const delta = state.paused ? Math.max(0, now - state.paused.at) : 0;
  return {
    paused: null,
    phaseStartedAt: state.phaseStartedAt + delta,
    endsAt: state.endsAt === null ? null : state.endsAt + delta,
  };
}

/** The deadline passed so long ago that the player was clearly away (TV slept, Home pressed). */
export function isLateTick(endsAt: number, now: number): boolean {
  return now - endsAt > CATCH_UP_THRESHOLD_MS;
}
