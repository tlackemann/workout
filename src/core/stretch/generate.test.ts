import { describe, expect, it } from 'vitest';
import { STRETCH_TEMPLATE } from '../../data/stretchTemplate.ts';
import { STRETCHES } from '../../data/stretches.ts';
import { DEFAULT_EQUIPMENT, RECOVERY_TAGS, type EquipmentTag } from '../equipment.ts';
import { DEFAULT_SETTINGS } from '../settings.ts';
import { generateStretch, SWITCH_SEC, type StretchGenerateInput } from './generate.ts';
import { POSITIONS, indexStretches } from './schema.ts';

const library = indexStretches(STRETCHES);

function input(over: Partial<StretchGenerateInput> = {}): StretchGenerateInput {
  return { length: 'standard', seed: 42, settings: DEFAULT_SETTINGS, recent: [], library, template: STRETCH_TEMPLATE, ...over };
}

const withEquipment = (equipment: readonly EquipmentTag[]) => ({ ...DEFAULT_SETTINGS, equipment: [...equipment] });
const slotsOf = (plan: ReturnType<typeof generateStretch>) => [...new Set(plan.steps.map((s) => s.slotId))];
const stretchIds = (plan: ReturnType<typeof generateStretch>) => [...new Set(plan.steps.map((s) => s.stretchId))];

describe('generateStretch', () => {
  it('covers more regions the longer the session', () => {
    const quick = slotsOf(generateStretch(input({ length: 'quick' })));
    const standard = slotsOf(generateStretch(input({ length: 'standard' })));
    const long = slotsOf(generateStretch(input({ length: 'long' })));
    expect(quick.sort()).toEqual(['chest', 'glutes', 'hamstrings', 'hip-flexors', 'lats', 'relax', 'warm.hips', 'warm.upper']);
    expect(standard).toEqual(expect.arrayContaining([...quick, 'roll.legs', 'roll.back', 'quads', 'calves', 'adductors']));
    expect(standard).toHaveLength(13);
    expect(long).toHaveLength(STRETCH_TEMPLATE.length);
  });

  it('is deterministic for a seed and varies across seeds', () => {
    expect(generateStretch(input())).toEqual(generateStretch(input()));
    const picks = new Set(Array.from({ length: 12 }, (_, seed) => stretchIds(generateStretch(input({ seed: seed + 1 }))).join()));
    expect(picks.size).toBeGreaterThan(6);
  });

  it('runs warm-up, then foam rolling, then stretches, with the relax pose last', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const plan = generateStretch(input({ seed, length: 'long' }));
      const blocks = plan.steps.map((s) => library.get(s.stretchId)!.block);
      const order = ['warm', 'roll', 'stretch'];
      expect(blocks.map((b) => order.indexOf(b))).toEqual([...blocks.map((b) => order.indexOf(b))].sort((a, b) => a - b));
      expect(plan.steps.at(-1)?.slotId).toBe('relax');
    }
  });

  it('orders each block standing → kneeling → seated → lying so you get down once', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const plan = generateStretch(input({ seed, length: 'long' }));
      const statics = plan.steps.filter((s) => s.slotId !== 'relax' && library.get(s.stretchId)!.block === 'stretch');
      const ranks = statics.map((s) => POSITIONS.indexOf(library.get(s.stretchId)!.position));
      expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    }
  });

  it('runs a per-side stretch twice, the second time after a short switch', () => {
    const plan = generateStretch(input({ seed: 7, length: 'long' }));
    plan.steps.forEach((step, i) => {
      expect(step.index).toBe(i);
      const def = library.get(step.stretchId)!;
      if (def.sides === 'both') return expect(step.side).toBeNull();
      if (step.side === 1) expect(plan.steps[i + 1]).toMatchObject({ stretchId: step.stretchId, side: 2, setupSec: SWITCH_SEC });
      else expect(plan.steps[i - 1]).toMatchObject({ stretchId: step.stretchId, side: 1 });
    });
  });

  it('holds static stretches for the Settings hold time and moves for their own duration', () => {
    const settings = { ...DEFAULT_SETTINGS, stretch: { holdSec: 45, setupSec: 15 } };
    const plan = generateStretch(input({ settings, length: 'long' }));
    for (const step of plan.steps) {
      const def = library.get(step.stretchId)!;
      expect(step.holdSec).toBe(def.block === 'stretch' ? 45 : def.durationSec);
      if (step.side !== 2) expect(step.setupSec).toBe(15);
    }
    expect(plan.estimatedSec).toBe(plan.steps.reduce((sum, s) => sum + s.setupSec + s.holdSec, 0));
  });

  it('never repeats a stretch or a family within a session', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const plan = generateStretch(input({ seed, length: 'long' }));
      const ids = stretchIds(plan);
      const families = ids.map((id) => library.get(id)!.family);
      expect(new Set(families).size, `seed ${seed}`).toBe(families.length);
    }
  });

  it('drops foam rolling and strap stretches when that gear is off', () => {
    const noGear = withEquipment(DEFAULT_EQUIPMENT.filter((t) => !RECOVERY_TAGS.includes(t)));
    for (let seed = 1; seed <= 20; seed++) {
      const plan = generateStretch(input({ seed, length: 'long', settings: noGear }));
      expect(plan.droppedSlots).toEqual(['roll.legs', 'roll.back', 'roll.extra']);
      for (const id of stretchIds(plan)) expect(library.get(id)!.requires, id).toEqual(id === 'bench-quad' || id === 'bench-twist' ? [['bench.flat']] : []);
    }
  });

  it('avoids the stretches from the last few sessions when there is a choice', () => {
    const last = stretchIds(generateStretch(input({ seed: 3 })));
    const repeats = Array.from({ length: 10 }, (_, i) =>
      stretchIds(generateStretch(input({ seed: 100 + i, recent: [last] }))).filter((id) => last.includes(id)).length,
    );
    const fresh = Array.from({ length: 10 }, (_, i) =>
      stretchIds(generateStretch(input({ seed: 100 + i }))).filter((id) => last.includes(id)).length,
    );
    expect(repeats.reduce((a, b) => a + b)).toBeLessThan(fresh.reduce((a, b) => a + b));
  });

  it('estimates roughly 9 / 16 / 23 minutes at the default 30 s holds', () => {
    const minutes = (length: StretchGenerateInput['length']) =>
      Math.max(...Array.from({ length: 10 }, (_, i) => generateStretch(input({ length, seed: i + 1 })).estimatedSec / 60));
    expect(minutes('quick')).toBeLessThanOrEqual(11);
    expect(minutes('standard')).toBeLessThanOrEqual(19);
    expect(minutes('long')).toBeLessThanOrEqual(27);
    expect(minutes('quick')).toBeGreaterThanOrEqual(6);
  });
});
