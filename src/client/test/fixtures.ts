import { generate } from '../../core/generator/generate.ts';
import { indexLibrary } from '../../core/library/index.ts';
import type { Plan } from '../../core/plan.ts';
import { createSession } from '../../core/session/reducer.ts';
import type { SessionState } from '../../core/session/types.ts';
import { DEFAULT_SETTINGS } from '../../core/settings.ts';
import { buildStats } from '../../core/stats/index.ts';
import type { SessionFact, StatsDto, WorkingSetFact } from '../../core/stats/types.ts';
import { LIBRARY } from '../../data/library.ts';
import { TEMPLATES } from '../../data/templates.ts';
import { generateStretch } from '../../core/stretch/generate.ts';
import { indexStretches } from '../../core/stretch/schema.ts';
import type { StretchPlan } from '../../core/stretch/types.ts';
import { STRETCH_TEMPLATE } from '../../data/stretchTemplate.ts';
import { STRETCHES } from '../../data/stretches.ts';
import type { SessionDto, StretchSessionDto } from '../app/api.ts';

export const NOW = Date.UTC(2026, 10, 7, 12);
export const library = indexLibrary(LIBRARY);

export function plan(day: 'push' | 'pull' | 'legs' = 'push'): Plan {
  return generate({ day, length: 'quick', seed: 7, now: NOW, settings: DEFAULT_SETTINGS, prefs: {}, history: {}, recent: [], library, templates: TEMPLATES });
}

export function sessionDto(overrides: Partial<SessionDto> = {}, state?: SessionState | null): SessionDto {
  const p = overrides.plan ?? plan(overrides.day ?? 'push');
  return {
    id: 's1',
    day: 'push',
    status: 'planned',
    length: 'quick',
    plan: p,
    state: state ?? null,
    createdAt: NOW,
    startedAt: null,
    endedAt: null,
    ...overrides,
  };
}

export function activeDto(stateOverrides: Partial<SessionState> = {}): SessionDto {
  const p = plan('push');
  const state = { ...createSession('s1', p, Date.now(), 10), ...stateOverrides };
  return sessionDto({ status: 'active', plan: p, startedAt: NOW }, state);
}

/**
 * Progress data from the real stats pipeline: four weeks of PPL with bench progressing,
 * an ended-early pull session, and a retired leg-press log.
 */
export function statsDto(): StatsDto {
  const DAY = 86_400_000;
  const plan: [string, SessionFact['day'], string, number][] = [
    ['p1', 'push', 'bench-press', 135],
    ['l1', 'legs', 'leg-press', 180],
    ['p2', 'push', 'bench-press', 145],
    ['u1', 'pull', 'barbell-row', 115],
    ['p3', 'push', 'bench-press', 140],
    ['p4', 'push', 'bench-press', 155],
  ];
  const sessions: SessionFact[] = plan.map(([id, day], i) => {
    const endedAt = NOW - (plan.length - i) * 4 * DAY;
    return { id, day, status: id === 'u1' ? 'ended_early' : 'completed', createdAt: endedAt - 2 * 3_600_000, startedAt: endedAt - 3_600_000, endedAt };
  });
  const sets: WorkingSetFact[] = plan.flatMap(([id, , exerciseId, load]) =>
    [5, 5, 4].map((reps) => ({ sessionId: id, exerciseId, reps, load, loggedAt: 0 })),
  );
  return buildStats({ sessions, sets, library, now: NOW, tz: 'UTC' });
}

export const NO_STRETCH = { lastEndedAt: null, estimatedSec: 14 * 60, activeId: null } as const;

export const stretchLibrary = indexStretches(STRETCHES);

export function stretchPlan(length: StretchPlan['length'] = 'quick'): StretchPlan {
  return generateStretch({ length, seed: 7, settings: DEFAULT_SETTINGS, recent: [], library: stretchLibrary, template: STRETCH_TEMPLATE });
}

export function stretchDto(overrides: Partial<StretchSessionDto> = {}): StretchSessionDto {
  return {
    id: 'st1',
    status: 'planned',
    length: 'quick',
    plan: overrides.plan ?? stretchPlan(overrides.length ?? 'quick'),
    completed: [],
    skipped: [],
    createdAt: NOW,
    startedAt: null,
    endedAt: null,
    ...overrides,
  };
}
