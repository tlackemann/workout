import type { LoadSpec } from '../../core/library/schema.ts';

/** 95_000 → "1:35"; 3_725_000 → "1:02:05". Rounds up so a countdown never shows 0:00 early. */
export function formatClock(ms: number, roundUp = true): string {
  const total = Math.max(0, roundUp ? Math.ceil(ms / 1000) : Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

export function formatWeight(lb: number): string {
  return Number.isInteger(lb) ? `${lb}` : lb.toFixed(1);
}

/** Human description of what to load, e.g. "135 lb", "Stack 120", "Bodyweight", "25 lb each". */
export function formatLoad(load: number, spec: LoadSpec): string {
  switch (spec.type) {
    case 'bodyweight':
      return 'Bodyweight';
    case 'stack':
      return `Stack ${formatWeight(load)}`;
    case 'dumbbell':
      return `${formatWeight(load)} lb each`;
    default:
      return `${formatWeight(load)} lb`;
  }
}

export function formatMinutes(sec: number): string {
  return `${Math.max(1, Math.round(sec / 60))} min`;
}

export function formatVolume(lb: number): string {
  return lb >= 10_000 ? `${(lb / 1000).toFixed(1)}k lb` : `${Math.round(lb).toLocaleString('en-US')} lb`;
}

const DAY_FMT = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const SHORT_DATE_FMT = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const KEY_DATE_FMT = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const TIME_FMT = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });

export const formatDate = (epoch: number) => DAY_FMT.format(new Date(epoch));
export const formatTimeOfDay = (epoch: number) => TIME_FMT.format(new Date(epoch));
/** "Nov 14". */
export const formatShortDate = (epoch: number) => SHORT_DATE_FMT.format(new Date(epoch));
/** A 'YYYY-MM-DD' calendar key as "Nov 14" (no time-zone shifting). */
export const formatDayKey = (key: string) => KEY_DATE_FMT.format(new Date(`${key}T00:00:00Z`));

/** "1 week", "3 weeks". */
export function formatWeeks(n: number): string {
  return `${n} ${n === 1 ? 'week' : 'weeks'}`;
}

/** Axis-friendly numbers: 950, 1.5k, 12k. */
export function formatCompact(n: number): string {
  if (Math.abs(n) < 1000) return `${Math.round(n * 10) / 10}`;
  const k = n / 1000;
  return `${Math.abs(k) < 10 ? Math.round(k * 10) / 10 : Math.round(k)}k`;
}

/** One decimal at most, dropping a trailing ".0": 4, 4.5. */
export function formatDecimal(n: number): string {
  return `${Math.round(n * 10) / 10}`;
}

/** "Today", "Yesterday", "3 days ago", or a date. */
export function formatAgo(epoch: number, now: number): string {
  const startOfDay = (t: number) => new Date(t).setHours(0, 0, 0, 0);
  const days = Math.round((startOfDay(now) - startOfDay(epoch)) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return formatDate(epoch);
}
