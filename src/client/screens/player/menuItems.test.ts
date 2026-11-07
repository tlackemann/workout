import { describe, expect, it } from 'vitest';
import { menuItems } from './menuItems.ts';
import { createSession, reduce } from '../../../core/session/reducer.ts';
import type { Plan } from '../../../core/plan.ts';

const plan: Plan = {
  day: 'push', length: 'quick', seed: 1, droppedSlots: [], trimmedSlots: [], estimatedSec: 0,
  items: [{
    position: 0, slotId: 's', slotLabel: 'S', exerciseId: 'bench-press', role: 'anchor', repMin: 5, repMax: 8, amrap: false,
    sets: [{ kind: 'warmup', targetReps: 10, targetLoad: 45, restSec: 60 }, { kind: 'working', targetReps: 5, targetLoad: 135, restSec: 180 }],
    workingSets: 1, substituted: false, reason: 'first', lastLoad: null,
  }],
};

describe('menuItems', () => {
  it('offers warm-up skipping during a warm-up', () => {
    const actions = menuItems(createSession('a', plan, 0, 10)).map((i) => i.action);
    expect(actions).toEqual(['resume', 'skipSet', 'skipWarmups', 'skipExercise', 'swap', 'end']);
  });

  it('offers rest controls during rest', () => {
    const resting = reduce(reduce(createSession('a', plan, 0, 10), { type: 'OK', now: 1 }), { type: 'OK', now: 2 });
    expect(menuItems(resting).map((i) => i.action)).toEqual(['resume', 'add30', 'skipRest', 'skipExercise', 'swap', 'end']);
  });
});
