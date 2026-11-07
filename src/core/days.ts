export const DAYS = ['push', 'pull', 'legs'] as const;
export type Day = (typeof DAYS)[number];

export const DAY_LABELS: Record<Day, string> = { push: 'Push', pull: 'Pull', legs: 'Legs' };

/** Push → Pull → Legs → Push … */
export function nextDay(last: Day | null): Day {
  if (!last) return 'push';
  const idx = DAYS.indexOf(last);
  return DAYS[(idx + 1) % DAYS.length] ?? 'push';
}

export const SESSION_LENGTHS = ['quick', 'standard', 'long'] as const;
export type SessionLength = (typeof SESSION_LENGTHS)[number];

export const LENGTH_LABELS: Record<SessionLength, string> = { quick: 'Quick', standard: 'Standard', long: 'Long' };
