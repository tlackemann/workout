import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp, type App } from './app.ts';
import { openDb, type DbHandle } from './db/client.ts';
import { createRepositories } from './repositories/index.ts';
import type { Deps } from './services/deps.ts';
import type { SessionDto } from './services/sessionDto.ts';
import { indexLibrary } from '../core/library/index.ts';
import { reduce } from '../core/session/reducer.ts';
import type { SessionEvent, SessionState } from '../core/session/types.ts';
import type { PlanItem } from '../core/plan.ts';
import { DEFAULT_SETTINGS } from '../core/settings.ts';
import { LIBRARY } from '../data/library.ts';
import { TEMPLATES } from '../data/templates.ts';

let handle: DbHandle;
let app: App;
let clock: number;
let ids: number;
let media: { bundled: string; overrides: string };

function makeDeps(): Deps {
  return {
    repos: createRepositories(handle.db),
    library: indexLibrary(LIBRARY),
    templates: TEMPLATES,
    now: () => clock,
    newId: () => `sess-${++ids}`,
    newSeed: () => 1000 + ids,
  };
}

beforeEach(() => {
  clock = Date.UTC(2026, 10, 7, 12);
  ids = 0;
  handle = openDb(':memory:', 'drizzle');
  const root = mkdtempSync(join(tmpdir(), 'gymtv-media-'));
  media = { bundled: join(root, 'bundled'), overrides: join(root, 'overrides') };
  app = createApp(makeDeps(), { media, rateLimit: { limit: 1000, windowMs: 60_000 } });
});

afterEach(() => handle.close());

async function call<T = unknown>(method: string, path: string, body?: unknown, a: App = app) {
  const res = await a.request(path, {
    method,
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = (await res.json()) as { success: boolean; data: T; error: string | null };
  return { status: res.status, ...json };
}

const okEvent = (now: number): SessionEvent => ({ type: 'OK', now });

/** Drive a whole session with OK presses, logging every target as hit. */
function completeAll(state: SessionState): SessionState {
  let s = state;
  let t = clock;
  while (s.phase !== 'done') {
    t += 1000;
    s = reduce(s, okEvent(t));
  }
  return s;
}

async function startedSession(day = 'push'): Promise<SessionDto> {
  const created = await call<SessionDto>('POST', '/api/sessions', { day, length: 'quick' });
  const started = await call<SessionDto>('POST', `/api/sessions/${created.data.id}/start`, {});
  return started.data;
}

describe('basics', () => {
  it('answers health checks in the envelope', async () => {
    const res = await call('GET', '/api/health');
    expect(res).toMatchObject({ status: 200, success: true, error: null });
  });

  it('returns a 404 envelope for unknown routes', async () => {
    expect(await call('GET', '/api/nope')).toMatchObject({ status: 404, success: false, error: 'Not found' });
  });

  it('rejects non-JSON writes (CSRF guard)', async () => {
    const res = await app.request('/api/sessions', { method: 'POST', body: 'day=push' });
    expect(res.status).toBe(415);
  });

  it('validates bodies with a readable error', async () => {
    const res = await call('POST', '/api/sessions', { day: 'arms' });
    expect(res.status).toBe(400);
    expect(res.error).toMatch(/day/);
  });

  it('rate limits per client', async () => {
    const limited = createApp(makeDeps(), { media, rateLimit: { limit: 2, windowMs: 60_000 } });
    await call('GET', '/api/health', undefined, limited);
    await call('GET', '/api/health', undefined, limited);
    expect((await call('GET', '/api/health', undefined, limited)).status).toBe(429);
  });

  it('hides internal errors behind a generic 500', async () => {
    const deps = makeDeps();
    const broken = createApp(
      { ...deps, repos: { ...deps.repos, settings: { ...deps.repos.settings, get: () => { throw new Error('disk on fire'); } } } },
      { media, log: () => {} },
    );
    const res = await call('GET', '/api/settings', undefined, broken);
    expect(res).toMatchObject({ status: 500, error: 'Something went wrong on the server' });
  });
});

describe('planning', () => {
  it('creates a planned session and replaces it when planning again', async () => {
    const first = await call<SessionDto>('POST', '/api/sessions', { day: 'pull' });
    expect(first.status).toBe(201);
    expect(first.data).toMatchObject({ status: 'planned', day: 'pull', length: 'standard' });
    expect(first.data.plan.items[0]?.exerciseId).toBe('barbell-row');
    await call('POST', '/api/sessions', { day: 'legs' });
    expect((await call('GET', `/api/sessions/${first.data.id}`)).status).toBe(404);
  });

  it('rerolls with a new seed and optional length', async () => {
    const created = await call<SessionDto>('POST', '/api/sessions', { day: 'push' });
    const rerolled = await call<SessionDto>('POST', `/api/sessions/${created.data.id}/reroll`, { length: 'long' });
    expect(rerolled.data.length).toBe('long');
    expect(rerolled.data.plan.seed).not.toBe(created.data.plan.seed);
  });

  it('lists alternatives and swaps a planned item', async () => {
    const created = await call<SessionDto>('POST', '/api/sessions', { day: 'push' });
    const triceps = created.data.plan.items.find((i) => i.slotId === 'push.triceps')!;
    const alts = await call<PlanItem[]>('GET', `/api/sessions/${created.data.id}/items/${triceps.position}/alternatives`);
    expect(alts.data.length).toBeGreaterThan(0);
    const choice = alts.data[0]!.exerciseId;
    const swapped = await call<SessionDto>('PUT', `/api/sessions/${created.data.id}/items/${triceps.position}`, { exerciseId: choice });
    expect(swapped.data.plan.items.find((i) => i.position === triceps.position)?.exerciseId).toBe(choice);
  });

  it('refuses a swap to something that is not a valid alternative', async () => {
    const created = await call<SessionDto>('POST', '/api/sessions', { day: 'push' });
    const res = await call('PUT', `/api/sessions/${created.data.id}/items/0`, { exerciseId: 'back-squat' });
    expect(res.status).toBe(422);
  });
});

describe('session lifecycle', () => {
  it('starts a session with an initial player state', async () => {
    const session = await startedSession();
    expect(session.status).toBe('active');
    expect(session.state).toMatchObject({ phase: 'intro', rev: 0, sessionId: session.id, getReadySec: 10 });
    const home = await call<{ active: SessionDto | null }>('GET', '/api/sessions/home');
    expect(home.data.active?.id).toBe(session.id);
  });

  it('saves state, upserts logs idempotently, and rejects stale revisions', async () => {
    const session = await startedSession();
    let s = session.state!;
    s = reduce(s, okEvent(clock + 1));
    s = reduce(s, okEvent(clock + 2));
    s = reduce(s, okEvent(clock + 3));
    expect(s.logs).toHaveLength(1);

    const saved = await call<SessionDto>('PUT', `/api/sessions/${session.id}/state`, { state: s });
    expect(saved.status).toBe(200);
    const stale = await call<SessionDto>('PUT', `/api/sessions/${session.id}/state`, { state: s });
    expect(stale.status).toBe(409);
    expect(stale.data.state?.rev).toBe(s.rev);

    const again = { ...s, rev: s.rev + 1 };
    expect((await call('PUT', `/api/sessions/${session.id}/state`, { state: again })).status).toBe(200);
    const history = await call<unknown[]>('GET', `/api/exercises/${s.logs[0]!.exerciseId}/history`);
    expect(history.status).toBe(200);
  });

  it('rejects malformed state', async () => {
    const session = await startedSession();
    const res = await call('PUT', `/api/sessions/${session.id}/state`, { state: { ...session.state, phase: 'party' } });
    expect(res.status).toBe(400);
  });

  it('completes a session, summarises it and progresses the next one', async () => {
    const session = await startedSession('push');
    const done = completeAll(reduce(session.state!, okEvent(clock)));
    const saved = await call<SessionDto>('PUT', `/api/sessions/${session.id}/state`, { state: done });
    expect(saved.data.status).toBe('completed');

    const summary = await call<{ workingSets: number; exercises: { next: { load: number } | null }[] }>('GET', `/api/sessions/${session.id}/summary`);
    expect(summary.data.workingSets).toBeGreaterThan(0);

    const home = await call<{ nextDay: string; active: unknown; last: { day: string } }>('GET', '/api/sessions/home');
    expect(home.data).toMatchObject({ nextDay: 'pull', active: null, last: { day: 'push' } });

    const list = await call<SessionDto[]>('GET', '/api/sessions?limit=5');
    expect(list.data.map((s) => s.id)).toContain(session.id);

    clock += 3 * 86_400_000;
    const next = await call<SessionDto>('POST', '/api/sessions', { day: 'push', length: 'quick' });
    const bench = next.data.plan.items[0]!;
    expect(bench.exerciseId).toBe('bench-press');
    // All targets were logged as hit → reps go up (bottom of range was 5).
    expect(bench.reason).toBe('add_reps');
    expect(bench.sets.at(-1)?.targetReps).toBe(6);
  });

  it('bases the next plan on the top set and the logged warm-up opener', async () => {
    const session = await startedSession('push');
    const bench = session.state!.plan.items.find((i) => i.exerciseId === 'bench-press')!;
    const firstWorking = bench.sets.findIndex((s) => s.kind === 'working');
    // Warm up from 65 instead of the bar; ramp the last two working sets up to 115.
    const loadFor = (set: number) => (set === 0 ? 65 : set >= firstWorking + 2 ? 115 : null);
    let s = reduce(session.state!, okEvent(clock));
    let t = clock;
    while (s.phase !== 'done') {
      t += 1000;
      const load = s.phase === 'work' && s.cursor.item === bench.position ? loadFor(s.cursor.set) : null;
      if (load !== null) s = reduce(s, { type: 'SET_LOAD', load, now: t });
      s = reduce(s, okEvent(t));
    }
    await call('PUT', `/api/sessions/${session.id}/state`, { state: s });

    const history = await call<{ sets: { load: number }[]; warmups: { load: number }[] }[]>('GET', '/api/exercises/bench-press/history');
    expect(history.data[0]?.warmups[0]?.load).toBe(65);
    expect(history.data[0]?.sets.map((x) => x.load).slice(-2)).toEqual([115, 115]);

    clock += 3 * 86_400_000;
    const next = await call<SessionDto>('POST', '/api/sessions', { day: 'push', length: 'quick' });
    const nextBench = next.data.plan.items.find((i) => i.exerciseId === 'bench-press')!;
    expect(nextBench).toMatchObject({ reason: 'consolidate', lastLoad: 115 });
    expect(nextBench.sets.filter((x) => x.kind === 'working').map((x) => x.targetLoad)).toEqual([115, 115, 115, 115]);
    expect(nextBench.sets[0]).toMatchObject({ kind: 'warmup', targetLoad: 65 });

    // A plan carrying the new reason must still pass state validation when saved.
    const started = await call<SessionDto>('POST', `/api/sessions/${next.data.id}/start`, {});
    const moved = reduce(started.data.state!, okEvent(clock + 1));
    expect((await call('PUT', `/api/sessions/${next.data.id}/state`, { state: moved })).status).toBe(200);
  });

  it('deletes a finished workout along with its logged sets', async () => {
    const session = await startedSession('push');
    const done = completeAll(reduce(session.state!, okEvent(clock)));
    await call('PUT', `/api/sessions/${session.id}/state`, { state: done });
    const exerciseId = done.logs[0]!.exerciseId;
    expect((await call<unknown[]>('GET', `/api/exercises/${exerciseId}/history`)).data.length).toBeGreaterThan(0);

    const removed = await call('DELETE', `/api/sessions/${session.id}`, {});
    expect(removed).toMatchObject({ status: 200, success: true, data: { id: session.id } });
    expect((await call('GET', `/api/sessions/${session.id}`)).status).toBe(404);
    expect((await call<SessionDto[]>('GET', '/api/sessions')).data).toEqual([]);
    // Its sets no longer feed progression, and Home forgets it was the last workout.
    expect((await call<unknown[]>('GET', `/api/exercises/${exerciseId}/history`)).data).toEqual([]);
    const home = await call<{ nextDay: string; last: unknown }>('GET', '/api/sessions/home');
    expect(home.data).toMatchObject({ nextDay: 'push', last: null });
  });

  it('only deletes finished workouts', async () => {
    const planned = await call<SessionDto>('POST', '/api/sessions', { day: 'legs' });
    expect((await call('DELETE', `/api/sessions/${planned.data.id}`, {})).status).toBe(409);
    const active = await startedSession();
    const res = await call('DELETE', `/api/sessions/${active.id}`, {});
    expect(res).toMatchObject({ status: 409, error: 'Only finished workouts can be deleted' });
    expect((await call<SessionDto>('GET', `/api/sessions/${active.id}`)).data.status).toBe('active');
    expect((await call('DELETE', '/api/sessions/nope', {})).status).toBe(404);
  });

  it('abandons a previously active session when another starts', async () => {
    const first = await startedSession('push');
    await startedSession('legs');
    const row = await call<SessionDto>('GET', `/api/sessions/${first.id}`);
    expect(row.data.status).toBe('abandoned');
  });
});

describe('settings & prefs', () => {
  it('round-trips settings and validates them', async () => {
    const updated = { ...DEFAULT_SETTINGS, barWeight: 35 };
    expect((await call('PUT', '/api/settings', updated)).status).toBe(200);
    expect((await call<typeof DEFAULT_SETTINGS>('GET', '/api/settings')).data.barWeight).toBe(35);
    expect((await call('PUT', '/api/settings', { ...updated, barWeight: -1 })).status).toBe(400);
  });

  it('stores prefs for known exercises only', async () => {
    const pref = { favorite: true, banned: false, startLoad: 100 };
    expect((await call('PUT', '/api/exercises/bench-press/prefs', pref)).status).toBe(200);
    expect((await call<Record<string, unknown>>('GET', '/api/prefs')).data['bench-press']).toEqual(pref);
    expect((await call('PUT', '/api/exercises/not-real/prefs', pref)).status).toBe(404);
  });
});

describe('media', () => {
  it('prefers a user override, then the bundled frame', async () => {
    mkdirSync(join(media.bundled, 'Barbell_Bench_Press_-_Medium_Grip'), { recursive: true });
    writeFileSync(join(media.bundled, 'Barbell_Bench_Press_-_Medium_Grip', '0.webp'), 'bundled');
    const bundled = await app.request('/api/media/bench-press/0');
    expect(bundled.headers.get('content-type')).toBe('image/webp');
    expect(await bundled.text()).toBe('bundled');

    mkdirSync(join(media.overrides, 'bench-press'), { recursive: true });
    writeFileSync(join(media.overrides, 'bench-press', '0.jpg'), 'mine');
    const override = await app.request('/api/media/bench-press/0');
    expect(override.headers.get('content-type')).toBe('image/jpeg');
    expect(await override.text()).toBe('mine');
  });

  it('404s for unknown exercises or missing frames and rejects bad params', async () => {
    expect((await app.request('/api/media/not-real/0')).status).toBe(404);
    expect((await app.request('/api/media/bench-press/1')).status).toBe(404);
    expect((await app.request('/api/media/bench-press/7')).status).toBe(400);
    expect((await app.request('/api/media/..%2Fetc/0')).status).toBe(400);
  });
});

describe('static SPA serving', () => {
  it('serves files, falls back to index.html for app routes, and never for /api', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'gymtv-static-'));
    writeFileSync(join(dir, 'index.html'), '<!doctype html><div id="root"></div>');
    writeFileSync(join(dir, 'tv-check.html'), 'check');
    const withStatic = createApp(makeDeps(), { media, staticDir: dir });

    expect(await (await withStatic.request('/tv-check.html')).text()).toBe('check');
    const spa = await withStatic.request('/play/abc');
    expect(spa.status).toBe(200);
    expect(await spa.text()).toContain('id="root"');

    const apiMiss = await withStatic.request('/api/does-not-exist');
    expect(apiMiss.status).toBe(404);
    expect(await apiMiss.json()).toMatchObject({ success: false, error: 'Not found' });
  });
});

describe('review regressions (server)', () => {
  it('refuses to start a workout with no exercises', async () => {
    await call('PUT', '/api/settings', { ...DEFAULT_SETTINGS, equipment: ['bench.flat'] });
    const created = await call<SessionDto>('POST', '/api/sessions', { day: 'pull' });
    expect(created.data.plan.items).toHaveLength(0);
    const res = await call('POST', `/api/sessions/${created.data.id}/start`, {});
    expect(res.status).toBe(422);
  });

  it('answers saves to an abandoned session with 409 and the session, not a silent success', async () => {
    const first = await startedSession('push');
    await startedSession('legs');
    const s = reduce(first.state!, okEvent(clock + 1));
    const res = await call<SessionDto>('PUT', `/api/sessions/${first.id}/state`, { state: s });
    expect(res.status).toBe(409);
    expect(res.error).toBe('Session is not active');
    expect(res.data.status).toBe('abandoned');
  });
});
