import type { Day, SessionLength } from '../../core/days.ts';
import type { PlanItem } from '../../core/plan.ts';
import type { Exposure } from '../../core/progression/types.ts';
import type { SessionState } from '../../core/session/types.ts';
import type { ExercisePref, Prefs, Settings } from '../../core/settings.ts';
import type { SessionSummary } from '../../core/summary.ts';
import type { HomeDto } from '../../server/services/sessionService.ts';
import type { SessionDto } from '../../server/services/sessionDto.ts';

export type { HomeDto, SessionDto };

interface Envelope<T> {
  readonly success: boolean;
  readonly data: T | null;
  readonly error: string | null;
}

export class ApiError extends Error {
  readonly status: number;
  readonly data: unknown;
  constructor(status: number, message: string, data: unknown) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'Can’t reach the server. Check the network.', null);
  }
  const envelope = (await res.json().catch(() => null)) as Envelope<T> | null;
  if (!res.ok || !envelope?.success) {
    throw new ApiError(res.status, envelope?.error ?? `Request failed (${res.status})`, envelope?.data ?? null);
  }
  return envelope.data as T;
}

export const api = {
  home: () => request<HomeDto>('GET', '/api/sessions/home'),
  sessions: (limit = 20) => request<SessionDto[]>('GET', `/api/sessions?limit=${limit}`),
  session: (id: string) => request<SessionDto>('GET', `/api/sessions/${id}`),
  createSession: (day: Day, length?: SessionLength) => request<SessionDto>('POST', '/api/sessions', { day, length }),
  reroll: (id: string, length?: SessionLength) => request<SessionDto>('POST', `/api/sessions/${id}/reroll`, { length }),
  alternatives: (id: string, position: number) =>
    request<PlanItem[]>('GET', `/api/sessions/${id}/items/${position}/alternatives`),
  swapPlanned: (id: string, position: number, exerciseId: string) =>
    request<SessionDto>('PUT', `/api/sessions/${id}/items/${position}`, { exerciseId }),
  start: (id: string) => request<SessionDto>('POST', `/api/sessions/${id}/start`, {}),
  saveState: (id: string, state: SessionState) => request<SessionDto>('PUT', `/api/sessions/${id}/state`, { state }),
  summary: (id: string) => request<SessionSummary>('GET', `/api/sessions/${id}/summary`),
  settings: () => request<Settings>('GET', '/api/settings'),
  saveSettings: (settings: Settings) => request<Settings>('PUT', '/api/settings', settings),
  prefs: () => request<Prefs>('GET', '/api/prefs'),
  savePref: (exerciseId: string, pref: ExercisePref) =>
    request<ExercisePref>('PUT', `/api/exercises/${exerciseId}/prefs`, pref),
  history: (exerciseId: string) => request<Exposure[]>('GET', `/api/exercises/${exerciseId}/history`),
};

export const mediaUrl = (exerciseId: string, frame: 0 | 1) => `/api/media/${exerciseId}/${frame}`;
