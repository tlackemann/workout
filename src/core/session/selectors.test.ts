import { describe, expect, it } from 'vitest';
import { createSession, reduce } from './reducer.ts';
import { completedSets, currentItem, phaseLengthMs, remainingMs, totalSets, upNext } from './selectors.ts';
import type { Plan } from '../plan.ts';

const plan: Plan = {
  day: 'legs', length: 'quick', seed: 1, droppedSlots: [], trimmedSlots: [], estimatedSec: 0,
  items: [
    { position: 0, slotId: 'a', slotLabel: 'A', exerciseId: 'back-squat', role: 'anchor', repMin: 5, repMax: 8, amrap: false, workingSets: 1, substituted: false, reason: 'first', lastLoad: null, sets: [{ kind: 'working', targetReps: 5, targetLoad: 95, restSec: 90 }] },
    { position: 1, slotId: 'b', slotLabel: 'B', exerciseId: 'leg-press', role: 'accessory', repMin: 8, repMax: 12, amrap: false, workingSets: 1, substituted: false, reason: 'first', lastLoad: null, sets: [{ kind: 'working', targetReps: 8, targetLoad: 120, restSec: 60 }] },
  ],
};

describe('selectors', () => {
  it('report the countdown, totals and what comes next', () => {
    const s0 = createSession('x', plan, 0, 10);
    expect(phaseLengthMs(s0)).toBe(10_000);
    expect(remainingMs(s0, 4_000)).toBe(6_000);
    expect(totalSets(s0)).toBe(2);
    expect(currentItem(s0)?.exerciseId).toBe('back-squat');
    expect(upNext(s0)?.item.exerciseId).toBe('leg-press');

    const working = reduce(s0, { type: 'OK', now: 1 });
    expect(remainingMs(working, 5)).toBeNull();
    expect(phaseLengthMs(working)).toBeNull();

    const resting = reduce(reduce(working, { type: 'OK', now: 2 }), { type: 'OK', now: 3 });
    expect(completedSets(resting)).toBe(1);
    expect(upNext(reduce(resting, { type: 'OK', now: 4 }))).toBeNull();
  });
});
