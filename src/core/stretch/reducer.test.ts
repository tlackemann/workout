import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { CATCH_UP_THRESHOLD_MS } from '../timing.ts';
import { createStretchSession, reduceStretch } from './reducer.ts';
import { currentStep, isSecondSide, nextStep, remainingMs, stretchCount, stretchItems, stretchNumber, stretchProgress } from './selectors.ts';
import type { StretchEvent, StretchState } from './state.ts';
import type { StretchPlan, StretchStep } from './types.ts';

const T0 = 1_000_000;
const sec = (n: number) => n * 1000;

const step = (index: number, stretchId: string, side: StretchStep['side'], setupSec = 10, holdSec = 30): StretchStep => ({
  index,
  slotId: `slot-${stretchId}`,
  stretchId,
  side,
  setupSec,
  holdSec,
});

/** Arm circles (both) → hip flexor side 1 → side 2 (5 s switch) → child's pose (both). */
const PLAN: StretchPlan = {
  length: 'quick',
  seed: 1,
  steps: [step(0, 'arm-circles', null), step(1, 'kneeling-hip-flexor', 1), step(2, 'kneeling-hip-flexor', 2, 5), step(3, 'childs-pose', null)],
  droppedSlots: [],
  estimatedSec: 160,
};

const start = () => createStretchSession('s1', PLAN, T0);
const run = (state: StretchState, ...events: StretchEvent[]) => events.reduce(reduceStretch, state);

describe('stretch session', () => {
  it('starts in "get into position" for the first stretch', () => {
    const s = start();
    expect(s).toMatchObject({ phase: 'setup', index: 0, endsAt: T0 + sec(10), rev: 0, completed: [], skipped: [] });
    expect(currentStep(s)?.stretchId).toBe('arm-circles');
    expect(nextStep(s)?.stretchId).toBe('kneeling-hip-flexor');
  });

  it('is already done when the plan is empty', () => {
    const s = createStretchSession('s1', { ...PLAN, steps: [] }, T0);
    expect(s).toMatchObject({ phase: 'done', endedAt: T0, endsAt: null });
  });

  it('runs setup → hold → next setup on its own', () => {
    let s = run(start(), { type: 'TICK', now: T0 + sec(10) });
    expect(s).toMatchObject({ phase: 'hold', index: 0, phaseStartedAt: T0 + sec(10), endsAt: T0 + sec(40) });
    s = run(s, { type: 'TICK', now: T0 + sec(40) });
    expect(s).toMatchObject({ phase: 'setup', index: 1, completed: [0], endsAt: T0 + sec(50) });
  });

  it('ignores ticks before the deadline without bumping the revision', () => {
    const s = start();
    expect(reduceStretch(s, { type: 'TICK', now: T0 + sec(5) })).toBe(s);
  });

  it('switches sides with the short gap and labels the second side', () => {
    const s = run(start(), { type: 'OK', now: T0 }, { type: 'OK', now: T0 + sec(1) }, { type: 'OK', now: T0 + sec(2) }, { type: 'OK', now: T0 + sec(3) });
    expect(s).toMatchObject({ phase: 'setup', index: 2, endsAt: T0 + sec(8), completed: [0, 1] });
    expect(isSecondSide(s)).toBe(true);
  });

  it('OK starts the hold early, and OK during a hold moves on (still counted)', () => {
    let s = run(start(), { type: 'OK', now: T0 + sec(2) });
    expect(s).toMatchObject({ phase: 'hold', endsAt: T0 + sec(32) });
    s = run(s, { type: 'OK', now: T0 + sec(12) });
    expect(s).toMatchObject({ phase: 'setup', index: 1, completed: [0] });
  });

  it('finishes after the last hold', () => {
    const s = run(start(), ...Array.from({ length: 8 }, (_, i) => ({ type: 'OK' as const, now: T0 + sec(i) })));
    expect(s).toMatchObject({ phase: 'done', completed: [0, 1, 2, 3], endedAt: T0 + sec(7), endedEarly: false, endsAt: null });
    expect(stretchProgress(s)).toBe(1);
    expect(run(s, { type: 'OK', now: T0 + sec(9) })).toBe(s);
  });

  it('BACK pauses into the menu and the clock stops', () => {
    const s = run(start(), { type: 'BACK', now: T0 + sec(4) });
    expect(s).toMatchObject({ overlay: 'menu', paused: { at: T0 + sec(4) } });
    expect(remainingMs(s, T0 + sec(60))).toBe(sec(6));
    expect(run(s, { type: 'TICK', now: T0 + sec(60) })).toBe(s);
    expect(run(s, { type: 'OK', now: T0 + sec(60) })).toBe(s);
  });

  it('resumes where it left off (BACK again or Resume)', () => {
    for (const resume of [{ type: 'BACK', now: T0 + sec(30) }, { type: 'MENU', action: 'resume', now: T0 + sec(30) }] as const) {
      const s = run(start(), { type: 'BACK', now: T0 + sec(4) }, resume);
      expect(s).toMatchObject({ overlay: 'none', paused: null, endsAt: T0 + sec(36) });
      expect(remainingMs(s, T0 + sec(30))).toBe(sec(6));
    }
  });

  it('+15 s extends the current countdown and resumes', () => {
    const s = run(start(), { type: 'OK', now: T0 }, { type: 'BACK', now: T0 + sec(10) }, { type: 'MENU', action: 'add15', now: T0 + sec(10) });
    expect(s).toMatchObject({ phase: 'hold', overlay: 'none', endsAt: T0 + sec(45) });
  });

  it('skipping a per-side stretch skips both sides', () => {
    const atSide1 = run(start(), { type: 'OK', now: T0 }, { type: 'OK', now: T0 + sec(1) });
    const s = run(atSide1, { type: 'BACK', now: T0 + sec(2) }, { type: 'MENU', action: 'skipStretch', now: T0 + sec(2) });
    expect(s).toMatchObject({ phase: 'setup', index: 3, skipped: [1, 2], completed: [0], overlay: 'none', paused: null });
  });

  it('skipping the second side skips just that side', () => {
    const atSide2 = run(start(), ...Array.from({ length: 4 }, (_, i) => ({ type: 'OK' as const, now: T0 + sec(i) })));
    const s = run(atSide2, { type: 'BACK', now: T0 + sec(5) }, { type: 'MENU', action: 'skipStretch', now: T0 + sec(5) });
    expect(s).toMatchObject({ index: 3, skipped: [2], completed: [0, 1] });
  });

  it('skipping the last stretch finishes the session normally', () => {
    const last = run(start(), ...Array.from({ length: 6 }, (_, i) => ({ type: 'OK' as const, now: T0 + sec(i) })));
    const s = run(last, { type: 'BACK', now: T0 + sec(7) }, { type: 'MENU', action: 'skipStretch', now: T0 + sec(7) });
    expect(s).toMatchObject({ phase: 'done', skipped: [3], endedEarly: false });
  });

  it('End asks first; Cancel goes back to the menu; confirming ends early', () => {
    let s = run(start(), { type: 'BACK', now: T0 + sec(1) }, { type: 'MENU', action: 'end', now: T0 + sec(1) });
    expect(s.overlay).toBe('confirmEnd');
    expect(run(s, { type: 'MENU', action: 'cancel', now: T0 + sec(2) }).overlay).toBe('menu');
    expect(run(s, { type: 'BACK', now: T0 + sec(2) }).overlay).toBe('menu');
    s = run(s, { type: 'MENU', action: 'confirmEnd', now: T0 + sec(3) });
    expect(s).toMatchObject({ phase: 'done', endedEarly: true, endedAt: T0 + sec(3), overlay: 'none', paused: null });
  });

  it('after a long absence advances one phase then waits paused', () => {
    const late = T0 + sec(10) + CATCH_UP_THRESHOLD_MS + 1;
    const s = run(start(), { type: 'TICK', now: late });
    expect(s).toMatchObject({ phase: 'hold', index: 0, paused: { at: late }, overlay: 'menu', notice: 'caught_up', endsAt: late + sec(30) });
  });

  it('finishes at the deadline if the last hold ran out while away', () => {
    const lastHold = run(start(), ...Array.from({ length: 7 }, (_, i) => ({ type: 'OK' as const, now: T0 + sec(i) })));
    const s = run(lastHold, { type: 'TICK', now: T0 + sec(3600) });
    expect(s).toMatchObject({ phase: 'done', endedAt: T0 + sec(36), endedEarly: false });
  });

  it('RESTORE (page reload) pauses into the menu with a welcome back, keeping an existing pause', () => {
    const s = run(start(), { type: 'RESTORE', now: T0 + sec(3) });
    expect(s).toMatchObject({ overlay: 'menu', paused: { at: T0 + sec(3) }, notice: 'welcome_back' });
    const kept = run(start(), { type: 'BACK', now: T0 + sec(1) }, { type: 'RESTORE', now: T0 + sec(9) });
    expect(kept.paused).toEqual({ at: T0 + sec(1) });
  });

  it('keeps the revision monotonic and every step accounted for at most once', () => {
    const event = fc.oneof(
      fc.constant({ type: 'OK' as const }),
      fc.constant({ type: 'BACK' as const }),
      fc.constant({ type: 'RESTORE' as const }),
      fc.constant({ type: 'TICK' as const }),
      fc.constantFrom('resume', 'add15', 'skipStretch', 'end', 'confirmEnd', 'cancel').map((action) => ({ type: 'MENU' as const, action })),
    );
    fc.assert(
      fc.property(fc.array(fc.tuple(event, fc.integer({ min: 0, max: sec(120) })), { maxLength: 40 }), (events) => {
        let s = start();
        let now = T0;
        for (const [e, dt] of events) {
          now += dt;
          const next = reduceStretch(s, { ...e, now } as StretchEvent);
          expect(next.rev).toBeGreaterThanOrEqual(s.rev);
          s = next;
          const seen = [...s.completed, ...s.skipped];
          expect(new Set(seen).size).toBe(seen.length);
          for (const i of seen) expect(i).toBeLessThan(PLAN.steps.length);
          expect(s.index).toBeLessThanOrEqual(PLAN.steps.length);
        }
      }),
    );
  });

  it('numbers stretches with both sides sharing one number', () => {
    expect(stretchCount(PLAN.steps)).toBe(3);
    const s = run(start(), ...Array.from({ length: 4 }, (_, i) => ({ type: 'OK' as const, now: T0 + sec(i) })));
    expect(stretchNumber(s)).toBe(2);
    expect(stretchNumber(start())).toBe(1);
  });

  it('groups the two sides of a stretch into one row', () => {
    expect(stretchItems(PLAN.steps)).toEqual([
      { stretchId: 'arm-circles', slotId: 'slot-arm-circles', holdSec: 30, perSide: false, indices: [0] },
      { stretchId: 'kneeling-hip-flexor', slotId: 'slot-kneeling-hip-flexor', holdSec: 30, perSide: true, indices: [1, 2] },
      { stretchId: 'childs-pose', slotId: 'slot-childs-pose', holdSec: 30, perSide: false, indices: [3] },
    ]);
  });
});
