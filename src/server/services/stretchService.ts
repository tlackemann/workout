import type { SessionLength } from '../../core/days.ts';
import { generateStretch, STRETCH_RECENT_SESSIONS, type StretchGenerateInput } from '../../core/stretch/generate.ts';
import { HttpError } from '../http.ts';
import { STRETCH_FINISHED } from '../repositories/stretchRepo.ts';
import type { Deps } from './deps.ts';
import { stretchIdsOf, toStretchDto, type StretchSessionDto } from './stretchDto.ts';

function generationInput(deps: Deps, length: SessionLength, seed: number): StretchGenerateInput {
  return {
    length,
    seed,
    settings: deps.repos.settings.get(),
    recent: deps.repos.stretch.listFinished(STRETCH_RECENT_SESSIONS).map(stretchIdsOf),
    library: deps.stretchLibrary,
    template: deps.stretchTemplate,
  };
}

function requireRow(deps: Deps, id: string) {
  const row = deps.repos.stretch.findById(id);
  if (!row) throw new HttpError(404, 'Stretch session not found');
  return row;
}

/** Plan a new stretch session, replacing any not-yet-started plan. */
export function createPlanned(deps: Deps, length: SessionLength): StretchSessionDto {
  for (const old of deps.repos.stretch.findByStatus('planned')) deps.repos.stretch.remove(old.id);
  const seed = deps.newSeed();
  const plan = generateStretch(generationInput(deps, length, seed));
  const row = deps.repos.stretch.create({
    id: deps.newId(),
    status: 'planned',
    length,
    seed,
    planJson: JSON.stringify(plan),
    createdAt: deps.now(),
  });
  return toStretchDto(row);
}

export function reroll(deps: Deps, id: string, length?: SessionLength): StretchSessionDto {
  const row = requireRow(deps, id);
  if (row.status !== 'planned') throw new HttpError(409, 'Only planned sessions can be reshuffled');
  const seed = deps.newSeed();
  const nextLength = length ?? row.length;
  const plan = generateStretch(generationInput(deps, nextLength, seed));
  const updated = deps.repos.stretch.update(id, { seed, length: nextLength, planJson: JSON.stringify(plan) });
  return toStretchDto(updated ?? row);
}

/** Start (idempotent). Another stretch left running is abandoned; lifting sessions are untouched. */
export function start(deps: Deps, id: string): StretchSessionDto {
  const row = requireRow(deps, id);
  if (row.status === 'active') return toStretchDto(row);
  if (row.status !== 'planned') throw new HttpError(409, 'Stretch session already finished');
  if (toStretchDto(row).plan.steps.length === 0) throw new HttpError(422, 'This session has no stretches. Check your equipment in Settings.');
  const now = deps.now();
  for (const other of deps.repos.stretch.findByStatus('active')) {
    deps.repos.stretch.update(other.id, { status: 'abandoned', endedAt: now });
  }
  const updated = deps.repos.stretch.update(id, { status: 'active', startedAt: now });
  return toStretchDto(updated ?? row);
}

export interface FinishInput {
  readonly endedEarly: boolean;
  readonly completed: readonly number[];
  readonly skipped: readonly number[];
  /** When the player says it ended (it may be retrying a save made while offline). */
  readonly endedAt?: number;
}

function checkIndices(input: FinishInput, steps: number): void {
  const all = [...input.completed, ...input.skipped];
  if (all.some((i) => i >= steps)) throw new HttpError(422, 'Unknown stretch step');
  if (new Set(all).size !== all.length) throw new HttpError(422, 'A step can only be completed or skipped once');
}

/**
 * Record the outcome. Retries after a success are harmless (the first result stands).
 * A session where nothing was held is dropped (abandoned) rather than cluttering History.
 */
export function finish(deps: Deps, id: string, input: FinishInput): StretchSessionDto {
  const row = requireRow(deps, id);
  if (STRETCH_FINISHED.includes(row.status)) return toStretchDto(row);
  if (row.status !== 'active') throw new HttpError(409, 'Stretch session is not running');
  checkIndices(input, toStretchDto(row).plan.steps.length);
  const now = deps.now();
  const startedAt = row.startedAt ?? row.createdAt;
  const endedAt = Math.min(now, Math.max(startedAt, input.endedAt ?? now));
  const status = input.completed.length === 0 ? 'abandoned' : input.endedEarly ? 'ended_early' : 'completed';
  const updated = deps.repos.stretch.update(id, {
    status,
    endedAt,
    completedJson: JSON.stringify(input.completed),
    skippedJson: JSON.stringify(input.skipped),
  });
  return toStretchDto(updated ?? row);
}

export function list(deps: Deps, limit: number): StretchSessionDto[] {
  return deps.repos.stretch.listFinished(limit).map(toStretchDto);
}

/** Delete a finished stretch session from history. Nothing else depends on it. */
export function removeFinished(deps: Deps, id: string): { readonly id: string } {
  const row = requireRow(deps, id);
  if (!STRETCH_FINISHED.includes(row.status)) throw new HttpError(409, 'Only finished stretch sessions can be deleted');
  deps.repos.stretch.remove(id);
  return { id };
}

/** An unfinished session older than this isn't worth resuming (Home plans a fresh one). */
export const RESUME_WINDOW_MS = 12 * 3_600_000;

export interface StretchHomeInfo {
  readonly lastEndedAt: number | null;
  /** Rough length of a session at the default length (shown on the Home band). */
  readonly estimatedSec: number;
  /** A recently started session that never finished (TV restarted, or left while offline). */
  readonly activeId: string | null;
}

export function homeInfo(deps: Deps): StretchHomeInfo {
  const settings = deps.repos.settings.get();
  const sample = generateStretch({ ...generationInput(deps, settings.defaultLength, 1), recent: [] });
  const active = deps.repos.stretch
    .findByStatus('active')
    .find((row) => deps.now() - (row.startedAt ?? row.createdAt) <= RESUME_WINDOW_MS);
  return {
    lastEndedAt: deps.repos.stretch.listFinished(1)[0]?.endedAt ?? null,
    estimatedSec: sample.estimatedSec,
    activeId: active?.id ?? null,
  };
}
