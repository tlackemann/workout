import { describe, expect, it } from 'vitest';
import { estimate1rm, summarize } from './summary.ts';
import { indexLibrary } from './library/index.ts';
import { DEFAULT_SETTINGS } from './settings.ts';
import type { SetLog } from './session/types.ts';
import { LIBRARY } from '../data/library.ts';

const library = indexLibrary(LIBRARY);
const NOW = Date.UTC(2026, 10, 7);

function log(setIndex: number, reps: number, load: number, kind: 'warmup' | 'working' = 'working'): SetLog {
  return {
    position: 0, setIndex, exerciseId: 'bench-press', kind, reps, load,
    targetReps: 5, targetLoad: load, repMin: 5, repMax: 8, plannedSets: 2, loggedAt: NOW,
  };
}

describe('estimate1rm', () => {
  it('uses Epley and ignores bodyweight / zero-rep sets', () => {
    expect(estimate1rm(100, 10)).toBeCloseTo(133.33, 1);
    expect(estimate1rm(0, 10)).toBe(0);
    expect(estimate1rm(100, 0)).toBe(0);
  });
});

describe('summarize', () => {
  const logs = [log(0, 10, 45, 'warmup'), log(1, 8, 135), log(2, 8, 135)];

  it('totals working volume and counts sets', () => {
    const s = summarize({ logs, skipped: [], startedAt: NOW - 3_600_000, endedAt: NOW, history: {}, library, settings: DEFAULT_SETTINGS, now: NOW });
    expect(s.volume).toBe(8 * 135 * 2);
    expect(s.workingSets).toBe(2);
    expect(s.durationSec).toBe(3600);
  });

  it('flags a PR against history and computes the next target', () => {
    const history = {
      'bench-press': [{ sessionId: 'old', date: NOW - 7 * 86_400_000, repMin: 5, repMax: 8, plannedSets: 2, sets: [{ reps: 8, load: 125 }, { reps: 8, load: 125 }] }],
    };
    const s = summarize({ logs, skipped: [], startedAt: NOW - 1000, endedAt: NOW, history, library, settings: DEFAULT_SETTINGS, now: NOW });
    const bench = s.exercises[0]!;
    expect(bench.isPr).toBe(true);
    expect(bench.next).toMatchObject({ load: 140, reason: 'progress' });
  });

  it('does not flag a PR on the first ever exposure', () => {
    const s = summarize({ logs, skipped: [], startedAt: NOW - 1000, endedAt: NOW, history: {}, library, settings: DEFAULT_SETTINGS, now: NOW });
    expect(s.exercises[0]!.isPr).toBe(false);
  });
});
