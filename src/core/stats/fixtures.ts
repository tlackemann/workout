import type { Day } from '../days.ts';
import type { DatedSession, WorkingSetFact } from './types.ts';

/** Test helpers: build dated sessions without the boilerplate. */
export const HOUR = 3_600_000;

export function set(exerciseId: string, load: number, reps: number, sessionId = 's'): WorkingSetFact {
  return { sessionId, exerciseId, load, reps, loggedAt: 0 };
}

export function dated(
  id: string,
  dayKey: string,
  sets: readonly Omit<WorkingSetFact, 'sessionId'>[],
  overrides: Partial<DatedSession> & { day?: Day } = {},
): DatedSession {
  const date = Date.parse(`${dayKey}T18:00:00Z`);
  return {
    id,
    day: 'push',
    status: 'completed',
    createdAt: date - 2 * HOUR,
    startedAt: date - HOUR,
    endedAt: date,
    date,
    dayKey,
    sets: sets.map((s) => ({ ...s, sessionId: id })),
    ...overrides,
  };
}
