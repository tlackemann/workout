import { describe, expect, it } from 'vitest';
import { createSession, reduce } from './reducer.ts';
import { completedSets, currentItem, phaseLengthMs, remainingMs, totalSets, upNext } from './selectors.ts';
import type { Plan, PlanSet } from '../plan.ts';
import type { SessionEvent, SessionState } from './types.ts';

const plan: Plan = {
  day: 'legs', length: 'quick', seed: 1, droppedSlots: [], trimmedSlots: [], estimatedSec: 0,
  items: [
    { position: 0, slotId: 'a', slotLabel: 'A', exerciseId: 'back-squat', role: 'anchor', repMin: 5, repMax: 8, amrap: false, workingSets: 1, substituted: false, reason: 'first', lastLoad: null, sets: [{ kind: 'working', targetReps: 5, targetLoad: 95, restSec: 90 }] },
    { position: 1, slotId: 'b', slotLabel: 'B', exerciseId: 'leg-extension', role: 'accessory', repMin: 8, repMax: 12, amrap: false, workingSets: 1, substituted: false, reason: 'first', lastLoad: null, sets: [{ kind: 'working', targetReps: 8, targetLoad: 120, restSec: 60 }] },
  ],
};

describe('selectors', () => {
  it('report the countdown, totals and what comes next', () => {
    const s0 = createSession('x', plan, 0, 10);
    expect(phaseLengthMs(s0)).toBe(10_000);
    expect(remainingMs(s0, 4_000)).toBe(6_000);
    expect(totalSets(s0)).toBe(2);
    expect(currentItem(s0)?.exerciseId).toBe('back-squat');
    expect(upNext(s0)?.item.exerciseId).toBe('leg-extension');

    const working = reduce(s0, { type: 'OK', now: 1 });
    expect(remainingMs(working, 5)).toBeNull();
    expect(phaseLengthMs(working)).toBeNull();

    const resting = reduce(reduce(working, { type: 'OK', now: 2 }), { type: 'OK', now: 3 });
    expect(completedSets(resting)).toBe(1);
    expect(upNext(reduce(resting, { type: 'OK', now: 4 }))).toBeNull();
  });
});

describe('upNext load', () => {
  const warmupSets: PlanSet[] = [
    { kind: 'warmup', targetReps: 5, targetLoad: 45, restSec: 60 },
    { kind: 'warmup', targetReps: 3, targetLoad: 135, restSec: 90 },
    { kind: 'working', targetReps: 5, targetLoad: 185, restSec: 180 },
    { kind: 'working', targetReps: 5, targetLoad: 185, restSec: 180 },
  ];
  const benchPlan: Plan = {
    ...plan,
    items: [{ ...plan.items[0]!, exerciseId: 'bench-press', workingSets: 2, sets: warmupSets }, plan.items[1]!],
  };
  const run = (s: SessionState, ...events: SessionEvent[]) => events.reduce(reduce, s);
  const ok = (now: number): SessionEvent => ({ type: 'OK', now });

  it('after the last warm-up, shows the working weight that will actually start', () => {
    // intro → warm-up 1 → rest → warm-up 2 → rest (next: first working set)
    const resting = run(createSession('x', benchPlan, 0, 10), ok(1), ok(2), ok(3), ok(4));
    expect(resting.phase).toBe('rest');
    expect(resting.draft?.load).toBe(135);
    expect(upNext(resting)?.load).toBe(185);
    expect(reduce(resting, ok(5)).load).toBe(185);
  });

  it('carries a weight adjusted during a working set’s rest to the next working set', () => {
    const resting = run(createSession('x', benchPlan, 0, 10), ok(1), ok(2), ok(3), ok(4), ok(5), ok(6));
    expect(resting.cursor.set).toBe(2);
    const adjusted = reduce(resting, { type: 'SET_LOAD', load: 175, now: 7 });
    expect(upNext(adjusted)?.load).toBe(175);
    expect(reduce(adjusted, ok(8)).load).toBe(175);
  });

  it('uses the next exercise’s target across a changeover', () => {
    const resting = run(createSession('x', plan, 0, 10), ok(1), ok(2));
    expect(upNext(resting)?.load).toBe(120);
  });
});
