import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { generate, type GenerateInput } from './generate.ts';
import { alternatives } from './alternatives.ts';
import { BUDGET_SEC } from './estimate.ts';
import { indexLibrary } from '../library/index.ts';
import { DEFAULT_SETTINGS } from '../settings.ts';
import { EQUIPMENT_TAGS, isEligible } from '../equipment.ts';
import { DAYS } from '../days.ts';
import { LIBRARY } from '../../data/library.ts';
import { TEMPLATES } from '../../data/templates.ts';

const library = indexLibrary(LIBRARY);
const NOW = Date.UTC(2026, 10, 7);

function input(overrides: Partial<GenerateInput> = {}): GenerateInput {
  return {
    day: 'push',
    length: 'standard',
    seed: 1234,
    now: NOW,
    settings: DEFAULT_SETTINGS,
    prefs: {},
    history: {},
    recent: [],
    library,
    templates: TEMPLATES,
    ...overrides,
  };
}

const ids = (plan: ReturnType<typeof generate>) => plan.items.map((i) => i.exerciseId);

describe('generate', () => {
  it('is deterministic for the same seed', () => {
    expect(generate(input())).toEqual(generate(input()));
  });

  it('puts the default anchors first', () => {
    expect(ids(generate(input())).slice(0, 2)).toEqual(['bench-press', 'standing-military-press']);
    expect(ids(generate(input({ day: 'pull' }))).slice(0, 2)).toEqual(['barbell-row', 'wide-lat-pulldown']);
    expect(ids(generate(input({ day: 'legs' }))).slice(0, 2)).toEqual(['back-squat', 'romanian-deadlift']);
  });

  it('honours an anchor override from settings', () => {
    const settings = { ...DEFAULT_SETTINGS, anchors: { ...DEFAULT_SETTINGS.anchors, legs: { 'legs.a2': 'deadlift' } } };
    expect(ids(generate(input({ day: 'legs', settings })))[1]).toBe('deadlift');
  });

  it('falls back and flags substitution when an anchor’s equipment is off', () => {
    const settings = { ...DEFAULT_SETTINGS, equipment: DEFAULT_SETTINGS.equipment.filter((t) => t !== 'barbell') };
    const plan = generate(input({ settings }));
    expect(plan.items[0]).toMatchObject({ exerciseId: 'machine-chest-press', substituted: true });
  });

  it('adds warm-up sets to barbell anchors only', () => {
    const plan = generate(input({ history: { 'bench-press': [] } }));
    const bench = plan.items[0]!;
    expect(bench.sets.some((s) => s.kind === 'warmup')).toBe(true);
    for (const item of plan.items.filter((i) => i.role === 'accessory')) {
      expect(item.sets.every((s) => s.kind === 'working')).toBe(true);
    }
  });

  it('never picks banned exercises', () => {
    const prefs = { 'triceps-pushdown': { favorite: false, banned: true, startLoad: null } };
    for (let seed = 1; seed < 40; seed++) {
      expect(ids(generate(input({ seed, prefs })))).not.toContain('triceps-pushdown');
    }
  });

  it('prefers favourites', () => {
    const prefs = { 'close-grip-ez-press': { favorite: true, banned: false, startLoad: null } };
    let hits = 0;
    for (let seed = 1; seed <= 40; seed++) if (ids(generate(input({ seed, prefs }))).includes('close-grip-ez-press')) hits++;
    expect(hits).toBeGreaterThan(28);
  });

  it('avoids repeating last session’s accessories', () => {
    const count = (recent: string[][]) => {
      let n = 0;
      for (let seed = 1; seed <= 60; seed++) if (ids(generate(input({ seed, recent }))).includes('triceps-pushdown')) n++;
      return n;
    };
    expect(count([['triceps-pushdown']])).toBeLessThan(count([]));
  });

  it('drops a slot that has nothing eligible and reports it', () => {
    const settings = { ...DEFAULT_SETTINGS, equipment: DEFAULT_SETTINGS.equipment.filter((t) => t !== 'mx.leg_ext') };
    const plan = generate(input({ day: 'legs', length: 'long', settings }));
    expect(plan.droppedSlots).toContain('legs.quad-iso');
    expect(ids(plan)).not.toContain('leg-extension');
  });

  it('quick sessions only contain priority 1–2 slots', () => {
    const plan = generate(input({ length: 'quick' }));
    const slots = TEMPLATES.push.slots.filter((s) => s.priority <= 2).map((s) => s.id);
    for (const item of plan.items) expect(slots).toContain(item.slotId);
  });

  it('trims accessories to fit the time budget but keeps anchors', () => {
    for (const day of DAYS) {
      for (const length of ['quick', 'standard', 'long'] as const) {
        const plan = generate(input({ day, length }));
        const anchors = plan.items.filter((i) => i.role === 'anchor');
        expect(anchors).toHaveLength(2);
        if (plan.items.length > 2) expect(plan.estimatedSec).toBeLessThanOrEqual(BUDGET_SEC[length]);
      }
    }
  });

  it('gives different accessory picks for different seeds', () => {
    const plans = new Set(Array.from({ length: 10 }, (_, seed) => ids(generate(input({ seed: seed + 1 }))).join(',')));
    expect(plans.size).toBeGreaterThan(1);
  });

  it('promotes a topped-out bodyweight exercise to the next variant', () => {
    const settings = { ...DEFAULT_SETTINGS, equipment: DEFAULT_SETTINGS.equipment.filter((t) => t !== 'mx.pec_fly') };
    const history = {
      'pushup-handles': [
        { sessionId: 'a', date: NOW - 3 * 86_400_000, repMin: 10, repMax: 15, plannedSets: 3, sets: [15, 15, 15].map((reps) => ({ reps, load: 0 })) },
      ],
    };
    const plan = generate(input({ length: 'long', settings, history }));
    const chest = plan.items.find((i) => i.slotId === 'push.chest-iso');
    expect(chest?.exerciseId).toBe('decline-pushup');
  });

  it('property: any equipment subset yields eligible, unique plans and never throws', () => {
    fc.assert(
      fc.property(
        fc.subarray([...EQUIPMENT_TAGS]),
        fc.constantFrom(...DAYS),
        fc.constantFrom('quick' as const, 'standard' as const, 'long' as const),
        fc.integer({ min: 1, max: 2 ** 31 }),
        (equipment, day, length, seed) => {
          const settings = { ...DEFAULT_SETTINGS, equipment };
          const plan = generate(input({ day, length, seed, settings }));
          const have = new Set<string>(equipment);
          const exerciseIds = ids(plan);
          expect(new Set(exerciseIds).size).toBe(exerciseIds.length);
          for (const id of exerciseIds) expect(isEligible(library.get(id)!.requires, have)).toBe(true);
          expect(plan.items.map((i) => i.position)).toEqual(plan.items.map((_, i) => i));
        },
      ),
      { numRuns: 300 },
    );
  });
});

describe('variety', () => {
  const slotOrder = (plan: ReturnType<typeof generate>) => plan.items.map((i) => i.slotId).join(',');
  const seeds = Array.from({ length: 30 }, (_, i) => i + 1);

  it('keeps anchors first and pinned slots (finisher, core) last', () => {
    for (const seed of seeds) {
      const push = generate(input({ seed, length: 'long' }));
      expect(push.items.slice(0, 2).map((i) => i.role)).toEqual(['anchor', 'anchor']);
      if (push.items.some((i) => i.slotId === 'push.finisher')) expect(push.items.at(-1)?.slotId).toBe('push.finisher');
      const legs = generate(input({ seed, day: 'legs', length: 'long' }));
      expect(ids(legs).slice(0, 2)).toEqual(['back-squat', 'romanian-deadlift']);
      if (legs.items.some((i) => i.slotId === 'legs.core')) expect(legs.items.at(-1)?.slotId).toBe('legs.core');
    }
  });

  it('shuffles the accessory order between sessions', () => {
    for (const day of DAYS) {
      const orders = new Set(seeds.slice(0, 20).map((seed) => slotOrder(generate(input({ day, seed })))));
      expect(orders.size, day).toBeGreaterThan(2);
    }
  });

  it('renumbers positions to match the shuffled order', () => {
    const plan = generate(input({ seed: 99, length: 'long' }));
    expect(plan.items.map((i) => i.position)).toEqual(plan.items.map((_, i) => i));
  });

  it('keeps the picks themselves independent of the ordering shuffle', () => {
    for (const seed of seeds.slice(0, 10)) {
      const plan = generate(input({ seed }));
      const bySlot = new Map(plan.items.map((i) => [i.slotId, i.exerciseId]));
      expect(bySlot.size).toBe(plan.items.length);
    }
  });

  it('penalises recency in steps: last session most, three sessions ago least', () => {
    const count = (recent: string[][]) =>
      seeds.concat(seeds.map((s) => s + 100)).filter((seed) => ids(generate(input({ seed, recent }))).includes('triceps-pushdown')).length;
    const last = count([['triceps-pushdown'], [], []]);
    const threeAgo = count([[], [], ['triceps-pushdown']]);
    const never = count([]);
    expect(last).toBeLessThan(threeAgo);
    expect(threeAgo).toBeLessThanOrEqual(never);
  });

  it('reaches beyond the slot’s list when every candidate was trained last session', () => {
    // Hamstrings lists only the seated curl; once that was just done, a widened hinge rotates in.
    let rotated = 0;
    for (const seed of seeds) {
      const plan = generate(input({ seed, day: 'legs', recent: [['seated-leg-curl']] }));
      const hams = plan.items.find((i) => i.slotId === 'legs.hams');
      if (hams && hams.exerciseId !== 'seated-leg-curl') rotated++;
    }
    expect(rotated).toBeGreaterThan(25);
    const fresh = generate(input({ day: 'legs' })).items.find((i) => i.slotId === 'legs.hams');
    expect(fresh?.exerciseId).toBe('seated-leg-curl');
  });

  it('lets a same-family variation in rather than repeat last session’s pick', () => {
    // The lat pulldown anchor blocks the other pulldowns by family, leaving one strict option.
    let rotated = 0;
    for (const seed of seeds) {
      const plan = generate(input({ seed, day: 'pull', recent: [['straight-arm-pulldown']] }));
      const lats = plan.items.find((i) => i.slotId === 'pull.vertical-2');
      if (lats && lats.exerciseId !== 'straight-arm-pulldown') rotated++;
    }
    expect(rotated).toBeGreaterThan(25);
  });

  it('never widens into a second lift from a family already in the plan (no deadlift after RDL)', () => {
    for (const seed of seeds) {
      const plan = generate(input({ seed, day: 'legs', length: 'long', recent: [['seated-leg-curl', 'good-morning']] }));
      const families = plan.items.map((i) => library.get(i.exerciseId)!.family);
      expect(families.filter((f) => f === 'deadlift'), String(seed)).toHaveLength(1);
    }
  });
});

describe('alternatives', () => {
  it('returns up to 5 eligible options, excluding the current exercise and the rest of the plan', () => {
    const plan = generate(input());
    const triceps = plan.items.find((i) => i.slotId === 'push.triceps')!;
    const alts = alternatives({ ...input(), plan, position: triceps.position });
    expect(alts.length).toBeGreaterThan(0);
    expect(alts.length).toBeLessThanOrEqual(5);
    const planIds = new Set(ids(plan));
    for (const alt of alts) {
      expect(planIds.has(alt.exerciseId)).toBe(false);
      expect(alt.slotId).toBe('push.triceps');
      expect(alt.sets.length).toBeGreaterThan(0);
    }
  });

  it('returns an empty list for an unknown position', () => {
    const plan = generate(input());
    expect(alternatives({ ...input(), plan, position: 999 })).toEqual([]);
  });
});

describe('bodyweight promotion over time', () => {
  it('keeps you on the variant you have been training even after the old one goes stale', () => {
    const settings = { ...DEFAULT_SETTINGS, equipment: DEFAULT_SETTINGS.equipment.filter((t) => t !== 'mx.pec_fly' && t !== 'pushup_handles') };
    const day = 86_400_000;
    const exposure = (daysAgo: number, reps: number[]) => ({ sessionId: `s${daysAgo}`, date: NOW - daysAgo * day, repMin: 10, repMax: 15, plannedSets: reps.length, sets: reps.map((r) => ({ reps: r, load: 0 })) });
    const history = {
      // pec-fly and handles are off, so chest-iso starts from the next candidate in the chain family.
      'incline-pushup': [exposure(60, [15, 15, 15])],
      pushup: [exposure(3, [12, 12, 11]), exposure(10, [11, 11, 10])],
    };
    const templates = { ...TEMPLATES, push: { ...TEMPLATES.push, slots: TEMPLATES.push.slots.map((s) => (s.id === 'push.chest-iso' ? { ...s, candidates: ['incline-pushup'] } : s)) } };
    const plan = generate(input({ length: 'long', settings, history, templates }));
    const chest = plan.items.find((i) => i.slotId === 'push.chest-iso');
    expect(chest?.exerciseId).toBe('pushup');
    expect(chest?.sets.map((s) => s.targetReps)).toEqual([13, 13, 12]);
  });
});
