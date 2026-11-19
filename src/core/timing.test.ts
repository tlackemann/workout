import { describe, expect, it } from 'vitest';
import { CATCH_UP_THRESHOLD_MS, elapsedMs, isLateTick, phaseLengthMs, remainingMs, resumeShift } from './timing.ts';

const timed = (over: Partial<Parameters<typeof remainingMs>[0]> = {}) => ({
  phaseStartedAt: 1_000,
  endsAt: 11_000 as number | null,
  paused: null as { at: number } | null,
  ...over,
});

describe('timing', () => {
  it('counts down, clamped to the phase length', () => {
    expect(remainingMs(timed(), 4_000)).toBe(7_000);
    expect(remainingMs(timed(), 0)).toBe(10_000);
    expect(remainingMs(timed(), 99_000)).toBe(0);
    expect(phaseLengthMs(timed())).toBe(10_000);
  });

  it('has no countdown for open-ended phases', () => {
    expect(remainingMs(timed({ endsAt: null }), 5_000)).toBeNull();
    expect(phaseLengthMs(timed({ endsAt: null }))).toBeNull();
  });

  it('freezes the clock while paused', () => {
    const paused = timed({ paused: { at: 3_000 } });
    expect(remainingMs(paused, 9_000)).toBe(8_000);
    expect(elapsedMs(paused, 9_000)).toBe(2_000);
  });

  it('shifts the deadline and phase start by the time spent paused', () => {
    expect(resumeShift(timed({ paused: { at: 3_000 } }), 8_000)).toEqual({ paused: null, phaseStartedAt: 6_000, endsAt: 16_000 });
    expect(resumeShift(timed({ endsAt: null, paused: { at: 3_000 } }), 8_000)).toEqual({ paused: null, phaseStartedAt: 6_000, endsAt: null });
  });

  it('never shifts backwards and leaves running phases alone', () => {
    expect(resumeShift(timed({ paused: { at: 9_000 } }), 8_000)).toEqual({ paused: null, phaseStartedAt: 1_000, endsAt: 11_000 });
    expect(resumeShift(timed(), 8_000)).toEqual({ paused: null, phaseStartedAt: 1_000, endsAt: 11_000 });
  });

  it('flags ticks that arrive long after the deadline', () => {
    expect(isLateTick(10_000, 10_000 + CATCH_UP_THRESHOLD_MS)).toBe(false);
    expect(isLateTick(10_000, 10_001 + CATCH_UP_THRESHOLD_MS)).toBe(true);
  });
});
