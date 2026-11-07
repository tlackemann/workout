import { generate } from '../../core/generator/generate.ts';
import { indexLibrary } from '../../core/library/index.ts';
import type { Plan } from '../../core/plan.ts';
import { createSession } from '../../core/session/reducer.ts';
import type { SessionState } from '../../core/session/types.ts';
import { DEFAULT_SETTINGS } from '../../core/settings.ts';
import { LIBRARY } from '../../data/library.ts';
import { TEMPLATES } from '../../data/templates.ts';
import type { SessionDto } from '../app/api.ts';

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
