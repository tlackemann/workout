import { describe, expect, it } from 'vitest';
import { createSession, reduce } from './reducer.ts';
import { currentSet, elapsedMs, remainingMs } from './selectors.ts';
import type { SessionEvent, SessionState } from './types.ts';
import type { Plan, PlanItem, PlanSet } from '../plan.ts';

const T0 = 1_000_000;
const sec = (n: number) => n * 1000;

function sets(kinds: ('warmup' | 'working')[], reps = 5, load = 100, rest = 60): PlanSet[] {
  return kinds.map((kind) => ({ kind, targetReps: reps, targetLoad: kind === 'warmup' ? 45 : load, restSec: rest }));
}

function item(position: number, exerciseId: string, planSets: PlanSet[]): PlanItem {
  return {
    position,
    slotId: `slot-${position}`,
    slotLabel: 'Slot',
    exerciseId,
    role: position === 0 ? 'anchor' : 'accessory',
    repMin: 5,
    repMax: 8,
    amrap: false,
    sets: planSets,
    workingSets: planSets.filter((s) => s.kind === 'working').length,
    substituted: false,
    reason: 'first',
    lastLoad: null,
  };
}

const PLAN: Plan = {
  day: 'push',
  length: 'standard',
  seed: 1,
  items: [item(0, 'bench-press', sets(['warmup', 'working', 'working'])), item(1, 'pec-fly', sets(['working', 'working'], 10, 40, 45))],
  droppedSlots: [],
  trimmedSlots: [],
  estimatedSec: 600,
};

const start = () => createSession('s1', PLAN, T0, 10);

function run(state: SessionState, ...events: SessionEvent[]): SessionState {
  return events.reduce(reduce, state);
}

const ok = (now: number): SessionEvent => ({ type: 'OK', now });
const tick = (now: number): SessionEvent => ({ type: 'TICK', now });
const back = (now: number): SessionEvent => ({ type: 'BACK', now });
const menu = (action: Extract<SessionEvent, { type: 'MENU' }>['action'], now: number): SessionEvent => ({ type: 'MENU', action, now });

describe('createSession', () => {
  it('starts in a get-ready intro with the first set’s load', () => {
    const s = start();
    expect(s).toMatchObject({ phase: 'intro', endsAt: T0 + sec(10), cursor: { item: 0, set: 0 }, load: 45, rev: 0 });
  });

  it('is immediately done for an empty plan', () => {
    expect(createSession('x', { ...PLAN, items: [] }, T0, 10).phase).toBe('done');
  });
});

describe('happy path', () => {
  it('intro auto-starts work when the countdown ends', () => {
    const s = run(start(), tick(T0 + sec(10)));
    expect(s).toMatchObject({ phase: 'work', endsAt: null, phaseStartedAt: T0 + sec(10) });
  });

  it('OK in intro starts work immediately', () => {
    expect(run(start(), ok(T0 + 500)).phase).toBe('work');
  });

  it('OK ends the set: rest starts with a pre-filled draft', () => {
    const s = run(start(), ok(T0), ok(T0 + sec(30)));
    expect(s.phase).toBe('rest');
    expect(s.endsAt).toBe(T0 + sec(30) + sec(60));
    expect(s.draft).toEqual({ cursor: { item: 0, set: 0 }, reps: 5, load: 45 });
    expect(s.logs).toHaveLength(0);
  });

  it('rest end commits the log and starts the next set', () => {
    const s = run(start(), ok(T0), ok(T0 + sec(30)), tick(T0 + sec(90)));
    expect(s.phase).toBe('work');
    expect(s.cursor).toEqual({ item: 0, set: 1 });
    expect(s.logs).toEqual([
      expect.objectContaining({ position: 0, setIndex: 0, kind: 'warmup', reps: 5, load: 45, exerciseId: 'bench-press', plannedSets: 2 }),
    ]);
    expect(s.load).toBe(100);
  });

  it('OK during rest skips the remaining rest', () => {
    const s = run(start(), ok(T0), ok(T0 + sec(30)), ok(T0 + sec(40)));
    expect(s).toMatchObject({ phase: 'work', cursor: { item: 0, set: 1 } });
  });

  it('edits during rest land in the log', () => {
    const s = run(
      start(),
      ok(T0),
      ok(T0 + 1),
      ok(T0 + 2), // warm-up done → working set 1 in progress
      ok(T0 + 3), // working set done → rest
      { type: 'ADJ_REPS', delta: -2, now: T0 + 4 },
      { type: 'SET_LOAD', load: 95, now: T0 + 5 },
      ok(T0 + 6),
    );
    expect(s.logs.at(-1)).toMatchObject({ setIndex: 1, reps: 3, load: 95, targetReps: 5, targetLoad: 100 });
  });

  it('carries an adjusted working load to the next working set of the same exercise', () => {
    const s = run(start(), ok(T0), ok(T0 + 1), ok(T0 + 2), { type: 'SET_LOAD', load: 90, now: T0 + 3 }, ok(T0 + 4), ok(T0 + 5));
    expect(s.cursor).toEqual({ item: 0, set: 2 });
    expect(s.load).toBe(90);
  });

  it('moves on to the next exercise after its last set and uses its target load', () => {
    let s = start();
    for (let i = 0; i < 3; i++) s = run(s, ok(T0 + i * 10), ok(T0 + i * 10 + 1));
    s = run(s, ok(T0 + 100));
    expect(s.cursor).toEqual({ item: 1, set: 0 });
    expect(s.phase).toBe('work');
    expect(s.load).toBe(40);
  });

  it('the final set opens a short log window, then finishes', () => {
    let s = run(start(), ok(T0));
    for (let i = 0; i < 4; i++) s = run(s, ok(T0 + i * 10 + 1), ok(T0 + i * 10 + 2));
    s = run(s, ok(T0 + 200));
    expect(s.phase).toBe('rest');
    expect(s.endsAt).toBe(T0 + 200 + sec(20));
    s = run(s, tick(T0 + 200 + sec(20)));
    expect(s).toMatchObject({ phase: 'done', endedAt: T0 + 200 + sec(20), endedEarly: false });
    expect(s.logs).toHaveLength(5);
  });
});

describe('pause menu', () => {
  it('BACK pauses and opens the menu; time stands still', () => {
    const s = run(start(), ok(T0), ok(T0 + sec(1)), back(T0 + sec(11)));
    expect(s).toMatchObject({ overlay: 'menu', paused: { at: T0 + sec(11) } });
    expect(remainingMs(s, T0 + sec(500))).toBe(sec(50));
    expect(run(s, tick(T0 + sec(500))).phase).toBe('rest');
  });

  it('resume shifts the deadline by the paused duration', () => {
    const s = run(start(), ok(T0), ok(T0 + sec(1)), back(T0 + sec(11)), menu('resume', T0 + sec(41)));
    expect(s).toMatchObject({ overlay: 'none', paused: null, endsAt: T0 + sec(1) + sec(60) + sec(30) });
  });

  it('BACK in the menu resumes', () => {
    const s = run(start(), back(T0 + 1), back(T0 + 2));
    expect(s).toMatchObject({ overlay: 'none', paused: null });
  });

  it('+30 s extends rest and resumes', () => {
    const s = run(start(), ok(T0), ok(T0 + sec(1)), back(T0 + sec(2)), menu('add30', T0 + sec(2)));
    expect(s.endsAt).toBe(T0 + sec(1) + sec(60) + sec(30));
    expect(s.paused).toBeNull();
  });

  it('skip rest commits and starts the next set', () => {
    const s = run(start(), ok(T0), ok(T0 + 1), back(T0 + 2), menu('skipRest', T0 + 3));
    expect(s).toMatchObject({ phase: 'work', cursor: { item: 0, set: 1 }, overlay: 'none' });
    expect(s.logs).toHaveLength(1);
  });

  it('skip set records the skip and moves on without a log', () => {
    const s = run(start(), ok(T0), back(T0 + 1), menu('skipSet', T0 + 2));
    expect(s.cursor).toEqual({ item: 0, set: 1 });
    expect(s.skipped).toEqual([{ position: 0, setIndex: 0 }]);
    expect(s.logs).toHaveLength(0);
  });

  it('skip warm-ups jumps to the first working set', () => {
    const s = run(start(), back(T0 + 1), menu('skipWarmups', T0 + 2));
    expect(s).toMatchObject({ phase: 'work', cursor: { item: 0, set: 1 }, load: 100 });
    expect(s.skipped).toEqual([{ position: 0, setIndex: 0 }]);
  });

  it('skip exercise marks the rest of it skipped and intros the next one', () => {
    const s = run(start(), ok(T0), ok(T0 + 1), back(T0 + 2), menu('skipExercise', T0 + 3));
    expect(s).toMatchObject({ phase: 'intro', cursor: { item: 1, set: 0 }, overlay: 'none' });
    expect(s.logs).toHaveLength(1);
    expect(s.skipped).toEqual([
      { position: 0, setIndex: 1 },
      { position: 0, setIndex: 2 },
    ]);
  });

  it('end asks for confirmation; cancel returns to the menu', () => {
    const s = run(start(), back(T0), menu('end', T0 + 1));
    expect(s.overlay).toBe('confirmEnd');
    expect(run(s, menu('cancel', T0 + 2)).overlay).toBe('menu');
    expect(run(s, back(T0 + 2)).overlay).toBe('menu');
  });

  it('confirmed end commits the draft and finishes early', () => {
    const s = run(start(), ok(T0), ok(T0 + 1), back(T0 + 2), menu('end', T0 + 3), menu('confirmEnd', T0 + 4));
    expect(s).toMatchObject({ phase: 'done', endedEarly: true, endedAt: T0 + 4, overlay: 'none', paused: null });
    expect(s.logs).toHaveLength(1);
  });

  it('ignores OK while an overlay is open', () => {
    const s = run(start(), back(T0));
    expect(run(s, ok(T0 + 1))).toBe(s);
  });
});

describe('swap', () => {
  const replacement = item(0, 'machine-chest-press', sets(['working', 'working'], 8, 60, 90));

  it('replaces an untouched exercise in place and intros it', () => {
    const s = run(start(), back(T0), menu('swap', T0 + 1), { type: 'SWAP_APPLY', item: replacement, now: T0 + 2 });
    expect(s.plan.items[0]?.exerciseId).toBe('machine-chest-press');
    expect(s.plan.items).toHaveLength(2);
    expect(s).toMatchObject({ phase: 'intro', overlay: 'none', paused: null, cursor: { item: 0, set: 0 }, load: 60 });
  });

  it('keeps logged sets on the old exercise and inserts the new one after it', () => {
    const s = run(start(), ok(T0), ok(T0 + 1), back(T0 + 2), menu('swap', T0 + 3), { type: 'SWAP_APPLY', item: replacement, now: T0 + 4 });
    expect(s.plan.items.map((i) => i.exerciseId)).toEqual(['bench-press', 'machine-chest-press', 'pec-fly']);
    expect(s.plan.items[1]?.position).toBe(2);
    expect(s.cursor).toEqual({ item: 1, set: 0 });
    expect(s.logs).toHaveLength(1);
    expect(s.skipped).toEqual([
      { position: 0, setIndex: 1 },
      { position: 0, setIndex: 2 },
    ]);
  });

  it('BACK from the swap list returns to the menu', () => {
    expect(run(start(), back(T0), menu('swap', T0 + 1), back(T0 + 2)).overlay).toBe('menu');
  });
});

describe('resilience', () => {
  it('a very late TICK advances exactly one phase and pauses', () => {
    const s = run(start(), ok(T0), ok(T0 + sec(1)), tick(T0 + sec(600)));
    expect(s).toMatchObject({ phase: 'work', cursor: { item: 0, set: 1 }, overlay: 'menu', notice: 'caught_up' });
    expect(s.paused).toEqual({ at: T0 + sec(600) });
    expect(s.logs).toHaveLength(1);
  });

  it('RESTORE lands paused with a welcome-back notice', () => {
    const s = run(start(), ok(T0), { type: 'RESTORE', now: T0 + sec(5) });
    expect(s).toMatchObject({ overlay: 'menu', notice: 'welcome_back', paused: { at: T0 + sec(5) } });
  });

  it('clamps remaining time when the clock jumps backwards', () => {
    const s = run(start(), ok(T0), ok(T0 + sec(10)));
    expect(remainingMs(s, T0 - sec(3600))).toBe(sec(60));
  });

  it('work elapsed time counts up from the phase start', () => {
    const s = run(start(), ok(T0));
    expect(elapsedMs(s, T0 + sec(12))).toBe(sec(12));
  });

  it('bumps rev on every real change but not on no-op ticks', () => {
    const s0 = start();
    expect(reduce(s0, tick(T0 + 1))).toBe(s0);
    expect(reduce(s0, ok(T0 + 1)).rev).toBe(1);
  });

  it('exposes the current set', () => {
    expect(currentSet(start())).toMatchObject({ kind: 'warmup', targetLoad: 45 });
  });
});

describe('review regressions', () => {
  it('RESTORE keeps an existing pause instead of resetting it to the reload time', () => {
    const paused = run(start(), ok(T0), ok(T0 + sec(1)), back(T0 + sec(11)));
    const restored = reduce(paused, { type: 'RESTORE', now: T0 + sec(551) });
    expect(restored.paused).toEqual({ at: T0 + sec(11) });
    expect(remainingMs(restored, T0 + sec(551))).toBe(sec(50));
    const resumed = reduce(restored, menu('resume', T0 + sec(560)));
    expect(remainingMs(resumed, T0 + sec(560))).toBe(sec(50));
    expect(reduce(resumed, tick(T0 + sec(561))).phase).toBe('rest');
  });

  it('keeps a weight adjusted during get-ready when the set starts', () => {
    const s = run(start(), { type: 'SET_LOAD', load: 50, now: T0 + 1 }, ok(T0 + 2));
    expect(s.phase).toBe('work');
    expect(s.load).toBe(50);
    expect(run(s, ok(T0 + 3)).draft?.load).toBe(50);
  });

  it('a swap after skipping warm-ups does not inherit stale skip records', () => {
    const replacement = item(0, 'machine-chest-press', sets(['working', 'working'], 8, 60, 90));
    let s = run(start(), back(T0), menu('skipWarmups', T0 + 1), back(T0 + 2), menu('swap', T0 + 3), { type: 'SWAP_APPLY', item: replacement, now: T0 + 4 });
    const swapped = s.plan.items[s.cursor.item]!;
    expect(swapped.exerciseId).toBe('machine-chest-press');
    expect(s.skipped.some((r) => r.position === swapped.position)).toBe(false);
    // intro → work → rest → work → rest → (rest ends: second set logged)
    s = run(s, ok(T0 + 5), ok(T0 + 6), ok(T0 + 7), ok(T0 + 8), ok(T0 + 9));
    expect(s.logs.filter((l) => l.position === swapped.position)).toHaveLength(2);
  });

  it('skip exercise during the changeover rest skips the upcoming exercise', () => {
    let s = run(start(), ok(T0));
    for (let i = 0; i < 2; i++) s = run(s, ok(T0 + i * 10 + 1), ok(T0 + i * 10 + 2));
    s = run(s, ok(T0 + 30)); // last bench set done → changeover rest, pec-fly is next
    expect(s.phase).toBe('rest');
    s = run(s, back(T0 + 31), menu('skipExercise', T0 + 32));
    expect(s.logs.filter((l) => l.position === 0)).toHaveLength(3);
    expect(s.skipped).toEqual([
      { position: 1, setIndex: 0 },
      { position: 1, setIndex: 1 },
    ]);
    expect(s.phase).toBe('done');
  });

  it('swap during the changeover rest replaces the upcoming exercise', () => {
    const replacement = item(1, 'cable-crunch', sets(['working', 'working'], 12, 40, 60));
    let s = run(start(), ok(T0));
    for (let i = 0; i < 2; i++) s = run(s, ok(T0 + i * 10 + 1), ok(T0 + i * 10 + 2));
    s = run(s, ok(T0 + 30), back(T0 + 31), menu('swap', T0 + 32), { type: 'SWAP_APPLY', item: replacement, now: T0 + 33 });
    expect(s.plan.items.map((i) => i.exerciseId)).toEqual(['bench-press', 'cable-crunch']);
    expect(s.cursor).toEqual({ item: 1, set: 0 });
    expect(s.logs.filter((l) => l.position === 0)).toHaveLength(3);
  });

  it('a very late TICK in the final log window finishes cleanly at the deadline', () => {
    let s = run(start(), ok(T0));
    for (let i = 0; i < 4; i++) s = run(s, ok(T0 + i * 10 + 1), ok(T0 + i * 10 + 2));
    s = run(s, ok(T0 + 200));
    const deadline = s.endsAt!;
    s = reduce(s, tick(deadline + 3_600_000));
    expect(s).toMatchObject({ phase: 'done', paused: null, overlay: 'none', endedAt: deadline });
  });
});
