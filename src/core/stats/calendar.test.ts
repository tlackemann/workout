import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { addDays, dayKeyFormatter, daysBetween, isValidTimeZone, weekStart, weekday } from './calendar.ts';

describe('calendar', () => {
  it('formats epochs as local dates in the given zone', () => {
    const at = Date.UTC(2026, 10, 16, 3); // Mon 03:00Z = Sun 22:00 in New York
    expect(dayKeyFormatter('America/New_York')(at)).toBe('2026-11-15');
    expect(dayKeyFormatter('UTC')(at)).toBe('2026-11-16');
  });

  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });

  it('weeks start on Monday, including DST-change weeks', () => {
    expect(weekday('2026-11-16')).toBe(0);
    expect(weekStart('2026-11-15')).toBe('2026-11-09'); // Sunday belongs to the week before
    expect(weekStart('2026-03-08')).toBe('2026-03-02'); // US spring-forward Sunday
    expect(weekStart('2026-11-01')).toBe('2026-10-26'); // US fall-back Sunday
  });

  it('counts whole days between dates', () => {
    expect(daysBetween('2026-11-01', '2026-11-08')).toBe(7);
    expect(daysBetween('2026-11-08', '2026-11-01')).toBe(-7);
  });

  it('validates IANA time zones', () => {
    expect(isValidTimeZone('America/New_York')).toBe(true);
    expect(isValidTimeZone('UTC')).toBe(true);
    expect(isValidTimeZone('Mars/Base')).toBe(false);
    expect(isValidTimeZone('')).toBe(false);
  });

  it('property: weekStart is the Monday on or before the date', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 20_000 }), (offset) => {
        const key = addDays('2000-01-01', offset);
        const start = weekStart(key);
        expect(weekday(start)).toBe(0);
        const back = daysBetween(start, key);
        expect(back).toBeGreaterThanOrEqual(0);
        expect(back).toBeLessThanOrEqual(6);
      }),
    );
  });
});
