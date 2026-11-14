import type { DayKey } from './types.ts';

/**
 * Calendar maths on local 'YYYY-MM-DD' keys. Epochs become keys once (in the user's time
 * zone); everything after that is plain date arithmetic, so DST can never shift a bucket.
 * Weeks run Monday–Sunday (ISO 8601): a weekend stays with the weekdays before it.
 */
const DAY_MS = 86_400_000;

const toUtc = (key: DayKey): number => {
  const [y, m, d] = key.split('-').map(Number);
  return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1);
};
const fromUtc = (ms: number): DayKey => new Date(ms).toISOString().slice(0, 10);

export function isValidTimeZone(tz: string): boolean {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Epoch → local date key in `tz` (one cached formatter per call site). */
export function dayKeyFormatter(tz: string): (epoch: number) => DayKey {
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
  return (epoch) => {
    const parts = fmt.formatToParts(new Date(epoch));
    const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '';
    return `${part('year')}-${part('month')}-${part('day')}`;
  };
}

export function addDays(key: DayKey, days: number): DayKey {
  return fromUtc(toUtc(key) + days * DAY_MS);
}

/** 0 = Monday … 6 = Sunday. */
export function weekday(key: DayKey): number {
  return (new Date(toUtc(key)).getUTCDay() + 6) % 7;
}

/** The Monday on or before `key`. */
export function weekStart(key: DayKey): DayKey {
  return addDays(key, -weekday(key));
}

export function daysBetween(from: DayKey, to: DayKey): number {
  return Math.round((toUtc(to) - toUtc(from)) / DAY_MS);
}
