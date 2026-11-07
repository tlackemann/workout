import { describe, expect, it } from 'vitest';
import { formatAgo, formatClock, formatLoad, formatMinutes, formatVolume, formatWeight } from './format.ts';

describe('formatClock', () => {
  it('formats minutes and hours, rounding countdowns up', () => {
    expect(formatClock(95_000)).toBe('1:35');
    expect(formatClock(94_100)).toBe('1:35');
    expect(formatClock(94_100, false)).toBe('1:34');
    expect(formatClock(3_725_000)).toBe('1:02:05');
    expect(formatClock(-5)).toBe('0:00');
  });
});

describe('load formatting', () => {
  it('describes each load type', () => {
    expect(formatLoad(135, { type: 'barbell', lower: false })).toBe('135 lb');
    expect(formatLoad(120, { type: 'stack', station: 'mx.leg_press' })).toBe('Stack 120');
    expect(formatLoad(0, { type: 'bodyweight' })).toBe('Bodyweight');
    expect(formatLoad(25, { type: 'dumbbell' })).toBe('25 lb each');
    expect(formatWeight(2.5)).toBe('2.5');
  });

  it('formats minutes and volume', () => {
    expect(formatMinutes(3000)).toBe('50 min');
    expect(formatMinutes(10)).toBe('1 min');
    expect(formatVolume(8640)).toBe('8,640 lb');
    expect(formatVolume(12_340)).toBe('12.3k lb');
  });
});

describe('formatAgo', () => {
  const now = new Date(2026, 10, 7, 18).getTime();
  it('uses relative days', () => {
    expect(formatAgo(new Date(2026, 10, 7, 8).getTime(), now)).toBe('Today');
    expect(formatAgo(new Date(2026, 10, 6, 20).getTime(), now)).toBe('Yesterday');
    expect(formatAgo(new Date(2026, 10, 4).getTime(), now)).toBe('3 days ago');
    expect(formatAgo(new Date(2026, 9, 1).getTime(), now)).toMatch(/Oct/);
  });
});
