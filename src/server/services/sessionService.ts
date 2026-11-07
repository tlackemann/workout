import type { Day, SessionLength } from '../../core/days.ts';
import { nextDay } from '../../core/days.ts';
import { alternatives } from '../../core/generator/alternatives.ts';
import { generate, type GenerateInput } from '../../core/generator/generate.ts';
import type { PlanItem } from '../../core/plan.ts';
import { createSession } from '../../core/session/reducer.ts';
import { SESSION_SCHEMA_VERSION, type SessionState } from '../../core/session/types.ts';
import { summarize, type SessionSummary } from '../../core/summary.ts';
import { HttpError } from '../http.ts';
import type { Deps } from './deps.ts';
import { exerciseIdsOf, toDto, type SessionDto } from './sessionDto.ts';

const RECENT_PER_DAY = 2;

function generationInput(deps: Deps, day: Day, length: SessionLength, seed: number, excludeSessionId?: string): GenerateInput {
  return {
    day,
    length,
    seed,
    now: deps.now(),
    settings: deps.repos.settings.get(),
    prefs: deps.repos.prefs.all(),
    history: deps.repos.setLogs.history(excludeSessionId),
    recent: deps.repos.sessions.recentFinished(day, RECENT_PER_DAY).map(exerciseIdsOf),
    library: deps.library,
    templates: deps.templates,
  };
}

function requireSession(deps: Deps, id: string) {
  const row = deps.repos.sessions.findById(id);
  if (!row) throw new HttpError(404, 'Session not found');
  return row;
}

/** Plan a new session, replacing any not-yet-started plan. */
export function createPlanned(deps: Deps, day: Day, length: SessionLength): SessionDto {
  for (const old of deps.repos.sessions.findByStatus('planned')) deps.repos.sessions.remove(old.id);
  const seed = deps.newSeed();
  const plan = generate(generationInput(deps, day, length, seed));
  const row = deps.repos.sessions.create({
    id: deps.newId(),
    day,
    status: 'planned',
    length,
    seed,
    planJson: JSON.stringify(plan),
    schemaVersion: SESSION_SCHEMA_VERSION,
    createdAt: deps.now(),
  });
  return toDto(row);
}

export function reroll(deps: Deps, id: string, length?: SessionLength): SessionDto {
  const row = requireSession(deps, id);
  if (row.status !== 'planned') throw new HttpError(409, 'Only planned sessions can be rerolled');
  const seed = deps.newSeed();
  const nextLength = length ?? row.length;
  const plan = generate(generationInput(deps, row.day, nextLength, seed));
  const updated = deps.repos.sessions.update(id, { seed, length: nextLength, planJson: JSON.stringify(plan) });
  return toDto(updated ?? row);
}

/** Replace one planned item before the workout starts (only with a server-ranked alternative). */
export function swapPlanned(deps: Deps, id: string, position: number, exerciseId: string): SessionDto {
  const row = requireSession(deps, id);
  if (row.status !== 'planned') throw new HttpError(409, 'Session already started');
  const replacement = alternativesFor(deps, id, position).find((i) => i.exerciseId === exerciseId);
  if (!replacement) throw new HttpError(422, 'Not a valid alternative for that exercise');
  const dto = toDto(row);
  const items = dto.plan.items.map((i) => (i.position === position ? { ...replacement, position } : i));
  const updated = deps.repos.sessions.update(id, { planJson: JSON.stringify({ ...dto.plan, items }) });
  return toDto(updated ?? row);
}

export function alternativesFor(deps: Deps, id: string, position: number): PlanItem[] {
  const row = requireSession(deps, id);
  const dto = toDto(row);
  return alternatives({ ...generationInput(deps, row.day, row.length, row.seed, id), plan: dto.plan, position });
}

export function start(deps: Deps, id: string): SessionDto {
  const row = requireSession(deps, id);
  if (row.status === 'active') return toDto(row);
  if (row.status !== 'planned') throw new HttpError(409, 'Session already finished');
  if (toDto(row).plan.items.length === 0) throw new HttpError(422, 'This workout has no exercises. Check your equipment in Settings.');
  for (const other of deps.repos.sessions.findByStatus('active')) {
    deps.repos.sessions.update(other.id, { status: 'abandoned', endedAt: deps.now() });
  }
  const now = deps.now();
  const state = createSession(id, toDto(row).plan, now, deps.repos.settings.get().getReadySec);
  const updated = deps.repos.sessions.update(id, {
    status: 'active',
    startedAt: now,
    stateJson: JSON.stringify(state),
    stateRev: state.rev,
  });
  return toDto(updated ?? row);
}

export type SaveResult = { readonly kind: 'saved' | 'stale' | 'inactive'; readonly session: SessionDto };

/** Persist the player state and upsert its set logs in one go. Stale revisions are rejected. */
export function saveState(deps: Deps, id: string, state: SessionState): SaveResult {
  const row = requireSession(deps, id);
  if (state.sessionId !== id) throw new HttpError(400, 'State belongs to a different session');
  // Ended/abandoned elsewhere: tell the client (with the session) instead of accepting writes.
  if (row.status !== 'active') return { kind: 'inactive', session: toDto(row) };
  if (state.rev <= row.stateRev) return { kind: 'stale', session: toDto(row) };

  const done = state.phase === 'done';
  const updated = deps.repos.transaction((repos) => {
    repos.setLogs.upsertMany(id, state.logs);
    return repos.sessions.update(id, {
      stateJson: JSON.stringify(state),
      stateRev: state.rev,
      ...(done ? { status: state.endedEarly ? 'ended_early' : 'completed', endedAt: state.endedAt ?? deps.now() } : {}),
    });
  });
  return { kind: 'saved', session: toDto(updated ?? row) };
}

export function summaryFor(deps: Deps, id: string): SessionSummary {
  const row = requireSession(deps, id);
  const dto = toDto(row);
  return summarize({
    logs: deps.repos.setLogs.forSession(id),
    skipped: dto.state?.skipped ?? [],
    startedAt: row.startedAt ?? row.createdAt,
    endedAt: row.endedAt ?? deps.now(),
    history: deps.repos.setLogs.history(id),
    library: deps.library,
    settings: deps.repos.settings.get(),
    now: deps.now(),
  });
}

export interface HomeDto {
  readonly nextDay: Day;
  readonly last: { readonly day: Day; readonly endedAt: number | null } | null;
  readonly active: SessionDto | null;
}

export function home(deps: Deps): HomeDto {
  const last = deps.repos.sessions.recentFinished(null, 1)[0] ?? null;
  const active = deps.repos.sessions.findByStatus('active')[0] ?? null;
  return {
    nextDay: nextDay(last?.day ?? null),
    last: last ? { day: last.day, endedAt: last.endedAt } : null,
    active: active ? toDto(active) : null,
  };
}
