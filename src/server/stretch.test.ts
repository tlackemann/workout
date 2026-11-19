import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp, type App } from './app.ts';
import { openDb, type DbHandle } from './db/client.ts';
import { createRepositories, type Repositories } from './repositories/index.ts';
import type { Deps } from './services/deps.ts';
import type { StretchSessionDto } from './services/stretchDto.ts';
import { indexLibrary } from '../core/library/index.ts';
import { DEFAULT_SETTINGS } from '../core/settings.ts';
import type { StatsDto } from '../core/stats/index.ts';
import { indexStretches } from '../core/stretch/schema.ts';
import { LIBRARY } from '../data/library.ts';
import { STRETCH_TEMPLATE } from '../data/stretchTemplate.ts';
import { STRETCHES } from '../data/stretches.ts';
import { TEMPLATES } from '../data/templates.ts';

let handle: DbHandle;
let repos: Repositories;
let app: App;
let clock: number;
let ids: number;
let media: { bundled: string; overrides: string };

function makeDeps(): Deps {
  return {
    repos,
    library: indexLibrary(LIBRARY),
    templates: TEMPLATES,
    stretchLibrary: indexStretches(STRETCHES),
    stretchTemplate: STRETCH_TEMPLATE,
    now: () => clock,
    newId: () => `str-${++ids}`,
    newSeed: () => 500 + ids,
  };
}

beforeEach(() => {
  clock = Date.UTC(2026, 10, 18, 15);
  ids = 0;
  handle = openDb(':memory:', 'drizzle');
  repos = createRepositories(handle.db);
  const root = mkdtempSync(join(tmpdir(), 'gymtv-stretch-'));
  media = { bundled: join(root, 'bundled'), overrides: join(root, 'overrides') };
  app = createApp(makeDeps(), { media, rateLimit: { limit: 1000, windowMs: 60_000 } });
});

afterEach(() => handle.close());

async function call<T = unknown>(method: string, path: string, body?: unknown) {
  const res = await app.request(path, {
    method,
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = (await res.json()) as { success: boolean; data: T; error: string | null };
  return { status: res.status, ...json };
}

const create = (length?: string) => call<StretchSessionDto>('POST', '/api/stretch', length ? { length } : {});
const start = (id: string) => call<StretchSessionDto>('POST', `/api/stretch/${id}/start`, {});
const finish = (id: string, body: object) => call<StretchSessionDto>('POST', `/api/stretch/${id}/finish`, body);

async function finishedSession(endedEarly = false) {
  const planned = (await create()).data;
  await start(planned.id);
  clock += 15 * 60_000;
  const all = planned.plan.steps.map((s) => s.index);
  return (await finish(planned.id, { endedEarly, completed: all.slice(0, -1), skipped: all.slice(-1) })).data;
}

describe('planning', () => {
  it('plans a session at the default length, replacing an unstarted plan', async () => {
    const first = await create();
    expect(first.status).toBe(201);
    expect(first.data).toMatchObject({ status: 'planned', length: DEFAULT_SETTINGS.defaultLength, completed: [], skipped: [] });
    expect(first.data.plan.steps.length).toBeGreaterThan(10);
    const second = await create('quick');
    expect(second.data.length).toBe('quick');
    expect((await call('GET', `/api/stretch/${first.data.id}`)).status).toBe(404);
  });

  it('reshuffles and changes length before starting, but not after', async () => {
    const planned = (await create('quick')).data;
    const longer = await call<StretchSessionDto>('POST', `/api/stretch/${planned.id}/reroll`, { length: 'long' });
    expect(longer.data.length).toBe('long');
    expect(longer.data.plan.steps.length).toBeGreaterThan(planned.plan.steps.length);
    await start(planned.id);
    expect((await call('POST', `/api/stretch/${planned.id}/reroll`, {})).status).toBe(409);
  });

  it('validates input', async () => {
    expect((await create('marathon')).status).toBe(400);
    expect((await call('GET', '/api/stretch/nope')).status).toBe(404);
    expect((await call('GET', '/api/stretch?limit=0')).status).toBe(400);
  });

  it('leaves foam rolling out when the roller is off', async () => {
    await call('PUT', '/api/settings', { ...DEFAULT_SETTINGS, equipment: DEFAULT_SETTINGS.equipment.filter((t) => t !== 'foam_roller') });
    const planned = (await create('long')).data;
    expect(planned.plan.droppedSlots).toEqual(['roll.legs', 'roll.back', 'roll.extra']);
  });
});

describe('lifecycle', () => {
  it('starts idempotently and abandons another running stretch, never a workout', async () => {
    const workout = (await call<{ id: string }>('POST', '/api/sessions', { day: 'push' })).data;
    await call('POST', `/api/sessions/${workout.id}/start`, {});
    const a = (await create()).data;
    expect((await start(a.id)).data).toMatchObject({ status: 'active', startedAt: clock });
    expect((await start(a.id)).data.status).toBe('active');
    const b = (await create()).data;
    await start(b.id);
    expect((await call<StretchSessionDto>('GET', `/api/stretch/${a.id}`)).data.status).toBe('abandoned');
    expect((await call<{ status: string }>('GET', `/api/sessions/${workout.id}`)).data.status).toBe('active');
  });

  it('records the outcome once, clamping the end time to the session', async () => {
    const planned = (await create()).data;
    await start(planned.id);
    const startedAt = clock;
    clock += 10 * 60_000;
    const done = await finish(planned.id, { endedEarly: false, completed: [0, 1, 2], skipped: [3], endedAt: clock + 99_999 });
    expect(done.data).toMatchObject({ status: 'completed', completed: [0, 1, 2], skipped: [3], endedAt: clock });
    const retry = await finish(planned.id, { endedEarly: true, completed: [0], skipped: [], endedAt: startedAt - 5 });
    expect(retry.data).toMatchObject({ status: 'completed', endedAt: clock });
  });

  it('never dates the end before the start', async () => {
    const planned = (await create()).data;
    await start(planned.id);
    const startedAt = clock;
    clock += 60_000;
    expect((await finish(planned.id, { endedEarly: true, completed: [0], skipped: [], endedAt: startedAt - 1000 })).data).toMatchObject({
      status: 'ended_early',
      endedAt: startedAt,
    });
  });

  it('drops a session where nothing was held', async () => {
    const planned = (await create()).data;
    await start(planned.id);
    expect((await finish(planned.id, { endedEarly: true, completed: [], skipped: [0] })).data.status).toBe('abandoned');
    expect((await call<unknown[]>('GET', '/api/stretch')).data).toEqual([]);
  });

  it('rejects unknown or double-counted steps and sessions that are not running', async () => {
    const planned = (await create()).data;
    expect((await finish(planned.id, { endedEarly: false, completed: [0], skipped: [] })).status).toBe(409);
    await start(planned.id);
    expect((await finish(planned.id, { endedEarly: false, completed: [999], skipped: [] })).status).toBe(400);
    expect((await finish(planned.id, { endedEarly: false, completed: [planned.plan.steps.length], skipped: [] })).status).toBe(422);
    expect((await finish(planned.id, { endedEarly: false, completed: [1], skipped: [1] })).status).toBe(422);
    expect((await finish(planned.id, { endedEarly: 'no', completed: [], skipped: [] })).status).toBe(400);
  });

  it('refuses to start an empty plan', async () => {
    repos.stretch.create({ id: 'empty', status: 'planned', length: 'quick', seed: 1, createdAt: clock, planJson: JSON.stringify({ length: 'quick', seed: 1, steps: [], droppedSlots: [], estimatedSec: 0 }) });
    expect((await start('empty')).status).toBe(422);
  });
});

describe('history', () => {
  it('lists finished sessions newest first and deletes only finished ones', async () => {
    const older = await finishedSession();
    clock += 24 * 3_600_000;
    const newer = await finishedSession(true);
    const list = await call<StretchSessionDto[]>('GET', '/api/stretch');
    expect(list.data.map((s) => [s.id, s.status])).toEqual([
      [newer.id, 'ended_early'],
      [older.id, 'completed'],
    ]);

    const running = (await create()).data;
    await start(running.id);
    expect((await call('DELETE', `/api/stretch/${running.id}`, {})).status).toBe(409);
    expect((await call('DELETE', `/api/stretch/${older.id}`, {})).data).toEqual({ id: older.id });
    expect((await call<unknown[]>('GET', '/api/stretch')).data).toHaveLength(1);
  });

  it('avoids repeating the last session’s stretches when planning', async () => {
    const last = await finishedSession();
    const lastIds = new Set(last.plan.steps.map((s) => s.stretchId));
    const next = (await create()).data;
    const repeats = [...new Set(next.plan.steps.map((s) => s.stretchId))].filter((id) => lastIds.has(id));
    expect(repeats.length).toBeLessThan(lastIds.size / 2);
  });
});

describe('home, stats and media', () => {
  it('reports the last stretch and a rough length on Home without touching the rotation', async () => {
    const before = await call<{ nextDay: string; stretch: { lastEndedAt: number | null; estimatedSec: number } }>('GET', '/api/sessions/home');
    expect(before.data.stretch.lastEndedAt).toBeNull();
    expect(before.data.stretch.estimatedSec).toBeGreaterThan(5 * 60);
    const done = await finishedSession();
    const after = await call<{ nextDay: string; stretch: { lastEndedAt: number | null } }>('GET', '/api/sessions/home');
    expect(after.data.stretch.lastEndedAt).toBe(done.endedAt);
    expect(after.data.nextDay).toBe(before.data.nextDay);
  });

  it('offers to resume a recently started stretch session, but not a stale or finished one', async () => {
    const home = async () => (await call<{ stretch: { activeId: string | null } }>('GET', '/api/sessions/home')).data.stretch.activeId;
    const planned = (await create()).data;
    expect(await home()).toBeNull();
    await start(planned.id);
    expect(await home()).toBe(planned.id);
    clock += 13 * 3_600_000;
    expect(await home()).toBeNull();
    clock -= 12 * 3_600_000;
    await finish(planned.id, { endedEarly: true, completed: [0], skipped: [] });
    expect(await home()).toBeNull();
  });

  it('puts stretch days on the heatmap but not in the workout counts', async () => {
    await finishedSession();
    const stats = await call<StatsDto>('GET', '/api/stats?tz=UTC');
    expect(stats.data).toMatchObject({ workouts: 0, stretches: 1 });
    const cells = stats.data.consistency.heatmap.flat();
    expect(cells.find((c) => c.date === '2026-11-18')).toMatchObject({ workouts: 0, stretches: 1 });
    expect(stats.data.consistency.streak.current).toBe(0);
  });

  it('serves stretch photos by stretch id', async () => {
    mkdirSync(join(media.bundled, 'Childs_Pose'), { recursive: true });
    writeFileSync(join(media.bundled, 'Childs_Pose', '1.webp'), 'pose');
    const res = await app.request('/api/media/childs-pose/1');
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('pose');
  });
});

describe('settings upgrade', () => {
  it('switches the recovery gear on once for settings saved before stretching existed', () => {
    const { stretch: _omit, ...old } = DEFAULT_SETTINGS;
    repos.settings.save({ ...old, equipment: ['barbell'] } as typeof DEFAULT_SETTINGS, clock);
    expect(repos.settings.migrate(clock)).toBe(true);
    expect(repos.settings.get().equipment).toEqual(['barbell', 'foam_roller', 'stretch_strap', 'stretch_stick', 'exercise_ball']);
    repos.settings.save({ ...repos.settings.get(), equipment: ['barbell'] }, clock);
    expect(repos.settings.migrate(clock)).toBe(false);
    expect(repos.settings.get().equipment).toEqual(['barbell']);
  });

  it('upgrades settings a TV still running the old app saves (no stretch block)', async () => {
    const { stretch: _omit, ...old } = DEFAULT_SETTINGS;
    const saved = await call<typeof DEFAULT_SETTINGS>('PUT', '/api/settings', { ...old, equipment: ['barbell'] });
    expect(saved.status).toBe(200);
    expect(saved.data.equipment).toEqual(['barbell', 'foam_roller', 'stretch_strap', 'stretch_stick', 'exercise_ball']);
    expect(repos.settings.get().stretch).toEqual(DEFAULT_SETTINGS.stretch);
    // A current client's choices are kept as sent.
    const current = await call<typeof DEFAULT_SETTINGS>('PUT', '/api/settings', { ...DEFAULT_SETTINGS, equipment: ['barbell'] });
    expect(current.data.equipment).toEqual(['barbell']);
  });

  it('does nothing on a fresh install', () => {
    expect(repos.settings.migrate(clock)).toBe(false);
  });
});
