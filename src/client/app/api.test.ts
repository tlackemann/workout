import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError, mediaUrl } from './api.ts';

afterEach(() => vi.unstubAllGlobals());

function respond(status: number, body: unknown) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })));
}

describe('api client', () => {
  it('unwraps the envelope', async () => {
    respond(200, { success: true, data: { status: 'ok' }, error: null });
    await expect(api.home()).resolves.toEqual({ status: 'ok' });
  });

  it('sends JSON bodies for writes', async () => {
    respond(201, { success: true, data: { id: 'x' }, error: null });
    await api.createSession('push', 'quick');
    const [url, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(url).toBe('/api/sessions');
    expect(init).toMatchObject({ method: 'POST', headers: { 'content-type': 'application/json' } });
    expect(JSON.parse(init.body)).toEqual({ day: 'push', length: 'quick' });
  });

  it('throws ApiError with status and payload on failure', async () => {
    respond(409, { success: false, data: { rev: 9 }, error: 'Stale session revision' });
    const err = await api.saveState('s1', {} as never).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 409, message: 'Stale session revision', data: { rev: 9 } });
  });

  it('turns network failures into a friendly error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    await expect(api.settings()).rejects.toMatchObject({ status: 0, message: expect.stringMatching(/reach the server/) });
  });

  it('builds media URLs', () => {
    expect(mediaUrl('bench-press', 1)).toBe('/api/media/bench-press/1');
  });
});
