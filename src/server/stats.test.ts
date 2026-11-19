import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp, type App } from './app.ts';
import { openDb, type DbHandle } from './db/client.ts';
import { createRepositories, type Repositories } from './repositories/index.ts';
import type { SessionStatus } from './repositories/sessionsRepo.ts';
import { indexLibrary } from '../core/library/index.ts';
import type { StatsDto } from '../core/stats/index.ts';
import type { SetLog } from '../core/session/types.ts';
import { LIBRARY } from '../data/library.ts';
import { TEMPLATES } from '../data/templates.ts';
import { STRETCH_TEMPLATE } from '../data/stretchTemplate.ts';
import { STRETCHES } from '../data/stretches.ts';
import { indexStretches } from '../core/stretch/schema.ts';

const NOW = Date.UTC(2026, 10, 14, 17); // Sat Nov 14, 12:00 in New York
const HOUR = 3_600_000;

let handle: DbHandle;
let repos: Repositories;
let app: App;

beforeEach(() => {
  handle = openDb(':memory:', 'drizzle');
  repos = createRepositories(handle.db);
  const root = mkdtempSync(join(tmpdir(), 'gymtv-stats-'));
  app = createApp(
    { repos, library: indexLibrary(LIBRARY), templates: TEMPLATES, stretchLibrary: indexStretches(STRETCHES), stretchTemplate: STRETCH_TEMPLATE, now: () => NOW, newId: () => 'x', newSeed: () => 1 },
    { media: { bundled: join(root, 'b'), overrides: join(root, 'o') } },
  );
});

afterEach(() => handle.close());

function seed(id: string, status: SessionStatus, endedAt: number, sets: { exerciseId: string; load: number; reps: number }[]) {
  repos.sessions.create({ id, day: 'push', status, length: 'standard', seed: 1, planJson: '{}', schemaVersion: 1, createdAt: endedAt - 2 * HOUR, startedAt: endedAt - HOUR, endedAt });
  const logs: SetLog[] = sets.map((s, i) => ({
    position: 0,
    setIndex: i,
    exerciseId: s.exerciseId,
    kind: 'working',
    reps: s.reps,
    load: s.load,
    targetReps: s.reps,
    targetLoad: s.load,
    repMin: 5,
    repMax: 8,
    plannedSets: sets.length,
    loggedAt: endedAt,
  }));
  repos.setLogs.upsertMany(id, logs);
}

async function getStats(query = '') {
  const res = await app.request(`/api/stats${query}`);
  const json = (await res.json()) as { success: boolean; data: StatsDto; error: string | null };
  return { status: res.status, ...json };
}

describe('GET /api/stats', () => {
  it('answers with an empty but complete result for a fresh database', async () => {
    const res = await getStats('?tz=America/New_York');
    expect(res.status).toBe(200);
    expect(res.data).toMatchObject({ workouts: 0, lifts: [], today: '2026-11-14' });
    expect(res.data.consistency.streak.current).toBe(0);
  });

  it('includes finished workouts across every view and ignores abandoned ones', async () => {
    seed('done', 'completed', NOW - 24 * HOUR, [{ exerciseId: 'bench-press', load: 135, reps: 5 }]);
    seed('quit', 'abandoned', NOW - 2 * HOUR, [{ exerciseId: 'bench-press', load: 500, reps: 5 }]);
    const { data } = await getStats('?tz=America/New_York');
    expect(data.workouts).toBe(1);
    expect(data.lifts[0]).toMatchObject({ exerciseId: 'bench-press', name: 'Bench Press', known: true });
    expect(data.lifts[0]?.points.map((p) => p.topLoad)).toEqual([135]);
    expect(data.consistency.streak).toMatchObject({ current: 1, thisWeek: 1 });
    expect(data.sessions.byDay.push).toHaveLength(1);
    expect(data.muscles.rows.find((r) => r.muscle === 'chest')?.primary).toBe(1);
  });

  it('copes with logs for exercises no longer in the library', async () => {
    seed('old', 'completed', NOW - 48 * HOUR, [{ exerciseId: 'leg-press', load: 180, reps: 10 }]);
    const res = await getStats();
    expect(res.status).toBe(200);
    expect(res.data.lifts[0]).toMatchObject({ name: 'Leg Press', known: false });
    expect(res.data.muscles.unmappedSets).toBe(1);
  });

  it('buckets days in the client’s time zone', async () => {
    seed('late', 'ended_early', Date.UTC(2026, 10, 9, 3), [{ exerciseId: 'bench-press', load: 135, reps: 5 }]); // Sun 22:00 NY
    const ny = await getStats('?tz=America/New_York');
    expect(ny.data.consistency.streak.thisWeek).toBe(0);
    const utc = await getStats('?tz=UTC');
    expect(utc.data.consistency.streak.thisWeek).toBe(1);
  });

  it('rejects an unknown time zone', async () => {
    const res = await getStats('?tz=Mars/Base');
    expect(res.status).toBe(400);
    expect(res.error).toMatch(/time zone/i);
  });
});
